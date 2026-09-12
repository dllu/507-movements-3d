# Movement 082 reconstruction study

Status: **in progress; not integrated or fully mechanically verified**. The
candidate now has three free dynamic coordinates, a closer source pose and
corrected hardware spacing. All 904 frozen production inputs remain identical
to commit `c13f7ec03ee2dd2d7c0ccb5b0b560373f14fa97e`.

## Loading, strap motion and refinement stage

The prescribed linkage now has an independent loading and energy study.
It includes the wheel, both arms, treadles, rods and pawls, with component
masses derived from their actual meshes. Overlapping welded components are
treated as additive lumped masses. The strap, its bonded eyes and the pulley
remain ideal massless elements. The ideal lower-pawl closing torque has
potential energy `-preload * (pawl angle - arm angle)`, including its reaction
on the moving arm. This does not specify a physical spring construction.

An independent tetrahedral mesh integration checks the energy formulas at
17 poses over 29,292 tetrahedra. Maximum kinetic-energy discrepancy is
2.26e-10, potential discrepancy 7.11e-12 and analytic derivative discrepancy
1.69e-7 in normalized study units. Reconstructed contact impulses also close
the free-coordinate momentum balance. This audit currently supports zero
Coulomb drag only and rejects other settings explicitly.

The minimum strap tension compatible with downward forces at both feet stays
positive in the studied trajectory. The rising foot sometimes absorbs work;
assuming only the descending foot applies force instead requires upward
pulling at nearly half the saved intervals. Thus the two-foot result is a
constructive feasible ideal loading, not a unique foot-force prediction or
evidence for the descending-foot-only interpretation. Force magnitudes are
normalized study values, with impact peaks, rather than measured newtons.

The energy audit includes backward-Euler velocity-change loss and endpoint
contact work. Its maximum cumulative corrected residual decreases from
0.0214527 to 0.0107126 to 0.00536171 to 0.00268151 at 2, 1, 0.5 and 0.25 ms
steps. The last is 0.0116682% of the audit's work/loss scale, below its 0.1%
threshold. `082-finer-linkage-loads.json` and `082-quarter-ms-linkage-loads.json`
preserve these comparisons. The 0.25 ms check reconstructs all 48,000
intervals with no missing contacts and a maximum momentum residual of
8.23e-14. Passing this energy check does not establish trajectory convergence.

The strap study follows fixed material labels along the geodesic wrap. It
derives a periodic pulley rolling approximation from half the difference of
the two leg lengths. Across 4,097 poses the maximum sampled axial material
speed is 6.34410 engraving pixels/s; the maximum circumferential slip is
0.00166554 pixels/s, integrating the sampled maximum to 0.00406246 pixels per
input cycle. These are sampled kinematic results. They do not prove no-slip,
traction, a friction law, or pulley inertia. The proposed pulley rotation is
**not yet implemented in the candidate**. See `082-strap-kinematics.json`.

Contact queries now skip distant pawl points using a conservative disk that
contains the wheel polygon. The checked implementation produces bitwise
identical contact rows and minimum gaps in 12,326 cases: both primary pairs
at all 6,001 original saved states, plus 324 perturbed contact-margin cases.
Those cases include 111,649 rows. The reusable script ran approximately 3.63
times faster locally; this is diagnostic timing, not a browser performance
claim. `082-contact-pruning-script-check.json` freezes that result and the
archived implementation used for comparison.

Full-trajectory refinement still needs qualification. Comparing 2 to 1 ms,
1 to 0.5 ms, then 0.5 to 0.25 ms yields maximum free-body displacement
differences of 1.67206, 0.550162 and 1.03430 source pixels. The last comparison
is worse, despite nearly identical total wheel advance. These failed reports
are retained; the target remains 0.25 pixels. The largest discrepancies occur
around fast pawl drops and their accumulated timing differences.

An isolated two-second trial starting from the same full state near four
seconds reduces the difference to 0.0917308 pixels at 0.25 versus 0.125 ms,
then 0.0162888 pixels at 0.125 versus 0.0625 ms. This local result does not
qualify the full startup trajectory. The current comparator checks the union
of both saved grids, bounding differences between linearly interpolated
angles and converting them with the actual mesh radii. It checks matching
initial position, velocity and time, identical model parameters and ordered
step sizes. This remains observed numerical agreement, not a continuum-error
bound. See `082-impact-window-union-refinement.json`.

A 48-second continuation advances 30.0000482 teeth through twelve additional
input cycles without solver failure. Its endpoint states suggest an
eight-second, five-tooth recurrence. **Whole-cycle comparison rejects that
as a qualified playback loop:** adjacent cycles differ by 3.958 to 11.524
pixels inside the cycle, even where their endpoints nearly match. The final
comparison differs by 6.72077 pixels. No state reset or repeating playback
has been introduced. `082-settling-recurrence.json` records whole-cycle and
endpoint position/velocity comparisons separately.

