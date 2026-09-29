import * as THREE from 'three';
import { creaseIndexedNormals } from './crease-normals.js';

const cache = new Map();

/** A face-gear (crown) tooth cut by its involute pinion, meshed to follow
 * the tooth rather than a fixed polar grid.
 *
 * The cut is the same sampled generating process as crownToothGeometry in
 * face-gear-geometry.js: the pinion's actual polygon rolls against the
 * blank, and at each radius and angle the deepest swept cutter point is the
 * face height (plus a small cutting clearance). That function stores the
 * result as a height field on a fixed (radius, angle) grid; its steep
 * flanks then cross grid cells diagonally, which (with the conservative
 * neighbour dilation the coarse grid needs) leaves stair-stepped flanks
 * and torn tip corners (469, pass 104).
 *
 * Here each radial row is cut on a fine angular line, and its section,
 * a graph of height over angle, is resampled by arc length in three runs:
 * the left flank from the gap centre to the tip corner, the flat top land,
 * and the right flank down to the next gap centre. Every row has the same
 * vertex count, so the rows join into one regular strip whose columns run
 * along the flanks; the tip corners are exact vertices, so the land/flank
 * crease stays sharp while each flank shades smoothly. The solid's
 * topology and winding are those of crownToothGeometry (top surface, end
 * faces at the inner and outer radii, sides at the gap centres and a
 * bottom on the backing face), so the same solid checks apply.
 */
