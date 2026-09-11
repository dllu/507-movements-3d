import * as THREE from 'three';
import { circularArcThrough } from './primitives.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

export function circularRopeArc(center, start, end, axis, entryDirection) {
  const arc = circularArcThrough(center, start, end, axis, entryDirection);
  // Chord-sampled arc lengths bias both material travel and its derivative.
  // A true circular contact has an exact arc-length parameterization.
  arc.getLength = () => arc.radialStart.length() * Math.abs(arc.sweep);
  arc.getPointAt = (u, target) => arc.getPoint(u, target);
  arc.getTangentAt = (u, target) => arc.getTangent(u, target);
  return arc;
}

// Both straight spans and circular contacts lie in the sheave's XY plane.
export function externalTangents(center, endpoint, radius) {
  const offset = endpoint.clone().sub(center);
  if (Math.abs(offset.z) > 1e-10) throw new RangeError('A planar rope tangent requires a coplanar termination.');
  offset.z = 0;
  const squared = offset.lengthSq();
  if (squared <= radius * radius) throw new RangeError('A rope termination must lie outside the sheave.');
  const along = offset.clone().multiplyScalar(radius * radius / squared);
  const side = new THREE.Vector3().crossVectors(Z_AXIS, offset)
    .multiplyScalar(radius * Math.sqrt(squared - radius * radius) / squared);
  return [center.clone().add(along).add(side), center.clone().add(along).sub(side)];
}

export function contactState(curve, arcIndex) {
  const arc = curve.curves[arcIndex];
  const radial = arc.getPoint(0).sub(arc.center);
  return {
    entryAngle: Math.atan2(radial.y, radial.x),
    materialDistance: curve.curves.slice(0, arcIndex).reduce((sum, part) => sum + part.getLength(), 0),
    sign: Math.sign(arc.sweep),
  };
}

// A tied end fixes the material origin. Matching rope and sheave surface
// coordinates gives phi = entryAngle - sign(wrap) * materialDistance / radius.
export function rotationFromContact(curve, arcIndex, radius, initial) {
  const current = contactState(curve, arcIndex);
  const angle = current.entryAngle - initial.entryAngle;
  return Math.atan2(Math.sin(angle), Math.cos(angle))
    - current.sign * (current.materialDistance - initial.materialDistance) / radius;
}
