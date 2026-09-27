# Pass 83, lane p83-a: 37, 204, 208, 206, 71, 351, 370

Reviewer: Claude Opus 5.5, lane p83-a. Date: 2026-09-27.

Captures are kept outside Git in `/dev/shm/p83-a/`:
- `before/ID.png` and `after/ID.png`: default view beside the plate, oblique view, four phases, ±60°, back, top and seam phases.
- `before/ov206-zl.png` and `after/ov206-zl-after.png`: the plate traced in red over 206's left band.
- `v351/tile.png`: 351's top collar at the lowered rest (front, ±40°, top), at mid-lift and raised.
- Scripts: `sil37.mjs` and `h37.mjs` (37 silhouette study), `e204.mjs` (204 end-ellipse study) and `c206.mjs` (206 band/tooth clearance).

Changed: 204, 206, 351. Forced and unchanged: 37, 208, 71, 370. No factory changed which IDs it handles.

## 204 skew hyperboloid rollers: end ellipses opened by a longer lens

**Finding.** Pass 73 set the camera from parallel-view ratios: 0.40 for the upper roller and 0.45 for the lower. But the two visible end faces (the upper roller's right end and the lower roller's left end) sit at the lateral extremes of the frame, and the 8° perspective turns both toward edge-on. They actually rendered at 0.36 and 0.41 (projected-rim principal axes through the engine camera).

**Change** (`authored-gears-core.js`, 204 only):
- `cameraFov` is now 3 instead of 8.
- The view is turned 2.5° toward the driver's end (direction (0.58, 2.3, 13.2) instead of (0.35, 2.3, 13.2)).
- The rendered ellipses are now 0.40 (upper) and 0.42 (lower), against Brown's 0.42 and 0.43–0.49.
- The sum of the two ratios is fixed by the shaft angle. Yawing further only trades one ellipse for the other: at an equal split both are 0.41.
- Projected length/end-diameter ratios: upper 1.88, lower 1.42 (before: 1.87 and 1.39).

**Test.** `movement-204` now requires `cameraFov` ≤ 3 and parallel-view ratios of 0.41–0.44 (upper) and 0.42–0.46 (lower). The actual values are 0.417 and 0.433.

**Captures.** `after/204.png`. The framing is unchanged (max NDC 0.87), and so are the rotated views.

**Proposed ledger (204)**
- assessment: reasonable
- visibleFlaws: (none)
- limits (append): The upper end ellipse renders 0.40 against Brown's 0.42 and the lower 0.42 against his 0.43–0.49. The shaft angle fixes their sum, and a 3° lens keeps perspective from closing them further.

## 206 shared-pivot double-stroke ratchet: left band tapered to hug the tips

**Change** (`authored-intermittent-core.js`, `hookedPawlOutline`, left pawl only):
- **Clearance:** the left band's end runs 0.05 clear of the tooth tips (was 0.11).
- **Width:** it tapers to a half-width of 0.09 at the square end (was 0.12) and widens to the common 0.12 by 60% of the way to the eye.
- **Result:** the square end's outer corner now stands 0.24 outside the tips (was 0.35), and the outer edge lies on Brown's traced outer edge along the lower half of the band (`after/ov206-zl-after.png`).
- **Unchanged:** the right band, the nose and the solved kinematics.

**Intersections.**
- `show-body-intersections 206`: only the two designed nose/tooth contacts (0.0001 and 0.0000), as before.
- A 400-pose band-versus-profile check (`c206.mjs`, band vertices beyond r 2.39) gives minimum clearance 0.022 for the left band and 0.013 for the right. The exhaustive pawl-tip test passes.

**Test.** A new `movement-206` test requires the square end to stand 0.15–0.28 outside the tips.

**Proposed ledger (206)**
- assessment: reasonable
- visibleFlaws: (none)
- limits: unchanged (teeth 0.33 deep, about twice Brown's; opens at Brown's high reversal with both pawls seated; amplitude 5.47°).

## 351 stamp: top collar carries Brown's 0.78 overhang behind the pinion

**Constraint (p73, re-verified).** At the lowered rest the top collar is level with the pinion's root disk. The disk's radius is 1.194 about (1.58, 0.30), so its nearest point is at x 0.386, only 0.306 from the rod face. The pinion occupies z 0.03–0.45.

