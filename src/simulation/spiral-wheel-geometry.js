import * as THREE from 'three';
import { spiralCut } from '../data/contact-profiles.js';
import { creaseIndexedNormals } from './crease-normals.js';

const cache = new Map();

/** Cut a driven wheel with the swept single-start face thread.
 * Its transverse sections vary across the wheel width: an ordinary extruded
 * involute cannot be conjugate to this spiral at every axial station.
 * With `rib` ({ halfWidth, base, top }) the thread is a flat-topped,
 * vertical-walled rib with round plan ends, cut exactly plane by plane;
 * otherwise it is a round wire of `ridgeRadius` centred at `threadZ`.
 */
export function spiralWheelGeometry({
  teeth, outerRadius, depth, centerX, centerZ,
  threadZ, ridgeRadius, startRadius, lead, startAngle, gearPhase, rib,
}, { regenerate = false } = {}) {
  const key = JSON.stringify({ teeth, outerRadius, depth, centerX, centerZ,
    threadZ, ridgeRadius, startRadius, lead, startAngle, gearPhase, ...(rib ? { rib } : {}) });
  if (!regenerate && cache.has(key)) return cache.get(key).clone();
  const axialSteps = 16;
  const angularSteps = 128;
  const phaseSteps = 1440;
  const threadSteps = 96;
  const clearance = 0.0005;
  const pitch = 2 * Math.PI / teeth;
  const baked = !regenerate && spiralCut?.key === key ? spiralCut.radii : null;
  const radii = baked ? Float64Array.from(baked) : new Float64Array((axialSteps + 1) * (angularSteps + 1)).fill(outerRadius);
  if (!baked && rib) {
    cutFlatRib({ radii, teeth, outerRadius, depth, centerX, centerZ, startRadius, lead, startAngle,
      gearPhase, rib, axialSteps, angularSteps, phaseSteps, clearance, pitch });
  } else if (!baked) {
    const betaLimit = Math.asin((depth / 2 + ridgeRadius) / startRadius);
    for (let phase = 0; phase <= phaseSteps; phase += 1) {
      const diskAngle = 2 * Math.PI * phase / phaseSteps;
      const gearAngle = gearPhase + diskAngle / teeth;
      const samples = [];
      for (let step = 0; step <= threadSteps; step += 1) {
        const beta = -betaLimit + 2 * betaLimit * step / threadSteps;
        const progress = THREE.MathUtils.euclideanModulo(beta - diskAngle - startAngle, 2 * Math.PI) / (2 * Math.PI);
        const radius = startRadius + lead * progress;
        samples.push({ x: radius * Math.cos(beta), y: radius * Math.sin(beta) });
      }
      // Include both open thread ends at the handoff, even when the regular
      // angular samples fall on only one side of the spiral's radial step.
      for (const radius of [startRadius, startRadius + lead]) {
        samples.push({ x: radius * Math.cos(startAngle + diskAngle), y: radius * Math.sin(startAngle + diskAngle) });
      }
      for (const point of samples) {
        const x = point.x - centerX;
        const y = centerZ - threadZ;
        const distance = Math.hypot(x, y);
        if (distance - ridgeRadius > outerRadius) continue;
        const angle = THREE.MathUtils.euclideanModulo(Math.atan2(y, x) - gearAngle + pitch / 2, pitch) - pitch / 2;
        for (let axial = 0; axial <= axialSteps; axial += 1) {
          const offset = point.y - (-depth / 2 + depth * axial / axialSteps);
          const squaredSectionRadius = ridgeRadius ** 2 - offset ** 2;
          if (squaredSectionRadius <= 0) continue;
          for (let angular = 0; angular <= angularSteps; angular += 1) {
            const theta = -pitch / 2 + pitch * angular / angularSteps;
            const difference = THREE.MathUtils.euclideanModulo(theta - angle + pitch / 2, pitch) - pitch / 2;
            const transverse = distance * Math.sin(difference);
            const discriminant = squaredSectionRadius - transverse ** 2;
            if (discriminant < 0) continue;
            const intersection = distance * Math.cos(difference) - Math.sqrt(discriminant);
            const index = axial * (angularSteps + 1) + angular;
            radii[index] = Math.min(radii[index], intersection - clearance);
          }
        }
      }
    }
  }
  if (!baked) {
    // Keep linear mesh interpolation on the material-removal side of the cut.
    const sampled = radii.slice();
    for (let axial = 0; axial <= axialSteps; axial += 1) {
      for (let angular = 0; angular <= angularSteps; angular += 1) {
        const index = axial * (angularSteps + 1) + angular;
        for (let da = -1; da <= 1; da += 1) {
          for (let dt = -1; dt <= 1; dt += 1) {
            const a = THREE.MathUtils.clamp(axial + da, 0, axialSteps);
            const t = THREE.MathUtils.euclideanModulo(angular + dt, angularSteps);
            radii[index] = Math.min(radii[index], sampled[a * (angularSteps + 1) + t]);
          }
        }
      }
    }
  }
  // Build each axial station's tooth outline with its features aligned:
  // root, rising flank, tip and falling flank get fixed point counts, and the
  // flank points sit at fixed radius levels found at sub-sample precision.
  // Neighbouring stations then join flank to flank, so the slightly twisted
  // flanks are smooth ruled strips instead of grid stair-steps.
  const profiles = alignedToothProfiles(radii, axialSteps, angularSteps, pitch);
  const profileCount = profiles[0].length;
  const positions = [];
  const indices = [];
  const stride = profileCount * teeth + 1;
  for (let axial = 0; axial <= axialSteps; axial += 1) {
    const z = -depth / 2 + depth * axial / axialSteps;
    for (let tooth = 0; tooth <= teeth; tooth += 1) {
      for (let k = 0; k < profileCount; k += 1) {
        if (tooth === teeth && k > 0) break;
        const { theta, radius } = profiles[axial][k];
        const angle = theta + pitch * tooth;
        positions.push(radius * Math.cos(angle), radius * Math.sin(angle), z);
      }
    }
  }
  const circumferenceSteps = stride - 1;
  for (let axial = 0; axial < axialSteps; axial += 1) {
    for (let angular = 0; angular < circumferenceSteps; angular += 1) {
      const a = axial * stride + angular;
      indices.push(a, a + 1, a + stride + 1, a, a + stride + 1, a + stride);
    }
  }
  const backCenter = positions.length / 3;
  positions.push(0, 0, -depth / 2, 0, 0, depth / 2);
  for (let angular = 0; angular < circumferenceSteps; angular += 1) {
    indices.push(backCenter, angular + 1, angular);
    const a = axialSteps * stride + angular;
    indices.push(backCenter + 1, a, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  // Hard edges between the tooth flanks, tips and the flat end faces.
  creaseIndexedNormals(geometry);
  geometry.userData = { profileKey: key, axialSteps, angularSteps, circumferenceSteps, clearance,
    depth, pitch, radii: Array.from(radii), rootRadius: Math.min(...radii), outerRadius };
  cache.set(key, geometry);
  return geometry.clone();
}

/** One tooth pitch per sampled station as feature-aligned (theta, radius)
 * points from -pitch/2 (inclusive) to +pitch/2 (exclusive). The sampled cut
 * quantizes each flank to whole angular columns, which steps by a column
 * between stations. Each flank level is therefore smoothed across the
 * stations and then offset onto the material-removal side, so the twisted
 * flank is a smooth surface that never stands proud of the exact cut. */
function alignedToothProfiles(radii, axialSteps, angularSteps, pitch) {
  const levels = 10, rootPoints = 12, tipPoints = 16;
  const thetaAt = (i) => -pitch / 2 + pitch * i / angularSteps;
  const stations = [];
  for (let axial = 0; axial <= axialSteps; axial += 1) {
    const row = Array.from({ length: angularSteps + 1 }, (_, i) => radii[axial * (angularSteps + 1) + i]);
    const root = Math.min(...row), tip = Math.max(...row);
    const levelRadius = (k) => root + (tip - root) * (0.002 + 0.996 * k / levels);
    const crossing = (r, rising) => {
      if (rising) {
        for (let i = 1; i <= angularSteps; i += 1) {
          if (row[i] >= r) return thetaAt(i - 1) + (thetaAt(i) - thetaAt(i - 1)) * (r - row[i - 1]) / (row[i] - row[i - 1]);
        }
      } else {
        for (let i = angularSteps - 1; i >= 0; i -= 1) {
          if (row[i] >= r) return thetaAt(i + 1) + (thetaAt(i) - thetaAt(i + 1)) * (r - row[i + 1]) / (row[i] - row[i + 1]);
        }
      }
      throw new Error('spiral wheel tooth has no flank');
    };
    const radiusAt = (theta) => {
      const x = (theta + pitch / 2) / pitch * angularSteps;
      const i = THREE.MathUtils.clamp(Math.floor(x), 0, angularSteps - 1);
      return THREE.MathUtils.lerp(row[i], row[i + 1], x - i);
    };
    const rise = [], fall = [], radius = [];
    for (let k = 0; k <= levels; k += 1) {
      radius.push(levelRadius(k));
      rise.push(crossing(levelRadius(k), true));
      fall.push(crossing(levelRadius(k), false));
    }
    stations.push({ radiusAt, rise, fall, radius });
  }
  // Smooth each level across the stations (5-station moving average), then
  // shift it to the conservative side: the rising flank may only move
  // towards +theta and the falling flank towards -theta.
  const smoothLevel = (values, conservativeSign) => {
    const smooth = values.map((_, a) => {
      let sum = 0, weight = 0;
      for (let d = -2; d <= 2; d += 1) {
        const b = THREE.MathUtils.clamp(a + d, 0, values.length - 1);
        const w = 3 - Math.abs(d);
        sum += w * values[b]; weight += w;
      }
      return sum / weight;
    });
    let shift = 0;
    for (let a = 0; a < values.length; a += 1) shift = Math.max(shift, conservativeSign * (values[a] - smooth[a]));
    return smooth.map((v) => v + conservativeSign * shift);
  };
  for (let k = 0; k <= levels; k += 1) {
    const rise = smoothLevel(stations.map((s) => s.rise[k]), 1);
    const fall = smoothLevel(stations.map((s) => s.fall[k]), -1);
    stations.forEach((s, a) => { s.rise[k] = rise[a]; s.fall[k] = fall[a]; });
  }
  return stations.map(({ radiusAt, rise, fall, radius }) => {
    for (let k = 1; k <= levels; k += 1) {
      rise[k] = Math.max(rise[k], rise[k - 1]);
      fall[k] = Math.min(fall[k], fall[k - 1]);
    }
    const points = [];
    const span = (from, to, count) => {
      for (let j = 0; j < count; j += 1) {
        const theta = from + (to - from) * j / count;
        points.push({ theta, radius: Math.min(radiusAt(theta), radius[0]) });
      }
    };
    const tipSpan = (from, to, count) => {
      for (let j = 0; j < count; j += 1) points.push({ theta: from + (to - from) * j / count, radius: radius[levels] });
    };
    span(-pitch / 2, rise[0], rootPoints);
    for (let k = 0; k < levels; k += 1) points.push({ theta: rise[k], radius: radius[k] });
    tipSpan(rise[levels], fall[levels], tipPoints);
    for (let k = levels; k > 0; k -= 1) points.push({ theta: fall[k], radius: radius[k] });
    span(fall[0], pitch / 2, rootPoints);
    return points;
  });
}

/** Material test for the flat rib in disk-local polar coordinates. */
function insideFlatRib(x, y, { startRadius, lead, startAngle, rib }) {
  const rho = Math.hypot(x, y);
  const turn = THREE.MathUtils.euclideanModulo(Math.atan2(y, x) - startAngle, 2 * Math.PI) / (2 * Math.PI);
  if (Math.abs(rho - startRadius - lead * turn) <= rib.halfWidth) return true;
  const cx = Math.cos(startAngle);
  const cy = Math.sin(startAngle);
  for (const radius of [startRadius, startRadius + lead]) {
    if (Math.hypot(x - radius * cx, y - radius * cy) <= rib.halfWidth) return true;
  }
  return false;
}

function cutFlatRib({ radii, teeth, outerRadius, depth, centerX, centerZ, startRadius, lead, startAngle,
  gearPhase, rib, axialSteps, angularSteps, phaseSteps, clearance, pitch }) {
  const dx = 0.0004;
  const xMin = centerX - outerRadius - rib.halfWidth - 0.02;
  const xMax = centerX + outerRadius + rib.halfWidth + 0.02;
  const yNear = centerZ - rib.top;
  const yFar = centerZ - rib.base;
  const spiral = { startRadius, lead, startAngle, rib };
  for (let phase = 0; phase <= phaseSteps; phase += 1) {
    const diskAngle = 2 * Math.PI * phase / phaseSteps;
    const gearAngle = gearPhase + diskAngle / teeth;
    const c = Math.cos(-diskAngle);
    const s = Math.sin(-diskAngle);
    for (let axial = 0; axial <= axialSteps; axial += 1) {
      const station = -depth / 2 + depth * axial / axialSteps;
      // Intervals of rib material along the line y = station (world), widened by
      // one sample so sampling never leaves material uncut.
      const intervals = [];
      let open = null;
      for (let x = xMin; x <= xMax + dx; x += dx) {
        const inside = insideFlatRib(c * x - s * station, s * x + c * station, spiral);
        if (inside && open === null) open = x - dx;
        if (!inside && open !== null) { intervals.push([open, x]); open = null; }
      }
      if (open !== null) intervals.push([open, xMax + dx]);
      for (const [x1, x2] of intervals) {
        const X1 = x1 - centerX;
        const X2 = x2 - centerX;
        const corners = [[X1, yNear], [X2, yNear], [X1, yFar], [X2, yFar]].map(([a, b]) => Math.atan2(b, a));
        const low = Math.min(...corners);
        const high = Math.max(...corners);
        for (let angular = 0; angular <= angularSteps; angular += 1) {
          const base = -pitch / 2 + pitch * angular / angularSteps + gearAngle;
          for (let k = Math.ceil((low - base) / pitch); base + k * pitch <= high; k += 1) {
            const phi = base + k * pitch;
            const ux = Math.cos(phi);
            const uy = Math.sin(phi);
            let near = 0;
            let far = Infinity;
            for (const [u, lo, hi] of [[ux, X1, X2], [uy, yNear, yFar]]) {
              if (Math.abs(u) < 1e-15) {
                if (lo > 0 || hi < 0) { far = -1; break; }
                continue;
              }
              const t1 = lo / u;
              const t2 = hi / u;
              near = Math.max(near, Math.min(t1, t2));
              far = Math.min(far, Math.max(t1, t2));
            }
            if (near > far) continue;
            const index = axial * (angularSteps + 1) + angular;
            radii[index] = Math.min(radii[index], near - clearance);
          }
        }
      }
    }
  }
}
