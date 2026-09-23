// Per-movement presentation matched to Brown's engraving, applied after
// construction by src/simulation/source-presentation.js. `rotate` is an XYZ
// Euler (radians) premultiplied onto the model root, `scale` a model-local
// scale (a mirror when one component is -1), `camera` the initial view
// direction in world coordinates after that rotation, and `remove` the
// userData.role patterns (anchored regular expressions; the object name stands
// in for a missing role) of parts the plate does not show. `note` records what the engraving shows. Re-measure display
// profiles (scripts/measure-display-profiles.mjs ID) after changing an entry.
export default {
  86: {
    remove: ['remote(?:BearingStandard|BearingLip|Base|DriveRim|DriveWeb|DriveHub|InputShaft)', 'rearDrive(?:Rim|Web|Hub)', 'rearShaftExtension', 'inputDriveBand'],
    note: 'Front elevation of the loose wheel A on its A-frame standard with catch B, cam C and the overhead stop; no belt drive or second driving pulley is drawn.',
  },
  89: {
    remove: ['bored-crosshead-cheek', 'crosshead-bridge-clear-of-swinging-eye', 'wrist-pin-(?:shank|retaining-head)', 'output-valve-stem', 'fixed-horizontal-crosshead-channel', 'base-rail', 'guide-support-\\d', 'bored-rear-shaft-support'],
    note: 'Front elevation of the sheave, strap and bolted rod flange, the rod broken off to the right; no crosshead, guides or bed are drawn.',
  },
  93: {
    remove: ['guide\\d', 'crossbar\\d', 'post\\d', 'shaftSupport'],
    note: 'Front elevation of the crank disk behind the slotted yoke and its stems; no frame, brackets or stem guides are drawn. Only the production MuJoCo model is presented; the synchronous registry model keeps its reconstructed frame for offline checks.',
  },
  134: {
    remove: ['rear-fixed-pedestal-supporting-drum-axis', 'fixed-foot-of-drum-bearing-pedestal', 'fixed-bearing-behind-drum-hub'],
    note: 'Front elevation of the spoked rope drum with its rim separators, the rope running off along the ground line; no pedestal or bearing is drawn.',
  },
  142: {
    remove: ['rear-post', 'output-guide-rail', 'guide-support-post', 'guide-(?:upper|lower)-bridge', 'base'],
    note: 'Face view of the carrier disk, fixed pinion, planet wheel and crank with the guided slider stem below; no base, pedestal or slider rails are drawn.',
  },
  150: {
    remove: ['fixed-longitudinal-base-rail', 'fixed-transverse-base-tie', 'fixed-camshaft-bearing-post', 'fixed-post-under-right-lever-fulcrum', 'output-guide-(?:-1|1|back|foot)'],
    note: 'The sliding cam series, rocking lever on its right-hand fulcrum and the valve rod; no base, posts or rod guide are drawn.',
  },
  151: {
    remove: ['guide-(?:back|upper|lower)-\\d', 'guide-post-\\d-.*', 'bearing-(?:post|foot)-.*', 'rear-base', 'upper-bearing-(?:arm|rear-tie|post)'],
    note: 'The opposite-hand screw shaft between its end bearings, the two nuts and the upper worm and hand wheel; no base, posts or upright are drawn.',
  },
  156: {
    remove: ['base', 'diskPost', 'pivotPost', 'guidePost', 'guideBack', 'guideRail.*', 'guideBackArm.*', 'guideStandoff.*'],
    note: 'The disk, slotted bell crank, link and output rod; no base, posts or guide rails are drawn.',
  },
  157: {
    remove: ['base', 'diskPost', 'pivotPost', 'guidePost', 'guideBack', 'guideRail.*', 'guideBackArm.*', 'guideStandoff.*'],
    note: 'The disk, rod, bell crank, link and output rod; no base, posts or guide rails are drawn.',
  },
  186: {
    camera: [0.2, 0.15, 1],
    remove: ['fixed-frame-supporting-valve-rockshaft'],
    note: 'The rockshaft, gab lever, eccentric rod and spring loop handle; no frame is drawn.',
  },
  187: {
    camera: [0.2, 0.15, 1],
    remove: ['fixed-frame-supporting-the-valve-rockshaft'],
    note: 'The rockshaft, valve lever, eccentric rod and upper handle; no frame is drawn.',
  },
  188: {
    camera: [0.2, 0.15, 1],
    remove: ['fixed-frame-and-valve-carrier-guide'],
    note: 'The eccentric rod with its loop handle a and leaf spring; no frame or guide is drawn.',
  },
  189: {
    camera: [0.2, 0.15, 1],
    remove: ['fixed-support-frame-behind-source-linkage'],
    note: 'The rockshaft, forked eccentric rod and the bell crank with its vertical rod; no frame is drawn.',
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
  204: {
    remove: ['fixed-(?:longitudinal|transverse)-base-rail', '(?:driver|driven)-shaft-bearing-post'],
    note: 'The two hyperboloidal rollers on their shafts; no base or posts are drawn.',
  },
  212: {
    remove: ['geneva-stop-fixed-base-rail', 'geneva-stop-fixed-bearing-upright', '(?:driver-A|stop-wheel-B)-rear-bearing-arm', 'geneva-stop-(?:left|right)-transverse-foot', '212-bored-fixed-shaft-support-\\d'],
    note: 'Face view of driver A and stop wheel B; no frame is drawn.',
  },
  213: {
    remove: ['friction-stop-fixed-base-rail', 'friction-stop-fixed-bearing-upright', '(?:winding-arbor|split-stop-stud)-rear-bearing-arm', 'friction-stop-(?:left|right)-transverse-foot'],
    note: 'Face view of the split stop ring and the ratchet wheel; no frame is drawn.',
  },
  214: {
    remove: ['gear-finger-stop-base-rail', '(?:left-stop-counterwheel|right-winding-input)-bearing-upright', 'gear-finger-stop-(?:left|right)-foot', '(?:driven|driver)-bored-fixed-support'],
    note: 'Face view of the two finger-stop wheels; no frame is drawn.',
  },
  215: {
    remove: ['crescent-stop-base-rail', '(?:crescent-driver|six-slot-wheel)-bearing-upright', 'crescent-stop-(?:left|right)-foot', '215-bored-fixed-shaft-support-\\d'],
    note: 'Face view of the crescent driver and the six-slot wheel; no frame is drawn.',
  },
  216: {
    camera: [0.15, 0.12, 1],
    remove: ['mutilated-compound-drive-base-rail', 'common-centerline-bearing-spine', 'mutilated-drive-(?:left|right)-foot'],
    note: 'Face view of the internal ring and the two pinions; no frame is drawn.',
  },
  217: {
    camera: [0.15, 0.12, 1],
    remove: ['rear-frame-post', 'rear-frame-top', 'base'],
    note: 'Face view of the grooved heart cam C, D, B, e with the notch wheel F and catch G; no frame is drawn.',
  },
  233: {
    remove: ['lantern-stop-rear-support-frame-beam'],
    note: 'Face view of the lantern wheel with its roller stop and latch; no frame is drawn.',
  },
  234: {
    rotate: [-Math.PI / 2, 0, 0],
    camera: [2.2, 4.6, 9],
    note: 'Oblique view from above: crown wheel horizontal with its arbor hanging down and verge S across the top; no frame or bearings are drawn. The rim is cut into saw teeth whose slant matches the unmirrored model.',
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
    remove: ['common-drawing-plane-for-tracer-and-pencil', 'drawing-sheet-outline'],
    note: 'The pantograph arms, fixed point C, tracer B and pencil A over a blank ground; no drawing board is drawn.',
  },
  272: {
    remove: ['fixed-base-beneath-beveled-cam', 'fixed-post-supporting-cam-shaft-bearing', 'fixed-backing-rail-for-inclined-guides', 'fixed-bracket-from-backing-rail-to-rod-guide'],
    note: 'The bevelled cam on its shaft and the inclined rod in its guides; no base, post or backing rail is drawn.',
  },
  276: {
    remove: ['fixed-(?:left|right)-guide-support-post', 'fixed-equal-diameter-cam-display-base', 'fixed-cam-bearing-arm', 'fixed-rear-cam-bearing-post'],
    note: 'The three-lobed cam between the rollers of the sliding bar; no base, posts or bearing arm are drawn.',
  },
  279: {
    remove: ['fixed-(?:left|right)-crosshead-guide-post', 'fixed-crosshead-display-base'],
    note: 'The Clayton journal box in its sliding frame on the rod; no base or posts are drawn.',
  },
  288: {
    remove: ['rear-clock-plate-standard', 'fixed-clock-frame-base'],
    note: 'Face view of the escape wheel and anchor H, L, K; no clock plate or base is drawn.',
  },
  289: {
    remove: ['rear-deadbeat-clock-plate-standard', 'fixed-deadbeat-clock-frame-base'],
    note: 'Face view of the dead-beat wheel A and anchor; no clock plate or base is drawn.',
  },
  290: {
    remove: ['rear-clock-frame-standard', 'fixed-annular-escapement-frame-base'],
    note: 'Face view of the wheel D inside the annular pallet frame; no clock plate or base is drawn.',
  },
  291: {
    remove: ['fixed-watch-plate-base', 'fixed-balance-arbor-standard', 'fixed-escape-wheel-arbor-standard'],
    note: 'The escape wheel B, balance a and detent; no watch plate, standards or base is drawn.',
  },
  292: {
    remove: ['fixed-rear-clock-plate-standard', 'fixed-large-clock-frame-base'],
    note: 'The wheel, gravity arms and pallets; no clock plate or base is drawn.',
  },
  293: {
    remove: ['fixed-rear-duplex-watch-plate-standard', 'fixed-duplex-watch-frame-base', 'rear-bridge-between-watch-journals'],
    note: 'The duplex wheel and roller; no watch plate, bridge or base is drawn.',
  },
  294: {
    rotate: [0, 0, Math.PI / 2],
    camera: [-1, 0.28, 0.1],
    remove: [
      'invisible-envelope-for-complete-cylinder-escapement', 'fixed-parallel-arbor-watch-frame',
      'stepping-cylinder-escape-wheel-rotor', 'fixed-cylinder-escape-wheel-arbor',
      'cylinder-balance-spoke-\\d', 'balance-wheel-attached-to-top-of-cylinder',
      'white-index-on-cylinder-balance-wheel', 'bored-hub-joining-balance-spokes-to-end-pivot',
      '(generated-(entry|exit)-lip-working-contact|(outside|inside)-cylinder-frictional-rest)-trace',
      'white-marker-on-active-cylinder-escapement-contact',
    ],
    note: 'Brown draws only the cylinder in perspective (295 shows the wheel); the escape wheel, balance and watch frame are not drawn.',
  },
  296: {
    remove: ['fixed-rear-lever-watch-plate-standard', 'fixed-lever-escapement-frame-base', 'rear-bridge-between-watch-journals'],
    note: 'Face view of the escape wheel A and lever B, C; no watch plate, bridge or base is drawn.',
  },
  297: {
    remove: ['fixed-lantern-escapement-base'],
    note: 'Face view of the pin wheel and pallets; no base is drawn.',
  },
  305: {
    remove: ['rear-clock-frame-upright', 'fixed-pendulum-pivot-bracket', 'fixed-single-pin-disc-arbor-bracket'],
    note: 'The pendulum pallet plate and single-pin disc; no clock frame or brackets are drawn.',
  },
  306: {
    remove: ['rear-frame-cross-bridge', 'bored-back-strut-joining-wheel-arbor-to-frame-bridge'],
    note: 'The three-legged wheel inside the pendulum pallet plate; no frame bridge or strut is drawn.',
  },
  307: {
    remove: ['rear-clock-frame-upright', 'pendulum-pallet-pivot-bracket', 'three-leg-wheel-arbor-bracket'],
    note: 'The long-tooth pallet plate and the three-leg wheel; no clock frame or brackets are drawn.',
  },
  308: {
    remove: ['clock-frame-upright', 'sixty-pin-wheel-bearing-bracket', 'pendulum-crutch-bearing-bracket', 'Q-detent-bearing-bracket'],
    note: 'The pin wheel, click C, detent Q and pendulum P; no clock frame upright or bearing brackets are drawn.',
  },
  313: {
    remove: ['fixed-watch-frame-base', 'escape-wheel-arbor-standard', 'balance-staff-standard'],
    note: 'The escape wheel, balance V and spring detent D; no watch frame is drawn.',
  },
  314: {
    remove: ['fixed-wheel-to-lever-frame-member', 'fixed-lever-to-balance-frame-member', 'fixed-frame-member-behind-banking-tail', 'fixed-lever-chronometer-frame-base'],
    note: 'The escape wheel, locking lever A, B and balance roller C with its banking pins; no frame is drawn.',
  },
  309: {
    remove: ['fixed-Mudge-escapement-frame'],
    note: 'Front elevation of the wheel, the two pallet arms from their arbors C and the fork pins P, Q; no clock frame, crossbars or bearing brackets are drawn.',
  },
  312: {
    remove: ['fixed-bloxam-support-frame'],
    note: 'Front elevation of the two wheels and the gravity arms hung from C with fork pins E, F; the trapezoid outline is the arms themselves, and no separate support frame is drawn.',
  },
};
