# p60-bake-a: baked MuJoCo loops for 83, 90–92, 94–98, 100–107

Lane p60-bake-a. It used the pipeline from `docs/p60-bake-tool-review.md` to bake 17 live MuJoCo movements into seamless loops. These IDs now load a baked loop by default. The live factories in `physicsFactories` are unchanged and still run with `?live`. No `geometry.js`, `physics.js` or `visual.js` file was edited.

## Results

- **Loop.** Whole drive periods, taken after the warm-up.
- **Raw seam.** Closure error before residual smoothing, in engraving pixels.
- **Round trip.** Baked playback against the live model at nine points across the loop.
- **Load time.** Median of three fresh browser contexts on the dev server (warm module transforms, cold page). It covers module import, model load, engine construction and the first render, the same scope as the pilot table.
- **Update.** Cost of advancing one 1/60 s frame.

| ID | cycle design | loop (start) | raw seam | correction | round trip | bundle | load live → baked | update live → baked |
|---|---|---|---|---|---|---|---|---|
| 83 | sinusoidal rocking; 38-tooth crown wheel wrapped by whole teeth (8 teeth per loop, raw 7.9996) | 4 s = 1 P (40 s) | 0.055 px | 0.022 px, 1.5e-4 rad | 0.050 px | 205 KiB | 565 → 235 ms | 3.52 → 0.058 ms |
| 90 | constant-speed eccentric, one turn | 4 s (32 s) | 0.003 | 0.0005 | 0.0005 | 6 KiB | 331 → 225 | 0.23 → 0.018 |
| 91 | constant-speed triangular eccentric | 4 s (28 s) | 0.000 | 0 | 0.000 | 6 KiB | 429 → 293 | 0.18 → 0.017 |
| 92 | constant-speed crank | 4 s (12 s) | 0.000 | 0 | 0.000 | 11 KiB | 253 → 151 | 0.19 → 0.012 |
| 94 | cosine reversal across the crank range | 8 s (24 s) | 0.000 | 0 | 0.000 | 13 KiB | 638 → 296 | 0.69 → 0.025 |
| 95 | constant-speed inclined disk | 4 s (12 s) | 0.000 | 0 | 0.000 | 10 KiB | 320 → 203 | 0.22 → 0.027 |
| 96 | constant-speed heart cam, spring coil as vertex basis | 4 s (16 s) | 0.000 | 0 | 0.0003 | 103 KiB | 517 → 166 | 1.11 → 0.050 |
| 97 | constant-speed grooved heart | 4 s (16 s) | 0.000 | 0 | 0.000 | 6 KiB | 2336 → 190 | 3.36 → 0.015 |
| 98 | constant-speed endless groove | 2 s (4 s) | 0.004 | 0.000 | 0.002 | 4 KiB | 842 → 172 | 1.39 → 0.018 |
| 100 | constant-speed quick-return crank | 4 s (8 s) | 0.000 | 0 | 0.000 | 7 KiB | 281 → 159 | 0.23 → 0.018 |
| 101 | cosine rocking lever | 3 s (6 s) | 0.000 | 0 | 0.000 | 5 KiB | 259 → 156 | 0.40 → 0.020 |
| 102 | existing reversing nut drive (1 − cos); section cap refreshed from recorded qpos | 12 s (24 s) | 0.000 | 0 | 0.000 | 17 KiB | 697 → 217 | 4.78 → 0.025 |
| 103 | existing reversing screw drive (1 − cos) | 8 s (64 s) | 0.000 | 0 | 0.000 | 12 KiB | 1220 → 198 | 6.90 → 0.022 |
| 104 worm | existing reversing input on the screw | 8 s (24 s) | 0.000 | 0 | 0.000 | 28 KiB (both) | 601 → 394 | 0.12 → 0.015 |
| 104 wheel | existing reversing input on the wheel | 8 s (16 s) | 0.000 | 0 | 0.087 | | | |
| 105 | existing reversing handle drive (1 − cos) | 8 s (96 s) | 0.000 | 0 | 0.000 | 12 KiB | 370 → 242 | 0.12 → 0.015 |
| 106 | constant-speed barrel cam | 4 s (8 s) | 0.004 | 0.001 | 0.001 | 6 KiB | 1423 → 176 | 2.73 → 0.023 |
| 107 | constant-speed serpentine cam (uses 106's physics) | 24 s (48 s) | 0.000 | 0 | 0.000 | 24 KiB | 3394 → 212 | 5.77 → 0.015 |

Every ID closes in one drive period. The bake's seam-continuity check passed for all of them: the seam step and second difference are no larger than their maximum inside the loop. The loop start is the closed candidate with the smallest error. That start can fall late in the record (105 at 96 s), but it is always a whole period, so the opening frame is the engraving pose.

Some load times are dominated by work other than physics:

- **104:** baked 394 ms. This is building the hobbed wheel in `geometry.js`.
- **91, 94:** baked 290–300 ms, also mostly geometry.

The largest gains are 97, 103, 106 and 107. Each of these had seconds of collision preparation.

### Cycle design notes

- **Screws (102, 103, 105) and 104.** All four already had reversing `1 − cos` drives in their live physics. The screw turns forward and back, so the slide or nut returns every period. No new reversing drive was needed, and the palindrome mode was not used for any ID.
- **83.** The crown wheel is a ratchet. It is wrapped with tooth symmetry 2π/38 and advances 8 teeth per 4 s loop: the wrap angle is 1.32278 rad, against a raw 1.32284 rad. One period closed at 0.055 px, so the longer search that 82 needed was unnecessary.
- **104 variants.** Worm and wheel are separate variants, as for 113. `setConfiguration` switches between the baked loops. The wheel variant's round trip is 0.087 px, within the 0.1 px limit. The residual is float32 quaternion precision on the fast-turning worm.

## Shared tool changes

All changes were made with precise edits. The other bake lane (p60-bake-b) was editing the same files at the same time; its later additions (`d2` smooth-array encoding, cord `curves` passed to `sync`) are compatible with these.

1. **Playback sync hook for sections** (`src/simulation/baked/mujoco-playback.js`).
   - `makeBakedMujocoModel(bundle, visual, route)` now accepts the route. If the route has `sync(u, qpos)`, playback calls it after each update with the interpolated recorded qpos.
   - 102 is the only one of my IDs that needs this. Its section cap sits at the root and is recomputed from the nut pose each frame. Its route now calls `u.section.update(qpos[0], u.profile.nutBase + qpos[1])`, which is the same call the live sync makes.
   - The caps on 103 and 105 are children of moving blocks, so they follow the baked transforms without a hook.
   - Clipping planes stay on the materials built by the current `geometry.js`. `setSectionView` therefore works natively, and the cut parts stay cut on the baked models.
   - The bake round trip and `tests/mujoco-baked-loops.test.mjs` now pass the route too, so they exercise the hook.
2. **Gram-Schmidt reorthogonalization** (`principalFrames` in `scripts/lib/mujoco-bake.mjs`).
   - 96's spring coil depends on a single parameter, so its frames have rank of about 3. A single Gram-Schmidt pass left the extra basis vectors far from orthogonal, with 0.65 world units of error, and every coil fell back to quantized frames. The first 96 bundle was 4.4 MiB.
   - Two passes, plus dropping vectors that are numerically dependent, give 8 components at 7e-7 error. 96 is now 103 KiB, and 83's four springs dropped from 415 to 205 KiB.
   - 82 would shrink too if rebaked. It was left as it is: its asset is valid and its provenance still matches.
3. **Several motion directories** (`motionSources` and `visualSources`). `directory` may now be an array. 107's live factory uses `mujoco-barrel-cam/physics.js`, so its config lists both folders, and a change to 106's physics marks 107 stale.

## Verification

- **Seam motion strips.** Strips are in `/dev/shm/b60a/strip-<id>.png` and the grouped sheets `/dev/shm/b60a/group-*.png`. They were captured in the default view from a freshly restarted server. Each shows seam frames at L−0.5, −0.25, −2dt, −dt, 0, +dt, +2dt, +0.25 and +0.5 s, plus baked-vs-live frames at 0.37L and 0.71L.
  - Variant strip: `strip-104-wheel.png`.
  - Section-view strips: `strip-102-section.png`, `strip-103-section.png` and `strip-105-section.png`, with a 102 zoom in `zoom102.png`.
  - I inspected all of them. None shows a jump at the seam, and every baked frame matches its live frame.
  - In section view, the 102 cap tracks the nut, and the 103 and 105 caps move with the carriage and the ram, matching live.
- **Tests.**
  - `tests/mujoco-baked-loops.test.mjs`: 112 pass. The 3 failures are all for 125, whose route belongs to lane p60-bake-b and had no asset yet. All 66 tests for the 22 IDs that are mine or the pilots' pass.
  - Live tests: `mujoco-{spring-sector, eccentric-yoke, triangular-eccentric, crank-slider, variable-crank, inclined-disk, heart-cam, grooved-heart, endless-groove, quick-return, slotted-bar, screw, leadscrew-slide, worm-saddle, screw-press, barrel-cam, serpentine-cam}.test.mjs` all pass.
  - `tests/see-through-part.test.mjs`: its 94 case passes. One case fails, for movement 281, which is unrelated to this lane.

## Remaining limits

- The looping motion is one recorded steady-state period. Only 83's ratchet uses a whole-tooth wrap, and its loop closes at 0.055 px.
- 102's section cap depends on the route's `sync`. If its section code changes signature, update the route along with it.
