# 128 — three wipers and a reciprocating frame

The [engraving and caption](https://507movements.com/mm_128.html) show a
clockwise rotor with three rigid rounded wipers pushing two curved faces in
a sliding frame. The original site has no 2D animation for this movement.

The previous browser model prescribed harmonic frame motion and generated
cam envelopes to fit it. Its nominal contact points agreed algebraically,
but the cams had almost point-sized connections to the frame, its shapes
and proportions differed from the engraving, and it added a base and large
guide structure. Its positive extrusion bevel also expanded working faces.
That legacy factory remains in the synchronous registry; the browser loader
now selects the baked reconstruction instead.

## Geometry and physical assumptions

One unit is 100 engraving pixels. The traced outer frame, inner opening,
asymmetric upper/lower faces and short side tabs form one connected solid.
The shaft is at (257,264), wiper center radius is 107.5 pixels, head radius
18.5 pixels and hub radius 41 pixels. Working faces have no expanding bevel.
The 3D depths, ideal X guide and shaft bearing are inferred. Tiny collinear
Boolean-union slivers are excluded from the 264 convex collision cells.
The three heads use spherical contact proxies: against the coplanar frame
walls their XY support equals that of the visible cylindrical heads. The
visible arm boxes and hub also participate in collision detection.

Only the rotor is actuated. The frame is passive, with an assumed mass of
2 kg, 5 N of guide friction and 0.05 N·s/m viscous damping. Five newtons is
approximately the dry friction from a coefficient of 0.25 supporting that
weight. The balanced rotor uses an assumed 1 kg mass and diagonal inertia;
gravity does no work along the constrained frame axis or on that rotor.
These are illustrative operating conditions, not measured historical values.

Friction is consequential: the near-frictionless trial coasted into the
outer rim and had an approximately 140-pixel stroke. It is rejected as the
intended operating example. The frictional model has an approximately
50-pixel stroke and contacts only the cam regions. It retains real release,
coasting and sticking behavior rather than forcing a harmonic displacement.
The input ramps up over 0.25 seconds, then takes six seconds per revolution,
producing three output strokes, or two seconds per back-and-forth stroke.

## Offline validation and browser playback

The final 18-second recording uses a 0.25 ms timestep. It has no time resets,
no penetrating contacts outside the cam regions, and maximum native contact
penetration of 0.06596 source pixels. A 0.5 ms run reaches 0.08517 pixels.
Fresh playback comparison at every 0.25 ms tick through all 18 seconds
and the first loop seam stays within 0.00896 source pixels. Comparing a
fresh 0.5 ms run against playback at every tick gives a maximum difference
of 0.07174 pixels.
Contact-region classification allows a one-pixel neighbourhood around the
traced faces for soft-contact and triangulation uncertainty.

The 413,116-byte runtime asset includes precomputed visible BufferGeometry
and 1 ms pose samples. Startup is preserved, followed by the settled cycle
from 11.98925 to 17.98925 seconds. Its seam error is below 0.000000001 source
pixels. The browser downloads no MuJoCo and performs no physics steps.
The shared rigid-body player now supports X as well as Y slide bindings.
Changing physical parameters requires a new recording.

Reproduce from the repository root:

```sh
TMPDIR=/dev/shm PROBE_REPORT=/dev/shm/128-recording.json SAMPLE_EVERY=4 SIM_OPTIONS='{"guideFriction":5,"timestep":0.00025}' node scripts/probe-three-wiper-dynamics.mjs
REPORT=/dev/shm/128-recording.json node scripts/bake-three-wiper.mjs
TMPDIR=/dev/shm node scripts/validate-three-wiper-bake.mjs
node --test tests/baked-motion.test.mjs tests/three-wiper-bake.test.mjs
```

The baker verifies native input hashes, solver settings, no resets, no outer
wall contacts, penetration limits and loop continuity. Adjacent provenance
records the input, report and asset hashes. Source pose and both extreme
poses were visually inspected. The geometry follows the engraving closely;
precise curves, omitted guide hardware and the load-dependent motion remain
reconstruction assumptions.

The production build and seven unit tests pass. Tests verify the collision
cells' total area against the visible frame, mesh transforms before/after
baking, provenance, continuous looping, X-only frame translation and framing.
Two packaged-browser tests pass for 128 and the shared player's 123 regression,
covering portable hosting, playback, restart and mobile layout without WASM.
Final packaged source, moving and mobile views were visually inspected after
fixing the serializer's initially missing local mesh transforms.
