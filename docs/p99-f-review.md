# Pass 99, lane p99-f: 280, 358, 483, 190 fixed; 269, 391, 398 forced

Reviewer: Claude Opus 5.5, lane p99-f. Date: 2026-09-28. No git writes.
Scratch files, captures and screen output are in `/dev/shm/p99/f/`. The before captures are in `before/`, the after captures in `after/`. Each `sheet-<id>.png` shows the plate, then the default, ±40° yaw, ±25° pitch, back and side views. `/dev/shm/p99/f/base/` is a copy of the tree with HEAD versions of this lane's files, used for the before screens.

Claimed: `authored-friction-windlasses.js`, `authored-fusee-traverses.js`, `cord-traverse-working-parts.js` (shared with 352 and 362), `authored-dry-gas-meters.js`, `authored-clamps.js`, `authored-mutilated-racks.js`, `authored-alternating-weighted-racks.js`, `authored-cam-rocking-drives.js` and `friction-family-working-parts.js`. The last one was claimed but not edited. The last three movement files were not edited, because their flaws are forced (see below).

## 280: the backstop is a real part (fixed)

- **Finding.** The caption names "a common ratchet-wheel and pawls", and Brown's two links from the eyes on the panel are the pawls, so the backstop is a real part. It was built as a torus ring, 36 separate tooth meshes and a carrier web, shrunk to 0.8 and pushed to z −0.65. Its two pawl pins floated 0.56 in front of the post they belong to. They were also on the post's edge: pin centres at x 1.62–1.65, with the post starting at 1.65.
- **Fix** (`hideBackstopBehindWheel`, `authored-friction-windlasses.js`):
  - The ratchet is one flat toothed plate, the union of the 36 generated tooth profiles and the root circle, bored inside the windlass barrel.
  - It sits at the barrel's rear end (z −1.38 to −1.22, inside the barrel's −1.40 to −0.12), just in front of the rear standards (−1.45).
  - Both pawls move to that plane. Each turns on a shouldered stud set 0.05 into the jaw post: a collar as broad as the head up to 0.04 behind the pawl, a shank with a 0.003 running fit in the pawl eye, and a head 0.005 clear of the pawl's front face.
  - The jaw post (Brown's panel with the two eyes) is widened left from 1.65 to 1.42, so the studs stand 0.20 inside its edge, as Brown's eyes do.
  - The similar-figure scale (0.8) is kept, so every pawl/tooth relation and the baked lift table are unchanged. `scripts/generate-friction-windlass-backstop.mjs` reproduces `friction-windlass-backstop-data.js` byte for byte.
- **Result.**
  - The default view is unchanged.
  - From behind, above, below and at ±40° the backstop reads as an intended ratchet on the barrel: one clean toothed wheel, with two pawls on studs in the post dropping into its roots.
  - The mesh count drops from 82 to 45.
- **Captures:**
  - `after/sheet-280.png`
  - `after/h280.png` (rear, rear-oblique, top and bottom, with the frame shown)
  - `after/p280.png` (close-ups at the eyes)
  - `after/r280.png` (rear close-ups at phases 0–0.8, frame hidden, plus the default view)
  - Before: `before/sheet-280.png`, `before/z280.png`, `before/h280.png`, `before/p280.png`
- **Tests.**
  - movement-280 has a new test: one ratchet plate on the barrel end; studs set into the post and 0.18 or more inside its edge; each pawl turning on its stud; the head in front of the pawl.
  - `friction-family-working-solids` now uses the one-piece ratchet for the pawl-clearance sweep and the locking-face check. It asserts one ratchet mesh and no carrier web.
  - Result: 19/19 pass.
- **Screens.**
  - Disconnected: 0 detached and 0 slivers. The first version had two "cap" slivers at the plain studs; the shouldered studs remove them. Near-misses fall from 68 to 27, short-of-pin from 22 to 12. The 2 lips (grip and brace) are the same as at HEAD.
  - Coincident: 5 pairs, all at HEAD (hand-lever segments and knee, lever boss, and flange/cheek). None is in the backstop.
  - Body intersections: worst 0.
- **Proposed ledger row.** Assessment **reasonable**; visibleFlaws "".
  - Replace the limits clause "Rear backstop ratchet is inferred and hidden;" with "The caption's backstop is one ratchet plate on the barrel's rear end, in front of the rear standards, with Brown's two pawl links turning on shouldered studs in the jaw post;".
  - Append: "Pass 99: the backstop is a real part in its own plane (z −1.30), not a floating ring; it shows from behind, above and below as intended and stays hidden in the default view."

## 358: Brown's lower bar under the fusee (fixed); band thickness (forced)

- **Lower bar, fixed.** Brown's long bars are not symmetric: the upper one lies 1.43 from the shaft and the lower one 0.71, under the fusee's large end and under the crank. The earlier limit was a crank sweep of radius 1.38, which cannot be cleared above the 0.85 rail top.
  - The carriage frame (`frameZ`) now runs at −1.25 instead of −0.43. The wheels, rail, cross ties, bed, crossmember, bracket and long bars follow it.
  - The lower bar sits at −0.71 (upper bar at 1.44), top 1.31 below the shaft. Its nearest edge is 1.437 from the axis, against the handle's 1.382 sweep.
  - The bracket runs from the lower bar's outer edge (−0.83) to 0.75, as before.
  - The crank-end bearing blocks and the small-end journal post now stand 1.37 and 1.16 tall on the deeper frame. In plan they are unchanged.
  - Files: `authored-fusee-traverses.js` (`frameZ`) and `cord-traverse-working-parts.js` (358 branch only). 352 and 362 hash byte-identical: `bc4fbd1894934696` and `641982f533f87caf` before and after.
- **Band thickness, forced.** The two cords must leave the fusee at one takeoff point in opposite directions, so at that point they lie side by side in the groove.
  - The groove pitch is 1.52/10 = 0.152. Brown hatches about 11 grooves and Sureda's profile has 10 turns, which the tests pin. That caps the cord diameter at about 0.07 (radius 0.035). The model uses 0.032.
  - Brown's band is about one groove pitch wide (≈0.11, radius ≈0.057), so his drawing shows one band where the mechanism needs two side by side.
  - Every alternative leaves the same constraint:
    - A double-start groove still puts the two cords half a pitch apart at the takeoff.
    - Stacking one cord over the other at the crossing makes the unwinding radius r + D against the winding radius r, which stretches the band by about 2π·D per turn (≈6.9 over the stroke).
    - Offset takeoffs stretch the band by up to 3.8 (p95).
- **Captures:**
  - `after/sheet-358.png` (default, ±40°, ±25°, back, both sides, and a low oblique)
  - Before: `before/sheet-358.png`, `before/w358.png`
- **Tests.**
  - movement-358 has a new pass-99 test: the lower bar is at −0.71 and the upper at 1.44; the lower bar clears the handle sweep by more than 0.03, lies under the large end in plan, and runs past the fusee and the crank. The pass-96 test passes with the taller blocks.
  - movement-358 and cord-traverse-working-solids pass. `fusee.test.mjs` fails only its 046 test, whose files belong to another lane.
  - `display-profiles.json` was regenerated for 190, 280, 358 and 483. Only 358's motion bounds changed (min z −1.38 → −1.67).
- **Screens.**
  - Disconnected: 0 detached, 0 slivers, 0 lips. Near-misses fell from 24 to 18, short-of-pin from 15 to 11.
  - Coincident: the two known 1.9e-6 bed/side-bar end pairs, as at HEAD.
  - Body intersections and seams: see "Screens" below.
- **Proposed ledger row.** Assessment **minor**.
  - visibleFlaws: "The band is about 2/3 of the plate's thickness (two cords share one groove station)."
  - Append to limits: "Pass 99: the carriage frame runs 1.25 below the shaft, so Brown's lower bar lies 0.71 from the shaft, under the fusee's large end and the crank, clearing the crank sweep by 0.05; the band stays capped at radius 0.035 by the two cords sharing the 0.152 groove at the takeoff (a double-start groove or stacked crossing does not relax it)."

## 483: A's flag rod stub below the bellows (shrunk; top residual forced)

- **Change.** A's flag rod turns in its 5.08-long bore through A's outer end board and in the shelf, so it needs no floor step. It now ends 0.02 under its lower flag arm (y −2.76) instead of at the floor.
  - Bare rod beside the wall below the bellows: 0.60 → 0.14. The part that remains reads as the arm's pivot stub.
  - File: `authored-dry-gas-meters.js` (`makeFlagRod` gains an optional bottom).
- **Top gap, forced.** Between the end board (2.54) and the shelf (3.40), the rod must rise to the spindle's crank above the shelf. Alternatives tried on paper:
  - **Rod in the case wall.** The flag tip moves about 1.0 in x to give the plate its 1.03 stroke, so the arm or the link must leave the 0.44 wall through a slot at least 0.35–1.0 long, on a face that can be seen.
  - **Rod in the central partition.** Needs a thickened partition and slots. Above the shelf the rod shows through C's opening. At `z > −0.7` it would pass through valve B.
  - **Brown's end-on knob reading** (rod straight behind A's plate pin). This hides the arm and link at mid-stroke, but above the shelf about 1.5 of rod would show in the empty space between the column and C.
  - **Extending the end board to the shelf.** Adds an undrawn board.
