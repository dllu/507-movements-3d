// Reconstruct a finite sphere envelope against the production tooth triangles.
// The crest hold and subsequent C1 drop are prescribed, not gravity dynamics.
// The drop lands the nose on the next ramp, and the drive stroke's approach
// then rides it down that ramp into the root (the `approach` samples).
import * as THREE from 'three';
import { readFile, writeFile } from 'node:fs/promises';
import { createAuthoredIntermittentMovement as create } from '../src/simulation/authored-intermittent.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';
const model = create({id:237}), d = model.root.userData, g = d.geometry;
const fields = d.blocks.crownWheel.userData.crownTeeth.map(t => solidSurface(t.geometry));
const point = new THREE.Vector3();
// The flat pawl plate itself (in the pawl's frame: x radial, y tangential,
// z vertical) must also clear the teeth; only its lower part can reach them.
const noseLocal = new THREE.Vector3(0, g.pawlTipTangent, g.pawlTipVertical);
const bodyPoints = surfacePoints(d.blocks.pawlBody.geometry)
  .filter((p, i) => p.z < -0.25 && (i % 2 === 0 || p.distanceTo(noseLocal) < 0.1));
// Only the teeth either side of a point can reach it.
const nearFields = (x, y) => {
  const i = Math.floor(THREE.MathUtils.euclideanModulo(Math.atan2(y, x) - g.crownMountPhase, 2 * Math.PI) / g.toothPitch);
  return [i - 1, i, i + 1].map(k => fields[THREE.MathUtils.euclideanModulo(k, fields.length)]);
};
function bodyGapAt(angle, lift, limit) {
  const c = Math.cos(lift), s = Math.sin(lift), ca = Math.cos(angle), sa = Math.sin(angle);
  let best = limit;
  for (const p of bodyPoints) {
    const y = p.y*c + p.z*s, z = -p.y*s + p.z*c, x = g.armPawlPivotRadius + p.x;
    point.set(x*ca - y*sa, x*sa + y*ca, g.armPivotHeight + z);
    if (point.z > g.wheelTipHeight + best) continue;
    for (const f of nearFields(point.x, point.y)) best = Math.min(best, f.signedDistance(point, best + 0.05));
  }
  return best;
}
// Gap of the nose sphere with the arm at `angle` relative to the wheel.
function gapAt(angle, lift) {
  const nose = noseGapAt(angle, lift);
  return nose < 0 ? nose : Math.min(nose, bodyGapAt(angle, lift, 0.05));
}
function noseGapAt(angle, lift) {
  const tangent = g.pawlTipTangent*Math.cos(lift)+g.pawlTipVertical*Math.sin(lift);
  const height = g.armPivotHeight-g.pawlTipTangent*Math.sin(lift)+g.pawlTipVertical*Math.cos(lift);
  point.set(g.armPawlPivotRadius*Math.cos(angle)-tangent*Math.sin(angle), g.armPawlPivotRadius*Math.sin(angle)+tangent*Math.cos(angle), height);
  let best = Infinity;
  for (const f of nearFields(point.x, point.y)) best = Math.min(best, f.signedDistance(point, best + g.pawlNoseRadius + 0.05));
  return best - g.pawlNoseRadius;
}
// Lowest lift at or above `floor` that stands the sphere clear (resting on
// the ramp). Tracking from the previous sample's lift keeps the envelope on
// the pawl's own branch instead of jumping to a clear pose elsewhere.
function restingLift(angle, clearance, floor = 0) {
  if (gapAt(angle, floor) >= clearance) return floor;
  let low = floor, high = 0;
  for (let a = floor + 0.0005; a <= 0.8; a += 0.0005) { if (gapAt(angle, a) >= clearance) { high = a; break; } low = a; }
  if (!high) throw new Error(`no clear lift at ${angle}`);
  for (let i = 0; i < 34; i++) { const a = (low + high) / 2; if (gapAt(angle, a) >= clearance) high = a; else low = a; }
  return high;
}
// Return stroke (cycle 0): arm at lowArmAngle + travel, wheel at -pitch.
// Just after the drive the nose leaves the face it has driven; it touches
// that face at travel 0, so the first samples stay seated.
const returnAngle = travel => g.lowArmAngle + travel + g.toothPitch;
const count = 2048, samples = [];
// Next to the face it has just left, the nose may only touch (clearance 0).
const tracked = (angle, previous) => {
  const floor = Math.max(0, previous - 0.02);
  const lift = restingLift(angle, 0.0002, floor);
  return lift > previous + 0.05 ? restingLift(angle, 0, floor) : lift;
};
for (let i = 0; i <= count; i++) {
  samples.push(i === 0 ? 0 : tracked(returnAngle(g.armSwing*i/count), samples[i-1]));
}
let peak = 0; for (let i = 0; i <= count; i++) if (samples[i] > samples[peak]) peak = i;
// Up to the crest the pawl only rises: where its plate edge slides off a
// crest corner onto the ramp the brief dip is held level, which stays clear.
for (let i = 1; i <= peak; i++) samples[i] = Math.max(samples[i], samples[i-1]);
// Which samples bear on the working nose (the rest ride the plate's edge).
const noseContact = samples.map((lift, i) => i > 0 && i <= peak && noseGapAt(returnAngle(g.armSwing*i/count), lift) < 0.00021 ? 1 : 0);
const peakLift = samples[peak], peakTravel = g.armSwing*peak/count;
const startTravel = samples.findIndex(x => x > 0)*g.armSwing/count;
// Drive-stroke approach (cycle 0): arm at highArmAngle - travel, wheel at 0.
const approachCount = 256;
const approach = [];
for (let i = 0; i <= approachCount; i++) {
  const travel = g.overtravel*i/approachCount;
  approach.push(i === approachCount ? 0 : i === 0 ? restingLift(g.highArmAngle, 0.0002) : tracked(g.highArmAngle - travel, approach[i-1]));
}
const landLift = approach[0];
const dropStart = peak+0.014/g.armSwing*count;
for (let i = peak+1; i <= count; i++) { const u = Math.max(0, (i-dropStart)/(count-dropStart)); samples[i] = landLift+(peakLift-landLift)*(1-3*u*u+2*u*u*u); }
const data = {samples, noseContact, peak, armSwing: g.armSwing, peakLift, peakTravel, startTravel, overtravel: g.overtravel, landLift, approach};
const output = '// Generated by scripts/generate-crown-pawl-237-return.mjs.\nexport const crown237Return = '+JSON.stringify(data)+';\n';
const target = new URL('../src/simulation/baked/crown-pawl-237-return.js', import.meta.url);
if (process.argv.includes('--check')) { if (await readFile(target,'utf8') !== output) throw new Error('237 bake differs; regenerate'); console.log('237 return bake is byte-identical'); }
else { await writeFile(target, output); console.log({samples: samples.length, peakLift, peakTravel, startTravel, landLift, approachMax: Math.max(...approach)}); }
