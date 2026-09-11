# Movement 082 reconstruction study

Status: **in progress; not integrated or mechanically verified**. The current
study measures the engraving, constructs a fixed-pin treadle linkage, and
builds a provisional 35-solid candidate. All 904 frozen production inputs
remain identical to commit `c13f7ec03ee2dd2d7c0ccb5b0b560373f14fa97e`.

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

## Candidate checks and remaining work

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
