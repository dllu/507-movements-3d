# 122 — Variable traverse from unequal geared cranks

The catalog now uses `src/simulation/mujoco-variable-traverse/`. One actuator
turns the lower gear; native tooth contact and ideal pin connections drive the
upper gear, two rods, rocking link and guided output bar. The visible geometry
restores the source's unequal rod lengths, broad curved link, pin sizes and
output silhouette. The crank radii are reduced by 15% so the drawn assembly
branch can complete the full repeating pattern without a toggle.

## Source interpretation and geometry

Brown's [engraving and caption](https://507movements.com/mm_122.html) describe
variable alternating traverse produced by the wrists of two spur gears. The
local source is `public/engravings/mm_122.png`, 525 × 525 pixels. One world unit
represents 100 source pixels. The bar axis follows the drawn direction
`[136, 29]` in world coordinates, about 12 degrees above the image horizontal.
Its ideal guide passes through the measured output pin.

The previous model prescribed both gear angles and solved a linkage with equal
74-unit rods, a narrow straight floating link and an output guide halfway between
the gear centers. It also added a base, posts, rear tie and slide supports absent
from the drawing. Seven baseline views record the discrepancy.

Bounded ink-midpoint fits give these image coordinates and radii:

| Feature | Center, pixels | Radius, pixels | Circle RMS, pixels |
| --- | --- | ---: | ---: |
| Upper hub | 164.567, 196.332 | 28.275 | 0.701 |
| Lower hub | 202.649, 392.783 | 30.665 | 0.444 |
| Upper shaft | 164.037, 195.592 | 17.143 | 0.612 |
| Lower shaft | 203.830, 392.737 | 18.664 | 0.529 |
| Upper crank pin | 150.003, 128.200 | 8.035 | 0.366 |
| Lower crank pin | 189.611, 334.332 | 7.135 | 0.348 |
| Upper rod eye | 150.565, 128.634 | 17.779 | 0.667 |
| Lower rod eye | 189.741, 335.354 | 17.532 | 0.610 |
| Floating top pin | 354.087, 84.588 | 8.348 | 0.625 |
| Floating bottom pin | 367.630, 298.612 | 8.268 | 0.329 |
| Floating top eye | 354.665, 86.132 | 17.817 | 0.416 |
| Floating bottom eye | 368.434, 299.617 | 17.998 | 0.488 |
| Output pin | 363.206, 194.496 | 13.505 | 0.323 |

Gear-edge samples exclude the rods and mesh region. The engraving is not quite
concentric: constraining its gear axes to the hub centers distorts tooth-count
selection. The initial unshifted compatible-count fit favored 26/22, but allowing
each axis to move up to eight pixels strongly favored 29 upper and 23 lower
teeth among 27–30 / 21–24 candidates. The selected axes are
`[160.566729, 194.331973]` and `[202.648964, 388.782899]`. Hub and shaft circles
are regularized onto those axes while retaining measured radii.

The gears share a 7.652017-pixel module and 20-degree generated involute flanks.
Opposite profile shifts of −0.5 / +0.5 reconcile their different drawn envelopes.
Addendum 0.8 and dedendum 1.5 module, with a 0.12-module cutter corner, retain
finite rounded tooth spaces. The compatible radial fit's absolute best tested
addendum was 0.6; 0.8 was selected for greater contact overlap and a closer tip
envelope at a small radial-score cost. This is a documented interpretation,
not a claim that the irregular drawing contains exact involutes.

The broad floating link and output plate use traced Bézier silhouettes. Rod
stems retain measured widths and ordinary bored circular ends. The output bar
is reconstructed as a plate; its drawn rounded end does not establish a unique
3D cross section. No physical guide or bearing frame is depicted or invented.

## Crank correction and the full repeating pattern

Using the measured crank radii with the source-position output guide makes the
source assembly branch fold after about 0.267 lower-gear turn. The unreduced
MuJoCo candidate stalls at 1.6863 radians and develops increasing input torque.
Independent continuation of the two rod-length equations finds the same fold.
An all-angle, two-branch circle/line sweep can find other assembly solutions;
this does **not** establish that every assembly is globally impossible.

