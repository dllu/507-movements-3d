# 130: gravity-opened plate shears

The [engraving and caption](https://507movements.com/mm_130.html) show a cam
closing the upper jaw and the weight of its long arm reopening it. No original
2D animation is available for this movement.

The replacement traces the visible blade and frame contours. In the 525-pixel
source, the jaw pivot is (322,325), camshaft (75,391), eccentric centre
(75,414), and cam radius 52 pixels. The eccentricity is 23 pixels. The upper
cutting edge runs approximately (372,307) to (502,270); the fixed edge runs
(372,313) to (507,318). These proportions produce a progressive cut from the
throat. The far tips remain apart at peak throw: the previous artificial blade
insert and relocated fixed edge are removed rather than distorting the profile
to force tip closure.

MuJoCo actuates only the cam; gravity and contact determine the jaw angle.
Mass, centroid and inertia come from the closed visible meshes at a common
density, normalized to unit jaw mass. Gravity produces opening torque throughout
the recorded stroke. The upper arm is decomposed into triangular collision
prisms, including its pivot hole. A spherical cam contact proxy has the same
planar support as the circular cam against the coplanar lever; this is a planar
contact approximation, not a general three-dimensional cylinder collision model.

Depths and ideal shaft supports are reconstructed. Moving parts occupy z=0–0.16;
the fixed jaw and base end at z=-0.003. Thus the blades pass beside one another
with 0.3 source pixels of axial clearance. Static parts are excluded from the
planar physics proxy and their actual mesh clearance is checked separately.
The model does not simulate cutting a workpiece or material deformation.

The cam reaches a four-second rotation period through a 0.25-second exponential
startup. A 16-second native recording at 0.5 ms steps supplies a 1 ms sampled
browser animation, retaining startup and an unwrapped settled loop. The packaged
asset is 264,049 bytes; playback downloads no MuJoCo WASM.

Validation:

- No native resets; maximum contact penetration 0.000218 source pixels.
- Fresh native comparison through 16 seconds, including the playback seam:
  maximum 0.000073 source pixels; a 0.25 ms refinement differs by 0.02949 pixels.
- Loop endpoint mismatch below 0.000000001 source pixels.
- Tests verify source/asset hashes, cached mesh transforms, opening gravity
  torque, blade clearance and camera bounds throughout sampled recorded motion.
- Packaged browser checks cover animation, pause, exact restart, mobile layout,
  JavaScript errors and absence of a WASM request.

Reproduce from the repository root:

```sh
TMPDIR=/dev/shm node scripts/probe-plate-shears.mjs
node scripts/bake-plate-shears.mjs
TMPDIR=/dev/shm node scripts/validate-plate-shears-bake.mjs
node --test tests/plate-shears-bake.test.mjs
```

The committed provenance records hashes of the native inputs and recording.
The browser loader selects this baked model; the legacy analytical factory is
retained for historical registry compatibility and is not the reviewed playback.
