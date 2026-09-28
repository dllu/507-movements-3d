# Pass 97, lane p97-a: user findings on 117 and 133

Reviewer: Claude Opus 5.5, lane p97-a. Date: 2026-09-28. Captures and scratch files are in `/dev/shm/p97/a/` (outside Git). The user's screenshots are `/dev/shm/p97/img/89.png` (117) and `95.png` (133).

Claims under `/dev/shm/p97/claims`: `authored-gears-core.js` and `geometry.js` (the `src/simulation/mujoco-roller-yoke/` one; p97-b notes that its `mujoco-bell-crank/geometry.js` is a different file).

## 117: yoke, stem and guide centred on the cam's mid-plane (fixed)
- **Finding (user).** From the side, the stem ("piston") stood 0.35 in front of the cam and roller plane. The rails, cheeks, collars, nuts, guide and bolt ends were all on the front face.
- **Plate.** Brown's rails pass in front of the cam. Rails in the cam's plane would cut through it, because the cam reaches past the rails' x.
- **Change** (`src/simulation/mujoco-roller-yoke/geometry.js`). The yoke is now symmetric about z = 0:
  - Brown's front pair of rails (with cheeks, collars, nuts and bolt ends) is mirrored behind the cam. The rear copies are named `…Rear…`.
  - Each crossbar is one H-plan extrusion: full-width flanges at |z| 0.24–0.46 carry the front and rear rails, and the tongue runs through the rollers' depth.
  - The upper and lower stems, the lower collar and boss, and the fixed guide are on z = 0.
  - The whole model's z bounds are ±0.465.
- **Physics.** The yoke's inertia changes, so 117 was rebaked with `node scripts/bake-mujoco-movement.mjs 117`:
  - loop 5 s, 400 samples;
  - seam step 1.345 px, against an interior step of 1.634;
  - round trip 0.0049 px (the limit is 0.106).
- **Screens:**
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. The 12 near-miss pairs are bearing and pin clearances.
  - Coincident faces: 0.
  - `audit-roller-yoke-clearances.mjs`: 21 native poses and 1.06 M checks. Unintended penetration is 0, and cam/roller soft contact is 0.00033 px.
  - The registry body-intersection screen measures the legacy authored 117, not the production model.
- **Tests:** `mujoco-roller-yoke` passes 6/6. The part count is 41. New assertions check that the stems, bars and guide are centred on z = 0, that the whole-model z bounds are symmetric, and that each rear part mirrors its front part. `mujoco-baked-loops` passes 116/116 and `baked-motion` passes 3/3.
- **Captures:**
  - before: `b117.png` (default, both sides, rotated, top), `b117-side.png`;
  - after: `a117.png`, `a117-side.png`, `fin.png` top row (phases 0.25, 0.5 side, 0.75 at yaw −40 / pitch −25, and the back).
- **Residual.** The rear rail pair is inferred: Brown's view cannot show it. It stays hidden behind the front rails in the default view.

## 133: platen hanger is one lug with a boss concentric with the wrist pin (fixed)
- **Finding (user).** The eye at the top was two crossed cuboid beams under the round rod eye. They were not set squarely.
- **Plate.** Brown draws one V-shaped lug from the platen's underside down to the wrist pin.
- **Change** (`handCrankPinionSectorRodPress` in `authored-gears-core.js`):
  - The two `makeBeam` webs are replaced by one extrusion, `platenHanger`. Its outline is a boss (r 0.27) concentric with the wrist pin and two straight lines tangent to the boss, running to the platen's underside at x = ±0.46. It is 0.14 deep in the rod plane and runs 0.04 up inside the platen body.
  - The wrist pin used to leave a bare 0.23 stub behind the lug. It now starts inside the lug. The mesh origin stays on the pin point, and the pin is still 64-sided.
  - Quick fix: the pinion bracket was the same depth as the column it joins, and their front faces z-fought (the coincident-face screen flagged 1 pair). The bracket is now 0.02 shallower. The screen now reports 0.
- **Screens:**
  - Coincident faces: 0.
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. The rod eye is 0.07 axially in front of the lug, as intended.
  - Body intersections (`--worker=133`): 0.
  - Seams: 0.
- **Tests.** `models.test` 133 passes. It asserts one hanger whose vertices below the pin all lie at the boss radius about the pin, which is symmetric and runs into the platen. `sector-press-rod` passes and now checks the hanger in place of the two webs. All six `sector-press-*` suites pass.
- **Captures:** `b133-def.png` and `b133-rot.png` (before); `z133.png` and `fin.png` bottom row (after: default, side and rotated close-ups, and phase 0.5).

## Regenerated reports that fingerprint `authored-gears-core.js`
These were rerun with their scripts, keeping the pose counts:
- `200-226-bevel-solids.json` (33 poses, 0 penetrations);
- `202-264-worm-solids.json` (POSES=33, sampled-flanks-clear);
- `191-196-201-contact.json` (513 poses each, 0 overlap).

Their tests pass. `205-208-209-contact` and the `feed-worm-*` reports fingerprint only functions that did not change, and their tests pass.
