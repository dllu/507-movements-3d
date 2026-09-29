# Pass 109 fix lane f1

Scope: the medium findings 046, 076, 084, 103, 115, 127 and 160 (in `docs/p109-audit-001-170.md`) and 192/193 (in `docs/p109-audit-171-340.md`), plus the quick lows in the same production files. Scratch files and captures are in `/dev/shm/p109/f1/` (`me/` for the central lane; `T/` threads, `R/` racks, `B/` 076/160 sub-forks). The before captures are the audit's, in `/dev/shm/p109/a/c/NNN/` and `/dev/shm/p109/c/NNN/`. No git writes.

## Medium findings

### 046: fusee chain end (fixed)
- **Checked:** the terminal pin was already on the base-flange tread: 0.039 above the tread at every pose, as are the last 12 pins. What read as a "stub in the air" was the chain's end seen end-on, finished by thin clevis eyes that were invisible among the chain plates.
- **Change:** the chain end now hooks into a steel block (`makeFuseeChainEndBlock` in `fusee-attachments.js`). The block is one annular-sector extrusion, 0.07 long, that sits on the flange tread 0.002 clear of the riser, ahead of the terminal link's plate ends. The clevis eyes run forward from the terminal pin into it. The barrel anchor is unchanged.
- **Low, also fixed (radial tread streaks):** `fusee-geometry.js` compared the clamped and unclamped tread heights with `!==`. The two expressions round differently, so random radial lines were treated as clamped and got flat normals among tilted ones. The comparison now uses a 1e-9 tolerance and the streaks are gone.
- **Captures:** `me/m46e.png` (default view plus block zooms), `me/46t-after.png` against `/dev/shm/p109/a/c/046/ztopz.png`.
- **Tests:** `fusee.test.mjs`, 11/11. A new test checks the block: seated on the tread, clear of the riser, and ahead of the terminal pin.

### 076: tappet start-up fall (sub-fork B; partly fixed)
- Brown's level rest cannot be kept. The p94/p101 sweeps show that any rest under 0.45 rad leaves B hung on a tooth back and the count is lost.
- **Change:** every cycle now plays the settled table, and phase 0 is the moment the stud lifts the tappet through Brown's level pose. The unprompted fall is gone.
- **Residual:** the tappet still rests 0.48 rad down on its key between strikes.
- Details are in `B/evidence.md`.

### 084: pawl D colour (fixed)
- D (the single working cam) and its hub are now brass (`selector-rack-geometry.js`). They no longer read as a bent spoke of the red wheel.
- **Captures:** `me/84a.png`, `me/84b.png`.

### 103 (and lows 102, 109, 111): square threads (sub-fork T; fixed)
- All four now have land = groove = 0.5 p. The core is 0.6 OD on 109 and 111's inner screw, and Brown's measured core on 102 and 103.
- 111's threads end square and flush.
- The four MuJoCo bundles were rebaked. Details are in `T/evidence.md`.

### 115 (and low 114): involute pinions with basic-rack trapezoids (sub-fork R; fixed)
- **Change:** both now have 20° involute pinions and trapezoidal racks, rebaked. 114 keeps its mutilated sector.
- **116's shading low, disputed:** the dark band is correct shading of the downward-facing concave wall. Details are in `R/evidence.md`.

