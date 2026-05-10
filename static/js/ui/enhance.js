// In-place control enhancer. Walks the page after the active theme is
// loaded and replaces native HTML controls with the theme's component
// equivalents. Templates stay readable as plain HTML; themes get to
// wrap them with web components or fancy styling.
//
// Native theme is a no-op (the existing HTML already IS the native
// implementation). Other themes (Material, Fluent, Primer) replace
// elements one family at a time as we add support.
//
// Conventions:
//  - Buttons skipped if they have data-no-enhance, .icon-btn (back arrow,
//    settings gear), or live inside the on-screen keyboard.
//  - Each replaced node copies id, name, class list, dataset, ARIA, and
//    rewires existing event listeners by re-dispatching click/change.

import { ui, currentTheme } from './ui/index.js';

const SKIP_BUTTON_CLASSES = ['icon-btn', 'comfort-step', 'keyboard-hide'];
const SKIP_PARENTS = ['.keyboard-container', '.dev-toggle', '.restart-overlay'];

function shouldSkipButton(btn) {
  if (btn.dataset.noEnhance === '1') return true;
  if (btn.dataset.uiEnhanced === '1') return true;
  if (SKIP_BUTTON_CLASSES.some(c => btn.classList.contains(c))) return true;
  if (SKIP_PARENTS.some(sel => btn.closest(sel))) return true;
  // Buttons that the page rebuilds dynamically (child remove ×) skip too.
  if (btn.dataset.rm !== undefined) return true;
  return false;
}

function copyAttrs(src, dst) {
  if (src.id) dst.id = src.id;
  if (src.className) dst.className = src.className;
  if (src.name) dst.name = src.name;
  // Copy data-* and aria-*.
  for (const a of src.attributes) {
    if (a.name.startsWith('data-') || a.name.startsWith('aria-')) {
      dst.setAttribute(a.name, a.value);
    }
  }
}

/**
 * Replace every <button> on the page with the theme's button component,
 * preserving attributes + click handlers.
 */
export function enhanceButtons(root = document) {
  if (currentTheme() === 'native') return; // nothing to do
  const buttons = root.querySelectorAll('button');
  buttons.forEach((btn) => {
    if (shouldSkipButton(btn)) return;

    const kind = btn.classList.contains('primary') ? 'primary'
              : btn.classList.contains('danger')   ? 'danger'
              : 'secondary';

    const replacement = ui.createButton({
      label: btn.textContent,
      kind,
      type: btn.type || 'button',
      ariaLabel: btn.getAttribute('aria-label'),
      // We re-dispatch into the original node so existing
      // addEventListener('click', ...) wiring keeps working.
      onClick: (e) => {
        // Synthesize a click on a hidden proxy that carries the original's
        // listeners. We do this by keeping the original button in the DOM
        // (display: none) and forwarding clicks.
        proxy.click();
        e.stopPropagation();
      },
    });
    copyAttrs(btn, replacement);
    replacement.dataset.uiEnhanced = '1';

    // Hide the original but keep it in the DOM so any addEventListener
    // already wired by other scripts continues to fire.
    const proxy = btn;
    proxy.style.display = 'none';
    proxy.dataset.uiProxy = '1';
    btn.parentNode.insertBefore(replacement, btn.nextSibling);
  });
}

/** Re-run enhancers when the page mutates (e.g. settings re-renders). */
export function watchAndEnhance(root = document.body) {
  enhanceButtons(root);
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.tagName === 'BUTTON') enhanceButtons(n.parentNode || root);
        else enhanceButtons(n);
      });
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  return observer;
}
