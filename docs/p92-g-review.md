# Pass 92, lane g: smoothness (192, 195, 201, 203) and the faceting screen

Scratch, captures and screen output are in `/dev/shm/p92/g/` (outside Git). The screen output is `/dev/shm/p92/faceting.json`.

The user's complaints:
- 195: pixellated wheel (`/dev/shm/p92/75.png`)
- 201: potato-shaped eccentric gear
- 203: low-poly curved arm and a notched straight arm (`76.png`)
- 192: low-poly, badly shaded pinion (`73.png`)

Sub-lanes did 195, 201 and 203. Their full notes are in `/dev/shm/p92/g/{195,201,203}/notes.md`.

## Shared fixes

### Smooth extrusion helper
The new `src/simulation/smooth-extrusion.js` provides three functions:
- `smoothShadeExtrusion`: welds an extrusion by position and re-creases its normals. Walls stay smooth; caps and real corners stay sharp.
- `smoothExtrudeGeometry`: a flat extrusion with those normals.
- `involuteSpurOutline`: the exact external involute outline. It has finely sampled involutes, tip and root arcs concentric with the gear, and the same radii and tooth thickness as `primitives.makeGear`, but no chord polyline.

192, 201 and 203 use it.

### Load-time facet smoothing
This is in `src/simulation/crease-normals.js`: `smoothFacetNormals`, called from `creaseNormalsIn`, which every model passes through in `applySourcePresentation`.
- **The cause.** three's `ExtrudeGeometry` is non-indexed and gives every side triangle its own normal. Every extruded arc, involute, fillet and spline therefore shaded as a row of flat bands; the screen found this in 299 movements.
- **What it changes.** The pass rewrites only the `normal` attribute. Positions, UVs, groups, index and vertex count are unchanged. It applies to non-parametric geometry that is drawn fully flat and has one vertex per face corner.
- **The rule.** A corner averages the faces round its vertex that it reaches across smooth edges. An edge counts as smooth when it is under 25° and either:
  - under 4° (invisible either way), or
  - both faces are narrow across it (under 6% of the part's size), meaning a sampled curve.
- **What stays sharp.** Long flat walls meeting at a real kink, caps (90°), chamfers and polygons of 12 or fewer sides.
- **What is left alone.** Geometry with authored shared-vertex normals, `flatShading` materials and three's parametric generators.
- **Cost.** About 1.4 µs per triangle at load, for example 143 ms for movement 038's 98k extruded triangles.
- **Evidence.**
  - `/dev/shm/p92/g/ab/z38AB.png` compares 038's gear flank and fillet before (banded) and after (smooth), in the same view.
  - `ab/ab-{27,38,80,110,134,236,300,311}.png` are A/B default and rotated views with no visible regression.

## 192: pinion
- **Change** (`src/simulation/reversing-mangle-guides.js`, shared by 192–194):
  - The factory pinion was a `makeGear` chord polyline: 7 straight segments per flank and flat chords across tips and roots, with flat-shaded sides.
  - It is now the exact involute outline (`involuteSpurOutline`, same parameters): 48 samples per flank, a 24-sample tip arc and a root arc.
  - It is one flat extrusion over the same depth, with flat end faces, smooth flanks and creased tip, root and cap edges.
- **Cavities.** `scripts/generate-reversing-mangle-cavities.mjs` now cuts the complementary cavities (192, 193) with this exact outline, read from `userData.pinionOutline`. `src/simulation/baked/reversing-mangle-cavities.js` is regenerated.
- **Captures.**
  - Before: `before/tile-192.png`, and `z192a.png`/`z192b.png` (banded flanks).
  - After: `after192/tile-192.png`, and `z192a-after.png`/`z192c-after.png` (smooth flanks, flat faces, crisp edges).
- **Tests.** These pass 22/22:
  - `tests/reversing-mangle-finite-guides.test.mjs`. The regenerated cavity clears and stays engaged through both reversals: 192 min 0.00032 and max 0.0022; 193 min 0.00030 and max 0.0020.
  - `tests/movement-192.test.mjs`
  - `tests/movement-193.test.mjs`
- **Screens for 192–194.**
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. The near-miss counts are the existing running clearances.
  - Coincident faces: 0.
  - Loop seams: 0.
  - Faceting: 0 flags.
- **Proposed ledger row (192):**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits, append: "p92: the pinion is the exact involute (finely sampled flanks, tip and root arcs) with flat faces and creased edges; the tooth cavity is re-cut with it."

## 203: arms (sub-lane)
- **Change** (`src/simulation/authored-linkages.js`, 203 only):
  - **Curved slotted arm.** Brown's ideal construction replaces the traced 110-point ink polyline, sampled every half degree:
    - the limb is concentric with the slot;
    - the lobe is concentric with the pivot;
    - tangent fillet and bay arcs join them.
    - It lies within about 2 px of the ink (`203/js-overlay.png`).
  - **Straight arm.** This is now one flat plate of even thickness: a pivot eye, a tangent strap and a pin eye.
    - The "notches" came from the square corners poking out of the round boss and from two separate raised bosses. The bosses are removed.
  - The pivot shafts and follower pin have 96 sides. The slot, the pin clearance and the motion are unchanged.
- **Reports.** `docs/validation/144-assembly.json` and `145-assembly.json` hash `authored-linkages.js`, so both were regenerated.
  - Both keep 65 poses with 0 failing pairs.
  - Their part and pair counts changed because the saved hash was already stale for earlier 144/145 changes, not because of this edit.
- **Captures.**
  - Before and after tiles: `203/before-tile.png`, `203/after-tile.png`.
  - `203/za-pinback.png` is the 76.png view: a smooth arc and a plain plate.
  - `203/za-strap.png` shows the strap-to-eye join with no notch.
- **Tests.** `tests/movement-203.test.mjs` gained a test for single smooth plates and a tangent-continuous outline. `tests/slot-family-clearance.test.mjs` also passes (9/9 together).
- **Screens.** Disconnected parts, coincident faces, loop seams and body intersections are all 0.
- **Proposed ledger row (203):**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits, replace: "The pin works only the first ~110° of the slot; stroke timing follows the official animation. p92: the hooked arm is Brown's ideal construction (limb concentric with the slot, lobe concentric with the pivot, tangent fillet and bay arcs, ≈2 px from the ink) finely sampled with smooth-shaded walls; the straight arm is one flat plate (pivot eye, tangent strap, pin eye) with no raised bosses."

## 201: irregular gear pair (sub-lane)
- **Plate.** Brown draws an irregular oval of 18 teeth, with its shaft near the upper-right end, meshing with an 8-tooth pinion on the rocking arm. The old model was an eccentric 16-tooth circle, so it read as a potato.
- **Pitch curve.** `scripts/trace-irregular-gear-201.py` traces a smooth closed curve from the plate: a 5-harmonic fit, 0.61 px RMS. The stretch the pinion hides is set by a tangency constraint.
- **Motion.** The new `src/simulation/irregular-gear-201.js` makes the pinion roll without slip on that curve, at the fixed arm length. That gives 18/8 pinion turns per driver turn. The arm swings 0.255 rad (0.26 before), so the belt, slot arm and rod A are unchanged.
- **Teeth.** `scripts/generate-irregular-gear-profiles.py` generates them by cutting with the rendered involute pinion at 8193 poses.
  - A 0.002 morphological opening removes the per-pose cusps; it can only remove material.
  - The baked outline (`generated-irregular-gear-profiles.js`) has 2499 points and no zigzags.
- **Rendering.** Both gears use `smoothExtrudeGeometry`.
- **Reports.** These were regenerated at the end (see Reports below):
  - `docs/validation/191-196-201-contact.json` (513 poses): 201 has 0 overlap and a running gap of 0.00071–0.00081 at every pose.
  - `200-226-bevel-solids.json` (33 poses) and `202-264-worm-solids.json` (33 poses): only a source hash changed.
- **Tests.** `tests/movement-201.test.mjs` and `tests/irregular-gear-family.test.mjs` were rewritten and pass 12/12.
- **Screens.** All 0 except 8 near-misses, which are the existing roller and rod clearances in the slot eye.
- **Captures.** `201/compare-gears.png` (plate, before, after), `201/tile-after.png` and `201/z-mesh.png`.
- **Proposed ledger row (201):**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits, replace: "Brown's irregular 18-tooth gear is a traced smooth closed pitch curve (5-harmonic fit, 0.6 px RMS; the stretch hidden by the pinion is inferred from a tangency constraint). Its teeth are generated by the rolling 8-tooth involute pinion, conjugate by construction (0.0008 running gap at 513 poses). The motion is prescribed rolling kinematics, not loaded transfer. Tooth tips are slightly narrower than Brown's square teeth. The plate's hub washer round the driver shaft is not modelled. The eccentric-gear bore is a 0.003 fit on its shaft."

## 195: face wheels (sub-lane)
- **Cause.** Each tooth sector of the two face wheels was a 25×65 polar height grid. It was baked by rasterising the triangulated worm over 2400 phases and then min-filtering the result 3×3. The near-vertical walls and cliffs of the tooth spaces turned into stair steps on every land edge and flank, which is the jagged look and shadow in 75.png.
- **Change: the generator** (`scripts/generate-face-worm-195.mjs`, rewritten).
  - It evaluates the analytic straight-flanked thread, grown by the 0.0035 running clearance as a true offset.
  - It takes the exact lower envelope over the synchronised phases: 0.04-rad samples, then golden-section refinement, in worker threads.
  - The grid is 133×112 per sector. For every grid edge it bakes the exact land and cliff crossings, bisected to 1e-9.
  - To keep the clearance, heights are lowered by at most 0.012. The lowering is spread as a smooth bump (radius 0.008), so no point gets less than it needs and neighbours stay at matching depths.
  - `--check` reproduces the bake.
- **Change: the geometry** (`faceWorm195Geometry` in `src/simulation/feed-worm-assembly-parts.js`).
  - Each cell is split along its baked crossings, so land edges and cliff walls follow the true curves.
  - Plain cells split along the flatter diagonal.
  - The top land is flat at z = 0.
  - The cut surface has smooth normals up to 80°, walls crease at 40°, and real edges stay sharp.
  - The rim and bore are true cylinders, and the sector is closed.
  - The sector is built once per model and cloned for the lower wheel.
  - `src/data/face-worm-195.js` was regenerated (132 KB, was 15 KB).
- **207 fix, same file.** Each 207 wheel hub was bored 0.093, the same as the generated worm wheel's own bore, which made coincident bore walls (2 flagged coincident pairs).
  - The hub bore is now 0.096, buried in solid metal inside the wheel; the wheel keeps its 0.093 running fit on the 0.092 shaft.
  - After the change the coincident-face screen shows 0 flagged pairs, and the disconnected screen shows 0 detached, 0 near-misses and 0 slivers.
- **Reports**, regenerated after the last edit (17 poses each):
  - `docs/validation/feed-worm-195-solids.json`: sampled-flanks-clear, 0 penetrations. The minimum gap is 0.00274, against a design of 0.0035 and a test threshold of 0.002.
  - `feed-worm-195-working-faces.json`: 0 missing, maximum working gap 0.0030.
  - `feed-worm-207-working-faces.json`: 0 missing.
- **Tests.** `tests/feed-worm-assembly.test.mjs` asserts the grid, the crossings, closedness, outward volume and normal agreement. Together with `movement-195`, `movement-207` and `feed-worm-wheel` it passes.
- **Screens for 195.**
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. The 4 near-misses are running clearances.
  - Coincident faces: 0.
  - Loop seams: 0.
  - Body intersections: 0.
  - Faceting:
    - The wheels went from `jagged-surface` (437 faces per sector, cluster 91) to unflagged for jaggedness.
    - They keep a `smoothed-crease` flag: 108 edges up to 72°, which is the curved flank foot, smooth by design.
    - The worm's own `jagged-surface` flag (61 faces) is an unchanged residual; see the deferred list.
- **Captures.**
  - `195/cap/ba-{a,e,f}.png`: before and after, 75.png-like zooms.
  - `195/cap/v13-{a,e,f}.png`: the streak follow-up.
  - `after195/tile-195.png`: plate and views.
- **Residuals.**
  - About 31.7k triangles per sector, roughly 1.5M for both wheels (instanced, about 10× before). Building one sector takes about 0.22 s at load.
  - Cells at the foot of a cliff sit up to 0.0027 above the exact cut, still at least 0.0027 normal clearance to the worm.
- **Proposed ledger row (195):**
  - assessment: minor. The earlier scalloped-spaces flaw is not re-reviewed here.
  - visibleFlaws: keep the existing text.
  - limits, replace the "…tooth gap is 0.0035 (the disconnected screen skips instanced teeth)." sentence with: "p92: the face teeth are the exact offset envelope of the analytic worm thread, split along baked land and cliff crossings (no grid stair steps), with smooth creased normals; sampled worm gap ≥0.0027 (design 0.0035), the chords lowered ≤0.012 by a smooth bump to keep it; ≈1.5M instanced triangles for both wheels."

## 191, 196, 205, 209, 221, 223: stair-stepped generated gear envelopes (screen hits, fixed by sub-lane)
The new zigzag test in the screen, and the 201 sub-lane, found the same stair-step flaw in every baked envelope cut by a swept cutter. Each cutter pose leaves a cusp, the cusps alternate direction, and the flanks and roots render striated.

- **Method.** A morphological opening (0.002) removes the cusps and can only remove material. A Douglas-Peucker simplify of 1e-4 follows, which is inside the 0.0008 cutter clearance.
  - It lives in `scripts/generate-irregular-gear-profiles.py` for 191, 196 and 201, and in the shared `scripts/smooth_profile_ease.py` for 205, 209, 221 and 223.
  - For 209 and 223 the opening alone was not enough, so their generation poses were raised from 4097 to 32769 (`export-205-209-contact.mjs`, `export-variable-idler-contact.mjs`). Audit pose counts are unchanged.
  - The builders use `smoothExtrudeGeometry`: `irregular-gear-family.js`, `variable-drive-205-209-parts.js`, `variable-idler-gear-parts.js` and `variable-sector-parts.js`.
- **196 bore fix.** The 196 pinion bore wall coincided with its hub tube's bore. The pinion bore is now 0.090, buried in the hub tube (coincident faces 0).
- **Zigzags** (vertex pairs turning in opposite directions), before → after:

  | Outline | Before | After |
  |---|---|---|
  | 191 | 9192 | 3 |
  | 191 driver | 9054 | 3 |
  | 196 | 1928 | 0 |
  | 205 cam | 98 | 5 |
  | 209 | 7497 | 2 |
  | 221 | 2962 | 0 |
  | 223 | 310–422 per sector | 6–8 per sector |

  What remains is the eased corners of intentional steps: 191's reset step, 205's lobe tip and 223's relief shoulders.
- **Stale bake.** The committed 205 cam bake was already stale against its generator: 410 points on disk against 338 from a rerun.
- **Reports**, regenerated with their pose counts:
  - `191-196-201-contact.json` (513 poses each), 0 overlap:
    - 191: gap 0.0026–0.0095
    - 196: gap 0.0006–0.0009
    - 201: gap 0.0007–0.0008
  - `205-208-209-contact.json` (513 poses, 208 at 167): 0 overlap. 209's maximum gap is 0.00079, was 0.00072.
  - `221-222-223-contact.json` (513, 513, 538 poses): 0 penetration.
  - `200-226-bevel-solids.json` and `202-264-worm-solids.json` (33 poses): only the source hash changed; results are identical.
- **Tests.** These pass:
  - movement-191, movement-196 and irregular-gear-family (a new zigzag test)
  - movement-201, movement-205 through movement-209, movement-221, movement-222 and movement-223
  - stepped-sector-contact, variable-drive-205-209-solids and variable-idler-solids
  - bevel-200-226-solids and special-worm-solids
- **Screens.**
  - Faceting: 0 for 191, 196, 201, 205, 209, 221, 222 and 223.
  - Coincident faces: 0 on all changed ids.
  - Disconnected parts: no new detached parts. 196's pinion-B bearing group and 208's group already existed and are running clearances.
  - Loop seams: clean, except 191's documented sudden speed reset.
- **Captures.** In `/dev/shm/p92/g/201/`: `z191-before-after.png` and `z205-223-before-after.png`.
- **Proposed ledger rows.**
  - 191: limits, append: "p92: baked scroll envelopes smoothed (opening 0.002 + 1e-4 simplify) and smooth-shaded; 513-pose audit still 0 overlap, gap 0.0026–0.0095."
  - 196: limits, append: "p92: wheel envelope smoothed and smooth-shaded; pinion bore buried in its hub tube (no coincident bore walls); 513-pose audit 0 overlap, gap 0.0006–0.0009."
  - 209, 223: visibleFlaws, drop any banded or striated tooth-root entry; limits, append: "p92: generated envelopes smoothed (0.002 opening, 1e-4 simplify, 32769 generation poses) and smooth-shaded; contact audit still 0 overlap."
  - 205, 221: the same limits note. The change is barely visible, so there is no assessment change.
  - 207: limits, append: "p92: wheel hub bore widened to 0.096 so it no longer coincides with the generated wheel's 0.093 bore (coincident faces 0)."

## 474: boiler bowl (screen hit, fixed)
- **Change.** The screen ranked 474's boiler among the worst hits: 1792 hard 20° edges covering 120k px². The shell was turned from a 6-knot polyline.
  - `src/simulation/authored-aeolipiles.js` now turns it from a centripetal Catmull-Rom spline through the same knots, sampled at 64 points.
  - The end knots are unchanged, so the rim stays flush under the lid.
- **Result.** The faceted area fell from 120724 to 6338 px²; what remains is the rim and bottom corners.
- **Tests.** `tests/thermal-steam-469-474-solids.test.mjs` passes 5/5.
- **Screens.** Disconnected parts: 0 detached. The 2 slivers are unchanged handle roots. Coincident faces 0, loop seams 0.
- **Ledger.** No row change is proposed. This is a shading refinement with no change to the drawn shape.

## Faceting screen (`scripts/screen-faceting.mjs`)
**Usage.** `node scripts/screen-faceting.mjs --ids=1-507 --jobs=16 --out=/dev/shm/p92/faceting.json`. It loads production models through `model-loader`, so source presentation and the load-time normal pass are included. A full run takes about 25 s on 16 jobs.

**What it checks.** Every visible mesh is welded by position at phase 0. Each geometry is analysed once. Pixel measures assume the fitted bounding diagonal spans 700 px.
- **faceted.** Hard-shaded edges at 0.75–25° whose facets are at least 1.5 px wide: a curved surface drawn as flat bands. A mesh is flagged when the largest angle is ≥2° and the banded area exceeds 400 px².
- **low-poly.** Smooth-shaded edges whose chord error (facet width × angle / 8) exceeds 1 px, plus parametric rounds (cylinder, torus, tube, sphere, lathe…) stepping more than 40°.
- **smoothed-crease.** Smooth-shaded edges sharper than 40° on non-parametric geometry, i.e. flat faces shaded as one dome. Flagged when they total more than 40 px.
- **staircase-outline and zigzag-outline.** These test 2D extrusion outlines (`parameters.shapes` or `userData.outline`).
  - Staircase: runs of 6 or more short segments whose turns alternate near ±90°, when at least 25% of the short segments are axis-aligned. The axis rule keeps knurls and square teeth, which follow the part's own radii, out.
  - Zigzag: 20 or more sharp turns (over 20°) that reverse at the next vertex, on segments under 0.5% of the outline extent. These are a swept cutter's per-pose cusps or raster noise.
- **jagged-surface.** Small faces tilted 15–80° against two neighbours across non-parallel edges (spikes and steps, e.g. the steep wall of a height grid). Flagged at 30 or more such faces making up at least 1% of the mesh.
- **Exemptions.**
  - Chamfer corners of bevelled extrusions are exempt from the jagged test.
  - Laid-rope strands are exempt from the jagged and smoothed-crease tests.
  - Sculpted figures (hand, fist, cuff, forearm, horse, person…) are scored separately as `figureScore`.
  - Fluids are skipped, as in the disconnected screen.

**Checks.** I checked the classifier against known cases with scratch scripts (`/dev/shm/p92/g/synth*.mjs`, `zz.mjs`). `tests/crease-normals.test.mjs` also calls its `analyseGeometry`. It separates:
- the old 192 `makeGear` pinion: faceted, 14°
- a 16-sided cylinder: low-poly, 2.7 px
- a smooth-shaded box: smoothed-crease, 90°
- the old 195 height grid: jagged-surface
- the old 191 bake: 9190 zigzags
- a 40-step stair: a staircase run of 79

**Before and after.**
- The first full run, before the load-time normal pass and with the same edge classifier, flagged `faceted` in 299 movements. After the pass, 121.
- The final run (`/dev/shm/p92/faceting.json`) flags 186 movements:

  | Flag | Movements |
  |---|---|
  | faceted | 118 |
  | smoothed-crease | 62 |
  | jagged-surface | 17 |
  | low-poly | 15 |
  | zigzag-outline | 11 |
  | staircase-outline | 0 |

- Figures scored apart: 012, 014, 015, 016, 017, 018, 019, 020, 021, 022, 247, 353, 376, 377, 420, 466.
- The complaint IDs (192, 195, 201, 203) and the fixed hits (191, 193, 194, 196, 205, 209, 221, 222, 223) now score 0, except 195's smooth flank foot and worm.

**Triage.** The views are in `/dev/shm/p92/g/tri/sheet{1..5}.png` and `/dev/shm/p92/g/scr/`. Most remaining `faceted` hits are designed kinks between wide flat faces, such as tapered levers, polygonal castings and stones. A kink can't be told from a coarse arc without judgement, so treat this list as triage, not a verdict.

### Hit list (top 40 of the final run)
| Rank | ID | Score | Flags | Worst mesh | Triage |
|---|---|---|---|---|---|
| 1 | 054 | 200.72 | smoothed-crease, jagged-surface | `(unnamed BufferGeometry)` | default and rotated views clean; the flagged unnamed mesh was not isolated. Not assessed. |
| 2 | 483 | 177.47 | jagged-surface, smoothed-crease, faceted | `fixed-duct-from-seat-port-to-A-outer` | checked: duct walls read clean in default and zoomed views. Likely screen noise on curved sheet-metal ducts. |
| 3 | 435 | 98 | smoothed-crease | `water-sheet-through-guide-passage-1` | fluid water sheets (smoothed creases in translucent flow). No change. |
| 4 | 237 | 94.2 | faceted | `axial-sawtooth-on-crown-ratchet` | real: flat-shaded planar chord teeth on a round crown (intentional flatShading). Deferred: 237 pawl contact and its baked return depend on this exact tooth geometry. |
| 5 | 357 | 81.17 | jagged-surface, low-poly, smoothed-crease | `spring-L-coil` | tight helical coil (tube). Reads fine at normal zoom. |
| 6 | 074 | 77.69 | faceted | `driverCBody` | checked zoom: bevel bodies read clean. Hard edges are the tooth-body junctions. |
| 7 | 477 | 73.63 | faceted, smoothed-crease | `rigid-hollow-upper-stem-of-valve-D` | real, mild: banding on the sectioned valve stem. Deferred (not in this lane's files). |
| 8 | 295 | 72.9 | low-poly | `wedge-pallet-head` | not visually triaged |
| 9 | 434 | 72.16 | smoothed-crease | `water-sheet-through-guide-passage-1` | fluid water sheets. No change. |
| 10 | 190 | 65.53 | faceted | `fixed-central-fulcrum-standard-and-lower-threade` | real: a coarse polygonal fulcrum standard. Deferred: authored-clamps.js is claimed by p92-h. |
| 11 | 368 | 62.64 | smoothed-crease, jagged-surface, faceted | `cylinder-receiving-described-spiral-line` | spiral-line cylinder. Not assessed. |
| 12 | 037 | 62.2 | jagged-surface | `(unnamed BufferGeometry)` | mild: a slightly wavy crease line on the fluted cone at close zoom. Deferred. |
| 13 | 499 | 60 | smoothed-crease | `closed-metal-back-of-gauge-case` | checked: the gauge case reads clean. |
| 14 | 259 | 52.12 | faceted, jagged-surface | `true-periodically-notched-v-grooved-pulley-body` | checked: the pulley reads clean. |
| 15 | 311 | 52.08 | faceted | `front-ABC-locking-leg-A` | kinked leg outlines (designed polygon corners). Not assessed further. |
| 16 | 466 | 51.41 | faceted, smoothed-crease | `sectioned-ram-cylinder-casting` | mild. Not changed. |
| 17 | 494 | 48.66 | faceted | `source-profiled-lifted-stone` | irregular stone, faceted by design. |
| 18 | 482 | 48.43 | faceted, smoothed-crease | `round-domed-lid-shell` | checked: the lid shell reads clean. |
| 19 | 326 | 46.97 | faceted | `hollow-standard-side-walls-open-at-the-cap` | mild coarse arcs on the frame standard. Deferred. |
| 20 | 436 | 46.15 | faceted, smoothed-crease | `fixed-bridge-carrying-step-c-across-trunk-b` | not visually triaged |
| 21 | 141 | 45.26 | smoothed-crease, faceted | `continuous-blade` | checked: the pedestal flanks are designed kinks. |
| 22 | 358 | 41.99 | jagged-surface | `historically-profiled-sureda-fusee-body` | not visually triaged |
| 23 | 132 | 41.2 | faceted, smoothed-crease | `fixed-column-guiding-and-supporting-press` | not visually triaged |
| 24 | 373 | 40.86 | faceted | `fixed-base-load-in-source-loaded-wagon` | not visually triaged |
| 25 | 385 | 40.27 | jagged-surface | `s-hook-from-apex-pin-to-weight-eye` | not visually triaged |
| 26 | 314 | 40 | zigzag-outline | `crescent-pallet-plate-with-locking-only-pallets-` | not visually triaged |
| 27 | 400 | 40 | jagged-surface | `preloaded-carrier-return-spring-pushing-bar-A-re` | not visually triaged |
| 28 | 492 | 40 | jagged-surface | `tackle-lower-block-shell` | not visually triaged |
| 29 | 491 | 38.67 | faceted, low-poly | `fixed-deck-under-capstan` | not visually triaged |
| 30 | 307 | 35.24 | faceted | `long-outer-locking-tooth-only` | not visually triaged |
| 31 | 038 | 33 | zigzag-outline | `(unnamed ExtrudeGeometry)` | not visually triaged |
| 32 | 421 | 31.6 | faceted | `fixed-cylinder-head-half-around-trunk-opening` | not visually triaged |
| 33 | 279 | 31.51 | faceted | `source-profiled-crosshead-yoke-body` | not visually triaged |
| 34 | 472 | 30.57 | faceted, low-poly | `hollow-frame-reservoir-C` | not visually triaged |
| 35 | 287 | 30.02 | smoothed-crease | `inextensible-compound-curved-flat-leaf-spring-1` | not visually triaged |
| 36 | 474 | 29.29 | faceted, smoothed-crease, jagged-surface | `fixed-sealed-lower-steam-boiler` | fixed in this lane (boiler bowl). The residual is the rim and bottom corners. |
| 37 | 336 | 27.47 | faceted | `slotted-tapered-rigid-side-lever-body` | not visually triaged |
| 38 | 031 | 26.55 | smoothed-crease, faceted | `(unnamed BufferGeometry)` | not visually triaged |
| 39 | 128 | 25.29 | faceted | `body:frame` | not visually triaged |
| 40 | 104 | 25.14 | smoothed-crease, faceted | `wheel` | not visually triaged |


### Deferred
- 190: coarse polygonal fulcrum standard. `authored-clamps.js` is claimed by p92-h.
- 183, 184: faceted handle quadrant, wing and arm outlines. The catch files are claimed by p92-c.
- 237: flat-shaded chord teeth on the round crown ratchet. The 237 pawl contact test and baked return use this tooth geometry, so a rebuild needs its own contact pass.
- 208: zigzag on the separate pin-slot outline, `generated-pin-slot-208.js`. Not changed.
- 195, 207: the worm's `jagged-surface` (61 faces) and the 207 feed-worm `faceted` flags. The worm is shared with other movements; not changed.
- 037 (wavy crease on the fluted cone), 314, 038, 229, 310, 312, 334, 360, 394 (smaller zigzag outlines), 477, 326, 466 (mild banding), and the low-poly rounds (e.g. 506, 468, 472). Not reached in this pass.
- `primitives.makeShaft` builds 22-sided shafts that read as polygons at close zoom on large radii. It is claimed by p92-r. 203 rebuilds its own two shafts at 96 sides.

## Reports
Regenerated, keeping pose counts; none has a `sourceCommit` field:
- `docs/validation/feed-worm-195-solids.json` (17), `feed-worm-195-working-faces.json` (17) and `feed-worm-207-working-faces.json`: rerun after the last edit to `feed-worm-assembly-parts.js`.
- `docs/validation/191-196-201-contact.json` (513 per movement).
- `docs/validation/205-208-209-contact.json` (513/513; 208 at 167) and `docs/validation/221-222-223-contact.json` (513/513/538).
- `docs/validation/200-226-bevel-solids.json` (33) and `202-264-worm-solids.json` (33): source hash only.
- `docs/validation/144-assembly.json` and `145-assembly.json` (65): they hash `authored-linkages.js`. Their part and pair counts changed because the saved hash was already stale for earlier 144/145 changes.
- `src/simulation/baked/reversing-mangle-cavities.js`: re-cut with the exact 192/193 pinion outline.

No report hashes `crease-normals.js`, `smooth-extrusion.js`, `reversing-mangle-guides.js` or `authored-aeolipiles.js`. A sweep of every `docs/validation` source hash against the changed files found only whole-file comparisons of reports that hash function slices, and those slices are current.

## Tests
One run of 38 files: authored-loader, crease-normals, loop-seams and source-presentation; every movement file for 191–196, 201–209, 221–223 and 474; and the reversing-mangle, irregular-gear, feed-worm, slot-family, rocking-beam, bevel, special-worm, stepped-sector, variable-drive, variable-idler and thermal-steam suites. 190 of 191 pass.

The one failure is `authored-loader` "all lazy routes preserve legacy geometry" on movement 064. It is not from this lane:
- 064 (`spring-jump-cam.js`, unmodified) builds different cam-plate normals on the first and second construction in a process, whichever loader goes first (`/dev/shm/p92/g/diff64.mjs`, `diff64r.mjs`).
- Neither loader path calls the new normal pass.

Earlier in the pass the loader tests also failed transiently while another lane had `quadrant-catch-finite-parts.js` mid-edit.

## Files changed by this lane
- New:
  - `src/simulation/smooth-extrusion.js`
  - `src/simulation/irregular-gear-201.js`
  - `scripts/screen-faceting.mjs`
  - `scripts/trace-irregular-gear-201.py`
  - `scripts/smooth_profile_ease.py`
  - `docs/p92-g-review.md`
- Shared rendering:
  - `src/simulation/crease-normals.js`: `smoothFacetNormals` in `creaseNormalsIn`
  - `tests/crease-normals.test.mjs`
- 192–194:
  - `src/simulation/reversing-mangle-guides.js`
  - `scripts/generate-reversing-mangle-cavities.mjs`
  - `src/simulation/baked/reversing-mangle-cavities.js`
- 195 and 207:
  - `src/simulation/feed-worm-assembly-parts.js`
  - `scripts/generate-face-worm-195.mjs`
  - `src/data/face-worm-195.js`
  - `tests/feed-worm-assembly.test.mjs`
- 191, 196 and 201:
  - `src/simulation/authored-gears-core.js`: `eccentricGearCarriedPinionRocker` and two imports
  - `src/simulation/irregular-gear-family.js`
  - `src/simulation/generated-irregular-gear-profiles.js`
  - `scripts/generate-irregular-gear-profiles.py`
  - `scripts/review-irregular-gear-profiles.mjs`
  - `scripts/review-irregular-gear-contact.mjs`
  - `tests/movement-201.test.mjs`
  - `tests/irregular-gear-family.test.mjs`
- 203:
  - `src/simulation/authored-linkages.js`: the 203 function
  - `tests/movement-203.test.mjs`
  - `tests/slot-family-clearance.test.mjs`
- 205, 209, 221 and 223:
  - `scripts/generate-205-209-profiles.py`
  - `src/simulation/generated-variable-drive-205-209.js`
  - `scripts/export-205-209-contact.mjs`
  - `src/simulation/variable-drive-205-209-parts.js`
  - `scripts/generate-elliptical-idler-profile.py`
  - `src/simulation/generated-elliptical-idler-profile.js`
  - `scripts/generate-stepped-sector-relief.py`
  - `src/simulation/generated-stepped-sector-relief.js`
  - `scripts/export-variable-idler-contact.mjs`
  - `src/simulation/variable-idler-gear-parts.js`
  - `src/simulation/variable-sector-parts.js`
- 474:
  - `src/simulation/authored-aeolipiles.js`
