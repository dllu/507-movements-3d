// 037 (p101): swept spherical studs against the straight ball-groove flutes.
// Uses the same closed-form motion law the factory plays. For every sampled
// output angle, every stud near the line of centres is carried into the
// toothed cone's frame; each point of its sphere that lies inside the land
// cone must lie inside a groove (distance to the groove's generator below
// the groove radius). Reports the worst margin per stud, each stud's
// backlash when centred in its flute, and the land-to-stud-body clearance.
// Usage: node scripts/probe-conical-stud-contact.mjs [samples] [--json out]
import { writeFile } from 'node:fs/promises';
import {
  conicalStudMotion, conicalStudParameters, conicalStudGrooveRadius,
} from '../src/simulation/conical-stud-geometry.js';

export function probeConicalStudContact({ samples = 6000, spherePoints = 600 } = {}) {
  const P = conicalStudParameters, M = conicalStudMotion(P);
  const { centerDistance: C, radiusSlope: k, studRadius: rho, halfHeight } = P;
  const L = Math.hypot(1, k), turn = 2 * Math.PI, p = M.pitch;
  const dirs = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < spherePoints; i += 1) {
    const y = 1 - 2 * (i + 0.5) / spherePoints, r = Math.sqrt(1 - y * y);
    dirs.push([r * Math.cos(golden * i), r * Math.sin(golden * i), y]);
  }
  const perStud = M.studs.map(() => Infinity);
  let worst = Infinity, worstAt = null, minStudSpacing = Infinity;
  for (let i = 1; i < M.studs.length; i += 1) {
    const a = M.studs[i - 1], b = M.studs[i];
    minStudSpacing = Math.min(minStudSpacing, Math.hypot(
      a.radius * Math.cos(a.angle) - b.radius * Math.cos(b.angle),
      a.radius * Math.sin(a.angle) - b.radius * Math.sin(b.angle), a.height - b.height));
  }
  for (let s = 0; s < samples; s += 1) {
    const psi = turn * (s + 0.5) / samples;
    const theta = M.inputAtOutput(psi);
    const ct = Math.cos(-theta), st = Math.sin(-theta);
    for (const [index, stud] of M.studs.entries()) {
      for (const wrap of [-1, 0, 1]) {
        const a = stud.angle - psi + turn * wrap; // world angle about the stud axis
        if (Math.abs(a - Math.PI) > 1.35) continue;
        const wx = C + stud.radius * Math.cos(a), wy = stud.radius * Math.sin(a);
        const cx = ct * wx - st * wy, cy = st * wx + ct * wy, cz = stud.height;
        let margin = Infinity;
        for (const [dx, dy, dz] of dirs) {
          const x = cx + rho * dx, y = cy + rho * dy, z = cz + rho * dz;
          if (Math.abs(z) > halfHeight) continue;
          const radial = Math.hypot(x, y);
          if (radial >= M.meanRadius + k * z) continue;
          const g = Math.round(Math.atan2(y, x) / p) * p;
          const bx = M.meanRadius * Math.cos(g), by = M.meanRadius * Math.sin(g);
          const ux = k * Math.cos(g) / L, uy = k * Math.sin(g) / L, uz = 1 / L;
          const vx = x - bx, vy = y - by, vz = z;
          const along = vx * ux + vy * uy + vz * uz;
          const dist = Math.hypot(vx - along * ux, vy - along * uy, vz - along * uz);
          margin = Math.min(margin, conicalStudGrooveRadius(P, z) - dist);
        }
        if (margin === Infinity) continue;
        perStud[index] = Math.min(perStud[index], margin);
        if (margin < worst) { worst = margin; worstAt = { psi, index, height: stud.height }; }
      }
    }
  }
  return {
    samples, spherePoints, studs: M.studs.length, flutes: P.teeth, studRadius: rho,
    minGrooveMargin: worst, worstAt, perStudMargin: perStud,
    // Backlash of each stud centred in its flute on the line of centres.
    centredBacklash: M.studs.map((stud) => conicalStudGrooveRadius(P, stud.height) - rho),
    minStudCentreSpacing: minStudSpacing,
    landToStudBodyClearance: P.studBodyRelief,
    spiral: { bottomHeight: M.bottomHeight, topHeight: M.topHeight, spiralEndOutput: M.spiralEnd,
      topStudHeight: M.studs.at(-1).height, bottomStudHeight: M.studs[0].height },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const samples = Number(process.argv[2]) || 6000;
  const result = probeConicalStudContact({ samples });
  console.log(JSON.stringify(result, (key, value) => (typeof value === 'number' ? Number(value.toFixed(6)) : value), 1));
  const out = process.argv.indexOf('--json');
  if (out > 0) await writeFile(process.argv[out + 1], `${JSON.stringify(result, null, 1)}\n`);
}
