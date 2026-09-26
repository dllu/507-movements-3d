# Pass 59 lane p59-ao: soft ambient occlusion in the viewer

The user said that many parts look flat. This lane tested whether a small,
tasteful amount of ambient occlusion or soft lighting helps, and what it
costs in performance.

## Renderer before this pass

`src/simulation/async-engine.js`. `engine.js` only subclasses it to build the
model synchronously for offline reviews.

- `WebGLRenderer` with `antialias: false` and a fixed `setPixelRatio(2)`,
  which acts as 2x supersampling. At the default 1400x850 desktop viewport
  the stage is 670x670 CSS px, so the drawing buffer is 1340x1340.
- `ACESFilmicToneMapping` with exposure 1.08, `SRGBColorSpace` output, and
  the paper-coloured `scene.background`.
- Lights: `HemisphereLight(0xffffff, 0x7b766c, 2.15)`; a key
  `DirectionalLight(0xfff9eb, 3.15)` that casts shadows (1536² map; three now
  maps `PCFSoftShadowMap` to PCF), with per-model shadow extent and bias; a
  cool fill `DirectionalLight(0xb9d8e2, 1.15)` without shadows.
- A `ShadowMaterial` floor at opacity 0.14.
- Materials: mostly `matte()` from `primitives.js`, a `MeshStandardMaterial`
  with metalness 0.08 and roughness 0.72. The rotation cue is an
  `onBeforeCompile` fragment patch. Water and glass are transparent standard
  materials. Clean cutaways use material `clippingPlanes`.
- The loop calls `renderer.render` on every animation frame. There is no
  post-processing.

The strong hemisphere term plus mostly front-facing flat plates give little
shading variation, and nothing darkens contact creases or inner corners.
That is why parts look flat.

## Options tried

| Option | Result |
| --- | --- |
| **GTAO (three `GTAOPass` shaders), half-resolution, multiplied over the existing frame.** | **Chosen.** Creases, gear roots, stepped-pulley steps, bosses on plates and section interiors gain depth. Flat faces, the paper background, colours and the rotation cue are unchanged. |
| GTAOPass/SAOPass through `EffectComposer` + `OutputPass` | Rejected without building it. The scene would render into a linear target and tone-map in `OutputPass`, so the paper background, which is currently not tone-mapped, would change colour. The pass's built-in `overrideMaterial` prepass also ignores per-material clipping planes (clipped geometry would cast AO into clean cutaways) and draws water and glass as opaque. |
| n8ao | Not a dependency. Not added: three's own GTAO shaders were enough. |
| Environment light (`RoomEnvironment` PMREM, `environmentIntensity` 0.3–0.6, hemisphere cut to 40–50 %) | Rejected. It washes out the pastel palette and puts glossy streaks on black shafts. The flat look gets worse, not better, and creases still get no occlusion. Using it well would mean re-balancing every light. Captures: `/dev/shm/x1/env1`, `/dev/shm/x1/env2`. |
| Stronger AO (intensity 1.0, radius 0.15 R) | Too dark, and grainy next to creases. |
| Weaker AO (intensity 0.55, radius 0.07 R) | Hardly visible. |
| Single Poisson denoise pass | Visible 1–2 px grain on flat faces next to creases (063 pawl). A second pass on another noise channel removes it. |

## Implementation (`src/simulation/ambient-occlusion.js`)

1. The frame renders to the canvas exactly as before. Tone mapping,
   background, shadows and the rotation cue are untouched.
2. **Normal/depth prepass** into GTAOPass's own half-float target, sized at
   0.5 of the drawing buffer (one sample per CSS pixel). Each visible mesh
   temporarily gets:
   - for opaque materials, a cached `MeshNormalMaterial` with the same
     `side`, `flatShading` and **clipping planes**, so clean cutaways stay
     clean. It also keeps any vertex-deforming `onBeforeCompile` hook, such as
     270's laid rope. The rotation cue's hook only changes fragments, so it is
     skipped.
   - for transparent materials (water, glass, see-through parts), a
     **transmittance mask**. It writes no colour or depth; blending scales the
     buffer alpha by `1 - opacity`.
   - the shadow-catching floor, zero-opacity framing guides, lines, points
     and sprites are hidden.

   During the prepass the scene background is removed and the shadow map is
   not re-rendered.
