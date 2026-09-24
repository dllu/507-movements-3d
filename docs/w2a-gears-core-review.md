# Pass-51 wave-2 lane w2a-gears-core review

Scope: 31, 32, 37, 116, 118, 119, 123, 139, 142, 191, 192, 195, 196, 199,
201, 202, 205, 208 and 226, plus removal of undrawn white index marks from
every movement whose production route is `authored-gears-core.js`.
Every change was checked in `scripts/review-movement-source-views.mjs`
captures beside the engraving.

## Shared change: undrawn white marks

`createAuthoredGearCoreMovement` now hides every white index stripe, dot,
belt marker and contact marker the plates never draw (24–46, 133, 191–210,
216, 226, 239). Marks stay attached as invisible rigid references, and their
visibility is pinned off so update code that toggles contact markers cannot
show them again. The exceptions are parts Brown draws: 208's axial pins and
201's slot roller. Marks a `source-presentation` entry already removes by
role (for example, 216's) are left for that entry. 113–125, 139 and 142 keep
their markers in the synchronous authored studies because production runs
from MuJoCo or baked modules. 45's painted groove index was removed from the
vertex colors (`grooved-friction-geometry.js` now paints only when it is
given an `indexAngle`).

## Per movement

- 31: the worm's size matches the plate (diameter about 0.22 of the wheel,
  length about 0.36). The thread still has a standard trapezoid section, not
  Brown's thin ribs, and the teeth are worm-generated. Thinning the section
  would break the validated loaded-flank contact. Residual.
- 32: indices hidden; `hideGround`.
- 37: cone slope 0.5 → 0.42 (`conical-stud-geometry.js`, profile rebaked with
  `scripts/bake-conical-stud-profile.mjs`). The stud body is now a frustum
  with a flat top of radius 0.15, not a point. The speed ratio still exceeds
  6.5:1. `hideGround`.
- 116: face-on camera; `cameraDistanceScale` 1.22, so the sliding frame stays
  in view (maxNdc 1.18 → 0.97).
- 118: face-on camera. The subject stays small because the upper rack travels
  twice the pitman stroke, and the fit must contain that sweep.
- 119: face-on camera. The fit follows the rack and beams but not the long
  rod, which Brown breaks off at both edges, so the subject is larger and the
  rod ends leave the frame at extremes.
- 123: face-on camera. The rack's vertical sweep still sets the scale.
- 139: `source-presentation` removes the pinion bearing post, floor plank and
  roller posts. The fixed bearings stay hidden behind the carriage and wheels.
- 142: the presented connecting rod is a stub broken off 1.05 below its eye.
  The slider, shoe and guide bar are removed, and the camera fits the disk and
  stub, so the disk fills the view as drawn. This is done at runtime in
  `baked/silk-traverse.js`; the bake still holds the full rod.
- 191: face-on camera; boss radius 0.245 → 0.36; shafts cut off just proud of
  the bosses.
- 192: face-on camera; boss radius 0.19 → 0.34; shaft shortened. The input
  pinion stays because it drives the wheel, although the plate omits it.
- 195: indices hidden. The worm-generated scalloped valleys still differ from
  Brown's schematic rectangular slots. Residual.
- 196: face-on camera. The rail, tall post and pinion-B standard are replaced
  by the plate's tapered pedestal on a block under the arm pivot. Gear A stays
  the fitted 28-tooth harmonic profile, less elongated than Brown's lobed
  outline. Reshaping it means refitting the A–B spacing and regenerating the
  offline profile. Residual.
- 199: the spoked lantern side rings are now solid bored side plates, with
  brass pin ends; the guide rollers are plain discs.
- 201: face-on camera; belt and pulley indices hidden.
- 202: face-on camera; fit box now contains the flared worm (it was cropped at
  the bottom); wheel shaft shortened. The worm's flare and the fine wheel teeth
  remain. Residual.
- 205: each front-series tooth carries a brass face bar running in across the
  wheel face in front of the cam plane. The front series now reads as long
  bars and the rear series as short stubs, alternating as drawn.
- 208: face-on camera; `cameraFov` 10, so the pins read end-on as circles;
  pitch-circle guides, the dark index pin and the contact marker hidden. The
  pinion stays a thin slotted web, not Brown's wider lantern strip. Residual.
- 226: face-on sectional elevation; `cameraFov` 12. Added hand knob B, E's crank
  plate and F's end wheel, as the plate draws them. The undrawn upper bearing is
  removed, and B's shaft is shortened to start inside its hub.

## Validation

Reports whose fingerprints cover the changed files were regenerated:
`191-196-201-contact`, `200-226-bevel-solids`, `202-264-worm-solids` and
`205-208-209-contact`.
