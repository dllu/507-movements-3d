import * as THREE from 'three';
import {makeBoredPlanarLink, boredPlanarLinkGeometry} from './bored-planar-link.js';
import {capsule, circle, poly, plate, polygonClipping} from './finite-plate-geometry.js';
import {
  PALETTE,
  makeBeam,
  makeDynamicCable,
  markShadows,
  matte,
} from './primitives.js';

export const FULL_TURN = Math.PI * 2;
export const Z_AXIS = new THREE.Vector3(0, 0, 1);

export function cylinderAlongZ(radius, length, material, segments = 28) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

export function boredBoss(radius, depth, boreRadius, material) {
  return new THREE.Mesh(boredPlanarLinkGeometry({
    length: 0, width: radius * 2, eyeRadius: radius, boreRadius, depth,
  }), material);
}

// Finite tapered lever, with different eyes at the shaft and driven pin.
export function boredGabLever(end, {startRadius, endRadius, startBore, endBore, depth, width}, material) {
  const length = Math.hypot(end.x, end.y);
  const startHalfWidth = width === undefined ? startRadius * .72 : width / 2;
  const endHalfWidth = width === undefined ? endRadius * .72 : width / 2;
  const outline = polygonClipping.union(
    poly(circle([0, 0], startRadius, 64)),
    poly(circle([length, 0], endRadius, 64)),
    poly([[0, -startHalfWidth], [length, -endHalfWidth],
      [length, endHalfWidth], [0, startHalfWidth]]),
  );
  const bores = [{x: 0, y: 0, radius: startBore}];
  if (endBore > 0) bores.push({x: length, y: 0, radius: endBore});
  const geometry = plate(polygonClipping.difference(outline,
    ...bores.map(bore => poly(circle([bore.x, bore.y], bore.radius, 64)))), -depth / 2, depth / 2);
  geometry.userData.bores = bores;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.z = Math.atan2(end.y, end.x);
  return mesh;
}

export function rotate2(angle, point) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
}

export function boredCamHandle(points, radius, boreRadius, material) {
  const curve = new THREE.SplineCurve(points), left = [], right = [];
  for (let i = 0; i <= 128; i++) {
    const p = curve.getPoint(i / 128), tangent = curve.getTangent(i / 128);
    left.push([p.x - radius * tangent.y, p.y + radius * tangent.x]);
    right.push([p.x + radius * tangent.y, p.y - radius * tangent.x]);
  }
  const outline = polygonClipping.union(poly([...left, ...right.reverse()]), poly(circle([0, 0], .20, 64)));
  return new THREE.Mesh(plate(polygonClipping.difference(outline,
    poly(circle([0, 0], boreRadius, 64))), -radius, radius), material);
}

// A round cam toe bears on a flat shoulder. Rocking the free handle resolves
// the changing rod/support pose without prescribing a penetrated contact.
export function camAngleOnShoulder(pivot, toe, support, normal, commandedAngle) {
  const residual = rotate2(commandedAngle, toe).add(pivot).sub(support).dot(normal);
  if (Math.abs(residual) < 1e-13) return commandedAngle;
  const projection = support.clone().sub(pivot).dot(normal) / toe.length();
  if (Math.abs(projection) > 1 + 1e-12) throw new RangeError('Gab cam cannot reach its shoulder');
  const supportAngle = Math.atan2(normal.y, normal.x) - Math.PI / 2;
  const toeAngle = Math.atan2(toe.y, toe.x);
  const angle = Math.asin(THREE.MathUtils.clamp(projection, -1, 1));
  return [angle, Math.PI - angle].map(candidate => {
    const result = supportAngle + candidate - toeAngle;
    return commandedAngle + THREE.MathUtils.euclideanModulo(result - commandedAngle + Math.PI, FULL_TURN) - Math.PI;
  }).sort((a, b) => Math.abs(a - commandedAngle) - Math.abs(b - commandedAngle))[0];
}

export function pointInPose(position, angle, localPoint) {
  return rotate2(angle, localPoint).add(position);
}

export function smootherstepLaw(normalized) {
  const value = normalized ** 3 * (
    normalized * (normalized * 6 - 15) + 10
  );
  const firstDerivative = 30 * normalized ** 2 * (1 - normalized) ** 2;
  const secondDerivative = 60 * normalized
    * (1 - normalized)
    * (1 - 2 * normalized);
  return { firstDerivative, secondDerivative, value };
}

