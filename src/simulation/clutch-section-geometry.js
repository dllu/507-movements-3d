import * as THREE from 'three';

export function keyedBoreRadius(theta, boreRadius, keyHalfWidth, keywayTop) {
  if (!keyHalfWidth || !keywayTop) return boreRadius;
  const cosine = Math.cos(theta), sine = Math.sin(theta);
  if (sine <= 0 || Math.abs(cosine) * boreRadius > keyHalfWidth + 1e-12) return boreRadius;
  return Math.max(boreRadius, Math.min(keywayTop / sine,
    Math.abs(cosine) > 1e-12 ? keyHalfWidth / Math.abs(cosine) : Infinity));
}

// Revolve a clockwise (axial position, radius) section. A keyed bore is part
// of the same closed surface; its corner angles are inserted explicitly so
// no triangle bridges a keyway corner. Paint is vertex color, not extra metal.
export function turnedClutchGeometry(profile, { angularSegments = 256, boreRadius = 0,
  keyHalfWidth = 0, keywayTop = 0, color = 0xffffff, paintIndex = false } = {}) {
  const angles = Array.from({ length: angularSegments + 1 }, (_, i) => 2 * Math.PI * i / angularSegments);
  if (keyHalfWidth && keywayTop) {
    const boreAngle = Math.acos(keyHalfWidth / boreRadius), tipAngle = Math.atan2(keywayTop, keyHalfWidth);
    angles.push(boreAngle, tipAngle, Math.PI - tipAngle, Math.PI - boreAngle);
  }
  angles.sort((a, b) => a - b);
  const phases = angles.filter((a, i) => i === 0 || a - angles[i - 1] > 1e-10);
  const positions = [], normals = [], colors = [];
  const base = new THREE.Color(color), mark = new THREE.Color(0xf1ebdc);
  const outerRadius = Math.max(...profile.map(([, r]) => r));
  const radiusAt = (r, angle) => Math.abs(r - boreRadius) < 1e-12
    ? keyedBoreRadius(angle, boreRadius, keyHalfWidth, keywayTop) : r;
  const point = ([x, r], angle) => {
    // Use identical positions at the seam, including the zero coordinate.
    // sin(2π)'s residual otherwise leaves a microscopic ray-visible crack.
    const phase = Math.abs(angle - 2 * Math.PI) < 1e-12 ? 0 : angle;
    const radius = radiusAt(r, phase);
    return new THREE.Vector3(radius * Math.cos(phase), radius * Math.sin(phase), x);
  };
  const emit = (a, b, c, na, nb, nc, color) => {
    const cross = b.clone().sub(a).cross(c.clone().sub(a));
    if (cross.lengthSq() < 1e-22) return;
    if (cross.dot(na.clone().add(nb).add(nc)) < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; }
    for (const v of [a, b, c]) positions.push(v.x, v.y, v.z);
    for (const n of [na, nb, nc]) normals.push(n.x, n.y, n.z);
    for (let i = 0; i < 3; i += 1) colors.push(color.r, color.g, color.b);
  };
  for (let edge = 0; edge < profile.length; edge += 1) {
    const a = profile[edge], b = profile[(edge + 1) % profile.length];
    const dx = b[0] - a[0], dr = b[1] - a[1];
    for (let i = 0; i + 1 < phases.length; i += 1) {
      const first = phases[i], last = phases[i + 1], middle = (first + last) / 2;
      const va = point(a, first), vb = point(a, last), vc = point(b, last), vd = point(b, first);
      const normal = (theta) => new THREE.Vector3(dx * Math.cos(theta), dx * Math.sin(theta), -dr).normalize();
      let na = normal(first), nb = normal(last);
      if (Math.abs(a[1] - boreRadius) < 1e-12 && Math.abs(b[1] - boreRadius) < 1e-12
        && radiusAt(boreRadius, middle) > boreRadius + 1e-10) {
        const tangent = vb.clone().sub(va);
        na = new THREE.Vector3(tangent.y, -tangent.x, 0).multiplyScalar(Math.sign(dx)).normalize();
        nb = na.clone();
      }
      const surfaceColor = paintIndex && Math.abs(a[1] - outerRadius) < 1e-12 && Math.abs(b[1] - outerRadius) < 1e-12
        && THREE.MathUtils.euclideanModulo(middle + 0.05, 2 * Math.PI) < 0.10 ? mark : base;
      emit(va, vb, vc, na, nb, nb, surfaceColor);
      emit(va, vc, vd, na, nb, na, surfaceColor);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData = { profile, angularSegments, boreRadius, keyHalfWidth, keywayTop, paintIndex };
  return geometry;
}

// Intersect the rotating rectangular keyway with a fixed world-Z section.
// The shaft axis is X. Each linear inequality clips one interval along Y.
export function keywaySectionInterval(angle, planeZ, boreRadius, keyHalfWidth, keywayTop) {
  if (!keyHalfWidth || !keywayTop) return null;
  let low = -Infinity, high = Infinity;
  const constrain = (slope, intercept, minimum, maximum) => {
    if (Math.abs(slope) < 1e-12) return intercept >= minimum && intercept <= maximum;
    const a = (minimum - intercept) / slope, b = (maximum - intercept) / slope;
    low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b));
    return low <= high;
  };
  const cosine = Math.cos(angle), sine = Math.sin(angle);
  if (!constrain(sine, -planeZ * cosine, -keyHalfWidth, keyHalfWidth)
    || !constrain(cosine, planeZ * sine, Math.sqrt(boreRadius ** 2 - keyHalfWidth ** 2), keywayTop)) return null;
  return [low, high];
}

