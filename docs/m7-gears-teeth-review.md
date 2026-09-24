# Lane m7-gears-teeth: minor residuals for 195, 202, 228, 270, 280, 299, 302, 304

Pass-51 minor-residuals lane. Each ID was captured beside its engraving before and
after (`review-movement-source-views.mjs`, own non-watching server), sampled at
several phases, and screened with `show-body-intersections.mjs --spacing=0.01
--samples=129`.

## 202: deep sawtooth wheel and V-thread Hindley worm

- A ring count of the engraving at the tooth band gives about 31 teeth per half
  turn, so the wheel has 60 teeth, not 48. The earlier count of 44 to 50 was
  wrong. The 60:1 ratio in `docs/movement-202-264.md` applies again.
- Brown's teeth are a deep 60-degree V. The cutter is now a sharp-V thread with
  30-degree flanks, 0.085 addendum and 0.092 dedendum (a pointed V is 0.095).
- The old section was warped onto the throat without turning. Its end threads were
  skewed by up to 34 degrees to the wheel radius, so they cut the wheel teeth down
  to narrow nubs. The section is now a true Hindley section: depth and arc are
  measured about the wheel centre in every worm meridian, in both the offline cutter
  (`scripts/generate-special-worm-wheels.mjs`, `hindley`) and the visible worm
  (`special-worm-solids.js`, `hindleyWormGeometry`).
- The worm is generated past its ends and cut square at Brown's half-length,
  2.1 sin 0.6. It is closed by flat end faces chained from the actual cut edges,
  round a straight bore. The first attempt kept the old flat caps joined to an
  unturned bore. Those caps bridged the thread gaps near the ends and caused the
  wheel intrusions.
- The 264 cuts are byte-identical. Evidence: `POSES=33 node
  scripts/review-special-worm-solids.mjs` gives sampled-flanks-clear. 202 had
  2,656,332 queries with 0 penetrations and a maximum closest gap of 0.00249. The
  body screen reports no pairs.
- Residual: to envelop the wheel over Brown's worm length, the worm must dip about
  0.175 R. Brown draws about 0.12 R, so the square ends stand a little taller than
  his.

## 228: drum and tent wedges

The disc is now a broad drum (depth 0.76). Its faces stop just inside the
side-link wires, so the rungs lie across its rim as Brown draws them. Each wedge
is a pointed tent 0.45 long axially and 0.47 proud of the rim, and it keeps the
generated driving notch (`chain-drive-working-parts.js`). The driving gap is
0.00079 or less, and the screen reports no pairs.

## 270: laid rope

The flat band is replaced by three closed helical strands on the same tangent
path, touching the tread. The buffer holds the rope at zero travel as a fixed
solid for the clearance tests. A vertex-shader uniform moves the lay with the
rope; the lay divides one pulley circumference. The rope/tread pair is tangent.
The only screen pairs are the known 0.0006 rolling contacts between the rollers
and the outer race.

## 280: pawl links

- Brown's two pawls are plain parallel links about 24 degrees below level, with
  eyes round small pins. They are now bored blue links 0.13 wide, on 0.09 pins.
- The pivots are placed so that the 0.93 backstop shrink lands them on Brown's
  eyes, at raster (250, 235) and (248, 273). This removes the earlier offset of
  about 8 px.
- The seats are where those lines meet the ratchet tips. The baked envelope was
  regenerated with `scripts/generate-friction-windlass-backstop.mjs`: lifts are
  0.004 to 0.086 and 0.047 to 0.236 rad, and the minimum pawl/tooth gap is 0.0010.
- The screen shows only the coaxial flange seats.

## 299: far teeth faded

A depth cue fades every crown-tooth fragment behind the plane through the crown
axis facing the camera, whatever the camera. The near strip of raked teeth now
reads like Brown's, and the far teeth sit pale behind it as in his light outlines.
Contacts remain tangent (0.0000).

## 302: fine saw teeth

The teeth are now 0.4 tall, a little under the band depth. They have raked fronts
(0.18 pitch) and slightly hollow backs (exponent 1.3), and read as fine saw teeth
rather than crenellations. The test bound on tooth height to band depth is now at
least 0.85, matching Brown. The 513-phase contact law and tangent contact (0.0000)
are unchanged.

## 195 and 304: no change (forced)

- **195:** Brown's worm lies across the wheel face and spans several slots. Along
  that chord, the radial direction turns by up to about 24 degrees while the thread
  stays square to the worm axis. The spaces it generates are therefore slanted and
  curved. Straight radial slots that cleared them would span about 77% of the
  pitch. Brown's slots are schematic.
- **304:** Goodrich's 30 pins at 12 degrees need the two pallets half a pitch
  (6 degrees) apart. The same pin passes from the outer pallet to the inner one.
  Brown's roughly 13 degrees fits no alternating count at this pin spacing: 1.5
  pitches gives 18 degrees, and 42 pins would contradict both Goodrich and Brown's
  own pin spacing. The short concentric locks follow from the 4-degree swing.

## Validation reruns

- Regenerated `docs/validation/202-264-worm-solids.json`,
  `191-196-201-contact.json` and `200-226-bevel-solids.json`. The last two hash the
  whole of `authored-gears-core.js`.
- `141-review.json` is a historical report pinned to its source commit. It was left
  at HEAD.
