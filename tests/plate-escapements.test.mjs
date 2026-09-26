import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { createMovementModel } from '../src/simulation/registry.js';
import { polygonClipping } from '../src/simulation/finite-plate-geometry.js';
import { placeFlat, toFlat } from '../src/simulation/plate-escapement-kit.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/movements.json', import.meta.url), 'utf8'));

// Movements 288-296 are flat extruded parts traced from Brown's plates; the
// escape wheel is solved from contact with those very outlines.
const ids = [288, 289, 290, 291, 292, 293, 294, 295, 296];
const models = new Map(ids.map((id) => [id, createMovementModel(catalog.movements[id - 1])]));

const ring = (flat) => {
  const points = [];
  for (let i = 0; i < flat.length; i += 2) points.push([flat[i], flat[i + 1]]);
  points.push(points[0]);
  return points;
};
const area = (multi) => multi.reduce((sum, polygon) => sum + polygon.reduce((acc, r, k) => {
  let a = 0;
  for (let i = 0; i + 1 < r.length; i += 1) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return acc + (k === 0 ? 1 : -1) * Math.abs(a / 2);
}, 0), 0);

test('288-296 each advance exactly one tooth (or stud pair) per oscillation with no jam', () => {
  for (const [id, model] of models) {
    const s = model.root.userData.solution;
    assert.equal(model.root.userData.fidelity, 'authored', `${id}`);
    assert.equal(s.failed, false, `${id} failed`);
    assert.equal(s.unresolved, 0, `${id} unresolved contacts`);
    assert.ok(Math.abs(s.advance - s.expected) < s.pitch * 1e-3, `${id} advance ${s.advance / s.pitch} pitch`);
    // No teleporting: each solver step moves the wheel less than a tenth of a pitch.
    for (let i = 1; i <= s.stepsPerPeriod; i += 1) {
      assert.ok(Math.abs(s.angles[i] - s.angles[i - 1]) < s.pitch / 10, `${id} step ${i}`);
    }
    // Some locking/resting and some motion in every cycle.
    assert.ok(s.states.some((state) => state === 3 || state === 1), `${id} has contact`);
  }
});

test('288-296 wheel outlines never overlap the escapement outlines they work against', () => {
  for (const [id, model] of models) {
    const d = model.root.userData;
    const { pivot, wheelCenter, wheelCells, pieces, pieceLayers } = d.contactOutlines;
    const k = d.kinematics;
    let worst = 0;
    for (let i = 0; i < 97; i += 1) {
      const t = k.period * i / 96;
      const wheelPose = { x: wheelCenter[0], y: wheelCenter[1], angle: k.wheelAngle(t) };
      const rockerPose = { x: pivot[0], y: pivot[1], angle: k.rockerAngle(t) };
      pieces.forEach((piece, n) => {
        const obstacle = ring(placeFlat(piece, rockerPose));
        for (const cell of wheelCells) {
          if ((cell.layer ?? 0) !== pieceLayers[n]) continue;
          const placed = ring(placeFlat(toFlat(cell.points), wheelPose));
          worst = Math.max(worst, area(polygonClipping.intersection([placed], [obstacle])));
        }
      });
    }
    // The table is linearly interpolated between solver steps; allow a
    // sliver of area far below any visible overlap.
    assert.ok(worst < 5e-5, `${id} overlap area ${worst}`);
  }
});

test('flat escapements keep wheel and anchor/frame/lever in one drawn plane without hidden pieces', () => {
  for (const id of [288, 289, 290, 296]) {
    const d = models.get(id).root.userData;
    const zRange = (object) => new THREE.Box3().setFromObject(object);
    const rockerMeshes = d.blocks.rocker.children.filter((child) => child.isMesh);
    assert.equal(rockerMeshes.length, 1, `${id}: the escapement part is one extrusion`);
    const wheelMeshes = d.blocks.wheelRotor.children.filter((child) => child.isMesh);
    assert.equal(wheelMeshes.length, 1, `${id}: the wheel is one extrusion`);
    const a = zRange(rockerMeshes[0]);
    const b = zRange(wheelMeshes[0]);
    assert.ok(Math.abs(a.min.z - b.min.z) < 1e-9 && Math.abs(a.max.z - b.max.z) < 1e-9, `${id}: same plane`);
  }
});

