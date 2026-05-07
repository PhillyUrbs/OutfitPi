// OutfitPi main page
(() => {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || '';
  let refreshIntervalMs = 30 * 60 * 1000;
  let refreshTimer = null;

  const $ = (id) => document.getElementById(id);

  const ICONS = {
    'sun': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    'cloud': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
    'cloud-sun': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/></svg>',
    'cloud-rain': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16" y1="13" x2="16" y2="21"/><line x1="8" y1="13" x2="8" y2="21"/><line x1="12" y1="15" x2="12" y2="23"/><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/></svg>',
    'cloud-snow': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="8" y1="20" x2="8.01" y2="20"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="12" y1="22" x2="12.01" y2="22"/><line x1="16" y1="16" x2="16.01" y2="16"/><line x1="16" y1="20" x2="16.01" y2="20"/></svg>',
    'cloud-fog': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 15a4 4 0 0 1 .88-7.9A6 6 0 0 1 18 9"/><path d="M16 17H7"/><path d="M17 21H9"/></svg>',
    'cloud-lightning': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><polyline points="13 11 9 17 15 17 11 23"/></svg>',
    't-shirt': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>',
    'long-sleeve-shirt': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 17 4l-3 1a4 4 0 0 1-4 0L7 4 3 8l3 4 2-1v11h8V11l2 1z"/></svg>',
    'shorts': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14l-1 9h-5l-1-4-1 4H6z"/></svg>',
    'pants': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h14l-1 18h-5l-1-10-1 10H6z"/></svg>',
    'dress': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l1 4-1 2 4 13H5l4-13-1-2z"/></svg>',
    'leggings': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10l-1 18h-4l-1-10-1 10H8z"/></svg>',
    'rain-boots': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h6v12a4 4 0 0 1-4 4H5l1-3z"/></svg>',
  };

  const icon = (name) => ICONS[name] || ICONS['cloud'];

  function setTheme(isDay) {
    document.body.classList.toggle('night', !isDay);
    document.body.classList.toggle('day', !!isDay);
  }

  function fmtTemp(t, unit) {
    const u = unit === 'celsius' ? '°C' : '°F';
    return Math.round(t) + u;
  }

  function render(data) {
    document.body.classList.remove('loading');
    const w = data.weather;
    const ws = $('weather-section');
    if (!w) {
      ws.innerHTML = '<div class="loading-msg">Can\'t reach the weather service. We\'ll keep trying.</div>';
      $('outfits').innerHTML = '';
      return;
    }
    setTheme(w.is_day);
    ws.innerHTML = `
      <div class="weather-icon">${icon(w.icon)}</div>
      <div>
        <div class="weather-temp">${fmtTemp(w.temperature, w.units_temperature)}</div>
        <div class="weather-desc">${w.description}</div>
      </div>`;
    const rb = $('rain-banner');
    const anyRainAlert = (data.recommendations || []).map(r => r.rain_alert).find(Boolean);
    if (anyRainAlert) { rb.textContent = anyRainAlert; rb.hidden = false; } else { rb.hidden = true; }

    const sb = $('stale-banner');
    if (w.stale) {
      const min = Math.max(1, Math.round((Date.now()/1000 - w.fetched_at) / 60));
      sb.textContent = `Showing last update from ${min} minute(s) ago. Reconnecting…`;
      sb.hidden = false;
    } else { sb.hidden = true; }

    const out = $('outfits');
    out.innerHTML = (data.recommendations || []).map(r => {
      if (r.unavailable) {
        return `<div class="outfit-card"><h3>${r.child_name}</h3><p class="reason">${r.reason}</p></div>`;
      }
      return `
        <div class="outfit-card">
          <h3>${r.child_name}</h3>
          <div class="outfit-pieces">
            <div class="piece">${icon(r.top_icon)}<div class="piece-label">${r.top}</div></div>
            <div class="piece">${icon(r.bottom_icon)}<div class="piece-label">${r.bottom}</div></div>
          </div>
          <p class="reason">${r.reason}</p>
        </div>`;
    }).join('');

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
      const resp = await fetch('/api/weather');
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (err.error === 'location_not_configured') { window.location.href = '/setup'; return; }
        $('weather-section').innerHTML = `<div class="loading-msg">${err.detail || 'Weather error.'}</div>`;
        return;
      }
      const data = await resp.json();
      render(data);
    } catch (e) {
      $('weather-section').innerHTML = '<div class="loading-msg">Network error. Will retry.</div>';
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
      // If the running version differs from the page we loaded, the server
      // was updated underneath us — reload to pick up new HTML/JS/CSS.
      const pageVersion = document.body.dataset.appVersion;
      if (pageVersion && j.current_version && j.current_version !== pageVersion) {
        window.location.reload();
      }
    } catch {}
  }

  // Re-check for version drift every 5 minutes.
  setInterval(checkUpdate, 5 * 60 * 1000);

  document.addEventListener('click', (e) => {
    if (e.target.closest('#settings-btn')) return;
    if (e.target.closest('.outfit-card') || e.target.closest('.weather-section')) {
      fetchWeather();
    }
  });

  fetchWeather();
  checkUpdate();
})();
