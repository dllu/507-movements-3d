# Movement 173: tappet-indexed silk traverse — review open

The [original page](https://507movements.com/mm_173.html) has no enabled animation
or mechanism animation script. Its caption describes a disk-carried screw,
a fixed tappet indexing the wheel once per disk revolution, and a traveling
nut driving a slotted silk-guide rod. The current implementation prescribes
a quintic indexing curve; it does not solve this contact.

## Verified defects

The first-event finite-mesh audit samples 257 poses. Distance from the rendered
spherical tappet to the actual wheel meshes is negative in 185 poses and positive
in 72. The minimum signed gap is -0.1501 model units and the maximum is +0.0332.
The previous tests compared the tappet center to a nominal outer radius, which
neither accounts for tappet radius nor proves tooth engagement. Passing those
kinematic tests therefore does not establish a correct mechanism.

Initial selected source landmarks also differ: the nut wrist is 6.91 pixels
from its measured center and the tappet wheel 8.32 pixels away. The horizontal
rod was drawn 24 pixels below its source ordinate. Correcting that ordinate
reduces the selected rod-center discrepancy from 24.17 to 2.86 pixels. These
are selected landmarks, not a whole-contour fit.

## Current increment

The guide rod now uses source Y=283 instead of 307. The default camera faces
the engraving plane; fog and the scene ground are disabled, and Restart resets
the mechanism to its source pose. The inherited period remains 4.17 seconds per
disk turn, with an explicit stop after the 18-step adjustment. This finite
adjustment and its screw lead are assumptions, not source-specified dimensions.

The scoped legacy model test passes, including the corrected ordinate, front
view, disabled fog/ground and reset. The production build passes. The packaged desktop/mobile browser test passes playback, exact Restart,
orbit/reset view and mobile overflow checks without page errors or WASM.
See the [browser report](validation/173-browser.json). These checks do not resolve the mechanical
contact defects.

## Remaining work

Reconstruct the finite tappet/tooth encounter and validate indexing from actual
contact, preferably with an offline MuJoCo solve. Recheck the screw and nut
constraints, source offsets and slot clearance. Replace unsupported frame and
joint geometry with an engraving-based assembly, then audit all distinct-body
mesh pairs and the full adjustment playback. Do not mark 173 reviewed yet.

The historical [baseline](validation/173-existing-contact.json) hashes the
model at commit 9d95f53. The [current audit](validation/173-current-contact.json)
records the rendering/alignment increment. Both deliberately report failures;
the audit script is diagnostic and does not assert clearance.
