# Movement 087: native clutch transition and first jaw impact

The isolated 213-part candidate now transfers the falling linkage's momentum
through the actual slot pin and fork into D. Four independent coordinates cover
F/G/rod, the shifter, D's translation, and output rotation. Both shifts reach
the opposite native jaw and their separately computed first impacts reverse
the shaft. Loaded motion through full seating and a repeating reversal remain
unsolved. The two rod pins still depart from Brown's measurements by 75 pixels;
this candidate is not accepted for source fidelity or integrated in production.

## Native slot, fork and jaw geometry

The independent-coordinate wrapper reproduces all 213 part transforms exactly
at 130 poses from the previous diagnostic factory. It then permits the shifter
and D to move without the old diagnostic clamps. No existing geometry changes.

The slot query reconstructs its actual Float32 boundary and the 128-sided pin.
All 406 finite vertex/edge rotational events delimit the connected free interval
of relative angle `shifter − F`: −1.331977558799 to −0.000052781041 radians.
There is no collision event inside this interval, and an interior configuration
has the entire pin inside the slot. The limits differ from the prior finite-circle
fits by −1.87324e-6 and +1.39563e-6 radians. Fork limits use the actual polygonal
shoe's X extrema against the Float32 groove planes, leaving its small real play.

Six slot-stop witnesses and 516 fork-wall witnesses are checked against the
full 3D triangle solids, including both shoe depth endpoints. Maximum residual
is 1.08e-14 world units. Fork gradient finite differences agree within 3.97e-11.
The fork witnesses lie on the finite groove walls, not merely their infinite
planes. Initial support alignment corrects the earlier approximate shifter
angle by at most 3.03420e-6 radians and the F angle by at most 1.87324e-6; the
corresponding incoming-flight retiming is at most 1.40548e-6 time units. These
are explicitly reported initial-state corrections, not animated position jumps.

Jaw clearance uses the actual opposing front triangles as axial height fields.
Projected triangle intersections include edge/edge crossings; the minimum
affine gap is attained at a vertex of each intersection polygon. This avoids
relying on triangle vertex/centroid samples alone. Sixty-six tooth-phase poses
agree with independently transformed full-solid contact witnesses within
1.67e-16. The mesh differs from the ideal triangular-wave gap by as much as
0.000203143 world units. At alignment, the smallest native clearance is
0.000096865 rather than the nominal 0.000300 relief.

An analytic triangle-height error bound safely excludes separated jaws during
integration. Near contact the solver uses the complete native triangle query.
The bound follows from the ideal wave's angular Lipschitz slope, each native
triangle's angular width, and its maximum vertex-height error. Thirty-two
additional off-grid, full-angle queries check the bound. The bound is deliberately
loose; it does not replace native contact location.

## Output inertia and the missing gravity torque

Native component masses retain the explicitly illustrative common-density,
additive-volume hypothesis from the first-flight study. Attached overlaps are
not subtracted and no historical dimensions or materials are inferred.

Independent mass integrals and finite differences of actual world transforms
check 94 moving components at three configurations. All four inertia coordinates
and their cross terms agree within 2.06e-10. The output's reflected inertia is
3.08792839, including D, the shaft, the pinion and E divided by its squared ratio.

The first three-coordinate trials held output speed constant during the gap
between jaws. That is not free motion under this mass model: E's stud and the
shaft feather make the assembly eccentric. The corrected four-coordinate
model includes their gravity torque. Its two potential harmonics have frequency
1 for the shaft/D/pinion group and 1/1.2 for E. E's sine coefficient is
−2.09725467 in the chosen units, large enough to alter which return tooth flank
is contacted. At 257 phases spanning the common period, native world-centroid
potential agrees with the harmonic model within 4.22e-15; independent gradient
differences are below 3.55e-10.

The constant-speed controls, their sampled hardware screen, and their impact
results remain retained as an explicit comparison. An initial assertion that
both first impacts must reverse the shaft failed for the return control. A
subsequent control check correctly treated reversal as an observed outcome.
Those results do not qualify a free neutral transition: they omit output gravity.

## Four-coordinate shift and impact results

The corrected solver begins at native slot impact, crosses the fork clearance,
withdraws D and follows neutral travel under gravity. Its incoming speed and
motor phase come from the previous prescribed-E lifting study. Output speed
then evolves independently. Slot, fork and any stud impulses are compressive;
the opposite jaw terminates the trajectory at its exact first contact.

