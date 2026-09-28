# Pass 96, lane p96-fb: fixes for the 86–170 audit

Reviewer: Claude Opus 5.5, lane p96-fb (with forked sub-lanes for belts, gears-core and linkages). Date: 2026-09-28. The audit is `docs/p96-audit-086-170.md`.

Captures and scratch files are in `/dev/shm/p96/fb/`, outside Git. Tiles are laid out as in the audit: the plate plus eight views, and a 12-phase strip. Sub-lane evidence is in `belts/notes.md`, `gears/notes.md` and `link/notes.md`.

Files claimed under `/dev/shm/p96/claims` (owner p96-fb):
- `authored-cranks.js`, `authored-gears-core.js`, `authored-belts.js`, `authored-linkages.js`, `authored-cams.js`
- `authored-worm-screws.js`, `authored-gear-linkages.js`, `authored-variable-cranks.js`
- `geometry.js` (the `mujoco-crank-slider` one), `slotted-sector.js`, `slotted-sector-teeth.js`, `source-presentation.js`
- `opposed-screw-nuts.js`, `geared-crank-frame.js`, `variable-radius-crank.js`, `linked-variable-crank.js`
- the `mujoco-*` directories and `rotation-indicators.js` claimed by the gears sub-lane

## Medium findings

### 92: undrawn rear support (fixed)
- **Plate.** Brown draws the wheel, the rod, the crosshead and the guide, which is broken off at the right. He draws nothing joining the shaft to the guide.
- **Why no support can be hidden.** The lead suggested hiding a support inside the wheel's outline. That does not work here:
  - The rim sits only 0.02 from the guide's end (0.855 against 0.875).
  - The wheel has six large spoke openings.
  - Any fixed bar behind the wheel that joins the hub to the guide therefore shows through the openings at most phases. `z92/before.png`, right panel, shows the old bar through a spoke window.
  - The only region the wheel always hides is the hub disc (r 0.25), and the guide cannot be reached from inside it.
- **Change** (`src/simulation/mujoco-crank-slider/geometry.js`):
  - Deleted `rearSupport`. The guide and the hatched shaft end are both fixed ground, as drawn, and nothing joins them.
  - Removed "rear support" from the reconstruction note in `visual.js`.
- **Physics unchanged.** The frame is not part of the MuJoCo bodies, so the physics XML hashes do not change.
- **Rebake.** The bake was rerun (`node scripts/bake-mujoco-movement.mjs 92`) to refresh the provenance hashes:
  - loop 4.000 s, 250 samples;
  - seam step 2.151 px, against an interior step of 2.152;
  - round trip 0.006 px (the limit is 0.1).
- **Captures:** `tiles/92.png`, `tiles/92-cycle.png`, `z92/before.png` and `z92/after.png` (the wheel–guide gap at phases 0.17 and 0.75, zoomed about 3×).
- **Screens:**
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. The old 0.0085 lip was on `rearSupport`.
  - Coincident faces: 0.
  - Seams: 0.
- **Tests:** `mujoco-crank-slider` and `mujoco-baked-loops` pass (119/119).
- **Residual:** the ink shaft stub still runs 0.34 behind the rear hub, as before.
- **Ledger row:** reasonable; visibleFlaws "". Limits, append: "p96: the undrawn rear support between the shaft and the guide is removed (a fixed bar there showed through the spoke openings and the 0.02 rim-to-guide gap); the guide and the shaft end are fixed ground, as drawn."

### 117: friction rollers (gears sub-lane)
See `/dev/shm/p96/fb/gears/notes.md` and the gears section below.

### 129: hook block (belts sub-lane, fixed)
- **Plate check.** The finding holds.
- **Change.** The hook block (`loadHanger`) is one steel-grey clevis:
  - two strap cheeks (eye r 0.40, strap 0.64 wide, 0.10 thick), one on each face of the sheave, 0.03 clear of it;
  - a bridge 0.04 below the rim;
  - the neck and hook hanging from the bridge's centre, in the sheave's plane;
  - the axle through both cheeks, with a cap on each face.
- **Screens:**
  - Coincident faces: 0.
  - Seams: 0.
  - Disconnected parts: the moving block is connected. The one detached group is the frame, through the existing 0.0188 bearing clearance.
  - Body intersections: worst 0, run as `--worker=129` with a 14 GB heap because the wrapper runs out of memory.
- **Tests:** windlass-hardware, windlass-flange-clearance and the 129 models test pass.
- **Captures:** `belts/tiles/129.png`, `belts/z129.png`.
- **Ledger row:** reasonable; "". Limits, append: "Pass 96: the hook block is a symmetric two-cheek steel clevis (Brown's strap on each face, bridged below the rim) carrying the hook in the sheave plane; the rear cheek is inferred."

