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

## Passive contact reconstruction

A standalone [MuJoCo study](../src/simulation/mujoco-silk-tappet/physics.js)
now models a carrier, a wheel with 18 straight tappet teeth, and a fixed spherical
pin. Only the carrier has an actuator. The wheel's angle comes from finite
normal contact and inferred screw resistance; no prescribed indexing curve,
angle clamp or output actuator drives it. Straight teeth are an explicit
reconstruction choice for this pin-indexed wheel, not a meshing gear pair.

The [qualification script](../scripts/qualify-silk-tappet.mjs) runs 18 revolutions
at two timesteps, plus a control with the tappet's collisions disabled. It
checks one-tooth advances, dwell speed, finite states, input tracking, rollback,
contact penetration and agreement between timesteps. Detailed results are in
[the native report](validation/173-native-tappet.json); bulk trajectories remain
in `/dev/shm/173-native-tappet.json`.

The timestep, tooth dimensions, axial thickness, pin height, initial tooth
phase, inertia and resistance are recorded assumptions. MuJoCo's compliant
contact permits a small negative gap; see its
[contact model documentation](https://mujoco.readthedocs.io/en/stable/modeling.html#contact-parameters).
This study is not yet connected to the visible model. Next: reconstruct matching
visible solids, fit them to the engraving, and validate interpolated playback
and the remaining assembly before replacing the existing animation.

The current qualification passes at 50 and 25 microsecond timesteps. Maximum
wheel-angle disagreement is 4.484e-5 radians. Neither active run shows backward
motion; disabling contact produces zero wheel rotation over 18 revolutions.
A 0.0005 contact margin on each geom now initiates contact before the surfaces
intersect; the recorded minimum gap is zero (the audit initializes its minimum
at zero), with no negative contact distances. This replaces the earlier
zero-margin study's small penetrations.

## Matching solids and contact bake

The standalone visible component has 20 meshes: 18 straight teeth, a hub and
a spherical tappet. Native/visible checks agree on all centers and tooth axes
and dimensions at five poses. No visual geometry is eroded to hide overlap.

The fine run's 144,001 recorded samples compress to 2,090 adaptive keys in a
42,116-byte gzip asset. Maximum angle error at the recorded samples is below
4.72e-7 radians. The finite 72-second adjustment clamps at its last key; it
does not wrap the screw nut back to its initial position.

The [baked clearance audit](validation/173-tappet-baked-clearance.json) checks
16,712 poses, including eight samples per key interval, against the actual
wheel mesh triangles. Its minimum conservative sphere-to-wheel gap is
0.0007462 model units. This remains a sampled check of the standalone contact
component, not a continuous or whole-assembly clearance proof.

Two [contact tests](../tests/movement-173-contact.test.mjs) pass, covering
native/visible transforms and dimensions, monotone playback and finite stopping.
The [bake report](validation/173-tappet-bake.json) records provenance and size.
The browser still uses the old complete assembly: source-fit reconstruction,
full-assembly clearance and integration of this bake remain the next work.
