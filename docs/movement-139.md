# 139: internal-rack tooth and source review

The [source caption](https://507movements.com/mm_139.html) describes a rack that
slides vertically inside a horizontally translating rectangular carriage. A
continuously rotating pinion engages alternate sides. The page has a 2D animation,
but its geometry is not identical to the engraving.

## Verified defects in the current browser model

The browser uses twelve trapezoidal pinion teeth and repeated trapezoidal rack
teeth. Intersecting their nominal, un-beveled polygons after applying the actual
scene transforms detects overlap at all 360 sampled poses. The worst intersection
area is 0.113642 world units squared during the left-end handoff. Their axial
working depths overlap, so these are solid intersections rather than harmless
projected overlaps. Bevels are excluded; the report consequently understates
interference. See [the hashed tooth review](validation/139-tooth-review.json).

Enlarging the original engraving shows **nine pinion teeth**, with one pointing
downward in the pictured pose. The source animation's pinion has eight teeth
(eight pairs of outer vertices spaced 45 degrees apart). The existing browser
has twelve. The animation can therefore guide interpretation of the motion,
but cannot serve as the exact tooth-count or silhouette oracle.

The pictured pinion engages the lower row near the middle of the rack. The
legacy starting phase, 0.24, instead engages the upper row and displaces the rack
sideways. In its ideal three-revolution path, phase 2/3 puts the pinion at the
centre of the lower row. Frame, rack and suspension dimensions still require
measurement; the legacy assumption that the end pitch radius is exactly twice
the pinion radius must not be treated as a measured fact.

## Generated-tooth prototype

`mujoco-internal-rack/profile.js` now generates a nine-tooth pinion with rounded
rack-cutter roots and involute working flanks. Sweeping an enlarged copy of that
pinion through the ideal pitch path cuts a conjugate internal opening. This
replaces independently guessed teeth with a matched pair, including the joins
between straight travel and rounded-end handoffs.

The initial experiment retained the legacy pitch dimensions; the measured
replacement below supersedes those dimensions. It uses 1,024 generating poses,
64 samples per pinion tooth, 2,048 rack-cutter steps and a 0.0008-unit radial
cutter allowance.
At 720 separately offset verification poses, no nominal polygon intersection is
detected. The result is one connected rack body with one connected opening.
The generated shape has been rendered and visually inspected. Its bulk polygons
and preview remain in `/dev/shm`; only the generator and compact results are
committed. See [the generated-profile report](validation/139-generated-profile.json).

Tests independently count nine outer tooth tips, check between-sample clearance
at another phase grid, and check continuity of the ideal pitch path. These
results establish geometric clearance on that path. They do **not** establish
passive tooth-driven motion, contact retention, preload, linkage force balance,
source proportions or the adequacy of the reconstruction's hidden supports.
The browser still loads the old implementation.

```sh
node scripts/review-internal-rack-carriage.mjs
node scripts/prototype-internal-rack-profile.mjs
node --test tests/internal-rack-profile.test.mjs
```

The dimensional and first native-contact work is recorded below. Final hardware,
convergence, baking and packaged playback review remain. Do not advance to 140.

## Measured dimensions and suspension (current replacement candidate)

The replacement now uses a common module of 0.059 world units, nine pinion teeth,
eight straight rack pitches and a 16-tooth equivalent end circle. At 100 engraving
pixels per world unit, its pinion outer radius is 32.45 pixels versus approximately
32 in the drawing. The generated opening is 254.48 pixels wide versus approximately
253, and 106.2 pixels high versus approximately 106. The end-radius ratio is 16:9,
not the preceding model's assumed 2:1; a complete cycle takes 23/9 pinion revolutions.

The rack opening sits 4.65 pixels above the drawn centre to obtain conjugate lower-row
engagement. This adjustment is explicit: the illustrator's gear and rack are not a
dimensionally exact pair. The source pose now places the rack centre five pixels left
of the shaft and a pinion tooth downward, matching the drawing's placement.

The suspension's unequal arms and approximately 64-degree bend replace the old
right-angle/equal-arm assumption. Two parallel cranks reconcile the small left/right
measurement discrepancies. Their pivot, wrist, rack-pin and coupler-pin centres are
within 2.5 pixels of the eight measured locations. Both connecting-rod lengths and
the horizontal coupler length remain constant through the entire rack stroke.
The [registered overlay](validation/139-dimensions.svg) has been rendered and checked;
[the dimensional report](validation/139-dimensions.json) records the compromises.

## Native contact candidate

`scripts/probe-internal-rack.mjs` triangulates simplified working polygons into
352 pinion and 1,682 rack convex prisms. Polygon simplification tolerance is 0.00015
units (0.015 pixels). The native model drives only the pinion; the carriage slides
horizontally, the rack slides vertically within finite limits, and a crank/rod loop
closes on explicit joint sites. The parallel right-hand suspension is reduced into
the equivalent moving masses. A horizontal coupler translates like its top pin, so
its mass can be lumped at that pin without adding a false coupler rotation inertia.
Physical size assumes one engraving pixel per millimetre; depths and masses remain
inferred.

Trials with coupler mass zero or six times rack mass lose the intended initial
engagement branch. A mass ratio of eight retains that branch, but the coarse contact
run skips a tooth. Refining timestep from 0.0005 to 0.000125 seconds and contact time
from 0.002 to 0.001 seconds produces a 12-second candidate with no resets, maximum
penetration 0.03745 pixels, sampled rod-closure error 0.04574 pixels and maximum
pitch-path position error 1.089 pixels. The [native report](validation/139-native-review.json)
keeps the unsuccessful runs alongside the candidate.

These are diagnostic results, not convergence certification. Timestep and contact
stiffness changed together. The effective coupler mass ratio must be reconciled with
reasonable reconstructed hardware, and separate refinement/longer-run checks remain
before baking. The browser still uses the old model; do not advance to 140.

```sh
node scripts/prototype-internal-rack-profile.mjs
node scripts/review-internal-rack-dimensions.mjs
node scripts/probe-internal-rack.mjs
COUNTER_MASS=6 PROBE_REPORT=/dev/shm/139-native-counterweight.json node scripts/probe-internal-rack.mjs
COUNTER_MASS=8 PROBE_REPORT=/dev/shm/139-native-heavy-coupler.json node scripts/probe-internal-rack.mjs
COUNTER_MASS=8 SIM_OPTIONS='{"timestep":0.000125,"contactTime":0.001}' PROBE_REPORT=/dev/shm/139-native-refined.json node scripts/probe-internal-rack.mjs
node scripts/review-internal-rack-native.mjs /dev/shm/139-native.json /dev/shm/139-native-counterweight.json /dev/shm/139-native-heavy-coupler.json /dev/shm/139-native-refined.json
node --test tests/internal-rack-profile.test.mjs
```
