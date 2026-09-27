# Pass 87 lane z: coincident-face (z-fighting) screen

Reviewer: Claude Opus 5.5, lane p87-z. Date: 2026-09-27.

The user asked us to watch for coincident planes that could flicker. `scripts/screen-coincident-faces.mjs` finds coplanar, overlapping faces, either between visible meshes or duplicated within one mesh, and reports the ones that can actually show. The tests are in `tests/screen-coincident-faces.test.mjs` (8 pass).

`scripts/screen-disconnected-parts.mjs` now exports `loadProductionModel`, `mergeInstances`, `snapshotGeometry` and `expandIds` for reuse. Its behaviour is unchanged and its 7 tests still pass.

## Command

```
node scripts/screen-coincident-faces.mjs --jobs=24 --out=/dev/shm/p87/coincident.json
```

- **Options:**
  - `--ids=1-507`
  - `--phases=4`
  - `--dist=1e-4` (× the bounding diagonal)
  - `--angle=0.5` (degrees)
  - `--min-area=1e-9` (× diagonal²)
  - `--offset=3` (× the distance tolerance, for the occlusion probe)
  - `--timeout-ms`, `--max-old-space-size`
- **Worker mode:** `--worker=ID` prints one movement's JSON.
- **Timing:** all 507 movements took 384 s with 24 jobs. The slowest were 264 (273 s), 26 (234 s), 70 (199 s) and 66 (154 s); their cost comes from large triangle fans in single planes.

## Runs

- **Full run (the raw output).**
  - Written to `/dev/shm/p87/coincident.json`.
  - Run over the working tree 15:24:33–15:30:57 PDT, HEAD `b393884`. The p87-w, p87-c, p87-l and p86-9 lanes had uncommitted edits in the tree at the time.
  - 479 and 480 errored in a working-tree run at 14:40, while p87-w was mid-edit; they loaded cleanly in the final run.
- **Tuning.** Tuning used an untouched snapshot of `b8ab312`, from `git archive` into `/dev/shm/p87/z/head` (outside Git), because p87-w had already fixed the known positives in the working tree.

## Method

1. **Sampling.** Loading and phase sampling are the same as in `screen-disconnected-parts.mjs`:
   - the production model loader, with baked routes and source presentation;
   - `period × (i + 0.21) / phases`;
   - instanced meshes merged into one geometry;
   - deforming meshes snapshotted per phase.

   Hidden meshes, and materials that are invisible, fully transparent, `colorWrite: false`, shadow-only or wireframe, are skipped. Invisible material groups are skipped per triangle.
2. **Plane buckets.** At each phase every triangle goes into world space.
   - It is bucketed by its plane: the normal, folded so that opposite normals share a bucket (0.01 per component), and the plane offset from the model centre (0.02 × diagonal).
   - Neighbouring buckets (3⁴) are paired by sweep-and-prune on x, with an AABB test on y and z.
   - Within one mesh, same-facing triangles that share one or two corners are fan or strip neighbours and are skipped. Exact duplicates (all three corners shared) are kept.
3. **Coincidence.** A pair is coincident when:
   - the normals are within 0.5° (either facing);
   - the triangles overlap once projected onto A's plane (convex clipping, area > `--min-area`);
   - every vertex of the overlap polygon is within 1e-4 × diagonal of B's plane.

   At the default framing the depth buffer resolves about 2e-5 × diagonal (`near = distance / 180`), so this tolerance catches faces that fight and not faces that are merely close.
4. **Can it show?**
   - Each face renders from its material side: FrontSide from along its normal, BackSide from against it, DoubleSide from both. A mirrored world matrix swaps front and back.
   - The pair can only fight on a side both faces render from. Opposite-facing FrontSide pairs have no shared side. This is the case for two blocks glued face to face, or a front-sided water box against a wall.
   - For each shared side, the point just off the patch (3 × tolerance) is tested for lying inside a closed, opaque, visible mesh. Closed means every position-merged edge has two faces. The test is the solid-surface ray-parity check from `tests/helpers/solid-surface.mjs`.
   - If every shared side is inside some solid, the patch is hidden. This covers faces buried in a third body and glued faces of closed solids.
5. **Classes.**
   - `fight`: at least one face writes depth. The patch speckles or streaks when the two triangulations differ, or when one face is transparent and drawn over an opaque one.
   - `seam`: both faces are transparent and skip the depth write, which is the default for this project's water and steam. They cannot fight; they blend in draw order. Their shared face is still drawn twice, showing as an internal sheet or double density inside what should read as one body of water or steam. This is the kind of internal water wall the user saw in 479 and 480.
   - Excluded:
     - `hidden`: no visible shared side;
     - `noSharedSide`;
     - `resolved`: `depthTest` off or a polygon offset;
     - `sameLook`: opaque, same material look and shading normals toward the viewer, so the fight is invisible.

     Areas for each are kept per movement in `excludedRelative`.
