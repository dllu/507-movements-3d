# Pass 96 fix lane p96-g (items deferred from docs/p96-fa-review.md and docs/p96-audit-001-085.md)

Reviewer: Claude Opus 5.5, lane p96-g, 2026-09-28. Two forked sub-lanes worked on disjoint claimed files:
- p96-g1: `authored-belts.js`, `authored-cascades.js` and `hoist-hardware.js` (004, 005, 006, 010, 019, 022).
- p96-g2: `authored-gears-core.js`, `fusee-geometry.js` and `fusee-motion.js` (025, 028, 033, 034, 038, 046).

The main lane edited `source-presentation.js` (the notes for 310 and 312). No git writes were made. The "before" captures are the audit's, in `/dev/shm/p96/a/sheets/`. The "after" captures are in `/dev/shm/p96/g1/sh/` and `/dev/shm/p96/g2/sh/`.

On the coordinator's instruction (the user's decision), 046 supersedes p96-fa's smooth grooved cone. Brown's stepped tiers are restored, and the chain now steps from tier to tier. The shadow normal-bias item was dropped because it belonged to the cone.

## Sub-lane p96-g1: 004, 005, 006, 010, 019, 022 (belts and cascades)

Reviewer: Claude Opus 5.5, sub-lane p96-g1, 2026-09-28. No git writes.

**Files:**
- `src/simulation/authored-belts.js` (claimed by p96-g).
- `src/simulation/authored-cascades.js` and `src/simulation/hoist-hardware.js` (claimed by p96-g1).
- `tests/belts-1-23-clearance.test.mjs`: five new "p96" tests.

**Captures:** `/dev/shm/p96/g1/sh/`, taken on a vite server on port 47395. The "before" captures are the audit's, in `/dev/shm/p96/a/`.

**Byte-identity:** I hashed the geometry of all 34 IDs on the belts route at three times, before and after (`/dev/shm/p96/g1/hash-{before,after}.txt`). Only 4, 5, 6, 10, 19 and 22 changed. The other routed IDs are byte-identical, including the other users of `hoist-hardware.js` (12–18, 20, 21 and 23).

**Screens** (`/dev/shm/p96/g1/{disc,disc2,cf,cf2,bi,bi2,seams}.json`):
- **Coincident faces:** 0 flagged pairs for all six.
- **Loop seams:** 0.
- **Body intersections:** worst solid 0 and coaxial 0.
  - 4, 19 and 22 needed `NODE_OPTIONS=--max-old-space-size=16384`, because the default heap ran out of memory.
  - 19 and 22 each list one "open" TubeGeometry: the stock hook tubes. Open shells are not targets.
- **Disconnected parts:**
  - 22 now has 0 open ends (it had 1).
  - 19 has 0 open ends (it had 3).
  - 5's floating group is unchanged: the known free lever and idler, not persistent.
  - 22's one sliver is unchanged from the audit: the hook resting in the weight's eye, gap 0.008.

**Tests:**
- `belts-1-23-clearance` 15/15.
- `hoist-assemblies`, `hoist-hardware`, `pulley-belt-geometry`, `pulley-family-review`, `white-pulleys`, `dual-belt-speeds` and `movable-belt-drive` all pass.
- `models.test` blocks for 4, 5, 6, 10, 19, 21 and 22 pass.

**Validation reports:** the only report that names `authored-belts.js` is `docs/validation/141-review.json`. It carries a `sourceCommit`, so I left it alone.

### 004 (medium): fixed
- **Verdict:** confirmed. Both guides sat at the drum's mid-height, but the wrap climbs 0.30 over about 2 turns. So the outgoing strand left the top coil and ran diagonally down across the lower coils.
- **Fix:**
  - The left guide's vertex is now at the bottom coil's height (−0.15) and the right guide's at the top coil's (+0.15).
  - The drum tangents are taken on those coil planes. The wrap starts exactly at the incoming strand's tangent point and ends at the outgoing one.
  - So each free span runs level from its own end coil, and neither crosses the helix.
  - The helix pitch is 0.146: a rope diameter of 0.10 plus 0.046 clearance. There are 2.06 turns.
- **Captures:**
  - `sh/4-m.png`: default, right, left, drum zooms and the back view.
  - `sh/4-m2.png`: side views with the guides hidden, and phase 0.6 from below.
