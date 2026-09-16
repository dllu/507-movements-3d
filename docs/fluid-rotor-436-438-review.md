# Fluid rotors 436–438: working passages and supports

Primary references: [Jonval turbine 436](https://507movements.com/mm_436.html), [volute wheel 437](https://507movements.com/mm_437.html), and [Barker reaction mill 438](https://507movements.com/mm_438.html), together with the local engravings. All three pages lack both `ae.add_model` and `mm_present`; no official animated construction is available. Brown explicitly identifies the stationary upper guide row and more numerous lower runner buckets in 436, the radial vanes and inclined lower escape buckets in 437, and rotation opposite the escaping jets in 438.

## Corrections

**436:** The solid lower runner disk, which blocked the depicted axial discharge, becomes a finite rim and four-spoke support with open passages. The stationary guide drum, both bearings, overhead beam and foundation have real shaft bores. The transparent casing is a closed annular wall rather than a zero-thickness cylinder. The inlet flume previously fell toward its external end; its slope now descends inward toward the turbine, as in the engraving. The existing radial guide arrangement and parabolic lower-bucket profiles are retained.

**437:** The supposedly perforated runner floor was a solid disk. It now has a finite outer rim, hub and eight supporting spokes with open escape areas. The central hub extends to the support floor. Lower bucket faces are pitched about their radial span, rather than remaining vertical walls with only a curve in plan. The volute's outer pipe becomes a finite working wall with an annular floor; the inner boundary is a low lip clear of the runner, allowing the volute water to reach the vanes. Previously its full-height inner wall crossed the rotating envelope and also isolated the depicted water from the wheel. A bored upper bearing, crossbeam and side supports replace the floating solid bearing.

**438:** The supply shaft now has a real axial bore and four side ports into the arm passages. Each curved arm has inner and outer surfaces plus annular end faces, leaving an open bore at both ends. The final bends approach tangentially, and nozzle collar planes are aligned with those outlet directions. The fixed hopper has finite wall thickness; its throat and upper bearing clear the rotating shaft. The bracket has shaft relief, the lower support has a shallow conical seat instead of engulfing the closed shaft tip, and the rotation marker clears the upper bearing.

The new `finite-fluid-passages.js` helper supplies closed curved pipe walls and merged passage sections. It reuses the existing horizontal turned/plate geometry helpers. Construction is done once; playback does not rebuild these geometries.

All three hide the ground plane, disable material fog and use their authored 5.7/5.5/6-second revolution periods for normal playback.

## Validation and limits

```sh
node --test tests/movement-436.test.mjs tests/movement-437.test.mjs tests/movement-438.test.mjs tests/fluid-rotor-436-438-solids.test.mjs
```

**39 tests pass** (29 existing plus ten new), in 2.09 seconds. Added checks sample actual moving surfaces against fixed solids over 65 poses, verify open runner escape spaces and finite rims, inspect 438's shaft ports and curved-arm bores/wall winding, check nozzle orientation, and verify the corrected flume slope and lower-bucket pitch. For each model, 300 repeated input-state, time-state and update calls must preserve descendant and geometry identities. These checks are bounded samples, not continuous collision or watertight manufacturing proofs.

The models retain analytical prescribed rotation. Flow tubes and dots illustrate direction and may cross working surfaces; they are not solved fluid trajectories. Pressure, free-surface shape, continuity of mass flow, leakage, viscous/nozzle losses, cavitation, efficiency, inertia, bearing loads and load-dependent speed are not validated. In particular, the drawn torque diagnostics assume imposed flows and velocities. Shaft-port shapes, pipe wall thickness, manufacturing junctions, clearances, support construction and axial dimensions are inferred. No rigid-body simulator is claimed to establish fluid correctness.

Final default/plan/rear comparisons and 65-pose projection sweeps found zero vertices outside the default viewport for all three models. Review artifacts stay outside Git under `/dev/shm/turbine-436-*`, `/dev/shm/turbine-437-*`, `/dev/shm/turbine-438-*` and `/dev/shm/436438-browser*.log`.

### Production timing follow-up

The nineteenth pass found that the production display wrapper replaced the factory's target period with two seconds. These movements now explicitly preserve their reviewed 5.4–6-second cycle through `minimumDisplayCycleSeconds`; the actual production wrapper is covered by `tests/reviewed-cycle-timing.test.mjs`. Earlier cycle-duration descriptions referred to the authored motion, not the effective viewer speed before this correction.
