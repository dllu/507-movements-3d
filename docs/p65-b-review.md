# p65-b review (pass 65: 132, 167, 299, 372, 377, 390, 439, 457)

Lane p65-b. I checked each flaw against `public/engravings/mm_NNN.png` in fresh
production-route captures. I used `scripts/review-movement-source-views.mjs` and a
local script for the default, half-cycle, ±60° yaw, top, back and close-zoom views.
The captures are in `/dev/shm/p65-b` and are not committed. Before captures are in
`before/`, and after captures are in `after/`, `v/`, `v372a/` and `t299e/`.

## Changes

| ID | File | Change |
| --- | --- | --- |
| 132 | `authored-cranks.js` (132 function only) | The column shafts are now 0.45 across, up from 0.40, with the base and capital mouldings scaled to match (0.09 of the column spacing, as Brown draws). The two column plinths are now centred under the set-back columns. Before, the column base overhung the back of its plinth by about 0.2. |
| 167 | `reversing-groove-drum.js` | The open ink groove-floor tube and the separate core, which was 0.002 smaller, are replaced by one core at the groove-floor radius. It has 512 segments, an ink side and driver-coloured end discs that share the drum halves' rim vertices. The 0.002 annular gap that showed as a hairline ring in the top view is gone. |
| 299 | `authored-escapements.js` (299 function only), `source-presentation.js` 299 | 1. The pallets are opened to 108°, against Brown's measured 106°. The staff drops from 0.25 to 0.20 above the tips (0.24 to 0.19 pitch), and the release/catch angles are retuned to 17° and 20.4° (2.0° drop). The pallets stay 0.58 pitch long. They are now 0.34 wide radially, the tooth depth, rather than 0.5. The wider angle had brought the idle pallet's radial corner into the approaching tooth's back by 0.011. The width is along the view, so it is not visible in the plate view. 2. The fit along the crown edge is cut from about 3.4 pitches to about 2.2, near Brown's two-pitch strip. Only the far teeth nearest the verge now show through the gaps: Brown's X at the left and one far tooth under the right pallet. |
| 372 | `authored-dynamometers.js` | 1. The hoop is thinned to bore 1.35 and tips 1.44 (it was 1.36 and 1.50), with teeth 0.045 deep. The carrier arms and braces are seated 0.035 into the rim, inside the roots. 2. The carried-miter axles previously ran out through the rim, 0.095 past the tips. They now end at 1.385, inside the rim, and are r 0.075 rather than 0.068, so they no longer share coplanar faces with the arm they sleeve. 3. A tighter shadow map (half-extent 4.5, normal bias 0.02) removes the ripple on the tooth tops (`v372a/372-zoommid.png`). |
| 377 | `authored-person-treadmills.js`, `source-presentation.js` 377 note | The box bracket is removed. The diagonal plank moves forward to x 1.56, so its front face meets the rail (axis x 1.66). It now rises 0.5 above the rail on its own line, as Brown's does. The rail ends on the plank face and is held by one short bolt that ends inside the plank, at Brown's drawn hole. The plank stays clear of the drum's end rings (x ≤ 1.35) and of the man. |
| 390 | `alternating-drive-finite-parts.js` (`correctDualBandInterfaces`, 390 only), `authored-dual-band-ratchets.js` | Fulcrum pin a used to run back to the removed upright. It is now a 0.50 stub through the lever boss, standing 0.06 proud of each face. |
| 439 | `authored-water-bucket-reciprocators.js`, `source-presentation.js` 439 | 1. The spout is an open U trough: 0.46 wide and 0.22 deep with 0.045 walls, a closed upper end and an open lip over the bucket. A translucent sheet of water runs along its floor. 2. The camera elevation rises from 0.05 to 0.35. The trough's open top then reads as it does in Brown's plate, and the bucket mouth shows as the ellipse Brown draws. |
| 457 | `well-bucket-working-parts.js` (457 branch) | The forked post now uses the shared timber tone (`PALETTE.brass`, matte), the colour of the treadmill boards and the wooden buckets, instead of frame grey. |

## Intersections (`show-body-intersections --samples=129`)

- 132 (0.01): unchanged. The only solid pair is the older 0.17 toggle bar/sphere pair. The coaxial and fluid pairs are unchanged, and the thicker columns are clear.
- 167 (0.01): the sync screen runs the legacy offline factory, not the production drum, and its pairs are unchanged. The production check, `scripts/review-groove-drum-solids.mjs`, finds 0 unexpected pairs, and I regenerated `docs/validation/167-solid-clearance.json`. `scan-bad-faces`: clean (8 meshes).
- 299 (0.01): only the tangent working contacts (0.0000), as before. `verge-crown-working-solids` passes (penetration below 1e-5 over 97 phases).
- 372 (0.01): no pairs. I regenerated `docs/validation/368-372-contact-solids.json` (`POSES=33`).
- 377 (0.01): no pairs. The rail, bolt and plank are one fixed body, and the man clears the plank.
- 390 (0.01): unchanged. The pairs are the deforming band seats (up to 0.063).
- 439 (0.02): fluid pairs only, plus the older 0.0000 valve seat touch. The trough water and the lip meet the falling stream (fluid). The bucket clears the trough.
- 457 (0.01): only the intended well-water fluid pairs.

`check-loop-seams` on all eight IDs: 0 seams above tolerance. The 3.96% bucket-water visibility pop on 439 is older than this pass.

## Residuals

- 299: the journal still sits a little higher than Brown's, 0.19 pitch against about 0.15. Narrower angles or lower staffs make the idle pallet hit the tooth backs. Wider angles lower the staff further but depart from Brown's 106°. The far teeth are Brown's own. Only those nearest the verge now show, but they read more solid than his line drawing.
- 372: the hoop is now about 1.37 times the box half-height, against Brown's 1.2. The hoop lies in the plane of the carried miters, so its bore must clear their tooth corners at 1.333. Brown's 1.2 would cut through those wheels. This is a limit, not a fixable flaw.
- 439: the trough water is visible mainly from above. From the plate view the walls hide most of it, and the stream leaving the lip shows the flow.
