# 060 · Rebuilt and verified

Production `src/simulation/dual-belt-speeds.js` and
`dual-belt-speeds-motion.js` replace the old 12,997-character factory. The old
factory was compared exactly with `060-original-factory.txt` before removal;
its 9,893-character test is retained in `060-original-test.txt`. Candidate
modules now re-export production. Five focused tests, the build, all 2,972 numerical tests and all 20 browser
tests pass. Both full-suite wrappers exit zero with no signal. The catalog review remains
unfinished, with 037 still unresolved.

## Source interpretation

[The official entry](https://507movements.com/mm_060.html), saved as
`../reference/mm_060.html`, has no available official animation. Brown's
unchanged enlarged engraving is `../reference/brown-060-detail.png`, from PDF
page 24 (one-based), scale 6000, crop (500,1000,1300,1380). Its description is
on PDF page 25, printed page 21 (`../reference/brown-page-25.txt`).

Two unequal upper pulleys share the driver shaft: large at source left,
small at source right. Four equal lower pulleys share an axis. The outer two
are loose; the inner two are fixed to the output shaft. Both flat bands
remain installed. Initially the left runs on its outer loose pulley and
the right on its inner fixed pulley, giving slow output. Both bands move
right to select quick output: the left engages its inner fixed pulley and
the right runs on its outer loose pulley. Their linear speeds differ; in
quick mode the right loose pulley turns more slowly than its shaft. Both
bands move left on return. Stopping the drive before each traverse is an
inferred operating sequence, not an official animation.

The read-only `scripts/measure-dual-belt-speeds-source.mjs` uses median first
and last dark pixels across explicit unoccluded column regions. Its JSON
records regions and measurements. At 200 pixels/unit and origin (640,1047),
the lower shaft is y=0 and upper shaft y=3.38. Drawn upper pulley centers
disagree with each other and the shaft by several pixels; the model keeps
physically concentric pulleys and records residuals.

Actual mesh side envelopes overlay the unchanged scan in
`060-source-alignment.html`. Measured pulley-body and shaft top/bottom
residuals are within seven scan pixels. This bound excludes schematic band
arches and torn-end marks. Continuous physical bands fill the interrupted
loops. Lower lane centers use visual estimates at image x=367,493,790,911,
with widths approximately 126,123,108,128 pixels. The substantial exposed
shaft between the two lower banks is preserved.

## Confirmed baseline defects

`060-hardware-baseline.json` checks actual round-band surfaces against all
upper treads and lower bodies/rims at 97 full-cycle poses. This scoped
one-direction test refreshes cached geometry whenever the dynamic position
buffer changes. It finds **244,486 penetrating samples in 3,194,880 checks**.
Maximum upper-tread intrusion is 0.041673336; maximum lower rim intrusion is
0.040248850. Shafts, supports and marker solids are outside its scope.

All baseline frames at phases 0, 0.428 and 0.66 were inspected. They show
reversed source ordering, undersized lower pulleys, a compressed bank gap,
round cords, obstructing rims, added support geometry and a ground shadow.
Original dimensions, camera and timing are in `060-baseline-parameters.json`.

## Replacement assembly

Ten closed solids form two driver pulleys, four lower pulleys, two shafts
and two complete flat bands. Upper radii are 1.30 and 0.7325; all lower
radii are 1.2625. Lower centers are z=-1.365,-0.735,0.75,1.355, with widths
0.63,0.615,0.54,0.64. Upper drums span z=-1.675..-0.395 and 0.47..1.68.
The upper shaft radius is 0.18 and output shaft radius 0.1925. Loose pulleys
have real radius-0.1985 bores, giving 0.006 radial clearance. Rigidly attached
pulleys and shafts may share their joining surfaces.

Each band is 0.285 wide and 0.02 thick with 0.00015 radial clearance. Its
neutral-fiber pitch radius includes half the thickness and clearance: upper
values 1.31015 and 0.74265, lower value 1.27265. Slow and quick ratios are
0.74265/1.27265 and 1.31015/1.27265. Solid band meshes translate axially;
vertex-color stitches show material flow without protruding markers. A
-0.055 band-center offset follows the source's slightly leftward placement.

Two 2.4-second authored dwells and two 0.9-second stopped traverses form a
6.6-second authored demonstration. Each dwell turns the driver half a
revolution. Quintic interpolation gives zero velocity and acceleration at
transition endpoints. State is a pure function of unbounded time, including
negative cycles. The measured common playback scale is 3.3, giving a
two-second display cycle: peak rotation about 1.33 revolutions/second and
75th-percentile visible speed about 0.99 revolution/second. Individual
members are never rescaled independently.

The source camera looks along negative x with seven-degree FOV; the alternate
oblique direction is (-8,3,6). Ground is hidden. Bearing mounts and axial
retention remain ideal constraints, absent from the engraving. Friction,
elasticity and inertia are not solved.

## Evidence

- `060-candidate-solids.json`: ten positive-volume closed solids, all triangles
  nondegenerate, corner normals outward, and oriented edges paired.
- `060-candidate-hardware.json`: 97 poses, 39 independent body pairs,
  **49,976,460 bidirectional surface samples, zero penetrations**.
- `060-candidate-exact-contact.json`: 24 independent actual 3D triangle
  checks on upper/selected lower contacts and both neighboring lower treads
  at shift midpoints. All gaps are positive, 142.946 to 145.918 microunits.
- `060-candidate-motion-check.json`: actual group-angle and band-position
  derivatives, stopped traverses and repeatable transforms/colors pass.
  At 5,928 wrapped neutral-fiber samples, curve tangent velocity agrees with
  the corresponding rotor velocity to maximum relative residual 4.114e-13.

These finite sweeps and tessellated contact checks do not certify arbitrary
unsampled collision freedom or solve friction/inertia dynamics.

All candidate source, oblique, rear, stopped-shift and quick-mode views were
inspected. The capture harness initially used a copied shadow half-extent of
four; it now honors the model's extent of five and bias -0.00003. Bias
comparisons and isolated shadow-caster captures are retained. Prominent blue
cap patches separate into shadows cast by bands and other pulleys; with
shadow casting disabled that face shades uniformly. Cap normals are axial
and vertex color uniform. Shared renderer and production lighting are unchanged.

The five focused tests pass in 5.11 seconds. They check actual closed
surfaces/source bounds, loose-pulley bores, selected and bridging band
contacts, independent band speeds, neutral-fiber flow direction, stopped
shifts and seeking through negative/multiple cycles. The build passes in
9.13 seconds with the existing bundle-size advisory. All 2,972 numerical tests pass in 137.471 seconds (concurrency eight); the
wrapper exits zero without a signal. All 20 browser tests pass in 768.349
seconds (one worker), including all 507 canvases and 060 playback, pause,
orbit and mobile layout. Its wrapper also exits zero without a signal.
All six integrated source/oblique frames at phases 0, 0.432 and 0.68 were
inspected. The gallery contains 244 comparisons; 060-reconstruction.json
records rebuilt-and-verified. Movement 061 is in baseline review, and the
catalog remains unfinished.
