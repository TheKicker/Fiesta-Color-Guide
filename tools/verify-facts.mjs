#!/usr/bin/env node
/**
 * Prose must not contradict the data.
 *
 *   node tools/verify-facts.mjs
 *
 * Four fields on this site are auditable against real pieces and real company
 * records -- the color NAME, its START YEAR, its END YEAR and its SKU. Those
 * live in fiesta.json and are the only place they should be authoritative.
 *
 * The problem this solves: the hand-written `notes` restate those facts in
 * sentences. "Ran fifteen years", "retired in 1951", "carries No. 105". Correct
 * a year in fiesta.json and the prose keeps the old one, silently, forever --
 * and a color guide that contradicts itself is worse than one that says less.
 *
 * So every number written into prose is checked back against the data:
 *
 *   - every four-digit year must belong to this color, to a color it names, or
 *     to the company timeline
 *   - every "No. NNN" must be a real SKU, this color's or a named one
 *   - every "N years" duration must match an actual production run
 *   - every superlative ("longest run", "most saturated", "newest") must be
 *     true of this color and no other
 *   - every named color must exist
 *
 * A duration claim about a color still in production is always an error: it is
 * correct only in the year it was written.
 */
import { readFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadData } from '../src/lib/data.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const errors = [];
const warnings = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

/* --- number words ---------------------------------------------------------
   Notes are written in words ("twenty-two years"), so the checker has to read
   them the way a person would. */
const UNITS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

function wordToNumber(text) {
  const t = text.toLowerCase().trim();
  if (/^\d+$/.test(t)) return Number(t);
  if (UNITS[t] !== undefined) return UNITS[t];
  if (TENS[t] !== undefined) return TENS[t];
  const m = t.match(/^([a-z]+)[- ]([a-z]+)$/);
  if (m && TENS[m[1]] !== undefined && UNITS[m[2]] !== undefined) return TENS[m[1]] + UNITS[m[2]];
  return null;
}

const NUMBER_WORD = '\\d+|' + [...Object.keys(TENS), ...Object.keys(UNITS)]
  .sort((a, b) => b.length - a.length)
  .flatMap((t) => [`${t}-\\w+`, t])
  .join('|');

/** Colors named in a passage, matched case-sensitively on whole words. */
function namedColors(text, colors) {
  const found = [];
  const isWord = (ch) => ch !== undefined && /[A-Za-z0-9]/.test(ch);
  for (const c of colors) {
    const aliases = [c.color];
    const paren = c.color.match(/^([A-Za-z]+)\s*\(([^)]+)\)$/);
    if (paren) aliases.push(paren[2]);
    for (const name of aliases) {
      let at = 0;
      while (at <= text.length) {
        const i = text.indexOf(name, at);
        if (i === -1) break;
        if (!isWord(text[i - 1]) && !isWord(text[i + name.length])) {
          found.push(c);
          at = text.length + 1;
          break;
        }
        at = i + 1;
      }
    }
  }
  return found;
}

