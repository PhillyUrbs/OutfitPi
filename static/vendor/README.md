# Vendored Assets

## simple-keyboard
- License: MIT
- Source: https://github.com/hodgef/simple-keyboard
- Files: `simple-keyboard/index.js`, `simple-keyboard/index.css`

The shipped files in this directory are placeholders. For the full virtual
keyboard experience on the Pi touchscreen, download the real library:

```bash
curl -L https://cdn.jsdelivr.net/npm/simple-keyboard/build/index.js \
  -o static/vendor/simple-keyboard/index.js
curl -L https://cdn.jsdelivr.net/npm/simple-keyboard/build/css/index.css \
  -o static/vendor/simple-keyboard/index.css
```

Phone, laptop, and desktop browsers use the native on-screen keyboard, so the
placeholder is sufficient for non-Pi development.
