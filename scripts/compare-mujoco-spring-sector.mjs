import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {makeSpringSectorGeometry} from '../src/simulation/mujoco-spring-sector/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';

const paths = process.argv.slice(2);
assert.equal(paths.length, 2, 'Provide coarse and fine probe JSON files');
const [coarse, fine] = paths.map(path => JSON.parse(fs.readFileSync(path)));
assert.deepEqual(coarse.sourceHashes, fine.sourceHashes);
assert.equal(coarse.options.timestep, 2 * fine.options.timestep);
assert.deepEqual({...coarse.options, timestep: 0}, {...fine.options, timestep: 0});
assert.equal(coarse.rows.length, fine.rows.length);
const visual = makeSpringSectorGeometry(), u = visual.root.userData;
const maximumCoordinates = Array(6).fill(0), maximumSectorPixels = [0, 0];
let maximumWheelPixels = 0;
try {
  for (let i = 0; i < coarse.rows.length; i++) {
    const a = coarse.rows[i], b = fine.rows[i]; assert.ok(Math.abs(a.time - b.time) < 1e-7);
    a.qpos.forEach((q, k) => { maximumCoordinates[k] = Math.max(maximumCoordinates[k], Math.abs(q - b.qpos[k])); });
    maximumWheelPixels = Math.max(maximumWheelPixels,
      2 * u.geometry.wheelOuterRadius * Math.abs(Math.sin((a.wheelAngle - b.wheelAngle) / 2)) * u.source.scale);
    for (const [side, name] of ['front', 'rear'].entries()) {
      const vertices = u.parts[name + 'Sector'].geometry.attributes.position;
      const point = (state, x, y) => [x * Math.cos(state.shaftAngle) - (y + state.lifts[side]) * Math.sin(state.shaftAngle),
        x * Math.sin(state.shaftAngle) + (y + state.lifts[side]) * Math.cos(state.shaftAngle)];
      for (let j = 0; j < vertices.count; j++) {
        const p = point(a, vertices.getX(j), vertices.getY(j)), q = point(b, vertices.getX(j), vertices.getY(j));
        maximumSectorPixels[side] = Math.max(maximumSectorPixels[side], Math.hypot(p[0] - q[0], p[1] - q[1]) * u.source.scale);
      }
    }
  }
  console.log(JSON.stringify({inputs: Object.fromEntries(paths.map(path => [path, createHash('sha256').update(fs.readFileSync(path)).digest('hex')])),
    samples: coarse.rows.length, seconds: coarse.seconds, maximumCoordinates, maximumWheelPixels, maximumSectorPixels,
    endpointDifferenceTeeth: fine.advanceTeeth - coarse.advanceTeeth,
    qualification: 'Pointwise differences at 50 ms intervals over this run; output agreement does not establish identical impact/drop timing or continuous convergence.'}, null, 2));
} finally { disposeObject3D(visual.root); }
