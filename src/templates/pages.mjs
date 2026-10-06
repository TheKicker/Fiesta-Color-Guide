/**
 * Page bodies. Each export returns { title, description, body, schema, ... }
 * which build.mjs hands to layout.page().
 */
import { esc, icon, adSlot } from './layout.mjs';
import {
  colorCard,
  ribbon,
  relatedCard,
  statusPill,
  producedLabel,
  firstSentence,
  webpName,
  skuLabel,
  paletteBlock,
  contextProse,
  disambiguate,
} from './components.mjs';
import { buildContext, tablescape } from '../lib/context.mjs';
import { buildPalettes } from '../lib/palettes.mjs';
import { spectrum } from '../lib/spectrum.mjs';

const n = (x, d = 0) => x.toFixed(d);

/* -------------------------------------------------------------------------
   Shared bits
   ---------------------------------------------------------------------- */

/**
 * The "buy it" call to action, in its two shapes.
 *
 * Both read from site.config.json -> shop, so there is exactly one URL to
 * change and no template edits when the store moves. An empty `url` makes
 * every one of these vanish, which is also how you turn the whole thing off.
 *
 * This site is not the shop and says so in the footer, so the wording always
 * names who you are being sent to. "Buy Fiesta" on its own would read like
 * this site sells it.
 */
function buyButton(site, { variant = 'buy', indent = '              ' } = {}) {
  const shop = site.shop;
  if (!shop?.url) return '';
  const label = variant === 'shop' ? `Shop ${esc(shop.seller)}` : esc(shop.label || 'Buy Fiesta');
  return (
    `${indent}<a class="btn btn--buy" href="${esc(shop.url)}" rel="noopener" target="_blank">` +
    `${icon('cart')}${label}</a>\n`
  );
}

/**
 * The strip that sits on a colour page.
 *
 * `inProduction` decides the sentence, and that is the whole point: a retired
 * colour must never imply you can still buy it. The button is the same either
 * way, because the store is still where you go - you are just going there for
 * something else.
 */
function buyStrip(site, { colorName, inProduction, startYear, endYear, currentYear }) {
  const shop = site.shop;
  if (!shop?.url) return '';
  const seller = esc(shop.seller || 'the factory store');
  const name = esc(colorName);

  // A colour announced for next year is `current` in the data from the day it
  // is added, which is correct everywhere else on the site but would read as a
  // lie here. Catch it before the in-production sentence does.
  const line = !inProduction
    ? `<strong>${name} was retired in ${endYear}</strong>, so it is a hunt for secondhand pieces
            now. ${seller} is where the colors still being made are, if you are filling a set.`
    : startYear > currentYear
      ? `<strong>${name} arrives in ${startYear}.</strong> It is not on shelves yet. ${seller} is
            the factory's own store and is where it will turn up first.`
      : `<strong>${name} is in production right now.</strong> ${seller} is the factory's own
            store, in Newell, West Virginia - the same plant that made the piece.`;
  return `        <section class="wrap wrap--narrow section--tight">
          <div class="buy-strip">
            <p>${line}</p>
${buyButton(site, { variant: inProduction ? 'buy' : 'shop', indent: '            ' })}          </div>
        </section>
`;
}

/**
 * Repeated on every colour page and hub, so it is kept to one sentence and a
 * link. The long version lives once, on the About page, where it can be read
 * properly instead of skimmed 61 times.
 */
const disclaimer = (base) => `<aside class="callout">
          <p><strong>Swatches are a close reference, not a specification.</strong> Fired glaze
          shifts with the production run, the light in your room and your screen.
          <a href="${base}about.html#colors">How these values are derived &rarr;</a></p>
        </aside>`;

function plateStackBand(base) {
  return `      <div class="plate-stack">
        <picture>
          <source type="image/webp" srcset="${base}assets/opt/plate-stack-1200.webp 1200w, ${base}assets/opt/plate-stack-2000.webp 2000w" sizes="(max-width: 1400px) 100vw, 1400px">
          <img src="${base}assets/images/Fiesta-Plate-Stack-2023.png" width="4114" height="900"
               loading="lazy" decoding="async"
               alt="A long horizontal stack of Fiesta plates arranged as a rainbow, from reds through oranges, yellows, greens, blues and purples.">
        </picture>
      </div>`;
}

/* -------------------------------------------------------------------------
   Home
   ---------------------------------------------------------------------- */

