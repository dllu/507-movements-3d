# Pass 78, lane p78-b: loose joints from the p74 screen (230, 231, 287, 336, 337, 393, 448, 449, 459)

Source: `docs/p74-disconnected-screen.md`, section "Minor, not confirmed". Captures are in `/dev/shm/p78-b/`, outside Git:
- `before/` and `after/`: `ID-default.png` and `ID-oblique.png` from `scripts/review-movement-source-views.mjs`.
- `c*.png`: close views at several phases and directions (`closeup.mjs`).
- `before.json` and `after.json`: `scripts/screen-disconnected-parts.mjs` for all nine IDs.

None of these movements has a MuJoCo bake, so nothing needed rebaking.

## 230 and 231: crank pins loose in their own crank eyes

**Cause.** The 0.04 "radial play" was not at a bearing. Each rear crank pin in 230, and each coupler pin in 231, is rigid with its crank. However, the pin sat in a crank eye bored to the rod-eye size, so it floated 0.042 or 0.048 inside its own crank. The pin-to-liner running clearance was 0.014.

**Change** (`authored-cranks.js`, scoped to `quadratureTwinCrankShaftCoupling` and `dragLinkDoubleCrankMotion`):
- The crank's pin eye is now bored to the pin radius, so each pin is fixed in its crank.
- The running clearance of the rod and coupler liners (`pinBearingClearance`) drops from 0.014 to 0.005.

**Screen.** Detached components fall from 1 to 0 (230) and from 2 to 0 (231). The remaining pairs are:
- pin against rod plate, where the liner fills the gap;
- shaft against crank, bridged by the hub;
- in 231, the 0.09 axial layer spacing between crank and coupler. Its test pins at least 0.079, and it is not visible in the plate view.

**Evidence.** `c230.png` and `c231.png`: every pin sits flush in its eye, including in the back views.

**Intersections.** Tests are clean. Faces are clean.

## 287: weight and leaf spring

**Finding.** No defect. Each weight is centred analytically on its spring's midpoint, where the spring passes through the weight. A 97-phase measurement puts the spring within 0.104 of each weight's centre (the capsule radius is 0.34), so the weight never leaves the spring.

The p74 flag of 0.09 came from the screen's measurement bug, fixed later in that doc, which measured deforming meshes in their last-phase shape. The current screen shows no weight or spring pair.

**Evidence.** `c287.png`: six phases and views. No code change.

## 336: side-lever rockshaft parallel motion

**Cause.** Every rod used the default bore of `makeBoredLinkRod` (0.105), which gave 0.021–0.028 play on pins of radius 0.077–0.084. The pins Q (on the parallel rod) and N (on the side rod) are rigid with their rods, but they floated in them. Lever bore O had 0.012 of play.

**Change** (`authored-marine-parallel-motions.js`, `sideLeverRockshaftParallelMotion`):
- Each eye is bored to its own pin: moving eyes at pin + 0.004, and fixed pins at pin + 0.0015.
- The lever bore is now shaft + 0.004.
- The layer gaps are closed:
  - The parallel rod moves from z 0.37 to 0.40, the side rod's layer. The two never overlap.
  - The crossbar moves from z 0.68 to 0.585, so the gaps between the layers are now 0.015 instead of 0.11.
  - Pins M, N and Q were re-lengthened to stay proud of their outer rods.

**Screen.** Detached components fall from 4 (1 floating) to 0. The remaining pairs are fixed-frame spacing only (standard, diagonal and flange).

**Intersections.** None at 0.01 spacing over 129 samples.

**Evidence.** `c336.png`.

## 337: midpoint vibrating-rod parallel motion

**Cause.** The same default bores gave 0.021–0.033 play, and pin D floated in its own radius rod. The beam bore at O had 0.02 of play. The layers stood 0.08–0.13 apart.

**Change** (`authored-vibrating-rod-parallel-motions.js`, `midpointVibratingRodParallelMotion`):
- The bores are fitted as in 336. The C eye is now bored for C's own radius (0.20 s), not 0.22 s.
- The beam boss bore is shaft + 0.004. The body's hidden hole allows for its 0.009 bevel.
- The layers are restacked:
  - vibrating rod at z 0.33 (was 0.39);
  - radius rod at z 0.54 (was 0.70);
  - piston and crosshead at z 0.74 (was 0.90).
- The pins are shortened to match. Pin C now stands 0.01 proud of the crosshead face, which removes a pre-existing coplanar z-fight (the starburst in `c337.png`, before this fix).
- The gland of the cylinder below the crop is 0.078 (was 0.10) around the 0.074 rod corner.

