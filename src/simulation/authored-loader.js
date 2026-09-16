import {authoredRoutes} from './authored-routes.js';
import {applyDisplayTiming} from './display-timing.js';

const routesById = new Map();
for (const route of authoredRoutes) for (const id of route.ids) {
  if (routesById.has(id)) throw new Error(`Duplicate authored route for ${id}`);
  routesById.set(id, route.load);
}

export async function loadAuthoredMovement(movement) {
  const load = routesById.get(movement.id);
  if (!load) throw new RangeError(`Movement ${movement.id} has no authored route.`);
  const factory = await load();
  const model = factory(movement);
  if (!model || model.root.userData.fidelity !== 'authored') {
    throw new TypeError(`Movement ${movement.id} has an invalid authored route; regenerate authored-routes.js.`);
  }
  model.root.userData.archetype ??= movement.archetype;
  return applyDisplayTiming(model, movement);
}
