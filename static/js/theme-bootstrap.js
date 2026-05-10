// Boot the UI framework picked in user prefs. Runs before any page-
// specific JS so the framework is ready when settings.js / app.js
// start creating components.
import { loadTheme, ui, currentTheme } from './ui/index.js';

// Expose the adapter to non-module scripts (settings.js etc).
window.OutfitPiUI = window.OutfitPiUI || {};
window.OutfitPiUI.ui = ui;
window.OutfitPiUI.currentTheme = currentTheme;

// Promise other scripts can await before they start creating components.
let _readyResolve;
window.OutfitPiUI.ready = new Promise((res) => { _readyResolve = res; });

const KEY_FRAMEWORK = 'outfitpi_framework';
const KEY_VARIANT   = 'outfitpi_variant';

async function bootFromCache() {
  const fw = localStorage.getItem(KEY_FRAMEWORK) || 'material';
  const variant = localStorage.getItem(KEY_VARIANT) || 'auto';
  await loadTheme(fw, variant);
}

async function syncFromConfig() {
  try {
    const r = await fetch('/api/settings');
    if (!r.ok) return;
    const cfg = await r.json();
    const d = cfg.display || {};
    const fw = d.framework || 'material';
    const variant = d.variant || d.theme || 'auto';
    localStorage.setItem(KEY_FRAMEWORK, fw);
    localStorage.setItem(KEY_VARIANT, variant);
    await loadTheme(fw, variant);
  } catch {}
}

window.OutfitPiUI = {
  ...window.OutfitPiUI,
  async setFramework(fw, variant) {
    if (fw)      localStorage.setItem(KEY_FRAMEWORK, fw);
    if (variant) localStorage.setItem(KEY_VARIANT, variant);
    await loadTheme(fw, variant);
  },
};

// Boot order: load from cache (instant), resolve `ready` so consumers
// can render, then sync from server in the background. Server-driven
// theme changes update localStorage but don't re-render — too disruptive.
bootFromCache()
  .then(() => _readyResolve())
  .then(syncFromConfig);
