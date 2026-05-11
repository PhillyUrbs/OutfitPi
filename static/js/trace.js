// Lightweight trace helper. Only active when the page URL has
// ?trace=1 — otherwise it's a no-op. Use trace('comfort', {…}) from
// app code; events go to (a) the browser console, (b) an on-screen
// overlay pinned to the bottom of the viewport, and (c) POST to
// /api/_client/trace so they show up in `journalctl --user -u outfitpi`.
(() => {
  const enabled = new URLSearchParams(location.search).get('trace') === '1';
  if (!enabled) {
    window.trace = () => {};
    return;
  }
  let overlay;
  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'trace-overlay';
    overlay.style.cssText = [
      'position:fixed', 'left:0', 'right:0', 'bottom:0',
      'max-height:35vh', 'overflow-y:auto', 'overflow-x:hidden',
      'background:rgba(0,0,0,0.85)', 'color:#0f0',
      'font:11px/1.3 ui-monospace,Menlo,Consolas,monospace',
      'padding:6px 8px', 'z-index:99999',
      'border-top:2px solid #0f0', 'pointer-events:auto',
    ].join(';');
    const close = document.createElement('button');
    close.textContent = '✕';
    close.style.cssText = [
      'position:absolute', 'top:2px', 'right:6px', 'background:transparent',
      'color:#0f0', 'border:1px solid #0f0', 'padding:0 6px', 'cursor:pointer',
      'font:11px monospace',
    ].join(';');
    close.onclick = () => overlay.remove();
    overlay.appendChild(close);
    if (document.body) document.body.appendChild(overlay);
    else document.addEventListener('DOMContentLoaded', () =>
      document.body.appendChild(overlay));
    return overlay;
  }
  let lineCount = 0;
  window.trace = function trace(tag, data) {
    const line = document.createElement('div');
    const ts = new Date().toISOString().slice(11, 23);
    let payload;
    try { payload = JSON.stringify(data); } catch { payload = String(data); }
    line.textContent = `${ts} [${tag}] ${payload}`;
    const o = ensureOverlay();
    if (o) {
      o.appendChild(line);
      o.scrollTop = o.scrollHeight;
      // Cap to last 200 lines.
      if (++lineCount > 200) {
        const first = o.querySelector('div');
        if (first && first !== o.firstElementChild) first.remove();
      }
    }
    try { console.log(`[${tag}]`, data); } catch {}
    try {
      fetch('/api/_client/trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag, data }),
        keepalive: true,
      });
    } catch {}
  };
  trace('init', { page: location.pathname, ua: navigator.userAgent.slice(0, 60) });
})();
