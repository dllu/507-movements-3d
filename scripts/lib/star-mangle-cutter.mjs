// Offline radial loft cutter for the right-angle mangle reconstruction.
// Intersects stock rays with the actual polygonal involute pinion, including
// its finite axial extent, at synchronized wheel/pinion poses.
import * as THREE from 'three';

const cross = (ax, ay, bx, by) => ax * by - ay * bx;
function insidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function cutRadialTooth({ motion, toothIndex, outline, pinionDepth,
  radialStart, radialEnd, stockRadius, radialBands = 16, angularSamples = 128,
  stockTangentialRadius = stockRadius, samplesPerTurn = 512, clearance = 0.0002,
  conservativeRadial = true, outerReliefStart = null, outerReliefHeight = null,
  collarOffset = null, collarRadius = 0.10, collarClearance = 0.002, onProgress = () => {} }) {
  const p = motion.parameters, theta = p.firstTerminal + toothIndex * p.wheelPitch;
  const radii = Array.from({ length: radialBands + 1 }, (_, i) => radialStart + (radialEnd - radialStart) * i / radialBands);
  const heights = radii.map((r) => Float64Array.from({ length: angularSamples }, (_, j) => {
    const a = 2 * Math.PI * j / angularSamples;
    let axialRadius = stockRadius;
    if (outerReliefStart !== null && outerReliefHeight !== null && r > outerReliefStart) {
      const u = THREE.MathUtils.clamp((r - outerReliefStart) / (radialEnd - outerReliefStart), 0, 1);
      axialRadius = THREE.MathUtils.lerp(stockRadius, outerReliefHeight, u * u * (3 - 2 * u));
    }
    return 1 / Math.hypot(Math.cos(a) / (stockTangentialRadius * r / p.wheelRadius), Math.sin(a) / axialRadius);
  }));
  const owner = radii.map(() => new Float64Array(angularSamples).fill(-1));
  const samples = Math.ceil(p.cycleTravel / (2 * Math.PI) * samplesPerTurn);
  const cutterRadius = Math.max(...outline.map((v) => v.length()));
  const stockBound = Math.max(stockRadius, stockTangentialRadius * radialEnd / p.wheelRadius);
  let activePoses = 0, rayChecks = 0, centerCuts = 0, collarCuts = 0;
  for (let step = 0; step <= samples; step += 1) {
    const s = motion.atTravel(p.cycleTravel * step / samples);
    const angle = s.wheelAngle + theta, c = Math.cos(angle), sn = Math.sin(angle);
    if (Math.abs(c * p.wheelRadius) > cutterRadius + stockBound + radialEnd - radialStart) continue;
    const cp = Math.cos(s.pinionAngle), sp = Math.sin(s.pinionAngle);
    const collarCenterR = sn * (s.centerY - (collarOffset ?? 0));
    const collarCenterT = c * (s.centerY - (collarOffset ?? 0));
    let poseActive = false;
    for (let band = 0; band <= radialBands; band += 1) {
      const r = radii[band], ox = cp * c * r + sp * s.centerZ,
        oy = -sp * c * r + cp * s.centerZ, oz = sn * r - s.centerY;
      if (collarOffset !== null && Math.abs(r - collarCenterR) < collarRadius + collarClearance
        && Math.abs(collarCenterT) < collarRadius + stockBound) {
        const square = (r - collarCenterR) ** 2 + collarCenterT ** 2 + s.centerZ ** 2 - (collarRadius + collarClearance) ** 2;
        if (square < 0) centerCuts += 1;
        for (let j = 0; j < angularSamples; j += 1) {
          const psi = 2 * Math.PI * j / angularSamples, dot = -collarCenterT * Math.cos(psi) - s.centerZ * Math.sin(psi);
          const discriminant = dot * dot - square;
          if (discriminant < 0) continue;
          const entry = -dot - Math.sqrt(discriminant);
          if (entry > 0 && entry < heights[band][j]) { heights[band][j] = entry; owner[band][j] = s.travel; collarCuts += 1; }
        }
      }
      if (Math.hypot(ox, oy) > cutterRadius + stockBound || Math.abs(oz) > pinionDepth / 2 + stockBound) continue;
      poseActive = true;
      const centerInside = insidePolygon(ox, oy, outline);
      if (centerInside && Math.abs(oz) < pinionDepth / 2) centerCuts += 1;
      // Only edges within the projected stock disk can intersect its rays.
      const edges = [];
      for (let i = 0; i < outline.length; i += 1) {
        const a = outline[i], b = outline[(i + 1) % outline.length];
        if (Math.max(a.x, b.x) < ox - stockBound || Math.min(a.x, b.x) > ox + stockBound
          || Math.max(a.y, b.y) < oy - stockBound || Math.min(a.y, b.y) > oy + stockBound) continue;
        edges.push([a.x - ox, a.y - oy, b.x - a.x, b.y - a.y]);
      }
      for (let j = 0; j < angularSamples; j += 1) {
        const psi = 2 * Math.PI * j / angularSamples, ct = Math.cos(psi), st = Math.sin(psi);
        const dx = -cp * sn * ct - sp * st, dy = sp * sn * ct - cp * st, dz = c * ct;
        let lo = 0, hi = heights[band][j] + clearance;
        if (Math.abs(dz) < 1e-12) { if (Math.abs(oz) >= pinionDepth / 2) continue; }
        else {
          const a = (-pinionDepth / 2 - oz) / dz, b = (pinionDepth / 2 - oz) / dz;
          lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b));
          if (lo >= hi) continue;
        }
        rayChecks += 1;
        const events = [];
        for (const [ax, ay, ex, ey] of edges) {
          const determinant = cross(dx, dy, ex, ey);
          if (Math.abs(determinant) < 1e-15) continue;
          const hit = cross(ax, ay, ex, ey) / determinant;
          if (hit < 0 || hit > hi) continue;
          const along = cross(ax, ay, dx, dy) / determinant;
          if (along >= 0 && along < 1) events.push(hit);
        }
        events.sort((a, b) => a - b);
        let inside = centerInside, entry = 0, cut = Infinity;
        for (const exit of [...events, hi]) {
          if (inside && Math.max(entry, lo) < Math.min(exit, hi)) { cut = Math.max(entry, lo); break; }
          entry = exit; inside = !inside;
        }
        if (cut < heights[band][j] + clearance) {
          heights[band][j] = Math.max(0, cut - clearance); owner[band][j] = s.travel;
        }
      }
    }
    if (poseActive) activePoses += 1;
    if (step % samplesPerTurn === 0) onProgress(step / samples);
  }
  // The cutter's flat ends create shoulders that a radial loft can otherwise
  // bridge. Use the smaller adjacent section on both sides of every band;
  // the resulting shoulder relief is explicit, not hidden by an inside test.
  const finalHeights = conservativeRadial ? heights.map((row, i) => Array.from(row, (h, j) =>
    Math.min(h, heights[Math.max(0, i - 1)][j], heights[Math.min(radialBands, i + 1)][j]))) : heights;
  return { toothIndex, theta, radialStart, radialEnd, radialBands, angularSamples,
    stockRadius, stockTangentialRadius, outerReliefStart, outerReliefHeight, collarOffset, collarRadius, collarClearance,
    pinionDepth, clearance, conservativeRadial, samplesPerTurn, radii, heights: finalHeights.map((row) => Array.from(row)),
    owner: owner.map((row) => Array.from(row)), samples, activePoses, rayChecks, centerCuts, collarCuts };
}

export { radialToothGeometry } from '../../src/simulation/star-mangle-geometry.js';
