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
  rainbow,
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

/**
 * <lastmod> value for a page whose content changed in this build.
 *
 * The sitemap protocol takes W3C Datetime, which may be a bare date or a full
 * timestamp with an offset. A timestamp is more precise, and Google reads
 * either, so this emits one.
 *
 * `--stamp <datetime>` overrides it for every page. That is for the case this
 * exists to serve: a deploy that genuinely rewrote the whole site, where one
 * shared timestamp is the accurate answer rather than a fiction. Do not reach
 * for it to nudge a crawler -- a lastmod that does not correspond to a real
 * change is the thing that teaches Google to ignore the field.
 */
function nowStamp() {
  const flag = process.argv.indexOf('--stamp');
  if (flag !== -1 && process.argv[flag + 1]) {
    const given = process.argv[flag + 1];
    if (Number.isNaN(Date.parse(given))) {
      throw new Error(`--stamp is not a parseable date: ${given}`);
    }
    return given;
  }
  return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
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
  const stamp = nowStamp();
  // With --stamp, every page is restamped whether or not its hash moved.
  const stampAll = process.argv.includes('--stamp');
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

  const withheld = [];

  /**
   * Write a page, remember when its content last actually changed, and list it
   * in the sitemap.
   *
   * A page the template marked `noindex` is deliberately left out: submitting a
   * URL that then tells the crawler not to index it is a contradiction, and the
   * whole point of the content threshold is to stop asking Google to look at
   * pages that are not ready.
   */
  async function route(file, url, html, extra = {}) {
    await emit(file, html);
    const hash = contentHash(html);
    const before = previous[url];
    const date = !stampAll && before && before.hash === hash ? before.date : stamp;
    lastmod[url] = { hash, date };

    if (/<meta name="robots" content="noindex/.test(html)) {
      withheld.push(url || '/');
      return;
    }
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

  await route(
    'colors/rainbow/index.html',
    'colors/rainbow/',
    shell(rainbow({ site, data, base: '../../' })),
    { changefreq: 'monthly', priority: '0.8' }
  );

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
      const reserved = entry.name === 'shade' || entry.name === 'era' || entry.name === 'rainbow';
      if (entry.isDirectory() && !reserved && !slugs.has(entry.name)) {
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
        // Root-relative, so the manifest is not a second place the domain
        // has to be kept in sync.
        start_url: '/',
        scope: '/',
        id: '/',
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

  /* ---------------------------------------------------------- README stats
     The README used to state "61 glazes" and "78 pages, 77 in the sitemap" in
     prose. Those are exactly the numbers that go stale the first time a color
     is added -- the same failure the rest of this build guards against -- so
     the build keeps them current between the markers instead. */
  const notedColors = data.colors.filter((c) => c.notes.length).length;
  const htmlPages = written.filter((w) => w.path.endsWith('.html')).length;

  try {
    const readmePath = p('README.MD');
    const readme = await readFile(readmePath, 'utf8');
    const START = '<!-- stats:start -->';
    const END = '<!-- stats:end -->';
    const from = readme.indexOf(START);
    const to = readme.indexOf(END);
    if (from !== -1 && to > from) {
      const stats = [
        '',
        `| | |`,
        `| --- | --- |`,
        `| Colors documented | **${data.colors.length}** (${data.vintage.length} vintage, ${data.post86.length} Post 86) |`,
        `| In production | **${data.current.length}** |`,
        `| Colors with hand-written notes | **${notedColors}/${data.colors.length}** |`,
        `| Shade families | ${data.shades.length}, ${Object.keys(data.shadeNotes || {}).length} with an intro |`,
        `| Pages generated | **${htmlPages}** |`,
        `| URLs in sitemap | ${urls.length}${withheld.length ? ` (${withheld.length} held back as noindex)` : ''} |`,
        `| Newest color | ${data.timeline[data.timeline.length - 1].color} (${data.timeline[data.timeline.length - 1].startYear}) |`,
        '',
        `<sub>This table is regenerated by \`npm run build\`. Do not edit it by hand.</sub>`,
        '',
      ].join('\n');
      const next = readme.slice(0, from + START.length) + stats + readme.slice(to);
      if (next !== readme) await writeFile(readmePath, next, 'utf8');
    }
  } catch (error) {
    console.warn(`  README stats not updated: ${error.message}`);
  }

  /* -------------------------------------------------------------- report */

  const totalBytes = written.reduce((sum, w) => sum + w.bytes, 0);
  const hubs = data.shades.length + Object.keys(eras).length;
  const threshold = site.content?.minOriginalWords ?? 0;
  const ready = data.colors.filter((c) => c.originalWords >= threshold).length;
  const withNotes = data.colors.filter((c) => c.notes.length).length;
  const changed = Object.values(lastmod).filter((v) => v.date === stamp).length;

  console.log(`\nBuilt ${written.length} files (${(totalBytes / 1024).toFixed(0)} KB)`);
  console.log(`  ${data.colors.length} color pages, ${hubs} facet hubs`);
  console.log(`  ${changed} page(s) whose content changed today`);
  console.log(
    `  ${withNotes}/${data.colors.length} colors have notes` +
      (threshold ? `, ${ready} over the ${threshold}-word bar` : '')
  );
  console.log(`  ${withheld.length} page(s) held back from the sitemap as noindex`);
  console.log(`  ${urls.length} URLs in sitemap.xml`);
  console.log(`  ${data.colors.length} colors, ${data.current.length} in production`);
  const filledSlots = Object.values(site.adsense?.slots || {}).filter(Boolean).length;
  console.log(
    `  adsense: ${
      site.adsense?.client
        ? `${site.adsense.client} on all pages, ${filledSlots} ad unit${filledSlots === 1 ? '' : 's'} placed`
        : 'not configured'
    }`
  );
  console.log(`  base URL: ${site.baseUrl}\n`);
}

main().catch((error) => {
  console.error('\nBuild failed:', error);
  process.exitCode = 1;
});
