import {makeSpringSectorFastContact} from './spring-sector-fast-contact.mjs';
import {springSectorFamilyMass} from './spring-sector-mass.mjs';
import {advanceAlternatingPegStep} from './alternating-peg-dynamics-study.mjs';

export function makeSpringSectorFastDynamics(candidate, {period = 4, amplitude = .22, theta = .07233930452344918,
  stiffness = [40, 40], freeLift = [-.06, -.06], damping = [.05, .25, .25], gravity = 9.81, load = 0} = {}) {
  const contact = makeSpringSectorFastContact(candidate), raw = ['wheel', 'front', 'rear'].map(key => springSectorFamilyMass(candidate, key));
  const density = 1 / raw[1].volume;
  const mass = raw.map(m => ({m: density * m.volume, first: m.first.map(v => v * density),
    polarZ: density * m.polarZ, polarY: density * m.polarY, centroid: m.centroid}));
  const inertia = [mass[0].polarY, mass[1].m, mass[2].m], omega = 2 * Math.PI / period;
  const lower = -.06, upper = .18;
  const input = time => ({q: -amplitude * Math.cos(omega * time), v: amplitude * omega * Math.sin(omega * time),
    acceleration: amplitude * omega ** 2 * Math.cos(omega * time)});
  const forces = (x, time) => {
    const k = input(time);
    // For a plate with radial coordinate s: T = m*sDot²/2 +
    // qDot*sDot*Mx + qDot²*(Izz + 2*s*My + m*s²)/2.
    // Its free-coordinate inertial term is qDot²*(My+m*s)-qDDot*Mx.
    return [-load, ...[0, 1].map(i => {
      const m = mass[i + 1], s = x[i + 1];
      return k.v ** 2 * (m.first[1] + m.m * s) - k.acceleration * m.first[0]
        - gravity * m.m * Math.cos(k.q) - stiffness[i] * (s - freeLift[i]);
    })];
  };
  const constraints = (x, time, padding = .003) => {
    const k = input(time), rows = [], gaps = {};
    for (let side = 0; side < 2; side++) {
      const seat = contact.seat(k.q, x[0], side, {lower, upper, derivatives: true, contactMargin: padding});
      gaps['sector' + side] = x[side + 1] - seat.lift;
      for (const feature of seat.active) {
        const gap = x[side + 1] - feature.lift; if (gap > padding) continue;
        const J = [-feature.gradient.wheel, 0, 0]; J[side + 1] = 1;
        const axis = JSON.stringify(feature.limiting.axis);
        rows.push({id: side + ':' + feature.cell + ':' + feature.tooth + ':' + axis, key: 'sector' + side,
          J, gap, inputNormalVelocity: -feature.gradient.shaft * k.v, feature});
      }
      for (const [name, bound, sign] of [['lower', lower, 1], ['upper', upper, -1]]) {
        const gap = sign * (x[side + 1] - bound); gaps[side + ':' + name] = gap;
        if (gap > padding) continue;
        const J = [0, 0, 0]; J[side + 1] = sign;
        rows.push({id: side + ':' + name, key: 'guide' + side, J, gap, inputNormalVelocity: 0});
      }
    }
    return {rows, gaps};
  };
  const initialLifts = [0, 1].map(side => contact.seat(input(0).q, theta, side, {lower, upper}).lift);
  return {parameters: {period, amplitude, theta, stiffness, freeLift, damping, gravity, load, density, mass, inertia,
    coulomb: 0, guideLimits: [lower, upper], idealizations: 'Prescribed shaft motion; massless springs with combined stiffness per sector; common density for the free rigid families; no friction.'},
    input, contact, rawMass: raw, forces, constraints,
    initial: {time: 0, x: [theta, ...initialLifts], v: [0, 0, 0], active: []}};
}

export const advanceSpringSectorStep = advanceAlternatingPegStep;
