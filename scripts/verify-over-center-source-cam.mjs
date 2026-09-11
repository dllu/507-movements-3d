import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { sourceLayout as p, sourceCamShape, worldPoint } from '../artifacts/review/064-provisional-source-layout.mjs';
import { turnedClutchGeometry } from '../src/simulation/clutch-section-geometry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';

const study = JSON.parse(await readFile('artifacts/review/064-source-cam-study.json', 'utf8'));
const profile = sourceCamShape().getPoints(96).map(point => worldPoint(point.toArray())); profile.pop();
const shape = new THREE.Shape(profile), bore = new THREE.Path();
bore.absarc(0, 0, 0.305, 0, 2 * Math.PI, true); shape.holes.push(bore);
const cam = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false, curveSegments: 96 }));
const roller = new THREE.Mesh(turnedClutchGeometry([[0, 0.135], [0, p.rollerRadius / p.scale],
  [0.18, p.rollerRadius / p.scale], [0.18, 0.135]], { angularSegments: 768 }));
const cache = new Map();
const surface = mesh => {
  if (!cache.has(mesh.geometry)) cache.set(mesh.geometry, { solid: solidSurface(mesh.geometry),
    points: surfacePoints(mesh.geometry), tree: triangleTree(mesh.geometry) });
  return cache.get(mesh.geometry);
};
const probe = (a, b) => {
  const transform = b.matrixWorld.clone().invert().multiply(a.matrixWorld);
  const gap = meshPairDistance(surface(a).tree, surface(b).tree, transform, 2);
  let checks = 0, inside = 0, maximumDepth = 0;
  for (const [from, to] of [[a, b], [b, a]]) {
    const t = to.matrixWorld.clone().invert().multiply(from.matrixWorld);
    for (const local of surface(from).points) {
      const point = local.clone().applyMatrix4(t); checks += 1;
      if (!surface(to).solid.inside(point)) continue;
      const depth = surface(to).solid.distance(point);
      if (depth <= 1e-6) continue;
      inside += 1; maximumDepth = Math.max(maximumDepth, depth);
    }
  }
  return { gap: gap.distance, witness: gap.witness, checks, inside, maximumDepth };
};
const rows = [], pivot = worldPoint(p.followerPivot), length = study.parameters.followerLength;
for (const row of study.rows.filter((_, index) => index % 5 === 0)) {
  cam.rotation.z = row.gamma; cam.updateMatrixWorld(true);
  roller.position.set(...row.roller, 0); roller.rotation.z = row.gamma * Math.SQRT2; roller.updateMatrixWorld(true);
  const result = probe(roller, cam);
  // Recover the separating normal from actual closest triangle points. The
  // witness lies in cam coordinates because the roller is the source mesh.
  if (!result.witness) throw new Error('No finite-solid witness');
  const a = new THREE.Vector3().fromArray(result.witness.a), b = new THREE.Vector3().fromArray(result.witness.b);
  const normal = a.clone().sub(b).normalize().applyAxisAngle(new THREE.Vector3(0, 0, 1), row.gamma);
  const contact = b.clone().applyMatrix4(cam.matrixWorld);
  const r = new THREE.Vector2(row.roller[0] - pivot.x, row.roller[1] - pivot.y);
  const followerMoment = r.x * normal.y - r.y * normal.x;
  const camMoment = contact.x * normal.y - contact.y * normal.x;
  const camVelocity = new THREE.Vector2(-contact.y, contact.x);
  const followerVelocity = new THREE.Vector2(-r.y, r.x).multiplyScalar(row.followerDerivative);
  const rollerContact = a.clone().applyMatrix4(cam.matrixWorld).sub(roller.position);
  followerVelocity.add(new THREE.Vector2(-rollerContact.y, rollerContact.x).multiplyScalar(Math.SQRT2));
  const normalVelocityResidual = Math.abs(camVelocity.clone().sub(followerVelocity).dot(new THREE.Vector2(normal.x, normal.y)));
  // A unit downward force at the middle of the lever sets a positive normal
  // reaction. This force choice is a study load, not a modeled leaf spring.
  const normalForce = (length / 2 * Math.cos(row.followerAngle)) / followerMoment;
  rows.push({ gamma: row.gamma, followerAngle: row.followerAngle, ...result,
    followerMoment, camMoment, normalForce, springTorqueOnCam: -normalForce * camMoment,
    normalVelocityResidual });
}

