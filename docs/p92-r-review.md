# Pass 92, lane p92-r: rope colour; 003, 004, 006, 011, 158

Reviewer: Claude Opus 5.5, lane p92-r. Date: 2026-09-28.

The user's screenshots are 66.png (003), 67.png (004), 68.png and 69.png (006), and 70.png (011), all in `/dev/shm/p92/`. Scratch files and captures are in `/dev/shm/p92/r/` (outside Git):
- `before/NNN/tile.png` and `after/NNN/tile.png`: the plate beside the default, ±50°, back, top and phase 0.33/0.66 views.
- `cmp-NNN.png`: zoomed on each complaint. HEAD is in the top row (served from a HEAD copy of the changed files) and the change is in the bottom row.
- `rope/overview.png`: the other recoloured movements, in the default and +50° views.

No git writes were made.

## 1. Rope colour (global)

- **Palette.** `PALETTE.rope = 0x7a4f2e` (hemp brown) was added to `src/simulation/primitives.js`. `PALETTE.belt`, which was the driven blue `0x315f78`, is now the same brown. CIE76 distance to every other palette colour is at least 28: brass 28, frame 32, ink 39, driver 42, accent 49, driven 51, paper 63.
- **Builder defaults.** `makeMovingBelt`, `makeDynamicMovingBelt`, `makeDynamicCable` and the internal `makeTube` now default to `PALETTE.rope`. `laid-rope.js` takes its material from the caller and needed no change.
- **Belts (choice).** Flat leather bands share the brown. They had the same blue-band-on-blue-pulley problem as the ropes: 011, 007–010, 243 and the belt governors. Because every per-movement rope, cord and band material that referenced `PALETTE.belt` now follows it, the change reaches all of them, including files claimed by other lanes, without editing those files.
- **Chains kept their colour.** The chains of 227–229 used `PALETTE.belt`; they now name `PALETTE.driven` explicitly (in `authored-belts.js`), so they look unchanged.
- **Per-movement ropes with their own colours**, now `PALETTE.rope`:

| ID | File | Was |
|---|---|---|
| 86 | `pump-catch-rear-drive.js` | tan `0xb08d57` |
| 124 | `mujoco-bow-drill/geometry.js` (bow string, bindings, leads) | brass |
| 126 | `mujoco-bell-crank/geometry.js` (cords) and `ends.js` (leads beyond the crop) | driver orange / driven blue |
| 129, 134 (and the offline 126) | `authored-belts.js` | driven blue |
| 154 | `baked/weighted-bell-crank.js` | `0x41413b` |
| 282 | `authored-slotted-disk-levers.js` | `0x26363c` |
| 378 | `authored-pendulum-saws.js` | green `0x28704c` |
| 419 | `authored-self-rocking-cradles.js` (laid-cord bands C, D) | green `0x477b5c` |
| 457 | `authored-counterbalanced-well-sweeps.js` | ink |
| 466 | `authored-hydrostatic-presses.js` (thin cord and its loop, which shared the ink part material) | ink |
| 473 | `authored-water-sealed-air-pumps.js` | accent yellow |

  In 473 the valve disks shared the rope material; they keep accent yellow through a separate `valveMaterial`.
- **Inventory.** Every production model, 1–507, was loaded, and every laid-rope mesh or rope/cord/belt/band/string/cable/line-role mesh was listed with its colour: `/dev/shm/p92/r/invB*.jsonl`, summary in `invsumB.txt`. After the change, the only rope-like meshes that are not brown are:
  - **Deferred: files claimed by p91 lanes.**
    - 35 (`authored-gears-core.js`): round band in accent.
    - 253 (`authored-check-hooks.js`): hoisting rope `0x3b3632`.
    - 320 (`authored-maintaining-power.js`): the "single-endless-chain-body" is a laid-rope geometry in ink. It is a chain, so ink is probably right.
    - 352 (`authored-redirected-windlasses.js`): windlass rope in driven blue.
    - 405 (`authored-hyperbola-drawing.js`): cord wrapped around the pencil, in ink.
  - **Left as they are, since they are not ropes:** metal eyes, knots, clamps and bails (247, 251, 278, 359, 415, 439, 459, 490); brake straps (242, 244); eccentric straps; and 479's black gasometer bands, which run over grey/blue pulleys and read clearly.
- **Scan for 69.png.** A scan for box bars ending in a ball too small to cover their corners found 006 (fixed below). It also flagged, unchanged in this lane:
  - 132's lever grip (ball 0.13–0.14, corners 0.131–0.167);
  - 185's rocker links (0.075/0.085 against 0.078–0.1);
  - 283's rack ends (0.104 against 0.192);
  - 362's pin arm (0.06 against 0.074).

## 2. 003 and 004: slack ropes

