import * as THREE from 'three';
import { ring } from './finite-plate-geometry.js';
import { PALETTE, matte } from './primitives.js';
import { backBar, bearingBoss, footPillar, supportMaterial } from './back-plate-support.js';

// The captioned jointed pinion shaft of Brown's mangle wheels 192-194 ("the
// said shaft is made with a universal joint, which allows a portion of it to
// have the vibratory motion necessary to keep the pinion in gear"), and the
// plain frame carrying it and the wheel.
//
// The input shaft turns on a fixed axis parallel to the wheel shaft, in a
// bearing in front of the wheel. A Hooke joint there and a second one on the
// pinion shaft join a telescopic slip shaft, so the pinion shaft stays
// parallel to its input while its groove collar carries it to and fro. With
// both input and pinion shafts parallel and the slip shaft's two yokes in one
// plane, the pinion turns exactly with the input shaft.

const Z = new THREE.Vector3(0, 0, 1);

function eyeAlongX(inner, outer, halfThickness, material, role) {
  // A bored eye (ring about x) at the origin.
  const eye = new THREE.Mesh(ring(inner, outer, -halfThickness, halfThickness, 48), material);
  eye.rotation.y = Math.PI / 2;
  eye.userData.role = role;
  return eye;
}

// A yoke in its local frame: joint centre at the origin, its two bored eyes
// on the +/-x pin axis, the fork bridging behind the centre and a boss on the
// shaft, which leaves along +z.
function makeYoke({ reach, armRadius, shaftRadius, material, role }) {
  const group = new THREE.Group();
  group.userData.role = role;
  const eyeOuter = armRadius + 0.026, eyeHalf = 0.018, bridgeZ = reach + 0.02;
  for (const side of [-1, 1]) {
    const eye = eyeAlongX(armRadius + 0.004, eyeOuter, eyeHalf, material, `${role}-eye`);
    eye.position.x = side * reach;
    // Ear from the eye back to the bridge, clear of the bore.
    const ear = new THREE.Mesh(new THREE.BoxGeometry(2 * eyeHalf, 2 * eyeOuter * 0.8, bridgeZ - (armRadius + 0.012)), material);
    ear.position.set(side * reach, 0, (bridgeZ + armRadius + 0.012) / 2);
    ear.userData.role = `${role}-ear`;
    group.add(eye, ear);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(2 * (reach + eyeHalf), 2 * eyeOuter * 0.8, 0.04), material);
  bridge.position.z = bridgeZ + 0.02;
  bridge.userData.role = `${role}-bridge`;
  const boss = new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius + 0.022, shaftRadius + 0.022, 0.1, 32), material);
  boss.rotation.x = Math.PI / 2;
  boss.position.z = bridgeZ + 0.09;
  boss.userData.role = `${role}-boss`;
  group.add(bridge, boss);
  group.userData.shaftStart = bridgeZ + 0.14;
  return group;
}

// A spider (cross): trunnions along local x and y.
function makeSpider({ reach, armRadius, material, role }) {
  const group = new THREE.Group();
  group.userData.role = role;
  const length = 2 * (reach + 0.02);
  for (const axis of ['x', 'y']) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(armRadius, armRadius, length, 24), material);
    if (axis === 'x') arm.rotation.z = Math.PI / 2;
    arm.userData.role = `${role}-trunnion`;
    group.add(arm);
  }
  const centre = new THREE.Mesh(new THREE.BoxGeometry(armRadius * 3, armRadius * 3, armRadius * 3), material);
  centre.userData.role = `${role}-block`;
  group.add(centre);
  return group;
}

const basis = new THREE.Matrix4();
function orient(object, x, z) {
  const y = z.clone().cross(x).normalize();
  basis.makeBasis(x, y, z);
  object.quaternion.setFromRotationMatrix(basis);
}

