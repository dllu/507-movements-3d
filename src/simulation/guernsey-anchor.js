// Movement 402: Guernsey's anchor A and escape wheel as finite plates in one
// plane. The wheel is driven forward and is stopped, pushed back (recoil) or
// released only by contact with the anchor's two pallets, whose motion is
// that of lever B. The wheel angle is found by stepping that contact through
// one lever period (resting continuation), so lock, impulse and drop are
// what the drawn outlines do, not a timetable.
import {polygonsOverlap} from './lifting-jack-contact.js';

const rot = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)];

export function guernseyAnchorDesign({wheelCenter, tipRadius, rootRadius, teeth}) {
  const pitch = 2 * Math.PI / teeth;
  // Ratchet teeth leaning forward (clockwise): the tip leads both roots.
  const tooth = (i) => [polar(rootRadius, (i + 0.62) * pitch), polar(tipRadius, i * pitch), polar(rootRadius, (i + 0.10) * pitch)];
  const toothTriangles = Array.from({length: teeth}, (_, i) => tooth(i));
  const toPivot = Math.atan2(-wheelCenter[1], -wheelCenter[0]);
  const span = 2.5 * pitch;
  const lockDepth = 0.07, rise = 0.035, impulseAngle = 0.09, back = 0.13;
  // A pallet at wheel angle psi: radial locking face facing the arriving
  // teeth, an inclined impulse face running forward and outward.
  const pallet = (psi, midOffset) => {
    const at = ([x, y]) => [x + wheelCenter[0], y + wheelCenter[1]];
    const A = at(polar(tipRadius - lockDepth + midOffset, psi));
    const B = at(polar(tipRadius - lockDepth + midOffset + rise, psi - impulseAngle));
    // Dead-beat locking face: along A's own path about the anchor pivot, so
    // deepening the lock neither pushes the wheel back nor lets it on.
    let u = [-A[1], A[0]];
    const outward = [A[0] - wheelCenter[0], A[1] - wheelCenter[1]];
    if (u[0] * outward[0] + u[1] * outward[1] < 0) u = [-u[0], -u[1]];
    const n = Math.hypot(...u);
    const L1 = [A[0] + back * 1.4 * u[0] / n, A[1] + back * 1.4 * u[1] / n];
    const L2 = at(polar(tipRadius + back, psi - impulseAngle - 0.03));
    return [L1, A, B, L2];
  };
  const upperPsi = toPivot - span / 2, lowerPsi = toPivot + span / 2;
  return {pitch, toothTriangles, upperPsi, lowerPsi, toPivot, span, lockDepth, rise, impulseAngle,
    palletsAtMid: (swing) => ({upper: pallet(upperPsi, swing), lower: pallet(lowerPsi, swing)})};
}

// Wheel-local teeth vs anchor-local pallets, both placed in the lever-pivot
// frame (pivot at origin).
export function wheelClear(design, wheelCenter, wheelAngle, pallets, leverAngle) {
  const posed = pallets.map((polygon) => polygon.map((p) => rot(p, leverAngle)));
  for (const triangle of design.toothTriangles) {
    const t = triangle.map((p) => { const q = rot(p, wheelAngle); return [q[0] + wheelCenter[0], q[1] + wheelCenter[1]]; });
    for (const polygon of posed) if (polygonsOverlap(t, polygon, 1e-9)) return false;
  }
  return true;
}

// Step the forward-driven wheel through one period of the lever. Forward
// (clockwise, decreasing angle) motion is limited to dropSpeed; when a pallet
// moves into a tooth the wheel is pushed back to the nearest clear angle.
export function continueWheel({design, wheelCenter, pallets, leverAngleAt, period, startAngle, samples = 2048, dropSpeed = 2.5}) {
  const dt = period / samples, times = [0], angles = [startAngle], contact = [];
  let w = startAngle;
  const bisect = (bad, good, clear) => { for (let i = 0; i < 40; i++) { const m = (bad + good) / 2; if (clear(m)) good = m; else bad = m; } return good; };
  for (let i = 1; i <= samples; i++) {
    const t = i * dt, lever = leverAngleAt(t), clear = (a) => wheelClear(design, wheelCenter, a, pallets, lever);
    if (!clear(w)) {
      let k = 1, back = null;
      while (back === null) { const a = w + k * 2e-4; if (clear(a)) back = bisect(a - 2e-4, a, clear); k++; if (k > 5000) throw new Error('402 wheel cannot recoil clear'); }
      w = back;
    } else {
      const limit = w - dropSpeed * dt, steps = 24;
      let last = w;
      for (let j = 1; j <= steps; j++) {
        const next = w + (limit - w) * j / steps;
        if (!clear(next)) { last = bisect(next, last, clear); break; }
        last = next;
      }
      w = last;
    }
    times.push(t); angles.push(w);
  }
  return {times, angles};
}

