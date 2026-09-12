# Movement 084 reconstruction study

Status: **rebuilt, integrated and verified**. Earlier failed experiments and
their qualification limits remain below as the reconstruction record.
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

The first finite candidate is now built in `selector-rack-candidate.mjs`,
outside production. Its seventeen closed solids include the single working
cam, a complete rear wheel with curved spoke openings, a rack frame with real
slots, a bored governor yoke with retained pins, two guides with through
passages, and a connected rear bearing standard. The common axis is set at
source pixel `[908, 590]`, with 240 pixels per world unit. This is an explicit
approximation of the independently fitted source circles. The thirteen upper
faces retain their measured positions. Fourteen lower contours are included;
faces 10 and 11 use explicit manual estimates where wheel strokes obscure them.
These provisional profiles have not been accepted for loaded motion.

Both pin shanks have radius 13 source pixels and share source y=389. The real
slot openings use their white-area edges, with upper boundaries at y=376,
so the hanging frame meets the tops of the shanks. Their common horizontal
travel is **−49 to +77 source pixels**. Retaining heads, pin bores, finite
depths, the rear support and guide passages are reconstruction assumptions.
The selector's reported vertical limits describe the guide openings only;
they are not a certified operating range for the cam. The full rear wheel is
visible through the open suspension slots where the engraving omits hidden
wheel detail. The front guide walls also obscure short portions of the rod;
their presentation still needs final review.

The first rack extrusion had eight unmatched mesh edges at the bridges between
aligned rectangular slots. `conforming-plate-mesh.mjs` splits the two affected
cap triangles at existing boundary vertices, preserving the contour. The
control check reproduces this issue with a second aligned-slot fixture and
leaves a plain rectangle unsplit. The corrected frame has 1,352 triangles,
the same measured volume, and zero unmatched edges. Its old/new surface
samples differ by at most 1.098e-9 world units. The original failed topology
screen and exact input snapshots remain preserved.

The supported candidate passes **2,526,268 bidirectional surface samples**
over all **99 distinct-family pairs**, at the source pose and 33 neutral cam
angles. All seventeen meshes are closed and consistently wound, and no
intrusions exceed 1e-6. This is a sampled screen, not continuous qualification
of every pair. The six latest browser views, including source overlay,
oblique, rear and suspension detail, were inspected. The corrected capture
has no browser errors or unexpected warnings. An earlier capture imported
Three.js twice and failed its warning check; it is preserved, and the capture
now uses the candidate's existing Three.js instance.

`selector-rack-contact.mjs` extracts 341 rack and 355 cam cap triangles from
the actual meshes. Convex separation intervals and their union describe the
forbidden horizontal rack positions. An independent polygon-intersection
check agrees at all 3,783 sampled poses: 3,319 clear and 464 overlapping, with
no excluded near-boundary classifications. At 177 interval endpoints the
largest polygon intersection area is 7.404e-15 square world units. These
checks verify sampled geometry, not an inertial contact model.

A separate continuous bound covers the rack against the working cam, both
hubs, the fixed axle and the rear wheel. Across the entire −49 to +77 pixel
horizontal range, with the frame between two and four pixels below its source
position, all 1,352 translated triangle boxes remain outside the rotating
cam's bounding cylinder. The minimum cam margin, after a 1e-7 allowance, is
0.00468165 world units (1.12360 source pixels). The rear wheel has a separate
axial gap. This proves these five pairs clear in that neutral domain for all
cam angles; it does not certify the remaining hardware pairs through travel.
The first bound-check attempt used an unavailable Euler conversion method;
its source and log remain archived, and the completed check reads the three
rotation components directly.

The first geometric path experiments are **not accepted animation**. Starting
the lower selection at the drawn rack position exhausts all allowed slot
positions at cam angle −2.65290 radians, after approximately 48.304 pixels of
leftward motion. A nearest-allowed-position rule also jumps 49.534 pixels in
the upper experiment. Moving the lower starting position does not cure the
failure and introduces larger jumps. Starting the upper case 30 pixels left
does produce 721 sampled positions over one revolution, advancing 61.119
pixels, with maximum per-sample correction 0.726 pixels. This remains a
geometric projection experiment, without inertia, force admissibility,
continuous contact or governor handoff verification. None of these paths is
connected to production playback.

