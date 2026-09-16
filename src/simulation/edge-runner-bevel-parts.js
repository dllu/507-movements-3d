import * as THREE from 'three';
import { bevelToothGeometry, bevelBodyGeometry } from './bevel-geometry.js';

// Keep the source's common apex and 36:12 pitch constraint, replacing the old
// eight-corner teeth with the shared back-cone involute approximation.
export function correctEdgeRunnerBevels(root) {
  const d = root.userData, b = d.blocks, g = d.geometry;
  const pinionPhase = -Math.PI / 2 - g.inputStartAngle
    + g.largeGearTeeth / g.inputPinionTeeth * g.carrierStartAngle
    - Math.PI / g.inputPinionTeeth;
  for (const [gear, phase] of [[b.largeBevelGear, 0], [b.inputPinion, pinionPhase]]) {
    const u = gear.userData;
    const tooth = bevelToothGeometry({
      teeth: u.teeth, innerDistance: u.innerDistance, outerDistance: u.outerDistance,
      pitchConeAngle: u.pitchConeAngle, toothHeight: u.toothHeight,
      toothThicknessFactor: .96, flankSegments: 20, tipSegments: 8,
    });
    u.body.geometry.dispose(); u.body.geometry = bevelBodyGeometry(tooth, u.boreRadius);
    for (const [index, mesh] of u.toothMeshes.entries()) {
      mesh.geometry.dispose(); mesh.geometry = tooth;
      mesh.rotation.z = index * 2 * Math.PI / u.teeth + phase;
      mesh.material.side = THREE.FrontSide;
      mesh.userData.role = 'closed-back-cone-involute-bevel-tooth';
    }
    u.faceRing.position.z = tooth.userData.root.z + .018;
    u.faceIndex.position.z = tooth.userData.root.z + .034;
    u.toothProfile = tooth.userData.profile; u.toothPhase = phase;
  }
  d.workingPartsReview.qualification = 'Runner centerline rolling and the 36:12 bevel ratio are analytical. Teeth use the shared back-cone involute approximation with conical ends and surface normals. Finite-width runners scrub across the annular track; tooth loading and grinding forces remain unqualified.';
}
