/**
 * Resolves the CSS cascade for the site's filled controls and checks what the
 * browser will actually paint.
 *
 * This exists because of a real bug. `.site-nav__shop` set `color` to white on
 * a black pill, and `.site-nav a` -- one class plus one element, so (0,1,1)
 * against a lone class's (0,1,0) -- quietly won and put muted slate text on it
 * instead. 2.8:1, and legible only on hover, because the hover rule was the one
 * selector specific enough to land. check.mjs never saw it: the HTML was
 * correct, and nothing reads the stylesheet.
 *
 * So the rule here is: never verify the colour you wrote, verify the colour
 * that wins. Everything below is in service of that one sentence.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { contrastRatio } from '../src/lib/color.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* -------------------------------------------------------------------------
   A very small CSS reader

   Enough to parse this stylesheet, and no more: no @supports, no nesting, no
   selector lists inside :is(). If any of those arrive, this needs to grow.
   ---------------------------------------------------------------------- */

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** @returns {{selector:string, decls:Map<string,string>, media:string, order:number}[]} */
function parseRules(css) {
  const rules = [];
  let order = 0;

  const walk = (text, media) => {
    // Media blocks first, so their contents are not read as plain rules.
    const atRe = /@media([^{]+)\{/g;
    const spans = [];
    let m;
    while ((m = atRe.exec(text))) {
      // Find the brace that closes this @media.
      let depth = 1;
      let i = atRe.lastIndex;
      while (i < text.length && depth > 0) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') depth--;
        i++;
      }
      spans.push({ start: m.index, end: i, query: m[1].trim(), inner: text.slice(atRe.lastIndex, i - 1) });
      atRe.lastIndex = i;
    }

    let rest = '';
    let cursor = 0;
    for (const s of spans) {
      rest += text.slice(cursor, s.start);
      cursor = s.end;
    }
    rest += text.slice(cursor);

    for (const [sel, body] of blocks(rest)) {
      for (const one of sel.split(',')) {
        const selector = one.trim();
        if (selector) rules.push({ selector, decls: declarations(body), media, order: order++ });
      }
    }
    for (const s of spans) walk(s.inner, media ? `${media} and ${s.query}` : s.query);
  };

  walk(css, '');
  return rules;
}

function* blocks(text) {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(text))) yield [m[1], m[2]];
}

function declarations(body) {
  const out = new Map();
  for (const part of body.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const prop = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (prop) out.set(prop, value);
  }
  return out;
}

/* -------------------------------------------------------------------------
   Selectors
   ---------------------------------------------------------------------- */

/** `.site-nav a.site-nav__shop:hover` -> compound parts, right to left. */
function compounds(selector) {
  return selector
    .split(/\s+/)
    .filter((p) => p && p !== '>')
    .map((part) => {
      const classes = [...part.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1]);
      const pseudos = [...part.matchAll(/:{1,2}([a-z-]+)/g)].map((m) => m[1]);
      const attrs = [...part.matchAll(/\[([^\]=]+)(?:="([^"]*)")?\]/g)].map((m) => ({
        name: m[1].replace(/^:not\(/, ''),
        value: m[2],
        negated: part.includes(`:not([${m[1]}`),
      }));
      const tag = (part.match(/^([a-z][a-z0-9]*)/) || [])[1] || null;
      return { tag, classes, pseudos, attrs, raw: part };
    });
}

/** CSS specificity as [ids, classes, elements]. */
function specificity(selector) {
  let b = 0;
  let c = 0;
  for (const part of compounds(selector)) {
    b += part.classes.length + part.attrs.length;
    // Pseudo-elements count as elements, pseudo-classes as classes.
    for (const p of part.pseudos) (['before', 'after', 'first-line', 'placeholder'].includes(p) ? c++ : b++);
    if (part.tag) c++;
  }
  return [0, b, c];
}

