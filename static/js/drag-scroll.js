// Drag-to-scroll for the kiosk touchscreen using Pointer Events. Works for
// mouse, pen and touch alike, regardless of how Chromium classifies the
// input device.
(() => {
  const DRAG_THRESHOLD = 8;

  const containers = document.querySelectorAll('body.settings-page > main, body.setup > main');
  containers.forEach((el) => {
    let activeId = null;
    let startY = 0;
    let startX = 0;
    let startScroll = 0;
    let dragged = false;
    let suppressClickUntil = 0;

    el.addEventListener('pointerdown', (e) => {
      // Track every pointer-down so we can detect drags that begin on top
      // of an interactive control (the user's thumb landing on a label
      // while sliding to scroll). Don't preventDefault here — we want taps
      // on real controls to work normally.
      activeId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startScroll = el.scrollTop;
      dragged = false;
      el.classList.add('dragging');
    });

    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== activeId) return;
      const dy = e.clientY - startY;
      const dx = e.clientX - startX;
      if (!dragged && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        // Vertical-dominant motion = scroll; horizontal = ignore (lets
        // sliders work). Once we decide it's a scroll, take over.
        if (Math.abs(dy) <= Math.abs(dx)) return;
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

    el.addEventListener('selectstart', (e) => {
      if (activeId !== null) e.preventDefault();
    });

    const end = (e) => {
      if (e.pointerId !== activeId) return;
      try { el.releasePointerCapture(e.pointerId); } catch {}
      activeId = null;
      el.classList.remove('dragging');
      if (dragged) {
        // Swallow the click that follows a touch drag so we don't toggle
        // the control the finger happened to start on.
        suppressClickUntil = Date.now() + 400;
      }
      dragged = false;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', end);

    // Capture-phase click swallow: runs before any control's own listener.
    el.addEventListener('click', (e) => {
      if (Date.now() < suppressClickUntil) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
  });
})();
