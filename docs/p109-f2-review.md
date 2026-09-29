# Pass 109 fix lane p109-f2 (medium findings 173, 185, 260, 274, 321, 328, 335 and lows in owned files)

Reviewer: Claude Opus 5.5, lane p109-f2, 2026-09-29, three forked sub-lanes (A: 173/179–188; B: 256–297; C: 298–340). Captures under /dev/shm/p109/f2/{A,B,C}/. Vite :46162. No git writes.

Deferred: 225 (authored-intermittent-core.js owned by p109-f1).


## Sub-lane f2-A: 173, 185, 179, 180, 181–184, 188

Before captures are the audit's, under `/dev/shm/p109/c/NNN/`. After captures are under `/dev/shm/p109/f2/A/`, taken with the vite server on :46162.

Extra claims (all p109-f2):
- `assembly.js`, which covers `mujoco-silk-tappet/assembly.js` (173's production model) and `mujoco-diagonal-catch/assembly.js` (the 181/182 bake);
- `diagonal-catch-keys.js`, the generated key module for the 181 bake;
- `single-clamp.js` (`baked/single-clamp.js`, 180's production loader);
- `gab-disengager-188.js`, used only by 188.

### 173 (medium): verified, fixed
- **Finding.** Verified. Production 173 is `mujoco-silk-tappet/assembly.js`; `authored-silk-traverses.js` is not the served model. Its disc received the shadows of the yoke, the guide rod, the screw frame and the fixed guide bearing, bracket, foot and neck. These parts stand up to 1.3 in front of the disc, so the shadows landed as a U, a band and Γ-shaped blobs.
- **Change.** The disc is now tagged `noShadow`, so it neither receives nor casts shadows. It is the rearmost part and there is no ground, so nothing lies behind it to be shadowed. Every other part still casts shadows under the shadow policy. The old authored factory treated `diskFace` the same way. Geometry was not an option: the yoke, rod and guide must clear the star wheel's orbit, whose teeth reach z 0.853.
- **Captures.** `173-after.png` (default, ph .33, yaw ±50) shows a clean disc against the audit's `173/zA1.png`.
- **Reports.** `173-assembly-clearance.json` was regenerated (129 poses, 0 intersections), and so was `173-source-fit.json`. The bake's provenance does not include `assembly.js`, so the bake is unchanged.
- **Test.** Added to `movement-173-assembly.test.mjs`: after the shadow policy runs, the disc neither casts nor receives, and the yoke, rod and guide group still cast.
- **Proposed ledger row.** Assessment: reasonable. visibleFlaws: none. Limits to append: "p109: the disc takes no shadows (Brown's clean face); the parts in front still cast."

### 185 (medium + low): verified, fixed
- **Finding.** Verified. The common eccentric shaft ran z ±1.325 against sheave faces at ±0.35.
- **Change 1.** `cylinderAlongZ(0.135, 0.76)`: the shaft now ends 0.03 past each sheave face.
- **Change 2 (low).** The wall's diagonal shadow wedge came from the bed and lug, which stand 1.1–1.7 in front of the wall. The sectioned wall block is now `noShadow`; it is the rearmost part and there is no ground. The bed and lug still cast onto the moving parts.
- **Camera.** Left as it was. The mechanism already spans about 85% of the frame width, so the tightening is not clearly right.
- **Captures.** `185-after.png`: default, ph .33, yaw ±50, top, and an eccentric zoom. The black post and the clock-hand shadow are gone, and the wall is plain.
- **Test.** `movement-185.test.mjs`: the depth asserts now read z > 2.2, min < −1.0 and max > 1.19 (set by the rockshaft). A new assert checks the shaft ends at ±0.37–0.39.
- **Proposed ledger row.** Assessment: reasonable. visibleFlaws: none. Limits to append: "p109: eccentric shaft trimmed to ±0.38; the wall takes no shadows."

### 179 (low): verified, fixed
- **Change.** The crankshaft now runs from −0.385 to 0.795, which is 0.025 past the front face (0.77) and 0.027 behind the strap's back (−0.358). `geometry.shaftLength` keeps its value for compatibility.
- **Captures.** `179-after.png` (six views): no black post.
- **Report.** `179-current-solids.json` was regenerated (129 poses, 0 intersections).
- **Test.** `movement-179.test.mjs`: the depth asserts are updated (the foundation and pins now set the depth), and a new assert checks the shaft sits 0.01–0.04 proud at each end.
- **Proposed ledger row.** Assessment: reasonable, unless other open lows remain on 179's row. visibleFlaws: none from this item.

### 180 (low): verified, fixed
- **Finding.** Verified. At the open end of the recorded swing (jaw 0.1245 rad) the jaw tip reached world x −1.490, against the side-piece's left face at −1.440. That 0.05 overshoot showed as a blue tick.
- **Change.** A load-time visual adjustment in `baked/single-clamp.js`, next to the existing screw and bolt trims. At the extreme angle, jaw vertices within 0.15 of the limit (face + 0.01) are compressed smoothly along the world x axis with an exponential soft-clamp. The tip keeps a rounded end and stays inside the face over the whole swing: the minimum is now −1.399.
- **Physics unaffected.** The jaw has no contact with the side-piece (contype/conaffinity 1/2 against 1/2), and the board lies far below the tip. The bake, the profile and the native qualification are therefore unchanged, and so are their fingerprints. The alternative was to change the profile, which would have forced a native re-qualification and a rebake.
- **Captures.** `180-after.png`: default, ph .5, a tip zoom, the back, a back zoom and yaw.
- **Test.** Added to `single-clamp-baked.test.mjs`: the jaw's minimum x over the swing lies 0.02–0.08 inside the face.
- **Proposed ledger row.** Assessment: reasonable. visibleFlaws: none. Limits to append: "p109: the jaw tip is compressed at load so it stays inside the side-piece over the swing (visual only; the tip has no contact)."

### 181–184 (low): verified, fixed
- **Change.** The pivot shafts and pins are now `#7e8584` (`PALETTE.muted`) instead of the pale `#9aa19d`:
  - 181/182 in `mujoco-diagonal-catch/assembly.js`;
  - 183/184 in `authored-quadrant-catches.js`.
- **Rebake.** The 181 bake serialises its materials, so it was rebaked with `node scripts/bake-diagonal-catch.mjs`. The input hash matched `/dev/shm/181-contact-motion.json`. The rebake kept 9001 keys and 775 compact keys, and the motion is byte-identical: only `assetSha256` changed in the keys module, and only the provenance fields changed in `181-bake.json`. `181-baked-assembly-clearance.json` was regenerated (129 poses, 0 intersections).
- **Captures.** `181-184-after.png`: the pins read as grey pins, not holes.
- **Tests.** Added to `diagonal-catch-baked.test.mjs` (181/182) and `movement-183.test.mjs` (183/184): no pin or shaft keeps `#9aa19d`, and steel-grey pins exist.
- **Proposed ledger rows.** Assessment: unchanged by this item, since the other open lows still stand (181/182 handle-tip scrolls). visibleFlaws: remove "pale pins read as holes".

### 188 (low): verified in part, fixed
- **Finding.** The inner-edge ledge and bow below it are Brown's. His edge below a's ledge does bow out to x ≈ 214, and the ledge is about 19 px deep, as modelled. The real defects were two:
  - a 2–4 px jog on the outer edge, where the head's top (x 238 at y 170) stood outside the bar's outer edge (x 234.2);
  - a 62° riser that made the barb point.
- **Change** (`gab-disengager-188.js`, head polygon):
  - The outer edge now leaves the bar's own offset edge (traced points at y 154–182) and continues as one smooth Catmull-Rom curve.
  - The riser falls nearly square, like Brown's ~78° corner, with a small rounded root.
- **Captures.** `188-after.png`: default, ph .5, notch zooms, yaw and back. The plate crop is `188-plate-crop.png`.
- **Report.** `186-187-cam-solids.json` was regenerated: 186–189 all show 0 intersections.
- **Tests.** `movement-186`–`189` pass.
- **Proposed ledger row.** Assessment: reasonable, if no other flaw is open. visibleFlaws: none.

### Screens and tests
- **Screens** (`/dev/shm/p109/f2/A/{disc,cf}.json`, IDs 173 and 179–185, 188):
  - Disconnected: counts are identical to the audit baseline. The hits are the documented frameless rotor or stud groups (173, 179) and running clearances.
  - Coincident: 0 flagged pairs.
  - Loop seams: 9 checked, 0 seams and 0 pops.
- **Tests.** The 20 targeted files and `models.test.mjs` pass (163/163). See `tests2.log`.

## Sub-lane f2-B (pass 109): 260, 274, 244, 251, 261, 265, 284, 295, 297

Reviewer: Claude Opus 5.5 (p109-f2 sub-lane B), 2026-09-29. The working tree was served by vite on :46162. Captures are in `/dev/shm/p109/f2/B/` (outside Git).

**Common checks:**
- Tests: 16 files, 131/131 pass (`tests.log`): movement-244, 251, 260, 261, 265, 274, 284, 297, plate-escapements, lantern-pallet-contact, lantern-working-solids, differential-thread-solids, governor-274-357-solids, cone-friction-solids, belts-1-23-clearance and authored-loader.
- Loop seams (`check-loop-seams --ids=…`): 9 checked, 0 seams, 0 pops.
- Coincident faces (`cf.log`): unchanged from the audit. Only 260 has a flagged pair, the documented nut/internal-thread pair with area 4e-6.
- Disconnected parts: no new detached parts, slivers or lips. The new near-miss rows are bore clearances of the new 260 bosses and plates, plus 244 hinge-pin rows that swap between sampled phases.
- Lantern bake: `generate-lantern-escapement-motion.mjs --check` passes, and the bake is unchanged.
- Validation report: `docs/validation/260-266-275-thread-solids.json` was regenerated with `POSES=33`. Only the source hash of `authored-differential-drives.js` changed; the results are identical and there are 0 penetrations.
- Shared files: each edit sits in a function or branch used only by its own ID. The 295 edit is inside the `!is294` branch of `cylinderEscapement`, so 294 and 288–293/296 are untouched. The 244 edit is inside `addProny244ShaftSection`.

### 260 (medium + low): fixed
- **Finding verified.** The left standard was two side bars with a top bridge. The screw guide and the input bearing were tori, and the short standard was two legs with a window that showed wheel E.
- **Change** (post-processing in `authored-differential-drives.js` after `correctDifferentialThreads`; the shared `differential-thread-solids.js` is untouched):
  - **Standards.** Each standard is now one plate extrusion, 1.48 wide and 0.25 thick, from the bed to the top:
    - left plate: top 2.56, bored 0.195 for A and 0.26 for C;
    - right plate: top at lowerAxisY + 0.72, bored 0.512 for the nut journal.
  - **Bosses.** Round bosses are concentric with each bore and filleted into the plate face with a 0.06 concave fillet and a 0.025 end round. They are built with `boredLatheGeometry` and start 0.01 inside the plate, so no faces coincide.
    - Left bosses on the outboard face: A r 0.30, C r 0.40, both 0.12 long.
    - Right thrust boss on the inboard face: r 0.70, 0.10 long, which leaves 0.02 to the nut's end collar.
  - **Removed parts.** All tori are gone: the input bearing, the screw guide, and the nut end rings, which are now plain turned collars (0.40–0.555). The side bars are detached from the frame.
  - **Knees.** The flared knee webs are kept at the plate's side edges.
- **Captures:** `before-260.png` / `after-260.png` (default, yaw ±50, back, left, right, top), `z260.png` (bosses from outside left, from behind, and the right plate).
- **Tests:** `differential-thread-solids.test.mjs` has a new test: no torus anywhere, the bars are removed, each plate has the right number of bored holes, and the bosses are bored. The journal-clearance test now checks the plate, the boss and the knees.
- **Proposed row:** assessment reasonable; visibleFlaws none. Limits (append): "p109: the standards are single bored plates with filleted round bosses (outboard for A and C, an inboard thrust boss for the nut journal); no tori remain."

### 274 (medium): the audit's gap was a sampling artefact; the width mismatch is fixed
- **Finding partly incorrect.** The roller is exactly tangent to guide B's round inner rail at every phase. The analytic gap is 0.0000 over 16 phases (`g274.mjs`), and a face-on zoom with the band hidden shows tangency (`z274c.png`).
- **Source of the 0.114.** It was a vertex-to-vertex distance: the wheel cylinder has vertices only at its rims (z ±0.18), and the rail's vertices lie near z 0.
- **What was real.** The wheel was 0.36 wide on a 0.17 rail. Whenever the rotor turned the arm obliquely, the wheel's face overhung the rail by 0.1 and read as floating (`z274-before.png`).
- **Change:** `rollerWidth = 2 * guideRadius` (0.17). The tread now lies on the rail across its whole width at every rotor angle. The kinematics are unchanged: the roller centre is still the guide centreline offset by guideRadius plus rollerRadius, the same offset 276 uses.
- **Captures:** `z274-before.png` / `z274-after.png` (4 phases, face-on and yaw 35), `z274b.png`, `z274c.png`.
- **Tests:** movement-274 and governor-274-357-solids pass; surfaceGap is 0 to 2e-16.
- **Proposed row:** assessment reasonable; visibleFlaws none. Limits (append): "p109: roller L is as wide as B's round inner rail (0.17) and is exactly tangent to it at every phase; the audit's 0.114 was a vertex-sampling artefact."

### 244 (low): fixed
- **Change:** `motive-power-shaft-through-drum-A` now spans z −0.375…0.345, ending 0.025 behind the hub (it was −0.905).
- **Captures:** `misc-after.png` (244 default, yaw +50, top).
- **Proposed row:** remove the stub item.

### 251 (low): fixed
- **Change:** the bowed leaf spring is `PALETTE.muted` steel grey, and its half-thickness is 2.4 px (1.5× the old 1.6). The centreline was raised by 0.8 px so that it still seats in the V. The deflection solver re-derives contact with the jaws.
- **Captures:** `251-after.png` (4 phases), `z251.png`.
- **Tests:** movement-251 passes, 8/8.
- **Proposed row:** reasonable if nothing else is open.

### 261 (low): fixed
- **Change:** the crank arm is steel grey `PALETTE.muted`, so it contrasts with the orange disk B and drum.
- **Captures:** `misc-after.png` (261 panels).

### 265 (low): fixed
- **Horn drum.** A flat rim band, 0.07 long and radius R + 0.03, now closes the big end, as Brown's double line shows, instead of the knife-edge lip.
- **Roller C.** It is now a flat, square-edged disc:
  - The tread is a gentle crown of radius 0.37 (0.017 sag at the edges) meeting each flat face in a 0.014 round.
  - A face ring keeps the smoothed round's normals off the flat faces, which had streaked radially.
  - `rollerTreadTubeRadius` is 0.37, so the exact contact law still holds. The contact stays at most 0.094 off the mid-plane (the tilt reaches 0.26 rad), within the crown.
- **Captures:** `265-after.png` (default, yaw ±, rim, roller), `265-rim.png` (roller face, with and without shadows; big-end rim).
- **Tests:** movement-265 and cone-friction-solids pass (no roller/drum penetration over the cycle).

### 284 (low, both): fixed
- **Click.** The knife point is gone. Both finger edges stop 4.4 px short of the old point, and a smooth quadratic round closes a blunt tip whose apex stays on the old point, so the reach and seat are unchanged.
  - I disagree with the audit about length. The finger's length and bow match the plate: Brown's click runs about 60 px from its eye to the root, so it was not shortened.
  - The eye is a true circle concentric with the pin, as before.
- **Pinion.** The eight-tooth feed pinion is brass, so it no longer merges with the blue ratchet and rack.
- **Captures:** `284-after.png` (click at 3 phases, pinion, default, yaw).
- **Tests:** movement-284 passes, 8/8. A first try, a round that retracted the apex by about 2 px, broke the feed schedule, so the apex is held on the old tip.
- **Proposed row:** reasonable.

### 295 (low): fixed
- **Finding verified.** The mark was cast by the cut cylinder: passage C with lips A and B stands 2.4 out of the wheel face toward the viewer. The upper-end parts are not drawn in 295.
- **Change:** for 295 only (not 294), `cylinder-passage-C-with-lips-A-B` is tagged `noShadow` and casts no shadow; it still receives. No geometry change was possible, because the passage's axial span comes from Brown's 294 side view of the shared model.
- **Captures:** `295-after.png` (default, phases .33 and .66, yaw +50). The mushroom mark is gone.

### 297 (low): fixed with castShadow=false
- **Why not lower the pallets.** Pallets B and C span z 0.86–1.59 because they must reach the see-through arm A at z 1.38–1.60, in front of the pin ends at 1.30. Dropping them to the pin ends would detach them from the arm.
- **Change:** they are tagged `noShadow` and still receive. The pins keep their shadows.
- **Captures:** `297-after.png` (3 phases plus yaw). The dark square is gone.

**Changed files:**
- `src/simulation/authored-differential-drives.js`
- `src/simulation/authored-parabolic-governors.js`
- `src/simulation/authored-belts.js`
- `src/simulation/authored-pile-drivers.js`
- `src/simulation/authored-combination-drives.js`
- `src/simulation/authored-cone-friction-drives.js`
- `src/simulation/authored-saw-feeds.js`
- `src/simulation/authored-plate-escapements.js`
- `src/simulation/authored-lantern-escapements.js`
- `tests/differential-thread-solids.test.mjs`
- `docs/validation/260-266-275-thread-solids.json`

## Sub-lane f2-C: 321, 328, 335 (+334), 307, 316, 318, 327

Captures are in `/dev/shm/p109/f2/C/`. The "before" captures are the audit's `/dev/shm/p109/c/NNN/tile.png`. Vite ran on :46162.

Screens (`--ids=306,307,316,318,321,326,327,328,334,335`):
- `screen-disconnected-parts`: 0 floating everywhere.
  - 335's detached count went from 1 to 0: the old rod-into-cylinder near-miss is gone.
  - 318's scale plate is still the documented free-standing scale. Its closest neighbour is now the pointer at 0.02; it used to be the rim at 0.08.
  - The other near-misses are running clearances, the same class as the audit's.
- `screen-coincident-faces`: unchanged against the audit. There is one sub-1e-4 pair each on 318 and 328, as before.
- `check-loop-seams`: 10 checked, 0 seams, 0 pops.

Display profiles: I ran `node scripts/measure-display-profiles.mjs 307 316 318 321 327 328 334 335`. Only the entries for 321 (floorY and motion bounds to −9.30), 328 (max z 2.22) and 335 (max x 4.60) changed.

Bakes: `node scripts/bake-maintaining-clock-clicks.mjs --check` passes, so 321's click paths are unchanged. No other bake or report fingerprints these files.

Tests: 176 of 176 pass in `movement-{306,307,310,311,316,318,321,326,327,328,329,334,335,336}`, `engines-326-345-clearance`, `watch-balance-interfaces`, `pendulum-journals`, `pin-escapement-working-solids`, `three-leg-dead-rest`, `engine-guide-solids`, `marine-parallel-solids`, `piston-guide-solids` and `maintaining-clock-{interfaces,bake}`.

### 321 (medium + low): verified
- **Change:**
  - The rope drum has barrel B's radius. `ropeDrumPitchRadius` went from 0.20 to 0.80, matching Brown's B circle at about 55 px, with the cord 62 px left of centre. The drum is a tube coaxial with B's arbor, behind G at z −1.0. The cord leaves its left tangent at x = −0.80.
  - The weight carries a ring eye: one flat bored tab, with its hole concentric with its round top. The cord ends in a spliced loop, lying across the eye's plane, that bears on the bottom of the hole.
  - The weight's travel scales with the drum. One drum turn per cycle is 5.0, where it was 1.26. The default camera therefore frames the whole fall (authored bounds and the display profile) instead of letting the weight leave the frame.
  - The plate-pose weight hangs about 1.2 lower than Brown's box. The 5/24-turn post-winding lift is now 1.05, and the eye's top keeps 0.12 clear of G's tips at the top of travel.
- **Captures:**
  - `321-b.png`: default, phases 0.4 and 0.78, back, yaw.
  - `321-z.png`: front eye, side splice, drum from behind.
- **Tests:** `movement-321` asserts the drum is at least 0.75, the ring eye exists, and the source weight station is within the lift plus the eye plus tolerance. The float tolerance on rope no-slip went from 8e-16 to 4e-15, because the drum radius is 4×.
- **Ledger:** minor. visibleFlaws: "The mechanism fills a smaller part of the default frame, because the whole 5-unit weight fall is framed." Limits to append: "The drum is at barrel B's radius (0.80), as Brown draws the cord leaving B; the weight falls one drum turn (5.0) per cycle. The plate-pose weight hangs about 1.2 below Brown's box, because of the 5/24-turn post-winding lift."

### 328 (medium): verified
- **Change:** `crossheadPlaneZ` = rodPlane − rodDepth/2 − 0.09 − 0.01, which is 1.17 (it was 0.55). The crosshead, piston rod B, its boss, the cylinder, cap, plug, stuffing box, neck and gland all move with it. The crosshead sits 0.01 behind the rod eyes, and its round ends are the plain eyes. Both `*-crosshead-forward-end-boss` posts are removed, and the joint pins shorten with the gap. The cylinder (z 0.29–2.05) stays below the flywheel's reach, so nothing collides.
- **Captures:** `328-after.png` (default, yaw±, top, side, zoom).
- **Tests:** the p96 boss test is replaced. The new test asserts no forward posts, a 0–0.02 gap from each rod eye to the crosshead, and rod B on the crosshead plane.
- **Ledger:** reasonable, unless the older rows carry other flaws. visibleFlaws: none from this finding. Limits: replace the forward-boss text with "crosshead, rod B and cylinder in the connecting rods' plane (0.01 behind the rod eyes)".

### 335 (medium + lows) and 334 (low): verified
- **335 change:**
  - The beam outline is mirrored past O: a full symmetric taper to ±12 units with an end boss at +12 (as 337/338 build it). The authored crop still frames Brown's view, and the default capture matches the audit's pixel for pixel.
  - The undrawn shaft-O wall bracket (shank and flange "mushroom") is deleted. Shaft O is a cut stub 0.02 behind the beam, as Brown sections it.
  - The piston rod is a flat eye at E plus a round rod (r 0.06, flush with the eye faces). A turned gland (flange plus neck, bored to the rod) sits on the cylinder cover, and the cover's hole matches the rod.
- **334 change:** six more rack teeth below the 17 working ones, down past the bed toward B, as Brown draws. The role is `plate-drawn-tooth-below-working-length-of-rack-B`, and the wear strip is extended to match.
- **Captures:** `335-after.png` (default, yaw±, top, back, gland zoom), `def-check.png` (default against the audit), `334-after.png`.
- **Tests:** a new 335 p109 test asserts no shaft-O bracket, a beam symmetric about O, a round rod and gland, and a camera crop under 0.3 of the beam's reach. It replaces the p96 flange test. 334's tests pass unchanged.
- **Ledger:**
  - 335: reasonable. visibleFlaws: none. Limits: "Beam whole and symmetric beyond Brown's crop (hidden drive end); shaft O is a cut stub with no wall bracket."
  - 334: the teeth low is closed. Limit to append: "six plate-drawn teeth below the working length never engage."
- **Not done:** 338's piston gland and default phase (that factory is not mine). The F-pin flange column on 335 is kept.

### 307 (low): partly verified
- **Stops:** the stop material was already `PALETTE.muted` (#7e8584), but lit face-on it rendered near-white. It is now #60676a, which reads mid-grey (`307-after.png`).
- **Legs:** not changed. A constant-width leg with a semicircular end would put the end outside the tooth radius at the working corner, which the D/E contact law and clearances depend on. That is not a quick fix.
- **Ledger:** minor. visibleFlaws: "legs taper to points where Brown draws near-parallel legs with rounded ends."

### 316 (low): verified
- **Change:**
  - The mercury column takes the house see-through style (`makeSeeThrough`, opacity 0.7, edge 0.95) after the cutaway pass, so the steel rod shows running down into it nearly to the bottom, as on the plate.
  - The adjuster handle's merged lathe geometry is welded and creased (`mergeVertices` plus `creaseIndexedNormals`, 40°). The square shoulders and ends now shade flat.
- **Captures:** `316-after.png`.
- **Ledger:** reasonable. visibleFlaws: none.

### 318 (low): verified
- **Change:** the SLOW/FAST scale plate moved from z −0.30…−0.215 to z 0.78…0.88, just 0.02 behind pointer T (z 0.90). It is still wholly outside the rim (inner edge 3.59 against the rim's 3.54). Its colour is now mid-tone silver #979287 (it was #c8c4ba). The engraved divisions stay hidden by the earlier no-tick-notation decision in `watch-balance-parts.js`.
- **Captures:** `318-after.png` (default, yaw±, top, side, back).
- **Ledger:** minor only if the ribbon's tube shading remains visible; that part is untouched. visibleFlaws: "spiral ribbon shades as a tube (open)".

### 327 (low): verified
- **Change:** a solid bottom end plug (r 0.205 in the 0.20 bore, 0.50 long) is flush with the cylinder's bottom face and stops 0.04 below the rod's lowest reach (−7.56).
- **Captures:** `327-after.png` (from below).
- **Tests:** `engine-guide-solids` 327 now asserts that the plug exists, sits flush and clears the rod. The bore-passage check runs above the plug.
- **Ledger:** reasonable. visibleFlaws: none.

### Other changed files
- `src/data/display-profiles.{json,js}` (entries for 321, 328 and 335 only; this is a shared data file).
