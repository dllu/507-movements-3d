# Intermittent 63, 71, 73, 206 and 211: source-match pass

Pass 50. The factories were rebuilt in a parallel lane. The primary agent
integrated them, re-measured display profiles, and inspected every
production-route capture beside its engraving.

## Changes and relative-motion screen (lane run)

| Movement | Change | Worst overlap before → after |
| --- | --- | --- |
| 63 | Frame, face rings and markers removed; face-on camera. The pin disk moves out to a 2.15 centre distance, because Brown's proportions would put the pins through the star points. The pawl now lifts clear of the star points and drops into the next space; its old law drove it through the neighbouring tooth. The pawl is stepped in depth, and its nose is cut offline from the swept star, pins, striker and hub (`scripts/bake-intermittent-63-211-snap-counter.mjs`, fingerprint-checked). | solid 0.170 → 0.060; coaxial 0.133 → 0.045. Both remaining values are the spring leaf welded to the drop. |
| 71 | Rebuilt on the plate's proportions. B has a three-stud lock and a flank-then-tip tappet contact, and its notches are swept offline. The frame is removed, and a section view is available. | solid 0.0885, coaxial 0.0889 → none |
| 73 | Frame and indicators removed; D is bored. B's spring runs as an arc and then a dive, and the hatched block clamps the spring. | coaxial 0.0977 → two intended spring-to-pad welds (0.0595, 0.0329) |
| 206 | Contact rebuilt at the finger radius; stand and markers removed. | coaxial 0.1089, solid 0.045 → the zero-depth working contact only |
| 211 | Frame and markers removed; guide depth adjusted. | coaxial 0.0841, solid 0.016 → none |

The shared `models.test.mjs` block for 71 pinned the old two-notch law and is
replaced by `tests/movement-071.test.mjs`. New tests `movement-063`, `-071` and
`-073` include negative controls; one 63 test regenerates the bake.

## Residuals

- 63: the nose stops about 0.09 short of the ideal gap point. The centre distance
  is widened (the star is 0.56 of it, against Brown's 0.64). Brown's left stop
  pin is not modelled.
- 71: B's solid plate hides the interior studs Brown draws dashed. The notches
  are wider and placed differently from the plate's. The lower lock stud has
  0.06 of play, where the caption says both studs rest on the rim.
- 73: 8 teeth, which a shared test pins, against Brown's ≈11. The hatched
  block sits lower than in the plate.
- 206: a ground shadow is shown.
- 211: the plate's toothed arc differs from the site-construction arc.
