# Movement 087: loaded seating and loss of engagement during lifting

The isolated 213-part candidate now runs from both first jaw impacts through
loaded seating, held rotation and the next stud impact. It **does not provide
a working self-reversing mechanism**: both clutches withdraw when the returning
stud starts to lift F, and output speed departs sharply from the engaged gear
speed. This counterexample rules out joining the earlier prescribed-E lifting
studies into a complete cycle under the present frictionless triangular-jaw
and lost-motion interpretation. Production is unchanged.

The 75-pixel changes to both rod-pin positions also remain unaccepted for source
fidelity. No new geometry, hidden stop, latch, spring or prescribed output-speed
constraint is introduced by this study.

## Native jaw corners and loaded motion

The four independent coordinates remain F/G/rod rotation, shifter rotation,
D translation and output rotation. Native component inertia, output gravity,
the actual slot limits, the finite fork shoe and native stud contact are retained.
The velocity projector now permits four simultaneous independent constraints:
slot, fork and both jaw flanks can carry a compressive reaction at a seated
corner. Input rotation alone is prescribed.

Full projected-triangle jaw queries provide adaptive phase tables over the
travel ranges. Quarter-point chord checks use a 2e-7 axial tolerance; this is
sampled interpolation evidence, not a continuous error bound. Absolute relative
phases are measured without assuming exact tooth-period symmetry. Initial
0.012 and 0.08 radian extensions were insufficient to follow the lift-outs after
the first corner collision. Those failed range-limited runs are retained.

The first tables were insufficient for **contact normals at the sharp maximum**.
The return table produced an apparent loss of holding support, followed by only
2.05e-7 units of retreat and renewed holding. That was not a qualified physical
release. Native maximization and one-sided derivative checks at three scales
resolve the corner directly:

| Jaw | Refined relative phase | Native maximum axial gap at D = 0 | Left/right slopes |
| --- | ---: | ---: | ---: |
| Left | 1.046927017315 | 0.246849339135 | +0.318310 / −0.318005 |
| Right | −12.566100002306 | 0.000182700653 | +0.318009 / −0.318310 |

The gap corrections are only 5.89e-9 and 1.73e-7 units, but the corrected normal
cones materially change the holding-force result. The earlier return holding
failure and its microscopic continuation are retained as a superseded
interpolation diagnostic. Both refined seated configurations hold until the
next stud contact.

The integrator locates a crossing of the seated corner before resolving its
impact velocity. It permits the clutch to lift out along the opposite flank
and return repeatedly; neither D's endpoint nor output speed is clamped.
The refined 0.0000625-step studies contain 56,214 forward and 80,486 return
states. They settle at approximately 3.313 and 4.830 model time units after
first jaw impact, reaching output speeds −0.120 and +0.120.

Those final settling times are **not resolved to five milliseconds**. The
0.00025-step comparisons differ by 0.0386 and 0.0393 time units. Maximum
common-clock differences are 0.000150/0.000486 radians for F and the shifter,
0.000279/0.000897 units for D, and 0.000888/0.002777 radians for output rotation.
The small final repeated impacts remain sensitive to time discretization.

All fine-step momentum, compressive-impulse, contact-rate and motor-work checks
pass at roundoff. Complete native jaw intersections at 129 off-step times per
direction have minimum gap −1.96e-7 and maximum table discrepancy 1.98e-7.
The negative gaps are retained as measured approximation error; there is no
claim of mathematically exact nonpenetration.

Projection cost includes removal of each constrained explicit gravity kick,
so it is not solely physical impact loss. Its absolute energy defects are
1.3311% and 0.5317%, decreasing by factors 0.248 and 0.242 from the larger step.
A separate trapezoidal physical-velocity contact-work ledger has absolute
defects 0.000822 and 0.000874 in model energy units. Its small signed contact-work
residuals are also retained. These comparisons do not qualify complete-cycle
timing or exact continuum dynamics.

## The decisive retention failure

Each refined seated pose is checked at 1,025 output phases through the next
native stud-contact root. Minimum compressive reaction is 2.413 forward and
1.335 on return; equilibrium acceleration and motor/potential power residuals
are at roundoff. From the end of the seating previews, the next stud contacts
occur after 47.349 and 46.110 additional model time units.

At those contacts, the model again allows all four coordinates to respond.
Both resulting impacts start to withdraw D:

| Branch | Engaged output speed | Output speed after stud impact | Initial withdrawal speed | Withdrawal after 0.5 time units |
| --- | ---: | ---: | ---: | ---: |
| Forward | −0.120 | −0.002298 | 0.037430 | 0.018668 |
| Return | +0.120 | +0.039550 | 0.025584 | 0.016784 |

Impact momentum and energy balance at roundoff; all impulses are compressive.
Short outgoing directions also pass complete native jaw queries. Two subsequent
8,002-state trajectories retain the loss of drive: the forward output remains
near −0.0029, and the return output is about +0.0134 after half a time unit.
All their contact and momentum checks pass; 33 additional native jaw poses per
branch have minimum gap −1.96e-7.

This is a failure of the modeled retention mechanism, not evidence that Brown's
mechanism cannot work. Friction and the actual jaw/feather working surfaces,
as well as the uncertain quadrant/shifter interpretation, need review before
choosing a replacement. Imposing the earlier lifting speed or holding D fixed
would conceal the failure. Any revised physical assumptions must be carried
through withdrawal, neutral travel, seating and lifting consistently.

## Hardware, rendered views and retained evidence

All 213 solids pass topology checks. Fourteen poses cover first impact, loaded
travel, seating, holding, next stud contact and the outgoing retreat. They pass
21,135,730 surrounding-hardware surface checks at a 1e-6 intrusion threshold,
with separate native jaw, slot, fork and stud checks. Other hardware pairs still
have the known narrow-edge sampling limitation; continuous clearance is not
proved.

All ten new still views were opened and inspected: six full front views, two
full oblique views and two intentional jaw/fork details. The details expose the
opening seams during retreat. Full views retain the entire mechanism and show
no ground clipping. The changed rod-pin proportions remain visible in the
source comparisons.

Two seating previews ran at four times slower inspection speed, taking 14.066
and 20.149 wall seconds. They measured 22.25 and 23.33 fps, with 0.2 ms p95 model
updates and no browser errors or unexpected warnings. These are partial study
previews, not the final whole-cycle playback setting.

Local evidence is indexed by `087-loaded-seating-checkpoint.json`. Principal
reports are `087-refined-seating-cusps`, `087-refined-first-seating`,
`087-refined-quarter-seating`, `087-refined-seating-check`,
`087-refined-seated-hold`, `087-refined-next-stud-impact`,
`087-refined-next-lift`, `087-refined-retention-check`,
`087-first-loaded-seating-solids`, and the `087-loaded-seating-rendered`
captures and inspections. Earlier profiles, range failures, finite-horizon
failures, pre-corner event controls and the false return holding release retain
their exact input snapshots. One profile extension was deliberately terminated
and recorded before changing its interval grid to reuse existing queries.

The next required work is a source-supported retention mechanism, followed by
a continuously connected reversal with consistent initial preload. Source
proportions, full-motion clearance, final speed and production integration are
still unresolved. All 1,097 frozen production inputs and the prior 082/083
studies remain unchanged. No production build, full numerical suite or all-507
browser pass is added by this isolated study. The full goal remains active.
