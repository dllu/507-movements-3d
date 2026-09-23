# Movement 298: geared balance and helical-pallet escapement

Reviewer: Claude Opus 5.5 — primary agent, 2026-09-23, after user review.
Production code: [authored-geared-balance-verge.js](../src/simulation/authored-geared-balance-verge.js);
tests: [movement-298.test.mjs](../tests/movement-298.test.mjs). Analytic motion;
MuJoCo is not used.

## Why it was rebuilt

298 previously reused Movement 234's verge-on-crown escapement. Brown's plate
shows something else: the drum is a crown wheel geared like Movement 26
(rectangular teeth on its rim) meshing a pinion just under balance C, and that
drum's horizontal arbor carries two tilted loops over the top of a face-on
saw-tooth wheel whose arrow rises on the right.

## Reconstruction

- **Gearing:** a 12-leaf involute pinion on the vertical balance staff drives a
  30-tooth crown wheel with straight-sided 20° axial teeth, which act as the
  pinion's rack at the crown's top. The balance turns 2.5 times the arbor.
- **Escapement (inferred, chosen with the user):** at the top of the escape
  wheel the teeth move along the arbor, so flat verge pallets could not be
  driven. The loops are opposite-handed helical pallets: the leading tip
  corner of a top tooth pushes a helical face and turns the arbor. Each pallet
  releases by swinging out of the wheel's plane, the right one toward the
  viewer and the left one away. The pallets are half a pitch apart. Each
  contact has recoil and impulse, followed by an equal quintic drop to the
  other pallet (0.040 rad each), and the wheel advances one of its 20 teeth
  per balance period.
- **Shapes from the plate:** broad flat three-spoke balance, drum crown, tall
  pinion, saw wheel with four lens openings and an arbor stub toward the
  viewer, a long left-hand arbor pivot. No frame or ground, as drawn; the
  initial camera looks slightly down, as the plate's balance ellipse does.

## Evidence

- Relative-motion screen (`scripts/show-body-intersections.mjs 298
  --samples=257 --spacing=0.015`): no sampled penetration between the escape
  wheel, pallet arbor (pallets, crown) and balance staff (pinion, balance).
- Tests: the played wheel angle puts an actual tooth tip on the analytic
  helical face at every contact sample, both drops are positive and equal, and
  the wheel advances exactly one pitch per period without jumps. The three
  bodies are clear at 97 phases. Negative control: a pinion half a pitch out of
  phase jams the crown teeth (> 0.02).

## Remaining limits

- The helical pallet geometry, tooth counts, swing and drop schedule are
  inferred. The loops read as small tilted blades rather than the plate's
  rings.
- The escape wheel sits about 0.25 lower than drawn, to clear the arbor.
- The crown teeth carry 0.03 backlash and are narrow radially, because the
  crown rim is only locally a straight rack. The pallet faces stand 0.002
  behind the exact helix.
- Balance motion, impulse and drops are prescribed. Friction and energy are
  not solved.
