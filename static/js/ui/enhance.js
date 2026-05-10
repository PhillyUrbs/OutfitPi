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
//  - Each control type has its own skip rules (see should* functions).
//  - The original native control stays in the DOM hidden so existing
//    addEventListener wiring keeps firing; we forward events from the
//    themed replacement back into the proxy.

import { ui, currentTheme } from './index.js';

const SKIP_BUTTON_CLASSES = ['icon-btn', 'comfort-step', 'keyboard-hide'];
const SKIP_PARENTS = ['.keyboard-container', '.dev-toggle', '.restart-overlay'];

function inSkipParent(el) {
  return SKIP_PARENTS.some(sel => el.closest(sel));
}

function shouldSkipButton(btn) {
  if (btn.dataset.noEnhance === '1') return true;
  if (btn.dataset.uiEnhanced === '1') return true;
  if (btn.dataset.uiProxy === '1') return true;
  if (SKIP_BUTTON_CLASSES.some(c => btn.classList.contains(c))) return true;
  if (inSkipParent(btn)) return true;
  if (btn.dataset.rm !== undefined) return true;
  return false;
}

function shouldSkipInput(el) {
  if (el.dataset.noEnhance === '1') return true;
  if (el.dataset.uiEnhanced === '1') return true;
  if (el.dataset.uiProxy === '1') return true;
  if (el.dataset.uiSlider === '1') return true;
  if (inSkipParent(el)) return true;
  // Skip if this element's parent label has already been hidden as a proxy.
  const lab = el.closest('label');
  if (lab && lab.dataset.uiProxy === '1') return true;
  return false;
}

function copyAttrs(src, dst) {
  if (src.id) dst.id = src.id;
  if (src.className) dst.className = src.className;
  if (src.name) dst.name = src.name;
  for (const a of src.attributes) {
    if (a.name.startsWith('data-') || a.name.startsWith('aria-')) {
      dst.setAttribute(a.name, a.value);
    }
  }
}

function hideProxy(el) {
  el.style.display = 'none';
  el.dataset.uiProxy = '1';
  // Stop synthesized click events on the hidden proxy from reaching
  // Material's outside-click detector at the document level. Material's
  // <md-filled-select> programmatically fires click on its internal
  // form-associated <select>; that bubbles up the same composed path
  // as a real outside click, so the menu we just opened closes
  // immediately. preventDefault + stopImmediatePropagation here
  // intercepts before any document-level listener.
  if (!el._uiProxyClickGuarded) {
    const stop = (e) => {
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
    };
    el.addEventListener('click', stop, true);
    el.addEventListener('mousedown', stop, true);
    el.addEventListener('pointerdown', stop, true);
    el._uiProxyClickGuarded = true;
  }
}

/** Re-read the proxy's current value into its themed replacement. Used
 * after page-init code (e.g. settings.js renderAll) sets values on the
 * native controls *after* the enhancer ran. */
function syncReplacement(proxy) {
  let r = proxy.nextSibling;
  while (r && r.nodeType !== 1) r = r.nextSibling;
  if (!r || r.dataset.uiEnhanced !== '1') return;
  const tag = r.tagName;
  if (tag === 'MD-FILLED-SELECT' || tag === 'MD-OUTLINED-SELECT' || tag === 'FLUENT-SELECT') {
    // Selects: explicitly set selected on the matching option (md-filled-
    // select doesn't always re-render when only .value is set).
    const want = String(proxy.value);
    r.querySelectorAll('md-select-option, fluent-option').forEach(o => {
      const match = String(o.value) === want;
      if (match) {
        o.selected = true;
        o.setAttribute('selected', '');
      } else {
        o.selected = false;
        o.removeAttribute('selected');
      }
    });
    try { r.value = want; } catch {}
    return;
  }
  if (tag === 'MD-SWITCH' || tag === 'FLUENT-SWITCH') {
    r.selected = !!proxy.checked;
    if (proxy.checked) r.setAttribute('selected', '');
    else r.removeAttribute('selected');
    return;
  }
  if (tag === 'MD-RADIO' || tag === 'FLUENT-RADIO') {
    r.checked = !!proxy.checked;
    return;
  }
  // Text fields, sliders, anything with a .value property.
  if ('value' in r) {
    try { r.value = proxy.value; } catch {}
  }
}

/** Walk the page and re-sync every themed replacement from its proxy.
 * Exported so settings.js can call it after renderAll() populates fields. */
export function syncAllReplacements(root = document) {
  root.querySelectorAll('[data-ui-proxy="1"]').forEach(syncReplacement);
  // Radio groups are special: the proxies are individual <input type=radio>
  // wrapped in a <label data-ui-proxy>. Find each replacement radio-group
  // and set the checked option from whichever proxy radio is checked.
  root.querySelectorAll('[role="radiogroup"][data-ui-enhanced="1"]').forEach(group => {
    // Walk back to find the original radios sharing the same name.
    const name = group.querySelector('md-radio, fluent-radio')?.getAttribute('name');
    if (!name) return;
    const radios = Array.from(document.querySelectorAll(
      `input[type="radio"][name="${CSS.escape(name)}"]`));
    const checkedVal = (radios.find(r => r.checked) || {}).value;
    if (!checkedVal) return;
    group.querySelectorAll('md-radio, fluent-radio').forEach(r => {
      r.checked = (r.getAttribute('value') === checkedVal);
    });
  });
}

/**
 * Replace every <button> on the page with the theme's button component.
 */
