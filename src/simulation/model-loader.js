import {createMovementModel} from './registry.js';

// Migrate a movement by registering its factory here. Existing authored models
// remain available while each replacement's geometry and contacts are checked.
const physicsFactories = {
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
};

export async function loadMovementModel(movement) {
  const loadFactory = physicsFactories[movement.id];
  if (!loadFactory) return createMovementModel(movement);
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
