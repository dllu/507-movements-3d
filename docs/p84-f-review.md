# Pass 84, lane p84-f: 159, 170, 284, 358, 377, 397, 398

Captures are scratch files, not in Git. They are in `/dev/shm/p84-f/`:
- `base/`: before. Each ID has phases 0, 0.25, 0.5 and 0.75, ±60°, top and back, plus `cmpID.png` beside the plate.
- `a170/`: after. `cmp.png` shows the default view beside the plate. `t.png` has phase 0.44 plus the rotated views.
  `t2.png` shows maximum spread from four directions.
- `a170z/t.png`: close-ups of the bow ends at maximum spread.
- `a397/`: after. `cmp.png` shows the default view beside the plate, and `t.png` the phases and rotated views.
  `ovc.png` is the render warped onto the plate by pivot and top joint, with the plate in red.
- `s377/`: the 2-D gait study (`study.mjs`, `search*.mjs`, `refine.mjs`).

## 170: bow ends at Brown's length (changed)

- Measured on the plate, the bow's ends stand 0.68 rad (left) and 0.70 rad (right) from the spindle. The drawn arms
  cross the bow at about 0.52–0.6 rad. The model's ends stood at 0.86 rad, because each arm window had to cover the
  baked spread range (0.517–0.761) and the bow had to run past the window.
- Change (`mujoco-crossed-governor/solids.js`): the bow ends at 0.69 rad. Each arm window now runs out through the
  bow's end, so the window is an open-ended slot between the bow's front and back plates. At wide spread the arm leaves
  the slot past the bow's end, and it returns into the slot as the spread falls. The bow keeps its spindle seat and
  its full-depth front and back plates. The motion is unchanged.
- Rebaked with `node scripts/bake-crossed-governor.mjs`; only the geometry and its hash changed. Both `170-solid-clearance`
  and `170-baked-solid-clearance` were regenerated at 129 poses: no intersections, no unexpected contacts.
  `170-browser.json` already fingerprinted an older asset hash before this pass, and no script writes it.
- Evidence: `a170/cmp.png` shows the ends beside the plate. `a170/t2.png` and `a170z/t.png` show the arms passing out
  of the open slots at full spread and the slot mouths from above.

## 397: crank shared between Brown's pin and his slot stop; Brown's link length (changed)

- Brown's slot stops 238 px from the rocker pivot, but his crank (centre distance 174 px, throw 94 px) carries the pin
  to 268 px. The slot's radial range must equal the centre distance plus or minus the throw.
- Change (`authored-intermittent-shuttle-drives.js`, `scripts/generate-open-crescent-shuttle.mjs`, regenerated
  `baked/open-crescent-shuttle.js`):
  - Crank centre (0.575, 0.02), throw 1.00 and reference 145°. Before, these were (0.68, 0.07), 1.18 and 150°.
  - The centre is now 9 px from Brown's, and the drawn pin 9 px from his.
  - The slot's upper end reaches 3.10 units (≈245 px), so it runs 7–9 px past his stop, down from 30.
  - The 1.00 throw also matches the chord of Brown's slot (78–238 px, i.e. 2 × 80 px).
- Link: remeasured eye to eye on the plate, the link is 169 px (2.14 units), not 161 px. The swing falls from 65° to
  57°, so the top joint drops only 1.74 at full swing, and Brown's 2.14 link now clears that (36° off vertical). The
  lug now stands where Brown draws it. The bar was moved so that it still spans Brown's ends at rest.
- Motion: the near-rest fraction and creep stay within the test bounds. The table stroke falls from 5.1 to 4.10.
- Checks:
  - `show-body-intersections 397` (0.01, 129 samples): none.
  - The guide channel is overlapped by the bar throughout the stroke.
  - The test's end-to-end slot length threshold is now scaled by the crank throw (`> 1.9 × crankRadius`); it was
    fixed at 2.
- Residual: Brown's crescent is a shallower arc whose upper end lies over the pivot. The model's arc (sagitta 0.8 of
  the throw) curls about 12° further right at the top (`ovc.png`). A sagitta of 0.6 would cut the near-rest from 38%
  to 23% of the turn, so 0.8 was kept.
