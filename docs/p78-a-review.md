# Lane p78-a: close the "minor, not confirmed" fit clearances

Scope: the pass-74 disconnected-part screen's minor rows for 13, 14, 16, 17, 64, 66, 67, 130, 167, 190, 195
and 201 (`docs/p74-disconnected-screen.md`). The goal is that parts read as properly fitted, with no new
interpenetration and no change to the motion.

## Production files

Each change was made in the file the browser actually plays:

| ID | production path | changed |
|---|---|---|
| 13, 14 | `authored-belts.js` (`singleMovableHoist`, `blockAndTackle`) | load hung 0.02 lower |
| 16, 17 | `authored-bartons.js` (called from `authored-belts.js`) | load hung 0.02 lower |
| 64 | `spring-jump-cam.js` | input shaft radius 0.285 → 0.302 (bore 0.305) |
| 66 | `gravity-jump-weight.js` | input shaft radius 0.25 → 0.267 (bore 0.27) |
| 67 | `gravity-tumbler.js` | input shaft radius 0.33 → 0.347 (bore 0.35) |
| 130 | baked `baked/plate-shears.js` ← `mujoco-plate-shears/geometry.js` | jaw pin 0.10 → 0.112 (bores 0.115); cam-shaft pin 0.095 → 0.102 (bore 0.105); re-recorded and rebaked |
| 167 | `reversing-groove-drum.js` (model-loader route, not `authored-groove-drums.js`) | stud centre radius 0.53 → 0.471 |
| 190 | `authored-clamps.js` | pin fits, forked standard, full holder cheeks (see below) |
| 195 | `authored-gears-core.js` + `feed-worm-assembly-parts.js` | no change (screen artefact) |
| 201 | `irregular-gear-family.js` (replaces the gears-core body) | eccentric-gear bore 0.13 → 0.098 on the 0.095 shaft |

`authored-cams.js` (130), `authored-groove-drums.js` (167) and `authored-gears-core.js` (195, 201) are not
what production plays for these IDs, so they were left alone. The gears-core reports are therefore unchanged.

## Changes

- **13, 14, 16, 17: the hook floated inside the eye.** The hook's bowl centreline bottoms 0.415 below the hook
  origin, and the eye wire (r 0.03) hung 0.02 above the bowl. The load now hangs 0.22 below the hook
  attachment, not 0.20, so the eye wire rests in the bowl (computed gap 0.0001). `hoist-hardware.js` is
  unchanged; only the three hang offsets moved.
- **64, 66, 67: a loose sleeve made a crescent on the input shaft.** The shaft was 0.02 smaller than the
  half-cut sleeve bore. It is now 0.003 smaller, which is a running fit. The driving-pin roots stay buried in the
  shaft, and the motion is unchanged because `pinOffset` depends only on the bore.
- **130: loose jaw pivot and cam-shaft pins.** Both pins now run 0.003 clear of their bores. The pins are static
  scenery and take no part in the MuJoCo cells. Still, `geometry.js` is fingerprinted, so the run was re-recorded
  (`probe-plate-shears.mjs`), rebaked (`bake-plate-shears.mjs`) and re-qualified
  (`validate-plate-shears-bake.mjs`: 0.00007 px maximum, seam 4e-11 px).
- **167: 0.065 clearance under the stud tip.** The tip now runs 0.006 above the groove floor. A whole-sphere
  bound keeps it more than 0.01 inside the inclined walls at the steepest point (0.181 against 0.195).
  `docs/validation/167-solid-clearance.json` was regenerated: no cross-family intersections.
- **190: loose pressure-shoe pin, and a holder that never reached its fulcrum.**
  - Pin fits:
    - The cheek bores for the shoe pin are 0.1265, and the shoe bore is 0.128, on the 0.125 pin.
    - The cheek fulcrum bore is 0.163 on the 0.16 pin.
    - The fulcrum pin is seated in the standard's bore (0.1605).
    - The shoe is 0.50 deep, leaving a running clearance of 0.01 to each cheek; before, it was 0.40, leaving
      0.06.
  - Holder and standard. The zoomed triage view showed that the holder outline had been traced with the
    standard's head cut out as a window. The fulcrum pin therefore stood in the gap under the holder's arch, and
    neither cheek touched it. That is a floating joint in every rotated view. Brown draws the standard's head in
    front of the holder's bar, so the holder is whole behind it. The fix has three parts:
    - The cheek outline now runs straight under the head, from source point (307, 311) to (249, 305), and
      carries a round boss of r 0.28 at the fulcrum.
    - The standard is forked round the holder. A front and a rear plate of the standard's own outline stand
      0.005 outside the cheeks. Below the cheeks' swept path, taken over −0.07 to +0.02 rad with a 0.03
      margin, the fork is filled solid, and the web between the cheeks is 0.51 deep.
    - The pin runs from the rear plate's back face into the front head, which now sits on the front plate.
  - In the default view the standard's head is now drawn in front of the holder, as on the plate, and the boss is
    hidden behind it.
