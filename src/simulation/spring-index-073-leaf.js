// Movement 73: a small planar contact simulation of the strong spring C, the
// catch spring B's nib and ratchet A, all working in one plane.
//
// C is one flat leaf of constant section, clamped at its block. Its shape is
// an inextensible Kirchhoff rod: the drawn centre line with each segment
// turned by a rotation field beta(s) = sum_k q_k Theta_k(s), where Theta_k are
// the slopes of the first four uniform-cantilever modes (Theta(0) = 0 at the
// clamp, Theta'(L) = 0: no moment at the free end). The bending energy is
// EI/2 * integral(beta'^2), so under a load the curvature change is largest
// at the clamp and vanishes at the free end. Mass and stiffness matrices are
// integrated along the drawn curve. B's nib moves radially in D's frame
// (B is a guided leaf clamped to D, so its end translates) on a linear
// spring; A turns freely on viscous bearings. D is kinematic.
//
// Contacts are unilateral and frictionless: C's round-ended band, the nib's
// outline and A's tooth profile, solved per step by projected Gauss-Seidel on
// an implicit-Euler step. C's clamp preload presses its end into A's teeth,
// so C is the stop and the detent that seats A after each index.

const BETA = [1.8751040687119611, 4.694091132974175, 7.854757438237613, 10.995540734875467];
const SIGMA = BETA.map((b) => (Math.cosh(b) + Math.cos(b)) / (Math.sinh(b) + Math.sin(b)));
const MODES = BETA.length;
const DOF = MODES + 2; // C modes, nib radial offset d, A's angle theta
const NIB = MODES;
const WHEEL = MODES + 1;

// Mode slope (rotation) divided by beta, and its derivative in xi = s / L.
const modeSlope = (k, xi) => {
  const x = BETA[k] * xi;
  return Math.sinh(x) + Math.sin(x) - SIGMA[k] * (Math.cosh(x) - Math.cos(x));
};
const modeCurvature = (k, xi) => {
  const x = BETA[k] * xi;
  return BETA[k] * (Math.cosh(x) + Math.cos(x) - SIGMA[k] * (Math.sinh(x) + Math.sin(x)));
};

function invert(matrix) {
  const n = matrix.length;
  const a = matrix.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const p = a[col][col];
    for (let j = 0; j < 2 * n; j += 1) a[col][j] /= p;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const f = a[row][col];
      if (f !== 0) for (let j = 0; j < 2 * n; j += 1) a[row][j] -= f * a[col][j];
    }
  }
  return a.map((row) => row.slice(n));
}
const matVec = (m, v) => m.map((row) => row.reduce((sum, value, j) => sum + value * v[j], 0));

// Closest point on segment ab to p.
function segmentClosest(px, py, ax, ay, bx, by) {
  const ex = bx - ax, ey = by - ay;
  const l2 = ex * ex + ey * ey;
  const t = l2 < 1e-24 ? 0 : Math.min(1, Math.max(0, ((px - ax) * ex + (py - ay) * ey) / l2));
  return { t, x: ax + ex * t, y: ay + ey * t };
}

// Signed distance to a closed counter-clockwise polygon, with angle-weighted
// vertex pseudo-normals; `candidates` restricts the edges searched.
function polygonDistance(px, py, poly, normals, vertexNormals, candidates) {
  let best = Infinity, bx = 0, by = 0, nx = 0, ny = 0;
  const n = poly.length;
  for (const i of candidates) {
    const a = poly[i], b = poly[(i + 1) % n];
    const c = segmentClosest(px, py, a[0], a[1], b[0], b[1]);
    const d = Math.hypot(px - c.x, py - c.y);
    if (d < best) {
      best = d; bx = c.x; by = c.y;
      if (c.t <= 1e-9) [nx, ny] = vertexNormals[i];
      else if (c.t >= 1 - 1e-9) [nx, ny] = vertexNormals[(i + 1) % n];
      else [nx, ny] = normals[i];
    }
  }
  if (best === Infinity) return null;
  const inside = (px - bx) * nx + (py - by) * ny < 0;
  let ux = px - bx, uy = py - by;
  const l = Math.hypot(ux, uy);
  if (l > 1e-12) { ux /= l; uy /= l; if (inside) { ux = -ux; uy = -uy; } } else { ux = nx; uy = ny; }
  return { distance: inside ? -best : best, x: bx, y: by, nx: ux, ny: uy };
}

