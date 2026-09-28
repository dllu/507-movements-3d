# Pass 93, lane g: items deferred from lanes f, fa, fb, fc, fd and ff

- **Reviewer:** Claude Opus 5.5, lane p93-g. The primary did 029, 031, 043, 063 and 133. Forks did 504, the cusp trims (229, 310, 312), 242/243, 196/201/216/207/210/192/198, 206/211/213/225 and 235/236/237. Date: 2026-09-28.
- **Scratch and captures:** `/dev/shm/p93/g/` (outside Git). The primary's captures are in `me/`; each fork's are in `504/`, `cusps/`, `B/`, `G/`, `I1/` and `I2/`. The "before" images are the audit sheets in `/dev/shm/p93/{a,b,c}/sheets/`.
- **Claims.** `authored-gears-core.js` and `authored-intermittent-core.js` (both in p92 and p93), `authored-belts.js`, `authored-gravity-escapements.js`, `authored-epicyclic-trains.js` and `epicyclic-family-corrections.js` were handed over from lanes that had filed their final reports: p93-f, fa, fd and ff. The owner files record each hand-over.
  - After the coordinator cleared `/dev/shm/p93/claims`, the files edited here were re-claimed with mkdir.
  - The new claims were `spiral-wheel-geometry.js`, `contact-profiles.js`, `chain-drive-profiles.js`, `outline-cusps.js`, `band-drive-working-parts.js`, `irregular-gear-family.js`, `irregular-gear-201.js`, `crown-pawl-237-working-parts.js`, `alternating-pawl-236-working-parts.js` and `star-tappet-working-parts.js`.
- **Concurrency.** Several forks edited the two core files at once, each in its own functions. Every edit was an atomic exact-string replacement.

## 029: the spiral is now a flat rib in the disc's material (low)
- **Plate.** Brown draws the thread as a flat band in two lines, in the disc's own material, with round ends. The black round wire was an inference that nothing forced.
- **Change** (`makeSpiralDiskWheel`):
  - **Rib.** One plan outline, extruded once and seated 0.004 into the disc face, in the disc's own material. The outline is the one-turn Archimedean band, half-width 0.05 (the rib is about half the 0.209 lead wide), with semicircular ends concentric with the centreline ends.
  - **Size.** The rib is 0.1 high, with a flat top at z 0.2. `threadZ` (0.15) is its mid-height, which is also the contact height.
  - **Removed:** the round tube and its sphere caps.
- **Gear teeth.** The spur's teeth are re-cut against the rib. `spiral-wheel-geometry.js` gained an exact flat-rib cutter (`rib: {halfWidth, base, top}`):
  - **Cut.** At every axial station and phase it takes the rib's plane section: the x-intervals of the band plus its end discs, sampled every 0.0004 and widened by one sample. It then clips each tooth ray against the rectangles in the transverse plane, with a 0.0005 clearance and the existing 3×3 conservative minimum.
  - **Round path.** The round-wire path is unchanged; it keys its bake as before.
  - **Result.** Root radius 0.5495, tooth height 0.0705; the tips clear the disc face by 0.03.
- **Bake.** `node scripts/bake-contact-profiles.mjs` rewrote `spiralCut`. The crown, mangle and stepped-sector lines are byte-identical.
  - The script also re-serialises `wormCut` with the key order changed and without `maximumSeamResidual`. The worm's key is unchanged, so I restored that line verbatim from the committed file (031's own bake script is `bake-worm-drive-profile.mjs`).
  - Load time with the bake is 1.0 s; without it, 9 s.
- **Tests.**
  - `tests/spiral-drive-contact.test.mjs` is rewritten for the flat rib. At 69 phases, including the handoff at 0.747–0.753, it checks:
    - every rib triangle sample (vertices, edge midpoints, centroids) stays out of the rendered wheel;
    - no wheel vertex enters the analytic rib;
    - some wheel vertex is within 0.004 of the rib;
    - the tips clear the disc face.
  - Its ray-cast helper now also searches neighbouring grid cells, the same helper the 031 test uses.
  - `models.test` 29: the profile name is `sampled-flat-rib-spiral-envelope`, the rib has no caps, a flat top at `rib.top`, and is seated into the face.
  - Both pass.
