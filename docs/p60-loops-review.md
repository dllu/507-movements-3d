# Pass 60: seamless loops (lane p60-loops)

Goal: every animation loops smoothly without a jump at the loop point and without
pressing Restart. This lane covers all authored, baked and scripted movements;
the 38 live MuJoCo movements (model-loader `physicsFactories`, IDs 82-126) belong
to the p60-bake-tool lane and are skipped. Movements 63 and 251 have their own
lanes and were not edited (findings below).

## Checker

`node scripts/check-loop-seams.mjs [--ids=1,5-9] [--json=out.json] [--all]`
(measurement in `scripts/lib/loop-seams.mjs`).

The viewer never wraps its clock: `MovementEngine` passes an ever-growing elapsed
time to `model.update`. A seam therefore comes from the model: an internal
`time % period` or a baked recording's loop wrap whose end does not meet its
start, a finite `playbackDuration` that stops the run and asks for Replay, or a
motion law that clamps time and holds. The checker loads each production model
exactly as the browser does (`loadMovementModel`: baked bundles, special
factories, authored routes with display timing and source presentation), reads
the display loop period (`animationTiming.authoredCyclePeriod`) and:

1. samples the world positions of up to 24 drawn vertices of every visible
   mesh, line and instanced mesh (so rigid transforms, deforming ropes/belts and
   visibility are all seen). Geometry that is rebuilt as it moves (water cells,
   ropes; detected in a pre-pass) is compared by its world bounds, and only its
   drawn range counts;
2. sweeps t from 0 over three periods in 240 steps per period, calling
   `update(t, dt)` sequentially like the engine (stateful integrators work);
3. bisects every abrupt step (stateless models) to a vanishing interval, so
   real discontinuities are separated from fast but continuous motion. For the
   largest movers the vertex clouds before and after are compared (Hausdorff),
   so a symmetric part re-aimed about its own axis is not a jump;
4. compares the pose at 0+eps with the pose at P-eps (periodicity, reported),
   measures the position jump and the change of point velocity across each
   k*P (velocity change divided by the peak point speed; one-sided differences
   over a step short enough that the fastest point moves 0.1% of the model);
5. flags finite runs (`playbackDuration`) and runs that stop moving (last
   period still, or no motion 50 periods later).

Distances are fractions of the model size (diagonal of the sampled points at
t = 0). A part that appears or vanishes counts as a jump of its volume-weighted
size times its opacity, so a hairline stream or an empty water sheet switching
on is small. Classification:

- seam (fails): a jump at a whole number of periods, any rigid/vertex teleport
  mid-cycle, a velocity change above 0.35 of peak speed at the loop point that
  the movement does not also make mid-cycle, a finite run, a stall;
- mechanical (reported): a velocity change at the loop point matched (at
  least 70%) by the movement's own mid-cycle events (pin strikes, rack
  reversals, intermittent gearing); the sharpest mid-cycle bends are
  re-measured with windows straddling points a sixteenth of a step apart, so
  the result does not depend on the sweep resolution;
- pop (reported): a part appearing, vanishing or being rebuilt mid-cycle (water
  streams switching on).

Tolerances: position 0.3% of model size (about 2-3 px at default framing),
velocity 0.35 of peak point speed.

Visual review used `scripts/.y3-strip.mjs`-style motion strips (scratch, not
kept): a row of renders at times straddling each seam, each rendered by
stepping the production model from 0 so stateful models are exact.

## Ranked seam list before (original code)

Score = measurement / tolerance.

