# 142: epicyclic variable traverse review

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

## Remaining work

The browser still uses the old implementation. Build the measured carrier,
axially separated gears and stud cap, bolted crank and connected rod/guide.
The drawing truncates the rod and omits its output guide; their full dimensions
must remain explicit assumptions. Bake the expensive gear geometry offline,
retain analytic playback, and verify all joint/shaft clearances, motion bounds,
source view, speed, restart and packaged desktop/mobile behavior before
advancing to 143.

```sh
node scripts/prototype-silk-traverse-gears.mjs
node scripts/review-silk-traverse-overlay.mjs
node --test tests/silk-traverse-gears.test.mjs
```