**Screen.** Detached components fall from 5 (4 floating) to 0.

**Intersections.** None. Faces are clean.

**Tests.** `movement-337.test.mjs` pinned the old z values, and they were updated.

## 393: lens-polisher pad

**Change** (`authored-lens-polishers.js`): `renderContactGap` drops from 0.028 to 0.004. That is enough to cover the sphere faceting (0.0007) and the flat index discs, which are removed in presentation anyway.

**Screen.** The pad-to-lens gap falls from 0.028 to about 0.004, and the lens group is no longer detached.

**Intersections.** None. **Evidence.** `c393.png`: the cup is seated in three views.

## 448 and 449: check valves

**Cause.** The bucket checks (448 and 449) and 448's lower check were bare discs, translated up and down with nothing holding them. Brown draws every check as a flat clack plate with a raised dome:
- 448's lower plate has its knuckle at the right;
- 448's bucket plate is tipped up on its right;
- 449's lower plate and 449's delivery plate are hinged at the left.

**Change** (`authored-lift-pumps.js` and `lift-pump-working-parts.js`):
- All three are now hinged clack flaps on a pivot group:
  - 448's lower flap: radius 0.40, hinge at x +0.40, opening 30°;
  - both bucket flaps: hinge at x −0.29 on the bucket seat ring, opening 30°.
- The state gains `footFlapAngle` (448) and `pistonFlapAngle` (both). The lift fields stay for reference.
- A shared `clackHinge` helper (pin, bored lug, two journals) now builds:
  - 449's existing lower-flap hardware, unchanged;
  - 448's mirrored lower flap, with its seat-ring lug recess mirrored;
  - a smaller bucket version (pin 0.02, journals at z ±0.22), carried by the bucket.
- The front journals are hidden by the section, as before.
- Brown's domes are added to every flap, including 449's delivery flap (`addDome`, a closed turned solid, sectioned with the rest).
- 448's retired decorative cross-pin is no longer built.

**Tests.**
- `lift-pump-working-solids.test.mjs` now checks the hinge, lug, journal and dome pairs for both pumps through 65 poses.
- Its seat-orientation probe moves across the hinge axis to the retained back half (z < 0), away from the lug recess.
- `movement-448` and `movement-449` now assert the flap parents and angles instead of the old disc lifts.

**Screen.** In 448, the floating checks fall from 2 to 0. In 449, the floating bucket check is gone. The one remaining detached group in 449 is the delivery riser. It stands 0.031 off the barrel's side port, and that is not in scope here (see residuals).

**Intersections.** Only fluid pairs and zero-depth seat contact. **Seams.** Clean.

**Evidence.** `after/448-default.png`, `after/449-default.png`, `c448b.png` and `c449b.png`.

## 459: worm and star pins

**Finding.** The 0.054 is the designed free window. At mid-exchange the worm swings between the wheels, and its thread must clear both pin rings (engagementShift − pinReach − threadReach ≈ 0.045).

A 90-phase measurement of thread against star found a real fault in engagement, but it was the opposite of play: the 0.2-deep square pins cut into the helix off the mesh plane by up to 0.014. Also, the thread tube (inner radius 0.145) floated 0.016 off its 0.129 core.

**Change** (`authored-reciprocating-well-lifts.js`):
- The star plate is 0.10 deep (was 0.20). The engaged pins now run 0 to 0.006 off the thread flank, with no overlap.
- The worm core is 0.149, so the thread is formed on it. The pin tips clear the core by 0.0055.
- The pin width, pitch and timing are unchanged.

**Intersections.** Run at 0.02 spacing over 65 samples, because 0.01 runs out of memory on this 86-mesh model: no star or worm pair. The only solid pair is the pre-existing 0.001 of the tappet crank pin in its arm eye.

**Evidence.** `c459b.png`: the engaged pin rests on the thread.

## Residuals

- 449: the delivery riser passes the barrel's side port with 0.031 of clearance (port half-height 0.34 against the pipe's outer radius of 0.30). This predates this pass and was not in the listed items.
- 448/449: the water section's cut faces are coplanar with the solid parts' cut faces, which gives a fine diagonal z-fight hatch at high zoom. This is family-wide and predates this pass.
- 448/449: the dome poles produce degenerate zero-area triangles (about 77 per dome). They are invisible, and the same thing happens with other r = 0 turned solids.
- 336: the rockshaft standard and diagonal frame keep their fixed spacing and z-fight (pre-existing).
- 459: the 0.045 thread clearance at the free-window crossing is by design.
