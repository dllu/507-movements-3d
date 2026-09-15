import * as THREE from 'three';
import { bevelToothGeometry, bevelBodyGeometry } from '../bevel-geometry.js';
import { PALETTE, matte, markShadows } from '../primitives.js';
import { disposeObject3D } from '../dispose-model.js';

// Inferred counts fit the visible annulus and pinion width. The engraving is
// not a manufacturing drawing; this remains an unregistered source-fit candidate.
export function makeGovernorBevelPair() {
  const inputTeeth = 36, outputTeeth = 30, outerRadius = 34.5 * .018;
  const angle = Math.atan2(inputTeeth, outputTeeth);
  // Outer addendum projects radially by .45 * 2.25 * module * cos(angle).
  const module = outerRadius / (inputTeeth / 2 + 1.0125 * Math.cos(angle));
  const inputRadius = module * inputTeeth / 2, outputRadius = module * outputTeeth / 2;
  const root = new THREE.Group(), parts = {}, blocks = {};
  const parameters = {
    inputTeeth, outputTeeth, module, inputRadius, outputRadius, outerRadius,
    inputInnerScale: .72, outputInnerScale: .66, toothThicknessFactor: .94,
    meshPhaseOffset: .0062, apex: [0, 2.8 + (145 - 43) * .018, 0],
  };
  const specifications = [
    ['input', inputTeeth, inputRadius, outputRadius, new THREE.Vector3(0, 0, -1), PALETTE.driver],
    ['output', outputTeeth, outputRadius, inputRadius, new THREE.Vector3(0, -1, 0), PALETTE.brass],
  ];
  for (const [name, teeth, radius, distance, axis, color] of specifications) {
    const gear = new THREE.Group(), rotor = new THREE.Group();
    gear.position.set(...parameters.apex);
    gear.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis);
    gear.add(rotor);
    root.add(gear);
    blocks[name] = rotor;
    const geometry = bevelToothGeometry({
      teeth, innerDistance: parameters[name + 'InnerScale'] * distance,
      outerDistance: distance, pitchConeAngle: Math.atan2(radius, distance),
      toothHeight: 2.25 * module, toothThicknessFactor: parameters.toothThicknessFactor,
      flankSegments: 24, tipSegments: 8,
    });
    const material = matte(color, { roughness: .62, metalness: .12 });
    material.fog = false;
    const body = new THREE.Mesh(bevelBodyGeometry(geometry, .11), material);
    body.name = name + 'Body';
    parts[body.name] = body;
    rotor.add(body);
    for (let i = 0; i < teeth; i += 1) {
      const tooth = new THREE.Mesh(geometry, material);
      tooth.rotation.z = 2 * Math.PI * i / teeth;
      tooth.name = name + 'Tooth' + i;
      parts[tooth.name] = tooth;
      rotor.add(tooth);
    }
  }
  const update = (spindleAngle) => {
    // Opposing local rotations give equal pitch velocities at the common apex.
    // The small phase offset seats the working flanks of the approximate teeth.
    blocks.input.rotation.z = -Math.PI / 2 + spindleAngle * outputTeeth / inputTeeth;
    blocks.output.rotation.z = -Math.PI / 2 - Math.PI / outputTeeth - spindleAngle
      + parameters.meshPhaseOffset;
    root.updateMatrixWorld(true);
  };
  Object.assign(root.userData, { parts, blocks, parameters, hideGround: true });
  update(0);
  markShadows(root);
  return { root, update, dispose: () => disposeObject3D(root) };
}
