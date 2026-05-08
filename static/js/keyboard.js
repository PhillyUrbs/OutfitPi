// Virtual keyboard activation — on touchscreens / coarse-pointer devices.
(() => {
  if (typeof window.SimpleKeyboard === 'undefined') return;
  const isTouch =
    window.matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    (navigator.maxTouchPoints || 0) > 0;
  if (!isTouch) return;

  const Keyboard = window.SimpleKeyboard.default || window.SimpleKeyboard;
  const container = document.getElementById('keyboard-container');
  if (!container) return;

  let activeInput = null;
  let layoutName = 'default';
  const kb = new Keyboard({
    theme: 'hg-theme-default hg-theme-ios',
    onChange: (input) => {
      if (activeInput) {
        activeInput.value = input;
        activeInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },
    onKeyPress: (button) => {
      if (button === '{enter}') { hide(); return; }
      if (button === '{shift}' || button === '{lock}') {
        layoutName = layoutName === 'default' ? 'shift' : 'default';
        kb.setOptions({ layoutName });
      } else if (button === '{numbers}') {
        layoutName = 'numbers';
        kb.setOptions({ layoutName });
      } else if (button === '{abc}') {
        layoutName = 'default';
        kb.setOptions({ layoutName });
      } else if (layoutName === 'shift') {
        // Auto-revert after one shifted character.
        layoutName = 'default';
        kb.setOptions({ layoutName });
      }
    },
    layout: {
      default: [
        'q w e r t y u i o p {bksp}',
        'a s d f g h j k l',
        '{shift} z x c v b n m . - {enter}',
        '{numbers} {space} {abc}'
      ],
      shift: [
        'Q W E R T Y U I O P {bksp}',
        'A S D F G H J K L',
        '{shift} Z X C V B N M . - {enter}',
        '{numbers} {space} {abc}'
      ],
      numbers: [
        '1 2 3 4 5 6 7 8 9 0 {bksp}',
        '- _ . , @ / # & ( )',
        '{abc} {space} {enter}'
      ],
    },
    display: {
      '{bksp}': '⌫', '{enter}': '↵', '{space}': ' ',
      '{shift}': '⇧', '{numbers}': '123', '{abc}': 'abc'
    }
  });

  function show(el) {
    activeInput = el;
    kb.setInput(el.value || '');
    container.hidden = false;
    document.body.classList.add('kb-open');
    // Scroll the focused field into view above the keyboard.
    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  }
  function hide() {
    container.hidden = true;
    document.body.classList.remove('kb-open');
    activeInput = null;
  }

  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT') && (t.type === 'text' || t.type === 'number')) {
      show(t);
    } else if (t && !t.closest('.keyboard-container')) {
      hide();
    }
  });
  document.addEventListener('input', (e) => {
    if (activeInput && e.target === activeInput) kb.setInput(activeInput.value);
  });

  const hideBtn = document.getElementById('keyboard-hide');
  if (hideBtn) {
    hideBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (activeInput) activeInput.blur();
      hide();
    });
    // Don't let mousedown on the hide button steal focus from the input
    // and trigger our focusin/hide cycle.
    hideBtn.addEventListener('mousedown', (e) => e.preventDefault());
    hideBtn.addEventListener('pointerdown', (e) => e.preventDefault());
  }
})();