- **Captures:** `me/29-sheet.png` (default, right, top, mesh zoom at ph 0.5, handoff zoom at ph 0.75).
- **Screens.** Disconnected: 0 detached, 1 near-miss (the unchanged gear shaft). Coincident faces: 0. Loop seams: 0.

## 031: the worm is now left-handed and still conjugate (medium)
- **Plate.** The front flanks lean "/". The model's leaned "\" (`/dev/shm/p93/a/z/31-worm.png`). The finding is confirmed.
- **Change** (`wormAndWheel`, new option `leftHand`, used only by 31):
  - **Geometry.** The pair is built as the exact mirror image of the right-handed generator in the wheel's mid-plane. The worm thread is reflected in worm-local x; the worm-generated wheel is reflected in wheel-local z (the skew of its teeth). Winding is reversed and normals are reflected (`mirrorGeometryAxis`).
  - **Spin.** `wormHandedness = -1`. The worm phase and speed are negated (−2.2), which is the reflection of the right-handed motion. The wheel's motion is unchanged, and so is its baked radial field: the `wormCut` key is unchanged, so there is no rebake.
  - **Other movements.** The option defaults off, so 202 and 264 keep their geometry.
- **Tests.**
  - `tests/worm-drive-contact.test.mjs`: the analytic hob checks now map through the mirror. The real-geometry torque test passes without change: the loaded-flank normals give positive wheel torque, and the power balance is under 2%.
  - `models.test` 31: the synchronised phase uses `wormHandedness`, and one input turn is |2π| of worm angle.
  - All pass.
- **Captures:** `me/31-zworm.png` (front ribs now "/", like the plate) and `me/31-sheet.png`.
- **Screens.** Disconnected: 0. Coincident faces: 0. Loop seams: 0.

## 043: camera and hub collar (low)
- **Plate.** The upper shaft falls about 19° to the right and the lower one rises at 46°. The upper wheel's toe carries a plain collar.
- **Why a roll alone won't do.** Rolling the view −17° would have tipped the lower shaft to about 32°. The model's two shafts subtended 51° on screen, against the plate's 65°.
- **Change.** I fitted the view to both shaft lines (`me/cam43*.mjs`, searching over view direction and roll). The fit also requires the lower wheel's axis within 6° of the picture plane and the upper wheel's toothed face toward the eye.
  - Root roll is now 10° (was 15°), and the camera direction is (0.374, −0.292, 0.880).
  - Result: the upper shaft falls 14.3° (Brown 18.8°), the lower rises 45.1° (Brown 45.8°), and the lower wheel is edge-on.
  - Closer fits exist (a 1.5° error), but they turn the lower wheel 17° face-on, against the plate.
- **Collar.** Each wheel's hub boss, which stands 0.08 proud of its toe, is now the wheel's own material (`hub-collar-at-bevel-toe`) instead of a bare black stub.
- **Captures:** `me/43-sheet.png` (plate, default, right, left) and `me/43-cand.png` (the candidates I rejected).
- **Tests.** `models.test` 43 and `angular-bevel-clearance` pass.
- **Screens.** 0 detached. The 90 near-misses are the tooth-to-tooth running clearances, unchanged. Coincident faces: 0. Loop seams: 0.

## 063: dark pins and one straight flat spring (medium)
- **Plate.** One straight flat spring runs to the drop's tail, and the striker and stop pin are small open circles. There is no strap.
- **The "hairpin".** It was the leaf spring plus an undrawn fixed strap running parallel behind it, from the clamp block to the stop pin. In side and top views the two read as a wire loop.
- **Change** (`snapActionStarCounter`):
  - **Strap:** removed.
  - **Clamp block:** now only 0.1 deep, in the spring's own plane.
  - **Stop pin:** a plain fixed stud spanning the drop's depth (z −0.36…−0.12).
  - **Spring:** one flat strip of constant section, 0.07 in the plane by 0.038 deep, in front of the drop and behind the pawl.
  - **Pins:** the striker and the stop pin are dark steel (`PALETTE.frame`) instead of near-white #c3c7c1.
  - **Unchanged:** the baked contact motion and its fingerprint. The live-solver test still reproduces the bake.
