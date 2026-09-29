# Pass 101, lane p101-u2: 104, 153, 159 (user review)

Reviewer: Claude Opus 5.5, lane p101-u2. Date: 2026-09-28. No git writes.
Scratch and captures: `/dev/shm/p101/u2/` (`153/`, `159/`).
Claims: `mujoco-stud-reverser` (dir), `mujoco-cord-treadle` (dir), `mujoco-playback.js`, `stud-reverser.js`, `cord-treadle.js`.

## 104: switching input restores every part (bug fixed)

**Bug.** Each recorded configuration records only the parts it moves (worm input: worm and wheel; wheel input: wheel and carriage). `activate` applied only the new configuration's tracks, so after worm → wheel → play → worm the carriage stayed where the wheel loop had left it.

**Fix** (`src/simulation/baked/mujoco-playback.js`). At load, the built pose (position, quaternion, scale, visibility) of every part keyed by any configuration's transform or visibility track is captured. `activate` restores all of them before applying the new configuration's tracks. Single-configuration bundles are unaffected: their first frame overwrites the same parts as before.

**Tests.**
- New in `tests/mujoco-baked-loops.test.mjs`: for every multi-configuration bundle (104, 113, 121), switch to each other configuration, play 37% of its loop, switch back, and require every object's world matrix and visibility to equal the first frame. With the old file 104 fails; with the fix 104, 113 and 121 pass.
- Full `tests/mujoco-baked-loops.test.mjs`: 116/116 before the new tests, plus 3/3 new. `tests/baked-motion.test.mjs` 3/3.
- `npx playwright test tests/e2e/mujoco.spec.mjs -g "104|113|121"`: 4/4 pass (104 twice, after both builds).

**Proposed ledger row:** no visual change. Assessment is unchanged (reasonable). visibleFlaws is empty. Limits, append: "p101: switching input restores the parts only the other input moves (playback restores every recorded part's built pose)."

## 153: flat L lever

**User direction.** No depth step on the L; shorten its shorter leg so the stud can still reach the bar.

**Analysis.** The findings below come from a MuJoCo sweep plus a 2D kinematic check. The disk runs at 0.00025 and 0.000125 dt with bar friction 2, over five periods.
- **Flat arm at Brown's length and direction.** The stud sweeps the lever 66°. The return arm throws the bar to −1.37, and the next stud can no longer reach the lug.
  - Reach test: starting the bar at −0.2, −0.3 or −0.4 works.
  - In the sweeps, bar minima of −0.90 or below always stall. The stud meets the lug's underside.
- **Shortening the input leg at Brown's direction fails.** Brown's arm end only just reaches the stud orbit: the arm line enters it 1.62 from the pivot.
  - Any shorter arm is struck end-on and jams (1.3 → stall; 1.2 → 179× lever jump in the kinematic check).
  - For arms still struck on the side, the release angle stays at 22–37° past the pivot–centre line. That throws the bar at least 0.8 left.
- **Shortening the return leg fails.** To catch the bar stud at the end of the forward stroke (bar 1.025), the reach must be at least 2.21. Releasing early enough needs about 2.07 or less. Sweeps from 2.06 to 2.30 either never catch the stud or stall at bar ≤ −0.915.
- **What works.** Shorten the input leg and turn it up towards the disk centre (a smaller included angle). Working cells:
  - L 1.2 with offsets of 10°, 12.5° and 15°
  - L 1.25 with offsets of 12.5°, 15° and 17.5°
  - L 1.3 with offsets of 10–17.5°

  1.15/12.5° stalls. The centre of the robust region was chosen.

**Fix** (`src/simulation/mujoco-stud-reverser/geometry.js`, `physics.js`; `FLAT_INPUT_ARM = {flatInputLength: 1.25, inputAngleOffset: 15°}`):
- **Arm shape.** The input arm is one flat extrusion in the stud plane: z 0.64–1.0, half-width 0.126, bored for the pivot. Its end is a semicircle concentric with the end centre.
  - The lever has no depth step.
  - The arm is 1.25 long (Brown 1.667) and turned 15° up from Brown's direction. The L's included angle goes from 93.6° to 78.6°.
