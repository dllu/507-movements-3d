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
    remove: ['base', '(?:front|rear)RockshaftBearing', 'outputBearing', 'inputGuidePost.*', 'input(?:Upper|Lower)Guide', 'inputFork(?:Back|Front|Bridge)', 'remotePin(?:Head|Nut)?', 'inputStem'],
    note: 'Side elevation of rod A, rockshaft B, the pierced ratchet sectors C and the crown wheel D on its upright shaft, rod A broken off to the upper right; no frame, posts, base, bearings or rod guide are drawn. Only the production MuJoCo model is presented; its physics keeps the reconstructed supports and input guide, and the synchronous registry model keeps them visible for offline checks.',
  },
  85: {
    remove: ['strikingBed'],
    note: 'Side elevation of the curved standard with its two guide brackets, the twin wiper A and the stamp rod with projection B; the stamp head hangs above the ground line and no anvil or striking bed is drawn.',
  },
  86: {
    remove: ['remote(?:BearingStandard|BearingLip|Base|DriveRim|DriveWeb|DriveHub|InputShaft)', 'rearDrive(?:Web|Hub)', 'pumpGuide(?:Left|Right|Crossbar|PillarLeft|PillarRight)', 'pumpLowerBed', 'pumpCrosshead', 'pumpOutputRod', 'ropeLoadFerrule'],
    note: 'Front elevation of the loose wheel A on its A-frame standard with catch B, cam C, the post and the overhead stop, cut at the ground line: the rope runs down into the plinth and the hatched upper and lower runs of the driving band leave the plate to the right (the factory clips both at the plate edge). The band\'s own pulley sits hidden behind A (only its rim is kept, so the spoke openings stay clear); the second pulley, pump rod, crosshead and rod guides are not drawn.',
  },
  89: {
    remove: ['bored-crosshead-cheek', 'crosshead-bridge-clear-of-swinging-eye', 'wrist-pin-(?:shank|retaining-head)', 'output-valve-stem', 'fixed-horizontal-crosshead-channel', 'base-rail', 'guide-support-\\d', 'bored-rear-shaft-support'],
    note: 'Front elevation of the sheave, strap and bolted rod flange, the rod broken off to the right; no crosshead, guides or bed are drawn.',
  },
  90: {
    camera: [0, 0, 1],
    remove: ['guide\\d', 'shaftSupport', 'base'],
    note: 'Flat front elevation of the oval yoke with its two rod stubs broken off, the eccentric disk and the hatched shaft; no pedestal, rod guides or shaft bearing are drawn. Only the production MuJoCo model is presented; its physics keeps ideal guides and bearings.',
  },
  91: {
    camera: [0, 0, 1],
    remove: ['guide\\d', 'crossbar\\d', 'post\\d', 'shaftSupport'],
    note: 'Flat front elevation of the yoke with its upper and lower rods broken off, the triangular eccentric and the hatched shaft; no guide frame, collars or shaft bearing are drawn. Only the production MuJoCo model is presented; its physics keeps ideal guides and bearings.',
  },
  93: {
    remove: ['guide\\d', 'crossbar\\d', 'post\\d', 'shaftSupport'],
    note: 'Front elevation of the crank disk behind the slotted yoke and its stems; no frame, brackets or stem guides are drawn. Only the production MuJoCo model is presented; the synchronous registry model keeps its reconstructed frame for offline checks.',
  },
  94: {
    remove: ['tab\\d', 'bracket\\d', 'shaftSupport'],
    note: 'Face view of the slotted radial plate over the spiral-grooved plate with the bolt; no rim lugs, brackets or shaft support are drawn.',
  },
  95: {
    camera: [0, 0, 1],
    remove: ['guide', 'upperBracket', 'post', 'lowerBracket'],
    note: 'Flat side elevation: the inclined disk edge-on, the forked rod and roller above it, the shaft bearing bolted to a hatched wall corner; no rod guide or gantry is drawn.',
  },
  96: {
    camera: [0, 0, 1],
    remove: ['spring', 'springSeat', 'guide\\d', 'rearFrame'],
    note: 'Flat face view of the heart cam on its shaft and the roller-ended bar running off to the right; no return spring, spring seat, bar guides or frame are drawn. Only the production MuJoCo model is presented; its physics keeps the inferred return spring and ideal guide.',
  },
  98: {
    camera: [0, 0, -1],
    scale: [-1, 1, 1],
    note: 'Viewed from the disk side, the grooved arm dashed behind the disk and its sectioned pivot shaft on the right; mirrored so the rear view keeps the plate layout. The disk is translucent in place of the dashed hidden lines; no frame is drawn (the factory omits it).',
  },
  105: {
    remove: ['anvil', 'blank'],
    note: 'Front elevation of the weighted handle, screw, nut and ram in the frame, broken off below the ram guide; no lower jaw, anvil or blank is drawn. The ram presses an invisible reconstructed blank.',
  },
  108: {
    camera: [0, 0, 1],
    note: 'Flat front elevation of the crossing-groove barrel between its top and bottom rails, the swivel shoe arm on the left guide rod and the gear at the foot.',
  },
  109: {
    camera: [0, 0, 1],
    note: 'Flat front elevation of the lead screw and the cut work between the top and bottom rails, the carriage arm reaching across and the change gears at the foot.',
  },
  134: {
    remove: ['rear-fixed-pedestal-supporting-drum-axis', 'fixed-foot-of-drum-bearing-pedestal', 'fixed-bearing-behind-drum-hub'],
    note: 'Front elevation of the spoked rope drum with its rim separators, the rope running off along the ground line; no pedestal or bearing is drawn.',
  },
  139: {
    remove: ['bearing-post', 'base', 'roller-post-\\d'],
    note: 'Front elevation of the carriage, internal rack, pinion and top linkage on its two wheels; no post, floor plank or roller posts are drawn. The fixed pinion and roller bearings stay hidden behind the carriage and wheels.',
  },
  142: {
    remove: ['rear-post', 'output-guide-rail', 'guide-support-post', 'guide-(?:upper|lower)-bridge', 'base', 'bored-slider-shoe', 'traversing-guide-bar', 'slider-joint-pin'],
    note: 'Face view of the carrier disk, fixed pinion, planet wheel and crank with the connecting rod broken off below its eye; no base, pedestal, slider or guide bar is drawn.',
  },
  145: {
    remove: ['fixed-rear-column-supporting-beam-axis-clear-of-slider', 'fixed-foot-of-rear-beam-pivot-column', 'fixed-bearing-post-behind-flywheel', 'fixed-horizontal-rail-for-reciprocating-small-standard', 'white-index-showing-.*', '.*-white-depth-index'],
    note: 'Side elevation of the spoked flywheel in its pit, the tied rod to the small standard, the upright rod and the one-armed beam turning on the hatched shaft at its right end; no beam column, wheel post, rail or index marks are drawn.',
  },
  149: {
    remove: ['rear-bearing-frame', 'guide\\d--?1', 'guide-back\\d', 'slider\\d', 'slider-pin\\d', 'slider-retainer\\d'],
    note: 'The two cams, the two levers on their common pivot and the two rods broken off below; no rear bearing bar, rod guides or slides are drawn.',
  },
  150: {
    rotate: [0, Math.PI, 0],
    scale: [-1, 1, 1],
    camera: [0.2, 0.02, 1],
    remove: ['fixed-camshaft-bearing-ring', 'fixed-longitudinal-base-rail', 'fixed-transverse-base-tie', 'fixed-camshaft-bearing-post', 'fixed-post-under-right-lever-fulcrum', 'output-guide-(?:-1|1|back|foot)', 'throw-\\d-white-lobe-index', 'throw-\\d-identity-tick', 'sliding-carrier-end-collar', 'invisible-full-selection-and-valve-stroke-envelope', 'white-no-slip-follower-index', 'white-valve-translation-index', 'white-longitudinal-key-and-rotation-index'],
    note: 'Nearly end-on view down the camshaft: the hatched shaft end in front of the sliding cam series, the rocking lever on its right-hand fulcrum and the valve rod; no base, posts, rod guide or index marks are drawn.',
  },
  151: {
    remove: ['guide-(?:back|upper|lower)-\\d', 'guide-post-\\d-.*', 'bearing-(?:post|foot)-.*', 'rear-base', 'upper-bearing-(?:arm|rear-tie|post)', 'input-shaft-rotation-mark'],
    note: 'The opposite-hand screw shaft between its end bearings, the two nuts and the upper worm shaft end-on in its bearing ring; no base, posts, upright or index mark are drawn.',
  },
  156: {
    remove: ['base', 'diskPost', 'pivotPost', 'guidePost', 'guideBack', 'guideRail.*', 'guideBackArm.*', 'guideStandoff.*', 'crosshead', 'sliderPin', 'sliderRetainer'],
    note: 'The disk, slotted bell crank, link and the output rod broken off below its eye; no base, posts, guide rails or crosshead are drawn.',
  },
  157: {
    remove: ['base', 'diskPost', 'pivotPost', 'guidePost', 'guideBack', 'guideRail.*', 'guideBackArm.*', 'guideStandoff.*'],
    note: 'The disk, rod, bell crank, link and output rod; no base, posts or guide rails are drawn.',
  },
  186: {
    camera: [0.03, 0.02, 1],
    remove: ['fixed-frame-supporting-valve-rockshaft'],
    note: 'The rockshaft, gab lever, eccentric rod and spring loop handle; no frame is drawn.',
  },
  187: {
    camera: [0.03, 0.02, 1],
    remove: ['fixed-frame-supporting-the-valve-rockshaft'],
    note: 'The rockshaft, valve lever, eccentric rod and upper handle; no frame is drawn.',
  },
  188: {
    camera: [0.03, 0.02, 1],
    remove: ['fixed-frame-and-valve-carrier-guide'],
    note: 'The eccentric rod with its loop handle a and leaf spring; no frame or guide is drawn.',
  },
  189: {
    camera: [0.03, 0.02, 1],
    remove: ['fixed-support-frame-behind-source-linkage'],
    note: 'The rockshaft, forked eccentric rod and the bell crank with its vertical rod; no frame is drawn.',
  },
  190: {
    camera: [0, 0.01, 1],
    remove: ['white-index-.*', 'white-marker-at-.*'],
    note: 'Flat side elevation: the bench is drawn as a plank section under the work, standard, holder, shoe and screw; no index marks are drawn.',
  },
  191: {
    remove: ['rear-fixed-bearing-standard', 'fixed-support-foot'],
    note: 'Face view of the two notched wheels; no standard or foot is drawn.',
  },
  192: {
    remove: ['rear-wheel-bearing-standard', 'fixed-mangle-wheel-support-foot'],
    note: 'Face view of the mangle wheel and its pinion; no standard or foot is drawn.',
  },
  193: {
    remove: ['rear-wheel-bearing-standard', 'fixed-mangle-wheel-support-foot'],
    note: 'Face view of the concentric mangle wheel and its pinion; no standard or foot is drawn.',
  },
  194: {
    remove: ['rear-wheel-bearing-standard', 'fixed-equal-speed-mangle-wheel-support-foot'],
    note: 'Face view of the pin mangle wheel and its pinion; no standard or foot is drawn.',
  },
  201: {
    remove: ['fixed-base-rail', 'fixed-rear-support-post', 'fixed-(?:output-pivot|input-shaft)-bearing-bridge'],
    note: 'The eccentric gears, belt, pulley and the guided rod A; no base, post or bearing bridges are drawn.',
  },
  203: {
    remove: ['white-index-showing-(?:curved-arm-input|variable-output-arm)-angle'],
    note: 'Face view of the hooked arm with its J-shaped slot and the straight arm whose pinned end passes behind it (dashed on the plate); no index marks are drawn.',
  },
  204: {
    remove: ['fixed-(?:longitudinal|transverse)-base-rail', '(?:driver|driven)-shaft-bearing-post'],
    note: 'The two hyperboloidal rollers on their shafts; no base or posts are drawn.',
  },
  212: {
    remove: ['geneva-stop-fixed-base-rail', 'geneva-stop-fixed-bearing-upright', '(?:driver-A|stop-wheel-B)-rear-bearing-arm', 'geneva-stop-(?:left|right)-transverse-foot', '212-bored-fixed-shaft-support-\\d'],
    note: 'Face view of driver A and stop wheel B; no frame is drawn.',
  },
  213: {
    remove: ['friction-stop-fixed-base-rail', 'friction-stop-fixed-bearing-upright', '(?:winding-arbor|split-stop-stud)-rear-bearing-arm', 'friction-stop-(?:left|right)-transverse-foot', 'winding-ratchet-radial-speed-index', 'split-stop-wheel-radial-speed-index', 'face-pin-front-motion-index', 'moving-face-pin-to-partial-tooth-contact-marker', 'face-pin-to-uncut-rim-hard-stop-contact-marker'],
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
    camera: [0.15, 0.12, 1],
    remove: ['rear-frame-post', 'rear-frame-top', 'base', 'F-.*', 'H-.*', 'A-.*', 'hinged-catch-G', '.*contact.*marker', 'cam-rotation-index-at-e', 'rear-projection-lifting-catch-at-e', 'cam-frame-bearing'],
    note: 'Face view of the grooved cam C, D, B, e alone, as Brown draws it; the notch wheel F, lever, stud A and catch G belong to plate 218, and no frame is drawn.',
  },
  231: {
    remove: ['(?:input|output)-drag-link-crankshaft-visible-rotation-index'],
    note: 'Oblique view of the two slender cranks, the hanging link and the bearing link, with the long output rod running off to the right; no index marks are drawn.',
  },
  233: {
    remove: ['lantern-stop-rear-support-frame-beam', '(?:roller-arm|latch)-inward-travel-stop-block', 'lantern-wheel-rotation-witness', 'stop-roller-rotation-witness', '(?:roller|latch)-stop-to-trundle-contact-marker'],
    note: 'Face view of the lantern wheel with its roller stop and latch; no frame, arm rest blocks, white rotation witnesses or contact markers are drawn.',
  },
  234: {
    rotate: [-Math.PI / 2, 0, Math.PI],
    camera: [6.2, 4.9, 6.9],
    remove: ['verge-end-journal', 'verge-rotation-witness', 'crown-wheel-rotation-witness'],
    note: 'Oblique view from above, verge S falling to the right at about 22° across the wheel: a flush toothed plate on a shallow band with its arbor hanging down, and two plain flags A on the round spindle; no frame, bearings, journal caps or witness marks are drawn. The rim is cut into saw teeth whose slant matches the unmirrored model.',
  },
  237: {
    camera: [-4, 6.5, 9],
    remove: ['fixed-lower-output-bearing', 'crown-wheel-face-inset', 'crown-wheel-output-hub', 'top-arm-bearing-outline', 'white-crown-wheel-rotation-index', 'white-top-arm-motion-index', 'white-pawl-lift-index', 'active-crown-(?:drive-face|ramp-return)-contact'],
    note: 'Oblique view from about 35 degrees above: the shallow crown drum with saw teeth round its upper rim, the output shaft hanging below, and the top arm on a low boss on the stud rising from the centre of the face, pointing away and upward to the right with the pawl at the rim; no lower bearing collar, face collar, face ring, hub outline, white indices or contact markers are drawn.',
  },
  238: {
    remove: ['white-escape-wheel-rotation-index', 'white-pallet-carrier-motion-index'],
    note: 'Face view of the seven-point wheel D in the notch of the anchor, B below it and C at the hooked tip, pivoted at A; no witness marks are drawn.',
  },
  239: {
    remove: ['fixed-spur-stop-support-rail', 'fixed-spur-gear-bearing-post', '(?:left|right|output)-journal-support-post'],
    note: 'The spur wheel between its two pivoted stops; no rail or posts are drawn.',
  },
  242: {
    remove: ['brake-demonstration-base', 'fixed-brake-wheel-bearing-post', 'fixed-lever-fulcrum-post'],
    note: 'The brake wheel, strap and lever; no base or posts are drawn.',
  },
  246: {
    remove: ['common-drawing-plane-for-tracer-and-pencil', 'drawing-sheet-outline', 'small-source-locus-traced-by-point-B', 'two-times-linear-copy-drawn-by-pencil-A'],
    note: 'The pantograph arms, the round fixed point C, tracer B and pencil A over a blank ground; no drawing board or traced figures are drawn.',
  },
  247: {
    note: 'Front section through the rod, the weight and the catch, with the probe foot below; the sea bottom is not drawn, so only a thin contact line just wider than the weight is kept for the probe to strike and the released weight to rest on.',
  },
  248: {
    remove: ['raised-grip-rib-on-nut-B', 'white-rotation-index-on-nut-B'],
    note: 'Section through pipe A with its flange, nut B and the screwed end of pipe C; the nut is drawn plain, without grip ribs or an index.',
  },
  253: {
    remove: ['check-hook-\\d-torsion-return-spring', 'visible-torsional-shock-spring-between-flange-and-load-side-drum', 'white-flange-b-speed-index', 'white-load-side-drum-speed-index', 'framework-a-stud-d-\\d-radial-support'],
    note: 'Framework A with studs D, flange B with its three hooks, the drum and the rope; Brown recommends a drum spring but draws none, so the hook and drum springs, speed indices and stud supports are not shown.',
  },
  272: {
    remove: ['fixed-base-beneath-beveled-cam', 'fixed-post-supporting-cam-shaft-bearing', 'fixed-backing-rail-for-inclined-guides', 'fixed-bracket-from-backing-rail-to-rod-guide', 'fixed-bearing-for-horizontal-cam-shaft'],
    note: 'Side elevation of the disk with its bevelled rim and wavy face on the shaft, and the inclined rod in its guides; no base, post, shaft bearings or backing rail are drawn.',
  },
  276: {
    remove: ['fixed-(?:left|right)-guide-support-post', 'fixed-equal-diameter-cam-display-base', 'fixed-cam-bearing-arm', 'fixed-rear-cam-bearing-post', 'fixed-(?:left|right)-straight-bar-guide'],
    note: 'Face-on elevation of the three-lobed cam between the rollers of the level sliding bar; no base, posts, bearing arm or bar guides are drawn.',
  },
  279: {
    remove: ['fixed-(?:left|right)-crosshead-guide-post', 'fixed-crosshead-display-base', '(?:left|right)-fixed-crosshead-guide-(?:upper|lower)'],
    note: 'Close face view of the Clayton journal box in its slotted crosshead, the rod broken off on both sides; no base, posts or rod guides are drawn.',
  },
  280: {
    remove: ['fixed-windlass-display-base'],
    note: 'Face view of the plain windlass wheel, the rim-travelling jaw block, the coupler and the hand lever on the framed posts, which run off the bottom of the plate; no base is drawn and the ratchet is hidden behind the wheel.',
  },
  288: {
    remove: ['rear-clock-plate-standard', 'fixed-clock-frame-base', 'white-index-on-(?:escape-wheel-tooth-zero|rocking-anchor-crutch)', 'visible-nonconcentric-working-face', 'white-marker-on-active-tooth-pallet-contact'],
    note: 'Face view of the escape wheel and anchor H, L, K; no clock plate, base, index marks or highlighted pallet faces are drawn.',
  },
  289: {
    remove: ['rear-deadbeat-clock-plate-standard', 'fixed-deadbeat-clock-frame-base', 'white-index-on-deadbeat-(?:wheel-tooth-zero|anchor-stem-L)', '(?:left-H|right-K)-(?:concentric-locking|impulse)-face', 'white-marker-on-active-deadbeat-contact'],
    note: 'Face view of the dead-beat wheel A and anchor; no clock plate, base, index marks or highlighted pallet faces are drawn.',
  },
  290: {
    remove: ['rear-clock-frame-standard', 'fixed-annular-escapement-frame-base', 'white-index-on-(?:seven-tooth-wheel|pendulum-rod-K)', 'white-marker-on-active-annular-pendulum-contact', '(?:right-inward-pallet-A|left-inward-pallet-B)-nonconcentric-recoil-face-visible-working-edge'],
    note: 'Face view of the seven hooked teeth of wheel D inside the annular pallet frame; no clock plate, base or index marks are drawn.',
  },
  291: {
    remove: ['fixed-watch-plate-base', 'fixed-balance-arbor-standard', 'fixed-escape-wheel-arbor-standard', 'balance-wheel-rim', 'balance-spoke-[123]', 'white-index-inside-escape-wheel-B', 'white-marker-on-(?:stop-d-locking|tooth-to-notch-g-impulse)-contact', 'visible-working-side-of-impulse-notch-g'],
    note: 'The escape wheel B, balance a drawn as a plain notched disc, and the detent with its springs; no watch plate, standards, base, balance rim and spokes, or index marks are drawn.',
  },
  292: {
    remove: ['fixed-rear-clock-plate-standard', 'fixed-large-clock-frame-base'],
    note: 'The wheel, gravity arms and pallets; no clock plate or base is drawn.',
  },
  293: {
    remove: ['fixed-rear-duplex-watch-plate-standard', 'fixed-duplex-watch-frame-base', 'rear-bridge-between-watch-journals', 'white-index-on-duplex-(?:impulse-pin-zero|balance)', 'white-marker-on-active-duplex-(?:lock-or-notch|impulse)-contact'],
    note: 'Close-up of the top of the duplex wheel: roller A and pallet B over a short rim arc with the long teeth and crown pins a; no watch plate, bridge, base or index marks are drawn.',
  },
  294: {
    rotate: [0, 0, 2.77],
    camera: [-1, 0.3, 0.38],
    remove: [
      '(lower|upper)-rim-of-perspective-cylinder-window',
      'invisible-envelope-for-complete-cylinder-escapement', 'fixed-parallel-arbor-watch-frame',
      'stepping-cylinder-escape-wheel-rotor', 'fixed-cylinder-escape-wheel-arbor',
      'cylinder-balance-spoke-\\d', 'balance-wheel-attached-to-top-of-cylinder',
      'white-index-on-cylinder-balance-wheel', 'bored-hub-joining-balance-spokes-to-end-pivot',
      '(generated-(entry|exit)-lip-working-contact|(outside|inside)-cylinder-frictional-rest)-trace',
      'white-marker-on-active-cylinder-escapement-contact',
    ],
    note: 'Brown draws only the cylinder in perspective (295 shows the wheel); the escape wheel, balance and watch frame are not drawn.',
  },
  295: {
    remove: ['white-index-on-cylinder-wheel-pallet-zero', 'white-source-label-marker-for-pallet-[abc]'],
    note: 'Flat close-up of the top of the wheel: the wedge pallets a, b, c on their swept-back arms over the rim arc and the cylinder A, B between them; no index or label marks are drawn.',
  },
  296: {
    remove: ['fixed-rear-lever-watch-plate-standard', 'fixed-lever-escapement-frame-base', 'rear-bridge-between-watch-journals'],
    note: 'Face view of the escape wheel A and lever B, C; no watch plate, bridge or base is drawn.',
  },
  297: {
    remove: ['fixed-lantern-escapement-base', 'fixed-bored-rear-plate-joining-both-arbor-bearings', 'fixed-(?:rocking-arm-bearing-A|lantern-wheel-bearing)'],
    note: 'Face view of the pin wheel with the hatched pallets B and C; arm A and its pivot are dashed hidden lines. No base, rear plate or bearings are drawn.',
  },
  299: {
    rotate: [Math.PI / 2, Math.PI / 2, 0],
    camera: [0.02, 0.06, -1],
    remove: ['weighted-horizontal-foliot-regulator'],
    note: 'Nearly edge-on view along the verge: the crown band with its raked teeth, the verge journal end-on above it and the two pallets about 100° apart, the steep one on the left and the shallow one on the right. Brown crops the foliot out of the detail, so it is not shown.',
  },
  300: {
    remove: ['debaufre-wheel-rotation-witness', 'pallet-oscillation-witness'],
    note: 'Front elevation: the barbed wheel with its lobed boss and two spokes over the edge-on pallet on the horizontal balance staff; no witness marks are drawn.',
  },
  301: {
    remove: ['debaufre-wheel-rotation-witness', 'pallet-oscillation-witness'],
    note: 'Side elevation along the balance staff: the two wheels edge-on on their common arbor and the level D pallet below with the staff end-on; no witness marks are drawn.',
  },
  303: {
    remove: ['white-Graham-wheel-index', 'white-pendulum-swing-witness', 'white-active-Graham-contact', '(?:left-D|right-E)-(?:concentric-locking|impulse)-face'],
    note: 'Face view of the Graham wheel with its four crossings as a leaning X under anchor D, C, E, the pendulum rod marked only by the dot F; no frame, bob, index marks or highlighted pallet faces are drawn.',
  },
  305: {
    remove: ['rear-clock-frame-upright', 'fixed-pendulum-pivot-bracket', 'fixed-single-pin-disc-arbor-bracket', 'pendulum-angle-index', 'disc-half-turn-index'],
    note: 'The pendulum pallet plate and single-pin disc; no clock frame, brackets or index marks are drawn.',
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
    remove: ['fixed-wheel-to-lever-frame-member', 'fixed-lever-to-balance-frame-member', 'fixed-frame-member-behind-banking-tail', 'fixed-lever-chronometer-frame-base', 'white-index-on-lever-chronometer-(?:wheel|balance)', 'white-marker-on-.*', '(?:.*-)?working-(?:lock-)?face-of-.*'],
    note: 'The windowed escape wheel, locking lever A, B and the plain balance disk C behind the lever, with its banking pins; no frame, index dots or face highlights are drawn.',
  },
  309: {
    remove: ['fixed-Mudge-escapement-frame', 'pendulum-rod-between-P-and-Q', 'pendulum-bob', '(?:.*-)?white-.*witness'],
    note: 'Front elevation of the wheel, the two pallet arms from their arbors C and the fork pins P, Q, with only the small suspension eye between the arbors; Brown omits the pendulum rod and bob, and no clock frame, crossbars, bearing brackets or index marks are drawn.',
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
    remove: ['fixed-clock-frame', '.*-symmetric-rotation-index', 'chain-link-index-marker'],
    note: 'The pulleys P and p, the weights and the endless chain; no clock frame, rotation indices or chain markers are drawn.',
  },
  321: {
    remove: ['fixed-clock-frame-and-T-bearing', 'great-wheel-G-symmetric-rotation-index', 'barrel-B-symmetric-rotation-index', 'maintaining-spring-material-index'],
    note: 'Great wheel G, the ratchets, click R, spring S-S\', detent T pivoted at its eye and the weight on barrel B; no frame beam or white indices are drawn.',
  },
  329: {
    remove: ['white-index-fast-with-plate-C', 'white-index-on-carrier-crank-C', 'white-index-on-translating-piston-rod-A'],
    note: 'Flywheel with plate C, wheel B inside the fixed internal gear D, piston rod A and the A-frame legs, cropped at the cylinder cover as the plate is; no white indices are drawn.',
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
    remove: ['fixed-stamp-machine-base', 'fixed-anvil-below-falling-stamp', 'fixed-workpiece-at-lower-impact-stop', '(?:upper|lower)-guide-.*'],
    note: 'The broad rack rod between its two broad collars, the stamp head below and the mutilated pinion; no base, anvil, workpiece or rod guides are drawn.',
  },
  355: {
    camera: [7, 10, 12],
    note: 'Raised three-quarter view of pillar G on its flared foot, pintle F in the top bearing, ring A seen as a broad ellipse and disk C nearly edge-on; the factory hides the white indices Brown does not draw.',
  },
  358: {
    remove: ['fixed-carriage-guide-rail', 'rail-end-cross-tie', 'rail-travel-reference-mark'],
    note: 'Plan of the carriage: the fusee on its shaft in the carriage frame with the crank at the large end, the cross-member and bed carrying the two edge-on wheels on their axles, and the band crossing the fusee; no guide rail or travel ticks are drawn under the wheels.',
  },
  354: {
    scale: [1, 1, -1],
    remove: ['fixed-rear-support-rail', 'fixed-bracket-carrying-output-guide', 'fixed-input-bearing-bracket', 'fixed-bearing-for-input-shaft', 'visible-radial-index-on-input-disk', 'visible-linear-index-on-output-stem'],
    note: 'The rimmed disk in front, the grooved crosshead and its stem dashed behind it, the stems cropped at the plate edges through their guides; no support rails, brackets, bearing or white indices are drawn. The depth mirror puts the disk in front as Brown draws it.',
  },
  363: {
    camera: [0, 0.03, 1],
    scale: [-1, 1, 1],
    note: 'Front elevation of the see-saw with its left end raised (the official t=0 pose mirrored), a shoe with end board, rounded heel and cleat at each plank end, the post with its concave buttresses and straight braces on the base; no handholds are drawn.',
  },
  364: {
    camera: [0, 0.06, 1],
    remove: ['fixed-two-axis-bearing-stand'],
    note: 'Side elevation of the pin wheel face-on beside the helically grooved drum on its upright shaft; no stand or bed is drawn.',
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
    remove: ['parallel-crank-angular-index-[12]'],
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
    remove: ['fixed-base-of-treadle-drive-demonstrator', 'fixed-standard-supporting-upper-shaft', 'right-hand-fixed-treadle-pivot-standard', 'white-index-showing-continuous-output-shaft-rotation', 'white-face-spin-index', 'broad-foot-pad-at-free-end-of-treadle'],
    note: 'The eccentric pulley, band and the diagonal treadle rising leftward from its right-hand fulcrum past the roller; no base, standards, foot pad or white index are drawn.',
  },
  375: {
    camera: [0, 0.07, 1],
    remove: ['fixed-foundation-beneath-annular-pan', 'lower-bearing-for-vertical-runner-shaft', 'white-index-.*'],
    note: 'Front elevation of the edge-runner mill: the two tall runners edge-on in the flared pan inside the rectangular standard, the large bevel wheel above it and the pinion on the right-hand upright; no foundation slab, lower bearing or white indices are drawn.',
  },
  376: {
    camera: [0, 0, 1],
    remove: ['fixed-bearing-standard-outside-wheel-cage', 'fixed-overhung-arm-carrying-wheel-bearing', 'fixed-base-rail-for-treadwheel-frame', 'white-index-.*'],
    note: 'Face view of the treadwheel: the riveted rim, the square lattice of crossing bars round the sectioned axle and the horse walking inside; no trestle, base rails or white index are drawn.',
  },
  377: {
    camera: [0.84, 0.02, 0.9],
    remove: ['fixed-treadmill-foundation', 'fixed-hand-rail-support', 'white-index-.*'],
    note: 'Brown\'s view along the treadmill: the notched spur wheel on the near end of the axle behind its flared A-frame standard on a plank, the long diagonal side bar in front, and the broad drum receding to the right with the man stepping up its boards holding the rail; no foundation slab, rail posts or white index are drawn.',
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
    camera: [1, 0.012, 0],
    remove: ['white-.*', 'workpiece-longitudinal-grain-line'],
    note: "End elevation matching Brown's upper transverse section: the bed, the flush dovetailed cheeks and wedges, and the board standing on edge between them; Brown's lower figure, the plan of the diverging cheeks and wedges, is the top view. The white datums and grain lines are not drawn.",
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
    camera: [0, 0.1, 1],
    remove: ['stationary-drawing-and-transfer-paper', 'white-wheel-spin-index-on-(?:near-face|tread)', 'stationary-reference-index'],
    note: 'Side view of the point, screw-threaded arm and small milled wheel; no paper or white indices are drawn.',
  },
  385: {
    remove: ['fixed-wall-beside-door-opening', 'fixed-vertical-door-jamb', 'fixed-door-frame-lintel', '(frame|door)-pin-socket-bracket', 'moving-door-panel', 'one-of-four-door-face-trim-bars', 'door-opening-handle', 'one-of-three-fixed-axis-door-hinge-barrels', '(frame|door)-side-socket-fixed-to-support', '(frame|door)-side-socket-upper-lip', '(frame|door)-side-white-pin-turn-index', 'white-toggle-height-index', 'white-weight-height-index'],
    note: 'The two long upright pins, the toggle links and the small pear weight hung from the apex; the door, its frame, the pin sockets and white indices are not drawn.',
  },
  387: {
    remove: ['white-.*'],
    note: 'Side elevation of the wharf ladder, its floating end frame, parallel rails and level treads; the white rail and tread indices are not drawn.',
  },
  388: {
    remove: ['fixed-planer-feed-roller-bearing-frame', 'white-.*'],
    note: 'The smooth and toothed rollers and the board between them; no bearing frame or white indices are drawn.',
  },
  389: {
    remove: ['white-.*', 'fixed-front-rack-guide-strap', 'fixed-rear-pawl-support-(?:bridge|spine)', 'wide-jack-foot'],
    note: 'Section of the cast jack stand, flaring into stepped feet either side of the rack, with the eccentric strap pawl and upper stop; the white indices, the front rack straps cut away by the section, the rear bridges carrying the pawl and eccentric bearings and the sole plate are not drawn (the small bearing bosses stay behind the eccentric and the stop pawl eye).',
  },
  390: {
    remove: ['fixed-two-shaft-rectifier-bearing-frame', 'white-.*', 'piece-A-rigid-radial-web', '.*-fixed-material-marker'],
    note: 'The semicircular piece A on fulcrum a, flywheel B and bands C, D; no bearing frame, web inside A, band markers or white indices are drawn.',
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
    remove: ['fixed-Parsons-device-machine-bed', 'fixed-central-pinion-bearing-standard', 'connected-input-guide-support', 'fixed-guide-for-reciprocating-input-rod', 'white-.*'],
    note: 'The endless rack, flanged pinion and the rod with its end collar; no bed, standards, rod guide or white indices are drawn.',
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
    remove: ['fixed-four-motion-feed-base', 'fixed-camshaft-bearing-support', 'fixed-work-plate-(?:left|right)-of-feed-dog-slot', 'fixed-horizontal-guide-for-carrier-A', 'white-.*'],
    note: 'Side elevation of the forked bar A running out to the feeder, B\'s toothed end beyond it, cam C on its shaft and the return spring; no base, bearing supports, work plate, guides or white indices are drawn.',
  },
  401: {
    remove: ['fixed-floor-base', 'fixed-wheel-shaft-standard', 'fixed-treadle-pivot-standard'],
    note: 'The faceplate wheel, tangent slide A, B, pitman and treadle; no floor or standards are drawn.',
  },
  402: {
    remove: ['fixed-rear-bearing-frame-bar-\\d', '.*-white-balance-angular-index', 'white-escape-wheel-angular-index', '.*-balance-spoke-\\d', 'escape-wheel-spoke-\\d', 'visible-active-escape-tooth-pallet-contact'],
    note: 'Face view of the two plain balance discs with their pinions, the lever B carrying both toothed sectors and anchor A, and the escape wheel; no frame bars, spokes or white indices are drawn.',
  },
  403: {
    remove: ['(?:left|right)-sloping-rule-guided-by-(?:left|right)-chord-pin-end-index-[12]', '(?:left|right)-sloping-rule-guided-by-(?:left|right)-chord-pin-pin-contact-working-edge'],
    note: 'The two sloping rules crossed at the pencil and braced by the third rule, sliding against the two pins at the chord ends; no end indices or painted working edges are drawn.',
  },
  404: {
    remove: ['(?:left|right)-white-roller-angular-index', 'white-screw-handwheel-angular-index', 'given-required-arc-point-[123]'],
    note: 'The straight bar with its two end standards and rollers, the elastic arched bar and the central screw with its thumb grip; no index marks or given points are drawn.',
  },
  405: {
    remove: ['rule-distance-index-\\d+', '(?:upper-focus-rule-pivot|lower-focus-fixed-thread-loop-pin)-white-center-index', 'given-(?:upper|lower)-hyperbola-vertex'],
    note: 'The rule pivoted at the upper focus, the thread from its free end round the pencil to the lower focus, both branches and the dashed axes; no rule graduations, centre indices or vertex points are drawn.',
  },
  406: {
    remove: ['fixed-drawing-board-presentational-support-not-source-hardware', 'fixed-drawing-board-border', 'square-blade-distance-index-\\d+', 'white-focus-center-index', 'given-(?:base-endpoint-[12]|parabola-vertex)', 'given-parabola-base-chord', 'dashed-parabola-axis-parallel-to-square-blade'],
    note: 'The straightedge, square, thread and pencil describing the parabola; no drawing board, base chord, dashed axis, blade graduations or given points are drawn.',
  },
  407: {
    remove: ['fixed-drawing-board-presentational-support-not-source-hardware', 'fixed-drawing-board-border', 'mirrored-right-jamb-reference-for-complete-arch', 'mirrored-right-half-completing-pointed-arch', 'given-right-springing-point'],
    note: 'The slotted bar, elastic bar, cord and the half-arch it draws; no drawing board or mirrored half is drawn.',
  },
  408: {
    remove: ['blade-distance-index-\\d+', 'white-moving-joint-center-index', '(?:upper|lower)-fixed-board-pin-white-axis-index'],
    note: 'The centrolinead head with its two set legs and long blade against the two board pins; no blade graduations or centre indices are drawn.',
  },
  409: {
    remove: ['white-common-pivot-center-index'],
    note: 'The two slotted legs crossed at the sliding pivot with its set screw and the graduation along the slot; no point indices or span witnesses are drawn.',
  },
  413: {
    camera: [-0.12, 0.04, 1],
    remove: ['fixed-two-shaft-friction-gear-frame'],
    note: 'Edge-on elevation of the adjustable wheel A (in section in the plate) with nut B on its bolt, over the V-grooved wheel with its hub nut and crank handle, both shafts running off to the right; no frame is drawn.',
  },
  415: {
    remove: ['fixed-coaxial-wheel-and-lever-bearing-frame', 'wheel-D-spoke-fast-with-rim-and-hub', 'white-wheel-D-intermittent-rotation-index', 'white-lever-A-oscillation-index', 'selectable-(?:left-pawl-B|right-pawl-C)-white-rim-contact-index', 'fixed-horizontal-input-slider-guide', 'horizontally-guided-oscillating-input-slider'],
    note: 'The plain disc wheel D, lever A with its pawls B and C and crank E, and the rod D running off to the right; no frame, spokes, slider guide or white indices are drawn.',
  },
  416: {
    camera: [0.2, 0.06, 1],
    remove: ['fixed-flywheel-and-treadle-bearing-frame'],
    note: 'Near-face elevation of the plain flywheel disc and crank B, curled spring A on its stud, the pitman and the slim treadle bar; no frame is drawn.',
  },
  418: {
    note: 'Section of the conical casing on the chest cover with its recess, the suspended guide D on its adjusting screw, valve A, rod B and roller C.',
  },
  419: {
    remove: ['rear-grounded-drive-bearing-standard', 'representative-cradle-body-on-rocker-E'],
    note: 'Front elevation of the plain discs B and A with the crank link, the bands from posts C and D over B, and rocker E on the hatched floor line; no standard carrying the wheel axles and no cradle body block are drawn.',
  },
  420: {
    camera: [0.08, 0.02, 1],
    remove: ['fixed-bell-support-post', 'fixed-overhead-arm-carrying-bell'],
    note: 'Side elevation of the hammer on its bracket with the under-lever return spring on the plank, the bell hanging free by its canon loop; no gallows post or overhead arm is drawn.',
  },
  421: {
    remove: ['marine-trunk-engine-foundation', 'rear-crankshaft-support-column', 'rear-crankshaft-bearing-arm'],
    note: 'The sectioned cylinder, trunk piston, pitman and crank; no foundation or crank supports are drawn.',
  },
  422: {
    remove: ['fixed-foundation-of-sector-cylinder-A', '(?:counter)?clockwise-steam-passage-from-D-to-A', '(?:counter)?clockwise-chamber-admission-indicator', 'white-valve-D-position-index'],
    note: 'Section of the vase-shaped casing A with its side passages, foot and the boss of rock shaft C, the sector chamber with piston B, and slide valve D in its chest above; no bed plate, loose pipes or steam markers are drawn.',
  },
  423: {
    remove: ['left-fixed-cylinder-frame', 'right-fixed-cylinder-frame', '(?:top|bottom)-outer-side-induction-opening-indicator'],
    note: 'Section of Root\'s double-quadrant engine: the closed cast casing on its foot enclosing both quadrant chambers, the two pistons B on their pivots, the common crank D and valve a; no legs or steam markers are drawn.',
  },
  424: {
    camera: [0, 0, 1],
    remove: ['fixed-foundation-of-square-piston-engine', '(?:left|right)-B-port-admission-indicator', '(?:top|bottom)-C-port-admission-indicator'],
    note: 'Flat elevation of the oblong cylinder A with the sliding frame piston B, the nested piston C and crank wrist a on shaft b with its dotted path; no bed plate or steam markers are drawn.',
  },
  425: {
    camera: [0.08, 0.05, 1],
    remove: ['visible-center-marker-of-eccentric-piston-C', 'instantaneous-sealing-contact-between-C-and-D', 'right-to-chamber-induction-flow-indicator', 'chamber-to-left-eduction-flow-indicator'],
    note: 'Front elevation of the casing with its two port necks and the abutment guide, eccentric piston C on shaft B and abutment D, as Brown draws it; no centre or contact markers or flow spheres are drawn.',
  },
  426: {
    camera: [0.08, 0.05, 1],
    remove: ['(?:positive|negative)-piston-A-motion-marker', 'simultaneous-steam-action-indicator-on-(?:positive|negative)-piston-A', '(?:induction|eduction)-arrow-side-indicator'],
    note: 'Front elevation of the casing, drum B and sliding abutments A, as Brown draws it; no motion markers or steam spheres are drawn.',
  },
  427: {
    camera: [0.08, 0.05, 1],
    remove: ['(?:left|right)-orbit-piston-A-angle-marker', '(?:left|right)-orbit-packing-orientation-marker', '(?:induction|eduction)-flow-arrow-indicator'],
    note: 'Front elevation of the casing, drum B and pivoted pistons a, as Brown draws it; no rotation markers or flow spheres are drawn.',
  },
  428: {
    camera: [0.08, 0.05, 1],
    remove: ['visible-spin-marker-on-roller-A-[123]', 'fixed-angular-material-witness-on-liner-E-\\d+', '(?:induction|eduction)-steam-path-indicator', 'illustrative-(?:high-pressure-steam|eduction-region)-outside-flexible-liner'],
    note: 'Front elevation of the casing, arms B and rollers A, as Brown draws it; no spin markers, liner witnesses or steam tints are drawn.',
  },
  429: {
    camera: [0.08, 0.05, 1],
    remove: ['fixed-foundation-of-Holly-rotary-engine', 'downward-(?:induction|eduction)-steam-arrow-region'],
    note: 'Front elevation of the two-lobed casing with its top induction and bottom eduction necks and the toothed pistons, as Brown draws it; no stand or steam tints are drawn.',
  },
  430: {
    camera: [0.08, 0.05, 1],
    remove: ['fixed-overshot-wheel-foundation', 'shaft-connected-bearing-pedestal'],
    note: 'Side elevation of the overshot wheel under the headrace, in its masonry pit whose breast falls from the flume and curves close round the lower left of the wheel to the tail floor, as Brown draws it; no bed plate, pedestals or rotation marker are drawn.',
  },
  431: {
    camera: [0.08, 0.05, 1],
    remove: ['shaft-connected-bearing-pedestal', 'bottom-stream-flow-marker-\\d+', 'submerged-paddle-impulse-indicator-[123]'],
    note: 'Side elevation of the undershot wheel, sluice and race, as Brown draws it; no pedestals, flow beads or impulse dots are drawn.',
  },
  432: {
    camera: [0.08, 0.05, 1],
    remove: ['shaft-connected-bearing-pedestal', 'breast-wheel-inlet-flow-marker-\\d+'],
    note: 'Side elevation of the breast wheel, sluice and race, as Brown draws it; no pedestals or flow beads are drawn.',
  },
  433: {
    camera: [0.1, 0.2, 1],
    remove: ['falling-jet-motion-marker-\\d+'],
    note: 'Side elevation of the tub wheel, shaft and spout, as Brown draws it; the runner hangs free above its spray with no floor disc, basin or jet beads.',
  },
  434: {
    camera: [0, 1, 0.12],
    note: 'Plan of the turbine wheel A inside the guide ring B, as Brown draws it.',
  },
  435: {
    camera: [0, 1, 0.12],
    note: 'Plan of the inner guides b and outer wheel a, as Brown draws it.',
  },
  436: {
    camera: [0.04, 0.02, 1],
    note: 'Sectional elevation of the case b, wheel a and step c, as Brown draws it.',
  },
  437: {
    camera: [0, 1, 0.12],
    remove: ['fixed-foundation-under-volute-wheel', 'fixed-upper-bearing-of-volute-wheel-shaft', 'bored-upper-bearing-crossbeam', 'upper-bearing-support-post'],
    note: 'Plan of the scroll case and wheel with its guides a and floats c, as Brown draws it; no foundation or upper bearing bridge is drawn.',
  },
  438: {
    camera: [0.08, 0.05, 1],
    note: "Elevation of the Barker's mill arms, hollow shaft and funnel, as Brown draws it.",
  },
  439: {
    camera: [0.08, 0.05, 1],
    remove: ['fixed-overhead-pulley-support-beam', 'bored-pulley-shaft-hanger', 'fixed-pulley-support-post', 'fixed-ground-beneath-bucket', 'visible-oscillating-pulley-rotation-marker', 'material-marker-moving-continuously-on-single-rope'],
    note: 'The pulley, rope, bucket, counterweight and water stream; no gallows frame, ground, white pulley stripe or rope marker is drawn.',
  },
  440: {
    camera: [0.5, 0.42, 1],
    remove: ['visible-trough-angle-index'],
    note: 'Low three-quarter view of the tipping trough on its pivot standards and plank frame under the inlet spout; no angle index is drawn.',
  },
  441: {
    camera: [0, 0.01, 1],
    remove: ['fixed-persian-wheel-base', 'fixed-hollow-shaft-bearing-standard', 'fixed-stream-bed-beneath-wheel', 'fixed-stationary-trip-pin-bracket', 'fixed-trip-pin-support-post', 'fixed-high-level-trough-receiving-tipped-bucket-water', 'fixed-outboard-receiver-standard', 'fixed-receiver-to-standard-bridge', 'rightward-driving-stream-marker-\\d+', 'inward-moving-float-water-marker-\\d+', 'visible-hollow-shaft-rotation-index'],
    note: 'Front elevation of the Persian wheel, its buckets and the stream; no base, standards, bed, trip-pin post, trough or white current/rotation markers are drawn.',
  },
  442: {
    camera: [1, 0.28, 0.30],
    remove: ['fixed-eisach-wheel-base', 'fixed-river-bed-under-pot-wheel', 'rightward-river-current-marker-\\d+', 'visible-pot-wheel-rotation-index'],
    note: 'Brown looks across the stream nearly along the wheel plane: the axle runs left to right on its trestles, the pots show between the rims and the trough runs off to the left. No base slab, box bed, current markers or rotation index are drawn.',
  },
  443: {
    camera: [0.6, 0.16, 0.85],
    remove: ['fixed-archimedes-screw-base', 'fixed-stream-bed-around-lower-water-wheel', 'axial-driving-stream-marker-\\d+', 'visible-one-to-one-screw-rotation-index', 'fixed-oblique-bearing-support-1', 'finite-bearing-to-post-bridge-1'],
    note: 'The oblique screw casing with its spiral passage, the paddle wheel at its lower end in the stream and the trough at the top. Brown draws no base slab, bed box, post under the submerged lower bearing, stream markers or rotation stripe.',
  },
  444: {
    camera: [0, 0.02, 1],
    remove: ['fixed-hydraulic-ram-base', 'drive-pipe-flow-marker-\\d+', 'uniform-output-flow-marker-\\d+'],
    note: 'Sectional elevation of the supply, air vessel and jet, as Brown draws it; no base slab or white flow markers are drawn.',
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
  461: {
    camera: [0, 0.02, 1],
    remove: ['fixed-foundation-below-swinging-gutter-water-lift'],
    note: 'Elevation of the serpentine swinging gutters over the water they dip into; no foundation slab is drawn.',
  },
  462: {
    remove: ['fixed-frame-supporting-upper-powered-chain-wheel'],
    note: 'The chain wheels, disks, pipe and spout; no frame is drawn.',
  },
  465: {
    remove: ['left-operator-pressure-pad', 'right-operator-pressure-pad'],
    note: 'Balance beam on its platform over the two pumps and the well; Brown draws a man working the beam, not pressure pads.',
  },
  466: {
    camera: [0, 0.03, 1],
    remove: ['fixed-foundation-under-hydrostatic-press-and-hand-pump'],
    note: 'Sectional elevation of the press, ram cylinder, pipe, hand pump and open reservoir; no foundation slab is drawn.',
  },
  467: {
    camera: [0, 0.02, 1],
    remove: ['fixed-ground-plate-under-robertson-jack'],
    note: 'Sectional elevation of the jack, ram, pump and lever; no ground plate is drawn.',
  },
  468: {
    camera: [0, 1, 0.5],
    remove: ['river-surface-reference-\\d'],
    note: 'Brown gives a close plan and elevation of one ball-and-socket joint between log frames; the reconstruction shows the whole pair of mains being hauled, viewed from above so the frames, straps and joints read as in his plan. No river-surface strips are drawn.',
  },
  469: {
    camera: [0, 0.02, 1],
    remove: ['cold-bath-thermometer', 'warm-bath-thermometer'],
    note: 'Sectional elevation of the two tanks, wheel and pipe, as Brown draws it; no thermometers are drawn.',
  },
  474: {
    remove: ['fixed-hearth-ring-below-boiler', 'fixed-fire-flame-\\d-of-seven', 'fixed-aeolipile-foundation'],
    note: 'The boiler on its legs, the hollow risers and the revolving sphere; no hearth, fire or foundation is drawn.',
  },
  475: {
    remove: ['bilge-water-source-at-foot-of-B', 'stationary-bilge-well-surrounding-suction-B'],
    note: 'The ejector body D, pipes B, C and steam jet A; no bilge well is drawn.',
  },
  476: {
    remove: ['fixed-water-source-basin-under-two-B-mouths', 'water-surface-feeding-both-suction-branches'],
    note: 'The forked ejector B, C and steam pipe A; no water basin or surface is drawn.',
  },
  473: {
    remove: ['water-sealed-air-pump-foundation'],
    note: 'Elevation of the frame on its two foot blocks, the crossed levers, ropes and the inverted tub in the larger tub, the water level dotted; no base slab is drawn.',
  },
  477: {
    remove: ['condensate-path-\\d-marker-\\d', 'transparent-rear-wall-of-outer-box'],
    note: 'Flat section of the box with inlet A, outlet B, seat a a, hollow valve D and its diaphragm on the bridge; no flow beads or rear wall are drawn.',
  },
  478: {
    remove: ['condensate-path-\\d-marker-\\d'],
    note: 'Section of pipe A clamped at B, sphere C, the plunger valve a and loaded elbow lever D with stop screw b; no flow beads are drawn.',
  },
  481: {
    remove: ['dial-work-registering-known-volume-per-drum-revolution', 'fixed-bottom-base-rail', 'visible-index-on-front-face-of-drum'],
    note: 'End section of case A on its saddle, the drum compartments B and the turned-up pipe a; no register dial, base rail or drum index is drawn.',
  },
  482: {
    remove: ['regulated-gas-flow-marker-\\d+'],
    note: 'Section of the regulator under its domed cover, cup H and valve D in their quicksilver channels, lever d and inlet E; no flow beads are drawn. The separate view of valve D is not modelled.',
  },
  483: {
    remove: ['fixed-dial-work-register-housing', 'register-dial-\\d-.*', 'moving-pointer-of-register-dial-\\d', 'tick-\\d-of-register-dial-\\d', 'fill-count-input-wheel-driving-dial-work'],
    note: 'Section of the meter with the two bellows chambers A, A′ and the slide valve B; the dial-work the caption mentions is not drawn.',
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
    remove: ['negative-z-wind-marker-path-\\d+-\\d', '(?:front|back)-face-index-of-pivoted-sail-\\d', 'white-index-fixed-to-first-radial-arm', 'fixed-negative-z-plan-wind-arrow-[13]-(?:shaft|head)'],
    note: 'Plan of the six arms with their pivoted sails, the reference circle and the single wind arrow Brown draws; no beads, indices or extra arrows.',
  },
  490: {
    remove: ['material-marker-on-single-steering-rope-\\d+', '(?:upper|lower)-guide-sheave-white-index', 'white-handwheel-and-barrel-index'],
    note: 'Plan of the wheel edge-on with its handles, the barrel, the two guide pulleys and the tiller; no rope beads or indices are drawn.',
  },
  493: {
    remove: ['central-to-packing-contact-index-\\d', 'fixed-overhead-hoist-eye', 'white-index-of-upward-hoist-direction', 'white-upward-hoist-index-shaft'],
    note: 'Section of the stone with the lewis in its hole and the shackle on the rope; no hoist eye, arrow or contact indices are drawn.',
  },
  498: {
    remove: ['fixed-gauge-support-base', 'fixed-gauge-back-support', 'bored-glass-retaining-clip', 'clip-tab-to-scale-board', 'fixed-zero-through-six-pressure-scale-board', 'equal-level-zero-datum-across-both-legs', 'live-reading-index-at-right-mercury-surface', 'boiler-or-apparatus-connection-flange'],
    note: 'The bent tube, its mercury, the scale marks beside the open leg and the cocked pipe from the boiler; no base, post, clips, board, datum bar or pointer is drawn.',
  },
  487: {
    remove: ['fixed-bearing-A-frame-\\d-leg-(left|right)', 'fixed-bearing-base-rail-\\d', 'fixed-water-volume-intersecting-lower-paddles', 'fixed-waterline-plane', 'fixed-backward-water-path-\\d'],
    note: 'The paddle wheel and its radial paddles; no trestles, base or water is drawn.',
  },
  488: {
    remove: ['fixed-bearing-pedestal-(1|2)', 'fixed-propeller-demonstration-base', 'fixed-water-volume-around-screw-propeller', 'fixed-axial-helical-wake-path-\\d', 'fixed-propeller-shaft-bearing-\\d', 'negative-x-wake-marker-\\d+-\\d+', 'fixed-(?:positive-x-vessel-thrust|negative-x-accelerated-water)-arrow-(?:shaft|head)', 'white-index-fixed-to-first-helicoid-blade', 'white-rotation-index-fixed-to-shaft'],
    note: 'The screw propeller on its shaft; no pedestals, bearings, base, water, arrows or indices are drawn.',
  },
  489: {
    camera: [0.05, 0.05, 1],
    remove: ['fixed-main-bearing-support-leg-(left|right)', 'fixed-feathering-wheel-base', 'fixed-water-volume-under-feathering-buckets', 'fixed-waterline-crossed-edgewise-by-upright-buckets', 'fixed-negative-x-feathering-wheel-wake-path-\\d', 'negative-x-water-marker-\\d-\\d'],
    note: 'Front elevation of the feathering wheel, eccentric e, ring d and cranks c; no stand, base or water is drawn.',
  },
  491: {
    camera: [0.02, 0.04, 1],
    remove: ['white-material-marker-on-capstan-cable-\\d+', 'white-pawl-tip-contact-marker', 'white-rotation-index-on-capstan-head', 'fixed-circular-base-plinth', 'fixed-wide-capstan-base-foot'],
    note: 'Side elevation of the capstan, pawl and bars with the ratchet on the ground line, as Brown draws it; no plinth, cable beads or indices are drawn.',
  },
  492: {
    remove: ['fixed-boat-deck-carrying-fore-and-aft-standards', 'fixed-boat-side-rail-(1|2)', 'boat-detaching-apparatus-2', 'release-rope-attached-to-lower-lever-2', 'reconstructed-common-crossbar-pulling-both-release-ropes', 'common-pull-grip-for-one-operator', 'white-index-showing-release-pull-direction'],
    note: 'One disengaging hook, its tongue and eye lever on the threaded standard, the release rope running off to the right; no second end unit, common pull bar, boat deck or rails are drawn.',
  },
  496: {
    remove: ['fixed-throstle-bed', 'fixed-drawing-roll-bearing-standard', 'fixed-bearing-for-drawing-roll', 'roll-bearing-bridge', '(?:upper|lower)-(?:back|front)-drawing-roll-[AB]-visible-index'],
    note: 'Side elevation of the plain drawing rolls A, B in section and the flyer spindle with its inverted-U flyer and bobbin; no bed, standards, roll bearings or roll indices are drawn.',
  },
  501: {
    remove: ['fixed-barometer-support-base', 'fixed-barometer-back-support', 'bored-glass-retaining-clip', 'scale-board-bracket(?:-tab)?', 'fixed-calibrated-\\d+-through-\\d+-inch-scale-board', 'inch-scale-label-\\d+', 'atmospheric-pressure-arrow-\\d', 'live-inch-reading-index-at-long-column-meniscus'],
    note: 'The bent tube with its mercury and the inch marks at the top of the long leg; no stand, backboard, clips, scale board, numerals, pressure arrows or pointer is drawn.',
  },
  504: {
    camera: [0, 0.03, 1],
    note: 'Side elevation of the wheels A, B, the pinions and the arm, as Brown draws it.',
  },
  507: {
    camera: [0.02, 0.03, 1],
    note: 'Front elevation of the wheels E, F, G, H, the worm C and the arm m n, as Brown draws it.',
  },
  269: {
    remove: ['fixed-post-behind-moving-frame-holding-pinion', 'fixed-base-of-output-shaft-bearing', 'stationary-bearing-around-output-shaft', '(?:upper|lower)-rack-active-pitch-contact', 'visible-no-full-depth-contact-marker-during-relieved-tooth-handoff', 'white-index-exposing-output-reversals', 'white-index-showing-frame-translation-without-rotation'],
    note: 'The frame, racks and spur gear; no post, bearing, contact marker or index is drawn.',
  },
  281: {
    camera: [0.03, 0.01, 1],
    remove: ['white-disk-rotation-index', 'white-lever-vibration-index'],
    note: 'Front elevation of the grooved disk, follower pin and lever on its upper fulcrum; Brown dashes the lever again at its other extreme, and draws no standard under the lever, only the A-frame and plank base; the white indices are not drawn.',
  },
  277: {
    camera: [-0.12, 0.05, 1],
    note: 'Side elevation of the cylinder, ratchet b, dog a, spring c in its hatched block and hammer; the model builds no base, bearing posts, cylinder lock or index markers because the plate draws none.',
  },
  304: {
    camera: [0.05, 0.05, 1],
    note: 'Flat front elevation of the pin wheel and the broad pallet plate hung from its round collet in front of the pins; Brown draws no frame, base, index or contact marker, and the model builds none.',
  },
};
