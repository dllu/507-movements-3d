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

## Flat B end and friction sensitivity

B now also has an optional finite flat end, with no added contact tab. Its front
edge endpoints are read near (1045.75, 545) and (1063.5, 536.25); their midpoint
replaces the approximate centerline endpoint before resampling. The oblique cut
follows their connecting line. The source depicts an additional rear edge, so
depth remains an inferred quantity rather than another traced XY boundary.

With B's root at Z=-0.20 and end at 0.02, the flat-ended spring drives A briefly
but releases before retaining a tooth. Increasing C/B stiffness from 6.75 to 24
does not fix this. Removing the inferred axial bend, with both ends of B at
Z=0.02 and C at 0.21, retains an increment but still permits large rollback.

The contact trace gives a friction coefficient of about 0.32–0.36 for a radial
resultant on the sampled return flanks, before allowing for the applied load.
The nominal 0.15 coefficient cannot hold these poses. Increasing it to 0.5
improves retention but introduces slow drift. Increasing `impratio` to 100 does
not resolve that drift. Three NoSlip iterations improve the first three cycles,
but longer and finer runs still reject this as a finished reconstruction.
These are explicit contact assumptions, not a measurement of the materials.
See MuJoCo's [soft-contact slip guidance](https://mujoco.readthedocs.io/en/latest/modeling.html#slow-slippage).

The 24-cell, 0.125 ms, friction-0.5, three-NoSlip-iteration run has these limits:

| Check | Observed result |
| --- | --- |
| First three cycles | 5.53450 nominal teeth; 0.02669 maximum rollback |
| Ten cycles / 60 seconds | 17.40755 nominal teeth; 0.35696 maximum rollback |
| Largest sampled dwell drift, 1.2–3 s into each cycle | 0.12243 tooth |
| Sampled engine penetration over ten cycles | 0.14015 source pixels |
| Halving timestep, first three cycles | 17.319-pixel maximum wheel-rim difference; B/C node differences 22.303/18.670 pixels |
| Increasing to 36 cells, first three cycles | 3.66199 nominal teeth; refinement fails |

All nine views of the three-cycle candidate are inspected without browser errors.
Six poses have 50 closed solids, 3,059,204 native surface samples and no topology
errors; small contact overlaps remain. B's tab is removed and source outlines
are improved, but the candidate is still isolated. The longer rollback and
refinement failures supersede the encouraging three-cycle result.

The beam construction fixes its entire first cell, making the effective clamp
length depend on resolution. Correct that boundary discretization before further
material or contact tuning. Complete mounting hardware, mass properties, leaf
surface finish and real-time playback remain pending. The ten-cycle Node run
takes 116.8 wall seconds for 60 simulated seconds.

## Clamp boundary correction

The `elasticClamp` option now adds the missing half-cell bending compliance at
each fixed root. Interior rotational stiffness is EI divided by the distance
between cell centers; root stiffness is 2EI divided by the first cell length.
Root positions stay attached to D and the fixed support. The first rigid cell's
angle represents the average orientation across its bending span, rather than
an extra length of perfectly rigid clamping. This gives 98 coordinates at 24
cells. The former 94-coordinate setup remains available for comparison.

An independent MuJoCo cantilever test applies a transverse force at the actual
free tip and compares static deflection and slope with Euler–Bernoulli theory.
The corrected relative deflection errors at 8/16/32 cells are
0.78124% / 0.19530% / 0.04882%, decreasing by a factor of four with each doubling.
Fixing the whole first cell at eight cells gives a 17.96876% error. This verifies
the boundary correction, not the complete ratchet or its friction behavior.

The corrected 24-cell ratchet completes three cycles with 5.62068 nominal teeth
of advance, 0.01594 tooth maximum rollback and 0.11545-pixel sampled engine
penetration. Six native poses have 50 closed solids, 3,040,714 surface samples,
no topology errors, and six directed overlap findings reaching 0.04306 pixels.
All nine rendered views are inspected without browser errors. The undeformed
flat B end is within 0.186 pixels of its two construction corner readings.
However, the corrected 36-cell run advances only 3.68447 teeth over the same
three cycles. Thus the boundary correction is necessary but does not resolve
the mechanism's large sensitivity to beam resolution. Neither run is accepted
as the production replacement.

The next reconstruction step is to replace overlapping rigid-cell contact
shapes with a continuous finite leaf surface. A minimal WASM capability check
confirms that a zero-radius 3D flex with eight vertices and six tetrahedra can
follow existing body frames without extra degrees of freedom; transformed
vertices agree to 1.12e-16. This only confirms the API, not loaded contact
behavior. MuJoCo's [flex body and vertex definitions](https://mujoco.readthedocs.io/en/stable/XMLreference.html#deformable-flex)
allow the validated beam dynamics to drive that contact volume. Its source
fit, deformation, contact forces and refinement still need implementation
and validation.

## Reproduction

```sh
PROBE_PREFIX=/dev/shm/073-profile PROFILE_MODULE=/dev/shm/073-profile.mjs node scripts/measure-spring-ratchet-full-profile.mjs
PROBE_PREFIX=/dev/shm/073-spatial PROBE_OPTIONS='{"timestep":0.000125,"contactTime":0.0005,"contactImpedance":0.9999,"catchStiffness":4,"strongStiffness":27,"catchRiseStart":0.4}' node scripts/probe-mujoco-spring-ratchet.mjs
node scripts/audit-mujoco-spring-ratchet.mjs /dev/shm/073-spatial.json
PROBE_REPORT=/dev/shm/073-spatial.json node scripts/capture-mujoco-spring-ratchet.mjs
PROBE_PREFIX=/dev/shm/073-traced PROBE_OPTIONS='{"timestep":0.000125,"contactTime":0.0005,"contactImpedance":0.9999,"catchStiffness":4,"strongStiffness":27,"catchRiseStart":0.4,"flatStopEnd":true,"strongPlane":0.21,"tracedWheel":true,"initialWheelAngle":0,"stopEndSourceY":465}' node scripts/probe-mujoco-spring-ratchet.mjs
node scripts/audit-mujoco-spring-ratchet.mjs /dev/shm/073-traced.json
TMPDIR=/dev/shm PROBE_REPORT=/dev/shm/073-traced.json node scripts/capture-mujoco-spring-ratchet.mjs
PROBE_PREFIX=/dev/shm/073-flat PROBE_SECONDS=60 PROBE_OPTIONS='{"timestep":0.000125,"contactTime":0.0005,"contactImpedance":0.9999,"catchStiffness":4,"strongStiffness":27,"flatStopEnd":true,"strongPlane":0.21,"tracedWheel":true,"initialWheelAngle":0,"stopEndSourceY":465,"flatCatchEnd":true,"leafPlane":0.02,"catchRootPlane":0.02,"friction":0.5,"noSlipIterations":3}' node scripts/probe-mujoco-spring-ratchet.mjs
node scripts/audit-mujoco-spring-ratchet.mjs /dev/shm/073-flat.json
node --test tests/mujoco-beam.test.mjs tests/mujoco-runtime.test.mjs
```

Add `"elasticClamp":true` to the flat-end probe options to reproduce the corrected
boundary trial. Use `"segments":36` for its resolution comparison. Source hashes
include the shared beam-stiffness implementation.

The browser capture requires the development server (default port 5174) and the
local enlarged Brown reference image. Reports refuse overwrites and record source
hashes; the audit and capture reject changed inputs. Numerical reports and large
rendered artifacts remain outside Git. All owned studies and browser processes
at this checkpoint are terminal; no unfinished solver continuation is implied.
