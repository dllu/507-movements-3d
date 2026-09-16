# Remaining movements: family passes

The review queue is now **183–507, grouped into 20 component families** rather
than one drawing at a time. Every number has one primary queue owner; a family
assignment is not a claim that its existing simulation is correct. Previously
reviewed movements remain reusable references, with their documented residuals.
The executable inventory is [movement-batches.mjs](../scripts/lib/movement-batches.mjs).

## Passes

1. **Screen the whole queue.** Check construction, finite geometry/transforms,
   CPU update cost, geometry size and obvious source/motion discrepancies. Read
   the caption and check the original site's animation when one exists. Record
   unavailable animations instead of inventing an oracle. Fix crashes first.
2. **Correct shared components in batches.** Reuse solid worms, involute gears,
   conical bevels, bored joints, shafts, slots and ropes. Fix ratios, constraint
   closure, clearances, playback continuity and framing before decorative detail.
   Analytical gears and determinate linkages stay analytical.
3. **Solve contact-dependent families.** Use MuJoCo for catches, pawls, friction
   transfer, impacts and other genuinely passive degrees of freedom. Validate
   one reusable mechanism with contact-disabled and timestep controls, then
   validate each variant's changed dimensions/contacts. Bake expensive geometry
   and trajectories for browser playback. Similarity alone is not validation.
4. **Finish visual exceptions.** Extract irregular visible contours with the
   [CV tool](engraving-extraction.md), then fit intended circles, lines, sine
   waves or other mechanical curves. Reconstruct occlusions explicitly. Preserve
   mechanical intent instead of copying hand-drawn or perspective distortion.

For each family, publish the useful correction and a short residual list after
focused mechanism tests and browser inspection. Reserve exhaustive collision
sweeps and dense contour fitting for a specific unresolved contact or visible
failure. Do not keep an independent family waiting for one difficult latch.

## First parallel batch

- **195/207:** replace spring-like worms with one shared solid thread component;
  preserve analytical feed directions and tooth-count ratios.
- **220/230:** fix shaft/hub interference and full-cycle framing using shared
  shaft placement; retain analytical linkage constraints.
- **CV tooling:** threshold, contour hierarchy, ROI selection and simplified
  SVG/JSON extraction with overlays, keeping inferred edges separate.
- **Coordination:** inventory all remaining movements and run the cheap screen.

183–184 remains an explicit contact reconstruction exception. The local passive
quadrant prototype's first 36-second trial stalls on return (piston ends near
−0.593 instead of −1.388); it is not production and does not block these batches.
181–182's wider lower catch head also remains a source-fit residual.

## Running the screen

```sh
node scripts/screen-movement-batches.mjs
node scripts/screen-movement-batches.mjs --batch=worm-drives --out=/dev/shm/worm-screen.json
node scripts/screen-movement-batches.mjs --ids=195,207,220,230 --timeout-ms=20000
```

Each model runs in its own timed process, so one pathological constructor does
not block the queue or retain geometry in the next model. Output is checkpointed
after every movement in `/dev/shm` by default. Run against settled files; rerun
any entries affected by concurrent edits. CPU timing excludes module import,
GPU rendering and browser loading. Draw-call counts are estimates. Forty-nine
finite update samples catch gross failures, **not** clipping, contact correctness,
source fidelity or physics validity. Timing flags are triage thresholds, not
performance guarantees.

## Family inventory

<!-- Generated from scripts/lib/movement-batches.mjs; edit that inventory first. -->

