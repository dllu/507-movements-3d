# Movement 151: worm-driven opposite-hand screw

Review is open. `src/simulation/opposed-screw-nuts.js` is a reconstruction
candidate, not registered in the production loader.

The [source caption](https://507movements.com/mm_151.html) places the toothed
wheel on the screw shaft and the worm on the upper shaft. The drawing shows
the horizontal screw, an edge-on vertical wheel with its center on that screw,
and the end of the upper shaft above it. The legacy model incorrectly treats
the vertical strip as a vertical worm, makes the wheel much too small, and
puts the input handwheel perpendicular to the source view.

The candidate uses perpendicular X/Z wheel/worm axes and the existing generated
18-tooth worm pair from 104, uniformly scaled to the measured 93px wheel radius
at 0.014 world units/pixel. The upper axis consequently lies 6.8px below the
source reading. Tooth count, profile and bearing depth are inferred; matching
151 exactly requires deciding whether to regenerate that pair. Its tooth field
is instanced, preserving the original resolution without duplicating all tooth
vertex buffers. This does not imply that the complete assembly has already
passed a contact audit.

Both nuts now have bored bodies and solid square internal threads, paired with
opposite-handed solid square external threads. Pitch is 0.224 (16 source
pixels); thread crest widths are 0.096 with 0.016 axial clearance at each of the
opposed flanks. Nuts move by one pitch in 27 seconds, dwell 3 seconds and return
in 27 seconds, then dwell again. The upper shaft peaks at 1.25 revolutions per
second; the 18:1 reduction is preserved. No live physics is needed for these
ideal screw and gear constraints. Final hardware support and coupling review
remain necessary.

Validation so far:

- `node --test tests/opposed-screw-nuts.test.mjs`: three passing tests cover
  world shaft axes, source scale, gear/screw relations, midpoint conservation,
  periodic closure and actual thread surface clearances at nine poses spanning
  a full screw revolution, in both nuts and in both query directions.
- Headless Chrome source, intermediate and return poses were rendered from the
  actual Three.js engine. Private screenshots are in `/dev/shm/151-candidate-*`.
  The source view now shows the wheel edge beneath the upper circular bearing.
- No full assembly audit, generated wheel/worm contact sweep, inferred nut
  antirotation guides, screw bearings or production browser test yet. The
  current prototype intentionally retains ideal supports until the finite
  hardware is built and reviewed; it is not a finished reconstruction.

Next: validate the transformed worm pair through mesh phase, add rear screw
bearings and nut antirotation guides, audit the whole assembly, then register
and run packaged desktop/mobile playback checks. Keep movement 150's source
contour interpretation open in parallel with this catalog review.
