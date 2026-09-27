# Pass 84, lane p84-d: 463, 247, 482, 500, 459

Reviewer: Claude Opus 5.5, lane p84-d. Date: 2026-09-27.

The captures are in `/dev/shm/p84-d/`, outside Git:
- `base/NNN-tile.png`: before (phases 0, 0.25, 0.5 and 0.75, two rotations, plate).
- `a463/`, `a247/`, `a482/`, `a500/`: after, with phase, rotated, zoomed-out and close views.
- `final/NNN-default.png` and `final/NNN-oblique.png` (from `review-movement-source-views.mjs`), plus `final/all.png`.

Loop seams (`check-loop-seams --ids=247,459,463,482,500`): 0 seams, 0 pops and 0 errors.

## 463 Self-acting weir: the caption's notch

**Change.** The upper leaf now has a rectangular notch cut down from its top edge:
- The notch is 1.20 wide (the middle half of the 2.40 channel) and 1.20 deep. Full-height shoulders stand at both leaf ends.
- The section's near end therefore shows the full-height plank, as Brown draws it. The water leaves through the notch behind that end, below the leaf top.
- **Ordinary head:** 0.26 over the notch sill. The surface stands 0.94 below the leaf top. On Brown's plate it stands 0.37 of the leaf height down, which is 0.95 at this leaf's length.
- **Flood head:** 0.75 over the sill, about 4.9 times the ordinary notch flow (q ∝ h^1.5).
- **Level cap:** the level is capped 0.04 below the (possibly turned) shoulders. It never binds: the least freeboard over the cycle is 0.335. All flow leaves through the notch.
- **Water continuity:** the falling sheet spans the notch less 0.02 each side. Its depth at the sill is the head, so it is continuous with the head water. It dwindles smoothly as before.
- The top batten was moved from 0.94 to 0.60, below the sill (0.73).

The body below the sill and the two shoulders are separate closed meshes (`upper-leaf-{near,far}-shoulder-beside-notch`), on one leaf group.

Captures: `a463/tile.png` (seven phases and the plate) and `a463/tileR.png` (rotated, back and top views, where the notch shows).

**Checks.**
- Intersection screen at 0.01 × 129: only fluid pairs, as before. The shoulders only touch the head water, at depth 0.
- Disconnected-parts screen: unchanged from HEAD (the deposit is a near-miss to the bed at 0.047).
- **Tests:** `movement-463` and `chain-weir-interfaces` pass, 14/14. The plain-plank test is now a notch test: two shoulders, the body ends at the sill, and the battens are below the sill. The schedule test now requires the head to stand over the notch sill and below the shoulders at every phase, and the ordinary head to stand more than 0.8 below the top.

**Proposed ledger (463)**
- assessment: reasonable
- visibleFlaws: (none)
- limits (replace the first clause): The ordinary flow leaves through a 1.20-wide, 1.20-deep notch in the middle of the upper leaf, with the head 0.94 below its top as on the plate; the notch passes the flood too, so nothing overtops the shoulders. The pivot pins end at the channel-wall planes, which the section cuts away; head water and flow are scheduled.

## 247 Sounding-weight release: no bottom in the default view, and no sinking

**Frame.** The camera now looks up by 5° (direction (0.9, -1.06, 12)), from the bottom's own level, and the crop's floor is 0.47 above the bottom:
- The two settings were solved together in the engine's fit. At every aspect of 0.5 or wider, where the height governs the fit (tested at 0.7–2.4), the eye stands 0.014 below the bottom's plane, so its top is never seen.
- That plane projects at NDC -1.0025, less than a pixel below the frame edge.
- Brown's pose (foot 0.8 above the bottom) shows no bottom.
- When the probe strikes and the weight lands, they stand on the lower frame edge. The foot is cut by less than a pixel.

