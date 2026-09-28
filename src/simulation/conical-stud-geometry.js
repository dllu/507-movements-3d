import * as THREE from 'three';
import { rackGeneratedOutline } from './noncircular-gear-geometry.js';
import { conicalStudCut as savedCut } from '../data/conical-stud-profile.js';
import { creaseIndexedNormals } from './crease-normals.js';

const turn = 2 * Math.PI;
/** Crown sag of the round stud heads at their rim. */
export const conicalStudCrownSag = 0.03;
const cache = new Map();

export const conicalStudParameters = Object.freeze({
  centerDistance: 1.8, radiusSlope: 0.42, axialAmplitude: 0.96,
  // Brown draws round stud heads nearly flush on the cone face. The toothed
  // cone therefore carries short stub teeth (addendum 0.15 module), so the
  // stud body can sit close to its pitch cone and the round heads, faced
  // parallel to the cone, stand only about 0.05 proud while still entering
  // the tooth spaces.
  halfHeight: 1.1, teeth: 17, studCount: 14, studRadius: 0.07,
  studFront: 0.025, studBack: 0.20, toothAddendumFactor: 0.15,
});

/** An end-to-end spiral with equal axial steps, as in the engraving.
 * Nominal indexing integrates adjacent pitch ratios. This is prescribed
 * motion; continuous force transmission across the spiral seam is unresolved.
 */
export function conicalStudMotion({ centerDistance, radiusSlope, axialAmplitude, teeth, studCount }) {
  const pitch = turn / teeth;
  const heights = Array.from({ length: studCount }, (_, index) =>
    -axialAmplitude + 2 * axialAmplitude * index / (studCount - 1));
  const ratiosAt = (mean) => heights.map((height) => {
    const radius = mean + radiusSlope * height;
    return (centerDistance - radius) / radius;
  });
  let low = radiusSlope * axialAmplitude + 0.001;
  let high = centerDistance - radiusSlope * axialAmplitude - 0.001;
  for (let iteration = 0; iteration < 60; iteration += 1) {
    const mean = (low + high) / 2;
    const ratios = ratiosAt(mean);
    const period = ratios.reduce((sum, ratio, index) => sum + 2 * pitch
      / (ratio + ratios[(index + 1) % studCount]), 0);
    if (period < turn) low = mean;
    else high = mean;
  }
  const meanRadius = (low + high) / 2;
  const ratios = ratiosAt(meanRadius);
  let output = 0;
  const studs = heights.map((height, index) => {
    const ratio = ratios[index];
    const nextRatio = ratios[(index + 1) % studCount];
    const span = 2 * pitch / (ratio + nextRatio);
    const stud = { output, height, angle: Math.PI + output,
      radius: centerDistance - meanRadius - radiusSlope * height,
      ratio, nextRatio, span, input: index * pitch };
    output += span;
    return stud;
  });
  const inputCycleAngle = pitch * studCount;
  const stateAtOutput = (angle) => {
    const cycles = Math.floor(angle / turn);
    const phase = THREE.MathUtils.euclideanModulo(angle, turn);
    const stud = studs.find((s) => phase < s.output + s.span) ?? studs.at(-1);
    const fraction = (phase - stud.output) / stud.span;
    const ratio = stud.ratio + (stud.nextRatio - stud.ratio) * fraction;
    const input = cycles * inputCycleAngle + stud.input + stud.span
      * (stud.ratio * fraction + (stud.nextRatio - stud.ratio) * fraction ** 2 / 2);
    const virtualHeight = (centerDistance / (1 + ratio) - meanRadius) / radiusSlope;
    return { input, ratio, fraction, virtualHeight, stud };
  };
  const inputAtOutput = (angle) => stateAtOutput(angle).input;
  const outputAtInput = (input) => {
    const cycles = Math.floor(input / inputCycleAngle);
    const phase = THREE.MathUtils.euclideanModulo(input, inputCycleAngle);
    const index = Math.min(studCount - 1, Math.floor(phase / pitch));
    const stud = studs[index];
    const local = (phase - stud.input) / stud.span;
    const fraction = 2 * local / (stud.ratio
      + Math.sqrt(stud.ratio ** 2 + 2 * (stud.nextRatio - stud.ratio) * local));
    return cycles * turn + stud.output + stud.span * fraction;
  };
  const heightAtOutput = (outputAngle) => stateAtOutput(outputAngle).virtualHeight;
  return { inputAtOutput, outputAtInput, stateAtOutput, heightAtOutput,
    variation: radiusSlope * axialAmplitude, meanRadius, slope: radiusSlope, studs, inputCycleAngle };
}

