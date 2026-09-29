# Pass 99, lane p99-e: residual minor rows 109, 153, 370, 377, 394, 397, 429

Reviewer: Claude Opus 5.5, lane p99-e (five parallel forks, integrated by the lane). Date: 2026-09-28. No git writes. Scratch and captures: `/dev/shm/p99/e/<id>/`.

Claims: authored-screws.js, authored-person-treadmills.js, authored-parsons-racks.js, authored-mirror-polishers.js, authored-intermittent-shuttle-drives.js, authored-double-elliptical-rotary-engines.js, authored-stud-drives.js, mujoco-thread-cutting, geometry.js (mujoco-stud-reverser only), treadmill-gait.js, open-crescent-shuttle-motion.js, open-crescent-shuttle.js, generated-parsons-ends.js.

## 109: the plate's part-cut look now holds on every pass

**Flaw.** After the opening cut the screw stayed fully threaded (the tool re-chased a thread that ran down to the gears), so Brown's threaded-above, plain-below look showed only in the first 5.9 s after load.

**Why the old design couldn't keep it.** Stock is only ever removed, so over any loop the cut volume is constant. A thread cut to the gears can't return to part-cut without exchanging the work, and no exchange apparatus is drawn (p94).

**Fix: shorten the stroke, not the look.** The carriage's lower stop is now one work-thread turn (0.307, 30.7 px) below Brown's drawn tool position. It was 0.97 below, just above the gears.
- Playback opens at the drawn pose, part-way down the first cut.
- That descent cuts one more turn in 1.95 s, then reverses.
- Every later pass chases the same thread down to the same stop.
- The thread therefore ends just below the drawn tool, and the rest of the blank stays a plain shank below it at every phase. This is a real screw form: a thread run out onto a plain shank.
- The stroke is 1.33 (was 2.00). The period is 16 s (was 24), which keeps the working speed at 0.175 u/s (17.5 px/s). The upper stop, gears, pitch and 52:76 pair are unchanged.
- At the finished state the work is 61% cut (volume 0.2360, between the uncut 0.3227 and the fully threaded 0.1804). The plain shank below the thread end runs y −1.155 to −0.268.

**Files:**
- `src/simulation/mujoco-thread-cutting/profile.js`: `lower = -|workPitch|`
- `physics.js` and `geometry.js`: the default period is now 16
- `visual.js`: the reconstruction note
- `scripts/lib/mujoco-bake-configs.mjs`: the 109 note
- `docs/mujoco-109-thread-cutting.md`
- `tests/mujoco-thread-cutting.test.mjs`
- Claim: `mujoco-thread-cutting` (directory)

**Rebake.** `node scripts/bake-mujoco-movement.mjs 109` rebaked `mujoco-109.json.gz` and its provenance.
- 1000 samples over one 16 s period from 32 s.
- Raw seam 0 px; seam step 4.485 px (interior 4.509).
- Round trip 0.0067 px.

**Captures** (`/dev/shm/p99/e/109/`):
- `before-sheet.png`: phases 0.25 onward are threaded to the gears.
- `after-sheet.png`: the plate, phases 0, 0.12 (bottom stop), 0.25, 0.5, 0.75 and 1.5, yaw ±40 and pitch ±25. Every phase is threaded above and a plain shank below.

**Tests.**
- `mujoco-thread-cutting` 5/5. Test 5 is rewritten: live and baked agree; volume never rises; the groove never runs below the tool on the opening descent; afterwards the volume is constant across reversals and the seam; the stop is one work pitch below the drawn tool; the finished job stays part-cut; the plain shank keeps more than 35% of the stock length.
- `models.test` 109: 1/1.
- `mujoco-baked-loops` 115/116. The one failure is 116 ("compiled physics is the one that was baked"), from another lane's rack-rectifier edits. It is not 109's.

**Screens.**
- Disconnected parts: 0 detached, 0 slivers. There are 4 near-misses (two bore clearances, guide/gear short-of-pin, leadCore/gear) and 1 arm/carriage lip. These are static frame relations the stroke change doesn't touch.
- Coincident faces: 0.

