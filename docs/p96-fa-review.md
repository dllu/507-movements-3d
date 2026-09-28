# Pass 96 fix lane p96-fa (audit docs/p96-audit-001-085.md)

Reviewer: Claude Opus 5.5, lane p96-fa, 2026-09-28. Sub-lane p96-fa1 (forked) did 048, 052 and 053; the rest was done in the main lane. No git writes. Captures are in `/dev/shm/p96/fa/sh/` (main lane) and `/dev/shm/p96/fa/fa1/` (sub-lane); the "before" captures are the audit's sheets in `/dev/shm/p96/a/sheets/`. A vite server on port 47391 served the working tree, and captures used `/dev/shm/p96/fa/shots.mjs`.

## Claims (owner p96-fa)
fusee-geometry.js, spiral-wheel-geometry.js, authored-intermittent-core.js, reciprocating-pawl.js, jaw-clutch.js, pin-clutch.js, reversing-clutch.js, reversing-clutch-motion.js, display-timing.js, display-profiles.js, tappet-stud-stop.js, opposed-arm.js, opposed-arm-geometry.js, spring-rack.js, spring-rack-geometry.js, movements.json.

## Screens (29, 46, 63, 75, 79 after the fixes)
- Disconnected parts (`/dev/shm/p96/fa/disc.json`): 0 open ends, slivers or lips. 63 reports the stop pin as floating, because it is now a plain fixed stud running back to the omitted back plate, like both shafts (see 063). 79's near-miss count rose from 43 to 49 because of the new spacer collars' bore clearances; short-of-pin is unchanged at 10 (the pawl journals, as before).
- Coincident faces (`cf.json`): 0 flagged pairs for all five.
- Body intersections: worst solid 0 and coaxial 0 for all five.
- Loop seams: 0 above tolerance, 0 mid-cycle pops.
- 63 shares authored-intermittent-core.js with 20 other IDs. Their geometry hashes at three times are byte-identical before and after (`/dev/shm/p96/fa/hash-ic-{before,after}.txt`).
- No saved validation report or bake fingerprints any of the changed files.

## 046 (medium): fixed, with a smooth grooved cone
- **Verdict:** confirmed. `groovedFuseeGeometry` built a helical staircase: cylindrical groove bands plus a cylindrical land at the next turn's radius, so it read as about six flat tiers with the chain crossing their edges. The plate itself shades tiers, but the user asked for Brown's smooth grooved cone.
- **Fix:** `src/simulation/fusee-geometry.js` was rewritten.
  - The surface is one seamless height field over the helix: a straight cone through the chain's centre line (the same conical helix the chain pins follow, r 0.50 to 1.08 over three turns), cut by a helical groove.
  - Under the chain, the groove floor is cylindrical, at the chain line minus 0.021 (the old `floorOffset`, so the chain anchor seat is unchanged). Above the chain it blends smoothly into the cone. Below the chain it rises through a smoothstep shoulder over the whole half pitch, so there is no flat tread and no tier edge.
  - The mesh rows follow the helix (constant groove phase), so every groove edge runs along a row and there is no aliasing ripple. The rows are clamped onto the two end planes, and the collapsed triangles are dropped.
  - The normals are analytic. The caps are flat fans. The mesh is 256 × 48 rows per turn, about 110k triangles.
- **Captures:**
  - `sh/46-m.png`: default, phase 0.375, right, zoom, back zoom, below and top.
  - `sh/46-m2.png`: shadow-free zooms, default and zoom at the final density.
  - `sh/46-mns.png`: the no-shadow zoom that proves the surface is smooth.
- **Tests:** `tests/fusee.test.mjs` 7/7 pass. The ray-cast clearance test now de-indexes the geometry. The minimum chain-to-body clearance is 0.0024 over 129 poses, and the body is closed and outward-facing.
- **Residual:**
  - At 7× zoom the renderer's shadow map still shows acne ripples on the groove shoulders. They disappear with shadows off.
  - The fix would be `shadowNormalBias` or `shadowCameraHalfExtent` on 46's root, which is in `authored-gears-core.js` (owned by p96-fb), so it is deferred. The ripples are invisible at the default zoom.
