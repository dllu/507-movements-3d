# Movement 491 — finite capstan interfaces and pawl contact

The [official caption and engraving](https://507movements.com/mm_491.html) specify a handspike turning a rope barrel, with a pawl carried by the rotating lower part over a fixed circular ratchet. The existing reconstruction already had that topology; this pass preserves it. The current page marks animation unavailable and contains neither `ae.add_model` nor `mm_present`, so there is no official animated timing oracle.

## Corrections

- Replace painted solid socket blocks with eight actual rectangular openings and finite rims. The two occupied opposite openings form a through passage; the six others end in blind walls. The head retains load-bearing material above and below the sockets.
- Give the waisted barrel, lower collar and head real spindle bores. End the stationary spindle below the handspike instead of passing it through the rotating bar.
- Replace the eased, overlapping rope packing with a short smooth lead into constant pitch. Three turns now span 0.42 units, with a finite diameter of 0.11. Move the rope centerline from radius 0.72 to 0.696, close to the 0.64-radius barrel. The 0.001 nominal radial allowance accommodates the tessellated rope surface.
- Move the decorative head band above the socket openings. Preserve the source proportions, rigid head/barrel motion, tangential rope route and constant-distance moving markers. Enforce an eight-second minimum display cycle; suppress the ground and fog.

## Verification

`node --test tests/movement-491.test.mjs tests/capstan-491-finite.test.mjs`

The original 12 interface checks passed before the pawl follow-up; the expanded suite has 15 checks. Independent rendered-surface queries find spindle/bore clearance above 0.0096, handspike/socket clearance above 0.0198, and spindle/handspike clearance above 0.0799. Radial rays verify the unused sockets reach real blind walls. Rope-to-barrel sampled clearance is 0.0004694; a neighboring-turn search including slightly different azimuths finds 0.028059 clearance. Repeated state queries and updates preserve descendant and geometry identities.

## Finite pawl follow-up

The former 0.0801904-unit tip/crown penetration is corrected. The rigid arm now has a real 0.060-radius bored eye around a 0.055-radius pin, between two finite mounting cheeks. A 0.070-radius rounded nose and a modest 0.120-unit forward bend give it a leading contact surface. This lead matters mechanically: a purely radial rounded nose gave the reverse-face force a small lifting moment. The leading nose instead seats under that force. The crown retains its asymmetric ramps and steep reverse faces; its outer radius increases from 1.72 to 1.79 to support the finite nose.

`node scripts/generate-capstan-pawl-contact.mjs` regenerates the 2,561-pose single-tooth table in under one second. It solves sphere clearance against the actual crown triangle mesh, not the old linear azimuth height. The crest release is an explicitly prescribed smooth drop, constrained above that finite envelope. Runtime playback interpolates the baked data and performs no collision generation or live solve. The nominal tooth-height helper remains an explanatory reference, not the collision authority.

15 focused checks now pass. An independent 4,097-pose sweep bounds the entire rendered nose by its circumscribing sphere: minimum crown clearance **0.00011988**, maximum working-ramp separation **0.00012273**. Thus the clearance correction retains engagement rather than suspending the pawl above the ring. Swept rendered arm/solid checks measure crown clearance above **0.0341**, collar clearance above **0.0284**, and pin/bore clearance above **0.00487**. Both mounting cheeks clear the arm. The periodic pitch has no release jump; the maximum adjacent pitch change over 4,096 samples is below 0.0004 radians.

A reverse-contact test places the nose against the actual finite steep face after the drop. For a unit face-normal load, the hinge moment is **-0.00939**, seating the pawl; the vertical-axis moment is **-1.5952**, opposing recoil. This is a geometric moment/sign check, not a dynamic load-capacity claim. The bored hinge and bent nose proportions are an engineering reconstruction of Brown's bent pawl, whose hidden axial form and exact dimensions are unspecified.

Gravity acceleration, impact, restitution, applied loads, cable tension/friction and the response to a reversed driver are **not dynamically solved**. Forward hauling and crest-release timing remain prescribed. The contact/hinge residual is closed geometrically; no MuJoCo or passive-dynamics validation is claimed.

Final browser review on Vite 43933 compared the default, front and reverse views with the engraving. The new hinge and bent pawl are visible without changing the barrel/head arrangement. There were no browser errors or clipped vertices over 65 full-cycle poses (maximum absolute screen NDC 0.8027). Review images remain in `/dev/shm`. The contact bake also regenerated byte-for-byte identically.
