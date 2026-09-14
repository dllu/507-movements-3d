# Scripted and baked motion workflow

Use analytical animation for simple gears, racks and determined linkages.
Use MuJoCo for mechanisms whose correctness depends on contact, constraints
or dynamics, then bake validated motion when live physics adds browser cost
without useful interaction. Keep the native model as the validation reference.

`src/data/source-animations.json` indexes all 507 original pages: 150 have
2D animations, including 104 among movements 127–507. Refresh it with
`node scripts/index-source-animations.mjs`. Availability is not a correctness
verdict. Compare directions, stroke, timing and engagement sequence against
the animation as well as the engraving and caption; record discrepancies.

## First baked movement: 123

The browser loads precomputed visible BufferGeometry and sampled joint motion
from a 2,572,783-byte gzip asset. It does not load MuJoCo, generate collision
meshes or step physics. The native contact model remains unchanged and runnable.
The shared playback helper currently supports Z hinges and Y slides; other
joint types and flexible bodies require additional bindings.

The recording retains startup, then repeats the settled six-second cycle
from 28.101 to 34.101 seconds. Unwrapped angles preserve complete revolutions.
The loop seam differs by less than 0.000000001 source pixels. A fresh native
run checked every millisecond through startup and a full cycle (6.25 seconds):
maximum interpolation error was 0.07114 source pixels, using a conservative
two-unit radius for rotor errors. Playback represents the recorded default
settings; changed forces, dimensions or physical parameters require a new bake.

Reproduce from the repository root:

```sh
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/123-recording DURATION=60.25 node scripts/probe-sector-handoff-dynamics.mjs
REPORT=/dev/shm/123-recording.json node scripts/bake-sector-handoff.mjs
TMPDIR=/dev/shm node scripts/validate-sector-handoff-bake.mjs
node --test tests/baked-motion.test.mjs
```

The baker rejects changed simulation input hashes, resets, nondefault options
and excessive loop error. The adjacent provenance JSON records source hashes,
recording hash and asset hash. The original 123 animation's transform sequence
agrees on opposite center/side rotation and two rack strokes per revolution;
this is not a frame-by-frame visual comparison. Existing reconstruction
assumptions remain in [the 123 study](mujoco-123-sector-handoff.md).

On the local development browser, a cold page reached its canvas in 3.45 seconds;
a subsequent cached model construction took 368 ms, and 3,600 pose updates
averaged 0.00314 ms each. These are local measurements, not an FPS guarantee.
Desktop, moving and section views were visually inspected.
The production build, three unit tests and the packaged-browser test passed.
The browser test covers portable subdirectory hosting, no WASM download,
play/pause, restart, reversible section view and mobile canvas visibility.
