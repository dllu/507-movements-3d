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

## Rotated-view audit 128–254

- **136** (minor): Ground hatching is a flat sheet of stroke lines; rotated it reads as a comb/fringe hanging off the base
- **143** (minor): Undrawn yellow 'pulley-index' stripe on the back face of the left pulley
- **145** (minor): Hatched ground slabs render as white boards with black comb strokes, reading as floating barcode pieces when rotated
- **154** (minor): Ground hatching is a vertical sheet of stroke lines hanging under the base; reads as a comb/fringe when rotated
- **159** (minor): Slack cord bows sideways in a large S-curve mid-cycle rather than hanging or pulling taut
- **164** (minor): Ceiling/ground hatching are flat comb sheets that read as bristles when rotated or seen from above
- **167** (minor): Reversing groove reads as a thin knife-cut sliver tapering to nothing at its ends, where Brown draws a constant-width band the stud rides in
- **178** (minor): Back face of the disk shows streaky shadow-acne/z-fighting speckle
- **179** (minor): Ground hatching renders as a floating comb sheet under the lever foot
- **202** (minor): Worm thread run-outs stick out as sharp sickle-shaped flaps past both end faces (one hangs below the end disc)
- **249** (minor): Undrawn white orientation-index stripe on the upper tube ('white-rigid-orientation-index-on-upper-tube')
- **253** (minor): 'deployed-hook-angle-stop' studs float as loose blue dots beside each hook pivot, off hub B; Brown draws none

## Pass-54 verification audit (rotated views, after the pass-53 integration)

