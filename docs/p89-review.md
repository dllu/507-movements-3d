# Pass 89, lane p89: visible coincident faces from the full screen (27, 139, 142, 197, 242, 271, 303, 307, 328, 333, 341, 376, 397, 403, 411, 422, 481)

Reviewer: Claude Opus 5.5, lane p89 (with four forked sub-lanes A–D on disjoint files, integrated centrally). Date: 2026-09-27.

Scratch files and captures are in `/dev/shm/p87/p89/`, outside Git.

- **Input:** `/dev/shm/p62/cf88.json`, a full 507 run of `scripts/screen-coincident-faces.mjs` that honours draw ranges. Filter: fights with contrast ≥ 0.1 and area ≥ 1e-4 × diag². That leaves 87 pairs in 45 movements (`rows.json`).
- **Visibility:** p88-x's `vis.mjs` raycasts from the default camera and 9 rotated cameras to each pair's peak patch (`vis.log`, `visd/vis.json`, tiles `visA.png` and `visB.png`). The captures ran on a HEAD snapshot (`git archive HEAD`, served on its own port) and not on a checkout.
- **Aimed captures:** `verify.mjs` at zoom 5 and 15 on each peak. Before comes from the HEAD snapshot and after from the working tree. Each sub-lane has its own directories, `A/`, `B/`, `C/` and `D/`, each with `before/` and `after/`. The before/after tiles are `A/baA1.png`, `A/baA2.png`, `A/ba-*.png`, `B/ba1–3.png`, `C/ba1–2.png`, `D/ba-411-481.png` and `D/ba-422.png`.

## Counts, full 507 screen

| Run | Flagged fights | Seams | Fights passing the filter |
|---|---|---|---|
| Before (`cf88.json`) | 303 | 24 | 87 pairs in 45 IDs |
| After (`cf89.json`, working tree, `--jobs=20`, 5 min) | 266 | 24 | 52 pairs in 30 IDs |

The screen found no new pair anywhere. Every one of the 52 pairs left is one that the probe saw from 0 of 10 views (listed below).

## Visibility triage

- **Visible, in at least 1 of 10 views (29 pairs in 16 IDs):** 27-1 and 27-2; 139-1; 142-0; 197-1, -2, -5 and -6; 242-1 and -2; 271-1; 303-0; 307-0; 328-0; 333-0; 341-0; 376-0, -1, -2, -3, -4 and -6; 397-0; 403-0; 411-0; 481-0 to -3.
  - All of these are fixed.
  - Six sibling pairs at 0 views were fixed by the same changes: 27-0, 139-0, 242-0, 328-1, 376-5 and 376-7.
- **422:** its valve rod and live steam pair (4.5e-5 × diag², below the area filter) was fixed as the lane brief asked.

## Per ID

