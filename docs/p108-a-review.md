# Pass 108, lane a: 081, 150, 309 and 483

Reviewer: Claude Opus 5.5, lane p108-a, 2026-09-29. Working tree at `0d259c4` plus the uncommitted pass-107 changes, served by vite on :46141. No git writes were made.

Captures are in `/dev/shm/p108/a/` (081) and `/dev/shm/p108/a/{150,309,483}/`. The plates are `public/engravings/mm_<ID>.png`.

Claimed files:
- `spring-rack*.js`, `spring-rack-profile.js`
- `selectable-cam-valve.js`, `authored-selectable-cams.js`
- `authored-gravity-escapements.js`, `gravity-escapement-plates.js`
- `authored-dry-gas-meters.js`
- `display-profiles.js` (81 and 150 re-measured)

## 081: rest lowered one rack pitch; the segment now drives the top rack tooth (fixed)

- **Finding verified.** A contact probe over the settled cycle (gear-tooth index from the contact point's angle) showed segment tooth g0 driving rack tooth r1 through g5 driving r6. The top rack tooth r0 was never touched, and g5 ran below the rack's last tooth.
- **Change.**
  - `scripts/lower-spring-rack-rest.mjs` (new, idempotent) translates the integrated finite-contact solution in `src/data/spring-rack-profile.js` down by exactly one rack pitch (0.3762). It shifts the knots, range, stop and upper, and records `restDrop`. The rest moves from −0.830 to −1.206.
    - A whole-pitch translation maps the reviewed solution onto itself: tooth k+1's contacts become tooth k's, and the spring force depends only on the lift above rest.
    - The playback's exact-clearance projection still corrects less than 0.002 px, so the new bottom tooth never obstructs the recorded path.
    - The contact-study artifacts under `artifacts/review/` are untracked and absent, so the committed profile is transformed in place. The envelope is recomputed the same way as in `integrate-spring-rack.mjs`.
  - `src/simulation/spring-rack-geometry.js` and its twin `scripts/lib/spring-rack-candidate.mjs` take new `restDropPixels` and `lowerGuideDropPixels` parameters:
    - The rod top (it stays px(10) through the upper plate at rest) and the rod tail (it stays through the lower guide at the top of the stroke) follow the new stroke.
    - The lower guide sits 35 source px (0.25) lower than Brown's. Otherwise the lowest tooth would enter it at the new rest by 0.18. It now clears the guide by 0.071.
    - The user said exact geometry need not match here.
  - The spring is less crushed at the top of the stroke: 1.14 long against 0.71 before (solid height 0.58).
- **Now:** g0→r0, g1→r1 … g5→r5, and r6 bounds g5's gap, so all seven rack teeth flank driven gaps. The entry bounce is the same as before, shifted by one tooth.
- **Rod stub (not shortened; the brief's expectation does not hold).**
  - At the default pose the stub is still 1.654 above the upper plate. The stub equals the lift above rest at Brown's gear angle, plus the px(10) the rod must keep through the plate at rest.
  - Lowering the rest by one pitch also puts the rack one pitch lower at that gear angle, so the lift is still 1.58.
  - Only moving the default frame off Brown's gear angle, or letting the rod leave the plate at rest, would shorten it.
- **Captures** (`/dev/shm/p108/a/`):
  - `m81b.png`: before, beside the plate.
  - `m81a.png`: after, beside the plate at 10 phases.
  - `m81z.png`: mesh close-ups at 10 phases through the lift.
  - `m81r.png`: yaw ±40, pitch 25, side, and the lowest tooth above the lower guide at rest.
- **Tests.**
  - `tests/spring-rack.test.mjs`: 8 pass. A new p108 test checks that segment tooth g drives rack tooth g for all 6, and that the lowest tooth clears the guide by more than 0.05 at rest.
  - `models.test.mjs` filtered to 81/spring: 7 pass.
- **Screens.**
  - Coincident faces: 0.
  - Body intersections: 0.0000.
  - Loop seams: clean.
  - Disconnected parts: unchanged from before. The unsupported gear group is a near-miss to the rack, and there are 9 bore-clearance near-misses.
- **Display profile:** 81 was re-measured (the rod tail at rest is lower: floorY −6.09).

## 150: lever 0.10 thick beside a narrower roller (fixed)

- **Finding (user).** The lever was 0.054 thick, slimmer than its roller, because it ran in the 0.06 gap between neighbouring cams. The user offered: thicker lever with a thinner roller, or thicker cams.
- **Insight.** The lever's roller-end boss (r 0.19) lies inside the roller's circle (r 0.27), which the working cam never enters. So the lever may overlap the working cam's own slab; only the *neighbouring* cam (a different lift at the same angle) limits it. Narrowing the roller frees that slab depth for the lever. The cams keep their 0.28 depth and 0.34 pitch (no change to the carrier, slide or shaft).
- **Change** (`src/simulation/selectable-cam-valve.js` only; `authored-selectable-cams.js` untouched, and 150 is its only user):
  - Lever 0.054 → **0.10** thick (`leverHalf` 0.05). Its plane is set 0.005 short of the neighbouring cam's face: z 0.245–0.345, i.e. the 0.06 gap plus the working cam's outer 0.045.
  - Roller tread 0.27 → **0.17** wide, still centred on its cam (z 0.065–0.235); its face stands 0.01 off the lever. `g.rollerWidth` is updated, so the MuJoCo validation model uses the same roller.
  - Roller axle starts 0.015 beyond the roller's far face, as before. The fulcrum shaft, pivot retainer and fulcrum standoff are re-seated to the thicker lever (retainer 0.013 off the lever face).
- **Clearance (probe, 257 poses over the full demonstration including every selection shift):** lever vs throw-2/3/4 plates min **0.005** (was 0.003); vs throw-1, sleeve, end collar ≥ 0.080; vs keyed hub 0.096. No touch anywhere.
- **Captures** (`/dev/shm/p108/a/150/`): `m150.png` (plate | before | after, default), `a-y40.png`, `a-ym40.png`, `a-side.png`, `a-top.png` (lever now reads as a solid bar beside the stack), `a-y40pm.png`, `m150close.png` (roller end at phases 0, 0.24, 0.5, 0.74). Before: `b-*.png`.
- **Tests.** `tests/selectable-cam-valve.test.mjs` 3 pass (thickness test now asserts 0.10 lever, 0.17 roller, 0.01 roller–lever gap, and no lever penetration of any cam/sleeve/hub/roller at 65 poses). `tests/selectable-cam-physics.test.mjs` 4 pass. `models.test.mjs` 150 block pass.
- **Screens.** Coincident faces 0; disconnected: 0 detached, 0 slivers/lips (14 near-misses = running clearances); loop seams clean. Body-intersection screen reports 0.0986 throw-3 plate × `rotating-follower-axle-end-cap` — that screen builds the raw authored factory (registry), whose cap the production valve wrapper removes; unchanged by this pass.
- **Reports regenerated** (pose counts kept): `docs/validation/150-pinned-valve-assembly.json` (65 poses, 0 failing pairs), `150-passive-assembly.json` (65 poses, 0 failing pairs), `150-passive-libccd.json`, `150-passive-multicontact.json`, `150-passive-libccd-fine.json`, `150-passive-native-fine.json` (1201 samples each; penetration and tracking errors equal or smaller than before), `150-projection-landmarks.json`.

## 309: one clean pawl on the left (fixed)

- **Finding (user).** "Weird double pawl on the left." On pallet B the end had two prongs side by side:
  - the toe nib, hanging below Brown's level bottom edge beside the rounded corner, which did no work (p101);
  - the stop hook b at the inner end of the lifting face.

  Between them was the flat lifting face, so the end read as two pawl teeth. The right pallet A was already one hook.
- **Plate.** Brown's B end is a rounded outer corner and a bottom edge into the working notch. His nib at (145, 214) and his bottom line at y ≈ 206 lie inside the envelope the teeth sweep under the lifting face (p99: clearing them needs a 4.9° pallet lift, and the pendulum gives 3.6°). A faithful nib can't be kept. The old workaround was the stand-in nib at x ≈ 126, which is what made the end look doubled.
- **Change** (`src/simulation/authored-gravity-escapements.js`, left branch of `makeGravityPallet`).
  - The toe nib, its rise and Brown's lower bottom edge are removed.
  - The bottom edge is now the lifting face itself. It continues straight from the face start (flush with its trimmed line, 0.006 inside) to where it meets the arm's outer edge.
  - That acute corner (about 66°) is rounded with a 0.22 quadratic round.
  - The end is now one flat-bottomed pawl. Its only hook is the stop b at the inner end, as on A. The stop arc, end wall and lifting-face geometry are unchanged.
- **Bake.** `node scripts/generate-gravity-escapement-plates.mjs 309` regenerated only the 309 entry of `src/simulation/baked/gravity-escapement-plates.js`: left pallet 94 vertices, area 0.76978 of 0.77194, discarded 0, and the corner-to-face stretch is uncut.
  - 310–312 are byte-identical. Their bake entries and rendered geometry and transforms at 3 phases hash the same before and after (`/dev/shm/p108/a/309/hash-{before,after}.txt`).
- **Captures** (`/dev/shm/p108/a/309/`):
  - `n309.png`: plate beside default.
  - `mz.png` (before) and `amz.png` (after): close-ups of B at phases 0, 0.3, 0.45, 0.7, 0.85 and 0.95.
  - `arot.png`: yaw ±40, pitch ±25, side, and an oblique close-up.
- **Checks.**
  - `check-gravity-escapement-engagement.mjs 309` at 10 phases: lock and lift engage at 0.09–0.37°. The lock/lift gap is 0.006 on B, as before.
  - Loop seams: 0.
  - Coincident faces: 0.
  - Body intersections: solid 0.0000, open 0.
  - Disconnected parts: 3 near-misses, unchanged kinds: the pallet assemblies to the wheel (frame hidden) and the known suspension stud at 0.029.
- **Tests.**
  - `tests/movement-309.test.mjs`: the p101 "drops into Brown's small nib" test is replaced by a p108 test. It checks there is solid above the bottom line and along the face to the stop, no toe nib, no second prong below the corner, and a clear cocking sweep.
  - The existing p101 one-contact test still passes.
  - The 309/310 and gravity-escapement tests all pass: 131 in total.
  - `models.test.mjs` filtered by 309/gravity/escapement: 4 pass.
- **Residual.** B's end now stops about 12 px higher than Brown's: the bottom is at y ≈ 194, not 206. Brown's lower edge and nib lie inside the teeth's swept path, so they can't be kept.

## 483: open top, see-through dial box, ducts meet the seat (fixed)

- **User review.** Make the top-right part see-through, remove the top so the mechanism shows, and connect the two elbow pipes whose ends stopped short (`/dev/shm/p108/img/121.png`). Also: which "flag rod" does the ledger mean?
- **Pipes, verified.** The four port ducts drop from the ports in B's seat. Two of the ports (x 0.784 and 0.892) lie right of the thick shelf's end (x 0.76), under B's thin seat plate (underside y 3.54). The drops started at y 3.42, the level of the shelf's underside, so they hung **0.12 short** of the seat, as open elbows in mid-air. These were the two pipes in the user's image.
- **Change** (`src/simulation/authored-dry-gas-meters.js`, the only movement in the file):
  - B's seat plate now carries a round boss underneath, as deep as the shelf (y 3.40 to 3.54). It is concentric with the crank centre (r = portRadius + 0.16 = 0.56), clipped to the seat (x ≥ 0.76), bored for the ports, and merged into the shelf mesh. Every drop now enters a bored solid face 0.02 deep: a 0.07 pipe in a 0.085 bore, as the other two drops already did.
  - The roof (`fixed-dry-meter-roof`) is removed. The outlet column rises out of the open top, as on the plate; Brown draws no top.
  - The dial-work box at the upper right is see-through in the shared style (`makeSeeThrough`). A′'s rod top, its top arm and the link to B's crank show through it, where Brown draws them dotted inside the box. The back-wall inlet bore also shows through, as a grey disc.
- **The "left flag rod".** This is `vertical-flag-rod-of-A`, the rocking rod that turns A's moving plate's motion into rotation of B's spindle. It stands at x −2.62, just inside the left case wall, in a bore through A's outer end board.
  - Its upper flag arm and the short link to the knob on A's blue plate are visible between the end board's top (y 2.54) and the shelf (3.40), a 0.86 stretch. Brown draws the knob but no rod.
  - See `/dev/shm/p108/a/483/flag-rod-A-default-zoom.png` (default view, zoomed at the upper left: the black vertical rod beside the grey end board, with the arm and link to the blue plate) and `flag-rod-A-oblique.png`.
  - It is kept. Without it, A's plate drives nothing: one rod through the crank's dead points cannot turn B continuously, and the plates would lose their quarter-turn phasing. Hiding it would need a rod or arm through a slot in a board raised to the shelf, or the rejected in-wall routing (p103).
- **Captures** in `/dev/shm/p108/a/483/`:
  - `b-*` are before; `a-*` are after.
  - `m483.png`: plate, before, after at phase 0 and at phase 0.5.
  - `n483.png`: yaw 40, yaw −40 with pitch 25, top, under the ducts, the top-right close-up and the flag rod.
  - `a-ducts-under.png` and `a-ducts-level.png`: the drops entering the shelf and the boss.
- **Tests.**
  - `tests/movement-483.test.mjs`: 9 pass. A new test checks there is no roof, that the box is see-through and casts no shadow, and that solid shelf or boss underside lies just outside each drop's bore, by ray.
  - `tests/gas-meter-working-solids.test.mjs`: pass. The roof pairs were dropped and the column comment reworded.
- **Screens** (483):
  - Body intersections: worst solid 0.0000. The only "open" parts are the 4 deforming leathers.
  - Disconnected parts: detached 0, slivers 0, lips 0; 38 near-misses. None is between a duct and the shelf. The remaining pairs are bearing clearances and the known rod-top joints: A′'s rod top stands 0.095 beside the dial box, and A's rod top 0.125 from the left wall, with no top bearing drawn.
  - Coincident faces: 0 flagged.
  - Loop seams: 0.
- **Shared data.** Motion bounds are unchanged (the column top is still 6.5), so `display-profiles` needs no regeneration. No report fingerprints this file.
- **Suggested edit for the owner of `src/data/source-presentation.js`.** The 483 note could read "…the outlet column rising out of the open case (no top) and the dial-work box, see-through…". This is optional.