3. `GTAOPass` runs its GTAO shader (16 samples) and Poisson denoise
   (16 samples) with its output set to Off. A second denoise pass then clears
   the remaining grain.
4. **Final multiply** onto the canvas:
   `mix(1, ao, intensity * transmittance³)`. Background pixels stay 1, so the
   paper is untouched. AO fades behind water, so water-filled channels in
   sections stay clean blue instead of turning grey. Parts behind thin glass
   (opacity about 0.2) keep about half their AO.

Chosen settings (`AMBIENT_OCCLUSION_SETTINGS`):

| Setting | Value |
| --- | --- |
| `resolutionScale` | 0.5 of the drawing buffer |
| `radiusFraction` | 0.08 × fitted model radius (world units, set from `fitCamera`) |
| `samples` | 16 |
| `denoiseSamples` × passes | 16 × 2, radius 10 px, `depthPhi` = 0.5 × AO radius |
| `distanceExponent` | 1.5 |
| `thickness` | 1 |
| `intensity` | 0.9 |

### The setting

- `MovementEngine` takes `options.ambientOcclusion`: `'auto'`, `'on'`,
  `'off'`, `true` or `false`. **The default is off**, so offline reviews,
  capture scripts and tests that construct the engine directly are
  unaffected. They also call `renderer.render` themselves, which never
  includes AO.
- The app (`src/main.js`) passes `'auto'` by default. This is the "default
  on" behaviour. To override:
  - for one visit: `#/movement/7?ao=off` (or `?ao=on`);
  - persistently: `localStorage['507.ambientOcclusion'] = 'off' | 'on' | 'auto'`.
- `'auto'` does not start AO on devices that look low-end:
  - `hardwareConcurrency` ≤ 2 or `deviceMemory` ≤ 2;
  - a software GL renderer (SwiftShader, llvmpipe, softpipe).
- `'auto'` also switches AO off for the current view after 1.5 s of
  back-to-back frames slower than 1/34 s. Gaps over 1 s count as pauses and
  are ignored.

  Verified in headless Chromium with SwiftShader and AO forced on for 007: AO
  was off within 6 s (`ambientOcclusionAutoDisabled` set). On the GPU, AO
  stays on.
- `engine.setAmbientOcclusion(bool)` toggles it at runtime.

## Performance

Setup: headless Chrome through Playwright, 1400x850 viewport, the real app
route with `?ao=off` and `?ao=on`, stage 670x670 CSS px at pixel ratio 2
(1340² drawing buffer). Each case ran twice.

- **Load:** time from `goto` until the stage is ready and two frames have
  drawn.
- **FPS:** requestAnimationFrame over 4 s.
- **Sync ms:** average of 120 `advance + render (+ AO) + readPixels(1px)`
  frames on a fixed engine. This isolates the cost of rendering.

### GPU (ANGLE/Vulkan, RTX 6000 Ada)

| ID | Load off → on (ms) | FPS off / on | Sync ms off → on |
| --- | --- | --- | --- |
| 459 (heavy) | 480, 474 → 505, 562 | 60.0 / 60.0 | 2.07 → 2.42 |
| 007 | 297, 302 → 320, 333 | 60.0 / 60.0 | 0.53 → 0.85 |
| 001 | 290, 293 → 353, 309 | 60.0 / 60.0 | 1.01 → 0.88 (noise) |
| 305 (light) | 289, 293 → 370, 421 | 60.0 / 60.0 | 0.39 → 0.53 |

On this GPU, AO adds about 0.1–0.35 ms per frame, playback stays
vsync-locked at 60 fps with an unchanged p95 (16.7–16.8 ms), and load takes
about 20–130 ms longer (compiling the normal-material, GTAO and denoise
shaders).

### Software GL (SwiftShader), a proxy for very weak or no GPUs