| ID | Pair(s) | Cause | Fix (file) |
|---|---|---|---|
| 27 | drum / hub (3) | Each roller's hub was exactly the drum width, and the two shared the bore | Hub 0.30 long, 0.01 proud of each face; the drum is re-lathed to the hub radius (0.067) (`authored-gears-core.js`, `makeTriangularRollerCarrier`, which only 27 uses; `primitives.js` untouched) |
| 139 | rack backing / bosses (2, plus 2 pins below the filter) | The boss back face was 5e-4 behind the backing, within depth tolerance | Boss back face 0.003 behind the backing (`mujoco-internal-rack/geometry.js`). Rebaked from the unchanged native cycle; provenance valid |
| 142 | carrier disk / planet axle | The axle end was flush with the disk's back face | The axle starts 0.01 proud (`silk-traverse-geometry.js`). Rebaked; provenance valid |
| 197 | frame members / plate (4) | The plate ran under the members with a coplanar back face | The plate ends on the members' inner faces (`mangle-rack-working-parts.js`, `finish197`). The remaining pair sits at 4.7e-9 × diag² |
| 242 | strap / strap eyes (2); drum / hub | The eyes were exactly as deep as the strap; the drum and hub shared the bore | The eyes stand 0.003 proud of each strap face; the drum is bored to 0.286, inside the r 0.29 hub (`band-drive-working-parts.js`, `correctCraneBrakeJoints`, 242 only) |
| 271 | strap / pulley axle | The axle's back end was flush with the strap's back face | The axle ends 0.01 inside the strap (`authored-ratchet-bars.js`) |
| 303 | pallet arbor / pendulum rod | The arbor's rear end was flush with the rod's back face, a radial hatch in the eye | The arbor ends 0.01 inside the rod (`authored-deadbeat-escapements.js`). The baked anchor plate's input hash does not cover the arbor |
| 307 | pallets A, B / pallet plate | The plate's opening-edge and step walls lay in the hardened pallets' faces | The plate is pocketed 0.003 inside each pallet; the pallets alone carry the working faces (`authored-three-legged-escapements.js`) |
| 328 | wheel-C web / hub (L, R) | The web and the hub shared the bore wall | Each web is bored to 0.003 inside the hub radius (`authored-cartwright-parallel-motions.js`, `openWheelBody`, 328 only) |
| 333 | P-rod eye / pin P | The pin's back disc was flush in the eye's back face | The pin ends 0.01 inside the eye (`authored-marine-parallel-motions.js`) |
| 341 | crank arm / pin P | The pin's back disc was flush in the arm's back face | The pin ends 0.01 inside the arm (`authored-direct-action-parallel-motions.js`). The `crankAtP` point moves +0.005 in z and stays inside the rod |
| 376 | side spokes / axle boss (8) | The ±0.03 boss faces were coplanar with the 0.06 chord bars | The boss is 0.05 deep, its faces 0.005 inside the bars (`authored-animal-treadwheels.js`). A proud boss was tried and rejected because it changed the look |
| 397 | crank eye / crank pin | The pin had the eye's radius (0.12) and ran through it, so the walls coincided | The pin stands on the eye's front face; its front end is unchanged (`authored-intermittent-shuttle-drives.js`, `makeCrank`) |
| 403 | left rule / brace fastener 1 | The fastener's back disc was flush in the rule's back face | It ends 0.01 inside the rule (`authored-cyclographs.js`) |
| 411 | drum guide / paper-shift knob | The knob's inner end lay in the guide's inner face | One `axialKnobLength` (0.25) feeds both knob definitions; the inner end stops 0.01 inside the guide and the outer end is unchanged (`authored-self-recording-levels.js`) |
| 422 | valve rod / live steam | The rod's inner end cap lay where the chest steam's cut face meets valve D | The rod runs 0.01 further into D; its outer end, the steam regions, the seal and the valve motion are unchanged (`authored-sector-piston-engines.js`) |
| 481 | partition sheets / drum head (4) | The sheets ran 0.025 into the rear head, and their shell arcs lay in its rim | The sheets are 0.99 deep and end on the heads' inner faces (`authored-wet-gas-meters.js`; `gas-meter-working-parts.js` untouched) |

### Visible side effects

- **27:** where the flicker was, the dark hub now reads as a clean ring inside the bored drum (`A/ba-27-*.png`).
- **All other IDs:** their before/after tiles differ only where the speckle or hatch was removed.

## Latent pairs left (0 of 10 views; 52 pairs in 30 IDs)

Area is × diag².