6. **Report.** Areas are summed per mesh pair; each pair is reported at its phase of largest visible area. Each row carries:
   - `parts`, `kind`, `sameMesh`, `meshIndex`, `area`, `areaRelative` (/ diagonal²), `triPairs`;
   - `facing` (same / opposite counts), `sides`, `transparent`, `fluid`;
   - `phase`, `phasesVisible`;
   - `at` (area-weighted centroid) and `extent`;
   - `peak`, `peakArea` and `peakNormal`: the largest single patch and its visible normal, for aiming a capture;
   - `contrast`: 0–1, taken from the colour, roughness/metalness, shading normals, and the opacity of a transparent face.

   Per movement: `flaggedPairs`, `totalAreaRelative`, `pairs` (top 80), `seamPairs`, `seamAreaRelative`, `seams` (top 40), `excludedPairs`.

## Tuning on the known positives (`b8ab312` snapshot)

| ID | Known issue | Screen result |
|---|---|---|
| 469 | Water faces on cistern walls (screenshot 39) | **Caught.** 11 fights, all water body against back, end, base and cut-away front walls (opaque wall against transparent DoubleSide water), 0.57 × diag² in total. In the working tree only the axle-end-against-back-wall pair remains; p87-w has fixed the rest. |
| 478 | Duplicated faces on the pipe end and the black block (33, 34) | **Caught.** `expanding-outer-wall-of-pipe-A` / `moving-free-end-of-A-inside-sphere-C` (512 same-facing triangle pairs), and `fixed-upright-stop-c` / `contact-face-of-fixed-stop-c`. Both are clear in the working tree. |
| 479, 480 | Divided water, stray water walls (30, 31) | **Caught as seams.** The outer annulus, inner column and under-rim annulus volumes share cylindrical faces: 2 seams in 479 and 4 in 480. All are DoubleSide with depthWrite off, so they draw internal sheets rather than speckle. Clear in the working tree. |
| 342 | Chain pin ends flush with link faces (47) | **Not reproducible.** Neither `b8ab312` nor the working tree has flush pins: the pins stand 0.04 proud at `b8ab312`, and p87-c has rebuilt the chain with domed pin heads. The synthetic flush-pin test (`a pin end flush with a link face is flagged`) passes, and the 469 axle end flush with the wall is the same case in production and is caught. At `b8ab312` the screen flags `segment-head-chain-lug` / `beam-chain-terminal-boss` (3.1e-4 × diag²), which was not captured. |

Two false-positive classes were removed during tuning:

- **Transparent–transparent pairs.** The first version flagged 426–429 steam volumes and 479/480 water as fights. Both faces skip the depth write, so they cannot speckle; these moved to `seam`.
- **Fan neighbours within one mesh.** These cost about 180 M candidate tests on 70, and are now skipped by shared corners.

## Counts (full run, working tree)

- **Fights:** 493 mesh pairs flagged in 147 of 507 movements.
  - 419 are opaque–opaque and 74 involve a transparent face; 2 are within one mesh.
  - 391 pairs in 128 movements have contrast ≥ 0.1.
  - 213 of those, in 87 movements, have area ≥ 1e-4 × diag².
- **Seams:** 68 transparent seam pairs in 26 movements (347, 422, 423, 425–430, 433, 439, 444–446, 448, 453, 455, 461, 463–466, 473, 477, 498, 501).
- **Movements with excluded area:**

  | Reason | Movements |
  |---|---|
  | Hidden | 97 |
  | Same-look | 257 |
  | No shared side | 437 |
  | Polygon offset | 3 |

## Verification

**Coverage and capture.**

- **What was captured.** The top 44 fight rows by `areaRelative × min(1, contrast / 0.1)` were captured, plus 12 more fight rows chosen from the rest of the list. The captures are outside Git:
  - `/dev/shm/p87/z/cv/` (vNN tiles);
  - `/dev/shm/p87/z/vf/` and `vf2/` (aimed captures);
  - `/dev/shm/p87/z/cs/` (seam tiles).
- **How.** `verify.mjs` is a variant of the p85 `shots.mjs` harness, run against a working-tree dev server. It aims the camera at `peak` along `peakNormal`, blended 30% toward the default view, at zoom 5 and 15, with shadows off. It also renders each mesh alone.
- **Classifying.** The pixel-mixing counts were not decisive: whole-mesh hiding changes pixels outside the patch. Classification is therefore by eye: speckle, stair-stepped streaks or radial hatching in the patch means real.

**Pattern.**