| ID | Movement | Seam | Score |
|---|---|---|---|
| 8 | Stepped speed pulleys | belt teleported between step pairs at each stage (3-step jump 3->0 at the loop) | 96 |
| 80 | Crossed-hook rack | finite 10 s run, holds its final pose for Replay | finite |
| 84 | Governor-selected double rack | finite 17.2 s run, holds for Replay | finite |
| 411 | Self-recording level | pencil trace wiped at the loop (10.7%) | 36 |
| 173 | Tappet-indexed silk traverse (baked) | carrier and nut jump back at the loop (8.8%), kink 0.69, Restart | 29 |
| 440 | Tipping trough meter | spill stream pops in at 36% width at the loop (15.6%) | 52 |
| 464 | Heron's fountain | plume appears at full height at the loop (5.6%) | 19 |
| 473 | Water-sealed air pump | shaft-gas column/jet pop at the loop (3.1%) | 10 |
| 461 | Swinging gutter pump | discharge jet pops at 35% length at the loop (2.9%) | 10 |
| 389 | Eccentric lifting jack | crank starts at full speed after the lowered dwell (kink 1.00); also parks abruptly | 2.9 |
| 493 | Lewis | hoist starts at full speed after the lowered dwell (kink 1.00) | 2.9 |
| 73 | Spring stop motion | strong spring C drops off a tooth crest mid-cycle (3.1%) | 10 |
| 49 | Ratchet bevel | pawl drops off a tooth crest (1.2%), one at the loop | 3.9 |
| 63 | (other lane) | spring-carried drop reverses at the loop (kink 0.65) | 1.9 |
| 217 | Heart-cam comber | lever reverses at the cam point, at the loop (kink 0.63) | 1.8 |
| 191 | Progressive scroll gears | scroll speed resets at the radial step, at the loop (kink 0.60) | 1.7 |

16 of 469 above tolerance (first run on the original code; 389, 493, 440 and 473
are from the checker's first version and the final-metric spot runs before
their fixes; the rest are from a full final-checker run).

## Fixes

- **8** (`authored-belts.js` steppedSpeedDrive): one belt instead of four
  toggled belts. Each stage runs the drive up, holds and runs it down (4.2 s),
  then the belt is shifted by hand at rest (0.8 s): the rising end lifts onto its
  larger step, the belt slides across, the falling end drops onto its smaller
  step. Steps are visited ping-pong (2,3,2,1,0,1), so every shift is one step
  and the 30 s cycle closes. Strips: shift 4.0-4.95 s default and oblique, loop
  29.6-30.4 s.
- **80** (`crossed-rack-motion.js`, new `src/data/crossed-rack-return.js`
  from new `scripts/generate-crossed-rack-return.mjs`): after the recorded
  18 s physical lift the lever keeps swinging three quarters of a cycle back to
  its starting pose and speed; the rack is eased off the loaded hook, both hooks
  swing clear, the rack is let down 0.05 below its start, the hooks swing back
  beneath their teeth and the rack settles onto them. The hook swing is the
  planned swing or, where the swinging lever would press a hook into the rack,
  the smallest larger outward angle that clears the rendered rack solid
  (480 samples, zero sampled penetration). `playbackDuration` removed; 12 s
  display cycle. The return is a reconstruction; the lift is still the recorded
  dynamics. Strip 8.8-12.3 s.
- **84** (`selector-rack-motion.js`, `selector-rack.js`): the recording closes
  on itself: from 3.05 s to 15.05 s (four cam turns) the cam carries the rack
  through the same stroke into the same pose (1e-9 px). Playback runs the
  recording once, then repeats that span; `playbackDuration` removed. The
  neutral selection is now shown only in the opening turn. Strip 14.8-15.3 s vs
  3.05/3.3 s.
- **173** (`mujoco-silk-tappet/assembly.js`): the loop is seventeen recorded
  carrier turns from a rest pose with the carrier opposite the tappet, eased up
  from rest and down to it (1.5 s cosine ramps), then the screw is wound back
  through the seventeen indexed teeth (4.5 s) with the carrier at rest, so the
  nut returns; the source pose is taken on the second carrier turn. Restart
  flag removed. `docs/validation/173-assembly-clearance.json` rerun: no
  intersections; `173-source-fit.json` rerun: unchanged fit. Strips 66-71.5 s.
