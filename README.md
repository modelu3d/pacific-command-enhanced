# Pacific Command Enhanced — Battle Companion (v0.3)

An **unofficial, independent playtest companion** for *Pacific Command*. Build and export a fleet in the [Type37/WarLore Fleet Builder](https://type37.github.io/pacific-command-builder/), then import that JSON into the companion.

**Application:** [Open Pacific Command Enhanced](https://modelu3d.github.io/pacific-command-enhanced/) (available after GitHub Pages is enabled).

## Features
- Individual ship damage and automatic recalculation of task-force Guns / AA.
- Per-carrier CAP, Escort and Strike strengths, permanent aircraft loss recording and combined task-force air totals.
- CAP **Ready → On Station → Low Fuel → Refuel/Rearm → Ready** (launching CAP immediately establishes On Station).
- **Recover CAP early** while On Station: refuel throughout the next round; Ready the following round.
- CAP, Strike and Escort can launch in the same round if each group is Ready; Low Fuel CAP does **not** block an offensive launch.
- Strike and Escort **Ready → Airborne → Refuel/Rearm → Ready**.
- Experimental hangar-fire damage, Undo, local save and JSON backup / import.

## Play on iPad
Open the website in Safari → Share → Add to Home Screen. Download your fleet's JSON in the original builder and choose **Import fleet JSON** in this companion. Back up active battles using **Share / Save backup**.

**Important:** Browser storage is local to the device and website; battles **do not sync** across devices. Export JSON backups before changing browser/storage/device. A public GitHub repository does not publish your locally saved battles.

## Hosting
This repository deploys a self-contained `index.html` (no external dependencies). GitHub Pages must be enabled under **Settings → Pages → Deploy from a branch → main → /(root)**.

## Attribution and scope
*Pacific Command* is written by Mike Hutchinson, published by Osprey Games. Original fleet-building tool by Type37 / WarLore. This companion is not affiliated with either creator or publisher. Ship statistics and game mechanics are used for an experimental house-rules companion; this is not an official rules reference. The app does **not** redistribute the original fleet builder's application source. Dice are rolled at the tabletop.
