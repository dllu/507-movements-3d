import { readFile, writeFile } from 'node:fs/promises';
import { createAuthoredGearMovement as create } from '../src/simulation/authored-gears.js';

const turn = 2 * Math.PI, result = {};
{
  const model = create({ id: 197 }), d = model.root.userData, g = d.geometry;
  const radial = 4000, samples = 4096, allowance = 0.00045;
  const outer = g.pinionPitchRadius + g.pinionToothHeight / 2;
  const radii = new Float64Array(radial).fill(outer);
  for (let i = 0; i <= samples; i++) {
    // Preserve clockwise cutter ordering independently of playback direction.
    const s = d.stateAtTime(-d.transmission.cyclePeriod * i / samples), a = -s.pinionAngle, c = Math.cos(a), sn = Math.sin(a);
    for (const pin of d.blocks.rackPins) {
      const wx = pin.position.x + s.rackTranslation.x, wy = -s.pinionCenter.y;
      const x = wx * c - wy * sn, y = wx * sn + wy * c, distance = Math.hypot(x, y), radius = g.rackPinRadius + allowance;
      if (distance > outer + radius) continue;
      const angle = Math.atan2(y, x), width = Math.asin(radius / distance);
      for (let j = Math.floor((angle - width) * radial / turn) - 1; j <= Math.ceil((angle + width) * radial / turn) + 1; j++) {
        const k = (j % radial + radial) % radial, theta = k * turn / radial;
        const dot = x * Math.cos(theta) + y * Math.sin(theta), disc = radius ** 2 - distance ** 2 + dot ** 2;
        if (disc >= 0 && dot > 0) radii[k] = Math.min(radii[k], dot - Math.sqrt(disc));
      }
    }
  }
  // Ten identical teeth, closed over the source's three input revolutions.
  for (let i = 0; i < radial / 10; i++) {
    const r = Math.min(...Array.from({ length: 10 }, (_, j) => radii[i + j * radial / 10]));
    for (let j = 0; j < 10; j++) radii[i + j * radial / 10] = r;
  }
  result[197] = { samples, allowance, minRadius: Math.min(...radii), maxRadius: Math.max(...radii),
    points: Array.from(radii, (r, i) => [r * Math.cos(i * turn / radial), r * Math.sin(i * turn / radial)]) };
  console.log('197', result[197].minRadius, result[197].maxRadius);
}
{
  const model = create({ id: 198 }), d = model.root.userData, g = d.geometry;
  const gear = d.blocks.pinion.userData.rotor.children[0];
  const outline = gear.userData.sourceOutline ?? gear.geometry.parameters.shapes.getPoints().map(p => p.toArray());
  const count = 36 * 128, samples = 4096, allowance = 0.0009, pitch = g.circularPitch;
  const stations = Array.from({ length: count }, (_, i) => {
    const s = d.evaluateRackToothPitch((i / 128 - 0.5) * pitch);
    return { x: s.point.x, y: s.point.y, nx: s.normal.x, ny: s.normal.y, h: -g.module };
  });
  const cutterRadius = Math.max(...outline.map(p => Math.hypot(...p))), reach = cutterRadius + 2 * g.module;
  const cells = new Map();
  stations.forEach((p, i) => { const key = `${Math.floor(p.x / reach)},${Math.floor(p.y / reach)}`; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(i); });
  for (let i = 0; i <= samples; i++) {
    const distance = g.centerPathPerimeter * i / samples;
    const path = d.evaluatePinionCenterPath(distance), travel = d.inputTravelToLocalPath(distance), s = d.stateAtInputTravel(travel);
    const angle = s.pinionAngle - s.carrierAngle, c = Math.cos(angle), sn = Math.sin(angle), cx = path.pinionCenterLocal.x, cy = path.pinionCenterLocal.y;
    const cutter = outline.map(p => [cx + c * p[0] - sn * p[1], cy + sn * p[0] + c * p[1]]);
    for (let ix = Math.floor((cx - reach) / reach); ix <= Math.floor((cx + reach) / reach); ix++) for (let iy = Math.floor((cy - reach) / reach); iy <= Math.floor((cy + reach) / reach); iy++) {
      for (const k of cells.get(`${ix},${iy}`) ?? []) {
        const p = stations[k]; if ((p.x - cx) ** 2 + (p.y - cy) ** 2 > reach ** 2) continue;
        for (let j = 0; j < cutter.length; j++) {
          const a = cutter[j], b = cutter[(j + 1) % cutter.length], ex = b[0] - a[0], ey = b[1] - a[1];
          const den = p.nx * ey - p.ny * ex; if (Math.abs(den) < 1e-12) continue;
          const ax = a[0] - p.x, ay = a[1] - p.y, u = (ax * p.ny - ay * p.nx) / den;
          if (u < 0 || u > 1) continue;
          const h = (ax * ey - ay * ex) / den;
          p.h = Math.max(p.h, h + allowance);
        }
      }
    }
  }
  result[198] = { samples, allowance, perTooth: 128, minHeight: Math.min(...stations.map(p => p.h)), maxHeight: Math.max(...stations.map(p => p.h)),
    points: stations.map(p => [p.x + p.nx * p.h, p.y + p.ny * p.h]),
    outside: stations.map(p => [p.x + p.nx * (1.10 - 2 * g.pinionPitchRadius), p.y + p.ny * (1.10 - 2 * g.pinionPitchRadius)]) };
  // Offset the finished cavity in actual face normals, rather than only in
  // station normals: steep flanks amplify interpolation's radial error.
  const raw = result[198].points, finishingAllowance = 0.00008;
  const rightNormal = (a, b) => { const x = b[0] - a[0], y = b[1] - a[1], l = Math.hypot(x, y); return [y / l, -x / l]; };
  result[198].points = raw.map((p, i) => {
    const a = rightNormal(raw[(i + raw.length - 1) % raw.length], p), b = rightNormal(p, raw[(i + 1) % raw.length]);
    const denominator = 1 + a[0] * b[0] + a[1] * b[1];
    if (denominator < 0.05) throw new Error('Finishing offset requires corner reconstruction');
    return [p[0] + finishingAllowance * (a[0] + b[0]) / denominator, p[1] + finishingAllowance * (a[1] + b[1]) / denominator];
  });
  result[198].finishingAllowance = finishingAllowance;
  console.log('198', result[198].minHeight, result[198].maxHeight);
}
for (const data of Object.values(result)) for (const name of ['points', 'outside']) if (data[name]) data[name] = data[name].map(p => p.map(x => Math.round(x * 1e10) / 1e10));
const destination = new URL('../src/simulation/baked/mangle-rack-working-profiles.js', import.meta.url);
const output = `// Generated offline by scripts/generate-mangle-rack-working-profiles.mjs.\nexport default ${JSON.stringify(result)};\n`;
if (process.argv.includes('--check')) {
  if (await readFile(destination, 'utf8') !== output) throw new Error('Working-profile bake is not byte-identical');
  console.log('Working-profile bake is byte-identical.');
} else await writeFile(destination, output);
