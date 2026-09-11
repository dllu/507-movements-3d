# 072 · Four-lobe tilt hammer

The replacement is integrated and verified in production. All sixteen focused
tests, 3,050 numerical tests, the build and all 31 browser tests pass.
The [official page](https://507movements.com/mm_072.html) specifies four lifts
per input revolution and marks its animation unavailable. No official animation
was played. The enlarged Brown reference is PDF page 26, printed page 22,
scale-to 6000, crop x910/y2580/1910×1260. The source and overlays are inspected.

The baseline has 3,990 penetrating samples in 38,555,868 actual surface checks
over 267 poses and eight working-part pairs. The cam enters the hammer body
during the fall; the beveled hammer underside enters the anvil face. Eight
baseline frames, the original factory/test, HTML and source images are retained.
The baseline's authored period is one lobe interval, not a complete input turn.

The replacement follows the shaped hammer, striker, curved workpiece, anvil
and socket. The upper-right cam flank fits a circular arc with 0.612-pixel RMS
and 2.023-pixel maximum error across 42 measured rays. The first two rays of
the original fit hit the adjacent straight step and are explicitly excluded;
that original fit and inspected diagnostic overlay remain available.

Four repeated circular flanks and finite radial steps drive a rounded fixed
nose. Exact circle/line contact intersections determine the hammer's travel
limit. The hammer follows the flank and tip while the normal force is
compressive, then falls under gravity and strikes the workpiece. The landing
angle follows from contact between separately traced polygons. Pickup and
landing are inelastic; the regulated input can absorb energy near release.
Uniform density, rigid parts, a fixed rear pivot pin and negligible bearing
friction are explicit assumptions. Workpiece deformation is not modeled.

The blind pivot bore accepts a fixed rear pin and leaves its front face closed.
Rear supports are included in the full hardware audit. The anvil top is moved
eight source pixels upward to support the workpiece. The ground helper is
hidden; the source foundation is actual geometry. Each displayed lobe cycle
takes three seconds, giving four blows in a twelve-second input revolution.

All fifteen solids pass topology checks: 83,168 triangles, positive volumes,
consistent normals and paired edges. The 146-pose sweep covers all 68 moving
part pairs and **392,126,508 actual Float32 surface samples**, with no
penetration above 1e-6. These are sampled checks, not a continuum proof.

All **192 actual contact-force cases** pass, covering four lobes, four
workpiece seats and both sides of the flank/tip join and crest. A repeated-cycle
pickup classification failure is preserved and corrected by snapping exact
event times. The physical normal-cone checks allow signed motor work and
require nonnegative contact reaction under the hammer's actual acceleration.

Independent tetrahedral integration of the rendered hammer matches modeled
volume to 1.99e-8 relative error and polar inertia to 7.98e-9. Three fall-step
sizes agree on landing and conserve free-fall energy to about 9e-15. The full
cycle's energy residual is 3.17e-9 per unit mass. An earlier 1.17e-5 residual is
preserved; it came from averaging acceleration across a curvature change.
Differentiating on the active surface resolves it without changing the motion.

The common source projection covers 169 readings with a largest error of
14.388 pixels in the 1910-pixel crop. Manual readings also guided construction;
the inspected actual-mesh overlay shows the resulting fit. Nine 3D candidate
frames and the source overlay are inspected. A capture interrupted by browser
navigation is retained; the next invocation completed in 7.197 seconds.

The browser runtime uses exported source contours, exact circle-contact
equations and 1,245 converged gravity knots. It performs no startup polygon
union or numerical integration. All fifteen mesh buffers match the saved
candidate checkpoint. Nine inspected transforms and 10,076 positive and
negative-time poses agree with the candidate; the maximum angle difference
is 7.55e-15. Closed-form runtime acceleration differs from the candidate's
finite-difference calculation by at most 1.30e-7. An initial exact-join branch
mismatch and its failed equivalence report are preserved.

The registry now selects the rebuilt model. The obsolete hammer factory is
removed, the movement-353 comparison uses the new actual striker geometry,
and movement 072 has dedicated numerical and browser checks. Its source pose
is public time zero. The engraving-shaped model, pickup, lift, flank/tip join,
crest, release, fall, landing and dwell are inspected in eleven integrated
views, including oblique and rear views. Desktop and mobile controls are
inspected. The mobile notes panel scrolls; a separate screenshot confirms that
the full correction remains reachable.

Verification completed with sixteen focused tests in 3.029 seconds, 3,050
numerical tests in 196.956 seconds, the production build in 35.980 seconds,
and 31 browser tests in 1009.855 seconds. The browser run uses one worker and
no retries, and renders all 507 movements. All 785 verification source files
still match their hashes. Sixteen previously inspected UI images are restored
from checked backups; the newer regression captures are separately archived.
The production bundle-size warning remains; it does not fail the build.

037, 063 and 071 remain mechanically unresolved. Movement 073 has a failed
baseline and an isolated source study; its reconstruction and the complete
507-movement review remain active.