### 131: tooth forms and rack length (fixed)
- **Plate.** Brown draws about 9 sector teeth and about 10 rack teeth, all square and flat-topped. The model's teeth were a 20° full-depth involute, 2.25 modules deep, which read as fingers on the sector and points on the rack.
- **Change.**
  - `slotted-sector-teeth.js` now takes options for pressure angle, addendum and dedendum. The defaults are unchanged, so the authored-cranks copy is byte-identical.
  - `slotted-sector.js` (the production 131) uses a 14.5° stub form: addendum 0.8 m, dedendum 1.0 m, 1.8 m deep in all. This is about 28 teeth; the undercut limit for this form is 25.5 teeth.
  - The tip widths are now 0.34 pitch on the sector and 0.37 pitch on the rack, and the flanks are straighter.
  - The rack's end allowance is 0.45 instead of 0.18, so each end stays about 0.3 past the outside of its guide at full travel. Before, the left end was flush with its guide at phase 0.42.
  - The camera bounds follow, so the model frames about 10% smaller.
- **Captures:** `tiles/131.png`, `tiles/131-cycle.png`, `z131/after.png` (the mesh at 0 and 0.42, and the left end at 0.42), `z131/131-p00c.png` (teeth close up) and `z131/defcmp.png` (default view, before and after).
- **Screens:**
  - Coincident faces: 0.
  - Disconnected parts: only the existing 0.02 guide/rack running clearance (near-miss).
  - Body intersections: the screen measures the registry model, and shows the existing 0.195 shaft/slot pair.
- **Tests:** `slotted-sector-reconstruction` passes. It covers 721 poses: tooth overlap below 1e-11, working gap below 0.002, the bar in both guides, and the rack clear of the guides. `slotted-sector-teeth` and `slotted-sector-pin` also pass.
- **Residual:** the sector flanks are involute, so they taper slightly where Brown draws nearly parallel sides.
- **Ledger row:** reasonable; "". Limits, replace the first clause with: "Bar extended so each end stays about 0.3 past its guide at full travel; 14.5° stub involute sector and conjugate rack (square, flat-topped look); ideal prismatic constraint and hidden depths."

### 134: lagging rim and hub (belts sub-lane, fixed)
- **Change:**
  - Each rim face is one notched lagging ring, with eight steel radial blocks filling the notches. The blocks stand slightly proud, with no coincident faces.
  - The rope groove is kept.
  - The hub ring (0.24 R) stands 0.04 proud with a rounded edge.
  - The 134 entry in `source-presentation.js` is updated.
- **Screens:** all 0.
- **Tests:** rope-drum-hardware, single-wrap-drum and the 134 models test pass.
- **Captures:** `belts/tiles/134.png`, `belts/z134.png`.
- **Ledger row:** reasonable; "". Limits, append: "Pass 96: the rim is a notched lagging ring on each face with eight steel radial blocks, and the hub ring stands proud; the lagging pieces are circular segments where Brown draws hatched straight chords."

### 144: post in front of the tongs (linkages sub-lane, fixed)
- **Change:**
  - The post is 0.30 deep and stands wholly in front of the tongs, from z 0.74 to 1.04. It clears the nearest moving part by 0.045.
  - It uses the shared see-through style (`makeSeeThrough`).
  - The fixed centre pin runs from behind the rear links forward into the post, with its head on the post's front face.
- **Screens:** all 0, apart from the existing pin-bore near-misses.
- **Report:** `docs/validation/144-assembly.json` is regenerated (65 poses, 0 failing pairs).
- **Tests:** the 144 models test and bored-scissor-link pass.
- **Captures:** `link/tiles-after/144.png`, `link/z/144z.png`.
- **Ledger row:** reasonable; "". Limits, append: "p96: the post stands in front of the tongs on its own plane, see-through in the shared style, with the fixed centre pin running back from its face through both link planes. About 0.4 of the pin shows between the front links and the post in side views."

## Low findings fixed

