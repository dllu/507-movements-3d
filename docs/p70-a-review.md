# Pass 70, lane p70-a: water and gas shapes (444, 448, 449, 451, 453, 469, 483)

Each ID's pass-69 visible flaw was checked against `public/engravings/mm_NNN.png` and fixed. Function is kept
throughout: seals and valves, open passages, conserved water and the valve timing.

Captures are in `/dev/shm/p70-a/` (not in Git):

- `before/` and `after/`: `ID-default.png` (render beside the plate) and `ID-oblique.png`, from
  `review-movement-source-views.mjs`.
- `final/ID-tile.png`: the default view at phases 0, 0.25, 0.5 and 0.75 (top row), then views at +60°, −60°, top and
  back (bottom row).
- Zooms:
  - `v483z/`: 483 linkage at six phases.
  - `v451z/`: 451 dip tube.
  - `v449/`: 449 lower flap.
  - `v453z/` and `v453c/`: 453 chest and flaps.
  - `v444z/`: 444 body and neck.
  - `v469z/` and `v469g/`: 469 bottle and gears.

The loop-seam check (`check-loop-seams --ids=… --all`) is clean for all seven IDs. No production MuJoCo is used; all
seven are authored analytic playback.

## 483 Dry gas meter

**How it works.**
- Slide valve B admits the inlet gas from the chest to one bellows through its branch.
- At the same time, B's cavity connects the other bellows to the central exhaust port.
- The crosshead and over-centre spring snap the rocker at each dead centre, and the rocker shifts B.

**What was wrong.**
- The common outlet ran forward from the central port, through a slot in the gallery floor, and out of the open
  case front to a flange facing the viewer.
- The crosshead bar slid through that pipe (0.064).
- The valve linkage stood in one plane:
  - the rocker arm lay over the valve stem (0.060);
  - the rocker pin passed through the stem (0.059) and the lower guide (0.048);
  - the stem tie crossed the arm (0.054);
  - the spring ran through the stem (0.058).

**What changed** (`authored-dry-gas-meters.js`, 483 block of `gas-meter-working-parts.js`):
- **Outlet.** The plate draws a tall column standing on the board at the left and rising through the top. This is
  now the common outlet.
  - The seat block under B is now Brown's thick board. It stands on the gallery floor, carries the chest walls and
    runs left under the column.
  - Its lower layer is cored with the exhaust passage from the central port to the column's foot.
  - The column (bore 0.14) rises through a matching roof hole.
  - The front flange, the forward pipe and the floor slot are gone.
- **Linkage.** The linkage now stands in three planes:
  - the stem and its guides at z 0.20;
  - the lost-motion slot plate at z 0.33, on a short tie;
  - the rocker arm at z 0.45.
  The pin reaches back from the arm into the slot, and the lid slot is widened to pass them.
- **Spring and crosshead.** The spring now hooks on a stud standing on the crosshead's top face and on the pin's front
  end. The crosshead rides lower in its floor slot, and the flag rods stop below the seat board.

**Intersections** (screen at spacing 0.02; 0.01 runs out of memory):
- Before: 0.064 (crosshead/outlet), plus 0.060, 0.059, 0.058, 0.054, 0.048, 0.037, 0.030 and 0.029 in the linkage and
  the outlet.
- After: no solid overlap. The only remaining rows are:
  - the spring's two hook ends on its pin and stud (deforming, 0.031 and 0.023);
  - zero-depth valve-on-seat contacts.

**Tests.** `gas-meter-working-solids` now checks the outlet column, the board, the crosshead and flag rods, the rocker
arm and pin against the stem, the tie, the guides and the chest. The column's position is asserted.

**Ledger (proposed).**
- Assessment: reasonable.
- visibleFlaws: none.
- limits:
  - Skin deformation is prescribed.
  - The dial-work is not drawn, since Brown omits it.
  - The spring hooks overlap their pin and stud by up to 0.03 (attachment).

## 451 Force pump with air chamber

**How it works.** The force pump sends a pulse into the globe on each downstroke and compresses its air. Between
pulses, the expanding air drives water out steadily. Brown's caption says the outlet is shown at two places, "from
either of which water may be taken".

