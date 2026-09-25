# Pass 58: hard edges on flat faces (lane p58-normals)

User report: many gears and pulleys are geometrically flat but shade as if
convex (movement 7's lower pulleys and bevel gears; the upper drum was fine).

## Root causes

1. **three's `LatheGeometry` normals.** A lathe gives each profile point a
   single normal: the length-weighted sum of its two adjacent segments'
   normals. On a machined profile (a disc face meeting its tread, a hub
   shoulder, a bore), the flat faces get normals tilted towards the rim, so they
   shade as domes. That covers the annulus in `makePulley` (every bored or
   spoked sheave: 7's lower stack, and many belts, 1-28), `makeConePulley`'s end
   faces, `bevelBodyGeometry` (every miter and bevel-gear body: 7's A, B and C,
   and 161, 162 and 170, among others), and about 300 raw `new THREE.LatheGeometry`
   calls in per-movement factories. 7's upper drum uses `CylinderGeometry`,
   whose caps have separate vertices, so it was already correct.
2. **Indexed `computeVertexNormals` on solids whose faces share corner
   vertices.** Custom builders that weld the flat face, side wall and back of a
   solid into one indexed mesh average the normals across a 90-degree edge:
   face-gear sectors (`face-gear-geometry.js`, 26), spiral wheels
   (`spiral-wheel-geometry.js`, 29), conical studs (`conical-stud-geometry.js`,
   37), variable face-gear teeth (`variable-face-gear-parts.js`, 219 and 414),
   the face-worm wheel (`feed-worm-assembly-parts.js`, 195), the grooved drive
   wheel (`groove-drive-working-parts.js`, 364), the fusee body
   (`cord-traverse-working-parts.js`, 358), the ends of the finite pipe walls
   (`finite-fluid-passages.js`: 395, 438, 444, 448, 451, 456, 466, 467, 470,
   474-476, 481, 483, 498-500), and several factory-local solids (259's pulley
   body, 277's face ratchet, the 300/301 impulse bands, 366's bevel body and
   418's sectioned casing).
3. **Few-sided prisms built with `CylinderGeometry` or `ConeGeometry`.**
   Hex nuts (6 sides), square-pyramid saw and feed-dog teeth, drill points and
   arrowheads (3-5 sides) were shaded as round cones and cylinders (178, 244,
   279, 285, 303, 378, 400, 413, 418, 447, 499, 500).
4. **Laid-rope strand ends.** Each open strand's flat end cap shared its rim
   ring with the round strand wall, so every cap shaded as a dome.

## Changes

- New shared module `src/simulation/crease-normals.js`:
  - `creaseLatheNormals(geometry, crease = 30 deg)` rebuilds a lathe grid in
    place. It splits the profile at corners sharper than the crease, so flat
    faces, treads and bores keep their own normals and finely sampled curves stay
    smooth. It keeps `type === 'LatheGeometry'` and `parameters`, works from the
    current positions (safe after rotate, translate and scale), keeps mirrored
    geometry facing outwards, and falls back to the generic crease for lathes
    whose index was regrouped or edited (15's grooved steps).
  - `creaseIndexedNormals(geometry, crease = 40 deg)` gives each corner the
    area-weighted normal of the adjacent faces within the crease angle, and
    merges corners with equal normals back into one vertex. It keeps groups,
    index order and the side the existing normals face. Coarse spheres (16x8)
    stay smooth. Use it only on static geometry, because vertex count changes.
    Each vertex keeps its index and split copies are appended, so structured
    grids (the 026 crown and 029 spiral-wheel contact tests index rows and
    columns) stay addressable.
  - `creaseNormalsIn(root)` is the load-time pass for the long tail. It creases
    every `LatheGeometry`, and gives flat side faces to every `CylinderGeometry`
    or `ConeGeometry` with 6 or fewer radial segments. Each geometry is treated
    once.
- Builders fixed at the source: `primitives.js` (`makePulley` annulus,
  `makeConePulley`), `bevel-geometry.js` (`bevelBodyGeometry`),
  `laid-rope.js` (separate cap rings appended after all strands, so each strand's
  vertex layout, and `tests/steering-spatial-solids`, are unchanged),
  `face-gear-geometry.js`, `spiral-wheel-geometry.js`,
  `conical-stud-geometry.js`, `variable-face-gear-parts.js`
  (`faceHeightGeometry`), `feed-worm-assembly-parts.js`,
  `groove-drive-working-parts.js`, `cord-traverse-working-parts.js`,
  `finite-fluid-passages.js` (`curvedPipeWall`),
  `mujoco-water-governor/bevel-train.js`. These are one-line swaps of the normal
  computation in these factory-local builders: `authored-pulley-forms.js`
  (259), `authored-treadle-drills.js` (366), `authored-valve-relief-guides.js`
  (418), `authored-colt-ratchets.js` (`faceRatchetGeometry`, 277) and
  `authored-escapements.js` (`debaufreHeightfieldSolid`, 300/301).
- The global pass runs in `applySourcePresentation` (next to the existing
  global pulley-mark pass), so both production routes get it: `model-loader`
  and the authored display timing. Cost, measured on fresh copies of every
  lathe and prism in all 507 movements (382 geometries): 264 ms in total,
  0.52 ms per movement on average, and at most 56 ms (movement 15, whose
  regrouped lathes take the generic path, plus JIT warm-up).
- Vertex positions are unchanged. Only duplicate vertices and normals are
  added, so index-welded closedness screens (which weld by position) and every
  regenerated contact report gave identical results.

## Scan

The scanner is `/dev/shm/w1/scan-normals.mjs` (scratch; not in Git). It loads
every movement through the production `model-loader` (MuJoCo through the node
runtime, baked bundles through `file:` fetch), updates it once, and flags a
visible mesh when a vertex's adjacent faces span more than 75 degrees and its
normal is more than 20 degrees off one of those faces, over at least 2 % of the
mesh area.

| | movements flagged (excl. laid-rope strands and tube kinks) |
|---|---|
| before (HEAD shared files, same working tree otherwise) | 132 |
| after | 17 |

No movement was newly flagged. Excluded as by design: laid-rope strands (6-sided
strands with analytic round normals, 49 movements) and `TubeGeometry` path kinks
(9 movements). Movement 200's bevel-tooth flag is a false positive: the cap
triangulation on its steep back cone has slivers, but the cap normals are set
analytically.

Still flagged (17), with the reason each is left:

- Deforming strips, springs and bands whose positions are rewritten in place
  every frame (a vertex split would need their updaters rewritten): 82 treadle
  strap, 141 band-saw blade and teeth, 240, 287 and 318 leaf and spiral
  springs, 242 and 243 flat bands, 407 elastic arch bar, 416 helical spring,
  428 rubber lining, 499 Bourdon tube, 406 thread bight.
- Moving water or spray (430, 433).
- 272: `wavyConeDiskGeometry`'s crease was reverted because
  `tests/movement-272` requires index-level edge closure on that body (the
  test is owned by another lane). The bevelled rim still shades softly.
- 400: the front extension's positions are edited after normals are
  computed, in a file under active edit by p57.
- 500: `halfRevolvedSolid` in `authored-diaphragm-pressure-gauges.js`
  rewrites positions in `setLoop` (the disk bows) and is under active edit by
  another lane, so its section pieces still round their profile corners.

## Visual verification

Render-only captures from a freshly restarted non-watching server on port
44481, from a copy of the tree with the shared-file edits reverted (before)
and from the live tree (after). Each shows the default view, (5,3,12) and
(-9,5,-5). Captures are in `/dev/shm/w1/cap-before` and
`/dev/shm/w1/cap-after`, with side-by-side tiles in `/dev/shm/w1/tile-<id>.png`
and a close crop in `/dev/shm/w1/crop-7.png`.

- 7: the lower stack's faces are flat with hard tread edges (they had a
  domed gradient), and the bevel gears' back cones and faces are flat.
- 15, 26, 29, 37, 127, 161, 162, 170, 183, 195, 219, 226, 259, 277, 300, 364,
  366, 378, 395, 414, 418, 447 and 13: flat faces now shade flat; curved
  flanks, cones, grooves and spheres are unchanged; nothing lost or inverted.
  The 418 casing top and 162's bevel bodies show the clearest change in the
  rotated views.

## Regenerated reports and bakes

Regenerated because the shared files are fingerprinted. All results were
identical to the saved ones apart from the source hashes:
`200-226-bevel-solids`, `412-495-gear-solids`, `260-266-275-thread-solids`
(POSES=33), `503-504-contact-solids`, `368-372-contact-solids` (POSES=33),
`feed-worm-195-working-faces`, `feed-worm-207-working-faces`,
`feed-worm-195-solids` (POSES=17), `219-224-414-contact`,
`221-222-223-contact`, `205-208-209-contact` and `162-loop-qualification`
(native 64-cycle rerun).

Rebaked: 128 and 130 (MuJoCo recordings re-simulated with the saved
options; rows identical), 161, 162 (after the bevel-train fix), 163, 165 and
170. 162's four bevel bodies and gate-output body now scan clean.

Not rebaked: 123. Its recording (`/dev/shm/123-dynamics-final.json`) was
already stale against `clutch-section-geometry.js` from pass 54, its baked
geometry has no flagged normals, and `baked/sector-handoff.js` is under
another lane's edits. Reports that already fingerprinted other stale files
(for example the 16x-17x clearance studies) and that no test enforces were
left alone.

## Tests

- New `tests/crease-normals.test.mjs` (7 tests): lathe creasing,
  smooth-curve preservation, mirrored orientation, regrouped fallback, indexed
  blocks against spheres, prisms, the pulley and bevel builders, and
  laid-rope caps.
- Report, bake and builder tests (tests-a/c lists, 171 tests): all pass except
  `irregular-gear-family`. Its report fingerprints `authored-gears-core.js`,
  which another lane changed after it was regenerated.
- `tests/models.test.mjs`: 161/163 pass. The two failures (movement 2's
  pulley face marks and 110's white index) come from the concurrent
  rotation-indicator change in `primitives.js`, which removed the face and tread
  index marks, not from this lane.
- Normal, laid-rope and position-count tests plus the family tests for every
  touched builder (711 tests): all pass.

Note: the regenerated reports also fingerprint `authored-gears-core.js` and
`primitives.js`, which other lanes are still editing. Rerun them after those
lanes land.
