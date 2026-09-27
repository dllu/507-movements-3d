# Pass 69, lane p69-w4: air, gas and mercury devices (469, 471, 472, 473, 479, 480, 481, 482, 483, 498)

This is a close functional review of each device. For every one I checked how it works: the chambers, valves, seals, liquid levels, open passages and the fluid visuals. I fixed what I found and recorded the residuals below.

Captures are kept outside Git in `/dev/shm/p69-w4/`:
- `before/`: default and oblique views at phases 0, .25, .5 and .75 (`tNNN.png` tiles).
- `after/`: the same views after the fixes.
- `review/`: the `review-movement-source-views` output, render beside plate.
- `a469/`, `a473/` and `a482/`: rotated views (left, right, top, back).

The loop seam check (`check-loop-seams --all`) is clean for all ten IDs after the changes. It flagged one bubble pop in 469 before the change, and that pop is now removed.

## 469 French temperature-difference air machine

**How it works.** The screw in the cold cistern is turned against its water-raising direction, so it carries air down into a vessel at its foot. That air rises through the tube, crosses high above both cisterns and descends into the warm cistern. It then bubbles up under the wheel, and the rising bubbles turn it. A gear train ties the wheel to the screw.

**What was wrong.**
- The inclined screw's barrel and flight passed straight through both cistern walls. The flight cut the warm cistern's wall by 0.069, and a "gland" had been cut through the cold cistern's wall. In the default view the barrel visibly ran through the partitions.
- The air tube was a sagging Catmull-Rom hose, not Brown's rigid tube.
- The receiver was a cap that floated mid-water with no support.
- The drive was an undrawn 18:54 spur gear behind the wheel.
- The cisterns were about 0.67 of Brown's depth.

**What changed** (`authored-temperature-air-machines.js`, `temperature-bevel-pair.js`, and `correctTemperatureAirMachine` in `thermal-steam-working-parts.js`):
- **Cisterns:** now Brown's depth (bottom at -2.10) and 2.10 deep.
- **Screw:** rises at Brown's 47.6 degrees and ends above the cold cistern, clear of both walls.
- **Head gear train:** a shared-apex mitre pair at the screw head turns an inclined shaft S. S is perpendicular to the screw and in the plate's plane, and it crosses above the warm cistern's wall to the wheel hub. A second mitre pair there turns the wheel, which is Brown's arrangement. The wheel and screw turn 1:1, and I reduced the screw to 4 turns.
- **Mitre phasing:** a new helper, `mitreBevelPhases`, sets the phase of any mitre pair. Shaft S has a fixed mount so its rotor angle starts at zero.
- **Wheel:** sits behind S on a stub axle carried by the warm cistern's back wall.
- **Air vessel:** a box vessel stands on the cold cistern floor. The screw casing enters its right wall through a fitted hole, and the tube rises from a bored roof.
- **Air tube:** now a rigid tube of straight runs and circular fillets. It runs up, across, down the warm cistern and under the wheel, ending in an upturned mouth under the wheel's right side.
- **Bubbles:** they rise on the right, which matches the wheel's counterclockwise turning. They fade with the screw's speed instead of popping in at a threshold.
- **Framing:** the camera fit bounds now cover the deeper cisterns, so the framing has changed.

Evidence and tests:
- Finite-difference pitch-point velocities agree on both mitre pairs.
- The tooth-body sweeps are rewritten for both pairs and pass.
- `tests/movement-469.test.mjs`, `temperature-air-469-bevel.test.mjs` and `thermal-steam-469-474-solids.test.mjs` are rewritten for the new train and pass (12 + 4 + 5 tests).

**Intersections.**
- Before, the screen showed a 0.0687 solid clash (`higher-temperature-right-cistern-end-wall-left x right-handed-air-conveying-screw-flight`). The screen labelled it "fluid" only because the part's role contains "air". The barrel also ran through the gland wall.
- After, only water-body immersion and bubbles passing the paddle blades remain (0.06, fluid).

**Ledger (proposed).**
- Assessment: reasonable.
- visibleFlaws:
  - The air vessel is a box, not Brown's round-shouldered bottle.
  - The mitre bevels are smaller than Brown's large head and hub gears; Brown's hub gear is a face gear on the wheel.
  - The air tube is thinner than Brown's broad duct.