- **Captures:** `me/63-sheet.png` (plate, default, right, top, spring zoom).
- **Tests.** `movement-063` passes 6/6 and `models.test` 63 passes.
- **Screens.**
  - The disconnected screen now lists `fixed-drop-stop-pin` as a floating fixed stud (gap 0.21 from the drop, not persistent). This is the price of dropping the undrawn strap.
  - Brown draws the pin with no support, like the other fixed axles of this movement.
  - Coincident faces: 0. Loop seams: 0.

## 133: platen guide ears and a flush head (medium)
- **Plate.** The crossbar's ends lie over the two columns, and the head is one block with a moulded cornice.
- **Before.** The platen (z 0.18–0.58) floated 0.46 in front of the columns (z −0.58…−0.28). The anvil was a separate shelf running 0.77 forward of the head.
- **Change** (`handCrankPinionSectorRodPress`):
  - **Guide ears.** Each crossbar end carries one rectangular guide ear, the platen's own height and material. It wraps its column with 0.004 running clearance on all four faces, with 0.06 walls, and joins the crossbar's back face. The platen is now visibly guided on the columns.
  - **Head.** The anvil, spacers and header all come forward to z 0.59, just proud of the platen's front face. The anvil still covers the platen in x and z. The cornice overhangs by 0.05 all round.
- **Clearance.** The ears clear the pinion (0.046 at the lowest platen pose), the sector, the pinion bracket (it is below the stroke) and the anvil.
- **Captures:** `me/133-sheet.png` (plate, default, right, side, upper zoom, top) and `me/133-zears.png` (both ears, oblique front and rear).
- **Tests.** `sector-press-frame.test.mjs` passes 6/6. It now checks, at 721 poses:
  - two ears exist;
  - each wraps its column;
  - no ear vertex is inside a column;
  - the running clearance is between 0.003 and 0.005;
  - the non-ear platen parts clear every support.
- **Screens.** Disconnected: 0 detached; the same 12 near-misses as the audit. Coincident faces: 1 pre-existing pair (column against pinion bracket, contrast 0.04, not visible). Loop seams: 0.

## 504: B/G tooth "penetration" (fork 504)
- **Cause.** The 0.050 overlap in `502-505-gear-solids.json` was the teeth screen testing the three hidden per-output rows, `twenty-tooth-working-row-of-thick-B-meshing-{E,F,G}`. `epicyclic-503-504-contact.js` sets these rows to `visible=false`. The drawn part is the one thick B (`inputRowB`), which meshes with E, F and G, as on the plate.
- **Change.** `scripts/review-epicyclic-teeth.mjs` now pairs 504's outputs with `inputRowB`, as `review-503-504-contact-solids.mjs` already did. No production geometry changed.
- **Result.** `502-505-gear-solids.json` regenerated at 33 poses each. 504: 370,638 queries, 0 penetrations. 502, 503 and 505 still have 0.
  - `503-504-contact-solids.json` and `506-507-gear-solids.json` needed no regeneration: their hashes match, and 504 was already clear there (minimum gaps 0.00056–0.00058).
- **Captures:** `504/{def,bg-front,bg-oblique,top-p50}.png`.
- **Tests.** `epicyclic-503-504-contact`, `epicyclic-family-clearance` and `movement-502`…`505`: 38/38 pass.

## 229, 310, 312: sawtooth outlines trimmed, material only (fork cusps)
- **229.** The wheel outline is generated data (`chain-drive-profiles.js`, built by `scripts/generate-chain-drive-profiles.mjs`).
  - The generator now runs `trimOutwardCusps` (maxSegment 0.01) on 229's outer ring. 228's entry and 229's hole ring are byte-identical.
  - Outer ring: 168 → 112 vertices, zigzags 112 → 0. Material added: 0. Removed: 1.8e-6 area, at most 2.5e-4 deep.
  - Brown's deep one-sided hook notches (the audit's separate low item) remain open.
- **310, 312.** These are stroke-joint corner steps (≤0.0004 proud of the joint discs), not swept cusps.
  - **Helper.** `outline-cusps.js` gained a `tinySegment` option, default 0. With the default, 038 and 314 hash identically.
  - **Where it is applied.** `createSweptPlateRegistry` in `authored-gravity-escapements.js` applies it at load to the baked arm rings of 310 and 312 only.
  - **Bake.** The baked plates file and its `inputHash` are unchanged, and the fingerprint test passes.
  - **Checked with polygon clipping** (0 added area in every case):

