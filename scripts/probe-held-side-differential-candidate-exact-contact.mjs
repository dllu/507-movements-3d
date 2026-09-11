import { writeFile } from 'node:fs/promises';
import { makeHeldSideDifferentialCandidate } from '../artifacts/review/061-candidate-model.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';
const model = makeHeldSideDifferentialCandidate(), { parts, geometry: p, motion } = model.root.userData;
const trees = Object.fromEntries(Object.entries(parts).map(([name, mesh]) => [name, triangleTree(mesh.geometry)]));
const rows = [], lower = ['loosePulley', 'directPulley', 'carrierPulley'];
const check = (a, b, time, kind) => {
  model.update(time); model.root.updateMatrixWorld(true);
  const result = meshPairDistance(trees[a], trees[b], parts[b].matrixWorld.clone().invert().multiply(parts[a].matrixWorld), 0.01);
  rows.push({ a, b, time, kind, ...result });
  console.log(JSON.stringify({ a, b, time, kind, distance: result.distance }));
};
for (let stage = 0; stage < 4; stage += 1) {
  const time = stage * p.stageDuration + 0.731, state = motion.atTime(time);
  check('belt', 'driverDrum', time, 'belt-contact'); check('belt', lower[state.selected], time, 'belt-contact');
  const shiftTime = stage * p.stageDuration + p.dwellDuration + p.shiftDuration / 2;
  check('belt', lower[state.selected], shiftTime, 'belt-contact'); check('belt', lower[state.next], shiftTime, 'belt-contact');
}
check('frictionBand', 'brakeDrum', 0, 'brake-contact');
for (const time of [0, 0.811, 5.3, 7.91]) for (const [a, b] of [
  ['outputShaft', 'loosePulley'], ['outputShaft', 'brakeGearBody'], ['brakeGearBody', 'carrierPulley'],
  ['planetSpindle', 'planetBody'], ['innerSpindleCollar', 'planetBody'], ['outerSpindleCollar', 'planetBody'],
  ['carrierPulley', 'planetTeeth'], ['carrierPulley', 'brakeGearTeeth'], ['outputShaft', 'planetSpindle'],
  ['outputShaft', 'planetBody'], ['frictionBand', 'carrierPulley'],
]) check(a, b, time, 'hardware-clearance');
await writeFile('artifacts/review/061-candidate-exact-contact.json', JSON.stringify({
  method: 'Actual Float32 triangle distances including vertex/face, edge/edge and segment/face intersection. Belt and brake contacts require actual positive working gaps. Hardware rows are exact below 0.01 and otherwise certify a 0.01 lower bound, including previously crossed shafts and carrier bearings.', rows,
}, null, 2) + '\n');
const issues = rows.filter(row => row.kind === 'hardware-clearance' ? row.distance < 1e-6
  : !row.witness || row.distance < 0.00012 || row.distance > 0.00020);
console.log(JSON.stringify({ rows: rows.length, issues })); if (issues.length) process.exitCode = 1;
