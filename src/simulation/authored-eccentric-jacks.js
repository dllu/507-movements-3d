import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import {fitPistonGuide,boredCylinderGeometry} from './piston-guide-parts.js';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
import {bladePieces,clearRackPieces,cubicPoints,easeClick,restingContinuation,sampleTable} from './lifting-jack-contact.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function quintic(parameter) {
  const u = THREE.MathUtils.clamp(parameter, 0, 1);
  return u ** 3 * (10 + u * (-15 + 6 * u));
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

// Brown's plate 389 is 525 px square; the rack body (x 207–243) is 0.60 wide.
const PLATE_SCALE = 0.60 / 35;
const GROUND_Y = -1.17;
const plateX = (x) => (x - 225) * PLATE_SCALE;
const plateY = (y) => GROUND_Y + (464 - y) * PLATE_SCALE;

// A traced pawl blade in plate pixels about its pivot (y up), rotated so the
// local +x axis runs from the pivot through the tip, and scaled to model units.
function bladeInLocalFrame(tip, upper, lower) {
  const angle = Math.atan2(tip[1], tip[0]);
  const c = Math.cos(-angle), s = Math.sin(-angle);
  const map = ([x, y]) => [(c * x - s * y) * PLATE_SCALE, (s * x + c * y) * PLATE_SCALE];
  return {length: Math.hypot(...tip) * PLATE_SCALE, upper: upper.map(map), lower: lower.map(map)};
}

function makeVerticalRatchetRack({
  bodyMaterial,
  bodyWidth,
  bottomY,
  depth,
  driveReferenceY,
  saddleMaterial,
  toothDepth,
  toothIndices,
  toothMaterial,
  toothPitch,
  topY,
  whiteMaterial,
}) {
  const group = new THREE.Group();
  group.userData.role = 'vertically-guided-load-bearing-ratchet-rack';

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth, topY - bottomY, depth),
    bodyMaterial,
  );
  body.position.y = (topY + bottomY) / 2;
  body.userData.role = 'vertical-jack-rack-bar';
  group.add(body);

  // Brown's teeth: a flat underside for the pawl noses, a sloping back.
  const toothShape = new THREE.Shape();
  toothShape.moveTo(0, -toothPitch / 2);
  toothShape.lineTo(toothDepth, -toothPitch / 2);
  toothShape.lineTo(0, toothPitch / 2);
  toothShape.closePath();
  const toothGeometry = new THREE.ExtrudeGeometry(toothShape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth,
    steps: 1,
  });
  toothGeometry.translate(0, 0, -depth / 2);

  const teeth = [];
  const toothSeatOffsets = [];
  for (const toothIndex of toothIndices) {
    const tooth = new THREE.Mesh(toothGeometry, toothMaterial);
    const seatY = driveReferenceY + toothIndex * toothPitch;
    tooth.position.set(bodyWidth / 2, seatY + toothPitch / 2, 0);
    tooth.userData.materialToothIndex = toothIndex;
    tooth.userData.role = 'one-way-vertical-rack-tooth';
    tooth.userData.seatY = seatY;
    group.add(tooth);
    teeth.push(tooth);
    toothSeatOffsets.push(seatY);
  }

  // The jack head: Brown's trapezoid in section, a turned frustum seated
  // directly on the rack top.
  const saddle = new THREE.Group();
  saddle.userData.role = 'jack-load-saddle';
  const headHeight = plateY(32) - plateY(54);
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry((278 - 190) * PLATE_SCALE / 2, (270 - 200) * PLATE_SCALE / 2, headHeight, 64),
    saddleMaterial,
  );
  head.position.y = topY + headHeight / 2;
  head.userData.role = 'jack-load-bearing-top-plate';
  saddle.add(head);
  group.add(saddle);

  const liftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, toothPitch * 0.72, 0.035),
    whiteMaterial,
  );
  liftIndex.position.set(-bodyWidth / 2 - 0.06, 1.15, depth / 2 + 0.02);
  liftIndex.userData.role = 'white-rack-vertical-lift-index';
  group.add(liftIndex);

  group.userData.body = body;
  group.userData.head = head;
  group.userData.liftIndex = liftIndex;
  group.userData.saddle = saddle;
  group.userData.teeth = teeth;
  group.userData.toothSeatOffsets = toothSeatOffsets;
  return markShadows(group);
}

