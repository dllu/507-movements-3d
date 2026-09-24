# Pass-51 wave-2 lane w2c: intermittent movements against Brown's plates

Movements 63, 67, 69, 74, 76, 78, 83, 85, 86, 88, 206, 213, 215, 233 and 237,
plus the low items 52, 56, 70, 71, 79 and 82 from `docs/visual-audit-pass51.md`.
Each production route was captured with
`scripts/review-movement-source-views.mjs` beside its engraving before and after
the changes. Intersections were screened with
`scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`. The
"before" figures come from an extract of `HEAD`, because none of these files
had uncommitted edits when the lane started.

## Changes

| Movement | Change | Worst overlap before → after |
| --- | --- | --- |
| 63 | The leaf spring is a steel-coloured blade 0.075 wide (was a 0.055 black wire), and its anchor runs in from x = -3.4 (was -3.0). It now reads as Brown's double-lined spring coming in from the plate's left edge, not as a detached stub. The stop pin is Brown's small circle, seen slightly obliquely. | spring leaf/leaf joint 0.0132 → 0.0121; spring leaf on drop 0.0025 → 0.0021 |
| 69 | The camera frames the swept envelope padded by 7 %, so the ratchet teeth no longer run to the viewport edge (max NDC 0.92 → 0.81). | the zero-depth working contact only (unchanged) |
| 78 | The camera frames the motion envelope padded by 6 % (max NDC 0.92 → 0.82). | the zero-depth hook contacts only (unchanged) |
| 83 | Presentation only (MuJoCo live). The production model no longer shows the base, the two rockshaft bearings, the output bearing, the input guide rails and posts, or the fork, pin and stem of rod A's slide. Rod A now ends broken off to the upper right, as Brown draws it. The physics keeps its reconstructed supports. | production geometry unchanged; the registry model is not presented |
| 85 | Presentation removes the striking bed (anvil) Brown does not draw. The stamp head now hangs above the ground line. The bed remains in the motion model as the fall's stop. | none → none |
| 86 | The pump rod, crosshead, rope ferrule, rod guides and lower bed are removed by presentation. The rope is clipped at the plinth floor, so it runs down into the base as in the plate. The two hatched runs of the input band are restored and clipped at the plate's right edge (x = 2.1), where Brown breaks them off. The band's own pulley rim sits hidden behind A; its web and hub are removed, so A's spoke openings stay clear. The camera frames the plate window (`cameraFitBounds`). | before: not measured (the HEAD screen ran out of memory); after: zero-depth catch/cam, catch/stop, band/rim and rope/clamp contacts only |
| 88 | The camera frames disk B's envelope padded by 8 %, leaving Brown's margin round the rim (max NDC 0.91 → 0.79). | none → none |
| 206 | A low rim step (1.94–2.03, 0.02 high) draws Brown's inner face circle just inside the tooth roots, clear of the pawl fingers (≥ 2.035). | the zero-depth pawl/tooth working contact only (unchanged) |
| 213 | The display loop opens at Brown's pose, with the third index in progress: the slot at the top, the teeth below and the face pin between the middle teeth. Before, it opened at the initial stop, with the slot at the upper left and the pin standing off to the left like a stray stud. The split is now a narrow parallel-sided slot 0.26 wide from rim to inner circle, instead of a 9.6° wedge. The contact bake keeps its wedge, which the pin never reaches. The arbor square fills the square bore (was 0.31 in a 0.44 bore). The brass friction band is drum-coloured, so it reads as Brown's single inner circle. The white speed indices, pin cap and contact markers are removed by presentation. | pin × white stop marker 0.0436 → none |
| 215 | The display loop opens at Brown's pose: the first index half done, with the pin on the line of centres in the left slot and the crescent's mouth facing the wheel. Before, it opened before engagement, with the slots rotated 30° from the plate. The square arbor is turned 45° and enlarged to fill the diamond bore (was 0.52 in a 0.82 bore). The gold convex-sector strip, white rate indices, pin cap and cusp-contact markers are removed by presentation. | the open gold strip and its 0.0408 marker overlaps are gone; pin × slot mouth 0.0010 → 0.0015 (the same known handoff, sampled at display phases now offset by the pose shift); zero-depth lock contact |
| 233 | The two grey arm-rest blocks, the white wheel and roller witnesses and the contact markers now carry roles and are removed by presentation. | coaxial roller-spindle/witness 0.0691 and block 0.0100 → none |
| 237 | The camera looks from about 35° above, and from the left, so the arm points away to the upper right as in the plate. The output shaft hangs 2.6 below the drum (was 1.5), as drawn. The fixed stud now stands up from the centre boss through the arm eye instead of floating above it. The lower bearing collar, face ring, arm-hub outline, white indices and contact markers are removed by presentation. | white contact markers on nose/teeth 0.0449 → none |

