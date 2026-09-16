# Source and display follow-up: 151, 165, 171, 173

GPT-6 Astra, acting as the primary reviewing agent, independently inspected the
production-loader default and advanced oblique renders beside the original
engravings on 2026-09-16. This establishes visual-review attribution separately
from their earlier implementation and numerical reports.

- [151](https://507movements.com/mm_151.html): the input-shaft end mark is visible
  and rotates with the worm. The opposite-handed nuts and edge-on wheel follow
  the source arrangement. The added supporting frame is absent from the drawing;
  retain that visible source-fit difference and the previously measured 6.8-pixel
  upper-axis offset. No new whole-assembly clearance claim is made.
- [165](https://507movements.com/mm_165.html): six equal sine lobes replace the
  uneven drawn silhouette as requested. The finite roller seats in the openings;
  the source-facing lever and output bar are readable. This is a geometric
  quasistatic bake, not production MuJoCo. Independent refined-contact tests pass.
- [171](https://507movements.com/mm_171.html): the mechanism fills most of the
  viewport height, including its full upper eccentrics and lower guides. The
  earlier excessive empty camera envelope is gone. Reversing control and hidden
  linkage details remain prescribed/inferred as recorded in its movement review.
- [173](https://507movements.com/mm_173.html): the screw has a solid helical
  trapezoidal thread, and the dark tooth/cheek marks show indexing. Playback repeats
  after a finite 71.825-second adjustment; the nut resets at that boundary, which
  is still a visible replay discontinuity rather than unlimited screw travel.

## Camera correction

The independent full-motion screen found 173 reaching 1.19095 normalized device
coordinates, beyond the visible ±1 edges. Its factory computed motion bounds but
only supplied `cameraFitBounds`; the engine therefore fitted the initial vertices
inside that box. Supplying `sampledMotionBounds` activates the engine's existing
full-motion box fit. The final 129-pose source-facing sweep reaches 0.90074 and
has no browser errors. Geometry, indexing and native contact are unchanged.

151, 165 and 171 reach 0.92763, 0.91569 and 0.90446 respectively in the initial
17-pose screen. These are camera samples, not a collision certification. Existing
intersection evidence is retained with its original scope and sampling limits.

The three opposed-screw tests, two independently refined wave-cam playback tests
and two current 173 assembly tests pass. The latter check the complete adjustment,
repeated playback beyond the first cycle and exact reset. An additional three
unchanged 142 tests ran incidentally; they are not evidence for 173. The production
build passes in 25.05 seconds. Bulk renders and logs are under
`/dev/shm/family48-user-followups-*` and `/dev/shm/family48-173-final-*`.

All four packaged desktop/mobile browser cases pass in 52.5 seconds, including
playback, exact Restart, orbit/reset, no page errors and no WASM downloads. These
checks exercise the current async production routes rather than the older
synchronous models retained for historical studies.
