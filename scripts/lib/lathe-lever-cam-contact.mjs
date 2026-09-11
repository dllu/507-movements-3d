import * as THREE from 'three';
import { extrudedLoops } from './lathe-lever-boundary.mjs';
import { boundaryIndex, planarPairDistance } from './coaxial-planar-distance.mjs';

export function camContactSamples(model, count = 65) {
  const { parts, geometry: p } = model.root.userData;
  const loops = extrudedLoops(parts.leverPlate).sort((a, b) => Math.abs(THREE.ShapeUtils.area(b)) - Math.abs(THREE.ShapeUtils.area(a)));
  const slot = boundaryIndex(loops[1]), center = new THREE.Vector2(p.camEccentricX, p.camEccentricY);
  const wall = outside => ({ ...slot, cells: new Map([...slot.cells].map(([key, segments]) => [key, segments.filter(s => {
    const radius = Math.hypot((s.a.x + s.b.x) / 2 - center.x, (s.a.y + s.b.y) / 2 - center.y);
    return outside ? radius > p.camRadius + p.followerRadius * 0.9 : radius < p.camRadius - p.followerRadius * 0.9;
  })])) });
  const targets = [wall(true), wall(false)], attr = parts.outputShaft.geometry.attributes.position, vertices = new Map();
  parts.outputShaft.geometry.computeBoundingBox(); const cap = parts.outputShaft.geometry.boundingBox.max.y;
  for (let i = 0; i < attr.count; i += 1) if (attr.getY(i) === cap && Math.hypot(attr.getX(i), attr.getZ(i)) > 0.01) {
    const v = new THREE.Vector3().fromBufferAttribute(attr, i); vertices.set(`${v.x},${v.z}`, v);
  }
  const contour = [...vertices.values()].sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  const report = { method: 'Actual Float32 shaft and active cam-wall segments; unit compressive contact force and quasi-static work balance. No load inertia or friction is assumed.', poses: [] };
  for (let branch = 0; branch < 2; branch += 1) for (let i = 0; i < count; i += 1) {
    const time = (branch ? 2 * p.runDuration + p.shiftDuration : p.runDuration) + p.shiftDuration * (i + 0.5) / count;
    model.update(time); model.root.updateMatrixWorld(true);
    const state = model.root.userData.kinematics;
    const transform = parts.leverPlate.matrixWorld.clone().invert().multiply(parts.outputShaft.matrixWorld);
    const points = contour.map(v => v.clone().applyMatrix4(transform));
    const result = planarPairDistance(points, targets[branch], new THREE.Matrix4(), 0.001);
    if (!result.witness || result.distance <= 1e-6) throw new Error(`Missing cam clearance at ${time}`);
    const { a, b } = result.witness, nx = (a.x - b.x) / result.distance, ny = (a.y - b.y) / result.distance;
    const forceX = nx * Math.cos(state.leverAngle) - ny * Math.sin(state.leverAngle);
    const inputTorque = b.x * ny - b.y * nx;
    const inputPower = inputTorque * state.leverAngularSpeed, outputPower = forceX * state.outputLinearSpeed;
    report.poses.push({ time, branch: state.branch, gap: result.distance, intersections: result.intersections,
      inputTorque, forceX, inputPower, outputPower,
      relativePowerResidual: Math.abs(inputPower - outputPower) / Math.max(Math.abs(inputPower), Math.abs(outputPower)) });
  }
  report.summary = { poses: report.poses.length, minimumGap: Math.min(...report.poses.map(v => v.gap)), maximumGap: Math.max(...report.poses.map(v => v.gap)),
    intersections: report.poses.reduce((sum, v) => sum + v.intersections, 0),
    minimumInputPower: Math.min(...report.poses.map(v => v.inputPower)), minimumOutputPower: Math.min(...report.poses.map(v => v.outputPower)),
    maximumPowerResidual: Math.max(...report.poses.map(v => v.relativePowerResidual)) };

  return report;
}