The next step is to resolve the governor selection and release using the
actual slot/pin and cam contacts, including the frame's available vertical
play. Holding a selection through a complete turn is not a valid universal
input for this finite travel. `084-finite-candidate-checkpoint.json` records
the current source hashes, preserved failures and all new evidence.
The 904 production inputs, 71 existing 083 sources, 43 existing 082 sources
and thirteen earlier 084 review inputs retain their bytes. No app build,
production test rerun or production integration is claimed; the full review
remains active.

## Free planar dynamics and loaded clearance

The independent free-frame wrapper preserves every mesh buffer and releases
the rack's two planar translations and rotation. The center of mass and polar
inertia come from the closed frame mesh. Uniform density is normalized to
mass one; gravity is 9.81 and viscous drag is [8, 0.2, 0.2] for center motion
and rotation. Out-of-plane motion remains ideally constrained. These loads,
frictionless plastic contact and the governor input are reconstruction
assumptions, rather than measurements from the engraving.

The clockwise cam completes one turn in four seconds. Two quintic governor
pulses select heights +16 and −28 source pixels, each returning to the neutral
height −3 pixels. Actual finite contact determines the rack position and
angle. Its only initial seating adjustment is approximately 1.83913e-8 world
units, correcting floating-point pin geometry; no later pose is reseated.
The rack can tilt slightly and move vertically within the suspension's play.
The 1 ms run moves approximately −49.014 to +36.106 source pixels and tilts
between −0.080754 and +0.117009 degrees. Selection, release, coasting and
settling all occur within the 5.5-second study.

Four runs at 1, 0.5, 0.25 and 0.125 ms complete with respectively 5,501,
11,001, 22,001 and 44,001 states, without failed or rejected steps. Their
successive whole-frame displacement bounds are 0.536748, 0.257230 and
**0.133434187 engraving pixels**. The first two fail the 0.25-pixel target
and remain archived. The last passes across 65,524 union knots and the
piecewise-linear segments between them. This is observed step refinement,
not a continuum-error guarantee. Small angular differences dominate the
bound because the frame includes long rods.

Independent audits of all positive reactions pass for the 1, 0.5 and
0.125 ms runs. The finest audit checks **84,844 reactions and 169,688 complete
mesh boundaries**. The generalized impulse must act at a common supporting
feature location, with admissible boundary normals and the correct moment.
Maximum boundary distance is 3.900e-13, momentum residual 1.482e-13 and
discrete energy-identity residual 6.141e-14. Input work is 2.357165554,
viscous dissipation 1.995887757, backward-Euler step loss 0.235502884 and
contact drift work −0.125774933. The drift term is reported explicitly;
it is not relabeled physical damping. None of these balance checks establishes
material stresses or time-step accuracy on its own.

The finest loaded surface screen samples 132 poses, including uniform times,
extrema of all three free coordinates and each saved cam engagement/release.
All 17 closed geometry buffers match the prior supported candidate exactly.
Across all 99 distinct-family pairs, **9,807,864 bidirectional samples** find
zero intrusions greater than 1e-6 world units. The earlier 1 ms loaded screen
also passes 9,510,656 samples at 128 poses.

`check-selector-rack-continuous-contact.mjs` additionally covers every one of
the finest run's **44,000 intervals** for six pairs: frame versus working cam,
each pin shank, fixed axle and each guide. Frame and cam cells match complete
rendered prism caps; pin and shaft hulls contain their actual vertices. All
guide boundary triangles within the frame's entire axial slab lie inside the
two contact rectangles per guide. The proof uses fixed separating axes with
endpoint projection bounds, allowing for rotational chord error and the
quintic selector's bounded acceleration. It requires 54,596 subdivisions,
at most four levels, and finds no failed pair. Its lowest certified separation
bound is −9.999719e-7 world units, within the 1e-6 tolerance. A neutral control
passes and a deliberately penetrating frame fails. These are continuous
bounds on the saved interpolants, not a guarantee about an unsolved physical
trajectory. The remaining hardware pairs still need continuous qualification.

