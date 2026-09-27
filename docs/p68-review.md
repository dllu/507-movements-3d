# Pass 68, lane p68: 247, 351, 367, 370, 387, 388

Reviewer: Claude Opus 5.5 (lane p68), 2026-09-26. Each ID was checked against `public/engravings/mm_NNN.png` and its
pass-67 residual. Captures are outside Git in `/dev/shm/p68/`:

- `before/` and `after/` hold `ID-{default,oblique}.png` from `review-movement-source-views`.
- `s<ID>-*.png` and `s<ID>-tile.png` hold phase and rotated views; `s247-tile2.png` is the 247 reset sequence and
  `c388.png` is a close view of the 388 roller face.

Intersections were screened with `show-body-intersections --spacing=0.01 --samples=129`, one ID at a time.

## 388 planer feed (`authored-planer-feeds.js`)

**Residual:** Brown's inner circle on the roller face was not modelled.

Brown's circle lies at 0.74 of the tooth-tip radius (52 px against 70 px on the plate). The toothed roller now has a
shallow raised hub boss on each face (`toothed-feed-roller-raised-hub-boss`):

- radius 0.74 of the tip radius;
- 0.045 proud of the face;
- its rim chamfered at 45°, so that the edge reads as a circle in the face-on view.

The boss is lathed on the shaft's bore and turns with the roller. See `c388.png` and `after/388-oblique.png`.

- **Intersections:** unchanged (tooth × plank 0.0499, the prescribed bite; tooth × grain 0.0185).
- **Faces:** unchanged (grain sheets only).

## 387 tide ladder (`authored-tide-ladders.js`)

**Water.** Brown draws only a few surface lines. The deep block from the surface to the bed is now a shallow surface
layer 0.26 deep, following the tide. It is translucent at the surface and fades to clear with depth (per-vertex
alpha), so there is no hard lower face. The hull's keel (0.14 draft) lies inside the layer at every tide. The layer
never reaches the bed (at low tide it ends 0.02 above it).

**Boat.** Brown's dinghy is 85 px beside a 275 px ladder (0.31). The hull is now 1.68 long, down from 2.10. The posts
stand at 43% from the bow, as he draws them. The bow rise is lowered from 0.30 to 0.16 to keep his low sheer. The
beam still follows the posts. See `after/387-default.png` and `s387-tile.png` (high and low tide, ±60°, top).

