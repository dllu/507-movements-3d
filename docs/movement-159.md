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

## Remaining work

Reconstruct the slack cord, preferably with a finite rope model that can be
baked along with the rigid motion, and assess pickup compliance and timestep/
rope-resolution convergence. Preserve the measured joints and floor. Assess
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
```

Small reports and provenance hashes are under `docs/validation/159-*.json`.
Raw trajectories stay in `/dev/shm`. No browser bundle or bake is shipped yet.
