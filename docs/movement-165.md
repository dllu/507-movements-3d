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

All-tick baseline checks find maximum reported contact penetration 0.00513 world
units (0.285 pixel), output-pin closure error 0.0000181, and cam tracking error
0.03977 radian. Output moves over 0.63837 units. Disabling contact changes output
by up to 2.31082 units, establishing that the follower is not scripted. However,
halving the timestep and increasing angular sections from 360 to 480 change
sampled output by 0.05569 and 0.05646 units (3.09 and 3.14 pixels). **This candidate
is not converged enough to bake or register.** Roller spin, repeated-cycle
settling, actual solid clearances, source-shaped output hardware and browser
playback are still unqualified. A 720-section experiment exceeded the WASM heap;
the recorded refinement uses 480 sections and fresh module instances per run.

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
