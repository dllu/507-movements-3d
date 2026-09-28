# Pass 90, lane p90-u1: 402 escapement rebuild, 404 thumbscrew, 370 ratchet direction, 390 bands and pawl pair

Reviewer: Claude Opus 5.5, lane p90-u1 (402 and 390 by forked sub-lanes, 370 and 404 by the lane; integrated by the lane). Date: 2026-09-27.

Scratch and captures are in `/dev/shm/p90/u1/` (outside Git). Before captures: `before/tile-ID.png` (plate, phases 0/0.25/0.5/0.75, rotated). After captures: `after/` (370, 404), `402/` and `390/`.

Other lanes' in-progress edits intermittently broke `registry.js` imports in the shared tree, so the registry-based tests and screens ran on snapshots: `git archive HEAD` with only this lane's files overlaid.

## 402: Guernsey's escapement, rebuilt as flat plates (sub-lane 402)

- **Before** (`/dev/shm/p90/u1/before/tile-402.png`):
  - The model was built in layers: a legacy builder, then a working-parts corrector, then an anchor rebuild, then the bridge.
  - The escape wheel had 15 teeth that leaned the wrong way and turned clockwise with them.
  - The anchor was a thin curved arm with small stub pallets. It sat in the wheel's plane, but the racks sat in a different plane.
  - The racks were two separate sectors on two box arms, and their gearing was reversed:
    - an external sector drove the upper pinion;
    - an internal sector drove the left pinion.
- **After.** The movement was rewritten from scratch in the 238/plate-escapement style.
  - **Geometry:** `src/simulation/guernsey-anchor.js`, rewritten. It is pure 2D and shared by the builder, the bake and the tests.
  - **Builder:** `authored-guernsey-escapements.js`, rewritten.
  - **Escape wheel.** One extrusion with Brown's 12 saw teeth. They were measured from the plate's outer contour:
    - tips at 59–62 px from the centre and roots at 47–49 px (model 1.09 and 0.85);
    - each steep front face lies clockwise of its tip, with its root 6° ahead of the tip; the long straight back falls counter-clockwise;
    - small circular rounds at every tip and root.

    The wheel is urged clockwise, as those faces require. Brown's centre rings appear as a collet on the wheel (r 0.41) and as the bridge's round end (r 0.59).
  - **Lever B + anchor A.** These are one plate, one simply connected outline with a single bore. It contains:
    - the bored boss at B;
    - Brown's straight bar at 151.8° to the arm;
    - a curved upper arm arching over to pallet A;
    - a lower arm bowed slightly left, down to the lower pallet.
  - **Pallets.** Each is a chisel-nosed blade with a 0.012 nose round.
    - Its working flank is exactly the front face of a tooth at the end of the swing that drives it in: the upper at −A, the lower at +A, half a pitch of wheel later.
    - At that point its nose sits 0.03 up from the root. There are no pins or offsets.
  - **Single toothed arm (complaint 3).** The rack is one annular band concentric with B, so the gearing works. The one bar from the boss carries it.
    - Internal involute teeth on the band's concave edge mesh the upper pinion. The pinion lies inside the arm, where Brown draws it.
    - External involute teeth on the convex edge mesh the left pinion, which lies outside.

    This corrects the reversal (complaint 2).
    - **Gearing:** pitch radii 2.150 and 2.394, two 12-tooth pinions (module 0.036, 30° pressure).
    - **Direction:** the upper balance turns with the lever and the left against it.
    - **Teeth:** 9 internal and 9 external, which is exactly those that pass the pitch points over the swing.
  - **Balances.** Each is one flat brass extrusion: a rim (1.36–1.50), one diametral bar and a bored hub. Each carries its pinion on a collar.
    - Planes: upper 0.10–0.20, left −0.08–0.02; the working plane is 0.30–0.46.
    - Their arbors run from small rear bearings. The see-through bridge in front still carries the lever and wheel arbors.
    - The frame bars behind, which Brown does not draw, are gone.
  - **Motion.**
    - Lever: θ = 8° sin(2πt/6 s). The plate pose is mid-swing, which matches Brown: A's point at the tip circle, the lower pallet just out.
    - Balance amplitude is about ±80°.
    - The wheel is solved from the outlines with the shared `solveDrivenWheel` and baked by `scripts/bake-guernsey-anchor-402.mjs` into `baked/guernsey-anchor-402.js`: 1600 steps, source sha256, `--check`, closure 7.6e−12.
    - Each half period: impulse along the withdrawing flank, drop, landing on the other blade, and recoil into its root.
    - Exactly one tooth per period.
  - **Deleted (402-only):**
    - `guernsey-working-parts.js`
    - `baked/guernsey-contact.js`
    - `scripts/generate-guernsey-contact.py`
    - `scripts/export-guernsey-contact.mjs`
    - `scripts/studies/guernsey-contact-continuation.py`
