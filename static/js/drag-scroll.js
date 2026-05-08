// Drag-to-scroll fallback for the kiosk touchscreen. Native touch scrolling
// on Chromium kiosk can be unreliable depending on the input device class
// (some touchscreens are exposed as tablets, not as touch devices). This
// uses Pointer Events so it works for mouse, pen and touch alike.
(() => {
  const containers = document.querySelectorAll('body.settings-page > main, body.setup > main');
  containers.forEach((el) => {
    let activeId = null;
    let startY = 0;
    let startScroll = 0;
    let dragged = false;

    el.addEventListener('pointerdown', (e) => {
      // Don't hijack interactions on form controls and buttons.
      const t = e.target;
      if (t.closest('input, select, textarea, button, label, a, .simple-keyboard, .keyboard-container')) return;
      activeId = e.pointerId;
      startY = e.clientY;
      startScroll = el.scrollTop;
      dragged = false;
    });

    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== activeId) return;
      const dy = e.clientY - startY;
      if (Math.abs(dy) > 4) {
        if (!dragged) { dragged = true; el.setPointerCapture(e.pointerId); }
        el.scrollTop = startScroll - dy;
        e.preventDefault();
      }
    }, { passive: false });

    const end = (e) => {
      if (e.pointerId !== activeId) return;
      try { el.releasePointerCapture(e.pointerId); } catch {}
      activeId = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', end);
  });
})();
