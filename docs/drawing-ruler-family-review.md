# Drawing-ruler family: 322–325

Reviewed the original engravings, captions and available animation scripts for
[322](https://507movements.com/mm_322.html),
[323](https://507movements.com/mm_323.html),
[324](https://507movements.com/mm_324.html) and
[325](https://507movements.com/mm_325.html). 322, 324 and 325 provide animations;
323 does not. The existing analytic diagonal translations, rolling ratio,
crossed-arm constraints and parallelogram motion are retained.

## Corrections

- **322:** removed raised handling-hole rings and edge strips absent from the
  source; the actual bored triangle meshes and their outlines remain. The strips
  extended past the shared diagonal corners and the rings penetrated the faces.
- **323:** replaced solid wheel bodies, hubs, axle collar and end nuts with bored
  solids using the shared lathe helper. The stationary journal blocks now contain
  real axle holes and extend above the shaft instead of intersecting it at their
  top edge. Moved face indices away from the bore. Nick corners and side rims
  stay at or inside the nominal rolling radius, avoiding paper penetration.
- **324/325:** replaced stretched solid bar links with rigid eye plates and actual
  pin bores; 324's crossing also has a bored center eye. Fixed ruler pivots have
  matching bores, and pins now pass through the ruler thickness. Crossed arms
  retain separate layers with a 0.01-unit face gap.
- **All four:** removed the invented paper sheet and guide-line decorations,
  disabled ground/fog, and used a nearly planar source-facing camera. A root
  Z reflection corrects the old source-coordinate handedness: the drawings'
  positive-up planar coordinate now appears above the center when viewing the
  physical upper face. The local analytic state remains unchanged.

`drawing-ruler-parts.js` shares bored arms, fixed ruler plates and presentation
setup. No geometry is rebuilt per frame. Runtime remains analytical and existing
readable display timing is retained; no native contact solver is needed for these
ideal determinate constraints.

## Evidence and limits

The four existing movement suites plus `drawing-ruler-solids.test.mjs` pass
39 tests. New checks raycast finite pin cylinders through arm/ruler holes,
check rolling-wheel and bearing bores, bound the actual wheel mesh above its
nominal paper contact plane, and contain all four complete motion sweeps in
camera bounds. Existing suites retain dense analytic motion and source-ratio
checks. Obsolete assertions about scaled solid bars and decorative rings were
replaced with the corresponding structural expectations.

Default/source and advanced oblique desktop views were inspected. Seventeen
sampled poses stay in frame, with no browser errors; maximum absolute projected
coordinates are 0.846 or less for 322–324 and 0.853 for 325. These checks do not
certify arbitrary view angles or every solid pair. 323's knurled tread is still
a stylized gripping-wheel reconstruction with a constant-radius rolling rim;
its no-slip demonstration does not model actual paper deformation or friction.
Plate thicknesses, pin fits, washers and vertical assembly layers are inferred
from plan views. Other historical ruler proportions and input schedules remain
unchanged. Fine visual details remain candidates for the final source-fit pass.