export function conformingCrownToothGeometry({
  profile,
  pinionTeeth,
  pinionCenterX,
  crownTeeth,
  innerRadius,
  outerRadius,
  baseFace,
  tipFace,
}, {
  radialSteps = 16,
  flankSteps = 16,
  landSteps = 3,
  lineSamples = 1440,
  rotationSteps = 900,
  cuttingClearance = 0.0007,
  profileClearance = 0,
  minLand = 0.004,
} = {}) {
  const key = JSON.stringify({ profile, pinionTeeth, pinionCenterX, crownTeeth, innerRadius, outerRadius,
    baseFace, tipFace, radialSteps, flankSteps, landSteps, lineSamples, rotationSteps, cuttingClearance, profileClearance, minLand });
  if (cache.has(key)) return cache.get(key).clone();
  const pitch = 2 * Math.PI / crownTeeth;
  // The cutter is the pinion's polygon grown outward by profileClearance,
  // normal to its own profile, so the running clearance is a true normal
  // gap on steep flanks too (a clearance added along the face axis alone
  // vanishes where a flank runs nearly parallel to that axis).
  if (profileClearance > 0) {
    let area = 0;
    for (let i = 0; i < profile.length; i += 1) {
      const a = profile[i], b = profile[(i + 1) % profile.length];
      area += a.x * b.y - b.x * a.y;
    }
    const outward = area > 0 ? 1 : -1;
    const closed = profile[0].x === profile.at(-1).x && profile[0].y === profile.at(-1).y;
    const count = closed ? profile.length - 1 : profile.length;
    const grown = [];
    for (let i = 0; i < count; i += 1) {
      const prev = profile[(i - 1 + count) % count], next = profile[(i + 1) % count];
      const tx = next.x - prev.x, ty = next.y - prev.y, length = Math.hypot(tx, ty) || 1;
      grown.push({ x: profile[i].x + outward * profileClearance * ty / length,
        y: profile[i].y - outward * profileClearance * tx / length });
    }
    if (closed) grown.push({ ...grown[0] });
    profile = grown;
  }
  const shaperRadius = Math.max(...profile.map((p) => Math.hypot(p.x, p.y)));
  const sweep = Math.asin(Math.sqrt(shaperRadius ** 2 - (tipFace - pinionCenterX) ** 2) / innerRadius)
    + pitch / 2;
  const rows = radialSteps + 1;
  const line = lineSamples + 1;
  // heights[row * line + j]: the cut face at radius row, angle j.
  const heights = new Float64Array(rows * line).fill(tipFace);
  const angleAt = (j) => -pitch / 2 + pitch * j / lineSamples;
  const radiusAt = (row) => innerRadius + (outerRadius - innerRadius) * row / radialSteps;
  for (let step = 0; step <= rotationSteps; step += 1) {
    const rotation = -sweep + 2 * sweep * step / rotationSteps;
    const pinionAngle = Math.PI / pinionTeeth - crownTeeth / pinionTeeth * rotation;
    const cosine = Math.cos(pinionAngle);
    const sine = Math.sin(pinionAngle);
    const points = profile.map((p) => ({ x: p.x * cosine - p.y * sine, y: p.x * sine + p.y * cosine }));
    const edges = [];
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      if (Math.max(a.x, b.x) + pinionCenterX < tipFace - cuttingClearance || Math.abs(a.y - b.y) < 1e-12) continue;
      edges.push({ x: a.x, y: a.y, low: Math.min(a.y, b.y), high: Math.max(a.y, b.y), slope: (b.x - a.x) / (b.y - a.y) });
    }
    if (!edges.length) continue;
    const low = Math.min(...edges.map((e) => e.low));
    const high = Math.max(...edges.map((e) => e.high));
    for (let j = 0; j < line; j += 1) {
      const transverse = -Math.sin(angleAt(j) + rotation);
      for (let row = 0; row < rows; row += 1) {
        const y = radiusAt(row) * transverse;
        if (y < low || y > high) continue;
        const index = row * line + j;
        for (const edge of edges) {
          if (y < edge.low || y > edge.high) continue;
          const h = pinionCenterX + edge.x + (y - edge.y) * edge.slope + cuttingClearance;
          if (h > heights[index]) heights[index] = h;
        }
      }
    }
  }
  // The line is one pitch long and periodic. If its middle is a gap (the
  // tooth straddles its ends), shift it half a pitch so a whole tooth lies
  // in the middle; the gap centres are then the line's ends.
  const middle = lineSamples / 2;
  if (lineSamples % 2) throw new RangeError('lineSamples must be even.');
  let angleOffset = 0;
  if (heights[Math.floor(rows / 2) * line + middle] > tipFace + 1e-9) {
    angleOffset = pitch / 2;
    const shifted = new Float64Array(line);
    for (let row = 0; row < rows; row += 1) {
      for (let j = 0; j < line; j += 1) shifted[j] = heights[row * line + (j + middle) % lineSamples];
      heights.set(shifted, row * line);
    }
  }
  const lineAngle = (j) => angleAt(j) + angleOffset;
  const columns = 2 * flankSteps + landSteps + 1;
  const angles = new Float64Array(rows * columns);
  const faces = new Float64Array(rows * columns);
  const tips = new Float64Array(rows);
  for (let row = 0; row < rows; row += 1) {
    const radius = radiusAt(row);
    const h = (j) => heights[row * line + j];
    // Topping: where the cut leaves no top land (pointed teeth toward the
    // outer radius, undercut tips toward the inner), lower this row's tip to
    // the height at which the tooth is minLand wide, as a topped face gear
    // is, instead of leaving a knife edge or a torn point.
    const widthBelow = (level) => {
      let count = 0;
      for (let j = 0; j < line; j += 1) if (h(j) <= level) count += 1;
      return radius * pitch * Math.max(0, count - 1) / lineSamples;
    };
    let tip = Infinity;
    for (let j = 0; j < line; j += 1) tip = Math.min(tip, h(j));
    tip = Math.max(tip, tipFace) + 1e-9;
    if (widthBelow(tip) < minLand) {
      let low = tip, high = baseFace;
      for (let i = 0; i < 50; i += 1) {
        const mid = (low + high) / 2;
        if (widthBelow(mid) < minLand) low = mid; else high = mid;
      }
      tip = high;
      for (let j = 0; j < line; j += 1) heights[row * line + j] = Math.max(heights[row * line + j], tip);
    }
    tips[row] = tip;
    const uncut = (value) => value <= tip;
    let peak = middle;
    for (let j = 0; j < line; j += 1) {
      if (h(j) < h(peak) - 1e-12 || (h(j) <= h(peak) + 1e-12 && Math.abs(j - middle) < Math.abs(peak - middle))) peak = j;
    }
    if (!uncut(h(peak))) throw new RangeError('The face-gear tooth has no top land after topping.');
    // Tip corners: the last uncut samples either side of the land, refined
    // by interpolating where the cut crosses the (topped) tip plane.
    let left = peak, right = peak;
    while (left > 0 && uncut(h(left - 1))) left -= 1;
    while (right < lineSamples && uncut(h(right + 1))) right += 1;
    const cornerAngle = (inside, outside) => {
      const a = h(inside), b = h(outside);
      const u = b > a ? (tip - a) / (b - a) : 0;
      return lineAngle(inside) + (lineAngle(outside) - lineAngle(inside)) * THREE.MathUtils.clamp(u, 0, 1);
    };
    const leftCorner = left > 0 ? cornerAngle(left, left - 1) : lineAngle(0);
    const rightCorner = right < lineSamples ? cornerAngle(right, right + 1) : lineAngle(lineSamples);
    // One flank as a polyline from the gap centre to the corner, resampled
    // by arc length in (arc along the radius, height).
    const flank = (from, to, corner) => {
      const pts = [];
      const direction = Math.sign(to - from);
      for (let j = from; j !== to + direction; j += direction) pts.push([lineAngle(j), h(j)]);
      pts.push([corner, tip]);
      const lengths = [0];
      for (let i = 1; i < pts.length; i += 1) {
        lengths.push(lengths[i - 1] + Math.hypot(radius * (pts[i][0] - pts[i - 1][0]), pts[i][1] - pts[i - 1][1]));
      }
      const total = lengths.at(-1);
      const out = [];
      let k = 1;
      for (let s = 0; s <= flankSteps; s += 1) {
        const target = total * s / flankSteps;
        while (k < pts.length - 1 && lengths[k] < target) k += 1;
        const span = lengths[k] - lengths[k - 1];
        const u = span > 0 ? (target - lengths[k - 1]) / span : 0;
        out.push([pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * u, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * u]);
      }
      out[0] = [pts[0][0], pts[0][1]];
      out[flankSteps] = [corner, tip];
      return out;
    };
    const leftFlank = flank(0, Math.max(0, left - 1), leftCorner);
    const rightFlank = flank(lineSamples, Math.min(lineSamples, right + 1), rightCorner).reverse();
    const section = [...leftFlank];
    for (let s = 1; s < landSteps; s += 1) {
      section.push([leftCorner + (rightCorner - leftCorner) * s / landSteps, tip]);
    }
    section.push(...rightFlank);
    section.forEach(([angle, height], column) => {
      angles[row * columns + column] = angle;
      faces[row * columns + column] = height;
    });
  }
  const positions = [];
  const indices = [];
  const stride = columns;
  const surfaceCount = rows * columns;
  for (let layer = 0; layer < 2; layer += 1) {
    for (let row = 0; row < rows; row += 1) {
      const radius = radiusAt(row);
      for (let column = 0; column < columns; column += 1) {
        const angle = angles[row * columns + column];
        const height = faces[row * columns + column];
        if (height >= baseFace) throw new RangeError('The face-gear cutter enters the backing disk.');
        positions.push(radius * Math.cos(angle), radius * Math.sin(angle), layer === 0 ? height : baseFace);
      }
    }
  }
  const quad = (a, b, c, d) => indices.push(a, b, c, a, c, d);
  const lastColumn = columns - 1;
  for (let row = 0; row < radialSteps; row += 1) {
    for (let column = 0; column < lastColumn; column += 1) {
      const a = row * stride + column;
      quad(a, a + 1, a + stride + 1, a + stride);
    }
    for (const column of [0, lastColumn]) {
      const a = row * stride + column;
      if (column === 0) quad(a, a + stride, a + stride + surfaceCount, a + surfaceCount);
      else quad(a, a + surfaceCount, a + stride + surfaceCount, a + stride);
    }
  }
  for (let column = 0; column < lastColumn; column += 1) {
    const bottom = surfaceCount + column;
    quad(bottom, bottom + radialSteps * stride, bottom + radialSteps * stride + 1, bottom + 1);
    quad(column, column + surfaceCount, column + surfaceCount + 1, column + 1);
    const a = radialSteps * stride + column;
    quad(a, a + 1, a + surfaceCount + 1, a + surfaceCount);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  // Hard edges at the tip corners, the end faces and the backing face; the
  // flanks and root, sampled along their own curves, stay smooth.
  creaseIndexedNormals(geometry);
  geometry.userData = { conforming: true, cuttingClearance, radialSteps, flankSteps, landSteps, lineSamples,
    rotationSteps, minLand, innerRadius, outerRadius, pitch, surfaceCount, tips: Array.from(tips) };
  cache.set(key, geometry);
  return geometry.clone();
}
