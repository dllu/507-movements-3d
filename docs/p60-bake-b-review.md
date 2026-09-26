# p60 bake B: seamless baked loops for 108–126

Lane p60-bake-b. It used the pipeline from `docs/p60-bake-tool-review.md` to bake 16 live MuJoCo movements: 108, 109, 110, 111, 112, 114, 115, 116, 117, 118, 119, 121, 122, 124, 125 and 126. Each now loads a baked, seamlessly looping recording by default. The live factories in `physicsFactories` are unchanged and still run with `?live`. No `physics.js` or `visual.js` was edited.

Every ID has:
- a config entry in `scripts/lib/mujoco-bake-configs.mjs`, with the cycle design in `note`;
- a route in `src/simulation/baked/mujoco-baked-routes.js`;
- `src/simulation/baked/assets/mujoco-NNN.json.gz` and `.provenance.json`.

`tests/mujoco-baked-loops.test.mjs` iterates over the routes, so all 16 IDs are covered without a list.

## Results

Load time is the median of three fresh browser contexts on a freshly restarted dev server (port 44522, warm transforms, cold page). It covers module import, model load, engine construction and the first render. "Live" is the same page with `?live`. `update` is the cost of advancing one 1/60 s frame.

| ID | loop | start | raw seam | smoothing | round trip | seam step / interior max | bundle | load live → baked | update live → baked | wraps per loop |
|---|---|---|---|---|---|---|---|---|---|---|
| 108 | 1 × 33 s = 33 s | 66 s | 0.000 px | 0.000 px | 0.005 px | 1.54 / 1.56 px | 36 KiB | 5955 → 5451 ms | 5.49 → 0.013 ms | barrel 6 turns |
| 109 | 1 × 24 s = 24 s | 48 s | 0.000 px | 0 | 0.007 px | 4.49 / 4.50 px | 97 KiB | 296 → 181 ms | 1.69 → 0.027 ms | — (reversing) |
| 110 | 1 × 16 s = 16 s | 80 s | 0.019 px | 0.008 px, 5.6e-6 rad | 0.010 px | 2.00 / 2.31 px | 12 KiB | 1662 → 126 ms | 10.9 → 0.020 ms | roller 16 turns |
| 111 | 1 × 16 s = 16 s | 48 s | 0.000 px | 0 | 0.005 px | 0.02 / 1.98 px | 20 KiB | 259 → 143 ms | 0.12 → 0.018 ms | — (reversing) |
| 112 | 1 × 6 s = 6 s | 72 s | 0.000 px | 0 | 0.005 px | 2.11 / 2.14 px | 6 KiB | 1685 → 142 ms | 9.09 → 0.015 ms | — (reversing) |
| 114 | 1 × 8 s = 8 s | 56 s | 0.026 px | 0.024 px | 0.025 px | 0.71 / 0.86 px | 6 KiB | 1488 → 252 ms | 3.89 → 0.022 ms | pinion 1 turn |
| 115 | 1 × 6 s = 6 s | 60 s | 0.000 px | 0 | 0.004 px | 1.61 / 1.61 px | 8 KiB | 1635 → 105 ms | 3.47 → 0.023 ms | — |
| 116 | 1 × 6 s = 6 s | 12 s | 0.013 px | 0.006 px, 1.6e-4 rad | 0.011 px | 1.01 / 2.50 px | 15 KiB | 2929 → 123 ms | 8.12 → 0.025 ms | output 1 turn (6 teeth, snapped) |
| 117 | 1 × 5 s = 5 s | 60 s | 0.037 px | 0.000 px | 0.004 px | 1.34 / 1.64 px | 11 KiB | 588 → 113 ms | 1.05 → 0.015 ms | cam 1, rollers 3.344 and 2.093 turns |
| 118 | 1 × 5 s = 5 s | 10 s | 0.000 px | 0 | 0.005 px | 1.66 / 1.67 px | 7 KiB | 1216 → 109 ms | 3.23 → 0.018 ms | — |
| 119 | 1 × 8 s = 8 s | 16 s | 0.000 px | 0 | 0.005 px | 2.37 / 4.35 px | 9 KiB | 1327 → 134 ms | 2.98 → 0.013 ms | pinion 4.5 turns |
| 121 forward | 1 × 3 s = 3 s | 27 s | 0.000 px | 0 | 0.007 px | 0.07 / 1.47 px | 13 KiB (both) | 333 → 122 ms | 2.08 → 0.023 ms | cog −1 tooth (snapped) |
| 121 reverse | 1 × 3 s = 3 s | 12 s | 0.000 px | 0 | 0.006 px | 0.05 / 1.14 px | | | | cog +1 tooth (snapped) |
| 122 | 29 × 4 s = 116 s | 12 s | 0.000 px | 0 | 0.007 px | 2.47 / 2.55 px | 94 KiB | 1096 → 144 ms | 1.95 → 0.017 ms | upper 23, lower 29 turns |
| 124 | 1 × 4 s = 4 s | 132 s | 0.084 px | 0.084 px, 7.5e-5 rad | 0.084 px | 2.63 / 2.63 px | 498 KiB | 387 → 133 ms | 18.5 → 2.05 ms | — |
| 125 | 437 × 4 s = 1748 s | 8 s | 0.004 px | 0.001 px, 4.2e-5 rad | 0.007 px | 8.03 / 8.32 px (20 Hz) | 1033 KiB | 1905 → 227 ms | 3.90 → 0.023 ms | left 667, middle 551, right 437 turns |
| 126 | 3 × 4 s = 12 s | 100 s | 0.233 px | 0.233 px, 3.1e-3 rad | 0.233 px | 1.39 / 1.50 px | 304 KiB | 344 → 146 ms | 10.0 → 1.28 ms | — |

