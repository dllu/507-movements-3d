import * as THREE from 'three';
import {
  cylinderAlongZ, smootherstepLaw, circle, poly, plate, polygonClipping, PALETTE, markShadows, matte,
} from './gab-disengager-shared.js';

// Brown 188 ("Modifications of 186"): the eccentric rod carries, on one
// pivot, a single rigid loop handle whose right-hand arm reaches behind the
// rod's crown (Brown's dashed legs) and rests its round toe on the valve pin
// seated in the rod's open-bottom gab. The loop's descending limb ends at
// step a, where it stands on the head of a leaf spring rising from a clip
// block screwed to the rod. Lifting the loop turns the handle clockwise, the
// toe presses the pin out of the gab (the rod rises off it) and the leaf,
// whose head stays seated under the limb at a, flexes up with it and props
// the handle in the lifted position; pressing the leaf back lowers the rod
// onto the pin again. All working contacts are touching with a small gap.
const PX = 0.017; // model units per plate pixel (525 px engraving)
const PIN_RASTER = [394, 322];
const R = ([x, y]) => new THREE.Vector2((x - PIN_RASTER[0]) * PX, (PIN_RASTER[1] - y) * PX);
const ring = (points) => points.map((p) => R(p).toArray());
const GAP = 0.002;

const PERIOD = 16;
const RUN_HALF = 4.5; // running window [-4.5, 4.5] s about t = 0
const RUN_EASE = 1.0;
const RUN_TURNS_HALF = 1.5; // eccentric turns in each half window
const LIFT = [5.0, 7.2];
const LOWER = [9.2, 11.2];
const STROKE = 0.22; // eccentric throw at the gab, model units

// Rod z layers: front plate [-.12,.12]; handle behind it; leaf further back.
const Z = {
  rod: [-0.12, 0.12], rail: [-0.62, -0.12], handle: [-0.40, -0.16],
  leaf: [-0.60, -0.44], lug: [-0.62, -0.40 - GAP], clip: [-0.64, -0.42],
};

const pivotRaster = [287, 288];
const pivot = R(pivotRaster);
const pinRadius = 17 * PX;
const toeRadius = 10 * PX;
const contactDistance = pinRadius + toeRadius + GAP;
const toeCenterRest = new THREE.Vector2(0, contactDistance); // directly above the pin
const rodBottomY = R([0, 335]).y;
const gabRadius = pinRadius + 0.5 * PX;
const clearance = 1.5 * PX;
const requiredLift = pinRadius - rodBottomY + clearance;
const pivotPinRadius = 5 * PX;
const pivotBoreRadius = pivotPinRadius + 0.3 * PX;

// Toe-on-pin contact: rod lift h for handle angle theta (clockwise on the plate).
function liftAtAngle(theta) {
  const c = toeCenterRest.clone().sub(pivot).rotateAround(new THREE.Vector2(), -theta).add(pivot);
  return Math.sqrt(contactDistance ** 2 - c.x ** 2) - c.y;
}
const maximumAngle = (() => {
  let lo = 0, hi = 0.8;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (liftAtAngle(mid) < requiredLift) lo = mid; else hi = mid;
  }
  return hi;
})();

// Leaf spring: fixed clip exit X (tangent +x) to the head end E carried by
// the handle (Hermite fit to the plate centreline within 1 px).
const clipExit = R([140, 297 - 4.5 - GAP / PX]);
const leafHeadRaster = [223, 178];
const leafHeadRest = R(leafHeadRaster);
const leafEndAngle = THREE.MathUtils.degToRad(8); // leans left on the plate
const leafStartSpeed = 70 * PX;
const leafEndSpeed = 290 * PX;
const leafSamples = 110;
const leafTailSamples = 8;
// Half widths (inner = toward the loop, outer = away) by distance from head, px.
const leafProfile = [
  [0, 20, 14], [3.2, 20, 14], [5.5, 15, 14], [24, 11, 11], [42, 9.5, 9.5],
  [70, 8.5, 8.5], [100, 6.5, 6.5], [130, 5.5, 5.5], [150, 4.5, 4.5], [1e9, 4.5, 4.5],
];

function handleTransform(theta) {
  return (local) => local.clone().rotateAround(new THREE.Vector2(), -theta).add(pivot);
}

