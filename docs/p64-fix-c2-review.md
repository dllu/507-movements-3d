# Pass 64 lane fix-c2 review

Scope: audit-64 group C findings for movements 374, 408, 416, 427, 437, 457, 463, 466,
470, 483 and 488. Each was checked against `public/engravings/mm_NNN.png` and against
fresh captures from a private dev server. The captures are the default view, phase 0.5,
±60/70° yaw, back, top, and the two loop-seam phases.

## Per movement

- **416** (`authored-spring-assisted-treadles.js`): rebuilt from the plate.
  - Removed: the base plank, flywheel standard and brace, treadle pedestal, spring standard
    and bracket.
  - Kept as short fixed stubs: arbor A, the crankshaft journal and the treadle pivot pin.
  - Spring A is now a flat coiled strip on the keyed arbor A. It wraps once closely round the
    arbor, with its inner end at the key. It then opens through a further half turn, and its
    free tail arrives square to an eye on crank pin B. The earlier straight helical coil
    pulled from a post is gone.
  - These points are measured from the plate (flywheel scale 1.24/128 px): the crank pin,
    hub, treadle joint, intermediate treadle pivot lug, tapering treadle tip and arbor.
  - The treadle now pivots on its lug between its tip and the pitman joint, as Brown draws it.
  - Crank B is a round boss tapering to the pin eye.
  - Consequence of the drawn proportions: crank 0.683 with a 1.009 fulcrum-to-joint arm rocks
    the treadle through about 86°.
  - The spring's deformation is prescribed. Its force readout is the existing ideal linear law
    along the arbor-to-pin line.
- **408** (`drawing-gauge-parts.js`, `correctCentrolinead`): the two guide pins no longer carry
  yellow collar knobs or long shanks behind the legs. Each is a plain dark peg (r 0.072), the
  height of the leg it bears on. Brown does not draw these pins on the instrument. They stay,
  minimal, because the legs' motion is defined by bearing on them.
- **427** (`authored-eccentric-shaft-radial-piston-engines.js`): playback starts at input angle
  0.86. The pistons then lie on Brown's upper-left/lower-right diagonal, with the lower one
  38° down. The cycle is still one whole turn, so the loop stays seamless. `sourcePose` keeps
  the official animation's input-0 pose.
- **457** (`well-bucket-working-parts.js`, 457 branch):
  - The pole is one straight, tapered hewn plank, with no S-bend.
  - Brown's forked post replaces the machined fork plates. It is a round tapered trunk whose
    two branch stubs straddle the pole, one behind and one in front.
  - A thin pin (r 0.07) passes through both stubs and the pole's bore.
- **466** (`authored-hydrostatic-presses.js`): adds Brown's pendant, a slender rod with a ball
  weight hung plumb from the lever's fulcrum pin, in front of the lever.
- **470** (`authored-steam-hammers.js`, `hammer-working-parts.js`, `cutaway-presentations.js`):
  the valve gear is rebuilt per the plate.
  - A top rocker sits on a lug under the crown. A short link runs from the rocker to the
    vertical slide-valve spindle, which rises out of a closed chest on the cylinder front.
  - The admission port of the barrel is turned to face the chest.
  - A long vertical valve rod hangs from the rocker to a hand lever pivoted low on the right
    leg. The lever ends in an upright ball handle.
  - The steam pipe enters the side of the chest.
  - The old horizontal side chest, its cutaway plane and the separate passage are gone.
  - The linkage closure (rod length, rocker arms, spindle link and vertical spool axis) is
    exact for every command.
- **483** (`authored-dry-gas-meters.js`): bellows A and A′ are now round leather bellows.
  - Each skin is a surface of revolution about the stroke axis, flattened front to back to the
    board depth, and drawn in by a middle hoop.
  - Each fold has constant leather length, so the waist is deep when a chamber is closed up
    and shallow when it is drawn out. This matches the plate: A′ is deeply waisted and A is
    open.
- **488** (`authored-screw-propellers.js`, `marine-rotor-working-parts.js`):
  - Blade planform: a narrow neck widens steadily to a broad, nearly square tip with eased
    corners, and the blade has a slight skew. Every point is still on the constant-lead
    helicoid.
  - The round nose is gone.
  - Added: a hub collar on the shaft side, then beyond the hub a stepped sleeve, a thinner
    shaft and a plain end nut. The shaft ends cleanly at the nut.
- **374** (`reciprocating-cord-working-parts.js`, 374 branch): the tapering treadle web now
  swells into a round boss (r 0.125) round the roller-axle bore. The bore no longer breaks
  through the web's lower edge, so the back-view notch is gone.
- **437** (`source-presentation.js`): the four thin escape-path tubes under the runner read as
  streamlines, so they are no longer presented. The volute water and the tailwater stay. The
  faint pale shapes still visible through the runner are its real escape openings over the
  tailwater.
- **463** (`authored-self-acting-weirs.js`, `chain-weir-working-parts.js` visibility is
  overridden):
  - The notch overflow is a falling sheet rebuilt every frame in reused buffers.
  - Its depth over the crest scales with the scheduled notch flow as q^(2/3), and it thins as
    it accelerates.
  - It throws farther with deeper flow and starts on the crest of the turning leaf.
  - As the flow stops it narrows to nothing. It no longer switches off at phase 0.28 while
    still full-size.
  - The sheet is notch-wide, so it no longer reads as a thick tube.

## Tests

Updated only where they pinned the old design:
- movement-416: roles, a range of about 86°, parents, and numeric tolerances scaled to the
  new geometry.
- spring-pivot-family 416 cases: the coiled planar spring and the new pin pairs.
- movement-470 and hammer-working-interfaces: the new linkage closure and pairs.
- movement-427: an added display-pose check.
- movement-437: the escape tubes are removed.
- movement-488: the helicoid check includes the skew.
- movement-463: sheet visibility follows the flow, plus a new width-continuity check.
- chain-weir-interfaces: surface points of deforming geometry are refreshed per sample.

## Residuals

- 416: the treadle's large rocking angle follows from Brown's drawn crank throw and fulcrum
  position. The coiled spring's shape change is prescribed.
- 408: the guide pegs remain, although the plate draws no pins on the instrument.
- 470: Brown's lower bracket pair and post under the handle are not modelled. The hand lever
  is read as pivoting on the leg with an upright handle. The cylinder remains slimmer than
  Brown's.
- 463: the head water still stands over the turned upper leaf at flood, which predates this
  lane.

## Intersections

These are fresh `show-body-intersections --spacing=0.01 --samples=129` runs, after this lane's
changes:

| Movement | Result |
| --- | --- |
| 416, 408, 427, 374, 488 | No pairs. |
| 457 | Only the intended bucket-in-well water. |
| 466 | Only pre-existing water and check-disk contact pairs. |
| 470 | Only the steam volume and the contact faces. |
| 437 | Clean apart from the open volute water tube. |
| 483 | The bellows skins now clear the flag rods. The remaining pre-existing valve-work and outlet pairs, up to 0.064, are outside this lane. |
| 463 | Only fluid pairs. The nappe-versus-leaf pairs are an inside-test artifact of the double-sided jet sheet: leaf points at z = -0.51 lie outside the sheet. The per-sample check in `chain-weir-interfaces` finds no penetration. |

Loop seams (`check-loop-seams`, IDs 416, 427, 457, 463, 466, 470, 483): no seam is above
tolerance.
- The 463 notch-sheet pop is gone. The remaining 2.6% bed-flow pop is pre-existing.
- 470 keeps its pre-existing 5% steam-chamber visibility pop.
