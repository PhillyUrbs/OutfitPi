from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_context(viewport={'width': 800, 'height': 800}).new_page()
    page.goto('http://192.168.1.149:5000/settings', wait_until='domcontentloaded', timeout=30000)
    page.wait_for_timeout(8000)
    page.evaluate("""() => {
        window._events = [];
        ['pointerdown', 'pointerup', 'click', 'opening', 'opened', 'closing', 'closed'].forEach(t => {
            document.addEventListener(t, (e) => {
                if (window._events.length < 30) window._events.push({
                    type: t,
                    target: e.target?.tagName,
                    targetId: e.target?.id,
                    composedPath: e.composedPath().slice(0, 6).map(n => n.tagName || '#text'),
                });
            }, true);
        });
    }""")
    sel = page.locator('md-filled-select[id=channel]')
    sel.scroll_into_view_if_needed()
    sel.click()
    page.wait_for_timeout(1200)
    events = page.evaluate('window._events')
    import json
    print(json.dumps(events, indent=2))
    browser.close()
