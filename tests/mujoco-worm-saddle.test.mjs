import test from 'node:test';
import assert from 'node:assert/strict';
import loadMujoco from '@mujoco/mujoco';
import * as THREE from 'three';
import {makeMujocoWormSaddle} from '../src/simulation/mujoco-worm-saddle/visual.js';
import {generateSaddleWheel} from '../src/simulation/mujoco-worm-saddle/hob.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
import {auditClutchSourceSolids} from '../scripts/lib/weighted-clutch-fit-audit.mjs';

const mujoco = await loadMujoco();
const phaseError = v => {
  const [worm, slide, wheel] = v.physics.data.qpos, f = v.root.userData.profile;
  return slide + f.lead * worm - f.pitchRadius * wheel;
};
const flags = p => {
  const buffer = new mujoco.DoubleBuffer(p.model.neq);
  try {
    mujoco.mj_getState(p.model, p.data, buffer, mujoco.mjtState.mjSTATE_EQ_ACTIVE.value);
    return Array.from(buffer.GetView());
  } finally { buffer.delete(); }
};

test('104 retains ten closed solids and a reproducible matching hobbed wheel', t => {
  const v = makeMujocoWormSaddle(mujoco), p = v.physics, u = v.root.userData;
  try {
    assert.equal(p.model.nq, 3); assert.equal(p.model.nu, 2); assert.equal(p.model.neq, 3);
    assert.equal(p.model.ngeom, 0); assert.equal(p.model.ntendon, 1);
    assert.equal(Object.keys(u.parts).length, 17);
    for (const part of Object.values(u.parts)) {
      const a = inspectWeightedClutchSolid(part.geometry);
      assert.equal(a.components, 1); assert.ok(a.volume > 0);
      for (const key of ['degenerate', 'wrongNormals', 'nonfinite', 'unmatchedEdges']) assert.equal(a[key], 0, part.name + ' ' + key);
    }
    for (const name of ['worm', 'carriage', 'wheel']) {
      const id = p.bodies[name], m = p.description.mass[name];
      assert.ok(Math.abs(p.model.body_mass[id] - m.volume * p.description.density) < 1e-10);
      for (let k = 0; k < 3; k++) assert.ok(Math.abs(p.model.body_ipos[id * 3 + k] - m.centroid[k]) < 1e-10);
      assert.ok(p.model.body_inertia.slice(id * 3, id * 3 + 3).every(x => x > 0));
    }
    const f = u.profile, coarse = generateSaddleWheel(f);
    let maximum = 0;
    for (let j = 0; j <= coarse.axialSteps; j++) for (let i = 0; i <= coarse.angularSteps; i++)
      maximum = Math.max(maximum, Math.abs(coarse.radii[j * (coarse.angularSteps + 1) + i] - u.cut.radii[2 * j * (u.cut.angularSteps + 1) + 2 * i]));
    assert.ok(maximum < 1e-10); assert.equal(u.cut.seamError, 0);
    assert.ok(Math.abs(2 * Math.PI * f.pitchRadius / f.teeth - f.pitch) < 1e-12);
    t.diagnostic(JSON.stringify({hobCommonSampleErrorPixels: 100 * maximum, solids: 10}));
  } finally { v.dispose(); }
});

test('104 switches the active input, transmits load, and loses output motion without the gear constraint', t => {
  const v = makeMujocoWormSaddle(mujoco), p = v.physics, u = v.root.userData, loads = [];
  try {
    for (const mode of ['worm', 'wheel']) {
      u.setConfiguration(mode); const active = mode === 'worm' ? 0 : 1, passiveJoint = mode === 'worm' ? 2 : 1;
      assert.deepEqual(flags(p), mode === 'worm' ? [1, 0, 1] : [0, 1, 1]);
      assert.equal(p.model.actuator_gainprm[(1 - active) * 10], 0);
      assert.equal(Math.abs(p.model.actuator_biasprm[(1 - active) * 10 + 1]), 0);
      assert.equal(Math.abs(p.model.actuator_biasprm[(1 - active) * 10 + 2]), 0);
      v.update(4); assert.ok(p.data.qpos[passiveJoint] > .6);
      u.setConfiguration(mode); p.model.opt.gravity.fill(0);
      mujoco.mj_setState(p.model, p.data, mode === 'worm' ? [1, 0, 0] : [0, 1, 0], mujoco.mjtState.mjSTATE_EQ_ACTIVE.value);
      v.update(4); assert.ok(Math.abs(p.data.qpos[passiveJoint]) < 1e-10);
      assert.ok(p.data.qpos[active === 0 ? 0 : 2] > .6);
    }
    assert.throws(() => u.setConfiguration('invalid'), RangeError);
  } finally { v.dispose(); }
  for (const mode of ['worm', 'wheel']) for (const force of [-2, 2]) {
    const v = makeMujocoWormSaddle(mujoco, {mode, period: 1e9}), p = v.physics, f = v.root.userData.profile;
    try {
      p.model.opt.gravity.fill(0); p.data.qfrc_applied[mode === 'worm' ? 2 : 1] = force;
      // Remove dry guide friction here to measure the transmission's virtual-work ratio.
      p.model.dof_frictionloss.fill(0); v.update(2);
      const expected = mode === 'worm' ? -force / f.teeth : -force * f.pitchRadius;
      const measured = p.data.actuator_force[mode === 'worm' ? 0 : 1];
      assert.ok(Math.abs(measured - expected) < 1e-5);
      assert.ok(Math.abs(phaseError(v)) < .0001);
      loads.push({mode, force, inputReaction: measured, expected});
    } finally { v.dispose(); }
  }
  t.diagnostic(JSON.stringify({loads}));
});

