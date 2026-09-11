# 056 initial review

The original factory remains registered and unchanged. Its complete source
is preserved in 056-original-factory.txt. Official source:
https://507movements.com/mm_056.html (saved ../reference/mm_056.html).

Brown describes depressing an eccentric-slot lever to withdraw the large
speed gear's shaft. The drawing shows a three-step rear pulley, a partly
covered large gear at left, a small pinion partly concealed by the top of
the headstock, and a thin upright handle ending in a narrow bulb.

The current factory uses 45/15 teeth, module 0.096, center distance 2.88,
throw 0.24, a 60-degree lever stroke, and a 7.2-second authored cycle.
These are not yet confirmed against source measurements. Its headstock is
behind the gears (Z=-0.48 versus gear plane +0.2), although the engraving
shows substantial foreground occlusion. The broad elliptical cam plate,
black capsule handle knob, straight-sided frame and wide base also need
source comparison. No replacement geometry has been written yet.

The initial external phase sum is a quarter tooth pitch away from correct
tooth/gap alignment: Na*phiA+Nb*phiB = 12.5*pi, whereas the external
engagement requires (Na-1)*pi = 44*pi modulo 2*pi. Existing tests compare
changes from the initial phase and therefore do not establish tooth mesh.
scripts/probe-lathe-lever-baseline.mjs measures the actual extruded tooth
skins through 129 phases of a full withdrawal/re-engagement cycle.
The completed baseline reports 3,248,220 bidirectional checks, 19,778
penetrating samples across 85 poses, maximum depth 0.0707955402.
Report: 056-tooth-contact-baseline.json; process completed with exit code 0.

The current output angle also continues changing until cycle fraction
0.4, although nominal tooth overlap ends at 0.32. A future reconstruction
must account for changing operating pressure angle, physical loss of
engagement and phase-compatible re-entry. The slot follower must be checked
against its actual hole, not merely against its generating centerline.

055 is rebuilt and verified: 2,945 numerical tests, build, and all 15
browser tests pass; final source and oblique views are inspected.
037 remains unresolved. The overall 507-movement review is not complete.

Brown's enlarged source is ../reference/brown-056-detail.png, extracted
unchanged from PDF page 22 at scale 6000, rectangle (3050,2400,1400,1320).
An initial boundary-frequency check is saved in
056-source-pitch-measurement.json. Results vary substantially with the
assumed large-wheel center: candidates 35–40 dominate, and 45 is not
confirmed. Visible teeth, the true wheel center and occlusion masks need
manual verification before selecting replacement counts. Do not treat the
first Fourier maximum as an authoritative count.

The untouched production model is captured at fractions 0, 0.45 and 0.9 in
056-baseline-phase-*.png. Phase 0 is visually inspected: the model exposes
both gears in front of a narrow, straight-sided frame, while Brown's much
larger curved headstock covers substantial portions of them. The circular
lever plate and shaft overhangs also visibly differ from the engraving.

Next: verify the source contours/counts, reconstruct the foreground frame
and lever, then solve actual slot and gear engagement. Brown does not say
that the gears must be shifted under power. An explicit stopped-shaft
shift sequence is an option if powered re-entry would require unspecified
impact dynamics; do not silently drive a disconnected output.
