# Movement 162 — water-wheel governor review in progress

162 remains open. Production still uses the authored animation; the new native
selector study is not registered. Movement 161's completed bake remains intact.

## Source and existing behavior

The [original page](https://507movements.com/mm_162.html) has no available 2D
animation. Its caption describes a flyball governor driven by the upper bevel
pair. A pin on the sliding sleeve picks up a stud on either lower loose bevel:
the upper gear closes the water gate when speed increases, and the lower gear
reverses the gate shaft when speed falls. At proper speed neither is engaged.
The water wheel, gate and remote transmission are outside the engraving.

The current authored code uses instantaneous point-ball equilibrium and switches
the output directly between zero and spindle speed at predetermined thresholds.
It also solves the upper engagement threshold specifically to balance forward
and reverse output travel in one cycle. This guarantees a loop, but does not
establish finite pin/stud pickup or the governor's transient dynamics. Its
invented remote rack/gate assembly and bevel proportions also need source review.

Source measurements retained for the native study use 0.018 world units per
pixel: spindle x=263; head pivots near (247,55)/(279,55); elbows near
(205,160)/(320,160); balls near (178,232)/(347,231), radius 34 pixels; sleeve
pins (248,250)/(278,250); lower bevel apex (263,414). Symmetric inferred link
lengths are 3.414 to each ball, 2.035 to the elbow and 1.787 for each lower link.

## Coupled native selector study

`mujoco-water-governor/physics.js` has one actuated spindle and passive arm,
lower-link, sleeve, loose-gear and output joints. Site constraints close the
flyball linkage. The sleeve carries a finite rectangular pin; physical contact
with upper or lower finite studs accelerates the output. Two ideal equal-ratio
joint constraints represent the opposed bevel meshes. Neither output angle nor
engagement state is prescribed, and neither is reset at a speed-cycle boundary.

The full-linkage equilibrium helper from 161 sets nominal speed. Effective
masses are 1 kg per ball, 0.02 kg per upper/lower arm and 0.1 kg for the sleeve;
gravity is 98.1 world units/s². Gear inertias, output friction, contact softness,
stud depths and the 0.32 rad/s sinusoidal speed variation are inferred diagnostic
parameters. The initial neutral pin center is 0.08 world units above the lower
train apex. The upper stud spans +0.21 to +0.39, and lower stud −0.34 to −0.14;
the pin's axial half-height is 0.045. This leaves a finite neutral clearance.
No hydraulic load, water-wheel feedback or full visible-solid collisions are
represented yet.

The first eight-second run picks up forward drive at 1.1325 s and reverse drive
at 6.5635 s. Turning contact off leaves the output completely stationary despite
spindle rotation and sleeve motion. Moving the studs one radian delays forward
pickup to 1.315 s and misses reverse pickup during this particular speed cycle.
Constant nominal spindle speed holds the governor neutral, with no output motion.
Thus speed alone does not determine engagement: relative stud azimuth matters.

Maximum native linkage closure error is 1.79e-7 world units. Contact penetration
is about 0.00120 world units (0.067 engraving pixels); the soft ideal gear
constraint deviates by up to 0.00155 radians during impacts. Halving timestep
from 0.0005 to 0.00025 s changes spindle angle by at most 0.00002043 radians,
spread by 0.00003222 radians and output angle by 0.01065 radians over the first
cycle. The final output advance is 12.943 radians rather than an artificially
balanced zero. A repeated eight-second bake has not been established.

Three tests cover bidirectional passive pickup, removed-contact and shifted-stud
counterfactuals, neutral equilibrium, pin closure and bounded diagnostic contact
compliance. Reproduce the results with:

```sh
node --test tests/water-governor-physics.test.mjs
node scripts/probe-water-governor.mjs
```

`docs/validation/162-native-selector.json` records the five runs and source
hashes. Raw sampled trajectories stay outside Git. Next work is refining impact
and repeated-cycle behavior, rebuilding the source-visible gears and selector,
checking actual mesh clearances and baking validated motion for browser playback.