function leafCenterline(theta) {
  const toRod = handleTransform(theta);
  const end = toRod(leafHeadRest.clone().sub(pivot));
  const endDir = new THREE.Vector2(-Math.sin(leafEndAngle), Math.cos(leafEndAngle))
    .rotateAround(new THREE.Vector2(), -theta);
  const t0 = new THREE.Vector2(leafStartSpeed, 0), t1 = endDir.clone().multiplyScalar(leafEndSpeed);
  const points = [];
  for (let i = 0; i <= leafSamples; i++) {
    const u = i / leafSamples, s = 1 - (1 - u) ** 2;
    const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s;
    const h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
    points.push(new THREE.Vector2(
      h00 * clipExit.x + h10 * t0.x + h01 * end.x + h11 * t1.x,
      h00 * clipExit.y + h10 * t0.y + h01 * end.y + h11 * t1.y,
    ));
  }
  let free = 0;
  for (let i = 1; i < points.length; i++) free += points[i].distanceTo(points[i - 1]);
  return {points, free, end, endDir};
}
const leafFreeRest = leafCenterline(0).free;
const leafFreeHeld = leafCenterline(maximumAngle).free;
// The leaf's foot slides in the clip so its length is constant; the tail
// stays hidden under the clip block (x 105-140 on the plate).
const leafLength = leafFreeRest + 31 * PX;

function leafPath(theta) {
  const {points, free, end, endDir} = leafCenterline(theta);
  const tail = leafLength - free;
  const path = [];
  for (let i = 0; i < leafTailSamples; i++) {
    path.push(new THREE.Vector2(clipExit.x - tail * (1 - i / leafTailSamples), clipExit.y));
  }
  path.push(...points);
  return {path, tail, free, end, endDir};
}

function makeLeafGeometry(count) {
  const perRing = 8, positions = new Float32Array((count * perRing + 8) * 3), index = [];
  for (let i = 0; i < count - 1; i++) for (let f = 0; f < 4; f++) {
    const a = i * perRing + f * 2, b = a + 1, c = a + perRing, d = b + perRing;
    index.push(a, c, b, b, c, d);
  }
  const cap = count * perRing;
  index.push(cap, cap + 2, cap + 1, cap, cap + 3, cap + 2, cap + 4, cap + 5, cap + 6, cap + 4, cap + 6, cap + 7);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(index);
  return geometry;
}

function writeLeaf(geometry, path) {
  const positions = geometry.attributes.position.array;
  const n = path.length, fromHead = new Array(n).fill(0);
  for (let i = n - 2; i >= 0; i--) fromHead[i] = fromHead[i + 1] + path[i].distanceTo(path[i + 1]);
  const halfWidths = (dPx) => {
    for (let k = 1; k < leafProfile.length; k++) if (dPx <= leafProfile[k][0]) {
      const [d0, i0, o0] = leafProfile[k - 1], [d1, i1, o1] = leafProfile[k];
      const f = (dPx - d0) / (d1 - d0);
      return [i0 + (i1 - i0) * f, o0 + (o1 - o0) * f];
    }
    return [4.5, 4.5];
  };
  const [zb, zf] = Z.leaf;
  const rings = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
    const t = b.clone().sub(a).normalize(), nrm = new THREE.Vector2(-t.y, t.x);
    const [inner, outer] = halfWidths(fromHead[i] / PX).map((w) => w * PX);
    const pi = p.clone().addScaledVector(nrm, inner), po = p.clone().addScaledVector(nrm, -outer);
    return [[pi.x, pi.y, zf], [pi.x, pi.y, zb], [po.x, po.y, zb], [po.x, po.y, zf]];
  });
  rings.forEach((r, i) => {
    for (let f = 0; f < 4; f++) for (let k = 0; k < 2; k++) positions.set(r[(f + k) % 4], (i * 8 + f * 2 + k) * 3);
  });
  [rings[0], rings[n - 1]].forEach((r, e) => r.forEach((p, k) => positions.set(p, (n * 8 + e * 4 + k) * 3)));
  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

// Motion law.
const smooth = (u) => smootherstepLaw(THREE.MathUtils.clamp(u, 0, 1));
const runRate = (RUN_TURNS_HALF * 2 * Math.PI) / (RUN_HALF - RUN_EASE / 2);
function eccentricPhase(tau) {
  const a = Math.abs(tau), sign = Math.sign(tau), steady = RUN_HALF - RUN_EASE;
  if (a <= steady) return {phase: tau * runRate, rate: runRate};
  const u = Math.min(1, (a - steady) / RUN_EASE);
  const integral = u - (u ** 6 - 3 * u ** 5 + 2.5 * u ** 4);
  return {phase: sign * runRate * (steady + RUN_EASE * integral), rate: runRate * (1 - smooth(u).value)};
}

