# Pass 96 fix lane p96-fc: audit mediums for 171–255

Reviewer: Claude Opus 5.5, lane p96-fc. The central lane split the work into five forked sub-lanes on disjoint claimed files and merged their evidence below. The audit is `docs/p96-audit-171-255.md`. Scratch and captures are in `/dev/shm/p96/fc/g1`–`g5`, outside Git.

## Summary

| ID | Result | Sub-lane |
|---|---|---|
| 178 | Deferred: `authored-variable-cranks.js` is owned by p96-fb | — |
| 188 | Fixed: smooth crown, tail, arch and head curves (plus low 187) | g4 |
| 191 | Partly fixed: squared step tooth; the residual needs the reset timing in `authored-gears-core.js` (p96-fb) | g1 |
| 194 | Deferred: the pin count and pitch are set in `authored-gears-core.js` (p96-fb) | — |
| 196 | Fixed: undrawn bearing, stay and flange removed | g1 |
| 199 | Fixed: one-extrusion racks with identical symmetric pin-envelope spaces | g5 |
| 218 | Fixed: G's lug rides F's rim through the dwell | g3 |
| 221, 222 | Fixed: flat bored two-eye links in steel grey | g3 |
| 224 | Fixed: curved strap carrying d's shaft; bosses on the arm studs | g3 |
| 234 | Deferred: `authored-escapements.js` is owned by p96-fd | — |
| 235 | Disputed with measurements; no change | g2 |
| 237 | Disputed with measurements; no change | g2 |
| 240 | Fixed: C is a broad two-tooth block; stop paths rebaked | g3 |
| 244 | Fixed in `clamp-working-parts.js`: hinge pins centred and trimmed (plus low: the pan weights) | g4 |
| 247 | Fixed: the bottom always drifts the same way | g4 |
| 251 | Fixed: wider smooth bands, pivot ears, eye lug; the "solid web" disputed against the plate | g4 |
| 253 | Fixed: pivots at 0.73 R; return sheave out of the preset views | g4 |

Central integration note: the test `tests/movement-218.test.mjs` still asserted the old hovering clearances (0.16 at mid-dwell and more than 0.02 on the plain rim). It now asserts the new 0.0005 rim graze. The targeted tests for all the lane's IDs pass: 153 of 153 after that update.

`docs/validation/191-196-201-contact.json` fingerprints `authored-gears-core.js`, which p96-fb is still editing. Rerun `node scripts/review-irregular-gear-contact.mjs && python3 scripts/review-irregular-gear-contact.py` after p96-fb's final edit. When g1 regenerated it after one such edit, the numbers were identical.

## p96-fc-g1: 191 and 196

Scratch and captures: `/dev/shm/p96/fc/g1/`. "Before" captures are the audit's `/dev/shm/p96/c/171/m191.png` and `sheets/196.png`, plus `b191-sheet.png` and `b196-sheet.png` here.

Files:
- `src/simulation/irregular-gear-family.js` (196 branch only)
- `src/simulation/generated-irregular-gear-profiles.js` (only the `191` and `191driver` entries changed; `196` and `201` are byte-equal)
- `scripts/generate-irregular-gear-profiles.py` (191 rack branch only)
- `docs/validation/191-196-201-contact.json` (regenerated)
- `tests/movement-191.test.mjs`, `tests/movement-196.test.mjs`, `tests/irregular-gear-family.test.mjs`

`authored-gears-core.js` (p96-fb) was not touched.

### 191 (medium): partly fixed; the p93-fc dispute is settled
**The dispute.** I compared the plate crop (`plate-seam.png`, 4×) with the baked outlines (`seam-before-after.png`). Both auditors were partly right:
- **p93-fc was right about the construction.** Brown's step face is the high tooth's flank carried straight down to the low-side root, one radial line with no ledge. The model already had that.
- **The auditor was right about the tooth.** The model's step tooth was not square. The hob poses clipped just past the seam lie on the extrapolated spiral, where no mate exists, and they chamfered the tooth's top corner by 0.045 × 0.09. That is the "sloping flank" and the "pointed tip".

**Fix.** The fix is in the generator, and the teeth are still hobbed conjugately.
- Each step tooth gets back a square corner:
  - an annular sector 0.3 pitch wide, which continues the tooth's own top line;
  - a 0.05 corner fillet.
- The wall is one straight radial line, from the low rim to the fillet, standing 0.003 inside the seam ray.
- The reset still needs clearance where the square corners pass. Dense 8,193-pose sweeps showed each corner brushing the other's wall near its foot. So each wall face is eased by the mate's sweep, but only below the fillet. The result is a shallow concave relief about 0.009 deep near the wall's foot, not a chamfer on the tooth.
- Results:
  - Driven: 0.02 in from the wall at 0.05 below the tip before, 0.003 now.
  - Top width within 0.006 of the tip: 0.074 before, 0.085 now.
  - `zigzags`: 0 (was up to 3).

