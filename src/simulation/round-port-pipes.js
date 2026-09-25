import * as THREE from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {mergePassageParts} from './finite-fluid-passages.js';
import {plate, poly, polygonClipping as clip} from './finite-plate-geometry.js';

// Pass 56: round bored port pipes for Brown's rotary-engine casings, whose
// ports were extruded 2D sections (two parallel slabs or square posts).
//
// A straight round pipe from `start` to `end` (world points), bore radius
// `bore`, outer radius `outer`, with flat annular end faces.
export function roundPortPipeGeometry(start, end, bore, outer, segments = 64) {
  const axis = end.clone().sub(start), length = axis.length();
  const geometry = boredLatheGeometry([{axial: 0, radial: outer}, {axial: length, radial: outer}], bore, segments);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize()));
  geometry.translate(start.x, start.y, start.z);
  return geometry;
}

// A casing extruded along z whose wall is pierced only where the round pipes
// enter: the port holes are square (side 2 * bore) and exist only in the
// middle layer |z - portZ| < bore, so the pipe's round bore, inscribed in the
// square, opens into the casing while the wall stays whole in front of and
// behind the pipe. `ports` are 2D polygons (polygon-clipping format) cut
// from the middle layer only.
export function portedCasingGeometry(shape, low, high, portZ, bore, ports) {
  const a = portZ - bore, b = portZ + bore;
  if (!(low < a && b < high)) throw new RangeError('The port bore must lie inside the casing depth');
  const back = plate(shape, low, a), outlineShapes = back.parameters.shapes;
  const geometry = mergePassageParts([
    back,
    plate(clip.difference(shape, ...ports), a, b),
    plate(shape, b, high),
  ]);
  // Back covers built from casing outlines (cutaway-back-plates.js) read these.
  geometry.userData.outlineShapes = outlineShapes;
  return geometry;
}

// Square port hole of half-width `bore` along the direction `u` (2D unit
// vector) from radius r0 to r1.
export function squarePortHole(u, r0, r1, bore) {
  const n = [-u[1], u[0]];
  const p = (r, s) => [u[0] * r + n[0] * s, u[1] * r + n[1] * s];
  return poly([p(r0, -bore), p(r1, -bore), p(r1, bore), p(r0, bore)]);
}