The independent study follows 5,221 poses across all 29 lower turns, with the
upper gear making 23 opposite turns. Merely surviving the first revolution is
insufficient: at 89% crank radius the branch fails near turn 5.33, and at 87%
near turn 10.37. Small tested guide-angle changes also leave late failures.
At 86% both cranks complete the pattern, with minimum closure-Jacobian
determinant 0.13092. The selected 85% gives 0.25569 at the unchanged guide angle,
for another 0.67 pixel of maximum pin displacement. These sampled comparisons
do not claim a globally minimal geometry correction.

The corrected crank radii are 56.92477 / 47.59173 pixels. The original radii
about the regularized axes were 66.97031 / 55.99027 pixels, giving inward shifts
of 10.04555 / 8.39854 pixels. Rod lengths are recomputed to retain the source
floating-link and output-pin positions: 209.45606 / 181.45068 pixels, compared
with the measured 208.69225 / 181.56715. No output pose is prescribed during
playback. The catalog note explicitly discloses the 15% correction.

## Actual rendered edge agreement

The comparison script slices the actual triangle geometry and measures nearest
edge distance from source samples. This differs from the earlier radial fit.

| Edge group | Samples | RMS, pixels | Maximum, pixels |
| --- | ---: | ---: | ---: |
| Upper gear | 519 | 2.90247 | 13.63690 |
| Lower gear | 583 | 2.41503 | 7.16953 |
| Upper / lower hub | 111 / 118 | 3.34305 / 2.84297 | 5.21418 / 4.51636 |
| Upper / lower shaft | 96 / 118 | 2.80166 / 2.93741 | 5.15687 / 5.37413 |
| Upper / lower crank pin | 113 / 89 | 5.95614 / 5.16133 | 10.03955 / 8.62180 |
| Upper / lower crank eye | 107 / 117 | 5.39394 / 4.63203 | 9.17351 / 7.45411 |
| Floating top / bottom pin | 92 / 103 | 0.62432 / 0.32854 | 3.09818 / 0.89131 |
| Floating top / bottom eye | 108 / 84 | 1.26623 / 1.06818 | 2.33144 / 2.39904 |
| Output pin | 104 | 0.32318 | 0.90647 |
| Upper rod left / right | 56 each | 5.70355 / 5.67752 | 7.41915 / 7.68038 |
| Lower rod left / right | 47 each | 3.57223 / 2.56346 | 9.52724 / 5.15821 |
| Output left / right | 21 each | 2.34854 / 0.72199 | 3.89118 / 1.64120 |

The shifted crank eyes and stems account for much of their residual. Floating
body edges are assessed in the source overlay, without a separate numerical
edge-fit claim. All 19 final views were inspected, including that overlay,
seven advanced poses, crank and gear close-ups, pin close-ups, axial, oblique
and rear views. The complete assembly remains framed, without fog or ground.
Detail views intentionally crop to the working region.

## Native model, contact and clearance

Six native coordinates describe two gear hinges, two rod hinges, one sliding
bar and its rocking link. Two site-connect equalities close the rod-end pins.
Only the lower gear has an actuator; there is no gear-ratio equality, tendon,
upper-gear servo or scripted bar travel. A separate test disables the rod-end
closures and gravity: the upper gear follows by tooth contact, then stays at
rest when that contact is also disabled. In the assembled mechanism the rod
loops can also transmit force, so gear contact is intermittent.

The shared MuJoCo runtime owns stepping, reset, seeking and allocation disposal.
The default step is 1 ms with a Newton solver and inferred uniform density,
normalizing the lower rigid family's mass to one. Gravity is active. The input
approaches one revolution per four seconds with a 0.25-second startup ramp.
Consequently a full 29:23 pattern takes about 116.25 seconds, rather than being
compressed into a two-second animation. Hinge damping, ideal pin/guide
constraints, masses and depth are reconstruction assumptions, not calibrated
machine properties.

Nineteen visible solids have positive volume, closed oriented surfaces and no
degenerate triangles. Only the two gears have native collision cells; ideal
pins/guide supply the remaining constraints. The visible-to-collision boundary
approximation is at most 0.049620 source pixel, and compiled cell vertices
agree within 0.00000503 pixel. The shaft fronts originally projected into the
passing rods by four pixels. They now terminate at depth 0.25, with rods
starting at 0.26; all pin connections retain their ordinary bores.

