# Pass 53: style lane (rules 3 and 4)

Rule 3: no black outline rims on part edges. Rule 4: parts drawn alike render
alike; ropes and cords use the laid three-strand rope of 270, and flat belts keep
one flat look.

## Method

- Scanned all 507 movements offline, with source presentation applied and
  visibility checked up the parent chain. Each scan lists dark tori, dark meshes
  whose roles name rims, outlines or edges, and solid ink lines, together with the
  file and line that created them. It found 1220 candidates in 296 movements at
  the start and 668 in 183 movements at the end. Most of the remaining candidates are real parts,
  such as bearings, collars, eyes, hoops, thread ridges and rivets. The lane scripts
  are in `/dev/shm/p4/scan`.
- Built a rope and belt inventory from mesh roles, tube geometries, flat-belt
  sections and caption words (rope, cord, band, belt, fall, tackle and similar).
  Each candidate was classified against its engraving in `public/engravings`.
- Captured the default and oblique views of the changed movements before and
  after the changes (`/dev/shm/p4/r2before`, `/dev/shm/p4/r2after` and
  `/dev/shm/p4/r3`), and looked at them beside the plates.
- Seven parallel sub-passes, each for its own files, did most of the per-file
  work. They stopped after the session ran out of memory and wrote no notes. Their
  edits stayed in the tree. I then reviewed and finished the work sequentially.
  This document records the results by the current tree and captures. It does not
  depend on sub-pass notes.

## Shared changes

- `src/simulation/laid-rope.js` (new). This is 270's three-strand laid rope made
  into a general helper for any centreline:
  - The strand radius is r/(1+1/sin 60°). One full lay is 2.44 rope diameters,
    the same ratio as 270. Closed ropes repeat a whole number of strand periods.
  - `LaidRopeGeometry` is a drop-in replacement for `THREE.TubeGeometry` and
    takes a `travel` option. `setTravel(d)` moves the lay along the rope, so a
    moving rope shows its travel without painted markers.
  - `replaceWithLaidRope` rebuilds a rope in place and reuses its buffers.
    `makeLaidRopeMesh` builds a new rope mesh.
  - `toJSON` serialises the rope as a plain buffer geometry, so baked bundles
    load it with `ObjectLoader`.
- `primitives.js` changes:
  - `makeMovingBelt`, `makeDynamicMovingBelt` and `makeDynamicCable` take
    `laid: true`. A laid rope has no flow markers, and `updateDistance` or
    `update(phase)` moves its lay.
  - The dark torus rims on `makePulley` tread edges and the dark face ring on
    `makeGear` are now hidden placeholders (`userData.retiredInkOutline`). About
    40 correction modules find these children by index or by torus type, so the
    objects are kept.
- Flat belts use one look: `flatBeltGeometry` sections in `PALETTE.belt`, with no
  stitch markers and no dark edges. 57–62 were recoloured from paper-white or
  stitch-coloured bands.

## Rope and belt classification (what the plate draws, and the render now)