export function stateAtTime188(time) {
  const t = THREE.MathUtils.euclideanModulo(time, PERIOD);
  let stage, rodX = 0, rodSpeed = 0, theta = 0, thetaRate = 0;
  const tau = t > PERIOD - RUN_HALF ? t - PERIOD : t;
  if (Math.abs(tau) <= RUN_HALF) {
    const {phase, rate} = eccentricPhase(tau);
    rodX = STROKE * Math.sin(phase);
    rodSpeed = STROKE * Math.cos(phase) * rate;
    stage = Math.abs(tau) < RUN_HALF - RUN_EASE ? 'running' : (tau > 0 ? 'stopping' : 'starting');
  } else if (t < LIFT[0]) stage = 'stopped';
  else if (t <= LIFT[1]) {
    const law = smooth((t - LIFT[0]) / (LIFT[1] - LIFT[0]));
    theta = maximumAngle * law.value;
    thetaRate = maximumAngle * law.firstDerivative / (LIFT[1] - LIFT[0]);
    stage = 'lifting-loop';
  } else if (t < LOWER[0]) {theta = maximumAngle; stage = 'held-by-leaf-at-a';}
  else if (t <= LOWER[1]) {
    const law = smooth((t - LOWER[0]) / (LOWER[1] - LOWER[0]));
    theta = maximumAngle * (1 - law.value);
    thetaRate = -maximumAngle * law.firstDerivative / (LOWER[1] - LOWER[0]);
    stage = 'lowering-onto-pin';
  } else stage = 'settled';
  const rodLift = theta > 0 ? liftAtAngle(theta) : 0;
  const toe = toeCenterRest.clone().sub(pivot).rotateAround(new THREE.Vector2(), -theta).add(pivot);
  const pinInRod = new THREE.Vector2(0, -rodLift); // pin centre in the rod frame
  const leaf = leafPath(theta);
  return {
    time, stage, rodX, rodSpeed, rodLift, handleAngle: theta, handleRate: thetaRate, pinX: rodX,
    toeGap: toe.distanceTo(pinInRod) - pinRadius - toeRadius,
    pinTopBelowRodBottom: rodBottomY - (pinInRod.y + pinRadius),
    pinInGab: rodLift < 1e-9,
    leafTail: leaf.tail, leafFree: leaf.free,
  };
}

function extrude(shape, [low, high], material, role) {
  const mesh = new THREE.Mesh(plate(shape, low, high), material);
  mesh.userData.role = role;
  return mesh;
}

