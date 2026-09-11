import * as THREE from 'three';
import { mangleCut } from '../data/contact-profiles.js';

const cache = new Map();
const turn = 2 * Math.PI;

/** Remove the synchronized pinion from a C-shaped raised tooth strip.
 * Unlike a polar gear outline, this boundary includes an internal run and
 * two convex ends. Cutting along its local normals preserves that topology.
 */
export function mangleToothOutline({ pinionOutline, pinionRadius, module, segments, teeth }, { regenerate = false } = {}) {
  const key = JSON.stringify({ pinionOutline, pinionRadius, module, segments, teeth });
  if (!regenerate && cache.has(key)) return cache.get(key);
  const count = teeth * 96;
  const cutterCount = pinionOutline.length;
  const cutterRadius = Math.max(...pinionOutline.map((p) => Math.hypot(p.x, p.y)));
  const clearance = 0.0006;
  let perimeter = 0;
  let guidePerimeter = 0;
  const arcs = segments.map((segment) => {
    const length = segment.radius * Math.abs(segment.sweep);
    const guideLength = (segment.radius + Math.sign(segment.sweep) * pinionRadius) * Math.abs(segment.sweep);
    const arc = { ...segment, start: perimeter, length, guideStart: guidePerimeter, guideLength };
    perimeter += length;
    guidePerimeter += guideLength;
    return arc;
  });
  const initialNormal = segments[0].startAngle + (segments[0].sweep < 0 ? Math.PI : 0);
  const samples = Array.from({ length: count }, (_, index) => {
    const distance = perimeter * index / count;
    const arc = arcs.find((candidate) => distance < candidate.start + candidate.length) ?? arcs.at(-1);
    const progress = (distance - arc.start) / arc.length;
    const angle = arc.startAngle + arc.sweep * progress;
    const direction = Math.sign(arc.sweep);
    const x = arc.center.x + arc.radius * Math.cos(angle);
    const y = arc.center.y + arc.radius * Math.sin(angle);
    const nx = direction * Math.cos(angle);
    const ny = direction * Math.sin(angle);
    return { x, y, nx, ny, cx: x + pinionRadius * nx, cy: y + pinionRadius * ny,
      pinionAngle: initialNormal + Math.PI + (arc.guideStart + progress * arc.guideLength) / pinionRadius };
  });
  const baked = !regenerate && mangleCut?.key === key ? mangleCut.heights : null;
  const heights = new Float64Array(count).fill(module);
  // Spatial lookup includes nonadjacent parts of the C: a local arc window
  // could miss cutter interference across an overly narrow opening.
  const reach = cutterRadius + 2 * module;
  const cells = new Map();
  samples.forEach((p, index) => {
    const cell = `${Math.floor(p.x / reach)},${Math.floor(p.y / reach)}`;
    if (!cells.has(cell)) cells.set(cell, []);
    cells.get(cell).push(index);
  });
  const cutterRadiusAt = (x, y) => {
    const angle = THREE.MathUtils.euclideanModulo(Math.atan2(y, x), turn);
    const i = Math.min(cutterCount - 1, Math.floor(angle / turn * cutterCount));
    const a = pinionOutline[i];
    const b = pinionOutline[(i + 1) % cutterCount];
    const radius = Math.hypot(x, y);
    return (a.x * b.y - a.y * b.x) / (x / radius * (b.y - a.y) - y / radius * (b.x - a.x));
  };
  for (const cutter of baked ? [] : samples) {
    const cosine = Math.cos(cutter.pinionAngle);
    const sine = Math.sin(cutter.pinionAngle);
    for (let xCell = Math.floor((cutter.cx - reach) / reach); xCell <= Math.floor((cutter.cx + reach) / reach); xCell += 1) {
      for (let yCell = Math.floor((cutter.cy - reach) / reach); yCell <= Math.floor((cutter.cy + reach) / reach); yCell += 1) {
        for (const index of cells.get(`${xCell},${yCell}`) ?? []) {
          const p = samples[index];
          const dx = cutter.cx - p.x;
          const dy = cutter.cy - p.y;
          if (dx * dx + dy * dy > reach * reach) continue;
          const along = dx * p.nx + dy * p.ny;
          const transverse = -dx * p.ny + dy * p.nx;
          const discriminant = cutterRadius ** 2 - transverse ** 2;
          if (discriminant <= 0) continue;
          const start = Math.max(-2 * module, along - Math.sqrt(discriminant));
          const end = Math.min(heights[index], along + Math.sqrt(discriminant));
          if (start >= end) continue;
          const inside = (height) => {
            const wx = height * p.nx - dx;
            const wy = height * p.ny - dy;
            const x = wx * cosine + wy * sine;
            const y = -wx * sine + wy * cosine;
            return Math.hypot(x, y) < cutterRadiusAt(x, y);
          };
          let before = start;
          for (let radial = 0; radial <= 24; radial += 1) {
            const value = start + (end - start) * radial / 24;
            if (inside(value)) {
              let low = before;
              let high = value;
              for (let iteration = 0; iteration < 18; iteration += 1) {
                const middle = (low + high) / 2;
                if (inside(middle)) high = middle;
                else low = middle;
              }
              heights[index] = Math.min(heights[index], high - clearance);
              break;
            }
            before = value;
          }
        }
      }
    }
  }
  const cutHeights = baked ?? heights.map((height, index) => Math.min(height,
    heights[(index + count - 1) % count], heights[(index + 1) % count]));
  const points = samples.map((p, index) => new THREE.Vector2(p.x + p.nx * cutHeights[index], p.y + p.ny * cutHeights[index]));
  const result = { points, profileKey: key, heights: Array.from(cutHeights), clearance, count, perimeter, guidePerimeter };
  cache.set(key, result);
  return result;
}
