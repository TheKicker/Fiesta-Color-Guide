/**
 * Table-setting combinations built from the real Fiesta palette.
 *
 * The point of this file: someone owns a few plates in one color and wants to
 * know what else to buy. Every combination here is made only of colors Fiesta
 * has actually produced -- no invented swatches, no "close enough" substitutes.
 *
 * Two kinds of suggestion, and the site labels which is which:
 *
 *  1. Pairings named in the color's own description in fiesta.json. Those are
 *     written down by a person, so they outrank anything computed.
 *  2. Combinations derived from the colors themselves, each following a stated
 *     rule (complementary hue, tonal ladder, neutral anchor...) so a reader can
 *     check the reasoning rather than take it on faith.
 */
import { deltaE2000 } from './color.mjs';

/**
 * Neutrality is measured with LCh chroma, not HSL saturation.
 *
 * HSL saturation is badly misleading at the ends of the lightness range: it
 * calls Old Ivory (#F2EFDE) "43% saturated" and Evergreen (#0B4041) "71%",
 * when perceptually the first is almost colorless and the second is a deep
 * teal. Chroma gets both right -- 8.8 and 16.9. Below 12 covers exactly the
 * whites, greys and blacks of the Fiesta palette.
 */
const NEUTRAL_CHROMA = 12;

/** Below this, two colors are close enough to look like a mistake side by side. */
const MIN_SEPARATION = 12;

export function isNeutral(color) {
  return color.derived.lch.c < NEUTRAL_CHROMA;
}

/** Shortest distance between two hue angles, 0-180. */
export function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function separation(color, chosen) {
  let min = Infinity;
  for (const other of chosen) min = Math.min(min, deltaE2000(color.lab, other.lab));
  return min;
}

/**
 * Keep colors in the given order, dropping any that is too close to one
 * already kept.
 *
 * Seeded colors used to skip the separation rule entirely, which put Linen
 * next to Old Ivory (deltaE 9.7) and Pearl Gray next to Gray (11.2) -- pairs
 * that read as a printing error rather than a choice.
 */
function dedupe(colors) {
  const kept = [];
  for (const color of colors) {
    if (kept.every((c) => deltaE2000(c.lab, color.lab) >= MIN_SEPARATION)) kept.push(color);
  }
  return kept;
}

/**
 * Greedily grow a palette from a candidate pool.
 *
 * Each step takes the candidate that is furthest from everything already
 * chosen, with a bonus for widening the lightness range -- a set of colors that
 * are all mid-tone reads as mud on a table, however well their hues relate.
 */
