# 069 · Small single-tooth locking drive

069 is rebuilt, integrated and verified. All **3,034 numerical tests** and
**29 browser tests** pass, with no failures or retries, along with the build
and eight focused tests. The full browser run exits zero in 977.903 seconds,
including all 507 rendered canvases. Ten integrated
front/oblique frames and ten candidate/source-overlay frames are inspected
and hashed. The old factory, test and four baseline frames are preserved.
The 069 checkpoint contains 324 gallery comparisons, including failed baselines.

The replacement has thirty asymmetric teeth, one broad source-traced input
tooth, and six closed physical solids in two rigid families. The old framing,
face rings and indicators are removed. An axial source view, hidden ground,
and a three-second displayed input cycle keep the mechanism readable.
Two teeth (24 degrees) advance per input turn; fifteen turns rotate the output
once. The working interval occupies about 0.813 seconds at default speed.

The profile uses independent Brown ink readings and shape-preserving radial
interpolation, with a manually traced straight-sided driver and curved reliefs.
No official animation path coordinates are copied. Locking fit reduces the
source center spacing by 14.352 pixels at the common registration scale.
The input tooth is shortened by 18.985 pixels and the output roots deepened
by up to 18.985 pixels to obtain a viable two-tooth path. These differences
are explicit; the reconstruction is not an exact copy of the irregular ink.

The actual Float32 boundaries use one shared orthographic scale and anchor.
All 201 marked or bounded radial ink readings are retained in the final fit,
including fifteen long crossings flagged as less certain. Maximum/RMS
residuals in the 1150×1330 crop are:

| Boundary | Readings | Maximum px | RMS px |
| --- | ---: | ---: | ---: |
| Driver circle | 15 | 14.823 | 8.630 |
| Driver tooth | 6 | 28.066 | 16.949 |
| Output tips | 30 | 22.664 | 9.450 |
| Output flanks | 120 | 25.158 | 10.569 |
| Output roots | 30 | 16.558 | 8.587 |

The inspected overlay is [069-all-readings-source-overlay.png](069-all-readings-source-overlay.png).
Tip readings use smoothed inner ink crossings, which bias their radius inward.
The source profile was informed by these readings; fit is separate from
mechanical validation. The preliminary fit that omitted fifteen long crossings
is preserved, but the complete 201-reading fit is authoritative.

The actual six-solid sweep passes **38,176,776 surface checks** over 86 poses
and all nine independently moving pairs, with no penetration above 1e-6.
All **124 active contact-force cases** and **60 seated locking-force cases**
pass. Force directions must belong to the physical edge-normal cones on both
bodies, exert clockwise output torque and agree with relative contact power.
Gap tolerance is 5e-6, cone angular tolerance 0.002 radian and relative power
tolerance 0.015. The smallest accepted output moment magnitude is 1.567587.

All thirty teeth are also checked at both locking seats. **60 cases and
10,381,830 surface checks** confirm that valid seats clear, while a deliberate
0.001-radian overtravel into either flank produces a penetrating witness.
Full angular play is 0.000232654 radian (about 0.01333 degree). These prohibited
penetrations establish locking and are distinct from the clear operating sweep.

All six parts pass closed-edge, triangle winding, nondegeneracy, signed volume
and stored-normal checks. Initial redundant collinear stem points produced
eighty degenerate triangles and 224 unmatched edges. Removing those redundant
points before extrusion preserves the outline and fixes the topology. Exact
geometry hashes connect that passing topology to the final candidate and
production. Ten world-matrix comparisons show zero production/candidate error.

The loaded contact projection is refined from 2,600 to 5,200 phase intervals.
Matched output advances differ by at most 1.269e-8 radian; the peak speed
changes by 8.112e-6 to 0.453698 radian per authored second. Explicit entry
knots prevent interpolation into preceding dwells. At input angle
4.32777199937, the actual Float32 wheel tip meets the driver's rim/relief
junction at the exact repeating seat. This replaces a final interpolated
half-step that failed one force test, and removes the old 7.818e-8-radian
closure residual continuously. The original projection error is retained in
the profile metadata.

