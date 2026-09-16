// Read-only local phase feasibility; this does not supply a complete drive law.
import { createAuthoredIntermittentMovement as create } from '../src/simulation/authored-intermittent.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';
import { polygonClipping as clip } from '../src/simulation/finite-plate-geometry.js';

const model = create({ id: 212 });
const { geometry: g, blocks: b } = model.root.userData;
const inputAngle = g.normalIndexInputAngle / 2;
const nominalOutput = -g.stopStepAngle / 2;
const pairs = [[b.driverBody, b.stopWheelBody], [b.stopWheelBody, b.driverBody]]
  .map(([part, target]) => ({ part, target, points: surfacePoints(part.geometry), field: solidSurface(target.geometry) }));
function measure(offset) {
  b.driver.userData.rotor.rotation.z = inputAngle;
  b.stopWheel.userData.rotor.rotation.z = nominalOutput + offset;
  model.root.updateMatrixWorld(true);
  let minimumGap = Infinity;
  let witness;
  for (const { part, target, points, field } of pairs) {
    const transform = target.matrixWorld.clone().invert().multiply(part.matrixWorld);
    for (const point of points) {
      const local = point.clone().applyMatrix4(transform);
      const gap = field.signedDistance(local, 0.1);
      if (gap < minimumGap) {
        minimumGap = gap;
        witness = { part: part.userData.role, target: target.userData.role, targetLocalPoint: local.toArray() };
      }
    }
  }
  return { offset, outputAngle: nominalOutput + offset, minimumGap, witness };
}
const baseline = measure(0);
let best = baseline;
for (const radius of [0.002, 0.000125, 0.0000078125, 0.00000048828125]) {
  const center = best.offset;
  for (let i = 0; i <= 32; i++) {
    const candidate = measure(center - radius + 2 * radius * i / 32);
    if (candidate.minimumGap > best.minimumGap) best = candidate;
  }
}
const transform = (points, angle, center) => [[points.map(p => [
  center.x + p.x * Math.cos(angle) - p.y * Math.sin(angle),
  center.y + p.x * Math.sin(angle) + p.y * Math.cos(angle),
])]];
const intersection = clip.intersection(transform(g.driverOutline, inputAngle, g.driverCenter),
  transform(g.stopWheelOutline, best.outputAngle, g.stopWheelCenter));
const intersectionArea = intersection.reduce((sum, polygon) => sum + polygon.reduce((value, ring, hole) =>
  value + (hole ? -1 : 1) * Math.abs(ring.reduce((area, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return area + p[0] * q[1] - p[1] * q[0];
  }, 0) / 2), 0), 0);
console.log(JSON.stringify({
  scope: 'One midstroke pose; bidirectional actual mesh surface samples plus closed planar polygon intersection. No full-cycle/contact-force qualification.',
  inputAngle, baseline, candidate: { ...best, intersectionArea },
}, null, 2));
