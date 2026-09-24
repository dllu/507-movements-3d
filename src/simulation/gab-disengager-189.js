import * as THREE from 'three';
import {
  FULL_TURN, Z_AXIS, circle, cylinderAlongZ, makeBoredPlanarLink, markShadows, matte, PALETTE,
  plate, pointInPose, poly, polygonClipping, rotate2, smootherstepLaw,
} from './gab-disengager-shared.js';

// Movement 189, "another modification of 186": a bell crank (its long upright
// arm is the vertical operating rod, its short arm points right) hangs a link
// from its crank pin to the tail of the eccentric rod. Swinging the upright
// arm turns the crank up, the link lifts the rod's tail, and the rod rocks
// about its forked eccentric end so the downward gab leaves the valve-lever
// pin. Lowering the arm drops the gab back over the pin. All anchors are
// measured on public/engravings/mm_189.png (525 px) with the gab pin centre as
// origin; the plate draws no support for the bell-crank stud, so none is built.
const PX = 0.016;
const RASTER_ORIGIN = Object.freeze({x: 342, y: 401});
const fromRaster = (x, y) => new THREE.Vector2((x - RASTER_ORIGIN.x) * PX, (RASTER_ORIGIN.y - y) * PX);
const toRaster = (p) => new THREE.Vector2(RASTER_ORIGIN.x + p.x / PX, RASTER_ORIGIN.y - p.y / PX);

export const SOURCE_RASTER_189 = Object.freeze({
  gabPin: [342, 401], valvePivot: [330.5, 274], bellPivot: [402, 236], crankPin: [472, 236],
  rodPin: [472, 401], handleTop: [401.5, 28], eccentricJoint: [30, 400], rodTip: [520, 408],
});

const PERIOD = 16;
const TURN_SPEED = 0.5; // eccentric turns per second: 2 s per turn
// Eccentric speed keyframes [time s, turns/s]; smootherstep blends between.
const SPEED_KEYS = [[0, TURN_SPEED], [3.5, TURN_SPEED], [4.5, 0], [7.5, 0], [8.5, TURN_SPEED],
  [9.5, TURN_SPEED], [10.5, 0], [13.5, 0], [14.5, TURN_SPEED], [PERIOD, TURN_SPEED]];
const LIFT = [5, 7];
const LOWER = [11, 13];
const STAGES = [
  [3.5, 'engaged-eccentric-rod-driving-valve-lever'],
  [4.5, 'eccentric-slowing-to-release-alignment'],
  [5, 'stopped-at-release-alignment'],
  [7, 'bell-crank-lifting-gab-off-valve-pin'],
  [7.5, 'gab-held-clear-stopped'],
  [10.5, 'eccentric-rod-running-free-with-gab-held-clear'],
  [11, 'stopped-with-gab-over-valve-pin'],
  [13, 'bell-crank-lowering-gab-onto-valve-pin'],
  [13.5, 'gab-reengaged-stopped'],
  [PERIOD, 'engaged-eccentric-rod-driving-valve-lever'],
];

// Integral of smootherstep from 0 to u.
const smootherIntegral = (u) => u ** 6 - 3 * u ** 5 + 2.5 * u ** 4;

function eccentricTurnsAt(time) {
  const t = THREE.MathUtils.euclideanModulo(time, PERIOD);
  let turns = 0;
  for (let i = 0; i < SPEED_KEYS.length - 1; i++) {
    const [t0, v0] = SPEED_KEYS[i], [t1, v1] = SPEED_KEYS[i + 1], span = t1 - t0;
    const u = THREE.MathUtils.clamp((t - t0) / span, 0, 1);
    turns += span * (v0 * u + (v1 - v0) * smootherIntegral(u));
    if (t < t1) {
      const s = smootherstepLaw(u);
      return {turns, speed: v0 + (v1 - v0) * s.value, t};
    }
  }
  return {turns, speed: TURN_SPEED, t};
}

function handleFractionAt(time) {
  const t = THREE.MathUtils.euclideanModulo(time, PERIOD);
  if (t <= LIFT[0] || t >= LOWER[1]) return 0;
  if (t < LIFT[1]) return smootherstepLaw((t - LIFT[0]) / (LIFT[1] - LIFT[0])).value;
  if (t <= LOWER[0]) return 1;
  return 1 - smootherstepLaw((t - LOWER[0]) / (LOWER[1] - LOWER[0])).value;
}

