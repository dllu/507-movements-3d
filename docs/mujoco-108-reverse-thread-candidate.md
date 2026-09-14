# 108 — reverse-thread traverse under review

Movement 108 now loads a contact-driven MuJoCo reconstruction in the catalog.
A passive swiveling shoe follows complete intersecting grooves, replacing the
historical raised tubes and prescribed triangular follower travel. The new
shoe substantially improves ordinary stroke uniformity and the darker recessed
core makes both grooves visible. This is an integration for review, not a
completed mechanical qualification: occasional contact spikes, mesh/load
sensitivity and the projected groove/source mismatch remain unresolved.

Brown's [108 caption](https://507movements.com/mm_108.html) describes a cylinder
with intersecting right- and left-handed grooves driving a point from end to
end while rotation continues in one direction. The old model assumes three
turns per traverse and takes about 55.44 seconds for a complete output cycle.
The reconstruction takes 20 seconds, with five barrel turns in each traverse.
Its `reconstructionStatus` is `under-review`.

## Source measurements and reconstruction choices

`scripts/measure-reverse-thread-source.mjs` reads complete dark ink runs from
`public/engravings/mm_108.png`. One model unit represents 100 engraving pixels.
The measured barrel width is 94.44615 pixels and its height is 249.50284 pixels.
Frame rails, shaft, guide, slider and input wheel have independent readings.

The source shows five crossings on the visible face. A fit to 82 paired groove
readings gives 42.84121 pixels of axial pitch and a first front crossing at
source height 168.12551. The median ink-outline gap is 12.6 pixels. This fit
assumes a circular cylinder and five turns per traverse. Its vertical center
residual is 8.28011 pixels RMS and 12.81040 maximum: at this crossing spacing,
the drawing's diagonals are steeper and straighter than the assumed cylindrical
projection. The caption does not establish the repetition count, end joins or
assembly phase. These remain reconstruction choices, not measured facts.

`scripts/compare-reverse-thread-outlines.mjs` separately extracts the outer
groove shoulders from the actual rendered Float32 triangles, clips them to the
front half of the barrel and projects them into source coordinates. Against
164 paired ink-outline centers, the current model has 6.62320 pixels RMS and
11.79178 pixels maximum nearest-outline distance. This nearest-edge metric
does not establish which crossing corresponds to each source line or validate
hidden geometry. The source overlay still shows flatter, lens-shaped lands
where the drawing has steeper diamonds. The darker floor improves readability,
but does not correct that shape discrepancy.

The model has complete frame rails, bored shaft bearings and guide slider,
a tapered arm, a bored shoe socket, a radial spindle, and a curved working shoe.
Its input wheel has generated involute teeth; 76 teeth and the root transition
are inferred because Brown does not establish an exact tooth count. Centering
the shaft in the barrel shifts its drawn center by about 5.29 pixels. The
selected initial groove position puts the follower at source height 264.52
rather than the drawn point near 271. Fog and ground are disabled. All parts,
including the entire input wheel, fit inside the moving camera bounds.

## Passive contact and finite geometry

