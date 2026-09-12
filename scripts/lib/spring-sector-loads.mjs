import {springSectorFamilyMass} from './spring-sector-mass.mjs';

const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, s) => a.map(v => v * s);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const tangent = p => [-p[1], p[0]];
const rotate = (p, a) => [Math.cos(a) * p[0] - Math.sin(a) * p[1], Math.sin(a) * p[0] + Math.cos(a) * p[1]];

// Five rigid families, including the prescribed shaft and connecting rod.
// Fixed assembly overlaps are additive lumped masses. The four springs are
// ideal massless energy stores, as in the free-coordinate dynamics study.
export function makeSpringSectorLoads(candidate, physics) {
  const u = candidate.root.userData, parameters = physics.parameters, density = parameters.density;
  if (parameters.coulomb !== 0) throw Error('Loading audit requires zero Coulomb drag');
  const masses = Object.fromEntries(['wheel', 'front', 'rear', 'shaft', 'rod'].map(family => {
    const raw = springSectorFamilyMass(candidate, family), m = raw.volume * density;
    const first = raw.first.map(v => v * density), I = density * raw.polarZ;
    return [family, {m, first, centroid: raw.centroid, I, Iy: density * raw.polarY,
      Ic: I - m * (raw.centroid[0] ** 2 + raw.centroid[1] ** 2)}];
  }));
  const {pin, end, direction, length} = u.linkage, normal = tangent(direction);
  if (!(parameters.amplitude >= 0 && parameters.amplitude < Math.PI)) throw Error('Unsupported shaft range');
  const pinRadius = Math.hypot(...pin), displacement = 2 * pinRadius * Math.sin(parameters.amplitude / 2) + 1e-12;
  const initialDerivative = dot(tangent(pin), direction), axialLength = Math.sqrt(length ** 2 - displacement ** 2);
  const derivativeVariation = displacement + displacement * pinRadius / axialLength;
  const inputTransmissionBound = {amplitude: parameters.amplitude, pinDisplacement: displacement,
    minimumRodAxialProjection: axialLength, minimumAbsSliderDerivative: Math.abs(initialDerivative) - derivativeVariation};
  if (!(axialLength > 0 && inputTransmissionBound.minimumAbsSliderDerivative > 0)) throw Error('Input transmission bound includes a toggle');
  function rodAt(q) {
    const P = rotate(pin, q), Pq = tangent(P), Pqq = mul(P, -1);
    const t = dot(sub(P, end), normal), tq = dot(Pq, normal), tqq = dot(Pqq, normal);
    const discriminant = length ** 2 - t ** 2;
    if (!(discriminant > 0)) throw Error('Rod loading reaches the guide toggle');
    const d = Math.sqrt(discriminant), angle = -Math.asin(t / length), aq = -tq / d;
    const aqq = -tqq / d - t * tq ** 2 / d ** 3;
    const slider = dot(sub(P, end), direction) + d;
    const sliderQ = dot(Pq, direction) - t * tq / d;
    const sliderQQ = dot(Pqq, direction) - (tq ** 2 + t * tqq) / d - t ** 2 * tq ** 2 / d ** 3;
    const m = masses.rod, local = sub(m.centroid.slice(0, 2), pin), r = rotate(local, angle);
    const C = add(P, r), Cq = add(Pq, mul(tangent(r), aq));
    const Cqq = add(Pqq, sub(mul(tangent(r), aqq), mul(r, aq ** 2)));
    const M = m.m * dot(Cq, Cq) + m.Ic * aq ** 2;
    const Mq = 2 * (m.m * dot(Cq, Cqq) + m.Ic * aq * aqq);
    return {P, angle, aq, aqq, slider, sliderQ, sliderQQ, C, Cq, Cqq, M, Mq,
      U: parameters.gravity * m.m * C[1], Uq: parameters.gravity * m.m * Cq[1]};
  }
  function state(row) {
    const k = physics.input(row.time), rod = rodAt(k.q), shaft = masses.shaft, wheel = masses.wheel;
    const c = Math.cos(k.q), s = Math.sin(k.q), g = parameters.gravity;
    let M = shaft.I + rod.M, momentum = M * k.v;
    let kinetic = .5 * wheel.Iy * row.v[0] ** 2 + .5 * M * k.v ** 2;
    let potential = g * wheel.first[1] + g * (shaft.first[0] * s + shaft.first[1] * c) + rod.U;
    let Tq = .5 * rod.Mq * k.v ** 2, Uq = g * (shaft.first[0] * c - shaft.first[1] * s) + rod.Uq;
    const sectors = ['front', 'rear'].map((name, i) => {
      const m = masses[name], lift = row.x[i + 1], v = row.v[i + 1], A = m.I + 2 * lift * m.first[1] + m.m * lift ** 2;
      kinetic += .5 * A * k.v ** 2 + m.first[0] * k.v * v + .5 * m.m * v ** 2;
      potential += g * (m.first[0] * s + (m.first[1] + m.m * lift) * c)
        + .5 * parameters.stiffness[i] * (lift - parameters.freeLift[i]) ** 2;
      Uq += g * (m.first[0] * c - (m.first[1] + m.m * lift) * s);
      momentum += A * k.v + m.first[0] * v; M += A;
      return {name, A, coupling: m.first[0], mass: m.m};
    });
    return {kinetic, potential, energy: kinetic + potential, M, momentum, Tq, Uq, k, rod, sectors};
  }
  function interval(before, after, contacts) {
    const a = state(before), b = state(after), dt = after.time - before.time;
    const contactInputImpulse = contacts.reduce((sum, c) => sum + c.impulse * c.inputJacobian, 0);
    const inputImpulse = b.momentum - a.momentum - dt * b.Tq + dt * b.Uq - contactInputImpulse;
    const inputWork = inputImpulse * b.k.v;
    const rodImpulse = inputImpulse / b.rod.sliderQ;
    if (!Number.isFinite(rodImpulse) || Math.abs(b.rod.sliderQ) < 1e-8) throw Error('Input rod force is singular');
    const dv = after.v.map((v, i) => v - before.v[i]), dq = b.k.v - a.k.v;
    let velocityChangeLoss = .5 * masses.wheel.Iy * dv[0] ** 2 + .5 * b.M * dq ** 2;
    for (let i = 0; i < 2; i++) velocityChangeLoss += .5 * b.sectors[i].mass * dv[i + 1] ** 2
      + b.sectors[i].coupling * dq * dv[i + 1];
    const springChangeLoss = [0, 1].reduce((sum, i) => sum + .5 * parameters.stiffness[i] * (after.x[i + 1] - before.x[i + 1]) ** 2, 0);
    const dampingWork = dt * after.v.reduce((sum, v, i) => sum + parameters.damping[i] * v ** 2, 0);
    const loadWork = dt * parameters.load * after.v[0];
    const contactVelocityWork = contacts.reduce((sum, c) => sum + c.impulse * (dot(c.J, after.v) + c.inputJacobian * b.k.v), 0);
    const change = b.energy - a.energy, residual = change - inputWork + dampingWork + loadWork;
    return {change, inputWork, rodWork: rodImpulse * b.rod.sliderQ * b.k.v,
      inputImpulse, rodImpulse, inputForce: rodImpulse / dt, sliderQ: b.rod.sliderQ,
      dampingWork, loadWork, velocityChangeLoss, springChangeLoss, contactVelocityWork,
      correctedResidual: residual + velocityChangeLoss + springChangeLoss - contactVelocityWork};
  }
  return {masses, inputTransmissionBound, rodAt, state, interval,
    qualification: 'Five rigid-family masses come from additive signed-tetrahedron mesh integrals; overlaps within the fixed shaft assembly are explicit lumped masses. Springs are ideal massless Hookean elements. Input force acts along the hidden remote rod guide. Forces are interval averages in normalized model units; rigid impacts can produce increasing force peaks as the time step decreases. Impulses are reported separately. This generalized loading audit does not establish bearing pressure, individual guide reaction distributions, material stress or external support geometry.'};
}
