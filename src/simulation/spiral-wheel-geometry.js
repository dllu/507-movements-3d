import * as THREE from 'three';
import { spiralCut } from '../data/contact-profiles.js';

const cache = new Map();

/** Cut a driven wheel with the swept, round, single-start face thread.
 * Its transverse sections vary across the wheel width: an ordinary extruded
 * involute cannot be conjugate to this round spiral at every axial station.
 */
export function spiralWheelGeometry({
  teeth, outerRadius, depth, centerX, centerZ,
  threadZ, ridgeRadius, startRadius, lead, startAngle, gearPhase,
}, { regenerate = false } = {}) {
  const key = JSON.stringify({ teeth, outerRadius, depth, centerX, centerZ,
    threadZ, ridgeRadius, startRadius, lead, startAngle, gearPhase });
  if (!regenerate && cache.has(key)) return cache.get(key).clone();
  const axialSteps = 16;
  const angularSteps = 128;
  const phaseSteps = 1440;
  const threadSteps = 96;
  const clearance = 0.0005;
  const pitch = 2 * Math.PI / teeth;
  const baked = !regenerate && spiralCut?.key === key ? spiralCut.radii : null;
  const radii = baked ? Float64Array.from(baked) : new Float64Array((axialSteps + 1) * (angularSteps + 1)).fill(outerRadius);
  if (!baked) {
    const betaLimit = Math.asin((depth / 2 + ridgeRadius) / startRadius);
    for (let phase = 0; phase <= phaseSteps; phase += 1) {
      const diskAngle = 2 * Math.PI * phase / phaseSteps;
      const gearAngle = gearPhase + diskAngle / teeth;
      const samples = [];
      for (let step = 0; step <= threadSteps; step += 1) {
        const beta = -betaLimit + 2 * betaLimit * step / threadSteps;
        const progress = THREE.MathUtils.euclideanModulo(beta - diskAngle - startAngle, 2 * Math.PI) / (2 * Math.PI);
        const radius = startRadius + lead * progress;
        samples.push({ x: radius * Math.cos(beta), y: radius * Math.sin(beta) });
      }
      // Include both open thread ends at the handoff, even when the regular
      // angular samples fall on only one side of the spiral's radial step.
      for (const radius of [startRadius, startRadius + lead]) {
        samples.push({ x: radius * Math.cos(startAngle + diskAngle), y: radius * Math.sin(startAngle + diskAngle) });
      }
      for (const point of samples) {
        const x = point.x - centerX;
        const y = centerZ - threadZ;
        const distance = Math.hypot(x, y);
        if (distance - ridgeRadius > outerRadius) continue;
        const angle = THREE.MathUtils.euclideanModulo(Math.atan2(y, x) - gearAngle + pitch / 2, pitch) - pitch / 2;
        for (let axial = 0; axial <= axialSteps; axial += 1) {
          const offset = point.y - (-depth / 2 + depth * axial / axialSteps);
          const squaredSectionRadius = ridgeRadius ** 2 - offset ** 2;
          if (squaredSectionRadius <= 0) continue;
          for (let angular = 0; angular <= angularSteps; angular += 1) {
            const theta = -pitch / 2 + pitch * angular / angularSteps;
            const difference = THREE.MathUtils.euclideanModulo(theta - angle + pitch / 2, pitch) - pitch / 2;
            const transverse = distance * Math.sin(difference);
            const discriminant = squaredSectionRadius - transverse ** 2;
            if (discriminant < 0) continue;
            const intersection = distance * Math.cos(difference) - Math.sqrt(discriminant);
            const index = axial * (angularSteps + 1) + angular;
            radii[index] = Math.min(radii[index], intersection - clearance);
          }
        }
      }
    }
    // Keep linear mesh interpolation on the material-removal side of the cut.
    const sampled = radii.slice();
    for (let axial = 0; axial <= axialSteps; axial += 1) {
      for (let angular = 0; angular <= angularSteps; angular += 1) {
        const index = axial * (angularSteps + 1) + angular;
        for (let da = -1; da <= 1; da += 1) {
          for (let dt = -1; dt <= 1; dt += 1) {
            const a = THREE.MathUtils.clamp(axial + da, 0, axialSteps);
            const t = THREE.MathUtils.euclideanModulo(angular + dt, angularSteps);
            radii[index] = Math.min(radii[index], sampled[a * (angularSteps + 1) + t]);
          }
        }
      }
    }
  }
  const positions = [];
  const indices = [];
  const circumferenceSteps = angularSteps * teeth;
  const stride = circumferenceSteps + 1;
  for (let axial = 0; axial <= axialSteps; axial += 1) {
    const z = -depth / 2 + depth * axial / axialSteps;
    for (let angular = 0; angular <= circumferenceSteps; angular += 1) {
      const angle = -pitch / 2 + pitch * angular / angularSteps;
      const radius = radii[axial * (angularSteps + 1) + angular % angularSteps];
      positions.push(radius * Math.cos(angle), radius * Math.sin(angle), z);
    }
  }
  for (let axial = 0; axial < axialSteps; axial += 1) {
    for (let angular = 0; angular < circumferenceSteps; angular += 1) {
      const a = axial * stride + angular;
      indices.push(a, a + 1, a + stride + 1, a, a + stride + 1, a + stride);
    }
  }
  const backCenter = positions.length / 3;
  positions.push(0, 0, -depth / 2, 0, 0, depth / 2);
  for (let angular = 0; angular < circumferenceSteps; angular += 1) {
    indices.push(backCenter, angular + 1, angular);
    const a = axialSteps * stride + angular;
    indices.push(backCenter + 1, a, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData = { profileKey: key, axialSteps, angularSteps, circumferenceSteps, clearance,
    depth, pitch, radii: Array.from(radii), rootRadius: Math.min(...radii), outerRadius };
  cache.set(key, geometry);
  return geometry.clone();
}