- **003 cause.** The free leaves were cubic Bezier ribbons that bowed to absorb the ±0.30 axial offsets of the side-by-side guide wheels, which read as slack (66.png).
- **003 change.** Each guide's vertex is now set off axially (±0.40) *before* the tangents are solved. The new module helper `rimTangentPoints` gives rim tangent points for lines to points out of the pulley plane. Every free leaf is then one straight 3D common tangent. The guide planes (`tangentFillet` in 3D) follow the leaves they carry. The wrap on the driven wheel is a new `FleetWrapCurve3`: a circular arc whose axial position is a cubic Hermite with end slopes matched to the straight leaves, so the loop stays tangent-continuous (joins within 2e-16). It drifts at most 0.040 across the 0.38 tread.
  - The offset grew from 0.30 to 0.40 because the guides now tilt to their leaves; this keeps the guides' complete bounds 0.25 apart axially, as the test requires.
- **004 cause.** The crossed leaves bowed ±0.22 in depth at the crossing (67.png).
- **004 change.** Both leaves are straight. The left leaf leaves the driver 0.088 in front of its mid-plane and the right leaf 0.088 behind it, each running straight to its guide. The guides are solved in 3D. The layer offset is the least that parts the strands by a rope diameter plus 0.04 where their projections cross; the measured centreline gap is 0.147, a 0.047 surface gap. The driver wrap is a `FleetWrapCurve3` from −0.088 to +0.088 across the 0.4 tread.
- **Clearance.** Rope-against-pulley check (`ropeclear.mjs`): no rope point is inside any pulley tread in 003 or 004.
- **Captures.** `cmp-003.png`, `cmp-004.png`, `after/003/tile.png`, `after/004/tile.png`.

## 3. 006: the rope meets the black bar; ball ends

- **Rope (68.png).** The rope ends now run up the rim into the lever bar. Each end's centreline stops 0.03 inside the bar's underside, so no cut end shows. Before, the ends stopped 0.12 below the bar's centreline, short of the bar.
- **Rim.** The sector rim's ends stood up to the bar's axis *in front of* the bar's face, because the rim is 0.26 deep and the bar 0.22. They now stop 0.01 inside the bar's underside, as Brown draws the rim meeting the bar.
- **Ball ends (69.png).** The bar's end corners (0.130 from the ball centre) poked through the 0.115 balls. The balls are now r 0.14 (twice the bar's height, as drawn, with 40×24 segments), so they enclose the corners. The scan no longer flags 006.
- **Captures.** `cmp-006.png` (attachment front and oblique, right end at phase 0.25, ball end), `after/006/tile.png`.

## 4. 011: belt centred on both faces

- **Cause (70.png).** The drum stood 0.76 in front of the pulley plane, the classic quarter-turn layout. The left run therefore left the blue pulley at its very edge, and a skewed wrap swung the band across the face.
- **Change.** As the user asked, the drum is centred in the pulley's plane (z = 0), still centred over the pulley's left edge in the elevation. Both runs are straight common tangents of the two rims, found by alternating `rimTangentPoints` to a fixed point:
  - the right run goes from the drum's back to the pulley's right side;
  - the left run goes from the pulley's left side (still vertical in Brown's elevation) to the drum's front.

  Both wraps are `FleetWrapCurve3`, entering and leaving at the face centre. The band drifts at most 0.057 on the pulley (half-width 0.2, band half-width 0.08) and 0.179 on the 1.44-wide drum. The unused `SkewedDeliveryWrapCurve3` was removed.
- **Trade-off.** A symmetric 9.6° fleet angle, where the textbook quarter-turn has 0° on approach. This is recorded in the code comment.
- **Captures.** `cmp-011.png`, `after/011/tile.png`.

## 5. 158: rod attached near the rim

- **Production route.** The loader serves `source-treadle.js` and `source-treadle-motion.js`, not `authored-cranks.js`.
- **Change.** The crank pin is back at Brown's (205,295), 0.845 of the disk radius; pass 59 had moved it in to 0.28. The joint centres, rod and arm lengths still come from the plate. The linkage closes through the full turn, with reach margins of 12.0 and 39.2 px.
- **Motion.** The treadle now rocks 49° (it was 16°), from 2.5° below level up across the disk face.
- **Clearances.**
  - The treadle is in its own layer in front of the disk.
  - The crank pin never comes within 0.537 of the treadle's centreline. The retainer and half-width need 0.249.
  - The foot stays above the base.
- **Cord.** 158 has no cord. The "cord slack" item in the task matches 159's row ("159's sag"), not 158's.
- **Captures.** `cmp-158.png` (HEAD row: v0, p33, p66, yp50; change row: the same views), `after/158/tile.png`.

## Screens (IDs 3, 4, 6, 11, 158; HEAD baseline from a copy with HEAD's three changed files)

- **Disconnected parts** (`disc2.json`): 0 detached, open ends, slivers and lips in all five. Near-misses:
  - 003: 0.
  - 004: 1, the existing pulley/keyed-shaft bore.
  - 006: 4, the existing pulley bores and web-spoke/lever gaps.
  - 011: 0.
  - 158: 3 (was 4), the bore clearances.
- **Coincident faces** (`cf2.json`): 0 flagged pairs and 0 seams in all five, the same as HEAD.
- **Loop seams:** 5 checked, 0 seams, 0 pops, 0 errors.
- **Body intersections:** 3, 4, 6 and 11 have worst solid 0; ropes are deforming and excluded, which is why the separate rope/pulley check above exists. For 158 this screen builds the offline `authored-cranks` model, not production; the production check is `158-assembly.json`: 99 pairs, 129 poses, 0 failures.

