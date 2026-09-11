import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import assert from 'node:assert/strict';
import { solidSurface, surfacePoints, surfaceTriangles } from '../tests/helpers/solid-surface.mjs';

// Historical 062 baseline: both differential mesh pairs, both directions, one relative planet-tooth pitch for each installed belt orientation.
const catalog = JSON.parse(await readFile('src/data/movements.json'));
const model = createMovementModel(catalog.movements[61]), { geometry: p, blocks: b } = model.root.userData;
const intervals = Number(process.env.BEVEL_CONTACT_STEPS ?? 64);
const gears = [b.outputSideGear, b.sideInputGear, b.planet];
let zeroAreaFacesExcluded = 0;
const usableSkin = (geometry) => {
  const triangles = surfaceTriangles(geometry), usable = triangles.filter((triangle) => triangle.getArea() > 1e-20);
  zeroAreaFacesExcluded += triangles.length - usable.length;
  // The old solid gear's zero-radius bore contributes collapsed faces.
  // They have no surface area, but make nearest-triangle distances NaN.
  return new THREE.BufferGeometry().setFromPoints(usable.flatMap(({ a, b, c }) => [a, b, c]));
};
const surfaces = new Map(gears.map((gear) => [gear, {
  body: solidSurface(usableSkin(gear.userData.body.geometry)),
  tooth: solidSurface(usableSkin(gear.userData.toothMeshes[0].geometry)),
  points: surfacePoints(gear.userData.toothMeshes[0].geometry),
  pitch: 2 * Math.PI / gear.userData.toothMeshes.length,
}]));
const report = { movement: 62, poses: 2 * (intervals + 1), surfaceChecks: 0,
  penetratingSamples: 0, minimumSignedDistance: Infinity, maximumPairGap: 0,
  witness: null, zeroAreaFacesExcluded, scope: 'Rendered bevel tooth skins against the mating teeth and body. Zero-area collapsed faces are excluded. Distances above 0.03 are capped; clutch and selector parts are not included.' };
const pairs = [[b.outputSideGear, b.planet], [b.planet, b.outputSideGear], [b.sideInputGear, b.planet], [b.planet, b.sideInputGear]];
for (const stage of [1, 5]) for (let pose = 0; pose <= intervals; pose += 1) {
  // Actual stage deltas differ between open and crossed side input.
  // Invert the dwell to advance exactly one full relative planet-tooth pitch.
  const progress = (2 * Math.PI / p.planetTeeth) / p.stageDeltas[stage].planet * pose / intervals;
  assert.ok(progress >= 0 && progress <= 1);
  let low = 0, high = 1;
  for (let step = 0; step < 50; step += 1) {
    const u = (low + high) / 2;
    if (u * u * (3 - 2 * u) < progress) low = u; else high = u;
  }
  model.update(p.stageStarts[stage] + p.dwellDuration * (low + high) / 2);
  model.root.updateMatrixWorld(true);
  for (const [pairIndex, [source, target]] of pairs.entries()) {
    const from = surfaces.get(source), to = surfaces.get(target);
    const inverse = target.userData.rotor.matrixWorld.clone().invert(); let pairGap = Infinity;
    for (const mesh of source.userData.toothMeshes) {
      const transform = inverse.clone().multiply(mesh.matrixWorld);
      for (const local of from.points) {
        const point = local.clone().applyMatrix4(transform); report.surfaceChecks += 1;
        let gap = 0.03;
        if (to.body.box.distanceToPoint(point) < gap) gap = Math.min(gap, to.body.signedDistance(point, gap));
        const index = Math.round(Math.atan2(point.y, point.x) / to.pitch);
        for (const offset of [-1, 0, 1]) {
          const angle = -(index + offset) * to.pitch, cosine = Math.cos(angle), sine = Math.sin(angle);
          const q = new THREE.Vector3(cosine * point.x - sine * point.y, sine * point.x + cosine * point.y, point.z);
          if (to.tooth.box.distanceToPoint(q) > 0.03) continue;
          gap = Math.min(gap, to.tooth.signedDistance(q, Math.max(0.03, gap)));
        }
        assert.ok(Number.isFinite(gap), 'every sampled distance must be finite');
        if (gap < -1e-7) report.penetratingSamples += 1;
        if (gap < report.minimumSignedDistance) {
          report.minimumSignedDistance = gap; report.witness = { stage, pose, pairIndex, targetPoint: point.toArray() };
        }
        pairGap = Math.min(pairGap, gap);
      }
    }
    report.maximumPairGap = Math.max(report.maximumPairGap, pairGap);
  }
}
await writeFile('artifacts/review/062-bevel-contact-baseline.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
