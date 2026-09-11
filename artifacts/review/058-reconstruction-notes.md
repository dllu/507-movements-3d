# 058 · Rebuilt and verified

The replacement 058 is integrated and verified. Its shared 058/059 factory is archived in
`058-original-factory.txt`; 059 uses its two-speed branch and must be reviewed
separately. The 057 reconstruction is rebuilt and verified: the build, all
2,955 numerical tests and all 17 browser tests pass. Movement 037 remains
unresolved. This is an unfinished catalog review.

## Source and visible arrangement

[The official page](https://507movements.com/mm_058.html) is saved in
`../reference/mm_058.html`. Its Animated control is unavailable; there is no
official animation to use for ratios or dimensions. The unchanged larger Brown
crop is `../reference/brown-058-detail.png`, extracted with pdftoppm from PDF
page 22 (one-based), scale 6000, rectangle (1750,3730,1300,1360).

The upper broad pulley drives one of four equal-size lower pulleys through a
laterally movable band. The rightmost lower pulley is loose. The next is fixed
to the main shaft and the smallest input gear at the left end. The next pulley
drives a hollow shaft around the main shaft and the middle input gear. The
leftmost pulley drives another hollow shaft around the first sleeve and the
largest input gear nearest the pulleys. All three lower gears share one output
shaft. Unselected geared input members therefore turn through back-drive from
the common output; they are not independently stationary.

The engraving is essentially a side elevation. The gear cluster lies to the
LEFT of the pulleys. In the present z-axis convention that calls for a view
from negative x; the current positive-x oblique camera reverses their projected
order. Brown shows a broad FLAT band, whereas current model metadata confirms
`crossSection: 'round'`, thickness 0.084. The torn ends in the drawing are a
schematic interruption of a continuous belt, not two disconnected driven straps.
There are no visible post-and-rail supports in this source view. The upper
driver looks like a broad smooth drum, not four stepped grooves. Large lower
pulley flanges would obstruct the prescribed lateral traverse.

The side-view tooth hatching is not a reliable tooth-count measurement. Counts are compatible geometric estimates, not counts inferred from the hatching.
The old 18/28/38 values are not source dimensions.

Rough scan landmarks for subsequent fitting (not validated dimensions): lower
input axis near y=765, common output axis near y=1045, upper driver axis near
y=242; pulley edges around x=675..1145, with radii about 215 pixels; input gear
planes near x=172,338,525. Approximate gear widths are 75,80,90 pixels. The four
lower lanes are roughly 115 pixels apart. These suggest much larger pulleys and
greater axial gear spacing than the existing model. The candidate uses 200 pixels per unit and source origin (910,761), with
parallel input, output and driver axes. Brown's slightly inconsistent shaft and
pulley centers are retained as measurement residuals, not modeled eccentricity.

## Confirmed tooth defects

`scripts/probe-three-speed-selector-teeth-baseline.mjs` samples actual closed
tooth skins in both directions at 129 phases per pair, each covering one
relative tooth engagement during the first driven dwell. The output shaft
back-drives the two unselected members. `058-tooth-contact-baseline.json` finds:

- 18/38 pair: 52,113 penetrations in 3,041,820 checks; maximum depth 0.036862706.
- 28/28 pair: 56,044 penetrations in 3,277,116 checks; maximum depth 0.036825329.
- 38/18 pair: 52,141 penetrations in 3,041,820 checks; maximum depth 0.036862816.

Total: 160,298 penetrating samples in 9,360,756 checks. The current mounting
phases have a quarter-pitch mismatch. Existing pitch-speed and relative-angle
identities do not establish valid initial tooth/gap alignment or solid contact.

## Scoped hardware and belt defects

`scripts/probe-three-speed-selector-hardware-baseline.mjs` checks initial nested
shaft surfaces against other input-member gear solids, then the actual belt
skin against every driver tread and lower pulley body/rim over 97 selector-cycle
poses. This is deliberately one-direction scoped baseline evidence, not a full
assembly audit. It refreshes cached surfaces whenever the dynamic belt's actual
position-buffer version changes. `058-hardware-baseline.json` reports 115,982
penetrating samples in 1,589,288 checks:

- The main shaft penetrates the largest input gear's extrusion and hub;
  measured depths up to 0.101666676 and 0.115416678 respectively.
- The first hollow sleeve also penetrates those solids, up to 0.121666663
  and 0.100963601 respectively. Decorative bore rings are not real holes.
- The cord penetrates all four driver treads by up to 0.040599164.
- During traversal, it crosses six lower pulley flange surfaces by up to
  0.039152601. Their outside radius obstructs the nominal band path.

The initial harness error (passing the main shaft group as a mesh) was corrected
before producing that report; the final script traverses actual shaft meshes.

## Superseded motion and initial repair plan

The superseded three gear pairs have module 0.05 and center distance 1.4, with gear
planes z=-2.26,-1.79,-1.32. Lower pulley lanes are z=0.78,0.26,-0.26,-0.78;
pulley radius is 0.58, width 0.44 and spacing 0.52. The driver is 1.93 units above
the input axis. Selection order is neutral, low, middle, high, middle, low.
Each dwell lasts 2.65 authored seconds and each shift 1.05; all shafts stop
during traversal. One demonstration lasts 22.2 authored seconds and currently
displays in 18.6263 seconds. The stop-to-shift sequence is an operating inference,
not a sequence specified by Brown.

The unchanged production model is captured and inspected at phases 0, 0.145
and 0.55 in `058-baseline-phase-*.png`. These show the reversed projected
gear/pulley order, small pulleys, compressed gear spacing, prominent front
shaft ends, round band and ground shadow. The upper driver already renders as
one visually continuous cylinder because its four nominal steps have equal
radii; do not mistake those equal-radius sections for visible grooves. The
lower torus flanges are visible and obstruct the measured belt traverse.

The initial repair plan was to fit source proportions and gear ratios; build a real flat band on smooth
pulley treads with clearance through lateral travel; give each nested shaft
genuine bores in all independently rotating parts; verify actual gear contact
and the complete selector motion before integration. The replacement 058 is now integrated. Its construction and checks are described below.

## Candidate geometry and initial verification

Production modules are `src/simulation/three-speed-selector.js`,
`three-speed-selector-motion.js` and `three-speed-selector-geometry.js`. The
three `058-candidate-*.mjs` entry points now re-export that production code, so
the retained probes exercise the actual implementation. Only case 58 changed;
059 still uses the old two-speed branch. The superseded 058 test is archived
in `058-original-test.txt` and replaced by registration and mechanical tests. The read-only envelope measurements are in
`058-source-envelope-measurement.json`, generated by
`scripts/measure-three-speed-selector-source.mjs` from the unchanged Brown crop.
A common module 0.050625 and center distance 1.4175 support 17/39, 26/30 and
40/16 pairs. These counts fit source proportions; Brown does not specify them.
Ordinary 20-degree involutes use rounded rack-generated roots and bilateral
backlash 0.00002. Actual Float32 profiles are extruded with real bores, including
clearance between all three independently rotating input members.

Gear planes z=-3.69,-2.86,-1.925 and widths 0.375,0.40,0.44 follow the source.
Four equal smooth lower pulleys have radius 1.10, width 0.56 and lane spacing
0.58. The upper smooth drum is 2.6075 above them. The flat band is 0.43 wide and
0.02 thick with a 0.00015 radial running clearance. During each stopped shift
it crosses the 0.02 axial gaps without colliding with obstructing flanges.
The source camera looks along negative x; an oblique view exposes the gear
pairs and sleeves. Ground is hidden; no unsupported frame is added.

The stopped shifts are an operating inference. Each 2.4-second authored dwell
advances the driver half a revolution using quintic easing; each 0.9-second
traverse begins and ends with zero shaft speed and acceleration. All unselected
input gears back-drive from the common output. The full selector demonstration
is 19.8 authored seconds. The measured default time scale is 1.34171717208222,
giving 14.757208457928762 display seconds. The fastest brief back-driven pinion
reaches the existing 3-revolutions/second display limit, while the measured
75th-percentile visible speed is about 0.512 revolution/second. Gear ratios are
unchanged by the common time scale.
Mounts, axial retention, inertia and friction remain explicit idealizations.

`058-candidate-solids.json` passes all 17 closed solids: positive volume,
nondegenerate faces, consistent outward corner normals, and oriented manifold
edges. The final contact sampling covers 2,049 phases per pair on BOTH torque
flanks (12,294 contact rows total), with no crossings. Actual contour gaps are
24.142 to 27.522 microunits and maximum pairwise normal-force power residual is
0.195 percent. This checks load directions for both driven and back-driven
members; it is not a solved assembly inertia or friction model. The optional
witness predicate added to `coaxial-planar-distance.mjs` never filters crossing
counts. Hardware, independent 3D contact and source overlay checks now pass. Full
regression verification now passes.

Source, oblique, rear and high-speed candidate captures have been inspected.
They confirm the large flat-belt pulleys and expanded gear spacing are much
closer to Brown. The continuous belt necessarily fills the drawing's schematic
break. The shift capture is also inspected and shows the band bridging adjacent smooth
treads without an obstructing flange.

## Complete assembly and source evidence

`058-candidate-hardware.json` checks 117 independent hardware pairs in both
directions over 97 full demonstration poses: 142,209,744 actual surface samples,
zero penetrations. The three matching tooth pairs are excluded here because
the denser contour sweep checks them separately. Rigidly attached same-member
parts are excluded; their matching cylindrical surfaces may coincide.

`058-candidate-exact-contact.json` independently checks the actual 3D triangles
at six gear contacts, eight selected driver/lower-pulley contacts and six
mid-traverse contacts on both adjacent lower pulleys. Gear gaps are 25.512 to
26.476 microunits; belt gaps are approximately 145.98 to 146.01 microunits.
The explicit upper/lower belt clearance is smaller after chord tessellation,
but remains positive. The 17 solid checks, surface sweeps and exact minimum
triangle distances are finite numerical evidence, not an arbitrary continuous
collision proof or a solved friction/dynamic simulation.

`058-source-alignment.html` provides an inspected interactive overlay of
actual mesh side-elevation envelopes on the unchanged Brown scan. The companion
JSON records measured residuals. Gear-stack top/bottom residuals span -10.75 to
+9.96 pixels; shaft and pulley residuals are within about 9.5 pixels. This
preserves one physical center per shaft despite inconsistent drawn centers.
Internal tooth lines and hidden bores are deliberately not represented by the
rectangular side-envelope overlay; the actual source/full renders show those.

Seven focused tests pass: five mechanical tests in
`tests/three-speed-selector.test.mjs` and two contour-helper tests. They cover
closed skins, both load flanks, actual nested bores, selected and bridging belt
contacts, zero-speed/acceleration shifts, gear ratios, derivatives and pure
seeking of both geometry and material flow. The first run's only failure was
strict assertion of +0 against the valid computed -0 output speed. The signed
zero assertion was corrected; no motion change was needed. Its log is archived.
The final focused log is `058-focused-tests.log` (7/7, exit 0).

All six integrated source and full views at phases 0, 0.145 and 0.56 have been
inspected. The build passes (10.25 seconds; the existing bundle-size advisory
remains). The gallery now contains 232 comparisons. All 2,962 numerical tests pass (130.27 seconds, concurrency 8), and all 18
browser tests pass (739.375 seconds, one worker). Both explicit exit-status
wrappers report code 0 with no signal. The browser run includes all 507 canvases
and the new 058 playback/pause/orbit/mobile check. `058-reconstruction.json`
records `rebuilt-and-verified`.
