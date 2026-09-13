import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoSpringSector} from '../src/simulation/mujoco-spring-sector/visual.js';

const options = JSON.parse(process.env.PROBE_OPTIONS ?? '{}');
const prefix = process.env.PROBE_PREFIX ?? '/dev/shm/083-mujoco-probe';
const seconds = Number(process.env.PROBE_SECONDS ?? 16), mujoco = await loadMujoco(), started = performance.now();
const sourcePaths = ['src/simulation/mujoco-spring-sector', 'src/simulation/mujoco', 'src/simulation/mujoco-treadle']
  .flatMap(dir => fs.readdirSync(dir).filter(name => name.endsWith('.js')).map(name => dir + '/' + name));
sourcePaths.push('src/simulation/spring-rack-coil.js', 'src/simulation/finite-plate-geometry.js',
  'src/simulation/primitives.js', 'scripts/probe-mujoco-spring-sector.mjs', 'package-lock.json');
const sourceHashes = Object.fromEntries(sourcePaths.map(path => [path, createHash('sha256').update(fs.readFileSync(path)).digest('hex')]));
const visual = makeMujocoSpringSector(mujoco, options), {data, joints, description} = visual.physics;
const initial = visual.sync(), rows = [], pitch = 2 * Math.PI / 38;
let minGap = 0, maxContact = 0, maxStep = 0, high = initial.wheelAngle, retreat = 0;
let previous = Array.from(data.qpos), minSpeed = Infinity, maxSpeed = -Infinity;
try {
  for (let step = 1; step <= Math.round(seconds / visual.physics.timestep); step++) {
    visual.physics.step();
    const q = Array.from(data.qpos), v = Array.from(data.qvel);
    assert(q.every(Number.isFinite) && v.every(Number.isFinite));
    maxStep = Math.max(maxStep, ...q.map((value, i) => Math.abs(value - previous[i]))); previous = q;
    const theta = q[joints.wheel.q]; high = Math.max(high, theta); retreat = Math.max(retreat, high - theta);
    minSpeed = Math.min(minSpeed, v[joints.wheel.v]); maxSpeed = Math.max(maxSpeed, v[joints.wheel.v]);
    maxContact = Math.max(maxContact, data.ncon);
    if (step % Math.round(.05 / visual.physics.timestep) !== 0) continue;
    const state = visual.sync();
    const contacts = data.contact, counts = {front: 0, rear: 0};
    for (let i = 0; i < contacts.size(); i++) {
      const contact = contacts.get(i); minGap = Math.min(minGap, contact.dist);
      for (const geom of [contact.geom1, contact.geom2]) {
        const body = visual.physics.model.geom_bodyid[geom];
        for (const name of ['front', 'rear']) if (body === visual.physics.bodies[name]) counts[name]++;
      }
      contact.delete();
    }
    contacts.delete(); rows.push({...state, contacts: counts});
  }
  const final = visual.sync();
  const report = {sourceHashes, options: description.options, seconds: data.time, wallSeconds: (performance.now() - started) / 1000,
    advanceTeeth: (final.wheelAngle - initial.wheelAngle) / pitch, maximumRetreatTeeth: retreat / pitch,
    minimumContactPixels: minGap * visual.root.userData.source.scale, maximumCoordinateStep: maxStep,
    minSpeed, maxSpeed, maxContact, initial, final, rows,
    collision: Object.fromEntries(Object.entries(description.collision).map(([name, shape]) => [name, {cells: shape.cells.length, maximumBoundaryError: shape.maximumBoundaryError}]))};
  fs.writeFileSync(prefix + '.json', JSON.stringify(report) + '\n', {flag: 'wx'});
  console.log({...report, rows: rows.length});
} finally { visual.dispose(); }