**Proposed ledger row.**
- assessment: reasonable
- visibleFlaws: (empty)
- limits: replace the p94 sentence with: "p99: the carriage stops one work-thread turn below Brown's drawn tool, so the thread runs out onto a plain shank below and every pass keeps the plate's threaded-above, plain-below look. Playback opens at the drawn pose mid-cut, cuts that last turn, then chases the same thread; the work is never exchanged and the loop has no jump (16 s period, rebaked)."


## 153: input-arm depth step, proven forced, halved and rounded

**Flaw:** "The input arm's depth step shows in rotated views (a flat arm would swing about 63° where about 25° is needed)."

**Proof that a flat arm cannot work at Brown's layout.** This does not depend on the arm's shape.
- Model numbers: elbow pivot (−2.646, 0.084), 2.647 from the disk centre. Stud orbit R 1.4196, stud radius 0.154. Brown's arm end (source (204, 373)) is the centre of the rounded end, 1.667 from the pivot with radius 0.126.
- At the drawn rest angle (−29.1°) that end centre is 1.395 from the disk centre, so it lies on the stud orbit.
- Any arm in the stud plane that joins the pivot (outside the orbit) to that end therefore straddles the orbit. The next stud must strike it somewhere.
- The disk turns clockwise: the top stud lies left of the lug, and the bar stud lies left of the return arm. So the stud drives the elbow anticlockwise. Rotating the end anticlockwise about the pivot carries it toward the disk centre.
- The end clears the band (distance > R + 0.154 + 0.126 = 1.70) only once it is within 38.6° of the pivot-to-centre line on the far side. That is a swing of 65.9°.
- The recorded return uses 22.1° (25.3° before this pass). Swinging a further 41–44° would drive the bar about 1.6 further left (2.044·(cot 86.6° − cot 127.2°)). The lug would then end at x ≈ −1.66, outside the stud orbit, so the next forward stroke could never begin.
- **Layout alternatives, both worse.**
  - Keep the drawn rest angle and a 25° release: the pivot would have to be raised about 0.75 (54 source px) above the disk centre, and the arm shortened.
  - Keep the pivot: the arm would have to rest about 40° above Brown's (lower arm pointing at the disk centre), about 34° off his drawing.
  - A curved arm does not help, because the drawn end point is the obstruction.
- Result: some depth relief is forced.

**Shrunk** (`src/simulation/mujoco-stud-reverser/geometry.js`, claimed):
- **Step halved: 0.24 → 0.12.**
  - The raised back face is now z 0.76 (was 0.80).
  - The stud pins end at 0.704 under a 0.03 end cap, so each stud ends at 0.734 (was 0.772 including the cap). The raised arm clears the whole stud by 0.026.
  - The driving pad's back face is 0.64 (was 0.56), overlapping the pins by 0.064.
  - The front face stays one flat plane.
- **Pad shape.** The pad is now a round striking boss: its inner edge is an arc concentric with the arm's rounded end (radius L − 1.4 = 0.267), replacing the square cross-step. The raised part is the arm minus the pad, with no gap.
- **Arc radius tried.** An arc that reaches the arm edges at 1.4 (r 0.295), or r 0.287, holds the stud long enough to throw the elbow over (lever at 4 rad, bar at −1.5). r 0.28 works but is marginal. So r 0.267 is used.
- **End-cap change.** A first attempt with a 0.01 cap depth-fought with the pin's end face (a hard chord across the stud end in close-up). The 0.03 cap is clean.

**Rebaked** with the documented chain:
- supported-prototype and fine probes (DT 0.000125);
- assembly, moving volumes, bake, and baked assembly.

Results:
- Sixth-cycle bar range 0.03828–1.02453 (was 0.0382–1.0245). The elbow swings −0.5097 to −0.1221 rad (22.1°).
- Cycle ends repeat to 3e-10.
- Assembly and baked assembly: 0 failing pairs (3.41 M and 3.42 M checks). Working soft contacts ≤ 1.5e-5.
- Moving volumes: 0 failing pairs.
- The bake has 6,001 samples, closes, and has updated provenance.
- `153-relieved-*` and `153-relief-contact.json` are documented historical evidence (commit 8a5acef) and were not regenerated.
- `docs/movement-153.md` was updated for the new depths, the proof and the new bar range.

