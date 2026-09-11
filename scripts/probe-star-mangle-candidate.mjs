import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { starMangleMotion } from '../src/simulation/star-mangle-motion.js';
import { starMangleLoadedMotion } from '../src/simulation/star-mangle-contact-motion.js';
import { boredSpurGeometry } from '../src/simulation/jaw-clutch-geometry.js';
import { radialToothGeometry } from './lib/star-mangle-cutter.mjs';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

const data = JSON.parse(await readFile(process.env.PROFILE_INPUT ?? 'artifacts/review/054-candidate-profiles.json', 'utf8'));
const motion = starMangleMotion(data.parameters), p = motion.parameters;
const loaded = process.env.MAP_INPUT ? starMangleLoadedMotion(JSON.parse(await readFile(process.env.MAP_INPUT, 'utf8'))) : null;
const pinion = boredSpurGeometry({ teeth: p.pinionTeeth, module: p.module, depth: data.pinionDepth, boreRadius: 0.04,
  pressureAngle: p.pinionPressureAngle, profileShift: p.pinionProfileShift, addendumCoefficient: p.pinionAddendumCoefficient });
const solid = solidSurface(pinion), pinionPoints = surfacePoints(pinion), sampleCache = new Map(), profiles = new Map(data.teeth.map((v) => [v.toothIndex, v]));
const generic = profiles.get(Math.floor(p.toothCount / 2));
const teeth = Array.from({ length: p.toothCount }, (_, index) => {
  const profile = profiles.get(index) ?? generic;
  if (!sampleCache.has(profile)) {
    const geometry = radialToothGeometry(profile, { outerRadius: 1.78 });
    sampleCache.set(profile, { geometry, points: surfacePoints(geometry), solid: solidSurface(geometry) });
  }
  return { index, theta: p.firstTerminal + index * p.wheelPitch, ...sampleCache.get(profile) };
});
const phases = [];
const steps = Number(process.env.PROBE_STEPS ?? 128);
// Include both complete strokes and densely sample both short crossovers.
for (let i = 0; i <= steps; i += 1) phases.push(p.cycleTravel * (i + 0.371) / (steps + 1));
for (const start of [p.runTravel, p.returnStart]) for (let i = 0; i <= steps; i += 1) phases.push(start + Math.PI * (i + 0.613) / (steps + 1));
const report = { status: 'candidate', scope: 'Actual radial-loft and closed involute pinion vertices, edge midpoints and triangle centers in both directions; unused in production. Independent phases, including both crossovers. Rims, crab and shafts belong to the separate hardware probe.',
  contactMap: process.env.MAP_INPUT ?? null, poses: phases.length, surfaceChecks: 0, penetratingSamples: 0, maximumDepth: 0, maximumNearestGap: 0, branches: {}, toothPenetration: {}, witness: null, gapWitness: null };
for (const [i, travel] of phases.entries()) {
  const state = loaded ? loaded.atInputTravel(loaded.inputAtPath(travel)) : motion.atTravel(travel);
  const pinionMatrix = new THREE.Matrix4().makeTranslation(0, state.centerY, state.centerZ)
    .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationZ(state.pinionAngle)).invert();
  const branch = report.branches[state.branch] ??= { poses: 0, checks: 0, inside: 0, maximumNearestGap: 0 };
  branch.poses += 1; let nearest = 0.02;
  for (const tooth of teeth) {
    const transform = pinionMatrix.clone().multiply(new THREE.Matrix4().makeRotationZ(state.wheelAngle + tooth.theta));
    if (!tooth.geometry.boundingBox.clone().applyMatrix4(transform).intersectsBox(solid.box)) continue;
    for (const v of tooth.points) {
      const q = v.clone().applyMatrix4(transform); report.surfaceChecks += 1; branch.checks += 1;
      const inside = solid.inside(q);
      if (!inside) { nearest = Math.min(nearest, solid.distance(q, nearest)); continue; }
      const depth = solid.distance(q);
      if (depth < 1e-6) continue;
      report.penetratingSamples += 1; branch.inside += 1;
      const toothReport = report.toothPenetration[tooth.index] ??= { samples: 0, maximumDepth: 0, witness: null };
      toothReport.samples += 1;
      if (depth > toothReport.maximumDepth) { toothReport.maximumDepth = depth; toothReport.witness = { travel, branch: state.branch, localPoint: v.toArray() }; }
      if (depth > report.maximumDepth) {
        report.maximumDepth = depth;
        report.witness = { travel, branch: state.branch, tooth: tooth.index, localPoint: v.toArray(), pinionPoint: q.toArray() };
      }
    }
    const inverse = transform.clone().invert();
    for (const v of pinionPoints) {
      const q = v.clone().applyMatrix4(inverse); report.surfaceChecks += 1; branch.checks += 1;
      if (!tooth.solid.inside(q)) { nearest = Math.min(nearest, tooth.solid.distance(q, nearest)); continue; }
      const depth = tooth.solid.distance(q); if (depth < 1e-6) continue;
      report.penetratingSamples += 1; branch.inside += 1;
      if (depth > report.maximumDepth) { report.maximumDepth = depth;
        report.witness = { travel, branch: state.branch, tooth: tooth.index, direction: 'pinion-to-wheel', pinionPoint: v.toArray(), localPoint: q.toArray() }; }
    }
  }
  branch.maximumNearestGap = Math.max(branch.maximumNearestGap, nearest);
  if (nearest > report.maximumNearestGap) { report.maximumNearestGap = nearest; report.gapWitness = { travel, branch: state.branch }; }
  if (i % 32 === 0) console.log(JSON.stringify({ progress: i / phases.length, checks: report.surfaceChecks, inside: report.penetratingSamples }));
}
await writeFile(process.env.PROBE_OUTPUT ?? 'artifacts/review/054-candidate-contact.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