test('104 ten continuous cycles preserve the mesh, guide retention and full camera envelope in both modes', t => {
  const v = makeMujocoWormSaddle(mujoco), p = v.physics, u = v.root.userData, f = u.profile, rows = [];
  try {
    for (const mode of ['worm', 'wheel']) {
      u.setConfiguration(mode);
      let error = 0, held = 0, retention = Infinity, visiblePenetration = 0, checks = 0, poses = 0, maximum = -Infinity, minimum = Infinity;
      for (let i = 0; i <= 40000; i++) {
        if (i) p.step(); const q = p.data.qpos;
        assert.ok([...q, ...p.data.qvel].every(Number.isFinite));
        error = Math.max(error, Math.abs(phaseError(v)));
        held = Math.max(held, Math.abs(q[mode === 'worm' ? 1 : 0]));
        const output = q[mode === 'worm' ? 2 : 1]; maximum = Math.max(maximum, output); minimum = Math.min(minimum, output);
        retention = Math.min(retention, (f.foot.left - f.bed.left) / 100 + q[1], (f.bed.right - f.foot.right) / 100 - q[1]);
        if (i <= 4000 && i % 500 === 0) {
          v.sync(); const audit = auditClutchSourceSolids(v); checks += audit.checks; poses++;
          assert.deepEqual(audit.topologyIssues, []);
          for (const issue of audit.issues) {
            assert.deepEqual([issue.from, issue.to].sort(), ['wheel', 'worm'], JSON.stringify(issue));
            visiblePenetration = Math.max(visiblePenetration, -issue.gap);
          }
          for (const mesh of Object.values(u.parts)) {
            if (mesh.userData.beyondPlateCrop) continue;
            const positions = mesh.geometry.attributes.position;
            for (let j = 0; j < positions.count; j++) assert.ok(u.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(positions, j).applyMatrix4(mesh.matrixWorld)), mesh.name);
          }
        }
      }
      assert.ok(error * 100 < .003); assert.ok(held * 100 < .003);
      assert.ok(retention > .15); assert.ok(visiblePenetration * 100 < .01);
      assert.ok(maximum - minimum > (mode === 'worm' ? 1.04 : .60));
      rows.push({mode, phaseErrorPixels: error * 100, heldCoordinateError: held, retentionPixels: retention * 100,
        visiblePenetrationPixels: visiblePenetration * 100, maximum, minimum, checks, poses});
    }
    t.diagnostic(JSON.stringify({rows}));
  } finally { v.dispose(); }
});

test('104 fixed-step playback, mode reset, disposal and timestep refinement', t => {
  const v = makeMujocoWormSaddle(mujoco), p = v.physics;
  try {
    for (const mode of ['worm', 'wheel']) {
      v.root.userData.setConfiguration(mode); v.update(2); const state = [...p.data.qpos, ...p.data.qvel];
      v.reset(); for (let i = 1; i <= 120; i++) v.update(i / 60);
      assert.deepEqual([...p.data.qpos, ...p.data.qvel], state);
      v.update(.5); v.update(2); assert.deepEqual([...p.data.qpos, ...p.data.qvel], state);
      v.root.userData.setConfiguration(mode); assert.equal(p.data.time, 0); assert.deepEqual([...p.data.qpos], [0, 0, 0]);
    }
  } finally { v.dispose(); v.dispose(); }
  assert.ok(p.model.isDeleted() && p.data.isDeleted());
  const rows = [];
  for (const mode of ['worm', 'wheel']) {
    const vs = [.002, .001, .0005].map(timestep => makeMujocoWormSaddle(mujoco, {mode, timestep})), differences = [0, 0];
    try {
      for (let i = 1; i <= 8000; i++) {
        for (const v of vs) for (let j = 0; j < .002 / v.physics.timestep; j++) v.physics.step();
        for (let k = 0; k < 2; k++) {
          const a = vs[k].physics.data.qpos, b = vs[k + 1].physics.data.qpos, f = vs[k].root.userData.profile;
          differences[k] = Math.max(differences[k], Math.abs(a[1] - b[1]), f.pitchRadius * Math.abs(a[2] - b[2]));
        }
      }
      assert.ok(differences[0] * 100 < .08); assert.ok(differences[1] < differences[0]);
      rows.push({mode, timestepPixels: differences.map(x => x * 100)});
    } finally { vs.forEach(v => v.dispose()); }
  }
  t.diagnostic(JSON.stringify({rows}));
});
