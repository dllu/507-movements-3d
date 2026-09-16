import { makeShaft } from './primitives.js';

// Specify exposed shaft ends explicitly: extending a decorative shaft through
// the moving rod plane creates a collision even when the pin equations close.
export function makeCouplingShaft({ startZ, endZ, radius, color }) {
  if (!(endZ > startZ)) throw new RangeError('Shaft ends must be ordered');
  const shaft = makeShaft({ length: endZ - startZ, radius, color });
  shaft.position.z = (startZ + endZ) / 2;
  shaft.userData.axialSpan = [startZ, endZ];
  return shaft;
}
