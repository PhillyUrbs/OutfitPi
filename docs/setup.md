# Setup

This page walks through getting OutfitPi running on a Raspberry Pi with the
official 7" touchscreen.

## Hardware

- Raspberry Pi 3, 4, or 5 (64-bit Pi OS recommended).
- Official Raspberry Pi 7" touchscreen (800×480), in landscape orientation.
- Power supply rated for the Pi + display.

## Install

1. Flash **Raspberry Pi OS (Bookworm or later)** to an SD card and boot the Pi.
2. Connect to Wi-Fi or Ethernet.
3. SSH in (or open a Terminal on the Pi) and run:

        curl -sSL https://raw.githubusercontent.com/PhillyUrbs/OutfitPi/main/install.sh | bash

   The installer creates `~/outfitpi`, installs Python deps, and starts the
   service as a systemd `--user` unit.

4. Open `http://<pi-ip>:5000` from any browser on the LAN. The setup wizard
   walks you through:

    - Adding 1 or 2 children (name, gender, comfort offset).
    - Setting the location by ZIP/postal code (or using auto-IP geolocation).
    - Picking units (°F or °C).

![Setup wizard](img/setup.png){ loading=lazy }

## Kiosk mode

The installer registers an autostart entry that launches Chromium in kiosk
mode pointing at the local OutfitPi URL. After reboot the dashboard fills the
screen automatically.

If kiosk mode doesn't start, see [Troubleshooting](troubleshooting.md).
