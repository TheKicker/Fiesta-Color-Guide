/**
 * Where a colour sits in the line: what it followed, what it displaced, how
 * long it lasted, what else the company did that year.
 *
 * The test every sentence here has to pass is "would a collector who owns this
 * piece not already know it, and is it true of this colour and no other?"
 * Anything that would read the same on all 61 pages does not belong -- the
 * point is to add reference value, not word count.
 *
 * Two deliberate limits:
 *
 *  - Superlatives are only stated when the colour actually holds one. Nobody
 *    needs to read that a glaze is the 34th most saturated.
 *  - None of this counts toward the original-writing threshold in
 *    site.config.json. It is derived text, and quietly letting it lift pages
 *    over a quality bar would defeat the purpose of having the bar.
 */
import { deltaE2000 } from './color.mjs';

/** The most recent colour of the same shade family introduced before this one. */
export function predecessor(color, timeline) {
  return (
    timeline
      .filter((o) => o.shadeOf === color.shadeOf && o.startYear < color.startYear)
      .pop() || null
  );
}

/**
 * Plain-English account of how two glazes differ, from their Lab coordinates.
 *
 * Thresholds are set so a small difference is not dressed up as a big one:
 * below them the axis simply is not mentioned.
 */
export function differenceFrom(color, other) {
  const dL = color.derived.lab.l - other.derived.lab.l;
  const dC = color.derived.lch.c - other.derived.lch.c;
  const delta = deltaE2000(color.lab, other.lab);

  const parts = [];
  if (Math.abs(dL) >= 8) parts.push(dL > 0 ? 'lighter' : 'darker');
  if (Math.abs(dC) >= 10) parts.push(dC > 0 ? 'more vivid' : 'more muted');

  let phrase;
  if (!parts.length) phrase = 'a similar weight';
  else if (parts.length === 1) phrase = `noticeably ${parts[0]}`;
  else phrase = `${parts[0]} and ${parts[1]}`;

  // How far apart they read side by side, in the same terms the rest of the
  // site uses for colour distance.
  let separation;
  if (delta < 10) separation = 'a close relative';
  else if (delta < 25) separation = 'a clearly different glaze';
  else separation = 'a complete change of direction';

  return { delta, phrase, separation, lighter: dL > 0, moreVivid: dC > 0 };
}

/**
 * Superlatives this colour genuinely holds, palette-wide.
 * Returns an empty array for most colours, which is the intended behaviour.
 */
export function superlatives(color, colors, currentYear) {
  const out = [];
  const runLength = (c) => (c.current ? currentYear : c.endYear) - c.startYear;

  const extreme = (key, pick) => {
    const sorted = [...colors].sort(pick);
    return sorted[0].slug === color.slug ? sorted[0] : null;
  };

  if (extreme('light', (a, b) => b.derived.lab.l - a.derived.lab.l)) {
    out.push('the lightest glaze Fiesta has made');
  }
  if (extreme('dark', (a, b) => a.derived.lab.l - b.derived.lab.l)) {
    out.push('the darkest glaze Fiesta has made');
  }
  if (extreme('chroma', (a, b) => b.derived.lch.c - a.derived.lch.c)) {
    out.push('the most saturated color in the palette');
  }
  if (extreme('run', (a, b) => runLength(b) - runLength(a))) {
    out.push('the longest-running color in the line');
  }

  // Shortest run is only interesting when it is genuinely brief.
  const shortest = [...colors].sort((a, b) => runLength(a) - runLength(b))[0];
  if (shortest.slug === color.slug && runLength(color) <= 2) {
    out.push('one of the shortest-lived colors in the line');
  }

  return out;
}

/** Median run length for the colour's era, for an honest comparison. */
function medianRun(colors, currentYear) {
  const runs = colors
    .map((c) => (c.current ? currentYear : c.endYear) - c.startYear)
    .sort((a, b) => a - b);
  if (!runs.length) return 0;
  const mid = Math.floor(runs.length / 2);
  return runs.length % 2 ? runs[mid] : Math.round((runs[mid - 1] + runs[mid]) / 2);
}

