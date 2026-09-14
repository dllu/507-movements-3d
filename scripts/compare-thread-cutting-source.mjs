import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeThreadCuttingGeometry, THREE} from '../src/simulation/mujoco-thread-cutting/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {freezeStudySources, verifyStudySources} from './lib/study-report-io.mjs';
import {threadCuttingStudySources} from './lib/thread-cutting-study-sources.mjs';

const prefix = process.env.PROBE_PREFIX ?? '/dev/shm/109-comparison';
const measuredFile = process.env.SOURCE_REPORT ?? '/dev/shm/109-source-c.json';
const sources = freezeStudySources([
  ...threadCuttingStudySources('scripts/compare-thread-cutting-source.mjs'), measuredFile,
], prefix);
const measured = JSON.parse(fs.readFileSync(measuredFile, 'utf8'));
const visual = makeThreadCuttingGeometry();
const {parts, profile: f} = visual.root.userData;
const stats = values => ({count: values.length,
  rms: Math.sqrt(values.reduce((s, x) => s + x * x, 0) / values.length),
  maximum: Math.max(...values.map(Math.abs))});

try {
  // Compare the actual Float32 mesh extents, including baked transforms,
  // with each independently sampled source edge. No camera fitting is used.
  const bounds = Object.fromEntries(Object.entries(parts).map(([name, mesh]) => {
    const box = new THREE.Box3().setFromObject(mesh, true);
    return [name, {left: f.axis[0] + 100 * box.min.x, right: f.axis[0] + 100 * box.max.x,
      top: f.axis[1] - 100 * box.max.y, bottom: f.axis[1] - 100 * box.min.y}];
  }));
  const groups = {
    top: 'topRail', bottom: 'bottomRail', carriage: 'carriage', arm: 'arm',
    leadCrest: 'leadThread', workCrest: 'workpiece', workBlank: 'workpiece',
    leadShaft: 'leadUpperShaft', workShaft: 'workUpperShaft',
  };
  const edges = {};
  for (const [name, reading] of Object.entries(measured.edges)) {
    const side = ['Left', 'Right', 'Top', 'Bottom'].find(s => name.endsWith(s));
    const group = name.slice(0, -side.length), key = side.toLowerCase();
    const actual = group === 'gear'
      ? (side === 'Left' ? Math.min : side === 'Right' ? Math.max : side === 'Top' ? Math.min : Math.max)(bounds.leadGear[key], bounds.workGear[key])
      : bounds[groups[group]][key];
    const axis = ['Left', 'Right'].includes(side) ? 0 : 1;
    const residuals = reading.points.map(point => actual - point[axis]);
    edges[name] = {actual, residuals, ...stats(residuals)};
  }

  function crestEdges(mesh, radius) {
    const g = mesh.geometry, p = g.attributes.position, n = g.attributes.normal;
    const at = i => new THREE.Vector3().fromBufferAttribute(p, i);
    const index = i => g.index ? g.index.getX(i) : i;
    const edges = [], seen = new Set();
    for (let i = 0; i < (g.index?.count ?? p.count); i += 3) {
      const ids = [index(i), index(i + 1), index(i + 2)];
      const ny = ids.reduce((s, j) => s + n.getY(j), 0) / 3;
      if (Math.abs(ny) < .5) continue; // exclude the cylindrical crest surface
      for (let j = 0; j < 3; j++) {
        const a = at(ids[j]), b = at(ids[(j + 1) % 3]);
        if ([a, b].some(v => Math.abs(Math.hypot(v.x, v.z) - radius) > 1e-6 || v.z < -1e-7)) continue;
        if (Math.abs(a.x - b.x) < 1e-8 || Math.abs(a.y - b.y) < 1e-8) continue;
        const key = [a.toArray().join(','), b.toArray().join(',')].sort().join('/');
        if (seen.has(key)) continue;
        seen.add(key);
        const raster = v => {v.applyMatrix4(mesh.matrixWorld); return [f.axis[0] + 100 * v.x, f.axis[1] - 100 * v.y];};
        edges.push({a: raster(a), b: raster(b), face: ny > 0 ? 0 : 1});
      }
    }
    assert(edges.length);
    return edges;
  }
  const threads = {};
  for (const name of ['lead', 'work']) {
    const segments = crestEdges(parts[name === 'lead' ? 'leadThread' : 'workpiece'], name === 'lead' ? f.crestRadius : f.workRadius);
    const rows = measured.threads[name].points.map(reading => {
      const [x, y] = reading.point;
      const hits = segments.filter(s => s.face === reading.face && x >= Math.min(s.a[0], s.b[0]) && x <= Math.max(s.a[0], s.b[0]))
        .map(s => s.a[1] + (x - s.a[0]) * (s.b[1] - s.a[1]) / (s.b[0] - s.a[0]));
      assert(hits.length, `${name} ${reading.point}`);
      // Retain the manually assigned source turn on the lead. Work threads
      // have a different hand and count, so only a nearest-edge metric applies.
      const target = name === 'lead' ? measured.threads.lead.parameters[0] + reading.turn * 100 * f.pitch + reading.face * 100 * f.width : y;
      const actual = hits.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
      return {...reading, actual, residual: actual - y};
    });
    threads[name] = {rows, segments, ...stats(rows.map(r => r.residual))};
  }
  const report = {sources, edges, threads,
    allEdges: stats(Object.values(edges).flatMap(e => e.residuals)),
    qualification: 'Orthographic mesh projection in the initial source pose. Frame/shaft edges use actual extents. Lead shoulders retain manually assigned turns; exposed work shoulders use nearest edges because the gear ratio requires a different hand and pitch. Thread metrics do not account for occlusion by the carriage. They do not qualify an exact source overlay.'};
  verifyStudySources(sources);
  fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log({allEdges: report.allEdges, threads: Object.fromEntries(Object.entries(threads).map(([k, v]) => [k, {count: v.count, rms: v.rms, maximum: v.maximum}]))});
} finally {
  disposeObject3D(visual.root);
}
