# Pass 53: user review findings (2026-09-24)

The user reviewed movements by rotating and zooming the 3D views and set these rules for every movement:

1. **No engraving notation in renders.** The engraving dashes a part only to show that it is occluded. The 3D model shows the part itself, so dashed or dotted hidden-line outlines must not be drawn.
2. **No truncated parts.** Where the engraving breaks a part off or crops it (a squiggle or broken end), that is a drawing convention. Show the whole part, since the viewer can rotate and zoom.
3. **No decorative black rims** on part edges (e.g. 261, 272, 276).
4. **Consistent styling.** Parts drawn alike render alike. For example, 270 renders its ropes as braided rope while 001 renders a thin belt, although both engravings draw similar ropes.
5. **Construction artefacts are flaws** even when the default view looks fine.

Specific findings:
- **63:** the pawl is cut off in a weird way when the view is rotated, caused by the undrawn zone and dashed-leg treatment. The pawl outline has several steps, where the drawing and the Gallagher reconstruction are simple.
- **76:** the outer wheel is a truncated arc; it should be the whole wheel. Part B's tip is oddly shaped compared with the engraving.
- **305:** differs cosmetically from the plate a great deal. The pendulum hole was cut round and then refilled with two jagged, protruding pieces.
- **277:** the whole linkage to the right of the orange hammer is missing. Spring C swells in width as it deflects.
- **261, 272, 276:** black rims around some edges.
- **001:** a thin belt where the plate draws a rope like 270's.

Fix lanes: p53-no-hidden-lines, p53-parts, p53-no-crop and p53-style. A rotated-view audit of all 507 movements goes to /dev/shm/audit53.

## Rotated-view audit 382–507

- **382** (minor): Blocky stair-stepped dark shadow patch on the lower mirror glass under the hinge link (shadow aliasing reads as a jagged cut-out).
- **391** (minor): Elbow lever C and spring d never move and never reach the right rack's pin in any phase; nothing carries the pin over the guide's upper angle, as the caption requires. Brown's short link from C down toward A' is also missing.
- **395** (minor): The casing ports/pipes Brown draws running out past both circles are missing. The plug passages are thin relief strips on the front face only, so the back of each plug is a blank disc.
- **414** (flawed): The spiral rack A has no disc or web behind it. The hub's short black stubs don't reach the spiral, so the spiral floats unattached around the hub. Brown draws the spiral teeth cut on a wheel face.
- **421** (minor): The cylinder housing is only two flat side walls, open front and back. The piston's round blue flange sticks out through the open sides.
- **423** (minor): The casing is a thin round-tube wireframe. The quadrant cylinder arcs end in mid-air and never close the sector cylinders, while Brown draws a thick sectioned casting. Pistons B are needle-thin wedges.
- **425** (minor): The two port necks are small open half-pipe scraps perched on a bare ring casing. Brown draws a pear-shaped double-walled casing whose ports rise into the top.
- **434** (minor): A stray L-shaped bracket hangs under the base plate and ends in mid-air.
- **435** (minor): Same stray L-shaped bracket as 434 under the base plate, ending in mid-air.
- **436** (minor): Water is drawn as stiff light-blue sticks poking up above and down below the wheel. They read as stray rods.
- **438** (minor): A small pale sliver floats beside the tube just below the collar, attached to nothing.
- **443** (minor): The upper bearing/crank is a wavy grey wire that ends in mid-air. The float wheel is a flat cog-like disc with tiny paddles, unlike Brown's large bucket-paddle wheel.
- **451** (minor): The air vessel is a faceted octagonal 'gem' instead of Brown's rounded dome, and the left inlet is a J-hook rather than his S-bend.
- **463** (minor): The water hatch-line planes cut straight through the gate leaves in oblique views, and a stray yellow disc lies on the bed.
- **465** (minor): Brown's operator standing on the rocking beam, and the hand-bar he holds, are missing.
- **466** (minor): The pump cistern hangs in mid-air about a sixth of the frame height above the floor the press stands on (Brown puts both on the same ground). A stray orange tab sticks out of the cistern's left wall.
- **470** (minor): The valve chest hangs off the right leg. A black vertical rod stub stands above it and ends in mid-air, and the steam pipe exits right, whereas Brown's enters from the left and his valve rod runs down the right leg.
- **475** (minor): The chamber D bulb is visibly low-poly: a faceted polygon outline instead of a smooth pear shape.
- **479** (minor): The guide posts pass through the tank's black rim flange, and at mid-stroke the counterweight balls pass through that flange.
- **482** (minor): The centre guide boss on top of the dome is a long fin running the full depth of the casing, not Brown's small central knob.
- **485** (minor): The tail vane is an empty wire loop with no sheet.
- **493** (minor): The lewis mortise is cut as a slot running the full depth of the stone, open at the front and back faces, rather than a dovetailed pocket.
- **494** (flawed): The stone hangs fixed in mid-air (no ground) while the nippers open and close. At phase 0 and ~0.75 the tips stand clear of the stone's sides, so nothing holds it; the tongs never visibly bite.

