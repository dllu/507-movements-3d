import * as THREE from 'three';
import profile from '../data/mutilated-bevel-profile.js';
import { PALETTE, matte, markShadows, setSpin } from './primitives.js';
import { bevelToothGeometry } from './bevel-geometry.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';
import { makeMutilatedBevelSplineMotion } from './mutilated-bevel-motion.js';

export function makeMutilatedBevelAlternator() {
  const p = profile.parameters, root = new THREE.Group(), parts = {}, blocks = {};
  const axes = { gearA: new THREE.Vector3(-1, 0, 0), gearB: new THREE.Vector3(1, 0, 0),
    driverC: new THREE.Vector3(0, -1, 0) };
  for (const name of ['gearA', 'gearB', 'driverC']) {
    const isDriver = name === 'driverC', axis = axes[name];
    const teeth = isDriver ? p.driverTeeth : p.outputTeeth;
    const angle = isDriver ? p.driverAngle : p.outputAngle;
    const outerDistance = isDriver ? p.outputRadius : p.driverRadius;
    const faceScale = isDriver ? p.driverInnerScale : p.outputInnerScale;
    const gear = new THREE.Group(), rotor = new THREE.Group();
    gear.name = name;
    gear.add(rotor);
    gear.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    const toothGeometry = bevelToothGeometry({ teeth, innerDistance: outerDistance * faceScale,
      outerDistance, pitchConeAngle: angle, toothHeight: p.toothHeight,
      toothThicknessFactor: p.toothThicknessFactor, flankSegments: 24, tipSegments: 8 });
    // Preserve the analytic conical heel/toe normal across the cap triangulation.
    const positions = toothGeometry.attributes.position, normals = toothGeometry.attributes.normal;
    const outlineLength = positions.count / 6;
    for (let i = 0; i < 2 * outlineLength; i++) {
      const x = positions.getX(i), y = positions.getY(i), radius = Math.hypot(x, y);
      const normal = new THREE.Vector3(Math.tan(angle) * x / radius, Math.tan(angle) * y / radius, 1).normalize();
      if (i < outlineLength) normal.negate();
      normals.setXYZ(i, normal.x, normal.y, normal.z);
    }
    const end = toothGeometry.userData.root, color = isDriver ? PALETTE.driver : PALETTE.driven;
    const z = end.z, r = end.radius;
    const back = [[z + .035, r], [z + .10, r * .84], [z + .14, r * .58], [z + .14, .16]];
    const shaft = isDriver
      ? [[z + .19, .22], [z + .23, .22], [z + .23, .11], [z + .52, .11],
        [z + .52, .22], [z + .56, .22], [z + .61, .16], [z + .98, .15], [z + 1.02, .11], [z + 1.02, 0]]
      : [[z + .18, .10], [z + .18, .075], [z + .52, .075], [z + .55, .05], [z + .55, 0]];
    // Integral body/shaft solids terminate before the common pitch apex.
    const bodyProfile = [[z * faceScale, 0], [z * faceScale, r * faceScale], [z, r], ...back, ...shaft];
    const bodyGeometry = turnedClutchGeometry(bodyProfile, { angularSegments: 192, color });
    const bodyPositions = bodyGeometry.attributes.position, colors = bodyGeometry.attributes.color;
    const shaftColor = new THREE.Color(PALETTE.ink);
    for (let i = 0; i < bodyPositions.count; i++) {
      if (bodyPositions.getZ(i) > z + .145) colors.setXYZ(i, shaftColor.r, shaftColor.g, shaftColor.b);
    }
    const body = new THREE.Mesh(bodyGeometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .17, roughness: .61 }));
    body.name = name + 'Body';
    const toothMeshes = [], installedToothIndices = Array.from({ length: isDriver ? teeth / 2 : teeth }, (_, i) => i);
    rotor.add(body);
    parts[body.name] = body;
    for (const index of installedToothIndices) {
      let geometry = toothGeometry;
      const cut = isDriver && profile.relievedTeeth.find(tooth => tooth.index === index);
      if (cut) {
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(cut.positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(cut.normals, 3));
        geometry.userData = cut.metadata;
      }
      const tooth = new THREE.Mesh(geometry, matte(color, { metalness: .17, roughness: .6 }));
      tooth.name = name + 'Tooth' + index;
      tooth.rotation.z = index * 2 * Math.PI / teeth;
      tooth.userData = { index, bevelTooth: true };
      rotor.add(tooth);
      toothMeshes.push(tooth);
    }
    Object.assign(gear.userData, { rotor, body, toothMeshes, installedToothIndices, teeth,
      pitchConeAngle: angle, axis, profile: bodyProfile, innerDistance: outerDistance * faceScale, outerDistance });
    blocks[name] = gear;
    root.add(gear);
  }
  const motion = makeMutilatedBevelSplineMotion(profile.motion);
  const stateAtTime = time => {
    const coordinate = p.initialCyclePhase + time / p.period;
    const A = motion.atCoordinate(coordinate), B = motion.atCoordinate(coordinate + .5);
    const indexingA = A.derivative > 1e-8, indexingB = B.derivative > 1e-8;
    return { time, coordinate, driverAngle: -2 * Math.PI * coordinate, angleA: A.angle, angleB: B.angle,
      inputAngularSpeed: -2 * Math.PI / p.period,
      angularSpeedA: A.derivative / p.period, angularSpeedB: B.derivative / p.period,
      indexingA, indexingB, dwellA: !indexingA, dwellB: !indexingB,
      stage: indexingA && indexingB ? 'both-outputs-contacting' : indexingA ? 'index-A-dwell-B'
        : indexingB ? 'index-B-dwell-A' : 'unforced-dwell' };
  };
  const update = time => {
    const state = stateAtTime(time);
    setSpin(blocks.driverC, state.driverAngle);
    setSpin(blocks.gearA, state.angleA);
    setSpin(blocks.gearB, state.angleB);
    root.userData.kinematics = state;
  };
  root.userData = { mechanism: 'mutilated-bevel-alternator', fidelity: 'authored', reconstructionStatus: 'rebuilt',
    parts, blocks, geometry: p, profile, motion, stateAtTime, hideGround: true, cameraFov: 8,
    fullCameraDirection: new THREE.Vector3(0, 0, 10), shadowCameraHalfExtent: 2.8, shadowBias: -.00003,
    animationTiming: { authoredCyclePeriod: p.period }, minimumDisplayCycleSeconds: p.period,
    idealConstraints: 'Quasistatic forward tooth contact with ideal bearing friction during unforced dwell. '
      + 'The reconstruction uses 32-tooth outputs and a 40-tooth driver with half its teeth installed. '
      + 'Counts and sector-end relief are reconstructed from the engraving. Inertia and a positive dwell lock are not modeled.' };
  update(0);
  markShadows(root);
  return { root, update, motion, cameraDirection: new THREE.Vector3(0, 0, 10) };
}