export function home({ site, data, base = '' }) {
  const { timeline, colors, current, vintage, post86, shades, decades, currentYear, firstYear } = data;
  const newest = timeline[timeline.length - 1];
  const years = currentYear - firstYear;

  const shadeCounts = new Map();
  for (const c of colors) shadeCounts.set(c.shadeOf, (shadeCounts.get(c.shadeOf) || 0) + 1);

  // Representative swatch per shade family: the current colour if there is one,
  // otherwise the most recent. Keeps the chip dots honest rather than generic.
  const shadeSwatch = new Map();
  for (const s of shades) {
    const inFamily = timeline.filter((c) => c.shadeOf === s);
    const pick = inFamily.filter((c) => c.current).pop() || inFamily[inFamily.length - 1];
    shadeSwatch.set(s, pick.hex);
  }

  const chips = shades
    .map(
      (s) => `            <li><button type="button" class="chip" data-filter-shade="${esc(
        s.toLowerCase()
      )}" aria-pressed="false">
              <span class="chip__dot" style="background:${esc(shadeSwatch.get(s))}" aria-hidden="true"></span>
              ${esc(s)} <span class="chip__count">${shadeCounts.get(s)}</span>
            </button></li>`
    )
    .join('\n');

  const decadeOptions = decades
    .map((d) => `<option value="${d}">${d}s</option>`)
    .join('\n                  ');

  const cards = timeline
    .map((c, i) => colorCard(c, base, currentYear, { index: i, eager: i < 4 }))
    .join('\n');

  const faqs = [
    {
      q: 'How many Fiesta colors have there been?',
      a: `This guide documents <strong>${colors.length}</strong> Fiesta colors: ${vintage.length} from the
          original ${data.eras.vintage.start}-${data.eras.vintage.end} run and ${post86.length} from the
          Post 86 line that began with the ${data.eras.post86.start} reintroduction. Colors that were made in both eras under the same name - Red, Rose,
          Yellow, Turquoise and Chartreuse - are listed separately, because the glaze recipes and the
          resulting colors are not the same.`,
    },
    {
      q: 'Which Fiesta colors are in production right now?',
      a: `<strong>${current.length}</strong> colors are currently in production: ${current
        .map((c) => `<a href="${base}colors/${c.slug}/">${esc(c.color)}</a>`)
        .join(', ')}. Fiesta typically introduces one new color a year and retires one or more at the same
          time, so this list changes every spring.`,
    },
    {
      q: 'What is the newest Fiesta color?',
      a: `<a href="${base}colors/${newest.slug}/"><strong>${esc(newest.color)}</strong></a>
          (${esc(newest.hex)}), introduced in ${newest.startYear}. ${esc(firstSentence(newest.description, 240))}`,
    },
    {
      q: 'Are these hex codes official Fiesta colors?',
      a: `No. The Fiesta Tableware Company does not publish hex values for its glazes. Every hex code here
          is this project's best-effort digital match, derived from product photography and public reference
          material, and it is the number every other value on the color page is calculated from. Fired glaze
          also varies between production runs, so no single hex can be exactly right for every piece.
          <a href="${base}about.html">How the data is built &rarr;</a>`,
    },
    {
      q: 'What is the difference between vintage Fiesta and Post 86?',
      a: `Vintage Fiesta ran from 1936 until the line was retired in 1973. Fiesta returned in March 1986 for
          its 50th anniversary in a vitrified, lead-free body with an updated palette - collectors call
          everything from that point on "Post 86." Post 86 pieces carry a color number (Lapis is No. 337, for
          example); vintage pieces predate that numbering entirely.`,
    },
    {
      q: 'Which Fiesta colors go together?',
      a: `Every color page ends with a set of table-setting combinations built only from colors Fiesta has
          actually made - starting, where one exists, with the pairing named in that color's own
          description, then combinations built on opposite hues, tonal ladders and neutral anchors. Each
          swatch says whether you can still buy it, so you know which sets you can finish today.
          <a href="${base}about.html#pairings">How the combinations are built &rarr;</a>`,
    },
    {
      q: 'What do the Fiesta color numbers mean?',
      a: `Every Post 86 color carries a number - Lapis is No.&nbsp;337, Scarlet is No.&nbsp;326,
          Lavender is No.&nbsp;351 - and it is the fastest way to identify a modern piece or order a
          replacement. The numbers run roughly in order of introduction. Vintage colors from the
          ${firstYear}-1972 run predate the system entirely and have no number.`,
    },
    {
      q: 'How do I tell which Fiesta color I have?',
      a: `Compare your piece to the swatches here in daylight, then check the shape and the backstamp. Narrow
          the field with the shade filter above, then open a color page for the full production years and
          nearby colors - a lot of Fiesta identification comes down to separating two colors that are only
          a few &Delta;E apart, like <a href="${base}colors/turquoise-1988/">Turquoise</a> and
          <a href="${base}colors/sky/">Sky</a>.`,
    },
  ];

  const faqHtml = faqs
    .map(
      (f) => `          <details>
            <summary>${f.q}</summary>
            <div><p>${f.a}</p></div>
          </details>`
    )
    .join('\n');

  const body = `      <section class="wrap hero">
        <div class="hero__grid">
          <div>
            <p class="eyebrow">Unofficial reference &middot; ${firstYear}-${currentYear}</p>
            <h1>Every Fiesta color, ${firstYear} to today</h1>
            <p class="hero__lede">
              ${colors.length} glazes across ${years} years of American dinnerware. Look up a color by
              number, see what is still in production, and find the combinations that go with the
              pieces you already own.
            </p>
            <div class="hero__actions">
              <a class="btn btn--primary" href="#colors">Browse the palette</a>
              <a class="btn btn--ghost" href="${base}history.html">90 years of history</a>
${buyButton(site, { variant: 'buy' })}            </div>
          </div>
          <div>
            <dl class="stats">
              <div class="stat"><dd>${colors.length}</dd><dt>colors documented</dt></div>
              <div class="stat"><dd>${current.length}</dd><dt>in production now</dt></div>
              <div class="stat"><dd>${vintage.length}</dd><dt>vintage, ${firstYear}-${data.eras.vintage.end}</dt></div>
              <div class="stat"><dd>${post86.length}</dd><dt>Post 86, ${data.eras.post86.start}-today</dt></div>
            </dl>
          </div>
        </div>
      </section>

      <section class="wrap section--tight" aria-labelledby="ribbon-heading">
        <div class="section-head">
          <div>
            <h2 id="ribbon-heading">Fiesta history in living color</h2>
            <p>Every color in the order it arrived, ${firstYear} to ${newest.startYear}. Pick any band to open it.</p>
          </div>
        </div>
        ${ribbon(timeline, base)}
      </section>

      ${adSlot(site, { format: 'leaderboard' })}

      <section id="colors" aria-labelledby="colors-heading">
        <div class="wrap">
          <div class="section-head">
            <div>
              <h2 id="colors-heading">The full palette</h2>
              <p>Filter by shade family, era or decade, or search by name, color number or hex code.</p>
            </div>
          </div>
        </div>

        <div class="toolbar" id="toolbar">
          <div class="wrap">
            <form class="toolbar__row" id="filters" role="search" aria-label="Filter Fiesta colors">
              <div class="search">
                ${icon('search')}
                <label class="visually-hidden" for="q">Search colors by name, number or hex code</label>
                <input type="search" id="q" name="q" autocomplete="off" placeholder="Search ${colors.length} colors - try &quot;lapis&quot;, &quot;337&quot; or &quot;#2B64A1&quot;">
                <button type="button" class="search__clear" id="q-clear" hidden>
                  ${icon('close')}<span class="visually-hidden">Clear search</span>
                </button>
              </div>

              <div class="field">
                <label for="status">Status</label>
                <span class="select"><select id="status" name="status">
                  <option value="all">All</option>
                  <option value="current">In production</option>
                  <option value="retired">Retired</option>
                </select></span>
              </div>

              <div class="field">
                <label for="era">Era</label>
                <span class="select"><select id="era" name="era">
                  <option value="all">All eras</option>
                  <option value="vintage">${esc(data.eras.vintage.short)}</option>
                  <option value="post86">${esc(data.eras.post86.short)}</option>
                </select></span>
              </div>

              <div class="field">
                <label for="decade">Decade</label>
                <span class="select"><select id="decade" name="decade">
                  <option value="all">Any decade</option>
                  ${decadeOptions}
                </select></span>
              </div>

              <div class="field">
                <label for="sort">Sort</label>
                <span class="select"><select id="sort" name="sort">
                  <option value="chrono">Oldest first</option>
                  <option value="recent">Newest first</option>
                  <option value="name">Name A-Z</option>
                  <option value="hue">Hue (rainbow)</option>
                  <option value="light">Light to dark</option>
                </select></span>
              </div>
            </form>

            <ul class="chips" aria-label="Filter by shade family">
${chips}
            </ul>

            <p class="toolbar__status">
              <span id="result-count" role="status"><strong>${colors.length}</strong> colors</span>
              <button type="button" class="link-button" id="reset" hidden>Reset filters</button>
            </p>
          </div>
        </div>

        <div class="wrap">
          <noscript>
            <p class="callout">Filtering and search need JavaScript. All ${colors.length} colors are listed
            below either way, oldest first.</p>
          </noscript>

          <ul class="color-grid" id="color-grid">
${cards}
          </ul>

          <div class="empty-state" id="empty-state" hidden>
            <h3>No colors match those filters</h3>
            <p>Try a different shade family, or widen the decade range.</p>
            <button type="button" class="btn btn--ghost" data-reset>Reset all filters</button>
          </div>
        </div>
      </section>

      ${adSlot(site, { format: 'rectangle' })}

      <section class="wrap section--tight" aria-labelledby="browse-heading">
        <div class="section-head">
          <div>
            <h2 id="browse-heading">Browse by shade or era</h2>
            <p>The chips above filter this page. These are full pages of their own, if you'd rather link to one.</p>
          </div>
        </div>
        <ul class="related-strip">
${shades
  .map((s) => {
    const family = timeline.filter((c) => c.shadeOf === s);
    const pick = family.filter((c) => c.current).pop() || family[family.length - 1];
    return `          <li>
            <a class="related-card" href="${base}colors/shade/${s.toLowerCase()}/">
              <span class="related-card__swatch" style="background-color:${esc(pick.hex)}"></span>
              <span class="related-card__body">
                <span class="related-card__name">${esc(s)}<span class="visually-hidden"> family</span></span>
                <span class="related-card__meta">${family.length} color${family.length === 1 ? '' : 's'}</span>
              </span>
            </a>
          </li>`;
  })
  .join(String.fromCharCode(10))}
        </ul>
        <ul class="link-list" style="margin-top:1.25rem">
          <li><a href="${base}colors/era/in-production/">Colors in production now (${current.length})</a></li>
          <li><a href="${base}colors/era/vintage/">Vintage colors, ${firstYear}-${data.eras.vintage.end} (${vintage.length})</a></li>
          <li><a href="${base}colors/era/post-86/">Post 86 colors, ${data.eras.post86.start}-today (${post86.length})</a></li>
          <li><a href="${base}colors/rainbow/">ROYGBIV: every color sorted by the rainbow</a></li>
        </ul>
      </section>

      <section class="section section--surface" aria-labelledby="faq-heading">
        <div class="wrap wrap--narrow">
          <h2 id="faq-heading">Frequently asked</h2>
          <div class="faq" style="margin-top:1.25rem">
${faqHtml}
          </div>
          <div style="margin-top:1.5rem">${disclaimer(base)}</div>
        </div>
      </section>

      <section class="section--tight">
${plateStackBand(base)}
      </section>`;

  const schema = [
    {
      '@type': 'WebSite',
      '@id': `${site.baseUrl}/#website`,
      url: `${site.baseUrl}/`,
      name: site.siteName,
      description: `An unofficial reference to every Fiesta dinnerware color from ${firstYear} to today.`,
      inLanguage: 'en-US',
      publisher: { '@id': `${site.baseUrl}/#person` },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${site.baseUrl}/?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Person',
      '@id': `${site.baseUrl}/#person`,
      name: site.author.name,
      url: site.author.url,
    },
    {
      '@type': 'CollectionPage',
      '@id': `${site.baseUrl}/#webpage`,
      url: `${site.baseUrl}/`,
      name: `Fiesta Color Guide: all ${colors.length} colors, ${firstYear}-${currentYear}`,
      isPartOf: { '@id': `${site.baseUrl}/#website` },
      about: { '@id': `${site.baseUrl}/#termset` },
      inLanguage: 'en-US',
    },
    {
      '@type': 'DefinedTermSet',
      '@id': `${site.baseUrl}/#termset`,
      name: 'Fiesta dinnerware colors',
      description: `Every glaze color used on Fiesta dinnerware between ${firstYear} and ${currentYear}, across the original run and the Post 86 line.`,
      url: `${site.baseUrl}/`,
      hasDefinedTerm: timeline.map((c) => ({
        '@type': 'DefinedTerm',
        '@id': `${site.baseUrl}/colors/${c.slug}/#color`,
        name: c.color,
        url: `${site.baseUrl}/colors/${c.slug}/`,
      })),
    },
    {
      '@type': 'FAQPage',
      '@id': `${site.baseUrl}/#faq`,
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q.replace(/<[^>]+>/g, ''),
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.a.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
        },
      })),
    },
  ];

  return {
    title: `Fiesta Color Guide: All ${colors.length} Colors, ${firstYear}-${currentYear}`,
    description: `Every Fiesta dinnerware color from ${firstYear} to today - ${colors.length} glazes with hex codes, production years and photos. Filter by shade, era or decade. Unofficial reference.`,
    body,
    schema,
    navKey: 'colors',
    scripts: ['assets/js/app.js'],
  };
}

/* -------------------------------------------------------------------------
   Colour detail
   ---------------------------------------------------------------------- */

