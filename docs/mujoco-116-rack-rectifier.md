# 116 — Double rack with alternating ratchet clutches

The catalog uses `src/simulation/mujoco-rack-rectifier/`. A reciprocating
frame turns two loose pinions in separate axial planes. Each pinion carries
a hinged pawl; the pawls alternately drive two ratchets fixed to one shaft.
Only the frame is actuated. Native contacts determine every other coordinate.
This replaces prescribed output rotation, prescribed pawl lifts, twelve-tooth
ratchets, extra rack teeth, an oversized frame and invented support hardware.
The input cycle takes six seconds. Ground and fog are disabled.

## Source reconstruction

Brown's [engraving and caption](https://507movements.com/mm_116.html) specify
separate rack planes and pinions that alternately drive the same shaft.
The caption describes opposite ratchet handedness. We interpret this as the
appearance from opposite shaft ends: both clutches must drive clockwise in a
common coordinate system. Opposite handedness in the same front projection
would make the two clutches drive opposing shaft directions.

Measurements use bounded ink midpoints at threshold 110 and 100 source pixels
per world unit. The shaft center is (237.89453, 286.94114) pixels, and its
radius is 19.32412 pixels. The frame's unequal ends and short attachments
follow the drawing. The hidden depth, rear mechanism, pawl outline, pin fits,
ideal shaft bearings and horizontal frame guide are inferred.

The contour fit supports thirteen pinion teeth and six asymmetric ratchet
teeth. Each rack has twelve teeth. The two independently measured rack
pitches are 24.32318 and 23.34878 pixels. A shared, compatible involute system
uses a 23.87610-pixel pitch, 7.6-pixel module, 49.4-pixel reference radius,
20-degree pressure angle and a profile shift coefficient of 1. The cutter
is displaced to 57 pixels while rolling travel remains 49.4 pixels per
pinion radian. Addendum is 0.8 module, dedendum 1.25 module, cutter corners
0.12 module and radial rack clearance 0.1 pixel. These regularize the
engraving's irregular, nearly square teeth; they are reconstruction choices.

The ratchet has a long rising spiral over 92% of each tooth pitch and a short,
straight locking face. Root and tip radii are 26.29614 and 34.60110 pixels.
The fitted six-tooth contour replaces the earlier twelve shallow triangles.
The pawl pivots at the measured point (209, 259) pixels. Since pass 86 each
pawl is one flat bored plate in its ratchet's plane, following Brown's hooked
outline: a round boss (3.2-pixel radius, 1.3-pixel bore), a body whose top
arches over the ratchet, and a short claw. The claw's working face lies along
the ratchet's locking face over 60% of its height, and its tip corner seats
in the root, 0.02 pixel clear of both flanks in the built (seated) pose. The
underside is a straight edge from the boss to the claw, joined by a 0.9-pixel
fillet, so a passing tooth tip slides along one flat face while the pawl
clicks. There is no auxiliary rod or prescribed engagement correction. The
earlier pawl, a 5.2-pixel capsule whose round nose bore on the middle of the
face, was replaced because it never seated in the root.

Actual rendered-edge distances at the initial native pose:

| Feature | Readings | RMS, pixels | Maximum, pixels |
| --- | ---: | ---: | ---: |
| Frame top / bottom | 136 / 136 | 0.39233 / 1.04658 | 1.15629 / 1.74091 |
| Left attachment top / bottom | 11 / 11 | 0.27833 / 0.94035 | 0.51354 / 1.33588 |
| Right attachment top / bottom | 12 / 12 | 0.43894 / 0.83433 | 1.12500 / 1.76763 |
| Left / right inner extrema | 9 / 9 | 0.27088 / 0.32261 | 0.43058 / 0.66565 |
| Left / right outer curves | 47 / 43 | 2.75215 / 2.02580 | 5.38838 / 3.34774 |
| Left / right inner curves | 54 / 56 | 2.13347 / 1.50940 | 3.76330 / 4.31524 |
| Pinion | 90 | 2.21611 | 6.65817 |
| Ratchet | 132 | 1.15299 | 3.06973 |
| Shaft | 77 | 0.89667 | 4.10860 |
| Regular rack tooth centers | 55 | 5.34964 | 9.85972 |

