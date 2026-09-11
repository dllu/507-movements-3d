import * as THREE from 'three';
import { roundedRackGear } from './coaxial-gear-geometry.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';
import { makeInvoluteInternalGear, PALETTE, matte, markShadows } from './primitives.js';

export function makeCoaxialDifferentSpeeds({ gearALoadPhase = 0.000928, gearCLoadPhase = -0.000417,
  pressureAngle = 25 * Math.PI / 180, internalAddendum = 0.08, internalDedendum = 0.105 } = {}) {
  const root = new THREE.Group(), p = { module: 0.1, gearATeeth: 17, pinionTeeth: 10, gearCTeeth: 37,
    inputSpeed: Math.PI, gearDepth: 0.18, pinionDepth: 0.18, ringDepth: 0.22, ringZ: -0.02,
    outerRadius: 2.075, outputShaftRadius: 0.26, pinionShaftRadius: 0.13, backplateFront: -0.13,
    pressureAngle, internalAddendum, internalDedendum, gearALoadPhase, gearCLoadPhase, frameAngle: Math.atan2(16.5, 227.5) };
  root.rotation.z = p.frameAngle;
  p.centerDistance = p.module * (p.gearATeeth + p.pinionTeeth) / 2;
  p.gearAPhase = Math.PI / 2 + gearALoadPhase; p.pinionPhase = -Math.PI / 20; p.gearCPhase = p.pinionTeeth * p.pinionPhase / p.gearCTeeth + gearCLoadPhase;
  const rotor = () => { const group = new THREE.Group(), member = new THREE.Group(); group.add(member); group.userData.rotor = member; root.add(group); return group; };
  const gearA = rotor(), pinionB = rotor(); pinionB.position.x = -p.centerDistance;
  const gearAMesh = new THREE.Mesh(roundedRackGear({ teeth: p.gearATeeth, module: p.module, depth: p.gearDepth, boreRadius: p.outputShaftRadius, pressureAngle }), matte(PALETTE.driven));
  const pinionMesh = new THREE.Mesh(roundedRackGear({ teeth: p.pinionTeeth, module: p.module, depth: p.pinionDepth, boreRadius: p.pinionShaftRadius, pressureAngle }), matte(PALETTE.driver));
  gearA.userData.rotor.add(gearAMesh); pinionB.userData.rotor.add(pinionMesh);
  const gearC = makeInvoluteInternalGear({ teeth: p.gearCTeeth, module: p.module, pitchRadius: p.gearCTeeth * p.module / 2,
    outerRadius: p.outerRadius, depth: p.ringDepth, color: PALETTE.accent, chamfer: 0, backlash: 0.0008,
    pressureAngle, addendum: internalAddendum, dedendum: internalDedendum, flankSamples: 64, tipSamples: 8, rootGapSamples: 8 });
  const ringMesh = gearC.userData.rotor.children[0];
  gearC.position.z = p.ringZ; root.add(gearC);
  const turned = (profile, boreRadius, color) => new THREE.Mesh(turnedClutchGeometry(profile, { boreRadius, angularSegments: 192, color }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.16 }));
  const backplate = turned([[-0.23 - p.ringZ, 0.263], [-0.23 - p.ringZ, p.outerRadius],
    [p.backplateFront - p.ringZ, p.outerRadius], [p.backplateFront - p.ringZ, 0.263]], 0.263, PALETTE.accent);
  const facePaint = new THREE.Color(PALETTE.paper).lerp(new THREE.Color(PALETTE.accent), 0.12);
  const webNormals = backplate.geometry.attributes.normal, webColors = backplate.geometry.attributes.color;
  for (let i = 0; i < webColors.count; i += 1) if (webNormals.getZ(i) > 0.99) webColors.setXYZ(i, facePaint.r, facePaint.g, facePaint.b);
  const sleeve = turned([[-0.56 - p.ringZ, 0.267], [-0.56 - p.ringZ, 0.35], [-0.18 - p.ringZ, 0.35], [-0.18 - p.ringZ, 0.267]], 0.267, PALETTE.brass);
  gearC.userData.rotor.add(backplate, sleeve);
  const shaft = (radius, low, high) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, high - low, 128), matte(PALETTE.ink));
    mesh.rotation.x = Math.PI / 2; mesh.position.z = (low + high) / 2; return mesh;
  };
  const outputShaft = shaft(p.outputShaftRadius, -0.65, 0.125), pinionShaft = shaft(p.pinionShaftRadius, -0.09, 0.125);
  gearA.userData.rotor.add(outputShaft); pinionB.userData.rotor.add(pinionShaft);
  gearA.userData.role = 'coaxial-external-gear-A'; pinionB.userData.role = 'fixed-axis-double-mesh-pinion-B';
  gearC.userData.role = 'coaxial-internal-gear-C';
  for (const [part, teeth] of [[gearA, p.gearATeeth], [pinionB, p.pinionTeeth]]) {
    Object.assign(part.userData, { teeth, module: p.module, pitchRadius: teeth * p.module / 2,
      pressureAngle, axis: new THREE.Vector3(0, 0, 1), toothProfile: 'rounded-rack-generated-involute' });
  }
  for (const [name, mesh] of Object.entries({ gearAMesh, pinionMesh, ringMesh, backplate, sleeve, outputShaft, pinionShaft })) mesh.name = name;
  const update = time => {
    const inputAngle = p.pinionPhase + p.inputSpeed * time;
    pinionB.userData.rotor.rotation.z = inputAngle;
    gearA.userData.rotor.rotation.z = p.gearAPhase - p.inputSpeed * p.pinionTeeth / p.gearATeeth * time;
    gearC.userData.rotor.rotation.z = p.gearCPhase + p.inputSpeed * p.pinionTeeth / p.gearCTeeth * time;
    root.userData.kinematics = { pinionAngle: inputAngle, gearAAngle: gearA.userData.rotor.rotation.z,
      gearCAngle: gearC.userData.rotor.rotation.z, pinionAngularSpeed: p.inputSpeed, gearAAngularSpeed: -p.inputSpeed * p.pinionTeeth / p.gearATeeth,
      gearCAngularSpeed: p.inputSpeed * p.pinionTeeth / p.gearCTeeth };
  };
  root.userData = { fidelity: 'authored', mechanism: 'fixed-pinion-external-and-internal-coaxial-dual-mesh',
    geometry: p, parts: { gearAMesh, pinionMesh, ringMesh, backplate, sleeve, outputShaft, pinionShaft },
    blocks: { gearA, pinionB, gearC }, hideGround: true, cameraFov: 17, reconstructionStatus: 'contact-verified-reconstruction',
    shadowCameraHalfExtent: 2.3, shadowBias: -0.00003,
    idealConstraints: 'Three fixed parallel bearing axes, with independent concentric shaft A and sleeve C. Bearings beyond the displayed shaft ends are idealized.',
    animationTiming: { authoredCyclePeriod: 2 }, fullCameraDirection: new THREE.Vector3(4, 3, 8) };
  update(0); markShadows(root); return { root, update, cameraDirection: new THREE.Vector3(0, 0, 10) };
}
