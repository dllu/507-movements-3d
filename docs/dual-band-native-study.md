# Movement 390: bounded passive coasting study

**Status: unqualified native candidate; production playback is unchanged.** The
finite contact correction in `dual-band-390-contact-review.md` remains the
browser model. Its prescribed short take-up dwell has not been replaced by an
arbitrary smoothing curve or an unvalidated physics bake.

The [original caption and engraving](https://507movements.com/mm_390.html)
describe opposite pulley-carried pawls driving a common flywheel to produce
continuous rotary motion. As established in the earlier source review, the page
has no `ae.add_model` or `mm_present` animation. The flywheel's inertia is the
natural candidate for carrying motion across finite pawl pickup.

## Native model and concrete corrections

`src/simulation/mujoco-dual-band/physics.js` reuses the corrected tooth outline,
curved pawls and opposed mounting phases. Its five hinges consist of two driven
carriers, two passive spring-biased pawls and one passive flywheel. Two carrier
position servos are its only actuators. Gravity and a viscous output load are
included. Closed triangular prisms decompose the ratchet outline; finite toe
cylinders and a conservative curved-arm capsule envelope provide contact.

This is a normalized reconstruction. The output mass/inertia (1 and 1.6 about
its shaft), pawl mass (0.003), torsion stiffness (0.03), spring offset (0.4 rad),
damping and contact softness are inferred. The carrier inputs preserve the
prescribed sinusoidal open/crossed law to within 0.000047 rad in the final runs.
The rendered source bands have not been changed.

The study corrected two concrete initialization defects: a carrier starting at
maximum speed against a stationary wheel, and a preloaded stop/flank pair inside
the virtual collision margins. Both could inject a large startup impulse. The
final model starts at a true reversal, with both pawls and wheel outside that
initial preload. Three tests check the actual actuator targets, passive joints,
initial contact distances, retained seating stops in the disabled-wheel control,
and proper MuJoCo allocation disposal.

## Controls and failed qualification

The final runs use MuJoCo 3.13.0, `implicitfast`, Newton contact solves, and the
same geometry/loads with steps of 0.000250 and 0.000125 seconds. Each runs for
24 seconds. Compact results and model hashes are preserved in
`src/simulation/mujoco-dual-band/study-results.json`; commands are in that
module's README.

| Measurement | 0.000250 s | 0.000125 s |
|---|---:|---:|
| Maximum carrier tracking error, rad | 0.00004473 | 0.00004663 |
| Minimum sampled native contact distance | +0.00066723 | +0.00079511 |
| Last-cycle output advance, rad | 8.949707 | 8.953351 |
| Last-cycle minimum output speed, rad/s | 0.681624 | 0.640175 |
| Last-cycle maximum output speed, rad/s | 1.961488 | 1.804818 |
| Final output angle, rad | 31.824689 | 30.979034 |

The flywheel does coast forward through every handoff, and the average advances
are close. However, final output angles differ by **0.845655 rad**; the maximum
same-time angle difference is **1.927979 rad**, maximum speed difference
**1.313367 rad/s**, and maximum pawl-angle difference **0.267595 rad**. The
pointwise gate fails. Similar cycle averages do not establish that the pickup
sequence or a repeating bake is reliable.

An earlier low-gain contact-disabled control produced exactly zero output
advance, while the contact-enabled model rotated. The apparently repeating
low-gain trajectory did not survive tightening carrier tracking; it was not
adopted. Those earlier full traces remain `/dev/shm/390-passive-*.json`, not Git
assets, and are not reported as final-model convergence evidence.

Saved final trajectories were also checked against the **actual visible solids**
at 1,601 post-startup poses (8–24 seconds) each, separately using native carrier poses and exact analytical
band-carrier poses. With exact band poses, minimum pawl/wheel clearance was
+0.00065343 in the nominal run and +0.00083440 in the half-step run; pawl/stop
clearance exceeded +0.00111. Thus the remaining qualification failure is not a
visible tooth intersection disguised by a proxy: the unresolved issue is the
step-sensitive pickup dynamics. These positive gaps include the conservative
contact margins and do not establish load transmission accuracy.

## Remaining work

Before baking, isolate the first divergent pickup and compare its toe/stop
normal impulses and energy balance, then establish timestep agreement for that
contact event and the resulting cycle. Investigate coupled contact/actuator
conditioning before changing masses or hunting for a visually convenient
trajectory. Any accepted bake must additionally retain the finite solid gaps,
exact band geometry, and a checked periodic seam. No live browser physics or
extra animation payload was introduced by this study.
