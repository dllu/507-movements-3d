import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createMovementModel } from '../src/simulation/registry.js';

const catalog = JSON.parse(await readFile(new URL('../src/data/movements.json', import.meta.url), 'utf8'));
const movement = catalog.movements.find(({ id }) => id === 284);
const model = createMovementModel(movement);
const { blocks, geometry: g, solution: s, stateAtTime, ratchetProfile } = model.root.userData;
const pitch = g.ratchetPitch;
const perRev = s.total / (g.feedStrokes + 1);

test('284 is one crank, bell crank, pulling catch, click, ratchet, pinion and carriage', () => {
  assert.equal(model.root.userData.fidelity, 'authored');
  assert.equal(model.root.userData.archetype, movement.archetype);
  for (const name of ['inputCrank', 'bellCrank', 'catchGroup', 'click', 'ratchet', 'pinion', 'carriage', 'connectingRod']) {
    assert.ok(blocks[name], name);
  }
  assert.equal(blocks.pinion.parent, blocks.ratchet);
  assert.equal(blocks.rackBar.parent, blocks.carriage);
  assert.equal(g.ratchetTeeth, 44);
  assert.equal(g.pinionTeeth, 8);
  assert.match(model.root.userData.mechanism, /pulls the ratchet anticlockwise/);
  // No hatching, indices or marker parts.
  const roles = [];
  model.root.traverse((object) => roles.push(object.userData.role ?? ''));
  assert.equal(roles.some((role) => /index|marker|hatch/.test(role)), false);
});