Gear measurements omit the top and bottom regions where rack ink merges
with the wheel. The final measurement also excludes seven such readings
retained in the preliminary fit. Tooth-center residuals measure spacing,
not the whole silhouette. The pawl follows the drawn hook in outline, but
its outline and the hidden axial spacing are not independently fitted. The source cannot be exactly superimposed
while retaining compatible, regularly spaced teeth.

## Native mechanics and limits

Six coordinates represent the frame slide, two pinion hinges, two pawl
hinges and the output shaft. There are no equality constraints or output
actuators. Fourteen closed solids define the visible hardware and mass.
Three frame slabs meet at welded faces with disjoint interiors. Each outer
slab includes its complete rack, avoiding disconnected slivers at attachment
strips. Mass and full inertia are integrated from all visible solids at a
uniform density normalized to frame mass 1.

The input has constant working velocity and short, twice differentiable
reversals. Its nominal triangle amplitude is `pitchRadius × π/2`; a quartic
cap rounds each peak over ±0.18 seconds, which lets the passive shaft coast
through each reversal. Since pass 86 the nominal amplitude is
`pitchRadius × (π/2 + 0.008)`: the capped stroke ends 0.0036 world unit
further out, so the idle pawl passes the root of the next tooth before its
pinion reverses and drops fully into it. The reversed pinion then takes up
that small backlash (about 0.4 degree of ratchet) before its already seated
pawl picks up the drive. With the earlier stroke the new claw reached the
face while still on the tooth tip and slid down it, wedging the shaft ahead;
without the backlash the model skipped teeth. A 0.15-second exponential startup brings the frame smoothly to speed.
An ideal position servo drives that input. Output motion is never overwritten
or wrapped during stepping.

Pawls have inferred torsion springs of 0.001 with rest angle −0.07 radians
past the seated pose, and damping 0.00005. The output hinge uses damping
0.00005. These values are not material or load calibration. Both pawls and
the shaft start at zero, the seated assembly pose, without initial
penetration.
Starting the pawls open lost one ratchet pitch during startup; overly strong
springs caused substantial speed ripple. Gravity assists engagement, but
removing the springs entirely allowed a pawl to overturn.