| Arm | Zigzags | Area removed | Max depth |
|---|---|---|---|
| 310 left | 73 → 0 | 2.9e-3 | 3.8e-4 |
| 310 right | 76 → 1 | 3.0e-3 | 4.1e-4 |
| 312 left | 68 → 2 | 4.4e-4 | 3.7e-4 |
| 312 right | 68 → 2 | 2.3e-4 | 3.6e-4 |

- **Screens.** The faceting screen flags nothing on 229, 310 or 312. The other screens are unchanged with the trim on and off.
- **Geometry hashes.** I hashed every `authored-belts` ID, plus 309–312, 38 and 314: only 229, 310 and 312 changed.
- **Captures:** `cusps/{before,after}-{229,310,312}-*.png`.
- **Tests.** `movement-229/309/310/311/312/314`, `gravity-escapement-working-solids` and `stepped-sector-contact` pass.

## 242, 243: flat bands, 242's lever (fork B)
- **242.**
  - **Strap:** it now has split normals per face (`makeDynamicFlatBand`), so it shades as a flat band.
  - **Lever:** now one plate extrusion with a bored fulcrum eye (r 0.17) and lower eye (r 0.145), in `band-drive-working-parts.js` (only 242 uses it). It replaces the stepped two-plate wedge.
  - **Pins:** 0.012 proud of the stack (were 0.03).
  - **Faceting:** 20 → 0.
- **243.**
  - **Ribbon:** split normals per face.
  - **Quarter-twists:** they now end a quarter-span before each guide (`twistSpan 0.75`), so the band reaches each guide flat and centred on its face. The belt's length and path are unchanged.
  - **Faceting:** 20.27 → 0.
- **Captures:** `B/sheet-{before,after}-{242,243}.png`.
- **Tests.** `movement-242`, `movement-243` and `band-drive-working-parts` pass.
- **Screens:** 0 detached, 0 coincident faces, 0 loop seams.

## 196, 201, 216, 210 (fixed); 207, 192, 198 (assessed) (fork G)
- **196.** The pedestal, block and stand eye are now in the arm's plane, just behind the strap. `pedestalBack` 0.095 puts the pedestal at z 0.095…0.315 and the block at 0.035…0.375; the eye is at z 0.205.
  - The pivot pin now spans only the eye and the strap (0.085…0.50; it was −0.70…0.50).
  - Wheel A's shaft is trimmed to its hub plus the strap.
  - The wheel (x < 1.7) stays clear of the block (x ≥ 1.85).
  - Files: core and `irregular-gear-family.js` (196 branch only).
- **201.** The rocker is now one flat bell-crank extrusion:
  - a bored boss (r 0.42, bore 0.115) on the pivot;
  - a tapered upright arm to a bored boss on the pinion shaft, which was previously unsupported;
  - a tapered horizontal arm to Brown's slotted oval eye.
  - Removed: the torus, rails, caps and junction bars.
  - Rod A's pin runs in the slot. Near-misses fell from 8 to 2.
- **216.** The web moved forward (`carrierCenterZ` −0.279). The ring root and the sector root disc seat 0.015 into it, so the member is one body (the ring was detached by 0.053).
  - The web uses the shared see-through style.
  - The pinion shaft ends at the pinion's back face.
- **210.** The bar is 0.30 wide (was 0.16), Brown's proportion.
- **207, not changed.** The shaft fills the worm's bore. A thicker shaft needs a re-bored worm and trimmed wheel tips, plus a rebuild of `feed-worm-207-working-faces.json`.
- **192 and 198.** I agree with p93-fc: six teeth are forced by the pitch and the rack.
- **Report.** `191-196-201-contact.json` regenerated: 513 poses each, 0 overlap. Minimum gaps: 191 0.00265, 196 0.00063, 201 0.00071.
- **Captures:** `G/after/sheet-{196,201,210,216}.png`, `G/after/201-zooms.png`.
- **Tests.** `movement-196/201/210/216` and `irregular-gear-family` pass.
- **Screens.** Coincident faces 0, loop seams 0, body intersections 0.