- **Laid rope** (hatched or twisted on the plate, or a plain cord line):
  - 1–6 and 12–23 (bands and tackle).
  - 124 (bowstring), 126, 129, 134, 154, 159 and 160.
  - 201, 244 (scale cords), 251, 253, 261, 270 (the reference rope), 278, 282.
  - 320 (Brown's "rope or chain", drawn as plain cord), 321, 352, 358, 359, 360,
    361, 369, 374, 378 (rope segments), 407, 415, 419 and 420.
  - 439, 457, 458, 459, 473, 490, 491, 492, 493 and 494.
  - 57 (band epicyclic cords), 283 and 162 were left as their files already
    had them.
- **Flat belt** (a band with width): 7–11, 58–62, 141 (saw band), 243, 255–259,
  373 (belt) and 390.
- **Metal bands and straps, not ropes**: brake bands (242, 244 backing), eccentric
  straps (89, 90, 171, 179, 185) and the leaf spring of 392.
- **Chains stay chains**: 227–229, 254, 399 and 462.

## Rims removed or hidden (production view checked)

The IDs below are the ones whose rendered black rims or outlines are gone.
Removed meshes are marked `-`. Meshes kept as hidden references are marked `h`.

- **001–023**: the `makePulley` tread rims are hidden. `hoist-hardware` eyes are
  real parts and stay.
- **24–46 (gears via `makeGear`)**: the face ring is hidden.
- **92–101, 131, 146, 156–159**: the "front-outline" tori and outline bands in
  `authored-cranks.js` and `authored-cams.js`. The production models (MuJoCo or
  baked) show none.
- **104–118, 197, 198, 200–216, 226 and 239** (`authored-gears-core.js`, via the
  `retireInkOutline` placeholder, `h`): pinion face rings, root circles,
  rack-pin rims, slot rims and hub reference rings.
- **144, 145 and 203** (`authored-linkages.js`, `h`): slot-wall ink edges. The
  pin retaining rings stay as parts.
- **147, 161–163 and 170** (governors): face circles and the fan border.
- **149 and 150**: cam profile outlines and the dark fulcrum ring `-`.
  `selectable-cam-valve.js` now tolerates the missing ring and skips mirroring an
  outline that no longer exists (see the fixes below).
- **152, 155, 164–169 and 172–182**: roller rims, clamp source outlines `-`, the
  diagonal-catch hub rings `h`, and the lock and rocker rims.
- **181/182**: the black ring round each pivot came from the stale 181 bake. I
  reran the projection (only its fingerprint changed) and rebaked it.
- **193, 194 and 196** (mangle outer rims): kept as parts. **221/222**: the
  collar rings are real parts.
- **233, 236, 238, 240, 241 and 211–213** (`authored-intermittent-core.js`):
  face rings, root circles, pivot rings and ratchet outlines `-`.
- **255–259** (pulley forms): face rims `h`. The notch contrast lines on 259 are
  retired.
- **261**: the disk-B rim `-`. **272**: the wavy front edge tube and rear edge
  torus `-`. **276**: the cam outline tube, hub ring and roller face rings `-`.
- **262, 263, 264, 265, 268, 274, 280, 281, 282, 283, 284 (thread rings kept),
  287, 296, 305 (untouched) and 312–318**: face, rim and edge rings.
- **323–336, 339–348, 350, 354–357 and 362–364**: rulers, guides, engines and
  gyroscopes. The gyroscope ring edge lines and disk rims are removed.
- **372–378 and 382–384**: the edge-runner and dynamometer rims. On **373** the
  spoked wheel's black rim is now in the spoke colour
  (`roller-working-parts.js`).
- **393, 398, 401, 406–413 and 427–431**: centrolinead construction lines,
  drawing-instrument collars and paddle-edge boards.
- **443, 448–454, 457–459, 468–486, 490, 491 and 496–500**: the diaphragm
  seams, rack-pump barrel ring, well-sweep and capstan head band `h`, and the
  windmill hub and sail rails `h`.
- **484**: the helical ribbon's dark edge tubes and end rails `h`.
- **490**: the guide-sheave grooves are now the sheave colour, not black tyres.

## Real rims and rings kept, with the reason

These still appear in the scan, but they are parts Brown draws with width:

- Bearing rings and bushes: 102–104, 110, 112, 143, 148, 151 and 310–333.
- Hoist and rope eyes: 12–23, 124 (binding), 154, 159, 160, 251, 261, 439, 494
  and 496.
- Thread ridges: 284, 373 and 492.
- Rivet heads and rim bands: 376. Barrel hoops: 473. Tank and bell lips: 473,
  479 and 480. The bellows pleats: 453.
- The gauge bezels (373, 499 and 500), the tyre of 411, the milled wheel of 384
  and the tree rings of 378 (drawn on the log end).
- The pump-barrel flanges of 450/451 and the fan inlet rims of 497.
- Some of these (the 450/451 flanges, the 479/480 vessel lips and the 497 inlet
  rims) are dark, but each is a lip or flange of its own part.

## Correctness fixes made while integrating

- `selectable-cam-valve.js` (150): no longer crashes on the missing fulcrum ring
  or the retired outlines. This had broken `tests/source-presentation.test.mjs`.
- `source-presentation.js` (320, 360, 490 and 491): dropped `remove` patterns for
  marker meshes that the laid-rope conversion no longer creates. The notes of
  these entries are updated.
- `authored-steam-engine-guides.js` (326/327): `userData.tread` now points at the
  disk, because the separate dark tread torus is gone.
- Stale baked assets were rebaked with their scripts:
  - 160 (the band is now laid rope), 162, 163, 165 and 170.
  - 180, after rerunning `qualify-single-clamp-cycle.mjs`.
  - 181, after rerunning `project-diagonal-catch-motion.mjs`. Only the
    projection's fingerprint changed.
  - 128, 130 and 138, after re-recording `/dev/shm/128-recording.json`,
    `/dev/shm/130-recording.json` and `/dev/shm/138-fine.json` with their recorded
    options. Penetration and reset counts are unchanged.
  - 123 still lists stale `bevel-geometry.js` and `dispose-model.js`, which this
    lane did not change, as well as `primitives.js`. It was not re-recorded.
- `mujoco-variable-cam/geometry.js` (138) now tolerates the retired cam outline.
- `laid-rope.js` `replaceWithLaidRope` keeps the sample count of a rope whose
  length changes moderately, so buffers stay stable (checked for 251).
- Regenerated audits that fingerprint changed files:
  - `200-226-bevel-solids`, `412-495-gear-solids`,
    `260-266-275-thread-solids` (POSES=33), `503-504-contact-solids` and
    `191-196-201-contact`.
  - `feed-worm-195-solids` (POSES=17), `feed-worm-195/207-working-faces` and
    `205-208-209-contact`.
  - All still pass.
- Updated pinned mesh counts, marker checks and band endpoint checks in tests
  where rims or markers were legitimately removed:
  - movement-197, 198, 201, 204, 211, 213, 236, 261, 272, 473 and 494.
  - The 166 block of `models.test.mjs`, `cam-272-276-solids`,
    `dead-socket-cradle-solids` (419) and `pulley-belt-geometry` (6).

## Intersections (laid-rope conversions)

The `show-body-intersections` screens at 0.01 spacing and 129 samples found
these rope pairs:

- 439: none.
- 458 and 459: 0.013 where the rope ties into each bail. This is the same kind
  of seated attachment the former leg cylinders had (0.021 before). The
  0.03–0.04 "deforming" pairs are the rope against its own hidden reference
  legs, which the screen still counts.
- 473: 0.03–0.05 where each rope end seats in its lever eye, lug or grip. These
  are intended attachments.
- 352: none new.
- 494: 0.0016 at the shackle ring, which is the rope's tie point.
- 261: 0.032, the cord threaded through W's eye.
- 1 and 2: none.

## Tests

- All test files whose names match changed IDs were run: 190 `movement-*`
  files.
- 397 other test files that import changed modules were also run.
- Failures fixed here, as listed above.
- Remaining failures belong to other lanes' files:
  - `camera-catalog` 81 (`spring-rack-geometry.js`, changed by another lane).
  - `weighted-rack-selector-contact` (`weighted-rack-selector-contact.js`,
    changed by another lane).
- `tests/source-presentation.test.mjs` passes.

## Residuals

- **163**: the governor belt is still a round tube inside the baked MuJoCo
  model. The plate draws flat drums with the belt edge-on, and the belt is barely
  visible in the view. Converting it means changing `mujoco-belt-governor`
  solids and rebaking. Not done.
- **479**: the rope segments on the two pulleys are drawn as wide flat bands on
  the plate. They are kept as they were (not laid rope).
- **Rope colours vary by movement.** 320 and 159 used to be ink-coloured; 159 is
  now `PALETTE.belt` and 320 stays ink. The laid look is consistent, but the
  colours are not unified.
- Many `docs/validation/*.json` reports fingerprint files that this lane and
  other lanes changed. Most were already stale before this pass (for example,
  `tests/helpers/solid-surface.mjs`). Only the reports that feed bakes were
  regenerated.
- Hidden placeholders (`retiredInkOutline`) remain in the scene graph as
  invisible objects. They are kept so the many index-based correction modules
  keep working.
