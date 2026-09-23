# Gears 24–46: source-match pass

Pass 50. The builders were changed in a parallel lane. The primary agent integrated
them, re-measured display profiles, and inspected every production-route capture
beside its engraving.

## Changes

- 24: the teeth are counted from the plate, 30:36 (ratio −5/6), instead of 40:50.
  Plain bosses carry shafts fast to their wheels; the loose axles and white bars
  are removed.
- 25: the back ring and white tooth are removed. The shafts are 0.11 thick and
  end in the toe hubs, and the collars turn with their shafts.
- 26: the face rings and white marks are removed, and the camera takes the
  plate's side view.
- 27: the rollers are bored to clear their pins, with hubs kept within the
  face width. Ten white marks are removed. The driver's starting angle and the
  camera are fitted to the plate.
- 28: the disk boss is a concave trumpet, and the shafts are sized to the plate.
  The white marks stay, to show slip.
- 29, 30, 31, 33, 34: two white index marks each are removed, by the
  per-ID dispatcher.
- 39: the flywheel is a recessed web with four slits under a raised rim,
  instead of thin spokes. The parts are stacked so the rod no longer passes
  through the arm.
- 43: the upper shaft runs past the rim, and the camera shows the lower wheel
  edge-on with the upper wheel's teeth facing the viewer.

## Relative-motion screen (lane run)

| Movement | Before → after |
| --- | --- |
| 24 | coaxial 0.198 → none |
| 25 | coaxial 0.074 → none |
| 27 | coaxial 0.135 → only the intended roller-in-slot touch |
| 39 | solid 0.103 → none |
| 26, 28, 29, 34, 43 | none → none |

30, 31 and 33 were not rescreened; their only change removes parts. The
screen for 41 did not finish in ten minutes.

## Residuals

- 24: involute teeth where Brown draws square ones.
- 28: at rest the roller sits at radius 0.55, where Brown shows about 0.97. An
  existing test pins the order of the radius schedule.
- 39: the rod lies in front of the arm, where Brown draws the arm over it.
  The slits are a little wider than drawn.
- 43: Brown's shafts cross past the apex; the model stops them short of it.

Tests: `tests/gears-24-46-source-match.test.mjs` (with counter-examples of
the old designs), `tests/sun-planet-contact.test.mjs`, the 16 gear-family
contact tests, and the model blocks for 24–46.
