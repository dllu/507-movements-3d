// Per-movement settings for scripts/bake-mujoco-movement.mjs. Anything not
// given here uses BAKE_DEFAULTS in mujoco-bake.mjs. Keys:
//   directory       live MuJoCo module folder (hashed for provenance)
//   options         options passed to the live factory for every variant
//   variants        {name: {options}} for movements with a configuration
//                   selector; defaultVariant names the initial one
//   period          drive period in seconds (default: animationTiming.authoredCyclePeriod)
//   wrap            {objectKey: {symmetry: radians} | false}: steadily turning
//                   parts carried forward by a whole-loop rotation; symmetry
//                   snaps that rotation to the part's tooth pitch
//   cycle           'periodic' (default) or 'palindrome' (record forward, play
//                   back reversed; only for quasi-static motion)
//   note            the cycle design, copied into the provenance
//   curves          {meshKey: live => points}: rebuilt cords (laid rope)
//                   recorded as centreline points instead of vertex frames;
//                   the route's sync(u, qpos, curves) rebuilds the mesh
//   derivedMeshes   keys of meshes that sync rebuilds from those curves
//                   (or, for 109, from the recorded qpos)
//   seamExclude     derived meshes whose vertex count changes, left out of
//                   the seam continuity check
//   roundTripLoops  baked loop index the live round trip is compared with
//   qpos            false omits the recorded joint coordinates
//   minLoopSeconds  shortest loop considered (a long gear-ratio repeat)
export const bakeConfigs = {
  82: {
    directory: 'src/simulation/mujoco-treadle',
    // The 26-tooth ratchet advances by whole teeth per treadle stroke.
    wrap: {'blocks.wheel': {symmetry: 2 * Math.PI / 26}},
    warmupPeriods: 3, maxLoopPeriods: 12, searchPeriods: 24, tolerancePixels: .5,
    note: 'Periodic treadle drive; the ratchet wheel advances by whole teeth each loop and is carried forward by that turn.',
  },
  93: {
    directory: 'src/simulation/mujoco-scotch-yoke',
    note: 'Constant-speed crank; one crank turn closes the loop.',
  },
  99: {
    directory: 'src/simulation/mujoco-spiral-feed',
    note: 'The disk is driven forward and back by a cosine reversal before the roller leaves the open spiral; one drive period closes the loop.',
  },
  113: {
    directory: 'src/simulation/mujoco-rack-pinion',
    variants: {pinion: {options: {mode: 'pinion'}}, rack: {options: {mode: 'rack'}}},
    defaultVariant: 'pinion',
    note: 'Sinusoidal reversing input on the selected member (pinion or rack); one drive period closes each loop after the start-up ramp.',
  },
  83: {
    directory: 'src/simulation/mujoco-spring-sector',
    // The 38-tooth crown wheel is advanced by whole teeth by the sectors.
    wrap: {'blocks.wheel': {symmetry: 2 * Math.PI / 38}},
    note: 'Sinusoidal rocking of the input slider; the spring-guided sectors advance the 38-tooth crown wheel, which is carried forward by its whole-tooth turn each loop. One drive period closes the loop.',
  },
  90: {
    directory: 'src/simulation/mujoco-eccentric-yoke',
    note: 'Constant-speed eccentric; one turn closes the loop.',
  },
  91: {
    directory: 'src/simulation/mujoco-triangular-eccentric',
    note: 'Constant-speed triangular eccentric; one turn closes the loop.',
  },
  92: {
    directory: 'src/simulation/mujoco-crank-slider',
    note: 'Constant-speed crank; one turn closes the loop.',
  },
  94: {
    directory: 'src/simulation/mujoco-variable-crank',
    note: 'Cosine reversal of the crank across its adjustable range; one drive period closes the loop.',
  },
  95: {
    directory: 'src/simulation/mujoco-inclined-disk',
    note: 'Constant-speed inclined disk driving the roller follower; one turn closes the loop.',
  },
  96: {
    directory: 'src/simulation/mujoco-heart-cam',
    note: 'Constant-speed heart cam against the spring-loaded bar; one turn closes the loop.',
  },
  97: {
    directory: 'src/simulation/mujoco-grooved-heart',
    note: 'Constant-speed grooved heart cam; one turn closes the loop.',
  },
  98: {
    directory: 'src/simulation/mujoco-endless-groove',
    note: 'Constant-speed endless-groove cam; one turn closes the loop.',
  },
  100: {
    directory: 'src/simulation/mujoco-quick-return',
    note: 'Constant-speed crank of the quick return; one turn closes the loop.',
  },
  101: {
    directory: 'src/simulation/mujoco-slotted-bar',
    note: 'Cosine rocking of the lever in the slotted bar; one drive period closes the loop.',
  },
  102: {
    directory: 'src/simulation/mujoco-screw',
    note: 'Reversing nut drive (1 - cos): the nut climbs the fixed bolt and returns; one drive period closes the loop. The section cap is refreshed from the recorded nut pose during playback.',
  },
  103: {
    directory: 'src/simulation/mujoco-leadscrew-slide',
    note: 'Reversing screw drive (1 - cos): the slide runs out and returns; one drive period closes the loop.',
  },
  104: {
    directory: 'src/simulation/mujoco-worm-saddle',
    variants: {worm: {options: {mode: 'worm'}}, wheel: {options: {mode: 'wheel'}}},
    defaultVariant: 'worm',
    note: 'Reversing input (1 - cos) on the selected member (screw or wheel); one drive period closes each loop.',
  },
  105: {
    directory: 'src/simulation/mujoco-screw-press',
    note: 'Reversing handle drive (1 - cos): the ram presses the blank and lifts again; one drive period closes the loop.',
  },
  106: {
    directory: 'src/simulation/mujoco-barrel-cam',
    note: 'Constant-speed barrel cam; one turn closes the loop.',
  },
  107: {
    directory: ['src/simulation/mujoco-serpentine-cam', 'src/simulation/mujoco-barrel-cam'],
    note: "Constant-speed serpentine cam (106's physics); one turn closes the loop.",
  },
  120: {
    directory: 'src/simulation/mujoco-segment-clamp',
    note: 'Reversing shaft stroke: the jaws close point to point, dwell under torque and reopen; one drive period closes the loop.',
  },
  108: {
    directory: 'src/simulation/mujoco-reverse-thread',
    // One 33 s drive period is a whole traverse cycle (six barrel turns, out
    // and back); the barrel carries forward by whole turns.
    wrap: {'blocks.input': {symmetry: 2 * Math.PI}},
    warmupPeriods: 1, maxLoopPeriods: 1, searchPeriods: 2,
    note: 'One drive period is a whole traverse cycle: the barrel turns six times at constant speed while the swiveling shoe runs out along one hand of the groove and back along the other. The barrel is carried forward by whole turns.',
  },
  109: {
    directory: 'src/simulation/mujoco-thread-cutting',
    // The route's sync rebuilds the cut workpiece from the recorded work angle.
    derivedMeshes: ['parts.workpiece'],
    // Its vertex count changes as the cut advances, so it is left out of the
    // seam vertex-continuity check; it is a function of the periodic qpos and time.
    seamExclude: ['parts.workpiece'],
    // Baked playback opens on a part-cut first descent while the live model
    // compared at the loop's start time has long finished its thread, so the
    // round trip is checked against the second baked loop.
    roundTripLoops: 1,
    note: 'The lathe drive reverses each period: the tool carriage descends along the stock and returns up its groove. Playback opens part-way down the first cut (threaded above the tool, plain blank below); that descent finishes the thread and every later pass chases it, so the loop never exchanges the work. The route sync rebuilds the cut from the recorded work angle and playback time; one 24 s period closes the loop.',
  },
  110: {
    directory: 'src/simulation/mujoco-half-nut',
    wrap: {'blocks.roller': {symmetry: 2 * Math.PI}},
    note: 'The roller turns at a constant 60 rpm and the selector throws the half-nut over at each end of travel, so the carriage runs out and back; one 16 s traverse cycle closes the loop and the roller is carried forward by whole turns.',
  },
  111: {
    directory: 'src/simulation/mujoco-micrometer',
    note: 'Cosine reversing sleeve drive: the sleeve screws out and back; one drive period closes the loop.',
  },
  112: {
    directory: 'src/simulation/mujoco-persian-drill',
    note: 'Sinusoidal reversing grip stroke after the start-up ramp: the drill turns one way and back; one drive period closes the loop.',
  },
  114: {
    directory: 'src/simulation/mujoco-double-rack',
    note: 'The half-toothed pinion turns at constant speed and drives the frame alternately one way and back; one pinion turn closes the loop.',
  },
  115: {
    directory: 'src/simulation/mujoco-equal-racks',
    note: 'Sinusoidal reversing opposite torques drive the frame out and back after the start-up ramp; one drive period closes the loop.',
  },
  116: {
    directory: 'src/simulation/mujoco-rack-rectifier',
    // The output ratchet has six teeth; it advances by whole teeth per loop.
    wrap: {'blocks.output': {symmetry: 2 * Math.PI / 6}},
    note: 'Reversing rack stroke: the two loose pinions swing each way and their pawls alternately drive the output one way. One stroke cycle closes the loop, and the six-tooth output ratchet is carried forward by the whole teeth it advances.',
  },
  117: {
    directory: 'src/simulation/mujoco-roller-yoke',
    note: 'The cam turns at constant speed and drives the yoke up and down through the two free rollers; one cam turn closes the loop, with each roller carried forward by its own turn.',
  },
  118: {
    directory: 'src/simulation/mujoco-stroke-doubler',
    note: 'Sinusoidal reversing pitman stroke after the start-up ramp; the pinion rolls along the fixed rack and the upper rack runs out and back; one drive period closes the loop.',
  },
  119: {
    directory: 'src/simulation/mujoco-endless-rack',
    note: 'The pinion turns at constant speed and drives the rack along, lifting round each end and back; one pinion period closes the loop.',
  },
  121: {
    directory: 'src/simulation/mujoco-reversible-click',
    variants: {forward: {options: {mode: 'forward'}}, reverse: {options: {mode: 'reverse'}}},
    defaultVariant: 'forward',
    // The 24-tooth cog advances by whole teeth per loop.
    wrap: {'blocks.output': {symmetry: 2 * Math.PI / 24}},
    note: 'The input rod rises and falls on a cosine stroke, rocking the disk; the click drives the 24-tooth cog one way (forward, as engraved) or the other (thrown over). The cog advances by whole teeth each stroke, so one stroke closes each configuration’s loop and the cog is carried forward by those teeth.',
  },
  122: {
    directory: 'src/simulation/mujoco-variable-traverse',
    qpos: false,
    // Lower gear 23 teeth (driven), upper 29: both crank pins return
    // together only after 29 lower-gear turns (116 s).
    wrap: {'blocks.upper': {symmetry: 2 * Math.PI}, 'blocks.lower': {symmetry: 2 * Math.PI}},
    maxLoopPeriods: 29, minLoopSeconds: 116, warmupPeriods: 2, searchPeriods: 3,
    note: 'The lower gear turns at constant speed. With 23 and 29 teeth the two crank pins return together only after 29 lower-gear turns, so the loop is that whole 116 s traverse pattern; both gears are carried forward by whole turns.',
  },
  124: {
    directory: 'src/simulation/mujoco-bow-drill',
    // The frictional cord settles slowly; a whole bow stroke closes within
    // 0.1 px about 30 strokes in.
    warmupPeriods: 4, maxLoopPeriods: 4, searchPeriods: 28,
    curves: {'parts.initialCord': live => live.physics.getCordPoints()},
    qpos: false,
    note: 'The bow is drawn to and fro on a sinusoidal stroke and its cord turns the drill one way and back by friction. After the frictional cord settles, one bow stroke closes the loop. The laid-rope cord is stored as its recorded centreline and rebuilt in playback; the stock deformation under cord tension is stored as vertex frames.',
  },
  125: {
    directory: 'src/simulation/mujoco-cascaded-traverse',
    qpos: false,
    // Gears 19 (left), 23 (middle) and 29 (right, driven) each carry a crank
    // pin, so the whole linkage repeats only after 19 x 23 = 437 right-gear
    // turns (1748 s). The slow linkage is sampled at 20 Hz.
    wrap: {'blocks.left': {symmetry: 2 * Math.PI}, 'blocks.middle': {symmetry: 2 * Math.PI}, 'blocks.right': {symmetry: 2 * Math.PI}},
    maxLoopPeriods: 437, minLoopSeconds: 1748, warmupPeriods: 2, searchPeriods: 1, sampleRate: 20,
    note: 'The right gear turns at constant speed. Its 29 teeth drive the 23-tooth middle and 19-tooth left gears, and each gear carries a crank pin, so the linkage repeats exactly only after 437 right-gear turns; the loop is that whole 1748 s pattern, sampled at 20 Hz, with every gear carried forward by whole turns.',
  },
  126: {
    directory: 'src/simulation/mujoco-bell-crank',
    warmupPeriods: 4, maxLoopPeriods: 10, searchPeriods: 20,
    curves: {'parts.inputCord': live => live.physics.getCordPoints('input'), 'parts.outputCord': live => live.physics.getCordPoints('output')},
    derivedMeshes: ['/ropeEndsBeyondCrop#0/outputLead#0'],
    qpos: false,
    note: 'The input grip is drawn up and down on a sinusoidal stroke after the start-up ramp; the cord turns the pulley by friction and the bell crank pulls the loaded output cord. The frictional cords take several strokes to settle, and three strokes close within 0.25 px. Both laid-rope cords are stored as recorded centrelines and rebuilt in playback, with the output lead beyond the crop derived from the output cord end.',
  },
};
