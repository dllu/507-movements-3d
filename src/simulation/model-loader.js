import {createMovementModel} from './registry.js';

// Migrate a movement by registering its factory here. Existing authored models
// remain available while each replacement's geometry and contacts are checked.
const physicsFactories = {
  82: () => import('./mujoco-treadle/visual.js').then(module => module.makeMujocoTreadle),
  83: () => import('./mujoco-spring-sector/visual.js').then(module => module.makeMujocoSpringSector),
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
