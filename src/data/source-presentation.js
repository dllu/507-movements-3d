// Per-movement presentation matched to Brown's engraving, applied after
// construction by src/simulation/source-presentation.js. `rotate` is an XYZ
// Euler (radians) premultiplied onto the model root, `scale` a model-local
// scale (a mirror when one component is -1), `camera` the initial view
// direction in world coordinates after that rotation, and `remove` the
// userData.role patterns (anchored regular expressions; the object name stands
// in for a missing role) of parts the plate does not show. `note` records what the engraving shows. Re-measure display
// profiles (scripts/measure-display-profiles.mjs ID) after changing an entry.
export default {
  83: {
    remove: ['base', '(?:front|rear)RockshaftBearing', 'rockshaftSleeveBearing', 'rockshaftStandard(?:FloorPlate)?', 'input(?:Lower|Upper)Guide', 'inputGuidePost(?:Foot)?-?[\\d.]+'],
    note: 'Side elevation of rod A, rockshaft B, the pierced ratchet sectors C and the crown wheel D on its upright shaft, rod A broken off to the upper right; no frame, posts, base, bearings or rod guide are drawn. Following the p60 support policy only the upright shaft\'s collar bearing below the wheel is shown; rod A ends past the plate edge at its pinned driving fork and short stem, with no guide, posts, rockshaft standard or base. Only the production MuJoCo model is presented; its physics uses ideal joints.',
  },
  85: {
    remove: ['strikingBed'],
    note: 'Side elevation of the curved standard with its two guide brackets, the twin wiper A and the stamp rod with projection B; the stamp head hangs above the ground line and no anvil or striking bed is drawn.',
  },
  86: {
    remove: ['rearDrive(?:Web|Hub)'],
    note: 'Front elevation of the loose wheel A on its A-frame standard with catch B, cam C, the post and the overhead stop. Brown cuts the view at the ground line and at the right edge; the rope, driving band, second pulley and pump hardware are modelled whole and run off the default view. The band\'s own pulley sits hidden behind A (only its rim is kept, so the spoke openings stay clear).',
  },
  89: {
    remove: ['bored-crosshead-cheek', 'crosshead-bridge-clear-of-swinging-eye', 'wrist-pin-(?:shank|retaining-head)', 'output-valve-stem', 'fixed-horizontal-crosshead-channel', 'base-rail', 'guide-support-\\d', 'bored-rear-shaft-support'],
    note: 'Front elevation of the sheave, strap and bolted rod flange. Brown breaks the rod off to the right; the model shows it whole to its wrist eye. No crosshead, guides or bed are drawn.',
  },
  90: {
    camera: [0, 0, 1],
    note: 'Flat front elevation of the oval yoke with its two rods, the eccentric disk and the shaft. Brown breaks the rods off; they run on whole into fixed guides just past the plate edge, carried from behind by webs on one plain tie bar (hidden behind the rods) that also holds the shaft\'s rear bearing. No pedestal is drawn. Only the production MuJoCo model is presented; its physics keeps ideal guides and bearings.',
  },
  91: {
    camera: [0, 0, 1],
    note: 'Flat front elevation of the yoke with its upper and lower rods, the triangular eccentric and the shaft. Brown breaks the rods off; they run on whole into fixed guides just past the plate edge, carried from behind by webs on one plain upright tie bar (hidden behind the rods) that also holds the shaft\'s rear bearing. Only the production MuJoCo model is presented; its physics keeps ideal guides and bearings.',
  },
  93: {
    remove: ['guide\\d', 'crossbar\\d', 'post\\d', 'shaftSupport'],
    note: 'Front elevation of the crank disk behind the slotted yoke and its stems; no frame, brackets or stem guides are drawn. Only the production MuJoCo model is presented; the synchronous registry model keeps its reconstructed frame for offline checks.',
  },
  94: {
    remove: ['tab\\d', 'bracket\\d', 'shaftSupport'],
    note: 'Face view of the slotted radial plate over the spiral-grooved plate with the bolt; the slotted plate is see-through where Brown dots the spiral groove behind it; no rim lugs, brackets or shaft support are drawn.',
  },
  95: {
    camera: [0, 0, 1],
    note: 'Flat side elevation: the inclined disk edge-on, the forked rod and roller above it, the shaft bearing bolted to the wall corner. Brown crops the rod at the top; it runs on whole into a fixed guide just above the plate edge, carried by a web on a slender post that stands on the wall top behind the disk, directly behind the rod. No gantry is drawn.',
  },
  96: {
    camera: [0, 0, 1],
    remove: ['spring', 'springSeat'],
    note: 'Flat face view of the heart cam on its shaft and the roller-ended bar. Brown breaks the bar off to the right; it runs on whole into two fixed guides just past the plate edge, carried from behind by webs on a plain rear frame bar (hidden behind the bar) that also holds the cam shaft\'s rear bearing. No return spring or spring seat is drawn. Only the production MuJoCo model is presented; its physics keeps the inferred return spring and ideal guide.',
  },
  98: {
    camera: [0, 0, 1],
    note: 'Front view with Brown\'s layout (pivot shaft on the right) and the same rotation sense, taken from the arm side without a mirror: the grooved arm in front, its cover lifted in section to show the crank pin in the endless groove, and the opaque disk behind it (Brown views from the disk side and dashes the arm). No frame is drawn (the factory omits it).',
  },
  105: {
    note: 'Front elevation of the weighted handle, screw, nut and ram in the frame. Brown breaks the frame off below the ram guide; the frame is modelled whole with its lower jaw, anvil and blank, which run off the bottom of the default view.',
  },
  108: {
    camera: [0, 0, 1],
    note: 'Flat front elevation of the crossing-groove barrel between its top and bottom rails, the swivel shoe arm on the left guide rod and the gear at the foot.',
  },
  109: {
    camera: [0, 0, 1],
    note: 'Flat front elevation of the lead screw and the cut work between the top and bottom rails, the carriage arm reaching across and the change gears at the foot.',
  },
  110: {
    rotate: [-Math.PI / 2, 0, 0],
    camera: [0, 1, 0.12],
    note: 'Plan view looking down on the divided roller with its right- and left-hand screws, the parallel spindle below it on the page, the arms and half-nuts, the two end frames and the hand lever. Brown\'s text puts one half-nut over the roller and the other under it, so the model lies flat: the near half-nut rides on top of the roller, the far one beneath it, and the frames are the tops of end standards running down to the floor.',
  },
  134: {
    remove: ['rear-fixed-pedestal-supporting-drum-axis', 'fixed-foot-of-drum-bearing-pedestal', 'fixed-bearing-behind-drum-hub', 'one-of-eight-source-rim-separator-plates'],
    note: 'Front elevation of the spoked rope drum with a plain rim, the rope running off along the ground line; no pedestal or bearing is drawn, and Brown\'s rim-segment joints (painted face strips here) are not drawn as marks.',
  },
  139: {
    remove: ['bearing-post', 'base', 'roller-post-\\d'],
    note: 'Front elevation of the carriage, internal rack, pinion and top linkage on its two wheels; no post, floor plank or roller posts are drawn. The fixed pinion and roller bearings stay hidden behind the carriage and wheels.',
  },
  142: {
    note: 'Face view of the carrier disk, fixed pinion, planet wheel and crank with the connecting rod running down past the disk to the cropped plate edge, where its slider rides the traverse guide rail. Brown crops the supports; the model keeps the guide rail\'s post and bridges, the stud\'s rear post and their base (mostly below the cropped view) so the rail and stud are carried.',
  },
  143: {
    remove: ['pulley-index'],
    note: 'The left pulley is a plain disk; Brown draws no index stripe on it.',
  },
  144: {
    remove: ['.+-white-depth-index'],
    note: 'The lazy tongs with their input and output rods; no white depth indices are drawn on the pins.',
  },
  145: {
    remove: ['fixed-rear-column-supporting-beam-axis-clear-of-slider', 'fixed-foot-of-rear-beam-pivot-column', 'fixed-horizontal-rail-for-reciprocating-small-standard', 'white-index-showing-.*', '.*-white-depth-index'],
    note: 'Side elevation of the spoked flywheel in its pit, the tied rod to the small standard, the upright rod and the one-armed beam turning on the hatched shaft at its right end; no beam column, wheel post, rail or index marks are drawn. The ground is one solid with the pit, cut in section on the wheel plane; a slim post behind the wheel (standing on the pit floor) carries the wheel shaft, and the beam shaft runs back into a flange on the framing behind, hidden by the beam\'s hub.',
  },
  149: {
    note: 'The two cams, the two levers on their common pivot and the two rods broken off below; no rear bearing bar, rod guides or slides are drawn. The model keeps them as minimal supports: the bar behind carries the lever pivot and cam shaft, and the whole rods run down to slides in guides carried back to that bar.',
  },
  150: {
    rotate: [0, Math.PI, 0],
    scale: [-1, 1, 1],
    camera: [0.2, 0.02, 1],
    remove: ['fixed-camshaft-bearing-ring', 'fixed-longitudinal-base-rail', 'fixed-transverse-base-tie', 'fixed-camshaft-bearing-post', 'fixed-post-under-right-lever-fulcrum', 'throw-\\d-white-lobe-index', 'throw-\\d-identity-tick', 'sliding-carrier-end-collar', 'invisible-full-selection-and-valve-stroke-envelope', 'white-no-slip-follower-index', 'white-valve-translation-index', 'white-longitudinal-key-and-rotation-index', 'output-guide-(?:-?1|bracket)', 'fulcrum-standoff', 'valve-slide'],
    note: 'Nearly end-on view down the camshaft: the hatched shaft end in front of the sliding cam series, the rocking lever on its right-hand fulcrum and the valve rod; no base, posts, guides or index marks are drawn, and none are shown (p60 support policy).',
  },
  151: {
    remove: ['guide-(?:back|upper|lower)-\\d', 'guide-post-\\d-.*', 'bearing-(?:post|foot)-.*', 'rear-base', 'upper-bearing-(?:arm|rear-tie|post)', 'input-shaft-rotation-mark'],
    note: 'The opposite-hand screw shaft between its end bearings, the two nuts and the upper worm shaft end-on in its bearing ring; no base, posts, upright or index mark are drawn.',
  },
  152: {
    remove: ['(?:horizontal-stud|vertical-stud|pencil)-white-motion-index'],
    note: 'The traverse bar with its two studs in the cross-piece grooves and the pencil tracing the ellipse; no white motion indices are drawn.',
  },
  153: {
    remove: ['fixed-back-bar-carrying-disk-elbow-and-roller-axles'],
    note: 'Brown draws the bar, its rollers, the elbow and the disk with no frame; the p57 back bar and pillar are not shown (p60 support policy), so the axles end as plain stubs.',
  },
  154: {
    remove: ['pulley-axle-rear-post'],
    note: 'Brown draws the disk standard and the bell-crank standard on the ground line, and the top pulley on its own; the added rear post under the pulley is not shown (p60 support policy).',
  },
  155: {
    remove: ['engraved-wheel-circle'],
    note: 'Face view of the ratchet wheel, the elbow lever with its pawl and the pinned rod; the ink circle Brown engraves inside the teeth is not painted on the wheel.',
  },
  156: {
    remove: ['diskPost', 'pivotPost'],
    note: 'The disk, slotted bell crank, link and the output rod running off below the plate; the rod is whole, its guided crosshead, guide rails and base lying beyond the plate\'s view. No disk or pivot posts are drawn.',
  },
  157: {
    remove: ['base', 'diskPost', 'pivotPost', 'guidePost', 'guideBackArm.*'],
    note: 'The disk, rod, bell crank, link and output rod; no base, posts or guide rails are drawn. The model keeps a minimal output guide channel and flanged bearings for the disk and bell crank, all carried by framing behind the mechanism, so the output crosshead and the pivots do not float.',
  },
  165: {
    remove: ['output-guide-and-fulcrum-bracket'],
    note: 'Brown draws the wave cam, its upright spindle and the jointed lever with the output bar broken off below; the p55 guide box and bracket are not shown (p60 support policy).',
  },
  171: {
    remove: ['white-index-on-eccentric-sheave', 'white-index-on-link-die'],
    note: 'The eccentric, rods, curved link, die and trunnion guide; no white index marks are drawn.',
  },
  172: {
    remove: ['backBar', 'guideFramePost', 'shaftBearingFlange', 'guideFrameFlange', 'guideFrame', 'slider'],
    note: 'Brown draws the crank, the link and the rod broken off at the right; the reconstructed slider, its guide frame, back bar, posts and flanges are not shown (p60 support policy).',
  },
  178: {
    remove: ['fixed-horizontal-guide-rail-for-cutting-slide', 'fixed-end-stop-of-horizontal-output-guide', 'nonrotating-horizontal-cutting-tool-slide'],
    note: 'Brown draws the disk, the slotted crank and the rod broken off to the left; the reconstructed tool slide and its guide rails past the plate are not shown (p60 support policy).',
  },
  181: {
    remove: ['engine-frame-beyond-plate'],
    note: 'Brown draws the two back-weighted handles on their hatched shafts, the catch and the piston rod; the reconstructed engine frame, stays and rod guides are not shown (p60 support policy), so the shafts end as plain stubs and the whole piston rod runs straight past the plate.',
  },
  182: {
    remove: ['engine-frame-beyond-plate'],
    note: 'Brown draws the two back-weighted handles on their hatched shafts, the catch and the piston rod; the reconstructed engine frame, stays and rod guides are not shown (p60 support policy), so the shafts end as plain stubs and the whole piston rod runs straight past the plate.',
  },
  183: {
    remove: ['fixed-back-bar-carrying-handle-shafts-rod-guide-and-cylinder'],
    note: 'Brown draws the handles on their hatched shafts, the quadrant catch, the piston rod and the back-weight rods; the reconstructed back bar, rod guide, cylinder and foot are not shown (p60 support policy).',
  },
  184: {
    remove: ['fixed-back-bar-carrying-handle-shafts-rod-guide-and-cylinder'],
    note: 'Brown draws the handles on their hatched shafts, the quadrant catch, the piston rod and the back-weight rods; the reconstructed back bar, rod guide, cylinder and foot are not shown (p60 support policy).',
  },
  186: {
    remove: ['fixed-column-beam-and-hanger', 'fixed-column-foot', 'fixed-eccentric-shaft-bearing', 'fixed-rockshaft-bearing'],
    camera: [0.03, 0.02, 1],
    note: 'The rockshaft, valve rocker, eccentric rod with its notch-a drop and the spring loop handle; no frame is drawn. Past the view the rod runs on straight to its strap round the eccentric; the reconstructed column, beam, hanger and bearings are not shown (p60 support policy), so both shafts end as plain stubs.',
  },
  187: {
    remove: ['fixed-eccentric-bearing-column', 'fixed-rockshaft-bearing-column', 'fixed-column-foot', 'fixed-eccentric-shaft-bearing', 'fixed-rockshaft-bearing'],
    camera: [0.03, 0.02, 1],
    note: 'The rockshaft, valve arm, eccentric rod with its lower handle, and the pivoted upper cam handle; no frame is drawn. Past the view the rod runs on straight to its strap round the eccentric; the reconstructed floor columns and bearings are not shown (p60 support policy), so both shafts end as plain stubs.',
  },
  188: {
    remove: ['fixed-eccentric-bearing-column', 'fixed-rockshaft-bearing-column', 'fixed-column-foot', 'fixed-eccentric-shaft-bearing', 'fixed-rockshaft-bearing'],
    camera: [0.03, 0.02, 1],
    note: 'The eccentric rod with its loop handle, leaf spring at a and valve pin; no frame is drawn. The pin rides on a valve arm from a rockshaft below the view, and the rod runs on straight to its strap round the eccentric; the reconstructed floor columns and bearings are not shown (p60 support policy).',
  },
  189: {
    remove: ['fixed-eccentric-bearing-column', 'fixed-rockshaft-bearing-column', 'fixed-column-foot', 'fixed-eccentric-shaft-bearing', 'fixed-rockshaft-bearing', 'fixed-bracket-from-rockshaft-bearing-to-bell-crank-stud'],
    camera: [0.03, 0.02, 1],
    note: 'The rockshaft, forked eccentric rod and the bell crank with its vertical rod; no frame is drawn. Past the view the rod runs on straight to its strap round the eccentric; the reconstructed floor columns, bearings and the bell-crank stud bracket are not shown (p60 support policy).',
  },
  190: {
    camera: [0, 0.01, 1],
    remove: ['white-index-.*', 'white-marker-at-.*'],
    note: 'Flat side elevation: the bench is drawn as a plank section under the work, standard, holder, shoe and screw; no index marks are drawn.',
  },
  191: {
    remove: ['rear-fixed-bearing-standard', 'fixed-support-foot', '(?:upper|lower)-radial-speed-reset-seam', 'white-index-on-(?:lower-variable-speed-output|upper-constant-speed-driver)'],
    note: 'Face view of the two notched wheels; no standard, foot, seam outline or index marks are drawn.',
  },
  192: {
    remove: ['fixed-plain-frame-for-wheel-and-input-shaft'],
    note: 'Face view of the hooked toothed land, its parallel groove b, d and the hub. Brown omits the pinion; it is kept as the working drive on the captioned jointed shaft: Hooke joints at the input shaft end and on the pinion shaft join a telescopic slip shaft standing end-on in front of the wheel. Brown draws no frame, and the reconstructed input-bearing column, wheel standard and feet are not shown (p60 support policy).',
  },
  193: {
    remove: ['fixed-plain-frame-for-wheel-and-input-shaft'],
    note: 'Face view of the concentric mangle wheel and its pinion on its jointed shaft (Hooke joints and a telescopic slip shaft to the input shaft end in front of the wheel). Brown draws no frame, and the reconstructed input-bearing column, wheel standard and feet are not shown (p60 support policy).',
  },
  194: {
    remove: ['white-index-showing-equal-opposite-wheel-speeds', 'single-coincident-inner-outer-pitch-arc', 'fixed-plain-frame-for-wheel-and-input-shaft'],
    note: 'Face view of the pin mangle wheel and its pinion on a plain face with its hub boss; the pins stand free with no pitch-circle line and no index mark is drawn. The caption requires the pinion shaft to be jointed: Hooke joints at the input shaft end and on the pinion shaft join a telescopic slip shaft standing end-on in front of the pinion. Brown draws no frame, and the reconstructed input-bearing column, wheel standard and feet are not shown (p60 support policy).',
  },
  197: {
    camera: [0.02, 0.01, 1],
    remove: ['(?:left|right)-fixed-vertical-shaft-slide-rail', 'rear-rack-frame-web', 'bearing-carriage-free-to-rise-and-fall', 'fixed-vertical-rail-for-shaft-carriage', 'pinion-shaft-bearing-carriage-rising-and-falling', 'fixed-standards-on-one-foot'],
    note: 'Flat face view of the square frame as one solid plate, the capsule rack with its round pins on its face, the two end guides on their side mounts and the pinion on its front-driven shaft. Brown draws no support: the frame slides on a rail across its back in a fixed channel hidden behind it; the reconstructed front shaft rail, carriage, channel post and foot are not shown (p60 support policy), so the rising and falling pinion shaft ends as a plain stub.',
  },
  198: {
    camera: [0.02, 0.01, 1],
    note: 'Flat face view of the frame between its four plain guide rollers, the endless rack, the pinion and the two suspension links.',
  },
  201: {
    remove: ['fixed-base-rail', 'fixed-rear-support-post', 'fixed-(?:output-pivot|input-shaft)-bearing-bridge', 'engraving-label-A', 'rod-guide-support-bracket', 'fixed-guide-bushing-around-rod-A', 'fixed-(?:upper|lower)-bored-guide-of-rod-A', 'fixed-back-bar-carrying-shafts-and-rod-A-guides'],
    note: 'The eccentric gears, belt, pulley and rod A; no base, post, bearing bridges or guide bracket are drawn, and the letter A is left to the caption rather than modelled. Rod A, broken off below the lever on the plate, runs on straight and ends cleanly; the reconstructed rod guides, back bar and foot are not shown (p60 support policy).',
  },
  203: {
    note: 'Face view of the hooked arm with its J-shaped slot and the straight arm whose pinned end passes behind it (dashed on the plate); the factory draws no index marks.',
  },
  204: {
    remove: ['fixed-(?:longitudinal|transverse)-base-rail', '(?:driver|driven)-shaft-bearing-post'],
    note: 'The two hyperboloidal rollers on their shafts; no base or posts are drawn.',
  },
  209: {
    remove: ['instantaneous-common-pitch-contact'],
    note: 'The two focus-mounted ellipses and the solid flat forked horn on the right one; no pitch-contact marker is drawn.',
  },
  212: {
    remove: ['geneva-stop-fixed-base-rail', 'geneva-stop-fixed-bearing-upright', '(?:driver-A|stop-wheel-B)-rear-bearing-arm', 'geneva-stop-(?:left|right)-transverse-foot', '212-bored-fixed-shaft-support-\\d'],
    note: 'Face view of driver A and stop wheel B; no frame is drawn.',
  },
  213: {
    remove: ['friction-stop-fixed-base-rail', 'friction-stop-fixed-bearing-upright', '(?:winding-arbor|split-stop-stud)-rear-bearing-arm', 'fixed-(?:winding-arbor|split-stop-wheel)-bearing', 'friction-stop-(?:left|right)-transverse-foot','winding-ratchet-radial-speed-index', 'split-stop-wheel-radial-speed-index', 'face-pin-front-motion-index', 'moving-face-pin-to-partial-tooth-contact-marker', 'face-pin-to-uncut-rim-hard-stop-contact-marker'],
    note: 'Face view of the split stop ring above the ratchet wheel at Brown\'s pose: the narrow slot at the top, the five teeth below and the face pin between the middle teeth; no frame, white speed indices or contact markers are drawn.',
  },
  214: {
    remove: ['gear-finger-stop-base-rail', '(?:left-stop-counterwheel|right-winding-input)-bearing-upright', 'gear-finger-stop-(?:left|right)-foot', '(?:driven|driver)-bored-fixed-support'],
    note: 'Face view of the two finger-stop wheels; no frame is drawn.',
  },
  215: {
    remove: ['crescent-stop-base-rail', '(?:crescent-driver|six-slot-wheel)-bearing-upright', 'crescent-stop-(?:left|right)-foot', '215-bored-fixed-shaft-support-\\d', 'uncut-convex-terminal-sector-highlight', '(?:crescent-driver|six-slot-wheel)-angular-rate-index', 'visible-face-pin-contact-cap', '(?:forward|reverse)-convex-sector-to-(?:upper|lower)-crescent-cusp-contact'],
    note: 'Face view of the crescent driver and the six-slot wheel at Brown\'s pose, the pin on the line of centres in the left slot; no frame, gold sector strip, white rate indices or contact markers are drawn.',
  },
  216: {
    camera: [0.02, 0.015, 1],
    remove: ['mutilated-compound-drive-base-rail', 'common-centerline-bearing-spine', 'mutilated-drive-(?:left|right)-foot', 'fixed-(?:reversing-pinion|compound-input)-bearing', 'compound-input-angular-rate-index', 'pinion-variable-rate-index', 'slow-forward-external-mesh-contact', 'quick-reverse-internal-mesh-contact'],
    note: 'Face view of the internal and external mutilated wheels on one shaft and the reversing pinion below, opening at the plate\'s pose: the external sector mid-mesh below and the internal teeth round the upper half; both shafts are drawn cut in section, so their bearings lie outside the drawing and no frame is drawn. The white rate indices and contact markers are hidden.',
  },
  217: {
    camera: [0.1, 0.08, 1],
    note: 'Face view of the grooved heart cam C, D, B, e with its symmetric double-walled groove and hub, drawn alone as Brown draws it; only stud A, named in the caption, rides the groove. Its lever about H, catch G and notch wheel F are presented on plate 218. No frame is drawn.',
  },
  219: {
    remove: ['floor-footstep-and-pinion-shaft-standard'],
    note: 'Brown draws the crown wheel on its vertical arbor and the pinion on its shaft running off to the upper right; the reconstructed pinion-shaft standard and arbor footstep are not shown (p60 support policy), so both shafts end as plain stubs.',
  },
  225: {
    remove: ['active-pawl-tooth-contact-marker'],
    note: 'Elevation of the saw-tooth wheel with the curved pawl on the upright vibrating carrier, pivoted on a lug on hatched ground; no base block, white indices or contact marker are drawn.',
  },
  231: {
    note: 'Oblique view of the two slender cranks and the long coupler, the input shaft running back to the lower left and the long output rod running off to the right; the factory draws no bearing link, bearings or index marks.',
  },
  232: {
    remove: ['sliding-pawl-C-tooth-corner-contact-marker'],
    note: 'Face view of the square-toothed wheel with frame A, handle B and the parallelogram-lifted pawl C; pins are drawn as plain eyes, with no white indices or contact marker.',
  },
  233: {
    remove: ['lantern-stop-rear-support-frame-beam', '(?:roller-arm|latch)-inward-travel-stop-block', 'lantern-wheel-rotation-witness', 'stop-roller-rotation-witness', '(?:roller|latch)-stop-to-trundle-contact-marker'],
    note: 'Face view of the lantern wheel with its roller stop and latch; no frame, arm rest blocks, white rotation witnesses or contact markers are drawn.',
  },
  234: {
    rotate: [-Math.PI / 2, 0, Math.PI],
    camera: [6.2, 3.6, 6.9],
    remove: ['verge-end-journal', 'verge-rotation-witness', 'crown-wheel-rotation-witness', 'fixed-plain-u-frame-for-verge-and-arbor'],
    note: 'Oblique view from about 20° above, verge S falling to the right across the wheel: a flush toothed plate on a shallow band with its arbor hanging down, and two plain flags A, about a third of the wheel radius long, hanging from the round spindle at mid-swing; no frame, bearings, journal caps or witness marks are drawn. The rim is cut into saw teeth whose slant matches the unmirrored model.',
  },
  235: {
    remove: ['active-(?:drive-face|click-over|holding-click)-contact-marker'],
    note: 'Face view of the six-point star with the holding click above and the broad arm below: its hooked tappet is hinged near the left end, and the small return spring runs under the arm to bear up on the tappet\'s tail lobe; no white indices or contact markers are drawn.',
  },
  237: {
    camera: [-4, 4.4, 9],
    remove: ['fixed-lower-output-bearing', 'crown-wheel-face-inset', 'crown-wheel-output-hub', 'top-arm-bearing-outline', 'white-crown-wheel-rotation-index', 'white-top-arm-motion-index', 'white-pawl-lift-index', 'active-crown-(?:drive-face|ramp-return)-contact'],
    note: 'Oblique view from about 24 degrees above: the thin open crown cup with upright saw teeth round its rim, the output shaft hanging below, and the top arm on a low boss on the stud rising from the floor of the cup, pointing away and upward to the right with the pawl at the rim; no lower bearing collar, face collar, face ring, hub outline, white indices or contact markers are drawn.',
  },
  238: {
    remove: ['white-escape-wheel-rotation-index', 'white-pallet-carrier-motion-index'],
    note: 'Face view of the seven-point wheel D in the notch of the anchor, B below it and C at the hooked tip, pivoted at A; B and C are blocks of the anchor itself, and no witness marks or edge lines are drawn.',
  },
  239: {
    remove: ['fixed-spur-stop-support-rail', 'fixed-spur-gear-bearing-post', '(?:left|right|output)-journal-support-post'],
    note: 'The spur wheel between its two pivoted stops; no rail or posts are drawn.',
  },
  242: {
    remove: ['brake-demonstration-base', 'fixed-brake-wheel-bearing-post', 'fixed-lever-fulcrum-post'],
    note: 'The brake wheel, strap and lever; no base or posts are drawn.',
  },
  244: {
    note: 'Pulley A with its block and strapped band, lever D, scale B and the two stops C and C\', carried by a slim fixed post behind the lever (Brown draws the stops alone).',
  },
  246: {
    remove: ['common-drawing-plane-for-tracer-and-pencil', 'drawing-sheet-outline', 'small-source-locus-traced-by-point-B', 'two-times-linear-copy-drawn-by-pencil-A'],
    note: 'The pantograph arms, the round fixed point C, tracer B and pencil A over a blank ground; no drawing board or traced figures are drawn.',
  },
  247: {
    note: 'Front section through the rod, the weight and the catch, with the probe foot below, framed as the plate is; the view follows the lowered rod, so the thin contact line (Brown draws no sea bottom) rises from below for the probe to strike, and the dropped weight sinks away with it as the rod is recovered.',
  },
  248: {
    remove: ['raised-grip-rib-on-nut-B', 'white-rotation-index-on-nut-B'],
    note: 'Half-section through nut B and the screwed end of pipe C, with pipe A and its flange drawn whole; the nut is drawn plain, without grip ribs or an index.',
  },
  252: {
    remove: ['fixed-arm-carrying-stem-guide-bush', 'fixed-arm-root-on-standard', 'fixed-guide-bush-for-piece-d-stem'],
    note: 'Brown draws slot C on its broken standard, rollers A and B and piece D with its stem broken off below; the stem runs on straight and ends cleanly, and the p55 guide bush and arm on the standard are not shown (p60 support policy).',
  },
  253: {
    remove: ['check-hook-\\d-torsion-return-spring', 'visible-torsional-shock-spring-between-flange-and-load-side-drum', 'white-flange-b-speed-index', 'white-load-side-drum-speed-index', 'framework-a-stud-d-\\d-radial-support', 'fixed-circular-rim-of-framework-a'],
    note: 'Framework A with studs D, flange B with its three hooks, the drum and the rope; Brown recommends a drum spring but draws none, so the hook and drum springs, speed indices, stud supports and an outline rim round A are not shown.',
  },
  262: {
    remove: ['inferred-tail-standard-carrying-bush-for-screw-D', 'inferred-plain-bush-on-screw-D-crests', 'inferred-head-standard-carrying-bush-for-journal-of-D', 'inferred-plain-bush-on-input-journal-of-D'],
    note: 'Brown draws cone B, roller C, screw D and the footed standard E carrying the nut; the p57 inferred head and tail standards with their bushes are not shown (p60 support policy), so the screw is carried by Brown\'s standard E and the cone.',
  },
  263: {
    remove: ['inferred-tail-standard-carrying-bush-for-screw-D', 'inferred-plain-bush-on-screw-D-crests', 'inferred-head-standard-carrying-bush-for-journal-of-D', 'inferred-plain-bush-on-input-journal-of-D'],
    note: 'Brown draws cone B, roller C, screw D and the footed standard E carrying the nut; the p57 inferred head and tail standards with their bushes are not shown (p60 support policy), so the screw is carried by Brown\'s standard E and the cone.',
  },
  272: {
    note: 'Side elevation of the disk with its bevelled rim and wavy face on the shaft, and the inclined rod in its guides. Brown draws no frame; a plain base behind the disk carries the two shaft bearings on posts and, through one upright, the backing rail and brackets that hold the rod guides, so no guide floats.',
  },
  276: {
    remove: ['fixed-(?:left|right)-guide-support-post', 'fixed-equal-diameter-cam-display-base', 'fixed-cam-bearing-arm', 'fixed-rear-cam-bearing-post', 'fixed-(?:left|right)-straight-bar-guide'],
    note: 'Face-on elevation of the three-lobed cam between the rollers of the level sliding bar; no base, posts, bearing arm or bar guides are drawn.',
  },
  279: {
    remove: ['fixed-(?:left|right)-crosshead-guide-post', 'fixed-crosshead-display-base', '(?:left|right)-fixed-crosshead-guide-(?:upper|lower)'],
    note: 'Close face view of the Clayton journal box in its slotted crosshead, the rod broken off on both sides; the lining pieces and gibs are see-through where Brown dots the crank throw behind them; no base, posts or rod guides are drawn.',
  },
  254: {
    remove: ['white-shaft-end-speed-index', 'white-one-pocket-per-turn-index'],
    note: 'The sprocket wheel and its chain; no white speed or pocket indices are drawn.',
  },
  267: {
    remove: ['fixed-clockwise-arrow-not-part-of-pulley'],
    note: 'The friction pulley rim, its pivoted eccentric arms and springs on the shaft; Brown\'s direction arrow is notation and is not drawn as a part.',
  },
  285: {
    remove: ['white-quill-translation-index'],
    note: 'The lathe head with its wheel, screw and spindle; no quill index is drawn.',
  },
  280: {
    remove: ['fixed-windlass-display-base'],
    note: 'Face view of the plain windlass wheel, the rim-travelling jaw block, the coupler and the hand lever on the framed posts, which run off the bottom of the plate; no base is drawn and the ratchet is hidden behind the wheel.',
  },
  288: {
    note: 'Face view of the escape wheel A and anchor H, L, K on their arbors a and A; no clock plate, pendulum or crutch is drawn.',
  },
  289: {
    note: 'Face view of the dead-beat wheel A and the anchor hung from a; no clock plate, pendulum or crutch is drawn.',
  },
  290: {
    note: 'Face view of the seven-tooth wheel D inside the annular pendulum frame with its rectangular pallets A and B, hung on the suspension spring C; the bob is below Brown\'s crop.',
  },
  291: {
    note: 'The escape wheel B, the balance a (impulse roller with notch g and the discharging stud), and the detent A with stop d, hook k, stud i and the passing spring; no watch plate or balance wheel is drawn.',
  },
  292: {
    note: 'The stud wheel and the anchor hung at F with its front arm B-c and back arm A-R; no clock plate or pendulum is drawn.',
  },
  293: {
    note: 'Close-up of the top of the duplex wheel: roller A and pallet B on the balance staff over the long teeth and crown pins a; no watch plate or balance wheel is drawn.',
  },
  294: {
    rotate: [-2.0944, -Math.PI / 2, 0],
    camera: [0.32, 0.12, 1],
    remove: ['cylinder-escape-wheel-rotor', 'escape-wheel-arbor'],
    note: 'The same cylinder escapement model as 295, seen from the side as Brown draws the cylinder alone in perspective; the escape wheel (shown in 295) is not drawn.',
  },
  295: {
    remove: ['cylinder-upper-end-(?:pivot|collar|dome|flange|tube)'],
    note: 'The same model as 294, seen along the cylinder axis at the level of the wheel: the upper end of the cylinder is cut away so the C-shaped passage with lips A and B and the wedge pallets a, b, c on their stalks show as Brown draws them.',
  },
  296: {
    note: 'Face view of the escape wheel A, the lever E-B-C and the balance roller D with its pin; no watch plate or balance wheel is drawn.',
  },
  297: {
    remove: ['fixed-lantern-escapement-base', 'fixed-bored-rear-plate-joining-both-arbor-bearings', 'fixed-(?:rocking-arm-bearing-A|lantern-wheel-bearing)'],
    note: 'Face view of the pin wheel with pallets B and C on arm A; Brown dashes the arm, but the model shows the real arm in front of the disc, where the pallets meet the trundle ends. No base, rear plate or bearings are drawn.',
  },
  299: {
    rotate: [Math.PI / 2, Math.PI / 2, 0],
    camera: [0.02, 0.02, -1],
    remove: ['crown-wheel-rotation-witness', 'weighted-horizontal-foliot-regulator'],
    note: 'Nearly edge-on view along the verge, cropped along the crown edge to about three pitches of the near band with the wheel ends running out of view: the concave-backed raked teeth with the far teeth seen through their gaps, the verge journal end-on above and the two pallets about 100° apart, the steep one hanging down-left and the shallow one lying out to the right. Brown crops the foliot out of the detail, so it is not shown.',
  },
  300: {
    note: 'Front elevation of the one model shared with 301: the barbed four-spoked wheel (Brown cuts off the upper two spokes) over the edge-on pallet on the horizontal balance staff.',
  },
  301: {
    note: 'Side elevation of the one model shared with 300, along the balance staff: the two wheels edge-on on their common arbor with the spacer drum between them, and the level D pallet below with the staff end-on.',
  },
  303: {
    remove: ['white-Graham-wheel-index', 'white-pendulum-swing-witness', 'white-active-Graham-contact', '(?:left-D|right-E)-(?:concentric-locking|impulse)-face'],
    note: 'Face view of the Graham wheel with its four crossings as a leaning X under anchor D, C, E, the pendulum rod marked only by the dot F; no frame, bob, index marks or highlighted pallet faces are drawn.',
  },
  305: {
    remove: ['rear-clock-frame-upright', 'fixed-pendulum-pivot-bracket', 'fixed-single-pin-disc-arbor-bracket'],
    note: 'The bottle-shaped pendulum plate, one part with its eye, rod, two eccentric adjusting bushes and the Z-shaped escapement opening cut as one outline to Brown\'s windows, and the disc with its single ruby pin behind it, shown with the pendulum upright; no clock frame or brackets are drawn.',
  },
  306: {
    remove: ['rear-frame-cross-bridge', 'bored-back-strut-joining-wheel-arbor-to-frame-bridge'],
    note: 'The three bent legs inside the stepped opening of the pendulum plate, which is screwed to the two pendulum-rod strips; no frame bridge or strut is drawn.',
  },
  307: {
    remove: ['rear-clock-frame-upright', 'three-leg-wheel-arbor-bracket'],
    note: 'The bottle plate, broken off at its neck, with its stepped slot, pallets A/B and stops D/E, and the long-tooth wheel with its backward pins; no clock frame or bracket is drawn.',
  },
  308: {
    remove: [],
    note: 'Front elevation of the pendulum pieces P, P and their web carrying pallet I, click C and its two stop pins, with the six-toothed hooked escape wheel under its screwed cock and lever Q; no clock frame or pendulum suspension is drawn.',
  },
  313: {
    remove: ['fixed-watch-frame-base', 'escape-wheel-arbor-standard', 'balance-staff-standard', 'escape-wheel-spoke-[1-4]-of-4', 'impulse-roller-with-crescent-tooth-passage', 'impulse-roller-spoke-[1-3]-of-3', 'visible-index-on-(?:clockwise-escape-wheel|balance-roller)', 'visible-radial-working-face-of-pallet-P', 'visible-contact-marker-at-(?:lock-T|sole-impulse-pallet-P)'],
    note: 'The flat escape wheel with four broad crossings, the roller drawn as a plain disc notched at pallet P with the discharging roller V, and spring detent D; no watch frame, open roller ring, spokes or index marks are drawn.',
  },
  314: {
    remove: [],
    note: 'Flat parts in Brown\u2019s planes: the windowed thirteen-tooth wheel, the crescent with pallets A and B over the forked lever, pallet C on the balance staff and the notched balance disc behind, with the banking pins; the arbors run back to plain bars behind the movement, which Brown does not draw.',
  },
  309: {
    remove: ['fixed-Mudge-escapement-frame', 'pendulum-rod-between-P-and-Q', 'pendulum-bob', 'pendulum-suspension-eye', '(?:.*-)?white-.*witness'],
    note: 'Front elevation of the wheel and the two flat pallet plates on their arbors C, each with its lifting face, locking notch and ball weight, and the half-forks down to pins P, Q, with only the end of the fixed suspension stud between the arbors; Brown omits the pendulum rod and bob, and no clock frame, crossbars, bearing brackets or index marks are drawn.',
  },
  310: {
    remove: ['pendulum-bob', 'single-wheel-bearing-bracket', '(?:.*-)?white-.*witness', '(?:.*-)?beat-pin-tip-witness'],
    note: 'Front elevation of the lyre-shaped gravity legs under the T crossbar, the three-legged wheel with its fly and stops D, E; the pendulum rod runs out of the bottom of the plate with no bob, and no wheel bracket or index marks are drawn.',
  },
  311: {
    remove: ['pendulum-bob', 'double-wheel-bearing-bracket', '(?:.*-)?white-.*witness', '(?:.*-)?beat-pin-tip-witness'],
    note: 'Front elevation of the diamond of gravity legs, the double three-legged wheel and the long fly; the pendulum rod runs out of the bottom of the plate with no bob, and no wheel bracket or index marks are drawn.',
  },
  312: {
    remove: ['fixed-bloxam-support-frame', 'bloxam-pendulum-bob', '(left-A-E|right-B-F)-anti-double-impulse-reinforcement-wire', 'documented-point-two-inch-primitive-diameter-ring', '(?:.*-)?white-.*witness'],
    note: 'Front elevation of the two wheels and the gravity arms hung from C with fork pins E, F; the trapezoid outline is the arms themselves, and no separate support frame is drawn. The pendulum is only a dashed line and no bob is drawn.',
  },
  315: {
    remove: ['fixed-bearing-bridge-post', 'fixed-upper-spindle-bearing', 'nonphysical-wrist-orbit-reference-circle', 'white-crank-rotation-index', 'white-spindle-rotation-index', 'white-pendulum-orientation-index'],
    note: 'Perspective view of the top hanger, the inclined rod and cylindrical bob, the single crank arm on the spindle, the loose bearing bar, the bevel collar and the foot; no bearing posts, orbit circle or index marks are drawn.',
  },
  316: {
    remove: ['fixed-mercurial-pendulum-suspension-frame', 'moving-pendulum-pivot-hub', 'white-pendulum-swing-index', 'white-mercury-level-motion-index', 'nonphysical-fixed-center-of-oscillation-datum-ring', 'white-fixed-center-of-oscillation-marker'],
    note: 'The jar pendulum, its stirrup and adjusting screw, the rod running out of the top of the plate; no suspension plate, pivot, level indices or datum ring are drawn.',
  },
  317: {
    remove: ['fixed-compound-pendulum-suspension-frame', 'moving-pendulum-pivot-hub', 'main-bob-central-rod-hub', 'white-main-weight-motion-index', 'white-end-weight-motion-index', 'white-fixed-center-of-oscillation-marker', 'nonphysical-fixed-center-of-oscillation-datum'],
    note: 'The rod running out of the top of the plate, compound bar C, weights W and bob M; no suspension plate, pivot, hub or white indices are drawn.',
  },
  318: {
    remove: ['fixed-stud-R-support'],
    note: 'The three-armed balance, spring with stud R and curb pins P on the regulator lever, pointer T over the graduated SLOW/FAST band; no stud bracket is drawn.',
  },
  319: {
    remove: ['temperature-softening-balance-spring-segment', 'fixed-outer-balance-spring-stud', 'fixed-balance-spring-stud-bracket'],
    note: 'The compensation balance alone: bar t-a-t\' with timing screws and the compound arms carrying weights b, b\'; no balance spring or stud is drawn.',
  },
  320: {
    remove: ['fixed-clock-frame', '.*-symmetric-rotation-index'],
    note: 'The pulleys P and p, the weights and the endless chain (a laid rope, whose lay shows its travel); no clock frame or rotation indices are drawn.',
  },
  321: {
    remove: ['fixed-clock-frame-and-T-bearing', 'great-wheel-G-symmetric-rotation-index', 'barrel-B-symmetric-rotation-index', 'maintaining-spring-material-index'],
    note: 'Great wheel G, the ratchets, click R, spring S-S\', detent T pivoted at its eye and the weight on barrel B; no frame beam or white indices are drawn.',
  },
  323: {
    remove: ['(?:left|right)-equal-nicked-wheel-A-white-(?:face-rotation-index|rolling-index-nick)', 'visible-axle-C-identification-collar'],
    note: 'Ruler B with its axle C and the two nicked wheels A; no white rotation or nick indices are drawn, and Brown\'s C is a letter on the axle, not a collar.',
  },
  329: {
    remove: ['white-index-fast-with-plate-C', 'white-index-on-carrier-crank-C', 'white-index-on-translating-piston-rod-A'],
    note: 'Flywheel with plate C, wheel B inside the fixed internal gear D, piston rod A and the A-frame legs, cropped at the cylinder cover as the plate is; no white indices are drawn.',
  },
  335: {
    remove: ['fixed-floor-column-carrying-radius-pin-F-flange'],
    note: 'Brown draws the beam, parallel bars and the fixed radius pin F with no frame; F\'s flange reads as bolted to unmodelled engine framing, and the p56 floor column under it is not shown (p60 support policy).',
  },
  336: {
    remove: ['plain-undrawn-supports'],
    note: 'Brown draws the cylinder, standard F, the parallel motion and the broken diagonal frame member; the member runs on to its bolting flange past the plate, and the p56 bed bar, column and shaft pedestal are not shown (p60 support policy).',
  },
  337: {
    remove: ['fixed-floor-column-carrying-radius-pin-F-flange'],
    note: 'Brown draws the beam, parallel bars and the fixed radius pin F with no frame; F\'s flange reads as bolted to unmodelled engine framing, and the p56 floor column under it is not shown (p60 support policy).',
  },
  338: {
    remove: ['fixed-floor-column-carrying-radius-pin-F-flange'],
    note: 'Brown draws the beam, parallel bars and the fixed radius pin F with no frame; F\'s flange reads as bolted to unmodelled engine framing, and the p56 floor column under it is not shown (p60 support policy).',
  },
  348: {
    remove: ['fixed-shaft-pedestal-leg-\\d', 'fixed-base', 'fixed-base-edge', 'fixed-external-guide-rail-(left|right)', 'fixed-external-guide-support-\\d', 'fixed-external-guide-top-bridge', 'fixed-rear-shaft-bearing-bridge', 'rod-B-circular-pin-sliding-in-explicit-vertical-guide', 'guide-pin-white-center-index', 'disk-A-white-rotation-index', 'rod-B-white-rocking-index'],
    note: 'The disk A with its crossed slots at about 29 degrees and slides c, and the bar B broken off above the disk; no stand, base, external guide, guide pin or white indices are drawn.',
  },
  350: {
    remove: ['fixed-wide-base', 'fixed-base-edge', 'lower-input-direction-dash-\\d+', 'fixed-horizontal-guide-for-driven-lower-pin-D', 'lower-input-horizontal-guide-shoe', 'fixed-upper-pin-rear-support', 'white-traverse-index-on-output-bar', 'output-bar-motion-rib-\\d', 'moving-pin-D-green-front-index'],
    note: 'The slotted link with its two pins, the short bar with its riser and guides a, a; the lower pin\'s drive is only a dotted line on the plate, so no input guide, shoe, dashes, base, pin post or indices are drawn.',
  },
  351: {
    remove: ['fixed-stamp-machine-base', 'fixed-anvil-below-falling-stamp', 'fixed-workpiece-at-lower-impact-stop', '(?:upper|lower)-guide-white-motion-index'],
    note: 'The broad rack rod between its two broad collars, the stamp head below and the mutilated pinion; no base, anvil or workpiece is drawn. Brown draws no rod guides either, but the rack rod must be guided, so its two open C-guides are kept, carried with the pinion bearing on one plain back bar.',
  },
  355: {
    camera: [7, 10, 12],
    note: 'Raised three-quarter view of pillar G on its flared foot, pintle F in the top bearing, ring A seen as a broad ellipse and disk C nearly edge-on; the factory hides the white indices Brown does not draw.',
  },
  356: {
    remove: ['asymmetric-surface-index-showing-heavy-ball-spin', 'off-axis-dot-showing-heavy-ball-spin'],
    note: 'Bohnenberger\'s rings A, A1, A2 on their pivots with the heavy ball B spinning in A2; the ball is plain, with no painted spin stripes or dots.',
  },
  358: {
    remove: ['fixed-carriage-guide-rail', 'rail-end-cross-tie', 'rail-travel-reference-mark'],
    note: 'Plan of the carriage: the fusee on its shaft in the carriage frame with the crank at the large end, the cross-member and bed carrying the two edge-on wheels on their axles, and the band crossing the fusee; no guide rail or travel ticks are drawn under the wheels.',
  },
  354: {
    remove: ['visible-radial-index-on-input-disk', 'visible-linear-index-on-output-stem'],
    note: 'Brown\'s layout taken from the crosshead side: the grooved crosshead and stem in front of the opaque disk, whose raised rim reads as his ring (Brown views from the disk side and dashes the groove and stem behind it). Both stems are framed through their guides over the whole stroke. Brown draws no frame; a plain rear frame of two rails behind the disk carries both stem guides on brackets and the input shaft\'s bearing, so the guides do not float. No white indices are drawn.',
  },
  363: {
    camera: [0, 0.03, 1],
    scale: [-1, 1, 1],
    note: 'Front elevation of the see-saw with its left end raised (the official t=0 pose mirrored), a shoe with end board, rounded heel and cleat at each plank end, the post with its concave buttresses and straight braces on the base; no handholds are drawn.',
  },
  364: {
    camera: [0, 0.06, 1],
    remove: ['fixed-two-axis-bearing-stand', 'white-face-index-showing-continuous-driver-angle-and-rate', 'white-index-showing-free-friction-roller-bearing-spin', 'white-top-face-index-showing-output-dwell-and-index-rate', 'white-marker-identifying-one-of-eight-oblique-output-grooves', 'engraved-panel-line-between-oblique-grooves'],
    note: 'Side elevation of the pin wheel face-on beside the helically grooved drum on its upright shaft; no stand, bed or white indices and groove marker are drawn, and Brown\'s short hatch dividers between the grooves are notation, not painted ticks on the rim.',
  },
  273: {
    remove: ['(?:input|output)-slider-[A-D]-moving-on-(?:horizontal|vertical)-axis-white-translation-index', 'shared-through-pin-[A-D]-white-motion-index'],
    note: 'Flat elevation of the rhombus of four links with sliders A, B, C and D in their guides; no white slider stripes or pin dots are drawn.',
  },
  331: {
    remove: ['white-wrist-journal-rotation-index-disk', 'wrist-journal-radial-spin-index', 'white-index-rigid-on-flywheel-rim', 'white-index-on-translating-crosshead-A'],
    note: 'Front elevation of the flywheel behind the slotted crosshead A in its frame; no white rim tick, wrist disk or crosshead index is drawn.',
  },
  360: {
    remove: ['white-continuous-flywheel-index', 'white-oscillating-drum-index'],
    note: 'Front elevation of the rocking beam with its two cord sectors, the hanging weight and the drum-and-ratchet on the flywheel shaft; the cords run over the sector ends without ball fastenings (the factory hides the knots), and no white indices or cord markers are drawn.',
  },
  380: {
    remove: ['white-hollow-feed-screw-rotation-index', 'white-inner-drill-spindle-rotation-index'],
    note: 'Side elevation of the cramp frame, hollow feed screw with tommy bar and the drill spindle with its crank; no white indices are drawn.',
  },
  399: {
    remove: ['(?:left-upper|right-lower)-carried-white-swivel-nut-rotation-index'],
    note: 'Face view of the two U-shaped halves joined by the two swivel nuts; no white rotation indices are drawn.',
  },
  368: {
    camera: [0, 0.03, 1],
    scale: [1, 1, -1],
    note: 'Flat elevation from the rack side, mirrored front-to-back to the plate: the table edge-on, the horizontal bevel wheel on the left driven by the upright bevel on the crank shaft, the rack in front of its spur pinion, the crank on the right, and the plain cylinder below with its spiral line and the rack-borne marking arm.',
  },
  371: {
    remove: ['fixed-base-beneath-mangle-wheel', 'rear-output-bearing-post'],
    note: 'The mangle wheel and its shifting pinion; no base or bearing post is drawn.',
  },
  346: {
    camera: [0, 0.03, 1],
    scale: [-1, 1, 1],
    remove: ['visible-piston-head-face-index', 'parallel-crank-angular-index-[12]'],
    note: 'Front elevation of the closed cylinder on the bed and solid plinth, the slotted guide arch, crosshead, the front side rod and crank, the crank pin to the left of the shaft (the official t=0 pose mirrored); the rear rod and crank lie directly behind them, and the crank indices are not drawn.',
  },
  347: {
    camera: [0, 0.03, 1],
    note: 'Brown\'s section on the vertical plane through the shaft: the rear half of the casing with its conical heads, ball seats and spherical zone cut open, the disk edgewise on its ball, the rod to the socket in the edgewise flywheel, and the shaft running left to its pedestal.',
  },
  372: {
    camera: [0.03, 0.04, 1],
    remove: ['white-index-.*', 'single-tangent-band-applying-known-restraint-to-hoop-periphery', 'band-attachment-at-known-hoop-lever-arm', 'scale-pan-suspension-from-measuring-band', 'weighted-scale-pan-indicating-hoop-restraint', 'calibrated-weight-on-dynamometer-scale-pan', 'fixed-dynamometer-base'],
    note: 'Front elevation of the four bevel wheels with the broad hoop standing edgewise in front, the shaft through two tall standards tied by a turned stretcher; the weighing band, weights, base and white indices are not drawn.',
  },
  374: {
    remove: ['fixed-base-of-treadle-drive-demonstrator', 'fixed-standard-supporting-upper-shaft', 'right-hand-fixed-treadle-pivot-standard', 'white-index-showing-continuous-output-shaft-rotation', 'broad-foot-pad-at-free-end-of-treadle'],
    note: 'The eccentric pulley, band and the diagonal treadle rising leftward from its right-hand fulcrum past the roller; no base, standards, foot pad or white index are drawn.',
  },
  375: {
    camera: [0, 0.01, 1],
    remove: ['fixed-foundation-beneath-annular-pan', 'lower-bearing-for-vertical-runner-shaft', 'white-index-.*'],
    note: 'Front elevation of the edge-runner mill: the two tall runners edge-on in the flared pan inside the rectangular standard, the large bevel wheel above it and the pinion on the right-hand upright; no foundation slab, lower bearing or white indices are drawn.',
  },
  376: {
    camera: [0, 0, 1],
    remove: ['fixed-bearing-standard-outside-wheel-cage-front', 'fixed-overhung-arm-carrying-wheel-bearing-front', 'fixed-base-rail-for-treadwheel-frame-front', 'fixed-side-bearing-for-treadwheel-axle-front', 'white-index-.*'],
    note: 'Face view of the treadwheel: the riveted rim, the square lattice of crossing bars round the sectioned axle and the horse walking inside; no white index is drawn. Brown draws no trestle; only the rear bearing standard and its base rail are kept, behind the wheel, so the axle does not float (the front frame would cover the face view).',
  },
  377: {
    camera: [1, 0.02, 0.62],
    remove: ['fixed-treadmill-foundation', 'fixed-hand-rail-support', 'white-index-.*'],
    note: 'Level side view of the treadmill (Brown mixes an end view of the wheel with a side view of the drum; the camera sits between, nearer the side): the notched spur wheel on the near end of the axle behind its flared A-frame standard on a plank, the long diagonal side bar in front, and the drum running off to the right with the man, back to the viewer, stepping up its boards and holding the rail before him; no foundation slab, rail posts or white index are drawn.',
  },
  378: {
    camera: [0.05, 0.08, 1],
    remove: ['common-fixed-foundation-rail', 'pendulum-a-frame-base', 'white-pendulum-angle-index'],
    note: 'Front elevation of the pendulum on its A-frame, the saw frame hung in its guides between the footed posts, and the log; the ground line alone carries the feet, so no foundation rails, A-frame base or white index are drawn.',
  },
  379: {
    remove: ['white-drill-spindle-rotation-index', 'white-feed-screw-rotation-index'],
    note: 'Side elevation of the C-frame with the drill spindle and its crank handle above and the opposed feed screw, rest and two-ball tommy bar below; no white indices are drawn.',
  },
  381: {
    camera: [-0.5, 1.9, 0.85],
    remove: ['white-.*', 'workpiece-longitudinal-grain-line'],
    note: "Brown's two figures (transverse section above, plan below) are two views of one clamp; the model builds it once and looks down on it from above its throat end, so the end section (bed, flush dovetailed cheeks and wedges, board on edge between them) and the plan of the cheeks diverging from the throat with the wedges driven along them both read. The white datums and grain lines are not drawn.",
  },
  382: {
    remove: ['white-stem-height-and-yaw-index', 'white-mirror-orientation-index'],
    note: 'The broad rounded mirror frame on its hinge and stem above the turned baluster pillar and stepped foot; no white indices are drawn.',
  },
  383: {
    remove: ['white-winding-roll-rotation-index', 'white-dressing-cylinder-rotation-index', 'moving-transverse-cloth-material-registration-stripe'],
    note: 'End elevation of the broad arched strap frame with its crossbars, the two winding rolls and the brush cylinder between them, the cloth running on its S path; no white indices or cloth stripes are drawn.',
  },
  384: {
    camera: [0, 0.36, 1],
    remove: ['stationary-drawing-and-transfer-paper', 'white-wheel-spin-index-on-(?:near-face|tread)', 'stationary-reference-index'],
    note: 'Side view (raised about 20° so the arm still reads when it turns toward the viewer) of the point, screw-threaded arm and small milled wheel, framed on the arm\'s whole sweep round the point; no paper or white indices are drawn.',
  },
  385: {
    remove: ['fixed-vertical-door-jamb', 'fixed-door-frame-lintel', 'one-of-four-door-face-trim-bars', 'door-opening-handle', '(frame|door)-side-white-pin-turn-index', 'white-toggle-height-index', 'white-weight-height-index'],
    note: 'The two long upright pins, the toggle links and the small pear weight hung from the apex. Brown crops the pins; their sockets stand on bored blocks on the door top and on the wall beside the opening, and the door hangs on plain knuckle hinges. No lintel, jamb, trim, handle or white indices are drawn.',
  },
  387: {
    note: 'Side elevation of both of Brown\'s figures: the wharf ladder level at high water above and inclined to the boat at low water below (a display copy half a tide cycle out of phase); the factory omits the undrawn white rail and tread indices.',
  },
  388: {
    remove: ['white-.*'],
    note: 'The smooth and toothed rollers and the board between them, seen in section through the shafts: the near bearings are cut away, and the rollers run in the far bearing blocks on arms from a standard behind. No white indices are drawn.',
  },
  389: {
    remove: ['white-.*', 'fixed-front-rack-guide-strap', 'wide-jack-foot'],
    note: 'Section of the cast jack stand, flaring into stepped feet either side of the rack, with the eccentric strap pawl and upper stop; the white indices, the front rack straps cut away by the section and the sole plate are not drawn. The eccentric shaft and stop-pawl pin run in bearing bosses carried by a rear spine and bridges from the stand, kept behind the rack and pawls so the default view still reads as the plate.',
  },
  390: {
    remove: ['fixed-rocker-pivot-frame-side', 'white-.*', 'piece-A-rigid-radial-web', '.*-fixed-material-marker'],
    note: 'The semicircular piece A on fulcrum a, flywheel B and bands C, D. One plain upright behind the flywheel on a small foot carries the flywheel shaft and the fixed fulcrum pin; no web inside A, band markers or white indices are drawn.',
  },
  391: {
    remove: ['fixed-frame-carrying-guide-grooves-and-output-bearing', '(?:.*-)?white-.*', 'reciprocating-input-piston-rod'],
    note: 'The D-shaped guides b, racks A, A1 on their weighted crosshead, cog wheel and elbow lever C; no frame, input rod or white indices are drawn.',
  },
  392: {
    remove: ['fixed-gig-saw-machine-bed', 'white-.*'],
    note: 'The saw, its guides and table, the crank wheel and the spring; no machine bed or white index is drawn.',
  },
  393: {
    remove: ['white-.*', 'fixed-overhead-bearing-standard', 'fixed-overhead-shaft-bearing-arm', 'fixed-bearing-around-upright-rotating-shaft'],
    note: 'The upright spindle and its head, bent carrier, ball joint and cup on the lens, which rests on the table plank; no overhead standard or bearing is drawn.',
  },
  394: {
    remove: ['fixed-Parsons-device-machine-bed', 'fixed-central-pinion-bearing-standard', 'connected-input-guide-support', 'fixed-guide-for-reciprocating-input-rod', 'white-.*', 'finite-open-flange-guide-(?:working-wall|mouth)', 'guide-wall-to-rack-attachment', 'guide-attachment-spacer-outside-pinion-sweep', 'fixed-back-bar-carrying-pinion-shaft-and-rod-guide', 'fixed-bored-boss-for-pinion-shaft-rear-end', 'fixed-slotted-rod-guide-on-back-bar', 'fixed-back-bar-pillar', 'fixed-back-bar-foot'],
    note: 'The endless rack, flanged pinion and the rod with its end collar; no bed, standards, rod guide or white indices are drawn. The flange-guide walls (Brown\'s side grooves, hidden in his face view) and their attachments are not shown: they drew a black D-loop and bar inside the rack that the plate lacks.',
  },
  396: {
    remove: ['fixed-watch-escapement-base', 'rear-watch-plate-bearing-standard', 'white-.*'],
    note: 'The wheel A, plain-rimmed balance B, straight lever C with its crook d and banking pins l; no watch plate base or white indices are drawn.',
  },
  397: {
    remove: ['white-.*', 'fixed-machine-base', 'fixed-horizontal-shuttle-guide-rail'],
    note: 'The flat shuttle bar, its link, the slotted S-rocker on its foot pivot and the crank; no machine base or guide rails are drawn.',
  },
  398: {
    remove: ['fixed-mechanism-bearing-support', 'fixed-base-for-cam-guides-and-output-shaft', 'white-.*'],
    note: 'The cam C, crosshead in its guide and the plain output disc with its crank; no base, supports or white indices are drawn.',
  },
  386: {
    camera: [0.08, 0.05, 1],
    remove: ['white-.*', 'closed-round-pole-cross-section-reference-ring'],
    note: 'Front elevation of the open ladder, Brown\'s principal (left) figure; his partly open and closed figures are later phases of the same fold cycle. The white indices and brass section ring are not drawn.',
  },
  395: {
    camera: [0, 0.02, 1],
    remove: ['white-.*', '.*-fixed-external-port-pipe', 'explanatory-fixed-pipe-flow-indices', 'passage-[AB]-flow-direction-index', 'plug-operating-stem', 'quarter-turn-operating-handle', 'fixed-ninety-degree-handle-travel-reference'],
    note: 'Brown\'s two sections of the plug in its bored body, the upper figure and, below left, the same cock a quarter turn clockwise; steam enters at the top, the cylinder ports are right and left and the exhaust is below. No pipes, handle or flow markers are drawn.',
  },
  400: {
    camera: [0, 0.08, 1],
    remove: ['fixed-four-motion-feed-base', 'fixed-camshaft-bearing-support', 'bored-fixed-camshaft-bearing', 'fixed-work-plate-(?:left|right)-of-feed-dog-slot', 'fixed-horizontal-guide-for-carrier-A', 'white-.*', 'fixed-back-bar-pillar', 'fixed-back-bar-foot', 'fixed-bored-camshaft-pedestal', 'fixed-camshaft-pedestal-foot'],
    note: 'Side elevation of the forked bar A running out to the feeder, B\'s toothed end beyond it, the thin cam C on its long bare shaft and the return spring; no base, bearings or their supports, work plate, guides or white indices are drawn.',
  },
  401: {
    remove: ['fixed-floor-base', 'fixed-wheel-shaft-standard', 'fixed-treadle-pivot-standard', 'fixed-standard-cradling-faceplate-shaft-bearing', 'fixed-faceplate-standard-foot', 'fixed-pedestal-cradling-treadle-fulcrum-bearing', 'fixed-treadle-pedestal-foot'],
    note: 'The faceplate wheel, tangent slide A, B, pitman and treadle; no floor or standards are drawn.',
  },
  402: {
    remove: ['fixed-rear-bearing-frame-bar-\\d', '.*-white-balance-angular-index', 'white-escape-wheel-angular-index', '.*-balance-spoke-[23]', 'escape-wheel-spoke-\\d', 'visible-active-escape-tooth-pallet-contact'],
    note: 'Face view of the two open balance rims, each joined to its arbor by one slim two-armed bar as in a watch balance, crossing so both racks show, with their pinions, the lever B carrying both toothed sectors and anchor A, and the escape wheel; no frame bars or white indices are drawn.',
  },
  403: {
    remove: ['(?:left|right)-sloping-rule-guided-by-(?:left|right)-chord-pin-end-index-[12]', '(?:left|right)-sloping-rule-guided-by-(?:left|right)-chord-pin-pin-contact-working-edge', 'laid-out-(?:chord-line|versed-sine)', '(?:left|right)-fixed-chord-end-guide-pin-white-cap'],
    note: 'The two sloping rules crossed at the pencil and braced by the third rule, sliding against the two pins at the chord ends, which stand in a plain drawing board carrying the traced arc; no end indices, painted working edges, white pin caps or laid-out chord and versed-sine construction lines are drawn.',
  },
  404: {
    remove: ['(?:left|right)-white-roller-angular-index', 'white-screw-handwheel-angular-index', 'given-required-arc-point-[123]'],
    note: 'The straight bar with its two end standards and rollers, the elastic arched bar and the central screw with its thumb grip; no index marks or given points are drawn.',
  },
  405: {
    remove: ['rule-distance-index-\\d+', '(?:upper-focus-rule-pivot|lower-focus-fixed-thread-loop-pin)-white-center-index', 'given-(?:upper|lower)-hyperbola-vertex'],
    note: 'The rule pivoted at the upper focus, the thread from its free end round the pencil to the lower focus, and both branches traced on a plain drawing board in which the focus pins stand; Brown\'s dotted axes are notation and are not drawn, nor are rule graduations, centre indices or vertex points.',
  },
  406: {
    remove: ['fixed-drawing-board-presentational-support-not-source-hardware', 'fixed-drawing-board-border', 'square-blade-distance-index-\\d+', 'white-focus-center-index', 'given-(?:base-endpoint-[12]|parabola-vertex)', 'given-parabola-base-chord', 'dashed-parabola-axis-parallel-to-square-blade'],
    note: 'The straightedge, square, thread and pencil describing the parabola on a plain drawing board (the pencil point, focus pin, straightedge and stock stand on it); no bordered board, directrix edge stripe, base chord, dashed axis, blade graduations or given points are drawn.',
  },
  407: {
    remove: ['fixed-drawing-board-presentational-support-not-source-hardware', 'fixed-drawing-board-border', 'mirrored-right-jamb-reference-for-complete-arch', 'mirrored-right-half-completing-pointed-arch', 'given-right-springing-point', 'given-left-springing-point', 'given-pointed-arch-apex', 'white-upper-edge-of-horizontal-bar-on-springing-line', 'white-slide-position-index', 'upper-working-edge-tangent-to-jamb-and-meeting-apex'],
    note: 'The slotted bar, elastic bar, cord and the half-arch it draws; no drawing board, mirrored half, construction points, edge lines or slide index are drawn.',
  },
  408: {
    remove: ['blade-distance-index-\\d+', 'white-moving-joint-center-index', '(?:upper|lower)-fixed-board-pin-white-axis-index', 'drawing-edge-and-visible-extension-toward-off-board-vanishing-point'],
    note: 'The centrolinead head with its two set legs and long blade against the two board pins; no blade graduations, centre indices or painted drawing-edge stripe are drawn.',
  },
  409: {
    remove: ['white-common-pivot-center-index', '(?:major|minor)-proportion-scale-graduation'],
    note: 'The two slotted legs crossed at the sliding pivot with its set screw; no point indices, span witnesses or painted graduation ticks are shown.',
  },
  411: {
    remove: ['ground-travel-index-\\d+', '(?:left-ground-driven|right-no-slip)-survey-wheel-white-no-slip-rotation-index', '(?:major|minor)-(?:axial|circumferential)-paper-section-ruling', 'white-pendulum-axis-index'],
    note: 'Elevation of the arched carriage on its two spoked wheels with the pendulum, the recording drum and the push handle on the ground line; no travel ticks, wheel indices, pivot dot or ruled paper grid are drawn.',
  },
  413: {
    camera: [-0.12, 0.04, 1],
    remove: ['fixed-two-shaft-friction-gear-frame'],
    note: 'Edge-on elevation of the adjustable wheel A (in section in the plate) with nut B on its bolt, over the V-grooved wheel with its hub nut and crank handle, both shafts running off to the right; no frame is drawn.',
  },
  414: {
    remove: ['white-input-shaft-rotation-index'],
    note: 'Face view of scroll plate A with the sliding pinion B on its feathered shaft; no shaft index is drawn.',
  },
  415: {
    remove: ['fixed-coaxial-wheel-and-lever-bearing-frame', 'wheel-D-spoke-fast-with-rim-and-hub', 'white-wheel-D-intermittent-rotation-index', 'white-lever-A-oscillation-index', 'selectable-(?:left-pawl-B|right-pawl-C)-white-rim-contact-index', 'white-input-slider-joint-index'],
    note: 'The plain disc wheel D, lever A with its pawls B and C and crank E, and the rod D running off to the right to the slider that drives it in its guide, just beyond Brown\'s crop; no frame, spokes or white indices are drawn.',
  },
  416: {
    camera: [0.2, 0.06, 1],
    note: 'Near-face elevation of the plain flywheel disc and crank B, helical spring A between its fixed stud and the crank pin, the pitman and the slim treadle bar. Brown draws no frame; the plain slab and slim standards carrying the crankshaft, the treadle pivot and the spring stud stay behind the parts they carry.',
  },
  418: {
    remove: ['fixed-slide-valve-foundation'],
    note: 'Section of the conical casing on the chest cover with its recess, the suspended guide D on its adjusting screw, valve A, rod B and roller C; valve A slides on its one seat plate over the port, with no second foundation slab.',
  },
  419: {
    remove: ['representative-cradle-body-on-rocker-E'],
    note: 'Front elevation of the plain discs B and A with the crank link, the bands from posts C and D over B, and rocker E on the hatched floor line; no cradle body block is drawn. Brown draws no support for the A and B axles; a slim grounded standard behind the discs carries both, clear of the rocking frame.',
  },
  420: {
    camera: [0.08, 0.02, 1],
    note: 'Side elevation of the hammer on its bracket with the under-lever return spring on the plank, the bell hanging by its canon loop on a pin carried by a slim post and overhead arm behind it (Brown draws no support; the post stands on its own foot beyond the plank).',
  },
  421: {
    remove: ['marine-trunk-engine-foundation', 'rear-crankshaft-support-column', 'rear-crankshaft-bearing-arm', 'high-pressure-upper-annular-chamber-indicator', 'lower-expansive-exhaust-chamber-indicator'],
    note: 'The sectioned cylinder, trunk piston, pitman and crank; Brown\'s dotted crank-pin circle is notation and is not drawn, nor are the foundation, crank supports or steam tints.',
  },
  422: {
    remove: ['fixed-foundation-of-sector-cylinder-A', '(?:counter)?clockwise-steam-passage-from-D-to-A', '(?:counter)?clockwise-chamber-admission-indicator', 'white-valve-D-position-index', 'cutaway-back-of-sector-steam-space'],
    note: 'Section of the vase-shaped casing A with its side passages, foot and the boss of rock shaft C, the sector chamber with piston B, and slide valve D in its chest above; no bed plate, loose pipes or steam markers are drawn.',
  },
  423: {
    remove: ['left-fixed-cylinder-frame', 'right-fixed-cylinder-frame', '(?:top|bottom)-outer-side-induction-opening-indicator', 'cutaway-(?:top|bottom)-outer-steam-space', 'common-central-exhaust-space-between-the-two-pistons'],
    note: 'Section of Root\'s double-quadrant engine: the closed cast casing on its foot enclosing both quadrant chambers, the two pistons B on their pivots, the common crank D and valve a; Brown\'s dotted circle round D is notation and is not drawn, nor are legs, steam tints or steam markers.',
  },
  424: {
    camera: [0, 0, 1],
    remove: ['fixed-foundation-of-square-piston-engine', '(?:left|right)-B-port-admission-indicator', '(?:top|bottom)-C-port-admission-indicator'],
    note: 'Flat elevation of the oblong cylinder A with the sliding frame piston B, the nested piston C and crank wrist a on shaft b (Brown\'s dotted wrist path is not drawn); no bed plate or steam markers are drawn.',
  },
  425: {
    camera: [0.08, 0.05, 1],
    remove: ['visible-center-marker-of-eccentric-piston-C', 'instantaneous-sealing-contact-between-C-and-D', 'right-to-chamber-induction-flow-indicator', 'chamber-to-left-eduction-flow-indicator', 'right-induction-port', 'left-eduction-port'],
    note: 'Front elevation of the casing with its two port necks and the abutment guide, eccentric piston C on shaft B and abutment D, as Brown draws it; no centre or contact markers or flow spheres are drawn.',
  },
  426: {
    camera: [0.08, 0.05, 1],
    remove: ['(?:positive|negative)-piston-A-motion-marker', 'simultaneous-steam-action-indicator-on-(?:positive|negative)-piston-A', '(?:induction|eduction)-arrow-side-indicator'],
    note: 'Front elevation of the casing on its cast foot, drum B and the diametral pistons A standing upright against the casing wall, as Brown draws them; no bed slab, motion markers or steam spheres are drawn.',
  },
  427: {
    camera: [0.08, 0.05, 1],
    remove: ['(?:left|right)-orbit-piston-A-angle-marker', '(?:left|right)-orbit-packing-orientation-marker', '(?:induction|eduction)-flow-arrow-indicator'],
    note: 'Front elevation of the casing on its cast foot, drum B and pivoted pistons a, as Brown draws it; no bed slab, rotation markers or flow spheres are drawn.',
  },
  428: {
    camera: [0.08, 0.05, 1],
    remove: ['visible-spin-marker-on-roller-A-[123]', 'fixed-angular-material-witness-on-liner-E-\\d+', '(?:induction|eduction)-steam-path-indicator', 'illustrative-(?:high-pressure-steam|eduction-region)-outside-flexible-liner'],
    note: 'Front elevation of the round casing filleted into its two open port necks and standing on its cast foot, arms B and rollers A, as Brown draws it; no bed slab, spin markers, liner witnesses or steam tints are drawn.',
  },
  429: {
    camera: [0.08, 0.05, 1],
    remove: ['fixed-foundation-of-Holly-rotary-engine', 'downward-(?:induction|eduction)-steam-arrow-region', '(?:left|right)-.*-radial-packing-strip-\\d+'],
    note: 'Section of the one-piece two-lobed casing (solid back cover, cut on the front plane) with its top induction and bottom eduction port channels and the toothed pistons, as Brown draws it; no stand, steam tints or painted packing marks are drawn.',
  },
  430: {
    camera: [0.08, 0.05, 1],
    remove: ['falling-feed-water-droplet-\\d+'],
    note: 'Side elevation of the overshot wheel under the headrace, in its masonry pit whose breast falls from the flume and curves close round the lower left of the wheel to the tail floor, as Brown draws it: a section through the pit, so the shaft runs back to one far bearing on a pedestal behind the race. No rotation marker is drawn. The feed pours as one sheet; no droplet beads ride it.',
  },
  431: {
    camera: [0.08, 0.05, 1],
    remove: ['bottom-stream-flow-marker-\\d+', 'submerged-paddle-impulse-indicator-[123]'],
    note: 'Side elevation of the undershot wheel, sluice and race, as Brown draws it; no flow beads or impulse dots are drawn. Brown draws no axle support; two slim pedestals beside the wheel carry the shaft bearings.',
  },
  432: {
    camera: [0.08, 0.05, 1],
    remove: ['breast-wheel-inlet-flow-marker-\\d+'],
    note: 'Side elevation of the breast wheel, sluice and race, as Brown draws it; no flow beads are drawn. Brown draws no axle support; two slim pedestals beside the wheel carry the shaft bearings.',
  },
  433: {
    camera: [0.6, 0.42, 1],
    remove: ['falling-jet-motion-marker-\\d+'],
    note: 'Raised side view of the flat-bladed runner on its hanging shaft, the open spout climbing out of the picture to the upper right and its spray striking the far blades, as Brown draws it; no floor disc, basin or jet beads.',
  },
  434: {
    camera: [0, 1, 0.12],
    remove: ['continuous-center-to-circumference-water-path-\\d+', 'outward-flow-marker-path-\\d+-particle-\\d+', 'circumferential-outward-water-discharge'],
    note: 'Plan of the turbine wheel A inside the guide ring B, as Brown draws it. Streamline tubes, flow particles and the hose-like discharge ring of the offline model are flow notation and are not presented.',
  },
  435: {
    camera: [0, 1, 0.12],
    remove: ['continuous-outer-guide-to-central-discharge-path-\\d+', 'inward-flow-marker-path-\\d+-particle-\\d+', 'circumferential-water-supply-to-fixed-outer-guides', 'water-discharging-downward-at-turbine-center'],
    note: 'Plan of the inner guides b and outer wheel a, as Brown draws it. Streamline tubes, flow particles and the hose-like supply ring of the offline model are flow notation and are not presented; nor is the ring of discharge water that hung free below the runner centre (Brown leaves the centre open).',
  },
  436: {
    camera: [0.04, 0.02, 1],
    remove: ['continuous-axial-flow-path-through-guide-a-and-runner-c-\\d+', 'downward-flow-marker-path-\\d+-particle-\\d+'],
    note: 'Sectional elevation of the case b under its top cover, the broad chute entering at upper right, wheel a and the step c on its bridge, as Brown draws it; no overhead beam, base disc or tailwater disc is drawn. Flow paths and particles are notation and are not presented.',
  },
  437: {
    camera: [0, 1, 0.12],
    remove: ['fixed-foundation-under-volute-wheel', 'fixed-upper-bearing-of-volute-wheel-shaft', 'bored-upper-bearing-crossbeam', 'upper-bearing-support-post', 'clockwise-volute-flow-marker-\\d+', 'lower-escape-flow-marker-path-\\d+-particle-\\d+'],
    note: 'Plan of the scroll case and wheel with its guides a and floats c, as Brown draws it; no foundation or upper bearing bridge is drawn. Flow markers are notation and are not presented; the volute water stays.',
  },
  438: {
    camera: [0.08, 0.05, 1],
    remove: ['visible-reaction-mill-shaft-rotation-marker', 'inlet-water-marker-\\d+', 'tangential-exhaust-marker-arm-\\d+-particle-\\d+'],
    note: "Elevation of the Barker's mill arms, hollow shaft and funnel, as Brown draws it; no white rotation marker is drawn. The arms throw continuous water jets; the flow beads of the offline model are not presented.",
  },
  439: {
    camera: [0.08, 0.05, 1],
    remove: ['visible-oscillating-pulley-rotation-marker', 'material-marker-moving-continuously-on-single-rope', 'continuous-fall-water-marker-\\d+'],
    note: 'The pulley, rope, bucket with its projecting valve stem, counterweight and water stream; no gallows frame, ground, striking anvil, white pulley stripe or rope marker is drawn. No flow beads in the falling stream.',
  },
  440: {
    camera: [0.2, 0.24, 1],
    remove: ['visible-trough-angle-index', 'fixed-(?:left|right)-trough-travel-stop', 'continuous-inlet-flow-marker-\\d+', 'fixed-post-carrying-upper-end-of-inlet-flume', 'fixed-sill-under-flume-post'],
    note: 'Nearly side-on view, a little from above, of the wedge-shaped double trough on its pivot standard, braces and open plank frame under the inlet spout; no angle index or travel-stop blocks are drawn. No flow beads in the falling stream.',
  },
  441: {
    camera: [0, 0.01, 1],
    remove: ['fixed-persian-wheel-base', 'fixed-stationary-trip-pin-bracket', 'fixed-trip-pin-support-post', 'fixed-pin-tilting-each-bucket-at-high-station', 'fixed-high-level-trough-receiving-tipped-bucket-water', 'fixed-outboard-receiver-standard', 'fixed-receiver-to-standard-bridge', 'rightward-driving-stream-marker-\\d+', 'inward-moving-float-water-marker-\\d+', 'visible-hollow-shaft-rotation-index'],
    note: 'Front elevation of the Persian wheel with its light rim, curved floats, hollow shaft and hung buckets over the stream; no base slab, trip pin or its post, trough or white current/rotation markers are drawn. Brown draws no axle support; the hollow shaft runs in two bearings on slim inclined standards standing on the stream bed.',
  },
  442: {
    camera: [1, 0.28, 0.30],
    remove: ['fixed-eisach-wheel-base', 'fixed-river-bed-under-pot-wheel', 'rightward-river-current-marker-\\d+', 'visible-pot-wheel-rotation-index'],
    note: 'Brown looks across the stream nearly along the wheel plane: the axle runs left to right on its trestles, the pots show between the rims and the trough runs off to the left over the ruled stream. No base slab, box bed, water box, current markers or rotation index are drawn.',
  },
  443: {
    camera: [-0.3, 0.5, 1],
    remove: ['fixed-archimedes-screw-base', 'fixed-stream-bed-around-lower-water-wheel', 'axial-driving-stream-marker-\\d+', 'visible-one-to-one-screw-rotation-index', 'fixed-oblique-bearing-support-\\d', 'finite-bearing-to-post-bridge-\\d', 'fixed-oblique-screw-bearing-\\d'],
    note: 'The oblique screw casing with its spiral passage, the solid paddle disc at its lower end in the ruled stream, the bracket holding the top of the shaft and the trough. Brown draws no base slab, bed box, posts, bearing collars round the casing, stream markers or rotation stripe.',
  },
  444: {
    camera: [0, 0.02, 1],
    remove: ['fixed-hydraulic-ram-base', 'drive-pipe-flow-marker-\\d+', 'uniform-output-flow-marker-\\d+', 'air-chamber-charge-marker-\\d+'],
    note: 'Sectional elevation of the supply, air vessel and jet, as Brown draws it; no base slab or white flow markers are drawn. No air-charge markers.',
  },
  445: {
    remove: ['descending-flow-tracer', 'rising-column-tracer', 'lower-discharge-flow-tracer'],
    note: 'Section of the supply channel, the upper box and orifice, the waisted falling stream spreading over the plate on its stem and the sheet falling into the lower box; Brown hatches the water and draws no tracer beads.',
  },
  446: {
    remove: ['descending-flow-tracer', 'rising-column-tracer', 'lower-discharge-flow-tracer'],
    note: 'The same section with the concave checked cone rising from the plate into the orifice and the raised column spraying in the upper box; no tracer beads are drawn.',
  },
  448: {
    remove: ['through-bucket-flow-tracer'],
    note: 'No flow tracer beads are presented.',
  },
  450: {
    remove: ['forced-delivery-flow-tracer'],
    note: 'No flow tracer beads are presented in the delivery pipe.',
  },
  451: {
    remove: ['pulsed-air-chamber-inlet-tracer', 'constant-selected-outlet-tracer'],
    note: 'No flow tracer beads are presented.',
  },
  452: {
    camera: [0.08, 0.05, 1],
    remove: ['fixed-double-acting-pump-foundation'],
    note: 'Sectional elevation of the double-acting cylinder, passages and valves 1–4; no foundation is drawn.',
  },
  453: {
    camera: [0.08, 0.05, 1],
    remove: ['fixed-double-bellows-pump-foundation'],
    note: 'Elevation of the two lantern bellows, valve chest and rocking beam; no foundation is drawn.',
  },
  454: {
    camera: [0.08, 0.05, 1],
    remove: ['fixed-diaphragm-pump-foundation'],
    note: 'Sectional elevation of the diaphragm chamber, valves and hand lever; no foundation is drawn.',
  },
  455: {
    camera: [0, 0.01, 1],
    remove: ['fixed-old-rotary-pump-foundation', 'fixed-casing-foot-not-drawn-by-brown', 'white-rotor-rotation-index'],
    note: 'Sectional elevation of the casing, folding valves and apertures; no foundation, feet or white rotor index is drawn.',
  },
  456: {
    camera: [0, 0.01, 1],
    remove: ['fixed-cary-pump-foundation', 'fixed-casing-foot-not-drawn-by-brown', 'white-rotor-rotation-index'],
    note: 'Sectional elevation of the cylinder, heart cam a, sliders and pipes F, H; no foundation, feet or white axle index is drawn.',
  },
  459: {
    camera: [0, 0.03, 1],
    remove: ['fixed-foundation-of-reciprocating-well-lift', 'fixed-side-post-of-well-frame', 'fixed-top-beam-of-well-frame'],
    note: 'Flat elevation: the horizontal wind wheel edge-on as a vaned band, the coupling, the worm between the two pinned star wheels, the ropes, the tipping bucket, the central tappet block and the well curbs; no gallows frame or base slab is drawn.',
  },
  461: {
    camera: [0, 0.02, 1],
    remove: ['fixed-foundation-below-swinging-gutter-water-lift'],
    note: 'Elevation of the serpentine swinging gutters, drawn as slender pipes with elbow boxes, over the ruled water they dip into; no foundation slab or water block is drawn.',
  },
  462: {
    note: 'The chain wheels, disks, pipe and spout, with two plain posts behind the chain standing in the reservoir and carrying both wheel axles.',
  },
  463: {
    remove: ['(?:upper|lower)-leaf-transverse-reinforcement-\\d'],
    note: 'The two hinged leaves of the weir as plain planks, as Brown draws them in section; no dark straps across their faces.',
  },
  464: {
    remove: ['external-water-pour-into-open-upper-basin'],
    note: 'Sectional elevation of the open basin on its two legs, the bowl in its air chamber, the pipes and the central nozzle throwing a plume of spray; Brown draws no stream being poured into the basin.',
  },
  465: {
    remove: ['left-operator-pressure-pad', 'right-operator-pressure-pad'],
    note: 'Diagonal balance beam on its platform over the two pumps in the well between two masonry banks, its water ruled, with Brown\'s man standing astride the pivot and holding the hand-bar carried on the beam; no pressure pads, foundation slab or water box are drawn.',
  },
  466: {
    camera: [0, 0.03, 1],
    remove: ['fixed-foundation-under-hydrostatic-press-and-hand-pump', 'modeled-relief-return-valve-for-lowering-press', 'active-return-water-from-relief-valve-to-reservoir'],
    note: 'Sectional elevation of the press, ram cylinder, pipe, hand pump and open reservoir, the reservoir standing on the ground beside the press; no foundation slab or relief valve is drawn.',
  },
  467: {
    camera: [0, 0.02, 1],
    remove: ['fixed-ground-plate-under-robertson-jack'],
    note: 'Sectional elevation of the narrow jack: small hollow base, ram with the pump in its foot, rising cylinder with cupped head and claw, and the lever on its two eyes at the lower left; no ground plate is drawn.',
  },
  468: {
    camera: [0.015, 0.012, 1],
    remove: ['plate-.*-crossed-tie-end-mark'],
    note: 'Brown\'s X-in-box section marks on the tie ends are notation and are not painted on the logs. Brown gives two figures of one ball-and-socket joint between log frames: a sectional elevation, flexed as the frames follow the bed, above a plan. The default view shows the same two figures face-on; both reproduce the front main\'s middle joint of the analytic crossing, which the factory keeps hidden (with its banks, winches and river strips) because the plate does not draw it.',
  },
  469: {
    camera: [0, 0.02, 1],
    remove: ['cold-bath-thermometer', 'warm-bath-thermometer'],
    note: 'Sectional elevation of the two tanks, wheel and pipe, as Brown draws it; no thermometers are drawn.',
  },
  474: {
    camera: [6.8, 2.0, 9.4],
    remove: ['fixed-hearth-ring-below-boiler', 'fixed-fire-flame-\\d-of-seven', 'fixed-aeolipile-foundation', 'visible-globe-rotation-marker-\\d', 'steam-feed-\\d-marker-\\d+', 'exhaust-\\d-marker-\\d+', 'quasi-steady-tangential-steam-plume-\\d-of-four'],
    note: 'The boiler on its legs, the plumb hollow risers standing inside the wide lidded rim and the revolving sphere, seen from a little above the lid as Brown draws it; no hearth, fire, foundation, white steam beads or steam plumes are drawn.',
  },
  475: {
    remove: ['bilge-water-source-at-foot-of-B', 'stationary-bilge-well-surrounding-suction-B', 'steam-flow-inside-pipe-A-to-nozzle', 'free-primary-steam-jet-entraining-water-upward', 'continuous-bilge-water-stream-\\d-of-four-B-through-D-to-C', 'steam-A-marker-\\d+', 'water-B-to-C-path-\\d-marker-\\d+'],
    note: 'The ejector body D, pipes B, C and steam jet A; no bilge well is drawn. The running water fills B, D and C; the streamline tubes, steam core and flow markers of the offline model are flow notation and are not presented.',
  },
  476: {
    remove: ['fixed-water-source-basin-under-two-B-mouths', 'water-surface-feeding-both-suction-branches', 'steam-inside-A-to-unobstructed-central-nozzle', 'upward-steam-jet-on-centerline-of-C', 'unbroken-water-current-\\d-of-four-through-B-fork-C', 'steam-A-marker-\\d+', 'water-path-\\d-marker-\\d+'],
    note: 'The forked ejector B, C and steam pipe A as opaque round pipes (Brown dashes A where it runs behind B); no water basin or surface is drawn. The streamline tubes, steam core and flow markers of the offline model are flow notation and are not presented.',
  },
  473: {
    remove: ['water-sealed-air-pump-foundation'],
    plainRims: [['submerged-open-bell-rim-water-seal', 'front-cutaway-inverted-bell-shell']],
    note: 'Elevation of the frame on its two foot blocks, the crossed levers, ropes and the inverted tub in the larger tub with the water standing in it (Brown\'s dotted water line is not drawn); no base slab is drawn.',
  },
  477: {
    remove: ['condensate-path-\\d-marker-\\d', 'transparent-rear-wall-of-outer-box'],
    note: 'Flat section of the box with inlet A, outlet B, seat a a, hollow valve D and its diaphragm on the bridge; no flow beads or rear wall are drawn.',
  },
  478: {
    remove: ['condensate-path-\\d-marker-\\d', 'dynamic-condensate-guide-\\d-through-A-gap-C-outlet'],
    plainRims: [['front-cutaway-rim-of-sphere-C', 'fixed-hollow-sphere-C-surrounding-pipe-end-and-valve'],
      ['fixed-bottom-outlet-rim', 'fixed-bottom-outlet-from-sphere-C'],
      ['fixed-inlet-rim-of-A-at-anchor-side', 'expanding-outer-wall-of-pipe-A']],
    note: 'Section of pipe A clamped at B, sphere C, the plunger valve a and loaded elbow lever D with stop screw b; no flow beads or condensate guide lines are drawn.',
  },
  479: {
    remove: ['(?:inlet|outlet)-gas-marker-\\d+'],
    note: 'Section of bell A in tank B with the two pipes, and bands over the two pulleys to weights C; no flow beads are drawn.',
  },
  480: {
    remove: ['(?:right-inlet|left-outlet)-gas-marker-\\d+', 'fixed-base-securing-tube-b-to-tank'],
    note: 'Section of bell A in tank B on the central telescoping tubes a and b with the two pipes; tube b passes through the tank floor as Brown draws it. No flow beads are drawn.',
  },
  481: {
    remove: ['dial-work-registering-known-volume-per-drum-revolution', 'fixed-bottom-base-rail', 'visible-index-on-front-face-of-drum', 'central-inlet-gas-marker-\\d+'],
    note: 'End section of case A on its saddle, the drum compartments B and the turned-up pipe a; no register dial, base rail or drum index is drawn. No gas-flow beads.',
  },
  482: {
    remove: ['regulated-gas-flow-marker-\\d+'],
    note: 'Section of the regulator under its domed cover, cup H and valve D in their quicksilver channels, lever d and inlet E; no flow beads are drawn. The separate view of valve D is not modelled.',
  },
  483: {
    remove: ['fixed-dial-work-register-housing', 'register-dial-\\d-.*', 'moving-pointer-of-register-dial-\\d', 'tick-\\d-of-register-dial-\\d', 'fill-count-input-wheel-driving-dial-work', '(?:inletToA|inletToAPrime|AToOutlet|APrimeToOutlet)-gas-marker-\\d+'],
    note: 'Section of the meter with the two bellows chambers A, A′ and the slide valve B; the dial-work the caption mentions is not drawn. No gas-flow beads.',
  },
  484: {
    remove: ['white-index-marker-rigidly-fixed-to-helical-ribbon', 'rigid-load-wheel-on-output-shaft', 'axial-current-marker-path-\\d-\\d', 'fixed-positive-x-current-direction-arrow-\\d'],
    note: 'The cylinder with its single spiral between two plain posts; no load wheel, current arrows, beads or index are drawn.',
  },
  485: {
    remove: ['axial-wind-marker-path-\\d+-\\d+', 'white-index-marker-fixed-to-first-sail', 'white-windshaft-rotation-index', 'fixed-negative-z-wind-direction-arrow-\\d-(?:shaft|head)'],
    note: 'The tower seen from its door side with the cap turned so the four lattice sails stand obliquely to the left and the large tail vane trails to the right; no wind arrows, beads or indices are drawn.',
  },
  486: {
    remove: ['negative-z-wind-marker-path-\\d+-\\d', '(?:front|back)-face-index-of-pivoted-sail-\\d', 'white-index-fixed-to-first-radial-arm', 'fixed-negative-z-plan-wind-arrow-\\d-(?:shaft|head)', 'fixed-plan-reference-circle-through-sail-pivots'],
    note: 'Plan of the six arms with their pivoted sails. Brown\'s wind arrow and the circle through the sail pivots are notation (the wind and the sail track), not parts, so neither is modelled; no beads or indices either.',
  },
  490: {
    remove: ['(?:upper|lower)-guide-sheave-white-index', 'white-handwheel-and-barrel-index'],
    note: 'Plan of the wheel edge-on with its handles, the barrel, the two guide pulleys and the tiller; no rope beads or indices are drawn.',
  },
  493: {
    remove: ['central-to-packing-contact-index-\\d', '(?:left|right)-wall-contact-index', 'fixed-overhead-hoist-eye', 'white-index-of-upward-hoist-direction', 'white-upward-hoist-index-shaft'],
    note: 'Section of the stone with the lewis in its hole and the shackle on the rope; no hoist eye, arrow or contact indices are drawn.',
  },
  498: {
    remove: ['fixed-gauge-support-base', 'fixed-gauge-back-support', 'bored-glass-retaining-clip', 'clip-tab-to-scale-board', 'equal-level-zero-datum-across-both-legs', 'live-reading-index-at-right-mercury-surface'],
    note: 'The bent tube, its mercury, the scale marks beside the open leg and the cocked pipe from the boiler, its flange bolted to the boiler head just beyond Brown\'s crop; no base, post, datum bar or pointer is drawn. The marks sit on a plain scale board carried by two bands round the open leg, so they neither float nor read mirrored from behind.',
  },
  487: {
    remove: ['fixed-bearing-A-frame-\\d-leg-(left|right)', 'fixed-bearing-base-rail-\\d', 'fixed-water-volume-intersecting-lower-paddles', 'fixed-waterline-plane', 'fixed-backward-water-path-\\d', 'backward-water-marker-\\d-\\d', 'fixed-(?:negative-x-backward-water-direction|positive-x-forward-vessel-thrust)-arrow', 'white-shaft-rotation-index', 'white-index-fixed-to-first-paddle'],
    note: 'The paddle wheel and its radial paddles; no trestles, base, water, flow arrows, water beads or white indices are drawn.',
  },
  488: {
    remove: ['fixed-bearing-pedestal-(1|2)', 'fixed-propeller-demonstration-base', 'fixed-water-volume-around-screw-propeller', 'fixed-axial-helical-wake-path-\\d', 'fixed-propeller-shaft-bearing-\\d', 'negative-x-wake-marker-\\d+-\\d+', 'fixed-(?:positive-x-vessel-thrust|negative-x-accelerated-water)-arrow-(?:shaft|head)', 'white-index-fixed-to-first-helicoid-blade', 'white-rotation-index-fixed-to-shaft'],
    note: 'The screw propeller on its shaft; no pedestals, bearings, base, water, arrows or indices are drawn.',
  },
  489: {
    camera: [0.05, 0.05, 1],
    remove: ['fixed-main-bearing-support-leg-(left|right)', 'fixed-feathering-wheel-base', 'fixed-water-volume-under-feathering-buckets', 'fixed-waterline-crossed-edgewise-by-upright-buckets', 'fixed-negative-x-feathering-wheel-wake-path-\\d', 'negative-x-water-marker-\\d-\\d', 'fixed-(?:negative-x-water-reaction|positive-x-vessel-thrust)-arrow', 'white-index-on-fixed-eccentric-center', 'white-index-fixed-to-main-shaft', 'white-index-fixed-to-control-ring-d'],
    note: 'Front elevation of the feathering wheel, eccentric e, ring d and cranks c; no stand, base, water, flow arrows or white indices are drawn.',
  },
  491: {
    camera: [0.02, 0.04, 1],
    remove: ['white-pawl-tip-contact-marker', 'white-rotation-index-on-capstan-head', 'fixed-circular-base-plinth', 'fixed-wide-capstan-base-foot'],
    note: 'Side elevation of the capstan, pawl and bars with the ratchet on the ground line, as Brown draws it; no plinth, cable beads or indices are drawn.',
  },
  492: {
    remove: ['fixed-boat-deck-carrying-fore-and-aft-standards', 'fixed-boat-side-rail-(1|2)', 'boat-detaching-apparatus-2', 'release-rope-attached-to-lower-lever-2', 'release-rope-lead-beyond-plate-2', 'fixed-release-rope-lead-sheave-and-toggle-2', 'reconstructed-common-crossbar-pulling-both-release-ropes', 'common-pull-grip-for-one-operator', 'white-index-showing-release-pull-direction', 'white-lever-fulcrum-index-\\d'],
    note: 'One disengaging hook, its tongue and eye lever on the threaded standard, the release rope running off to the right over a lead sheave to a hanging toggle beyond the plate; no second end unit, common pull bar, boat deck or rails are drawn.',
  },
  494: {
    remove: ['white-rhombus-pivot-index-\\d', '(?:left|right)-white-bite-contact-index'],
    note: 'The tongs, their two links and the common shackle, the points biting into small sockets in the stone; no pivot or contact index dots are drawn.',
  },
  496: {
    remove: ['fixed-throstle-bed', 'fixed-drawing-roll-bearing-standard', 'fixed-bearing-for-drawing-roll', 'roll-bearing-bridge', '(?:upper|lower)-(?:back|front)-drawing-roll-[AB]-visible-index'],
    note: 'Side elevation of the plain drawing rolls A, B in section and the flyer spindle with its inverted-U flyer and bobbin; no bed, standards, roll bearings or roll indices are drawn.',
  },
  497: {
    remove: ['arc-length-sampled-intake-radial-discharge-air-particle', 'visible-impeller-rotation-index'],
    plainRims: [['(?:rear|front)-circular-air-inlet-rim', 'rear-volute-side-with-circular-inlet-opening']],
    note: 'Section of the scroll casing, curved-blade fan and hub; Brown draws no air beads or white hub index.',
  },
  501: {
    remove: ['fixed-barometer-support-base', 'fixed-barometer-back-support', 'bored-glass-retaining-clip', 'scale-board-bracket(?:-tab)?', 'inch-scale-label-\\d+', 'atmospheric-pressure-arrow-\\d', 'live-inch-reading-index-at-long-column-meniscus'],
    note: 'The bent tube with its mercury and the inch marks at the top of the long leg; no stand, backboard, clips, numerals, pressure arrows or pointer is drawn. The marks sit on a narrow scale board held to the long leg by a band, so they do not float.',
  },
  502: {
    hideWhiteMarks: true,
    note: 'The fixed wheel A, the loose wheel D and the arm C carrying the compound E, F and the wheel B; Brown draws no index marks on the wheels.',
  },
  503: {
    hideWhiteMarks: true,
    remove: ['white-arm-F-G-angular-speed-index', 'white-shaft-A-index-rigid-with-carrier-F-G'],
    note: 'Elevation of the bevel wheels C, D on shaft A, the block F carrying the stub axle and wheel B, and the head G; Brown draws no index marks.',
  },
  504: {
    camera: [0, 0, 1],
    hideWhiteMarks: true,
    note: 'Pure side elevation of the wheels A, B, the pinions E, F, G and the arm C-D as Brown draws it, framed on the arm\'s whole turn about A (which sweeps B and the pinions out to either side, so the train fills only part of that width). No index stripes or painted index teeth are drawn.',
  },
  505: {
    hideWhiteMarks: true,
    note: 'The sun A, the pinion B on arm D and the fixed annulus; Brown draws no index marks on the wheels or arm.',
  },
  506: {
    hideWhiteMarks: true,
    note: 'The bevel wheels a, h on shaft A, the loose compounds b-c and f-g, the carrier k-l and the carried compound d-e; Brown draws no speed indices.',
  },
  507: {
    camera: [0.02, 0.03, 1],
    note: 'Front elevation of the arm n m, the wheels F, E and G, H spanning most of the plate above the bevel wheels A, D and the tall crown wheel C, as Brown draws it; Brown draws no white speed or phase indices.',
  },
  269: {
    remove: ['fixed-post-behind-moving-frame-holding-pinion', 'fixed-base-of-output-shaft-bearing', 'stationary-bearing-around-output-shaft', '(?:upper|lower)-rack-active-pitch-contact', 'visible-no-full-depth-contact-marker-during-relieved-tooth-handoff', 'white-index-exposing-output-reversals', 'white-index-showing-frame-translation-without-rotation'],
    note: 'The frame, racks and spur gear; no post, bearing, contact marker or index is drawn.',
  },
  281: {
    camera: [0.03, 0.01, 1],
    remove: ['white-disk-rotation-index', 'white-lever-vibration-index'],
    note: 'Front elevation of the grooved disk, follower pin and lever on its upper fulcrum; the disk is opaque, with the hand crank Brown dots behind it modelled as a plain arm and rearward handle; Brown\'s dashed second pose of the lever is notation and is not drawn; he draws no standard under the lever, only the A-frame and plank base; the white indices are not drawn.',
  },
  277: {
    camera: [-0.12, 0.05, 1],
    note: 'Side elevation of the cylinder (broken off at the left edge as on the plate), ratchet b, the slender dog a, spring c in its hatched block and hammer; the model builds no base, bearing posts, cylinder lock or index markers because the plate draws none.',
  },
  304: {
    camera: [0.05, 0.05, 1],
    note: 'Flat front elevation of the pin wheel and the broad pallet plate hung from its round collet in front of the pins; Brown draws no frame, base, index or contact marker, and the model builds none.',
  },
};