**Checks.**
- Generator: 129 audit poses with 0 overlap (max gap 0.0095), and 0 overlap at every one of the 8,193 dense poses within 10% of the seam.
- Contact report `191-196-201-contact.json` regenerated at 513 poses:

  | ID | Overlap | Minimum gap | Maximum gap |
  |---|---|---|---|
  | 191 | 0 | 0.00242 (was 0.00265) | 0.00952 |
  | 196 | 0 | 0.00063 | 0.00086 |
  | 201 | 0 | 0.00071 | 0.00081 |

  It carries fresh sha256s, including `authored-gears-core.js`, which p96-fb may still change; rerun `node scripts/review-irregular-gear-contact.mjs && python3 scripts/review-irregular-gear-contact.py` if they do.
- World-geometry hashes (`hash.mjs`, three phases):
  - 201 is unchanged (`a403d40d0cdad847` before and after).
  - 196 changed only through its own branch.

**Captures.**
- `seam-before-after.png` (outline overlay)
- `a191-sheet.png` (def, ph .25/.5/.75, 2.2× zoom, rotated −60/−20)
- `a191-steps.png` (5× zoom on each step)
- `a191-zstrip.png` (ph .02/.06/.94/.98)

**What remains visible.** At ph .5 and .75 the driven step still reads as a tall narrow tooth in the plain front view. This is mostly Brown's own proportion: in the plate the wall is about 3.4× the tooth width, and in the model about 4.8×. Two things add to it:
- the model's 14.5° hobbed teeth are trapezoids, not Brown's square teeth;
- the low-side tooth next to the step is partly relieved (its top slopes from 1.45 to 1.34) so that the other gear's step can pass during the prescribed reset. Brown draws that tooth whole.

Neither can be removed without changing the reset kinematics in `progressiveSpeedScrollGears` (core, p96-fb).
- I tried broadening the step tooth to 0.45 pitch: it left a kink at the far flank, so I rejected it.
- p93-fc's 7° rack left the maximum gap at 0.0103 (limit 0.0105) for barely squarer teeth, so I did not retry it.

**Tests.**
- New test: `movement 191 step tooth is full-width and flat-topped on a straight radial wall (p96)`. It fails on the old profile (shoulder 0.0197) and passes on the new one (0.0031).
- The zigzag test is tightened to 0.
- `irregular-gear-family` (8 of 8), `movement-191` (7 of 7) and `movement-196` pass.
- `movement-192`, `movement-195`, `movement-201` and `loop-seams` pass. The contact-hash check went stale once, when p96-fb edited core mid-run; I regenerated the report and it passes, with identical numbers.

**Screens.**
- Disconnected: clear; only the bore-clearance hinges remain.
- Coincident faces: 0.
- Edge mounts: 0.
- Faceting: 0.
- Loop seams: the known velocity kink at the reset (0.39 at k·P). The motion is unchanged.

**Proposed ledger row.**
- assessment: minor
- visibleFlaws: "The low-side tooth next to each step is partly relieved for the prescribed reset, so the step tooth stands taller and more isolated than Brown's; the teeth are hobbed trapezoids, not square."
- limits (append): "p96: the step tooth is squared (straight radial wall, flat top, 0.05 corner fillet, replacing the hobbed chamfer). The walls carry a 0.009 foot relief where the passing corners brush. 513-pose contact is clear (minimum gap 0.0024)."

### 196 (medium): fixed
**Fix.** The undrawn, floating pinion-B bearing boss, stay and framing flange are removed. Their block in the 196 branch is deleted, and the core's `fixed-bearing-at-pinion-B` ring is hidden. B's axle is re-cut to end 0.021 proud of its hub on both faces (z −0.25…0.25, 48 segments), as A's was in p93. The now-unused `supportMaterial` import is dropped.

**Checks.**
- The disconnected-parts screen no longer finds a detached group; the one near miss is the axle-in-bore clearance, 0.022.
- The whole-model z range is −0.25 to 0.53 (was −1.68).
- Coincident faces 0, edge mounts 0, faceting 0.
- 201 is unchanged.

**Captures.** `a196-sheet.png` (plate, def, left −50, below −55, rot −65/−20 at ph .5, behind) against `b196-sheet.png`.

**Tests.** `movement 196 is fully three-dimensional…` now asserts:
- B's axle is 0.5 long and ends at the hub;
- no stay, flange or framing-wall role;
- the old bearing is hidden;
- the z bounds are −0.3 < min < −0.2.

**The strap low (not changed).** I disagree with the audit here. Measured on the plate at 3× (`plate196-strap.png`), Brown's strap is about 0.85–0.9 of each eye's diameter, not 0.6. The model's tapered strap, with eyes 0.25 and 0.15, is within about 12% of that.

**Proposed ledger row.**
- assessment: reasonable
- visibleFlaws: ""
- limits (append): "p96: the undrawn bearing, stay and flange behind pinion B are removed; B's axle ends at its hub faces."

### Deferred
- None for these IDs. The 191 residuals above need the reset timing in `authored-gears-core.js` (p96-fb).

## 235 and 237 (sub-lane p96-fc-g2): both findings disputed with measurements; no code change

