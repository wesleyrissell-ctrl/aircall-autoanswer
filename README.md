# Aircall Inbound Auto-Answer

Chrome extension that auto-answers inbound calls in the Aircall web phone after a short delay and beep. Force-installed for One Imaging Member Services agents through Island's extension policy.

- Extension ID: `fdmlapnekedigmhlookbdnjdeeialdag`
- Update URL: https://wesleyrissell-ctrl.github.io/aircall-autoanswer/updates.xml
- Package: https://wesleyrissell-ctrl.github.io/aircall-autoanswer/aircall-autoanswer.crx

## What's in here

| Path | What it is |
| --- | --- |
| `extension/` | Source code (manifest, content script, popup) |
| `aircall-autoanswer.crx` | Signed build that Island installs |
| `updates.xml` | Update manifest Island checks for new versions |

The signing key is not in this repo and must never be added to it. Without that same key, new builds get a different extension ID and installed copies stop updating.

## Shipping an update

1. Edit the code in `extension/` and bump `version` in `extension/manifest.json`.
2. Repack with the same signing key (`~/.aircall-autoanswer-keys/aircall-autoanswer.pem` on Wes's Mac).
3. Replace `aircall-autoanswer.crx` and set the same version in `updates.xml`.
4. Commit. GitHub Pages republishes in about a minute, and Island browsers pick it up on their next update check.

## Settings (per agent)

Click the extension's toolbar icon to turn auto-answer on or off, change the delay, or toggle the beep.
