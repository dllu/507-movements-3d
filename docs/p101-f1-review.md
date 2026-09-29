# Pass 101, fix lane f1

Reviewer: Claude Opus 5.5, lane p101-f1, 2026-09-28. This lane fixes the findings from `docs/p101-audit-001-085.md` and `docs/p101-audit-171-255.md` that route through `authored-gears-core.js` and its helpers.

Captures are in `/dev/shm/p101/f1/`, outside Git. They are named `mNNN*.png` (composites) or `NNN-*.png` (single views), and were rendered with `/dev/shm/p90/c/shots.mjs` on port 46041.

Claimed files:
- `authored-gears-core.js`
- `mujoco-internal-rack/geometry.js`
- `mujoco-internal-rack/profile.js` (claimed, but not edited)
- `reversing-mangle-guides.js`
- `feed-worm-assembly-parts.js`
- `reversing-clutch.js`

## 040: herringbone hand (medium). The finding was a misread; the pitch low is fixed.

- **Audit claim:** the hands are mirrored, with the upper wheel showing "V" and the lower "^".
- **Geometry check:** `/dev/shm/p101/f1/chev.mjs` traces one tip crest across the front face in world space. On the committed model, the upper wheel's crest centre sits lower than its ends ("^"), and the lower wheel's sits higher ("V"). That is the plate's diamond.
- **Render check:** 4× face-on renders with shadows off:
  - `m40c.png` is the committed hand, reading "^" above and "V" below.
  - `m40b.png` is the audit's proposed flip, which gives the hourglass.
- **Why the auditor saw it reversed:** at the default size, the coarse 28/40 chevrons are about twice Brown's pitch, and their lit flanks read backwards.
- **Fix:**
  - The hand is unchanged, with a comment explaining it.
  - Only the herringbone variant now uses 42:60 teeth at 2/3 the module. The pitch radii and the 0.7 ratio are unchanged. The chevrons now read clearly as a diamond at the mesh (`40-defz.png`, `40-after.png`).
  - 041 is byte-identical to HEAD (geometry hash).
- **Tests:**
  - `models.test.mjs` "movement 40/41": now expects [42, 60] for 40. The handedness assert is kept, with a message.
  - `parallel-helical-contact.test.mjs`: passes.

## 139: decal-thin internal rack (medium). Fixed.

- **Rim:** `steel-tooth-rim` is now extruded over z ±0.06. That is the depth of the native MuJoCo collision cells, so the 0.114 pinion meshes with solid teeth.
- **Backing and guides:** the backing sheet moved behind the rim (z −0.075…−0.06), with the U-channel guides, boss and rack pins moved with it. The panel masses stay as the documented feasibility assumptions; the dynamics use lumped masses, so they are unaffected.
- **Rebake:** rebaked with `scripts/bake-internal-rack.mjs` from the unchanged native report (sha 33f8…171c). `139-playback-contact.json` was regenerated.
- **Captures:** `m139.png` (default, two oblique views, behind).
- **Test:** a new one in `internal-rack-bake.test.mjs` checks the rim depth, that the rim spans the pinion face, and that the backing sits behind it.
- **Deferred low:** square stub rack teeth and a 10-tooth pinion would need a new conjugate profile and a new native run.

## 192 and 193: teeth reading as a dashed line (192 medium, 193 low). Fixed.

