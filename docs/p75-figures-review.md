# Pass 75 lane p75-figures: taut rope on 006, Blender figures (hand, horse, walker)

Captures: /dev/shm/p75-figures/{before,after,v1..v7,final} (default beside the plate, ±60° about vertical,
top, back, and phases 0/0.25/0.5/0.75 of the period). Blender was used, through the blender-mcp bridge on
127.0.0.1:9876. Its protocol is a null-terminated `{"type":"execute","code":...,"strict_json":false}`
request. That is why the earlier `execute_code` attempts got no reply.

## 006: taut rope
- Before: the two crossed leaves were `BowedSpanCurve3`s, bowed 0.13 in depth. In the slightly oblique
  plate camera they read as sagging curves.
- After: both leaves are straight tangents (`LineCurve3`). They clear at the crossing because the two
  sector wraps lie side by side across the sector's width, at z = ±0.065 (0.13 apart; the rope is
  0.09 thick).
  - The leaf from the left pulley to the sector's right end is in front, as the plate draws it.
  - Only the lower span changes depth. It is straight in the plate plane, with a smoothstep in z so
    the tangents stay continuous.
  - The belt length stays constant through the stroke.
- Tests that pinned the old design were rewritten: `tests/models.test.mjs` (movement 6) and
  `tests/pulley-belt-geometry.test.mjs` (sector-band crossing). They now require straight leaves and
  a crossing clearance greater than the rope diameter.
- Intersections at spacing 0.02: none (before: none).

## Figure pipeline
- The models are in `scripts/blender/figures.py`, run in Blender through the bridge or with
  `blender --background --python`.
  - Each part is built from overlapping primitives, unioned by a voxel remesh and smoothed with a
    Laplacian filter.
  - The hand's rope channel is cut with an exact boolean.
  - Each part is decimated to 400–4200 triangles and exported as JSON.
  - Every part is closed and manifold (0 non-manifold edges).
  - A rerun reproduced all 16 part files byte for byte.
- `scripts/generate-figure-meshes.mjs <dir>` packs the parts into `src/simulation/baked/figure-meshes.js`
  (int16 positions and uint16 indices, base64, about 63 KB in total).
- `src/simulation/figure-meshes.js` decodes them synchronously into indexed BufferGeometry with smooth
  normals. An optional per-use transform can edit the positions before normals are computed.
- The figures use the existing matte palette materials.

## Hauling hand (12, 13; also 14–22, 247, 420 beyond their crops)
- A closed fist with the four fingers wrapped round the rope and the thumb curled over the index end.
  The back of the hand runs down toward a wrist on the far side of the rope, and a tapered forearm with
  a ruffled lace cuff follows (plate 12 draws a ruffle).
- The fist's rope channel is refitted radially to each rope, with rope radius plus 0.005 clearance.
  420 passes a clearance of 0.05 because its pull cord still curves inside the fist.
- The hand is scaled 1.65 instead of 1.35, so the fist is about 0.45 of the sheave diameter, as in the
  plate.
- `makeGripFist` reuses the same fist for the walker's hands on the rail in 377.
- Intersections:
  - 12 at spacing 0.01: the hand is clear of the rope. The only overlap is the known one between the
    rope end and the tail start (0.0135), inside the fist channel.
  - 13 at spacing 0.02: the same rope/tail overlap (0.0134).
  - 247: no fist contacts.
  - 420: the fist/cord overlap was 0.0188 with a clearance of 0.005 and is 0.0007 now.

## 376 horse
- One smooth body replaces the extruded outlines. It holds the barrel, chest, hindquarters, withers,
  shoulder and stifle masses, the crested neck with its mane ridge, the long head with the nose
  dropped, and the ears.
- New limb parts: rounded forearm and gaskin (with the point of the hock), cannon with fetlock and
  pastern, a slanted hoof under the pastern, and a flowing tail.
- The old neck, head, muzzle and ear blocks are kept but hidden. The eye was moved onto the head.
- All legs now use the coat colour.
- Unchanged: pivots, gait, tilt, the hoof-contact lowering, and the knee gap, which keeps the upper and
  lower leg spheres 0.07 apart.
- Intersections at spacing 0.02:
  - The leg tops sit inside the shoulder and stifle masses: 0.060, at the joint by design.
  - The tail root sits inside the rump: 0.050, by design.
  - Otherwise clear.

## 377 walker
- Blender jacket, head, cap, sleeves, fists, thighs and shoes.
  - The jacket is a loose smock with shoulders, inside the old lathe envelope below the shoulders.
  - The head has a jaw, nose, ears and neck, facing the drum.
  - The close round cap covers the back of the head down to the ears.
  - The sleeves run out to wide elbows and up to fists round the rail, with thumbs inboard and the
    backs of the hands toward the viewer (the far hand is mirrored).
  - The thighs are tapered trouser legs.
  - The shoes are clamped to the old sole box, with a flat sole at y = -0.05.
- The rail was lowered from 0.30 to 0.144 above the head centre, to the cap's crown where Brown's hands
  grip. The rail posts, guard and plank follow it.
- The shins, trouser seat and gait are unchanged.
- Intersections at spacing 0.02: none (before: none). All 377 board and body-clearance tests pass.
- Face scan: 3 of about 3200 triangles on each fist are flagged "shading", where the rail refit stretches
  the channel. They are not visible.

## Residuals
- 377: from behind, the raised leg still reads as seated. The gait is unchanged, and the thigh and
  trouser seat are simple.
- 376: the horse is stylized. The mane is a ridge, not Brown's zigzag hair. The legs join the body by
  embedding at the joints.
- 12/13: the rope end and the tail start overlap inside the fist channel (hidden).

## 376 axle connection (lead addition)
- Problem: the disconnected-parts screen found that the output axle touched none of the lattice bars
  (gap about 0.22).
- Fix: each face now carries an axle boss, a bored disc keyed on the axle, radius 0.12 to 0.37, in the
  axle's dark colour. Its rim runs into the four chord bars, so the axle is carried by the cage. It is
  Brown's hatched circle filling the central lattice square. Capture: final/v8 376-p0.
- The far hind gaskin was reshaped so its knee end sits over the hock pivot, like the forelegs. It is no
  longer reported as detached.
- The screen now reports only one near-miss: the horse against the treads, where the hoof clearance is
  up to 0.026 at some phases. The hoof lowering is unchanged.
- Other screen findings for 377 and 12/13, which follow from the design:
  - The walker's thigh, shin and shoe have lay-figure gaps (same envelopes as before).
  - The rail, bolt and diagonal guard form their own fixed group (seen with the old rail height too).
  - The hauling hand is carried by a rope that the screen counts as deforming.
