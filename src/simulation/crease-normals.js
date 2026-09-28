import * as THREE from 'three';

// three's LatheGeometry gives every profile point one normal: the
// length-weighted sum of its two segments' normals. A machined profile (a
// disc face meeting its rim, a hub shoulder, a bore) is then shaded as if its
// flat faces were domed. This rebuilds a lathe grid in place with its profile
// split at corners sharper than creaseAngle, so flat faces and cylindrical
// walls keep their own normals while finely sampled curves stay smooth.
// Normals come from the current positions, so it is safe after rotations,
// translations and scales. The geometry keeps its type and parameters.
export function creaseLatheNormals(geometry, creaseAngle = Math.PI / 6) {
  if (!geometry?.isBufferGeometry || geometry.type !== 'LatheGeometry') return geometry;
  if (geometry.userData.latheCreased) return geometry;
  const { points, segments: rawSegments } = geometry.parameters ?? {};
  const pointCount = points?.length ?? 0;
  const segments = Math.floor(rawSegments ?? 0);
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  if (pointCount < 3 || segments < 1 || !position || !normal
    || position.count !== (segments + 1) * pointCount
    || geometry.index?.count !== segments * (pointCount - 1) * 6
    || geometry.morphAttributes.position?.length
    || geometry.groups.length) {
    // A lathe whose index was regrouped or edited is no longer a plain grid.
    if (geometry.index && position) creaseIndexedNormals(geometry, creaseAngle);
    geometry.userData.latheCreased = true;
    return geometry;
  }
  // Only rebuild an untouched grid (e.g. not one whose winding was flipped).
  const sourceIndex = geometry.index.array;
  for (let i = 0, n = 0; i < segments; i += 1) {
    for (let j = 0; j < pointCount - 1; j += 1, n += 6) {
      const a = j + i * pointCount; const b = a + pointCount;
      if (sourceIndex[n] !== a || sourceIndex[n + 1] !== b || sourceIndex[n + 2] !== a + 1
        || sourceIndex[n + 3] !== b + 1 || sourceIndex[n + 4] !== a + 1 || sourceIndex[n + 5] !== b) {
        creaseIndexedNormals(geometry, creaseAngle);
        geometry.userData.latheCreased = true;
        return geometry;
      }
    }
  }

  const at = (i, j) => i * pointCount + j;
  const p = (i, j, target) => target.fromBufferAttribute(position, at(i, j));
  const va = new THREE.Vector3(); const vb = new THREE.Vector3();
  const vc = new THREE.Vector3(); const vd = new THREE.Vector3();
  const e1 = new THREE.Vector3(); const e2 = new THREE.Vector3();
  const sum = new THREE.Vector3();
  // Quad (i, j) spans meridians i..i+1 and profile points j..j+1 and is drawn
  // as triangles (a, b, d) and (c, d, b), as in LatheGeometry.
  const quadNormals = new Float32Array(segments * (pointCount - 1) * 3);
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < pointCount - 1; j += 1) {
      p(i, j, va); p(i + 1, j, vb); p(i + 1, j + 1, vc); p(i, j + 1, vd);
      sum.subVectors(vd, vb).cross(e1.subVectors(va, vb));
      sum.add(e2.subVectors(vb, vd).cross(e1.subVectors(vc, vd)));
      const length = sum.length();
      if (length > 1e-14) sum.divideScalar(length); else sum.set(0, 0, 0);
      sum.toArray(quadNormals, (i * (pointCount - 1) + j) * 3);
    }
  }
  const quad = (i, j, target) => target.fromArray(quadNormals, (i * (pointCount - 1) + j) * 3);

  const closedTurn = geometry.parameters.phiLength >= Math.PI * 2 - 1e-9;
  const neighbours = (i) => {
    const list = [];
    if (i > 0) list.push(i - 1); else if (closedTurn) list.push(segments - 1);
    if (i < segments) list.push(i); else if (closedTurn) list.push(0);
    return list;
  };
  // Segment normal on the first meridian, skipping zero-length segments.
  const segmentNormal = (j, target) => {
    for (let i = 0; i < segments; i += 1) {
      if (quad(i, j, target).lengthSq() > 0.5) return target;
    }
    return target.set(0, 0, 0);
  };
  const s0 = new THREE.Vector3(); const s1 = new THREE.Vector3();
  const cosCrease = Math.cos(creaseAngle);
  const smoothBetween = (left, right) => {
    segmentNormal(left, s0); segmentNormal(right, s1);
    if (s0.lengthSq() < 0.5 || s1.lengthSq() < 0.5) return true;
    return s0.dot(s1) >= cosCrease;
  };
  const first = points[0]; const last = points[pointCount - 1];
  const closedProfile = Math.abs(first.x - last.x) < 1e-12 && Math.abs(first.y - last.y) < 1e-12;
  const seamSmooth = closedProfile && smoothBetween(pointCount - 2, 0);

  // Each profile point contributes one vertex column, or two at a crease: the
  // lower one closes segment j-1 and the upper one opens segment j.
  const columns = [];
  const lowerSlot = new Int32Array(pointCount);
  const upperSlot = new Int32Array(pointCount);
  let splits = 0;
  for (let j = 0; j < pointCount; j += 1) {
    let segs;
    if (j === 0) segs = seamSmooth ? [[0, pointCount - 2]] : [[0]];
    else if (j === pointCount - 1) segs = seamSmooth ? [[j - 1, 0]] : [[j - 1]];
    else if (smoothBetween(j - 1, j)) segs = [[j - 1, j]];
    else { segs = [[j - 1], [j]]; splits += 1; }
    lowerSlot[j] = columns.length;
    for (const set of segs) columns.push({ j, set });
    upperSlot[j] = columns.length - 1;
  }
  if (splits === 0 && !seamSmooth) {
    // Nothing to split: the default smooth normals already suit the profile.
    geometry.userData.latheCreased = true;
    return geometry;
  }

  const columnCount = columns.length;
  const vertexCount = (segments + 1) * columnCount;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = uv ? new Float32Array(vertexCount * 2) : null;
  const original = new THREE.Vector3(); const qn = new THREE.Vector3();
  let orientation = 0;
  for (let i = 0; i <= segments; i += 1) {
    const around = neighbours(i);
    for (let k = 0; k < columnCount; k += 1) {
      const { j, set } = columns[k];
      const source = at(i, j);
      const target = i * columnCount + k;
      positions[3 * target] = position.getX(source);
      positions[3 * target + 1] = position.getY(source);
      positions[3 * target + 2] = position.getZ(source);
      if (uvs) { uvs[2 * target] = uv.getX(source); uvs[2 * target + 1] = uv.getY(source); }
      sum.set(0, 0, 0);
      for (const segment of set) for (const m of around) sum.add(quad(m, segment, qn));
      original.fromBufferAttribute(normal, source);
      if (sum.lengthSq() < 1e-20) sum.copy(original);
      sum.normalize();
      orientation += sum.dot(original);
      sum.toArray(normals, 3 * target);
    }
  }
  // Mirrored geometry transforms keep the winding but flip the normals.
  if (orientation < 0) for (let n = 0; n < normals.length; n += 1) normals[n] = -normals[n];

  const indices = [];
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < pointCount - 1; j += 1) {
      const a = i * columnCount + upperSlot[j];
      const b = (i + 1) * columnCount + upperSlot[j];
      const c = (i + 1) * columnCount + lowerSlot[j + 1];
      const d = i * columnCount + lowerSlot[j + 1];
      indices.push(a, b, d, c, d, b);
    }
  }
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (uvs) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.boundingBox = null;
  geometry.boundingSphere = null;
  geometry.userData.latheCreased = true;
  return geometry;
}

