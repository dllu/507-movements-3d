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

## Pass-55 verification audit (rotated views, after pass 54)

- **47** (flawed): Clutch cones/boss are modelled as half-section solids (engraving's cut section): from the side they are flat-faced half discs, parts not whole
- **123** (flawed): Centre gear lies in the rack's plane: a column of dark dashes (z-fighting/interpenetration of gear teeth through the rack) runs down the rack face
- **126** (flawed): All three rope runs end in mid-air at the old crop line (both pulley falls and the horizontal rope at the lower crank arm) with no attachment
- **72** (minor): Work piece on the anvil is built from stacked slabs whose left end steps out in jagged layers (construction artefact)
- **78** (minor): Lever B's free end is cut in a swallowtail break-notch (engraving break notation) instead of a whole finished end
- **14** (minor): Hauling (fall) end of the tackle rope stops in mid-air at the old crop line with no hand, cleat or drum
- **15** (minor): Hauling (fall) end of the tackle rope stops in mid-air at the old crop line with no hand, cleat or drum
- **16** (minor): Hauling (fall) end of the tackle rope stops in mid-air at the old crop line with no hand, cleat or drum
- **17** (minor): Hauling (fall) end of the tackle rope stops in mid-air at the old crop line with no hand, cleat or drum
- **18** (minor): Hauling (fall) end of the tackle rope stops in mid-air at the old crop line with no hand, cleat or drum
- **19** (minor): Hauling (fall) end of the tackle rope stops in mid-air at the old crop line with no hand, cleat or drum
- **20** (minor): Hauling (fall) end of the tackle rope stops in mid-air at the old crop line with no hand, cleat or drum
- **21** (minor): Hauling (fall) end of the tackle rope stops in mid-air at the old crop line with no hand, cleat or drum
- **22** (minor): Hauling (fall) end of the tackle rope stops in mid-air at the old crop line with no hand, cleat or drum
- **86** (minor): Pump rope and rod run down below the frame and stop at a small crosshead in mid-air (old crop line); nothing below
- **92** (minor): Crosshead guide bars end abruptly in open space at the right (engraving's break line) and are not supported by anything
- **134** (minor): both ends of the rope stop in mid-air at Brown's crop line, attached to nothing
- **142** (minor): default view crops the valve rod and guide posts at the bottom frame edge; rod runs far past Brown's short tapered end down to an added tall two-post guide stand
- **144** (minor): the fixed post ends in mid-air with no base or ground under it (Brown stands it on a ground line)
- **150** (minor): valve rod ends in a small blue block floating in mid-air with no guide or valve
- **152** (minor): the traced ellipse is a thin black wire loop floating in space with no paper or board under it (reads as a contour line); cross-piece also has no support
- **154** (minor): top pulley spins on a bare stub axle with no bracket or post (floats above the frame)
- **156** (flawed): valve rod ends in a modelled break-line notch in mid-air with no guide or valve
- **165** (minor): the upright output bar hangs from the link with a free lower end and no guide; the lever pivot stands on nothing
- **166** (flawed): connecting rod ends in a modelled break-line (notched zigzag cut) in mid-air, no slide or mould it drives
- **167** (minor): the reciprocating rod has no guides and the drum axle no bearings; both float free
- **168** (minor): blue driving lever is cut off square in mid-air at Brown's crop line (no pivot or driver); crank shafts have no bearings
- **169** (minor): blue driving lever is cut off square in mid-air at Brown's crop line (no pivot or driver); crank shafts have no bearings
- **171** (minor): the curved slide's guide rods and the trunnion stub float free (rod ends in mid-air top and bottom, trunnion unattached to anything); valve-rod guide block hangs in air
- **172** (minor): the grey slotted guide frame floats with no support and the crank shafts have no bearings
- **173** (minor): a black radial index stripe is painted on the face of the gold star wheel (marker)
- **178** (minor): connecting rod stops square in mid-air at Brown's crop line (no tool slide) and the fixed slotted disk floats with no support
- **180** (minor): screw shanks poke out as black pins behind the side-piece
- **181** (minor): default view crops the piston rod and valve rods at the top/bottom frame edges; zoomed out the handle shafts have no frame or bearings and the valve rods end in bare weights in mid-air
- **182** (minor): default view crops the piston rod and valve rods at the top/bottom frame edges; handle shafts have no frame or bearings
- **183** (minor): (existing crop) plus handle shafts float with no frame and valve rods end in mid-air when zoomed out
- **184** (minor): (existing crop) plus handle shafts float with no frame and valve rods end in mid-air when zoomed out
- **186** (minor): default view crops the eccentric rod at the left frame edge; the free end of the spring-handle loop cuts through its own descending band
- **197** (minor): a thin bar pokes out through both short ends of the frame into empty space, and the guide arcs are thin free-standing blades with no connection to the plate
- **210** (minor): the two guide blocks for the vertical bar float in mid-air with no frame, and the arm's shaft has no bearing
- **219** (minor): the long pinion is built as an open spoked wire cage of thin rods (reads as a wireframe), where Brown draws a solid long fluted pinion; the pinion shaft floats with no bearing
- **225** (minor): on the return stroke the pawl lifts well clear above the wheel (floats about a tooth-height off) instead of dragging over the teeth; the arm pivot sits on a small black stub with no ground block Brown draws
- **227** (minor): both chain legs stop at Brown's crop line and hang loose in mid-air with nothing attached
- **228** (minor): both chain legs stop at Brown's crop line and hang loose in mid-air with nothing attached; the pulley has no support for its stub shaft
- **229** (minor): (existing) chain legs end square in mid-air at Brown's crop line
- **236** (minor): pawl b and c tips end in short black cross-pins that jut sideways into the air beyond the pawl (not in plate)
- **238** (minor): pallets B and C are separate rectangular blocks perched on the frame tips (C sits on a thin tapering nib and reads as a stray stub), where Brown draws C as the hooked end of the arm
- **240** (minor): spring drawn as a thin round grey wire (plate: flat leaf spring)
- **241** (minor): the single driving tooth is a thin curved sliver much slighter than Brown's broad tapered tooth; the yellow click pivots on a bare stub with no support
- **244** (minor): C/C' stop blocks mounted on a free-floating vertical post (no support top or bottom); the scale-pan ring hangs with a gap below the beam end instead of hooked through it
- **247** (flawed): during reload phase an undrawn external sling appears: thin gold wire rising to a mid-air anchor far above the tube, with its legs stabbing into the ball; rope drawn as thin rod not laid rope
- **251** (minor): the guide-frame posts stop square in mid-air at Brown's lower crop line with no base; after release the weight only drops a short way before the loop resets
- **252** (minor): the guide bars of slot C end square in mid-air at the right crop line and D's stem ends in mid-air below
- **253** (minor): the hoist rope strands still stop in mid-air at the crop line below the frame disc
- **260** (minor): Thin white radial marker stripes painted on the faces of both large gears D and E (marker notation).
- **261** (minor): Cord D does not wrap pulley B's rim as drawn: it runs down behind B onto a small hub drum on B's back face, so from the front it appears to vanish into B's face.
- **266** (minor): Screw threads are thin loose ribbon helices round a thin core that read as coil springs, ending in abrupt cut stubs; both uprights are two stacked blocks with a visible misaligned seam at mid-height.
- **269** (flawed): Stroke overruns the yoke: at phase .25 the pinion sits outside the open end with no rack engaged, and at phase .75 it passes through the closed-end crossbar by about half its radius.
- **275** (minor): Both helix ends run out as knife-thin tapered blades that stick out past the drum like stray slivers.
- **280** (minor): Hand lever is built from two straight box segments that meet at the bend with an open, unblended mitre seam (visible notch/gap).
- **284** (minor): Two thin black rods run above the rack with a visible gap and no attachment, floating like drawn outline lines rather than a real guide.
- **285** (flawed): The spindle sleeve inside the housing is a translucent pale-blue tube with the screw visible through it (translucency standing in for a hidden part).
- **286** (minor): A thin yellow strip rides along the lever's upper edge and a thin black strip lines the jaw's underside; neither is a drawn part and they read as marker/outline lines.
- **299** (minor): Sloped tooth faces show fine streaky striping (shadow acne) that reads like hatch strokes.
- **305** (flawed): Window is still two mismatched quadrant cut-outs of different radius, offset and meeting at a stepped notch, not Brown's semicircle-plus-sector opening; only a plain orange disc shows through it, with no escape-wheel teeth or pallet as drawn; a stray red speck sits at the arbor, and a tiny white/orange sliver pokes up through the slot in the top view.
- **307** (minor): Default camera crops the pendulum rod at the top edge (Brown's break line), and zoomed out the whole rod hangs from an empty pivot hole with no suspension pin, so it floats.
- **313** (minor): The detent spring is a wavy S-bent yellow strip that wraps a knot-like loop round the locking stone, unlike Brown's straight detent; a stray yellow dot sits beside the banking pin.
- **316** (minor): The jar is filled with translucent blue water-like liquid, but Brown's bob is a jar of mercury, which should read as an opaque silvery metal.
- **318** (minor): The balance spring is a set of separate closed concentric rings rather than one continuous spiral from stud R to the staff, and the SLOW/FAST sector is covered in a black line grid (tick/hatch notation).
- **323** (minor): The wheel slots through the ruler show a flat bright-white floor, as if patched with a white plate, instead of reading as open slots onto the paper.
- **326** (minor): Camera fit excludes the flywheel, so it is clipped by the canvas edge in every view (default, rotated, back and top), reading as a broken-off wheel.
- **327** (flawed): At bottom of stroke the crosshead rollers run off the lower ends of guide bars A (they sit beside/below the slots rather than on the bars) and the crosshead lands on the cylinder cover; the flywheel is also clipped by the canvas in every view.
- **328** (minor): The flywheel-shaft pinion looks to sit clear of the right-hand wheel C, with a gap between tooth tips instead of meshing depth; the contact is hidden behind the beam, so worth checking.
- **333** (minor): The orange piston-rod stub hanging from the left beam end stops in mid-air at Brown's crop line, with no piston, guide or cylinder.
- **335** (minor): Everything floats: the beam fulcrum and the radius rod's fixed pivot at the far left are bare pins with no bracket, and the yellow piston rod stops in mid-air at the crop line.
- **336** (minor): The grey slanted frame member at upper left ends in mid-air at Brown's break line, with no attachment beyond it.
- **337** (minor): The beam runs off the canvas in most views; the radius rod's fixed pivot is a bare floating pin, and the yellow piston rod stops in mid-air at the crop line.
- **338** (minor): The radius rod's fixed pivot is a bare floating pin, the beam runs off the canvas, and the yellow piston rod stops in mid-air at the crop line.
- **340** (minor): The joggling pillar's centre F is a bare pin with no bearing or foundation, and both hanging rods from D and C stop in mid-air at the crop line.
- **344** (minor): Z-fighting: the crank-pin end is coplanar with the back face of the crank and shows as a speckled black patch.
- **348** (minor): The cross slots in disc A show a flat bright-white floor on both faces instead of open slots or plain slot bottoms, like a white filler plate; bar B also runs off the canvas at the top.
- **352** (minor): All the cords (the V to the weight hook, the falls to the drums and the wraps on the drums) are smooth thin blue tubes, where the plate draws laid rope.
- **358** (minor): The long diagonal rope is a hairline strand that runs far past the canvas top (still unending at 3x zoom-out) with no visible upper attachment; it crosses in front of the cone without engaging it, while its lower end is tied to a bracket far below the frame.
- **373** (minor): The drive belt is two thin round blue tubes where the plate draws a flat belt; it runs off to a small floating pulley (already noted in the ledger).
- **376** (minor): The whole treadwheel hangs on a short bare axle stub with no bearing, post or frame, so it floats unsupported from every angle.
- **378** (minor): The saw blade drops into the log with no kerf, so the teeth and lower frame bar pass straight through the solid log at mid-stroke.
- **382** (minor): Front of the mirror frame carries a single J-shaped raised step instead of Brown's rounded inner rim and separate D-shaped panel; short neck from hinge to back plate.
- **383** (minor): Rollers and brush cylinder hang from one side frame only; their far shaft ends stick out into air with no bearing.
- **389** (minor): Base is an open-fronted channel (half-section) and the pawl pivot and eccentric shaft float beside the rack with no bracket to the stand.
- **392** (minor): The strained spring ends in a black block floating in mid-air with nothing to anchor to.
- **395** (flawed): Casing seen from behind or above is translucent, with the red/blue passages ghosting through; thick black casing band reads as an outline rim.
- **396** (minor): Balance rim has no arms to its staff, so the ring floats unconnected to the arbor.
- **397** (minor): Bottom lever pivot and crank shaft float with no ground or bearing (Brown draws a grounded boss); the shuttle bar has no guide.
- **402** (minor): Balance wheels are rendered as translucent discs inside the rims.
- **403** (minor): Thin vertical line from apex to chord and a thin chord line read as construction marks not in the plate.
- **404** (minor): At full stroke the bow bends into a near-semicircle, far beyond the plate's shallow arc, and its ends slip past the roller posts.
- **407** (flawed): Cord is a thin plain tube, not laid rope, and it lengthens about 2x as the slide moves (inextensible loop); straightened lath overlaps the upright post.
- **409** (minor): Black graduation ticks are painted on the blue leg.
- **411** (minor): Recording drum is covered with a black drawn grid not in the plate.
- **414** (minor): Outer end of the scroll overhangs past the edge of the backing disc at some rotation phases.
- **416** (minor): Spring is a flat spiral, not Brown's helical spring, and its free wire stretches across the wheel face to reach the crank pin as the crank turns.
- **418** (minor): Valve chest is a half cut-away shell, and the valve seat is a black slab floating below the chest with no connection.
- **419** (minor): Axles of wheels A and B end in air behind the discs; nothing on the rocking frame carries them.
- **420** (minor): Bell hangs from a short black stub with no support; bell-pull rope ends in mid-air below the base.
- **421** (minor): Cylinder and trunk are cut open on the front (section) rather than whole; the crankshaft has no bearing.
- **422** (flawed): Black comb/hatch strip on the side of the valve chest; cylinder is an open sector frame with no front or back faces.
- **425** (minor): Casing and steam passages are open rings with no front or back walls, so they read as a cut section from an oblique view.
- **426** (minor): Steam ports are pairs of flat slabs (a pipe cut in section) stuck to the ring.
- **429** (flawed): Casing is two disconnected C-shaped halves with an open slot between them, and the ports are pairs of flat plates; black tick marks on the lobe tips.
- **431** (minor): Wheel axle has no bearings or frame, so the wheel hangs in air over the water.
- **432** (minor): Wheel axle has no bearings, so the wheel hangs unsupported.
- **433** (flawed): Jet is drawn as a bundle of thin streamline tubes plus droplet spheres (banned flow notation); the nozzle floats unsupported.
- **435** (minor): Pale translucent disc with a white rim fills the runner centre (not in plate).
- **436** (flawed): Turbine case is a translucent shell used to show the runner inside.
- **438** (minor): Discharge jets are thin solid-looking tubes rather than water.
- **439** (minor): Bucket has no bail; the rope ends at the rim.
- **441** (minor): Wheel has no axle support and floats over the water; the rim is a thin black ring that reads as an outline.
- **443** (flawed): Screw casing is translucent to show the helix (Brown's dotted hidden line); black rings at the tube ends.
- **444** (minor): Fountain spray is a bundle of thin streamline tubes; tanks are open on the front.
- **446** (minor): Dark lens-shaped blob caps the jet inside the upper channel.
- **447** (minor): Anchor lies on the water surface, not the river bed; the boat is a flat lozenge.
- **448** (flawed): Pump barrel and spout are translucent to show the piston and valves.
- **449** (flawed): Pump barrel and valve chest are translucent to show the internals.
- **450** (flawed): Pump barrel and pipes are translucent to show the internals.
- **451** (flawed): Barrel and air vessel are translucent; a stray translucent square block sits inside the pipe.
- **453** (flawed): Valve chest and pipes are translucent grey to show the valves.
- **454** (flawed): Pump casing and pipes are translucent to show the diaphragm and valves.
- **455** (minor): Inlet and outlet pipes are open three-sided troughs (half-pipe sections).
- **456** (minor): Inlet pipe F is an open half-channel section.
- **457** (flawed): Well shaft is a translucent cylinder to show the bucket inside.
- **458** (flawed): Well walls are translucent panels to show the buckets.
- **459** (minor): Well shaft is a pale translucent panel.
- **461** (minor): Spout spray is thin streamline strands; the trough side walls read as black outline rims in the default view.
- **462** (flawed): Rising pipe is translucent to show the chain discs.
- **463** (flawed): Overflow is a thin curved tube; when the gate tilts open, the headwater block keeps a vertical face standing with nothing holding it.
- **464** (minor): Fountain spray is a bundle of thin tubes; the body is a cut-open section.
- **465** (flawed): Pump barrels are translucent glass cylinders showing the pistons.
- **466** (minor): Press cylinder is translucent below the ram; the pump tank is cut open on the front.
- **467** (minor): Jack body is a half-section cut-away rather than whole.
- **468** (minor): Timber ends carry painted X-in-box marks (Brown's section notation).
- **469** (flawed): Screw casing is translucent to show the helix; the tanks are open on the front.
- **470** (flawed): Cylinder and valve chest are translucent to show the piston; black flange rims.
- **471** (flawed): Moving cylinder is translucent to show the piston.
- **472** (flawed): Both cylinders are translucent to show the pistons.
- **473** (flawed): Outer tub is translucent to show the inner tub; the hoops are thin black rings; the ropes are very thin lines.
- **475** (flawed): Ejector chamber is translucent to show the steam pipe; a pale water disc hovers above the discharge mouth.
- **476** (minor): A pale translucent water disc hovers above the discharge pipe mouth.
- **477** (minor): Expansion tube changes colour red to yellow as a symbolic temperature indicator; the casing is a quarter cut-away.
- **478** (flawed): Sphere and pipes are translucent; the expansion pipe changes colour blue to red as a heat indicator.
- **479** (flawed): Tank and bell are translucent (already in the ledger, still present).
- **480** (flawed): Tank and bell are translucent to show the internal tubes.
- **481** (flawed): Front of the case is translucent glass showing the drum; the grey torus rim stands detached from the case face.
- **482** (minor): Inner float vessel panels are translucent; the casing is open on the front.
- **483** (minor): Valve chest B is a translucent box; the casing is open-fronted.
- **485** (minor): Black band at the cap base and black sail edging read as dark contour rims.
- **490** (minor): Steering ropes are thin plain lines, not laid rope; pulley bracket bars end in mid-air (rope still rides the flange, per ledger).
- **491** (minor): Hauling rope runs off and ends in mid-air at the old crop line.
- **492** (minor): Both upper and lower ropes end in mid-air at the old crop line.
- **493** (minor): Dashed stipple marks run along the edges of the lewis hole (z-fighting or shadow artefact).
- **497** (flawed): Fan casing is translucent to show the blades; black bars at the outlet mouth.
- **498** (minor): Brass marker rings on the tube; the scale board floats beside the tube with no attachment.
- **499** (minor): Dial face is translucent and there is no case back, so the mechanism shows through from behind.
- **500** (flawed): Brown's section figure is modelled as a literal half-cut body beside the gauge; the dial is translucent and the bezel ring stands off from it.
- **501** (minor): Brass index ring on the tube; the scale card floats beside the tube.

## Pass-56 verification audit (rotated views, after pass 55)

- **26** (minor): Crown wheel's teeth are separate near-black pieces ringed around a plain blue disk, reading as a black toothed rim rather than one wheel as Brown draws it
- **32** (minor): Both friction wheels wear thick near-black tyres that read as dark outline rims around the faces (Brown's text faces only one wheel)
- **48** (minor): Clutch shifter: the vertical operating rod stops in mid-air at the old crop line, and the bell-crank fulcrum pin floats with no bracket
- **52** (minor): Clutch lever's fulcrum pin floats with no bracket; the handle tapers to a sharp spike where Brown's lever runs on to a rod off the plate
- **53** (minor): Clutch shifter: the hanging operating rod ends flat in mid-air at the old crop line; the bell-crank fulcrum pin has no support
- **86** (minor): The pump barrel added below the bed hangs free in space; only the moving pump rods reach it and nothing holds it
- **89** (minor): A thin pale disc laid over the eccentric's front face gives a washed-out, translucent-looking inset with a darker ring around it (contour-like rim)
- **90** (minor): The yoke's rod stubs end abruptly in mid-air at Brown's break line, with no guides for the reciprocating yoke
- **91** (minor): The frame's rod stubs end abruptly in mid-air at Brown's break line, with no guides for the reciprocating frame
- **95** (minor): The vertical rod rising from the fork ends in mid-air at the old crop line with no guide or attachment
- **96** (minor): The follower rod ends in mid-air at Brown's break line on the right, with no guide or attachment
- **134** (minor): the two added end drums for the rope float in mid-air with no axle bracket or frame (rope ends now attach, but to unsupported drums)
- **135** (minor): the yoke's rods end free top and bottom with no guides; nothing carries the reciprocating yoke
- **142** (minor): default view still crops the valve rod and the added two-post guide stand at the bottom edge; the rod runs far below Brown's short tapered end
- **145** (minor): ground is two separate thin slabs with the wheel hanging in the open gap between them (Brown's pit under the wheel is not modelled); the left slab floats detached from everything
- **146** (minor): the yoke's upper and lower rods end free with no guides; nothing carries the reciprocating yoke
- **147** (minor): the orange tub is a lopsided saddle shape unlike Brown's straight-sided hatched trough; the paddle-arm axle runs straight into its sloping wall, and its faces show fine vertical streaking
- **149** (minor): the arms' pivot shaft floats with no bearing, and the two drop rods end in free eyes in mid-air
- **150** (minor): the cone is a stack of discs each painted a different shade (pale to dark stripes), reading as marker banding; a large plain black cap covers its face
- **156** (minor): default view crops the valve rod and its guide stand at the bottom frame edge
- **157** (minor): the output rod ends at a small loose block in mid-air (no guide or driven part), and the bell-crank pivot stub has no support
- **166** (minor): default view crops the rod's slide at the right frame edge (at mid-stroke the rod runs off the frame)
- **168** (minor): default view crops the long blue lever at the top frame edge (its bracket is off-frame); crank shafts still have no bearings
- **169** (minor): default view crops the long blue lever at the bottom-left frame edge; crank shafts still have no bearings
- **170** (minor): five dark tick marks (bowTick) are painted across the centre of the gold bow where it crosses the spindle (engraving hatching/marker ticks)
- **172** (minor): the grey slotted guide frame floats with no support and the crank shafts have no bearings (unchanged)
- **178** (minor): two thin raised contour rings (source-three/two-point-seven-five-radius-outline) still sit on the fixed disk face as outline lines; the disk still has no support and the tool slide sits cropped at the left frame edge
- **181** (minor): default view crops the piston rod and weight rods at the top/bottom edges (maxNdc 2.64); zoomed out the long piston rod has no guide or cylinder and ends free above
- **182** (minor): default view crops the piston rod and weight rods at the top/bottom edges (maxNdc 2.86)
- **185** (minor): the blue valve block at the end of the valve rod floats in air beside the wall (no valve chest/guide), and the reverse-lever and link fulcrum shafts are loose black bars with no bracket or bearing
- **186** (minor): default view crops the eccentric rod at the left frame edge (maxNdc 1.94); the free end of the spring-handle loop crosses its own band
- **197** (minor): a thin bar still pokes out through both short ends of the frame into empty space, and the guide arcs are thin free-standing blades with no connection to the plate (unchanged)
- **201** (minor): the vertical rod A ends in mid-air below the lever with no guide or attachment (old crop line)
- **219** (minor): pinion shaft has no bearing (floats); wheel shown as solid slotted disc where Brown draws a rim with a cross-bar; vertical shaft stub much shorter than Brown's long shaft
- **225** (minor): lever foot pivots on a bare black stub, no ground block/bracket Brown draws
- **227** (flawed): the sprocket outline is a jagged raster trace: the lower half has stair-step notches, small stray bumps and uneven concave flanks, and the teeth are lopsided, unlike Brown's clean six-pointed wheel with smooth arcs
- **229** (minor): the wheel's teeth are rounded scallop lobes where Brown draws sharp notched ratchet-like teeth; chain legs still run off the lower corners of the default view
- **236** (minor): pawl b and c tips still end in short gold cross-pins jutting sideways into the air beyond the pawl; the lever's fulcrum a has no stud or frame
- **238** (minor): pallets B and C are still separate thin rectangular plates perched on the frame tips (C on a thin tapering nib reads as a stray stub), where Brown draws them as the hooked ends of the frame; the edge beside B is a slightly jagged trace
- **240** (minor): spring is a round grey wire, Brown draws a flat leaf spring
- **241** (minor): the single driving tooth is still a thin curved sliver much slighter than Brown's broad curled tooth
- **251** (minor): the hoisting line is a thin black wire (not laid rope) that runs up through the crosshead and stops just above it in mid-air with no drum or attachment
- **263** (minor): Cone B is cantilevered from the single screw standard: its left shaft end hangs free with no bearing, and friction wheel C sits on a short bare axle stub with no bearing or frame, so both float (262's end view draws a stand under B).
- **262** (minor): Same model as 263: the stand seen under B in the end view is actually the far screw standard; the cone itself and wheel C's stub axle have no support.
- **271** (minor): The thin blue cord/strip leaving the left roller drops a short way and ends in mid-air at Brown's crop line, with no weight or attachment; it is a hairline tube rather than laid rope.
- **272** (minor): The two grey guide bushings on the sloping rod are free-floating rings with no bracket or frame, and the rod's upper end just stops in mid-air where Brown breaks it off.
- **279** (minor): The inner faces of the frame opening carry a fine dark cross-hatched grid texture (reads as hatch notation or shadow acne), visible down the slot sides.
- **278** (minor): The two toothed posts A stand free with no base, tie or frame, floating from every rotated view; the hoisting rope still leaves the canvas with no visible hoist.
- **284** (minor): The grey guide bar under the rack ends in mid-air at its right end; the short right-hand post stops below it and carries only the crank, so the bar floats unsupported there.
- **314** (minor): The lever's stand is a spindly thin-rod T-foot, and its thin vertical grey post stops short beside the lever without reaching or carrying the lever pivot, so it reads as a stray rod standing free.
- **327** (minor): The flywheel is still cut by the top canvas edge and the cylinder by the bottom edge in the default, oblique, r60, rm60 and back views, reading as broken off at Brown's crop line.
- **328** (minor): The cylinder under the parallel motion runs off the bottom of the canvas in the default, oblique and rotated views, reading as broken off at Brown's crop line.
- **329** (minor): The cylinder column runs off the bottom of the canvas in the default, oblique, r60, rm60 and back views, reading as broken off at Brown's crop line.
- **335** (minor): The piston rod runs off the bottom of the canvas in the default and back views (its cylinder only shows from oblique/r60), and the radius-rod anchor is a tiny free-floating block.
- **337** (minor): The beam runs off the right canvas edge and the piston rod off the bottom in the default, r60 and back views; the radius-rod anchor is a small grey stub floating in space.
- **338** (minor): The beam runs off the left canvas edge and the piston rod off the bottom in the default, obl, r60 and back views; the radius-rod anchor is a small grey stub floating in space (top view).
- **347** (minor): In the half-section, the wobbling disc sticks well out through the cut plane of the chamber, so from the top and r60/rm60 views half the disc hangs outside the housing; the left support post is cut by the canvas edge in the default view.
- **354** (minor): The vertical slide bar runs off both the top and bottom canvas edges in every view, and its grey guide blocks float with no frame holding them.
- **358** (minor): The long diagonal cord is still a hairline strand that leaves the top of the canvas in every view with no visible upper attachment, and it crosses the cone without engaging it.
- **364** (minor): Short thin dark vertical tick lines are painted on the drum rim between the helical grooves (copies of Brown's hatch dividers), reading as marker ticks or cracks rather than geometry.
- **367** (minor): A flat white strip with black tick marks sits on the upper ruler (Brown's hatch between the pivots rendered as a printed scale), reading as tick notation rather than a part.
- **368** (minor): The spiral on the drum is a hairline black line painted on the surface rather than a groove or ridge, and the vertical rack runs off the top canvas edge in the default, r60, rm60 and back views.
- **373** (minor): The drive belt runs off the top-left of the canvas in the default, oblique and rm60 views; where its far pulley is visible (r60) it hangs from a small grey plate floating in the air with no ceiling or frame.
- **378** (minor): At mid-stroke the saw teeth and lower frame bar sink into the solid log with no kerf, and the log lies loose below the frame feet with no carriage or ground under it.
- **382** (minor): Mirror front carries a single J-shaped raised step instead of Brown's rounded inner rim with a separate D-shaped panel.
- **385** (minor): The two vertical pins end as short black stubs in mid-air; neither the door nor the frame they are fixed to is present, so the linkage floats.
- **388** (minor): Both rollers hang on short axle stubs with no bearings or frame.
- **390** (minor): Fulcrum pin a and the flywheel shaft end in air with no bearing or frame.
- **395** (minor): Port stubs are open half-round troughs that stop short of the ring and read as split/broken pipes; there is no casing body round the plug.
- **398** (minor): Crosshead guide bars and both wheel shafts float with no frame or bearings.
- **402** (minor): Balance wheels still render as pale translucent discs inside the rims.
- **407** (flawed): Cord lengthens about 1.6x between phases while the slide stays put (inextensible cord stretching as the arch straightens).
- **415** (minor): Drive rod D runs out past the rim and ends in mid-air at the old crop line.
- **425** (minor): From behind/above the steam passages are separate slab fins with open slots between them, and the abutment guide's top cap hovers above its housing with a visible gap.
- **427** (minor): Inlet and outlet ports are solid square posts with no bore, not pipes.
- **428** (minor): Side ports are pairs of flat parallel slabs (a pipe drawn in section) rather than pipes.
- **429** (minor): Top and bottom ports are still pairs of flat plates with an open slot between them, not pipes.
- **430** (minor): Wheel axle has no bearings or frame; the wheel hangs inside the breast unsupported.
- **433** (minor): Spout trough floats with no support (still present).
- **439** (minor): Pulley has no hanger or bracket and the supply trough floats, ending square in mid-air.
- **440** (minor): Supply trough floats above the tilting trough with no support, its upper end square in mid-air.
- **445** (minor): Lower chamber is a half-section but the falling water bell and disc are whole, so half of the water hangs outside the cut box in open air; thin black gap under the upper channel's top plate.
- **446** (minor): Same as 445: the revolved water bell protrudes outside the half-cut lower box into open air.
- **447** (minor): Anchor lies on the water surface instead of the river bed; boat is a flat lozenge.
- **454** (minor): From behind, the casing top and bottom rims show jagged dark dashes (z-fighting), and the orange diaphragm lip pokes out past the casing wall.
- **459** (minor): Well shaft is still a pale translucent panel/box.
- **462** (minor): Upper and lower chain wheels have no bearings or frame; axles float.
- **463** (minor): Dark horizontal bars across the gate faces (straps not in the plate) read as marker stripes.
- **475** (minor): At mid-cycle the water fills the whole chamber volume including the cut-away half, so the sectioned chamber reads as a closed translucent teal body.
- **480** (minor): Dark wedge with fine vertical comb stripes (artefact) under the central pipe b at the tank floor; pipe b stops at the floor instead of passing through as drawn.
- **491** (minor): Capstan and ratchet ring stand on nothing (no deck), and the rope's black cleat post also floats.
- **498** (minor): Supply pipe beyond the cock ends open in mid-air at the old crop line.
- **499** (minor): Dial face is translucent with no case back, so the mechanism shows through from behind (still present).
- **500** (minor): The section figure is a second half-cut copy of the case set beside the gauge; in rotated views it reads as a stray half-drum stuck to the gauge's side.
- **501** (minor): Scale card carries a thick solid black bar with ticks (a black block), not Brown's fine graduations.

Default-view crops of whole parts that run past Brown's framing are not counted as flaws (the viewer can rotate and zoom; AGENTS.md asks for the engraving's initial camera).

## Pass-57 verification audit (rotated views, after pass 56)

- **13** (minor): the hauling fall leaving the fixed sheave ends in mid-air a short way to the left (old crop line), with no hand or attachment as in 12 and 14-22
- **23** (minor): the two guide pulleys B float with no bracket or axle support, and the band's top run is carried only by them
- **39** (minor): the fixed ring is a solid grey disk pierced by four thin slits that read as white tick marks (Brown draws an open four-segment ring around the gears); the grey vertical rod also stops in mid-air at Brown's break line
- **47** (minor): from above/below, the quarter-cut clutch halves show thin uncapped wire-like shell outlines (blue and orange hairline frames) along the cut edges instead of solid cut faces; the grey shifting lever's horizontal arm also ends in mid-air
- **52** (minor): the operating lever tapers to a thin blade whose far end stops in mid-air; the round grip the ledger describes is not visible, and the lever's fulcrum bracket hangs off the shaft with no frame
- **61** (minor): the black shifter fork hangs off the collar and its two legs stop just below in mid-air; no lever, pivot or guide carries it
- **64** (minor): the lever's fixed fulcrum pin and the spring's clamp block float with no frame or bracket behind them
- **75** (minor): the fixed click/detent pivot (upper right) is a free-standing pin with nothing behind it; the wheel shaft also stands alone
- **76** (minor): the stationary pawl's pivot is a bare grey pin sticking out into space with no frame or bracket
- **77** (minor): lever A's fixed pivot is a bare grey pin sticking out behind the lever with nothing carrying it
- **80** (minor): bar A ends flat in mid-air a short way below the teeth (old crop line) with no guide or attachment; the whole assembly floats
- **81** (minor): the grey guide plates for rod B float unsupported
- **83** (minor): rocking shaft B carrying both sectors has no bearings/frame (presentation hides the physics frame), so the sector pair and link A hang in space
- **84** (minor): Two grey support posts under the wheel end in mid-air at the bottom (old crop line)
- **99** (minor): the grey guide for the follower rod is a cluster of thin posts that end in mid-air below the disk (old crop line), with a spindly cross-frame; nothing carries the guide block
- **101** (minor): the two grey guide blocks for the sliding bar float with no frame; the top hanger strip is a knife-thin sheet
- **104** (minor): the long screw floats with no bearings at its ends, and the pedestal bore is empty (no shaft through the wheel hub; the wheel shows through the hole)
- **106** (minor): the grooved drum's shaft is two short stubs ending in mid-air (Brown's break) with no bearings; nothing carries the drum
- **107** (minor): same as 106 - the drum shaft stubs end in mid-air with no bearings
- **110** (minor): Both half-nuts sit above the roller; Brown's text puts one over and one under the roller
- **113** (minor): The table's support rollers have no axle or bearing and float
- **114** (minor): the rack yoke's end stubs stop flat in mid-air with no guides (unlike 90/91/96), so the reciprocating frame floats
- **115** (minor): the rack frame has only short tab stubs at each end and no guide; it floats
- **116** (minor): the frame's end stubs stop in mid-air with no guides
- **118** (minor): the yellow pitman ends at a bare eye in mid-air on the left (nothing drives it), and the upper rack has no guide so it floats above the pinion
- **122** (minor): the blue driving rod runs off to the right and ends in mid-air at Brown's break with no guide or crank
- **123** (minor): the double rack has no guide; its plain end stubs stop in mid-air above and below
- **127** (minor): the two racks slide with no guides and float
- **153** (minor): bar guide rollers, elbow-lever pivot and disk shaft all sit on bare stub axles with no frame or bearing behind; the whole mechanism floats
- **183** (minor): handle/cam shafts have no frame or bearings (181/182 have standoff brackets), the orange bar has no guides and the valve rods end in mid-air top and bottom
- **184** (minor): same as 183: rockshafts float with no frame, bar unguided, rods end in mid-air when zoomed out
- **186** (minor): eccentric rod ends square in mid-air (no eccentric or strap) when zoomed out; rockshaft has no bearing
- **187** (minor): eccentric rod ends square in mid-air when zoomed out; rockshaft unsupported
- **188** (minor): eccentric rod runs off and ends square in mid-air with no eccentric; rockshaft unsupported
- **189** (minor): eccentric rod ends square in mid-air, vertical valve rod ends in mid-air at top, bell-crank pivot has no support
- **192** (minor): pinion spins on a short bare stub with no shaft, bearing or universal joint carrying it (floats against the wheel face)
- **193** (minor): pinion shaft beyond the universal joint ends in mid-air with no bearing
- **194** (minor): pinion on a bare stub with no universal-joint shaft or bearing (caption requires a jointed shaft)
- **197** (minor): a thin bar still pokes out through both short ends of the frame into empty space; the guide arcs are free-standing blades and the pinion has no shaft support
- **201** (minor): the two L-shaped guide brackets for rod A float in space with no frame or wall behind them
- **234** (minor): verge spindle S floats across the crown wheel with no bearings; crown-wheel shaft ends in mid-air below
- **247** (minor): in the reset phase the sounding line is looped around the weight instead of tied to the rod, whose top ends bare; rod and weight hang together below a lone hand
- **263** (minor): Cone B is still cantilevered off the screw: its large-end shaft stub hangs free with no bearing or standard under it (the only stands are the two screw standards).
- **262** (minor): Same model as 263: from r60/rm60 the cone's large-end shaft stub has no bearing; the end-view stand under B is the far screw standard, so the cone is cantilevered.
- **272** (minor): The cam is a hollow-looking skewed frustum: its big face is a flat yellow annulus with a flat red inner disc (two-tone, reads as a painted target or a shallow bowl) with a knife-thin rim, instead of Brown's thick S-curved cam plate; the shaft enters the red disc with no hub on that side.
- **277** (minor): No lock plate or frame: the hammer's pivot, the grey strap block at c and the grey link's far pin all hang in space, and the cylinder has no arbor/bearing, so the whole lock floats when rotated.
- **286** (minor): The stamp rod has no guide: it rises bodily off its grey foot block with nothing holding it upright except the cam contact, and the cam's shaft is a bare short stub with no bearing or frame.
- **290** (minor): The lower rod K is modelled as a short stub that just stops square in mid-air at Brown's crop line (no bob, weight or attachment), so from every view it reads as broken off.
- **292** (minor): From behind, the plain back face of the rim shows a ring of small pale tick slivers (the front-face teeth poking through the rim), reading as marker ticks.
- **295** (minor): From r60/rm60 the wheel's second (back-plane) set of teeth are loose arrowhead blocks on thin stub rods sticking sideways out of the rim, which reads as stray bits rather than the cylinder-wheel's raised teeth.
- **304** (minor): The plain back face of the wheel rim carries a ring of tiny black dots (pin-hole ends), which reads as dotted marker notation rather than geometry.
- **305** (minor): The pendulum's suspension eye is an empty hole with no pin or cock, and the wheel's arbor in the window has no frame or bearing, so the whole pendulum and wheel float when rotated.
- **318** (minor): The yellow stud R is a loose peg hanging in space beside the hairspring (no cock or plate carries it), so from oblique/top views it floats; the scale arc also stands on a lone post with nothing linking it to the balance.
- **321** (minor): Spring T runs off the wheel to a black end pin that hangs in space with no frame or stud holding it, clearly visible as a loose tail from the back and r60 views.
- **332** (minor): The beam's main pivot A is an empty black bore with no shaft, bearing or support, so the whole beam (and linkage) hangs in space from every view.
- **333** (minor): Both fixed pivots sit on thin pale slabs that float in mid-air with nothing under or behind them (no frame joins them to the cylinder's column), reading as detached ground patches.
- **336** (minor): The slanted grey frame member still ends in mid-air at a small square end cap (visible whole in obl/r60): nothing carries its upper end.
- **351** (minor): The rack bar slides up and down with nothing guiding it (its top and bottom cross-heads ride with it and touch no frame) and the pinion sits on a bare arbor stub, so the whole mechanism floats when rotated.
- **353** (minor): The helve's pivot is a blue boss with a short pin and a small clevis stub that stand on nothing: no post or frame carries the hammer's fulcrum, so it floats between the anvil block and the cam stand.
- **367** (minor): The pale inset strip on the upper bar still carries faint tick marks along its length (a printed-scale look copied from Brown's hatching), visible in default, back and top views.
- **378** (minor): At mid-stroke the saw teeth and lower frame bar still pass straight into the solid log with no kerf; the log's end face also carries painted dark concentric ring lines (contour-line decoration).
- **377** (minor): The black handrail the man grips hangs in space: neither end is fixed to the slanted board, the frame or any post, so it floats in every rotated view.
- **387** (minor): The boat at the ladder foot is a flat rectangular slab (pontoon) with a round bump underneath, not Brown's boat.
- **393** (minor): The bracket carrying the upright shaft's bearing sticks out sideways and ends in mid-air; nothing holds the shaft or its pulley.
- **394** (minor): Pinion shaft is a short stub with no bearing and the rack frame has no guide, so the whole device floats.
- **400** (minor): Bar A and the cam shaft have no guide or bearings; the whole feed hangs in air.
- **401** (minor): The treadle fulcrum and the wheel-shaft bushing float with no frame or bearing.
- **403** (minor): The two guide pins and the traced arc hang in mid-air with no drawing board under them.
- **405** (minor): The focus pins, rollers and both traced hyperbolas float in mid-air with no drawing surface.
- **406** (minor): The focus pin and the traced parabola float in mid-air beside the square with no drawing surface.
- **415** (minor): Both pawl cords bend at a sharp corner in mid-air instead of running straight (or sagging) from crank E to the pawls.
- **424** (minor): The ports are flat black slabs stuck onto the walls, one poking out past the outside of the casing. Frame B stands proud of the casing front, and the crankshaft stub has no bearing.
- **427** (minor): The cylinder is a bare ring with no heads, front or back, so from behind you see the hub and pistons through it and nothing carries the shaft.
- **428** (minor): The cylinder is a bare ring with no heads, so the rollers and arms show straight through from behind and the shaft has no bearing.
- **433** (minor): The jet passes straight through the wheel's floats and carries on out past the far side, instead of striking them.
- **448** (minor): From the side or back, the whole piston and the foot-valve disc stick out through the cut face of the half barrel. The spout is a cut half-pipe.
- **449** (minor): The whole piston and valve discs stick out past the half-cut barrel wall when rotated.
- **450** (minor): The whole piston and valve discs stick out past the half-cut barrel wall when rotated.
- **451** (minor): The whole piston and valve discs stick out past the half-cut barrel wall when rotated.
- **456** (minor): The casing is an open ring with no back head, so the rotor and its cross-arms show straight through from behind, and the ring has open gaps at the port joints.
- **458** (minor): The bracket or shelf Brown draws on the left post is missing.
- **459** (minor): The lower end of the spiral shaft hangs free below the worm. The step and arm that should support it and shift it between the worm wheels are missing.
- **477** (minor): The liquid in valve D is a free-standing orange bar inside the cut valve that doesn't fill the cavity, so it reads as a stray rod.
- **483** (minor): A lens-shaped part pokes out through the right side wall of the case. An orange zigzag wire from valve B ends loose in mid-air.
- **490** (minor): The pulley bracket bars end in T-caps in mid-air and the wheel bearings and tiller have no deck or hull, so the whole gear floats (still present).
- **498** (minor): The supply vessel is an open cup: from behind you look into it and see the port hole. It floats with no support.

## Pass-59 verification audit (rotated views, rotation cue, flat shading; after pass 58)

- **28** (minor): Quadrant cue on the turntable's top face is a harsh near-black/grey checkerboard, not the subtle part-tone cue (face does not read as the blue disc).
- **56** (minor): Yellow stepped cone pulley of the speed motion has plain faces (front and back) with no quadrant rotation cue.
- **58** (minor): Grey loose pulley at the end of the lower pulley stack has a plain end face with no quadrant rotation cue (the band runs on it per caption).
- **61** (minor): Upper orange drum, lower yellow and grey pulleys show plain end faces with no quadrant rotation cue (60's equivalent pulleys have it).
- **62** (minor): Grey loose pulleys on the lower shaft have plain end faces with no quadrant rotation cue.
- **70** (minor): Driving wheel C shows a plain featureless front face with no quadrant rotation cue; its turning is invisible from the default view.
- **86** (flawed): The two horizontal drive lines Brown draws as laid rope are rendered as plain flat tan belts to an added pulley.
- **89** (minor): Orange eccentric sheave face inside the strap is plain with no quadrant rotation cue.
- **90** (minor): Orange eccentric disc in the yoke has a plain face with no quadrant rotation cue.
- **95** (minor): Rotating oblique disk has a plain top face with no quadrant rotation cue, so its spin is invisible.
- **158** (flawed): Crank throw is too large for the treadle: the treadle swings from level to ~50 degrees and rises up across the front of the disk face; Brown's treadle stays nearly level with a short crank
- **238** (flawed): Pallets B and C are separate rectangular box blocks stuck onto the frame corner and arm tip, protruding past the frame outline instead of being pallet faces formed in the frame
- **181** (minor): Upper rocker's catch nose beside the hub is a jagged stepped/notched polygon fragment that reads as construction scrap
- **182** (minor): Same jagged stepped catch-nose fragment on the upper rocker as 181
- **153** (minor): Stud end faces are stark white inside black rims, reading as white index dots on the disk
- **154** (minor): Stud end faces are stark white inside black rims, reading as white index dots on the disk
- **168** (minor): The grey shaft bearing bosses float free behind the cranks, tied to no frame
- **169** (minor): The grey shaft bearing bosses float free behind the cranks, tied to no frame
- **196** (minor): Pinion B's 'fixed axis' is a bare stub with no bearing or support
- **209** (minor): Forked catch is built from thin round wire tubes with a loose wire ring round the shaft, unlike Brown's solid flat forked horn
- **226** (minor): Frame A is a spindly thin wire rectangle (Brown draws a broad flat frame) and it reads as a bare wire loop when rotated
- **244** (minor): Scale-pan suspension cords are plain black tubes, not the laid-rope look
- **250** (minor): Quadrant rotation cue bands painted on the spoked orange shaft wheel's rim (spoked wheel needs no cue; reads as marker stripes)
- **254** (minor): Forks are spindly thin round wires, much slighter than Brown's chunky flat forks
- **262** (minor): Friction cone B is a plain featureless rotating cone with no quadrant rotation cue (end face and flank plain in every view).
- **263** (minor): Same cone B as 262 shows no quadrant rotation cue on its flank or end faces.
- **272** (minor): Beveled disk cam reads as a smooth domed lens/bowl (dome gradient across the face) rather than Brown's thin disk with a curved edge, and its plain faces carry no rotation cue.
- **277** (flawed): Brown's lower-right stirrup/link between hammer and mainspring is missing (spring just bears on the hammer); a large invented dark wedge-shaped frame plate dominates the back view and the hatched stop above dog a is a plain grey block.
- **281** (minor): Grooved disk's plain back face has no rotation cue, so from behind the rotating disk looks static.
- **282** (minor): Crank disk is a plain orange disk with no quadrant rotation cue, and its black hub shows a speckled z-fighting pattern.
- **288** (minor): The yellow pallets are small flake-like tabs sticking out sideways from the anchor tips (one on a thin stub) instead of shaped pallet faces; they look like stray protruding bits.
- **291** (minor): Balance (blue disk) is a featureless oscillating disk with no quadrant rotation cue.
- **296** (minor): Balance disk D is a plain blue disk with no quadrant rotation cue.
- **314** (minor): Balance disk is a plain blue disk with no quadrant rotation cue.
- **315** (minor): The spindle drive is a smooth yellow cone with no teeth or rotation cue where Brown draws a toothed pinion; the two grey bearing slabs float with nothing connecting them to a frame.
- **320** (minor): Upper pulley P (blue) and the orange going-wheel pulley are plain disks with no quadrant rotation cue (the lower pulleys have it).
- **323** (minor): A small white square collar sits in the middle of the axle (Brown's knob B) and reads as a leftover white index marker.
- **334** (minor): A black strip runs along the back edge of rack B, which reads as a decorative dark rim.
- **346** (minor): Table top slab and cylinder cap are solid black, so the table edge reads as a black outline rim.
- **348** (minor): A thin seam line crosses the plain back face of disk A (a lone edge/z-fighting line with no quadrant tone change).
- **352** (minor): Windlass barrels and the two top sheaves are plain featureless rotating parts with no quadrant rotation cue.
- **354** (minor): Crank disk is plain on both faces with no quadrant rotation cue.
- **358** (minor): The four blue guide sheaves on the right frame are plain disks with no rotation cue.
- **361** (minor): The large left wheel and the belt pulleys have no quadrant rotation cue, and the large wheel's face shades like a dome.
- **362** (minor): Upper drum (blue) is a plain rotating cylinder with no quadrant rotation cue on its faces or tread.
- **373** (minor): Wagon wheels spin on the moving large wheel but are plain orange disks with no rotation cue.
- **481** (flawed): Water fills only the thin annulus between case and drum; the drum's compartments are dry and see-through to a grey back disc (Brown fills to above the centre). Pale rectangular chips float near the hub, and the partitions are four thin curved vanes rather than Brown's hooked chambers around the inlet a.
- **494** (flawed): The tong points never bite the stone. The left jaw tip hangs in the air beside the block, and both tips stay clear of it through the whole cycle, so the stone is never gripped or lifted.
- **413** (minor): Plain friction wheels A and the lower wheel are featureless turning discs without the quadrant rotation cue
- **415** (minor): Wheel D is a plain featureless rim/drum without the quadrant rotation cue
- **411** (minor): Plain white paper drum turns without the quadrant rotation cue
- **393** (minor): The polishing cup and its top disc spin on the universal joint, but they are plain domes and discs without the quadrant cue, so the cup's own rotation cannot be seen
- **428** (minor): Smooth rollers A spin without the quadrant rotation cue
- **490** (minor): Yellow rope guide sheaves are plain discs without the quadrant rotation cue
- **495** (minor): Plain orange drive pulley A lacks the quadrant rotation cue
- **492** (minor): The pull rope ends in a disembodied hand and cuff floating in mid-air
- **471** (minor): From behind, crank disc A and cylinder B hang in the open frame window with no visible shaft bearing or guide connecting them to the frame
- **469** (minor): The Archimedean screw is a plain opaque grey tube with no helix visible, where Brown shows the spiral. Pale irregular blotches mottle the water in both cisterns.
- **445** (minor): The walled neck between flume and turbine case is missing; the water column crosses an open air gap between them
- **446** (minor): Same as 445: the walled neck between flume and case is missing, so the water jet crosses open air
- **436** (minor): Bottom step/bridge is a thin wavy sheet with blotchy mottled shading, unlike Brown's angular trough
- **433** (minor): From behind, the water jet passes straight through the vanes and hub and fades out below
- **421** (minor): Speckled shadow-acne pattern on the black gland/port blocks

## User review, 2026-09-26 (after pass 66)

The user reported: 293 needs a thicker escape wheel and a clearer notch in
the back of the blue roller (perhaps see-through); 297's pins should stand on
the orange wheel's front face with the blue part see-through, and the blue
part is currently disconnected; 296's spokes are too thin; 309's yellow parts
are disconnected at the top and its ratchet teeth are symmetric instead of
slanted; 346's grey guide bottoms are disconnected; 351's rack has unused
teeth (Brown matches 8 and 8); 361's pulleys need flanges like 255; 367's
ivory scale must reach the brass arc in the open position and the arc's lower
pin is off-centre; 368's rack and pinion teeth should face the default camera
(or the rack be see-through); 370's ratchet clips through the black pins and
its pawl is on the wrong side. Lanes p67-horology and p67-mech fix these.

Follow-up the same day: 387's grey railings on the right are disconnected, and it should be shown once (the animation already shows both of Brown's states); 388's toothed top roller has far too skinny, pointed teeth. Lane p67-b fixes these.

## User review of 389–436, 2026-09-26

The user reported: 389's pawls touch only at the tip (they must seat fully in
the ratchet root; Brown's curvature ensures it); 391's rack teeth float and its
guides should be curved; 393's lower support is not flush; 394 needs redoing
(involute pinion, compatible rack, all teeth used); 395 should be one animated
view; 396's pin clips the fork and its escapement must be one extruded shape
without hidden pins; 397's groove end notches are undrawn; 398's groove should
be derived so the driven wheel turns fully at varying speed; 399's chain links
show gaps; 400 is oversmoothed; 402's escapement is wrong; 412's notched outer
wheel and separate pawls were fused into a frame; 414's pinion tapers the
wrong way and its scroll gear is too loose, long-toothed and dark; 415's crank
E is perpendicular to the plate's; 419's wheels should be plain with crank
pins; 420's hand must pull (not push) the rope; the engines 421, 422, 423, 426
and 428 need to work (closed piston, correct chambers, openings, two valves a
side, deforming rubber); 430's vanes must be slanted and bent; 433's water is
disjoint segments; 434's and 435's blade curvature, counts and radii must
match; 436's lower blades must be helical and its inlet is blocked. Water
effects in general need a better approach than segments (a full fluid
simulation was too slow). Lanes p69-pawls, p69-gears, p69-misc, p69-engines
and p69-water address these.

Follow-up: all the water movements need a closer look. 455's centre is a leaky hexagon where Brown draws a mutilated cylinder sealed by two circular-arc valves; 461's valves do not fit tightly and its water is not conserved. Lanes p69-w1 to p69-w4 closely review all ~50 water, pump and gas movements.