- Integrator note: the `397` motion bounds in `src/data/display-profiles.json` are now loose (max x 5.78 against about
  4.9). They were left alone because the file is shared.

## Re-examined and still forced (no code change)

### 159 slack cord
- The cord's crank-side length varies by twice the throw (150 px). The drawn pose sits 66 px of cord short of the
  pin's nearest approach to the pulley, and the treadle's eye has only about 9 px of drop left above the floor.
- A taut cord needs the treadle at 0.84 rad, against the floor limit of 0.35. A treadle short enough to reach that
  (≤141 px) would barely pass its own cord eye (138 px); Brown's is 297 px.
- Rerouting does not help:
  - Wrapping the cord on the disc rim or on the shaft only lengthens the far-side path. The deficit is on the near side.
  - Anchoring on the pulley does not change the path length.
  - Retying the cord shorter would lift the drawn treadle above its pivot.
- The slack therefore hangs where a real cord would, in the diagonal run.

### 170 is closed above.

### 284 slider 4 px low
- Brown's setting sweeps 1.16 teeth. With the drawn claw about 1.35 are needed.
- Remeasured, the teeth are uneven, with pitch 7.7–9.7° by side. The 44-tooth mean is kept.
- The alternatives each cost a larger visible change: a 14% longer crank (9 px at the pin) or a moved rod joint.

### 358 band and lower bar
- Band: the two cords must act at one groove station, side by side in a 0.152 pitch. That caps the radius at about
  0.036 (the model uses 0.032). Taking the cap would leave the groove with no lands.
- Brown hatches 8 wraps on the cone. Eight turns (pitch 0.19) would allow 0.04, but the fusee's ten turns are one per
  observation of the official animation's profile, and the tests pin that.
- Lower bar: Brown's lies 0.71 from the shaft, against the model's 1.44. At the crank's plane the bar must then lie
  1.09 below the shaft to clear the 1.3 crank sweep, which is below the 0.85 rail top the carriage rolls on. Brown's
  upper bar, at 1.43, matches.

### 377 gait
- Brown's boards: along the drum's visible half there are seven board intervals, about 55 px apart
  (y = 167, 223, 282, 338, 393, 438). That gives about 14 boards round the drum, the model's count.
- His step is about one board (stance foot at y ≈ 345, raised foot at ≈ 285), about 0.5 of his leg. The model's is
  0.57.
- The previous "closely spaced, about 30%" reading counted each board's hatching lines as separate boards. Count and
  step already match.
- Brown's upright stance cannot be kept clear of the boards:
  - The raised knee protrudes 0.26–0.44 toward the drum even for steps of 0.1–0.3 of the leg.
  - With radial boards near axle height, a knee that far in meets the board above.
  - A stepped drum with risers would keep the knee even farther out.
- Study (`s377/`, 2-D, legs as capsules against finite board rectangles):
  - 26,000 random candidates plus local refinement, varying board count 10–28, board depth 0.25–0.88, hip
    station, touchdown angle, stance fraction and swing arc.
  - With the hip no higher than 1.0 above the axle (Brown's cap only just clears the drum top), no clear gait gets the
    mean stance thigh below about 87° from vertical (current 98°), or its best below about 51° (current 66°).
  - Clear gaits with the thigh 33–36° from vertical need the hip about 1.77 above the axle. The cap would then stand
    at twice the drum radius, against Brown's 1.54.
- Not changed.

### 398 crank throw and direction
- Brown's groove runs 0.44–0.75 of the cam radius, so his roller stroke supports a throw of only about 0.16 R. His
  crank is 28 px, 0.33 R, about twice that.
- The model's groove is already deepened to 0.39–0.77 R to give 0.19 R. More would carry the valley into the hub.
- His roller sits at a lobe tip, the crosshead's nearest point, so the crank must point away from the crosshead.
  Pointing it up-left instead would turn the cam about 24°.

## Tests
- `node --test` on movement-397, groove-drive-working-solids, crossed-governor-baked, baked-motion,
  mujoco-baked-loops, authored-loader and source-presentation: 137 pass, 0 fail.
- `node scripts/check-loop-seams.mjs --ids=159,170,284,358,377,397,398 --all`: 0 seams above tolerance.