function makeJackFrame({
  rackBodyWidth,
  rackTopY,
  material,
  rightInnerX,
  toothPitch,
  whiteMaterial,
}) {
  const group = new THREE.Group();
  group.userData.role = 'fixed-cast-jack-frame-and-rack-guide';

  // Brown draws the cast stand in section: two hatched walls either side of
  // the rack flare concavely into stepped feet; the right wall stops below
  // the eccentric.  Outlines are his, in plate pixels.
  const standDepth = 1.0;
  const standBackZ = -0.55;
  const groundY = GROUND_Y;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(3.02, 0.12, standDepth),
    material,
  );
  base.position.set(0.16, groundY + 0.06, standBackZ + standDepth / 2);
  base.userData.role = 'wide-jack-foot';
  group.add(base);

  const guideBack = new THREE.Mesh(
    new THREE.BoxGeometry(rackBodyWidth + 0.42, rackTopY - groundY, 0.24),
    material,
  );
  guideBack.position.set(0, (rackTopY + groundY) / 2, -0.47);
  guideBack.userData.role = 'fixed-rear-rack-guide-cheek';
  group.add(guideBack);

  const wallProfile = (side) => {
    const shape = new THREE.Shape();
    const p = (x, y) => new THREE.Vector2(plateX(x), plateY(y));
    const inner = side < 0 ? -rackBodyWidth / 2 - 0.004 : rightInnerX;
    const outline = side < 0
      ? {top: [190, 187], upper: [186, 395], control: [181, 447], toe: [132, 447], step: [132, 460], foot: [110, 460]}
      : {top: [276, 240], upper: [281, 390], control: [286, 447], toe: [335, 447], step: [335, 460], foot: [360, 460]};
    const top = p(...outline.top);
    shape.moveTo(inner, GROUND_Y);
    shape.lineTo(inner, top.y);
    shape.lineTo(top.x, top.y);
    shape.lineTo(p(...outline.upper).x, p(...outline.upper).y);
    shape.quadraticCurveTo(p(...outline.control).x, p(...outline.control).y, p(...outline.toe).x, p(...outline.toe).y);
    shape.lineTo(p(...outline.step).x, p(...outline.step).y);
    shape.lineTo(p(...outline.foot).x, p(...outline.foot).y);
    shape.lineTo(p(...outline.foot).x, GROUND_Y);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: false,
      curveSegments: 24,
      depth: standDepth,
    });
    geometry.translate(0, 0, standBackZ);
    return geometry;
  };

  const feet = [];
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(wallProfile(side), material);
    foot.userData.role = 'cast-jack-frame-flared-foot';
    group.add(foot);
    feet.push(foot);
  }

  const scaleTicks = [];
  for (let index = 0; index <= 3; index += 1) {
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.035, 0.035),
      whiteMaterial,
    );
    tick.position.set(-0.61, 0.58 + index * toothPitch, 0.35);
    tick.userData.role = 'white-one-pitch-lift-scale-tick';
    tick.userData.tickIndex = index;
    group.add(tick);
    scaleTicks.push(tick);
  }

  group.userData.base = base;
  group.userData.feet = feet;
  group.userData.guideBack = guideBack;
  group.userData.scaleTicks = scaleTicks;
  return markShadows(group);
}