function cmpSpecificity(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/**
 * Does `selector` match the last node of `chain`?
 * `chain` is ancestor-first; each node is { tag, classes, attrs, states }.
 */
function matches(selector, chain) {
  const parts = compounds(selector);
  let ci = chain.length - 1;

  const hit = (part, node) => {
    if (part.tag && part.tag !== node.tag) return false;
    if (!part.classes.every((c) => node.classes.includes(c))) return false;
    for (const a of part.attrs) {
      const have = node.attrs?.[a.name];
      const ok = a.value === undefined ? have !== undefined : have === a.value;
      if (a.negated ? ok : !ok) return false;
    }
    for (const p of part.pseudos) {
      if (['hover', 'focus', 'focus-visible', 'active', 'target'].includes(p)) {
        if (!(node.states || []).includes(p)) return false;
      } else if (p === 'not') {
        // Handled through attrs above; anything else is out of scope.
      } else if (p === 'root') {
        return false;
      }
    }
    return true;
  };

  // The rightmost compound must match the element itself.
  if (!hit(parts[parts.length - 1], chain[ci])) return false;
  ci--;

  // Remaining compounds match any ancestor, nearest first.
  for (let pi = parts.length - 2; pi >= 0; pi--) {
    let found = false;
    while (ci >= 0) {
      if (hit(parts[pi], chain[ci])) {
        found = true;
        ci--;
        break;
      }
      ci--;
    }
    if (!found) return false;
  }
  return true;
}

/* -------------------------------------------------------------------------
   Custom properties
   ---------------------------------------------------------------------- */

/** Collects :root tokens for one theme by replaying the stylesheet in order. */
function tokensFor(rules, theme) {
  const tokens = new Map();
  for (const r of rules) {
    const sel = r.selector;
    const isRoot = sel.startsWith(':root') || sel === 'html';
    if (!isRoot) continue;

    const darkMedia = /prefers-color-scheme:\s*dark/.test(r.media);
    const darkAttr = sel.includes('[data-theme="dark"]');
    const lightAttr = sel.includes('[data-theme="light"]') && !sel.includes(':not(');

    if (theme === 'light') {
      if (darkMedia || darkAttr) continue;
    } else {
      // Dark: the bare :root block still provides the base, then dark overrides.
      if (lightAttr) continue;
    }
    for (const [k, v] of r.decls) if (k.startsWith('--')) tokens.set(k, v.trim());
  }
  return tokens;
}

function resolve(value, tokens, seen = new Set()) {
  if (!value) return value;
  let out = value;
  for (let i = 0; i < 10 && out.includes('var('); i++) {
    out = out.replace(/var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,\s*([^)]*))?\)/g, (all, name, fallback) => {
      if (seen.has(name)) return fallback || '';
      seen.add(name);
      const v = tokens.get(name);
      return v !== undefined ? v : fallback || '';
    });
  }
  return out.trim();
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/* -------------------------------------------------------------------------
   The controls under test

   Each entry is the ancestor chain a real element has in the built HTML. These
   are written by hand on purpose: the point is to state what the design
   intends, so a future edit that silently breaks it has something to fail
   against.
   ---------------------------------------------------------------------- */

const header = [
  { tag: 'header', classes: ['site-header'] },
  { tag: 'div', classes: ['wrap', 'site-header__inner'] },
];
const navChain = [...header, { tag: 'nav', classes: ['site-nav'] }];
const footerChain = [
  { tag: 'footer', classes: ['site-footer'] },
  { tag: 'div', classes: ['wrap'] },
];

const CONTROLS = [
  {
    name: 'Shop Online, nav',
    chain: [...navChain, { tag: 'a', classes: ['site-nav__shop'] }],
  },
  {
    name: 'Shop Online, nav (hover)',
    chain: [...navChain, { tag: 'a', classes: ['site-nav__shop'], states: ['hover'] }],
  },
  {
    name: 'Nav link',
    chain: [...navChain, { tag: 'a', classes: [] }],
  },
  {
    name: 'Nav link, current',
    chain: [...navChain, { tag: 'a', classes: [], attrs: { 'aria-current': 'page' } }],
  },
  {
    name: 'Buy Fiesta button',
    chain: [{ tag: 'div', classes: ['hero__actions'] }, { tag: 'a', classes: ['btn', 'btn--buy'] }],
  },
  {
    name: 'Buy Fiesta button (hover)',
    chain: [
      { tag: 'div', classes: ['hero__actions'] },
      { tag: 'a', classes: ['btn', 'btn--buy'], states: ['hover'] },
    ],
  },
  {
    name: 'Primary button',
    chain: [{ tag: 'div', classes: ['hero__actions'] }, { tag: 'a', classes: ['btn', 'btn--primary'] }],
  },
  {
    name: 'Primary button (hover)',
    chain: [
      { tag: 'div', classes: ['hero__actions'] },
      { tag: 'a', classes: ['btn', 'btn--primary'], states: ['hover'] },
    ],
  },
  {
    name: 'Ghost button',
    chain: [{ tag: 'div', classes: ['hero__actions'] }, { tag: 'a', classes: ['btn', 'btn--ghost'] }],
  },
  {
    name: 'Skip link (focused)',
    chain: [{ tag: 'a', classes: ['skip-link'], states: ['focus'] }],
  },
  {
    name: 'In-production pill',
    chain: [{ tag: 'span', classes: ['pill', 'pill--current'] }],
  },
  {
    name: 'Retired pill',
    chain: [{ tag: 'span', classes: ['pill', 'pill--retired'] }],
  },
  {
    name: 'Palette tag',
    chain: [{ tag: 'span', classes: ['palette__tag'] }],
  },
  {
    name: 'Footer link',
    chain: [...footerChain, { tag: 'a', classes: [] }],
  },
  {
    name: 'Footer link (hover)',
    chain: [...footerChain, { tag: 'a', classes: [], states: ['hover'] }],
  },
  {
    name: 'Theme toggle',
    chain: [...header, { tag: 'button', classes: ['theme-toggle'] }],
  },
];