**Screens:**
- Disconnected parts: 0 detached, 1 running near-miss (unchanged), 0 slivers or lips.
- Coincident faces: 0.
- Loop seams: 0.
- `screen-body-intersections` evaluates the legacy authored factory (Box/Cylinder), not the production bake. Its 0.143 stud-to-arm figure is from that unchanged legacy model.

**Captures** (`/dev/shm/p99/e/153/`):
- Before: `before-tile.png` (plate; phases 0, 0.33 and 0.66; yaw ±40; pitch ±25; side view) and `before-zoom.png` (arm close-ups).
- After: `after-tile.png` and `after-zoom.png` (the same views plus a stud-end close-up), `c.png` (side-on arm).
- The default view is unchanged. In rotated views the step is half as deep and reads as a round boss behind the arm's end.

**Tests:**
- `tests/stud-reverser-physics.test.mjs`: a new test checks a step of at most 0.12, that the raised arm clears the whole stud by at least 0.02, that the pad overlaps the pins by at least 0.06, the flat front face, and the pad arc concentric with the end. Passes together with `stud-reverser-baked.test.mjs`, 7/7.
- `models.test.mjs` 153 block: 1/1.

**Proposed ledger row:**
- Assessment: minor. The relief is still visible in rotated views, and it is forced.
- visibleFlaws: "The input arm's driving end is a round boss 0.12 deeper than the rest of the arm, visible in rotated views (forced: Brown's arm end lies on the stud orbit, so a flat arm would be swept about 66° where the return needs 22°)."
- Limits, append: "p99: relief halved (step 0.24 → 0.12; the raised arm clears the capped studs by 0.026, and the pad overlaps the pins by 0.064). The pad's inner edge is an arc concentric with the arm end. Stud end caps are 0.03. Rebaked: bar 0.0383–1.0245, elbow swing 22.1°."


## 370: mirror height on the bar (re-examined, still forced; no code change)

**Plate check.**
- Depth order:
  - The upper rail is in front of the bar: the bar's edges are dashed behind it.
  - The lower rail is behind the bar: the bar's end is drawn over it.
  - The mirror and ratchet are behind the bar: the teeth are dashed under it.
- Brown's proportions:
  - crank 83 px against a 452 px bar (0.184);
  - mirror centre at 0.726 of the bar from the top eye;
  - his pose is near the top of the stroke (crank at about 111°).
- From that pose his mirror centre falls about 160 px. It would pass 87 px below the lower rail's top edge, through the rail, and over the guide pins. His drawing does not work in any single depth order.

**Current model** (`depth.mjs`, `j.mjs`):
- The lower rail spans z −0.21 to −0.01 and y −1.75 to −1.41. The bar spans z 0.02 to 0.18.
- The stack behind the rail runs: click carrier (−0.28 to −0.24), ratchet (−0.44 to −0.30), mirror backing (−0.54 to −0.46).
- The mirror axle (r 0.105) and the click journal pin cross the rail's depth. The axle's lowest point is y −1.392, 0.018 above the rail top. The journal pin's lowest point is y −1.143, at x −0.88 to −0.68.
- The mirror sits at 2.85 of the 4.82 bar (0.59). The rail allows at most 2.87–2.89.

**Alternatives re-examined, with numbers:**
1. *Mirror between bar and rail (rail at the back).* The guide pins (±0.43, y −1.58) must reach the bar's depth through the mirror's layer. At 0.73 (3.52 from the eye) the mirror centre sweeps y −0.48 to −1.92, straight over the pins, and the backing's 0.85 half-diagonal hits both pins every stroke.
2. *Rail behind the bar with a hidden notch for the axle.* At 3.52 the axle bottom reaches y −2.03. That is below the rail's bottom edge (−1.75), and below the bottom of a rail at Brown's own 0.59 height (−1.86). So the notch would cut the rail in two.
   - Moving the mirror down 0.67 also takes the click journal pin and follower to y −1.81 at x ≈ −0.8. That is inside the rail, outside any notch the bar hides, and would need a second visible cut.
