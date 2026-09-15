import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeCrossedGovernorSolids} from '../src/simulation/mujoco-crossed-governor/solids.js';

const nativeFile = '/dev/shm/170-settled-cycles.json', native = JSON.parse(fs.readFileSync(nativeFile));
assert.equal(native.report.status, 'unregistered-native-cycle-qualified');
const run = native.runs[1], seam = run.best.index, period = native.report.period;
const startAngle = run.samples[seam].spindle;
const rows = Array.from({length: 961}, (_, i) => {
  const s = run.samples[seam + i];
  return [period * i / 960, s.spindle - startAngle, s.leftSpread, s.rightSpread, s.outputY];
});
let maximumMidpointError = 0;
for (let i = 1; i < 960; i += 2) for (let j = 1; j < 5; j++) {
  maximumMidpointError = Math.max(maximumMidpointError, Math.abs(rows[i][j] - (rows[i - 1][j] + rows[i + 1][j]) / 2));
}
assert.ok(maximumMidpointError < 2e-5, 'Too much motion interpolation error');
const motion = rows.filter((_, i) => i % 2 === 0), v = makeCrossedGovernorSolids();
try {
  const bounds = new THREE.Box3(), state = r => ({spindle: r[1], leftSpread: r[2], rightSpread: r[3], outputY: r[4]});
  for (const row of rows) { v.update(state(row)); bounds.union(new THREE.Box3().setFromObject(v.root, true)); }
  bounds.expandByScalar(.04); v.update(state(rows[0])); v.root.traverse(o => { o.userData = {}; });
  const sources = ['scripts/bake-crossed-governor.mjs', 'scripts/settle-crossed-governor.mjs',
    'src/simulation/mujoco-crossed-governor/physics.js', 'src/simulation/mujoco-crossed-governor/solids.js',
    'src/simulation/mujoco-crossed-governor/update-solids.js', 'src/simulation/mujoco-crossed-governor/bevel-pair.js',
    'src/simulation/bevel-geometry.js', 'src/simulation/finite-plate-geometry.js', 'src/simulation/clutch-section-geometry.js', 'src/simulation/primitives.js']
    .map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
  const bundle = {version: 1, movement: 170, object: v.root.toJSON(), geometry: native.geometry,
    motion, names: ['spindle', 'leftSpread', 'rightSpread', 'outputY'], turns: [6 * Math.PI, 0, 0, 0],
    period, loopStart: 0, loopEnd: period, bounds: {min: bounds.min.toArray(), max: bounds.max.toArray()},
    focus: bounds.getCenter(new THREE.Vector3()).toArray(), cameraDirection: [.01, .01, 15], maximumMidpointError,
    nativeCycleHash: createHash('sha256').update(fs.readFileSync(nativeFile)).digest('hex'),
    assumptions: 'Passive MuJoCo arms, links and axial output driven by one spindle. Inferred masses/damping and ideal bearings. Visible collar represents a nonrotating rod bearing; bearing friction, steam feedback and tooth contact dynamics are omitted. Equal bevel gearing is scripted.', sources};
  const bytes = gzipSync(JSON.stringify(bundle), {level: 9});
  fs.writeFileSync('src/simulation/baked/assets/170.json.gz', bytes);
  fs.writeFileSync('src/simulation/baked/assets/170.provenance.json', JSON.stringify({...bundle, object: undefined, motion: undefined,
    samples: motion.length, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')}, null, 2) + '\n');
  console.log({samples: motion.length, bytes: bytes.length, maximumMidpointError});
} finally { v.dispose(); }
