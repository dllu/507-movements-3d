import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeDoubleRackGeometry} from '../src/simulation/mujoco-double-rack/geometry.js';
import {makeMujocoDoubleRack} from '../src/simulation/mujoco-double-rack/visual.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
const mujoco = await loadMujoco();

test('114 has closed oriented solids and a relieved half-pinion', () => {
  const v = makeDoubleRackGeometry(), u = v.root.userData;
  try {
    assert.equal(Object.keys(u.parts).length, 4);
    // The run-on end stubs are part of the frame's one extrusion (no joint faces).
    assert.deepEqual(Object.keys(u.parts).filter(n=>/stub/i.test(n)),[]);
  // p60 support policy: Brown draws no stands, guides or back bars here.
  assert.deepEqual(Object.keys(u.parts).filter(n=>/Guide|Pillar|Foot|Bearing|BackBar|Post|Clip|Strap|TieBar/.test(n)),[]);
    for (const [name, mesh] of Object.entries(u.parts)) {
      const s = inspectWeightedClutchSolid(mesh.geometry);
      assert(s.volume > 0, name);
      assert.equal(s.components, 1, name);
      assert.equal(s.unmatchedEdges + s.degenerate + s.nonfinite + s.wrongNormals, 0, name);
    }
    assert.equal(u.profile.sectorSpan, Math.PI);
    assert.equal(u.profile.endRelief, true);
    assert.equal(u.parts.pinion.geometry.userData.toothProfile.teeth, 14);
    // p109 (2026-09-29 rule): a full-depth 20-degree involute half-pinion and
    // trapezoidal basic-rack teeth (rack root 0.25 module below the pinion tip).
    assert(Math.abs(u.profile.pressureAngle - Math.PI / 9) < 1e-12);
    assert.equal(u.profile.addendum, 1); assert.equal(u.profile.dedendum, 1.25);
    assert(Math.abs(u.profile.rootY - u.profile.pitchRadius - 1.25 * u.profile.module) < 1e-12);
    assert.equal(u.hideGround, true);
  } finally { disposeObject3D(v.root); }
});

test('114 native collision cells reproduce the visible plates with no rack actuator', t => {
  const v = makeMujocoDoubleRack(mujoco), p = v.physics, u = v.root.userData;
  let error = 0, count = 0;
  try {
    assert.equal(p.model.nq, 2); assert.equal(p.model.neq, 0); assert.equal(p.model.nu, 1);
    assert.equal(p.model.actuator_trnid[0], p.id('mjOBJ_JOINT', 'pinion'));
    for (const [name, cells] of Object.entries(u.cells)) for (const [i, cell] of cells.entries()) {
      const id = p.id('mjOBJ_GEOM', name + i), mesh = p.model.geom_dataid[id];
      const first = p.model.mesh_vertadr[mesh], n = p.model.mesh_vertnum[mesh];
      const transform = new THREE.Matrix4().setFromMatrix3(new THREE.Matrix3().fromArray(p.data.geom_xmat, id * 9).transpose());
      transform.setPosition(new THREE.Vector3().fromArray(p.data.geom_xpos, id * 3));
      for (let j = 0; j < n; j++) {
        const point = new THREE.Vector3().fromArray(p.model.mesh_vert, (first + j) * 3).applyMatrix4(transform);
        error = Math.max(error, Math.min(...cell.map(q => point.distanceTo(new THREE.Vector3(...q))))); count++;
      }
    }
    assert(error < 2e-6);
    t.diagnostic(JSON.stringify({vertices: count, errorPixels: 100 * error, geoms: p.model.ngeom}));
  } finally { v.dispose(); }
});

test('114 transfers between racks for two cycles through contact alone', t => {
  const v = makeMujocoDoubleRack(mujoco), p = v.physics, f = v.root.userData.profile;
  let inputError = 0, meshError = 0, penetration = 0, lo = 0, hi = 0, maximumStep = 0;
  try {
    for (let i = 0; i < Math.round(16 / p.timestep); i++) {
      const before = p.data.qpos[1]; p.step(); const d = p.data;
      assert([...d.qpos, ...d.qvel].every(Number.isFinite));
      inputError = Math.max(inputError, Math.abs(d.qpos[0] - p.description.input(d.time).angle));
      const offset = f.sectorCenter + Math.PI / 2, triangle = Math.asin(Math.sin(d.qpos[0] + offset));
      if (Math.PI / 2 - Math.abs(triangle) > .7)
        meshError = Math.max(meshError, Math.abs(d.qpos[1] - f.pitchRadius * (triangle - offset)));
      lo = Math.min(lo, d.qpos[1]); hi = Math.max(hi, d.qpos[1]);
      maximumStep = Math.max(maximumStep, Math.abs(d.qpos[1] - before));
      const contacts = d.contact;
      try { for (let j = 0; j < contacts.size(); j++) {
        const c = contacts.get(j); try { penetration = Math.max(penetration, -c.dist); } finally { c.delete(); }
      } } finally { contacts.delete(); }
    }
    assert(lo < -1 && hi > .55); assert(lo > -1.05 && hi < .59);
    assert(inputError < .01); assert(meshError < .012); assert(penetration < .001);
    assert(maximumStep < .002); assert(Math.abs(p.data.qpos[1]) < .002);
    t.diagnostic(JSON.stringify({inputError, meshErrorPixels: 100 * meshError, penetrationPixels: 100 * penetration, maximumStepPixels: 100 * maximumStep}));
    v.reset();
    p.model.geom_contype.fill(0); p.model.geom_conaffinity.fill(0);
    v.update(2); assert(p.data.qpos[0] > 1.5); assert(Math.abs(p.data.qpos[1]) < 1e-10);
  } finally { v.dispose(); v.dispose(); }
  assert(p.model.isDeleted() && p.data.isDeleted());
});

test('114 restart, backward seeking and frame partitioning retain exact native state', () => {
  const v = makeMujocoDoubleRack(mujoco), p = v.physics;
  try {
    v.update(2); const state = [...p.data.qpos, ...p.data.qvel];
    v.reset(); for (let i = 1; i <= 120; i++) v.update(i / 60);
    assert.deepEqual([...p.data.qpos, ...p.data.qvel], state);
    v.update(.5); v.update(2); assert.deepEqual([...p.data.qpos, ...p.data.qvel], state);
  } finally { v.dispose(); }
});
