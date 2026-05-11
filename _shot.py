from playwright.sync_api import sync_playwright
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_context(viewport={'width': 800, 'height': 1400}).new_page()
    page.on('console', lambda m: errs.append(f'{m.type}: {m.text[:200]}'))
    page.on('pageerror', lambda e: errs.append(f'PAGEERROR: {str(e)[:300]}'))
    page.goto('http://192.168.1.149:5000/settings', wait_until='domcontentloaded', timeout=30000)
    page.wait_for_timeout(3000)
    page.evaluate("""() => {
        const sel = document.getElementById('framework');
        sel.value = 'primer';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    }""")
    page.wait_for_timeout(8000)
    page.reload(wait_until='domcontentloaded')
    page.wait_for_timeout(8000)
    d = page.evaluate("""() => ({
        fw: document.body.dataset.uiFramework,
        primerLink: !!document.getElementById('primer-stylesheet'),
        primerLoaded: getComputedStyle(document.body).getPropertyValue('--bgColor-default') || getComputedStyle(document.body).getPropertyValue('--color-canvas-default') || 'no token',
        buttonCount: document.querySelectorAll('button').length,
        nightClass: document.body.classList.contains('night'),
    })""")
    print(d, flush=True)
    for e in errs[-10:]: print(e, flush=True)
    page.screenshot(path='_primer.png', full_page=True)
    b.close()