### 127: handle arms (fixed)
- **Change:** the arms are steel (`PALETTE.muted`). The swing is now 49.5° (−A/2 to 1.5 A about Brown's pose, down from 60°), so the handles stay within 50° of horizontal, outboard of the racks as drawn. The pump barrels are sized from the new stroke.
- **Tests:** `opposed-pump-racks.test.mjs`, 4/4. A new test checks the arm colour and the swing limit.
- **Capture:** `me/127a.png` (phase 0.33).

### 160: cord peg (sub-fork B; fixed)
- **Change:** the peg is gone. The cord ends in a laid-rope loop round the eye's crown, in the treadle's mid-plane. The pulley moved back 0.26.
- **Rebake and reports:** 160 was rebaked, and its 160 hardware and clearance reports were regenerated. Details are in `B/evidence.md`.

### 192, 193: universal-joint drive (fixed)
- **Change:** `reversing-mangle-guides.js` now omits the jointed drive, its column and the placeholder standard for 192 and 193, as for 194. This happens before framing, so the camera fits the wheel.
- **Pinion shafts:** each is rebuilt to end 0.027 past the pinion's hub (z 0.600, as on 194).
- **193's wheel shaft:** trimmed from ±0.8 to −0.17…0.47, just proud of the backing and the hub. It had been a bare 0.66 post behind the wheel.
- **Camera:** both default cameras stay face-on.
- **Deleted file:** `mangle-universal-drive.js` is no longer imported anywhere, so I deleted it.
- **Captures:** `me/m192.png` (default, yaw and top views of 192; default, yaw and back views of 193).
- **Tests:** `movement-192.test.mjs` and `movement-193.test.mjs`, 11/11. They assert the drive is gone, the shaft ends just past the hub, and the camera is face-on. `movement-194.test.mjs` is unchanged and passes.

## Lows fixed in the same files
- **027:** Brown's domed central hub with its knob now stands where the sector frames meet (r 0.14, top 0.29). It clears the rollers' 0.18 approach and the carrier. Capture `me/l27a.png`, `me/l27b.png`.
- **032:** the large friction wheel has a shallow raised rim band on both faces, from 0.95 R to just inside the rim, 0.02 proud. This gives Brown's double circle. It is kept 0.0015 inside the rim so no face is coplanar with it. Capture `me/l32a.png`, `me/l32b.png`.
- **035:** the ellipse gets 033's treatment: a full-depth toothed rim round a recessed web whose inner edge is 0.16 inside the pitch curve (Brown's inner ellipse). Capture `me/m35b.png`.
- **049:** the idle-pawl drop is resolved in time (`ratchet-bevel-motion.js`). The real tooth outline showed that past the crest's edge no intermediate lift clears the tooth until the relative travel reaches 0.0512 rad, just inside the 0.0524 overtravel. So the pawl now holds its crest lift over that overhang and then falls along a parabola over 0.06 s.
  - This also removed the one-frame 0.3 rad pops. There had been 24 per cycle, including the seam pop, and 8 of them came from a search glitch where each driving pawl turned idle.
  - The largest pawl step is now 0.017 rad per P/4000, against 0.299 before. Clearance is ≥ 0 at every sample, and the seam is exact.
  - `ratchet-bevel.test.mjs`, 8/8, includes a new smooth-fall test.
- **063:** the stop pin and the spring stud are now short stubs ending 0.08 behind the drop plate. They used to be long rods back to the shafts' plane. `movement-063.test.mjs`, 7/7. Capture `me/l63a.png`, `me/l63b.png`.
- **132:** the hatched ground is shown (`hideGround` false), so the bed stands on it with the column feet; their bottoms were already level. The platen underside is a flat BoxGeometry face, so its gradient is lighting and it was not changed. `toggle-press-*.test.mjs`, 5/5. Capture `me/m132b.png`.
- **196:** the strap arm is steel instead of ink, so its shadow no longer reads as a dark lobe (`irregular-gear-family.js`). The pin keeps its ink.
- **241:** wheel A has a darker hub boss (×0.68 of the wheel colour; r 0.40, 0.05 proud of each face), as on 235/239. Capture `me/l241a.png`, `me/l241b.png`.

## Lows not changed
- **116:** disputed; see R above.
- **198:** the long pivots carry the suspension links in front of the rack teeth. They are structural, and trimming them needs the links re-planed.
- **209:** the fork pin must reach the catch plane (z 0.24–0.34). It ends 0.03 past it.
- **216:** the rear web is see-through on purpose, because Brown draws no web. An opaque web would put a large disc behind the gears in the default view.
- **038, 197, 211, 225, 226, 240:** not quick; left open.

## Screens, seams, reports
- Disconnected parts (27, 32, 35, 46, 49, 63, 84, 127, 132, 192, 193, 196, 241):
  - 27, 32, 35, 46, 49, 192, 193 and 196: 0 detached.
  - 63: the stop pin is flagged floating in 4 of 6 phases, as before. It is a fixed stop that the drop touches only at the stop.
  - 84: the known guide post.
  - 127: the pump frame is beyond the plate crop.
  - 132: the screen does not count the now-shown ground under the bed and the feet, so the bed is still flagged.
  - 241: the frameless driver group, already documented.
- Coincident faces: 0 flagged pairs on all 13.
- Loop seams: 12 checked, 0 above tolerance, 0 mid-cycle pops.
- Regenerated reports:
  - Pose counts kept: 191-196-201-contact (513), 200-226-bevel-solids (33), 202-264-worm-solids (33).
  - Also regenerated: 205-208-209-contact, feed-worm-195-solids (17), and feed-worm-195/207-working-faces.
  - For authored-cranks.js: 146-source-measurements, 156/157/158-oracle-comparison, 159-source-clearance, 160-spatial-band and 160-authored-review.
  - 140-dimensions carries a sourceCommit and was left alone.
  - Only the source hashes changed.
- Tests:
  - 480/481 passed in the targeted run. The one failure was the stale report hash, and it passes after regeneration.
  - Separately: 41/41 on the report-hash suites, `ratchet-bevel` 8/8, `fusee` 11/11, 192/193 11/11, 063 7/7, `opposed-pump-racks` 4/4, `toggle-press` 5/5.
