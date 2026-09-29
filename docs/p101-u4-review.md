# Pass 101, lane p101-u4: user review of 358, 370 and 391

Scratch captures are in `/dev/shm/p101/u4/`. Plates: `public/engravings/mm_<id>.png`.

## 358: the fusee is now a straight cone

**User.** "The fusee seems to be more of a linear cone than this curved taper."

**Plate check.** Brown's outline is straight from the large-end flange (174 px across) to the last groove before the small collar (about 52 px across, 0.30 of the large end). About nine rope turns lie on it. The p99 body followed Sureda's ten travel observations (112 … 30), which made a concave taper.

**Fix** (`src/simulation/authored-fusee-traverses.js`):
- The pitch radius now falls linearly with the groove turn, from 0.86 to 0.23. The end ratio is 0.27; Sureda's 30/112 and Brown's 0.30 agree with it.
- The payout is the integral of the radius, so the stroke is π·10·(0.86 + 0.23) ≈ 34.24. It was 28.
- The crank cruise is unchanged (10 turns in 10.1 s). The carriage speed now falls linearly along the stroke.
- The body role is now `straight-conical-fusee-body`. The historical record keeps Sureda's observations; only their end ratio is used.
- The cut groove (`cord-traverse-working-parts.js`, 358 branch) follows the new profile. Its floor looks ahead 0.05 down the cone. At the small end that lookahead was clamped to the end radius, which left the cord 0.002 into the floor, so the floor now continues along the straight cone past the end.

**Captures.**
- `a358-sheet.png`: default, yaw +40/pitch +20, yaw −40/pitch −25, and a close-up.
- `fin358.png`: the plate, default, rotated and side views.
- Before: `b358-0.png` and `b358-1.png`.
- Framing is unchanged, because the camera fit is the carriage box.

**Tests.**
- `movement-358`: 10/10. The profile test is rewritten to assert a straight cone: the radius is linear at every turn, the stroke equals the mean circumference times the turns, and the rendered land radii lie 0.004 outside the pitch line along one straight line.
- `cord-traverse-working-solids`: 10/10. Both cords clear the cut fusee and each other over the full traverse.

**Screens.**
- Loop seams: 0.
- Disconnected parts: no detached parts.
- Coincident faces: 4 tiny flagged pairs (area 3.5e-6 relative). All are the shaft inside the bored crank-end bearing blocks, which have a 0.004 bore clearance. HEAD already had 2 of these pairs, and the count only varies with phase sampling. They are hidden inside the bores.
- Body intersections: the screen runs out of memory on 358 both at HEAD and now, even with a 12 GB heap. This is a limit of the tool; the cord-and-fusee solids test above covers the moving contacts instead.

## 370: Brown's S-shaped rod in one plane replaces the telescoping follower

**User.** "370 is generally sus since we have a telescoping rod and we gratuitously use depth dimension but the engraving shows a more S-shaped thing to clear the ratchet-wheel while being on the same plane."

**Plate check.**
- Brown dashes a double-line rod behind the bar. Its top runs up under the rail toward the bar's top eye.
- The rod passes a dashed box on the bar at about 0.65 of the way to the ratchet. Below that it bends left out of the bar's edge over the top of the ratchet and curls down into a hook on the left-hand teeth.
- The ratchet and mirror are dashed behind the bar.

**Why the eccentric is on the crankpin.** The caption says "an eccentric on the crank-shaft". But the bar sweeps right across the shaft's axis: the axis comes within 0 to 0.71 of the bar's centreline, and the bar's half-width is 0.29. So nothing on the shaft itself can reach the plane behind the bar. The eccentric is therefore keyed on the rear end of the crankpin, which runs through the bar's eye. It is rigid with the crank, so it is still an eccentric on the crankshaft. Relative to the bar its centre circles the eye at the throw, and Brown's rod does rise toward the eye.

**New mechanism** (`src/simulation/mirror-s-link-click.js`, new; `authored-mirror-polishers.js`; the 370-only `correctMirrorPolisher` in `polishing-joint-parts.js`):
- **One plane.** The ratchet, the S-link and the eccentric share one plane, z −0.37 to −0.25, behind the lower rail. The mirror sits directly behind at −0.48 to −0.40. The old stack had a carrier, a pin stem through the rail's depth and a follower in front of the bar. All of that is gone: the telescoping follower, the front eccentric and strap, the click carrier, the pawl plate and its stem.
- **The S-link.** Strap, rod and hook are one plate:
  - a strap on a solid sheave (throw 0.15, radius 0.32, clearance 0.005);
  - a straight run down the bar;
  - a radius-0.2 bend left over the wheel, and a level crossing 0.76 above the axis;
  - a radius-0.27 curl back down;
  - a 0.16 stem entering the tooth valley along its bisector, ending in a round tip of radius 0.05.

  A round tip seats in the valley whatever the rod's angle. This matters because the wheel turns 30° under the hook during each drive while the rod hardly rotates.
- **Keeper.** Brown's dashed box is a loose U-staple on the bar's back. It is sized from the rod's computed sweep (at y −1.62 the rod sweeps x −0.09 to 0.24; the inner span is x −0.11 to 0.26, a 0.02 gap each side). It holds the rod in its plane and bounds its swing, and it never touches the rod.
- **Motion.** The contact is solved geometrically on the actual outlines (`simulateSLinkDrive`):
  - The rod hangs from the strap and its weight holds the hook against the teeth.
  - While the strap descends, the tip slides down the flank into the root and then drives the face: the wheel turns anticlockwise one tooth. This is 35% of the turn; the drive begins 0.19 turn after the top of the strap's circle, once the backlash is taken up.
  - While the strap rises, the wheel dwells and the tip rides up the flank, passes the tip and drops back onto the next flank at a finite rate.
  - Two turns are marched and the steady turn is the playback table: 720 samples, periodic to 1e-15, exactly one pitch per turn. The build takes about 0.26 s in Node.
