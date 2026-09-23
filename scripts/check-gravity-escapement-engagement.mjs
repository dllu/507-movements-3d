// Checks that the swept-cut working plates still do their job: at a sampled
// lock or lift state, advancing the driver (a tooth tip, or a pin disc of the
// given radius) a little further along its wheel circle, with the pallets
// held, must carry it into a baked working plate that shares its z range. A
// cut that had eaten the stop or lift face reports no plate.
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const inside = (ring, [x, y]) => {
  let crossing = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) crossing = !crossing;
  }
  return crossing;
};

// contacts: {label: {point: Vector2, z: [z0, z1], radius}}. Returns, per
// label and plate key, the smallest driver advance (radians) that enters the
// plate outline.
export function engagementAt(model, time, { advanceSign, contacts, maxAdvance = 0.08, steps = 320 }) {
  const { root } = model;
  model.update(time, 0.016);
  root.updateMatrixWorld(true);
  const center = root.userData.geometry.wheelCenter;
  const owner = new THREE.Vector3();
  const result = {};
  for (const [label, contact] of Object.entries(contacts)) {
    if (!contact?.point) continue;
    const { point, radius = 0, z } = contact;
    const orbit = Math.hypot(point.x - center.x, point.y - center.y);
    const angle = Math.atan2(point.y - center.y, point.x - center.x);
    const rim = radius > 0
      ? Array.from({ length: 24 }, (_, k) => [radius * Math.cos(k * Math.PI / 12), radius * Math.sin(k * Math.PI / 12)])
      : [[0, 0]];
    for (const plate of root.userData.sweptPlates) {
      if (!plate.outline?.length) continue;
      plate.owner.getWorldPosition(owner);
      if (owner.z + plate.z1 < z[0] || owner.z + plate.z0 > z[1]) continue;
      const inverse = new THREE.Matrix4().copy(plate.owner.matrixWorld).invert();
      let entry = null;
      for (let step = 0; step <= steps && entry === null; step += 1) {
        const advance = maxAdvance * step / steps;
        const a = angle + advanceSign * advance;
        const cx = center.x + orbit * Math.cos(a);
        const cy = center.y + orbit * Math.sin(a);
        for (const [dx, dy] of rim) {
          const q = new THREE.Vector3(cx + dx, cy + dy, 0).applyMatrix4(inverse);
          if (inside(plate.outline, [q.x, q.y])) { entry = advance; break; }
        }
      }
      if (entry !== null) (result[label] ??= {})[plate.key] = entry;
    }
  }
  return result;
}

const segmentDistance = ([px, py], [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

// Signed gap from each driver's surface to the nearest z-overlapping baked
// plate: positive is running clearance, negative is overlap.
export function contactGapsAt(model, time, { contacts }) {
  const { root } = model;
  model.update(time, 0.016);
  root.updateMatrixWorld(true);
  const owner = new THREE.Vector3();
  const gaps = {};
  for (const [label, contact] of Object.entries(contacts)) {
    if (!contact?.point) continue;
    let best = { gap: Infinity, key: null };
    for (const plate of root.userData.sweptPlates) {
      if (!plate.outline?.length) continue;
      plate.owner.getWorldPosition(owner);
      if (owner.z + plate.z1 < contact.z[0] || owner.z + plate.z0 > contact.z[1]) continue;
      const q = new THREE.Vector3(contact.point.x, contact.point.y, 0)
        .applyMatrix4(new THREE.Matrix4().copy(plate.owner.matrixWorld).invert());
      const ring = plate.outline;
      let distance = Infinity;
      for (let i = 0; i < ring.length; i += 1) distance = Math.min(distance, segmentDistance([q.x, q.y], ring[i], ring[(i + 1) % ring.length]));
      const gap = (inside(ring, [q.x, q.y]) ? -distance : distance) - (contact.radius ?? 0);
      if (gap < best.gap) best = { gap, key: plate.key };
    }
    gaps[label] = best;
  }
  return gaps;
}

export function formatEngagement(hits) {
  return Object.entries(hits).map(([label, plates]) => `${label}: ${Object.entries(plates)
    .map(([key, a]) => `${key}@${THREE.MathUtils.radToDeg(a).toFixed(2)}deg`).join(', ')}`).join(' | ') || 'none';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [id, ...phases] = process.argv.slice(2).map(Number);
  const { createGravityEscapementModel } = await import('./generate-gravity-escapement-plates.mjs');
  const model = await createGravityEscapementModel(id);
  const { engagementContacts, geometry, stateAtTime } = model.root.userData;
  for (const phase of phases) {
    const time = phase * geometry.pendulumPeriod;
    const state = stateAtTime(time);
    const { advanceSign, contacts } = engagementContacts(state);
    const gaps = Object.entries(contactGapsAt(model, time, { contacts }))
      .map(([label, { gap, key }]) => `${label} gap ${gap.toFixed(4)} to ${key}`).join(', ');
    console.log(`${id} phase ${phase.toFixed(3)} ${state.mode}: ${formatEngagement(engagementAt(model, time, { advanceSign, contacts }))}${gaps ? ` [${gaps}]` : ''}`);
  }
}
