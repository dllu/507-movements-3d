# Pass 55: rope, chain and rod ends at the plate crop (lane p55-ends)

Reviewer: Claude Opus 5.5 (lane p55-ends), 2026-09-25.

Theme: ropes, chains and rods that stopped in mid-air at Brown's old crop
line or break notch, and rope style. Every end now reaches a real attachment
(hand, weight, drum/reel, sheave, pipe, cylinder, guide, pin or bracket)
placed just beyond the plate's view; the default cameras still frame Brown's
crop (fit boxes exclude the new parts, flagged `userData.beyondPlateCrop`
where a fit or test sweeps the whole scene). Captures: default, mid-phase,
2.6x zoom-out, rotated +60, back, top and zoomed oblique for every ID, before
in `/dev/shm/l3/before`, after in `/dev/shm/l3/after` (scratch, not committed).

Shared helpers added:
- `src/simulation/hauling-hand.js`: plate 12's hauling hand (moved out of
  `authored-belts.js`, now with optional arm direction and rope-tail shape).
- `src/simulation/beyond-crop-hardware.js`: `pinWallBracket` (a fixed pin's
  shank run back to a small flange) and `glandCylinder` (a closed cylinder a
  rod enters through a gland).
- `addTackleHaulingHand` and `addChainNavelPipes` in `authored-belts.js`.
- `fitPistonGuide` (piston-guide-parts.js) now skips `beyondPlateCrop` parts.

## Rope ends

| ID | Change | Residual |
|---|---|---|
| 14-22 | One wrapper lengthens each tackle's hauling fall (same rope, same lay) until even its highest grip lies 0.45 below the frame, and hangs plate 12's hand on it (0.8 scale). The effort attachment is the hand. Camera keeps the pre-hand swept box. Consistent across the family. | 14 and 18 hauling legs run diagonally off the plate before the hand; hand only visible on zoom-out. |
| 86 | Pump output rod lengthened to stay in a new closed pump barrel (gland, barrel, foot) hanging below the lower bed; candidate lib mirrored, profile motion bound extended. | Pump internals still not modelled (barrel is a closed shell). |
| 126 (MuJoCo) | New `mujoco-bell-crank/ends.js`: input fall continues below the frame to a hauling hand that follows the native cord end; output cord continues over a strap-hung guide sheave (turns with the cord) down to the load weight. Visual only; native physics unchanged. | The native model's output load remains an ideal force; the drawn weight is its visual stand-in. |
| 134 | Both free spans run on to storage reels just outside the plate (pay-out left, take-up right) with coiled laid rope; reels turn with the rope, lay continuous. | Coil quantity does not change as rope is transferred. |
| 253 | Hoist rope becomes one endless laid loop round a matching return sheave on a bearing standard below the crop; sheave turns with the drum. | None visible. |
| 247 | Undrawn gold wire sling removed. Reload now a plain laid-rope basket sling passing under the ball behind the rod, a hook, and a laid fall up to a hauling hand above the plate; appears only during the reload phase. | The reload itself remains a non-Brown addition needed for looping. |
| 420 | Pull cord lengthened below the plank to a ringer's hand. | None. |
| 491 | Hauled cable continues past the crop, turns down over a bend into a deck pipe on the deck line (lay advances with the haul). | None. |
| 492 | Tackle fall (rising with the hook) runs up to a hand; release rope continues along its end tangent to a pulling hand (second-unit copies removed with unit 2). | None. |

## Rope style

| ID | Change | Residual |
|---|---|---|
| 352, 358 | `retainTraverseCord` now builds the shared laid rope (was a smooth tube); 358 cords thickened to 0.03 (fits the fusee groove floor). | 358: the band anchors sit ±21.5 along the traverse (stroke 28) so they appear only at about 6x zoom-out; the thin cord still reads light next to Brown's heavy rope. |
| 473 | Suspension and pull ropes thickened to 0.045/0.05 laid rope (still pass the lug eyes). | Translucency/hoop findings belong to other lanes. |
| 490 | Tiller rope 0.025 to 0.042 laid rope; guide posts and wheel pedestals now run down to foot plates on the (undrawn) deck. Rope-disjointness test gains a narrow-phase centreline check (closest turns 0.097 apart, diameter 0.084). | Rope still rides the barrel flange as noted in the ledger. |
| 373 | Belt now a true flat band 0.16 x 0.03 in a widened flat channel; the remote driving pulley is keyed on a line shaft carried by a hanger from a ceiling beam beyond the crop. | None. |
| 407 | Cord laid rope radius 0.04; the working run starts at the pin loop and the take-up winds on the pin loop (loop rotates, lay travels), so the cord no longer stretches; bend law never releases below 0.4 so the lath stays clear of the jamb post. | The bar's minimum bend is a presentation limit, not Brown's. |
| 261 | Not changed. | Cord D still winds on the drum behind B. Moving the drum to B's front face (as drawn) puts the cord plane between B and link C's crank pin, which must cross it at the pin radius; the only clean alternative is an overhung crank arm in front, which Brown does not draw. Left for a decision. |

