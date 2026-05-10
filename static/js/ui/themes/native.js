// Native (built-in) theme. Renders plain HTML elements styled by
// static/css/style.css. Acts as the fallback for any other theme that
// doesn't implement a particular factory.
//
// Theme contract — every factory returns a real DOM Node ready to insert.
// All factories accept a single options object (so adding fields later
// doesn't break callers). Unknown options are ignored.

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k in node) {
      try { node[k] = v; } catch { node.setAttribute(k, v); }
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

const native = {
  id: 'native',
  name: 'Native',
  variants: ['auto', 'light', 'dark'],

  applyVariant(variant) {
    // theme.js owns the body.night class; nothing extra to do here.
    document.body.dataset.uiVariant = variant || 'auto';
  },

  createSlider({ min = 0, max = 100, step = 1, value = 0, onInput, onChange,
                 ariaLabel } = {}) {
    const input = el('input', {
      type: 'range', min: String(min), max: String(max), step: String(step),
      value: String(value), class: 'comfort-slider',
      dataset: { uiSlider: '1' },
      'aria-label': ariaLabel || null,
    });
    if (onInput)  input.addEventListener('input', e => onInput(Number(e.target.value)));
    if (onChange) input.addEventListener('change', e => onChange(Number(e.target.value)));
    return input;
  },

  createButton({ label = '', kind = 'secondary', onClick, type = 'button',
                 ariaLabel } = {}) {
    const cls = kind === 'primary' ? 'primary'
              : kind === 'danger'  ? 'danger'
              : 'secondary';
    const btn = el('button', { type, class: cls,
                                'aria-label': ariaLabel || null }, label);
    if (onClick) btn.addEventListener('click', onClick);
    return btn;
  },

  createSwitch({ checked = false, onChange, ariaLabel } = {}) {
    // Native = a styled checkbox in a <label>.
    const wrap = el('label', { class: 'big-toggle' });
    const cb = el('input', { type: 'checkbox', checked,
                              'aria-label': ariaLabel || null });
    if (onChange) cb.addEventListener('change', e => onChange(!!e.target.checked));
    wrap.append(cb);
    return wrap;
  },

  createSelect({ options = [], value = '', onChange, ariaLabel } = {}) {
    const sel = el('select', { 'aria-label': ariaLabel || null });
    for (const opt of options) {
      const o = el('option', { value: opt.value }, opt.label);
      if (String(opt.value) === String(value)) o.selected = true;
      sel.append(o);
    }
    if (onChange) sel.addEventListener('change', e => onChange(e.target.value));
    return sel;
  },

  createInput({ type = 'text', value = '', placeholder = '', inputmode,
                onInput, onChange, ariaLabel } = {}) {
    const input = el('input', {
      type, value: String(value), placeholder,
      inputmode: inputmode || null,
      'aria-label': ariaLabel || null,
    });
    if (onInput)  input.addEventListener('input',  e => onInput(e.target.value));
    if (onChange) input.addEventListener('change', e => onChange(e.target.value));
    return input;
  },

  createRadioGroup({ name, options = [], value = '', onChange } = {}) {
    const wrap = el('div', { class: 'radio-group', role: 'radiogroup' });
    for (const opt of options) {
      const lab = el('label');
      const r = el('input', { type: 'radio', name, value: opt.value });
      if (String(opt.value) === String(value)) r.checked = true;
      if (onChange) r.addEventListener('change', () => { if (r.checked) onChange(opt.value); });
      lab.append(r, ' ', opt.label);
      wrap.append(lab);
    }
    return wrap;
  },
};

export default native;
