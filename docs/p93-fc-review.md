# Pass 93 fix review, lane p93-fc: movements 171–255

Reviewer: Claude Opus 5.5, lane p93-fc, with four forked sub-lanes (p93-fc-1 to p93-fc-4). Date: 2026-09-28. Audit: docs/p93-audit-171-255.md. Captures and scratch are in /dev/shm/p93/fc/ (outside Git): me/ and f5/ for the central lane, f1/ to f4/ for the forks. "Before" is the audit's /dev/shm/p93/c/sheets/NNN.png. No git writes.

Deferred because the file is owned by p93-f (authored-clamps.js, authored-gears-core.js, authored-intermittent-core.js, feed-worm-assembly-parts.js): 190, 196, 201, 216, 211, 225, 235, 236, 237, the tooth counts on 192 and 198, and the lows 206, 207, 210 and 213. Deferred because the file is owned by p93-fa (authored-belts.js): the lows 229, 242 and 243.

## Central lane p93-fc: 174, 180, 227, 234, 244, 247 and lows 218, 220, 222

Scratch and captures: `/dev/shm/p93/fc/me/` (174/180) and `/dev/shm/p93/fc/f5/` (the rest). "Before" is the audit's `/dev/shm/p93/c/sheets/NNN.png`.

Claims (p93-fc): `mujoco-bench-clamp__physics.js`, `mujoco-single-clamp__physics.js` (plus their profile/solids and `baked__*-clamp.js`, claimed but not edited), `clamp-working-parts.js`, `chain-drive-working-parts.js`, `authored-escapements.js`, `authored-sounding-weights.js`, `authored-wool-comber.js`, `authored-offset-crank-slots.js`, `authored-elliptical-idler-gears.js`.

### 174 — high, fixed (MuJoCo rebake)
- **Verdict:** real. Over the settled cycle the jaws turned 0.0007 rad. A rigid passive jaw has nothing to open it once the board is withdrawn, so every reinsertion met the jaws where the last one left them. The first insertion was the only one that turned them.
- **Fix:** `src/simulation/mujoco-bench-clamp/physics.js`. Each jaw hinge now has a light return spring: stiffness 0.5, damping 0.25, rest angle 0.1 rad open (upper +0.1, lower −0.1). The default initial opening is 0.1, up from 0.06. Brown draws no spring; it stands in for the workman knocking the jaws open.
- **Motion:**
  - On withdrawal both jaws turn about 0.10 rad open, which lifts the noses clear of the board.
  - On reinsertion the board's end strikes the crossed tails. That turns both jaws shut until the noses bear on the faces, as the caption says.
  - The clamped pose is unchanged: upper 0.0029, lower 0.0020 rad, board X 0.035.
  - At the clamped pose the spring torque is under 0.05, against the drive's force limit of 10.
- **Regenerated:**
  - `174-native-cycle.json`: coarse/fine timestep differences are 0.0020 upper, 0.0016 lower, 0.0016 board X and 0.0008 board Y. Both runs have minimum gap 0 and contact on both jaws.
  - `174-native-study.json`.
  - `174.json.gz` and `174-bake.json`: 1,156 keys, 285,857 bytes, maximum error 9.9e-7.
  - `174-assembly-clearance.json`: 129 poses, 2,474,778 queries, no intersections.
  - `174-dense-contact.json`: 4,621 poses, 32,291,548 queries, no intersections.
  - `174-existing-contact.json` (legacy baseline) and `174-source-fit.json`.
  - `174-browser.json`, whose packaged spec passes.
  - Every 174 report's source hashes now match.
- **e2e fix:** the spec's first-frame wait went from 0.3 s to 1.5 s in `tests/e2e/twin-bench-clamp.spec.mjs`. At 0.3 s the first render was not settled, so exact restart failed by 13,264 px. It failed identically with the HEAD bake, which makes it a pre-existing timing flake. With a 3 s wait restart is exact.
- **Captures:** `me/strip-174.png` (8 phases plus left and top views) and `me/zz.png`: nose and tail zooms at ph 0 (closed, bearing) and ph .45 (open gaps).
- **Tests:** `movement-174` passes 3/3. The new test checks that each jaw turns more than 0.08 rad per cycle and is closed at t=0.
- **Screens:** no detached parts and 0 coincident pairs; loop seams 0.
- **Ledger:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "p93: the jaws' opening between strokes comes from an inferred light hinge return spring (stiffness 0.5, rest 0.1 rad open) standing in for the workman; closing onto the board is contact-driven."

### 180 — high, fixed (MuJoCo rebake)
- **Verdict:** real, for the same reason as 174: the jaw's range over the settled cycle was 0.
- **Fix:** `src/simulation/mujoco-single-clamp/physics.js`. The jaw hinge has a return spring (stiffness 0.5, damping 0.25) with a rest angle of 0.12 rad open; the initial opening is 0.12, down from 0.16.
- **Motion:** each withdrawal turns the jaw about 0.12 rad open. Each insertion turns it shut against the board's top corner and face. The clamped pose is unchanged (jaw 0.0020).
- **Script fix:** `scripts/probe-single-clamp.mjs` now compares the no-contact control with the run's own opening parameter, instead of a hard-coded 0.16.
- **Regenerated:** 180's native study and native cycle (qualified: timestep differences 0.00056 jaw, 0.00064 X, 0.00038 Y), bake (746 keys, 291,839 bytes, maximum error 5.0e-6), assembly (129 poses, 1,192,476 queries), dense contact (2,981 poses, 11,560,318 queries), existing-contact, source-fit (3.25 px) and browser (spec passes). All hashes now match.
  - These reports also fingerprint `authored-clamps.js` (owned by p93-f). If p93-f edits that file for 190, the 180 reports go stale again.