Column notes:
- **Raw seam** is the world-space mismatch between the loop end and the (wrapped) loop start, including velocity. **Smoothing** is the residual spread linearly over the loop.
- **Round trip** is the largest difference between baked playback and the live model at nine points across the loop. For every ID it is within the raw seam plus 0.1 px.
- **Seam step** is the largest per-sample step across the playback seam. It never exceeds the largest step inside the loop, and neither does the second difference, so the seam is no rougher than the motion itself.
- Bake times range from 2 s (111) to 1204 s (125).

## Cycle design per ID

Each config's `note` carries the same text into the provenance.

- **108 (reverse-thread barrel).** The 33 s drive period is a whole traverse cycle. The barrel turns six times at constant speed while the swiveling shoe runs out along one groove hand and back along the other. One period closes to float precision. The barrel is wrapped with 2π symmetry, so it carries forward by whole turns.
- **109.** The lathe drive already reverses each period. The carriage feeds along the stock, cutting the thread, then returns, and the geometric cut follows it back. The stock's cut surface is a vertex track.
- **110.** The roller runs at a constant 60 rpm. The automatic selector throws the half-nut at each end of travel. The 16 s traverse cycle repeats within 0.02 px, and the roller carries forward by 16 whole turns.
- **111, 112, 115 and 118.** The existing reversing drives (cosine or sinusoidal after the start ramp) close in one period.
- **114, 117 and 119.** A uniform input closes in one input period. The free rollers of 117 wrap by their own recorded turn.
- **116.** A reversing rack stroke drives the two loose pinions, whose pawls alternately drive the output. The six-tooth output ratchet is wrapped with 2π/6 symmetry. It advances exactly one turn per stroke cycle, so snapping costs nothing.
- **121 (ratchet click).** The cog advances exactly one of its 24 teeth per stroke, forward or reverse, so one stroke closes with the cog wrapped at tooth pitch. Both click positions are baked as variants. The live `setConfiguration` is reproduced by switching variants.
- **122 (unequal gears 23:29).** Both crank pins return together only after 29 lower-gear turns. The loop is therefore that whole 116 s traverse pattern (`minLoopSeconds: 116`), and it closes to float precision.
- **124 (bow drill).** The frictional cord settles slowly. After 33 strokes, a single bow stroke closes within 0.084 px (limit 0.25 px).
  - The laid-rope cord is recorded as its centreline (97 points) and rebuilt in playback by `updateBowDrillCord`, which is what the live sync does.
  - The stock's tension deformation is a one-component vertex basis.
- **125 (cascaded gears 19:23:29).** All three gears carry crank pins, so the linkage repeats exactly only after 19 × 23 = 437 right-gear turns. No shorter loop exists: the best 4-period candidate is 18.6 px off.
  - The loop is that whole 1748 s pattern, sampled at 20 Hz. Every gear carries forward by whole turns.
  - Interpolation between 20 Hz samples is under 0.03 px for this slow linkage. The round trip at the recorded samples is 0.007 px.