The final all-hardware audit queries vertices, edge midpoints and triangle
centroids against opposing actual surfaces in both directions. Across 466
poses at 0.25-second spacing through the complete pattern, 46,332,516 queries
find zero unintended penetration. Maximum working gear overlap is 0.037603
source pixel, below the 0.1-pixel soft-contact allowance. Same-rigid-family
attachments are excluded; other pairs have only a 1e−6-world-unit numerical
tolerance. Every sampled vertex stays inside the declared camera bounds.
This finite sampling does not certify continuous clearance.

| Native run | Duration, seconds | Max penetration, pixels | Max pin closure error, pixels | Max rolling error, pixels |
| --- | ---: | ---: | ---: | ---: |
| Defaults, two full patterns | 232.25 | 0.010935 | 0.000422 | 0.139371 |
| 0.5-ms step, 0.025-pixel collision tolerance | 116.25 | 0.006912 | 0.000196 | 0.098545 |
| Tooth friction 0.1, bar load +5 | 116.25 | 0.009854 | 0.000432 | 0.144749 |
| Tooth friction 0.1, bar load −5 | 116.25 | 0.010394 | 0.000429 | 0.147664 |

All runs remain finite without time resets and complete their intended patterns.
Default bar displacement spans −0.660004 to +0.440018 world units; the floating
link spans −0.765280 to +0.534225 radians. Per-input-turn stroke varies from
0.270664 to 1.062301 world units. The opposed loads are signed model-unit
sensitivity trials; these checks establish position/contact behavior within
the stated reconstruction, not force convergence or a manufacturing design.

## Validation and evidence

All 15 targeted mechanism/runtime/engine tests pass. They cover closed solids,
compiled contact cells, the full pattern and passive output, isolated tooth
transmission, the unreduced-source toggle, deterministic seeking/restart and
allocation disposal. An initial test failed because the WASM binding cannot
expose `eq_active`'s boolean memory view. The isolated test now compiles its
closures inactive and passes without changing the production mechanism.

The production build and all 38 MuJoCo browser checks pass, including 122
loading beneath a static subdirectory, playback, pause, restart, responsive
controls, navigation and re-entry. The catalog capture averages 42.16 fps and 99.92% physical speed over 12 seconds
in headless Chrome. It reports no page errors, and records existing Three.js
deprecation and screenshot readback warnings. Build/browser logs are recorded
in the final evidence manifest.

Bulk evidence stays outside Git under `/dev/shm/122-`. Each study archives its
input bytes and verifies them before writing its report. The final freeze script
hashes reports, images, inspections, logs and the production build; historical
source differences remain explicit. The evidence sequence is:

- `baseline-a`: seven old-model views; `source-a`: measured points and overlay.
- `fit-a`, `center-fit-a`, `mesh-fit-a`: centered, free-axis and compatible
  involute comparisons; `reach-b/c/d`: independent continuation parameter trials.
- `candidate-b`: four inspected unreduced-crank views, including the stall.
- `dynamics-a`: unreduced stall; `b/c`: corrected cranks before shortening the
  shaft fronts; `d/e/f/g`: final default, finer and opposed loaded runs.
- `clearances-a`: rejected shaft/rod intersections; `clearances-b`: final full
  pattern. `comparison-a/b` preserve the corresponding shaft-depth versions.
- `integrated-a`: all 19 inspected catalog views and physical-speed measurement.
- `tests-a/b`, `build-a`, `browser-a`: failed binding test, corrected tests,
  production build and integrated browser checks.

The early `reach-a` JSON-default parse failure has its log and input archives.
The `candidate-a` helper-import failure occurred before input archiving and has
only its log. Neither produced a completed report. These artifacts are volatile across reboot, while
the reproduction scripts and reconstruction are committed.

```sh
PROBE_PREFIX=/dev/shm/122-new-source node scripts/measure-variable-traverse-source.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/122-new-dynamics DURATION=232.25 node scripts/probe-variable-traverse-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/122-new-clearances node scripts/audit-variable-traverse-clearances.mjs
TMPDIR=/dev/shm node --test tests/mujoco-variable-traverse.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs
TMPDIR=/dev/shm INTEGRATED=1 PROBE_PREFIX=/dev/shm/122-new-views node scripts/capture-variable-traverse-candidate.mjs
```

122 is qualified within the corrected-crank, ideal-pin/guide interpretation and
the finite tests above. The complete 507-movement review remains active.