export function loopHandlePinCamGabDisengager() {
  const root = new THREE.Group();
  const rodMaterial = matte(PALETTE.driver, {metalness: 0.13, roughness: 0.58});
  const handleMaterial = matte(PALETTE.brass, {metalness: 0.24, roughness: 0.47});
  const leafMaterial = matte(PALETTE.driven, {metalness: 0.2, roughness: 0.5, side: THREE.DoubleSide});
  const pinMaterial = matte(PALETTE.accent, {metalness: 0.19, roughness: 0.51});
  const darkMaterial = matte(PALETTE.ink, {metalness: 0.28, roughness: 0.44});
  const clipMaterial = matte(PALETTE.frame, {metalness: 0.14, roughness: 0.68});

  // Eccentric rod: broken end at the left, crown over the gab, nosed tail.
  const rod = new THREE.Group();
  rod.userData.role = 'eccentric-rod-rigid-body';
  const rodOutline = poly(ring([
    [15, 297], [332, 297], [338, 285], [348, 272], [365, 262], [385, 258], [405, 258], [425, 263],
    [440, 274], [450, 290], [458, 302], [470, 309], [500, 312], [514, 315], [520, 322], [517, 331],
    [508, 335], [25, 335], [20, 329], [24, 321], [17, 313], [21, 305],
  ]));
  const gabCenter = R(PIN_RASTER);
  const gab = polygonClipping.union(
    poly(circle([gabCenter.x, gabCenter.y], gabRadius, 128)),
    poly([[gabCenter.x - gabRadius, gabCenter.y], [gabCenter.x + gabRadius, gabCenter.y],
      [gabCenter.x + gabRadius, rodBottomY - 0.2], [gabCenter.x - gabRadius, rodBottomY - 0.2]]),
  );
  const pivotBore = poly(circle([pivot.x, pivot.y], pivotBoreRadius, 64));
  const rodFront = extrude(polygonClipping.difference(rodOutline, gab, pivotBore), Z.rod, rodMaterial,
    'eccentric-rod-with-crown-open-bottom-gab-and-tail');
  // The rod is deeper behind its plain bar, where the leaf's clip is screwed.
  const rodRail = extrude(poly(ring([[15, 297], [245, 297], [245, 335], [25, 335], [20, 329], [24, 321], [17, 313], [21, 305]])),
    Z.rail, rodMaterial, 'eccentric-rod-rear-web-carrying-leaf-clip');
  const pivotPin = cylinderAlongZ(pivotPinRadius, 0.58, darkMaterial, 32);
  pivotPin.position.set(pivot.x, pivot.y, -0.13);
  pivotPin.userData.role = 'handle-pivot-pin-on-rod';
  // Clip block over the leaf's foot: top plate plus front and rear cheeks.
  const clipTop = extrude(poly(ring([[105, 280], [140, 280], [140, 287.5], [105, 287.5]])), Z.clip, clipMaterial,
    'screwed-clip-block-over-leaf-foot');
  const cheekShape = poly(ring([[105, 280], [140, 280], [140, 297 - GAP / PX], [105, 297 - GAP / PX]]));
  const clipFront = extrude(cheekShape, [Z.leaf[1] + GAP, Z.clip[1]], clipMaterial, 'clip-block-front-cheek');
  const clipBack = extrude(cheekShape, [Z.clip[0], Z.leaf[0] - GAP], clipMaterial, 'clip-block-rear-cheek');
  const clipScrew = extrude(poly(ring([[112, 276], [137, 276], [137, 280 - GAP / PX], [112, 280 - GAP / PX]])),
    [-0.58, -0.46], darkMaterial, 'clip-screw-head');
  const leaf = new THREE.Mesh(makeLeafGeometry(leafTailSamples + leafSamples + 1), leafMaterial);
  leaf.userData.role = 'leaf-spring-rising-to-step-a';
  leaf.frustumCulled = false;

  // Loop handle, one rigid bent bar: hub on the pivot, diagonal, loop, and
  // descending limb whose end stands on the leaf's head at a.
  const handle = new THREE.Group();
  handle.position.set(pivot.x, pivot.y, 0);
  handle.userData.role = 'loop-handle-rigid-body';
  const H = (p) => R(p).sub(pivot);
  const barPath = [
    [287, 288], [262, 274], [247, 262], [222, 237], [197, 212], [172, 187], [147, 166], [125, 157], [100, 152],
    [70, 148], [45, 144], [27, 136], [19, 120], [24, 102], [38, 91], [68, 82], [100, 80], [140, 83],
    [168, 92], [191, 106], [208, 124], [220, 145], [226, 163], [228, 178], [229, 192],
  ].map((p) => H(p));
  const barCurve = new THREE.SplineCurve(barPath);
  const barHalf = 6.8 * PX, left = [], right = [];
  for (let i = 0; i <= 400; i++) {
    const p = barCurve.getPoint(i / 400), t = barCurve.getTangent(i / 400);
    left.push([p.x - barHalf * t.y, p.y + barHalf * t.x]);
    right.push([p.x + barHalf * t.y, p.y - barHalf * t.x]);
  }
  const bar = poly([...left, ...right.reverse()]);
  // Tip face: perpendicular to the leaf's end direction, GAP above the head.
  const headLocal = H(leafHeadRaster);
  const up = new THREE.Vector2(-Math.sin(leafEndAngle), Math.cos(leafEndAngle));
  const across = new THREE.Vector2(up.y, -up.x);
  const faceBox = (below, above) => {
    const c = headLocal.clone().addScaledVector(up, GAP);
    return poly([[-8, below], [20, below], [20, above], [-8, above]].map(([a, b]) => {
      const q = c.clone().addScaledVector(across, a * PX).addScaledVector(up, b * PX);
      return [q.x, q.y];
    }));
  };
  const hub = [];
  for (let i = 0; i < 96; i++) {
    const a = i * Math.PI * 2 / 96, p = H([292 + 38 * Math.cos(a), 289 + 17 * Math.sin(a)]);
    hub.push([p.x, p.y]);
  }
  const arch = poly([
    [265, 274], [292, 268], [312, 263], [328, 254], [342, 240], [356, 232], [372, 229], [384, 232],
    [393, 245], [401, 262], [386, 266], [381, 256], [375, 244], [366, 242], [355, 252], [343, 268],
    [333, 283], [325, 291], [300, 282],
  ].map((p) => H(p).toArray()));
  const toeCenter = toeCenterRest.clone().sub(pivot);
  const legTop = H([388, 248]);
  const legDir = toeCenter.clone().sub(legTop).normalize(), legN = new THREE.Vector2(-legDir.y, legDir.x);
  const leg = poly([legTop.clone().addScaledVector(legN, toeRadius), toeCenter.clone().addScaledVector(legN, toeRadius),
    toeCenter.clone().addScaledVector(legN, -toeRadius), legTop.clone().addScaledVector(legN, -toeRadius)].map((p) => p.toArray()));
  const handleShape = polygonClipping.difference(
    polygonClipping.union(bar, poly(hub), arch, leg, poly(circle(toeCenter.toArray(), toeRadius, 96))),
    faceBox(-30, 0), poly(circle([0, 0], pivotBoreRadius, 64)),
  );
  const handleBody = extrude(handleShape, Z.handle, handleMaterial,
    'loop-handle-hub-diagonal-loop-limb-and-pin-toe-arm');
  // Lug behind the limb's end, reaching back to the leaf's plane.
  const lug = extrude(polygonClipping.intersection(bar, faceBox(0, 12)), Z.lug, handleMaterial,
    'handle-limb-end-lug-standing-on-leaf-at-a');
  handle.add(handleBody, lug);

  const valvePin = cylinderAlongZ(pinRadius, 0.64, pinMaterial, 48);
  valvePin.position.z = -0.14;
  valvePin.userData.role = 'valve-gear-pin-in-gab';
  const pinGroup = new THREE.Group();
  pinGroup.userData.role = 'valve-pin-rigid-body';
  pinGroup.add(valvePin);

  rod.add(rodFront, rodRail, pivotPin, clipTop, clipFront, clipBack, clipScrew, leaf, handle);
  root.add(rod, pinGroup);

  function update(time) {
    const state = stateAtTime188(time);
    rod.position.set(state.rodX, state.rodLift, 0);
    pinGroup.position.set(state.pinX, 0, 0);
    handle.rotation.z = -state.handleAngle;
    writeLeaf(leaf.geometry, leafPath(state.handleAngle).path);
    root.userData.kinematics = state;
    return state;
  }

  // Frame the whole motion (the loop rises with the rod when lifted).
  const bounds = new THREE.Box3();
  for (const t of [0, 2, 5, 6, 7.2, 8, 10, 13]) {
    update(t);
    root.updateMatrixWorld(true);
    bounds.union(new THREE.Box3().setFromObject(root, true));
  }

  const blocks = {rodFront, rodRail, pivotPin, clipTop, clipFront, clipBack, clipScrew, leaf, handleBody, lug, valvePin,
    // Aliases for the pre-rewrite shared joint test (pin versus plates).
    valvePinBoss: handleBody, valveCarrierWeb: rodFront};
  Object.assign(root.userData, {
    fidelity: 'authored',
    mechanism: 'rod-pivoted-loop-handle-toe-presses-valve-pin-out-of-gab-leaf-spring-head-props-limb-at-step-a',
    archetype: 'loop-handle-direct-pin-conjugate-cam-leaf-spring-notch-gab-release',
    hideGround: true,
    blocks,
    rigidBodies: [rod, handle, pinGroup, leaf],
    jointChecks: [[rodFront, pivotPin], [handleBody, pivotPin], [rodFront, valvePin], [handleBody, valvePin]],
    geometry: {
      cyclePeriod: PERIOD, pixel: PX, pinRaster: PIN_RASTER, pivotRaster, leafHeadRaster, stroke: STROKE,
      maximumHandleAngle: maximumAngle, requiredLift, pinRadius, toeRadius, gabRadius, contactGap: GAP,
      leafLength, leafFreeRest, leafFreeHeld, lift: LIFT, lower: LOWER, runHalf: RUN_HALF,
    },
    animationTiming: {authoredCyclePeriod: PERIOD},
    minimumDisplayCycleSeconds: PERIOD,
    stateAtTime: stateAtTime188,
    liftAtAngle,
    leafPathAtAngle: leafPath,
    sourcePointFromRaster: (p) => R(p),
    cameraFitBounds: bounds,
    cameraDistanceScale: 1.0,
    reconstructionNote: 'One rigid loop handle pivoted on the rod; its toe behind the crown presses the valve pin out of the gab. A clip-guided leaf spring stands under the limb end at a and props the lifted handle. No frame is drawn.',
  });

  update(0);
  markShadows(root);
  return {root, update, cameraDirection: new THREE.Vector3(0.03, 0.02, 1)};
}
