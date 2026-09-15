# Movement 167 — recessed reversing spiral drum

167 now uses eight meshes and a four-second analytic cycle. The stud runs in
an actual recessed channel; the earlier raised tube, solid stationary bearings,
external frame and guide rail are removed. The source drum, shaft, long rod and
stud seat remain, with a near-frontal view, no fog or ground, and bounds covering
the entire rod stroke. No WASM is needed.

## Source and assumptions

The [source page](https://507movements.com/mm_167.html) describes a closed groove
with opposite pitches on its two halves, driven by a stud on a reciprocating
rod. Its animation tab is unavailable and it has no movement animation script.
The engraving provides the geometric reference; no 2D oracle comparison is
claimed.

Using 0.014 world units per source pixel, the drum is 80 pixels wide and 340
pixels long. The shaft spans approximately y=73–475, and the rod y=79–464 at
the initial lower reversal. The groove extrema follow the previous measured
centers near (214,170) and (290,344). The initial model reproduces those overall
proportions. A true constant-pitch helix projects as a curved line near the
cylinder silhouette; the engraving simplifies this to an almost straight
sloping stripe. The reconstructed channel therefore does not exactly overlay
that stripe. The spherical stud, groove depth and clearance are inferred.

The drum has two closed outer sections joined by a continuous inner core.
The channel is 0.34 world units high and 0.16 deep. The spherical stud has
radius 0.075 and its center is at radius 0.53; the groove floor radius is 0.40.
The channel includes clearance through the sharp pitch reversals. It is not
a zero-backlash conjugate cam. Surface walls are explicit geometry, with sharp
lip edges and smooth cylindrical normals.

A harmonic reciprocating input is prescribed. Inverting the constant-pitch
halves gives one output revolution per complete rod cycle, with zero speed at
each reversal. Continued rotation in the same direction at the dead centers
is prescribed, not obtained from inertia or a force solver. Neither contact
forces nor backlash dynamics are simulated. Four seconds per full cycle gives
two seconds per stroke. These timing and loading choices are illustrative.

## Validation

The [legacy audit](validation/167-existing-contact.json) found penetration at
all five selected follower/guide/bearing interfaces despite negligible reported
centerline error. Its maximum stud/drum depth was 0.0734083 world units.

The replacement [actual-solid sweep](validation/167-solid-clearance.json)
checks 129 poses, 16 cross-body pairs and 9,699,708 bidirectional vertex,
edge-midpoint and triangle-center queries. No sampled penetration exceeds
1e-6 world units. Same-body joins are excluded. This sampled clearance result
is not a claim of force transmission under arbitrary loads.

Three tests cover centerline closure, monotonic output, periodicity, reversal
continuity and a conservative spherical-stud clearance calculation. The
production build and packaged Chrome desktop/mobile test pass: playback,
exact restart, orbit/reset, no WASM request, no page errors and no horizontal
mobile overflow. Front and oblique screenshots were inspected; artifacts stay
in `/dev/shm/167-*`.

```sh
node --test tests/reversing-groove-drum.test.mjs
node scripts/review-groove-drum-solids.mjs
```

The full 507-movement review remains active. Next source review: 168.
