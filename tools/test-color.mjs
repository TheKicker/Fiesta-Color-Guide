#!/usr/bin/env node
/**
 * Tests for the colour maths, plus a data-integrity pass over fiesta.json.
 *
 *   node tools/test-color.mjs
 *
 * The whole site claims that every value on a colour page is derived correctly
 * from that colour's hex. These are the assertions behind that claim.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadData } from '../src/lib/data.mjs';
import { buildPalettes, isNeutral, hueDistance } from '../src/lib/palettes.mjs';
import {
  normalizeHex,
  hexToRgb,
  rgbToHsl,
  rgbToHsv,
  rgbToLab,
  contrastRatio,
  deltaE2000,
  readableTextOn,
} from '../src/lib/color.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
const failures = [];

function ok(name, condition, detail = '') {
  if (condition) passed++;
  else failures.push(`${name}${detail ? ` -- ${detail}` : ''}`);
}

function close(name, actual, expected, tolerance) {
  const delta = Math.abs(actual - expected);
  ok(name, delta <= tolerance, `got ${actual.toFixed(4)}, expected ${expected} (±${tolerance})`);
}

/* --- parsing -------------------------------------------------------------- */

ok('normalizeHex uppercases', normalizeHex('#Cf2C20') === '#CF2C20');
ok('normalizeHex expands shorthand', normalizeHex('abc') === '#AABBCC');
ok('normalizeHex accepts bare hex', normalizeHex('D2042D') === '#D2042D');
ok(
  'normalizeHex rejects garbage',
  (() => {
    try {
      normalizeHex('#12345');
      return false;
    } catch {
      return true;
    }
  })()
);

ok('hexToRgb', JSON.stringify(hexToRgb('#2B64A1')) === JSON.stringify({ r: 43, g: 100, b: 161 }));

/* --- HSL / HSV ------------------------------------------------------------ */

const red = hexToRgb('#FF0000');
close('pure red hue (HSL)', rgbToHsl(red).h, 0, 0.001);
close('pure red saturation (HSL)', rgbToHsl(red).s, 100, 0.001);
close('pure red lightness (HSL)', rgbToHsl(red).l, 50, 0.001);
close('pure red value (HSV)', rgbToHsv(red).v, 100, 0.001);

const grey = hexToRgb('#808080');
close('grey has no saturation', rgbToHsl(grey).s, 0, 0.001);

/* --- CIELAB --------------------------------------------------------------- */
/* Reference values for sRGB/D65. */

const white = rgbToLab(hexToRgb('#FFFFFF'));
close('white L*', white.l, 100, 0.01);
close('white a*', white.a, 0, 0.01);
close('white b*', white.b, 0, 0.01);

const black = rgbToLab(hexToRgb('#000000'));
close('black L*', black.l, 0, 0.01);

const labRed = rgbToLab(hexToRgb('#FF0000'));
close('sRGB red L*', labRed.l, 53.2408, 0.01);
close('sRGB red a*', labRed.a, 80.0925, 0.01);
close('sRGB red b*', labRed.b, 67.2032, 0.01);

close('mid grey L*', rgbToLab(hexToRgb('#808080')).l, 53.5851, 0.01);

/* --- WCAG contrast -------------------------------------------------------- */

close('black on white is 21:1', contrastRatio('#000000', '#FFFFFF'), 21, 0.001);
close('identical colors are 1:1', contrastRatio('#2B64A1', '#2B64A1'), 1, 0.001);
// #767676 is the canonical smallest grey that still passes AA on white.
close('#767676 on white', contrastRatio('#767676', '#FFFFFF'), 4.54, 0.01);
ok('contrast is symmetric', contrastRatio('#FF0000', '#FFF') === contrastRatio('#FFF', '#FF0000'));

ok('readable text on white is black', readableTextOn('#FFFFFF').color === '#000000');
ok('readable text on black is white', readableTextOn('#000000').color === '#FFFFFF');

/* --- CIEDE2000 ------------------------------------------------------------ */
/* Pairs from Sharma, Wu & Dalal (2005), the reference implementation set. */

const sharma = [
  [[50.0, 2.6772, -79.7751], [50.0, 0.0, -82.7485], 2.0425],
  [[50.0, 3.1571, -77.2803], [50.0, 0.0, -82.7485], 2.8615],
  [[50.0, 2.8361, -74.02], [50.0, 0.0, -82.7485], 3.4412],
  [[50.0, -1.3802, -84.2814], [50.0, 0.0, -82.7485], 1.0],
  [[50.0, 2.49, -0.001], [50.0, -2.49, 0.0009], 7.1792],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.2630],
  [[35.0831, -44.1164, 3.7933], [35.0232, -40.0716, 1.5901], 1.8645],
  [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
];

sharma.forEach(([a, b, expected], i) => {
  const lab = (v) => ({ l: v[0], a: v[1], b: v[2] });
  close(`CIEDE2000 Sharma pair ${i + 1}`, deltaE2000(lab(a), lab(b)), expected, 0.0002);
});

ok('deltaE of a color with itself is 0', deltaE2000(labRed, labRed) < 1e-9);

/* --- fiesta.json integrity ------------------------------------------------ */

const data = JSON.parse(await readFile(join(ROOT, 'fiesta.json'), 'utf8'));
const currentYear = new Date().getFullYear();

ok('fiesta.json has colors', Array.isArray(data.colors) && data.colors.length > 0);

