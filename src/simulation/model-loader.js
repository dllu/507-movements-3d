import {loadAuthoredMovement} from './authored-loader.js';
import {applySourcePresentation} from './source-presentation.js';

// Migrate a movement by registering its factory here. Existing authored models
// remain available while each replacement's geometry and contacts are checked.
export const physicsFactories = {
  82: () => import('./mujoco-treadle/visual.js').then(module => module.makeMujocoTreadle),
  83: () => import('./mujoco-spring-sector/visual.js').then(module => module.makeMujocoSpringSector),
  90: () => import('./mujoco-eccentric-yoke/visual.js').then(module => module.makeMujocoEccentricYoke),
  91: () => import('./mujoco-triangular-eccentric/visual.js').then(module => module.makeMujocoTriangularEccentric),
  92: () => import('./mujoco-crank-slider/visual.js').then(module => module.makeMujocoCrankSlider),
  93: () => import('./mujoco-scotch-yoke/visual.js').then(module => module.makeMujocoScotchYoke),
  94: () => import('./mujoco-variable-crank/visual.js').then(module => module.makeMujocoVariableCrank),
  95: () => import('./mujoco-inclined-disk/visual.js').then(module => module.makeMujocoInclinedDisk),
  96: () => import('./mujoco-heart-cam/visual.js').then(module => module.makeMujocoHeartCam),
  97: () => import('./mujoco-grooved-heart/visual.js').then(module => module.makeMujocoGroovedHeart),
  98: () => import('./mujoco-endless-groove/visual.js').then(module => module.makeMujocoEndlessGroove),
  99: () => import('./mujoco-spiral-feed/visual.js').then(module => module.makeMujocoSpiralFeed),
  100: () => import('./mujoco-quick-return/visual.js').then(module => module.makeMujocoQuickReturn),
  101: () => import('./mujoco-slotted-bar/visual.js').then(module => module.makeMujocoSlottedBar),
  102: () => import('./mujoco-screw/visual.js').then(module => module.makeMujocoScrew),
  103: () => import('./mujoco-leadscrew-slide/visual.js').then(module => module.makeMujocoLeadscrewSlide),
  104: () => import('./mujoco-worm-saddle/visual.js').then(module => module.makeMujocoWormSaddle),
  105: () => import('./mujoco-screw-press/visual.js').then(module => module.makeMujocoScrewPress),
  106: () => import('./mujoco-barrel-cam/visual.js').then(module => module.makeMujocoBarrelCam),
  107: () => import('./mujoco-serpentine-cam/visual.js').then(module => module.makeMujocoSerpentineCam),
  108: () => import('./mujoco-reverse-thread/visual.js').then(module => module.makeMujocoReverseThread),
  109: () => import('./mujoco-thread-cutting/visual.js').then(module => module.makeMujocoThreadCutting),
  110: () => import('./mujoco-half-nut/visual.js').then(module => module.makeMujocoHalfNut),
  111: () => import('./mujoco-micrometer/visual.js').then(module => module.makeMujocoMicrometer),
  112: () => import('./mujoco-persian-drill/visual.js').then(module => module.makeMujocoPersianDrill),
  113: () => import('./mujoco-rack-pinion/visual.js').then(module => module.makeMujocoRackPinion),
  114: () => import('./mujoco-double-rack/visual.js').then(module => module.makeMujocoDoubleRack),
  115: () => import('./mujoco-equal-racks/visual.js').then(module => module.makeMujocoEqualRacks),
  116: () => import('./mujoco-rack-rectifier/visual.js').then(module => module.makeMujocoRackRectifier),
  117: () => import('./mujoco-roller-yoke/visual.js').then(module => module.makeMujocoRollerYoke),
  118: () => import('./mujoco-stroke-doubler/visual.js').then(module => module.makeMujocoStrokeDoubler),
  119: () => import('./mujoco-endless-rack/visual.js').then(module => module.makeMujocoEndlessRack),
  120: () => import('./mujoco-segment-clamp/visual.js').then(module => module.makeMujocoSegmentClamp),
  121: () => import('./mujoco-reversible-click/visual.js').then(module => module.makeMujocoReversibleClick),
  122: () => import('./mujoco-variable-traverse/visual.js').then(module => module.makeMujocoVariableTraverse),
  124: () => import('./mujoco-bow-drill/visual.js').then(module => module.makeMujocoBowDrill),
  125: () => import('./mujoco-cascaded-traverse/visual.js').then(module => module.makeMujocoCascadedTraverse),
  126: () => import('./mujoco-bell-crank/visual.js').then(module => module.makeMujocoBellCrank),
};

export async function loadMovementModel(movement) {
  const model = await loadUnpresentedModel(movement);
  // Authored models were presented during display timing; presenting twice
  // would compound the rotation.
  if (!model.root.userData.sourcePresentation) applySourcePresentation(model, movement);
  return model;
}

