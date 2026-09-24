# Lane m8: framing, ropes and minor residuals (247, 261, 262, 269, 271, 277, 345, 348, 384)

All nine rows were rated **minor**. Captures came from a private non-watching Vite server (port 44332) using
`scripts/review-movement-source-views.mjs`, plus 8–12 phase stills per ID. They are stored in `/dev/shm/m8/{before,after,ph}` and are not in Git.
Intersections were screened with `scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

## Changes

| ID | Change | Intersections | Proposed |
|---|---|---|---|
| 247 | The view now follows the lowered rod: a display frame offsets the whole model by the rod's descent. The rod, catch and loaded weight stay where the plate draws them. The thin contact line rises from below to meet the probe. After release, the line and the dropped weight sink out through the bottom edge as the rod is recovered, and the sling brings the weight back up into view. The camera fits the plate pose (rod cut 1.2 above the weight) plus the line's highest point. The subject fills about 87% of the frame height (was about 60%). All relative motion, contacts and model-frame kinematics are unchanged. | clear → clear. Only the intended foot/line contact (0.0000) and the pre-existing open-mesh sling/hook junction (fluid 0.083) remain. | reasonable |
| 261 | No change. | unchanged | minor (forced) |
| 262 (+263) | Brown's own proportions replace the enlarged eccentric. D sits 13/55 of B's large radius below B's centre (0.28, was 0.68; the stale raster was corrected to B.y 164 and D.y 177). Roller C starts at Brown's side-view station, 0.25 from the large end (was 0.82). With D inside every section of the cone, C turns one way at a speed that varies about twofold. It also rises and falls twice per turn, and each fall is longer than the rise before it (1.74 against 1.66 over three turns). This is the caption's reciprocation "with the movement in one direction shorter than the other". The 262 camera now looks at B's large end. Standard E stands behind B, and only its flares and foot plate show under the rim, at Brown's depth. The large-end carrier bar becomes a flush round boss around D, drawn like the plate's circle around D. | clear → clear (cone/roller working contact 0.0000 only) | reasonable |
| 269 | No change. | unchanged | minor (forced) |
| 271 | No change. | unchanged | minor |
| 277 | Dog a is now Brown's slender traced finger with a short hook spur at the working height. The broad wedge that filled the space to the ratchet is gone; the new outline is a subset of the old one, so the ratchet and spring clearances can only grow. The cylinder now runs on past a left crop at Brown's broken edge (raster x = 7) instead of ending in a finished front face, which also enlarges the subject. | clear → clear | minor |
| 345 | The crank block no longer receives the crank's cast shadow, so it reads as Brown's plain block, not a dark mass. The block's size and crop are unchanged. | clear → clear | minor (forced) |
| 348 | No change. The listed "grey guide block above the disk" is stale: every guide and support is removed by the source-presentation entry. No grey part is visible in the default, oblique or 700×500 phase captures. | unchanged (sampled-clear) | reasonable |
| 384 | No change. The authored fit box is already intersected with the ±5.03 sampled motion bounds, so tightening it has no effect. | unchanged | minor (forced) |

## Forced residuals (why no better construction exists)

- **261:** Disk B is carried on a bracket behind it, which is Brown's bearing arm and gusset.
  - If the drum and cord are moved in front of B, rod C must go behind B, because the crank pin sweeps across the drum-to-E strand in plan. Rod C would then pass through B's shaft whenever the pin is near the bottom.
  - If rod C is moved behind the bracket instead, the pin crosses the bracket arm at 0°.
  - So the cord must stay behind B, and its drum-side strand disappears at B's rim.
- **269:** The frame travels 17 tooth pitches (5.2 units) against a 6.7-unit frame, so fitting the whole stroke makes the subject about 80% of the plate size.
  - A plate-pose crop would push half the frame out of view.
  - The closed end must sit 3.4 pitches farther right than drawn so the gear tips clear it at the stroke limit.
  - The handoff teeth must be relieved, because Brown's spacing puts two teeth in mesh at once.
- **271:** The bar is drawn with a two-pitch periodic wrap, so its left end and cord jump back 2 pitches every 5 s. The only alternative is a multi-cycle run followed by a prescribed slide-back with both pawls held up. That is a larger undrawn action and would need a new timeline, so it was not done.
  - The teeth are deeper than engraved so the hooks clear.
  - Brown also draws no pulley bearing, so that point is plate-faithful, not a flaw.
- **277:** At Brown's hook height (about 0.87 higher), a hook lift L in the page plane can turn a face ratchet a full sixth only at mean height h ≤ L/√3 (see below).
  - The hammer gives L ≈ 0.6, so the hook must work within about 0.35 of the axis.
  - This is why the hook spur sits below Brown's tip.
  - The ratchet teeth stay shallow (0.1) so the dog can ride back.
  - The derivation: the contact must satisfy tan(φ₂−φ₁) = √3 with d·(tanφ₂−tanφ₁) = L and d·(tanφ₁+tanφ₂)/2 = h. This has a real solution only when 4L² ≥ 12h².
- **345:** The crank's full turn dips 2.9 source units below O, but Brown crops 1.4 units below O. Keeping the crank whole therefore shows about 1.5 units more block than the plate. Cropping at Brown's line would cut off the crank pin and rod eye for about a quarter turn.
- **384:** The arm must turn 1.5 revolutions round the fixed point, so the ±5.03 swept width is the frame. A half-turn sweep kept to the right of the point would allow a plate-size crop, but the helicograph would no longer describe a spiral. Not adopted.

## Proposed ledger text

- **247:**
  - (a) Default and phase captures inspected. The plate pose fills the frame as on the plate; the view follows the rod, the contact line rises into view and the dropped weight leaves through the bottom edge.
  - (b) sampled-clear. Only the foot/line contact (0.0000) and the open sling/hook junction remain.
  - (c) visibleFlaws: none. limits: "Detent actuation, drag and impact idealized; the view follows the rod, so the sea bottom moves rather than the rod."
- **261:**
  - (a) unchanged.
  - (b) sampled-clear (unchanged).
  - (c) visibleFlaws unchanged. Reason: the pin and rod must lie in front of B and the bracket behind it, so the cord must run behind B.
- **262:**
  - (a) Default and phase captures inspected. B is viewed from its large end, with D's round boss 0.24R below centre as drawn, standard E behind B with only its feet showing, and C riding on B's rim, rising and falling.
  - (b) sampled-clear. Only the cone/roller working contact remains.
  - (c) visibleFlaws: "B covers the feet when its offset swings it down, as any eccentric at Brown's offset must." limits: "The pressing spring is not drawn, so not rendered; C's circumferential rolling is ideal; the finite screw traverse returns after three turns."
  - Note for the ledger owner: **263** shares this factory. It now shows Brown's small offset and the roller at his 0.25 station, and its reversal claim becomes "rise and fall". Its row needs the same update.
- **269:**
  - (a) unchanged.
  - (b) sampled-clear.
  - (c) visibleFlaws unchanged, all forced as explained above.
- **271:**
  - (a) unchanged.
  - (b) sampled-clear.
  - (c) visibleFlaws: "Teeth are cut deeper than engraved so the pawl hooks clear; the bar and cord jump back two teeth each cycle." limits: "Brown draws no pulley bearing; holding and load transfer imposed."
- **277:**
  - (a) Default and phase captures inspected. The slender dog a with a short hook spur; the cylinder is broken off at the left edge as on the plate.
  - (b) sampled-clear (0.01, 129 poses).
  - (c) visibleFlaws: "The hook spur works about 0.86 below Brown's dog tip and the ratchet teeth are shallow (a page-plane dog can turn the face ratchet a full sixth only near the axis height)." limits: "An undrawn detent is assumed."
- **345:**
  - (a) Default capture inspected. The crank block is flat-shaded.
  - (b) sampled-clear.
  - (c) visibleFlaws: "More of the crank block shows than on the plate, because the view keeps the crank's full turn, which dips 1.5 source units below Brown's crop."
- **348:**
  - (a) Default, oblique and phase captures inspected. No guide, block or support is visible.
  - (b) sampled-clear.
  - (c) visibleFlaws: none (the listed guide block is stale). limits unchanged.
- **384:**
  - (a) unchanged.
  - (b) unchanged.
  - (c) visibleFlaws unchanged. Reason: the 1.5-turn sweep round the point sets the frame width.

## Follow-ups for the integrator

- Re-measure display profiles for 247, 262, 263 and 277. The world-space motion bounds changed for 247 (rod frame), 262/263 (eccentric and station) and 277 (the cylinder extends to the left).
- Update the ledger rows for 262 and 263 together.

## Follow-up (after 536adc3): 262 stand E and 345 base

- **262:** The end-view standard E is now Brown's stand. It has a thin foot plate at his depth (underside 73 px, top 64 px of B's 55 px radius below B's centre), a slim central neck, and two splayed cove legs.
  - The legs meet B's outline 20 px either side of the neck. Their tops and the neck end behind B at every pose, so the outline has no holes and no loop closes round a window.
  - The stand gets a lifted frame-grey finish, because from the large end it faced away from the key light and read as a black slab.
  - At Brown's proportions the legs sit inside B's swept disc. That disc has radius R + e = 1.48 about D, while Brown's foot top and underside lie 1.11 and 1.31 below D. So B passes in front of the stand for part of each turn; the legs show whole in the plate pose and over the upper half of the swing.
  - Putting E in front (a view from the small end) would keep the legs visible, but its neck would then cross B's face, which Brown does not draw.
  - Screen: clear (cone/roller working contact 0.0000 only; stand watertight).
- **345:** The tall block is now a low base plate, as wide as Brown's block. Its top lies just below the crank's swept circle, and a small tapered bearing pedestal with a round boss rises behind the crank to O.
  - The frame crops the base plate's bottom as Brown does (fit bottom -2.2 source units; the crank stays within 0.94 NDC through the turn).
  - The crank pin and eye clear the base in the view at the lowest phase, and in depth the crank runs in front of the pedestal.
  - Screen: clear.

Proposed ledger text:

- **262:**
  - (a) Default and phase captures inspected: large-end view, D's boss, C riding on B's rim, and stand E with a foot plate and two splayed legs under B as drawn.
  - (b) sampled-clear (cone/roller working contact only).
  - (c) visibleFlaws: none. Limits: "B's offset carries it in front of stand E's legs for part of each turn (Brown's legs lie inside the swept disc); pressing spring not drawn; ideal rolling; the screw returns after three turns."
- **345:**
  - (a) Default and phase captures inspected: a low base plate cropped at the bottom edge, with a small bearing pedestal behind the crank.
  - (b) sampled-clear.
  - (c) visibleFlaws: none. Limits: "The bearing pedestal's shape is inferred (Brown's block top is at the crank centre; here the base is lowered below the crank's sweep so the whole turn stays in view); the cylinder is closed, so the piston is hidden."

Display profiles to re-measure: 262, 263 and 345, in addition to 247 and 277. The 263 geometry is unchanged in this follow-up; its stand keeps the side-view pedestal.
