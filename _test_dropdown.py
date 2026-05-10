from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_context(viewport={'width': 800, 'height': 800}).new_page()
    page.goto('http://192.168.1.149:5000/settings', wait_until='domcontentloaded', timeout=30000)
    page.wait_for_timeout(8000)
    sel = page.locator('md-filled-select#channel')
    sel.scroll_into_view_if_needed()
    sel.click(force=True)
    page.wait_for_timeout(1500)
    state = page.evaluate("""() => {
        const sel = document.querySelector('md-filled-select[id=channel]');
        return {
            open: sel?.hasAttribute('open'),
            menuOpen: !!document.querySelector('md-menu[open], md-menu[md-popover-open]'),
            visibleOptions: Array.from(document.querySelectorAll('md-select-option'))
                .filter(o => o.offsetParent !== null).length,
        };
    }""")
    print('after click:', state)
    page.screenshot(path='_dropdown.png')
    browser.close()
