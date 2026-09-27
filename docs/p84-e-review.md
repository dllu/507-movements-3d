# Pass 84, lane p84-e: 211, 299, 309, 314, 389, 394, 269

Reviewer: Claude Opus 5.5, lane p84-e. Date: 2026-09-27.

Captures are kept outside Git in `/dev/shm/p84-e/`:
- `before/tile-ID.png`: the plate beside the default view, four phases, ±60°, back, top and seam phases.
- `afterID/tile-ID.png`: the same set after the change, for 309, 389 and 394.
- `ID/`: per-movement study scripts and close-ups.

Changed: 309, 389 (stop only) and 394. Still forced and unchanged: 211, 299, 314 and 269, and 389's eccentric throw. No factory changed which IDs it handles. No report in `docs/validation` fingerprints any file this lane changed.

## 309 Mudge gravity: B's toe drops into a nib

**Plate.** Brown's bottom edge runs level to about x 135. It then slopes down to a nib point near (145, 215) and rises beside the locked tooth's back into notch b.

**Constraint.**
- **Tooth path:** the next tooth cocks B by travelling from 135° to 129° about the wheel centre. In the pallet's frame it passes through everything under the lifting face to the right of x ≈ 129.
- **Blank experiments:** two blanks were baked, Brown's full toe and a deep slab down to y 225. The bake trimmed everything right of x ≈ 129 from both.
- **Free pocket:** the slab showed a free pocket at x 121–129 down to y ≈ 212. The next tooth's tip, at 141°, sets its lower edge.

