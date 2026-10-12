/**
 * Progressive enhancement only.
 *
 * Every colour, description, pairing and link is already in the HTML that the
 * server sent. This file adds theming, filtering and sorting on top of it.
 * With JavaScript off, the page is a complete, readable, crawlable list of all
 * 61 colours -- which is exactly what we want search engines and screen
 * readers to meet first.
 */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- theme */

  var THEME_KEY = 'fcg-theme';
  var root = document.documentElement;

  function store(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) {
      /* private mode, blocked storage -- the site still works, just forgets */
    }
  }

  function readStore(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function currentTheme() {
    var explicit = root.getAttribute('data-theme');
    if (explicit) return explicit;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    var label = toggle.querySelector('.visually-hidden');

    var syncLabel = function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      if (label) label.textContent = 'Switch to ' + next + ' theme';
      toggle.setAttribute('title', 'Switch to ' + next + ' theme');
    };

    syncLabel();

    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      store(THEME_KEY, next);
      syncLabel();
    });

    // If the visitor never chose, keep following the OS.
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () {
        if (!readStore(THEME_KEY)) syncLabel();
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  /* ----------------------------------------------------------- phone menu */
  /* A disclosure, not a modal: no focus trap, no scroll lock, no inert
     background. The panel is the real <nav>, so there is one set of links in
     the document and `aria-controls` points at the thing it actually opens.
     Escape closes it and hands focus back, a click outside closes it, and the
     shop link and theme toggle are never inside it. */
  var menuToggle = document.getElementById('menu-toggle');
  var siteNav = document.getElementById('site-nav');
  var menuOpen = false;

  function setMenu(open) {
    if (!menuToggle || !siteNav) return;
    menuOpen = open;
    siteNav.classList.toggle('is-open', open);
    menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (menuToggle && siteNav) {
    var phoneMq = window.matchMedia('(max-width: 768px)');

    var syncMenu = function () {
      if (phoneMq.matches) {
        menuToggle.hidden = false;
        if (!menuOpen) setMenu(false);
      } else {
        menuToggle.hidden = true;
        setMenu(false); // the panel class must not survive into the wide layout
      }
    };

    menuToggle.addEventListener('click', function () {
      setMenu(!menuOpen);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menuOpen) {
        setMenu(false);
        menuToggle.focus();
      }
    });

    document.addEventListener('click', function (event) {
      if (!menuOpen) return;
      if (siteNav.contains(event.target) || menuToggle.contains(event.target)) return;
      setMenu(false);
    });

    if (phoneMq.addEventListener) phoneMq.addEventListener('change', syncMenu);
    else if (phoneMq.addListener) phoneMq.addListener(syncMenu);
    syncMenu();
  }

  /* ------------------------------------------------------ tucking header */
  /* Scroll down and the header slides away; scroll up and it comes straight
     back. Phones only - a desktop has the vertical room to spare.

     Three rules keep it from being annoying. It never tucks near the top of
     the page, where the header is part of the furniture. It needs a few
     pixels of deliberate movement to change its mind, so a thumb resting on
     a scrolling page does not make it flicker. And it always comes back if
     focus lands inside it, because a keyboard user tabbing into a header
     they cannot see is a trap. */
  (function tuckingHeader() {
    var header = document.querySelector('.site-header');
    if (!header) return;

    var phone = window.matchMedia('(max-width: 768px)');
    var root = document.documentElement;
    var last = window.pageYOffset;
    var pending = null;
    var FLOOR = 140; // leave it alone until past the hero's first screenful
    var SLOP = 6; // movement below this is noise, not a decision

    function tuck(on) {
      root.classList.toggle('nav-tucked', on);
    }

    function read() {
      pending = null;
      var y = window.pageYOffset;
      var dy = y - last;

      // Sliding the header away while its own menu is open would take the
      // menu with it.
      if (!phone.matches || y < FLOOR || menuOpen) {
        tuck(false);
        last = y;
        return;
      }
      if (Math.abs(dy) < SLOP) return;
      tuck(dy > 0);
      last = y;
    }

    /* Trailing-edge throttle on a timer, deliberately not requestAnimationFrame.
       A "skip if one is queued" guard around rAF deadlocks permanently the
       first time rAF does not fire - background the tab mid-scroll and the
       flag stays set, so every later scroll is ignored and the header never
       moves again. setTimeout always fires. 60ms is well under the time it
       takes to notice. */
    window.addEventListener(
      'scroll',
      function () {
        if (pending) return;
        pending = setTimeout(read, 60);
      },
      { passive: true }
    );

    // Tab into anything in the header and it has to be on screen.
    header.addEventListener('focusin', function () {
      tuck(false);
    });

    var onWidthChange = function () {
      if (!phone.matches) tuck(false);
    };
    if (phone.addEventListener) phone.addEventListener('change', onWidthChange);
    else if (phone.addListener) phone.addListener(onWidthChange);
  })();

  /* --------------------------------------------------------------- filter */

  var grid = document.getElementById('color-grid');
  if (!grid) return;

  var form = document.getElementById('filters');
  var input = document.getElementById('q');
  var clearBtn = document.getElementById('q-clear');
  var statusSel = document.getElementById('status');
  var eraSel = document.getElementById('era');
  var decadeSel = document.getElementById('decade');
  var sortSel = document.getElementById('sort');
  var resultCount = document.getElementById('result-count');
  var emptyState = document.getElementById('empty-state');
  var resetBtn = document.getElementById('reset');
  var chipButtons = Array.prototype.slice.call(document.querySelectorAll('[data-filter-shade]'));
  var panel = document.getElementById('filters-panel');
  var panelToggle = document.getElementById('filters-toggle');
  var badge = document.getElementById('filter-badge');
  var badgeSr = document.getElementById('filter-badge-sr');

  var cards = Array.prototype.slice.call(grid.children).map(function (el) {
    return {
      el: el,
      search: el.getAttribute('data-search') || '',
      shade: el.getAttribute('data-shade'),
      era: el.getAttribute('data-era'),
      current: el.getAttribute('data-current') === 'true',
      start: Number(el.getAttribute('data-start')),
      end: Number(el.getAttribute('data-end')),
      decades: (el.getAttribute('data-decades') || '').split(' '),
      name: el.getAttribute('data-name') || '',
      hue: Number(el.getAttribute('data-hue')),
      light: Number(el.getAttribute('data-light')),
    };
  });

  var total = cards.length;

  var state = {
    q: '',
    status: 'all',
    era: 'all',
    decade: 'all',
    sort: 'chrono',
    shades: [],
  };

  var DEFAULTS = { q: '', status: 'all', era: 'all', decade: 'all', sort: 'chrono' };

  /* Sorting reorders with the CSS `order` property rather than moving nodes,
     so focus, the ad slots and any in-flight image loads all stay put. */
  var COMPARATORS = {
    chrono: function (a, b) { return a.start - b.start || a.name.localeCompare(b.name); },
    recent: function (a, b) { return b.start - a.start || a.name.localeCompare(b.name); },
    name: function (a, b) { return a.name.localeCompare(b.name); },
    hue: function (a, b) { return a.hue - b.hue || a.light - b.light; },
    light: function (a, b) { return b.light - a.light || a.name.localeCompare(b.name); },
  };

  function matches(card) {
    if (state.status === 'current' && !card.current) return false;
    if (state.status === 'retired' && card.current) return false;
    if (state.era !== 'all' && card.era !== state.era) return false;
    if (state.decade !== 'all' && card.decades.indexOf(state.decade) === -1) return false;
    if (state.shades.length && state.shades.indexOf(card.shade) === -1) return false;
    if (state.q && card.search.indexOf(state.q) === -1) return false;
    return true;
  }

  function activeFilterCount() {
    var count = state.shades.length;
    if (state.q) count++;
    if (state.status !== 'all') count++;
    if (state.era !== 'all') count++;
    if (state.decade !== 'all') count++;
    return count;
  }

  /* ---------------------------------------------------------------------
     The collapsible filter panel.

     Phone only. On a short phone the open toolbar is the whole first screen,
     so the selects and chips fold away behind a button and the search stays
     visible. The button ships with `hidden` in the HTML and is revealed only
     here, which means a browser with JS off never sees a control that cannot
     do anything - it just gets the panel, open, the way it always was.
     --------------------------------------------------------------------- */
  var narrow = window.matchMedia('(max-width: 768px)');
  // Once someone opens or closes it themselves, stop deciding for them.
  var panelTouched = false;

  function setPanel(open) {
    if (!panel || !panelToggle) return;
    panel.hidden = !open;
    panelToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function syncFilterPanel() {
    if (!panel || !panelToggle) return;
    if (narrow.matches) {
      panelToggle.hidden = false;
      if (!panelTouched) setPanel(false);
    } else {
      panelToggle.hidden = true;
      setPanel(true);
    }
  }

  /* The number on the button, so a closed panel still says it is filtering.
     The badge is aria-hidden and a sibling span carries the same count in
     words, because "Filters 2" read aloud is not a sentence. */
  function syncFilterBadge() {
    if (!badge) return;
    var n = activeFilterCount();
    badge.hidden = n === 0;
    badge.textContent = String(n);
    if (badgeSr) badgeSr.textContent = n === 0 ? '' : ', ' + n + ' active';
  }

  if (panelToggle) {
    panelToggle.addEventListener('click', function () {
      panelTouched = true;
      setPanel(panel.hidden);
    });
    if (narrow.addEventListener) narrow.addEventListener('change', syncFilterPanel);
    else if (narrow.addListener) narrow.addListener(syncFilterPanel);
    syncFilterPanel();
  }

  function apply() {
    var visible = [];
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var show = matches(card);
      card.el.hidden = !show;
      if (show) visible.push(card);
    }

    var compare = Object.prototype.hasOwnProperty.call(COMPARATORS, state.sort)
      ? COMPARATORS[state.sort]
      : COMPARATORS.chrono;
    visible.sort(compare);
    for (var j = 0; j < visible.length; j++) {
      visible[j].el.style.order = String(j);
    }

    if (emptyState) emptyState.hidden = visible.length > 0;
    if (clearBtn) clearBtn.hidden = !state.q;
    if (resetBtn) resetBtn.hidden = activeFilterCount() === 0;
    syncFilterBadge();

    if (resultCount) {
      var text =
        visible.length === total
          ? '<strong>' + total + '</strong> colors'
          : '<strong>' + visible.length + '</strong> of ' + total + ' colors';
      // role="status" announces whenever this changes. Writing the identical
      // string would make some screen readers repeat the count for nothing.
      if (resultCount.innerHTML !== text) resultCount.innerHTML = text;
    }

    syncUrl();
  }

  /* ------------------------------------------------------------------ url */

  function syncUrl() {
    if (!window.history || !window.history.replaceState) return;
    try {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.status !== 'all') params.set('status', state.status);
    if (state.era !== 'all') params.set('era', state.era);
    if (state.decade !== 'all') params.set('decade', state.decade);
    if (state.sort !== 'chrono') params.set('sort', state.sort);
    if (state.shades.length) params.set('shade', state.shades.join(','));

      var query = params.toString();
      var url = window.location.pathname + (query ? '?' + query : '') + window.location.hash;
      window.history.replaceState(null, '', url);
    } catch (e) {
      /* file:// and some sandboxes refuse history writes; filtering still works */
    }
  }

  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    var validShades = chipButtons.map(function (b) {
      return b.getAttribute('data-filter-shade');
    });

    state.q = (params.get('q') || '').trim().toLowerCase();
    state.status = ['current', 'retired'].indexOf(params.get('status')) > -1 ? params.get('status') : 'all';
    state.era = ['vintage', 'post86'].indexOf(params.get('era')) > -1 ? params.get('era') : 'all';
    state.decade = /^\d{4}$/.test(params.get('decade') || '') ? params.get('decade') : 'all';
    var wanted = params.get('sort');
    state.sort =
      wanted && Object.prototype.hasOwnProperty.call(COMPARATORS, wanted) ? wanted : 'chrono';
    state.shades = (params.get('shade') || '')
      .split(',')
      .map(function (s) { return s.trim().toLowerCase(); })
      .filter(function (s) { return validShades.indexOf(s) > -1; });

    if (input) input.value = params.get('q') || '';
    if (statusSel) statusSel.value = state.status;
    if (eraSel) eraSel.value = state.era;
    if (decadeSel) decadeSel.value = state.decade;
    if (sortSel) sortSel.value = state.sort;
    chipButtons.forEach(function (b) {
      b.setAttribute(
        'aria-pressed',
        String(state.shades.indexOf(b.getAttribute('data-filter-shade')) > -1)
      );
    });
  }

  /* -------------------------------------------------------------- wiring */

  // Search input is debounced: it keeps the live region from narrating a new
  // count on every keystroke, and keeps 61 layout passes off the main thread.
  var debounceTimer = null;
  if (input) {
    input.addEventListener('input', function () {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(function () {
        state.q = input.value.trim().toLowerCase();
        apply();
      }, 180);
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && input.value) {
        event.preventDefault();
        input.value = '';
        state.q = '';
        apply();
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      input.value = '';
      state.q = '';
      apply();
      input.focus();
    });
  }

  function bindSelect(el, key) {
    if (!el) return;
    el.addEventListener('change', function () {
      state[key] = el.value;
      apply();
    });
  }

  bindSelect(statusSel, 'status');
  bindSelect(eraSel, 'era');
  bindSelect(decadeSel, 'decade');
  bindSelect(sortSel, 'sort');

  chipButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var shade = button.getAttribute('data-filter-shade');
      var index = state.shades.indexOf(shade);
      if (index > -1) state.shades.splice(index, 1);
      else state.shades.push(shade);
      button.setAttribute('aria-pressed', String(index === -1));
      apply();
    });
  });

  function resetAll(focusTarget) {
    state.q = DEFAULTS.q;
    state.status = DEFAULTS.status;
    state.era = DEFAULTS.era;
    state.decade = DEFAULTS.decade;
    state.sort = DEFAULTS.sort;
    state.shades = [];

    if (input) input.value = '';
    if (statusSel) statusSel.value = 'all';
    if (eraSel) eraSel.value = 'all';
    if (decadeSel) decadeSel.value = 'all';
    if (sortSel) sortSel.value = 'chrono';
    chipButtons.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });

    apply();
    if (focusTarget && focusTarget.focus) focusTarget.focus();
  }

  if (resetBtn) resetBtn.addEventListener('click', function () { resetAll(input); });
  document.querySelectorAll('[data-reset]').forEach(function (b) {
    b.addEventListener('click', function () { resetAll(input); });
  });

  // The form exists so the controls are grouped and labelled; there is no
  // server to submit to.
  if (form) form.addEventListener('submit', function (e) { e.preventDefault(); });

  // "/" focuses search, the way every other reference site behaves.
  document.addEventListener('keydown', function (event) {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (document.activeElement && document.activeElement.isContentEditable) return;
    if (!input) return;
    event.preventDefault();
    input.focus();
    input.select();
  });

  readUrl();
  apply();
})();
