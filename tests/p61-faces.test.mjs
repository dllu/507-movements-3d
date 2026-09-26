import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const build = (id) => createMovementModel(catalog.movements[id - 1]);
const byRole = (root, pattern) => {
  const found = [];
  root.traverse((object) => { if (pattern.test(object.userData.role ?? '')) found.push(object); });
  return found;
};
const geometryRadii = (g) => { const p = g.attributes.position; let max = 0; for (let i = 0; i < p.count; i += 1) max = Math.max(max, Math.hypot(p.getX(i), p.getY(i))); return { max }; };
const visible = (object) => { for (let o = object; o; o = o.parent) if (!o.visible) return false; return true; };

test('360 beam is one flat plate whose spokes land inside the rims, cords on the rim ends', () => {
  const { root } = build(360);
  const d = root.userData, beam = d.blocks.rockingBeam;
  const plates = byRole(beam, /^rocking-beam-double-sector-plate$/);
  assert.equal(plates.length, 1);
  assert.equal(byRole(root, /cord-sector-on-rocking-beam|rigid-rocking-beam-sector-spoke/).length, 0,
    'no separate tube rims or spoke bars');
  const plate = plates[0], half = plate.userData.sectorHalfSpan;
  // Every plate vertex beyond the hub lies within the rims' angular span, so
  // no spoke passes outside a rim end.
  const p = plate.geometry.attributes.position;
  for (let i = 0; i < p.count; i += 1) {
    const x = p.getX(i), y = p.getY(i), r = Math.hypot(x, y);
    if (r < 0.3) continue;
    const a = Math.abs(Math.atan2(y, Math.abs(x)));
    assert.ok(a <= half + 1e-6, `plate point at ${a.toFixed(3)} rad outside the ${half} rim span`);
  }
  // The drive cord needs the right rim from the vertical tangent to its end.
  assert.ok(d.geometry.sectorBaseWrap <= half);
  assert.ok(d.geometry.beamAmplitude <= half);
});

test('334 sector C is one plate with its teeth standing on the rim, and rack B has no stray knob', () => {
  const { root } = build(334);
  const b = root.userData.blocks;
  const web = b.sectorWeb;
  assert.ok(visible(web));
  assert.ok(b.sectorTeeth.every((tooth) => !tooth.visible), 'tooth profiles are analytic references only');
  // The single plate is connected: its outline union has one outer ring.
  const polygons = web.geometry.userData.plate.polygons;
  assert.equal(polygons.length, 1, 'rim and teeth form one piece');
  // Seventeen tooth tips stand proud of the rim's root circle.
  const r = geometryRadii(web.geometry);
  assert.ok(r.max > root.userData.geometry.sectorRootRadius + 0.05);
  assert.equal(byRole(root, /rounded-upper-end-of-rack-B/).length, 0);
  assert.equal(b.topCap, undefined);
});

test('347 radial diaphragm lies behind the section, leaving the cut chamber open', () => {
  const { root, update } = build(347);
  update(0); root.updateMatrixWorld(true);
  const d = root.userData, partition = d.blocks.fixedPartition;
  const box = new THREE.Box3().setFromObject(partition);
  const center = d.geometry.ballCenter ?? new THREE.Vector3(0, 2.85, 0);
  assert.ok(box.max.z <= 1e-9, 'diaphragm stays in the rear half');
  assert.ok(box.max.y - box.min.y < 0.11, 'diaphragm is edgewise to the section view');
  assert.ok(Math.abs((box.max.y + box.min.y) / 2 - center.y) < 1e-6);
  for (const lip of d.blocks.slotLips) assert.equal(lip.visible, false);
  for (let i = 0; i <= 16; i += 1) {
    const s = d.stateAtTime(4 * i / 16);
    assert.ok(Math.abs(s.disk.slotDirection.y) < 1e-12 && s.disk.slotDirection.z < 0);
  }
});

// The production face scan (scripts/scan-bad-faces.mjs) stays clean for the
// faces this pass corrected: 347's section cover, 198's inside-out sleeve,
// 331's embedded guide strips and 360's duplicated full-diameter spokes.
const { execFileSync } = await import('node:child_process');
const scan = (id) => JSON.parse(execFileSync(process.execPath,
  [new URL('../scripts/scan-bad-faces.mjs', import.meta.url).pathname, `--worker=${id}`],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim().split('\n').at(-1));

test('face scan: corrected meshes have no section cover, inward solid or flush duplicate', () => {
  assert.equal(scan(347).counts.sectionCover, 0);
  assert.equal(scan(347).counts.zfight, 0);
  assert.equal(scan(198).findings.inward.length, 0);
  assert.ok(!scan(331).findings.zfight.some((row) => /planed-inner-face/.test(row.a + row.b)));
  // Only the spokes' crossing at the hub may overlap, not whole duplicated bars.
  assert.ok(!scan(360).findings.zfightSameLook.some((row) => row.a === 'flywheel-spoke-fast-on-shaft' && row.b === row.a && row.area > 0.01));
});
