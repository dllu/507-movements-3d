# Pass 86 lane 8: sliver-joint fixes (433, 451, 454, 455, 459, 488, 500)

Reviewer: Claude Opus 5.5, lane p86-8. Date: 2026-09-27. HEAD `b8ab312`.

This lane fixes the real sliver joints (and the 433 overhang lip) that the lane-5 screen flagged
(`docs/p86-5-sliver-screen.md`). Each fix is at the joint itself: sunk roots, a bored lug, a pin, a fork, or a sealed
bore. No undrawn mechanism parts were added.

## Evidence

Scratch files are in `/dev/shm/p86/p86-8/`, outside Git:

- **Screens:**
  - before: `before-ID.json`;
  - after: `ID.json` (also `after-ID.json`), from `node scripts/screen-disconnected-parts.mjs --ids=ID --out=…`;
  - body intersections: `int-before.json` and `int-after.json` (`scripts/screen-body-intersections.mjs`; the before run used the HEAD snapshot).
- **Captures:**
  - tiles: `before-K-tile.png` and `after-K-tile.png`. Each is the plate, the default view, a zoom on the joint, and zooms rotated +70° and −110°. K is 433, 451, 454a, 454b, 455, 459, 488 or 500.
  - targeted zooms:
    - 451: `h451-tile.png` (HEAD) and `y451-tile.png` (after), looking at the pipe/neck junction from behind and from below;
    - 454: `o454-tile.png`, both flaps open between their lugs;
    - 500: `x500-cmp.png` (HEAD beside after, with the dial hidden);
    - 454 delivery branch: `p454-tile.png`.
- **Caution.** The dev server runs with `watch:null` and caches modules, so it was restarted before the after captures were taken. The HEAD comparisons come from a separate server on the p86-5 HEAD snapshot.

## Per movement

| ID | Before (screen) | Change | After (screen) |
|---|---|---|---|
| 433 | 16 lips: each pitched board stood 0.10 proud of the hub ring, and its root butted the hub's curved face along a line. | The board roots now start at r 0.28, sunk 0.24 into the hub. The hub is 0.56 deep (y −0.12..0.44), enough to enclose the boards' 35° pitched section (`authored-horizontal-overshot-water-wheels.js`). | 0 lips, 0 slivers |
| 451 | Sliver, score 0.44: the square-cut outlet end met the round neck with a wedge gap at its sides. | The outlet wall starts inside the bore. Each generator is trimmed along the pipe to the mid-wall cylinder (r 0.50 of the 0.475–0.53 wall), so the end is a saddle seated round the 0.205 port. A new helper, `saddleEndPipeWall`, keeps the wall watertight (`force-pump-working-parts.js`, in the 451-only branch). | 0 slivers; the outlet counts as closed |
| 454 | 2 slivers, score 0.42: each knuckle lay tangent in the seat slot. | Each seat now carries two lugs at \|z\| 0.22–0.28, bored r 0.07 round the knuckle axis, and the knuckle ends flush with them. The flap is 0.42 deep (was 0.46), so it clears the lugs (`flexible-pump-working-parts.js` 454 branch; disk in `authored-diaphragm-pumps.js`). | 0 slivers; flaps open fully between the lugs (`o454-tile.png`) |
| 455 | 2 slivers, score 0.25: each valve touched the drum only at its root corner. Its knuckle lay loose in an open cradle. | Each valve now turns on a 0.036 hinge pin through a bored knuckle; Brown draws a small circle at each hinge. The pin is fast in the rotor's rear web, which now also closes the back of both recesses (the drum section less the wall, z −0.36..−0.30), and runs flush to the front face. The valves start 0.006 in front of the web (`authored-old-rotary-pumps.js`). | 0 slivers |
| 459 | Sliver, score 0.73: the rocking shaft ended under the block, touching it at one edge. | Brown's upright shaft runs down into a square block at the spiral's head, and the spiral rocks sideways under it while both turn. The joint is now a Hooke coupling (follow-up below). | 0 slivers |
| 488 | 4 slivers, score 0.48: the blade roots lay on the hub face (0.01 deep). | The drawn blade surface starts at r 0.30, sunk 0.13 into the hub wall (bore 0.184, face 0.43). The planform is a function of radius, so nothing outside the hub changes. The hydrodynamic root radius stays 0.42, and the new radius is exposed as `bladeSunkRootRadiusSceneUnit` (`authored-screw-propellers.js`). | 0 slivers |
| 500 | Sliver, score 0.08: the inlet stood in a full-depth slot through the chamber wall, and its top touched clamp ring A. That line was also the clamp's only hold: the clamp floated 0.045 inside the chamber. | The slot is filled by a boss bored 0.17 round the inlet, and the inlet ends flush with the wall's inner face (y −1.475). The chamber gains an inner lip (r 1.40–1.48, 0.06 deep), and the clamp torus is bedded 0.035 into it (`elastic-gauge-working-parts.js` 500 branch; inlet end in `authored-diaphragm-pressure-gauges.js`). | 0 slivers, 0 detached |

