import fs from 'node:fs';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {freezeStudySources} from './lib/study-report-io.mjs';

const catalog = JSON.parse(fs.readFileSync('src/data/movements.json'));
const model = createMovementModel(catalog.movements[88]); model.update(0); model.root.updateMatrixWorld(true);
const u = model.root.userData, b = u.blocks;
const bounds = part => new THREE.Box3().setFromObject(part, true);
const ringBounds = bounds(b.leftStrapHalf).union(bounds(b.rightStrapHalf));
const center = b.strap.getWorldPosition(new THREE.Vector3());
// Approximate manual ink extents in the opened 525-pixel engraving. This is
// one front-view similarity registration, not an optimized 3D camera fit.
const source = {width: 525, height: 525, uncertaintyPixels: 3,
  ring: {left: 92, right: 350, top: 179, bottom: 399}, center: [221, 289],
  shaft: [159, 289], capWidth: 83, upperLugWidth: 104, flangeHeight: 130};
const scale = (source.ring.right - source.ring.left) / (ringBounds.max.x - ringBounds.min.x);
const project = point => [source.center[0] + (point.x - center.x) * scale,
  source.center[1] - (point.y - center.y) * scale];
const shaft = project(b.input.getWorldPosition(new THREE.Vector3()));
const upperLugs = b.strapLugs.filter(o => o.position.y > 0).map(bounds).reduce((a, b) => a.union(b));
const size = part => bounds(part).getSize(new THREE.Vector3());
const measurements = {
  shaft: {source: source.shaft, rendered: shaft, distancePixels: Math.hypot(shaft[0] - source.shaft[0], shaft[1] - source.shaft[1])},
  capWidth: {source: source.capWidth, rendered: size(b.shaftCap).x * scale},
  upperLugWidth: {source: source.upperLugWidth, rendered: (upperLugs.max.x - upperLugs.min.x) * scale},
  flangeHeight: {source: source.flangeHeight, rendered: size(b.outerCouplingPlate).y * scale},
  ringHeight: {source: source.ring.bottom - source.ring.top, rendered: (ringBounds.max.y - ringBounds.min.y) * scale},
};
const prefix = 'artifacts/review/089-joints-source-measurements';
const sources = freezeStudySources(['scripts/measure-eccentric-strap-source.mjs', 'src/simulation/authored-cams.js',
  'src/simulation/eccentric-strap-joints.js', 'public/engravings/mm_089.png'], prefix);
fs.writeFileSync(prefix + '.json', JSON.stringify({movement: 89, sources, source, scale, measurements,
  qualified: false, limitation: 'Manual ink extents and a single front-view registration. The source projection, strap proportions and hidden output construction need further reconstruction.'}, null, 2) + '\n', {flag: 'wx'});
console.log(measurements);
