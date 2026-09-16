# Mercury instruments: 498 and 501

Twenty-fourth family pass, 2026-09-16. These instruments share analytic
hydrostatics, circular tube bends, finite glass walls and bored retaining clips.
No physics solver or engraving tracing is needed for the intended geometry.

## Source and retained motion

The official [498 description](https://507movements.com/mm_498.html) specifies
a pressure-connected leg and an open atmospheric leg. The [501 description](https://507movements.com/mm_501.html)
specifies a sealed long leg and an open reservoir. Both complete HTML documents
were inspected: neither contains an animation model or animation-library setup.
Local engravings were compared alongside the browser renders.

The existing eight-second pressure demonstrations remain analytical. In 498,
equal and opposite surface displacements conserve mercury volume, and pressure
is proportional to the difference in surface heights. In 501, the 5:1
reservoir/tube area ratio determines the two displacements and calibrated scale.
These laws were already correct; the changes make their visible containers
consistent with them.

## Corrections

- Both instruments have finite glass walls, open bores and exact semicircular
  lower bends with vertical end tangents. The former glass legs had only outer
  surfaces. Retaining clips now surround real holes, clear the glass, and join
  the rear support. Lowered bases clear the glass bends; the rear supports reach
  those bases and brackets carry the scales.
- 498 has a bored inlet flange and stopcock boss. Its new circular elbow joins
  the left leg from above with a downward tangent; the previous spline curved
  upward into an open, pointed connection. The handle has connecting spokes.
- 501 has a continuous reservoir/neck passage, a finite sealed top cap, and
  mercury filling the lower transition into the reservoir. The reservoir's
  working band has the constant area used by the existing volume law; shoulders
  connect it to the narrow necks. The old spherical envelope surrounded a
  disconnected, narrower cylindrical mercury volume.
- Nearly frontal default cameras keep the scales readable. Ground and fog are
  disabled; transparent components do not cast opaque shadows. The production
  timing wrapper preserves a minimum eight-second cycle.

The shared implementation is `mercury-instrument-parts.js`, using the existing
finite passage, revolved section and planar plate helpers. All geometry is
created once; animation changes transforms and material opacity only.

## Evidence and scope

The two existing suites plus `mercury-instrument-working-solids.test.mjs` pass
**19 tests**. New checks sample mercury against glass walls over 17 off-grid
poses, probe the open bores and closed cap, check clip clearances and elbow
alignment, and verify stable object/geometry/buffer identities. Existing tests
retain hydrostatic balance, volume conservation, scale calibration, cycle
closure and whole-cycle bounds.

Serial Chrome comparison captures show no errors or clipping: maximum projected
extent is 0.910 for 498 and 0.915 for 501, where 1 is the viewport edge. These
captures preceded the final scale-support and base-clearance changes; packaged
browser checks cover the final assembly. Production build and desktop/mobile
results are recorded in `review-progress.md`.

Dimensions, pressure histories, support hardware, glass thickness and reservoir
shape are reconstruction choices. Small radial display clearances separate the
mercury from tessellated glass; menisci are decorative surface caps and are not
part of the volume calculation. Prescribed quasi-static pressure ignores fluid
inertia, capillarity, temperature effects and stopcock flow. These corrections
do not qualify a dynamic fluid simulation or a calibrated measuring instrument.
