# Pass 86, lane p86-9: 82, 206, 214 and 225

Reviewer: Claude Opus 5.5, lane p86-9. Date: 2026-09-27.

These are the items lane p86-1 left open (see `docs/p86-1-review.md`). Captures are kept outside Git in
`/dev/shm/p86/p86-9/`:
- `before/tile-ID.png` and `after/tile-ID.png`: the plate beside the default view at four phases, ±60°, back, top and
  the seam phases (`cap.mjs` and `tile.py`, copies of the p84-e harness).
- `before/z82.png` and `after/z82*.png`, `after/z206*.png`, `after/z214.png`, `after/z225.png`: close-ups of each
  pawl or stop contact at several phases, including the hold. `zoom.mjs` can follow a point on a moving part.
- `inter.json`, `inter206.json` and `disc.json`: the intersection and disconnected-parts screens.

No factory changed which IDs it handles, and no report in `docs/validation` fingerprints a changed file.

## 82: one pawl on both arms, springs retuned, a loaded wheel, rebaked

**Complaint.** The two pawls should be the same.

**Before.** Each pawl was a spline band traced from its own drawing. The upper band ended square and the lower ended in
a horn. They were carried at different radii: 331 px for the upper and 313 px for the lower. p86-1 gave both the upper
outline, and the bake then failed to close a loop (best 1.76 px against 0.5 px).

**Geometry** (`mujoco-treadle/geometry.js`, `linkage.js`):
- **Pivots.** Both arms now carry their pawl at one radius, the mean of the drawn pivots (322 px). That is 9 px from
  either drawn pivot.
- **Pawl.** Both pawls are one plate, `treadlePawlOutline`:
  - a band of even width (0.07) between two concentric circular arcs, bowed away from the wheel as Brown draws it;
  - a round boss (r 0.108), bored for its pin;
  - an end cut along the tooth's steep face, whose inner corner (with a 0.002 chamfer) is the nose that seats in the
    root.
- **Built once, turned.** The outline is built with the pivot on the x axis and then turned to each arm, so the two
  pawls have identical vertices. The arm bosses at the pawl pins are also equal now.

**Why the loop would not close.** The two arms swing 18.4°, which is 1.33 pitch, in opposite phase. With a free wheel,
every split of the lost motion between the two pawls is a steady state. The system is neutral, so it drifts, and each
stroke advanced 2 to 4 teeth as the wheel coasted.

**Physics** (`physics.js`, `visual.js`):
- **Load torque.** A steady load torque (300) on the wheel stands for the work it drives. After each advance the wheel
  slips back onto the pawl that holds it. This is the ratchet backlash the brief asks for. The handoff now happens at
  a fixed phase, and the wheel advances exactly 2 teeth per treadle cycle.
- **Springs.** Both pawls carry the same torsion spring (stiffness 10, reference 0.45). It is drawn round each pin
  between the pawl and its arm, and its leg lies on the pawl along the band. A spring on the lower pawl only was
  already an accepted reconstruction; identical pawls now have identical springs.
- **Start angles.** The pawls start at their contact angles on the wheel (-0.0204 and -0.0164).

**Bake.** `bake-mujoco-movement.mjs 82` closes in one 4 s period, from 16 s:
- raw seam 0.0095 px and round trip 0.008 px;
- a 251 KiB asset, where the old one was 638 KiB and 5 periods;
- the provenance hashes are rewritten, and `mujoco-baked-loops` passes.

**Seating** (`nose82.mjs`, 40 samples per cycle after warm-up):
- The driving pawl's nose is 0.16 px from the root while it drives and holds. That is the chamfer.
- At the lower pawl's handoff, the nose is caught up to 2 px up the face and is back in the root within 0.05 cycle.
- The springs keep both pawls on the teeth as they return.

**Captures.** `after/tile-82.png`, `after/z82fl.png` and `after/z82fu.png` (each nose followed at 15 phases),
`after/z82both.png` (both pawls, their springs and rotated views).

**Tests.** `tests/mujoco-treadle.test.mjs`, 3/3:
- The engage/release test now requires each pawl to be seated in a root (nose < 0.5 px) in > 150 poses and to ride
  back over the teeth (nose > 5 px) in > 150 poses.
- It requires one pawl to hold the loaded wheel from its root at every pose after warm-up (worst 1.27 px).
- It requires every cycle to advance exactly two teeth.
- A new test checks that the pawls are one plate with identical vertices, both pivots are at one radius, both springs
  are equal and shown, and the nose is on the root circle.
- MuJoCo penetration is 0.14 px, and the rendered-outline minimum is -0.15 px.

**Screen note.** The intersection screen builds 82 from the authored fallback in `authored-intermittent-core.js`, not
the MuJoCo model. Its strap/treadle row (0.099) belongs to that fallback, which this lane did not change.

## 206: teeth raked as Brown draws them; both fingers seat in the root

**Complaint.** At the hold, the left pawl's end bore on the outer part of a tooth.

**The teeth were reversed.** Brown's hooked teeth have a long back rising to the tip and a short, slightly undercut
face that looks anticlockwise:
- the right pawl pushes those faces down;
- the left pawl hooks them up;
- the pawls return over the backs.