export function clutchSectionPolygons(profile, { planeZ = 0, angle = 0, boreRadius,
  keyHalfWidth = 0, keywayTop = 0 } = {}) {
  const circleHeight = Math.sqrt(boreRadius ** 2 - planeZ ** 2);
  const interval = keywaySectionInterval(angle, planeZ, boreRadius, keyHalfWidth, keywayTop);
  const borePoints = profile.filter(([, r]) => Math.abs(r - boreRadius) < 1e-12);
  const boreLeft = Math.min(...borePoints.map(([x]) => x)), boreRight = Math.max(...borePoints.map(([x]) => x));
  const polygons = [];
  for (const side of [1, -1]) {
    const keyLow = interval ? Math.min(...interval.map((y) => y * side)) : -Infinity;
    const keyHigh = interval ? Math.max(...interval.map((y) => y * side)) : -Infinity;
    const boreHeight = Math.max(circleHeight, keyHigh);
    const polygon = profile.map(([x, r]) => new THREE.Vector2(x,
      side * (Math.abs(r - boreRadius) < 1e-12 ? boreHeight : Math.sqrt(r ** 2 - planeZ ** 2))));
    polygons.push(polygon);
    if (keyLow > circleHeight + 1e-10) {
      // An oblique keyway can cut a separate slit in the rear section.
      polygons.push([[boreLeft, circleHeight], [boreRight, circleHeight], [boreRight, keyLow], [boreLeft, keyLow]]
        .map(([x, y]) => new THREE.Vector2(x, side * y)));
    }
  }
  return polygons;
}

export function makeClutchSections(profile, { boreRadius, keyHalfWidth = 0, keywayTop = 0,
  color, backZ = -0.08 } = {}) {
  const root = new THREE.Group();
  // Plain cut face, a slightly darker shade of the part (no hatching).
  const capColor = new THREE.Color(color).multiplyScalar(0.85);
  const material = new THREE.MeshBasicMaterial({ color: capColor });
  const caps = [0, backZ].map(() => new THREE.Mesh(new THREE.BufferGeometry(), material));
  root.add(...caps);
  let previous = '';
  const setAngle = (angle) => {
    const polygons = [0, backZ].map((planeZ) => clutchSectionPolygons(profile,
      { planeZ, angle, boreRadius, keyHalfWidth, keywayTop }));
    const key = JSON.stringify(polygons);
    if (key === previous) return;
    previous = key;
    for (let i = 0; i < 2; i += 1) {
      const z = i === 0 ? 0 : backZ;
      const shapes = polygons[i].map((polygon) => new THREE.Shape(polygon));
      const geometry = new THREE.ShapeGeometry(shapes);
      geometry.translate(0, 0, z);
      if (i === 1) {
        for (let j = 0; j < geometry.index.count; j += 3) {
          const second = geometry.index.getX(j + 1);
          geometry.index.setX(j + 1, geometry.index.getX(j + 2));
          geometry.index.setX(j + 2, second);
        }
        for (let j = 0; j < geometry.attributes.normal.count; j += 1) geometry.attributes.normal.setZ(j, -1);
      }
      caps[i].geometry.dispose(); caps[i].geometry = geometry;
    }
    root.userData.polygons = polygons;
  };
  root.userData = { sectionFaces: true, caps, setAngle, backZ, profile, boreRadius, keyHalfWidth, keywayTop };
  setAngle(0);
  return root;
}
