# 073 · Spring-pressed ratchet

Production remains unchanged. Baseline diagnosis requires a rebuild; the
replacement is an isolated source-based elastic study with an unresolved
3D spring arrangement.

The [official description](https://507movements.com/mm_073.html) places bent
spring B on continuously rotating wheel D. Fixed spring C presses B into
ratchet A and also serves as its stop. The animation tab is unavailable.
The enlarged Brown engraving is PDF page 26, printed page 22, scale-to 6000,
crop x3140/y2580/1250×1170. It has **ten teeth**, whereas the current factory
and its tests require eight. The ten tips are labeled in the inspected source
overlay. Their angular spacing is slightly uneven in the drawing.

The baseline sweep covers 174 poses and twelve working-part pairs, totaling
5,069,142 actual Float32 surface samples. It finds 1,575 samples of B inside
C's stop pad, to depth 0.0540503, and 634 samples of C inside B's catch pad,
to depth 0.0228893. The four closed working solids clear each other. The open
tube springs are only sampled against closed solids; they are not used as
inside/outside targets. Remaining support hardware is not certified.

At all 55 sampled indexing poses, the declared B/C centerline separation is
purely axial. Its ideal frictionless tube-contact normal has zero inward
component and zero motor work, while the animation prescribes full in-plane
deflection of B. Moreover, the actual nine-sided tube skins remain 0.00211075
apart in the selected declared-contact poses. The catch pad's force on the
ratchet itself has the correct driving sign in all 55 cases. This separates
the failed spring interaction from the locally correct tooth force direction.
No finite jump was found at the four stage boundaries in the small-step check.

The source driver circle fits 29 unobstructed radial readings with 2.166-pixel
RMS error. Thirty readings of the upper tooth flank fit a circle with
0.558-pixel RMS error. The initial outward scans hit the letter A and parts
of spring B before the desired outline; the refined scans read inward from
outside. Initial readings and the unsuccessful background-free overlay are
preserved. The corrected overlay was inspected.

The isolated profile repeats a measured circular flank ten times, with a
short inclined tooth face and a common shaft center. Manual source tip
positions fit a 267.224-pixel circle to 0.698-pixel RMS; regular 36-degree
spacing requires a maximum angular adjustment of 4.901 degrees. The common
overlay shows the resulting approximation, rather than claiming exact fit.

The first manual C centerline was biased toward its inner edge. It is
replaced by midpoints of the two visible boundary strokes at ten heights.
The source spring tapers. Seven width readings on the free leaf fit a linear
taper from 30.682 to 28.054 pixels with 1.388-pixel RMS error; every fitted
width lies within the observed boundary strokes. This replaces the initial
32-to-24-pixel estimate in the latest elastic studies.

The isolated solver now uses inextensible discrete elastic leaves, a clamp
at the source support top, unilateral spring contact and independent tooth
arc/face reactions. A round tip seated in a notch needs both surface normals;
the earlier nearest-surface reaction was insufficient. Four endpoint witnesses
resolve parallel spring contact. The continuous-taper clearance agrees with
2,787,888 independent grid samples, and full force-gradient checks pass at
five saved poses. The multiplier solve checks equilibrium after updating
reactions. Floating-point line-search stagnation is explicitly reported.

The latest layout places the leaves in front of A with axial end tabs reaching
the wheel. This is a hypothesis, not a completed 3D assembly. With C/B bending
stiffness ratios 24 and 96, the selected continuation branches lose both wheel
contacts at input angles 267 and 271.5 degrees. The wheel-travel diagnostic
bound is not a physical stop. The run terminates there without acceptance.

A separate diagnostic fixes the wheel at the preceding angle and equilibrates
the springs at the release input. Local Newton polishing reduces the remaining
beam-force residuals below 1.49e-7, with penetration below 9.70e-10. Both tips
remain beyond the wheel's entire circumcircle: B by 0.018733/0.010791 and C
by 0.205145/0.219414, normalized to the wheel tip radius. Thus neither tip
can supply the missing stop reaction in these spring poses, at any wheel
orientation. Earlier polishing failures and five intentionally cancelled,
superseded solver runs remain archived. This diagnoses these selected planar
layouts and branches; it does not exclude a different 3D spring arrangement.

The next 073 task is to resolve how B passes beneath C while C recovers its
stop contact, then verify full-cycle release, holding, repeatability, dynamics,
hardware clearances and source fit. No candidate is accepted for integration.
The checkpoint records the studies, inspected diagrams and source hashes;
all 785 files in the verified 072 production snapshot still match.

Six baseline browser frames are captured, inspected and hashed, covering the
source pose, press entry, drive entry, mid-drive, drive exit and release end.
They show the eight polygonal teeth, round wire springs, extra indicators and
rail, and oblique source camera. The fixed spring visibly contorts during
indexing. No production replacement has been integrated.
