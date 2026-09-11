import * as THREE from 'three';

const turn = 2 * Math.PI;
export const jumpCamDimensions = {
  scale: 200, shaft: [1010, 759], followerPivot: [-4.77, 1.88],
  followerLength: Math.hypot(1014, -4) / 200, followerHalfWidth: 0.15,
  rollerRadius: 0.23, contactClearance: 0.00015,
  camBore: 0.425, camDepth: 0.18, camCurveSegments: 192,
  springHalfThickness: 0.06, springWidth: 0.13, springCurlRadius: 0.19,
  springHalfThicknessExtra: 0.0125, sourceSpringControl1: [360, 125.3], sourceSpringEndHandle: 193.4,
  springCurlStart: -91 * Math.PI / 180, springCurlEnd: 5 * Math.PI / 6,
  springSegments: 256, springCurlSegments: 512,
  springFixedLength: 0.67,
};
const world = ([x, y]) => [(x - 1010) / 200, (759 - y) / 200];

export function jumpCamProfile(segments = jumpCamDimensions.camCurveSegments) {
  const source = new THREE.Shape();
  source.moveTo(1122, 439);
  source.quadraticCurveTo(1018, 426, 923, 498);
  source.quadraticCurveTo(827, 571, 830, 704);
  source.quadraticCurveTo(830, 779.8183258569796, 909.5908370715102, 859.4091629284898);
  source.absarc(1010, 759, 142, 3 * Math.PI / 4, Math.acos(120 / 142), true);
  source.lineTo(1130, 459); source.quadraticCurveTo(1130, 441, 1122, 439); source.closePath();
  const points = source.getPoints(segments).map(v => new THREE.Vector2(...world(v.toArray()))); points.pop();
  return points;
}

export function jumpCamGeometry() {
  const p = jumpCamDimensions, shape = new THREE.Shape(jumpCamProfile());
  const bore = new THREE.Path(); bore.absarc(0, 0, p.camBore, 0, turn, true); shape.holes.push(bore);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: p.camDepth, bevelEnabled: false, curveSegments: 192 });
  geometry.userData.profile = 'source-traced-cam-with-circular-base';
  return geometry;
}

// Intersect the follower circle with the outer offset of the actual Float32
// cam polygon. Lines and vertex circles give all candidates in one pass.
// The highest supporting candidate is the first encountered from above.
export function makeJumpCamContact(geometry = jumpCamGeometry()) {
  const p = jumpCamDimensions, attr = geometry.attributes.position, unique = new Map();
  for (let i = 0; i < attr.count; i += 1) {
    if (attr.getZ(i) !== 0 || Math.hypot(attr.getX(i), attr.getY(i)) < 0.5) continue;
    const x = attr.getX(i), y = attr.getY(i); unique.set(`${x},${y}`, [x, y]);
  }
  const points = [...unique.values()].sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
  const edges = points.map((a, i) => {
    const b = points[(i + 1) % points.length], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    return { a, b, dx, dy, length, nx: dy / length, ny: -dx / length };
  });
  const [px, py] = p.followerPivot, length = p.followerLength, radius = p.rollerRadius + p.contactClearance;
  const normalize = a => Math.atan2(Math.sin(a), Math.cos(a));
  const atAngle = gamma => {
    const c = Math.cos(gamma), s = Math.sin(gamma);
    let best = null;
    const accept = (theta, x, y, nx, ny) => {
      theta = normalize(theta);
      if (theta < -0.6 || theta > 0.35 || (best && theta <= best.followerAngle)) return;
      const moment = length * (Math.cos(theta) * ny - Math.sin(theta) * nx);
      if (moment <= 1e-9) return;
      const camMoment = x * ny - y * nx;
      best = { gamma, followerAngle: theta, followerDerivative: camMoment / moment,
        rollerX: px + length * Math.cos(theta), rollerY: py + length * Math.sin(theta),
        contactX: x, contactY: y, normalX: nx, normalY: ny,
        followerMoment: moment, camMoment };
    };
    for (const e of edges) {
      const ax = c * e.a[0] - s * e.a[1], ay = s * e.a[0] + c * e.a[1];
      const dx = c * e.dx - s * e.dy, dy = s * e.dx + c * e.dy;
      const nx = c * e.nx - s * e.ny, ny = s * e.nx + c * e.ny;
      const k = ((ax - px) * nx + (ay - py) * ny + radius) / length;
      if (Math.abs(k) <= 1) {
        const alpha = Math.atan2(ny, nx), delta = Math.acos(k);
        for (const sign of [-1, 1]) {
          const theta = alpha + sign * delta, x = px + length * Math.cos(theta) - radius * nx;
          const y = py + length * Math.sin(theta) - radius * ny, t = ((x - ax) * dx + (y - ay) * dy) / e.length ** 2;
          if (t >= -1e-10 && t <= 1 + 1e-10) accept(theta, x, y, nx, ny);
        }
      }
      const vx = ax - px, vy = ay - py, distance = Math.hypot(vx, vy);
      const vertexK = (length ** 2 + distance ** 2 - radius ** 2) / (2 * length * distance);
      if (Math.abs(vertexK) <= 1) {
        const alpha = Math.atan2(vy, vx), delta = Math.acos(vertexK);
        for (const sign of [-1, 1]) {
          const theta = alpha + sign * delta, cx = px + length * Math.cos(theta), cy = py + length * Math.sin(theta);
          accept(theta, ax, ay, (cx - ax) / radius, (cy - ay) / radius);
        }
      }
    }
    if (!best) throw new Error(`No physical cam support at ${gamma}`);
    return best;
  };
  return { geometry, points, atAngle };
}

