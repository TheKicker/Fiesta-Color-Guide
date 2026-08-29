/**
 * Turns fiesta.json into the model the templates render.
 *
 * Rules of the house:
 *  - fiesta.json is the only source of colour facts. This file derives, sorts
 *    and cross-references; it never edits a hex, a year or a description.
 *  - Anything that is a judgement call (era buckets, "similar" colours) is
 *    computed from the data with a stated rule, so it can be checked.
 */
import { readFile } from 'node:fs/promises';
import { describe, rgbToLab, hexToRgb, deltaE2000, normalizeHex } from './color.mjs';

/** Original run ended when the line was retired in January 1973. */
export const VINTAGE_END = 1972;
/** Fiesta was reintroduced for its 50th anniversary in 1986. */
export const POST86_START = 1986;

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[()']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Colour names repeat across the two eras (there are two Reds, two Roses,
 * two Chartreuses). Disambiguate with the first year of production so every
 * URL is stable and self-explanatory.
 */
function assignSlugs(colors) {
  const counts = new Map();
  for (const c of colors) {
    const base = slugify(c.color);
    counts.set(base, (counts.get(base) || 0) + 1);
  }
  return colors.map((c) => {
    const base = slugify(c.color);
    return { ...c, slug: counts.get(base) > 1 ? `${base}-${c.prodStart}` : base };
  });
}

export function endYear(color, currentYear) {
  return color.prodEnd === 'current' ? currentYear : Number(color.prodEnd);
}

export function isCurrent(color) {
  return color.prodEnd === 'current';
}

/** "vintage" = the original 1936-1972 run. "post86" = the 1986 reintroduction on. */
export function eraOf(color) {
  if (Number(color.prodStart) >= POST86_START) return 'post86';
  if (endYear(color, new Date().getFullYear()) <= VINTAGE_END) return 'vintage';
  return 'post86';
}

/** Every decade the colour was in production for at least part of, e.g. [1990, 2000]. */
export function decadesActive(color, currentYear) {
  const start = Number(color.prodStart);
  const end = endYear(color, currentYear);
  const out = [];
  for (let d = Math.floor(start / 10) * 10; d <= Math.floor(end / 10) * 10; d += 10) {
    out.push(d);
  }
  return out;
}

/** True when both colours were on the shelf together for at least one year. */
export function overlaps(a, b, currentYear) {
  return (
    Number(a.prodStart) <= endYear(b, currentYear) &&
    endYear(a, currentYear) >= Number(b.prodStart)
  );
}

export function yearsInProduction(color, currentYear) {
  const span = endYear(color, currentYear) - Number(color.prodStart);
  return Math.max(1, span);
}

export async function loadData(jsonPath, { currentYear = new Date().getFullYear() } = {}) {
  const raw = JSON.parse(await readFile(jsonPath, 'utf8'));

  const colors = assignSlugs(raw.colors).map((c) => {
    const hex = normalizeHex(c.hex);
    return {
      ...c,
      hex,
      // `sku` is "N/A" for every vintage colour -- those pre-date the modern
      // numbering, so treat the absence as a fact rather than a hole.
      sku: c.sku && c.sku !== 'N/A' ? String(c.sku) : null,
      color: c.color,
      derived: describe(hex),
      lab: rgbToLab(hexToRgb(hex)),
      era: eraOf(c),
      current: isCurrent(c),
      endYear: endYear(c, currentYear),
      startYear: Number(c.prodStart),
      decades: decadesActive(c, currentYear),
      years: yearsInProduction(c, currentYear),
    };
  });

  // Chronological, then alphabetical -- the order the ribbon and timeline use.
  const timeline = [...colors].sort(
    (a, b) => a.startYear - b.startYear || a.color.localeCompare(b.color)
  );
  timeline.forEach((c, i) => {
    c.timelineIndex = i;
    c.prev = timeline[i - 1] || null;
    c.next = timeline[i + 1] || null;
  });

  // Cross-references, computed once so pages stay cheap to render.
  for (const c of colors) {
    c.similar = colors
      .filter((o) => o.slug !== c.slug)
      .map((o) => ({ color: o, delta: deltaE2000(c.lab, o.lab) }))
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 6);

    c.contemporaries = timeline.filter(
      (o) => o.slug !== c.slug && overlaps(c, o, currentYear)
    );
  }

  const firstYear = Math.min(...colors.map((c) => c.startYear));

  /**
   * Era labels are built here, from the same two constants that classify a
   * color and from the first year actually present in the data. A label can
   * therefore never claim one boundary while the sorting uses another.
   */
  const eras = {
    vintage: {
      key: 'vintage',
      slug: 'vintage',
      start: firstYear,
      end: VINTAGE_END,
      short: `Vintage ${firstYear}–${VINTAGE_END}`,
      full: `Vintage (${firstYear}–${VINTAGE_END})`,
    },
    post86: {
      key: 'post86',
      slug: 'post-86',
      start: POST86_START,
      short: `Post 86, ${POST86_START}–today`,
      full: `Post 86 (${POST86_START}–today)`,
    },
  };

  const decades = [
    ...new Set(colors.flatMap((c) => c.decades)),
  ].sort((a, b) => a - b);

  const shades = [
    ...new Set(colors.map((c) => c.shadeOf)),
  ].sort((a, b) => a.localeCompare(b));

  return {
    company: raw,
    colors,
    timeline,
    current: timeline.filter((c) => c.current),
    retired: timeline.filter((c) => !c.current),
    vintage: timeline.filter((c) => c.era === 'vintage'),
    post86: timeline.filter((c) => c.era === 'post86'),
    history: raw.history || [],
    products: raw.products || [],
    decades,
    shades,
    currentYear,
    firstYear,
    eras,
  };
}
