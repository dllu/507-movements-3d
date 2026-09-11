# 074 · Mutilated bevel alternator

The fitted contact candidate remains isolated. Production is unchanged.

The [official description](https://507movements.com/mm_074.html) specifies
intermittent rotation in opposite directions for bevel gears A and B, driven
by mutilated bevel gear C. The animation tab is unavailable. Brown PDF page
26, printed page 22, is enlarged to 6000 pixels and cropped at
x470/y3870/1320×1370. Both the enlarged source and eight browser frames are
inspected and hashed in 074-baseline-captures.json.

The existing 24-tooth equal miter gears have an inner/outer distance ratio of
0.21875. Their broad faces almost reach the common apex. The source shows
narrower rims, a large central opening, short output shafts behind the gear
bodies, and a shaped input-shaft end. The baseline adds long shafts crossing
the apex, a rail, posts, rings and indicators. Its source camera is elevated
and oblique. Source tooth counts and pitch-cone ratios are not yet established;
the caption does not specify a 1:1 ratio.

The corrected working-surface sweep covers 291 poses and four directed gear
pairs, including a full turn and dense samples on both sides of each switch.
It checks 8,652,012 actual Float32 vertices, edge midpoints and face centers
from the bodies and installed teeth. It finds 14,340 penetrating samples,
with maximum depth 0.0546630. The worst collisions occur as the leading C
tooth enters the output that is still prescribed stationary. Phase and
pitch-point velocity invariants do not establish actual tooth clearance.

All three independent shaft pairs intersect. The two coaxial outputs overlap
by 0.01; the perpendicular input intersects the outputs to depths 0.0692794
and 0.0692370. Their bidirectional initial-pose sweep finds 316 penetrating
samples in 1,596 checks. Remaining support hardware is not certified.

The query boundary is independently checked for positive volume and paired
oriented edges. Each LatheGeometry body contains 384 zero-area pole triangles;
these are excluded from the distance query, leaving the actual closed
nondegenerate boundary. The earlier query allowed NaN distances to mask some
tooth intersections. Its report is preserved and superseded. An earlier
probe also mistook each shaft group for its child mesh; that failed run and
source are preserved. The corrected run rejects nonfinite distances and
completes successfully in 16.30 seconds. Its zero exit code means the
diagnosis ran, not that the mechanism passes clearance.

Playback currently takes two seconds per input revolution, with one
half-revolution output event per second. A replacement must measure the
source proportions, resolve the first and last tooth contacts, and distinguish
an ideal unmeshed dwell from a physical positive lock. The engraving contains
no separate locking device. Complete hardware, force/contact behavior,
source-fit, playback and regression checks remain pending.

An isolated reconstruction now uses 32 teeth on each output and 20 installed
teeth of a 40-tooth input pitch. These counts are a reconstruction choice:
local heel spacing fits approximately 32/36, but the visible rim proportions
require a larger driver. Twenty measured landmarks fit the retained ratio to
12.168 pixels RMS, with a 29.056-pixel maximum in the 1320-pixel scan. Separate
output/input inner-distance ratios of 0.6952413 and 0.6012149 improve the rim
widths. The 42/32 alternative fits these landmarks slightly better but agrees
less well with the visible input tooth spacing. The source does not specify
an exact ratio. A direct overlay, nine fitted views, nine earlier contact
views, three initial views and five source measurement images are inspected.

The shafts are integral with three closed turned bodies, ending behind their
respective gears. All 87 solids have positive volume, paired oriented edges,
outward normals and no degenerate triangles. Each relieved tooth component
retains a root attachment. Four sector-end teeth are trimmed against the
stationary output envelope. Conservative angular sweep cuts remove the
entry/exit collisions; sub-Float32 clipping features are cleaned before both
mesh construction and contact evaluation. The heel and toe surfaces retain
their conical form. Earlier numerical and clearance failures are preserved.

Actual contact determines the output angle under an ideal quasistatic
bearing-friction load. Three cycles at 1440 input steps per revolution repeat
within 1.524e-10 radians. Release searches resolve three small local maxima,
so the output holds the furthest angle reached when a flank recedes. This is
an ideal frictional dwell, not a positive lock. A common material sphere
between radii 1.11423 and 1.59994 validates angular footprint overlap as a
tooth-interference test up to the separately checked Float32 tolerance.

All 93 sampled active contact checks have a compressive driving reaction;
the flank-normal moment ratio agrees with independently bisected neighboring
contact angles to 7.916e-6. Actual tessellated skins meet at each tested pair.
The complete six-direction rigid-family sweep checks 364 poses and includes
every body, shaft and tooth. Its measured counts and tolerances are recorded
in 074-candidate-checkpoint.json. Runtime interpolation, continuous-time
clearance, integrated playback and production regression remain pending.

The later shading refinement uses analytic conical cap normals and a tighter
shadow camera. All 87 Float32 position/index buffers match the fitted geometry
byte-for-byte; 80 original tooth meshes have corrected normal buffers. The
new solid audit passes, and nine additional views are inspected. Details and
source archives are in 074-shading-refinement.json. An adaptive monotone
contact spline is being checked separately before runtime integration.
# Integrated runtime, rebuilt and verified

The gallery now uses `src/simulation/mutilated-bevel.js`, its motion module,
and an exported profile containing 5,047 contact knots and four relieved tooth
skins. The exported position, normal, color and index buffers match the audited
candidate byte for byte. All 87 mesh transforms and the motion state agree at
4,124 arbitrary times, including negative and multiple cycles.

The spline bake checked 20,184 independent positions, with maximum angular
error 3.12021524e-7 radians. A further 246-pose runtime audit made 31,202,640
actual-surface checks across all six directed gear/body/shaft pairs: no sample
penetrated beyond 1e-6, and the worst signed gap was -4.41812420e-7. The 91
selected active tooth pairs have zero triangle distance at the probe tolerance.
This sampled evidence does not constitute a continuous collision certificate.

An input turn takes eight display seconds. Every cubic interval was checked for
velocity extrema. The maximum output speed is 1.227265 rad/s, occurring over a
1.1816-microsecond interpolation interval near pickup. The narrow velocity
rounding remains within the independently validated position error; this is
a quasistatic display model, with no inertial dynamics or positive dwell lock.

Seven focused tests, all 3,056 numerical tests and the build pass. Eleven
integrated mechanical views and three UI frames are inspected. All 31 browser
checks pass, including rendering all 507 entries. Initial export signed-zero differences and two capture
harness navigation failures are preserved; the final export and fresh-page
capture checks pass. All 789 hashes in `074-verification-source-hashes.json`
match the completed regression. Eighteen historical UI screenshots were
restored after preserving the fresh regression captures. The final accepted
record is `074-integrated-checkpoint.json`; the complete 507-movement review
remains active.