test('wheel directions follow the plates: 288 and 289 counterclockwise; 290, 291, 292, 293, 295 and 296 clockwise', () => {
  const expectation = { 288: 1, 289: 1, 290: -1, 291: -1, 292: -1, 293: -1, 294: -1, 295: -1, 296: -1 };
  for (const [id, model] of models) {
    const k = model.root.userData.kinematics;
    const change = k.wheelAngle(k.period * 4) - k.wheelAngle(0);
    assert.equal(Math.sign(change), expectation[id], `${id} direction`);
  }
});

test('288 teeth have radial leading faces on the counterclockwise side (tips lead)', () => {
  const cells = models.get(288).root.userData.contactOutlines.wheelCells;
  assert.equal(cells.length, 33, "Brown's 33 teeth");
  const [root, tip, , back] = cells[0].points.map(([x, y]) => ({ a: Math.atan2(y, x), r: Math.hypot(x, y) }));
  assert.ok(Math.abs(root.a - tip.a) < 1e-9, 'leading face radial');
  assert.ok(tip.r > root.r && back.r < tip.r, 'tooth rises from root to tip');
  const behind = Math.atan2(Math.sin(back.a - tip.a), Math.cos(back.a - tip.a));
  assert.ok(behind < 0, 'the sloped back trails clockwise of the tip');
});

test('290 pallets are two equal plain rectangles, symmetric about the frame', () => {
  const pieces = models.get(290).root.userData.contactOutlines.pieces.map((flat) => ring(flat).slice(0, -1));
  assert.equal(pieces.length, 2);
  for (const piece of pieces) assert.equal(piece.length, 4);
  const size = (p) => [Math.abs(p[1][0] - p[0][0]), Math.abs(p[2][1] - p[1][1])];
  const [a, b] = pieces.map(size);
  assert.ok(Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9);
});

test('294 and 295 are one model seen two ways', () => {
  const roles = (id) => {
    const list = [];
    models.get(id).root.traverse((object) => { if (object.isMesh) list.push(object.userData.role); });
    return list.sort();
  };
  // Presentation removes the wheel for 294 and the near end of the cylinder
  // for 295; the model beneath is the same.
  const fresh = (id) => {
    const model = createMovementModel({ ...catalog.movements[id - 1], id: 295 });
    const list = [];
    model.root.traverse((object) => { if (object.isMesh) list.push(object.userData.role); });
    return list.sort();
  };
  assert.deepEqual(fresh(294), fresh(295));
  assert.ok(roles(294).includes('cylinder-passage-C-with-lips-A-B'));
  assert.ok(roles(295).includes('cylinder-passage-C-with-lips-A-B'));
  assert.ok(!roles(294).includes('cylinder-escape-wheel'), '294 shows the cylinder alone');
  assert.ok(!roles(295).includes('cylinder-upper-end-dome'), '295 is cut at the wheel');
});

test('cylinder turned parts are shaded smoothly round the axis', () => {
  const model = createMovementModel(catalog.movements[293]);
  model.root.traverse((object) => {
    if (!object.isMesh || !/^cylinder-(upper-end-tube|tube-below-passage)$/.test(object.userData.role)) return;
    const p = object.geometry.attributes.position;
    const n = object.geometry.attributes.normal;
    for (let i = 0; i < p.count; i += 1) {
      const r = Math.hypot(p.getX(i), p.getY(i));
      if (r < 0.5 || Math.abs(n.getZ(i)) > 0.5) continue;
      // Side-wall normals are exactly radial (no facets).
      const radial = (n.getX(i) * p.getX(i) + n.getY(i) * p.getY(i)) / r;
      assert.ok(Math.abs(Math.abs(radial) - 1) < 1e-4);
    }
  });
});

