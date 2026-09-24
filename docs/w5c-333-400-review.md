# Wave-5 lane w5c: residuals for 333–400

Pass-51 wave-5 lane for 333, 339, 342, 343, 344, 348, 357, 361, 362, 366,
368, 369, 373, 376, 377, 382, 387, 395, 396 and 400. Each ID was captured
before and after with `scripts/review-movement-source-views.mjs` on a private
non-watching dev server, and each changed ID was screened with
`scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

## Per movement

| ID | Change | Worst solid overlap before → after | Remaining |
|---|---|---|---|
| 333 | Pivots O and R are now small half-round lugs on a ground line with diagonal hatching below, as Brown draws them. The pedestal blocks and slab feet are gone. | none → none | Brown's beam is steeper than the official stroke allows. |
| 339 | The cylinder cover is a thin flange (radius 5.9, thickness 1.0; was 6.2 and 1.3). The camera is level with a 12° field, so the cover no longer opens into a heavy ellipse. The fit bounds keep the crank's top reach in frame. | none → none | The cylinder is cropped at the foot, as in the plate. |
| 342 | The crosshead block hangs from the chain eye (centre moved from −0.85s to −0.45s) and clears the rim with the rod showing, as drawn. | 0.0000 seated chain eye → same | Only the beam's cylinder end is modelled; the chain path is scripted. |
| 343 | The four flywheel arms are tapered bands swept along a bowed centreline, not straight bars. | none → none | Crank radius kept at 3.5 against the plate's ≈4.4. |
| 344 | The plate replaces the official canvas where they conflict. Crank 2.25 → 1.7. Bore end 2.5 → 1.95. Shell end 2.875 → 2.325. The glands are 0.55 lower. The camera is a level elevation with a 12° field. The official constants are still recorded as source data. | none → none | The closed cylinder hides the piston. |
| 348 | No change. With the guide fixed 25/20 units above the slots, rod B leans ≈5.7° at Brown's 29° slot pose. A 1.5° lean would need a guide ≈80 units away, which breaks the official law. | none → none | The lean stays. The maxNdc of 2.13 is the deliberate crop of the broken-off rod B. |
| 357 | Lever N, rods P and C, the swivel, valve rod D and the Cardan pins now have real bores and clearances. Rods C are bowed plates. The casing is a broad bell with a pointed peak, concave flanks and flared lip horns. Wheel A leans up-right: B droops ≈10° at the plate pose. | 0.159 → none solid (spring-L coil ends seated in their eyes, 0.043/0.027) | The casing is somewhat taller than Brown's. Frame H is a cage of arms. The tilt is prescribed. |
| 361 | The spool is now two narrow collars (0.12 thick, radius 0.40, 0.30 apart), and the lever strap drops between them. The stud bracket is removed: the lever stud is seated in the right upright's face, and the eye sits at the upright's edge as drawn. The fork prong rides 0.30 below the shaft so it clears the hub. | none → none | Brown's uprights stand in front of the shafts; ours are behind, with bearing blocks. |
| 362 | The drums have Brown's proportions: upper radius 0.84 → 1.29, lower 0.76 → 1.14. The shafts are 1.40 apart, and the base is lowered to the plate's 2.94 below the upper shaft. The lower shaft starts at the middle post. The groove depth in `cord-traverse-working-parts.js` (the 362 branch only) now follows the barrel radius. | none → none | The oblique groove reads faintly in flat light. |
| 366 | Both bevels are cut in section on the plane of their axes. The near halves of the gear bodies and teeth are clipped (`localClippingEnabled`). A flat hatched section face, drawn as an ink overlay, closes each cut. | none → none solid (the overlays screen only as fluid/trace) | The section is the full meridian profile. Brown's is a thinner L-shaped rim. |
| 368 | The frame crops at the rack above the bevels and keeps the marking point's lowest start in view (`cameraFitCropsSource`), so the cylinder fills the lower half. `docs/validation/368-372-contact-solids.json` was regenerated with `POSES=33`; only the source hash changed. | 0.0008 seated marker/line → same | The spiral line runs round the back half in the mirrored view. |
| 369 | The cheek band is thinned from 0.18 to 0.11, to Brown's line weight. | 0.0259 (adjacent segments of the one cord) → same | The cheeks are exact cycloids: they drop ≈0.48L at the 0.69L reach where Brown draws ≈0.44L. This is an isochronism limit. |
| 373 | The four fixed loads are angular stones on the bed, with two more packed between them. The added test load is a heap of three stones. | none → none | The centre of the heap is empty at t=0, when no load is added. |
| 376 | The hooves are held 0.003 above the tread circle: the body bobs −0.023…+0.050. The hips, knees and tail are re-seated. | 0.057 → none | The gait is prescribed. |
| 377 | The figure's joints are layered side by side. He climbs lower on the descending side (touchdown 30°), so his legs clear the boards. | 0.151 → none | He is larger than Brown's and his rail sits above the drum top. The camera stays between Brown's gear end view and the drum's side view. |
| 382 | The foot is a thin rim with a concave flared cone and a fillet ring, not stepped discs. The camera uses a 14° field so the foot reads in profile. | none → none | none new |
| 387 | Brown's second figure is added as a display copy 5.6 below the first and half a tide out of phase: level at high water above, inclined at low water below. The white indices are hidden in the factory, which replaces the old `remove` entry. | fluid only → same | The stored display-profile motion bounds for 387 describe one figure and need remeasuring. |
| 395 | The body is a thin dark ring, open at the four port mouths, and the plug face is light. Both figures read as Brown's outlines. | none → none | The second figure is a display copy. |
| 396 | No change. The penetration comes from the fork geometry, not from lag on one beat. It happens on both beats: ≈0.05 on the first, and 0.071 (screen) to 0.11 (fine 2D sampling) on the second. While the pin is in the fork, it can throw the lever at most ≈3.6°, but the pallets need a 5° throw. No quintic timing (delay 0–0.208, start 0.30–0.36, duration 0.30–0.36) clears the prongs, and a zero delay makes the rebake fail with recoil. | 0.071 → 0.071 | A fix needs a new pin radius, fork length and lever throw, plus a rebake. |
| 400 | No change. | none → none | The cam still carries the 0.68 feed stroke axially. The plate draws C as a small wedge under B near the right end. |

## Proposed ledger text

- **333:** (a) Pivots are small lugs on hatched ground lines. (b) Sampled-clear. (c) Brown's beam is steeper than the official stroke allows. Legacy beam/crosshead interfaces are partly approximate.
- **339:** (a) The cover is a thin flange seen in a level narrow-field elevation. (b) Sampled-clear. (c) The approximate straightness and inferred dimensions are not an exact historical reproduction. Steam loads, joint play and friction are unsolved.
- **342:** (a) The crosshead block hangs from the chain eye and clears the rim as drawn. (b) Sampled-clear; the chain eye is seated. (c) Only the beam's cylinder end is modelled; the chain follows a scripted path. Pressure, chain tension, friction and passive load response are unvalidated.
- **343:** (a) The flywheel arms bow as drawn. (b) Sampled-clear. (c) The crank radius is kept at 3.5 against the plate's ≈4.4.
- **344:** (a) The crank (1.7) and the short barrel follow the plate; the official 2.25 crank is recorded as source data. The view is a flat narrow-field elevation. (b) Sampled-clear. (c) The cylinder is closed, so the piston is hidden. Steam forces and bearing loads are unvalidated.
- **348:** (b) Sampled-clear. (c) Rod B leans ≈5.7° at Brown's 29° slot pose, where the plate's is near vertical. The lean follows from the official 25/20 guide law; a ≈1.5° lean would need a guide ≈80 units away.
- **357:** (a) Broad bell casing with a pointed peak and flared lip; wheel A leans up-right; rods C bow. (b) Sampled-clear, except the spring-L ends seated in their eyes. (c) The casing is taller than Brown's. Frame H is a cage of arms. The tilt is a prescribed quasi-static balance.
- **361:** (a) Two narrow collars straddle the lever strap. The stud is seated in the upright; there is no bracket. (b) Sampled-clear. (c) Brown's uprights stand in front of the shafts; ours are behind, with bearing blocks.
- **362:** (a) Tall drums at Brown's proportions. (b) Sampled-clear. (c) Follower preload and backlash are prescribed.
- **366:** (a) The bevels are cut and hatched in section. (b) Sampled-clear; the section overlays are drawings. (c) The section shows the full meridian profile, where Brown's is a thinner L-shaped rim.
- **368:** (a) Cropped like the plate, so the cylinder fills the lower half. (b) Sampled-clear; the marker is seated on its line. (c) The spiral line lies on the far side in the mirrored view. The bevels use approximate back-cone flanks.
- **369:** (a) Thin cheek bands. (b) Unchanged. (c) The exact cycloid cheeks drop ≈10% more than Brown's at the same reach. The bob is a point-mass approximation.
- **373:** (a) Heaped angular stones. (b) Sampled-clear. (c) The empirical load law is illustrative.
- **376:** (a) The hooves stand on the tread ring and the body bobs with the gait. (b) Sampled-clear. (c) The gait is prescribed; hoof loads and slip are unqualified.
- **377:** (a) He climbs the descending side with a raised knee. (b) Sampled-clear. (c) He is larger than Brown's, his rail sits above the drum top, and his legs are offset sideways. The gait is prescribed.
- **382:** (a) A flared cone foot. (b) Sampled-clear. (c) Thread friction and clamp preload are unsolved.
- **387:** (a) Both figures are shown: high water above, low water below. (b) Sampled-clear, apart from the intended fluid overlaps. (c) The second figure is a display copy. Latch action and buoyancy are not solved.
- **395:** (a) Outline sections: a thin bore ring and a light plug face. (b) Sampled-clear. (c) The second figure is a display copy. Valve rotation is prescribed.
- **396:** (b) Known: the pin/prong overlap is 0.071 on both beats. The fork geometry can throw the lever only ≈3.6° against the 5° pallet throw, so it needs a pin/fork/throw redesign and a rebake. (c) F still receives work instead of acting strictly as a detent.
- **400:** unchanged.

## Files

Production:

- `authored-marine-parallel-motions.js` (the 333 pivot helper)
- `authored-direct-action-parallel-motions.js` (the 339 function)
- `authored-atmospheric-beam-engines.js`
- `authored-upright-engine-parallel-motions.js`
- `authored-oscillating-engines.js` (the 344 function)
- `authored-anderson-governors.js`
- `governor-274-357-parts.js` (the 357-only functions)
- `authored-axial-pin-clutches.js`
- `authored-grooved-cylinder-traverses.js`
- `cord-traverse-working-parts.js` (the 362 branch)
- `authored-treadle-drills.js`
- `authored-cylinder-spiral-scribers.js`
- `authored-cycloidal-pendulums.js`
- `authored-rolling-friction-experiments.js`
- `authored-animal-treadwheels.js`
- `authored-person-treadmills.js`
- `treadmill-gait.js` (377 only)
- `authored-adjustable-stands.js`
- `authored-tide-ladders.js`
- `four-way-cock-parts.js` (395 only)
- the 387 entry of `src/data/source-presentation.js`

Tests and reports:

- `tests/movement-344.test.mjs`
- `tests/movement-357.test.mjs`
- `tests/movement-376.test.mjs`
- `docs/validation/368-372-contact-solids.json`
