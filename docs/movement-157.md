# Movement 157 — pinned bell-crank reciprocator

157 now uses an analytic four-bar linkage, a pinned output rod and a vertical
crosshead. Source-proportioned solids replace the older animation-based assembly.
The disk makes one revolution in four seconds. Only five rigid-body transforms
change during playback; no browser physics or per-frame mesh generation is needed.

## Source and oracle

The [source page](https://507movements.com/mm_157.html) describes 156 with a
connecting rod substituted for its slot. Its executable 2D animation supplies a
useful motion reference. The comparison script runs the actual definition and
animation library in an isolated VM with a no-op canvas, then reads transformed
joint coordinates at 721 phases. Both the previous model and the new solver,
configured with the oracle's dimensions, agree within 5.7e-15 world units.
This verifies position trajectories, not forces or rendered surfaces.

After aligning disk center, radius **and crank phase**, the oracle's initial
landmark errors against the engraving are:

| Landmark | Difference |
| --- | ---: |
| Crank pin | 1.53px |
| Fixed bell pivot | 38.88px |
| Upper bell joint | 3.26px |
| Output joint | 73.68px |

The old trajectory was therefore not an incorrect implementation of the oracle;
the oracle and engraving have different dimensions.

## Necessary geometric correction

Approximate centers in the 525px engraving are disk (136,273), crank pin
(57,220), fixed bell pivot (343,265), upper bell joint (328,134) and output joint
(468,265). Disk radius is 117px. These readings imply crank radius 95.13px,
fixed-center distance 207.15px, coupler length 284.32px and bell input arm 131.86px.

For a full crank turn, the minimum crank-pin-to-bell-pivot distance must exceed
the difference between the coupler and input-arm lengths. Here those quantities
are 112.02px and 152.46px: the drawing misses reach by 40.44px. A solver using
these exact readings cannot assemble at 984 of 4,097 sampled phases (roughly
48–72% of a turn from the drawn pose). This discrepancy is much larger than the
roughly 2px reading uncertainty; a physics engine would not fix it.

The reconstruction keeps the disk and output point fixed and adjusts the three
other joint centers with a local constrained least-squares fit. Equal weights
and a 10px positive reach margin are explicit reconstruction choices, not a
claim about the inventor's intended dimensions. The margin avoids a toggle.

| Joint | Measured center | Reconstructed center | Shift |
| --- | --- | --- | ---: |
| Crank pin | (57,220) | (69.18,221.84) | 12.32px |
| Upper bell joint | (328,134) | (319.88,129.57) | 9.25px |
| Fixed bell pivot | (343,265) | (351.56,271.82) | 10.94px |

**Pass 90 refit.** That bare projection left the drawn pose next to the inner
toggle: the bell crank swung 95° (+21°/−75° about the drawn pose, the output
arm turning to point nearly straight down) and the output rod leaned up to 18°
from its guide line. A second stage now refines the same three centers by
weighted least squares from the measured centers (crank pin weighted 3×, as it
fixes the visible crank radius), keeping both reach margins at least 10px and
requiring the swing to be within 30° of symmetric about the drawn pose and the
rod within 12° of vertical. Result: swing +21.8°/−51.8° (74°), rod lean at most
7.8°, crank radius 84.4px (unchanged).

| Joint | Measured center | Reconstructed center (p90) | Shift |
| --- | --- | --- | ---: |
| Crank pin | (57,220) | (72.48,217.49) | 15.7px |
| Upper bell joint | (328,134) | (310.62,118.34) | 23.4px |
| Fixed bell pivot | (343,265) | (357.08,275.88) | 17.8px |

The input arm is 164px where Brown draws 132px, and the coupler 258px where he
draws 284px.

This is closer to the engraving overall than retaining the oracle's dimensions,
but is deliberately not an exact superposition. The production note discloses
these changes. The lower rod is cropped; its complete 250px length, guide at
x=468, rear supports, depth separation, bearings and retainers are reconstructed.
The resulting output curve differs from the oracle because its dimensions differ.

## Mechanics and checks

The solver intersects the crank-pin/coupler circle with the fixed-pivot/input-arm
circle, maintaining one open assembly branch throughout a revolution. The bell
output is rigidly attached; its rod intersects the vertical guide below it.
Invalid reach throws instead of clamping a square root or teleporting a joint.
The model assumes ideal rigid links and pin constraints, without force/friction
simulation. MuJoCo is unnecessary for this fully determined motion.

The visible assembly has 34 meshes with through-bores at each rotating joint.
A finite audit covers 408 part pairs at 129 full-cycle poses, checking both
surfaces using vertices, edge midpoints and triangle centers. It found no
unintended intersections in 6,462,460 point queries. Same-moving-body interfaces
are checked once; intentional fixed-frame unions are excluded. This is finite
sampling, not a continuous collision proof.

Three tests cover the source correction and impossible raw geometry, rigid-link
closure and branch continuity at 4,097 phases, and rendered joint alignment at
257 poses. They also check unchanged geometry during playback, full-sweep camera
bounds, disabled fog, hidden ground and exact reset. The production build and packaged desktop/mobile
playback test pass; the latter checks play/pause, restart, orbit/reset view, no horizontal overflow,
no page errors and no WASM requests. Source, oblique and mobile views were
inspected, with the complete rods and guide visible.

```sh
node scripts/fit-pinned-elbow-source.mjs
node scripts/compare-pinned-elbow-oracle.mjs
node --test tests/pinned-elbow.test.mjs
node scripts/review-pinned-elbow-assembly.mjs
```

`SOURCE_HTML` and `SOURCE_LIBRARY` can point to local source snapshots for the
oracle script. Reproducible reports and source hashes are in
`docs/validation/157-source-fit.json`, `157-oracle-comparison.json` and
`157-assembly.json`. Downloaded source code and temporary browser artifacts stay
outside the repository.
