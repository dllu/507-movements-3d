# Movement 180 — single-jaw bench clamp

The browser now plays a six-second baked MuJoCo cycle with one passive jaw,
a fixed side-piece and a board driven vertically. The jaw is no longer rotated
by an independent animation track while separated from the board. The
[original page](https://507movements.com/mm_180.html) identifies this as the
single-jaw counterpart of 174 and has no available 2D animation.

The board's leading corner turns the jaw into its clamping position. The lower
lobe and fixed side then constrain the board. Withdrawal releases the load;
subsequent insertions require only a small jaw rotation. The old repeated
nine-degree opening exaggerated that motion.

## Native contact and assumptions

The [push study](validation/180-native-study.json) actuates only board Y, with a
force limit of 10. Board X remains free, against the fixed side; its orientation
is held to represent operator guidance. The jaw has an ideal hinge and damping.
Frictionless contact and a higher-friction control both clamp the board.
Disabling contact leaves the jaw at its initial angle and lets the board pass.

Friction, inertia, drive force and damping are reconstruction assumptions. The
playback uses friction 0.2. Higher friction produces more sensitive stick-slip
history, so its timing should not be treated as measured historical behavior.
The source establishes the mechanism and profile, not these dynamic parameters.

The [cycle study](validation/180-native-cycle.json) compares 0.125 ms and
0.0625 ms timesteps over three withdrawal/reinsertion cycles. For the final
cycle, maximum timestep differences are 0.000287 radians in jaw angle,
0.000172 world units in board X and 0.000091 in board Y. Successive cycle
positions differ by at most 0.000330 world units. No negative native contact
distances were recorded, with a small contact margin enabled.

The fine cycle's endpoint position differences are below 0.00000155 world
units and its speed differences below 0.000146. The bake closes that microscopic
seam exactly and includes the adjustment in its measured interpolation error.
The native jaw uses convex pieces of the same smooth outer profile as the
visual model. Its pivot hole is omitted from collision geometry because the
board never approaches that bore. Displayed hardware is checked separately.

## Geometry, source fit and playback

The replacement has 16 solid meshes, true pivot and fastening bores, washers,
and recessed screw-head slots. It removes penetrating outline tubes and contact
markers. The fixed side and jaw occupy separate axial layers where the dotted
jaw tip passes behind the side-piece. Unillustrated bench supports are sectioned
away. Ground and fog are disabled, and the initial view faces the engraving.

The upper jaw outline is corrected from measured raster bands; its old trace
had a visible inward bump. [Eleven selected source features](validation/180-source-fit.json)
fit within 3.25 pixels in the initial front projection. This is a sparse feature
check, supported by visual comparison, rather than full contour registration.

- [Bake](validation/180-bake.json): 661 adaptive keys, 291,030 compressed bytes,
  maximum sampled interpolation error below 0.000005, including loop closure.
- [Assembly sweep](validation/180-assembly-clearance.json): all 16 meshes,
  29 cross-body pairs, 129 poses and 2,587,740 finite-surface queries;
  no sampled intersections.
- [Dense contact sweep](validation/180-dense-contact.json): 2,641 poses and
  10,463,642 surface queries for jaw/board and fixed-side/board;
  no sampled intersections. These are sampled checks, not continuous proof.
- Two production tests check source screw positions, actual bores and slots,
  finite transforms, the complete cycle and exact Restart.
- Production build and [desktop/mobile checks](validation/180-browser.json)
  pass playback, exact Restart, orbit/reset, no overflow, no WASM request and
  no page errors. Runtime uses the compressed bake, not live simulation.

The retained legacy factory is used only to obtain the original tracing and
historical comparison. Its [baseline](validation/180-existing-contact.json)
contains nine interfering mesh pairs and 51 sampled poses with prescribed jaw
motion despite a positive nominal gap. The browser loader selects the new bake.

Next: movement 181. The full 507-movement review remains active.