const seen = new Map();
for (const c of data.colors) {
  const label = `${c.color} (${c.prodStart})`;

  ok(`${label} has a parseable hex`, /^#[0-9a-fA-F]{6}$/.test(c.hex), c.hex);
  ok(`${label} has a shade family`, typeof c.shadeOf === 'string' && c.shadeOf.length > 0);
  ok(`${label} has a description`, typeof c.description === 'string' && c.description.length > 40);
  ok(`${label} has an image`, typeof c.image === 'string' && /\.(jpg|jpeg|png)$/i.test(c.image));

  const start = Number(c.prodStart);
  const end = c.prodEnd === 'current' ? currentYear : Number(c.prodEnd);
  ok(`${label} start year is sane`, start >= 1930 && start <= currentYear + 1, String(start));
  // A color announced for next spring starts in a year that has not arrived
  // yet, which is a normal state for this dataset every autumn.
  const effectiveEnd = c.prodEnd === 'current' ? Math.max(currentYear, start) : end;
  ok(`${label} ends on or after it starts`, effectiveEnd >= start, `${start} -> ${effectiveEnd}`);

  // `produced` is prose shown to readers; it must agree with the numeric fields
  // it sits next to, or the page contradicts itself.
  ok(
    `${label} produced string starts with prodStart`,
    String(c.produced).includes(String(start)),
    c.produced
  );

  const key = `${c.color}|${start}`;
  ok(`${label} is not a duplicate entry`, !seen.has(key));
  seen.set(key, true);
}

/* fiesta.json also carries a hand-written `hsv` string. The site never renders
   it -- HSV is computed from the hex -- but a drift between the two means one
   of them was edited alone, which is worth knowing about. */
const notes = [];
for (const c of data.colors) {
  const stored = String(c.hsv || '');
  const m = stored.match(/hsv\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
  if (!m) continue;
  const computed = rgbToHsv(hexToRgb(c.hex));
  const drift = Math.max(
    Math.abs(Number(m[1]) - computed.h),
    Math.abs(Number(m[2]) - computed.s),
    Math.abs(Number(m[3]) - computed.v)
  );
  if (drift > 1) {
    notes.push(
      `${c.color}: stored hsv ${stored} vs computed hsv(${computed.h.toFixed(2)}, ` +
        `${computed.s.toFixed(1)}%, ${computed.v.toFixed(2)}%) -- the site shows the computed value`
    );
  }
}

/* --- palette combinations -------------------------------------------------
   These are recommendations shown to readers, so the invariants matter: only
   real Fiesta colors, never a near-duplicate pair, and always anchored on the
   color whose page it appears on. */

const model = await loadData(join(ROOT, 'fiesta.json'));
const bySlug = new Map(model.colors.map((c) => [c.slug, c]));

let thinnest = Infinity;

for (const color of model.colors) {
  const palettes = buildPalettes(color, model.colors);
  thinnest = Math.min(thinnest, palettes.length);

  ok(`${color.color}: has at least 3 combinations`, palettes.length >= 3, String(palettes.length));
  ok(`${color.color}: no more than 5 combinations`, palettes.length <= 5, String(palettes.length));

  const seen = new Set();
  for (const palette of palettes) {
    ok(`${color.color}/${palette.id}: states a rule`, Boolean(palette.why && palette.why.length > 20));
    ok(
      `${color.color}/${palette.id}: includes the color itself`,
      palette.colors.some((c) => c.slug === color.slug)
    );
    ok(
      `${color.color}/${palette.id}: 3-5 colors`,
      palette.colors.length >= 3 && palette.colors.length <= 5,
      String(palette.colors.length)
    );

    const slugs = palette.colors.map((c) => c.slug);
    ok(`${color.color}/${palette.id}: no repeats`, new Set(slugs).size === slugs.length);
    ok(
      `${color.color}/${palette.id}: only real Fiesta colors`,
      slugs.every((s) => bySlug.has(s))
    );

    // Two glazes closer than this look like a mistake sitting next to each other.
    let closest = Infinity;
    for (let i = 0; i < palette.colors.length; i++) {
      for (let j = i + 1; j < palette.colors.length; j++) {
        closest = Math.min(closest, deltaE2000(palette.colors[i].lab, palette.colors[j].lab));
      }
    }
    ok(
      `${color.color}/${palette.id}: no near-identical pair`,
      closest >= 12,
      `closest pair is deltaE ${closest.toFixed(1)}`
    );

    // Sorted light to dark for the strip.
    const lightnesses = palette.colors.map((c) => c.derived.hsl.l);
    ok(
      `${color.color}/${palette.id}: ordered light to dark`,
      lightnesses.every((l, i) => i === 0 || lightnesses[i - 1] >= l)
    );

    ok(`${color.color}: ${palette.id} appears once`, !seen.has(palette.id));
    seen.add(palette.id);
  }
}

ok('every color gets at least 3 combinations', thinnest >= 3, `thinnest was ${thinnest}`);

// Neutrality drives which recipes run, so pin the classification down.
for (const [slug, expected] of [
  ['white', true],
  ['black', true],
  ['foundry', true],
  ['old-ivory', true],
  ['linen', true],
  ['gray', true],
  ['scarlet', false],
  ['lapis', false],
  ['evergreen', false],
  ['sky', false],
]) {
  const c = bySlug.get(slug);
  ok(`${slug} neutrality is ${expected}`, c && isNeutral(c) === expected);
}

ok('hue distance wraps around 360', hueDistance(350, 10) === 20);
ok('hue distance is symmetric', hueDistance(10, 350) === hueDistance(350, 10));
ok('hue distance caps at 180', hueDistance(0, 180) === 180);

/* --- report --------------------------------------------------------------- */

if (notes.length) {
  console.log('Notes:');
  for (const note of notes) console.log(`  note   ${note}`);
  console.log('');
}

for (const f of failures) console.log(`  FAIL   ${f}`);

console.log(`\n${passed} assertions passed, ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
