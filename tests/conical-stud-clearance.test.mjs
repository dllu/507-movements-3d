import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { conicalStudFluteRadius, conicalStudMotion, conicalStudParameters } from '../src/simulation/conical-stud-geometry.js';
import { probeConicalStudContact } from '../scripts/probe-conical-stud-contact.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url)));

test('037 p101: swept spherical studs clear the straight ball-groove flutes', () => {
  const result = probeConicalStudContact({ samples: 2400, spherePoints: 400 });
  assert.ok(result.minGrooveMargin > 0.0008, `groove margin ${result.minGrooveMargin}`);
  assert.ok(result.minStudCentreSpacing > 2 * result.studRadius + 0.04, 'studs stand apart');
  assert.ok(Math.max(...result.centredBacklash) < 0.015 && Math.min(...result.centredBacklash) > 0.002);
});

test('037 p101: rendered studs and flutes clear each other and the stud body', () => {
  const model = createMovementModel(catalog.movements[36]);
  const { flutedCone, studs, toothedCone, studCone, studBody } = model.root.userData.blocks;
  const g = model.root.userData.geometry;
  const motion = conicalStudMotion(conicalStudParameters);
  const sphere = studs[0].geometry.attributes.position;
  const land = flutedCone.geometry.attributes.position;
  const p = new THREE.Vector3();
  let minStud = Infinity, minBody = Infinity;
  for (let sample = 0; sample < 160; sample += 1) {
    model.update(g.cycleDuration * (sample + 0.371) / 160, 0);
    model.root.updateMatrixWorld(true);
    const toothedInverse = toothedCone.userData.rotor.matrixWorld.clone().invert();
    const studInverse = studCone.userData.rotor.matrixWorld.clone().invert();
    for (const stud of studs) {
      const transform = toothedInverse.clone().multiply(stud.matrixWorld);
      for (let i = 0; i < sphere.count; i += 1) {
        p.fromBufferAttribute(sphere, i).applyMatrix4(transform);
        if (Math.abs(p.z) > g.coneHalfHeight) continue;
        const radius = Math.hypot(p.x, p.y);
        if (radius > motion.toothedRadius(p.z) + 0.01) continue;
        minStud = Math.min(minStud, radius - conicalStudFluteRadius(conicalStudParameters, motion, Math.atan2(p.y, p.x), p.z));
      }
    }
    const transform = studInverse.clone().multiply(flutedCone.matrixWorld);
    for (let i = 0; i < land.count; i += 13) {
      p.fromBufferAttribute(land, i).applyMatrix4(transform);
      const bodyRadius = THREE.MathUtils.lerp(g.studBodyBottomRadius, g.studBodyTopRadius,
        (p.z + g.coneHalfHeight) / (2 * g.coneHalfHeight));
      minBody = Math.min(minBody, Math.hypot(p.x, p.y) - bodyRadius);
    }
  }
  assert.ok(minStud > 0, `stud/flute clearance ${minStud}`);
  assert.ok(minBody > 0.003, `land/body clearance ${minBody}`);
  assert.equal(studBody.userData.conicalBody, true);
  assert.equal(model.root.userData.contactValidation.status, 'incomplete');
  console.log(JSON.stringify({ minStud, minBody }));
});
