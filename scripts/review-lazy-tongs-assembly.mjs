import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createMovementModel } from '../src/simulation/registry.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';
const catalog = JSON.parse(fs.readFileSync('src/data/movements.json'));
const model = createMovementModel(catalog.movements[143]);
try {
  const b = model.root.userData.blocks, parts = [], cache = new Map();
  const bodies = [b.fixedFrame, b.leftOutputAssembly, b.rightInputAssembly,
    ...b.links, ...b.movingCrossCenterPins, ...b.intermediateJointPins.flatMap(p => [p.top, p.bottom])];
  for (const [bodyIndex, body] of bodies.entries()) body.traverseVisible(mesh => {
    if (!mesh.isMesh) return;
    if (!cache.has(mesh.geometry)) cache.set(mesh.geometry, {
      solid: solidSurface(mesh.geometry), points: surfacePoints(mesh.geometry),
    });
    parts.push({ ...cache.get(mesh.geometry), mesh, bodyIndex,
      name: mesh.userData.role ?? `${body.userData.role}/${mesh.name}` });
  });
  const pairs = [];
  for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++)
    if (parts[i].bodyIndex !== parts[j].bodyIndex) pairs.push([parts[i], parts[j]]);
  const poses = Number(process.env.POSES ?? 65), failures = {};
  let checks = 0;
  for (let pose = 0; pose < poses; pose++) {
    // Sample opening phase, including both reversals, rather than miss
    // the most folded state with a uniform offset in presentation time.
    model.update(model.root.userData.timeAtCyclePhase(pose / (2 * (poses - 1))));
    model.root.updateMatrixWorld(true);
    for (const p of parts) p.box = p.solid.box.clone().applyMatrix4(p.mesh.matrixWorld);
    for (const [a, b] of pairs) {
      if (!a.box.intersectsBox(b.box)) continue;
      for (const [from, to] of [[a,b],[b,a]]) {
        const transform = to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
        for (const p of from.points) {
          const q = p.clone().applyMatrix4(transform); checks++;
          if (!to.solid.inside(q)) continue;
          const depth = to.solid.distance(q); if (depth < 1e-6) continue;
          const key = a.name + ' / ' + b.name;
          const entry = failures[key] ?? { firstPose: pose, points: 0, maximumDepth: 0 };
          entry.points++; entry.maximumDepth = Math.max(entry.maximumDepth, depth); failures[key] = entry;
        }
      }
    }
    console.log({ pose, checks, failingPairs: Object.keys(failures).length });
  }
  const sources = ['scripts/review-lazy-tongs-assembly.mjs', 'src/simulation/authored-linkages.js',
    'src/simulation/bored-scissor-link.js', 'src/simulation/finite-plate-geometry.js', 'tests/helpers/solid-surface.mjs'];
  const report = { movement: 144, method: 'Bidirectional actual vertices, edge midpoints and face centers against oriented mesh solids. All visible parts, excluding same rigid body joins. Half-cycle covers every configuration of the reversible linkage, including both stroke limits. This is a sampled check, not a continuous swept-volume proof.',
    sources: sources.map(file => ({ file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') })),
    summary: { poses, parts: parts.length, pairs: pairs.length, checks, failingPairs: Object.keys(failures).length }, failures };
  fs.writeFileSync(process.env.REPORT ?? '/dev/shm/144-assembly.json', JSON.stringify(report, null, 2) + '\n');
  console.log(report.summary);
} finally { disposeObject3D(model.root); }
