# 063 · Source and baseline review; reconstruction pending

Production 063 remains unchanged. Its original factory, four construction
helpers, test and parameters are archived as `063-original-*.txt` and
`063-baseline-parameters.json`. All four baseline captures at authored event
phases 0, 0.43, 0.63 and 0.78 are saved and visually inspected. They were made
after the complete 062 browser suite exited zero. The catalog remains unfinished;
037 and 063 are unresolved; review continues with 064 onward.

## Source and working interpretation

[The official page](https://507movements.com/mm_063.html), saved as
`../reference/mm_063.html`, marks its animation unavailable. It describes a
spring-carried drop and attached pawl lifted by pins in the right disk. A pin
escapes the pawl first, allowing it to enter the next star-wheel space. When the
pin then escapes the drop, the spring drives the drop down; its striker drives
the pawl and advances the star. The sequence repeats for each driver pin.

The unchanged Brown enlargement is `../reference/brown-063-detail.png`:
PDF page 24 (one-based), scale 6000, crop (490,2400,1360,1320). The printed
description is on PDF page 25, printed page 21. Both enlargement and page have
been inspected. The source shows three disk pins, a ten-point star, a left leaf
spring, and two overlapping plate outlines around the large upper pivot. It
does not show the old model's large rear support cage or face torus decorations.

`063-source-tracing.html` gives a provisional interpretation over the unchanged
engraving. The large front outline includes a ring around the upper pivot and
the broad hooked pawl. The rear outline includes the spring arm and a pointed
hidden extension. The small circle just above the front arm is provisionally
the rear drop's striker. This suggests two independently rotating plates around
the same large joint, rather than the old straight pawl on an offset hinge.
The upper joint is carried by the spring-loaded drop; interpreting it as a
ground-fixed shaft does not establish the described repeated indexing.
Hidden boundaries and the exact star-driving face still require contact analysis.
The separate rear-drop and front-pawl overlay captures are inspected.

The tracing uses source-pixel centers (435,290) for the common upper pivot,
(568,855) for the star and (1005,713) for the driver. Approximate driver/star
radii are 261/300 pixels. A regular three-pin orbit fitted to the visually
marked pin centers has radius 192.284561 pixels and maximum center residual
17.097306 pixels. The three drawn pins are not exactly equally spaced; those
residuals must not be confused with exact source agreement. These are visual
traces and proportion choices, not an integrated 3D model.

## Actual baseline contacts

`scripts/probe-snap-counter-baseline.mjs` checks seven selected working/pivot
pairs at 103 phases in each of three consecutive pin events: **309 poses,
4,130,124 surface checks, 57,637 penetrating samples**. It computes independent
actual Float32 triangle distances, including segment/face intersections, and
bidirectional surface containment. Contact flags only label expectations. The
actual active-pin center agrees with the model's reported center within 6.69e-16,
so these failures are not an indexing mismatch. The probe exits zero and saves
`063-contact-baseline.json`; zero exit means the diagnostic completed, not that
the original mechanism passed.

| Selected pair | Actual result |
| --- | --- |
| Active pin / drop | No contact in any sampled pose. During 144 claimed-contact poses, gaps are 0.171244–0.394214. |
| Active pin / pawl | No contact in any sampled pose. During 90 claimed-contact poses, gaps are 0.258719–1.102414. |
| Striker / pawl | 93 intersecting poses and 3,846 penetrating samples, up to 0.058267 deep. During the claimed power stroke it can either intersect or remain up to 0.089467 away. |
| Pawl / star | 279 intersecting poses and 11,863 penetrating samples, up to 0.106600 deep. All 186 claimed-engaged poses intersect. |
| Drop / pawl | Intersecting triangle skins in all 309 poses; 17,826 penetrating samples, up to 0.076600 deep. |
| Fixed upper shaft / drop | Intersecting triangle skins in all 309 poses. The surface sampler finds no contained points, illustrating why the exact intersection check is also needed. |
| Pawl pivot stud / pawl | Intersecting skins in all 309 poses; 24,102 penetrating samples, up to 0.091600 deep. The pawl lacks a real pivot bore. |

The original motion lifts the drop and pawl using scheduled smooth interpolation,
not a solved pin/profile constraint. Its star engagement places an ideal tip on
an ideal valley while the actual finite pawl penetrates the star. The striker
has no actual contact constraint. This scoped probe establishes those defects;
it does not cover every independent solid or certify all other pairs clear.

## Isolated common-pivot cam study

`063-provisional-source-layout.mjs` contains the explicit source traces.
`scripts/study-snap-counter-source-cams.mjs` checks planar polygons against all
three finite circular pins, with the finite striker imposing a relative plate
angle. It follows each plate's preceding allowed angular component. A plate
cannot fall through an intervening pin to a disconnected lower clear angle.

The first study incorrectly chose the globally smallest nonnegative clear angle.
It produced premature drop release and 49 striker-coupled pin intrusions; its
script, report and log are preserved with `global-minimum` in the filename.
The corrected continuation study has no sampled pin/plate or striker/pawl
intrusion in **2,161 poses across three events**. Clockwise pin travel produces
smooth lift increments: at most 0.004729 radians for the pawl and 0.003326 for
the drop per 1/720 event step. The reverse-direction study requires upward
jumps of about 0.205 and 0.435 radians, so that study is not an acceptable lift
animation.

In the clockwise study the pawl escapes near event phase 0.960; the drop escapes
near 1.319, shortly before the next pawl lift at 1.382. A following pin limits
the drop's lowest angle to about 0.018 radians, so its positive-angle interval
does not return to zero after the first event. The maximum traced drop lift is
0.508618 radians. At the source pose, the finite striker has a 3.095-pixel gap
from the front arm; its contact offset is -0.020967 radians relative to the pawl.

This historical study does not establish the correct assembly support or a
working indexer. It omits the star, finite release time, spring/inertial dynamics,
plate thickness, pivot bearings and other hardware. The study's downward escape
jumps must be replaced with a finite spring-driven motion. During pawl release,
the real star must stop the pawl in the next space, and the following striker
stroke must advance exactly one tooth through actual finite surface contact.
The required star direction and driving face must be derived from those surfaces;
the old prescribed negative star rotation is not evidence. All independent 3D
clearances, source overlays, speed measurements and regression tests remain due
after a replacement is assembled.

## Moving-hinge studies: unresolved

The subsequent study lets the upper joint move with a rotating leaf, a spring
support approximated by a fixed pivot, or an ideal vertical guide. It includes
all three finite driver pins, both traced plate outlines, a finite striker and
a ten-point star. Variants explore driver position, pin orbit, lower stops,
striker position, spring support, hidden rear cam extensions, asymmetric star
valleys and a pawl toe stepped into the star's plane. These are hypotheses for
analysis, not proven source details or accepted geometry changes.

**None of these trials produces repeated one-tooth advance.** Many have no
sampled intersections but return to the same output angle on every later
event; some jam. All reports and their event-to-event output increments are
indexed by `movingHingeStudy` in `063-reconstruction.json`. The asymmetric
valley trials at +6, +10 and +14 degrees leave the star stationary; the -10
degree trial only produces an initial fractional settling motion.

The first reverse-direction trials also had a solver issue: subdividing an
upward lift while holding the driver pins at their advanced positions could
create an artificial intersection. Corrected reverse trials for all three
supports and a stepped toe complete 433 poses each without sampled intrusion,
but still fail repeat indexing. Their filenames begin `063-corrected-reverse-`.
The earlier failure must not be used as proof of the real driver's direction.

The current solver is insufficient for a final mechanical conclusion. It holds
the star still except when the striker limits pawl rotation, then picks the
nearest output angle that clears the surfaces. It does not solve all contact
forces, inertial release or the two-flank constraint of a finite nose seated in
a star valley. A moving hinge can transmit force through that seated pawl even
before the striker bears. A future construction must solve that coupling and
cam release timing, demonstrate positive contact reactions and stable repeated
indexing, then verify real 3D geometry. No trial is integrated into production.

A manual ten-point circumcircle fit constrained to the drawn shaft center has
radius 301.938 pixels, maximum outer-vertex residual 49.935 pixels and RMS
25.931 pixels (`063-star-source-measurement.json`). The hand-drawn star and
pins are irregular; these measurements do not justify claiming exact outline
agreement for a regularized reconstruction.

## Additional references

[Spon's dictionary, figure 3186](https://upload.wikimedia.org/wikipedia/commons/9/9c/Spons%27_dictionary_of_engineering%2C_civil%2C_mechanical%2C_military%2C_and_naval%3B_with_technical_terms_in_French%2C_German%2C_Italian%2C_and_Spanish_%28IA_sponsdictionaryo05spon%29.pdf)
repeats the engraving and release sequence. PDF pages 117–118 and the unchanged
`../reference/spons-3186-detail.png` were inspected; they do not supply missing
support dimensions.

[Sam Gallagher's own reconstruction account](https://engineering.stackexchange.com/questions/52770/how-does-this-pawl-mechanism-work)
describes a spring-supported moving hinge, a striker limiting upward pawl
rotation and no direct driver-pin/star contact. He identifies his construction
as approximate and remains uncertain about the spring. His answer text is
saved in `../reference/sam-gallagher-063-answer.json`.

**His animation was not retrieved or inspected.** The Stack image CDN returned
HTTP 403. An old Imgur URL returned an unavailable-image placeholder; its bytes
are a 161 by 81 PNG, now correctly named
`../reference/sam-gallagher-063-unavailable-placeholder.png`. The earlier
commentary saying the animation had been retrieved was corrected. The saved
`sam-gallagher-063-frame-01.png` is that same placeholder, not a mechanism frame.
