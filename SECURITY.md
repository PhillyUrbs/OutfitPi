# Security Policy

## Supported Versions

Only the latest released version of OutfitPi receives security updates.

## Reporting a Vulnerability

Please report security issues **privately**:

- Open a [GitHub Security Advisory](https://github.com/PhillyUrbs/OutfitPi/security/advisories/new) (preferred), or
- Email the maintainer listed in the GitHub profile.

We aim to acknowledge reports within 7 days.

## Network exposure

OutfitPi is designed for **trusted home networks**. The web UI has no
authentication. When **Remote web access** is enabled, anyone on your LAN
can view the dashboard and change settings (including child names and
location).

- Do **not** expose OutfitPi to the public internet.
- Do **not** port-forward the OutfitPi port through your router.
- Treat any LAN OutfitPi is on as the trust boundary.

## Telemetry

Opt-in error reporting via Sentry can be set to `none`, `errors`, or `full`.
Even in `full` mode, OutfitPi scrubs:

- IP addresses
- Latitude/longitude coordinates
- Child names

If you find an event that contains personal data, please report it as a
security issue.
