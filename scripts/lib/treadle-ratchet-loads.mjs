import {familyMass, add, sub, rotate} from '../../src/simulation/finite-plate-geometry.js';
import {dot, cross, mul} from '../../src/simulation/finite-polygon-contact.js';
import {treadleSourcePoint} from './treadle-ratchet-linkage.mjs';
const tangent = p => [-p[1], p[0]], norm2 = p => dot(p, p);

// A loading study for the prescribed linkage, independent of the free-angle
// solver. The strap and pulley are ideal massless constraints here. Rigid
// component masses are additive; concealed weld overlaps are lumped masses.
export function makeTreadleRatchetLoads(candidate, physics) {
  if (physics.parameters.coulomb !== 0) throw Error('This loading study only supports zero Coulomb drag');
  const u = candidate.root.userData, p = u.linkage.parameters, density = physics.parameters.density;
  const masses = Object.fromEntries(['wheel', ...['lower', 'upper'].flatMap(key =>
    ['Arm', 'Treadle', 'Rod', 'Pawl'].map(suffix => key + suffix))].map(family => {
    const m = familyMass(u.parts, u.families, family);
    return [family, {m: density * m.volume, c: m.centroid.slice(0, 2), I: density * m.polar, Ic: density * m.centralPolar}];
  }));

  function limb(index, q) {
    const a = p.arms[index], key = a.name, b = rotate(a.rodLocal, q), B = add(p.fulcrum, b), d = Math.hypot(...B);
    const cosine = (a.armRodRadius ** 2 + d * d - a.rodLength ** 2) / (2 * a.armRodRadius * d);
    if (Math.abs(cosine) >= 1) throw Error('Singular or unclosed rod');
    const raw = Math.atan2(B[1], B[0]) + a.branch * Math.acos(cosine) - a.armRodOffset;
    const beta = a.sourceArmAngle + Math.atan2(Math.sin(raw - a.sourceArmAngle), Math.cos(raw - a.sourceArmAngle));
    const A = rotate(a.armRodLocal, beta), D = sub(A, B), Bq = tangent(b), Bqq = mul(b, -1);
    const denominator = dot(D, tangent(A)), betaQ = dot(D, Bq) / denominator;
    const relativeV = sub(mul(tangent(A), betaQ), Bq);
    const betaQQ = (dot(D, add(Bqq, mul(A, betaQ ** 2))) - norm2(relativeV)) / denominator;
    const Aq = mul(tangent(A), betaQ), Aqq = sub(mul(tangent(A), betaQQ), mul(A, betaQ ** 2));
    const R = sub(B, A), Rq = sub(Bq, Aq), Rqq = sub(Bqq, Aqq), gamma = Math.atan2(R[1], R[0]);
    const gammaQ = cross(R, Rq) / norm2(R), gammaQQ = cross(R, Rqq) / norm2(R);
    const P = rotate(a.pawlLocal, beta), Pq = mul(tangent(P), betaQ), Pqq = sub(mul(tangent(P), betaQQ), mul(P, betaQ ** 2));
    const arm = masses[key + 'Arm'], treadle = masses[key + 'Treadle'], rod = masses[key + 'Rod'], pawl = masses[key + 'Pawl'];
    const armC = rotate(arm.c, beta), treadleC = add(p.fulcrum, rotate(treadle.c, q));
    const r = rotate(rod.c, gamma), rodC = add(A, r), rodCq = add(Aq, mul(tangent(r), gammaQ));
    const rodCqq = add(Aqq, sub(mul(tangent(r), gammaQQ), mul(r, gammaQ ** 2)));
    const M = treadle.I + arm.I * betaQ ** 2 + rod.m * norm2(rodCq) + rod.Ic * gammaQ ** 2 + pawl.m * norm2(Pq);
    const Mq = 2 * (arm.I * betaQ * betaQQ + rod.m * dot(rodCq, rodCqq) + rod.Ic * gammaQ * gammaQQ + pawl.m * dot(Pq, Pqq));
    const U = 9.81 * (arm.m * armC[1] + treadle.m * treadleC[1] + rod.m * rodC[1] + pawl.m * P[1]);
    const Uq = 9.81 * (arm.m * armC[0] * betaQ + treadle.m * rotate(treadle.c, q)[0] + rod.m * rodCq[1] + pawl.m * Pq[1]);
    const toe = rotate(sub(treadleSourcePoint(u.geometry.source.treadles[index ? 'upperToe' : 'lowerToe']), p.fulcrum), -a.sourceTreadleAngle);
    return {key, q, beta, betaQ, betaQQ, gamma, gammaQ, gammaQQ, P, Pq, Pqq, M, Mq, U, Uq,
      footX: rotate(toe, q)[0], rodC, rodCq, rodCqq};
  }

  function state(row) {
    const k = physics.input(row.time), wheel = masses.wheel;
    let kinetic = .5 * wheel.I * row.v[0] ** 2, potential = 9.81 * wheel.m * rotate(wheel.c, row.x[0])[1];
    const limbs = [k.frontAngle, k.rearAngle].map((q, i) => {
      const a = limb(i, q), m = masses[a.key + 'Pawl'], r = rotate(m.c, row.x[i + 1]);
      const qv = k.treadleVelocity[i], w = row.v[i + 1], torque = physics.parameters.preload[i];
      const C = m.m * dot(a.Pq, tangent(r)), Cq = m.m * dot(a.Pqq, tangent(r));
      const T = .5 * a.M * qv * qv + C * qv * w + .5 * m.I * w * w;
      const U = a.U + 9.81 * m.m * r[1] - torque * (row.x[i + 1] - a.beta);
      kinetic += T; potential += U;
      return {...a, C, qv, w, momentum: a.M * qv + C * w,
        Tq: .5 * a.Mq * qv * qv + Cq * qv * w, Uq: a.Uq + torque * a.betaQ};
    });
    const f = rotate(p.strapLocal, k.frontAngle), r = rotate(p.strapLocal, k.rearAngle), T = k.cable.transverseLength, dx = k.cable.dx;
    const gradient = [(-T * f[0] + dx * f[1]) / k.cable.length, (-T * r[0] - dx * r[1]) / k.cable.length];
    return {kinetic, potential, energy: kinetic + potential, limbs, gradient, k};
  }

  function interval(before, after, contacts) {
    const a = state(before), b = state(after), dt = after.time - before.time;
    const contactQ = [0, 0];
    for (const r of contacts) {
      const i = r.key === 'lower' ? 0 : 1;
      contactQ[i] += r.impulse * dot(r.normal, b.limbs[i].Pq);
    }
    const inputImpulse = b.limbs.map((l, i) => l.momentum - a.limbs[i].momentum - dt * l.Tq + dt * l.Uq - contactQ[i]);
    const arms = b.gradient.map(g => -g);
    if (arms.some(v => v <= 0) || b.limbs.some(l => l.footX <= 0)) throw Error('Strap or foot moment changes direction');
    // Minimum taut-strap impulse compatible with two downward foot forces.
    // This permits a foot to absorb work while its treadle rises.
    const strapImpulse = Math.max(0, ...inputImpulse.map((Q, i) => Q / arms[i]));
    const footImpulse = inputImpulse.map((Q, i) => (arms[i] * strapImpulse - Q) / b.limbs[i].footX);
    const rising = b.limbs[0].qv >= 0 ? 0 : 1, falling = 1 - rising;
    const oneFootStrapImpulse = inputImpulse[rising] / arms[rising];
    const descendingFootImpulse = (arms[falling] * oneFootStrapImpulse - inputImpulse[falling]) / b.limbs[falling].footX;
    const inputWork = inputImpulse.reduce((s, Q, i) => s + Q * b.limbs[i].qv, 0);
    const footWork = -footImpulse.reduce((s, F, i) => s + F * b.limbs[i].footX * b.limbs[i].qv, 0);
    const dv = after.v.map((v, i) => v - before.v[i]);
    let velocityChangeLoss = .5 * masses.wheel.I * dv[0] ** 2;
    for (let i = 0; i < 2; i++) {
      const l = b.limbs[i], dqv = l.qv - a.limbs[i].qv;
      velocityChangeLoss += .5 * l.M * dqv ** 2 + l.C * dqv * dv[i + 1] + .5 * masses[l.key + 'Pawl'].I * dv[i + 1] ** 2;
    }
    const dampingWork = dt * after.v.reduce((s, v, i) => s + physics.parameters.damping[i] * v * v, 0);
    const contactVelocityWork = contacts.reduce((s, r) => s + r.impulse * (r.inputNormalVelocity + r.J.reduce((s, j, i) => s + j * after.v[i], 0)), 0);
    const change = b.energy - a.energy, residual = change - inputWork + dampingWork;
    return {change, inputWork, footWork, dampingWork, velocityChangeLoss, contactVelocityWork,
      correctedResidual: residual + velocityChangeLoss - contactVelocityWork,
      inputImpulse, strapImpulse, footImpulse, oneFootStrapImpulse, descendingFootImpulse,
      strapPowerResidual: (inputWork - footWork) / dt};
  }
  return {masses, limb, state, interval,
    qualification: 'Rigid component masses are additive lumped masses. Strap, its bonded eye tabs and pulley are ideal massless elements; friction, creep and pulley inertia are outside this loading study. An ideal constant-torque spring has energy -preload times relative pawl/arm angle.'};
}
