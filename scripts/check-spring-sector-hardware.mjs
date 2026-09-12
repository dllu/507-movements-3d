import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringSectorCandidate, THREE} from './lib/spring-sector-candidate.mjs';
import {boundSpringSectorHardware} from './lib/spring-sector-hardware-bounds.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-hardware-travel-bounds';
const model = makeSpringSectorCandidate(), bounds = boundSpringSectorHardware(model);
// An off-center guide rod must fail the actual housing bore check. Restore
// it before any later use of this model; the failing report is retained.
const rod = model.root.userData.parts.frontGuideRod0, original = rod.position.x;
rod.position.x += .02;
const negative = boundSpringSectorHardware(model); rod.position.x = original; model.setState();
assert(!negative.passed, 'An off-center guide was incorrectly certified');
assert(negative.unresolved.some(p => p.method === 'slider-round-bore'));
assert.throws(() => boundSpringSectorHardware(model, {liftRange: [NaN, .18]}));
assert.equal(bounds.meshes, 67); assert.equal(bounds.distinctFamilyPairs, 1280);
assert.equal(bounds.primaryPairs.length, 82);
// Independent checks against rendered BufferGeometry at domain corners and
// interior states catch transform/envelope mistakes. The interval argument
// above, rather than these samples, supplies continuous clearance.
const poses = [];
for (const shaftAngle of [-.22, 0, .22]) for (const a of [-.06, .18]) for (const b of [-.06, .18])
  poses.push({shaftAngle, wheelAngle: 1.234, lifts: [a, b]});
for (let i = 0; i <= 32; i++) poses.push({shaftAngle: .22 * Math.cos(2 * Math.PI * i / 32),
  wheelAngle: i * .314, lifts: [.06 + .12 * Math.sin(2 * Math.PI * i / 32), .06 + .12 * Math.cos(2 * Math.PI * i / 32)]});
let minimumEnvelopeSlack = Infinity, checkedVertices = 0;
const p = new THREE.Vector3();
for (const pose of poses) {
  model.setState(pose);
  const c = Math.cos(pose.shaftAngle), s = Math.sin(pose.shaftAngle);
  for (const [name, box] of Object.entries(bounds.envelopes)) {
    const mesh = model.root.userData.parts[name], positions = mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      p.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      const shaftPoint = [c * p.x + s * p.y, -s * p.x + c * p.y, p.z]; checkedVertices++;
      for (let axis = 0; axis < 3; axis++) minimumEnvelopeSlack = Math.min(minimumEnvelopeSlack,
        shaftPoint[axis] - box[axis][0], box[axis][1] - shaftPoint[axis]);
    }
  }
}
assert(minimumEnvelopeSlack >= -bounds.roundoff);
model.setState();
const files = ['scripts/check-spring-sector-hardware.mjs', 'scripts/lib/spring-sector-hardware-bounds.mjs',
  'scripts/lib/spring-sector-candidate.mjs', 'scripts/lib/spring-sector-source.mjs', 'scripts/lib/spring-sector-linkage.mjs',
  'scripts/lib/spring-rack-coil.mjs', 'tests/helpers/solid-surface.mjs', 'src/simulation/finite-plate-geometry.js',
  'src/simulation/clutch-section-geometry.js', 'src/simulation/primitives.js'];
const sources = files.map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report = {movement: 83, status: 'continuous-hardware-travel-bounds', productionChanged: false, mechanicsPassed: false,
  ...bounds, envelopeScreen: {poses: poses.length, checkedVertices, minimumEnvelopeSlack},
  negativeControl: {passed: false, displacement: .02, unresolved: negative.unresolved}, sources};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({passed: report.passed, pairs: report.boundedPairs, counts: report.counts, springs: report.springs,
  minimumMargin: report.minimumMargin, unresolved: report.unresolved});
if (!report.passed) process.exitCode = 1;
