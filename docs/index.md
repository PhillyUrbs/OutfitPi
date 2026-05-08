# OutfitPi

Kid-friendly weather-based outfit recommender for the Raspberry Pi touchscreen.

![Dashboard](img/dashboard.png){ loading=lazy }

## What it does

OutfitPi pulls the current forecast from [Open-Meteo](https://open-meteo.com)
and shows two outfit recommendations — one per child — sized for the official
Raspberry Pi 7" touchscreen. After 7 PM (or sunset, whichever comes first) it
flips to a "pajamas" view.

## Highlights

- Free; no API keys, no paid services.
- Touch-first UI; on-screen keyboard for setup.
- Auto-updates from one of three release channels (stable / beta / dev).
- Settings autosaves; dark or light theme based on time of day.
- Dev-channel toggles for previewing day/night and forcing a build.

## Quick start

1. Flash Raspberry Pi OS to an SD card and boot the Pi with the official 7"
   touchscreen connected.
2. SSH in and run the installer:

       curl -sSL https://raw.githubusercontent.com/PhillyUrbs/OutfitPi/main/install.sh | bash

3. Open `http://<pi-ip>:5000` from any browser on the LAN to complete setup.

Detailed walkthroughs: see [Setup](setup.md), [Daily use](daily-use.md),
[Settings](settings.md), and [Updates](updates.md).
