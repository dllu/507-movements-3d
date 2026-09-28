# Pass 93, lane f: 195 triangle budget, deferred faceting items, 35's band

Scratch, captures and screen output are in `/dev/shm/p93/f/` (outside Git). The before captures are in `before/`, the after captures in `after/`, and the 195 A/B views (dense sector against the display sector, same camera) in `ab195*/`.

## 195: triangle budget

### Change
- **New offline bake**, `scripts/bake-face-worm-195-mesh.mjs` → `src/data/face-worm-195-mesh.js` (`--check` reproduces it).
  - It starts from the dense exact-envelope sector (`faceWorm195Geometry` over the p92 133×112 grid, 31,753 triangles) and simplifies it adaptively with half-edge collapses.
  - Every surviving vertex is a dense vertex; smooth vertices may also sink along their normal by up to `DOWN`.
  - **Acceptance test.** A collapse is accepted only if every dense sample it affects, cast along its own normal onto the new faces, meets three conditions. The samples are every dense face centre and every smooth dense vertex.
    - It stands at most 1e-5 proud of the dense surface. No material is added, which keeps the worm clearance.
    - At most `DOWN` = 4e-4 of material is removed.
    - The interpolated normal at the sample is within 4° of the dense normal there.
  - **Creases** (land edges, cliff and wall creases, rim) collapse only along themselves, within 1.5e-4 of their polyline. Crease junctions and the 3 zero-area junction edges are locked.
  - **Seams.** Both seam profiles are thinned identically in advance, so adjacent instances share vertices. No face may lie in a seam plane or duplicate an existing face. A first version doubled a side-wall triangle there and gave the solids BVH a false inside.
  - **Bore arcs** keep exactly one vertex every pitch/8. The lathed wheel centre is now 192-sided, with its corners on those vertices.
  - **Normals.** Each coarse corner takes the dense corner normal of the dense face lying in the direction the coarse face covers. Flats stay flat, flanks smooth and creases sharp.
- **Runtime.** `faceWorm195DisplayGeometry()` loads the baked mesh; production no longer builds the dense grid at load. `faceWorm195Geometry(data)` is kept for the bake and the tests, and now takes its data explicitly.
- **Fixed on the way: a pre-existing crack.** A crack ring showed at r 0.84 on the upper wheel face in the default view, the faint dotted circle. The old 64-sided centre lathe sat inside the teeth ring's true arc. With the 192-sided centre whose corners match the sector's bore arc, the ring is gone (`ab195c/ab-ring.png`).

### Numbers

| | Before (p92 dense) | After |
|---|---|---|
| Triangles per sector | 31,753 | 3,221 |
| Both face wheels (48 instances) | 1,524,144 | 154,608 |
| Whole 195 model (visible meshes) | 1,535,833 | 168,345 |
| Headless frame time, 200 renders at default view | 532 ms/frame | 54 ms/frame |
| Model load in page | 3.07 s | 0.50 s |
| Sector data file (gzip) | 27 KB | 47 KB |

The frame times are SwiftShader software GL at 960×720 with the shadow pass. `perf.mjs` renders 200 frames with a pixel readback each.

The production load now fetches only the mesh file. The dense data stays for the bake and the tests.

### Clearance
- **`docs/validation/feed-worm-195-solids.json`**, 17 poses: 0 penetrations, minimum gap 0.002754 on both sides. Before it was 0.002736; the design is 0.0035 and the requirement 0.0027.
- **Denser independent check** (`/dev/shm/p93/f/dense-solids.mjs`): the same sweep, but with 28 barycentric samples on every display triangle, about 5M queries per side. Minimum gap 0.002724, 0 penetrations.
- **Working faces**:
  - `feed-worm-195-working-faces.json`: 17 poses, 0 missing, maximum working gap 0.0030.
  - `feed-worm-207-working-faces.json`: re-hashed.
- **Report sources.** Both review scripts now also list `src/data/face-worm-195-mesh.js` and the bake script in their sources.

### Look
The dense-versus-display A/B views are indistinguishable, including the close zooms on flanks, cliffs and the lower wheel:
- `ab195/ab-*.png`
- `ab195b/ab-close2.png`
- `ab195d/sheet.png`
- `ab195e/sheet.png`

The beaded line along each cliff crease and the soft streaks on the worm root are present in the dense mesh too. With shadows off, the worm root is smooth (`before/w195-shadowtest.png`); the streaks come from the soft shadow of the teeth, not from the geometry.