export function colorPage({ site, data, color, base = '../../', images = {} }) {
  const photo = images[`assets/colors/${color.image}`] || { w: 100, h: 85 };
  const { currentYear } = data;
  const textColor = color.derived.text.color;
  const canonicalPath = `colors/${color.slug}/`;

  const ctx = buildContext(color, data);
  const table = tablescape(color);
  const palettes = buildPalettes(color, data.colors);
  const paletteHtml = palettes.map((p) => paletteBlock(p, color, base)).join('\n');

  const contemporaries = color.contemporaries.slice(0, 10);
  const contemporaryHtml = contemporaries
    .map((c) => relatedCard(c, base, producedLabel(c)))
    .join('\n');

  const similarHtml = color.similar
    .map((s) =>
      relatedCard(
        s.color,
        base,
        `&Delta;E ${n(s.delta, 1)} &middot; ${producedLabel(s.color)}`
      )
    )
    .join('\n');

  const facts = [
    ['Introduced', String(color.startYear)],
    ['Retired', color.current ? 'Still in production' : String(color.endYear)],
    [
      'Years in production',
      color.current
        ? // A colour introduced this year has not run a year yet, and "0+ and
          // counting" reads like a bug - especially now that Production is the
          // first thing on the page.
          currentYear - color.startYear < 1
          ? 'Its first year'
          : `${currentYear - color.startYear}+ and counting`
        : `${Math.max(1, color.endYear - color.startYear)}`,
    ],
    ['Color number', color.sku ? `No. ${color.sku}` : 'None - predates Fiesta color numbering'],
    ['Shade family', color.shadeOf],
    [
      'Era',
      `<a href="${base}colors/era/${color.era === 'vintage' ? 'vintage' : 'post-86'}/">${esc(
        data.eras[color.era].full
      )}</a>`,
      { html: true },
    ],
  ]
    .map(
      ([k, v, opts]) => `          <div class="spec">
            <span class="spec__label">${esc(k)}</span>
            <span class="spec__value">${opts?.html ? v : esc(v)}</span>
          </div>`
    )
    .join('\n');

  const pager = `      <nav class="pager" aria-label="Nearby colors in the timeline">
        ${
          color.prev
            ? `<a class="pager__prev" href="${base}colors/${color.prev.slug}/">
          <span class="pager__swatch" style="background:${esc(color.prev.hex)}"></span>
          <span><span class="pager__label">Earlier</span><span class="pager__name">${esc(
            color.prev.color
          )} &middot; ${color.prev.startYear}</span></span>
        </a>`
            : '<span></span>'
        }
        ${
          color.next
            ? `<a class="pager__next" href="${base}colors/${color.next.slug}/">
          <span class="pager__swatch" style="background:${esc(color.next.hex)}"></span>
          <span><span class="pager__label">Later</span><span class="pager__name">${esc(
            color.next.color
          )} &middot; ${color.next.startYear}</span></span>
        </a>`
            : '<span></span>'
        }
      </nav>`;

  const body = `      <div class="wrap breadcrumb">
        <nav aria-label="Breadcrumb">
          <ol>
            <li><a href="${base || './'}">Colors</a></li>
            <li><a href="${base}colors/shade/${esc(
              color.shadeOf.toLowerCase()
            )}/">${esc(color.shadeOf)}<span class="visually-hidden"> family</span></a></li>
            <li aria-current="page">${esc(color.color)}</li>
          </ol>
        </nav>
      </div>

      <article>
        <div class="wrap color-hero">
          <div class="color-hero__swatch" style="background-color:${esc(color.hex)};color:${textColor}">
            ${
              color.sku
                ? `<span class="color-hero__sku"><span class="color-hero__sku-label">Color number</span>${esc(
                    color.sku
                  )}</span>`
                : '<span class="color-hero__sku"><span class="color-hero__sku-label">Vintage line</span>No number</span>'
            }
            <span class="color-hero__swatch-note">${esc(color.color)} &middot; ${producedLabel(
              color
            )} &middot; <span class="mono">${esc(color.hex)}</span></span>
          </div>
          <div>
            <p class="eyebrow"><a href="${base}colors/shade/${esc(
              color.shadeOf.toLowerCase()
            )}/">${esc(color.shadeOf)} family</a> &middot; <a href="${base}colors/era/${
              color.era === 'vintage' ? 'vintage' : 'post-86'
            }/">${color.era === 'vintage' ? 'Vintage' : 'Post 86'}</a></p>
            <div class="color-hero__title">
              <h1>${esc(color.color)}</h1>
              ${statusPill(color)}
            </div>
            <p class="color-hero__years">
              ${producedLabel(color)}${color.sku ? ` &middot; Color No.&nbsp;${esc(color.sku)}` : ''}
            </p>
            <p class="color-hero__desc">${esc(color.description)}</p>


            <figure class="photo-figure">
              <picture>
                <source type="image/webp" srcset="${base}assets/opt/colors/${esc(webpName(color.image))}">
                <img src="${base}assets/colors/${esc(color.image)}" width="${photo.w}" height="${photo.h}"
                     fetchpriority="high" decoding="async"
                     alt="A Fiesta place setting glazed in ${esc(color.color)}: dinner plate, salad plate, bowl and mug">
              </picture>
              <figcaption>
                Photographed ware in ${esc(color.color)}. Fired glaze varies between runs - the flat
                swatch above is the reference value, this is what it looks like on a plate.
              </figcaption>
            </figure>
          </div>
        </div>

        <section class="wrap section--tight" aria-labelledby="facts-heading">
          <div class="section-head">
            <div><h2 id="facts-heading">Production</h2></div>
          </div>
          <div class="spec-grid">
${facts}
          </div>
        </section>

${buyStrip(site, {
  colorName: color.color,
  inProduction: color.current,
  startYear: color.startYear,
  endYear: color.endYear,
  currentYear,
})}
${
          color.notes.length
            ? `        <section class="wrap wrap--narrow section--tight" aria-labelledby="notes-heading">
          <div class="section-head">
            <div><h2 id="notes-heading">Notes on ${esc(color.color)}</h2></div>
          </div>
          <div class="prose">
${color.notes.map((p) => `            <p>${esc(p)}</p>`).join('\n')}
          </div>
        </section>
`
            : ''
        }
        <section class="wrap section--tight" aria-labelledby="pairs-heading">
          <div class="section-head">
            <div>
              <h2 id="pairs-heading">Using ${esc(color.color)} on a table</h2>
              <p>${table.sentences.join(' ')}</p>
              <p>
                Below, ${palettes.length} combinations built only from colors Fiesta has actually produced.
                Each says which rule it follows, and which pieces you can still buy today.
              </p>
            </div>
          </div>
${paletteHtml}
        </section>

        ${adSlot(site, { format: 'leaderboard' })}


${contextProse(color, ctx, base)}

        <section class="wrap section--tight" aria-labelledby="similar-heading">
          <div class="section-head">
            <div>
              <h2 id="similar-heading">Closest colors in the palette</h2>
              <p>
                Ranked by CIEDE2000 (&Delta;E) against ${esc(color.color)}. Under about &Delta;E&nbsp;5 two
                colors are hard to tell apart side by side - useful when you are identifying an unmarked piece.
              </p>
            </div>
          </div>
          <ul class="related-strip">
${similarHtml}
          </ul>
        </section>

        <section class="wrap section--tight" aria-labelledby="alongside-heading">
          <div class="section-head">
            <div>
              <h2 id="alongside-heading">On the table alongside ${esc(color.color)}</h2>
              <p>
                ${color.contemporaries.length} color${color.contemporaries.length === 1 ? ' was' : 's were'}
                in production at the same time${
                  contemporaries.length < color.contemporaries.length
                    ? `. The ${contemporaries.length} nearest in the timeline:`
                    : ':'
                }
              </p>
            </div>
          </div>
          <ul class="related-strip">
${contemporaryHtml}
          </ul>
        </section>

        <div class="wrap section--tight">
          ${disclaimer(base)}
        </div>

        <div class="wrap">
${pager}
        </div>
      </article>`;

  const lead = `Fiesta ${color.color}${color.sku ? ` (No. ${color.sku})` : ''}, ${
    color.current ? `in production since ${color.startYear}` : producedLabel(color)
  }.`;

  // Prefer the opening of the hand-written note: it is the most specific thing
  // the site says about this color, and a snippet written for the page beats a
  // template every time.
  const noteOpening = color.notes.length ? firstSentence(color.notes[0], 200) : '';
  const desc =
    [
      noteOpening && `${lead} ${noteOpening}`,
      noteOpening && noteOpening.length >= 80 ? noteOpening : null,
      `${lead} Color values, production history, a photo of the fired glaze and the combinations it sets well with.`,
      lead,
    ]
      .filter(Boolean)
      .find((candidate) => candidate.length >= 70 && candidate.length <= 160) ||
    `${lead} Production years, color values and table-setting combinations.`;

  const schema = [
    {
      '@type': 'WebPage',
      '@id': `${site.baseUrl}/${canonicalPath}#webpage`,
      url: `${site.baseUrl}/${canonicalPath}`,
      name: `Fiesta ${color.color} - ${color.hex}`,
      description: desc,
      isPartOf: { '@id': `${site.baseUrl}/#website` },
      inLanguage: 'en-US',
      breadcrumb: { '@id': `${site.baseUrl}/${canonicalPath}#breadcrumb` },
      primaryImageOfPage: {
        '@type': 'ImageObject',
        contentUrl: `${site.baseUrl}/assets/colors/${color.image}`,
        caption: `Fiesta dinnerware glazed in ${color.color}`,
      },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${site.baseUrl}/${canonicalPath}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Colors', item: `${site.baseUrl}/` },
        {
          '@type': 'ListItem',
          position: 2,
          name: `${color.shadeOf} family`,
          item: `${site.baseUrl}/colors/shade/${color.shadeOf.toLowerCase()}/`,
        },
        { '@type': 'ListItem', position: 3, name: color.color },
      ],
    },
    {
      '@type': 'DefinedTerm',
      '@id': `${site.baseUrl}/${canonicalPath}#color`,
      name: color.color,
      description: color.description,
      url: `${site.baseUrl}/${canonicalPath}`,
      ...(color.sku ? { termCode: color.sku } : {}),
      inDefinedTermSet: { '@id': `${site.baseUrl}/#termset` },
    },
  ];

  return {
    title: `Fiesta ${color.color} - ${color.hex} (${producedLabel(color)})`,
    description: desc,
    body,
    schema,
    navKey: 'colors',
    navExact: false,
    noindex: color.originalWords < (site.content?.minOriginalWords ?? 0),
    depth: 2,
    path: canonicalPath,
    ogImage: `${site.baseUrl}/assets/opt/social/${color.slug}.jpg`,
    ogImageAlt: `Fiesta ${color.color}, ${color.hex}, produced ${producedLabel(color)}.`,
    ogType: 'article',
    scripts: ['assets/js/app.js'],
  };
}

/* -------------------------------------------------------------------------
   History
   ---------------------------------------------------------------------- */

/** Pull a sortable year out of "1840s", "1870-1879", "1936". */
function yearOf(dateLabel) {
  const m = String(dateLabel).match(/\d{4}/);
  return m ? Number(m[0]) : 0;
}

/**
 * Link color names mentioned in a history entry to their color pages.
 *
 * The timeline names dozens of colors and, until now, linked to none of them --
 * 66 entries of prose with no route into the 61 pages it is describing.
 *
 * Two rules keep this honest rather than eager:
 *  - Case-sensitive whole-word matching, so the "yellow ware" of the 1840s and
 *    the "white ware" of the 1870s do not become links to 1936 glazes.
 *  - The entry's year must fall inside the color's production window (±1 year),
 *    which is also what disambiguates the two Turquoises, Roses and Reds.
 */
function linkColorNames(text, entryYear, colors, base, currentYear) {
  const isWordChar = (ch) => ch !== undefined && /[A-Za-z0-9]/.test(ch);

  const candidates = [];
  for (const c of colors) {
    const names = [c.color];
    // "Blue (Cobalt)" and "Green (Light)" appear in prose by their plain names.
    const paren = c.color.match(/^([A-Za-z]+)\s*\(([^)]+)\)$/);
    if (paren) names.push(paren[2], paren[2] + ' ' + paren[1]);
    for (const name of names) candidates.push({ name, color: c });
  }
  // Longest first, so "Sea Mist Green" wins over "Green".
  candidates.sort((a, b) => b.name.length - a.name.length);

  const used = new Set();
  const marks = [];

  for (const { name, color } of candidates) {
    if (used.has(color.slug)) continue;

    const end = color.current ? currentYear : color.endYear;
    if (entryYear < color.startYear - 1 || entryYear > end + 1) continue;

    // Case-sensitive, whole word. "yellow ware" (1840s) must not become a link
    // to the 1936 glaze named Yellow.
    let from = -1;
    let searchAt = 0;
    while (searchAt <= text.length) {
      const found = text.indexOf(name, searchAt);
      if (found === -1) break;
      const before = text[found - 1];
      const after = text[found + name.length];
      if (!isWordChar(before) && !isWordChar(after)) {
        from = found;
        break;
      }
      searchAt = found + 1;
    }
    if (from === -1) continue;

    const to = from + name.length;
    if (marks.some((m) => from < m.to && to > m.from)) continue;

    marks.push({ from, to, color });
    used.add(color.slug);
  }

  if (!marks.length) return esc(text);

  marks.sort((a, b) => a.from - b.from);
  let cursor = 0;
  let html = '';
  for (const mark of marks) {
    html += esc(text.slice(cursor, mark.from));
    // Two Reds, two Roses, two Yellows: without the years in the accessible
    // name, a list of links on this page reads "Red, Red" going to different
    // pages (WCAG 2.4.4).
    const matched = text.slice(mark.from, mark.to).toLowerCase();
    const sharesText = colors.filter(
      (o) =>
        o.color.toLowerCase() === matched ||
        (o.color.match(/^([A-Za-z]+)\s*\(([^)]+)\)$/) || [])[2]?.toLowerCase() === matched
    ).length;
    const years =
      mark.color.ambiguousName || sharesText > 1
        ? `<span class="visually-hidden">, ${producedLabel(mark.color)}</span>`
        : '';
    html +=
      '<a href="' +
      base +
      'colors/' +
      mark.color.slug +
      '/">' +
      esc(text.slice(mark.from, mark.to)) +
      years +
      '</a>';
    cursor = mark.to;
  }
  return html + esc(text.slice(cursor));
}