3. *Rail in front of the bar.* This reverses Brown's drawn overlap at the lower rail and hides the bar's lower end.
4. *Shorter bar.* The bar must reach the guide pins at the top of the stroke (eye to guide 4.62 plus the pin).
5. *Smaller crank.* Clearing the rail at 0.73 needs a crank of about 0.4 against 0.72, which is already smaller relative to the bar than Brown's (0.149 against 0.184).
6. *Thinner rail or axle.* This gains at most 0.04–0.08 (0.59 → 0.60), which cannot be seen.

**Also checked:** the mirror face mesh (z −0.22 to −0.14) dips into the rail's volume by up to 0.34 at phase 0.52, but it is `visible=false` (hidden). The rendered mirror is the backing, behind the rail. This is not a visible flaw.

**Captures** (`/dev/shm/p99/e/370/`):
- `b-sheet.png`: default phases 0 and 0.5, yaw +40, side, and yaw −40 with pitch +25.
- `c-sheet.png` and `c2-sheet.png`: the bottom-of-stroke clearance, from the front, side, top and behind.
- `plate-low.png` and `plate-top.png`: the plate's depth cues.

**Screens and tests.** No change. Disconnected parts: 1 "detached" group, the fixed lower rail with its pins and fasteners. It is a fixed frame member that Brown crops, 0.03 from the bar it guides, and it is unchanged because the file is untouched. Coincident faces: 0. Loop seams: 0. The body-intersection worst is 0.0606 within the telescoping follower (cylinder × sphere of one part). `movement-370` and `polishing-interfaces` pass.


## 377: the seated gait (improved; the core of it is forced)

**Plate.** Measured against the drum's outer board line (R ≈ 180 px, axle at y 298), Brown's man stands like this:
- cap at +1.32 R, hip at about +0.44 R;
- standing foot at −0.27 R, raised foot at +0.07 R, so the step is about 0.48 of his leg;
- standing leg straight and vertical, raised thigh horizontal.

The model already matches these heights (hip 0.75 above the axle, which is 0.45 of the 1.68 board-tip radius).

**Why a fully upright climb is impossible here.** Near axle height the radial boards are shelves spaced about 0.67 apart, and the shin is 0.70. A knee folded forward, toward the drum, therefore lands beside the next board up. The knee must stay outside the tip ring, so the hip has to stand 0.7 or more outboard of the feet, and the thigh reaches in toward the drum.

**Studies.** All are in `/dev/shm/p99/e/377/s/` (`opt*.mjs`, `grid*.mjs`, `refine3.mjs`). They use 2-D leg capsules against finite board rectangles, over the stance and the swing.

