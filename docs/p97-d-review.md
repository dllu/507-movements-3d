# Pass 97 lane d: 135, 137 (and 138 provenance)

These findings come from the user's own review. Captures are in /dev/shm/p97/p97-d/.
The lane owns `src/simulation/authored-cams.js`.

## 135: yoke and Reuleaux tappet thickened to match the nuts
- **User:** in side view the yoke bars and the triangle were thinner than the hex nuts, so the nuts overhung them (/dev/shm/p97/img/97.png).
- **Before:**
  - yoke z −0.032..0.432, centred at 0.2, off the rod axis at z 0.4
  - tappet z −0.2..0.16
  - nuts z −0.149..0.949
- **After:**
  - The yoke is centred on the rod axis. Its depth is the nut's width across flats plus 0.02, so it spans z −0.171..0.971 and its faces sit 0.011 proud of the nut flats. No faces coincide.
  - The liners are 0.03 deeper than the yoke, as before.
  - The tappet runs from z −0.2, just in front of the carrier disk, to 0.899, 0.06 behind the yoke's front face.
  - The fastener boss and square index move forward with the tappet face and stay concentric.
  - Rod, nut and yoke share one axis.
- **Working clearance:** the maximum cam-to-liner mesh gap is still 0.001007.
- **Captures:** a135-sheet.png (default, both sides, ±40/±25 rotated, close-up) and a135-zoom.png (nut seat). Before: b135-*.png.
- **Screens:**
  - disconnected parts: 0 detached, 0 slivers, 0 lips
  - coincident faces: 0
  - body intersections: worst 0
  - loop seams: 0
- **Tests:**
  - reuleaux-*.test.mjs (5), including a new depth/axis test
  - models.test 135

## 137: both rollers turn from the first frame
- **User:** the lower roller doesn't rotate at first because contact is imperfect.
- **Finding:**
  - The old bake played the whole recording from t=0. For the first 5 s the lower roller did not turn.
  - At spread 4 px the fork pinched the cam by 0.03 px once a turn. This stalled the cam by up to 0.084 rad, reversing it briefly, and flung the lower roller to 4.5–8 rad/s, 2–4× its rolling speed. That kick is what made it turn later.
  - Once the pinch is removed, the lower roller has 0.06–1.3 px of play below the cam while gravity keeps the upper roller on it. It hardly touches the cam and stays still (probe: 0.05 rad/s).
  - Adding inertia alone therefore could not keep it rolling.
- **Fix:**
  1. Roller inertia: mass 0.3, axial inertia 0.015 (a solid disk), up from 0.1 / 0.005. This is in `mujoco-expansion-eccentric/physics.js`.
  2. Spread is now 4.05 px (`expansion-eccentric-profile.js`). This removes the pinch: the maximum cam lag is now 0.0002 rad and penetration is 0.00086 px.
  3. `scripts/bake-expansion-eccentric.mjs` bakes one steady-state cycle only. It starts at 16.25 s, where the cam is at the engraved pose (0.0001 rad off). loopStart is 0 and loopEnd is 8.
  4. The lower roller's angle is integrated kinematically from no-slip rolling on the nearest cam point.
     - The same integration reproduces the upper roller's simulated spin: −16.111 vs −16.117 rad a cycle, slip ≤ 0.3 px/s.
     - This is recorded in the bundle's `source.kinematic`.
- **Seam:**
  - position 0.0067 px
  - velocity 0.17 px/s, now including the upper roller
- **Provenance:**
  - Regenerated 137.json.gz and 137.provenance.json. package-lock hash unchanged.
  - Regenerated docs/validation/137-physics-prototype.json from four probes. Mesh/time sensitivity is now 0.028 px (was 0.15).
  - Updated docs/movement-137.md.
- **Captures:** a137-sheet.png (plate, t=0, t=2 s, rotated, lower roller at t=0 and t=0.25 s with the quadrant cue turned).
- **Screens:**
  - disconnected parts: 0 detached. One pre-existing short-of-pin was flagged between the fork eye and the hanging stem (0.027); that geometry was not changed.
  - coincident faces: 0
  - loop seams: 0
- **Tests:**
  - expansion-eccentric-profile: spread 4.05 and a positive minimum play (>0.05 px)
  - expansion-eccentric-bake: loopStart 0, engraved start pose, kinematic provenance, both rollers turning in every 0.1 s window
  - models.test 137

## 138: provenance
- 138 was regenerated with `scripts/bake-variable-cam.mjs` from a fresh probe (`probe-variable-cam.mjs`, fine options). Its motion is byte-identical. Its geometry and materials are identical apart from Three.js UUIDs.
- variable-cam-bake.test.mjs passes.
