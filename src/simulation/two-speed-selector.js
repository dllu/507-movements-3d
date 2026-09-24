import * as THREE from 'three';
import { twoSpeedSelectorMotion } from './two-speed-selector-motion.js';
import { selectorGearGeometry } from './two-speed-selector-geometry.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';
import { flatBeltGeometry } from './belt-geometry.js';
import { PALETTE, matte, markShadows, beltCurveOpen } from './primitives.js';

export function makeTwoSpeedSelector() {
  const motion = twoSpeedSelectorMotion(), p = motion.parameters;
  const root = new THREE.Group(), driver = new THREE.Group(), output = new THREE.Group(), loose = new THREE.Group();
  const inputs = p.inputTeeth.map(() => new THREE.Group()), parts = {};
  root.add(driver, output, loose, ...inputs); driver.position.y = p.driverHeight; output.position.y = -p.centerDistance;
  const add = (name, mesh, parent = root) => { mesh.name = name; parts[name] = mesh; parent.add(mesh); return mesh; };
  const turned = (radius, bore, low, high, color, paintIndex = false) => new THREE.Mesh(
    turnedClutchGeometry([[low, bore], [low, radius], [high, radius], [high, bore]],
      { boreRadius: bore, angularSegments: 512, color, paintIndex }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0.1 }));
  const cylinder = (radius, low, high, color) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, high - low, 512), matte(color));
    mesh.rotation.x = Math.PI / 2; mesh.position.z = (low + high) / 2; return mesh;
  };
  add('driverDrum', turned(p.pulleyRadius, 0.1325, -0.80, 0.925, PALETTE.driver), driver);
  add('driverShaft', cylinder(0.1325, -1.395, 1.625, PALETTE.muted), driver);
  add('loosePulley', turned(p.pulleyRadius, 0.1485, p.laneZs[0] - p.pulleyWidth / 2,
    p.laneZs[0] + p.pulleyWidth / 2, PALETTE.muted), loose);
  const colors = [PALETTE.brass, PALETTE.accent];
  for (let i = 0; i < p.inputTeeth.length; i += 1) {
    const low = i === 0 ? -1.925 : p.laneZs[i + 1] - p.pulleyWidth / 2;
    const high = i === 0 ? 1.975 : p.gearZs[i] + p.gearDepths[i] / 2;
    add(`inputShaft${i}`, i === 0 ? cylinder(p.shaftRadii[i], low, high, PALETTE.muted)
      : turned(p.shaftRadii[i], p.sleeveBores[i], low, high, PALETTE.muted), inputs[i]);
    add(`inputPulley${i}`, turned(p.pulleyRadius, p.shaftRadii[i], p.laneZs[i + 1] - p.pulleyWidth / 2,
      p.laneZs[i + 1] + p.pulleyWidth / 2, colors[i]), inputs[i]);
    const gear = (name, teeth, bore, color, parent, phase) => {
      const mesh = add(name, new THREE.Mesh(selectorGearGeometry({ teeth, module: p.module,
        depth: p.gearDepths[i], boreRadius: bore, backlash: p.toothBacklash, pressureAngle: p.pressureAngle }), matte(color)), parent);
      mesh.position.z = p.gearZs[i]; mesh.rotation.z = phase;
    };
    gear(`inputGear${i}`, p.inputTeeth[i], p.shaftRadii[i], colors[i], inputs[i], p.inputPhases[i]);
    gear(`outputGear${i}`, p.outputTeeth[i], p.outputShaftRadius, PALETTE.driven, output, p.outputPhases[i]);
  }
  add('outputShaft', cylinder(p.outputShaftRadius, -1.925, 1.975, PALETTE.muted), output);
  const curve = beltCurveOpen(new THREE.Vector2(0, p.driverHeight), new THREE.Vector2(), p.beltPitchRadius, p.beltPitchRadius, 0);
  const segments = 2048, length = curve.getLength();
  const beltGeometry = flatBeltGeometry(curve, { width: p.beltWidth, thickness: p.beltThickness, segments });
  // Brown draws the band plain: one paper colour, no travelling stitch marks.
  const paper = new THREE.Color(0xd9cead), colorsBuffer = new Float32Array(beltGeometry.attributes.position.count * 3);
  for (let i = 0; i < colorsBuffer.length; i += 3) paper.toArray(colorsBuffer, i);
  beltGeometry.setAttribute('color', new THREE.BufferAttribute(colorsBuffer, 3));
  const belt = add('belt', new THREE.Mesh(beltGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 })));
  belt.userData = { curve, length, crossSection: 'rectangular', width: p.beltWidth, thickness: p.beltThickness, isYarn: true };
  const update = time => {
    const state = motion.atTime(time); driver.rotation.z = state.driverAngle; output.rotation.z = state.outputAngle;
    loose.rotation.z = state.looseAngle; inputs.forEach((group, i) => { group.rotation.z = state.inputAngles[i]; });
    belt.position.z = state.beltZ;
    root.userData.kinematics = state;
  };
  root.userData = { geometry: p, parts, blocks: { driver, output, loose, inputs }, motion,
    hideGround: true, cameraFov: 7, fullCameraDirection: new THREE.Vector3(-8, 3, 6),
    shadowCameraHalfExtent: 5, shadowBias: -0.00003, fidelity: 'authored', mechanism: 'flat-band-two-speed-nested-shaft-selector', reconstructionStatus: 'contact-verified-reconstruction',
    animationTiming: { authoredCyclePeriod: p.cycleDuration },
    idealConstraints: 'Fixed parallel bearing axes; a loose pulley on the main shaft; one independently rotating concentric sleeve. An operator shifts the belt while all shafts are stopped. Bearing mounts, axial retention, load inertia and friction are idealized.' };
  update(0); markShadows(root); return { root, update, cameraDirection: new THREE.Vector3(-10, 0, 0) };
}
