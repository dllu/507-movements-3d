# Movement 087: slot coupling and return-contact hypothesis

A separate 213-part candidate adds a possible coupling between F, the curved
quadrant and the clutch shifter. Its 26 diagnostic positions pass the native
mesh screen, but this is not a qualified reversal animation. It changes both
connecting-rod pin positions by 75 source pixels. That substantial proportion
change remains visible in the overlay and is not accepted as a faithful final
reconstruction. The original 207-part measured candidate and production remain
unchanged.

## Source interpretation

[Brown's description](https://507movements.com/mm_087.html) requires the stud on
E to lift F beyond vertical in both directions, with the falling weight moving
D between B and C. It does not explain the quadrant's attachment or follower.

A related mechanism appears in Francis L. King's
[US158175A, December 29, 1874](https://patents.google.com/patent/US158175A/en).
Drawing sheet 5, Fig. 17, and the following specification show a weighted lever
with a concentric slot and a shaft lug. The lever can turn freely through a
quarter or third revolution before turning the clutch actuator. Stops limit
the actuator, and the falling weight completes reversal. This is a period
analogue supporting a lost-motion interpretation; it does not establish that
Brown's mechanism has the same construction.

The local patent PDF and HTML are retained in `artifacts/reference/` under
`087-analogue-US158175*`. The inspected `087-analogue-US158175-page5.png` contains
Fig. 17. The earlier filename `087-analogue-US158175-figure17.png` is misleading:
it contains PDF page 7, printed specification page 2. Its useful text is
retained with that correction in the inspection record.

In the candidate, the quadrant moves rigidly with F. A separate coaxial shifter
has a finite pin inside the curved slot, supported by a concealed carrier.
The slot endpoints allow F to cross vertical before the shifter moves D.
The carrier, hub, spacers, fork shoe and hidden depths are reconstruction
assumptions. The diagnostic position function imposes the slot limits and
axial clutch stops; it is not a force or time solution.

## Contact direction and changed proportions

The finite slot outline and 17-pixel follower radius give 76.31348 degrees of
free relative travel. D's 74-pixel stroke requires about 7.61815 degrees of
shifter rotation, giving an 83.93163-degree total F swing. The follower stays
inside the actual rounded polygonal slot with a 1e-6 world-unit margin. A
circular fork shoe has 0.0001 axial play against each groove side.

The measured four-bar cannot present G to E at the left stop. The new study
changes only two crank radii: it shortens F's pin radius and lengthens G's by
equal source-pixel amounts, retaining their initial directions, both fulcrums,
G's upper arm and the weight's front projection. The fixed rod length is then
recomputed. Zero adjustment reproduces the original linkage exactly at all
361 comparison poses.

The 0–90-pixel integer sweep distinguishes radial reach from useful force
direction. Possible radial contact first occurs at 51 pixels, but at 60 pixels
the incoming clockwise stud would turn G the wrong way. Positive contact
moments on both sampled lifting branches first occur at 70 pixels. These are
thresholds within this restricted one-parameter family, not a proof of the
smallest possible source change.

The 75-pixel candidate supplies more return margin. Across 129 poses on each
lifting branch, the minimum useful moment of a unit normal force is 1.155223
world units for forward lifting and 0.318076 for return lifting. The returning
contact at the left stop lies on the rounded end of G, which must be retained
in the calculation. This analytic circle/capsule study does not yet qualify
the native polygonal stud contact, positive dynamic reactions, friction,
gravity or contact-branch continuity.

## Geometry and rendering checks

The first 75-pixel geometry audit found the weight intersecting the shifter
blade and bridge near vertical, and one quadrant spacer crossing the rod near
the left stop. The failed report and exact inputs remain in
`087-first-lost-motion-solids.json` and its source snapshots.

The corrected weight center is at Z = 1.59 instead of 1.52. Its front projection
is unchanged; its rear surface now clears the shifter and still intersects
its own supporting F plate. The two spacers lie at local angles −120 and −70
degrees, outside the rod sweep. The earlier 60-pixel candidate also used a
wider hidden shifter hub; the 75-pixel version narrows that hub and its bores
to clear the shortened F crank. These hidden proportions are explicit choices.

The final local reports are:

- `087-first-operating-proportions.json`: the 91-option planar contact study.
- `087-cleared-lost-motion-solids.json`: 213 closed, oriented, nondegenerate
  Float32 solids and 26 diagnostic poses, 13 in each direction. Each pose
  considers 18,971 independent part pairs. Disjoint bounds exclude most
  pairs; unchanged relative transforms reuse prior sample results. The
  remaining checks total 7,120,408 native triangle vertices, edge midpoints
  and centroids in both directions, with no intrusion beyond 1e-6.
- The same geometry report records maximum rod-length error of 8.89e-16
  world units and minimum finite-slot clearance of approximately 1e-6.
- `087-cleared-lost-motion-captures.json` and
  `087-cleared-lost-motion-inspections.json`: all 15 rendered views inspected,
  including overlay, rear, both vertical states, left clutch/slot details,
  the former weight collision and the left pivot. No browser errors or
  unexpected warnings occurred. The rear pivot seat hides the spacers in
  that close view; their clearance rests on the sampled mesh audit.

Motor and output angles remain zero throughout the diagnostic mesh screen.
The screenshots are individually posed stills, not frames from a reversal
trajectory. They demonstrate geometric lost motion and visibly changed
proportions; they do not establish motion timing or loaded clutch engagement.
No continuous-clearance or performance pass is claimed.

The first construction attempt's duplicate pivot cut, the rejected 60-pixel
return geometry, and the colliding 75-pixel candidate remain archived. Earlier
capture sets retain their original source snapshots and are not represented
as fully inspected final evidence.

## Remaining work

The reconstruction still needs a defensible source-fidelity decision, native
stud contact with correct force transmission through the rod, gravity and
inertia through the free slot travel, and loaded clutch engagement during
reversal. Actual driven motion must then pass complete clearances, repeat
behavior and rendering checks before production integration.

`087-lost-motion-checkpoint.json` records the evidence and source hashes. All
1,097 inputs frozen after verified 086 remain unchanged, as do the 082/083
study sources and the original 087 geometry. No new production build,
full-suite test or all-507 browser pass is claimed. The full review remains
active.
