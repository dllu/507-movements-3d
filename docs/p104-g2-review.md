# Pass 104 fix lane g2 review

Reviewer: Claude Opus 5.5, fix lane p104-g2. Date: 2026-09-29. This lane fixes the medium findings for 048, 050/051, 054, 081 and 150 from `docs/p104-audit-001-085.md` and `docs/p104-audit-086-170.md`, plus the quick lows in the files it claimed. No git writes were made.

- Captures are in `/dev/shm/p104/g2/cap/`.
- The helper is `/dev/shm/p104/g2/shotsD.mjs`, a copy of the r001 px-targeted helper, run on port 46092.
- Before captures are the audit's own, under `/dev/shm/p104/r001/`.

## Claimed files

- `jaw-clutch.js`
- `universal-joint.js`
- `star-mangle.js`, `star-mangle-guide.js`
- `spring-rack.js`, `spring-rack-geometry.js`
- `authored-selectable-cams.js`, `selectable-cam-valve.js` (the actual 150 lever)
- `hoist-hardware.js`, `authored-cascades.js`
- `authored-belts.js`
- `three-speed-selector.js`
- `alternating-peg-pawl.js`
- `reciprocating-pawl.js`, `reversing-clutch.js`: claimed but left unchanged (see Deferred)

## 048 (medium): bell-crank arm end

- **Verified:** yes. The arm tapered 0.046 → 0.032, then jumped to a 0.068 half-disc drawn on the right side only. That left a vertical flat and a notch, and the eye was not concentric.
- **Fix:** the horizontal arm is now one constant-width bar (half-width 0.044). It ends in a full half-round of radius 0.044 concentric with the rod pin, the same radius as the rod's rounded top. Its lower edge now runs straight into the elbow eye, removing the old jog at −π/4.
- **Captures:**
  - `m48.png`: arm end, elbow and collar zooms.
  - `m48b.png`: default view, behind, and elbow.
- **Test:** new test in `tests/jaw-clutch.test.mjs`, "arm ends in one full half-round concentric with the rod pin": every end vertex lies on the one pin-centred arc. The jaw-clutch suite passes 9/9.

## 050 / 051 (medium): universal-joint forks, frame and cross

- **Scope:** the shared builder is used only by 050 and 051.
- **Fix, forks and frame:** each fork and 050's figure-8 frame is now ONE mesh.
  - The curved band is cut 0.15 from each pin.
  - A D-shaped eye takes over there. Its outer end is a semicircle of radius 0.15 concentric with the pin, and it carries the pin bore (0.046).
  - The eye's radial faces follow the band's elliptical faces exactly, so the section matches at the junction.
  - The coincident junction faces are removed, the vertices are welded, and the normals are creased at 30°.
  - There is no boss cylinder, no step and no box corner.
  - The eyes are now frame markers (`parts.eyes`, Object3D) that keep the bearing frames.
- **Fix, cross:** the cross arms are straight, of constant width, and each ends in a round trunnion (r 0.085, 0.50 → 0.648, with a small outer chamfer) coaxial with its pin. The old flared square tips are gone.
- **Captures:** `5051.png` shows the 050 default, left, oblique, and the eye/trunnion zooms (z1, z2), plus the 051 default, right and zoom.
- **Tests:** `tests/universal-joint.test.mjs` passes 5/5.
  - Closed, outward solids.
  - The bore is open: rays from the pin centre now hit the one-piece body at a gap of 0.000976–0.000999.
  - Retaining-cap gap 0.00400–0.0047. The eye's outer face follows the band's ellipse, so it dips by at most 0.0006 under the cap rim; the test tolerance was widened accordingly.
  - New asserts: one strap mesh per member, and four trunnions coaxial with the pins.
  - The contact probe finds 0 penetrations: 24.9M checks on 050 and 8.6M on 051.

## 054 (medium): block A and linings

- **Verified:** yes. The four crab-end lining shells (clearance 0.0001, wall 0.03) sat inside A's capsule-union cut (clearance 0.003), so stepped lips and half-disc ends stood inside the channel.
- **Fix, block section:** A is ONE radial extrusion (plus its two radial bars and feet). Its section is the rectangle minus the analytic channel at both crossovers:
  - The collar path is sampled every 0.01 of travel (was 0.05).
  - The exact ±(R + clearance) offset curves have round end caps.
  - Clearance is 0.0005.
  - Normals are creased (30°), so each seat is one smooth arc.
