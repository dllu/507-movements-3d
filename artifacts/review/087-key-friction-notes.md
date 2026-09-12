# Movement 087: shaft-key clearance and clutch retention

The isolated candidate now allows the clutch and shaft to rotate independently
through the actual feather clearance. An illustrative dry-friction model can
keep the clutch seated while the stud lifts F, then permit withdrawal when F
reaches the opposite end of the quadrant slot. This resolves the previous
frictionless cam-out **within a bounded material hypothesis**. It does not yet
establish a continuously connected, source-faithful reversing cycle. Production
and the unresolved 75-pixel rod-pin changes are unchanged.

## Native key contact and independent spin

The former four-coordinate study assigned the same angle to D and the shaft
even though their native meshes have angular clearance. The fifth coordinate
exposes that clearance without changing any solid. At equal angles, all 213
part transforms agree with the earlier candidate exactly at 33 sampled poses.

The actual Float32 feather vertices meet the keyed-bore walls at shaft-minus-D
angles ±0.006252607513 radians: 0.012505215026 radians, or about 0.72 degrees,
of total backlash. The contact gaps use unit transverse normals and a moment
arm of 0.159865564925. Thus the contact reactions have force units; axial
friction is limited by a contacting wall's reaction. It is zero when that
contact is unloaded. Thirty-six three-dimensional witnesses at three axial
positions and three spins lie on both native solids within 6.1e-16 units.
Finite-difference gap gradients agree within 3.35e-11.
The two 772-vertex bore rings differ in their circular tessellation. Independent
first-contact searches give exactly the same two limits for both rings; 257
interior angle samples per ring keep every feather vertex inside its hole.

D's spin inertia is 0.455090199421; the shaft, pinion and reflected E inertia
sum to 2.632838190308 in the existing illustrative mass normalization. Their
gravity potentials are separated using actual component centroids. Sixty-five
angle pairs agree with native transformed-centroid potential within 1.34e-15;
finite-difference derivatives agree within 1.15e-9. At equal angles the old
combined potential and derivative are recovered within 2.23e-16. The existing
additive-volume mass hypothesis, including overlapping attached components,
is retained.

## Friction hypothesis and its limitations

