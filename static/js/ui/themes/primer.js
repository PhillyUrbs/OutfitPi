// Primer (GitHub) theme. Primer ships CSS only — no JS components — so
// this theme reuses native's HTML elements and applies Primer's
// stylesheets + tokens. Light/dark via data-color-mode + data-light-theme
// / data-dark-theme on <body>.
import nativeTheme from './native.js';

const PRIMER_VERSION = '21.1.1';
const PRIMER_CSS = `https://cdnjs.cloudflare.com/ajax/libs/Primer/${PRIMER_VERSION}/primer.min.css`;

let _stylesAttached = false;

function attachPrimer() {
  if (_stylesAttached) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = PRIMER_CSS;
  link.id = 'primer-stylesheet';
  document.head.appendChild(link);

  const style = document.createElement('style');
  style.id = 'primer-theme-tokens';
  style.textContent = `
    body[data-ui-framework="primer"] {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
                   Helvetica, Arial, sans-serif;
    }
    body[data-ui-framework="primer"] button.primary,
    body[data-ui-framework="primer"] button.secondary,
    body[data-ui-framework="primer"] button.danger {
      /* Primer button base (compact). */
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 5px 16px;
      font-size: 14px;
      font-weight: 500;
      line-height: 20px;
      border-radius: 6px;
      border: 1px solid;
      cursor: pointer;
      min-height: 44px; /* touch target */
    }
    body[data-ui-framework="primer"] button.primary {
      background: var(--ui-accent, #1f883d);
      color: #fff;
      border-color: var(--ui-accent, #1f883d);
    }
    body[data-ui-framework="primer"] button.secondary {
      background: #f6f8fa;
      color: #24292f;
      border-color: rgba(31,35,40,0.15);
    }
    body[data-ui-framework="primer"] button.danger {
      background: #cf222e;
      color: #fff;
      border-color: #cf222e;
    }
    body[data-ui-framework="primer"][data-ui-variant="dark"] button.secondary,
    body[data-ui-framework="primer"].night button.secondary {
      background: #21262d;
      color: #c9d1d9;
      border-color: rgba(240,246,252,0.1);
    }
    /* Inputs */
    body[data-ui-framework="primer"] input[type="text"],
    body[data-ui-framework="primer"] input[type="number"],
    body[data-ui-framework="primer"] input[type="email"],
    body[data-ui-framework="primer"] select {
      padding: 5px 12px;
      font-size: 14px;
      line-height: 20px;
      color: #24292f;
      background: #ffffff;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      min-height: 44px;
    }
    body[data-ui-framework="primer"][data-ui-variant="dark"] input[type="text"],
    body[data-ui-framework="primer"][data-ui-variant="dark"] input[type="number"],
    body[data-ui-framework="primer"][data-ui-variant="dark"] input[type="email"],
    body[data-ui-framework="primer"][data-ui-variant="dark"] select,
    body[data-ui-framework="primer"].night input[type="text"],
    body[data-ui-framework="primer"].night input[type="number"],
    body[data-ui-framework="primer"].night input[type="email"],
    body[data-ui-framework="primer"].night select {
      color: #c9d1d9;
      background: #0d1117;
      border-color: #30363d;
    }
    /* Comfort slider stays the touch-friendly hand-built one — Primer
       doesn't ship a slider component. Override its accent. */
    body[data-ui-framework="primer"] .comfort-slider::-webkit-slider-thumb {
      background: var(--ui-accent, #1f883d) !important;
    }
    body[data-ui-framework="primer"] .comfort-slider::-moz-range-thumb {
      background: var(--ui-accent, #1f883d) !important;
    }
    body[data-ui-framework="primer"] .comfort-step {
      background: var(--ui-accent, #1f883d);
    }
  `;
  document.head.appendChild(style);
  _stylesAttached = true;
}

const primer = {
  id: 'primer',
  name: 'Primer',
  variants: ['auto', 'light', 'dark'],

  async init() {
    attachPrimer();
  },

  applyVariant(variant) {
    document.body.dataset.uiVariant = variant || 'auto';
    // Primer's data-color-mode contract.
    document.body.setAttribute('data-color-mode',
      variant === 'auto' ? 'auto' : variant);
    document.body.setAttribute('data-light-theme', 'light');
    document.body.setAttribute('data-dark-theme', 'dark');
  },

  destroy() {
    ['primer-stylesheet', 'primer-theme-tokens'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
    _stylesAttached = false;
    document.body.removeAttribute('data-color-mode');
    document.body.removeAttribute('data-light-theme');
    document.body.removeAttribute('data-dark-theme');
  },
};

// Primer reuses native's createXxx factories — no web components.
export default { ...nativeTheme, ...primer };