- **389** (`authored-eccentric-jacks.js`): the crank starts and stops with
  cosine speed ramps at both ends of the lifting run and of the reversed
  lowering run (0.55 s, exactly the old park wait), so there is no instant start
  after the lowered dwell and no instant stop at the parked pose. Crank-time
  state stays available as `crankStateAtTime`. Strip 13.8-15.0 s, 6.0/6.5 s.
- **493** (`authored-stone-lewises.js`): the source's poses are kept along a
  motion phase; hoisting and lowering runs are eased at both ends (6% of the
  cycle). Dwell landmarks keep their times. Strip 3.7-4.3 s.
- **411** (`authored-self-recording-levels.js`): the drum turns once per cycle
  over periodic ground, so after the first cycle the whole closed profile stays
  on the paper and the pencil retraces it instead of the trace being wiped.
- **440** (`authored-tipping-water-meters.js`): spill streams thin to a thread
  as flow starts and stops.
- **464** (`fountain-balance-working-parts.js`): the plume grows from the
  spire tip as flow starts and sinks as it stops. The level reset (water
  returning to the upper basin) is continuous but still nonphysical (residual).
- **473** (`authored-water-sealed-air-pumps.js`): the gas shown at each check
  valve swells and thins with the valve's existing eased lift.
- **461** (`authored-swinging-gutter-pumps.js`): the discharge jet grows from
  the outlet instead of appearing at 35% length.

## Ranked list after

4 of 469 above tolerance, all documented exceptions in `tests/loop-seams.test.mjs`:

| ID | Remaining | Why allowed |
|---|---|---|
| 73 | 3.1% mid-cycle | ratchet click: spring C drops behind the tooth once per index |
| 49 | 1.2% | ratchet click: spring pawl drops off each crest; one drop is at the loop |
| 217 | kink 0.63 | heart-cam point reversal, cam continuous |
| 191 | kink 0.60 | scroll-gear radial step, drive continuous |

63 (other lane, not edited): its 0.65 velocity change at the loop point (the
spring-carried drop) is matched by the same drop mid-cycle, so the final
checker classes it as mechanical; it stays in the allowlist in case that lane
changes it.

Reported, not failed:

- Mechanical velocity changes at the loop point also made mid-cycle: 3, 4, 38,
  63, 173 (tappet strike), 199, 203, 211, 296, 369, 390, 392, 428.
- Mid-cycle pops (streams, chain links, contact markers switching on/off):
  463 13.4% (weir nappe; easing it made the static sheet cut the tipping leaf,
  so it was reverted), 229 5.5%, 470 5.4%, 448 4.8%, 227 4.3%, 441 4.0%,
  228 3.6%, 439 3.0%, 214 2.4%, 465 2.3%, 469/467/460 2.1%, 475 1.1%,
  466 1.0%, 444/445/446/476 < 1%.
- Laws with instant starts/stops throughout (not loop specific): 203's input
  arm, 199's partial-pinion reversal, 211's pin strike.
- `supportsRestart` is still set on 54 looping models (123, 128, 130-182 less
  173); all of them loop without a seam, so the Restart button is optional.
- 250-320 (other lanes, not edited): no seam above tolerance. 296 (lever
  escapement) has a 0.36 velocity change at the loop point that its escape
  wheel also makes mid-cycle (mechanical); 251 and 264 are clean.

## Tests

- New `tests/loop-seams.test.mjs`: runs the checker over every non-MuJoCo
  movement (160 steps per period, two periods) and fails on seams above
  tolerance, with the allowlist above.
- Updated for the new laws: `tests/movement-389.test.mjs`,
  `tests/jack-389-contact.test.mjs`, `tests/movement-493.test.mjs`,
  `tests/selector-rack.test.mjs`, `tests/crossed-rack.test.mjs`,
  `tests/movement-473.test.mjs`, `tests/models.test.mjs` (movement 8 block),
  `tests/pulley-belt-geometry.test.mjs`.