Three step sizes, 0.00025, 0.0000625 and 0.000015625, complete both directions.
The finest runs have 13,802 forward and 17,353 return states. First opposite-jaw
contact occurs at 0.215628143 and 0.271123135 time units after slot impact.
D's corresponding positions are −0.177481488 and −0.081511455. These positions
are before full seating, not the final engaged endpoints.

The last two step levels differ in contact time by at most 7.62e-6 and in
terminal velocity by at most 1.62e-5. Common-clock coordinate differences stay
below 9.39e-6 radians for the linkage/shifter, 7.25e-6 world units for D, and
2.53e-6 radians for output spin. Absolute energy defects are 0.005035% forward
and 0.004355% on return. All finest-state momentum and compressive-impulse
checks pass; minimum native slot/fork gap is within roundoff of zero. These
are numerical convergence comparisons, not exact continuum error bounds.

Separate plastic first-impact calculations include all four inertias and motor
impulse work. Native jaw derivatives at three finite-difference scales agree
within 2.54e-9. Full-solid contact witnesses and short directional checks confirm
the contact geometry. All three impulses—slot, fork and jaw—are compressive.
Momentum and energy residuals are at roundoff.

| Shift | Output speed before jaw impact | Output speed after impact | Motor impulse work | Plastic loss |
| --- | ---: | ---: | ---: | ---: |
| Forward | +0.227077977 | −0.373262347 | 0.222456952 | 3.078931561 |
| Return | −0.029334995 | +0.382463645 | 0.152592565 | 1.710100662 |

Including output gravity changes the return contact flank, so the corrected
return impact reverses the shaft. This is an instantaneous impact result.
It does not show that the jaw remains engaged, reaches its seated phase, or
supports the subsequent motor torque and next lifting stroke.

## Hardware and rendered review

All 213 solids retain valid topology. Twelve selected states cover slot impact,
fork impact, three neutral positions and first jaw contact in each direction.
Each considers all 18,971 independent rigid pairs. Bounds, reused transforms
and 18,237,132 bidirectional native surface samples find no intrusion beyond
1e-6. Both jaws additionally receive exact projected-triangle gap checks; slot
and fork limits are native. Other pairs retain the known narrow-edge sampling
limitation. This is not continuous-clearance evidence.

All twelve new still views are opened and inspected: eight front views, two
oblique first-contact views and two close jaw/fork views. They show withdrawal,
neutral travel and the mating flanks at first contact. Full views retain the
entire hardware; detail views are intentionally zoomed. The source comparison
still exposes the changed rod-pin positions.

Two partial previews run eight times slower for inspection, taking approximately
1.75 and 2.20 display seconds. They measure 20.00 and 20.91 fps, with 0.2 ms p95
model updates and no browser errors or unexpected warnings. They stop at first
jaw contact and do not animate the subsequent impact velocity change. These
inspection timings do not choose the eventual complete-cycle playback speed.

Local evidence is indexed by `087-clutch-transition-checkpoint.json`:

- `087-first-native-couplings.json` and `087-first-native-jaws.json` record
  exact contact limits, parity and full-solid witnesses.
- `087-first-shift-mass-check.json` and `087-first-output-gravity-check.json`
  independently check four-coordinate inertia and output gravity.
- `087-first-gravity-shift`, `087-quarter-step-gravity-shift` and
  `087-sixteenth-step-gravity-shift` retain summaries and both compressed
  trajectories at each step size.
- `087-first-gravity-shift-check.json` records convergence and impulse checks.
- `087-first-gravity-jaw-impact.json` records both corrected impact results.
- `087-first-gravity-shift-solids.json` records the final hardware samples.
- `087-gravity-shift-rendered-captures.json` and
  `087-gravity-shift-rendered-inspections.json` record the reviewed previews.
- The `neutral-shift` reports and both earlier `first-jaw-impact` reports
  retain the superseded constant-output-speed controls and their exact sources.

Next work is loaded jaw motion through seating, consistent initial engaged-jaw
preload, and a continuous repeating reversal connecting both lifting strokes.
Source fidelity, full-motion clearance, final speed and production integration
remain pending. Both earlier 087 factories, all 1,097 frozen production inputs,
and the 082/083 study inputs remain unchanged. No production build, full-suite
test or all-507 browser pass is added by this isolated study. The full goal
remains active.

The follow-up [loaded seating study](087-loaded-seating-notes.md) now reaches
both seated states and the next stud contacts. Refined native corner normals
permit holding, but both clutches cam out when lifting starts. The current
frictionless triangular-jaw/lost-motion interpretation therefore cannot yet
connect the lifting branches into a working reversal.