test('whole anchor, frame and lever outlines (not only their working ends) clear the whole wheel', () => {
  for (const id of [288, 289, 290, 296]) {
    const d = models.get(id).root.userData;
    const { rocker, wheelRotor } = d.blocks;
    const rockerOutline = rocker.children.find((child) => child.isMesh).geometry.userData.outline;
    const wheelOutline = wheelRotor.children.find((child) => child.isMesh).geometry.userData.outline;
    const k = d.kinematics;
    const place = (points, x, y, angle) => {
      const out = points.map(([px, py]) => [x + px * Math.cos(angle) - py * Math.sin(angle), y + px * Math.sin(angle) + py * Math.cos(angle)]);
      out.push(out[0]);
      return out;
    };
    let worst = 0;
    for (let i = 0; i < 49; i += 1) {
      const t = k.period * i / 48;
      const r = [place(rockerOutline.outer, rocker.position.x, rocker.position.y, k.rockerAngle(t)),
        ...rockerOutline.holes.map((hole) => place(hole, rocker.position.x, rocker.position.y, k.rockerAngle(t)))];
      const w = [place(wheelOutline.outer, wheelRotor.position.x, wheelRotor.position.y, k.wheelAngle(t)),
        ...wheelOutline.holes.map((hole) => place(hole, wheelRotor.position.x, wheelRotor.position.y, k.wheelAngle(t)))];
      worst = Math.max(worst, area(polygonClipping.intersection([r], [w])));
    }
    assert.ok(worst < 2e-5, `${id} whole-outline overlap ${worst}`);
  }
});

test('every extruded plate has caps covering exactly its outline (no earcut mis-bridges)', () => {
  const signed = (r) => { let a = 0; for (let i = 0; i < r.length; i += 1) { const [x0, y0] = r[i]; const [x1, y1] = r[(i + 1) % r.length]; a += x0 * y1 - x1 * y0; } return a / 2; };
  for (const [id, model] of models) {
    model.root.traverse((object) => {
      const outline = object.geometry?.userData?.outline;
      if (!object.isMesh || !outline) return;
      const p = object.geometry.attributes.position;
      let cap = 0;
      for (let i = 0; i < p.count; i += 3) {
        if ([0, 1, 2].some((j) => Math.abs(p.getZ(i + j) - outline.z1) > 1e-5)) continue;
        cap += ((p.getX(i + 1) - p.getX(i)) * (p.getY(i + 2) - p.getY(i)) - (p.getX(i + 2) - p.getX(i)) * (p.getY(i + 1) - p.getY(i))) / 2;
      }
      const expected = Math.abs(signed(outline.outer)) - outline.holes.reduce((sum, hole) => sum + Math.abs(signed(hole)), 0);
      assert.ok(Math.abs(cap - expected) <= 1e-4 * Math.max(1, expected), `${id} ${object.userData.role} cap ${cap} vs ${expected}`);
    });
  }
});

test("292 studs are Brown's clear triangles on the rim's middle line, front ones outward and back ones inward", () => {
  const cells = models.get(292).root.userData.contactOutlines.wheelCells;
  const px = (v) => v / 0.02;
  for (const cell of cells) {
    assert.equal(cell.points.length, 3, 'a triangle');
    const radii = cell.points.map(([x, y]) => px(Math.hypot(x, y)));
    const base = radii.filter((r) => Math.abs(r - 230) < 1e-6).length;
    assert.equal(base, 2, 'base on the middle line');
    const apex = radii.find((r) => Math.abs(r - 230) >= 1e-6);
    // Front studs (layer 1) point outward over the outer half, back ones inward.
    assert.ok(cell.layer === 1 ? apex > 238 : apex < 222, `apex ${apex}`);
    const [a, b] = cell.points.filter((_, i) => Math.abs(radii[i] - 230) < 1e-6);
    assert.ok(px(Math.hypot(a[0] - b[0], a[1] - b[1])) >= 8, 'a clear triangle, not a nick');
  }
});

test('292 pallet c is a wedge whose sharp tip ends the front arm', () => {
  const d = models.get(292).root.userData.contactOutlines;
  const c = ring(d.pieces[d.pieceLayers.indexOf(1)]).slice(0, -1);
  let sharpest = Math.PI;
  for (let i = 0; i < c.length; i += 1) {
    const p = c[(i + c.length - 1) % c.length]; const q = c[i]; const r = c[(i + 1) % c.length];
    const u = [p[0] - q[0], p[1] - q[1]]; const v = [r[0] - q[0], r[1] - q[1]];
    const lu = Math.hypot(...u); const lv = Math.hypot(...v);
    if (lu < 1e-9 || lv < 1e-9) continue;
    sharpest = Math.min(sharpest, Math.acos((u[0] * v[0] + u[1] * v[1]) / (lu * lv)));
  }
  assert.ok(sharpest < 65 * Math.PI / 180, `tip angle ${sharpest * 180 / Math.PI}`);
});

