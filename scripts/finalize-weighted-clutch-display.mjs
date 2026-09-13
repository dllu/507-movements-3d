import fs from 'node:fs';
import assert from 'node:assert/strict';
import profile from '../src/data/weighted-clutch-profile.js';
import {canonicalWeightedClutchFit} from '../src/simulation/weighted-clutch/distributed-geometry.js';
import {readStudyReport, freezeStudySources} from './lib/study-report-io.mjs';

const prefix = 'artifacts/review/087-production-display', file = 'src/data/display-profiles.json';
const data = readStudyReport(file), sampled = structuredClone(data.profiles[87]);
const linkage = canonicalWeightedClutchFit(profile.options), rate = profile.period / profile.playbackPeriod, intervals = [];
const subtract = (a, b) => a.map((x, i) => x - b[i]), cross = (a, b) => a[0] * b[1] - a[1] * b[0];
for (let i = 1; i < profile.samples.length; i++) {
  const a = profile.samples[i - 1], b = profile.samples[i], duration = b[0] - a[0], fRate = (b[1] - a[1]) / duration;
  let speed = Math.max(1.4 * Math.abs(profile.omegaInput), ...a.slice(1).map((x, k) => k === 2 ? 0 : Math.abs(b[k + 1] - x) / duration));
  for (const fraction of [0, .5, 1]) {
    const pose = linkage.atAngle(a[1] + fraction * (b[1] - a[1])), p = linkage.parameters;
    const F = subtract(pose.A, p.F), G = subtract(pose.B, p.G), rod = subtract(pose.B, pose.A);
    const velocity = subtract([-G[1] * pose.beta, G[0] * pose.beta], [-F[1], F[0]]);
    const rodDerivative = cross(rod, velocity) / p.rodLength ** 2;
    speed = Math.max(speed, Math.abs(fRate * pose.beta), Math.abs(fRate * rodDerivative));
  }
  intervals.push({duration, speed: rate * speed});
}
let elapsed = 0, sustained;
for (const interval of [...intervals].sort((a, b) => a.speed - b.speed)) {
  elapsed += interval.duration;
  if (elapsed >= profile.period * .75) { sustained = interval.speed; break; }
}
const peak = Math.max(...intervals.map(r => r.speed)); assert(peak < 6 * Math.PI && sustained < 2 * Math.PI);
Object.assign(data.profiles[87], {peakAngularSpeed: peak, peakVisibleAngularSpeed: peak,
  sustainedVisibleAngularSpeed: sustained, fastestPart: 'weighted clutch transfer',
  speedMethod: 'All reduced trajectory intervals, including short contact impulses; analytic linkage derivatives at each endpoint and midpoint. Duration-weighted 75th percentile, without a small-part visibility discount.',
  motionBoundsMethod: 'Rendered vertices at 97 complete-cycle poses; additional camera tests cover three aspect ratios and both transfers.'});
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
fs.writeFileSync('src/data/display-profiles.js', '// Generated display measurements; 087 rates refined by scripts/finalize-weighted-clutch-display.mjs.\nexport default ' + JSON.stringify(data) + ';\n');
const sources = freezeStudySources(['scripts/finalize-weighted-clutch-display.mjs', 'src/data/weighted-clutch-profile.js',
  file, 'src/data/display-profiles.js'], prefix);
fs.writeFileSync(prefix + '.json', JSON.stringify({movement: 87, sources, sampled, final: data.profiles[87],
  intervals: intervals.length, passed: true}, null, 2) + '\n', {flag: 'wx'});
console.log({peak, sustained, intervals: intervals.length});