- **126 (cord bell crank).** The two frictional cords need several strokes to settle. Three strokes (12 s) close within 0.233 px, under the 0.25 px tolerance. The smoothing spreads 0.23 px and 3.1 mrad (the friction-driven pulley) over 12 s, which cannot be seen.
  - Both laid-rope cords are recorded as centrelines.
  - The output lead beyond the crop, its weight and the guide sheave are rebuilt by the same `placeEnds` the live sync calls.
  - The route builds the rope ends with `addBellCrankRopeEnds`, as `visual.js` does, so there are no serialized extras.

No ID needed the forward-then-reverse (palindrome) option, and no live drive had to change.

## Sections (111, 112, 124, 126)

The section view is off by default and toggled by the viewer.

- **111.** The micrometer's section cap is rebuilt from the sleeve angle and height on every live sync. Its route now has `sync: (u, qpos) => u.section.update(qpos[0], qpos[1])`, the same call the live sync makes, using the hook lane p60-bake-a added. The clipping planes are set natively by `section.set` on the baked model.
- **112.** The caps are static in grip coordinates, so the section needs no hook.
- **124 and 126.** These sections work by visibility and need nothing.

Section strips `strip-{111,112,124,126}-section.png` show the cut parts staying cut through the seam and matching live.

## Shared tool changes

All of these were made with precise edits while lane p60-bake-a was editing the same files. The pilots' tests still pass.

1. **Cord centrelines** (`record`, `seamError`, `buildVariant` in `scripts/lib/mujoco-bake.mjs`; `mujoco-playback.js`).
   - Config `curves: {meshKey: live => points}` records a rebuilt cord's centreline instead of its vertex frames.
   - The seam error includes the curve points. Residuals are smoothed like vertices. Frames are stored with the existing principal/quantized frame storage.
   - Playback interpolates the points and passes them as `sync(u, qpos, curves)`.
   - Why: 124's laid rope (15,036 vertices) cannot be compressed as a vertex basis, and the bundle was 43.7 MB. It is now 498 KiB.
2. **`derivedMeshes`.** These are meshes the route's sync rebuilds from the curves (126's output lead), so they are not recorded.
3. **`qpos: false`.** This omits the recorded joint coordinates. A many-section cord's qpos was 900 KB for 124, and nothing in playback reads it. It is used for 122, 124, 125 and 126.
4. **Smooth transform encoding `d2`** (`encodeSmoothArray` in `mujoco-bake-format.js`, decoded by `decodeArray`).
   - Animated transform tracks are rounded to 1e-4 units (0.01 px) and 1e-5 per quaternion component. They are then stored as int16 second differences, with the low and high bytes in separate planes.
   - The error does not accumulate. The encoder falls back to float32 on overflow.
   - gzip compresses these tracks about three times better: 122 went from 668 to 94 KiB and 125 from 5.2 MB to 1.0 MB.
   - Old float32 bundles still decode. A new test checks the round trip and the fallback.
5. **Unchanged index reuse.** A vertex track whose index equals the current geometry's stores `reuseIndex: true` instead of the index.
6. **Principal basis sizes** now start at 1, 2 and 4 components before 8–64. 124's rank-one stock deformation uses a one-component basis.
7. **Bug fixes.**
   - `findRotators` treated an identity step with rounding error (w = 1 − 1e-16, zero vector part) as a rotation about an undefined axis. It then rejected 121's stationary cog as having "no fixed spin axis". The angle now uses `atan2(|v|, |w|)`.
   - `serializeExtra` failed on `LaidRopeGeometry`, which cannot `clone()` without its curve. It now copies into a plain `BufferGeometry`.
8. The config header in `mujoco-bake-configs.mjs` documents `curves`, `derivedMeshes`, `qpos` and `minLoopSeconds`.

## Load time: lazy collision cells

Most of the baked load time for 114–119, 122 and 125 was the collision decomposition inside `geometry.js`. Playback builds that geometry but never reads the collision data. The decomposition is now deferred until first access, as the pilots did for 113 and 120, in these files:
- `mujoco-{double-rack, equal-racks, rack-rectifier, stroke-doubler, endless-rack}/geometry.js` (`convexPlateCells` into `u.cells`);
- `mujoco-roller-yoke/geometry.js` (`u.collision`);
- `mujoco-{variable-traverse, cascaded-traverse}/geometry.js` (`segmentClampContactCells` into `u.cells` and `u.contactApproximation`).

