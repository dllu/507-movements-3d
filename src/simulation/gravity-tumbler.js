import * as THREE from 'three';
import { makeGravityTumblerMotion } from './gravity-tumbler-motion.js';
import { makeGravityTumblerPlate } from './gravity-tumbler-plate.js';
import profile from '../data/gravity-tumbler-worm-profile.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';
import { cylindricalWormGeometry, wormWheelGeometry } from './worm-gear-geometry.js';
import { PALETTE, matte, markShadows } from './primitives.js';

export function makeGravityTumbler(options = {}) {
  const { wormProfile = profile, wormOffset = -10 / (280 / 1.375), wheelPhase = 0.10864674593664701, pinOuter = 0.55,
    wormShaftLow = -232 / (280 / 1.375), wormShaftHigh = 220 / (280 / 1.375), ...motionOptions } = options;
  const dimensions = JSON.parse(wormProfile.key);
  const plate = makeGravityTumblerPlate();
  const motion = makeGravityTumblerMotion({ plateCentroidX: plate.centroid[0], plateCentroidY: plate.centroid[1],
    plateInertiaPerMass: plate.polarInertiaPerMass, ...motionOptions }), p = { ...motion.parameters,
    wheelTeeth: dimensions.teeth, wheelPitchRadius: dimensions.pitchRadius, wheelDepth: dimensions.depth,
    module: 2 * dimensions.pitchRadius / dimensions.teeth, wormPitchRadius: dimensions.wormPitchRadius,
    wormLength: dimensions.wormLength, wormCenterDistance: dimensions.pitchRadius + dimensions.wormPitchRadius,
    pressureAngle: dimensions.pressureAngle, wormOffset, wheelPhase, wormShaftLow, wormShaftHigh,
    shaftRadius: 0.33, pinInner: 0.325, pinOuter, pinDepth: 0.07, pinZ: 0.855,
    sleeveLowZ: 0.14, sleeveHighZ: 0.77, collarLowZ: 0.77, collarHighZ: 0.94,
    plateLowZ: 0.47, plateHighZ: 0.69, plateBore: 0.425, plateArea: plate.area };
  const root = new THREE.Group(), input = new THREE.Group(), weight = new THREE.Group();
  const wormMount = new THREE.Group(), wormAxis = new THREE.Group(), worm = new THREE.Group();
  root.add(input, weight, wormMount); wormMount.add(wormAxis); wormAxis.add(worm);
  const parts = {}, families = {};
  const add = (name, geometry, color, parent, family) => {
    const mesh = new THREE.Mesh(geometry, matte(color, { metalness: 0.15, roughness: 0.64 }));
    mesh.name = name; parts[name] = mesh; families[name] = family; parent.add(mesh); return mesh;
  };
  const drum = (radius, bore, low, high) => turnedClutchGeometry(
    [[low, bore], [low, radius], [high, radius], [high, bore]], { angularSegments: 512 });
  const wheel = add('wormWheel', wormWheelGeometry({ teeth: p.wheelTeeth, pitchRadius: p.wheelPitchRadius,
    wormPitchRadius: p.wormPitchRadius, wormLength: p.wormLength, depth: p.wheelDepth,
    pressureAngle: p.pressureAngle }, { profile: wormProfile }), PALETTE.driven, input, 'input');
  wheel.rotation.z = -Math.PI / 2 + p.wheelPhase;
  add('rearInputShaft', drum(p.shaftRadius, 0, -0.36, -p.wheelDepth / 2), PALETTE.muted, input, 'input');
  add('frontInputShaft', drum(p.shaftRadius, 0, p.wheelDepth / 2, 1.03), PALETTE.muted, input, 'input');
  const pin = add('drivingPin', new THREE.BoxGeometry(p.pinOuter - p.pinInner, p.pinWidth, p.pinDepth),
    PALETTE.muted, input, 'input');
  const pinAngle = Math.PI / 2 - p.pinOffset;
  pin.position.set((p.pinOuter + p.pinInner) / 2 * Math.cos(pinAngle),
    (p.pinOuter + p.pinInner) / 2 * Math.sin(pinAngle), p.pinZ); pin.rotation.z = pinAngle;
  add('weightSleeve', drum(p.sleeveRadius, p.sleeveBore, p.sleeveLowZ, p.sleeveHighZ), PALETTE.brass, weight, 'weight');
  const half = new THREE.Shape(); half.absarc(0, 0, p.sleeveRadius, Math.PI / 2, 3 * Math.PI / 2, false);
  half.lineTo(0, -p.sleeveBore); half.absarc(0, 0, p.sleeveBore, 3 * Math.PI / 2, Math.PI / 2, true); half.closePath();
  const collar = add('halfCutSleeveEnd', new THREE.ExtrudeGeometry(half, {
    depth: p.collarHighZ - p.collarLowZ, bevelEnabled: false, curveSegments: 256 }), PALETTE.brass, weight, 'weight');
  collar.position.z = p.collarLowZ;
  const tumbler = add('tumblerPlate', plate.geometry, PALETTE.brass, weight, 'weight');
  tumbler.position.z = p.plateLowZ;
  // Brown dots wheel B behind E; E stays opaque and the viewer rotates to see B.
  tumbler.material = matte(PALETTE.brass, { metalness: 0.15, roughness: 0.64 });
  wormMount.rotation.z = Math.PI; wormAxis.position.y = p.wormCenterDistance; wormAxis.rotation.y = Math.PI / 2;
  worm.position.z = -p.wormOffset;
  add('wormThread', cylindricalWormGeometry({ pitchRadius: p.wormPitchRadius, module: p.module,
    length: p.wormLength, pressureAngle: p.pressureAngle, angularSteps: 640 }), PALETTE.driver, worm, 'worm');
  add('wormShaftLeft', drum(0.075, 0, p.wormShaftLow, -p.wormLength / 2), PALETTE.muted, worm, 'worm');
  add('wormShaftRight', drum(0.075, 0, p.wormLength / 2, p.wormShaftHigh), PALETTE.muted, worm, 'worm');
  const update = time => {
    const state = motion.atTime(time); input.rotation.z = state.driverAngle; weight.rotation.z = state.weightAngle;
    worm.rotation.z = -Math.PI / 2 + p.wheelTeeth * (state.driverAngle + p.wheelPhase) - 2 * p.wormOffset / p.module;
    root.userData.kinematics = state;
  };
  root.userData = { geometry: p, parts, families, blocks: { input, weight, wormMount, wormAxis, worm }, motion,
    mechanism: 'worm-driven-scalloped-gravity-tumbler', fidelity: 'authored', reconstructionStatus: 'rebuilt',
    hideGround: true, cameraFov: 8, fullCameraDirection: new THREE.Vector3(-5, 3, 10),
    shadowCameraHalfExtent: 5, shadowBias: -0.00012, shadowNormalBias: 0.005,
    animationTiming: { authoredCyclePeriod: p.cycleDuration }, minimumDisplayCycleSeconds: 24,
    idealConstraints: 'Grounded shaft bearings and constant-speed motor are ideal. Gravity acts on uniform component masses. Explicit viscous bearing resistance dissipates energy. Pin catch is perfectly inelastic. Tooth count and worm proportions are regularized from the engraving.' };
  update(0); markShadows(root);
  tumbler.castShadow = false;
  return { root, update, motion, cameraDirection: new THREE.Vector3(0, 0, 10) };
}
