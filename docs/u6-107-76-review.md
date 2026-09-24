# Lane u6-107-76: user feedback on 107 and 76

Date: 2026-09-24. Pass-51 user-feedback lane. Captures were taken on the production route with a
non-watching dev server, at several phases. Motion was sampled numerically.

## 107: the snaking groove fails its native checks

The previous lane (`docs/u2-cams-review.md`) rebuilt the groove as a saturated sine: 8 repeats per
turn, `c = 1.5`, broad round U ends. That look is kept. Two MuJoCo tests then failed by small margins:

| Check | Limit | Before (0.03 px clearance) | After (0.01 px) |
| --- | ---: | ---: | ---: |
| Follower error vs groove law, 10 turns | 0.15 px | 0.156 | 0.097 |
| Timestep halving difference | 0.2 px | 0.230 | 0.070 |
| Further halving | < previous | 0.164 | 0.067 |
| Mesh refinement (32→48) difference | 0.2 px | 0.215 | 0.098 |
| Guide retention | > 7 px | 8.03 | 8.05 |
| Native / visible penetration | 0.03 / 0.02 px | 0.008 / 0 | 0.007 / 0.003 |

The guides were never lost, and the law in the tests was already the new traced law. The cause is
geometric. On a groove with slope `dx/dθ`, the pin's radial clearance turns into axial follower
play multiplied by `sqrt(1 + (dx/dθ / r)²)`. At the steep runs this factor is 3.6 (peak slope 3.02 at
working radius 0.87). So 0.03 px of clearance on each side let the follower rattle about 0.2 px from
wall to wall, and that rattle was different at each timestep and mesh resolution. Probes showed that
contact time (0.002–0.008 s) and a slower period (4 s per stroke) did not help. Clearance fixed it.

**Fix:** the running clearance is now 0.0001 (0.01 px, the same as 106), set in
`mujoco-serpentine-cam/profile.js`. The pin radius changes by 0.02 px, which cannot be seen. All four
107 tests pass with at least 2× margin. The test title now reads "snaking strokes". 106 is untouched.

Intersections: the MuJoCo test's own audit reports only seated pin/land contact (visible 0.003 px).
`show-body-intersections.mjs 107` runs the legacy sync-engine factory, not this route, so its pairs
(0.47 base/groove, etc.) do not apply.

## 76: the stud flung the tappet round, and the rim segment stood still

### Why the tappet swung to vertical

The drawn tappet is straight, and its pivot C lies almost on a radius of the coaxial driver. A stud
on a concentric orbit can only pass once the struck end's reach from the axle has fallen below the
stud's inner edge. For a nearly radial bar, that only happens when the end has swung to the mirror of
its rest angle about the radius, or past it. At rest (q = 0.30) the drawn arm is 0.66 rad above the
radius. D, at its drawn mid-rim radius, overlapped the resting end by 0.27. The tappet therefore
turned from 0.30 to −1.88 rad (125°), past vertical, and flung the wheel 1.58 teeth.

Things tried and rejected (all runs used the existing finite-contact integrator):

- **Only moving D outward to a small overlap:** the release point moves only as far as the mirror
  angle, about −1.0 to −1.3. With under about 0.05 overlap, the stud hits the rounded end almost on
  its axis. That near-singular impact kicked the tappet at about 7 rad/s and did not converge with
  step size.
- **Lowering the rest angle below 0.30:** the jointed dog stays folded on the next tooth's back and
  never resets.
- **Bending the struck arm down 0.4 rad with a 0.03 overlap:** the stud releases at −0.46, before a
  full tooth. The count is lost (0 teeth).

**Fix (`jointed-tappet.js`):** the struck arm beyond C is bent down 0.3 rad (17°), so it rests close
to the radius. The tappet is now two capsules meeting at C. D keeps its drawn direction, but its orbit
is 0.05 inside that arm's resting reach (orbit 2.321, at the rim's outer edge; the drawn D is mid-rim).
Rebaked with `scripts/bake-jointed-tappet-motion.mjs` (report `artifacts/review/076-rebake-report.json`):

| | Before | After |
| --- | ---: | ---: |
| Tappet peak angle (rest 0.30) | −1.88 (125° swing) | −0.72 (58° swing) |
| Wheel peak advance | 1.58 teeth | 1.18 teeth, then settles at 1 |
| Tappet back on its stop / dog reset (display s) | 3.27 / 3.37 | 1.56 / 1.67 |
| Step convergence (0.0625→0.03125 ms) | — | max 9e-5 rad |
| Interpolated contact gap | — | ≥ −4.8e-8 |

The dog nose stays at the ratchet the whole time. B lifts the wheel just past one tooth, the holding
pawl drops in, and the tappet falls back.

The dynamics helper `scripts/lib/jointed-tappet-dynamics-study.mjs` now reads an optional
`strikeArmStart` (C for the bent arm). Without it the stud segment is B→end as before, so older
geometry behaves the same. Its recorded hashes in older 076/077 artifacts no longer match.

### The rim segment

The engraving view clipped the complete driver with section planes fixed in the world. The rim
therefore looked still while the spokes swept through the window. The planes (and their caps) are now
rotated with the driver every frame. Rim segment D, its stud and the arm carrying D move rigidly as
one part of the large wheel. It leaves the frame for part of each turn, as a partly drawn wheel should.
No other spoke shows through the window. The complete-wheel view is unchanged.

### Verification

- Captures at 0, 0.48, 0.6, 0.72, 0.84, 0.96, 1.2, 1.44, 1.8, 3, 6 and 10.8 s.
- Body intersections (129 samples): no solid pairs. The earlier `driverStud` section-cap entry is
  gone. The remaining entries are the display caps on the driver body and hub (0.050, 0.027), plus
  the coaxial dog stop pin at zero depth.
- `tests/jointed-tappet.test.mjs`: 8/8. The tests now bound the tappet swing (< 60°) and the wheel
  overtravel (< 1.25 teeth), and check that the section window turns with D.

Residuals: the bend in the struck arm at C, and D sitting at the rim's outer edge instead of mid-rim.
Both depart from the plate on purpose, so that the captioned "one tooth" works. The tappet still has
to turn about 58° in total: about 0.5 rad of this is dead travel from the rest stop before the nose
meets a tooth, and about 0.5 rad is the tooth itself.
