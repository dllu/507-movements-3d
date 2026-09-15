# Movements 181–182 — diagonal catch: review in progress

These two engravings show opposite stages of one mechanism. The
[source description](https://507movements.com/mm_181.html) says that the piston
tappet raises one valve handle, the diagonal catch transfers engagement, and
the opposite backweight opens the other valve pair. Both variants use the same
factory with different starting phases.

## Assembly repair completed

The [baseline sweep](validation/181-existing-solids.json), before this repair,
found 68 interfering mesh pairs among 60 meshes over 129 poses. Pivot shafts
passed through solid hubs and arm plates; both handles crossed each other in
the same axial plane. Outline tubes and contact markers added further overlaps.

The arm plates and hubs now have real 0.12-radius pivot bores around the
0.11-radius shafts. The upper and lower handles occupy separate inferred axial
layers at -0.12 and +0.12, with the catch at +0.40. The piston rod passes behind
them. Decorative outline tubes and floating motion/contact markers are removed.

The hanging rods now use bored eyes, hinge pins and retaining heads instead of
intersecting the weight arms. Their lengths follow the source rods down to the
bottom of the 181 plate, with the unillustrated weights beyond that cut. The
added engine frame and ground plane are removed. Fog remains disabled. Both
variants have front full-motion framing and exact Restart; the existing
18-second operator sequence is preserved explicitly.

The [current sweep](validation/181-current-solids.json) checks 50 meshes,
1,041 cross-body pairs and 10,772,814 finite-surface queries at 129 poses. It
finds **16 remaining intersecting pairs**, all associated with the tappet or
latch geometry. Pivot, separate-handle and hanging-rod interference has been
removed. The audit intentionally exits nonzero while these contacts remain.
This is sampled evidence, not a clearance certificate.

Four targeted tests pass: the two existing sequence tests and two new tests for
real bores, axial layers and retained weight-rod joints. The sequence tests
check the existing scripted equations; they do not prove the physical latch
works. Production build and [desktop/mobile checks](validation/181-browser.json)
pass for both variants, including playback, exact Restart, orbit/reset, no
horizontal overflow, no WASM request and no page errors.

## Remaining reconstruction work

- The tappet is oversized in X to follow a nominal roller point that moves
  sideways as each handle rotates. Actual contact must move along the curved
  handle profile. The current tappet penetrates several handle parts.
- The nearly closed circular latch pockets and their rollers collide with each
  other and with the catch backbone during transfer. Reconstruct the actual
  hook/handle contact surfaces from both engravings before validating release.
- The handle and catch angles remain prescribed. A native study should actuate
  the piston and let the weighted handles and catch respond to contact. The
  current analytic contact markers are insufficient evidence.
- The finite piston rod does not reproduce the engraved rod's sectioned extent.
  Source contour registration, rod representation and remaining hardware
  attachment need review. The new front view makes these differences clearer.

Continue with 181's tappet and latch reconstruction, then verify 182 with the
same geometry. Do not advance to 183 or mark either mechanism fully reviewed.
The full 507-movement goal remains active.
