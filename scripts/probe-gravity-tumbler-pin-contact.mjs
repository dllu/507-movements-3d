import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeGravityTumblerCandidate } from './lib/gravity-tumbler-candidate.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const rows = [], impacts = [];
const factory = makeGravityTumblerCandidate;
for (const damping of [0, 2.8]) {
  const model = factory({ damping }), { parts, geometry: p } = model.root.userData;
  const pin = parts.drivingPin, collar = parts.halfCutSleeveEnd;
  const pinTree = triangleTree(pin.geometry), collarTree = triangleTree(collar.geometry);
  const poses = [];
  for (let i = 0; i < 81; i++) {
    const cycleTime = p.cycleDuration * (i + 0.319) / 81;
    const state = model.motion.atCycleTime(cycleTime);
    if (state.pinEngaged) poses.push({ cycleTime, mode: state.mode });
  }
  for (const event of model.motion.events.filter(e => e.kind.endsWith('impact')))
    poses.push({ cycleTime: event.time, mode: event.kind.startsWith('lower') ? 'lower' : 'upper', event });
  for (const pose of poses) {
    const time = pose.cycleTime - p.sourceTime;
    model.update(time); model.root.updateMatrixWorld(true);
    const exact = meshPairDistance(pinTree, collarTree, collar.matrixWorld.clone().invert().multiply(pin.matrixWorld), 0.01);
    if (!exact.witness || exact.distance < 1e-8) throw new Error('Missing finite pin contact witness');
    const a = new THREE.Vector3().fromArray(exact.witness.a).applyMatrix4(collar.matrixWorld);
    const b = new THREE.Vector3().fromArray(exact.witness.b).applyMatrix4(collar.matrixWorld);
    const force = b.clone().sub(a).normalize();
    const outputMoment = b.clone().cross(force).z, inputMoment = a.clone().cross(force.clone().negate()).z;
    const state = model.motion.atCycleTime(pose.cycleTime);
    let normalSpeedResidual = null, compressiveForce = null;
    if (!pose.event) {
      const localA = a.clone().applyMatrix4(pin.matrixWorld.clone().invert());
      const localB = b.clone().applyMatrix4(collar.matrixWorld.clone().invert());
      const h = 1e-6;
      model.update(time - h); model.root.updateMatrixWorld(true);
      const beforeA = localA.clone().applyMatrix4(pin.matrixWorld), beforeB = localB.clone().applyMatrix4(collar.matrixWorld);
      model.update(time + h); model.root.updateMatrixWorld(true);
      const afterA = localA.clone().applyMatrix4(pin.matrixWorld), afterB = localB.clone().applyMatrix4(collar.matrixWorld);
      normalSpeedResidual = Math.abs(afterB.sub(beforeB).sub(afterA.sub(beforeA)).dot(force) / (2 * h));
      compressiveForce = state.pinTorque / outputMoment;
    } else {
      const normalImpulse = pose.event.impulse / outputMoment;
      impacts.push({ damping, kind: pose.event.kind, time, outputMoment, inputMoment, normalImpulse,
        generalizedImpulse: pose.event.impulse, motorWork: -inputMoment * normalImpulse * p.driverSpeed,
        expectedDriverImpactWork: pose.event.driverImpactWork,
        impulsePowerResidual: Math.abs(-inputMoment * normalImpulse * p.driverSpeed - pose.event.driverImpactWork) });
    }
    rows.push({ damping, time, cycleTime: pose.cycleTime, mode: pose.mode, impact: Boolean(pose.event),
      gap: exact.distance, outputMoment, inputMoment, momentResidual: Math.abs(outputMoment + inputMoment),
      normalSpeedResidual, compressiveForce, witness: exact.witness });
  }
}
const summary = { poses: rows.length, impacts: impacts.length,
  minimumGap: Math.min(...rows.map(r => r.gap)), maximumGap: Math.max(...rows.map(r => r.gap)),
  minimumCompressiveForce: Math.min(...rows.filter(r => !r.impact).map(r => r.compressiveForce)),
  minimumNormalImpulse: Math.min(...impacts.map(r => r.normalImpulse)),
  maximumNormalSpeedResidual: Math.max(...rows.map(r => r.normalSpeedResidual ?? 0)),
  maximumMomentResidual: Math.max(...rows.map(r => r.momentResidual)),
  maximumImpulsePowerResidual: Math.max(...impacts.map(r => r.impulsePowerResidual)),
  wrongMomentSigns: rows.filter(r => r.mode === 'lower' ? r.outputMoment <= 0 : r.outputMoment >= 0).length };
const passed = !summary.wrongMomentSigns && summary.minimumCompressiveForce > 0 && summary.minimumNormalImpulse > 0
  && summary.minimumGap > 0.00014 && summary.maximumGap < 0.00016 && summary.maximumNormalSpeedResidual < 1e-7
  && summary.maximumMomentResidual < 1e-9 && summary.maximumImpulsePowerResidual < 1e-9;
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/067-finite-pin-contact.json', JSON.stringify({ movement: 67, passed, productionChanged: false,
  method: 'Actual closest triangle witnesses on the finite rectangular pin and half-annular collar, including both impact ends in the undamped case and the lifting side in the damped candidate. Compressive contact/impulse directions, world-axis torque balance, motor impact work and independently differentiated common-motion contact velocity. The 0.00015 normal clearance is a modeling tolerance; rigid contact is idealized across that gap. All other pair containment and full dynamics have separate checks.', summary, rows, impacts }, null, 2) + '\n');
console.log({ passed, summary, impacts }); if (!passed) process.exitCode = 1;
