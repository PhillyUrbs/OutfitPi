// Theme adapter: lets the rest of the app build inputs/buttons/etc.
// without caring which UI framework is active.
//
// Themes are plain ES modules under `themes/<id>.js` exporting a default
// object. See themes/native.js for the contract. Adding a theme is one
// new file in this directory + adding its id to AVAILABLE_THEMES.
import nativeTheme from './themes/native.js';

export const AVAILABLE_THEMES = ['native', 'material', 'fluent', 'primer'];

// The active theme. Starts as native so any code that runs before
// loadTheme() resolves still gets a working UI.
export const ui = { ...nativeTheme };

let _current = 'native';

function attachStylesheet(href) {
  const existing = document.querySelector(`link[data-theme-style="${href}"]`);
  if (existing) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `/static/${href}`;
  link.dataset.themeStyle = href;
  document.head.appendChild(link);
}

function detachStylesheets(forTheme) {
  document.querySelectorAll(`link[data-theme-style][data-theme-owner="${forTheme}"]`)
    .forEach(n => n.remove());
}

/**
 * Load a theme module, attach its assets, and replace `ui`'s factories
 * with whatever the theme provides. Anything the theme doesn't implement
 * falls back to the native implementation.
 *
 * Returns the loaded theme's id (which may be `native` if the requested
 * one threw on import).
 */
export async function loadTheme(id, variant = 'auto') {
  if (!AVAILABLE_THEMES.includes(id)) id = 'native';
  if (id === _current) {
    // Just re-apply the variant.
    if (typeof ui.applyVariant === 'function') {
      try { ui.applyVariant(variant); } catch {}
    }
    return id;
  }
  try {
    const mod = await import(`./themes/${id}.js`);
    const theme = mod.default;
    if (theme.styles) {
      theme.styles.forEach(href => {
        attachStylesheet(href);
        const el = document.querySelector(`link[data-theme-style="${href}"]`);
        if (el) el.dataset.themeOwner = id;
      });
    }
    if (theme.vendor) {
      // ESM dynamic import; kiosk should have all assets vendored locally.
      await import(`/static/${theme.vendor}`);
    }
    // If the theme exposes an init() (e.g. to await dynamic CDN imports
    // before any factory is called), block here so the first render uses
    // a fully-defined theme.
    if (typeof theme.init === 'function') {
      try { await theme.init(); } catch (e) {
        console.warn(`Theme '${id}' init() failed`, e);
      }
    }
    // Tear down the previous theme.
    if (typeof ui.destroy === 'function') {
      try { ui.destroy(); } catch {}
    }
    if (_current !== 'native') detachStylesheets(_current);
    // Compose: native fallback + theme overrides.
    Object.keys(ui).forEach(k => delete ui[k]);
    Object.assign(ui, nativeTheme, theme);
    _current = id;
    if (typeof ui.applyVariant === 'function') {
      try { ui.applyVariant(variant); } catch {}
    }
    document.body.dataset.uiFramework = id;
    return id;
  } catch (err) {
    console.warn(`Theme '${id}' failed to load; falling back to native`, err);
    Object.keys(ui).forEach(k => delete ui[k]);
    Object.assign(ui, nativeTheme);
    _current = 'native';
    document.body.dataset.uiFramework = 'native';
    return 'native';
  }
}

export function currentTheme() {
  return _current;
}
