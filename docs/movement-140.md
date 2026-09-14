# 140: reconstructed toggle punching machine

The [caption and animation](https://507movements.com/mm_140.html) describe a
hand lever driving a punching toggle through a connecting link. This is a
determinate linkage: circle intersections give its motion without live physics
or a MuJoCo solve. Punching forces and material deformation are outside this
kinematic reconstruction.

## Evidence from the engraving

Registering the previous model at both fixed pivots leaves the handle endpoint
81.99 pixels from the drawing. Its handle is 262.48 pixels long at that scale,
versus 198.41 measured. Its knee is 9.68 pixels away. The existing rectangular
frame supports also do not follow the casting's outline. The previous model uses
the source animation's equal-link proportions, which differ from the engraving.
See [the measured comparison](validation/140-dimensions.json).

Measured centres in `toggle-punch-dimensions.js` give upper and lower toggle lengths
114.95 and 108.76 pixels, respectively, with a 103.02-pixel connecting link. The
upper pivot and ram axis differ horizontally by five pixels. Keeping these
measurements gives a 29.65-pixel stroke to collinearity and a clockwise lever
swing of 123.53 degrees. This is explicitly different from the source animation's
approximately 87-degree swing. The engraving does not depict the endpoint;
straightening the toggle determines this reconstruction's endpoint.

`toggle-punch-kinematics.js` solves that unequal-link configuration. Across 2,001
poses, all three link lengths close within 7e-16 world units and the ram descends
monotonically without branch jumps. A six-second motion schedule preserves the
source animation's closing, closed dwell, return and open dwell proportions.

## Visible hardware and validation

The browser now loads the reconstructed casting, correctly sized handle, bored
links and open ram guide. The rear support plate and curved front pedestal follow
the drawing's stepped and curved outlines. Hidden depths and the die passage are
inferred. The guide starts at pixel 305 while the ram joint descends from 290 to
319.65, so it admits the lower link as well as the ram. The tip descends from 397
to 426.65 through a bored shelf at 400, staying above the base at 447. No solid
workpiece or material deformation is simulated.

The connecting link lies in front of the lever shaft: the first reconstruction
placed it behind the lever and collided with that shaft near full closure.
The corrected axial layers pass 721 finite-polygon intersection checks, including
the link and pin bores at their overlapping depths. See
[the clearance report](validation/140-clearance.json). Same rigid-body pieces are
excluded from that check. The round shaft stops below the transverse ram-joint
bore and joins the bottom of its eye rather than filling the passage.

Separate mesh checks cover the full punch cross-section, guide walls and lips,
lower-link axial clearance, die passage and base clearance through 801 poses.
Motion bounds contain the complete handle swing. Fog is disabled and the model
uses its own base without a ground plane. Six-second playback preserves the
source animation's closing/dwell/return/dwell schedule. Four focused tests and
packaged desktop/mobile playback, restart and visual checks pass without WASM.

```sh
node scripts/review-toggle-punch.mjs
node scripts/review-toggle-punch-clearance.mjs
node --test tests/toggle-punch-kinematics.test.mjs tests/toggle-punch-geometry.test.mjs
```
