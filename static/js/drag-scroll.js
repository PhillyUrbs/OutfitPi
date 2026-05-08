// Drag-to-scroll for the kiosk touchscreen using Pointer Events. Works for
// mouse, pen and touch alike, regardless of how Chromium classifies the
// input device.
(() => {
  const containers = document.querySelectorAll('body.settings-page > main, body.setup > main');
  containers.forEach((el) => {
    let activeId = null;
    let startY = 0;
    let startScroll = 0;
    let dragged = false;

    function isInteractive(t) {
      return !!t.closest('input, select, textarea, button, label, a, .simple-keyboard, .keyboard-container');
    }

    el.addEventListener('pointerdown', (e) => {
      if (isInteractive(e.target)) return;
      activeId = e.pointerId;
      startY = e.clientY;
      startScroll = el.scrollTop;
      dragged = false;
      el.classList.add('dragging');
    });

    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== activeId) return;
      const dy = e.clientY - startY;
      if (!dragged && Math.abs(dy) > 4) {
        dragged = true;
        try { el.setPointerCapture(e.pointerId); } catch {}
        const sel = window.getSelection();
        if (sel) sel.removeAllRanges();
      }
      if (dragged) {
        el.scrollTop = startScroll - dy;
        e.preventDefault();
      }
    }, { passive: false });

    // Block native selection start anywhere on the scrolling area while the
    // pointer is down. Inputs/buttons are excluded by isInteractive above.
    el.addEventListener('selectstart', (e) => {
      if (activeId !== null) e.preventDefault();
    });

    const end = (e) => {
      if (e.pointerId !== activeId) return;
      try { el.releasePointerCapture(e.pointerId); } catch {}
      activeId = null;
      el.classList.remove('dragging');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', end);
  });
})();