- **Low not done:** the board still hangs below the side-piece while withdrawn. It is the whole board shown past Brown's break.
- **Captures:** `me/strip-180.png` and `me/zz.png` (top and lobe zooms, closed against open).
- **Tests:** `single-clamp-baked` passes. It now asserts a jaw range above 0.1 rad and a closed jaw at t=0. `movement-180` (the legacy factory) also passes.
- **Ledger:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "p93: the jaw's opening between strokes comes from an inferred light hinge return spring (rest 0.12 rad open); closing is contact-driven."

### 244 — medium, fixed
- **Verdict:** real.
  - Lever D spanned z 0.21–0.39, entirely in front of the wooden block (−0.145…0.205).
  - The block rose to 0.66, beside the lever rather than under its 0.53 underside.
  - The pan's centre was at z 0.05, while its ring was at z 0.3.
- **Fix:** `clamp-working-parts.js`, new `centreProny244OnDrum` (244 path only).
  - The lever, its nuts, bolts, ring and hook pin and lug all move back 0.3, into the pulley's mid-plane.
  - C and C′ are centred at z 0.
  - The block is rebuilt with a flat top at the lever's underside and the full brake depth.
  - At z 0 the bolts' old eyes would sit inside the strap's end links. Each bolt now ends in a plain fork instead: two 0.03 cheeks and a bridge, straddling the end link on its hinge pin, clipped outboard of the block.
  - The pan, rims and weights are centred under the ring and the cords are re-laid.
- **Hash check:** 287 shares the file and hashes identical (45f304bee0f796ae).
- **Screens:** only C and C′ are floating, as drawn. 0 coincident pairs, 0 seams.
- **Tests:** `movement-244` passes 10/10 (new p93 test). `models` passes.
- **Captures:** `f5/244-sheet.png`: plate, default, top, left, side (pan under ring), and two block zooms.
- **Ledger:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "p93: lever D, ring and stops centred on the pulley; strap-end bolts end in forks round the end links."

### 227 — medium, fixed via helper
The chain is built in `authored-belts.js`, which is owned by p93-fa. The fix is in `chain-drive-working-parts.js`.
- **Verdict:** partly real.
  - The chain is already link-through-link in alternating planes, which is what Brown's caption requires ("the links being in different planes, spaces are left between them for the teeth"). Flat two-hole plates on common pins would contradict the caption.
  - What read badly was the edge-on links: a thin wire loop with two broad box straps laid on it, so each looked like a box joined by wire rings. The 0.095 "gap" is strap to plate across the wire.
  - The star flanks did bulge: the control point lay 0.056 outside the notch-to-tip chord.
- **Fix:**
  - Each edge-on link is now one swept piece on the same loop path. It is broad along the sides (half-width 0.11, as the straps) and narrows smoothly through each end bar to a half-width of 0.045, so it still passes the plates' 0.048 eyes. The straps are hidden.
  - The notch departure went from 38° to 22°, so the flank control point lies 0.049 inside the chord. The flanks are hollow.
- **Hash check:** 228 and 229 are identical.
- **Screens:** near-misses went from 16 to 0 and coincident pairs are 0.
- **Tests:** 227, 228 and 229 pass. The 227 test was updated for the one-piece loop.
- **Captures:** `f5/227-sheet.png` and `f5/227-ba.png` (before and after).
- **Ledger:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "p93: edge-on links one swept piece (broad sides, narrowed end bars through the plate eyes); star flanks hollow."

### 234 — medium, fixed (cup); flags disputed
- **Cup, verdict:** real. The band was a 64-sided extrusion, while the 13 teeth were true arcs at the same radii (2.06 and 2.20). The flats stepped against the teeth by up to 0.0026, and the outline read faceted from above.
- **Cup, fix:** `authored-escapements.js`, in the 234-only `hideGroundFor234`, via the new `unifiedToothedCup234`. The band and teeth are now one closed wall between true circles, keeping the same tooth law:
  - tips at each tooth's mount angle;
  - a linear back over 0.8 of a pitch;
  - a flat 0.2-pitch gap at the band top;
  - a vertical leading face.

  The separate teeth are hidden but still carry the contact data.
- **Hash check:** 238, 299, 300, 301 and 302 are identical.
- **Flags, verdict:** disputed. Each flag plane passes through S's axis; the neck's upper edge sits 0.06 above the axis, inside the rod. That is Brown's flag hanging from the rod. The "hover" at ph .5 is a verge's released flag: only one flag bears on a tooth at a time.
- **Screens:** coincident pairs went from 13 to 0 and there are no detached parts.
- **Tests:** `movement-234` passes 9/9 (new p93 test).
- **Captures:** `f5/234-sheet.png` and `f5/234-j.png` (flag joints).
- **Ledger:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "p93: toothed cup one smooth wall with the saw cut in."

### 247 — medium, partly fixed
- **Verdict:** real. The station drift (the vessel moving on) is rigid, but the 200-wide bottom was featureless, so the spent weight seemed to glide by itself.
- **Fix:** `authored-sounding-weights.js`. The bottom has alternating 2.5-wide tone bands (shades 1 and 0.9, vertex colours), which is the shared speed-cue idea for featureless moving parts. The bottom now visibly carries the weight.
- **Kept:** the loop design (rod hauled out of view, fresh weight threaded on above the view). Its tests still pass: no pops, the view is never empty, and no weight is unsupported in view.
- **Residual:** the rod still leaves the view during the reset beat. The undrawn hand and the wide bottom remain (lows).
- **Screens:** the 3 coincident pairs are pre-existing.
- **Tests:** `movement-247` passes 11/11.
- **Captures:** `f5/247-strip.png` (12 phases, zoomed out).
- **Ledger:**
  - assessment: minor
  - visibleFlaws: "Loop reset: the rod leaves the view while the next station moves in."
  - limits (append): "p93: banded bottom so the station move reads."