- **Captures** (`/dev/shm/p90/u1/402/`):
  - `tile-402.png`: the plate, phases 0/0.25/0.5/0.75 and a rotated view.
  - `ba-402.png`: before above, after below.
  - `pallets-402.png`: pallet A at 0/0.05/0.5/0.75 (seated at 0.75); the lower pallet at 0.1/0.25/0.5/0.55 (seated at 0.25).
  - `racks-402.png`: the upper internal mesh and the left external mesh at 0/0.25/0.75.
  - `oblique-402.png`: an oblique view and a back view.
  - `ov.png` and `overlay.mjs`/`ov.py`: 2D overlays on the plate.
- **Screens** (402 only):
  - Coincident faces: 0 flagged. The first run found collar/pinion shared bores; the collars are now bored 0.008 larger.
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. The 10 near-misses are all running clearances: balance/bearing 0.02, collars, collet/bridge, and lever/balance planes.
  - Loop seams: 0.
  - Body intersections: worst solid 0.0000 (lever/anchor against the wheel, which is the working contact); coaxial 0; open 0. This ran on a working-tree snapshot, `/dev/shm/p90/u1/402/snap`, because another lane's in-progress `reed-396-contact.js` (`JDROP` undefined) breaks registry imports in the live tree.
- **Tests:**
  - `tests/movement-402.test.mjs` is rewritten, 8 tests: exact part list; one plate for the lever, anchor and arm; internal/external sides and counter-rotation; 12 clockwise saw teeth; bake current (sha) and reproducible, one tooth per period, bounded recoil; seats flank-flush with the nose in the root; no lever/wheel overlap over 240 phases with contact at over 200 of them; no gear interference, pinions always engaged; shared working plane.
  - `tests/guernsey-working-solids.test.mjs` is rewritten, 5 tests on the rendered solids: lever/wheel/pinions never cut each other; the fixed arbors, bearings and bridge are clear; the balances are clear; stable buffers, fog off and a see-through bridge; no shared collar bores or faces.
  - All 13 pass.
  - On the snapshot:
    - `authored-loader` passes.
    - Camera-catalog, restricted to 402, passes. The full run fails first on 377, which belongs to another lane.
    - `loop-seams` reports no 402 entry; its only failure is 365.
    - Source-presentation, restricted to 402, passes. Its full-run failure is 172.
- **Shared data edit:** the 402 entry in `src/data/source-presentation.js` now has an empty removal list (the old roles no longer exist) and a note that describes the new model.
- **Routes:** unchanged. The factory still handles only 402.
- **Residuals:**
  - Brown draws about 13 teeth on each part of the arm. The 8° swing that the pallets allow uses 9 each, so the toothed runs, and the arm's lower end, are shorter than drawn.
  - The arm is a true arc about B, where Brown draws a freer curve that sits a little further out in its middle.
  - The upper pallet gives most of the impulse. The lower pallet's impulse is small and is followed by a drop of about 0.48 pitch (14°), so the wheel steps in two unequal jumps.
  - Pallet A is shorter and points about 25° more to the right than Brown's hanging blade, because its flank must lie along the tooth face.
  - Brown's pinions look a little larger than the pinions that fit inside the arm's band.
  - The lever swing is a prescribed sinusoid. There are no balance springs, train torque or inertia.
