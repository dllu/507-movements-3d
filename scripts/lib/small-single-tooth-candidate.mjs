import * as THREE from 'three';
import defaultProfile from './small-single-tooth-lock-event-profile.mjs';
import { makeSmallSingleToothMotion } from './small-single-tooth-motion.mjs';
import { turnedClutchGeometry } from '../../src/simulation/clutch-section-geometry.js';
import { PALETTE, matte, markShadows } from '../../src/simulation/primitives.js';

export function makeSmallSingleToothCandidate({ profile = defaultProfile } = {}) {
  const motion = makeSmallSingleToothMotion(profile), p = motion.parameters;
  const root = new THREE.Group(), input = new THREE.Group(), output = new THREE.Group();
  root.add(input, output); root.rotation.z = p.assemblyAngle;
  input.position.x = p.centerDistance / 2; output.position.x = -p.centerDistance / 2;
  const parts = {}, families = {};
  const add = (name, geometry, parent, color) => {
    const mesh = new THREE.Mesh(geometry, matte(color, { metalness: 0.15, roughness: 0.64 }));
    mesh.name = name; parent.add(mesh); parts[name] = mesh; families[name] = parent === input ? 'input' : 'output';
  };
  const plate = polygon => {
    const ring = polygon[0], outline = ring.filter((b, i) => {
      const a = ring[(i + ring.length - 1) % ring.length], c = ring[(i + 1) % ring.length];
      const ab = [b[0] - a[0], b[1] - a[1]], bc = [c[0] - b[0], c[1] - b[1]];
      const cross = ab[0] * bc[1] - ab[1] * bc[0];
      return Math.abs(cross) > 1e-10 * Math.hypot(c[0] - a[0], c[1] - a[1])
        || ab[0] * bc[0] + ab[1] * bc[1] < 0;
    });
    const shape = new THREE.Shape(outline.map(point => new THREE.Vector2(...point)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: p.depth, bevelEnabled: false });
    geometry.userData.profileVertices = { source: ring.length, rendered: outline.length, straightEdgeTolerance: 1e-10 };
    geometry.translate(0, 0, -p.depth / 2); return geometry;
  };
  const drum = (radius, low, high) => turnedClutchGeometry([[low,0],[low,radius],[high,radius],[high,0]], { angularSegments: 256 });
  add('driverPlate', plate(profile.driver), input, PALETTE.driver);
  add('wheelPlate', plate(profile.output), output, PALETTE.driven);
  for (const [name, group, hub, shaft] of [['driver',input,.23,.195],['output',output,.49,.29]]) {
    add(name + 'FrontHub', drum(hub, p.depth / 2, p.depth / 2 + .06), group, PALETTE.brass);
    add(name + 'Shaft', drum(shaft, -.28, .28), group, PALETTE.muted);
  }
  const update = time => {
    const state = motion.atTime(time); input.rotation.z = state.inputAngle; output.rotation.z = state.outputAngle;
    root.userData.kinematics = state;
  };
  root.userData = { parts, families, blocks: { input, output }, geometry: p, profile, motion,
    mechanism: 'small-single-tooth-locking-drive', fidelity: 'authored', reconstructionStatus: 'candidate',
    hideGround: true, cameraFov: 8, fullCameraDirection: new THREE.Vector3(-4, 3, 10),
    shadowCameraHalfExtent: 6, shadowBias: -.00012, shadowNormalBias: .005,
    animationTiming: { authoredCyclePeriod: p.period }, minimumDisplayCycleSeconds: 3,
    idealConstraints: 'Isolated quasistatic candidate with passive bearing resistance and ideal fixed bearings. Finite contact, load directions, impacts and source fidelity remain under review.' };
  update(0); markShadows(root);
  return { root, update, motion, cameraDirection: new THREE.Vector3(0, 0, 10) };
}
