# Movement 154 — three-stud weighted bell-crank

154 uses a 351 KB offline MuJoCo bake: 6,001 poses over a twelve-second disk
turn, with three lifts. Only the disk is actuated. Stud contact moves the elbow;
a tension-only cord over the pulley lifts the weight and returns the elbow to
a physical stop. The browser interpolates four coordinates and updates a small
rope vertex buffer. It does not load MuJoCo/WASM or rebuild rope geometry.

## Source and reconstruction

The [original engraving and caption](https://507movements.com/mm_154.html)
describe studs acting on an elbow attached to a weighted cord over a pulley.
The source page marks its animation unavailable, so there is no 2D animation
oracle for this movement.

The drawing's disk center/radius, all three stud centers, elbow pivot and arm
endpoints, pulley center/radii, and weight radius set the model's front-plane
geometry at 0.014 world units per pixel. The studs retain the drawing's slightly
unequal spacing and orbit radii; physics consequently produces three slightly
different strokes. The previous animation regularized their spacing and used
a prescribed top dwell and quintic return.

The right vertical cord is tangent to the pulley at source x=462, placing the
weight eight pixels right of its drawn center at x=454. This is retained so the
cord remains vertical and tangent. The nearly frontal camera preserves the
source arrangement while allowing inspection of the full assembly in 3D.
Fog and the ground plane are disabled.

Inferred construction includes bored bearings, a rear frame, a fixed return
stop, small output/weight rope fittings, and an ideal vertical weight guide.
Without a stop, the passive elbow swings well beyond the drawn rest pose.
The stop is rendered and participates in native contact; it is not a joint
limit or prescribed reset. Rope endpoints meet their fittings through modeled
attachment joins; the model does not resolve knots or individual fibers.

## Native dynamics and limits

The disk turns at 0.5236 rad/s. The elbow and weight are unactuated. A MuJoCo
spatial tendon wraps a fixed cylinder at the pulley pitch radius, with an upper
side site and a unilateral length limit of 7.3251035365 world units.
The [MuJoCo tendon reference](https://mujoco.readthedocs.io/en/stable/XMLreference.html#tendon-spatial)
describes this analytic wrapping and length constraint.

Moving mesh volumes supply full inertias at common density, normalized to a
weight mass of one. Masses, gravity scale, bearing damping, frictionless stud
contact, ideal weight guidance, and negligible pulley/rope inertia are
reconstruction assumptions. The pulley angle follows rope travel. Only working
contacts are solved natively; nonworking geometry is checked separately.
Concave bores are not working contact surfaces in the native convex meshes.

Six disk turns settle the recorded motion. The final cycle at dt=0.000125 has:

- Weight lift range −0.0011631 to 0.261213 world units.
- Maximum sampled cord extension 0.00001347 world units.
- Periodic coordinate closure below 1.5e-10 before closing the final bake row.
- Compared with dt=0.00025, maximum sampled weight difference 0.004322 world
  units (0.309 source pixels), concentrated around contact transitions; elbow
  difference 0.003508 radians. This is a finite timestep comparison, not an
  assertion of exact impact convergence.

The supported factory is used for production baking. The unsupported legacy
and optional joint-limit modes remain diagnostic alternatives only.

## Validation

Four focused tests pass. They check one actuator, passive follower coordinates,
no lever joint limit, the physical stop, native versus analytic rope length,
contact-dependent lifting, baked interpolation, bounds, fog, exact restart and
reuse of the rope geometry/vertex buffer.

The bake is sampled every 0.002 seconds. At 24,001 native comparison instants,
including between-frame positions, maximum interpolation errors are
0.00001744 rad for the disk, 0.0003971 rad for the elbow and 0.0004818 world
units for the weight (0.0345 source pixels).

The assembly audit checks 34 visible constituent meshes and 440 cross-body
pairs at 65 native poses: 5,603,352 point queries, zero unintended intersections.
The between-bake-frame audit checks 5,596,352 points with the same result.
Working soft contacts and intentional rope attachment joins are reported
separately. A separate 66-pair moving-volume audit checks 90,450 points with no
same-body overlap above tolerance. These are finite surface checks, not a
continuous collision proof.

The compressed asset has 13 merged rigid meshes; playback adds one reusable
rope mesh. Packaged desktop/mobile playback checks play/pause, restart, orbit,
view reset, errors and the absence of any WASM request. Production build and
browser results are recorded with the accompanying change.

## Reproduction

```sh
SUPPORTED=1 REPORT=docs/validation/154-supported-prototype.json node scripts/probe-weighted-bell-crank.mjs
cp /dev/shm/154-passive-samples.json /dev/shm/154-supported-samples.json
SUPPORTED=1 DT=.000125 REPORT=docs/validation/154-supported-fine.json node scripts/probe-weighted-bell-crank.mjs
cp /dev/shm/154-passive-samples.json /dev/shm/154-supported-fine-samples.json
node scripts/review-weighted-bell-crank-moving-volumes.mjs
node scripts/review-weighted-bell-crank-assembly.mjs
node scripts/bake-weighted-bell-crank.mjs
node scripts/review-weighted-bell-crank-baked-assembly.mjs
node --test tests/weighted-bell-crank-physics.test.mjs tests/weighted-bell-crank-baked.test.mjs
```

Source hashes and numerical summaries are in `docs/validation/154-*.json` and
`src/simulation/baked/assets/154.provenance.json`. Raw trajectories and private
production/browser artifacts are under `/dev/shm`.
