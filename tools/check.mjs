#!/usr/bin/env node
/**
 * Post-build checks on the generated site.
 *
 *   node tools/check.mjs
 *
 * Catches the things that quietly break SEO, accessibility and mobile layout,
 * and would otherwise only be found by a visitor: dead links, missing alt
 * text, unlabelled controls, skipped heading levels, malformed structured
 * data, layouts that overflow a narrow screen, and copy that claims a count
 * the dataset no longer supports.
 *
 * Exits non-zero on any error, so CI can gate on it.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadData } from '../src/lib/data.mjs';
import { buildGraph } from './link-graph.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const errors = [];
const warnings = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

async function htmlFiles(dir = ROOT, acc = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await htmlFiles(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

/** Resolve an href written in a page back to a path on disk. */
function targetPath(file, href) {
  const clean = href.split('#')[0].split('?')[0];
  if (!clean) return null;
  let candidate = resolve(dirname(file), clean);
  if (clean.endsWith('/') || !clean.split('/').pop().includes('.')) {
    candidate = join(candidate, 'index.html');
  }
  return candidate;
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

const rel = (file) => relative(ROOT, file).split('\\').join('/');

async function main() {
  const files = await htmlFiles();
  console.log(`Checking ${files.length} HTML files...\n`);

  const model = await loadData(join(ROOT, 'fiesta.json'));
  const site = JSON.parse(await readFile(join(ROOT, 'site.config.json'), 'utf8'));
  const siteHost = new URL(site.baseUrl).host;
  // Hosts the site legitimately links out to that happen to be on github.io.
  const knownExternalHosts = new Set([]);

  /* Counts the copy is allowed to state. Anything else is stale text. */
  const shadeCounts = new Map();
  for (const c of model.colors) {
    shadeCounts.set(c.shadeOf, (shadeCounts.get(c.shadeOf) || 0) + 1);
  }
  const validCounts = new Set([
    model.colors.length,
    model.current.length,
    model.retired.length,
    model.vintage.length,
    model.post86.length,
    model.shades.length,
    model.history.length,
    ...shadeCounts.values(),
    // A palette strip legitimately describes itself as 3, 4 or 5 colors.
    3,
    4,
    5,
  ]);

  const idsByFile = new Map();
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    idsByFile.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }

  for (const file of files) {
    const name = rel(file);
    const html = await readFile(file, 'utf8');
    const mainRegion = html.includes('<main')
      ? html.slice(html.indexOf('<main'), html.indexOf('</main>'))
      : html;

    /* --- head ---------------------------------------------------------- */
    const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
    if (!title) fail(name, 'missing <title>');
    else if (title.length > 65) {
      warn(name, `title is ${title.length} chars (Google truncates ~60): ${title}`);
    }

    const desc = attr((html.match(/<meta name="description"[^>]*>/) || [''])[0], 'content');
    if (!desc) fail(name, 'missing meta description');
    else if (desc.length > 165) warn(name, `meta description is ${desc.length} chars (truncates ~160)`);
    else if (desc.length < 70) warn(name, `meta description is only ${desc.length} chars`);

    if (!/<link rel="canonical"/.test(html)) fail(name, 'missing canonical');
    if (!/<html lang="/.test(html)) fail(name, 'missing lang on <html>');

    /* --- AdSense verification ------------------------------------------
       Google checks for these on the pages it crawls, and a page that quietly
       lost them fails review with no obvious cause. Both must be present, and
       both must be inside <head>, on every page. */
    if (site.adsense?.client) {
      const headEnd = html.indexOf('</head>');
      const metaAt = html.indexOf(`content="${site.adsense.client}"`);
      const loaderAt = html.indexOf('pagead2.googlesyndication.com');

      if (!/<meta name="google-adsense-account"/.test(html)) {
        fail(name, 'missing the google-adsense-account meta tag');
      } else if (metaAt > headEnd) {
        fail(name, 'google-adsense-account meta tag is outside <head>');
      }

      if (loaderAt === -1) fail(name, 'missing the AdSense loader script');
      else if (loaderAt > headEnd) fail(name, 'AdSense loader script is outside <head>');
    }

    /* --- absolute URLs --------------------------------------------------
       Every absolute link back into this site must point at the configured
       baseUrl. A hardcoded host is how a domain move leaves canonicals,
       Open Graph URLs or schema @ids quietly aimed at the old address. */
    for (const m of html.matchAll(/(?:href|content|src)="(https?:\/\/[^"]+)"/g)) {
      const url = m[1];
      let host;
      try {
        host = new URL(url).host;
      } catch {
        continue;
      }
      if (host === siteHost) continue;
      if (!knownExternalHosts.has(host) && /github\.io$/.test(host)) {
        fail(name, `absolute URL points at an old host: ${url}`);
      }
    }

    /* --- responsive ---------------------------------------------------- */
    const viewport = attr((html.match(/<meta name="viewport"[^>]*>/) || [''])[0], 'content');
    if (!viewport) fail(name, 'missing viewport meta');
    else {
      if (!/width=device-width/.test(viewport)) fail(name, 'viewport lacks width=device-width');
      // Locking zoom is a WCAG 1.4.4 failure, and Google flags it too.
      if (/user-scalable\s*=\s*no/.test(viewport)) fail(name, 'viewport disables zoom');
      const max = viewport.match(/maximum-scale\s*=\s*([\d.]+)/);
      if (max && Number(max[1]) < 2) fail(name, `viewport caps zoom at ${max[1]}x (needs >= 2)`);
    }

    // A fixed pixel width wider than the narrowest phone scrolls the page
    // sideways -- the most common mobile-usability failure there is.
    for (const m of html.matchAll(/style="([^"]*)"/g)) {
      const px = m[1].match(/(?:^|[^-])width:\s*(\d+)px/);
      if (px && Number(px[1]) > 320 && !/max-width/.test(m[1])) {
        fail(name, `inline style sets a fixed width of ${px[1]}px (overflows a 320px screen)`);
      }
    }

    /* --- headings ------------------------------------------------------ */
    const headings = [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => ({
      level: Number(m[1]),
      text: m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    }));
    const h1s = headings.filter((h) => h.level === 1);
    if (h1s.length === 0) fail(name, 'no <h1>');
    if (h1s.length > 1) fail(name, `${h1s.length} <h1> elements (should be exactly 1)`);

    let previous = 0;
    for (const h of headings) {
      if (previous && h.level > previous + 1) {
        fail(name, `heading jumps h${previous} -> h${h.level} at "${h.text.slice(0, 40)}"`);
      }
      previous = h.level;
      if (!h.text) fail(name, `empty h${h.level}`);
    }

    /* --- dashes ----------------------------------------------------------
       House style is a single hyphen with spaces around it, the way a person
       types. Em and en dashes and a literal double hyphen all read as someone
       else's punctuation, and "--" in particular is a rendering bug rather than
       a style choice: it means a source string meant an em dash and never got
       one. */
    const visible = mainRegion
      .replace(/<[^>]+>/g, ' ')
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–');
    const emCount = (visible.match(/—/g) || []).length;
    const enCount = (visible.match(/–/g) || []).length;
    const dashDash = (visible.match(/--/g) || []).length;
    if (emCount) fail(name, `${emCount} em dash(es) in visible text; house style is " - "`);
    if (enCount) fail(name, `${enCount} en dash(es) in visible text; house style is "-"`);
    if (dashDash) fail(name, `${dashDash} literal "--" in visible text (a dash that never rendered)`);

    /* --- claimed counts -------------------------------------------------
       A title like "All 14, With Hex Codes" is a promise about the dataset and
       the first thing to rot when a color is added.

       Scoped to titles and h1s on purpose. Body copy is full of counts that
       are genuinely computed per page ("41 colors were in production at the
       same time"), and those are exactly the ones that cannot go stale. */
    const headline = [title || '', ...h1s.map((h) => h.text)].join(' ; ');
    const claims = [
      // "Post 86" is a product line, not a count.
      ...headline.matchAll(/(?<!Post\s)\b(\d{1,3})\s+(?:colors|glazes)\b/gi),
      ...headline.matchAll(/\bAll\s+(\d{1,3})\b/gi),
    ];
    for (const claim of claims) {
      const n = Number(claim[1]);
      if (!validCounts.has(n)) {
        fail(
          name,
          `headline claims a count of ${n} ("${claim[0].trim()}") that matches nothing in fiesta.json`
        );
      }
    }

    /* --- images -------------------------------------------------------- */
    for (const m of html.matchAll(/<img\b[^>]*>/g)) {
      const tag = m[0];
      if (attr(tag, 'alt') === null) fail(name, `<img> without alt: ${tag.slice(0, 90)}`);
      if (!attr(tag, 'width') || !attr(tag, 'height')) {
        warn(name, `<img> without width/height (layout shift): ${(attr(tag, 'src') || '').slice(-40)}`);
      }
    }

    /* --- controls ------------------------------------------------------ */
    const labelFor = new Set([...html.matchAll(/<label[^>]*for="([^"]+)"/g)].map((m) => m[1]));

    /* A control wrapped in its own <label> is implicitly labelled, which is
       valid HTML and valid for assistive tech. A control inside an aria-hidden
       subtree is not in the accessibility tree at all, which is precisely how a
       spam honeypot is meant to work. Neither counts as unlabelled. */
    const exempt = new Set();
    for (const m of html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)) {
      for (const c of m[1].matchAll(/<(input|select|textarea)\b[^>]*>/g)) exempt.add(c[0]);
    }
    for (const m of html.matchAll(/aria-hidden="true"[\s\S]{0,400}?<\/(?:p|div|span|li)>/g)) {
      for (const c of m[0].matchAll(/<(input|select|textarea)\b[^>]*>/g)) exempt.add(c[0]);
    }

    for (const m of html.matchAll(/<(input|select|textarea)\b[^>]*>/g)) {
      const tag = m[0];
      if (attr(tag, 'type') === 'hidden') continue;
      if (exempt.has(tag)) continue;
      const id = attr(tag, 'id');
      const labelled =
        (id && labelFor.has(id)) || attr(tag, 'aria-label') || attr(tag, 'aria-labelledby');
      if (!labelled) fail(name, `unlabelled form control: ${tag.slice(0, 80)}`);
    }

    for (const m of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) {
      const inner = m[1].replace(/<[^>]+>/g, '').trim();
      if (!inner && !attr(m[0], 'aria-label')) {
        fail(name, `button with no accessible name: ${m[0].slice(0, 80)}`);
      }
    }

    /* --- links --------------------------------------------------------- */
    for (const m of html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const [tag, href, inner] = m;
      const linkText = inner.replace(/<[^>]+>/g, '').trim();
      if (!linkText && !attr(tag, 'aria-label') && !attr(tag, 'title')) {
        fail(name, `link with no accessible name: href="${href}"`);
      }
      if (href === '') fail(name, 'empty href (resolves to the current page)');

      if (/^https?:/.test(href) || href.startsWith('mailto:')) {
        if (attr(tag, 'target') === '_blank' && !/noopener/.test(attr(tag, 'rel') || '')) {
          fail(name, `target="_blank" without rel="noopener": ${href}`);
        }
        continue;
      }
      if (href.startsWith('#')) {
        const id = href.slice(1);
        if (id && !idsByFile.get(file).has(id)) fail(name, `dead in-page anchor: ${href}`);
        continue;
      }

      const target = targetPath(file, href);
      if (target && !existsSync(target)) fail(name, `dead link: ${href} -> ${rel(target)}`);
      const hash = href.split('#')[1];
      if (hash && target && idsByFile.has(target) && !idsByFile.get(target).has(hash)) {
        fail(name, `dead cross-page anchor: ${href}`);
      }
    }

    /* --- link text ------------------------------------------------------
       WCAG 2.4.4. Five color names exist in both eras, and a shade family
       shares its name with a color, so the same visible text can point at
       different pages. Someone navigating by a list of links needs them to be
       distinguishable, which is what the visually-hidden years and "family"
       suffixes are for. */
    const linkTargets = new Map();
    for (const m of mainRegion.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const label = m[2]
        .replace(/<[^>]+>/g, '')
        .replace(/&[a-z]+;|&#\d+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      if (!label) continue;
      if (!linkTargets.has(label)) linkTargets.set(label, new Set());
      linkTargets.get(label).add(m[1]);
    }
    for (const [label, targets] of linkTargets) {
      if (targets.size > 1) {
        fail(name, `link text "${label.slice(0, 30)}" points at ${targets.size} different URLs`);
      }
    }

    /* --- external links -------------------------------------------------
       A new tab opening unannounced is disorienting, especially with a screen
       reader or magnifier. */
    for (const m of html.matchAll(/<a[^>]*target="_blank"[^>]*>([\s\S]*?)<\/a>/g)) {
      if (!/new tab|new window/i.test(m[1].replace(/<[^>]+>/g, ' '))) {
        fail(name, 'target="_blank" link does not say it opens a new tab');
      }
    }

    /* --- assets -------------------------------------------------------- */
    for (const m of html.matchAll(/(?:src|srcset)="([^"]+)"/g)) {
      for (const part of m[1].split(',')) {
        const url = part.trim().split(/\s+/)[0];
        if (!url || /^(https?:|data:)/.test(url)) continue;
        if (!existsSync(resolve(dirname(file), url))) fail(name, `missing asset: ${url}`);
      }
    }

    /* --- structured data ----------------------------------------------- */
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try {
        const parsed = JSON.parse(m[1]);
        for (const node of parsed['@graph'] || [parsed]) {
          if (!node['@type']) fail(name, 'JSON-LD node without @type');
        }
      } catch (e) {
        fail(name, `invalid JSON-LD: ${e.message}`);
      }
    }
  }

  /* --- stylesheet --------------------------------------------------------
     An auto-fit/auto-fill track whose minimum is a fixed length overflows once
     the viewport is narrower than that minimum. `minmax(min(100%, 15rem), 1fr)`
     is the guarded form; `minmax(0, ...)` is inherently safe. */
  const css = await readFile(join(ROOT, 'assets', 'css', 'main.css'), 'utf8');
  css.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(/minmax\(\s*([^,]+),/g)) {
      const min = m[1].trim();
      if (min === '0' || min.startsWith('min(100%')) continue;
      const rem = min.match(/^([\d.]+)rem$/);
      // Up to 8.5rem (136px) still fits two columns on a 320px screen.
      if (rem && Number(rem[1]) <= 8.5) continue;
      warn('assets/css/main.css', `line ${i + 1}: minmax min of "${min}" may overflow a narrow screen`);
    }
  });

  /* --- internal link graph -----------------------------------------------
     A page nothing links to is invisible to anything following links, however
     neatly it sits in the sitemap; and a page buried several clicks deep is
     treated as less important than a shallow one. Both are silent failures, so
     they are checked rather than assumed. */
  const noindexPaths = new Set();
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    if (/<meta name="robots" content="noindex/.test(html)) noindexPaths.add(rel(file));
  }

  const graph = await buildGraph(ROOT);
  for (const node of graph) {
    if (node.path === 'index.html') continue;
    /* A noindex page (404, a form's thank-you) is reached by other means, so
       nothing linking to it is the intended state rather than a fault. */
    if (noindexPaths.has(node.path)) continue;
    if (node.inbound === 0 && !node.viaChrome) {
      fail(node.path, 'orphan: no other page links to it from its body or the site chrome');
    }
    if (node.depth === Infinity) {
      fail(node.path, 'unreachable: no path of links from the homepage reaches it');
    } else if (node.depth > 3) {
      warn(node.path, `is ${node.depth} clicks from the homepage`);
    }
  }

  /* --- sitemap ----------------------------------------------------------- */
  const sitemap = await readFile(join(ROOT, 'sitemap.xml'), 'utf8');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  for (const loc of locs) {
    const path = loc.replace(site.baseUrl + '/', '');
    const target = path === '' ? 'index.html' : path.endsWith('/') ? path + 'index.html' : path;
    if (!existsSync(join(ROOT, target))) fail('sitemap.xml', `lists a URL with no file: ${loc}`);
  }

  /* A noindex page is deliberately absent from the sitemap; only a page that
     invites indexing and is then missing from it is a mistake. */
  let indexable = 0;
  let missing = 0;
  for (const file of files) {
    const html = await readFile(file, 'utf8');
    if (/<meta name="robots" content="noindex/.test(html)) continue;
    indexable++;
    const path = rel(file).replace(/index\.html$/, '').replace(/^\.\//, '');
    const url = `${site.baseUrl}/${path}`;
    if (!locs.includes(url)) {
      missing++;
      warn('sitemap.xml', `indexable page not listed: ${path || '/'}`);
    }
  }
  if (!missing && locs.length !== indexable) {
    warn('sitemap.xml', `${locs.length} URLs but ${indexable} indexable pages`);
  }

  /* --- report ------------------------------------------------------------ */
  for (const w of warnings) console.log(`  warn   ${w}`);
  if (warnings.length) console.log('');
  for (const e of errors) console.log(`  ERROR  ${e}`);

  console.log(
    `\n${errors.length} error${errors.length === 1 ? '' : 's'}, ` +
      `${warnings.length} warning${warnings.length === 1 ? '' : 's'} ` +
      `across ${files.length} pages and ${locs.length} sitemap URLs`
  );
  if (errors.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
