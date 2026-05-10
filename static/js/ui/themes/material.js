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
    // Import only the components we use (tree-shakes via esm.sh).
    await Promise.all([
      import(`${ESM_BASE}/slider/slider.js?bundle`),
      import(`${ESM_BASE}/button/filled-button.js?bundle`),
      import(`${ESM_BASE}/button/outlined-button.js?bundle`),
      import(`${ESM_BASE}/button/text-button.js?bundle`),
      import(`${ESM_BASE}/switch/switch.js?bundle`),
      import(`${ESM_BASE}/select/filled-select.js?bundle`),
      import(`${ESM_BASE}/select/select-option.js?bundle`),
      import(`${ESM_BASE}/textfield/filled-text-field.js?bundle`),
      import(`${ESM_BASE}/radio/radio.js?bundle`),
    ]);
    _loaded = true;
  })();
  return _loadPromise;
}

// Material Web reads design tokens from CSS custom properties on its
// host. Inject a minimal theme block so light/dark feel right and the
// tokens line up with our orange accent.
function ensureThemeStyles() {
  if (document.getElementById('material-theme-tokens')) return;
  const style = document.createElement('style');
  style.id = 'material-theme-tokens';
  style.textContent = `
    /* Light defaults */
    body[data-ui-framework="material"] {
      --md-sys-color-primary: #ff9f43;
      --md-sys-color-on-primary: #ffffff;
      --md-sys-color-primary-container: #ffe5cc;
      --md-sys-color-on-primary-container: #2a1900;
      --md-sys-color-surface: #fffdf6;
      --md-sys-color-on-surface: #1b2233;
      --md-sys-color-error: #c62828;
      --md-sys-color-on-error: #ffffff;
      --md-sys-color-outline: #c6cbd1;
      --md-sys-color-secondary-container: #fde9d4;
      --md-sys-color-on-secondary-container: #2a1900;
    }
    body[data-ui-framework="material"][data-ui-variant="dark"],
    body[data-ui-framework="material"].night {
      --md-sys-color-primary: #ffb874;
      --md-sys-color-on-primary: #1f1300;
      --md-sys-color-primary-container: #5a3a14;
      --md-sys-color-on-primary-container: #ffe5cc;
      --md-sys-color-surface: #14213d;
      --md-sys-color-on-surface: #f0f4ff;
      --md-sys-color-error: #ff8a7a;
      --md-sys-color-on-error: #1f0d0a;
      --md-sys-color-outline: #344066;
      --md-sys-color-secondary-container: #2a3a72;
      --md-sys-color-on-secondary-container: #f0f4ff;
    }
    /* Make sliders/buttons fill their grid cell. */
    body[data-ui-framework="material"] md-slider {
      width: 100%;
      /* The host page sets touch-action: pan-y on <main> for the drag-
         scroll fallback; without overriding here, Chromium classifies
         the first touch as a vertical scroll and the slider never sees
         pointermove. 'none' lets md-slider run its own touch handlers. */
      touch-action: none;
    }
    body[data-ui-framework="material"] .comfort-row { touch-action: none; }
    body[data-ui-framework="material"] md-filled-button,
    body[data-ui-framework="material"] md-outlined-button,
    body[data-ui-framework="material"] md-text-button { min-height: 44px; }
  `;
  document.head.appendChild(style);
}

const material = {
  id: 'material',
  name: 'Material',
  variants: ['auto', 'light', 'dark'],

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
      r.name = name;
      r.value = opt.value;
      if (String(opt.value) === String(value)) r.checked = true;
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
