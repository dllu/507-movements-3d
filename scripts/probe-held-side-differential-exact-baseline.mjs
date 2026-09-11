import { readFile, writeFile } from 'node:fs/promises';
import { createMovementModel } from '../src/simulation/registry.js';
import { triangleTree, meshPairDistance } from './lib/star-mangle-pair-distance.mjs';
const catalog = JSON.parse(await readFile('src/data/movements.json', 'utf8'));
const model = createMovementModel(catalog.movements[60]), b = model.root.userData.blocks;
model.update(0); model.root.updateMatrixWorld(true);
const shaft = b.outputShaft.userData.rotor.children.find(mesh => mesh.isMesh);
const axle = b.planetAxle.userData.rotor.children.find(mesh => mesh.isMesh);
const arm = b.carrierArm.children.find(mesh => mesh.geometry?.type === 'BoxGeometry');
const pairs = [['planet-axle/output-shaft', axle, shaft], ['carrier-arm/output-shaft', arm, shaft],
  ['brake-drum/output-shaft', b.brakeDrum, shaft], ['friction-curb/brake-drum', b.curbRing, b.brakeDrum]];
const rows = pairs.map(([name, a, c]) => ({ name, ...meshPairDistance(triangleTree(a.geometry), triangleTree(c.geometry),
  c.matrixWorld.clone().invert().multiply(a.matrixWorld), 0.01) }));
await writeFile('artifacts/review/061-exact-hardware-baseline.json', JSON.stringify({
  method: 'Actual 3D triangle distance including edge/edge and segment/face intersection at the initial pose. This catches crossed shaft surfaces between sparse surface samples. These selected pairs do not cover all hardware.', rows,
}, null, 2) + '\n');
console.log(JSON.stringify(rows.map(({ name, distance, testedTriangles }) => ({ name, distance, testedTriangles }))));
