import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';

// Shared geometry for Brown's section views rendered as ONE clean cutaway:
// solid walls, cut on a plane facing the default camera, with plain solid cut
// faces. Nothing is translucent; the internal parts are seen through the cut.
//
// Lathe convention (same as THREE.LatheGeometry): a profile point [r, y] at
// angle phi maps to (r sin phi, y, r cos phi). The default phi range keeps
// the back half (z <= 0), so the cut plane is local z = 0 facing +z. Rotate
// or place the mesh so that plane faces the movement's default camera.

export const BACK_HALF = Object.freeze({phiStart: Math.PI / 2, phiLength: Math.PI});

function signedArea(profile) {
  let area = 0;
  for (let i = 0; i < profile.length; i++) {
    const [ax, ay] = profile[i], [bx, by] = profile[(i + 1) % profile.length];
    area += ax * by - bx * ay;
  }
  return area / 2;
}

// Closed [r, y] polygon (r >= 0) swept through phiLength about local Y, with
// flat-shaded walls (one band per profile edge) and two planar cut caps.
// Geometry group 0 holds the walls and group 1 the cut faces, so a mesh can
// take [wallMaterial, cutMaterial].
export function latheSectionGeometry(profile, {segments = 48, phiStart = BACK_HALF.phiStart, phiLength = BACK_HALF.phiLength} = {}) {
  const points = signedArea(profile) < 0 ? [...profile].reverse() : profile.map(point => [...point]);
  const full = phiLength >= Math.PI * 2 - 1e-9;
  const steps = Math.max(2, Math.ceil(segments * phiLength / (Math.PI * 2)));
  const positions = [], normals = [], indices = [];
  const push = (position, normal) => {
    positions.push(...position);normals.push(...normal);return positions.length / 3 - 1;
  };
  for (let e = 0; e < points.length; e++) {
    const [ar, ay] = points[e], [br, by] = points[(e + 1) % points.length];
    const dr = br - ar, dy = by - ay, length = Math.hypot(dr, dy);
    if (length < 1e-12) continue;
    // Counter-clockwise profile: outward normal is the edge direction turned right.
    const nr = dy / length, ny = -dr / length;
    const base = positions.length / 3;
    for (let s = 0; s <= steps; s++) {
      const phi = phiStart + phiLength * s / steps, sin = Math.sin(phi), cos = Math.cos(phi);
      push([ar * sin, ay, ar * cos], [nr * sin, ny, nr * cos]);
      push([br * sin, by, br * cos], [nr * sin, ny, nr * cos]);
    }
    for (let s = 0; s < steps; s++) {
      const a = base + 2 * s, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }
  const wallCount = indices.length;
  if (!full) {
    const triangles = THREE.ShapeUtils.triangulateShape(points.map(([r, y]) => new THREE.Vector2(r, y)), []);
    for (const [phi, side] of [[phiStart, -1], [phiStart + phiLength, 1]]) {
      const sin = Math.sin(phi), cos = Math.cos(phi);
      // Outward cap normal is +/- the sweep tangent (cos, 0, -sin).
      const normal = [side * cos, 0, -side * sin];
      const base = positions.length / 3;
      for (const [r, y] of points) push([r * sin, y, r * cos], normal);
      for (const [a, b, c] of triangles) {
        if (side > 0) indices.push(base + a, base + b, base + c);else indices.push(base + a, base + c, base + b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.addGroup(0, wallCount, 0);
  if (indices.length > wallCount) geometry.addGroup(wallCount, indices.length - wallCount, 1);
  // Fix any triangle whose winding disagrees with its authored normal.
  const p = geometry.attributes.position, n = geometry.attributes.normal, A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), N = new THREE.Vector3();
  for (let i = 0; i < indices.length; i += 3) {
    A.fromBufferAttribute(p, indices[i]);B.fromBufferAttribute(p, indices[i + 1]);C.fromBufferAttribute(p, indices[i + 2]);
    N.fromBufferAttribute(n, indices[i]);
    const face = B.sub(A).cross(C.sub(A));
    if (face.lengthSq() > 1e-20 && face.dot(N) < 0) {const t = indices[i + 1];indices[i + 1] = indices[i + 2];indices[i + 2] = t;}
  }
  geometry.setIndex(indices);
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

// A plain, slightly darker opaque copy of a part material for its cut faces.
export function cutFaceMaterial(material, shade = 0.84) {
  const cut = material.clone();
  cut.transparent = false;cut.opacity = 1;cut.depthWrite = true;cut.side = THREE.FrontSide;
  if (cut.map) cut.map = null;
  if (cut.color) cut.color.multiplyScalar(shade);
  cut.name = `${material.name || 'part'}-cut-face`;
  return cut;
}

// Opaque, front-sided copy of a material that earlier stood in translucently
// for a section.
export function solidMaterial(material, color) {
  const solid = material.clone();
  solid.transparent = false;solid.opacity = 1;solid.depthWrite = true;solid.side = THREE.FrontSide;
  if (color !== undefined) solid.color.set(color);
  return solid;
}

export function latheSectionMesh(profile, material, {cutMaterial = cutFaceMaterial(material), ...options} = {}) {
  const mesh = new THREE.Mesh(latheSectionGeometry(profile, options), [material, cutMaterial]);
  mesh.castShadow = true;mesh.receiveShadow = true;
  mesh.userData.cutawaySection = true;
  return mesh;
}

// Tube wall (inner/outer radius, along local Y from y0 to y1) cut in half.
export function tubeSectionMesh(inner, outer, y0, y1, material, options = {}) {
  return latheSectionMesh([[inner, y0], [outer, y0], [outer, y1], [inner, y1]], material, options);
}

// Tapered tube wall: radii may differ at the two ends.
export function taperedTubeSectionMesh(inner0, outer0, inner1, outer1, y0, y1, material, options = {}) {
  return latheSectionMesh([[inner0, y0], [outer0, y0], [outer1, y1], [inner1, y1]], material, options);
}

// Back part of a hollow rectangular casing cut on the plane z = cutZ (local),
// which faces +z. The back wall and the four side walls are solid boxes; the
// walls' +z faces at the cut take the cut-face material.
export function boxShellSection({width, height, depth, wall, cutZ = 0, material, cutMaterial = cutFaceMaterial(material), back = true, sides = {left: true, right: true, top: true, bottom: true}}) {
  const group = new THREE.Group(), z0 = -depth / 2, span = cutZ - z0;
  group.name = 'casing-section';
  const materials = [material, material, material, material, cutMaterial, material];
  const add = (w, h, d, x, y, z, name, faces = materials) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), faces);
    mesh.position.set(x, y, z);mesh.name = name;mesh.castShadow = true;mesh.receiveShadow = true;
    mesh.userData.cutawaySection = true;group.add(mesh);return mesh;
  };
  if (back) add(width, height, wall, 0, 0, z0 + wall / 2, 'casing-back-wall', material);
  const zs = back ? z0 + wall : z0, ds = cutZ - zs, zc = (zs + cutZ) / 2;
  if (span > 0 && ds > 0) {
    if (sides.left) add(wall, height, ds, -width / 2 + wall / 2, 0, zc, 'casing-left-wall');
    if (sides.right) add(wall, height, ds, width / 2 - wall / 2, 0, zc, 'casing-right-wall');
    if (sides.top) add(width - 2 * wall, wall, ds, 0, height / 2 - wall / 2, zc, 'casing-top-wall');
    if (sides.bottom) add(width - 2 * wall, wall, ds, 0, -height / 2 + wall / 2, zc, 'casing-bottom-wall');
  }
  return group;
}

// Silvery mercury, opaque metal rather than water.
export function mercuryMaterial() {
  // Moderate metalness keeps it bright without an environment map.
  return new THREE.MeshStandardMaterial({name: 'mercury', color: 0xc3c9cf, metalness: 0.45, roughness: 0.22, fog: false});
}

// ---------------------------------------------------------------------------
// Generic plane section of a closed (watertight) triangle mesh. Keeps the side
// where normal . p + constant <= 0 and closes the cut with planar caps built
// from the cut loops (nested loops become holes). Returns a geometry with
// group 0 = remaining surface, group 1 = cut faces, and the count of cut
// chains that failed to close (non-zero means the source was an open shell).
function sectionComponent(geometry, plane) {
  const position = geometry.attributes.position, normalAttribute = geometry.attributes.normal;
  const n = plane.normal.clone().normalize(), constant = plane.constant / plane.normal.length();
  const kept = [], keptNormals = [], segments = [];
  const P = i => new THREE.Vector3().fromBufferAttribute(position, i);
  const N = i => normalAttribute ? new THREE.Vector3().fromBufferAttribute(normalAttribute, i) : null;
  const key = v => `${Math.round(v.x * 1e5)},${Math.round(v.y * 1e5)},${Math.round(v.z * 1e5)}`;
  // Intersection of an edge computed from canonically ordered endpoints so
  // that neighbouring triangles produce bit-identical points.
  const cross = (a, da, b, db, na, nb) => {
    let swap = key(a) > key(b);
    const [p, dp, q, dq, m, o] = swap ? [b, db, a, da, nb, na] : [a, da, b, db, na, nb];
    const t = dp / (dp - dq);
    return {p: p.clone().lerp(q, t), n: m && o ? m.clone().lerp(o, t).normalize() : null};
  };
  for (let i = 0; i < position.count; i += 3) {
    const v = [P(i), P(i + 1), P(i + 2)], m = [N(i), N(i + 1), N(i + 2)];
    const d = v.map(p => {const value = n.dot(p) + constant;return Math.abs(value) < 1e-9 ? 1e-9 : value;});
    const polygon = [], cuts = [];
    for (let k = 0; k < 3; k++) {
      const a = k, b = (k + 1) % 3;
      if (d[a] <= 0) polygon.push({p: v[a], n: m[a]});
      if ((d[a] <= 0) !== (d[b] <= 0)) {const point = cross(v[a], d[a], v[b], d[b], m[a], m[b]);polygon.push(point);cuts.push(point.p);}
    }
    for (let k = 1; k + 1 < polygon.length; k++) for (const q of [polygon[0], polygon[k], polygon[k + 1]]) {
      kept.push(q.p.x, q.p.y, q.p.z);
      const qn = q.n ?? new THREE.Vector3();keptNormals.push(qn.x, qn.y, qn.z);
    }
    if (cuts.length === 2) {
      // Orient each cut so the section region lies to its left seen from +n:
      // direction n x N for the face's outward normal N.
      const face = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])), along = n.clone().cross(face);
      segments.push(cuts[1].clone().sub(cuts[0]).dot(along) >= 0 ? cuts : [cuts[1], cuts[0]]);
    }
  }
  // Planar 2D basis with u x w = n.
  const u = new THREE.Vector3().crossVectors(n, Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
  const w = new THREE.Vector3().crossVectors(n, u);
  const flatten = p => new THREE.Vector2(p.dot(u), p.dot(w));
  // Chain cut segments into loops (undirected: source winding need not be
  // consistent). Each closed shell is processed on its own, so loops of one
  // shell do not touch.
  // Each segment is its own edge record, so coincident duplicate faces (from
  // merged parts) pair up instead of leaving dangling ends.
  const adjacency = new Map(), points = new Map(), spatial = new Map();
  for (const [a, b] of segments) {
    const ka = key(a), kb = key(b);if (ka === kb) continue;
    points.set(ka, flatten(a));points.set(kb, flatten(b));spatial.set(ka, a);spatial.set(kb, b);
    const edge = {a: ka, b: kb, used: false};
    for (const k of [ka, kb]) {if (!adjacency.has(k)) adjacency.set(k, []);adjacency.get(k).push(edge);}
  }
  // Walk unused edges; whenever the walk returns to a point already on it,
  // split off that cycle as a loop (points where loops touch have degree 4).
  const loops = [];let open = 0;
  const other = (edge, k) => edge.a === k ? edge.b : edge.a;
  for (const start of adjacency.keys()) {
    for (;;) {
      const first = adjacency.get(start).find(e => !e.used);
      if (!first) break;
      const path = [start], at = new Map([[start, 0]]);
      first.used = true;
      let current = other(first, start), previous = start;
      for (;;) {
        if (at.has(current)) {
          const from = at.get(current), cycle = path.slice(from);
          if (cycle.length >= 3) loops.push(cycle);
          for (const k of cycle) at.delete(k);
          path.length = from;
        }
        path.push(current);at.set(current, path.length - 1);
        const choices = adjacency.get(current).filter(e => !e.used);
        const next = choices.find(e => other(e, current) !== previous) ?? choices[0];
        if (!next) break;
        next.used = true;previous = current;current = other(next, current);
      }
      if (path.length > 1) open++;
    }
  }
  const inside = (pt, poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x) c = !c;
    }
    return c;
  };
  const within = (poly, other) => {
    const step = Math.max(1, Math.floor(poly.length / 24));
    for (let k = 0; k < poly.length; k += step) if (!inside(poly[k], other)) return false;
    return true;
  };
  const flat = loop => loop.map(k => points.get(k)), area = keys => Math.abs(THREE.ShapeUtils.area(flat(keys)));
  // Even nesting depth bounds material, odd depth is a hole in its nearest
  // enclosing loop.
  const depth = loops.map((loop, i) => loops.reduce((d, other, j) => d + (j !== i && within(flat(loop), flat(other)) ? 1 : 0), 0));
  const oriented = (loop, ccw) => (THREE.ShapeUtils.area(flat(loop)) > 0) === ccw ? loop : [...loop].reverse();
  const material = loops.filter((l, i) => depth[i] % 2 === 0).map(l => oriented(l, true));
  const voids = loops.filter((l, i) => depth[i] % 2 === 1).map(l => oriented(l, false));
  const outers = material.map(contour => ({contour, holes: []}));
  for (const hole of voids) {
    const host = outers.filter(o => within(flat(hole), flat(o.contour))).sort((a, b) => area(a.contour) - area(b.contour))[0];
    if (host) host.holes.push(hole);
  }
  const caps = [];
  const emit = (a, b, c) => {for (const p of [a, b, c]) caps.push(p.x, p.y, p.z);};
  const ring = keys => {const r = flat(keys).map(p => [p.x, p.y]);r.push(r[0]);return [r];};
  const naive = outers.reduce((sum, o) => sum + area(o.contour) - o.holes.reduce((h, k) => h + area(k), 0), 0);
  let region = null;
  if (outers.length > 1 || voids.length > outers.reduce((n, o) => n + o.holes.length, 0)) {
    region = polygonClipping.union(...material.map(ring));
    if (voids.length) region = polygonClipping.difference(region, ...voids.map(ring));
    const resolved = region.reduce((sum, [outer, ...holes]) => sum + Math.abs(THREE.ShapeUtils.area(outer.map(([x, y]) => new THREE.Vector2(x, y))))
      - holes.reduce((h, r) => h + Math.abs(THREE.ShapeUtils.area(r.map(([x, y]) => new THREE.Vector2(x, y)))), 0), 0);
    if (Math.abs(resolved - naive) <= 1e-6 * Math.max(1, Math.abs(naive))) region = null;
  }
  if (!region) {
    for (const {contour, holes} of outers) {
      const keys = [...contour, ...holes.flat()];
      for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(flat(contour), holes.map(flat))) emit(spatial.get(keys[a]), spatial.get(keys[b]), spatial.get(keys[c]));
    }
  } else {
    const lift = ([x, y]) => u.clone().multiplyScalar(x).addScaledVector(w, y).addScaledVector(n, -constant);
    for (const [outer, ...holes] of region) {
      const toVectors = r => r.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y));
      const contour = toVectors(outer), holeLoops = holes.map(toVectors);
      if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
      for (const h of holeLoops) if (!THREE.ShapeUtils.isClockWise(h)) h.reverse();
      const all = [...contour, ...holeLoops.flat()];
      for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, holeLoops)) emit(...[all[a], all[b], all[c]].map(q => lift([q.x, q.y])));
    }
  }
  const out = new THREE.BufferGeometry();
  const capNormals = [];for (let i = 0; i < caps.length; i += 3) capNormals.push(n.x, n.y, n.z);
  out.setAttribute('position', new THREE.Float32BufferAttribute([...kept, ...caps], 3));
  if (normalAttribute) out.setAttribute('normal', new THREE.Float32BufferAttribute([...keptNormals, ...capNormals], 3));
  else out.computeVertexNormals();
  out.addGroup(0, kept.length / 3, 0);
  if (caps.length) out.addGroup(kept.length / 3, caps.length / 3, 1);
  out.computeBoundingBox();out.computeBoundingSphere();
  out.userData.sectionOpenChains = open;
  return out;
}