- limits:
  - The rising bubbles pass through the paddle blades and do not collect under them.
  - The screw-driven air transport and the thermal run-down are prescribed. Buoyant torque, heat transfer and the startup are not solved.
  - The cistern walls stand 0.2 above the water line, where Brown draws them brimful.

## 471 Hotchkiss's atmospheric hammer

**How it works.** A crank reciprocates the cylinder B. The air trapped below and above the free piston lifts the hammer C, stores energy, and then drives the blow once the crank passes bottom centre. Port e vents each side.

**Checked.**
- Over 400 phases, the lower chamber is at least 0.45 high and the upper at least 0.87, so the piston never leaves the bore.
- The hammer face reaches the anvil exactly (face -1.2700 against anvil -1.27) at the impact phase.
- The polytropic laws hold.
- Vessels are opaque exteriors, as Brown draws them.

**No change.**

**Intersections.** The screen after is unchanged from the ledger. Its only rows are the hidden air-charge volumes (fluid) and a zero-depth contact between the shaft and rod D.

**Ledger.**
- Assessment: reasonable.
- visibleFlaws: none.
- limits: The air-cushion pressures follow prescribed polytropic laws; the hammer motion is prescribed, not integrated.

## 472 Grimshaw's compressed air hammer

**How it works.** Pump D, cranked from shaft E, delivers into reservoir C, which is formed inside the hollow frame. From C the air reaches the slide-valve chest on top of cylinder B, and the valve admits it alternately above and below piston A.

**What was wrong.**
- Reservoir C was a groove cut into the front face of the S-arm, open to the air, so it leaked.
- It stopped blind above the arm's foot.
- Nothing connected it to pump D. The pump sat on a solid foot, and the modelled delivery pipe was never added to the scene.

**What changed** (`buildBroadHollowFrame`):
- C is now a closed passage inside the casting (z ±0.18).
- It opens through the top of the arm's tab into the valve chest that stands on it.
- It runs down the S-arm, through its foot and along the hollow bed, and rises into the bed top under pump D.
- Pump D's foot is now bored (`bored-foot-of-pump-D-delivering-into-bed-of-C`).
- The sealed air body is hidden.
- `tests/movement-472.test.mjs` and `hammer-working-interfaces.test.mjs` pass.

**Visible effect.** The front groove along the S-arm is gone, so Brown's inner line on the arm is no longer drawn.

**Intersections.** After the change, the screen reports no solid or fluid rows. It now marks the merged frame as "open" (coincident internal faces between its plates), so it cannot probe inside the frame. The ledger's before value was a clear 0.0000.

**Ledger.**
- Assessment: reasonable.
- visibleFlaws: none.
- limits:
  - Reservoir C is a closed passage inside the frame and is not seen.
  - Pump D's check valves are not drawn (Brown does not draw them); the bored foot stands for its delivery port.
  - The pressures are prescribed.

## 473 Water-sealed air pump

**How it works.**
- The inverted bell hangs from the crossed levers in a tub of water.
- When the bell descends, it expels air through the upward valve on its roof.
- When it rises, the rarefaction draws gas up the shaft pipe through the lower upward valve.
- The bell's rim must stay submerged.

**Checked.** The seal margins are at least 0.54 outside and 0.59 inside over the cycle. The pipe top (0.52) stands above the water (0.28) and below the roof.

**What was wrong.**
- Both vessels were plain cylinders, where Brown draws coopered barrels.
- The outer tub tapered the wrong way: it was wider at its foot.
- The tub had only two hoops against Brown's five.
- A black bottom disc stuck out 0.06 beyond the tub as a dark rim.

**What changed** (`water-sealed-pump-parts.js` and the 473 entry in `cutaway-presentations.js`):
- The bell is now a barrel that bellies out at mid-height and draws in to its roof and rim. The roof is set inside the top of the staves.
- The tub is wider at its mouth than at its foot, with a slight belly and five hoops. The bell keeps three hoops, all following the staves.
- The tub bottom is flush and in the tub's own material.
- The water annuli were re-sized to the barrel profiles so that no water enters a wall. They are the bore, the under-rim ring and the outer ring.
- `tests/water-sealed-pump-solids.test.mjs` and `movement-473.test.mjs` pass (14 tests).
- The outer water ring starts outside the bell's hoops.