export function history({ site, data, base = '' }) {
  const entries = [...data.history].sort((a, b) => yearOf(a.date) - yearOf(b.date));

  const decadeSeen = new Set();
  const jump = [];
  const items = entries
    .map((e) => {
      const y = yearOf(e.date);
      const decade = Math.floor(y / 10) * 10;
      const id = `y-${String(e.date).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      if (y && !decadeSeen.has(decade)) {
        decadeSeen.add(decade);
        jump.push({ decade, id });
      }
      // `desc` stays plain text so linkColorNames and verify-facts can both
      // read it. Anything that needs a URL goes in `links` instead.
      const refs = (e.links || []).length
        ? `\n            <ul class="timeline__links">${(e.links || [])
            .map(
              (l) =>
                `<li><a href="${esc(l.url)}" rel="noopener" target="_blank">${esc(l.label)}</a></li>`
            )
            .join('')}</ul>`
        : '';
      return `          <li id="${esc(id)}">
            <h3 class="timeline__date"><a href="#${esc(id)}">${esc(e.date)}</a></h3>
            <p>${linkColorNames(e.desc, y, data.colors, base, data.currentYear)}</p>${refs}
          </li>`;
    })
    .join('\n');

  const jumpHtml = jump
    .map((j) => `<li><a href="#${esc(j.id)}">${j.decade}s</a></li>`)
    .join('\n          ');

  const body = `      <section class="wrap section--tight">
        <p class="eyebrow">Since 1871</p>
        <h1>A history of Fiesta and the company that makes it</h1>
        <div class="prose" style="margin-top:1rem">
          <p>
            Not many companies can point to a run that starts in the 1870s. Fewer still have ended up in
            as many kitchens. This is a working timeline of The Fiesta Tableware Company - formerly
            The Homer Laughlin China Company - from the clay banks of East Liverpool, Ohio through
            ${data.colors.length} colors of Fiesta dinnerware.
          </p>
          <p class="muted">
            Compiled from public company material, collector references and press coverage. It is a work in
            progress; if you spot an error, <a href="${base}contact/">tell me about it</a>.
          </p>
        </div>
      </section>

      <section class="wrap" aria-labelledby="timeline-heading">
        <h2 class="visually-hidden" id="timeline-heading">Timeline</h2>
        <nav aria-label="Jump to a decade">
          <ul class="jump-nav">
          ${jumpHtml}
          </ul>
        </nav>
        <ol class="timeline">
${items}
        </ol>
      </section>

      ${adSlot(site, { format: 'leaderboard' })}

      <section class="section--tight">
${plateStackBand(base)}
      </section>`;

  return {
    title: 'Fiesta Dinnerware History: A Timeline from 1871 to Today',
    description:
      'A year-by-year history of Fiesta dinnerware and The Fiesta Tableware Company (formerly Homer Laughlin China), from East Liverpool yellow ware in the 1840s to today.',
    body,
    navKey: 'history',
    path: 'history.html',
    schema: [
      {
        '@type': 'WebPage',
        '@id': `${site.baseUrl}/history.html#webpage`,
        url: `${site.baseUrl}/history.html`,
        name: 'Fiesta dinnerware history',
        isPartOf: { '@id': `${site.baseUrl}/#website` },
        inLanguage: 'en-US',
      },
    ],
    scripts: ['assets/js/app.js'],
  };
}

/* -------------------------------------------------------------------------
   About / methodology
   ---------------------------------------------------------------------- */

export function about({ site, data, base = '' }) {
  const body = `      <section class="wrap section--tight">
        <p class="eyebrow">About</p>
        <h1>How this guide is built</h1>
      </section>

      <section class="wrap wrap--narrow">
        <div class="prose">
          <p>
            This is an independent reference to the colors of Fiesta dinnerware, kept by
            <a href="${esc(site.author.url)}" rel="noopener" target="_blank">${esc(site.author.name)}</a>.
            It is <strong>not affiliated with, endorsed by, or sponsored by The Fiesta Tableware Company</strong>.
          </p>
          <p>
            I worked at The Fiesta Tableware Company (formerly The Homer Laughlin China Company) from June 2014
            to March 2024, in digital marketing and software roles. My father spent 25 years there and my mother
            worked at Hall China; in this valley that is an ordinary family history rather than a remarkable one.
            This project is a fan's project built entirely from public information, and it deliberately does not
            include anything unannounced.
          </p>

          <h2 id="colors">Where the color values come from</h2>
          <p>
            The Fiesta Tableware Company does not publish hex values for its glazes, so there is no official
            number to copy. Each hex here is a best-effort digital match, built from product photography,
            published reference material and comparison against physical pieces where I have them.
          </p>
          <p>
            That hex is then the single source of truth. Everything else the site derives from a color -
            the CIELAB coordinates behind the closest-color rankings, the pairing suggestions, and the
            black-or-white label chosen for each swatch - is
            <strong>calculated from it at build time</strong> in sRGB with a D65 white point. Nothing is typed
            in twice, and nothing can drift out of step with the swatch beside it.
          </p>
          <div class="callout">
            <p><strong>The honest caveat.</strong> A fired ceramic glaze is not a flat color. It varies with the
            production run, the thickness of the glaze, the shape underneath it and the light you are standing
            in - and then your screen adds its own interpretation. A swatch here will get you close enough
            to identify a piece or plan a table. It will not match a plate exactly, and no hex code could.</p>
          </div>

          <h2 id="dates">Production dates</h2>
          <p>
            Introduction and retirement years come from company announcements, collector references and
            contemporary press. Where sources disagree - and for a few of the vintage colors they do -
            the guide uses the date most commonly cited by the collector community and the timeline on the
            <a href="${base}history.html">history page</a> gives the surrounding context.
          </p>
          <p>
            Colors that were produced in both eras under the same name - Red, Rose, Yellow, Turquoise and
            Chartreuse - get separate entries. The names carried over; the glaze recipes did not.
          </p>

          <h2 id="pairings">How the table-setting combinations are built</h2>
          <p>
            Each color page suggests a handful of combinations. The first, where one exists, is simply the
            pairing <strong>named in that color's own description</strong> - a person wrote that down, so
            it outranks anything a formula produces, and the page labels it as such.
          </p>
          <p>
            The rest are derived, and each one states its rule: opposite hues, a single-family tonal ladder,
            three evenly spaced hues, neighboring hues, or a neutral anchor. Two guards keep them usable.
            Colors closer than &Delta;E&nbsp;12 are never put in the same set, because near-identical glazes
            side by side read as a mistake rather than a choice; and neutrality is measured by
            <strong>LCh chroma, not HSL saturation</strong>, since saturation badly misjudges very light and
            very dark colors - it scores Old Ivory at 43%, when perceptually it is almost colorless.
          </p>
          <p>
            Every combination is made only of colors Fiesta has actually produced, and each swatch says whether
            you can still buy it.
          </p>

          <h2 id="similar">"Closest colors" and &Delta;E</h2>
          <p>
            The closest-color list on each page is computed with <strong>CIEDE2000</strong>, the current
            standard for perceptual color difference. Values under roughly &Delta;E&nbsp;2 are near-identical to
            the eye, under &Delta;E&nbsp;5 are easy to confuse side by side, and above &Delta;E&nbsp;10 read as
            clearly different colors. It is calculated from the hex values, so it inherits their caveats -
            but it is a genuinely useful first pass when you are trying to tell two blues apart.
          </p>

          <h2 id="data">How this site is built</h2>
          <p>
            Every page here is generated from a single dataset I maintain by hand - colors,
            production years, color numbers, shade families and the company timeline. Nothing on
            this site is typed twice, which is the only reason the dates stay consistent across
            ${data.colors.length} colors.
          </p>
          <p>
            Corrections are genuinely welcome, and they are the fastest way to make this better.
            If a date or a color looks wrong to you,
            <a href="${base}contact/">send it to me</a>.
          </p>

          <h2 id="accessibility">Accessibility</h2>
          <p>
            This site targets <strong>WCAG&nbsp;2.2 level AA</strong>. Color is never the only way information is
            conveyed: every swatch carries its name and hex code as text, every band in the color ribbon is a
            real link with a real name, and every filter is reachable and operable by keyboard. Text meets AA
            contrast in both light and dark themes, the theme follows your system setting unless you override it,
            and animation respects <code>prefers-reduced-motion</code>.
          </p>
          <p>
            If something here does not work with your assistive technology, that is a bug I want to hear about
            - please <a href="${base}contact/">report it</a>.
          </p>

          <h2 id="sources">Sources</h2>
          <ul>
            <li><a href="https://www.post86referenceguide.com/home/colortimeline/" rel="noopener nofollow" target="_blank">Post 86 Reference Guide - color timeline</a></li>
            <li><a href="https://www.ftcco.org/" rel="noopener nofollow" target="_blank">Fiesta Tableware Company Collectors Organization</a></li>
            <li><a href="https://www.hlcca.org/" rel="noopener nofollow" target="_blank">Homer Laughlin China Collectors Association</a></li>
            <li><a href="https://www.texascooking.com/fiestaware/" rel="noopener nofollow" target="_blank">Texas Cooking - Fiestaware</a></li>
            <li><a href="https://en.wikipedia.org/wiki/Fiesta_(dinnerware)" rel="noopener nofollow" target="_blank">Wikipedia - Fiesta (dinnerware)</a></li>
            <li><a href="https://fiestadocumentary.com/links.html" rel="noopener nofollow" target="_blank">DISHES: a Fiesta documentary</a></li>
            <li><a href="https://fiestatableware.com" rel="noopener nofollow" target="_blank">The Fiesta Tableware Company</a></li>
          </ul>

          <h2 id="trademark">Trademark and images</h2>
          <p>
            Fiesta<sup>&reg;</sup> is a registered trademark of The Fiesta Tableware Company. Color names and
            product photographs are used here for identification and reference. This guide makes no claim to
            those marks, and nothing here should be read as an official statement from the company. If you are
            looking to buy, go to
            <a href="https://fiestafactorydirect.com" rel="noopener nofollow" target="_blank">Fiesta Factory Direct</a>.
          </p>
        </div>
      </section>

      <section class="wrap section--tight">
        <picture>
          <source type="image/webp" srcset="${base}assets/opt/features-1040.webp">
          <img src="${base}assets/images/FeaturesBenefits.jpg" width="1500" height="1500" loading="lazy" decoding="async"
               style="max-width:520px;margin-inline:auto;border-radius:var(--radius-lg)"
               alt="Fiesta features: made in the USA since 1936, five-year limited chip replacement, oven safe to 350 degrees, lead safe, microwave safe and dishwasher safe.">
        </picture>
      </section>`;

  return {
    title: 'About the Fiesta Color Guide - Sources, Method and Accuracy',
    description:
      'How this guide is built: where the hex values come from, how production dates are sourced, how color matches are calculated, and what accuracy to expect.',
    body,
    navKey: 'about',
    path: 'about.html',
    schema: [
      {
        '@type': 'AboutPage',
        '@id': `${site.baseUrl}/about.html#webpage`,
        url: `${site.baseUrl}/about.html`,
        name: 'About the Fiesta Color Guide',
        isPartOf: { '@id': `${site.baseUrl}/#website` },
        inLanguage: 'en-US',
      },
    ],
    scripts: ['assets/js/app.js'],
  };
}