The diagnostic uses static coefficient 0.78 and kinetic coefficient 0.42.
These are illustrative dry hard-steel values listed in Table IV of
[NASA RP-1228, *Fastener Design Manual*](https://ntrs.nasa.gov/api/citations/19900009424/downloads/19900009424.pdf).
Brown's engraving does not identify those materials, surface conditions or
lubrication. These values are a sensitivity experiment, not historical evidence
or a guaranteed clutch property.

The normal/axial impulse solver enumerates compressive contact sets and
admissible Coulomb modes. A resting axial contact prefers sticking; an existing
slide continues on its kinetic branch until it arrests. Static force
indeterminacy is allowed at the two-flank jaw cusp. The solver reports alternate
admissible velocities, rather than claiming the static/kinetic law has a unique
solution. In this experiment the chosen mode's velocities agree across
equivalent contact sets at roundoff. Lower-friction sliding alternatives can
coexist with the static solution because the coefficients differ.

Eleven independent analytic checks cover static load, breakaway, both sliding
directions, arrest, zero normal load, separation, a moving wall, unequal masses,
coupled normal/tangent response, redundant static constraints and the
frictionless limit. Velocity, momentum and impulse-energy identities pass at
roundoff.

The loaded initial states are explicit preloads at the previous next-stud
phase. Native output gravity loads the positive-clearance wall in both cases.
Input phase is retargeted by ∓0.004466148223 radians to retain the measured seated
jaw cusp while D takes up that clearance. This is an initial condition, not an
animated snap or a demonstrated continuation from the earlier seating study.

Seven static-coefficient values from zero to 0.78 were tested at both impacts.
The forward impact withdraws D at coefficients through 0.50 and holds it from
0.51 upward under the documented static selector. The native key moment arm
divided by the driving-jaw slope is approximately 0.503, consistent with that
transition. Return impact initially unloads the key in every case, allowing
real relative rotation before opposite-wall engagement.

## Initial lifting and backlash

The 0.00025 and 0.0000625 time-step runs both retain D's axial position through
the first half time unit at the dry-friction settings. Fine runs contain 8,001
states per direction. The zero-friction controls withdraw by 0.018666 and
0.013312 units over the same interval.

The forward output stays at −0.12. On return it initially slows, briefly reaches
−0.031762, meets the opposite key wall near time 0.0985, separates briefly,
then carries a sustained key load from about 0.10425. By the interval's end it
has recovered +0.12 and lags the no-backlash phase by exactly 0.012505215026
radians. No rotation or translation is teleported into engagement.

Common-clock coarse/fine coordinate differences are at most 0.000262 radians
for F and 0.0000256 radians for the shaft, with no axial difference. Both full
native jaw surfaces are queried at 33 interpolated off-step times per direction;
minimum jaw gap is −5.6e-16, and the other native constraints reach only
−2.44e-11. Momentum, contact rates, Coulomb limits and impulse energy pass at
roundoff. Friction acts only at a key gap within 1.4e-17 of contact.

Projection losses include constrained explicit gravity kicks. A separate ledger
using physical endpoint velocities gives absolute contact-work defects of
0.0006943 and 0.0001193 model energy units. Small negative inferred contact losses
down to −1.28e-8 remain discretization evidence, not physical energy production.

## Longer lifting and release

The same five-coordinate equations are continued through lifting, free motion
after the stud releases, opposite slot contact and the first 0.002 units of
clutch withdrawal. The trajectory is not joined to an older frictionless stage.
The finer 0.00025-step runs contain 23,414 and 20,354 states. They reach the
withdrawal threshold at times 5.85325 and 5.08825. Axial release first appears
in the intervals [5.84875, 5.84900] and [5.08500, 5.08525]. The 0.001-step
comparisons differ in reported release time by less than 1e-11 and 0.00075,
respectively. These are discrete event brackets, not exact event times.

The forward stud finally releases near 4.65375; F then moves freely until
opposite slot contact. On return, gravity changes the required key torque:
the negative wall unloads near 3.69775, the shaft crosses its clearance again,
and positive-wall contact near 4.22325 coincides with stud release. Output
temporarily reaches about 0.19313 during this second backlash traversal.
The resulting return lift and flight differ from the older prescribed-output
study. F reaches the opposite slot end and begins withdrawing D near 5.08525.

Maximum common-clock coarse/fine differences over these longer runs are
0.000300 radians for F, 0.000032 units for D and 0.000121 radians for the shaft.
All momentum, contact-rate, Coulomb and discrete impulse-energy checks pass.
Absolute physical-velocity contact-work defects are 0.006444 and 0.004898 model
energy units; inferred contact loss has small negative discretization values
down to −2.05e-7. Projection-ledger absolute defects decrease from 0.05298 to
0.01507 and from 0.07255 to 0.01653 with the smaller step. Neither ledger is
represented as an exact continuum energy certificate.

Both full native jaw surfaces are checked at 33 additional interpolated times
per direction. Minimum native jaw gap is −1.12e-15, and the other native gaps
reach −1.79e-10. The twelve selected full-hardware poses pass 18,516,688 surface
checks at the 1e-6 intrusion threshold; all 213 solids retain valid topology.
Other hardware pairs still have the known narrow-edge sampling limitation.

All ten still views were opened and inspected: six full front views, two full
oblique views and two intentional jaw/fork close-ups. Complete views frame all
hardware without visible ground clipping. Close-ups show the small seam at
the beginning of withdrawal; they do not expose the internal feather contact.
The source pin changes remain visible. The two previews run at 1.5-times-slower
inspection speed, taking 8.783 and 7.6497 wall seconds at 22.09 and 23.01 fps.
Both have 0.2 ms p95 model updates and no browser errors or unexpected warnings.
These previews are partial-cycle studies, not a final display-speed choice.

Local evidence is indexed by `087-key-friction-checkpoint.json`. Principal
reports are `087-first-native-key`, `087-both-key-bores`,
`087-first-key-friction-projector`, `087-first-key-impact`,
`087-first-key-lift`, `087-quarter-key-lift`, `087-first-key-lift-check`,
`087-first-key-release`, `087-quarter-key-release`,
`087-first-key-release-check`, `087-first-key-release-solids` and the
`087-key-release-rendered` captures and inspections. Exact source snapshots
and the previous frictionless counterexamples remain retained.

The remaining work is consistent neutral travel, opposite-jaw seating and
another lifting stroke from the resulting state. Initial preload must emerge
from that connected motion. The source pin proportions, historical retention
interpretation, full-motion clearance, final display speed and production
integration remain unresolved. The all-507 goal remains active.
