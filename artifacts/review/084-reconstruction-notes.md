# Movement 084 reconstruction study

Status: **baseline rejected; source layout inspected; reconstruction pending**.
This review began while the finer 083 continuation was running.

The [original description and engraving](https://507movements.com/mm_084.html)
show a rack-frame B suspended from governor rod A. A continuously rotating
cam D clears both racks in neutral; raising or lowering A selects a rack and
moves B horizontally. The source drawing has a single projecting working cam
in front of a much larger wheel with four curved spokes. The baseline instead
models four working lobes and a small rear wheel with straight spokes.

The native reference is `artifacts/reference/brown-084-detail.png`, an
1800 × 1250 extraction at `[1480, 3820, 1800, 1250]` of the same 4814 × 6000
scan used for 083: PDF page 28, printed page 24. The original scan and extraction
hashes are recorded in `084-source-provenance.json`. The public engraving and
the native reference were both inspected.

Eight baseline views cover both neutral positions, lower and upper working
positions, both stroke ends, and oblique and rear views. All were inspected;
the capture completed without browser errors and its browser was closed before
subsequent source edits. The working cam, rear-wheel size and spoke shape,
tooth lean, yoke proportions and added support frame require correction.

The baseline's suspension slots are dark solids laid over a solid box, with no
open passage. A screen of **36 closed, outward-wound selected solids**, across
**236 distinct-family pairs and 131 poses**, finds **27,333 penetrating samples
in 6,427,516 checks**. Maximum penetration is 0.15220001 world units. Both
suspension pins enter the housing by up to 0.019999998 world units. The screen
includes the cam body, hub and four tip blocks, the rack body, housing and all
26 rack teeth, and both actual pin cylinders. It does not certify the remaining
supports, guides or flywheel, or continuous clearance between sampled poses.

The model reports a maximum contact error of only 9.715e-17 in the same sampled
cycle. That value compares two locations constructed from the prescribed eased
rack motion; it does not measure contact with the cam surface. The finite-solid
screen demonstrates the difference. The current 22.7273-second demonstration
cycle and 4.54545-second cam revolution also require review after the working
cam and contact law are corrected.

Two initial probe attempts stopped before producing a screen because a shaft
assembly group was treated as a mesh. Their logs and exact probe sources are
preserved. The completed probe traverses each pin assembly, requires its single
mesh body, and checks that cylinder. See `084-baseline-surfaces.json` and
`084-source-and-baseline-inspections.json`.

The first source overlay was inspected. Its circular fits are preliminary:

| Region | Fitted radius, pixels | RMS residual, pixels | Readings |
| --- | ---: | ---: | ---: |
| Shaft | 12.4436 | 0.7717 | 72 |
| Hub | 34.3543 | 0.8591 | 72 |
| Round part of cam | 58.3122 | 1.2131 | 32 |
| Rear-wheel outside | 231.4045 | 1.4012 | 46 |
| Rear-wheel inside | 198.6596 | 2.4360 | 30 |

The outer shaft, hub, cam and wheel fits follow their visible ink strokes.
Their centers differ by a few pixels, so a common mechanical axis still needs
an explicit choice. Sixteen inner-wheel rays are obscured or clipped by the
spokes/rack and remain missing. The two pin fits trace the white face boundaries,
with radii 12.7672 and 13.0989 pixels; they are not black-stroke center readings.
The slot rectangles and single cam-lobe polyline are manual contour targets.
Tooth counts, pitch, working faces, slot clearance and hidden layers are not
adopted. All readings and the inspected overlay are preserved in
`084-first-source-measurements.json` and the inspection record.

Next, measure the rack rows and single working cam, then build source-shaped
finite parts with real suspension slots, pin bores, guides and the large rear
wheel with curved spokes. Motion must follow contact of those parts. The baseline is
not corrected or accepted by these diagnostics; production integration and the
full 507 review remain open.

`084-baseline-checkpoint.json` freezes twelve inputs for the three new review
scripts and their dependencies. It records the five evidence reports and
confirms that all 904 production inputs, 71 current 083 study sources and 43
current 082 study sources retain their bytes.

The next source pass labels the short working faces individually. All thirteen
upper faces have enough isolated ink readings for a line fit. Fourteen lower
face candidates are labeled; thirteen can be fitted, while lower face 10 is
obscured and has too few isolated readings. Lower faces 7 and 11 also border
rear-wheel strokes and remain flagged for reconstruction review. The full
overlay and both native-resolution row crops were inspected. These observations
do not establish a fourteen-tooth repeating lower-rack design.

Uniform-spacing fits give 62.5096 pixels for the upper row and 52.7524 pixels
for the lower row. Their RMS residuals are 10.9315 and 5.3180 pixels,
respectively, so neither row should be treated as a precision uniform rack
traced directly from this drawing. Individual working-face line fits have RMS
residuals below 0.786 pixels. Mean tooth depths from manual endpoint heights
are 36.3846 pixels above and 29.7143 pixels below. These are source measurements,
not adopted contact profiles or mechanical tolerances.

`scripts/measure-selector-rack-teeth.mjs` records the seeds, bounded stroke
readings, missing rows, line fits and spacing residuals. Its initial attempt
asserted that every face had enough readings and stopped before writing a
report; that exact source and failure are preserved. The completed script
leaves an obscured face unfitted instead of supplying a guessed measurement.
See `084-rack-face-measurements.json`, `084-rack-face-inspections.json` and
`084-rack-face-checkpoint.json`. The twelve earlier baseline inputs retain
their bytes. A source-shaped cam, rack, suspension and wheel, followed by
contact-derived motion and production integration, remain to be built.