**Reset.** The spent weight no longer sinks into the bottom:
- As the re-armed rod comes back into view, the vessel moves on to the next sounding station. The bottom and the spent weight lying on it move off sideways together, rigidly. Nothing slides over or into anything.
- **Distances:** stations are 40 apart, far beyond the 3× zoom-out view.
- **Speed:** the move is a slow creep of 12 over 7.8–11.4 s while the weight is in view (at most 6.25 units/s), plus a faster run over 10.4–11.4 s once it has gone.
- **Direction:** the soundings alternate, so two soundings (22.8 s) close the loop.
- **Recycling:** the weight left at the previous station is lifted there, far to the side, and carried across far above the view to be threaded on. This is the same unmodelled hidden carriage as before, but it no longer passes through the bottom.
- **Bottom:** the bottom is 200 long, so its ends stay beyond any view.
- **Timing:** the rod now returns by 9.5 s (was 11.4) so that it is back in view before the spent weight leaves.

Captures:
- `a247/tile.png`: 14 times over both soundings, and the plate.
- `a247/tileR.png`: rotated, 0.33× zoomed out during the move, and close to the impact.
- `final/247-default.png`, `final/247-oblique.png`.

**Checks.**
- The review script's maxNdc of 51 comes from the far ends of the 200-long bottom, by design.
- The disconnected-parts screen's "floating" entry is the recycled weight on its hidden route 40 to the side, as at HEAD (where it was at 38).
- The camera-fit test, filtered to this lane's IDs, passes.

**Tests:** `movement-247` 9/9 and `release-mechanism-working-parts` 5/5.
- The re-arm test is rewritten. At 4001 samples it checks:
  - The bottom moves only sideways, continuously, with its ends out of view.
  - No weight ever enters the bottom.
  - A weight lying on the bottom moves only with it.
  - The view (now also bounded in x) is never empty.
- The fit floor must be above the bottom, with an upward camera.
- A new test bounds the in-view move to under 7 units/s.

