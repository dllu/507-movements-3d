import * as THREE from 'three';
import clip from 'polygon-clipping';
import { matte, markShadows } from './primitives.js';

export function makePinnedEyeRod({
  length, width, depth, bores, eyeRadius = .24, axialOffset = .2, color,
}) {
  const circle = (x, radius) => Array.from({ length: 129 }, (_, i) => [
    x + radius * Math.cos(i * Math.PI / 64),
    radius * Math.sin(i * Math.PI / 64),
  ]);
  const outlines = clip.union(
    [circle(0, eyeRadius)],
    [circle(length, eyeRadius)],
    [[[0, -width / 2], [length, -width / 2], [length, width / 2],
      [0, width / 2], [0, -width / 2]]],
  );
  const shape = new THREE.Shape(outlines[0][0].map(p => new THREE.Vector2(...p)));
  for (const [i, x] of [0, length].entries()) {
    const hole = new THREE.Path();
    hole.absarc(x, 0, bores[i], 0, 2 * Math.PI, true);
    shape.holes.push(hole);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: false, curveSegments: 64,
  });
  geometry.translate(0, 0, axialOffset - depth / 2);
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, matte(color));
  // Preserve the linkage's reference endpoints independently of its axial offset.
  const start = new THREE.Object3D();
  const end = new THREE.Object3D();
  end.position.x = length;
  group.add(mesh, start, end);
  group.userData.setEndpoints = (a, b) => {
    if (Math.abs(a.distanceTo(b) - length) > 1e-6) {
      throw Error('Rigid rod length changed');
    }
    group.position.copy(a);
    group.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
  };
  group.userData.eyeRod = { length, width, depth, bores, eyeRadius, axialOffset };
  return markShadows(group);
}