The first continuous-check attempt rounded translated pin vertices into a
second Float32 buffer and failed the hull containment assertion. Its exact
checker snapshot and log are retained. The corrected checker transforms
extracted double-precision vertices without rewriting the mesh buffers.
Earlier contact-check syntax and guide-section extraction failures are also
preserved, with their exact sources.

All twelve half-millisecond loaded captures are inspected: initial position,
lower engagement/drive/release/stop, upper start/drive/release, final position,
oblique, rear and suspension detail. The slots remain open and the retained
pins stay aligned; the full wheel and finite depth ordering are visible.
The guide front walls obscure a short rod length as expected from the model.
These are candidate stills from the coarser run, not final production motion
review. The browser reported zero errors and no unexpected warnings and was
closed after capture. All nine new study/check scripts pass syntax checks.

`084-planar-dynamics-checkpoint.json` records these results and the preserved
failures. The 904 production inputs, 71 current 083 sources, 43 current 082
sources and 26 prior 084 inputs retain their bytes. The reconstruction is
not integrated. Remaining work includes continuous bounds for other hardware,
playback settling/continuation, final fine-trajectory visual review and app
integration with its relevant numerical, browser and build checks.

## Integrated reconstruction

All **99 pairs of independently moving meshes** now have continuous clearance
evidence through the loaded motion. Eighty-seven use separating bounds over
the full motion domain. Six use the primary contact certificate. The two
frame/hub pairs transfer that certificate after the actual rendered hub cap
unions are proved contained in the working cam's cap union. Four rotating
parts clear the fixed shaft by their complete prism bore radii. The guide
passage and pin checks include finite depth, rather than point markers.

The 44,001-state fine trajectory is compressed to **13,525 knots**, bounding
every frame vertex's interpolation change to **0.000009999553 engraving
pixels**. Exact cam and governor inputs are retained. The compressed motion
passes a fresh continuous check of all 13,524 intervals, using at most five
subdivision levels, plus fresh bounds for all remaining hardware. Adding
compression to the observed step-refinement bound gives **0.133444187 pixels**;
this remains an observed agreement bound, not a continuum-error guarantee.
Twelve compressed-trajectory browser views are inspected.

Production replaces the old four-lobed cam with the measured single
projection and complete curved-spoke wheel. It preserves the real suspension
slots, retained pin shanks, free frame tilt and finite guide passages.
The old factory and its test, which asserted the incorrect four-lobed model,
are removed; their preintegration sources remain archived. Five new numerical
tests cover source geometry, closed topology, candidate parity, both drive
directions, finite clearances and replay. The catalog archetype is corrected.

Playback keeps the four-second cam revolution and the full 5.5-second
selection/release/settling demonstration. The existing app pauses at its end
and offers **Replay**. This is explicitly an animation pause, not a modeled
brake or a claim of a periodic rack trajectory. There is no automatic reset
during motion. A declared camera envelope covers the complete demonstration,
including the final rack drift beyond the display sampler's first revolution.

Production knot data match the reviewed compressed data exactly. Across
**27,049 knots and midpoints**, the largest center-coordinate difference is
1.943e-16, angular difference 1.633e-17 and prescribed-input difference zero.
The geometry buffers, topology and transforms match the independent candidate.
All **3,104 numerical tests**, the production build and the targeted 084
desktop/mobile browser check pass. Pause, completion, Replay, framing and
mobile overflow checks pass. The build retains its existing large-bundle
warning; no new full-catalog browser pass is claimed.

Fourteen final integrated views are inspected, including the aligned source
comparison, both drive/release sequences, rear and suspension details, and
desktop/mobile app views. The measured six-second render run averages
**59.84 fps**, with **0.2 ms** 95th-percentile model updates. Fog is absent,
the ground is hidden, and there are no browser errors or unexpected warnings.
Both browsers are closed.

`084-integrated-checkpoint.json` and `084-integrated-source-hashes.json` record
the final evidence and 944 current inputs. Of the earlier 904 production
inputs, 899 are unchanged; the factory, catalog entry, display profiles and
obsolete test account for the five changes. Thirty-four of the prior 36
084 inputs retain their bytes; the other two are the factory and catalog,
whose old snapshots are retained. All 71 current 083 and 43 current 082 study
sources remain unchanged. Their unresolved mechanics and the rest of the
507-movement review remain active.