// Shared constants of the reconstruction (lever pivot at the origin).
export const guernsey402 = Object.freeze({
  wheelCenter: [1.476, -1.008],
  tipRadius: 0.91,
  rootRadius: 0.70,
  teeth: 15,
  leverAmplitude: 4.2 * Math.PI / 180,
  period: 4,
  palletSwing: 0.065,
  dropSpeed: 2.5,
  samples: 2048,
});
export const guernsey402Design = () => guernseyAnchorDesign(guernsey402);
export const guernsey402Lever = (t) => guernsey402.leverAmplitude * Math.cos(Math.PI * t / 2);
export function guernsey402Pallets(design = guernsey402Design()) {
  const p = design.palletsAtMid(guernsey402.palletSwing);
  return [p.upper, p.lower];
}
// Settle from a clear start through one period, then record the next period,
// whose end state is the start state one pitch on.
export function bakeGuernsey402() {
  const design = guernsey402Design(), pallets = guernsey402Pallets(design), O = guernsey402.wheelCenter;
  const clear = (a) => wheelClear(design, O, a, pallets, guernsey402Lever(0));
  let a = 0; while (!clear(a)) a += 1e-3;
  for (let i = 0; i < 4000 && clear(a - 5e-4); i++) a -= 5e-4;
  const settle = continueWheel({design, wheelCenter: O, pallets, leverAngleAt: guernsey402Lever, period: guernsey402.period, startAngle: a, samples: guernsey402.samples, dropSpeed: guernsey402.dropSpeed});
  const run = continueWheel({design, wheelCenter: O, pallets, leverAngleAt: guernsey402Lever, period: guernsey402.period, startAngle: settle.angles.at(-1), samples: guernsey402.samples, dropSpeed: guernsey402.dropSpeed});
  const start = run.angles[0], closure = run.angles.at(-1) - (start - design.pitch);
  // Remove the bisection residue so the loop closes exactly.
  const angles = run.angles.map((w, i) => w - closure * i / (run.angles.length - 1));
  return {period: guernsey402.period, pitch: design.pitch, closureCorrection: closure, angles: angles.map((v) => Number(v.toFixed(12)))};
}

