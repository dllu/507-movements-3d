# Pass 86 lane 5: sliver-joint and overhang-lip screen

Reviewer: Claude Opus 5.5, lane p86-5. Date: 2026-09-27.

`scripts/screen-disconnected-parts.mjs` now reports two more classes beside `detached`, `nearMiss` and `openEnds`:

- **slivers**: joints that touch or overlap, but where the contact patch is tiny against the parts' cross-sections, and the joint is the only structural connection holding one side on.
- **lips**: a rod or arm end that overhangs the boss it runs into by a small step.

Tests were added to `tests/screen-disconnected-parts.test.mjs` (7 pass).

## Runs

- **All-507 run.** Over the working tree, 13:02–13:07 PDT, with `--jobs=16`. The output is `/dev/shm/p86/sliver.json`.
  - HEAD was `b8ab312`. Other lanes had about 120 files modified at the time, including those for 77–107, 211–247, 266, 271, 284 and 320.
  - An identical run at 12:52–12:57 flagged exactly the same slivers. Its lips differed by one row (237, gone at 13:02).
  - The captures were taken from the working tree between the two runs.
- **Tuning.** This used an untouched HEAD snapshot (`git archive b8ab312` in `/dev/shm/p86/p86-5/head`) and its own dev server, because other lanes had already fixed 100, 106, 107 and 266 in the working tree.
- **Command:**
  ```
  node scripts/screen-disconnected-parts.mjs --jobs=16 --out=/dev/shm/p86/sliver.json
  ```
  Add `--sliver-all=1` to also list the unflagged attachments, or `--sliver=0` to skip the new classes. A run over all 507 takes about 5 minutes with 16 jobs.

## Method

1. **Structural joints.** A pair of solid meshes is a structural joint when it touches (gap ≤ `--touch`) in every sampled phase and one of these holds:
   - the two move rigidly together;
   - they turn about a hinge whose axis passes through the contact (within 0.75 of the thinner part's middle extent), as a pin in an eye does;
   - the contact spot stays fixed in both bodies' frames (within 0.25 of the thinner part's thickness), as in a ball joint.

   Working contacts fail these tests and are not joints: pawls on teeth, a pawl tip on a fixed ratchet (the contact is off the hinge axis), sliders, cams, gears and intermittent drives.
2. **Attachments.** The graph is built from the structural joints plus the rope, belt and spring links (fluids never join). At each phase, for every mesh v and every component C of the graph with v removed, the joints between v and C are the only connection between the two sides. This is a bridge when there is one joint. It is also measured when there are two or three joints, e.g. a crank arm standing on both its shaft core and its hub. Attachments through ropes, belts or springs are not measured.
3. **Patch.** Each attachment is resampled finely: step = the thinner part's thickness / 16, between diagonal/6000 and spacing/2, capped at 30k samples per side. The patch is each side's surface within the pair gap + `--sliver-tol` of the other surface, or inside it (for closed meshes).
   - **neck**: the principal extents of the smaller side's union patch.
   - **section**: each member's local cross-section, taken as the principal extents of its surface within about 1.5× its thickness of the patch centroid.
   - **depth**: the deepest sample inside the other mesh.
4. **Solid, not flagged:**
   - `wrapped`: the patch rings an axis over at least 9 of 12 bins with a hollow core, e.g. a hub on a shaft or an eye on a pin.
   - `embedded`: depth ≥ `--sliver-embed` (0.5) of the thinner section, e.g. a pin set into a hole.
5. **Flagged when any of these holds:**
   - `narrow-neck`: neck width < `--sliver-neck` (0.35) × the thinner member's section width.
   - `small-patch`: neck area < `--sliver-area` (0.25) × the thinner section area.
   - `cap`: neck area < `--sliver-cap` (0.5) × the thinner section **and** < `--sliver-wide` (0.1) × the wider member's section. This is a ball or block hung from a stem end by a small cap of its surface, as in 106.
6. **Exclusions:**
   - fluids (`isFluidRole` or translucent);
   - rope, belt and spring connectors and deforming meshes, as before;
   - sheets (`SLIVER_SHEET`: cloth, warp, fabric, paper, leather, canvas);
   - scenery (`SLIVER_SCENERY`: river, stream, sea, ground, earth, terrain, soil, pavement, road);
   - non-rigid joints whose roles name a designed bearing or working contact (`SLIVER_WORKING`: contact, touching, resting, seated, against, pintle, pivot-point, knife-edge).

   Parts repeated under one role are collapsed to their worst row, with `repeats`.
