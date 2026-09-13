# Movement 087: connected reversal and the following lift

The isolated key-friction candidate now continues from the previously tested
withdrawal states through neutral travel, the opposite jaw impact and loaded
seating. Positions, velocities and motor phase are not reassigned at those
joins. The same illustrative static/kinetic friction coefficients, 0.78/0.42,
native key clearance, component masses and output gravity remain in use.
Production and the unresolved source pin proportions are unchanged.

The previous [key friction study](087-key-friction-notes.md) initialized two
loaded states explicitly. This study follows each resulting reversal so that
later engagement and preload can emerge from its motion. It still does not
qualify historical material identity or a repeating full-cycle animation.

## Neutral travel and first opposite-jaw impacts

The five-coordinate withdrawal endpoints are copied exactly, including the
clock and cumulative work/energy ledgers. The earlier jaw remains a unilateral
constraint. A conservative bound derived from native front triangles excludes
the opposite jaw only while it is separated; full projected-triangle
intersections locate first contact. The shaft continues to respond to its
gravity torque and actual feather contact throughout neutral travel.

At time steps 0.00025 and 0.0000625, both branches reach the opposite jaw.
The finer runs contain 4,341 and 3,509 states. First-contact times differ by
0.00003978 and 0.00002853 model seconds; common-clock D positions differ by at
most 0.000028 units. All stored momentum, friction and contact-rate checks pass.
Sixty-six additional off-step native jaw pairs have minimum gap −5.99e-13.
The conservative bounds remain at least 0.005 units below the actual gaps at
these samples. Physical contact-work defects are 0.0000883 and 0.0001266 model
energy units.

The impacts reached from these states differ from the earlier independently
initialized four-coordinate study:

| Incoming branch | New jaw | Incoming shaft/D speed | Shaft/D speed after first impact | Immediate reversal |
| --- | --- | ---: | ---: | --- |
| CCW | Right | −0.027775 | −0.261115 | No |
| CW | Left | +0.230574 | −0.135516 | Yes |

On the first branch, the contacting flank initially drives D farther in the
incoming direction while the teeth move toward alignment. Reversal emerges
during subsequent seating. No desired output direction is imposed by the
impact solver. Native derivatives at three scales, compressive impulses,
momentum, impulse energy and full-solid contact witnesses pass; the witness
distances are below 3.7e-13 units.

## Native tooth profiles and the seated-corner failure

The right-hand impact reaches a different tooth from the previous seating
study. Its profile is measured directly over relative phases −14.237167 to
−13.837167, using 3,306 native queries and 750 retained knots. The native cusp is
at −14.136896329101, with maximum gap 0.000182700653 at D = 0. One-sided cusp
derivatives are checked separately so that a small chord error cannot substitute
for the correct contact-normal cone.

The left profile can be reused by adding exactly two complete rotations,
12.566370614359 radians. This is rigid-rotation equivalence, not assumed tooth
pitch symmetry. Thirty-three native parity samples agree within 3.9e-16 units.
The actual impact angle and its two nearby samples are inserted into the
750-knot profile. An independent early preparation and the final profile
generator produce identical left knots and cusp data.
The reused profile's inherited `cuspBracket` retains the original angular
frame; `fullRotationReuse.offset` maps it to the new frame. The solver uses
the shifted `peak`, knots and range, not that provenance bracket.

The two-jaw integrator retains both measured sides, using a conservative
separation bound outside available phase ranges. Unmeasured near-contact
phases stop the study. Sixty-eight earlier lifting, withdrawal and neutral
states reproduce the frozen one-jaw integrator: positions and energy agree
exactly, and velocity differences are below 2.8e-17.

The first left seating run fails a Newton position iteration at time 8.14748,
just before the native cusp. Its 11,360 valid states and source snapshots are
retained. The failure is numerical, not evidence of physical loss of engagement.
The solver now retries that specific iteration failure at smaller steps and
locates the earliest cusp arrival, including a landing that remains at the
cusp instead of crossing to its other side. Jaw velocity-contact tolerance is
reduced to 2e-12 to avoid treating a still-separated opposite flank as already
touching.

