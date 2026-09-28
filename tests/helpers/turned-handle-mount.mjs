import * as THREE from 'three';

// Pass 92: a turned handle standing on its crank arm. Returns, at the
// model's current pose, the handle's foot radius, the distance from the
// handle axis to the nearest point of the arm's outline (in the plane
// normal to the axis) and the spread of the arm's end-arc radii (0 when the
// arm's end is a circular arc concentric with the handle).
export function turnedHandleMount(handle, arm) {
  handle.updateWorldMatrix(true, false);
  arm.updateWorldMatrix(true, false);
  const handlePosition = handle.geometry.attributes.position;
  let footRadius = 0, height = 0;
  for (let i = 0; i < handlePosition.count; i += 1) height = Math.max(height, handlePosition.getY(i));
  for (let i = 0; i < handlePosition.count; i += 1) {
    if (handlePosition.getY(i) < 0.02 * height) footRadius = Math.max(footRadius, Math.hypot(handlePosition.getX(i), handlePosition.getZ(i)));
  }
  const origin = new THREE.Vector3().applyMatrix4(handle.matrixWorld);
  const axis = new THREE.Vector3(0, 1, 0).transformDirection(handle.matrixWorld);
  const armPosition = arm.geometry.attributes.position;
  const radii = [];
  const point = new THREE.Vector3();
  for (let i = 0; i < armPosition.count; i += 1) {
    point.fromBufferAttribute(armPosition, i).applyMatrix4(arm.matrixWorld).sub(origin);
    radii.push(point.sub(axis.clone().multiplyScalar(point.dot(axis))).length());
  }
  const margin = Math.min(...radii);
  const endArc = radii.filter((r) => r < margin + 0.01);
  return { footRadius, height, margin, endArcSpread: Math.max(...endArc) - Math.min(...endArc), axis, origin };
}
