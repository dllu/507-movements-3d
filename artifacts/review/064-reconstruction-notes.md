# 064 · Spring-driven jumping cam

Movement 064 is integrated with a generated worm pair, a separately rotating
bored cam sleeve, a finite driving pin and half-cut collar, a pivoted roller
follower, and a continuous curved leaf spring. Mechanical verification, the build,
all 2,992 numerical tests, all 23 browser tests and final UI inspection pass.
The catalog-wide task remains active. 037 and 063 are unresolved, and 031's
worm-generation review has been reopened.

## Source and construction

[Brown's official page](https://507movements.com/mm_064.html) has no animation.
The unchanged enlargement is `../reference/brown-064-detail.png`. The bottom
worm drives wheel B and its solid shaft. The shaft pin pushes the edge of the
independent cam sleeve's half-cut end. Spring pressure first resists the cam,
then drives it ahead after over-center. The cam settles before the pin catches
it. Half-cut freedom limits relative travel; it does not prescribe an exact
half-turn jump.

The cam follows the narrow source outline and uses a circular base. Its shaft
center is (1010,759) in the Brown enlargement, at 200 pixels per model unit.
The follower pivot is (56,383), and its length is 5.070039 units. All shaft,
sleeve, follower and roller interfaces have real bores and finite depth.
The cam and follower stack sits forward of the worm, with the retaining
collar and driving pin further forward. Ground and fog are absent.

A cubic neutral curve and smooth thickness variation reproduce the leaf's
S-shaped middle. Twenty-two dark-stroke scan readings determine that fit;
clamp hatching and the lower follower line are excluded. The physical spring
has a fixed 0.67-unit root prefix, 256 constant-length neutral segments and a
512-segment circular return. Its neutral length is 2.737324461 units. The
fitted clamp ends within the fixed prefix. The return slides on the follower.

The current source-outline report compares 86 boundary readings and three
centers to actual projected mesh contours. Maximum marked residuals are
3.752 scan pixels for the cam, 6.333 for the leaf stem, 5.124 for the follower,
10.745 for the regularized circular return, and 20.521 for the wheel teeth.
The roller center differs by 4.698 pixels. These are scoped readings, not a
whole-image registration or a claim that concealed anatomy is known.

The 24 regularized wheel teeth are a construction choice. Visible-boundary
harmonics favor 23 and 24 nearly equally. The source teeth and circular return
are irregular; matching their overall envelopes does not establish an exact
historical tooth count. Hidden bearing placement, depth, inertia, spring
stiffness and damping are also inferred.

## Contact, force and dynamics

The follower is solved against the actual Float32 cam boundary using finite
roller offset lines and vertex circles. Spring displacement follows its
inextensible bending mode and sliding return contact. Spring energy supplies
cam torque through those contact moment arms. The cam has inertia 0.04 and
viscous resistance 0.12 in the model's units; follower and roller are massless.
Catch is an ideal inelastic impact against a continuously driven shaft pin.
These are stated model assumptions, not a full elastic or frictional analysis.

At the authored wheel speed of 0.4 rad/s, the cam releases at 0.459464 seconds
and catches at 7.924587 seconds in a 15.707963-second wheel cycle. Peak cam
speed is 7.337110 rad/s. Maximum relative lead is 2.403560 radians, within the
finite cut's 2.761272-radian allowance. The cam spends about 3.927 seconds per
cycle below 0.001 rad/s before catch. Three-cycle checks reproduce the same
motion and maintain positive driven pin reaction.

The dynamics check independently differences geometric spring energy,
measures neutral lengths and the fixed root, and integrates actual geometric
torque work along the stored trajectory. Maximum neutral-length error is
8.89e-15, fixed-root displacement is zero, maximum total-energy residual is
1.01e-5, and the separate work-balance residual is 2.57e-5. Impact work and
loss balance exactly to the reported precision. Halving the time step and
doubling the contact table change sampled cam angles by less than 1.2e-5
radians and speeds by less than 6.7e-5 rad/s. The coarser time step remains
within 4.9e-5 radians and 8.7e-4 rad/s.

Actual rendered material-point checks cover 78 cam/roller and spring/follower
poses, including dense samples during the jump, plus 28 engaged pin/collar
poses. Working clearances stay near 0.000150. Cam/roller relative velocity
residual is below 0.384 percent; spring/follower normal velocity residual is
below 1.280 percent. The spring contact is allowed to slide. Actual normal
forces remain positive. The spring's Float32 deformation uses a larger
finite-difference span to avoid amplifying coordinate rounding into false
velocity. Exact triangle witnesses and per-pose residuals are retained.

The roller angle is absolute in the contact calculation. Its local transform
subtracts the follower angle, preventing an extra inherited rotation. The
rendered roller therefore satisfies rolling contact rather than merely
following the cam with a decorative spin.

## Generated worm and complete hardware

The cylindrical worm has straight axial flanks and an integral closed root
and end caps. Its mate is generated by synchronized cylindrical-hob removal.
The hob has a quarter-module tip extension for root clearance. The continuous
phase search avoids the coarse neighbor-minimum erosion that distorted an
earlier candidate's contact normals.

The first refined generator inherited an incorrect spherical ray bound from
the shared helper. For the X-axis worm, radius is `hypot(y,z)`, independent of
axial X. The corrected ray interval is
`(D ± sqrt(tipRadius²-z²)) / cos(theta)`, additionally clipped by finite worm
length; its phase sweep covers the cylindrical intersection. Doubling phase
and radial sampling changes the corrected radial field by only 2.23e-15.
The precomputed wheel profile is dimension-keyed and validated when loaded.

A full 65-pose worm revolution performs **86,088,470** actual surface checks
in both directions with no penetration. Loaded-flank exact triangle gaps are
22.297–35.343 microunits, positive output torque is maintained, and maximum
normal-force input/output power residual is **1.168 percent**.

The complete independent-family hardware sweep covers **104 poses and 165
pairs**, including release, jump and catch samples. Its **249,588,986** surface
checks find no penetration. The dense worm/wheel pair is covered separately,
for **335,677,456 combined checks**. All 20 parts have closed oriented surfaces,
positive volume and outward normals; the deforming spring is checked in five
additional poses. These are sampled finite-solid checks, not a universal
continuous collision proof.

The topology audit originally used 1e-7 coordinate bins, which collapsed four
valid narrow worm-cap triangles and falsely counted four incident faces.
At 1e-9 the actual Float32 edges pair correctly. The failed diagnostic remains
archived. Earlier cam/worm and clamp/spring clashes, coarse-table studies,
failed worm force checks and the original source-fit candidate are also retained.

## Playback and verification

The verified motion table and trajectory are precomputed without changing
numeric values. Source-hash provenance and exact sampled equivalence to fresh
integration are tested. Initial construction dropped from several seconds to
about 0.3 seconds in the measured candidate trial. The stored table increases
the bundle size; generation remains available for changed parameters.

Playback uses a **24-second complete cycle**, limiting the visibly rotating
worm to one revolution per second. The cam jump remains brief. The unmarked
annular roller has a fast physical spin during the jump, but axial spin leaves
its visible surface unchanged. Only that symmetric rotation is excluded from
visible-speed measurement; the follower, cam, worm and translating bounds are
still measured. A regression test verifies the roller's uniform color,
surface-of-revolution geometry and lack of attached markers.

The source and complete camera views show the whole movement envelope. Ten
integrated phase comparisons are saved and inspected. Normal shadow bias
removes speckling from the thin lever while preserving the cam's cast shadows.
The comparison gallery now contains 272 images.

Seven focused mechanical tests pass. The first full 2,990-test numerical run
passed 2,989 tests: a newly added test incorrectly required no roller color
attribute, although the existing turned geometry supplies uniform white
colors. That test now verifies uniformity. The mechanical tests themselves
passed. Both the corrected 2,990-test numerical run and 22-browser-test run
passed before final mobile inspection caught a shared camera bug. Resize changed
aspect without fitting the new viewport, and reset retained drag inertia. The
camera now preserves orbit, pan and relative zoom at the new fit distance;
reset refits the selected source/complete view and clears pending inertia.
Narrow-field views allow more zoom-out room. The refreshed desktop/mobile and
zoomed orbit frames and source overlay are inspected. Initial failures are
preserved under `064-ui-initial-*`.

Two additional numerical tests use actual projected vertices and real
OrbitControls to exercise resize/reset, while a new browser test measures
rendered foreground margins. Its first pixel classifier accidentally used a
CSS border as the background; that diagnostic is archived. The corrected
classifier uses the dominant paper color and excludes the one-pixel border.
The final build passes (12.918 seconds), and all **2,992 numerical tests pass**
(code 0, no signal, 241.334 seconds). All **23 browser tests pass**, including
all 507 canvases and the new mobile/reset test (code 0, no signal, one worker,
865.566 seconds). Process records and visual
inspection evidence are in `064-reconstruction.json`.

## Preserved evidence and follow-up

The original 064 factory, two private helpers and legacy test are archived
and removed. Its baseline found 411,993 penetrating samples in 7,690,790 checks.
The previous isolated studies and their limitations are preserved in
`064-baseline-review-record.json` and `064-isolated-study-notes.md`.

The older shared generator and 031 baked profile still need the focused
follow-up described in `031-worm-generator-followup.md`. Its existing clearance
tests pass, but they do not establish the contact-normal power ratio. No 031
production geometry changed during this reconstruction. Do not silently count
that newly reopened question as resolved.
