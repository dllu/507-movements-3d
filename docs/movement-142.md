# 142: reconstructed epicyclic variable traverse

The [source caption](https://507movements.com/mm_142.html) describes a fixed central
pinion, an orbiting spur gear carried by a disk, and a crank attached to that gear
driving a traversing guide bar. There is no published animation for this movement.
The gear and slider constraints are analytically determined; MuJoCo is unnecessary
for this reconstruction unless later contact checks reveal an additional freedom.

## Corrected measurements and ratio

The engraving clearly shows **six** central pinion teeth, not the eight in the
old model. The larger gear's visible teeth are consistent with eighteen; its
lowest teeth are partly obscured by the crank. Six versus eighteen gives one
relative planet revolution per three carrier turns. The old eight-to-eighteen
ratio gave 2.25 carrier turns per modulation and nine turns per complete pattern.
The corrected complete pattern also takes three carrier turns.

Measured disk/sun centre is (268, 209), planet centre (270, 302), and crank wrist
(272, 405). The preceding model used y218, y308 and y404 respectively. The disk
radius is approximately 178 pixels, and gear outer radii approximately 35 and 73.
See `silk-traverse-dimensions.js` and the
[registered gear overlay](validation/142-gear-overlay.svg).

## Matched gear prototype

`silk-traverse-gears.js` generates a matched involute pair using the measured
93.02-pixel centre distance. Opposite profile shifts of +0.6 and −0.6 preserve
that distance while fitting the small and large tooth-tip radii. The actual
generated outer radii are 34.76 and 72.86 pixels. The small gear's working root
radius is 19.99 pixels; the engraving's larger hatched circular stud end cannot
be used as a solid root cylinder in the same working plane without interference.
Its visible cap will need appropriate axial separation from the meshing teeth.

Dedenda of 1.02 and 1 module and a cutter-tip radius of 0.05 module keep the root
transitions clear. A first trial retaining large rounded cutter corners at those
depths intersected at 288 of 720 poses, with maximum overlap 0.0000471 world units
squared. Reducing the cutter corner radius removes that interference.

The selected pair clears all 720 sampled poses across three carrier turns.
Independent verification doubles tooth and cutter sampling and checks another
180 offset poses. Tests count the actual six and eighteen tooth tips and check
zero pitch-contact velocity at the fixed sun. See the
[hashed prototype report](validation/142-gear-prototype.json).

## Complete hardware and playback

The browser now loads the measured carrier, corrected gears, separated stud cap,
bolted crank and complete connecting rod/guide. The fixed cap is in front of the
gear working faces, so its drawn 24-pixel radius does not fill the tooth-root
clearance. The crank and wrist pin pass in front of that cap. Planet axle, central
carrier bearing, crank hub and output shoe have actual passages.

The engraving truncates the rod and omits its output guide. The reconstructed
370-pixel rod retains the preceding model's explicitly assumed length. A complete
vertical guide, transverse output bar, supports and base show its action rather
than truncating the linkage. All their depths and omitted dimensions are inferred.
The guide is ahead of the crank's swept volume; placing it in the wrist pin's
axial layer would produce interference near maximum crank reach.

The full assembly passes 721 finite-profile clearance poses, including gears,
crank, stud cap, shafts, rod and guide supports. See
[the clearance report](validation/142-clearance.json). Same-body unions are excluded;
a separate check verifies the complete transverse shoe passage and its engagement
on the rail. Runtime tests check actual rod endpoints, loop closure, restart and
complete mesh bounds across three carrier turns.

Expensive geometry is generated offline and loaded from an approximately 530 KB
compressed asset. Motion is analytic: one carrier revolution takes five seconds
and the complete pattern takes fifteen. Five focused tests, packaged desktop/mobile
playback and visual checks pass without requesting WASM. Geometry and source
provenance are stored beside the asset. Fog and the generic ground plane are disabled.

```sh
node scripts/prototype-silk-traverse-gears.mjs
node scripts/review-silk-traverse-overlay.mjs
node scripts/review-silk-traverse-clearance.mjs
node scripts/bake-silk-traverse.mjs
node --test tests/silk-traverse-gears.test.mjs tests/silk-traverse-model.test.mjs
```
