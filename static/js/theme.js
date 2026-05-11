// Theme bootstrap: apply light/dark to <body class="night"> based on
// user preference (auto | light | dark). In auto mode, light from 6:00
// to 18:59 local, otherwise dark. Cached in localStorage so the page
// renders without a flash before /api/settings replies.
(function () {
  const KEY = 'outfitpi_theme'; // "auto" | "light" | "dark"

  function isNightAuto() {
    const h = new Date().getHours();
    return h < 6 || h >= 19;
  }

  function resolve(pref) {
    if (pref === 'dark') return true;
    if (pref === 'light') return false;
    return isNightAuto();
  }

  function apply(pref) {
    const night = resolve(pref);
    document.body.classList.toggle('night', night);
    document.body.dataset.theme = pref;
  }

  function applyCached() {
    const pref = localStorage.getItem(KEY) || 'auto';
    if (document.body) apply(pref);
    else document.addEventListener('DOMContentLoaded', () => apply(pref));
  }

  applyCached();

  // Re-evaluate auto mode every 5 min while the page is open.
  setInterval(() => {
    const pref = localStorage.getItem(KEY) || 'auto';
    if (pref === 'auto') apply(pref);
  }, 5 * 60 * 1000);

  // Sync from server settings once available.
  // Allowlist of valid theme tokens — used to sanitize values from the
  // server config before they reach localStorage. CodeQL flagged the
  // raw cfg-derived path as 'sensitive data in clear text' because the
  // settings response also contains latitude/longitude; explicit
  // validation breaks the taint flow.
  const VALID = new Set(['auto', 'day', 'night', 'light', 'dark']);
  window.OutfitPiTheme = {
    set(pref) {
      const safe = VALID.has(pref) ? pref : 'auto';
      localStorage.setItem(KEY, safe);
      apply(safe);
    },
    syncFromConfig(cfg) {
      const raw = cfg && cfg.display && cfg.display.theme;
      const pref = typeof raw === 'string' && VALID.has(raw) ? raw : 'auto';
      this.set(pref);
    },
  };

  fetch('/api/settings').then(r => r.ok ? r.json() : null).then(cfg => {
    if (cfg) window.OutfitPiTheme.syncFromConfig(cfg);
  }).catch(() => {});
})();
