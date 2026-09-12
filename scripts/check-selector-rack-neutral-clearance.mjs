import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeSelectorRackCandidate} from './lib/selector-rack-candidate.mjs';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
import {freezeStudySources, readStudyReport, verifyStudySources} from './lib/study-report-io.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/084-neutral-cam-clearance';
const screenFile = 'artifacts/review/084-supported-candidate-surfaces.json', screen = readStudyReport(screenFile);
verifyStudySources(screen.sources); assert(screen.passed && screen.topology.every(p => p.closed));
const model = makeSelectorRackCandidate(), u = model.root.userData;
const domain = {rackX: u.geometry.limits.rackX, selectorY: [-4 / 240, -2 / 240], camAngle: 'all real angles'};
const frame = u.parts.slottedRackFrame, triangles = surfaceTriangles(frame.geometry);
const roundingAllowance = 1e-7, bounds = triangles.map((triangle, index) => {
  const points = [triangle.a, triangle.b, triangle.c];
  const low = [Math.min(...points.map(p => p.x)) + domain.rackX[0], Math.min(...points.map(p => p.y)) + domain.selectorY[0]];
  const high = [Math.max(...points.map(p => p.x)) + domain.rackX[1], Math.max(...points.map(p => p.y)) + domain.selectorY[1]];
  const nearest = low.map((v, i) => v > 0 ? v : high[i] < 0 ? high[i] : 0);
  return {index, low, high, minimumRadius: Math.hypot(...nearest)};
});
const minimumFrameRadius = Math.min(...bounds.map(b => b.minimumRadius)), pairs = [];
frame.geometry.computeBoundingBox();
for (const name of ['singleWorkingCam', 'camHub', 'wheelHub', 'fixedCamAxle', 'fullCurvedSpokeWheel']) {
  const mesh = u.parts[name]; assert(mesh.position.length() === 0 && [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z].every(v => v === 0));
  mesh.geometry.computeBoundingBox();
  const a = frame.geometry.boundingBox, b = mesh.geometry.boundingBox;
  const axialGap = Math.max(a.min.z - b.max.z, b.min.z - a.max.z);
  if (axialGap > roundingAllowance) {pairs.push({a: frame.name, b: name, method: 'unchanged axial layers', margin: axialGap - roundingAllowance}); continue;}
  const p = mesh.geometry.attributes.position; let maximumRadius = 0;
  for (let i = 0; i < p.count; i++) maximumRadius = Math.max(maximumRadius, Math.hypot(p.getX(i), p.getY(i)));
  const margin = minimumFrameRadius - maximumRadius - roundingAllowance; assert(margin > 0);
  pairs.push({a: frame.name, b: name, method: 'swept frame triangle boxes outside rotating body cylinder', maximumRadius, margin});
}
const sources = freezeStudySources([screenFile, 'scripts/check-selector-rack-neutral-clearance.mjs',
  'scripts/lib/selector-rack-candidate.mjs', 'scripts/lib/selector-rack-source.mjs', 'scripts/lib/conforming-plate-mesh.mjs',
  'scripts/lib/study-report-io.mjs', 'tests/helpers/solid-surface.mjs', 'src/simulation/finite-plate-geometry.js',
  'src/simulation/clutch-section-geometry.js', 'src/simulation/primitives.js'], prefix);
const report = {movement: 84, passed: true, mechanicsPassed: false, productionChanged: false, candidateIntegrated: false,
  domain, roundingAllowance, minimumFrameRadius, bounds, pairs, sources,
  qualification: 'For these five pairs only, the complete closed frame boundary projects outside a cylinder enclosing the other solid, or the axial layers are disjoint. Each frame triangle box includes the full continuous translation domain, and rotation preserves every vertex radius. Finite closed solids project through their boundaries, so the same exclusion covers their interiors. This does not qualify the other hardware pairs, selected rack contact, governor transitions, forces or animation.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({domain, triangles: triangles.length, minimumFrameRadius, pairs});