/* -------------------------------------------------------------------------
   Privacy (required before AdSense review)
   ---------------------------------------------------------------------- */

export function privacy({ site, base = '', updated }) {
  const body = `      <section class="wrap section--tight">
        <p class="eyebrow">Updated ${esc(updated)}</p>
        <h1>Privacy</h1>
        <p class="hero__lede" style="margin-top:1rem">
          The short version: this is a hobby site about dinnerware. It has no accounts, no
          newsletter and nothing to sell you. There is one contact form, and it only sees what you
          choose to type into it. Otherwise this site does not want your data and has no use for it.
        </p>
      </section>

      <section class="wrap wrap--narrow">
        <div class="prose">
          <h2 id="device">What is stored on your device</h2>
          <p>
            One thing, and only if you use it: your light or dark theme preference is saved in your
            browser's <code>localStorage</code> under the key <code>fcg-theme</code>. It stays on
            your device, is never transmitted anywhere, and clearing your site data removes it.
            There is no login, no profile and no shopping cart, so there is nothing else to store.
          </p>

          <h2 id="analytics">Google Analytics</h2>
          <p>
            This site uses Google Analytics 4 to count visits and see which colors people look at.
            That is the entire purpose - it tells me that four hundred people read the page
            about Medium Green last month, not who any of them are.
          </p>
          <p>
            <strong>GA4 anonymizes IP addresses by default.</strong> Google truncates the address
            before it is stored, and nothing on this site turns that off. I would rather be precise
            than reassuring, though: anonymized IPs are not the same as no data at all. GA4 still
            records approximate region, device type, browser, referring page and which pages were
            visited, and it sets cookies to recognise a returning browser. None of that is joined to
            a name here, and none of it is sold, shared or exported by me to anyone.
          </p>
          <div class="callout">
            <p><strong>To opt out entirely</strong>, install Google's official
            <a href="https://tools.google.com/dlpage/gaoptout" rel="noopener nofollow" target="_blank">Google
            Analytics Opt-out Browser Add-on</a>. It works across every site using Analytics, not
            just this one. A content blocker or a browser with tracking protection does the same job.</p>
            <p>Nothing here breaks if you block it. Every page is static HTML and works with scripts
            disabled entirely.</p>
          </div>

          <h2 id="advertising">Advertising</h2>
          <p>
            This site uses Google AdSense. Google's ad script loads on every page here, and may set
            cookies and show ads whether or not a particular page has an ad slot placed on it. Where
            ads are shown:
          </p>
          <ul>
            <li>Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this or other websites.</li>
            <li>Google's use of advertising cookies enables it and its partners to serve ads to you based on your visit to this and/or other sites on the Internet.</li>
            <li>You may opt out of personalised advertising by visiting <a href="https://www.google.com/settings/ads" rel="noopener nofollow" target="_blank">Google Ads Settings</a>.</li>
            <li>You can opt out of a third-party vendor's use of cookies for personalised advertising at <a href="https://www.aboutads.info/choices/" rel="noopener nofollow" target="_blank">aboutads.info/choices</a> or <a href="https://www.youronlinechoices.com/" rel="noopener nofollow" target="_blank">youronlinechoices.com</a>.</li>
          </ul>

          <h2 id="position">Where I stand</h2>
          <p>
            I believe in the Constitution of the United States, and in the plain idea behind the
            Fourth Amendment: that people are entitled to go about their lives without being
            catalogued by default. Running analytics on a dinnerware site is a long way from a search
            and seizure, and I am not going to pretend otherwise. But the principle scales down as
            well as up, and the least I can do on my own website is collect nothing I do not need,
            hand nothing over, and tell you plainly what is happening.
          </p>
          <p>
            The opt-out above is a real control, and I would rather you used it than not. It does not
            solve the whole situation - no single setting does - but it covers most of the
            bases that are mine to cover.
          </p>

          <h2 id="awareness">A note that has nothing to do with dinnerware</h2>
          <p>
            While we are on the subject: the tracking that worries me is not the kind that counts page
            views. Automated licence plate readers are now installed across a great many American
            towns, photographing vehicles and logging where they were and when - often without a
            public vote, and often without residents knowing they are there.
            <a href="https://deflock.me" rel="noopener nofollow" target="_blank">DeFlock</a> maps where
            those cameras have been found and documents how the systems work.
          </p>
          <p>
            Whatever you make of it, it is worth knowing whether your own town has them. That strikes
            me as a thing to stay awake to as our children grow up inside it - rather more than a
            cookie remembering you prefer dark mode.
          </p>

          <h2 id="third-party">Third-party links</h2>
          <p>
            Pages here link to retailers, collector organizations and the company's own sites. Those
            sites have their own privacy policies, and this one does not cover them.
          </p>
          <p>
            That includes the "Buy Fiesta" links. They are plain links to the factory's own store -
            no affiliate code, no referral tag, nothing that tells them you came from here and
            nothing that pays me if you buy. They are there because I would rather the pottery
            stayed open.
          </p>

          <h2 id="children">Children</h2>
          <p>
            This site is not directed at children under 13 and does not knowingly collect information
            from them.
          </p>

          <h2 id="rights">Your rights</h2>
          <p>
            If you are in the EEA, the UK or California, you have rights over personal data held about
            you. Because this site holds none of its own, requests about analytics or advertising data
            should go to Google, whose policies are at
            <a href="https://policies.google.com/privacy" rel="noopener nofollow" target="_blank">policies.google.com/privacy</a>.
          </p>

          <h2 id="questions">Questions</h2>
          <p>
            <a href="${base}contact/">Send me a message</a>, or reach me through
            <a href="${esc(site.author.url)}" rel="noopener" target="_blank">${esc(site.author.url)}</a>.
          </p>
        </div>
      </section>`;

  return {
    title: 'Privacy - The Unofficial Fiesta Color Guide',
    description:
      'What this site stores, what Google Analytics collects and how it is anonymized, how to opt out of it completely, and how advertising cookies are used.',
    body,
    navKey: '',
    path: 'privacy.html',
    scripts: ['assets/js/app.js'],
  };
}

/* -------------------------------------------------------------------------
   404
   ---------------------------------------------------------------------- */

export function notFound({ site, data, base = '' }) {
  const picks = data.current.slice(0, 6);
  const body = `      <section class="wrap section" style="text-align:center">
        <p class="eyebrow">404</p>
        <h1>That page is retired</h1>
        <p class="hero__lede" style="margin:1rem auto 0">
          The color or page you were looking for is not here. All ${data.colors.length} Fiesta colors are, though.
        </p>
        <p style="margin-top:1.75rem">
          <a class="btn btn--primary" href="${base || './'}">Browse every color</a>
        </p>
      </section>

      <section class="wrap section--tight">
        <div class="section-head"><div><h2>In production right now</h2></div></div>
        <ul class="related-strip">
${picks.map((c) => relatedCard(c, base, producedLabel(c))).join('\n')}
        </ul>
      </section>`;

  return {
    title: 'Page not found - The Unofficial Fiesta Color Guide',
    description: 'That page could not be found. Browse every Fiesta dinnerware color instead.',
    body,
    navKey: '',
    path: '404.html',
    noindex: true,
    scripts: ['assets/js/app.js'],
  };
}

/* -------------------------------------------------------------------------
   Hub pages

   "Fiesta blue colors" and "vintage Fiesta colors" are real searches, and a
   `?shade=blue` query parameter is not something a search engine will index or
   rank -- it canonicalises straight back to the homepage. These give each
   facet a genuine URL with its own copy, its own title and its own place in
   the breadcrumb trail.
   ---------------------------------------------------------------------- */

/** Prose for a shade family, written from the data rather than boilerplate. */
function shadeIntro(shade, colors, currentYear, base) {
  const inProduction = colors.filter((c) => c.current);
  const oldest = colors[0];
  const newest = colors[colors.length - 1];
  const lightest = [...colors].sort((a, b) => b.derived.hsl.l - a.derived.hsl.l)[0];
  const darkest = [...colors].sort((a, b) => a.derived.hsl.l - b.derived.hsl.l)[0];
  const longest = [...colors].sort(
    (a, b) => (b.current ? currentYear : b.endYear) - b.startYear - ((a.current ? currentYear : a.endYear) - a.startYear)
  )[0];

  return `Fiesta has used <strong>${colors.length}</strong> ${shade.toLowerCase()} glaze${
    colors.length === 1 ? '' : 's'
  } since ${oldest.startYear}, starting with
    <a href="${base}colors/${oldest.slug}/">${esc(oldest.color)}${disambiguate(oldest)}</a> and most recently
    <a href="${base}colors/${newest.slug}/">${esc(newest.color)}${disambiguate(newest)}</a> in ${newest.startYear}.
    ${
      inProduction.length
        ? `${inProduction.length} ${inProduction.length === 1 ? 'is' : 'are'} in production today: ${inProduction
            .map((c) => `<a href="${base}colors/${c.slug}/">${esc(c.color)}${disambiguate(c)}</a>`)
            .join(', ')}.`
        : 'None are in production today.'
    }
    ${
      colors.length > 2
        ? `They run from <a href="${base}colors/${lightest.slug}/">${esc(lightest.color)}${disambiguate(lightest)}</a> at the
           light end to <a href="${base}colors/${darkest.slug}/">${esc(darkest.color)}${disambiguate(darkest)}</a> at the dark end;
           <a href="${base}colors/${longest.slug}/">${esc(longest.color)}${disambiguate(longest)}</a> has had the longest run of
           any ${shade.toLowerCase()}.`
        : ''
    }`;
}