- **Proposed ledger row:** assessment reasonable; visibleFlaws "".
  - Limits, append: "Pass 96: the guides stand level with the drum's end coils, so the incoming strand winds onto the bottom coil and the outgoing one leaves the top coil tangentially; no free span crosses the helix (pitch 0.146 = rope diameter + 0.046)."

### 005 (low): fixed
- **Verdict:** confirmed. The lever was `makeDynamicLink`: a square box with spheres at the joints, and the pivot pin was pushed through its bare end.
- **Fix:**
  - Lever B is now one flat `ExtrudeGeometry` (depth 0.10) in its own plane.
  - It has a round eye at the pivot of 1.6 pin radii (0.12), concentric with the pin, joined by straight tangents to a 1.35-pin-radius eye (0.10) at the idler pin.
  - The pivot pin is cut from 0.35 to 0.20 long, so it stands only just proud of the eye.
  - The lever rotates rigidly. Its eye-centre markers keep the existing rigid-length test valid.
- **Captures:** `sh/5-m.png` (default and phase 0.5) and `sh/5-m2.png` (pivot zooms from the default, right, left and behind).
- **Proposed ledger row:** assessment reasonable; visibleFlaws "".
  - Limits, append: "Pass 96: lever B is one flat extrusion with round eyes concentric with the pivot and idler pins."

### 006 (low): fixed
- **Fix:** the hub boss is now a 64-segment cylinder (it had 24), and the sector shaft is 48 segments (it had 22).
- **Proposed ledger row:** assessment reasonable; visibleFlaws "".
  - Limits, append: "Pass 96: smooth hub boss (64 sides)."

### 010 (low): fixed with end lands
- **Verdict:** confirmed. At the stroke ends the belt edge was 0.02 from the cone end.
- **Why not shorten the stroke:** cutting the amplitude by 0.6 of a belt width drops the extreme ratio to 1.88, below the tested >2 source range.
- **Fix instead:** the plate draws short turned ends on both cones (a rim at the large end, a hub at the small end). Each curved cone is now lathed in one piece, with a cylindrical land 0.6 of a belt width (0.096) long at each end.
  - The belt edge now stops 0.116 inboard of the solid's end.
  - The ratio range is unchanged.
  - The quadrant cue still shows on the end faces.
- **Captures:** `sh/10-m.png`: default, phases 0.25 and 0.75, right, left and back-oblique.
- **Proposed ledger row:** assessment reasonable; visibleFlaws "".
  - Limits, append: "Pass 96: both curved cones end in a short turned land beyond the belt's travel."

### 019 (low): fixed
- **Fix:**
  - `makeHoistBlock` gained optional `pinRadius` and `bore` parameters. Their defaults (0.065 and 0.072) leave every other user byte-identical.
  - The lower sheaves of 19 are now 0.8 r wide (0.4 of the diameter; they were 0.20).
  - Their pins are min(0.065, 0.35 r), with the bore 0.007 larger than the pin.
  - The smallest sheave now reads as an open coloured sheave, with its quadrant cue round the pin.
- **Residual:** the smallest sheave is still small (tread radius 0.108). Its strap covers its lower half, as on the others.
- **Captures:** `sh/19-22-m.png` (top row: default, zoom, right and left).
- **Proposed ledger row:** assessment reasonable; visibleFlaws "".
  - Limits, append: "Pass 96: the lower sheaves are 0.4 of their diameter wide with pins of 0.35 sheave radius."

### 022 (low): fixed
- **Fix:** the moving block's S-hook tip is closed by a ball of the tube's radius, centred on the tip. Its equator is turned onto the tube's end ring vertex for vertex (Frenet basis), so no step shows.
  - 19's three small lower hooks get the same cap for consistency.
- **Captures:** `sh/22-mtip.png` (two close zooms) and `sh/19-22-m.png` (bottom row).
- **Proposed ledger row:** assessment reasonable; visibleFlaws "".
  - Limits, append: "Pass 96: the S-hook tip is rounded and closed."

### Deferred
None.

## Sub-lane p96-g2: 025, 028, 033, 034, 038 and 046 (gears-core family)

Reviewer: Claude Opus 5.5, sub-lane p96-g2 (forked from p96-g), 2026-09-28. No git writes.

**Files:**
- `src/simulation/authored-gears-core.js` (claimed by p96-g)
- `src/simulation/fusee-geometry.js` (claimed for p96-g by the coordinator)
- `src/simulation/fusee-motion.js`, `fusee-chain.js`, `fusee-attachments.js` (claimed by p96-g). Only `fusee-motion.js` and `fusee-geometry.js` changed; the chain and attachment files are untouched.
- Tests: `tests/models.test.mjs` (the 28, 33, 38 and 46 blocks), `tests/stepped-sector-contact.test.mjs` (038), `tests/gears-24-46-source-match.test.mjs` (025), `tests/fusee.test.mjs` (046).