| Tag | Parts | Area | Contrast |
|---|---|---|---|
| 196-0 | fixed-axis-uniform-input-pinion-B/ExtrudeGeometry / fixed-axis-uniform-input-pinion-B/BufferGeometry | 1.1e-3 | 0.877 |
| 197-0 | generated-ten-tooth-pin-rack-pinion / continuous-unidirectional-floating-pinion/BufferGeometry | 8.2e-4 | 0.872 |
| 202-0 | sixty-tooth-wheel-enveloped-by-hourglass-worm/BufferGeometry / sixty-tooth-wheel-enveloped-by-hourglass-worm/BufferGeometry | 6.8e-4 | 0.322 |
| 208-0 | common-three-ring-pin-wheel-face-disk / pin-wheel-input-hub | 1.1e-3 | 0.85 |
| 233-0 | root/BufferGeometry / root/BufferGeometry | 1.7e-3 | 0.302 |
| 233-1 | root/BufferGeometry / root/BufferGeometry | 1.2e-3 | 0.302 |
| 241-0 | single-tooth-driver-disk / bored-single-tooth-driver-hub | 2.5e-3 | 0.832 |
| 248-0 | counterbored-thread-core-at-end-of-pipe-C-shell / small-captive-abutting-flange-on-pipe-A-shell | 1.4e-2 | 0.656 |
| 248-1 | flat-annular-pipe-seat-shell / small-captive-abutting-flange-on-pipe-A-shell | 1.4e-2 | 0.656 |
| 248-3 | small-captive-abutting-flange-on-pipe-A-shell / stepped-hollow-body-and-inward-shoulder-of-nut-B-shell | 6.8e-3 | 0.725 |
| 254-0 | broad-edge-profile-sprocket-wheel-body / sprocket-wheel-rigid-hub | 2.5e-2 | 0.807 |
| 260-0 | bored-rotating-nut-secured-in-wheel-E-hub / nut-journal-extension-through-fixed-bearing | 2.2e-3 | 0.269 |
| 265-0 | thin-friction-roller-disk / roller-hub-sliding-on-guide-shaft | 1.2e-3 | 0.276 |
| 282-0 | cord-running-sheave / pulley-hub | 3.8e-4 | 0.726 |
| 285-0 | bored-keyed-quill-bearing-land / fixed-longitudinal-keyway-guide | 3.1e-4 | 0.259 |
| 285-1 | bored-keyed-quill-bearing-land / fixed-longitudinal-keyway-guide | 3.1e-4 | 0.259 |
| 285-2 | transparent-cutaway-sliding-quill-sleeve / nonrotating-nut-fixed-inside-traveling-quill | 1.9e-4 | 0.633 |
| 287-0 | lower-spring-end-keeper-collar / bored-neck-joining-sleeve-and-lower-flange | 1.4e-3 | 0.676 |
| 287-1 | axially-sliding-keyed-sleeve-body / upper-thrust-groove-ring-on-sleeve | 1.3e-3 | 0.257 |
| 287-2 | axially-sliding-keyed-sleeve-body / lower-thrust-groove-ring-on-sleeve | 1.3e-3 | 0.257 |
| 287-3 | lower-spring-end-keeper-collar / axially-sliding-keyed-sleeve-body | 1.2e-3 | 0.676 |
| 287-4 | moving-lower-spring-anchor-flange / bored-neck-joining-sleeve-and-lower-flange | 9.9e-4 | 0.676 |
| 319-0 | bimetal-arm-carried-compensation-weight / compensation-weight-clamp-screw | 2.0e-4 | 0.503 |
| 319-1 | bimetal-arm-carried-compensation-weight / compensation-weight-clamp-screw | 2.0e-4 | 0.503 |
| 346-0 | fixed-solid-table-plinth-with-bored-shaft-passage / fixed-crankshaft-bearing-1 | 2.2e-3 | 0.178 |
| 346-1 | fixed-solid-table-plinth-with-bored-shaft-passage / fixed-crankshaft-bearing-2 | 2.2e-3 | 0.178 |
| 356-0 | outer-ring-A / vertical-bottom-trunnion-of-outer-ring-A | 5.5e-4 | 0.551 |
| 356-1 | vertical-bottom-trunnion-of-outer-ring-A / right-angle-pivot-bearing-between-rings-A-and-A1 | 2.5e-4 | 0.551 |
| 361-0 | lower-loose-sliding-pulley-solid-sheave / lower-loose-sliding-pulley-hub | 2.0e-3 | 0.273 |
| 361-1 | lower-loose-sliding-pulley-belt-retaining-flange / lower-loose-sliding-pulley-hub | 8.1e-4 | 0.273 |
| 361-2 | lower-loose-sliding-pulley-belt-retaining-flange / lower-loose-sliding-pulley-hub | 8.1e-4 | 0.273 |
| 366-0 | two-sided-upper-feed-lever / fixed-pivot-boss-of-upper-feed-lever | 1.2e-3 | 0.682 |
| 366-1 | long-two-sided-foot-treadle-lever / fixed-pivot-boss-of-foot-treadle | 1.1e-3 | 0.861 |
| 375-0 | solid-cylindrical-edge-runner-stone / edge-runner-bearing-hub | 5.4e-3 | 0.98 |
| 375-1 | solid-cylindrical-edge-runner-stone / edge-runner-bearing-hub | 5.4e-3 | 0.43 |
| 401-0 | rigid-flywheel-faceplate / flywheel-hub | 2.2e-3 | 0.853 |
| 401-1 | rigid-treadle-rocker / treadle-fulcrum-boss | 4.8e-4 | 0.28 |
| 468-0 | plate-elevation-collared-upstream-pipe / plate-elevation-hollow-pipe-ball | 1.0e-4 | 0.123 |
| 468-1 | plate-plan-collared-upstream-pipe / plate-plan-hollow-pipe-ball | 1.0e-4 | 0.123 |
| 482-0 | fixed-vertical-inlet-pipe-E / fixed-bottom-inlet-flange-E | 2.7e-3 | 0.154 |
| 482-1 | fixed-left-outlet-F-to-burners / fixed-outlet-flange-F | 2.6e-4 | 0.156 |
| 484-0 | central-cylinder-around-which-the-spiral-is-wound / rigid-end-collar-1 | 6.3e-4 | 0.223 |
| 484-1 | central-cylinder-around-which-the-spiral-is-wound / rigid-end-collar-2 | 6.3e-4 | 0.223 |
| 485-0 | domed-windmill-head-covering-windshaft-bearings / windshaft-bearing-pedestal | 1.1e-4 | 0.368 |
| 493-0 | right-packing-taper-body / right-packing-outer-contact-face | 1.2e-2 | 0.227 |
| 493-1 | left-packing-taper-body / left-packing-outer-contact-face | 1.2e-2 | 0.227 |
| 495-1 | fixed-equal-bevel-gear-A/LatheGeometry / fixed-equal-bevel-gear-A/ExtrudeGeometry | 5.3e-3 | 0.773 |
| 495-2 | loose-equal-bevel-output-gear-C/LatheGeometry / loose-equal-bevel-output-gear-C/ExtrudeGeometry | 1.4e-3 | 0.267 |
| 498-0 | connected-left-glass-leg-subjected-to-boiler-pressure / sealed-pressure-pipe-from-boiler-to-left-leg | 7.5e-4 | 0.977 |
| 505-0 | central-arm-D-pivot / rigid-arm-D-through-central-and-planet-axes | 2.4e-3 | 0.792 |
| 506-0 | driver-shaft-A-bearing / driver-bearing-bridge-to-curved-standard | 4.6e-4 | 0.234 |
| 7-0 | B-hollow-shaft/LatheGeometry / B-hollow-shaft/ExtrudeGeometry | 1.2e-3 | 0.267 |

