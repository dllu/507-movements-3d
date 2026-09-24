// Promoted from the checked 088 candidate; geometry parity is tested.
import * as THREE from 'three';
import {poly, circle, plate, disk, ring, polygonClipping as clip} from '../finite-plate-geometry.js';
import {conformingPlateMesh} from '../conforming-plate-mesh.js';
import {PALETTE, matte, markShadows} from '../primitives.js';
export {THREE};

// Centerline measurements from the opened 525-pixel engraving. The rear
// output axis is inferred from the opposed stops; it is hidden by cam A.
export const eccentricTwoStopSource = {
  scale: 100, width: 525, height: 525, input: [277, 282], output: [284.5, 275],
  rim: [[276,66],[429,130],[492,278],[429,430],[276,495],[122,430],[58,280],[121,129]],
  cam: [[149,298],[150,276],[158,238],[177,206],[209,178],[243,162],[275,158],[316,164],[354,183],
    [385,213],[405,249],[413,285],[409,329],[391,371],[361,405],[319,430],[278,440],[242,438],[203,425],
    [168,405],[141,376],[121,345],[107,302]],
  stopC: {left: 103.5, right: 136.5, top: 261, bottom: 291}, uncertaintyPixels: 3,
  // Least-squares center of an Archimedean spiral through the traced edge
  // (0.1-pixel grid search; RMS residual 1.1, maximum 3.2 pixels). Brown
  // draws the spiral centered about nine pixels from the hatched shaft.
  spiralCenter: [270.8, 288.7],
};
const world = ([x, y]) => [(x - 277) / 100, (282 - y) / 100];
function fitCircle(points) {
  const m = Array.from({length: 3}, () => [0, 0, 0, 0]);
  for (const [x, y] of points) { const a = [x, y, 1], b = -x*x-y*y;
    for (let i = 0; i < 3; i++) {for (let j = 0; j < 3; j++) m[i][j] += a[i]*a[j]; m[i][3] += a[i]*b;} }
  for (let k = 0; k < 3; k++) {
    let p = k; for (let i = k+1; i < 3; i++) if (Math.abs(m[i][k]) > Math.abs(m[p][k])) p = i;
    [m[k], m[p]] = [m[p], m[k]]; const d = m[k][k]; for (let j = k; j < 4; j++) m[k][j] /= d;
    for (let i = 0; i < 3; i++) if (i !== k) {const f = m[i][k]; for (let j = k; j < 4; j++) m[i][j] -= f*m[k][j];}
  }
  const center = [-m[0][3]/2, -m[1][3]/2];
  return {center, radius: Math.sqrt(center[0]**2+center[1]**2-m[2][3])};
}

// Cam A's edge is a true Archimedean spiral: its radius grows uniformly with
// angle through one turn and the stepped offset is radial. The center is the
// best-fit spiral center of Brown's traced edge; the rise and base radius are
// the least-squares fit about it, and the step angle is the mean of the traced
// step ends. The cam still turns about its shaft at the origin.
export function eccentricTwoStopSpiral(s = eccentricTwoStopSource) {
  const center = world(s.spiralCenter); let previous = null;
  const polar = s.cam.map(p => {
    const [x, y] = world(p).map((v, i) => v - center[i]); let angle = Math.atan2(y, x);
    if (previous !== null) { while (angle - previous > Math.PI) angle -= 2*Math.PI; while (angle - previous < -Math.PI) angle += 2*Math.PI; }
    previous = angle; return [angle, Math.hypot(x, y)];
  });
  const n = polar.length, st = polar.reduce((v, p) => v + p[0], 0), sr = polar.reduce((v, p) => v + p[1], 0),
    stt = polar.reduce((v, p) => v + p[0]*p[0], 0), str = polar.reduce((v, p) => v + p[0]*p[1], 0),
    slope = (n*str - st*sr)/(n*stt - st*st), intercept = (sr - slope*st)/n,
    stepAngle = (polar[0][0] + polar.at(-1)[0] + 2*Math.PI)/2,
    innerRadius = intercept + slope*stepAngle, outerRadius = innerRadius - slope*2*Math.PI;
  // The radius grows as the edge runs clockwise (decreasing angle) from the step.
  return {center, stepAngle, innerRadius, outerRadius, risePerRadian: -slope,
    residuals: polar.map(([angle, radius]) => radius - (intercept + slope*angle))};
}
export function archimedeanCamOutline(spiral, segments) {
  return Array.from({length: segments + 1}, (_, i) => {
    const t = i/segments, angle = spiral.stepAngle - 2*Math.PI*t, radius = spiral.innerRadius + (spiral.outerRadius - spiral.innerRadius)*t;
    return [spiral.center[0] + radius*Math.cos(angle), spiral.center[1] + radius*Math.sin(angle)];
  });
}

