# p60 bake tool: seamless baked loops for live MuJoCo movements

Lane p60-bake-tool. The lane built a generic bake pipeline for the 38 live MuJoCo routes and proved it on 82, 93, 99, 113 and 120. These five IDs now load a baked loop by default. The live simulations remain in the repository, unchanged apart from the 120 fixes below, and still run with `?live`.

## Usage

```
node scripts/bake-mujoco-movement.mjs <id> [<id> ...] [--dry-run] [--verbose]
```

A movement needs three things:

1. **A live factory** in `physicsFactories` (`src/simulation/model-loader.js`). These already exist and stay there.
2. **A route** in `src/simulation/baked/mujoco-baked-routes.js`. The route gives:
   - `asset`: a literal `new URL('./assets/mujoco-NNN.json.gz', import.meta.url)`.
   - `geometry`: the same geometry-only call the movement's `visual.js` makes before it builds physics. For example, 82 calls `makeTreadleRatchetCandidate({shortFaceFraction:.06})`.
3. **A config** in `scripts/lib/mujoco-bake-configs.mjs`. The config gives `directory` (the live module folder) and, when needed, any of these overrides:
   - `options`
   - `variants` and `defaultVariant` (configuration selectors)
   - `period`
   - `wrap` (steadily turning parts, with tooth `symmetry`)
   - `warmupPeriods`, `maxLoopPeriods`, `searchPeriods`
   - `tolerancePixels`
   - `sampleRate`
   - `cycle` (`'periodic'` or `'palindrome'`)
   - `note` (the cycle design, copied into the provenance)

   `BAKE_DEFAULTS` is in `scripts/lib/mujoco-bake.mjs`.

The script writes two files:
- `src/simulation/baked/assets/mujoco-NNN.json.gz`
- `mujoco-NNN.provenance.json`, which records the loop, closure, round trip, seam statistics, source hashes, the physics fingerprint and the cycle design.

Then add the ID to nothing else: `tests/mujoco-baked-loops.test.mjs` iterates over the routes.

To run the live simulation in the browser, add `?live` (or `?live=1`, or `?mujoco=live`) before or after the `#`. For example, `/?live#/movement/99` or `/#/movement/99?live`. See `preferLiveMujoco()` in `model-loader.js`.

## Pipeline design

- **Record** (`record` in `scripts/lib/mujoco-bake.mjs`).
  - The script runs the live factory headlessly in Node (`@mujoco/mujoco`, as the tests do) from t=0 through its own `update(time)`, so recording uses the production stepping path.
  - The sample interval divides both the drive period and the physics step exactly. It uses the divisor nearest to 60 Hz and not below it; 93, 99, 113 and 120 sample at 62.5 Hz.
  - At every sample it records, for every object:
    - local position and quaternion (float64);
    - visibility;
    - each mesh's geometry. A frame is copied only when the geometry identity, its attributes or their versions change. This captures cords, straps and springs that are rebuilt or edited in place.
  - It also records `qpos`.
  - It fails loudly on scale animation, parts added or removed mid-run, and changing topology.
