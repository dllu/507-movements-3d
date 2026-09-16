# Valve-linkage family pass: 185 and 418

Primary references: [185 engraving, caption and embedded animation](https://507movements.com/mm_185.html), [418 engraving, caption and embedded animation](https://507movements.com/mm_418.html). Both pages contain working animation constructions. This pass retains the existing analytic joint equations and addresses finite solids, actual engagement and source-facing presentation.

## 185: Stephenson link motion

The previous tube rails narrowed a nominal 0.23-wide slot to 0.086, while its 0.20-wide die floated in front of them. The die now crosses the link plane and its rectangle fits between the free walls. The walls are finite plates with bored, connected eccentric-pin and suspension lugs. The lifting pin now spans its lug and lifting rod. The die has a real axle bore.

Both eccentric rods previously ran from the centers of the rotating sheaves through their solid faces. They now begin at the free straps and have bored link-end eyes. The valve guide previously occupied a different axial plane from its stem; a short bored guide now surrounds the stem, clear of the moving valve head. The invented stand was removed, ground/fog disabled, and the complete selector cycle used for camera fitting.

The official animation confirms the two eccentric-rod constraints, radius-26 expansion slot, radius-7 output rocker, and horizontal slider. Its selector interpolates over four input cycles. Our existing demonstration retains eight turns in 24 seconds and uses its own smooth selector transitions/dwells. Source proportions, the simplified steam chest and remaining lever/shaft interfaces still need a later full qualification. This is not an all-mesh collision certification.

## 418: relieving slide-valve linkage

The previous rod passed through its independently rotating roller and both guide rails. It is now a rigid bored plate behind those members, joined by finite axles, with actual bores in the roller, upper slider and valve neck. The roller remains visible from the source-facing view. The valve body previously penetrated its seat by 0.08 model units; their surfaces now meet. The lower guide rail was disconnected: both arcs now extend beyond the operating roller endpoints and join through end webs that clear its sweep. Ground/fog are disabled.

The exact constant-length rod and orthogonal lower/upper pin constraints remain unchanged. The official animation supports the roller's one-third position along the rod. Guide offsets and a prescribed sinusoidal valve input remain engineered assumptions. Roller spin still illustrates a selected loaded-wall convention; clearance take-up, steam pressure, friction and pressure relief forces are not dynamically solved. Guide/frame outlines and the adjustment screw remain simplified.

## Validation

`node --test tests/movement-185.test.mjs tests/movement-418.test.mjs tests/valve-family-solids.test.mjs`

All 15 tests pass. Existing tests check the analytic link lengths, neutral/full-gear behavior, constraint closure, derivatives and cycle continuity. New tests sample 193 selector poses for 185 and 65 poses for 418: finite die vertices inside free walls, rendered pin bores, rods outside eccentric sheaves, rod/roller/guide axial separation, end-web clearance, valve/seat tangency and rigid rod endpoint closure.

Desktop browser review captured source-facing and default views and projected mesh vertices through 17 cycle poses. No page errors; maximum absolute screen coordinates 0.847 for 185 and 0.836 for 418, inside the viewport. The final 418 guide end-web addition was recaptured and passed the same framing check. Mobile views and arbitrary orbit directions are outside these targeted checks.