**Captures** are in `/dev/shm/p96/g2/sh/`:
- `<id>-after-views.png`: the plate, then the default, right, left, top, back, back-oblique and below views.
- `<id>-after-phases.png`: eight phases.
- For 046, the sheets are `46-final-*` and `46-tiers-*`.
- The "before" sheets are the audit's, in `/dev/shm/p96/a/sheets/`.

**Other IDs are unchanged.** I hashed the geometry (world matrices and positions at t = 0, 0.7 and 2.3) for all 58 IDs routed through authored-gears-core, comparing the HEAD file against mine with the same helpers. Only 25, 28, 33, 34, 38 and 46 differ. The hash lists are `/dev/shm/p96/g2/h-head.txt` and `h-mine.txt`. In a raw before/after comparison across the pass, 191 and 196 also changed, but that comes from other lanes' shared helpers, not from this file.

**Screens** (25, 28, 33, 34, 38 and 46, after the fixes):
- **Coincident faces:** 0 pairs.
- **Body intersections:** worst solid 0 and coaxial 0 for all six.
  - 28 first showed 0.14: the solid drum now slides along the shaft, so the pair is no longer coaxial. I fixed it with a bore.
  - 38 reports one open mesh, the ink sector-joint line, which was already there.
- **Loop seams:** 0.
- **Disconnected parts:** 0 detached, open ends, slivers or lips.
  - 38's two near-misses are the fixed link's 0.042 running clearance over the gear face.
  - 25's near-misses are the bevel-tooth and collar gaps (60, down from 74).
  - 46's six near-misses are the spring clamps and barrel parts, unchanged.

**Validation reports regenerated** (they fingerprint authored-gears-core.js; the pose counts are kept):
- `docs/validation/200-226-bevel-solids.json` (33 poses)
- `docs/validation/202-264-worm-solids.json` (`POSES=33`)
- `docs/validation/191-196-201-contact.json` (513 poses, via `review-irregular-gear-contact.mjs` and `.py`)

The results are unchanged; only the source hashes moved. 191-196-201 also hashes p96-fc's irregular-gear files. If p96-fc edits them again, it must regenerate that report last. These tests pass: irregular-gear-family, special-worm-solids, bevel-200-226-solids, variable-drive-205-209-solids and feed-worm-assembly.

### 028 (medium): fixed. The wheel slides along a fixed shaft and stays on the disc
- **Verdict:** confirmed. `liftHeight` was 0.2 and the shaft moved with the wheel.
- **Fix:**
  - `liftHeight` is 0.
  - The roller shaft is fixed in its (omitted) bearings, from x 0.46 to 1.84. Only the wheel translates during each adjustment, staying in contact.
  - The drum and its hub are now bored (r 0.116 over the 0.11 shaft), so the wheel really runs on the shaft.
  - The inner setting is now 0.66 (it was 0.55), so a short shaft stub stays inside the wheel at every setting, as on the plate, and the fixed shaft never pokes over the disc centre. The settings are 0.97, 1.24 and 0.66.
- **Captures:** `28-after-phases.png` (no hover at any phase), `28-after-views.png`, `28-after-shift.png`.
- **Tests:**
  - The models 28 block now asserts zero lift during adjustment, a fixed shaft position, the wheel within the shaft's length, and a bore larger than the shaft.
  - opening-gear-contact 028 passes.
- **Ledger:** assessment reasonable; visibleFlaws "".
  - Limits, append: "Pass 96: the wheel slides along a fixed, bored-through shaft while it stays on the disc (no lift); settings 0.97, 1.24 and 0.66. The sliding key is not drawn and not modelled."

### 038 (low): fixed. One flat link with eyes
- **Fix:** the thin rod and the two separate washers are replaced by one flat extrusion in the old collar plane (z 0.155 to 0.24).
  - It has a ring round each shaft (outer r 0.31, bore 0.186, concentric with the shaft) and a straight waist 0.4 of the ring diameter wide.
  - The waist joins each eye through concave fillets tangent to both (r 0.12).
  - `blocks.collars` now points at the link's eyes.
