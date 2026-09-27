import * as THREE from 'three';
import { crown237Return as bake } from './baked/crown-pawl-237-return.js';
import { plate, circle, ring, turned } from './finite-plate-geometry.js';
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
  // One smooth curved plate of even width whose rounded end is the working
  // nose (radius pawlNoseRadius about the old nose centre): no separate ball.
  // 0.001 inside the round nose it replaces, for the plate's flat faces.
  const tip = new THREE.Vector2(b.pawlNose.position.y, b.pawlNose.position.z), r = g.pawlNoseRadius - 0.001;
  const curve = new THREE.SplineCurve([new THREE.Vector2(-0.14, 0), new THREE.Vector2(-0.25, -0.14), new THREE.Vector2(-0.34, -0.36), tip]);
  const side = sign => Array.from({length: 49}, (_, i) => {
    const t = sign === 1 ? i / 48 : 1 - i / 48, p = curve.getPoint(t), tangent = curve.getTangent(t);
    const w = r * (0.75 + 0.25 * t ** 8); // swells only into the nose
    return [p.x - sign * tangent.y * w, p.y + sign * tangent.x * w];
  });
  const end = curve.getTangent(1), endAngle = Math.atan2(end.y, end.x);
  const cap = Array.from({length: 23}, (_, i) => {
    const a = endAngle - Math.PI / 2 + Math.PI * (i + 1) / 24;
    return [tip.x + r * Math.cos(a), tip.y + r * Math.sin(a)];
  });
  const outline = [...side(1), ...cap, ...side(-1)];
  const body = plate([[outline]], -0.022, 0.022);
  body.applyMatrix4(new THREE.Matrix4().set(0,0,1,0, 1,0,0,0, 0,1,0,0, 0,0,0,1));
  // Curve the plate with the crown: its tangential coordinate scales with
  // radius, so the rounded nose's front lies on each radial tooth face
  // across the plate's thickness, as the round nose it replaces did.
  { const R = b.pawl.position.x, p = body.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * (R + p.getX(i)) / R);
    p.needsUpdate = true; body.computeVertexNormals(); body.computeBoundingBox(); body.computeBoundingSphere(); }
  replace(b.pawlBody, body);
  b.pawlNose.visible = false; b.pawlNose.userData.hiddenReason = 'the nose is the rounded end of the pawl plate';
  b.pawlIndicator.visible = false;
  // Radial hinge:
  // Bored eye around a distinct arm-fixed pin.
  replace(b.pawlHingeBarrel, new THREE.CylinderGeometry(0.10, 0.10, 0.26, 48));
  replace(b.pawlHingeRing, ring(0.104, 0.165, -0.085, 0.085, 64));
  // Open cup: a thin wall under the rim teeth and a thin floor at the bottom,
  // bored for the output shaft (profile is [axial, radial]).
  const floor = 0.08, low = -g.wheelBodyThickness;
  replace(b.crownWheelBody, turned([[low, 0.104], [low, g.wheelOuterRadius], [0, g.wheelOuterRadius], [0, g.wheelInnerRadius],
    [low + floor, g.wheelInnerRadius], [low + floor, 0.104]], 192));
  b.crownWheelBody.rotation.x = 0; b.crownWheelBody.position.z = 0;
  // Brown draws no hub, face ring, bearing collar, white indices or contact markers.
  for (const part of [b.crownWheelIndicator, b.crownWheelHub, b.crownWheel.userData.faceInset, b.outputBearing,
    b.armIndicator, b.driveContactMarker, b.rampContactMarker]) {
    part.visible = false; part.userData.hiddenReason = 'not drawn on plate 237';
  }
  // The shaft rises through the floor bore; the stud continues from the floor to the arm boss.
  const shaftMesh = shaft => shaft.userData.rotor.children.find(o => o.isMesh);
  shaftMesh(b.outputShaft).geometry.dispose();
  // Shaft top and stud foot stop 0.01 apart inside the floor bore.
  const shaftTop = low + floor - 0.04, studFoot = low + floor - 0.03;
  shaftMesh(b.outputShaft).geometry = new THREE.CylinderGeometry(0.1, 0.1, shaftTop + 2.61, 32);
  b.outputShaft.position.y = (-2.61 + shaftTop) / 2;
  shaftMesh(b.armFulcrumShaft).geometry.dispose();
  shaftMesh(b.armFulcrumShaft).geometry = new THREE.CylinderGeometry(0.075, 0.075, 0.7 - studFoot, 32);
  b.armFulcrumShaft.position.y = (0.7 + studFoot) / 2;
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
