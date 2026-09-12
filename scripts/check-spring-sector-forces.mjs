import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringSectorCandidate} from './lib/spring-sector-candidate.mjs';
import {makeSpringSectorDynamics} from './lib/spring-sector-dynamics.mjs';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';

const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/083-first-force-check';
const model = makeSpringSectorCandidate(), physics = makeSpringSectorDynamics(model), u = model.root.userData;
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sources = ['scripts/check-spring-sector-forces.mjs', 'scripts/lib/spring-sector-mass.mjs', 'scripts/lib/spring-sector-dynamics.mjs',
  'scripts/lib/spring-sector-candidate.mjs', 'scripts/lib/spring-sector-source.mjs', 'scripts/lib/spring-sector-linkage.mjs',
  'scripts/lib/spring-sector-contact.mjs', 'scripts/lib/spring-rack-coil.mjs', 'tests/helpers/solid-surface.mjs',
  'artifacts/review/083-pre-dynamics-mass.json'].map((file, i) => {
  const archive = prefix + '-source-' + i + '.txt'; fs.copyFileSync(file, archive, fs.constants.COPYFILE_EXCL);
  return {file, archive, sha256: hash(file)};
});
const families = {};
for (const family of ['wheel', 'front', 'rear']) {
  families[family] = [];
  for (const [name, mesh] of Object.entries(u.parts)) if (u.families[name] === family) {
    mesh.updateMatrix();
    for (const t of surfaceTriangles(mesh.geometry)) {
      const vertices = [t.a, t.b, t.c].map(v => v.clone().applyMatrix4(mesh.matrix));
      const volume = vertices[0].dot(vertices[1].clone().cross(vertices[2])) / 6;
      families[family].push({mass: volume * physics.parameters.density, points: [[0, 0, 0], ...vertices.map(v => v.toArray())]});
    }
  }
}
// Integrate the actual affine velocity at all four vertices of every signed
// tetrahedron. This does not call the stored mass-moment or force formulas.
function sectorEnergy(side, q, qdot, s, velocity) {
  const c = Math.cos(q), n = Math.sin(q), direction = [-n, c];
  let kinetic = 0, potential = 0, momentum = 0;
  for (const tetra of families[side === 0 ? 'front' : 'rear']) {
    const velocities = tetra.points.map(([x, y]) => {
      const a = -qdot * (y + s), b = qdot * x + velocity;
      return [c * a - n * b, n * a + c * b];
    });
    const sum = [0, 1].map(i => velocities.reduce((a, v) => a + v[i], 0));
    kinetic += tetra.mass / 40 * (sum[0] ** 2 + sum[1] ** 2 + velocities.reduce((a, v) => a + v[0] ** 2 + v[1] ** 2, 0));
    momentum += tetra.mass / 4 * (sum[0] * direction[0] + sum[1] * direction[1]);
    potential += tetra.mass * physics.parameters.gravity / 4 * tetra.points.reduce((a, [x, y]) => a + n * x + c * (y + s), 0);
  }
  potential += physics.parameters.stiffness[side] * (s - physics.parameters.freeLift[side]) ** 2 / 2;
  return {kinetic, potential, momentum};
}
let wheelKineticAtUnitSpeed = 0;
for (const tetra of families.wheel) {
  const velocities = tetra.points.map(([x, , z]) => [z, -x]), sum = [0, 1].map(i => velocities.reduce((s, v) => s + v[i], 0));
  wheelKineticAtUnitSpeed += tetra.mass / 40 * (sum[0] ** 2 + sum[1] ** 2 + velocities.reduce((s, v) => s + v[0] ** 2 + v[1] ** 2, 0));
}
const inertiaError = Math.abs(2 * wheelKineticAtUnitSpeed - physics.parameters.inertia[0]); assert(inertiaError < 1e-10);
const old = JSON.parse(fs.readFileSync('artifacts/review/083-pre-dynamics-mass.json'));
const expectedHousingOverlap = 2 * .09 * .12 * (u.geometry.depth / 2 - .05);
const removedHousingOverlap = [1, 2].map(i => old.masses[i].volume - physics.rawMass[i].volume);
for (const removed of removedHousingOverlap) assert(Math.abs(removed - expectedHousingOverlap) < 2e-8);
const rows = []; let maximumForceError = 0;
for (let i = 0; i < 16; i++) for (let side = 0; side < 2; side++) {
  const time = .173 + i * .397, k = physics.input(time), s = .03 + .06 * ((i * .37 + side * .11) % 1);
  const velocity = -.17 + .34 * ((i * .29 + side * .17) % 1), h = 1e-5;
  const plus = sectorEnergy(side, k.q, k.v, s + h, velocity), minus = sectorEnergy(side, k.q, k.v, s - h, velocity);
  const forward = sectorEnergy(side, k.q + k.v * h + k.acceleration * h * h / 2, k.v + k.acceleration * h, s + velocity * h, velocity);
  const backward = sectorEnergy(side, k.q - k.v * h + k.acceleration * h * h / 2, k.v - k.acceleration * h, s - velocity * h, velocity);
  const energyForce = (plus.kinetic - minus.kinetic - plus.potential + minus.potential - forward.momentum + backward.momentum) / (2 * h);
  const x = [physics.initial.x[0], .06, .06]; x[side + 1] = s;
  const force = physics.forces(x, time)[side + 1], error = Math.abs(force - energyForce);
  maximumForceError = Math.max(maximumForceError, error); rows.push({time, side, s, velocity, force, energyForce, error});
}
assert(maximumForceError < 2e-6, 'Free-sector force is inconsistent with mesh energy and momentum');
for (const source of sources) assert.equal(hash(source.file), source.sha256, source.file);
const report = {movement: 83, status: 'free-coordinate-force-check', passed: true, productionChanged: false, mechanicsPassed: false,
  tetrahedra: Object.fromEntries(Object.entries(families).map(([name, t]) => [name, t.length])), inertiaError,
  expectedHousingOverlap, removedHousingOverlap, maximumForceError, rows, sources,
  qualification: 'Actual-mesh affine velocity/height integration checks Y-axis wheel inertia and both radial free-coordinate equations. Springs are ideal massless energy terms. This does not qualify the contact normal cone, dissipation, guide reactions, prescribed input-family mass, trajectory energy balance or continuous clearance.'};
fs.writeFileSync(prefix + '.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log({...report, rows: undefined, sources: undefined});
