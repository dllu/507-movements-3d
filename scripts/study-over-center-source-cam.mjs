import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { sourceLayout as p, sourceCamShape, worldPoint } from '../artifacts/review/064-provisional-source-layout.mjs';

const turn = Math.PI * 2, pivot = worldPoint(p.followerPivot), initialRoller = worldPoint(p.roller);
const length = initialRoller.distanceTo(pivot), rollerRadius = p.rollerRadius / p.scale;
const profile = sourceCamShape().getPoints(96).map(point => worldPoint(point.toArray()));
profile.pop();
const shape = new THREE.Shape(profile);
const bore = new THREE.Path(); bore.absarc(0, 0, 0.305, 0, turn, true); shape.holes.push(bore);
const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false, curveSegments: 96 });
// Recover the actual Float32 outer boundary, rather than validating only the
// double-precision curve from which the solid was constructed.
const attr = geometry.attributes.position, outer = new Map();
for (let index = 0; index < attr.count; index += 1) {
  if (attr.getZ(index) !== 0) continue;
  const x = attr.getX(index), y = attr.getY(index);
  if (Math.hypot(x, y) < 0.4) continue;
  outer.set(`${x},${y}`, new THREE.Vector2(x, y));
}
const points = [...outer.values()].sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
const nearest = (point, gamma) => {
  const c = Math.cos(gamma), s = Math.sin(gamma);
  const local = new THREE.Vector2(point.x * c + point.y * s, -point.x * s + point.y * c);
  let result = { distance: Infinity };
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index], b = points[(index + 1) % points.length], d = b.clone().sub(a);
    const t = THREE.MathUtils.clamp(local.clone().sub(a).dot(d) / d.lengthSq(), 0, 1);
    const q = a.clone().addScaledVector(d, t), distance = q.distanceTo(local);
    if (distance < result.distance) result = { distance, local: q, segment: index, parameter: t,
      contact: new THREE.Vector2(q.x * c - q.y * s, q.x * s + q.y * c) };
  }
  return result;
};
const clearance = 0.00015;
const followerAt = gamma => {
  const center = angle => pivot.clone().add(new THREE.Vector2(length * Math.cos(angle), length * Math.sin(angle)));
  const gap = angle => nearest(center(angle), gamma).distance - rollerRadius;
  let high = 0.35;
  // Descend from above the cam and use the first supporting contact. Scanning
  // is necessary because unsigned distance alone also admits a point below it.
  let low = high - 0.002;
  while (low > -0.6 && gap(low) > clearance) { high = low; low -= 0.002; }
  if (low <= -0.6) throw new Error(`No follower support at cam angle ${gamma}`);
  for (let iteration = 0; iteration < 38; iteration += 1) {
    const middle = (low + high) / 2;
    if (gap(middle) >= clearance) high = middle; else low = middle;
  }
  const roller = center(high), hit = nearest(roller, gamma), normal = roller.clone().sub(hit.contact).normalize();
  const lever = roller.clone().sub(pivot), camTorquePerNormalForce = -hit.contact.cross(normal);
  const followerTorquePerNormalForce = lever.cross(normal);
  const derivative = hit.contact.cross(normal) / followerTorquePerNormalForce;
  return { gamma, followerAngle: high, roller: roller.toArray(), contact: hit.contact.toArray(),
    normal: normal.toArray(), gap: hit.distance - rollerRadius,
    segment: hit.segment, contactParameter: hit.parameter,
    camTorquePerNormalForce, followerTorquePerNormalForce, followerDerivative: derivative };
};
const count = 720, rows = [];
for (let i = 0; i <= count; i += 1) {
  rows.push(followerAt(i / count * turn));
  if (i % 180 === 0) console.log({ phase: i / count });
}
const maximum = rows.reduce((a, b) => b.followerAngle > a.followerAngle ? b : a);
const minimum = rows.reduce((a, b) => b.followerAngle < a.followerAngle ? b : a);
const refine = (center, sign) => {
  let a = center - turn / count, b = center + turn / count;
  for (let i = 0; i < 42; i += 1) {
    const l = (2 * a + b) / 3, r = (a + 2 * b) / 3;
    if (sign * followerAt(l).followerAngle < sign * followerAt(r).followerAngle) a = l; else b = r;
  }
  return followerAt((a + b) / 2);
};
const crest = refine(maximum.gamma, 1), trough = refine(minimum.gamma, -1);
const snapAngle = THREE.MathUtils.euclideanModulo(trough.gamma - crest.gamma, turn);
const report = { movement: 64, status: 'provisional-source-cam-contact-study',
  method: 'Finite circular roller against the actual Float32 outer boundary of a source-traced bored cam extrusion. A fixed-length follower descends to the first support component. Contact-normal virtual work gives the cam torque sign and follower derivative. This is an isolated geometric study: spring shape, finite snap dynamics, driving pin/collar, worm pair and other 3D hardware are not yet included.',
  parameters: { ...p, pivot: pivot.toArray(), followerLength: length, rollerRadius, clearance, profileVertices: points.length },
  sourcePose: rows[0], crest, trough, snapAngle, snapDegrees: snapAngle * 180 / Math.PI,
  halfCutMargin: Math.PI - snapAngle,
  minimumGap: Math.min(...rows.map(row => row.gap)), maximumGap: Math.max(...rows.map(row => row.gap)),
  minimumFollowerContactMoment: Math.min(...rows.map(row => row.followerTorquePerNormalForce)),
  rows,
};
await writeFile('artifacts/review/064-source-cam-study.json', JSON.stringify(report, null, 2) + '\n');
const image = (await readFile('artifacts/reference/brown-064-detail.png')).toString('base64');
const svgPath = sourceCamShape().getPoints(96).map((point, i) => `${i ? 'L' : 'M'}${point.x},${point.y}`).join(' ') + ' Z';
await writeFile('artifacts/review/064-source-tracing.html', `<!doctype html><meta charset="utf-8"><title>064 provisional source cam trace</title>
<style>body{margin:0;background:#f5f1e7;font:18px system-ui}p{margin:18px}svg{display:block;max-height:90vh;margin:auto}label{margin:18px}</style>
<p>064 · Provisional cam trace over the unchanged engraving. This is a construction study.</p>
<label><input type="checkbox" checked onchange="document.getElementById('trace').style.display=this.checked?'':'none'"> Show trace</label>
<svg viewBox="0 0 1320 1250" xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,${image}" width="1320" height="1250"/>
<g id="trace" stroke="#007da8" stroke-width="4" fill="#009bcc" fill-opacity=".18"><path d="${svgPath}"/>
<circle cx="1010" cy="759" r="61" fill="none"/><circle cx="1070" cy="387" r="46" fill="none"/>
<path d="M56 383 L1070 387"/><circle cx="56" cy="383" r="10"/></g></svg>`);
console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
