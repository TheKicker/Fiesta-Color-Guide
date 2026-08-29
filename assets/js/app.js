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