/* -------------------------------------------------------------------------
   Resolution
   ---------------------------------------------------------------------- */

/** The declaration that wins `prop` for the last node of `chain`. */
function winner(rules, chain, prop, { narrow }) {
  let best = null;
  for (const r of rules) {
    if (!applies(r.media, narrow)) continue;
    if (!r.decls.has(prop)) continue;
    if (!matches(r.selector, chain)) continue;
    const spec = specificity(r.selector);
    if (
      !best ||
      cmpSpecificity(spec, best.spec) > 0 ||
      (cmpSpecificity(spec, best.spec) === 0 && r.order > best.order)
    ) {
      best = { spec, order: r.order, value: r.decls.get(prop), selector: r.selector };
    }
  }
  return best;
}

/** Media queries are evaluated for one scenario: a width, in a colour scheme. */
function applies(media, narrow) {
  if (!media) return true;
  // The theme is handled by token selection, not here.
  if (/prefers-color-scheme/.test(media)) return true;
  const max = media.match(/max-width:\s*(\d+)px/);
  if (max) return narrow <= Number(max[1]);
  const min = media.match(/min-width:\s*(\d+)px/);
  if (min) return narrow >= Number(min[1]);
  if (/prefers-reduced-motion|forced-colors|print|hover:/.test(media)) return false;
  return true;
}

/** Walks up the chain for the nearest declared background. */
function backgroundFor(rules, chain, opts, tokens, pageBg) {
  for (let i = chain.length - 1; i >= 0; i--) {
    const sub = chain.slice(0, i + 1);
    for (const prop of ['background', 'background-color']) {
      const w = winner(rules, sub, prop, opts);
      if (!w) continue;
      const v = resolve(w.value, tokens).split(/\s+/)[0];
      if (v === 'transparent' || v === 'none') continue;
      if (HEX.test(v)) return { hex: v, from: w.selector };
    }
  }
  return { hex: pageBg, from: 'page background' };
}

/* -------------------------------------------------------------------------
   Run
   ---------------------------------------------------------------------- */

const css = stripComments(await readFile(join(root, 'assets/css/main.css'), 'utf8'));
const rules = parseRules(css);

const scenarios = [
  { theme: 'light', narrow: 1280, label: 'light / desktop' },
  { theme: 'dark', narrow: 1280, label: 'dark  / desktop' },
  { theme: 'light', narrow: 360, label: 'light / 360px' },
  { theme: 'dark', narrow: 360, label: 'dark  / 360px' },
];

const MIN = 4.5;
let failures = 0;
let checked = 0;
const skipped = [];

for (const sc of scenarios) {
  const tokens = tokensFor(rules, sc.theme);
  const pageBg = resolve('var(--bg)', tokens);
  const opts = { narrow: sc.narrow };
  const lines = [];

  for (const control of CONTROLS) {
    const chain = control.chain.map((n) => ({ states: [], attrs: {}, ...n }));
    const colorWin = winner(rules, chain, 'color', opts);
    if (!colorWin) {
      skipped.push(`${sc.label}  ${control.name}: no color declaration found`);
      continue;
    }
    const fg = resolve(colorWin.value, tokens);
    if (!HEX.test(fg)) {
      skipped.push(`${sc.label}  ${control.name}: color is "${fg}", not a hex`);
      continue;
    }
    const bg = backgroundFor(rules, chain, opts, tokens, pageBg);
    if (!HEX.test(bg.hex)) {
      skipped.push(`${sc.label}  ${control.name}: background is "${bg.hex}", not a hex`);
      continue;
    }

    const ratio = contrastRatio(fg, bg.hex);
    const ok = ratio >= MIN;
    checked++;
    if (!ok) failures++;
    lines.push(
      `  ${ok ? 'ok  ' : 'FAIL'} ${ratio.toFixed(2).padStart(6)}:1  ${control.name.padEnd(26)} ` +
        `${fg} on ${bg.hex}` +
        (ok ? '' : `\n         color from  ${colorWin.selector}\n         bg    from  ${bg.from}`)
    );
  }

  console.log(`\n${sc.label}`);
  console.log(lines.join('\n'));
}

if (skipped.length) {
  console.log('\nNot checked:');
  for (const s of skipped) console.log(`  - ${s}`);
}

console.log(
  `\n${failures} failing, ${checked} control/scenario pairs checked against ${MIN}:1` +
    (skipped.length ? `, ${skipped.length} skipped` : '')
);
process.exit(failures > 0 ? 1 : 0);
