# Pass 106, lane f1: belts, intermittent core, gears core

Findings from `docs/p106-audit-001-085.md`, `-086-170.md` and `-171-255.md`.
After-captures are in `/dev/shm/p106/f1/a/`: `tile-NNN.png` holds the default, yaw+50, left, back and below views plus aimed zooms (`NNN-z*.png`). For 236 there are two strips, `strip-236-zc.png` and `-zb.png`, each 16 phases at the auditor's targets. The before-captures are the auditor's, under `/dev/shm/p106/c/` and `/dev/shm/p106/r001/`.

Claimed files:
- `authored-belts.js`
- `authored-intermittent-core.js`
- `authored-gears-core.js`
- `tappet-stud-stop.js`
- `bevel-200-226-corrections.js`
- `band-drive-working-parts.js`
- `clamp-working-parts.js`
- `mujoco-rack-rectifier/`
- `mujoco-spring-sector/`

## Per ID

- **023 (medium).** B's guide sheaves, weight C and their rope now lie in A's mid-plane (`ropePlane` 0.5 → 0). A's stirrup is rebuilt as one symmetric U strap at z ±0.30 around the sheaves, which span z ±0.23:
  - Each leg is a flat plate that tapers tangentially into a round eye (r 0.11) concentric with the axle, bored 0.079.
  - The crown is the same 0.045 × 0.08 section bent round concentric arcs (r 0.075), butt-joined to the legs at one common section.
  - The rope eye is centred on the crown at z 0.
  - The axle is 0.685 long and ends 0.02 past the legs; it was 1.02 and off-centre.
  - The guide axles are trimmed to 0.025 past their 0.29 hubs.
  - Captures: `tile-023.png`, `/dev/shm/p106/f1/b/m023.png`.
