from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_context(viewport={'width': 800, 'height': 1400}).new_page()
    page.goto('http://192.168.1.149:5000/settings', wait_until='domcontentloaded', timeout=30000)
    page.wait_for_timeout(8000)
    d = page.evaluate("""() => ({
        fw: document.body.dataset.uiFramework,
        variant: document.body.dataset.uiVariant,
        nightClass: document.body.classList.contains('night'),
        dayClass: document.body.classList.contains('day'),
        bodyColor: getComputedStyle(document.body).color,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        textFields: Array.from(document.querySelectorAll('md-filled-text-field, md-outlined-text-field, fluent-text-field')).slice(0,3).map(f => ({
            tag: f.tagName,
            value: f.value,
            color: getComputedStyle(f).color,
            bg: getComputedStyle(f).backgroundColor,
            mdSurfaceContainerHighest: getComputedStyle(f).getPropertyValue('--md-sys-color-surface-container-highest').trim(),
            mdOnSurface: getComputedStyle(f).getPropertyValue('--md-sys-color-on-surface').trim(),
        })),
    })""")
    print(d)
    page.screenshot(path='_after.png', full_page=True)
    b.close()
