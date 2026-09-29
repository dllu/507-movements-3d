# Pass 104, lane g3: 174, 179, 181/182, 185, 190, 247 (+ lows 186, 251)

Audit: `docs/p104-audit-171-255.md`. Captures: `/dev/shm/p104/g3/` (`*-sheet.png`
are the review sheets; the audit's before captures are in `/dev/shm/p104/c/<id>/`).

Claimed: `authored-clamps.js`, `authored-engine-reversers.js`,
`authored-diagonal-catches.js` (not edited), `authored-locomotive-valve-gears.js`,
`authored-sounding-weights.js`, `authored-cramp-drills.js`, `v-thread-geometry.js`
(new), `mujoco-bench-clamp/` (solids.js), `mujoco-diagonal-catch/` (assembly.js),
`authored-gab-disengagers.js` (not edited), `gab-disengager-186.js`,
`authored-pile-drivers.js`, `authored-curve-generators.js` and
`authored-quadrant-catches.js` (both not edited).

## 174 (medium): jaw colours; plank seams (low)
- Production 174 is the baked MuJoCo bundle built by `mujoco-bench-clamp/solids.js`,
  not `authored-clamps.js`. Both were changed the same way.
- The rear (lower) jaw is ochre (`PALETTE.accent`); the front jaw stays blue. The
  crossed tails now read as two parts, with the ochre one behind, as Brown dots it.
- The planks abut (the 0.012 slits showed the background from behind). Each seam
  is a 0.012 V-groove chamfered into the two top edges that meet there.
- Not changed (low): the board's square right end past the backboard. Brown breaks
  the board there; lengthening it would widen the camera fit for a part the plate
  crops.
- Chain: `qualify-bench-clamp-cycle` (native report unchanged) → `bake-bench-clamp`
  (1156 samples as before; only the solids hash, bytes and sha changed) →
  `review-bench-clamp-assembly`, `-source-fit` and `-contact` (only the bundle hash
  changed). `174-browser.json` was already stale (its spec hash is not current), so
  it was left as it was.
- Captures: `174-sheet.png` (default, phase 0.4, seam zoom, yaw 45, back, oblique seam).

## 190 (medium): fine V-thread; bench bore and shoe colour (lows)
- The plate hatches a slim screw about 0.3 across, with hatch lines 0.08 apart that
  rise to the right. That makes it a right-hand thread. The old ribbon was also
  left-handed (y rose with the angle) although it was labelled right-hand.
- The screw is the shared fine V-thread: `threadedTubeGeometry`, moved
  byte-identically from `authored-cramp-drills.js` into the new
  `v-thread-geometry.js`, with an optional `starts`. 379 and 380 hash identical
  before and after.
  - The rod is one solid of the screw colour, root 0.15 / crest 0.18. The depth is
    0.03 (0.28 of the old 0.109), on a full-diameter core.
  - It is two-start: the visible pitch is 0.085 and the lead stays 0.17. The release
    therefore stays a 0.417-turn part turn, and the handle never crosses the crest.
- The kinematics are right-hand: screwAngle = (displacement − travel)/lead·2π, so
  tightening is a positive turn and the handle now swings through the front
  instead of the back. The thread-phase and ideal-advance residuals are still 0
  (below 4e-14).
- The nut's internal V is a sleeve in the arm's bore, phased to the screw's world
  helix with 0.004 radial clearance, and dark like the nut. The arm bore is now
  crest + 0.016 and the hidden hex bore crest + 0.020.
- The screw ends in the thread's flat end face inside the arm, 0.06 above the bench.
  The undrawn bench bore is removed.
- The shoe is steel grey (`PALETTE.muted`), no longer ochre on the brass work.
- `authored-clamps.js` is fingerprinted by 180's chain, so the chain was rerun:
  `qualify-single-clamp-cycle` → `probe-single-clamp` → `bake-single-clamp` (746
  samples as before; the hash, the bytes (+1) and the sha changed). Then
  `review-single-clamp-existing` and `review-bench-clamp-existing` were rerun; only
  the source hash changed. 180's geometry hashes identical. `180-browser.json` was
  already stale and was left as it was.
- Tests: movement-190 was updated for the right-hand law and asserts two starts,
  pitch < 0.09, depth ≤ 0.035 and root/crest > 0.8. `clamp-tailstock-solids` has a
  new 190 test: real screw vertices clear the internal V, nut, arm and bench over 25
  frames; the screw stops above an undrilled bench; the bench is solid under the
  screw.
- Captures: `190-sheet.png` (default, thread zooms, underside, yaw), `190-sheet2.png`
  (thread close-up, bench underside, shoe on work).

## 179 (medium): lever foot eye; foundation (low)
- The bar ends in a round eye of r 0.22, concentric with the base pin (r 0.12, 1.8×).
  It is one extrusion with the bar, joined by tangent fillets of r 0.12.
- The eye hangs below the foundation top, so the bar is 0.30 deep (was 0.32) and the
  foundation's front stops at z −0.39. That leaves the lug's foot (front −0.40) on
  it, and the lever passes 0.02 in front.
- The foundation is stone grey (#8a8276 / sides #776f64), as on 185's wall.
- `179-current-solids.json` was regenerated: 129 poses, no intersections. The other
  179 reports already carried stale hashes.
- New test in `engine-reverser-solids`: eye radius 0.22, round and concentric, and
  it clears the foundation in depth at every sampled time.
- Captures: `179-sheet.png`.

## 181, 182 (medium): upper handle ochre
- `mujoco-diagonal-catch/assembly.js`: the upper handle (boss, horn and weight arm,
  tappet arm) is ochre and the lower stays blue. The catch keeps its see-through
  style.
- Rebaked with `bake-diagonal-catch` (9001 / 775 keys, as before). Only the
  assembly hash, bytes and sha and the compact-keys module's asset sha changed.
  `review-diagonal-catch-assembly` was rerun (129 poses, no intersections; bundle
  hash only).
- New test in `diagonal-catch-baked`: one ochre colour on the upper handle and one
  blue on the lower, for both 181 and 182.
- Captures: `181-sheet.png` (181 at phases 0, 0.25 and 0.67, which are the old
  crossing frames, plus yaw; 182 at phases 0 and 0.25).
- Not changed (low): the scroll curls on the handle tips. They would change the
  outlines that the contact projection and the bake qualify.

## 185 (medium): sector foot; pins (low)
- The quadrant plate gets a foot web in the same outline. It runs from the lower
  third of the band onto the wall's front face: 0.22 inside its left edge, top
  0.11 below the wall top. The plate's back face lies 0.02 inside the wall face
  (z −0.52), so the sector stands on the wall's top-left corner as one casting.
- The lifting-lug pin is trimmed from z −0.10…1.20 to −0.13…0.77, and the die pin
  from −0.31…1.19 to −0.13…1.07. Each is 0.03 proud of its stack.
- Not changed (low): the frame fill. It is limited by width: the handle knob to the
  eccentrics spans 10.5 in a square test viewport.
- Tests: movement-185 has the pin overhang check (it replaces "height > 1.49") and a
  new one-casting / bedded-foot test.
- Captures: `185-sheet.png`.

## 247 (medium): T probe
- Measured on the 525 px plate: the stem is at x 266 against the rod's axis at
  273.5, so 0.10 left. The foot spans 236–287 (centre −0.17, about ±0.36).
- The audit's "stem on the rod axis" is close to this but not what Brown draws. The
  stem also cannot sit on the axis: the bell-crank pivot pin (r 0.15 at x 0.08)
  occupies it.
- The stem now runs at x −0.14 (was −0.35), as near the axis as the pin allows (0.015
  clear in plan). The foot is a symmetric T, ±0.25 about the stem.
- The post-processed pusher pad already spans x −0.45…0.14, so it caps the stem and
  still carries the roller. The roller contact is unchanged, so the trip needs no
  re-timing. The guide block's bore follows the stem, since
  `finishSounding247Parts` bores it at the stem.
- A sampled check of stem, pad and foot against every other solid over 61 frames
  found no penetration. `screen-body-intersections` errors on 247 at HEAD as well.
- New test: the foot is symmetric about the stem, the stem is within 0.4 R of the
  axis, and the pad caps the stem.
- Captures: `247-sheet.png`.

## Lows in other files
- **186:** the fork head and its cross-pin ends are one outline and one extrusion.
  There is no second plate, so no seam or step. The drop's two long edges are
  centripetal splines through the traced points.
  - The landmark test now measures the drop edge below the head.
  - `186-187-cam-solids.json` was regenerated: all four IDs have no intersections;
    one mesh fewer on 186.
  - 187–189 hash identical.
  - Captures: `186-sheet.png`.
- **251:** the pile, the black anvil and the post feet are replaced by one plain
  ground block in the shared ground style, whose top is W's landing plane. The
  posts stand 8 px into it. They are excluded from the camera fit, as before.
  - Captures: `251-186-sheet.png`.
- **Not changed:**
  - 172: I disagree with the audit. Brown draws the wrist end flat-topped and broken
    off to the right (crop `p172eye.png`), which is what the model shows.
  - 180 (board length, jaw tail) and 183 (C-arm root): bake-bound geometry, not quick.
  - 188 (rear web): not attempted.

## Screens (IDs 174, 179, 181, 182, 185, 186, 190, 247, 251)
- Disconnected parts: identical to HEAD. 179's two floating parts and 181's three
  detached moving bodies predate this pass. No slivers or lips.
- Coincident faces: 0 flagged pairs. Loop seams: 0.
- Body intersections: identical to HEAD (247 errors there too).
- `display-profiles.json` was regenerated for these IDs:
  - 190: z bounds, because the handle now swings in front.
  - 251: x bounds, from the wider ground block.
  - 174: float noise.

## Tests
movement-174/179/181/182/185/186/190/247/251/379/380, clamp-tailstock-solids,
clamp-working-solids, clamp-190-thrust-support, single-clamp-baked,
diagonal-catch-baked/assembly, engine-reverser-solids,
release-mechanism-working-parts, gab-joint-solids, authored-loader,
mujoco-baked-loops, camera-catalog and the models.test blocks for these IDs: all pass.
