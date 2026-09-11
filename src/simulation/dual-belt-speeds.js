import * as THREE from 'three';
import { dualBeltSpeedsMotion } from './dual-belt-speeds-motion.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';
import { flatBeltGeometry } from './belt-geometry.js';
import { PALETTE, matte, markShadows, beltCurveOpen } from './primitives.js';

export function makeDualBeltSpeeds() {
  const motion = dualBeltSpeedsMotion(), p = motion.parameters;
  const root = new THREE.Group(), driver = new THREE.Group(), output = new THREE.Group();
  const looseLeft = new THREE.Group(), looseRight = new THREE.Group(), parts = {};
  root.add(driver, output, looseLeft, looseRight); driver.position.y = p.driverHeight;
  const add = (name, mesh, parent = root) => { mesh.name = name; parts[name] = mesh; parent.add(mesh); return mesh; };
  const turned = (radius, bore, low, high, color) => new THREE.Mesh(
    turnedClutchGeometry([[low, bore], [low, radius], [high, radius], [high, bore]],
      { boreRadius: bore, angularSegments: 512, color, paintIndex: true }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0.1 }));
  const cylinder = (radius, [low, high]) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, high - low, 512), matte(PALETTE.muted));
    mesh.rotation.x = Math.PI / 2; mesh.position.z = (low + high) / 2; return mesh;
  };
  add('driverShaft', cylinder(p.driverShaftRadius, p.driverShaftSpan), driver);
  for (const [i, name] of ['largeDriver', 'smallDriver'].entries()) {
    add(name, turned(p.driverRadii[i], p.driverShaftRadius, ...p.driverSpans[i], PALETTE.driver), driver);
  }
  add('outputShaft', cylinder(p.outputShaftRadius, p.outputShaftSpan), output);
  for (const [lane, name, parent, loose] of [[0, 'looseLeftPulley', looseLeft, true], [1, 'fixedLeftPulley', output, false],
    [2, 'fixedRightPulley', output, false], [3, 'looseRightPulley', looseRight, true]]) {
    add(name, turned(p.lowerRadius, loose ? p.looseBore : p.outputShaftRadius,
      p.laneZs[lane] - p.pulleyWidths[lane] / 2, p.laneZs[lane] + p.pulleyWidths[lane] / 2,
      loose ? PALETTE.muted : PALETTE.driven), parent);
  }
  const bands = [], segments = 2048, paper = new THREE.Color(0xd9cead), stitch = new THREE.Color(0x8d7b58);
  for (const [i, name] of ['leftBelt', 'rightBelt'].entries()) {
    const curve = beltCurveOpen(new THREE.Vector2(0, p.driverHeight), new THREE.Vector2(), p.driverPitchRadii[i], p.lowerPitchRadius, 0);
    const geometry = flatBeltGeometry(curve, { width: p.beltWidth, thickness: p.beltThickness, segments });
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));
    const mesh = add(name, new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 })));
    mesh.userData = { curve, length: curve.getLength(), crossSection: 'rectangular', width: p.beltWidth, thickness: p.beltThickness, isYarn: true };
    bands.push(mesh);
  }
  const update = time => {
    const state = motion.atTime(time);
    driver.rotation.z = state.driverAngle; output.rotation.z = state.outputAngle;
    looseLeft.rotation.z = state.looseLeftAngle; looseRight.rotation.z = state.looseRightAngle;
    for (const [i, band] of bands.entries()) {
      band.position.z = state.beltZs[i];
      const color = band.geometry.attributes.color;
      for (let j = 0; j < color.count; j += 1) {
        const u = (Math.floor(j / 2) % (segments + 1)) / segments;
        const phase = 12 * (u - state.beltDistances[i] / band.userData.length);
        const mix = Math.max(0, 1 - Math.abs(phase - Math.round(phase)) / 0.025) * 0.55;
        color.setXYZ(j, paper.r + (stitch.r - paper.r) * mix, paper.g + (stitch.g - paper.g) * mix,
          paper.b + (stitch.b - paper.b) * mix);
      }
      color.needsUpdate = true;
    }
    root.userData.kinematics = state;
  };
  root.userData = { geometry: p, parts, blocks: { driver, output, looseLeft, looseRight }, motion,
    hideGround: true, cameraFov: 7, fullCameraDirection: new THREE.Vector3(-8, 3, 6),
    shadowCameraHalfExtent: 5, shadowBias: -0.00003, fidelity: 'authored', mechanism: 'two-permanent-flat-bands-alternating-loose-and-fast-pulleys',
    reconstructionStatus: 'contact-verified-reconstruction',
    animationTiming: { authoredCyclePeriod: p.cycleDuration },
    idealConstraints: 'Fixed parallel shaft bearings and axial retention are idealized. The outer lower pulleys rotate freely on the output shaft; the inner ones are fixed to it. Both bands remain installed. An operator stops the drive before moving both bands laterally. Belt neutral-fiber pitch radii include half the belt thickness; friction, elasticity and inertia are not solved.' };
  update(0); markShadows(root); return { root, update, cameraDirection: new THREE.Vector3(-10, 0, 0) };
}
