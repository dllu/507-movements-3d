import * as THREE from 'three';

// Pass 90: trunk b of the Jonval turbine (436) and its sloping supply pipe,
// joined as Brown draws them: a closed rectangular pipe whose walls end on
// the trunk's outer surface, and a trunk wall pierced by exactly the pipe's
// bore, so the pipe's inner faces run on through the wall into the trunk
// with no gap, lip or leak.
//
// The pipe is described by lines parallel to its axis: a point is
// (x, Y + slope (x - x0), z), with Y the vertical intercept at x = x0 and z
// across the pipe. Its bore is Y in [boreLow, boreHigh], |z| <= boreHalf;
// its walls add `wall` (floor and roof, vertical measure) and `side`.

function pushTri(positions, normals, a, b, c, na, nb = na, nc = na) {
  const face = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  const want = na.clone().add(nb).add(nc);
  const list = face.dot(want) < 0 ? [[a, na], [c, nc], [b, nb]] : [[a, na], [b, nb], [c, nc]];
  for (const [p, n] of list) {positions.push(p.x, p.y, p.z);normals.push(n.x, n.y, n.z);}
}

function finish(positions, normals) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

// Shared z samples across the pipe, including every wall face.
export function pipeZSamples(pipe, step = 0.05) {
  const {boreHalf, side} = pipe, outer = boreHalf + side, list = new Set();
  const add = (a, b) => {const n = Math.max(1, Math.ceil((b - a) / step));for (let i = 0; i <= n; i++) list.add(+(a + (b - a) * i / n).toFixed(9));};
  add(-outer, -boreHalf);add(-boreHalf, boreHalf);add(boreHalf, outer);
  return [...list].sort((a, b) => a - b);
}

// Closed pipe from the trunk's outer surface (radius `radius`) up to x = xEnd.
export function inletPipeGeometry(pipe, radius) {
  const {x0, slope, boreLow, boreHigh, boreHalf, wall, side, xEnd} = pipe, outer = boreHalf + side;
  const zs = pipeZSamples(pipe), Ys = [boreLow - wall, boreLow, boreHigh, boreHigh + wall];
  const xIn = (z) => Math.sqrt(radius * radius - z * z);
  const at = (x, Y, z) => new THREE.Vector3(x, Y + slope * (x - x0), z);
  const positions = [], normals = [];
  const up = new THREE.Vector3(-slope, 1, 0).normalize(), axis = new THREE.Vector3(1, slope, 0).normalize();
  const Z = new THREE.Vector3(0, 0, 1);
  // Lateral faces: each runs along the axis from the trunk to the end.
  const lateral = (za, Ya, zb, Yb, normal) => {
    const a0 = at(xIn(za), Ya, za), b0 = at(xIn(zb), Yb, zb), a1 = at(xEnd, Ya, za), b1 = at(xEnd, Yb, zb);
    pushTri(positions, normals, a0, b0, b1, normal);pushTri(positions, normals, a0, b1, a1, normal);
  };
  for (let k = 0; k + 1 < zs.length; k++) {
    const [za, zb] = [zs[k], zs[k + 1]];
    lateral(za, Ys[0], zb, Ys[0], up.clone().negate()); // under the floor
    lateral(za, Ys[3], zb, Ys[3], up); // over the roof
    if (za >= -boreHalf - 1e-9 && zb <= boreHalf + 1e-9) {
      lateral(za, Ys[1], zb, Ys[1], up); // bore floor
      lateral(za, Ys[2], zb, Ys[2], up.clone().negate()); // bore roof
    }
  }
  for (let j = 0; j < 3; j++) {
    lateral(outer, Ys[j], outer, Ys[j + 1], Z);lateral(-outer, Ys[j], -outer, Ys[j + 1], Z.clone().negate());
  }
  lateral(boreHalf, Ys[1], boreHalf, Ys[2], Z.clone().negate());lateral(-boreHalf, Ys[1], -boreHalf, Ys[2], Z);
  // End faces as strips between the z samples: the inner end lies on the
  // trunk's surface (a strip per sample interval, so it follows the curve).
  for (const [xOf, normalOf] of [[xIn, (z) => new THREE.Vector3(-xIn(z), 0, -z).normalize()], [() => xEnd, () => axis]]) {
    for (let k = 0; k + 1 < zs.length; k++) {
      const [za, zb] = [zs[k], zs[k + 1]], inBore = za >= -boreHalf - 1e-9 && zb <= boreHalf + 1e-9;
      const bands = inBore ? [[Ys[0], Ys[1]], [Ys[2], Ys[3]]] : [[Ys[0], Ys[1]], [Ys[1], Ys[2]], [Ys[2], Ys[3]]];
      for (const [Y0, Y1] of bands) {
        const a = at(xOf(za), Y0, za), b = at(xOf(zb), Y0, zb), c = at(xOf(zb), Y1, zb), d = at(xOf(za), Y1, za);
        pushTri(positions, normals, a, b, c, normalOf(za), normalOf(zb), normalOf(zb));
        pushTri(positions, normals, a, c, d, normalOf(za), normalOf(zb), normalOf(za));
      }
    }
  }
  return finish(positions, normals);
}