| ID | Load off → on (ms) | FPS off / on | Sync ms off → on |
| --- | --- | --- | --- |
| 459 | 897, 867 → 2528, 2763 | 27.9, 27.4 / 5.0 | 33 → 195 |
| 007 | 692, 723 → 2169, 2208 | 34.5, 34.2 / 5.5 | 26 → 177 |
| 001 | 577, 605 → 2127, 2108 | 48.8, 46.6 / 5.5 | 17 → 179 |
| 305 | 511, 457 → 1982, 1971 | 60.0 / 5.8 | 10 → 172 |

The cost is fill-bound, about 160 ms per frame on a CPU rasteriser. This is
why `'auto'` never starts AO on software renderers and has the
slow-frame cut-off for weak GPUs. With `'auto'`, SwiftShader (and so the
headless e2e and review runs) renders exactly as before.

The production bundle grows by about 10 KB gzipped (GTAO and Poisson
shaders, SimplexNoise, the pass, and the new module).

## Images

Each capture is 1600x800: AO off on the left, on at the final settings on the
right. Each ID has a default view (t = 0) and an oblique view (0.4 of a
period, direction (5, 3, 12)), in `/dev/shm/x1/final/<id>-{default,oblique}.png`.
Difference maps (8× amplified) are `*-diff.png`. I looked at every capture.

| ID | What AO adds | Mean darkening (0–255) | Share of pixels darkened > 4 |
| --- | --- | --- | --- |
| 007 | Gaps between belt and pulleys read deeper; bevel tooth roots shade. | 0.55 | 3.3 % |
| 008 | Stepped cone-pulley inner corners and belt contact. Subtle. | 0.18 | 1.3 % |
| 026 | Crown and spur tooth roots, hub collar. | 0.59 | 3.1 % |
| 063 | The pawl and lever plates stack visibly; small contact shade round pins. After the second denoise pass the flat faces are clean. | 0.54 | 2.7 % |
| 305 | Soft ring where the bosses meet the plate. The eccentric's quadrant cue still reads. | 0.14 | 0.8 % |
| 459 | Hub and cog interiors, bucket bails, trough corners. Water in the trough unchanged. | 0.93 | 5.7 % |
| 464 | The clean section cut gains interior corners (chamber, dome). Water-filled channels stay clean blue thanks to the transmittance fade. No AO from clipped geometry. | 4.19 | 20 % |
| 500 | Dial recess, case lip and the gauge's cut section get depth. | 1.01 | 7.3 % |
| 454 | Section pump: almost unchanged. Water covers most creases. | 0.82 | 4.8 % |
| 481 | See residuals below. | 4.53 | 19.7 % |
| 270 (earlier capture `/dev/shm/x1/cap9`) | Laid rope and quadrant cue unchanged; spokes and hub shade slightly. | — | — |

## Residuals and limits

- **481 (wet gas meter).** The drum head sits deep inside the opaque shell
  and rim, so it gets a broad, soft wash. The ports (looking into the closed
  drum) render as darker holes instead of pale patches. This is physically
  plausible, but it is the heaviest change in the set. If it reads as
  muddy, lower `radiusFraction` for this model. There is no per-model hook
  yet.
- AO is computed at one sample per CSS pixel and upsampled bilinearly. A
  hairline (about 1 CSS px) of crease shade can sit along a silhouette in
  front of a nearby surface (007 pulley edge). It is soft, not a black rim.
- AO multiplies the final lit colour, direct light included, as is usual for
  screen-space AO. It is not physically separated from the ambient term.
- Transparent surfaces add no AO of their own. Contact between water and
  wall is not shaded.
- The loop still redraws every frame while paused, now including AO. On a
  GPU this is negligible; skipping redraws of unchanged frames would be a
  separate optimisation.

## Tests

- `node --test tests/engine.test.mjs tests/camera-resize.test.mjs tests/camera-catalog.test.mjs tests/source-presentation.test.mjs tests/opening-camera-motion.test.mjs tests/crossed-rack.test.mjs tests/dual-input-differential.test.mjs tests/weighted-clutch.test.mjs`:
  32/32 pass.
- New `tests/ambient-occlusion.test.mjs`: 2/2 pass. It covers preference
  resolution (explicit settings, auto skipping software renderers), and the
  prepass material mapping (clipping planes and side kept, transparent to
  mask, shadow floor and zero-opacity materials hidden).
- `vite build`, written to a scratch directory, succeeds.
