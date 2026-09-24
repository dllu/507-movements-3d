# Pass-51 wave-2 lane w2g-341-400 review

Scope: 341, 342, 343, 348, 350, 352–355, 357–359, 361–363, 365, 366, 368, 369,
371, 373–379, 382–385, 387–394, 396–398 (audit items in
`docs/visual-audit-pass51.md`). Each ID was captured before and after with
`scripts/review-movement-source-views.mjs` and checked with
`scripts/show-body-intersections.mjs --spacing=0.01 --samples=129` (358 at
0.02/33 because the finer run ran out of memory; 352 and 358 "before" runs ran out of
memory). Depths are worst solid-pair depth before → after.

Profiles needing re-measurement (new geometry exceeds stored motion bounds, so
production framing is still clipped or stale): 374, 375, 376, 377, 382, 385, 393,
397. `measure-display-profiles.mjs` was not run by this lane.

| ID | Change | Depth | Remaining flaws |
|---|---|---|---|
| 341 | None; already matches | clear | Small texture on crank hub |
| 342 | Undrawn wall removed; plank runs full width over the pier | 0 → 0 (touch) | Scripted chain path; crosshead a little low |
| 343 | Camera crop to plate (crank box top to cylinder cover); cylinder already the plate's table cover | unchanged | Crank phase differs; straight spokes |
| 348 | Plate pose (slots ≈29°) and crop; guide pin and white indices removed; slide fronts hidden (plate dashes them) | 0.0485 → clear | Rod B leans ≈5° vs ≈1.5° |
| 350 | Dash strip, input rail, shoe, pin post, markers removed; shorter bar, plate guide spacing, flange guides; framed on bar and lever | 0.0343 → clear | Bar thin; riser cannot rise above C without hitting O |
| 352 | Slab, rear crossmember, sheave posts, flanges, markers removed; sheaves hang from leg brackets; handspike through lengthened barrel replaces crank | unknown → 0.0145 | Crown an arch, not rounded cap; hanger touches sheave groove |
| 353 | Fulcrum post removed (minimal bearing hidden behind journal block); plate-shaped head and slender concave wipers | 0.0775 → 0.0771 | Wiper grazes helve (existing); plate's base block under cam post absent |
| 354 | Depth mirror puts disk in front (stem/crosshead behind, as dashed); rimmed disk; single-block guides; plate crop; bearing and indices removed | 0.0075 → 0 | Crank pin hidden behind disk |
| 355 | Raised camera so ring A reads as the plate's ellipse; indices hidden (356 unchanged) | 0.0325 → 0.0325 | Small subject; disc foot, not flared bell |
| 357 | Arch/leg frame replaced by sectioned cast casing (rear half); engine shaft exits right with pulley; indices removed | 0.1594 → 0.1594 (bridge pair 0.129 gone) | Casing tall; frame H and rods unchanged; interior dark |
| 358 | Rebuilt as plan view: stubby fusee, two-bar carriage with edge-on wheels on rails, long down-pointing crank, mid-stroke opening; indices removed | unknown → clear (coarse) | Cord length drifts ≈0.37%; anchors off-plate |
| 359 | Heavy rounded fly (r 1.81, t 0.50); rim ring and indices removed; level fov-16 camera | 0.10 → 0.10 (cord attachment) | Thin spindle; compressed vertical proportions |
| 361 | Front camera; base removed; spoked handwheel replaced by edge-on rounded disk; indices and belt markers hidden | 0.124 → 0.124 (coaxial lever/pivot) | Straight ball-ended lever vs plate's hooked lever |
| 362 | Front camera (yaw removed); drum flanges and indices hidden | 0.030 → clear | Groove reads wavy |
| 363 | Mirrored (left end up); seats/handholds replaced by shoes; concave buttresses on post; indices removed | clear → clear | Shoe end boards square, not splayed |
| 365 | End dots hidden; white cues recoloured dark | 0 → 0 (tangent) | Shaft shoulders absent |
| 366 | Front camera; closed rectangular frame replaces C-frame and bed; treadle lowered under frame on its own post; foot pad and indices removed | 0.023 → 0.023 (feather key) | Solid bevels vs hatched sections |
| 368 | Flat elevation (depth mirror, rack in front of spur); fit crops rack travel like the plate; rims and indices hidden; 368-372 contact report regenerated (0 penetrations) | 0.077 → 0.077 (coaxial shafts) | Small cylinder; spiral not visible at t=0 |
| 369 | Tangency dot and bob mark hidden | 0.204 → 0.204 (cord in bob) | Posts too far out; trusses don't meet cheeks |
| 371 | Four round holes replaced by curved-sided four-arm web; indices hidden | 0.0168 → 0.0033 | Opening still wider than plate |
| 373 | Dial kept (the plate draws a graduated dial, not a worm wheel); open four-arm pulley; indices hidden | 0.070 → 0.070 (pointer pin) | Hoisted weight floats; straight pointer; adjusting screw absent |
| 374 | Treadle slopes up-left per plate centres, longer, tapered; foot pad and indices removed; fulcrum bearing cleared | 0.030 → clear | Needs profile re-measure (lever clipped) |
| 375 | Front elevation; tall edge-on runners (ratio 1); symmetric frame; flared pan; slab, lower bearing, indices removed | 0.034 → clear | Needs profile re-measure; wide runners scrub |
| 376 | Face-on; square chord lattice and riveted rim replace spokes; trestle, rails, index removed | 0.057 → 0.057 (horse) | Tread slats visible inside rim; re-measure |
| 377 | End view with notched spur wheel and A-frame on plank; plank side bar; slab and rail posts removed | 0.151 → 0.151 (figure self-overlap; frame pairs gone) | Short drum; floating rail; re-measure |
| 378 | Rails, A-frame base, index removed | 0.373 → 0.373 (saw in log, no kerf; carriage 0.085 into beam) | Log reads as barrel |
| 379 | Turned crank knob; two-ball tommy bar; indices removed (380 unchanged) | clear → clear | Coarse feed thread |
| 382 | Broad flat rounded mirror frame; baluster pillar; mirror moved clear; indices removed | 0.128 → clear | Starts face-on vs plate's tilted mirror; re-measure |
| 383 | Broad arched strap frame; shorter bearing; indices and cloth stripes removed | 0.030 → clear | Zero-thickness cloth |
| 384 | Indices removed | clear → clear | Subject about half-frame to keep full orbit sweep |
| 385 | Long upright pins, sockets removed; small pear weight; indices removed | 0.0075 → clear | Re-measure (pins clipped) |
| 387 | Face-on camera; indices removed | 0.166 → 0.166 (water plane; 0.129 coaxial pins, missing bores) | One figure vs two; heavy wharf |
| 388 | Face-on; indices removed | 0.050 → 0.050 (intended nip) | Spiky teeth |
| 389 | Slab/box feet replaced by sectioned cast stand with stepped feet; face-on; indices and front straps removed | 0.123 → 0.056 | Rear bridges visible; simple pawl |
| 390 | Broad flat flywheel rim; bored lever boss; dark band C; web, markers, indices removed; face-on | 0.129 → 0.037 (band seats) | Round cord bands vs flat |
| 391 | D-shaped grooved guides; bored crosshead bosses; input rod and indices removed; face-on | 0.090 → clear | Guides small (corrects stale "supports removed" claim) |
| 392 | Straight clamped leaf spring (cantilever); flat-rimmed wheel; indices removed | 0.129 → 0.129 (designed seats) | Preload stand-in spring force |
| 393 | Overhead standard, arm, bearing removed; table on square leg and brace; near eye-level camera | clear → clear | Re-measure (cropped, maxNdc 1.68) |
| 394 | Rod guide and indices removed via presentation (corrects stale claim) | 0.079 → clear | Heavy flange walls |
| 396 | Plain armless balance rim (clears staff a); straight crooked lever; indices removed | 0.1995 → 0.080 (roller/guard pin) | Escape wheel large |
| 397 | Single long flat shuttle bar; slab, rails, indices removed; crank boss set back; face-on | 0.057 → clear | Re-measure (maxNdc 1.73); disc crank vs eyed arm |
| 398 | Plain disc output wheel; face-on; indices removed | 0.097 → clear | — |

Stale ledger claims corrected: 374–385 rows claimed "None in scoped checks" but
sampled overlaps existed in all but 379 and 384; 391 and 394 claimed undrawn
supports removed while guides/rods remained. `reciprocating-cord-working-parts.js`
still carries a stale 392 "tangent-circle" spring note (shared helper, not edited
by the 392 fix).
