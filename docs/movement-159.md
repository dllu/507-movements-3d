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

## Remaining work

Refine the finite rope, especially its bending/damping and pickup compliance,
and establish timestep/rope-resolution convergence and longer-run behavior. Preserve the measured joints and floor. Assess
the attachment loop around the treadle, then build source-shaped supports,
bored pivots, a finite pulley groove and connected cord terminations. Qualify
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