- **Proposed ledger row (402):**
  - assessment: minor
  - visibleFlaws: "The toothed runs on B's arm are shorter than Brown's (9 teeth each where he draws about 13, as the anchor's swing uses), and the arm is a true arc about B where Brown's curve bulges further out. Pallet A points further right than Brown's hanging blade."
  - limits (replace): "p90: rebuilt from flat extrusions. The 12-tooth saw wheel turns clockwise as Brown's steep faces require. Lever B, anchor A and one curved arm concentric with B are one plate. Internal teeth on the arm turn the upper pinion; external teeth turn the left one. Each pallet blade lies along a tooth's front face with its nose in the root at the end of its swing. Wheel motion is baked from outline contact (recoil anchor, one tooth per period); the lever swing is a prescribed 8° sinusoid, with no springs, torque or inertia. The see-through bridge carries the lever and wheel arbors; the balance arbors run from small rear bearings."

## 404: thumbscrew head
- **Before.** The head was a cos 3θ trefoil (three identical lobes, 120° apart) on a horizontal hub cylinder, with a white index sphere. Seen from the front it read as two symmetric lobes (`before/tile-404.png`).
- **After** (`makeHandwheel`, `THUMBSCREW_HEAD`, `thumbscrewHeadOutline` in `authored-flexible-cyclographs.js`). Brown's wing head: a thin washer collar coaxial with the screw, then one flat bevelled plate in the screw's plane. It has three lobes arranged asymmetrically: a narrow neck lobe up into the collar and two round grip lobes down-left and down-right, split by a flat-topped notch that widens toward its mouth. Every edge is a circular arc or a straight line, and each join is tangent:
  - concave neck fillets, tangent to the neck line and to the lobe circles;
  - the lobe circles;
  - straight notch sides, internal tangents from the lobe circles to small concave corner arcs;
  - a flat notch top.

  Proportions are read from the plate and scaled to the screw's diameter. At the source pose the wing faces the viewer, as drawn (`THUMBSCREW_FACE_OFFSET`). The white index sphere and the horizontal hub are gone; the wing itself shows the turning. The head's top runs into the collar and meets the screw end.
- **Captures:** `after/tile-404.png` (plate, phases 0/0.25/0.5/0.75, rotated view) and `after/zoom-404.png` (plate crop beside the head, face-on, oblique and edge-on).
- **Screens** (on a snapshot of HEAD plus this lane's files, because other lanes' in-progress edits broke the registry import in the shared tree):
  - Disconnected parts: 0 detached. Near-misses stay at 4 (the existing roller pairs). The old screw/grip lip (1) is gone.
  - Coincident faces: 0.
  - Body intersections: unchanged (worst solid 0).
  - Loop seams: 0.
- **Tests:** `movement-404` has a new test and passes 9/9; `movement-403` passes. The new test asserts that the outline is mirror-symmetric with the neck at the top, that the two lobes reach and drop as constructed, and that the notch opens between the lobes. It also asserts that there is no angular index and that the wing faces the viewer at phase 0.
- **Residual:** Brown's grip lobes are slightly egg-shaped. Here they are circles, so the widest point sits about 0.1 lower than his.

