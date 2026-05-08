# Updates & channels

OutfitPi can auto-update from one of three release channels.

| Channel | Source | Use it for |
|---|---|---|
| **Stable** | latest non-prerelease GitHub release | day-to-day use |
| **Beta** | latest GitHub release including prereleases | trying upcoming changes a step ahead |
| **Dev** | HEAD of the `dev` branch (every commit) | testing in-flight work |

Switch channels in **Settings → Updates → Channel**.

{{ img("updates.png", "Updates") }}

## Auto-update behavior

- Auto-check is **on** by default for every channel.
- Auto-install is **on** by default. Updates land within minutes of being
  published; the dashboard shows a spinner during the swap and reloads itself
  when the new build is up.
- dev and beta channels force telemetry to **full** so issues can be
  diagnosed; stable defaults to errors-only.

## Manual install

If a check finds an update, an **Install update** button appears next to the
status line. Tapping it runs the same fetch + reset + restart flow as the
auto-installer.

## Dev channel: force install a specific build

When the channel is **Dev**, an extra panel appears with a scrollable list of
recent tags and dev commits. Pick one (or type a ref into the free-form
input) and tap **Force install** to roll forward or back to that exact ref.
Useful for repro'ing bugs and exercising the upgrade flow.
