#!/usr/bin/env bash
# Launch Chromium in kiosk mode pointed at the local OutfitPi server.
# Intended for autostart on a Raspberry Pi running Bookworm with a
# touchscreen display.
set -euo pipefail

URL="${OUTFITPI_URL:-http://localhost:5000}"

# Find Chromium binary (Bookworm ships `chromium`; Bullseye `chromium-browser`).
if command -v chromium >/dev/null 2>&1; then
  BROWSER=chromium
elif command -v chromium-browser >/dev/null 2>&1; then
  BROWSER=chromium-browser
else
  echo "Chromium not found. Install with: sudo apt install chromium" >&2
  exit 1
fi

# Disable screen blanking and DPMS while the kiosk is running.
if command -v xset >/dev/null 2>&1; then
  xset s off || true
  xset -dpms || true
  xset s noblank || true
fi

exec "$BROWSER" \
  --noerrdialogs \
  --disable-infobars \
  --kiosk \
  --incognito \
  --no-first-run \
  --disable-translate \
  --check-for-update-interval=31536000 \
  "$URL"
