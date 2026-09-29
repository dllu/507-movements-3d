// Per-movement presentation matched to Brown's engraving, applied after
// construction by src/simulation/source-presentation.js. `rotate` is an XYZ
// Euler (radians) premultiplied onto the model root, `scale` a model-local
// scale (a mirror when one component is -1), `camera` the initial view
// direction in world coordinates after that rotation, and `remove` the
// userData.role patterns (anchored regular expressions; the object name stands
// in for a missing role) of parts the plate does not show. `note` records what the engraving shows. Re-measure display
// profiles (scripts/measure-display-profiles.mjs ID) after changing an entry.
export default {
  72: {
    remove: ['camRearPost', 'camRearBearing'],
    note: 'Side elevation of the hammer A on its socketed pivot, the four-lobed wiper wheel B on its shaft, the anvil block, the bloom and the stepped foundation. Brown draws no post or bearing under B, so none is shown (p60 support policy); B\'s shaft ends as a plain stub behind the wheel.',
  },
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
    note: 'Front elevation of the loose wheel A on its A-frame standard with catch B, cam C, the post and the overhead stop. Brown cuts the view at the ground line and at the right edge. Nothing he does not draw is built (p60 support policy): the driving band\'s two runs leave A\'s rear sheave, run straight on past the right edge and end cleanly (no second pulley or stand), and the pump rope drops through the plinth to a plain pump rod with no crosshead, guides, beds or barrel. The band\'s own sheave sits hidden behind A (only its rim is kept, so the spoke openings stay clear).',
  },
  89: {
    remove: ['bored-crosshead-cheek', 'crosshead-bridge-clear-of-swinging-eye', 'wrist-pin-(?:shank|retaining-head)', 'output-valve-stem', 'fixed-horizontal-crosshead-channel', 'base-rail', 'guide-support-\\d', 'bored-rear-shaft-support'],
    note: 'Front elevation of the sheave, strap and bolted rod flange. Brown breaks the rod off to the right; the model shows it whole to its wrist eye. No crosshead, guides or bed are drawn.',
  },
  90: {
    camera: [0, 0, 1],
    remove: ['guide\\dWeb', 'guideTieBar', 'shaftSupport'],
    note: 'Flat front elevation of the oval yoke with its two rods, the eccentric disk and the shaft. Brown breaks the rods off; they run on whole into the fixed guides his text names, just past the plate edge. No frame is drawn, so the guides stand free (no webs, tie bar or rear shaft bearing; p60 support policy) and the shaft ends as a plain stub. Only the production MuJoCo model is presented; its physics keeps ideal guides and bearings.',
  },
  91: {
    camera: [0, 0, 1],
    remove: ['guide\\d(?:Web)?', 'guideTieBar', 'shaftSupport'],
    note: 'Flat front elevation of the yoke with its upper and lower rods, the triangular eccentric and the shaft. Brown breaks the rods off and draws no guides or frame; the rods run on whole and straight past the plate edge and end cleanly, with no guides, tie bar or rear shaft bearing (p60 support policy). Only the production MuJoCo model is presented; its physics keeps ideal guides and bearings.',
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
    remove: ['spring', 'springSeat', 'guide\\d(?:Web)?', 'rearFrame', 'shaftBearing'],
    note: 'Flat face view of the heart cam on its shaft and the roller-ended bar. Brown breaks the bar off to the right and draws no guide or frame; the bar runs on whole and straight past the plate edge and ends cleanly, with no guides, rear frame or shaft bearing (p60 support policy). No return spring or spring seat is drawn. Only the production MuJoCo model is presented; its physics keeps the inferred return spring and ideal guide.',
  },
  97: {
    remove: ['guide\\d', 'rearFrame'],
    note: 'Face view of the grooved heart cam disk on its shaft with the pin-ended bar in the groove. Brown breaks the bar off to the right and draws no guide or frame; the bar runs on whole and straight past the plate edge and ends cleanly, with no guides or rear frame (p60 support policy). Only the production MuJoCo model is presented; its physics keeps an ideal bar guide.',
  },
  98: {
    camera: [0, 0, 1],
    note: 'Front view with Brown\'s layout (pivot shaft on the right) and the same rotation sense, taken from the arm side without a mirror: the grooved arm in front, its cover lifted in section to show the crank pin in the endless groove, and the opaque disk behind it (Brown views from the disk side and dashes the arm). No frame is drawn (the factory omits it).',
  },
  99: {
    remove: ['frameFoot\\d', 'bearingSpine'],
    note: 'Face view of the spiral guide on the disk, the roller eye and the feed bar in its guide block between the two frame uprights. Brown runs the uprights off the bottom of the plate; they continue straight and end cleanly below the view, with no floor feet, and no rear arm carries the disk shaft (p60 support policy). The small crossbar behind the guide block, hidden in the plate view, joins the drawn block to the drawn uprights. Only the production MuJoCo model is presented; its physics keeps ideal bearings and guide.',
  },
  100: {
    remove: ['rearFrame'],
    note: 'The crank disk with its broad crank and pin in the slotted lever, which turns on its hatched pivot shaft and runs on as the round tail rod. Brown draws no frame; the undrawn rear link bar joining the disk shaft to the lever pivot is not shown (p60 support policy), so both shafts end as plain stubs. Only the production MuJoCo model is presented; its physics keeps ideal bearings.',
  },
  101: {
    remove: ['guideStrap\\d'],
    note: 'The slotted lever hung from its pivot bracket under Brown\'s hatched ceiling, working the pin of the horizontal bar, which slides in two bolted guides. Brown draws the guides free-standing, separate from the ceiling, so no straps hang them from it (p60 support policy). Only the production MuJoCo model is presented; its physics keeps ideal guides.',
  },
  105: {
    note: 'Front elevation of the weighted handle, screw, nut and ram in the frame. Brown breaks the frame off below the ram guide; the frame is modelled whole with its lower jaw, anvil and blank. The default view keeps Brown\'s handle-to-ram composition and carries it on down to the foot of the lower jaw, so the anvil and the blank the ram strikes sit wholly in view. The blank is wider than the ram face, so it stays in sight under the ram when struck.',
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
  132: {
    note: 'Front elevation of the press: the round columns on their plinths under the stepped head, the flared upper disk with its hand lever, the crossed toggle bars and the platen drawn in front of the columns, with the bed block on the ground. No guides are drawn at the platen ends, and none are shown (p60 support policy); the platen hangs from the lower disk.',
  },
  134: {
    remove: ['rear-fixed-pedestal-supporting-drum-axis', 'fixed-foot-of-drum-bearing-pedestal', 'fixed-bearing-behind-drum-hub'],
    note: 'Front elevation of the rope cage: two spoked end wheels with a large hub ring, joined by eight beams parallel to the axis whose ends are Brown\'s eight radial blocks. The rope is wound four turns side by side round the beams, so it lies as Brown\'s broad band on an octagon of straight chords inside the rear flange\'s outer circle, and runs off along the ground line; the cage turns uniformly, so the rope moves at a rate that pulses eight times a turn. No pedestal or bearing is drawn.',
  },
  139: {
    remove: ['bearing-post', 'base', 'roller-post-\\d'],
    note: 'Front elevation of the carriage, internal rack, pinion and top linkage on its two wheels; no post, floor plank or roller posts are drawn. The fixed pinion and roller bearings stay hidden behind the carriage and wheels.',
  },
  142: {
    note: 'Face view of the carrier disk, fixed pinion, planet wheel and crank with the connecting rod running down past the disk and off the cropped plate edge. The rod is whole: it runs on straight past its ideally guided lower joint and ends cleanly below the view. No guide rail, stand or stud post is drawn, so none is modelled; the fixed stud ends as a plain stub behind the carrier.',
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
    remove: ['fixed-rear-column-supporting-beam-axis-clear-of-slider', 'fixed-foot-of-rear-beam-pivot-column', 'fixed-rear-flange-carrying-beam-shaft', 'fixed-bearing-(?:post|ring)-behind-flywheel(?:-hub)?', 'fixed-horizontal-rail-for-reciprocating-small-standard', 'white-index-showing-.*', '.*-white-depth-index', 'bearing-ring-at-moving-standard-wrist'],
    note: 'Side elevation of the spoked flywheel in its pit, the tied rod to the small standard, the upright rod and the one-armed beam turning on the hatched shaft at its right end; no beam column, wheel post, rail or index marks are drawn, and none are shown (p60 support policy). The ground is one solid with the pit, cut in section on the wheel plane; the wheel shaft and the beam\'s fixed shaft end as short plain stubs just behind the hub and the beam. Each pin\'s retaining ring grips its pin and seats on the face of the link it retains; the standard\'s wrist has no loose spacer ring between the standard and the rod.',
  },
  149: {
    note: 'The two cams, the two levers on their common pivot and the two rods broken off below; no rear bearing bar, rod guides or slides are drawn, and none are shown (p60 support policy). The rods end cleanly at Brown\'s break; the lever pivot and cam shafts end as short plain stubs.',
  },
  150: {
    rotate: [0, Math.PI, 0],
    scale: [-1, 1, 1],
    camera: [0.2, 0.02, 1],
    remove: ['fixed-camshaft-bearing-ring', 'fixed-longitudinal-base-rail', 'fixed-transverse-base-tie', 'fixed-camshaft-bearing-post', 'fixed-post-under-right-lever-fulcrum', 'throw-\\d-white-lobe-index', 'throw-\\d-identity-tick', 'sliding-carrier-end-collar', 'invisible-full-selection-and-valve-stroke-envelope', 'white-no-slip-follower-index', 'white-valve-translation-index', 'white-longitudinal-key-and-rotation-index', 'output-guide-(?:-?1|bracket)', 'fulcrum-standoff', 'valve-slide'],
    note: 'Nearly end-on view down the camshaft: the hatched shaft end in front of the sliding cam series, the rocking lever on its right-hand fulcrum and the valve rod; no base, posts, guides or index marks are drawn, and none are shown (p60 support policy).',
  },
  151: {
    remove: ['guide-(?:back|upper|lower)-\\d', 'guide-post-\\d-.*', 'rear-base', 'upper-bearing-(?:arm|rear-tie|post)', 'input-shaft-rotation-mark', 'nut-guide-tongue-\\d'],
    note: 'The opposite-hand screw shaft carried by its two nuts and the upper worm shaft end-on in its bearing ring; no base, posts, upright, nut guides or index mark are drawn.',
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
    note: 'The disk, slotted bell crank and the rod running off below the plate. The rod is whole: it runs on straight past Brown\'s break and ends cleanly below the view. No guide, crosshead, bearings, posts or base are drawn, so none are modelled; the disk axle and the elbow pivot end as plain stubs.',
  },
  157: {
    note: 'The disk, rod, bell crank and the broad output rod hanging from its lower arm, broken off below; no base, posts, guides or bearings are drawn, and none are shown (p60 support policy). The output rod runs on whole past the break and ends cleanly; its guide lies off the plate. The disk axle and elbow pivot end as plain stubs.',
  },
  165: {
    remove: ['output-guide-and-fulcrum-bracket'],
    note: 'Brown draws the wave cam, its upright spindle and the jointed lever with the output bar broken off below; the p55 guide box and bracket are not shown (p60 support policy).',
  },
  171: {
    remove: ['white-index-on-eccentric-sheave', 'white-index-on-link-die'],
    note: 'The eccentrics, rods, curved link, die, the vertical rod and the curved slide on its two guide columns over the trunnion; no white index marks are drawn. Brown draws no base or trunnion bracket, and none are shown (p60 support policy): the guide columns run on and end cleanly and the trunnion shaft ends as a stub behind its bearing face.',
  },
  172: {
    note: 'Brown draws the crank, the link and the rod broken off at the right, the rod carrying his large eye on a crosshead bar; the reconstruction builds no slider, guide frame, back bar, posts or flanges.',
  },
  178: {
    remove: ['fixed-horizontal-guide-rail-for-cutting-slide', 'fixed-end-stop-of-horizontal-output-guide', 'nonrotating-horizontal-cutting-tool-slide'],
    note: 'Brown draws the disk, the slotted crank and the rod broken off to the left; the reconstructed tool slide and its guide rails past the plate are not shown (p60 support policy).',
  },
  181: {
    note: 'Brown draws the two back-weighted handles on their hatched shafts, the catch and the piston rod; no frame, stays or rod guides are drawn or built, so the shafts end flush with their bosses and the whole piston rod runs straight past the plate. The catch is one plate in front; each handle\'s catching face is the end of its own casting in the catch\'s plane, and the working arms lie behind the catch (the upper one dashed on the plate), shown through the see-through catch. No weights are drawn: the three back-weight rods run straight past the plate and end cleanly; the weights remain as loads in the baked MuJoCo solve.',
  },
  182: {
    note: 'Brown draws the two back-weighted handles on their hatched shafts, the catch and the piston rod; no frame, stays or rod guides are drawn or built, so the shafts end flush with their bosses and the whole piston rod runs straight past the plate. The catch is one plate in front; each handle\'s catching face is the end of its own casting in the catch\'s plane, and the working arms lie behind the catch, shown through the see-through catch. No weights are drawn: the three back-weight rods run straight past the plate and end cleanly; the weights remain as loads in the baked MuJoCo solve.',
  },
  183: {
    note: 'Brown draws the handles on their hatched shafts, the two quadrants, the piston rod with its hatched tappet and the back-weight rods; no frame, guide or cylinder is built. Each part lies in the plane his hidden lines give it: the upper C-arm behind the lower quadrant, the upper weight arm and its rod behind the wing, the lower weight arm behind the piston rod; the quadrants in front are see-through. No weights are drawn: the back-weight rods run straight out of the view and end below it in every pose.',
  },
  184: {
    note: 'Plate 184 is plate 183 drawn upside down; the model is the 183 gear reflected top to bottom. Its back-weight arms hang from Brown\'s mid-height pins behind the piston rod and the wing; no frame, guide or cylinder is built, and the rods run straight out of the view.',
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
    note: 'Flat side elevation: the bench is drawn as a plank section under the work, standard, holder, shoe and screw; the standard\'s square shank passes down through a mortise in the bench and ends below it in a short bent foot, as drawn. No index marks are drawn.',
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
    remove: ['white-index-showing-equal-opposite-wheel-speeds', 'single-coincident-inner-outer-pitch-arc'],
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
    remove: ['fixed-(?:longitudinal|transverse)-base-rail', '(?:driver|driven)-shaft-bearing-post', '(?:driver|driven)-shaft-stationary-bearing-ring'],
    note: 'The two hyperboloidal rollers on their shafts; no base, posts or bearing rings are drawn.',
  },
  209: {
    remove: ['instantaneous-common-pitch-contact'],
    note: 'The two focus-mounted ellipses and the solid flat forked horn on the right one; no pitch-contact marker is drawn.',
  },
  212: {
    remove: ['geneva-stop-fixed-base-rail', 'geneva-stop-fixed-bearing-upright', '(?:driver-A|stop-wheel-B)-rear-bearing-arm', 'fixed-(?:driver-A|stop-wheel-B)-bearing', 'geneva-stop-(?:left|right)-transverse-foot', '212-bored-fixed-shaft-support-\\d'],
    note: 'Face view of driver A and stop wheel B; no frame or shaft bearings are drawn, so both shafts end as plain stubs.',
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
    remove: ['crescent-stop-base-rail', '(?:crescent-driver|six-slot-wheel)-bearing-upright', 'fixed-(?:crescent-driver|six-slot-wheel)-bearing', 'crescent-stop-(?:left|right)-foot', '215-bored-fixed-shaft-support-\\d', 'uncut-convex-terminal-sector-highlight', '(?:crescent-driver|six-slot-wheel)-angular-rate-index', 'visible-face-pin-contact-cap', '(?:forward|reverse)-convex-sector-to-(?:upper|lower)-crescent-cusp-contact'],
    note: 'Face view of the crescent driver and the six-slot wheel at Brown\'s pose, the pin on the line of centres in the left slot; no frame, shaft bearings, gold sector strip, white rate indices or contact markers are drawn.',
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
    note: 'Brown draws the crown wheel on its vertical arbor and the pinion on its long shaft running out to the upper right; no pinion-shaft standard or arbor footstep is drawn or modelled, so both shafts end as plain stubs.',
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
    note: 'Face view of the six-point star wheel D in the notch of the anchor, B below it and C at the hooked tip, pivoted at A; the anchor is one flat plate, and no witness marks or edge lines are drawn.',
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
    note: 'Front section through the rod, the weight and the catch, with the probe foot below; the camera looks up from the sea bottom\'s level, so the undrawn bottom is seen edge-on as the lower frame edge (the caption has the weight detach on striking bottom). The loaded rod is lowered onto the bottom, the probe trips the catch and the weight drops free. The rod rises out and goes back into the same weight as it lies on the bottom, its top rim camming the catch in; the weight is then slid up the rod over the catch, which springs out under it, and set down on the seat (an undrawn reset lift of about 1.6 s). No reload gear is shown.',
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
    note: 'Side elevation of the disk with its bevelled rim and wavy face on the bare shaft, and the inclined rod in its two guides. Like the plate, no base, posts, shaft bearings or guide brackets are drawn; the shaft axis and the two guide stations are fixed ideal constraints.',
  },
  276: {
    remove: ['fixed-(?:left|right)-guide-support-post', 'fixed-equal-diameter-cam-display-base', 'fixed-cam-bearing-arm', 'fixed-rear-cam-bearing-post', 'fixed-rear-cam-shaft-bearing', 'fixed-(?:left|right)-straight-bar-guide'],
    note: 'Face-on elevation of the three-lobed cam between the rollers of the level sliding bar; no base, posts, bearing arm, shaft bearing or bar guides are drawn, so the cam shaft ends as a plain stub behind the bar.',
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
    note: 'Face view of the pin wheel with pallets B and C on arm A. The eight pins stand forward from the plain disc; Brown dashes arm A across the wheel, so the arm lies in front of the pin ends and is see-through, carrying the solid pallets B and C back among the pins as one piece. No base, rear plate or bearings are drawn.',
  },
  299: {
    rotate: [Math.PI / 2, Math.PI / 2, 0],
    camera: [0.02, 0.02, -1],
    remove: ['crown-wheel-rotation-witness', 'weighted-horizontal-foliot-regulator'],
    note: 'Nearly edge-on view along the verge, cropped along the crown edge to about two pitches of the near band, as Brown’s strip is, with the wheel ends running out of view: the concave-backed raked teeth with the far teeth nearest the verge seen through their gaps, the verge journal end-on above and the two pallets about 108° apart, the steep one hanging down-left and the shallow one lying out to the right. Brown crops the foliot out of the detail, so it is not shown.',
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
    note: 'Flat parts in Brown\u2019s planes: the windowed thirteen-tooth wheel, the crescent with pallets A and B over the forked lever, pallet C on the balance staff and the balance disc behind, cut down on its left from a notch to C as Brown draws it, with the banking pins; as Brown draws no frame, the arbors and pins end as plain stubs behind the disc.',
  },
  309: {
    remove: ['fixed-Mudge-escapement-frame', 'pendulum-rod-between-P-and-Q', 'pendulum-bob', 'pendulum-suspension-eye', '(?:.*-)?white-.*witness'],
    note: 'Front elevation of the wheel and the two flat pallet plates on their arbors C, each with its lifting face, locking notch and ball weight, and the half-forks down to pins P, Q, with only the end of the fixed suspension stud between the arbors; Brown omits the pendulum rod and bob, and no clock frame, crossbars, bearing brackets or index marks are drawn.',
  },
  310: {
    remove: ['pendulum-bob', 'single-wheel-bearing-bracket', '(?:.*-)?white-.*witness', '(?:.*-)?beat-pin-tip-witness'],
    note: 'Front elevation of the lyre-shaped gravity legs under the T crossbar, the three-legged wheel with its fly and stops D, E; as Brown dashes it, the pendulum rod hangs behind the whole escapement, just behind the pivot block and arbor end; Brown\u2019s beat collar is a deep clamp block reaching forward from the rod to just behind arm B, so the beat pins are short; it runs out of the bottom of the plate with no bob, and no wheel bracket or index marks are drawn.',
  },
  311: {
    remove: ['pendulum-bob', 'double-wheel-bearing-bracket', '(?:.*-)?white-.*witness', '(?:.*-)?beat-pin-tip-witness'],
    note: 'Front elevation of the diamond of gravity legs, the double three-legged wheel and the long fly; the pendulum rod Brown breaks off below the wheels is modelled whole in front of them and see-through, and runs out of the bottom of the plate with no bob, and no wheel bracket or index marks are drawn.',
  },
  312: {
    remove: ['fixed-bloxam-support-frame', 'bloxam-pendulum-bob', '(left-A-E|right-B-F)-anti-double-impulse-reinforcement-wire', 'documented-point-two-inch-primitive-diameter-ring', '(?:.*-)?white-.*witness'],
    note: 'Front elevation of the two wheels and the gravity arms hung from C; E and F are flat oblong tabs of the arm metal, as Brown\u2019s slots, and the trapezoid outline is the arms themselves, with no separate support frame drawn. Brown\u2019s dashed pendulum line runs through open space above the wheel too, so it is his centre line: the rod hangs from the stud at C just in front of the arms, see-through, with the small wheel behind the arms (E and F sit inside the large wheel\u2019s spokes, so the rod cannot hang behind that wheel), and no bob is drawn.',
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
    note: 'The three-armed balance, spring with stud R and curb pins P on the regulator lever, pointer T over the graduated SLOW/FAST band; no stud bracket or balance cock is drawn (the regulator\'s fixed ring stays concentric with the staff, hidden under the lever\'s ring).',
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
    note: 'Great wheel G, the ratchets, click R, spring S-S\', detent T pivoted at its eye and the weight on barrel B; no frame beam, back bar, bearing or white indices are drawn.',
  },
  323: {
    remove: ['visible-axle-C-identification-collar'],
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
    note: 'Brown draws the beam, parallel bars and the fixed radius pin F with no frame; F is a short bare pin through the radius rod\'s eye (an ideal fixed pivot) with no bracket or column behind it.',
  },
  338: {
    note: 'Brown draws the beam, parallel bars and the fixed radius pin F with no frame; F is a short bare pin through the radius rod\'s eye (an ideal fixed pivot) with no bracket or column behind it.',
  },
  348: {
    remove: ['fixed-shaft-pedestal-leg-\\d', 'fixed-base', 'fixed-base-edge', 'fixed-external-guide-rail-(left|right)', 'fixed-external-guide-support-\\d', 'fixed-external-guide-top-bridge', 'fixed-rear-shaft-bearing-bridge', 'rod-B-circular-pin-sliding-in-explicit-vertical-guide', 'guide-pin-white-center-index', 'disk-A-white-rotation-index', 'rod-B-white-rocking-index'],
    note: 'The disk A with its crossed slots at about 29 degrees and slides c, and the bar B broken off above the disk; no stand, base, external guide, guide pin or white indices are drawn.',
  },
  350: {
    remove: ['fixed-wide-base', 'fixed-base-edge', 'lower-input-direction-dash-\\d+', 'fixed-upper-pin-rear-support', 'white-traverse-index-on-output-bar', 'output-bar-motion-rib-\\d', 'moving-pin-D-green-front-index'],
    note: 'The slotted link with its two pins, the short bar with its riser and guides a, a; the lower pin\'s drive is only a dotted line on the plate, so D rides on one plain round rod laid along that line, in a bored shoe centred on it; no dashes, base, pin post or indices are drawn.',
  },
  351: {
    remove: ['fixed-stamp-machine-base', 'fixed-anvil-below-falling-stamp', 'fixed-workpiece-at-lower-impact-stop', '(?:upper|lower)-C-shaped-rack-guide-open-to-teeth', 'fixed-bearing-for-horizontal-pinion-shaft'],
    note: 'The broad rack rod between its two broad collars, cut with eight teeth for the pinion\'s eight running up to the top collar, which overhangs only the plain side so it clears the pinion when the stamp rests (Brown\'s also overhangs the teeth), the stamp head below and the mutilated pinion on its cut shaft; no base, anvil, workpiece, rod guides, bearing or back bar is drawn, so none is shown.',
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
    note: 'Plan of the carriage: the fusee on its shaft with the crank at the large end, Brown\'s two long flat side bars running from under the wheel frame past the crank and off the plate, the cross bar carrying the crank-end bearing, the cross-member and bed carrying the two edge-on wheels on their axles, and the band crossing the fusee; no guide rail or travel ticks are drawn under the wheels.',
  },
  354: {
    rotate: [0, Math.PI, 0],
    camera: [0.086, 0.043, 1],
    remove: ['visible-radial-index-on-input-disk', 'visible-linear-index-on-output-stem'],
    note: 'Brown\'s view from the disk side: the disk, with its raised ring on the viewer\'s face, is see-through (he dashes what it covers), and behind it the crosshead\'s blind endless groove carries the wrist, with the one straight stem on the crosshead\'s back face. Both stems are framed through their guides over the whole stroke. Like the plate, only the two guide blocks are drawn: no rear frame, brackets or shaft bearing; the guides and the input axis are fixed ideal constraints. No white indices are drawn.',
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
    note: 'Face view of the two U-shaped halves joined by the two swivel nuts, made up tight with both nuts level as drawn, then loosened two turns and tightened back; no white rotation indices are drawn.',
  },
  368: {
    camera: [0, 0.03, 1],
    scale: [1, 1, -1],
    note: 'Flat elevation from the rack side, mirrored front-to-back to the plate: the table edge-on, the horizontal bevel wheel on the left driven by the upright bevel on the crank shaft, the rack in front of its spur pinion and see-through so both toothed members show as Brown draws them in mesh (the near-side rack keeps his spiral sense), the crank on the right, and the plain cylinder below with its spiral line and the rack-borne marking arm.',
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
    remove: ['fixed-bearing-standard-outside-wheel-cage(?:-front)?', 'fixed-overhung-arm-carrying-wheel-bearing(?:-front)?', 'fixed-base-rail-for-treadwheel-frame(?:-front)?', 'fixed-side-bearing-for-treadwheel-axle(?:-front)?', 'white-index-.*'],
    note: 'Face view of the treadwheel: the riveted rim, the square lattice of crossing bars round the sectioned axle and the horse walking inside. Brown draws no trestle, standard or base rail, so the axle ends as plain stubs either side of the wheel; no white index is drawn.',
  },
  377: {
    camera: [1, 0.32, 0.62],
    remove: ['fixed-treadmill-foundation', 'white-index-.*'],
    note: 'Level side view of the treadmill (Brown mixes an end view of the wheel with a side view of the drum; the camera sits between, nearer the side): the notched spur wheel on the near end of the axle behind its flared A-frame standard on a plank, the long diagonal side bar in front, and the drum running off to the right with the man, back to the viewer, stepping up its boards and holding the rail before him. The rail ends at the side bar, fastened by one bolt through the hole Brown draws near its top; no foundation slab, rail posts, bracket or white index are drawn. Pass 101: the man climbs upright on the drum\'s upper quarter, where its treads form a stair, so the camera is raised about 15 degrees: he then stands among the treads, with steps above his feet, as Brown draws him.',
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
    camera: [0, 1, 0.1],
    remove: ['white-.*', 'workpiece-longitudinal-grain-line'],
    note: "Brown's two figures (transverse section above, plan below) are two views of one clamp; the model builds it once and matches his main figure, the plan: looking down on the bed with the throat at the left, the cheeks diverging from it, the wedges driven along them and the board running off to the right. The white datums and grain lines are not drawn.",
  },
  382: {
    remove: ['white-stem-height-and-yaw-index', 'white-mirror-orientation-index'],
    note: 'The broad rounded mirror frame on its hinge and stem above the turned baluster pillar and stepped foot; no white indices are drawn.',
  },
  383: {
    remove: ['white-winding-roll-rotation-index', 'white-dressing-cylinder-rotation-index', 'moving-transverse-cloth-material-registration-stripe'],
    note: 'End elevation of the arched end plates (flanged rim, ribs under the rolls, see-through near web) bearing the two winding rolls and the spoked brush cylinder with its eight bristle boards between them, the cloth running on its S path; no white indices or cloth stripes are drawn.',
  },
  384: {
    camera: [0.3, 0.36, 1],
    remove: ['stationary-drawing-and-transfer-paper', 'white-wheel-spin-index-on-(?:near-face|tread)', 'stationary-reference-index'],
    note: 'Oblique side view (turned about 17° and raised about 20°, so the wheel\'s face shows as Brown draws it) of the point, screw-threaded arm and the solid milled wheel with its long nut, framed on the arm\'s whole sweep round the point; no paper or white indices are drawn.',
  },
  385: {
    remove: ['fixed-vertical-door-jamb', 'fixed-door-frame-lintel', 'one-of-four-door-face-trim-bars', 'door-opening-handle', '(frame|door)-side-white-pin-turn-index', 'white-toggle-height-index', 'white-weight-height-index', 'fixed-wall-beside-door-opening', 'moving-door-panel', 'one-of-three-fixed-axis-door-hinge-barrels', 'fixed-hinge-leaf-on-wall', 'door-hinge-leaf-on-door', '(frame|door)-pin-socket-bracket'],
    note: 'The two long upright pins, each ending in a plain eye beside its link\'s eye, the toggle links and the small pear weight hung on an S-hook from the apex pin. Brown crops the pins and draws no door or wall, so neither is drawn here: each pin turns in one plain bearing boss, the socket fixed to the frame and the socket fixed to the door, which carries its pin round the (undrawn) hinge axis as the door opens. No lintel, jamb, trim, handle or white indices are drawn.',
  },
  387: {
    note: 'Side elevation of the one wharf ladder, level at high water as in Brown\'s upper figure; the animation carries it down to the boat at low water, his lower figure, so it is not drawn twice. The wharf rail panels (posts with ball finials, top and bottom rails, crossed braces) are joined to the fixed ladder posts. The tide is a shallow translucent surface layer, fading with depth, for Brown\'s surface lines, and the dinghy is his length, about 0.31 of the ladder. The factory omits the undrawn white rail and tread indices.',
  },
  388: {
    remove: ['white-.*', 'fixed-planer-feed-roller-bearing-frame'],
    note: 'The smooth and toothed rollers and the board between them, seen in section through the shafts; the toothed roller\'s shallow raised hub boss gives Brown\'s inner face circle. Brown draws no bearings, standard or foot, so the shafts end as plain stubs. No white indices are drawn.',
  },
  389: {
    remove: ['white-.*', 'fixed-front-rack-guide-strap', 'wide-jack-foot', 'fixed-rear-rack-guide-cheek'],
    note: 'Section of the cast jack stand, flaring into stepped feet either side of the rack, with Brown\'s curved strap pawl and upper stop, both noses seated in the root under a tooth\'s flat face; the white indices, the front rack straps cut away by the section, the rear guide cheek and the sole plate are not drawn. The eccentric shaft and stop-pawl pin run in bearing bosses carried by a rear spine and bridges, kept behind the rack and pawls so the default view still reads as the plate.',
  },
  390: {
    remove: ['fixed-two-shaft-rectifier-bearing-frame', 'white-.*', 'piece-A-rigid-radial-web', '.*-fixed-material-marker'],
    note: 'The semicircular piece A on fulcrum a, flywheel B and bands C, D. Brown draws no frame, upright or foot: the fulcrum pin and the flywheel shaft end as plain stubs. No web inside A, band markers or white indices are drawn.',
  },
  391: {
    remove: ['fixed-frame-carrying-guide-grooves-and-output-bearing', '(?:.*-)?white-.*', 'reciprocating-input-piston-rod'],
    note: 'The D-shaped guides b, racks A, A1 on their weighted crosshead, cog wheel and elbow lever C: its curved arm, its short arm with the small knob under its tip, carried on C, spring d, and the short link hung from C that bears on the top of A1. C and the spring\'s far end stand on bare fixed pins, as drawn; no frame, input rod or white indices are drawn.',
  },
  392: {
    remove: ['fixed-gig-saw-machine-bed', 'white-.*', 'rear-saw-guide-standard', 'rear-standard-riser-to-spring-bracket', 'fixed-spring-bracket-arm', 'spring-bracket-clamp-stud', 'guide-cheek-to-rear-standard', 'fixed-crankshaft-bearing-standard', 'bored-fixed-crankshaft-journal'],
    note: 'The saw, its upper and lower guide cheeks and the table, the crank wheel and the spring clamped at its right-hand end; no machine bed, rear standards, spring bracket, crank standard or white index is drawn.',
  },
  393: {
    remove: ['white-.*', 'fixed-overhead-bearing-standard', 'fixed-overhead-shaft-bearing-arm', 'fixed-bearing-around-upright-rotating-shaft'],
    note: 'The upright spindle and its head, the clamp block on its foot with the set-screw holding the bent carrier, whose tail stands out through the block, the ball joint and cup on the lens, which rests on the table plank; no overhead standard or bearing is drawn.',
  },
  394: {
    note: 'Face view of the endless rack, toothed all round its inside, with the ten-tooth pinion on the upper row and the larger of its two concentric flanges behind it, its top running hidden in the rack as Brown dashes it; the smaller flange and the stepped side grooves lie behind. The rod runs off right to its end collar. Brown draws no frame, so the pinion shaft ends as a plain stub behind.',
  },
  396: {
    remove: ['fixed-watch-escapement-base', 'rear-watch-plate-bearing-standard', '(?:escape-wheel-a|balance-b|lever-c)-fixed-bearing-boss', 'white-.*'],
    note: 'The wheel A, plain-rimmed balance B, straight lever C with its crook d and banking pins l, the one-piece anchor-like cross-piece h whose two arms end in pallets g and f in the wheel\'s plane, and the roller pin i working in the slot of fork e; no watch plate, its bearing bosses or white indices are drawn, so the staffs end as plain stubs.',
  },
  397: {
    remove: ['white-.*', 'fixed-machine-base', 'fixed-horizontal-shuttle-guide-rail', 'fixed-rear-standard-to-(?:crank-bearing|shuttle-guide)', 'fixed-shuttle-guide-bracket', 'fixed-shuttle-guide-channel-(?:back|top-lip|bottom-lip)', 'fixed-crank-bearing-boss'],
    note: 'The flat shuttle bar, its link, the slotted S-rocker on its grounded foot pivot (Brown hatches the ground under it) and the crank; no machine base, pillar, crank bearing or table guide is drawn.',
  },
  398: {
    remove: ['white-.*'],
    note: 'The cam C with its three-sided groove, the roller crosshead in its guide, the rod and the plain output disc with its crank. The groove is re-derived from the slider-crank so the disc turns fully round at varying speed (three turns per cam turn). No base, legs, rear frame or white indices are drawn, so both shafts end as plain stubs.',
  },
  386: {
    camera: [0.08, 0.05, 1],
    remove: ['white-.*', 'closed-round-pole-cross-section-reference-ring'],
    note: 'Front elevation of the open ladder, Brown\'s principal (left) figure; his partly open and closed figures are later phases of the same fold cycle. The white indices and brass section ring are not drawn.',
  },
  395: {
    camera: [0, 0.02, 1],
    remove: ['white-.*', '.*-fixed-external-port-pipe', 'explanatory-fixed-pipe-flow-indices', 'passage-[AB]-flow-direction-index', 'plug-operating-stem', 'quarter-turn-operating-handle', 'fixed-ninety-degree-handle-travel-reference'],
    note: 'The plug in its bored body, sealed: the plug\'s two closed quarter-circle passages (seen through the see-through plug) meet the body\'s four closed port ducts, which run out as Brown\'s curved port pipes. Brown\'s two figures are its two positions a quarter turn apart, which the single animated plug turns through. Steam enters at the top, the cylinder ports are right and left and the exhaust is below. No handle or flow markers are drawn.',
  },
  400: {
    camera: [0, 0.08, 1],
    remove: ['fixed-four-motion-feed-base', 'fixed-camshaft-bearing-support', 'bored-fixed-camshaft-bearing', 'fixed-work-plate-(?:left|right)-of-feed-dog-slot', 'fixed-horizontal-guide-for-carrier-A', 'white-.*', 'fixed-back-bar-pillar', 'fixed-back-bar-foot', 'fixed-bored-camshaft-pedestal', 'fixed-camshaft-pedestal-foot', 'fixed-back-bar-behind-carrier-A', 'fixed-c-guide-round-rear-rail-of-A', 'fixed-strap-carrying-return-spring-stop'],
    note: 'Side elevation of the forked bar A running out to the feeder, B\'s toothed end beyond it, the thin cam C on its long bare shaft and the return spring; no base, bearings or their supports, work plate, back bar, C-guides for A, spring-stop strap or white indices are drawn (A\'s slide and the spring stop are fixed ideal constraints).',
  },
  401: {
    remove: ['fixed-floor-base', 'fixed-wheel-shaft-standard', 'fixed-treadle-pivot-standard', 'fixed-standard-cradling-faceplate-shaft-bearing', 'fixed-faceplate-standard-foot', 'fixed-pedestal-cradling-treadle-fulcrum-bearing', 'fixed-treadle-pedestal-foot'],
    note: 'The faceplate wheel, tangent slide A, B, pitman and treadle; no floor or standards are drawn.',
  },
  402: {
    remove: [],
    note: 'Face view of the two open balance rims (plain rims joined to their hubs by see-through webs) crossing so the toothed arm shows, their pinions meshing the internal teeth (upper) and external teeth (left) of lever B\'s single curved arm, anchor A one plate with B, and the twelve-tooth escape wheel in the same plane; the bar Brown draws in front of the wheel from B\'s pivot to the wheel\'s centre is the fixed bridge carrying both arbors, see-through where it covers the teeth he dots.',
  },
  403: {
    remove: ['(?:left|right)-sloping-rule-guided-by-(?:left|right)-chord-pin-end-index-[12]', '(?:left|right)-sloping-rule-guided-by-(?:left|right)-chord-pin-pin-contact-working-edge', 'laid-out-(?:chord-line|versed-sine)', '(?:left|right)-fixed-chord-end-guide-pin-white-cap'],
    note: 'The two sloping rules crossed at the pencil and braced by the third rule, sliding against the two pins at the chord ends, which stand in a plain drawing board carrying the traced arc; no end indices, painted working edges, white pin caps or laid-out chord and versed-sine construction lines are drawn.',
  },
  404: {
    remove: ['(?:left|right)-white-roller-angular-index', 'given-required-arc-point-[123]'],
    note: 'The straight bar with its two end standards and rollers, the elastic arched bar and the central screw with Brown\'s wing thumbscrew (a collar, then a flat head with a neck and two round lobes); no index marks or given points are drawn.',
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
    remove: ['fixed-drawing-board-presentational-support-not-source-hardware', 'fixed-drawing-board-border', 'mirrored-right-jamb-reference-for-complete-arch', 'given-right-springing-point', 'given-left-springing-point', 'given-pointed-arch-apex', 'white-upper-edge-of-horizontal-bar-on-springing-line', 'white-slide-position-index', 'upper-working-edge-tangent-to-jamb-and-meeting-apex'],
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
    note: 'Face view of scroll plate A, its toothed band wound 2 3/8 close turns from the inner end at 9 o\'clock to the cut outer end, with the tapered pinion B (small end toward A\'s centre) sliding on the feathered shaft that crosses in front. Brown draws no frame; the shaft is cropped by the view.',
  },
  415: {
    remove: ['fixed-coaxial-wheel-and-lever-bearing-frame', 'wheel-D-spoke-fast-with-rim-and-hub', 'white-wheel-D-intermittent-rotation-index', 'white-lever-A-oscillation-index', 'selectable-(?:left-pawl-B|right-pawl-C)-white-rim-contact-index'],
    note: 'The plain light disc wheel D with its slim rim, lever A with its pawls B and C (engaged C lying nearly flat, lifted B at about 47 degrees) and crank E, and the flat bar D with its eye on the lever-tail pin running straight off to the right past Brown\'s crop; no frame, guide, spokes or white indices are drawn.',
  },
  416: {
    camera: [0.2, 0.06, 1],
    note: 'Near-face elevation of the plain flywheel disc and crank B, spring A coiled on its keyed arbor with its tail hooked to crank pin B, the pitman, and the slim treadle bar on its intermediate pivot lug. Brown draws no frame, so arbor A, the crankshaft and the treadle pivot are short fixed stubs.',
  },
  418: {
    note: 'Section of the conical casing on the chest cover with its recess, the suspended guide D on its adjusting screw, valve A, rod B and roller C. A is a D slide valve on its seat over Brown\'s three ports, which run down into the cylinder casting (his hatched ground): the middle one educts, the outer ones lead to the cylinder ends. Translucent steam fills the chest and the steam port A uncovers; the exhaust port and the port joined to it through A\'s hollow are faint.',
  },
  419: {
    remove: ['representative-cradle-body-on-rocker-E'],
    note: 'Front elevation of the plain discs B and A with the crank link, the bands from posts C and D over B, and rocker E on the hatched floor line; no cradle body block is drawn. Brown draws no support for the A and B axles, so they end as plain stubs just behind the discs.',
  },
  420: {
    camera: [0.08, 0.02, 1],
    remove: ['fixed-overhead-bell-support'],
    note: 'Side elevation of the hammer on its bracket with the under-lever return spring on the plank, and the bell with its canon loop; Brown draws no support for the bell, so it hangs on a minimal pin and short beam from a wall plate behind it, hidden by the bell in this view.',
  },
  421: {
    note: 'The sectioned cylinder with its head, stuffing box and bottom, the trunk piston closed under the pitman pin, the pitman and the crank on its bare shaft; Brown\'s dotted crank-pin circle is notation and is not drawn, nor is a crankshaft standard (the shaft axis is a fixed ideal constraint). A port in the head and one in the bottom carry the steam; translucent steam shows high-pressure steam above the piston on the down-stroke and the same steam working expansively below it on the up-stroke.',
  },
  422: {
    note: 'Section of casing A on its foot: the sector chamber with vane piston B on rock shaft C, the curved tongue closing its top, the two passages from the valve face running over the tongue and down round its ends into the chamber corners, and slide valve D in its chest with the exhaust port under it; translucent steam fills the space behind B and the chest, the exhausting space is faint.',
  },
  423: {
    note: 'Section of Root\'s double-quadrant engine on its cast frame: one open cavity holding both single-acting pistons B on their pivots with the common crank D between them, the top passage over the curved wall of the upper quadrant turning down round its end, the right passage down behind the end wall of the lower quadrant, and the rocking plug valve a under the inlet; the space between the pistons is not walled off and exhausts through the back. Brown\'s dotted crank circle is notation and is not drawn. Translucent steam fills the spaces joined to the inlet; exhausting spaces are faint.',
  },
  424: {
    camera: [0, 0, 1],
    note: 'Section of the oblong cylinder A (front cover removed) with frame piston B, piston C nested in it and wrist a in C; Brown\'s dotted crank b works in a pocket behind C and its shaft runs out through the back cover. The black ports are passages: B\'s in A\'s end walls, C\'s in A\'s top and bottom walls, reaching C through slots in the back of B\'s top and bottom walls. Translucent steam fills each working space while it grows; shrinking spaces are faint.',
  },
  425: {
    camera: [0.08, 0.05, 1],
    note: 'Section of cylinder A with its two port necks and the guide of abutment D, eccentric piston C on central shaft B with its packing strip on the contact line, and D riding on C. Translucent steam fills the space from D round to the contact line once the right neck admits to it; the space ahead of the contact line, swept to the left neck, is faint.',
  },
  426: {
    camera: [0.08, 0.05, 1],
    note: 'Section of the cylinder on its cast foot with the two abutments D where it closes on hub C, and two channels in each neck, one either side of its abutment; pistons A slide in the grooves of C and follow the cylinder wall. Translucent steam fills the spaces joined to the induction channels; the spaces joined to the eduction channels are faint.',
  },
  427: {
    camera: [0.08, 0.05, 1],
    note: 'Section of the cylinder on its cast foot with its two port necks, hub C on the eccentric shaft B touching the bore at the top, and pistons A passing through the rolling packings a; the rings that keep A radial turn on a hub centred on the cylinder and are seen through the front web of C (Brown dots them). Translucent steam fills the space behind the piston that has passed the right neck and, expanding, the space between the pistons until the leading piston reaches the left neck; the swept space is faint.',
  },
  428: {
    camera: [0.08, 0.05, 1],
    note: 'Section of the round casing on its cast foot with its two port necks, each with two channels either side of the clamp that holds the india-rubber lining E; arms B carry rollers A that pinch E against the bore. Translucent steam fills the space behind the rubber where it is pressed in against the rollers; exhausting spaces are faint.',
  },
  429: {
    camera: [0.08, 0.05, 1],
    note: 'Section of the one-piece two-lobed casing (solid back cover, cut on the front plane) with its top induction and bottom eduction channels and the two toothed elliptical pistons filling the bores\' depth, as Brown draws it; no stand or painted packing marks are drawn. Translucent steam fills the space between the pistons at the top and the pockets they carry round against the bore; the space at the bottom, into which each pocket is released, is faint.',
  },
  430: {
    camera: [0.08, 0.05, 1],
    remove: ['falling-feed-water-droplet-\\d+', 'shaft-connected-bearing-pedestal', 'fixed-overshot-wheel-foundation'],
    note: 'Side elevation of the overshot wheel under the headrace, in its masonry pit whose breast falls from the flume and curves close round the lower left of the wheel to the tail floor, as Brown draws it. Brown draws no bearing or pedestal, so the shaft ends as a plain stub. No rotation marker is drawn. Brown’s buckets are bent, slanted boards holding the water down the descending side. The feed runs along the headrace and pours off its end as one continuous sheet on a projectile path into the buckets; the spilled water falls from the lower right as one sheet to the tail floor; no droplet beads ride either.',
  },
  431: {
    camera: [0.08, 0.05, 1],
    remove: ['bottom-stream-flow-marker-\\d+', 'submerged-paddle-impulse-indicator-[123]', 'bored-fixed-water-wheel-bearing', 'shaft-connected-bearing-pedestal', 'front-bearing-pedestal-footing'],
    note: 'Side elevation of the undershot wheel, sluice and race, as Brown draws it; no flow beads or impulse dots are drawn. Brown draws no axle support, so the shaft ends as plain stubs either side of the hub.',
  },
  432: {
    camera: [0.08, 0.05, 1],
    remove: ['breast-wheel-inlet-flow-marker-\\d+', 'bored-fixed-water-wheel-bearing', 'shaft-connected-bearing-pedestal'],
    note: 'Side elevation of the breast wheel, sluice and race, as Brown draws it; no flow beads are drawn. Brown draws no axle support, so the shaft ends as plain stubs either side of the hub.',
  },
  433: {
    camera: [0.6, 0.42, 1],
    remove: ['falling-jet-motion-marker-\\d+'],
    note: 'Raised side view of the flat-bladed runner on its hanging shaft, the open spout climbing away out of the picture to the upper right and its jet striking the near right-hand blades, as Brown draws it; the runner turns clockwise seen from above, so the broken water falls under its right and front; no floor disc, basin or jet beads. The water runs down the spout and falls as one continuous sheet on its projectile path; the broken water drops from the floats as thin falling sheets and drops.',
  },
  434: {
    camera: [0, 1, 0.12],
    remove: ['continuous-center-to-circumference-water-path-\\d+', 'outward-flow-marker-path-\\d+-particle-\\d+', 'circumferential-outward-water-discharge'],
    note: 'Plan of the eight fixed curved guides A inside the heavy ring and the outer wheel B with eighteen oppositely curved buckets, in Brown’s proportions. Streamline tubes, flow particles and the hose-like discharge ring of the offline model are flow notation and are not presented; the water shows as one continuous translucent sheet per guide passage, thrown off the rim.',
  },
  435: {
    camera: [0, 1, 0.12],
    remove: ['continuous-outer-guide-to-central-discharge-path-\\d+', 'inward-flow-marker-path-\\d+-particle-\\d+', 'circumferential-water-supply-to-fixed-outer-guides', 'water-discharging-downward-at-turbine-center'],
    note: 'Plan of the fixed outer guides a (radial at the rim, bending to run tangentially into the wheel) and the inner wheel b, in Brown’s proportions, with the shaft end in the hub. The water shows as one continuous translucent sheet per representative passage, falling through the open centre. Streamline tubes, flow particles and the hose-like supply ring of the offline model are flow notation and are not presented; nor is the ring of discharge water that hung free below the runner centre (Brown leaves the centre open).',
  },
  436: {
    camera: [0.04, 0.02, 1],
    remove: ['continuous-axial-flow-path-through-guide-a-and-runner-c-\\d+', 'downward-flow-marker-path-\\d+-particle-\\d+'],
    note: 'Sectional elevation of the case b under its top cover, the broad chute entering at upper right, the helical shutes a over the helical wheel c and the step on its bridge, as Brown draws it; the trunk wall is open across the chute mouth. No overhead beam, base disc or tailwater disc is drawn. Flow paths and particles are notation and are not presented; the water runs down the chute as one continuous sheet into the trunk, which stands full over the shutes (both cut on the section plane).',
  },
  437: {
    camera: [0, 1, 0.12],
    remove: ['fixed-foundation-under-volute-wheel', 'fixed-upper-bearing-of-volute-wheel-shaft', 'bored-upper-bearing-crossbeam', 'upper-bearing-support-post', 'clockwise-volute-flow-marker-\\d+', 'lower-escape-flow-marker-path-\\d+-particle-\\d+', 'water-escaping-down-through-inclined-bucket-opening-\\d+', 'tailwater-basin-below-inclined-outlet-buckets'],
    note: 'Plan of the scroll case and wheel with its guides a and floats c, as Brown draws it; no foundation or upper bearing bridge is drawn. Flow markers and the thin escape-path tubes under the runner are notation and are not presented. The water fills the scroll passage and the vane ring to one level, fed through the open inlet duct, and falls away in sheets below the bucket openings; the free-floating tailwater disc is not presented (Brown draws no tailrace).',
  },
  438: {
    camera: [0.08, 0.2, 1],
    remove: ['visible-reaction-mill-shaft-rotation-marker', 'inlet-water-marker-\\d+', 'tangential-exhaust-marker-arm-\\d+-particle-\\d+', 'tangential-outlet-collar-\\d-of-four'],
    note: "Elevation of the Barker's mill arms, hollow shaft and funnel, as Brown draws it; no white rotation marker is drawn. The bent nozzles end as plain open pipe ends, as Brown draws them, with no collars on their mouths. The arms throw continuous water jets; the flow beads of the offline model are not presented. The view is a little from above, as Brown's open funnel shows; the flume is an open trough whose water pours from its lip in one continuous stream into the water standing in the funnel. Brown crops the flume at the plate edge; beyond it the trough runs on straight along its own slope well past every rotated view (no undrawn trestle).",
  },
  439: {
    camera: [0.08, 0.35, 1],
    remove: ['visible-oscillating-pulley-rotation-marker', 'material-marker-moving-continuously-on-single-rope', 'continuous-fall-water-marker-\\d+', 'fixed-overhead-pulley-support-beam', 'bored-pulley-shaft-hanger', 'fixed-pulley-support-post', 'fixed-ground-beneath-bucket', 'ground-anvil-opening-bucket-valve', 'fixed-post-carrying-upper-end-of-flume'],
    note: 'The pulley, rope, bucket with its projecting valve stem, counterweight and water stream; no gallows frame, ground, striking anvil, white pulley stripe or rope marker is drawn. No flow beads in the falling stream.',
  },
  440: {
    camera: [-0.18, 1.0, 1],
    remove: ['fixed-(?:left|right)-trough-travel-stop', 'continuous-inlet-flow-marker-\\d+'],
    note: 'View of the wedge-shaped double trough on its pivot standard, braces and open plank frame under the inlet flume, which Brown breaks off and which ends just beyond the crop with its water; no angle index or travel-stop blocks are drawn. No flow beads in the falling stream. The view is from the left and well above, so the water standing in the raised half shows over its front wall; the flume ends cleanly just past the crop. The flume water and its fall are one continuous stream landing beside the divider foot in the raised half; each half empties from its open outer end in one falling stream as it tips.',
  },
  441: {
    camera: [0, 0.01, 1],
    remove: ['fixed-persian-wheel-base', 'fixed-hollow-shaft-bearing-standard', 'fixed-(?:rear|front)-hollow-shaft-bearing', 'fixed-high-level-trough-receiving-tipped-bucket-water', 'fixed-outboard-receiver-standard', 'fixed-receiver-to-standard-bridge', 'rightward-driving-stream-marker-\\d+', 'inward-moving-float-water-marker-\\d+', 'visible-hollow-shaft-rotation-index'],
    note: 'Front elevation of the Persian wheel with its light rim, curved floats, hollow shaft and hung buckets over the stream. The caption\'s stationary pin tips each bucket at the top, shown on a minimal arm and post; no base slab, trough or white current/rotation markers are drawn. Brown draws no axle support, so the hollow shaft ends plainly either side.',
  },
  442: {
    camera: [1, 0.58, 0.30],
    remove: ['fixed-eisach-wheel-base', 'fixed-river-bed-under-pot-wheel', 'rightward-river-current-marker-\\d+', 'visible-pot-wheel-rotation-index'],
    note: 'Brown looks across the stream nearly along the wheel plane: the axle runs left to right on its trestles, the pots show between the rims and the trough runs off to the left over the ruled stream. No base slab, box bed, water box, current markers or rotation index are drawn. Pass 102: the camera looks down about 30 degrees (it was 15), as Brown shows the trough\'s ruled top, so the water running along the trough reads.',
  },
  443: {
    camera: [-0.3, 0.5, 1],
    remove: ['fixed-archimedes-screw-base', 'fixed-stream-bed-around-lower-water-wheel', 'axial-driving-stream-marker-\\d+', 'visible-one-to-one-screw-rotation-index', 'fixed-oblique-bearing-support-\\d', 'finite-bearing-to-post-bridge-\\d', 'fixed-oblique-screw-bearing-\\d'],
    note: 'The oblique screw casing with its spiral passage, the solid paddle disc at its lower end in the ruled stream, the bracket holding the top of the shaft and the trough. Brown draws no base slab, bed box, posts, bearing collars round the casing, stream markers or rotation stripe. Brown dots the spiral inside the casing, so the casing takes the shared see-through style: the flight and the water pocket trapped in each turn show as they climb, and the lifted water pours from the open top in one stream into the trough.',
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
    note: 'Sectional elevation of the casing with its abutment, the mutilated drum and its two segment valves, and the round apertures; the factory builds no foundation, feet or rotor index.',
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
    note: 'Elevation of the swinging lattice as Brown draws it: six horizontal pipes with square boxes at their right ends and tilted boxes under their left ends, six parallel diagonals passing behind them from each left box to the right box two rows up, the crossed braces on the axis, the two dotted posts and the pool; the pipes are cut open along their front walls to show the water and flaps. The highest diagonal joins the top pipe through a port where it passes behind it (its stub above stays open), so both serpentines pour through Brown’s one jet.',
  },
  462: {
    camera: [0.04, 0.37, 1],
    remove: ['fixed-frame-supporting-upper-powered-chain-wheel'],
    note: 'The chain wheels, disks, pipe and spout over the water; Brown draws no frame, so both wheel axles end as plain stubs. Pass 102: the elevation is raised about 20 degrees (it was 3) so the delivery sheet running over the bank top reads as a surface, not an edge-on band.',
  },
  463: {
    remove: ['(?:upper|lower)-leaf-transverse-reinforcement-\\d'],
    note: 'The two hinged leaves of the weir as plain planks, as Brown draws them in section; no dark straps across their faces.',
  },
  464: {
    note: 'Sectional elevation of the one hollow casting: the open trough on top draining down the right tube to the foot, the hollow left leg carrying air up to the chamber over the bowl, and the jet playing from the spire back into the trough, steadily through the loop; no stream is poured in from outside.',
  },
  465: {
    remove: ['left-operator-pressure-pad', 'right-operator-pressure-pad'],
    note: 'Diagonal balance beam on its platform over the two pumps in the well between two masonry banks, its water ruled, with Brown\'s man standing astride the pivot and holding the hand-bar carried on the beam; no pressure pads, foundation slab or water box are drawn.',
  },
  466: {
    camera: [0, 0.03, 1],
    note: 'Sectional elevation on Brown\'s plate: the domed head on two columns, four bales on the platen and fluted bowl of the hollow round-ended ram in its deep flanged cylinder, the small pipe to the valve chest on the cistern wall with its ball-weighted safety valve and T lug, the swing link carrying the lever\'s fulcrum, the plunger crosshead, and the tall pump barrel with suction pipe and rose standing in the cistern. The ram is let down by lifting the weighted valve, so the cistern level falls as the ram rises and recovers as it comes down.',
  },

  467: {
    camera: [0, 0.02, 1],
    remove: ['fixed-ground-plate-under-robertson-jack'],
    note: 'Sectional elevation of the narrow jack: small hollow base, ram with the pump in its foot, rising cylinder with cupped head and claw, and the lever on its two eyes at the lower left; no ground plate is drawn.',
  },
  468: {
    camera: [0.015, 0.012, 1],
    remove: ['plate-.*-crossed-tie-end-mark'],
    note: 'Brown\'s X-in-box section marks on the tie ends are notation and are not painted on the logs. Brown gives two figures of one ball-and-socket joint between log frames, a sectional elevation above a plan; here one model shows the joint, flexing from +23° through straight to −14° about its trunnions as the frames follow the bed.',
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
    note: 'The forked ejector B, C in section on the plane facing the camera, as Brown draws it, with steam pipe A whole: it runs behind the right leg B (Brown dashes it there), enters at the crotch and turns up inside the fork into C. The water rising through both legs, round A and up C shows through the cut; no water basin or surface is drawn. The streamline tubes, steam core and flow markers of the offline model are flow notation and are not presented.',
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
    note: 'Section of bell A in the masonry pit B with the two pipes, and flat bands over the two pulleys to the weights C; no pulley posts are drawn (the pulley axles end as plain stubs).',
  },
  480: {
    note: 'Section of bell A in the masonry pit B on the central sleeve a sliding on the fixed tube b, with the two pipes; tube b passes through the floor to its foot in the ground as Brown draws it.',
  },
  481: {
    remove: ['dial-work-registering-known-volume-per-drum-revolution', 'fixed-bottom-base-rail', 'central-inlet-gas-marker-\\d+'],
    note: 'End section of case A on its saddle, the drum compartments B, each with its gap on the outer side, and the turned-up pipe a; no register dial or base rail is drawn. No gas-flow beads.',
  },
  482: {
    remove: ['regulated-gas-flow-marker-\\d+'],
    note: 'Section of the regulator under its domed cover, cup H and valve D in their quicksilver channels, lever d and inlet E; no flow beads are drawn. The separate view of valve D is not modelled.',
  },
  483: {
    note: 'Elevation of the meter with its front removed: the two double bellows A, A′ with their moving plates, the flag rods, valve B turning under its C bracket, the outlet column and the plain dial-work box. The dials themselves are not drawn. No gas-flow beads.',
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
    remove: ['fixed-gauge-support-base', 'fixed-gauge-back-support', 'bored-glass-retaining-clip', 'clip-tab-to-scale-board', 'equal-level-zero-datum-across-both-legs', 'live-reading-index-at-right-mercury-surface', 'boiler-or-apparatus-connection-flange'],
    note: 'The tall narrow bent tube, its mercury, the scale marks beside the open leg with Brown\'s second 0 mark beside the pressure leg, and the pipe with its T-handle plug cock, which runs straight on past Brown\'s crop and ends cleanly; no boiler, flange, base, post, datum bar or pointer is drawn. The marks sit on a slim scale strip grooved round the open leg and carried by it, so they neither float nor read mirrored from behind.',
  },
  487: {
    remove: ['fixed-bearing-A-frame-\\d-leg-(left|right)', 'fixed-bearing-base-rail-\\d', 'fixed-water-volume-intersecting-lower-paddles', 'fixed-waterline-plane', 'fixed-backward-water-path-\\d', 'backward-water-marker-\\d-\\d', 'fixed-(?:negative-x-backward-water-direction|positive-x-forward-vessel-thrust)-arrow', 'white-shaft-rotation-index', 'white-index-fixed-to-first-paddle'],
    note: 'The paddle wheel and its radial paddles; no trestles, base, water, flow arrows, water beads or white indices are drawn.',
  },
  488: {
    remove: ['fixed-bearing-pedestal-(1|2)', 'fixed-propeller-demonstration-base', 'fixed-water-volume-around-screw-propeller', 'fixed-axial-helical-wake-path-\\d', 'fixed-propeller-shaft-bearing-\\d', 'negative-x-wake-marker-\\d+-\\d+', 'fixed-(?:positive-x-vessel-thrust|negative-x-accelerated-water)-arrow-(?:shaft|head)', 'white-index-fixed-to-first-helicoid-blade', 'white-rotation-index-fixed-to-shaft'],
    scale: [1, 1, -1],
    note: 'The four-bladed screw propeller on its shaft; no pedestals, bearings, base, water, arrows or indices are drawn. Mirrored in depth, so the screw is left-handed as Brown draws it: his edge-on front blade rises to the right across the hub.',
  },
  489: {
    camera: [0.05, 0.05, 1],
    remove: ['fixed-main-bearing-support-leg-(left|right)', 'fixed-feathering-wheel-base', 'fixed-water-volume-under-feathering-buckets', 'fixed-waterline-crossed-edgewise-by-upright-buckets', 'fixed-negative-x-feathering-wheel-wake-path-\\d', 'negative-x-water-marker-\\d-\\d', 'fixed-(?:negative-x-water-reaction|positive-x-vessel-thrust)-arrow', 'white-index-on-fixed-eccentric-center', 'white-index-fixed-to-main-shaft', 'white-index-fixed-to-control-ring-d'],
    note: 'Front elevation of the feathering wheel, eccentric e, ring d and cranks c; no stand, base, water, flow arrows or white indices are drawn.',
  },
  491: {
    camera: [0.02, 0.04, 1],
    remove: ['white-pawl-tip-contact-marker', 'white-rotation-index-on-capstan-head', 'fixed-circular-base-plinth', 'fixed-wide-capstan-base-foot'],
    note: 'Side elevation of the capstan, pawl and bars with the ratchet on the ground line, as Brown draws it; the pawl lies flat against the front of the lower drum and swings on a radial pin in the plane of the drawing; the hauled cable runs straight on past his crop and ends cleanly. No plinth, bollard, cable beads or indices are drawn.',
  },
  492: {
    note: 'One detaching hook as Brown draws it: the threaded standard with its tongue hinged at the top and the bent lever on the middle fulcrum, the tongue passing through the throat of the tackle hook into the rectangular eye at the lever top, the tackle block cropped at the top with its falls running straight up past the plate, and the release rope running straight off to the right. No boat, second unit or pull gear is drawn.',
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
