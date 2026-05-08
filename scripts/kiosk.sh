#!/usr/bin/env bash
# Launch Chromium in kiosk mode pointed at the local OutfitPi server.
# Works on both X11 (Bullseye) and Wayland/labwc (Bookworm/Trixie).
set -euo pipefail

URL="${OUTFITPI_URL:-http://localhost:5000}"

# Wait for the OutfitPi server to be reachable (max ~30s).
for _ in $(seq 1 30); do
  if curl -sS -o /dev/null -m 1 "$URL" 2>/dev/null; then break; fi
  sleep 1
done

# Find Chromium binary (Bookworm/Trixie ship `chromium`; Bullseye `chromium-browser`).
if command -v chromium >/dev/null 2>&1; then
  BROWSER=chromium
elif command -v chromium-browser >/dev/null 2>&1; then
  BROWSER=chromium-browser
else
  echo "Chromium not found. Install with: sudo apt install chromium" >&2
  exit 1
fi

# Disable screen blanking. xset is X11-only; on Wayland this is a no-op.
if command -v xset >/dev/null 2>&1 && [[ -n "${DISPLAY:-}" ]]; then
  xset s off || true
  xset -dpms || true
  xset s noblank || true
fi

# Wayland-friendly flags. --ozone-platform-hint=auto picks Wayland when
# WAYLAND_DISPLAY is set, otherwise falls back to X11.
# --password-store=basic + --use-mock-keychain suppress the gnome-keyring
# "create new keyring password" prompt on first launch.
# Respawn loop: if Chromium exits (crash, OOM, user closed it), relaunch
# after a short backoff. Exit cleanly on SIGTERM/SIGINT.
trap 'exit 0' INT TERM
while true; do
  "$BROWSER" \
    --noerrdialogs \
    --disable-infobars \
    --kiosk "$URL" \
    --incognito \
    --no-first-run \
    --disable-translate \
    --disable-features=TranslateUI \
    --check-for-update-interval=31536000 \
    --ozone-platform-hint=auto \
    --password-store=basic \
    --use-mock-keychain \
    --start-maximized \
    --window-position=0,0 || true
  sleep 3
done
