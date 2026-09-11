# 061 · Rebuilt and verified

The existing factory is archived in `061-original-factory.txt`; original
geometry, timing and camera are in `061-baseline-parameters.json`. The replacement is now integrated in src/simulation/held-side-differential.js
and held-side-differential-motion.js. Candidate modules re-export production.
The full catalog remains unfinished, with 037 still unresolved.

## Source

[The official page](https://507movements.com/mm_061.html) is saved in
`../reference/mm_061.html`. Its animation tab is explicitly unavailable.
Brown's unchanged enlarged image, `../reference/brown-061-detail.png`, is
from PDF page 24 (one-based), scale 6000, crop (1800,980,1100,1460). The
printed description is on PDF page 25 (printed 21), saved in
`../reference/brown-page-25.txt`.

A broad upper drum drives one flat band across three lower pulleys. The
left pulley is loose/neutral; the middle is fixed to the output shaft and
has a small bevel gear on its hub. The right pulley is loose on the shaft
and carries a transverse planet bevel. An opposed third bevel runs loose
on the shaft but is held by a weighted friction band. Direct drive gives
shaft speed equal to the driver; carrier drive gives twice that speed when
the opposed gear is held. The friction restraint permits transient slip.
The current demonstration constrains it stationary and stops between
selection changes; it does not simulate the source's transient friction.

The source shows large smooth pulleys, a continuous broad driver drum, a
flat band with torn-end interruption, a compact differential mostly inside
the right pulley, and a small external brake drum. Dashed lines indicate
hidden internal structure. The original model instead places an exposed
large differential after three comparatively small pulleys. A negative-x
side camera follows the source order in this project's z-axis convention.
A physical reconstruction will need hollow pulley interiors and an
explicit section view to explain the hidden train while retaining a complete
assembly for the source silhouette. Exact hidden bearing/web construction
and tooth counts are not specified by Brown.

## Read-only source measurements

`scripts/measure-held-side-differential-source.mjs` records explicit
unoccluded column regions and median first/last dark pixels. Its companion
JSON retains all columns. These are outline measurements, not gear counts.

| Feature | Top | Bottom | Center |
| --- | ---: | ---: | ---: |
| Upper drum | 119 | 668 | 393.5 |
| Upper shaft, left | 349 | 424 | 386 |
| Upper shaft, right | 352 | 423 | 388.5 |
| Neutral pulley | 814 | 1354 | 1084 |
| Direct pulley | 807 | 1354 | 1081 |
| Carrier pulley | 808 | 1356 | 1082 |
| Output shaft, left | 1029 | 1111 | 1070 |
| Brake drum, left | 997 | 1156 | 1076.5 |
| Brake drum, right | 992 | 1153 | 1072.5 |

Shaft and pulley centers disagree by up to about twelve scan pixels. A
replacement should keep physically concentric shafts and record its
residuals. A provisional 200-pixel/unit scale suggests pulley radius about
1.37 and shaft spacing about 3.43, unlike old radius 0.61 and spacing 2.02.
Approximate visual axial spans are upper drum x=310..800 and lower pulleys
x=350..484,484..616,616..760. Dashed gear structure spans about x=568..750,
y=956..1195, with its apparent center near (660,1076). Those hidden landmarks
still need a candidate-mesh overlay and are not exact engineering dimensions.

## Baseline mechanical findings

`061-bevel-contact-baseline.json` samples both differential mesh pairs in
both directions over 65 poses covering one carrier-relative tooth pitch.
The harness inverts the direct dwell to reach every required phase. Across
**1,757,600 actual tooth-surface checks**, it finds **zero penetrating
samples**; per-pair minimum gaps range from 0.001300123 to 0.001315221.
Collapsed zero-area faces from the old zero-radius bore are excluded (768
faces). This establishes sampled clearance for the existing back-cone
involute approximation, not exact manufactured conjugacy or tight working
contact. The old gears have conical heels/toes already; the outstanding
problems include packaging, hardware intersections and substantial backlash.

`061-hardware-baseline.json` samples the band against all upper treads and
lower pulley bodies/rims through 97 demonstration poses, plus selected
independent shaft, sleeve, arm and drum pairs. Dynamic band caches refresh
with the position attribute's version. The result is **314,073 penetrating
samples in 2,310,288 checks**:

- The round band penetrates the upper treads by up to 0.040636923 and lower
  torus flanges by up to 0.038463400.
- The carrier sleeve passes through the output gear body (99,328 samples,
  maximum depth 0.231682313) and its solid hub (99,328 samples, depth
  0.091444173).
- Brake-drum surface points lie inside the output shaft (194 samples).
- The carrier arm crosses the independently turning output shaft (485
  samples).

This is a scoped defect probe, not an all-pair clearance proof. An initial
harness attempted to inspect the carrier arm Group as a mesh and failed
before producing a report. It was corrected to inspect the actual BoxGeometry
child; the final probe exits zero and records all completed checks.

`061-exact-hardware-baseline.json` independently checks actual triangle
surfaces at the initial pose for the transverse axle/output shaft,
carrier arm/output shaft, brake drum/output shaft and friction curb/drum.
All four pairs have zero triangle distance, confirming intersecting skins.
The crossed axle is especially important: sparse samples along its long
triangles miss that intersection. Exact triangle tests catch it. No claim
of collision freedom may be based solely on the earlier sample count.

## Reconstruction requirements established during baseline review

Retain the source's neutral/direct/double-speed sequence and differential
identity: output plus held-side speed equals twice carrier speed. The
planet's relative spin follows the actual opposing bevel contacts. Replace
round bands and traverse flanges with a continuous flat band over smooth
cylindrical treads. Pulley bores, carrier bearings and the brake drum need
real clearance around the output shaft. A radial planet spindle should end
outside the main shaft, and connect to the carrier pulley without a solid
arm through that shaft.

Fit the bevel train into the hollow source pulleys, preserve conical tooth
ends and involute flanks, then verify both torque flanks, all independent
hardware pairs, actual band contact and the brake restraint. Supporting
bearing constraints and stopped shifts must be stated as idealizations.
The implementation and current evidence are recorded below.

All three baseline frames at phases 0, 0.34 and 0.59 have now been inspected,
after the 060 browser suite exited zero. They confirm reversed source
orientation, undersized pulleys and a large exposed differential outside
its source enclosure. The band is round and the added ground shadow and
support frame remain. Those captures preserve the pre-reconstruction production state.

## Integrated reconstruction

The archived factory was compared exactly (19,299 characters). It is retained
as legacyDifferentialSelectorForMovement62 because the unreconstructed 062
factory depends on it. Movement 061 uses its separate replacement.
The old 12,641-character test is archived as `061-original-test.txt`. Production
uses 19 physical solids in the driver, output, loose pulley, carrier, planet,
held bevel/brake and fixed restraint families. Two nonphysical section-cap
pairs close the displayed cut at x=0; they are separate from all physical
collision checks. Toggling Section view preserves every physical transform.

Source projection is negative x, at 200 pixels/unit with origin (550,1078.5).
All upper/lower pulley radii are 1.3675. Upper shaft height is 3.44; drum span
is z=-1.2..1.25. Lower lane centers are -0.665,0,0.69 with widths 0.65,0.65,
0.71. The middle pulley is a cup with its web at the source-left side; the
carrier has a source-right web and a hollow interior of radius 1.18. The
output shaft radius is 0.205. The loose pulley and held-side gear bore radii
are 0.211. The carrier's radius-0.266 bore runs on the held-side radius-0.26
sleeve, which itself runs on the output shaft. This concealed bearing choice
avoids the previous sleeve passing through the output bevel body.

The differential apex is z=0.545. Two equal 26-tooth side gears mesh with one
20-tooth transverse planet. These counts are inferred from the compact axial
and radial envelopes, not specified by Brown. Pitch-cone angles are
atan(26/20) and its complement. Side inner/outer axial distances are 0.25
and 0.44; planet distances are scaled by 26/20, sharing common cone distances
and module. Tooth height is 0.085 and thickness factor 0.999, with 20-degree
back-cone involute flanks and conical heels/toes. This remains a Tredgold
approximation rather than a manufactured octoid construction.

The planet spindle, radius 0.055, ends at radial distance 0.24 from the main
axis and connects outward to the carrier rim at 1.20. It no longer crosses
the output shaft. The planet has a real radius-0.061 bore and two carrier
collars with 0.006 axial clearance. The brake drum radius is 0.4, spanning
z=1.15..1.85. Its sleeve is hollow. A flat 0.17-wide, 0.025-thick friction curb
wraps its upper half with 0.00015 radial clearance; one tail is ideally
anchored and the other supports a small weight. The holding brake is static
in this demonstration; transient slip, friction, elasticity and inertia are
not solved.

A continuous flat belt of width 0.34 and thickness 0.02 traverses neutral,
direct, carrier/double-speed, then direct. The neutral-fiber radius includes
half the thickness and 0.00015 clearance. Each 2.4-second authored dwell
turns the upper drum half a revolution; each stopped traverse takes 0.9
seconds with quintic interpolation and zero endpoint velocity/acceleration.
The authored cycle is 13.2 seconds. A common measured display scale of
2.9464436467285084 gives a 4.479977078352137-second displayed cycle, preserving
all ratios and the held-side differential relation. Ground is hidden; source
FOV is seven degrees and the complete-view direction is (-8,3,6).

## Geometry, contact and motion evidence

The first coarse tooth sampling had maximum pairwise normal-force power
residual 0.674 percent. The shared bevel generator now accepts optional flank
and tip sample counts while retaining its original defaults. Twelve exact
typed-array/metadata comparisons against the archived original generator
cover four tooth counts and three cone angles; all default outputs are
identical (`061-bevel-default-compatibility.json`). Only 061 requests 64
flank intervals and 16 tip intervals. The 17-pose refined initial contact
check reduced the maximum sampled residual to 0.175 percent. Coarse reports
are retained with a `-coarse` suffix.

All 19 refined physical solids have positive volume, nondegenerate triangles,
outward corner normals and closed paired oriented edges. Across **97 poses
and 153 independent part pairs, 171,138,216 bidirectional surface samples
find zero penetrations**. This includes both entire gear skins and hardware;
no independently moving tooth pair is excluded. The initial 17-pose coarse
hardware report is retained separately.

Four directional bevel reports check **129 phases on each of both flanks of
both mesh pairs (516 rows)**. Target flank triangles are selected by the sign
of compressive torque about the actual side-gear axis; meridional heel/toe
caps are excluded from load selection. All source planet triangles remain.
Actual working gaps are **37.035 to 40.295 microunits**, and maximum pairwise
normal-force power residual in the carrier frame is **0.211 percent**. Full
skin collision checks remain separate from this directional surface selection.

`061-candidate-exact-contact.json` contains 61 actual 3D triangle checks:
16 selector-band contacts, one friction-curb contact, and 44 critical hardware
rows across four poses. Working contacts all have small positive gaps.
Hardware values above 0.01 certify that lower bound; smaller values give the
actual closest points. These explicitly cover the previous crossed-shaft,
carrier bearing and brake-drum failure modes.

`061-candidate-motion-check.json` checks 21 times, including negative and
multiple cycles, all transition boundaries and all four stopped shifts.
Actual angle/translation/flow derivatives differ from their declared speeds
by at most 5.263e-10. At 4,368 sampled neutral-fiber wrap points the maximum
relative velocity residual is 3.495e-13. Common-apex pitch-contact velocity
residual is below 4.612e-16. Matrix/color seeking is repeatable and independent
of the section toggle. These are finite geometry/kinematics checks, not a
certification of arbitrary unsampled collisions or a friction/inertia solver.

The actual-mesh source overlay is `061-source-alignment.html`; all measured
pulley-body, shaft and brake-drum top/bottom residuals are within nine scan
pixels. The hidden-envelope option also shows the compact bevel train.
This bound excludes schematic band arches, torn ends and inferred hidden
construction. Candidate section/source/oblique/rear/shift/quick/complete views
have been inspected. All six integrated source/complete frames at phases
0, 0.31 and 0.59 have also been inspected. Five focused tests pass in
56.561 seconds. The gallery contains 250 comparisons.

The initial full regression found six numerical failures and one browser
sweep failure, all caused by removing the legacy constructor still used by
062. That exact archived helper has been restored exclusively for 062; its
existing movement test passes and the build succeeds. Initial failed logs
and exit statuses are preserved with the 061-initial-regression prefix.
The repaired registry passes all **2,977 numerical tests** (wrapper code 0,
141.701 seconds). The build passes in 9.88 seconds. All **21 browser tests
pass**, including all 507 rendered canvases and the dedicated 061 controls
test (one worker, wrapper code 0, no signal, 795.392 seconds). The final
record is rebuilt-and-verified. The 037 engagement problem and review of
062 onward remain outstanding; these results do not complete the catalog.

Subsequent 062 reconstruction: the temporary legacy base and its old 062 wrapper
were removed after exact comparison with their archived originals. Rebuilt 061
is unchanged and no longer has a legacy consumer to preserve. The 062 review
records the newer regression results and moves the next pending entry to 063.
