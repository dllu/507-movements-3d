# Movement 165 — waved face cam

165 now plays a baked, source-shaped cam and follower with 13 visible meshes.
The finite roller stays seated under a quasi-static assumption; the browser
loads a 666,304-byte asset and interpolates three coordinates. It does not load
MuJoCo or generate cam/contact geometry at runtime. One revolution takes twelve
illustrative seconds, giving roughly two seconds per rise/fall of the six lobes.
The full 507-movement review remains active; see the review progress record.

## Source reconstruction

The [original page](https://507movements.com/mm_165.html) has no available 2D
animation. Its caption describes circular-to-rectilinear motion through the
waved wheel, oscillating rod and upright bar. The reconstruction uses 25 measured
points on the lower cam silhouette, a 49-pixel roller radius, the fulcrum near
(168,322), and the roller center at (336,270).

A shape-preserving cubic traces the cam. Its lower surface is cut across local X
at every depth, so hidden rear faces cannot fill the engraved arches. The cam
has a thin waved rim and a top web connecting it to the shaft. The roller has a
real axle bore; the lever eyes, pins and output connection have finite geometry.
The added legacy weight and support frame have been removed, and the ground and
fog are disabled.

The caption requires rectilinear output. The lever-end pin's small transverse
travel is accommodated inside the round output eye, with an ideal unpictured
vertical guide. Rim/roller depths, the top web, hidden eye clearance, fixed
fulcrum support and finite displayed bar length are reconstruction assumptions.
The shaft's drawn top ellipse corresponds to a flat circular shaft end; the
front projection check is orthographic and does not reproduce that stylized
ellipse.

The actual rim, web and source-pose roller triangles agree with the traced union
outline within **0.13781 source pixel**, RMS 0.01762, at 609 half-pixel columns.
This includes hidden/rear faces. Two columns within 0.012 source pixel of ideal
roller tangencies are excluded from the vertical-height metric because an
inscribed polygon can miss the exact tangent column despite negligible horizontal
error. The 0.006-unit working clearance shifts the playback's initial roller
center by about half a source pixel from its zero-clearance source pose.

## Motion and scope

Only one follower configuration is needed for each input angle, so production
uses a quasi-static finite-surface contact solve. It assumes that the weighted
upright bar holds a negligible-inertia follower against the cam. **It does not
predict inertia, friction, free flight or load capacity.** This is an ideal cam
animation, with an illustrative operating speed.

The solver minimizes the cam height across the roller's full axial width and
circular cross-section. It includes measured-profile boundaries, cubic/circle
crossings and annulus-edge cases, then solves the engraved rocker branch. It
uses a 0.006-world-unit clearance (one-third source pixel). A regression covers
an interior minimum immediately beside the annulus edge that ordinary sampled
local-minimum detection missed.

The lever, roller center and output bar are reconstructed from the interpolated
rocker angle at every frame, preserving the pin constraints. Roller spin
illustrates tangential rolling while allowing axial slip; it is not a friction
simulation. Cam and roller rotation accumulate across loops, while the rocker
position closes exactly. No motion seam blending or endpoint snapping is used.

MuJoCo remains useful for mechanisms whose dynamics determine their motion, but
its wedge-contact trials for this particular cam produced large rebound and
brief penetration. A height-field experiment was also unstable; slower drive,
frictionless contact and a small nonconformal relief did not resolve the problem.
These experiments do not justify presenting a dynamic trajectory as correct.
The quasi-static reconstruction instead derives the required contact geometry
directly, under the explicit assumptions above.

## Validation

- 721 continuous-contact poses, with 361 search-refinement comparisons. Doubling
  the lateral resolution agrees to the root solver's precision. Independent
  finite-cylinder samples give gaps from 0.006000 to 0.006284 world units;
  maximum root residual is 1.43e-11.
- The bake contains 3,507 keys, selected from 14,535 solved input angles using
  quarter/mid/three-quarter interpolation probes. Maximum accepted rocker-angle
  error is below 2e-6 radians. Independent 512-sample contact solves also check
  irregular playback times.
- Actual baked solids: 721 poses, 13 meshes, 61 cross-body pairs and 47,632,034
  vertex/edge-midpoint/triangle-center queries find no sampled intersection above
  1e-6 world units. Same rigid-body joins are excluded. This is sampled evidence,
  not a proof covering every point and time.
- Fourteen targeted tests pass, including pin alignment, output-eye travel,
  framing bounds, loop closure, restart and disposal. Production build and
  packaged desktop/mobile Chrome checks pass, including no WASM request.

The adaptive visible mesh reduces the compressed asset from 1.6 MB to 666 KB
while keeping source-projection error below 0.14 pixel. Screenshots, raw states,
builds and browser artifacts remain in `/dev/shm`.

Evidence: [source projection](validation/165-projection.json),
[continuous contact](validation/165-quasistatic.json),
[baked-solid clearance](validation/165-baked-clearance.json), and
[bake provenance](../src/simulation/baked/assets/165.provenance.json), and
[packaged browser checks](validation/165-browser.json).

```sh
node scripts/probe-wave-cam-quasistatic.mjs
node scripts/probe-wave-cam-projection.mjs
node scripts/bake-wave-cam.mjs
node scripts/review-wave-cam-baked-solids.mjs
node --test tests/wave-cam-contact.test.mjs tests/wave-cam-source.test.mjs tests/wave-cam-projected.test.mjs tests/wave-cam-quasistatic.test.mjs tests/wave-cam-baked.test.mjs
```

## Historical diagnostics

The legacy point-contact model intersected its roller by up to 15.9 source
pixels. The first reconstructed radial cam also failed whole-solid projection:
its rear faces altered the outline by 23 pixels, despite a small front-rim-only
metric. The projected native prototype's evenly spaced 129-pose solid sweep
missed a transient; adding suspicious continuous-gap poses exposed 0.303 pixel
of actual mesh penetration. These are unregistered counterexamples, not the
production animation. Their reports retain the hashes of the versions examined:
[legacy mesh](validation/165-existing-contact.json),
[legacy finite envelope](validation/165-envelope-diagnostic.json),
[radial native study](validation/165-native-study.json),
[adaptive radial study](validation/165-adaptive-study.json),
[projected native study](validation/165-projected-physics.json), and
[failed native-solid audit](validation/165-solid-clearance.json).
