import {add, sub, rotate} from '../../src/simulation/finite-plate-geometry.js';
import {dot, mul} from '../../src/simulation/finite-polygon-contact.js';
const tangent = p => [-p[1], p[0]];

// Exact differentiation of the constant strap length and both rigid rods.
export function makeTreadleRatchetInput(linkage) {
  const p = linkage.parameters, omega = 2 * Math.PI / p.period;
  return time => {
    const state = linkage.atTime(time), phase = omega * time + p.sourcePhase;
    const frontVelocity = -p.amplitude * omega * Math.sin(phase);
    const frontAcceleration = -p.amplitude * omega * omega * Math.cos(phase);
    const f = rotate(p.strapLocal, state.frontAngle), r = rotate(p.strapLocal, state.rearAngle);
    const T = state.cable.transverseLength, dx = state.cable.dx;
    const Tf = -f[0], Tr = -r[0], Df = f[1], Dr = -r[1];
    const Ff = T * Tf + dx * Df, Fr = T * Tr + dx * Dr;
    const Fff = Tf * Tf + T * f[1] + Df * Df + dx * f[0];
    const Frr = Tr * Tr + T * r[1] + Dr * Dr - dx * r[0];
    const Ffr = Tf * Tr + Df * Dr;
    const rearVelocity = -Ff / Fr * frontVelocity;
    const rearAcceleration = -(Ff * frontAcceleration + Fff * frontVelocity ** 2
      + 2 * Ffr * frontVelocity * rearVelocity + Frr * rearVelocity ** 2) / Fr;
    const treadleVelocity = [frontVelocity, rearVelocity];
    const treadleAcceleration = [frontAcceleration, rearAcceleration];
    const pawls = state.arms.map((a, i) => {
      const b = sub(a.bottom, p.fulcrum), Bv = mul(tangent(b), treadleVelocity[i]);
      const Ba = sub(mul(tangent(b), treadleAcceleration[i]), mul(b, treadleVelocity[i] ** 2));
      const D = sub(a.top, a.bottom), denominator = dot(D, tangent(a.top));
      const armVelocity = dot(D, Bv) / denominator;
      const relativeVelocity = sub(mul(tangent(a.top), armVelocity), Bv);
      const armAcceleration = (dot(D, add(Ba, mul(a.top, armVelocity ** 2)))
        - dot(relativeVelocity, relativeVelocity)) / denominator;
      return {key: a.name, pivot: a.pawlPivot, armAngle: a.armAngle, armVelocity, armAcceleration,
        velocity: mul(tangent(a.pawlPivot), armVelocity),
        acceleration: sub(mul(tangent(a.pawlPivot), armAcceleration), mul(a.pawlPivot, armVelocity ** 2))};
    });
    return {...state, treadleVelocity, treadleAcceleration, pawls};
  };
}
