from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_context(viewport={'width': 800, 'height': 480}).new_page()
    page.goto('http://192.168.1.149:5000/', wait_until='commit', timeout=30000)
    page.wait_for_timeout(10000)
    page.screenshot(path='_dash.png', full_page=False)
    print('done')
    b.close()