- **132: platen guide ears** (`authored-cranks.js`).
  - **Change:** each platen end has one ear, a single extrusion of the platen's height and colour. It runs back from the platen's back face, tapers along it over 0.55 so the joint is not a sliver, and is bored to wrap its round column with 0.004 running clearance. The outer end is an arc concentric with the column.
  - **Stroke:** the ear rides only on the plain shaft of the column. The stroke spans y −2.10 to −1.01, and the plain shaft spans −2.99 to 3.31.
  - **Earlier removal:** p64 removed dark rectangular guide plates as undrawn. These ears follow 133's accepted p93 treatment instead: the driven colour, wrapping the column, and mostly behind the column from the front.
  - **Screens:**
    - The platen and frame were two detached groups before; they are now one connected group.
    - The only detached part is the documented bed block.
    - After the taper there are no slivers or lips, and coincident faces are 0.
  - **Test:** `toggle-press-frame` now asserts two ears, each wrapping its column with a vertex bore clearance of 0.003–0.005, riding on the plain shaft, and clear of every other fixed part. The other platen parts still clear the frame at 721 poses.
  - **Test:** the 132 models test also passes.
  - **Captures:** `tiles/132.png`, `z132/ears.png`.
  - **Ledger row:** reasonable; "". Limits, replace "the platen hangs from the lower disc with no guide" with: "p96: each platen end carries a bored guide ear wrapping its round column (0.004 running clearance)".
- **136: coincident valley floor** (`authored-cams.js`).
  - **Change:** the base disc's front face now stops 0.003 short of the tooth ring's valley floor, and the ring's walls run down into the base by the same amount. The valley floor and the follower law are unchanged.
  - **Screens:** coincident faces 0 (was 0.089); disconnected parts clean.
  - **Tests:** axial-cam-proportions, axial-cam-spring-hardware and spherical-face-follower pass. The 136 models test is updated for the base recess and passes.
  - **Capture:** `tiles/136.png`.
  - **Ledger row:** reasonable; "". Limits, append: "p96: the base face sits 0.003 below the valley floor, so the two no longer z-fight."
- **148: open tail eye** (`geared-crank-frame.js`).
  - **Change:** the short arm now ends in a solid round boss, where the open ring used to show the background.
  - **Reports:** `148-complete-teeth`, `148-frame-assembly` and `148-assembly` are regenerated (257, 65 and 65 poses; 0 overlap and 0 failing pairs).
  - **Stale script:** `scripts/review-geared-crank-frame.mjs` was already broken at HEAD, because the part `oblong-rocking-frame` it reads no longer exists. So `148-rocking-frame.json` stays historical.
  - **Tests:** geared-crank and geared-crank-frame pass.
  - **Capture:** `z148.png`.
  - **Ledger row:** reasonable; "". Limits, append: "p96: the lever's short arm ends in a solid boss."
- **151: hairline sleeve and nut tongues** (`opposed-screw-nuts.js`, `source-presentation.js`).
  - **Sleeve:** the 0.0006-thick brass sleeve (the hairline arc) is gone. The upper bearing is bored straight to a 0.0015 running fit, so no background or worm shows round the shaft end.
  - **Tongues:** the production view already removes the rear nut guides, so the tongues were bare protrusions. `nut-guide-tongue-N` is now removed in the presentation as well.
  - **Lip flag (existing):** the disconnected-parts screen reports one lip. It is the plain middle shaft (r 0.21, as Brown draws it) over the thread core (r 0.135). The step is intended, and my change did not touch it.
  - **Faceting:** not changed. The black shaft that shows is the 192-segment turned journal, and the flagged 20.8° edges are the worm's intended thread creases. The band is specular highlight, not facets.
  - **Reports:** `151-assembly` (17 poses, 0 failing pairs) and `151-render-contact` are regenerated. `151-indicator-browser.json` is an e2e record whose hash was already stale at HEAD; it is left alone.
  - **Tests:** opposed-screw-nuts passes 4/4.
  - **Captures:** `tiles/151.png`, `z151/after.png`.
  - **Ledger row:** reasonable; "". Limits, append: "p96: the bearing is bored straight to the journal (no brass sleeve) and the undrawn nut guide tongues are not shown."
- **168, 169: rear stays** (`variable-radius-crank.js`, `linked-variable-crank.js`).
  - **Change:** removed the stays, 0.3 square and 1.05 long, that ran back from each bearing and from the fulcrum to flanges on an undrawn wall. They were what the audit read as the long rear shafts with collars. They joined nothing to each other. Each fixed pivot now ends in its own slim flanged bearing, seen end-on.
  - **Reports:** `168-solid-clearance` and `169-solid-clearance` are regenerated (129 poses each).
  - **Tests:** the variable-radius-crank-motion and linked-variable-crank-motion tests pass.
  - **Captures:** `tiles/168.png`, `tiles/169.png`.
  - **Ledger rows:** reasonable; "". Limits, append: "p96: the rear stays to an undrawn framing wall are removed; each pivot ends in its own flanged bearing."
