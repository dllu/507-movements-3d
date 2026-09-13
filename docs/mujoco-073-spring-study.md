# Movement 073: dynamic spring reconstruction

This is an isolated experiment, not a catalog replacement. Production 073 still
needs reconstruction. The experiment resolves one question left by the earlier
elastic study: losing both wheel contacts temporarily does not prevent spring C
from recovering and stopping the wheel dynamically.

## Model and assumptions

The model reuses the measured driver circle, the regular ten-tooth circular-flank
profile and the measured spring centerlines. Each leaf has 24 rigid beam cells,
with two bending hinges between successive cells. The resulting 94 coordinates
include both wheels. Only D has an actuator; wheel A and both spring shapes
advance through MuJoCo dynamics. Extension and torsion are constrained.

Visible beam cells have finite width and depth, and use their own convex meshes
for collision. The cells overlap within each leaf. Lumped rectangular beam
masses and approximate wheel inertias are experimental parameters, rather than
mass properties of completed hardware. The beam spring constants scale with
element length and cross-section. The selected C/B bending-stiffness ratio 6.75
corresponds to the nominal 30/20-pixel widths and a 2:1 depth ratio.

B starts behind C and rises toward its free end. This axial bend, the leaf
depths, end tabs, material properties, damping, friction and output inertia are
reconstruction assumptions. The candidate omits the clamps, lower fixed portion
of C, shafts and bearings. It is neither a finished assembly nor an accepted
interpretation of the engraving.

The experiment uses the shared runtime and ordinary MJCF bending-joint spring
and damping parameters. See the [MuJoCo joint reference](https://mujoco.readthedocs.io/en/stable/XMLreference.html#body-joint).

## Findings from the rounded-tip experiment

The initial coplanar dynamic trial completed three cycles, including recovery
after the contact loss that stopped the older quasi-static continuation.
However, its contacts penetrated by up to 8.91 source pixels and the wheel
rebounded substantially. Changing only stiffness or drag did not establish an
acceptable reconstruction.

The inspected spatial trial uses a six-second driver period, 0.125 ms timestep,
0.5 ms contact time constant, bending stiffnesses 4/27, damping time 0.04,
friction 0.15, and a rise starting 40% along B. It completes eighteen seconds:

| Check | Observed result |
| --- | --- |
| Total advance | 3.00483 teeth |
| Largest rollback within a cycle | 0.73186 tooth — unacceptable |
| Sampled MuJoCo penetration | 0.20935 source pixels |
| Maximum coordinate change per step | 0.00017556 |
| Rendered beam length / joint error | 4.991e-14 world units |
| Six native solid poses | 52 closed solids; 1,252,892 surface samples; no reported intrusions or topology errors |

The native screen groups each whole leaf, excluding overlaps between its cells.
It does not establish self-clearance within a leaf or continuous clearance.
The source and eight further rendered views were inspected, with no browser
errors. The overlay still shows the previously documented regular-tooth fit
errors, missing hardware and incomplete spring-end construction.

A fourfold output-inertia trial still returned to approximately one tooth per
cycle and retained large rollback. Raising friction to 0.5 greatly reduced the
first rollback but left slow creep and nonuniform subsequent increments. Neither
is accepted as a fix. Beam-resolution and timestep convergence, real-time browser
performance, complete source fit and full hardware clearance remain unqualified.

The enlarged source supplies a more concrete next correction: C's upper boundary
ends near source pixel (502, 462), while the other boundary reaches the tooth
root near (541, 462). This indicates a cut approximately horizontal in the source
view, oblique to the leaf's centerline. The experiment inherited a rounded
contact tip, which does not reproduce that end. Correct the finite end geometry
before further parameter tuning. B's cut end also needs direct inspection.

## Reproduction

```sh
PROBE_PREFIX=/dev/shm/073-spatial PROBE_OPTIONS='{"timestep":0.000125,"contactTime":0.0005,"contactImpedance":0.9999,"catchStiffness":4,"strongStiffness":27,"catchRiseStart":0.4}' node scripts/probe-mujoco-spring-ratchet.mjs
node scripts/audit-mujoco-spring-ratchet.mjs /dev/shm/073-spatial.json
PROBE_REPORT=/dev/shm/073-spatial.json node scripts/capture-mujoco-spring-ratchet.mjs
```

The browser capture requires the development server (default port 5174) and the
local enlarged Brown reference image. Reports refuse overwrites and record source
hashes; the audit and capture reject changed inputs. Numerical reports and large
rendered artifacts remain outside Git. All owned studies and browser processes
at this checkpoint are terminal; no unfinished solver continuation is implied.