// Trunk b: a cylindrical shell (radii inner..outer, y from bottom to top)
// pierced by the pipe's bore. Around the pipe the shell is sampled at the
// pipe's own z values (inner and outer points share z), elsewhere by angle.
export function trunkWithInletGeometry(pipe, {inner, outer, bottom, top, segments = 180}) {
  const {x0, slope, boreLow, boreHigh, boreHalf} = pipe;
  const zs = pipeZSamples(pipe), zMax = zs.at(-1);
  // Extend the shared-z band a little past the pipe, then go round by angle.
  const band = [...zs];
  for (let z = zMax + 0.05; z <= 1.6 + 1e-9; z += 0.05) {band.push(+z.toFixed(9));band.unshift(+(-z).toFixed(9));}
  // Angles run from +x toward -z: a point is (r cos a, y, -r sin a).
  band.sort((p, q) => q - p);
  const pairs = band.map((z) => ({z, i: Math.asin(-z / inner), o: Math.asin(-z / outer)}));
  const first = pairs[0], last = pairs.at(-1), steps = Math.ceil(segments * (2 * Math.PI - 2 * last.o) / (2 * Math.PI));
  const around = [];
  for (let s = 1; s < steps; s++) {
    const u = s / steps;
    around.push({i: last.i + (2 * Math.PI + first.i - last.i) * u, o: last.o + (2 * Math.PI + first.o - last.o) * u});
  }
  const ordered = [...pairs, ...around];
  const point = (radius, angle, y) => new THREE.Vector3(radius * Math.cos(angle), y, -radius * Math.sin(angle));
  const hole = (p) => p.z !== undefined && Math.abs(p.z) <= boreHalf + 1e-9;
  const holeY = (x, Y) => Y + slope * (x - x0);
  const positions = [], normals = [];
  const radial = (angle) => new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
  const Y = new THREE.Vector3(0, 1, 0);
  const levels = (p, radius, angle) => {
    if (!hole(p)) return [bottom, top];
    const x = radius * Math.cos(angle);
    return [bottom, holeY(x, boreLow), holeY(x, boreHigh), top];
  };
  for (let k = 0; k < ordered.length; k++) {
    const p = ordered[k], q = ordered[(k + 1) % ordered.length];
    const bothHole = hole(p) && hole(q);
    for (const [radius, key, sign] of [[outer, 'o', 1], [inner, 'i', -1]]) {
      const a = p[key], b = q[key], la = levels(p, radius, a), lb = levels(q, radius, b);
      const na = radial(a).multiplyScalar(sign), nb = radial(b).multiplyScalar(sign);
      if (bothHole) {
        for (const [j0, j1] of [[0, 1], [2, 3]]) {
          const A = point(radius, a, la[j0]), B = point(radius, b, lb[j0]), C = point(radius, b, lb[j1]), D = point(radius, a, la[j1]);
          pushTri(positions, normals, A, B, C, na, nb, nb);pushTri(positions, normals, A, C, D, na, nb, na);
        }
      } else {
        // Fan over the column (a side may carry the hole's corner levels).
        const left = la.map((y) => [point(radius, a, y), na]), right = lb.map((y) => [point(radius, b, y), nb]);
        const ring = [...left, ...right.reverse()];
        for (let t = 1; t + 1 < ring.length; t++) pushTri(positions, normals, ring[0][0], ring[t][0], ring[t + 1][0], ring[0][1], ring[t][1], ring[t + 1][1]);
      }
    }
    // Top and bottom rims.
    for (const [y, n] of [[top, Y], [bottom, Y.clone().negate()]]) {
      const A = point(inner, p.i, y), B = point(outer, p.o, y), C = point(outer, q.o, y), D = point(inner, q.i, y);
      pushTri(positions, normals, A, B, C, n);pushTri(positions, normals, A, C, D, n);
    }
    // The bore through the wall: its floor and roof continue the pipe's.
    if (bothHole) {
      const lipNormal = new THREE.Vector3(-slope, 1, 0).normalize();
      for (const [Yv, n] of [[boreLow, lipNormal], [boreHigh, lipNormal.clone().negate()]]) {
        const A = point(inner, p.i, holeY(inner * Math.cos(p.i), Yv)), B = point(outer, p.o, holeY(outer * Math.cos(p.o), Yv));
        const C = point(outer, q.o, holeY(outer * Math.cos(q.o), Yv)), D = point(inner, q.i, holeY(inner * Math.cos(q.i), Yv));
        pushTri(positions, normals, A, B, C, n);pushTri(positions, normals, A, C, D, n);
      }
    }
  }
  // The bore's side faces (planes z = +-boreHalf through the wall).
  for (const z of [-boreHalf, boreHalf]) {
    const p = pairs.find((c) => Math.abs(c.z - z) < 1e-9);
    const xi = inner * Math.cos(p.i), xo = outer * Math.cos(p.o), n = new THREE.Vector3(0, 0, -Math.sign(z));
    const A = new THREE.Vector3(xi, holeY(xi, boreLow), z), B = new THREE.Vector3(xo, holeY(xo, boreLow), z);
    const C = new THREE.Vector3(xo, holeY(xo, boreHigh), z), D = new THREE.Vector3(xi, holeY(xi, boreHigh), z);
    pushTri(positions, normals, A, B, C, n);pushTri(positions, normals, A, C, D, n);
  }
  return finish(positions, normals);
}
