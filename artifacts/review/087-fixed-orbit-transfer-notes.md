# Movement 087: connected reversal and following lift with the fixed orbit

Both fixed-orbit branches now continue from the previously checked initial
lifts through gravity-driven fall, slot-end actuation, clutch withdrawal and
opposite-jaw contact, loaded seating, held rotation and the following stud
encounter. Continuations preserve the integrated state and input clock;
physical jaw impulses change velocity at fixed position. The new geometry
remains an isolated candidate. Repeated full cycles, source acceptance and
final integration remain unresolved.

## Transfer and time-step comparison

Each branch starts at the exact stored half-time-unit endpoint of the prior
fine initial lift. Five independent coordinates describe F, the shifter,
axial D travel, shaft spin and D spin. Native feather clearance and the
illustrative static/kinetic friction values 0.78/0.42 remain active. No new
preload, motor phase or output speed is assigned.

The coarse and fine steps are 0.001 and 0.0005 model time units. The fine
transfers contain 13,248 clockwise and 10,609 counterclockwise states.

| Event | Clockwise | Counterclockwise |
| --- | ---: | ---: |
| Weight crosses vertical | 4.7095 | 4.8680 |
| Far slot end begins carrying load | 6.7970 | 5.5680 |
| Withdrawal reaches 0.002 units | 6.8015 | 5.5710 |
| First opposite-jaw contact | 7.123458 | 5.803899 |

Times continue the original model clock. Clockwise D stays at its original
axial position until the far slot end engages. Counterclockwise D drifts
0.000010535 units beforehand, or 0.00316 source pixels. This small drift is
retained, not clamped away; the coarse result is 0.000010501 units. Substantial
withdrawal follows far-slot engagement in both directions.

Every stored fine time within the overlapping trajectories is compared with
the coarse result. The largest coordinate differences are 8.94e-5 radians
on the clockwise shaft and 3.31e-4 radians on counterclockwise F. First
opposite-jaw contact times differ by 0.000056 and 0.000199 time units.
The tested event-time differences are all at most 0.000501.

Independent momentum, free-acceleration, complementarity and friction-law
checks pass at every stored fine step. Absolute physical contact-work defects
sum to 0.00732 and 0.00965 in illustrative model energy units. These finite
discretization defects are reported rather than interpreted as exact energy
conservation.

## Free fall and native clearance

After the stud releases and before the far slot becomes loaded, a separate
fourth-order Runge-Kutta solver integrates F/G/rod motion using only the
previously checked native inertia and gravity. It has no stud, slot, jaw or
key constraints. Its internal energy drift stays below 5.69e-14. Fine contact
trajectories differ from this independent free fall by at most 1.30e-4 radians
and 0.000681 radians per model time unit. The differences roughly halve when
the contact solver step is halved.

Both exact native jaw fronts, the stud and the other coupling gaps are checked
at 33 deliberately interpolated off-step times per branch. Minimum gaps remain
above -6.46e-10 world units. The fast and reference stud queries agree at all
these samples.

Twelve full-solid poses cover middle lift, over-center motion, the instant
before far-slot loading, initial withdrawal, neutral travel and first new-jaw
contact. Their 18,417,750 bidirectional surface samples find no intrusion
beyond 1e-6. Discrete surface and off-step checks do not establish continuous
clearance over every instant or every narrow edge intersection.

## Opposite-jaw impacts and query optimization

First-contact jaw normals come from three independently sized finite
differences of the native triangle-intersection gap. The resulting impulses
pass momentum, energy and full-solid witness checks. Neither first impact
immediately reverses the shaft. D initially changes spin independently while
the shaft is clear of the loaded key wall; subsequent key contact and jaw
seating must be integrated to determine reversal.

The first profile measurement was intentionally stopped after 3,829 completed
native queries when a faster exact query had been verified. Its journal,
source snapshots and exit status 143 are retained. The continuation reuses
those completed measurements. No partial profile is accepted as complete.

The optimized query retains the same triangle intersections and affine gap
definition. A pair is skipped only when the larger of its two whole-triangle
gap minima exceeds the best measured gap plus a roundoff cushion. That is a
conservative lower bound on the minimum over their intersection. Across 142
queries spanning both sides, two full turns, axial shifts and the new impact
and cusp neighborhoods, gaps and witnesses match the reference exactly.
This local timing is 26.29 seconds versus 6.14 seconds; it is not a general
performance guarantee.

## Rendered transfer review