## Chains

227, 228, 229: each leg drops through a rectangular navel pipe (bore sized
from the swept links) in a deck plate just below the plate's view; links
leave view inside the pipes. 228's legs gained three tail sections each
(27 sections; tests updated), 229's leg cut planes moved inside the pipes.
Residual: 229's inclined legs now run visibly off the plate's lower corners
before the pipes, as Brown's legs do.

## Rods and parts at the crop or a break notch

| ID | Change |
|---|---|
| 78 | Swallowtail notch on lever B replaced by a rounded end. |
| 92 (MuJoCo) | Guide bars run 0.6 past the break and are closed by an end bar; stroke limits unchanged. |
| 156 | Notched rod made whole to its eye on the guided crosshead; the guide rails, crosshead and base (previously removed by source presentation) are shown; view fits the drawn rod length. |
| 166 | Zigzag break removed; rod runs whole to a pinned brick mould sliding between guides on a bed below/right of the plate. |
| 168, 169 | Power rocker made whole to a fulcrum pin and bearing block beyond the plate. Crank-shaft bearings not added (hidden behind the cranks; left). |
| 178 | Rod made whole to its eye on the tool slide, whose guide rails and end stops are shown beyond the drawing. Fixed disk support not added. |
| 251 | Guide rails continue below the crop to foot blocks; pile and anvil shown (below the crop). |
| 252 | Slot C rails run on to an end block; the broken standard continues down as a post carrying an arm and guide bush for D's lengthened stem. |
| 333 | P's rod runs whole into a closed cylinder below the view. |
| 335, 337, 338 | Fixed pins get shanks to small back flanges (hidden behind their bosses); piston rods run on into gland cylinders below the view. |
| 340 | F's shaft gets a rear flange; C's rod enters a fixed cylinder; D's rod (end on an arc) enters a barrel rocking on a trunnion bracket. |
| 336 | Broken diagonal frame member runs on 7 units to a bolting flange beyond the plate. |
| 142 | Tall two-post stand and base replaced by a modest bracket: rear post from the stud bearing to a short cross-arm under the rail; rebaked (`142.json.gz`, provenance, clearance report regenerated: 721 samples, no overlaps). |
| 181, 182 | Handle shafts extended back into bosses on a slim frame bar behind the gear, a stay runs back to a flange; the catch stud is tied by a short strap (in the free layer behind the catch) to the upper shaft. Added at playback (no rebake needed). Residual: the back-weight rods still end in the caption's back weights (a real attachment); the frame bar shows slightly between the handles in the default view. |

## Intersections (post-change screen, 0.01 spacing, 33 poses)

- 14-22: only the rope on its sheaves/eyes (as before) and plate 12's loose
  rope tail where it leaves the fist over the fall (0.011-0.016, the same
  rope's continuation, as on 12).
- 86: zero-depth working contacts only. 134: clear after re-centring the
  reel barrels (a first cut had 0.025 coil/flange overlap). 253: axle now
  turns with the return sheave (was 0.349 coaxial); only a zero-depth face
  bearing. 247: sling fall and basket in the hook (0.033, intended); basket
  moved 0.03 off the ball (was 0.018). 420: pull cord tied into the tail
  (0.044) and hand tail on the cord (0.014), plus the prior spring seats.
  491: clear. 492: hand fist turned onto the lead (was 0.0085); hand tail on
  the lead 0.019 (same rope). 227-229: clear. 251: anvil lowered 0.05 (the
  now-visible anvil met the weight's notches by 0.045); seated hooks only.
  252: prior 0.005 roller-flange seats only. 333, 335-338: clear. 340: the
  trunnion pin shortened to bear on its bracket face (was 0.100 coaxial);
  clear. 181: clear. 78: zero-depth hook contacts. 178: rod beam into its own
  eyes (same rigid rod). 373: clear. 490: rope ends tied into the tiller
  clamps 0.028. 352: prior hanger seat 0.0145. 473: ropes tied into the
  lever ends 0.042-0.047 and seated in the lug eyes 0.028 (thicker rope).
  407: cord on its own pin loop 0.014.
- Not screened on production: 126 and 92 (the script builds the legacy
  synchronous models; 126's new parts are visual only), 142 (legacy model;
  production clearance report regenerated, no overlaps), 156, 166, 168, 169
  (legacy authored models screened; production modules checked by their
  tests), 358 (screen aborted on memory; the cord/fusee clearance tests pass
  at the new radius).

> Integration note (lead): the beyond-crop flags on 14–22 (`beyondPlateCrop` on the hand group, `beyondPlateCropBelowY` on the rope) were added during integration; the opening-camera test skips only those parts.
