# Troubleshooting

## Service status

```
systemctl --user status outfitpi
journalctl --user -u outfitpi -f
```

## Dashboard says "Network error. Will retry."

The OutfitPi server is unreachable. Most often it's mid-restart after an
update; wait 30 seconds and refresh. If it persists:

```
systemctl --user restart outfitpi
```

## Kiosk doesn't start on boot

The kiosk autostart entry lives at
`~/.config/autostart/outfitpi-kiosk.desktop`. To relaunch manually:

```
bash ~/outfitpi/scripts/kiosk.sh
```

If Chromium isn't installed, run `sudo apt install chromium`.

## Touch scrolling is unreliable

Make sure the kiosk service is running with `--touch-events=enabled`. The
shipped kiosk script already includes it; if you customized the script,
restore it from `scripts/kiosk.sh` in the repo.

## Settings page won't open / scroll

Verify the on-screen keyboard isn't stuck open: tap **Hide keyboard** in the
keyboard panel. The Settings page uses a fixed top bar with a scrollable
content area below — drag-scroll or use the scrollbar on the right.

## "1 vulnerability" warning on GitHub pushes

This is a Dependabot alert for a known issue in a pinned dependency. Updates
to fix it land via grouped weekly Dependabot PRs to `dev`. If you're tracking
the dev channel on the Pi, the fix arrives automatically.

## Roll back to a previous version

On the dev channel, use **Settings → Updates → Force install** and pick the
prior tag from the list.

For other channels, on the Pi:

```
cd ~/outfitpi
git fetch origin --tags
git reset --hard <previous-tag>
bash install.sh
systemctl --user restart outfitpi
```
