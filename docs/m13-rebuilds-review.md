# Pass-51 lane m13-rebuilds: 137, 467, 472, 504

Each default capture was checked beside its plate, with several motion phases.
Intersection screens used `show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

## 137: expansion eccentric (baked, not changed)

I studied three ways to keep Brown's dimples: smaller rollers, tracing his outline with the
rollers riding the envelope, and letting the cam leave the rollers (a dwell). None works with
a fork that both rollers drive.

- **Measurement.** Ray-casting the plate from the shaft (1 deg steps, ink centreline, roller
  occlusions excluded) gives the cam's radius. The upper and lower rollers sit almost opposite
  each other (90 deg and 270 deg). Adding his radii at opposite angles gives the breadth the
  fork must span. It varies from about 145 px (the 150/330 deg pair, both dimpled) to about
  170 px (the 70/250 deg pair, the steep flanks either side of the rollers). A fork with both
  rollers on the cam spans one fixed breadth, so some part of the outline must be off by at
  least a quarter of that 25 px range.
- **Optimiser** (scratch, `/dev/shm/m13/opt137.py`, `mm137.py`). It solves the fork motion
  directly. It computes the envelope of each roller about the real pivot and fits
  min(envelope) to Brown's radii, subject to |upper - lower envelope| <= tau. Results:
  - Least squares, 31/32 px rollers, 4 px spread: 3.0 px RMS, 9.9 max. This is the same
    family as production (3.93 RMS / 8.90 max on the landmarks).
  - Minimax: at best 7.3 px max, but 4.3-4.6 px RMS. The whole outline gets worse to lift one
    dimple a few px.
  - Rollers of 20 px and 12 px, respaced so their rims stay put: 7.26 and 7.21 px max. Roller
    size does not matter. The limit is the breadth, not the roller curvature.
  - Allowing 3 or 6 px of play (dwell): the max stays 7.3 px. The worst points are the widest
    pair, which play cannot relieve. To follow the full trace, the fork would need about 25 px
    of free travel. That is two-thirds of its 39 px swing, so the fork would rattle between
    the rollers under gravity. The earlier user report objected to exactly that loose
    lower-roller contact.
- **Result.** The production conjugate cam stays. Brown's dimples are nearly opposite each
  other (about 150 and 330 deg). A cam that bears on both rollers cannot keep both.
  No files changed, so there was no rebake. The 138 bake and `authored-cams.js` are untouched.
- **Intersection note.** The `show-body-intersections` screen for 137 runs the legacy
  registry factory (circular cam and invisible envelope), not the baked browser model. Its
  numbers do not apply to production. Bake clearance is covered by
  `tests/expansion-eccentric-bake.test.mjs` (penetration < 0.1 px, passes).

## 504: Ferguson's paradox (not changed)

- The default fit is already centred on C, A's axis: x +/-4.07 about the pedestal, y
  -1.59..0.70, depth proxy +/-1. It uses `cameraFov` 12, set by `epicyclic-family-corrections.js`,
  with distance scale 1 and the engine's generic 1.08 margin.
- In a pure side view the arm sweeps x = +/-4.02, so a frame holding the whole turn must be
  about 8.1 units wide. At rest the train spans x -0.9..4.0, about 60% of the width and to
  the right.
- Recentering or tightening cannot help:
  - The largest perspective growth of the near-side sweep at this FOV is 0.4% (x 4.04).
  - Shrinking the depth proxy to +/-0.3 gains about 1.5%.
  - A downward view turns the sweep into an ellipse. That adds height, but the width stays
    the same, so the train does not grow in either a square or a landscape viewport.
- Brown draws one static pose and crops nothing, and the brief allows a crop only where
  Brown crops. The small train is therefore forced by the full turn. I tried
  `cameraFov`/`cameraDistanceScale` overrides in the factory; the capture did not change
  (the family correction already sets them), so I reverted them.

## 467: Robertson's jack (rebuilt)

- **Rewrite.** `authored-robertson-jacks.js` is rewritten with proportions measured from the
  plate (ram centre 275 px, ground 500 px, 0.42/32.5 units per px):
  - a small hollow base only a little wider than the cylinder (x -0.88..0.79);
  - a tall ghosted hollow ram with its central pipe;
  - the cupped cast head and J-claw;
  - Brown's long grip with its ferrule.
- **Pump inside the ram's foot.** The straight lever pins a plunger at the upper eye. The
  plunger runs on a fixed slanted line through the square gland and packing nut on the ram's
  left face (Brown's two blocks), into a short barrel in the ram foot. The fulcrum is the
  lower eye, carried by a short swing link from a lug at the base's upper-left corner.
  Closure is exact, with one degree of freedom.
- **Water path.** Suction comes from the base past an inlet check disk. Delivery goes through
  a side port and delivery check into the pipe inside the ram. The thumb screw, conical seat
  and return passage are kept at Brown's height.
- **Motion.** The volume law is unchanged: 12 strokes, area ratio 4.67:1, lift 0.176. The
  cycle is 14 s. t=0 starts in the hold (phase 0.67), so the opening pose is Brown's:
  cylinder raised, plunger in. At its lowest, the cylinder clears the gland by about 0.1.
- **Helper.** `hydraulic-force-parts.js` no longer serves 467: its 467 branch was deleted and
  `sidePortedShell` is exported. 466 is unchanged (movement-466 passes 11/11).
- **Intersections:** clear -> clear. Only the seated screw tip and inlet disk touch (0.0000).
  Two transient overlaps found during the rebuild were fixed: plunger/base top 0.016 and
  eye/seal band 0.004.
- **Framing (integrator).** The 467 motion bounds in `display-profiles` are stale and crop the
  default view (maxNdc 1.95). With a re-measured profile, maxNdc is 0.92.

## 472: Grimshaw's compressed air hammer (rebuilt)

- **Frame C** is now one casting in the plane of the parts. It replaces the plate that stood
  behind the parts on brackets. It is traced from the plate at Brown's height and width
  (0.00715 units per 2x-plate px, which makes B's bore 4.5 in). It has:
  - the flat bed and the base pocket holding the small pump D;
  - the slender S-neck;
  - the open head window for the friction wheel and the bored bosses for shaft E;
  - the hollow reservoir arm, with a recessed air channel;
  - the yoke round the small cylinder B;
  - the arched anvil pedestal.
- **Moving parts.**
  - Shaft E is overhung. Its crank is outboard of pulley E, which removes the old shaft/rod
    clash.
  - The horizontal disk sits on a stud on top of the head.
  - The valve rod is longer and forked, driving a forked slide valve in its chest.
  - The collars and both port passages were added.
- **Removed (undrawn):** pump check chest, delivery pipe, safety valve, treadle, lever P,
  exhaust H, cutoff slides, supply pipe, anvil stand, and indices. The pump checks remain as
  state only.
- **Motion.** The laws are unchanged. A constant `sourcePoseTimeOffset` (half a hammer cycle)
  makes t=0 show A raised, as drawn, and the loop stays continuous.
- **Intersections.** Worst solid 0.086 (check spheres in their chest), plus shaft/pump rod
  0.084 and valve rod/slide 0.080. All are now 0.0000 except seated friction contact and the
  impact face.
- **Helper.** `hammer-working-parts.js` changed only in its 472 branch. 470 and 471 tests pass.

## Tests

`movement-467`, `hydraulic-force-solids`, `movement-466`, `movement-472`,
`hammer-working-interfaces`, `movement-470`, `movement-471`, `source-presentation`,
`expansion-eccentric-profile`, `expansion-eccentric-bake`, `movement-504`: 79 pass, 0 fail.
No `docs/validation` generator fingerprints the changed files. The 503-504 report is
unaffected because `authored-epicyclic-trains.js` is unchanged.
