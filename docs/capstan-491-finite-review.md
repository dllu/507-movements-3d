# Movement 491 — finite capstan interfaces (partial)

The [official caption and engraving](https://507movements.com/mm_491.html) specify a handspike turning a rope barrel, with a pawl carried by the rotating lower part over a fixed circular ratchet. The existing reconstruction already had that topology; this pass preserves it. The current page marks animation unavailable and contains neither `ae.add_model` nor `mm_present`, so there is no official animated timing oracle.

## Corrections

- Replace painted solid socket blocks with eight actual rectangular openings and finite rims. The two occupied opposite openings form a through passage; the six others end in blind walls. The head retains load-bearing material above and below the sockets.
- Give the waisted barrel, lower collar and head real spindle bores. End the stationary spindle below the handspike instead of passing it through the rotating bar.
- Replace the eased, overlapping rope packing with a short smooth lead into constant pitch. Three turns now span 0.42 units, with a finite diameter of 0.11. Move the rope centerline from radius 0.72 to 0.696, close to the 0.64-radius barrel. The 0.001 nominal radial allowance accommodates the tessellated rope surface.
- Move the decorative head band above the socket openings. Preserve the source proportions, rigid head/barrel motion, tangential rope route and constant-distance moving markers. Enforce an eight-second minimum display cycle; suppress the ground and fog.

## Verification

`node --test tests/movement-491.test.mjs tests/capstan-491-finite.test.mjs`

12 checks pass. Independent rendered-surface queries find spindle/bore clearance above 0.0096, handspike/socket clearance above 0.0198, and spindle/handspike clearance above 0.0799. Radial rays verify the unused sockets reach real blind walls. Rope-to-barrel sampled clearance is 0.0004694; a neighboring-turn search including slightly different azimuths finds 0.028059 clearance. Repeated state queries and updates preserve descendant and geometry identities.

## Unresolved finite pawl contact

**This is a partial correction, not a mechanically validated capstan.** `pawlClosureAtAzimuth` still places the center of the finite spherical `pawlTip` on an ideal tooth-height curve. The corresponding existing point-closure tests do not certify the visible solid. An independent 129-pose sweep across one tooth finds `pawlTip` versus `ratchet` penetration of **0.0801904 units at tooth phase 0.21875**. The tip sphere radius is 0.085. The rectangular pawl underside, finite-width crest crossing, and pin/collar attachment also require a dedicated finite follower/hinge reconstruction. The crown's actual triangular ramp surface differs from the point-law linear azimuth height. These are retained faults, not clearance allowances.

The bounded residual test permits improvement and imposes only an upper penetration bound; it never requires the failure to remain. Reverse locking, gravity return, cable tension/friction and hauling loads remain prescribed or conceptual rather than solved rigid-body/fluid dynamics. This pass introduces no MuJoCo claim. A subsequent contact pass should solve the actual pawl envelope, preserve the reverse-blocking flank and provide a bored hinge before claiming mechanical completion.

Source-facing browser comparison on shared Vite 43932 covered default, front and rear views. The socket openings and separated wraps are visible. A 65-pose full-cycle framing sweep found no clipped vertices (maximum absolute screen NDC 0.8027), no browser errors, and no ground plane. Screenshots and browser results remain in `/dev/shm`.