### Lows
- **218, fixed:** the H shaft ran from z −0.47 to 1.15, 0.58 proud of the rocker and 0.52 behind the wheel. It now runs from 0.02 to 0.62 (`authored-wool-comber.js`). 217 hashes identical. Tests pass. Capture: `f5/218-sheet.png`.
- **220, fixed:** the wrist pin now projects 0.65 beyond the slotted arm, up from 0.45. This matches the plate's ratio of about 0.34 of the input shaft's projection (`authored-offset-crank-slots.js`). The camera framing is a documented deliberate trade and was left alone. Tests pass.
- **222, fixed:** link C–B had the grey frame material. It now uses ink, like link A–B, which has the same role. 221 hashes identical. Tests pass.
- **251, not changed:** the pile head and pile are the caption's "pile-head" that W falls onto. Removing them would leave W striking nothing.
- **254, disputed:** the fork arms are already capsules with rounded ends in the plate plane. The "square" look is the 0.2 extrusion seen edge-on.
- **Not done:** 219, 221 teeth, 224, 229, 242 and 243 (`authored-belts.js` is owned by p93-fa), 246 and 252. None is quick and clearly right.

## Sub-lane p93-fc-1: 172–190 (not 174/180)

Scratch and captures: `/dev/shm/p93/fc/f1/`. "Before" is the audit's `/dev/shm/p93/c/sheets/NNN.png` and `/dev/shm/p93/c/171/`.

Claims (p93-fc): quadrant-catch-finite-parts.js, quadrant-catch-motion.js, authored-quadrant-catches.js (claimed, not edited), authored-locomotive-valve-gears.js, authored-curve-generators.js, authored-engine-couplings.js, authored-variable-cranks.js, authored-gab-disengagers.js (claimed, not edited), gab-disengager-189.js.

### 183, 184 — medium, fixed
- **Verdict:** the finding is real. The lower quadrant, the upper wing and the upper C-arm were raw pixel traces. The overlay `f1/plot2.png` (old in green, new in red, over the plate) shows the wobble. The audit's facet screen had creases up to 23°.
- **Fix:** in `src/simulation/quadrant-catch-finite-parts.js`, new `lowerQuadrantOutline()`, `upperWingOutline()` and `upperArmOutline()` replace the three traces.
  - **Lower band:** the rim (bandRadius) and an inner rim at 111 px are true arcs about the lower shaft. The end cuts are straight, following the traced end lines, so the latching left end is kept. Each web flank is one circular arc through three plate points into the boss. The anvil window is the inner-rim arc, two concave three-point arcs and a straight foot.
  - **Wing:** the rim arc about the upper shaft. The top tab is straight segments, the upper edge is one straight line into the boss, and the lower edge is one convex arc down to the toe. The toe is still cut to the band's rim. The pointed window is an arc at 112 px, concentric with the shaft, plus three-point arcs. The wing now stops 1 px inside the boss, so its bore wall no longer doubles the boss's. The first coincident-face run flagged that pair; the rerun has 0 flagged pairs.
  - **C-arm:** two Catmull-Rom splines through cleaned edge points, ending in a round hook concentric with one centre.
- **Motion rebaked** with `scripts/bake-quadrant-catch.mjs`, new sha 0c472f97…. The timed laws are unchanged. Against the old table, the solved upper angle differs by at most 1.1° and the lower lock angle by at most 4.1°.
- **Validation report** `docs/validation/183-current-solids.json` regenerated (65 poses): worst penetration is 4.5e-5, down from 1.8e-4.
- **Screens:**

  | Screen | 183 | 184 |
  |---|---|---|
  | Faceting | score 0 (was flagged up to 23°) | one 15.2° corner, where the plate's radial tip cut meets the straight upper edge. The traced version had the same cut; it is a drawn corner. |
  | Coincident faces (after the boss fix) | 0 pairs | 0 pairs |
  | Disconnected parts | no detached parts | no detached parts |

  Two leads on the disconnected screen are not visible:
  - The C-arm root "lip" (0.088) was there before (0.073).
  - The quadrant stops 2 px short of the lower bore inside the opaque boss. This is a new near-miss.

  Loop seams: 0.
- **Captures:** `f1/sheet-183.png`, `f1/sheet-184.png` (plate, default, 2.2× zoom, ±50°, top, ph .33/.66, 3× zoom), `f1/hubz.png`, `f1/plot2.png`.
- **Tests:** `quadrant-catch-finite-interfaces`, `movement-183` and `movement-184` all pass (13).
- **Ledger 183/184:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "Pass 93: quadrant, wing and C-arm outlines rebuilt from arcs concentric with the shafts, three-point arcs and smooth splines (not pixel traces); motion rebaked."

### 185 — medium, fixed
- **Verdict:** real. The wall block was #cfcabf, luminance 0.79.
- **Fix:** `authored-locomotive-valve-gears.js` sectioned-wall material changed to #8a8276 (sRGB luminance about 0.51, mid stone).
- **Captures:** `f1/a-185-{def,left,top}.png` (in `f1/lows.png`).
- **Tests:** `movement-185` passes (7). A new assertion checks the wall's linear luminance is between 0.15 and 0.4.
- **Screens:** no detached parts, 0 coincident faces.
- **Ledger:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits: unchanged