**Intersections.** The screen ran out of memory at a spacing of 0.01 and 0.02, so it was run at 0.03 with 65 samples.
- The deforming rows are the ropes' own attachments (levers, lugs and grips, up to 0.054). They are the same kind as the ledger's before value of 0.0436.
- The fluid rows are the check-valve gas plumes.
- The single real overlap it found was the bell's lowest hoop reaching 0.02 into the outer water. That is now fixed.

**Ledger.**
- Assessment: reasonable.
- visibleFlaws: none.
- limits:
  - Vessels are whole opaque exteriors, as Brown draws them.
  - The staves are not grooved.
  - The gas law uses the mean bell bore, and the barrel belly changes the area at the water line by under 3%.
  - The external water level is prescribed.

## 479 Gasometer

**How it works.** Gas enters bell A through one of the two pipes that rise through tank B's floor to above the water, and it leaves through the other. Bell A rises as gas enters. Its rim stays sealed in the water. The weights C, C set the gas pressure, which holds the inner water level below the outer one.

**Checked.** The seal depth is at least 4.8 cm at the top of the stroke. The level difference is exactly the pressure head.

**What was wrong.**
- The inner water was a full cylinder, so it filled both pipe bores.
- It and the outer annulus left dry gaps round the skirt and under its rim, so the water was not one connected body.
- The pipes ended as straight stubs below the floor, where Brown turns them outward along the bottom.

**What changed** (`gasometer-working-parts.js`, and a `waterSealUpdate` hook in `authored-gasometers.js`):
- **Inner water:** at the depressed level right up to the bell's inner face, excluding the pipes.
- **Outer water:** from the bell's outer face to the tank wall.
- **Under-rim ring:** a moving ring under the rim joins the inner and outer water.
- **Pipes:** each is one bent pipe with a circular 90-degree bend, running outward under the tank.
- `tests/movement-479.test.mjs` and `gasometer-working-interfaces.test.mjs` pass.

**Intersections.** After the change, the solid rows are only the rope ends in their lugs and sockets (0.0899 and 0.02), the same as the ledger's before value of 0.0897. Water against water and pipes is 0.

**Ledger.**
- Assessment: reasonable.
- visibleFlaws: none.
- limits:
  - The tank stands free; Brown's ground is not modelled.
  - The fill cycle is prescribed and the pressure is quasi-static.

## 480 Gasometer with centre guide

**How it works.** This is the same seal as 479. Bell A is guided by its integral sleeve a on the fixed tube b. The gap between a and b is open to the air at the top, so the water in it stands at the outer level. The sleeve's foot stays submerged, which seals the gas.

**Checked.**
- The rim seal is at least 8.8 cm.
- The sleeve foot is always below the inner level: at most -0.44 against -0.24.

**What was wrong.**
- The inner water filled the pipe bores and left dry gaps: round the sleeve, under the sleeve's foot and under the rim.
- There was no water in the a/b gap.

**What changed** (the same water rebuild as 479):
- A column of water in the a/b gap now stands at atmospheric level.
- A moving annulus under the sleeve joins it to the inner water.
- An under-rim ring joins the inner and outer water.
- `tests/movement-480.test.mjs` passes.
- The first screen caught sleeve a's rim bead 0.042 into the new water. The water now stays clear of the bead.

**Intersections.** After the rerun, only water-to-water contacts at depth 0 remain.

**Ledger.**
- Assessment: reasonable.
- visibleFlaws: none.
- limits:
  - Pipe b and the two gas pipes run straight on through the floor and end cleanly.
  - The fill cycle is prescribed and the pressure is quasi-static.

## 481 Wet gas meter

**How it works.**
- Gas comes in through the turned-up pipe a above the water at the centre.
- It fills whichever chamber's hooked inner mouth is uncovered and turns the drum counterclockwise.
- Each chamber discharges through its outlet in the front drum head as that outlet rises out of the water.
- The rear head is whole.

**Checked.**
- The water level (0.22) is above the centre, as the caption says.
- The inlet (0.285) is above the water.
- The front head carries the peripheral outlets, and it is cut away in the section.
- A single water level is physically right, because the chamber pressures differ by only millimetres of water.

