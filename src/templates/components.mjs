/**
 * Shared markup pieces. Everything here renders at build time, so the grid,
 * the ribbon and every colour description exist in the HTML a crawler (or a
 * reader with JavaScript off) receives.
 */
import { esc } from './layout.mjs';

/** "1936-1943" or "2026-present" -- never the raw "current" string. */
export function producedLabel(color) {
  return color.current ? `${color.startYear}–present` : `${color.startYear}–${color.endYear}`;
}

export function statusPill(color) {
  return color.current
    ? '<span class="pill pill--current"><span class="pill__dot" aria-hidden="true"></span>In production</span>'
    : '<span class="pill pill--retired"><span class="pill__dot" aria-hidden="true"></span>Retired</span>';
}

/** First sentence of the description, for card summaries and meta text. */
export function firstSentence(text, max = 165) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  const match = clean.match(/^.*?[.!?](?=\s|$)/);
  const s = match ? match[0] : clean;
  return s.length > max ? s.slice(0, max - 1).replace(/[\s,;]+\S*$/, '') + '…' : s;
}

/**
 * Data attributes the client-side filter reads. Kept on the <li> so filtering
 * is a class toggle rather than a re-render -- no innerHTML, no lost focus.
 */
function cardData(color, currentYear) {
  const searchable = [
    color.color,
    color.shadeOf,
    color.sku || '',
    color.hex,
    producedLabel(color),
    color.current ? 'current in production' : 'retired discontinued',
    color.era === 'vintage' ? 'vintage original' : 'post 86 post86',
  ]
    .join(' ')
    .toLowerCase();

  return [
    `data-slug="${esc(color.slug)}"`,
    `data-name="${esc(color.color.toLowerCase())}"`,
    `data-shade="${esc(color.shadeOf.toLowerCase())}"`,
    `data-era="${esc(color.era)}"`,
    `data-current="${color.current}"`,
    `data-start="${color.startYear}"`,
    `data-end="${color.current ? currentYear : color.endYear}"`,
    `data-decades="${color.decades.join(' ')}"`,
    `data-hue="${color.derived.hsl.h.toFixed(1)}"`,
    `data-light="${color.derived.hsl.l.toFixed(1)}"`,
    `data-search="${esc(searchable)}"`,
  ].join(' ');
}

/** "0348.jpg" -> "0348.webp", matching what tools/optimize-images.py writes. */
export function webpName(filename) {
  return String(filename).replace(/\.[^.]+$/, '.webp');
}

export function colorCard(color, base, currentYear, { index = 0, eager = false } = {}) {
  const textColor = color.derived.text.color;
  const href = `${base}colors/${color.slug}/`;
  const badge = color.sku
    ? `<span class="color-card__sku">${esc(color.sku)}</span>`
    : '<span class="color-card__sku color-card__sku--none">Vintage</span>';

  return `        <li class="color-card" ${cardData(color, currentYear)} style="order:${index}">
          <div class="color-card__swatch" style="background-color:${esc(color.hex)};color:${textColor}">
            ${badge}
            <picture class="color-card__photo">
              <source type="image/webp" srcset="${base}assets/opt/colors/${esc(webpName(color.image))}">
              <img src="${base}assets/colors/${esc(color.image)}" width="42" height="42"
                   ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"
                   alt="Fiesta dinnerware glazed in ${esc(color.color)}">
            </picture>
          </div>
          <div class="color-card__body">
            <h3 class="color-card__name"><a href="${esc(href)}">${esc(color.color)}</a></h3>
            <p class="color-card__meta">
              <span>${producedLabel(color)}</span><span class="dot-sep mono">${esc(color.hex)}</span>
            </p>
            ${statusPill(color)}
          </div>
        </li>`;
}

/**
 * The signature strip: every colour in the order it arrived. Each segment is a
 * real link with a real accessible name, so it works by keyboard and screen
 * reader rather than being decorative colour-only navigation.
 */
export function ribbon(timeline, base, skipTo = '#colors') {
  const swatches = timeline
    .map(
      (c) => `<a class="ribbon__swatch" href="${base}colors/${esc(c.slug)}/"
            style="background-color:${esc(c.hex)}"
            title="${esc(c.color)} · ${producedLabel(c)}"><span class="visually-hidden">${esc(
              c.color
            )}, ${producedLabel(c)}</span></a>`
    )
    .join('\n          ');

  const first = timeline[0];
  const last = timeline[timeline.length - 1];

  return `<div class="ribbon">
        <a class="skip-inline" href="${skipTo}">Skip the color ribbon</a>
        <nav class="ribbon__scroll" aria-label="All Fiesta colors in chronological order">
          ${swatches}
        </nav>
        <p class="ribbon__meta">
          <span>${first.startYear} &middot; ${esc(first.color)}</span>
          <span>${timeline.length} colors, oldest to newest</span>
          <span>${last.startYear} &middot; ${esc(last.color)}</span>
        </p>
      </div>`;
}

export function relatedCard(color, base, metaHtml) {
  return `        <li>
          <a class="related-card" href="${base}colors/${esc(color.slug)}/">
            <span class="related-card__swatch" style="background-color:${esc(color.hex)}"></span>
            <span class="related-card__body">
              <span class="related-card__name">${esc(color.color)}</span>
              <span class="related-card__meta">${metaHtml}</span>
            </span>
          </a>
        </li>`;
}

/** "No. 337", or an honest note for the vintage colors that predate numbering. */
export function skuLabel(color) {
  return color.sku ? `No.&nbsp;${esc(color.sku)}` : 'Vintage line';
}

/**
 * One suggested combination, drawn as a Coolors-style strip.
 *
 * Each band carries its own name, color number and availability in text -- the
 * combination has to be usable by someone who cannot see the colors, and
 * "which of these can I still buy" is the first question a reader has.
 */
export function paletteBlock(palette, owned, base) {
  const bands = palette.colors
    .map((c) => {
      const ink = c.derived.text.color;
      const isOwned = c.slug === owned.slug;
      const status = c.current ? 'In production' : `Retired ${c.endYear}`;
      const inner = `<span class="palette__band-name">${esc(c.color)}</span>
                <span class="palette__band-meta">${skuLabel(c)} &middot; ${status}</span>`;

      // No self-link: on Scarlet's page, Scarlet's band is not a link.
      const content = isOwned
        ? `<div><span class="palette__yours">Your color</span>
                ${inner}</div>`
        : `<a href="${base}colors/${esc(c.slug)}/">${inner}</a>`;

      return `            <li class="palette__band${isOwned ? ' palette__band--owned' : ''}"
                style="background-color:${esc(c.hex)};color:${ink}">
              ${content}
            </li>`;
    })
    .join('\n');

  return `        <article class="palette">
          <div class="palette__head">
            <h3 class="palette__name">${esc(palette.name)}</h3>
            ${
              palette.sourced
                ? '<span class="palette__tag">Named in the description</span>'
                : ''
            }
          </div>
          <p class="palette__why">${esc(palette.why)}</p>
          <ol class="palette__strip">
${bands}
          </ol>
        </article>`;
}
