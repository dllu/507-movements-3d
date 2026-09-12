import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {makeTreadleRatchetCandidate} from './lib/treadle-ratchet-candidate.mjs';
import {makeTreadleRatchetDynamics} from './lib/treadle-ratchet-dynamics.mjs';

const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/082-rolling-pulley-check.json';
const checkpoint = JSON.parse(fs.readFileSync('artifacts/review/082-loading-refinement-checkpoint.json'));
const previous = checkpoint.sources.find(s => s.file === 'scripts/lib/treadle-ratchet-candidate.mjs');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(hash(previous.archive), previous.sha256);
const originalUrl = pathToFileURL(process.cwd() + '/' + previous.file);
const code = fs.readFileSync(previous.archive, 'utf8').replace(/from (['"])([^'"]+)\1/g,
  (_, quote, specifier) => 'from ' + quote + (specifier.startsWith('.') ? new URL(specifier, originalUrl).href : import.meta.resolve(specifier)) + quote);
const {makeTreadleRatchetCandidate: previousFactory} = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const before = previousFactory(checkpoint.geometry), current = makeTreadleRatchetCandidate(checkpoint.geometry), u = current.root.userData;
assert.deepEqual(makeTreadleRatchetDynamics(before, checkpoint.parameters).parameters,
  makeTreadleRatchetDynamics(current, checkpoint.parameters).parameters);
const bytes = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
const compareGeometry = (a, b) => {
  assert.deepEqual(Object.keys(a.attributes), Object.keys(b.attributes));
  for (const key of Object.keys(a.attributes)) assert(bytes(a.attributes[key].array).equals(bytes(b.attributes[key].array)));
  assert.equal(a.index === null, b.index === null);
  if (a.index) assert(bytes(a.index.array).equals(bytes(b.index.array)));
};
assert.deepEqual(Object.keys(u.parts), Object.keys(before.root.userData.parts));
assert.deepEqual(u.families, before.root.userData.families);
for (const name of Object.keys(u.parts)) compareGeometry(before.root.userData.parts[name].geometry, u.parts[name].geometry);
let centerError = 0, axisError = 0, angularRateError = 0, angleMinimum = Infinity, angleMaximum = -Infinity;
const center = new THREE.Vector3(...u.linkage.parameters.pulley, 0), period = u.linkage.parameters.period, poses = 257;
for (let i = 0; i < poses; i++) {
  const time = period * i / (poses - 1), state = {time, wheelAngle: .17 * time, pawlAngles: [.1 * Math.sin(time), -.2 * Math.cos(time)]};
  before.setState(state); current.setState(state);
  for (const name of Object.keys(u.parts)) if (name !== 'pulleyBody') {
    assert.deepEqual(u.parts[name].matrixWorld.elements, before.root.userData.parts[name].matrixWorld.elements);
  }
  compareGeometry(u.parts.strap.geometry, before.root.userData.parts.strap.geometry);
  const mesh = u.parts.pulleyBody, actualCenter = new THREE.Vector3().applyMatrix4(mesh.matrixWorld);
  centerError = Math.max(centerError, actualCenter.distanceTo(center));
  axisError = Math.max(axisError, new THREE.Vector3(0, 0, 1).transformDirection(mesh.matrixWorld).distanceTo(new THREE.Vector3(1, 0, 0)));
  const angle = u.kinematics.pulleyAngle; angleMinimum = Math.min(angleMinimum, angle); angleMaximum = Math.max(angleMaximum, angle);
  // A marked material radius on the actual mesh must rotate about world X
  // with the mean rolling angle, not orbit the shaft or rotate about Z.
  const material = new THREE.Vector3(1, 0, 0).transformDirection(mesh.matrixWorld);
  assert(material.distanceTo(new THREE.Vector3(0, Math.sin(angle), -Math.cos(angle))) < 1e-12);
  const h = 1e-5, at = t => u.linkage.atTime(t).cable;
  const a = at(time - h), b = at(time + h), expected = (b.frontLength - a.frontLength - b.rearLength + a.rearLength) / (4 * h * u.linkage.parameters.radius);
  current.setState({...state, time: time - h}); const lo = u.kinematics.pulleyAngle;
  current.setState({...state, time: time + h}); const hi = u.kinematics.pulleyAngle;
  angularRateError = Math.max(angularRateError, Math.abs((hi - lo) / (2 * h) - expected));
}
current.setState({time: 0}); const startAngle = u.kinematics.pulleyAngle;
current.setState({time: period}); const repeatError = Math.abs(u.kinematics.pulleyAngle - startAngle);
assert(centerError < 1e-12 && axisError < 1e-12 && angularRateError < 1e-8 && repeatError < 1e-12);
const files = ['scripts/check-treadle-ratchet-pulley.mjs', 'scripts/lib/treadle-ratchet-candidate.mjs',
  'scripts/lib/treadle-ratchet-linkage.mjs', 'scripts/lib/treadle-ratchet-source.mjs', 'scripts/lib/treadle-ratchet-dynamics.mjs'];
const sources = files.map((file, i) => {
  const archive = output.replace(/\.json$/, '') + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const report = {movement: 82, passed: true, productionChanged: false, mechanicsPassed: false, status: 'candidate-pulley-axis-and-motion-check',
  poses, meshes: Object.keys(u.parts).length, centerError, axisError, angularRateError, repeatError, angleRange: [angleMinimum, angleMaximum], previous, sources,
  qualification: 'Geometry buffers and free-dynamics mass parameters match the archived candidate exactly. Every other part retains identical sampled world transforms. The actual pulley rotates about its fixed world-X axle with the periodic mean rolling angle. Axial creep, residual circumferential slip and ideal massless-pulley assumptions remain; this check does not establish traction or clearance.'};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'}); console.log({...report, sources: undefined});