- **Captures:** `after/g483.png` (top gap, bottom gap front and rotated, then the HEAD bottom gap), `after/sheet-483.png`, and before `before/g483.png`, `before/z483.png`.
- **Tests.** movement-483 has a new pass-99 test: the rod is clear of the floor and ends 0.01–0.05 under its lower arm. movement-483 and gas-meter-working-solids pass (18 + 1).
- **Screens.** Disconnected: 0 detached, 0 slivers, 0 lips, near-misses unchanged (39, short-of-pin 7). Coincident: 0.
- **Proposed ledger row.** Assessment **minor**.
  - visibleFlaws: "Between A's end board and the shelf, 0.86 of the undrawn left flag rod shows beside the left case wall, with its flag arm and link. The spindle's crank disc and eccentric are inferred where Brown shows only a bar and a knob."
  - Append to limits: "Pass 99: the rod ends 0.02 under its lower flag arm (it turns in the end-board bore and the shelf), so below the bellows only a 0.14 stub shows instead of 0.60 of rod to the floor."

## 190: grip through the bar (done)

- **Change.** `turnedHandleGeometry(..., shank: handleShank(0.14))`, with `handleShank` imported from `turned-handle.js`. The grip's turned shank now runs through the 0.14 bar and ends 0.005 inside its underside, like the other 23 handles. The grip bottom is at 0.700 and the bar bottom at 0.695.
- **Other movements in the file.** 174 and 180 hash byte-identical before and after (`56d9aef6296bb9d1`, `21ab943222c8c0b7`).
- **180 chain.** `authored-clamps.js` is fingerprinted by 180's chain, so the chain was rerun: `qualify-single-clamp-cycle` → `probe-single-clamp` → `bake-single-clamp`.
  - The results are identical. Samples (746) and maximum error (4.997e-6) are unchanged.
  - Only the authored-clamps sha, the object UUIDs and the bundle bytes/sha changed (291824 → 291811).
  - `review-single-clamp-existing` (129 poses) and `review-bench-clamp-existing` (174) were rerun, with only the source hash changed.
  - The packaged `tests/e2e/single-clamp.spec.mjs` was rerun against a scratch build. It fails at the restart check, and fails identically on a HEAD build, so `180-browser.json` is left unchanged (see "Screens").