- **Fix, linings removed:** the lining meshes are gone. Their analytic guide paths remain as `parts.crabGuides` (centerAt, terminal, guideSide) for probes. The collar channel is kept, and A itself retains the collar.
- **Captures:** `m54.png` (the audit's six zooms re-shot) and `m54b.png` (default, left, right at ph 0.5).
- **Tests:** `tests/star-mangle.test.mjs` passes 6/6.
  - Closed solids: 17 geometries (was 21).
  - Tooth contact is unchanged.
  - New channel-gap test: rays perpendicular to the prism give 0.00051–0.00052 on both faces at 20 crossover poses.
  - New test: A is one brass mesh with no lining pieces.
  - `models.test` now checks `crabGuides.length === 4`.
- **Faceting:** the 054 faceting score stays 200.7. The flagged meshes are the 31 radial teeth (16,896 triangles each, smoothed creases up to 58.9°), not block A or the linings. The audit misattributed that score, and the teeth are not changed here.
- **Stale script:** `scripts/probe-star-mangle-forces.mjs` and `probe-star-mangle-hardware-candidate.mjs` still reference `crabEnds`. They were already stale: the forces probe imports a missing `artifacts/review/054-candidate-model.mjs`. They were left untouched.

## 081 (medium): rack-rod, stop pin and mandrel

- **Verified:** yes. The rod was four walls plus a rear wall with an open slot, and a pin and cap stuck out behind it.
- **Fix:** the rack-rod is ONE closed solid (`rackRod`), a plain 617–653 px bar.
  - Its upper length is bored by the channel that hides the fixed mandrel.
  - The bore's floor sits at the mandrel's lowest point − 2.2, below its reach at the top of the stroke (`boreFloor + range[1] < mandrel min`).
  - The mesh is built from the bored and solid extrusions, with the junction caps dropped and the bore floor added, so it is closed and wound correctly.
- **Removed:** `fixedTravelStopPin`, `travelStopRearCap` and the slot.
- **Motion:** unchanged. The rest position is the motion's lower limit (`range[0]`), and `idealConstraints` and the qualification were updated to say so.
- **Candidate copy:** `scripts/lib/spring-rack-candidate.mjs` got the same edit, which test 4 requires.
- **Captures:** `m81.png` (default, behind, behind at 4×, below). The back now shows a plain bar.
- **Tests:** `tests/spring-rack.test.mjs` passes 6/6, including:
  - the rod is solid at the old slot point, bored above the floor and solid below it;
  - none of the pin, cap, slot or wall parts remain;
  - the clearance sweep passes.
- **Stale scripts:** `check-spring-rack-reactions.mjs` and `bound-spring-rack-hardware.mjs` reference the removed pin and slot. They are historical studies with no saved report, and were left untouched.

## 150 (medium): rocking lever thickness

- **Where the lever lives:** it is built in `selectable-cam-valve.js` as `pinned-lever`, not in `authored-selectable-cams.js`, whose own beam is replaced.
- **Verified:** yes, the lever was 0.03 thick.
- **Why 0.10 is not possible:**
  - The cams slide past the lever's roller end during selection, so the lever must pass the 0.06 gap between neighbouring cams.
  - Thickening toward the gap side by 0.07 penetrates throw 2, 3 and 4 by up to 0.05.
  - Thickening toward the roller side runs into the full-width roller, which stands 0.008 away.
- **Fix:** the lever is now 0.054 thick (±0.027, 1.8× before). The roller-axle washer, which would now stand in the gap, is removed; the axle ends 0.006 inside the lever bore.
- **Captures:** `m150.png` (default, top, below, yaw at 50°).
- **Tests:**
  - A new test in `tests/selectable-cam-valve.test.mjs` checks 0.054 thickness and 0 penetration against every cam plate, the heel sleeve, the hub and the roller over 65 demonstration poses.
  - Physics tests pass 4/4. The mass normalisation is derived from the lever volume at run time.
- **Residual:** the lever is still visibly slimmer than the roller. Reaching ~0.10 would need wider cam spacing, which changes the stack and the source match.

## Lows

- **013–018 hook tips:**
  - The shared `makeHoistHook` now carries 019's `hook-tip-cap` ball on its end frame.
  - `capHoistHook` in `authored-cascades.js` skips hooks already capped.
  - Geometry hashes (a scratch probe, since removed; output in /dev/shm/p104/g2/hash-belts-*.txt) for 7, 19–23, 124, 126, 129, 134, 141, 227–229 and 242–244 are byte-identical before and after. Only 12–18 changed (12's hanger hook is capped too).
  - The disconnected screen shows open ends 0 on 13–18 (the audit had 15: 2, 17: 1, 18: 1). The only new near-miss pairs are the caps beside their own eye rings, the hook-in-eye class.
  - Capture: `mtips.png`.
- **007:** bevel C (upright output) is recoloured brass → steel grey (`PALETTE.muted`). Capture: `mlow.png` panel 1.
- **058:** the third lower pulley and its gear are recoloured from copper 0xb36c44 to steel grey, away from the brown belt. Capture: `mlow.png` panel 2.
- **077:** fulcrum A is trimmed to z 0.19–0.34, just behind the lever (0.21), with a matching rear cap (`fixedPivotRearCap`). There is no longer a bare rod behind the lever. The 077 suite passes 9/9 (part count 63). Captures: `mlow.png` panels 3–4.

## Screens (7, 12–18, 48, 50, 51, 54, 58, 77, 81, 150)

- **Disconnected parts:**
  - Open ends 0 and slivers unchanged everywhere.
  - 048's single near-miss "detached" group (lever vs. rotating bodies) and 081's gear/rack group are the same as the audit's.
  - The short-of-pin entries on 15, 17 and 18 are identical to the audit's.
- **Coincident faces:** only the pre-existing 007 collar pair (0.0012) and 018 rope tail (1e-6) remain.
- **Faceting:** 048, 081 and 150 score 0. 050 and 051 score 7.8 (the turned shafts and trunnions). 054 is covered above.

## Tests run

- universal-joint 5/5
- jaw-clutch 9/9
- star-mangle 6/6
- spring-rack 6/6
- selectable-cam-valve 3/3
- selectable-cam-physics 4/4
- alternating-peg 9/9
- belts-1-23-clearance, three-speed-selector, band-drive and chain-drive working parts 38/38
- models.test (see the final report)

## Deferred

- **012–021 stirrup straps (U-sweep):** this reworks every hanger in the family (six builders). It is larger than a quick low.
- **012 bag:** not attempted.
- **014 cheek nubs:** this needs a plate check. Widening the skin changes the drawn open mortises.
- **053 bar and jaws:** the arc shoe must follow the lever's y travel, and the jaws need a shared zigzag profile. This is a geometry and contact redo.
- **075 click seating:** the motion is a finite-contact bake. Lengthening the click needs re-integration.
- **082 bare pins:** this is the MuJoCo treadle, and the collision geometry and bake are out of scope for a low.
- **054 radial-tooth smoothed creases:** see above; `star-mangle-geometry.js` is not claimed.