export function shadeHub({ site, data, shade, base = '../../../' }) {
  const { currentYear } = data;
  const colors = data.timeline.filter((c) => c.shadeOf === shade);
  const slug = shade.toLowerCase();
  const path = `colors/shade/${slug}/`;

  // A hub with no written intro is a filtered view of the homepage. Useful to
  // navigate, but not something to ask Google to index as a page of its own.
  const note = (data.shadeNotes || {})[shade];
  const noteWords = note ? String(note).split(/\s+/).filter(Boolean).length : 0;

  const cards = colors
    .map((c, i) => colorCard(c, base, currentYear, { index: i, eager: i < 4 }))
    .join('\n');

  const body = `      <div class="wrap breadcrumb">
        <nav aria-label="Breadcrumb">
          <ol>
            <li><a href="${base}">Colors</a></li>
            <li aria-current="page">${esc(shade)}</li>
          </ol>
        </nav>
      </div>

      <section class="wrap section--tight">
        <p class="eyebrow">Shade family</p>
        <h1>Fiesta ${esc(shade.toLowerCase())} colors</h1>
        ${
          note
            ? `<p class="hero__lede" style="margin-top:1rem">${esc(note)}</p>
        <p class="muted" style="margin-top:1rem;max-width:var(--measure)">${shadeIntro(
          shade,
          colors,
          currentYear,
          base
        )}</p>`
            : `<p class="hero__lede" style="margin-top:1rem">${shadeIntro(shade, colors, currentYear, base)}</p>`
        }
      </section>

      <section class="wrap section--tight" aria-labelledby="grid-heading">
        <h2 class="visually-hidden" id="grid-heading">All ${esc(shade.toLowerCase())} colors</h2>
        <ul class="color-grid">
${cards}
        </ul>
      </section>

      ${adSlot(site, { format: 'leaderboard' })}

      <section class="wrap section--tight" aria-labelledby="other-heading">
        <div class="section-head"><div><h2 id="other-heading">Other shade families</h2></div></div>
        <ul class="related-strip">
${data.shades
  .filter((s) => s !== shade)
  .map((s) => {
    const family = data.timeline.filter((c) => c.shadeOf === s);
    const pick = family.filter((c) => c.current).pop() || family[family.length - 1];
    return `        <li>
          <a class="related-card" href="${base}colors/shade/${s.toLowerCase()}/">
            <span class="related-card__swatch" style="background-color:${esc(pick.hex)}"></span>
            <span class="related-card__body">
              <span class="related-card__name">${esc(s)}<span class="visually-hidden"> family</span></span>
              <span class="related-card__meta">${family.length} color${family.length === 1 ? '' : 's'}</span>
            </span>
          </a>
        </li>`;
  })
  .join('\n')}
        </ul>
      </section>

      <section class="wrap section--tight">
        <div class="callout">
          <p><strong>${esc(shade)} is Fiesta's own grouping, not a measurement.</strong>
          Sorted by hue angle instead, some colors land in a different band than their name
          suggests. <a href="${base}colors/rainbow/">See the whole palette sorted by the
          rainbow &rarr;</a></p>
        </div>
      </section>

      <div class="wrap section--tight">${disclaimer(base)}</div>`;

  return {
    title: `Fiesta ${shade} Colors - All ${colors.length}, ${colors[0].startYear} to Today`,
    description: `Every ${shade.toLowerCase()} Fiesta dinnerware color - ${colors.length} glazes from ${
      colors[0].startYear
    } onward, with hex codes, production years and photos of the fired glaze.`,
    body,
    navKey: 'colors',
    navExact: false,
    noindex: site.content?.requireShadeNotes ? noteWords === 0 : false,
    depth: 3,
    path,
    scripts: ['assets/js/app.js'],
    schema: [
      {
        '@type': 'CollectionPage',
        '@id': `${site.baseUrl}/${path}#webpage`,
        url: `${site.baseUrl}/${path}`,
        name: `Fiesta ${shade.toLowerCase()} colors`,
        isPartOf: { '@id': `${site.baseUrl}/#website` },
        inLanguage: 'en-US',
        breadcrumb: { '@id': `${site.baseUrl}/${path}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${site.baseUrl}/${path}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Colors', item: `${site.baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: `${shade} family` },
        ],
      },
      {
        '@type': 'ItemList',
        '@id': `${site.baseUrl}/${path}#list`,
        numberOfItems: colors.length,
        itemListElement: colors.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.color,
          url: `${site.baseUrl}/colors/${c.slug}/`,
        })),
      },
    ],
  };
}

/**
 * Era hub copy.
 *
 * Built from the data rather than written out, because a title like
 * "All 14, With Hex Codes" is a promise that quietly breaks the first time a
 * color is added. Counts and boundary years both come from fiesta.json.
 */
function eraMeta(data) {
  const { eras, firstYear, vintage, post86, current } = data;

  return {
    vintage: {
      slug: eras.vintage.slug,
      colors: vintage,
      heading: `Vintage Fiesta colors, ${eras.vintage.start}-${eras.vintage.end}`,
      title: `Vintage Fiesta Colors (${eras.vintage.start}-${eras.vintage.end}) - All ${vintage.length}`,
      eyebrow: 'The original run',
      lede: `The colors of the original Fiesta line, from its debut at the Pittsburgh China &amp; Glass Show in
        January ${firstYear} to the retirement of the line in 1973. These pieces predate Fiesta's color numbering
        entirely, so a vintage color is identified by its name, its shape and its glaze - never by a number
        on the back.`,
      description: `All ${vintage.length} vintage Fiesta colors from ${eras.vintage.start} to ${eras.vintage.end}, with production years, photos of the fired glaze and the combinations they were made to sit alongside.`,
    },
    post86: {
      slug: eras.post86.slug,
      colors: post86,
      heading: `Post 86 Fiesta colors, ${eras.post86.start} to today`,
      title: `Post 86 Fiesta Colors - All ${post86.length} Since the ${eras.post86.start} Relaunch`,
      eyebrow: 'The modern line',
      lede: `Fiesta returned in March ${eras.post86.start} for its 50th anniversary, in a vitrified, lead-free body
        with an updated palette. Collectors call everything from that point on "Post 86." Each of these carries a
        color number, which is the fastest way to identify a modern piece.`,
      description: `All ${post86.length} Post 86 Fiesta colors made since the ${eras.post86.start} relaunch, with color numbers, production years and the colors each one pairs with.`,
    },
    current: {
      slug: 'in-production',
      colors: current,
      heading: 'Fiesta colors in production right now',
      title: `Current Fiesta Colors - All ${current.length} In Production Now`,
      eyebrow: 'Available today',
      lede: `The colors The Fiesta Tableware Company is making today. Fiesta typically introduces one new color
        each year and retires one or more at the same time, so this list changes every spring - which is
        exactly why a retired color becomes worth hunting for.`,
      description: `The ${current.length} Fiesta dinnerware colors in production today, with color numbers, photos and the combinations they set well with.`,
    },
  };
}

export function eraHub({ site, data, era, base = '../../../' }) {
  const meta = eraMeta(data)[era];
  const colors = meta.colors;
  const path = `colors/era/${meta.slug}/`;
  const { currentYear } = data;

  const cards = colors
    .map((c, i) => colorCard(c, base, currentYear, { index: i, eager: i < 4 }))
    .join('\n');

  const others = Object.entries(eraMeta(data)).filter(([key]) => key !== era);

  const body = `      <div class="wrap breadcrumb">
        <nav aria-label="Breadcrumb">
          <ol>
            <li><a href="${base}">Colors</a></li>
            <li aria-current="page">${esc(meta.heading)}</li>
          </ol>
        </nav>
      </div>

      <section class="wrap section--tight">
        <p class="eyebrow">${esc(meta.eyebrow)}</p>
        <h1>${meta.heading}</h1>
        <p class="hero__lede" style="margin-top:1rem">${meta.lede}</p>
        <dl class="stats" style="max-width:36rem">
          <div class="stat"><dd>${colors.length}</dd><dt>colors</dt></div>
          <div class="stat"><dd>${colors[0].startYear}</dd><dt>first introduced</dt></div>
          <div class="stat"><dd>${colors[colors.length - 1].startYear}</dd><dt>most recent</dt></div>
        </dl>
      </section>

      <section class="wrap section--tight" aria-labelledby="grid-heading">
        <h2 class="visually-hidden" id="grid-heading">${esc(meta.heading)}</h2>
        <ul class="color-grid">
${cards}
        </ul>
      </section>

      ${adSlot(site, { format: 'leaderboard' })}

      <section class="wrap section--tight" aria-labelledby="other-heading">
        <div class="section-head"><div><h2 id="other-heading">Browse another way</h2></div></div>
        <ul class="link-list">
${others
  .map(
    ([key, m]) =>
      `          <li><a href="${base}colors/era/${m.slug}/">${esc(m.heading)}</a></li>`
  )
  .join('\n')}
${data.shades
  .map(
    (s) =>
      `          <li><a href="${base}colors/shade/${s.toLowerCase()}/">Fiesta ${esc(
        s.toLowerCase()
      )} colors</a></li>`
  )
  .join('\n')}
        </ul>
      </section>

      <div class="wrap section--tight">
        <p class="muted"><a href="${base}colors/rainbow/">Or see every color sorted by the
        rainbow (ROYGBIV) &rarr;</a></p>
      </div>

      <div class="wrap section--tight">${disclaimer(base)}</div>`;

  return {
    title: meta.title,
    description: meta.description,
    body,
    navKey: 'colors',
    navExact: false,
    depth: 3,
    path,
    scripts: ['assets/js/app.js'],
    schema: [
      {
        '@type': 'CollectionPage',
        '@id': `${site.baseUrl}/${path}#webpage`,
        url: `${site.baseUrl}/${path}`,
        name: meta.heading,
        isPartOf: { '@id': `${site.baseUrl}/#website` },
        inLanguage: 'en-US',
        breadcrumb: { '@id': `${site.baseUrl}/${path}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${site.baseUrl}/${path}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Colors', item: `${site.baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: meta.heading },
        ],
      },
      {
        '@type': 'ItemList',
        '@id': `${site.baseUrl}/${path}#list`,
        numberOfItems: colors.length,
        itemListElement: colors.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.color,
          url: `${site.baseUrl}/colors/${c.slug}/`,
        })),
      },
    ],
  };
}

