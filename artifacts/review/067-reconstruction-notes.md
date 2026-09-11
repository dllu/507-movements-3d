# 067 · Scalloped gravity tumbler

067 is rebuilt, integrated and verified. All ten focused tests, 3,019 numerical
tests and 27 browser tests pass, along with the build. The integrated mesh
buffers and transforms exactly match the audited candidate.

The [official page](https://507movements.com/mm_067.html) describes the tumbler
E on a hollow shaft, driven by pin C on the worm-wheel shaft. Its animation
tab is unavailable; no official animation was watched. The inspected Brown
reference is PDF page 24, printed page 20, enlarged to 6000 pixels and cropped
at x1830/y3740, 1300×1150. Four inspected baseline frames, the original
factory, its exclusive helper and original test are preserved with hashes.

The replacement is a filled scalloped plate with a central bore, attached to
a sleeve with a half-cut end. It replaces the old annular sector, spokes,
white indicator, tall frame and round-wire worm. The plate sits in front of
the wheel and worm. This agrees with the drawing's hidden upper wheel;
the dashed central lower plate boundary is treated as an illustrative hidden
outline, rather than as a second physical layer. Grounded bearings and the
constant-speed motor are ideal constraints. The default source view has no
floor or fog; an oblique view exposes the axial separation.

## Source proportions

All components share shaft center (690,725) and scale 280/1.375 pixels per
model unit. Eleven cubic curves describe the scalloped boundary. A 0.425
bore and 0.22 thickness produce area 9.3115510, volume 2.0485412, unit-mass
centroid (0.2194782,0.9403326), and polar inertia 3.0201833. Green's theorem
on the extrusion's sampled boundary supplies runtime moments. Independent
3D tetrahedral integration verifies the actual Float32 component masses,
combined center of mass and rotating inertia.

The main shaft radius is 0.33; sleeve bore/outer radii are 0.35/0.475. The
finite pin is 0.145 wide, spans radii 0.325–0.55 and is 0.07 thick. Its offset
accounts for width and 0.00015 normal clearance at the collar's actual inner
corner. The plate, sleeve and collar are one rigid family; their integral
joins are allowed. Separate moving families must remain clear.

Three generated tooth-count candidates were fitted using the same 37 lower
wheel-boundary readings and one rigid phase adjustment. The 24-, 26- and
28-tooth RMS residuals are 6.287, 7.383 and 8.475 pixels. The selected 24-tooth
wheel has pitch radius 1.26923077 and phase offset 0.108646746. The solid
single-start worm has pitch radius 0.29728709, length 1.03125, center distance
1.56651786 and source axial offset -0.04910714. Its actual generated wheel
profile has 8,481 radius samples, not a spur approximation.

The inspected common-transform overlay contains 125 boundary readings and
two centers. Maximum/RMS pixel residuals in the 1300-pixel crop are:

| Part | Maximum | RMS |
| --- | ---: | ---: |
| Scalloped plate | 12.289 | 4.567 |
| Sleeve | 5.486 | 4.216 |
| Shaft | 2.111 | 1.299 |
| Wheel | 12.552 | 6.287 |
| Worm | 18.112 | 9.431 |
| Left worm shaft | 9.727 | 6.564 |
| Right worm shaft | 11.273 | 4.976 |

Both centers coincide by calibration. These are sampled manual boundary
comparisons, not exact whole-image registration. The drawing abbreviates
hidden teeth with dashed circles and uses irregular tooth and worm outlines.
Regularized teeth, constant wall thicknesses, component masses and resistance
are explicit reconstruction assumptions.

## Motion and contact evidence

The event-resolved solver integrates gravity and ground-referenced viscous
bearing/load resistance. This drag is not relative friction between the
moving shaft and sleeve. Uniform component masses are plate 1, sleeve 0.12
and half-collar 0.035; damping 2.8 is a model assumption. Release occurs when
the required pin reaction changes sign. Bisection locates each finite collar
impact within the integration step; the catch is perfectly inelastic and
includes motor work and impact loss.

Default release occurs at authored time 0.846767947 and catch at 8.535131046.
Peak forward/reverse speeds are 2.191453/-0.918141 radians per authored
second. Maximum lead 2.5529645 remains below the finite allowance 2.7234093.
Five damping cases include both collar ends in the undamped case. Time-step,
energy-rate, independent gravity-torque and repeated-cycle checks pass.
Default maximum energy residual is 2.13e-12; acceleration/torque residual is
9.38e-10. The 24-second displayed cycle keeps the worm at one revolution per
second; slower requested playback is honored.

The finite pin audit covers 81 engaged/impact poses and four impacts across
damped and undamped cases. Actual triangle witnesses give normal gaps
0.000150000849 throughout, positive compressive forces and impulses, correct
moment directions and common-motion contact velocities. Maximum normal
velocity residual is 4.16e-11. Contact is idealized across this small numerical
clearance, rather than allowing mesh penetration.

All ten component solids have positive volume, outward normals and paired
oriented edges. Degenerate zero-area triangles at clipped worm caps are
excluded from that topology audit. A 140-pose full-cycle and event sweep of
32 independent hardware pairs checks 353,680,248 surface samples with zero
penetration beyond 1e-6. The dense worm/wheel pair has a separate 65-pose
sweep: 83,952,830 samples, zero penetration, actual working-triangle gaps
0.000013997–0.000026917, positive driving moment, and maximum normal-force
power residual 1.20025%. These are finite sampled and tolerance-based checks.
Combined hardware and worm checks total 437,633,078.

Doubling generating phase/radial resolution from 1600/80 to 3200/160 changes
the wheel field by at most 3.56e-15. Common and enclosing centered worm
intervals give exactly the same 8,481 radii, confirming that the selected
axial shift and phase correction do not change the active sampled envelope.

## Validation and retained evidence

Ten focused tests pass, including actual solid mass properties, energy and
impacts, motion derivatives, convergence, finite pin forces, topology,
critical clearances, worm contact, playback and independent source readings.
Seven candidate views, their source overlay, and ten integrated source and
oblique frames have been inspected and hashed. The candidate frame labeled
catch at 8.5 seconds is just before the computed catch; the integrated
captures include both sides of the catch at phases 0.5433 and 0.544.
The full numerical rerun passed in 204.423 seconds (code 0, no signal). The
first numerical and build supervisors were terminated with observed tool
exit 143 before writing exit records; their logs and interruption records
are retained. The first Vite log reports a completed build, but it is not
counted as a verified process exit. The build rerun passed in 12.139 seconds (code 0, no signal). The 067
browser control test passed in 30.1 seconds, and its desktop/mobile frames
are inspected and hashed. The full 27-test browser invocation passed with code 0, no signal and no
retries in 960.355 seconds. Its all-507 canvas sweep passed in 7.9 minutes.
The 031 control test passed in 44.1 seconds and the 054 test in 43.4 seconds,
both within their 45-second limits. Earlier review screenshots overwritten
by fixed browser-test paths were preserved and restored; refreshed captures
from this run are retained separately under 067-browser-regression-captures.

The original model had 43.298563 unexplained free-flight energy gain and
required 92.186707 positive torque where gravity supplied only 0.00322434.
Its finite pin/collar baseline has 1,034 penetrating samples, depth 0.0529154,
including 36 poses labeled engaged. That baseline process exited zero for a
completed diagnosis, not mechanical acceptance. Original shape/motion studies
and all diagnostics are retained; the current candidate supersedes them.

See `067-reconstruction.json`, the named `067-*-exit-status.json` files,
`067-integrated-candidate-equivalence.json`, `067-capture-inspection.json`
and `067-verification-source-hashes.json`. 037 and 063 remain unresolved;
068 onward and the full 507-model review remain active.
