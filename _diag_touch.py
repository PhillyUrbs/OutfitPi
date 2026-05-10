from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--touch-events=enabled'])
    ctx = b.new_context(viewport={'width': 800, 'height': 1200}, has_touch=True)
    page = ctx.new_page()
    page.on('console', lambda m: print('LOG:', m.text, flush=True))
    page.goto('http://192.168.1.149:5000/settings', wait_until='domcontentloaded', timeout=30000)
    page.wait_for_timeout(4000)
    page.evaluate("""() => {
        const s = document.querySelector('.comfort-slider');
        s.scrollIntoView({block:'center'});
        for (const ev of ['pointerdown','pointermove','pointerup','touchstart','touchmove','touchend','input','change']) {
            s.addEventListener(ev, () => console.log(ev + ' .value=' + s.value), true);
        }
        // Hook fetch to log every POST to /api/settings.
        const orig = window.fetch;
        window.fetch = async (url, opts) => {
            if (typeof url === 'string' && url.includes('/api/settings') && opts && opts.method === 'POST') {
                try {
                    const body = JSON.parse(opts.body);
                    console.log('POST children=' + JSON.stringify(body.children.map(c => c.comfort_offset_f)));
                } catch {}
            }
            return orig(url, opts);
        };
        // Sniff: how many listeners are attached for 'change' on the host?
        // (We can't enumerate them directly, but we can list child element types.)
        console.log('SLIDER tag=' + s.tagName + ' inputs.has=' +
            !!s.oninput + ' changes.has=' + !!s.onchange);
    }""")
    box = page.evaluate("""() => {
        const s = document.querySelector('.comfort-slider');
        const r = s.getBoundingClientRect();
        return {x: r.left, y: r.top, w: r.width, h: r.height, value: s.value};
    }""")
    print('box:', box, flush=True)
    cy = box['y'] + box['h']/2
    target_x = box['x'] + box['w'] * 0.65   # ~+3 on -10..10
    page.touchscreen.tap(box['x'] + box['w']*0.5, cy)
    page.wait_for_timeout(500)
    print('--- now drag ---', flush=True)
    # Touch drag
    cdp = ctx.new_cdp_session(page)
    cdp.send('Input.dispatchTouchEvent', {'type':'touchStart', 'touchPoints':[{'x': box['x']+box['w']*0.5, 'y': cy}]})
    page.wait_for_timeout(50)
    for frac in [0.55, 0.60, 0.63, 0.65]:
        cdp.send('Input.dispatchTouchEvent', {'type':'touchMove', 'touchPoints':[{'x': box['x']+box['w']*frac, 'y': cy}]})
        page.wait_for_timeout(80)
    cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd', 'touchPoints':[]})
    page.wait_for_timeout(500)
    final = page.evaluate("() => document.querySelector('.comfort-slider').value")
    print('final .value:', final, flush=True)
    page.wait_for_timeout(2000)
    print('--- synthetic change ---', flush=True)
    page.evaluate("""() => {
        const s = document.querySelector('.comfort-slider');
        s.value = 5;
        s.dispatchEvent(new Event('input', {bubbles:true}));
        s.dispatchEvent(new Event('change', {bubbles:true}));
    }""")
    page.wait_for_timeout(500)
    # Inspect global cfg if we can find it.
    state = page.evaluate("""() => {
        // Check if autosave timer is set, and if there's a global cfg.
        const out = { hasAutosaveSym: false, comfortSliderValue: null };
        const s = document.querySelector('.comfort-slider');
        out.comfortSliderValue = s ? s.value : null;
        out.sliderTag = s ? s.tagName : null;
        out.sliderDataI = s ? s.dataset.i : null;
        out.sliderDataK = s ? s.dataset.k : null;
        // Show all sliders count
        out.sliderCount = document.querySelectorAll('.comfort-slider').length;
        return out;
    }""")
    print('STATE:', state, flush=True)
    page.wait_for_timeout(2000)
    err = page.evaluate("""() => {
        const e = document.getElementById('settings-error');
        return { text: e ? e.textContent : null, hidden: e ? e.hidden : null };
    }""")
    print('ERR:', err, flush=True)
    radios = page.evaluate("""() => ({
        unitsAll: Array.from(document.querySelectorAll('input[name="units"]')).map(r => ({val:r.value, checked:r.checked, disabled:r.disabled, hidden:r.offsetParent===null})),
        unitsChecked: !!document.querySelector('input[name="units"]:checked'),
        telAll: Array.from(document.querySelectorAll('input[name="telemetry"]')).map(r => ({val:r.value, checked:r.checked})),
        telChecked: !!document.querySelector('input[name="telemetry"]:checked'),
    })""")
    print('RADIOS:', radios, flush=True)
    saved = page.evaluate("""async () => {
        const r = await fetch('/api/settings');
        const j = await r.json();
        return j.children.map(c => c.comfort_offset_f);
    }""")
    print('SAVED:', saved, flush=True)
    b.close()