## Rotated-view audit 1–127

- **27** (minor): The radial grooves cut right through the rim, so the wheel is six loose sectors. Square notches show around the rim from the side and back. Brown's rim is a continuous circle.
- **39** (minor): The large wheel is a solid disc with four short slits that look like floating holes. Brown draws an annular band broken into arcs by radial gaps, with a channel around the gear.
- **45** (minor): Brown's hatched cross-section is modelled as a free-standing painted slab beside the wheels. From rotated views it reads as a board floating in space with nothing connecting it to the wheels.
- **47** (minor): The clutch halves are flat extrusions of Brown's half-section, not revolved bodies. Seen from the side they shrink to a thin hatched slab with a round shaft through it.
- **54** (flawed): The gold part A is a collection of disconnected curved fragments, a thin wire rectangle and a stub. They stick out past the rim and pass into it. Brown draws a single solid block.
- **55** (flawed): From behind, the page-coloured web of C hides gears A and B completely, so the whole mechanism looks like a thin gold arc and a hub. Coverage from the back is 0.02 against 0.30 from the front.
- **81** (flawed): The rack-rod rises completely out of its lower guide for part of the cycle, leaving the grey guide block floating alone below the rod end.
- **93** (minor): The stem's small round eye goes around the crank shaft only at one instant. For the rest of the stroke the solid upper stem slides across the crank hub. Brown's lower stem has an elongated slot around the shaft.
- **108** (minor): The grooved drum is an open hollow tube with no end cap or hub. From above you can see inside, and the shaft stands in empty space. The groove lands stick out as thin fins in the side view.
- **119** (minor): The slotted vertical guide bar is drawn only as hairline outlines with no body, so from oblique views it reads as floating wire lines. Brown draws a solid bar in front of the rack.

## Rotated-view audit 255–381

- **277** (flawed): Brown's pinned link at the hammer's lower right (pin plus link running off to the right) and the small lower hole are missing; from the side (c) the hammer is a flat slab with only the pawl and spring by the drum, so nothing drives or connects it.
- **299** (minor): The rear crown-wheel teeth render washed-out, near-white (unlit or inside-out faces) beside the blue front teeth.
- **305** (flawed): The round pendulum hole is partly refilled by two angular blue filler blocks jutting into the opening. Brown draws a quadrant pallet piece; the back view shows the fillers as dark slabs.
- **310** (minor): Brown closes the two spring loops at a bottom collar/screw on the arbor. The model leaves the loops open, ending in two dangling pins with no bottom fitting, and faint white slivers float beside the pallet ends.
- **314** (minor): The escape wheel is a solid disc with sparse thin spikes, where Brown draws deep hooked ratchet teeth on a broad rim.
- **321** (minor): From the side and top, springs S/S' and their pivot pins hang in free space well in front of the ratchet and wheel faces, like stray wires with floating stubs.
- **334** (minor): The chain hangs straight beside curved arc D instead of wrapping it. At mid-cycle the gun depresses so far that the breech, sector C and brace drop well below the bed.
- **358** (minor): The lower band strand runs to a tiny grey stub with a yellow dot floating in mid-air below the fusee, and the upper strand runs off out of frame.
- **360** (minor): The right sector's cord stands off the sector rim in depth, arcing free beside the arc instead of lying on it.
- **368** (flawed): The follower block and tracer pin float about 0.7 rack-widths below the rack's lower end with nothing joining them; they move together but are disconnected.
- **375** (minor): Two pinion teeth render white (undrawn marker stripes).