## 206, 211, 213 (fixed); 225 (forced, unchanged) (fork I2)
- **211.**
  - **Pin.** The entry pin's radius is now 0.25 construction units (Brown's small stud; it was 0.375). Its centre is 1.20 pin radii inside the outline, so the pin stands wholly on the face (edge screen 0.80 → clear).
  - **Hump.** Grown to 2.625, so the pin-centre contact arc (2.887), the guide law and the handoff are unchanged.
  - **Tongue.** Brown's bean width (0.8 → 1.3).
- **206.** The pin eye half-width goes from 0.17 to 0.23, concentric with the pin; the pin head radius from 0.12 to 0.105.
- **213.** The tooth backs are hollowed: a quadratic sag of 0.35 of the tooth depth, as drawn. The count (22) and the tips are unchanged.
- **225, not changed.** Over the drive, the tooth behind the nose rises to 0.125 across the pivot–nose chord.
  - Any bar that clears it needs a sagitta of at least about 0.45, and a nose-only bend is the hook the audit rejects.
  - Brown's sharper teeth cut the intrusion only to 0.106 and broke return-seam continuity.
  - Everything was reverted byte-identically. A fix needs the return path and the tooth form solved together.
- **Captures:** `I2/{before,after}-sheet-211.png`, `after-211-pin.png`, `after-206-eye.png`, `after-213-6ratchet.png`.
- **Tests.** `movement-206/207/211/212/213/214/225` and `carrier-pawl-225-contact`: 44/44 pass.