The model had mirrored this. Its fingers pushed the long backs, 0.43 and 0.28 of the way up, and the teeth were 0.33
deep (about twice Brown's) to keep that working.

**Change** (`authored-intermittent-core.js`, 206 only):
- **Teeth.** Root radius 2.21 (depth 0.17), with the back rising over a full pitch to a tip undercut 0.04 pitch
  (`toothOuterStartPhase` 1, `toothOuterEndPhase` 1.04). A close-up of the top of the wheel (`cmp206top.png`) matches
  the plate's rake and hook.
- **Seat.** Both fingers are solved to sit on the working face and 0.002 clear of the next tooth's back, 0.51 up the
  face. The finger's round end is what fills the root.
- **Nose.** Each pawl's nose is now a narrow finger that leaves the space straight through its opening (base half
  width 0.05, no face bias), so it reaches the root without touching the tips.
- **Backlash for the left pawl.** The left pawl pulls. At the end of its return it cannot come up and in under the
  hook by pivot motion and rotation alone. So, as the pin starts to rise, the loaded wheel slips back with the right
  pawl for 0.14 of a cycle (0.16 pitch, about 1°), while the left finger slides down the next tooth's back into the
  root. The left stroke then starts from that catch.
  - The calibration solves the amplitude with the catch pose.
  - Amplitude is now 6.72°, and the rising and falling advances are 2.34° and 4.45°.
- **Returns.** Each finger's return is solved once as a table: the finger follows its scripted lift but cannot pass
  through a tooth, so where one is in the way it rides it. Speed is capped.
- **Contact marker.** The white stop-contact balls on 214 are now hidden (see 214).

**Checks.**
- Intersections: worst 0.0001 at the running contact.
- Disconnected parts: unchanged (0 detached; the same 5 near-miss pairs).
- Finger clearance ≥ radius − 4e-7 over 32,768 states.
- No seam or pop.

**Captures.** `after/tile-206.png`, `after/z206L.png` and `after/z206R.png` (both noses at 8 phases, including the
holds), `cmp206.png` and `cmp206top.png` (rake against the plate).

**Tests.** `tests/movement-206.test.mjs`, 6/6, updated for:
- the new tooth constants and seat (0.002 clear of the back);
- the anticlockwise working faces;
- the amplitude and advance ranges;
- the slip stage (wheel speed ≥ 0, slip 0.12–0.2 pitch);
- advances measured from the catch;
- continuity at the catch handoffs.

The right contact is now 2.4° from Brown's point, where the tolerance was 2°. Brown's point is deep in its space.

## 225: the nose seats in the root

**Complaint.** The nose bore high on the steep face and never reached the root.

**Change** (`authored-intermittent-core.js`, `carrier-pawl-225-working-parts.js`):
- **Seat.** `carrierPawlFlank225` can now seat the nose. It solves the lowest point on the flank that keeps the nose
  0.002 clear of the previous tooth's long back. 225 uses this instead of 80% up the face.
- **Bar.** The pawl turns about 16° against the wheel through the drive, so a straight bar lying in the root would cut
  the tooth behind it. Its centre line is now one smooth cubic:
  - it leaves the hinge as the shallow arch it had (sagitta 0.17);
  - its end turns down along the tooth space's bisector (hook length 0.6);
  - widths are the same tapers, offset normal to the curve.
- **Return.** The return ride and the bar lift limit are unchanged.

**Checks.**
- The whole-outline clearance against the teeth is ≥ 0.00018 over the cycle.
- The intersection screen is clear.
- Disconnected parts are unchanged.

**Captures.** `after/tile-225.png` and `after/z225.png` (the nose followed at 8 phases).

**Tests.**
- `movement-225` 6/6.
- `carrier-pawl-225-contact` 6/6:
  - The face-moment floor is 1.3, down from 1.39, because the contact is lower on the face.
  - The body check follows the new centre line.

**Residual.** The downturned end reads as a slight hook where Brown draws a plain bar.

## 214: rounded finger ends

**Complaint.** The fingers ended in needle points.

**Change** (`authored-intermittent-core.js`, 214 only):
- **Round ends.** Each teardrop ends in a circle (r 0.18) whose far side keeps the finger's length. The flanks are
  the common tangents of that circle and the boss.
- **Stop solve.** The stops are solved as that circle tangent to the other finger's straight flank.
- **Contact vertex.** Each round end carries a vertex exactly at its stop contact, so the faceted solid touches there.
- **Stop positions:**
  - forward limit 8.325 (was 8.419) and reverse -28.103 (was -28.174);
  - 5.80 input turns between stops;
  - the blocking encounter is 1.27 rad short of the six-turn period.
- **Contact markers.** The white stop-contact balls are renamed `…-contact-marker`, so the plate-marker filter hides
  them. They are not drawn on the plate.

**Checks.**
- The intersection screen is clear.
- Detached parts drop from 1 to 0.
- `gear-finger-stop-working-parts` passes, including solid contact at both terminal stops and overtravel blocking.

**Captures.** `after/tile-214.png` and `after/z214.png` (both stops, and one rotated).

**Tests.** `movement-214` 5/5 (new limits, flank positions, closing rates, point count, and the round end touching the
flank at r 0.18) and `gear-finger-stop-working-parts` 5/5.

## Checks run

- **Tests.**
  - `mujoco-treadle` and `mujoco-baked-loops`.
  - `movement-206`, `-214` and `-225`, with `carrier-pawl-225-contact` and `gear-finger-stop-working-parts`.
  - The camera-fit test filtered to 82, 206, 214 and 225.
  - `authored-loader`.
- **Loop seams.** `check-loop-seams --ids=82,206,214,225`: 0 seams, 0 pops, 0 errors.
- **Intersections.** `screen-body-intersections`: 206 0.0001, 214 0, 225 0.
