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
gravity is 98.1 world units/s². Gear inertias, output friction, contact softness
and the 0.32 rad/s sinusoidal speed variation are diagnostic assumptions. No
hydraulic load, water-wheel feedback or complete visible-solid collisions are
represented yet.

## Stud dimensions and missing backing surfaces

Closer raster inspection places the upper stud root/tip near rows 388/401 and
the lower stud tip/root at 418/435, with the pin between about rows 405 and 411.
The revised upper stud spans +0.234 to +0.468 world units relative to the lower
train apex; the lower spans −0.378 to −0.072. The pin center starts at +0.108
with axial half-height 0.045. Depths and radial dimensions remain inferred.

A long run exposed a defect in the first native study: with the gear bodies
omitted from collision, the pin could pass through the upper backing and settle
on top of the upper stud. It then stayed coupled through the whole speed cycle.
The diagnostic now includes coaxial backing surfaces at the stud roots. Only
the pin collides with these proxies; its minimum radius of 0.16 lies outside
the intended 0.14 bore, so the solid-cylinder proxy gives the same pin contact
surface as an annulus. Visible bodies still need actual bores and source profiles.

The overspeed regression proves that removing the backing permits the former
pass-through, while the backed pin stays within the physical selector gap.
This is a contact model correction, not an imposed sleeve travel limit.

## Native evidence and remaining limits

The corrected eight-second run picks up forward drive at 1.1325 s and reverse
drive at 5.4395 s. Turning contact off leaves the output stationary despite
spindle rotation and sleeve motion. Shifting the studs one radian delays these
pickups to 1.3100 and 5.8575 s. Constant nominal speed holds neutral without
output motion. Relative stud azimuth determines pickup alongside speed and lift.

At the original 0.0005-second timestep, maximum linkage closure error is
9.07e-7 world units, penetration 0.000980 world units (0.055 source pixels),
and soft bevel-constraint error 0.00155 radians. Final output advance is
6.624 radians, not a forced zero. Four tests cover bidirectional pickup,
removed-contact and shifted-stud counterfactuals, neutral equilibrium, clock
continuity, pin closure and the added backing surfaces.

Four-timestep refinement samples the first eight seconds every 0.002 seconds.
Successive maximum output-angle differences are 0.02112, 0.00483 and 0.00938
radians for 0.0005 → 0.00025 → 0.000125 → 0.0000625-second steps. The final
pair changes sleeve height by 0.000279 world units, about 0.0155 source pixels.
The impact-driven output difference is not monotonic; convergence is not yet
qualified. See `docs/validation/162-contact-refinement.json`.

A separate repeated-cycle study uses an 8.4342254-second input period (seven
nominal spindle revolutions), with 64 cycles at each of two timesteps. Both
runs retain forward and reverse output during all final eight cycles. The pin
never passes the backing faces: observed offsets span −0.146 to +0.4234 world
units. However, last-cycle output phase closure errors range from roughly
0.34 to 2.39 radians, and internal coordinates also fail to close. Merely
making spindle travel an integer number of turns does not produce a valid
baked loop. See `docs/validation/162-repeated-selector.json`.

Reproduce the evidence with:

```sh
node --test tests/water-governor-physics.test.mjs
node scripts/probe-water-governor.mjs
node scripts/refine-water-governor.mjs
node scripts/settle-water-governor.mjs
```

Reports include source hashes; raw trajectories remain outside Git. Next work
is resolving impact/repeated-cycle behavior, building the source-visible gears
and selector, checking actual mesh clearance and baking validated playback.
Production 162 remains unchanged.