This stage adds study code and evidence only. Production geometry, motion,
tests and build inputs are unchanged. Full startup refinement, continuous
solid clearance, the pulley/strap assumptions and final playback/rendering
remain open before integration. No new production test or browser pass is
claimed. `082-loading-refinement-checkpoint.json` freezes this stage's 30
sources and completed evidence. Two further full startup trials, at 0.125 and
0.0625 ms, are pending at that checkpoint and are not counted as passes.

## Finite-contact dynamics stage

The wheel and both pawls now carry their angles and velocities through time.
The treadle linkage supplies analytically differentiated moving hinges;
finite mesh-profile contact, inertia, gravity, drag and an explicit lower-pawl
hinge preload determine the free motion. Pawls are seated only at startup.
There is no framewise return angle or teleport to another tooth.

The first gravity-only trial let the lower pawl swing away: its curved mass
lies mostly above the hinge. The current trial assumes an ideal constant
closing torque of 2 in the study's normalized units at that hinge. Common
density normalizes the lower pawl mass to 1; the upper pawl uses gravity with
no added preload. The preload is an unshown spring assumption, not a measured
feature of the engraving. Its physical implementation remains unqualified;
the later ideal loading and energy study is described above.

The first tooth face also allowed too much camming out. The current trial
uses a short-face fraction of 0.06 rather than the preliminary 0.27, retaining
26 pointed teeth and curved backs. This gives a steeper driving face, informed
by the enlarged right-hand teeth. It is a mechanical regularization of the
irregular engraving, not a newly measured exact fraction. Both pawls deliver
positive driving impulses in the current trajectory. The resulting rotation
is counterclockwise as viewed from the source side.

Startup uses wheel angle 0.03 rad and pawl angles approximately -0.05545 and
-0.05002 rad. The upper pawl starts in the admissible tooth valley nearest
its engraved pose; a different outside branch rests on the previous tooth.
This branch choice is an initial condition only. Relative to the provisional
source profiles, the initial rotation displaces wheel tips by at most 8.384
source pixels and pawl vertices by 6.369 / 6.718 pixels. These numbers do not
include the original measurement and uniform-tooth fitting errors.

The initial twelve-second run has 6,001 states at a 0.002-second step, with no
rejected steps or nonlinear failures. It advances 8.012 tooth pitches through
three four-second treadle cycles. A very small startup rollback remains;
after four seconds the sampled wheel velocity stays positive, between
0.07719 and 0.25120 rad/s. This establishes neither a settled repeating cycle
nor time-step convergence. An earlier 0.004-second trial failed near a tooth
handoff; its successful smaller-step continuation and the failure are both
preserved.

The all-parts screen found and corrected intersections at both strap eyes,
the upper rod ends, and then the rear treadle pedestal. Treadles now sit
inward of the strap tabs, rod eyes have greater axial stand-off, and the rear
pedestal sits outside the moving treadle. Ordinary round pins remain at all
these joints. The latest 49-pose screen covers 538 independent component
pairs and 12,153,906 actual surface samples with no intrusion beyond 1e-6.
Rigidly connected parts and bonded strap/eye joins are excluded. This sampled
screen is not a continuous collision bound.

At the source pose, all 35 current meshes pass closed-edge, nondegenerate-face
and positive-volume checks. Both finite pawl/wheel pairs also pass its surface screen.
Independent checks pass for 144 generalized forces, 4,737 contact-coordinate
derivatives and 1,579 input derivatives. All 10,905 positive contact reactions
lie on the two participating profile boundaries and within their normal
cones (21,810 checks of each). Maximum force discrepancy is 4.43e-9 and maximum
contact-coordinate derivative discrepancy is 2.13e-8 in study units.

Thirteen new renders were inspected: the source pose and overlay, nine poses
through the final displayed input cycle, and oblique/rear views. They show the
fixed-pin links and direct curved-pawl engagement. These are accepted as
candidate review evidence, **not as a final reconstruction**; no real-time
playback performance or integrated desktop/mobile test is claimed.

Current local evidence is `082-source-seat-dynamics.json`,
`082-source-seat-forces.json`, `082-source-seat-motion-surfaces.json`,
`082-source-seat-topology.json`, and `082-contact-motion-captures.json`.
A report-name collision briefly replaced the first full-motion JSON with the
topology report. The topology report was moved, the original motion log and
archives retained, and the motion screen rerun to its distinct current name.
The incident is recorded in `082-report-name-collision.json`.

The local `082-contact-dynamics-checkpoint.json` freezes this earlier stage
separately from the initial layout checkpoint. The later loading/refinement
stage above records its additional evidence and remaining limitations.

The initial dynamics trial can be reproduced with a fresh output prefix:

```sh
GEOMETRY_OPTIONS='{"shortFaceFraction":0.06,"treadleInset":0.055,"rodEndOffset":0.12}' \
PHYSICS_OPTIONS='{"preload":[2,0],"theta":0.03,"seatLowerBounds":[-0.7,-0.08]}' \
PROBE_DT=.002 PROBE_MIN_STEP=.000001953125 PROBE_DURATION=12 \
PROBE_OUTPUT=artifacts/review/082-reproduced-dynamics.json \
node scripts/study-treadle-ratchet-dynamics.mjs
```