## Regenerated reports and bakes (all pose and sample counts kept)

- **158:** `158-assembly.json` and `158-oracle-comparison.json`.
- **Reports fingerprinting `primitives.js`.** 20 reports held the old hash; `posecmp.py` shows unchanged pose and sample counts, and only hashes changed:
  - 148: `148-assembly`, `148-complete-teeth` (with `FULL_ASSEMBLY=1`).
  - 167–171: `167`, `168`, `169`, `170` (both), and `171` (all, eccentric, lower, upper).
  - `191-196-201`, `200-226`, `205-208-209`, `219-224-414`, `221-222-223`.
  - `260-266-275` and `368-372` (with `POSES=33`).
  - `412-495` and `503-504`.

  `191-196-201` and `200-226` already had another lane's uncommitted edits; the regeneration includes the working tree as it stood.
- **Bakes fingerprinting `primitives.js`:**
  - 128: re-recorded with `probe-three-wiper-dynamics`, rebaked, and `validate-three-wiper-bake` passes.
  - 130: re-recorded with `probe-plate-shears`, rebaked, and validated.
  - 162 and 170: rebaked. `162-baked-clearance` and `170-baked-solid-clearance` were regenerated for the new asset hashes.
  - 128 embeds the scene JSON, so its bake carries the palette.
- **Bakes fingerprinting the MuJoCo geometry:** `mujoco-124` and `mujoco-126` rebaked. The assets are byte-identical and only the provenance changed.

## Tests

- **Targeted, passing:**
  - source-treadle (4, one new: Brown's 0.845 throw and pin-to-treadle clearance);
  - belts-1-23-clearance and pulley-belt-geometry;
  - movement-282, -378, -419, -457, -466, -473;
  - rotation-indicator;
  - crossed-governor-baked, water-governor-baked, weighted-bell-crank-baked;
  - mujoco-bell-crank, mujoco-bow-drill;
  - pump-catch, rope-drum-hardware, windlass-*.
- **Wider run.** The suite touching the regenerated reports and bakes (`/dev/shm/p92/r/testlist.txt`: 17 files, including baked-motion, mujoco-baked-loops, three-wiper-bake, plate-shears-bake and models): 347/349 passed. The two failures were `models.test.mjs` assertions that encoded the old designs:
  - 004 required the leaves to bow ≥0.2 apart at the crossing;
  - 011 required the right run to lie in the pulley plane (the drum stood forward).

  Both were rewritten to assert the new geometry:
  - 004: straight leaves, parted by at least a rope diameter plus 0.03;
  - 011: the drum centred in the pulley plane, both runs meeting each face at its centre and tangent to both rims, and the left run vertical in the elevation.

  They pass, along with the movement 1–23, 124, 126, 129, 134, 154, 158 and 159 cases and the all-507 construction test (21/21).

## Proposed ledger rows

- **003:** assessment `reasonable`; visibleFlaws empty. Replace the limits with: "Pass 92: every free leaf is a straight 3D common tangent; the side-by-side guides (±0.40) tilt to the leaves they carry; the driven wrap drifts ≤0.04 across its tread to meet the leaves tangent-continuously. Rope is hemp brown. Spoked web built by the shared filleted spoked-wheel builder."
- **004:** assessment `reasonable`; visibleFlaws empty. Append: "Pass 92: crossed leaves straight and taut, leaving the driver ±0.088 either side of its mid-plane (0.047 surface gap at the crossing), with no bow. Rope brown."
- **006:** assessment `reasonable`; visibleFlaws empty. Append: "Pass 92: rope ends run into the lever bar's underside; rim ends stop at the bar; ball grips r 0.14 enclose the bar corners. Rope brown."
- **011:** assessment `reasonable`; visibleFlaws empty. Replace the limits with: "Pass 92: the drum is centred in the pulley's plane (user review); both runs are straight common tangents entering and leaving each face at its centre, with a symmetric 9.6° fleet angle (the textbook quarter-turn has none on approach); the band drifts ≤0.057 on the pulley. Band is leather brown. Spoked web by the shared builder."
- **158:** assessment `reasonable`; visibleFlaws empty. Replace the limits with: "Pass 92: crank pin at Brown's 0.845 radius (205,295); the treadle rocks 49°, from just below level up across the disk face, in its own layer (≥0.54 from the pin). Ideal kinematic motion at steady disk speed; foot force and flywheel dynamics are not simulated."
- **86, 124, 126, 129, 134, 154, 282, 378, 419, 457, 466, 473:** append "Pass 92: rope/cord recoloured to the shared hemp brown." No assessment change.
- **Every movement whose ropes or bands used `PALETTE.belt` or the builder defaults:** now brown with no file change.

## Deferred or not fixed

- **Ropes in claimed files:** 35, 253, 352 and 405 are claimed by p91 and still use their own colours; 320's chain body stays ink.
- **Ball-end scan candidates** not in this lane's scope: 132, 185, 283, 362.
