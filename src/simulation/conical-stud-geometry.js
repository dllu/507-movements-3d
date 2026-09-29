import * as THREE from 'three';
import { creaseIndexedNormals } from './crease-normals.js';

const turn = 2 * Math.PI;

// Pass 101 (user direction): the studs are spheres whose centres lie ON the
// stud cone's pitch surface, strung along ONE revolution of an Archimedean
// spiral in plan, r(psi) linear in psi, from the cone's bottom rim to its top
// rim (inset by the stud radius so every sphere lies within the cone's
// height). The flutes of the toothed cone are straight ball grooves: each is
// a round channel about a generator of the toothed pitch cone, so it follows
// Brown's straight flute lines and receives a sphere at any height.
//
// Brown's cones (plate 37), scaled to a 1.8 centre distance: 2.07 tall, the
// toothed cone about 1.55 across the top and 0.45 at the foot on a mean near
// 1.02; he draws about 28 flutes. 24 flutes keep a 0.028 land between the
// 0.045-radius studs' grooves at the foot of the toothed cone.
export const conicalStudParameters = Object.freeze({
  centerDistance: 1.8, radiusSlope: 0.53, halfHeight: 1.035,
  teeth: 24, studCount: 23, studRadius: 0.045,
  // The spiral's two ends sit at one plan angle. A stud at each end would
  // put the top and bottom studs in one flute at once with ratios 0.15 and
  // 2.8, so the top stud (on the slender end of the stud cone) could not
  // leave its flute. The seam therefore spans seamGap of output angle with
  // no stud (the top stud stands seamGap short of the spiral's top end, where
  // Brown's spacing is already about 45 degrees) and the toothed cone
  // advances seamFlutes pitches across it.
  seamGap: 0.7, seamFlutes: 2, seamBlend: 0.12,
  // Stud body runs just inside its pitch cone; the lands are the toothed
  // pitch cone itself.
  studBodyRelief: 0.004,
  // Ball-groove radius, linear in height: every sphere clears the flutes at
  // all poses (the widest need is where top studs approach, see
  // scripts/probe-conical-stud-contact.mjs).
  grooveRadiusBottom: 0.0485, grooveRadiusTop: 0.0585,
});

const smootherIntegral = (u) => u ** 4 * (2.5 - 3 * u + u * u);
const smootherStep = (u) => u ** 3 * (10 - 15 * u + 6 * u * u);

/** Prescribed motion: while stud i is engaged the pitch cones roll at the
 * spiral's height under the line of centres, so input angle is the integral
 * of Rs/Rt (closed form, the radii being linear in output angle). Across
 * the seam the rate blends from the top ratio to the bottom ratio. */
