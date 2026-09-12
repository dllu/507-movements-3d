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

## Remaining work and checkpoint

Complete the rope attachment, winding geometry, pump load and stroke limit.
The two hatched horizontal runs behind the wheel appear to depict an input
belt; this is an inference from the engraving, whose text does not describe
their hidden pulley or return path. Those components and the rear bearing
remain to be reconstructed. They must not be treated as fixed support beams
without further justification.

Resolve wheel/catch motion from finite contact, gravity and pump loading;
check the actual stop face, release and return. Establish force feasibility,
time-step agreement, continuous clearance and readable playback. Finish the
rendering and integrate only after those checks, then validate production.

`086-first-study-checkpoint.json` records the inspected evidence and frozen
study sources. All 972 production inputs, 71 current movement 083 sources and
43 current movement 082 sources remain unchanged. No production build,
full numerical-suite pass or integration pass is claimed for this study.