- **227, 229 (medium).** Each shaft ends 0.025 proud of both hub faces: 227 at ±0.195 (was ±0.725), 229 at ±0.205 (was ±0.625). The clock-hand shadow is gone. Captures: `tile-227.png`, `tile-229.png` (`zhub`).
- **242 (low).**
  - The drum shaft is ±0.335 against the hub's ±0.31 (was ±0.575).
  - The 0.31 black cap over the lower strap end is hidden. The lower pin now ends 0.012 past the lever face, like the upper pin, so the lever's own eye shows.
  - The anchor link is steel grey (#7e8584) instead of pin-black.
  - Captures: `tile-242.png` (`zend`, `zendo`, `zhub`).
- **244 (medium).**
  - Each inner hinge joint is now a knuckle. The leading link ends in a round tongue (r 0.046) concentric with its pin, in one extrusion with the link. The next link ends in a concentric cup 0.004 larger. The pin (r 0.028) is bored through the tongue's middle at the band's mid-radius 0.6175.
  - The end pins in the bolt forks are unchanged.
  - (low) The black lower backing that read as a rim is now the wood of the upper block (Brown hatches both). It stops 0.003 short of the strap's inner face, so it no longer runs into the strap.
  - Captures: `/dev/shm/p106/f1/b/m244.png`, `tile-244.png`.
- **073 (low).** A's shaft is r 0.145. It fills A's hub bore (0.155) and still turns loose in D's bore (0.15). It now spans z −0.51 to 0.272, 0.025 past D's sleeve and A's hub; it was −0.59 to 0.75. Capture: `tile-073.png` (`zhub`).
- **083 (low).** In the production (baked) visual, the rockshaft now ends inside the rear hub cover, exactly as its front end sits in the front cover (±1.569; it was −2.15). The live-only sleeve bearing keeps its own dimensions. Provenance and physics-fingerprint tests pass, so no rebake is needed. Capture: `tile-083.png`.
- **215 (low).**
  - The face pin ends 0.03 past the star's front face (z 0.20; it was 0.66).
  - The input shaft is trimmed to 0.025 past the square arbor and the carrier back (−0.57 to 0.70).
  - The stop-wheel shaft is trimmed to 0.025 past its hub and the star's back face (−0.195 to 0.38).
  - Capture: `tile-215.png`.
- **225 (low).** The output shaft spans −0.235 to 0.449, that is 0.02 past the hub (0.429) and 0.025 behind the journal; it was −0.285 to 0.665. Capture: `tile-225.png`.
- **065 (low).** The fixed stop pin now starts 0.02 behind the rear head (z 0.095). It used to run a bare stub back to −0.18. Capture: `tile-065.png`.
- **236 (medium).** The auditor's frames (c hanging for ph ≈ .8–1) do not reproduce at HEAD. The current zc strip shows c on the backs or crest at those phases. The measurement: the toe-to-outline gap of both pawls, sampled at 4096 steps over the cycle.
  - The airtime is in the drops off each crest, where the pawl falls under its bias. The fix raises the prescribed fall acceleration from 300 to 8000 per cycle².
  - A drop now lasts about 0.005 cycle (about two frames at the 6 s display cycle). Before, it lasted 0.02–0.03 cycle and reached a 0.11 gap at the audit's ph 0.
  - The pawl is still tracked on the actual outline (restingPawlAngleAt), so it rides the backs and drops into each root.
  - The idle pawl rests 97.7% of the cycle (was 91.2%). The largest tip step per 1/32768 cycle is 0.0034, inside the test's 0.004 bound.
  - The flywheel law (p101/p102) is unchanged.
  - Residual: from ph ≈ .03 to .17, b's toe stands up to 0.020 above the back. That is not free flight: the 2D outlines touch (distance 0), with a tooth tip bearing on b's upper flank 0.24 from the toe. A straight bar cannot lay its toe on the back there. c has the same condition, at most 0.006, around ph .56–.65.
- **116 (medium).** Both pawls are dark steel (#474d52) in `mujoco-rack-rectifier/geometry.js`, against the grey rear pinion and the brass ratchets. The file is visual-only, and the 116 provenance and loop tests pass. Capture: `tile-116.png`, `/dev/shm/p106/f1/b/m116.png`.
- **200 (medium).** Checked before fixing: the sleeve is already a smooth lathe with 64 segments and creased normals, which is why `screen-faceting` scores 0. The two "facets" were the quadrant rotation cue drawn on a short dark tube. The sleeve is fast to the toothed upper wheel, whose teeth already show its speed, so its cue is removed. The inner spindle keeps its cue. Capture: `tile-200.png` (`zsleeve`).
- **208 (medium).** Only `fixed-axis-keyed-pinion-output-shaft` is tagged `noShadow` / `castShadow = false` (it still receives shadows). The dark band across the lowest pin row is gone. Capture: `tile-208.png` (`def`, `zpins`).

## Screens, tests, reports

- **`screen-disconnected-parts`.** Compared against a baseline copy with the HEAD versions of the lane files:
  - 073: near-misses 3 → 1.
  - 227: slivers 2 → 0.
  - 023: two new "short-of-pin" rows. Both are the 0.085 running clearance between a sheave and the stirrup crown, not a joint.
  - All other IDs are unchanged.
- **`screen-coincident-faces`.** No new pairs. The 116 and 208 flags match the baseline.
- **`screen-body-intersections`.** Unchanged from the baseline. 023 errors in both runs.
- **Shared helpers.** Geometry hashes of all 101 other movements routed through the edited files are identical to the baseline. That covers 287 through `clamp-working-parts` and 226 through the bevel file.
- **Tests.**
  - Passing: `band-drive-working-parts`, `belts-1-23-clearance`, `chain-drive-working-parts`, `clamp-*`, `movable-belt-drive`, `pulley-belt-geometry`, `tappet-stud-stop`, `carrier-pawl-225-contact`, and `movement-073/191–199/200/205–209/214–216/225/227/229/236/242/244`.
  - Also passing: `alternating-pawl-236-contact`, `mujoco-rack-rectifier`, `mujoco-spring-sector`, the 83 and 116 `mujoco-baked-loops` tests, and the saved-report tests (bevel, feed worm, irregular gear, special worm, 205–209).
  - Updated to the new geometry: 073 (D's bore clearance is now > 0.004), 215 (the pin ends 0.02–0.04 past the star; the swept depth is now > 1.2), and 244 (the pin mid-radius tolerance is 1e-6 for float32 radii).
- **Regenerated reports.** Pose counts are kept, and none carries a `sourceCommit`.
  - `200-226-bevel-solids.json` (33 poses)
  - `202-264-worm-solids.json` (POSES=33)
  - `191-196-201-contact.json` (513)
  - `205-208-209-contact.json` (export, python review, 208 pin slots, then save)
  - The feed-worm reports hash only unchanged functions, so they needed no regeneration.

## Deferred

- **012–021 stirrups and 017.** The stirrups are built in six places: `hoist-hardware.js` (`makeSheaveHanger`, used by 12, 13 and 15) and the cascade, fixed-tackle, barton and tackle factories. That is not a quick fix.
- **227 link width.** The low-severity finding needs the generated chain profiles.
- **236 flank-on-crest toe lift.** This is forced by the straight bars.
