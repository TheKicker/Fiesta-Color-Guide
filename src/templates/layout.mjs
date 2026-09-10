/**
 * The page shell every route shares: head, header, footer, script tags.
 *
 * Pages are emitted as complete static HTML. Nothing on this site needs
 * JavaScript to be readable -- JS only adds filtering, sorting and theming on
 * top of markup that is already there. That is what makes the content
 * crawlable on the first pass and usable with JS off.
 */

/** Escape for HTML text and double-quoted attribute values. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape for a <script type="application/ld+json"> payload. */
export function jsonLd(obj) {
  return JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');
}

/** Relative prefix from a page at `depth` folders deep back to the site root. */
export function rel(depth) {
  return depth === 0 ? '' : '../'.repeat(depth);
}

const ICONS = {
  sun: '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
  search:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  external:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  github:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.1 4.7 18.1 5 18.1 5c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z"/></svg>',
  arrowLeft:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
};

export function icon(name, extra = '') {
  const svg = ICONS[name];
  if (!svg) throw new Error(`Unknown icon: ${name}`);
  return extra ? svg.replace('<svg ', `<svg ${extra} `) : svg;
}

/** Six real Fiesta colours as the wordmark, so the logo is the dataset. */
function brandMark(markColors) {
  const cells = markColors
    .map((c) => `<span style="background:${esc(c.hex)}"></span>`)
    .join('');
  return `<span class="brand__mark" aria-hidden="true">${cells}</span>`;
}

function siteHeader({ site, base, nav, markColors }) {
  const links = nav
    .map(
      (n) =>
        `<a href="${esc(base + n.href || './')}"${
          n.exact ? ' aria-current="page"' : n.current ? ' data-section="true"' : ''
        }>${esc(n.label)}</a>`
    )
    .join('\n            ');

  return `<header class="site-header">
      <div class="wrap site-header__inner">
        <a class="brand" href="${esc(base || './')}">
          ${brandMark(markColors)}
          <span>Fiesta Color Guide<span class="brand__sub">Unofficial &middot; 1936-today</span></span>
        </a>
        <nav class="site-nav" aria-label="Main">
            ${links}
        </nav>
        <button type="button" class="theme-toggle" id="theme-toggle">
          <span class="visually-hidden">Switch to dark theme</span>
          ${icon('sun')}${icon('moon')}
        </button>
      </div>
    </header>`;
}

function siteFooter({ site, base, year }) {
  const home = base || './';
  return `<footer class="site-footer">
      <div class="wrap">
        <div class="site-footer__grid">
          <div>
            <h2>Browse</h2>
            <ul>
              <li><a href="${home}">All colors</a></li>
              <li><a href="${base}colors/era/in-production/">In production now</a></li>
              <li><a href="${base}colors/era/vintage/">Vintage (1936-1972)</a></li>
              <li><a href="${base}colors/era/post-86/">Post 86 (1986-today)</a></li>
              <li><a href="${base}history.html">Company history</a></li>
            </ul>
          </div>
          <div>
            <h2>About this guide</h2>
            <ul>
              <li><a href="${base}about.html">How the data is built</a></li>
              <li><a href="${base}about.html#sources">Sources</a></li>
              <li><a href="${base}privacy.html">Privacy &amp; cookies</a></li>
              <li><a href="${base}fiesta.json">Open data (JSON)</a></li>
              <li><a href="${base}sitemap.xml">Sitemap</a></li>
            </ul>
          </div>
          <div>
            <h2>The Fiesta Tableware Company</h2>
            <ul>
              <li><a href="https://fiestatableware.com" rel="noopener nofollow" target="_blank">Company site</a></li>
              <li><a href="https://fiestafactorydirect.com" rel="noopener nofollow" target="_blank">Fiesta Factory Direct</a></li>
              <li><a href="https://usadinnerwaredirect.com" rel="noopener nofollow" target="_blank">USA Dinnerware Direct</a></li>
            </ul>
          </div>
          <div>
            <h2>This project</h2>
            <ul>
              <li><a href="https://github.com/TheKicker/Fiesta-Color-Guide" rel="noopener" target="_blank">Source on GitHub</a></li>
              <li><a href="https://github.com/TheKicker/Fiesta-Color-Guide/issues/new" rel="noopener" target="_blank">Report a correction</a></li>
              <li><a href="https://cavlemasters.com" rel="noopener" target="_blank">Made by Cav</a></li>
              <li><a href="https://www.buymeacoffee.com/${esc(site.buyMeACoffee)}" rel="noopener nofollow" target="_blank">Buy me a coffee</a></li>
            </ul>
          </div>
        </div>
        <div class="site-footer__legal">
          <p>
            <strong>Not affiliated with, endorsed by, or sponsored by The Fiesta Tableware Company.</strong>
            Fiesta<sup>&reg;</sup> is a registered trademark of The Fiesta Tableware Company. Product photographs and
            color names are used for identification and reference only. Hex values are this project's
            best-effort digital match and are not official color specifications.
            &copy; ${year} Cav Lemasters.
          </p>
          <picture>
            <source type="image/webp" srcset="${base}assets/opt/made-in-usa-236.webp">
            <img class="made-in-usa" src="${base}assets/images/made-in-usa.png" width="118" height="62" loading="lazy" decoding="async" alt="Fiesta &quot;Made in the USA&quot; sticker showing an American flag">
          </picture>
        </div>
      </div>
    </footer>`;
}

