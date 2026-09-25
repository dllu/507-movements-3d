# Pass 56 lane p56-d review (382–507)

Scope: the pass-56 rotated-view findings for 382–507 in
`/dev/shm/audit56/d/findings.json`. Reviewer: Claude Opus 5.5 (lane p56-d),
2026-09-25. Nothing was committed.

Method: every changed ID was captured in the production loader (`async-engine` and
`model-loader`, own vite server on port 44454). The views were default phase 0 and 0.5,
rotated +60°, rotated −110° and top/behind, plus zooms where needed. Captures were taken
before (the audit tiles) and after. Intersection screens used
`scripts/screen-body-intersections.mjs --worker=ID --spacing=0.01 --samples=129`, with
`--max-old-space-size=8000` for the 1024-segment rotary-engine casings. Only one screen
ran at a time. `fluid`, `deforming` and zero-depth seated rows are listed only where
they are new.

New shared helper: `src/simulation/round-port-pipes.js`, used by 425, 427, 428 and 429.
It provides:

- a round bored port pipe with flat annular ends.
- a z-extruded casing whose wall has a square port hole only in the middle layer
  (|z − portZ| < bore). The pipe's round bore, inscribed in that square, opens into the
  casing while the wall stays whole in front of and behind the pipe.

`cutaway-back-plates.addBackCover` now also reads `geometry.userData.outlineShapes`,
which the layered casings carry.

## Per movement