test('284 ratchet faces lean back as Brown cuts them and face clockwise', () => {
  // Pairs: [root, tip]. Each tip stands a little ahead (anticlockwise) of its
  // root: the steep face leans Brown's ~12 degrees back over its own tooth.
  // The back then falls to the next root anticlockwise.
  const lean = g.toothFaceLean * 180 / Math.PI;
  assert.ok(lean > 9 && lean < 14, `lean ${lean}`);
  for (let i = 0; i < ratchetProfile.length; i += 2) {
    const root = ratchetProfile[i];
    const tip = ratchetProfile[i + 1];
    const next = ratchetProfile[(i + 2) % ratchetProfile.length];
    const lead = Math.atan2(tip[1], tip[0]) - Math.atan2(root[1], root[0]);
    const wrapped = ((lead + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
    assert.ok(Math.abs(wrapped - g.toothTipLead) < 1e-9);
    assert.ok(Math.hypot(...tip) > Math.hypot(...next));
    const turn = Math.atan2(next[1], next[0]) - Math.atan2(tip[1], tip[0]);
    assert.ok(((turn % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) < pitch + 1e-9);
  }
  // The claw's working edge lies along the tooth face it pulls: over every
  // pull it stands within 2 degrees under the face, never steeper (catch and
  // wheel turn about different centres, so a sliver remains).
  let pulls = 0;
  for (let k = 0; k < 4000; k += 1) {
    const state = model.root.userData.stateAtTime(k * g.loopPeriod / 4000);
    if (!state.driving) continue;
    const noseAngle = Math.atan2(state.nose[1], state.nose[0]);
    const n = Math.round((noseAngle - state.wheelAngle - g.mountPhase) / pitch);
    const theta = g.mountPhase + n * pitch + state.wheelAngle;
    const root = [g.ratchetRootRadius * Math.cos(theta), g.ratchetRootRadius * Math.sin(theta)];
    const tip = [g.ratchetTipRadius * Math.cos(theta + g.toothTipLead), g.ratchetTipRadius * Math.sin(theta + g.toothTipLead)];
    const mismatch = (Math.atan2(tip[1] - root[1], tip[0] - root[0]) - g.clawRise - state.catchAngle) * 180 / Math.PI;
    assert.ok(mismatch > 0 && mismatch < 2, `claw edge vs face ${mismatch} at ${k}`);
    assert.ok(Math.hypot(state.nose[0] - root[0], state.nose[1] - root[1]) < 0.004, 'claw point in the pocket corner');
    pulls += 1;
  }
  assert.ok(pulls > 1000);
});

test('284 feeds one tooth anticlockwise per crank turn and never runs back while feeding', () => {
  for (let rev = 0; rev < g.feedStrokes; rev += 1) {
    const start = s.wheel[rev * perRev];
    const end = s.wheel[(rev + 1) * perRev];
    assert.ok(Math.abs(end - start - pitch) < 1e-9, `stroke ${rev}`);
    let peak = start;
    for (let i = rev * perRev; i <= (rev + 1) * perRev; i += 1) {
      peak = Math.max(peak, s.wheel[i]);
      // The click holds every return: the wheel never falls below the
      // pocket it last dropped into.
      assert.ok(s.wheel[i] >= start - 1e-9, `run-back at ${i}`);
      assert.ok(peak - s.wheel[i] < 0.1 * pitch, `settle at ${i}`);
    }
    assert.ok(peak > end, 'the catch overtravels and the wheel settles back onto the click');
  }
});

test('284 catch only pulls: the wheel moves only while the catch is seated and rising', () => {
  for (let i = 1; i < g.feedStrokes * perRev; i += 1) {
    if (s.wheel[i] > s.wheel[i - 1] + 1e-12) assert.equal(s.engaged[i], 1, `step ${i}`);
  }
  // The wheel advances only while the bell crank turns clockwise (slider
  // moving left): the catch pulls up the right side of the wheel. (Past the
  // stroke end the seated catch lets the wheel settle back onto the click.)
  const rockerAt = (time) => stateAtTime(time).rockerAngle;
  let pulls = 0;
  for (let time = 0.01; time < g.loopPeriod; time += 0.01) {
    const state = stateAtTime(time);
    const advancing = stateAtTime(time + 1e-3).wheelAngle > stateAtTime(time - 1e-3).wheelAngle + 1e-9;
    if (state.driving && !state.gigBack && advancing) {
      pulls += 1;
      assert.ok(rockerAt(time + 1e-3) < rockerAt(time - 1e-3) + 1e-5, `rocker at ${time}`);
      assert.ok(state.nose[0] > 1.3, 'nose on the right side of the wheel');
    }
  }
  assert.ok(pulls > 100);
});

test('284 catch and click rest on the teeth (no penetration) while feeding', () => {
  for (let i = 0; i < g.feedStrokes * perRev; i += 1) {
    assert.ok(s.catchGap[i] >= -1e-9, `catch ${i}`);
    assert.ok(s.clickGap[i] >= -1e-9, `click ${i}`);
  }
});

test('284 rack stays in mesh and the loop closes seamlessly', () => {
  let minX = Infinity;
  let maxX = -Infinity;
  for (let time = 0; time <= g.loopPeriod; time += 0.005) {
    const { rackX } = stateAtTime(time);
    minX = Math.min(minX, rackX);
    maxX = Math.max(maxX, rackX);
  }
  const travel = maxX - minX;
  assert.ok(travel > 0.5 && travel < 0.6, `travel ${travel}`);
  // The rack bar spans the pinion throughout its travel.
  blocks.rackBar.geometry.computeBoundingBox();
  const box = blocks.rackBar.geometry.boundingBox;
  assert.ok(box.min.x + maxX < -g.pinionPitchRadius - 0.3);
  assert.ok(box.max.x + minX > g.pinionPitchRadius + 3);
  // Loop closure.
  for (const key of ['psi', 'alpha', 'beta']) {
    assert.ok(Math.abs(s.loopStart[key] - s.loopEnd[key]) < 1e-9, key);
  }
  const a = stateAtTime(0.3);
  const b = stateAtTime(0.3 + g.loopPeriod);
  for (const key of ['wheelAngle', 'catchAngle', 'clickAngle', 'rackX', 'rockerAngle']) {
    assert.ok(Math.abs(a[key] - b[key]) < 1e-9, key);
  }
  // Smooth wheel: no jump between samples.
  for (let i = 1; i <= s.total; i += 1) assert.ok(Math.abs(s.wheel[i] - s.wheel[i - 1]) < 0.02 * pitch * 4, `wheel step ${i}`);
});

test('284 feed screw setting stays inside the drawn slot', () => {
  // The slot in the vertical arm runs from raster y 134 to 224 below a at 122.
  const slider = g.sliderRadius / g.sourceScale;
  assert.ok(slider > 134 - 122 + 10 && slider < 224 - 122 - 10, `slider ${slider}`);
  assert.ok(g.overtravel / pitch > 0.02 && g.overtravel / pitch < 0.1, `overtravel ${g.overtravel / pitch}`);
});

test('284 hook hangs where Brown draws it in the default pose', () => {
  // The slider sits catchHingeDrop px low on its screw (just past the least
  // setting that feeds), and the catch is built from that hinge so the claw
  // point still stands at Brown's pocket.
  assert.ok(g.catchHingeDrop <= 4);
  assert.ok(Math.abs(g.sliderRadius - g.sourceSliderRadius - g.catchHingeDrop * g.sourceScale) < 1e-9);
  const { nose } = stateAtTime(0);
  const raster = [nose[0] / g.sourceScale + 140, 352 - nose[1] / g.sourceScale];
  assert.ok(Math.hypot(raster[0] - g.catchClawTipRaster[0], raster[1] - g.catchClawTipRaster[1]) < 5, `nose ${raster}`);
});
