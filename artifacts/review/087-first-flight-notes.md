# Movement 087: inertia, release and gravity flight

The isolated 213-part candidate now lifts, releases and falls under a unilateral
contact calculation. Both directions reach the opposite end of the lost-motion
slot. The shifter remains fixed during these partial trajectories, and the
calculation stops before the slot transfers momentum to it. This is progress
toward reversal, not a complete clutch simulation or a production replacement.
The candidate still moves both rod pins by 75 engraving pixels; that departure
from Brown's proportions remains unresolved.

## Mass and force model

Native triangle volumes supply an illustrative common-density mass model,
normalized to unit ball mass. Attached component volumes are added, including
overlapping attachment material. This is explicitly not a Boolean-union mass
calculation or a claim about historical dimensions, materials or speeds.

F and its quadrant, G, and the connecting rod form a single degree of freedom
with fixed rod length. Analytic derivatives provide the variable effective
inertia, gravitational potential and their derivatives. The shifter has a
separate inertia and potential for later work. The linkage's effective inertia
ranges from 4.48244 to 4.50298 in these normalized units.

Independent per-component geometry integrals and finite differences of the
actual rendered world transforms verify the aggregated linkage calculation at
129 poses. Maximum discrepancies are 6.40e-13 for potential, 2.43e-10 for
effective inertia, and 6.27e-10 for the gravity gradient. The unstable balance
point of the entire linkage is 35.7124 degrees of F travel, while the ball's
center passes vertical at 42.1490 degrees. The other component masses explain
this difference. The shifter's own unstable balance point is 3.5251 degrees
within its 7.6182-degree travel.

A prescribed-contact force screen uses actual native vertex/edge Hessians at
258 positions and five E speeds in each direction. Negative required normal
forces reject continued contact at those samples. The screen is not itself a
release solver: a polygon corner may cause detachment or impact between its
samples. Independent finite differences check the smooth-feature Hessians.

## Contact, release and free fall

The timed subsystem prescribes E at ±0.1 radians per illustrative time unit.
F/G/rod respond to gravity and compressive impulses from the actual polygonal
stud or the initial slot stop. Position transport and physical impact velocity
are projected separately. The model records input impulse work, plastic impact
loss and numerical energy defect. It does not prescribe a release angle or
force the linkage to remain attached to the stud.

The fast native contact query uses rotating calipers over the same polygon
axes as the previous exhaustive query. Its first check found matching gaps but
incorrect separated-pose gradients: the winning axis can belong to a polygon's
far edge, so its owner cannot be inferred from the near support's vertex count.
The corrected query tracks the axis owner. At 1,024 seeded full-angle poses,
gap disagreement is zero and maximum independent gradient error is 3.75e-9.
The failed result, log and exact source snapshots remain archived.

Five complete partial-trajectory studies reduce the time step from 0.001 to
0.0000625. The finest trajectories contain 81,671 forward and 93,580 return
states. Forward contact finally releases at about 3.85494 time units and
35.6869 degrees; the opposite nominal slot end is reached at 5.10437196 with
F velocity +1.66498804. Return finally releases at about 4.65344 and 35.6107
degrees, reaching its opposite nominal slot end at 5.84864315 with velocity
−1.16584564. The terminal angles are 76.3135 and 7.6182 degrees respectively.
The existing slot-circle fit leaves a 1e-6 world-unit margin, so these are
arrivals immediately before the actual slot impact, not solved impacts.

The return trajectory has brief facet-related losses and recoveries of contact.
Uniform velocity error across the recontact jump does not decrease like smooth
trajectory error. A separate five-level study refines the first 0.24 time units
down to a 0.00000390625 step. It resolves the first release near 0.000098 and
recontact near 0.2150703. The final two runs differ by 7.8125e-6 in recontact
time, 1.85e-6 radians in position and 2.55e-6 in integrated absolute velocity
error. This resolves the initial transient separately; the full partial-motion
preview continues to use the 0.0000625-step profile.

## Independent numerical checks