export function addMangleUniversalDrive(root, {
  fixedPoint, pinionShaftTop, maxDeviation, wheelRadius, wheelShaftBack, wheelBackZ, pinionShaftRadius = 0.055,
  side = 1, maxAngle = THREE.MathUtils.degToRad(35),
}) {
  const steel = matte(PALETTE.muted, { metalness: 0.25, roughness: 0.5 });
  const dark = matte(PALETTE.ink, { metalness: 0.25, roughness: 0.5 });
  const reach = 0.1, armRadius = 0.022, shaftRadius = 0.066;
  const drive = new THREE.Group();
  drive.userData.role = 'jointed-pinion-drive-shaft-and-frame';
  // Joint spacing that keeps the slip shaft within maxAngle of the axis.
  const span = Math.max(0.75, maxDeviation / Math.tan(maxAngle));
  const inputYoke = makeYoke({ reach, armRadius, shaftRadius, material: steel, role: 'input-shaft-universal-yoke' });
  const slipYokeFixed = makeYoke({ reach, armRadius, shaftRadius: 0.05, material: steel, role: 'slip-shaft-yoke-at-fixed-joint' });
  const slipYokeMoving = makeYoke({ reach, armRadius, shaftRadius: 0.05, material: steel, role: 'slip-shaft-yoke-at-pinion-joint' });
  const pinionYoke = makeYoke({ reach, armRadius, shaftRadius: pinionShaftRadius, material: steel, role: 'pinion-shaft-universal-yoke' });
  const spiderFixed = makeSpider({ reach, armRadius, material: dark, role: 'universal-joint-cross-at-input' });
  const spiderMoving = makeSpider({ reach, armRadius, material: dark, role: 'universal-joint-cross-at-pinion' });
  // The pinion shaft's end sits 0.05 into its yoke's boss.
  const movingZ = pinionShaftTop + pinionYoke.userData.shaftStart - 0.05;
  const J1 = new THREE.Vector3(fixedPoint.x, fixedPoint.y, movingZ + span);
  const J2 = new THREE.Vector3(0, 0, movingZ);
  // Input shaft: from its yoke forward through its bearing.
  const inputStart = J1.z + inputYoke.userData.shaftStart - 0.06, inputEnd = J1.z + 0.62;
  const inputShaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius, shaftRadius, inputEnd - inputStart, 32), steel);
  inputShaft.rotation.x = Math.PI / 2;
  inputShaft.position.set(J1.x, J1.y, (inputStart + inputEnd) / 2);
  inputShaft.userData.role = 'fixed-axis-input-shaft';
  // Telescopic slip shaft: a bored tube on the fixed-end yoke and a rod on
  // the pinion-end yoke sliding in it.
  const tubeOuter = 0.05, tubeBore = 0.036, rodRadius = 0.032;
  const minLength = span, maxLength = Math.hypot(span, maxDeviation);
  const start = slipYokeFixed.userData.shaftStart - 0.06;
  // Each as long as it can be without reaching the other yoke's solid boss
  // (which ends shaftStart from its joint) at the shortest span.
  const bossEnd = slipYokeFixed.userData.shaftStart;
  const tubeLength = minLength - start - bossEnd - 0.02, rodLength = tubeLength;
  if (2 * start + tubeLength + rodLength - maxLength < 0.05) throw new RangeError('Slip shaft too short to telescope');
  const tube = new THREE.Mesh(ring(tubeBore, tubeOuter, start, start + tubeLength, 32), steel);
  tube.userData.role = 'telescopic-slip-shaft-tube';
  slipYokeFixed.add(tube);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(rodRadius, rodRadius, rodLength, 24), steel);
  rod.rotation.x = Math.PI / 2;
  rod.position.z = start + rodLength / 2;
  rod.userData.role = 'telescopic-slip-shaft-rod';
  slipYokeMoving.add(rod);
  drive.add(inputYoke, slipYokeFixed, slipYokeMoving, pinionYoke, spiderFixed, spiderMoving, inputShaft);

  // Frame: a bearing for the input shaft on an arm from a column beside the
  // wheel, and a standard behind the wheel carrying its shaft, each standing
  // on its own foot on the floor below the wheel.
  const mat = supportMaterial();
  const floorY = -wheelRadius - 0.45;
  const bearingZ = [J1.z + 0.3, J1.z + 0.5];
  const columnX = side * (wheelRadius + 0.45);
  const standardZ = wheelShaftBack - 0.03;
  const frame = new THREE.Group();
  frame.userData.role = 'fixed-plain-frame-for-wheel-and-input-shaft';
  frame.add(
    bearingBoss({ x: J1.x, y: J1.y, boreRadius: shaftRadius + 0.004, outerRadius: shaftRadius + 0.07,
      zBack: bearingZ[0], zFront: bearingZ[1], material: mat, role: 'fixed-input-shaft-bearing' }),
    backBar([new THREE.Vector2(columnX, floorY + 0.08), new THREE.Vector2(columnX, J1.y),
      new THREE.Vector2(J1.x + side * (shaftRadius + 0.11), J1.y)],
      { zFront: bearingZ[1], width: 0.1, thickness: 0.2, material: mat, role: 'fixed-input-bearing-column-and-arm' }),
    footPillar({ x: columnX, yTop: floorY + 0.08, yFloor: floorY, z: bearingZ[1] - 0.1, width: 0.1, depth: 0.2,
      footWidth: 0.5, footDepth: 0.5, material: mat, role: 'fixed-input-bearing-column-foot' }),
    footPillar({ x: 0, yTop: floorY + 0.08, yFloor: floorY, z: standardZ - 0.05, width: 0.22, depth: 0.1,
      footWidth: 0.9, footDepth: 0.6, material: mat, role: 'fixed-wheel-standard-foot' }),
    backBar([new THREE.Vector2(0, floorY + 0.08), new THREE.Vector2(0, 0)],
      { zFront: standardZ, width: 0.22, thickness: 0.1, material: mat, role: 'fixed-wheel-shaft-standard' }),
    bearingBoss({ x: 0, y: 0, boreRadius: 0.079, outerRadius: 0.2, zBack: standardZ - 0.1,
      zFront: wheelBackZ - 0.05, material: mat, role: 'fixed-wheel-shaft-rear-bearing' }),
  );
  // Both stand in front of, beside and behind the framed wheel; they are
  // left out of its framing.
  frame.traverse((o) => { if (o.isMesh) { o.userData.fixed = true; o.userData.runsPastCrop = true; o.castShadow = o.receiveShadow = true; } });
  drive.traverse((o) => { if (o.isMesh) { o.userData.runsPastCrop = true; o.castShadow = o.receiveShadow = true; } });
  for (const m of [steel, dark, mat]) m.fog = false;
  root.add(drive, frame);

  const a1 = new THREE.Vector3(), a2 = new THREE.Vector3(), d = new THREE.Vector3(), minusZ = Z.clone().negate();
  const update = (pinionCenter, angle) => {
    J2.set(pinionCenter.x, pinionCenter.y, movingZ);
    d.copy(J1).sub(J2).normalize();
    a1.set(Math.cos(angle), Math.sin(angle), 0);
    a2.copy(d).cross(a1).normalize();
    inputYoke.position.copy(J1); orient(inputYoke, a1, Z);
    spiderFixed.position.copy(J1); orient(spiderFixed, a1, a1.clone().cross(a2).normalize());
    slipYokeFixed.position.copy(J1); orient(slipYokeFixed, a2, d.clone().negate());
    slipYokeMoving.position.copy(J2); orient(slipYokeMoving, a2, d);
    spiderMoving.position.copy(J2); orient(spiderMoving, a1, a1.clone().cross(a2).normalize());
    pinionYoke.position.copy(J2); orient(pinionYoke, a1, minusZ);
    inputShaft.rotation.set(Math.PI / 2, 0, 0);
    inputShaft.rotateOnWorldAxis(Z, angle);
  };
  return { drive, frame, update, J1, J2, span,
    blocks: { inputYoke, slipYokeFixed, slipYokeMoving, pinionYoke, spiderFixed, spiderMoving, inputShaft, tube, rod, frame } };
}
