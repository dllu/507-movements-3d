# Pass-51 lane m3-mujoco-cams: minor residuals in 48, 55, 93, 94, 108, 113, 116, 118, 119, 120, 137, 147, 150, 156, 163

Reviewer: Claude Opus 5.5 (lane m3-mujoco-cams), 2026-09-24. I captured each ID with
`scripts/review-movement-source-views.mjs` from a private non-watching dev server,
before and after each change. For moving changes I also took eight-phase captures of
the default view. Live MuJoCo rows were checked with their native test files; the
registry-based `show-body-intersections.mjs` screen does not load those production
models.

## 48 — jaw clutch

- **Change:** the jaws are now symmetric rounded waves. Each tooth is a half-ellipse
  crest (0.08 deep) on two short axial flanks, so both sides of every wave read alike.
  Before, one side was straight and the other a cosine. `jawHeight` is 0.23 and the
  tip-meeting shift is 0.22. Only the axial bands carry the drive.
- **Motion:** the collar now withdraws in one smooth ramp (phases 0.65–0.86).
  Release happens when the rounded crests reach the ends of the axial bands, at phase
  0.69, while the collar is already moving. The coasting output lags only as fast as
  the crests clear. The new `flankOverlap` state field reports the axial engagement.
- **Shared helper:** `jaw-clutch-geometry.js` gains an optional `toothStations` input.
  Existing callers are unchanged.
- **Tests:** in `tests/jaw-clutch.test.mjs`, the flank-contact rays now aim at the
  centre of the engaged axial band. The "coast only after withdrawal" check now uses
  `flankOverlap`. The surface penetration test still covers the rounded crests while the
  output coasts. All 8 tests pass.
- **Screen:** 0.01/129 gives coaxial 0.0020 (pins in their 0.002 bores) and solid 0.
- **Residual:** the spaces between crests are flat. Brown's troughs are rounded, but a
  raised trough would leave T-junctions in the shared jaw generator's side walls.

## 55 — coaxial gears

- **Change:** A and B now have stub involute teeth (addendum 0.85, dedendum 1.25) and
  ring C has addendum 0.075. The tips are flat lands rather than points, so the teeth
  read squarer.
- **Tests:** all 4 tests in `tests/coaxial-gears.test.mjs` pass: working contact gaps
  stay between 1.5e-5 and 5e-5 with compressive torque, and clearance holds.
- **Screen:** no solid pairs.
- **Residual:** the teeth are still involutes. Truly square teeth cannot mesh, and a
  10-tooth pinion below 25° undercuts and loses continuous contact.

## 93 — Scotch yoke (live)

- **Change:** the lower stem now ends in a loop, as Brown draws it: a ring of radius
  0.19–0.27 fixed to the yoke in the stem plane. At the plate's pose it frames the shaft
  end. The shaft and hub stop at z = 0.18, in front of which the loop rides clear,
  sliding across the disk face through the stroke. It keeps at least 0.066 from the
  wrist pin.
- **Guide:** the reconstructed lower stem guide and crossbar stood in the loop's path,
  so they were removed. The upper guide carries the ideal slide, and the posts now run
  from the shaft support to the upper crossbar. None of these parts are presented.
- **Tests:** all 4 tests in `tests/mujoco-scotch-yoke.test.mjs` pass, including the
  ten-turn finite-solid clearance audit.
- **Residual:** the upper stem is longer than Brown's. It needs that length to reach
  its reconstructed guide.

## 94 — variable crank (live)

- **Change:** the slotted plate is opaque. Presentation-only ink dashes (no mass, not
  parts) trace the whole outline of the hidden groove, including the outer end and the
  curled inner tail with its cap, as Brown dashes them. They ride with the spiral plate
  and are redrawn each frame only where the slotted face is solid. Through the slots
  the real groove shows. The capture matches the plate's dashed spiral closely.
- **Tests:** all 4 tests in `tests/mujoco-variable-crank.test.mjs` pass.
- **Residual:** a dash appears or vanishes whole as it crosses a slot edge.

