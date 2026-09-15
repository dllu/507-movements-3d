# Movement 176: engaged engine coupling — review open

The first finite-solid review found the wrist clipping its slot and the front
bearing overlapping the output shaft and cap. The slot lobes now have sharp
contact edges; the added wall strips lie entirely outside the clear slot.
A bored cylindrical bearing replaces the interfering torus and sits behind
the shaft cap. These changes apply to 176 only.

The front view is nearly orthographic, fog and scene ground are disabled, and
contact/index markers and the orbit witness are hidden. The invisible orbit
still supplies a full-revolution camera envelope. Restart restores the initial
engaged position. The catalog display cycle is bounded below by four seconds.

## Source and motion

The [original page](https://507movements.com/mm_176.html) describes the wrist of
an omitted driving crank engaging the radial slot of the illustrated crank.
There is no executable animation on this page. Both coaxial cranks have equal
throw in this reconstruction; an ideal loaded one-to-one rotation maintains
wrist contact with the trailing wall. The output angle is prescribed from the
input with a constant clearance lag. This is an ideal kinematic coupling,
not a validated passive dynamic simulation.

The selector now has an inferred sleeve and front/rear retaining lips. Both
slotted halves extend into the cheek bore and connect to the sleeve in front
of the wrist tip. The two arc details are shallow machined recesses rather
than raised tubes. The wrist's decorative outline tube is removed because
it cut into the extended selector. These depths are not specified by the
engraving; the selected angular position is held by an ideal lock.

The [selector attachment check](validation/176-selector-mount.json) verifies
noncollinear finite-surface attachment samples for each half, face and retaining
lip. The front and rear lips clear the cheek by 0.016 model units each, and
the sleeve begins 0.015 ahead of the wrist tip. The separate interference
audit now includes selector-versus-cheek pairs even though their relative
angle is locked. Output-shaft attachment and quantitative source fit still
need review; this is not a certification of all assembly connections.

## Checks

- The [historical baseline](validation/176-existing-solids.json), using the
  source geometry at 7f0d271, records four interfering pairs at 129 poses.
- The [current sweep](validation/176-assembly.json) checks 26 meshes, including
  hidden index meshes conservatively, at 129 poses. It performs 8,849,736
  finite-surface queries and finds no sampled cross-body intersections.
  Other same-family attachments and continuous clearance are not established.
- Existing 176 and 177 tests pass; the latter checks that the shared factory's
  disengaged movement retains its prior behavior. The 176 expectations reflect
  its new front camera and shorter bearing envelope, plus 175's renamed model.
- Production build and packaged Chrome desktop/mobile checks pass playback,
  exact Restart, orbit/reset, no overflow, no WASM requests and no page errors.
  The front view was inspected alongside the engraving.

Continue with 176's output-shaft attachment and quantitative source fit. The full
507-movement review remains active.
