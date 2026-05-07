/*
 * simple-keyboard placeholder
 *
 * The real simple-keyboard library (MIT, ~30KB) should be downloaded and
 * placed here. To vendor it from the official release:
 *
 *   curl -L https://cdn.jsdelivr.net/npm/simple-keyboard/build/index.js \
 *     -o static/vendor/simple-keyboard/index.js
 *   curl -L https://cdn.jsdelivr.net/npm/simple-keyboard/build/css/index.css \
 *     -o static/vendor/simple-keyboard/index.css
 *
 * This placeholder exposes a no-op constructor so the app does not crash
 * when the library has not been downloaded yet (e.g. during development on
 * a non-touch dev machine, where keyboard.js short-circuits anyway).
 */
(function (root) {
  if (root.SimpleKeyboard) return;
  function NoopKeyboard() {
    this.setInput = function () {};
    this.clearInput = function () {};
    this.destroy = function () {};
  }
  root.SimpleKeyboard = { default: NoopKeyboard };
})(typeof window !== 'undefined' ? window : globalThis);
