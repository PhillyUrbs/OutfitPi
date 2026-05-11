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
      max-width: 100%;
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
    /* Toggles built from labelled checkboxes (.big-toggle): kid theme
     * makes these full-width blue cards with 24px checkboxes; Primer
     * wants a tight inline label with a normal-size checkbox. */
    body[data-ui-framework="primer"] .big-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      background: transparent !important;
      border: none !important;
      border-radius: 0;
      margin: 6px 0;
      min-height: 0;
      cursor: pointer;
      font-size: 14px;
      font-weight: normal;
    }
    body[data-ui-framework="primer"] .big-toggle input {
      width: 14px !important;
      height: 14px !important;
      margin: 0;
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
    /* Override the kid-theme blue/red gradient on the actual track
     * pseudo-elements (the rule on .comfort-slider itself doesn't
     * reach ::-webkit-slider-runnable-track). */
    body[data-ui-framework="primer"] .comfort-slider::-webkit-slider-runnable-track {
      height: 6px;
      border-radius: 3px;
      background: #d0d7de;
    }
    body[data-ui-framework="primer"] .comfort-slider::-moz-range-track {
      height: 6px;
      border-radius: 3px;
      background: #d0d7de;
    }
    body[data-ui-framework="primer"][data-ui-variant="dark"] .comfort-slider::-webkit-slider-runnable-track,
    body[data-ui-framework="primer"].night .comfort-slider::-webkit-slider-runnable-track,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .comfort-slider::-moz-range-track,
    body[data-ui-framework="primer"].night .comfort-slider::-moz-range-track {
      background: #30363d;
    }
    body[data-ui-framework="primer"] .comfort-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #0969da;
      border: 2px solid #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      cursor: pointer;
      margin-top: -7px;
    }
    body[data-ui-framework="primer"] .comfort-slider::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #0969da;
      border: 2px solid #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      cursor: pointer;
    }
    body[data-ui-framework="primer"][data-ui-variant="dark"] .comfort-slider::-webkit-slider-thumb,
    body[data-ui-framework="primer"].night .comfort-slider::-webkit-slider-thumb,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .comfort-slider::-moz-range-thumb,
    body[data-ui-framework="primer"].night .comfort-slider::-moz-range-thumb {
      background: #2f81f7;
      border-color: #0d1117;
    }
    /* Force-install panel: kid theme uses a green dashed accent box
     * with oversized typography; Primer renders it as a plain Box
     * with normal sizes that fits between the surrounding fieldsets. */
    body[data-ui-framework="primer"] .dev-install {
      background: #f6f8fa;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      padding: 12px;
      margin-top: 8px;
    }
    body[data-ui-framework="primer"].night .dev-install,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .dev-install {
      background: #161b22;
      border-color: #30363d;
    }
    body[data-ui-framework="primer"] .ref-list {
      max-height: 220px;
      background: #ffffff;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      padding: 0;
    }
    body[data-ui-framework="primer"].night .ref-list,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .ref-list {
      background: #0d1117;
      border-color: #30363d;
    }
    body[data-ui-framework="primer"] .ref-group {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #656d76;
      padding: 8px 12px 4px;
      opacity: 1;
    }
    body[data-ui-framework="primer"].night .ref-group,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .ref-group {
      color: #7d8590;
    }
    body[data-ui-framework="primer"] .ref-item {
      padding: 6px 12px;
      border-radius: 0;
      min-height: 0;
    }
    body[data-ui-framework="primer"] .ref-item:hover {
      background: #f6f8fa;
    }
    body[data-ui-framework="primer"].night .ref-item:hover,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .ref-item:hover {
      background: #161b22;
    }
    body[data-ui-framework="primer"] .ref-item.selected {
      background: #0969da !important;
      color: #ffffff !important;
    }
    body[data-ui-framework="primer"].night .ref-item.selected,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .ref-item.selected {
      background: #1f6feb !important;
    }
    body[data-ui-framework="primer"] .ref-primary {
      font-size: 14px;
      font-weight: 500;
    }
    body[data-ui-framework="primer"] .ref-secondary {
      font-size: 12px;
      color: #656d76;
    }
    body[data-ui-framework="primer"].night .ref-secondary,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .ref-secondary {
      color: #7d8590;
    }
    body[data-ui-framework="primer"] .ref-item.selected .ref-secondary {
      color: rgba(255,255,255,0.85);
    }
    /* ── Dashboard surfaces ─────────────────────────────────────── */
    /* Weather + outfit panes become Primer Boxes (flat #f6f8fa /
     * #161b22 backgrounds with #d0d7de / #30363d borders). The kid
     * theme uses bright sun-yellow + grass-green tints; under Primer
     * we want neutral surfaces that match the rest of the GitHub feel. */
    body[data-ui-framework="primer"] .pane {
      background: #f6f8fa !important;
      color: #1f2328 !important;
      border: 1px solid #d0d7de;
      border-radius: 6px;
      padding: 12px;
    }
    body[data-ui-framework="primer"].night .pane,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .pane {
      background: #161b22 !important;
      color: #e6edf3 !important;
      border-color: #30363d;
    }
    body[data-ui-framework="primer"] .weather-pane,
    body[data-ui-framework="primer"] .outfit-pane,
    body[data-ui-framework="primer"] .outfit-pane.evening {
      background: #f6f8fa !important;
      color: #1f2328 !important;
    }
    body[data-ui-framework="primer"].night .weather-pane,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .weather-pane,
    body[data-ui-framework="primer"].night .outfit-pane,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .outfit-pane,
    body[data-ui-framework="primer"].night .outfit-pane.evening,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .outfit-pane.evening {
      background: #161b22 !important;
      color: #e6edf3 !important;
    }
    /* Hi/Lo: Primer red/blue instead of kid red/blue. */
    body[data-ui-framework="primer"] .weather-hilo .hi { color: #cf222e; }
    body[data-ui-framework="primer"] .weather-hilo .lo { color: #0969da; }
    body[data-ui-framework="primer"].night .weather-hilo .hi,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .weather-hilo .hi {
      color: #ff7b72;
    }
    body[data-ui-framework="primer"].night .weather-hilo .lo,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .weather-hilo .lo {
      color: #79c0ff;
    }
    /* Outfit pieces become subtle inset Boxes within the pane. */
    body[data-ui-framework="primer"] .piece {
      background: #ffffff;
      border: 1px solid #d0d7de;
      border-radius: 6px;
    }
    body[data-ui-framework="primer"].night .piece,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .piece {
      background: #0d1117;
      border-color: #30363d;
    }
    /* Banners: Primer Flash component look (yellow/red tinted box
     * with a subtle border, not the bright kid orange). */
    body[data-ui-framework="primer"] .rain-banner {
      background: #ddf4ff;
      color: #0969da;
      border: 1px solid rgba(84,174,255,0.4);
      border-radius: 6px;
      font-weight: 500;
    }
    body[data-ui-framework="primer"].night .rain-banner,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .rain-banner {
      background: #0c2d6b;
      color: #79c0ff;
      border-color: #1f6feb;
    }
    body[data-ui-framework="primer"] .stale-banner {
      background: #fff8c5;
      color: #7d4e00;
      border: 1px solid rgba(212,167,44,0.4);
      border-radius: 6px;
      font-weight: 500;
    }
    body[data-ui-framework="primer"].night .stale-banner,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .stale-banner {
      background: #341a00;
      color: #d29922;
      border-color: #9e6a03;
    }
    /* Dashboard typography: tighten the kid-theme oversized weather
     * temp + day so it reads as github.com-style data, not signage. */
    body[data-ui-framework="primer"] .weather-temp {
      font-weight: 600;
    }
    body[data-ui-framework="primer"] .weather-day {
      font-weight: 600;
    }
    body[data-ui-framework="primer"] .piece-label {
      font-weight: 500;
      color: #1f2328;
    }
    body[data-ui-framework="primer"].night .piece-label,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .piece-label {
      color: #e6edf3;
    }
    /* Bottombar */
    body[data-ui-framework="primer"] .bottombar {
      background: transparent;
      color: #656d76;
      border-top: 1px solid #d0d7de;
    }
    body[data-ui-framework="primer"].night .bottombar,
    body[data-ui-framework="primer"][data-ui-variant="dark"] .bottombar {
      color: #7d8590;
      border-top-color: #30363d;
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
