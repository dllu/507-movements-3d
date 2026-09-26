import { assertReadableTiming } from './helpers/display-timing.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const movement = catalog.movements[250];

function near(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`);
}

function disposeModel(root) {
  root.traverse((object) => {
    object.geometry?.dispose();
    for (const material of [].concat(object.material ?? [])) material.dispose();
  });
}

const cycle = (d, count) => Array.from({ length: count + 1 }, (_, i) => d.stateAtTime(d.timeline.cycleDuration * i / count));

test('movement 251: solid W with a T head, pliers jaws on the rope block', () => {
  const model = createMovementModel(movement);
  const d = model.root.userData;
  const { blocks } = d;
  assert.equal(movement.id, 251);
  assert.equal(d.fidelity, 'authored');
  assert.equal(d.archetype, movement.archetype);
  assert.match(d.mechanism, /pliers-jaws/);
  // Both jaws pivot on the rope block, never on W.
  for (const jaw of blocks.jaws) assert.equal(jaw.parent, blocks.block);
  for (const pin of blocks.pins) assert.equal(pin.parent, blocks.block);
  // W is the body plus its fixed T head and side lugs: no pins, hooks or bearings.
  const weightParts = [];
  blocks.weight.traverse((o) => { if (o.isMesh) weightParts.push(o.userData.role); });
  assert.deepEqual(weightParts.filter((r) => !/lug/.test(r)), ['solid-drop-weight-w', 't-head-fixed-on-weight-w']);
  assert.ok(weightParts.every((r) => !/pin|pivot|hook|bearing|jaw/.test(r)));
  assert.equal(d.transmission.hookCount, 2);
  assert.equal(d.transmission.externalReloadRequired, false);
  assert.equal(d.sourceAnimation.available, false);
  disposeModel(model.root);
});

test('movement 251 keeps Brown\'s measured front elevation at t = 0', () => {
  const model = createMovementModel(movement);
  const d = model.root.userData, g = d.geometry, plate = d.sourceReference.plate251;
  assert.equal(d.sourceReference.officialDescription, movement.description);
  // Plate pixels map to the model at the jaw-pivot midline and height.
  const px = (x) => x - (plate.rasterJawPivots[0].x + plate.rasterJawPivots[1].x) / 2;
  near(g.pivotX, (plate.rasterJawPivots[1].x - plate.rasterJawPivots[0].x) / 2, 0.01, 'pivot half-spacing');
  near(g.tee.barHalf, (plate.rasterTeeBar.right - plate.rasterTeeBar.left) / 2 - 3, 0.01, 'T bar (5 px overhang)');
  near(g.tee.stemHalf, (plate.rasterTeeStem.right - plate.rasterTeeStem.left) / 2, 0.01, 'T stem');
  near(g.tee.bottom, 214 - plate.rasterTeeBar.bottom, 0.01, 'T bar underside height');
  near(g.weight.top, 214 - plate.rasterWeightBounds.top, 0.01, 'W top');
  near(g.weight.bottom, 214 - plate.rasterWeightBounds.bottom, 0.01, 'W bottom');
  near(2 * g.weight.halfWidth, plate.rasterWeightBounds.right - plate.rasterWeightBounds.left, 1.5, 'W width');
  near(g.slot.top, 214 - plate.rasterTopBeam.top, 0.01, 'beam top');
  near(g.slot.bottom, 214 - plate.rasterTopBeam.bottom, 0.01, 'beam bottom');
  near(g.slot.topHalf, plate.rasterSlotB.topHalfWidth, 0.01, 'slot top');
  assert.ok(Math.abs(px(plate.rasterSlotB.centerX)) < 3);
  const s = d.stateAtTime(d.displayTimeOffset);
  near(s.blockHeight, 0, 1e-6, 'rope block in the drawn pose at t = 0');
  near(s.jawOpeningAngle, 0, 0, 'jaws closed in the drawn pose');
  near(s.teeRelative, 0, 1e-9, 'W hangs seated in the jaws');
  assert.ok(s.gripped);
  // The traced horn tops reach Brown's y 67 within the stated uncertainty.
  const hornTop = Math.max(...g.jawOutline.map((p) => p[1]));
  near(214 - hornTop, plate.rasterHornTop, 3, 'horn top');
  disposeModel(model.root);
});

test('movement 251 jaws grip the T without penetration and seat on their stops', () => {
  const d = createMovementModel(movement).root.userData, g = d.geometry, p = d.planar;
  // Seated: touching (not overlapping) the undercut at zero opening.
  near(p.support(0), 0, 1e-6, 'gripped T seat');
  assert.equal(p.footOverlaps(1e-6, 0), false);
  assert.equal(p.footOverlaps(-0.05, 0), true);
  // The barb reaction passes outboard of the pivot: the load closes the jaws
  // (clockwise, i.e. negative, for the right jaw whose opening is positive).
  const xc = (g.tee.stemHalf + 1 + g.tee.barHalf) / 2;
  const r = [xc - g.pivotX, g.tee.bottom + (g.tee.barHalf - xc) * Math.tan(g.loadAngle)];
  const force = [-Math.sin(g.loadAngle), -Math.cos(g.loadAngle)];
  const moment = r[0] * force[1] - r[1] * force[0];
  assert.ok(moment < -2, `load moment on the right jaw: ${moment}`);
  // Closed stop: the claw shank sits 0.1 px from the stop lug.
  const shank = Math.min(...g.jawOutline.filter(([x, y]) => y <= -13 && y >= -37 && x > -15).map(([x]) => x)) + g.pivotX;
  near(shank - g.stopHalfWidth, 0.1, 1e-6, 'stop seat');
  // Throughout the cycle no configuration overlaps the T or slot B.
  for (const s of cycle(d, 2000)) {
    assert.equal(p.footOverlaps(s.teeRelative, s.jawOpeningAngle), false, `foot/T at ${s.localTime}`);
    assert.equal(p.hornOverlaps(s.blockHeight, s.jawOpeningAngle), false, `horn/slot at ${s.localTime}`);
    assert.ok(s.jawOpeningAngle >= 0 && s.jawOpeningAngle <= g.openAngle + 1e-9);
    // T top stays below the rope block's underside.
    assert.ok(s.teeRelative + g.tee.top < g.blockBottom - 3, `T top at ${s.localTime}`);
  }
  // The gravity swing shut at the bottom sweeps only clear angles.
  for (let i = 0; i <= 200; i += 1) assert.equal(p.footOverlaps(g.catchHeight - g.lowHeight, g.snapAngle * i / 200), false);
});

test('movement 251 slot B opens the jaws, releases W, and W falls ballistically', () => {
  const d = createMovementModel(movement).root.userData, g = d.geometry, tl = d.timeline, p = d.planar;
  // Below slot B the jaws stay shut; the lips must act before release.
  assert.equal(p.slotAngle(g.engageHeight - 0.05), 0);
  assert.ok(g.engageHeight > 20 && g.engageHeight < g.topHeight);
  // Opening is monotone with rope-block height.
  let last = 0;
  for (let h = g.engageHeight; h <= g.topHeight; h += 0.05) { const a = p.slotAngle(h); assert.ok(a >= last - 1e-9); last = a; }
  // The horns stay inside the beam and clear of the rope and each other.
  const top = p.jawAt(g.openAngle).map(([x, y]) => [x, y + g.topHeight]);
  assert.ok(Math.max(...top.map(([, y]) => y)) < g.slot.top);
  assert.ok(Math.min(...top.filter(([, y]) => y > 110 + g.topHeight - 20).map(([x]) => x)) > 4 + 2, 'horn clear of rope');
  // Release exactly where the foot tips pass the T bar ends.
  const before = d.stateAtTime(tl.releaseTime - 1e-3), after = d.stateAtTime(tl.releaseTime + 1e-3);
  assert.ok(before.gripped && !after.gripped);
  near(p.footInnerX(g.freeAngle), g.tee.barHalf, 1e-6, 'free angle');
  near(before.weightY, after.weightY, 0.05, 'continuous at release');
  // Ballistic: constant downward acceleration until the inelastic impact.
  for (let i = 1; i < 40; i += 1) {
    const t = tl.releaseTime + (tl.impactTime - tl.releaseTime) * i / 40, e = 1e-4;
    const acc = (d.stateAtTime(t + e).weightY - 2 * d.stateAtTime(t).weightY + d.stateAtTime(t - e).weightY) / e ** 2;
    near(acc, -g.gravity, 0.5, `free fall at ${t}`);
  }
  near(d.stateAtTime(tl.impactTime + 1e-6).pileHeadGap, 0, 1e-6, 'impact seat');
  assert.ok(tl.impactTime < tl.descentStart, 'W lands before the block descends');
  assert.ok(d.stateAtTime(tl.impactTime - 1e-3).weightVelocity < -50);
});

test('movement 251 descending jaws cam over the T head and fall shut under it', () => {
  const d = createMovementModel(movement).root.userData, g = d.geometry, tl = d.timeline;
  const descent = Array.from({ length: 721 }, (_, i) => d.stateAtTime(tl.descentStart + (tl.descentEnd - tl.descentStart) * i / 720));
  // The jaws first close fully after leaving slot B, then cam open on the T.
  const closedGap = descent.findIndex((s) => s.jawOpeningAngle === 0);
  const camStart = descent.findIndex((s, i) => i > closedGap && s.jawOpeningAngle > 0);
  assert.ok(closedGap > 0 && camStart > closedGap);
  assert.ok(Math.max(...descent.slice(camStart).map((s) => s.jawOpeningAngle)) >= g.freeAngle - 0.005);
  assert.ok(g.snapRelative !== null && g.snapRelative < g.catchHeight - g.lowHeight);
  const low = d.stateAtTime(tl.swingEnd + 0.01);
  assert.equal(low.jawOpeningAngle, 0);
  assert.ok(low.teeRelative > 0);
  const grip = d.stateAtTime(tl.cycleDuration - 1e-9);
  near(grip.teeRelative, 0, 1e-6, 'take-up reseats the T on the barbs');
});

test('movement 251 closes seamlessly in ten seconds with readable timing', () => {
  const model = createMovementModel(movement);
  const d = model.root.userData;
  const a = d.stateAtTime(0), b = d.stateAtTime(10);
  for (const key of ['blockHeight', 'jawOpeningAngle', 'weightY']) near(a[key], b[key], 1e-9, key);
  let previous = d.stateAtTime(0);
  for (const s of cycle(d, 4000).slice(1)) {
    near(s.blockHeight, previous.blockHeight, 0.2, `block jump at ${s.localTime}`);
    near(s.jawOpeningAngle, previous.jawOpeningAngle, 0.012, `jaw jump at ${s.localTime}`);
    near(s.weightY, previous.weightY, 0.8, `W jump at ${s.localTime}`);
    previous = s;
  }
  near(d.animationTiming.authoredCyclePeriod, 10, 0, 'authored period');
  assertReadableTiming(d.animationTiming);
  // Renderer bindings follow the state.
  model.update(1.3);
  const s = d.kinematics;
  near(d.blocks.block.position.y, s.blockHeight * d.geometry.pixelScale, 1e-12, 'block');
  near(d.blocks.jaws[1].rotation.z, s.jawOpeningAngle, 0, 'right jaw');
  near(d.blocks.jaws[0].rotation.z, -s.jawOpeningAngle, 0, 'left jaw');
  near(d.blocks.weight.position.y, s.weightY * d.geometry.pixelScale, 1e-12, 'W');
  const box = new THREE.Box3().setFromObject(d.blocks.rope);
  assert.ok(box.max.y > box.min.y);
  disposeModel(model.root);
});