/** The company-history entry for the year this colour arrived, if there is one. */
export function historyAnchor(color, history) {
  const entry = history.find((h) => String(h.date) === String(color.startYear));
  if (!entry) return null;
  return {
    date: entry.date,
    id: `y-${String(entry.date).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    desc: entry.desc,
  };
}

/**
 * Everything the "in context" section needs, or nulls where the data does not
 * support a claim. Templates render only what is present.
 */
export function buildContext(color, data) {
  const { timeline, currentYear, history } = data;

  const prev = predecessor(color, timeline);
  const peers = color.era === 'vintage' ? data.vintage : data.post86;
  const run = (color.current ? currentYear : color.endYear) - color.startYear;
  const median = medianRun(peers, currentYear);

  // Colours introduced the same year -- Fiesta has occasionally done two.
  const sameYear = timeline.filter(
    (o) => o.slug !== color.slug && o.startYear === color.startYear
  );

  // What retired as this one arrived. A retirement in the same year is the
  // swap a collector actually noticed on the shelf.
  const retiredThatYear = timeline.filter(
    (o) => o.slug !== color.slug && !o.current && o.endYear === color.startYear
  );

  const next = timeline.find((o) => o.startYear > color.startYear) || null;

  const succeeded = prev ? !prev.current && prev.endYear <= color.startYear : false;

  return {
    predecessor: prev
      ? { color: prev, succeeded, ...differenceFrom(color, prev) }
      : null,
    run,
    median,
    // Only worth a sentence when it is clearly off the median.
    longevity:
      run >= median * 2 && run > 4
        ? 'long'
        : run > 0 && run * 2 <= median
          ? 'short'
          : null,
    superlatives: superlatives(color, data.colors, currentYear),
    sameYear,
    retiredThatYear,
    next,
    history: historyAnchor(color, history),
    isFirstOfFamily: !prev,
    familySize: data.colors.filter((c) => c.shadeOf === color.shadeOf).length,
  };
}

/* -------------------------------------------------------------------------
   Using a colour on a table

   Grounded in the three things the glaze's own numbers actually settle:
   how much colour it carries (chroma), how light it is (L*, which decides
   what food reads against it), and how it separates from a white cloth or a
   dark table (WCAG contrast, used here as plain luminance difference).

   Nothing here reaches for colour psychology. "Blue suppresses appetite" and
   "red raises your heart rate" are marketing-blog folklore with thin evidence,
   and this site's whole claim is that it does not state things it cannot
   support.
   ---------------------------------------------------------------------- */

/** Lead, accent, quiet or ground -- how much of the table this colour can carry. */
export function tableRole(color) {
  const c = color.derived.lch.c;
  if (c < 12) return 'ground';
  if (c >= 45) return 'lead';
  if (c >= 25) return 'accent';
  return 'quiet';
}

export function tablescape(color) {
  const role = tableRole(color);
  const L = color.derived.lab.l;
  const onWhite = color.derived.onWhite;
  const onBlack = color.derived.onBlack;

  const roleText = {
    lead: `carries enough color to lead a table on its own. Use it for the plates and let quieter pieces do the rest; two or three settings of it go a long way.`,
    accent: `has enough color to be noticed without taking over, which makes it a good second or third piece - a salad plate or a serving bowl rather than the whole setting.`,
    quiet: `is soft enough to sit beside almost anything. It works as a bridge between two stronger colors that would otherwise argue.`,
    ground: `carries almost no color of its own, so it is the layer everything else sits on. Build the table out of it and add one loud piece.`,
  }[role];

  const plating =
    L > 78
      ? `At L*&nbsp;${L.toFixed(0)} it is one of the paler glazes in the line: dark food reads sharply against it, pale food much less so.`
      : L < 30
        ? `At L*&nbsp;${L.toFixed(0)} it is a genuinely dark plate, so pale food stands out on it and dark food disappears.`
        : `Its mid lightness (L*&nbsp;${L.toFixed(0)}) means most food reads against it without either washing out or vanishing.`;

  // Which table surface it separates from -- measured, not guessed.
  const surface =
    onWhite >= 4.5
      ? `It separates strongly from a white cloth (${onWhite.toFixed(1)}:1) and less so from dark wood.`
      : onBlack >= 4.5
        ? `It nearly disappears against a white cloth (${onWhite.toFixed(1)}:1), so it shows best on dark wood or a colored runner.`
        : `It sits close to both white linen and dark wood, so the surface underneath will not do much work for it.`;

  return { role, sentences: [`${color.color} ${roleText}`, plating, surface] };
}