**What was wrong.** A yellow cap closed the central dip tube, which Brown leaves open.

**What changed** (`authored-force-pumps.js` and the air branch of `force-pump-working-parts.js`):
- The cap is removed.
- The open dip tube is sectioned (it was added to the 451 cutaway entry). It holds a standing water column from its
  foot in the chamber water up to the side mouth's level (2.75).
- **The outlet's role:** the same air pressure lifts both takeoffs to one level.
  - While the side riser delivers, the dip tube stands full to that level, 1.35 below its open top, and does not
    overflow.
  - It would deliver if the side riser were closed or raised.
  - It also shows the air pressure: the chamber level stays 0.3 to 0.75 below the column.
- The metering texts now say this instead of "capped".

**Checks.**
- A new test pins these:
  - the column top equals the side mouth;
  - the open top stays dry;
  - the foot stays submerged, and the chamber level stays below the column top through the cycle.
- Intersections: see the table at the end.

**Ledger (proposed).**
- Assessment: reasonable.
- visibleFlaws: none.
- limits:
  - The air cushion is prescribed, and the air is not drawn.
  - The dip-tube column stands at the side mouth's level; flow losses are ignored.

## 449 Modern lifting pump

**What was wrong.** The lower check was a disk lifting straight up. Brown draws a flap hinged at one edge, with its
free end tilted up to the right.

**What changed.**
- **The flap** (`modernLiftingPump` in `authored-lift-pumps.js`, and `lift-pump-working-parts.js`):
  - The lower check is now a flap (r 0.40, lapping the 0.32 bore by 0.08). It turns up to 30° on a pivot at its left
    edge, with the same C2 upstroke lobe as before (`footFlapAngle`).
  - It carries a bored lug like the delivery flap. The lug turns on a pin carried by two journals, which stand on the
    seat ring at z ±0.31, where the round flap has already turned away.
  - The hinge (x −0.40) sits inside the suction pipe's rim, so its boss clears the pipe top. A first version at −0.47
    touched the pipe top (0.022); that was found by the screen and fixed.
- **The seat:**
  - A shallow recess (0.03 deep) in the ring's top clears the lug boss.
  - The ring stays whole beneath the recess and round the bore, so nothing bypasses the closed flap.
  - The flap closes flat on the ring.

**Checks.**
- The rendered-solids test now includes the flap, lug, pin and journals against the seat, barrel and each other.
- A new assertion checks the flap's flat seating and its lap.
- The `movement-449` tests now check the flap's rotation.
- `v449/` shows it opening on the upstroke and seated on the downstroke.

**Ledger (proposed).**
- Assessment: reasonable.
- visibleFlaws: none.
- limits: primed incompressible volume model; check lifts and flap angles prescribed.

## 448 Common lift pump

**What was wrong.** Brown draws a wider pump head (cistern) above the barrel, carrying the spout and the lever
bracket. It was drawn as the plain barrel.

**What changed** (448 branch of `lift-pump-working-parts.js`; spout curve in `authored-lift-pumps.js`):
- **Head:**
  - The barrel rises to a shoulder at 1.97, just above the bucket's highest top (1.87).
  - The head above it is 1.43 times the bore (inner r 1.00), and runs up to an open top with a flange at 2.75.
  - The spout now leaves the head wall through its port, which spans y 1.97 to 2.43.
  - The pieces overlap slightly instead of sharing faces, so the section stays consistently wound. The face scan
    first flagged a port that ran below the head.
  - The lever bracket rises from the head flange to the pivot.
- **Water:**
  - The water above the bucket now stops at the shoulder.
  - A head water body fills the head to the spout level.
  - The volume balance is unchanged: the head water is constant, and the bucket-side water still follows
    dV = −A·dy.

**Residual.** The head is shorter than Brown's (0.78 against about 29 per cent of the pump's height), because the lever
pivot sits at 3.18. Brown's walls are thicker.

**Ledger (proposed).**
- Assessment: reasonable.
- visibleFlaws: none.
- limits:
  - Primed incompressible volume model; check lifts prescribed.
  - The head water stands at a fixed level.
  - The spout stream thins and fades with the flow.