- **Crank direction.** Brown marks no direction, so the crank now turns clockwise in the plate. That puts the strap on the bar's right-hand side when it descends, as Brown draws the rod down the bar's right half, and the hook pushes the left-hand teeth down as before.
- **See-through bar.** The bar and its eye are see-through in the shared style, because Brown dashes the rod, the keeper and the ratchet behind them. The bar's eye hole now matches the eye boss (r 0.17), which removed a same-facing coincident bore seam.

**Captures.**
- `a370-sheetA.png`: phases 0, 0.3, 0.6 and 0.85.
- `a370-sheetB.png`: yaw +40/+20, yaw −40/−25, side view and back view.
- `m370-sheet.png`: 13 phases following the hook with the bar hidden.
- `fin370.png`: the plate, default, rotated and side views.
- Before: `b370-0/1/2.png`.

**Tests.**
- `movement-370`: 9/9. The tests are rewritten for the S-link:
  - one plane for the ratchet, link and eccentric, behind the rail;
  - the strap is concentric with the rendered sheave;
  - one tooth per turn, and the wheel never runs back;
  - only the hook turns the wheel, mostly while the strap descends;
  - every table pose is overlap-free, and the tip is seated whenever it drives;
  - the crank turns clockwise.
- `polishing-interfaces`: 4/4. The 370 pairs are now the S-link against the ratchet, the mirror, the sheave, the keeper, the axle, the lower rail and the pins, plus the keeper and sheave against the bar and rail. The exact polygon overlap of hook and ratchet is below 1e-10. The smallest gap is 0.0015 and the largest resting gap 0.004; the hook is off the teeth in 0 of 64 poses (the test allows 2, for its fall).
- The 393 blocks are unchanged.

**Screens.**
- Loop seams: 0.
- Coincident faces: 0.
- Disconnected parts: only the pre-existing near-miss of the fixed lower rail group, which Brown crops.
- Body intersections: worst solid 0.0000. The ledger's pass-49 0.1189 crankshaft × bar is no longer reported.

**Residual.** The mirror still sits higher on the bar than Brown's (0.59 of the bar against 0.73). This is the p99 depth argument, unchanged.

## 391: half-turn-symmetric grooves (top outer corners rounded)

**User.** "The engraving shows that each of the two grooves is more rotationally symmetric, i.e. the top outer corners should be more rounded to match the bottom inner ones."

**Before.**
- The top outer corner was a radius-2.5 corner arc and then a tight radius-0.447 fillet into the outer branch. It fell 0.54.
- The bottom inner corner was one radius-1.19 arc. It rose 1.12.

**Constraint found.** The top corner is where A swings into mesh at the top dead centre. It must follow the rack's own swing (8.3°) over the last part of the swing, or the entering teeth sweep the pinion while it is still being driven the other way.

I tried exact half-turn congruence (the lower arc rotated to the top: radius 1.19, leaving the corner at 20°). Its teeth interfere by 0.055–0.058. Steeper top corner angles fail the same way: 12° gives −0.003 and 16° gives −0.036. The foot of the groove has the opposite need: it must leave at 18° or more, or the piston would have to reverse there.

**Fix** (`src/simulation/authored-alternating-weighted-racks.js`, `guideArcs`):
- Both corners are now the same curve, a radius-3.33 corner arc followed by a radius-0.745 fillet, tangent to the far branch.
- The top corner is Brown's rounded outer corner; its fillet grew from 0.447 to 0.745. The bottom corner is the same curve turned a half turn.
- The two curves now fall 0.76 and rise 0.83 (before, 0.54 and 1.12).
- Only the angle at each sharp corner differs, and that difference is forced: the top leaves along the swing (8.3°) and the foot at 20°.
- 0.745 is the largest fillet that keeps the tooth clearance, found by a parameter sweep:

  | Fillet | Top swing | Clearance |
  |---|---|---|
  | 0.745 | 0.04 | 0.00091 (unchanged) |
  | 0.763 | 0.04 | 0.00059 |
  | 0.78 | 0.035 | −0.004 |

**Captures.**
- `g391-cmp.png`: left and right grooves, before and after, with the racks hidden.
- `a391-sheet.png`: the plate, before, and after at 4 phases plus rotated views.
- `fin391.png`.

**Tests.**
- `movement-391`: 10/10. The groove test now also asserts one fillet radius and one corner-arc radius at both corners, tangency at the lower switch point, a fillet larger than 0.74, and corner extents within 0.1.
- `weighted-rack-selector-contact`, `weighted-rack-handoff-solids` and `alternating-drive-solids`: all pass. The minimum finite rack/pinion clearance is still 0.00091, and the guide-pin clearance still exceeds 0.007.

**Screens.**
- Loop seams: 0.
- Coincident faces: 0.
- Disconnected parts: 2 floating groups, both pre-existing and unchanged: lever C's free-standing pivot (p79) and the coasting pinion in the no-mesh interval.
- Body intersections: worst 0.0175, the spring-d standoff against the spring, which is untouched.

## Wider tests

These all pass:
- the `models.test.mjs` blocks that loop over every movement (construct, timing, distinct layout, selector belts);
- `camera-resize` (including the 358 zoom-out);
- `movement-371`, `authored-loader` and `fusee`.

## Reports and bakes

No saved validation report, bake or `.json.gz` fingerprints any of the files changed here. The routes are unchanged, because the same IDs map to the same factories.