function circleIntersectionNear(c1, r1, c2, r2, preferred) {
  const d = c2.clone().sub(c1), distance = d.length();
  if (distance > r1 + r2 + 1e-10 || distance < Math.abs(r1 - r2) - 1e-10) {
    throw new RangeError('Movement 189 hanger linkage cannot assemble.');
  }
  const along = (r1 ** 2 - r2 ** 2 + distance ** 2) / (2 * distance);
  const height = Math.sqrt(Math.max(0, r1 ** 2 - along ** 2));
  d.divideScalar(distance);
  const base = c1.clone().addScaledVector(d, along), normal = new THREE.Vector2(-d.y, d.x);
  const a = base.clone().addScaledVector(normal, height), b = base.clone().addScaledVector(normal, -height);
  return a.distanceToSquared(preferred) <= b.distanceToSquared(preferred) ? a : b;
}

export function bellCrankHangerGabDisengager() {
  const root = new THREE.Group();
  const R = Object.fromEntries(Object.entries(SOURCE_RASTER_189).map(([k, [x, y]]) => [k, fromRaster(x, y)]));
  const valvePivot = R.valvePivot, bellPivot = R.bellPivot;
  const valvePinLocal = R.gabPin.clone().sub(valvePivot);
  const crankLocal = R.crankPin.clone().sub(bellPivot);
  const handleTopLocal = R.handleTop.clone().sub(bellPivot);
  const eccLocal = R.eccentricJoint.clone(); // in rod frame (origin at gab)
  const rodPinLocal = R.rodPin.clone();
  const hangerLength = R.crankPin.distanceTo(R.rodPin);
  const eccToRodPin = rodPinLocal.distanceTo(eccLocal);
  const gabRadiusAboutEccentric = eccLocal.length();

  const rockerAmplitude = 0.12;
  const pinRadius = 11.5 * PX;
  const notchHalfWidth = 12.5 * PX;
  const rodBottomY = (RASTER_ORIGIN.y - 416) * PX; // rod lower edge at the gab
  const clearMargin = 0.08;

  // Engaged: the gab sits on the valve pin, the crank is at rest and the
  // hanger fixes the rod angle. The remote eccentric end follows from it.
  const engagedPose = (theta) => {
    const rocker = rockerAmplitude * Math.sin(theta);
    const pin = pointInPose(valvePivot, rocker, valvePinLocal);
    const rodPin = circleIntersectionNear(pin, rodPinLocal.length(), R.crankPin, hangerLength,
      rodPinLocal.clone().add(pin));
    const rodAngle = Math.atan2(rodPin.y - pin.y, rodPin.x - pin.x) - Math.atan2(rodPinLocal.y, rodPinLocal.x);
    return {rocker, pin, rodAngle, eccentric: pin.clone().add(rotate2(rodAngle, eccLocal))};
  };
  // General pose: the eccentric end keeps its running path, the bell crank
  // turned by psi places the hanger, and the rigid rod follows both.
  const poseAt = (theta, psi) => {
    const nominal = engagedPose(theta);
    const crankPin = bellPivot.clone().add(rotate2(psi, crankLocal));
    const rodPin = circleIntersectionNear(nominal.eccentric, eccToRodPin, crankPin, hangerLength,
      rotate2(nominal.rodAngle, rodPinLocal).add(nominal.pin).add(crankPin).sub(R.crankPin));
    const rel = rodPinLocal.clone().sub(eccLocal);
    const rodAngle = Math.atan2(rodPin.y - nominal.eccentric.y, rodPin.x - nominal.eccentric.x) - Math.atan2(rel.y, rel.x);
    const gab = nominal.eccentric.clone().sub(rotate2(rodAngle, eccLocal));
    const rocker = psi > 0 ? 0 : nominal.rocker;
    const pin = pointInPose(valvePivot, rocker, valvePinLocal);
    const pinInRod = rotate2(-rodAngle, pin.clone().sub(gab));
    return {theta, psi, rocker, pin, gab, rodAngle, rodPin, crankPin, eccentric: nominal.eccentric, pinInRod,
      // Positive once the pin top is below the rod's lower edge.
      pinClearanceBelowRod: rodBottomY - (pinInRod.y + pinRadius)};
  };
  // Smallest crank turn that holds the gab clear by clearMargin at every
  // eccentric angle of the free run.
  const clearanceAt = (psi) => {
    let worst = Infinity;
    for (let i = 0; i < 180; i++) worst = Math.min(worst, poseAt(FULL_TURN * i / 180, psi).pinClearanceBelowRod);
    return worst;
  };
  let lo = 0.05, hi = 1.2;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (clearanceAt(mid) < clearMargin) lo = mid; else hi = mid; }
  const maximumCrankAngle = hi;

  const stateAtTime = (time) => {
    const input = eccentricTurnsAt(time);
    const handleFraction = handleFractionAt(time);
    const pose = poseAt(FULL_TURN * input.turns, maximumCrankAngle * handleFraction);
    const stage = STAGES.find(([end]) => input.t < end)?.[1] ?? STAGES[0][1];
    return {...pose, time, stage, eccentricTurns: input.turns, eccentricSpeed: input.speed, handleFraction,
      gabLift: pose.gab.y, gabEngaged: handleFraction === 0 && pose.gab.distanceTo(pose.pin) < 1e-9,
      handleTop: bellPivot.clone().add(rotate2(pose.psi, handleTopLocal))};
  };

  // ---- Solids ------------------------------------------------------------
  const mat = (color, roughness = .56) => matte(color, {metalness: .15, roughness});
  const rodMaterial = mat(PALETTE.driver), valveMaterial = mat(PALETTE.driven);
  const crankMaterial = mat(PALETTE.accent), hangerMaterial = mat(PALETTE.brass, .5);
  const pinMaterial = mat(PALETTE.ink, .44), shaftMaterial = mat(PALETTE.muted, .6);
  const ring = (points) => points.map((p) => [p.x, p.y]);
  const rasterRing = (points) => points.map(([x, y]) => fromRaster(x, y).toArray());
  const smoothRaster = (points, samples) => new THREE.SplineCurve(points.map(([x, y]) => fromRaster(x, y)))
    .getPoints(samples).map((p) => [p.x, p.y]);
  const disc = (center, radius) => poly(circle(center.toArray ? center.toArray() : center, radius, 64));

  // Valve lever, keyed to its rockshaft: boss ring, arm tapering down to the
  // round disc behind the gab, and the forward pin through the gab.
  const valveRocker = new THREE.Group();
  valveRocker.position.set(valvePivot.x, valvePivot.y, 0);
  valveRocker.userData.axis = Z_AXIS.clone();
  valveRocker.userData.role = 'valve-lever-on-rockshaft-carrying-gab-pin';
  const vl = (x, y) => fromRaster(x, y).sub(valvePivot).toArray();
  const shaftRadius = 22 * PX, pinBore = pinRadius + .006, shaftBore = shaftRadius + .01;
  const valveArm = new THREE.Mesh(plate(polygonClipping.difference(polygonClipping.union(
    disc([0, 0], 35.5 * PX), disc(valvePinLocal, 35 * PX),
    poly([vl(309, 298), vl(357, 298), vl(348, 401), vl(333, 401)]),
  ), disc([0, 0], shaftBore), disc(valvePinLocal, pinBore)), -.38, -.18), valveMaterial);
  valveArm.userData.role = 'valve-lever-boss-tapered-arm-and-pin-disc';
  valveArm.geometry.userData.bores = [{x: 0, y: 0, radius: shaftBore},
    {x: valvePinLocal.x, y: valvePinLocal.y, radius: pinBore}];
  const valveShaft = cylinderAlongZ(shaftRadius, .40, shaftMaterial, 40);
  valveShaft.position.z = -.35;
  valveShaft.userData.role = 'valve-rockshaft-section-in-lever-boss';
  const valvePin = cylinderAlongZ(pinRadius, .48, hangerMaterial, 36);
  valvePin.position.set(valvePinLocal.x, valvePinLocal.y, -.14);
  valvePin.userData.role = 'valve-lever-pin-caught-by-eccentric-rod-gab';
  // Brown hatches the cut rockshaft: thin ink strokes just proud of its face.
  const hatch = new THREE.Group();
  hatch.userData.role = 'valve-rockshaft-section-hatching';
  for (let i = -3; i <= 3; i++) {
    const offset = i * shaftRadius / 3.6, chord = 2 * Math.sqrt(shaftRadius ** 2 - offset ** 2) * .94;
    const stroke = new THREE.Mesh(new THREE.BoxGeometry(chord, .018, .006), pinMaterial);
    const angle = Math.PI / 3;
    stroke.position.set(-offset * Math.sin(angle), offset * Math.cos(angle), -.144);
    stroke.rotation.z = angle;
    stroke.userData.role = 'valve-rockshaft-section-hatching';
    hatch.add(stroke);
  }
  valveRocker.add(valveArm, valveShaft, hatch, valvePin);

  // Eccentric rod: forked (slotted) left end, bar, raised crown over the gab,
  // raised eye for the hanger pin, and the tail to its rounded tip.
  const eccentricRod = new THREE.Group();
  eccentricRod.userData.role = 'eccentric-rod-with-fork-crown-gab-and-hanger-eye';
  const crown = smoothRaster([[284, 381], [300, 377], [314, 366], [328, 357], [342, 354], [356, 356],
    [367, 362], [377, 373], [386, 387], [394, 397], [404, 400.5]], 48);
  const rodOutline = polygonClipping.union(
    poly([...rasterRing([[14, 417], [14, 383], [150, 382], [250, 381.5]]), ...crown,
      ...rasterRing([[458, 400.5], [486, 405], [517, 405], [521, 407], [521, 409.5], [517, 416], [300, 416]])]),
    disc(fromRaster(472, 401), 15.5 * PX),
  );
  // Gab: a round-topped notch whose walls are arcs about the eccentric end,
  // so the pin leaves along its own path when the rod rocks.
  const eccCenter = eccLocal, notchArc = [];
  const phi0 = Math.atan2(-eccCenter.y, -eccCenter.x);
  for (const [radius, dir] of [[gabRadiusAboutEccentric + notchHalfWidth, 1], [gabRadiusAboutEccentric - notchHalfWidth, -1]]) {
    const arc = [];
    for (let i = 0; i <= 16; i++) {
      const phi = phi0 - .12 * i / 16;
      arc.push([eccCenter.x + radius * Math.cos(phi), eccCenter.y + radius * Math.sin(phi)]);
    }
    notchArc.push(...(dir > 0 ? arc : arc.reverse()));
  }
  const forkSlot = polygonClipping.union(poly(rasterRing([[36, 392.5], [112, 392.5], [112, 406.5], [36, 406.5]])),
    disc(fromRaster(112, 399.5), 7 * PX));
  const rodPinBore = .08;
  const rodBody = new THREE.Mesh(plate(polygonClipping.difference(rodOutline,
    poly(notchArc), disc([0, 0], notchHalfWidth), forkSlot, disc(rodPinLocal, rodPinBore)), -.10, .10), rodMaterial);
  rodBody.userData.role = 'eccentric-rod-body-with-gab-notch-fork-and-eye';
  rodBody.geometry.userData.bores = [{x: rodPinLocal.x, y: rodPinLocal.y, radius: rodPinBore}];
  const rodHangerPin = cylinderAlongZ(.07, .37, pinMaterial, 28);
  rodHangerPin.position.set(rodPinLocal.x, rodPinLocal.y, -.085);
  rodHangerPin.userData.role = 'pin-joining-hanger-to-eccentric-rod-eye';
  eccentricRod.add(rodBody, rodHangerPin);

  // Bell crank: upright operating arm, pivot eye, tapered short arm, crank eye.
  const bellCrank = new THREE.Group();
  bellCrank.position.set(bellPivot.x, bellPivot.y, 0);
  bellCrank.userData.axis = Z_AXIS.clone();
  bellCrank.userData.role = 'bell-crank-with-upright-operating-rod-and-short-crank';
  const bl = (x, y) => fromRaster(x, y).sub(bellPivot).toArray();
  const pivotBore = .136, crankBore = .08;
  const bellCrankPlate = new THREE.Mesh(plate(polygonClipping.difference(polygonClipping.union(
    disc([0, 0], 21.5 * PX), disc(crankLocal, 16 * PX),
    poly([bl(395, 28), bl(408, 28), bl(408, 236), bl(395, 236)]),
    poly([bl(402, 223), bl(472, 228), bl(472, 244), bl(402, 249)]),
  ), disc([0, 0], pivotBore), disc(crankLocal, crankBore)), -.08, .08), crankMaterial);
  bellCrankPlate.userData.role = 'bell-crank-plate-upright-rod-eye-and-crank';
  bellCrankPlate.geometry.userData.bores = [{x: 0, y: 0, radius: pivotBore},
    {x: crankLocal.x, y: crankLocal.y, radius: crankBore}];
  const crankPin = cylinderAlongZ(.07, .35, pinMaterial, 28);
  crankPin.position.set(crankLocal.x, crankLocal.y, -.095);
  crankPin.userData.role = 'pin-joining-crank-eye-to-hanger';
  bellCrank.add(bellCrankPlate, crankPin);
  // Fixed stud of the bell crank; it ends behind the crank, unsupported as drawn.
  const pivotPin = cylinderAlongZ(.125, .24, pinMaterial, 30);
  pivotPin.position.set(bellPivot.x, bellPivot.y, -.04);
  pivotPin.userData.role = 'fixed-bell-crank-stud';

  // Hanging link, behind the crank eye and the rod eye (Brown draws both eyes
  // whole over its ends).
  const hangerLink = makeBoredPlanarLink({length: hangerLength, width: 14 * PX, eyeRadius: .2,
    boreRadius: .08, depth: .14}, hangerMaterial);
  hangerLink.userData.role = 'hanging-link-from-crank-to-eccentric-rod';

  root.add(valveRocker, eccentricRod, bellCrank, pivotPin, hangerLink);

  const cameraEnvelope = new THREE.Mesh(new THREE.BoxGeometry(8.6, 8.6, .8),
    new THREE.MeshBasicMaterial({colorWrite: false, depthWrite: false, transparent: true, opacity: 0}));
  cameraEnvelope.position.set(-1.27, 2.22, 0);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.role = 'invisible-source-plate-camera-envelope';
  root.add(cameraEnvelope);

  const update = (time) => {
    const s = stateAtTime(time);
    valveRocker.rotation.z = s.rocker;
    eccentricRod.position.set(s.gab.x, s.gab.y, 0);
    eccentricRod.rotation.z = s.rodAngle;
    bellCrank.rotation.z = s.psi;
    hangerLink.userData.setEndpoints(new THREE.Vector3(s.crankPin.x, s.crankPin.y, -.19),
      new THREE.Vector3(s.rodPin.x, s.rodPin.y, -.19));
    root.userData.kinematics = s;
    root.userData.contacts = {gabPin: {engaged: s.gabEngaged, pin: s.pin.clone(), gab: s.gab.clone(),
      clearanceBelowRod: s.pinClearanceBelowRod}};
  };

  const jointChecks = [
    [valveArm, valveShaft], [valveArm, valvePin], [rodBody, valvePin], [rodBody, rodHangerPin],
    [hangerLink, rodHangerPin], [hangerLink, crankPin], [bellCrankPlate, crankPin], [bellCrankPlate, pivotPin],
  ];
  const geometry = {
    cyclePeriod: PERIOD, sourceUnitsPerPixel: PX, sourceRaster: SOURCE_RASTER_189, rasterOrigin: RASTER_ORIGIN,
    valvePivot: valvePivot.clone(), bellPivot: bellPivot.clone(), crankLocal: crankLocal.clone(),
    handleTopLocal: handleTopLocal.clone(), rodPinLocal: rodPinLocal.clone(), eccentricLocal: eccLocal.clone(),
    hangerLength, rockerAmplitude, pinRadius, notchHalfWidth, rodBottomY, clearMargin, maximumCrankAngle,
    liftWindow: LIFT, lowerWindow: LOWER, speedKeys: SPEED_KEYS, eccentricTurnsPerCycle: 4,
  };
  Object.assign(root.userData, {
    fidelity: 'authored',
    archetype: 'bell-crank-hanger-lifted-eccentric-rod-gab-pin-release',
    mechanism: 'upright-bell-crank-and-hanging-link-rock-the-eccentric-rod-about-its-forked-end-to-lift-the-gab-off-the-valve-pin',
    geometry,
    animationTiming: {authoredCyclePeriod: PERIOD},
    minimumDisplayCycleSeconds: PERIOD,
    hideGround: true,
    jointChecks,
    rigidBodies: [valveRocker, eccentricRod, bellCrank, hangerLink],
    blocks: {valveRocker, valveArm, valveShaft, valveShaftFace: valveArm, valvePin, eccentricRod, rodBody,
      rodHangerPin, bellCrank, bellCrankPlate, crankPin, pivotPin, hangerLink, cameraEnvelope},
    stateAtTime, poseAt, eccentricTurnsAt, handleFractionAt,
    sourcePointFromRaster: (p) => fromRaster(p.x, p.y), sourceRasterFromPoint: toRaster,
    cameraDistanceScale: 1,
  });

  update(0);
  markShadows(root);
  cameraEnvelope.castShadow = cameraEnvelope.receiveShadow = false;
  return {cameraDirection: new THREE.Vector3(0.03, 0.02, 1), root, update};
}