function polygonNormals(poly) {
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i += 1) {
    const a = poly[i], b = poly[(i + 1) % n];
    area += a[0] * b[1] - a[1] * b[0];
  }
  const sign = area > 0 ? 1 : -1;
  const normals = poly.map((a, i) => {
    const b = poly[(i + 1) % n];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const l = Math.hypot(ex, ey) || 1;
    return [sign * ey / l, -sign * ex / l];
  });
  const vertexNormals = poly.map((_, i) => {
    const p = normals[(i + n - 1) % n], q = normals[i];
    const x = p[0] + q[0], y = p[1] + q[1];
    const l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  });
  return { normals, vertexNormals };
}

// Physical and solver parameters (C's first-mode frequency in Hz and
// damping ratio, B's nib likewise, C's tip stiffness over B's, C's preload
// into A, A's bearing damping as a fraction of the preload force and its
// inertia as a time constant, the step, PGS sweeps, contact margin and
// penetration recovery).
export const SPRING_INDEX_073_DEFAULTS = Object.freeze({
  leafFrequency: 3, leafDamping: 0.45, nibFrequency: 4, nibDamping: 0.4,
  tipStiffnessRatio: 4, preload: 0.04, wheelDampingRatio: 0.8, wheelTimeConstant: 0.03,
  dt: 1e-3, pgsIterations: 30, margin: 0.012, baumgarte: 0.2,
});