### Faceting screen
- **Sector.** It now carries `jagged-surface` (213 small faces tilted against their neighbours, which is normal for an adaptive triangulation) and the same `smoothed-crease` as the dense mesh: 117 edges on faces about 0.003 wide at the flank foot.
- **Visible effect.** Neither shows in the A/B captures, because shading follows the dense normals.

### Tests and screens
- **Tests.**
  - `tests/feed-worm-assembly.test.mjs` has a new test. It checks:
    - fewer than 4,000 triangles per sector, and fewer than an eighth of the dense count;
    - 24 instances per wheel;
    - volume within 2e-4 of the dense sector;
    - at most 3 open edges;
    - no display vertex proud of the dense surface or deeper than the bake's `down`;
    - corner normals facing their faces;
    - bore vertices every pitch/8, and a 192-sided centre.
  - All pass, together with `movement-195`, `movement-207` and `feed-worm-wheel`.
- **Screens.** Disconnected: 0 detached (the 4 near-misses are running clearances). Coincident faces: 0. Loop seams: 0.

## Deferred faceting items from p92-g

### 190: fulcrum standard (`authored-clamps.js`)
- **Plate.** The standard has a rounded head, a flank sweeping into the lower arm, a lever with an arched back and a round shoe end, and a domed shoe.
- **Change.** Each of these is now one centripetal Catmull-Rom curve through the same traced points, instead of the chords between them:
  - the standard: head, right flank and fillet into the arm;
  - the holder cheeks: the round shoe end and the arched back to the nose;
  - the shoe: its dome and flared skirt.
- **Unchanged:** the straight left edge, the arm top, the nose, the bearing land, the sole, the bores and the motion.
- **Faceting.**
  - Standard: 16 hard edges at 22° (7,388 px²) before; 3 edges at 10° (2,787 px²) after, at the joins onto the straight edges.
  - Cheeks: 11 edges at 22° before; 2 edges at 20° after, at the nose corner.
  - Shoe: no longer flagged.
- **Captures:** `after/190-ba-zoom.png` (before above, after below) and `after/190-tile.png`.
- **Reports.** `authored-clamps.js` is hashed whole by the 174/180 reports.
  - Regenerated: `180-native-study`, `180-native-cycle`, `180-bake` with `baked/assets/180.json.gz`, `180-existing-contact` and `174-existing-contact`.
  - The native results are unchanged. The new `180.json.gz` differs from p93-fc's only in object UUIDs and the source hash.
  - The reports that hash the gz were then regenerated too: `180-dense-contact`, `180-assembly-clearance` and `180-source-fit`.
  - The packaged e2e `tests/e2e/single-clamp.spec.mjs` was rerun against a fresh build in a private dist and passed, so `180-browser.json` was re-hashed with a recheck note.
- **Tests.** `movement-190`, `clamp-190-thrust-support`, `movement-174`, `movement-180` and `single-clamp-baked` pass.
- **Screens.** Disconnected: 0 detached. Coincident faces: 0. Loop seams: 0.

### 237: crown-ratchet chord teeth (deferred)
The teeth are built in `authored-intermittent-core.js` (mine), but `crown-pawl-237-working-parts.js` is claimed by p93-fc. That file sets the teeth's `flatShading` and installs the 237 parts.

p93-fc's audit item for 237 (medium) covers the same teeth, "one toothed-ring extrusion flush with the cup", and also the pawl seating. The teeth, the pawl and the baked return must change together, so I released my claim on the return bake and left 237 to p93-fc. They can rebuild the teeth from the helper, which post-processes the model.

### 208: pin-slot zigzag
- **Generator.** `scripts/generate-208-pin-envelope.py` now applies a 0.002 morphological opening, which only removes material, before a 1e-4 simplify.
- **Result.** Zigzags on the outline fell from 80 to 16.
  - The remaining 16 are one eased junction per tooth, at r 0.905, where two pin rings' sweeps meet.
  - The faceting screen no longer flags 208.
- **Rejected alternative.** A 0.012 opening would have rounded the thin hooked tips, but those tips are the working teeth; it cut them away (`after/208-outline-ba.png` shows the 0.002 result).
- **Report.** `205-208-209-contact.json` regenerated: 167 pin-slot poses, 0 inside, maximum working gap 0.00176 (was 0.00166, threshold 0.003). The planar 205/209 part is unchanged.
- **Tests.** `movement-208` gained a zigzag test (at most 16). `variable-drive-205-209-solids` passes.
- **Screens.** No new flags. The coincident pair `common-three-ring-pin-wheel-face-disk` / `pin-wheel-input-hub` (both bored 0.072) is pre-existing and in `variable-drive-205-209-parts.js`, which p93-fc owns. It is not changed here.

