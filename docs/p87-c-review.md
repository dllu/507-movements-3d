# Pass 87, lane p87-c: 342 chain on the arc head, 336 frame, shared plate-chain pins

Reviewer: Claude Opus 5.5, lane p87-c. Date: 2026-09-27.

Scratch files and captures are in `/dev/shm/p87/p87-c/`, outside Git:
- `before/` has the captures taken before any change.
- `after/` has the captures taken after the changes.

## Shared chain builder (user image 47)

- **Before.** 334 and 342 each had a private `makeFlexibleChainLink`:
  - In 334, each pin ran exactly from `chainOuterLow` to `chainOuterHigh`. Its end discs lay flush with the outer plate faces and z-fought them, which is what image 47 shows.
  - 342 used a different builder: bosses, off-plane plates and rollers on long pins.
- **After.** There is a new shared module, `src/simulation/plate-chain-links.js`. It exports `makePlateChainLink`, which is 334's alternating inner/outer plate link, and `headedChainPinGeometry`.
  - **Pins.** Each pin is one lathed solid with a chamfered head at each end. A head has 1.35 times the pin radius. It is sunk 0.008 into its plate and stands 0.012 proud of the plate face, so no pin end is coplanar with a link face.
  - **334.** 334 now imports the shared builder, which is its old builder plus the pin heads. Its appearance is otherwise unchanged (`after/334.png`), and the heads stay behind the shoe face.
- **Movements that use the builder:** 334 (suspension chain D) and 342 (the beam-segment chain, including its short terminal link).
  - Both were captured and screened.
  - 335 lives in the same file but has no chain. No other module builds this plate chain.
- **Captures:** `after/334-pins.png` and `after/334-ph50-y40.png`, compared with the user's image 47.

## 342: chain on the arc head, and the slot (user image 45)

- **Chain.** The chain now runs in the beam's own mid-plane (z 0.30) and wraps on the segment head's rim, as in 334.
  - **Plates and depth.** It uses the shared alternating plate chain: width 0.57 source units, eye radius 0.47 times width, pin radius 0.16 times width. The whole chain depth (0.205–0.395) lies inside the head's 0.10–0.50 face, so the rim runs through the chain's plane.
  - **Clearance.** With the pins on the 12-unit pitch circle, the eyes ride 0.0097 clear of the 11.7-unit rim at every sampled phase; 334 rides 0.0107 clear of its shoe.
  - **Removed.** The rollers, bosses, long pins and the separate front and back chain layers are gone.
- **Chain ends.**
  - **Piston end.** The piston's chain eye is now a bored tongue in the chain plane, straddled by the first outer link. The crosshead's top was lowered to 0.012 below that link's eyes.
  - **Beam end.** The short terminal connector is now an outer link that owns the last two pins. It straddles a bored lug tongue that runs out of the head's round end to an eye concentric with the attachment pin. This lug replaces the box lug, boss and white pin.
- **Cylinder and piston.** Both moved from z 0.42 to the chain line so that the chain hangs straight into the crosshead.
- **Slot.** The head is now solid.
  - Brown's slot outline is a 0.03-deep raised panel. It is sunk 0.01 into the face so that no face lies coplanar with the head.
  - The four black bolts and their heads are removed.
- **Cylinder bottom.** It now plugs the bore: it is seated 0.006 into the wall and set 0.004 above the barrel's end. Before, it shared the barrel's outer cylindrical surface exactly.
- **Captures:**
  - Views: `after/342.png` (default), `after/342-y40.png`, `after/342-ym35.png`, `after/342-back.png` and `after/342-top-down.png`.
  - Phases: `after/342-ph50.png`, `after/342-ph75.png` and `after/342-ph30-y60.png`.
  - Zooms: `after/342-top.png`, `after/342-top-ym50.png`, `after/342-ph50-ym60.png`, `after/342-piston.png` and `after/342-head.png`.
  - Before: `before/342*.png`.
- **Screens:**
  - Intersections: worst solid 0.0000.
  - Seams: 0.
  - Disconnected parts: 0 slivers and 0 lips. The screen still lists one "detached" pair, the closed bottom and the open barrel, as it did in the pass-86 screen. `pair.mjs` measures a 0 gap between them at every phase. The pair is kept as a screen triage item.
  - The four bolt-and-head detachments from pass 86 are gone with the bolts.

## 336: frame gaps (user image 46)

- **Before.** The rockshaft standard and the diagonal member were two overlapping extrusions.
  - The standard's foot was a slanted wedge that touched the casing only at one corner, leaving a triangular gap over the casing step.
  - The diagonal ended in a square face standing out of the standard.
  - The rockshaft F end was flush with the standard's back face, which flickered in the back view.
- **After.** The standard F and the diagonal member are one outline extruded once (`fixed-one-piece-standard-F-and-diagonal-frame-member`).
  - **Foot.** A curved flare runs down to a flat foot seated 0.015 source unit into the casing step (y 5.0) as far as the top flange's end.
  - **Toe.** The diagonal's upper edge turns in a tangent curve down to a toe seated 0.015 into the top flange (y 5.6).
  - **Rockshaft.** The fixed rockshaft now ends 0.01 inside the standard.
  - **Blocks.** `rockshaftStandard` and `diagonalFrame` are the same mesh.
- **Captures:**
  - Before: `before/336-joint*.png` and `before/336-back.png`.
  - After: `after/336.png`, `after/336-y35.png`, `after/336-ym35.png`, `after/336-joint.png`, `after/336-joint-y40.png`, `after/336-joint-ym50.png` and `after/336-back.png`.
- **Screens:**
  - Intersections: 0.0000.
  - Disconnected parts: 0 detached. The one near-miss is the existing 0.07 gap between the stuffing box and the top flange.
  - Seams: 0.

## Tests

`node --test` passes 58 of 58 across `beam-upright-solids`, `movement-334`, `movement-335`, `movement-336`, `movement-342`, `engines-326-345-clearance`, `p59-visual-fixes`, `p61-faces` and `marine-parallel-solids`. The following tests were changed or added:
- **`beam-upright-solids`:** the 342 chain test is rewritten. It checks that outer links own headed pins that stand proud of both faces and lie within the head face, that inner plates clear their pins, that the eyes clear the rim, and that the lug, piston eye and crosshead clear.
- **`movement-342`:**
  - The z values now come from `geometry.chainLineZ`.
  - The terminal link's anchors and pin sit at the lug.
  - The head has no hole, and the raised panel is sunk into the face and stands proud of it.
- **`movement-334`:** a new test checks that all 10 pins have heads proud of both outer faces and behind the shoe face.
- **`movement-336`:** the test checks one support mesh with one outline, a foot seated into the step, and a toe seated on the flange.

No saved validation report fingerprints these files. The authored routes are unchanged because the ID sets did not change.

## Residuals
- **342 chain is partly hidden.** Because the chain now lies on the rim inside the head's face depth, a strongly rotated view hides the wrapped part of the chain behind the head's front face. The same happens in 334.
- **342 slot panel is faint.** It reads only as a faint raised band in the default view, because the camera looks straight at the face.
- **342 shading streaks.** At 6x zoom, faint shadow-map streaks show along the panel edge.
- **342 stay-end pins.** These are pre-existing white pins outside this lane's complaint. Some stand proud as short stubs.
