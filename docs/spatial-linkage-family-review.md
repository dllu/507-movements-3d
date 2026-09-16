# Combination drive, feathering wheel and detacher: 261, 489, 492

This pass corrects finite joints and visible support geometry while preserving the existing prescribed laws. This pass originally left 492’s tongue/tackle handoff unresolved. The subsequent [492 contact correction](boat-detacher-contact-review.md) resolves interpenetration and qualifies locked capture plus a continuous prescribed release; passive force/timing remains unvalidated.

## Primary references

- [261](https://507movements.com/mm_261.html): crank-driven rocking arm carries a pulley while a drum takes up cord, producing unequal weight strokes. No official animation is available. The existing winding-and-return demonstration is retained; the return resets the finite display instead of claiming Brown's continuously winding machine reverses in service.
- [489](https://507movements.com/mm_489.html): a loose ring rotates around a fixed eccentric, and equal-offset cranks keep the paddle buckets upright. The official canvas was opened and viewed; its clockwise equal-phase ring/main rotation and upright bucket orientation agree with the retained analytic parallelogram law.
- [492](https://507movements.com/mm_492.html): paired boat-fixed standards, hinged tongues, release levers and tackle hooks. No official animation is available. Brown supplies a locked view and release order, not a force solution or automatic reattachment.

## Changes

**261:** Constant-length bored rods replace solid eyes, including the intermediate pin on the long rocking arm. The connecting rod moves in front of the drum, with pins long enough to reach both working layers. Pulley and drum body radii now allow for the finite cord radius, and the helical lay pitch exceeds the cord diameter. The weight's eye now attaches to its body; the base stops short of the weight's vertical path. The constrained cord-length solution is retained, with its take-up radius updated consistently for the slightly increased helical pitch.

**489:** The control ring now has a real annular seat around the eccentric at the same axial station, replacing a torus floating radially and axially away from its bearing. The fixed eccentric has an off-center main-shaft bore and an annular support to the front bearing. Bored crank eyes run on finite pins. Cranks sit between the main and control-arm planes, so neither set of pins crosses the opposite arms at the horizontal configurations. Buckets sit behind the main arms; blind axle passages and rear webs preserve blade connection while clearing the pivot axles. Crank bosses meet the crank plate without overlapping visible faces. Exact upright orientation and ring/main phase remain unchanged.

**492, qualified portion:** Bored forged-link plates replace solid hinge eyes. The upper closed eye is transverse to its tongue end, so it slides off along the end rather than crossing a trapped Z-axis pin sideways. A short offset neck attaches that end to the tongue while leaving the eye's sweep clear. The original conservative projected separation threshold remains only a staging rule; it is explicitly not a unilateral-contact or force solve. The model metadata now records the unresolved tackle handoff.

All three hide generic ground and disable fog; full-cycle bounds and more frontal views expose the working interfaces.

## Validation

`node --test tests/movement-261.test.mjs tests/movement-489.test.mjs tests/movement-492.test.mjs tests/spatial-linkage-solids.test.mjs`

**27/27 tests pass.** The three new finite-surface tests inspect the named working pairs over 65 poses (129 for the detacher latch): rod/axle/drum clearance for 261; ring/eccentric, crank/pin, opposite-frame pin clearance and blind bucket bores for 489; and eye/tongue-end/offset-neck plus pivot bores for 492. They inspect rendered triangles independently of the mechanism's closure metadata. They do not qualify the unresolved tackle-hook contact.

Official and local screenshots and the cheap CPU screen are RAM artifacts under `/dev/shm/spatial17-*`, not Git dependencies. The final browser review reported no errors or full-cycle clipping: 17-pose maximum projected extents were 0.809/0.884/0.843 for 261/489/492. The cheap CPU screen found zero scene growth or new playback geometry, with update P95 of 1.571/0.079/0.057 ms respectively (machine-specific; excludes imports and GPU cost).

## Residuals

261 retains prescribed disk timing and a numerically solved inextensible centerline. No friction, load response or multilayer spooling is simulated; its periodic return is a demonstration reset. 489's hydrodynamic numbers and water-flow markers remain illustrative drag estimates, not validated fluid dynamics or propulsion performance. Its source-level geometric upright-bucket law is exact.

The original 492 hook/tongue residual recorded in this pass is superseded by the [contact follow-up](boat-detacher-contact-review.md): locked capture and finite release-path clearance now qualify. Load transfer, friction and passive release timing still require a dynamics study; automatic reset is not claimed.
