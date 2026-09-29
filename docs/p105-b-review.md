# Pass 105, lane b: 403 traced arc

Reviewer: Claude Opus 5.5, lane p105-b, 2026-09-29, from HEAD e436920. No git writes.
Claimed files: `src/simulation/authored-cyclographs.js` and `src/data/source-presentation.js` (only the 403 entry changed).
Captures are in `/dev/shm/p105/b/`:
- `cmp-403.png`: before | after | plate, in the default view
- `tile-403.png`: after beside the plate
- `after-phases.png`: nine phases
- `after-views.png`: yaw ±40 / pitch ±25, side, both stroke ends, apex close-up
- `wipe.png`: the wipe, an underside view, and the pencil laying ink
- `official.png`: the site's 2D animation

## Finding: the rules were on the wrong side of their pin lines

The audits said the arc hides under the rules at the apex pose, and that Brown's rules are about 0.24 wide.

**The width claim is wrong.** Measured perpendicular to the rules at four stations each, the edge-to-edge width is 18–21 px. The pin-to-pin chord is about 340 px.
- In model units that is 0.30–0.33 wide, not 0.24.
- As a fraction of rule length it is about 0.055, which is what pass 90 used.
- The model rules are 0.40 wide, and the width was kept.

**The real cause is placement.**
- On the plate (see the 3x crop):
  - The arc ends meet each rule's *outer* edge.
  - The thin chord line shows between the rules and runs *under* them to the arc ends (Brown's dashes).
  - The arc's crown passes behind the X, and the pencil point is at the top vertex of the crossing: "pencil in the angle of the crossing edges", the V between the two tails.
- So each rule lies *inside* the angle, on the chord side of its pin-to-pencil line, and the whole bulge of the arc is open paper.
- The site's 2D animation (`official.png`) uses the same arrangement.
- Our rules lay *outside* the angle and covered the bulge: the bulge is 0.443 against 0.465 of rule plus pin offset. Narrowing the rules would only have treated the symptom.

## Changes (authored-cyclographs.js)

1. **Rules moved inside the angle.** The rule bodies, the brace fastening points and the crossing rivet are mirrored to the chord side of the working edges.
   - The pins bear on the rules' outer edges.
   - The pencil stands in the V between the tails and is still tangent to both working edges.
   - The brace now lies below the chord, as Brown draws it (it used to hide the pins).
2. **Forced stroke limit.** With the tails on the chord side, each rule's tail crosses the other rule's working edge just past the pencil.
   - As the pencil nears one pin, that pin meets the other rule's tail.
   - Both rules occupy the same height band as the pins, so no stacking lets a pin pass under a tail. A short left pin could free one side only, which would make the stroke lopsided.
   - The stroke now reverses where the far pin clears the tail by 0.02: at a distance of (w + 2r + 0.02) / sin(angle) = 0.629 from the pencil along the edge. It used to be 0.176.
   - The traced arc covers 1.737 of the 2.130 rad between the pins (81.5%).
3. **Ink ribbon.** The arc is now a flat 0.05-wide ribbon lying 0.0015 above the board, with a polygon offset. It replaces the static round tube.
   - The pencil's right-to-left stroke lays the ink down behind the point, and the ink always ends exactly under the pencil.
   - The left-to-right stroke retraces it.
   - It is wiped (opacity 1 to 0) over cycle phase 0.45–0.50, while the pencil is within 0.9% of its right-end rest. Then it is drawn again.
   - t = 0 is still Brown's apex pose, on the retracing stroke, so the whole arc shows there, as on the plate.
   - The ink material is always blended (depthWrite off), so the wipe needs no shader switch.
4. **Drawing plane.** The board top moved from −0.101 to −0.077, so the pencil point (−0.075) rests 0.0005 above the ink.
   - Before, the pencil hovered 0.026 above the board and touched the centre of the tube.
   - Pins and washers follow the board top.
5. **Construction lines.**
   - Brown draws the laid-down chord, so it is restored as a thin flat ink line (0.022 wide) that stops at the pin washers. It was removed by source presentation.
   - Brown does not draw the versed sine, so it is deleted from the model.
   - The `source-presentation.js` 403 entry no longer removes the chord, and its note is updated.

## Checks
- Default view beside the plate (`tile-403.png`): X, tails, brace below the chord, chord and arc all read as on the plate. The arc passes behind the tails near the crown, as in Brown.
- Rotated, side and phase views are clean.
- At both stroke ends the far pin sits just clear of the other rule's tail (`after-views.png`, bottom row).
- Screens for 403:
  - coincident faces: 0 flagged pairs
  - disconnected parts: 0 detached. There are 2 near-misses: the pencil point against the right rule, which is the tangent pencil contact heuristic, and a washer below a moving rule.
  - body intersections: worst solid 0
  - check-loop-seams: score 0
- Tests:
  - `tests/movement-403.test.mjs` passes 15/15, including three new p105 tests:
    - the ink spans the full stroke at t = 0 and each rule body covers under 20% of it (only the tails);
    - drawing, retracing and wiping, with the ink ending at the pencil and the loop closing;
    - ink and chord on the board under the pencil point, with the stroke stopping at the tail-clearance distance.
  - `tests/cyclograph-contact-solids.test.mjs` passes 4/4. Its every-box pin clearance caught the tail collision before the stroke limit was added.
- `display-profiles.json` entry 403 (motion bounds, peak speeds) is now slightly stale, because the stroke is shorter. Re-measuring rewrites the shared file, so it is left to the integrator: `node scripts/measure-display-profiles.mjs 403`.
- No validation report or bake fingerprints these files.

## Residual
The ink stops 0.63 short of each pin. Brown draws the arc to the pins. With his tails and pins that stand through both rules, the instrument physically jams there, so this is forced by the geometry. It is shrunk by clearance only (0.02). Narrowing the rules to Brown's measured 0.30–0.33 would only move the stop to about 0.55.