## 370: ratchet and click direction
- **Before.** The ratchet turned clockwise. The click was a hook that pulled the left-side teeth upward, and the tooth tips pointed anticlockwise (`before/tile-370.png`, `before/zoom-370.png`).
- **Plate reading** (`z370lr2.png`). On the right side of Brown's ratchet, each tip has its long flank above it and its short radial face below it. His click comes down the left side from above, its curl round the bar's edge and its straight end pointing down into the teeth. So the click pushes the left side down, and the wheel turns anticlockwise.
- **After:**
  - **Direction.** `clickHand` is +1. The teeth, the drive and the click are all reversed. The wheel advances one tooth anticlockwise per crank turn, and the carrier swings 130° → 160°: down the left side.
  - **Click geometry.** The pivot is at Brown's 1.6 ratchet radii, at about 130° (Brown: about 125°). The nose sits in a root at about 165°, as drawn. The click is one flat bored plate whose blade is a single circular arc bulging to the left, like Brown's click. The nose is cut along the (slightly undercut) tooth face. Its rest angle is the exact outline contact.
  - **Resting lift.** A pushing click's lift arc swings its nose forward under the undercut tip, so clearance is not monotonic in lift. The file now finds the lowest clear resting lift itself, instead of using the shared bisection in `seated-ratchet-click.js`, which is unchanged.
  - **Return stroke.** The click climbs the long flank and rests on the passed tip until the carrier has drawn it clear. It then falls at a finite rate (0.03 pitch of return), never entering the wheel. Carrier overtravel (backlash) is 0.2 pitch (was 0.12), so the fall ends on the flank before the drive draws the click back into the root.
  - **Seating.** Driving, the click is seated in the root (lift 0).
  - **Continuity.** The rendered click angle is continuous: the largest step is 0.002 rad at 8000 samples per turn.
  - **Note.** The reconstruction note now says "anticlockwise".
- **Captures:**
  - `after/tile-370.png`: plate, phases and rotated view.
  - `after/zoom-370.png` and `after/wheel-370.png`: ratchet zooms with the mirror and bar hidden.
  - `after/clickh-370.png` and `after/clickzz-370.png`: the click over 8 phases.
- **Screens** (same snapshot):
  - Disconnected parts: detached 1, the existing lower-rail pin near-miss. Near-misses went from 21 to 20, and short-of-pin from 2 to 1. The lip is the existing crank-arm lip.
  - Coincident faces: 0.
  - Body intersections: unchanged (the 0.0606 telescoping-follower pair predates this pass).
  - Loop seams: 0.
- **Tests:**
  - `movement-370` passes 8/8. It now asserts clickHand +1 and one anticlockwise revolution.
  - `polishing-interfaces` passes 4/4. Its 370 click test is rewritten to check anticlockwise drive, a continuous rendered click angle over time, the seat at the drive, a click-to-teeth gap of 0.0015–0.006, and at most one sampled pose off the teeth (the fall).
- **Residuals:**
  - The follower ball in front hides the click's boss in the default view, as before.
  - The mirror still sits somewhat higher on the bar than Brown's.

## 390: bands anchored, taut and in their grooves; the pawl pair (sub-lane p90-u1/390)

Scratch and captures are in `/dev/shm/p90/u1/390/`, outside Git.

- **Before** (`/dev/shm/p90/55.png`, `b-390-side*.png`, `/dev/shm/p90/u1/before/tile-390.png`):
  - The crossed band's spans were bowed axially ±0.13 (the old `crossoverLift`), so from the side they kinked.
  - Both bands wrapped A at radius 1.65, which was also the centreline of two thin groove tubes. The band therefore lay inside those tubes and ran past A's thick 0.13 tube rim.
  - The ends were brass knots at arbitrary angles (base wrap 0.57 rad), partway down A's sides.
  - One pawl per pulley. From the front only the front pulley's pawl showed, so Brown's second pawl was missing.
