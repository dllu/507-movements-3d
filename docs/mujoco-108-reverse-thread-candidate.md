# 108 — reverse-thread traverse reconstruction in progress

Movement 108 has a contact-driven MuJoCo candidate, but is not yet qualified or
integrated into the catalog's asynchronous loader. The latest reconstruction
retains the selected groove under reversed loads, mesh/timestep refinement and
six complete output cycles. Browser playback now approaches physical speed.
The projected groove pattern and nonuniform travel near crossings and end turns
still need correction or a justified reconstruction decision.

Brown's [108 caption](https://507movements.com/mm_108.html) describes a cylinder
with intersecting right- and left-handed grooves driving a point from end to
end while rotation continues in one direction. The historical catalog model
prescribes triangular follower travel with instant reversals, drawing raised
black tubes on an uncut cylinder. It assumes three turns per traverse and takes
about 55.44 seconds for a complete output cycle. Five baseline views were
captured and inspected; the frame, guide, groove count and contact need review.

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

`scripts/compare-reverse-thread-outlines.mjs` now separately extracts the outer
groove shoulders from the actual rendered Float32 triangles, clips them to the
front half of the barrel and projects them into source coordinates. Against
164 paired ink-outline centers, the rounded candidate has 6.62872 pixels RMS
and 11.78872 pixels maximum nearest-outline distance. This nearest-edge metric
does not establish which crossing corresponds to each source line or validate
hidden geometry. The inspected source overlay still shows a substantial shape
mismatch; the candidate is not accepted on the strength of this number.

The candidate has complete frame rails, bored shaft bearings and guide slider,
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
constraints. Their visible bores are modeled and checked separately. Contact
parameters and mass scale are inferred, not calibrated to a physical machine.

The groove is machined from a swept finite shoe footprint. The cutter includes
the interiors of the shoe's curved longitudinal sides, not just its nose
endpoints. Minimax fitting selects the finite shoe's machining orientation on
straight flanks and through the returns; it supplies no swivel setpoint to
MuJoCo. Affine flanks use an analytical support calculation. Opposite-handed
cuts merge at intersections, leaving eleven closed land patches on the core.

The latest return uses half-cosine displacement, joining uniform lead with
continuous velocity and acceleration. Unlike the earlier return, it has
nonzero curvature at the reversal itself. Together with modest passive swivel
damping, this substantially reduces end-contact spikes under reversed loads.
The finite shoe still starts interacting with a return before its midpoint
leaves the nominal uniform flank; measured speed checks retain these intervals.

The barrel core participates in contact. Its native cylinder fills the union
of the visible annular core and coaxial shaft within the barrel's axial extent.
The 256-sided rendered circumference differs from the analytic cylinder by
less than 0.004 engraving pixel. Core depth is an inferred parameter.

Contact decomposition now uses one convex hull per angular land strip rather
than two triangular prisms. These hulls also define the rendered solid. A
sampled comparison before the rounded-return change found a maximum addition
of 0.03354 engraving pixel relative to the prior triangulation. Canonical end
faces preserve exact cancellation between neighboring strips. Coalescing
nearly coincident intersection angles and reusing periodic endpoint values
prevents artificial radial seam caps.

Interior shoe strips with two distinct tangent coordinates have planar caps,
so they can be merged without changing the solid. Curved nose strips retain
triangular prisms; merging their entire hull would add material below the
concave inner surface. An independent polygon-area-times-thickness check
verifies the shoe volume. Coincident facet normals are smoothed without
joining opposing groove walls.

The 64-segment candidate has 661 native geoms, down from 1,283. All 5,168
compiled mesh vertices agree with rendered surfaces within 0.00003 source
pixel. Independent convex volumes agree with the rendered contact solids
within 0.000001 model-unit cubed. Twelve visible parts have positive volume,
closed topology and consistent normals. Checks reject radial seam caps and
sweep 481 prescribed shoe poses for machining interference. A further 2,401-pose
envelope study finds no nominal native penetration. These prescribed poses
are clearance diagnostics, not evidence of passive branch selection.

## Dynamics and browser evidence

Current study settings are explicit: 0.36-unit shoe straight half-length,
0.05-unit nose radius, 0.025-unit radial thickness, 0.001-unit cutter clearance,
two-radian rounded returns, optimized machining angles, 0.434-unit core radius,
0.001 swivel damping, 0.5 ms timestep, 2 ms contact response, 64 barrel segments
and a 20-second full output cycle. Each output cycle contains ten barrel turns.
Experimental defaults have not been promoted to a catalog configuration.

All following runs retain the intended branch and input progress. Travel and
penetration are in engraving pixels. Speed variation is the maximum error
from ideal speed over 100 ms intervals whose midpoint travel law is uniform;
it includes finite-shoe end effects rather than silently discarding them.

| Study | Simulated seconds | Max travel error | Max penetration | Max speed variation |
| --- | ---: | ---: | ---: | ---: |
| Nominal | 40 | 0.82480 | 0.03663 | 17.3970% |
| Upward external load +0.348483 | 40 | 0.82190 | 0.03077 | 29.5372% |
| Downward external load −0.174242 | 40 | 0.83238 | 0.02706 | 18.8977% |
| 128 barrel segments | 40 | 0.83626 | 0.03080 | 27.1325% |
| 0.25 ms timestep | 40 | 0.82088 | 0.02972 | 15.2523% |
| Six output cycles | 120 | 0.82480 | 0.07116 | 22.7593% |

