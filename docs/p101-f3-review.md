# Pass 101 fix lane p101-f3

Reviewer: Claude Opus 5.5, fix lane p101-f3, with three forked sub-lanes for 161, 173 and 183/184. Date: 2026-09-28.

This lane fixes the medium findings for 131, 161, 173, 179, 183/184, 188 and 203 from `docs/p101-audit-086-170.md` and `docs/p101-audit-171-255.md`. It also fixes the quick low findings in the files it owns: 92, 100, 161's eye, 173's C-frame, 183's arm root, 203's pin and 230's rods.

Claimed files:
- `authored-cranks.js`, `slotted-sector.js`, `authored-governors.js`, `authored-silk-traverses.js`, `authored-engine-reversers.js`, `authored-quadrant-catches.js` and `authored-gab-disengagers.js`
- `authored-linkages.js`, `mujoco-ball-governor/`, `mujoco-silk-tappet/`, `mujoco-quadrant-catch/`, `quadrant-catch-finite-parts.js` and `quadrant-catch-motion.js`
- `gab-disengager-188.js`, `gab-disengager-shared.js` (unedited), `mujoco-crank-slider/`, `mujoco-quick-return/` (unedited) and `rotation-indicators.js`

Captures are outside Git, under `/dev/shm/p101/f3/`: `NNN-before.png`, `NNN-after.png` and zooms. Each shows the plate, the default view, other phases and rotated views.

## Production routes checked

| ID | Production route |
|---|---|
| 131 | `model-loader` → `slotted-sector.js` (not `authored-cranks.js`) |
| 161 | `baked/ball-governor.js`: a serialized scene built by `mujoco-ball-governor/solids.js`, then rebaked |
| 173 | `baked/tappet-silk-traverse.js` → `mujoco-silk-tappet/assembly.js` and `solids.js` |
| 179 | `authored-engine-reversers.js` |
| 183/184 | `authored-quadrant-catches.js`, `quadrant-catch-finite-parts.js` and `baked/quadrant-catch-motion.js` |
| 188 | `authored-gab-disengagers.js` → `gab-disengager-188.js` |
| 203 | `authored-linkages.js` |
| 92 | `mujoco-baked-routes` → `mujoco-crank-slider/geometry.js` |
| 100 | `mujoco-baked-routes` → `mujoco-quick-return/geometry.js` |
| 230 | `authored-cranks.js` (`quadratureTwinCrankShaftCoupling`) |

## 131 (medium)

**Finding confirmed.** The sector, its teeth and the rack were all driven blue in one plane. The plate has 11 sector teeth (counted on a 4× crop) and 9 rack teeth.

**Fix** (`slotted-sector.js`):
- The rack bar and its teeth are now brass.
- The sector has 11 teeth, and its fan and the mirrored web windows span 11 pitches.
- The rack keeps 10 teeth, because the stroke needs them.

**Test.** `slotted-sector-reconstruction` now asserts 11 teeth. It still checks the pin fit, no tooth overlap, working engagement, the guides and the wrong-phase control at 721 poses.

**Screens.** Coincident faces: 0. Disconnected parts: only the 0.02 guide clearance the audit already noted.

**Captures.** `131a.png`.

## 161 (medium; low eye), sub-fork

The lower support is now one solid:
- In plan, a bar whose sides run tangentially into a round boss concentric with the spindle, with a closed slot.
- In elevation, it tapers from 0.40 at the boss to 0.16 at the outer end.

The separate bearing drum and the 25° tilted fork are removed. The spindle-end eye is now 0.2 deep, matching the rod.

**Rebake.** `scripts/bake-ball-governor.mjs` (2001 samples; closure 5.4e-11). `161-solid-clearance.json` is regenerated (65 poses, no failures).

**Screens.** Clean. The 0.097 and 0.05 lips are gone.

**Residual.** The slot shows only from above or at an angle, not in the level default view.

**Captures.** `161-before.png` and `161-after.png`.

## 173 (medium; low C-frame), sub-fork

**Striker.** The striker is now Brown's stout stud:
- a shank of radius 0.054 with a rounded tip on the teeth's path;
- a hex nut;
- a collar 0.30 across, about 0.24 of the star wheel, seated on the striker box's end face.

The shank is the MuJoCo contact capsule. Its height keeps the old reach into the tooth tips.

**Rebake.** Each turn advances the wheel by 0.34865–0.34907 against a pitch of 0.34907, with no rollback. The bake has 144,001 native samples, now 2,631 keys.

**C-frame.** The undrawn upright and web are removed, so the box and foot are plain blocks broken off as drawn.

**Reports regenerated:** 173-native-tappet, 173-tappet-bake, 173-tappet-baked-clearance (21,040 poses, minimum gap 0.00067), 173-assembly-clearance and 173-source-fit.

**Screens.** One intended floating fixed group: the striker box and stud.

**Captures.** `173-after.png` and `173-strike.png`.

## 179 (medium; lows)

**Finding confirmed.** The pedestal was a ring perched on the foundation through a thin beam, with degenerate support meshes. The foundation stopped in depth in front of the pedestal's plane.

**Fix** (`authored-engine-reversers.js`). Brown draws a cast lug: a round top, flared flanks and a flat foot on the ground line. The pedestal is now one extrusion:
- a top arc of r 0.30 concentric with the pivot;
- straight flanks tangent to that arc;
- concave fillets into a 0.84-wide foot, sunk 0.01 into the foundation;
- a bore of 0.123 for the pin.

Other changes:
- The foundation is deepened forward (z −1.15 to −0.30), so the whole foot stands on it.
- The support beam and its zero-size meshes are removed.
- The lever's oversized 0.25 black hub is now Brown's plain pin (r 0.12). It runs through the lug and stands 0.04 proud of the lever. The lever bar's foot is a half-round concentric with the pin.