**Needs integrating (not this lane's files):**
- The `source-presentation.js` 247 note still describes the settling and burial. Suggested replacement: "Front section through the rod, the weight and the catch, with the probe foot below; the camera looks up from the sea bottom's level, so the undrawn bottom is seen edge-on as the lower frame edge (the caption has the weight detach on striking bottom). The loaded rod is lowered onto the bottom, the probe trips the catch and the weight drops; the rod is hauled up out of view on its line and, far above, re-armed with the second of two alternating weights, and as it returns into Brown's pose the vessel moves on to the next station, the bottom and the spent weight moving off sideways together. The loop is two soundings long; no reload gear or hand is shown."
- `display-profiles.js` 247 (motion bounds and speeds) should be re-measured with `scripts/measure-display-profiles.mjs`.

**Proposed ledger (247)**
- assessment: reasonable
- visibleFlaws: (none)
- limits (replace): The camera looks up 5° from the bottom's level, so the bottom is edge-on at the lower frame edge (it would show below the foot only at aspects narrower than about 0.5, where the width governs the fit). Between soundings the vessel moves on 40 to the next station: the bottom and the spent weight move off sideways together while the rod returns (a reconstruction device to close the loop, not from the caption). The weight left at the previous station is lifted and carried back by unmodelled gear far to the side and above; that route could be seen by panning far to the side.

## 482 Powers's regulator: Brown's round section

**Change.** The regulator is now round, as Brown draws it:
- **Case casting** (`outer-quicksilver-channel-sealing-cup-H-1`, lathe):
  - The outer wall runs r 2.30–2.55 from the channel floor up to the lid seat. The channel floor runs r 1.96–2.55.
  - The outer quicksilver channel is therefore formed in the case, between the outer wall and the well wall. Before, a square box case stood round free-standing rectangular troughs.
  - The wall top (`fixed-domed-case-roof-reconstruction`) is the ring the lid seats on. The flat roof plate is gone.
- **Well** (the chamber): the well wall runs r 1.78–1.96 from the well floor (-1.98) to y 0.
  - It is the channel's inner wall, as in Brown's section.
  - A 24° panel at its back is bored for the round outlet port F (radius 0.20, at x -1.30, y -1.50). F shows as Brown's oval on the curved back wall.
  - The panel is built from 0.025-wide columns bent onto the wall radius, with radial normals, so it shades as one wall with the lathe.
- **Valve D's channel:** a round cup (walls r 0.70–0.81, floor at -0.95) on a pedestal from the well floor.
  - E is the channel's inner wall: the cup is cast round E, so the quicksilver cannot leak down E.
  - The cup's outer wall merges with the well wall at the section, as Brown draws it.
  - The quicksilver ring runs r 0.241–0.699.
- **Cup H:** a round inverted cup, with a top of r 2.18 and a rim of r 2.00–2.16, running in the channel with 0.04 and 0.14 clearance. The two square cross-skirts are gone.
- **Valve D:** a round inverted cup, with a skirt of r 0.555–0.595 carrying the four V notches b, built the same way as the bent panel. The four square corner posts are gone.
- **Lid:** one solid of revolution, whose lapped edge seats on the wall top. H's guide rod now rises on the case axis through the crown and the turned knob, as Brown draws it. The bore (0.079 on the 0.075 rod) guides it. The hidden bushing is not shown.
- **Delivery pipe:** it leaves F radially, turns left under the channel floor (its top at -1.23, below the floor's -1.08) and ends in the flange at the left, where Brown draws the nozzle.
- **Gas markers:** they now run from the notch over the well, down to F and along the pipe.
- **Unchanged:** the operating point, the lever geometry, the notch law and the seals.
- **Cutaway:** the 482 entry in `cutaway-presentations.js` now names the new roles and colours the whole casting alike. The back-panel `prepare` is gone.
- **Fit:** the fit is taken after the cut, over the whole cycle.

Captures: `a482/tile.png` (default, mid-cycle, rotations, back, top, the F close-up and the plate) and `a482/tileB.png` (valve D, rim, side).

**Checks.**
- **Intersection screen:** only the intended rim and skirt immersions (see "Checks" below).
- **Disconnected-parts screen**, against HEAD run from a `git archive` copy:
  - H now joins the lid through the knob bore (a 0.004 running fit).
  - Valve D's group was already a near-miss at HEAD (0.014, corner post to trough). It is still one (0.105, skirt to its channel through the quicksilver). Its lever seat stands in front of the cut, as at HEAD.
- **Tests:** `movement-482` 11/11 and `gas-meter-working-solids` pass.
  - The old box-vault test ("closed at its rear end") is replaced by a round-case test. It checks that the case wall, lid and quicksilver ring are round and back-half, the rim clears both channel walls, D's channel is inside the well, F is in the well's back, and the pipe passes under the channel floor.

**Proposed ledger (482)**
- assessment: reasonable
- visibleFlaws: (none)
- limits (replace): One clean cutaway of a round case whose outer wall forms the quicksilver channel and whose deep well is the chamber; F is a round port in the back of the well, from which the delivery pipe runs out under the channel floor; the well floor is left whole in front of the cut, carrying lever d's stand, and the lever's seats on H and D stand in front of the cut with them; the separate view of valve D is not modelled; mercury levels are static.

## 500 Pressure gauge: the section overlapping the gauge when rotated. Left as forced.

**Measured**, on the sampled vertices of both figures, as the overlap of their horizontal extents in 0.2-high bands, in orthographic projection with the camera turned about the vertical:
- **Onset:** the overlap begins at 32° with the camera to the gauge's side, and at 53° to the section's side. At the first, the section's half-case (3.3 deep behind its cut) swings behind the gauge.
- **Other placements tried, numerically:**
  - Moving the section toward the camera balances the two sides at about 40° (0.9 forward). Moving it back helps one side and hurts the other.
  - Clearing ±60° needs the gap widened from 1.86 to about 4.9, with the section 0.5 forward, or about 7.3 without. That is 25–35 times the plate's gap of 0.2, and it shrinks the default view by about a quarter.
- **One model:** a single model cannot give both of Brown's views at once from the default camera. A single gauge shows either its face or its section. So the pair must stay two objects, and any two objects this deep overlap in projection at large rotations.
- **Thin slab:** keeping only a slab of the section a few tenths deep would clear ±60° at about the present gap, but it would be a cropped, sliced part.
- No code change.

**Proposed ledger (500)**
- assessment: minor
- visibleFlaws: With the camera turned 32° or more toward the gauge's side (53° toward the section's side) the section figure overlaps the gauge in projection.
- limits (replace the gap sentence): The two figures are separate objects, because one model cannot show both views at once. Their overlap onset was measured at 32°/53°. Clearing ±60° needs the gap widened from 1.86 to about 4.9 (with the section 0.5 forward) against the plate's 0.2, which would break the default framing.

## 459 Reciprocating well lift: the star-wheel axles' carrier. Left as forced.

**Measured** on the production route, with the source presentation applied:
- The journals stand at x ±0.99, y 2.31 (front ends z 0.20–0.38).
- The nearest fixed drawn part is the top of the central post (Brown's post under the tappet block), at y 0.82 and x ±0.09. That is 1.31 below and 0.72 inboard, a span of about 1.5.
- **What else Brown draws:**
  - Near the wheels: only the worm (moving), the coupling and wind shaft (moving), and the tappet (moving).
  - The fixed framing further off: the well curbs, 3.1 below.
  - Brown's crossed-box bar under the wind wheel is at y ≈ 3.3, 1.1 above the axles. It spans only x -0.48 to 0.75 and is not modelled as fixed.
- **Why nothing fits:** any carrier would be a visible member at least 1.1–1.5 long that Brown does not draw. A back board behind the pulleys would show through the spokes and beside the worm.
- No code change.

**Proposed ledger (459)**
- assessment: minor
- visibleFlaws: (unchanged) The two star-wheel axles and their journals have no carrier (Brown draws none) and join the rest only through the worm's designed 0.054 clearance.
- limits (append): The nearest fixed part Brown draws is the central post's top, 1.31 below and 0.72 inboard of the journals, so a carrier would be a member of at least 1.1–1.5 that Brown does not draw.

## Checks

Intersection screen (0.01 spacing, 129 samples, `/dev/shm/p84-d/screen.txt`):
- **463:** only fluid pairs. The shoulders touch the head water at depth 0.
- **482:** only fluid pairs: H's two rims in the channel's quicksilver (0.169) and D's skirts in D's quicksilver (0.144), as intended. There are no solid pairs, and no open meshes.

Targeted tests, all passing:
- `movement-463`, `chain-weir-interfaces`
- `movement-247`, `release-mechanism-working-parts`, `movement-240`
- `movement-482`, `gas-meter-working-solids` (22/22)
- `see-through-part`, `source-presentation`, `rotation-indicator` (15/15)
- The camera-fit test filtered to 247, 459, 463, 482 and 500

## 482 follow-up: valve D hangs from lever d; the dark shape in the well

**Hanger.** Valve D's slotted seat on lever d's pin was a plate 0.08 deep in the lever's plane, at z 0.63–0.71. The section cuts D at z 0.29, so in the production cutaway the seat stood clear of D, and D's group joined the rest only through the quicksilver (0.105).

The seat is now D's hanger (`finite-horizontal-pin-slot-hanger-of-valve-D`):
- The same slotted plate, 0.60 × 0.24, is carried back from the lever's plane to z 0.28, into D's round top at the section plane. It is Brown's link from d to D.
- The pin rides in the front of the slot as before, so the pin, the lever and the slot are unchanged.
- No pin or protrusion was added.

**Checks.**
- **Disconnected-parts screen:** 0 detached components (before: D's group at 0.105). The remaining 0.03 pairs are the running clearances between the lever plate and the seat faces on the pin, as at HEAD.
- **Intersection screen:** only the intended rim and skirt immersions in quicksilver (0.169, 0.144). There are no solid pairs and no open meshes.
- **Tests:** `movement-482` and `gas-meter-working-solids` pass, 22/22.
- **Loop seams:** 0.

**Dark shape.** The dark curved shape on the well's back wall is a shadow, not geometry. It vanishes when shadow casting is switched off (`a482/p0-noshadow.png`, `a482/zoomF-noshadow.png` against `p0-v2.png` and `zoomF-v2.png`). It is the shadow of the cut cup H and lid falling into the well. It is left as lighting.

**Captures:** `a482/tileC.png`, which tiles the default and F close-up with and without shadows, and the hanger close-up `a482/zHanger.png`.