At the preserved failing state, four requested step sizes locate the event
within 5.5e-12 model seconds of each other. Positions agree within 1.3e-12 units;
momentum and impulse energy pass. The event stops the axial motion and allows
the shaft to leave its previously loaded feather wall while D matches the
engaged gear. There is no endpoint position snap.

## Loaded seating and shaft clearance

The refined runs contain 18,226 right-jaw states and 54,314 left-jaw states.
Each achieves the observed seated state and retains it for another quarter
model second:

| New jaw | Seated clock | Seating duration after first impact | Coarse/fine seated-clock difference | Engaged output speed |
| --- | ---: | ---: | ---: | ---: |
| Right | 7.013467 | 0.889001 | 0.00002935 | +0.120 |
| Left | 8.452040 | 3.144560 | 0.00048321 | −0.120 |

Both show real shaft/D clearance motion after the jaw corner is reached.
On the right branch the key briefly contacts its opposite wall, releases,
then loads the original wall. On the left branch the shaft moves freely after
D seats and later returns to the same wall without traversing the whole
clearance. The final matching shaft and D speeds are outcomes of those contacts.

Maximum common-clock differences are 0.0000159 radians for F, 0.0000296 units
for D and 0.0000932 radians for the shaft. Momentum, normal contact rates,
complementarity, Coulomb limits and impulse-energy identities pass. The chosen
friction mode's alternate contact sets agree in velocity within 1.4e-14.

Both full native jaw surfaces are queried at 65 interpolated off-step times
per branch. Maximum profile error is 1.58e-7, and minimum native jaw gap is
−1.58e-7. That measured interpolation error is retained explicitly. Other
native gaps reach only −7.3e-13. Absolute physical-velocity contact-work defects
are 0.0000750 and 0.0000724 model energy units. Small negative inferred contact
losses are at roundoff, below 4.5e-16.

## Held rotation and the next lift

The observed seated states are continued with the same equations through held
rotation and the following stud contact. No fresh key preload or input phase
is assigned. These runs use the coarser seated endpoints, so each full chain
has exactly matching joins rather than substituting finer endpoints midway.
They contain 54,760 and 47,992 states at a nominal time step of 0.001. Both
retain D through the next stud impact and another half model second of lift;
maximum axial withdrawal is 1.1e-19 units.

| Engaged jaw | Following stud contact | End of checked lift | Key state at the first recorded stud contact |
| --- | ---: | ---: | --- |
| Right | 61.521438 | 62.022438 | Upper wall has just unloaded; shaft/D angle difference +0.006198 |
| Left | 56.192773 | 56.693773 | Free between walls; shaft/D angle difference −0.005281 |

While the right jaw holds, the key unloads at 14.697438, reaches its lower wall
at 15.752438, unloads at 46.255438 and reaches its upper wall at 47.287438.
The next stud impact releases it again. While the left jaw holds, it unloads
at 24.399773, reaches the lower wall at 25.431773 and unloads at 55.749773,
before the next stud arrives. It reaches the upper wall at 56.288773 during
the following lift. These are discrete recorded event times, not exact roots.

The latter branch therefore cannot reuse the earlier explicitly initialized
upper-wall preload at its next stud contact. Its shaft is still moving inside
the native clearance when that contact occurs. The state-continuous model
keeps that transient and the changing gravity torque from E's eccentric stud.

All 102,752 held/lift states pass fresh mass, force, momentum, normal-rate,
complementarity and friction checks. Seven unloaded-shaft intervals are also
integrated independently using fourth-order Runge–Kutta and only the native
shaft inertia/gravity equation. Maximum angle and speed differences are
0.0000213 radians and 0.0000375 radians per model second; the independent
energy error is below 5.8e-15. The coarse physical contact-work defects are
0.001617 and 0.014942 energy units over the two long continuations.