async function loadUnpresentedModel(movement) {
  if (movement.id === 181 || movement.id === 182) {
    const {makeBakedDiagonalCatch} = await import('./baked/diagonal-catch.js');
    const model = await makeBakedDiagonalCatch(movement.id);
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 180) {
    const {makeBakedSingleClamp} = await import('./baked/single-clamp.js');
    const model = await makeBakedSingleClamp();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 174) {
    const {makeBakedBenchClamp} = await import('./baked/bench-clamp.js');
    const model = await makeBakedBenchClamp();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 173) {
    const {makeBakedTappetSilkTraverse} = await import('./baked/tappet-silk-traverse.js');
    const model = await makeBakedTappetSilkTraverse();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 170) {
    const {makeBakedCrossedGovernor} = await import('./baked/crossed-governor.js');
    const model = await makeBakedCrossedGovernor();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 169) {
    const {makeLinkedVariableCrank} = await import('./linked-variable-crank.js');
    const model = makeLinkedVariableCrank();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 168) {
    const {makeVariableRadiusCrank} = await import('./variable-radius-crank.js');
    const model = makeVariableRadiusCrank();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 167) {
    const {makeReversingGrooveDrum} = await import('./reversing-groove-drum.js');
    const model = makeReversingGrooveDrum();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 166) {
    const {makeLostMotionBrickPress} = await import('./lost-motion-brick-press.js');
    const model = makeLostMotionBrickPress();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 165) {
    const {makeBakedWaveCam} = await import('./baked/wave-cam.js');
    const model = await makeBakedWaveCam();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 164) {
    const {makeKneePress} = await import('./knee-press.js');
    const model = makeKneePress();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 163) {
    const {makeBakedBeltGovernor} = await import('./baked/belt-governor.js');
    const model = await makeBakedBeltGovernor();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 162) {
    const {makeBakedWaterGovernor} = await import('./baked/water-governor.js');
    const model = await makeBakedWaterGovernor();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 161) {
    const {makeBakedBallGovernor} = await import('./baked/ball-governor.js');
    const model = await makeBakedBallGovernor();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 160) {
    const {makeBakedSpringTreadle} = await import('./baked/spring-treadle.js');
    const model = await makeBakedSpringTreadle();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 159) {
    const {makeBakedCordTreadle} = await import('./baked/cord-treadle.js');
    const model = await makeBakedCordTreadle();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 158) {
    const {makeSourceTreadle} = await import('./source-treadle.js');
    const model = makeSourceTreadle();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 157) {
    const {makePinnedElbow} = await import('./pinned-elbow.js');
    const model = makePinnedElbow();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 156) {
    const {makeSlottedElbow} = await import('./slotted-elbow.js');
    const model = makeSlottedElbow();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 155) {
    const {makeBakedElbowPawl} = await import('./baked/elbow-pawl.js');
    const model = await makeBakedElbowPawl();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 154) {
    const {makeBakedWeightedBellCrank} = await import('./baked/weighted-bell-crank.js');
    const model = await makeBakedWeightedBellCrank();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 153) {
    const {makeBakedStudReverser} = await import('./baked/stud-reverser.js');
    const model = await makeBakedStudReverser();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 152) {
    const {makeTrammelEllipsograph} = await import('./trammel-ellipsograph.js');
    const model = makeTrammelEllipsograph();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 151) {
    const {makeOpposedScrewNuts} = await import('./opposed-screw-nuts.js');
    const model = makeOpposedScrewNuts();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 150) {
    const {makeSelectableCamValve} = await import('./selectable-cam-valve.js');
    const model = makeSelectableCamValve();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 149) {
    const {makeBakedTwinCam} = await import('./baked/twin-cam.js');
    const model = await makeBakedTwinCam();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 148) {
    const {makeGearedCrank} = await import('./geared-crank.js');
    const model = makeGearedCrank();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 147) {
    const {makeBakedFanGovernor} = await import('./baked/fan-governor.js');
    const model = await makeBakedFanGovernor();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 146) {
    const {makeFramedYoke} = await import('./framed-yoke.js');
    const model = makeFramedYoke();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 143) {
    const {makeBakedSlidingWorm} = await import('./baked/sliding-worm.js');
    const model = await makeBakedSlidingWorm();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 142) {
    const {makeBakedSilkTraverse} = await import('./baked/silk-traverse.js');
    const model = await makeBakedSilkTraverse();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 141) {
    const {makeBandSaw} = await import('./band-saw.js');
    const model = makeBandSaw();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 140) {
    const {makeTogglePunch} = await import('./toggle-punch.js');
    const model = makeTogglePunch();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 139) {
    const {makeBakedInternalRack} = await import('./baked/internal-rack.js');
    const model = await makeBakedInternalRack();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 138) {
    const {makeBakedVariableCam} = await import('./baked/variable-cam.js');
    const model = await makeBakedVariableCam();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 137) {
    const {makeBakedExpansionEccentric} = await import('./baked/expansion-eccentric.js');
    const model = await makeBakedExpansionEccentric();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 131) {
    const {makeSlottedSector} = await import('./slotted-sector.js');
    const model = makeSlottedSector();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 130) {
    const {makeBakedPlateShears} = await import('./baked/plate-shears.js');
    const model = await makeBakedPlateShears();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 128) {
    const {makeBakedThreeWiper} = await import('./baked/three-wiper.js');
    const model = await makeBakedThreeWiper();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  if (movement.id === 123) {
    const {makeBakedSectorHandoff} = await import('./baked/sector-handoff.js');
    const model = await makeBakedSectorHandoff();
    model.root.userData.archetype = movement.archetype;
    return model;
  }
  const loadFactory = physicsFactories[movement.id];
  if (!loadFactory) return loadAuthoredMovement(movement);
  const [mujoco, factory] = await Promise.all([
    import('./mujoco/load.js').then(module => module.getMujoco()),
    loadFactory(),
  ]);
  const model = factory(mujoco);
  model.root.userData.archetype = movement.archetype;
  // A live simulation supplies its own physical clock and motion envelope.
  // Historical display profiles describe the old kinematic reconstruction.
  return model;
}