| Variant | Best mean planted thigh from vertical |
|---|---|
| Hip ≤ 0.95, legs 1.44 (as now) | 81–87° |
| Brown-proportioned legs 1.1–1.3 | 75–91° |
| 16, 18, 20 or 24 boards | 78–89° |
| Board depth 0.15–0.25, tips kept at 1.68 | 74–87° |
| Stance only, swing ignored (lower bound) | 71–85° |
| Hip 1.25–1.5 above the axle (cap +0.5 to +0.75 above Brown's) | 57–63° |

- The legs used in the 57–63° runs are shortened to 1.2 and the boards are shallower.
- Numbers near 57° only come from boards whose tips recede to 1.52 with the ankle past the tip, which isn't a real foothold.
- p84 and p95 reached the same conclusion from their own searches.

**Change.** Files: `src/simulation/treadmill-gait.js` (claimed; used only by 377) and `src/simulation/authored-person-treadmills.js`.
- **Gait function.** `treadmillLegState` takes optional `stanceFraction`, `footRadial`, `swingOut` and `swingUp`. Their defaults are the old constants.
- **New gait:**
  - hip 2.51 (was 2.50), at the same height;
  - touchdown 10° above the horizontal (was 18°) and lift-off about 17° below it, so the feet work around axle height as Brown draws them;
  - stance fraction 0.52 (was 0.60), which still keeps a foot on a board at every instant;
  - sole moved 0.03 outward on its board, so the heel sits at the board's edge and the whole sole stays supported;
  - swing out 2.0 (was 1.8).
- **Plate pose.** The board phase is re-set (wheel start 9.6°, was 14.4°) so that phase 0 is Brown's pose: one leg at the end of its stance, the other foot just set on the board above.
- **Result.** The mean planted thigh is 87° (was 98°). The legs now reach down to the boards instead of stretching far in toward the drum.
- **Rejected.** Standing on the ball of the foot (heel 0.165 past the edge) would give 83°. It was dropped because the sole would no longer be supported.

**Captures** (`/dev/shm/p99/e/377/`):
- Before: `btile.png` and `bside-tile.png`.
- After: `after-tile.png`, which shows the plate, phases 0, 0.036 and 0.072, yaw ±40, pitch ±25 and the side view.
- Default view at four phases: `dv3.png`. Row 1 is before, row 2 a rejected toe-standing variant, row 3 is final.
- Side strip: `strip.png`.

**Tests.**
- `movement-377`, `treadmill-gait-solids` and `treadwheel-working-solids` all pass (20/20). The minimum sole gap is 0.0005 and there are 1458 planted checks.
- Two tests were changed:
  - The touchdown-continuity test now reads the stance fraction from the model instead of assuming 0.60.
  - The derivative check uses a relative tolerance: near the straight knee the central difference is off by 1.6e-7 rad/s at 12 rad/s.
- `camera-catalog`, `authored-loader` and `source-presentation` pass.

**Screens:**
- Body intersections: worst solid 0.
- Coincident faces: 0.
- Disconnected parts: 0 detached. The one sliver is the existing jacket/head joint, unchanged.
- Loop seams: 0.
- No validation report or bake fingerprints either file.

**Integrator note.** `src/data/display-profiles.json` is claimed by p99-d. 377's knee speeds and motion bounds shift slightly with the new gait, so `node scripts/measure-display-profiles.mjs 377` should be run by that file's owner. camera-catalog passes as it is.


## 394 Parsons's endless rack: Brown's box teeth on the rows, with a zero-pressure-angle drive

**Finding (verified against the plate).** Brown draws the rows as square battlements, with tooth and notch each about half a pitch and notches about half a pitch deep. The ends are drawn the same way, and the pinion's teeth are boxy too. In the model, the p84 22.5° involute rows had trapezoid teeth whose tips narrowed to 0.31 pitch (`/dev/shm/p99/e/394/b-z.png`).

**Idea.** On a rack with a zero pressure angle, each rack tooth's tip corner lies on the pitch line. As the rack rolls, that corner traces an involute of the pinion's *pitch* circle. So a pinion whose teeth are exactly those involutes, with the base circle equal to the pitch circle and radial walls below it, is driven by the rack's corners along the pitch line.
- The rack teeth are then true rectangles: vertical walls, tips on the pitch line and half a pitch wide.
- The contact ratio is √(ra² − rp²)/p = **1.11** with the pinion tips 1.1m above the pitch circle.
- The force is purely tangential.

**Change** (`src/simulation/authored-parsons-racks.js`; module, tooth counts, path, flanges, rod and band outline unchanged):
- **`parsonsDesign` defaults:**
  - pressure angle 0, pinion shift 0.55m and addendum 0.55m, so the rack and ring tips lie exactly on their pitch lines;
  - dedendum 1.05m, so the notches are 1.6m (0.51 pitch) deep with flat roots;
  - end addendum 0.55m.
- **`parsonsMeshRatios`:** handles a zero rack addendum. It used to divide by sin 0.
- **Ends.** With 10 pinion teeth in 14-tooth ends, the pinion tips sweep the ring tooth corners outside the line of action. At zero angle the plain involute ends overlap by up to 4.2e-4 at 600 poses.
  - So each end is relieved by the sweep of the pinion itself, as a gear shaper would cut it. The sweep covers 900 poses over the end's arc plus 0.6 of an arc either side, taking in the adjacent row spaces, turned ±0.0015 (arc at the pitch circle) for running clearance.
  - The relief is generated offline by the new `scripts/export-parsons-geometry.mjs` and `scripts/generate-parsons-ends.py` (shapely), and written to the new `src/simulation/generated-parsons-ends.js` (2608 points, 53 KB). It holds the right end only; the left end is the same relief turned half a turn, since the path and tooth phase are symmetric under a half turn.
  - `parsonsRackVoid` adds the relief only for the default design (`endCarve`).
  - A digest of the pinion outline and path is stored in the generated file and checked by the test.
- **Shared code.** `involuteGearOutline`, also used by `authored-scroll-gears.js`, is untouched.

**Result:**
- The rows (28 of the 42 teeth) are now Brown's boxes. Tooth tips measure 0.49 pitch (half a pitch less backlash), against 0.31 before.
- Pinion tips measure 0.82m, against 0.84m before.
- Free play, as the largest turn at the pitch circle before touching, found by bisection at 600 poses:
  - rows: 0.0020, as before;
  - ends: 0.0013–0.0015;
  - rising to 0.0076 briefly at the four row/end junctions, where the p84 form reached 0.0028.
- There is 0 overlap at 1200 poses, checked with both shapely and polygon-clipping.

**Residual (forced).**
- **End notches.** They narrow outward, from about 0.6 pitch at the mouth to about 0.3 pitch at depth, before a square relief to the root. The ends looked like this before too.
  - Brown's box notches cannot be used at the ends. Parallel slots 0.16 or 0.20 wide, united with the generated relief, loosen the mesh to 0.017 or 0.023 of free play. The 10/14 internal mesh needs the pinion-generated shape.
- **Pinion teeth.** They still taper, from 0.5 pitch at the pitch circle to 0.26 pitch at the tips, where Brown's are boxes. This is needed for the involute action.

**Captures** (`/dev/shm/p99/e/394/`):
- `cmp-z.png`: the plate, the p84 close-up (before) and the new close-up.
- `a-tile.png`: the plate, the default view, yaw +40/pitch +25, and yaw −40/pitch −25 at phase 0.5.
- `a-zend.png`, `ends.png`: the end teeth.
- `a-p25.png`, `a-p75.png`: other phases.
- `bands.png`, `endzoom2.png`, `space.png`: 2-D plots of the band.
- `play.png`: the free play along the path, before and after.

**Checks:**
- `tests/movement-394.test.mjs`: 6/6 pass. It was updated as follows:
  - the contact probe now turns the pinion ±0.01 at the pitch circle, since radial growth cannot probe tangential contact at zero pressure angle;
  - the tooth-form test asserts rectangular notches with tips half a pitch wide less backlash, depth ≥ 0.5 pitch, and both contact ratios ≥ 1.1;
  - a new test checks the generated relief's provenance digest.
- `movement-395`, `camera-catalog` and `opening-camera-motion`: 12/12 pass.
- `check-loop-seams`: 0.
- `screen-disconnected-parts`: 0 detached, 0 slivers, 0 lips. The 5 near-miss pairs are the same count as before.
- `screen-coincident-faces`: 0.
- `screen-body-intersections`: worst solid 0.
- No report in `docs/validation` fingerprints this file.

**Proposed ledger row:**
- assessment: reasonable. The rows now match Brown. Whether the end notches' taper and the tapered pinion teeth count as a residual is for the reviewer; if they do, keep it minor.
- visibleFlaws: "" (or, if kept minor: "The toothed ends' notches narrow outward, about 0.6 to 0.3 pitch, and the pinion teeth taper to 0.26 pitch, where Brown draws boxes throughout.")
- limits, replace the "Pass 84 tooth form" clause with: "p99: zero-pressure-angle box rows. The rack tips lie on the pitch line, half a pitch wide, with notches 0.51 pitch deep. They drive the pinion's involutes of its pitch circle along the pitch line (contact ratio 1.11). The ends are internal gears of the same form, relieved by the pinion's own sweep (scripts/generate-parsons-ends.py, clearance 0.0015). Free play is at most 0.002 on the rows and 0.0015 at the ends, briefly 0.0076 at the row/end junctions. The end notches narrow outward: box slots 0.4–0.5 pitch wide loosen the 10/14 mesh to 0.017–0.023 of free play."


## 397: the crescent is Brown's slot arc (changed)

**Plate check.** Measured on `mm_397.png` (pixel centroids of the drawn holes; 79.7 px per unit):
- Rocker pivot (325.9, 406.0), crank centre (380.1, 241.3), drawn pin (298.9, 193.8), so Brown's throw is 94.1 px.
- The slot centreline (midpoints of the channel's inner edges, 15 rows) fits one circle of radius 93.4 px about (380.5, 239.9) px, with at most 0.6 px residual. It runs from 127° to 239° about that centre.
- So Brown's slot is an arc of his own crank circle, a true dwell arc. It spans 86–239 px from the rocker pivot, a radial span of 153 px. His crank carries the pin over 80–267 px (188 px). A closed slot of his shape cannot take his crank, so some misfit is forced.

**Before.** p84 used a circle through the pin's nearest and farthest points at rest (sagitta 0.8 of the throw). The crank centre was (0.575, 0.02) with throw 1.00. Its upper end sat on the pivot-to-crank line, so the slot curled right past Brown's stop.
- The misfits were: slot centreline Hausdorff distance to Brown's arc 48 px, crank centre 9 px and pin 9 px.
- Capture: `397/b-sheet.png`.

**Change.**
- `open-crescent-shuttle-motion.js` (claimed): `openCrescentShuttleLaw` takes an optional explicit `arc` ({center, radius} about the pivot, in the rocker's frame). The pin radius still selects a unique station, on the arc's counterclockwise branch. The default sagitta path is unchanged.
- `scripts/generate-open-crescent-shuttle.mjs`: exports `OPEN_CRESCENT_DESIGN` and regenerates `baked/open-crescent-shuttle.js` (claimed). The design comes from a minimax fit (`/dev/shm/p99/e/397/opt5.py`). It minimises the largest of three misfits (slot Hausdorff distance, crank centre, drawn pin) subject to:
  - near-rest of at least 27% of the turn;
  - creep under 0.1 rad;
  - swing of at least 0.9 rad;
  - both slot ends crossing the pin-radius circles at a finite angle (no knock);
  - the rocker exactly upright at the drawn pose, inside the near-rest.
- The result:
  - crank centre (0.4464, 0.0626), throw 0.9853, reference 142.7°;
  - slot arc radius 1.0676 about (0.5639, 2.0874) from the pivot;
  - misfits: slot 18.6 px, crank centre 18.6 px, pin 0.2 px;
  - restLean is now 0 (to 7e-10), so the traced S neck stands as drawn.
- `authored-intermittent-shuttle-drives.js` (claimed; it handles only 397) reads the design from the baked parameters.

**Motion.** Near-rest is 27.0% of the turn (it was 36.5%) with 0.02 rad creep. The rocker half-swing is 0.486 rad, and the table stroke is 3.85 (it was 4.01).

**Frontier.** Other optimum settings (`m5_*.txt`, `m4_*.txt`, `m_*.txt`):
- A near-rest of 30% costs a 20.3 px worst misfit.
- Keeping the crank centre on Brown's leaves the slot 25 px off.
- Matching the slot to 8 px moves the crank 28 px.
- Brown's slot exactly (Hausdorff 0) needs throw ≤ 0.96 (76 px) and gives only a 16% near-rest, with no upright pose inside it.

**Captures** (`/dev/shm/p99/e/397/`):
- `a-sheet.png`: plate, after default, before default, phases 0.25/0.5/0.75, and yaw +40 / yaw −40 with pitch +25.
- `a-zsheet.png`: plate beside zooms at phases 0, 0.55 and 0.7.
- `ov.png`: plate overlays. Red is the model centreline, green is Brown's arc and blue is the crank circle. Before is left; E (adopted) is in the middle.

**Screens.**
- Disconnected parts: 0 detached, 0 slivers, 0 lips. The 3 near-misses are unchanged: link to lug bore at 0.011, the boss/sill pair, and crank arm to rocker at 0.02 (moving).
- Coincident faces: 0.
- Body intersections: worst solid 0.0000.
- Loop seams: 0.

**Tests.** `movement-397` gains a p99 test:
- the slot Hausdorff distance to Brown's arc is under 19.5 px;
- the crank centre is within 19.5 px of Brown's;
- the pin is within 1 px of Brown's;
- the rocker is upright and resting at time 0.

The stroke threshold is now 3.8 (it was 4.0). These pass with `groove-drive-working-solids`, 398, 369 and 370: 39/39.

**No validation report fingerprints these files.** The pass-49 screen is historical and was not touched.


## 429 Holly's double elliptical rotary engine: the opening pose now has the rotor arms parallel, leaning up to the right as Brown draws them

**Finding (verified against the plate).** Brown draws both rotors' piston arms parallel, running from lower left to upper right at about 65° (left rotor about 67°, right about 65°, measured from the packing boxes to the shaft centres). At t = 0 the model had the left rotor's arms vertical and the right rotor's arms horizontal (`/dev/shm/p99/e/429/b-tile.png`).

**Constraint.** In the conjugate law the rotors turn at 1:−1, with major axes at π/2 + θ (left) and −θ (right). Their sum is fixed at π/2, and the source profiles are conjugate only at that quarter-turn offset (`sourceProfilePhaseConstraintResidual`). So the arms are parallel only when θ = −π/4 + kπ/2, which puts both arms at 45° or 135°.
- Brown's parallel 65° pose would need the sum to be 130°, which breaks conjugacy: the teeth would collide.
- Minimising the larger of the two rotors' angle errors also gives θ = −π/4, with each rotor 20° from Brown's.
- Non-parallel options are worse: the left rotor at 65° forces the right to 25°.

**Change** (`src/simulation/authored-double-elliptical-rotary-engines.js`). A new `openingInputAngle = −π/4` is added to the input angle in `stateAtTime` and exported in `geometry`.
- The rotors, steam, profiles, cycle period and loop are unchanged. The existing steam pop (the release reshaping) moves by +0.125 of the cycle, from 0.381 to 0.506. It was already there at HEAD (p90-ff and p96-ff).
- At t = 0 both rotors' arms now lean up to the right at 45°, parallel, with the packing boxes top-right and bottom-left as on the plate. The left rotor still turns anticlockwise and the right rotor clockwise.

**Captures** (`/dev/shm/p99/e/429/`):
- `b-tile.png`: the plate with the old phases 0, 0.125 and 0.875.
- `a-tile.png`: the plate with the new default view and the yaw +40/pitch +25 and yaw −40/pitch −25 views.
- `a-p3.png`, `a-p6.png`: later phases.

**Checks:**
- `holly-mating-profile`, `rotary-engine-427-429-solids` and `steam-seams-p88-s`: 14/14 pass.
- `docs/validation/429-mating-contact.json` was regenerated with `export-holly-contact.mjs` and `review-holly-contact.py`: 1025 poses, 0 overlap, gaps 0.0072–0.0122 (unchanged). Only the source hash changed.
- `screen-disconnected-parts`: 0 detached, 0 slivers, 0 lips.
- `screen-coincident-faces`: 0 flagged pairs.
- `check-loop-seams`: 0 seams; the steam pop that was already there has moved to phase 0.506.

**Proposed ledger row:**
- assessment: reasonable.
- visibleFlaws: "".
- limits, append: "p99: playback opens at θ = −π/4, the only conjugate phase where both rotors' arms are parallel. They lean up to the right at 45°. Brown's parallel arms at about 65° would need a 130° major-axis offset, which the conjugate profiles cannot mesh with."