export function makeSpringIndex073Model(config) {
  const {
    strongPoints, halfWidth, ratchetProfile, nibOutline, driverSpeed,
    params = {},
  } = config;
  const {
    leafFrequency, leafDamping, nibFrequency, nibDamping, tipStiffnessRatio, preload,
    wheelDampingRatio, wheelTimeConstant, dt, pgsIterations, margin, baumgarte,
  } = { ...SPRING_INDEX_073_DEFAULTS, ...params };
  const N = strongPoints.length - 1;
  const segX = new Float64Array(N + 1), segY = new Float64Array(N + 1);
  for (let j = 1; j <= N; j += 1) {
    segX[j] = strongPoints[j][0] - strongPoints[j - 1][0];
    segY[j] = strongPoints[j][1] - strongPoints[j - 1][1];
  }
  let length = 0;
  for (let j = 1; j <= N; j += 1) length += Math.hypot(segX[j], segY[j]);
  const ds = length / N;
  // Rotation-mode values at the segment midpoints.
  const thetaMid = Array.from({ length: MODES }, (_, k) => {
    const values = new Float64Array(N + 1);
    for (let j = 1; j <= N; j += 1) values[j] = modeSlope(k, (j - 0.5) / N);
    return values;
  });

  // Deformed centre line and its derivatives d r_i / d q_k (x, y).
  const px = new Float64Array(N + 1), py = new Float64Array(N + 1);
  const jac = Array.from({ length: MODES }, () => ({ x: new Float64Array(N + 1), y: new Float64Array(N + 1) }));
  const deform = (q) => {
    px[0] = strongPoints[0][0]; py[0] = strongPoints[0][1];
    for (let k = 0; k < MODES; k += 1) { jac[k].x[0] = 0; jac[k].y[0] = 0; }
    for (let j = 1; j <= N; j += 1) {
      let beta = 0;
      for (let k = 0; k < MODES; k += 1) beta += q[k] * thetaMid[k][j];
      const c = Math.cos(beta), s = Math.sin(beta);
      const ex = c * segX[j] - s * segY[j], ey = s * segX[j] + c * segY[j];
      px[j] = px[j - 1] + ex; py[j] = py[j - 1] + ey;
      for (let k = 0; k < MODES; k += 1) {
        jac[k].x[j] = jac[k].x[j - 1] - thetaMid[k][j] * ey;
        jac[k].y[j] = jac[k].y[j - 1] + thetaMid[k][j] * ex;
      }
    }
  };
  const deformedPoints = (q) => {
    deform(q);
    return Array.from({ length: N + 1 }, (_, i) => [px[i], py[i]]);
  };

  // Mass (unit total mass) and stiffness (EI = 1, rescaled below) matrices.
  deform(new Float64Array(MODES));
  const massC = Array.from({ length: MODES }, () => new Float64Array(MODES));
  const stiffC = Array.from({ length: MODES }, () => new Float64Array(MODES));
  for (let a = 0; a < MODES; a += 1) {
    for (let b = 0; b < MODES; b += 1) {
      let m = 0, kk = 0;
      for (let i = 1; i <= N; i += 1) {
        const ax = (jac[a].x[i] + jac[a].x[i - 1]) / 2, ay = (jac[a].y[i] + jac[a].y[i - 1]) / 2;
        const bx = (jac[b].x[i] + jac[b].x[i - 1]) / 2, by = (jac[b].y[i] + jac[b].y[i - 1]) / 2;
        m += (ax * bx + ay * by) / N;
        const xi = (i - 0.5) / N;
        kk += modeCurvature(a, xi) * modeCurvature(b, xi) / (length * length) * ds;
      }
      massC[a][b] = m; stiffC[a][b] = kk;
    }
  }
  // Static tip compliance along a unit direction, and the shape it makes.
  const stiffInverse = invert(stiffC.map((row) => [...row]));
  const tipShape = (dx, dy) => {
    const g = Array.from({ length: MODES }, (_, k) => jac[k].x[N] * dx + jac[k].y[N] * dy);
    const q = matVec(stiffInverse, g);
    const compliance = g.reduce((sum, value, k) => sum + value * q[k], 0);
    return { q, compliance };
  };
  // Scale EI so the first mode (Rayleigh quotient of the tip-load shape)
  // rings at leafFrequency.
  const [preX, preY] = config.preloadDirection;
  const shape = tipShape(preX, preY);
  let qKq = 0, qMq = 0;
  for (let a = 0; a < MODES; a += 1) for (let b = 0; b < MODES; b += 1) {
    qKq += shape.q[a] * stiffC[a][b] * shape.q[b];
    qMq += shape.q[a] * massC[a][b] * shape.q[b];
  }
  const omega1 = 2 * Math.PI * leafFrequency;
  const ei = omega1 * omega1 * qMq / qKq;
  for (const row of stiffC) for (let b = 0; b < MODES; b += 1) row[b] *= ei;
  const tipStiffness = 1 / (shape.compliance / ei);
  // Unloaded C lies `preload` further into A than drawn.
  const qFree = shape.q.map((value) => -value / shape.compliance * preload);
  const nibStiffness = tipStiffness / tipStiffnessRatio;
  const nibOmega = 2 * Math.PI * nibFrequency;
  const nibMass = nibStiffness / (nibOmega * nibOmega);
  const nibDampingC = 2 * nibDamping * nibOmega * nibMass;
  const preloadForce = tipStiffness * preload;
  const wheelDampingC = wheelDampingRatio * preloadForce;
  const wheelInertia = wheelDampingC * wheelTimeConstant;

  const M = Array.from({ length: DOF }, () => new Array(DOF).fill(0));
  const K = Array.from({ length: DOF }, () => new Array(DOF).fill(0));
  const C = Array.from({ length: DOF }, () => new Array(DOF).fill(0));
  for (let a = 0; a < MODES; a += 1) for (let b = 0; b < MODES; b += 1) {
    M[a][b] = massC[a][b]; K[a][b] = stiffC[a][b];
    C[a][b] = leafDamping * omega1 * massC[a][b] + leafDamping / omega1 * stiffC[a][b];
  }
  M[NIB][NIB] = nibMass; K[NIB][NIB] = nibStiffness; C[NIB][NIB] = nibDampingC;
  M[WHEEL][WHEEL] = wheelInertia; C[WHEEL][WHEEL] = wheelDampingC;
  const W = invert(M.map((row, i) => row.map((value, j) => value + dt * C[i][j] + dt * dt * K[i][j])));
  const xEquilibrium = [...qFree, 0, 0];

  // A's profile and its angular buckets.
  const aPoly = ratchetProfile;
  const aNormals = polygonNormals(aPoly);
  const bucketCount = 360;
  const buckets = Array.from({ length: bucketCount }, () => []);
  const angleOf = (x, y) => (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI);
  aPoly.forEach((a, i) => {
    const b = aPoly[(i + 1) % aPoly.length];
    const a0 = angleOf(a[0], a[1]);
    let a1 = angleOf(b[0], b[1]);
    if (a1 < a0 - Math.PI) a1 += 2 * Math.PI;
    if (a1 > a0 + Math.PI) a1 -= 2 * Math.PI;
    const lo = Math.min(a0, a1) - 0.08, hi = Math.max(a0, a1) + 0.08;
    for (let k = Math.floor(lo / (2 * Math.PI) * bucketCount); k <= Math.floor(hi / (2 * Math.PI) * bucketCount); k += 1) {
      buckets[((k % bucketCount) + bucketCount) % bucketCount].push(i);
    }
  });
  // Signed distance from a world point to A turned by theta; world normal.
  const wheelDistance = (x, y, theta) => {
    const c = Math.cos(theta), s = Math.sin(theta);
    const lx = c * x + s * y, ly = -s * x + c * y;
    const bucket = Math.floor(angleOf(lx, ly) / (2 * Math.PI) * bucketCount) % bucketCount;
    const hit = polygonDistance(lx, ly, aPoly, aNormals.normals, aNormals.vertexNormals, buckets[bucket]);
    if (!hit) return null;
    return {
      distance: hit.distance,
      x: c * hit.x - s * hit.y, y: s * hit.x + c * hit.y,
      nx: c * hit.nx - s * hit.ny, ny: s * hit.nx + c * hit.ny,
    };
  };

  // The nib outline in world coordinates for driver angle phi and offset d.
  const nibCount = nibOutline.length;
  const nibWorld = Array.from({ length: nibCount }, () => [0, 0]);
  const nibFactor = nibOutline.map((point) => point.f);
  let nibNormals = null;
  const nibBox = [0, 0, 0, 0];
  const placeNib = (phi, d) => {
    const c = Math.cos(phi), s = Math.sin(phi);
    nibBox[0] = Infinity; nibBox[1] = Infinity; nibBox[2] = -Infinity; nibBox[3] = -Infinity;
    for (let m = 0; m < nibCount; m += 1) {
      const x = nibOutline[m].x + d * nibFactor[m], y = nibOutline[m].y;
      const wx = c * x - s * y, wy = s * x + c * y;
      nibWorld[m][0] = wx; nibWorld[m][1] = wy;
      nibBox[0] = Math.min(nibBox[0], wx); nibBox[1] = Math.min(nibBox[1], wy);
      nibBox[2] = Math.max(nibBox[2], wx); nibBox[3] = Math.max(nibBox[3], wy);
    }
    nibNormals = polygonNormals(nibWorld);
    return { ux: c, uy: s };
  };
  const nibCandidates = Array.from({ length: nibCount }, (_, i) => i);
  const nibDistance = (x, y) => {
    const hit = polygonDistance(x, y, nibWorld, nibNormals.normals, nibNormals.vertexNormals, nibCandidates);
    if (!hit) return null;
    // The factor of the closest point, interpolated along its edge.
    let best = Infinity, factor = 1;
    for (let i = 0; i < nibCount; i += 1) {
      const a = nibWorld[i], b = nibWorld[(i + 1) % nibCount];
      const c = segmentClosest(x, y, a[0], a[1], b[0], b[1]);
      const d = Math.hypot(x - c.x, y - c.y);
      if (d < best) { best = d; factor = nibFactor[i] + (nibFactor[(i + 1) % nibCount] - nibFactor[i]) * c.t; }
    }
    return { ...hit, factor };
  };
  const inBox = (x, y, box, pad) => x > box[0] - pad && x < box[2] + pad && y > box[1] - pad && y < box[3] + pad;
  // Closest point of C's (deformed) centre line over stations [from, to].
  const leafClosest = (x, y, from, to = N) => {
    let best = Infinity, index = Math.max(1, from), t = 0, cx = 0, cy = 0;
    for (let i = Math.max(1, from); i <= to; i += 1) {
      const c = segmentClosest(x, y, px[i - 1], py[i - 1], px[i], py[i]);
      const d = Math.hypot(x - c.x, y - c.y);
      if (d < best) { best = d; index = i; t = c.t; cx = c.x; cy = c.y; }
    }
    return { distance: best, index, t, x: cx, y: cy };
  };
  const leafJacobian = (index, t, nx, ny, out, sign) => {
    for (let k = 0; k < MODES; k += 1) {
      const jx = jac[k].x[index - 1] + (jac[k].x[index] - jac[k].x[index - 1]) * t;
      const jy = jac[k].y[index - 1] + (jac[k].y[index] - jac[k].y[index - 1]) * t;
      out[k] += sign * (jx * nx + jy * ny);
    }
  };

  const wheelOuter = Math.max(...aPoly.map(([x, y]) => Math.hypot(x, y)));
  const tipStart = Math.floor(N * 0.45);
  const contacts = [];
  const addContact = (J, bias, gap, kind) => {
    const WJ = matVec(W, J);
    const effective = J.reduce((sum, value, i) => sum + value * WJ[i], 0);
    if (effective > 1e-14) contacts.push({ J, WJ, effective, bias, gap, kind, impulse: 0 });
  };
  const tipBox = [0, 0, 0, 0];
  // All candidate contacts at the current positions.
  const collect = (x, phi, withNib) => {
    contacts.length = 0;
    deform(x);
    const theta = x[WHEEL];
    const c = Math.cos(theta), s = Math.sin(theta);
    const reach = halfWidth + margin;
    // C's band near its end against A (both ways), over the stations that
    // come within reach of A's crests.
    tipBox[0] = Infinity; tipBox[1] = Infinity; tipBox[2] = -Infinity; tipBox[3] = -Infinity;
    let nearFirst = -1;
    for (let i = tipStart; i <= N; i += 1) {
      if (Math.hypot(px[i], py[i]) - reach > wheelOuter) continue;
      if (nearFirst < 0) nearFirst = i;
      tipBox[0] = Math.min(tipBox[0], px[i]); tipBox[1] = Math.min(tipBox[1], py[i]);
      tipBox[2] = Math.max(tipBox[2], px[i]); tipBox[3] = Math.max(tipBox[3], py[i]);
      const hit = wheelDistance(px[i], py[i], theta);
      if (!hit || hit.distance - halfWidth > margin) continue;
      const J = new Array(DOF).fill(0);
      for (let k = 0; k < MODES; k += 1) J[k] = jac[k].x[i] * hit.nx + jac[k].y[i] * hit.ny;
      J[WHEEL] = -(-hit.y * hit.nx + hit.x * hit.ny);
      addContact(J, 0, hit.distance - halfWidth, 'leaf-wheel');
    }
    for (const [ax0, ay0] of nearFirst < 0 ? [] : aPoly) {
      const ax = c * ax0 - s * ay0, ay = s * ax0 + c * ay0;
      if (!inBox(ax, ay, tipBox, reach)) continue;
      const hit = leafClosest(ax, ay, nearFirst);
      if (hit.distance - halfWidth > margin || hit.distance < 1e-9) continue;
      const nx = (ax - hit.x) / hit.distance, ny = (ay - hit.y) / hit.distance;
      const J = new Array(DOF).fill(0);
      leafJacobian(hit.index, hit.t, nx, ny, J, -1);
      J[WHEEL] = -ay * nx + ax * ny;
      addContact(J, 0, hit.distance - halfWidth, 'wheel-leaf');
    }
    if (!withNib) return;
    const { ux, uy } = placeNib(phi, x[NIB]);
    const nibNearWheel = Math.min(...[[nibBox[0], nibBox[1]], [nibBox[2], nibBox[3]], [nibBox[0], nibBox[3]], [nibBox[2], nibBox[1]]]
      .map(([bx, by]) => Math.hypot(bx, by))) < wheelOuter + margin + 0.3;
    // C's stations near the nib.
    let first = -1, last = -1;
    for (let i = 0; i <= N; i += 1) {
      if (!inBox(px[i], py[i], nibBox, reach)) continue;
      if (first < 0) first = i;
      last = i;
    }
    for (let m = 0; m < nibCount; m += 1) {
      const [qx, qy] = nibWorld[m];
      const f = nibFactor[m];
      if (nibNearWheel) {
        const hitA = wheelDistance(qx, qy, theta);
        if (hitA && hitA.distance < margin) {
          const J = new Array(DOF).fill(0);
          J[NIB] = f * (ux * hitA.nx + uy * hitA.ny);
          J[WHEEL] = -(-qy * hitA.nx + qx * hitA.ny);
          addContact(J, driverSpeed * (-qy * hitA.nx + qx * hitA.ny), hitA.distance, 'nib-wheel');
        }
      }
      if (first >= 0) {
        const hitC = leafClosest(qx, qy, first - 1, Math.min(N, last + 1));
        if (hitC.distance - halfWidth < margin && hitC.distance > 1e-9) {
          const nx = (qx - hitC.x) / hitC.distance, ny = (qy - hitC.y) / hitC.distance;
          const J = new Array(DOF).fill(0);
          J[NIB] = f * (ux * nx + uy * ny);
          leafJacobian(hitC.index, hitC.t, nx, ny, J, -1);
          addContact(J, driverSpeed * (-qy * nx + qx * ny), hitC.distance - halfWidth, 'nib-leaf');
        }
      }
    }
    // A's vertices near the nib against the nib.
    if (nibNearWheel) {
      for (const [ax0, ay0] of aPoly) {
        const ax = c * ax0 - s * ay0, ay = s * ax0 + c * ay0;
        if (!inBox(ax, ay, nibBox, margin)) continue;
        const hit = nibDistance(ax, ay);
        if (!hit || hit.distance > margin) continue;
        const J = new Array(DOF).fill(0);
        J[WHEEL] = -ay * hit.nx + ax * hit.ny;
        J[NIB] = -hit.factor * (ux * hit.nx + uy * hit.ny);
        addContact(J, -driverSpeed * (-hit.y * hit.nx + hit.x * hit.ny), hit.distance, 'wheel-nib');
      }
    }
    // C's stations near the nib against the nib.
    for (let i = Math.max(1, first); first >= 0 && i <= last; i += 1) {
      const hit = nibDistance(px[i], py[i]);
      if (!hit || hit.distance - halfWidth > margin) continue;
      const J = new Array(DOF).fill(0);
      for (let k = 0; k < MODES; k += 1) J[k] = jac[k].x[i] * hit.nx + jac[k].y[i] * hit.ny;
      J[NIB] = -hit.factor * (ux * hit.nx + uy * hit.ny);
      addContact(J, -driverSpeed * (-hit.y * hit.nx + hit.x * hit.ny), hit.distance - halfWidth, 'leaf-nib');
    }
  };

  // One implicit step from (x, v) at driver angle phi.
  const step = (x, v, phi, withNib) => {
    const rhs = new Array(DOF).fill(0);
    for (let i = 0; i < DOF; i += 1) {
      let sum = 0;
      for (let j = 0; j < DOF; j += 1) sum += M[i][j] * v[j] - dt * K[i][j] * (x[j] - xEquilibrium[j]);
      rhs[i] = sum;
    }
    const next = matVec(W, rhs);
    collect(x, phi, withNib);
    for (let iteration = 0; iteration < pgsIterations; iteration += 1) {
      for (const contact of contacts) {
        let vn = contact.bias;
        for (let i = 0; i < DOF; i += 1) vn += contact.J[i] * next[i];
        const target = contact.gap > 0 ? -contact.gap / dt : -baumgarte * contact.gap / dt;
        const updated = Math.max(0, contact.impulse + (target - vn) / contact.effective);
        const change = updated - contact.impulse;
        contact.impulse = updated;
        if (change !== 0) for (let i = 0; i < DOF; i += 1) next[i] += contact.WJ[i] * change;
      }
    }
    const active = new Set(contacts.filter((contact) => contact.impulse > 0).map((contact) => contact.kind));
    for (let i = 0; i < DOF; i += 1) { v[i] = next[i]; x[i] += dt * next[i]; }
    return active;
  };

  return {
    deformedPoints, deform, step, dt, length, tipStiffness, nibStiffness, preloadForce,
    wheelDistance, placeNib, nibWorld, nibDistance, leafClosest, halfWidth, N, ratchetProfile: aPoly,
    positions: () => ({ px, py }),
  };
}

