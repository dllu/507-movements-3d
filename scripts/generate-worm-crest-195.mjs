import fs from 'node:fs';
import os from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import * as THREE from 'three';
import { FACE_SLOT_WORM_195 as p, crestGrid195, crestGridKey195 } from '../src/simulation/face-slot-worm-195.js';

// Movement 195's worm crest, cut by the wheels' own rectangular slots.
//
// Only the crest can reach a wheel: the worm's axis stands `faceOffset` clear
// of each face, above the root. Every crest point (u across the thread,
// theta along the helix) is swept through one full worm turn, which advances
// each wheel by exactly one slot, so one turn covers every meeting. At each
// phase the radial ray through the point is tested against the wheel solid
// grown by the running clearance (face, slot walls, slot inner end and floor,
// rim); the crest keeps the smallest radius at which any phase meets it. The
// poses are the rendered model's own matrices (worm thread and both wheel
// solids), sampled finely and interpolated linearly within a sample.
const PHASES = 4096;
const destination = new URL('../src/data/worm-crest-195.js', import.meta.url);

function landTest(X, Y, Z, c) {
  // Wheel frame: slotted face at z = 0, body below.
  if (Z > c) return false;
  const r = Math.hypot(X, Y);
  if (r > p.wheelOuterRadius + c) return false;
  if (Z < -p.slotDepth + c) return true;
  const pitch = 2 * Math.PI / p.teeth, a = Math.atan2(Y, X), k = Math.round(a / pitch), d = a - k * pitch;
  const t = r * Math.sin(d), radial = r * Math.cos(d);
  return !(Math.abs(t) < p.slotWidth / 2 - c && radial > p.slotInnerRadius + c);
}

