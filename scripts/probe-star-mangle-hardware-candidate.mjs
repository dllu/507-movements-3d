import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeStarMangleCandidate } from '../artifacts/review/054-candidate-model.mjs';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

const data = JSON.parse(await readFile(process.env.PROFILE_INPUT ?? 'artifacts/review/054-candidate-profiles-fine.json', 'utf8'));
const contactMap = process.env.MAP_INPUT ? JSON.parse(await readFile(process.env.MAP_INPUT, 'utf8')) : null;
const model = makeStarMangleCandidate(data, { contactMap }), p = model.root.userData.geometry, parts = model.root.userData.parts;
const wheelParts = [parts.innerRim, parts.outerRim, parts.hub, parts.shaft, ...parts.spokes,
  ...parts.crabEnds, ...parts.crabReturns, parts.bridge, parts.stem, parts.stemFoot, ...parts.teeth];
const inputParts = [parts.pinion, parts.inputShaft, parts.collar];
for (const [name, value] of Object.entries(parts)) {
  if (Array.isArray(value)) value.forEach((mesh, i) => { mesh.name = `${name}-${i}`; }); else value.name = name;
}
const cache = new Map();
const geometry = (mesh) => {
  if (!cache.has(mesh.geometry)) cache.set(mesh.geometry, { solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry) });
  return cache.get(mesh.geometry);
};
const pairs = [];
for (const wheel of wheelParts) for (const input of inputParts) {
  if (wheel.userData.radialTooth && input === parts.pinion) continue;
  pairs.push([wheel, input], [input, wheel]);
}
const steps = Number(process.env.PROBE_STEPS ?? 32), phases = [];
for (let i = 0; i <= steps; i += 1) phases.push(p.cycleTravel * (i + 0.327) / (steps + 1));
for (const start of [p.runTravel, p.returnStart]) for (let i = 0; i <= steps; i += 1) phases.push(start + Math.PI * (i + 0.437) / (steps + 1));
const report = { status: 'unfinished-candidate', scope: 'Both directions of actual mesh vertices, edge midpoints and face centers between wheel hardware and input assembly. Tooth/pinion pair belongs to the separate tooth probe.',
  contactMap: process.env.MAP_INPUT ?? null, poses: phases.length, surfaceChecks: 0, penetratingSamples: 0, maximumDepth: 0, pairFailures: {}, witness: null,
  guideContact: { poses: 0, maximumNearestGap: 0, minimumNearestGap: Infinity }, guideFaces: {} };
for (const [i, travel] of phases.entries()) {
  model.root.userData.updateTravel(travel); model.root.updateMatrixWorld(true);
  const s = model.root.userData.kinematics; let guideGap = 0.02; const faceGaps = new Map();
  for (const [from, to] of pairs) {
    const source = geometry(from), target = geometry(to), transform = to.matrixWorld.clone().invert().multiply(from.matrixWorld);
    if (!source.solid.box.clone().applyMatrix4(transform).intersectsBox(target.solid.box)) continue;
    const guideContact = [...parts.crabEnds, ...parts.crabReturns].includes(from) && to === parts.collar && s.branch.endsWith('crossover');
    for (const point of source.points) {
      const q = point.clone().applyMatrix4(transform); report.surfaceChecks += 1;
      if (!target.solid.inside(q)) {
        if (guideContact) {
          const gap = target.solid.distance(q, faceGaps.get(from.name) ?? 0.02);
          faceGaps.set(from.name, Math.min(faceGaps.get(from.name) ?? 0.02, gap)); guideGap = Math.min(guideGap, gap);
        }
        continue;
      }
      const depth = target.solid.distance(q); if (depth < 1e-6) continue;
      report.penetratingSamples += 1;
      const key = `${from.name} -> ${to.name}`, pair = report.pairFailures[key] ??= { samples: 0, maximumDepth: 0, witness: null };
      const witness = { travel, branch: s.branch, pair: key, localPoint: point.toArray(), targetPoint: q.toArray() };
      pair.samples += 1; if (depth > pair.maximumDepth) { pair.maximumDepth = depth; pair.witness = witness; }
      if (depth > report.maximumDepth) { report.maximumDepth = depth; report.witness = witness; }
    }
  }
  if (s.branch.endsWith('crossover')) {
    report.guideContact.poses += 1;
    report.guideContact.minimumNearestGap = Math.min(report.guideContact.minimumNearestGap, guideGap);
    report.guideContact.maximumNearestGap = Math.max(report.guideContact.maximumNearestGap, guideGap);
    for (const [name, gap] of faceGaps) {
      if (gap >= 0.001) continue;
      const record = report.guideFaces[name] ??= { poses: 0, minimumGap: Infinity, maximumGap: 0 };
      record.poses += 1; record.minimumGap = Math.min(record.minimumGap, gap); record.maximumGap = Math.max(record.maximumGap, gap);
    }
  }
  if (i % 16 === 0) console.log(JSON.stringify({ progress: i / phases.length, checks: report.surfaceChecks, inside: report.penetratingSamples }));
}
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/054-candidate-hardware.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
