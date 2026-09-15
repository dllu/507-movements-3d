# Movement 176: engaged engine coupling — shared selector review reopened

The wrist engages a radial slot in the selector carried by the output crank.
Both coaxial cranks have equal throw and turn together under an ideal steady
engaged load. The reconstructed selector has connecting and retaining geometry;
the output shaft has an integral shoulder fitted to the crank cheek. Circular
bosses and recessed arc details replace missing edges and decorative tubes.

## Shared-selector consistency remains open

The subsequent 177 review found different slot profiles in the two factories:
straight when engaged, curved when released. Their shared-selector consistency
is therefore not established. See [movement 177](movement-177.md) and the
[comparison](validation/176-177-slot-consistency.json). The checks below apply
to the individual steady engaged reconstruction at fadeb59; they do not prove
that a quarter-turn of its ring yields the released assembly.

## Source and assumptions

The [original page](https://507movements.com/mm_176.html) describes the wrist of
an omitted driving crank engaging the illustrated crank. It supplies no
executable animation. The rear driver, bearing supports, axial depths, fitted
shaft seat and selector retention are inferred from the front engraving.

The output angle is prescribed from the input with a constant clearance lag.
The selector's chosen angle is held by an ideal lock. This is an ideal loaded
kinematic coupling, not a demonstrated passive dynamic simulation or a model
of engaging/disengaging under load. Movement 177 is reviewed separately.

The [source-edge audit](validation/176-source-fit.json) measures ten manually
selected points against the corresponding outer boss circumferences and cheek
edges. All are within 5.98 source pixels; the largest departure is the left
edge of the upper eye. Inner boss edges are excluded from those measurements.
This is a sparse edge audit plus packaged front-view inspection, not whole-image
registration. The new shallow bosses preserve the complete circular outlines
where the eyes meet the arm.

## Assembly and motion checks

The shouldered output shaft fills the cheek bore and narrows at the front
bearing journal. Its cap matches the large shaft end in the engraving. The
selector halves connect to a sleeve in front of the wrist tip, with front and
rear lips capturing the cheek. Their visible arc details are shallow recesses.

- The [attachment audit](validation/176-selector-mount.json) checks area
  attachment samples along both selector halves, sleeve, faces and lips;
  output shaft, cap, cheek and bosses; and the input shaft/crank/wrist chain.
  The sleeve begins 0.015 model units in front of the wrist tip. Retaining-lip
  clearance is conservatively bounded using the former beveled-cheek envelope.
  Ideal fitted joints and fixed bearing supports remain assumptions.
- The [clearance sweep](validation/176-assembly.json) checks 27 meshes at
  129 poses, including selector-versus-cheek pairs even though their relative
  angle is locked. There are 7,986,984 finite-surface queries and no sampled
  cross-body intersections. Hidden index meshes are included conservatively.
  This is not a continuous collision proof.
- Existing 176 and 177 tests pass. They check the engaged contact geometry,
  cycle closure and retained behavior of the separate disengaged model.
- Production build and [desktop/mobile browser checks](validation/176-browser.json)
  pass playback, exact Restart, orbit/reset, no overflow, no WASM requests and
  no page errors. Front and oblique views were inspected.

Fog and scene ground are disabled. Markers are hidden, the initial camera is
nearly orthographic, and a hidden full-turn envelope prevents framing from
clipping the rotating crank. Catalog playback is bounded below by four seconds.

The [historical baseline](validation/176-existing-solids.json), using the
geometry at 7f0d271, records four interfering pairs. Those wrist/slot and bearing
interferences are removed. Continue with 177; the full 507-movement review
remains active, including earlier explicitly open reviews.
