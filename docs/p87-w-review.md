# Pass 87, lane p87-w: thermal and water vessels (469, 474, 476, 478, 479, 480)

Reviewer: Claude Opus 5.5, lane p87-w (sub-forks for 469/474, 476 and 478; 479/480 and integration by the lane). Date: 2026-09-27.

Scratch files and captures are in `/dev/shm/p87/w/`, outside Git.
- **Before captures:** `before/tile-ID.png` shows the plate, phases 0/0.25/0.5/0.75, a rotated view and a side view.
- **Per-lane captures:** `474/` (469 and 474), `476/`, `478/`, and `after/` (479 and 480).

## 469: water on the cistern walls
- **Cause.** Each water box's bottom, sides and back lay exactly on the cistern's floor and wall faces. The cutaway clips the water at z = 0.6 without adding a face there, so from the front the water showed only through its back face, which z-fought the back wall (image 39).
- **Change** (`createTank`):
  - The water now runs 0.03 into the floor, both end walls and the back wall, so those faces are buried inside the opaque walls.
  - Its front is a real face at z = 0.59 (`TANK_WATER_FRONT_Z`), 0.01 behind the cut faces of the end walls.
- **Side effect.** The cut water is now always drawn. The wheel and screw sit below the waterline, as Brown draws them, so they show tinted through the water.
- **Captures:** `474/469b-{def,z39,zfloor,rot,top}.png` (before), `474/469a-*.png` (after), `474/tile469.png` and `474/tile469a.png`.
- **Tests:** a new movement-469 test asserts three things:
  - no water face plane lies within 0.005 of a wall or floor face plane;
  - the water is sunk into the floor, the end walls and the back wall;
  - its front face stands just behind the section plane.

  movement-469 (14), temperature-air-469-bevel (6) and thermal-steam-469-474-solids (5) pass.
- **Screens:**
  - Intersections: worst solid 0; only fluid pairs.
  - Disconnected parts: 3 near-misses (a spoke against the wheel axle, and the two wheel rims against the air-pipe hood at gaps 0.075 and 0.023). None involves the water or walls.
  - Seams: 0.

## 474: handles
- **Change.** Each handle is now one smooth swept round rod (radius 0.085) bent into an upright loop:
  - two horizontal stubs leave the bowl's flank at y −0.28, about 0.62 below the rim;
  - they run out to x ±2.10 and turn up into two legs;
  - a top bar joins the legs at y 0.52, just above the rim;
  - the loop is 0.80 wide.
- **Shape.** Head-on the handle reads as a Π, and from the side as an L, matching the user's sketches (images 37 and 38).
- **Symmetry.** The two handles are mirror images across x = 0, and each is symmetric front to back. They stay at ±x, where the plate puts them.
- **Joints.** Both stub ends are sunk through the wall: the sunk ends reach radius 1.672, inside the flank's 1.70.
- **Published data:** the dimensions are in `geometry.boilerHandleLoop`.
- **Captures:** `474/tile-474-cmp.png` (before and after, head-on and side), `474/tile-z.png`, `474/tile-b.png` and `474/tile-a.png`.
- **Tests:** a new movement-474 test checks:
  - mirror and front-to-back symmetry;
  - the loop width;
  - the stub and top heights relative to the lid;
  - that the stub ends are sunk;
  - that each handle is one mesh.

  All 13 tests pass.
- **Screens:**
  - Intersections: clean.
  - Seams: 0.
  - Disconnected parts: 0 detached. Both handle-to-bowl joints are flagged as slivers ("narrow-neck" and "cap", neck ratio 0.347 against a 0.35 threshold). The screen merges the two stub joints of a loop into one contact centred on the empty middle of the loop, and takes the loop's 0.58 depth as the rod's section. The rod passes right through the 0.07 wall, so this is a screen artefact.

## 479 and 480: water re-joins behind the lifted vessel
- **Cause.** The water was three or more separate prisms:
  - an inner column;
  - an outer annulus;
  - a scaled ring under the bell's rim;
  - in 480, also the a/b gap ring and a ring under sleeve a.

  Their walls met on coincident cylinders along the line of the bell's wall. The water is cut by a clipping plane with no cap, so those internal walls showed through the section as vertical sheets that stayed where the wall had been once the bell lifted (images 30 and 31).
- **Change.** A new `layeredWater` in `authored-gasometers.js` builds each gasometer's water as ONE closed body, a stack of horizontal layers over fixed plan regions.
  - Only the true boundary is emitted: each layer's side walls, the bottom, the top, and at each interface the part of one layer's region not covered by the next. There are no internal faces.
  - The levels (floor, just under the rim, the inner level and the free level) move each frame. The topology is fixed, so an update rewrites only the vertex heights; nothing is re-clipped per frame.
  - Wall normals are smoothed round the circles.
  - The body is closed and consistently oriented: 0 unbalanced directed edges at every sampled pose (`/dev/shm/p87/w/wt.mjs`).
