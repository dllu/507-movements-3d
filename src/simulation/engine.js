// Synchronous compatibility entry for offline reviews and existing integrations.
// The application imports async-engine.js to avoid loading the legacy registry.
import {MovementEngine as AsyncMovementEngine} from './async-engine.js';
import {createMovementModel} from './registry.js';
export {groundFloorFor, perspectiveBoxFitDistance, perspectiveObjectFitDistance} from './async-engine.js';

export class MovementEngine extends AsyncMovementEngine {
  constructor(container, movement, options = {}) {
    super(container, movement, {...options, model: options.model ?? createMovementModel(movement)});
  }
}