- **Captures:** `38-after-views.png`, `38-after-z.png`.
- **Tests:** the models 38 block and stepped-sector-contact 038 pass. They now check that the link is one ExtrudeGeometry, that each eye is solid from its bore out to r 0.25, and that the shafts have running clearance in the bores. The link-to-gear clearance bound is now 0.04; the measured clearance is 0.042.
- **Ledger:** assessment reasonable; visibleFlaws "".
  - Limits, append: "Pass 96: the fixed link is one flat plate with eyes concentric with both shafts."

### 025 (low): fixed. The round parts are smooth
- **Fix:** a local `resegmentCylinders(root, 64)` rebuilds every cylinder in 025 (both shafts, three collars and two hubs) with 64 sides. The bevel lathes were already at 96. `primitives.makeShaft` is untouched.
- **Captures:** `25-after-views.png`, `25-after-zm.png` (collars at 6–7×).
- **Tests:** new test `025 p96: shafts, collars and hubs are smooth` (at least 48 sides). The collar test passes.
- **Ledger:** assessment reasonable; visibleFlaws "".
  - Limits, append: "Pass 96: shafts, collars and hubs are 64-sided."

### 033 (low): fixed. Recessed web, rim band and boss
- **Fix:** built as on 030.
  - A full-depth (0.26) toothed rim round a web recessed to 0.18, inset 0.25 from the pitch oval (measured on the plate's inner oval line).
  - A raised shaft boss (r 0.24, 64-sided) in the gear's own colour, replacing the black r 0.19 hub.
  - The shafts are 64-sided.
- **Captures:** `33-after-views.png`.
- **Tests:** the models 33 block passes.
- **Ledger:** assessment reasonable; visibleFlaws "".
  - Limits, append: "Pass 96: each elliptical gear has a toothed rim round a recessed web (the plate's inner oval) and a raised shaft boss."

### 034 (low): fixed. Square stub teeth
- **Verdict:** confirmed.
  - The ring's full-depth involute (dedendum 1.25 m) left root gaps of only 0.033 against root teeth 0.165 wide. The teeth read as wide triangles with V-notch gaps.
  - The plate draws square teeth about as wide as their gaps.
- **Fix:**
  - The ring and the pinion both use a stub form: addendum 0.8 m, dedendum 1.0 m, 20°, still true involutes.
  - The ring's tips and gaps are flat (four samples each).
  - The ratio stays 50:20 with the same module and centre distance.
  - The ring's root gap is now 0.058 and its tip 0.062.
  - No shared builder was needed: 055/057 have no stub builder, and 057 is still pointed (forced, per p93).
- **Captures:** `34-after-views.png`, `34-after-zm.png`.
- **Tests:** spur-mesh-clearance 034 (no penetration over one tooth pitch, flanks engaged within 0.0015) and the models 34 block pass.
- **Ledger:** assessment reasonable; visibleFlaws "".
  - Limits, append: "Pass 96: ring and pinion are cut as 20° stub involutes (addendum 0.8 m, dedendum 1.0 m), so the ring's teeth read square and flat-topped as on the plate."

### 046 (medium, re-done at the user's request): stepped tiers, and the chain steps tier to tier
This supersedes p96-fa's smooth grooved cone, which the user rejected as "too smooth and blobby" (Brown's fusee has clear steps). I also dropped the planned shadow normal-bias override, since it belonged to the cone.

- **Form:** Brown's stack, as one closed solid: three flat turned working tiers over a wider base flange (plate: four discs).
  - Riser radii: 0.60, 0.83 and 1.06.
  - Base: r 1.28.
  - Tier height: 0.26.
- **Chain seating:**
  - On each tier the chain wraps level, seated on the shelf of the tier below (pin ends 0.002 above it) and against its own riser (0.0025 plate clearance).
  - It climbs once per tier. A spiral lobe on the tier carries it outward over the shelf at a constant gap. The rise is 1.1 rad of a cosine blend, convex throughout (r² + 2r′² − r r″ > 0). The lobe ends in a radial step once the chain's top is below the shelf.
  - The chain then runs down the next riser on a two-parabola descent (1.25 rad), which is the least edgewise curvature for the drop.
  - The transition windows are staggered: tier 0 climbs at 3.8 rad and each later climb is 2π − 1.4 later. As a result:
    - no lobe lies under another turn's descent, or behind a contact point within 0.8 rad;
    - no level wrap overlaps itself.
