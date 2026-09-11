import { writeFile } from 'node:fs/promises';
import clipping from 'polygon-clipping';
import { singleToothIndexParameters, makeSingleToothIndexMotion } from './lib/single-tooth-index-motion.mjs';

const p = singleToothIndexParameters(), motion = makeSingleToothIndexMotion(p);
const circle = (x, y, radius, steps = 512) => [Array.from({ length: steps }, (_, i) => {
  const a = 2 * Math.PI * i / steps; return [x + radius * Math.cos(a), y + radius * Math.sin(a)];
})];
const rotate = (polygon, angle, translation = [0, 0]) => polygon.map(ring => ring.map(([x, y]) => [
  x * Math.cos(angle) - y * Math.sin(angle) + translation[0],
  x * Math.sin(angle) + y * Math.cos(angle) + translation[1],
]));
// A circular pin follows a radial line during indexing, and a circular arc
// relative to the locked wheel during approach/departure. Build these three
// complete sweeps analytically; repeated tangent-disk Boolean unions are fragile.
const cuts = [];
const path = [];
for (let i = 0; i <= 1024; i++) {
  const angle = -1.0 + 2.0 * i / 1024;
  const state = motion.atTime((p.sourceAngle - angle) / p.driverSpeed), q = state.outputAngle;
  const x = p.headOrbit * Math.cos(angle) - p.centerDistance, y = p.headOrbit * Math.sin(angle);
  path.push([x * Math.cos(q) + y * Math.sin(q), -x * Math.sin(q) + y * Math.cos(q)]);
}
const radius = p.headRadius + p.clearance;
const inner = p.centerDistance - p.headOrbit;
const outer = Math.hypot(p.headOrbit * Math.cos(p.halfIndex) - p.centerDistance,
  p.headOrbit * Math.sin(p.halfIndex));
let sweep = clipping.union(circle(-inner, 0, radius), circle(-outer, 0, radius),
  [[[-outer, -radius], [-inner, -radius], [-inner, radius], [-outer, radius]]]);
for (const sign of [-1, 1]) {
  const q = -sign * p.halfPitch;
  const cx = -p.centerDistance * Math.cos(q), cy = p.centerDistance * Math.sin(q);
  const start = sign * p.halfIndex - q, end = sign - q;
  const ring = [];
  for (let i = 0; i <= 1024; i++) {
    const a = start + (end - start) * i / 1024;
    ring.push([cx + (p.headOrbit + radius) * Math.cos(a), cy + (p.headOrbit + radius) * Math.sin(a)]);
  }
  for (let i = 1024; i >= 0; i--) {
    const a = start + (end - start) * i / 1024;
    ring.push([cx + (p.headOrbit - radius) * Math.cos(a), cy + (p.headOrbit - radius) * Math.sin(a)]);
  }
  sweep = clipping.union(sweep, [ring], circle(cx + p.headOrbit * Math.cos(end),
    cy + p.headOrbit * Math.sin(end), radius));
}
for (let i = 0; i < p.notches; i++) {
  const angle = i * p.pitch;
  cuts.push(sweep.map(polygon => rotate(polygon, angle)));
  cuts.push(rotate(circle(-p.centerDistance, 0, p.driverRadius + p.clearance, 1024), angle + p.halfPitch));
}
const output = clipping.difference(circle(0, 0, p.outputRadius, 2048), ...cuts);
if (output.length !== 1) throw new Error('Output cutter split the wheel');
console.log({ outputVertices: output[0][0].length, holes: output[0].length - 1 });

// Cut the driver's body and broad neck by the actual output through the same
// index. The circular working head was already used to generate its mating cut.
const neck = [[[1, -p.headRadius], [p.headOrbit, -p.headRadius], [p.headOrbit, p.headRadius], [1, p.headRadius]]];
let driver = clipping.union(circle(0, 0, p.driverRadius, 2048), circle(p.headOrbit, 0, p.headRadius, 512), neck);
for (let i = 0; i <= 512; i++) {
  const angle = -0.85 + 1.7 * i / 512;
  const state = motion.atTime((p.sourceAngle - angle) / p.driverSpeed);
  const world = rotate(output[0], state.outputAngle, [p.centerDistance, 0]);
  driver = clipping.difference(driver, rotate(world, -angle));
  if (driver.length !== 1) throw new Error('Driver cutter split the tooth from its body');
}
const result = { movement: 68, status: 'isolated-envelope-candidate', parameters: p,
  output: output[0], driver: driver[0], path,
  method: 'Finite circular head sweep, including approach and departure during locked intervals, followed by a driver-body clearance envelope against that output. Polygon Boolean subtraction preserves reentrant boundaries. This first sampled candidate has not passed force, convergence, topology or rendered-source checks.' };
await writeFile('artifacts/review/068-envelope-candidate.json', JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
await writeFile('scripts/lib/single-tooth-envelope-profile.mjs', '// Isolated 068 sampled cutter candidate.\nexport default ' + JSON.stringify({ parameters: p, output: output[0], driver: driver[0] }) + ';\n', { flag: 'wx' });
console.log({ driverVertices: driver[0][0].length });
