# Pass-51 wave-2 lane w2h (401–507) review

Scope: the visual-audit-pass51 items for 401–406, 408–410, 413, 415–417, 419–420, 422–436, 439–444, 447, 451, 453, 455–471, 473, 477–486, 488, 490–491, 493, 495, 498, 500–501, 504 and 507. Captures were made with `scripts/review-movement-source-views.mjs` (before: `/dev/shm/w2h/before`, after: `/dev/shm/w2h/after`, `/dev/shm/w2h/A`, `/dev/shm/w2h/C`) and every after capture was compared with the engraving. Intersections come from `scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`; "before" is the HEAD tree.

## Open follow-ups for the integrator
- Display profiles are stale and still crop or shrink the new framing (see `measure-display-profiles.mjs`) for 419, 422, 423, 429, 430, 433, 470, 471, 479, 482, 484–486, 488, 490, 491, 493, 495, 498 and 501. The captures for 423 (casing top), 490 and 498 (handwheel) are cut off until these are re-measured, and the camera-catalog test fails for 490 and 498 until then.
- The audit items for 430 (six spokes) and 486 (six arms) do not match the plates: the models already have the right counts.
- 500 is unchanged: its missing section view is still open.
- 459 (Brown's pin wheels and horizontal wheel), 444 (the lower waste tank) and 468 (a close joint view instead of the whole haul) still need geometry work.

### Lead-owned IDs (410, 417, 439-469)

| ID | Change | Worst intersection before -> after | Verdict |
|---|---|---|---|
| 410 | Board turned face up (`root.rotation.x=-pi/2`) and an isometric default view from the adjustable cheek's side, as the plate; board lengthened past the gauge; white indices, slotted white thumb head, end-grain bars, witness strip and white contact strips removed; dark bisecting line; knob seated on the cheek cap. | 0.0650 (thumb head in cheek) -> 0.0007 (line touch at the point) | Isometric board, crossbar, cheeks and links now read as the plate. Residual: cheeks are blocks, not Brown's tall arched cheeks. |
| 417 | Rebuilt fixed parts to the side elevation: plank bed, T-standard D with the long bearing sleeve at the crank end, crank handle instead of a spoked handwheel, slide C as a sectioned two-block bar on the plank (no rails/lips/keepers), white indices removed, camera side-on. Motion law unchanged. | 0.1268 (rod through shaft) -> 0.0627 (rod shank over bent journal, known) | Layout matches the plate. Residual: Brown's bent end is an angled end in a socket housing rigid with B; the reconstruction keeps an offset parallel crank journal, so B slants more than drawn. |
| 439 | Removed white pulley stripe and rope marker. | presentation only | Pulley, rope, bucket, weight. Residual: ground anvil kept (opens the valve); solid pulley disc. |
| 440 | Lower three-quarter camera; angle index removed. | presentation only | Closer. Residual: flat tray where Brown draws a V-divided trough. |
| 441 | Flat face-on elevation, cameraFov 10; slimmer float channels (water-lifting-solids.js); white current, channel and hub markers removed. | none before -> none after (fluid only) | Matches the elevation. Residual: floats still wider than Brown's lines; outer ring not drawn. |
| 442 | Camera across the stream along the wheel plane; long axle out to trestles at both banks; stream reduced to a shallow band; base slab, box bed, current markers and hub index removed. | 0.4700 -> 0.2750 (pots dipping in the stream volume, intended immersion) | Composition now follows the plate. Residual: box pots where Brown draws lozenge pots. |
| 443 | Camera nearer the axis; stream reduced to a shallow sheet; base slab, bed box, submerged lower-bearing post and bridge, stream markers and white stripe removed. | none -> none | Better. Residual: axis steeper than the plate, so the paddle wheel reads flatter; upper bearing still on a post. |
| 444 | Flat camera; base slab and white flow markers removed. | presentation only | Residual: closed supply box and missing lower waste tank. |
| 455, 456 | Flat camera; undrawn casing feet and white rotor/axle indices removed. | presentation only | Match the sections. Residual: 455 octagonal rotor vs ring drum, round abutment vs hatched wedge. |
| 461 | Flat camera, cameraFov 10; foundation slab removed. | presentation only | Residual: troughs heavier than Brown's lines. |
| 463 | Face-on section, cameraFov 9; the undrawn pivot post and bridges were removed (chain-weir-working-parts.js); upstream head extended to the leaves; lower batten moved off the pivot axle. | 0.0174 coaxial -> clear (fluid only) | Reads as the section. Residual: leaves thinner than Brown's planks; one animated figure for his two. |
| 465 | Undrawn operator pads removed. | presentation only | Residual: beam level at t=0 where the plate tilts it; no figure. |
| 466 | Flat section camera, cameraFov 10; foundation removed; reservoir front wall cut away as in the section. | 0.0437 -> 0.0437 (existing plunger/outlet) | Flat elevation. Residual: glass ram cylinder vs cast section; the lever stand passes through the tank. |
| 467 | Flat section camera; the two cube ears were replaced by one cast cupped head; the box claw was replaced by a J-hook. | 0.0134 -> 0.0134 (existing screw tip/feed) | Head and claw read as the plate. Residual: base box larger than Brown's. |
| 468 | Plan-like camera; river-surface strips removed. | presentation only | Residual: Brown draws a close plan and elevation of one joint; the reconstruction shows both whole mains being hauled. |
| 469 | Flat camera; thermometers removed. | presentation only | Residual: round hose. |

### 401–436 (sub-agent A, verified by the lead from the captures)
- 401: a plain faceplate with an inner turned ring; the four black spokes and the white index were removed, and the treadle is slim with the pad removed. Clear except the designed spring seat (0.025).
- 402: plain bored balance discs; the frame bars and white indices are removed. 0.0801 -> clear.
- 403–406, 408, 409: indices, graduations, witnesses and 406's base chord removed (presentation). 409's set-screw head is still white.
- 413: edge-on camera; the shafts run right only; the hub nut and crank handle were added. Known shaft-in-disc overlap of 0.1295 (not changed).
- 415: opaque plain disc D; the spokes, slider guide and block were removed. Known rim/rod and lever/rod overlaps (not changed).
- 416: plain flywheel, slim treadle, flatter camera; pitman × shaft 0.1087 -> clear.
- 419: plain discs A and B; the rear standard and cradle block were removed. Residual: the rocker is a tube arc, not Brown's crescent.
- 420: the gallows was removed and a canon loop added to the bell; the bell crown × hanger overlap of 0.08 is cleared. The existing pedestal × hammer overlap of 0.06 is known.
- 422: new vase-shaped cast casing; the slab and loose tubes were removed. 0.11 -> clear.
- 423: new closed casing and the legs were removed. The crank overlaps (0.279 and 0.226) are known and unchanged.
- 424–429: markers, spheres and tints removed. 424's slab was removed; 426 has ports D; 429 has an oval casing, and its validation report was regenerated with identical results. Residual: 428's casing is round, not ovoid; 425–428 still have bed slabs.
- 430: a masonry breast wall was added; the slab and pedestals were removed. The known hub/spoke × shaft overlap (0.22) is unchanged.
- 431–436: pedestals, flow beads and runner stripes removed; 436 has a flat section camera. Residual: 431's water box, 432's tailrace tube and 436's squat casing.

### 470–507 (sub-agent C, verified by the lead from the captures)
- 470: an arched cast standard replaces the gallows. The 0.0416 lever/pitman joint is known and unchanged. Residual: the steam pipe and valve gear sit on the right.
- 471: a single loop C-column with a bell foot replaces the gallows. 0.0464 solid and 0.1045 coaxial -> clear.
- 495: a housed section on a cast foot with bored standards, drum C′ and the pulley on the right; flat camera. 0.0841 coaxial -> clear. Residual: the gears are whole, not sectioned.
- 473, 477, 478, 480, 481, 483, 484, 486, 488, 491, 504, 507: slabs, beads, dials, indices and arrows removed and/or the camera flattened with a narrow field of view.
- 479: ball weights C and plain pulleys.
- 482: domed cover with a slotted knob.
- 485: door-side view and an oval tail vane.
- 490: plan view with handles added.
- 493: the shackle turned a quarter turn.
- 498 and 501: stands, boards, clips, numerals and pointers removed. For 501 only the J tube, the mercury and the inch marks remain, which corrects the stale ledger claim.