7. **Lips.** A lip is checked for every elongated mesh (principal extent ≥ 3× the next) whose end runs into rigidly joined meshes that continue past its end.
   - The rod's cross-section just outside the entry is compared with the joined meshes' outline over the entered length.
   - The comparison is made along two axes; v is the joined meshes' thinnest direction, so a boss plate is seen face-on and edge-on.
   - A rod face standing proud of that outline by more than `--lip-min` (0.0015 × diagonal) and less than `--lip-step` (0.3 × the rod width) is an overhang.
   - A boss standing proud of the rod is a normal shoulder and is not reported.

### Output fields

Each movement result gains `structuralJoints`, `attachmentsMeasured`, `attachmentsExcluded`, `slivers[]` and `lips[]`.

- **Sliver row fields:**
  - `parts`: the mesh first, then the meshes it joins;
  - `joints`, `relation` (rigid / hinge / fixed-spot), `flagged`, `reasons`;
  - `state`: open / wrapped / embedded / unmeasured;
  - `score`: the smallest of the ratio/threshold terms; below 1 is flagged;
  - `neck` [w, h], `neckRatio`, `areaRatio`, `wideRatio`;
  - `sectionWidth`, `sectionArea`, `sections` (per member), `depth`, `depthRatio`, `wrap`;
  - `gap`, `patchPoints`, `step`, `phase`, `cutPhases`, `at`;
  - `holds`, `holdsCount`: the smaller side's roles;
  - `repeats`.
- **Lip row fields:** `rod`, `joined`, `lips[]` ({side, size, relative}), `rodSection`, `bossSection`, `entered`, `phase`, `at`, `repeats`, `sizeRelative` (the largest overhang / diagonal).

### Why these thresholds

- **The suggested 15% neck is too strict.** It missed every user example.
  - At HEAD `b8ab312`, 106's head–ball joint has neck/width 0.66 and area 0.38. Its patch is only 0.066 of the ball's section, and its depth is 0.1 of the ball.
  - 266's grip–arm joint is 0.29 / 0.18.
  - Clean joints sit at about 0.75 or more: rod ends flush on a face, nuts in standards, blades on hubs.
- **The chosen values:**
  - neck < 0.35 and area < 0.25 catch 266 and the other side-on-round and edge slivers;
  - the two-sided `cap` rule catches 106. That joint is lopsided: generous against the thin stem, tiny against the ball.
- **Why no overlap-depth trigger.** The suggested 2% overlap-depth test was not usable on its own. A flush face-to-face contact has zero depth, so depth only serves as the "embedded" exemption.
- **Results at HEAD with these defaults:**
  - 106: flagged (cap, score 0.76);
  - 266: flagged (narrow-neck, small-patch, cap; score 0.74);
  - 100: a lip was found on `tailRod` (+v 0.035 and −v 0.095 over the 0.24 boss/lever stack, ±u 0.018 at its shallow 0.04 entry);
  - 107: not flagged (score 1.70). Its tapered stem tip enters the pin's dome to half the pin's width. The neck is 0.6 of the pin in both width and area, which the screen cannot tell from ordinary joints.
- **In the working tree, all four are now clear.** The lanes' fixes read as embedded (266) or with a full neck (106, 107), and 100 has no lip.

## Counts (13:02 run)

- Structural joints: 18,502. Attachments measured: 7,839. Excluded by the name rules: 133.
- **Slivers:**
  - Flagged: 42 rows in 33 movements, collapsing to 38 joint groups.
  - Verified classification: **20 real** (17 movements), 8 intended (hooks in eyes and a footstep), 9 false positives, 1 negligible.
- **Lips:**
  - 140 rows in 65 movements (99 groups). This check is experimental.
  - Of the top 12 by overhang, 1 is real (276) and 1 plausible (433). The rest are false positives: pins standing out of blocks, table tops, rails.
  - Treat lips as a search aid, ranked by `sizeRelative`, not as defects.

## Flagged sliver joints (ranked by score, all verified)

Captures are in `/dev/shm/p86/p86-5/` (outside Git), made with the p85 `shots.mjs` harness on a dev server at port 44886:

- `cf/sNN-ID-tile.png` is the tile: default view, a zoom on the joint, and two rotated zooms.
- `cz/zsNN-ID-tile.png` are tighter zooms, taken where the first zoom was inconclusive.

| # | ID | Parts (the mesh, then what it joins) | Neck (w x h) | Neck/section width | Neck/section area | Neck/wider section | Reasons | Class | Capture |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 438 | `closed-lower-end-of-hollow-shaft` / `fixed-lower-bearing-below-reaction-arms` | 0.0287 x 0.0287 | 0.0575 | 0.0018 | 0.0013 | narrow-neck, small-patch, cap | **intended**: Pointed footstep: the cone point stands in a conical recess in the block, as designed. | cf/s01-438-tile.png, cz/zs01-438-tile.png |
| 2 | 205 | `common-wheel-body-between-two-tooth-rows` / `one-tooth-in-front-alternating-series` (x11) | 0.1965 x 0.0133 | 0.0623 | 0.0384 | 0.0061 | narrow-neck, small-patch, cap | **real**: Front-row teeth stand on the wheel face along a thin edge line; seat them flat on (or into) the rim. | cf/s02-205-tile.png, cz/zs02-205-tile.png |
| 3 | 205 | `common-wheel-body-between-two-tooth-rows` / `one-tooth-in-rear-alternating-series` (x11) | 0.1965 x 0.0133 | 0.0624 | 0.0385 | 0.0061 | narrow-neck, small-patch, cap | **real**: Rear-row teeth meet the wheel rim along one edge; run them into the rim. | cf/s03-205-tile.png, cz/zs03-205-tile.png |
| 4 | 500 | `bottom-pressure-inlet-leading-to-diaphragm-chamber` / `fixed-pressure-tight-peripheral-clamp-of-disk-A` | 0.0782 x 0.0151 | 0.0744 | 0.0274 | 0.0083 | narrow-neck, small-patch, cap | **real**: The round clamp ring sits on the flat top of the inlet column by a tangent line; sink the column into the ring or give it a flange. | cf/s04-500-tile.png, cz/zs04-500-tile.png |
| 5 | 455 | `mutilated-hollow-drum-with-two-chordal-flats` / `segment-valve-2-with-drum-radius-arc-back` (x2) | 0.7328 x 0.026 | 0.1021 | 0.1032 | 0.0251 | narrow-neck, small-patch, cap | **real**: Each flap valve touches the drum corner only at its thin root; add a knuckle or run the root into the drum. | cf/s05-455-tile.png |
| 6 | 147 | `body:crosshead/BufferGeometry` / `body:collar/BufferGeometry` | 0.1 x 0.0843 | 0.5611 | 0.1417 | 0.001 | small-patch, cap | **false positive**: Collar driven by the crosshead: a working hinge contact that stays put in the six samples. | cf/s06-147-tile.png, cz/zs06-147-tile.png |
| 7 | 12 | `root/TorusGeometry` / `root/BoxGeometry` | 0.0303 x 0.0156 | 0.3542 | 0.1574 | 0.0095 | small-patch, cap | **real**: The eye ring touches the beam underside tangentially and has no shank; add an eye-bolt shank into the beam. | cf/s07-12-tile.png |
| 8 | 385 | `pear-shaped-door-closing-weight` / `weight-neck` | 0.1266 x 0.0306 | 0.2354 | 0.1655 | 0.0143 | narrow-neck, small-patch, cap | **real**: The weight-neck stub sits partly off the pear's flat top, leaving a visible step; centre the stub and sink it into the top. | cf/s08-385-tile.png, cz/zs08-385-tile.png |
| 9 | 176 | `input-wrist-pin` / `shared-selector-left` | 0.2495 x 0.0648 | 0.1654 | 0.086 | 0.0517 | narrow-neck, small-patch, cap | **false positive**: A wrist pin working in the selector slot. | cf/s09-176-tile.png |
| 10 | 357 | `fixed-cast-casing-carrying-circle-G-in-section` / `fixed-cast-foot-housing-bevel-pair` | 1.2164 x 0.4825 | 0.3011 | 0.1728 | 0.0262 | narrow-neck, small-patch, cap | **false positive**: The sectioned casing rests on its foot housing over a broad ring and reads as joined. | cf/s10-357-tile.png, cz/zs10-357-tile.png |
| 11 | 16 | `root/TubeGeometry` / `root/TorusGeometry` | 0.0301 x 0.025 | 0.4112 | 0.0971 | 0.0684 | small-patch, cap | **intended**: A hook in an eye ring. | cf/s11-16-tile.png |
| 12 | 13 | `root/TorusGeometry` / `root/TubeGeometry` | 0.0283 x 0.0271 | 0.4439 | 0.0995 | 0.0693 | small-patch, cap | **intended**: A hook in an eye ring. | cf/s12-13-tile.png |
| 13 | 454 | `lower-hinged-suction-check-opening-only-on-diaphragm-rise-fixed-horizontal-seat` / `lower-hinged-suction-check-opening-only-on-diaphragm-rise/CylinderGeometry` | 0.5761 x 0.0097 | 0.1457 | 0.2882 | 0.1295 | narrow-neck | **real**: The flap's hinge knuckle sits on the flat seat along a tangent line; bed the knuckle into a lug or into the seat. | cf/s13-454-tile.png, cz/zs13-454-tile.png |
| 14 | 454 | `right-hinged-delivery-check-opening-only-on-diaphragm-descent-fixed-horizontal-seat` / `right-hinged-delivery-check-opening-only-on-diaphragm-descent/CylinderGeometry` | 0.5761 x 0.0097 | 0.1457 | 0.2882 | 0.1295 | narrow-neck | **real**: The same knuckle on the delivery valve. | cf/s14-454-tile.png |
| 15 | 312 | `left-A-E-thin-tubular-main-arm` / `left-A-E-pallet-face-stem` | 0.0628 x 0.0252 | 0.3083 | 0.1229 | 0.0437 | narrow-neck, small-patch, cap | **real**: The pallet-face stem meets the tubular arm only at a corner (low confidence at this scale); overlap them. | cf/s15-312-tile.png, cz/zs15-312-tile.png |
| 16 | 451 | `fixed-air-chamber-inlet-neck` / `selected-side-outlet-from-air-chamber` | 0.2924 x 0.1055 | 0.3948 | 0.2009 | 0.044 | small-patch, cap | **real**: The obliquely cut outlet pipe meets the inlet neck with a wedge gap; trim the pipe to the neck wall. | cf/s16-451-tile.png, cz/zs16-451-tile.png |
| 17 | 312 | `right-B-F-thin-tubular-main-arm` / `right-B-F-pallet-face-stem` | 0.0642 x 0.025 | 0.2873 | 0.2056 | 0.044 | narrow-neck, small-patch, cap | **real**: The same pallet stem on the right arm. | cf/s17-312-tile.png |
| 18 | 17 | `root/TubeGeometry` / `root/TorusGeometry` | 0.0383 x 0.0239 | 0.3939 | 0.1134 | 0.0795 | small-patch, cap | **intended**: A hook in an eye ring. | cf/s18-17-tile.png |
| 19 | 488 | `single-hub-fixing-four-helicoid-blades-to-shaft` / `constant-lead-helicoid-blade-surface-1` (x4) | 0.5979 x 0.0588 | 0.2886 | 0.1851 | 0.0475 | narrow-neck, small-patch, cap | **real**: The blade roots lie along the hub as a thin edge line; sink the roots into the hub or add root pads. | cf/s19-488-tile.png, cz/zs19-488-tile.png |
| 20 | 14 | `root/TubeGeometry` / `root/TorusGeometry` | 0.0383 x 0.0284 | 0.4667 | 0.134 | 0.0945 | small-patch, cap | **intended**: A hook in an eye ring. | cf/s20-14-tile.png |
| 21 | 12 | `root/TubeGeometry` / `root/TorusGeometry` | 0.0406 x 0.0173 | 0.3908 | 0.1399 | 0.0594 | small-patch, cap | **intended**: A hook in an eye ring. | cf/s21-12-tile.png |
| 22 | 154 | `body:weight/BufferGeometry` / `body:weight/BufferGeometry` | 0.0746 x 0.0387 | 0.5528 | 0.2992 | 0.0028 | cap | **real**: The eye sits tangent on top of the ball (the 106 kind); sink the eye's shank into the ball. | cf/s22-154-tile.png |
| 23 | 403 | `pencil-point-touching-described-arc` / `graphite-contact-at-rule-edge-intersection` | 0.0135 x 0.0093 | 0.4634 | 0.313 | 0.0081 | cap | **false positive**: The graphite marker sits at the tracing point. | cf/s23-403-tile.png, cz/zs23-403-tile.png |
| 24 | 201 | `side-of-horizontal-follower-slot/BoxGeometry` / `roller-sliding-in-horizontal-arm-slot` | 0.1353 x 0.0259 | 0.3045 | 0.3168 | 0.056 | narrow-neck, cap | **false positive**: A roller working in the slot. | cf/s24-201-tile.png |
| 25 | 167 | `rod` / `studSeat` | 0.6247 x 0.0472 | 0.2407 | 0.7671 | 0.5899 | narrow-neck | **real**: The flat stud seat touches the round rod along a line; bore or clamp the seat around the rod. | cf/s25-167-tile.png |
| 26 | 22 | `root/TubeGeometry` / `root/TorusGeometry` | 0.0381 x 0.0239 | 0.5684 | 0.1757 | 0.1131 | small-patch | **intended**: A hook in an eye ring. | cf/s26-22-tile.png |
| 27 | 459 | `flexible-coupling-permitting-small-lateral-worm-vibration/BoxGeometry` / `laterally-rocking-lower-shaft-carrying-one-single-start-worm/CylinderGeometry` | 0.1234 x 0.0388 | 0.2585 | 0.1948 | 0.0725 | narrow-neck, small-patch, cap | **real**: The tilted lower shaft ends against the underside of the coupling block, touching at one edge; run it into the block (fork or pin). | cf/s27-459-tile.png, cz/zs27-459-tile.png |
| 28 | 400 | `rigid-feed-bar-B` / `underside-pad-resting-by-gravity-on-radial-cam-prominence` | 0.0685 x 0.0678 | 0.4303 | 0.1814 | 0.1306 | small-patch | **real**: The pad ball hangs from the feed-bar underside by a tangent point (the 106 kind); sink the ball or add a stem. | cf/s28-400-tile.png |
| 29 | 159 | `body:treadle/BufferGeometry` / `body:treadle/BufferGeometry` | 0.1209 x 0.1196 | 0.4271 | 0.1843 | 0.079 | small-patch, cap | **real**: The eye ring hangs tangent under the treadle bar; carry it on an eye bolt through the bar. | cf/s29-159-tile.png |
| 30 | 282 | `lever-rigid-lower-toothed-sector-body` / `rack-working-tooth` | 0.304 x 0.0407 | 0.2663 | 0.4872 | 0.0714 | narrow-neck, cap | **false positive**: A sector tooth in mesh with the rack. | cf/s30-282-tile.png |
| 31 | 377 | `person-jacket-torso-seen-from-behind` / `person-head` | 0.1573 x 0.1548 | 0.4475 | 0.1928 | 0.0815 | small-patch, cap | **false positive**: The figure's head on its torso reads as joined. | cf/s31-377-tile.png |
| 32 | 282 | `fixed-two-post-machine-frame/BoxGeometry` / `fixed-two-post-machine-frame/SphereGeometry` (x6) | 0.0012 x 0.0012 | 0.6741 | 0.4489 | 0.0001 | cap | **negligible**: Six tiny rivet spheres barely touch the frame; they are sub-pixel in every view. | cf/s32-282-tile.png, cz/zs32-282-tile.png |
| 33 | 18 | `root/TubeGeometry` / `root/TorusGeometry` | 0.0455 x 0.0199 | 0.5665 | 0.2278 | 0.1073 | small-patch | **intended**: A hook in an eye ring. | cf/s33-18-tile.png |
| 34 | 361 | `lower-shaft-distinct-from-loose-sliding-pulley` / `single-radial-pin-fast-on-lower-shaft` | 0.1475 x 0.0396 | 0.3298 | 0.3475 | 0.2024 | narrow-neck | **real**: The radial pin stands on the round shaft on its flat end (a tangent line); set the pin into the shaft. | cf/s34-361-tile.png |
| 35 | 347 | `fixed-output-shaft-bearing-2` / `fixed-output-shaft-standard-2` | 0.3188 x 0.1351 | 0.4499 | 0.2369 | 0.1934 | small-patch | **real**: The bearing ring is perched on the flat top of the standard; bed it into a cap or saddle. | cf/s35-347-tile.png |
| 36 | 368 | `single-keyed-horizontal-shaft-for-crank-spur-and-bevel-pinion` / `horizontal-input-shaft-bearing-post` / `horizontal-input-shaft-bearing-post` | 1.629 x 0.048 | 0.334 | 3.7786 | 1.1142 | narrow-neck | **false positive**: A shaft in open bearing loops, bearing with clearance. | cf/s36-368-tile.png |
| 37 | 211 | `pinion-front-hub-ring` / `curved-entry-guide-body` | 0.0738 x 0.0621 | 0.5181 | 0.2519 | 0.0968 | cap | **real (in flux)**: The guide boss touches the pinion hub ring only at its rim. Movement 211 is being edited by another lane. | cf/s37-211-tile.png, cz/zs37-211-tile.png |
| 38 | 284 | `left-frame-post-behind-carriage` / `fulcrum-bracket-on-left-post` | 0.3262 x 0.1587 | 0.4961 | 0.2424 | 0.1261 | small-patch | **false positive**: The bracket sits flush on the post face. | cf/s38-284-tile.png |

