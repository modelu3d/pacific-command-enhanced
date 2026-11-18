# Pacific Command Enhanced — Game Modes v0.5

An **unofficial, independent playtest companion** for *Pacific Command*. The app imports JSON exported by the [original Type37/WarLore Fleet Builder](https://type37.github.io/pacific-command-builder/); no original builder code is embedded.

## Three modes

| URL | Ship combat | Aircraft operations |
| --- | --- | --- |
| `/original/` | Published sinking, hit allocation and Armoured thresholds | Original pooled CAP/Strike strength, no new readiness or permanent-loss rules |
| `/aircraft/` | Original hit allocation; **house rule: confirmed hits accumulate against armour across attacks** | Per-carrier CAP, Escort, Strike; readiness cycles; 5–6 permanent-loss checks |
| `/experimental/` | v0.3's *experimental* cumulative hull damage, knockouts and Hangar Fire | Same enhanced aircraft operations |

At the root URL, choose a mode. Each stores its own browser save under a distinct key and exports backups tagged with its mode. Cross-mode battle-backup imports are blocked to avoid applying the wrong rules. **Import the same original Fleet Builder JSON independently into each mode** to compare game types.


### v0.5 — iPad carrier command and bomber formations

- **Carrier Overview** (default in Enhanced Aircraft and Experimental): one compact row per carrier, grouped under prominent TF headings. Each row shows fighters/bombers, CAP, Escort, Strike and their Ready/On Station/Low Fuel/Refuel states.
- **Task-force air totals:** combined CAP, available and airborne Escort/Strike; Strike includes Dive and Torpedo totals.
- **Tap a carrier row** to open just that carrier's detailed operations. The **Details** control opens all carriers; **Overview** returns to the fleet overview.
- **Fit iPad / Exit focus:** hides unrelated website navigation and extended rule notes to fit two-to-four carriers on a landscape iPad screen. In landscape on a touch device, focus is enabled automatically. Larger fleets may need a task-force filter or scrolling.
- **Formations** replaces the historical misnomer 'squadrons' in game-facing aircraft labels. One Formation is one game-strength die; original JSON names such as `fighter-sqn` and `bomber-sqn` are preserved for importing fleets.
- **Dive / Torpedo Bomber slider:** set a carrier's bomber composition during pre-battle setup. Default is approximately 75% Dive / 25% Torpedo (e.g. eight bomber Formations = six Dive, two Torpedo). One Strike group and one readiness cycle are retained. Composition is locked after the battle begins.
- **Permanent losses** can be recorded against Dive or Torpedo Formations separately, and the game totals update accordingly.
- In enhanced aviation modes, when the **Unreliable Torpedoes** fleet modifier is present, apply its confirmed-hit reroll only to the Torpedo Bomber dice. This is an experimental change, not the published rules (which affect the entire Strike).
- Original ship combat, targeting, and aircraft rules remain unchanged in **Original Rules**. Enhanced Aircraft retains the cumulative armour house rule; Experimental retains its separate hull damage mechanic.
- Existing v0.4 battle JSON saves and browser state remain compatible. The storage keys and backup format have not changed.

### v0.4.2 — Carrier Operations headings

Carrier Operations now presents a prominent heading for every task force, including its persistent TF identifier, editable display name, and surviving-carrier count. The heading is formatted for desktop and iPad. This is a visual-only update; the aircraft rules, save formats and existing battle backups are unchanged.

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
