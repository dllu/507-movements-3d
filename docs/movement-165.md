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