- **Captures:** `after/sheet-190.png`.
- **Tests.** movement-190 has a new assertion: the shank ends 0.005 inside the bar underside. 6/6 pass.
- **Proposed ledger row.** Unchanged (reasonable). Append: "Pass 99: the turned grip's shank runs through the 0.14 bar to 0.005 inside its underside, like the other turned handles."

## 269: forced (no change)

- Brown's drawing cannot close. The pinion's 3.18-pitch tip radius (18 teeth) must clear the closed end while meshing his lone right-hand tooth, which he puts 0.25 pitch from that end.
  - His abutting groups also jam. While the gear follows one rack, the other rack's teeth within about ±2 pitches of the centre line (√(2N)/π = 2.0 pitches for N = 20) are driven the wrong way.
  - Reversing without chamfers needs about 4-pitch gaps, which makes the frame about 9.4 long against Brown's 5.31.
  - With 2-pitch gaps the frame is 7.76 long and six teeth are chamfered to 55–63%. The user accepted mutilated teeth for clearance here.
  - Brown's rack pitch (17.5 px) against his 18-tooth gear's (20.3 px) is what fixes 20 teeth.
- No change. Keep the row as it is.

## 391: forced (no change)

- **C higher than drawn.**
  - In Brown's pose A1's pin is on the outer branch, 112 px (1.55) below the top corner. His roller is 109 px (1.5) below C's pivot and 34 px to its left.
  - Carrying A1 over the upper angle means rising that 1.55, so with Brown's pivot the roller would reach the pivot's own height.
  - The model's roller rises 1.16 from Brown's pose to the top and stays 0.99 below C's pivot there.
  - A1's teeth already stop at the guide arm as Brown draws them (tooth tips 0.42 below the guide pin). The roller sits 0.67 above the pin and 0.93 left, against Brown's 0.54 and 1.02.