`displayTimeOffset` (213, 215) is the phase time at display time zero:
`model.update(t)` renders `stateAtTime(t + displayTimeOffset)`. The timelines,
canonical times and state queries keep their phase-time meaning. The tests
render canonical states at `time - displayTimeOffset`.

## Items checked and left unchanged

- 52: the ribbing on Brown's disks is cylinder shading (horizontal hatching,
  denser towards the edges), not teeth. The plain disks are correct.
- 67: the tumbler E is in front of worm wheel B (z 0.47–0.69 against B's
  ±0.11), as Brown's dotted B requires. B shows only through E's traced
  scallop. Brown dots B everywhere except the teeth meshing with the worm, and
  dashes E's S-curve inside B's circle. That is his hidden-line convention for
  the two overlapping outlines, and a shaded render cannot reproduce it.
- 74: the camera is already a level front elevation (0, 0, 10). The visible
  top face of C is the bevel cone, about 0.2 of its width, the same ratio as in
  the plate. A camera 6° lower showed C's underside and was rejected.
- 76: the engraving section is a fixed clipping window, so the sector D never
  leaves the frame in playback (checked at 8 phases). The review script's
  max NDC of 1.56 counts vertices of the complete driver ring that the section
  planes clip away. It does not measure the rendered image.

## Residuals

- 206: the wheel keeps 44 teeth, 0.30 deep; Brown's are about 52 and shallower.
  A 52-tooth candidate (right pawl on tooth offset -16 at face fraction 0.62)
  matched the source contact angle within 0.05°. It drove a pawl finger 0.046
  into a tooth during reset, so it was not adopted. The pawl bands are still
  thinner than drawn.
- 213: the five stop teeth are the baked pin-envelope cut: rounded notches in
  a recessed toothed sector. Brown draws square teeth and gaps. Reshaping them
  needs a new contact bake with a square-gap cutter. The ratchet's 22 teeth
  match Brown's count; his teeth are more hooked.
- 215: proportions follow the official animation's construction (driver 0.66
  and wheel 0.60 of the centre distance, against about 0.58 and 0.53 on the
  plate). The concave locking arcs meet the slots in pointed horns, where Brown
  draws rounded ears and nearly straight flanks. Both come from the exact
  Geneva geometry and the contact bake.
- 63: the plate's spring runs further right, under the tail, than the model's,
  which attaches at the tail tip.
- 85: the stamp falls onto the hidden bed height, so it stops in mid-air above
  the ground line.
- 86: the band runs are clipped display geometry. The complete band and the
  remote pulley remain in the model and its motion checks.
- 237: the arm pivots about 1.0 above the face, higher than Brown's low boss.
- 56 (right-hand cone pulley drawn as open rings with the pinion seen
  through), 70/71 (translucent C/B, a deliberate device for Brown's dotted
  outlines; 71's rim is thicker than drawn because the guard's inner radius is
  fixed by the stud lock), 79 (bevel-shaded tooth ring) and 82 (tight framing,
  MuJoCo live) were not changed.

## Tests

`tests/movement-213.test.mjs`, `tests/movement-215.test.mjs`,
`tests/geneva-stop-215-contact.test.mjs`, `tests/movement-206.test.mjs`
(one added rim-step mesh), plus the 63, 233, 237, 069, 078, 085, 086 and 088
suites, the `models.test.mjs` blocks for these movements, the camera catalog
and the source-presentation checks restricted to this lane's entries, and
`tests/mujoco-spring-sector.test.mjs`.