## 235, 237 (fixed); 236 (not fixed) (fork I1)
- **235.**
  - **Star:** the root is now 0.59 of the tip (Brown's stubby points; it was 0.41). The 52° raked drive face is kept.
  - **Tappet nose:** on Brown's dashed swing arc (204.3, 297 px); the swing is now 13.4°. The return releases on actual contact with the next point.
  - **Blade:** scaled to the new hinge–nose length.
  - **Holding click:** now one crescent swelling into a large eye concentric with its pivot.
  - **Bake:** `baked/star-tappet-paths.js` regenerated; `--check` reproduces it.
- **237.**
  - **Crown teeth:** each is one curved wedge per pitch: a helicoidal ramp, walls on the cup's exact radii and a radial drive face. The stepped rim and the flat shading are gone.
  - **Seating:** the nose now seats at 0.130 (was 0.40), below a third of the tooth height, and bears on the drive face. Overtravel is 0.8 pitch, so the swing is 32.4°.
  - **Pawl:** one spline sweep with a single round nose cap; a cap-winding bug that made the hooked notch is fixed.
  - **Return envelope:** rebaked with nose and plate tested against the tooth solids. The minimum clearance is −7e-9 on the nose and 0.0002 on the plate.
- **236, not fixed.** Seated noses make the half-cycle handoff jump (about 0.37 at phase 0.5), because the idle rest solve assumes corner contact.
  - The attempt is saved in `I1/*.attempt.js`.
  - The function and `alternating-pawl-236-working-parts.js` are byte-identical to their starting state. I released the claim.
- **Captures:** `I1/{b,a}235.png`, `I1/{b,a}237.png`, `I1/a237z.png`.
- **Tests.** `movement-235/236/237`, `star-tappet-working-parts` and `crown-pawl-237-contact` pass.
- **Screens.** Coincident faces 0, loop seams 0, faceting 0.

## Reports and bakes (pose counts kept; none carries `sourceCommit`)
- **Regenerated** (whole-file hashes of the core file and `irregular-gear-family.js`):
  - `200-226-bevel-solids.json` (33 poses; 200 and 226 clear)
  - `202-264-worm-solids.json` (33 poses; clear)
  - `191-196-201-contact.json` (513 poses; clear)
  - `502-505-gear-solids.json` (33 poses; the screen script changed)
- **Bakes:** `src/data/contact-profiles.js` (`spiralCut` only), `baked/star-tappet-paths.js` and `baked/crown-pawl-237-return.js`.
- **Stale sweep.** Every `docs/validation` report, baked JSON/gz and provenance file was checked against every file changed here.
  - The only mismatch is `141-review.json`, which hashes `authored-belts.js`. It carries `sourceCommit`, so it is historical and left alone.
  - Nothing hashes `authored-intermittent-core.js`.

## Tests
- **`models.test.mjs`:** 163/163 pass.
- **Targeted batch:** 29 files, 158/161 pass (`/dev/shm/p93/g/tests-batch.log`). The files are:
  - authored-loader, crease-normals, source-presentation and loop-seams;
  - the gravity, chain, band, bevel, special-worm, irregular and spiral/worm contact suites;
  - sector-press-frame and angular-bevel;
  - the movement files for 63, 196, 201, 202, 206, 210, 211, 213, 216, 229, 242, 243, 310, 312 and 504.
- **The three failures:**
  - **227 link penetration 0.00196** (`chain-drive-working-parts`): from p93-fc's 227 change. 227's hash is unchanged by 229's trim.
  - **151 `source-presentation` removal pattern:** another lane's 151.
  - **237 loop seam:** the batch ran while fork I1 was mid-edit. A rerun of `loop-seams` with 235/236/237 gives 39/39 pass.
- **Loop seams** for all 19 IDs changed here: 0.

## Proposed ledger rows
| ID | Assessment | visibleFlaws | Limits (append unless noted) |
|---|---|---|---|
| 029 | reasonable | empty | Replace the round-wire inference with: "p93-g: flat rib (0.10 × 0.10) in the disc's material with round plan ends; spur teeth cut exactly against the rib's plane sections." |
| 031 | reasonable | empty | "p93-g: left-handed worm as drawn: exact mirror of the right-handed generated pair; the worm turns the other way." |
| 043 | reasonable | empty | "p93-g: view fitted to both shaft lines (upper −14° against Brown's −19°, lower 45° against 46°); hub collars in each wheel's colour." |
| 063 | minor | "Stop pin is a free-standing fixed stud (Brown draws no support); the disconnected screen lists it floating." | "p93-g: undrawn strap removed; one straight flat spring; dark steel pins." |
| 133 | reasonable | empty | "p93-g: platen guide ears wrap the columns (0.004 clearance); the head is one flush block with a 0.05 cornice." |
| 504 | minor (p93-ff's lip lead) | empty | "p93-g: the B/G penetration was the screen testing hidden rows; 0 against the drawn thick B." |
| 229 | unchanged | unchanged | "p93-g: swept-cut tip cusps trimmed (≤2.5e-4, material only)." |
| 310, 312 | unchanged | unchanged | "p93-g: stroke-joint corner steps (≤0.0004) trimmed at load; material only." |
| 242 | reasonable | empty | "p93-g: strap with split normals; lever one plate with a concentric fulcrum boss; pins 0.012 proud." |
| 243 | reasonable | empty | "p93-g: band with split normals; twists end a quarter-span before each guide." |
| 196 | reasonable | empty | "p93-g: pedestal, block and eye in the arm's plane; pin spans eye and strap only." |
| 201 | reasonable | empty | "p93-g: rocker is one bell-crank extrusion with bored bosses and a slotted eye." Braided-belt low still open. |
| 216 | reasonable | empty | "p93-g: ring and sector root seat in the see-through rear web." |
| 210 | unchanged | unchanged | "Bar at Brown's width." |
| 211 | reasonable | empty | "p93-g: entry pin r 0.25 wholly on the face; hump grown so the law is unchanged; bean-width tongue." |
| 206, 213 | unchanged | unchanged | 206: "pin eye 0.23 round a smaller head". 213: "hooked teeth with hollow backs". |
| 235 | reasonable | empty | "p93-g: star root 0.59 of the tip; tappet nose on Brown's swing arc; crescent click with a large eye." |
| 237 | reasonable | empty | Replace the pawl text (see the 237 section above). |
| 225 | minor | "Pawl bar arched (sagitta 0.5) where Brown's is nearly straight; the drive-end tooth behind the nose forces it." | Keep. |
| 236 | minor (unchanged) | "Pawl noses bear on the tooth corners instead of seating in the roots." | Keep. |
| 192, 198 | keep p93-fc's rows | | |

## Not done
- **236:** seating breaks the half-cycle handoff (see above).
- **225:** forced by the core geometry (see above).
- **207:** the shaft proportion needs a re-bored worm and rebuilt working faces.
- **Lows not reached:**
  - 196: strap width and the B stay;
  - 201: braided belt;
  - 216: transition-tooth faceting;
  - 225: pale plinth;
  - 229: Brown's hook notches.
