# Lane 2: intermittent and tappet movements against Brown's plates

Movements 63, 65, 70, 71, 73, 76, 155, 206, 211 and 214. Each production route
was captured with `scripts/review-movement-source-views.mjs` beside its
engraving, before and after the changes. Intersections were screened with
`scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

## Changes

| Movement | Change | Worst overlap before → after |
| --- | --- | --- |
| 63 | The drop outline is now traced from the plate about its pivot. It has a left tail, the screwed boss, a slim arm arched over the star, and the hooked lobe that the pins lift. The hook's outer curve is eased in by about 0.06 so the falling drop clears the pin that has just escaped it. The arm top is raised about 0.15 over the pawl's boss so the relieved back stays one piece. Brown's left stop pin is added. It is placed so the tail's underside comes to rest 0.004 above it at the top of the scheduled lift. The spring now runs in from the plate's left edge to the tail tip; its undrawn clamp is hidden. The swept pawl and drop cuts are rebaked. | spring welds 0.060/0.024 → spring leaf on drop 0.0025, plus the two leaves' own middle joint (0.013) |
| 65 | D's studs no longer cast shadows, so they read as round end-on studs instead of long streaks. | geometry unchanged; the zero-depth stop-toe contact only |
| 70 | Disk C's cover is translucent (opacity 0.38), so the rim and tappet B read through it as Brown's dotted outline. The cover and studs cast no shadow sweep. | geometry unchanged; the zero-depth rim/stud contact only |
| 71 | B's front plate is translucent, so the interior studs, tappet and guard rim show through where Brown dashes them. C's studs cast no shadow streaks. | none → none |
| 73 | A has Brown's eleven teeth (was 8). B now bears at 0.88 of the tooth face, which keeps its leaf 0.051 clear of C's stop pad. The stop-velocity check uses a 1e-7 central difference, because the old 1e-5 step straddled profile vertices. The hatched block now matches the plate: its top is 0.77 R below the centre, its right face is just clear of D's rim, and C rises from its top-right corner. | the two intended spring-to-pad welds (0.0595, 0.0329), unchanged |
| 76 | The engraving section, which shows only rim segment D of the large wheel, is now the initial view. The complete wheel remains selectable. | geometry unchanged. The screen now reports the visible section caps coincident with the clipped driver (0.050, 0.044, 0.027). They are display caps on the cut faces, not solid overlap. The dog stop pin and sector contact at zero depth. |
| 155 | `scripts/bake-elbow-pawl.mjs` drops the undrawn fixed family (base, bearing post, crosshead guide rails, back and standoffs) from the shipped bundle and its bounds. The fixed parts had no physics role, and the native motion is identical. Assembly report hashes were refreshed (`tests/helpers/solid-surface.mjs` had changed), and the bake and provenance were regenerated. | production motion and soft contact unchanged (native audit); see below |
| 206 | Ground and shadow hidden. | unknown → the zero-depth working contact only |
| 211 | Ground and shadow hidden. | unknown → none |
| 214 | The teeth are regenerated as stubbed involutes: 0.8 module addendum, 0.9 dedendum, a 0.02 rack corner and a 28-degree pressure angle. The flat roots and short square tops are closer to Brown's square teeth than the former 30-degree full-depth lobes. The white rate-index bars are hidden. | none → the zero-depth terminal stop contact only |

## Evidence

- 214: minimum gear gap 0.00097; maximum both-flank gap 0.000996;
  virtual-work residual 0.00336 (bound 0.004). Contact ratio is about 1.03.
  The pressure angles 25 and 22 degrees failed the residual or clearance bounds.
- 73: the B-leaf-to-C-stop gap is 0.051 (bound 0.05). The pinned tooth count,
  pitch and profile size in `tests/models.test.mjs` are updated to 11.
- 63: the bake is one connected piece for the pawl, nose and relieved drop
  back. The pin-to-drop gap is at least 0.06 through the snap. The pins still
  do not bear on the drop while lifting it (gap ≥ 0.18); the lift remains
  scheduled.
- 155: `show-body-intersections.mjs 155` screens the synchronous registry model
  (`reciprocatingElbowPawlRatchetFeed`), not the baked production bundle. That
  legacy model still shows 0.158 elbow/slider-pin and 0.123 pawl/stud overlaps.
  Production evidence remains the native assembly audit
  (`docs/validation/155-supported-assembly.json`).

## Residuals

- 63: the pins still do not bear on the drop. The pawl nose still stops about
  0.09 short of the ideal gap point. The centre distance is still widened. The
  arm top near the pawl boss is about 0.15 above the plate's line.
- 71: the notches are still wider than the plate's and sit about 15–20° off.
  The lower lock stud still has 0.06 play.
- 73: A's shark-fin teeth are deeper (root 0.70 R) than the plate's (about
  0.80 R); 0.76–0.78 loses B's clearance. B is still a round rod, not Brown's
  flat band.
- 76: the review capture's NDC extent (1.56) counts the unclipped driver.
  Display profiles should be re-measured centrally.
- 155: the synchronous registry model still carries its frame and overlaps.
- 206: the wheel lacks Brown's inner face circle, and the pawl bands are
  thinner than drawn.
- 211: the toothed arc still follows the site construction: 12 teeth over
  135°, where the plate has about 11 finer teeth over about 80°. The plain rim
  also steps out to 9.75 against the tooth tips at 8.45.
- 214: the teeth are still involutes, not Brown's straight-flanked square
  teeth. The stop fingers keep the site animation's long triangles and pose;
  Brown draws teardrop fingers pointing up and up-right.