Live physics reads these properties immediately in its factory, before any presentation, so live behaviour is unchanged. The source geometries are captured at the point where they were previously used. The compiled-physics fingerprint test passes for all eight IDs, which shows the collision cells are identical.

In Node, geometry build times dropped:

| ID | before | after |
|---|---|---|
| 114 | 1552 ms | 137 ms |
| 115 | 1718 ms | 17 ms |
| 116 | 2197 ms | 26 ms |
| 117 | 493 ms | 22 ms |
| 118 | 1377 ms | 31 ms |
| 119 | 1478 ms | 33 ms |
| 122 | 866 ms | 31 ms |
| 125 | 1583 ms | 51 ms |

## Verification

**Bake checks.** All 16 bakes pass the tool's own gates: loop closure, round trip within raw seam + 0.1 px, and seam step and second difference no worse than inside the loop.

**Browser strips.** They are in `/dev/shm/b60b/`:
- `strip-<id>.png` for every ID, and `strip-121-reverse.png`;
- section strips `strip-{111,112,124,126}-section.png`;
- contact sheets `sheetA.png` and `sheetB.png`.

Each strip was captured from the production loader (default URL, baked route) on a freshly restarted server. It shows the seam at L−0.5 s, −0.25 s, −2dt, −dt, L, +dt, +2dt, +0.25 s and +0.5 s, then baked against live at 0.37L and 0.71L, rendered by the app engine. All were inspected: none shows a jump at the seam, and every baked frame matches its live frame. For 125, live was stepped to 1249 s in the browser for the 0.71L comparison.

**Tests.**
- `tests/mujoco-baked-loops.test.mjs`: 116 pass, 0 fail. This covers every route, including the pilots and lane A's IDs, plus the new encoding test.
- Live tests for all 16 IDs (`mujoco-{reverse-thread-candidate, thread-cutting, half-nut-candidate, micrometer, persian-drill, double-rack, equal-racks, rack-rectifier, roller-yoke, stroke-doubler, endless-rack, reversible-click, variable-traverse, bow-drill, cascaded-traverse, bell-crank}.test.mjs`): 80 pass, 0 fail. They were run again after the lazy-cell edits.
- `authored-loader`, `rotation-indicator` and `source-presentation` have 3 failures, all in other lanes' in-progress IDs: an escapement jam, 291's rotation cue and 288's removal. None involves these IDs.

## Remaining limits

- **108's load stays slow: 5.96 → 5.45 s.** The cost is not collision. It is the visible double-start groove surface: `reverseThreadLands` and `profile.boundaries` take about 4 s in Node. The same cells serve as the collision lands, so making them lazy does not help. Reducing this means baking the barrel geometry offline or speeding up the groove sweep. This lane did not do either.
- **124 (0.084 px) and 126 (0.233 px) replay one real settled stretch of frictional cord motion.** A later stretch of the live simulation would differ slightly. 126 uses most of the 0.25 px tolerance, spread over 12 s.
- **Bundle sizes.** 125's 1748 s loop is 1.0 MB, and 124 is 498 KiB, mostly the stock's vertex mean and basis. Per-frame cost for 124 and 126 is 1.3–2 ms, because the laid ropes are rebuilt each frame as they are live.
- **125's loop is 29 minutes, the true period of the 19:23:29 train.** It is sampled at 20 Hz rather than about 60 Hz.

## Files

- Tool:
  - `scripts/lib/mujoco-bake.mjs`
  - `scripts/bake-mujoco-movement.mjs`
  - `src/simulation/baked/mujoco-bake-format.js`
  - `src/simulation/baked/mujoco-playback.js`
- Configs and routes: `scripts/lib/mujoco-bake-configs.mjs` (16 entries and header), `src/simulation/baked/mujoco-baked-routes.js` (16 routes; 111, 124 and 126 with `sync`).
- Assets: `src/simulation/baked/assets/mujoco-{108,109,110,111,112,114,115,116,117,118,119,121,122,124,125,126}.{json.gz,provenance.json}`.
- Lazy collision cells: `src/simulation/mujoco-{double-rack, equal-racks, rack-rectifier, stroke-doubler, endless-rack, roller-yoke, variable-traverse, cascaded-traverse}/geometry.js`.
- Test: `tests/mujoco-baked-loops.test.mjs` (encoding test).