A short internal pause occurs near input angles 3.869–3.979749 before the
remaining part of the index. Passive bearing resistance holds it in this
quasistatic model. The circular rim supplies the long inter-cycle lock.
Finite-inertia impacts, unloaded coasting and material/contact compliance
are not certified. The product note states the resisting-load, bearing
resistance and impact idealizations.

All thirteen profile trial reports and their exact process exits are preserved
in 069-reconstruction.json. A completed diagnostic can exit zero even when
the profile jams, so those trial exits are not acceptance. Initial topology,
final-half-step force and test-harness failures are also preserved. The first
focused test run had three signed-zero assertion failures; comparing speed
magnitudes resolved those without changing geometry or motion.

The verification snapshot contains 775 source, test and configuration files.
Twelve previously inspected desktop/mobile frames are saved before the full
browser run. Numerical verification passes in 210.750 seconds and the build in 36.159
seconds. Both desktop/mobile frames are inspected. All 775 verification files
remain unchanged. Twelve historical UI frames are restored from verified
backups; this run's fresh copies are archived separately as uninspected
regression captures.

## Preserved baseline and reference review

At the baseline checkpoint, production was unchanged. The enlarged Brown engraving shows **thirty teeth**,
where the current 3D model has twenty-four. An inspected numbered overlay
marks all thirty distinct tips (`069-source-tooth-readings.png`). The source
also shows an asymmetric sawtooth outline and a substantial straight-sided
driver tooth. Production substitutes narrow radial slots and a thin shank
with a separate round head.

The [official page](https://507movements.com/mm_069.html) describes the small
wheel's rim locking the larger wheel between driving actions. The official
animation is available and has been inspected in six live frames and nine
controlled phases. Static inspection shows twenty-four repeated wheel arcs and a
prescribed 30-degree index over the first quarter of the input cycle. That
simplification does not override the thirty teeth visibly drawn in Brown,
and prescribed animation is not mechanical proof. Its path coordinates are
not being copied into the reconstruction.

The Brown crop is PDF page 26, printed page 22, at a 6000-pixel page scale,
x470/y1180 with dimensions 1150×1330. A circle fit to fifteen manually marked
points on the driver gives center (907.912, 622.641), radius 94.924 and RMS
residual 1.259 pixels. The thirty detected tip readings give center
(498.190, 827.063), radius 352.452 and RMS residual 3.650 pixels. Those output
readings use smoothed inner ink crossings, so line width biases the radius
inward. Center separation is 457.887 pixels; the line of centers rises
26.516 degrees toward the driver. These are approximate source layout
measurements, not a completed registration or physical working profile.

Median ink-stroke crossings between adjacent tips put the representative
outer radius near 358.25 pixels and the root near 321.44 pixels. The root
occurs around 60% of the counterclockwise interval between tips, consistent
with the visible asymmetric tooth. One damaged-outline sample is omitted
from the 70% median. Full readings and qualifications are in
`069-source-tooth-section-study.json`.

The baseline working-surface audit covers 200 poses, three moving pairs
and 9,324,000 bidirectional actual Float32 triangle vertex, edge-midpoint
and face-center samples. It finds **2,627 penetrating samples**: 2,219 for
the shank against the wheel (maximum depth 0.06014157 model units), and
408 for the round head (maximum depth 0.00757760). The main driver rim has
no sampled penetration. The diagnostic exits zero in 1.784 seconds because
it completed; this is a failing mechanical baseline, not acceptance.
Other hardware, topology and force balance are not certified by that audit.

The original factory and test are archived and hashed. Four 3D baseline views at authored phases 0, 0.071, 0.18 and 0.287 are
captured, inspected and hashed. They confirm the added framing, face rings,
white indicators, oblique view and different starting tooth orientation.
The baseline capture exits zero in 4.601 seconds.

The successful official capture exits zero in 4.922 seconds without page
errors. Nine controlled phases span entry, indexing, disengagement, dwell
and the cycle seam. Six live frames independently show the running animation.
The first capture attempt stopped when the official library rejected a
second animation wrapper on the same 2D context; its log and six uninspected
partial frames are preserved. A fresh canvas after stopping the live instance
resolved that capture issue without changing the reference model.

That baseline checkpoint preceded the reconstruction above. The review gallery now contains 318 comparisons; it includes
failed baselines and does not imply that all shown mechanisms are accepted.
