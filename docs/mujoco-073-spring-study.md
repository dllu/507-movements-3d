# Movement 073: dynamic spring reconstruction

This is an isolated experiment, not a catalog replacement. Production 073 still
needs reconstruction. The experiment resolves one question left by the earlier
elastic study: losing both wheel contacts temporarily does not prevent spring C
from recovering and stopping the wheel dynamically.

## Model and assumptions

The model reuses the measured driver circle and spring centerlines. The original
regular ten-tooth circular-flank profile remains available for comparison; the
new candidate traces all ten source flanks individually. Each leaf has 24 rigid beam cells,
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
before further parameter tuning. B's cut end also needs reconstruction.

## Traced teeth and flat C end

The new measurement script counts each tip and root separately. It samples 160
interior radial rays per flank, chooses the nearby outline stroke rather than
lettering, and fits a cubic Bézier curve through the counted endpoints. Alternate
rays are reserved from the fit. The 800 reserved readings have 0.6542-pixel pooled
RMS distance and a 4.2286-pixel maximum; endpoints remain construction data.
The source overlay is inspected. These measurements do not establish the precise
manufactured profile: the engraving has thick strokes and unequal tooth spacing.
The generated compact profile records the source image hash and all control
points. MuJoCo and Three.js use the same sampled finite outline. Reported tooth
increments use 36 degrees as a unit, rather than assuming equal measured pitches.

C's optional flat end extends the measured strip to an oblique cut in its local
frame, then clips it; it has no added cylindrical contact tab. Its axial plane
is 0.21 with depth 0.36, letting the actual leaf contact A. The initially inferred
source-Y cut at 461 overlaps the measured tooth root and advances A by more than
one tooth during settling. Locating the unshown cut at the counted root's Y=465
avoids that initial overlap. This four-pixel adjustment lies near the thick ink
boundary and remains an explicit reconstruction choice. The old regular wheel
and the new flat end also proved incompatible at the engraved initial pose.

The traced-wheel, root-cut trial uses the earlier spatial parameters and begins
at wheel angle zero before settling. It finishes 18 simulated seconds:

| Check | Observed result |
| --- | --- |
| Settled initial wheel displacement at nominal rim | 0.9182 source pixels |
| Total advance | 3.03253 nominal teeth |
| Largest rollback within a cycle | 0.65645 tooth — unacceptable |
| Sampled MuJoCo penetration | 0.26537 source pixels |
| Maximum coordinate change per step | 0.00016733 |
| Rendered beam length / joint error | 4.991e-14 world units |
| Six native solid poses | 51 closed solids; 2,310,564 surface samples; no topology errors |

The native screen reports six directed contact-overlap findings across four
poses, with deepest sampled overlap 0.02782 source pixels. It does not pass a
zero-intrusion criterion, and excludes contacts between cells of the same leaf.
All nine saved-pose browser views were inspected without browser errors. The
wheel and C outline now agree much better with the source, but the rounded B
tab, segmented shading, incomplete hub and supports, large rollback and missing
refinement/performance qualification still prevent catalog integration. The
Node probe took 37.7 seconds for 18 simulated seconds; real-time playback has not
been established for this candidate.

## Reproduction

```sh
PROBE_PREFIX=/dev/shm/073-profile PROFILE_MODULE=/dev/shm/073-profile.mjs node scripts/measure-spring-ratchet-full-profile.mjs
PROBE_PREFIX=/dev/shm/073-spatial PROBE_OPTIONS='{"timestep":0.000125,"contactTime":0.0005,"contactImpedance":0.9999,"catchStiffness":4,"strongStiffness":27,"catchRiseStart":0.4}' node scripts/probe-mujoco-spring-ratchet.mjs
node scripts/audit-mujoco-spring-ratchet.mjs /dev/shm/073-spatial.json
PROBE_REPORT=/dev/shm/073-spatial.json node scripts/capture-mujoco-spring-ratchet.mjs
PROBE_PREFIX=/dev/shm/073-traced PROBE_OPTIONS='{"timestep":0.000125,"contactTime":0.0005,"contactImpedance":0.9999,"catchStiffness":4,"strongStiffness":27,"catchRiseStart":0.4,"flatStopEnd":true,"strongPlane":0.21,"tracedWheel":true,"initialWheelAngle":0,"stopEndSourceY":465}' node scripts/probe-mujoco-spring-ratchet.mjs
node scripts/audit-mujoco-spring-ratchet.mjs /dev/shm/073-traced.json
TMPDIR=/dev/shm PROBE_REPORT=/dev/shm/073-traced.json node scripts/capture-mujoco-spring-ratchet.mjs
```

The browser capture requires the development server (default port 5174) and the
local enlarged Brown reference image. Reports refuse overwrites and record source
hashes; the audit and capture reject changed inputs. Numerical reports and large
rendered artifacts remain outside Git. All owned studies and browser processes
at this checkpoint are terminal; no unfinished solver continuation is implied.