- **No rack in mesh near the bottom.**
  - The lower arcs are tangent to the inner branch, so each rack's pin traverses its arc during the descent (A) or the ascent (A1) while the piston moves. A leaves mesh before the bottom and A1 enters after it.
  - Brown's own A1 teeth end 66 px below the gear centre when its pin is at the groove bottom, so his A1 cannot mesh there either.
- No change.

## 398: forced (no change)

- **Plate measurements** (`p398cam.png`, `p398crank.png`).
  - Cam: radius 81 px, hub radius 15 px.
  - Groove centreline: 0.37 R at the flanks to 0.70 R at the lobes, a stroke of 27 px.
  - Brown's crank: 30 px from the wheel centre (wheel radius 94.5 px).
- **Why no fix.**
  - Full turns need a stroke of twice the throw. Brown's groove gives a throw of 13.5 px, and his crank is 2.2 times that. The official animation therefore only rocks the wheel.
  - The model keeps Brown's groove (0.39–0.77 R) and derives the throw, 0.40.
  - The largest throw the cam can carry is 0.57: roller 0.16, shaft 0.32, a 0.10 land and a 0.12 rim give a groove from 0.29 R to 0.86 R. That would turn the drawn trefoil into a much deeper one and still fall short of Brown's 0.74.
- No change.

## Screens

Screens were run after the changes, and again on `/dev/shm/p99/f/base/` (HEAD versions of this lane's files) for comparison.

| ID | Disconnected (after / HEAD) | Coincident (after / HEAD) | Body intersections | Seams |
| --- | --- | --- | --- | --- |
| 190 | 0 detached, 0 slivers, 0 lips, 3 near-misses / same | 0 / 0 | worst solid 0 / same | 0 |
| 280 | 0 detached, 0 slivers, 2 lips, 27 near-misses (12 short-of-pin) / 0, 0, 2, 68 (22) | 5 / 5 (lever segments, knee, boss, flange/cheek; none in the backstop) | worst solid 0 / same | 0 |
| 358 | 0 detached, 0 slivers, 0 lips, 18 near-misses (11) / 0, 0, 0, 24 (15) | 2 / 2 (bed/side-bar ends, 1.9e-6) | worker runs out of heap (4 GB, 288k-triangle fusee) at HEAD and after; `cord-traverse-working-solids` covers the moving interfaces | 0 |
| 483 | 0 detached, 0 slivers, 0 lips, 39 near-misses (7) / same | 0 / 0 | worst solid 0, 4 open shells / same | 0 |

- `check-loop-seams`: 4 checked, 0 seams above tolerance, 0 pops.
- **Packaged 180 spec.** The scratch build of the working tree (`/dev/shm/p99/f/dist`) fails `tests/e2e/single-clamp.spec.mjs` at "Restart restores the initial frame" (line 8). It still fails with a 1.5 s first wait.
  - A build of the committed HEAD tree (`git archive HEAD`, `/dev/shm/p99/f/headdist`) fails at the same line in the same way, so the failure predates this lane and does not come from the rebake. The rebake's motion is also identical.
  - `180-browser.json` is therefore left unchanged. It still records the p98 pass with the p98 bake hash.
  - The restart mismatch in this environment needs its own look.

## Deferred

- None.
