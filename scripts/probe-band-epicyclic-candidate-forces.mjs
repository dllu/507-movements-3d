import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeBandEpicyclicGearCandidate } from '../artifacts/review/057-candidate-gears.mjs';

const contacts = JSON.parse(await readFile('artifacts/review/057-candidate-gear-contact.json', 'utf8'));
const model = makeBandEpicyclicGearCandidate(), { parts, geometry: p } = model.root.userData;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const rotationalVelocity = (position, omega) => new THREE.Vector3(-position.y * omega, position.x * omega, 0);
const poses = [];
for (let i = 0; i < contacts.poses.length; i += 2) {
  const pair = contacts.poses.slice(i, i + 2), time = pair[0].time;
  model.update(time); model.root.updateMatrixWorld(true);
  const center = parts.planet.getWorldPosition(new THREE.Vector3());
  const centerVelocity = rotationalVelocity(center, p.carrierSpeed);
  const forces = pair.map(row => {
    const a = new THREE.Vector3(row.witness.a.x, row.witness.a.y, 0).applyMatrix4(parts[row.target].matrixWorld);
    const b = new THREE.Vector3(row.witness.b.x, row.witness.b.y, 0).applyMatrix4(parts[row.target].matrixWorld);
    // Closest actual skin points define the compressive contact direction.
    const force = a.clone().sub(b).normalize(), lever = a.clone().sub(center);
    const planetVelocity = centerVelocity.clone().add(rotationalVelocity(lever, p.planetSpeed));
    const targetSpeed = row.target === 'sun' ? p.sunSpeed : p.ringSpeed;
    const targetVelocity = rotationalVelocity(b, targetSpeed);
    return { target: row.target, force, planetMoment: cross(lever, force),
      targetMoment: -cross(b, force), planetPower: force.dot(planetVelocity),
      targetPower: -force.dot(targetVelocity), normalVelocity: force.dot(planetVelocity.clone().sub(targetVelocity)) };
  });
  const [sun, ring] = forces;
  const sunLoad = -ring.planetMoment / sun.planetMoment;
  const netForce = ring.force.clone().addScaledVector(sun.force, sunLoad);
  const sunMoment = sun.targetMoment * sunLoad, ringMoment = ring.targetMoment;
  const carrierMoment = cross(center, netForce);
  const sunPower = sunMoment * p.sunSpeed, ringPower = ringMoment * p.ringSpeed;
  const carrierPower = carrierMoment * p.carrierSpeed;
  poses.push({ time, sunLoad, sunMoment, ringMoment, carrierMoment, sunPower, ringPower, carrierPower,
    planetSpinMoment: sun.planetMoment * sunLoad + ring.planetMoment,
    torqueClosure: sunMoment + ringMoment + carrierMoment,
    normalizedPowerResidual: Math.abs(sunPower + ringPower + carrierPower) / Math.abs(ringPower),
    carrierPowerResidual: Math.abs(sunPower + ringPower + carrierPower) / Math.abs(carrierPower),
    maximumNormalVelocity: Math.max(...forces.map(v => Math.abs(v.normalVelocity))) });
}
const report = { method: 'Compressive normals from closest actual Float32 tooth skins. Positive loads balance the free planet spin torque. Moving planet-center velocity is included in contact power; the carrier receives the bearing reaction.',
  poses, summary: { poses: poses.length, minimumSunLoad: Math.min(...poses.map(v => v.sunLoad)),
    minimumCarrierMoment: Math.min(...poses.map(v => v.carrierMoment)),
    maximumSunMoment: Math.max(...poses.map(v => v.sunMoment)), maximumRingMoment: Math.max(...poses.map(v => v.ringMoment)),
    maximumAbsoluteTorqueClosure: Math.max(...poses.map(v => Math.abs(v.torqueClosure))),
    maximumNormalizedPowerResidual: Math.max(...poses.map(v => v.normalizedPowerResidual)),
    maximumCarrierPowerResidual: Math.max(...poses.map(v => v.carrierPowerResidual)),
    maximumNormalVelocity: Math.max(...poses.map(v => v.maximumNormalVelocity)) } };
await writeFile('artifacts/review/057-candidate-gear-forces.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.summary, null, 2));
if (poses.some(v => v.sunLoad <= 0 || v.carrierMoment <= 0 || v.sunMoment >= 0 || v.ringMoment >= 0 || v.normalizedPowerResidual > 0.01)) process.exitCode = 1;
