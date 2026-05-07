# Lucide icons (MIT)

The weather and outfit icons are inlined as SVG strings in
[`static/js/app.js`](../js/app.js) for performance. Standalone copies of two
representative icons are kept here (`sun.svg`, `cloud.svg`) so other tooling
or future template work can reference them.

All icons are derived from [Lucide](https://lucide.dev) (ISC/MIT). Clothing
icons use simple custom paths in the same style.

## favicon.ico

A real `favicon.ico` should be generated from `sun.svg` (e.g. with ImageMagick:
`convert sun.svg -resize 32x32 favicon.ico`). The 404 from `/favicon.ico` is
harmless when missing.
