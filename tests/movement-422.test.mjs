import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createAuthoredSectorPistonEngineMovement } from '../src/simulation/authored-sector-piston-engines.js';
import { pointInMulti } from '../src/simulation/steam-section-kit.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const movement = catalog.movements.find((m) => m.id === 422);
const DEG = Math.PI / 180;

test('422: one sector chamber, split only by vane B, fed round the tongue ends by two passages from D', () => {
  const model = createAuthoredSectorPistonEngineMovement(movement);
  try {
    const { geometry: g, blocks: b } = model.root.userData;
    // One connected working cavity: chamber, both passages and risers; the
    // tongue is the only thing between chamber and passages and it stops
    // short of both side walls, so each passage opens into its corner.
    assert.equal(g.workingCavity.length, 1, 'chamber and passages form one cavity');
    for (const side of [-1, 1]) {
      const angle = Math.PI / 2 - side * (g.tongueHalfSpan + 3 * DEG);
      assert.ok(pointInMulti([5.15 * Math.cos(angle), 5.15 * Math.sin(angle)], g.workingCavity), `open corner ${side}`);
      assert.ok(!pointInMulti([5.15 * Math.cos(Math.PI / 2 - side * 10 * DEG), 5.15 * Math.sin(Math.PI / 2 - side * 10 * DEG)], g.workingCavity), 'tongue is solid');
    }
    // exhaust port is its own cavity under D, not joined to the chamber
    assert.ok(!pointInMulti([0, 5.7], g.workingCavity));
    assert.ok(pointInMulti([0, 5.7], g.exhaustChannel));
    // no undrawn parts: no foundation, crank or markers
    const roles = [];
    model.root.traverse((o) => { if (o.userData.role) roles.push(o.userData.role); });
    for (const banned of [/foundation/, /crank/, /indicator/, /index/]) assert.ok(!roles.some((r) => banned.test(r)), String(banned));
    assert.ok(b.pistonB && b.valveD && b.casingA);
  } finally { disposeObject3D(model.root); }
});

test('422: B keeps its tip under the tongue, and D admits steam behind B and exhausts ahead of it', () => {
  const model = createAuthoredSectorPistonEngineMovement(movement);
  try {
    const u = model.root.userData;
    const g = u.geometry;
    let previous = null;
    for (let i = 0; i <= 128; i += 1) {
      const t = i / 128 * g.cycleDuration;
      model.update(t);
      const s = u.stateAtTime(t);
      const tipHalf = Math.asin(g.vaneHalfWidth / g.vaneTipRadius);
      assert.ok(Math.abs(s.pistonAngle - Math.PI / 2) + tipHalf < g.tongueHalfSpan, 'tip stays under the tongue');
      assert.equal(u.steamReport.spaceCount, 2, 'B divides the chamber into two working spaces');
      if (Math.abs(s.pistonAngularSpeed) > 0.2) {
        const drivenRight = s.pistonAngularSpeed > 0;
        const live = drivenRight ? s.rightPressure : s.leftPressure;
        const dead = drivenRight ? s.leftPressure : s.rightPressure;
        assert.ok(live > 0.99 && dead < 0.01, `steam behind B at ${i}`);
        assert.ok((drivenRight ? s.rightAdmission : s.leftAdmission) > 0);
        assert.ok((drivenRight ? s.leftExhaust : s.rightExhaust) > 0);
      }
      if (previous && Math.abs(s.pistonAngularSpeed) > 0.05) {
        const grows = s.pistonAngularSpeed > 0 ? u.steamReport.rightArea > previous.right : u.steamReport.leftArea > previous.left;
        assert.ok(grows, 'the steam space behind B expands');
      }
      previous = { left: u.steamReport.leftArea, right: u.steamReport.rightArea };
      assert.ok(Math.abs(s.valveX) <= g.valveTravelAmplitude + 1e-12);
    }
    const a = u.stateAtTime(0);
    const b = u.stateAtTime(g.cycleDuration);
    assert.ok(Math.abs(a.pistonAngle - b.pistonAngle) < 1e-12 && Math.abs(a.valveX - b.valveX) < 1e-12, 'seamless loop');
    // Brown's pose: B upright, steam entering by the right passage
    assert.ok(Math.abs(u.sourcePose.pistonAngle - Math.PI / 2) < 1e-12);
    assert.ok(a.rightPressure > 0.99);
    // live steam is shown in the chest, exhaust in the D hollow
    model.update(0);
    assert.ok(u.blocks.chestSteam.userData.pressure === 1 && u.blocks.chestSteam.userData.area > 0);
    assert.ok(u.blocks.exhaustSteam.userData.pressure === 0 && u.blocks.exhaustSteam.userData.area > 0);
  } finally { disposeObject3D(model.root); }
});