- **15** (minor): On both compound White's pulleys the whole groove and rim faces of every step are ink black (authored-white-pulleys.js:60). Each step reads as a coloured disc with a black outline rim.
- **24** (minor): A thin black ring is painted on the front face of both gears at 0.75 of the pitch radius (authored-gears-core.js spurGears RingGeometry). It is a decal outline that is missing from the back face.
- **30** (minor): A thin black contour line is painted on the front face of both square gears. It is an engraving outline decal with no counterpart on the back.
- **33** (minor): The same thin black painted contour line appears on the front faces of both elliptical gears, and only on the front.
- **35** (minor): The elliptical wheel has the same painted black contour line on its front face.
- **39** (minor): The grey upright arm ends at the top in Brown's curved break line, so it is a broken-off part. Also still open: from behind the disc reads as a solid plate with four floating slits.
- **45** (minor): The enlarged section is now two revolved wedge sectors, but they float beside the wheels with no shaft or support. In r60 they overlap the real wheels, and from top-back they read as a loose painted slab.
- **54** (minor): A is now one piece, but from rotated views it is a large H-shaped bracket with half-round cut-outs, exposed crab shells, pins and radial bars. It is far bulkier than Brown's small hatched block and reads as a construction jig.
- **63** (minor): The pawl is now whole. The small white hollow stop-pin tubes stand in space with nothing holding them, and the lower-left one floats alone below the pawl.
- **67** (minor): Tumbler E is translucent (opacity 0.72, gravity-tumbler.js:54), so the gear and worm ghost through it. This is a see-through stand-in for Brown's dotted hidden lines.
- **70** (minor): C's cover plate is translucent pink (opacity 0.72, open-rim-tappet.js:31), so the pins and tappet of A ghost through it. This is a hidden-line stand-in.
- **71** (minor): B's front plate is 38% opaque (authored-intermittent-core.js:2520). The code comment says it stands in for Brown's dashed hidden parts. C's studs and hub show through as a grey ghost disc.
- **95** (minor): The frame block carries a band of bold hatch strokes (wallHatch LineSegments) along two edges of its face. This is section-hatch notation painted on a solid.
- **100** (minor): The lever tail ends in Brown's oblique break cut, so the rod is broken off rather than modelled whole. It is also a flat bar where Brown draws a round rod.
- **106** (minor): The ceiling header is a thin sheet with bold black hatch strokes on its face. From behind or below it is a bare grey card. This is a flat hatch-stroke sheet standing in for the fixed support.
- **107** (minor): It has the same thin hatch-stroke header sheet as 106 on two posts, which reads as a card from the back.
- **118** (minor): The connecting rod's left end is modelled as Brown's jagged break-off notch, so it is a truncated part with no crank end.
- **134** (minor): Black radial marker ticks at each rim segment joint (8 black stripes on the orange rim face and edge); reads as marker stripes, not segment joints.
- **142** (minor): Default view crops the connecting rod, slider and grey guide rod at the frame bottom (maxNdc 1.78); rotated views show the grey guide-bar floating with free ends and no guides.
- **143** (minor): The shaft's key groove is a gold stripe running the length of the black worm shaft; reads as a marker stripe.
- **150** (minor): Both ends of the oversized black shaft carry flat hatch-stroke section faces (engraving section notation). The shaft sticks far out of the cam stack.
- **155** (minor): A thin dark ink circle is drawn on the ratchet wheel face inside the teeth.
- **159** (minor): The pulley's grey square bracket plate floats in mid-air with nothing supporting it; at some phases the slack cord snakes and curls near the lever ring.
- **160** (minor): The bow's fixed end is a small grey block floating in mid-air, and the pulley bracket stub is unsupported.
- **163** (minor): Both flat-belt runs stop square in mid-air to the right with no driving pulley (a truncated belt). The ledger still describes the belt as a round tube, but it now renders flat.
- **172** (minor): The grey fixed anchor at the right end is a floating solid stub whose outline copies Brown's jagged broken-off mark.
- **173** (minor): The grey fixed-frame blocks at the right are floating stubs with jagged break ends modelled in, with nothing attaching them.
- **180** (minor): The grey stile and the orange bolt end in modelled zigzag break edges at the bottom (Brown's broken-off notation turned into geometry).
- **181** (flawed): Engraving notation still modelled despite pass-53 claims: hatch-stroke section discs on every shaft end, a hatch-textured catch block on the bar, black outline rings round the rod eyes, and zigzag break ends on the orange bar. The wire rods end in mid-air.
- **182** (flawed): Same as 181: hatched shaft-end discs, a hatch-textured catch block, black-rimmed rod eyes, and zigzag broken ends on the orange bar.
- **183** (minor): The default view crops the orange bar and weight rods at the top and bottom frame edges (maxNdc 1.86).
- **184** (minor): The default view crops the orange piston bar and rods at the frame edges (maxNdc 1.87).
- **185** (minor): The toothed reversing quadrant (with white notch marks) floats in mid-air, detached from the wall, and the mechanism sits tiny in the default frame.
- **186** (minor): Hatch-stroke section disc on the shaft end. The default view crops the orange eccentric rod at the left edge (maxNdc 1.94).
- **187** (minor): Black ink strokes (Brown's fork-split lines) are painted on the orange rod's face, and there is a hatch-stroke section disc on the shaft; the mechanism is small in frame.
- **188** (minor): The default view crops the orange eccentric rod at the left edge (maxNdc 2.05).
- **189** (minor): Hatch-stroke section disc on the shaft end.
- **193** (minor): A black layer runs right round the wheel's outer edge (a black rim stripe from any side view), and the internal-gear teeth are black.
- **194** (minor): A black backing layer shows as a black stripe on the rim edge and an all-black back face.
- **197** (flawed): The moving 'square frame' is only a thin bar outline. Nothing joins it to the pin-rack capsule or the two C-shaped end guides, which float in front of its plane, so the rack and guides look disconnected from the frame.
- **198** (minor): The fixed plate is a thin grey wire outline rectangle (the engraving border) rather than a plate, and the guide rollers float around it.
- **213** (minor): A loose grey collar ring floats behind the blue wheel on its axis with no shaft through it.
- **238** (minor): The yellow stop tabs at B and C are small slabs perched on pins. C's tab stands in mid-air above the jaw tip, clear of both the star and the jaw.
- **244** (minor): Hatch-stroke section disc on shaft A's end, and stop blocks C/C' float as unsupported black blocks.
- **247** (minor): The sea bottom is a thin flat beige sheet that appears only in some phases, and it is cropped in the default view (maxNdc 1.84).
- **248** (minor): The cut faces of the nut and pipes carry hatch-stroke textures (engraving section notation) and the threads are black rings.
- **253** (minor): Disc A is a pale flat sheet with a dark grey torus rim round its edge (an outline-style rim).
- **270** (minor): The four hanging rope ends stop square in mid-air below the pulleys (cut-off rope ends, plate crop reproduced)
- **277** (flawed): Nothing holds the lock parts: the yellow mainspring ends in a grey root block floating in space, the tumbler pivot is an empty black hole with no pin, and the grey spring c floats beside the ratchet with no mount
- **278** (flawed): Lift rope a is split into two pieces: a short detached rope stub floats above the top end with a gap, offset sideways in the low view
- **309** (flawed): The blue suspension ring at the top floats detached in front of the arm pivots, touching nothing (clear gap in side view)
- **314** (minor): The two grey banking pins below the lever are loose short cylinders floating in space with no plate or post holding them
- **318** (minor): The SLOW/FAST regulator scale is built as an open lattice of thin bars (the engraved graduation strokes turned into a see-through wire grid) rather than a solid graduated arc plate
- **333** (flawed): Both fixed pivots stand on black comb-like hatch strips that reproduce the engraving's ground-hatching notation as geometry
- **334** (minor): Chain D is drawn as links only along the curved guide; below the bed it turns into a plain thin green rod, so the hanging chain is inconsistent
- **341** (minor): Z-fighting speckle (black crosshatch flicker) at the centre of the blue crank boss on the left pillow block, where the shaft end is coplanar with the crank face
- **348** (flawed): Inside the cross slots of disc A a ladder of thin orange rungs/stripes shows along the slot walls and floor (sliced-geometry artefact), visible whenever the disc is seen obliquely
- **352** (minor): The round-section arch at the top of the A-frame butts onto square-section legs with visible light gaps and mismatched cross-sections at both joints
- **353** (minor): At the blow the hammer head lands tilted, so its lower corner sinks into the anvil top plate instead of the face meeting it flat
- **356** (flawed): Sphere B carries painted white marker stripes (arcs) and a white dot, i.e. rotation-marker decoration the user rules out
- **358** (minor): The rope is split into two hair-thin cords (yellow above, blue below the cone) where Brown draws one thick laid rope crossing the cone; at this scale it reads as a line rather than rope
- **365** (minor): Both rollers and the upright carry dark streaky hatch-stroke texture that copies the engraving's shading lines onto the 3D surfaces
- **366** (flawed): The orange bevel wheel is modelled as a half-disc (the engraving's section cut) - from the side and back it is visibly a semicircle of teeth cut straight across the axle
- **370** (minor): The ratchet housing reads as a flat white panel with a dark border and a single blue tick line across it (drawn-sticker look, possible marker stripe) rather than a solid box around the ratchet
- **373** (flawed): The two blue belt strands leaving the small yellow pulley are straight strips that run out through the big wheel and stop in mid-air at the left (Brown's crop reproduced; the belt goes nowhere)
- **381** (minor): Brown's two drawing views (cross-section above, plan below) are built as two separate copies of the joint stacked one above the other, so rotating shows two unrelated floating assemblies
- **382** (minor): Mirror stands off the trunnion hub on a black strut Brown does not draw (reads as a stray black bar across the glass from the front); at mid-tilt the frame's lower edge comes close to or touches the base clamp screw.
- **386** (minor): Stiles are hollow open-ended C-section tubes: from above, each pole shows an open bore like a pipe where Brown draws solid timber poles.
- **391** (minor): Spring d is a 1-pixel line primitive (zigzag), not a solid spring. Its anchor block and lever C's pivot float with no support.
- **400** (minor): Coil spring and its black end stop float in space off the end of the frame, with no housing or anchor (Brown draws the spring inside A). The coils are uneven.
- **407** (minor): White slide-position index block, and a white line primitive along the bow's working edge (notation).
- **408** (minor): An orange marker stripe runs the full length of the blade's drawing edge.
- **411** (minor): White 'ground-travel-index' dash marks along the ground strip (dashed notation). The push-handle bar floats clear of the arch in the default view.
- **414** (minor): White rotation-index chip at the outer end of the scroll. A thin gold stripe runs down the pinion shaft, and odd black three-arm stubs sit on the hub.
- **419** (minor): White radial index stripe on the back face of wheel B.
- **427** (minor): Brown's dotted guide circle is modelled as a thin black wire ring floating in front of the drum, attached to nothing.
- **441** (flawed): Water is a flat sheet of dashed blue hatch strokes that floats as a plane in rotated views. The lowest buckets hang in the strokes rather than in water.
- **442** (flawed): Water is a sheet of thin blue hatch lines under the wheel.
- **443** (flawed): Water is drawn as a field of wavy blue hatch strokes (flat sheet).
- **447** (flawed): River banks are flat sheets of blue hatch lines. Brown's direction arrow is modelled as a floating black arrow object. The anchor cable is a plain smooth tube where the plate draws rope.
- **451** (minor): Tiny stray triangular sliver at the inner bend of the air-vessel feed pipe. Rows of tracer dots along the pipes read as dotted lines.
- **455** (minor): Flow arrows (hairline shaft plus black arrowhead) are drawn inside the inlet and outlet ducts. Where the outlet duct meets the casing, a gap shows the background.
- **456** (minor): Flow arrow in the inlet duct, and an arrowhead cone hanging under the outlet spout. A ghosted translucent pink bar crosses the drum (hidden-part notation).
- **458** (flawed): Well ropes are plain smooth blue tubes where the plate draws twisted rope (not the laid-rope standard).
- **459** (flawed): Rope rendering is inconsistent: the top span is laid rope but the vertical drops to the buckets are plain smooth tubes.
- **461** (flawed): Water is a flat sheet of dashed hatch strokes. Thin blue stroke lines are painted inside the troughs.
- **463** (flawed): Water on both sides of the gate is a stack of flat blue hatch-line sheets. The escaping water is a hose-like tube.
- **464** (flawed): Water in the passages is a pattern of flat blue horizontal hatch strokes painted on the frame faces. The spray is dotted strokes.
- **465** (minor): Water under the pump barrels is a sheet of thin blue hatch strokes.
- **467** (flawed): Section cut faces are flat diagonal hatch-stroke textures (a hatched section sheet) instead of solid material.
- **469** (minor): White flow-tracer dots show on the outside of the opaque tank walls where the pipe runs inside them. The dots also read as rivets or markers along the pipe.
- **472** (minor): A translucent passage tube inside the right-hand S-standard pokes out near its foot and leaves a visible break across the casting.
- **475** (minor): Steam paths are drawn as thin blue streamline tubes with bead markers inside the glass body (flow notation).
- **476** (flawed): The Y-branch casing is a flat translucent extruded slab rather than round pipes, and reads as loose sheets from above or the side. Flow is shown as streamline tubes. Pipe A shows striped artefacts where it crosses the translucent wall.
- **479** (minor): Thick black torus seam and rim rings on the bell and tank read as decorative black outline rims (the bands-as-tubes item is already on the ledger).
- **480** (minor): Thick black torus seam and rim rings on the bell and tank read as decorative black outline rims.
- **486** (minor): Brown's wind arrow is modelled as a floating light-blue arrow object. The plate's circle is a thin floating wire ring.
- **490** (minor): Seen from above, the rope spans between sheaves and tiller follow slack S-curves instead of taut straight lines. The rope to the lower sheave rides over the barrel flange.
- **493** (minor): The stone block is an extrusion of Brown's irregular break-line outline, so it reads as a broken-off section rather than a whole block.
- **494** (minor): White rhombus-pivot index dots on the links.
- **498** (minor): Scale ticks and numerals float in the air beside the tube with no board, and read mirrored from behind.
- **500** (flawed): Brown's second (section) figure is built from flat hatch-stroke outline sheets, which are paper-thin when seen from above.
- **501** (minor): The scale comb floats unsupported beside the tube.
- **502** (minor): White index stripes on the gear faces.
- **503** (minor): White index stripes on the bevel gears.
- **504** (minor): White index stripes on the output gears and the carrier.
- **505** (minor): White index stripes on the sun gear and arm.
- **506** (minor): White index stripes on the gears.
