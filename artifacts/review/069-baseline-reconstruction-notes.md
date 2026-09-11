# 069 · Small single-tooth locking drive

Production is unchanged. The enlarged Brown engraving shows **thirty teeth**,
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

The thirty-tooth reconstruction and complete contact/locking assessment
remain pending. The review gallery now contains 318 comparisons; it includes
failed baselines and does not imply that all shown mechanisms are accepted.
