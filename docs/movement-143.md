# Movement 143: sliding worm carriage review in progress

The [source caption and engraving](https://507movements.com/mm_143.html)
describe a worm keyed to a rotating shaft, sliding with the carriage that
also carries the worm wheel. A rod connects the wheel wrist to the fixed
right post. The source page marks its animation unavailable (checked
2026-09-14).

The existing analytic rod closure is suitable for this prescribed mechanism;
live browser physics is unnecessary for the linkage. This review has corrected
two finite assembly defects in the authored model:

- The carriage front plate occupied z = −0.51 … −0.31 while the guide occupied
  −0.73 … −0.47, producing 0.04 units of interference. Its new interval is
  −0.44 … −0.24, leaving 0.03 units of running clearance.
- The fixed rod pin started at z = −0.27, separated from its supporting post's
  front face at −0.49 by 0.22 units. The pin now spans −0.52 … 0.62, seating
  in the post and reaching through the front pivot eye.

`tests/sliding-worm-clearance.test.mjs` checks the actual mesh bounds of the
axis-aligned carriage plates against the guide over 721 positions, guide
coverage, and the pin's seating and front reach. Both tests failed before the
repair and pass afterward. The existing movement 143 analytic linkage test
also passes. These checks cover those interfaces, not the entire assembly.

The production build and packaged desktop/mobile playback check pass. The
legacy model now exposes Restart, using the engine's existing analytic
time-zero reset; its paused canvas exactly matches the initial image after
restart. The browser check also covers orbit interaction and no WASM requests.
Desktop, oblique and mobile screenshots were inspected. Private build and
screenshots remain outside Git.

The worm remains a tubular helix driving a scripted wheel. Its reported mesh
phase and pitch velocity agreement follow the imposed ratio and do not prove
finite tooth contact or clearance. Tooth geometry, shaft/hub bores, the
remaining supports, and source proportions still need review before 143 can
be considered verified. Do not use the legacy contact metadata as evidence
that this is a contact-solved or MuJoCo-validated worm pair.