### 195 and 207 worm flags (no change)
- **207 `faceted`: 48 edges at 7.5°.** These are the worm's 48-sided bore wall, which the shaft (r 0.092 in a 0.093 bore) fills, so they are not visible.
- **195 `jagged-surface`: 61 faces.** These are the clipped thread ends. Captures `before/worm-ends.png` show no visible jag at the ends.
- **Root streaks.** The root streaks seen at close zoom are soft-shadow noise; they disappear with shadows off (`before/w195-shadowtest.png`).
- **Why not changed.** `solid-worm.js`, `worm-gear-geometry.js` and `bored-worm-geometry.js` are shared with 202 and 264 and hashed by `202-264-worm-solids`.

### `makeShaft` 22-sided shafts (no change to `primitives.js`)
- **Shading.** `makeShaft` uses three's `CylinderGeometry`, which already carries smooth vertex normals, so the shading is smooth. Only the silhouette and the end caps are 22-gons.
- **Scan.** I scanned every production model for 22-sided cylinders: 309 cylinders in 113 movements. The worst chord sag at default framing is 0.41 px (movement 024's r 0.31 cylinders).
- **Decision.** Smooth normals are enough at default framing, so `primitives.js` is untouched and no fingerprinted report or bake moves.

### 038: stepped sector (`authored-gears-core.js`)
- **Cause.** The polar min-envelope (9,216 rays) left a sawtooth on the steep relieved flanks: 330 zigzags, cusps up to 0.0009.
- **New helper.** `src/simulation/outline-cusps.js` provides `trimOutwardCusps`. It cuts off sharp outward cusps between short segments, which only removes material.
- **Change.** The driven outline now goes through it (segments under 0.01). The chamfer clamp now finds each vertex's edge by angle, instead of assuming one point per ray.
- **Result.** Faceting screen: 0 flags. `stepped-sector-contact`: no penetration, maximum sampled working gap 0.00286 (threshold 0.004).

### 314: crescent pallet (`authored-lever-chronometers.js`)
- **Cause.** Each swept pose printed the grown tooth's corner into the stone faces: 432 zigzags, turns of about 146°, up to 0.0045 deep.
- **Change.** The same helper, with segments under 0.02, removes them.
- **Result.** Zigzags fell from 432 to 3, and the faceting screen shows 0 flags. At most 0.0045 of material is removed, all at cusp tips, so the teeth stay clear.
- **Rejected alternative.** A finer sweep was tried and rejected: the build grew from 0.7 s to 11 s.
- **Captures:** `before/314-outline.png`, `after/314-outline.png` (red marks the zigzags) and `after/314-zoom.png`.
- **Tests.** `movement-314` and `detached-chronometer-working` pass: no penetration, and banking contact within 0.002.
- **Disconnected screen.** The floating right banking pin and the near-miss left one are pre-existing fixed pins, not changed.

### 466: ram cylinder and ram (`authored-hydrostatic-presses.js`)
- **Change.** The profile fillets went from 6 steps (15°) to 24 steps. The ram's end arcs went from 16 and 10 steps to 48 and 30. The water under the ram uses the same step counts, so its surfaces still follow.
- **Faceting.**
  - The ram body is no longer flagged (was 800 edges).
  - The casting went from 448 edges to 32. What remains is its designed two-chord shoulder knee.
- **Tests.** `movement-466` passes.
- **Coincident faces.** 2 tiny pre-existing pairs (valve chest against pump barrel, 1.5e-5 of the area, contrast 0.02) are unchanged.

### 477: valve D and casing (`ejector-trap-working-parts.js`, `authored-diaphragm-steam-traps.js`)
- **Valve D.** The dished foot, the waist and the domed top are now centripetal Catmull-Rom curves through the same knots. Welded smooth normals are creased at 30°.
  - The seat cone, the collar edge and the straight stem are exact, so the seat contact is unchanged.
  - The liquid inside follows the new inner profile.
- **Condensate curtain.** Its stretch over D is a spline too.
- **Casing.** The bottom corners are square, as Brown draws them; the two-chord chamfers are gone.
- **Faceting.**
  - The stem is no longer flagged (was 1,666 edges at 23°).
  - The casing is no longer flagged (was 160 edges).
  - Only the translucent condensate waters' `smoothed-crease` remains.
- **Captures:** `before/466-477.png` and `after/466-477.png`, `after/477-tile.png`.
- **Tests.** `movement-477` and `ejector-trap-working-solids` pass. 475 and 476 share the parts file and are byte-identical: only the `id===477` branch changed.

### 037, 229, 310, 312, 326 (deferred: files owned by other lanes)
- **037:** the jagged stud heads come from `conical-stud-geometry.js` (p93-fa).
- **229:** `authored-belts.js` (p93-fa).
- **310, 312:** `authored-gravity-escapements.js` (p93-fd).
- **326:** `authored-steam-engine-guides.js` (p93-fd-D1).

`trimOutwardCusps` is ready for the zigzag outlines of 229, 310 and 312 when those files are free.

## 35: the "round band"
The only accent-yellow tube in 35 is the **coiled tension spring** that holds the pinion bearing in mesh: Brown's zigzag beside the slot. p92-r's rope inventory flagged it because it is built with the belt helper and had no role. It is not a band or a rope, so recolouring it rope brown would make a spring read as a cord.

I kept its colour and gave it the role `coiled-tension-spring-pressing-pinion-bearing-into-mesh`, so rope inventories no longer list it. Capture: `after/35-tile.png`. If the user wants springs brown too, that is a one-line change.

## Reports regenerated (pose counts kept; none has `sourceCommit`)
- **195 and 207:**
  - `feed-worm-195-solids.json` (17)
  - `feed-worm-195-working-faces.json` (17)
  - `feed-worm-207-working-faces.json` (17)
- **208:** `205-208-209-contact.json` (513 and 513; 208 at 167).
- **Whole-file hashes of `authored-gears-core.js`:**
  - `200-226-bevel-solids.json` (33)
  - `191-196-201-contact.json` (513)
  - `202-264-worm-solids.json` (33, as at HEAD). My run used 17 while the working tree held a 17-pose copy. Another lane then rewrote it at 33 against the current sources; its hashes match.
- **174 and 180:**
  - `180-native-study`, `180-native-cycle`, `180-bake`, `180.json.gz`
  - `180-existing-contact`, `174-existing-contact`
  - `180-dense-contact`, `180-assembly-clearance`, `180-source-fit`
  - `180-browser` (re-hashed after the e2e rerun)
- **Stale sweep.** A sweep of every `docs/validation` report, provenance file and baked gz found no whole-file source hash that fails to match for any file changed here.

## Files changed
- **New:**
  - `scripts/bake-face-worm-195-mesh.mjs`
  - `src/data/face-worm-195-mesh.js`
  - `src/simulation/outline-cusps.js`
  - `docs/p93-f-review.md`
- **Modified:**
  - `src/simulation/feed-worm-assembly-parts.js`
  - `src/simulation/authored-clamps.js` (190 only)
  - `src/simulation/authored-gears-core.js` (35 role, 38 trim)
  - `src/simulation/generated-pin-slot-208.js`
  - `src/simulation/authored-lever-chronometers.js`
  - `src/simulation/authored-hydrostatic-presses.js`
  - `src/simulation/authored-diaphragm-steam-traps.js`
  - `src/simulation/ejector-trap-working-parts.js` (477 branch)
  - `src/simulation/baked/assets/180.json.gz`
- **Scripts:**
  - `scripts/generate-208-pin-envelope.py`
  - `scripts/review-feed-face-worm-solids.mjs`
  - `scripts/review-feed-worm-working-faces.mjs`
- **Tests:**
  - `tests/feed-worm-assembly.test.mjs`
  - `tests/movement-208.test.mjs`
- **Reports:** the ones listed above.

## Tests
I ran one batch of 38 files: authored-loader, crease-normals, source-presentation, loop-seams, solid-worm and mujoco-baked-loops; the feed-worm, clamp, ejector, bevel, special-worm, irregular-gear, stepped-sector and variable-drive suites; and the movement files for 174, 180, 190, 191, 195, 196, 201, 202, 207, 208, 264, 314 and 466 through 477. **303 of 306 pass.**

None of the three failures comes from this lane:
- **`clamp-working-solids`, 244 "block reaches up under the lever".** p93-fc's 244 change in `clamp-working-parts.js` (their file).
- **`source-presentation`, "151: bearing-(post|foot) removes a part".** Another lane's 151 change.
- **`variable-drive-205-209-solids`, stale hash of `variable-drive-205-209-parts.js`.** p93-fc edited that file after I regenerated `205-208-209-contact.json`. It needs one more `node scripts/review-208-pin-slots.mjs && node scripts/save-205-208-209-contact-report.mjs` (the 205/209 planar input may also need re-export) once their edits settle.

`node scripts/generate-face-worm-195.mjs --check` and `node scripts/bake-face-worm-195-mesh.mjs --check` both reproduce their bakes.
