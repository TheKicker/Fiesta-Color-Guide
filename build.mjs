#!/usr/bin/env node
/**
 * Static site generator for the Unofficial Fiesta Color Guide.
 *
 *   node build.mjs
 *
 * Reads fiesta.json + site.config.json and writes complete HTML for every
 * page, plus sitemap.xml, robots.txt and the web manifest. There are no
 * dependencies -- Node's standard library does all of it.
 *
 * Edit templates in src/, never the generated .html files at the repo root:
 * the next build overwrites them.
 */
import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadData } from './src/lib/data.mjs';
import { page } from './src/templates/layout.mjs';
import {
  home,
  colorPage,
  history,
  about,
  privacy,
  notFound,
  shadeHub,
  eraHub,
  eraMeta,
} from './src/templates/pages.mjs';
import { createHash } from 'node:crypto';

const ROOT = dirname(fileURLToPath(import.meta.url));
const p = (...parts) => join(ROOT, ...parts);

const written = [];

async function emit(relPath, contents) {
  const target = p(relPath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents, 'utf8');
  written.push({ path: relPath.replace(/\\/g, '/'), bytes: Buffer.byteLength(contents) });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * <lastmod> should say when a page's content last changed, not when the build
 * last ran. Stamping every page with today's date on every build is noise that
 * search engines learn to ignore. This keeps a hash of each page's meaningful
 * content and only advances the date when that hash moves.
 */
const LASTMOD_CACHE = '.lastmod.json';

async function loadLastmod() {
  try {
    return JSON.parse(await readFile(p(LASTMOD_CACHE), 'utf8'));
  } catch {
    return {};
  }
}

/** Hash the body only -- the <lastmod> value itself must not feed the hash. */
function contentHash(html) {
  const body = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  return createHash('sha256').update(body || html).digest('hex').slice(0, 16);
}

async function main() {
  const site = JSON.parse(await readFile(p('site.config.json'), 'utf8'));
  const data = await loadData(p('fiesta.json'));
  const stamp = today();
  const year = new Date().getFullYear();
  const previous = await loadLastmod();
  const lastmod = {};

  let images = {};
  try {
    images = JSON.parse(await readFile(p('assets/opt/manifest.json'), 'utf8'));
  } catch {
    console.warn('  no assets/opt/manifest.json -- run `npm run images` for exact dimensions');
  }

  // Six current colours for the wordmark, spread across the spectrum so the
  // mark reads as a palette rather than a run of one hue.
  const vivid = data.current
    .filter((c) => c.derived.hsl.s > 15 && c.derived.hsl.l > 15 && c.derived.hsl.l < 88)
    .sort((a, b) => a.derived.hsl.h - b.derived.hsl.h);
  const markColors = Array.from({ length: 6 }, (_, i) =>
    vivid[Math.round((i * (vivid.length - 1)) / 5)]
  );

  const shell = (pageData) =>
    page({
      site,
      markColors,
      year,
      depth: 0,
      path: '',
      ...pageData,
    });

  /* ------------------------------------------------------------- routes */

  const urls = [];

  /** Write a page, remember when its content last actually changed, list it. */
  async function route(file, url, html, extra = {}) {
    await emit(file, html);
    const hash = contentHash(html);
    const before = previous[url];
    const date = before && before.hash === hash ? before.date : stamp;
    lastmod[url] = { hash, date };
    urls.push({ path: url, lastmod: date, ...extra });
  }

  await route('index.html', '', shell(home({ site, data, base: '' })), {
    changefreq: 'weekly',
    priority: '1.0',
  });

  await route('history.html', 'history.html', shell(history({ site, data, base: '' })), {
    changefreq: 'monthly',
    priority: '0.7',
  });

  await route('about.html', 'about.html', shell(about({ site, data, base: '' })), {
    changefreq: 'yearly',
    priority: '0.6',
  });

  await route(
    'privacy.html',
    'privacy.html',
    shell(privacy({ site, base: '', updated: stamp })),
    { changefreq: 'yearly', priority: '0.3' }
  );

  await emit('404.html', shell(notFound({ site, data, base: '' })));

  // Facet hubs: real URLs for "Fiesta blue colors" and "vintage Fiesta colors",
  // which a ?shade= query parameter can never rank for.
  for (const shade of data.shades) {
    await route(
      `colors/shade/${shade.toLowerCase()}/index.html`,
      `colors/shade/${shade.toLowerCase()}/`,
      shell(shadeHub({ site, data, shade, base: '../../../' })),
      { changefreq: 'monthly', priority: '0.8' }
    );
  }

  const eras = eraMeta(data);
  for (const era of Object.keys(eras)) {
    await route(
      `colors/era/${eras[era].slug}/index.html`,
      `colors/era/${eras[era].slug}/`,
      shell(eraHub({ site, data, era, base: '../../../' })),
      { changefreq: era === 'current' ? 'weekly' : 'yearly', priority: era === 'current' ? '0.9' : '0.8' }
    );
  }

  // Drop colour folders whose slug no longer exists, so a renamed colour
  // doesn't leave an orphan page indexed forever.
  const slugs = new Set(data.colors.map((c) => c.slug));
  if (existsSync(p('colors'))) {
    for (const entry of await readdir(p('colors'), { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== 'shade' && entry.name !== 'era' && !slugs.has(entry.name)) {
        await rm(p('colors', entry.name), { recursive: true, force: true });
        console.log(`  removed stale page: colors/${entry.name}/`);
      }
    }
  }

  for (const color of data.colors) {
    const dims = images[`assets/colors/${color.image}`];
    await route(
      `colors/${color.slug}/index.html`,
      `colors/${color.slug}/`,
      shell(colorPage({ site, data, color, base: '../../', images })),
      {
        changefreq: color.current ? 'monthly' : 'yearly',
        priority: color.current ? '0.9' : '0.8',
        image: {
          loc: `${site.baseUrl}/assets/colors/${color.image}`,
          caption: `Fiesta dinnerware glazed in ${color.color} (${color.hex})`,
          ...dims,
        },
      }
    );
  }

  /* ------------------------------------------------------ crawler files */

  const xmlEscape = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  await emit(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    (u) => `  <url>
    <loc>${site.baseUrl}/${u.path}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${
      u.image
        ? `
    <image:image>
      <image:loc>${xmlEscape(u.image.loc)}</image:loc>
      <image:caption>${xmlEscape(u.image.caption)}</image:caption>
    </image:image>`
        : ''
    }
  </url>`
  )
  .join('\n')}
</urlset>
`
  );

  // Remember what each page's content hashed to, so the next build can tell a
  // real change from a rebuild.
  await emit(LASTMOD_CACHE, JSON.stringify(lastmod, null, 2) + '\n');

  await emit(
    'robots.txt',
    `# The Unofficial Fiesta Color Guide
User-agent: *
Allow: /

# Search is an unbounded URL space -- every query string is a new URL that
# returns a subset of the same 61 colors. Block it.
Disallow: /*?q=

# The shade, era, status, decade and sort parameters are deliberately NOT
# blocked. They are a small, finite set, every one of them declares the
# homepage as its canonical, and blocking a URL stops a crawler reading the
# canonical tag that would have consolidated it. The indexable version of each
# facet is a real page under /colors/shade/ and /colors/era/.

Sitemap: ${site.baseUrl}/sitemap.xml
`
  );

  if (site.adsense?.client) {
    const pub = site.adsense.client.replace(/^ca-/, '');
    await emit('ads.txt', `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`);
  }

  await emit(
    'assets/images/site.webmanifest',
    JSON.stringify(
      {
        name: site.siteName,
        short_name: site.shortName,
        description: `Every Fiesta dinnerware color from ${data.firstYear} to today, with hex codes and production years.`,
        start_url: `${site.baseUrl}/`,
        scope: `${site.baseUrl}/`,
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ff813f',
        icons: [
          { src: 'android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'android-chrome-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      null,
      2
    ) + '\n'
  );

  /* -------------------------------------------------------------- report */

  const totalBytes = written.reduce((sum, w) => sum + w.bytes, 0);
  const hubs = data.shades.length + Object.keys(eras).length;
  const changed = Object.values(lastmod).filter((v) => v.date === stamp).length;

  console.log(`\nBuilt ${written.length} files (${(totalBytes / 1024).toFixed(0)} KB)`);
  console.log(`  ${data.colors.length} color pages, ${hubs} facet hubs`);
  console.log(`  ${changed} page(s) whose content changed today`);
  console.log(`  ${urls.length} URLs in sitemap.xml`);
  console.log(`  ${data.colors.length} colors, ${data.current.length} in production`);
  console.log(
    `  ads: ${site.adsense?.enabled && site.adsense?.client ? 'enabled (' + site.adsense.client + ')' : 'not enabled'}`
  );
  console.log(`  base URL: ${site.baseUrl}\n`);
}

main().catch((error) => {
  console.error('\nBuild failed:', error);
  process.exitCode = 1;
});
