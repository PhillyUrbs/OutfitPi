// Virtual keyboard activation — only on coarse-pointer devices (Pi kiosk).
(() => {
  if (typeof window.SimpleKeyboard === 'undefined') return;
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  if (!isCoarse) return;

  const Keyboard = window.SimpleKeyboard.default || window.SimpleKeyboard;
  const container = document.getElementById('keyboard-container');
  if (!container) return;

  let activeInput = null;
  const kb = new Keyboard({
    onChange: (input) => { if (activeInput) { activeInput.value = input; activeInput.dispatchEvent(new Event('input', {bubbles:true})); } },
    onKeyPress: (button) => {
      if (button === '{enter}') { hide(); }
    },
    layout: {
      default: [
        'q w e r t y u i o p {bksp}',
        'a s d f g h j k l',
        'z x c v b n m . - {enter}',
        '{numbers} {space} {abc}'
      ],
      numbers: ['1 2 3', '4 5 6', '7 8 9', '. 0 - {bksp}']
    },
    display: {
      '{bksp}': '⌫', '{enter}': '↵', '{space}': ' ', '{numbers}': '123', '{abc}': 'abc'
    }
  });

  function show(el) {
    activeInput = el;
    kb.setInput(el.value || '');
    container.hidden = false;
  }
  function hide() {
    container.hidden = true;
    activeInput = null;
  }

  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT') && (t.type === 'text' || t.type === 'number')) {
      show(t);
    } else {
      hide();
    }
  });
  document.addEventListener('input', (e) => {
    if (activeInput && e.target === activeInput) kb.setInput(activeInput.value);
  });
})();