## Overhang lips (top 12 by size, verified)

| # | ID | Rod | Joined | Overhangs (side: size, fraction of the rod width) | Class | Capture |
|---|---|---|---|---|---|---|
| L1 | 346 | `moving-crosshead-in-fixed-straight-slot` (x2) | `common-crosshead-pin-C-for-two-side-rods` | +v: 0.1546 (0.2899); -v: 0.1554 (0.2913) | false positive: the crosshead pin C deliberately stands out of the block | cf/l01-346-tile.png |
| L2 | 276 | `reciprocating-round-rod-left-run` | `reciprocating-rectilinear-bar` | +u: 0.0389 (0.0695); -u: 0.039 (0.0696); +v: 0.1547 (0.2764); -v: 0.1547 (0.2764) | **real**: the round rod (0.56 across) is much thicker than the bar boss it enters (0.25), so it overhangs the boss faces, as 100 did | cf/l02-276-tile.png |
| L3 | 271 | `source-plank-table-carrying-the-ratchet-bar` | `source-table-block-leg-1`, `strap-from-table-end-carrying-pulley-axle` | +v: 0.172 (0.2283) | false positive: the table top overhangs its legs | cf/l03-271-tile.png |
| L4 | 183 | `upper-handle-arm` | `upper-handle-hub` | -u: 0.2075 (0.2999) | false positive: the arm plate meets the hub cylinder | cf/l04-183-tile.png |
| L5 | 376 | `cross-width-internal-tread-board-rigid-with-wheel` (x32) | `radial-bracket-joining-internal-tread-to-side-ring` | +u: 0.0175 (0.2059); +v: 0.095 (0.2714); -v: 0.095 (0.2714) | false positive: tread boards wider than their brackets | cf/l05-376-tile.png |
| L6 | 347 | `fixed-right-hand-standard-in-section` | `fixed-opposed-conical-cylinder-head-2` | +u: 0.2082 (0.2368) | false positive: a sectioned casting | cf/l06-347-tile.png |
| L7 | 387 | `fixed-wharf-end-frame-vertical-post` (x2) | `fixed-wharf-horizontal-guard-rail`, `fixed-wharf-end-frame-upper-handrail-pivot`, `fixed-wharf-end-frame-white-post-cap` | -v: 0.1428 (0.2975) | false positive: a post and rail | cf/l07-387-tile.png |
| L8 | 360 | `beam-pivot-upright/BoxGeometry` | `beam-pivot-upright/SphereGeometry`, `fixed-beam-pivot-pin` | -u: 0.08 (0.2353); +v: 0.0202 (0.0878); -v: 0.02 (0.0871) | false positive: pivot upright with cap | cf/l08-360-tile.png |
| L9 | 261 | `fixed-rocker-pivot-G` | `fixed-top-rocker-bearing-arm/BoxGeometry`, `fixed-top-rocker-bearing-arm/SphereGeometry` | +v: 0.072 (0.2501); -v: 0.072 (0.2499) | false positive: a pin through an eye | cf/l09-261-tile.png |
| L10 | 152 | `horizontal-groove-side-wall` | `recessed-horizontal-groove-floor`, `vertical-groove-side-wall`, `solid-corner-around-crossed-open-grooves`, `cross-piece-base-under-groove-walls` | -u: 0.0939 (0.2471) | false positive: groove walls | cf/l10-152-tile.png |
| L11 | 433 | `radial-floor-of-horizontal-scoop-4` (x16) | `horizontal-wheel-hub-fast-on-vertical-shaft`, `horizontal-wheel-central-bucket-support-ring` | -v: 0.1052 (0.2084) | plausible (minor): the scoop floors stand taller than the hub ring they join | cf/l11-433-tile.png |
| L12 | 271 | `fixed-lever-fulcrum-standard` | `bored-stationary-fulcrum-bearing` | +v: 0.0997 (0.2369); -v: 0.0204 (0.0484) | false positive: a fulcrum standard | cf/l12-271-tile.png |