All fourteen transfer stills are opened. They show the weight crossing
vertical, the stud separating during the fall, the follower reaching the far
slot end, D passing through neutral and the new jaw reaching first contact.
The two oblique endpoint views make the weight/gear and rod depth ordering
visible. No new obvious pose clipping appears in these inspected views.

Two eight-second inspection previews run through the complete fine transfer
segments and reach their final states. They render 99 and 100 frames in the
headless capture, with maximum frame intervals near 100 ms. Both owned browser
captures finish with no errors or unexpected warnings. These are diagnostic
previews, not final whole-cycle speed or rendering-performance acceptance.

## Loaded seating and connected following lift

The completed native jaw profiles contain 1,929 and 1,940 knots, including
individually measured Float32 tooth cusps. Their sampled chord errors stay
within 2e-7 units. Both new and formerly engaged jaw faces participate during
seating. First impact changes only velocity and impact energy bookkeeping;
position, time and input phase exactly match the incoming transfer.

The fine seating trajectories contain 1,434 clockwise-branch and 971
counterclockwise-branch states. They reach sustained seating at model times
7.588593 and 6.036503. Seat times differ from the coarse results by 0.000239
and 0.000423; maximum coordinate differences are 0.0001121 and 0.0001093.
Both satisfy the native contact, momentum, impulse-energy and friction checks.
Eight hardware poses pass 12,439,532 surface samples. Sampled native jaw
penetration remains below 1.06e-7 units. Small key reactions change contact
status frequently; those status changes are not interpreted as large motions.

Held rotation starts at each exact stored seating endpoint. Neither key
preload nor the next stud phase is reassigned. The branch names continue to
describe their original strokes: the clockwise branch is now right-seated,
and the counterclockwise branch is left-seated. Their following stud loads
arrive at times 58.714593 and 58.994253, after approximately 50.88 and 52.71
time units of holding. D stays seated to roundoff during holding and the next
half-time-unit lift. Shaft/free-key motion changes preload during the hold,
so the following impacts correctly differ from independently initialized
initial lifts.

The original hold/lift comparisons halve both the hold steps (0.005 to
0.0025) and lift steps (0.0005 to 0.00025). Coordinate differences stay below
0.0000786. The clockwise branch passes all contact checks. The original
counterclockwise check is retained as a failure: at time 59.298253, its
2e-8 stud activation tolerance applies an impulse of 0.7074 while a positive
gap of 1.9919e-8 still remains. The resulting complementarity residual,
1.4090e-8, exceeds the required 1e-8. This is premature contact activation,
not a detected interpenetration.

A separate solver copy restricts stud velocity impulses to gaps at most
2e-12, matching the jaw tolerance. All position constraints and other contact
laws remain unchanged. Direct replay preserves 30 sampled unaffected held
steps exactly and withholds the premature stud impulse without moving its
position. The retained parity report's prose says 31; its authoritative
rows contain 30 comparisons.

The local refinement reuses the exact 20,983-state fine held prefix through
time 58.742003, then recomputes the next encounter and lift with steps 0.00025
and 0.000125. The finer result adds 6,019 states. Its maximum complementarity
residual is 6.206e-14; maximum lever and shaft differences are 0.00005599 and
0.00001956 radians. Momentum, friction, native gaps and free-shaft Runge-Kutta
comparisons pass. This local comparison shares a held prefix; the independent
coarse/fine hold comparison remains in the earlier reports.

The accepted clockwise and refined counterclockwise following studies contain
22,740 and 27,002 stored states. Their eight checked hardware poses pass
12,267,642 surface samples. Independent free-shaft intervals have maximum
speed error below 0.000094 and RK4 energy drift below 3.12e-15. Across transfer,
seating and the qualified following studies, 76,004 stored states and 28
hardware poses are checked, with 43,124,924 surface samples. These counts
include shared segment endpoints and the reused held prefix.

## Reversal rendering and remaining work

All twelve additional seating, holding and following-lift stills are opened.
Front views show the opposed clutch states; oblique views expose the weight,
gear and linkage depth ordering. No new obvious clipping appears in those
sampled poses. Four eight-second previews execute the joined first reversals
and the following stud encounters, completing with 145–147 frames each and
maximum frame intervals of 66.8–83.4 ms. They finish without browser errors
or unexpected warnings. The browser is closed before subsequent edits.

This checkpoint adds 26 inspected stills and six preview executions in total.
Previews were executed, not recorded or manually reviewed as videos. Source
contour tradeoffs, historical material/friction identity, repeating full
transfers, continuous clearance, final playback speed and production
integration remain unresolved. Production and all 1,097 frozen production
inputs remain unchanged; the complete 507-movement goal stays active.