export { eraMeta };

/* -------------------------------------------------------------------------
   ROYGBIV

   One page, not seven. Seven thin pages of color psychology would be
   indistinguishable from every other color-meaning listicle on the internet;
   one page that sorts a real 61-glaze palette by measured hue is something no
   other site can publish, because no other site has the palette.

   The associations are stated as design and marketing convention -- which is
   observable and true -- rather than as claims about human physiology, which
   are not well supported and would undercut everything else the site says.
   ---------------------------------------------------------------------- */

export function rainbow({ site, data, base = '../../' }) {
  const { bands, neutrals } = spectrum(data.colors);
  const path = 'colors/rainbow/';

  const swatchList = (items) =>
    items.length
      ? `          <ul class="related-strip">
${items
  .map(({ color, disagrees, byEye }) =>
    relatedCard(
      color,
      base,
      `${producedLabel(color)}${
        byEye
          ? ' &middot; <em>placed by eye</em>'
          : disagrees
            ? ` &middot; <em>named ${esc(color.shadeOf.toLowerCase())}</em>`
            : ''
      }`
    )
  )
  .join('\n')}
          </ul>`
      : '          <p class="muted">Fiesta has never made a glaze that measures into this band.</p>';

  const bandSections = bands
    .map((band) => {
      const byEye = band.colors.filter((c) => c.byEye);
      const eyeNote = byEye.length
        ? byEye
            .map(
              (e) =>
                `<p class="callout" style="margin-top:1rem"><strong><a href="${base}colors/${
                  e.color.slug
                }/">${esc(e.color.color)}</a> is here by eye, not by angle.</strong> ${esc(
                  e.byEye
                )}</p>`
            )
            .join('\n')
        : '';

      const odd = band.colors.filter((c) => c.disagrees);
      const oddNote = odd.length
        ? `<p class="callout" style="margin-top:1rem">Measured by hue, ${odd
            .map(
              (o) =>
                `<a href="${base}colors/${o.color.slug}/">${esc(
                  o.color.color
                )}</a> (${o.color.derived.hsl.h.toFixed(0)}&deg;)`
            )
            .join(', ')} ${odd.length === 1 ? 'lands' : 'land'} here, though ${
            odd.length === 1 ? 'its name says' : 'their names say'
          } otherwise.</p>`
        : '';

      return `        <section class="wrap section--tight" aria-labelledby="band-${band.key}">
          <div class="section-head">
            <div>
              <p class="eyebrow">${band.letter} &middot; ${band.from}&deg;-${band.to}&deg;
                &middot; ${band.colors.length} Fiesta ${band.colors.length === 1 ? 'color' : 'colors'}</p>
              <h2 id="band-${band.key}">${band.name}</h2>
            </div>
          </div>
          <div class="prose" style="margin-bottom:1.25rem">
            <p>${band.meaning}</p>
            <p class="muted"><strong>Brands that lean on it:</strong> ${band.brands}<br>
              <strong>On a table:</strong> ${band.onTable}</p>
          </div>
${swatchList(band.colors)}
          ${oddNote}
          ${eyeNote}
        </section>`;
    })
    .join('\n');

  const body = `      <div class="wrap breadcrumb">
        <nav aria-label="Breadcrumb">
          <ol>
            <li><a href="${base}">Colors</a></li>
            <li aria-current="page">ROYGBIV</li>
          </ol>
        </nav>
      </div>

      <section class="wrap section--tight">
        <p class="eyebrow">Red, Orange, Yellow, Green, Blue, Indigo, Violet</p>
        <h1>ROYGBIV, and where every Fiesta color actually falls</h1>
        <p class="hero__lede" style="margin-top:1rem">
          ROYGBIV is the acronym for the seven colors Newton named in the spectrum. Sorting
          Fiesta's ${data.colors.length} glazes into those bands by <strong>measured hue angle</strong>
          rather than by the name on the box turns up some surprises - several colors do not
          sit where their names put them.
        </p>
        <div class="prose" style="margin-top:1.25rem">
          <p>
            Each glaze below is placed by the hue of its hex value, using the conventional band
            boundaries printed with each section. Colors carrying almost no hue - the whites,
            grays and blacks - are listed separately at the end, because putting them on a
            rainbow would be arbitrary.
          </p>
          <p>
            Two caveats worth stating. Newton's seven bands are a convention, not a natural
            division: indigo occupies barely twenty degrees, and he arguably added it to make the
            count match the notes of a scale. And the meanings below are conventions of design and
            marketing, which are observable, rather than claims about what colors do to your
            nervous system, which are not well supported.
          </p>
          <p>
            One more, and it is the honest one. A hue angle is precise, but precision is not the
            same thing as being right. Pale colors are the worst offenders: wash enough color out
            of something and people stop naming it by wavelength and start naming it by family.
            Where the number and my eye genuinely disagree I have said so on the swatch and given
            the reason, with the measurement printed alongside so you can take the other side.
            Anyone who has argued with their spouse about whether a shirt is mustard or dark gold
            already knows how this goes.
          </p>
        </div>
      </section>

${bandSections}

      <section class="wrap section--tight" aria-labelledby="neutrals-heading">
        <div class="section-head">
          <div>
            <p class="eyebrow">No band &middot; ${neutrals.length} colors</p>
            <h2 id="neutrals-heading">The ones with no place on the rainbow</h2>
          </div>
        </div>
        <div class="prose" style="margin-bottom:1.25rem">
          <p>
            These carry so little chroma that their hue angle is meaningless - a measurement
            of almost nothing. They are the grounds the rest of the palette sits on, and Fiesta has
            always kept at least one in production.
          </p>
        </div>
        <ul class="related-strip">
${neutrals.map((c) => relatedCard(c, base, producedLabel(c))).join('\n')}
        </ul>
      </section>

      ${adSlot(site, { format: 'leaderboard' })}

      <section class="wrap section--tight" aria-labelledby="families-heading">
        <div class="section-head">
          <div>
            <h2 id="families-heading">Browse by Fiesta's own families instead</h2>
            <p>
              The company groups its colors by name rather than by hue angle. Those groupings are
              the ones used everywhere else on this site.
            </p>
          </div>
        </div>
        <ul class="link-list">
${data.shades
  .map(
    (s) =>
      `          <li><a href="${base}colors/shade/${s.toLowerCase()}/">Fiesta ${esc(
        s.toLowerCase()
      )} colors</a></li>`
  )
  .join('\n')}
        </ul>
      </section>

      <div class="wrap section--tight">${disclaimer(base)}</div>`;

  return {
    title: 'ROYGBIV: Every Fiesta Color Sorted by the Rainbow',
    description: `All ${data.colors.length} Fiesta glazes sorted into the seven ROYGBIV bands by measured hue, with what each color conventionally means and where the names disagree with the spectrum.`,
    body,
    navKey: 'rainbow',
    depth: 2,
    path,
    scripts: ['assets/js/app.js'],
    schema: [
      {
        '@type': 'CollectionPage',
        '@id': `${site.baseUrl}/${path}#webpage`,
        url: `${site.baseUrl}/${path}`,
        name: 'ROYGBIV and the Fiesta palette',
        isPartOf: { '@id': `${site.baseUrl}/#website` },
        inLanguage: 'en-US',
        breadcrumb: { '@id': `${site.baseUrl}/${path}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${site.baseUrl}/${path}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Colors', item: `${site.baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'ROYGBIV' },
        ],
      },
    ],
  };
}

/* -------------------------------------------------------------------------
   Guides

   Long-form articles. These are the pages where a person is talking rather
   than a template, which is the whole reason they exist: a site built from a
   dataset reads like a dataset, however good the dataset is.

   Nothing here is generated from fiesta.json. A guide is one file in
   src/content/guides/, and adding another is one file and nothing else.
   ---------------------------------------------------------------------- */

export function guidePage({ site, data, guide, base = '../../' }) {
  const path = `guides/${guide.slug}/`;

  const toc = guide.sections
    .map((s) => `            <li><a href="#${esc(s.id)}">${esc(s.heading)}</a></li>`)
    .join('\n');

  const sections = guide.sections
    .map(
      (s) => `        <section class="wrap wrap--narrow section--tight" aria-labelledby="${esc(s.id)}">
          <h2 id="${esc(s.id)}">${esc(s.heading)}</h2>
          <div class="prose">${s.html}</div>
        </section>`
    )
    .join('\n');

  const sources = guide.sources?.length
    ? `        <section class="wrap wrap--narrow section--tight" aria-labelledby="sources-heading">
          <h2 id="sources-heading">Sources</h2>
          <div class="prose">
            <ul>
${guide.sources
  .map(
    (s) =>
      `              <li><a href="${esc(s.url)}" rel="noopener nofollow" target="_blank">${esc(
        s.label
      )}</a></li>`
  )
  .join('\n')}
            </ul>
          </div>
        </section>`
    : '';

  const body = `      <div class="wrap breadcrumb">
        <nav aria-label="Breadcrumb">
          <ol>
            <li><a href="${base}">Colors</a></li>
            <li><a href="${base}guides/">Guides</a></li>
            <li aria-current="page">${esc(guide.navTitle || guide.title)}</li>
          </ol>
        </nav>
      </div>

      <article>
        <section class="wrap wrap--narrow section--tight">
          <p class="eyebrow">Guide &middot; ${guide.readingMinutes} min read &middot; updated ${esc(
            guide.updated
          )}</p>
          <h1>${esc(guide.title)}</h1>
          <p class="hero__lede" style="margin-top:1rem">${esc(guide.standfirst.replace(/\s+/g, ' ').trim())}</p>
          <p class="muted" style="margin-top:1rem">
            By <a href="${esc(site.author.url)}" rel="noopener" target="_blank">${esc(site.author.name)}</a>,
            who worked at The Fiesta Tableware Company from 2014 to 2024.
          </p>
        </section>

        <section class="wrap wrap--narrow section--tight" aria-labelledby="contents-heading">
          <div class="callout">
            <h2 id="contents-heading" style="font-size:var(--step-0);margin-bottom:0.5rem">On this page</h2>
            <ol style="margin:0;padding-left:1.2rem">
${toc}
            </ol>
          </div>
        </section>

${sections}

        ${adSlot(site, { format: 'leaderboard' })}

${sources}

        <section class="wrap wrap--narrow section--tight">
          <div class="callout">
            <p><strong>Spotted something wrong?</strong> Corrections are genuinely welcome, dates
            and marks especially.
            <a href="${base}contact/">Tell me</a> and I will fix it.</p>
          </div>
        </section>
      </article>`;

  return {
    title: guide.title,
    description: guide.description,
    body,
    navKey: 'guides',
    depth: 2,
    path,
    scripts: ['assets/js/app.js'],
    schema: [
      {
        '@type': 'Article',
        '@id': `${site.baseUrl}/${path}#article`,
        url: `${site.baseUrl}/${path}`,
        headline: guide.title,
        description: guide.description,
        dateModified: guide.updated,
        inLanguage: 'en-US',
        isPartOf: { '@id': `${site.baseUrl}/#website` },
        author: { '@id': `${site.baseUrl}/#person` },
        publisher: { '@id': `${site.baseUrl}/#person` },
        mainEntityOfPage: `${site.baseUrl}/${path}`,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${site.baseUrl}/${path}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Colors', item: `${site.baseUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Guides', item: `${site.baseUrl}/guides/` },
          { '@type': 'ListItem', position: 3, name: guide.navTitle || guide.title },
        ],
      },
    ],
  };
}

