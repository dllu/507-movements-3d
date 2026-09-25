import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function meshWithSurfaceNormals(vertices, indices, groups) {
  const positions = [], faces = [], seen = new Map();
  for (let i = 0; i < indices.length; i += 1) {
    const original = indices[i], key = `${original}/${groups[Math.floor(i / 3)]}`;
    if (!seen.has(key)) { seen.set(key, positions.length / 3); positions.push(...vertices.slice(original * 3, original * 3 + 3)); }
    faces.push(seen.get(key));
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(faces); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

// A shallow concave running face supports the same collar on each steady
// stroke. Brown does not provide this section; it is an inferred guide fit.
export function starMangleRunningRim(motion, { collarOffset = 0.265, collarRadius = 0.10,
  clearance = 0.0001, radialStart = 1.78, radialEnd = 1.85, radialSegments = 64, arcSegments = 512 } = {}) {
  const p = motion.parameters, centerRadius = p.wheelRadius + collarOffset, profile = [];
  for (const side of [1, -1]) for (let i = 0; i <= radialSegments; i += 1) {
    const fraction = side === 1 ? i / radialSegments : 1 - i / radialSegments;
    const r = radialStart + (radialEnd - radialStart) * fraction;
    const z = side * (p.pinionRadius - Math.sqrt(collarRadius ** 2 - (r - centerRadius) ** 2) - clearance);
    profile.push(new THREE.Vector2(r, z));
  }
  const vertices = [], indices = [], groups = [], n = profile.length;
  for (let i = 0; i <= arcSegments; i += 1) {
    const a = p.firstTerminal + (p.lastTerminal - p.firstTerminal) * i / arcSegments;
    for (const v of profile) vertices.push(v.x * Math.cos(a), v.x * Math.sin(a), v.y);
  }
  for (let i = 0; i < arcSegments; i += 1) for (let j = 0; j < n; j += 1) {
    const a = i * n + j, b = i * n + (j + 1) % n, c = b + n, d = a + n;
    indices.push(a, b, c, a, c, d);
    const group = j < radialSegments ? 0 : j === radialSegments ? 2 : j < n - 1 ? 1 : 3;
    groups.push(group, group);
  }
  for (const end of [0, arcSegments]) {
    const a = end === 0 ? p.firstTerminal : p.lastTerminal;
    const outward = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0).multiplyScalar(end === 0 ? -1 : 1);
    for (const face of THREE.ShapeUtils.triangulateShape(profile, [])) {
      const triangle = face.map((j) => end * n + j);
      const [v0, v1, v2] = triangle.map((j) => new THREE.Vector3().fromArray(vertices, 3 * j));
      if (v1.sub(v0).cross(v2.sub(v0)).dot(outward) < 0) [triangle[1], triangle[2]] = [triangle[2], triangle[1]];
      indices.push(...triangle);
      groups.push(end === 0 ? 4 : 5);
    }
  }
  const geometry = meshWithSurfaceNormals(vertices, indices, groups);
  geometry.userData = { collarOffset, collarRadius, clearance, radialStart, radialEnd, radialSegments, arcSegments };
  return geometry;
}

// The two curved ends of the crab retain a rounded collar on the input
// spindle. This envelope is inferred construction, not a traced section
// supplied by Brown. Its opposing faces retain the collar as the guide reaction changes sign.
export function starMangleCrabEnd(motion, firstCrossover, { collarOffset = 0.265,
  collarRadius = 0.10, guideClearance = 0.0001, wallThickness = 0.03,
  radialStart = 1.76, radialEnd = 1.85, radialBands = 32, curveSegments = 512, guideSide = 1 } = {}) {
  const p = motion.parameters, terminal = firstCrossover ? p.lastTerminal : p.firstTerminal;
  const start = firstCrossover ? p.runTravel : p.returnStart;
  const centerAt = (a) => {
    const s = motion.atTravel(start + a), angle = s.wheelAngle + terminal;
    const y = s.centerY - collarOffset;
    return new THREE.Vector3(Math.sin(angle) * y, Math.cos(angle) * y, s.centerZ);
  };
  const vertices = [], indices = [], groups = [], ns = curveSegments + 1, nr = radialBands + 1;
  for (const radius of [collarRadius + guideClearance, collarRadius + guideClearance + wallThickness]) {
    for (let i = 0; i < nr; i += 1) for (let j = 0; j < ns; j += 1) {
      const r = radialStart + (radialEnd - radialStart) * i / radialBands;
      const a = -0.18 + (Math.PI + 0.36) * j / curveSegments, c = centerAt(a);
      const derivative = centerAt(a + 1e-5).sub(centerAt(a - 1e-5)).multiplyScalar(5e4);
      const speed = Math.hypot(derivative.y, derivative.z), ty = derivative.y / speed, tz = derivative.z / speed;
      const nx = (r - c.x) / radius, along = -nx * derivative.x / speed;
      const square = 1 - nx * nx - along * along;
      if (square < 0) throw new RangeError(`Crab radial width exceeds collar envelope at ${r}, ${a}`);
      const normal = guideSide * Math.sqrt(square), ny = along * ty - normal * tz, nz = along * tz + normal * ty;
      vertices.push(r, c.y + radius * ny, c.z + radius * nz);
    }
  }
  const quad = (a, b, c, d, reverse = false, group = 0) => {
    if (reverse) indices.push(a, c, b, a, d, c); else indices.push(a, b, c, a, c, d);
    groups.push(group, group);
  };
  const offset = nr * ns;
  for (let i = 0; i < radialBands; i += 1) for (let j = 0; j < curveSegments; j += 1) {
    const a = i * ns + j; quad(a, a + 1, a + ns + 1, a + ns);
    quad(a + offset, a + offset + 1, a + offset + ns + 1, a + offset + ns, true, 1);
  }
  for (let j = 0; j < curveSegments; j += 1) {
    quad(j, j + offset, j + offset + 1, j + 1, false, 2);
    const a = radialBands * ns + j; quad(a, a + 1, a + offset + 1, a + offset, false, 3);
  }
  for (let i = 0; i < radialBands; i += 1) {
    const a = i * ns; quad(a, a + ns, a + ns + offset, a + offset, false, 4);
    const b = a + curveSegments; quad(b, b + offset, b + ns + offset, b + ns, false, 5);
  }
  if (guideSide < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  const geometry = meshWithSurfaceNormals(vertices, indices, groups);
  geometry.userData = { terminal, firstCrossover, collarOffset, collarRadius, guideClearance,
    wallThickness, radialStart, radialEnd, radialBands, curveSegments, centerAt, guideSide };
  return geometry;
}

// Brown draws A as one hatched block across the rim gap with a radial bar to
// the inner rim. This solid block is cut by the swept collar silhouette of
// both crossovers (runs of wheel-frame collar centres in (-y, z)); the thin crab
// shells above remain inside it as the exact collar-retaining linings. The
// two radial bars pass over the pinion's swept faces to feet on the inner rim.
// Its walls and bars are as thin and close as the pinion's swept volume allows
// (moving parts reach |z| = 0.424 over the bars), to keep A compact.
export function starMangleCrabBlock(collarRuns, { collarRadius = 0.10, clearance = 0.003,
  halfWidth = 0.38, halfHeight = 0.52, radialStart = 1.76, radialEnd = 1.90,
  barWidth = 0.14, barInner = 1.27, barOuter = 1.82, barLow = 0.455, barHigh = 0.51, footOuter = 1.36, footLow = 0.10 } = {}) {
  const radius = collarRadius + clearance, capsules = [];
  const circle = (s, z) => Array.from({ length: 40 }, (_, i) => {
    const a = 2 * Math.PI * i / 40; return [s + radius * Math.cos(a), z + radius * Math.sin(a)];
  });
  for (const collarCenters of collarRuns) for (let i = 0; i < collarCenters.length; i += 1) {
    const [s, z] = collarCenters[i], ring = circle(s, z);
    if (i + 1 < collarCenters.length) {
      const [s2, z2] = collarCenters[i + 1], length = Math.hypot(s2 - s, z2 - z);
      if (length > 1e-9) {
        const nx = -(z2 - z) / length * radius, ny = (s2 - s) / length * radius;
        capsules.push([[[s + nx, z + ny], [s2 + nx, z2 + ny], [s2 - nx, z2 - ny], [s - nx, z - ny], [s + nx, z + ny]]]);
      }
    }
    capsules.push([[...ring, ring[0]]]);
  }
  const sweep = polygonClipping.union(...capsules);
  const rect = [[[-halfWidth, -halfHeight], [halfWidth, -halfHeight], [halfWidth, halfHeight], [-halfWidth, halfHeight], [-halfWidth, -halfHeight]]];
  const section = polygonClipping.difference(rect, sweep);
  const toShape = (polygon) => {
    const shape = new THREE.Shape(polygon[0].slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y)));
    for (const hole of polygon.slice(1)) shape.holes.push(new THREE.Path(hole.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y))));
    return shape;
  };
  // Shape (s, z) extruded along e maps to wheel frame (-(R0 + e), -s, z): the
  // gap is centred on the wheel-frame angle pi and s = -y is proper-handed.
  const radialMap = (r0) => new THREE.Matrix4().set(0, 0, -1, -r0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);
  const block = new THREE.ExtrudeGeometry(section.map(toShape), { depth: radialEnd - radialStart, bevelEnabled: false, curveSegments: 1 })
    .applyMatrix4(radialMap(radialStart));
  const parts = [block];
  for (const side of [1, -1]) {
    const bar = new THREE.BoxGeometry(barOuter - barInner, barWidth, barHigh - barLow)
      .translate(-(barInner + barOuter) / 2, 0, side * (barLow + barHigh) / 2);
    // The foot rises into the bar and is slightly narrower so no faces coincide.
    const footTop = (barLow + barHigh) / 2, footInner = barInner + 0.01;
    const foot = new THREE.BoxGeometry(footOuter - footInner, barWidth * 0.85, footTop - footLow)
      .translate(-(footInner + footOuter) / 2, 0, side * (footTop + footLow) / 2);
    parts.push(bar.toNonIndexed(), foot.toNonIndexed());
  }
  const merged = mergeGeometries(parts.map((g) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); return n; }));
  merged.computeVertexNormals(); merged.computeBoundingBox(); merged.computeBoundingSphere();
  merged.userData = { collarRadius, clearance, halfWidth, halfHeight, radialStart, radialEnd, barLow, barHigh, sectionPieces: section.length };
  return merged;
}