- **145** (linkages sub-lane): the beam's pivot end is now a semicircle concentric with the pivot. `145-assembly.json` is regenerated. Limits, append: "p96: the beam's pivot end is a semicircle concentric with the pivot (Brown breaks the bar off there)."

## Gears sub-lane: 117 (medium) and 113, 116, 118, 122, 125 (low)

Production for these IDs loads the MuJoCo visuals in `src/simulation/mujoco-*/`, not `authored-gears-core.js`. That file is unchanged, so none of the reports that fingerprint it are affected. The evidence is in `/dev/shm/p96/fb/gears/notes.md` and the captures are in `gears/tiles/`.

- **117: friction rollers (fixed)** (`mujoco-roller-yoke/geometry.js`).
  - **Change:**
    - Each roller now sits between two identical fork cheeks, one on each face.
    - The pin runs through both cheeks (z −0.31…0.31).
    - Each crossbar is one T-plan extrusion. Face-on it is the same bar as before; a tongue runs back between the fork feet to carry the rear cheek.
  - **Clearance:** the cam never comes within 0.44 of the bars.
  - **Rebake:** 117 was rebaked (round trip 0.0048 px). The physics XML is unchanged. The yoke's inertia changed, so the passive lower roller now turns 17.2 rad per loop instead of 13.2.
  - **Test:** `mujoco-roller-yoke` passes 6/6, with new cheek, bar and pin assertions.
  - **Screens:** 0 detached, 0 slivers or lips, 0 coincident faces.
  - **Captures:** `gears/tiles/117.png`, `gears/z117-after.png`.
  - **Ledger row:** reasonable; "". Limits, append: "p96: each roller is carried between two identical fork cheeks on a T-plan crossbar tongue running back through the roller's depth; the tongue is hidden face-on but visible from the top."
- **113: rollers and rack teeth.**
  - **Rollers (fixed):** both support rollers now carry the quadrant cue (`src/data/rotation-indicators.js`).
  - **Rack teeth (not changed):** I disagree with the audit here. The rack is the 20° involute rack conjugate to the pinion, as the rulebook requires, and Brown's square teeth are drawing shorthand.
  - **Ledger row:** reasonable; "". Limits, append: "rack flanks are the 20° involute rack conjugate to the pinion (Brown draws square shorthand)".
- **116: stems and pawls.**
  - **Stems (fixed):** on the plate the stem radii are 0.195 and 0.166. The right stem is now a plain r 0.166 rod, so the ratio is 1.17 instead of about 2. 116 was rebaked (round trip 0.010 px).
  - **Pawls (not fixed):** widening the crescents broke the native speed test (output left its ±0.08 band), so the change was reverted. It needs the pawl inertia and seat retuned.
  - **Ledger row:** minor. visibleFlaws: "pawl crescents narrower than Brown's (mid-width about the eye diameter against about 1.25×)".
- **118: rack base ends (fixed).** Both upper corners of the fixed rack base are now the same r 0.16 arc. The rebake left the asset byte-identical. Ledger: reasonable; "".
- **122 and 125: rod colour (fixed).** All the connecting rods and their eyes are steel grey (`PALETTE.muted`). Both were rebaked; only the provenance changed. Ledger: reasonable; "".
- **Tests:** roller-yoke 6/6, rack-pinion 6/6, rack-rectifier 7/7, stroke-doubler 6/6, variable-traverse 6/6 and cascaded-traverse 5/5.
- **Shared-tree hazard:** at 09:56:16 lane p96-fd ran `git stash && … && git stash pop` on the shared tree. The gears sub-lane rebaked everything after the pop. I checked that the 092 provenance hashes match the current sources.


## Deferred and not done
- **Low findings still open from the gears sub-lane:** 116's pawl width (needs a dynamics retune) and 113's square rack teeth (declined; see above).
- **Not attempted this pass:** 87, 99, 102/103, 107, 109, 110, 111, 147, 150, 152, 154, 161, 164 and 166/153. None is both quick and clearly right: several need retiming, the shared `helicalThread` helper, or new extrusions.
- **90/91 and 128** (`authored-cams.js`): not attempted.
- **Test failures owned by other lanes:**
  - `source-presentation.test.mjs` fails on 407's `mirrored-right-half-completing-pointed-arch`, which is in `authored-pointed-arch-instruments.js` (p96-fe).
  - `rotation-indicator.test.mjs` fails on 265's cone cue, which is in `authored-cone-friction-drives.js` (p96-fd).
- **Report changed by another lane:** `docs/validation/429-mating-contact.json`.
