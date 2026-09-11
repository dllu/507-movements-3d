> Correction applied following user visual review (2026-09-11). See [the current correction record](073-077-correction-notes.md) for updated geometry, motion and validation. Earlier evidence below refers to the preceding version.

# Movement 076: verified integrated reconstruction

The replacement is integrated. It has a complete coaxial driver, twenty counting
teeth, a curved weighted dog, the separate holding pawl, bored joints and finite
stops. The source pose is the initial released condition. Subsequent revolutions
start with the tappet resting on its stop. The browser displays the 24-second
physical cycle in 12 seconds. The complete driver can also be displayed through
an engraving section; caps close the cut faces without changing physical solids.
All 3,069 numerical tests and 32 browser checks pass, including all 507 rendered
entries. All 18 integrated mechanical and UI captures are inspected. Verification
is frozen against 802 source/test/configuration files.

The production model matches the isolated verified candidate exactly: 24 parts,
72 geometry buffers and 44,150 poses have zero state or matrix differences.
The eight focused tests pass. Tests cover source joints, closed solids, real
bores, seeking, cycle boundaries, tooth count, folding, physical contact and
section display. An all-pair production screen checks 228 independent-family
pairs at 207 cached poses, including segment interiors and all twenty tooth
orientations. Its 54,642,530 actual Float32 vertex, edge-midpoint and triangle-center
checks find no penetration deeper than 1e-6. This remains a sampled all-pair
screen, not a continuous all-pair clearance proof.

The cache uses 14,035 first-cycle knots and 13,007 periodic knots, compressed
from the finest raw trajectory with each angular error at most 5e-8 radians.
A continuous geometric interpolation certificate covers the two working noses,
the stud/bar contact and the two finite stop sectors. Across the initial path
and all twenty periodic tooth orientations, 459,015 certified subintervals have
a minimum lower gap bound of -9.999e-7. It bounds geometric interpolation, not
dynamic forces. The sampler uses linear interpolation, includes the initial
gravity transient and advances one tooth per subsequent revolution.

The current contact geometry uses root radius 0.87, short-face angle 0.045
radians, dog nose at source [792,712], and nominal holding nose [185,352].
The actual holding nose is 11.941 source pixels from the original [173,352]
reading. Its 0.0657-pixel seat-fitting residual is relative to the adjusted point.
The dog nose is 13.038 pixels from provisional [805,711] on the lower outline.
The working end is partly obscured. These are reconstruction choices, not
precise historical measurements.

The larger wheel shares the counting-wheel axis. With the source hub fixed
at [430.62183,591.20157], the fitted outer radius is 921.13390 pixels (RMS
1.35288 pixels); the inner radius is 744.86337 pixels (RMS 4.26043 pixels).
Both the complete rim and four spokes are modeled. Twenty manually identified
tooth tips have irregular spacing: their best regular layout has RMS ordered
tip error 18.385 pixels and maximum 32.524 pixels. The contact-compatible phase
actually used has RMS 28.854 pixels and maximum 54.612 pixels. The latter values
are the applicable source-fit errors for this reconstruction.

Mass properties come from actual Float32 closed solids at common density,
normalized to dog mass one and counting-wheel radius one. Independent planar
area integrals agree with mesh volume integrals. The formula check covers
24 parts, 167 states, 10,416 contact derivatives, 33 driven-contact time
derivatives and 200 manufactured contact projections. Relative volume and
polar-inertia errors are below 5e-14; maximum contact derivative error is
3.74e-9. These checks validate formulas, not the mechanism by themselves.

Dynamics include gravity, rigid-body inertia, a regulated clockwise input,
resisting output torque, viscous bearing damping and inelastic unilateral
contact. The implementation uses a frictionless impulse-momentum projection
with implicit geometry iteration, informed by
[Stewart and Trinkle's time-stepping method](https://www.cse.lehigh.edu/~trink/Papers/STicra00.pdf).
It does not implement the paper's full Coulomb-friction model. Bearing and load
values are reconstruction assumptions, not values stated in the source.

At input period 24, load 3 and damping [q, dog, wheel, holding] =
[3,0.008,100,0.003], three successive strikes settle at one, two and three teeth.
The jointed dog resets at the 0.30-radian return stop. The wheel initially
advances about 1.583 pitches, then rolls back to one; inertia produces this
behavior. Loads 2, 3, 4 and 5 each finish one full input revolution at one tooth
and the reset stops. The original 79-pose candidate screen also passed
20,558,342 surface checks; the larger production screen uses the actual cache.

Both componentwise convergence checks retain their failed status: individual
coordinates do not shrink monotonically at every impact when the step is halved.
A separate spatial-resolution assessment compares maximum state differences
and induced finite-body vertex displacement. Between steps 0.0000625 and
0.00003125, displacement is bounded by 0.222792 source pixels. The maximum
state difference falls to 0.3111 of the preceding comparison, and positive
energy defects roughly halve. This is observed numerical stability, not an
exact-dynamics proof. The finest trajectory supplies the cache.

Earlier failed studies are preserved. The negative-face candidate's holding
seat does not repeat after a tooth. The later 0.90/0.025 candidate first contacts
the wrong tooth face, drives the count wheel backward, throws the holding pawl
open and advances 23.748 teeth in 2.5 time units. Holding-reach variation produces
525 geometric candidates; the selected one has 1.03424 pitches of locked-dog
capacity. That geometric capacity is not a substitute for dynamics. The old
q=0 repeated-rest assumption fails to reset the dog; the physical return stop
is q=0.30. Earlier instantaneous closure studies remain diagnostics.

The first standalone playback preview had an expanding canvas and a blank
stage. Its HTML lacked explicit canvas sizing. That preview and its negative
visual assessment remain archived. The corrected preview has five inspected
views and working controls. Its video was recorded but has not been watched.
The production engine did not require a change for this preview layout bug.

Two initial versions of the new contact regression test missed stud/bar contact:
the stud's mesh samples lay outside the thin bar's axial interval, and the bar's
sparse straight-edge samples missed the stud. The final test also probes the
stud's actual side generators at z=0.13, inside the bar. It rejects an additional
clockwise stud rotation while allowing the nominal pose. These were test sampling
failures; their logs are retained and production geometry did not change.

The replaced baseline had eighteen teeth, omitted the source holding pawl,
misplaced its partial input rim, rotated the driver counterclockwise and added
a dominant frame. Eight baseline views are inspected. Its selected 56-pose
surface audit found 109,891 penetrating samples in 691,476 independent-family
checks. The original factory and incorrect test are archived exactly. All
794 files from the verified 075 state matched immediately before integration.
Only movement 076's factory dispatch, old test and display measurements changed
among those files; eight production/test files were added.

Source: https://507movements.com/mm_076.html and the Brown page-26 crop
[3070,3860,1425,1320], saved as `artifacts/reference/brown-076-detail.png`.
The enlarged joint detail is preserved. The first tooth plot's marker at
[758,655] identifies a wheel root and is not an accepted dog-contact location.
See `076-reconstruction.json`, `076-preintegration-checkpoint.json` and the
integrated checkpoint for evidence and source hashes.

The first integrated capture run stopped at an exact accessible-label lookup
for the view selector. Its fourteen mechanical frames and script are archived.
The corrected selector passed the full capture and browser test. The eighteen
historical regression screenshots were restored after fresh copies were saved
under `076-browser-regression-captures/`. See `076-integrated-checkpoint.json`.
