# Pass 61: shared spoked-wheel builder (lane p61-spokes)

## Scope

The user found the spoked wheels inconsistent (309: very thick rim, spokes
not reaching the rim, no interior fillets; 314: huge window rounding). The
lane built one shared builder and converted the wheels that Brown draws as a
**single flat face pierced by filleted windows**. Per the user's scope
correction, wheels Brown draws with **plain spokes** (no interior fillets)
keep their construction; only obvious errors (spokes not meeting the rim)
were fixed there. 334 and 360 were left to another lane.

## Builder: `src/simulation/spoked-wheel.js`

One `THREE.BufferGeometry` extruded along +Z (centred on z = 0): the outer
outline (a circle, or a supplied tooth profile) minus one window between each
pair of neighbouring spokes, minus a bore. Each window is the three-piece
outline: the two straight spoke edges and an arc concentric with the wheel
(the rim's inside), filleted with exact tangent arcs. The spoke-spoke corner
takes the larger hub fillet; the spoke-rim corners the smaller rim fillet.
The extrusion is merged and crease-shaded (`creaseIndexedNormals`, 36°):
faces and plate edges are crisp, rim/fillet/bore walls smooth. The mesh
helper marks `noRotationIndicator` (spoked wheels take no quadrant cue).

Exports:

- `spokedWheelParameters(options)`: resolved parameters with defaults.
- `spokedWheelOutline(options)`: `{ outer, windows, bore, parameters }`, rings
  as `[x, y]` pairs, anticlockwise (for callers that extrude or clip their own
  plates, e.g. `plate-escapement-kit.js`).
- `spokedWheelGeometry(options)`: the extruded, creased geometry;
  `geometry.userData.spokedWheel` records the parameters.
- `makeSpokedWheel(options, material)`: the mesh.
- `spokedWebGeometry({ rimBoreRadius, embed, ... })`: spokes and web whose own
  rim is buried in a separately turned rim's bore (for grooved sheaves).
- `filletPulleySpokes(pulley, options)`: recasts a `makePulley` bar-spoked
  pulley as one plate the tread's full width, bored for its hub (keeps
  `primitives.js` unchanged, so reports fingerprinting it stay current).

Options and defaults (units are the caller's; `R` = rim outside radius, i.e.
`outerRadius` or the smallest radius of `outline`; `Ri` = `rimInnerRadius`):

| Option | Meaning | Default |
| --- | --- | --- |
| `spokes` | spoke count (>= 3) | 4 |
| `outerRadius` / `outline` | plain rim, or tooth profile ring | 1 / none |
| `rimInnerRadius` | inside of the rim (window arcs) | 0.80 R |
| `spokeWidth` | spoke width at the hub radius | 0.14 Ri |
| `spokeTipWidth` | spoke width at the rim (taper) | `spokeWidth` |
| `hubRadius` | web stays solid to this radius; sets the hub fillet when `hubFillet` is omitted | 0.24 Ri |
| `hubFillet` | spoke-spoke corner radius | from `hubRadius` (about 0.34 Ri at defaults) |
| `rimFillet` | spoke-rim corner radius | 0.07 Ri |
| `hubArcRadius` | optional: close windows with a concentric inner arc (large hub or inner ring), its corners taking `hubFillet` | none |
| `windowShape` | `'filleted'`, or `'lens'` (curved-crossing clock wheel: rim arc plus one circular arc meeting in sharp tips; crossings `spokeTipWidth` wide at the rim, inner arc reaching `hubRadius`) | `'filleted'` |
| `boreRadius` | axle bore, 0 for none | 0.32 `hubRadius` |
| `thickness` | plate thickness | 0.12 R |
| `phase` | angle of the first spoke's centre line | 0 |
| `arcSegments` / `filletSegments` | sampling | 192 per turn / 12 per fillet |

The default proportions give a moderate rim, spokes meeting both rim and hub,
and a hub fillet about five times the rim fillet.

## Inventory and decisions

Candidates were found by loading every model (`registry.js`) and listing
meshes whose role mentions spoke/web/window/arm, or plates with three or more
holes, plus a source grep; each candidate's plate was then inspected.

Converted to the builder (filleted single-face kind on the plate):

| ID | Part | Before | After |
| --- | --- | --- | --- |
| 1, 2, 3, 4, 5, 6 (lower pair), 11 | cast belt pulleys (`authored-belts.js`) | turned open rim + four box spokes + hub | `filletPulleySpokes`: one plate the tread's width, rim 0.8 R, spokes 0.13 R, hub fillet from 0.32 R, rim fillet 0.045 R, bored for the dark hub |
| 39 | flywheel on the sun shaft (`authored-gears-core.js`) | ring rim + separate hub disk + four box spokes in different planes | one plate in the hub's plane: rim 1.10-1.27, four 0.11 spokes, `hubArcRadius` 0.56 (hub disk behind the sun gear), fillets 0.04 / 0.03 |
| 77 | peg wheel web (`alternating-peg-pawl.js`) | four windows with a Bezier hub corner and sharp rim corners | builder, spokes 0.2, hub fillet 0.17, rim fillet 0.02 (wheel inertia +0.05%) |
| 269 | output pinion (`authored-mutilated-racks.js`, both the factory and the later unbevelled rebuild) | root annulus + four box spokes | toothed web plate: rim to root - 0.18, spokes 0.13, rim fillet 0.02, bored for the boss |
| 289 | escape wheel A (`authored-plate-escapements.js`, owned by p61-horology-a) | placeholder straight X windows | `windowShape: 'lens'`: rim arc at 82 px, crossings 14 px at the rim, inner arc to 33 px, windows square to the page |
| 309 | Mudge thirty-tooth wheel (`authored-gravity-escapements.js`) | tooth ring with inner radius 1.48 (rim 0.50 deep) + four beams stopping at 0.96 of the rim's inside | one plate with the tooth outline, rim inside 0.875 of the root (Brown's ~0.14 deep rim), 0.12 spokes, hub fillet from 0.40, rim fillet 0.05, bore 0.30 for the hub; phase keeps Brown's X at 45° in the opening pose |
| 313 | flat escape wheel (`authored-free-escapements.js`) | quadrant windows with the rim fillet (0.14) larger than the hub fillet (0.04) | builder: crossings 0.28, hub fillet 0.10 W, rim fillet 0.04 W |
| 314 | lever-chronometer web (`authored-lever-chronometers.js`) | quadrant windows with 0.6 rim "chamfers" | builder: spokes 0.50, hub fillet 0.60, rim fillet 0.25, rim inside 2.08; keeps the 180 root vertices the separate teeth stand on |
| 328 | wheels C (`authored-cartwright-parallel-motions.js`) | wedge-spoke sector windows | builder on the (unchanged) tooth outline, spokes 0.17 R, rim fillet 0.05 R, X within 6° at the opening pose |

