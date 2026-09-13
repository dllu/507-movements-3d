# Movement 087: distributed source fitting and its contour limit

This turn revisits source fidelity before extending the older 75-pixel
candidate's dynamics. A new 213-part geometry distributes smaller adjustments
across the linkage. It reduces the largest rendered landmark displacement
from 75 to 26.67 source pixels and passes the static solid/contact checks.
However, the rendered stud protrudes beyond E's rim, unlike Brown's drawing.
The new candidate is retained as a comparison, **not accepted as the final
source reconstruction**. The previous dynamic candidate and production are
unchanged.

## Why a shorter lever swing alone cannot fix the measured linkage

The source-point contact calculation reproduces the original linkage and
the earlier 75-pixel linkage at 722 poses. Coordinate/contact differences
are below 2.0e-14; an independent finite difference recovers the four-bar
transmission derivative within 1.4e-10.

With the measured joints, useful clockwise return torque ends at approximately
38.09 degrees of F travel. F does not reach vertical until 42.15 degrees.
Geometric radial reach persists until 47.41 degrees, but that later contact
pushes G in the wrong direction. Thus merely reducing the former 83.93-degree
total swing cannot restore the source mechanism's return action.

## Fitting family and geometry

The deterministic search adjusts seven visible features: F's fulcrum and rod
pin, G's fulcrum and rod pin, G's upper end, E's center and the stud center.
Each shares a bound on its source-pixel displacement. E initially moves only
horizontally. The weighted lever's tip and weight stay fixed in source
projection; gear sizes, slot arc, clutch stroke, stud radius and plate widths
retain their previous values. The rod pin must keep material around its bore
inside the weighted lever.

Force margins are generalized to F through the actual four-bar derivative,
rather than comparing only torque about G. The fitting target is 2% above
the earlier candidate's sampled forward and return margins. The selected
24-pixel search result is feasible at 2,049 samples on each branch. The
population search, coordinate polishing and searched transition bracket do
not prove a global minimum.

The 3D constructor makes two further explicit corrections. It aligns E and
its pinion exactly with the horizontal output shaft, removing the former
0.548-source-pixel axis offset. It also places the stud on the incoming
analytic source-pose contact. The resulting actual rendered displacements
are counted, including the stud's additional contact adjustment:

| Feature | Displacement in source pixels |
| --- | ---: |
| F fulcrum | 24.000 |
| F rod pin | 24.000 |
| G fulcrum | 24.000 |
| G rod pin | 24.000 |
| G upper end | 24.000 |
| E center | 24.006 |
| Stud center | 26.671 |

The candidate rebuilds the lever, bell crank, rod, shifter and follower
carrier around those points. It moves the fixed pivot supports and the E
gear assembly, and adjusts the shaft length. Its quadrant is translated
with F's fulcrum. Hidden depths and the lost-motion interpretation remain
hypotheses from the prior study. None of the previous time trajectories is
applied to the changed geometry or masses.

## Native checks and retained failures

All 213 Float32 solids are closed, consistently oriented, connected and
nondegenerate. The source pose screens 18,971 independent part pairs;
18,799 have disjoint bounds and the remainder receive 1,466,392 bidirectional
surface samples. No sampled intrusion exceeds 1e-6. Native slot/fork gaps
remain nonnegative to roundoff. The analytic stud contact leaves a positive
native polygon gap of 0.00005093 world units, or 0.0153 source pixels.
This is one pose, not full-motion clearance.

The 258 native stud/G roots span both lifting branches. Their generalized
useful moments on F remain positive, with minima 0.452922 forward and
0.098398 on return. Gap residuals are below 1.51e-14. Thirty-six full-solid
contact witnesses agree within 3.64e-15 world units, and contacts stay at
least 0.3948 units beyond the artificial boundary of the upper-arm patch.
These are contact-direction results, not a gravity or loaded reversal run.

The first derivative assertion fails at one contact because the 1e-5 and
2e-6 stencils cross a polygon feature change. The failed report is retained.
The follow-up identifies the actual native support vertices at every stencil
endpoint. Three smaller sizes, 4e-7, 8e-8 and 1.6e-8, stay on the same features
at all 258 contacts and recover both generalized derivatives within 9.81e-8.

The first capture also fails a strict state equality check: Chromium and Node
give weight angles differing by one ULP. Its image, exit status and source
snapshots are retained. The corrected capture records the maximum numerical
state discrepancy and requires it below 1e-12. This changes cross-runtime
verification, not the candidate geometry.

## Source tradeoff found in the rendered review

All nine final stills are opened: eight source/front/oblique/rear/detail views
of the new candidate and one registered overlay of the historical 75-pixel
candidate. The ordinary rod joints are closer to the engraving. Displacements
at the formerly fixed fulcrums and E center remain visible. The stud's new
position near and beyond the outer rim is apparent in the detail and oblique
views. Minor shadow speckling remains on the quadrant face.

Across the same seven landmarks, the maximum error drops from 75.00 to 26.67
pixels and RMS error drops from 40.09 to 24.40. Mean error increases from
21.43 to 24.38 because more points move. These metrics are not interchangeable
with overall contour fidelity.

Native rendered vertices expose the decisive new mismatch. The old stud lies
32.17 pixels inside the wheel's outer radius, matching the measured source
margin of 32.17. The distributed stud extends **15.82 pixels beyond the rim**.
Its central pin still has 9.10 pixels of radial margin inside the wheel, but
the visible outline differs from the engraving. A smaller largest landmark
error therefore does not establish an acceptable source reconstruction.

The next fit must include the relative stud/rim contour constraint and compare
the broader projected outlines, while retaining useful return contact. It
must then receive new native clearance, mass/gravity and connected-motion
checks. Source fidelity, material/retention identity, repeated cycles,
continuous clearance, rendering polish, final speed and integration remain
open. There is no new production build or all-507 browser pass.

## Evidence

`087-distributed-source-checkpoint.json` indexes and hashes the local results:

- `087-first-distributed-source-fit.json`: deterministic search and parity.
- `087-first-distributed-geometry.json`: actual projections and native solids.
- `087-first-distributed-contacts.json`: contact roots and retained broad-stencil failure.
- `087-distributed-feature-gradients.json`: support identities and smaller stencils.
- `087-distributed-source-tradeoffs.json`: landmark and native rim comparisons.
- `087-distributed-fit-rendered-v2-captures.json` and matching inspections:
  nine inspected stills, no browser errors or unexpected warnings.
- `087-distributed-fit-rendered-failed-capture.json`: the retained one-ULP failure.

The scripts use exclusive output paths; bulk artifacts remain outside Git.
All 1,097 frozen production inputs and the prior 082/083/087 study inputs are
preserved. The all-507 goal remains active.
