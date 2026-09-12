import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeSelectorRackCandidate} from './lib/selector-rack-candidate.mjs';
import {makeSelectorRackContact, triangleFootprint, horizontalTriangleInterval} from './lib/selector-rack-contact.mjs';
import {freezeStudySources} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/084-first-contact-path';
const a = triangleFootprint([[0, 0], [1, 0], [0, 1]]), b = triangleFootprint([[2, 0], [3, 0], [2, 1]]);
const known = horizontalTriangleInterval(a, b); assert.equal(known.enter, 1); assert.equal(known.leave, 3);
assert.equal(horizontalTriangleInterval(triangleFootprint([[0, 2], [1, 2], [0, 3]]), b), null);
assert.equal(horizontalTriangleInterval(a, b, [-1, 0]), null);
const model = makeSelectorRackCandidate(), u = model.root.userData, contact = makeSelectorRackContact(model);
const runs = [];
const cases = JSON.parse(process.env.PROBE_CASES ?? '[["neutral",-0.0125,0,0],["lower",0.08333333333333333,0,0],["upper",-0.11666666666666667,-3.141592653589793,0]]');
for (const [name, y, startAngle, initialX] of cases) {
  const rows = [], failures = []; let x = initialX, maximumCorrection = 0, checkedPairs = 0, excludedPairs = 0;
  for (let i = 0; i <= 720; i++) {
    const angle = startAngle - i * 2 * Math.PI / 720, result = contact.allowedAt(angle, y);
    checkedPairs += result.checkedPairs; excludedPairs += result.excludedPairs;
    if (!result.allowed.length) {failures.push({index: i, angle, previousX: x, reason: 'No horizontal pose within suspension slots', intervals: result.intervals}); break;}
    const choices = result.allowed.map(([low, high]) => Math.max(low, Math.min(high, x)));
    const next = choices.reduce((a, b) => Math.abs(a - x) <= Math.abs(b - x) ? a : b), correction = next - x;
    if (i === 0 && Math.abs(correction) > 1e-9) {failures.push({index: i, angle, previousX: x, reason: 'Selected starting pose already overlaps the cam', correction}); break;}
    maximumCorrection = Math.max(maximumCorrection, Math.abs(correction)); x = next;
    rows.push({index: i, angle, x, correction, allowed: result.allowed,
      contactBoundary: result.intervals.filter(r => Math.min(Math.abs(x - r.enter), Math.abs(x - r.leave)) < 1e-9)
        .map(r => Math.abs(x - r.enter) < Math.abs(x - r.leave) ? {side: 'left', ...r.enterWitness} : {side: 'right', ...r.leaveWitness})});
  }
  runs.push({name, y, startAngle, initialX, rows, failures, finalX: x, displacementPixels: (x - initialX) * u.source.scale,
    maximumCorrectionPixels: maximumCorrection * u.source.scale, checkedPairs, excludedPairs,
    largeCorrections: rows.filter(r => Math.abs(r.correction) * u.source.scale > 10).map(r => ({index: r.index, angle: r.angle, correctionPixels: r.correction * u.source.scale})),
    animationQualified: false});
}
const sources = freezeStudySources(['scripts/study-selector-rack-contact-path.mjs', 'scripts/lib/selector-rack-contact.mjs',
  'scripts/lib/selector-rack-candidate.mjs', 'scripts/lib/selector-rack-source.mjs', 'scripts/lib/conforming-plate-mesh.mjs',
  'scripts/lib/study-report-io.mjs', 'src/simulation/finite-plate-geometry.js', 'src/simulation/clutch-section-geometry.js',
  'src/simulation/primitives.js', 'tests/helpers/solid-surface.mjs'], prefix);
const report = {movement: 84, status: 'sampled-geometric-cam-rack-path-experiment', productionChanged: false, mechanicsPassed: false,
  candidateIntegrated: false, cells: {frame: contact.frame.length, cam: contact.cam.length}, camRadius: contact.radius, suspensionRange: contact.range,
  controlsPassed: true, runs, sources,
  qualification: 'Actual cap triangles define forbidden horizontal translations using convex SAT and interval union. At each sampled angle the previous x is projected to the nearest allowed component. This diagnoses geometry and slot travel; it is not inertial motion, a continuous path certificate, a no-teleportation proof or an admissible contact-force solution. Starting overlap and loss of all allowed positions are explicit failures.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, sources: undefined, runs: runs.map(({rows, ...r}) => ({...r, states: rows.length}))});