## Source and rejected baseline

The [original description](https://507movements.com/mm_082.html) identifies two
treadles D, vibrating arms B and pawls driving ratchet A. A chain or strap over
pulley C connects the treadles so lowering one raises the other. It does not
specify the direction of wheel rotation.

The inspected native reference is `artifacts/reference/brown-082-detail.png`,
a 1350 × 1250 crop at `[3070, 2510, 1350, 1250]` from the 4814 × 6000 scan of
PDF page 28 / printed page 24. The smaller public engraving was also inspected.

The production baseline has 30 deep teeth, short pawls with thin axial contact
fingers, an imposed return swing approaching three radians, sliding strap
attachments, and an excessive arm stroke. The source instead shows curved
pawl bodies, separate rod and pawl joints, and unequal links. Eight baseline
views were inspected and rejected. A selected surface screen found 4,086
intrusions in 658,932 checks over 129 poses and four pairs. This screen covers
the pawls and contact fingers against the wheel; it is not a complete
interference audit.

## Measured geometry and pulley correction

Twenty-two visible or partly visible tooth tips support 26 uniform divisions
(four teeth are hidden). The tip-fit RMS residual is 10.241 source pixels,
compared with 15.460 for 25 teeth and 63.902 for the old 30-tooth count. The
smooth wheel face fits a circle centered at `[492.671, 522.215]`, radius
228.996 pixels, with 1.431-pixel RMS residual. These are engraving fits, not
manufacturing dimensions. Uniform spacing, concentric circles, hidden depth,
and the provisional tooth contours remain reconstruction assumptions.

An initial reading mistook the long vertical strap and stand lines below C
for the edge of a large pulley. **That interpretation and candidate are
rejected.** The enlarged source detail shows a small pulley spanning source
y = 610–710, with its axle near y = 660. The corrected candidate uses this
small pulley. The first measurement overlays, source snapshots, four renders,
and contact report remain archived under `082-first-candidate-*` and
`082-source-measurements-first.*`; they are not current accepted evidence.

The corrected source-aligned, overlay, oblique and rear views were inspected.
They support continuing with this layout, but do not establish working contact
or correct motion. The provisional tooth profile has a short face preceding
the tip in increasing polar angle. Drive direction still needs to follow from
the finite contact geometry rather than inherit the baseline's assumption.

## Fixed-pin linkage study

The two treadles rotate about a common fulcrum. Each rod has its own fixed
length and ordinary round pin joints. The two strap pins are fixed to their
treadles; the model uses no sliding slots. The prescribed front treadle drives
the rear through a constant-length strap, with straight tangent legs and a
geodesic wrap over a broad cylindrical pulley. The strap may drift axially
across the flat pulley face.

Across 1,025 sampled poses, maximum strap-length error is 8.89e-16 world units
and rod-length error is 1.34e-15. Source rod and pawl joint centers match by
construction to 1.53e-13 pixels. Regularizing the two strap attachments to a
common treadle location introduces 0.975 pixels of source discrepancy. The
sampled strap drift is 4.279 pixels and its minimum pulley-face edge margin
is 13.579 pixels, including the 20-pixel strap width.

These results establish geometric closure for the studied motion. They do
not establish loads, strap traction, no-slip pulley rotation, or continuous
clearance of the finite solids. The chosen 0.1-radian amplitude and four-second
period are provisional.

## Initial layout checks (superseded by the dynamics stage above)

All 35 candidate meshes have positive signed volume, consistent closed edges,
and no degenerate triangles in the topology screen. The source-pose finite
pawl/wheel contact screen **fails**: the lower pawl has 275 intrusions among
15,084 samples, with maximum depth 0.04024 world units; the upper has 337
among 14,532, with maximum depth 0.06700. No complete moving-parts clearance
check has passed. The candidate's default update remains a static source pose;
its state setter exists for subsequent linkage and contact studies.

The next steps are to resolve initial finite contact and drive direction,
solve the free wheel and both pawls through natural return and handoff,
qualify the strap and pulley assumptions, and check all independent solids
through motion. Source alignment, readable speed, and desktop/mobile rendering
must pass before integration and production regression checks.

Sixteen model views were inspected: eight rejected baseline views, four
rejected oversized-pulley candidate views, and four corrected layout views.
None is accepted as a final mechanical reconstruction. The local
[`082-layout-study-checkpoint.json`](082-layout-study-checkpoint.json) freezes
the ten study sources and their evidence; `082-candidate-inspections.json`
records the image reviews. Bulk evidence is local as described in
[`artifacts/README.md`](../README.md).

The last production result remains movement 081's 3,100 numerical tests,
build, and targeted desktop/mobile browser pass. No new whole-app test or
all-507 browser pass is claimed for this study. The full-507 review remains
active, including unresolved 037, 063, 071 and 073.