// Identifies the inputs of a bake: the configuration (rounded) and the
// solver revision.
export const SPRING_INDEX_073_SOLVER = 2;
export function springIndex073Fingerprint(config) {
  const text = JSON.stringify({ config, defaults: SPRING_INDEX_073_DEFAULTS, solver: SPRING_INDEX_073_SOLVER },
    (key, value) => (typeof value === 'number' ? Math.round(value * 1e6) / 1e6 : value));
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// Settle C and A with the nib away, then run D through one pass of the nib
// from psiStart to psiEnd, recording the state every `record` steps.
export function simulateSpringIndex073(config) {
  const model = makeSpringIndex073Model(config);
  const { psiStart, psiEnd, driverSpeed, toothPitch, settleSeconds = 1.5, record = 4 } = config;
  const x = new Array(DOF).fill(0), v = new Array(DOF).fill(0);
  const settleSteps = Math.round(settleSeconds / model.dt);
  for (let n = 0; n < settleSteps; n += 1) model.step(x, v, psiStart, false);
  const rest = [...x];
  const restSpeed = Math.max(...v.map(Math.abs));
  const duration = (psiStart - psiEnd) / -driverSpeed;
  const steps = Math.round(duration / model.dt / record) * record;
  const samples = steps / record + 1;
  const states = new Float64Array(samples * DOF);
  const flags = new Uint8Array(samples);
  const kinds = { 'leaf-wheel': 1, 'wheel-leaf': 1, 'nib-wheel': 2, 'wheel-nib': 2, 'nib-leaf': 4, 'leaf-nib': 4 };
  states.set(x, 0);
  let flag = 0;
  for (let n = 1; n <= steps; n += 1) {
    const phi = psiStart + driverSpeed * model.dt * (n - 1);
    const active = model.step(x, v, phi, true);
    for (const kind of active) flag |= kinds[kind];
    if (n % record === 0) {
      states.set(x, (n / record) * DOF);
      flags[n / record] = flag;
      flag = 0;
    }
  }
  // Whatever is left of the settle at the end of the window (it should be
  // tiny) is blended out over its last quarter so the cycle closes exactly.
  const target = [...rest];
  target[WHEEL] -= toothPitch;
  const residual = target.map((value, i) => value - x[i]);
  const blendFrom = Math.floor(samples * 0.75);
  for (let sample = blendFrom; sample < samples; sample += 1) {
    const u = (sample - blendFrom) / (samples - 1 - blendFrom);
    const w = u * u * (3 - 2 * u);
    for (let i = 0; i < DOF; i += 1) states[sample * DOF + i] += residual[i] * w;
  }
  return {
    model, rest, restSpeed, residual, states, flags, samples, record,
    sampleDt: model.dt * record, duration: steps * model.dt, dof: DOF, modes: MODES, nibIndex: NIB, wheelIndex: WHEEL,
  };
}

export const SPRING_INDEX_073_MODES = MODES;