async function main() {
  const data = await loadData(join(ROOT, 'fiesta.json'));
  const { currentYear } = data;

  const historyYears = new Set();
  for (const h of data.history) {
    for (const m of String(h.date).matchAll(/\b(?:18|19|20)\d{2}\b/g)) historyYears.add(Number(m[0]));
  }

  const allSkus = new Set(data.colors.filter((c) => c.sku).map((c) => String(c.sku)));
  const runOf = (c) => (c.current ? currentYear : c.endYear) - c.startYear;

  /* --- the auditable four, sanity-checked first ------------------------ */
  const seenSku = new Map();
  for (const c of data.colors) {
    const where = `${c.color} (${c.produced})`;

    if (!c.color || !String(c.color).trim()) fail(where, 'missing color name');
    if (!Number.isInteger(c.startYear)) fail(where, `start year is not a whole number: ${c.prodStart}`);
    if (!c.current && !Number.isInteger(c.endYear)) fail(where, `end year is not a whole number: ${c.prodEnd}`);
    if (!c.current && c.endYear < c.startYear) fail(where, `ends (${c.endYear}) before it starts (${c.startYear})`);
    if (c.startYear > currentYear + 1) fail(where, `starts in ${c.startYear}, further ahead than next year`);

    // `produced` is prose shown to readers next to the numeric fields.
    if (!String(c.produced).includes(String(c.startYear))) {
      fail(where, `"produced" string (${c.produced}) does not contain the start year ${c.startYear}`);
    }
    if (!c.current && !String(c.produced).includes(String(c.endYear))) {
      fail(where, `"produced" string (${c.produced}) does not contain the end year ${c.endYear}`);
    }

    if (c.sku) {
      if (seenSku.has(c.sku)) fail(where, `SKU ${c.sku} is also used by ${seenSku.get(c.sku)}`);
      seenSku.set(c.sku, c.color);
    }
  }

  /* --- prose vs data ---------------------------------------------------- */
  for (const c of data.colors) {
    if (!c.notes.length) continue;
    const text = c.notes.join(' ');
    const where = `${c.color} (${c.produced}) notes`;

    const mentioned = namedColors(text, data.colors).filter((o) => o.slug !== c.slug);

    // Years allowed to appear: this color's own, any named color's, or a year
    // the company timeline actually records.
    const allowedYears = new Set([c.startYear, ...(c.current ? [] : [c.endYear]), ...historyYears]);
    for (const o of mentioned) {
      allowedYears.add(o.startYear);
      if (!o.current) allowedYears.add(o.endYear);
    }
    for (const m of text.matchAll(/\b(?:18|19|20)\d{2}\b/g)) {
      const y = Number(m[0]);
      if (!allowedYears.has(y)) {
        fail(where, `mentions the year ${y}, which is not this color's, any color it names, or a timeline year`);
      }
    }

    /* Dated claims.

       A bare year is checked loosely above, because prose legitimately
       references the timeline. But a year attached to a dating verb -- "arrived
       in 1996", "retired in 1997", "from 1986 to 2014" -- is a claim about a
       specific color's start or end, and it has to match that color's actual
       fields. Without this a corrected end year in fiesta.json leaves the prose
       quietly asserting the old one.

       The year may belong to a color the note names rather than to this one,
       so both are accepted for the matching role. */
    const startYears = new Set([c.startYear, ...mentioned.map((o) => o.startYear)]);
    const endYears = new Set([
      ...(c.current ? [] : [c.endYear]),
      ...mentioned.filter((o) => !o.current).map((o) => o.endYear),
    ]);

    const ARRIVED = /\b(?:arrived|introduced|launched|debuted|appeared|came in|first appeared)\b[^.;]{0,40}?\b((?:18|19|20)\d{2})\b/gi;
    const LEFT = /\b(?:retired|gone|discontinued|withdrawn|ended|dropped|off the shelf)\b[^.;]{0,40}?\b((?:18|19|20)\d{2})\b/gi;

    /* "Fiesta was retired in 1973" is about the line, not about a color.
       Look back from the verb: if the subject is the company or the line
       rather than a glaze, the timeline governs, not this color's fields. */
    const aboutTheLine = (at) =>
      /(?:Fiesta|the line|the company|production)[^.;]{0,24}$/i.test(
        text.slice(Math.max(0, at - 60), at)
      );

    for (const m of text.matchAll(ARRIVED)) {
      const y = Number(m[1]);
      if (aboutTheLine(m.index)) continue;
      if (!startYears.has(y)) {
        fail(
          where,
          `says something arrived in ${y}, but that is not the start year of ${c.color} ` +
            `(${c.startYear}) or of any color it names`
        );
      }
    }
    for (const m of text.matchAll(LEFT)) {
      const y = Number(m[1]);
      if (aboutTheLine(m.index)) continue;
      // A retirement year is also the arrival year of whatever replaced it.
      if (!endYears.has(y) && !startYears.has(y)) {
        fail(
          where,
          `says something was retired in ${y}, but that is not the end year of ${c.color} ` +
            `(${c.current ? 'still in production' : c.endYear}) or of any color it names`
        );
      }
    }

    // Explicit ranges: "from 1986 to 2014", "1996 to 1997".
    for (const m of text.matchAll(/\b((?:18|19|20)\d{2})\s*(?:to|–|—|-)\s*((?:18|19|20)\d{2})\b/g)) {
      const [from, to] = [Number(m[1]), Number(m[2])];
      const pairs = [c, ...mentioned]
        .filter((o) => !o.current)
        .map((o) => `${o.startYear}-${o.endYear}`);
      if (!pairs.includes(`${from}-${to}`)) {
        fail(where, `states the range ${from}–${to}, which matches no color it names`);
      }
    }

    // Color numbers.
    for (const m of text.matchAll(/No\.\s*(\d+)/gi)) {
      const sku = m[1];
      const ownedByNamed = mentioned.some((o) => String(o.sku) === sku);
      if (String(c.sku) !== sku && !ownedByNamed) {
        fail(
          where,
          allSkus.has(sku)
            ? `cites No. ${sku}, which belongs to another color it does not name`
            : `cites No. ${sku}, which is not a Fiesta color number`
        );
      }
    }

    /* Durations.

       Two different rules, because the two cases fail differently.

       For a color still in production, ANY number of years equal to its
       current run is a time bomb -- "forty years and counting", "thirty-eight
       years on this run alone". Correct today, wrong every January after.
       Nothing else about a current color's run is safe to state, so the check
       is deliberately broad.

       For a retired color the run is fixed forever, so only phrasings that
       actually assert a run are checked. Prose is full of other legitimate
       spans -- the sixteen-year gap in Red's history, the five years Tangerine
       overlapped Persimmon, the ninety years the line has existed -- and
       flagging those would teach the reader to ignore this report. */

    if (c.current) {
      const run = runOf(c);
      for (const m of text.matchAll(new RegExp(`\\b(${NUMBER_WORD})[- ]years?\\b`, 'gi'))) {
        if (wordToNumber(m[1]) !== run) continue;
        fail(
          where,
          `says "${m[0].trim()}" about a color still in production. ${c.color} has run ` +
            `${run} years as of ${currentYear}, so this sentence is wrong next January. ` +
            `Say "since ${c.startYear}" instead.`
        );
      }
    } else {
      const RUN_PATTERNS = [
        new RegExp(`\\bran (?:for )?(${NUMBER_WORD})[- ]years?\\b`, 'gi'),
        new RegExp(`\\b(${NUMBER_WORD})[- ]year run\\b`, 'gi'),
        new RegExp(`\\bin production (?:for )?(${NUMBER_WORD})[- ]years?\\b`, 'gi'),
        new RegExp(`\\blasted (?:only )?(${NUMBER_WORD})[- ]years?\\b`, 'gi'),
        new RegExp(`\\b(${NUMBER_WORD})[- ]years? on the shelf\\b`, 'gi'),
      ];
      for (const pattern of RUN_PATTERNS) {
        for (const m of text.matchAll(pattern)) {
          const n = wordToNumber(m[1]);
          if (n === null) continue;
          const runs = new Set([runOf(c), ...mentioned.filter((o) => !o.current).map(runOf)]);
          if (!runs.has(n)) {
            fail(
              where,
              `states a ${n}-year run ("${m[0].trim()}") but ${c.color} ran ${runOf(c)} years`
            );
          }
        }
      }
    }

    // Superlatives have to be true, and true uniquely.
    const holder = (pick) => [...data.colors].sort(pick)[0];
    const claims = [
      [/\bnewest\b|\bnew(?:est)? color in the line\b/i, holder((a, b) => b.startYear - a.startYear), 'newest color'],
      [/longest[- ]running|longest run\b/i, holder((a, b) => runOf(b) - runOf(a)), 'longest run'],
      [/most saturated/i, holder((a, b) => b.derived.lch.c - a.derived.lch.c), 'most saturated'],
      [/darkest glaze|darkest color/i, holder((a, b) => a.derived.lab.l - b.derived.lab.l), 'darkest'],
      [/lightest glaze|lightest color/i, holder((a, b) => b.derived.lab.l - a.derived.lab.l), 'lightest'],
    ];
    for (const [pattern, actual, label] of claims) {
      const hit = text.match(pattern);
      if (!hit) continue;
      // "one of the most saturated" does not claim the title.
      const before = text.slice(Math.max(0, hit.index - 22), hit.index).toLowerCase();
      if (/one of the\s*$|among the\s*$/.test(before)) continue;
      // The claim may be about a color this note names rather than itself.
      if (actual.slug !== c.slug && !mentioned.some((o) => o.slug === actual.slug)) {
        fail(where, `claims "${label}" but that is ${actual.color}, which this note does not name`);
      }
    }
  }

  /* --- shade notes ------------------------------------------------------- */
  for (const [shade, note] of Object.entries(data.shadeNotes || {})) {
    const where = `shadeNotes.${shade}`;
    if (!data.shades.includes(shade)) {
      fail(where, `no color in fiesta.json has shadeOf "${shade}"`);
      continue;
    }
    const family = data.colors.filter((c) => c.shadeOf === shade);
    const mentioned = namedColors(note, data.colors);

    const allowed = new Set(historyYears);
    for (const o of [...family, ...mentioned]) {
      allowed.add(o.startYear);
      if (!o.current) allowed.add(o.endYear);
    }
    for (const m of note.matchAll(/\b(?:18|19|20)\d{2}\b/g)) {
      if (!allowed.has(Number(m[0]))) fail(where, `mentions the year ${m[0]}, which belongs to no color it names`);
    }

    // A stated family size must match the data.
    // "Post 86 colors" names a product line; the 86 is not a count.
    const familyCountPattern = new RegExp(
      `(?<!Post )\\b(${NUMBER_WORD})\\s+(?:of them|colors?|glazes?)\\b`,
      'gi'
    );
    for (const m of note.matchAll(familyCountPattern)) {
      const n = wordToNumber(m[1]);
      if (n !== null && n !== family.length && n !== family.filter((c) => c.current).length) {
        fail(where, `says "${m[0]}" but the ${shade} family has ${family.length} colors, ${family.filter((c) => c.current).length} current`);
      }
    }
  }

  /* --- report ------------------------------------------------------------ */
  for (const w of warnings) console.log(`  warn   ${w}`);
  if (warnings.length) console.log('');
  for (const e of errors) console.log(`  ERROR  ${e}`);

  console.log(
    `\n${errors.length} contradiction${errors.length === 1 ? '' : 's'}, ` +
      `${warnings.length} warning${warnings.length === 1 ? '' : 's'} ` +
      `across ${data.colors.length} colors and ${Object.keys(data.shadeNotes || {}).length} shade notes`
  );
  if (errors.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
