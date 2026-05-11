// Material Web theme — loads @material/web from esm.sh at runtime.
// Pinned version for reproducibility. Browser caches the bundle after
// first load so subsequent navigations are instant.
import nativeTheme from './native.js';

const MATERIAL_VERSION = '2.4.0';
const ESM_BASE = `https://esm.sh/@material/web@${MATERIAL_VERSION}`;

let _loaded = false;
let _loadPromise = null;

async function ensureMaterialLoaded() {
  if (_loaded) return;
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    // Load every component from a single bundle so shared dependencies
    // like md-focus-ring are only registered once. Importing each
    // component separately via ?bundle would duplicate-register and
    // throw NotSupportedError.
    await import(`${ESM_BASE}/all.js?bundle`);
    _loaded = true;
  })();
  return _loadPromise;
}

function ensureThemeStyles() {
  if (document.getElementById('material-theme-tokens')) return;
  const style = document.createElement('style');
  style.id = 'material-theme-tokens';
  style.textContent = `
    /* When a non-default colorway is active, derive Material tokens
       from the shared --ui-accent vars defined in colorways.css.
       Default colorway leaves Material's baseline palette alone. */
    body[data-ui-framework="material"][data-ui-colorway]:not([data-ui-colorway="default"]) {
      --md-sys-color-primary: var(--ui-accent);
      --md-sys-color-on-primary: var(--ui-accent-on);
      --md-sys-color-primary-container: var(--ui-accent-container);
      --md-sys-color-on-primary-container: var(--ui-accent-on-container);
      --md-sys-color-secondary-container: var(--ui-accent-container);
      --md-sys-color-on-secondary-container: var(--ui-accent-on-container);
    }
    /* Fill its grid cell. */
    body[data-ui-framework="material"] md-slider {
      width: 100%;
      touch-action: none;
      background: transparent !important;
      height: auto !important;
    }
    body[data-ui-framework="material"] .comfort-row { touch-action: none; }
    body[data-ui-framework="material"] .comfort-row .comfort-step {
      display: none;
    }
    body[data-ui-framework="material"] md-filled-button,
    body[data-ui-framework="material"] md-outlined-button,
    body[data-ui-framework="material"] md-text-button { min-height: 44px; }
    /* Dark color scheme: Material's defaults are light-mode; without
     * dark tokens, md-filled-text-field renders a white container with
     * inherited white body.night text → unreadable. Map a Material 3
     * baseline dark palette onto the root in night mode. We intentionally
     * key only on body.night (not the framework attribute) so this also
     * fires when the user has framework=fluent but lingering md-*
     * elements from a previous render are still on the page. */
    body.night {
      --md-sys-color-surface: #1c1b1f;
      --md-sys-color-on-surface: #e6e1e5;
      --md-sys-color-surface-container: #211f26;
      --md-sys-color-surface-container-high: #2b2930;
      --md-sys-color-surface-container-highest: #36343b;
      --md-sys-color-on-surface-variant: #cac4d0;
      --md-sys-color-outline: #938f99;
      --md-sys-color-outline-variant: #49454f;
      --md-sys-color-background: #141218;
      --md-sys-color-on-background: #e6e1e5;
      --md-sys-color-inverse-surface: #e6e1e5;
      --md-sys-color-inverse-on-surface: #313033;
      --md-sys-color-primary: #d0bcff;
      --md-sys-color-on-primary: #381e72;
      --md-sys-color-primary-container: #4f378b;
      --md-sys-color-on-primary-container: #eaddff;
      --md-sys-color-secondary: #ccc2dc;
      --md-sys-color-on-secondary: #332d41;
    }
  `;
  document.head.appendChild(style);
}

