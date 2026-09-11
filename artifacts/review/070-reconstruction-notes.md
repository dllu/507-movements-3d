# 070 · Open-rim tappet and stud index

070 is rebuilt, integrated and verified. All eight focused tests,
**3,042 numerical tests and 30 browser tests pass**, with the production
build. The full browser run exits zero with no retries in 1,007.116 seconds.
The original factory, test and four inspected baseline views are preserved;
the images now use `070-original-phase-*` names. The baseline had confirmed
penetration, the wrong contact-force direction, an oblique source view,
added rails/rings/indicators and reversed cover ordering.

The [official page](https://507movements.com/mm_070.html) marks its Animated
tab unavailable. No official 070 animation was played or reviewed. Brown's
text describes the outside of the raised driver rim stopping the output
studs between strokes, with an opening for entering and leaving studs and
a tappet opposite that opening. The source is the engraving and description.

The Brown enlargement uses PDF page 26, printed page 22, at scale-to 6000,
cropped x1600/y1180 to 1510×1270. All ten studs are individually marked in the
inspected [numbered overlay](070-source-stud-readings.png), including the
hidden stud shown with a dashed outline. The output's right edge and the
tappet are behind the driver cover in the engraving. A reconstruction should
preserve that depth ordering and provide an explicit view of hidden parts.

First-stroke radial midpoints on the visible output arc give center
(444.325, 758.530), radius 380.316 pixels and RMS circle residual 1.523 pixels.
The outer driver fit gives center (1088.420, 773.048), radius 406.364 and RMS
3.279 pixels. Eighteen manual dashed-rim marks give radius 371.499 and RMS
3.311 pixels. Ten stud-center readings give orbit radius 318.172 and RMS
3.169 pixels. These are approximate ink measurements, not working geometry.

The source driver/output radius ratio is 1.06849, the dotted-circle/driver
ratio is 0.91420, the stud-orbit/output ratio is 0.83660 and the
center-spacing/output ratio is 1.69401. The original model used 1.10938,
0.82928, 0.84375 and 1.75781. The first layout comparison treated the dotted
circle as the rim exterior; subsequent finite-stud studies showed that it
is consistent with the **rim interior**, with the solid circumference as
the exterior. One stud rests inside during dwell and the neighboring studs
lock against the exterior at plus/minus one pitch. This interpretation sets
shaft spacing only 1.103 pixels from the source reading.

The baseline sweep covers 200 poses, 33 working-part pairs and **12,160,800
actual Float32 surface samples** in both directions. It includes the driver
plate, rim and tappet against the output plate and all ten studs. There are
**2,750 penetrating samples**, all between the tappet and stud zero, reaching
0.07732754 model units in depth. The first recorded witness occurs before
the prescribed indexing interval. The sampled rim and plates clear; this
does not certify the remaining shafts, hubs, framing, topology or forces.
The diagnostic exits zero in 1.113 seconds because it completed, not because
the mechanism passed.

The motion calculation uses the nominal lower tappet flank at local
y = −0.055. The rendered extrusion bevel expands the actual flat side to
y = −0.071800001. Recovering its real Float32 side triangles confirms this
0.0168-unit discrepancy. More fundamentally, that is the trailing face for
the declared counterclockwise input. A compressive force from it gives
counterclockwise output torque where clockwise motion is prescribed, and
negative motor work in all **97 sampled declared contact poses**. This is a
diagnosis of the specified flank, not a solver for alternative contacts.
Its exact process exit and per-pose moments are preserved.

The existing two-second input cycle puts the index in about 0.170 seconds.
A replacement should verify actual contact and stopping first, then choose
a readable default working interval. Correcting the force direction without
checking the finite stud, tappet tip and rim opening is insufficient.

The first numbered-overlay raster lacked its embedded background because
the SVG converter required an xlink image reference. That failed raster is
preserved as `070-source-stud-readings-missing-background.png`; the corrected
overlay was viewed and hashed. This is a capture artifact, not source evidence.

The reconstructed tappet retains its four traced corners, with only a
0.005-unit tip shortening (1.486 source pixels). This avoids an early
collision with a stud still held by the rim. The opening has half-angle
0.5 radians. The initial source angle is preserved; no separate output
phase adjustment is used to improve the overlay.

The first outside-stud profile family did not produce an acceptable full
step. An interior-stud family at smaller spacing established the contact
arrangement, but required excessive source changes. The final source-ring
family completes one pitch with the small tip adjustment. All trial reports
and process exits remain archived. Exit zero on a study means that the
diagnostic completed, not that every tested profile passed.

Projection refinements at 1,040, 4,160 and 8,320 steps exposed velocity
errors at sampled engagement and release instants. The final motion uses
closed-form finite-stud contact with straight sides and corners. Geometric
events resolve entry, both side/corner transitions, maximum tappet reach,
rim entry and final circular locking. The independent full-turn analytic
audit passes **10,022 poses**; its largest difference from the finest
projection is 1.0292e-7 radians. Peak output speed is 1.674816 radians per
authored second, and closure is exactly one pitch per input turn.

The main tappet action ends at 0.62646698 radians of advance. Passive
bearing resistance holds a short pause; the closing rim completes the
remaining 0.00185155 radians. At the default five-second input cycle, the
main stroke takes **0.5119 seconds**, the pause 0.3514 seconds and the small
closing movement 0.00964 seconds. The resisting load, bearing resistance
and idealized engagement impacts are explicit model assumptions. Finite
inertia and unloaded coasting are not certified.

All **eighteen solids** pass actual Float32 winding, paired-edge, volume,
degeneracy and normal checks. The complete 3D audit covers **117 poses,
65 moving-part pairs and 452,216,700 surface checks**, with no penetration
above 1e-6. It includes the cover even when section view hides it. All
**189 active contact-force cases and twenty locking-force cases pass**.
Both seats at all ten output positions clear, and each attempted 0.001-radian
overtravel is blocked; that audit makes 38,339,040 checks. Full angular play
is 0.0003177103 radians.

The first complete candidate used 1,024-sided studs. It cleared the hardware
sweep but failed twelve late-stroke power checks because of coarse contact
normals near stopping. Its factory and failed report are preserved. The
accepted candidate uses 4,096-sided studs with unchanged dimensions, motion
and tolerances: 2e-6 proximity, 0.002-radian normal-cone allowance and 1.5%
relative power residual.

The [common actual-mesh overlay](070-refined-source-overlay.png) retains all
**153 readings**. Maximum/RMS pixel residuals are 3.707/1.560 for the output
circle, 17.831/3.307 for the driver circle, 11.223/4.867 for the dotted inner
rim, 0.937/0.755 for the tappet corners and 35.710/17.125 for stud centers.
Brown's irregular stud spacing is preserved in these residuals. Exact
superposition of all stud centers is not claimed.

All ten candidate views, the overlay and all ten integrated source/section/
oblique/rear/event views are inspected and hashed. The front cover has the
source depth ordering; the section toggle reveals working contacts. All
eighteen mesh buffers and twelve pose transforms exactly match the audited
candidate. All 780 files match the verification snapshot after the completed
regression run. Numerical verification exits zero in 225.689 seconds, and
the build exits zero in 12.554 seconds. The gallery contains 334 comparisons,
including earlier failed baselines. Both desktop and mobile captures are
inspected and hashed. All 507 canvases pass the browser render sweep, and
the new 070 interaction test passes in 20.8 seconds. Fourteen historical UI
images are restored from verified backups; fresh regression copies are
archived separately without claiming they were all inspected again.

The complete 507-movement goal remains active; 037 and 063 remain unresolved.
