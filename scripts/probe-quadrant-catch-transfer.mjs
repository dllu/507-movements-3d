import fs from 'node:fs';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeQuadrantContactStudy} from '../src/simulation/mujoco-quadrant-catch/contact-study.js';

// Diagnostic, not a qualification gate. Failed candidates must not become bakes.
const output = process.argv[2] ?? '/dev/shm/183-quadrant-contact-study.json';
const selected = process.argv[3];
const cases = [
  ['original-pin-inference', {releaseLead: .04}],
  ['earlier-release', {releaseLead: .12}],
  ['without-upper-pin-retention', {releaseLead: .12, upperRetention: false}],
  ['without-lower-pin-retention', {releaseLead: .12, lowerRetention: false}],
  ['shoe-only', {releaseLead: .12, upperRetention: false, lowerRetention: false}],
].filter(([name]) => !selected || name === selected);
if (!cases.length) throw new Error(`Unknown case ${selected}`);
const mujoco = await loadMujoco();
const results = [];
for (const [name, options] of cases) {
  const physics = makeQuadrantContactStudy(mujoco, {timestep: .0005, ...options});
  const samples = [];
  try {
    for (let step = 0; step <= Math.round(18 / physics.timestep); step++) {
      if (step % 100 === 0) samples.push(physics.state());
      if (step < Math.round(18 / physics.timestep)) physics.step();
    }
    const finalContactPairs = new Map();
    const contacts = physics.data.contact;
    try {
      for (let i = 0; i < physics.data.ncon; i++) {
        const contact = contacts.get(i);
        try {
          const parts = [contact.geom1, contact.geom2].map(id =>
            mujoco.mj_id2name(physics.model, mujoco.mjtObj.mjOBJ_GEOM.value, id)
              .replace(/-cell\d+$/, ''));
          const key = parts.join('/');
          finalContactPairs.set(key, Math.min(contact.dist, finalContactPairs.get(key) ?? Infinity));
        } finally { contact.delete(); }
      }
    } finally { contacts.delete(); }
    const top = samples.reduce((a, b) => Math.abs(a.time - 8) < Math.abs(b.time - 8) ? a : b);
    const final = samples.at(-1);
    const expectedTop = Object.values(physics.geometry.handles).map(handle => handle.fit.angle);
    const topError = top.q.slice(0, 2).map((value, i) => value - expectedTop[i]);
    const bottomError = final.q.slice(0, 2);
    const pistonReturnError = final.q[2] - physics.geometry.start;
    const pistonTopError = top.q[2] - physics.geometry.end;
    const result = {
      name, parameters: physics.parameters, status: 'unqualified-contact-candidate',
      top, final, topError, bottomError, pistonReturnError, pistonTopError,
      minimumHandleAngles: [0, 1].map(index => Math.min(...samples.map(sample => sample.q[index]))),
      finalContactPairs: Object.fromEntries(finalContactPairs),
      completesCandidateEndpoints: topError.every(value => Math.abs(value) < .1)
        && bottomError.every(value => Math.abs(value) < .02) && Math.abs(pistonReturnError) < .03
        && Math.abs(pistonTopError) < .03,
    };
    results.push(result);
    console.log(JSON.stringify(result));
  } finally { physics.dispose(); }
}
const sources = [
  'scripts/probe-quadrant-catch-transfer.mjs',
  'src/simulation/mujoco-quadrant-catch/contact-study.js',
  'src/simulation/mujoco-quadrant-catch/geometry.js',
];
fs.writeFileSync(output, JSON.stringify({
  movements: [183, 184], status: 'unqualified-contact-candidate',
  scope: 'One native cycle with only piston actuation. Selective contact removal diagnoses the inferred pin/rim geometry. This is not the browser model, and a passing endpoint check alone would not qualify it.',
  sources: sources.map(file => ({file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),
  results,
}, null, 2) + '\n');