## Plate and visual checks

- **433.** The boards now run out of the hub side, and no step shows at the hub top. The hub is deeper than Brown's thin collar; this was already true in form, and the collar ring is unchanged.
- **451.** The saddle end is seated on the neck with no light through the junction (`y451` beside `h451`). The neck's port is still built from layered slabs, but the pipe now covers it.
- **454.** The lugs read as small bosses at the knuckle ends. In the front section they sit behind and in front of the knuckle, so the section outline still matches Brown's clack flap.
- **455.** A dark pin dot shows in each knuckle, where Brown draws his hinge circles.
- **459.** The front view keeps Brown's square block where the upright shaft meets the spiral, now between two small forks. See the follow-up below.
- **488.** The model looks unchanged from outside; the roots are hidden in the hub.
- **500.** The notch in the chamber bottom has gone (`x500-cmp.png`). The clamp now sits in the chamber mouth.

## Tests and checks

- **New tests.** `tests/p86-sliver-joints.test.mjs` has 6 tests, one per fix:
  - 433: the roots are inside the hub;
  - 451: the pipe end lies on the mid-wall cylinder;
  - 454: the lugs bore round the knuckle at 17 phases;
  - 455: each pin is in its bored knuckle and fast in the web;
  - 459: the cross pin lies on z, and the eye is bored round it;
  - 500: the bored boss, the pipe end in the wall, and the lip bedding the clamp.
- **Changed test.** `tests/movement-488.test.mjs` asserts the helicoid from the sunk root radius, which must lie inside the hub wall.
- **Targeted run: 191 pass, 0 fail.** It covered:
  - movements 433, 450–455, 459, 488, 499 and 500;
  - the force-pump, flexible-pump, elastic-gauge, drawing-gauge, rotary-pump, turbine, marine-rotor, well-scoop and ejector solids tests;
  - reviewed-cycle-timing, camera-catalog (all 507) and opening-camera-motion;
  - the new file.
- **Models.** `tests/models.test.mjs`: 163 pass.
- **Loop seams.** `node scripts/check-loop-seams.mjs --ids=433,451,454,455,459,488,500` checked 7, with 0 seams above tolerance, 0 pops and 0 errors.
- **Body intersections.** The worst solid depth is unchanged for all 7. The only new result is a 0.0001 coaxial contact in 454, the knuckle in its lug bore. The 451 outlet is still a closed mesh.
- **Validation reports.** None fingerprints the changed files. No routes changed.

## Follow-up (coordinator): 454 sealed branch, 459 turning coupling

**454.**
- **Round ports.** `pumpPortedWall` (`flexible-pump-working-parts.js`) now takes a round port, `{side, y, z, radius}`. The wall is cut by the square round the hole. The square is filled by a patch of the same wall, built on a polar grid round a true round bore, which follows the wall's curvature. Rectangular ports are unchanged: they gain an optional z centre, 0 by default, so 453 and the other rectangular ports build as before.
- **The chamber.** Its oversized 0.60 x 1.36 rectangular port is replaced by a round port of r 0.27, fitted to the delivery branch's outside diameter.
- **The branch.** Its wall starts inside the chamber, and each wall line begins on the wall's mid-radius (1.28). The end is therefore a saddle seated in the bore, like 451's outlet. `saddleEndPipeWall` is now exported from `force-pump-working-parts.js`, and its search range is widened to half the curve.
- **Screen.** 0 detached (was 1: the right check valve and its piping), 0 slivers.
- **Other checks.** The chamber shell is still a closed mesh, and the body-intersection result is unchanged.
- **Capture.** `q454-tile.png` (compare `p454-tile.png`): the section edge runs unbroken round the pipe, and outside the pipe meets the wall with no gap.

