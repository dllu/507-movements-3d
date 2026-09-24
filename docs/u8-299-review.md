# u8-299 review (pass 51, user feedback)

User report: 299's crown teeth had vertical leading faces with wide flat gaps
where Brown draws raked saw teeth, and the pallets were thick blocks rather than
slender pallets.

## Plate reading (public/engravings/mm_299.png)

An edge-on strip of crown teeth. Each near tooth's leading face runs straight
from a foot up and forward to the tip. The foot lies about 0.37 pitch behind
the tip (tips at x 190 and 438, feet at 105 and 330; pitch about 245 px). The
next tooth's concave back starts at that foot, so the strip has no flat gaps.
The teeth stand about 0.55 pitch tall. The far-side teeth show through the gaps
and point the other way. The verge journal is drawn as a circle with a small
pivot circle, and two slender strip pallets (about 1:6) leave it about 106
degrees apart.

## Changes (src/simulation/authored-escapements.js)

- New `rakedSawToothGeometry`, used only when the new crown option
  `toothRakeFraction > 0`. Only 299 sets that option. It builds a closed solid
  bounded by the concave back above, and below by the band up to the foot and
  then the raked leading-face line. Its back spans `pitch + rake`, so each back
  starts at the foot of the tooth behind.
- 299 now uses `toothRakeFraction: 0.35` and `toothBackExponent: 2.3` (was 1.8).
  The longer back has to sag more: with exponent 2.0 the idle pallet grazes a
  back by 0.0014 at 193 samples, and 2.1 or higher is clear. It also uses
  `palletThickness: 0.12` (was 0.2).
- I tried extending the pallets past the release edge to match Brown's length,
  but it sweeps into the next back as the pallet dips. Extending by 0.02 already
  penetrates 0.006, so I rejected it.
- The crown wheel userData now records `toothBackAngle` and `toothRakeAngle`.
- 234, 238, 298, 300, 301 and 302 are unchanged: their default path still uses
  `curvedSawToothGeometry` with the 0.8-pitch back.

## Verification

- Default view: a strip of raked, hooked teeth with no flat gaps. The far teeth
  cross behind them as in the plate, and slender pallets hang from the end-on
  journal. The tooth tips sit about -108 and +142 px from the journal, against
  -103 and +145 on the plate.
- Phase captures at t = 0, 0.5 … 3.5 s: the verge swings about ±45°, and the
  pallets alternately reach the near tips while the crown steps. The oblique
  capture shows the tips engaging the pallet faces.
- `show-body-intersections 299 --spacing=0.01 --samples=129`: only 0.0000
  tangent contacts (tooth × right/left pallet face, tooth × right neck).
- Tests: verge-crown-working-solids (including the negative control),
  movement-299 (plus a new raked-tooth test), 234, 238, 298, 300, 301, 302, the
  238 contact and parts tests, debaufre-300-301, source-presentation and
  crown-gear-contact all pass.

## Residuals

- The pallets stop at the release edge, so they are about 20% shorter than
  Brown's strips.
- The band is a flat dark surface without Brown's vertical hatching.
