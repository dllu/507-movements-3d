# m1-belts-gears: pass-51 minor residuals (belts and core gears)

Lane scope: 12, 18, 31, 123, 192, 195, 197, 202, 208, 216, 227, 228, 229, 239, 244.
Each default and phase capture was checked beside its engraving. Captures were taken
from a private non-watching Vite server, with bulk images kept in `/dev/shm/m1`.
Intersections were screened with
`scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

## Changes

| ID | Change | Intersections (worst, before → after) |
|---|---|---|
| 12 | Brown's hand is added: a fist bored clear of the rope, with knuckles, thumb, forearm and cuff from the lower left, plus a loose tail drooping below the fist. The hand and tail move with the rope end. The effort leg is shortened to where Brown holds it, 2.55 → 2.2. | 0.0042 → 0.0042. The only pair is the rope tied into the bag neck, which is intended. |
| 18 | The sheaves now shrink from top to bottom as engraved: 0.48 : 0.35 : 0.335. The right strand leans on the true common tangent. The ground is hidden. | 0.0020 → 0.0021, all rope-on-sheave or becket contact. |
| 31 | Brown's worm has three thin ribs on a thick core, not deep fins. The rib crest width is 0.07, the core radius 0.15 and the crest radius 0.25, and the loaded flank still lies on the hob line that cut the baked wheel. There are three turns, with plain sleeve collars at the ends. The generated wheel tips are trimmed to r = 1.287, removing material only, so they clear the core. `thin-rib-worm-geometry.js` gains optional core and crest radii. | historical sampled-clear → clear |
| 123 | The baked loader no longer crops the rack to its source-pose length. The camera fits the full recorded sweep as a box, with maxNdc 0.94. | geometry unchanged |
| 192 | The disc is widened from 236 to 270 source px, and the camera lens narrowed to 16°. Together they keep the working pinion on the face throughout the rim run. | clear → clear |
| 202 | The wheel has 48 teeth, not 60; a ring count of the engraving gives 44–50. This gives about 24% deeper generated teeth. The offline wheel envelope is regenerated; the 264 entries are byte-identical. There are now 9–10 simultaneous contacts. | clear → clear |
| 208 | The camera lens is narrowed from 10° to 5° so the off-centre pinion reads edge-on, with its slots as dark bars. | unchanged (known 0.0535) |
| 227 | The cross links gain flat radial side straps, so every link reads as a plate. | clear → clear |
| 228 | The wedges are small pointed tents on a thicker rim. | clear → clear |
| 229 | Both legs are cut by fixed clipping planes at Brown's leg ends, so links slide out continuously instead of jumping. | clear → clear |
| 239 | The world-space break line is now ragged: a slow wave plus three straight triangle-wave zigzags. The break material is FrontSide. | shader only |
| 244 | Brown's hatched shaft section A turns with the drum, so the rotation is visible. | unchanged (intended drum/shoe contact) |

195, 197 and 216 are unchanged. The remaining differences are forced:

- **195:** The worm lies across the face and generates slanted, curved tooth spaces. A radial rectangular slot that contained that envelope would span about 77% of the pitch and leave thin ribs, and the outer annulus is a full worm-core trench.
- **197:** The frame travels about 0.8 of its own width each way. Keeping that whole travel in view, as the framing rule requires, leaves the frame about half the width of a square view. The bounds already match the swept silhouette.
- **216:** Brown shows 180° of internal teeth and 180° of external teeth. At each hand-off both sectors would then engage the pinion at once, in opposite senses. The ring keeps 22 of 24 teeth (165°).

- **208, residual:** Brown's broad lantern strip, with its slots closed at the sides, needs a web thicker than the 0.164 pin diameter plus its walls. That web would strike the neighbouring pin rings off the centre line.

## Validation regenerated

These reports fingerprint `authored-gears-core.js` or the special-worm files. All were rerun and all pass:

- `200-226-bevel-solids`: POSES=33, no penetrations.
- `202-264-worm-solids`: POSES=33, no penetrations. The 202 maximum closest gap is 0.00236.
- `191-196-201-contact`: `.mjs`, then `.py`, no overlap.
- `205-208-209-contact`: export, review, pin slots, then save. No overlap, and no pin inside a slot.

The `feed-worm-195/207` reports hash function scope only and are still current.

## Integration note

192's display profile (`src/data/display-profiles.json` `motionBounds`) predates the wider disc. Because 192 has source-presentation removals, the engine intersects its authored fit box with that stale profile box, which crops the disc. The full `camera-catalog` test fails on 192 until `measure-display-profiles.mjs` is rerun. A copy of the test run against freshly measured bounds passes.