- **Rest stop.** The hidden rest stop follows the arm.
- **Legacy option kept.** The relieved arm is still available (`flatInputLength: 0`) for historical reports.
- **Presentation.** Reconstruction note updated (`baked/stud-reverser.js`). The e2e note string was updated to match.

**Rebaked** (documented chain, `FLAT=1` on the probe):
- **Probes.** `153-supported-prototype` (dt 0.00025) gives bar −0.6175 to 1.0245 and lever −0.5095 to 0.2526 rad (43.7° swing). The `-fine` probe (dt 0.000125) gives bar −0.6192 to 1.0245.
  - Cycle ends repeat to 2e-10.
  - Each cycle ends at the drawn bar pose (−0.00047).
- **Refinement.** `153-supported-refinement` differences are 0.00048 rad (disk), 0.0018 (bar) and 0.0016 rad (lever).
- **Assembly checks.**
  - Assembly: 41 parts, 3.20 M checks, 0 failing pairs. Working soft contacts are at most 1.5e-5.
  - Moving volumes: 0 failing pairs.
  - Baked assembly: 3.22 M checks, 0 failing pairs. Working contacts are at most 9.6e-5.
- **Bake.** 6,001 samples, 14 merged meshes, closure 6e-10.
- **Not regenerated.** The historical reports (`153-relieved-*`, `153-relief-contact`, `153-legacy-contact`, `153-passive-prototype`, `153-short-output-probe`) describe earlier commits.

**Screens.**
- Disconnected parts: 0 detached, with 1 near-miss (unchanged).
- Coincident faces: 0.
- Loop seams: 0.

**Captures** (`/dev/shm/p101/u2/153/`):
- `cmp-default.png`: before, after and the plate.
- `sheet-phases.png`: phases 0 to 0.75.
- `sheet-views.png`: yaw ±40, pitch ±25, side, oblique, arm close-up and the plate.

The lever is flat in every view. The default view differs from the plate in two ways:
- The lower leg is shorter and nearer horizontal.
- The framing is slightly wider, because the bar now travels 0.62 further left.

**Tests.**
- `tests/stud-reverser-physics.test.mjs`: the flat L sustains reciprocation with bar minimum in (−0.7, −0.55), bar maximum in (1, 1.05) and cycle end at the drawn pose. A new test checks the flat L: one two-level extrusion, studs reaching its plane, length 1.25, a concentric rounded end, and the 15° turn.
- `tests/stud-reverser-baked.test.mjs`: 7/7 together with the physics tests.
- `models.test` 153: 1/1.
- e2e `stud-reverser.spec`: 1/1.

**Proposed ledger row.**
- Assessment: minor. The mechanism is flat and works, but the lower leg departs from the plate.
- visibleFlaws: "The input (lower) arm is shorter than Brown's (1.25 vs 1.667) and turned 15° up towards the disk. The return throws the bar 0.62 farther left than drawn (forced for a flat L: at Brown's arm direction the stud either jams end-on or throws the bar out of the next stud's reach)."
- Limits, replace the p99 clause with: "p101: flat L (no depth step) per user review; input arm shortened to 1.25 and turned 15°; rebaked (bar −0.619 to 1.025, elbow swing 43.7°, each cycle ends at the drawn pose)."
- Intersections: sampled-clear. Baked assembly: 0 failing pairs, working contacts ≤ 9.6e-5.

## 159: cord with inertia

**Flaw, verified.** The baked sag amplitude went 0 → 0.60 → 1.46 → 2.01 between t = 0.08, 0.10, 0.12 and 0.20 s. It collapsed 1.31 → 0.36 → 0 over 1.7–1.9 s. The quasi-static profile's depth grows with √slack.

