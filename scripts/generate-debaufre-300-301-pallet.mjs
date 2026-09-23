// Offline swept cut for the Movements 300/301 Debaufre D-pallet. The pallet
// is a plain D (flat at the staff axis, material on the +x side of the rest
// face) except for one band per wheel plane. Each band is a height field over
// pallet-local (x, z); it starts at the flat (or at the raised flange cap in
// the wheel plane) and is lowered below every rendered tooth surface point
// that enters the pallet's x-range during one full cycle, less a running
// clearance. Each point is splatted onto all grid cells within a dilation
// radius, so the piecewise-linear surface stays below the sampled solid
// between samples. One cycle advances the wheels one pitch and every tooth is
// identical, so one cycle covers every tooth/pallet configuration. The rear
// band is the mirror image (z -> -z, pallet angle -> -angle); both wheels are
// folded into one symmetric field. Tooth material striking the plain D
// outside the bands aborts the bake. The browser only builds meshes from the
// baked heights.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { densePoints } from '../tests/helpers/dense-points.mjs';

const SAMPLES = 24000;
const POINT_SPACING = 0.004;
const CLEARANCE = 0.004;
const DILATION = 0.005;
const X_COUNT = 62;
const Z_START = 0.46;
const Z_END = 0.78;
const Z_COUNT = 65;
const LIP_HALF_WIDTH = 0.04;
const FLANGE_CAP = 0.12;
const FLANGE_SKIN = 0.002;
const HEIGHT_SCALE = 1e5;

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const model = createMovementModel(catalog.movements[299]);
const data = model.root.userData;
const g = data.geometry;
const b = data.blocks;
const x0 = g.restFaceX;
const x1 = g.palletThickness / 2;
const entryX = -g.palletThickness / 2;
const dx = (x1 - x0) / (X_COUNT - 1);
const dz = (Z_END - Z_START) / (Z_COUNT - 1);
const zs = Array.from({ length: Z_COUNT }, (_, j) => Z_START + dz * j);
const inLip = (z) => Math.abs(z - g.wheelPlaneOffset) <= LIP_HALF_WIDTH + 1e-9;
const heights = new Float64Array(X_COUNT * Z_COUNT);
for (let i = 0; i < X_COUNT; i += 1) for (let j = 0; j < Z_COUNT; j += 1) {
  heights[i * Z_COUNT + j] = inLip(zs[j]) ? FLANGE_CAP : 0;
}

const reach = g.wheelContactRadius - 0.75;
const teeth = [b.frontWheel, b.rearWheel].flatMap((wheel) => wheel.userData.toothMeshes.map((mesh, k) => ({
  mesh,
  tip: wheel.userData.toothTips[k],
  points: densePoints(mesh.geometry, POINT_SPACING).filter((p) => Math.hypot(p.x, p.y) > reach),
})));
const toothHash = createHash('sha256');
for (const { mesh } of teeth) toothHash.update(Buffer.from(mesh.geometry.attributes.position.array.buffer));

const period = g.cyclePeriod;
const toPallet = new THREE.Matrix4();
const q = new THREE.Vector3();
let splats = 0;
let posesUsed = 0;
const violations = [];
for (let s = 0; s < SAMPLES; s += 1) {
  const time = period * s / SAMPLES;
  model.update(time);
  model.root.updateMatrixWorld(true);
  const inverse = b.palletAssembly.matrixWorld.clone().invert();
  let used = false;
  for (const tooth of teeth) {
    toPallet.copy(inverse).multiply(tooth.mesh.matrixWorld);
    q.copy(tooth.tip).applyMatrix4(toPallet);
    if (q.x < entryX - 0.9 || q.x > x1 + 0.9 || Math.abs(q.y) > 1.6) continue;
    used = true;
    for (const p of tooth.points) {
      q.copy(p).applyMatrix4(toPallet);
      // Material exists only for x > -t/2; the resting tip is tangent there.
      if (q.x <= entryX + 1e-9 || q.x > x1 + DILATION) continue;
      if (q.y > FLANGE_CAP + CLEARANCE + DILATION) continue;
      const za = Math.abs(q.z);
      if (za < Z_START - DILATION || za > Z_END + DILATION) {
        const insidePlainD = q.y < 0.006 + CLEARANCE && Math.hypot(q.y, q.z) < g.palletRadius + CLEARANCE;
        if (insidePlainD && q.x < x1 + CLEARANCE) violations.push({ time, x: q.x, y: q.y, z: q.z });
        continue;
      }
      const iLo = Math.max(0, Math.floor((q.x - DILATION - x0) / dx));
      const iHi = Math.min(X_COUNT - 1, Math.ceil((q.x + DILATION - x0) / dx));
      const jLo = Math.max(0, Math.floor((za - DILATION - Z_START) / dz));
      const jHi = Math.min(Z_COUNT - 1, Math.ceil((za + DILATION - Z_START) / dz));
      const limit = q.y - CLEARANCE;
      for (let i = iLo; i <= iHi; i += 1) for (let j = jLo; j <= jHi; j += 1) {
        const k = i * Z_COUNT + j;
        if (limit < heights[k]) { heights[k] = limit; splats += 1; }
      }
    }
  }
  if (used) posesUsed += 1;
}
if (violations.length) {
  throw new Error(`teeth strike the plain D outside the carved bands: ${JSON.stringify(violations.slice(0, 5))}`);
}

