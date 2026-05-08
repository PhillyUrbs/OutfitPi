// Settings page
(() => {
  const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
  let cfg = null;

  const $ = (id) => document.getElementById(id);

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

  function renderChildren() {
    const list = $('children-list');
    list.innerHTML = '';
    cfg.children.forEach((c, i) => {
      const row = document.createElement('div');
      row.className = 'child-row';
      row.innerHTML = `
        <input type="text" placeholder="Name" value="${c.name || ''}" data-i="${i}" data-k="name">
        <select data-i="${i}" data-k="gender">
          <option value="boy" ${c.gender === 'boy' ? 'selected' : ''}>Boy</option>
          <option value="girl" ${c.gender === 'girl' ? 'selected' : ''}>Girl</option>
        </select>
        <label>Comfort ${c.comfort_offset_f >= 0 ? '+' : ''}${c.comfort_offset_f}°F
          <input type="range" min="-10" max="10" step="1" value="${c.comfort_offset_f}" data-i="${i}" data-k="comfort_offset_f">
        </label>
        <button type="button" class="danger" data-rm="${i}">×</button>`;
      list.appendChild(row);
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
    $('theme').value = (cfg.display && cfg.display.theme) || 'auto';
  }

  async function load() {
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
    out.display = { theme: $('theme').value };
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
    if (k === 'comfort_offset_f') { child[k] = parseFloat(e.target.value); renderChildren(); }
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
        if (j2.restarting) { $('restart-overlay').hidden = false; setTimeout(() => location.href = '/', 3000); return; }
      }
      cfg = payload;
      // Sync theme immediately if the user just changed it.
      if (window.OutfitPiTheme) window.OutfitPiTheme.syncFromConfig(cfg);
      ok.hidden = false;
      toast('✓ Saved');
    } catch (e) {
      err.textContent = e.message; err.hidden = false;
      toast('Save failed: ' + e.message, 'err');
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
  }
  document.getElementById('channel').addEventListener('change', () => {
    applyChannelDefaults();
    autosave();
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
    $('update-status').textContent = 'Installing…';
    const r = await fetch('/api/update/install', {
      method: 'POST',
      headers: { 'X-CSRFToken': csrfToken },
    });
    const j = await r.json();
    if (j.ok) {
      $('restart-overlay').hidden = false;
      setTimeout(() => location.href = '/', 5000);
    } else {
      $('update-status').textContent = 'Update failed: ' + (j.message || 'unknown');
    }
  });

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
    }
  }

  $('lookup-zip').addEventListener('click', () => lookupZip());

  // Auto-lookup only when the user finishes with the ZIP field (blur),
  // or switches country with a ZIP already present.
  $('loc-zip').addEventListener('blur', () => lookupZip({ silent: true }));
  $('loc-country').addEventListener('change', () => {
    if ($('loc-zip').value.trim()) lookupZip({ silent: true });
  });

  load();
})();
