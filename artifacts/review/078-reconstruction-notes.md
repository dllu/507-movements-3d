# Movement 078: verified integrated reconstruction

The current record is `078-integrated-checkpoint.json`. The reconstruction is
integrated and verified against 823 frozen inputs. Seven focused tests, all
3,081 numerical tests, the build and all 34 browser checks pass. The browser
sweep rendered all 507 entries. This does not establish source fidelity or
mechanical correctness for entries still awaiting review.

The model has 23 closed solids: a 26-tooth wheel with six open spoke spaces,
a traced A-frame and rocker, and nearly equal-length hooked pawls with real
bores. Brown's source is page 28, printed page 24, crop
[1790,1150,1270,1300], also represented at
https://507movements.com/mm_078.html. Twenty labelled visible tips support the
26-tooth layout, with angular-position RMS error 9.311 source pixels.
The outer-circle radial RMS error is 3.783 pixels. The masked inner-rim fit
uses 76 readings, with radius 315.524605 pixels and RMS error 2.348271 pixels.

Pixel rays support the undercut ratchet faces. The tooth root radius is
0.872, with the root 0.045 radians behind its tip. The left hook's rear sole
is relieved while its visible front outline remains source traced. This
hidden recess, concentric wheel, repeated spoke openings and covered
boundaries are explicit reconstruction assumptions. Initial pawl seating
shifts the source tips by 6.52 and 8.18 pixels.

Only the rocking lever is prescribed. Wheel and pawls respond to gravity,
moving-pivot inertia and finite inelastic profile contact. Common density,
absolute angular damping and bidirectional dry-friction resistance are
assumptions; there is no prescribed wheel counting curve or one-way output
clamp. The eight-second physical cycle, with 0.38-radian lever amplitude,
is displayed in four seconds. Nearby friction loads 5, 6 and 7 all retain
the one-tooth steady advance.

The selected 0.00025-second trajectory has 64,001 states and no solver
failures. Its initial cycle advances 0.851690225 tooth clockwise and retains
0.000103403 tooth of physical rollback. The steady cycle advances
0.999999979 tooth, has no sampled reverse motion and is stopped for about
45.7% of the cycle. Playback preserves this settling and then repeats with
one additional clockwise tooth, using 4,514 first-cycle and 5,158 periodic
knots. Compression and seam corrections stay within 1e-7 radians.

The final two refinement differences are 0.187008 and 0.188089 source pixels.
Both pass the 0.25-pixel agreement criterion; the spatial difference does
not decrease monotonically. For equal 16-second runs, positive energy-work
residual falls from 0.001551674 to 0.000801633 to 0.000381566. This is observed
numerical agreement, not an exact continuous-time dynamics proof.
Independent normal-cone checks pass for all 153,773 positive contact impulses,
with 307,546 boundary checks and 307,546 reaction-direction checks.

Complete triangle-face bounds include edge crossings throughout every
piecewise-linear playback interval and all 26 wheel orientations. The
primary bound certifies 409,918 subdivided intervals and 129,112,532 triangle
pairs within the unchanged 1e-6 geometric tolerance. All 192 independent
part pairs are covered: 144 axial separations, seven bores, two primary
contacts, one full pawl-body pair, two frame/pin pairs and 36 capsule bounds.
The pawl faces retain at least 0.004080 model units of clearance; minimum
radial bearing clearance is 0.0029993 units.

Production matches all 69 candidate geometry buffers and 33,758 poses
exactly. Its additional all-pair surface screen covers 307 poses and
84,041,118 actual mesh samples without penetration beyond 1e-6.
Fourteen integrated stills and eight playback-preview stills are inspected.
Source alignment, front/oblique/rear views, both strokes, repeat, desktop
and mobile framing pass. The recorded preview video was not watched.
Conservative motion bounds keep the camera fixed through every interval
and wheel orientation. Fog and ground are absent from the model view.

The build retains the existing large-bundle warning: the main JavaScript
bundle is about 20.46 MB before gzip. Eighteen historical browser captures
were restored after fresh regression copies were archived.

## Preserved rejected work

The original factory, original test and nine failed baseline views remain
available. The baseline used 24 teeth, unequal pawl lengths, decorative
spokes on a filled disk and prescribed return curves. Its finite fingers
penetrated the wheel in 9,715 of 93,412 checks at 193 poses; separate checks
also found bearing interference.

Earlier construction errors, mirrored tooth interpretation, unrelieved
hook intrusion, unmasked rim fit and the stalled 0.22-radian input study
retain their original evidence. The dt=0.0005 playback failed a continuous
contact bound by crossing a transition by 1.49e-6; the selected finer
trajectory passes at the original tolerance. A broad body capsule could
not prove separation, so the complete actual body faces were bounded.
The first reaction runner's constant-assignment error and the first
engagement test's missing reverse surface query are preserved, along with
their corrected results. The first production parity report retains its
mistaken movement-77 label in a separate historical file.

`078-baseline-checkpoint.json`, `078-finite-study-checkpoint.json` and
`078-playback-study-checkpoint.json` preserve the earlier stages.
The original `078-reconstruction.json` remains the baseline record.
The complete 507-movement goal is active. Movements 037, 063, 071 and 073
remain mechanically unresolved; review continues at 079.