function eccentricPawlJack(movement) {
  const root = new THREE.Group();

  // Movement 389 has no official animation or dimensions.  Everything is
  // measured from Brown's plate: the rack teeth (flat undersides, sloping
  // backs), the eccentric strap with its integral curved lifting pawl and the
  // separately pivoted upper stop.  Both pawl noses seat in the root corner
  // under a tooth's flat face.  The eccentric is rocked by a hand lever (not
  // drawn) over the right half of its turn, so the strap never swings into
  // the teeth.  The stroke is what the ratchet needs: one pitch, plus the
  // overtravel for the stop nose to ride out over a tooth and drop in, plus
  // the undershoot for the lifting nose to do the same on its return.
  const rackBodyWidth = 0.60;
  const rootX = rackBodyWidth / 2;
  const rackFaceX = rootX;
  const rackDepth = 0.54;
  const toothDepth = 0.21;
  const toothPitch = 16.4 * PLATE_SCALE;
  const mechanismZ = 0.14;
  const mechanismHalfDepth = 0.11;
  const liftStrokeCount = 3;
  const strokeDuration = 2.4;
  const operatingDuration = liftStrokeCount * strokeDuration;
  const raisedDwellDuration = 0.8;
  const resetDuration = operatingDuration;
  const bottomDwellDuration = 0.6;
  const cycleDuration = operatingDuration + raisedDwellDuration
    + resetDuration + bottomDwellDuration;

  // Brown's lifting pawl: a curved horn from the top of the strap, its upper
  // (outer) edge sweeping down tangent to the strap's right side and its
  // lower edge hollowed, meeting in a sharp nose. Plate pixels about the
  // strap centre (289, 211), y up.
  const driveTipPx = [243 - 289, 211 - 137.5];
  const driveBlade = bladeInLocalFrame(driveTipPx,
    cubicPoints(driveTipPx, [-27.7, 65.4], [35, 54], [35, 0], 20),
    cubicPoints(driveTipPx, [-35.3, 64.5], [-12, 50], [-4, 34.8], 20));
  const drivePawlLength = driveBlade.length;
  const drivePieces = bladePieces(driveBlade.upper, driveBlade.lower);
  const eccentricDiskRadius = 31 * PLATE_SCALE;
  const eccentricStrapRadius = 35 * PLATE_SCALE;
  // Brown's throw is 14 px (0.24). The rocking eccentric is a slider crank
  // on the lifting nose, so its nose travel is little more than twice the
  // throw; the stroke Brown's 12 px teeth need (pitch + stop ride-out +
  // lifting-nose ride-down) takes 0.32 (18.7 px), the least that keeps the
  // strap clear of the tooth tips over the widened rock.
  const eccentricity = 0.32;
  const shaftRadius = 0.15;
  // Brown's eccentric shaft is at (287, 197); it sits 3.5 px right so the
  // strap clears the tooth tips over the whole rock.
  const shaftPlate = new THREE.Vector3(plateX(287) + 0.06, plateY(197), 0);

  // Brown's upper stop: a tapered blade with a slight upward bow, ending in
  // an eye on its pin (276, 121); nose at (243, 91). Plate pixels about the pin.
  const stopTipPx = [243 - 276, 121 - 91];
  const stopBlade = bladeInLocalFrame(stopTipPx,
    cubicPoints(stopTipPx, [-21.6, 26.3], [2, 21], [9.4, 3.4], 16),
    cubicPoints(stopTipPx, [-25.6, 23.3], [-14, 13.5], [-7.4, 6.7], 16));
  const holdingPawlLength = stopBlade.length;
  const stopPieces = bladePieces(stopBlade.upper, stopBlade.lower);
  const stopEyeRadius = 10 * PLATE_SCALE;
  const stopPinRadius = 4 * PLATE_SCALE;

  const seatingOvertravel = 0.24;
  const returnUndershoot = 0.20;

  const tipHeight = (center, x) => center.y + Math.sqrt(drivePawlLength ** 2 - (center.x - x) ** 2);
  const centerAt = (shaft, phi) => new THREE.Vector3(shaft.x + eccentricity * Math.sin(phi), shaft.y - eccentricity * Math.cos(phi), 0);
  // Lowest nose on the rack face over the rock: the start of each stroke.
  let rockLow = -0.6, rockLowHigh = 1.2;
  const rawTip = (phi) => tipHeight(centerAt(shaftPlate, phi), rootX);
  for (let i = 0; i < 80; i += 1) {
    const a = rockLow + (rockLowHigh - rockLow) / 3, b = rockLowHigh - (rockLowHigh - rockLow) / 3;
    if (rawTip(a) < rawTip(b)) rockLowHigh = b; else rockLow = a;
  }
  const rockStart = (rockLow + rockLowHigh) / 2;
  // Vertical placement: the seated nose is Brown's (243, 137.5).
  const driveReferenceY = plateY(137.5);
  const eccentricShaft = shaftPlate.clone();
  eccentricShaft.y += driveReferenceY - returnUndershoot - rawTip(rockStart);
  const camCenterAtAngle = (phi) => centerAt(eccentricShaft, phi);
  const engagedNoseY = (phi) => tipHeight(camCenterAtAngle(phi), rootX);
  const followerLowY = engagedNoseY(rockStart);
  let rockEnd;
  {
    let a = rockStart, b = rockStart + Math.PI * 1.2;
    const target = driveReferenceY + toothPitch + seatingOvertravel;
    for (let i = 0; i < 80; i += 1) {
      const mid = (a + b) / 2;
      if (engagedNoseY(mid) < target) a = mid; else b = mid;
    }
    rockEnd = (a + b) / 2;
  }
  const followerHighY = engagedNoseY(rockEnd);
  const rockAngle = (u) => rockStart + (rockEnd - rockStart) * (1 - Math.cos(FULL_TURN * u)) / 2;
  const rockRate = (u) => (rockEnd - rockStart) * Math.PI * Math.sin(FULL_TURN * u);

  const toothIndices = Array.from({length: 19}, (_, i) => i - 14);
  const rackTriangles = toothIndices.map((i) => {
    const y = driveReferenceY + i * toothPitch;
    return [[rootX, y], [rootX + toothDepth, y], [rootX, y + toothPitch]];
  });

  // Brown draws the stop nose three teeth above the lifting nose; it sits one
  // pitch higher so the lifting horn, rising through its full ratchet
  // stroke, passes clear beneath the stop's eye. With the stop on Brown's
  // tooth, the horn (Brown's outline, 26 px below the eye at rest) rises and
  // turns into the eye by about 0.05 once the rack has risen one pitch,
  // whatever the throw or tooth depth (checked for throws 0.24-0.34 and tooth depths 6-12 px).
  const stopBaseToothIndex = 4;
  const stopSeatY = driveReferenceY + stopBaseToothIndex * toothPitch;
  const holdingOffset = new THREE.Vector3((276 - 243) * PLATE_SCALE, (91 - 121) * PLATE_SCALE, 0);
  const holdingPivot = new THREE.Vector3(rootX, stopSeatY, 0).add(holdingOffset);
  const holdingBaseAngle = Math.atan2(-holdingOffset.y, -holdingOffset.x);
  const holdingVerticalOffset = -holdingOffset.y;

  // Drive pose for a nose clearance c off the rack face.
  const drivePose = (phi, clearance) => {
    const center = camCenterAtAngle(phi);
    const x = rootX + clearance;
    const nose = new THREE.Vector3(x, tipHeight(center, x), 0);
    return {center, nose, angle: Math.atan2(nose.y - center.y, nose.x - center.x)};
  };
  const driveClear = (phi, lift) => (clearance) => {
    const pose = drivePose(phi, clearance);
    return clearRackPieces(drivePieces, pose.center, pose.angle, rackTriangles, lift);
  };
  const holdingClear = (lift) => (retreat) => clearRackPieces(stopPieces, holdingPivot, holdingBaseAngle - retreat, rackTriangles, lift);

  // Rack displacement within a stroke is w above the stored pitch.
  const strokePhaseForNose = (target, rising) => {
    let a = rising ? 0 : 0.5, b = rising ? 0.5 : 1;
    for (let i = 0; i < 70; i += 1) {
      const mid = (a + b) / 2, y = engagedNoseY(rockAngle(mid));
      if ((y < target) === rising) a = mid; else b = mid;
    }
    return (a + b) / 2;
  };
  const engageFraction = strokePhaseForNose(driveReferenceY, true);
  const transferFraction = strokePhaseForNose(driveReferenceY + toothPitch, false);

  // Each pawl rests on the rack profile (gravity or spring toward the teeth)
  // and is pushed out by it; the resting coordinate is followed pose by pose
  // so it stays on its own tooth. Its one click into the next root is eased.
  // Lifting pawl: from handing over the load (seated) through its return and
  // the next approach until it is seated again, the rack standing one pitch up.
  const tableSamples = 720;
  const driveSpan = 1 - transferFraction + engageFraction;
  const driveU = (i) => positiveModulo(transferFraction + driveSpan * i / tableSamples, 1);
  const driveTable = easeClick(restingContinuation(
    (i) => driveClear(rockAngle(driveU(i)), toothPitch), tableSamples, 0, 0.6, 0.0005, 0), Math.round(tableSamples * 0.16 / driveSpan));
  // Upper stop: from the start of the power stroke through overtravel and
  // settling, the rack w above its stored pitch.
  const stopSpan = transferFraction - engageFraction;
  const stopW = (i) => engagedNoseY(rockAngle(engageFraction + stopSpan * i / tableSamples)) - driveReferenceY;
  const stopTable = easeClick(restingContinuation(
    (i) => holdingClear(stopW(i)), tableSamples, 0, 0.9, 0.0005, 0), Math.round(tableSamples * 0.18 / stopSpan));
  const tableGap = (value) => value <= 0 ? 0 : value + 0.002 * Math.min(1, value / 0.01);
  const driveClearanceAt = (u) => tableGap(sampleTable(driveTable.values, positiveModulo(u - transferFraction, 1) / driveSpan));
  const holdingRetreatAt = (u) => tableGap(sampleTable(stopTable.values, (u - engageFraction) / stopSpan));

  const rackMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.55,
  });
  const pawlMaterial = matte(PALETTE.brass, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.10,
    roughness: 0.69,
  });
  const pinMaterial = matte(PALETTE.ink, {
    metalness: 0.31,
    roughness: 0.42,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0,
    roughness: 0.43,
  });

  const rackTopY = plateY(54);
  const rackBottomY = plateY(374);
  const rightInnerX = rootX + toothDepth + 0.03;
  const frame = makeJackFrame({
    material: frameMaterial,
    rackBodyWidth,
    rackTopY,
    rightInnerX,
    toothPitch,
    whiteMaterial,
  });
  root.add(frame);

  const rack = makeVerticalRatchetRack({
    bodyMaterial: rackMaterial,
    bodyWidth: rackBodyWidth,
    bottomY: rackBottomY,
    depth: rackDepth,
    driveReferenceY,
    saddleMaterial: rackMaterial,
    toothDepth,
    toothIndices,
    // The teeth are cut in the rack bar itself.
    toothMaterial: rackMaterial,
    toothPitch,
    topY: rackTopY,
    whiteMaterial,
  });
  root.add(rack);

  const eccentricRotor = new THREE.Group();
  eccentricRotor.position.copy(eccentricShaft);
  eccentricRotor.userData.role = 'continuously-rotating-eccentric-driver';
  root.add(eccentricRotor);
  const eccentricDisk = new THREE.Mesh(
    plate(clip.difference(poly(circle([eccentricity, 0], eccentricDiskRadius, 96)), poly(circle([0, 0], shaftRadius, 64))),
      mechanismZ - mechanismHalfDepth + 0.01, mechanismZ + mechanismHalfDepth - 0.01),
    driverMaterial,
  );
  eccentricDisk.userData.role = 'offset-eccentric-disk';
  eccentricRotor.add(eccentricDisk);
  const eccentricIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.055, 0.035),
    whiteMaterial,
  );
  eccentricIndex.position.set(eccentricity + 0.19, 0, 0.3);
  eccentricIndex.userData.role = 'white-eccentric-disk-spin-index';
  eccentricRotor.add(eccentricIndex);

  const eccentricShaftPin = cylinderAlongZ(shaftRadius - 0.004, 0.84, pinMaterial, 28);
  eccentricShaftPin.position.set(eccentricShaft.x, eccentricShaft.y, -0.12);
  eccentricShaftPin.userData.role = 'fixed-eccentric-input-shaft';
  root.add(eccentricShaftPin);

  // Strap and lifting pawl are one forging: the strap ring and Brown's horn.
  const driveOutline = [...driveBlade.upper, [0, 0], ...[...driveBlade.lower].reverse()];
  const strapShape = clip.difference(
    clip.union(poly(circle([0, 0], eccentricStrapRadius, 128)), poly(driveOutline)),
    poly(circle([0, 0], eccentricDiskRadius + 0.004, 128)),
  );
  const driveBody = new THREE.Mesh(plate(strapShape, mechanismZ - mechanismHalfDepth, mechanismZ + mechanismHalfDepth), pawlMaterial);
  driveBody.userData.role = 'eccentric-strap-with-integral-curved-lifting-pawl';
  const drivingPawl = new THREE.Group();
  drivingPawl.userData.role = 'rigid-eccentric-strap-lifting-pawl';
  drivingPawl.add(driveBody);
  drivingPawl.userData.setEndpoints = (a, b) => {
    drivingPawl.position.set(a.x, a.y, 0);
    drivingPawl.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
  };
  root.add(drivingPawl);
  const eccentricStrap = driveBody;
  const drivingNose = new THREE.Object3D();
  drivingNose.userData.role = 'lifting-pawl-rack-working-nose';
  root.add(drivingNose);

  const holdingPawl = new THREE.Group();
  holdingPawl.position.copy(holdingPivot);
  holdingPawl.userData.role = 'upper-fixed-pivot-load-holding-stop-pawl';
  const stopOutline = [...stopBlade.upper, [0, 0], ...[...stopBlade.lower].reverse()];
  const holdingPawlBody = new THREE.Mesh(plate(clip.difference(
    clip.union(poly(stopOutline), poly(circle([0, 0], stopEyeRadius, 64))),
    poly(circle([0, 0], stopPinRadius + 0.004, 48)),
  ), mechanismZ - mechanismHalfDepth, mechanismZ + mechanismHalfDepth), pawlMaterial);
  holdingPawlBody.userData.role = 'upper-stop-pawl-rigid-body';
  holdingPawl.add(holdingPawlBody);
  const holdingPivotPin = cylinderAlongZ(stopPinRadius, 0.84, pinMaterial, 32);
  holdingPivotPin.position.z = -0.12;
  holdingPivotPin.userData.role = 'upper-stop-pawl-fixed-pivot-pin';
  holdingPawl.add(holdingPivotPin);
  root.add(holdingPawl);

  // Minimal undrawn supports behind the stand: bored bosses for the two
  // fixed pins, carried by bridges from a spine behind the rack.
  const fixedSupports = [];
  for (const [pivot, radius] of [[eccentricShaft, shaftRadius], [holdingPivot, stopPinRadius]]) {
    const journal = new THREE.Mesh(boredCylinderGeometry(radius + 0.08, radius + 0.004, 0.24), frameMaterial);
    journal.rotation.x = Math.PI / 2;
    journal.position.set(pivot.x, pivot.y, -0.43);
    journal.userData.role = 'fixed-bored-jack-pawl-support';
    root.add(journal);
    fixedSupports.push(journal);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(pivot.x - radius - 0.07, 0.16, 0.24), frameMaterial);
    bridge.position.set((pivot.x - radius - 0.07) / 2, pivot.y, -0.51);
    bridge.userData.role = 'fixed-rear-pawl-support-bridge';
    root.add(bridge);
    fixedSupports.push(bridge);
  }
  const spineTop = holdingPivot.y + 0.08;
  const supportSpine = new THREE.Mesh(new THREE.BoxGeometry(0.25, spineTop - GROUND_Y, 0.24), frameMaterial);
  supportSpine.position.set(-0.12, (spineTop + GROUND_Y) / 2, -0.51);
  supportSpine.userData.role = 'fixed-rear-pawl-support-spine';
  root.add(supportSpine);
  fixedSupports.push(supportSpine);
  for (const y of [0.35, 1.15]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.18, 0.12), frameMaterial);
    cheek.position.set(-0.04, y, 0.35);
    cheek.userData.role = 'fixed-front-rack-guide-strap';
    root.add(cheek);
    fixedSupports.push(cheek);
  }

  const driveContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.060, 18, 12),
    whiteMaterial,
  );
  driveContactMarker.position.z = 0.3;
  driveContactMarker.userData.role = 'white-active-lifting-pawl-contact-index';
  root.add(driveContactMarker);
  const stopContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    whiteMaterial,
  );
  stopContactMarker.position.z = 0.3;
  stopContactMarker.userData.role = 'white-active-upper-stop-contact-index';
  root.add(stopContactMarker);

  const holdingTipAtAngle = (angle) => holdingPivot.clone().add(
    new THREE.Vector3(holdingPawlLength * Math.cos(angle), holdingPawlLength * Math.sin(angle), 0),
  );
  const noseRate = (phi, phiRate) => {
    const center = camCenterAtAngle(phi), h = center.x - rootX;
    return (eccentricity * Math.sin(phi) - h * eccentricity * Math.cos(phi) / Math.sqrt(drivePawlLength ** 2 - h * h)) * phiRate;
  };

  const rawStateAtTime = (time) => {
    const wrappedTime = positiveModulo(time, cycleDuration);
    const raisedDwellStarts = operatingDuration;
    const resetStarts = raisedDwellStarts + raisedDwellDuration;
    const bottomDwellStarts = resetStarts + resetDuration;
    if (wrappedTime >= resetStarts && wrappedTime < bottomDwellStarts) {
      // Lowering: the operator rocks the eccentric the other way round, so
      // the lifting strokes play backward. The strap pawl lets the rack down
      // one pitch per rock while the stop pawl is held off each tooth.
      const mirrored = rawStateAtTime(operatingDuration - (wrappedTime - resetStarts));
      return {
        ...mirrored,
        eccentricAngularSpeed: -mirrored.eccentricAngularSpeed,
        rackSpeed: -mirrored.rackSpeed,
        stage: `lowering-reversed-${mirrored.stage}`,
      };
    }
    let strokeIndex, strokePhase;
    if (wrappedTime < operatingDuration) {
      const coordinate = wrappedTime / strokeDuration;
      strokeIndex = Math.min(liftStrokeCount - 1, Math.floor(coordinate));
      strokePhase = coordinate - strokeIndex;
    } else if (wrappedTime < resetStarts) {
      strokeIndex = liftStrokeCount - 1;
      strokePhase = 1;
    } else {
      strokeIndex = 0;
      strokePhase = 0;
    }
    const dwell = wrappedTime >= operatingDuration;
    const phi = rockAngle(strokePhase);
    const phiRate = dwell ? 0 : rockRate(strokePhase) / strokeDuration;
    const noseY = engagedNoseY(phi);
    const w = noseY - driveReferenceY;
    const rising = strokePhase <= 0.5;
    let rackDisplacement, rackSpeed = 0, driveClearance = 0, holdingRetreat = 0;
    let drivingEngaged = false, holdingEngaged = true, stage;
    if (rising && w > 0) {
      rackDisplacement = strokeIndex * toothPitch + w;
      rackSpeed = noseRate(phi, phiRate);
      drivingEngaged = true;
      holdingRetreat = holdingRetreatAt(strokePhase);
      holdingEngaged = holdingRetreat === 0;
      stage = 'eccentric-power-stroke-lifting-rack';
    } else if (!rising && w > toothPitch) {
      rackDisplacement = strokeIndex * toothPitch + w;
      rackSpeed = noseRate(phi, phiRate);
      drivingEngaged = true;
      holdingRetreat = holdingRetreatAt(strokePhase);
      holdingEngaged = false;
      stage = 'overtravel-settling-onto-seated-upper-stop';
    } else if (rising) {
      rackDisplacement = strokeIndex * toothPitch;
      driveClearance = driveClearanceAt(strokePhase);
      stage = 'lifting-pawl-nose-sliding-into-root';
    } else {
      rackDisplacement = (strokeIndex + 1) * toothPitch;
      driveClearance = driveClearanceAt(strokePhase);
      stage = 'lifting-pawl-return-upper-stop-holding';
    }
    const pose = drivePose(phi, driveClearance);
    const holdingAngle = holdingBaseAngle - holdingRetreat;
    const holdingTip = holdingTipAtAngle(holdingAngle);
    const completedStrokeCount = Math.round(rackDisplacement / toothPitch - (drivingEngaged ? 0.5 : 0));
    const driveMaterialToothIndex = -strokeIndex;
    const driveToothSeatY = driveReferenceY + driveMaterialToothIndex * toothPitch + rackDisplacement;
    const holdingMaterialToothIndex = stopBaseToothIndex - Math.round(rackDisplacement / toothPitch - 0.5 + 1e-9);
    const holdingToothSeatY = driveReferenceY + holdingMaterialToothIndex * toothPitch + rackDisplacement;
    return {
      camCenter: pose.center,
      completedStrokeCount,
      driveClearance,
      driveMaterialToothIndex,
      driveNose: pose.nose,
      drivePawlLength: pose.center.distanceTo(pose.nose),
      drivePawlAngle: pose.angle,
      driveToothSeatY,
      drivingContactError: drivingEngaged ? pose.nose.y - driveToothSeatY : null,
      drivingEngaged,
      eccentricAngle: phi,
      eccentricAngularSpeed: phiRate,
      eccentricRotorAngle: phi - Math.PI / 2,
      holdingAngle,
      holdingContactError: holdingEngaged
        ? holdingTip.distanceTo(new THREE.Vector3(rootX, holdingToothSeatY, 0))
        : null,
      holdingEngaged,
      holdingMaterialToothIndex,
      holdingRetreat,
      holdingTip,
      holdingToothSeatY,
      rackAcceleration: 0,
      rackDisplacement,
      rackSpeed,
      stage: dwell ? (wrappedTime < resetStarts ? 'three-pitch-raised-load-dwell' : 'lowered-jack-dwell') : stage,
      stopSeatY,
      strokeIndex,
      strokePhase,
    };
  };
  const stateAtTime = rawStateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    rack.position.y = state.rackDisplacement;
    rack.userData.velocity = new THREE.Vector3(0, state.rackSpeed, 0);
    eccentricRotor.rotation.z = state.eccentricRotorAngle;
    eccentricRotor.userData.angularSpeed = state.eccentricAngularSpeed;
    drivingPawl.userData.setEndpoints(state.camCenter, state.driveNose);
    drivingPawl.userData.endpoints = {
      end: state.driveNose.clone(),
      start: state.camCenter.clone(),
    };
    drivingNose.position.set(state.driveNose.x, state.driveNose.y, mechanismZ);
    holdingPawl.rotation.z = state.holdingAngle;
    driveContactMarker.visible = state.drivingEngaged;
    driveContactMarker.position.x = state.driveNose.x;
    driveContactMarker.position.y = state.driveNose.y;
    stopContactMarker.visible = state.holdingEngaged;
    stopContactMarker.position.x = rootX;
    stopContactMarker.position.y = stopSeatY;
    root.userData.contacts = {
      drivingPawlToRack: {
        active: state.drivingEngaged,
        clearance: state.driveClearance,
        contactError: state.drivingContactError,
        materialToothIndex: state.driveMaterialToothIndex,
      },
      upperStopToRack: {
        active: state.holdingEngaged,
        contactError: state.holdingContactError,
        materialToothIndex: state.holdingMaterialToothIndex,
        seatY: state.holdingToothSeatY,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData = {
    archetype:
      'eccentric-strap-lifting-pawl-linear-ratchet-rack-upper-holding-stop-jack',
    blocks: {
      driveContactMarker,
      driveBody,
      fixedSupports,
      drivingNose,
      drivingPawl,
      eccentricDisk,
      eccentricIndex,
      eccentricRotor,
      eccentricShaftPin,
      eccentricStrap,
      frame,
      frameScaleTicks: frame.userData.scaleTicks,
      holdingPawl,
      holdingPawlBody,
      holdingPivotPin,
      rack,
      rackBody: rack.userData.body,
      rackHead: rack.userData.head,
      rackLiftIndex: rack.userData.liftIndex,
      rackSaddle: rack.userData.saddle,
      rackTeeth: rack.userData.teeth,
      stopContactMarker,
    },
    constraintResiduals: {
      driveFollowerStrokeBudget:
        followerHighY - followerLowY - toothPitch - seatingOvertravel - returnUndershoot,
      holdingPawlSeatedLength: holdingPivot.distanceTo(
        new THREE.Vector3(rootX, stopSeatY, 0),
      ) - holdingPawlLength,
      lowFollowerLinkLength: camCenterAtAngle(rockStart)
        .distanceTo(new THREE.Vector3(rootX, followerLowY, 0)) - drivePawlLength,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      inputs: [
        'rocking eccentric-shaft angle during each lifting stroke',
      ],
      note:
        'the eccentric centre, rigid strap pawl and rack-face root constraint determine the lift; each pawl otherwise rests on the rack profile (its free swing is found by contact), and the upper pawl stores each one-pitch ratchet advance during the lifting-pawl return',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'the eccentric disk turns about one fixed shaft inside its strap with 0.004 running clearance',
        'the lifting pawl is one rigid forging with the strap; its free swing about the eccentric is set by resting on the rack profile',
        'the upper stop swings on a fixed pin and rests on the rack profile; each click into the next root is eased over the rest of the overtravel',
        'rack, head and load are rigid; pivots are frictionless and tooth impact, deformation, force, friction and inertia are omitted',
        'three lifting strokes followed by three reversed lowering strokes (the stop pawl held off by hand), plus the rocking range, timing, materials, depth and camera, are reconstruction decisions',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      treatment:
        'geometrically closed eccentric-follower power strokes with both noses seated in the tooth roots and contact-found ratchet rides, then the same strokes reversed to let the rack down a pitch at a time',
    },
    fidelity: 'authored',
    geometry: {
      drivePawlLength,
      seatingOvertravel,
      returnUndershoot,
      rackToothCount: toothIndices.length,
      rockStart,
      rockEnd,
      engageFraction,
      transferFraction,
      driveClick: {index: driveTable.clickIndex, crest: driveTable.crest, jump: driveTable.jump},
      stopClick: {index: stopTable.clickIndex, crest: stopTable.crest, jump: stopTable.jump},
      driveReferenceY,
      eccentricDiskRadius,
      eccentricShaft: eccentricShaft.clone(),
      eccentricStrapRadius,
      eccentricity,
      followerHighY,
      followerLowY,
      holdingBaseAngle,
      holdingPawlLength,
      holdingVerticalOffset,
      holdingPivot: holdingPivot.clone(),
      liftStrokeCount,
      mechanismZ,
      rackBodyWidth,
      rackDepth,
      rackFaceX,
      rootX,
      rackTopY,
      rackBottomY,
      stopBaseToothIndex,
      stopSeatY,
      toothDepth,
      toothPitch,
      drivePieces,
      stopPieces,
      rackTriangles,
    },
    mechanism:
      'one-fixed-shaft-eccentric-disk-one-circular-strap-and-rigid-lifting-pawl-one-vertical-ratchet-rack-one-separate-upper-load-holding-stop-pawl',
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'the official Movement 389 page exposes no canvas animation; topology and working direction are reconstructed from Brown\'s public-domain engraving and description',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate389: {
        drivePawlNosePixels: [243, 137.5],
        eccentricOuterCenterPixels: [289, 211],
        eccentricOuterRadiusPixels: 35,
        eccentricShaftPixels: [287, 197],
        holdingPawlNosePixels: [243, 91],
        holdingPawlPivotPixels: [276, 121],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 3,
        rackBodyEdgesPixels: {
          leftX: 207,
          rightX: 243,
        },
        rackToothPitchPixels: 16.4,
        rackToothTipX: 255,
        saddleExtentPixels: {
          maximumX: 278,
          maximumY: 54,
          minimumX: 190,
          minimumY: 32,
        },
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the machine is a lifting jack',
          'the operating elements are an eccentric, pawl, and ratchet',
          'the upper pawl is specifically a stop',
        ],
        engravingEvidence:
          'the plate shows a load head on a vertically guided one-sided rack whose teeth have flat undersides, a circular eccentric strap with an integral curved pointed lifting pawl, and a separately fixed-pivot curved upper pawl, both noses sitting in tooth roots',
        reconstructionDisclosure:
          'no official animation is available; the rocking eccentric, stroke, contact rides, timing, reversed lowering strokes, materials, depth and camera are independently engineered; the eccentric throw (18.7 px against Brown\'s 14 px), the shaft 3.5 px right, the noses sharpened to a 16–22 degree wedge and the stop one pitch higher than drawn are what the full ratchet stroke needs',
      },
      officialPage: movement.sourceUrl,
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    crankStateAtTime: rawStateAtTime,
    playbackTimeAtCrankTime: (crankTime) => crankTime,
    timeline: {
      bottomDwellDuration,
      cycleDuration,
      demonstrationPeriod: cycleDuration,
      events: {
        bottomDwellStarts:
          operatingDuration + raisedDwellDuration + resetDuration,
        raisedDwellStarts: operatingDuration,
        resetStarts: operatingDuration + raisedDwellDuration,
      },
      liftStrokeCount,
      operatingDuration,
      raisedDwellDuration,
      resetDuration,
      strokeDuration,
      note:
        'three rocking lifting strokes are followed by a raised dwell and three lowering strokes, the lifting strokes played backward, so the rack comes down one pitch per rock on the strap pawl while the stop pawl is held off by hand',
    },
    transmission: {
      driveFollowerLaw:
        'camCenter=(Sx+e*sin(phi), Sy-e*cos(phi)) with phi rocking between rockStart and rockEnd; the rigid pawl nose sits in the root corner on the rack face',
      holdingLaw:
        'the upper stop rides up the back of the rising tooth, drops into the next root during overtravel, and alone prevents rack descent during lifting-pawl return',
      indexingLaw:
        'one follower excursion covers the rack pitch plus seating overtravel and return undershoot; each rock stores exactly one additional pitch',
      resetLaw:
        'lowering rocks the eccentric the other way: the strap pawl carries the rack down one pitch per rock and the stop pawl is held off each descending tooth (the lifting poses, time-reversed)',
    },
  };

  update(0);
  fitPistonGuide(root, update, cycleDuration);
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.12, 0.18, 11),
    root,
    update,
  };
}

export function createAuthoredEccentricJackMovement(movement) {
  if (movement.id !== 389) return null;
  return applyCutawayFor(eccentricPawlJack(movement), movement.id);
}
