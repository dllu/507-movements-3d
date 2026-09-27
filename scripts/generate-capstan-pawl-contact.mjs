import fs from 'node:fs';
import * as THREE from 'three';
import { makeCrownRatchetGeometry, capstanPawlDimensions as g, capstanPawlLocalToRotor } from '../src/simulation/capstan-pawl-contact.js';
import { capstanPawlOutline } from '../src/simulation/capstan-finite-parts.js';
import { solidSurface } from '../tests/helpers/solid-surface.mjs';

// Movement 491: the pawl turns about its radial pivot pin in the tangent plane
// of the lower capstan. For each pivot tooth phase, find the lowest pawl angle
// at which the whole finite pawl outline (at its inner, middle and outer
// faces) still clears the actual crown-ratchet triangles.
const surface = solidSurface(makeCrownRatchetGeometry({ ...g, phaseOffset: 0 }));
const pitch = 2*Math.PI/g.toothCount, count = 2048, clearance = g.clearance;
const outline = capstanPawlOutline(g).filter(([x]) => x > g.bossRadius);
const faces = [-g.thickness/2, 0, g.thickness/2];
const point = new THREE.Vector3();
// The crest edges are the only convex ratchet features; test them against
// the pawl's 2D outline too, so no edge pokes between sampled pawl points.
const polygon = capstanPawlOutline(g);
const outlineDistance = (x, y) => {
  let inside = false, best = Infinity;
  for (let i = 0, j = polygon.length-1; i < polygon.length; j = i++) {
    const [x1, y1] = polygon[i], [x2, y2] = polygon[j];
    if ((y1 > y) !== (y2 > y) && x < (x2-x1)*(y-y1)/(y2-y1)+x1) inside = !inside;
    const dx = x2-x1, dy = y2-y1, t = Math.max(0, Math.min(1, ((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy)));
    best = Math.min(best, Math.hypot(x-x1-t*dx, y-y1-t*dy));
  }
  return inside ? -best : best;
};
// Convex ratchet edges: each crest, the inner and outer top edges of each
// ramp and the ramp quad's diagonal (its two triangles meet in a ridge).
const crest = [];
const polar = (r, h, a) => [r*Math.cos(a), h, r*Math.sin(a)];
const addEdge = (p, q, n) => { for (let i = 0; i <= n; i++) crest.push(p.map((v, k) => v + (q[k]-v)*i/n)); };
for (let k = 0; k < g.toothCount; k++) {
  const a0 = k*pitch, a1 = (k+1)*pitch;
  addEdge(polar(g.innerRadius, g.highHeight, a1), polar(g.outerRadius, g.highHeight, a1), 240);
  addEdge(polar(g.innerRadius, g.lowHeight, a0), polar(g.innerRadius, g.highHeight, a1), 240);
  addEdge(polar(g.outerRadius, g.lowHeight, a0), polar(g.outerRadius, g.highHeight, a1), 240);
  addEdge(polar(g.innerRadius, g.lowHeight, a0), polar(g.outerRadius, g.highHeight, a1), 240);
}
const crestGap = (phase, beta) => {
  // Crest points into the pawl frame: undo the rotor turn, then the pivot.
  const a = -(phase*pitch - g.pivotAzimuth), c = Math.cos(a), s = Math.sin(a);
  const cb = Math.cos(beta), sb = Math.sin(beta), pa = g.pivotAzimuth;
  let best = Infinity;
  for (const [x0, y0, z0] of crest) {
    const x = x0*c - z0*s, z = x0*s + z0*c;
    const radial = x*Math.cos(pa) + z*Math.sin(pa), u = x*Math.sin(pa) - z*Math.cos(pa), v = y0 - g.pivotHeight;
    const lz = radial - g.planeRadius, lx = u*cb + v*sb, ly = -u*sb + v*cb;
    if (Math.abs(lz) > g.thickness/2 + 0.01 || lx < 0 || lx > g.length + g.noseRadius + 0.02 || Math.abs(ly) > g.bossRadius + 0.02) continue;
    const planar = outlineDistance(lx, ly), across = Math.abs(lz) - g.thickness/2;
    const gap = planar > 0 ? (across > 0 ? Math.hypot(planar, across) : planar) : (across > 0 ? across : Math.max(planar, across));
    best = Math.min(best, gap);
  }
  return best;
};
const minimumGap = (phase, beta) => {
  const a = phase*pitch - g.pivotAzimuth, c = Math.cos(a), s = Math.sin(a);
  let best = crestGap(phase, beta);
  if (best <= clearance) return best;
  for (const z of faces) for (const [x, y] of outline) {
    capstanPawlLocalToRotor(x, y, z, beta, point);
    // Rotate the rotor so the pivot sits at azimuth phase*pitch.
    point.set(point.x*c - point.z*s, point.y, point.x*s + point.z*c);
    best = Math.min(best, surface.signedDistance(point));
    if (best <= clearance) return best;
  }
  return best;
};
const contactAngle = phase => {
  let high = 0, low = -0.025;
  if (minimumGap(phase, high) <= clearance) throw new Error('pawl blocked when level');
  while (minimumGap(phase, low) > clearance && low > -1.4) { high = low; low -= 0.025; }
  if (low <= -1.4) throw new Error('Missing crown contact');
  for (let i = 0; i < 30; i++) {
    const middle = (low+high)/2;
    if (minimumGap(phase, middle) > clearance) high = middle; else low = middle;
  }
  return high;
};
const height = beta => g.pivotHeight + g.length*Math.sin(beta);
// Locate the crest release: the largest downward jump of the contact angle.
const coarse = Array.from({ length: 256 }, (_, i) => contactAngle(i/256));
let jump = 0, edge = 0;
for (let i = 0; i < 256; i++) {
  const drop = coarse[i] - coarse[(i+1) % 256];
  if (drop > jump) { jump = drop; edge = i; }
}
let before = edge/256, after = (edge+1)/256;
for (let i = 0; i < 40; i++) {
  const middle = (before+after)/2;
  if (coarse[edge] - contactAngle(middle) < jump/2) before = middle; else after = middle;
}
const releasePhase = ((after % 1) + 1) % 1;
const startHeight = height(contactAngle(before));
const landingHeight = height(contactAngle(releasePhase + g.releaseFraction));
const samples = [];
for (let i = 0; i <= count; i++) {
  const u = i/count, contact = contactAngle(releasePhase + u);
  const w = Math.min(u/g.releaseFraction, 1), smooth = w*w*w*(10+w*(-15+6*w));
  const flight = u < g.releaseFraction
    ? Math.asin((startHeight + (landingHeight-startHeight)*smooth - g.pivotHeight)/g.length) : -Infinity;
  samples.push([Math.max(contact, flight), contact]);
}
// Close the period: u=1 is the approach to the crest, whose contact is the
// release angle itself (u=0 already starts the drop from it).
samples[count] = [samples[0][0], samples[0][0]];
// Linear playback between table rows must not cut through the crest while
// the nose rolls over it: raise any interval whose midpoint (and quarter
// points) would dip under the true contact angle there.
const needed = Array.from({ length: count }, (_, i) => [0.25, 0.5, 0.75].map(f => contactAngle(releasePhase + (i+f)/count)));
for (let pass = 0; pass < 3; pass++) for (let i = 0; i < count; i++) {
  [0.25, 0.5, 0.75].forEach((f, k) => {
    const played = samples[i][0] + (samples[i+1][0]-samples[i][0])*f, lift = needed[i][k]-played;
    if (lift <= 0) return;
    samples[i][0] += lift; samples[i+1][0] += lift;
    if (i+1 === count) samples[0][0] = samples[count][0];
    if (i === 0) samples[count][0] = samples[0][0];
  });
}
for (const row of samples) row.forEach((v, k) => { row[k] = +v.toFixed(8); });
const output = `// Generated by scripts/generate-capstan-pawl-contact.mjs. Finite geometric\n// contact of the radial-pivot pawl on the crown teeth, indexed from the crest\n// release, with a prescribed smooth drop; not a dynamic gravity simulation.\nexport const capstanPawlReleasePhase = ${releasePhase};\nexport const capstanPawlSamples = ${JSON.stringify(samples)};\n`;
fs.writeFileSync(new URL('../src/simulation/capstan-pawl-profile.js', import.meta.url), output);
console.log({ samples: samples.length, releasePhase, startHeight, landingHeight, jump });
