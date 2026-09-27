# Pass 69, gears lane: 391, 394, 397, 398, 414, 415

This pass responds to the user's review of these six movements. For each one, it records what changed, the evidence and the remaining residuals.

- Captures were made with `scripts/review-movement-source-views.mjs` and with rotated/phase views on a lane server. They are kept outside Git in `/dev/shm/p69-gears/{before,a}`.
- Intersections were checked with `scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.
  - "Before" means the committed HEAD tree, exported read-only.
  - "After" means the working tree.

## 391: alternating weighted racks

User feedback: the rack teeth floated in mid-air, and the guides were parallelograms rather than Brown's curved D shapes.

### Changes

- **Teeth on the racks.** Each rack bar now runs out to the teeth's root line: pitch line 0.26 from the pivot axis, less a dedendum of 0.071. Before, the teeth began 0.06 clear of a 0.26-wide bar. The teeth now use the rack's own material.
- **D-shaped guides b.** Each groove is still the exact locus of its rack pin. The locus itself is now a D:
  - a straight inner branch, where the rack is vertical and working;
  - a bowed outer return branch, where the idle rack's angle follows a sin² bulge with a peak of about 0.17 rad;
  - short corner swings at the ends. The top swing is 0.135 rad because the pivots are nearest the wheel there and the teeth need more lift to clear. The bottom swing is 0.07 rad.
- **Guide plate.**
  - The plate is the pin locus, filled and buffered by an even 0.24 margin.
  - The groove is sunk into the plate with a floor behind it, so the island inside the groove belongs to the same casting and does not float.
  - The groove floor is a shade darker so the groove reads.
  - The black lip ring was removed (it was a black rim).
  - The guide pin now ends inside the groove.
- **Stroke and output.**
  - The stroke is now 10 pitches instead of 8, so the D grooves are taller, closer to Brown's proportions, and the wheel makes exactly one turn per piston cycle.
  - The pin height and the positions of C and spring d were rescaled to match.
- **Source pose.** Playback time zero is Brown's pose (geometry.sourcePhase = 0.71): mid-descent, A vertical and working, A1 bowed out, C at rest.
- **Lever C.** C now pushes through the upper crossover and into the start of the descent before letting go. That is Brown's "carrying the pin over the upper angle". It releases at about 0.85 s into the descent.

### Intersections

- Before: only spring d's hooks on its studs, at 0.017.
- After: the same, and nothing else.

### Residual

- Brown draws the guides taller than any consistent stroke allows. With a 10-pitch stroke the grooves are about 80% of his height.
- Corner selection and the assist are prescribed, not solved from forces.

## 394: Parsons's endless rack (rebuilt)

The previous 14-tooth, handoff-flange design has been replaced. `authored-parsons-racks.js` was rewritten.

### Design

- **Pinion.** A 10-tooth involute pinion (as drawn), with a 25° pressure angle, stub addendum 0.6m and dedendum 0.8m.
- **Rack.** An endless rack with 14 pitches along each straight row and 14-tooth internal involute ends: 42 teeth in total.
  - The straight rows are the conjugate straight-flanked rack.
  - The semicircular ends are internal involute gear segments, cut with a space centred on each junction so the pitch runs on continuously.
- **Motion.** The pinion turns at constant speed on a fixed shaft. Seen from the rack, its centre traces a stadium, so every rack tooth meshes once per cycle:
  - along the upper row the rack runs left, which matches Brown's arrow;
  - around each end the pinion rolls like a planet in a fixed internal gear;
  - the rack rises and falls by 2e = 0.52 while the pinion goes round an end. The oscillating cylinder allows this.
- **Flanges.** Two concentric flanges behind the pinion (radii 1.0 and 0.85) run against two stepped rebates in the back of the rack. These are the "grooves on its side".
  - The top of the large flange is hidden inside the rack, which is Brown's dashed arc.
  - The rack interior stays open.
  - The rod has an end collar. The shaft ends as a stub behind.

### Mesh checks

The tooth difference is four (10 against 14). With full-depth 20° teeth that difference would foul. The stub 25° form was chosen by an exact polygon search.

- Pinion against band overlap is zero at 1200 poses around the path.
- Grown radially by 0.012, the pinion always touches, so it stays in working contact.
- Pinion tooth phase closes after 32 teeth per cycle (3.2 turns).

### Intersections

None, before or after.

### Residual

- The flanges bound the mesh depth only against over-engagement. Retention against the separating tooth force is not solved; the path is prescribed.
- Brown's rack teeth are drawn coarser than his pinion. Here one module serves both.

### Tests

`tests/movement-394.test.mjs` was rewritten. The 394 cases were dropped from the shared 371/394 reversing-transmission tests; the 371 cases are unchanged.

## 414: scroll gear and sliding pinion (rebuilt geometry)

### Scroll A

The scroll was measured on the plate at 60 px per unit:

- the band's turns touch: band width = lead = 25 px;
- 2 3/8 turns;
- the inner end is at 9 o'clock, with inner edge radius 48 px;
- the outer end is cut at half past four.

This replaces the looser 1.65-turn scroll with long teeth. The web is cut to the outline of the last turn, and the boss behind it is bored for the shaft.

### Pinion B

- The taper is reversed. The small end now faces A's centre and the large end lies outward, as the plate shows.
- B has 24 involute teeth (module 0.06, 20°), with a taper slope of 0.3.
- It meshes at full depth at its large end, 0.08 short of the band's outer edge, because the band curves away under B's ends.

### Face teeth

- There are 129 face teeth: straight-flanked prisms on straight sides.
- They are placed at B's circular pitch along the kinematic pitch spiral.

### Appearance

- The pale scroll was dark because of its old translucent/ink materials and teeth built from boxes.
- Everything is now a flat-shaded extrusion in the driven blue, and there is no longer a white shaft index.

### Checks

- Intersections before: shaft against pinion bore at 0.0001. After: none. `scan-bad-faces` is clean.
- The contact audit `docs/validation/219-224-414-contact.json` was regenerated with a scoped rerun for 414:
  - no penetration over 17 poses;
  - maximum working gap 0.0035.

### Residual

- A tapered pinion against flat face teeth is conjugate only at its large end; elsewhere the mesh relies on 0.04-pitch backlash.
- Motion, reversals and the feather slide are prescribed.
- `variable-face-gear-parts.js` and `generated-variable-face-gears.js` still hold the old 414 branch and baked heights. They are shared with 219 and 224, so they were not edited here. 414 no longer calls them.

## 415: Dickson's reversible drive

User feedback: crank E was perpendicular to the engraving.

### Changes

- **Crank E.** E is now Brown's small bent crank:
  - a journal standing on lever A's hub and running up the lever's centre line, in the plane of the wheel;
  - a short web;
  - a pin rising from the web's end, with both cords tied to the pin's top.
- **Selection.** E turns half a turn about its journal. With the pin to the right (Brown's pose), C's cord slackens and B is drawn off the rim; with the pin to the left, the reverse.
- **Source pose.** Playback time zero is Brown's pose (geometry.sourceTime = 1.5 s): lever A upright, mid-way through a C-selected stroke. Before, the lever was tilted 22° at time zero.
- **Cords.**
  - The cords now sag sideways in the wheel's plane even when they slope in depth.
  - The pawl cord eyes use the pawl material, not white.

### Intersections

- Before: 0.054 where the cords were tied into the crank pins, and 0.03 where the cords ran through E's arm.
- After:
  - 0.037 where the cords are tied into the pawl eyes (intended);
  - 0.019 where they are tied round E's pin (intended);
  - a 0.008 graze of the sagging cords on the pawl bodies at the far end of a stroke;
  - 0.005 where E's journal enters the hub (its bearing);
  - the existing lever/hinge coaxials.

### Residual

- Brown's pawls lie flatter than the model's.
- The wheel is a thick dark disc with a quadrant cue, which is an older styling choice.
- Selection is prescribed.

## 398: cam C to intermittent circular (groove re-derived)

### Derivation

The derivation is also written in the header of `authored-cam-rocking-drives.js`.

The roller's crosshead runs on the line through both shafts and drives the wheel's crank through a rod, which makes it an in-line slider-crank. Let:

- r be the crank radius and L the rod length;
- x_w be the wheel centre and x_c the cam centre;
- e be the fixed distance from the roller to the rod pin.

For crank angle φ, the roller's distance from the cam centre is

`d(φ) = x_w − x_c − e + r cos φ − sqrt(L² − r² sin² φ)`.

For the wheel to go right round, the roller must cover the full stroke 2r, from d(π) to d(0). The wheel angle is prescribed as a function of the cam angle ψ, with one wheel turn per side of the three-sided groove:

- u = 3ψ/2π
- φ = π + 2π [⌊u⌋ + g(u − ⌊u⌋)]
- g(f) = f − (a/2π) sin 2πf, with a = 0.8

This gives:

- φ' = 3(1 − a cos 2πf) > 0, so the wheel never stops or reverses;
- φ is C¹ across the sides;
- the wheel is slowest (0.2) with the crank toward the cam and fastest (1.8) with it away, a speed ratio of 9:1.

The groove centreline, in the cam frame, is the polar curve ρ(ψ) = d(φ(ψ)). The cam turns clockwise under the fixed roller line. The groove walls are this curve offset by the roller radius (0.16) plus 0.0006 clearance.

### Checks

- The centreline's smallest convex radius is 0.204, larger than the roller radius, and its smallest concave radius is 0.49. So neither wall folds.
- The maximum pressure angle is 57°.
- The stroke range is 0.749 to 1.549 cam-radius units, which is Brown's 0.39R to 0.77R, so crank radius r = 0.40.

### Result

The wheel turns fully round three times per cam turn, at 9:1 varying speed, and the loop is seamless. The groove keeps Brown's rounded three-sided look, and the lobes lie as on the plate at time zero.

### Discrepancy

The official 2D animation only rocks the wheel. This follows the user's reading of "intermittent circular".

### Intersections

None, before or after.

### Residual

- At the crank dead centres the rod alone cannot choose the direction; the prescribed law does this, with the groove positioning the roller in both directions.
- Pressure angles up to 57° would be heavy in service.
- Brown's crank arm is longer than r = 0.4.

## 397: shuttle crescent

User feedback: the groove had notches at either end that the engraving does not show.

### Changes

The old slot had a circular middle and radial end blends, which made hooks at both ends. It is now one plain circular arc with rounded ends:

- The slot's ends lie where the crank pin comes nearest to and farthest from the rocker pivot, so the pin's distance from the pivot selects a unique point on the slot.
- The arc's sagitta is 0.8 of the crank radius, slightly flatter than the crank circle. It therefore crosses the pin-radius circles at a finite angle at its ends.
  - With the exact crank circle (sagitta 1.0), the rocker would dwell exactly but knock at each end; the peak angular acceleration would be about 1460 rad/s².
  - At 0.8 the peak is 11 rad/s².
- Slot angle derivatives are now exact, from the implicit arc.
- The baked outline was regenerated with `node scripts/generate-open-crescent-shuttle.mjs`.

### Motion

- The rocker nearly rests (under 5% of crank speed, creeping at most 0.11 rad) for about 36% of the turn.
- The shuttle stroke is 4.3.

### Intersections

None, before or after.

### Residual

- It is a near-rest, not a true dwell.
- Brown's upper slot end stops short of the pin's farthest point. That is not kinematically closable, so the arc runs to it.

## Tests run

All of these pass (96/96 in the final combined run):

- 391: `tests/movement-391`, `alternating-drive-solids`, `weighted-rack-handoff-solids`, `weighted-rack-selector-contact`
- 394: `movement-394`, `reversing-transmission-working-solids`, `reversing-transmission-tooth-contact`
- 414: `movement-414`, `variable-face-gear-solids`, `display-tooth-passing`
- 415: `movement-415`, `one-way-clutch-working-solids`
- 360/361 check: `movement-360`, `movement-361`
- 398: `movement-398`
- 397: `movement-397`, `groove-drive-working-solids`

In addition, `scripts/check-loop-seams.mjs --ids=391,394,397,398,414,415` reports no seams.