**Change** (`authored-stamps.js`, `matchBrownStampProportions`). The collar is now one L-section solid:
- **Full-depth part:** as before, it reaches the rack teeth's tips (0.30 of the rod width).
- **Back step:** its rear part (z −0.21 to 0.01, 0.02 behind the pinion's rear face) carries the overhang out to Brown's 0.78.
- **Collar depth:** it grew backward from 0.51 to 0.70, comparable to the 0.68 lower collar.
- **Seen face on,** the collar has Brown's outline. At rest the pinion passes in front of the step. In rotated views the step reads as a stepped collar (`v351/tile.png`).

**Checks.**
- Test 9 of `movement-351` now checks the pinion's teeth in 3D against both solid parts of the collar over 1025 poses. It requires the step to stay behind the pinion's rear face, and the overhang to be 0.78 ± 0.03 of the rod width.
- `show-body-intersections 351`: none.
- `scan-bad-faces`: the collar is clean. The listed stamp-head/face and pinion-tooth coplanar findings are unchanged and not in edited parts.

**For the integrator.** 351's motion bounds (`display-profiles`) may need re-measuring. The collar now reaches x 0.82 and z −0.21.

**Proposed ledger (351)**
- assessment: reasonable
- visibleFlaws: (none)
- limits (replace the last sentence): Brown's 0.78 pinion-side collar overhang would enter the pinion's root disk at rest, so beyond the tooth tips it is carried only on the collar's back step, behind the pinion's rear face. Face on, the outline is Brown's; rotated, the collar shows the step.

## 37 conical stud gear: forced, unchanged

The ledger flaw is two stud heads at the silhouette. A perspective silhouette study through the engine camera (`sil37.mjs`, phases −1.1 to −0.3) shows that two heads break the right-hand outline at every display phase; no phase leaves only one.

**Why.**
- **Proud height:** the heads stand 0.048–0.051 proud of the body. That is `studFront` 0.025, plus the 0.012 relief, plus the stub addendum. The engagement needs about 0.036 (as recorded).
- **Window:** a head therefore shows beyond the outline over an azimuth window of 18–22° (acos(R/(R+h))) plus its own width of 7–10°. That totals 25–31°.
- **Spacing:** consecutive studs are only 14–26° apart (19° at mid-height), so a second head is always inside the window.

Even with no crown and the minimum 0.036, the window (≥ 17° plus the head width) exceeds the spacing in the upper half. Fewer studs would change the 24:20 ratio and the baked cut profile.

**Proposed ledger (37)**
- assessment: minor
- visibleFlaws: unchanged
- limits (append): Two heads always break the outline. Each head shows beyond it over 25–31° of turn (18–22° from its 0.048 proud height plus its width), and the heads are 14–26° apart.

## 208 slotted pinion: forced, unchanged

This re-derives pass 72's result:
- **The engaged pin must leave through the inner end.** A pin of ring radius r engaged at angle θ off the shaft line sits r(1 − cos θ) further in along the pinion axis. The pinion's rim reaches the pin tips out to |y| = 0.805 (outer radius 1.08 about z 1.40, tips at z 0.68). For the middle ring, the engaged pin has therefore drifted 0.41 inward (θ = 54°) while still inside the rim circle. That is past the inner neighbouring ring (0.3125), so an inner end wall would be struck, or would strike that ring.
- **An outer end wall is blocked too.** Outer-ring pins inside the rim circle sweep from x −0.04 back to −0.31 relative to the pinion's mid-plane. That crosses every possible outer wall position (−0.16 to −0.23).
- **Shifting** between rings also carries the in-slot pin out through an end.

**Proposed ledger (208).** Unchanged: minor, same flaw. The limits text should be de-duplicated: "Closed slot ends are impossible. The engaged pin drifts up to 0.41 inward along the shaft while still inside the pinion's rim, past the inner ring (0.31). Outer-ring pins sweep through every possible outer end-wall position. Shifting also carries the in-slot pin out through an end. The pinion is widened inward only (0.26 against Brown's 0.34), since the outer side would strike the neighbouring pin ring."

## 71 internal guard tappet index: forced, unchanged

The p64 and p72 analysis stands, and no new geometric freedom was found:
- **Slit position:** each slit must lie where its stud actually crosses the rim during the 55° push. The push length is set by Brown's 0.662 D orbit and 0.34 D struck-stud radius, and it puts each crossing 20–40° clockwise of Brown's static orbit/rim intersections.
- **Slit direction:** the slit runs along the stud's relative path, so its steepness is kinematic too.
- **Display phase:** showing B 30° later aligns the slits but moves the tappet 30° and C's studs about 15° off the plate.

Ledger unchanged (minor).

## 370 mirror polisher: forced, unchanged

**Plate measurement** (crank 85 px = 0.72, so 1 px = 0.0085):
- Brown's pose is near the top of the stroke: the eye is at 110° about the crank centre.
- His mirror axle is 73 px (0.62) above the lower rail's top.
- The stroke is 2 × 85 px = 1.44.

At the bottom of the stroke his axle would therefore be 0.82 below the rail's top. With its 0.105 radius it would pass about 0.9 into a rail only 0.31 tall.

The axle links the bar (in front of the rail) to the mirror and ratchet (behind it). It must pass over the rail, so the model's lower rail sits 1.0 lower relative to the eye than Brown's (axle clearance 0.017). That is what puts the mirror 0.59 of the way down the bar instead of 0.73. The alternatives fail:
- Putting the mirror in front of the rail makes the guide pins stop the mirror's edge.
- A slot for the axle would cut the rail through.

Ledger unchanged (minor). The limits could add: "At Brown's proportions the axle would pass 0.9 into the lower rail at the bottom of the stroke."

## Checks

- **Tests** (all pass: 84 in the combined run, then `movement-204` (5) and `movement-206` (6) rerun after the new assertions):
  - `movement-204`, `skew-friction-working-solids`;
  - `movement-201`, `202`, `203`, `205`, `206`, `207`, `208`;
  - `movement-351`, `movement-352`, `stamp-trip-working-parts`;
  - `movement-370`, `movement-071`, `conical-stud-clearance`.
- **Loop seams** (`check-loop-seams --ids=37,71,204,206,208,351,370`): 0 seams, 0 pops.
- **Faces** (`scan-bad-faces --ids=204,206,351`): 204 and 206 are clean. 351 has only pre-existing findings in unedited parts.
- **Source views:** all framed (204 max NDC 0.87, 206 0.91, 351 0.92), with no page errors.