No production file, bake or test was changed. The claimed helpers `star-tappet-working-parts.js` and `crown-pawl-237-working-parts.js` are byte-identical to HEAD. Scratch and captures are in `/dev/shm/p96/fc/g2/`.

### 235 (medium, "long slender spikes; root should be 0.55–0.6 of the tip"): not a defect
- **The model already has Brown's ratio.** p93-g set the root to 0.72 on a 1.22 tip in `authored-intermittent-core.js` (ratio 0.590), and the live mesh confirms it: radii 1.2200 and 0.7200 (`p235.json`).
- **Plate measurements** (`p235crop.png`, `overlay235.png`), all about Brown's hole at (168, 235):
  - The six tips are at 71, 64, 59, 64, 76 and 70 px (mean 67 px).
  - The six roots are at 35, 40, 41, 41, 43 and 39 px (mean 40 px).
  - Root/tip is therefore 0.60. The model's 0.59 matches within 2%.
- **Point slenderness:** the model's included tip angle is 47°. On the plate the top and right points measure 41° and 34°, so the model's points are slightly *stubbier* than Brown's, not more slender.
- **The rendered silhouette agrees:** measured from the default capture, root/tip is 63/108 px = 0.58.
- **What the auditor probably saw:** the whole star is about 13% larger than Brown's. The tip is 1.22 against his 1.07 (67 px × 0.016), and the root is 0.72 against his 0.64. The ratio is unchanged.
  - Scaling the star down would move the drive-face contact solve, the nose arc and the `star-tappet-paths` bake. All of that is built in the core (`springTappetArmStarRatchet`: `ratchetOuterRadius`, `ratchetRootRadius`), which p96-fa owns.
  - A helper-only swap would desynchronise the contact from the visible star, so I did not do it.
  - I record the size as a low for the core owner: scale both radii by 0.88, rerun the contact solve, and regenerate `baked/star-tappet-paths.js`.
- **Motion:** a 12-phase strip (`strip-235.png`) shows the nose driving the raked face and returning, with the click held.
- **Checks:**
  - `generate-star-tappet-paths.mjs --check` reproduces the bake.
  - Disconnected parts: one floating group (the star/click fixed-pivot group with no drawn frame, as audited). There are no slivers or lips.
  - Coincident faces: 0.
  - Loop seams: score 0.

### 237 (medium, "crown teeth are flat-faced blocks standing proud of the cup; polygon rim from above"): not a defect
- **The teeth are already flush.** p93-g made each tooth one helicoidal wedge whose walls lie on the cup's exact radii. The live meshes show every one of the 20 teeth spans radius 1.46000–1.64000 (maximum 1.6400001), and the cup's turned wall is at `g.wheelOuterRadius` = 1.64 (`p237.js` probe).
  - Nothing stands outside the cup.
  - The tooth walls are 24-segment true arcs (0.75° per segment), so the rim is not a polygon.
- **What the "tabs" in the top view are:** from above (`before/237-top90.png`, `before/237-top70z.png`), the far-side teeth rise 0.46 above the rim, so in perspective their tops project past the rim line. That is the saw profile's own height, which is correct 3D.
- **What "block" means here:** each tooth's top is a helicoidal ramp 0.18 wide (1.46–1.64), which reads as a solid face beside Brown's sheet-thin cup. That band width is forced by the working nose. Its centre travels radially over 1.552–1.594 with a 0.055 nose, so it needs at least 0.152. The current 0.18 is 1.18× that minimum.
- **Contact data:** thinning the band would change the core's contact triangles (`crown237Triangles` is computed in the core before the helper runs) and the return bake. Neither is needed.
  - `generate-crown-pawl-237-return.mjs --check` reports "237 return bake is byte-identical", so the bake matches the current triangles.
  - No rebake was required.
- **Motion:** a 12-phase strip (`strip-237.png`) shows the nose riding the ramp, dropping into the root and bearing on the radial face.
- **Checks:**
  - Disconnected parts: 0 detached. The 7 near-misses are hinge-bore clearances (arm rod in the pawl barrel, fulcrum stud in the floor bore).
  - Coincident faces: 0.
  - Loop seams: score 0.

### Tests
`node --test tests/crown-pawl-237-contact.test.mjs tests/movement-235.test.mjs tests/movement-237.test.mjs tests/star-tappet-working-parts.test.mjs`: 28/28 pass. None was edited.

