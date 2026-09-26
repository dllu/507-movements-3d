# Pass 62 — plate-escapement lane (292, 293, 294/295)

File: `src/simulation/authored-plate-escapements.js`. `plate-escapement-kit.js` is
unchanged. Tests are in `tests/plate-escapements.test.mjs`, with four new tests.

Captures (not in Git) are under `/dev/shm/p62-plate-esc/`:
- before: `before/`, plus the audit tiles `/dev/shm/audit62/b/tile-292.png` and `ph-293.png`;
- after: `after/`, and `review-after/ID-default.png` / `ID-oblique.png`;
- tiles: `t292ph.png` (4 phases), `t292rot.png` (+60° and back), `t293ph.png` (12 phases), `t295b.png` (before, after and plate).

Intersection screens were run one at a time (`--spacing=0.01 --samples=129`).
`check-loop-seams --ids=288-296`: all 0. `scan-bad-faces` for 292, 293 and 295: clean.

## 292 stud escapement

- **Studs.** Brown draws the studs as clear triangles on the rim's middle line
  (radius 230 px). The front studs point outward over the outer half of the
  face, and the back studs point inward over the inner half. They alternate,
  one front and one back.
  - Each stud is now a 9 × 10 px triangle, with its base on that line and a
    radial leading flank.
  - The front studs stand on the front face and the back studs on the back
    face, as the text says.
  - They are light steel, so they read as Brown's triangles and not as nicks
    in the rim.
  - The count is still 48 (24 of each).
- **Pallet c.** The front arm runs from F to B, then down a band between two
  arcs about F (Brown's lower edge of B–c follows the arc about F to within about 1°). The
  band ends in the wedge c.
  - The locking face is the arc about F (x = 0), so the escapement is still
    dead-beat.
  - An inclined impulse face runs from the locking corner to a sharp tip:
    24 px down the path and 16 px inward (tip angle 56°). These are Brown's
    measured proportions.
  - The band is one outline with the arm plate. Its working end is thickened
    back into the studs' layer.
  - R is the same wedge mirrored from the inside of the path, 32 px lower,
    on the back arm.
- **Motion.** The escapement still works by contact, with a ±2° swing.
  - Recoil is 0. The wheel follows (impulse) 0.79 of a stud-pair pitch and
    drops 0.21. Before, it was 0.52 follow and 0.49 drop.
  - The lock margins are about 4 px on each pallet.
  - Pallet widths of 26 px or more jam: c re-enters onto the trailing slope
    of the stud that just left it.
- **Intersections.**
  - Before: pallet–stud contact 0.0000 only.
  - After: `front-pallet-c × front-stud` 0.0000 and
    `back-pallet-R × back-stud` 0.0000 (contact) only.

## 293 duplex escapement

The problem: the wheel stood still for about 94 % of the cycle, then turned
27° in the last 5 %. That snap is what a harmonic ±120° balance gives, since
it passes the ~30° impulse arc very quickly.

- The balance amplitude is now 95°. That is the smallest amplitude for which
  the notch still unlocks cleanly.
- The balance follows a smooth periodic display law:
  `θ = A sin(u − 0.7·S(u − u₀))`.
  - S is a narrow bump (cos⁴ series). The balance slows to 0.3 of its mean
    speed through the impulse arc and runs at about 1.26 on the dead swing.
  - This is a presentation choice, not dynamics. It is a kinematic
    approximation.
- The roller notch was moved 6° (−40° to −34° on the staff). With it there,
  the tooth leaves the notch just as the crown pin reaches B, so no free
  7° jump is left between the two.
- The drop acceleration is 150 (was 600).
- **Cycle.** On the dead swing the tooth dips into the notch and is pushed
  back (1.4° recoil). On the impulse swing:
  1. the notch carries the tooth about 5°;
  2. the tooth escapes, and a pin drives B for about 22°;
  3. the next tooth lands on the roller.
- **Measured over the cycle:**

  | | Before | After |
  |---|---|---|
  | Share of the cycle the wheel moves | 22 % | 40 % |
  | Share of the cycle holding 80 % of the advance | 3.4 % | 12.4 % |
  | Peak wheel speed, relative to mean | 45× | 13× |

- t = 0 is still Brown's pose: B at its drawn angle and turning
  counterclockwise (his arrow), with the next tooth just landed. The advance
  runs from about 0.7 to 0.97 of the loop. The loop is seamless (score 0).
- A new test requires that 80 % of the advance takes more than 10 % of the
  cycle.
- **Intersections.** Before: roller–wheel 0.0001. After: roller–wheel 0.0001.

## 295 (and 294) cylinder

- Brown's plan was measured. The circle through his lower arc has radius
  464 px. The valley bottoms are at 496 and the stalk tips at 566.
  - The lower arc is therefore the rim's inner edge, about 30 px inside the
    valleys at his scale (27 px at the model's).
  - He draws nothing below it. The thin lines that run down from the outer
    stalks are the next valleys, cropped.
- The wheel's window edge moved from 290 to 325 px, so the rim is a narrow
  band below the valleys. The solid web he does not draw is now open between
  the four arms.
- 294 is the same model with the wheel removed from view, so it looks the
  same; the shared-model test passes. A new test checks that 295's window
  reaches past 320 px.
- **Intersections.**
  - 295: before and after, lip–wedge 0.0001 (contact).
  - 294: before and after, none.
- **Residual.** The arms show in the window below the rim, where Brown's crop
  shows blank paper. The wheel turns, so no arm phase keeps them out of view.

## Tests

- `tests/plate-escapements.test.mjs`: 14 pass (10 existing and 4 new):
  - 292 stud triangles;
  - 292 wedge tip under 65°;
  - 293 advance spread;
  - 295 open rim.
- `tests/movement-304.test.mjs` and `tests/source-presentation.test.mjs`: pass.