- **479 layers:**
  1. floor to 0.004 under the rim: the whole pit less the pipes;
  2. rim to the inner level: inside and outside the wall;
  3. inner level to the free level: outside only.
- **480 base.** Brown draws A closed at the bottom by a base line from the skirt to sleeve a, with the pipe crossing it (plate zoom `plate480z.png`).
  - A now has that base: one flat annular plate, 0.05 thick, running from mid-sleeve into mid-skirt.
  - It sits 0.003 above the rim, so none of its faces lies on the skirt's or the sleeve's.
  - The fixed pipes pass through it in holes with 0.03 running clearance.
  - The base is cut on Brown's section with the rest of A. This is passed as an extra cut role from `createAuthoredGasometerMovement`, and `cutaway-presentations.js` is unchanged.
  - The mechanism text notes that the base is pierced by the pipes, through whose clearance the water inside A joins the tank.
- **480 layers:**
  1. floor to under the base: the whole pit round b, less the pipes;
  2. the base's depth: outside A, between a and b, and in each pipe's clearance ring;
  3. above the base to the inner level: inside A as well;
  4. to the free level: outside A, and between a and b, which is open to the air.
- **Captures:** `after/tile-479.png` and `after/tile-480.png` (plate, four phases, rotated, and a low zoom under the lifted rim); `z-tile.png` (480 lifted, with and without water).
- **Tests:**
  - movement-479 and movement-480 now assert that the water is one closed, oriented body. Below the rim its only side walls are the tank's (and b's), so no wall stands where the bell's used to be.
  - They also check the free level and the floor contact.
  - For 480 they check that the water clears the base, and a new test covers the base (its lift, thickness, reach into the skirt and the pipe-hole clearance).
  - movement-479, movement-480 and gasometer-working-interfaces pass (10/10).
- **Screens:**
  - Intersections: worst solid 1e-8 in 479 (band on ball) and 0 in 480; the water is reported as deforming.
  - Disconnected parts:
    - 479 keeps its single "floating" entry. The bell rides on gas and bands, with no solid support, so it is not attached to the ground group.
    - 480 has one near-miss group, A with its base and sleeve, whose closest approach is the 0.0298 base-to-pipe running clearance. The other near-misses are running clearances: base to b (0.119), sleeve a to b (0.0475, as before), and each pipe to the base (0.0298).
  - Seams: 0.
- **Validation reports:** none fingerprint `authored-gasometers.js`.
- **Residuals:**
  - Brown's right-hand sleeve line stops above the base. The model joins the sleeve to the base on both sides.
  - The vertical stripes seen through the water are pipe shadows on the pit wall.

## 476: missing faces
- **Cause.** The shared `ejector-trap-working-parts.js` cut A's port through the fork wall by deleting triangles, which left the wall's skins unjoined (1147 open edges). The cutaway could not cap that section, so cut faces were missing along both legs and at the crotch (image 35). The water was an annular tube with a 0.004 inner radius; its inner skin showed as a light line, and it had no free surface.
- **Change.** All edits are in `authored-steam-siphon-pumps.js`. A new `sealFork()` runs after `correctEjectorTrapParts` and replaces its output; the shared file is unchanged.
  - **Fork wall** (`watertightForkWall`): a closed sweep built cell by cell, clipped at x ≤ 0 and mirrored. The sectioned wall has 0 open edges and `cutawayPresentation.open` is empty.
  - **A's port:** retriangulated in the sweep's parameters. It is round and sealed, with its rim on A's cylinder (r 0.172 against A's 0.17) and a smooth bore joining the two skins.
  - **A's route:** A now comes forward under the crotch and rises through it on x = 0, which is closer to Brown's bend below the crotch. A's pipe and the steam core follow the new curve.
  - **Water** (`halfWaterBody`): a closed half-tube just behind the section plane (z ≤ −0.0005), so it never lies on the wall's cut face.
  - **Free surface:** a new mesh with role `free-water-level-in-B-fork-and-C`, re-sliced from the water when the level changes.
- **Captures:** `476/before-*.png` (before); `476/a-tile1.png`, `476/a-tile2.png` and `476/w-tile.png` (after); `476/h2-*`, `476/z-*` and `476/f-*` (port zooms).
- **Tests:**
  - movement-476 passes 12/12. Two tests are new:
    - The sectioned wall has no open edges and a non-empty cut-face group. The water is closed and behind the plane. The port rim stays 0.168–0.175 from A's axis.
    - The free surface lies at the level, and is hidden both below the mouths of B and when the fork runs full.
  - The A-terminus tolerance was loosened from 3e-16 to 1e-12 for float noise on the new curve.
  - ejector-trap-working-solids and movement-477 pass.
