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
    remove: ['mutilated-compound-drive-base-rail', 'common-centerline-bearing-spine', 'mutilated-drive-(?:left|right)-foot', 'fixed-reversing-pinion-bearing', 'compound-input-angular-rate-index', 'pinion-variable-rate-index', 'slow-forward-external-mesh-contact', 'quick-reverse-internal-mesh-contact'],
    note: 'Face view of the internal and external mutilated wheels on one shaft and the reversing pinion below, opening at the plate\'s pose: the external sector mid-mesh below and the internal teeth round the upper half; both shafts are drawn cut in section, so their bearings lie outside the drawing and no frame is drawn. The white rate indices and contact markers are hidden.',
  },
  217: {
    camera: [0.15, 0.12, 1],
    remove: ['rear-frame-post', 'rear-frame-top', 'base', 'F-.*', 'H-.*', 'A-.*', 'hinged-catch-G', '.*contact.*marker', 'cam-rotation-index-at-e', 'rear-projection-lifting-catch-at-e', 'cam-frame-bearing'],
    note: 'Face view of the grooved cam C, D, B, e alone, as Brown draws it; the notch wheel F, lever, stud A and catch G belong to plate 218, and no frame is drawn.',
  },
  233: {
    remove: ['lantern-stop-rear-support-frame-beam'],
    note: 'Face view of the lantern wheel with its roller stop and latch; no frame is drawn.',
  },
  234: {
    rotate: [-Math.PI / 2, 0, Math.PI],
    camera: [6.2, 4.9, 6.9],
    remove: ['verge-end-journal', 'verge-rotation-witness', 'crown-wheel-rotation-witness'],
    note: 'Oblique view from above, verge S falling to the right at about 22° across the wheel: a flush toothed plate on a shallow band with its arbor hanging down, and two plain flags A on the round spindle; no frame, bearings, journal caps or witness marks are drawn. The rim is cut into saw teeth whose slant matches the unmirrored model.',
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
    remove: ['fixed-lantern-escapement-base'],
    note: 'Face view of the pin wheel and pallets; no base or bearing post is drawn.',
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
    remove: ['rear-clock-frame-upright', 'fixed-pendulum-pivot-bracket', 'fixed-single-pin-disc-arbor-bracket'],
    note: 'The pendulum pallet plate and single-pin disc; no clock frame or brackets are drawn.',
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
    remove: ['fixed-shaft-pedestal-leg-\\d', 'fixed-base', 'fixed-base-edge', 'fixed-external-guide-rail-(left|right)', 'fixed-external-guide-support-\\d', 'fixed-external-guide-top-bridge', 'fixed-rear-shaft-bearing-bridge'],
    note: 'The disk A with its crossed slots and slides c, and the bar B; no stand, base or external guide is drawn.',
  },
  350: {
    remove: ['fixed-wide-base', 'fixed-base-edge'],
    note: 'The slotted link, guides a, a and the output bar; no base or bearing post is drawn.',
  },
  351: {
    remove: ['fixed-stamp-machine-base', 'fixed-anvil-below-falling-stamp', 'fixed-workpiece-at-lower-impact-stop'],
    note: 'The rack stamp, its guides and the mutilated pinion; no base, anvil or workpiece is drawn.',
  },
  354: {
    remove: ['fixed-rear-support-rail', 'fixed-bracket-carrying-output-guide', 'fixed-input-bearing-bracket'],
    note: 'The grooved crosshead, input disk and the stem guides; no support rails or brackets are drawn.',
  },
  364: {
    camera: [0, 0.06, 1],
    remove: ['fixed-two-axis-bearing-stand'],
    note: 'Side elevation of the pin wheel face-on beside the helically grooved drum on its upright shaft; no stand or bed is drawn.',
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
    remove: ['fixed-base-of-treadle-drive-demonstrator', 'fixed-standard-supporting-upper-shaft', 'right-hand-fixed-treadle-pivot-standard'],
    note: 'The eccentric pulley, band and treadle roller; no base or standards are drawn.',
  },
  375: {
    camera: [0.05, 0.08, 1],
    note: 'Front elevation of the edge-runner mill and its bevel drive, as Brown draws it.',
  },
  378: {
    camera: [0.05, 0.08, 1],
    note: 'Front elevation of the saw frame, its guides and the log, as Brown draws it.',
  },
  381: {
    camera: [1, 0.06, 0.03],
    remove: ['white-.*', 'workpiece-longitudinal-grain-line'],
    note: "End elevation matching Brown's upper transverse section: the bed, the flush dovetailed cheeks and wedges, and the board standing on edge between them; Brown's lower figure, the plan of the diverging cheeks and wedges, is the top view. The white datums and grain lines are not drawn.",
  },
  384: {
    camera: [0, 0.1, 1],
    remove: ['stationary-drawing-and-transfer-paper'],
    note: 'Side view of the point, screw-threaded arm and small wheel; no paper is drawn.',
  },
  385: {
    remove: ['fixed-wall-beside-door-opening', 'fixed-vertical-door-jamb', 'fixed-door-frame-lintel', '(frame|door)-pin-socket-bracket', 'moving-door-panel', 'one-of-four-door-face-trim-bars', 'door-opening-handle', 'one-of-three-fixed-axis-door-hinge-barrels'],
    note: 'The two pins, toggle links and weight; the door and its frame are not drawn.',
  },
  388: {
    remove: ['fixed-planer-feed-roller-bearing-frame'],
    note: 'The smooth and toothed rollers and the board between them; no bearing frame is drawn.',
  },
  390: {
    remove: ['fixed-two-shaft-rectifier-bearing-frame'],
    note: 'The semicircular piece A on fulcrum a, flywheel B and bands C, D; no bearing frame is drawn.',
  },
  391: {
    remove: ['fixed-frame-carrying-guide-grooves-and-output-bearing'],
    note: 'The guides b, racks A, A1, cog wheel and elbow lever C; no frame is drawn.',
  },
  392: {
    remove: ['fixed-gig-saw-machine-bed'],
    note: 'The saw, its guides and table, the crank wheel and the spring; no machine bed is drawn.',
  },
  394: {
    remove: ['fixed-Parsons-device-machine-bed', 'fixed-central-pinion-bearing-standard', 'connected-input-guide-support'],
    note: 'The endless rack, flanged pinion and rod guide; no bed or standards are drawn.',
  },
  396: {
    remove: ['fixed-watch-escapement-base', 'rear-watch-plate-bearing-standard'],
    note: 'The wheel A, balance B, crooked lever C and banking pins l; no watch plate base is drawn.',
  },
  398: {
    remove: ['fixed-mechanism-bearing-support', 'fixed-base-for-cam-guides-and-output-shaft'],
    note: 'The cam C, crosshead in its guide and output wheel; no base or supports are drawn.',
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
  406: {
    remove: ['fixed-drawing-board-presentational-support-not-source-hardware', 'fixed-drawing-board-border'],
    note: 'The straightedge, square, thread and pencil describing the parabola; no drawing board is drawn.',
  },
  407: {
    remove: ['fixed-drawing-board-presentational-support-not-source-hardware', 'fixed-drawing-board-border', 'mirrored-right-jamb-reference-for-complete-arch', 'mirrored-right-half-completing-pointed-arch', 'given-right-springing-point'],
    note: 'The slotted bar, elastic bar, cord and the half-arch it draws; no drawing board or mirrored half is drawn.',
  },
  413: {
    remove: ['fixed-two-shaft-friction-gear-frame'],
    note: 'The adjustable wheel A and the V-grooved wheel B on their shafts; no frame is drawn.',
  },
  415: {
    remove: ['fixed-coaxial-wheel-and-lever-bearing-frame'],
    note: 'The wheel D, lever A with its pawls and the rod; no frame is drawn.',
  },
  416: {
    remove: ['fixed-flywheel-and-treadle-bearing-frame'],
    note: 'The flywheel and crank B, spring A, pitman and treadle; no frame is drawn.',
  },
  418: {
    note: 'Section of the conical casing on the chest cover with its recess, the suspended guide D on its adjusting screw, valve A, rod B and roller C.',
  },
  421: {
    remove: ['marine-trunk-engine-foundation', 'rear-crankshaft-support-column', 'rear-crankshaft-bearing-arm'],
    note: 'The sectioned cylinder, trunk piston, pitman and crank; no foundation or crank supports are drawn.',
  },
  425: {
    camera: [0.08, 0.05, 1],
    note: 'Front elevation of the casing, piston C and abutment, as Brown draws it.',
  },
  426: {
    camera: [0.08, 0.05, 1],
    note: 'Front elevation of the casing, drum B and sliding abutments A, as Brown draws it.',
  },
  427: {
    camera: [0.08, 0.05, 1],
    note: 'Front elevation of the casing, drum B and pivoted pistons a, as Brown draws it.',
  },
  428: {
    camera: [0.08, 0.05, 1],
    note: 'Front elevation of the casing, arms B and rollers A, as Brown draws it.',
  },
  429: {
    camera: [0.08, 0.05, 1],
    note: 'Front elevation of the two-lobed casing and its toothed pistons, as Brown draws it.',
  },
  430: {
    camera: [0.08, 0.05, 1],
    note: 'Side elevation of the overshot wheel and flume, as Brown draws it.',
  },
  431: {
    camera: [0.08, 0.05, 1],
    note: 'Side elevation of the undershot wheel, sluice and race, as Brown draws it.',
  },
  432: {
    camera: [0.08, 0.05, 1],
    note: 'Side elevation of the breast wheel, sluice and race, as Brown draws it.',
  },
  433: {
    camera: [0.1, 0.2, 1],
    note: 'Side elevation of the tub wheel, shaft and spout, as Brown draws it.',
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
    camera: [0.08, 0.05, 1],
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
    remove: ['fixed-overhead-pulley-support-beam', 'bored-pulley-shaft-hanger', 'fixed-pulley-support-post', 'fixed-ground-beneath-bucket'],
    note: 'The pulley, rope, bucket, counterweight and water stream; no gallows frame or ground is drawn.',
  },
  441: {
    camera: [0.08, 0.05, 1],
    remove: ['fixed-persian-wheel-base', 'fixed-hollow-shaft-bearing-standard', 'fixed-stream-bed-beneath-wheel', 'fixed-stationary-trip-pin-bracket', 'fixed-trip-pin-support-post', 'fixed-high-level-trough-receiving-tipped-bucket-water', 'fixed-outboard-receiver-standard', 'fixed-receiver-to-standard-bridge'],
    note: 'Front elevation of the Persian wheel, its buckets and the stream; no base, standards, bed, trip-pin post or trough is drawn.',
  },
  444: {
    camera: [0.08, 0.05, 1],
    note: 'Sectional elevation of the supply, air vessel and jet, as Brown draws it.',
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
    camera: [0.08, 0.05, 1],
    remove: ['fixed-old-rotary-pump-foundation'],
    note: 'Sectional elevation of the casing, folding valves and apertures; no foundation is drawn.',
  },
  456: {
    camera: [0.08, 0.05, 1],
    remove: ['fixed-cary-pump-foundation'],
    note: 'Sectional elevation of the cylinder, heart cam a, sliders and pipes F, H; no foundation is drawn.',
  },
  462: {
    remove: ['fixed-frame-supporting-upper-powered-chain-wheel'],
    note: 'The chain wheels, disks, pipe and spout; no frame is drawn.',
  },
  467: {
    camera: [0.08, 0.05, 1],
    remove: ['fixed-ground-plate-under-robertson-jack'],
    note: 'Sectional elevation of the jack, ram, pump and lever; no ground plate is drawn.',
  },
  469: {
    camera: [0.05, 0.05, 1],
    note: 'Sectional elevation of the two tanks, wheel and pipe, as Brown draws it.',
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
  487: {
    remove: ['fixed-bearing-A-frame-\\d-leg-(left|right)', 'fixed-bearing-base-rail-\\d', 'fixed-water-volume-intersecting-lower-paddles', 'fixed-waterline-plane', 'fixed-backward-water-path-\\d'],
    note: 'The paddle wheel and its radial paddles; no trestles, base or water is drawn.',
  },
  488: {
    remove: ['fixed-bearing-pedestal-(1|2)', 'fixed-propeller-demonstration-base', 'fixed-water-volume-around-screw-propeller', 'fixed-axial-helical-wake-path-\\d'],
    note: 'The screw propeller on its shaft; no pedestals, base or water is drawn.',
  },
  489: {
    camera: [0.05, 0.05, 1],
    remove: ['fixed-main-bearing-support-leg-(left|right)', 'fixed-feathering-wheel-base', 'fixed-water-volume-under-feathering-buckets', 'fixed-waterline-crossed-edgewise-by-upright-buckets', 'fixed-negative-x-feathering-wheel-wake-path-\\d', 'negative-x-water-marker-\\d-\\d'],
    note: 'Front elevation of the feathering wheel, eccentric e, ring d and cranks c; no stand, base or water is drawn.',
  },
  491: {
    camera: [0.05, 0.08, 1],
    note: 'Side elevation of the capstan, pawls and bars, as Brown draws it.',
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
    remove: ['fixed-barometer-support-base', 'fixed-barometer-back-support'],
    note: 'The siphon tube and its scale; no stand or backboard is drawn.',
  },
  504: {
    camera: [0.05, 0.08, 1],
    note: 'Side elevation of the wheels A, B, the pinions and the arm, as Brown draws it.',
  },
  507: {
    camera: [0.05, 0.08, 1],
    note: 'Front elevation of the wheels E, F, G, H, the worm C and the arm m n, as Brown draws it.',
  },
  269: {
    remove: ['fixed-post-behind-moving-frame-holding-pinion', 'fixed-base-of-output-shaft-bearing', 'stationary-bearing-around-output-shaft'],
    note: 'The frame, racks and spur gear; no post or bearing is drawn.',
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