function unitOutline(teeth, addendumFactor = 1) {
  return rackGeneratedOutline({
    pitchPoints: Array.from({ length: 720 }, (_, index) =>
      new THREE.Vector2(Math.cos(turn * index / 720), Math.sin(turn * index / 720))),
    teeth, contactPointIndex: 0, toothAtContact: false, addendumFactor,
  }).points;
}

/** Homothetic transverse involutes give straight generators over the entire
 * conical face. The two end contours and each flank lie on one conical scale;
 * this is a parallel-axis tapered pinion, not an intersecting-axis bevel pair.
 */
export function conicalStudToothGeometry(parameters) {
  const motion = conicalStudMotion(parameters);
  const outline = unitOutline(parameters.teeth, parameters.toothAddendumFactor);
  const columns = outline.length / parameters.teeth;
  const { halfHeight } = parameters;
  const positions = [];
  const normals = [];
  const triangle = (a, b, c, desired) => {
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if (normal.dot(desired) < 0) { [b, c] = [c, b]; normal.negate(); }
    for (const p of [a, b, c]) {
      positions.push(p.x, p.y, p.z);
      normals.push(normal.x, normal.y, normal.z);
    }
  };
  const at = (index, height) => new THREE.Vector3(
    outline[index].x * (motion.meanRadius + motion.slope * height),
    outline[index].y * (motion.meanRadius + motion.slope * height), height);
  const bottomCenter = new THREE.Vector3(0, 0, -halfHeight);
  const topCenter = new THREE.Vector3(0, 0, halfHeight);
  for (let i = 0; i < columns; i += 1) {
    const a = at(i, -halfHeight), b = at(i + 1, -halfHeight);
    const c = at(i, halfHeight), d = at(i + 1, halfHeight);
    const outward = new THREE.Vector3(b.y - a.y, a.x - b.x, 0);
    triangle(a, b, c, outward);
    triangle(b, d, c, outward);
    triangle(bottomCenter, b, a, new THREE.Vector3(0, 0, -1));
    triangle(topCenter, c, d, new THREE.Vector3(0, 0, 1));
  }
  for (const col of [0, columns]) {
    const angle = col * turn / outline.length, sign = col === 0 ? -1 : 1;
    const normal = new THREE.Vector3(-Math.sin(angle) * sign, Math.cos(angle) * sign, 0);
    const bottom = at(col, -halfHeight), top = at(col, halfHeight);
    triangle(bottomCenter, bottom, topCenter, normal);
    triangle(bottom, top, topCenter, normal);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.userData.unitOutline = outline;
  geometry.userData.conicalInvolute = true;
  return geometry;
}

function headTopology(parameters) {
  const rings = 16, sectors = 64;
  const points = [{ u: 0, v: 0 }];
  const indices = [];
  for (let ring = 1; ring <= rings; ring += 1) {
    for (let col = 0; col < sectors; col += 1) {
      const a = turn * col / sectors, radius = parameters.studRadius * ring / rings;
      points.push({ u: radius * Math.cos(a), v: radius * Math.sin(a) });
    }
  }
  for (let col = 0; col < sectors; col += 1) indices.push(0, 1 + col, 1 + (col + 1) % sectors);
  for (let ring = 1; ring < rings; ring += 1) {
    for (let col = 0; col < sectors; col += 1) {
      const a = 1 + (ring - 1) * sectors + col;
      const b = 1 + (ring - 1) * sectors + (col + 1) % sectors;
      const c = a + sectors, d = b + sectors;
      indices.push(a, c, b, b, c, d);
    }
  }
  return { points, indices, rings, sectors };
}

/** Remove the synchronized pinion from the stud blanks. The uncut cone stays
 * continuous. This addresses geometric interference; a cut alone does not
 * establish continuous contact or force transmission, particularly at the seam.
 */
export function conicalStudCut(parameters, { regenerate = false } = {}) {
  const key = JSON.stringify(parameters);
  if (!regenerate && cache.has(key)) return cache.get(key);
  if (!regenerate && savedCut?.key === key) { cache.set(key, savedCut); return savedCut; }
  const motion = conicalStudMotion(parameters);
  const outline = unitOutline(parameters.teeth, parameters.toothAddendumFactor);
  const topology = headTopology(parameters);
  const count = outline.length, angleStep = turn / count;
  const samples = 19200, clearance = 0.0012;
  const { centerDistance, studBack, studFront } = parameters;
  const pins = motion.studs.map((stud) => topology.points.map(({ u, v }) => ({
    angle: stud.angle + u / stud.radius, height: stud.height + v,
    base: centerDistance - motion.meanRadius - motion.slope * (stud.height + v) - studBack,
    // The uncut head face runs parallel to the cone face, a fixed step past
    // the local pitch cone, so no edge of a round head stands up higher.
    cap: centerDistance - motion.meanRadius - motion.slope * (stud.height + v) + studFront,
  })));
  for (let sample = 0; sample < samples; sample += 1) {
    const output = turn * sample / samples, input = motion.inputAtOutput(output);
    const cosInput = Math.cos(input), sinInput = Math.sin(input);
    for (const [index, stud] of motion.studs.entries()) {
      const blankRadius = centerDistance - stud.radius + studFront
        + parameters.studRadius * (1 + motion.slope);
      if (centerDistance ** 2 + stud.radius ** 2
        + 2 * centerDistance * stud.radius * Math.cos(stud.angle - output) > blankRadius ** 2) continue;
      for (const point of pins[index]) {
        const pitchRadius = motion.meanRadius + motion.slope * point.height;
        const ox = centerDistance * cosInput / pitchRadius;
        const oy = -centerDistance * sinInput / pitchRadius;
        const dx = Math.cos(point.angle - output - input);
        const dy = Math.sin(point.angle - output - input);
        const start = Math.atan2(oy + point.base / pitchRadius * dy, ox + point.base / pitchRadius * dx);
        const end = Math.atan2(oy + point.cap / pitchRadius * dy, ox + point.cap / pitchRadius * dx);
        const delta = THREE.MathUtils.euclideanModulo(end - start + Math.PI, turn) - Math.PI;
        const first = Math.floor(Math.min(start, start + delta) / angleStep) - 1;
        const last = Math.ceil(Math.max(start, start + delta) / angleStep) + 1;
        for (let edge = first; edge <= last; edge += 1) {
          const a = outline[THREE.MathUtils.euclideanModulo(edge, count)];
          const b = outline[THREE.MathUtils.euclideanModulo(edge + 1, count)];
          const ex = b.x - a.x, ey = b.y - a.y;
          const denominator = dx * ey - dy * ex;
          if (Math.abs(denominator) < 1e-12) continue;
          const radial = ((a.x - ox) * ey - (a.y - oy) * ex) / denominator * pitchRadius;
          const fraction = ((a.x - ox) * dy - (a.y - oy) * dx) / denominator;
          if (fraction >= 0 && fraction <= 1 && radial >= point.base && radial < point.cap) {
            point.cap = radial - clearance;
          }
        }
      }
    }
  }
  // Relief over each triangle's neighborhood prevents sharp envelope corners
  // being bridged by the rendered, piecewise-planar stud cap.
  const caps = pins.map((points) => {
    const values = points.map((point) => point.cap);
    const relieved = [...values];
    for (let i = 0; i < topology.indices.length; i += 3) {
      const triangle = topology.indices.slice(i, i + 3);
      const radius = Math.min(...triangle.map((index) => values[index]));
      for (const index of triangle) relieved[index] = Math.min(relieved[index], radius);
    }
    return relieved;
  });
  const result = { key, caps, samples, clearance };
  cache.set(key, result);
  return result;
}

export function conicalStudHeadGeometry(parameters, index) {
  const cut = conicalStudCut(parameters), motion = conicalStudMotion(parameters);
  const stud = motion.studs[index], topology = headTopology(parameters);
  const positions = [], indices = [...topology.indices];
  const { points, sectors, rings } = topology;
  for (const back of [false, true]) {
    for (const [i, { u, v }] of points.entries()) {
      const angle = stud.angle + u / stud.radius, height = stud.height + v;
      const pitch = parameters.centerDistance - motion.meanRadius - motion.slope * height;
      // Round (button) heads: a shallow crown, highest at the stud's axis,
      // so a head at the silhouette reads as Brown's round stud and not as
      // a square block. The crown only removes material inside the cut cap.
      const crown = pitch + parameters.studFront
        - conicalStudCrownSag * (u * u + v * v) / parameters.studRadius ** 2;
      const radius = back ? pitch - parameters.studBack : Math.min(cut.caps[index][i], crown);
      positions.push(radius * Math.cos(angle), radius * Math.sin(angle), height);
    }
  }
  const offset = points.length;
  for (let i = 0; i < topology.indices.length; i += 3) {
    const [a, b, c] = topology.indices.slice(i, i + 3);
    indices.push(offset + a, offset + c, offset + b);
  }
  for (let col = 0; col < sectors; col += 1) {
    const a = 1 + (rings - 1) * sectors + col;
    const b = 1 + (rings - 1) * sectors + (col + 1) % sectors;
    indices.push(a, offset + a, b, b, offset + a, offset + b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  // Hard edges where the cut cap meets the stud's side wall and back.
  creaseIndexedNormals(geometry);
  geometry.userData.generatedStudHead = true;
  geometry.userData.cut = cut;
  return geometry;
}