- **After** (`authored-dual-band-ratchets.js`, plus `install390Pawls` in `dual-band-pawl-contact.js`, which only 390 uses):
  - **Piece A.** One closed revolved rim (`grooveRimGeometry`), capped at both horns, with Brown's ring width (r 1.40–1.695).
    - A narrow groove for open band C (0.07 wide).
    - A wide groove for crossed band D (0.14 wide). D's two ends lie side by side in it.
    - Groove floors are 0.005 under each band, and each band is sunk 0.025 below the rim.
    - The lever bar spans the rim's depth (0.005 inside its faces), so the rim's horns end inside the bar. The fulcrum pin is lengthened to match.
    - The groove tubes, the thick tube rim and the anchor knots are gone.
  - **Band ends.** All four ends are fastened in their grooves just under the bar, 0.044 rad below each horn, and turn with A. Each end stands 0.007 up into the bar's underside.
  - **Taut path.** Each band is: a wrap in A's groove, a straight span, a wrap in the pulley groove, a straight span, and the wrap back up A's other side.
    - Both spans of every band are `LineCurve3`s, and every wrap lies exactly on its groove radius.
    - The crossed band's two spans run in parallel planes 0.035 either side of its mean plane, so they pass at D, 0.64 above the pulley centre (Brown's D is about 0.67), with 0.02 clearance.
    - Its pulley wrap eases between the two planes (smoothstep, at most about 2.4° of axial slope), inside the groove. The lengths stay exactly constant.
  - **Stroke.** A's swing had to shrink so that the band ends never unwrap past the horns: ±14.2° (was ±27.8°).
    - Each stroke now advances the flywheel a quarter turn (three teeth), so one oscillation gives half a turn.
    - The loop closes on the flywheel's four spokes and twelve teeth. The seam check shows 0 seams.
    - The minimum wrap left on A is 0.138 rad (0.23 of band).
  - **Pulleys.** Both loose pulleys are identical and the same blue. Each has a flat-bottomed groove (floor 0.475, half-width 0.07) between flanges. The old flange ring, which shared the pulley's outer surface, is removed.
  - **Pawls.** Each pulley now carries Brown's point-symmetric pair: two identical pawls (one shared geometry) half a turn apart, on one face. Twelve teeth put both in roots together, so the two share one lift law and seat at the same moment. The front pair matches the plate: upper-left pivot curling down, lower-right pivot curling up (`cmp-pawl.png`). The rear pulley's identical pair is hidden behind it.
- **Captures:**
  - `after/tile.png`: the plate, phases 0/0.25/0.5/0.75 and a rotated view.
  - `cmp-side.png`: 55.png, the before side views and the after side views.
  - `after/zooms.png` and `after/z2.png`: anchors from below and from the side, the crossing, and the pulley grooves.
  - `cmp-pawl.png`: pawls before, after at two phases, and the plate.
- **Screens** (run on a HEAD snapshot with only this lane's files overlaid, because other lanes' files were mid-edit; HEAD values in brackets):
  - Coincident faces: 0 flagged, 0 seams (0).
  - Disconnected parts: 25 meshes, 0 detached, 0 near-misses, 0 open ends, 0 slivers, 0 lips (29 meshes, all 0).
  - Body intersections: 9 bodies, worst solid 0.0000, 0 open meshes (7 bodies, 0.0000, 2 open meshes: the old tubes).
  - `check-loop-seams --ids=390`: 0 seams, 0 pops.