export function enhanceButtons(root = document) {
  if (currentTheme() === 'native') return;
  root.querySelectorAll('button').forEach((btn) => {
    if (shouldSkipButton(btn)) return;
    const kind = btn.classList.contains('primary') ? 'primary'
              : btn.classList.contains('danger')   ? 'danger'
              : 'secondary';
    const proxy = btn;
    const replacement = ui.createButton({
      label: btn.textContent,
      kind,
      type: btn.type || 'button',
      ariaLabel: btn.getAttribute('aria-label'),
      onClick: (e) => { proxy.click(); e.stopPropagation(); },
    });
    copyAttrs(btn, replacement);
    replacement.dataset.uiEnhanced = '1';
    hideProxy(proxy);
    btn.parentNode.insertBefore(replacement, btn.nextSibling);
  });
}

/**
 * Replace every <select> with the theme's select component.
 * The themed select fires `change` and we forward to the proxy.
 */
export function enhanceSelects(root = document) {
  if (currentTheme() === 'native') return;
  root.querySelectorAll('select').forEach((sel) => {
    if (shouldSkipInput(sel)) return;
    const options = Array.from(sel.options).map(o => ({
      value: o.value,
      label: o.textContent,
      disabled: o.disabled,
    }));
    const proxy = sel;
    const replacement = ui.createSelect({
      options,
      value: sel.value,
      ariaLabel: sel.getAttribute('aria-label'),
      onChange: (v) => {
        proxy.value = v;
        proxy.dispatchEvent(new Event('change', { bubbles: true }));
      },
    });
    copyAttrs(sel, replacement);
    replacement.dataset.uiEnhanced = '1';
    hideProxy(proxy);
    sel.parentNode.insertBefore(replacement, sel.nextSibling);
  });
}

/**
 * Replace every checkbox with the theme's switch component (preserving
 * the label text wrapping the input).
 */
export function enhanceSwitches(root = document) {
  if (currentTheme() === 'native') return;
  root.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    if (shouldSkipInput(cb)) return;
    const proxy = cb;
    const replacement = ui.createSwitch({
      checked: cb.checked,
      ariaLabel: cb.getAttribute('aria-label'),
      onChange: (v) => {
        proxy.checked = v;
        proxy.dispatchEvent(new Event('change', { bubbles: true }));
      },
    });
    copyAttrs(cb, replacement);
    replacement.dataset.uiEnhanced = '1';
    // Switch factories return a wrapper <label>, but we want to keep
    // the existing label text. Insert just the inner switch element
    // before the proxy and let the existing parent label hold the text.
    const innerSwitch = replacement.querySelector('md-switch, fluent-switch') || replacement;
    hideProxy(proxy);
    cb.parentNode.insertBefore(innerSwitch, cb.nextSibling);
  });
}

/**
 * Replace every text/number/email input with the theme's input
 * component. Range inputs are handled by the slider factory and are
 * skipped here via data-ui-slider.
 */
export function enhanceTextInputs(root = document) {
  if (currentTheme() === 'native') return;
  const sel = 'input[type="text"], input[type="number"], input[type="email"]';
  root.querySelectorAll(sel).forEach((inp) => {
    if (shouldSkipInput(inp)) return;
    const proxy = inp;
    const replacement = ui.createInput({
      type: inp.type,
      value: inp.value,
      placeholder: inp.placeholder,
      inputmode: inp.getAttribute('inputmode'),
      ariaLabel: inp.getAttribute('aria-label'),
      onInput: (v) => { proxy.value = v; },
      onChange: (v) => {
        proxy.value = v;
        proxy.dispatchEvent(new Event('change', { bubbles: true }));
      },
    });
    copyAttrs(inp, replacement);
    replacement.dataset.uiEnhanced = '1';
    hideProxy(proxy);
    inp.parentNode.insertBefore(replacement, inp.nextSibling);
  });
}

/**
 * Replace radio groups (groups of <input type="radio" name="X">) with
 * the theme's radio-group component.
 */
export function enhanceRadios(root = document) {
  if (currentTheme() === 'native') return;
  const groups = new Map();
  root.querySelectorAll('input[type="radio"]').forEach((r) => {
    if (shouldSkipInput(r)) return;
    if (!r.name) return;
    if (!groups.has(r.name)) groups.set(r.name, []);
    groups.get(r.name).push(r);
  });
  for (const [name, radios] of groups) {
    if (!radios.length) continue;
    const value = (radios.find(r => r.checked) || {}).value || '';
    // Each radio's label is its enclosing <label>'s text after the input.
    const options = radios.map(r => {
      const lab = r.closest('label');
      const text = lab ? lab.textContent.trim() : r.value;
      return { value: r.value, label: text };
    });
    const proxy = radios[0];
    const replacement = ui.createRadioGroup({
      name, options, value,
      onChange: (v) => {
        for (const r of radios) {
          r.checked = (r.value === v);
        }
        proxy.dispatchEvent(new Event('change', { bubbles: true }));
      },
    });
    replacement.dataset.uiEnhanced = '1';
    // Hide the original radio inputs + their label wrappers and insert
    // the replacement once.
    for (const r of radios) {
      const lab = r.closest('label');
      if (lab) hideProxy(lab);
      else hideProxy(r);
    }
    const insertAfter = radios[radios.length - 1].closest('label') || radios[radios.length - 1];
    insertAfter.parentNode.insertBefore(replacement, insertAfter.nextSibling);
  }
}

/** Re-run all enhancers when the page mutates. */
export function watchAndEnhance(root = document.body) {
  enhanceButtons(root);
  enhanceSelects(root);
  enhanceSwitches(root);
  enhanceTextInputs(root);
  enhanceRadios(root);
  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    queueMicrotask(() => {
      pending = false;
      enhanceButtons(root);
      enhanceSelects(root);
      enhanceSwitches(root);
      enhanceTextInputs(root);
      enhanceRadios(root);
    });
  });
  observer.observe(root, { childList: true, subtree: true });
  return observer;
}

