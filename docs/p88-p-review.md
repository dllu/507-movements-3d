# Pass 88 lane p: coincident-face flicker in the pumps, press, jack and ram

Reviewer: Claude Opus 5.5, lane p88-p. Date: 2026-09-27.

IDs: 444, 448, 449, 450, 451, 453, 466, 467, plus 454 (the coordinator added it, first through the flexible-pump helper and then with `authored-diaphragm-pumps.js` for 454 only).

Scratch files and captures are in `/dev/shm/p87/p88-p/`, outside Git.
- **Screen JSON:** `before.json` and `after.json`.
- **Before captures:** `before/`. They were taken from the working tree before any edit; the 454 ones come from a `git archive HEAD` tree.
- **After captures:** `after/`.
- **Capture types:** `d-ID` is the default view and `r-ID` is rotated 25°/10°. `?-ID-NN-z` and `-zr` are zooms ×4 at each flagged patch, along the default direction and rotated 18°/12°.
- **Comparison tiles:** `cmp453.png`, `t453b.png`/`t453a.png`, `cmp448.png`, `z448.png`, `cmp444-466.png`, `z444.png`, `z466.png`, `z4xx.png` (467, 450, 451), `cmp450.png` and `cmp454.png`.

## Screen summary (`screen-coincident-faces`, default tolerances)

Areas are × diag².

| ID | Before: fights (area) / seams | After |
|---|---|---|
| 444 | 6 (7.2e-3) / 1 | 0 / 0 |
| 448 | 14 (1.2e-2) / 1 | 0 / 0 |
| 449 | 14 (5.5e-3) / 0 | 0 / 0 |
| 450 | 3 (2.4e-3) / 0 | 0 / 0 |
| 451 | 4 (1.3e-3) / 0 | 0 / 0 |
| 453 | 11 (9.7e-2) / 4 | 0 / 1 (8e-8, false positive) |
| 454 | 5 (3.5e-4) / 0 | 1 (3.6e-7, a zero-extent triangle pair in the delivery branch wall; false positive) / 0 |
| 466 | 4 (1.5e-3) / 1 | 2 (2.7e-5, contrast 0.019) / 0 |
| 467 | 4 (9.3e-3) / 0 | 0 / 0 |

## New helper: `src/simulation/stacked-fluid-volume.js` (used only by 453 and 444)

- **`stackedFluidGeometry(layers, {openBottom, openTop, caps})`** builds one closed fluid surface from a stack of plan prisms. Caps are drawn only where the plan changes between layers, so there are no internal sheets. Optional open regions let one surface continue into another. It is the `layeredWater` idea from 479/480, generalised to arbitrary plan multipolygons and levels.
- **`latheAtAngles(profile, angles)`** builds an open surface of revolution at given angles, so its rim meets another surface ring for ring.
- **`withoutPlaneFaces`** drops the faces lying in a plane where another fluid surface continues the body.

## Per movement

### 453 (lantern bellows pumps)
- **Fix.** The water is now one continuous body built from open surfaces that continue one another:
  - suction pipe → channel → mouths;
  - the chest stack (mouth layer, chamber layer, the port layer bridging the partitions, the chamber layer, and the bellows openings);
  - the two bellows columns;
  - the riser.
- **Clearance.** Every water face stands 0.008 (about 7e-4 × diag) off the walls, floor, partitions, top, port faces and flaps. The riser foot is 0.012 inside the partitions.
- **Bellows columns.** Each column is a unit lathe whose floor is an annulus round the chest opening. It is sheared each frame (`matrixAutoUpdate` off) so the floor stays level on the chest instead of tilting.
- **Suction water role.** The suction water had been matched by the cutaway's `/pipe/` cut rule and drawn as an opaque sectioned solid. It is renamed `water-in-common-suction-channel-and-inlet`, so it is now clipped water like the rest. The channel reads slightly darker in the default view.
- **Hinge pins.** The flap hinge pins now end 0.006 inside the journals' outer faces; they had been flush.
- **Captures.** `t453b` shows stair-stepped streaks on the chest floor and partitions; `t453a` is clean. See also `cmp453` (default and rotated).
- **Remaining flag.** One `water-in-common-discharge-riser` self-seam of 8e-8 at y = 1.90. It is the float-rounded ring where the tube meets the turned foot: 1.8e-5 thick and not visible.
- **Tests.** movement-453 and flexible-pump-452-454-solids pass (20).

