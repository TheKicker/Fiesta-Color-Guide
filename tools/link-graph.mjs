#!/usr/bin/env node
/**
 * The internal link graph: what points at what, and how far from the homepage.
 *
 *   node tools/link-graph.mjs
 *
 * Internal links are how ranking moves around a site and how a crawler decides
 * what matters. Two things go wrong quietly:
 *
 *   - An orphan: a page nothing links to. It exists, it is in the sitemap, and
 *     it is invisible to anything following links.
 *   - Depth: a page four clicks from the homepage is treated as less important
 *     than one that is two, whatever the sitemap says.
 *
 * Both are invisible until measured, which is what this does.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function htmlFiles(dir, acc = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) await htmlFiles(full, acc);
    else if (e.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

const key = (file) => relative(ROOT, file).split('\\').join('/');

/** Resolve an href from one page to another page's key, or null if external. */
function resolveHref(fromFile, href) {
  if (!href || /^(https?:|mailto:|tel:|#|data:)/.test(href)) return null;
  const clean = href.split('#')[0].split('?')[0];
  if (!clean) return null;
  let target = resolve(dirname(fromFile), clean);
  if (clean.endsWith('/') || !clean.split('/').pop().includes('.')) {
    target = join(target, 'index.html');
  }
  if (!target.endsWith('.html')) return null;
  return key(target);
}

export async function buildGraph(root = ROOT) {
  const files = await htmlFiles(root);
  const pages = new Map();

  for (const file of files) {
    const html = await readFile(file, 'utf8');
    // Only count links from the page body. Header and footer links appear on
    // every page and would flatten the graph into noise.
    const main = html.includes('<main')
      ? html.slice(html.indexOf('<main'), html.indexOf('</main>'))
      : html;
    const out = new Set();
    for (const m of main.matchAll(/<a\b[^>]*href="([^"]*)"/g)) {
      const t = resolveHref(file, m[1]);
      if (t && t !== key(file)) out.add(t);
    }
    pages.set(key(file), { out, in: new Set(), depth: Infinity });
  }

  // Chrome links (header/footer) still matter for reachability, so gather them
  // separately -- a page reachable only from the footer is not an orphan, but
  // it is not being recommended by any content either.
  const chromeTargets = new Set();
  const homeHtml = await readFile(join(ROOT, 'index.html'), 'utf8');
  for (const region of [
    homeHtml.slice(0, homeHtml.indexOf('<main')),
    homeHtml.slice(homeHtml.indexOf('</main>')),
  ]) {
    for (const m of region.matchAll(/<a\b[^>]*href="([^"]*)"/g)) {
      const t = resolveHref(join(ROOT, 'index.html'), m[1]);
      if (t) chromeTargets.add(t);
    }
  }

  for (const [from, node] of pages) {
    for (const to of node.out) {
      if (pages.has(to)) pages.get(to).in.add(from);
    }
  }

  // Click depth from the homepage, following body links plus site chrome.
  const start = 'index.html';
  pages.get(start).depth = 0;
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    const d = pages.get(cur).depth;
    const next = new Set(pages.get(cur).out);
    if (cur === start) for (const t of chromeTargets) next.add(t);
    for (const to of next) {
      const node = pages.get(to);
      if (node && node.depth > d + 1) {
        node.depth = d + 1;
        queue.push(to);
      }
    }
  }

  const rows = [...pages.entries()].map(([path, n]) => ({
    path,
    inbound: n.in.size,
    outbound: n.out.size,
    depth: n.depth,
    viaChrome: chromeTargets.has(path),
  }));

  return rows;
}

async function main() {
  const rows = await buildGraph();

  const group = (label, test) => {
    const g = rows.filter((r) => test(r.path));
    if (!g.length) return null;
    const avg = (k) => (g.reduce((s, r) => s + r[k], 0) / g.length).toFixed(1);
    const maxDepth = Math.max(...g.map((r) => (r.depth === Infinity ? -1 : r.depth)));
    return { label, n: g.length, inbound: avg('inbound'), outbound: avg('outbound'), maxDepth };
  };

  console.log('\nINTERNAL LINK GRAPH (body links only; chrome counted for reachability)\n');
  console.log('  group            pages   avg inbound   avg outbound   max depth');
  console.log('  ' + '-'.repeat(66));
  for (const g of [
    group('Home', (p) => p === 'index.html'),
    group('Color pages', (p) => p.startsWith('colors/') && !p.includes('/shade/') && !p.includes('/era/')),
    group('Shade hubs', (p) => p.includes('colors/shade/')),
    group('Era hubs', (p) => p.includes('colors/era/')),
    group('History', (p) => p === 'history.html'),
    group('About / privacy', (p) => p === 'about.html' || p === 'privacy.html'),
  ].filter(Boolean)) {
    console.log(
      `  ${g.label.padEnd(16)} ${String(g.n).padStart(5)}   ${g.inbound.padStart(11)}   ` +
        `${g.outbound.padStart(12)}   ${String(g.maxDepth).padStart(9)}`
    );
  }

  const orphans = rows.filter((r) => r.inbound === 0 && !r.viaChrome && r.path !== 'index.html');
  const nearOrphans = rows
    .filter((r) => r.inbound > 0 && r.inbound <= 2 && r.path !== '404.html')
    .sort((a, b) => a.inbound - b.inbound);
  const unreachable = rows.filter((r) => r.depth === Infinity && r.path !== '404.html');

  console.log(`\n  Orphans (no body link anywhere, not in chrome): ${orphans.length}`);
  for (const o of orphans.slice(0, 10)) console.log(`    ${o.path}`);

  console.log(`\n  Unreachable from the homepage by any link: ${unreachable.length}`);
  for (const u of unreachable.slice(0, 10)) console.log(`    ${u.path}`);

  console.log(`\n  Thinly linked (1-2 inbound body links): ${nearOrphans.length}`);
  for (const n of nearOrphans.slice(0, 12)) {
    console.log(`    ${String(n.inbound).padStart(2)} in, depth ${n.depth}   ${n.path}`);
  }

  const deep = rows.filter((r) => r.depth > 2 && r.depth !== Infinity);
  console.log(`\n  More than 2 clicks from the homepage: ${deep.length}`);
  for (const d of deep.slice(0, 10)) console.log(`    depth ${d.depth}   ${d.path}`);
  console.log('');
}

// Only print the report when run directly; check.mjs imports buildGraph().
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