- **The audit's cause was wrong.** No face overhangs the teeth: the toothed land spans z 0.14–0.36 and nothing lies above the groove. The teeth read only through their thin side faces because the land's top and the face beside it were the same blue.
- **Fix, in `reversing-mangle-guides.js`:** a floor 0.62× darker is sunk 0.02 under the face along the whole tooth row. It runs root to tip, plus 0.024 clearance, and stays clear of the shaft-guide channel. The land now reaches down to that floor.
- **Captures:** `m192.png` (default, 3× zoom of the upper-left arc, rotated, and 193's default). The whole teeth now read, with no dashes.
- **194:** it has no generated cavity and is byte-identical to HEAD (hash).
- **Tests:** a new p101 test in `movement-192.test.mjs`. `movement-192/193/194` and `reversing-mangle-finite-guides` pass.

## 195: invisible hub and claw shadow (medium). Fixed.

- **Hub:** it is now a 0.66× darker shade of the wheel metal, with a 45° chamfer on the collar.
- **Shaft stubs:**
  - They are tagged `noShadow` (in `feed-worm-assembly-parts.js`).
  - `castShadow` is cleared after `finish()` in `opposedFeedRollWormDrive`, because `finish()` re-marks every mesh.
  - The claw shadow is gone (`m195.png`).
- **207:** it shares the helper and is byte-identical to HEAD (hash).
- **212:** it has the same flaw but is lane f2's (`authored-intermittent-core.js`). The same two-part recipe applies there: a darker hub, plus `noShadow` with `castShadow = false` applied after `finish()`.
- **Tests:** a new p101 test in `movement-195.test.mjs`. `feed-worm-assembly.test.mjs` now allows cast-shadow-off only on the tagged 195 shaft stubs.

## 196: eye perched on the pedestal (medium). Fixed.

- **Stand:** the stand is now one grey casting. It has:
  - a round eye (r 0.23) concentric with the pivot pin, bored 0.075;
  - straight flanks tangent to the eye;
  - 0.12 concave fillets flaring into the plinth, as Brown's flared standard.
- **Old eye:** the separate ink disc is removed. `blocks.carrierBearing` now points to the casting.
- **Depth:** the casting spans z 0.085–0.325, so the pin ends flush in its bore.
- **Captures:** `m196.png` (default, zoom, rotated, and behind with the strap hidden).
- **Tests:** `movement-196.test.mjs` asserts the new role and eye. `irregular-gear-family.test.mjs` still checks that the pin and strap clear the casting at 17 poses.
- **Deferred lows:**
  - Wheel A's irregular teeth would need a new offline envelope.
  - The strap width was not changed.

## 208: pin shadow hatching (medium). Fixed.

- **Cause:** the pins already had `castShadow = false`, but the render-time `shadow-policy.js` switched casting back on.
- **Fix:** the pins are now tagged `noShadow` as well. The hatching is gone (`m208.png`).
- **Remaining shadow:** the shaft's real shadow still crosses the lowest pin caps (`208-z.png`).
- **Test:** a new p101 test in `movement-208.test.mjs`.

## Quick lows

- **024: rim circle. Fixed.** The rim is now a full-depth toothed annulus round a web recessed 0.06 per face at 0.77 R, as on 030 and 033 (`m24.png`). A new test is in `gears-24-46-source-match.test.mjs`.
- **053: same-yellow bevels. Fixed.** The top driving bevel is steel grey (`PALETTE.muted`) (`m53.png`). A new test is in `reversing-clutch.test.mjs`.
- **038, deferred (not quick):** the sectors are generated conjugate cuts (`steppedSectorCut`). Removing the notch and half-tooth needs a new outline generator.
- **081, deferred:** gear A comes from the MuJoCo-profiled spring rack (`spring-rack-geometry.js` plus a baked profile). Squaring its teeth needs a new simulation.
- **123, 125, 142, 143 and 155, deferred (not in my files):**
  - 123, 125 and 142 run in production from baked or MuJoCo modules (`model-loader.js`; for 125, `mujoco-cascaded-traverse/geometry.js`), not from `authored-gears-core.js`.
  - 143 is routed to the baked sliding worm.
  - 155 is in `authored-intermittent-core.js`, which is lane f2's.

## Screens (IDs 24, 40, 41, 53, 139, 192–196, 208)

- **Coincident faces:** 0 flagged pairs, except 208's one pair (area 0.0011). That is the pre-existing disk/hub pair inside the bore that the audit already noted.
- **Disconnected parts:** no new detached parts.
  - 208's selector-collar running clearance is pre-existing.
  - 192–194 each have 28 short-of-pin hits, which are equal to 194's unchanged count.
  - 139 has one new lip hit: the left guide mount now reaches 0.065 further back to the moved channel, and the screen reports a 0.025 step on it. It is not visible in rotated captures (`m139lip.png`).

## Validation reports regenerated (pose counts kept)

- `191-196-201-contact`: 513 poses, 0 penetrating.
- `200-226-bevel-solids`: POSES=33, 0 penetrations.
- `202-264-worm-solids`: POSES=33, 0 penetrations.
- `205-208-209-contact`: 513 planar poses, and 167 pin-slot poses with 0 inside.
- `feed-worm-195-solids`: 17 poses, 0 penetrations.
- `feed-worm-195-working-faces` and `feed-worm-207-working-faces`.
- `139-playback-contact`, plus the 139 bake and provenance.

`171-unit.json` fingerprints `tests/models.test.mjs`. It was already stale at HEAD and nothing checks it, so it was left alone.