### 190 — medium, deferred
- The holder cheeks, standard and shoe outlines, and the shoe colour and thread lows, are all built inside `authored-clamps.js`. That file is owned by p93-f (`/dev/shm/p92/claims`), and no unclaimed helper is in 190's path.
- Deferred: file owned by p93-f.

### 172 — low, fixed
- The tracer was a 0.04-radius brass nub. It is now Brown's ring: a brass eye (r 0.1, bore 0.046) seated on the rod's front face, round a dark pin in the rod bore.
- `docs/validation/172-clearance.json` regenerated (129 poses, no intersections).
- **Tests:** `movement-172` passes (5, with a new eye test).
- **Captures:** `f1/a-172-*.png`.
- **Ledger:** no change beyond noting that the tracer ring is drawn.

### 177 (and 176) — low, fixed
- The rear "bearing" was a loose torus hanging off the input shaft's end. 176, the paired engaged view with the same model, had the same torus, so it is fixed too.
- It is now a plain bored ring (0.372/0.5, 0.15 deep), seated on the shaft 0.085 inside its end, like the front bearing. The change is in the 176 path `qualifyEngagedGeometry` and the 177 path `qualifyReleasedGeometry`.
- The 176/177 depth asserts were relaxed from the torus's reach to the shaft end (min z < −1.12, size z > 2.3), and both tests now assert the ring is not a torus.
- The disconnected screen still lists 177's whole rear rotor, now with its bearing, as a group floating 0.54 from the front coupling. This is the released coupling by design; Brown draws no frame.
- **Captures:** `f1/a-177-rear.png`, `f1/a-176-rear.png` (the 176 capture predates its fix; the geometry was verified in a node probe).
- **Validation reports:** the 176/177 reports (176-assembly, 177-assembly, 176-selector-mount, 176-177-slot-consistency, 177-browser, 177-existing-solids) were already stale at HEAD for `authored-engine-couplings.js`, so they were not regenerated.
- **Tests:** `movement-176` and `movement-177` pass.

### 178 — low, partly fixed
- The undrawn square rear flange behind the guide disk is removed (no-supports policy).
- The empty eye at the rod's far end is removed, so the rod ends plainly past the plate. The tool slide and its pin are not shown by presentation, so the eye used to hang empty.
- **Not done:** Brown's inner circle on the disk. An earlier pass deliberately removed it as ink edges. Adding a raised land is a design choice, not a quick fix.
- `178-current-solids.json` was already stale at HEAD, so it was not regenerated.
- **Tests:** `movement-178` passes, with a new test for no flange and no empty eye.
- **Captures:** `f1/a-178-{def,left,behind}.png`.

### 189 — low, fixed
- **Verdict:** the long grey cylinder was the stud boss (`fixed-bell-crank-stud-boss`, reaching back to the hidden wall at z −0.8), not the stud. Verified by hiding roles in `f1/m189.png`.
- It is now a short collar (z −0.26…−0.16) behind the crank.
- `docs/validation/186-187-cam-solids.json` regenerated (186–189, no intersections).
- **Tests:** `movement-189` passes, with a new collar-depth test.
- **Captures:** `f1/a-189-{stud,top,def}.png`.

### Not done (lows)
- **173 C-frame:** declined in p90 and not clearly right. It would need a structural redesign.
- **179:** fingerprinted by its MuJoCo study.
- **181/182 handle curls:** the meshes come from the baked diagonal-catch bundle. Changing them needs a rebake.
- **181–184 light-grey flush shafts:** not changed. A darker grey would read even more like a bore; the current grey reads as a shaft (`f1/hubz.png`).

### Broader tests
- `gab-joint-solids` and `models`: 167 passed, 0 failed.

### Screens run
- `/dev/shm/p93/fc/f1/disc.json` and `disc2.json` (disconnected parts)
- `cf.json` and `cf2.json` (coincident faces)
- `facet.json` (faceting)
- `seams.log` (loop seams): 8 IDs, 0 seams, 0 pops

# p93-fc-2: 191, 192, 196, 197, 198, 216

All six movements are built in `authored-gears-core.js`, which p93-f owns. I made the fixes through per-movement helpers that I claimed as p93-fc:
- `reversing-mangle-guides.js`
- `baked/reversing-mangle-cavities.js`
- `mangle-rack-working-parts.js`
- `baked/mangle-rack-working-profiles.js`
- `irregular-gear-family.js` (claimed but left unchanged)

Scratch and captures are in `/dev/shm/p93/fc/f2/`. The "before" captures are the audit's `/dev/shm/p93/c/`.

**Byte-identity.** `f2/hash.mjs` hashes world-space geometry at three phases.
- Before and after hashes are in `f2/hash-before.txt` and `f2/hash-after.txt`.
- Only 192 and 198 changed.
- 191, 193, 194, 196, 197 (geometry), 199, 216 and 36 are byte-identical.
- The regenerated 193 cavity and the 197 working profile are byte-identical to the old ones.

## 192 (medium): partly real; fixed within the six-tooth count
- **Tooth count (disputed).** The auditor saw the p92-g exact involute correctly: it has six teeth, and six full-depth involute teeth are long, pointed petals (`/dev/shm/p93/c/192/z-pin-noUJ.png`). Going to 8–10 teeth at the same pitch is not right for this plate:
  - The count is fixed by Brown's tooth pitch and by the small radius of the tooth row's hooked U-turns, which the pinion must round.
  - The pinion's circumference is 2π·0.1946 = 1.223, which is 6 × the rack pitch of 0.204.
  - Eight teeth would need a pitch radius 1.33× larger. That means a new groove path and new kinematics in the core, which p93-f owns.
