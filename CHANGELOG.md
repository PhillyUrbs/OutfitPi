# Changelog

## [0.5.0](https://github.com/PhillyUrbs/OutfitPi/compare/v0.4.0...v0.5.0) (2026-05-08)


### Features

* enforce per-channel policy at load/save; fix(settings): zip lookup on blur only ([42e0d85](https://github.com/PhillyUrbs/OutfitPi/commit/42e0d8590f35336ea0356807ef2c919d2fb9217d))
* initial OutfitPi v0.1.0 implementation ([d1cf08c](https://github.com/PhillyUrbs/OutfitPi/commit/d1cf08c530c2030fdfa92ebe7bf93168f6c2709a))
* **kiosk:** suppress keyring prompt + auto-respawn on crash ([1d79fab](https://github.com/PhillyUrbs/OutfitPi/commit/1d79fab2e8be389c89cf974c63a7ca7fa89b835d))
* **settings:** auto-lookup ZIP on blur/country change ([4b5e498](https://github.com/PhillyUrbs/OutfitPi/commit/4b5e498e84f1bff007caba07582c745d8eeddee6))
* stable/beta/dev release channels + dev day/night override ([395f0ea](https://github.com/PhillyUrbs/OutfitPi/commit/395f0eab8767a812615b586fad965513361439df))
* **ui:** theme (auto/light/dark), sticky settings topbar, autosave, touch scroll ([fddd7df](https://github.com/PhillyUrbs/OutfitPi/commit/fddd7df5884edc0acfe1b6f329e4fef29df4ea1b))
* **updates:** default auto-install on; dev/beta default to full telemetry ([a201737](https://github.com/PhillyUrbs/OutfitPi/commit/a2017371f190764f61c8e5e10ddc9cf76803b3cc))
* viewport-fixed 2/3-col dashboard, daytime forecast, evening PJ mode, distinct clothing icons ([bf00e69](https://github.com/PhillyUrbs/OutfitPi/commit/bf00e693a224ba75c2028f30125c3764d49d1655))
* ZIP-code location lookup, save toast, auto-reload on version change ([6773119](https://github.com/PhillyUrbs/OutfitPi/commit/6773119196cb57775d0034d95e459af12a6d8fc9))


### Bug Fixes

* **ci:** release-please extra-files config ([#15](https://github.com/PhillyUrbs/OutfitPi/issues/15)) ([493e9e9](https://github.com/PhillyUrbs/OutfitPi/commit/493e9e9f87af6f1c563c5fd35d3e25ab7ce825c9))
* **css:** respect [hidden] on .restart-overlay (display:flex was overriding it) ([1aae863](https://github.com/PhillyUrbs/OutfitPi/commit/1aae863cd4685dbdeaaa6b56c554c19fd90477a0))
* **keyboard:** scroll active field to top of scrollable main ([0b2611b](https://github.com/PhillyUrbs/OutfitPi/commit/0b2611baf9669c6b8615462f30013e6104c5118b))
* **kiosk:** Wayland compatibility + idempotent autostart install ([d7d57e8](https://github.com/PhillyUrbs/OutfitPi/commit/d7d57e8682b22a2c620a9cd7eed11bb5c27ed2e8))
* **settings:** defer text-input autosave until blur ([1eb8c11](https://github.com/PhillyUrbs/OutfitPi/commit/1eb8c114dfffa56334ded8983ecc1b47577d79b6))
* **settings:** zip auto-lookup triggers on tap-outside (pointerdown), not focusin ([e95e576](https://github.com/PhillyUrbs/OutfitPi/commit/e95e576b9625441b829ea3aff6d8f43a5e759387))
* **settings:** zip auto-lookup waits until focus lands on another page element ([1d1262f](https://github.com/PhillyUrbs/OutfitPi/commit/1d1262fe9c1e87f1566dba701ad6723d720284ac))
* **settings:** zip lookup ignores keyboard-induced blur ([35a6603](https://github.com/PhillyUrbs/OutfitPi/commit/35a66036f4c99abcc1272bdddb5bd4bfa7606c69))
* **systemd:** remove invalid User= directive from user-level unit (216/GROUP) ([800d96e](https://github.com/PhillyUrbs/OutfitPi/commit/800d96e70ee24eeb49db0dc936885cb3d902b09b))
* **systemd:** Restart=always so post-setup exit 3 triggers reload ([7407e96](https://github.com/PhillyUrbs/OutfitPi/commit/7407e96d2a8f913fadaa1b39d29629ec4ff60481))
* **ui:** disable text selection on dashboard ([1f0f6d2](https://github.com/PhillyUrbs/OutfitPi/commit/1f0f6d2e45c1adc2c1b7dece7209131d03d132cb))
* **ui:** keyboard fits all rows; numeric layout for number/numeric inputs ([41f1095](https://github.com/PhillyUrbs/OutfitPi/commit/41f1095f55b5d6257fa3ae12b30d78429e8bcc5a))
* **ui:** no text-select while drag-scrolling; explicit Hide-keyboard button ([c1608fb](https://github.com/PhillyUrbs/OutfitPi/commit/c1608fb983d5bcce0d9f63d5fae13994e14b515a))
* **ui:** readable keyboard with shift; add dev theme toggle ([845be99](https://github.com/PhillyUrbs/OutfitPi/commit/845be99882b05b75daa4a60e6e5ace1cc50d2ae9))
* **ui:** scrollable settings via flex column; keyboard on touch devices ([d739e13](https://github.com/PhillyUrbs/OutfitPi/commit/d739e1373de9577a4684d1169726cf37e809d375))
* **ui:** swallow click after touch drag; require vertical motion to scroll ([977dddd](https://github.com/PhillyUrbs/OutfitPi/commit/977dddd073a9999112a4292bea9d8c0872fe9023))
* **ui:** vendor real simple-keyboard, drag-to-scroll fallback ([99492fc](https://github.com/PhillyUrbs/OutfitPi/commit/99492fcfce580e8638c08a41aee4082c68bf8f2b))
* **updater:** dev channel compares against local git HEAD; throttle startup auto-update ([1c5b301](https://github.com/PhillyUrbs/OutfitPi/commit/1c5b3018e592d78438ba0c1564d6cfb8120dabb3))