The default uses 0.5 ms steps, 2 ms contact response, discrete integration,
exact constraint inertia, Newton solving and frictionless contact. Multiple
contacts per convex pair are disabled. In a diagnostic with that option on,
a nearly planar rack contact selected an axial normal and reported the full
16-pixel plate depth as penetration despite matching compiled geometry.
One contact per convex pair removed that observed degeneracy. The
[MuJoCo computation documentation](https://mujoco.readthedocs.io/en/latest/computation/)
describes the convex contact pipeline and discrete constraint integration.
This is a numerical choice for the ideal planar joints, not a proof that
all collision configurations or material parameters behave equivalently.

Pass 86 figures. Ten cycles (60 native seconds) maintain the full reversing
frame stroke from −0.74528895 to +0.74528925 world units. Maximum rack/pinion
displacement error is 0.06305862 source pixel, input error 0.04669590 pixel
and reported native penetration 0.15869046 pixel. There are no automatic
resets. The largest reverse shaft increment is 0.00000224 radian, during
startup. After startup every step turns clockwise. Pawl hinges stay within
−0.0014 to 0.409 radian: the claws never overshoot the tooth-tip height.

Away from the reversals the driving pawl sits in the root, within 0.0014
radian of its seated pose and 0.08 degree of the locking face. At every
reversal the idle pawl drops fully into a root while still clear of the face.

After two seconds, mean shaft speed is −1.04720178 rad/s, matching the ideal
−π/3 rad/s. Individual integration steps range from −1.07789 to −0.97853
rad/s: the shaft is driven 0.4% fast through each stroke and coasts slightly
slow while the reversed pinion takes up the backlash. These measured
variations remain visible physics; the model does not smooth or prescribe the
displayed output angle.

Two-cycle sensitivity checks on the pre-pass-86 construction (capsule pawls):

| Trial | Maximum penetration, pixels | Maximum mesh error, pixels | Mean speed after 2 s, rad/s |
| --- | ---: | ---: | ---: |
| 0.25 ms timestep | 0.13226 | 0.07331 | −1.04720620 |
| 128 pinion / 96 ratchet samples, 4,096 cutter steps | 0.15862 | 0.07451 | −1.04711524 |

Pass-86 checks on the seated-claw pawls: a 0.25 ms timestep gives maximum
penetration 0.140 pixel, step speeds −1.076 to −0.984 rad/s and seated pawls
(within 0.0014 radian and 0.05 degree). A doubled pawl spring (0.002) and
backlash values from 0.005 to 0.012 also seat every stroke over 30 to 60 s;
backlash 0.003 is marginal and 0 skips teeth.

These check numerical behavior, not contact-force convergence. An earlier
friction-0.1 trial produced reverse steps and excessive speed variation;
nonzero friction and applied shaft loads are not qualified. The verified
scope is the unloaded, frictionless reconstruction with ideal bearings.

All 19,292 compiled collision vertices match their visible construction
within 0.00001022 source pixel. The independent 25-pose surface audit (pass 86)
makes 5,218,774 vertex, edge-midpoint and triangle-centroid queries across all
hardware and checks the full-stroke camera bounds, except for the pass-60
stub run-ons and the shaft's rear stub, which deliberately leave the view.
Maximum sampled intended penetration is 0.0916 pixel, at a claw on its
ratchet; no unintended penetration is found. Only
bounded rack/pinion and ratchet/pawl working regions allow soft penetration.
On return strokes a tooth can lift the underside of the pawl as well as its
nose; the pivot eye remains excluded. Surface sampling is not continuous
interference certification, and its maximum does not replace the larger
all-step native penetration result above.

Disconnecting the output's contacts leaves it stationary while the frame
still turns both pinions. Disabling either pawl separately leaves the other
able to turn the shaft clockwise; its return-stroke driving impulse is less
than 5% of its working-stroke impulse. Restart, backward seeking and frame
partitioning reproduce native state exactly. Disposal frees native model
and data allocations. Seven mechanism tests (pass 86 adds the pawl seating
checks) and the shared geometry, engine and runtime tests pass.

All fourteen integrated views have been inspected, including the source
overlay, stroke ends, both rack contacts, both pawls, axial, oblique and rear
views. The headless capture records 23.44 fps at 99.23% physical speed with
no page errors. Existing Three.js deprecation and screenshot readback
warnings remain. The production build and all 32 production MuJoCo browser regressions pass
in 6.6 minutes, including playback, pause, restart, mobile navigation,
asset failure/retry and static-subdirectory loading.

## Reproduction and evidence

Bulk evidence remains outside Git. Reports contain input hashes and archived
source copies; historical failures are retained separately from qualification.
The decisive `/dev/shm/116-` prefixes are:

- `baseline-a`: seven inspected views of the replaced implementation.
- `source-c`, `fit-b`, `ratchet-fit-a`: source readings and provisional fits.
- `comparison-e`: actual rendered-edge comparison using the native initializer.
- `dynamics-o`: ten-cycle final construction; `p` and `q`: sensitivity checks.
- `clearances-c`: independent surface audit of all fourteen solids.
- `tests-c.log`, `build-a.log`, `browser-a.log`: final validation logs.
- `integrated-a`, `integrated-a-inspection`: registered factory capture and review.
- `integrated-final-review-a.json`: evidence hashes and input compatibility.

Native studies predate only the catalog registration and visible status text;
their geometry and physics match the final versions. The complete 507-movement
review remains active.

```sh
PROBE_PREFIX=/dev/shm/116-new-source node scripts/measure-rack-rectifier-source.mjs
TMPDIR=/dev/shm SOURCE_REPORT=/dev/shm/116-new-source.json PROBE_PREFIX=/dev/shm/116-new-comparison node scripts/compare-rack-rectifier-source.mjs
TMPDIR=/dev/shm DURATION=60 PROBE_PREFIX=/dev/shm/116-new-dynamics node scripts/probe-rack-rectifier-dynamics.mjs
TMPDIR=/dev/shm PROBE_PREFIX=/dev/shm/116-new-clearances node scripts/audit-rack-rectifier-clearances.mjs
TMPDIR=/dev/shm node --test tests/mujoco-rack-rectifier.test.mjs tests/shifted-involute.test.mjs tests/mujoco-runtime.test.mjs tests/engine.test.mjs
TMPDIR=/dev/shm INTEGRATED=1 PROBE_PREFIX=/dev/shm/116-new-views node scripts/capture-rack-rectifier-candidate.mjs
```
