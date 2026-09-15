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

## Isolated tappet experiment

The [native contact study](validation/181-tappet-study.json), reproduced with
`node scripts/probe-diagonal-catch-tappet.mjs`, uses the current curved working
arms and a narrow shoe following source pixels 170–193. Only the piston is
actuated. Each weighted handle responds passively, with the existing end angles
used as inferred valve stops. The catch and the other handle are omitted to
isolate the drive contact; masses, friction and actuator force are assumptions.

Both handles jam before completing the stroke at timesteps 0.00025 and
0.000125 seconds. The lower test stops about 2.037 model units short; the upper
test stops about 1.592 units short. Halving the timestep changes the final
piston position by less than 0.000066 units. Thus merely narrowing the shoe
does not fix the existing handle contours and travel limits.

Two controls distinguish this from an input/solver problem. With contact
disabled, the shoe completes its stroke while each handle remains at its
gravity stop. Allowing 0.4 radians of extra driven handle travel also lets the
shoe pass at both timesteps. This extra travel is a diagnostic intervention,
not a source-fitted motion proposal. Without a catch, the handle then falls
back under its weight. All ten runs remain numerically stable; the control
assertions pass, while the original travel limits still fail the stroke check.

The next reconstruction must fit the working tips and weight arms jointly
against both engravings, with enough clearance for the finite shoe. Matching
the weight-arm angles alone has proved insufficient. Catch retention/release
must then be added to the passive study before considering a production bake.

Removed generation of unused outline tubes and an unused intermediate shape
from the production plate builder. Visible mesh geometry, indices, roles and
world transforms have identical SHA-256 fingerprints before and after this
cleanup. An alternating local [construction benchmark](validation/181-construction-cleanup.json)
measures median construction time of 112.36 ms before and 105.54 ms after;
this does not measure browser load time or frame rate.
The four targeted tests and production build pass. This cleanup does
not change the existing scripted contacts or resolve the 16 interfering pairs.

## Remaining reconstruction work

- The tappet is oversized in X to follow a nominal roller point that moves
  sideways as each handle rotates. Actual contact must move along the curved
  handle profile. The current tappet penetrates several handle parts. The
  isolated study now also shows that the current handle travel cannot clear
  a narrow shoe.
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