| ID | Change | Screen | Proposed ledger text |
|---|---|---|---|
| 382 | The J-shaped raised bar on the mirror front is replaced by Brown's layout: a rounded inner rim (the pocket step below the frame face), a board carrying a narrow recessed left panel, and a raised D-shaped panel (straight left edge, well-rounded right corners). The hinge lug lands on the D panel. | clear | Mirror front shows the inner rim, the narrow left panel and the D panel. |
| 385 | The door, the wall beside it and the hinge knuckles (with wall and door leaves) are now presented. The pin sockets stand on small bored blocks on the door top and on the wall, and the long pins run down into them. The door and wall end at 2.30, below the links. The lintel and jamb stay out, because they collided with the door block. | clear → clear | Pins are held in sockets on the door and on the wall. Limit: the door and wall are reconstructions that Brown crops. |
| 388 | Brown's view is a section through the shafts, so no near bearings are built. One rear upright on a small foot behind the rollers carries both shafts in deep bored bosses. | tooth × plank `coaxial` 0.05 (intended bite, pre-existing) | Rollers run in far bearings on an upright behind them (hidden in Brown's view). Limit: the shafts overhang these bearings. |
| 390 | The A-frame posts are removed. The single upright behind the flywheel now rises to the fulcrum: it carries the flywheel shaft (bored boss) and fulcrum pin a, which now runs back into it. The wide base is replaced by a small foot, clear of the rim. | band `deforming` rows only (band ends) | Fulcrum and flywheel shaft carried by one upright. Limit: the upright shows between the wheel and piece A in the default view. |
| 395 | The port pipes are no longer cut. They are whole round bored pipes set in notches of a whole annular body (plain grey instead of near-black). The plug's passages remain open channels in its front face. | clear | Round bored port pipes on a whole body. |
| 398 | Added a rear frame plate behind both discs (hidden by them in Brown's view) on two legs and feet. Journals from the cam and the output wheel run in its bored bosses, and two pairs of brackets hold the crosshead guides from behind. | clear | Shafts and guides carried by one frame behind. Limit: the legs and feet show below the discs. |
| 402 | The translucent film webs are gone. Each balance rim is joined to its arbor by one slim bored two-armed bar, as in a watch balance, so the rims stay open and every part is opaque. | clear | Opaque open balances with two-armed bars. |
| 407 | **Flawed fixed.** The slide pin is now a winding peg with a small thumb wing. The cord's end is made fast at the peg's outer end, and its turns are a laid-rope helix rebuilt every frame. The free run leaves the last turn tangentially, and turns + free run = 4.1216 at every phase (test pins this to 1e-9). About 3.5 turns are on the peg at Brown's apex pose, falling to 1 turn with the bar relaxed. The slide stays locked, as the caption says. | 0.02/33 screen: only the pencil point on its drawn arch line (intended) and the bar/tip-clamp seat; cord, peg and slide clear (0.01/129 did not finish) | Cord length is conserved: it winds on and off the slide pin. Limit: the setup bends are a prescribed tapering-curvature family, not an elastic solve. |
| 415 | Rod D now runs in front of the rim (z 0.80, as Brown draws it crossing the rim). It ends in an eye round a lengthened lever-tail pin and butts on the slider. The slider runs in a channel guide (two bars and an end bridge) just beyond the crop. The white slider pin is removed. | rod × rim 0.15, rod × lever 0.092 and slider × guide 0.08 → clear. Remaining: pawl hinge-eye `coaxial` 0.01 (pre-existing) | Rod D ends at its slider in a guide. |
| 425 | The two-slab port walls are replaced by round bored pipes. They stand on the cylinder and rise through the flange, with square bore holes in the flange's middle layer only. The back cover now closes the whole outline. The flat dark port backs are removed. The guide cap is flush with the rails (0.88 × 0.92), so it no longer overhangs as a hovering block. | clear | Round port pipes; guide capped flush. |
| 427 | Square neck posts → round bored pipes (0.34 outer, 0.22 bore). The casing is layered with square bore holes in the middle layer, so each pipe opens into the bore. | clear | Round bored inlet and outlet pipes. |
| 428 | Slab-pair ports → round bored pipes (0.52 outer, 0.24 bore), run into the wall up to the bore. The neck fillets are removed. The front lips are no longer notched. | clear | Round bored side ports. |
| 429 | Plate-pair necks → round bored pipes (0.475 outer, 0.26 bore). The oval casing and back cover no longer carry neck slabs. The throat opens only through middle-layer holes. `docs/validation/429-mating-contact.json` was regenerated (pistons unchanged; results identical). | clear | Round bored top and bottom ports. |
| 430 | The pit is a section, so the front bearing and pedestal are removed. The shaft ends at the hub in front and runs back to the far bearing, which now sits on a pedestal and footing behind the race. | no solid rows (hub/spokes × shaft reported as `fluid`, as before) | Wheel shaft carried by the far bearing. |
| 433 | One timber brace runs from the overhead beam end to the spout's underside. | clear | Spout carried from the beam. Limit: the brace shows at the upper right. |
| 439 | The gallows (post, beam, bored shaft hanger), the ground and the striking block are presented again: the valve opens by striking the ground. A post on the widened ground carries the flume's upper end. The authored fit box was tightened to Brown's crop, but the displayed framing comes from the display profile and still shows the whole frame. | rope-end `deforming`, seated zero-depth anvil/valve contacts | Pulley hung from a gallows; flume on a post. Limit: the frame and ground show in the default view until the profile is re-measured. |
| 440 | The inlet flume's upper end rests on a post standing on a short sill run out from the base, clear of the trough's sweep. | clear | Flume carried by a post. |
| 445/446 | New cutaway spec: the revolved water is clipped on z = 0 like the half-boxes (stream, film, spreading bell, cone, crown, column, top plume). The fixed plate and stem are cut too. | clear | No water hangs outside the cut boxes. Residual: the reported thin dark line under the conduit roof was not reproduced in zoomed captures and is unresolved. |
| 447 | The river is deeper (bed at −2.0) with an opaque earth bed. The anchor lies on it and the line rises to the bow. The anchor eye and bow ring now swivel to face the line. | swivel-ball seats `coaxial` 0.0000 only (after turning both swivels to face the steeper line; the solids test caught a 0.0047 rope/eye graze first) | Anchor on the river bed. Residual (not in this list): the boat is still a shallow hull. |
| 454 | The rim and floor plates now stand proud of the wall (r 1.34) in the casing colour, so the coincident 1.31 faces no longer z-fight. The orange clamp torus is removed. The diaphragm is clipped on the cutaway plane. | only prescribed diaphragm × centre-clamp/link `deforming` rows (the drive attachment) | Plain rims; the diaphragm is cut with the chamber. |
| 459 | The translucent box is replaced by an opaque back wall and floor. The side walls end at the section plane just in front of the water. | rope/bail `deforming`; worm × star wheels solid 0.0071 (untouched parts; not introduced here) | Well shaft shown as a section. |
| 462 | The posts now stand on the reservoir floor and carry both fixed axles in two cross beams. The frame is no longer removed. | clear | Both chain wheels carried. Limit: the posts show in the default view. |
| 463 | The dark transverse straps on both leaves are removed in presentation. | deposit/bed seated 0.0000 | Plain leaves. |
| 475 | The water is already clipped on z = 0 (verified in rotated views at phase 0.5). The water tint was lightened (opacity 0.24) so the half-section reads through it. | clear (water rows are clipped volumes) | Residual: seen head-on at mid-cycle, the full rear half still reads as a teal body; this is a legibility limit, not water in the removed half. |
| 480 | Tube b passes through a bore in the tank floor down to −2.48, like the pipes. The dark base collar that z-fought with the floor is removed. | clear | No floor artefact; b passes through the floor. |
| 491 | Added a deck (Brown's ground line) under the ratchet, bored for the spindle and the deck pipe. The deck pipe now stands on it. The deck is marked `beyondPlateCrop` because it runs on to the pipe. | clear (0.02/17; the 0.01/129 run did not finish) | Capstan and cable pipe stand on a deck. |
| 498 | The flange is presented again, bolted to a boiler head with the start of its shell just beyond the crop (`beyondPlateCrop`). | clear | Supply pipe ends at the boiler. Limit: the head's edge shows at the left of the default view. |
| 499 | The translucent face is replaced by an opaque paper dial plate behind the working parts, and the case is closed by a metal back cup. | only link-ball and tube-end joint rows (untouched parts) | Dial opaque; case closed. |
| 500 | The section figure moved +1.6 (gap 1.86 instead of 0.26). | only link-ball and diaphragm-boss joint rows (untouched parts) | Section reads as a separate figure in the default and moderate views. Residual: at ±60° or more its half-drum back still overlaps the gauge in projection. |
| 501 | Graduations are fine lines (0.006; whole inches 0.010) on a thin spine instead of 0.026 ticks at a 0.021 pitch, which had merged into a block. | clear | Fine graduations. |

## Tests

These pass after the updates (updated assertions follow the changed design, not weaker
bounds):

- movement-382, 385 (updated), 388 (updated), 390 (updated), 395, 398, 402, 407 (updated:
  helix continuity, tangency and conserved length), 415 (updated: pin-to-pin length plus
  rendered shank), 425 (updated roles), 427, 428, 429, 430, 433, 439 (updated: supports
  presented), 440, 445, 446, 447, 454, 459, 462, 463, 475, 480, 491, 498 (updated: fit
  excludes `beyondPlateCrop`), 499, 500 and 501.
- drawing-template-working-solids, adjustment-contact-solids, door-closer-working-solids,
  textile-planer-working-parts, dual-band-390-contact, holly-mating-profile (after
  regenerating the report), cock-ferry-working-solids and source-presentation.
- The related family tests: 703 in total, all passing after the fixes.
- models.test "all movements aim for two seconds".

## Display profiles to re-measure

385, 388, 390, 398, 415, 425, 427, 428, 429, 430, 433, 439, 440, 447, 454, 459, 462, 480,
491, 498, 499, 500 and 501.
