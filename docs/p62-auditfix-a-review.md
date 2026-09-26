# Pass 62 — audit fix lane A (undrawn supports, weights, ropes)

Scope: 181, 182, 183, 184, 251, 272, 354, 358, 373, 393, 400, 421, 490, 492, from the
pass-62 audit (`/dev/shm/audit62/b/findings.json`). Each fix was checked against
`public/engravings/mm_NNN.png`. Captures (8 views: def 0/33/66/98 %, ±60° about
vertical, back, top) are in `/dev/shm/p62-auditfix-a/{before,after}/tile-NNN.png`.
Rule applied: remove what Brown does not draw unless truly needed; a kept support is
minimal; fixed axes and slides that lose an undrawn support become ideal constraints.

| ID | Change | Where |
| --- | --- | --- |
| 181, 182 | The three cast back-weights hanging on the rod ends are not presented; the rods run straight past the plate and end cleanly. The weights stay as loads in the baked MuJoCo solve (baked bundle unchanged, no rebake needed). | `source-presentation.js` `remove` |
| 183, 184 | The black block weights are no longer built. Each back-weight rod is long enough to end below the view in every pose (length now from the eye's highest point, not the plate pose), so no rod end or weight rises into the frame. | `authored-quadrant-catches.js` |
| 251 | The top beam is one continuous timber: slot B is cut through its front part only, and a continuous back (z −0.9…−0.74) runs behind the slot, the rope and the horns (as the plate's unbroken top and bottom edges show). The winding drum, sheave, cheeks, axles and shelves are removed; the laid rope runs straight up out of the picture (excluded from the camera fit), with its lay fixed at the eye, and its end is seized on the top of the eye (0.01 world overlap, no gap). The pliers, T-head and slot-B mechanism are unchanged. | `authored-pile-drivers.js` |
| 272 | Base bar, bearing posts, shaft bearings, backing rail, brackets and riser are removed; only Brown's two rod guides and the bare shaft remain. The fit box no longer reaches down to the base. | `authored-beveled-cams.js` |
| 354 | Rear frame rails, guide brackets, the input-shaft bearing and its brackets are removed; only the two guide blocks remain. | `authored-uniform-groove-crossheads.js` |
| 358 | The anchor posts, foot plates and brass eyes are removed; the fixed band ends are ideal points far beyond the crop. The band is a laid rope of radius 0.032 (was 0.018; plate about 0.049). The two cords sit ±0.034 off the groove centre, and the groove's flat floor is widened to ±0.068 so that both clear. | `authored-fusee-traverses.js`, 358 branch of `cord-traverse-working-parts.js` |
| 373 | The remote driving pulley, its shaft, floor standard, bearing and foot, and the return run are removed. Both belt strands run straight on 2.6 past the crop and end square. | `authored-rolling-friction-experiments.js` |
| 393 | The p57 bearing arm and table pillar are not built. The dark "shaft through the lens" in the back view was this pillar, so that intersection is gone as well. | `correctLensPolisher` in `polishing-joint-parts.js` |
| 400 | The back bar, the two C-guides round A and the spring-stop strap (the "guide bar with three blocks") are not presented. A's slide and the drawn spring stop are ideal fixed constraints. | `source-presentation.js` `remove` |
| 421 | The crankshaft bearing boss and its standard on the cylinder head are no longer added. The crank turns on its bare shaft. | 421 `prepare` in `cutaway-presentations.js` |
| 490 | The deck, the sheave posts, the handwheel pedestals and all feet are removed. Each guide sheave gets Brown's drawn short flat bracket, broken off: upper up-right at 53.5°, lower down-right at −45°, 1.1 long and 0.36 wide, rounded at the axle, grey. The two drawn shaft bearings stay. The fit box takes in the brackets. | `authored-rope-steering.js` |
| 492 | The hauling hand and its rope tail at the top of the tackle fall, and the lead sheave, stanchion, foot, hanging tail and toggle of the release rope, are not presented. Both ropes run straight past the crop and end cleanly. | `source-presentation.js` `remove` |

## Intersections (after; `show-body-intersections`)

- 181, 182, 272, 373, 393, 400, 421: no pairs.
- 183, 184: only the existing 0.0005 stud/lip and 0.0001 boss/stud contacts.
- 354: shaft/crosshead contact at 0.0000.
- 251 (spacing 0.02): 0.027 at the rope end seized on the eye (intended), plus the existing 0.0000 jaw/T-head contact.
- 490 (spacing 0.02, 17 samples; 129 samples runs out of heap): only the existing rope-end clamp on the tiller, at 0.0275.
- 492: only the existing contacts.
- 358: the voxel screen runs out of heap (28-unit track). A direct surface check over 25 poses finds 0 cord penetration into the fusee body and 0 between the two cords.

Before-change intersections were not measured in this lane, and the audit's `isect.txt` has no rows for these IDs.

## Residuals

- 358: the band is still about 2/3 of the plate's thickness, limited by the groove pitch with two cords side by side. The plate's horizontal rail lines are still not drawn (earlier decision).
- 354: the view is still from the crosshead side, while Brown views from the disk side (earlier decision).
- 492: the release rope keeps a slight quadratic curve from the lever eye; the plate draws it nearly straight.
- 251: the rope end is seized onto the top of the eye rather than spliced through it.