### 448 and 449 (`lift-pump-working-parts.js`, used only by 448 and 449; `authored-lift-pumps.js` is unchanged)
- **Water set back from the section.** Every water section now stands 0.006 behind the section plane. Before, its cut face lay on the cut faces of the checks, domes, lugs, pins, seats and pipes inside it; this was most of the flagged pairs.
- **448 upper and head water.** The water above the bucket and the head water are now one body: a sectioned stepped surface of revolution, with its step 0.006 above the barrel shoulder. It is rebuilt into the same buffers as the bucket moves (`bucketAndHeadWater`). This replaces the head-water cylinder, which lay on the shoulder, and the seam where the two waters met. The mesh `water-standing-in-pump-head-at-spout-level` is gone.
- **Suction pipe.** The pipe now ends under the seat ring instead of running 0.10 up inside it.
- **Flap rims (`clackHinge`).** Where the pin would pass through the flap's rim, the rim is trimmed flat just clear of the pin bore. This applies only to 448 and 449; in 450 and 451 the flap is 0.05 clear of the pin, and the condition is false there.
- **449 barrel, head and stuffing box.**
  - The barrel stops under the enclosed head.
  - The head now spans the barrel's outer radius and is bored to the stuffing box's taper.
  - The gland ring sits on the box's top face instead of sinking 0.035 into it.
- **Captures.** `z448` pairs (before/after): the shoulder band, the hatched seat, the stuffing-box hatching and the streaked lower flap are all clean after. See also `cmp448`.
- **Tests.** movement-448, movement-449 and lift-pump-working-solids pass.

### 450 and 451 (`force-pump-working-parts.js`)
- **Suction water.** The column stops 0.006 under the check seat; its top had lain on the seat's underside.
- **Piston packing.** The dark packing was a torus round the body's top edge. It ran into the body and 0.03 into the barrel wall. It is now a flat packing ring on the body's top face, 0.005 clear of the bore; see `cmp450`, right-hand tiles.
- **451 dip-tube water.** The water stands 0.006 inside the tube bore; it had lain on the bore and on the end face.
- **Captures.** `z4xx.png`, rows 2 and 3.
- **Tests.** movement-450, movement-451 and force-pump-working-solids pass.

### 466 (`authored-hydrostatic-presses.js`)
- **Fix: the cistern water is rebuilt.** It stands 0.006 off the walls, floor and back.
  - Its mid-plane face is notched for the pump barrel, and its surface is bored for it.
  - A back-half surface of revolution 0.006 outside the barrel's outer profile closes it there.
  - It no longer runs through the barrel's section and bore, where it doubled the inlet water; that was the seam.
  - Across the cycle the level stays on the barrel's straight stretch, so each frame is copied into the same buffers; a layout change throws.
- **Barrel water.** The column's foot is 0.006 above the seat, off the closed inlet disk's underside.
- **Captures.** `z466` (streaked barrel section before, clean after) and `cmp444-466`.
- **Remaining flags (false positives).** Two `sectioned-valve-chest-front-layer` / `sectioned-pump-barrel` slivers, 2.7e-5 in total, with contrast 0.019. The chest plate runs 0.004 into the barrel's section in the same iron. The overlap is kept because a flat chest end cannot meet the curved barrel behind the plane without opening a gap. Not visible in the zoom captures.
- **Tests.** movement-466 and hydraulic-force-solids pass.

### 467 (`authored-robertson-jacks.js`)
- **Pressure chamber water.** It stands `chamberWaterGap` (0.005) off the ram top and the cap underside. `scale.y` is now height − 2 × gap; `movement-467.test.mjs` is updated.
- **Swing-link pin.** It ends 0.006 inside the lug's front face; it had been flush.
- **Pipe water foot.** It is 0.005 above the return passage's end face.
- **Captures.** `z4xx.png`, row 1: the hatched cap/ram section and the pin end are clean after.
- **Tests.** movement-467 and hydraulic-force-solids pass.

### 444 (`authored-hydraulic-rams.js`)
- **Tail water.** It is one stacked surface: the deep layer plus the layer round the body, with no internal sheet at z = −0.37. It stands 0.006 off the floor, walls and back, the ram body and the neck, and behind the drawing plane. Its face therefore no longer lies on the cut faces of the drive pipe, waste collar and neck flange. It reads a little lighter than before, because the internal sheet is gone.
- **Vessel water globe.** It stands `vesselWaterGap` (0.006) inside the shell bore and behind the plane. The riser's cut face and the shell no longer meet it. `movement-444.test.mjs` uses the smaller radius for its volume check.
- **Body water.** It stands 0.006 inside the body's walls.
- **Captures.** `z444` (pipe streaks and collar/flange hatching before, clean after) and `cmp444-466`.
- **Tests.** movement-444 and water-mechanism-439-440-444-solids pass.

### 454 (coordinator request; `flexible-pump-working-parts.js`, non-lantern branch, used only by 454)

All three fixes are in the helper; `authored-diaphragm-pumps.js` needed no edit.
- **Chamber wall.** It now stands on the bottom flange's top face (−0.28) and ends under the clamping ring (1.445). It had run 0.07 into the flange and 0.055 into the ring, so their sections lay on one another.
- **Suction check body against the chamber bottom.** The body's flare ran through the floor plate, whose 0.44 bore was narrower than the 0.50 body.
  - The suction body now flares below the floor (from −0.30 to −0.20 in its own frame, where it had been −0.30 to −0.14).
  - It passes up through the floor at its full 0.50 radius, in a bore of 0.502.
  - Its inner profile, the seat and the flap are unchanged. The delivery body is unchanged.
