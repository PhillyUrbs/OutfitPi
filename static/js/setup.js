// Setup wizard
(() => {
  const csrfToken = document.querySelector('meta[name="csrf-token"]').content;
  const main = document.getElementById('setup-main');
  const lanIp = main.dataset.lanIp;
  const port = main.dataset.serverPort;
  const TOTAL = 7;
  let step = 1;

  const state = {
    location: { latitude: null, longitude: null, auto: false, consent_given: false },
    units: { temperature: 'fahrenheit' },
    children: [],
    web_remote: { enabled: false },
    telemetry: { level: 'errors' },
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  function show(n) {
    step = Math.max(1, Math.min(TOTAL, n));
    $$('.step').forEach(s => s.hidden = (parseInt(s.dataset.step, 10) !== step));
    $('#back-btn').disabled = step === 1;
    $('#next-btn').hidden = step === TOTAL;
    $('#save-btn').hidden = step !== TOTAL;
    $('#step-indicator').textContent = `Step ${step} of ${TOTAL}`;
    if (step === 7) renderSummary();
  }

  function renderChildren() {
    const list = $('#children-list');
    list.innerHTML = '';
    state.children.forEach((c, i) => {
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
    $('#add-child').disabled = state.children.length >= 2;
  }

  function renderSummary() {
    const s = $('#summary');
    s.innerHTML = `
      <p><strong>Location:</strong> ${state.location.auto ? 'Auto-detect (IP)' : (state.location.latitude + ', ' + state.location.longitude)}</p>
      <p><strong>Units:</strong> ${state.units.temperature}</p>
      <p><strong>Children:</strong> ${state.children.map(c => `${c.name} (${c.gender}, ${c.comfort_offset_f >= 0 ? '+' : ''}${c.comfort_offset_f}°F)`).join('; ') || '—'}</p>
      <p><strong>Remote access:</strong> ${state.web_remote.enabled ? 'On' : 'Off'}</p>
      <p><strong>Telemetry:</strong> ${state.telemetry.level}</p>`;
  }

  function validate() {
    if (state.location.auto) {
      if (!state.location.consent_given) return 'Auto-detect requires consent.';
    } else {
      const lat = parseFloat(state.location.latitude);
      const lon = parseFloat(state.location.longitude);
      if (isNaN(lat) || isNaN(lon)) return 'Enter latitude and longitude.';
    }
    if (state.children.length < 1 || state.children.length > 2) return 'Add 1 or 2 children.';
    for (const c of state.children) {
      if (!c.name?.trim()) return 'Each child needs a name.';
      if (!['boy','girl'].includes(c.gender)) return 'Pick a gender per child.';
    }
    return null;
  }

  // Event wiring
  $('#back-btn').addEventListener('click', () => show(step - 1));
  $('#next-btn').addEventListener('click', () => {
    captureStep(step);
    show(step + 1);
  });

  function captureStep(n) {
    if (n === 2) {
      state.location.auto = $('#loc-auto').checked;
      state.location.consent_given = state.location.auto;
      state.location.latitude = $('#loc-lat').value || null;
      state.location.longitude = $('#loc-lon').value || null;
    } else if (n === 4) {
      const r = document.querySelector('input[name="units"]:checked');
      state.units.temperature = r ? r.value : 'fahrenheit';
    } else if (n === 5) {
      state.web_remote.enabled = $('#web-remote').checked;
    } else if (n === 6) {
      const r = document.querySelector('input[name="telemetry"]:checked');
      state.telemetry.level = r ? r.value : 'errors';
    }
  }

  $('#loc-auto').addEventListener('change', (e) => {
    $('#loc-manual').style.opacity = e.target.checked ? '0.4' : '1';
    $('#loc-zip-block').style.opacity = e.target.checked ? '0.4' : '1';
  });

  $('#lookup-zip').addEventListener('click', async () => {
    const r = $('#location-result');
    const zip = $('#loc-zip').value.trim();
    const country = $('#loc-country').value;
    if (!zip) { r.textContent = 'Enter a postal code first.'; return; }
    r.textContent = 'Looking up…';
    try {
      const resp = await fetch(`/api/geocode/zip?country=${encodeURIComponent(country)}&zip=${encodeURIComponent(zip)}`);
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || 'Lookup failed');
      $('#loc-lat').value = j.latitude;
      $('#loc-lon').value = j.longitude;
      r.textContent = `Found: ${j.city || ''}${j.region ? ', ' + j.region : ''} (${j.latitude}, ${j.longitude})`;
    } catch (e) {
      r.textContent = e.message;
    }
  });

  $('#test-location').addEventListener('click', async () => {
    const r = $('#location-result');
    r.textContent = 'Testing…';
    if ($('#loc-auto').checked) {
      try {
        const resp = await fetch('http://ip-api.com/json/');
        const j = await resp.json();
        r.textContent = `${j.city || ''}, ${j.regionName || ''} (${j.lat}, ${j.lon})`;
      } catch { r.textContent = 'Could not reach geolocation service.'; }
    } else {
      const lat = parseFloat($('#loc-lat').value);
      const lon = parseFloat($('#loc-lon').value);
      if (isNaN(lat) || isNaN(lon)) { r.textContent = 'Enter valid numbers.'; return; }
      r.textContent = `Looks valid: ${lat}, ${lon}`;
    }
  });

  $('#add-child').addEventListener('click', () => {
    if (state.children.length >= 2) return;
    state.children.push({ name: '', gender: 'boy', comfort_offset_f: 0 });
    renderChildren();
  });

  $('#children-list').addEventListener('input', (e) => {
    const i = e.target.dataset.i;
    const k = e.target.dataset.k;
    if (i === undefined) return;
    const child = state.children[parseInt(i, 10)];
    if (!child) return;
    if (k === 'comfort_offset_f') child[k] = parseFloat(e.target.value);
    else child[k] = e.target.value;
    if (k === 'comfort_offset_f') renderChildren();
  });
  $('#children-list').addEventListener('click', (e) => {
    const i = e.target.dataset.rm;
    if (i !== undefined) {
      state.children.splice(parseInt(i, 10), 1);
      renderChildren();
    }
  });

  $('#save-btn').addEventListener('click', async () => {
    captureStep(step);
    const err = validate();
    if (err) { const e = $('#setup-error'); e.textContent = err; e.hidden = false; return; }
    $('#setup-error').hidden = true;

    const payload = {
      ...state,
      location: {
        ...state.location,
        latitude: state.location.latitude ? parseFloat(state.location.latitude) : null,
        longitude: state.location.longitude ? parseFloat(state.location.longitude) : null,
      },
    };

    try {
      const btn = $('#save-btn');
      btn.disabled = true;
      btn.textContent = 'Saving…';
      const resp = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify(payload),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || 'Save failed');
      $('#restart-overlay').hidden = false;
      // Poll for restart.
      const target = state.web_remote.enabled ? `http://${lanIp}:${port}/` : '/';
      setTimeout(() => poll(target, 0), (j.delay || 2) * 1000);
    } catch (e) {
      const er = $('#setup-error'); er.textContent = e.message; er.hidden = false;
      const btn = $('#save-btn'); btn.disabled = false; btn.textContent = 'Save & Start';
    }
  });

  async function poll(url, n) {
    if (n > 60) { window.location.href = url; return; }
    try {
      await fetch(url, { method: 'GET', cache: 'no-store' });
      window.location.href = url;
    } catch {
      setTimeout(() => poll(url, n + 1), 1000);
    }
  }

  show(1);
})();
