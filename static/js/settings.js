// Settings page
(() => {
  const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
  let cfg = null;

  const $ = (id) => document.getElementById(id);

  // Map a comfort offset (°F) to a kid-friendly descriptor used in the
  // settings slider label. Negative = runs warm, positive = runs cold.
  function describeComfort(offset) {
    if (offset <= -7) return 'runs hot';
    if (offset <= -3) return 'a bit warmer than most';
    if (offset >= 7) return 'gets cold easily';
    if (offset >= 3) return 'a bit cooler than most';
    return 'average';
  }

  let toastTimer = null;
  function toast(msg, kind = 'ok') {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast toast-' + kind;
    t.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
  }

  // Best-effort client-error report. The server forwards it to telemetry
  // along with the in-flight settings snapshot for context.
  function reportClientError(action, message) {
    try {
      fetch('/api/_client/error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify({ page: 'settings', action, message: String(message).slice(0, 400) }),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }
  window.addEventListener('error', (e) => {
    reportClientError('window.onerror', `${e.message} @ ${e.filename}:${e.lineno}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    reportClientError('unhandledrejection', String(e.reason && e.reason.message || e.reason));
  });

  // Show the restart overlay and reload only once the server has actually
  // gone down and come back up. Polls /api/health up to ~120s.
  // Decision rules:
  //   - if a previousFingerprint (sha or version) is provided AND the
  //     reported fingerprint differs, the new build is up: redirect.
  //   - otherwise wait until at least one failed health check is observed
  //     (server has gone down), then redirect on the next 200.
  async function waitForRestartAndReload(opts = {}) {
    const overlay = $('restart-overlay');
    const msgEl = overlay.querySelector('.restart-msg');
    if (msgEl && opts.message) msgEl.innerHTML = opts.message;
    overlay.hidden = false;
    const startFp = opts.previousFingerprint || null;
    const deadline = Date.now() + 120000;
    let sawDown = false;
    await new Promise(r => setTimeout(r, 2000));
    while (Date.now() < deadline) {
      try {
        const r = await fetch('/api/health', { cache: 'no-store' });
        if (r.ok) {
          const j = await r.json().catch(() => ({}));
          const fp = `${j.version || ''}@${j.sha || ''}`;
          if (startFp && fp !== startFp) {
            location.href = opts.redirect || '/';
            return;
          }
          if (sawDown) {
            location.href = opts.redirect || '/';
            return;
          }
        } else {
          sawDown = true;
        }
      } catch {
        sawDown = true;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    location.href = opts.redirect || '/';
  }

  function renderChildren() {
    const list = $('children-list');
    list.replaceChildren();
    cfg.children.forEach((c, i) => {
      const row = document.createElement('div');
      row.className = 'child-row';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.placeholder = 'Name';
      nameInput.value = c.name || '';
      nameInput.dataset.i = i;
      nameInput.dataset.k = 'name';

      const genderSel = document.createElement('select');
      genderSel.dataset.i = i;
      genderSel.dataset.k = 'gender';
      [['boy', 'Boy'], ['girl', 'Girl']].forEach(([val, label]) => {
        const o = document.createElement('option');
        o.value = val;
        o.textContent = label;
        if (c.gender === val) o.selected = true;
        genderSel.append(o);
      });

      const offset = Number(c.comfort_offset_f) || 0;
      const comfortLabel = document.createElement('label');
      const updateLabel = (v) => {
        const n = Number(v) || 0;
        comfortLabel.firstChild.nodeValue =
          `Comfort ${n >= 0 ? '+' : ''}${n}°F (${describeComfort(n)})`;
      };
      comfortLabel.append(`Comfort ${offset >= 0 ? '+' : ''}${offset}°F (${describeComfort(offset)})`);

      const comfortRow = document.createElement('div');
      comfortRow.className = 'comfort-row';

      const dec = document.createElement('button');
      dec.type = 'button';
      dec.className = 'comfort-step';
      dec.textContent = '−';
      dec.setAttribute('aria-label', 'Decrease comfort offset');

      // Use the theme adapter when available so the active framework's
      // (Material/Fluent/Primer) slider is used. Falls back to native.
      const adapter = window.OutfitPiUI && window.OutfitPiUI.ui;
      let comfortInput;
      if (adapter && typeof adapter.createSlider === 'function') {
        comfortInput = adapter.createSlider({
          min: -10, max: 10, step: 1, value: offset,
          ariaLabel: 'Comfort offset',
          onInput: (v) => updateLabel(v),
        });
      } else {
        comfortInput = document.createElement('input');
        comfortInput.type = 'range';
        comfortInput.min = '-10';
        comfortInput.max = '10';
        comfortInput.step = '1';
        comfortInput.value = String(offset);
        comfortInput.addEventListener('input', (e) => updateLabel(e.target.value));
      }
      // Always present so the autosave/save-payload code can find them.
      comfortInput.dataset.i = i;
      comfortInput.dataset.k = 'comfort_offset_f';
      if (!comfortInput.classList.contains('comfort-slider')) {
        comfortInput.classList.add('comfort-slider');
      }

      const inc = document.createElement('button');
      inc.type = 'button';
      inc.className = 'comfort-step';
      inc.textContent = '+';
      inc.setAttribute('aria-label', 'Increase comfort offset');

      const stepBy = (delta) => {
        const cur = Number(comfortInput.value) || 0;
        const next = Math.max(-10, Math.min(10, cur + delta));
        if (next === cur) return;
        comfortInput.value = String(next);
        comfortInput.dispatchEvent(new Event('input', { bubbles: true }));
        comfortInput.dispatchEvent(new Event('change', { bubbles: true }));
      };
      dec.addEventListener('click', (e) => { e.preventDefault(); stepBy(-1); });
      inc.addEventListener('click', (e) => { e.preventDefault(); stepBy(+1); });

      comfortRow.append(dec, comfortInput, inc);
      comfortLabel.append(comfortRow);

      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'danger';
      rm.dataset.rm = i;
      rm.textContent = '×';

      row.append(nameInput, genderSel, comfortLabel, rm);
      list.append(row);
    });
    $('add-child').disabled = cfg.children.length >= 2;
  }

  function renderAll() {
    renderChildren();
    document.querySelector(`input[name="units"][value="${cfg.units.temperature}"]`).checked = true;
    $('th-hot').value = Math.round(cfg.thresholds.hot);
    $('th-warm').value = Math.round(cfg.thresholds.warm);
    $('th-cool').value = Math.round(cfg.thresholds.cool);
    $('loc-lat').value = cfg.location.latitude ?? '';
    $('loc-lon').value = cfg.location.longitude ?? '';
    $('loc-auto').checked = !!cfg.location.auto;
    $('web-remote').checked = !!cfg.web_remote.enabled;
    document.querySelector(`input[name="telemetry"][value="${cfg.telemetry.level}"]`).checked = true;
    $('refresh-min').value = cfg.refresh_interval_minutes;
    $('language').value = cfg.language;
    $('auto-check').checked = cfg.updates.auto_check;
    $('auto-install').checked = cfg.updates.auto_install;
    $('channel').value = cfg.updates.channel;
    toggleDevInstall(cfg.updates.channel === 'dev');
    $('theme').value = (cfg.display && cfg.display.theme) || 'auto';
    if ($('framework')) {
      $('framework').value = (cfg.display && cfg.display.framework) || 'material';
    }
  }

  async function load() {
    // Wait for the active UI framework to finish loading so renderChildren
    // uses the right createSlider implementation on the first paint.
    // theme-bootstrap is loaded as a module so it executes deferred —
    // we may have to spin briefly until window.OutfitPiUI.ready exists.
    for (let i = 0; i < 50; i++) {
      if (window.OutfitPiUI && window.OutfitPiUI.ready) break;
      await new Promise(r => setTimeout(r, 50));
    }
    if (window.OutfitPiUI && window.OutfitPiUI.ready) {
      try { await window.OutfitPiUI.ready; } catch {}
    }
    const r = await fetch('/api/settings');
    cfg = await r.json();
    renderAll();
  }

  function collect() {
    const out = JSON.parse(JSON.stringify(cfg));
    out.units.temperature = document.querySelector('input[name="units"]:checked').value;
    out.thresholds.hot = parseFloat($('th-hot').value);
    out.thresholds.warm = parseFloat($('th-warm').value);
    out.thresholds.cool = parseFloat($('th-cool').value);
    out.location.latitude = $('loc-lat').value ? parseFloat($('loc-lat').value) : null;
    out.location.longitude = $('loc-lon').value ? parseFloat($('loc-lon').value) : null;
    out.location.auto = $('loc-auto').checked;
    out.location.consent_given = out.location.auto;
    out.web_remote.enabled = $('web-remote').checked;
    out.telemetry.level = document.querySelector('input[name="telemetry"]:checked').value;
    out.refresh_interval_minutes = parseInt($('refresh-min').value, 10);
    out.language = $('language').value;
    out.updates.auto_check = $('auto-check').checked;
    out.updates.auto_install = $('auto-install').checked;
    out.updates.channel = $('channel').value;
    out.display = {
      theme: $('theme').value,
      framework: $('framework') ? $('framework').value : (cfg.display && cfg.display.framework) || 'material',
      variant: $('theme').value,
    };
    return out;
  }

  $('add-child').addEventListener('click', () => {
    if (cfg.children.length >= 2) return;
    cfg.children.push({ name: '', gender: 'boy', comfort_offset_f: 0 });
    renderChildren();
  });
  $('children-list').addEventListener('input', (e) => {
    const i = e.target.dataset.i, k = e.target.dataset.k;
    if (i === undefined) return;
    const child = cfg.children[parseInt(i, 10)];
    if (!child) return;
    if (k === 'comfort_offset_f') {
      // Just update the in-memory value; the label is updated by the
      // slider's own onInput handler. Avoid re-rendering the list mid-
      // drag — that would destroy the slider element the user is
      // currently touching.
      child[k] = parseFloat(e.target.value);
    }
    else child[k] = e.target.value;
  });
  $('children-list').addEventListener('click', (e) => {
    const i = e.target.dataset.rm;
    if (i !== undefined) { cfg.children.splice(parseInt(i, 10), 1); renderChildren(); autosave(); }
  });

  let saveTimer = null;
  let saveInFlight = false;
  let saveQueued = false;

  async function doSave() {
    if (saveInFlight) { saveQueued = true; return; }
    saveInFlight = true;
    const ok = $('settings-ok'), err = $('settings-error');
    err.hidden = true;
    const payload = collect();
    const wasEnabled = cfg.web_remote.enabled;
    const willChangeBind = wasEnabled !== payload.web_remote.enabled;
    try {
      const r = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Save failed');
      if (willChangeBind) {
        const r2 = await fetch('/api/remote-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
          body: JSON.stringify({ enabled: payload.web_remote.enabled }),
        });
        const j2 = await r2.json();
        if (j2.warning) alert(j2.warning);
        if (j2.restarting) {
          await waitForRestartAndReload({
            message: 'Applying network change…<br><small>Reconnecting…</small>',
          });
          return;
        }
      }
      cfg = payload;
      // Sync theme immediately if the user just changed it.
      if (window.OutfitPiTheme) window.OutfitPiTheme.syncFromConfig(cfg);
      ok.hidden = false;
      toast('✓ Saved');
    } catch (e) {
      err.textContent = e.message; err.hidden = false;
      toast('Save failed: ' + e.message, 'err');
      reportClientError('settings-save', e.message);
    } finally {
      saveInFlight = false;
      if (saveQueued) { saveQueued = false; doSave(); }
    }
  }

  function autosave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 600);
  }

  // Apply channel-based defaults: dev/beta → full telemetry; all channels
  // → auto-install enabled. Runs on channel switch so the user can still
  // override afterward.
  function applyChannelDefaults() {
    const ch = $('channel').value;
    $('auto-check').checked = true;
    $('auto-install').checked = true;
    const tel = (ch === 'dev' || ch === 'beta') ? 'full' : 'errors';
    const radio = document.querySelector(`input[name="telemetry"][value="${tel}"]`);
    if (radio) radio.checked = true;
    toggleDevInstall(ch === 'dev');
  }
  document.getElementById('channel').addEventListener('change', () => {
    applyChannelDefaults();
    autosave();
  });

  // Switching the UI framework requires a full page reload so the new
  // theme module's vendor imports + CSS take effect cleanly. Save first
  // (so the choice persists), then reload.
  if ($('framework')) {
    $('framework').addEventListener('change', async () => {
      try {
        if (window.OutfitPiUI && typeof window.OutfitPiUI.setFramework === 'function') {
          await window.OutfitPiUI.setFramework($('framework').value, $('theme').value);
        }
      } catch {}
      await doSave();
      window.location.reload();
    });
  }
  // Variant (light/dark/auto) takes effect immediately without reload.
  $('theme').addEventListener('change', () => {
    try {
      if (window.OutfitPiUI && typeof window.OutfitPiUI.setFramework === 'function') {
        const fw = $('framework') ? $('framework').value : 'native';
        window.OutfitPiUI.setFramework(fw, $('theme').value);
      }
    } catch {}
  });
  document.querySelector('main.settings-main').addEventListener('input', (e) => {
    // Skip the ZIP lookup field — it triggers via the Look up button.
    if (e.target.id === 'loc-zip' || e.target.id === 'loc-country') return;
    // For free-text inputs, defer save until blur (change event) so we
    // don't POST after every keystroke. Sliders/checkboxes/selects/numbers
    // still autosave live.
    const tag = e.target.tagName;
    const type = (e.target.type || '').toLowerCase();
    if (tag === 'INPUT' && (type === 'text' || type === '' || type === 'search')) return;
    autosave();
  });
  document.querySelector('main.settings-main').addEventListener('change', (e) => {
    if (e.target.id === 'loc-zip' || e.target.id === 'loc-country') return;
    autosave();
  });

  $('reset').addEventListener('click', async () => {
    if (!confirm('Reset all settings to defaults? Children and location are kept.')) return;
    const r = await fetch('/api/settings/reset', {
      method: 'POST',
      headers: { 'X-CSRFToken': csrfToken },
    });
    if (r.ok) { await load(); $('settings-ok').hidden = false; }
  });

  $('check-update').addEventListener('click', async () => {
    $('update-status').textContent = 'Checking…';
    const r = await fetch('/api/update/check');
    const j = await r.json();
    if (j.available) {
      $('update-status').textContent = `Update available: v${j.latest_version}`;
      $('install-update').hidden = false;
    } else {
      $('update-status').textContent = j.message || 'You have the latest version.';
      $('install-update').hidden = true;
    }
  });

  $('install-update').addEventListener('click', async () => {
    if (!confirm('Install the latest update? OutfitPi will restart.')) return;
    runInstall('Installing update…', null);
  });

  $('force-update').addEventListener('click', async () => {
    const ref = ($('dev-ref-input').value.trim() || selectedRef || '').trim();
    const label = ref || 'current dev HEAD';
    if (!confirm(`Force install ${label}? OutfitPi will restart.`)) return;
    runInstall(`Installing ${label}…`, ref || null);
  });

  async function runInstall(message, ref) {
    $('update-status').textContent = 'Installing…';
    let prevFp = null;
    try {
      const h = await fetch('/api/health', { cache: 'no-store' });
      if (h.ok) {
        const j = await h.json();
        prevFp = `${j.version || ''}@${j.sha || ''}`;
      }
    } catch {}
    const r = await fetch('/api/update/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
      body: JSON.stringify(ref ? { ref } : {}),
    });
    const j = await r.json();
    if (j.ok) {
      await waitForRestartAndReload({
        message: `${message}<br><small>This usually takes 10–30 seconds.</small>`,
        previousFingerprint: prevFp,
      });
    } else {
      $('update-status').textContent = 'Update failed: ' + (j.message || 'unknown');
      reportClientError('update-install', j.message || 'unknown');
    }
  }

  let devRefsLoaded = false;
  let selectedRef = '';
  async function toggleDevInstall(show) {
    $('dev-install').hidden = !show;
    if (!show || devRefsLoaded) return;
    devRefsLoaded = true;
    try {
      const r = await fetch('/api/update/refs');
      if (!r.ok) return;
      const data = await r.json();
      const list = $('dev-ref-list');
      list.replaceChildren();
      const addItem = (ref, primary, secondary) => {
        const div = document.createElement('div');
        div.className = 'ref-item';
        div.dataset.ref = ref;
        div.setAttribute('role', 'option');
        const p = document.createElement('span');
        p.className = 'ref-primary';
        p.textContent = primary;
        div.append(p);
        if (secondary) {
          const s = document.createElement('span');
          s.className = 'ref-secondary';
          s.textContent = secondary;
          div.append(s);
        }
        list.append(div);
      };
      const addHeader = (label) => {
        const h = document.createElement('div');
        h.className = 'ref-group';
        h.textContent = label;
        list.appendChild(h);
      };
      addItem('', 'dev HEAD (latest)', 'origin/dev');
      if (data.tags && data.tags.length) {
        addHeader('Tags');
        data.tags.forEach(it => addItem(it.ref, it.ref, `${it.date}${it.subject ? ' — ' + it.subject : ''}`));
      }
      if (data.commits && data.commits.length) {
        addHeader('Recent dev commits');
        data.commits.forEach(it => addItem(it.ref, it.ref, `${it.date}${it.subject ? ' — ' + it.subject : ''}`));
      }
      // Default selection = dev HEAD.
      const first = list.querySelector('.ref-item');
      if (first) {
        first.classList.add('selected');
        selectedRef = first.dataset.ref;
      }
      list.addEventListener('click', (e) => {
        const item = e.target.closest('.ref-item');
        if (!item) return;
        list.querySelectorAll('.ref-item.selected').forEach(n => n.classList.remove('selected'));
        item.classList.add('selected');
        selectedRef = item.dataset.ref || '';
      });
    } catch {}
  }

  $('redetect').addEventListener('click', async () => {
    $('loc-display').textContent = 'Re-detecting on next save…';
  });

  async function lookupZip({ silent = false } = {}) {
    const zip = $('loc-zip').value.trim();
    const country = $('loc-country').value;
    const out = $('zip-result');
    if (!zip) {
      if (!silent) out.textContent = 'Enter a postal code first.';
      return;
    }
    out.textContent = 'Looking up…';
    try {
      const r = await fetch(`/api/geocode/zip?country=${encodeURIComponent(country)}&zip=${encodeURIComponent(zip)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Lookup failed');
      $('loc-lat').value = j.latitude;
      $('loc-lon').value = j.longitude;
      out.textContent = `Found: ${j.city || ''}${j.region ? ', ' + j.region : ''} (${j.latitude}, ${j.longitude})`;
      toast('✓ ZIP resolved');
      autosave();
    } catch (e) {
      out.textContent = e.message;
      reportClientError('zip-lookup', e.message);
    }
  }

  $('lookup-zip').addEventListener('click', () => lookupZip());

  // Auto-lookup ZIP when the user taps anywhere outside the field and
  // the on-screen keyboard. focusin alone misses taps on non-focusable
  // areas (labels, headings, blank space), so we listen for pointerdown
  // on the document.
  let zipDirty = false;
  let zipLastValue = '';
  $('loc-zip').addEventListener('focus', () => {
    zipLastValue = $('loc-zip').value;
    zipDirty = true;
  });
  $('loc-zip').addEventListener('input', () => { zipDirty = true; });
  document.addEventListener('pointerdown', (e) => {
    if (!zipDirty) return;
    const t = e.target;
    if (t === $('loc-zip')) return;
    if (t && t.closest && t.closest('.keyboard-container')) return;
    zipDirty = false;
    if ($('loc-zip').value.trim() && $('loc-zip').value !== zipLastValue) {
      lookupZip({ silent: true });
    }
  }, true);
  $('loc-country').addEventListener('change', () => {
    if ($('loc-zip').value.trim()) lookupZip({ silent: true });
  });

  load();
})();