Almost all of these are coaxial parts that share an enclosed bore wall (hub/disk, sheave/hub, collar/sleeve, plinth/bearing) or section faces closed off by other parts. The rest are two parts that share a flush face the probe could not see.

- **197-0:** the pinion's and the hub's bore walls can be seen only through a 0.0005 shaft clearance. Boring the pinion to the hub radius would open a hole at the back, because the pinion extends 0.06 behind the hub. It is left as it is.
- **Limit of the probe:** it probes only the peak point at a single phase (see the limits in p88-x). Two other fights are also left because they fall below the filter: 271's fulcrum standard and bearing (contrast 0.035) and 328's neck and gland (area 8.6e-5).

## Checks

- **Other movements unchanged.** All 507 movements were hashed through the registry: mesh positions, indices, visibility and world matrices at two times (`hash.mjs`, `hashall.sh`). The HEAD snapshot gave `hash-head.txt` and the working tree `hash-work.txt`.
  - Exactly 15 IDs differ: 27, 197, 242, 271, 303, 307, 328, 333, 341, 376, 397, 403, 411, 422 and 481. The other 492 are byte-identical.
  - 139's and 142's registry models do not change. Their production bundles are the rebaked `baked/assets/139.json.gz` and `142.json.gz`.
- **MuJoCo rebakes (139, 142).**
  - 139 was rebaked from the unchanged native cycle, whose sha matches the provenance. As a control, the unchanged source was rebaked first, and only the geometry UUIDs differed.
  - In both provenances only the geometry-file hash, the byte count and the asset sha changed.
  - The bake-provenance and loader tests pass.
