// OutfitPi main page
(() => {
  let refreshIntervalMs = 30 * 60 * 1000;
  let refreshTimer = null;
  let devMode = localStorage.getItem('outfitpi_dev_mode') || 'auto'; // auto|day|night
  let kidsMode = localStorage.getItem('outfitpi_dev_kids') || 'all'; // all|1|2
  let lastData = null;

  // Dev-only: build a sibling rec of the opposite gender from a given rec,
  // by swapping the gendered bottom piece. Other fields (reason, tier) kept as-is.
  function oppositeGenderRec(r) {
    const sib = { ...r, child_name: 'Sibling' };
    const swaps = {
      'shorts': ['dress', 'Dress'],
      'dress': ['shorts', 'Shorts'],
      'leggings': ['shorts', 'Shorts'],
      'pants': ['leggings', 'Leggings'],
    };
    // Prefer flipping based on bottom icon since labels vary ("Warm pants").
    const swap = swaps[r.bottom_icon];
    if (swap) {
      sib.bottom_icon = swap[0];
      sib.bottom = swap[1];
    }
    return sib;
  }

  const $ = (id) => document.getElementById(id);

  // SVG icons. Designed to be visually distinct at small sizes.
  const ICONS = {
    // Weather
    'sun': '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="32" cy="32" r="11" fill="currentColor" stroke="none"/><g><line x1="32" y1="6" x2="32" y2="14"/><line x1="32" y1="50" x2="32" y2="58"/><line x1="6" y1="32" x2="14" y2="32"/><line x1="50" y1="32" x2="58" y2="32"/><line x1="13" y1="13" x2="19" y2="19"/><line x1="45" y1="45" x2="51" y2="51"/><line x1="13" y1="51" x2="19" y2="45"/><line x1="45" y1="19" x2="51" y2="13"/></g></svg>',
    'cloud': '<svg viewBox="0 0 64 64" fill="currentColor"><path d="M48 42H18a12 12 0 1 1 2-23.8A16 16 0 0 1 51 24a10 10 0 0 1-3 18z"/></svg>',
    'cloud-sun': '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="22" cy="22" r="8" fill="currentColor" stroke="none"/><line x1="22" y1="6" x2="22" y2="10"/><line x1="6" y1="22" x2="10" y2="22"/><line x1="11" y1="11" x2="14" y2="14"/><line x1="33" y1="11" x2="30" y2="14"/><path fill="currentColor" stroke="none" d="M52 48H26a10 10 0 1 1 2-19.8A14 14 0 0 1 55 32a8 8 0 0 1-3 16z"/></svg>',
    'cloud-rain': '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path fill="currentColor" stroke="none" d="M48 36H18a12 12 0 1 1 2-23.8A16 16 0 0 1 51 18a10 10 0 0 1-3 18z"/><line x1="20" y1="44" x2="16" y2="54"/><line x1="32" y1="44" x2="28" y2="54"/><line x1="44" y1="44" x2="40" y2="54"/></svg>',
    'cloud-snow': '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path fill="currentColor" stroke="none" d="M48 36H18a12 12 0 1 1 2-23.8A16 16 0 0 1 51 18a10 10 0 0 1-3 18z"/><circle cx="20" cy="50" r="2" fill="currentColor"/><circle cx="32" cy="54" r="2" fill="currentColor"/><circle cx="44" cy="50" r="2" fill="currentColor"/></svg>',
    'cloud-fog': '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path fill="currentColor" stroke="none" d="M48 32H18a12 12 0 1 1 2-23.8A16 16 0 0 1 51 14a10 10 0 0 1-3 18z"/><line x1="14" y1="44" x2="50" y2="44"/><line x1="18" y1="52" x2="46" y2="52"/></svg>',
    'cloud-lightning': '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path fill="currentColor" stroke="none" d="M48 32H18a12 12 0 1 1 2-23.8A16 16 0 0 1 51 14a10 10 0 0 1-3 18z"/><polygon fill="#fff200" stroke="#b58a00" points="30,38 22,52 30,52 26,62 42,46 32,46 38,38"/></svg>',
    'moon': '<svg viewBox="0 0 64 64" fill="currentColor"><path d="M44 8a24 24 0 1 0 12 32 18 18 0 0 1-12-32z"/></svg>',

    // Clothing — short sleeve
    't-shirt': '<svg viewBox="0 0 64 64" fill="currentColor"><path d="M22 6 8 14l4 12 8-3v33h24V23l8 3 4-12L42 6a10 10 0 0 1-20 0z"/></svg>',
    // Long sleeve — extended sleeves down to wrists
    'long-sleeve-shirt': '<svg viewBox="0 0 64 64" fill="currentColor"><path d="M22 6 4 16l4 28 10-2V58h28V42l10 2 4-28L42 6a10 10 0 0 1-20 0z"/></svg>',
    // Jacket — t-shirt shape with center zipper line
    'jacket': '<svg viewBox="0 0 64 64" fill="currentColor"><path d="M22 6 6 14l4 14 8-3v33h12V8h4v50h12V25l8 3 4-14L42 6a10 10 0 0 1-20 0z"/><line x1="32" y1="14" x2="32" y2="56" stroke="#fff" stroke-width="2"/><circle cx="32" cy="22" r="1.5" fill="#fff"/><circle cx="32" cy="34" r="1.5" fill="#fff"/><circle cx="32" cy="46" r="1.5" fill="#fff"/></svg>',
    // Shorts — short, wide legs ending mid-thigh
    'shorts': '<svg viewBox="0 0 64 64" fill="currentColor"><path d="M10 8h44l-3 12-4 22H37l-2-18h-6l-2 18H17l-4-22z"/></svg>',
    // Pants — long, narrow legs to ankle
    'pants': '<svg viewBox="0 0 64 64" fill="currentColor"><path d="M10 6h44l-2 10-4 42H35l-2-32h-2l-2 32H16l-4-42z"/></svg>',
    // Dress — A-line silhouette
    'dress': '<svg viewBox="0 0 64 64" fill="currentColor"><path d="M22 6h20l2 6-3 4 13 42H10l13-42-3-4z"/></svg>',
    // Leggings — narrow legs hugging shape
    'leggings': '<svg viewBox="0 0 64 64" fill="currentColor"><path d="M14 6h36l-2 12-4 40h-9l-2-30h-2l-2 30h-9l-4-40z"/></svg>',
    // Rain boots
    'rain-boots': '<svg viewBox="0 0 64 64" fill="currentColor"><path d="M16 4h14v40a8 8 0 0 1-8 8h-8l2-8h6V14h-6z"/><path d="M34 4h14v40a8 8 0 0 1-8 8h-8l2-8h6V14h-6z"/></svg>',
    // Pajamas — onesie outline with stars
    'pajamas': '<svg viewBox="0 0 64 64" fill="currentColor"><path d="M22 6 14 12l4 8 6-1v37c0 2 2 4 4 4h8c2 0 4-2 4-4V19l6 1 4-8-8-6c-1 4-5 6-10 6s-9-2-10-6z"/><polygon fill="#ffd93d" points="32,28 33.2,31 36,31 33.7,33 34.5,36 32,34.2 29.5,36 30.3,33 28,31 30.8,31"/><circle cx="26" cy="44" r="1.5" fill="#ffd93d"/><circle cx="38" cy="44" r="1.5" fill="#ffd93d"/></svg>',
  };

  const icon = (name) => ICONS[name] || ICONS['cloud'];

  function setTheme(isDay) {
    // Dark/light is now driven by user preference (theme.js). Just track
    // is_day for any styles that key off the .day class.
    document.body.classList.toggle('day', !!isDay);
  }

  function fmtTemp(t, unit) {
    if (t == null || isNaN(t)) return '—';
    const u = unit === 'celsius' ? '°C' : '°F';
    return Math.round(t) + u;
  }

  function weatherPaneHTML(w) {
    const high = fmtTemp(w.temp_max, w.units_temperature);
    const low = fmtTemp(w.temp_min, w.units_temperature);
    // Prefer the afternoon forecast (kids' outdoor window) for the big icon
    // and description; fall back to the daily summary, then "now".
    const dayIcon = w.afternoon_icon || w.daily_icon || w.icon;
    const dayDesc = w.afternoon_description || w.daily_description || w.description;
    const aft = (w.apparent_afternoon != null)
      ? `<div class="weather-afternoon">Afternoon: ${fmtTemp(w.apparent_afternoon, w.units_temperature)}</div>`
      : '';
    return `
      <section class="pane weather-pane">
        <div class="weather-icon">${icon(dayIcon)}</div>
        <div class="weather-day">Today</div>
        <div class="weather-hilo">
          <span class="hi">↑ ${high}</span>
          <span class="lo">↓ ${low}</span>
        </div>
        <div class="weather-desc">${dayDesc}</div>
        ${aft}
        <div class="weather-now">
          Now ${fmtTemp(w.temperature, w.units_temperature)} · feels ${fmtTemp(w.apparent_temperature, w.units_temperature)}
        </div>
      </section>`;
  }

  function outfitPaneHTML(r) {
    if (r.unavailable) {
      return `<section class="pane outfit-pane"><h2>${r.child_name}</h2><p class="reason">${r.reason}</p></section>`;
    }
    if (r.is_evening) {
      return `
        <section class="pane outfit-pane evening">
          <h2>${r.child_name}</h2>
          <div class="outfit-pieces single">
            <div class="piece">${icon('pajamas')}<div class="piece-label">Pajamas</div></div>
          </div>
          <p class="reason">${r.reason}</p>
        </section>`;
    }
    return `
      <section class="pane outfit-pane tier-${r.tier_name}">
        <h2>${r.child_name}</h2>
        <div class="outfit-pieces">
          <div class="piece">${icon(r.top_icon)}<div class="piece-label">${r.top}</div></div>
          <div class="piece">${icon(r.bottom_icon)}<div class="piece-label">${r.bottom}</div></div>
        </div>
        <p class="reason">${r.reason}</p>
      </section>`;
  }

  function render(data) {
    lastData = data;
    document.body.classList.remove('loading');
    const w = data.weather;
    let recs = data.recommendations || [];
    if (kidsMode === '1' && recs.length > 1) recs = recs.slice(0, 1);
    else if (kidsMode === '2' && recs.length === 1) recs = [recs[0], oppositeGenderRec(recs[0])];
    const dash = $('dashboard');

    if (!w) {
      dash.innerHTML = '<div class="loading-msg">Can\'t reach the weather service. We\'ll keep trying.</div>';
      return;
    }
    setTheme(w.is_day);

    // Banners
    const rb = $('rain-banner');
    const anyRainAlert = recs.map(r => r.rain_alert).find(Boolean);
    if (anyRainAlert) { rb.textContent = anyRainAlert; rb.hidden = false; } else { rb.hidden = true; }

    const sb = $('stale-banner');
    if (w.stale) {
      const min = Math.max(1, Math.round((Date.now()/1000 - w.fetched_at) / 60));
      sb.textContent = `Showing last update from ${min} minute(s) ago. Reconnecting…`;
      sb.hidden = false;
    } else {
      sb.hidden = true;
    }

    // Layout: 1 child = 2 cols (weather | outfit), 2 children = 3 cols (child1 | weather | child2)
    dash.classList.toggle('layout-2col', recs.length === 1);
    dash.classList.toggle('layout-3col', recs.length >= 2);

    let html = '';
    if (recs.length === 1) {
      html = weatherPaneHTML(w) + outfitPaneHTML(recs[0]);
    } else if (recs.length >= 2) {
      html = outfitPaneHTML(recs[0]) + weatherPaneHTML(w) + outfitPaneHTML(recs[1]);
    } else {
      html = weatherPaneHTML(w);
    }
    dash.innerHTML = html;

    const loc = data.location || {};
    const locStr = [loc.city, loc.region].filter(Boolean).join(', ');
    $('footer-location').textContent = locStr || '';
    if (w.fetched_at) {
      const d = new Date(w.fetched_at * 1000);
      $('footer-updated').textContent = 'Updated ' + d.toLocaleTimeString();
    }
    refreshIntervalMs = (data.refresh_interval_minutes || 30) * 60 * 1000;
    scheduleRefresh();
  }

  async function fetchWeather() {
    try {
      const url = devMode && devMode !== 'auto'
        ? `/api/weather?mode=${encodeURIComponent(devMode)}`
        : '/api/weather';
      const resp = await fetch(url);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (err.error === 'location_not_configured') { window.location.href = '/setup'; return; }
        $('dashboard').innerHTML = `<div class="loading-msg">${err.detail || 'Weather error.'}</div>`;
        return;
      }
      const data = await resp.json();
      render(data);
    } catch (e) {
      $('dashboard').innerHTML = '<div class="loading-msg">Network error. Will retry.</div>';
    }
  }

  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(fetchWeather, refreshIntervalMs);
  }

  async function checkUpdate() {
    try {
      const r = await fetch('/api/update/check');
      const j = await r.json();
      if (j.available) $('update-badge').hidden = false;
      const pageVersion = document.body.dataset.appVersion;
      if (pageVersion && j.current_version && j.current_version !== pageVersion) {
        window.location.reload();
      }
    } catch {}
  }

  // Track server identity so we can hot-reload after a restart (which
  // also invalidates any in-page CSRF token) or after a dev-channel
  // rebuild that doesn't bump __version__.
  // The reload itself is handled by static/js/auto-reload.js (shared
  // with settings/setup); this just renders the version+sha pill in
  // the topbar on first health response when a SHA is present.
  async function renderDevBuildBadge() {
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (!j.sha) return;
      const brand = document.querySelector('.brand');
      if (brand && !document.getElementById('dev-build-badge')) {
        const tag = document.createElement('span');
        tag.id = 'dev-build-badge';
        tag.className = 'dev-build-badge';
        tag.textContent = `${j.version}+${j.sha}`;
        tag.title = `Build ${j.version} (${j.sha})`;
        brand.after(tag);
      }
    } catch {}
  }
  setTimeout(renderDevBuildBadge, 1500);

  setInterval(checkUpdate, 5 * 60 * 1000);

  async function initDevToggle() {
    try {
      const r = await fetch('/api/settings');
      const cfg = await r.json();
      if (cfg.updates && cfg.updates.channel === 'dev') {
        const el = $('dev-toggle');
        el.hidden = false;
        el.querySelectorAll('button[data-mode]').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.mode === devMode);
          btn.addEventListener('click', () => {
            devMode = btn.dataset.mode;
            localStorage.setItem('outfitpi_dev_mode', devMode);
            el.querySelectorAll('button[data-mode]').forEach(b => b.classList.toggle('active', b === btn));
            fetchWeather();
          });
        });
        el.querySelectorAll('button[data-kids]').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.kids === kidsMode);
          btn.addEventListener('click', () => {
            kidsMode = btn.dataset.kids;
            localStorage.setItem('outfitpi_dev_kids', kidsMode);
            el.querySelectorAll('button[data-kids]').forEach(b => b.classList.toggle('active', b === btn));
            if (lastData) render(lastData);
          });
        });
        const currentTheme = (window.OutfitPiTheme && localStorage.getItem('outfitpi_theme')) || 'auto';
        el.querySelectorAll('button[data-theme]').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.theme === currentTheme);
          btn.addEventListener('click', () => {
            const t = btn.dataset.theme;
            if (window.OutfitPiTheme) window.OutfitPiTheme.set(t);
            el.querySelectorAll('button[data-theme]').forEach(b => b.classList.toggle('active', b === btn));
          });
        });
      }
    } catch {}
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#settings-btn')) return;
    if (e.target.closest('#dev-toggle')) return;
    if (e.target.closest('.pane')) fetchWeather();
  });

  fetchWeather();
  checkUpdate();
  initDevToggle();
})();