test('293 wheel advance is spread over the impulse swing, not a snap', () => {
  const k = models.get(293).root.userData.kinematics;
  const n = 800;
  const steps = [];
  for (let i = 1; i <= n; i += 1) steps.push(Math.abs(k.wheelAngle(k.period * i / n) - k.wheelAngle(k.period * (i - 1) / n)));
  const total = steps.reduce((a, b) => a + b, 0);
  steps.sort((a, b) => b - a);
  let sum = 0; let count = 0;
  while (sum < 0.8 * total) sum += steps[count++];
  // Before pass 62, 80 % of the tooth's advance happened in 3.4 % of the cycle.
  assert.ok(count / n > 0.1, `80% of the advance in ${(100 * count / n).toFixed(1)}% of the cycle`);
});

test("295's wheel is a narrow rim below the valleys over a plain recessed web, blank below Brown's arc", () => {
  let wheel; let web;
  models.get(295).root.traverse((object) => {
    if (object.userData.role === 'cylinder-escape-wheel') wheel = object;
    if (object.userData.role === 'cylinder-wheel-plain-recessed-web') web = object;
  });
  const { holes, z1 } = wheel.geometry.userData.outline;
  // One round rim opening (no arms), its edge at Brown's arc.
  assert.equal(holes.length, 1);
  const radii = holes[0].map(([x, y]) => Math.hypot(x, y) / 0.02);
  assert.ok(Math.min(...radii) > 320 && Math.max(...radii) < 335, `rim edge ${Math.min(...radii)}-${Math.max(...radii)} px`);
  // The web fills the rim opening, set back behind the rim's face.
  assert.ok(web, 'plain web');
  web.geometry.computeBoundingBox();
  const box = web.geometry.boundingBox;
  assert.ok(box.max.z < z1 - 0.05, 'web recessed behind the rim');
  assert.ok(Math.hypot(box.max.x, 0) / 0.02 > 320);
});

test("293's wheel is a thick ring with the crown pins on its front face, and pallet B is see-through over the roller's notch", () => {
  const root = models.get(293).root;
  root.updateMatrixWorld(true);
  const find = (role) => { const found = []; root.traverse((o) => { if (o.isMesh && o.userData.role === role) found.push(o); }); return found; };
  const box = (o) => new THREE.Box3().setFromObject(o);
  const wheel = box(find('duplex-escape-wheel')[0]);
  assert.ok(wheel.max.z - wheel.min.z >= 0.35, `wheel thickness ${wheel.max.z - wheel.min.z}`);
  for (const pin of find('crown-pin-a')) {
    const b = box(pin);
    assert.ok(b.min.z < wheel.max.z && b.max.z > wheel.max.z + 0.1, 'crown pins stand on the front face');
  }
  const [pallet] = find('impulse-pallet-B');
  assert.ok(pallet.userData.seeThrough, 'pallet B shows the roller notch behind it');
  assert.ok(box(pallet).min.z > wheel.max.z, 'pallet B works in front of the wheel');
  const roller = box(find('notched-roller-A')[0]);
  assert.ok(roller.min.z > wheel.min.z && roller.max.z < wheel.max.z, 'roller A works in the teeth layer');
});

test("296's three curved crossings meet in Brown's broad web about the arbor", () => {
  const root = models.get(296).root;
  const wheel = root.userData.contactOutlines.wheelCenter;
  let mesh;
  root.traverse((o) => { if (o.isMesh && o.userData.role === 'club-tooth-escape-wheel-A') mesh = o; });
  const position = mesh.geometry.attributes.position;
  // Every window vertex stays outside Brown's 33 px web (0.66 at 0.02/px),
  // apart from the arbor bore.
  let nearest = Infinity;
  for (let i = 0; i < position.count; i += 1) {
    const r = Math.hypot(position.getX(i), position.getY(i));
    if (r > 0.2) nearest = Math.min(nearest, r);
  }
  assert.ok(nearest > 0.6 && nearest < 0.72, `window inner reach ${nearest}`);
  assert.deepEqual(wheel, [0, 0]);
});
