# Movement 087: second connected transfers

This study continues the previously qualified following-lift endpoints of
the fixed-orbit candidate. All five physical coordinates, their velocities
and the input clock are preserved. The branch labels still describe the
initial strokes: the CW branch starts this continuation right-seated, while
the CCW branch starts left-seated.

The previous goal turn was progress: commit `35dcad4` qualified the first
reversal and following lift. This study addresses the next transfers, where
the continuously rotating input reaches different clutch teeth.

## Missing native profiles

Both first coarse continuations stop before opposite-jaw contact because the
new potentially contacting tooth is outside the previously measured native
profiles. Their complete stored prefixes, source snapshots and exit status 1
are retained. These are missing-measurement stops, not accepted transfers or
detected penetrations.

| Original branch | Last stored time | Next jaw | Trial relative angle | Stored states |
| --- | ---: | --- | ---: | ---: |
| CW | 64.510857 | left | 15.005986 | 5,298 |
| CCW | 66.211253 | right | -26.854772 | 6,718 |

The conservative native jaw lower bounds at the rejected trial queries are
still positive (0.0004185 and 0.0003445 units). The solver requests measured
normals ahead of actual contact for its position step. No coordinate or
motor phase is changed to bring the jaw into an existing profile.

Fresh profiles measure the actual Float32 triangles around each newly
approached tooth. They preserve the 2e-7 sampled chord-error tolerance and
independently check both cusp slopes. Full-turn phase equivalence is allowed;
tooth-pitch symmetry is not substituted for the rendered geometry.

The completed profiles use 8,552 left-jaw and 8,216 right-jaw native queries,
producing 1,941 and 1,935 knots. Their measured seating cusps are at relative
angles 15.184093958 and -26.703266943 radians, with zero-shift gap heights
0.246849339135 and 0.000182700653 units. These are measurements of the newly
approached teeth, not translated copies of earlier profiles.

## Continuous completion and step comparison

The coarse runs resume their exact stopped prefixes, preserving all 5,298
and 6,718 states. The fine runs restart from the same qualified following-lift
endpoints with half the step (0.0005 instead of 0.001). Both jaw sides and
the 2e-12 stud velocity-activation tolerance remain active throughout.
Both coarse and fine runs complete the second transfer and sustain seating
for a further 0.25 time units.

| Fine-run event | CW branch, now moving CCW | CCW branch, now moving CW |
| --- | ---: | ---: |
| Weight crosses vertical | 63.582593 | 63.805253 |
| Far slot starts carrying load | 64.282093 | 65.892253 |
| Withdrawal exceeds 0.002 units | 64.285593 | 65.897253 |
| Opposite jaw starts carrying load | 64.518593 | 66.219253 |
| Sustained seating starts | 64.750756 | 66.698254 |

Times retain the original input clock. The finer trajectories contain 11,577
and 14,910 states. Their seating-time differences from the coarse runs are
0.000561 and 0.000355. The newly seated output speeds are -0.12 and +0.12
radians per model time unit, arising from jaw and key engagement; neither
output speed nor the lever endpoint is clamped.

Every fine state receives independent momentum, free-acceleration, contact,
friction and impulse-energy checks. They pass on both branches. The largest
common-time coordinate differences are on D's spin: 0.0004132 and 0.0003328
radians. The largest event-time difference is 0.000764. Complementarity
residuals remain below 3.84e-11. Absolute physical contact-work defects sum
to 0.01407 and 0.008952 illustrative model energy units; the numerical
integration is not treated as exactly energy-conserving.

The CW branch retains 0.0000109095 units of pre-slot axial drift, or 0.00327
source pixels. The CCW branch has none. Both substantially withdraw only after
the far slot starts carrying load. The illustrative static/kinetic key
friction values remain 0.78/0.42; no historical material is identified here.

Independent RK4 integration checks the unloaded F/G/rod fall on each branch.
The maximum angle errors are 0.0001295 and 0.000006794 radians, with speed
errors below 0.000686 radians per model time unit. RK4 energy drift stays
below 3.91e-14. The seated F/shifter/axial-D coordinates return within
7.24e-11 of the previously observed same-side seated geometry. This compares
linkage geometry, not closure of the entire shaft, jaw and input-clock state.

## Native clearance and rendered review

Ninety-eight off-step native jaw/stud queries per branch span the transfer and
concentrate additional samples around new-jaw engagement. Native jaw
penetration stays below 8.99e-8 units; the largest measured profile error is
7.74e-8. Fast and reference stud queries agree exactly. Other sampled gaps
stay above -7.13e-10 units.

Twelve full-solid poses cover middle lift, crossing vertical, the last moment
before far-slot loading, neutral travel, new-jaw loading and sustained seating.
All 213 solids retain valid topology. The 18,137,424 surface samples find no
intrusion beyond 1e-6 units. These discrete samples do not prove clearance at
every instant or every narrow edge intersection.

All twelve rendered stills are opened. They show the weight crossing vertical,
the clutch passing through neutral and the newly measured teeth seating on
the opposite face. Four oblique views expose the gear, weight and linkage
depth ordering. No new obvious clipping appears in the inspected poses.
Both eight-second diagnostic previews execute to their final states, rendering
145 and 150 frames with maximum intervals of 66.8 ms. They finish without
browser errors or unexpected warnings. No video is recorded or manually
reviewed, and this is not final playback-speed acceptance.

Both initialized branches now have two connected reversals. A longer sequence
must still check recurring stud approaches, newly approached teeth and
long-term behavior. Source contour tradeoffs, continuous clearance, final
rendering/speed and production integration also remain unresolved. Production
and all 1,097 frozen production inputs remain unchanged. The complete
507-movement goal stays active.
