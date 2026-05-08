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
  window.OutfitPiTheme = {
    set(pref) {
      localStorage.setItem(KEY, pref);
      apply(pref);
    },
    syncFromConfig(cfg) {
      const pref = (cfg && cfg.display && cfg.display.theme) || 'auto';
      this.set(pref);
    },
  };

  fetch('/api/settings').then(r => r.ok ? r.json() : null).then(cfg => {
    if (cfg) window.OutfitPiTheme.syncFromConfig(cfg);
  }).catch(() => {});
})();