// Load-time pass for parts authored directly with three's generators: lathes
// get creased profiles, cylinders or cones with at most six sides (hex
// nuts, square and triangular pyramids) get flat side faces, since so few
// sides are a prism, not a coarse round, and extrusions get smooth side walls
// along sampled curves (smoothFacetNormals). Each geometry is treated once.
// three's parametric generators author their own (smooth or flat) normals.
const PARAMETRIC = /^(Box|Plane|Circle|Ring|Cylinder|Cone|Sphere|Torus|TorusKnot|Tube|Capsule|Lathe|Icosahedron|Octahedron|Tetrahedron|Dodecahedron|Polyhedron|Edges|Wireframe)Geometry$/;
export function creaseNormalsIn(root) {
  const seen = new Set();
  root.traverse((object) => {
    const geometry = object.geometry;
    if (!geometry || seen.has(geometry)) return;
    seen.add(geometry);
    if (geometry.type === 'LatheGeometry') creaseLatheNormals(geometry);
    else if ((geometry.type === 'CylinderGeometry' || geometry.type === 'ConeGeometry')
      && geometry.parameters?.radialSegments <= 6 && !geometry.userData.prismCreased) {
      creaseIndexedNormals(geometry, Math.PI / 6);
      geometry.userData.prismCreased = true;
    } else if (!PARAMETRIC.test(geometry.type) && !geometry.isInstancedBufferGeometry
      && ![].concat(object.material ?? []).some((material) => material?.flatShading)) smoothFacetNormals(geometry);
  });
  return root;
}