Removed helpers: `filletedQuadrantWindow` (lever chronometers, free
escapements).

Plain-spoked (left as drawn): 76, 78, 84, 86, 87, 92, 134, 141, 143, 145, 148,
221, 250 side wheels, 267, 284, 288, 292, 300/301, 303, 304, 312, 318,
326-331, 343, 371, 373, 376, 377, 390, 396, 402, 411, 430-432, 442, 458, 459,
469, 487, 490, and every other `makePulley` user (their plates show plain or
unseen spokes). A radial-extent check (spoke reach vs. rim inside) over these
found one real gap:

- 250 main flywheel: the four curved spokes stopped 0.011 short of the rim
  and were open tubes. They now run 0.15 into the rim's section and are
  capped, smoothly shaded round bars (`authored-bearings.js`).

Notes on others: 300/301 keep four plain spokes (another lane documented
Brown's upper spokes as cut off). 442's spokes end on the pots, which carry
the rims. 76 was tried with the builder and reverted: Brown draws a plain
sharp spoke-rim corner there.

## Verification

Fresh captures from a restarted non-watching server (port 44535), default,
rotated (+60°) and oblique, for 1-6, 11, 39, 77, 250, 269, 289, 309, 313, 314
and 328 (`/dev/shm/h5/fin`): every converted wheel reads as one flat plate,
spokes meet rim and hub, the hub fillets are the larger, faces shade flat with
crisp edges, and the pulleys are consistent across 1-11. 289's lens windows
match the plate's A-window layout.

Intersections (`scripts/show-body-intersections.mjs`, 0.01 spacing, 129
poses unless noted): 39 clear; 77 clear (two 0.0000 seated pin/pawl
contacts); 250 clear and no longer open meshes; 269 clear; 289 clear apart
from 0.0006 coaxial arbor seats; 313 clear; 314 clear (open fork tines are
another lane's parts); 328 clear; 1, 2, 5, 6 clear at default spacing (65
poses); 11 only the belt seated on the treads (0.0010 on the filleted pulley,
0.0014 on the drum); 3 and 4 clear at default spacing and 33 poses (they need
`NODE_OPTIONS=--max-old-space-size=12000` for their belts). 309 shows pallet-plate overlaps from the
concurrent lock-angle rework (p61-horology-b) with stale baked plates; see
below.

Tests: `tests/spoked-wheel.test.mjs` (new: window construction, closed and
oriented solid, crease normals, tooth outline, taper, hub arc, pulley recast).
Updated: `tests/movement-309.test.mjs`, `tests/movement-269.test.mjs`,
`tests/sun-planet-contact.test.mjs` (spokes are windows in one plate).
Passing: alternating-peg, alternating-drive-solids, bearing-working-solids,
belts-1-23-clearance, chronometer-return-contact, detached-chronometer-working,
free-escapement-solids, movement-250/269/270/291/303/310/311/312/313/314/328/
330, piston-guide(-329-331)-solids, pulley-belt-geometry, pulley-family-review,
sun-planet-contact, white-pulleys, jointed-tappet, models.test (movements
1-11 and pulley patterns).

Reports and bakes rerun: `src/simulation/baked/gravity-escapement-plates.js`
(309, twice; still out of date because p61-horology-b keeps changing 309's
pallets — they must rebake after their last edit),
`docs/validation/200-226-bevel-solids.json`,
`docs/validation/191-196-201-contact.json`, `docs/validation/141-review.json`
(results unchanged; source hashes refreshed). Hash-stale only, for an
unrelated function in `authored-gears-core.js`:
`205-208-209-contact.json`, `feed-worm-195-solids.json`,
`feed-worm-195-working-faces.json`, `feed-worm-207-working-faces.json` (their
generators combine intermediate files not in the repo).

## Residuals

- 77's baked motion used the earlier web: wheel inertia differs by 0.05%.
- Pulley webs are the full tread width (one extrusion); Brown's pulleys show
  no web thickness in his face-on views.
- 309's baked swept pallet plates and `movement-309` lock-angle tests are in
  flux in p61-horology-b's lane.
- 289's old lens code in `authored-deadbeat-escapements.js` was not touched
  (the route now serves 289 from `authored-plate-escapements.js`).
- `display-profiles` `fastestPart` still names `radial-pulley-spoke` for 1
  and 2; re-measure display profiles for 1-6, 11, 39, 77, 250, 269, 289, 309,
  313, 314, 328.