- **Intersections:** fluid only (wall × water 0.32, hull × water 0.14); no solid pairs.
- **Faces:** 1 degenerate (the hull's pinched stem), as before.

## 367 graduated-arc parallel ruler (`authored-parallel-rulers.js`)

**Residual:** the right link's upper-blade pin passed through the brass arc near full closing.

The arc lies between the upper blade and the links, so that pin must cross the arc's plane. On the real instrument,
closing the ruler brings the pin against the arc's outer edge: the arc is the closing stop. The demonstration now
closes only to that stop. The maximum link angle is solved by bisection for 0.012 clearance between the pin and the
arc's outer edge, giving 141.7° (was 145°). The minimum blade gap rises from 0.438 to 0.516. The scale calibration and
the ivory strip are recomputed from the new range. The default pose (Brown's 119°) is unchanged.

- **Intersections:** before, pin × arc 0.0798; after, clear.

## 351 gravity stamp (`authored-stamps.js`)

**Residual:** about three pitches of plain rod remained between the top tooth and the top collar.

At the lowered rest, the top rack tooth waits just below the pinion axis for pickup. So a collar directly above the
teeth stands level with the pinion. Any part of the collar past the rod's toothed face would then enter the pinion's
tip circle. Brown's collar overhangs that side too, which his plate cannot do at rest. A higher rest would lose the
pickup, and a lower rest gives nothing to pick up.

The top collar therefore now:

- overhangs only the plain side, 0.6 of the rod's width, as far as Brown's overhang;
- ends 0.005 inside the rod's toothed face on the pinion side;
- sits a third of a pitch above the top tooth, as Brown draws it.

The eight teeth now run up to the collar (`after/351-default.png`). The collar clears the pinion's tip circle by 0.012
over the whole cycle, the same clearance as the rod face itself. The lower collar is unchanged.

- **Intersections:** clear before and after.
- **Faces:** the new collar is not coplanar with the rod. The head-face z-fight is pre-existing.

**Residual:** the top collar is one-sided, where Brown's is symmetric about the rod.

## 370 mirror polisher (`authored-mirror-polishers.js`, `polishing-joint-parts.js`)

**Residual:** the mirror and ratchet stood in front of the bar, where Brown draws them behind it.

In Brown's own proportions the mirror's centre passes below the lower rail at the bottom of each stroke. So a mirror
behind the bar must also pass behind the rail and its guide pins. The new depth order, front to back:

1. the crank side (unchanged);
2. the bar (z 0.02–0.18);
3. the lower rail, now 0.20 deep (−0.21 to −0.01), with its pins standing forward through the bar's depth;
4. the click carrier (−0.24 to −0.28);
5. the ratchet and click (−0.30 to −0.44);
6. the square mirror (−0.46 to −0.54).

Changes that make this order work:

- **Axle.** The mirror axle runs from the mirror's back face through the carrier and the bar. To keep it above the
  rail at the bottom of the stroke, the mirror now sits 2.85 below the top eye (was 3.30). That is 4.0 crank radii,
  where Brown has about 3.6. The rail and guide are unchanged, so the bar's oscillation is unchanged.
- **Click stem.** The eccentric rod stays in front of the bar. The click's journal becomes a stem from the click,
  forward beside the bar's left edge, to the rod's lower ball joint. This follows Brown's hooked click coming round the
  bar's edge.
- **Carrier swing.** The carrier's base angle moves from 142° to 160° (swing 160°→130°), so the stem always clears the
  bar's edge by at least 0.057.

See `after/370-default.png`, `s370-tile.png` (four phases, and +60°) and `after/370-oblique.png`, where the mirror
passes behind the rail.

- **Intersections:** the same three follower-internal joints as before: rod × lower ball 0.061, rod × strap 0.012,
  stem × ball 0.011 (coaxial). No new pairs.
- **Faces:** unchanged.

**Residual:** the mirror sits somewhat higher on the bar than Brown's.

## 247 sounding weight (`authored-sounding-weights.js`, `release-mechanism-working-parts.js` seat, tests)

**Residual:** the fresh weight rose into view, lifted by nothing drawn.

Brown's apparatus has no line on the weight, so no drawn agency can lift it. The reset is reordered so that the weight
is already seated when it enters the view.

**Why two weights.** A single weight cannot do this: the spent weight has to leave the view while the re-armed rod is
in it, and the fresh weight has to be seated before the rod comes back. So the model now has two identical bored
weights that alternate. The loop is two soundings long (22.2 s authored, 16 s displayed, the same pace as before).

**New reset.** The descent, trip and fall are unchanged.

| Time (s) | What happens |
| --- | --- |
| 5.6–6.8 | The view holds on the bottom. The rod is hauled up out of the top of the view on its line, leaving the spent weight lying on the bottom in view. |
| 6.8–7.8 | Above the view (display y ≥ 11), the other weight comes from its park beside the rod's line (x −16), under the probe foot. It slides up over the foot and past the detained catch. The detent releases, the catch swings out, and the weight is let down onto the finite seat. The seat module's rescaled let-down is unchanged. |
| 7.8–9.6 | The rod comes back down into view with its weight seated. From 8.5 s the view rises with it, so the bottom and the spent weight sink out of the bottom of the view as the rod settles into Brown's pose. |
| 9.6–10.0 | Below the view (display y ≤ −1.3), the spent weight is lifted 0.3 clear of the bottom and carried aside to the park, to wait as the next fresh weight. |
| 10.0–11.1 | The rod is lowered toward the bottom with the view following it, as before. |

**Checks.**

- At every aspect from 0.46 to 3.5, something is always in view: the rod enters (≈8.6 s) before the spent weight
  leaves (≈9.1 s).
- Nothing pops or fades; both weights are always visible and move continuously.
- In view, a weight is only ever seated, falling or lying on the bottom.

**Intersections:** unchanged: rope contacts (line × knot 0.071, eye × line 0.037, line × tail 0.020) and the foot
touching the bed. The spare weight's paths are clear.

**Seams:** 0.

**Camera fit:** the fit excludes the parked spare. `review-movement-source-views` reports maxNdc 5.9 from the
leadsman's hand far above the view while the rod is hauled up; this is off screen by design (before: 4.04 from the
sea-bottom plane).

**Residuals.**

- About 1.8 s (1.3 s displayed) show only the spent weight on the bottom while the rod is away.
- The fresh weight's threading happens off screen.
- `src/data/display-profiles.json` motion bounds for 247 predate the spare weight's park at x −16. This lane may not
  regenerate them.

## Checks

- Loop seams (`check-loop-seams --ids=247,351,367,370,387,388`): 0 seams above tolerance, 0 pops.
- Camera fit, filtered to these six IDs (a scratch copy of `camera-catalog.test.mjs`): pass.
- Tests:

  ```
  node --test tests/movement-247.test.mjs tests/release-mechanism-working-parts.test.mjs
    tests/movement-351.test.mjs tests/stamp-trip-working-parts.test.mjs tests/movement-367.test.mjs
    tests/ruler-349-367-solids.test.mjs tests/movement-370.test.mjs tests/polishing-interfaces.test.mjs
    tests/movement-387.test.mjs tests/movement-388.test.mjs tests/textile-planer-working-parts.test.mjs
  ```

  All pass.
- Tests rewritten or added:
  - The 247 re-arm test now checks: the view is never empty, a weight in view is always supported, the fresh weight is
    never in view before it is seated, and both weights move continuously.
  - The 247 rates test samples inside the new segments, and its authored period is 22.2.
  - The 247 minimum display cycle is 16 s.
  - New tests: the 351 collar gap and clearance, the 367 arc stop, the 387 water layer and boat length, and the 388
    hub boss.
