// Fluent UI theme — loads @fluentui/web-components from esm.sh.
// v3 is the modern Web Components version; ships Fluent 2 design tokens.
import nativeTheme from './native.js';

const FLUENT_VERSION = '3.0.0-beta.86';
const ESM_URL = `https://esm.sh/@fluentui/web-components@${FLUENT_VERSION}?bundle`;

let _loaded = false;
let _loadPromise = null;

async function ensureFluentLoaded() {
  if (_loaded) return;
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    await import(ESM_URL);
    _loaded = true;
  })();
  return _loadPromise;
}

function ensureThemeStyles() {
  if (document.getElementById('fluent-theme-tokens')) return;
  const style = document.createElement('style');
  style.id = 'fluent-theme-tokens';
  style.textContent = `
    /* When a non-default colorway is active, redirect Fluent's accent
       tokens to our shared --ui-accent variables. Default leaves
       Fluent's own brand palette intact. */
    body[data-ui-framework="fluent"][data-ui-colorway]:not([data-ui-colorway="default"]) {
      --colorBrandBackground: var(--ui-accent);
      --colorBrandBackgroundHover: var(--ui-accent);
      --colorBrandBackgroundPressed: var(--ui-accent);
      --colorBrandStroke1: var(--ui-accent);
      --colorBrandForeground1: var(--ui-accent);
      --colorBrandForegroundOnLight: var(--ui-accent);
    }
    body[data-ui-framework="fluent"] fluent-slider {
      width: 100%;
      touch-action: none;
    }
    body[data-ui-framework="fluent"] .comfort-row { touch-action: none; }
    body[data-ui-framework="fluent"] .comfort-row .comfort-step {
      display: none;
    }
    body[data-ui-framework="fluent"] fluent-button { min-height: 44px; }
  `;
  document.head.appendChild(style);
}

const fluent = {
  id: 'fluent',
  name: 'Fluent',
  variants: ['auto', 'light', 'dark'],

  async init() {
    ensureThemeStyles();
    await ensureFluentLoaded();
  },

  applyVariant(variant) {
    document.body.dataset.uiVariant = variant || 'auto';
    ensureThemeStyles();
  },

  createSlider({ min = 0, max = 100, step = 1, value = 0,
                 onInput, onChange, ariaLabel } = {}) {
    ensureThemeStyles();
    const s = document.createElement('fluent-slider');
    s.min = String(min);
    s.max = String(max);
    s.step = String(step);
    s.value = String(value);
    s.dataset.uiSlider = '1';
    if (ariaLabel) s.setAttribute('aria-label', ariaLabel);
    if (onInput)  s.addEventListener('input',  () => onInput(Number(s.value)));
    if (onChange) s.addEventListener('change', () => onChange(Number(s.value)));
    return s;
  },

  createButton({ label = '', kind = 'secondary', onClick, type = 'button',
                 ariaLabel } = {}) {
    ensureThemeStyles();
    const b = document.createElement('fluent-button');
    b.textContent = label;
    b.setAttribute('appearance', kind === 'primary' ? 'primary'
                              : kind === 'danger'  ? 'primary'
                              : 'outline');
    if (kind === 'danger') b.classList.add('danger');
    b.type = type;
    if (ariaLabel) b.setAttribute('aria-label', ariaLabel);
    if (onClick) b.addEventListener('click', onClick);
    return b;
  },

  createSwitch({ checked = false, onChange, ariaLabel } = {}) {
    ensureThemeStyles();
    const wrap = document.createElement('label');
    wrap.className = 'big-toggle';
    const sw = document.createElement('fluent-switch');
    if (checked) sw.setAttribute('checked', '');
    if (ariaLabel) sw.setAttribute('aria-label', ariaLabel);
    if (onChange) sw.addEventListener('change',
      (e) => onChange(!!e.target.checked));
    wrap.append(sw);
    return wrap;
  },

  createSelect({ options = [], value = '', onChange, ariaLabel } = {}) {
    ensureThemeStyles();
    const sel = document.createElement('fluent-select');
    if (ariaLabel) sel.setAttribute('aria-label', ariaLabel);
    for (const opt of options) {
      const o = document.createElement('fluent-option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (String(opt.value) === String(value)) o.setAttribute('selected', '');
      sel.append(o);
    }
    if (onChange) sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  },

  createInput({ type = 'text', value = '', placeholder = '', inputmode,
                onInput, onChange, ariaLabel } = {}) {
    ensureThemeStyles();
    const f = document.createElement('fluent-text-input');
    f.setAttribute('type', type);
    f.value = String(value);
    if (placeholder) f.setAttribute('placeholder', placeholder);
    if (inputmode) f.setAttribute('inputmode', inputmode);
    if (ariaLabel) f.setAttribute('aria-label', ariaLabel);
    if (onInput)  f.addEventListener('input',  () => onInput(f.value));
    if (onChange) f.addEventListener('change', () => onChange(f.value));
    return f;
  },

  createRadioGroup({ name, options = [], value = '', onChange } = {}) {
    ensureThemeStyles();
    const wrap = document.createElement('fluent-radio-group');
    wrap.setAttribute('name', name);
    if (value) wrap.setAttribute('value', value);
    for (const opt of options) {
      const r = document.createElement('fluent-radio');
      r.setAttribute('value', opt.value);
      r.textContent = opt.label;
      wrap.append(r);
    }
    if (onChange) wrap.addEventListener('change', () => onChange(wrap.value));
    return wrap;
  },

  destroy() {
    const s = document.getElementById('fluent-theme-tokens');
    if (s) s.remove();
  },
};

export default { ...nativeTheme, ...fluent };
