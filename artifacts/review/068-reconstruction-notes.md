# 068 · Single-tooth self-locking index

The replacement is rebuilt, integrated and verified.
It uses the engraving's ten-notch wheel and a substantial tapered tooth,
with six solid parts, short shafts and no added framing or face indicators.
The default input cycle is four seconds; the indexing stroke lasts about
0.476 seconds. Ground and fog do not obscure this model.

The [official source](https://507movements.com/mm_068.html) was inspected in
six live animation frames and nine controlled phases. Its animation advances
one notch per input turn and locks between steps, but its prescribed angular
interpolation is not independent mechanical proof. Production contours were
reconstructed from the public-domain Brown engraving, not copied from the
proprietary animation. The Brown crop is PDF page 24, printed page 20,
x3150/y3740 at 6000-pixel page scale, with dimensions 1450×1150.

## Source fidelity

One common image transform uses driver center (334.883, 571.801) and
326.461 pixels per 1.36 model units. Maximum/RMS boundary errors are
8.762/3.849 pixels at 19 driver-circle readings, 10.525/4.234 at 12 tooth
readings, 28.744/9.049 at 20 output tips and 14.689/8.160 at ten notch
roots. The output pattern is made regular; the irregular top notch accounts
for the largest tip departure. These sampled outline measurements do not
claim exact registration of the entire engraving.

Ten integrated front/oblique frames cover entry, indexing, disengagement and
dwell. They and the source overlay have been visually inspected and hashed
in `068-capture-inspection.json`. Exact geometry buffers connect production
to both the current mechanical candidate and the previously topology-audited
shape. Ten sampled pose transforms match the current candidate exactly.
The older overlay remains valid because geometry and the initial source pose
are unchanged; historical moving candidate frames do not verify the new path.

## Mechanical model and evidence

The wheel follows its actual finite surfaces against a resisting load.
Fixed bearings, uniform input rotation, bearing resistance and engagement
impacts are idealized. This is a quasistatic mechanism model; finite inertia
and unloaded coasting are not certified. The product note states its load
and impact assumptions.

The driver radius is 1.36, center separation 2.72, wheel stock radius 1.417
and plate thickness 0.24. Ten U notches have radius 0.12 and root radius
1.217. Circular locking hollows have radius 1.36015. The traced tooth's
trailing relief is widened by 0.08 radians and trimmed to the nominal rim.
The six rendered components have outward closed triangle meshes, positive
volumes, consistent stored normals and no unmatched edges or degenerate
triangles (`068-trimmed-solids.json`).

The constrained projection checks the dense driver boundary and forty
sharp output mouth/locking corners against the complete opposing contour.
Angular searches use conservative bounds. Refinement from 3,201 to 6,401
poses changes matched output angles by at most 6.578e-8 radians; peak speeds
are 1.95170143 and 1.95170191 rad/s. An explicit contact-entry knot at
0.524092052 authored seconds prevents early drift during dwell. The small
cycle-closure residual is -1.792e-7 radians at the 1e-7 contact threshold.
One full input turn advances one 36-degree pitch, with bounded seam error.

The final 83-pose sweep covers all nine independently moving solid pairs:
**42,701,508 actual Float32 surface samples have no penetration above 1e-6**
(`068-event-hardware.json`). Separate locking tests cover both load directions
at all ten notches. All twenty seated poses clear, and an extra 0.001 radian
into either flank produces an actual penetrating witness, as required to
establish a stop. Those allowed/intentional-overtravel checks total 4,341,240.
The total angular locking play is 0.000535737 radians, about 0.0307 degrees.

The bidirectional contact audit accepts compressive force directions in the
physical normal cones of both actual Float32 contours. It passes all 136
active driving poses and twenty locking poses within the 164-pose study,
with positive output torque and the specified 1.5% power tolerance. These
are quasistatic contact checks, not a finite-inertia impact simulation.
See `068-event-drive-and-lock-cones.json` and `068-event-locking.json`.

## Preserved failures and verification

The old eight-notch model had 330 penetrating samples in its 200-pose,
3,794,400-check baseline. Its four inspected images are preserved as
`068-original-phase-*`; its factory, test and shared helpers are archived.
Helpers still used by movement 069 remain intact.

Earlier round-head and constant-ratio candidates were rejected for shape
or incomplete contact evidence. An initial one-direction projection missed
sharp output corners and failed with 62 penetrations, maximum depth
0.0009919765. Those failures and 26 inspected historical candidate images
remain archived. Adding the exact output corners resolved that sampling
failure; the explicit entry knot and finer motion table resolved the final
contact-force failures. The earlier edge-only screen did not test corner
normal cones, so its missing witnesses are not proof of impossibility.

All seven focused tests and **3,026 numerical tests pass**, with no failures,
skips or cancellations. The numerical invocation exits zero in 227.190 seconds;
the build exits zero in 12.644 seconds. All **28 browser tests pass** with one
worker and no retries, including all 507 canvases and the new 068 controls
test. The browser invocation exits zero in 970.409 seconds. Desktop and
390×844 mobile captures are inspected and hashed, bringing the accepted
integrated/overlay/UI views to thirteen.

The 770 source, data, test and configuration hashes saved before full
verification remain unchanged. Earlier inspected browser captures for 031,
062, 065, 066 and 067 are restored at their original paths; the ten fresh
regression captures are preserved separately. The gallery has 314 comparisons
at the 068 checkpoint, including six existing crossed-view frames now included
by the gallery matcher. See `068-reconstruction.json` for exact commands,
exit statuses, hashes, qualifications and acceptance guards.

The overall 507-movement review remains active. Movements 037 and 063 remain
mechanically unresolved, and the source/contact baseline review of 069 is
underway.
