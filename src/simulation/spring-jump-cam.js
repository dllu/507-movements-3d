import * as THREE from 'three';
import { backBar, bearingBoss, pinBoss, supportMaterial } from './back-plate-support.js';
import { wallGuide } from './wall-guide-hardware.js';
import { makeJumpCamMotion } from './spring-jump-cam-motion.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';
import { cylindricalWormGeometry, wormWheelGeometry } from './worm-gear-geometry.js';
import wormProfile from '../data/spring-jump-worm-profile.js';
import precomputedMotion from '../data/spring-jump-cam-motion.js';
import { PALETTE, matte, markShadows } from './primitives.js';

function leafGeometry(count) {
  const geometry = new THREE.BufferGeometry(), positions = new Float32Array(count * 8 * 3 + 8 * 3), indices = [];
  // Each of four longitudinal skins has its own vertices and normals.
  for (let skin = 0; skin < 4; skin += 1) for (let i = 0; i + 1 < count; i += 1) {
    const a = skin * count * 2 + 2 * i;
    indices.push(a, a + 3, a + 1, a, a + 2, a + 3);
  }
  const first = count * 8;
  indices.push(first, first + 1, first + 2, first, first + 2, first + 3,
    first + 4, first + 5, first + 6, first + 4, first + 6, first + 7);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setIndex(indices);
  return geometry;
}

function updateLeaf(geometry, state, p, z) {
  const path = state.leaf.path.map(point => [...point]);
  for (let i = 1; i <= p.springCurlSegments; i += 1) {
    const a = p.springCurlStart + (p.springCurlEnd - p.springCurlStart) * i / p.springCurlSegments + state.leaf.lambda;
    path.push([state.leaf.centerX + p.springCurlRadius * Math.cos(a), state.leaf.centerY + p.springCurlRadius * Math.sin(a)]);
  }
  const count = path.length, sections = [];
  for (let i = 0; i < count; i += 1) {
    let tx, ty;
    if (i >= p.springSegments) {
      const angle = p.springCurlStart + (p.springCurlEnd - p.springCurlStart) * (i - p.springSegments) / p.springCurlSegments + state.leaf.lambda;
      tx = -Math.sin(angle); ty = Math.cos(angle);
    } else {
      const before = path[Math.max(0, i - 1)], after = path[Math.min(count - 1, i + 1)];
      const length = Math.hypot(after[0] - before[0], after[1] - before[1]);
      tx = (after[0] - before[0]) / length; ty = (after[1] - before[1]) / length;
    }
    const [x, y] = path[i], w = p.springWidth / 2;
    const h = p.springHalfThickness + (i < p.springSegments
      ? p.springHalfThicknessExtra * Math.sin(Math.PI * i / p.springSegments) ** 2 : 0);
    sections.push([[x - ty * h, y + tx * h, z - w], [x + ty * h, y - tx * h, z - w],
      [x + ty * h, y - tx * h, z + w], [x - ty * h, y + tx * h, z + w]]);
  }
  const attr = geometry.attributes.position;
  for (let skin = 0; skin < 4; skin += 1) for (let i = 0; i < count; i += 1) {
    attr.setXYZ(skin * count * 2 + i * 2, ...sections[i][skin]);
    attr.setXYZ(skin * count * 2 + i * 2 + 1, ...sections[i][(skin + 1) % 4]);
  }
  for (let j = 0; j < 4; j += 1) {
    attr.setXYZ(count * 8 + j, ...sections[0][j]);
    attr.setXYZ(count * 8 + 4 + j, ...sections.at(-1)[3 - j]);
  }
  attr.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData.neutralPath = path;
}

