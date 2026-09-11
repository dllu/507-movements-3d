import * as THREE from 'three';
import defaultProfile from '../data/single-tooth-index-profile.js';
import { makeSingleToothIndexMotion } from './single-tooth-index-motion.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';
import { PALETTE, matte, markShadows } from './primitives.js';

export function makeSingleToothIndex({ profile = defaultProfile } = {}) {
  const motion = makeSingleToothIndexMotion(profile), p = motion.parameters;
  const root = new THREE.Group(), input = new THREE.Group(), output = new THREE.Group();
  root.add(input, output); input.position.x = -p.centerDistance / 2; output.position.x = p.centerDistance / 2;
  const parts = {}, families = {};
  const add = (name, geometry, parent, color) => {
    const mesh = new THREE.Mesh(geometry, matte(color, { metalness: 0.15, roughness: 0.64 }));
    mesh.name = name; parts[name] = mesh; families[name] = parent === input ? 'input' : 'output';
    parent.add(mesh); return mesh;
  };
  const plate = polygon => {
    const shape = new THREE.Shape(polygon[0].map(q => new THREE.Vector2(...q)));
    for (const ring of polygon.slice(1)) shape.holes.push(new THREE.Path(ring.map(q => new THREE.Vector2(...q))));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: p.depth, bevelEnabled: false });
    geometry.translate(0, 0, -p.depth / 2); return geometry;
  };
  const drum = (radius, low, high) => turnedClutchGeometry(
    [[low, 0], [low, radius], [high, radius], [high, 0]], { angularSegments: 256 });
  add('driverPlate', plate(profile.driver), input, PALETTE.driver);
  add('notchedPlate', plate(profile.output), output, PALETTE.driven);
  for (const [family, group] of [['driver', input], ['output', output]]) {
    add(`${family}FrontHub`, drum(0.29, p.depth / 2, p.depth / 2 + 0.07), group, PALETTE.brass);
    add(`${family}Shaft`, drum(0.185, -0.28, 0.28), group, PALETTE.muted);
  }
  const update = time => {
    const state = motion.atTime(time); input.rotation.z = state.inputAngle; output.rotation.z = state.outputAngle;
    root.userData.kinematics = state;
  };
  root.userData = { geometry: p, parts, families, blocks: { input, output }, motion, profile,
    mechanism: 'single-tooth-self-locking-index', fidelity: 'authored', reconstructionStatus: 'rebuilt',
    hideGround: true, cameraFov: 8, fullCameraDirection: new THREE.Vector3(-4, 3, 10),
    shadowCameraHalfExtent: 5, shadowBias: -0.00012, shadowNormalBias: 0.005,
    animationTiming: { authoredCyclePeriod: p.period }, minimumDisplayCycleSeconds: 4,
    idealConstraints: 'Fixed bearings and uniform input rotation are ideal. The wheel follows its finite contact surfaces under a resisting load; bearing resistance and engagement impacts are idealized. Ten notches and hidden thicknesses are regularized from the engraving.' };
  update(0); markShadows(root);
  return { root, update, motion, cameraDirection: new THREE.Vector3(0, 0, 10) };
}
