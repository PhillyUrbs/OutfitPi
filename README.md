# OutfitPi

[![CI](https://github.com/PhillyUrbs/OutfitPi/actions/workflows/ci.yml/badge.svg)](https://github.com/PhillyUrbs/OutfitPi/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://www.python.org/)

Kid-friendly weather-based outfit recommender for the Raspberry Pi
touchscreen. Glance at the screen, see what each kid should wear today.

## Features

- Current weather for your location (Open-Meteo, no API key)
- 4 temperature tiers (hot / warm / cool / cold) with rain awareness
- Up to 2 kids, each with a per-child comfort offset
- Touch-first UI for the Pi Touchscreen (800×480) and Touchscreen 2 (720×1280 portrait)
- Phone or laptop access on your home network (optional)
- First-run setup wizard with virtual keyboard
- Auto-refresh every 30 minutes (configurable)
- In-app updates via GitHub releases
- Opt-in error reporting via Sentry (None / Errors only / Full)
- Internationalization-ready (Flask-Babel)

## Hardware

- Raspberry Pi 4 (recommended) — Pi 3 / 5 / Zero 2 W also supported
- Official 7″ Raspberry Pi Touchscreen *or* Touchscreen 2 (portrait)
- Raspberry Pi OS Bookworm (64-bit recommended)

## Install (one-liner)

SSH into your Pi, then run:

```bash
curl -sSL https://raw.githubusercontent.com/PhillyUrbs/OutfitPi/main/install.sh | bash
```

The installer:

- installs Python 3.11+ and git if missing
- clones into `$HOME/outfitpi`
- creates a venv and installs dependencies
- installs and starts a user-mode `systemd` service (no extra `sudo`)
- optionally installs a Chromium kiosk autostart entry

When it finishes it prints the URL to complete setup from any device on
your network — typically `http://<your-pi-ip>:5000`.

## Configuration

The setup wizard creates `config.yaml`. To edit by hand, copy
[`config.example.yaml`](config.example.yaml) and modify. See that file for
all options.

## Troubleshooting

- **Can't find the Pi's IP** — On the Pi: `hostname -I`, or check your
  router's connected-devices list.
- **Service won't start** — `journalctl --user -u outfitpi -n 100`
- **"Can't reach the weather service"** — usually a transient network
  issue; OutfitPi shows a stale-cache warning until the next refresh.
- **Update failed** — Make sure `git` is installed and the install
  directory hasn't been hand-edited (the updater uses `git reset --hard`).
- **Locked out after disabling remote access** — log into the Pi and
  re-enable from the local browser, or edit `config.yaml`:
  `web_remote.enabled: true`, then `systemctl --user restart outfitpi`.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

This is a home-network appliance. The web UI has no authentication. Only
enable remote access on networks you trust. See
[SECURITY.md](SECURITY.md) for vulnerability reporting.

## License

MIT — see [LICENSE](LICENSE).