export function makeSpringJumpCam(options = {}) {
  const motion = makeJumpCamMotion(Object.keys(options).length ? options : { precomputed: precomputedMotion });
  const p = { ...motion.parameters }, root = new THREE.Group();
  const input = new THREE.Group(), cam = new THREE.Group(), follower = new THREE.Group(), roller = new THREE.Group();
  // This unmarked annular tread has no visible change under axial spin.
  // Keep its physical rolling motion, but measure display speed from the
  // visible follower, cam and worm rather than this symmetric spin.
  roller.userData.rotationallySymmetric = true;
  const wormMount = new THREE.Group(), wormAxis = new THREE.Group(), worm = new THREE.Group();
  root.add(input, cam, follower, wormMount); follower.add(roller); wormMount.add(wormAxis); wormAxis.add(worm);
  const parts = {}, families = {};
  const add = (name, geometry, color, parent, family) => {
    const mesh = new THREE.Mesh(geometry, matte(color, { metalness: 0.15, roughness: 0.64 }));
    mesh.name = name; parts[name] = mesh; families[name] = family; parent.add(mesh); return mesh;
  };
  const drum = (radius, bore, low, high) => turnedClutchGeometry([[low, bore], [low, radius], [high, radius], [high, bore]], { angularSegments: 384 });
  const extrusion = (shape, depth, segments = 192) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: segments });
  Object.assign(p, { wheelTeeth: 24, wheelOuterRadius: 1.375, wormPitchRadius: 0.33,
    wormLength: 1.60, wheelDepth: 0.22, pressureAngle: Math.PI / 9,
    shaftRadius: 0.285, sleeveBore: 0.305, sleeveRadius: 0.425,
    pinWidth: 0.115, pinInner: 0.28, pinOuter: 0.55,
    camZ: 0.47, sleeveLowZ: 0.14, sleeveHighZ: 0.77, collarLowZ: 0.77, collarHighZ: 0.94,
    pinZ: 0.855, followerZ: 0.695, followerDepth: 0.11, rollerLowZ: 0.47, rollerHighZ: 0.65,
    pivotRadius: 0.04, pivotBore: 0.045, rollerPinRadius: 0.095, rollerBore: 0.10 });
  p.wheelPitchRadius = p.wheelOuterRadius / (1 + 2 / p.wheelTeeth); p.module = 2 * p.wheelPitchRadius / p.wheelTeeth;
  p.wormCenterDistance = p.wheelPitchRadius + p.wormPitchRadius;
  p.pinOffset = Math.asin((p.pinWidth / 2 + p.contactClearance) / p.sleeveBore);
  p.availableLead = Math.PI - 2 * p.pinOffset;
  if (p.maximumLead >= p.availableLead - 0.005) throw new Error('Cam motion exceeds finite half-cut freedom');
  const wheelGeometry = wormWheelGeometry({ teeth: p.wheelTeeth, pitchRadius: p.wheelPitchRadius,
    wormPitchRadius: p.wormPitchRadius, wormLength: p.wormLength, depth: p.wheelDepth, pressureAngle: p.pressureAngle }, { profile: wormProfile });
  const wheel = add('wormWheel', wheelGeometry, PALETTE.driven, input, 'input'); wheel.rotation.z = -Math.PI / 2;
  add('rearInputShaft', drum(p.shaftRadius, 0, -0.36, -p.wheelDepth / 2), PALETTE.muted, input, 'input');
  add('frontInputShaft', drum(p.shaftRadius, 0, p.wheelDepth / 2, 1.03), PALETTE.muted, input, 'input');
  const pin = add('drivingPin', new THREE.BoxGeometry(p.pinOuter - p.pinInner, p.pinWidth, 0.07), PALETTE.muted, input, 'input');
  const pinAngle = Math.PI / 2 - p.pinOffset;
  pin.position.set((p.pinOuter + p.pinInner) / 2 * Math.cos(pinAngle), (p.pinOuter + p.pinInner) / 2 * Math.sin(pinAngle), p.pinZ);
  pin.rotation.z = pinAngle;
  const camPlate = add('camPlate', motion.cam.geometry.clone(), PALETTE.brass, cam, 'cam'); camPlate.position.z = p.camZ;
  add('camSleeve', drum(p.sleeveRadius, p.sleeveBore, p.sleeveLowZ, p.sleeveHighZ), PALETTE.brass, cam, 'cam');
  const half = new THREE.Shape(); half.absarc(0, 0, p.sleeveRadius, Math.PI / 2, 3 * Math.PI / 2, false);
  half.lineTo(0, -p.sleeveBore); half.absarc(0, 0, p.sleeveBore, 3 * Math.PI / 2, Math.PI / 2, true); half.closePath();
  const collar = add('halfCutSleeveEnd', extrusion(half, p.collarHighZ - p.collarLowZ, 256), PALETTE.brass, cam, 'cam'); collar.position.z = p.collarLowZ;
  const leverShape = new THREE.Shape(), r = p.followerHalfWidth, length = p.followerLength;
  leverShape.moveTo(0, -r); leverShape.lineTo(length, -r); leverShape.absarc(length, 0, r, -Math.PI / 2, Math.PI / 2, false);
  leverShape.lineTo(0, r); leverShape.absarc(0, 0, r, Math.PI / 2, 3 * Math.PI / 2, false); leverShape.closePath();
  for (const [x, boreRadius] of [[0, p.pivotBore], [length, p.rollerPinRadius]]) {
    const hole = new THREE.Path(); hole.absarc(x, 0, boreRadius, 0, turn, true); leverShape.holes.push(hole);
  }
  const lever = add('followerLever', extrusion(leverShape, p.followerDepth), PALETTE.brass, follower, 'follower'); lever.position.z = p.followerZ;
  follower.position.set(...p.followerPivot, 0); roller.position.x = length;
  const rollerPin = add('rollerPin', drum(p.rollerPinRadius, 0, 0.44, 0.84), PALETTE.muted, follower, 'follower'); rollerPin.position.x = length;
  for (const [name, lo, hi] of [['rearRollerHead', 0.435, 0.455], ['frontRollerHead', 0.81, 0.835]]) {
    const head = add(name, drum(0.135, p.rollerPinRadius, lo, hi), PALETTE.muted, follower, 'follower'); head.position.x = length;
  }
  add('rollerTread', turnedClutchGeometry([[p.rollerLowZ, p.rollerBore], [p.rollerLowZ, p.rollerRadius],
    [p.rollerHighZ, p.rollerRadius], [p.rollerHighZ, p.rollerBore]], { angularSegments: 1536 }), PALETTE.ink, roller, 'roller');
  const pivot = add('followerPivot', drum(p.pivotRadius, 0, 0.64, 0.865), PALETTE.muted, root, 'fixed'); pivot.position.set(...p.followerPivot, 0);
  for (const [name, lo, hi] of [['rearPivotHead', 0.655, 0.685], ['frontPivotHead', 0.815, 0.85]]) {
    const head = add(name, drum(0.06, p.pivotRadius, lo, hi), PALETTE.muted, root, 'fixed'); head.position.set(...p.followerPivot, 0);
  }
  const springGeometry = leafGeometry(p.springSegments + p.springCurlSegments + 1);
  const leaf = add('leafSpring', springGeometry, PALETTE.ink, root, 'spring'); leaf.userData.isYarn = true;
  // A fitted support lies under the fixed prefix of the actual spring strip.
  // Its upper edge follows that strip with clearance; it cannot cut into the
  // bending portion as a broad rectangular block would.
  const initialState = motion.atTime(0); updateLeaf(springGeometry, initialState, p, p.followerZ + p.followerDepth / 2);
  const neutral = springGeometry.userData.neutralPath, clampTop = []; let clampLength = 0;
  for (let i = 0; i < p.springSegments; i += 1) {
    if (i) clampLength += Math.hypot(neutral[i][0] - neutral[i - 1][0], neutral[i][1] - neutral[i - 1][1]);
    if (clampLength > p.springFixedLength - 0.05) break;
    const j = i * 2 + 1, attr = springGeometry.attributes.position;
    clampTop.push(new THREE.Vector2(attr.getX(j), attr.getY(j) - p.contactClearance));
  }
  const clampShape = new THREE.Shape(clampTop); clampShape.lineTo(clampTop.at(-1).x, 2.67); clampShape.lineTo(clampTop[0].x, 2.67); clampShape.closePath();
  // Brown hatches the clamp as fixed framing but draws no frame for the
  // other fixed parts. The clamp block runs back to a plain back bar behind
  // the mechanism that carries the follower's fulcrum boss, the wheel
  // shaft's bearing and the worm shaft's two bearings. The bar runs behind
  // the lever and the wheel, so it is hidden in the plate's view.
  const supportFront = -0.5;
  const clampFront = p.followerZ + p.followerDepth / 2 + 0.12;
  const clamp = add('springClamp', extrusion(clampShape, clampFront - supportFront), PALETTE.muted, root, 'fixed');
  clamp.position.z = supportFront;
  const [pivotX, pivotY] = p.followerPivot, wormY = -p.wormCenterDistance, bearingX = 1.275;
  const supports = new THREE.Group(); supports.name = 'backBarSupports';
  const clampX = (clampTop[0].x + clampTop.at(-1).x) / 2;
  supports.add(backBar([{ x: clampX, y: 2.8 }, { x: pivotX, y: pivotY }, { x: 0, y: pivotY }, { x: 0, y: wormY }],
    { zFront: supportFront, width: 0.2, role: 'back-bar' }));
  supports.add(backBar([{ x: -bearingX, y: wormY }, { x: bearingX, y: wormY }], { zFront: supportFront, width: 0.3, role: 'worm-bearing-bar' }));
  supports.add(pinBoss({ x: pivotX, y: pivotY, radius: 0.06, zBack: supportFront, zFront: 0.655, role: 'fulcrum-boss' }));
  supports.add(bearingBoss({ x: 0, y: 0, boreRadius: p.shaftRadius + 0.004, outerRadius: 0.44, zBack: supportFront,
    zFront: -0.14, role: 'wheel-shaft-bearing' }));
  for (const side of [-1, 1]) {
    const [boss, web] = wallGuide({ name: 'wormShaftBearing', axis: 'x', halfLength: 0.1, boreRadius: 0.079,
      outerRadius: 0.17, zWall: supportFront, material: supportMaterial() });
    const bearing = new THREE.Group(); bearing.add(boss, web); bearing.position.set(side * bearingX, wormY, 0);
    supports.add(bearing);
  }
  root.add(supports);
  wormMount.rotation.z = Math.PI; wormAxis.position.y = p.wormCenterDistance; wormAxis.rotation.y = Math.PI / 2;
  add('wormThread', cylindricalWormGeometry({ pitchRadius: p.wormPitchRadius, module: p.module,
    length: p.wormLength, pressureAngle: p.pressureAngle, angularSteps: 640 }), PALETTE.driver, worm, 'worm');
  add('wormShaftLeft', drum(0.075, 0, -1.375, -p.wormLength / 2), PALETTE.muted, worm, 'worm');
  add('wormShaftRight', drum(0.075, 0, p.wormLength / 2, 1.375), PALETTE.muted, worm, 'worm');
  const update = time => {
    const state = motion.atTime(time);
    input.rotation.z = state.driverAngle; cam.rotation.z = state.camAngle;
    follower.rotation.z = state.followerAngle;
    // The integrated no-slip angle is absolute; the roller inherits the
    // follower rotation, which must be removed from its local transform.
    roller.rotation.z = state.rollerAngle - state.followerAngle;
    worm.rotation.z = -Math.PI / 2 + p.wheelTeeth * state.driverAngle;
    updateLeaf(springGeometry, state, p, p.followerZ + p.followerDepth / 2);
    root.userData.kinematics = state;
  };
  root.userData = { geometry: p, parts, families, blocks: { input, cam, follower, roller, wormMount, wormAxis, worm }, motion,
    mechanism: 'worm-driven-spring-cam-with-half-cut-sleeve', fidelity: 'authored', reconstructionStatus: 'rebuilt',
    hideGround: true, cameraFov: 7, fullCameraDirection: new THREE.Vector3(-6, 3, 10),
    shadowCameraHalfExtent: 4.7, shadowBias: -0.00012, shadowNormalBias: 0.005,
    animationTiming: { authoredCyclePeriod: p.cycleDuration },
    idealConstraints: 'Grounded shaft bearings are ideal. The follower and roller are massless; the cam has inertia and viscous bearing resistance. A constant-length bending mode represents the leaf spring. Catch is an ideal inelastic impact.' };
  update(0); markShadows(root);
  return { root, update, cameraDirection: new THREE.Vector3(0, 0, 10) };
}

const turn = 2 * Math.PI;
