// Featureless turning parts that carry the shared quadrant rotation cue
// (src/simulation/rotation-indicator.js), by movement: role patterns (full
// matches, like source-presentation `remove`) of the parts, or of groups
// whose solids of revolution take the cue. Each mesh turns the cue about its
// own axis of revolution; { pattern, axis } fixes a geometry-space axis where
// the shape does not decide one (a ball). Plain sheaves built by makePulley,
// stepped and cone pulleys, and factories that apply the cue themselves are
// not listed here. Parts with visible features (teeth, spokes, arms, cams of
// obvious shape, threads) carry no cue. A plain disc that carries only a pin
// or a groove on one face still takes it. Candidates come from
// node scripts/inventory-rotating-parts.mjs and are then reviewed by eye.
export default {
  // Keys are movement numbers. Live MuJoCo and baked models (82-126,
  // 137-165) are matched by the names their production visuals use.
  56: ['pulley'],
  58: ['driverDrum', 'loosePulley', 'inputPulley[0-2]'],
  59: ['driverDrum', 'loosePulley'],
  61: ['driverDrum', 'directPulley', 'loosePulley', 'carrierPulley', 'brakeDrum'],
  62: ['driverDrum', 'sideDriverDrum', 'carrierPulley', 'directPulley', 'loosePulley', 'sidePulley'],
  68: ['driverPlate'],
  82: ['pulleyBody'],
  // 88: disk B (a plain disc carrying only the two stops) and its hub.
  88: ['camA', 'wheelB', 'wheelRearHub'],
  // 89: the eccentric sheave (bored off-centre) turns its cue about the
  // shaft axis, its geometry Z through its origin.
  89: [{ pattern: 'eccentric-bearing-journal', axis: 'z' }, 'raised-sheave-face', '(rear|front)-retaining-flange', 'shaft-collar'],
  90: [{ pattern: 'sheave', axis: 'z' }, 'collar'],
  95: ['disk', { pattern: 'hub', axis: 'y' }, 'thrustCollar', 'roller'],
  // 97: the plain grooved disk (floor and outer land with its rim, bored on
  // the shaft axis, their geometry Z through the origin) and its round hubs.
  // The heart-shaped boss ('inner') is a cam of obvious shape: no cue.
  97: [{ pattern: 'floor|outer', axis: 'z' }, '(front|rear)Hub'],
  // 98, 99: the plain crank disk and the spiral-feed disk carry only a pin
  // or a raised spiral; the disks and hubs take the cue.
  98: ['disk', '(front|rear)Hub'],
  99: ['disk', '(front|rear)Hub'],
  117: ['upperRoller', 'lowerRoller'],
  // 124: the spindle's drum; the drill bit is edge-on in the plate's view.
  124: ['drum', '(back|front)Flange', 'frontLand', 'frontHub'],
  126: ['drum', 'backFlange', 'frontFlange', 'frontFace', 'pulleyHub'],
  129: ['larger-rope-winding-barrel', 'smaller-rope-unwinding-barrel', '(large-outer|central|small-outer)-windlass-barrel-flange',
    'single-tilted-movable-load-pulley'],
  // 130: the eccentric disc is bored off-centre on the shaft; its baked
  // geometry Z runs along the shaft axis through the origin.
  130: [{ pattern: 'body:cam', axis: 'z' }],
  131: ['disk'],
  135: ['circular-carrier-disk-centered-on-cam-vertex'],
  137: ['body:upper', 'body:lower'],
  // 138: the plain carrier disc and round hub behind the seven-arc cam.
  138: ['carrierDisk', 'outerHub'],
  139: ['support-roller-[01]', 'roller-flange-[01]-[01]'],
  142: ['carrier-disk'],
  143: ['pulley'],
  146: ['driver-disk'],
  149: ['roller[01]'],
  150: ['working-roller-tread-on-selected-cam'],
  // 151: the upper worm shaft, seen end-on in its bearing ring.
  151: ['input-shaft', '(front|rear)-input-journal'],
  153: ['body:disk'],
  154: ['body:pulley'],
  156: ['disk'],
  157: ['disk'],
  158: ['disk'],
  159: ['body:pulley', 'body:disk'],
  160: ['pulleyCore', 'pulley(Rear|Front)Flange'],
  162: ['(upperInput|spindleDrive|upperLoose|lowerLoose|gateOutput)Body'],
  163: ['middlePulley'],
  165: ['rollerWheel'],
  166: ['disk', 'hub'],
  // 171: the two plain eccentric sheaves (their straps carry lugs: no cue).
  171: ['eccentric-sheave-fast-on-common-crankshaft'],
  198: ['(upper|lower)-fixed-guide-roller-for-main-frame'],
  204: ['(driving|driven)-one-sheet-hyperboloidal-friction-wheel-(pitch-surface|flat-end-face|shaft-hub)'],
  230: ['(upper-input|lower-output)-shaft-front-crank-disk'],
  242: ['solid-brake-drum', 'visible-braking-rim', 'brake-wheel-hub'],
  244: ['smooth-turned-friction-pulley-A', 'brake-drum-hub'],
  253: ['load-side-rope-drum', 'rope-drum-(rear|front)-rim', 'return-sheave-body', 'return-sheave-rim'],
  255: ['straight-cylindrical-flat-belt-working-tread', '(left|right)-belt-retaining-flange', 'flanged-pulley-hub'],
  256: ['plain-crowned-flat-belt-working-tread', 'plain-pulley-hub'],
  257: ['true-round-bottom-concave-grooved-pulley-body', 'concave-pulley-hub'],
  258: ['true-smooth-v-grooved-pulley-body', 'smooth-v-pulley-hub'],
  // 259: the notched groove breaks exact revolution symmetry, so its body
  // turns the cue about its geometry X (the shaft axis) explicitly.
  259: [{ pattern: 'true-periodically-notched-v-grooved-pulley-body', axis: 'x' }, 'notched-v-pulley-hub'],
  261: ['revolving-disk-B', 'fixed-axis-disk-B-hub', 'cord-winding-drum-coaxial-with-disk-B',
    '(rear|front)-moving-pulley-E-flange', 'moving-pulley-E-cord-tread'],
  262: ['thin-roller-C-touching-cone-at-large-end-side-edge', 'eccentric-conical-friction-body-B', 'round-large-end-boss-round-screw-D'],
  263: ['thin-roller-C-touching-cone-at-large-end-side-edge', 'eccentric-conical-friction-body-B', 'round-large-end-boss-round-screw-D'],
  265: ['concave-generator-horn-shaped-friction-drum', 'cone-drum-hub-rigid-with-input-shaft',
    'thin-friction-roller-disk', 'round-friction-tread-touching-cone', 'roller-hub-sliding-on-guide-shaft'],
  268: ['fixed-center-rod-support-roller'],
  270: ['wide-belt-pulley-rim-and-working-tread', 'lower-return-sheave-web', 'assembled-view-pulley-front-face'],
  271: ['left-pulley-wheel-with-hub-bore', 'left-pulley-hub-face'],
  // 272: the wavy face is not a solid of revolution; the shaft axis is
  // the cam's geometry X axis through its origin.
  272: [{ pattern: 'solid-disk-with-bevelled-rim-and-wavy-trough-face', axis: 'x' }],
  281: ['solid-driver-disk', 'fixed-center-disk-shaft-hub'],
  282: ['cord-running-sheave', 'pulley-retaining-flange', 'pulley-hub', 'solid-driving-disk', 'fixed-disk-axis-hub'],
  296: ['balance-roller-disk-D'],
  314: ['lever-chronometer-balance-wheel-rim'],
  320: ['small-chain-tensioning-pulley-(body|hub)', 'large-main-weight-pulley-(body|hub)',
    '(roughened-ratchet-pulley-p|going-wheel-with-fixed-roughened-pulley-P)-(body|hub)'],
  334: ['working-tread-of-backing-roller-A'],
  352: ['larger-winding-barrel', 'smaller-unwinding-barrel', 'finite-bored-rope-groove'],
  354: ['ten-source-unit-solid-crank-disk', 'raised-rim-on-crosshead-face-of-input-disk', 'central-input-hub',
    'front-face-of-central-input-hub'],
  355: ['rapidly-spinning-metallic-disk-C', 'hub-rigid-with-metallic-disk-C-and-spindle'],
  356: [{ pattern: 'rapidly-rotating-heavy-ball-B', axis: 'z' }, 'hub-rigid-with-heavy-ball-B'],
  359: ['heavy-momentum-flywheel-fixed-to-spindle', 'flywheel-hub'],
  360: ['oscillating-annular-cord-drum', 'loose-drum-cord-groove', 'heavy-continuously-rotating-flywheel-rim'],
  361: ['left-handwheel-fast-on-upper-shaft', '(upper-driving-pulley|lower-loose-sliding-pulley)-(solid-sheave|belt-retaining-flange|hub)'],
  // 362: the upper drum only traverses; the turning lower cylinder takes the cue.
  362: ['lower-cylinder-carrying-one-closed-oblique-groove'],
  365: ['one-of-two-oblique-friction-drive-rollers', 'long-cylindrical-rod-driven-between-two-oblique-rollers'],
  368: ['cylinder-receiving-described-spiral-line'],
  // 373: the wagon's wheels (the large test wheel shows its spokes).
  373: ['stationary-axle-carriage-wheel-rolling-without-slip-on-drum'],
  375: ['solid-cylindrical-edge-runner-stone', 'edge-runner-bearing-hub'],
  383: ['cloth-wound-roll-body'],
  388: ['smooth-cylindrical-workpiece-support-surface'],
  // 393: the polishing cup turns on its own tilted axis; the plain handwheel
  // turns with the upright shaft.
  393: ['convex-outer-shell-of-polishing-cup', { pattern: 'inner-polishing-material-facing-stationary-lens', axis: 'y' },
    'input-handwheel-fast-on-upright-shaft'],
  401: ['single-rotating-flywheel-faceplate-carrying-tangent-slide'],
  411: ['cylindrical-sectionally-ruled-recording-paper'],
  413: ['(left|right)-flank-of-v-edged-rubber-disk', '(nut-driven-left|fixed-shoulder-right)-metal-clamping-plate',
    '(left|right)-rigid-v-groove-flank', 'lower-driven-wheel-hub'],
  415: ['single-smooth-internal-friction-rim-of-wheel-D', 'translucent-wheel-D-web', 'wheel-D-hub-fast-with-smooth-rim'],
  416: ['plain-flywheel-disc-web-fast-on-crankshaft', 'heavy-flywheel-rim-fast-on-crankshaft', 'flywheel-hub-fast-on-crankshaft'],
  426: ['hub-C-fast-on-main-shaft-B'],
  428: ['roller-A-[123]-rolling-on-rubber'],
  439: ['grooved-pulley-wheel', 'single-rope-pitch-groove'],
  471: ['crank-A-disk'],
  472: ['sliding-leather-faced-friction-wheel-N'],
  479: ['fixed-axis-counterweight-pulley-[12]'],
  490: ['(upper|lower)-guide-sheave-(body|rope-groove)'],
  495: ['driving-pulley-fast-on-shaft-D'],
  496: ['(upper|lower)-(back|front)-drawing-roll-[AB]-body', 'wooden-bobbin-barrel', 'bobbin-end-disc-[12]'],
};
