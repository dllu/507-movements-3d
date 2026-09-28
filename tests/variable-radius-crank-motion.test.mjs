import assert from 'node:assert/strict';
import test from 'node:test';
import {variableRadiusCrankAtAngle, sourceVariableCrankGeometry} from '../src/simulation/variable-radius-crank-motion.js';

test('finite power rocker and both pitman spans close throughout the cycle', () => {
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let previous;
  for (let i = 0; i <= 1440; i++) {
    const state = variableRadiusCrankAtAngle(2 * Math.PI * i / 1440);
    assert.ok(Math.abs(distance(state.wrist, [10, 30]) - 30) < 1e-12);
    assert.ok(Math.abs(distance(state.wrist, state.auxiliaryPin) - 10) < 1e-12);
    assert.ok(Math.abs(distance(state.slotPin, state.auxiliaryPin) - 10) < 1e-12);
    assert.ok(state.wrist[0] > 7 && state.wrist[0] < 13);
    if (previous) assert.ok(distance(state.wrist, previous.wrist) < .02);
    previous = state;
  }
});

test('impossible closure is rejected rather than flattened to a false pose', () => {
  assert.throws(() => variableRadiusCrankAtAngle(0, {rockerPivot: [100, 100]}), RangeError);
});

test('engraving dimensions close throughout the cycle and fit the three initial joints', () => {
  const g = sourceVariableCrankGeometry();
  for (let i = 0; i <= 1440; i++) {
    const s = variableRadiusCrankAtAngle(2 * Math.PI * i / 1440, g);
    assert.ok(Math.abs(Math.hypot(s.wrist[0] - g.rockerPivot[0], s.wrist[1] - g.rockerPivot[1]) - g.rockerLength) < 1e-12);
    // The slot (capsule .34-1.50 in the crank) must contain the pin centre.
    assert.ok(s.slotRadius > .35 && s.slotRadius < 1.49);
  }
  // The inferred fulcrum sits about one pitman length from the wrist, along
  // Brown's broken-off continuation, so the whole rocker is in view.
  assert.equal(g.rockerLength, 2.5);
  const s = variableRadiusCrankAtAngle(g.phase, g);
  for (const [name, pixel] of [['auxiliaryPin', [310, 217]], ['slotPin', [123, 161]], ['wrist', [473, 263]]]) {
    const projected = [286 + s[name][0] / g.scale, 264 - s[name][1] / g.scale];
    assert.ok(Math.hypot(projected[0] - pixel[0], projected[1] - pixel[1]) < 1.6);
  }
});

test('168 slotted crank is one broad extrusion with a narrow slot and walls wider than the pin', async () => {
  const {makeVariableRadiusCrank} = await import('../src/simulation/variable-radius-crank.js');
  const THREE = await import('three');
  const model = makeVariableRadiusCrank();
  try {
    const crank = model.root.userData.parts.slottedCrank, pin = model.root.userData.parts.slotPin;
    crank.geometry.computeBoundingBox(); pin.geometry.computeBoundingBox();
    const box = crank.geometry.boundingBox, pinDiameter = pin.geometry.boundingBox.getSize(new THREE.Vector3()).x;
    // Arm 0.48 wide (3.3x the pin), boss radius 0.38.
    assert.ok(Math.abs(box.max.y - .38) < 2e-3 && Math.abs(box.min.y + .38) < 2e-3);
    assert.ok(Math.abs(box.max.x - 1.74) < 2e-3);
    // Probe across the arm at mid-slot: solid, slot, solid, with each wall wider than the pin.
    const ray = new THREE.Raycaster(), hits = [];
    const mesh = new THREE.Mesh(crank.geometry, new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
    ray.set(new THREE.Vector3(.9, -1, .09), new THREE.Vector3(0, 1, 0));
    for (const hit of ray.intersectObject(mesh)) hits.push(+(hit.point.y).toFixed(4));
    const ys = [...new Set(hits)].sort((a, b) => a - b);
    assert.equal(ys.length, 4, `crossings ${ys}`);
    const [a, b, c, d] = ys;
    assert.ok(b - a > pinDiameter && d - c > pinDiameter, `walls ${b - a}, ${d - c}`);
    assert.ok(c - b > pinDiameter && c - b - pinDiameter < .025, `slot ${c - b}`);
  } finally { model.dispose(); }
});
