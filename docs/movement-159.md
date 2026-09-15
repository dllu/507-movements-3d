# Movement 159 — cord treadle review in progress

159 remains **open**, with a source-preserving route now established: let the
treadle contact the floor and the cord go slack. The old always-taut assumption
caused the floor penetration. Production registration and visible geometry are
unchanged while the slack cord and pickup dynamics are reconstructed.

## Source and clearance conflict

The [source page](https://507movements.com/mm_159.html) describes 158 with a cord
and pulley replacing the rod. It currently contains no animation definition.
The existing implementation measures disk center (113,266), radius 90px, crank
eye (178,303), guide center (279,106), guide pitch radius 45px, treadle pivot
(457,352), and attachment (319,389). The treadle's full length is approximately
297px. The floor line is y=457px in the 525px engraving.

The reusable cord model computes two tangent spans and an upper clockwise wrap,
then solves the fixed total length on the existing treadle branch. Across 2,049
poses it agrees with production's angle to 1.8e-15 radians, with cord-length
closure below 3.6e-15 world units. Thus the following problem is not caused by a
new choice of motion equation:

- Lowest foot center: y=590.19px, about **133.19px below the floor**.
- Lowest treadle angle: 0.93059rad, at about 23.58% of a revolution.
- The foot center is below the floor at 849 of 2,049 sampled phases.

These are centerline checks; the treadle thickness makes clearance worse.
They do not claim that all visible solids have already been audited.

A sensitivity check reduces crank radius along its drawn ray, retains the
initial treadle pose and reties the cord. Radius 60px still puts the foot at
556.74px; 45px gives 522.77px; even 20px gives 468.69px. The latter moves the
crank eye almost 55px from the engraving and still fails centerline clearance.
None of these sensitivity cases is registered in production. A small cosmetic
change to the crank is insufficient.

## MuJoCo diagnostic

The native model has two hinge coordinates and one disk actuator. The treadle
is passive under gravity. A spatial tendon wraps a fixed cylinder, with a
unilateral maximum length; it can pull but does not impose a compressive rod
constraint. There is no treadle actuator or prescribed treadle trajectory.
This uses MuJoCo's [spatial tendon and limit model](https://mujoco.readthedocs.io/en/stable/XMLreference.html#tendon-spatial).

For now, a uniform unit-mass beam supplies treadle inertia. Pulley inertia, foot
force, support collisions and inertias of the final visible solids are not
qualified. These are explicit prototype assumptions, not a final physical
reconstruction or a claim that the treadle is powering the disk in this test.

At a four-second revolution, four native cycles at 0.0005s and 0.00025s steps
stay within 9.8e-6rad of the independently solved taut angle at the actual disk
phase. The fine run's cord-length error lies between -3.2e-7 and 1.72e-5 world
units. Small soft-constraint transients are retained, not rounded to zero.
Across synchronized samples, timestep refinement changes disk angle by at most
0.000567rad and treadle angle by 0.000311rad. The floor conflict is orders of
magnitude larger.

Removing the cord releases the treadle into a gravity pendulum; it no longer
follows the coupled motion. Three tests check exact tangent geometry and the
floor conflict, independent MuJoCo tendon length, zero treadle actuation,
pulling-only constraint torque on the tested branch, and cord removal.

## Floor contact and slack-cord prototype

Adding the drawn floor as an actual contact surface resolves the foot conflict
without changing joint centers, crank radius or cord length. A box with the
provisional beam's dimensions contacts the floor; the unilateral tendon is free
to shorten its geometric path while the treadle rests. When the disk takes up
the slack, cord tension lifts the treadle again. This is a physically different
trajectory from forcing the cord to remain taut through the floor.

Four-cycle runs at 0.0005s and 0.00025s steps give:

| Quantity | Coarse | Fine |
| --- | ---: | ---: |
| Maximum treadle angle | 0.34554rad | 0.34560rad |
| Maximum slack length | 1.23287 | 1.23286 |
| Maximum soft floor penetration | 0.00165 | 0.00208 |
| Maximum soft cord extension | 0.00130 | 0.00138 |

Lengths above are world units. The fine floor penetration is about 0.12 source
pixels, compared with the original 133px floor conflict. The treadle still has
zero actuator torque. A fourth test verifies floor contact, significant slack,
subsequent taut phases and bounded floor penetration over two cycles.

This establishes the needed behavior, not a finished simulation. Across
synchronized coarse/fine samples, maximum treadle-angle difference is 0.00387rad.
Peak constraint torque rises from about 230 to 434 as the step is halved at the
ideal massless-cord pickup. The pickup impulse and final inertias therefore need
further qualification. A spatial tendon's reported path is the shortest wrapped
path; it does **not** provide the visible slack rope shape. Rendering that path
as a taut line would be incorrect during the floor-rest interval.

## Finite rope prototype

A separate native prototype now replaces the spatial tendon with a planar chain
of freely hinged finite capsules. It has rope self-contact, floor contact, a
passive rotating pulley driven by friction, and a connected treadle endpoint.
Only the disk is actuated. The rope has provisional total mass 0.08 and radius
0.045, with a unit-mass treadle and 0.05-mass pulley. Adjacent capsule overlap is
excluded by the articulated parent relationship; nonadjacent capsules collide.
The current chain has no bending stiffness and only small joint damping.

A 96-segment run at 0.0005s became unstable during pickup and MuJoCo reset its
state. The probe and regression test now explicitly reject any time reset.
At 0.0001s, the full first revolution completes without a reset. Source-space
panels show slack forming at the lower attachment while the foot rests, followed
by take-up and lifting. These panels are diagnostic views, not the final 3D
assembly.

The full-cycle regression test checks constant polygonal rope length, planar
motion, finite coordinates, endpoint closure, floor clearance, passive pulley
motion and exact reset. It passes with maximum endpoint error 0.00240 world
units (about 0.14 source pixels), foot penetration below 1e-6 world units, and
rope polygon-length error below 1e-9. A second timestep and a segment-count
comparison also complete the first turn:

| Comparison | Max treadle-angle difference | Max corresponding rope-point difference |
| --- | ---: | ---: |
| 96 segments, 0.0001s vs 0.00005s | 0.01707rad | 0.46261 world units (26.0px) |
| 96 vs 64 segments, 0.0001s | 0.02750rad | 0.32433 world units (18.2px) |

The rope-point comparison samples equal material fractions along each chain.
Chord-sum rest lengths differ slightly between resolutions. Independent capsule
distance checks at 0.02s intervals find maximum soft self-contact penetration
below 0.001 world units, pulley penetration below 0.0063, and no rope/floor
penetration. This finite sampling does not prove continuous clearance.

The motion and slack shape are therefore **not converged or production-qualified**.
Only the first revolution has been checked. The unstable coarse timestep is not
an acceptable default; the prototype now defaults to 0.0001s. Bending stiffness,
damping, contact compliance and longer-run behavior need investigation before
choosing a bake. Raw rope trajectories remain in /dev/shm.

## Bending and damping studies

The finite rope now optionally supports a straight-rest bending law. At each
internal hinge, stiffness is bending rigidity divided by the mean neighboring
link length; damping adds stiffness times a relaxation time. The attachment
hinge remains free. This scaling preserves the material law when segment count
changes. A native test verifies the straight rest shape at 32 and 64 segments,
length-scaled stiffness, and strictly dissipative damping. Zero bending remains
the default; the original freely hinged results above are the historical
baseline from commit d704f5f.

Two candidate material settings were tested for the first four-second turn.
Both use inferred bending rigidity 0.0002; relaxation times are 0.04s and 0.4s.
These are sensitivity studies, not measurements of the original cord.

| Relaxation | Timestep-refinement rope difference | 64/96-segment rope difference | Fine-run max attachment error |
| --- | ---: | ---: | ---: |
| 0.04s | 20.5px | 28.5px | 0.000128 world units |
| 0.4s | 25.2px | 37.8px | 0.0000923 world units |

Each row compares 0.0001s with 0.00005s at 96 segments, and 64 with 96 segments
at 0.0001s. All six runs completed without resets. Attachment and contact errors
improve, but rope-shape agreement does not consistently improve. The stronger
damping also changes the treadle's raised excursion, so it must not be treated
as an innocuous numerical adjustment. Diagnostic panels for the first candidate
were inspected; no material setting has been selected for production.

Only startup has been compared so far. Test longer runs and cycle-to-cycle
settling before deciding whether transient behavior or persistent sensitivity
is responsible. Do not infer a repeatable animation loop from first-cycle
success. The existing source-center, floor-contact and tension-only tests still
pass, but they do not qualify the finite rope's dynamics.

Reproduction for the two candidate studies (in addition to the earlier tests):

```sh
node --test tests/cord-treadle-bending.test.mjs
CORD_BENDING=.0002 CORD_DURATION_SECONDS=4 SAMPLES=/dev/shm/159-bend-96.json REPORT=/dev/shm/159-bend-96-report.json node scripts/probe-finite-cord-treadle.mjs
CORD_BENDING=.0002 DT=.00005 CORD_DURATION_SECONDS=4 SAMPLES=/dev/shm/159-bend-96-fine.json REPORT=/dev/shm/159-bend-96-fine-report.json node scripts/probe-finite-cord-treadle.mjs
CORD_BENDING=.0002 SEGMENTS=64 CORD_DURATION_SECONDS=4 SAMPLES=/dev/shm/159-bend-64.json REPORT=/dev/shm/159-bend-64-report.json node scripts/probe-finite-cord-treadle.mjs
CORD_STUDY=bend node scripts/review-finite-cord-treadle.mjs
```

For the stronger damping study, add CORD_RELAXATION=.4, replace the temporary
bend filenames with damped filenames, and use CORD_STUDY=damped for the review.
All small reports and provenance are preserved under 159-bend-* and
159-damped-* in docs/validation; raw trajectories remain outside Git.

## Longer-run settling and rigid core

The stronger-damping candidate (rigidity 0.0002, relaxation 0.4s) was run for
16 seconds at both 0.0001s and 0.00005s, with 96 segments. Both runs completed
without resetting, but neither establishes a periodic rope motion. Maximum
corresponding-vertex differences between cycles 3 and 4 are 1.1283 world units
in the coarse run and 0.7297 in the fine run. Differences between timesteps are
also substantial in later cycles; this is not merely a first-cycle startup issue.

At the proposed fourth-cycle loop boundary, maximum rope-position mismatches
are 0.1342 and 0.1973 world units (7.55 and 11.10 source pixels). One-sided
finite-difference seam velocity mismatches reach 5.57 and 8.05 world units/s.
These do not justify a seamless repeating bake. Pulley angle was omitted from
the seam requirement because an unmarked round pulley can rotate cumulatively.

A separate, unregistered 19-mesh rigid core is now authored in
mujoco-cord-treadle/solids.js. It includes the engraving's pedestals, bored disk
and treadle joints, pulley core and flanges, a floor, and an inferred rear pulley
mount. The core deliberately omits cord termination hardware. A 129-pose audit
across the coarse four-cycle trajectory checks 93 part pairs: no unintended
intersections in 3,903,080 point queries. Intended treadle/floor soft contact
reaches 0.00225 world units. This audit excludes the cord and unfinished fittings;
it is not a full assembly qualification. Source, resting and oblique diagnostic
views were inspected with the finite rope overlaid, making the missing
terminations visible rather than hiding them.

Before more material tuning, establish dimensional scale and consistent moving
inertias. The current prototype uses gravity 9.81 in display units, effectively
treating the 5.28-unit treadle as 5.28 metres. The engraving supplies no physical
dimensions. An explicit, plausible human-scale reconstruction is needed, together
with masses/inertias derived from the authored solids, before interpreting the
four-second timing and rope material constants physically. These are unresolved
model assumptions; no alternative scale or density has been selected yet.

```sh
CORD_BENDING=.0002 CORD_RELAXATION=.4 CORD_DURATION_SECONDS=16 SAMPLES=/dev/shm/159-settle-coarse.json REPORT=/dev/shm/159-settle-coarse-report.json node scripts/probe-finite-cord-treadle.mjs
CORD_BENDING=.0002 CORD_RELAXATION=.4 DT=.00005 CORD_DURATION_SECONDS=16 SAMPLES=/dev/shm/159-settle-fine.json REPORT=/dev/shm/159-settle-fine-report.json node scripts/probe-finite-cord-treadle.mjs
node scripts/review-cord-treadle-settling.mjs
node scripts/review-cord-treadle-core.mjs
```

## Explicit scale and rigid-body inertia

The next diagnostic uses **0.1 metre per display unit**: the treadle is
0.528 m long and the main disk is 0.32 m in diameter. The engraving gives no
physical dimensions or material specification. Uniform density 7200 kg/m³ is
an explicit reconstruction assumption, shared by the three moving rigid cores.
Signed tetrahedron integration of the closed visible meshes gives masses of
19.589 kg (disk and hub), 1.635 kg (treadle), and 3.667 kg (pulley and flanges).
Full inertia tensors include bores, flanges, and the treadle pivot boss; fixed
shafts and bearings do not contribute to moving mass. Cord fittings are still
missing, so these are core properties rather than final assembly properties.

The solver retains display coordinates and kilograms. Gravity is consequently
98.1 display units/s², and inertia is expressed in kg·display-unit². Multiply
reported inertia or joint torque by 0.01 to obtain SI values. The diagnostic
retains the earlier rope parameters rather than claiming a measured rope:
0.08 kg total mass, 4.5 mm physical radius, and, when enabled, bending rigidity
0.0002 in display units (0.0000002 N·m² at this scale). Bending relaxation remains
0.4 s. These material choices, friction, drive tracking and convergence still
need qualification. Previous runs remain useful as historical diagnostics,
but do not establish behavior at this physical scale.

`RIGID_CORE=1` on the finite-rope probe enables these properties. Omitting it
retains the historical diagnostic parameters for reproducibility. Three new
tests check translated-box volume/moments, annular-disk inertia and scale laws,
and the actual compiled MuJoCo body masses, centers, inertia traces and gravity.

The first scaled-core diagnostic completes 4 s at 0.1 ms steps without a native
reset. Maximum endpoint error is 0.000295 display units (0.017 source pixels),
and maximum foot penetration is 0.000328 units (0.018 pixels). The treadle spans
−0.2282 to 0.3453 radians. Disk phase differs from the commanded uniform angle
by up to 0.0409 radians (2.34°), so the retained drive gains also need review.
The first-cycle rope position seam is 0.0335 units (1.88 pixels); endpoint
closeness alone does not establish a repeatable orbit or velocity continuity.
This is a one-cycle diagnostic, not convergence or
repeatability qualification; see [report](validation/159-scaled-core.json).

Reproduce with:

```sh
RIGID_CORE=1 CORD_BENDING=.0002 CORD_RELAXATION=.4 CORD_DURATION_SECONDS=4 SAMPLES=/dev/shm/159-scaled-core.json REPORT=/dev/shm/159-scaled-core-report.json node scripts/probe-finite-cord-treadle.mjs
node --test tests/cord-treadle-inertia.test.mjs tests/cord-treadle-bending.test.mjs
```

## Cord anchor reconstruction

Both measured cord endpoints now have shouldered anchor studs attached to their
moving solids. Their circular shoulders follow the compact end fittings in the
engraving; shaft depth and rounded heads are inferred. The treadle fastening is
a stud reconstruction rather than the engraving's under-treadle loop. This is
an explicit remaining source-detail discrepancy. The native endpoint coordinates
and cord length have not moved. The flexible cord is secured inside each rounded
head: overlap of the immediate cord end with its own head is intentional, while
remote rope contact with either fitting must still clear.

Each stud is one closed surface of revolution, touching its parent face without
overlapping its volume. Mesh integration automatically includes its mass and
full inertia tensor, including the crank stud's off-axis contribution. The
annulus reference test now isolates the disk and hub, while compiled native
checks continue to cover the complete moving bodies. A new clearance regression
checks finite signed distances around both anchor heads: collapsed apex triangles
are removed from the lathed surfaces. All five inertia/bending tests pass. Front and oblique Chrome previews were inspected without page errors.

The first full rope/hardware audit found a remote rope segment entering the
new treadle anchor by 0.0299 display units at 0.86 s. The failure is retained in
[the pre-contact report](validation/159-rope-hardware-before-contact.json).
The scaled native model now includes both rounded heads as spherical collision
surfaces. Only rope links within 0.15 material units of their own secured end
are excluded; a remote slack loop must respond to head contact. The clearance
audit independently checks actual visible triangles rather than the native
sphere representation and rejects non-finite distance results.

With native head contact enabled, the same full-cycle audit reports no sampled
unintended penetration. Minimum remote rope/head clearance is 0.0000513 display
units at the treadle head, versus −0.0299 before contact was modeled. This small
positive sampled value is not a continuous clearance margin: the spatial
sampling bound is 0.0075 units. Pulley soft-contact penetration remains 0.00421
units. The rigid audit covers 21 parts, 132 pairs and 129 poses, with no unintended
intersections; the intended foot/floor penetration is 0.000321 units. Endpoint
error stays below 0.000281 units over this cycle. Reports:
[rope/hardware](validation/159-rope-hardware.json),
[rigid clearance](validation/159-anchor-clearance.json),
[native run](validation/159-anchor-contact.json).

```sh
RIGID_CORE=1 CORD_BENDING=.0002 CORD_RELAXATION=.4 CORD_DURATION_SECONDS=4 SAMPLES=/dev/shm/159-anchor-contact.json REPORT=/dev/shm/159-anchor-contact-report.json node scripts/probe-finite-cord-treadle.mjs
SAMPLES=/dev/shm/159-anchor-contact.json node scripts/review-cord-treadle-rope-hardware.mjs
SAMPLES=/dev/shm/159-anchor-contact.json REPORT=docs/validation/159-anchor-clearance.json node scripts/review-cord-treadle-core.mjs
```

## Lower treadle eye

The visible lower eye is now restored at engraving pixel (322, 408), with outer
radius 13 px and bore radius 7 px. Its local center is derived from the measured
initial treadle pose, independently of the upper cord endpoint (319, 389).
The eye, neck, and treadle form one non-overlapping closed solid, so the new mass
and inertia are included automatically. Its hidden neck, rigid construction and
connection to the upper fastening remain inferred; the engraving does not resolve
those details. The cord endpoint and nominal cord length remain unchanged.
The front Chrome preview now includes the under-treadle silhouette and open bore.
All five inertia/bending tests pass after this change.

The updated 21-part rigid assembly passes 132-pair checks at 129 native poses
(4,798,604 point queries). The only measured rigid penetration is intended
foot/floor contact, 0.00000923 display units. The full-cycle rope/hardware audit
also passes its sampled checks; minimum remote treadle-head clearance is
0.0000719 units and pulley soft penetration is 0.00541 units. These retain the
sampling limitations described above. See
[rigid audit](validation/159-lower-eye-clearance.json) and
[rope/hardware audit](validation/159-lower-eye-hardware.json).

Three new 4 s runs use this same geometry, scale, mass integration, bending,
and anchor contact. All complete without a native reset. Halving timestep
from 0.1 to 0.05 ms changes treadle angle by at most 0.00263 rad, but rope
material-point positions by 0.41569 display units (23.38 source pixels).
Changing 96 to 64 segments changes treadle angle by 0.02733 rad and rope
positions by 0.39813 units (22.39 pixels). Independent capsule checks report
positive nonadjacent self-clearance in all three runs; resolving self-contact
alone is therefore insufficient to explain this first-cycle disagreement.
The scaled rope still fails convergence qualification. Reports:
[96 segments](validation/159-lower-eye-native.json),
[finer timestep](validation/159-lower-eye-fine.json),
[64 segments](validation/159-lower-eye-64.json),
[comparison](validation/159-scaled-rope-comparison.json).

```sh
RIGID_CORE=1 CORD_BENDING=.0002 CORD_RELAXATION=.4 CORD_DURATION_SECONDS=4 SAMPLES=/dev/shm/159-lower-eye.json REPORT=/dev/shm/159-lower-eye-report.json node scripts/probe-finite-cord-treadle.mjs
RIGID_CORE=1 DT=.00005 CORD_BENDING=.0002 CORD_RELAXATION=.4 CORD_DURATION_SECONDS=4 SAMPLES=/dev/shm/159-lower-eye-fine.json REPORT=/dev/shm/159-lower-eye-fine-report.json node scripts/probe-finite-cord-treadle.mjs
RIGID_CORE=1 SEGMENTS=64 CORD_BENDING=.0002 CORD_RELAXATION=.4 CORD_DURATION_SECONDS=4 SAMPLES=/dev/shm/159-lower-eye-64.json REPORT=/dev/shm/159-lower-eye-64-report.json node scripts/probe-finite-cord-treadle.mjs
CORD_STUDY=scaled node scripts/review-finite-cord-treadle.mjs
SAMPLES=/dev/shm/159-lower-eye.json REPORT=docs/validation/159-lower-eye-clearance.json node scripts/review-cord-treadle-core.mjs
SAMPLES=/dev/shm/159-lower-eye.json REPORT=docs/validation/159-lower-eye-hardware.json node scripts/review-cord-treadle-rope-hardware.mjs
```

## Initial buckling sensitivity

Matching material-vertex comparisons localize the large early timestep
sensitivity to the lower slack cord after the foot reaches the floor near 0.1 s.
At 0.2 s, the second vertex above the secured end lies 0.1763 display units left
of the endpoint in the 0.1 ms run, but 0.1107 units right in the 0.05 ms run.
The treadle itself remains at nearly identical floor-rest angles. This supports
buckling-branch sensitivity as a contributor, rather than simply divergent
rigid-link motion. The first differences are already present in the incoming
cord before floor contact, so buckling is not established as the sole cause.

An optional `initialBow` parameter now adds a smooth sine-squared lateral bow
to the outgoing leg at initialization. A 0.02-unit amplitude is 1.125 source
pixels (2 mm at the assumed physical scale), with unchanged endpoints and zero
bow slope at each end. It is an explicit initial-shape assumption, not a runtime
forcing term; all subsequent rope joints remain passive. Default zero preserves
the historical diagnostic. A test checks source displacement, fixed endpoints,
planarity, single-actuator count and deterministic reset.

In a 0.4 s diagnostic at both timesteps, this bow selects the same initial
buckling side. Maximum material-vertex disagreement drops from 0.3521 to 0.0683
units (19.81 to 3.84 source pixels). This is evidence of initial-condition
sensitivity, not a convergence certificate. See
[short comparison](validation/159-rope-buckling.json).

Over a full 4 s cycle the bow reduces maximum matching-vertex disagreement
from 0.42974 to 0.15235 units (24.17 to 8.57 source pixels). These are direct
96-link vertex comparisons, so they differ slightly from earlier 129-fraction
resampling metrics. The result remains too sensitive to claim convergence;
the initial bow is an experimental parameter, not a qualified production choice.
See [full comparison](validation/159-rope-buckling-full.json) and native reports
[coarse](validation/159-bow-full-native.json),
[fine](validation/159-bow-full-fine-native.json).

The bowed trajectory passes the rigid-part audit but **fails the rope/hardware
audit**: 0.01437 units of penetration into the treadle head at 0.34 s, at material
distance 11.02141 along the rope. This is outside the intended last 0.15 units
of secured cord. The native model currently excludes whole endpoint-adjacent
links whenever any part lies inside that region; the unchecked remainder can
fold back into the head. The next fix is to restrict the exclusion spatially
along those links, maintaining head contact on the remainder. Do not enlarge
the audit exemption to hide this collision. Reports:
[rigid audit](validation/159-bow-clearance.json),
[failed rope/hardware audit](validation/159-bow-hardware.json).

```sh
RIGID_CORE=1 CORD_INITIAL_BOW=.02 CORD_BENDING=.0002 CORD_RELAXATION=.4 CORD_DURATION_SECONDS=4 SAMPLES=/dev/shm/159-bow-full.json REPORT=/dev/shm/159-bow-full-report.json node scripts/probe-finite-cord-treadle.mjs
RIGID_CORE=1 DT=.00005 CORD_INITIAL_BOW=.02 CORD_BENDING=.0002 CORD_RELAXATION=.4 CORD_DURATION_SECONDS=4 SAMPLES=/dev/shm/159-bow-full-fine.json REPORT=/dev/shm/159-bow-full-fine-report.json node scripts/probe-finite-cord-treadle.mjs
FULL=1 node scripts/review-cord-treadle-buckling.mjs
node --test tests/cord-treadle-initial-bow.test.mjs
```

## Material-clipped anchor contact

Anchor contact now excludes exactly the first/last 0.15 material units at the
matching secured end. A link crossing that boundary gets a clipped capsule for
head contact; its remaining original capsule still handles pulley, floor and
self-contact. Remote links use their full capsule. The contact capsules add no
mass and do not change visible rope geometry, link lengths or inertias.

Explicit geom pairs preserve head contact even for a direct child body. Their
friction and solver parameters are specified explicitly, as required by the
[MuJoCo pair documentation](https://mujoco.readthedocs.io/en/latest/XMLreference.html#contact-pair).
This replaces the previous whole-body exclusions rather than broadening the
accepted fastening overlap. The actual visible-mesh audit still exempts only
the secured material region.

A regression runs the bowed floor-impact trajectory for 0.4 s, checking every
0.002 s. It independently clips rope segments by material length and measures
capsule/head distance against the actual moving head centers. It passes a
0.001-unit penetration limit. The six existing inertia, bending and initial-bow
tests also pass.

The new regression was also run against the previous commit’s physics module;
it fails there with 0.01469 units of head penetration, confirming that the test
captures the original bug. It passes with the material-clipped contact change.

**Full-cycle qualification still fails.** Both 4 s runs finish without native
reset, but the 0.1 ms trajectory reaches treadle angle −0.45848 rad whereas the
0.05 ms run reaches −0.22802 rad. Maximum paired timestep difference is 0.23077
rad at the treadle and 0.58478 display units at a rope vertex. The coarse visible
hardware audit finds 0.00201 units of later rope/head penetration at 1.62 s.
The rigid audit also finds 0.06954 units of treadle/crank-stud penetration late
in the coarse cycle. The stud’s shaft is currently visible but not included in
native rigid collision: this cannot be accepted just because the smaller-swing
trajectory avoids it. Further timestep refinement and complete rigid-contact
coverage are needed before choosing any bake. Reports:
[native coarse](validation/159-clipped-anchor-native.json),
[native fine](validation/159-clipped-anchor-fine.json),
[timestep comparison](validation/159-anchor-refinement.json),
[failed hardware audit](validation/159-clipped-anchor-hardware.json),
[failed rigid audit](validation/159-clipped-anchor-clearance.json).

```sh
RIGID_CORE=1 CORD_INITIAL_BOW=.02 CORD_BENDING=.0002 CORD_RELAXATION=.4 CORD_DURATION_SECONDS=4 SAMPLES=/dev/shm/159-clipped-anchor.json REPORT=/dev/shm/159-clipped-anchor-report.json node scripts/probe-finite-cord-treadle.mjs
RIGID_CORE=1 DT=.00005 CORD_INITIAL_BOW=.02 CORD_BENDING=.0002 CORD_RELAXATION=.4 CORD_DURATION_SECONDS=4 SAMPLES=/dev/shm/159-clipped-anchor-fine.json REPORT=/dev/shm/159-clipped-anchor-fine-report.json node scripts/probe-finite-cord-treadle.mjs
node --test tests/cord-treadle-anchor-contact.test.mjs
node scripts/review-cord-treadle-anchor-refinement.mjs
SAMPLES=/dev/shm/159-clipped-anchor.json REPORT=docs/validation/159-clipped-anchor-hardware.json node scripts/review-cord-treadle-rope-hardware.mjs
SAMPLES=/dev/shm/159-clipped-anchor.json REPORT=docs/validation/159-clipped-anchor-clearance.json node scripts/review-cord-treadle-core.mjs
```

## Native crank-stud contact

The scaled native model now includes the visible crank-stud shaft as a cylinder
of radius 0.055, extending from z = −0.13 to 0.38. It contacts the treadle beam
without changing the visible geometry or the mesh-derived moving inertia. A new
regression puts the two bodies at the recorded 3.76 s intersecting pose and
requires a native shaft/beam contact, then checks that reset restores a clear
initial pose. It passes, as do the seven other inertia, bending, initial-bow and
anchor-contact tests.

In the coarse full-cycle trajectory, maximum sampled stud/treadle overlap drops
from 0.06954 to 0.0002383 display units (about 0.0134 source pixels). The audit
now reports this modeled working contact separately, with a 0.001-unit limit;
it still rejects larger penetration. This acknowledges the native soft-contact
model without hiding the measured depth. The coarse rope/head audit still fails
with 0.00201 units of later penetration. The 0.05 ms run passes its sampled
rope/hardware audit. These are separate checks from timestep convergence.

All three 4 s stud-contact runs finish without native reset. The 0.1 ms run
still develops the larger swing and loads the driven disk against the stud,
with up to 0.3782 rad tracking error. The 0.05 and 0.025 ms runs remain on the
smaller swing: maximum treadle disagreement is 0.001494 rad, but rope vertices
still differ by 0.34703 units (19.52 source pixels) during slack motion. Both
finer trajectories pass the sampled rigid and rope/hardware audits. Neither is
a qualified loop: initial/final rope position gaps are 0.03082 and 0.03493 units,
and these position checks do not establish matching velocities or steady state.
Further blind timestep reduction is not justified as the sole remedy; rope
initial-condition/material sensitivity and contact discretization remain open.
See [refinement and seams](validation/159-stud-refinement.json),
[native coarse](validation/159-stud-coarse-native.json),
[native fine](validation/159-stud-fine-native.json),
[native finer](validation/159-stud-finer-native.json),
[coarse rigid audit](validation/159-stud-coarse-clearance.json),
[coarse failed hardware audit](validation/159-stud-coarse-hardware.json),
[fine rigid audit](validation/159-stud-fine-clearance.json),
[fine hardware audit](validation/159-stud-fine-hardware.json),
[finer rigid audit](validation/159-stud-finer-clearance.json),
[finer hardware audit](validation/159-stud-finer-hardware.json).

```sh
RIGID_CORE=1 CORD_INITIAL_BOW=.02 CORD_BENDING=.0002 CORD_RELAXATION=.4 CORD_DURATION_SECONDS=4 SAMPLES=/dev/shm/159-stud-coarse.json REPORT=/dev/shm/159-stud-coarse-report.json node scripts/probe-finite-cord-treadle.mjs
RIGID_CORE=1 DT=.00005 CORD_INITIAL_BOW=.02 CORD_BENDING=.0002 CORD_RELAXATION=.4 CORD_DURATION_SECONDS=4 SAMPLES=/dev/shm/159-stud-fine.json REPORT=/dev/shm/159-stud-fine-report.json node scripts/probe-finite-cord-treadle.mjs
RIGID_CORE=1 DT=.000025 CORD_INITIAL_BOW=.02 CORD_BENDING=.0002 CORD_RELAXATION=.4 CORD_DURATION_SECONDS=4 SAMPLES=/dev/shm/159-stud-finer.json REPORT=/dev/shm/159-stud-finer-report.json node scripts/probe-finite-cord-treadle.mjs
node scripts/review-cord-treadle-stud-refinement.mjs
node --test tests/cord-treadle-stud-contact.test.mjs tests/cord-treadle-anchor-contact.test.mjs tests/cord-treadle-inertia.test.mjs tests/cord-treadle-initial-bow.test.mjs tests/cord-treadle-bending.test.mjs
```

## Clear initial pulley fit

The previous polygonal rope began with 0.00212 display units of pulley
penetration. Scaled models now default to a small radial lift of interior
vertices near the guide, fading smoothly away from it. A bracketed search
clears every initial centerline segment by 0.000001 units above the pitch radius.
Secured endpoints stay fixed. This prepares only the initial geometry and its
reference velocities; it is not a runtime force or shape projection.

At 96 segments the maximum displacement is 0.002126 units (0.120 source pixels).
Rest length changes from 11.181589 to 11.187717 units, compared with the continuous
source-path length 11.183444. Polygonal approximation and the small initial bow
affect this value; material length is not exactly identical across resolutions.
`CORD_CLEAR_PULLEY=0` reproduces the historical inscribed initialization. The
other parameters are unchanged. A new test at 64 and 96 segments checks initial
capsule clearance, native contacts, preserved endpoints, small source displacement
and attachment closure. All nine focused tests pass.

Two 0.4 s runs at 0.05 and 0.025 ms finish without reset. Initial clearance is
positive and subsequent maximum pulley penetration falls to 0.000453 and
0.000345 units. **Timestep disagreement does not improve:** maximum vertex
separation rises from 0.07629 to 0.36364 units in the short window, concentrated
near the lower endpoint. Removing the initial overlap is geometrically necessary
but does not cure buckling sensitivity. Inspect the local end-shape model before
more long runs; do not revert to overlapping geometry for a better score.
Reports: [comparison](validation/159-initial-clearance.json),
[native fine](validation/159-initial-clear-fine-native.json),
[native finer](validation/159-initial-clear-finer-native.json).

```sh
RIGID_CORE=1 DT=.00005 CORD_INITIAL_BOW=.02 CORD_BENDING=.0002 CORD_RELAXATION=.4 CORD_DURATION_SECONDS=.4 SAMPLES=/dev/shm/159-initial-clear-fine.json REPORT=/dev/shm/159-initial-clear-fine-report.json node scripts/probe-finite-cord-treadle.mjs
RIGID_CORE=1 DT=.000025 CORD_INITIAL_BOW=.02 CORD_BENDING=.0002 CORD_RELAXATION=.4 CORD_DURATION_SECONDS=.4 SAMPLES=/dev/shm/159-initial-clear-finer.json REPORT=/dev/shm/159-initial-clear-finer-report.json node scripts/probe-finite-cord-treadle.mjs
node scripts/review-cord-treadle-initial-clearance.mjs
node --test tests/cord-treadle-initial-clearance.test.mjs tests/cord-treadle-anchor-contact.test.mjs tests/cord-treadle-stud-contact.test.mjs tests/cord-treadle-inertia.test.mjs tests/cord-treadle-initial-bow.test.mjs tests/cord-treadle-bending.test.mjs
```

## Remaining work

Qualify timestep convergence with crank-stud/treadle contact enabled. Qualify
the inferred rope/anchor fastening and final moving assembly with material-clipped
anchor contact.
Refine the finite rope at the explicit physical scale and qualify
timestep/rope-resolution convergence and longer-run behavior. Preserve the
measured joints and floor. Qualify
clearances and passive dynamics with final inertias before registering a bake.
Ground rendering, camera, speed, restart and mobile checks remain outstanding
for that replacement.

```sh
node scripts/review-cord-treadle-clearance.mjs
node scripts/probe-cord-treadle.mjs
DT=.00025 REPORT=docs/validation/159-passive-fine.json SAMPLES=/dev/shm/159-passive-fine-samples.json node scripts/probe-cord-treadle.mjs
CORD=0 REPORT=/dev/shm/159-no-cord.json SAMPLES=/dev/shm/159-no-cord-samples.json node scripts/probe-cord-treadle.mjs
node scripts/compare-cord-treadle-native.mjs
FLOOR=1 REPORT=docs/validation/159-floor-passive-coarse.json SAMPLES=/dev/shm/159-floor-coarse-samples.json node scripts/probe-cord-treadle.mjs
FLOOR=1 DT=.00025 REPORT=docs/validation/159-floor-passive-fine.json SAMPLES=/dev/shm/159-floor-fine-samples.json node scripts/probe-cord-treadle.mjs
FLOOR=1 node scripts/compare-cord-treadle-native.mjs
node --test tests/cord-treadle.test.mjs
node --test tests/finite-cord-treadle.test.mjs
DT=.00005 CORD_DURATION_SECONDS=4 SAMPLES=/dev/shm/159-rope-96-fine.json REPORT=/dev/shm/159-rope-96-fine-report.json node scripts/probe-finite-cord-treadle.mjs
SEGMENTS=64 CORD_DURATION_SECONDS=4 SAMPLES=/dev/shm/159-rope-64.json REPORT=/dev/shm/159-rope-64-report.json node scripts/probe-finite-cord-treadle.mjs
node scripts/review-finite-cord-treadle.mjs
```

Small reports and provenance hashes are under `docs/validation/159-*.json`.
Raw trajectories stay in `/dev/shm`. No browser bundle or bake is shipped yet.