- **Screens:**
  - Intersections: worst solid 0.
  - Disconnected parts: 0 detached, 0 near-miss, 0 slivers, 0 lips.
  - Seams: 0.
- **Residuals:**
  - Looking straight up a leg mouth, the translucent water tube shows a radial starburst. This is a transparency effect seen only from directly below, and it predates the pass.
  - The shared discharge fountain's crown is an open sheet (`water-volume.js`, outside this lane).
  - The shared module still builds the old wall and water at load, and they are then replaced. Load time is 2.1 s, in line with before.

## 478: Ray's steam trap
- **Change.** 478 no longer calls `correctEjectorTrapParts`. Its minimum cycle time, working-parts review and camera fit are now set in `authored-expansion-steam-traps.js`. The file was rebuilt as follows.
  - **Sphere C:** one watertight cast solid, cut on z = 0, sized from the plate (outer radius 1.13, inner 0.88, Brown's thick wall).
    - It has a left hub that A slides through, a right hub that is the stuffing-box, and an outlet neck that flares onto the base and runs down through it.
    - Normals on both sphere surfaces are exactly radial, so the inside shades smoothly.
    - The meridian is sampled by angle instead of by height, which removes the top kink.
    - Every seam shares its vertices; there are 0 odd edges when welded.
  - **Leaks:** A and the plunger (both radius 0.20) run in hub bores of 0.203, a 0.003 packed clearance. The old rectangular openings are gone.
  - **Duplicated faces:** the ring at A's free end (image 33) and the black contact block on stop c (image 34) are removed.
  - **Valve a (the plunger):** one rod of A's diameter.
    - Its flat inner end closes A's mouth.
    - Its outer end has a slight crown (sagitta 0.034), so it bears at a point on D's straight edge.
    - The contact law is now `a cos θ + b sin θ = e + Rc`, and the lever rate and closing force follow it.
  - **Lever D:** one flat plate, with a bored boss, a tapered lower arm and a neck to the ball weight. Its pivot is now 0.80 above the axis, as Brown draws it (was 1.48).
  - **Stop-screw b:** threaded through D's lower arm. It stands 0.19 out of the inner edge to a rounded tip, and runs 0.41 out beyond the outer edge to its square head.
    - Cold, the tip rests on post c, which limits how far the loaded lever comes out.
    - Hot, D turns 11° and b lifts 0.31 off c.
  - **Post c:** runs from the base up under the stuffing-box hub, sunk 0.04 into it.
  - **Water:** one continuous sheet. It starts in the gap between A's mouth and valve a, falls to C's inner wall, and runs down the outlet bore and out below the base. Its thickness follows the prescribed gap flow.
  - **Base plate (integration, by the lane):** the plate is not sectioned. It is now bored only to the outlet bore plus 0.005, so it overlaps the neck's wall instead of sharing its face. This removes the half-hole that showed from above in front of the cut neck (`478/n-tile.png`).
- **Captures:** `478/b-tile.png` (before); `478/a-tile.png`, `478/c-tile.png` and `478/z-tile.png` (after); `478/compare-478.png` (plate, before and after); `478/n-tile.png` (default, top and neck views after the base change).
- **Tests:**
  - movement-478 has a rewritten lever-contact check and three new tests:
    - the casting is sealed, cut on z = 0, with radial inner normals;
    - b passes through the arm and meets c;
    - the sheet stays in the gap, then in C, then in the outlet bore.
  - In `tests/ejector-trap-working-solids.test.mjs`, only the 478 pair list and the 478 stuffing-bore test changed, because they named blocks that no longer exist. The 475–477 lines are untouched.
- **Screens:**
  - Intersections: open meshes 0. The worst solid overlap, 0.010, is support B's upright seating A. The anchor-end rim overlaps A by 0.0495 (coaxial); both are fixed seats.
  - Disconnected parts: 0 detached, 0 slivers, 0 lips, and one existing near-miss (clamp B and the anchor-end rim, which both sit on A).
  - Seams: 0.
- **Residuals:**
  - D's support stands behind the lever; Brown does not draw it.
  - Support B and A's anchor end are unchanged and sit closer to C than Brown draws them.
  - The pipe and plunger cast a real shadow band on C's inner bottom.

## Tests run
The 13 targeted files together pass 106/106 (`/dev/shm/p87/w/tests-all.log`):
- movement-469, 474, 475, 476, 477, 478, 479 and 480;
- temperature-air-469-bevel;
- thermal-steam-469-474-solids;
- gasometer-working-interfaces;
- ejector-trap-working-solids;
- authored-loader.

camera-catalog and catalog also pass (7/7). No saved validation report fingerprints the changed files.