**Lows.**
- The foundation colour is kept. It is the shared `groundBlock` stone used for every engraved ground, and recolouring one movement would break consistency.
- The valve spindle is kept at 0.19 diameter. On the plate it measures about 0.15, so it is not thin.

**Tests.** There is a new test in `engine-reverser-solids`. `movement-179` passes.

**Reports.** `179-current-solids.json` is regenerated: 129 poses, 0 intersections. The first run caught a 3.5e-5 pin/bore facet overlap, fixed with the 0.003 running fit.

The other 179 reports (`native-stop`, `newton-baseline`, `source-fit`, `existing-solids`, `browser`) already fingerprinted an older file at HEAD. They cover the eccentric stop and the source fit, which this change does not touch, so they were not regenerated.

**Screens.**
- Coincident faces: the first run flagged the foot on the foundation top; the foot is now sunk, and the screen shows 0.
- Disconnected parts: the pedestal's short-of-pin flag is gone. The remaining flags are the documented floating eccentric group and the lifted rod.

**Captures.** `179-before.png`, `179-after.png` and `179-zoom.png` (lug from front, oblique and behind).

## 183/184 (medium; low arm root), sub-fork

**Intent.**
- The caption makes 183/184 a modification of 181/182, where the released upper handle is pulled up by its weight to open the valves. A real throw is intended.
- The original site has no animation for 181–184.
- Each plate shows one state only.

**Limit.** A 55° throw is impossible with Brown's C-arm. The tappet is still rising at release, and the arm meets it at 33.5°. Trial stops:
- 20°, 30° and 35° run clean.
- 40° and 55° drive the C-arm into the tappet (28 and 407 px²).

**Fix.**
- The upper free stop is raised from 10° to 30°, and the motion is rebaked (720 samples). The tappet returns the arm through the full 30° before the lower handle falls.
- The C-arm root edges now leave the boss on tangents.
- `183-current-solids.json` is regenerated (65 poses, worst 8e-5).
- A "Pass 101: upper handle throw" section is added to `docs/movement-183.md`.

**Screens.** The lip screen still flags 0.091 on the curled arm root. This is a false positive: the zooms show a flush tangent join.

**Captures.** `183-before.png`, `183-after.png`, `183-strip.png` and `184-after.png`.

## 188 (medium)

**Finding confirmed.** The rear web was a square slab that stopped abruptly at x −2.53. That left a notch in the top face from above and a stepped end from behind and below.

**Fix** (`gab-disengager-188.js`). The web is now one vertical extrusion of its plan outline:
- It is exactly the rod's height, rod bottom to bar top, so no step shows on the top or bottom edge.
- Its back face fairs into the rod's back face with a tangent S-curve (raster x 150 to 245), ending ahead of the handle hub.

The web stays because it carries the leaf clip, which lies behind the handle plane.

**Test.** There is a new test in `movement-188`: the web is flush top and bottom, its front meets the rod's back face, and its end is tangent.

**Report.** `186-187-cam-solids.json` is regenerated (hash only).

**Screens.** Coincident faces: 0. The disconnected-parts screen shows no new flags.

**Captures.** `188-before.png` and `188-after.png` (front, −40/+25, behind, +40/−30, zooms).

## 203 (medium, disputed; low fixed)

**Not changed: the model already matches the plate.**
- On a 5× crop, the straight arm's end is drawn dashed: its outline and round end round the pin are dashed.
- The hooked arm's outline and its slot are solid, and the straight arm's edges stop at the hook's rounded end.

So the straight arm passes behind the slotted arm. The model has it that way (output arm plane z −0.39, slotted plate z ±0.14), and the pin shows through the slot, as drawn. The audit misread which part is dashed.

**Low.** The slot pin is now brass instead of pale steel. A new test in `movement-203` checks this.

**Reports.** `144-assembly.json` and `145-assembly.json` are regenerated (hash only).

**Captures.** `203-before.png`, `203-after.png` and `203plate.png` (the plate crop).

## Quick lows

### 92
The slide block and shoe are now gold (accent), so the blue rod's end reads against the block (`mujoco-crank-slider/geometry.js`).
- Rebaked with `bake-mujoco-movement.mjs 92`. The asset is unchanged; only the provenance's geometry hash changed.
- There is a new test in `mujoco-crank-slider`.
- Captures: `92-before.png` and `92-after.png`.

### 100
The plain crank disk and its hubs take the shared quadrant cue (`src/data/rotation-indicators.js`, as for 98 and 99).
- Captures: `100-before.png` and `100-after.png`.

### 230
Before, both rods stood 0.2–0.27 off their faces on bare pins. Now (`authored-cranks.js`):
- Hubs stand 0.02 proud of the disk and rear crank faces.
- Shaft ends stop 0.005 inside the hub faces, with no coplanar caps.
- Rods ride 0.02 off the hubs.
- Pins end about 0.02 past the rod eye liners.

There is a new test in `movement-230`. The coincident-faces screen shows 0.

Reports regenerated for the `authored-cranks.js` fingerprint (hash only): 146, 156, 157 and 158 `-oracle-comparison`/`-source-measurements`, `159-source-clearance`, `160-authored-review` and `160-spatial-band`.

Captures: `230-before.png` and `230-after.png`.

## Not done
- **147 (low, fan-arm straps):** 147 is served by `mujoco-fan-governor`, not by a file this lane owns.
- **179 lows (foundation colour, spindle):** kept, as explained under 179.
- **203 depth order:** disputed, as explained under 203.