- **Leaving the fusee:** where the chain leaves, it eases off the tier path onto the straight span over a settle length of 0.45. A parabolic lift matches the span's slope at the contact, so no joint kinks edgewise. This is physically free, because a riser gives no vertical support. The easing is never allowed below the seat the chain is heading for.
- **Barrel:** the chain pitch is now 0.24 (it was 0.205) and the top course is at 0.487.
  - The barrel contact is always at or above the fusee contact, so the span never descends into a shelf.
  - The span slope is at most about 0.13 rad (a range of 0.30 over the ~2.3 span).
- **Source pose:** the chain run down to the lowest tier with 5.0 rad (about 0.8 turn) left on it, the rest on the barrel, as the plate draws. The old test assumed "barrel turns = 3".
- **Chain:** 278 links, pitch 0.0801, 2.39 wrap turns on the fusee.
- **Captures:**
  - `46-tiers-views.png` (plate, default and rotations), `46-tiers-zphases.png` (fusee close-ups at eight phases, showing each level wrap, the climbs and the descents), `46-tiers-close.png` (seating: chain in the shelf/riser corner).
  - Before: `/dev/shm/p96/a/sheets/46-views.png` (the pre-p96 tiers, with the chain crossing the tier edges).
- **Tests:** `tests/fusee.test.mjs`, 8/8 pass.
  - **Rigid links and end attachments:** every link keeps its pitch and both attachments hold over 257 poses.
  - **Closed body:** the stepped body is closed with outward shading.
  - **Pin fit:** pins fit their bores over 1025 poses (minimum 0.0007).
  - **Leaf separation:** adjacent leaves stay separate (minimum 0.0026).
  - **Clearance:** the chain clears the actual fusee triangles (minimum 0.0012) and the barrel (0.0012).
  - **Self-clearance:** chain 0.0041, spring 0.037.
  - **New tier-seating test** (97 poses, 8980 wound pins):
    - 76% of the wound pins lie exactly level on a tier's shelf, backed by the riser or the lobe at a constant gap.
    - The rest run on a riser radius and clear the adjacent tier.
    - Pins easing off at the contact clear the body.
  - The models 46 block passes: steppedTiers, 3 tiers and the plate pose.
- **Residuals (honest):**
  - The climbs show as small spiral bulges, each ending in a radial step on the tier outline. They are real features of this reconstruction, not drawn by Brown, who shows plain discs.
  - The span to the barrel rises by up to about 7° at some phases, where Brown draws it level.
  - Tiers carry the shared quadrant colours.
  - `scripts/probe-fusee-clearance.mjs` is a historical probe of the grooved form and no longer applies.
- **Ledger (amended by the main lane):** assessment minor; visibleFlaws "Each climb shows as a small spiral bulge ending in a step on the tier outline, where Brown draws plain discs; at some phases the span to the barrel rises up to about 7°, where Brown draws it level."
  - Limits, replace the p96-fa cone sentence with: "Pass 96 (supersedes the smooth cone): Brown's stepped fusee, three flat tiers over a base flange. The chain wraps each tier level on the shelf below against its riser, climbs once per tier on a short spiral lobe (ending in a radial step) and runs down the next riser. It eases off the path where it leaves for the barrel. The barrel coil pitch is 0.24, so the span never dips into a shelf; it rises up to about 7° at some phases."

### Deferred
None. The 046 shadow-bias item was dropped on the coordinator's instruction.

## 310 and 312: source-presentation notes (main lane p96-g)
- **Verified** against the current `authored-gravity-escapements.js`: 310's `pendulumPlaneZ` is −1.0 (behind the pivot block and arbor end); 312's pendulum sits at the arbor end + 0.05 in front, and E/F are built as flat arm-metal tabs (`forkTabShape`), as `docs/p96-fd-review.md` reports.
- **Change:** only the two `note` strings in `src/data/source-presentation.js`; the `remove` lists are untouched.
  - 310 now says the rod hangs behind the whole escapement, just behind the pivot block and arbor end, as Brown dashes it, with the beat pins reaching back to it.
  - 312 now says E and F are flat oblong tabs of the arm metal (Brown's slots), and the pendulum hangs from C in front of the wheels, just in front of the arbor end and see-through, because E and F sit inside the large wheel's spokes.
- **Tests:** `tests/source-presentation.test.mjs` passes 310 and 312 (it iterates in ID order); it fails later at 407 (`mirrored-right-half-completing-pointed-arch removes a part`), which is another lane's in-flight change, not this edit.
- **Ledger:** no assessment change; the notes now match fd's proposed rows.

## Deferred
- None.
