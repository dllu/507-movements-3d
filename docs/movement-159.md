# Movement 159 — cord treadle review in progress

159 remains **open**. The existing taut-cord trajectory is mechanically plausible
under a driven disk, but takes the foot through the engraving's floor. Production
registration and visible geometry are unchanged at this diagnostic checkpoint.
Baking the old trajectory would preserve that error.

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

## Remaining work

Resolve the conflict between full disk rotation, the drawn foot/cord geometry
and floor level before authoring a replacement assembly. Assess the attachment
loop around the treadle, source-reading uncertainty and geometric alternatives;
record any necessary departures explicitly. Then build source-shaped supports,
bored pivots, finite pulley groove and connected cord terminations, qualify
clearances and passive dynamics with final inertias, and bake validated motion
for browser playback. Ground, camera, speed, restart and mobile checks remain
outstanding for that replacement.

```sh
node scripts/review-cord-treadle-clearance.mjs
node scripts/probe-cord-treadle.mjs
DT=.00025 REPORT=docs/validation/159-passive-fine.json SAMPLES=/dev/shm/159-passive-fine-samples.json node scripts/probe-cord-treadle.mjs
CORD=0 REPORT=/dev/shm/159-no-cord.json SAMPLES=/dev/shm/159-no-cord-samples.json node scripts/probe-cord-treadle.mjs
node scripts/compare-cord-treadle-native.mjs
node --test tests/cord-treadle.test.mjs
```

Small reports and provenance hashes are under `docs/validation/159-*.json`.
Raw trajectories stay in `/dev/shm`. No browser bundle or bake is shipped yet.
