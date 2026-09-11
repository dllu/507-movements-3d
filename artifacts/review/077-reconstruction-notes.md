> Correction applied following user visual review (2026-09-11). See [the current correction record](073-077-correction-notes.md) for updated geometry, motion and validation. Earlier evidence below refers to the preceding version.

# Movement 077: rebuilt and verified

The replacement is integrated in `src/simulation/alternating-peg-pawl.js`.
`077-integrated-checkpoint.json` records the final verification against 812
frozen input files. Seven focused tests, all 3,075 numerical tests, the build
and all 33 browser checks pass. All 507 entries rendered. Fourteen integrated
mechanical and desktop/mobile views are inspected. Eighteen historical browser
images were restored after preserving the fresh regression captures.

## Source and geometry

The official reference is https://507movements.com/mm_077.html. Its animation
is unavailable. The inspected Brown scan is page 28, printed page 24, crop
[415,1150,1300,1300]. The wheel has 24 pins and four open spoke sectors.
Its fitted outer radius is 433.579 source pixels, with inner/outer ratio
0.746166. The fixed lever pivot lies 0.502078 wheel radii above the wheel
center. The drawn engaged pair is two pitches apart.

The new assembly has 62 closed, connected, outward-facing solids: wheel, pins
and caps, two tapered hooked pawls, a bored lever, shafts and retaining caps.
The source contacts determine the regular pin layout's phase. Their errors are
1.445 and 2.422 source pixels. This prioritization increases the overall pin
RMS error from the original global fit's 8.200 pixels to 12.146 pixels, with
maximum 24.259 pixels. The hand-drawn spacing cannot be retained by a regular
24-pin wheel. The longer tapered lower lips follow the drawing more closely
than the earlier working short-lip variant.

The rejected original model had a fulcrum nearly level with the wheel center,
a three-pitch contact separation, open torus hooks and false point contact.
Its active hook surfaces left at least 0.017821 model units of radial gap.
Returning hooks penetrated closed pin solids in 25,274 of 752,620 sampled
surface checks. Original factory, tests, source readings and failed studies
remain archived.

## Motion and assumptions

The lever is prescribed; the wheel and both pawls are independent dynamic
coordinates. Masses and inertias come from actual mesh volumes at common
density, normalized to lower-pawl mass one. The study includes gravity,
moving-pivot acceleration, frictionless inelastic normal contact, absolute
angular damping [4, 0.006, 0.006], and bidirectional dry-friction output
resistance 15. These resistance and density choices are reconstruction
assumptions. There is no one-way wheel lock or projected output angle.

A periodic C2 phase clock adjusts only the input lever. Wheel and pawl motion
was reintegrated after changing that input. The lever mean is 0.110061327
radians, amplitude 0.26 radians and physical period eight seconds. Playback
shows each cycle in four seconds. Loads 13, 15 and 17 each advance one pin
pitch per steady cycle; the wheel moves for about 82% of that cycle.

The initial drawing pose produces a settling cycle advancing 1.314252 pitches.
Later cycles advance one pitch. The finest steady cycle includes only
0.00002628 pitches of backward travel, about 0.003 source pixels. That small
physical backlash remains in playback. First and repeated cycles join after
floating-point endpoint corrections below 1e-9 radians.

## Numerical and geometric evidence

The finest trajectory completes 64,000 steps at dt 0.00025 without a contact
solver failure. Compared with dt 0.0005, the largest conservative whole-body
position difference is 0.126338 source pixels. This is observed numerical
refinement, not a proof of exact continuous-time dynamics.

The selected geometry and input pass independent mass, moving-pivot force,
14,540 contact-Jacobian, 4,846 time-derivative and 200 projection checks. A
separate 1,000-case dry-friction KKT check covers sticking and both sliding
directions. The first formula check failed its time-derivative tolerance with
a larger finite-difference step; the refined derivative check passes unchanged
tolerances. That failure remains recorded.

Energy accounting reconstructs prescribed-pivot work, kinetic and gravitational
energy, angular damping and dry-friction work. Positive work residual totals
fall from 0.008115 to 0.004078 to 0.002050 under successive refinements. The
largest positive finest-step residual is 4.46e-7. Negative residuals include
inelastic impact losses, especially during initial settling.

Playback compresses the finest trajectory into 6,349 initial and 5,673 repeated
knots, with angular error at raw states no greater than 1e-7 radians. Continuous
pin-to-pawl bounds certify 13,211 intervals within a 1e-6 clearance tolerance,
including every repeat orientation. The pin envelope includes all actual
Float32 vertices. Additional capsule bounds keep the two pawl assemblies at
least 0.106432 model units apart and clear of fixed shafts. All eight checked
shaft/bore interfaces retain at least 0.002997 radial clearance. Actual axial
layers separate wheel, pawls and lever; coplanar cap faces act as thrust faces.

The complete 3D screen checks 600 independent-family pairs at 275 poses,
including both strokes, catches, angular extrema and all pin orientations.
None of 118,326,808 actual surface samples penetrates beyond 1e-6. All 186
production geometry buffers and 21,796 poses match the verified candidate
exactly. The complete mesh screen is sampled; the primary contacts and listed
secondary separations have separate continuous bounds.

## Rendering and remaining project work

The model has no ground plane or fog, uses a fixed four-second display cycle,
and stays framed on desktop and mobile. The first preview screen rejected an
empty corner of a rotated bounding box; the corrected check uses actual mesh
vertices. All fourteen integrated saved views are inspected. The separate
preview video was recorded but was not watched. The build retains its existing
large-bundle warning, now about 19.6 MB before gzip.

Movement 077 has no remaining verification work. Review continues at 078.
Movements 037, 063, 071 and 073 remain mechanically unresolved. The complete
507-movement review remains active.