export function makeEccentricTwoStopCandidate({footInner = 121, camSegments = 512, spiral = eccentricTwoStopSpiral()} = {}) {
  const s = eccentricTwoStopSource, root = new THREE.Group(), cam = new THREE.Group(), wheel = new THREE.Group(), fixed = new THREE.Group();
  const parts = {}, families = {}, O = world(s.output), rim = fitCircle(s.rim), local = p => world(p).map((x, i) => x - O[i]);
  wheel.position.set(...O, 0); root.add(wheel, cam, fixed);
  function add(name, geometry, family, color, parent = family === 'cam' ? cam : family === 'wheel' ? wheel : fixed, position = [0,0,0]) {
    const mesh = new THREE.Mesh(geometry, matte(color, {metalness: .12, roughness: .65}));
    mesh.name = name; mesh.position.fromArray(position); parent.add(mesh); parts[name] = mesh; families[name] = family; return mesh;
  }
  const wheelOutline = poly(circle(local(rim.center), rim.radius / s.scale, 512));
  add('wheelB', conformingPlateMesh(plate(clip.difference(wheelOutline, poly(circle([0,0], .142, 128))), -.12, 0)), 'wheel', PALETTE.driven);
  add('wheelRearHub', ring(.142, .28, -.21, -.08, 128), 'wheel', PALETTE.driven);
  add('outputShaft', disk(.14, -.57, -.09, 128), 'wheel', PALETTE.muted);
  add('outputBearing', ring(.142, .25, -.57, -.40, 128), 'fixed', PALETTE.muted, fixed, [...O, 0]);
  const outline = archimedeanCamOutline(spiral, camSegments);
  add('camA', conformingPlateMesh(plate(clip.difference(poly(outline), poly(circle([0,0], .202, 128))), .08, .18)), 'cam', PALETTE.driver);
  add('camHub', ring(.202, .33, .13, .23, 128), 'cam', PALETTE.driver);
  add('inputShaft', disk(.20, .08, .51, 128), 'cam', PALETTE.muted);
  add('inputBearing', ring(.202, .285, .37, .52, 128), 'fixed', PALETTE.muted);
  const box = (left, right, top, bottom) => poly([[left,top],[right,top],[right,bottom],[left,bottom]].map(local));
  const body = box(s.stopC.left, s.stopC.right, s.stopC.top, s.stopC.bottom);
  const foot = box(s.stopC.left, footInner, s.stopC.top, s.stopC.bottom);
  for (const [label, sign] of [['C',1], ['D',-1]]) {
    const mirror = polygon => polygon.map(rings => rings.map(ring => ring.map(p => p.map(v => sign*v))));
    add('stop'+label+'Body', conformingPlateMesh(plate(mirror(body), .21, .34)), 'wheel', PALETTE.accent);
    add('stop'+label+'Foot', conformingPlateMesh(plate(mirror(foot), -.015, .25)), 'wheel', PALETTE.accent);
  }
  function setCoordinates(inputAngle, outputAngle) {
    if (![inputAngle, outputAngle].every(Number.isFinite)) throw Error('Nonfinite eccentric cam coordinates');
    cam.rotation.z = inputAngle; wheel.rotation.z = outputAngle; root.updateMatrixWorld(true);
    return root.userData.state = {inputAngle, outputAngle};
  }
  root.userData = {parts, families, blocks: {cam, wheel, fixed}, source: s, geometry: {O, rim, footInner, camSegments, spiral,
    camSpan: [.08,.18], bodySpan: [.21,.34], footSpan: [-.015,.25], rearDiskCenterOffset: local(rim.center)},
    hideGround: true, cameraFov: 8, shadowCameraHalfExtent: 3, shadowBias: -.00003, shadowNormalBias: .002,
    mechanism: 'eccentric-two-stop-source-candidate', fidelity: 'candidate',
    qualification: 'Source-derived spiral cam and square stop caps with broad outer feet. The hidden output axis is inferred from opposite stop positions; the traced disk rim is slightly eccentric to it. Finite contact, release, dynamics and continuous clearance require checking.'};
  setCoordinates(0,0); markShadows(root); return {root, setCoordinates, update: () => {}, cameraDirection: new THREE.Vector3(0,0,10)};
}
