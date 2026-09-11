# 066 · Gravity jump weight

The replacement is integrated and verified. All **3,009 numerical tests and
26 browser tests pass**, with no retries, alongside the nine focused tests
and production build. Ten integrated source/oblique frames, the complete
source overlay and both desktop/mobile views are inspected and hashed.
The browser run includes all 507 canvases; this does not certify the
mechanical fidelity of the unreviewed movements. Production now uses
`src/simulation/gravity-jump-weight.js`, `gravity-jump-motion.js` and the
separate 26-tooth `gravity-jump-worm-profile.js`.

## Source and baseline

The [official page](https://507movements.com/mm_066.html) describes the
arm-mounted weight as a modification of 064. Its HTML marks animation
unavailable; no official animation was watched. Brown's engraving was
inspected at PDF page 24, printed page 20, scale-to 6000, crop
x620/y3740/990×1290. The original factory, exclusive weight helper and model
test are archived and matched exactly before removal. Four inspected
baseline images are retained as `066-original-phase-*.png`.

The old model's prescribed cubic free fall creates energy. Even using only
the bob's point-mass inertia, mL² = 3.3124, its kinetic-plus-potential energy
gains 32.859476 during the claimed free stage. At the first interior sample,
the required extra positive torque is 80.555296. Passive gravity and drag
cannot produce that motion. The old finite pin/collar check finds 1,034
penetrating samples in 140,712 checks over 78 poses, including 36 poses
labeled engaged. Those baseline checks did not certify the other old parts.
See `066-gravity-pin-baseline.json`.

## Geometry and source fit

The common orthographic source transform is shaft center (501,807), scale
218 pixels per model unit. The bob center is (642,242), giving arm length
2.671... and bob radius 180/218. The arm, sleeve and bob form one independent
weighted rotor. A finite rectangular pin turns with the wheel's solid
shaft; the annular sleeve and half-annular end fit around it. The final pin
ends at radius 0.41, inside the sleeve's 0.425 projected outline. The sleeve
bore is 0.27, shaft radius 0.25, pin width 0.115, and contact tolerance 0.00015.
The arm and bob run in front of the worm, so the falling weight clears it.
Ground and fog are absent. Grounded shaft bearings are ideal constraints.

Twenty, 24, 26 and 28 regularized teeth were compared against the same
32 manually marked lower tooth-boundary points. A single wheel-phase fit
gives respective RMS errors 11.6153, 10.1169, 6.4312 and 7.9482 pixels.
Twenty-six teeth are retained with phase -0.118413876943 radians. This is an
empirical regularization of an undimensioned drawing, not proof of its
historical tooth count. The upper dashed circles abbreviate the teeth;
the model retains teeth around the full physical wheel.

The worm has actual straight axial flanks swept helically, with a generated
throated wheel. Wheel outer radius is nominally 1.375, pitch radius
1.2767857143, module 0.0982142857, worm pitch radius 0.3232142857, center
distance 1.6, length 1.3744467859 and wheel depth 0.22. The worm is offset
34/218 along world X with matching phase correction -2*offset/module.
Its shaft ends follow the source's short left stub and longer right stub.
Common and enclosing centered cutter intervals produce the same 8,481
radial samples as the original interval; thus the translation does not
change the sampled active generating envelope. Doubling phase/radial
search resolution from 1600/80 to 3200/160 changes the field by at most
1.77636e-15. Stored 031 and 064 worm profiles are untouched.

`066-complete-source-outline.json` compares 96 marked boundary readings
and three centers. Maximum/RMS errors in pixels are: bob 3.000/1.815,
arm 8.572/5.667, sleeve 6.355/4.385, shaft 6.328/4.390, wheel 13.497/6.431,
worm 27.571/15.974, left worm-shaft stub 11.185/8.156 and right stub
18.850/13.487. Bob and input centers match the calibration readings; the
worm center is 12.2 pixels high. These are sampled boundary comparisons,
not a whole-image error bound. The worm's regular meshing proportions,
engraved perspective and some occluded boundary marks limit exact overlap.

## Gravity, release, swing and catch

The dynamics integrate relative angle and speed with RK4 at step 0.0005.
Free-flight acceleration comes from gravity and explicit viscous bearing
resistance, not easing or an assigned fall duration. The uniform component
mass model includes bob, arm, sleeve and the half-collar's eccentric center
of mass. Total shaft inertia is 7.7145624479; gravity moment amplitude is
27.3904032777. A regression test independently integrates the actual triangle
solids' mass moments and inertia and agrees within tessellation tolerance.

The pin rotates at 0.4 rad/s. With explicit damping coefficient 8, release
occurs at authored time 0.8970992293, where the required unilateral pin
torque crosses zero. The bob falls, overshoots the bottom and swings back.
The advancing pin catches it at 8.4617090283, with incoming weight speed
-0.1295784238. The catch impulse is 4.0854658216, motor impact work
1.6341863286 and dissipated impact energy 1.0817872752. Catch is perfectly
inelastic; the constant-speed motor and bearings are ideal. Damping is a
stated model assumption, not a value inferred from an unavailable animation.
The viscous torque is referenced to an ideal fixed support; friction between
the sleeve and moving input shaft is not separately modeled.

A finite pin consumes angular freedom at both ends of the half-cut collar:
available lead is π - 2 asin((0.115/2 + 0.00015)/0.27) = 2.7112424026.
Maximum actual lead is 2.5641367442, leaving 0.1471056583 radians before the
opposite end. Peak forward speed is 2.2885808673; minimum speed is
-0.9117110233. Both ends are also exercised by undamped/less-damped cases.
Impacts are located inside an integration step by 48 bisections; releases
on a driven boundary use the analytic torque root. There is no step-end
projection in the accepted solver.

`066-event-resolved-dynamics.json` checks five damping cases and four time
steps. Maximum energy residual for the retained case is 6.2741e-12, maximum
independently differentiated torque residual 2.6703e-9, and energy-rate
residual 7.8694e-9. Refining the step changes angle/speed by less than
1.6e-12. Cycle repetition was checked in both time directions and through
ten turns. The preliminary step-end projection screen is retained as a
historical, nonaccepted experiment.

## Actual contact and complete hardware

The first 20-tooth candidate was rejected. Its 65-pose worm check completed
71,267,300 sampled containment checks without penetration deeper than
1e-6, but exact triangle checks found intersections in eight poses and
force-power mismatches above 2% in two more. This demonstrates why sampled
containment alone was insufficient. `066-candidate-worm.json` records the
failure; its process exit is 1.

The corrected 26-tooth, translated and phased worm pair passes 65 poses,
92,228,630 bidirectional surface samples and exact working-flank triangle
distances. No sample penetrates, the gap is 0.0000316144–0.0000427528,
minimum positive output moment is 1.1880666, and maximum relative
force-power residual is 1.49395%. See `066-refined-worm.json`.

`066-final-pin-contact.json` checks 82 actual finite pin/collar contact poses,
including four lower/upper impacts across damped and undamped models.
All contact forces and impulses are compressive with correct torque signs;
normal gap is approximately 0.00015000125. Relative normal velocity and
input/output moment balance are checked from the actual witnesses. The
0.00015 gap is an explicit rigid-contact tolerance.

The final shortened pin and fitted shaft ends are covered by
`066-complete-hardware.json`: all 39 remaining independent-family pairs,
140 poses and 355,772,258 surface samples, full cycle, denser free flight
and both sides of release and catch. Together with the worm pair, there are
448,000,888 sampled checks without penetration. The dense worm/wheel pair is covered separately above. All 11 solids
have positive signed volume, outward stored normals and paired oriented
edges in `066-complete-solids.json`. Degenerate zero-area worm clipping
triangles are excluded from the topology count; no open boundary remains.
Same-family integral joints are allowed.

Production matches all 11 audited candidate mesh position/normal/index
arrays and their world matrices at eight distinct motion states; see
`066-integrated-candidate-equivalence.json`. The default displayed cycle is
26 seconds, one worm revolution per second. A slower 40-second request is
also tested. Final validation uses the source hashes in
`066-verification-source-hashes.json`. The full numerical process exits 0
in 202.596 seconds, build in 33.559 seconds, and all-browser process in
921.448 seconds; each has a recorded null termination signal. The final
record is generated by `scripts/record-gravity-jump-review.mjs`.

037 and 063 remain unresolved. 031, 064 and 065 have verified checkpoints.
The full 507-model task remains active.
