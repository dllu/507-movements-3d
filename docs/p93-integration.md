# Pass 93 integration fixes

Integrator: Claude Opus 5.5 (pass 93 integration fixer), 2026-09-28. No git writes.

After the p93 fix lanes finished, the full suite had 8 failures. Each one came from a p93 geometry change. The table records each decision.

| # | Test | Case | Decision |
|---|---|---|---|
| 1 | `bevel-family-assembly` 226 blind journals | test asserted old geometry | Updated test |
| 2 | `chain-drive-working-parts` 227 neighbouring links | real overlap | Fixed production code |
| 3 | `clamp-working-solids` 244 wooden block | test asserted old geometry | Updated test |
| 4 | `gear-finger-stop-working-parts` 214 fingers | test asserted old geometry | Updated test |
| 5 | `gears-24-46-source-match` 043 view | test tolerance tighter than the lane's fit | Updated test |
| 6 | `variable-cam-bake` 138 provenance | stale fingerprint | Reprobed and rebaked, output identical |
| 7 | `variable-idler-solids` 221–223 report | stale fingerprint | Regenerated report, same pose counts |
| 8 | `variable-shaper-joints` 178 output eye | test asserted old geometry | Updated test |

## 1. 226: D's stud in the spider boss
- p93-fc moved D's stud onto a spider boss fast on F. The stud is radial, running from z 0.1 to 1.3, and the boss bore is 0.080 (outer radius 0.18).
- The test's old rule wanted the stud to clear F by more than 0.05. The stud's root now clears F by 0.023 and sits inside the spider boss, which is correct.
- **Test change:** the stud root must clear F by more than 0.015 and be seated in `spiderBossD` (radially below its outer face, and within its x span). The per-pose stud clearance is now more than `centralShaftRadius + 0.015`.

## 2. 227: edge-on link end bars grazed the plate eyes
- **Defect:** the one-piece edge-on link (`edgeOnLinkGeometry227`) was penetrating by up to 0.003 on 65 sampled poses. There were two causes:
  - It started widening at the end bar's apex, so the broadening section met the plate's faces while still inside the plate's thickness.
  - Its narrow section, √((0.048 − 0.002)² − 0.03²), left too little room for the 40-segment eye polygon and the articulation lean.
- **Fix** (`src/simulation/chain-drive-working-parts.js`):
  - The narrow section is now held for the first 30% of each end arc, then blended to the broad side.
  - The eye margin is now 0.004, so the narrow half-width is 0.0322 (was 0.0349). The existing `movement-227` check (hypot(endBarHalf, wire) < 0.048) still holds.
- **Result:** 0 penetration. The minimum neighbouring-link gap is 0.0012. 227, 228 and 229 all pass, and so does `movement-227`.
- **Unchanged:** the sprocket, the wheel and the look of the broad sides. No saved report depends on this file.

## 3. 244: lever D on the wooden block
- p93-fc moved lever D into the pulley's mid-plane and gave the block a flat top at D's underside, so D now bears on the block.
- The old test required the block to rise past D's centre line and stay behind it.
- **Test change:** the block's top must meet D's underside within 0.002, and D must lie within the block's depth.

## 4. 214: finger plates lowered to the gear faces
- p93-fc ran each finger down to 0.016 above its gear face; it was 0.075.
- Measured over 65 poses, each finger clears the opposing gear by exactly 0.016. There is no overlap.
- **Test change:** the finger-to-opposing-gear threshold is now 0.0159 (was 0.0749).

## 5. 043: view fitted to both shafts
- p93-g fitted the camera to both of Brown's shaft lines. The lane's own constraint keeps the lower wheel's axis within 6° of the picture plane.
- The fitted view gives |axis·view| = 0.099 (5.7°). The old test required less than 0.05.
- **Test change:** the tolerance is now sin 6°. The upper-wheel and negative-control assertions are unchanged.

## 6. 138: bake fingerprint
- The only change to `authored-cams.js` hides the rod guides in 135 (`reuleauxCarrierDiskValveMotion`). 138's geometry is unaffected.
- The saved probe report (`/dev/shm/138-fine.json`, whose hash matches the bake's `reportSha256`) carries an older `package-lock.json` hash, so the bake script rejects it.
- **Reprobe:** I ran `scripts/probe-variable-cam.mjs` with the same options (timestep 0.00025, period 8, samplesPerArc 128). All 12,001 rows are byte-identical to the old report, with the same penetration (0.00122) and 0 resets.
- **Rebake:** I then reran `scripts/bake-variable-cam.mjs` against the new report.
- **Result:** motion, bounds, geometry data, materials and the object tree are identical to the previous bake; only three.js uuids differ. The sample count is 9,301 and the loop seam is unchanged. Provenance now hashes the current sources.
- The new report was written to `/dev/shm/138-fine-p93i.json`.

## 7. 221–223 contact report
- The only change to `authored-elliptical-idler-gears.js` is the colour of 222's link c–b.
- I reran `node scripts/export-variable-idler-contact.mjs && python3 scripts/review-variable-idler-contact.py`.
- Results are unchanged: 513, 513 and 538 poses, 0 penetrating pair-poses, and the same maximum active gaps (223: 0.00679). The report has no `sourceCommit`.

## 8. 178: the rod's far eye was removed
- p93-fc removed the rod's output eye because the tool slide and its pin are hidden by presentation. The eye used to hang empty in rotated views.
- The old test required the eye to stay on the rod.
- **Test change:**
  - The eye must be detached.
  - In all 65 poses, the rod's axis end (at the eye's former local position) must stay concentric with the hidden slide pin.
  - The full pin, bore and retaining-head checks remain for the slider eye.