const material = {
  id: 'material',
  name: 'Material',
  variants: ['auto', 'light', 'dark'],

  // Awaited by the registry before any factory is called, so the very
  // first render uses defined custom elements.
  async init() {
    ensureThemeStyles();
    await ensureMaterialLoaded();
  },

  applyVariant(variant) {
    document.body.dataset.uiVariant = variant || 'auto';
    ensureThemeStyles();
  },

  createSlider({ min = 0, max = 100, step = 1, value = 0,
                 onInput, onChange, ariaLabel } = {}) {
    ensureMaterialLoaded();
    ensureThemeStyles();
    const s = document.createElement('md-slider');
    s.min = Number(min);
    s.max = Number(max);
    s.step = Number(step);
    s.value = Number(value);
    s.dataset.uiSlider = '1';
    s.setAttribute('labeled', '');
    if (ariaLabel) s.setAttribute('aria-label', ariaLabel);
    if (onInput)  s.addEventListener('input',  () => onInput(Number(s.value)));
    if (onChange) s.addEventListener('change', () => onChange(Number(s.value)));
    // Expose .value getter compatibly with raw <input type=range> consumers.
    Object.defineProperty(s, '_uiValue', {
      get() { return s.value; },
      set(v) { s.value = Number(v); },
    });
    return s;
  },

  createButton({ label = '', kind = 'secondary', onClick, type = 'button',
                 ariaLabel } = {}) {
    ensureMaterialLoaded();
    ensureThemeStyles();
    const tag = kind === 'primary' ? 'md-filled-button'
              : kind === 'danger'  ? 'md-filled-button'
              : 'md-outlined-button';
    const b = document.createElement(tag);
    b.textContent = label;
    b.type = type;
    if (kind === 'danger') b.classList.add('danger');
    if (ariaLabel) b.setAttribute('aria-label', ariaLabel);
    if (onClick) b.addEventListener('click', onClick);
    return b;
  },

  createSwitch({ checked = false, onChange, ariaLabel } = {}) {
    ensureMaterialLoaded();
    ensureThemeStyles();
    const wrap = document.createElement('label');
    wrap.className = 'big-toggle';
    const sw = document.createElement('md-switch');
    sw.selected = !!checked;
    if (ariaLabel) sw.setAttribute('aria-label', ariaLabel);
    if (onChange) sw.addEventListener('change',
      (e) => onChange(!!e.target.selected));
    wrap.append(sw);
    return wrap;
  },

  createSelect({ options = [], value = '', onChange, ariaLabel } = {}) {
    ensureMaterialLoaded();
    ensureThemeStyles();
    const sel = document.createElement('md-filled-select');
    if (ariaLabel) sel.setAttribute('aria-label', ariaLabel);
    for (const opt of options) {
      const o = document.createElement('md-select-option');
      o.value = opt.value;
      const txt = document.createElement('div');
      txt.slot = 'headline';
      txt.textContent = opt.label;
      o.append(txt);
      if (String(opt.value) === String(value)) o.selected = true;
      sel.append(o);
    }
    if (onChange) sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  },

  createInput({ type = 'text', value = '', placeholder = '', inputmode,
                onInput, onChange, ariaLabel } = {}) {
    ensureMaterialLoaded();
    ensureThemeStyles();
    const f = document.createElement('md-filled-text-field');
    f.type = type;
    f.value = String(value);
    if (placeholder) f.label = placeholder;
    if (inputmode) f.setAttribute('inputmode', inputmode);
    if (ariaLabel) f.setAttribute('aria-label', ariaLabel);
    if (onInput)  f.addEventListener('input',  () => onInput(f.value));
    if (onChange) f.addEventListener('change', () => onChange(f.value));
    return f;
  },

  createRadioGroup({ name, options = [], value = '', onChange } = {}) {
    ensureMaterialLoaded();
    ensureThemeStyles();
    const wrap = document.createElement('div');
    wrap.className = 'radio-group';
    wrap.setAttribute('role', 'radiogroup');
    for (const opt of options) {
      const lab = document.createElement('label');
      const r = document.createElement('md-radio');
      r.setAttribute('name', name);
      r.setAttribute('value', opt.value);
      if (String(opt.value) === String(value)) {
        r.checked = true;
        r.setAttribute('checked', '');
      }
      if (onChange) r.addEventListener('change',
        () => { if (r.checked) onChange(opt.value); });
      lab.append(r, ' ', opt.label);
      wrap.append(lab);
    }
    return wrap;
  },

  destroy() {
    const s = document.getElementById('material-theme-tokens');
    if (s) s.remove();
    delete document.body.dataset.uiVariant;
  },
};

// Inherit any factories we don't override (currently none) from native.
export default { ...nativeTheme, ...material };