export function conicalStudMotion(parameters = conicalStudParameters) {
  const { centerDistance: C, radiusSlope: k, halfHeight, teeth, studCount: n,
    studRadius, seamGap: g, seamFlutes: q, seamBlend } = parameters;
  const pitch = turn / teeth;
  const bottomHeight = -halfHeight + studRadius, topHeight = halfHeight - studRadius;
  const heightAt = (psi) => bottomHeight + (topHeight - bottomHeight) * psi / turn;
  const spiralEnd = turn - g;
  const b = k * (topHeight - bottomHeight) / turn;
  const integral = (mean, psi) => {
    const r0 = mean + k * bottomHeight;
    return C / b * Math.log((r0 + b * psi) / r0) - psi;
  };
  let low = 0.8, high = 1.25;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const mean = (low + high) / 2;
    if (integral(mean, spiralEnd) > (n - 1) * pitch) low = mean;
    else high = mean;
  }
  const meanRadius = (low + high) / 2;
  const toothedRadius = (height) => meanRadius + k * height;
  const studPitchRadius = (height) => C - toothedRadius(height);
  const rateAt = (psi) => studPitchRadius(heightAt(psi)) / toothedRadius(heightAt(psi));
  const topRate = rateAt(spiralEnd), bottomRate = rateAt(0);
  const seamSwitch = (bottomRate * g - q * pitch) / (bottomRate - topRate);
  const seamInput = (x) => {
    // x: output angle past the top stud (0..g).
    const u = (x - seamSwitch + seamBlend) / (2 * seamBlend);
    const blended = u <= 0 ? 0 : u >= 1 ? 2 * seamBlend * (smootherIntegral(1) + (u - 1))
      : 2 * seamBlend * smootherIntegral(u);
    return (n - 1) * pitch + topRate * x + (bottomRate - topRate) * blended;
  };
  const seamRate = (x) => {
    const u = THREE.MathUtils.clamp((x - seamSwitch + seamBlend) / (2 * seamBlend), 0, 1);
    return topRate + (bottomRate - topRate) * smootherStep(u);
  };
  const inputCycleAngle = (n - 1 + q) * pitch;
  const phaseInput = (psi) => (psi <= spiralEnd ? integral(meanRadius, psi) : seamInput(psi - spiralEnd));
  const phaseRate = (psi) => (psi <= spiralEnd ? rateAt(psi) : seamRate(psi - spiralEnd));
  const studs = Array.from({ length: n }, (_, index) => {
    let lo = 0, hi = spiralEnd;
    for (let iteration = 0; iteration < 70; iteration += 1) {
      const mid = (lo + hi) / 2;
      if (integral(meanRadius, mid) < index * pitch) lo = mid; else hi = mid;
    }
    const output = index === n - 1 ? spiralEnd : (lo + hi) / 2;
    const height = heightAt(output);
    return { output, height, angle: Math.PI + output, radius: studPitchRadius(height),
      ratio: toothedRadius(height) / studPitchRadius(height), input: index * pitch };
  });
  const stateAtOutput = (angle) => {
    const cycles = Math.floor(angle / turn);
    const phase = angle - cycles * turn;
    const rate = phaseRate(phase);
    const input = cycles * inputCycleAngle + phaseInput(phase);
    const index = studs.findLastIndex((stud) => stud.output <= phase + 1e-12);
    return { input, rate, ratio: 1 / rate, stud: studs[Math.max(0, index)],
      seam: phase > spiralEnd, virtualHeight: heightAt(Math.min(phase, spiralEnd)) };
  };
  const inputAtOutput = (angle) => stateAtOutput(angle).input;
  const outputAtInput = (input) => {
    const cycles = Math.floor(input / inputCycleAngle);
    const target = input - cycles * inputCycleAngle;
    let lo = 0, hi = turn;
    for (let iteration = 0; iteration < 64; iteration += 1) {
      const mid = (lo + hi) / 2;
      if (phaseInput(mid) < target) lo = mid; else hi = mid;
    }
    // One Newton step on the smooth phase law polishes the bisection.
    let psi = (lo + hi) / 2;
    psi -= (phaseInput(psi) - target) / phaseRate(psi);
    return cycles * turn + psi;
  };
  return { studs, meanRadius, slope: k, pitch, inputCycleAngle, spiralEnd, seamSwitch,
    bottomHeight, topHeight, heightAt, toothedRadius, studPitchRadius, topRate, bottomRate,
    stateAtOutput, inputAtOutput, outputAtInput,
    variation: k * (topHeight - bottomHeight) / 2 };
}

export function conicalStudGrooveRadius(parameters, height) {
  const { halfHeight, grooveRadiusBottom, grooveRadiusTop } = parameters;
  return THREE.MathUtils.lerp(grooveRadiusBottom, grooveRadiusTop, (height + halfHeight) / (2 * halfHeight));
}

/** Radius of the fluted cone's surface at local angle and height. The groove
 * about each generator is round in its own normal section; a horizontal slice
 * cuts it as an ellipse, radial semi-axis rho*sqrt(1+k^2), tangential rho. */
export function conicalStudFluteRadius(parameters, motion, angle, height) {
  const R = motion.toothedRadius(height), p = motion.pitch;
  const rho = conicalStudGrooveRadius(parameters, height);
  const A = rho * Math.hypot(1, parameters.radiusSlope), B = rho;
  const t = angle - Math.round(angle / p) * p;
  // Ray from the axis at angle t against the ellipse centred at (R, 0).
  const c = Math.cos(t), s = Math.sin(t);
  const qa = (c / A) ** 2 + (s / B) ** 2, qb = -2 * R * c / A ** 2, qc = (R / A) ** 2 - 1;
  const disc = qb * qb - 4 * qa * qc;
  if (disc <= 0) return R;
  const inner = (-qb - Math.sqrt(disc)) / (2 * qa);
  return Math.min(R, inner);
}

