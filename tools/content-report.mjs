#!/usr/bin/env node
/**
 * How much of this site is original writing, and which pages are still thin.
 *
 *   node tools/content-report.mjs
 *
 * AdSense's stated bar is "enough unique content", and Search's quality
 * guidance says much the same thing. Both are really asking one question that
 * word count alone cannot answer: how much of this text exists only on this
 * page?
 *
 * So this measures two things:
 *
 *  - Original words per color, straight from fiesta.json: the description plus
 *    anything written into `notes`. This is what the build's indexing
 *    threshold uses, and the number you move by writing.
 *
 *  - Unique text per rendered page, by 8-word shingle: any passage that also
 *    appears on another page is boilerplate, however many words it adds. This
 *    is what a reviewer effectively sees.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadData } from '../src/lib/data.mjs';

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

/** Visible text of <main>, with scripts, styles and inline SVG removed. */
function bodyText(html) {
  const start = html.indexOf('<main');
  const end = html.indexOf('</main>');
  let s = start === -1 ? html : html.slice(start, end);
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&[a-z]+;|&#\d+;/gi, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

const words = (t) => t.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));

function shingles(text, n = 8) {
  const w = words(text.toLowerCase());
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
}

const bar = (pct, width = 20) => {
  const filled = Math.round((pct / 100) * width);
  return '#'.repeat(filled) + '.'.repeat(width - filled);
};

async function main() {
  const site = JSON.parse(await readFile(join(ROOT, 'site.config.json'), 'utf8'));
  const data = await loadData(join(ROOT, 'fiesta.json'));
  const threshold = site.content?.minOriginalWords ?? 0;

  /* --- what is written, per color -------------------------------------- */
  const ready = data.colors.filter((c) => c.originalWords >= threshold);
  const thin = data.colors
    .filter((c) => c.originalWords < threshold)
    .sort((a, b) => a.originalWords - b.originalWords);
  const withNotes = data.colors.filter((c) => c.notes.length > 0);

  console.log('\nORIGINAL WRITING (from fiesta.json)\n');
  console.log(`  indexing bar          ${threshold} words (description + notes)`);
  console.log(
    `  colors over the bar   ${ready.length}/${data.colors.length}  ${bar(
      (ready.length / data.colors.length) * 100
    )}`
  );
  console.log(`  colors with notes     ${withNotes.length}/${data.colors.length}`);

  const shadeNoteCount = Object.keys(data.shadeNotes || {}).length;
  console.log(`  shade families with an intro   ${shadeNoteCount}/${data.shades.length}`);

  if (thin.length) {
    console.log(`\n  Below the bar, thinnest first - these ship noindex:`);
    for (const c of thin.slice(0, 20)) {
      const need = threshold - c.originalWords;
      console.log(
        `    ${String(c.originalWords).padStart(3)} words  (+${String(need).padStart(3)} needed)  ${c.color}`
      );
    }
    if (thin.length > 20) console.log(`    ... and ${thin.length - 20} more`);
  }

  /* --- what a reader actually sees ------------------------------------- */
  const files = await htmlFiles(ROOT);
  const pages = [];
  for (const f of files) {
    const text = bodyText(await readFile(f, 'utf8'));
    pages.push({ path: relative(ROOT, f).split('\\').join('/'), words: words(text).length, sh: shingles(text) });
  }

  const seen = new Map();
  for (const p of pages) for (const s of p.sh) seen.set(s, (seen.get(s) || 0) + 1);
  for (const p of pages) {
    let unique = 0;
    for (const s of p.sh) if (seen.get(s) === 1) unique++;
    p.uniquePct = p.sh.size ? (unique / p.sh.size) * 100 : 0;
    p.uniqueWords = Math.round(p.words * (p.uniquePct / 100));
  }

  const groups = [
    ['Home', (p) => p === 'index.html'],
    [
      'Color pages',
      (p) =>
        p.startsWith('colors/') &&
        !p.includes('/shade/') &&
        !p.includes('/era/') &&
        !p.includes('/rainbow/'),
    ],
    ['ROYGBIV', (p) => p.includes('colors/rainbow/')],
    ['Guides', (p) => p.startsWith('guides/') && p !== 'guides/index.html'],
    ['Shade hubs', (p) => p.includes('colors/shade/')],
    ['Era hubs', (p) => p.includes('colors/era/')],
    ['History', (p) => p === 'history.html'],
    ['About', (p) => p === 'about.html'],
  ];

  console.log('\n\nRENDERED PAGES - how much text is unique to that page\n');
  console.log('  group          pages   avg words   unique %   unique words');
  console.log('  ' + '-'.repeat(62));
  for (const [name, test] of groups) {
    const g = pages.filter((p) => test(p.path));
    if (!g.length) continue;
    const avg = (k) => g.reduce((s, p) => s + p[k], 0) / g.length;
    console.log(
      `  ${name.padEnd(14)} ${String(g.length).padStart(5)}   ${String(Math.round(avg('words'))).padStart(9)}   ` +
        `${avg('uniquePct').toFixed(0).padStart(7)}%   ${String(Math.round(avg('uniqueWords'))).padStart(12)}`
    );
  }

  const total = pages.reduce((s, p) => s + p.words, 0);
  const totalUnique = pages.reduce((s, p) => s + p.uniqueWords, 0);
  console.log('  ' + '-'.repeat(62));
  console.log(
    `  ${'ALL'.padEnd(14)} ${String(pages.length).padStart(5)}   ${String(total).padStart(9)}   ` +
      `${((totalUnique / total) * 100).toFixed(0).padStart(7)}%   ${String(totalUnique).padStart(12)}`
  );

  console.log(
    `\n  Writing one 120-word note for a color roughly doubles that page's` +
      `\n  unique text. ${thin.length} color${thin.length === 1 ? '' : 's'} would cross the indexing bar.\n`
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