if (!isMainThread) {
  const { matrices, c } = workerData, count = matrices.length / 2 / 12;
  const grid = crestGrid195(p);
  // matrices: [side][phase][12] affine thread-local -> wheel frame (row-major 3x4).
  const at = (side, f, out) => {
    const i0 = Math.floor(f) % count, i1 = (i0 + 1) % count, s = f - Math.floor(f), o0 = (side * count + i0) * 12, o1 = (side * count + i1) * 12;
    for (let k = 0; k < 12; k++) out[k] = matrices[o0 + k] + (matrices[o1 + k] - matrices[o0 + k]) * s;
    return out;
  };
  const m = new Float64Array(12);
  const trimAt = (side, f, u, theta, limit) => {
    at(side, f, m);
    const z = u + grid.lead * theta, cs = Math.cos(theta), sn = Math.sin(theta);
    // Ray: A + r B in the wheel frame.
    const A = [m[2] * z + m[3], m[6] * z + m[7], m[10] * z + m[11]];
    const B = [m[0] * cs + m[1] * sn, m[4] * cs + m[5] * sn, m[8] * cs + m[9] * sn];
    if (B[2] >= 0) return limit;
    const r0 = Math.max(p.wormRootRadius, (c - A[2]) / B[2]);
    if (r0 >= limit) return limit;
    const step = 2e-4;
    let previous = r0;
    for (let r = r0; r < limit + step; r += step) {
      const rr = Math.min(r, limit);
      if (landTest(A[0] + rr * B[0], A[1] + rr * B[1], A[2] + rr * B[2], c)) {
        let lo = previous, hi = rr;
        for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (landTest(A[0] + mid * B[0], A[1] + mid * B[1], A[2] + mid * B[2], c)) hi = mid; else lo = mid; }
        return Math.min(limit, lo);
      }
      previous = rr;
      if (rr === limit) break;
    }
    return limit;
  };
  parentPort.on('message', ({ id, items }) => {
    const out = items.map(([u, theta]) => {
      const bySide = [0, 1].map(side => {
        let best = p.wormTipRadius, bestPhase = -1;
        for (let f = 0; f < count; f++) {
          const r = trimAt(side, f, u, theta, best);
          if (r < best) { best = r; bestPhase = f; }
        }
        if (bestPhase < 0) return best;
        // Golden-section refinement of the meeting phase.
        let a = bestPhase - 1, b = bestPhase + 1;
        const g = (Math.sqrt(5) - 1) / 2, F = f => trimAt(side, (f + count) % count, u, theta, p.wormTipRadius);
        let x1 = b - g * (b - a), x2 = a + g * (b - a), f1 = F(x1), f2 = F(x2);
        for (let k = 0; k < 30; k++) { if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = b - g * (b - a); f1 = F(x1); } else { a = x1; x1 = x2; f1 = f2; x2 = a + g * (b - a); f2 = F(x2); } }
        return Math.min(best, f1, f2);
      });
      return bySide;
    });
    parentPort.postMessage({ id, out });
  });
} else {
  const { createAuthoredGearMovement } = await import('../src/simulation/authored-gears.js');
  const model = createAuthoredGearMovement({ id: 195 }), d = model.root.userData, b = d.blocks;
  const thread = b.worm.userData.thread, period = d.transmission.inputPeriod;
  const flip = new THREE.Matrix4().makeRotationX(Math.PI);
  const matrices = new Float64Array(2 * PHASES * 12);
  for (let side = 0; side < 2; side++) for (let i = 0; i < PHASES; i++) {
    model.update(period * i / PHASES); model.root.updateMatrixWorld(true);
    const wheel = b[(side ? 'lower' : 'upper') + 'GeneratedFace'];
    const toWheel = wheel.matrixWorld.clone().invert();
    if (side) toWheel.premultiply(flip);
    const e = toWheel.multiply(thread.matrixWorld).elements;
    // Row-major 3x4 of the column-major 4x4.
    matrices.set([e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]], (side * PHASES + i) * 12);
  }
  const grid = crestGrid195(p), items = [];
  for (let i = 0; i <= grid.count; i++) for (let j = 0; j <= p.crestSteps; j++) items.push([-grid.w / 2 + grid.w * j / p.crestSteps, grid.thetaStart + i * grid.dTheta, i, j]);
  const workers = Math.max(1, Math.min(40, os.cpus().length - 2)), chunk = Math.ceil(items.length / (workers * 8)), jobs = [];
  for (let k = 0; k < items.length; k += chunk) jobs.push(k);
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(workers, jobs.length) }, () => new Promise((resolve, reject) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { matrices, c: p.clearance + p.crestAllowance } });
    const go = () => { if (next >= jobs.length) { w.terminate(); resolve(); return; } const id = next++; w.postMessage({ id, items: items.slice(jobs[id], jobs[id] + chunk).map(q => q.slice(0, 2)) }); };
    w.on('message', ({ id, out: o }) => { o.forEach((v, k) => { out[jobs[id] + k] = v; }); go(); });
    w.on('error', reject); go();
  })));
  let sideDifference = 0, minimum = Infinity;
  const entries = [];
  items.forEach(([, , i, j], k) => {
    const [upper, lower] = out[k];
    sideDifference = Math.max(sideDifference, Math.abs(upper - lower));
    const r = Math.min(upper, lower);
    minimum = Math.min(minimum, r);
    if (r < p.wormTipRadius - 1e-9) entries.push([i, j, Math.round(r * 1e7) / 1e7]);
  });
  const data = { grid: crestGridKey195(p), phases: PHASES, clearance: p.clearance, sideDifference: Math.round(sideDifference * 1e9) / 1e9, minimumCrestRadius: Math.round(minimum * 1e7) / 1e7, entries };
  const text = `// Crest of 195's worm, cut by both wheels' rectangular slots; scripts/generate-worm-crest-195.mjs.\nexport default ${JSON.stringify(data)};\n`;
  console.log({ points: items.length, trimmed: entries.length, sideDifference, minimum });
  if (process.argv.includes('--check')) {
    if (fs.readFileSync(destination, 'utf8') !== text) throw new Error('worm-crest-195.js is not reproduced');
    console.log('worm-crest-195.js reproduces byte for byte.');
  } else fs.writeFileSync(destination, text);
}
