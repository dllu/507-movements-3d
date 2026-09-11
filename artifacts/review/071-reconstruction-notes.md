# 071 · Internal guard and tappet index

071 production is unchanged. Its original factory and test, official page,
source PNG and enlarged Brown crop are archived and hashed. The
[official page](https://507movements.com/mm_071.html) marks its animation
unavailable; no official animation was played or reviewed.

The Brown crop is PDF page 26, printed page 22, at scale-to 6000,
x3100/y1180/width1480/height1270. The source and the
[numbered overlay](071-source-stud-readings.png) are inspected. Ten circular
marks lie around the output orbit. An additional distinct ring, labeled X
in the review overlay, lies well inside that orbit at (622,734). Its role
is unresolved; it has not been discarded or modeled as an invented part.

The output-circle fit gives center (434.992,767.530), radius 376.787 pixels
and RMS residual 4.018 pixels. The driver has an outer solid circle of
radius 410.905, a smaller solid circle of radius 366.530, and a dotted
circle of radius 335.419. Their RMS residuals are 1.250, 1.013 and 3.655
pixels. The ten outer marks fit an orbit of radius 315.857 with RMS 6.347.
The extra mark is only 189.990 pixels from the output center. All readings
are retained in `071-source-layout-study.json`.

The source center-spacing/output-radius ratio is 1.26622. A preliminary
circle-seat comparison favors three studs inside the guard, with the two
extreme studs serving as stops, over the original arrangement with just
two interior studs. This remains a geometric hypothesis. The separate
notches, finite tappet motion, extra inner mark and three driver circles
must still receive a coherent mechanical interpretation.

The baseline audit covers **200 poses, 44 working-part pairs and 14,216,800
actual Float32 surface checks**. It finds **2,813 penetrating samples**:
2,750 tappet/stud samples reaching depth 0.07732754 and 63 guard/stud samples
reaching 0.00013251. The first tappet collision precedes the declared index.
The first guard collision occurs during the declared locked dwell. Its
witness lies inside the nominal circular hole, exposing the discrepancy
between that circle and the rendered polygonal inner guard.

The specified lower tappet face is y=−0.055, but the extrusion bevel moves
the actual flat face to −0.071800001. A compressive force along that actual
flank has the wrong output moment and negative motor work in all **97
claimed contact poses**. This diagnoses the specified flank; it does not
assume those declared points are real contact or certify another path.
Diagnostic exits are preserved and do not constitute acceptance.

The first 25 isolated motion trials use three interior studs, the traced
tappet, and two radial opening families. None produces a continuous full
index. Narrow lower openings fail early; the other variants fail at about
0.39463 radians of advance and require a disconnected jump to one full
pitch. These are rejected diagnostic profiles, not replacement candidates.
The detailed oblique notch edges and extra inner source mark are not yet
represented. The process exits zero in 1.826 seconds because the trial
study completed; its failed results remain in the report.

Four original 3D frames at phases 0, 0.034, 0.112 and 0.17 are captured,
inspected and hashed. The capture exits zero in 4.695 seconds. They confirm
the added framing, face rings and indicators, oblique source view and wrong
cover ordering. The default two-second cycle compresses the index to about
0.170 seconds. The main review gallery now contains 338 comparisons,
including failed baselines. Reconstruction, complete hardware clearance,
contact forces, locking, source fit and playback verification remain pending.
The complete 507-movement goal remains active.

Further isolated studies locate the earlier jump at the **entering stud against the upper guard**, rather than a loss of tappet continuity. With the guard removed, the traced tappet advances 0.580125 radians smoothly and stops short of one pitch. Moving the radial upper opening from −0.4 to −1.0 radians permits a complete projected step, but does not preserve the source notch location or establish valid forces.

All 24 extra-pin starting configurations collide immediately. Another 36 spacing/angled-notch trials and 63 tip/lower-notch trials fail to complete a valid single step. Six 8,320-step long-tip refinements resolve steep motion missed by the coarse increment cutoff; they subsequently overdrive the requested pitch or jam, with peak speed ratios between 22.58 and 38.80. These results do not justify claiming every coarse failure was disconnected. Full reports and wrapper exits are retained; the direct long-tip diagnostic also exited zero. No trial is accepted.

071 is now explicitly **mechanically unresolved**. Production remains unchanged and its known failures remain recorded. Continue the remaining source review at 072, with 037, 063 and 071 still requiring correction before the full goal can be complete.