// Finite rectangular shaft pin and an actual half-annular sleeve end. The
// contact offset includes pin width and the inner corner of the collar.
const inner = 0.305, outer = 0.425, pinWidth = 0.115, pinInner = 0.28, pinOuter = 0.55, clearance = 0.00015;
const delta = Math.asin((pinWidth / 2 + clearance) / inner);
const collarShape = new THREE.Shape();
collarShape.absarc(0, 0, outer, 0, Math.PI, false);
collarShape.lineTo(-inner, 0); collarShape.absarc(0, 0, inner, Math.PI, 0, true); collarShape.closePath();
const collar = new THREE.Mesh(new THREE.ExtrudeGeometry(collarShape, { depth: 0.15, bevelEnabled: false, curveSegments: 256 }));
const pin = new THREE.Mesh(new THREE.BoxGeometry(pinOuter - pinInner, pinWidth, 0.07));
const pinRows = [];
const testedLead = Math.PI - 2 * delta - 0.005;
for (let index = 0; index <= 64; index += 1) {
  const lead = testedLead * index / 64, angle = -delta - lead, radius = (pinInner + pinOuter) / 2;
  pin.position.set(radius * Math.cos(angle), radius * Math.sin(angle), 0.075); pin.rotation.z = angle;
  pin.updateMatrixWorld(true); collar.updateMatrixWorld(true);
  pinRows.push({ lead, ...probe(pin, collar) });
}
const summary = {
  camRollerPoses: rows.length, minimumCamRollerGap: Math.min(...rows.map(row => row.gap)),
  maximumCamRollerGap: Math.max(...rows.map(row => row.gap)),
  maximumNormalVelocityResidual: Math.max(...rows.map(row => row.normalVelocityResidual)),
  minimumNormalForce: Math.min(...rows.map(row => row.normalForce)),
  pinCollarPoses: pinRows.length, pinDrivingGap: pinRows[0].gap,
  minimumPinCollarGap: Math.min(...pinRows.map(row => row.gap)),
  availableHalfCutLead: Math.PI - 2 * delta,
  testedMaximumLead: testedLead,
  checks: [...rows, ...pinRows].reduce((sum, row) => sum + row.checks, 0),
  inside: [...rows, ...pinRows].reduce((sum, row) => sum + row.inside, 0),
};
const report = { movement: 64, status: 'isolated-source-cam-solid-study',
  method: 'Actual Float32 triangle distances and bidirectional containment for a bored source cam, finite annular roller, rectangular pin and half-annular collar. A circular-roller follower law is compared with finite-facet contact-normal velocities, including a test roller spin of sqrt(2) radians per cam radian. A unit downward middle-lever load gives the compressive reaction using closest-solid witnesses. This does not yet include physical no-slip roller spin, the worm pair, full spring, bearings, finite snap dynamics or complete model.',
  summary, parameters: { inner, outer, pinWidth, pinInner, pinOuter, clearance, delta }, rows, pinRows };
await writeFile('artifacts/review/064-source-cam-solids.json', JSON.stringify(report, null, 2) + '\n');
console.log(summary);
if (summary.inside || summary.minimumCamRollerGap <= 1e-6 || summary.minimumPinCollarGap <= 1e-6
  || summary.minimumNormalForce <= 0 || summary.availableHalfCutLead <= study.snapAngle
  || summary.maximumNormalVelocityResidual > 0.01) process.exitCode = 1;