// Indexed geometry smoothed with computeVertexNormals shares one normal per
// vertex across every face that meets it, so a block or plate whose faces
// share corner vertices shades as if rounded. This splits each vertex by the
// faces around it: a corner takes the area-weighted normal of the adjacent
// faces within creaseAngle of its own face, and corners with equal results
// share a vertex again. Surfaces sampled finer than creaseAngle stay smooth.
// Use it on static geometry only: the vertex count grows (each vertex keeps
// its index; split copies are appended).
export function creaseIndexedNormals(geometry, creaseAngle = Math.PI * 2 / 9) {
  const index = geometry?.index;
  const position = geometry?.attributes?.position;
  if (!index || !position || geometry.morphAttributes.position?.length) return geometry;
  if (Object.values(geometry.attributes).some((attribute) => attribute.isInterleavedBufferAttribute)) return geometry;
  const faceCount = Math.floor(index.count / 3);
  const faceVectors = new Float64Array(faceCount * 3);
  const faceUnits = new Float64Array(faceCount * 3);
  const a = new THREE.Vector3(); const b = new THREE.Vector3(); const c = new THREE.Vector3();
  const cb = new THREE.Vector3(); const ab = new THREE.Vector3();
  for (let f = 0; f < faceCount; f += 1) {
    a.fromBufferAttribute(position, index.getX(3 * f));
    b.fromBufferAttribute(position, index.getX(3 * f + 1));
    c.fromBufferAttribute(position, index.getX(3 * f + 2));
    cb.subVectors(c, b).cross(ab.subVectors(a, b));
    faceVectors[3 * f] = cb.x; faceVectors[3 * f + 1] = cb.y; faceVectors[3 * f + 2] = cb.z;
    const length = cb.length();
    if (length > 0) cb.divideScalar(length);
    faceUnits[3 * f] = cb.x; faceUnits[3 * f + 1] = cb.y; faceUnits[3 * f + 2] = cb.z;
  }
  const vertexCount = position.count;
  const starts = new Int32Array(vertexCount + 1);
  for (let k = 0; k < 3 * faceCount; k += 1) starts[index.getX(k) + 1] += 1;
  for (let v = 0; v < vertexCount; v += 1) starts[v + 1] += starts[v];
  const fill = starts.slice(0, vertexCount);
  const corners = new Int32Array(3 * faceCount);
  for (let k = 0; k < 3 * faceCount; k += 1) corners[fill[index.getX(k)]++] = k;

  const cosCrease = Math.cos(creaseAngle);
  const cornerNormal = new Float32Array(9 * faceCount);
  let creased = false;
  for (let v = 0; v < vertexCount; v += 1) {
    for (let s = starts[v]; s < starts[v + 1]; s += 1) {
      const f = Math.floor(corners[s] / 3);
      let x = 0; let y = 0; let z = 0;
      for (let t = starts[v]; t < starts[v + 1]; t += 1) {
        const g = Math.floor(corners[t] / 3);
        const dot = faceUnits[3 * f] * faceUnits[3 * g] + faceUnits[3 * f + 1] * faceUnits[3 * g + 1]
          + faceUnits[3 * f + 2] * faceUnits[3 * g + 2];
        const degenerate = faceUnits[3 * g] === 0 && faceUnits[3 * g + 1] === 0 && faceUnits[3 * g + 2] === 0;
        if (g !== f && !degenerate && dot < cosCrease) { creased = true; continue; }
        x += faceVectors[3 * g]; y += faceVectors[3 * g + 1]; z += faceVectors[3 * g + 2];
      }
      const length = Math.hypot(x, y, z) || 1;
      cornerNormal.set([x / length, y / length, z / length], 3 * corners[s]);
    }
  }
  if (!creased) {
    // Nothing to split: keep existing normals, or smooth ones for new geometry.
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    return geometry;
  }
  // One output vertex per distinct (source vertex, normal) pair. Each source
  // vertex keeps its index for its first normal and further copies are
  // appended, so builders' structured grids (row/column vertex addressing, as
  // used by the contact analyses) survive the split.
  const remap = new Int32Array(3 * faceCount);
  const sources = Array.from({ length: vertexCount }, (_, v) => v);
  const normals = new Array(3 * vertexCount).fill(0);
  const unused = [];
  for (let v = 0; v < vertexCount; v += 1) {
    const made = [];
    for (let s = starts[v]; s < starts[v + 1]; s += 1) {
      const k = corners[s];
      const nx = cornerNormal[3 * k]; const ny = cornerNormal[3 * k + 1]; const nz = cornerNormal[3 * k + 2];
      let found = made.find(([, mx, my, mz]) => Math.abs(mx - nx) < 1e-5 && Math.abs(my - ny) < 1e-5 && Math.abs(mz - nz) < 1e-5);
      if (!found) {
        const slot = made.length ? sources.length : v;
        found = [slot, nx, ny, nz];
        made.push(found);
        if (slot !== v) sources.push(v);
        normals[3 * slot] = nx; normals[3 * slot + 1] = ny; normals[3 * slot + 2] = nz;
      }
      remap[k] = found[0];
    }
    if (!made.length) unused.push(v);
  }
  // Keep the side the existing normals face (flipped or mirrored geometry).
  const previous = geometry.attributes.normal;
  if (previous && !previous.isInterleavedBufferAttribute) {
    let orientation = 0;
    for (let n = 0; n < sources.length; n += 1) {
      orientation += normals[3 * n] * previous.getX(sources[n]) + normals[3 * n + 1] * previous.getY(sources[n])
        + normals[3 * n + 2] * previous.getZ(sources[n]);
    }
    if (orientation < 0) for (let n = 0; n < normals.length; n += 1) normals[n] = -normals[n];
    // Vertices no face uses keep their previous normal.
    for (const v of unused) {
      normals[3 * v] = previous.getX(v); normals[3 * v + 1] = previous.getY(v); normals[3 * v + 2] = previous.getZ(v);
    }
  }
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    if (name === 'normal') continue;
    const size = attribute.itemSize;
    const array = new attribute.array.constructor(sources.length * size);
    for (let n = 0; n < sources.length; n += 1) {
      for (let component = 0; component < size; component += 1) {
        array[n * size + component] = attribute.array[sources[n] * size + component];
      }
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(array, size, attribute.normalized));
  }
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(Array.from(remap));
  geometry.boundingBox = null;
  geometry.boundingSphere = null;
  return geometry;
}