/** AdSense slot. Only emitted once a publisher ID is configured. */
export function adSlot(site, { format = 'leaderboard', slot } = {}) {
  if (!site.adsense?.client) return '';
  const slotId = slot || site.adsense.slots?.[format];
  // No slot ID yet: render nothing. An empty reserved box on a site awaiting
  // review is exactly the kind of thing that reads as an unfinished page.
  if (!slotId) return '';
  return `<aside class="ad-slot ad-slot--${esc(format)}" aria-label="Advertisement">
        <span class="ad-slot__label">Advertisement</span>
        <ins class="adsbygoogle"
             style="display:block"
             data-ad-client="${esc(site.adsense.client)}"
             data-ad-slot="${esc(slotId)}"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
        <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
      </aside>`;
}


/**
 * Tell people when a link leaves the site.
 *
 * Every outbound link here opens in a new tab, and a new tab appearing without
 * warning is disorienting for screen reader and screen magnifier users in
 * particular. Applied as one pass over the finished document rather than at
 * ~40 call sites, so it cannot be forgotten when a link is added.
 */
function annotateExternalLinks(html) {
  return html.replace(
    /(<a[^>]*target="_blank"[^>]*>)([\s\S]*?)(<\/a>)/g,
    (match, open, inner, close) => {
      if (inner.includes('opens in a new tab')) return match;
      return `${open}${inner}<span class="visually-hidden"> (opens in a new tab)</span>${close}`;
    }
  );
}

/**
 * Full document.
 *
 * @param {object} o
 * @param {number} o.depth        folders below root, for relative asset URLs
 * @param {string} o.path         canonical path fragment, e.g. "colors/lapis/"
 * @param {string} o.title        <title>, already suffixed by the caller if needed
 * @param {string} o.description  meta description, ~150-160 chars
 * @param {string} o.body         page markup, inserted after the header
 * @param {object[]} o.schema     JSON-LD graph nodes
 */