- **Centre clamp against the link clevis.** The clevis foot stands 0.006 up inside the clamp's upper disk, instead of lying on the plane of the disk's underside. `plateJoint` gained an optional `base` argument; 453 keeps the default of 0.
- **Captures.**
  - `cmp454`: a speckled flange joint before, clean after.
  - `cmp454b`: the suction check at the floor, the clamp underside and the rotated view, before and after.
- **Remaining flag (false positive).** `delivery-branch-from-chamber-to-right-check` within itself, 3.6e-7 × diag² with contrast 0.01: a single zero-extent triangle pair in the saddle-ended wall.
- **Tests and screens.**
  - movement-454 and flexible-pump-452-454-solids pass.
  - Body intersections are unchanged from HEAD, with a worst solid depth of 0.
  - Detached parts are 0.
  - Near-miss pairs go from 8 to 9. The new one is the floor against the suction seat (0.052), which is not structural: the seat is held in the check body's 0.45 bore and no longer grazes the floor's narrower bore.
  - Loop seams are clean.

## Shared-helper proof (other movements unchanged)
- **Hash check.** Other movements use only `portedBarrel` (fountain balance, hammers) and `roundPortedBarrel` from `lift-pump-working-parts.js`, and `saddleEndPipeWall` from `force-pump-working-parts.js` (through the flexible-pump helper). Their output buffers hash identically in HEAD and the working tree: `/dev/shm/p87/p88-p/ident.mjs` gives `84e81248…`, `854fb265…`, `04cf5be9…` and `3e8084c6…` in both.
- **What the edits touch.** They are confined to:
  - `correctLiftPumpParts`, `clackHinge` and the new `bucketAndHeadWater`/`WATER_GAP` (448/449; `clackHinge` also serves 450/451, where the new branch is inert);
  - `correctForcePumpParts` (450/451);
  - `correctFlexiblePumpParts`, non-lantern branch (454 only), and `plateJoint`'s new optional `base` argument (the default leaves 453 unchanged).
- **New helper.** `stacked-fluid-volume.js` is new and used only by 453 and 444.

## Tests and screens
- **New test:** `tests/p88-pump-water-coincidence.test.mjs` (9 pass). It runs the coincident-face screen on each ID, allowing only the false positives listed above. Run against the HEAD tree, all 9 fail.
- **Targeted tests:** 444, 448–451, 453, 454, 466 and 467, plus lift/force-pump, hydraulic-force, water-mechanism and flexible-pump solids and the new coincidence test: 137 pass, 0 fail. camera-catalog and models: 164 pass.
- **Loop seams:** 9 checked, 0 seams, 0 pops.
- **Disconnected parts, HEAD vs working tree:**
  - Detached parts, slivers, lips and open ends are unchanged for every ID.
  - Near-miss pairs fall in 448 (17→16) and 449 (22→19).
  - One new 448 near miss, the suction pipe and a lower-flap journal, is not structural. The journal stands on the seat ring and the pipe now ends under the ring.
- **Body intersections:** the worst solid depth is unchanged for every ID. The new "open" meshes are only the fluid surfaces designed to continue one another: 453's chest/suction/bellows water, 448's bucket+head water and 444's tail water. The screen counts these as open at T-junctions.

## Proposed ledger rows (the assessment stays `reasonable` for all; no visible flaw is introduced)

Limits text to append:

| ID | Append |
|---|---|
| 444 | Pass 88: tail, body and vessel waters stand 0.006 off the walls, body and neck and behind the section, the tail water one surface; the tail water still fills the drive pipe's bore where it runs through the tank. |
| 448 | Pass 88: waters stand 0.006 behind the section; the bucket and head water are one stepped body; the suction pipe ends under the seat; the flap rims are trimmed clear of their pins. |
| 449 | Pass 88: waters stand 0.006 behind the section; the barrel ends under the enclosed head, which is bored to the stuffing box's taper, and the gland sits on the box; the flap rims are trimmed clear of their pins. |
| 450 | Pass 88: the suction column stops under the check seat; the piston packing is a flat ring on the piston, clear of the bore. |
| 451 | Pass 88: the suction column stops under the check seat; the piston packing is a flat ring on the piston; the dip-tube water stands inside the bore. |
| 453 | Pass 88: the water is one continuous body (suction, chest stack, bellows columns and riser as open surfaces meeting ring for ring), 0.008 off every wall, partition and flap; the suction water is drawn as clipped water, not an opaque section; the hinge pins end inside their journals. |
| 454 | Pass 88: the chamber wall stands on the bottom flange and ends under the clamping ring; the suction check body flares below the floor and passes through it in a 0.502 bore; the link clevis's foot stands 0.006 inside the centre clamp. |
| 466 | Pass 88: the cistern water stands off the cistern and is notched and bored round the pump's foot (no longer doubling the inlet water); the barrel column's foot clears the inlet disk; the valve chest still runs 0.004 into the barrel's section, in the same iron. |
| 467 | Pass 88: the pressure water stands 0.005 off the ram top and cap; the swing-link pin and the pipe water foot are recessed. |