// Replace the escape wheel and anchor meshes of the 402 model by the two
// finite plates above and drive the wheel from the baked continuation.
export function rebuildGuernseyAnchor(model, {THREE, plate, poly, circle, capsule, clip, bake}) {
  const {root} = model, d = root.userData, b = d.blocks;
  const design = guernsey402Design(), pallets = guernsey402Pallets(design), O = guernsey402.wheelCenter;
  const wheelZ = 0.25, halfDepth = 0.09, leverZ = b.compoundLever.position.z;
  // Escape wheel: one plate, fifteen forward-leaning teeth on a solid web.
  const wheelShape = clip.difference(
    clip.union(poly(circle([0, 0], guernsey402.rootRadius + 0.004, 180)), ...design.toothTriangles.map((t) => poly(t))),
    poly(circle([0, 0], 0.079, 64)),
  );
  const rotor = b.escapeWheelRotor, wheelMaterial = b.escapeWheelRim.material;
  for (const mesh of [...b.escapeWheelTeeth, ...(b.escapeWheelFeet ?? []), b.escapeWheelRim, b.escapeWheelWeb, ...b.escapeWheelSpokes]) if (mesh) mesh.parent?.remove(mesh);
  const wheelPlate = new THREE.Mesh(plate(wheelShape, -halfDepth, halfDepth), wheelMaterial);
  wheelPlate.userData.role = 'escape-wheel-single-plate-with-fifteen-teeth';
  rotor.add(wheelPlate);
  // Anchor A: pivot boss, a curved upper arm to its pointed pallet and a
  // lower arm to its block pallet, one plate in the wheel's plane.
  const mid = (polygon, i, j) => [(polygon[i][0] + polygon[j][0]) / 2, (polygon[i][1] + polygon[j][1]) / 2];
  const [upper, lower] = pallets;
  const upperEnd = mid(upper, 0, 3), lowerEnd = mid(lower, 0, 3);
  const bend = [upperEnd[0] * 0.45 - 0.05, upperEnd[1] * 0.45 + 0.42];
  const curve = Array.from({length: 13}, (_, i) => { const t = i / 12, u = 1 - t; return [2 * u * t * bend[0] + t * t * upperEnd[0], 2 * u * t * bend[1] + t * t * upperEnd[1]]; });
  const anchorShape = clip.difference(clip.union(
    poly(circle([0, 0], 0.27, 96)), poly(upper), poly(lower),
    ...curve.slice(1).map((p, i) => capsule(curve[i], p, 0.075, 12)),
    capsule([0, 0], lowerEnd, 0.085, 16),
  ), poly(circle([0, 0], 0.192, 96)));
  for (const mesh of [...b.palletBodies, ...b.anchorArms, ...b.palletWorkingEdges]) mesh.parent?.remove(mesh);
  const anchor = new THREE.Mesh(plate(anchorShape, wheelZ - halfDepth - leverZ, wheelZ + halfDepth - leverZ), b.anchorArms[0].material);
  anchor.userData.role = 'anchor-A-single-plate-with-both-pallets';
  b.compoundLever.add(anchor);
  b.anchorPlate = anchor; b.escapeWheelPlate = wheelPlate;
  b.palletBodies = [anchor]; b.anchorArms = [];

  const pitch = design.pitch, n = bake.angles.length - 1;
  const wheelAt = (time) => {
    const cycle = Math.floor(time / bake.period), x = (time - cycle * bake.period) / bake.period * n;
    const i = Math.min(n - 1, Math.floor(x)), f = x - i;
    return {angle: bake.angles[i] + (bake.angles[i + 1] - bake.angles[i]) * f - cycle * pitch,
      speed: (bake.angles[i + 1] - bake.angles[i]) / (bake.period / n)};
  };
  const contactAt = (wheelAngle, leverAngle) => {
    const probe = (polys) => !wheelClear(design, O, wheelAngle - 2e-6, polys, leverAngle);
    for (const [side, polygon] of [['upper', upper], ['lower', lower]]) if (probe([polygon])) return side;
    return null;
  };
  const baseState = d.stateAtTime;
  const stateAtTime = (time) => {
    const s = baseState(time), w = wheelAt(time), side = contactAt(w.angle, s.leverAngle);
    const event = side === null ? 'free-drop' : w.speed < -0.02 ? 'impulse' : w.speed > 0.02 ? 'recoil' : 'lock';
    return {...s, wheelAngle: w.angle, wheelAngularSpeed: w.speed, wheelEvent: event,
      activePalletContact: side === null ? null : {side, mode: event, finite: true}};
  };
  const baseUpdate = model.update;
  const update = (time) => {
    baseUpdate(time);
    const s = stateAtTime(time);
    rotor.rotation.z = s.wheelAngle;
    if (b.palletContactMarker) b.palletContactMarker.visible = false;
    d.kinematics = s;
    d.contacts.escapeWheelToAnchorPallet = s.activePalletContact
      ? {classification: 'finite plate contact from the baked continuation', pallet: s.activePalletContact.side, mode: s.activePalletContact.mode}
      : null;
  };
  d.stateAtTime = stateAtTime;
  d.update = update;
  d.anchorDesign402 = {design, pallets, wheelZ, halfDepth};
  d.constraints.escapement = 'The forward-driven escape wheel is stopped, pushed back or released only by contact of its teeth with the two pallets of the one-piece anchor A; the wheel angle is that contact stepped through one lever period (baked), one tooth per period.';
  d.reconstructionNote = 'Anchor A and the escape wheel are single plates in one plane: a dead-beat upper pallet and a slightly recoiling lower pallet, each with a locking face and an inclined impulse face, spanning two and a half teeth. Lever and balance timing is prescribed; the wheel follows the drawn outlines by contact, with a bounded drop speed. Tooth and pallet proportions are reconstructed.';
  model.update = update;
  update(0);
  return model;
}