export function guideIndex({ site, data, guides, base = '../' }) {
  const path = 'guides/';

  const cards = guides
    .map(
      (g) => `          <li>
            <a class="related-card" href="${base}guides/${esc(g.slug)}/" style="padding:1.1rem 1.2rem">
              <span class="related-card__name" style="font-size:var(--step-1)">${esc(g.title)}</span>
              <span class="related-card__meta" style="margin-top:0.5rem">${esc(
                g.description
              )}</span>
              <span class="related-card__meta" style="margin-top:0.6rem">${
                g.readingMinutes
              } min read &middot; updated ${esc(g.updated)}</span>
            </a>
          </li>`
    )
    .join('\n');

  const body = `      <div class="wrap breadcrumb">
        <nav aria-label="Breadcrumb">
          <ol>
            <li><a href="${base}">Colors</a></li>
            <li aria-current="page">Guides</li>
          </ol>
        </nav>
      </div>

      <section class="wrap wrap--narrow section--tight">
        <p class="eyebrow">Written, not generated</p>
        <h1>Guides</h1>
        <p class="hero__lede" style="margin-top:1rem">
          The rest of this site is a database: ${data.colors.length} colors, their years, their
          numbers and how they relate. These are the pages where someone who worked at the pottery
          explains the things a database cannot.
        </p>
      </section>

      <section class="wrap wrap--narrow section--tight">
        <ul class="related-strip" style="grid-template-columns:1fr">
${cards}
        </ul>
      </section>`;

  return {
    title: 'Fiesta Guides: Identifying, Dating and Collecting',
    description: `Long-form guides to Fiesta dinnerware from someone who worked at the pottery: how to read a backstamp, date a piece and tell the eras apart.`,
    body,
    navKey: 'guides',
    navExact: true,
    depth: 1,
    path,
    scripts: ['assets/js/app.js'],
    schema: [
      {
        '@type': 'CollectionPage',
        '@id': `${site.baseUrl}/${path}#webpage`,
        url: `${site.baseUrl}/${path}`,
        name: 'Fiesta guides',
        isPartOf: { '@id': `${site.baseUrl}/#website` },
        inLanguage: 'en-US',
      },
    ],
  };
}

/* -------------------------------------------------------------------------
   Contact

   This replaced a set of "open an issue on GitHub" links. Those were fine for
   the handful of people who know what GitHub is and useless to everyone else,
   which on a dinnerware site is almost everyone.

   The form markup depends on site.config.json -> contact.provider, because the
   right answer depends on who is serving the site. Netlify Forms are handled by
   Netlify's edge; on any other host the POST goes nowhere and the message is
   lost silently, which is worse than no form at all.
   ---------------------------------------------------------------------- */

export function contact({ site, data, base = '../' }) {
  const path = 'contact/';
  const cfg = site.contact || {};
  const provider = cfg.provider || 'none';
  const formName = cfg.formName || 'contact';

  const topics = [
    ['correction', 'A correction - something here is wrong'],
    ['question', 'A question about a color or a piece'],
    ['accessibility', 'Something does not work with my assistive technology'],
    ['other', 'Something else'],
  ];

  let formAttrs = '';
  let hiddenFields = '';

  if (provider === 'netlify') {
    formAttrs =
      ` name="${esc(formName)}" method="POST" action="${base}contact/thanks/"` +
      ` data-netlify="true" netlify-honeypot="bot-field"`;
    // Netlify matches the submission to the form by this hidden field.
    hiddenFields = `          <input type="hidden" name="form-name" value="${esc(formName)}">\n`;
  } else if (provider === 'action' && cfg.action) {
    formAttrs = ` name="${esc(formName)}" method="POST" action="${esc(cfg.action)}"`;
  }

  // A honeypot has to be hidden from people and from screen readers, but still
  // submitted, so it is moved off-screen rather than display:none and taken out
  // of the tab order and the accessibility tree.
  const honeypot =
    provider === 'netlify'
      ? `          <p class="honeypot" aria-hidden="true">
            <label>Leave this field empty<input name="bot-field" tabindex="-1" autocomplete="off"></label>
          </p>\n`
      : '';

  const form =
    provider === 'none'
      ? `        <div class="callout">
          <p>The form is not switched on yet. In the meantime, reach me through
          <a href="${esc(site.author.url)}" rel="noopener" target="_blank">${esc(site.author.url)}</a>.</p>
        </div>`
      : `        <form class="contact-form"${formAttrs}>
${hiddenFields}${honeypot}
          <div class="field-block">
            <label for="contact-topic">What is this about?</label>
            <span class="select select--block"><select id="contact-topic" name="topic">
${topics
  .map(([v, label]) => `              <option value="${esc(v)}">${esc(label)}</option>`)
  .join('\n')}
            </select></span>
          </div>

          <div class="field-block">
            <label for="contact-subject">Which color or page?</label>
            <input type="text" id="contact-subject" name="subject" autocomplete="off"
                   placeholder="Lavender, the history page, No. 351...">
            <span class="field-hint">Optional, but it saves me hunting for it.</span>
          </div>

          <div class="field-block">
            <label for="contact-message">Your message <span class="field-req">(required)</span></label>
            <textarea id="contact-message" name="message" rows="7" required
                      aria-describedby="message-hint"></textarea>
            <span class="field-hint" id="message-hint">
              For a correction, tell me what it says now and what it should say. If you know where
              the right answer came from, even better.
            </span>
          </div>

          <div class="field-block">
            <label for="contact-email">Your email</label>
            <input type="email" id="contact-email" name="email" autocomplete="email"
                   aria-describedby="email-hint">
            <span class="field-hint" id="email-hint">
              Optional. Only needed if you want a reply, and only ever used for that.
            </span>
          </div>

          <div class="field-block">
            <label for="contact-name">Your name</label>
            <input type="text" id="contact-name" name="name" autocomplete="name"
                   aria-describedby="name-hint">
            <span class="field-hint" id="name-hint">
              Optional. Handy if you would like credit for a correction.
            </span>
          </div>

          <button type="submit" class="btn btn--primary">Send it</button>
        </form>`;

  const body = `      <div class="wrap breadcrumb">
        <nav aria-label="Breadcrumb">
          <ol>
            <li><a href="${base}">Colors</a></li>
            <li aria-current="page">Contact</li>
          </ol>
        </nav>
      </div>

      <section class="wrap wrap--narrow section--tight">
        <p class="eyebrow">Corrections especially welcome</p>
        <h1>Get in touch</h1>
        <p class="hero__lede" style="margin-top:1rem">
          This guide is one person's work and it has mistakes in it. If you have handled more
          Fiesta than I have, or you own a piece that contradicts something here, I would genuinely
          rather know.
        </p>
      </section>

      <section class="wrap wrap--narrow section--tight">
${form}
      </section>

      <section class="wrap wrap--narrow section--tight">
        <div class="prose">
          <h2>What I am most hoping to hear</h2>
          <ul>
            <li><strong>A date that is wrong.</strong> Production years are the hardest thing to
              pin down and the easiest thing to get wrong. If you have a piece or a catalogue that
              disagrees with a year here, that is the most useful message you can send.</li>
            <li><strong>A color number I have mislabelled.</strong> These are checkable against the
              bottom of a piece, which makes them the part of this site that has no excuse.</li>
            <li><strong>Something that does not work with your assistive technology.</strong> This
              site aims at WCAG 2.2 AA and I test what I can, but I am one person without a screen
              reader habit. If something is broken for you it is a bug, not a limitation.</li>
          </ul>
          <p>
            If you would rather file it technically, the whole site including the dataset is
            <a href="https://github.com/TheKicker/Fiesta-Color-Guide" rel="noopener" target="_blank">open
            on GitHub</a>.
          </p>
        </div>
      </section>`;

  return {
    title: 'Contact - The Unofficial Fiesta Color Guide',
    description:
      'Send a correction, ask about a color, or report something that does not work. Production years and color numbers are the most useful things to tell me about.',
    body,
    navKey: 'contact',
    navExact: true,
    depth: 1,
    path,
    scripts: ['assets/js/app.js'],
    schema: [
      {
        '@type': 'ContactPage',
        '@id': `${site.baseUrl}/${path}#webpage`,
        url: `${site.baseUrl}/${path}`,
        name: 'Contact',
        isPartOf: { '@id': `${site.baseUrl}/#website` },
        inLanguage: 'en-US',
      },
    ],
  };
}

export function contactThanks({ site, data, base = '../../' }) {
  const body = `      <section class="wrap wrap--narrow section" style="text-align:center">
        <p class="eyebrow">Sent</p>
        <h1>Thank you</h1>
        <p class="hero__lede" style="margin:1rem auto 0">
          That has reached me. If you left an email and the message needs an answer, you will get
          one. If you sent a correction, it will show up in the data rather than in a reply, and
          the page you flagged will change.
        </p>
        <p style="margin-top:1.75rem">
          <a class="btn btn--primary" href="${base}">Back to the colors</a>
        </p>
      </section>`;

  return {
    title: 'Thank you - The Unofficial Fiesta Color Guide',
    description:
      'Your message has been sent to the Unofficial Fiesta Color Guide. Corrections show up in the data rather than in a reply.',
    body,
    navKey: 'contact',
    depth: 2,
    path: 'contact/thanks/',
    // A post-submission page has nothing to offer a searcher.
    noindex: true,
    scripts: ['assets/js/app.js'],
  };
}
