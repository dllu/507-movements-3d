# Movement 177: released engine coupling — review open

The wrist now clears the rendered curved passage without clipping decorative
wall tubes, grooves or markers. The front bearing has a real cylindrical bore
and clears the shaft cap. Fog and scene ground are disabled, the initial camera
is nearly orthographic, and Restart restores the source pose. Catalog playback
is bounded below by four seconds.

## Important shared-mechanism discrepancy

The source caption for [176 and 177](https://507movements.com/mm_176.html)
describes rotating the same selector ring. The current factories instead use
a straight radial slot for 176 and an annular curved passage for 177. A quarter
turn of the former cannot produce the latter. The
[shape comparison](validation/176-177-slot-consistency.json) quantifies this:
at local x = 0.5, the released walls are -0.33182 and +0.25501 instead of
-0.29 and +0.29. That difference is about four engraving pixels at one wall.

This reopens the cross-state consistency of 176 as well as 177. The individual
steady engaged view's checks remain useful, but they do not establish a shared
physical selector. The next step is one canonical slot profile, instantiated
at two orientations, followed by engaged contact and released clearance checks.
Do not simulate selection by morphing the slot geometry.

## Current checks and limits

The [historical baseline](validation/177-existing-solids.json), using source
geometry at fadeb59, records eight interfering pairs. The
[current sweep](validation/177-assembly.json) checks 19 meshes at 386 poses:
129 full-turn samples plus 257 concentrated entry/passage/exit samples. It
performs 4,303,180 finite-surface queries with no sampled cross-body
intersections. This is not continuous proof and does not validate attachment
of the separate selector lobes.

Both existing 176/177 motion tests pass. Production build and
[packaged desktop/mobile checks](validation/177-browser.json) pass playback,
exact Restart, orbit/reset, no overflow, no WASM requests and no page errors.
The front view was inspected next to the engraving. The removed arc tubes
need replacement with source-faithful details as part of the shared selector
rebuild; the present view is provisional.

The input rotation and stationary output remain prescribed. The model is not
a passive dynamic disengagement demonstration. Retention, shaft attachment
and quantitative source fit still need qualification for the final shared
assembly. Continue with the 176/177 selector; the full review remains active.