export function page(o) {
  const {
    site,
    depth = 0,
    path = '',
    title,
    description,
    body,
    schema = [],
    ogImage,
    ogImageAlt,
    ogImageSize = { w: 1200, h: 630 },
    ogType = 'website',
    navKey = 'colors',
    navExact = true,
    markColors = [],
    year = new Date().getFullYear(),
    bodyClass = '',
    scripts = [],
    noindex = false,
    prefetchImage,
  } = o;

  const base = rel(depth);
  const canonical = `${site.baseUrl}/${path}`;
  const image = ogImage || `${site.baseUrl}/assets/opt/og-card.jpg`;
  const imageAlt =
    ogImageAlt || 'Fiesta dinnerware plates arranged as a rainbow of colors.';

  const nav = [
    { label: 'Colors', href: '', key: 'colors' },
    { label: 'History', href: 'history.html', key: 'history' },
    { label: 'About', href: 'about.html', key: 'about' },
    { label: 'ROYGBIV', href: 'colors/rainbow/', key: 'rainbow' },
  ].map((n) => ({ ...n, current: n.key === navKey, exact: n.key === navKey && navExact }));

  const graph =
    schema.length > 0
      ? `\n    <script type="application/ld+json">${jsonLd(
          schema.length === 1 ? schema[0] : { '@context': 'https://schema.org', '@graph': schema }
        )}</script>`
      : '';

  /**
   * AdSense site verification, on every page.
   *
   * The meta tag and the loader script are what Google looks for when it
   * reviews a site, and together they are also all Auto ads needs. Neither
   * depends on a manual ad unit existing, so both ship as soon as there is a
   * publisher ID -- which is the state a site is in while it waits for
   * approval.
   */
  const adsenseHead = site.adsense?.client
    ? `\n    <meta name="google-adsense-account" content="${esc(site.adsense.client)}">` +
      `\n    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(
        site.adsense.client
      )}" crossorigin="anonymous"></script>`
    : '';

  const analytics = site.analytics?.ga4
    ? `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${esc(site.analytics.ga4)}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${esc(site.analytics.ga4)}');
    </script>`
    : '';

  return annotateExternalLinks(`<!doctype html>
<html lang="en" prefix="og: https://ogp.me/ns#">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <link rel="canonical" href="${esc(canonical)}">
    ${noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">'}

    <!-- Theme is applied before first paint so the page never flashes. -->
    <meta name="color-scheme" content="light dark">
    <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#121110" media="(prefers-color-scheme: dark)">
    <script>
      try {
        var t = localStorage.getItem('fcg-theme');
        if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
      } catch (e) {}
    </script>

    <link rel="stylesheet" href="${base}assets/css/main.css">
    ${prefetchImage ? `<link rel="preload" as="image" href="${esc(prefetchImage)}" fetchpriority="high">` : ''}

    <link rel="icon" href="${base}assets/images/favicon.ico" sizes="any">
    <link rel="icon" type="image/png" sizes="32x32" href="${base}assets/images/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="${base}assets/images/favicon-16x16.png">
    <link rel="apple-touch-icon" sizes="180x180" href="${base}assets/images/apple-touch-icon.png">
    <link rel="mask-icon" href="${base}assets/images/safari-pinned-tab.svg" color="#ff813f">
    <link rel="manifest" href="${base}assets/images/site.webmanifest">

    <meta property="og:site_name" content="${esc(site.siteName)}">
    <meta property="og:locale" content="${esc(site.locale)}">
    <meta property="og:type" content="${esc(ogType)}">
    <meta property="og:url" content="${esc(canonical)}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:image" content="${esc(image)}">
    <meta property="og:image:width" content="${ogImageSize.w}">
    <meta property="og:image:height" content="${ogImageSize.h}">
    <meta property="og:image:alt" content="${esc(imageAlt)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(description)}">
    <meta name="twitter:image" content="${esc(image)}">
    <meta name="twitter:image:alt" content="${esc(imageAlt)}">
    ${site.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(site.googleSiteVerification)}">` : ''}${graph}${adsenseHead}${analytics}
  </head>
  <body${bodyClass ? ` class="${esc(bodyClass)}"` : ''}>
    <a class="skip-link" href="#main">Skip to main content</a>
    ${siteHeader({ site, base, nav, markColors })}
    <main id="main">
${body}
    </main>
    ${siteFooter({ site, base, year })}
${scripts.map((s) => `    <script src="${base}${s}" defer></script>`).join('\n')}${
    site.buyMeACoffee
      ? `
    <script
      data-name="BMC-Widget"
      data-cfasync="false"
      src="https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js"
      data-id="${esc(site.buyMeACoffee)}"
      data-description="Support me on Buy me a coffee!"
      data-message="Thank you for visiting. Buy me a coffee?"
      data-color="#FF813F"
      data-position="Right"
      data-x_margin="18"
      data-y_margin="18"></script>`
      : ''
  }
  </body>
</html>
`);
}