- **Validation reports regenerated** with their pose counts kept; only the source hashes changed:
  - `139-playback-contact` (1600)
  - `142-clearance` (721)
  - `191-196-201-contact` (513)
  - `200-226-bevel-solids` (33)
  - `202-264-worm-solids` (33)
- **Validation reports left alone:** `205-208-209-contact`, `feed-worm-195-solids`, `feed-worm-195-working-faces` and `feed-worm-207-working-faces` also fingerprint `authored-gears-core.js`, but they were already stale at HEAD. Reports with a `sourceCommit` field were not touched.
- **Disconnected parts** for the 17 IDs, HEAD snapshot against the working tree (`disc-before.json`, `disc-after.json`):
  - Detached, floating, open ends, slivers and lips: identical for every ID.
  - 27: near-misses went from 19 to 22, all pin ↔ drum bore clearance at 0.032. The bored drum sits in its hub, which carries it in the same rigid body. The hub ↔ carrier short-of-pin gaps fell from 0.035 to 0.025.
  - 328: near-misses went from 24 to 26, web ↔ shaft, the same bored-inside-hub pattern as 199 and 402 in p88.
  - 242: one fewer measured attachment, because the drum and hub no longer overlap.
- **Body intersections** (fork B): identical before and after for 242, 271, 303, 307 and 328.
- **Loop seams:** `check-loop-seams --ids=<the 17 IDs>`: 17 checked, 0 seams, 0 pops, 0 errors.
- **Tests.** New geometry assertions were added in `movement-197/242/271/303/307/328/333/341/376/397/403/411/422/481`, `gears-24-46-source-match` (27) and `silk-traverse-model` (142).
  - The full suite, `node --test tests/*.test.mjs`, ran 4624 tests: 4624 pass, 0 fail.
- **Routes:** no factory changed which IDs it handles, so the routes were not regenerated.

## Proposed ledger appends

Every row keeps its existing assessment. No visible flaw was introduced or removed; 397 stays minor with its existing flaws.

- **27:** "p89: the roller hubs stand 0.01 proud of the drum faces and the drums are bored to the hub radius (flush hub ends and a shared bore flickered)."
- **139:** "p89: the rack bosses stand 0.003 behind the backing (within depth tolerance before, and z-fought); rebaked, motion unchanged."
- **142:** "p89: the planet axle stands 0.01 proud of the carrier disk's back face (it was flush); rebaked."
- **197:** "p89: the frame plate ends on the members' inner faces instead of running under them with a coplanar back face."
- **242:** "p89: the strap eyes stand 0.003 proud of the strap faces, and the drum is bored clear inside its hub (coincident faces speckled)."
- **271:** "p89: the pulley axle ends 0.01 inside the strap's back face (it was flush)."
- **303:** "p89: the pallet arbor ends 0.01 inside the pendulum rod (its flush end hatched)."
- **307:** "p89: the plate is pocketed 0.003 inside hardened pallets A and B, which alone carry the step faces (they were coincident)."
- **328:** "p89: the wheel-C webs are bored clear inside their hubs instead of sharing the hub bore."
- **333:** "p89: pin P's back end stops 0.01 inside the rod eye (it was flush and z-fought)."
- **341:** "p89: the crank pin's back end stops 0.01 inside the crank arm (it was flush and z-fought)."
- **376:** "p89: the axle bosses are 0.05 deep, their faces 0.005 inside the chord bars (they were coplanar and z-fought)."
- **397:** "p89: the crank pin stands on the crank eye's front face instead of running through the eye at the same radius (the coincident walls z-fought)."
- **403:** "p89: brace fastener 1 ends 0.01 inside the left rule (it was flush in its back face)."
- **411:** "p89: the paper-shift knob's inner end stops 0.01 inside the drum guide (it lay in the guide's face and flickered)."
- **422:** "p89: the valve rod starts 0.01 inside D (its end cap lay where the chest steam meets D)."
- **481:** "p89: the partition sheets end on the drum heads' inner faces (their shell arcs lay in the heads' rims and flickered)."
