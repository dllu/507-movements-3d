import {familyMass, rotate} from '../../src/simulation/finite-plate-geometry.js';
import {dot, cross} from '../../src/simulation/finite-polygon-contact.js';
import {makeTreadleRatchetContact} from './treadle-ratchet-contact.mjs';
import {makeTreadleRatchetInput} from './treadle-ratchet-input.mjs';
import {advanceAlternatingPegStep} from './alternating-peg-dynamics-study.mjs';

export function makeTreadleRatchetDynamics(candidate, {
  theta = .07, damping = [.2, .008, .008], coulomb = 0, preload = [0, 0], seatLowerBounds = [-.7, -.7],
} = {}) {
  const u = candidate.root.userData, input = makeTreadleRatchetInput(u.linkage);
  const contact = makeTreadleRatchetContact(candidate);
  const raw = ['wheel', 'lowerPawl', 'upperPawl'].map(key => familyMass(u.parts, u.families, key));
  const density = 1 / raw[1].volume;
  const mass = raw.map(m => ({m: m.volume * density, I: m.polar * density, c: m.centroid.slice(0, 2)}));
  const inertia = mass.map(m => m.I);
  let lastTime, lastInput;
  const at = time => {
    if (time !== lastTime) {lastTime = time; lastInput = input(time);}
    return lastInput;
  };
  const forces = (x, time) => {
    const k = at(time);
    return [-mass[0].m * 9.81 * rotate(mass[0].c, x[0])[0], ...k.pawls.map((p, i) => {
      const m = mass[i + 1], r = rotate(m.c, x[i + 1]);
      return -m.m * (9.81 * r[0] + cross(r, p.acceleration)) + preload[i];
    })];
  };
  const constraints = (x, time, padding = .003) => {
    const k = at(time), rows = [], gaps = {};
    for (const [i, p] of k.pawls.entries()) {
      const pair = contact.pair(p.key, p.pivot, x[0], x[i + 1], padding);
      gaps[p.key] = pair.minimumGap;
      for (const f of pair.rows) {
        const J = [f.J[0], 0, 0]; J[i + 1] = f.J[1];
        rows.push({...f, J, point: f.pawlPoint, inputNormalVelocity: dot(f.normal, p.velocity)});
      }
    }
    return {rows, gaps};
  };
  const seats = at(0).pawls.map((p, i) => contact.seat(p.key, p.pivot, theta, {lower: seatLowerBounds[i]}));
  if (seats.some(s => !s.okay)) throw Error('No initial nonpenetrating seat');
  return {parameters: {theta, damping, coulomb, preload, seatLowerBounds, density, mass, inertia}, input: at, contact, forces, constraints,
    initial: {time: 0, x: [theta, ...seats.map(s => s.alpha)], v: [0, 0, 0], active: []}};
}

export const advanceTreadleRatchetStep = advanceAlternatingPegStep;