**No change.**

**Intersections.** The screen after shows nothing beyond fluid immersion of the partitions.

**Ledger.**
- Assessment: reasonable.
- visibleFlaws: none.
- limits:
  - Water shows in the cut window; rotated views show little water.
  - The chamber filling and drum torque are prescribed.
  - The outlets are on the front head, which the section removes.

## 482 Powers's gas regulator

**How it works.**
- Gas rises through E, passes valve D's notches over the quicksilver, and fills the space under cup H.
- It enters the open-topped outlet chamber and leaves by F.
- As pressure rises, H lifts and lever d lowers D, which throttles the inlet.

**What was wrong.** The outlet was blocked.
- The delivery pipe ended butted against the chamber's solid left wall.
- Brown's oval F in the back wall opened onto a dark blind disc.
- So the regulated gas had no way out.

**What changed** (`authored-mercury-gas-regulators.js`):
- F is now the mouth of the delivery pipe. The pipe leaves the back wall and turns left behind the chamber through a circular quarter bend.
- It runs under the outer channel's floor and in front of the case back, and leaves through a hole in the case wall.
- The chamber's back wall moved forward to -0.55 to make room, and F is 0.12 × 0.19.
- `tests/movement-482.test.mjs` and `mercury-instrument-working-solids.test.mjs` pass (16 tests).
- The quicksilver head for gas-main pressures is under 2 mm, so the single mercury levels are consistent.
- The face scan found a coplanar overlap between the outlet chamber's back wall and its side walls, which have different materials. The side walls now start behind the back wall.

**Intersections.** The screen after shows no solid rows.

**Ledger.**
- Assessment: reasonable.
- visibleFlaws: none.
- limits:
  - One clean cutaway on the camera plane with plain cut faces.
  - The separate view of valve D is not modelled.
  - The quicksilver levels are static, because the head is under 2 mm at these pressures.

## 483 Dry gas meter

**How it works.** Slide valve B admits gas alternately to the two bellows chambers A and A′ through the branch pipes and exhausts the other. The chambers' plates drive the valve.

**Checked.**
- The branches enter the fixed end plates.
- The skins close to their plates in every phase.
- The valve covers the ports.

**Found, not fixed (residual).** The screen ran at a spacing of 0.02, because 0.01 ran out of memory.
- The common outlet from B runs forward out of the open case front to a flange facing the viewer. Brown draws no such pipe.
- The sliding crosshead bar passes through that outlet pipe (0.064 solid). It is visible in the default view as the bar sliding through the dark ring at the centre.
- Stem, rocker, tie and guide overlaps of 0.05 to 0.06 remain in the valve linkage.
- The proper fix is to reroute the outlet backward below the gallery floor, which needs new floor and valve-chest openings. I left it for a dedicated pass.

**Ledger.**
- Assessment: minor.
- visibleFlaws:
  - The common outlet pipe stands out of the open case front, and the crosshead bar slides through it (0.064).
- limits:
  - Stem, rocker, tie and guide overlaps of up to 0.06 remain in the valve linkage.
  - The skin deformation is prescribed.
  - The dial-work is not drawn, since Brown's figure omits it.

## 498 Siphon pressure gauge

**How it works.** The pressure drives the mercury down in the connected leg and up in the open leg. The two legs move by equal amounts because the bores are equal.

**Checked.**
- The fall in one leg equals the rise in the other at every phase, so the mercury volume is conserved.
- Both legs read 0 at zero gauge pressure.

**What was wrong.** The mercury was a dark grey metal that read as paint, not mercury.

**Intersections.** The screen after shows no solid rows. The mercury and steam cores are open meshes.

**What changed.** It now uses the shared silver mercury material, a shade deeper so that it reads behind the glass. `tests/movement-498.test.mjs` passes.

**Ledger.**
- Assessment: reasonable.
- visibleFlaws: none.
- limits:
  - The scale strip and the 0 tag are minimal carriers for Brown's marks.
  - The boiler beyond the crop is not modelled.
  - The meniscus is flat.

## Water-stream helper

None of these IDs has a falling or free stream, so none needs `water-stream.js`.