All 175,251 finest states pass the recorded momentum and compressive-impulse
checks. Maximum momentum residual is 2.50e-16, and there is no closing final
active-contact velocity beyond roundoff. The exhaustive native polygon query
independently checks 2,132 states, including contact transitions. Its gaps agree
exactly with the fast query; minimum gap is −7.89e-12. Active contacts stay at
least 0.562269 beyond the artificial upper-arm patch cut.

The finest signed/absolute energy defects are 0.02503%/0.06061% forward and
0.00839%/0.02893% on return. Absolute defects shrink by approximately half with
each step reduction. At common-clock samples, the last two full profiles differ
by at most 0.000209 and 0.048733 source pixels at the ball center. The return
position comparison is not monotonic across all levels because the first facet
event becomes resolved only at the smaller steps. These are comparisons of
supplied numerical trajectories, not exact continuum error bounds.

An independent RK4 integration starts at each last contact and follows the
final unforced flight. Its energy drifts by at most 4.62e-14. Compared with the
projection solver, maximum angle discrepancy is 1.09e-6 radians and maximum
velocity discrepancy is 0.000118. This validates the free-flight segment from
the supplied release state; it does not independently establish that release.

## Hardware and rendered review

All 213 solids retain valid topology. Sixteen time-selected poses include
lifting, both final releases, free fall, slot arrival, and the initial return
separation/recontact. Every pose considers all 18,971 independent rigid pairs.
Disjoint bounds and reused transforms exclude some pairs; the rest receive
24,409,000 bidirectional native surface samples without intrusion beyond
1e-6. Stud/G additionally uses the exact polygon query. Other pairs retain the
known narrow-edge limitation of sampling; continuous clearance is not claimed.
The rendered shifter stays at its intended fixed angle within 4.45e-16.

All twelve new still views are opened and inspected: eight full front views,
two oblique free-flight views, and two close return separation/recontact views.
The full hardware remains framed in the front and oblique views. The detail
views show the small initial gap and subsequent solid-tip contact. The source
comparison continues to show the changed pin positions.

Two separate browser previews play each trajectory at one illustrative time
unit per display second, stopping at its endpoint. They run at 21.11 and
21.48 fps on this browser, with 0.3 ms p95 model updates and no errors or
unexpected warnings. These 5.10- and 5.85-second previews do not form a repeating
cycle, and their speed is not a choice for the eventual complete mechanism.

Local evidence is indexed by `087-first-flight-checkpoint.json`:

- `087-first-inertia-check.json` and `087-first-release-forces.json` preserve
  the mass, gravity and prescribed-contact force screens.
- `087-first-fast-stud.json` retains the failed derivative check;
  `087-corrected-fast-stud.json` records the corrected query check.
- `087-first-flight`, `087-half-step-flight`, `087-quarter-step-flight`,
  `087-eighth-step-flight` and `087-sixteenth-step-flight` preserve summary
  JSON files and both compressed complete partial trajectories.
- `087-first-flight-check.json` records convergence, momentum, native gap
  and independent free-flight checks.
- `087-first-recontact-refinement.json` and its compressed trajectories
  resolve the initial return event at smaller steps.
- `087-first-flight-solids.json` records the surrounding hardware samples.
- `087-first-flight-rendered-captures.json` and
  `087-first-flight-rendered-inspections.json` record the twelve stills and
  two timed previews.

Next work must transfer momentum through the actual slot/follower and fork,
allow D and the output shaft to respond to loaded jaw contact, and connect the
two directions into a complete reversal. Source fidelity, continuous clearance,
full-cycle speed and production integration remain pending. The original 087
factories, all 1,097 frozen production inputs, and the 082/083 study inputs
remain unchanged. No new production build, full-suite test or all-507 browser
pass is claimed. The complete review remains active.

The subsequent [clutch-transition study](087-clutch-transition-notes.md)
now derives native slot/fork limits, includes eccentric output gravity, and
follows four independent coordinates through neutral travel to first jaw
contact. Both separately calculated jaw impacts reverse the shaft. Loaded
seating and a repeating cycle remain pending.
