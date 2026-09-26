# Pass 62 follow-up lane (39, 97, 114)

Reviewer: Claude Opus 5.5 (lane p62-followup), 2026-09-26. The before and after
captures come from `scripts/review-movement-source-views.mjs` (the production
route, default and oblique views). They were taken outside Git.

## 39: Sun-and-planet flywheel

I read plate mm_039 closely. Brown's large wheel has a narrow continuous outer hoop.
Inside it are four open windows, each bounded by the hoop's inner arc, by two
paired radial lines and by the sun gear in front. The "four radial joints" are
the four thin spokes, seen only between the gear tips and the rim. The windows'
shadow lines sit on their upper edges, as they do for holes. The gear hides the hub.

I measured radially from the sun centre, with the sun flange (0.49) = 53 px as
the scale:
- outer rim circle: 139 px (1.285)
- window arcs: 121 px (1.12)
- gear tips: 88 px (0.81, model 0.774)
- spoke width between the paired lines: about 13.5 px (0.125)
- spoke angles: 88.5°, 180° and 270°, with the fourth hidden by the planet

Before this pass the model was already a single-face filleted spoked wheel
(`spoked-wheel.js`) with rim radii 1.27 and 1.10 and spokes 0.11 wide. That is
within a few pixels of Brown's proportions, so the hoop was not too thin. I
set rim radii 1.285 and 1.12 and spoke width 0.125 to the measured values. The
spoked-wheel style still fits: Brown's window corners at the rim are slightly
rounded. The change is subtle in the default capture.

- Intersections: the screen (0.01 spacing, 129 samples) finds no pairs, before and after.
- Faces: one pre-existing same-colour coplanar pair, between the gear's flange
  cylinder and the gear body. It is not in the flywheel.
- Reports regenerated because they fingerprint `authored-gears-core.js`:
  - 191-196-201 contact
  - 200-226 bevel solids
  - 202-264 worm solids

## 97: Grooved heart cam

The quadrant cue also tinted the heart-shaped island (`inner`). The entry in
`src/data/rotation-indicators.js` is now `floor|outer` plus the round front and
rear hubs. The heart boss now shades as one flat part. The disk face and rim
still carry the cue. This is a visual change only, so no rebake was needed. The
baked-loop tests for 97 pass.

## 114: Double rack

`scan-bad-faces` flagged two same-colour coplanar pairs, `frame` × `stubExtension0/1`.
The captures showed a dark crack and a step where the separate run-on boxes met
Brown's slanted break ends (x 13–17 and 501–505).

The frame outline now runs the stubs on straight and squared, as one extrusion
with the frame. Their ends sit at the old run-on lengths, so they never travel
into the drawn view. The separate stub meshes are gone. The scan is now clean
and the default and oblique captures show no seam.

The native model keeps the drawn outline, in both the collision cells and the
mass properties, through `userData.workingParts`. The run-ons touch nothing.
Keeping their volume in the mass instead gave a 0.06% frame-mass change. That
tipped one chaotic tooth-transfer impact at t≈9.27 s to 0.016 rad input error,
against the test limit of 0.01. With the drawn outline the error is 0.0069.
Small perturbations of the parameters also stay under the limit.

The physics XML changed, so 114 was rebaked. Seam step 0.71 px, round trip
0.006 px, and the baked-loop tests pass.

The intersection screen runs through the synchronous registry's authored study,
which this change does not touch. Its results are unchanged: tooth-working
overlaps up to 0.104. The production native test reports 0.074 px maximum
penetration.
