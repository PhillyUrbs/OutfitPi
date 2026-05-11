// Auto-reload pages when the server restarts or its git SHA changes.
// Loaded by index/settings/setup so a Pi-side service restart (e.g. an
// update install) drops any stale CSRF tokens, enhanced-control state,
// or older static JS the browser is still running.
(() => {
  let _sha = null;
  let _started = null;
  // Suppress reload while the user is mid-interaction with a form
  // control — would be jarring to lose state on a settings page.
  function isUserBusy() {
    const a = document.activeElement;
    if (!a) return false;
    const tag = a.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (a.isContentEditable) return true;
    return false;
  }
  async function poll() {
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (_sha === null) {
        _sha = j.sha || '';
        _started = j.started_at || 0;
        return;
      }
      const changed = (j.sha || '') !== _sha
                   || (j.started_at || 0) !== _started;
      if (changed && !isUserBusy()) {
        window.location.reload();
      }
    } catch {}
  }
  setTimeout(poll, 1500);
  setInterval(poll, 30 * 1000);
})();