Four-times-finer local replays cover the following stud contact and lift.
The right-jaw branch agrees within 0.000045 lever radians and 0.000129 shaft
radians, with a 0.0005 difference in the recorded first-stud clock. The left
branch initially **fails** the 0.005-radian coordinate-difference check:
its lever transient differs by 0.011431 radians (0.655 degrees), although
its final lever position agrees. This failed report and its original source
are retained. Endpoint agreement alone would have missed the discrepancy.

Two additional local refinements start at exactly the same recorded held
state, preserving its global clock and key clearance. At steps 0.000125 and
0.0000625 they contain 6,418 and 12,834 states. Successive lever differences
fall to 0.00005884 and 0.00002941 radians (0.0034 and 0.0017 degrees).
Both record first stud contact at 56.192648, and final positions agree with
the coarser path. Their physical contact-work defects decrease from 0.002290
to 0.001026 energy units. Momentum, friction, contact rates and impulse energy
pass; 33 off-step native jaw pairs per level have minimum jaw gap −1.6e-15
and minimum other gap −1.2e-10. The preceding long held interval has not been
recomputed at these finer steps.

## Hardware and rendered review

All 213 native solids pass the closed-solid topology checks. Sixteen poses
cover neutral travel, first opposite-jaw contact, loaded seating, the cusp,
settled holding, key clearance and the following lift in both directions.
Each screens 18,971 independently moving part pairs, with 24,169,044 total
bidirectional surface samples and no intrusions above 1e-6. Native jaw,
slot, fork, key and stud checks supplement those samples. Minimum jaw gap is
−1.363e-7, within the measured profile interpolation error; coupling/stud gaps
are at roundoff. The surrounding-hardware screen retains its narrow-edge and
between-pose limitations.

Ten final stills are opened and inspected: six front/source comparisons,
two whole-mechanism oblique views and two seated-jaw details. The front and
oblique views contain the complete wheels and linkage. The details show the
seated zigzag boundaries and fork shoe in the central groove. A narrow bright
strip remains visible on the upper left loose-jaw surface in its detail;
final rendering polish is not claimed. The 75-pixel pin adjustments remain
visible in the source comparison.

Four inspection previews complete at four times slower than model time,
with 21.5–23.6 frames per second and a 0.2 ms 95th-percentile model update.
There are no browser errors or unexpected warnings. The following left-jaw
lift preview uses the finest local continuation; the stills use the sixteen
screened hardware poses. The long held intervals remain in the numerical
reports and are omitted from these short previews. Every animation frame
has not been manually inspected, and final playback speed is still open.

## Evidence and reproduction

The local checkpoint is `087-connected-reversal-checkpoint.json`. It hashes
the reports, editable-source snapshots, retained failures and inspected
images, rechecks all 1,097 production-baseline inputs and preserves the earlier
082/083/087 study inputs. Bulk outputs remain outside Git; the scripts and
this interpretation are committed.

The main sequence is `study-weighted-clutch-key-neutral.mjs`,
`study-weighted-clutch-key-jaw-impact.mjs`,
`study-weighted-clutch-key-seating-profiles.mjs`,
`study-weighted-clutch-key-seating-events.mjs` and
`study-weighted-clutch-connected-key-lift.mjs`. These consume the previous
key-friction study's exclusive outputs. `PROBE_DT` and distinct `PROBE_PREFIX`
values select the finer runs. `check-weighted-clutch-connected-lift.mjs`
accepts individual branch reports through `PROBE_REPORTS`; its coarse CW
comparison deliberately remains a failed historical result. The subsequent
`study-weighted-clutch-next-lift-refinement.mjs` supplies the qualified local
comparison. Hardware, capture and checkpoint scripts use the
`weighted-clutch-connected-reversal` suffix. Use `TMPDIR=/dev/shm` for the
capture, with the existing Vite server at port 5174 and one owned browser.

The 75-pixel rod-pin adjustments remain a visible source-proportion departure.
Historical retention details, complete repeated reversals, continuous rendered
clearance, final display speed and production integration remain unresolved.
The all-507 goal remains active.