- **Tooth form (fixed).** The six teeth are now stub involutes, with addendum and dedendum 0.8 module (tip 0.2465, root 0.1427) where they were 1.0/1.0. They read as blunt, square-topped gear teeth, not a flower. The wheel's conjugate cavity was regenerated offline from the new outline (`scripts/generate-reversing-mangle-cavities.mjs`). 193's entry is unchanged.
- **Proud face (real, fixed).** The pinion ran from z 0.185 to 0.555 and the tooth land ends at 0.36. Its face is now 0.185 to 0.375: 0.015 proud of the land, with no coplanar faces.
- **Captures:** `f2/after192.png`, with the plate, default, pinion front with the UJ hidden, side, left −50, ph .33, ph .66 zoom and UJ front.
- **Tests.** `tests/reversing-mangle-finite-guides.test.mjs` now asserts the 0.19 face, the stub radii and a front 0.01–0.02 proud of the land. It passes 12/12, and the cavity clearance checks through both reversals still pass. `movement-192`, `-193` and `-194` pass.
- **Screens.**
  - Coincident faces: 0.
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. The near-miss count is 109 (28 short-of-pin), against 111 (28) in the audit. These are the same running clearances.
  - Loop seams: 0.
- **Proposed ledger row.** Assessment `reasonable`. visibleFlaws: "" (the UJ-yoke low remains).
  - Limits, append: "p93: six stub involute teeth (0.8 module) — six is set by Brown's pitch and U-turn radius; pinion face trimmed to the tooth row (0.015 proud); cavity regenerated."
- **Low, not done.** The UJ yoke still covers the pinion hub in the default view. It now sits 0.29 in front of the pinion's face.

## 197 (medium): real, fixed
- **Pins.** They were the rack's own blue. They are now brass (`PALETTE.brass`) and read as Brown's pin circles.
- **Shadows.** The factory had already switched off the pins' shadow casting, but the render-time `shadow-policy.js` switched it back on. That produced the "/////" hatch. The pins are now tagged `userData.noShadow`. They keep `receiveShadow` and stand on the rack floor, so they do not read as floating.
- **Pin length.** The pins can't be shortened: they must span the pinion's face (z −0.05 to 0.29), and they now run from the rack face at −0.156 to 0.27.
- **Captures:** `f2/after197.png` (plate, default, 2.2× zoom), `f2/after197-198.png`.
- **Tests.** A new test in `movement-197.test.mjs` checks the brass, noShadow, cast and receive settings. It passes.
- **Screens.**
  - Coincident faces: 5 pairs, identical to the audit's list (pinion bore and hub, guide mounts). The audit dismissed them as not visible.
  - Disconnected parts: 0 detached, 0 slivers.
  - Loop seams: 0.
- **Proposed ledger row.** Assessment `reasonable`. visibleFlaws: "".
  - Limits, append: "p93: rack pins brass and shadow-exempt (noShadow) so the pin row reads as Brown's circles without hatch-like stem shadows."
- **Lows, not done.** The default frame fills about 52% of the width, and there are the tab mounts.

## 198 (medium): partly real; tooth form fixed, count deferred
- **Plate.** Brown draws about 8 square-topped teeth on a large hub (`f2/p198pin.png`).
- **Why six teeth.** The model's rack has 36 teeth on a 12.6 path, a pitch of 0.42. With the plate's pinion pitch radius (0.401), 2πr/pitch = 6.0, so six is the only count that meshes with the rack. Brown's own drawing is inconsistent: his pinion tooth pitch is about 16 px against the rack's 22 px.
- **Tooth form (fixed).** The thin 6-petal star is now six stub involute teeth (0.8 module; tip 0.508, root 0.294) with a full hub, and the rack was recut against them (`scripts/generate-mangle-rack-working-profiles.mjs`). Rack heights now range −0.106 to 0.108; they were −0.134 to 0.148.
- **Captures:** `f2/after197-198.png` (bottom row: default, pinion zoom, oblique).
- **Tests.**
  - A new test in `movement-198.test.mjs` checks the stub radii and the outline.
  - `mangle-rack-working-contact`, `movement-198` and `movement-199` pass.
- **Screens:**
  - Coincident faces: 0.
  - Disconnected parts: 0 detached, 0 slivers.
  - Loop seams: 0.
- **Deferred (core, p93-f).** An 8-tooth pinion needs one of two core changes in `fixedPinionLiftedMangleRack`:
  - a pitch radius ×4/3 with the same 36-tooth rack, which moves the capsule path, carrier and links; or
  - the rack recut at 48 teeth, which changes the tooth tiles and `circularPitch`.
- **Proposed ledger row.** Assessment `minor`.
  - visibleFlaws: "Pinion has 6 (stub) teeth where Brown draws ~8; the count is fixed by the 36-tooth rack and the pinion pitch circle."
  - Limits, append: "p93: pinion recut as six 0.8-module stub involutes with a full hub; rack regenerated against it."

