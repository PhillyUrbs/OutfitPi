// Drag-to-scroll for the kiosk touchscreen using Pointer Events. Works for
// mouse, pen and touch alike, regardless of how Chromium classifies the
// input device.
(() => {
  const DRAG_THRESHOLD = 8;

  function attach(el) {
    if (el.dataset.dragScrollAttached) return;
    el.dataset.dragScrollAttached = '1';
    let activeId = null;
    let startY = 0;
    let startX = 0;
    let startScroll = 0;
    let dragged = false;
    let suppressClickUntil = 0;

    el.addEventListener('pointerdown', (e) => {
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
        if (Math.abs(dy) <= Math.abs(dx)) return;
        dragged = true;
        try { el.setPointerCapture(e.pointerId); } catch {}
        const sel = window.getSelection();
        if (sel) sel.removeAllRanges();
      }
      if (dragged) {
        el.scrollTop = startScroll - dy;
        e.preventDefault();
        e.stopPropagation();
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
      if (dragged) suppressClickUntil = Date.now() + 400;
      dragged = false;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', end);

    el.addEventListener('click', (e) => {
      if (Date.now() < suppressClickUntil) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
  }

  function attachAll() {
    document.querySelectorAll(
      'body.settings-page > main, body.setup > main, [data-drag-scroll]'
    ).forEach(attach);
  }

  attachAll();
  // Re-scan when content is added (e.g. dev-only ref list rendered async).
  new MutationObserver(attachAll).observe(document.body, { childList: true, subtree: true });
})();