**Change** (`authored-gravity-escapements.js`, 309 left pallet only; rebaked 309's entry in `baked/gravity-escapement-plates.js`):
- **Nib:** the bottom follows Brown's line to x 121.5, slopes down to a nib point at (128.3, 212.3), then rises beside the tooth path into the unchanged lifting face.
- **Clearance:** the bake trims the nib to the 0.006 running clearance.
- **Unchanged:** the other pallet and the half-forks. The 310–312 entries are byte-identical.

**Result.** The drop starts 13 px earlier than Brown's. The point sits about 16 px left of his and is about 6 px deep against his 8. Moving it further right would need a smaller pallet fall, which changes the impulse; this was not tried.

**Checks.**
- `movement-309`: 10/10 pass. The new test requires material in the nib, an open corner beside it, a level bottom and a clear tooth path. It fails on the old geometry.
- `gravity-escapement-working-solids` and `movement-310`/`311`/`312`: pass.
- `check-loop-seams --ids=309`: 0 seams.
- `show-body-intersections 309` and `probe-gravity-escapement-intersections 309`: no solid pairs.

**Captures.** `309/cmpB.png`, `309/ov1.png`, `309/zb-strip.png` (10 phases, rotated and top), `after309/tile-309.png`.

## 389 eccentric jack: stop on Brown's tooth, in its own lane

**Finding.** With the stop on Brown's tooth (three pitches above the lifting nose) and both pawls in one plane, the rising horn cuts the stop by 0.110 and its pin by 0.074 at the top of the stroke. Pass 70 had cited a rule against separate depth planes. No such user rule exists.

**Change** (`authored-eccentric-jacks.js`):
- **Stop position:** `stopBaseToothIndex` restores Brown's tooth.
- **Stop lane:** the stop now works behind the strap at z −0.25 to −0.03. The strap is at 0.03 to 0.25. Both noses seat in the roots of the same full-depth teeth (±0.27).
- **Pin:** it runs from the stop's rear boss and ends flush with its front face, so nothing was added.
- **Horn:** it passes in front of the stop near the top of each stroke.

**Still forced: the throw is 18.7 px against Brown's 14.**
- **Travel needed:** the nose must travel one pitch (16.4 px), plus the stop's ride-out (13–14 px, which Brown's pin position sets), plus the lifting nose's ride-down (11–12 px). That is about 41 px.
- **Travel available:** the strap and horn slider-crank, with its rod leaning 32°, gives at most 2.36 × throw. That is about 33 px at 14.
- **Alternatives, none of which helps:** changing phase, engaging on alternate strokes (each stroke must store a pitch) and changing the lever ratio (fixed by Brown's horn outline).

**Checks.**
- `movement-389` (a new test covers the seat three pitches up, the lane separation, the flush pin and the teeth spanning the stop lane) and `jack-389-contact`: 16/16 pass.
- `check-loop-seams --ids=389`: 0.
- `show-body-intersections 389 --spacing=0.01 --samples=129`: none.
- `scan-bad-faces 389`: unchanged (2).
- **For the integrator:** the new parts stay inside the recorded motion bounds (min z −0.754).

**Captures.** `after389/tile-389.png`, `after389/topstroke.png`, `389/s3/pair.png` (the rejected single-plane collision).

## 394 Parsons endless rack: steeper, deeper rack teeth with square roots

**Finding.**
- **Plate:** Brown's notches have vertical walls about half a pitch deep, with tooth and space each about half a pitch. His pinion's pitch is coarser than his rack's, so his drawing cannot mesh.
- **Old form:** the 25° stub teeth (addendum 0.6m) were 0.45 pitch deep with V spaces. Their straight-row contact ratio was only 0.91, a continuity gap that the prescribed playback hid.

**Change** (`authored-parsons-racks.js`; module, tooth counts, path and band outline unchanged):
- **Tooth form:** 22.5° involute, addendum 0.7m, dedendum 0.95m and pinion profile shift +0.2m. The rows and ends shift with it, so the centre distances are unchanged. The internal ends' tips are trimmed to 0.6m.
- **Square roots:** below the pinion tips' reach, every space continues with parallel walls to a flat root.
- **Result:** contact ratio 1.06 on the rows and 1.07 on the ends. Depth is 0.53 pitch. The pinion tip is 0.84m.
- **Rejected:** 20° or lower fouls the 10/14-tooth internal ends, keeps the contact ratio below about 1.05, or points the pinion teeth.
- **New export:** `parsonsMeshRatios`.

**Remaining.** The rack tooth tips still taper to 0.32 pitch wide against Brown's roughly 0.5. The pinion teeth are slightly longer and narrower than before.

**Checks.**
- `movement-394`: 5/5 pass. The 1200-pose pinion/band overlap is 0. The new test covers flank angle, depth, both contact ratios, pinion tip width and square roots.
- `movement-395` and `screen-disconnected-parts`: pass.
- `check-loop-seams --ids=394`: 0.
- `show-body-intersections 394`: none.
- **Stale script:** `scripts/generate-reversing-transmission-profiles.mjs` imports the file but is already broken (it reads the missing `blocks.outputRotor`). It was left alone.

**Captures.** `after394/tile-394.png`, `394/cmp.png`, `394/end/394-end.png`, `394/void.png`.

## 211 pin-guided intermittent pinion: forced, unchanged

**Plate.** The pin is at 170.7°, the last tooth ends at 87.4° and the plain rim starts at 84°. The cut is about 84–95°.

**Why it is forced.** The pinion must make a full turn per index, and the rim can return only when its single concave faces it. So the cut is about 360°/ratio − 7°. The model's 144° index gives the 137° cut.
- **Brown's ratio:** his tip radius of 8.9 lies inside his 9.1–9.25 rim, which fixes a pitch radius near 8.6 and a ratio of 2.5. His 8° and 20° pitches agree independently.
- **Brown's arc:** a cut of 96° or less needs a ratio of at least 3.5. That puts the pitch circle (9.33) outside his rim and cuts the pinion to about 12 positions.

**Rejected alternatives:**
- ratios 2.8 and 3.14 (122° and 108°), whose tips reach the rim and which lose 2–4 pinion teeth;
- a larger concave, which still needs the relief and leaves about 9 pinion teeth;
- two concaves, which Brown does not draw;
- moving the teeth relative to the pin, which only moves the relief;
- filling the relief with teeth, which adds undrawn teeth;
- phase or camera changes;
- a shallower relief, since it is already the swept envelope plus 0.08.

**Checks.** `movement-211` 5/5; loop seams 0.

## 299 old clock verge: forced, unchanged

**Study.** A temporary tuning override swept staff height, pallet angle (100–108°), release and catch angles, swing, back exponent, rake, tooth height and pallet width and thickness. Each setting was screened over 129–1025 phases with the working-solids test.

**Why the journal height is forced.**
- **Collision:** every failure has the idle pallet's inner edge (r 2.02) cutting the approaching tooth's leading face near mid-swing.
- **Brown's height and angle:** at 106° with the journal at 0.15 pitch, the backs at exponent 1.8 clear only with pallets 0.53 pitch or shorter (Brown 0.60–0.65).
- **Keeping the 0.55-pitch pallets:** this needs exponent 2.4 or more. That makes the mid-back 0.19 of tip height against Brown's 0.36, restores pass 64's thin hooked teeth and breaks both guards.
- **Other parameters:** thickness, width, rake, tooth height, catch angle and swing do not help.
- **Current setting:** it sits on the clear/penetrating boundary.

**Far teeth.** They are real 3D teeth in the crown's material. The user rejected pass 53's fading of them.

**Checks.** The file is restored unchanged. `movement-299` and `verge-crown-working-solids` pass (15/15).

**Captures.** `299/cmpAB.png` (current, height-0.16/exponent-2.4, and height-0.16/0.563-pallet options beside the plate).

## 314 lever chronometer: forced, unchanged

**Plate.** At 8× (`314/plateC8.png`), Brown's C junction sits 1.69–1.74 from the staff. At the plate pose, the model's C already ends at the waiting tooth's tip, as drawn. The shortfall comes from that tip standing at the fitted 176 px radius against Brown's roughly 171, and from the blade being 86.6 px long against 92–94.

**Why it is forced.** Checking C against the teeth over 2000 poses per cycle, C passes back cleanly only while its reach is under about 1.67. The lens its end cuts inside the tip circle equals the 27.7° pitch at 1.695. The clear B-lock phase window narrows with reach: 0.82–1.0 of a pitch at 1.60, 0.87–0.93 at 1.65 and 0.90–0.92 at 1.67.

**Best variant, rejected.** Reach 1.65, with the wheel set 3.4° upstream, clears. But it moves A's tip from 6 to 10 px off Brown's A and shrinks the short transfer to 0.04 pitch, all to gain 2.8 px on C.

**Also no help:** passing back during the transfer (the lens stretches), moving the staff and restyling the blade end.

**Checks.** The file ends byte-identical. `movement-314` and `detached-chronometer-working`: 10/10 pass. Loop seams 0.

**Captures.** `314/ov01c.png`, `314/ov02c.png`.

## 269 mutilated-rack frame: forced, unchanged

**Plate** (67.05 px/unit from the 118 px rack pitch-line spacing).
- **Frame length:** Brown's frame is 5.31 units and the model's is 6.10 (+14.9%).
- **Where the excess is:** left of the gear the model has 3.08 against 3.19. The excess is all right of the gear: 2.30 against 1.40.
- **Pitches:** Brown's left groups are at his gear's 20.4 px pitch. His right groups are at 17.4–19 px.
- **Brown's drawing cannot close:** meshing his lower pair puts the gear's tips 43 px past his inner face. The gear (0.46 deep) is also deeper than the frame (0.42).

**Alternatives** (length with Brown's end block):

| Option | Length vs Brown | Cost |
|---|---|---|
| 18 teeth | +24% | — |
| 20 teeth (current) | +15% | — |
| 21, 22 or 24 teeth | +11%, +7% or +1% | 3–6 teeth over Brown's 18 |
| Idle the lower pair | +9% | drops one of Brown's drawn engagements |
| Stub teeth | saves 0.02 | — |
| Thinner end | changes only the outer length | — |
| End set behind the gear | shorter | undone in pass 72 for the flush end |
| Pocket in the end | not possible | the gear is deeper than the frame |

**Checks.** `movement-269`: 11/11 pass. Loop seams 0.