- **Object addressing** (`src/simulation/baked/mujoco-bake-format.js`). Each object is addressed from its nearest ancestor in `userData.blocks` or `userData.parts`, then by name and occurrence among equally named siblings. Adding a differently named static part (a support, a bracket) does not move any recorded address.
- **Structural diff.** The recorder compares the live model with a fresh geometry-only build and stores only:
  - parts that `visual.js` adds (82's torsion spring), serialized with plain buffer geometry after crease normals;
  - removed parts;
  - material and object property changes (82's ratchet face colour);
  - an allow-list of root `userData` presentation keys (camera fit, notes, `hideGround`, configurations and so on);
  - the live focus and camera direction.

  The script rejects differing clipping planes explicitly.
- **Playback** (`src/simulation/baked/mujoco-playback.js`).
  - `loadBakedMujocoMovement(id)` fetches the bundle and builds the movement's **current** geometry in parallel.
  - It then applies the diff and plays the tracks:
    - position lerp and quaternion slerp between samples;
    - deforming vertices rebuilt from a mean plus a small basis;
    - visibility runs.
  - The loop repeats forever. `supportsRestart` is false, so no Restart button appears.
  - `setConfiguration` switches between baked variants (113's pinion/rack input).
  - `userData.state` gives `{time, loopPhase, loops, qpos}`.
  - `setSectionView` and other functions that come from `geometry.js` keep working natively (99's section view).
- **Deforming parts.** Vertex frames are stored as a mean plus an orthonormal basis found by subspace iteration, with per-frame coefficients. The basis grows (8, 16, 32, 64 components) until the largest error is at most 0.02 px for positions and 0.01 for normals. Otherwise the frames are stored quantized. This took 82 from 8.0 MiB to 0.62 MiB.
- **Integration.** `loadUnpresentedModel` in `model-loader.js` routes the IDs in `bakedMujocoRoutes` to the baked playback unless `preferLiveMujoco()` is true. `physicsFactories` is unchanged. Source presentation (removals, rotation cues, crease normals) runs on the baked model exactly as on the live one; the test checks that the removed roles are identical.

## Looping method

1. **Loop candidates.** Loop starts are whole drive periods after the warm-up (`t0 = kP`), so the drive phase at the loop start equals the phase at t=0 and the opening frame is the engraving pose. Loop lengths are whole periods (`L = nP`, n = 1…`maxLoopPeriods`).
2. **Seam error.** For each candidate, the seam error is the largest world-space displacement of every mesh's bounding-box corners between `t0` and `t0+L`, plus deforming vertices. It is also measured one and two samples later, so a velocity mismatch counts as seam error. The error is in engraving pixels (0.01 world units). A visibility mismatch rejects the candidate.
3. **Choice.** The shortest n with a candidate within `tolerancePixels` wins (default 0.25 px). Among those, the start with the smallest error wins. If nothing closes, the bake fails and lists the best candidates and the part that dominates their error.
4. **Steadily turning parts.** Parts whose net rotation over the record exceeds half a turn (or that are listed in `wrap`) are carried forward by a whole-loop turn about their own spin axis. That is a right-multiplied local rotation, so a roller carried on a sliding follower also works. `symmetry` snaps the turn to the tooth pitch, and playback applies `k` times the turn in loop `k`. A continuously running crank closes on itself (2π), and a ratchet wheel advances by whole teeth each loop without a jump.
5. **Residual smoothing.** Whatever small seam error remains is spread linearly over the loop. Positions are reduced by `w·Δp`, rotations by `slerp(I, Δq, w)`, and vertices likewise, with `w = s/N`. The last sample therefore equals the (turned) first sample exactly.
6. **Validation in the bake.**
   - **Round trip.** The bundle is rebuilt as the browser does and compared with the live model at nine points across the loop. The error must be at most the raw seam plus 0.1 px.
   - **Seam continuity.** The per-sample step and the second difference across the seam must not exceed their largest values inside the loop by more than 0.05 px.
7. **Sims that end or never repeat.** `cycle: 'palindrome'` records the window after the warm-up and plays it forward, then time-reversed. This is only for quasi-static mechanisms, because it reverses dynamics. The better choice is a reversing drive in the movement's physics (its `period` and amplitude options), recorded as a periodic cycle. All five pilots already had periodic or reversing drives.

The motion-strip evidence (seam frames at L−0.5, −0.25, −2dt, −dt, 0, +dt, +2dt, +0.25, +0.5 s, plus baked-vs-live frames at 0.37L and 0.71L) is in `/dev/shm/y0/strip-{82,93,99,113,120}.png`. All were inspected. None shows a jump at the seam, and every baked frame matches its live frame.

## Pilot results

Browser load time is the median of three fresh-context runs on the dev server (warm module transforms, cold page). It covers module import, model load, engine construction and the first render. `update` is the cost of advancing one 1/60 s frame.

| ID | cycle design | loop | start | raw seam | smoothing | round trip | bundle | load live → baked | update live → baked |
|---|---|---|---|---|---|---|---|---|---|
| 82 | periodic treadle; ratchet wheel wrapped at 14 teeth per loop (raw 13.99) | 5 × 4 s = 20 s | 108 s | 0.471 px | 0.041 px, 2.7e-3 rad | 0.334 px | 624 KiB | 375 → 160 ms | 1.57 → 0.064 ms |
| 93 | constant-speed crank, one turn | 4 s | 12 s | 0.000 px | 0 | 0.000 px | 6 KiB | 204 → 77 ms | 0.14 → 0.012 ms |
| 99 | reversing cosine disk drive | 12 s | 24 s | 0.000 px | 0 | 0.000 px | 25 KiB | 2106 → 122 ms | 3.13 → 0.010 ms |
| 113 pinion | sinusoidal reversal after the start ramp | 6 s | 54 s | 0.007 px | 2.0e-4 rad | 0.005 px | 42 KiB (both) | 1011 → 97 ms | 2.46 → 0.011 ms |
| 113 rack | same, rack driven | 6 s | 42 s | 0.005 px | 1.4e-4 rad | 0.004 px | | | |
| 120 | reversing shaft stroke: close, dwell under torque, reopen | 5 s | 25 s | 0.000 px | 0 | 0.000 px | 15 KiB | 946 → 292 ms | 3.65 → 0.015 ms |

Notes:

- **82: the ratchet does not repeat exactly.** The freewheeling ratchet is quasi-periodic: it advances 0.7 to 3.9 teeth per stroke, in a roughly six-stroke pattern. No 1–4 period loop closed; the best was 1.6 px, at the wheel. The bake searches up to 12 periods over a 36-period record with a 0.5 px tolerance, and a 5-period loop closes at 0.47 px. It replays one real 20 s stretch. A later loop of the live simulation would differ, which is inherent to that dynamics.
- **82: the bundle is larger than the others.** Its size comes from 13 animated transform tracks plus the basis-compressed strap and spring.
- **99: steady-state repeat.** The drive and contact settle into an exactly repeating cycle; the seam is closed to float precision.
- **113 and 120: most of their old load time was not physics.** It was the collision decomposition inside `geometry.js`, which physics needs and playback never uses. `u.cells` (and 120's `contactApproximation`) are now decomposed on first access; the live physics reads them immediately, so live behaviour is unchanged. After this change, geometry builds in 11 ms (113) and 160 ms (120) in Node.
- **Bake time** is 1 s (93), 28 s (82), 33 s (120), 63 s (113) and 94 s (99). The live sims are expensive; the second pass is the round trip.

## Movement 120: the jaw points now meet at one point

On the plate, the two jaw points lie 169 px and 181 px from the common pivot. Closing therefore made them pass each other: at the closed stop the right point sat 12 px above the left point and 17 px past it. In `geometry.js`, `jawTips()` now moves each point along its own radius (about 6 px) to the mean radius of 174.9 px. The points meet at one spot at about 1.517 rad of input (the jaws swing 22.1° and 25.3°). The 1.8 rad command presses them together at the torque limit, and they dwell there and reopen.

- Numerically, the closed gap between the points is 0.00 px and the points never cross.
- A new test, `120 closed jaws meet point to point without crossing`, checks this. The closing-input bounds in two existing tests changed from 1.68–1.72 to 1.50–1.53.
- Captures at `/dev/shm/y0/120-closed.png` and the zoomed crops `/dev/shm/y0/120-tip-default.png` and `/dev/shm/y0/120-tip-rot1.png` show a clean point contact in the default and rotated views. The composite also has a far zoom-out.
- The profile comment and the reconstruction note were updated.

## Visual-only geometry changes and staleness

Playback builds the **current** `geometry.js` and applies recorded body transforms by address. A support, pillar or bracket added to or removed from `geometry.js` therefore appears without a rebake, as long as moving parts keep their `blocks` or `parts` names.

This held in practice. During this lane, p60-supports removed 113's back bar, bearings and pillar, and the test still passed with the new geometry.

Staleness is detected in two ways:

- **Motion-source hashes.** The test compares hashes of every file in the movement folder except `geometry.js` and `section.js`, plus `mujoco/simulation.js`.
- **Physics fingerprint.** This is the compiled MJCF with `<inertial>` elements stripped. Collision cells, joints and actuators force a rebake. Mass changes from a stub on a moving part do not.

`provenance.visualSourcesAtBake` and `fullXmlSha256` are informational. If a support edit renames or removes a moving part's address, the geometry test fails with "no part at …; rebake".

## Tests

`tests/mujoco-baked-loops.test.mjs` (16 tests, all pass) covers:

- the `?live` flag, and that live factories are kept;
- per ID: asset hash, motion-source hashes, seam within tolerance, whole drive periods, round trip within the raw seam plus 0.1 px;
- per ID: the compiled-physics fingerprint, from a fresh live build;
- per ID, on the current geometry: finite poses at 1000 loops, seam continuity for every variant, identical source-presentation removals to the live model, the same camera and fit bounds, and the same mesh count.

The live-physics tests (`mujoco-*.test.mjs`) still build the live factories directly.

## Converting the remaining 33 IDs

1. Add a route and a config, then run the bake. Start with `--dry-run --verbose` to see the tracks, extras and patches.
2. Expect these per-family issues:
   - **Clipping-plane sections** (102, 103, 105, 111, 112) use `section.set` with material `clippingPlanes`. Some also update caps each frame (111's cap is only updated while visible). Extend the recorder to bake in section state, or record with the section enabled.
   - **104** (worm saddle): its `setConfiguration` lives in `visual.js`, so use `variants` as 113 does.
   - **124** (bow drill): it deforms the stock mesh in place and redraws the cord. The vertex tracks should cover both; check the basis size.
   - **Quasi-periodic contacts** (ratchets, clicks, free rollers): these may need a longer `maxLoopPeriods`, a tooth `symmetry` wrap, or a raised tolerance with an honest note, as for 82.
   - **Continuous screws that translate without returning:** these need a reversing drive option in physics; `wrap` does not support translation.
3. Keep the live physics in `physicsFactories` and keep its tests running.