## 453 Double lantern-bellows pump

**How it works.** The beam distends one bellows while it compresses the other.
- **Expanding bellows:** it draws water up the suction pipe, round the semicircular channel and through its suction
  flap on the chest floor.
- **Compressing bellows:** it drives its chamber's water through its discharge flap into the central chamber, and up
  the riser.

**What was wrong.**
- The chest was a thin box threaded by six small 3D tubes and four poppet checks in cylindrical pots.
- There was no semicircular channel.
- An undrawn standard rose from behind the chest, and Brown's hanging beam post was missing.

**What changed** (the plumbing section of `authored-lantern-bellows-pumps.js` is rebuilt to Brown's section; the
lantern branch of `flexible-pump-working-parts.js` no longer patches the old tubes):
- **Chest:**
  - A flat rectangular chest, 5.7 × 1.14 × 1.72.
  - The bellows stand directly on its top plate, over openings.
  - Two ported partitions enclose a central discharge chamber under a flared riser.
- **Channel:**
  - A circular-arc suction channel under the chest, centred 0.47 above the floor bottom as the plate shows. Its water
    runs between r 1.06 and 1.49.
  - Its inner dome is closed and hollow, as Brown draws it, and a boss at its foot takes the suction pipe.
- **Flaps:** four hinged flaps, each a plate extruded through the depth with a bored boss on a fixed pin and journals.
  - The suction flaps lie on the floor over the channel mouths, hinged at their outer ends (as the plate's left flap).
    They lap the mouths by 0.05.
  - The discharge flaps hang on the partitions' inner faces, hinged at the top. They lap the ports by 0.05.
  - They swing through the same disjoint C2 lobes (35° maximum).
- **Riser.**
  - It flares into the chest top, rises and leans right as Brown draws it.
  - Above Brown's break it turns back through a bore in the post and rises behind it. It no longer runs straight
    into the beam.
- **Post:** Brown's wide post hangs from above the plate (it is broken off there) and carries the beam fulcrum. The
  undrawn standard is gone.
- **Water:**
  - One body fills the suction pipe, channel and mouths.
  - One fills the three chest chambers, the ports and the bellows openings.
  - One fills the riser.
  - All are primed and incompressible.
- **Cutaway entry:** the section is on the mid-plane, with the chest, channel, pipes and flaps cut.

**Checks.**
- New test: each closed flap rests on its seat and laps its mouth or port, and the flaps open into the right chambers.
- The rendered-solids test now covers the chest, channel, pins and journals.
- The `movement-453` tests now check the flap rotations.
- Intersections (spacing 0.01, 129 samples):
  - no solid overlap in the new plumbing;
  - flap-on-partition contacts are 0.0000;
  - the only solid rows are the bellows skin clamped on the chest top and under the top plates (0.0525 and 0.0528,
    unchanged from pass 49).
- Faces: two faults were found and fixed:
  - the chest's back-wall winding (a negative box height);
  - the riser lathe's inward profile.

  The scan is clean apart from same-look coincident faces.

**Residual.**
- The flaps have no drawn knobs.
- The riser's run behind the post is a reconstruction beyond Brown's break.
- Framing:
  - the suction pipe now reaches y −2.95 and the post y 4.6;
  - the stored display profile predates this;
  - maxNdc is 0.987 in the review.

**Ledger (proposed).**
- Assessment: reasonable.
- visibleFlaws: none.
- limits:
  - Bellows water and flap timing are prescribed.
  - The riser's continuation behind the post, beyond Brown's break, is reconstructed.
  - The bellows skins are clamped 0.05 into the chest top and the top plates.

## 444 Montgolfier's hydraulic ram

**What was wrong.**
- **Pipe:** a sagging hose hung from a plain box.
- **Body:** the ram body was a closed dark box.
- **Trough:** the trough was three loose boxes.
- **Tank:** the tank's tail water was a box through the sectioned neck (a double tint), and ran in front of the section
  plane with no front wall to hold it.

**What changed** (the pass-69 block of `authored-hydraulic-rams.js`):
- **Head box and drive pipe:**
  - The head box's bottom runs down in a filleted shoulder into the drive pipe.
  - The pipe falls straight, turns on one round elbow (r 0.45) and runs level into the body, as Brown draws it.
  - The drive stream follows the same path from the head water.
- **Body:**
  - The neck stands on a flange.
  - The waste seat sits in a raised collar on the body top.
  - The body, the drive pipe, the shoulder and the riser are now cut on the drawing plane like the globe. The current
    inside them shows, and a water body fills the ram body.
  - The streams in the pipes are clipped to the same plane.
- **Section:**
  - The tank walls and floor, and the head box's walls and bottom, are cut on the plane too.
  - The head water is clipped to it.
- **Tail water:** it is cut on the plane, and stops at the ram body and the neck. The neck now shows only its own
  water.
- **Trough:** one U-section channel whose sides are cut back obliquely at the mouth.

**Intersections.** Only the seated waste disk on its seat remains (0.0000).

**Residual.**
- The tank has no drawn outflow. Brown's right wall stops above the floor, and a channel runs out of the plate there.
  A channel ending inside the frame would look cropped, so this is left as a limit.

**Ledger (proposed).**
- Assessment: reasonable.
- visibleFlaws: none.
- limits:
  - Valve timing, hammer pressure and air compression are prescribed (mass-balanced).
  - The tank's outflow channel is not drawn.

## 469 French temperature-difference air machine

**What was wrong.**
- The air vessel was a box.
- The mitre bevels (pitch r 0.32) were far smaller than Brown's head gears (about 0.5) and his wheel gear.
- The air tube (r 0.10) was much thinner than his broad duct.

**What changed.**
- **Vessel** (`authored-temperature-air-machines.js`): the vessel is now Brown's bottle, a flat-sided flask.
  - Its straight sides rise to rounded quarter-ellipse shoulders that close in on a neck.
  - The neck's top plate is bored for the duct.
  - The screw casing still enters its right side through the fitted hole.
- **Duct:** it is broad now (r 0.19, wall 0.035), on larger fillets. The camera fit's top is raised to 2.42.
- **Gears:**
  - `makeTemperatureBevel` in `temperature-bevel-pair.js` takes a scale about the apex; the bore stays on the shaft.
  - The head pair is 1.5× (pitch r 0.48). The hub pair is 1.3× (0.42), which is as large as the paddles in front of
    the wheel allow.
  - Both pairs stay 1:1 mitres, so wheel and screw still turn together.
- **Tests:** the flank-backlash bound scales with the gears. The head bevel now clears the barrel mouth by 0.045
  (previously bounded at 0.1).

**Intersections** (spacing 0.01, 129 samples). There are no solid rows; only water immersion and the bubbles among the
paddles remain (fluid).

**Residual.**
- Brown's hub gear is a face gear on the wheel's side. It is still drawn as a mitre bevel of that size.
- The bottle's right side is closed round the casing, where Brown leaves the lower right open.

**Ledger (proposed).**
- Assessment: minor.
- visibleFlaws: Brown's face gear on the wheel is drawn as a mitre bevel.
- limits:
  - The rising bubbles pass through the paddle blades and do not collect under them.
  - The screw's air transport and the thermal run-down are prescribed.
  - The cistern walls stand 0.2 above the water.

## Intersections after the changes

| ID | spacing | solid rows |
|---|---|---|
| 444 | 0.01 | seated waste disk only (0.0000) |
| 448 | 0.01 | seated foot disk only (0.0000) |
| 449 | 0.01 | seated lower flap and delivery flap only (0.0000) |
| 451 | 0.01 | seated suction and delivery checks only (0.0000) |
| 453 | 0.01 | bellows skin clamp 0.0525 / 0.0528 (unchanged since pass 49); flap contacts 0.0000 |
| 469 | 0.01 | none |
| 483 | 0.02 | none (spring hooks 0.031 / 0.023 deforming) |

## Streams

- 444 and 448 already use `water-stream.js`.
- 451's side riser discharges with no drawn spill. The next pass could add one with `water-stream.js`.