- **Tests:**
  - `movement-390` has 10 tests. New or rewritten:
    - Taut bands: straight single-plane spans, and every wrap on its groove radius over 65 phases.
    - The crossed spans cross above the pulley and clear each other.
    - The ends turn with A and stand 0.065–0.08 under the bar.
    - Each band section sits between its groove walls, clear of the floor and sunk below the rim, on A and on the pulley.
    - **Band/part penetration:** band surface vertices at 24 phases were checked against the rim, bar, pin, flywheel rim and spokes, shaft, both ratchets, pulleys, hubs, all four pawls and their pins. Every gap is at least 0.005, except the bar at −0.0065, which is the fastened end.
    - Half-turn output.
  - `dual-band-390-contact` (5): asserts two pawls per pulley, mirrored through the axis, on one face, sharing one geometry and one lift. The solid pawl/ratchet, pin/eye and pawl/face checks now cover all four pawls.
  - `alternating-drive-solids`: the band/groove fit is sampled across the crossed band's whole shift.
  - These, `authored-loader` and `dual-band-native-study` pass (26 of 26).
  - **Full suite** (`node --test tests/*.test.mjs` on HEAD with this lane's files overlaid): 4626 tests, 4620 pass, 3 skipped, 3 fail. None of the failures involve 390:
    - Two need a built `dist/`, which the snapshot does not have.
    - One is the 108 bake-timing assertion (3.9 s under load).
- **Not changed:**
  - The validation-only MuJoCo study (`mujoco-dual-band/`) still models its own pawl stop and the old carrier amplitude. Its `study-results.json` source hash was already stale at HEAD. It is unqualified-do-not-bake and was not rerun.
  - The routes are unchanged.
- **Residuals:**
  - To keep the fastened ends meeting the bar, the lever bar is now as deep as the rim (0.63), which reads as a deep plank in rotated views.
  - Brown's A swing is unknown. The half-turn-per-oscillation ratio is a reconstruction choice.
  - The rear pulley's identical pawl pair is hidden, as it would be in Brown's view.

**Proposed ledger row (390):**
- **Assessment:** reasonable.
- **visibleFlaws:** "".
- **Limits (replace):** "Both bands are fastened in A's grooves just under the lever bar, taut (straight spans, wraps on the groove radii); the crossed band's spans pass at D in planes 0.07 apart and its pulley wrap eases between them. A swings ±14° and each stroke turns the flywheel a quarter turn (half a turn per oscillation). Each loose pulley carries Brown's identical point-symmetric pawl pair, seated in roots together; drop and take-up are prescribed, not force-solved. The lever bar is as deep as the rim so the band ends meet it. Undrawn supports removed (pass 64); shafts end as plain stubs. The validation-only MuJoCo study still uses its earlier stop and carrier amplitude."

## Shared-file edits
- `src/data/source-presentation.js`, only the 402 and 404 entries:
  - **402:** the removal list is empty (the old part names are gone), and the note describes the new model.
  - **404:** the removal pattern for the deleted white handwheel index is dropped, and the note names the wing thumbscrew.

## Integrated run
Snapshot: `git archive HEAD` plus all of this lane's files for 370, 390, 402 and 404 (`/dev/shm/p90/u1/int`). The 402 deletions were applied, and only the 402/404 entries of `source-presentation.js` were taken from the working tree.
- **Tests.** movement-370/390/402/403/404, guernsey-working-solids, dual-band-390-contact, dual-band-native-study, alternating-drive-solids, polishing-interfaces, authored-loader, camera-catalog, source-presentation and loop-seams: 74 of 74 pass, after the 404 source-presentation fix. The first run failed only on the stale 404 removal pattern.
- **Loop seams** (`check-loop-seams --ids=370,390,402,404`): 0 seams, 0 pops, 0 errors.
- **Coincident faces:** 0 flagged pairs for all four IDs.
- **Disconnected parts:**

  | ID | Detached | Near-misses | Slivers | Lips |
  |---|---|---|---|---|
  | 370 | 1 (the existing lower-rail pin near-miss) | 20 | 0 | 1 (the existing crank arm) |
  | 390 | 0 | 0 | 0 | 0 |
  | 402 | 0 | 10 (running clearances) | 0 | 0 |
  | 404 | 0 | 4 | 0 | 0 |
- **Routes:** no factory changed which IDs it handles, so the routes were not regenerated.
- **Full suite on the integrated snapshot** (`node --test tests/*.test.mjs`): 4623 tests, 4618 pass, 3 skipped, 2 fail. Both failures (production entry point, portable engravings) need a built `dist/`, which the snapshot lacks; neither involves these IDs.