## Real sliver joints for the fix lanes

| ID | Joint | Suggested fix |
|---|---|---|
| 12 | The eye ring under the beam (`root/TorusGeometry` on `root/BoxGeometry`) touches it tangentially | Give the eye a shank into the beam (an eye bolt) |
| 154 | The weight's eye sits tangent on top of the ball | Sink the eye's shank into the ball |
| 159 | The eye ring hangs tangent under the treadle bar | Carry it on an eye bolt through the bar |
| 167 | The flat `studSeat` touches the round `rod` along a line | Bore or clamp the seat round the rod |
| 205 | Both tooth rows (11 each) meet the wheel body along thin edge lines | Seat the teeth on the faces and into the rim |
| 211 | `curved-entry-guide-body` boss touches `pinion-front-hub-ring` only at the rim | Overlap them (211 is being edited by another lane) |
| 312 | The left and right pallet-face stems meet the tubular arms at a corner (low confidence) | Overlap the stems with the arms |
| 347 | `fixed-output-shaft-bearing-2` ring is perched on the flat top of its standard | Bed it in a cap or saddle |
| 361 | `single-radial-pin-fast-on-lower-shaft` stands on the round shaft on its flat end | Set the pin into the shaft |
| 385 | `weight-neck` sits partly off the pear weight's flat top | Centre the stub and sink it into the top |
| 400 | `underside-pad` ball hangs from `rigid-feed-bar-B` by a tangent point | Sink the ball or give it a stem |
| 451 | The obliquely cut `selected-side-outlet-from-air-chamber` meets `fixed-air-chamber-inlet-neck` with a wedge gap | Trim the pipe end to the neck wall |
| 454 | Both check-valve hinge knuckles sit tangent on their flat seats | Bed the knuckles in lugs on the seats |
| 455 | Both segment valves touch the drum corners only at their thin roots | Add knuckles, or run the roots into the drum |
| 459 | The tilted lower shaft ends against the underside of the flexible-coupling block, touching at one edge | Run it into the block with a fork or pin |
| 488 | The four helicoid blade roots lie on the hub as thin edge lines | Sink the roots into the hub, or add root pads |
| 500 | The round peripheral clamp ring sits on the flat top of the bottom inlet column | Sink the column into the ring, or flange it |

Overhang lip: **276**. `reciprocating-round-rod-left-run` (0.56 across) enters the 0.25-thick end boss of `reciprocating-rectilinear-bar` and overhangs both faces by 0.15, as the 100 tail rod did. Fix it by making the boss a hub at least as deep as the rod, or by necking the rod down at the boss. **433** is plausible: the 16 scoop floors stand 0.1 above the hub ring they join.

## Limits

- **Sampling.** Six phases are sampled, so an attachment that is only a bridge in unsampled phases is missed.
- **Joint rules.** The "structural joint" tests use relative motion, so the screen misses or misreads some contacts:
  - a working contact that stays rigid over the samples, such as a pin in a slot (176, 201) or a sector tooth in mesh (282), is taken as a joint;
  - the hook-in-eye family (12–22) is flagged as a joint; it is intended.
- **Redundant touches.** An attachment spread over four or more meshes is not measured. Redundant touches that make a cycle hide a sliver unless it is the mesh's only attachment to that side.
- **Section estimate.** The local section is estimated from principal extents, so a tapered stem that narrows into a joint (107 at HEAD) looks like a full neck.
- **Lips.** The lip check does not know which faces are meant to be proud, so its precision is low.