- **Proposed ledger row:** assessment reasonable; visibleFlaws "".
  - Limits, append: "Pass 96: the fusee is one smooth turned cone with a helical groove (cylindrical floor under the chain, smooth shoulder below it); the stepped tiers are gone. Close zooms show shadow-map acne on the groove shoulders (renderer)."

## 029 (low; p93 regression): fixed
- **Verdict:** confirmed.
  - The baked swept-cut radii (`contact-profiles.js`, unchanged) quantize each flank to whole angular columns. The flank steps by one column between axial stations, for example 44, 44, 43, 42, 41, 40, 40, 39 and so on.
  - The grid mesh joined column to column, so the nearly radial flanks became stair-steps and torn roots.
- **Fix:** in `src/simulation/spiral-wheel-geometry.js` (used only by 029), the mesh is now built from feature-aligned profiles.
  - Each axial station gets the same point count for root, rising flank (10 radius levels found at sub-sample precision), tip, falling flank and root.
  - Each flank level is smoothed across the stations (a 5-station weighted average) and then shifted onto the material-removal side, so the surface never stands proud of the exact cut.
  - Neighbouring stations now join flank to flank as smooth, slightly twisted ruled strips.
- **Captures:** `sh/29-m.png` (the audit's zoom set, default and right) and `sh/29-mns.png` (the same zooms without shadows).
  - The flanks and roots are clean.
  - The remaining faint vertical striation with shadows on is shadow-map acne on the grazing flanks, not geometry.
- **Tests:** `tests/spiral-drive-contact.test.mjs` passes.
  - Its rendered-radius helper now casts real radial rays against bucketed side triangles instead of assuming the grid.
  - The rib never enters the wheel, and a wheel vertex stays within 0.004 of the rib, at 69 phases.
- **Proposed ledger row:** assessment reasonable; visibleFlaws "".
  - Limits, append: "Pass 96: the spur's re-cut teeth are built from feature-aligned station profiles, with each flank level smoothed across the width and offset to the cut side; no stair-stepped flanks."

## 063 (medium; p95 regression): fixed without a bracket
- **Verdict:** confirmed. The p95 dark bracket bar was in plain view. The spring was a 0.07 × 0.038 square-section bar in front of the drop. Its box clamp's corners stood proud.
- **Fix:** in `snapActionStarCounter()` only, in `src/simulation/authored-intermittent-core.js`:
  - **Spring:** one thin flat strip (in-plane width 0.032, depth 0.11), extruded in the drop's own plane and centred in its thickness. This is Brown's double line seen edge-on. It still bends as the end-loaded cantilever with the drop, and its moving end runs into the tail, which reads as slotted to take it. There is no second plane and no face on the drop.
  - **Supports:** the bracket and the box clamp are deleted. The stop pin is a plain dark stud. The spring's held end is gripped in a second stud of the same radius. Each runs straight back, end-on to the default view, to the same back plane as the two shafts (z = diskBack − 0.1). So all four fixed parts read as mounted in one omitted back plate, and nothing new shows in the default view.
- **Captures:**
  - `sh/63-m.png`: default, right, left, top and back-oblique.
  - `sh/63-mz.png`: zooms from the default, left, top and right views, and phases 0.3 and 0.6. The spring bends naturally.
- **Tests:** `tests/movement-063.test.mjs` 7/7 pass.
  - The spring-plane test now asserts that the strip lies inside the drop's thickness.
  - The bracket test was replaced. The new test checks that there is no bracket and no box clamp, that both studs are plain equal cylinders reaching the shafts' back plane, that the stud grips the whole spring width, that the spring end is inside the tail outline at five times, and that the strip clears the stop pin.
  - The models.test 63 block passes.
- **Note:**
  - The disconnected-parts screen lists the stop pin as floating. It is a fixed stud to the omitted back plate, like the shafts, which the screen doesn't flag only because they touch rotors.
  - If the user wants a visible carrier, the minimal option is a thin strip behind the drop joining the two studs. It could not be hidden behind the drop, because Brown puts the stop pin left of the drop, not under it.
- **Proposed ledger row:** assessment reasonable; visibleFlaws "".
  - Limits, replace the p95 bracket sentence with: "Pass 96: no bracket. The flat leaf spring lies in the drop's plane and runs into the tail; the stop pin and the stud gripping the spring are plain studs running straight back to the shafts' (omitted) back plane."

## 075 (medium): fixed
- **Verdict:** confirmed. `ROD_RUN_ON = 1` extended rod C a full unit past the drawn end, on the belief that Brown crops it. The plate draws a whole rod with a rounded end just below the wheel.
- **Fix:** `ROD_RUN_ON = 0` in `src/simulation/reciprocating-pawl.js`. The rod ends at its drawn rounded end, which is the kinematic foot (`rodLength` 1.16). The motion is unchanged.
- **Captures:** `sh/75-m.png` (default, phase 0.5, right and below). The rod ends inside the frame, as on the plate.
- **Tests:** `tests/reciprocating-pawl.test.mjs` 8/8 pass, and the models 75 block passes.
- **Proposed ledger row:** assessment reasonable; visibleFlaws "".
  - Limits, append: "Pass 96: rod C ends at its drawn rounded end (the old 1-unit run-on is removed)."

## 079 (low): fixed
- **Verdict:** confirmed.
  - B was a plain rectangular tab, where the plate draws an eye with an open hook facing right.
  - The rod eyes were held off the arm eyes by bare pin: 0.015 on the upper joint and 0.124 on the lower. On B's pin the gaps were 0.017, 0.014 and 0.019.
- **Fix,** in `src/simulation/opposed-arm-geometry.js`:
  - **Hook:** B's outline is the eye plus a ring arc (radii 0.085 and 0.045) concentric with its own centre, opened over the right-hand ±0.95 rad sector, with round tips. It is joined to the eye by a solid neck.
  - **Spacers:** plain spacer collars on each rod pin (arm eye to rod eye) and on B's pin fill every axial gap. These are hidden in the default view.
- **Captures:** `sh/79-m.png` (default, a B zoom from two views, the lower joint from below, left and below).
- **Tests:** `tests/opposed-arm.test.mjs` 10/10 pass. The part count is now 42. A new test checks that the hook reaches right of the eye, that a ray from its throat to the right meets no material (it is open), that it has a real throat, that the arm spacers span exactly from arm to rod, and that the stack on B's pin has no gap.
- **Proposed ledger row:** assessment reasonable; visibleFlaws "".
  - Limits, append: "Pass 96: B is an eye with an open hook facing right, as drawn; spacer collars close the pin gaps at every rod joint."

## Not fixed or deferred
- **Deferred, file owned by p96-fb** (`authored-belts.js`, `authored-gears-core.js`):
  - 004 (medium): rope crossing the capstan coils.
  - 028 (medium): `liftHeight` in `brushWheels()`. The fix is to set it to 0 and slide the roller.
  - 038 (low): the flat link, open since p93.
  - 005, 006, 010, 019 and 022 (lows, belts).
  - 025, 033 and 034 (lows, gears-core).
  - 046's shadow bias.
- **065 (low): not fixed.** The notch is the swept envelope of the stop's toe path, generated in `tappet-stud-stop.js` from the contact solution. The stop's own outline is a baked swept clip of the same motion. Rebuilding the notch as arcs changes the toe's contact and needs the stop outline and contact re-derived, so it is not a quick, clearly right change.
- **081 (low): not fixed; the verdict disagrees.**
  - The rack and sector are a conjugate involute pair driven by `spring-rack-contact.js`. The rulebook asks for involute pinions and compatible racks. Brown's square teeth are his usual gear notation, and square teeth on a rolling mesh would jam or need large backlash.
  - The auditor gives the sector's tooth count as approximate. The plate shows about 6 teeth around the engaged sector, so it is not clearly 5.

## Sub-lane p96-fa1: 048, 052, 053 (clutches)

Files changed:
- `src/simulation/jaw-clutch.js`, `pin-clutch.js`, `reversing-clutch.js` and `reversing-clutch-motion.js`
- `src/simulation/display-timing.js`: one new map entry. The other entries are byte-identical.
- `src/data/display-profiles.js`: only 48, 52 and 53 were re-measured, with `node scripts/measure-display-profiles.mjs 48 52 53`. A diff shows no other profile changed.
- Tests: `tests/jaw-clutch.test.mjs`, `pin-clutch.test.mjs`, `display-tooth-passing.test.mjs` and `models.test.mjs` (the 48 and 52 blocks only).

Captures are in `/dev/shm/p96/fa/fa1/`: `<id>-after-views.png` (the plate, then default, right, left, top, back, back-oblique and below), `<id>-after-phases.png`, `48-mesh.png` and `52-key.png`. The before captures are the audit sheets in `/dev/shm/p96/a/sheets/`.

### 048 (medium): confirmed and fixed
- **Verdict:** confirmed. Measured on the plate, the shaft is 36 px across, the clutch body 128 px and the gear 338 px. So the gear is about 9.4 shaft diameters, or 2.6 clutch diameters. The audit's figure of 11.3 was high. The model's gear was 1.85 clutch diameters.
- **The pinion's position:** the plate draws the pinion's edge-on boss inside the gear's outline, so the pinion meshes on the viewer's side.
- **Fix, gears:** 64:16 at module 0.042. The gear's outside diameter is now 2.77 (9.2 shaft diameters). The teeth are fine, and the pinion's boss is about a fifth of the gear, as drawn.
- **Fix, mesh point:** the line of centres is tilted 60° from the top towards the camera. The pinion's mesh phase is corrected by tilt × (1 + 64/16).
- **Camera:** the fit bounds were updated.
- **Rotation cue:** `userData.teeth` is exposed on the gear and pinion rotors.
- **Tooth-passing cap:** 48 joins the fine-tooth cap in `display-timing.js` at 3.556 authored teeth per second. Display is now 6 teeth per second, and the loop is 7.1 s. At the old 2 s loop, the new fine teeth would have passed at 21 per second, which breaks the fine-pitch rule.
- **Tests:** `jaw-clutch.test.mjs` 8/8 pass, including the actual gear surfaces clearing with a minimum of 0.00059 over one engagement. The involute test's flank filter now also excludes the root circle, which with 64 teeth lies outside the base circle. Its flank error is still under 0.00015.
  - `models.test` "movement 48" passes; it now asserts the tilt and the centre distance.
  - `display-tooth-passing` 3/3 pass (48 added, with the 16-tooth pinion).
- **Screens:**
  - Disconnected parts: unchanged from the audit, one non-persistent lever near-miss of 0.03 at phase 0.70.
  - Coincident faces: 0 pairs.
- **Proposed ledger row:** assessment reasonable; visibleFlaws "".
  - Limits, append: "Pass 96: the loose gear is 64 teeth at plate scale (about 9.4 shaft diameters). The 16-tooth pinion meshes on the viewer's side, 60° down from the top, as the plate's overlapping outline shows. Playback is capped at 6 teeth/s (7.1 s loop)."
  - The catalogue's mechanicalNote still says "18:32 gear ratio". That text is in `src/data/movements.json`, which I did not edit. The parent should update it to 64:16 or leave a note.

### 052 (medium): confirmed and fixed
- **Verdict:** confirmed. The shaft and the end barrel were children of the sliding output rotor. The plate and the caption have only the disk sliding.
- **Fix, what slides:** a new `spindle` block carries the shaft, the end barrel and a new shaft-coloured feather key. It turns with the output and stays axially fixed at the retracted station. Only the disk and its grooved hub slide.
- **Fix, the fit:** the disk's hole and the hub's bore are now a 0.103 keyed bore on +y, with a keyway 0.026 half-width by 0.131 top, over the key's 0.020 by 0.085–0.125. This also removes the old bore that was coincident with the shaft radius.
- **Fix, the key and framing:** the key covers the full slide range and stops short of the driver face. The camera fit's minimum x moved from −1.56 to −0.94, because the shaft no longer sweeps left.
- **Tests:** `pin-clutch.test.mjs` 5/5 pass. It now asserts the parenting and that `spindle.x` is constant over the cycle.
  - The helper's all-pairs surface probe gives 0 penetrations, including output against spindle and driver against spindle.
  - `models.test` "movement 52" passes, with the spindle angle and a fixed x.
- **Screens:**
  - Disconnected parts: one new "lip", where the key emerges from the hub's keyway (size 0.0117, relative 0.0021). This is the intended key running on past the hub, as in 48; it is not a defect.
  - Coincident faces: 0.
- **Proposed ledger row:** assessment reasonable; visibleFlaws "".
  - Limits, replace the mechanical wording "The common shaft and right disk slide together" with: "Only the right disk and its grooved hub slide, on a feather key fixed in the shaft; the shaft and end barrel are axially fixed (pass 96)."
  - The catalogue's mechanicalNote in `movements.json` still says "The common shaft and right disk slide together". The parent should update it.

### 053 (low): confirmed and fixed
- **Verdict:** confirmed. The jaw tips projected only 0.046 past the bevel teeth's small ends (at x 0.61 against 0.656), so they read as buried in the bevel ring. The plate draws a separate jawed hub standing proud of each gear.
- **Fix, the jaws:** `gearFaceDistance` went from 0.70 to 0.56 and `centralFaceDistance` from 0.46 to 0.32. Each gear's jawed hub now projects 0.19 past its bevel teeth. Only the face gap enters the motion, so the kinematics, phases, touch shift and stroke are unchanged, and all 053 contact tests pass unchanged.
- **Fix, the sliding clutch:** its collar taper now starts at −0.20, not −0.24, so its halves are shorter. The feather's half-length went from 0.53 to 0.45, so it stays clear of the loose crowns' unkeyed bores.
- **Tests:** `reversing-clutch.test.mjs` 6/6 pass.
  - Crown contact: minimum gap 3.8e-5.
  - All-pairs probe: 0 penetrations.
  - Key clearance: 1e-5.
  - `models.test` "movement 53" passes.
  - The display profile was re-measured and is unchanged apart from rounding.
- **Screens:**
  - Disconnected parts: 0 detached, 0 lips.
  - Coincident faces: 0.
- **Proposed ledger row:** assessment reasonable; visibleFlaws "".
  - Limits, append: "Pass 96: each loose bevel carries a short jawed hub projecting past its small end, as drawn; the sliding clutch halves are shortened to match (kinematics unchanged)."

### Other checks
These all pass:
- `movement-361`, `one-way-clutch-working-solids` and `bored-spur-profile` (38/38 with the clutch tests)
- The `models.test` blocks for 48, 49, 52 and 53

No saved validation report fingerprints these files.
- The display, timing, camera and framing test files (`tests/*display*|*timing*|*camera*|*framing*`) pass 23/23 after the edits to `display-timing.js` and `display-profiles.js`.

### Catalogue notes
The main lane updated the stale `mechanicalNote` text in `src/data/movements.json` (claimed):
- 48: "18:32 gear ratio" now reads "a fine 16:64 gear pair meshing on the viewer's side".
- 52: "The common shaft and right disk slide together" now reads "Only the right disk and its hub slide, on a feather key along the fixed shaft".