const quantized = Array.from(heights, (h) => Math.floor(h * HEIGHT_SCALE));
const minHeight = Math.min(...quantized) / HEIGHT_SCALE;
const bandFloor = Math.floor((minHeight - 0.03) * 100) / 100;
const dBottomAtBandEdge = -Math.sqrt(g.palletRadius ** 2 - Z_END ** 2);
if (bandFloor - 0.005 <= dBottomAtBandEdge) throw new Error(`band floor ${bandFloor} breaks through the D`);
const centreColumn = zs.findIndex((z) => Math.abs(z - g.wheelPlaneOffset) < dz / 2);
const rampRise = (quantized[(X_COUNT - 1) * Z_COUNT + centreColumn] - quantized[centreColumn]) / HEIGHT_SCALE;
const sweptRampAngle = Math.atan2(rampRise, x1 - x0);

const fingerprintKeys = ['dropAngle', 'dropDurationInCycles', 'frontMountPhase', 'impulseLimitAngle', 'palletAmplitude',
  'palletCenterY', 'palletRadius', 'palletThickness', 'rearMountPhase', 'restFaceX', 'toothCount', 'wheelCenterY',
  'wheelContactRadius', 'wheelDepth', 'wheelPlaneOffset', 'wheelRimRadius'];
const geometryFingerprint = Object.fromEntries(fingerprintKeys.map((key) => [key, g[key]]));
geometryFingerprint.toothProfile = { ...g.toothProfile };
const inputs = JSON.stringify({
  SAMPLES, POINT_SPACING, CLEARANCE, DILATION, X_COUNT, Z_START, Z_END, Z_COUNT, LIP_HALF_WIDTH, FLANGE_CAP,
  geometryFingerprint, toothGeometry: toothHash.digest('hex'),
});
const inputHash = createHash('sha256').update(inputs).digest('hex').slice(0, 16);
const payload = {
  inputHash, geometryFingerprint, samples: SAMPLES, pointSpacing: POINT_SPACING, clearance: CLEARANCE, dilation: DILATION,
  bandFloor, flangeCap: FLANGE_CAP, flangeSkin: FLANGE_SKIN, heightScale: HEIGHT_SCALE, lipHalfWidth: LIP_HALF_WIDTH,
  sweptRampAngle: Number(sweptRampAngle.toFixed(6)),
  x: { count: X_COUNT },
  z: { count: Z_COUNT, end: Z_END, start: Z_START },
  heights: quantized,
};
const file = `// Generated by scripts/generate-debaufre-300-301-pallet.mjs; do not edit.
export const DEBAUFRE_300_301_PALLET = Object.freeze(${JSON.stringify(payload)});
`;
await writeFile(new URL('../src/simulation/baked/debaufre-300-301-pallet.js', import.meta.url), file);
console.log(JSON.stringify({
  inputHash, posesUsed, splats, minHeight, bandFloor,
  sweptRampAngleDegrees: THREE.MathUtils.radToDeg(sweptRampAngle),
  toothPoints: teeth[0].points.length,
}));
