import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { clipConvex, isClosed, sideMask, screenModel } from '../scripts/screen-coincident-faces.mjs';

const options = { phases: 1 };
const model = (build) => {
  const root = new THREE.Group();
  build((role, geometry, material, position = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.role = role;
    mesh.position.set(...position);
    root.add(mesh);
    return mesh;
  });
  return { root, update() {} };
};
const grey = () => new THREE.MeshStandardMaterial({ color: 0x888888 });
const black = () => new THREE.MeshStandardMaterial({ color: 0x111111 });
const water = (side = THREE.DoubleSide) => new THREE.MeshStandardMaterial({ color: 0x3388cc, transparent: true, opacity: 0.4, side });
const parts = (result) => result.pairs.map((row) => row.parts.join(' | '));

test('clipConvex measures triangle overlap', () => {
  const a = [[0, 0], [2, 0], [0, 2]];
  assert.equal(clipConvex(a, a).area, 2);
  assert.ok(Math.abs(clipConvex([[0, 0], [1, 0], [0, 1]], a).area - 0.5) < 1e-12);
  // Neighbours sharing an edge overlap by nothing.
  assert.ok(clipConvex([[2, 0], [2, 2], [0, 2]], a).area < 1e-12);
});

test('side masks follow the material side and mirrored matrices', () => {
  assert.equal(sideMask(0, false), 1);
  assert.equal(sideMask(1, false), 2);
  assert.equal(sideMask(2, false), 3);
  assert.equal(sideMask(0, true), 2);
  assert.ok(isClosed(new THREE.BoxGeometry(1, 1, 1)));
  assert.ok(!isClosed(new THREE.PlaneGeometry(1, 1)));
});

test('a pin end flush with a link face is flagged; a pin standing proud is not', () => {
  const flush = screenModel(model((add) => {
    add('link-plate', new THREE.BoxGeometry(2, 1, 0.2), grey());
    add('pin', new THREE.CylinderGeometry(0.2, 0.2, 1, 24).rotateX(Math.PI / 2), black(), [0, 0, -0.4]);
  }), 1, options);
  assert.deepEqual(parts(flush), ['link-plate | pin']);
  assert.equal(flush.pairs[0].facing.same > 0, true);
  const proud = screenModel(model((add) => {
    add('link-plate', new THREE.BoxGeometry(2, 1, 0.2), grey());
    add('pin', new THREE.CylinderGeometry(0.2, 0.2, 1, 24).rotateX(Math.PI / 2), black(), [0, 0, -0.35]);
  }), 1, options);
  assert.equal(proud.flaggedPairs, 0);
});

test('blocks glued face to face are hidden, not flagged', () => {
  const result = screenModel(model((add) => {
    add('lower-block', new THREE.BoxGeometry(2, 1, 1), grey(), [0, 0, 0]);
    add('upper-block', new THREE.BoxGeometry(1, 1, 1), black(), [0, 1, 0]);
  }), 1, options);
  assert.equal(result.flaggedPairs, 0);
  assert.ok(result.excludedRelative.hiddenArea > 0 || result.excludedRelative.noSharedSideArea > 0);
});

test('a double-sided transparent water face on a vessel wall is flagged; a front-sided one is not', () => {
  const vessel = (side) => screenModel(model((add) => {
    add('vessel-wall', new THREE.BoxGeometry(0.2, 2, 2), grey(), [-1.1, 0, 0]);
    add('water-body', new THREE.BoxGeometry(2, 1.5, 2), water(side), [0, -0.25, 0]);
  }), 1, options);
  const both = vessel(THREE.DoubleSide);
  assert.deepEqual(parts(both), ['vessel-wall | water-body']);
  assert.deepEqual(both.pairs[0].transparent, [false, true]);
  assert.equal(vessel(THREE.FrontSide).flaggedPairs, 0);
});

test('duplicated faces within one mesh are flagged when their shading differs, and identical ones are reported as same-look', () => {
  // One quad twice: first with a tilted shading normal.
  const quad = [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0];
  const geometry = (tilt) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...quad, ...quad], 3));
    const n = [];
    for (let i = 0; i < 6; i += 1) n.push(0, 0, 1);
    for (let i = 0; i < 6; i += 1) n.push(tilt, 0, 1);
    g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    return g;
  };
  const differing = screenModel(model((add) => add('pipe-end-cap', geometry(0.5), grey())), 1, options);
  assert.deepEqual(differing.pairs.map((row) => [row.parts, row.sameMesh]), [[['pipe-end-cap'], true]]);
  const identical = screenModel(model((add) => add('pipe-end-cap', geometry(0), grey())), 1, options);
  assert.equal(identical.flaggedPairs, 0);
  assert.ok(identical.excludedRelative.sameLookArea > 0);
});

test('invisible meshes and polygon-offset decals are skipped', () => {
  const hiddenMesh = screenModel(model((add) => {
    add('link-plate', new THREE.BoxGeometry(2, 1, 0.2), grey());
    add('pin', new THREE.CylinderGeometry(0.2, 0.2, 1, 24).rotateX(Math.PI / 2), black(), [0, 0, -0.4]).visible = false;
  }), 1, options);
  assert.equal(hiddenMesh.flaggedPairs, 0);
  const decal = black();
  Object.assign(decal, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const offset = screenModel(model((add) => {
    add('link-plate', new THREE.BoxGeometry(2, 1, 0.2), grey());
    add('pin', new THREE.CylinderGeometry(0.2, 0.2, 1, 24).rotateX(Math.PI / 2), decal, [0, 0, -0.4]);
  }), 1, options);
  assert.equal(offset.flaggedPairs, 0);
});

test('transparent volumes that both skip the depth write do not fight; their shared faces are reported as seams', () => {
  const steam = (color) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.4, depthWrite: false });
  const result = screenModel(model((add) => {
    add('steam-left', new THREE.BoxGeometry(1, 1, 1), steam(0xeeeeee), [-0.5, 0, 0]);
    add('steam-right', new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0), steam(0xcccccc), [0.5, 0, 0]);
    add('steam-overlap', new THREE.BoxGeometry(1, 1, 0.5), steam(0xaaaaaa), [-0.5, 0, 0.25]);
  }), 1, options);
  assert.equal(result.flaggedPairs, 0);
  // Front-sided neighbours each draw the shared face only from inside the
  // other, so just the overlapping volume leaves a doubled sheet.
  assert.deepEqual(result.seams.map((row) => row.parts.join(' | ')), ['steam-left | steam-overlap']);
});
