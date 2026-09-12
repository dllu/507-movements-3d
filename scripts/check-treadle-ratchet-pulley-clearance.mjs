import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeTreadleRatchetCandidate} from './lib/treadle-ratchet-candidate.mjs';
import {makeTreadleRatchetInputBounds} from './lib/treadle-ratchet-input-bounds.mjs';

const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/082-pulley-continuous-clearance.json';
const candidate = makeTreadleRatchetCandidate({shortFaceFraction: .06}), u = candidate.root.userData, p = u.linkage.parameters;
const bounds = makeTreadleRatchetInputBounds(u.linkage), epsilon = 1e-12;
const vertices = name => {
  const mesh = u.parts[name], a = mesh.geometry.attributes.position;
  return Array.from({length: a.count}, (_, i) => new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(mesh.matrixWorld));
};
const radial = v => [v.y - p.pulley[1], v.z], cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const edgeDistance = (a, b) => {
  const d = b.map((v, i) => v - a[i]), norm = d[0] ** 2 + d[1] ** 2;
  const t = norm ? Math.max(0, Math.min(1, -(a[0] * d[0] + a[1] * d[1]) / norm)) : 0;
  return Math.hypot(a[0] + t * d[0], a[1] + t * d[1]);
};
const body = vertices('pulleyBody'), shaft = vertices('pulleyAxle'), index = u.parts.pulleyBody.geometry.index;
let boreMinimum = Infinity;
for (let i = 0; i < (index?.count ?? body.length); i += 3) {
  const triangle = [0, 1, 2].map(j => radial(body[index ? index.getX(i + j) : i + j]));
  const edges = triangle.map((a, j) => edgeDistance(a, triangle[(j + 1) % 3]));
  const signs = triangle.map((a, j) => cross(a, triangle[(j + 1) % 3]));
  const area = signs.reduce((sum, v) => sum + v, 0);
  if (area !== 0 && (signs.every(v => v >= 0) || signs.every(v => v <= 0))) boreMinimum = 0;
  boreMinimum = Math.min(boreMinimum, ...edges);
}
const bodyRadius = Math.max(...body.map(v => Math.hypot(...radial(v)))) + epsilon;
const shaftRadius = Math.max(...shaft.map(v => Math.hypot(...radial(v)))) + epsilon;
const shaftGap = boreMinimum - shaftRadius - epsilon;
// Every ideal wrap quad is outside the inner chord of one angular cell.
// Straight legs and their shortened caps lie below the tangency plane.
// Vertex quantization perturbs every point of a triangle by at most the
// largest vertex error; rotation of the pulley preserves its radial bound.
const yMagnitude = Math.max(Math.abs(p.fulcrum[1]) + Math.hypot(...p.strapLocal) + .075 + .006,
  Math.abs(p.pulley[1]) + p.radius + .006);
const radialRounding = Math.hypot(yMagnitude, p.radius + .006) * 2 ** -24 + epsilon;
const strapInnerRadius = (p.radius - .006) * Math.cos(Math.PI / 256) - radialRounding;
const strapGap = strapInnerRadius - bodyRadius - epsilon;
const strapShaftGap = strapInnerRadius - shaftRadius - epsilon;
const endpointXRange = range => {
  const phase = Math.atan2(p.strapLocal[1], p.strapLocal[0]), angles = [...range];
  for (let k = Math.ceil((range[0] + phase) / Math.PI); k * Math.PI - phase <= range[1]; k++) angles.push(k * Math.PI - phase);
  const x = angles.map(q => p.fulcrum[0] + p.strapLocal[0] * Math.cos(q) - p.strapLocal[1] * Math.sin(q));
  return [Math.min(...x) - epsilon, Math.max(...x) + epsilon];
};
const endX = [...endpointXRange(bounds.frontAngle), ...endpointXRange(bounds.rearAngle)];
const halfStrapWidth = 10 / u.geometry.source.scale, maxX = Math.max(...endX.map(Math.abs)) + halfStrapWidth;
const xRounding = maxX * 2 ** -24 + epsilon;
const strapX = [Math.min(...endX) - halfStrapWidth - xRounding, Math.max(...endX) + halfStrapWidth + xRounding];
const bodyX = [Math.min(...body.map(v => v.x)), Math.max(...body.map(v => v.x))];
const faceMargin = Math.min(strapX[0] - bodyX[0], bodyX[1] - strapX[1]) - epsilon;
const cylinder = [bodyX, [p.pulley[1] - bodyRadius, p.pulley[1] + bodyRadius], [-bodyRadius, bodyRadius]];
const supports = ['pulleyPost0', 'pulleyPost1', 'pulleyFoot0', 'pulleyFoot1'].map(name => {
  const points = vertices(name), box = ['x', 'y', 'z'].map(axis => [Math.min(...points.map(v => v[axis])), Math.max(...points.map(v => v[axis]))]);
  const gaps = box.map((v, i) => Math.max(v[0] - cylinder[i][1], cylinder[i][0] - v[1]) - epsilon);
  return {name, gap: Math.max(...gaps), separatingAxis: ['x', 'y', 'z'][gaps.indexOf(Math.max(...gaps))]};
});
assert(shaftGap > 0 && strapGap > 0 && strapShaftGap > 0 && faceMargin > 0 && supports.every(s => s.gap > 0));
const files = ['scripts/check-treadle-ratchet-pulley-clearance.mjs', 'scripts/lib/treadle-ratchet-input-bounds.mjs',
  'scripts/lib/treadle-ratchet-candidate.mjs', 'scripts/lib/treadle-ratchet-linkage.mjs', 'scripts/lib/treadle-ratchet-source.mjs'];
const sources = files.map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report = {movement: 82, passed: true, productionChanged: false, mechanicsPassed: false, status: 'continuous-pulley-strap-shaft-and-support-bounds',
  independentPairs: 7, bodyRadius, boreMinimum, shaftRadius, shaftGap, strapInnerRadius, radialRounding, strapGap, strapShaftGap,
  strapX, bodyX, faceMargin, supports, sources,
  qualification: 'The actual pulley circumradius and projected-triangle bore bound hold at every spin angle. The inner strap chord, including Float32 coordinate rounding, clears both the pulley cylinder and the axle throughout the bounded treadle stroke; all strap points remain within the pulley face width. Four fixed supports have positive separating-axis gaps. Only these seven pairs are covered here. Traction, strap constitutive behavior and all other mechanism pairs remain separate requirements.'};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'}); console.log({...report, sources: undefined});
