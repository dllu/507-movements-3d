import {springHandleGabDisengager} from './gab-disengager-186.js';
import {twoHandleGabDisengager} from './gab-disengager-187.js';
import {loopHandlePinCamGabDisengager} from './gab-disengager-188.js';
import {bellCrankHangerGabDisengager} from './gab-disengager-189.js';

export function createAuthoredGabDisengagerMovement(movement) {
  const factory = {
    186: springHandleGabDisengager,
    187: twoHandleGabDisengager,
    188: loopHandlePinCamGabDisengager,
    189: bellCrankHangerGabDisengager,
  }[movement.id];
  if (!factory) return null;
  const model = factory();
  model.root.userData.hideGround = true;
  model.root.traverse(object => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material) material.fog = false;
    }
  });
  return model;
}
