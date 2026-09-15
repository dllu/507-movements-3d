# Movement 151: worm-driven opposite-hand screw

Production now loads `src/simulation/opposed-screw-nuts.js`: an ideal gear and
screw reconstruction with independently checked finite solids. No MuJoCo or
baked trajectory is needed for the prescribed gear and lead-screw constraints.

The [source caption](https://507movements.com/mm_151.html) places the toothed
wheel on the screw shaft and the worm on the upper shaft. The drawing shows
the horizontal screw, an edge-on vertical wheel centered on that screw, and
the end of the upper shaft above it. The legacy model incorrectly treated the
vertical strip as a vertical worm, made the wheel too small, and placed its
input handwheel perpendicular to the source view.

The replacement uses perpendicular X/Z wheel/worm axes and the generated
18-tooth worm pair from 104, uniformly scaled to the measured 93px wheel radius
at 0.014 world units/pixel. The upper axis consequently lies 6.8px below the
source reading. Tooth count, tooth profile and bearing depth are inferred;
this is a mechanically consistent reconstruction, not an exact tracing of
unseen teeth. An instanced tooth sector retains the full generated wheel
resolution without duplicating all tooth vertex buffers.

Both nuts have bored bodies and solid square internal threads, paired with
opposite-handed solid square external threads. Pitch is 0.224 (16 source
pixels); crest widths are 0.096 with 0.016 axial clearance on each flank.
Nuts move by one pitch in 27 seconds, dwell 3 seconds and return in 27 seconds,
then dwell again. The upper shaft peaks at 1.25 revolutions per second; the
18:1 reduction is preserved. A two-second full demonstration would obscure
that reduction. Rear channels prevent nut rotation, two bored bearings carry
the screw, and rear posts support the upper bearing. This hardware is inferred.
The drive assumes ideal coupling and guides; backlash, friction and load are
not simulated.

## Rendered clearance correction

A 192-section worm skin intersected the generated wheel at every sampled
phase. An independent analytic profile sweep found the original phase was
correct: the intersection witness lay outside the smooth worm flank, but
inside its coarse planar approximation. Increasing the worm to 768 angular
sections removed the intersections without rephasing the teeth or changing
ratios. The shaft is recessed beneath the worm root and has separate full-size
external journals, avoiding coincident root surfaces and oblique-view flicker.
The earlier failed diagnostic is described here rather than retained
as the final report. `scripts/probe-opposed-screw-phase.mjs` reproduces the
phase sweep and writes its raw results under `/dev/shm`.

The complete assembly check also caught the front bearing clipping the wheel.
Moving that bearing and its sleeve forward along the input shaft, extending
the shaft and connecting the rear support arm, removed those intersections.

## Verification

- `node --test tests/opposed-screw-nuts.test.mjs`: three tests cover world axes,
  source scale, gear/screw relations, midpoint conservation, periodic closure,
  peak input speed and actual thread surfaces at nine poses spanning one full
  screw revolution, for both nuts and both query directions.
- `node scripts/review-opposed-screw-contact.mjs`: 65 offset phases spanning
  one input revolution, compared against every triangle in all 18 wheel
  instances. No skin intersections; separation is at least 0.00001 in the
  unscaled wheel coordinates at those samples. Both meshes are closed and
  consistently oriented. Teeth repeat periodically; this is a sampled test,
  not a proof of continuous contact or contact forces.
- `node scripts/review-opposed-screw-assembly.mjs`: 53 mesh/instance parts,
  925 distinct-body pairs and 10,153,736 surface point queries at 17 poses over
  the complete reversing demonstration. No unintended intersections. The
  working worm/wheel mesh is excluded here and checked separately above.
  Vertices, edge midpoints and triangle centers are checked in both directions.
- Production Vite build, plus packaged desktop/mobile playback, exact restart,
  orbit/reset, and no-WASM browser checks. Private build and capture artifacts
  are under `/dev/shm/151-*`; reproducible numerical reports with source hashes
  are in `docs/validation/151-{assembly,render-contact}.json`.

Retain the 6.8px upper-axis discrepancy, inferred 18-tooth pair/supports, ideal
coupling and finite sampling as reconstruction limits. Movement 150's cam-face
interpretation remains open separately.