- Transparent-over-opaque pairs were real in every case checked.
- Opaque–opaque pairs flicker visibly when the triangulations differ, for example a cylinder cap fan against an extruded face, or a ring against a disk.
- Opaque–opaque pairs built from identical vertices usually render stably, because one face wins everywhere. These are latent: they may flicker at other zooms, or when the draw order changes.

### Verified real flicker (ranked by area within each class)

Area is × diag²; "v"/"x" refer to capture tags.

| Rank | ID | Parts | Area | Evidence | Suggested fix |
|---|---|---|---|---|---|
| 1 | 453 | `water-filling-valve-chest-chambers` against `fixed-common-valve-chest-beneath-both-bellows` (0.037), `fixed-valve-chest-floor-with-channel-mouths` (0.031), `fixed-ported-partitions-round-central-discharge-chamber` (0.018), and both delivery-check flaps (0.0037 each) | 0.09 | v01, v02, v06, v30, v31: stair-stepped streaks on the chest walls and floor behind the flaps | Inset the water volume from the chest walls, floor and partitions by about 1e-3 × diag, or build it as the exact cavity with its faces removed where they meet walls. Stop the water short of the flap faces. |
| 2 | 473 | `larger-fixed-water-tub` against `fixed-outer-tub-water` (0.020), `water-below-internal-hydrostatic-interface` (0.016) and `water-below-moving-bell-rim` (0.012) | 0.048 | v04, v08, v14: radial streaks on the tub floor through the water | Lift the water bottoms off the tub floor (or drop their bottom caps). Inset them from the tub wall. |
| 3 | 439 | `water-running-down-open-trough-spout` on `fixed-flume-providing-continuous-water-fall` (0.015) | 0.015 | v09: moiré across the trough floor | Raise the water sheet off the flume floor and inset it from the side walls. |
| 4 | 467 | `variable-water-chamber-between-fixed-ram-top-and-moving-cap` against `closed-moving-cylinder-cap-acted-on-by-water-pressure` (0.0047) and `sectioned-hollow-ram-body-with-pump-window` (0.0043) | 0.009 | v24, v26: strong orange/grey radial hatching under the cap | Shrink the water chamber radially and axially by about 1e-3 × diag, or cap it at the cap's inner face minus a gap. |
| 5 | 448 | `water-standing-in-pump-head-at-spout-level` on `fixed-vertical-lift-pump-barrel` (0.0081), plus 9 smaller pairs including `lower-check-valve-opening-only-on-upstroke` / `water-below-bucket-...` | 0.012 | v16: streaks on the barrel through the water | Inset the pump-head water from the barrel bore. Stop the water at the valve faces. |
| 6 | 444 | `tail-water-filling-sectioned-lower-tank` against `fixed-drive-pipe-from-small-head-reservoir` (0.0039), the waste-seat collar (0.0016) and the neck flange (0.0009) | 0.006 | v28: streaky water over the pipe | Subtract the pipe and collars from the tail-water volume with a small clearance, or inset it. |
| 7 | 499 | `bottom-process-pressure-inlet-socket` / `threaded-pressure-inlet-collar` | 0.0032 | v34: radial black/grey hatching across the socket face | Recess the collar end face 1e-3 × diag, or let one part own the face. |
| 8 | 432 | Both breast-wheel outer rims (front and rear) against `free-tailwater-after-breast-cell-discharge` | 0.0036 | x-432: streaked rim inside the tailwater | Keep the tailwater's side faces off the rim planes (narrow the water or offset it). |
| 9 | 449 | `fixed-enclosed-pump-head` / `fixed-stuffing-box-sealing-sliding-piston-rod`, plus `lower-check-flap-opening-on-upstroke` / `water-below-modern-bucket` and 9 more | 0.0014 + | x-449: cross-hatched stuffing box where it meets the head | Seat the stuffing box on top of the head face (offset) or sink it in, not flush. Inset the water from the flaps. |
| 10 | 466 | `sectioned-pump-barrel` / `hand-pump-reservoir-water` | 0.0014 | x-466: stair-stepped edges along the barrel through the reservoir water | Subtract the barrel from the reservoir water with a clearance. |
| 11 | 418 | `fixed-horizontal-valve-seat` against `steam-in-left-port-and-passage` and `steam-in-right-port-and-passage` | 0.0012 | x-418: stepped streaks at the port mouths | Stop the steam volumes 1e-3 × diag short of the seat face. |
| 12 | 450 | `water-rising-through-suction-pipe-on-upstroke` / `fixed-suction-check-seat` | 0.0022 | x-450: radial streaks in the seat ring | End the water column below the seat face. |
| 13 | 268 | `constant-length-tangent-oscillating-rod-body` / `rod-eye-on-moving-crank-pin` | 0.0059 | v20: blue/black striations on the eye end | Make the eye one extrusion with the rod, or offset the eye faces. |
| 14 | 439 | `grooved-pulley-wheel` / `single-rope-pitch-groove` | 0.0068 | v19: grey streaks in the groove | Remove the pitch-groove overlay or recess it into the groove. |
| 15 | 469 | `higher-temperature-right-cistern-back-wall` / `fixed-water-wheel-horizontal-axle` | 1.3e-4 | x-469: hatched axle end flush in the wall | Stop the axle short of the wall face or sink it in. This is p87-w's movement; it is the remaining fight there. |
| 16 | 224 | `thirty-two-tooth-adjusting-wheel-c` / `wheel-c-with-six-real-spiral-slots` | 0.031 | v07: faint striations (the same colour, roughness 0.72 against 0.61) | Low contrast. Merge the two coplanar faces, or offset one by 1e-3 × diag. |
| 17 | 351 | `heavy-falling-polygonal-stamp-head` / `flat-lower-impact-face-of-stamp` | 0.0054 | v21: dark striations on the underside | Low visibility. Recess the impact-face plate or make it the head's own face. |
| 18 | 472 | `front-cutaway-hammer-cylinder-B-shell` / `closed-upper-cylinder-head` (and `bored-lower-cylinder-head`, 0.0017) | 0.0025 | v39: hatch at the head corners | Low visibility. Offset the heads inside the shell ends. |
| 19 | 353 | `square-journal-block-rigidly-fixed-to-oscillating-helve` / `moving-helve-hub-about-fixed-fulcrum` | 0.0040 | v27: faint streaks on the hub face | Low confidence. Offset the block from the hub face. |

