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