- **195: worm-to-wheel clearance 0.06.** This is a screen artefact. The generated face teeth are an
  `InstancedMesh`, which the disconnected screen skips. The 0.062 it measured is from the worm to the plain
  bored centre inside the tooth ring. The committed `feed-worm-195-solids.json` gives a tooth-flank minimum gap
  of 0.0035, and the zoomed captures show the teeth seated between the threads.
- **201: the gear bore was larger than its shaft.** The production body is rebuilt in `irregular-gear-family.js`
  without a bevel, so the real bore was 0.13 on a 0.095 shaft. It is now 0.098. The fingerprinted
  `docs/validation/191-196-201-contact.json` was regenerated (`.mjs` + `.py`). The 201 flank minimum gap is
  0.0014, with no overlap.

## Evidence

- **Disconnected screen.** Run as `node scripts/screen-disconnected-parts.mjs --ids=… --out=…`; before is in
  `/dev/shm/p78-a/before.json` and after in `/dev/shm/p78-a/after*.json`.

  | ID | before (detached) | after |
  |---|---|---|
  | 13 | eye/hook 0.0201 | none |
  | 14 | eye/hook 0.0201 | none |
  | 16 | eye/hook 0.0201 | none |
  | 17 | eye/hook 0.0201 | none |
  | 64 | sleeve/shaft group 0.0167 | none |
  | 66 | sleeve 0.020 | none |
  | 67 | sleeve 0.020 | none |
  | 130 | pin 0.015 | none |
  | 167 | stud 0.065 | none |
  | 190 | shoe 0.06; pin/head 0.030; shoe pin 0.020 | see below |
  | 195 | 0.422 and 0.062 (instanced teeth skipped) | unchanged artefact |
  | 201 | shaft 0.035 | none |

- **Captures.** Before captures come from a HEAD export served from `/dev/shm/p78-a/head`; after captures come
  from the working tree. Both used one vite server on port 44781. Before/after tiles are in
  `/dev/shm/p78-a/tiles/`:
  - `013-eye`, `014-016`, `017-eye`, `064-sleeve`, `066-067`, `130`, `167-stud`, `190-both`, `190-fork`,
    `195-mesh` and `201-bore`
  - default and oblique views in `/dev/shm/p78-a/views/`
- **Intersections.** Run as `show-body-intersections.mjs --spacing=0.01`, with 129 samples, or 33 for the heavy
  worm and rope models. The tool builds the synchronous registry model. For 130 and 167 that is the old authored
  factory, not the production route, so production coverage comes from the 130 bake test and the 167
  solid-clearance report.

  | ID | before | after |
  |---|---|---|
  | 13, 14, 16, 17 | no before run | no solid overlaps, only the pre-existing rope/tail "deforming" contacts ≤ 0.016 |
  | 64, 66, 67 | no before run | none |
  | 190 (HEAD) | only the shoe/work clamping contact at depth 0 | unchanged |
  | 201 (HEAD) | none | none |

  The before runs for 13–17 and 64–67 were not completed: the HEAD runs ran out of the default heap.
- **Screen after all edits** (`/dev/shm/p78-a/after2.json`). There are no detached rows for any ID except 195's
  instanced-teeth artefact. On 190 the remaining near-miss pairs are the fulcrum head's 0.09 clearance to the
  turning cheek, which is now covered by the fork plate between them, and the bench to the nut (0.10, rigid, not
  visible).
- **Tests.**
  - spring-jump-cam, gravity-jump-weight, gravity-tumbler, movement-190, clamp-190-thrust-support,
    clamp-tailstock-solids, clamp-working-solids, irregular-gear-family, movement-201, feed-worm-assembly,
    reversing-groove-drum and plate-shears-bake: 66 pass.
  - Belts: belts-1-23-clearance, hoist-assemblies, hoist-hardware, pulley-belt-geometry, white-pulleys and
    pulley-family-review: 59 pass.
  - models.test for movements 13, 14, 16, 17, 66, 67, 130 and 167: 8 pass.
- **Reports.**
  - `141-review.json` was regenerated with its original `sourceCommit` kept.
  - `167-solid-clearance.json` and `191-196-201-contact.json` were regenerated.
  - `167-browser.json` and the 174/180 clamp reports were already stale against HEAD and were not rerun.

## Residuals

- The 190 fork plates and the solid lower fork are reconstruction. Brown draws only the elevation, where the
  standard's head is in front of the holder. The holder boss behind the head is also inferred.
- 195's screen row remains an artefact of the screen skipping instanced meshes.
