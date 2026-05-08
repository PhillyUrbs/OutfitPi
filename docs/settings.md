# Settings

Open Settings from the gear icon in the top-right of the dashboard, or browse
to `http://<pi-ip>:5000/settings`.

![Settings](img/settings.png){ loading=lazy }

## Autosave

Every change saves automatically. Sliders, checkboxes, and radio buttons save
as soon as you move them; text fields save when you tap off them. A "Saved"
toast confirms each save.

## What you can change

- **Children** — add, rename, or remove up to two kids; tweak each one's
  comfort offset (-10°F to +10°F).
- **Temperature unit** — °F or °C (display only; thresholds always stored
  in °F internally).
- **Outfit thresholds** — boundaries between cold / cool / warm / hot.
- **Location** — postal code (auto-resolves to lat/lon when you tap off
  the field) or manual lat/lon.
- **Remote web access** — when on, the server binds to `0.0.0.0` so any
  device on the LAN can reach the dashboard. Toggling this restarts the
  server.
- **Updates** — channel and auto-install behavior. See [Updates](updates.md).
- **Display** — theme (auto / light / dark). Auto means light from 6 AM to
  7 PM local time, dark otherwise.
- **Telemetry** — anonymous error reporting (none / errors / full). dev and
  beta channels default to "full".

## On-screen keyboard

Tapping any text field opens an on-screen keyboard at the bottom of the
screen. Numeric fields (ZIP, thresholds, lat/lon) get a digits-only layout.
Tap **Hide keyboard** to dismiss it.
