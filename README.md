# Pacific Command Enhanced — Game Modes v0.4.1

An **unofficial, independent playtest companion** for *Pacific Command*. The app imports JSON exported by the [original Type37/WarLore Fleet Builder](https://type37.github.io/pacific-command-builder/); no original builder code is embedded.

## Three modes

| URL | Ship combat | Aircraft operations |
| --- | --- | --- |
| `/original/` | Published sinking, hit allocation and Armoured thresholds | Original pooled CAP/Strike strength, no new readiness or permanent-loss rules |
| `/aircraft/` | Original hit allocation; **house rule: confirmed hits accumulate against armour across attacks** | Per-carrier CAP, Escort, Strike; readiness cycles; 5–6 permanent-loss checks |
| `/experimental/` | v0.3's *experimental* cumulative hull damage, knockouts and Hangar Fire | Same enhanced aircraft operations |

At the root URL, choose a mode. Each stores its own browser save under a distinct key and exports backups tagged with its mode. Cross-mode battle-backup imports are blocked to avoid applying the wrong rules. **Import the same original Fleet Builder JSON independently into each mode** to compare game types.

### Matching physical models

Fleet Overview now displays the imported **game category** (for example CV, CA, BB), special-rule labels and two **editable reference fields** per ship:

- **Historical class**: e.g. Yorktown-class or Takao-class.
- **Model/base reference**: e.g. CV-02 or Blue Base 3.

Use the *Match model* button to edit these. The Fleet Builder export includes ship type and pennant/name, but does **not** reliably contain a historically precise class for each ship, so that field is left blank unless explicitly provided in an imported file. The same two fields are available on aggregated destroyer/screen records, where they may describe several miniatures.

### Original ship-hit workflow

Choose **Record attack hits** on the defending task force, enter the dice counts (confirmed 6; unconfirmed 4–5), then assign hits against rows. Confirmed hits are assigned by the attacker and unconfirmed hits by the defender, including to destroyers. In **Original** mode, armoured vessels require the published number of confirmed hits in one attack. In **Enhanced Aircraft**, each confirmed hit reduces a ship's armour by 1, persistent across attacks (e.g., Armoured (2): 2/2 → 1/2 → sunk). **One unconfirmed hit still sinks any ship**. This is a house rule, not the published game. A destroyed vessel stops contributing Guns and AA. Original naval modifiers, especially class-selected Improved Armour and Torpedo Belts, should be adjudicated from your rulebook; the prototype does not infer class selections from insufficient export data.

### Enhanced aircraft

- CAP Ready → **On Station** → **Low Fuel** → Refuel/Rearm → Ready. CAP can launch and defend in the same round.
- CAP can be recovered early after the On Station round, skipping Low Fuel but refuelling throughout the next round.
- Strike and Escort Ready → Airborne → Refuel/Rearm → Ready.
- CAP, Strike and Escort may launch in the same round when Ready. Low Fuel CAP does not block Strike.
- Record permanent aircraft losses on D6 5–6 using the owning carrier's group controls.
- Carrier capacity uses the builder's fleet modifiers: normal CV 15 / CVL 6; *Increased Aircraft Capacity* adds +3; *Aircraft Shortage* halves (rounding up).

**Outstanding playtest question:** diversion/recovery of aircraft airborne when their original carrier is sunk is not implemented yet. Handle it manually pending a tested recovery rule.

### Save and export

- Local browser saves are per-mode and per-device; there is no server or syncing.
- Export a JSON **Battle backup** before switching device, clearing browsing data or updating major versions.
- Earlier v0.3 battle states are migrated in **Experimental** mode only, preserving the original version's cumulative damage semantics.
- For the new two modes, import the original Fleet Builder JSON; don't use an Experimental battle backup as a starting point.

## Hosting

This is a static GitHub Pages site. The root `index.html` is a mode selection screen. Three mode pages load the shared JavaScript/CSS from `assets/`. Settings → Pages → Deploy from a branch → `main` → `/(root)`.

## Attribution

*Pacific Command* written by Mike Hutchinson and published by Osprey Games. Fleet Builder by Type37 / WarLore. This is an unofficial house-rules playtest companion, not an official rulebook or endorsement. Roll dice and resolve situations requiring judgement at the tabletop.