// three's ExtrudeGeometry is non-indexed and gives every side triangle its own
// normal, so an outline sampled from an arc, involute or spline shades as a
// row of flat bands; custom builders that emit one vertex per face corner and
// flat normals do the same. This rewrites only the normal attribute
// (positions, UVs, groups, index and vertex count are untouched): each corner
// takes the area-weighted normal of the faces round its vertex that it
// reaches across smooth edges. An edge is smooth when its faces meet at less
// than creaseAngle and either the kink is slight (under kinkAngle, invisible
// either way) or both faces are narrow across it (under narrowFraction of the
// part's size), i.e. a sampled curve rather than two long flat walls meeting
// at a real corner. Caps (90 degrees to the walls), chamfers and polygonal
// corners stay sharp; flat faces stay flat. Geometry whose vertices are shared
// between faces already has authored smooth normals and is left alone.
// Geometries already treated. A WeakSet, not a userData flag: some builders
// share one userData object between geometries, which made the flag skip
// every geometry after the first.
const facetsSmoothed = new WeakSet();
export function smoothFacetNormals(geometry, { creaseAngle = Math.PI * 25 / 180, kinkAngle = Math.PI * 4 / 180, narrowFraction = 0.06 } = {}) {
  const position = geometry?.attributes?.position;
  if (!position || facetsSmoothed.has(geometry) || geometry.morphAttributes.position?.length) return geometry;
  // Geometry rewritten every frame (steam and water volumes, flexing parts)
  // authors its own normals each frame; leave it alone.
  if (position.usage === THREE.DynamicDrawUsage || geometry.attributes.normal?.usage === THREE.DynamicDrawUsage
    || geometry.userData.dynamicGeometry) return geometry;
  facetsSmoothed.add(geometry);
  if (Object.values(geometry.attributes).some((attribute) => attribute.isInterleavedBufferAttribute)) return geometry;
  const index = geometry.index;
  const cornerCount = index ? index.count : position.count;
  const faceCount = Math.floor(cornerCount / 3);
  if (!faceCount) return geometry;
  const vertexOf = index ? (k) => index.getX(k) : (k) => k;
  if (index) {
    // Only corner-per-vertex geometry (each vertex used by one face corner).
    const used = new Uint8Array(position.count);
    for (let k = 0; k < cornerCount; k += 1) { const v = vertexOf(k); if (used[v]) return geometry; used[v] = 1; }
  }
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3()).length() || 1;
  const faceVectors = new Float64Array(faceCount * 3); const faceUnits = new Float64Array(faceCount * 3);
  const area2 = new Float64Array(faceCount);
  const a = new THREE.Vector3(); const b = new THREE.Vector3(); const c = new THREE.Vector3();
  const e1 = new THREE.Vector3(); const e2 = new THREE.Vector3();
  for (let f = 0; f < faceCount; f += 1) {
    a.fromBufferAttribute(position, vertexOf(3 * f)); b.fromBufferAttribute(position, vertexOf(3 * f + 1)); c.fromBufferAttribute(position, vertexOf(3 * f + 2));
    e1.subVectors(b, a).cross(e2.subVectors(c, a));
    const length = e1.length(); area2[f] = length;
    faceVectors[3 * f] = e1.x; faceVectors[3 * f + 1] = e1.y; faceVectors[3 * f + 2] = e1.z;
    if (length > 0) { faceUnits[3 * f] = e1.x / length; faceUnits[3 * f + 1] = e1.y / length; faceUnits[3 * f + 2] = e1.z / length; }
  }
  // Only geometry drawn flat: every corner normal is its face's normal.
  const normalAttribute = geometry.attributes.normal;
  if (normalAttribute) {
    for (let k = 0; k < cornerCount; k += 1) {
      const f = Math.floor(k / 3);
      if (!area2[f]) continue;
      const v = vertexOf(k);
      const dot = normalAttribute.getX(v) * faceUnits[3 * f] + normalAttribute.getY(v) * faceUnits[3 * f + 1] + normalAttribute.getZ(v) * faceUnits[3 * f + 2];
      if (dot < 0.9999) return geometry;
    }
  }
  // Weld on a grid of size / 50000 (each coordinate within 2^16 steps of the
  // box centre, so the packed key stays an exact integer).
  const quantum = size * 2e-5;
  const centre = geometry.boundingBox.getCenter(new THREE.Vector3());
  const ids = new Map(); const weld = new Int32Array(cornerCount);
  for (let k = 0; k < cornerCount; k += 1) {
    const i = vertexOf(k);
    const key = ((Math.round((position.getX(i) - centre.x) / quantum) + 65536) * 131072
      + Math.round((position.getY(i) - centre.y) / quantum) + 65536) * 131072
      + Math.round((position.getZ(i) - centre.z) / quantum) + 65536;
    let id = ids.get(key);
    if (id === undefined) { id = ids.size; ids.set(key, id); }
    weld[k] = id;
  }
  const vertexCount = ids.size;
  // Edges on welded vertices, each with the faces that use it.
  const edgeFaces = new Map();
  for (let f = 0; f < faceCount; f += 1) {
    if (!area2[f]) continue;
    for (let j = 0; j < 3; j += 1) {
      const u = weld[3 * f + j]; const v = weld[3 * f + (j + 1) % 3];
      if (u === v) continue;
      const key = u < v ? u * vertexCount + v : v * vertexCount + u;
      const list = edgeFaces.get(key);
      if (list) list.push(f); else edgeFaces.set(key, [f]);
    }
  }
  const cosCrease = Math.cos(creaseAngle); const cosKink = Math.cos(kinkAngle); const narrow = size * narrowFraction;
  const p = new THREE.Vector3(); const q = new THREE.Vector3();
  // Smooth joins: (welded vertex, face, face) for both ends of each smooth edge.
  const joinVertex = []; const joinFaces = [];
  for (const [key, list] of edgeFaces) {
    if (list.length !== 2) continue;
    const [f, g] = list;
    const dot = faceUnits[3 * f] * faceUnits[3 * g] + faceUnits[3 * f + 1] * faceUnits[3 * g + 1] + faceUnits[3 * f + 2] * faceUnits[3 * g + 2];
    if (dot < cosCrease) continue;
    const u = Math.floor(key / vertexCount); const v = key - u * vertexCount;
    if (dot < cosKink) {
      // Width of each face across the edge: twice its area over the edge length.
      for (let j = 0; j < 3; j += 1) {
        if (weld[3 * f + j] === u) p.fromBufferAttribute(position, vertexOf(3 * f + j));
        if (weld[3 * f + j] === v) q.fromBufferAttribute(position, vertexOf(3 * f + j));
      }
      const length = p.distanceTo(q) || 1e-12;
      if (area2[f] / length > narrow || area2[g] / length > narrow) continue;
    }
    joinVertex.push(u, v); joinFaces.push(f, g, f, g);
  }
  if (!joinVertex.length) return geometry;
  const normal = new Float32Array(position.count * 3);
  if (normalAttribute) normal.set(normalAttribute.array.subarray(0, position.count * 3));
  for (let k = 0; k < cornerCount; k += 1) {
    const f = Math.floor(k / 3); const v = vertexOf(k);
    if (area2[f]) { normal[3 * v] = faceUnits[3 * f]; normal[3 * v + 1] = faceUnits[3 * f + 1]; normal[3 * v + 2] = faceUnits[3 * f + 2]; }
  }
  // Compressed per-vertex lists of corners and of joins.
  const csr = (count, keyOf) => {
    const start = new Int32Array(vertexCount + 1);
    for (let n = 0; n < count; n += 1) start[keyOf(n) + 1] += 1;
    for (let w = 0; w < vertexCount; w += 1) start[w + 1] += start[w];
    const fill = start.slice(0, vertexCount); const items = new Int32Array(count);
    for (let n = 0; n < count; n += 1) items[fill[keyOf(n)]++] = n;
    return { start, items };
  };
  const joined = new Uint8Array(vertexCount);
  for (const w of joinVertex) joined[w] = 1;
  const cornersAt = csr(cornerCount, (k) => weld[k]);
  const joinsAt = csr(joinVertex.length, (n) => joinVertex[n]);
  const parent = new Int32Array(faceCount).fill(-1);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const sums = new Float64Array(faceCount * 3);
  for (let w = 0; w < vertexCount; w += 1) {
    if (!joined[w]) continue;
    const c0 = cornersAt.start[w]; const c1 = cornersAt.start[w + 1];
    for (let n = c0; n < c1; n += 1) { const f = Math.floor(cornersAt.items[n] / 3); parent[f] = f; sums[3 * f] = sums[3 * f + 1] = sums[3 * f + 2] = 0; }
    for (let n = joinsAt.start[w]; n < joinsAt.start[w + 1]; n += 1) {
      const j = joinsAt.items[n]; const f = joinFaces[2 * j]; const g = joinFaces[2 * j + 1];
      if (parent[f] >= 0 && parent[g] >= 0) { const rf = find(f); const rg = find(g); if (rf !== rg) parent[rf] = rg; }
    }
    for (let n = c0; n < c1; n += 1) {
      const f = Math.floor(cornersAt.items[n] / 3); const r = find(f);
      sums[3 * r] += faceVectors[3 * f]; sums[3 * r + 1] += faceVectors[3 * f + 1]; sums[3 * r + 2] += faceVectors[3 * f + 2];
    }
    for (let n = c0; n < c1; n += 1) {
      const k = cornersAt.items[n]; const r = find(Math.floor(k / 3)); const v = vertexOf(k);
      const length = Math.hypot(sums[3 * r], sums[3 * r + 1], sums[3 * r + 2]);
      if (length > 0) { normal[3 * v] = sums[3 * r] / length; normal[3 * v + 1] = sums[3 * r + 1] / length; normal[3 * v + 2] = sums[3 * r + 2] / length; }
    }
    for (let n = c0; n < c1; n += 1) parent[Math.floor(cornersAt.items[n] / 3)] = -1;
  }
  // Write in place when possible, so code holding the normal array keeps
  // writing to the attribute that is drawn.
  if (normalAttribute && normalAttribute.array.length === normal.length && !normalAttribute.isInterleavedBufferAttribute) {
    normalAttribute.array.set(normal);
    normalAttribute.needsUpdate = true;
  } else {
    geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  }
  return geometry;
}