/** The fluted (toothed) cone as one closed solid: the pitch-cone lands with
 * a straight ball groove along each of its generators, and flat end faces. */
export function conicalStudFlutedConeGeometry(parameters = conicalStudParameters, motion = conicalStudMotion(parameters)) {
  const { halfHeight, teeth, radiusSlope: k } = parameters;
  const p = motion.pitch, rows = 36, grooveSegments = 18, landSegments = 4;
  const positions = [], indices = [];
  const rowStart = [];
  let columns = 0;
  for (let row = 0; row <= rows; row += 1) {
    const z = -halfHeight + 2 * halfHeight * row / rows;
    const R = motion.toothedRadius(z), rho = conicalStudGrooveRadius(parameters, z);
    const A = rho * Math.hypot(1, k), B = rho;
    // Edge: the land circle meets the ellipse at x = R - A^2/(2R) + ...;
    // solve (R cos t - R)^2/A^2 + (R sin t)^2/B^2 = 1 for t by bisection.
    let lo = 0, hi = p / 2;
    for (let i = 0; i < 60; i += 1) {
      const t = (lo + hi) / 2;
      const f = ((R * Math.cos(t) - R) / A) ** 2 + (R * Math.sin(t) / B) ** 2 - 1;
      if (f < 0) lo = t; else hi = t;
    }
    const edge = (lo + hi) / 2;
    const edgeBeta = Math.atan2(R * Math.sin(edge) / B, (R * Math.cos(edge) - R) / A);
    const ring = [];
    for (let flute = 0; flute < teeth; flute += 1) {
      const centre = flute * p;
      const put = (angle, radius) => ring.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
      const local = (x, y) => [centre + Math.atan2(y, x), Math.hypot(x, y)];
      for (let i = 0; i < grooveSegments; i += 1) {
        // Groove: ellipse parameter from -edgeBeta round through pi to +edgeBeta.
        const beta = -edgeBeta - (turn - 2 * edgeBeta) * i / grooveSegments;
        const [angle, radius] = local(R + A * Math.cos(beta), B * Math.sin(beta));
        put(angle, radius);
      }
      for (let i = 0; i < landSegments; i += 1) {
        const angle = centre + edge + (p - 2 * edge) * i / landSegments;
        put(angle, R);
      }
    }
    // The ring runs anticlockwise: each groove from its left edge down
    // through its root to the right edge, then the land to the next groove.
    const ordered = ring;
    columns = ordered.length;
    rowStart.push(positions.length / 3);
    for (const [x, y] of ordered) positions.push(x, y, z);
  }
  const quad = (a, b, c, d) => indices.push(a, b, d, b, c, d);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      const a = rowStart[row] + col, b = rowStart[row] + (col + 1) % columns;
      quad(a, b, b + columns, a + columns);
    }
  }
  // Flat end faces: fans from the axis over each end ring (own vertices).
  for (const [row, sign] of [[0, -1], [rows, 1]]) {
    const centre = positions.length / 3;
    positions.push(0, 0, sign * halfHeight);
    const start = positions.length / 3;
    for (let col = 0; col < columns; col += 1) {
      const v = rowStart[row] + col;
      positions.push(positions[3 * v], positions[3 * v + 1], positions[3 * v + 2]);
    }
    for (let col = 0; col < columns; col += 1) {
      const a = start + col, b = start + (col + 1) % columns;
      if (sign > 0) indices.push(centre, a, b); else indices.push(centre, b, a);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  // Orient outward: the first side quad's normal must point away from the axis.
  const v = (i) => new THREE.Vector3(positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]);
  const [i0, i1, i2] = indices;
  const n = v(i1).sub(v(i0)).cross(v(i2).sub(v(i0)));
  const mid = v(i0).setZ(0);
  if (n.dot(mid) < 0) {
    const index = geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      const t = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, t);
    }
  }
  creaseIndexedNormals(geometry, Math.PI / 5);
  geometry.userData.flutedCone = true;
  geometry.userData.fluteCount = teeth;
  return geometry;
}