// One inextensible bending mode for the curved cantilever. Each neutral-axis
// segment keeps its length; the circular return keeps its radius and rotates
// with the beam end. Its outer arc slides on the follower's upper face.
export function makeJumpCamSpring() {
  const p = jumpCamDimensions, [px, py] = p.followerPivot;
  const endPixel = [541 + 38 * Math.cos(p.springCurlStart), 306 - 38 * Math.sin(p.springCurlStart)];
  const controls = [[45, 161], p.sourceSpringControl1,
    [endPixel[0] + p.sourceSpringEndHandle * Math.sin(p.springCurlStart),
      endPixel[1] + p.sourceSpringEndHandle * Math.cos(p.springCurlStart)], endPixel].map(world);
  const point = t => [0, 1].map(k => (1 - t) ** 3 * controls[0][k] + 3 * (1 - t) ** 2 * t * controls[1][k]
    + 3 * (1 - t) * t ** 2 * controls[2][k] + t ** 3 * controls[3][k]);
  const samples = Array.from({ length: p.springSegments + 1 }, (_, i) => point(i / p.springSegments));
  const pieces = samples.slice(1).map((b, i) => {
    const a = samples[i], dx = b[0] - a[0], dy = b[1] - a[1];
    return { length: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) };
  });
  const totalLength = pieces.reduce((sum, piece) => sum + piece.length, 0);
  let distance = 0;
  for (const piece of pieces) {
    const s = Math.max(0, (distance + piece.length / 2 - p.springFixedLength) / (totalLength - p.springFixedLength));
    piece.mode = 2 * s - s * s; distance += piece.length;
  }
  const endAt = (lambda, includePath = false) => {
    let [x, y] = controls[0], derivativeX = 0, derivativeY = 0;
    const path = includePath ? [[x, y]] : null;
    for (const piece of pieces) {
      const angle = piece.angle + lambda * piece.mode, c = Math.cos(angle), s = Math.sin(angle);
      x += piece.length * c; y += piece.length * s;
      derivativeX -= piece.length * s * piece.mode; derivativeY += piece.length * c * piece.mode;
      path?.push([x, y]);
    }
    const offsetX = -p.springCurlRadius * Math.cos(p.springCurlStart + lambda);
    const offsetY = -p.springCurlRadius * Math.sin(p.springCurlStart + lambda);
    const centerX = x + offsetX, centerY = y + offsetY;
    derivativeX -= offsetY; derivativeY += offsetX;
    return { lambda, centerX, centerY, derivativeX, derivativeY, path };
  };
  const atFollower = (theta, includePath = false) => {
    const nx = -Math.sin(theta), ny = Math.cos(theta), tx = ny, ty = -nx;
    const radius = p.springCurlRadius + p.springHalfThickness;
    const gap = lambda => { const e = endAt(lambda); return nx * (e.centerX - px) + ny * (e.centerY - py)
      - p.followerHalfWidth - radius - p.contactClearance; };
    let low = -0.9, high = 0.5;
    if (gap(low) > 0 || gap(high) < 0) throw new Error('Spring contact is outside its bending range');
    for (let i = 0; i < 36; i += 1) {
      const middle = (low + high) / 2;
      if (gap(middle) > 0) high = middle; else low = middle;
    }
    const e = endAt((low + high) / 2, includePath);
    const arm = tx * (e.centerX - px) + ty * (e.centerY - py);
    const normalDerivative = nx * e.derivativeX + ny * e.derivativeY;
    const contactAngle = normalizeAngle(theta - Math.PI / 2 - e.lambda);
    if (contactAngle < p.springCurlStart || contactAngle > p.springCurlEnd) throw new Error('Contact escapes the physical curled spring arc');
    return { ...e, arm, normalDerivative, lambdaDerivative: arm / normalDerivative,
      contactX: e.centerX - radius * nx, contactY: e.centerY - radius * ny, contactAngle };
  };
  return { pieces, neutralLength: pieces.reduce((s, row) => s + row.length, 0), endAt, atFollower };
}

function normalizeAngle(angle) { return Math.atan2(Math.sin(angle), Math.cos(angle)); }