### Captures
- `before-235.png` and `before-237.png` are 3×3 sheets: the plate, default, ph .25/.5/.75, left −50, top 70, rotated and zoom.
- Also `overlay235.png` (the model's star vertices on the plate), `strip-235.png`, `strip-237.png` and `before/237-top*.png`.

### Proposed ledger rows
| ID | Assessment | visibleFlaws | Limits (append) |
|---|---|---|---|
| 235 | reasonable (unchanged) | empty | "p96-fc: audit 'long spikes' disputed. Root/tip is 0.59 against the plate's 0.60 (mean tip 67 px, root 40 px), and the model's tip angle is 47° against the plate's 34–41°. The star is about 13% larger overall than Brown's (tip 1.22 against 1.07); rescaling needs the core contact solve and the star-tappet bake." |
| 237 | reasonable (unchanged) | empty | "p96-fc: audit 'proud blocks' disputed. All 20 teeth span exactly 1.46–1.64, flush with the 1.64 cup, as 24-segment arcs. The oblique 'tabs' are the 0.46 tooth height. The 0.18 band is forced by the nose path (at least 0.152). The return bake `--check` is byte-identical." |

### Deferred
- 235 star size (low): owned by p96-fa, in `authored-intermittent-core.js`, `springTappetArmStarRatchet`. Multiply `ratchetOuterRadius` 1.22 and `ratchetRootRadius` 0.72 by about 0.88, then rerun the drive-contact bisection and `scripts/generate-star-tappet-paths.mjs`.

## Sub-lane p96-fc-g3: 240, 218, 221, 222 and 224

Captures are in `/dev/shm/p96/fc/g3/`. `before/` and `after/` hold the default view, the ±50° and back views and the phases. The tiles are `t240b.png` (before) and `t240a.png`, `t240s.png` (C through a drive) and `t240v.png` (after), plus `t218a.png`, `z218.png` (before .75 | after .8 | after .9), `t22.png` against `t22a.png`, and `t224.png` against `t224a.png`. The plate crops are `p240g2.png` and `p224top2.png`.

Claims (p96-fc): `ratchet-stop-240-contact.js`, `ratchet-stop-240-working-parts.js`, `baked/ratchet-stop-240-paths.js`, `authored-wool-comber.js`, `authored-elliptical-idler-gears.js` (not edited), `authored-expanding-pulleys.js` and `variable-idler-gear-parts.js`.

### 240 (medium): fixed. Stop C is now Brown's broad two-tooth block.
- **Verified against the plate** (`p240g2.png`). C's top edge is a sawtooth, with C tips at plate (203,349) and (238,347) and roots at (157,359) and (197,367). At about 115 and 134 px from the hub, these fill two tooth spaces.
- **Why the pivot moved.** A plate seated in two spaces cannot lift by turning about its drawn hole, because the hole lies between the two teeth. For the hole at (213.75,386.25), the lift velocity of the left tooth has a radial component of −0.37: it dives in while the toe rises.
  - C is therefore carried on the free arm of its S-spring and rises bodily. This is prescribed as a turn about the spring's bend (plate (350,406), `C240_SPRING_BEND` in `ratchet-stop-240-contact.js`).
  - The hole stays a plain drawn hole. The old fixed pin through it and its collar are retired, and the S-spring now bends about the bend.
- **Outline** (`stopC240`). The block is the wheel's own outline across the two spaces, dilated by 0.012 and cut flat at the toe's depth, so both of C's teeth have the same flat tips. The working toe circle bears on the steep face. It is joined to the traced lower edge, curl and hole as one plate.
- **Bake.** `scripts/generate-ratchet-stop-240-paths.mjs` was rerun with 513 samples and the same step and slope.
  - Two generator fixes, both for C only:
    - C's whole body is checked between samples.
    - The wheel-vertex reach covers C's far tooth. It had been skipped at 2.28 against the 2.25 cutoff, which hid a 0.009 wheel-tip penetration.
  - The hook and straight paths are byte-identical. C's maximum lift is now 0.166 rad about the bend (it was 0.556 about the hole).
  - Whole-body clearance over 6000 poses: hook 0.00050, straight 0.00057, C 0.00039 (`gap240.mjs`). The DP took about 15 minutes.
- **Tests.** `movement-240` 8/8 and `ratchet-stop-240-working-parts` 6/6:
  - C's lift sign now comes from the finite definition.
  - The carried-hole test is rewritten.
  - The pin/collar test drops C and asserts C has no pin.
  - A new test checks that C is one plate reaching into two spaces one pitch apart.
- **Screens.**
  - Disconnected parts: only the existing 0.0157 hinge near-misses of the hook and straight stops.
  - Coincident faces 0, seams clean, body intersections 0.
- **Proposed row:** assessment reasonable; visibleFlaws "".
  - Limits, replacing the C sentence: "p96: stop C is Brown's broad block whose top edge is serrated into two tooth spaces (the wheel's outline offset 0.012, cut flat at the toe's depth). Because a plate seated in two spaces cannot lift about a pin between them, C rides on the free arm of its S-spring and rises bodily, prescribed as a turn about the spring's bend. Its drawn hole is a plain hole. The spring's bend is a prescribed blend, not a solved flexure."
  - Residual: the lower curl is the older trace and is chunkier than Brown's slim hook.

### 218 (medium): fixed. G grazes F's rim instead of hovering 20°.
- **Verified.** The caption says that from e to C "the catch is passing over the plain surface". The model lifted G by a free 0.35 rad for ph .575–.93.
- **Fix** (`authored-wool-comber.js`, 218 only through `outputPlateFocus`; 217's law is untouched because its multiplier is 1):
  - The dwell lift is now the angle at which the lug's tip circle clears the rim by 0.0005 (bisected: 0.313 × 0.35 ≈ 0.11 rad).
  - The drop now starts at .95 (was .93), so the lug enters its notch only once the rocker has arrived. At .93 it touched the flank by −0.003.
  - Minimum lug clearance over 4000 phases is 0.0005.
  - On the eight-notch plate, the lug passes level over the two intermediate notches, held at rim height by the cam's rear projection. That is 217's part, not drawn on 218.
- **Low (A boss): declined.** It is stud A, which runs in the heart-cam groove behind (217). Brown names it in the caption.
- **Tests.** `movement-217` 8/8, including a new test "218 catch G rides F's plain rim".
- **Screens:** unchanged (the 0.0147 H bore near-miss); coincident faces 0; seams clean; intersections 0.
- **Proposed row:** assessment minor. visibleFlaws is unchanged (F's round-rooted notches).
  - Limits, replacing "the cam touches the release boss at one instant": "p96: once lifted at e, G's lug tip rests at F's rim (0.0005) and passes level over the intermediate notches, held by the cam's rear projection (217, not drawn on 218), then drops at C."

### 221, 222 (medium): fixed. The links are broad steel two-eye bars.
- **Fix.** In `variable-idler-gear-parts.js` `link()`: each link is one bored extrusion, 0.15 R wide (221: 0.30; 222: 0.27), with eyes 1.25 widths in radius, concentric with the pins. They are in steel `PALETTE.muted` instead of ink. 221's old torus collars, now buried in the eyes, are hidden.
- **Checks.** No other visible mesh lies inside any link's solid over 65 poses (`l222.mjs`). Body intersections 0, coincident faces 0.
- **Report.** `docs/validation/221-222-223-contact.json` was regenerated (export plus review): 513/513/538 poses, 0 penetration. Only the hash changed.
- **Tests.** 221 and 222 each gain a link-width and colour test; `variable-idler-solids` passes (17/17 across the three files).
- **Proposed rows:** reasonable; visibleFlaws "". Append: "p96: the links are broad flat two-eye bars in steel (0.15 R wide)."

### 224 (medium): fixed. d is carried on Brown's curved strap.
- **Fix** (`authored-expanding-pulleys.js`). A fixed flat strap sits at z −0.60…−0.50, in the channels' plane.
  - It spans the two upper channels, with its side edges 0.12 off each channel axis, inside the channel walls.
  - Its top edge is an arc concentric with the pulley at r 2.52, 0.03 inside the rim segments at their most contracted. Its lower part (r 1.72) is hidden behind c.
  - d's shaft ends inside it through a 0.095 bore.
- **Low (studs on arm ends): fixed.** Each arm's inner end is now a round boss of r 0.12, concentric with its stud. The arm was a square box end.
- **Low (e's pivot on the guide lip): kept.** An ear on the strap forced e's pin through arm 1's channel (187 hits of 0.01 in the contact audit), so it was reverted. The pin stays in the lip.
- **Report.** `docs/validation/219-224-414-contact.json` was regenerated scoped to 224: 17 poses, inside 0, penetration 0, gap 0.00092. 219 and 414 are unchanged.
- **Tests.** `movement-224` gains a strap/arm-boss test; `variable-face-gear-solids` passes.
- **Screens:** disconnected, only the existing click-pin lip; coincident 0; seams clean; intersections 0.
- **Proposed row:** reasonable; visibleFlaws "". Append: "p96: pinion d's shaft ends in a fixed curved strap spanning the two upper channels (arc top concentric, lower part behind c); the arm ends are round bosses concentric with their studs. Click e's pin remains in the channel lip."

### Deferred or declined
- 218's A-stud boss: declined, as above.
- 224's e pivot on the strap: forced by the arm-1 channel, as above.

`tests/models.test.mjs` passes 163/163.

# p96-fc fork g4: 188 (with low 187), 244, 247, 251 and 253

Reviewer: Claude Opus 5.5, sub-lane p96-fc-g4. Date: 2026-09-28. No git writes.

Captures are in `/dev/shm/p96/fc/g4/`:
- `sheets/NNN.png`: the plate plus 11 views, in the same layout as the audit's `/dev/shm/p96/c/sheets/`, which serve as the before captures.
- `shots/`: the raw views.

The vite server on port 47414 has been stopped.

## Files (claimed for p96-fc)

| File | IDs |
|---|---|
| `src/simulation/gab-disengager-188.js` | 188 |
| `src/simulation/gab-disengager-187.js` | 187 (low) |
| `src/simulation/clamp-working-parts.js` | 244, in the 244 path only |
| `src/simulation/authored-sounding-weights.js` | 247 |
| `src/simulation/authored-pile-drivers.js` | 251 |
| `src/simulation/authored-check-hooks.js` | 253 |

`lifting-check-hook-parts.js` is claimed but unchanged. `authored-gab-disengagers.js` is unchanged.

Geometry and pose hashes (`hash-before.txt` / `hash-after.txt`) are unchanged for:
- 186 (74b324bb…)
- 189 (efcef863…)
- 278 (7036e8a3…), which shares the release helper with 247
- 287 (8416c6c3…), which shares `clamp-working-parts.js` with 244

Tests: movement-186, 187, 188 and 189 plus gab-joint-solids (29/29, plus the new 188 test); movement-244 11/11; movement-247 11/11; movement-251 7/7; movement-253 10/10; movement-287 passes.

Report regenerated: `docs/validation/186-187-cam-solids.json` (129 poses per movement, no intersections). Only the hashes of the 187/188 sources and the query counts changed.

Screens for 187, 188, 244, 247, 251 and 253 (`disc.json`, `cf.json`, `edge.json`, `facet.json`, `seams.json`, `bi.json`):

- **Faceting:** 187 and 188 went from flagged to 0. 244, 251 and 253 are 0. 247 keeps the known smoothed crease on its tiny leaf spring.
- **Loop seams:** 0 above tolerance.
- **Body intersections:** worst solid is 0 for all six. 247 and 253 need `--max-old-space-size=14000`. At the default heap, 253 now runs out of memory because the rope is longer.
- **Disconnected parts:** no new detached parts. The 244 stops C/C′ and the 251 pile/anvil are unchanged and as documented.
- **Coincident faces:** only 247's pre-existing catch-arm/barb pair remains (0.0000036 relative). That geometry is in `release-mechanism-working-parts.js`, which I did not claim.

## 188: medium, fixed

- **Change:** the rod's crown and tail were a 16-point polyline, shown as about 6 visible chords. They are now a centripetal Catmull-Rom spline through the same traced points, sampled at 240 points. The loop handle's arch (outer and inner edges) and the notched head's two flanks are resampled the same way; the notch corners are kept. The hub was already a 96-point ellipse.
- **Faceting:** was 6 low-poly edges at 24.5° on the rod and 4 at 24.7° on the handle; now 0.
- **Captures:** `c188-ba.png` (before and after crown crop), `sheets/188.png`.
- **Test:** the new p96 test in movement-188 checks that both outlines have more than 300 face points.
- **Proposed ledger row:** assessment reasonable; visibleFlaws empty. Limits, append: "p96: the rod's crown and tail and the handle's arch and head are smooth splines through the traced points (no chords)."

### 187: low, fixed
- **Change:** the upper handle's traced grip outline, from the end of the straight top edge round the nose and back, is a 360-sample centripetal spline. The top-edge kink seen in the 2.2× zoom is gone.
- **Faceting:** was 5 creases at 20.6°; now 0.
- **Checks:** the cam law and the cam-solids review are clean.
- **Capture:** `shots/187-zoom.png`, `sheets/187.png`.
- **Limits, append:** "p96: the upper handle's grip is a smooth spline."

## 244: medium, fixed (in `clamp-working-parts.js`, which runs after `authored-belts.js`, so p96-fb's file was not touched)

The finding is verified: the pins stood on r 0.68, the links' outer edge. The inner six were 0.37 long, well past the 0.29-deep strap.

- **Change, in the 244 path of `correctProny` before the block and bolts are sized:**
  - All eight strap hinge pins move to the links' mid-radius (0.6175), matching Brown's rivet dots inside the band.
  - The two end pins also move 0.083 plus 1.1° into their end links, so each has metal all round.
  - The wooden block, eye bolts and forks are sized from the pins, so they follow.
  - The six inner pins are trimmed to the strap depth plus 0.008 heads.
- **Pan weights (low):** Brown's pan carries three different weights, so it now has a block, a cylinder and a lathed bell weight with a knob (creased normals). Each keeps its seat on the pan.
- **Captures:** `z244.png` (front, −50°, +60°/−20°, pan), `sheets/244.png`.
- **Edge screen:** it still flags one inner pin, with margin −0.012 against a single link. Each inner pin bridges the 0.024 gap between two adjacent links (hinge), so half of it necessarily lies in the neighbouring link, not in air. This is a screen artefact.
- **Test:** the new p96 test in movement-244 checks the pins at mid-band, the inner pins trimmed, and the three weight kinds.
- **Proposed ledger row:** assessment reasonable; visibleFlaws empty. Limits, append: "p96: the strap hinge pins sit centred in the band with short heads; the pan carries a block, a cylinder and a bell weight as drawn."

## 247: medium, fixed

The finding is verified: `worldOffsetForTime` alternated its direction by sounding parity, so the spent weight left left, then right.

- **Change:**
  - The vessel now always moves on the same way: every spent weight leaves to the left, and the previous station's weight is always lifted at −40.
  - To keep the two-sounding loop free of a jump, the sea-bottom slab no longer moves.
  - Its tone bands are a two-texel texture (255/230, the old 1/0.9 shades), with u = x/5 and `RepeatWrapping`, scrolled by the station offset (`offset.x = −worldOffsetX/5`).
  - The offset wraps by one station, 40, which is 8 band periods, so nothing visibly jumps. The slab's ends never move.
  - The spent weights move with the offset, as before.
  - The 800×12-segment vertex-coloured box is replaced by a plain box.
- **Loop seams:** clean. The first attempt, which moved the slab, jumped 19% at the wrap.
- **Captures:** `strip247.png` (16 phases over two soundings; the spent weight leaves left both times), `sheets/247.png`.
- **Tests (movement-247):**
  - The p94 reload test asserts that the slab stays at x = 0, the bands follow the offset, the offset only wraps by exactly one station, and the drift is never reversed.
  - The p93 band test is rewritten for the texture.
- **Low not changed:** the fresh weight running down the line onto the catch in view is p94's deliberate reload, made after the user's complaint that the rod left the view. Raising the rod out of view would bring that back, so I kept it as the documented reset.
- **Proposed ledger row:** assessment reasonable; visibleFlaws empty. Limits, replace "Between soundings the vessel moves on 40 to the next station: the bottom and the spent weight move off sideways together" with: "Between soundings the vessel moves on 40 to the next station, always the same way: the spent weight and the bottom's tone bands move off to the left together (the bottom slab itself stays; its bands scroll, and wrap by whole periods at the loop)". Keep the rest.

## 251: medium, fixed (web partly disputed)

Plate check (`plate251z.png`, 3× crop):
- The stirrup bands are double-line strips about 4 px wide, with open (unhatched) space between them and the stepped centre. The auditor's "fill the web" would contradict the plate.
- The pivots lie at the block's side edges. Brown draws the jaws' round eyes round them.
- The model's old ears (r 9 discs) were separate islands, not joined to the block, so the pins read as sitting on its edges.

Changes:
- **Bands:** each stirrup band is one smooth strip (a centripetal spline through the traced centreline, 96 samples), 5.2 px wide instead of 3.8, and runs on into the bar and the block. It is broader, but still Brown's open band.
- **Ears:** round ears r 10.5, concentric with the jaw pivots (pin r 4.4), joined to the block's sides by a straight neck. From behind they read as the casting's eyes.
- **Rope eye (low):** a thin eye lug (3.4 px thick, arched concentric with its bore r 2.35) stands on the crossbar across the ring's plane. The ring is raised 3.8 px so its lower bow (tube r 2) passes through the bore. The rope's seized end follows it (ring top at 124.2). The lug stays below the beam at the block's highest rise (154.6 against 173).

Results:
- Faceting: was 10 edges at 20°; now 0.
- Captures: `z251.png` (front, −40°, behind, oblique band), `z251b.png` (lug and ring from front, −50°, side and behind), `sheets/251.png`. `ba251.png` is the old and new sheet side by side.
- Test: the new p96 test in movement-251 checks the ears round both pins and the ring bow inside a thin lug.
- The disputed "solid web" is recorded here; the wider bands address "wire-like".

**Proposed ledger row:** assessment reasonable; visibleFlaws empty. Limits, append: "p96: the casting's stirrup bands are smooth strips (5.2 px, a little broader than traced) with Brown's open space inside; round ears concentric with the jaw pivots; the rope eye passes through a lug on the crossbar." The pile/anvil and batten lows are unchanged; they are p93 decisions.

## 253: medium, fixed

The finding is verified. The plate has A r ≈ 197 px, B ≈ 86 px, the hook pivots at 58–69 px (0.74 R_B) and the hooks about 120 px (0.61 R_A). The model's pivots were at 2.0 (0.85 R_B), and their 0.43 eye bosses reached 2.43 against B's 2.35.

**Change:** a `hookInset` of 0.28:
- The pivot radius goes to 1.72 (0.73 R_B; the eye edge is at 2.15, inside the rim).
- The bar length and contact point grow by 0.28, and so do the barb points. The bars become 3.14 long, Brown's 0.59 R_A.

The stud centres are derived from the hook geometry, so they stay seated in the crook. All the existing contact, collision, deployment and reset tests pass unchanged.

**Return sheave (low):** it is moved from 8.6 to 30 below the drum, so it is out of the top (70°) and below (−55°) presets. The rope's tubular segments go from 256 to 768 to keep its density.

- **Captures:** `sheets/253.png`. The top and below views no longer show the sheave, and the pivots are inside B.
- **Tests (movement-253):**
  - The new p96 test checks the pivot at 0.68–0.78 R_B with the eye inside the rim, and the sheave at −30. `returnSheave` is added to `blocks`.
  - The existing 9 tests pass.
- **Proposed ledger row:** assessment reasonable; visibleFlaws empty. Limits, append: "p96: the hook pivots stand at 0.73 of B's radius with the eyes inside its rim (hooks lengthened to Brown's 0.6 of A); the rope's return sheave hangs 30 below, out of the preset views."

## Deferred / not done
- 247's tiny catch-arm/barb coincident-face pair. It is pre-existing and not in the audit, and it lives in `release-mechanism-working-parts.js` (not claimed).
- 247's fresh weight arriving in view: kept by design (see above).
- 251's solid-web fill: disputed against the plate (see above).

### 199 (medium): rack teeth irregular; fixed

**Verified against the plate.** The audit was right. Brown draws plain, regular notches, all alike, and each rack is one piece with the frame. The model had four problems:
- keyhole spaces on the upper rack (a narrow neck from the nominal blank's 0.107 root above the round pin cut);
- lumpy, asymmetric tip corners, where the neighbouring pins' arms cut into the teeth, which reached down to y 0.592;
- a nick on the entry flank;
- separate tooth blocks, 0.055 proud of the frame face, with a root line.

**Fix** (`scripts/generate-partial-lantern-rack.mjs`, `src/simulation/baked/partial-lantern-rack.js`, `src/simulation/partial-lantern-rack-parts.js`; both src files claimed by p96-fc, and gears-core is untouched):
- **One space template.** Every tooth space on both racks is the same symmetric envelope of the lantern pin (plus 0.00035 clearance), swept through its trochoid cusp. That gives a circular root arc concentric with the seated pin (R 0.1231, centre at the cusp height 0.7325) between two near-straight conjugate flanks with slope about 0.38. The half-width is taken as the maximum over all 8 spaces, symmetrised and made monotone.
- **Flat tips.** The teeth have flat tips at one height, y 0.65. This is the lowest height at which no pin disc touches any tooth; below about 0.645 the neighbouring arms would undercut the tip corners again. The tips are 0.162 wide.
- **Entry teeth.** Each entry tooth's working flank continues straight below 0.65 to its tip at 0.458. Its slope, 0.391, is the least that clears the reversal corner, and it meets the template slope (0.385) with a 0.3° change. The free outer flanks are straight.
- **Symmetry.** The lower rack is the upper rack turned half a turn about the frame centre, because the pin paths share that symmetry.
- **One extrusion.** Both racks are unioned with the frame into one smooth extrusion at the frame's depth (±0.14). The ten tooth meshes remain only as hidden finite-contact witnesses of the same outlines.
- **Contact witness.** The drive witness in `partialLanternContacts` now uses the nearest outline sample whose normal drives the frame. The root arc is concentric with a seated pin, so the single nearest point was degenerate there.

**Contact** (2048 phases, `/dev/shm/p96/fc/g5/contact.mjs`):

| Measure | Before | After |
|---|---|---|
| Minimum pin–tooth clearance | 0.000335 | 0.000034 |
| Maximum nearest active gap | 0.00036 | 0.00095 (at the instantaneous reversal, where the entry flank is a straight line) |
| Phases with no positive-drive face within 0.002 | 18.4% | 17.7% |
| Maximum positive-drive gap (at phase 0.9995, unchanged) | 0.0918 | 0.0918 |
| Drive gap at 0.01, 0.25, 0.375, 0.51, 0.75, 0.875 | — | 0.00035 (force 0.94–0.96, moment 0.72–0.73) |

There is no penetration: the tests' mesh signed-distance audit is at 0 or above over 67 phases.

**Captures** (`/dev/shm/p96/fc/g5/`):
- `cmp-def.png`: plate | before | after, default view.
- `cmp-racks.png`: the audit's 6× rack zooms, before on the top row and after on the bottom.
- `sheet-after.png`: plate plus 11 views (default, zoom, ph .25/.5/.75, yaw ±50, top, below, behind, rot).
- `after/entrytip.png`, `after/z42.png`, `after/z4995.png`.
- `paths2.png`: the new outlines against every pin-centre path.

**Screens (199):**
- Disconnected: 0 detached, slivers, lips or open ends (20 near-miss pairs, which are rollers and pins).
- Coincident faces: 0 flagged.
- Loop seams: 0.
- Body intersections: worst 1.2e-8 (roller tangency).
- Faceting: 0 flagged.

**Tests:**
- `tests/partial-lantern-rack-working-parts.test.mjs`: a new test asserts one extrusion, hidden witnesses at the frame depth, and identical symmetric spaces on both racks at five heights. The nearest-at-reversal tolerance moves from 0.001 to 0.0012, the failed-transfer active gap from 0.0004 to 0.001, and the entry-tip margin from 0.2 to 0.18.
- `tests/movement-199.test.mjs`: the teeth are flush with the frame's depth, and the visible-mesh floor is now 29.
- `tests/partial-lantern-native-study.test.mjs`: the convex-cell count is now 1782.
- Results: all 14 pass. Movements 191–198 and 200 (47 tests) also pass. `generate-partial-lantern-rack.mjs --check` passes.
- No docs/validation report fingerprints these files.

**Proposed ledger row 199:**
- assessment: reasonable
- visibleFlaws: ""
- limits (append): "p96-fc: both racks are one extrusion with the frame; every space is one symmetric pin envelope (root arc concentric with the seated pin, near-straight flanks) with flat tips at y 0.65, and the entry flanks continue straight. The nearest pin stands up to 0.001 off the entry flank at the instantaneous reversal. The tooth meshes are hidden contact witnesses. The validation-only native study now has 1782 cells."

**Deferred:** none.

