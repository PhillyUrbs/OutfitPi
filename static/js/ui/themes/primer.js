// Primer (GitHub) theme. Primer ships CSS only — no JS components — so
// this theme reuses native's HTML elements and applies Primer's
// stylesheets + tokens. Light/dark via data-color-mode + data-light-theme
// / data-dark-theme on <body>.
import nativeTheme from './native.js';

const PRIMER_VERSION = '21.1.1';
// Vendored locally to avoid kiosk dependency on cdnjs (and the
// occasional slow load that hung Playwright reload tests).
const PRIMER_CSS = `/static/vendor/primer/primer.min.css`;

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
    /* ── GitHub Primer dark + light surfaces ────────────────────── */
    body[data-ui-framework="primer"] {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
                   "Noto Sans", Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
    }
    /* Light mode (Primer day): #ffffff canvas, #f6f8fa subtle */
    body[data-ui-framework="primer"]:not(.night):not([data-ui-variant="dark"]) {
      background: #ffffff !important;
      color: #1f2328 !important;
    }
    /* Dark mode (Primer dark): #0d1117 canvas, #161b22 subtle */
    body[data-ui-framework="primer"].night,
    body[data-ui-framework="primer"][data-ui-variant="dark"] {
      background: #0d1117 !important;
      color: #e6edf3 !important;
    }
    /* Topbar: GitHub uses a dark slate (#24292f) regardless of mode. */
    body[data-ui-framework="primer"] .topbar {
      background: #24292f !important;
      color: #ffffff !important;
      border-bottom: 1px solid #30363d;
    }
    /* Footer/bottombar */
    body[data-ui-framework="primer"] .bottombar {
      background: transparent;
      border-top: 1px solid #d0d7de;
      color: #656d76;
    }
    body[data-ui-framework="primer"].night .bottombar {
      border-top-color: #30363d;
      color: #7d8590;
    }
    /* Fieldsets become Primer Box: rounded card with neutral border. */
    body[data-ui-framework="primer"] fieldset {
      background: #ffffff;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 16px;
    }
    body[data-ui-framework="primer"].night fieldset,
    body[data-ui-framework="primer"][data-ui-variant="dark"] fieldset {
      background: #161b22;
      border-color: #30363d;
    }
    body[data-ui-framework="primer"] legend {
      font-weight: 600;
      font-size: 14px;
      color: #1f2328;
      padding: 0 8px;
    }
    body[data-ui-framework="primer"].night legend {
      color: #e6edf3;
    }
    /* Buttons */
    body[data-ui-framework="primer"] button.primary,
    body[data-ui-framework="primer"] button.secondary,
    body[data-ui-framework="primer"] button.danger {
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
      min-height: 32px;
      box-shadow: 0 1px 0 rgba(31,35,40,0.04);
      transition: background-color 0.1s;
    }
    body[data-ui-framework="primer"] button.primary {
      background: #1f883d;
      color: #ffffff;
      border-color: rgba(31,35,40,0.15);
    }
    body[data-ui-framework="primer"] button.primary:hover {
      background: #1a7f37;
    }
    body[data-ui-framework="primer"] button.secondary,
    body[data-ui-framework="primer"] button:not(.primary):not(.danger):not(.icon-btn):not(.comfort-step) {
      background: #f6f8fa;
      color: #1f2328;
      border-color: rgba(31,35,40,0.15);
    }
    body[data-ui-framework="primer"] button.secondary:hover,
    body[data-ui-framework="primer"] button:not(.primary):not(.danger):not(.icon-btn):not(.comfort-step):hover {
      background: #f3f4f6;
      border-color: rgba(31,35,40,0.15);
    }
    body[data-ui-framework="primer"].night button.secondary,
    body[data-ui-framework="primer"][data-ui-variant="dark"] button.secondary,
    body[data-ui-framework="primer"].night button:not(.primary):not(.danger):not(.icon-btn):not(.comfort-step),
    body[data-ui-framework="primer"][data-ui-variant="dark"] button:not(.primary):not(.danger):not(.icon-btn):not(.comfort-step) {
      background: #21262d;
      color: #e6edf3;
      border-color: #30363d;
    }
    body[data-ui-framework="primer"].night button.secondary:hover,
    body[data-ui-framework="primer"][data-ui-variant="dark"] button.secondary:hover,
    body[data-ui-framework="primer"].night button:not(.primary):not(.danger):not(.icon-btn):not(.comfort-step):hover,
    body[data-ui-framework="primer"][data-ui-variant="dark"] button:not(.primary):not(.danger):not(.icon-btn):not(.comfort-step):hover {
      background: #30363d;
      border-color: #8b949e;
    }
    body[data-ui-framework="primer"] button.danger {
      background: #cf222e;
      color: #ffffff;
      border-color: rgba(31,35,40,0.15);
    }
    body[data-ui-framework="primer"] button.danger:hover {
      background: #a40e26;
    }
    /* Inputs */
    body[data-ui-framework="primer"] input[type="text"],
    body[data-ui-framework="primer"] input[type="number"],
    body[data-ui-framework="primer"] input[type="email"],
    body[data-ui-framework="primer"] select {
      padding: 5px 12px;
      font-size: 14px;
      line-height: 20px;
      color: #1f2328;
      background: #ffffff;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      min-height: 32px;
      box-shadow: inset 0 1px 0 rgba(208,215,222,0.2);
    }
    body[data-ui-framework="primer"] input[type="text"]:focus,
    body[data-ui-framework="primer"] input[type="number"]:focus,
    body[data-ui-framework="primer"] input[type="email"]:focus,
    body[data-ui-framework="primer"] select:focus {
      border-color: #0969da;
      outline: none;
      box-shadow: 0 0 0 3px rgba(9,105,218,0.3);
    }
    body[data-ui-framework="primer"][data-ui-variant="dark"] input[type="text"],
    body[data-ui-framework="primer"][data-ui-variant="dark"] input[type="number"],
    body[data-ui-framework="primer"][data-ui-variant="dark"] input[type="email"],
    body[data-ui-framework="primer"][data-ui-variant="dark"] select,
    body[data-ui-framework="primer"].night input[type="text"],
    body[data-ui-framework="primer"].night input[type="number"],
    body[data-ui-framework="primer"].night input[type="email"],
    body[data-ui-framework="primer"].night select {
      color: #e6edf3;
      background: #0d1117;
      border-color: #30363d;
      box-shadow: none;
    }
    body[data-ui-framework="primer"].night input:focus,
    body[data-ui-framework="primer"][data-ui-variant="dark"] input:focus,
    body[data-ui-framework="primer"].night select:focus,
    body[data-ui-framework="primer"][data-ui-variant="dark"] select:focus {
      border-color: #2f81f7;
      box-shadow: 0 0 0 3px rgba(47,129,247,0.4);
    }
    /* Checkboxes / radios: Primer accent. */
    body[data-ui-framework="primer"] input[type="checkbox"],
    body[data-ui-framework="primer"] input[type="radio"] {
      accent-color: #0969da;
    }
    body[data-ui-framework="primer"].night input[type="checkbox"],
    body[data-ui-framework="primer"][data-ui-variant="dark"] input[type="checkbox"],
    body[data-ui-framework="primer"].night input[type="radio"],
    body[data-ui-framework="primer"][data-ui-variant="dark"] input[type="radio"] {
      accent-color: #2f81f7;
    }
    /* Toggles built from labelled checkboxes (.big-toggle) */
    body[data-ui-framework="primer"] .big-toggle {
      background: #f6f8fa;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      padding: 12px;
    }
    body[data-ui-framework="primer"].night .big-toggle,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .big-toggle {
      background: #161b22;
      border-color: #30363d;
    }
    /* Section headings, hints, labels */
    body[data-ui-framework="primer"] h2,
    body[data-ui-framework="primer"] h3 {
      font-weight: 600;
    }
    body[data-ui-framework="primer"] .hint,
    body[data-ui-framework="primer"] small {
      color: #656d76;
    }
    body[data-ui-framework="primer"].night .hint,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .hint,
    body[data-ui-framework="primer"].night small,
    body[data-ui-framework="primer"][data-ui-variant="dark"] small {
      color: #7d8590;
    }
    /* Comfort slider: GitHub-styled track + green thumb. Hide the
     * touch-fallback +/- buttons (slider's plenty draggable). */
    body[data-ui-framework="primer"] .comfort-row .comfort-step {
      display: none;
    }
    body[data-ui-framework="primer"] .comfort-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      background: #d0d7de;
      border-radius: 3px;
      outline: none;
      touch-action: none;
    }
    body[data-ui-framework="primer"][data-ui-variant="dark"] .comfort-slider,
    body[data-ui-framework="primer"].night .comfort-slider {
      background: #30363d;
    }
    body[data-ui-framework="primer"] .comfort-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #1f883d;
      border: 2px solid #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      cursor: pointer;
    }
    body[data-ui-framework="primer"] .comfort-slider::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #1f883d;
      border: 2px solid #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      cursor: pointer;
    }
    body[data-ui-framework="primer"][data-ui-variant="dark"] .comfort-slider::-webkit-slider-thumb,
    body[data-ui-framework="primer"].night .comfort-slider::-webkit-slider-thumb,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .comfort-slider::-moz-range-thumb,
    body[data-ui-framework="primer"].night .comfort-slider::-moz-range-thumb {
      border-color: #0d1117;
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