**459.**
- **Plate.** Brown draws the upright shaft (through its crossed bearing) entering a square block at the spiral's head, with the spiral slightly tilted below it. A single cross pin cannot pass rotation between two turning shafts at an angle, so the joint is modelled as a Hooke coupling. Brown's square block is the spider.
- **The spider.** A 0.20 cube with two crossed trunnion bars (r 0.04): its x trunnions carry a fork on the wind-wheel shaft, and its z trunnions a fork on the spiral's shaft. Fork cheeks are 0.06 plates at 0.12–0.18 from the centre, bored 0.042, with bridges 0.12–0.17 beyond the block.
- **Motion.**
  - The upper fork turns with the wind wheel.
  - The spiral's shaft and lower fork are carried on the worm's rotor, so they turn with the worm and rock with the carrier.
  - The spider is oriented every frame from the two fork axes, made exactly perpendicular. The Hooke speed ripple is O(tilt²), below 0.003 rad at the 0.106 rad maximum tilt; it is not shown, so the worm keeps its exact angle.
- **Screen.** 0 slivers. The body-intersection screen shows 11 bodies and an unchanged worst solid (the pre-existing 0.0011 tappet pin). The star-wheel detachment is unchanged from HEAD.
- **Captures.** `r459-tile-a.png` (plate, default, front zooms at two phases) and `r459-tile-b.png` (rotated zooms at four phases, showing the spider turning with both shafts).

**Checks.**
- The new tests in `tests/p86-sliver-joints.test.mjs` pass:
  - 454: the round port fits the pipe, no wall material lies inside it, and the pipe end sits on the mid-radius;
  - 459: at 25 poses each fork's bore stays on its trunnion, and the spider turns.
  The earlier 459 eye test was replaced.
- Loop seams for 451, 453, 454 and 459: 0 above tolerance, 0 pops.
- 273 tests pass: flexible-pump, force-pump and well-scoop solids, movements 450–454 and 459, reviewed timing, camera-catalog (all 507), opening-camera, models, and the new file.
- The 451 and 453 screens are unchanged.

## Seen, not fixed

- **500.** The lip row on `pressure-pipe-down-back-of-case-in-section` was present at HEAD and is not one of this lane's IDs.
- **459.** The star-wheel axles still have no carrier, as recorded in the ledger.

## Proposed ledger rows

- **433: reasonable.** visibleFlaws: none. Limits (append): "Pass 86: the boards' roots are sunk 0.24 into a 0.56-deep hub (no proud lip); the hub is deeper than Brown's thin collar."
- **451: reasonable.** visibleFlaws: none. Limits (append): "Pass 86: the side outlet's end is a saddle trimmed to the neck's mid-wall and seated round the port."
- **454: reasonable.** visibleFlaws: none. Limits (append): "Pass 86: both flap knuckles turn in two bored lugs cast on their seats (flaps 0.42 deep to clear them); the delivery branch is sealed in a round chamber port fitted to it, its end a saddle on the wall's mid-radius."
- **455: reasonable.** visibleFlaws: none. Limits (append): "Pass 86: each segment valve turns on a 0.036 hinge pin through its bored knuckle, fast in the rotor's rear web, which now also closes the recess backs."
- **459: minor.** visibleFlaws: unchanged (the star-wheel axles). Limits (append): "Pass 86: the coupling is a Hooke joint: Brown's square block is the spider, turning with both shafts, whose forks ride its crossed trunnions; the O(tilt²) Hooke speed ripple (<0.003 rad) is not shown."
- **488: reasonable.** visibleFlaws: none. Limits (append): "Pass 86: the drawn blade surfaces start 0.12 inside the hub (sunk roots); hydrodynamic quantities keep the 0.42 root."
- **500: minor.** visibleFlaws: unchanged (the projection overlap). Limits (append): "Pass 86: the inlet ends in a bored boss in the chamber wall (no open slot), and clamp ring A is bedded in an inner lip of the chamber mouth."