### Not visible in the captures (latent or false positive)

These were all captured, and each view rendered cleanly:

- **Opaque pairs where one face wins everywhere (identical vertices):**
  - 268 `straight-lower-face-tangent-to-guide-roller`
  - 493 (both packing contact faces)
  - 413 (both pairs)
  - 486 `central-six-arm-rotor-hub` / `square-boss`
  - 36
  - 463
  - 482
  - 241
  - 505
  - 346 (both bearings)
  - 190
  - 260
  - 401
- **Dark or enclosed patches:**
  - 248 (5 section-shell pairs, dark or enclosed)
  - 500 (section case / rim ring, dark)
  - 375
  - 495 (3 pairs)
  - 242
  - 353 `wiper-wheel-hub`
  - 361
  - 453 `water-in-common-suction-pipe`
  - 498
- **False positive:** 254 `sprocket-wheel-rigid-hub`. The patch faces into the bore, and the aimed camera ends up inside the wheel.

The latent opaque pairs are still coplanar and could flicker at other zooms or draw orders. They are cheap to fix alongside other work in those movements, but do not need a dedicated lane.

### Seams (transparent volumes sharing faces), not flicker

These were captured in `cs/` but not classified row by row. Where the volumes overlap they show as bands of double density, for example the 425 steam regions in s03. Where they abut, they show as internal sheets.

The ranked rows are all in 425–429 (steam), 473 (water), and 347 (`steam-in-working-space-on-far-side-of-disk`, overlapping itself within one mesh).

Fix: make each fluid body one volume per connected region, or drop the shared faces between adjacent fluid volumes, as p87-w did for 479 and 480.

### Unverified but likely real (the same transparent-over-opaque class)

These are the remaining transparent-involved fights with area ≥ 1e-4 × diag². The pattern above suggests they are real:

| ID | Parts | Area |
|---|---|---|
| 279 | Both taper gibs against their adjustment caps | 1.2e-4 |
| 427 | Section cylinder / steam | 5.4e-4, 2.8e-4 |
| 439 | `variable-water-load-in-bucket` / `lifting-bottom-valve-disk` | 1.9e-3 |
| 439 | Spout end / water | 4.5e-4 |
| 451 | Suction water / check seat | 1.2e-3 |
| 463 | `lower-leaf-full-width-body` / upstream and downstream water volumes | 7.7e-4, 6.9e-4 |
| 477 | Seat a-a / condensate | 1.5e-4 |

## Limits

- **Tolerance.** Faces separated by more than 1e-4 × diagonal are not flagged. At very close zoom such faces render cleanly, but at the default framing some may still fight.
- **Phases.** Four phases are sampled. A moving face that passes through coincidence between samples is missed.
- **Occlusion.** The occlusion probe only uses closed opaque meshes. Open shells, such as section halves, never hide a patch, so fights between section shells (248, 500) are over-reported.
- **Same look.** `sameLook` compares the material colour, emissive colour, opacity, map, roughness, metalness and flat-shading flag, plus the mean shading normal. Two materials of equal colour but different roughness (224) still count as fights; their `contrast` ranks them low.
- **Transparency.** A face with opacity at or above 0.99 counts as opaque. Seams assume depthWrite off; a transparent pair where one face writes depth is a fight.