// Merged parts (several closed shells in one geometry) are sectioned shell
// by shell, so each keeps exact, watertight caps even where parts overlap.
export function sectionGeometryByPlane(source, plane) {
  const geometry = source.index ? source.toNonIndexed() : source;
  const position = geometry.attributes.position, normal = geometry.attributes.normal, count = position.count;
  const parent = [], vertexKey = new Map();
  const find = i => {while (parent[i] !== i) {parent[i] = parent[parent[i]];i = parent[i];}return i;};
  const triangles = count / 3;
  for (let t = 0; t < triangles; t++) parent[t] = t;
  for (let i = 0; i < count; i++) {
    const k = `${Math.round(position.getX(i) * 1e5)},${Math.round(position.getY(i) * 1e5)},${Math.round(position.getZ(i) * 1e5)}`;
    const t = Math.floor(i / 3);
    if (vertexKey.has(k)) {const a = find(vertexKey.get(k)), b = find(t);if (a !== b) parent[a] = b;} else vertexKey.set(k, t);
  }
  const components = new Map();
  for (let t = 0; t < triangles; t++) {const r = find(t);if (!components.has(r)) components.set(r, []);components.get(r).push(t);}
  if (components.size <= 1) return sectionComponent(geometry, plane);
  const kept = [], keptNormals = [], caps = [], capNormals = [];let open = 0;
  for (const list of components.values()) {
    const part = new THREE.BufferGeometry(), pos = new Float32Array(list.length * 9), nor = normal ? new Float32Array(list.length * 9) : null;
    list.forEach((t, j) => {for (let k = 0; k < 9; k++) {pos[j * 9 + k] = position.array[t * 9 + k];if (nor) nor[j * 9 + k] = normal.array[t * 9 + k];}});
    part.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    if (nor) part.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    const cut = sectionComponent(part, plane), p = cut.attributes.position.array, q = cut.attributes.normal.array;
    const [wall, cap] = cut.groups;
    for (const [group, positions, normals] of [[wall, kept, keptNormals], [cap, caps, capNormals]]) {
      if (!group) continue;
      for (let i = group.start * 3; i < (group.start + group.count) * 3; i++) {positions.push(p[i]);normals.push(q[i]);}
    }
    // A shell joined only through T-junctions splits into open pieces; then
    // section the geometry as a whole instead.
    if (cut.userData.sectionOpenChains) return sectionComponent(geometry, plane);
    open += cut.userData.sectionOpenChains;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute([...kept, ...caps], 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute([...keptNormals, ...capNormals], 3));
  if (!normal) out.computeVertexNormals();
  out.addGroup(0, kept.length / 3, 0);
  if (caps.length) out.addGroup(kept.length / 3, caps.length / 3, 1);
  out.computeBoundingBox();out.computeBoundingSphere();
  out.userData.sectionOpenChains = open;
  return out;
}

// Cut a mesh in place on a plane given in `frame` space (default: the mesh's
// parent chain up to `frame`), e.g. the model root with plane z = 0 facing the
// camera. The part becomes opaque; cut faces take a slightly darker shade.
export function sectionMeshInPlace(mesh, frame, {normal = new THREE.Vector3(0, 0, 1), point = new THREE.Vector3(), color, shade} = {}) {
  frame.updateMatrixWorld(true);
  const toFrame = new THREE.Matrix4().copy(frame.matrixWorld).invert().multiply(mesh.matrixWorld);
  // A sub-visible offset keeps the plane off vertices that lie exactly on the
  // authored section plane (pipe axes), which would give degenerate cuts.
  const unit = normal.clone().normalize();
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(unit, point.clone().addScaledVector(unit, 1.37e-4)).applyMatrix4(new THREE.Matrix4().copy(toFrame).invert());
  const geometry = sectionGeometryByPlane(mesh.geometry, plane);
  // Keep the source parameters: updates may rescale by the authored height.
  if (mesh.geometry.parameters) geometry.parameters = {...mesh.geometry.parameters};
  mesh.geometry.dispose();mesh.geometry = geometry;
  const base = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const wall = solidMaterial(base, color);
  mesh.material = [wall, cutFaceMaterial(wall, shade)];
  mesh.castShadow = true;mesh.receiveShadow = true;
  mesh.userData.cutawaySection = true;
  return geometry.userData.sectionOpenChains;
}