## 191 (medium): disputed, no change
- **The spike is Brown's step.** At the reset step, the wall runs straight from the low-side root to the high-side tip: the step (root to root, 0.13 C) plus a flush tooth. The plate crop `f2/p191seam.png` shows the same thing: one straight radial face at x≈360 from the low root down through the adjacent tooth's tip (about 235 px scaled, against about 110 px for an ordinary tooth, a ratio of 2.1; the model's ratio is about 2.5).
  - The outline plot `f2/seam191.png` shows a square radial wall and a normal-width top on the high-side tooth, with no protrusion beyond it.
  - p90-fa measured and set this step (0.13 C) from the plate.
  - It reads as a "spike" only when seen edge-on in rotated phases.
- **The teeth.** They are generated conjugate to the other scroll by one hobbing rack, and the varying radius makes their flanks asymmetric.
  - I re-hobbed at a 7° rack angle, against 14.5° now (`f2/gip.py`, `f2/teeth191.png`). Overlap stayed 0, but the maximum gap rose to 0.0103 (limit 0.0105), and the teeth came out barely squarer.
  - Not adopted. The 14.5° re-run reproduced the baked outline exactly, which confirms the inputs.
- **Proposed ledger row.** Unchanged. Keep the existing limit that the teeth are conjugate-generated trapezoids.

## 196 (medium): deferred, file owned by p93-f
- **The finding is real.** The pin runs from z −0.70 to 0.50, the strap is at 0.33–0.48, and the stand eye, pedestal and block are at −0.75 to −0.41.
- **Why it can't be fixed here.** The pedestal and block (`fixed-tapered-pedestal-under-arm-pivot`, `fixed-block-under-pivot-pedestal`) are created in `authored-gears-core.js`, in `fixedPinionIrregularVibratingWheelCarrier`, after `correctIrregularGearFamily` returns. The helper can't move them without a hack.
- **Fix for the owner.**
  - Core: set `pedestalBack` to about 0.095, which puts the wall block at z 0.035–0.375, behind the strap.
  - `irregular-gear-family.js` (196 branch): eye `carrierBearing.position.z` to 0.205, and `pinLow` to 0.085.
  - The wheel (x ≤ 1.7) stays clear of the block (x ≥ 1.85).

## 216 (medium): deferred, file owned by p93-f
- **Where it lives.** The web, ring and central body are built only inside `compoundMutilatedExternalInternalGearReverser` in `authored-gears-core.js`. No helper is called for 216.
- **Fix for the owner.**
  - Set `carrierDepth` and `carrierCenterZ` so the web's front face is at −0.187, just behind the ring's back face at −0.182.
  - End the reversing-pinion shaft at the pinion's back face.
  - The web already uses `DoubleSide`. For the "opaque from behind" low, it would also need the see-through style.

## Deferred list
- 196: `authored-gears-core.js`, owned by p93-f (pedestal plane).
- 216: `authored-gears-core.js`, owned by p93-f (web gap).
- 198: tooth count needs the core, owned by p93-f.
- 192: tooth count is Brown-constrained (see above). The 8–10-tooth fix would also need the core.

# p93-fc-3: 200, 201, 205, 226 (medium); 202, 204, 207, 210, 239 (low)

Files claimed (p93-fc): bevel-200-226-corrections.js, irregular-gear-201.js (unused), variable-drive-205-209-parts.js, generated-variable-drive-205-209.js, special-worm-solids.js, opposed-spur-239-working-parts.js. No core file touched.

## 200 (medium): fixed
- Verified: both wheels ran loose on one stationary spindle, so nothing showed the two speeds. Brown draws the upper wheel on a wider sleeve, with the thin shaft running through it.
- Fix (`singleInclinedTwoSpeedBevel`, bevel-200-226-corrections.js):
  - The upper wheel is re-bored (0.206) onto a sleeve (outer radius 0.2, bore 0.121) that runs from its hub up to y 1.0 and turns with it.
  - The spindle is now the inner shaft, fast to the lower wheel and turning with it. It still shows above the sleeve and below the lower wheel.
  - Both carry the quadrant speed cue.
  - The transmission and state now report the sleeve and inner-shaft speeds.
- Tests: movement-200 3/3 (updated: fastOnSleeve and fastOnInnerShaft, sleeve and shaft rotations equal their wheels' rotations). bevel-200-226-solids 5/5.
- Report: `docs/validation/200-226-bevel-solids.json` regenerated (33 poses, 0 penetrations).
- Captures: /dev/shm/p93/fc/f3/200-sheet.png
- Ledger: assessment reasonable; visibleFlaws ""; limits append "Upper wheel fast on a sleeve and lower wheel on the inner shaft (Brown's two speeds on one shaft line); fits reconstructed."

## 226 (medium): fixed
- Verified: frame A was 1.3 behind F, joined by bent rods (spoke, tie, collar), and an undrawn cantilever and strut crossed D's face.
- Fix (`correctSixBevelTrain`):
  - Frame A is one flat frame, band 0.26 and 0.14 thick, centred on F at z 0 in the plate plane. Its x extent runs from frameLeftX to -0.985, clear of hollow shaft C.
  - F passes through the two end bars in round bosses cut into the frame: the right boss is fast on F (bore 0.080), and the left boss runs on E's sleeve (bore 0.182).
  - D's stud now runs radially from z 0.1 to 1.3, out of a spider boss fast on F under D (x -1.53 to -1.27).
  - The cantilever and support struts are hidden, and the collar, spoke and tie are removed. Nothing crosses D.
- Screens:
  - Disconnected: 0 detached. There is one hinge near-miss between the frame and hollow C, which are separate rotating parts 0.02 apart.
  - Coincident faces: 0.
- Tests: movement-226 7/7 (new p93 test). bevel-200-226-solids updated for the bosses and spider (5/5).
- Captures: /dev/shm/p93/fc/f3/226-sheet.png
- Not done (low): D's teeth still show round its face-on disc.
- Ledger: assessment reasonable; visibleFlaws ""; limits replace the frame text with "Frame A a flat frame centred on F in bored end-bar bosses; D on a radial stud in a spider boss fast on F (Brown's stud fixing hidden)."

## 205 (medium): fixed properly
- Verified:
  - The front teeth were involute tips on a narrower shank, which read as boots or L-shapes.
  - The back teeth had involute tips on sunk root keys, and the keys showed as pads.
  - Brown draws plain rectangular bars: long bars in front and short squares behind.
- Fix (`correctVariableDrive` 205):
  - Every tooth, in both rows, is now one plain four-corner rectangular bar enclosing the old involute tooth (full width, out to its tip).
  - The bars run in to r 2.62 on their wheel face and sink 0.01 into it. From the front, the rear bars show only beyond the rim, as Brown's short squares.
  - The root keys are hidden.
  - The cams were regenerated against the bars through the documented pipeline (export, then generate-205-209-profiles.py): 251 points, 99.06% of the blank retained.
- 209's generated profile is byte-identical. The 208 and 209 geometry hashes are unchanged (8b47764cefe420ac, a3531a576d0e4d24).
- Report: `docs/validation/205-208-209-contact.json` regenerated.
  - 205: 513 poses, 0 overlap, maximum gap 0.00145 (was 0.00109).
  - 209: unchanged.
  - 208 pin slots: 167 poses, 0 inside.
- Screens: disconnected 0, coincident faces 0, loop seams 0.
- Tests: movement-205 7/7. The shank test was updated: bars are plain four-corner rectangles, and the cam may run along a bar's side but never enter it (0.0066 closest). 208, 209 and variable-drive-205-209-solids pass.
- Captures: /dev/shm/p93/fc/f3/205-sheet.png
- Ledger: assessment reasonable; visibleFlaws ""; limits append "Teeth are Brown's plain bars; the two cams are generated conjugate to them (offline envelope); load-free prescribed motion."

## 201 (medium): deferred, file owned by p93-f
- The bell-crank pieces (tapered carrier, torus collar, slot rails, caps and junctions) are all built inside `authored-gears-core.js`.
- irregular-gear-201.js runs before the carrier exists and has no post-build hook, so no helper can replace the pieces.
- The finding is real. The fix is to make the vertical and horizontal arms, a round boss concentric with the shaft, and the slotted end one flat extrusion, and to drop the torus.

## 202 (low): fixed
- The worm shaft radius goes from 0.084 to 0.196, about 0.08 of the wheel diameter, as Brown draws it. The integral Hindley worm is re-bored to 0.2; its 0.308 waist root keeps a 0.1 wall.
- 264, which shares the file, is hash-identical (283b7b50b51ee1c6).
- Report: `docs/validation/202-264-worm-solids.json` regenerated with POSES=33 (the script defaults to 17). 0 penetrations, gaps unchanged.
- Tests: special-worm-solids, 202 and 264 pass.
- Screens: the one coincident pair is between instanced wheel sectors. It predates this change, with identical area in the audit's cf.json.
- Captures: /dev/shm/p93/fc/f3/lows.png

## 239 (low): fixed (pivots and journals)
- The stops' undrawn bored journals and support posts are hidden. Each fixed pivot is trimmed to its boss (z -0.01 to 0.41 against the boss's 0 to 0.4).
- The stops are now fixed pivots with no frame, like 238, 240 and 241. The disconnected screen lists them as detached, which is expected.
- The output-shaft journal is kept.
- The teeth are still narrower than Brown's. Not done: that changes the stop contact design.
- Tests: movement-239 3/3. Captures: /dev/shm/p93/fc/f3/lows.png

## 204 (low): disagree
- Brown's stubs are about 0.09 of the roller end diameter. Ours already read thicker than that in the audit's sheet (sheets/204.png). No change.

## 207 (low): deferred, file owned by p93-f
- The shaft is built in `feed-worm-assembly-parts.js` and the core, both p93-f.

## 210 (low): deferred, file owned by p93-f
- The bar and shaft are built only in `authored-gears-core.js`.

## Deferred list
- 201 (medium) and 210 (low): authored-gears-core.js is held by p93-f.
- 207 (low): feed-worm-assembly-parts.js is held by p93-f.
- 226 low: D's teeth still show outside its face-on disc.
- 239 low: tooth width not changed.

# p93-fc-4: movements 206, 211, 213–215, 225, 232, 233, 235–237, 240 and 241

Lane p93-fc-4 made no git writes. Scratch files and captures are in `/dev/shm/p93/fc/f4/`. The core file (`authored-intermittent-core.js`) is owned by p93-f, so every fix here was made in a helper.

Claims held by p93-fc: `ratchet-stop-240-working-parts.js`, `ratchet-stop-240-contact.js` (not edited), `gear-finger-stop-working-parts.js`, `geneva-stop-working-parts.js`, `lantern-stop-233-working-parts.js` and `single-tooth-241-working-parts.js`. The 225, 236 and 237 helper claims were released after their changes were reverted.

## 240 (medium): fixed
- **Verified.** The hook and straight gravity stops each took turns being lifted to a "park" angle 0.10 above their riding path, so each hovered with nothing lifting it for most of the cycle. In the audit screen they measured 0.17 and 0.28 floating.
- **Fix.** In `stateStops240` (ratchet-stop-240-working-parts.js), all three stops now stay engaged through every stroke. Each follows its own baked finite-clearance path (`baked/ratchet-stop-240-paths.js`), which is valid for any one-pitch drive:
  - The toe rides the ramp and drops onto the steep face.
  - Over the whole cycle, toe clearance runs from 0.0005 to 0.039 for the hook and straight stops, and 0.052 for C.
  - At the source pose all three are `reverse-locked-on-steep-face`.

  Low fix: stop C's traced top edge and curled knob now pass through centripetal splines instead of a polyline, which removes the 21° facets.
- **Regenerated.** `scripts/generate-ratchet-stop-240-paths.mjs` was rerun and the output is byte-identical. The smoothing does not change the paths.
- **Tests.** `movement-240`: 8/8. Test 4 was rewritten to "keeps all three stops riding the teeth", and the source pose now expects the straight stop to be seated.
- **Screens.** No stop floats any more; only the 0.016 bore-clearance near-miss on each hinge remains. Coincident faces: 0. Loop seams: clean.
- **Captures.** `240-strip.png` (plate plus 12 phases).
- **Proposed ledger row:** assessment reasonable; visibleFlaws "".
  - Limits, replace: "All three stops ride the teeth on offline finite-clearance paths; lift and drop are prescribed, and gravity or spring bias is not dynamically solved. C's S-spring bends by a prescribed blend."

## 214 (low): fixed
- **Fix** (gear-finger-stop-working-parts.js). Each finger plate now runs down to 0.016 above its gear face; it was 0.075. That 0.016 is the margin the existing test keeps over the opposing gear's face. The top and the stop plane are unchanged.
- **Proof.** 213 is not built by `correctGearFingerStop`, and its hash is unchanged (79f8eb67f8a5fa1e).
- **Tests.** `movement-214` 5/5, with a new assertion that the finger is less than 0.02 above the face. Capture: `low-sheet.png`.

## 215 (low): fixed
- **Fix** (geneva-stop-working-parts.js, id 215 path only). The crescent's back face now runs down 0.005 into the carrier disk's front face, so its z range is −0.26 to 0.17; it was −0.17 to 0.17. The slot wheel's layer is untouched.
- **Proof.** 212, which shares the file, has an identical hash (0484c5649ec03974).
- **Tests.** `movement-215` 5/5. The assertion that the crescent's back face is shared with the wheel was replaced by "seated 0.005 into the carrier face".
- **Screens.** Clean.

## 233 (low): fixed
- **Fix** (lantern-stop-233-working-parts.js). The fixed pivots are now short studs, 0.045 proud each side of their own part: the roller pivot spans z 0.70–0.94 and the latch pivot 0.485–0.735. Before, both were 1.6-long rods from −0.63 to 0.97.
- **Tests.** `movement-233` 9/9 (with a new stud test) and `lantern-stop-233-contact` 5/5.
- **Screens.** The two coincident-face pairs are unchanged, the same pairs as before (dismissed by the audit as shadow aliasing).

## 241 (low): fixed
- **Fix** (single-tooth-241-working-parts.js). The holding click is now a broad horn. Circles along its centre line thicken the eye half on both sides, tapering from 0.2 to nothing at 60% of its length. The working half and the nose are untouched.
- **Tests.** `movement-241` 9/9 (with a new horn-width test) and `single-tooth-241-contact` 5/5.
- **Screens.** The disk/hub coincident pair and the floating driver-tooth group were both present before (the audit dismissed them).
- **Captures.** `241-sheet.png`.
- **Not done:** trimming the black pins, whose lengths are set in the core.

## Deferred: file owned by p93-f (`authored-intermittent-core.js`)
- **225 (medium): real, but forced by the core.** The pawl bar's arch comes from `PAWL_SAGITTA_225` = 0.5. The plate's bar is about 0.057 of its 2.64 length (about 0.15). I tried 0.15–0.4 in the helper:
  - At 0.2 the bar cuts the next tooth by 0.007 at phase 0.
  - At 0.25–0.4 the bar clearance falls below the 0.00018 test margin, or goes negative.
  - At every value below 0.5, the core's return path, which uses the bar edge through `carrierPawlBarLiftLimit225`, loses C0 continuity at the phase seams.

  The core's pawl pivot height forces the arch. The fix is to lower or move the pivot in the core (p93-f) and then flatten the bar. The helper change was reverted.
- **236 (medium): real.** Both pawls contact tooth corners. The contact law ("outer corner of steep rising flank"), the pawl lengths and the stroke are all computed in the core, so seating the noses in the roots needs core changes.
- **237 (medium): real.**
  - The pawl's length and nose position come from the core (`b.pawlNose`) and the baked return.
  - I rebuilt the crown teeth as curved wedges flush with the cup wall (true arcs, keeping the wedge's own ramp planes). The visible surface matched the old ramp to within 0.0018. But using those triangles for contact gave a −0.055 clearance while climbing, and the return-constraint velocity error rose to 0.13–0.29, against a limit of 0.09. The core computes contact triangles before the helper runs, and I could not reconcile this with the bake in the time available.
  - The change and the rebake were reverted, so the files are byte-identical to HEAD. This needs the owner of the core and bake.
- **211 (medium).** The drive pin and wheel are built in the core (`pinGuidedHalfToothIntermittentLockingDrive`), and there is no helper.
- **235 (medium).** The star profile is built in the core and drives the contact (`profileClearanceAt`). The root radius can't change visually alone.
- **206 (low)** and **213 (low).** Built in the core, or dependent on the split-rim contact.
- **232 (low).** The suggested spacer bosses would be added parts, and the pin lengths are in the core. Skipped.