**Fix.** New `src/simulation/mujoco-cord-treadle/cord-dynamics.js`, with `scripts/bake-cord-treadle.mjs` and `src/simulation/baked/cord-treadle.js` updated.
- **The diagonal run is a limp rope:**
  - 64 point-mass links that resist stretching but not compression, with a minimum length of 0.3 link;
  - an anti-kink limit of 1.2 rad;
  - gravity of 98.1 units/s², the rigid bodies' scale;
  - air damping of 3/s;
  - frictionless contact with the pulley's upper-left quarter and the floor.
- **The rest of the cord follows the recorded pulley.** From the pulley's top onward, the cord lies in the groove and hangs straight to the eye, turning with the recorded pulley without slip. Material at the top is at s = incoming₀ + r(pulley + entry₀ − π/2), so cord crossing the top keeps continuous motion.
- **Why this design.**
  - A free chain over a frictionless or no-slip pulley buckled the vertical run into zigzags when the treadle landed.
  - Links that also resisted compression gave S-wiggles at onset.
  - The limp-rope form gives clean catenary-like hanging loops.
- **Bake.** Eight warm-up periods, then one 4 s period at 200 frames. The closure residual (0.0018) is removed linearly. Frames are encoded as d2 at 1e-5, and the round trip is checked.
- **Coupling.** One way: the treadle still moves under MuJoCo's ideal massless cord, since the cord's weight is small beside the treadle's.
- **Presentation.** The playback note is updated, and the e2e note string matches.

**Results.**
- Peak centreline acceleration at slack onset (0.05–0.6 s, 0.02 s frames) falls from 398 to 115 units/s².
- The slack falls into a smooth hanging loop over about 0.3–0.5 s and straightens progressively.
- The final take-up (about 1.82 s) is still a snap, at a peak of 901 units/s² against the ideal's 364. The native treadle is lifted impulsively and the rope whips straight, leaving a small travelling bow for about 0.2 s.
- Chain length stays within 0.989–1.000 of the cord length.
- The chain stays outside the pulley and above the floor. Away from the pin, it keeps at least 0.387 from the crank pin. The disk (z ≤ −0.13) is far behind the cord plane (0.64).

**Captures** (`/dev/shm/p101/u2/159/`):
- `sheet.png`: 12 phases plus yaw ±40, pitch 25 and side views.
- `strip-cmp.png` and `takeup-cmp.png`: ideal against chain at onset and take-up, in 2D.
- `strip-*.png`: the rejected variants.

**Tests.**
- New `tests/cord-treadle-dynamics.test.mjs` (3/3): ends on the pin and eye, the groove, the floor, length 0.97–1.01, onset acceleration below half the ideal's, a seamless loop, and playback rendering the chain.
- All `cord-treadle*` tests, `finite-cord-treadle` and `sliver-joints-p86-7`: 29/29.
- `models.test` 159: 1/1.
- e2e `cord-treadle.spec`: 1/1.

**Screens.**
- Disconnected parts: 0 detached.
- Coincident faces: 0.
- Loop seams: 0 (kink 0.04).

**Reports.** None of the 159 reports fingerprint the changed files. `ideal-cord-shape.js`, `physics.js`, `solids.js`, `inertia.js` and `rope-physics.js` are unchanged. The bundle provenance was regenerated with the new sources (3,345 motion samples, unchanged).

**Proposed ledger row.**
- Assessment: minor. The forced slack is unchanged.
- visibleFlaws: "The slack cord hangs in a loop under the crank pin for about a third of the turn (slack is forced: a taut cord puts the foot 133 px below the floor); the final take-up is a quick snap as the treadle is lifted."
- Limits, append: "p101: the visible cord has mass and inertia: a baked limp-rope chain (gravity, damping, groove without slip) forms and clears the sag smoothly; one-way coupled (the treadle still moves under MuJoCo's ideal massless cord)."
- mujoco: baked. The visible cord's dynamics are a PBD chain baked offline, not MuJoCo.

## Deferred

None.
