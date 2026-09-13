import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {freezeStudySources} from './lib/study-report-io.mjs';

const catalog = JSON.parse(fs.readFileSync('src/data/movements.json'));
const model = createMovementModel(catalog.movements[88]), u = model.root.userData, g = u.geometry;
const bounds = new THREE.Box3(), point = new THREE.Vector3(), steps = 512;
let maximumVertexSpeed = 0;
// |v| <= e*w + r*e*w/sqrt(L^2-e^2) for every rigid strap vertex.
// This bounds travel between the grid and its nearest sample, including
// unsampled extrema. Input and slider bounds use their corresponding speeds.
model.root.updateMatrixWorld(true);
for (const family of ['strap', 'input', 'outputSlide']) {
  const group = u.blocks[family];
  group.traverse(o => {
    const positions = o.geometry?.attributes.position; if (!positions) return;
    for (let k = 0; k < positions.count; k++) {
      point.fromBufferAttribute(positions, k).applyMatrix4(o.matrixWorld); group.worldToLocal(point);
      const speed = family === 'strap'
        ? g.eccentricity * g.inputSpeedMagnitude * (1 + Math.hypot(point.x, point.y) / Math.sqrt(g.eccentricRodLength ** 2 - g.eccentricity ** 2))
        : family === 'input' ? Math.hypot(point.x, point.y) * g.inputSpeedMagnitude
          : g.eccentricity * g.inputSpeedMagnitude * (1 + g.eccentricity / Math.sqrt(g.eccentricRodLength ** 2 - g.eccentricity ** 2));
      maximumVertexSpeed = Math.max(maximumVertexSpeed, speed);
    }
  });
}
for (let i = 0; i <= steps; i++) {
  model.update(i * g.cyclePeriod / steps); model.root.updateMatrixWorld(true);
  bounds.union(new THREE.Box3().setFromObject(model.root, true));
}
const padding = maximumVertexSpeed * g.cyclePeriod / (2 * steps) + 1e-6;
bounds.expandByScalar(padding);
const file = 'src/data/display-profiles.json', data = JSON.parse(fs.readFileSync(file)), previous = data.profiles[89];
data.profiles[89] = {...previous, floorY: bounds.min.y,
  motionBounds: {min: bounds.min.toArray(), max: bounds.max.toArray()},
  motionBoundsMethod: '512 full-cycle samples, expanded by an analytic maximum vertex speed times half the sample interval, plus 1e-6 for rounding. Includes the extended output stem and retaining channels.'};
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
fs.writeFileSync('src/data/display-profiles.js', '// Generated display measurements; 089 refined by scripts/finalize-eccentric-strap-display.mjs.\nexport default ' + JSON.stringify(data) + ';\n');
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/089-joints-display';
const sources = freezeStudySources([file, 'src/data/display-profiles.js', 'src/simulation/authored-cams.js',
  'src/simulation/eccentric-strap-joints.js', 'scripts/finalize-eccentric-strap-display.mjs'], prefix);
assert(padding < .02);
fs.writeFileSync(prefix + '.json', JSON.stringify({movement: 89, sources, previous, profile: data.profiles[89],
  steps, maximumVertexSpeed, padding, passed: true}, null, 2) + '\n', {flag: 'wx'});
console.log({padding, maximumVertexSpeed, bounds: data.profiles[89].motionBounds});
