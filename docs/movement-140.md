# 140: toggle punching machine review

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

## Remaining work

The browser still uses the previous model. Rebuild the casting, handle, bored
links and ram guide to match the engraving. The guide starts at pixel 305 while
the ram joint descends from 290 to 319.65, so it must admit the lower link as well
as the ram; a capped solid guide would collide. The tip descends from 397 to
426.65, requiring a through-opening at the shelf near 400. Hidden depths and the
die passage need explicit reconstruction and full-stroke clearance review.
Then check rendering, camera bounds, speed, restart and packaged playback before
advancing to 141.

```sh
node scripts/review-toggle-punch.mjs
node --test tests/toggle-punch-kinematics.test.mjs
```