## 108 — reverse-thread barrel (live), no change

Brown draws straight crossing grooves at about 25° to the horizontal, with five front
crossings. For a circular barrel of the drawn width, a double helix with five front
crossings has a lead of 42.8 px. That projects to 8° slopes at the centre, steepening
into sine curves at the edges. Brown's slope would need about 85 px of lead, which gives
only 2–3 crossings. The plate therefore contradicts itself, and the chevron look is
forced. I tried no alternative lead, because the crossing count is the measured
feature.

## 113 — rack and pinion (live)

- **Change:** the table's stroke amplitude is now 0.28, down from 0.70. At either end
  of the stroke both of Brown's rollers stay under its flat underside, with a margin of
  0.04 or more. The table no longer rides off the right-hand roller.
- **Tests:** in `tests/mujoco-rack-pinion.test.mjs`, the stroke checks now use
  `f.amplitude`. The old "rollers coast after the slide departs" test asserted the flaw.
  It is replaced by a test that both rollers stay covered and roll with the table
  (slip < 0.02). All 6 tests pass.
- **Residual:** the stroke is smaller, with ±31° of pinion swing.

## 116 — rack rectifier (live)

- **Change:** both pinions and both racks now use a 14.5° pressure angle with stub
  proportions. The +1-shifted pinion has addendum 0.42 and dedendum 1.35; the racks
  have addendum 1.25 and dedendum 0.62. Both show broad flat lands, and the contact
  ratio is about 1.35. The pinion reads as a square-toothed gear, as on the plate.
- **Tests:** all 6 tests in `tests/mujoco-rack-rectifier.test.mjs` pass. After 2 s the
  output speed stays within ±0.03 of π/3, and the rack/pinion error is 0.0006.

## 118 — stroke doubler, and 119 — endless rack (live)

- **Change:** the camera now fits the whole swept silhouette, with no crop. Brown draws
  118's racks and 119's toothed rack body whole. Only 119's end rods are broken off, so
  they are still excluded from the fit and may leave the frame (maxNdc 1.07 on the rod).
- **Tests:** all tests in `tests/mujoco-stroke-doubler.test.mjs` and
  `tests/mujoco-endless-rack.test.mjs` pass.
- **Residual:** 118 is small in the square view, because the upper rack travels twice
  the pitman stroke each way.

## 120 — segment clamp (live)

- **Change:** the default stroke is 1.8 rad, up from 0.8. The jaws meet at about
  1.70 rad of input, with 25° and 28° of jaw swing. The command therefore closes them
  against native jaw contact at the torque limit, holds, and reopens, as the caption
  says: "brought together with great force". The pinions stay at least 20° and 7°
  inside the external and internal tooth arcs.
- **Tests:** the default-stroke test now checks jaw contact in both cycles, a stall
  input of 1.68–1.72, and the tooth-arc margins. All 7 tests pass.
- **Audit:** `audit-segment-clamp-clearances.mjs` over 21 poses finds 0.047 px of
  working-tooth and jaw contact and no unintended overlap.
- **Residual:** closing swings both jaws about 25°, so the lower loop's side passes
  behind the gears. The two are separated in depth.

## 137 — expansion eccentric (baked)

- **Change:** `expansion-eccentric-profile.js` holds a new conjugate cam. The design
  starts from an odd-harmonic fit (eccentric plus three lobes) to the visible
  landmarks. It is then corrected iteratively in 12 harmonics for two-roller
  conjugacy with the pivoting fork.
- **Result:** landmarks fit to 3.93 px RMS (8.90 max); the old cam gave 4.8 and 11.2.
  The edge is a rounded three-lobed curve, and the rollers now swing through 39 px a
  turn instead of 28. With the upper roller on the cam, the lower roller stays within
  −0.026 to 1.216 px of it. The old range was −0.04 to 0.65: the lobes cost about
  0.6 px of play.
