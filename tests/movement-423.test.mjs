import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createAuthoredDoubleQuadrantEngineMovement } from '../src/simulation/authored-double-quadrant-engines.js';
import { pointInMulti } from '../src/simulation/steam-section-kit.js';
import { disposeObject3D } from '../src/simulation/dispose-model.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const movement = catalog.movements.find((m) => m.id === 423);
const DEG = Math.PI / 180;

test('423: one open cavity holds both pistons; nothing walls off the space between them', () => {
  const model = createAuthoredDoubleQuadrantEngineMovement(movement);
  try {
    const g = model.root.userData.geometry;
    assert.equal(g.workingCavity.length, 1, 'quadrants, central space, passages and valve bore are one cavity');
    // a straight line from inside the top quadrant, past the crank, to inside
    // the bottom quadrant stays in the cavity (no dividing wall)
    const from = [-1.5, 2.0];
    const to = [1.5, -3.2];
    for (let i = 0; i <= 40; i += 1) {
      const p = [from[0] + (to[0] - from[0]) * i / 40, from[1] + (to[1] - from[1]) * i / 40];
      assert.ok(pointInMulti(p, g.workingCavity), `open at ${p}`);
    }
    // the top passage opens into the top quadrant's corner round the end of
    // its curved wall; the bar itself is solid
    const corner = [g.pivotTop[0] + 5.35 * Math.cos(g.barEnd + 2.5 * DEG), g.pivotTop[1] + 5.35 * Math.sin(g.barEnd + 2.5 * DEG)];
    assert.ok(pointInMulti(corner, g.workingCavity), 'top port corner');
    const bar = [g.pivotTop[0] + 5.13 * Math.cos(60 * DEG), g.pivotTop[1] + 5.13 * Math.sin(60 * DEG)];
    assert.ok(!pointInMulti(bar, g.workingCavity), 'curved wall is solid');
    // B never runs past the end of the curved wall it seals on
    assert.ok(g.topMax + Math.asin(0.1 / 5) < g.barEnd - 1.2 * DEG);
    assert.ok(g.topMin > g.topInnerEnd && g.bottomMin > g.bottomInnerEnd);
  } finally { disposeObject3D(model.root); }
});

test('423: valve a feeds each piston through its working stroke, both where the strokes overlap, and never joins inlet to exhaust', () => {
  const model = createAuthoredDoubleQuadrantEngineMovement(movement);
  try {
    const u = model.root.userData;
    const g = u.geometry;
    assert.ok(g.powerStrokeFraction > 0.55 && g.powerStrokeFraction < 0.67, 'about two-thirds of the turn');
    assert.ok(g.overlapFraction > 0.15, 'both pistons driven for part of the turn: no dead point');
    let agree = 0;
    let frames = 0;
    let both = 0;
    for (let i = 0; i < 144; i += 1) {
      const time = i / 144 * u.animationTiming.authoredCyclePeriod;
      model.update(time);
      const s = u.stateAtTime(time);
      const r = u.steamReport;
      assert.ok(!(r.topJoinedToInlet && r.topJoinedToExhaust), 'top passage never blows through');
      assert.ok(!(r.bottomJoinedToInlet && r.bottomJoinedToExhaust), 'bottom passage never blows through');
      assert.ok(r.pieceCount >= 2, 'inlet and exhaust are always separate');
      frames += 1;
      if (s.top.powered === r.topJoinedToInlet && s.bottom.powered === r.bottomJoinedToInlet) agree += 1;
      if (r.topJoinedToInlet && r.bottomJoinedToInlet) both += 1;
    }
    assert.ok(agree / frames > 0.9, `valve timing matches the power strokes (${agree}/${frames})`);
    assert.ok(both / frames > 0.15, 'both passages take steam during the overlaps');
    // Brown's pose: bottom B at the end of its stroke with rods and crank in line
    const s0 = u.stateAtTime(0);
    assert.ok(Math.abs(s0.bottom.vaneAngle - g.bottomMax) < 0.01);
    const roles = [];
    model.root.traverse((o) => { if (o.userData.role) roles.push(o.userData.role); });
    for (const banned of [/indicator/, /marker/, /pedestal/]) assert.ok(!roles.some((x) => banned.test(x)), String(banned));
  } finally { disposeObject3D(model.root); }
});