A small round point can enter either branch of a crossing. The historical
discussion in [US4031765A](https://patents.google.com/patent/US4031765A/en)
describes long swiveling followers that bridge the overlap and enlarged end
turns. This supports the mechanical approach; it does not establish Brown's
unseen hardware. Short shoes in earlier candidates selected the wrong branch.

The native model has a driven barrel hinge, passive follower slide and passive
radial shoe hinge. There is one input actuator and no output actuator or joint
equality. Bearings, guide alignment and the spindle's radial position are ideal
constraints. Their visible bores are modeled and checked separately. Mass and
full body inertia are integrated from the complete rendered solids at one
common density, normalized to unit input-body mass. Contact parameters and
mass scale are inferred, not calibrated to a physical machine.

The groove is machined from a swept finite shoe footprint. The cutter includes
the interiors of the shoe's curved longitudinal sides, not just its nose
endpoints. Minimax fitting selects the finite shoe's machining orientation on
straight flanks and through the returns; it supplies no swivel setpoint to
MuJoCo. Affine flanks use an analytical support calculation. Opposite-handed
cuts merge at intersections, leaving eleven closed land patches on the core.

The new shoe side contour is the intersection of the two opposite-handed
helical channels expressed in shoe coordinates. It fills the channel already
required by the previous stadium-shaped shoe, providing distributed flank
support without increasing that groove width. Both radial surfaces constrain
the fit. The nose sampling resolves the rounded ends independently of the
radial strip grid. The resulting contour and all motion remain symmetric under
reversal of thread handedness; the native radial hinge remains passive.

Each end uses half-cosine displacement, joining uniform lead with continuous
velocity and acceleration and nonzero curvature at the reversal itself. The
three-radian return moves each endpoint inward about 2.48 source pixels relative
to the previous two-radian return. The finite shoe starts interacting with a
return before its midpoint leaves the nominal uniform flank; speed checks
retain those intervals. Remaining contact spikes occur despite nominal
machining poses being feasible. The cause has not yet been established.

The barrel core participates in contact. Its native cylinder fills the union
of the visible annular core and coaxial shaft within the barrel's axial extent.
The 256-sided rendered circumference differs from the analytic cylinder by
less than 0.004 engraving pixel. Core depth is an inferred parameter.

Contact decomposition uses one convex hull per angular land strip, with those
same hulls defining the rendered solid. Canonical end faces preserve exact
cancellation between neighboring strips. Coalescing nearly coincident
intersection angles and reusing periodic endpoints prevents artificial radial
seam caps. Interior shoe strips with planar caps are merged exactly; curved
nose strips retain triangular prisms to avoid filling their concave inner
surface. An independent polygon-area-times-thickness check verifies shoe volume.
Coincident facet normals are smoothed without joining opposing groove walls.

The current 64-segment model has 681 native geoms, compared with 1,283 before
strip merging. All 5,328 compiled mesh vertices agree with rendered surfaces
within 0.00003 source pixel. Independent convex volumes agree with the rendered
contact solids within 0.000001 model-unit cubed. Twelve visible parts have
positive volume, closed topology and consistent normals. Checks reject radial
seam caps and sweep 481 prescribed shoe poses for machining interference.
These prescribed poses are clearance diagnostics, not passive branch evidence.

MuJoCo 3.13's discrete integrator and exact constraint-inertia diagonal are
used with contact impedance `[0.9, 0.95, 0.001]`. The exact diagonal accounts for
the constrained configuration rather than the default body-average estimate;
it does not guarantee stable branch selection. Mesh assets use `inertia="shell"`
for their unused inertia preprocessing so very thin intersection cells compile.
The explicit full body inertias still come from solid volume; contact hulls are
unchanged. See the official [option and mesh reference](https://mujoco.readthedocs.io/en/stable/XMLreference.html).

## Dynamics and browser evidence

Factory defaults now select the reviewed configuration: 0.36-unit shoe straight
half-length, 0.05-unit nose radius, 0.025-unit radial thickness, 0.001-unit cutter
clearance, contoured curved shoe, three-radian rounded returns, optimized
machining angles, 0.4338-unit core radius, 0.001 swivel damping, 0.5 ms timestep,
2 ms contact response, 64 barrel segments, 24 shoe strips, friction 0.03 and a
20-second full output cycle. Each output cycle contains ten barrel turns.

Travel and penetration below are in engraving pixels. Speed variation is the
error from ideal speed over 100 ms intervals on nominal uniform flanks,
including finite-shoe end effects. The input has only its constant-speed motor.

| Study | Simulated seconds | Max travel error | Max penetration | Max input error, radians | Max speed variation |
| --- | ---: | ---: | ---: | ---: | ---: |
| Current nominal | 40 | 0.87058 | 0.06218 | 0.001191 | 10.2743% |
| Current six output cycles | 120 | 0.87419 | 0.36499 | 0.001191 | 10.7819% |
| Upward external load +0.35 | 40 | 0.86966 | 0.07569 | 0.001211 | 10.4344% |
| Downward external load −0.175 | 40 | 0.87073 | 0.06738 | 0.001213 | 10.2784% |
| 128 barrel segments / 48 shoe strips | 40 | 0.88001 | 0.33394 | 0.031389 | 10.7801% |
| 0.25 ms timestep | 40 | 0.86829 | 0.14208 | 0.000568 | 10.2621% |
| 1 ms timestep | 40 | 0.87225 | 0.10675 | 0.002596 | 10.4078% |
| Previous stadium shoe, six cycles | 120 | 0.82480 | 0.07116 | 0.001571 | 22.7593% |

All these runs complete the selected path, but the long and mesh/timestep
studies do not meet the two-cycle regression's 0.1-pixel penetration bound.
Mesh refinement also exceeds its 0.01-radian input bound. These are unresolved
failures, not accepted convergence. Gravity remains enabled in both load
studies; the upward external load reverses the net vertical force. These
magnitudes are diagnostic loads in the inferred mass scale, not validated
service loads. The six-cycle peak occurs at 94.760 seconds between `land324` and
`shoe57` near the upper return. The dynamics probe retains the pre-integration
pose and velocity used to compute that contact, avoiding a misleading comparison
with the following integrated state.

Long-run median 100 ms speed error is 0.13791%, p90 is 0.60484% and p95 is
1.47844%, compared with 2.04%, 8.08% and 9.05% for the previous stadium shoe.
The maximum is 10.7819% near an end transition. This is a substantial uniformity
improvement, accompanied by worse rare penetration. Wider contoured shoes,
higher damping, altered shoe density, elliptic friction and several impedance
variants were tried; some refined versions jammed. None of those changes is in
the current configuration. Passing two-cycle reversed-load checks do not
establish robustness under longer operation or other loads.

The finite-surface audit replays 485 passive states from the long run, including
the maximum travel, penetration and speed-window poses. It performs 38,522,534
independent surface queries using vertices, triangle centroids and edge
midpoints. Only shoe/land contact penetrates, by at most 0.36663 pixel, confirming
the native peak. The slider retains its full 30.61667-pixel guide engagement and
clears the frame rails by at least 7.93571 pixels. The spindle retains 6.00000
pixels of axial socket engagement and more than 0.14755 pixel sampled radial
clearance. Shaft/bearing and slider/guide radial clearances exceed 0.19758 and
0.19993 pixel respectively. All transformed vertices fit the camera bounds.
This is sampled evidence, not a continuous clearance proof; rigidly attached
parts are excluded from interference pairs.

All nineteen integrated browser views are inspected: source front and overlay,
full assembly, both returns, intermediate strokes, oblique and rear views,
upper-return exit, one and two complete cycles, groove, follower, guide and
socket details, and desktop/mobile catalog controls and notes. The sixteen
mechanism images are byte-identical to the inspected pre-integration images.
No artificial barrel seam or assembly crop appears. Detail cameras intentionally
crop the surrounding mechanism. Groove-wall shadows still show aliasing in
close-up, and the source mismatch remains.

A separate inspected mobile viewport capture resolves the stray skip-link in
the full-page notes image: the unfocused link is outside the actual viewport.
The complete reconstruction note and controls are readable; the apparent
overlay is a full-page screenshot artifact, requiring no application change.

That capture uses the app's actual `advance()` path and 50 ms frame clamp,
including final-frame processing in its wall clock. Over 22.0817 wall seconds it
advances 21.8600 simulation seconds, or 99.00% physical speed, averaging 20.88 fps.
Mean and p95 update times are 15.17 and 18.70 ms. Browser travel error stays below
0.86110 pixel, with input error below 0.00000631 radian. There are no page errors
or unexpected warnings. Its `passed` flag establishes these playback checks,
not load, contact-penetration or source-fidelity qualification.

Four mechanism and three shared-runtime tests pass with catalog defaults. They
cover finite contact geometry, passivity without shoe contact, allocation
disposal, two complete contact-driven cycles, reset, frame partition and backward
seeking. The two-cycle regression also checks p95 speed error below 3% and peak
below 15%; its 0.1-pixel penetration limit is unchanged. These bounded regressions
do not override the longer-run failures. The integrated production build passes
with the existing bundle-size warning. All 24 MuJoCo production browser tests
pass, including 108 loading beneath a static subdirectory, playback, pause,
restart, mobile controls and navigation away and back. Existing 097/098
regressions also pass. These UI checks do not qualify the contact trajectory.

## Remaining work and reproduction

Resolve the projected groove/source interpretation and the rare contact spikes,
then repeat load and mesh/timestep qualification on the final configuration.
Improve groove-wall shadow quality in close-up. Catalog integration makes this
progress reviewable; it does not mark 108 verified or complete the full catalog
review.

Bulk reports and images remain outside Git. The current evidence includes
`/dev/shm/108-fitted-final.json`, `108-shell-fine.json`, `108-shell-fast.json`,
`108-fitted-outlines.json`, `108-fitted-clearances.json`,
`108-integrated-browser.json`, `108-integrated-inspection.json`,
`108-integrated-up.json`, `108-integrated-down.json`, `108-integrated-dt.json`,
`108-integrated-tests.txt`, `108-integrated-build.txt` and
`108-integrated-e2e.txt`. The supplementary mobile check is
`108-mobile-viewport.json` with `108-mobile-viewport-inspection.json`. Older candidates have
separate frozen inputs; their passing load studies do not qualify the new shoe.

Use fresh prefixes; empty `SIM_OPTIONS` selects the catalog defaults:

```sh
PROBE_PREFIX=/dev/shm/108-measured node scripts/measure-reverse-thread-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-reverse-thread-candidate.test.mjs tests/mujoco-runtime.test.mjs
export SIM_OPTIONS='{}'
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/108-study DURATION=120 node scripts/probe-reverse-thread-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/108-envelope node scripts/probe-reverse-thread-envelope.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/108-outlines SOURCE_REPORT=/dev/shm/108-measured.json node scripts/compare-reverse-thread-outlines.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/108-clearances DYNAMICS_REPORT=/dev/shm/108-study.json node scripts/audit-reverse-thread-clearances.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/108-browser node scripts/capture-reverse-thread-candidate.mjs
```

The browser study uses an existing Vite server on port 5174. With default
options it loads 108 through the asynchronous catalog factory, then captures
desktop/mobile application controls and notes. Nonempty options select a direct
experimental factory for the mechanism views; application views always use
catalog defaults. Run one owned browser at a time and hold source/build files
unchanged during capture. Native studies also verify their frozen inputs.
Reports are retained before asserting the browser playback tolerance; a recorded
trajectory alone is not an assertion of mechanical success.
