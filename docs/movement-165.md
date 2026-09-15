# Movement 165 — waved cam contact review in progress

165 remains on its existing browser model. The review has confirmed a large
cam/roller intersection and added an independent finite-roller contact solver
for evaluating a replacement profile. No replacement is registered yet.

## Source and defect

The [original page](https://507movements.com/mm_165.html) has no available 2D
animation. The waved cam on a vertical shaft moves a roller on an oscillating
rod, which drives the upright output bar. The engraving shows the roller fitting
beneath the middle arch of the wave, a roughly 49-pixel roller radius, a rocker
pivot near (168,322), and output joint near (44,362).

The current model assumes six waves around the cam, a sinusoidal lower face,
and an inferred roller depth of 1.2 world units. Its closure equation puts only
the roller's vertical top point on the wave. A zero value from that equation
does not establish contact or clearance for the rest of the roller.

The audit transforms actual cam-skirt vertices, edge midpoints and triangle
centers into the actual closed 64-sided roller mesh at 97 phases. Cam surface
points lie inside the roller by 0.15519 world units (8.96 source pixels) in the
initial pose. The largest sampled intrusion is 0.27541 (15.90 pixels), even
though the existing contact calculation reports zero gap. The skirt itself is
open at its upper edge, so the audit deliberately tests inclusion in the closed
roller, avoiding a winding test on an open cam mesh.

The current model also adds an output slot, weight and extensive support frame
that are not established by the engraving. Their geometry, the input-shaft grip,
actual roller depth and output-joint construction still need source review.

## Independent contact diagnostic

The new solver treats a finite cylindrical roller under a continuous annular
wave face. For each lateral position it finds the lowest face height across the
roller's axial width, including interior wave minima. It then brackets/refines
lateral minima and solves the rocker angle at which the whole roller is seated.
Contact generally occurs away from the roller's vertical top point, and can
occur at the axial edge. No contact force or inertial response is claimed by
this geometric diagnostic.

On the legacy sinusoidal profile, doubling the lateral bracketing resolution
from 128 to 256 agrees within 1e-15 world units at 49 phases. The resulting
roller center differs from the legacy point-contact pose by as much as 0.49781
world units (28.74 pixels). At the initial phase it drops about 24 pixels. Thus
correcting only the follower position would destroy the engraved alignment;
the source-shaped cam profile and inferred radial/axial geometry must be rebuilt.
The continuous profile calculation is explicitly separate from the legacy
triangulated skirt and is not presented as a qualified replacement for it.

Three tests verify the exact flat-face limit, clearance of independently sampled
finite roller surfaces, seated contact and monotonic behavior when roller width
increases. The current browser model is unchanged while reconstruction proceeds.

Next: reconstruct the wave/profile and roller depth from the engraving, evaluate
their finite contact, then use passive native contact dynamics where needed and
bake the result. Inspect the rocker/output connection and remove unsupported
support geometry before packaged playback validation.

Evidence: [existing mesh contact](validation/165-existing-contact.json) and
[continuous envelope diagnostic](validation/165-envelope-diagnostic.json), both
with source hashes. Temporary source downloads remain in /dev/shm.

```sh
node scripts/review-wave-cam-contact.mjs
node scripts/probe-wave-cam-envelope.mjs
node --test tests/wave-cam-contact.test.mjs
```

## Source-shaped native contact study

A separate, unregistered candidate now traces 25 measured points on the lower
silhouette with shape-preserving cubic interpolation. Projection onto a circular
cam gives unequal angular lobes; repeating the front half on the unseen rear is
an explicit assumption. The inferred 0.12-unit roller depth straddles the outer
lip, replacing the legacy 1.2-unit depth. Its source radius and front center stay
at 49 pixels and (336,270).

The raw outline intersects this finite roller where the engraving hides the face.
A conservative cylindrical envelope relieves that region and extends along
angular rays beyond the roller footprint to avoid an abrupt radial-edge step.
Maximum relief is 19.63 source pixels, mostly behind the roller; the maximum
change to the sampled composite front outline is 0.1678 pixel. Independent
finite-cylinder samples clear the continuous face within floating-point error.
This measures the source pose only, not the moving rendered assembly.

The native study has one actuated cam, passive rocker and roller, and a passive
gravity-loaded output bar with horizontal crosshead freedom at its connection.
The crosshead, mass, damping, depth and rear profile remain reconstruction
assumptions. A narrow outer contact band is decomposed into 720 convex wedges;
it is collision geometry, not a complete visible model.

MuJoCo's default native multicontact method jams immediately for these wedge/
cylinder edge contacts. Native single contact passes the first second but jams
later. The alternative MPR pipeline completes an 18-second input revolution.
Its configuration follows the [MuJoCo collision documentation](https://mujoco.readthedocs.io/en/stable/computation/index.html#convex-collisions).
This is an empirical workaround for this candidate, not a general recommendation
to change the project's solver. Both failing runs remain in the report.

Tightening CCD tolerance to 1e-10 with 200 iterations and increasing the input
servo to stiffness 100000/damping 1000 improves timestep sensitivity. All-tick
baseline checks now find maximum reported contact penetration 0.00326 world
units (0.181 pixel), output-pin closure error 0.0000091, and cam tracking error
0.00380 radian. Output moves over 0.63687 units. Disabling contact changes output
by up to 2.31083 units, establishing that the follower is not scripted.

Halving the timestep changes sampled output by 0.00379 units (0.21 pixel), down
from 3.09 pixels with the earlier settings. However, increasing angular sections
from 360 to 480 changes it by 0.07247 units (4.03 pixels). **The collision-mesh
sensitivity remains unresolved; this candidate must not be baked or registered.**
The regression bounds reported contact error over every tick to 0.005 units
(0.28 pixel), rather than relying on the final pose alone. This is a numerical
study bound, not a rendered-clearance qualification. Roller spin, repeated-cycle
settling, actual solid clearances, source-shaped output hardware and browser
playback are still unqualified. A 720-section experiment exceeded the WASM heap;
the recorded refinement uses 480 sections and fresh module instances per run.
A temporary polygonal-roller experiment also jammed with native CCD; simply
substituting a mesh for the cylinder does not resolve that failure.

Six tests cover legacy finite contact, measured silhouette interpolation,
source-pose roller clearance, periodicity and a complete contact-driven input
revolution with a contact-disabled counterfactual. The native regression guards
against the jam; it does not assert the remaining convergence issue is solved.

Evidence: [source profile](validation/165-source-profile.json) and
[native comparison](validation/165-native-study.json). Full trajectories stay in
`/dev/shm/165-native-trajectories.json`.

```sh
node scripts/probe-wave-cam-source-profile.mjs
node scripts/probe-wave-cam-physics.mjs
node --test tests/wave-cam-contact.test.mjs tests/wave-cam-source.test.mjs
```

## Adaptive profile refinement

An independent continuous-face sweep identified a geometric cause for the uniform
mesh sensitivity. At 8.78 seconds, the 360-section model reports no contact while
a sampled point of the ideal cam enters the roller by 0.05271 world units
(2.93 pixels). At the largest output discrepancy, both trajectories have left
contact, with independently sampled gaps of 0.01132 and 0.08040. Therefore small
MuJoCo penetration alone did not qualify the approximation. Slowing the uniform
mesh drive also failed to remove its resolution sensitivity.

The finite-roller relief has a narrow transition near its lateral end. Adaptive
angular subdivision now checks fifteen interior heights against each chord,
with a tolerance reserve. This concentrates collision cells at that transition.
The new study uses 418 angular cells at tolerance 0.001, and 584 at 0.0005.
Independent 65-point-per-cell checks find maximum height errors 0.0008981 and
0.0004528. Over one revolution, halving the timestep changes output by 0.001215
world units (0.0675 pixel); refining the profile changes it by 0.003716
(0.2065 pixel). The formerly four-pixel mesh discrepancy is substantially reduced.

The independent continuous-face check still finds sampled intrusion up to 0.00713
world units (0.396 pixel) and separation up to 0.10860 (6.03 pixels). These are
not hidden by the smaller reported MuJoCo penetration. A temporary denser base
rim (360 initial sections with adaptive refinement) reduces the sampled intrusion
to 0.00634. Adding a conservative collision-face offset of -0.006 yields a
positive minimum sampled gap of 0.000162 over the revolution; that experiment is
not yet the default or a qualified rendered assembly. Its raw states are in
`/dev/shm/165-adaptive-offset.json`. The original positive collision offset remains
the default so that the earlier diagnostics remain reproducible.

Seven tests pass, including an independent 129-point-per-cell check of the
adaptive interpolation error and a full adaptive contact-driven revolution.
Next: qualify the conservative contact margin and repeated-cycle settling,
construct the actual source-shaped solids and output connection, then audit and
bake playback. No new browser model is registered by this study.

Evidence: [continuous separation diagnostic](validation/165-separation.json) and
[adaptive convergence study](validation/165-adaptive-study.json).

```sh
node scripts/probe-wave-cam-physics.mjs
node scripts/probe-wave-cam-separation.mjs
node scripts/probe-wave-cam-adaptive.mjs
node --test tests/wave-cam-contact.test.mjs tests/wave-cam-source.test.mjs
```