| Family | Movements | Default method | Reuse candidates |
|---|---|---|---|
| catches-and-clutches | 183-184,186-189,217-218,247,251,253,267,277-278,280,360-361,385,415 | contact-bake | [mujoco-diagonal-catch](../src/simulation/mujoco-diagonal-catch), [finite-plate-geometry.js](../src/simulation/finite-plate-geometry.js) |
| valve-linkages | 185,418 | analytic | [authored-locomotive-valve-gears.js](../src/simulation/authored-locomotive-valve-gears.js), [authored-marine-valve-gears.js](../src/simulation/authored-marine-valve-gears.js) |
| screws-and-clamps | 190,260,266,275,285,366,379-382,389,399,493-494 | mixed | [bored-worm-geometry.js](../src/simulation/bored-worm-geometry.js), [mujoco-screw](../src/simulation/mujoco-screw), [mujoco-bench-clamp](../src/simulation/mujoco-bench-clamp) |
| noncircular-and-variable-gears | 191,196,201,205,208-209,219,221-224,414 | mixed | [noncircular-gear-geometry.js](../src/simulation/noncircular-gear-geometry.js), [stepped-sector-geometry.js](../src/simulation/stepped-sector-geometry.js) |
| mangle-and-reversing-racks | 192-194,197-199,216,269,371,394 | contact-bake | [mangle-gear-geometry.js](../src/simulation/mangle-gear-geometry.js), [mujoco-endless-rack](../src/simulation/mujoco-endless-rack) |
| worm-drives | 195,202,207,264 | analytic | [bored-worm-geometry.js](../src/simulation/bored-worm-geometry.js), [helical-gear-geometry.js](../src/simulation/helical-gear-geometry.js), [worm-wheel-profile.js](../src/simulation/worm-wheel-profile.js) |
| bevel-and-epicyclic-gears | 200,226,412,495,502-507 | analytic | [bevel-geometry.js](../src/simulation/bevel-geometry.js), [coaxial-gear-geometry.js](../src/simulation/coaxial-gear-geometry.js), [band-epicyclic-geometry.js](../src/simulation/band-epicyclic-geometry.js) |
| slots-and-crank-couplings | 203,210,220,230-231,252,268,273,279,282-283,348,350,354,401,417,419 | analytic | [authored-offset-crank-slots.js](../src/simulation/authored-offset-crank-slots.js), [linked-variable-crank-motion.js](../src/simulation/linked-variable-crank-motion.js), [mujoco-scotch-yoke](../src/simulation/mujoco-scotch-yoke) |
| friction-drives-and-brakes | 204,242,244,250,262-263,265,270,365,372-373,388,413 | mixed | [grooved-friction-geometry.js](../src/simulation/grooved-friction-geometry.js), [authored-cone-friction-drives.js](../src/simulation/authored-cone-friction-drives.js) |
| ratchets-and-indexers | 206,211-215,225,232-233,235-237,239-241,271,284,364,390-391,397-398,491 | contact-bake | [pull-pawl-geometry.js](../src/simulation/pull-pawl-geometry.js), [mujoco-reversible-click](../src/simulation/mujoco-reversible-click), [mujoco-rack-rectifier](../src/simulation/mujoco-rack-rectifier) |
| chains-belts-and-pulleys | 227-229,243,254-259,352,358-359,362,368,374,383-384,392,496 | analytic | [belt-geometry.js](../src/simulation/belt-geometry.js), [rope-kinematics.js](../src/simulation/rope-kinematics.js), [fusee-geometry.js](../src/simulation/fusee-geometry.js) |
| cams-and-followers | 272,276,281,286,400 | mixed | [mujoco-heart-cam](../src/simulation/mujoco-heart-cam), [mujoco-grooved-heart](../src/simulation/mujoco-grooved-heart), [wave-cam-contact.js](../src/simulation/wave-cam-contact.js) |
| escapements | 234,238,288-314,320-321,396,402 | contact-bake | [finite-plate-geometry.js](../src/simulation/finite-plate-geometry.js), [authored-deadbeat-escapements.js](../src/simulation/authored-deadbeat-escapements.js) |
| governors-and-inertial-devices | 274,287,315-319,355-357,369 | mixed | [mujoco-ball-governor](../src/simulation/mujoco-ball-governor), [mujoco-crossed-governor](../src/simulation/mujoco-crossed-governor) |
| drawing-and-measuring-linkages | 246,322-325,349,367,403-411 | analytic | [authored-linkages.js](../src/simulation/authored-linkages.js), [authored-drawing-instruments.js](../src/simulation/authored-drawing-instruments.js) |
| piston-guides-and-engines | 326-347,421-429 | mixed | [mujoco-crank-slider](../src/simulation/mujoco-crank-slider), [mujoco-scotch-yoke](../src/simulation/mujoco-scotch-yoke), [authored-beam-engine-parallel-motions.js](../src/simulation/authored-beam-engine-parallel-motions.js) |
| impacts-and-treadles | 351,353,363,375-378,416,420,470-472 | contact-bake | [mujoco-treadle](../src/simulation/mujoco-treadle), [wiper-stamp-geometry.js](../src/simulation/wiper-stamp-geometry.js) |
| spatial-and-folding-linkages | 245,248-249,261,370,386-387,393,468,489-490,492 | analytic | [authored-joints.js](../src/simulation/authored-joints.js), [authored-pipe-couplings.js](../src/simulation/authored-pipe-couplings.js), [rope-kinematics.js](../src/simulation/rope-kinematics.js) |
| water-wheels-and-fluid-rotors | 430-438,441-443,447,469,474,484-488,497 | fluid-analytic | [authored-horizontal-overshot-water-wheels.js](../src/simulation/authored-horizontal-overshot-water-wheels.js), [authored-screw-propellers.js](../src/simulation/authored-screw-propellers.js) |
| pumps-valves-and-fluid-storage | 395,439-440,444-446,448-467,473,475-483,498-501 | fluid-analytic | [authored-lift-pumps.js](../src/simulation/authored-lift-pumps.js), [authored-double-acting-pumps.js](../src/simulation/authored-double-acting-pumps.js), [authored-gasometers.js](../src/simulation/authored-gasometers.js) |