- **Test and rebake:** the profile test threshold is now 1.3 px, and a new check
  requires a fork swing of at least 36 px. I reran the probe (timestep 0.00025,
  period 8, 32 s) and rebaked: loop seam 0.00006 px, penetration 0.026 px. Both rollers
  turn in the bake (upper −16.1 and lower −36.8 rad per loop).
  `docs/validation/137-physics-prototype.json` was regenerated; refinement differences
  are at most 0.028 px.
- **138:** `authored-cams.js` did not change, so 138 needed no refresh.
- **Residual:** Brown's sharper dimples are smoothed to rounded lobes, because no rigid
  two-roller fork can follow them.

## 147 — fan governor (baked)

- **Change:** the ramps now sit in one continuous dish. Visual-only rim segments close
  the ring between the two working ramps, each rising smoothly to the next ramp's
  crest. A solid floor replaces the four spokes. The working ramp cells and the
  physics are unchanged: roller contact stays at angles −0.90 to −0.22 on the ramps.
- **Validation:** I reran the fine cycle probe. Its samples are byte-identical to the
  baseline (sha 2035e92b…). `review-fan-governor-assembly` over 65 poses finds
  874M checks and 0 failing pairs. I then rebaked (9 meshes) and regenerated the
  surfaces, refinement, speed-cycle and speed-cycle-fine reports.
- **Tests:** all tests in `tests/fan-governor-*.test.mjs` pass.
- **Residual:** the dish rim is asymmetric, because the two sawtooth ramps rise to
  their crests. Brown draws a symmetric concave arc.

## 150 — selectable cam valve

- **Change:** the rear-face profile outlines are hidden. Each cam is now drawn once, by
  its front edge, which halves the dark rims of the "ribbed barrel". The keyed hub
  standing proud of the stack is coloured like the cam sleeve instead of black.
- **Camera:** a more nearly end-on camera changed almost nothing, so the camera is
  unchanged.

## 156 — slotted elbow

- **Change:** `sampledMotionBounds` now fit the camera to the whole swept linkage.
  Before, the authored box cropped to the initial pose. The upright slotted end and the
  lowest rod stub stay in view: maxNdc is 0.92, down from 1.12.
- **Tests:** the slotted-elbow and movement-156 tests pass.

## 163 — belt governor (baked)

- **Change:** the nested inverted-U brackets now stand in the spindle plane, between
  the belt's two runs, so the belt and pulleys pass in front of their legs as on the
  plate. The top bars part round the spindle (bore 0.116); the spindle hides the gap
  from the front. Only the outer bar's right end deepens forward to seat the
  bell-crank pedestal.
- **Rebake and clearance:** I rebaked (qualification unchanged). The baked and native
  solid-clearance reports find no intersections.
- **Tests:** mesh and part counts are now 51 and 50, up from 50 and 49.

## Files

**Production:**
- `src/simulation/jaw-clutch.js`, `jaw-clutch-motion.js`, `jaw-clutch-geometry.js`
  (optional input only)
- `coaxial-gears.js`
- `mujoco-scotch-yoke/geometry.js`
- `mujoco-variable-crank/{geometry,visual}.js`
- `mujoco-rack-pinion/geometry.js`
- `mujoco-rack-rectifier/geometry.js`
- `mujoco-stroke-doubler/geometry.js`
- `mujoco-endless-rack/geometry.js`
- `mujoco-segment-clamp/profile.js`
- `expansion-eccentric-profile.js`
- `mujoco-fan-governor/geometry.js`
- `mujoco-belt-governor/solids.js`
- `selectable-cam-valve.js`
- `slotted-elbow.js`

**Bakes:** `baked/assets/{137,147,163}.json.gz` and their provenance files.

**Validation:** `docs/validation/137-physics-prototype.json`,
`147-{candidate-assembly,candidate-surfaces,refinement,speed-cycle,speed-cycle-fine}.json`,
and `163-{baked,solid}-clearance.json`.
