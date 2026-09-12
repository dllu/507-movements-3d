# Movement 086: cam-released loose-wheel pump

Status: **initial source reconstruction and finite-contact study**. The
replacement is incomplete and unintegrated. Production remains at the 972-input
movement 085 checkpoint; the all-507 review remains active.

The [original description](https://507movements.com/mm_086.html) specifies a
continuously rotating shaft and cam C, a loose wheel A carrying a hooked catch
B, and a rope lifting a pump rod. A fixed overhead stop releases the catch;
the pump bucket's weight returns the wheel.

The native Brown engraving is extracted from PDF page 30, printed page 26,
at `[400, 1160, 1200, 1240]` in the 4814 × 6000 page image. The complete
mechanism and numeral are retained. `086-source-provenance.json` records
the original scan, page and crop hashes. Both the native crop and official
website image were inspected.

## Rejected baseline

All ten baseline views were inspected. The large central drum, rounded cam
and separate round contact pads do not match the source. The source has a
slender pointed cam inside a hooked catch, a broad pierced front bearing
standard and a wider wheel rim. The existing model also places its bearing
frame behind the wheel and adds a conspicuous bucket below it.

The finite diagnostic checks 58 visible meshes across 136 poses and 1,162
independent pairs. Among 18,820,946 surface samples, 588,297 penetrate another
family beyond 1e-6 world units. The worst conservative depth is 0.107027022,
between catch B and the cam body. Other failures include the shaft intersecting
the bearing legs and solid drum, rope intersecting the pivot stud and drum,
and the pivot pin lacking a proper catch bore. The wound tube has open ends;
it is sampled as a source surface but excluded as an interior target.

The analytic cam-contact error is only 2.29e-16, but its normal passes through
the shaft axis. Across 31 engaged poses, the maximum moment arm is 4.44e-16.
This frictionless contact cannot supply the clockwise torque needed to lift
the pump, whose prescribed rope drum requires a torque arm of 0.78 per unit
pump weight during constant-speed lift. An accurate distance between the
round pads therefore does not establish a working mechanism.

The animation also holds the rendered wound rope stationary while its reported
wound length changes by 1.078194599 model units. The baseline's shaft cycle is
8.055 seconds internally and two seconds after display scaling. See
`086-baseline-surfaces.json` and `086-baseline-captures.json`.

## Source measurements and core reconstruction

Bounded dark-stroke fits retain all readings and rejected outliers. The outer
wheel radius is 332.536114 pixels, from 103 accepted readings with 2.047617-pixel
RMS residual; the inner radius is 248.301996, from 76 readings with 1.656407-pixel
RMS residual. Their fitted centers differ by less than one pixel.

The front bearing fit has center `[614.539128, 613.582744]`, radius 55.438641
and RMS residual 1.145943 pixels. This center is adopted as the common shaft
axis. The shaft radius is 36.883412 pixels. The catch pin center is
`[346.236476, 596.590059]`, radius 13.252532 and RMS residual 0.510437 pixels.
The measurement overlay was inspected before adoption.

Manual contours at 240 source pixels per world unit reconstruct the hooked
catch, pointed cam, curved spokes, front standard and its rounded triangular
opening, overhead beam/post, trip stop and base. The initial candidate has
thirteen closed solids, independent wheel/cam/catch families, an ordinary
catch pin with a real bore, and clear shaft passages through the wheel and
fixed bearing. Hidden depths, cam root and spoke completion are assumptions.

All seven candidate views were inspected, including an exact source overlay,
front, rear, oblique and contact details. The principal contours closely follow
the source. These images qualify the initial geometry study only. Final
shadow styling and the small color fringe visible through the shaft bore
remain rendering details to assess with the complete assembly.

All 56 independent core pairs were screened at 34 prescribed diagnostic
poses, using 1,873,970 surface samples. No intrusion beyond 1e-6 was detected.
All thirteen meshes are closed with outward winding. The coupled sweep keeps
the relative catch/cam pose fixed and is **not solved contact motion**; it
does not qualify release, return or complete continuous clearance.

## First finite contact

The actual cam and hook cap triangulations and side faces form complete
constant-depth prisms. Rotating only the cam clockwise from the source pose
reaches the hook at -0.054910540 radians, approximately 3.146 degrees.
Independent cap intersection and boundary checks locate contact within
1.71e-9 world units. Both mesh normal cones admit the same compressive normal.

The resulting shaft-axis moment arm is **-0.860326372**, with negative denoting
clockwise torque. This remedies the baseline's radial contact geometry. The
catch-hinge moment arm is -0.207785264. A slightly advanced cam penetrates the
hook, while a slightly withdrawn cam clears it; both controls pass. This is
geometric seating evidence, not a force equilibrium or dynamic lift proof.
See `086-first-cam-seating.json`.

## Contact and pump dynamics diagnostics

The new studies solve wheel angle, absolute catch angle and, in the latest
model, independent pump height. Uniform mesh density supplies the wheel/catch
mass and inertia; normalized pump mass 1, gravity 9.81, a four-second input
revolution and zero drag are diagnostic assumptions. Signed tetrahedral
integration of 6,608 actual mesh tetrahedra checks energy and all three
momenta at 51 poses. Maximum energy/momentum errors are below 3.60e-14;
finite-difference Euler–Lagrange residual is 1.50e-10. This verifies formulas,
not the accuracy of a complete trajectory.

The original two-coordinate taut-rope trial is rejected: it requires negative
rope tension (-3.767439) and includes nine invalid reaction normals. Separating
the pump coordinate permits slack and positive tension, but an unlimited-wrap
rope plus a prescribed lower stop lets the wheel unwind indefinitely. These
trials and the nonlinear corner failures remain archived.

Two contact errors were isolated independently. First, using adjacent cone
rays for separated vertices creates forces across empty space. The rejected
eight-second corner trial contains 537 invalid reactions, with separation up
to 0.005740088. Multiple normals are now restricted to coincident corners;
separated points retain the actual closest-point direction. A two-circle
closure proposes a shared cam/hook corner only when the same nonnegative
mass-metric impulse solve reproduces that pose.

Second, discarding a penetrating trial feature because its normal is
inadmissible can hide a return collision. The current solver retains trial
escape constraints and independently rejects a negative raw boundary gap.
The historical bad return pose at 2.723 seconds has 0.008981260 penetration;
the new guard detects it. All 508 guard/control poses pass, with no falsely
clear penetrating poses. Final reaction normals still require independent
mesh checks; an escape constraint is not itself a qualified contact force.

## Finite attached rope and remaining motion failures

The new ideal rope has finite length 4.75 model units, an assumed rim pin at
the source pose's left tangent, and a vertical pump guide under that tangent.
The winding radius is 1.273079700, measured from the source axis to the visible
rope centerline. The rope can unwind, leave a straight free span, and wind
onto the opposite side; complete turns retain their winding count. The
source omits the attachment and bucket, so these details remain explicit
reconstruction assumptions. There is no prescribed pump stroke stop.

Independent polygonal length and finite-difference gradient checks pass at
805 poses across all three winding modes. Maximum length difference is
2.22e-8, and maximum derivative difference is 2.54e-9. Full turns consume rope
instead of accumulating unlimited slack. Rope and pump meshes are not yet
constructed.

The first finite-rope eight-second run passes all 11,395 reaction checks and
a 101-pose core screen with 6,119,084 samples. It is nevertheless **rejected**:
complete cap-triangle intersections at 16,181 knots/midpoints find 118 cam/hook
overlaps above the 1e-10 area threshold, with maximum area 0.000333301.
The 1 ms and 0.5 ms solutions also disagree badly: the conservative projected
mesh-displacement bound reaches 9.168 engraving pixels during engagement
and 1,123.758 pixels over eight seconds. Passing sparse surface samples and
individual forces did not establish working motion.

With the raw-gap guard, the latest three-second run contains 3,061 states.
All 5,264 reactions pass common mesh boundary, normal-cone and momentum checks;
maximum boundary error is 8.42e-10. The thirteen core solids and all 56
independent pairs pass 6,246,092 surface samples at 101 solved poses.
The denser 6,121-pose triangle screen still fails its strict area threshold
at 20 cam/hook poses. Maximum overlap area is 5.174001e-9, at an interpolated
midpoint at 2.7275 seconds. Shaft/hook and stop/hook pass that screen. Continuous
clearance and time-step agreement for the guarded solver remain unqualified.

The first polygon-union overlap audit failed while stitching almost
coincident output edges. Its exact script and log are preserved. The current
audit clips individual rendered cap triangles, whose interiors do not overlap,
and sums their intersection areas. Identical, clear, penetrating, shared-edge
and contained-triangle controls pass. This avoids the ring-stitching failure
without snapping or displacing the source geometry.

## Remaining work and checkpoints

Complete the rope attachment, winding geometry, pump load and stroke limit.
The two hatched horizontal runs behind the wheel appear to depict an input
belt; this is an inference from the engraving, whose text does not describe
their hidden pulley or return path. Those components and the rear bearing
remain to be reconstructed. They must not be treated as fixed support beams
without further justification.

Resolve the return, winding/attachment assumptions and repeated cycle with
the guarded finite-contact solver. Establish time-step agreement, energy
balance through impacts, continuous clearance and readable playback. Finish
the missing hardware and rendering, and integrate only after those checks,
then validate production.

`086-first-study-checkpoint.json` records the inspected evidence and frozen
study sources. All 972 production inputs, 71 current movement 083 sources and
43 current movement 082 sources remain unchanged. No production build,
full numerical-suite pass or integration pass is claimed for this study.

`086-dynamics-study-checkpoint.json` records current diagnostic sources and
verifies historical studies against their retained source snapshots. Earlier
solver versions are not represented as the current implementation. The 23
original core-study sources, all 972 production inputs and the unfinished
082/083 studies remain unchanged. No browser was launched for this dynamics
checkpoint, and no new visual or integration acceptance is claimed.
The initial `086-second-study-checkpoint.json` is superseded because it
classified editable review Markdown as immutable evidence; the corrected
checkpoint retains a separate Markdown snapshot.
