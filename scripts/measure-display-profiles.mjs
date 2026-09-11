import { readFile, rename, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));
const requestedIds = new Set(process.argv.slice(2).map(Number));
if ([...requestedIds].some((id) => !Number.isInteger(id) || id < 1 || id > 507)) {
  throw new RangeError('Optional arguments must be movement numbers from 1 to 507.');
}
const profiles = requestedIds.size > 0
  ? JSON.parse(await readFile(new URL('../src/data/display-profiles.json', import.meta.url))).profiles
  : {};
const samples = 96;
const dt = 0.0001;
const worldQuaternion = new THREE.Quaternion();
const difference = new THREE.Quaternion();

for (const movement of catalog.movements) {
  if (requestedIds.size > 0 && !requestedIds.has(movement.id)) continue;
  const model = createMovementModel(movement);
  const period = model.root.userData.animationTiming.authoredCyclePeriod;
  const modelSize = new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3()).length();
  const objects = [];
  model.root.traverse((object) => {
    let measuresRigidRotation = true;
    for (let ancestor = object; ancestor; ancestor = ancestor.parent) {
      // Cable/spring segment frames and material markers follow a curve;
      // their tangent-frame angular speed is not a shaft's rotation speed.
      if (ancestor.userData.setPoints || ancestor.userData.continuousFuseeChain
        || ancestor.userData.isYarn || ancestor.userData.isFlowMarker || ancestor.userData.rotationallySymmetric) {
        measuresRigidRotation = false;
      }
    }
    const partSize = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3()).length();
    const visibilityWeight = Math.min(1, partSize / (0.1 * modelSize));
    objects.push({ object, visibilityWeight, measuresRigidRotation, previous: new THREE.Quaternion(), speed: 0 });
  });
  let peakAngularSpeed = 0;
  let peakVisibleAngularSpeed = 0;
  let fastestPart = '';
  const rates = [];
  let floorY = Infinity;
  const motionBounds = new THREE.Box3();
  const configurationIds = model.root.userData.configurations?.map(option => option.id) ?? [null];
  const configurationMeasurements = [];
  let sustainedVisibleAngularSpeed = 0;
  for (const configuration of configurationIds) {
    if (configuration !== null) {
      model.root.userData.setConfiguration(configuration);
      model.update?.(0, 0);
    }
    rates.length = 0;
    let previousTime = 0;
    for (let sample = 0; sample <= samples; sample += 1) {
      let phaseSpeed = 0;
      const time = period * sample / samples;
      model.update?.(time, Math.max(0, time - previousTime));
      model.root.updateMatrixWorld(true);
      for (const entry of objects) entry.object.getWorldQuaternion(entry.previous);
      model.update?.(time + dt, dt);
      model.root.updateMatrixWorld(true);
      for (const entry of objects) {
        const { object, previous } = entry;
        object.getWorldQuaternion(worldQuaternion);
        difference.copy(previous).invert().multiply(worldQuaternion).normalize();
        const angle = 2 * Math.atan2(Math.hypot(difference.x, difference.y, difference.z), Math.abs(difference.w));
        entry.speed = angle / dt;
        previous.copy(worldQuaternion);
      }
      model.update?.(time + 2 * dt, dt);
      model.root.updateMatrixWorld(true);
      for (const { object, visibilityWeight, measuresRigidRotation, previous, speed: firstSpeed } of objects) {
        object.getWorldQuaternion(worldQuaternion);
        difference.copy(previous).invert().multiply(worldQuaternion).normalize();
        const secondSpeed = 2 * Math.atan2(Math.hypot(difference.x, difference.y, difference.z), Math.abs(difference.w)) / dt;
        // A wrap of a material marker or a direction arrow is a discrete reset,
        // not a rotating machine part. Require motion in both adjacent probes.
        const speed = Math.min(firstSpeed, secondSpeed);
        if (measuresRigidRotation) {
          phaseSpeed = Math.max(phaseSpeed, speed * visibilityWeight);
          peakVisibleAngularSpeed = Math.max(peakVisibleAngularSpeed, speed * visibilityWeight);
        }
        if (measuresRigidRotation && speed > peakAngularSpeed) {
          peakAngularSpeed = speed;
          fastestPart = object.userData.role || object.name || object.type;
        }
        if (object.geometry?.attributes.position?.version > 0) {
          object.geometry.computeBoundingBox();
        }
      }
      // Rotating a disk's local bounding square exaggerates its diameter by
      // up to sqrt(2). Measure vertices so that empty corners neither shrink
      // the camera view nor push the shadow floor down during playback.
      const bounds = new THREE.Box3().setFromObject(model.root, true);
      motionBounds.union(bounds);
      rates.push(phaseSpeed);
      floorY = Math.min(floorY, bounds.min.y);
      previousTime = time + 2 * dt;
    }
      rates.sort((a, b) => a - b);
    const sustained = rates[Math.floor(rates.length * 0.75)];
    sustainedVisibleAngularSpeed = Math.max(sustainedVisibleAngularSpeed, sustained);
    if (configuration !== null) configurationMeasurements.push({ configuration,
      peakVisibleAngularSpeed: rates.at(-1), sustainedVisibleAngularSpeed: sustained });
  }
  profiles[movement.id] = {
    peakAngularSpeed,
    peakVisibleAngularSpeed,
    sustainedVisibleAngularSpeed,
    ...(configurationMeasurements.length ? { configurationMeasurements } : {}),
    floorY, fastestPart,
    motionBounds: { min: motionBounds.min.toArray(), max: motionBounds.max.toArray() },
  };
  const geometries = new Set();
  const materials = new Set();
  model.root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
    else if (object.material) materials.add(object.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  if (movement.id % 25 === 0) process.stdout.write(`Measured ${movement.id}/507\n`);
}
const result = {
  note: 'World-space rotation and bounds over one authored period, covering every offered installed configuration. Visible rates weight parts smaller than 10% of the assembly diagonal, so tiny idlers do not dictate playback. Sustained rate is the largest per-configuration 75th percentile. Numerical display evidence; not source-fidelity or collision certification.',
  samples, dt, profiles,
};
const writeAtomic = async (name, contents) => {
  const target = new URL('../src/data/' + name, import.meta.url);
  const temporary = new URL('../src/data/' + name + '.tmp', import.meta.url);
  await writeFile(temporary, contents);
  await rename(temporary, target);
};
await writeAtomic('display-profiles.json', `${JSON.stringify(result, null, 2)}\n`);
// A plain ES module works in both Node 18 and browsers without version-specific
// JSON import assertion/attribute syntax. Keep the readable report alongside it.
await writeAtomic('display-profiles.js',
  `// Generated by scripts/measure-display-profiles.mjs.\nexport default ${JSON.stringify(result)};\n`);
