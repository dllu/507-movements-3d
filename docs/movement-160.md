# Movement 160 — spring-return treadle, review in progress

160 remains open. The production animation is still the authored model; the
spatial band helper is a tested candidate for its replacement.

## Source

The [original page](https://507movements.com/mm_160.html) specifies a treadle,
return spring and a band passing once around a pulley. Its Animated tab is
unavailable; there is no original 2D animation to use as a motion oracle.
The local engraving is `public/engravings/mm_160.png` (525 × 525 pixels).

The current measured centers are pulley (319,252), treadle pivot (160,413),
treadle band eye (360,381) and upper band attachment (362,104), with a 43-pixel
pulley pitch radius. These identify the mechanism but are not yet a complete
outline fit. The source shows a solid pulley face and shaped treadle pedestal;
the existing spoked pulley, generic rear posts, bulky foot plate and oblique
camera do not reproduce that appearance. A packaged browser screenshot was
inspected at `/dev/shm/160-legacy-source.png`.

## Reproduced failures

`node scripts/review-spring-return-treadle.mjs` reviews the existing model at
257 phases. The full wrap lies entirely in one plane. Two material points
almost one circumference apart overlap at every phase; 137 phases have exactly
coincident centerlines. The maximum radial-tube overlap witness is 0.096 world
units, or 5.33 engraving pixels. Exact band-length closure therefore does not
establish physical correctness.

The visible spring centerline varies from 6.01768 to 6.14935 world units,
a 2.19% change. It is a hand-shaped bending curve, not an inextensible elastic
leaf. The reported spring force is calculated after prescribing the treadle
angle and does not drive the return. Its four-second cycle is a reasonable
initial display speed, but its dynamics remain unqualified. The rendered foot
stays 0.0983 world units above the source floor in this audit; floor penetration
is not the reproduced problem here. This is not a full solid collision audit.

## Spatial full-wrap candidate

`AxiallySeparatedBand` lifts an arclength-parameterized planar route of constant
length L to z(s) = z0 + (z1-z0)s/L, where s is material distance from the upper
attachment. All XY coordinates are unchanged. The spatial length is exactly
sqrt(L² + (z1-z0)²), also constant. Smooth planar tangencies stay smooth because
the depth slope is the same on the straight spans and the wrap.

Each material point keeps its depth as the mechanism moves. The helical contact
pattern migrates around the drum, but the material has zero axial velocity.
Inside the wrap, its XY velocity still matches the drum's rotation. Thus the
spatial separation does not require invented axial slip or band stretching.
The test checks that identity with central differences at fixed material
coordinates, not merely a stored no-slip error field.

The candidate uses inferred endpoint depths 0.24 and 0.72 world units. Across
129 poses, 1,025 points per route give a conservative nonlocal surface-clearance
lower bound of 0.05772 world units (3.21 pixels), after subtracting two sample
spacings and the band diameter. Sections within four radii of material distance
are excluded from this nonlocal check. The wrap's axial surface envelope is
[0.27933,0.65541]; a replacement drum must accommodate this moving envelope.
The test's maximum no-slip velocity error is 1.62e-10 world units/second;
4,096-chord length integration differs from exact length by at most 1.96e-6.
These are sampled-pose checks, not continuous-time hardware qualification.

Reproduce with:

```sh
node scripts/review-spring-return-treadle.mjs
node scripts/review-spatial-treadle-band.mjs
node --test tests/axially-separated-band.test.mjs
```

Small reports with source hashes are in `docs/validation/160-*.json`.

## Next work

Reconstruct the source leaf and supported solid pulley, with appropriately
separated attachment depths and a drum wide enough for the full wrap. Replace
the stretching spring curve and qualify the spring-driven return under explicit
load/material assumptions. Inspect actual band/drum, attachment, spring and
frame clearances through the cycle. Then bake expensive work and verify framing,
restart, speed and desktop/mobile playback before production registration.

## Isolated native leaf spring

`mujoco-spring-return-treadle/source.js` now records the spring centerline from
ink-boundary midpoints. The obscured tie region is interpolated between visible
leaf readings. A Catmull–Rom curve through those readings provides a common
rest geometry for refinement. At 64 loaded-span links plus 12 tail links,
the discrete centerline lies within 0.026 pixels of the recorded readings.
This checks reproduction of the trace, not its measurement uncertainty.
An engraving overlay of rest and loaded centerlines was inspected in
`/dev/shm/160-leaf-overlay.png`.

`leaf-physics.js` is an isolated MuJoCo bending diagnostic. The first link fixes
the root position and direction; subsequent hinges have rest curvature from
the source and stiffness EI divided by their adjacent half-length sum. The
links cannot stretch. Distributed mass and hinge damping are explicit. A
one-second cosine load ramp applies a downward point force to the actual tie,
then releases it at two seconds. There are no actuators and no prescribed
return trajectory. Cartesian kinematics are refreshed before force application
and state inspection so the force lever arms match current joint positions.
The point-force generalized torques pass an independent virtual-work check.

The diagnostic uses mass 0.2, effective EI 2000, bending viscosity 200 and load
10 in consistent kilogram/world-length/second units. These are inferred study
parameters, not measured material properties. Gravity, the treadle, band forces,
pulley inertia, visible spring cross-section and hardware contacts are still
absent. The source's initial curve is treated as the unloaded rest shape for
this isolation test; assembly preload may require a different stress-free shape.
The formulation uses MuJoCo's native
[joint stiffness, spring reference and damping](https://mujoco.readthedocs.io/en/latest/XMLreference.html#body-joint).

Four runs compare 16/32/64 loaded-span links at 0.0005-second steps and 64 links
at 0.00025 seconds. Maximum individual-link length error is 7.3e-16 world
units. The loaded tie changes by 0.01723 world units from 16 to 32 links and
0.008730 from 32 to 64 (0.49 engraving pixels). The halved timestep changes
the loaded tie by 7.1e-11 world units. Link refinement, including the finite
clamped first segment, remains the larger discretization error.

At the finest tested resolution, the tie moves 0.04308 world units right and
0.38111 down under load: about 2.39 and 21.17 pixels. It returns to its initial
position within 1e-7 world units by four seconds without an actuator. The
assembly must therefore permit lateral spring-eye movement and recompute both
band tangencies. Keeping the upper band endpoint on a prescribed vertical line
would reintroduce a constraint absent from the source.

Reproduce with:

```sh
node scripts/probe-return-leaf.mjs
node --test tests/return-leaf.test.mjs tests/axially-separated-band.test.mjs
```

All four tests pass. Reports and provenance are in
`docs/validation/160-return-leaf.json`; raw motion remains in `/dev/shm`.
This prototype is not registered in production. Next couple the spring to the
band and treadle, qualify preload and passive return, and reconstruct the
source-shaped visible assembly.

## Coupled spring, band and treadle diagnostic

`band-route.js` computes both moving-end tangencies and retains one complete
clockwise winding through entry/exit angular-order changes. It reproduces the
old vertical-end route to numerical precision while allowing lateral motion of
the spring tie. Its four endpoint length derivatives agree with independent
central differences within 2e-9; the span/wrap tangencies remain continuous.
Those derivatives transmit band tension to every ancestor leaf hinge and the
treadle hinge through virtual work.

`coupled-physics.js` adds a 0.5 kg treadle, gravity and downward foot pressure.
There are no actuators. A tension-only compliant ideal band has stiffness 20000
and damping 20; it cannot push when slack. The pulley remains ideal and massless.
World gravity 98.1 corresponds to an inferred 0.1 m per world unit and ordinary
9.81 m/s² gravity. Existing leaf properties are consistent with that scale;
they remain effective assumptions rather than a measured material specification.

The source shape must be a **loaded** equilibrium rather than a stress-free
leaf. Initialization computes the band tension needed to support the treadle's
weight, then infers spring reference angles that balance that tension and leaf
gravity in the engraved pose. The band rest length includes the corresponding
small elastic extension. Initial planar tension is 36.0231 world-force units
(3.60231 N at the inferred scale). This calibrates unknown assembly prestress;
it does not prescribe the subsequent joint trajectory. A no-foot-pressure test
holds the source pose within 1e-10 radians. Removing the band releases the
otherwise passive treadle under gravity.

Foot pressure follows a smooth squared-sine pulse during the first half of each
four-second cycle and is absent during the second half. Peak pressure is six
world-force units (0.6 N). During the last of four simulated cycles, the treadle
ranges from -0.094853 to +0.005429 radians relative to the source pose. It moves
under the combined input force, gravity and stored spring energy. The last two
cycle-end joint configurations differ by less than 2.4e-15 radians. The peak
band extension is 0.002261 world units, or 0.126 engraving pixels, including
prestretch. This finite compliance is explicit; the candidate does not claim
an exactly rigid no-slip transmission at finite stiffness.

Halving native timestep from 0.00025 to 0.000125 seconds changes the final-cycle
treadle angle by at most 1.874e-5 radians and the upper attachment position by
0.00006823 world units (0.0038 pixels), measured at matching 0.01-second samples.
Nine route, leaf and coupling tests pass. The earlier zero-gravity coupling
trial let the returning treadle coast upward after losing tension; it is not
the default candidate. Gravity and inferred source-pose prestress address that
missing load rather than imposing an artificial return trajectory.

```sh
node scripts/probe-spring-treadle.mjs
node --test tests/spring-treadle-coupled.test.mjs tests/return-band-route.test.mjs tests/return-leaf.test.mjs tests/axially-separated-band.test.mjs
```

The coupled report is `docs/validation/160-coupled.json`. Leaf XML construction
is shared by the isolated and coupled models in `leaf-assembly.js`; isolated
validation was rerun after extraction. Production remains unchanged. Before
registration, refine the coupled leaf and band stiffness, reconstruct and check
the visible source-shaped spring/drum/attachments/supports, evaluate drum inertia
and contact assumptions, then bake and inspect desktop/mobile playback.

## Visible source-shaped candidate

`solids.js` constructs a 19-mesh candidate around the native state. The pulley
has solid faces and a cylindrical band bed, with separate rear/front flanges
accommodating the full helical wrap. Its axle, bored bearing and rear mounting
pad are explicit. The treadle follows the source's tapered outline, circular
pivot boss and raised attachment arch; its connected casting has a real pivot
bore. The pedestal is traced from the source silhouette instead of a generic
post. The ground strip follows the engraving floor. Hidden depth, mounting and
fastening construction remain reconstruction assumptions.

The flexible strip follows the native link endpoints. Its visible width tapers
from the approximate ink-boundary width near the root to the narrower free end.
That stylized width is not used to infer a steel modulus or native mass. The
spring buffer is reused, and its closed triangle winding gives positive volume.
The band currently rebuilds a tube in this **unregistered offline/preview
factory**; a production player must bake or reuse that geometry efficiently.

The two band ends are separated in depth (0.24 and 0.72 world units) and fastened
inside rounded heads supported by stems. Their rendered centers follow the
native spring and treadle attachment coordinates to 1e-12 world units. A native
full-cycle test verifies the actual transformed treadle vertices stay above the
source floor; using an imprecise transformed axis-aligned bounding box would
incorrectly include empty space below this sloping part. The test also checks
one connected treadle casting, finite spring vertices, stable spring buffer,
positive spring volume, hidden generic ground and fog-free materials.

The band/hardware review samples 101 settled-cycle poses and checks signed
distances to the actual visible triangles at no more than 0.01 world-unit
centerline spacing. Expanded bounding boxes reject points with more than 0.01
surface clearance. Only the terminal 0.15 material units at each band's own
fastening are exempt. There are 67,982 triangle-distance queries and no failures.
The pulley bed's minimum clearance is -1.11e-8 world units, numerical contact;
contact penetration greater than 0.001 would fail. No other part reaches the
expanded band proximity region outside the fastening exclusions. This is a
sampled band/hardware audit, not a continuous-time or complete rigid-pair proof.

Front, loaded and oblique preview images were inspected at
`/dev/shm/160-solids-{source,loaded,oblique}.png`. The source-like solid pulley,
curved spring and pedestal now replace the earlier generic silhouettes in the
candidate. Production registration remains unchanged pending remaining coupled
refinement, rigid-pair checks and baked playback validation.

```sh
node scripts/review-spring-treadle-hardware.mjs
node --test tests/spring-treadle-solids.test.mjs
```

The report with source hashes is `docs/validation/160-band-hardware.json`.
