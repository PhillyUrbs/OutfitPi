## Promotion checklist

This PR promotes a release between channels. Verify each item before merging.

### What's being promoted
- **From:** <!-- e.g. dev -->
- **To:** <!-- e.g. beta -->
- **Notable changes:** <!-- one-line summary or "see CHANGELOG" -->

### On-device verification (run on the Pi via Settings → Updates → Force install)
- [ ] Force-installed the **previous** released ref on dev channel; confirmed the dashboard, settings, and weather all load.
- [ ] Force-installed this PR's HEAD ref; confirmed the restart overlay reconnected and the dashboard came back without the "Network error" page.
- [ ] `/api/health` reports the expected `sha` after the restart.
- [ ] Settings page: scroll, on-screen keyboard, and theme toggle all still work.
- [ ] No new errors in `journalctl --user -u outfitpi -f` for ~60s after restart.

### Code & CI
- [ ] CI is green (lint + 3-version pytest + upgrade-path tests).
- [ ] No new dependency-review warnings.
- [ ] Every commit since the previous release on this channel uses Conventional Commit prefixes.
- [ ] If config schema changed, `tests/test_upgrade_path.py::SUPPORTED_FROM_TAGS` includes the previous release.

### Rollback plan
If something breaks after promotion, revert via:
```
# On the affected Pi
ssh phil@<pi-ip> 'cd ~/outfitpi && git fetch origin --tags && git reset --hard <previous-tag> && bash install.sh && systemctl --user restart outfitpi'
```
