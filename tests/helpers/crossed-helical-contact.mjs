import * as THREE from 'three';
import { helicalSurfaceQuery, helicalSurfaceSamples } from './helical-surface.mjs';

export function probeCrossedHelicalContact(model, poses = 64) {
  const gears = [model.root.userData.blocks.driver, model.root.userData.blocks.driven];
  const queries = gears.map((gear) => helicalSurfaceQuery(gear.userData.body.geometry));
  const clouds = gears.map((gear) => helicalSurfaceSamples(gear.userData.body.geometry));
  const point = new THREE.Vector3();
  let maxPenetration = 0, maxGap = 0, worst = null, checked = 0;
  const gaps = [];
  for (let sample = 0; sample < poses; sample += 1) {
    model.update(model.root.userData.geometry.inputPeriod / gears[0].userData.teeth * (sample + 0.173) / poses, 0);
    model.root.updateMatrixWorld(true);
    let gap = Infinity;
    for (const side of [0, 1]) {
      const mate = gears[1 - side].userData;
      const transform = mate.rotor.matrixWorld.clone().invert().multiply(gears[side].userData.rotor.matrixWorld);
      for (const p of clouds[side]) {
        point.copy(p).applyMatrix4(transform);
        if (Math.abs(point.z) > mate.faceWidth / 2
          || point.x * point.x + point.y * point.y > (mate.tipRadius + 0.002) ** 2) continue;
        const hit = queries[1 - side].radial(point);
        if (!hit) continue;
        checked += 1;
        if (hit.penetration > maxPenetration) {
          maxPenetration = hit.penetration;
          worst = { sample, side, point: p.toArray(), mateLocal: point.toArray(), hit };
        }
        if (Math.abs(hit.penetration) < 0.01) gap = Math.min(gap, queries[1 - side].distance(point, hit));
      }
    }
    maxGap = Math.max(maxGap, gap);
    gaps.push(gap);
  }
  return { poses, checked, maxPenetration, maxGap, gaps, worst };
}
