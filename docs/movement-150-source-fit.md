# Movement 150: next source-fit experiment

This is a reconstruction hypothesis to test, not a validated model.

The hatched shaft section is approximately circular in the engraving, while the
visible cam contours resemble offset circles more than the current polar pear
profiles. Approximate visual readings put the large left contour near a center
of (157,272) and vertical radius around 69 pixels. Its roller at (195,193) is
consistent, to a few pixels, with contact on the upper-right quadrant of such a
circle. These readings need a reproducible pixel trace before acceptance.

A plausible alternative is a family of circular eccentric cams sharing one heel:
for eccentricity e and base radius b, use center (e,0) and radius b+e in the cam's
local plane. The common heel is then (-b,0), and total radial throw is 2e.
The present polar formula b+e*(1+cos(theta))/2 has only e radial throw and a
different silhouette. Rotating the eccentric circles leftward in the source
pose could explain the large left outline and progressively offset inner
contours. Do not simply change the formula while retaining the old source pose.

The present model treats pixel XY coordinates as coordinates in a common depth
plane, even though the shaft section, roller, lever and rod head occupy different
Z planes. This accounts for part of the measured projection mismatch. For an
orthographic view from positive X at angle phi, with the shaft section at Z=zF,
a pixel X displacement dx from that section corresponds to

    worldX = (dx * sourceScale - (zF - z) * sin(phi)) / cos(phi)

when the shaft axis is world X=0. At roughly phi=16 degrees and zF=1.9,
the current working cam plane z=0.15 projects its shaft axis about 30 pixels
right of the visible shaft section. Correcting for that would place the roller
much nearer the shaft axis in physical XY than the current construction.
The fulcrum and rod pin require the same depth-aware reconstruction; their
observed collinearity should constrain the fit.

Next: trace visible arcs, fit circle/ellipse candidates, fit depth-aware source
landmarks, then test contact and full-turn closure. Compare against the actual
render before changing production geometry or regenerating mass/physics/bakes.
Retain the existing physical clearances and explicitly record hidden geometry.

## Visible-arc measurements

`node scripts/fit-selectable-cam-source-arcs.mjs` now records manual stroke
center-line readings and fits in `docs/validation/150-source-arcs.json`.
The accompanying SVG overlays both the readings and candidate circles on the
original image. These are partial arcs, not traced complete cam boundaries.

The left contour fits a circle centered at (157.9,272.6), radius 67.8px,
with 1.34px RMS radial residual. Four visible right-hand strokes fit radii
56.8, 48.9, 42.4 and 38.4px at progressively leftward centers; their residuals
are 1.12–2.92px. Readings have approximately 2px uncertainty. In particular,
the inner circles deviate visibly from the lower-left strokes in the overlay.

This supports the earlier reading of the large left arc but does **not**
establish a family of four circular cams. There are five measured strokes,
and assigning each to a separate cam would be wrong for the current four-cam
interpretation. Some may be opposite faces, shaft edges, or separate portions
of a noncircular profile. The proposed equal-pitch, common-heel circle model
also needs to explain the left contour's center as well as the ordered right
contours. Do not promote that hypothesis to production from these fits alone.
The next reconstruction must trace connected boundaries and establish which
arcs belong to each face before solving depth and eccentricity.
