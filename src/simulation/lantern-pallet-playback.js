import { lanternMotion297 as bake } from './baked/lantern-escapement-motion.js';
import { armState297, finiteContacts297, lanternContact297 as c } from './lantern-pallet-contact.js';
export { bake as lanternBake297 };
export function lanternState297(time) {
  time += 3; // Start with arm A at the engraving angle; preserve the native orbit.
  const cycleIndex = Math.floor(time / c.period), local = time - cycleIndex * c.period;
  const step = bake.metadata.sampleStep, i = Math.min(bake.angles.length - 2, Math.floor(local / step)), u = (local - i * step) / step;
  const a = bake.angles[i], b = bake.angles[i + 1], av = bake.slopes[i] * step, bv = bake.slopes[i + 1] * step;
  const wheelAngle = (2*u**3-3*u*u+1)*a+(u**3-2*u*u+u)*av+(-2*u**3+3*u*u)*b+(u**3-u*u)*bv+cycleIndex*c.pitch;
  const wheelAngularSpeed = ((6*u*u-6*u)*a+(3*u*u-4*u+1)*av+(-6*u*u+6*u)*b+(3*u*u-2*u)*bv)/step;
  const wheelAngularAcceleration = ((12*u-6)*a+(6*u-4)*av+(-12*u+6)*b+(6*u-2)*bv)/(step*step);
  const arm = armState297(time), contact = finiteContacts297(wheelAngle, arm.angle)[0], contactActive = contact.gap < .0003;
  return { wheelAngle, wheelAngularSpeed, wheelAngularAcceleration,
    armAngle: arm.angle, armAngularSpeed: arm.speed, armAngularAcceleration: arm.acceleration,
    cycleIndex, cyclePhase: local/c.period, contactActive, contact: contactActive ? contact : null,
    activePalletName: contactActive ? contact.bar : null, activeTrundleIndex: contact.pin,
    stage: contactActive ? `pallet-${contact.bar}-${contact.end ? 'finite-end' : 'face'}-contact` : 'inertial-free-drop',
  };
}
