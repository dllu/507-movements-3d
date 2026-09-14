# 137: expansion eccentric — reconstruction required

The [source engraving and caption](https://507movements.com/mm_137.html) show
a shaped expansion eccentric driving a forked arm with the valve rod attached
at its lower end. The current implementation incorrectly assumes a circular
cam and derives both roller-contact branches from that circle. Its green
kinematic tests consequently do not establish agreement with the source.

The contour review records 25 visible edge landmarks in the 525-pixel engraving.
It excludes the edge hidden behind either roller. The rendered model's circle
has centre (96,226), radius 85 pixels; its maximum radial error at these
landmarks is 23.94 pixels, with RMS error 9.40 pixels. An algebraic least-squares
circle fit still has maximum error 14.50 pixels and RMS error 5.75 pixels.
These discrepancies exceed the drawing's line width; changing only the circle
radius cannot reconstruct the illustrated profile.

- [Measured landmarks](../src/data/expansion-eccentric-outline.js)
- [Overlay](validation/137-outline-review.svg)
- [Numerical report](validation/137-outline-review.json)

Regenerate with:

```sh
node scripts/review-expansion-eccentric-outline.mjs
```

The script reads the current model dimensions, fits an independent circle to
the measured landmarks and emits the report and self-contained overlay.
The overlay has been rendered and visually checked against the engraving.
Landmarks remain manual measurements, not claims of subpixel accuracy.

Next, reconstruct the shaped cam and check the complete roller/fork contact
cycle. The measured roller centres are approximately (82,120) and (80,332),
rather than the preceding model's (81,116) and (80,336). Roller radii and the
occluded cam arcs must be reconciled mechanically; directly extruding a guessed
closed outline would not prove capture or clearance. Replace the circular
branch equations and fixed-angle handoff assumptions when implementing the
new contact model. Use offline contact simulation if the resulting fork
motion depends on preload or free travel between the rollers.

No browser mechanism changes are included in this measurement pass. 137 remains
incorrect and must not be marked reviewed or advanced to 138.
