import * as THREE from 'three';
import { crown237Return as bake } from './baked/crown-pawl-237-return.js';
import { plate, circle, ring } from './finite-plate-geometry.js';
export { crown237Return } from './baked/crown-pawl-237-return.js';
const values = bake.samples, count = values.length - 1, step = bake.armSwing / count;
const slopes = values.map((v, i) => {
  if (i === 0 || i === count) return 0;
  const a = (v - values[i - 1]) / step, b = (values[i + 1] - v) / step;
  return a * b > 0 ? 2 * a * b / (a + b) : 0;
});
export function crown237LiftAtTravel(travel) {
  const x = THREE.MathUtils.clamp(travel / step, 0, count), i = Math.min(count - 1, Math.floor(x)), t = x - i;
  const a = values[i], b = values[i + 1], u = slopes[i] * step, v = slopes[i + 1] * step;
  const liftAngle = (2*t**3-3*t*t+1)*a + (t**3-2*t*t+t)*u + (-2*t**3+3*t*t)*b + (t**3-t*t)*v;
  const derivativePerTravel = ((6*t*t-6*t)*a+(3*t*t-4*t+1)*u+(-6*t*t+6*t)*b+(3*t*t-2*t)*v)/step;
  return { liftAngle, derivativePerTravel, mode: travel < bake.startTravel ? 'clear-over-low-crown-ramp'
    : travel <= bake.peakTravel ? 'pawl-climbing-crown-ramp'
      : travel >= bake.armSwing ? 'pawl-seated-after-crown-face' : 'pawl-prescribed-crest-clearance-and-drop' };
}
export function crown237Triangles(wheel) {
  return wheel.userData.crownTeeth.flatMap(tooth => {
    const g = tooth.geometry, p = g.attributes.position, ix = g.index, result = [];
    for (let i = 0; i < ix.count; i += 3) result.push(new THREE.Triangle(...[0,1,2].map(k => new THREE.Vector3().fromBufferAttribute(p, ix.getX(i+k)))));
    return result;
  });
}
export function crown237Closest(center, triangles) {
  const point = new THREE.Vector3(), nearest = new THREE.Vector3(); let distance = Infinity;
  for (const triangle of triangles) {
    triangle.closestPointToPoint(center, point); const value = point.distanceToSquared(center);
    if (value < distance) { distance = value; nearest.copy(point); }
  }
  return { point: nearest, distance: Math.sqrt(distance), normal: center.clone().sub(nearest).normalize() };
}
export function installCrown237Parts(root) {
  const b = root.userData.blocks, g = root.userData.geometry;
  const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
  const curve = new THREE.SplineCurve([new THREE.Vector2(-0.14, 0), new THREE.Vector2(-0.25, -0.14), new THREE.Vector2(-0.34, -0.36), new THREE.Vector2(-0.385, -0.59)]);
  const outline = [1, -1].flatMap(side => Array.from({length: 49}, (_, i) => {
    const t = side === 1 ? i / 48 : 1 - i / 48, p = curve.getPoint(t), tangent = curve.getTangent(t);
    const width = 0.025 + 0.012 * Math.sin(Math.PI * t);
    return [p.x - side * tangent.y * width, p.y + side * tangent.x * width];
  }));
  const body = plate([[outline]], -0.055, 0.055);
  body.applyMatrix4(new THREE.Matrix4().set(0,0,1,0, 1,0,0,0, 0,1,0,0, 0,0,0,1));
  replace(b.pawlBody, body);
  replace(b.pawlNose, new THREE.SphereGeometry(g.pawlNoseRadius, 64, 32));
  b.pawlIndicator.visible = false;
  // Radial hinge:
  // Bored eye around a distinct arm-fixed pin.
  replace(b.pawlHingeBarrel, new THREE.CylinderGeometry(0.10, 0.10, 0.26, 48));
  replace(b.pawlHingeRing, ring(0.104, 0.165, -0.085, 0.085, 64));
  replace(b.crownWheelBody, ring(0.104, g.wheelOuterRadius, -g.wheelBodyThickness, 0, 96));
  b.crownWheelBody.rotation.x = 0; b.crownWheelBody.position.z = 0;
  replace(b.outputBearing, ring(0.104, 0.25, -0.09, 0.09, 64).rotateX(Math.PI / 2));
  b.crownWheelIndicator.position.z = 0.013;
  // Painted crest indices stay inside the ramp; they must not become obstacles.
  for (const tick of b.crownWheel.userData.driveFaceTicks) tick.visible = false;
  const toothMaterial = b.crownWheel.userData.crownTeeth[0].material.clone();
  toothMaterial.flatShading = true;
  for (const tooth of b.crownWheel.userData.crownTeeth) tooth.material = toothMaterial;
  root.userData.cameraFov = 8;
  root.userData.cameraDistanceScale = 0.94;
  root.userData.minimumDisplayCycleSeconds = g.cyclePeriod;
  root.userData.hideGround = true;
  root.userData.reconstructionNote = 'The finite rounded pawl follows an offline-baked envelope of the actual crown-tooth triangles, then has a prescribed crest clearance and continuous drop. Clockwise drive uses the radial tooth face. Return bias, wheel holding, friction and impacts are not dynamically solved; the official page has no registered animation.';
  root.traverse(o => { for (const m of [].concat(o.material ?? [])) m.fog = false; });
}

export function fitCrown237(root, update) {
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  for (let i = 0; i <= 32; i++) {
    update(i * root.userData.geometry.cyclePeriod / 32); root.updateMatrixWorld(true);
    root.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      const p = o.geometry.attributes.position;
      for (let j = 0; j < p.count; j++) bounds.expandByPoint(point.fromBufferAttribute(p, j).applyMatrix4(o.matrixWorld));
    });
  }
  root.userData.cameraFitBounds = bounds.expandByScalar(0.035);
  update(0);
}
