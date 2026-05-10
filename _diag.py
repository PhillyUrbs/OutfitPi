"""Diagnose Material enhancer state on the live Pi."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_context(viewport={'width': 800, 'height': 800}).new_page()
    page.goto('http://192.168.1.149:5000/settings', wait_until='domcontentloaded', timeout=30000)
    page.wait_for_timeout(8000)
    diag = page.evaluate("""() => {
        const probe = (id) => {
            const proxy = document.getElementById(id);
            if (!proxy) return null;
            // The themed replacement is inserted as the next sibling.
            let r = proxy.nextSibling;
            while (r && r.nodeType !== 1) r = r.nextSibling;
            return {
                proxyValue: proxy.value,
                proxyDisplay: proxy.style.display,
                replacementTag: r?.tagName,
                replacementValue: r ? r.value : null,
            };
        };
        return {
            hot: probe('th-hot'),
            warm: probe('th-warm'),
            cool: probe('th-cool'),
            channel: probe('channel'),
            country: probe('loc-country'),
            framework: probe('framework'),
            theme: probe('theme'),
            colorway: probe('colorway'),
            refresh: probe('refresh-min'),
            telemetryRadios: Array.from(document.querySelectorAll('input[name=telemetry]'))
              .map(r => ({ value: r.value, checked: r.checked, parentDisplay: r.closest('label')?.style.display })),
        };
    }""")
    import json
    print(json.dumps(diag, indent=2))
    page.screenshot(path='_settings_check.png', full_page=True)
    browser.close()
