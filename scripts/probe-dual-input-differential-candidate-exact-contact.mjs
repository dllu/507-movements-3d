import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeDualInputDifferentialCandidate } from '../artifacts/review/062-candidate-model.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';
import { surfaceTriangles } from '../tests/helpers/solid-surface.mjs';

const model = makeDualInputDifferentialCandidate(), { parts, geometry: p, motion } = model.root.userData;
const rows = [], lower = ['loosePulley', 'directPulley', 'carrierPulley'];
for (const configuration of ['open', 'crossed']) {
  model.root.userData.setConfiguration(configuration);
  const trees = Object.fromEntries(Object.entries(parts).map(([name, mesh]) => [name, triangleTree(mesh.geometry)]));
  const check = (a, b, time, kind) => {
    model.update(time); model.root.updateMatrixWorld(true);
    const result = meshPairDistance(trees[a], trees[b], parts[b].matrixWorld.clone().invert().multiply(parts[a].matrixWorld), 0.01);
    rows.push({ configuration, a, b, time, kind, ...result });
    console.log(JSON.stringify({ configuration, a, b, time, kind, distance: result.distance }));
  };
  for (let stage = 0; stage < 4; stage += 1) {
    const time = p.stageStarts[stage] + p.dwellDurations[stage] * 0.417, state = motion.atTime(time, configuration);
    check('belt', 'driverDrum', time, 'belt-contact'); check('belt', lower[state.selected], time, 'belt-contact');
    check('sideBelt', 'sideDriverDrum', time, 'belt-contact'); check('sideBelt', 'sidePulley', time, 'belt-contact');
    const shiftTime = p.stageStarts[stage] + p.dwellDurations[stage] + p.shiftDuration / 2;
    check('belt', lower[state.selected], shiftTime, 'belt-contact'); check('belt', lower[state.next], shiftTime, 'belt-contact');
  }
  for (const time of [0, 0.811, 2.5, 6.0]) for (const [a, b] of [
    ['outputShaft', 'loosePulley'], ['outputShaft', 'sideGearBody'], ['sideGearBody', 'carrierPulley'],
    ['planetSpindle', 'planetBody'], ['innerSpindleCollar', 'planetBody'], ['outerSpindleCollar', 'planetBody'],
    ['carrierPulley', 'planetTeeth'], ['carrierPulley', 'sideGearTeeth'], ['outputShaft', 'planetSpindle'],
    ['outputShaft', 'planetBody'], ['sidePulley', 'carrierPulley'], ['sideBelt', 'planetTeeth'],
  ]) check(a, b, time, 'hardware-clearance');
  if (configuration !== 'crossed') continue;
  const mesh = parts.sideBelt, { curve, segments } = mesh.userData;
  const geometry = mesh.geometry, faces = surfaceTriangles(geometry), lengths = curve.getCurveLengths();
  const spanFaces = [[], []];
  for (const [i, face] of faces.entries()) {
    const rings = [0, 1, 2].map(j => Math.floor(geometry.index.getX(3 * i + j) / 2) % (segments + 1));
    const u = (Math.min(...rings) + Math.max(...rings)) / (2 * segments);
    const distance = curve.getUtoTmapping(u) * lengths.at(-1);
    const component = lengths.findIndex(end => distance <= end);
    if (component === 0 || component === 2) spanFaces[component / 2].push(face);
  }
  const spanTrees = spanFaces.map(faces => triangleTree(new THREE.BufferGeometry().setFromPoints(
    faces.flatMap(({ a, b, c }) => [a, b, c]))));
  rows.push({ configuration, a: 'sideBelt-first-free-span', b: 'sideBelt-second-free-span',
    kind: 'crossover-clearance', triangles: spanFaces.map(faces => faces.length),
    ...meshPairDistance(spanTrees[0], spanTrees[1], new THREE.Matrix4(), 0.5) });
}
await writeFile('artifacts/review/062-candidate-exact-contact.json', JSON.stringify({
  method: 'Actual Float32 triangle distances including vertex/face, edge/edge and segment/face intersection. Both installed configurations cover selector dwell/shift contacts and critical independent hardware. Crossed free-span triangles are selected by their actual longitudinal mesh indices and path component, preserving both entire spans. Hardware values at 0.01 without a witness certify that lower bound.', rows,
}, null, 2) + '\n');
const issues = rows.filter(row => row.kind === 'belt-contact'
  ? !row.witness || row.distance < 0.00012 || row.distance > 0.00020
  : row.kind === 'crossover-clearance' ? !row.witness || row.distance < 0.00015 : row.distance < 1e-6);
console.log(JSON.stringify({ rows: rows.length, issues })); if (issues.length) process.exitCode = 1;