“Mixed” means analytical motion first, with native studies for the specific contact or dynamic uncertainty. Fluid models need explicit pressure/volume/flow assumptions; MuJoCo alone does not validate fluid behavior. Reuse candidates are starting points to inspect, not universally compatible drop-in parts.

## First screen results (2026-09-15)

All 325 authored factories constructed and produced finite geometry/transforms
at the 49 sampled poses. Movement 198 initially read an intermediate concurrent
save; its settled-file rerun passed. None exceeded the coarse triage thresholds.
This is a CPU-only sample on this workstation, run alongside other work; it does
not establish smooth GPU rendering or physical correctness.

| Measurement | Highest observed | Next candidates |
|---|---|---|
| Factory construction, excluding imports | 416: 264 ms | 196, 192, 193, 221 |
| 95th-percentile CPU update + world matrices | 320: 6.25 ms | 261, 352, 358, 390 |
| Estimated mesh draw calls, excluding shadow passes | 506: 438 | 507, 319, 436, 264 |
| Rendered model triangles | 188: 160,756 | 264, 507, 435, 506 |

The production build's initial main chunk is **26.31 MB (9.16 MB gzip)**.
`engine.js` and `model-loader.js` eagerly import the registry, which imports all
remaining authored families. Separating the application shell and loading the
requested family on demand is a shared loading-performance task. The CPU screen
excludes these imports and does not explain the reported browser slowness alone.
Bulk measurements remain in `/dev/shm/507-first-batch-screen.json`; rerun the
screen to regenerate them.

The first four corrected movements passed 29 focused component/movement tests;
the queue passed two coverage/parser tests. The production build passed. Browser
source comparisons and 17-pose desktop framing checks passed for all four; 230's
initial view now exposes both linkage planes. Their family review documents retain
unresolved wheel-contact and depth/clearance assumptions.


## Second parallel batch

- **200/226:** fixed 226's incorrect input pivot and shaft interference; removed
  200's unsupported frame and improved views. Fourteen focused tests pass.
- **231/273:** corrected shaft engagement and rebuilt solid pin joints with real
  bores; removed the unsupported 273 frame. Eighteen focused tests pass.
- **255–259:** shared bored lathe profiles, improved shoulders/grooves and source
  widths, groundless/fogless presentation. Forty-seven focused tests pass.
- **Loading:** [family-selective imports](family-loading.md) reduce the main chunk
  from 26.31 MB to 0.59 MB; all 507 route comparisons and packaged network/playback
  checks pass. Large legacy gears/intermittent chunks still need internal splitting.

These are correction passes, not family completion. Keep finite contact studies
moving in one parallel lane while other lanes clear shared geometry and source
mismatches. The source-animation check must inspect whether a usable animation
actually loads: 273 has one despite its static HTML's unavailable class.
