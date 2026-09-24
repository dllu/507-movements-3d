# Lane 7: hydraulic, steam and miscellaneous source-match pass

IDs: 412, 418, 437, 438, 445, 446, 474, 492, 496, 502, 503, 505. I captured each ID with
`scripts/review-movement-source-views.mjs` and compared the capture with
`public/engravings/mm_NNN.png`. I ran intersections with
`scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`. "Solid" means
solid-to-solid pairs. Fluid-marker bookkeeping overlaps are listed separately.

| ID | Change | Worst solid depth before → after |
| --- | --- | --- |
| 412 | Added Brown's outside band as one fixed strap. Its two ends leave tangentially as eyed levers, and the lower lever is hooked. Plate positions are mapped through the plan camera. The annulus index moves onto the plain rim. | 0.0025 (index against pinions) → 0.0000 (tooth contact only) |
| 418 | Added a sectioned conical casing: the back half of a solid of revolution with a bored top and a foot flange. It stands on a sectioned chest cover whose recess encloses D. The fixed standards and crown were deleted. Guide D gets a head above the upper slot, and its screw rises through the casing top to a nut. The steam port was lowered below the valve. | 0.0839 (screw into upper axle and slider) → none |
| 437 | The scroll now starts at the top (90°). The inlet is a level channel entering from the left along the scroll tangent. The upper vanes a are short stubs in the outer ring (inner radius 0.52 → 1.60). | none → none |
| 438 | Deleted the floor plate and the catch basin. The lower step is now Brown's square block, with the cone point seated in a bore. | none → none |
| 445, 446 | Rebuilt as Brown's section. An L-shaped supply channel feeds a small box with a floor orifice. Below it, a larger box with a top opening covers the plate on its flared stem, and the discharge leaves to the right at floor level. The boxes are cut away at the mid-plane and the start view is near-frontal. Fluid envelopes were re-bounded so they no longer enter solids. | fluid-solid 0.29 → none; fluid-fluid overlaps remain by design (≤0.153) |
| 474 | Legs are now S-curved and splayed, starting on the boiler. The risers are rebuilt as straight tubes from lid ports near the rim. | none → none |
| 492 | The plate view hides the second end unit, its rope, the common bar, the grip and the arrow; the model is unchanged. | 0.1041 → 0.0945 (rope ends in the tackle eye and lever eye) |
| 496 | The rolls are plain, not fluted, with radius 0.46 → 0.40, and the A–B spacing is 1.48. The flyer is a close inverted U. The spindle is lowered, the view is near side-on, and the roll bearings are hidden. | yarn 0.0238 → 0.0231 |
| 502 | Unchanged. Extents check that the carrier and fixed-member clearances are clear. | none → none |
| 503 | C and D are broad, shallow 48-tooth wheels and B is a 28-tooth wheel, all on one apex. Hubs, sleeve F and boss G are refitted. | 0.0070 → none |
| 505 | Arm D is one slender bar with no separate handle block, and its eye is rebored to clear the sun sleeve. | 0.0052 → none |

## Residuals

- 412: the band's function is not in the caption, so it is fixed and non-working. The carrier's lobes are smaller than the plate's broad three-lobed web.
- 418: guide D is still an open frame, where Brown draws a solid casting with a slot. The chest recess has no inward lips. Valve A is smaller and higher than drawn.
- 437: buckets c are curved blades, where Brown draws shaded sectors. Casing lugs and flange are not modelled.
- 445/446: cone broader than Brown's column; box depth assumed.
- 474: the risers lean about 12° outward; the plate draws them vertical.
- 496: the lower spindle is shorter than drawn.
- 502: A is about 10% larger than E in the plate; the tooth counts derived from the canvas are kept.
- 503: sleeve F is a cylinder, where Brown draws a block.
- `docs/validation/502-505-gear-solids.json` records a stale 503 hash. `docs/validation/412-495-gear-solids.json` and `503-504-contact-solids.json` were regenerated (0 penetrations).

Display profiles need re-measuring for every ID above except 437, 438 and 502. 437 and 438 kept their authored fit bounds.
