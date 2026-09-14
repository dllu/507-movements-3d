# 133: pinion-sector press — partial review

The [engraving and source animation](https://507movements.com/mm_133.html) show
a hand crank driving a pinion, sector and connecting rod to raise the platen.
The analytical six-to-one transmission and constant-length rod closure are retained.
This pass replaces its straight-sided teeth with rack-generated involute
profiles, including the small pinion's undercut root geometry.

The retained animation-based dimensions are an eight-tooth pinion and thirteen
installed teeth of a 48-tooth-equivalent sector. Pitch radii are 0.42 and 2.52,
module 0.105, pressure angle 20 degrees, addendum 0.9 module and dedendum 1.38
modules. A rounded cutter tip of radius 0.015 generates the roots. Tooth-thickness
relief is 0.001 and radial relief 0.00002. The profiles are generated offline
with 256 samples per tooth and 8,192 cutter steps, then loaded as compact point
arrays. Browser playback does not run this generation or download MuJoCo.

The pinion mesh phase is computed from the line of centres and both tooth
counts; it is not the previous rounded source phase. The sector tooth roots
extend into the existing web. Working faces have no expanding bevel, and the
pinion now has a real shaft bore.

Finite polygon intersections pass 721 sector positions through the full press
stroke with zero overlap. At 61 positions the largest nearest-flank gap is
0.004526 world units (approximately 0.35 source pixels, using shaft spacing for
scale). A half-tooth wrong-phase control intersects and fails. Tests check the
generator/source hashes, preserving reproducibility of the baked profiles.
The existing linkage regression still passes.

The columns now extend down into the base instead of stopping above it. The
platen guide rails extend back to the uprights while preserving their side
clearance. A solid header fills the unsupported opening between the two top
spacers. The upper anvil is deeper so that its pressing face covers the platen
in X and Z; previously their depth ranges did not overlap at all. These added
depths and connections reconstruct unspecified support details.

A dedicated frame test verifies these connections, rejects the original column
gap and anvil depth, and checks the platen assembly against fixed supports
through 721 positions. A positive closed-position vertical clearance remains;
no workpiece deformation or pressing load is simulated.

The connecting rod is now one rigid solid with two through-bored eyes, replacing
the solid spherical ends. Bore radii are 0.118 and 0.153 around 0.115 and 0.15
pins. The finite polygonal holes retain over 0.0029 units of radial clearance.
The rod is 0.20 units farther forward than the reference joint planes, leaving
0.07 units behind it at the platen brackets. Both pins span its full thickness;
retaining heads clear the eye faces by at least 0.01 units and exceed the bore
radii. These axial dimensions are reconstructed.

A dedicated rod test checks both axes, radial clearance, pin depth and head
clearance at 721 positions. The linkage test's transformed endpoint tolerance
is 3e-15 units to accommodate roundoff from the new rigid-body transform.
The rod remains rigid; the engraved dimensions now determine its length and the
platen trajectory.

The sector now has a single continuous web with two rounded openings traced
from the engraving, replacing three disconnected-looking narrow spokes. The
184-pixel source root radius is normalized to the retained gear radius. A local
boss preserves a complete seat around the rod pin.
The web test checks that full pin seat, connection to every tooth, and zero
web/pinion overlap at 721 angles. The traced openings are sampled once when
constructing the mesh; playback only rotates the rigid mesh.

The shaft supports now use cylindrical sleeves with 0.003 radial clearance,
replacing torus decorations whose openings did not fit the shafts. Both shafts
span their sleeves. The sector hub and web have a matching through-bore around
the fixed axle. Bearing fronts remain behind the rotating hubs, and the support
brackets terminate below the shaft envelopes. These hidden bearing dimensions
are reconstructed, rather than measured from the frontal engraving. Axial
retention and press-load bearing behavior remain idealized.

The overall proportions now use shaft centres (231,466) and (360,279) in the
525-pixel engraving, with scale 2.94 / hypot(129,187). The sector pin radius is
77 pixels and its open-position platen height is 244 pixels; their right
triangle fixes the rod length. The frame, platen and 99-pixel crank follow
measured raster landmarks. Eight projected landmarks are within four pixels
of the engraving. The largest residual is the drawn rod pin lying four pixels
below the axle, while the analytical open pose retains a horizontal radius.
The formerly longer rod misses the measured length by over 50 pixels.

The longer crank uses a shorter 0.22-unit axial grip so its tip clears the rod's
back face. The grip's hidden depth is reconstructed. Frame and linkage tests
cover the revised dimensions through a full stroke. The source animation's
gear ratio and angular travel are preserved; its different overall proportions
are deliberately superseded by the engraving measurements.

The display cycle has a six-second minimum, retaining the existing 40% lift,
10% dwell, 40% return and 10% dwell schedule with smooth easing. Restart,
a nearly frontal camera, no ground plane and hidden diagnostic indices improve
viewing. Fog remains disabled. Packaged desktop/mobile checks cover playback,
pause, exact restart, JavaScript errors and absence of a WASM request.

```sh
node scripts/generate-sector-press-teeth.mjs
node --test tests/sector-press-teeth.test.mjs tests/sector-press-frame.test.mjs tests/sector-press-rod.test.mjs tests/sector-press-web.test.mjs tests/sector-press-bearings.test.mjs tests/sector-press-proportions.test.mjs
node --test --test-name-pattern='movement 133 raises' tests/models.test.mjs
```

The landmark check does not certify every contour: the reconstructed base,
small hub sizes, symmetric frame and hidden axial details remain approximations.
The eight-tooth pinion and thirteen installed sector teeth retain the source
animation counts. Continue with a final silhouette comparison before moving on.
