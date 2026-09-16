# 371/394: finite working profiles

The previous body/tooth intersections are corrected in the sampled finite-solid
checks. The result retains real driving faces and source topology, with prescribed
kinematics and explicit backlash. It is **not** a passive load or friction solve.

## Source and scope

The [371 caption/engraving](https://507movements.com/mm_371.html) describes a
uniformly rotating pinion crossing between two toothed faces of an alternating
wheel. [394](https://507movements.com/mm_394.html) describes Parsons's endless
rack and unequal concentric flanges working in side grooves. The prior source
review checked actual inline definitions, finding neither `ae.add_model` nor
`mm_present`; there is no registered 2D oracle for either mechanism.

The existing motion laws, source pose, shaft bores, finite carrier/rod guides,
side-guide attachments, full-cycle framing and display timing are preserved.
The 60-degree opening in 371 is still wider than the engraving. The guide shape,
tooth counts and 394's one-plus-three-pitch transfer allocation are reconstructions.

## 371: connected two-face tooth bars

The former solid median annulus intersected the pinion addendum by **0.073963**;
a face tooth witness penetrated by **0.037495**. An inner annular root rail
(radius 1.30–1.44) and outer rail (1.99–2.08) replace that filled working region.
Finite radial bars join both rails. Each bar has actual front and rear halves,
closed at the median plane, retaining the two original face rows and end teeth.

An offline cutter uses the complete finite involute pinion, its axial depth and
all nine input revolutions. Separate first-terminal, periodic and last-terminal
profiles retain positive central stock: minimum cross-sectional half-radius
**0.00714**, rather than deleting a terminal or lifting it out of engagement.
The pinion's decorative bevel is removed from its working extrusion.

The fine offline 64-by-128 profile is conservatively reduced to a 32-by-32
rendered loft. Adjacent fine samples bound each coarse station, followed by a
0.0009 radial finishing allowance. This corrected the observed local
interpolation penetration while keeping nearby working faces. The browser does
not run the cutter or a physics simulation; only three paired lofts are built
and reused by the 82 visible front/rear teeth. A test caps the entire model at
150,000 visible triangles (the first unsimplified candidate exceeded 700,000).

Actual rendered triangle/edge/vertex samples in both solid directions over 73
full-cycle poses plus the prior witnesses give minimum clearance **0.000399**.
Nine representative actual triangle faces, including both crossover branches,
give useful output moment magnitude greater than **0.2**, opposing input moment
less than **−0.03**, and maximum sampled face gap **0.003593**. These are normal
moments about the actual shafts, not pitch-circle residuals.

The finite allowance represents backlash. Which flank carries load during a
reversal, carrier reaction loads and impact are still prescribed/unvalidated.
The normal witnesses demonstrate available driving faces, not a solved force
balance or continuous loaded contact at every instant.

## 394: mounting phase and finite rack flanks

The former pinion/rack penetration was **0.087369**. The pinion is now mounted
half a tooth pitch from its old phase. Its complete finite trapezoidal outline
is used as an offline cutter through both straight strokes and both transverse
switches. The rack roots are joined to a finite stadium frame whose inner
radius is increased from 0.915 to 0.955, clearing the pinion's root envelope.
The frame still overlaps the tooth roots; it is not a floating set of teeth.

Straight working flanks emerge from finite stock and the cutter. Where the
pinion never reaches that stock, the source's individual periodic tooth gaps
are restored, avoiding long uncut rectangular lands. Curved end teeth remain
source approximations. Some terminal-region teeth are shortened considerably;
this is a visible reconstruction difference, not an exact engraving match.

Bidirectional finite-surface checks give minimum clearance **0.000115**. At 128
representative straight-run poses, actual rack triangle normals have a positive
pinion-driving moment greater than **0.03** and oppose the translating input's
work; the largest sampled useful-face gap is **0.006947**. This is about **3.8%**
of the former 0.18419 tooth width, or **0.9%** of the pinion tip radius. The earlier
2D nearest-point probe was conservative and did not search these actual faces.

Both circular flanges retain the finite working walls from the previous pass.
Their normal force passes through the shaft and supplies zero shaft torque;
the angular crossover law therefore still assumes no-slip friction. Preload,
friction capacity and loaded pickup are **not validated**. The generated tooth
clearance does not establish that this prescribed flange handoff will occur
passively. A future contact-selected transfer would need that force assumption
and its terminal backlash resolved jointly.

## Reproduction and checks

```sh
node scripts/generate-reversing-transmission-profiles.mjs --check
node --test tests/movement-371.test.mjs tests/movement-394.test.mjs tests/reversing-transmission-working-solids.test.mjs tests/reversing-transmission-tooth-contact.test.mjs
```

The bake regenerates byte-identically. **27 checks pass**: 17 existing source/
motion regressions, five support/guide/presentation regressions, and five new
finite tooth, useful normal, continuity, mesh-budget and stable-allocation checks.
No native simulator is required for this bounded geometric correction. All
sampled bounds permit future improvement rather than requiring a known defect.

Root's final source/default and oblique views show no errors or full-cycle
clipping (maximum NDC extent 0.90744 / 0.91180). The cheap CPU screen reports
404 / 178 ms construction, update P95 0.0181 / 0.0470 ms and no flags or
geometry growth. Visible triangle counts are 102,516 / 28,024, excluding shadow
passes. These timings exclude imports and GPU work. RAM evidence is under
`/dev/shm/family46-reversing-final*`; packaged checks are integrated centrally.