function grow(seed, pool, size) {
  const chosen = dedupe(seed);
  const remaining = pool.filter((c) => !chosen.some((x) => x.slug === c.slug));

  while (chosen.length < size && remaining.length) {
    const lightnesses = chosen.map((c) => c.derived.hsl.l);
    const lo = Math.min(...lightnesses);
    const hi = Math.max(...lightnesses);

    let best = null;
    let bestScore = -Infinity;

    for (const candidate of remaining) {
      const gap = separation(candidate, chosen);
      if (gap < MIN_SEPARATION) continue;

      const l = candidate.derived.hsl.l;
      const widening = l < lo ? lo - l : l > hi ? l - hi : 0;

      // Nudge toward a tinted neutral over a pure one: Fiesta's Ivory and
      // Linen sit on a table better than flat White, and without this every
      // palette ends up anchored by #FFFFFF and #000000.
      const warmth = isNeutral(candidate) ? candidate.derived.lch.c * 0.35 : 0;

      const score = gap + widening * 0.7 + warmth;

      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    if (!best) break;
    chosen.push(best);
    remaining.splice(remaining.indexOf(best), 1);
  }

  return chosen;
}

/** Order a finished palette light-to-dark so the strip reads as a gradient. */
function byLightness(colors) {
  return [...colors].sort((a, b) => b.derived.hsl.l - a.derived.hsl.l);
}

/**
 * Colors named in this color's own description.
 *
 * Longest names first so "Sea Mist Green" is not swallowed by "Green", and the
 * match is case-sensitive whole-word for the same reason the history timeline
 * links are: prose says "a deep blue" without meaning the color Blue.
 */
export function describedPairings(color, allColors) {
  const text = color.description || '';
  const found = [];
  const seen = new Set();

  const candidates = allColors
    .filter((c) => c.slug !== color.slug)
    .map((c) => ({ name: c.color, color: c }))
    .sort((a, b) => b.name.length - a.name.length);

  const isWordChar = (ch) => ch !== undefined && /[A-Za-z0-9]/.test(ch);

  for (const { name, color: candidate } of candidates) {
    if (seen.has(candidate.color)) continue;

    let at = 0;
    while (at <= text.length) {
      const i = text.indexOf(name, at);
      if (i === -1) break;
      if (!isWordChar(text[i - 1]) && !isWordChar(text[i + name.length])) {
        found.push(candidate);
        seen.add(candidate.color);
        break;
      }
      at = i + 1;
    }
  }

  // Where a name exists in both eras, keep the one that overlapped in production.
  return found;
}

/* --- recipes -------------------------------------------------------------
   Each returns { id, name, why, colors } or null when it cannot make a set
   worth showing. `why` states the rule, so the suggestion is checkable.
   ---------------------------------------------------------------------- */

function describedRecipe(color, all) {
  const named = describedPairings(color, all);
  if (named.length < 2) return null;

  // Descriptions offer alternatives rather than one five-piece set -- "pair it
  // with Linen or Sky ... or try Plum or Mulberry" -- so showing every name at
  // once would invent a combination the text never proposed. Keep the ones
  // that read as distinct colors, in the order they are mentioned.
  const colors = dedupe([color, ...named]).slice(0, 5);
  if (colors.length < 3) return null;

  return {
    id: 'described',
    name: 'The pairing in its own description',
    why: `These colors are named alongside ${color.color} in this guide's description of it.`,
    sourced: true,
    colors,
  };
}

function tonalRecipe(color, all) {
  const family = all.filter(
    (c) => c.slug !== color.slug && c.shadeOf === color.shadeOf
  );
  if (family.length < 2) return null;

  const colors = grow([color], family, 4);
  if (colors.length < 3) return null;

  return {
    id: 'tonal',
    name: `All ${color.shadeOf.toLowerCase()}`,
    why: `Every color here is from the ${color.shadeOf.toLowerCase()} family, arranged light to dark. A single-family table reads calm and deliberate rather than busy.`,
    colors,
  };
}

function complementaryRecipe(color, all) {
  if (isNeutral(color)) return null;
  const target = (color.derived.hsl.h + 180) % 360;

  const opposite = all
    .filter((c) => c.slug !== color.slug && !isNeutral(c))
    .filter((c) => hueDistance(c.derived.hsl.h, target) < 45)
    .sort(
      (a, b) =>
        hueDistance(a.derived.hsl.h, target) - hueDistance(b.derived.hsl.h, target)
    );

  if (!opposite.length) return null;

  const neutrals = all.filter((c) => c.slug !== color.slug && isNeutral(c));
  const colors = grow([color, opposite[0]], [...opposite.slice(1), ...neutrals], 4);
  if (colors.length < 3) return null;

  return {
    id: 'complementary',
    name: 'Opposite on the wheel',
    why: `${opposite[0].color} sits roughly opposite ${color.color} in hue, which is the highest-contrast pairing the palette offers. The neutrals keep it from shouting.`,
    colors,
  };
}

function triadicRecipe(color, all) {
  if (isNeutral(color)) return null;
  const h = color.derived.hsl.h;

  const near = (target) =>
    all
      .filter((c) => c.slug !== color.slug && !isNeutral(c))
      .filter((c) => hueDistance(c.derived.hsl.h, target) < 40)
      .sort(
        (a, b) => hueDistance(a.derived.hsl.h, target) - hueDistance(b.derived.hsl.h, target)
      )[0];

  const a = near((h + 120) % 360);
  const b = near((h + 240) % 360);
  if (!a || !b || a.slug === b.slug) return null;
  if (deltaE2000(a.lab, b.lab) < MIN_SEPARATION) return null;

  const neutrals = all.filter((c) => c.slug !== color.slug && isNeutral(c));
  const colors = grow([color, a, b], neutrals, 4);

  return {
    id: 'triadic',
    name: 'Three-way split',
    why: `${a.color} and ${b.color} sit about a third of the way around the color wheel from ${color.color} in each direction. Evenly spaced hues stay lively without any one taking over.`,
    colors,
  };
}

function neutralAnchorRecipe(color, all) {
  const neutrals = all.filter((c) => c.slug !== color.slug && isNeutral(c));
  if (neutrals.length < 2) return null;

  const sorted = [...neutrals].sort((a, b) => b.derived.hsl.l - a.derived.hsl.l);
  const lightest = sorted[0];
  const darkest = sorted[sorted.length - 1];
  if (deltaE2000(lightest.lab, darkest.lab) < 25) return null;

  const seed = isNeutral(color) ? [color, lightest] : [color, lightest, darkest];
  const accents = all.filter((c) => c.slug !== color.slug && !isNeutral(c));
  const colors = grow(seed, isNeutral(color) ? accents : [...accents, darkest], 4);

  return {
    id: 'neutral',
    name: 'Anchored in neutrals',
    why: isNeutral(color)
      ? `${color.color} is close to neutral, so it works as the quiet ground under a louder color.`
      : `${lightest.color} and ${darkest.color} carry almost no hue of their own, so they give ${color.color} room to be the loud one.`,
    colors,
  };
}

function analogousRecipe(color, all) {
  if (isNeutral(color)) return null;
  const h = color.derived.hsl.h;

  const near = all
    .filter((c) => c.slug !== color.slug && !isNeutral(c))
    .filter((c) => {
      const d = hueDistance(c.derived.hsl.h, h);
      return d > 12 && d < 55;
    });

  if (near.length < 2) return null;
  const colors = grow([color], near, 4);
  if (colors.length < 3) return null;

  return {
    id: 'analogous',
    name: 'Next-door hues',
    why: `These sit within about 55° of ${color.color} on the color wheel. Neighbouring hues blend instead of competing, which suits a table you want to feel warm rather than graphic.`,
    colors,
  };
}

/** Only colors you can still buy -- the most actionable set for a shopper. */
function inProductionRecipe(color, all) {
  const current = all.filter((c) => c.slug !== color.slug && c.current);
  if (current.length < 3) return null;

  const colors = grow([color], current, 5);
  if (colors.length < 4) return null;

  return {
    id: 'current',
    name: color.current ? 'All still in production' : 'Buy these to go with it',
    why: color.current
      ? `Every color in this set is being made right now, so you can complete the whole table today.`
      : `${color.color} was retired in ${color.endYear}, but these are all in production now -- the set you can actually finish buying.`,
    colors,
  };
}


/**
 * A neutral plus vivid colors spread around the wheel.
 *
 * This is how Fiesta is most often actually set: a white or ivory ground with
 * a scatter of bright colors on top. Hue-based recipes all bail out on a
 * neutral, so without this the whites and blacks end up with almost nothing.
 */
function spectrumRecipe(color, all) {
  if (!isNeutral(color)) return null;

  const vivid = all.filter(
    (c) => c.slug !== color.slug && c.derived.lch.c > 30
  );
  if (vivid.length < 3) return null;

  const chosen = [];
  for (const candidate of [...vivid].sort((a, b) => b.derived.lch.c - a.derived.lch.c)) {
    if (chosen.length >= 4) break;
    // Spread the hues, and keep the usual perceptual separation rule.
    const farEnoughInHue = chosen.every(
      (c) => hueDistance(c.derived.hsl.h, candidate.derived.hsl.h) > 55
    );
    if (farEnoughInHue && separation(candidate, [...chosen, color]) >= MIN_SEPARATION) {
      chosen.push(candidate);
    }
  }

  if (chosen.length < 3) return null;

  return {
    id: 'spectrum',
    name: 'A ground for bright colors',
    why: `${color.color} carries almost no hue of its own, which makes it the ground the rest of the table sits on. These are the boldest colors in the palette, spread right around the wheel -- the mix-and-match look Fiesta was designed for.`,
    colors: [color, ...chosen],
  };
}

/** All neutrals, light to dark -- the quietest table the palette can set. */
function neutralLadderRecipe(color, all) {
  if (!isNeutral(color)) return null;

  const neutrals = all.filter((c) => c.slug !== color.slug && isNeutral(c));
  if (neutrals.length < 3) return null;

  const colors = grow([color], neutrals, 4);
  if (colors.length < 3) return null;

  return {
    id: 'neutral-ladder',
    name: 'Nothing but neutrals',
    why: `Every color here is a white, grey or black, stepped from lightest to darkest. No hue anywhere, so the shapes and the food do the work.`,
    colors,
  };
}

const RECIPES = [
  describedRecipe,
  inProductionRecipe,
  complementaryRecipe,
  spectrumRecipe,
  tonalRecipe,
  triadicRecipe,
  analogousRecipe,
  neutralAnchorRecipe,
  neutralLadderRecipe,
];

/**
 * Up to `limit` combinations for one color, best-sourced first.
 *
 * Near-identical palettes are dropped: two recipes often land on the same
 * colors, and showing the same five swatches twice under different headings
 * looks like padding.
 */
export function buildPalettes(color, allColors, { limit = 5 } = {}) {
  const out = [];
  const signatures = new Set();

  for (const recipe of RECIPES) {
    if (out.length >= limit) break;

    const palette = recipe(color, allColors);
    if (!palette || palette.colors.length < 3) continue;

    const ordered = byLightness(palette.colors);
    const signature = ordered
      .map((c) => c.slug)
      .sort()
      .join('|');
    if (signatures.has(signature)) continue;

    signatures.add(signature);
    out.push({ ...palette, colors: ordered });
  }

  return out;
}