Gravity remains enabled in both load studies; the upward load reverses the net
vertical force. These force magnitudes come from the candidate mass scale and
are not validated service loads. Maximum input-angle error is below 0.001571
radian, or 0.000784 radian with the halved timestep. Refinement checks establish
branch retention and bounded errors, not strict convergence of contact peaks.

In the long run, median 100 ms speed error is 2.04%, p90 is 8.08% and p95 is
9.05%. The largest interval is at cycle phase 3.7–3.8 seconds, approaching the
lower return. These measurements still fall short of an accepted uniform
traverse. Raising swivel damping to 0.003 gives 14.85% peak variation over two
cycles but does not resolve the geometric travel discrepancy. Reducing cutter
clearance to 0.0002 causes a severe jam and is rejected. A constant-impedance
contact experiment also worsened penetration. Those settings are not used by
the current browser or regression tests.

The dynamics probe records penetration witnesses with the pre-integration
pose used by `mj_step`, plus velocity and geom names. Pairing contact distances
with the following integrated pose had obscured the cause of contact peaks.
Speed windows now retain their endpoints and actual/ideal velocities.

The finite-surface audit replays 485 recorded passive states from the long run,
including the maximum travel, penetration and speed-window poses. It performs
37,787,522 independent surface queries using vertices, triangle centroids and
edge midpoints. Only shoe/land contact penetrates, by at most 0.07095 pixel,
consistent with the native peak. The slider retains its full 30.61667-pixel
guide engagement and clears the frame rails by at least 5.45830 pixels. The
spindle retains 6.00000 pixels of axial engagement in its socket, with sampled
radial clearance above 0.14755 pixel. Shaft/bearing and slider/guide radial
clearances exceed 0.19836 and 0.19993 pixel respectively. All actual transformed
vertices fit the camera bounds. This is sampled evidence, not a continuous
clearance proof; rigidly attached parts are excluded from interference pairs.

All thirteen current browser views are inspected: source front and overlay,
full assembly, both reversals, intermediate strokes, oblique and rear views,
and groove, follower, guide and socket details. No artificial barrel seam,
assembly crop, page error or unexpected warning appears. Detail cameras
intentionally crop the surrounding mechanism. The recessed floor has weak
visual contrast, and close-up shadows still show aliasing. The source groove
pattern remains visibly different.

The browser capture uses the app's actual `advance()` path and 50 ms frame
clamp, including final-frame processing in its wall clock. It averages 20.56 fps,
14.20 ms mean and 17.00 ms p95 update time. It advances 8.148 simulation seconds
in 8.2672 wall seconds, or 98.56% physical speed. The previous candidate averaged
10.30 fps and 50.72% physical speed. Current browser travel error is below
0.79013 pixel and input error below 0.001569 radian. Its playback `passed` flag
covers those checks, not source fidelity, loads or uniformity.

Four candidate and three shared-runtime tests pass. They cover finite contact
geometry, passivity without shoe contact, allocation disposal, two complete
contact-driven cycles, reset, frame partition and backward seeking. The
production build passes with the existing bundle-size warning. The candidate
is still absent from the catalog loader, so this build and the direct browser
study do not establish integrated 108 behavior.

## Remaining work and reproduction

Resolve the groove/source interpretation and improve uniformity through
crossings and end transitions. Then qualify the final parameter set, integrate
the mechanism and its timing/notes into the catalog, run browser regressions,
and inspect integrated desktop/mobile controls. The current tests deliberately
do not claim completion of these requirements.

Bulk reports and images remain outside Git. Current evidence includes
`/dev/shm/108-round-a.json`, `108-round-up.json`, `108-round-down.json`,
`108-round-fine.json`, `108-round-dt-half.json`, `108-round-long.json`,
`108-round-envelope.json`, `108-round-outlines.json`,
`108-round-clearances-b.json`, `108-round-browser.json`,
`108-round-inspection.json`, `108-round-final-tests.txt` and
`108-round-build.txt`. Reports retain frozen inputs and image hashes.

Use fresh prefixes and explicit options:

```sh
PROBE_PREFIX=/dev/shm/108-measured node scripts/measure-reverse-thread-source.mjs
TMPDIR=/dev/shm node --test tests/mujoco-reverse-thread-candidate.test.mjs tests/mujoco-runtime.test.mjs
export SIM_OPTIONS='{"shoeLength":0.36,"shoeRadius":0.05,"workingThickness":0.025,"curvedShoe":true,"reversalAngle":2,"timestep":0.0005,"contactTime":0.002,"period":20,"segments":64,"optimizeTilt":true,"optimizeReversalTilt":true,"coreRadius":0.434,"convexStrips":true,"swivelDamping":0.001,"roundReversals":true}'
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/108-study DURATION=120 node scripts/probe-reverse-thread-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/108-envelope node scripts/probe-reverse-thread-envelope.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/108-outlines SOURCE_REPORT=/dev/shm/108-measured.json node scripts/compare-reverse-thread-outlines.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/108-clearances DYNAMICS_REPORT=/dev/shm/108-study.json node scripts/audit-reverse-thread-clearances.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/108-browser node scripts/capture-reverse-thread-candidate.mjs
```

The browser study uses an existing Vite server on port 5174. Run one owned
browser at a time and hold source/build files unchanged during capture. Native
studies also verify their frozen inputs. Reports are retained before asserting
the browser playback tolerance; a recorded trajectory alone is not an assertion
of mechanical success.