export function c2BumpLaw(normalized) {
  const value = 64 * normalized ** 3 * (1 - normalized) ** 3;
  const firstDerivative = 192 * normalized ** 2
    * (1 - normalized) ** 2
    * (1 - 2 * normalized);
  return { firstDerivative, value };
}

export function transitionLaw(phase, start, end, from, to) {
  const duration = end - start;
  const normalized = THREE.MathUtils.clamp(
    (phase - start) / duration,
    0,
    1,
  );
  const smooth = smootherstepLaw(normalized);
  return {
    accelerationPerPhaseSquared:
      (to - from) * smooth.secondDerivative / duration ** 2,
    ratePerPhase: (to - from) * smooth.firstDerivative / duration,
    value: THREE.MathUtils.lerp(from, to, smooth.value),
  };
}

export function bumpLaw(phase, start, end, amplitude) {
  const duration = end - start;
  const normalized = THREE.MathUtils.clamp(
    (phase - start) / duration,
    0,
    1,
  );
  const bump = c2BumpLaw(normalized);
  return {
    ratePerPhase: amplitude * bump.firstDerivative / duration,
    value: amplitude * bump.value,
  };
}

export function makeTube(points, radius, material, z = 0, closed = false) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(point.x, point.y, point.z ?? z)),
    closed,
    'centripetal',
  );
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(64, points.length * 18), radius, 12, closed),
    material,
  );
}

// A flat spring strap of rectangular section, Brown's double-line strap. Its
// centerline is rebuilt each frame; the width lies in the drawing plane.
export function makeFlatStrap(maxPoints, width, depth, material) {
  const faces = 4, perRing = faces * 2;
  const positions = new Float32Array((maxPoints * perRing + 8) * 3);
  const index = [];
  for (let i = 0; i < maxPoints - 1; i++) for (let f = 0; f < faces; f++) {
    const a = i * perRing + f * 2, b = a + 1, c = a + perRing, d = b + perRing;
    index.push(a, c, b, b, c, d);
  }
  const capStart = maxPoints * perRing;
  index.push(capStart, capStart + 1, capStart + 2, capStart, capStart + 2, capStart + 3);
  index.push(capStart + 4, capStart + 6, capStart + 5, capStart + 4, capStart + 7, capStart + 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(index);
  const mesh = new THREE.Mesh(geometry, material);
  const corner = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  mesh.userData.setPoints = (points) => {
    if (points.length !== maxPoints) throw new RangeError('Strap point count changed');
    const rings = points.map((point, i) => {
      const previous = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
      const tx = next.x - previous.x, ty = next.y - previous.y, length = Math.hypot(tx, ty) || 1;
      const nx = -ty / length, ny = tx / length;
      return corner.map(([s, t]) => [point.x + nx * s * width / 2, point.y + ny * s * width / 2, point.z + t * depth / 2]);
    });
    rings.forEach((ring, i) => {
      for (let f = 0; f < faces; f++) for (let k = 0; k < 2; k++) {
        positions.set(ring[(f + k) % 4], (i * perRing + f * 2 + k) * 3);
      }
    });
    [rings[0], rings.at(-1)].forEach((ring, e) => ring.forEach((p, k) => positions.set(p, (capStart + e * 4 + k) * 3)));
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  };
  return mesh;
}

// Extrude an outline traced in source raster pixels into a finite plate.
export function sourcePlate(outlines, toLocal, low, high, material, holes = [], smooth = false) {
  const smoothRing = (points) => new THREE.CatmullRomCurve3(
    points.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal',
  ).getSpacedPoints(Math.max(96, points.length * 6)).slice(0, -1).map((p) => [p.x, p.y]);
  const toRing = (points) => (smooth ? smoothRing(points) : points).map((point) => {
    const local = toLocal(new THREE.Vector2(point[0], point[1]));
    return [local.x, local.y];
  });
  let shape = polygonClipping.union(...outlines.map((outline) => (
    Array.isArray(outline[0]?.[0]?.[0]) ? outline : poly(toRing(outline))
  )));
  if (holes.length) shape = polygonClipping.difference(shape, ...holes);
  return new THREE.Mesh(plate(shape, low, high), material);
}

export function distanceToRectangle(point, minimum, maximum) {
  const dx = Math.max(minimum.x - point.x, 0, point.x - maximum.x);
  const dy = Math.max(minimum.y - point.y, 0, point.y - maximum.y);
  return Math.hypot(dx, dy);
}
export {makeBoredPlanarLink, boredPlanarLinkGeometry, capsule, circle, poly, plate, polygonClipping, PALETTE, makeBeam, makeDynamicCable, markShadows, matte};
