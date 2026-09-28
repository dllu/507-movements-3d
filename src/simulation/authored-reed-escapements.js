import {finishReed396Parts} from './reed-396-working-parts.js';
import {reed396} from './reed-396-contact.js';
import {plate as extrudePlate, polygonClipping as clip} from './finite-plate-geometry.js';

// Roller pin i stands this far from balance staff b: far enough that, in the
// fork, it carries lever C exactly from one banking pin to the other.
const PIN_ORBIT = reed396.pinOrbit;
const circlePoints = (radius, count, cx = 0, from = 0, to = FULL_TURN) => Array.from({length: count + 1},
  (_, i) => [cx + radius * Math.cos(from + (to - from) * i / count), radius * Math.sin(from + (to - from) * i / count)]);
import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function rotate2(point, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (x * (x * 6 - 15) + 10);
}

function smootherStepDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * x ** 2 * (1 - x) ** 2;
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevelSize = 0.008) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevelSize > 0,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 48,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function annularShape(outerRadius, innerRadius) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const opening = new THREE.Path();
  opening.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(opening);
  return shape;
}

function beamBetween(start, end, width, depth, material) {
  const direction = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(direction.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(direction.y, direction.x);
  return beam;
}

function makeEscapeWheel({
  darkMaterial,
  depth,
  innerRadius,
  material,
  rootRadius,
  toothCount,
  toothTipRadius,
  whiteMaterial,
}) {
  const rotor = new THREE.Group();
  rotor.userData.role = 'clockwise-stepping-escape-wheel-A';
  const pitch = FULL_TURN / toothCount;
  const shape = new THREE.Shape();
  let first = true;
  for (let tooth = 0; tooth < toothCount; tooth += 1) {
    for (const [offset, radius] of [
      [-0.50, rootRadius],
      [-0.10, rootRadius],
      [0, toothTipRadius],
      [0.15, rootRadius],
      [0.50, rootRadius],
    ]) {
      const angle = (tooth + offset) * pitch;
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      if (first) {
        shape.moveTo(x, y);
        first = false;
      } else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  const opening = new THREE.Path();
  opening.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(opening);
  const toothedRim = new THREE.Mesh(
    centeredExtrusion(shape, depth, 0.006),
    material,
  );
  toothedRim.userData.role = 'twelve-pointed-escape-wheel-rim';
  rotor.add(toothedRim);

  const hub = cylinderAlongZ(0.20, depth * 1.55, darkMaterial, 32);
  hub.userData.role = 'escape-wheel-spindle-a';
  rotor.add(hub);
  const spokeGeometry = new THREE.BoxGeometry(
    innerRadius * 1.86,
    0.13,
    depth * 0.72,
  );
  const spokes = Array.from({ length: 3 }, (_, index) => {
    const spoke = new THREE.Mesh(spokeGeometry, material);
    spoke.rotation.z = index * Math.PI / 3;
    spoke.userData.index = index;
    spoke.userData.role = 'escape-wheel-A-spoke';
    rotor.add(spoke);
    return spoke;
  });
  const spinIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.055, 0.028),
    whiteMaterial,
  );
  spinIndex.position.set(rootRadius + 0.08, 0, depth / 2 + 0.04);
  spinIndex.userData.role = 'white-index-showing-clockwise-escape-wheel-step';
  rotor.add(spinIndex);
  rotor.userData.hub = hub;
  rotor.userData.pitch = pitch;
  rotor.userData.spokes = spokes;
  rotor.userData.spinIndex = spinIndex;
  rotor.userData.toothCount = toothCount;
  rotor.userData.toothedRim = toothedRim;
  return markShadows(rotor);
}

function makeBalance({
  balanceRadius,
  darkMaterial,
  directPalletReach,
  material,
  rollerPinRadius,
  rollerRadius,
  whiteMaterial,
}) {
  const balance = new THREE.Group();
  balance.userData.role =
    'oscillating-balance-B-with-roller-h-pin-i-and-direct-pallet-j';
  // Brown draws balance B as a plain broad rim, two concentric circles,
  // whose edge passes just short of escape-wheel staff a (his rim radius is
  // 0.82 of the centre distance).  He draws no arms; one plain arm (below)
  // carries the rim on its staff.
  const rimOuterRadius = balanceRadius * 0.87;
  const rim = new THREE.Mesh(boredLatheGeometry([
    { axial: -0.08, radial: rimOuterRadius },
    { axial: 0.08, radial: rimOuterRadius },
  ], rimOuterRadius - 0.22, 160), material);
  rim.rotation.x = Math.PI / 2;
  rim.position.z = -0.54;
  rim.userData.role = 'balance-wheel-B-rim';
  balance.add(rim);
  // The rim is carried on its staff by one plain diametral arm lying in the
  // rim's own plane, behind the escape wheel (the wheel staff stands outside
  // the rim, so nothing crosses the arm's sweep).
  const rimArm = new THREE.Mesh(
    new THREE.BoxGeometry(2 * (rimOuterRadius - 0.11), 0.14, 0.10),
    material,
  );
  rimArm.position.z = -0.54;
  rimArm.userData.role = 'balance-wheel-B-arm-to-staff';
  balance.add(rimArm);
  const hub = cylinderAlongZ(0.18, 0.72, darkMaterial, 32);
  hub.position.z = 0.03;
  hub.userData.role = 'balance-staff-b';
  balance.add(hub);

  // Roller h: a small boss on staff b with one arm out to pin i.
  const rollerShape = clip.difference(clip.union(
    [[circlePoints(0.30, 64)]],
    [[[[0, -0.09], [PIN_ORBIT, -0.09], ...circlePoints(0.09, 24, PIN_ORBIT, -Math.PI / 2, Math.PI / 2), [PIN_ORBIT, 0.09], [0, 0.09], [0, -0.09]]]],
  ), [[circlePoints(0.183, 64)]]);
  const roller = new THREE.Mesh(extrudePlate(rollerShape, -0.28, -0.18), darkMaterial);
  void rollerRadius;
  roller.userData.role = 'balance-roller-h';
  balance.add(roller);
  const rollerPin = cylinderAlongZ(rollerPinRadius, 0.28,
    whiteMaterial, 24);
  rollerPin.position.set(PIN_ORBIT, 0, -0.31);
  rollerPin.userData.role = 'roller-impulse-pin-i';
  balance.add(rollerPin);
  const directPallet = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.15, 0.20),
    material,
  );
  directPallet.position.set(directPalletReach - 0.12, 0, 0.25);
  directPallet.userData.role =
    'chronometer-impulse-pallet-j-fast-on-balance-staff';
  balance.add(directPallet);
  const directContactIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 18, 12),
    whiteMaterial,
  );
  directContactIndex.position.set(directPalletReach, 0, 0.38);
  directContactIndex.userData.role =
    'white-index-at-direct-chronometer-impulse-face-j';
  balance.add(directContactIndex);
  const balanceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.30, 0.05),
    whiteMaterial,
  );
  balanceIndex.position.set(balanceRadius, 0, -0.18);
  balanceIndex.userData.role = 'white-index-showing-balance-vibration';
  balance.add(balanceIndex);

  balance.userData.balanceIndex = balanceIndex;
  balance.userData.directContactIndex = directContactIndex;
  balance.userData.directPallet = directPallet;
  balance.userData.hub = hub;
  balance.userData.rim = rim;
  balance.userData.roller = roller;
  balance.userData.rollerPin = rollerPin;
  return markShadows(balance);
}

function makeLever({
  balanceCenter,
  darkMaterial,
  fLocal,
  gLocal,
  leverPivot,
  material,
  rollerRadius,
  whiteMaterial,
}) {
  const lever = new THREE.Group();
  lever.position.set(leverPivot.x, leverPivot.y, 0);
  lever.userData.role =
    'pivoted-crooked-lever-C-with-anchor-crosspiece-h';

  const forkCenterWorld = balanceCenter.clone().add(
    new THREE.Vector2(PIN_ORBIT, 0),
  );
  const forkCenterLocal = forkCenterWorld.clone().sub(leverPivot);
  const crosspiece = beamBetween(
    new THREE.Vector3(fLocal.x, fLocal.y, 0.35),
    new THREE.Vector3(gLocal.x, gLocal.y, 0.35),
    0.12,
    0.18,
    material,
  );
  crosspiece.userData.role = 'anchorlike-crosspiece-h';
  lever.add(crosspiece);
  const makePallet = (name, local, role) => {
    const pallet = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.16, 0.22),
      material,
    );
    pallet.position.set(local.x, local.y, 0.30);
    pallet.rotation.z = name === 'g' ? -0.55 : 0.55;
    pallet.userData.name = name;
    pallet.userData.role = role;
    const index = new THREE.Mesh(
      new THREE.SphereGeometry(0.060, 18, 12),
      whiteMaterial,
    );
    index.position.set(local.x, local.y, 0.46);
    index.userData.role = `white-index-at-pallet-${name}-locking-face`;
    lever.add(pallet, index);
    return { index, pallet };
  };
  const g = makePallet(
    'g',
    gLocal,
    'combined-detent-and-lever-impulse-pallet-g',
  );
  const f = makePallet(
    'f',
    fLocal,
    'chronometer-detent-only-pallet-f',
  );

  // Lever C is one flat plate in one plane, as Brown draws it: fork e, a
  // straight arm along the line of centres bowed in the half-round crook d
  // round escape-wheel staff a, the boss on staff c, and the tail with its
  // hand-shaped end between banking pins l.
  // Fork e works on the part of pin i standing proud of roller h. Its slot
  // runs along the lever through staff c and is the pin's width plus a
  // running clearance, from just past the pin's deepest reach (on the line
  // of centres) to a mouth beyond its exit, so the pin drives the lever bank
  // to bank without ever cutting a prong.
  const slotHalf = 0.072 + 0.008;
  const prong = 0.08;
  const deepest = forkCenterLocal.x + 0.072 + 0.012;
  const mouth = forkCenterLocal.x - 0.18;
  const chamfer = 0.06;
  const back = deepest + 0.12;
  const armHalf = 0.085;
  const crookRadius = 0.55;
  const staffA = -leverPivot.x;
  const lathe = (cx, radius, from, to, count) => Array.from({length: count + 1},
    (_, i) => [cx + radius * Math.cos(from + (to - from) * i / count), radius * Math.sin(from + (to - from) * i / count)]);
  // Hand-shaped tail end: the tail widens along two smooth flanks to a
  // concave end, symmetric about the lever's centre line.
  const hand = [];
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24;
    hand.push([0.60 + 0.36 * t, 0.07 + 0.13 * t * t]);
  }
  const handEnd = lathe(1.18, 0.30, Math.PI - Math.asin(0.2 / 0.30), Math.PI + Math.asin(0.2 / 0.30), 24).reverse();
  const tailOutline = [[0.05, -0.07], [0.60, -0.07], ...hand.map(([x, y]) => [x, -y]).slice(1),
    ...handEnd.filter(([x, y]) => y < 0.2 && y > -0.2), ...[...hand].reverse().slice(0, -1), [0.60, 0.07], [0.05, 0.07]];
  const leverShape = clip.difference(clip.union(
    [[[[mouth, -slotHalf - prong], [back, -slotHalf - prong], [back, slotHalf + prong], [mouth, slotHalf + prong], [mouth, -slotHalf - prong]]]],
    [[[[back - 0.02, -armHalf], [staffA - crookRadius, -armHalf], [staffA - crookRadius, armHalf], [back - 0.02, armHalf], [back - 0.02, -armHalf]]]],
    [[[...lathe(staffA, crookRadius + armHalf, Math.PI, 2 * Math.PI, 64), ...lathe(staffA, crookRadius - armHalf, 2 * Math.PI, Math.PI, 64)]]],
    [[[[staffA + crookRadius, -armHalf], [-0.1, -armHalf], [-0.1, armHalf], [staffA + crookRadius, armHalf], [staffA + crookRadius, -armHalf]]]],
    [[circlePoints(0.27, 96)]],
    [[tailOutline]],
  ),
  [[[[mouth - 0.1, -slotHalf], [deepest, -slotHalf], [deepest, slotHalf], [mouth - 0.1, slotHalf], [mouth - 0.1, -slotHalf]]]],
  // Chamfered horns let the pin swing in and out of the mouth.
  ...[-1, 1].map((side) => [[[[mouth - 0.01, side * (slotHalf - 0.01)], [mouth + chamfer, side * (slotHalf - 0.01)], [mouth - 0.01, side * (slotHalf + chamfer)], [mouth - 0.01, side * (slotHalf - 0.01)]]]]),
  [[circlePoints(0.173, 96)]]);
  const fork = new THREE.Mesh(extrudePlate(leverShape, -0.42, -0.30), material);
  fork.userData.role = 'lever-C-one-plate-with-fork-e-crook-d-and-tail';
  lever.add(fork);
  const forkProngs = [fork];
  const forkBridge = fork;
  // The guard pin stands on the lever's front face on its centre line just
  // clear of the roller's edge, level with the roller.
  const guardPin = cylinderAlongZ(0.052, 0.12, darkMaterial, 20);
  guardPin.position.set(
    forkCenterLocal.x - PIN_ORBIT + rollerRadius + 0.072,
    forkCenterLocal.y,
    -0.24,
  );
  guardPin.userData.role = 'lever-guard-pin-k-against-balance-roller-h';
  lever.add(guardPin);

  const pivotHub = cylinderAlongZ(0.17, 0.92, darkMaterial, 30);
  pivotHub.position.z = 0.18;
  pivotHub.userData.role = 'lever-staff-c';
  lever.add(pivotHub);
  const tail = fork;

  lever.userData.crosspiece = crosspiece;
  lever.userData.forkBridge = forkBridge;
  lever.userData.forkProngs = forkProngs;
  lever.userData.guardPin = guardPin;
  lever.userData.palletF = f.pallet;
  lever.userData.palletFIndex = f.index;
  lever.userData.palletG = g.pallet;
  lever.userData.palletGIndex = g.index;
  lever.userData.pivotHub = pivotHub;
  lever.userData.tail = tail;
  return markShadows(lever);
}

function reedHybridEscapement(movement) {
  const root = new THREE.Group();

  // The official page is static, but Reed's US Patent 31,999 supplies four
  // successive plan views and names every working element.  The event law
  // below follows those figures: g unlocks/impulses and f catches; then f
  // unlocks, j receives direct impulse, and g catches again.
  const toothCount = 12;
  const toothPitch = FULL_TURN / toothCount;
  const wheelAdvancePerHalfBeat = toothPitch / 2;
  const wheelAdvancePerBalanceCycle = toothPitch;
  const lockContactAngle = THREE.MathUtils.degToRad(22.5);
  const wheelToothTipRadius = 1.72;
  const wheelRootRadius = 1.52;
  const wheelInnerRadius = 1.22;
  const wheelDepth = 0.28;
  const wheelReferenceAngle = lockContactAngle;
  const leverPivot = new THREE.Vector2(2.18, 0);
  const leverAmplitude = THREE.MathUtils.degToRad(5);
  const balanceAmplitude = THREE.MathUtils.degToRad(120);
  const balancePeriod = 4;
  const halfBeatDuration = balancePeriod / 2;
  const balanceDirectPalletReach = 0.62;
  const balanceCenter = new THREE.Vector2(
    -wheelToothTipRadius - balanceDirectPalletReach,
    0,
  );
  const balanceRadius = 2.24;
  const rollerRadius = 0.60;
  const rollerPinRadius = 0.072;
  const leverMoveStart = 0.36;
  const wheelAdvanceStart = 0.44;
  const wheelAdvanceEnd = 0.58;
  const leverMoveEnd = 0.66;

  const contactGAtNegativeBank = new THREE.Vector2(
    wheelToothTipRadius * Math.cos(lockContactAngle),
    wheelToothTipRadius * Math.sin(lockContactAngle),
  );
  const contactFAtPositiveBank = new THREE.Vector2(
    wheelToothTipRadius * Math.cos(lockContactAngle),
    -wheelToothTipRadius * Math.sin(lockContactAngle),
  );
  const palletGLocal = rotate2(
    contactGAtNegativeBank.clone().sub(leverPivot),
    leverAmplitude,
  );
  const palletFLocal = rotate2(
    contactFAtPositiveBank.clone().sub(leverPivot),
    -leverAmplitude,
  );

  const wheelMaterial = matte(PALETTE.driver, {
    metalness: 0.19,
    roughness: 0.48,
  });
  const balanceMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.50,
  });
  const leverMaterial = matte(PALETTE.brass, {
    metalness: 0.24,
    roughness: 0.43,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.40,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.38 });

  const escapeWheel = makeEscapeWheel({
    darkMaterial,
    depth: wheelDepth,
    innerRadius: wheelInnerRadius,
    material: wheelMaterial,
    rootRadius: wheelRootRadius,
    toothCount,
    toothTipRadius: wheelToothTipRadius,
    whiteMaterial,
  });
  root.add(escapeWheel);
  const balance = makeBalance({
    balanceRadius,
    darkMaterial,
    directPalletReach: balanceDirectPalletReach,
    material: balanceMaterial,
    rollerPinRadius,
    rollerRadius,
    whiteMaterial,
  });
  balance.position.set(balanceCenter.x, balanceCenter.y, 0);
  root.add(balance);
  const lever = makeLever({
    balanceCenter,
    darkMaterial,
    fLocal: palletFLocal,
    gLocal: palletGLocal,
    leverPivot,
    material: leverMaterial,
    rollerRadius,
    whiteMaterial,
  });
  root.add(lever);

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'fixed-watch-plate-carrying-parallel-staffs-a-b-and-c';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(7.55, 0.20, 1.12),
    frameMaterial,
  );
  base.position.set(-0.76, -2.58, -0.37);
  base.userData.role = 'fixed-watch-escapement-base';
  fixedFrame.add(base);
  const bearingPositions = [
    { name: 'escape-wheel-a', point: new THREE.Vector2(0, 0) },
    { name: 'balance-b', point: balanceCenter },
    { name: 'lever-c', point: leverPivot },
  ];
  const bearingBosses = bearingPositions.map(({ name, point }) => {
    const boss = cylinderAlongZ(0.26, 0.14, frameMaterial, 32);
    boss.position.set(point.x, point.y, -0.27);
    boss.userData.role = `${name}-fixed-bearing-boss`;
    fixedFrame.add(boss);
    return boss;
  });
  const bankingPins = [-1, 1].map((side) => {
    const pin = cylinderAlongZ(0.085, 0.44, darkMaterial, 24);
    pin.position.set(leverPivot.x + 0.47,
      side * 0.20, -0.50);
    pin.userData.side = side;
    pin.userData.role = 'fixed-banking-pin-l';
    fixedFrame.add(pin);
    return pin;
  });
  root.add(markShadows(fixedFrame));

  const balanceMotion = (side, halfPhase) => {
    const argument = Math.PI * halfPhase;
    const angularFrequency = Math.PI / halfBeatDuration;
    return {
      acceleration: side * balanceAmplitude
        * angularFrequency ** 2 * Math.cos(argument),
      angle: -side * balanceAmplitude * Math.cos(argument),
      speed: side * balanceAmplitude
        * angularFrequency * Math.sin(argument),
    };
  };
  const leverMotion = (side, halfPhase) => {
    if (halfPhase <= leverMoveStart) {
      return { angle: -side * leverAmplitude, progress: 0, speed: 0 };
    }
    if (halfPhase >= leverMoveEnd) {
      return { angle: side * leverAmplitude, progress: 1, speed: 0 };
    }
    const duration = (leverMoveEnd - leverMoveStart) * halfBeatDuration;
    const progress = (halfPhase - leverMoveStart)
      / (leverMoveEnd - leverMoveStart);
    return {
      angle: -side * leverAmplitude
        + side * 2 * leverAmplitude * smootherStep(progress),
      progress,
      speed: side * 2 * leverAmplitude
        * smootherStepDerivative(progress) / duration,
    };
  };
  const wheelAdvance = (halfPhase) => {
    if (halfPhase <= wheelAdvanceStart) {
      return { progress: 0, rate: 0 };
    }
    if (halfPhase >= wheelAdvanceEnd) {
      return { progress: 1, rate: 0 };
    }
    const duration = (wheelAdvanceEnd - wheelAdvanceStart)
      * halfBeatDuration;
    const progress = (halfPhase - wheelAdvanceStart)
      / (wheelAdvanceEnd - wheelAdvanceStart);
    return {
      progress: smootherStep(progress),
      rate: smootherStepDerivative(progress) / duration,
    };
  };
  const leverPointWorld = (localPoint, leverAngle) => leverPivot.clone().add(
    rotate2(localPoint, leverAngle),
  );
  const toothTipAt = (wheelAngle, toothIndex) => new THREE.Vector2(
    Math.cos(wheelAngle + toothIndex * toothPitch) * wheelToothTipRadius,
    Math.sin(wheelAngle + toothIndex * toothPitch) * wheelToothTipRadius,
  );

  const stateAtTime = (time) => {
    const halfCoordinate = time / halfBeatDuration;
    const halfBeatIndex = Math.floor(halfCoordinate);
    const halfPhase = halfCoordinate - halfBeatIndex;
    const leverImpulseBeat = positiveModulo(halfBeatIndex, 2) === 0;
    const side = leverImpulseBeat ? 1 : -1;
    const balanceState = balanceMotion(side, halfPhase);
    const leverState = leverMotion(side, halfPhase);
    const advanceState = wheelAdvance(halfPhase);
    const wheelAngle = wheelReferenceAngle
      - halfBeatIndex * wheelAdvancePerHalfBeat
      - wheelAdvancePerHalfBeat * advanceState.progress;
    const wheelAngularSpeed = -wheelAdvancePerHalfBeat * advanceState.rate;
    const impulseActive = halfPhase > wheelAdvanceStart
      && halfPhase < wheelAdvanceEnd;
    const beforeImpulse = halfPhase <= wheelAdvanceStart;
    const palletBefore = leverImpulseBeat ? 'g' : 'f';
    const palletAfter = leverImpulseBeat ? 'f' : 'g';
    const activeLockPallet = impulseActive
      ? null
      : beforeImpulse ? palletBefore : palletAfter;
    const stableLock = !impulseActive && (
      halfPhase <= leverMoveStart || halfPhase >= leverMoveEnd
    );
    const palletGPoint = leverPointWorld(palletGLocal, leverState.angle);
    const palletFPoint = leverPointWorld(palletFLocal, leverState.angle);
    let lockContact = null;
    if (activeLockPallet !== null) {
      const palletPoint = activeLockPallet === 'g'
        ? palletGPoint
        : palletFPoint;
      const toothIndex = Math.round((
        Math.atan2(palletPoint.y, palletPoint.x) - wheelAngle
      ) / toothPitch);
      const toothPoint = toothTipAt(wheelAngle, toothIndex);
      lockContact = {
        pallet: activeLockPallet,
        palletPoint,
        pointCoincidenceError: stableLock
          ? palletPoint.distanceTo(toothPoint)
          : null,
        stable: stableLock,
        toothIndex,
        toothPoint,
      };
    }
    const balancePinPoint = balanceCenter.clone().add(rotate2(
      new THREE.Vector2(PIN_ORBIT, 0),
      balanceState.angle,
    ));
    const chronometerPalletPoint = balanceCenter.clone().add(rotate2(
      new THREE.Vector2(balanceDirectPalletReach, 0),
      balanceState.angle,
    ));
    const impulseType = impulseActive
      ? leverImpulseBeat
        ? 'lever-transmitted-impulse-through-g-C-e-i'
        : 'direct-chronometer-impulse-to-j'
      : null;
    const forcePath = impulseActive
      ? leverImpulseBeat
        ? [
            'escape-wheel-A-tooth',
            'lever-impulse-pallet-g',
            'crooked-lever-C-and-fork-e',
            'roller-pin-i',
            'balance-B',
          ]
        : [
            'escape-wheel-A-tooth',
            'chronometer-impulse-pallet-j',
            'balance-B',
          ]
      : [];
    const stage = impulseActive
      ? impulseType
      : halfPhase < leverMoveStart
        ? `stable-lock-on-${palletBefore}-before-${
            leverImpulseBeat ? 'lever' : 'direct'}-impulse`
        : halfPhase <= wheelAdvanceStart
          ? `fork-pickup-and-unlocking-${palletBefore}`
          : halfPhase < leverMoveEnd
            ? `drop-to-${palletAfter}-and-lever-settle`
            : `stable-lock-on-${palletAfter}-after-${
                leverImpulseBeat ? 'lever' : 'direct'}-impulse`;
    return {
      activeLockPallet,
      balanceAcceleration: balanceState.acceleration,
      balanceAngle: balanceState.angle,
      balanceAngularSpeed: balanceState.speed,
      balancePinPoint,
      chronometerPalletPoint,
      directImpulseActive: impulseActive && !leverImpulseBeat,
      forcePath,
      halfBeatIndex,
      halfPhase,
      impulseActive,
      impulseType,
      leverAngle: leverState.angle,
      leverAngularSpeed: leverState.speed,
      leverImpulseActive: impulseActive && leverImpulseBeat,
      leverImpulseBeat,
      lockContact,
      palletFPoint,
      palletGPoint,
      relockedOnceThisHalfBeat: halfPhase >= wheelAdvanceEnd,
      scheduledImpulseType: leverImpulseBeat
        ? 'lever-transmitted'
        : 'direct-chronometer-pallet',
      stableLock,
      stage,
      unlockedOnceThisHalfBeat: halfPhase > wheelAdvanceStart,
      wheelAngle,
      wheelAngularSpeed,
      wheelStepProgress: advanceState.progress,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    escapeWheel.rotation.z = state.wheelAngle;
    balance.rotation.z = state.balanceAngle;
    lever.rotation.z = state.leverAngle;
    lever.userData.palletGIndex.scale.setScalar(
      state.leverImpulseActive ? 1.45 : 1,
    );
    balance.userData.directContactIndex.scale.setScalar(
      state.directImpulseActive ? 1.45 : 1,
    );
    root.userData.contacts = {
      directChronometerImpulseJ: {
        active: state.directImpulseActive,
        forcePath: state.directImpulseActive ? [...state.forcePath] : [],
        palletPoint: state.chronometerPalletPoint.clone(),
      },
      forkEToRollerPinI: {
        active: state.halfPhase > leverMoveStart
          && state.halfPhase < leverMoveEnd,
        pinPoint: state.balancePinPoint.clone(),
      },
      leverImpulseG: {
        active: state.leverImpulseActive,
        forcePath: state.leverImpulseActive ? [...state.forcePath] : [],
        palletPoint: state.palletGPoint.clone(),
      },
      wheelLock: state.lockContact === null
        ? { active: false, pallet: null }
        : {
            active: true,
            pallet: state.lockContact.pallet,
            pointCoincidenceError:
              state.lockContact.pointCoincidenceError,
            stable: state.lockContact.stable,
            toothIndex: state.lockContact.toothIndex,
          },
    };
    root.userData.kinematics = state;
  };

  root.userData = {
    archetype:
      'reed-hybrid-lever-and-chronometer-escapement-with-alternating-indirect-and-direct-impulse',
    blocks: {
      balance,
      bankingPins,
      bearingBosses,
      escapeWheel,
      fixedFrame,
      lever,
      palletF: lever.userData.palletF,
      palletG: lever.userData.palletG,
      roller: balance.userData.roller,
      rollerPin: balance.userData.rollerPin,
      chronometerPalletJ: balance.userData.directPallet,
    },
    constraintResiduals: {
      fStableLockRadius:
        contactFAtPositiveBank.length() - wheelToothTipRadius,
      gStableLockRadius:
        contactGAtNegativeBank.length() - wheelToothTipRadius,
      halfBeatStepIdentity:
        2 * wheelAdvancePerHalfBeat - toothPitch,
      parallelStaffPlaneError: 0,
      palletFPositiveBankConstruction:
        leverPointWorld(palletFLocal, leverAmplitude)
          .distanceTo(contactFAtPositiveBank),
      palletGNegativeBankConstruction:
        leverPointWorld(palletGLocal, -leverAmplitude)
          .distanceTo(contactGAtNegativeBank),
      wheelCycleAdvance:
        wheelAdvancePerBalanceCycle - toothPitch,
    },
    constraints: {
      balance:
        'Balance B, roller h, roller pin i, and chronometer impulse pallet j are fast on one staff b.',
      escapeWheel:
        'Escape wheel A turns clockwise in two equal half-pitch releases per complete balance vibration.',
      lever:
        'Lever C pivots on staff c opposite the balance, crooks around escape-wheel staff a, and carries fork e, guard pin k, crosspiece h, detent pallet f, and impulse pallet g as one rigid body.',
      locks:
        'Pallet g locks before the lever-transmitted impulse and pallet f catches afterward; f locks before the direct impulse and g catches afterward.',
      impulses:
        'One direction receives the complete wheel impulse through g, C, e, and i; the opposite direction receives the complete impulse directly at balance pallet j.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'crooked lever angle and selected bank',
        'escape-wheel half-pitch step',
        'active detent/impulse pallet',
      ],
      independentPrescribedInputs: 1,
      inputs: ['balance-wheel vibration'],
      note:
        'The balance oscillator is prescribed; lever and escape wheel follow the patent event sequence with one unlock and one relock per impulse.',
      storedEnergyStates: 1,
      storedEnergyState: 'balance hairspring represented by sinusoidal motion law',
    },
    dynamics: {
      idealizations: [
        'rigid balance, roller, pallets, lever, wheel, staffs, and frame',
        'balance/hairspring represented by prescribed sinusoidal vibration',
        'mainspring torque represented only by forward wheel tendency',
        'zero backlash at idealized lock and impulse events',
        'quintic event interpolation with zero speed at wheel and lever handoffs',
        'tooth-face lift, draw, drop, guard clearance, friction, inertia, and rebound omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless event-based kinematic reconstruction',
    },
    fidelity: 'authored',
    geometry: {
      balanceAmplitude,
      balanceCenter: balanceCenter.clone(),
      balanceDirectPalletReach,
      balancePeriod,
      balanceRadius,
      contactFAtPositiveBank: contactFAtPositiveBank.clone(),
      contactGAtNegativeBank: contactGAtNegativeBank.clone(),
      halfBeatDuration,
      leverAmplitude,
      leverPivot: leverPivot.clone(),
      lockContactAngle,
      palletFLocal: palletFLocal.clone(),
      palletGLocal: palletGLocal.clone(),
      rollerPinRadius,
      rollerRadius,
      toothCount,
      toothPitch,
      wheelAdvancePerBalanceCycle,
      wheelAdvancePerHalfBeat,
      wheelDepth,
      wheelInnerRadius,
      wheelReferenceAngle,
      wheelRootRadius,
      wheelToothTipRadius,
    },
    mechanism:
      'reed-1861-hybrid-escapement-wheel-A-alternately-impulses-balance-B-through-lever-pallet-g-crooked-lever-C-fork-e-and-pin-i-then-directly-through-chronometer-pallet-j-while-detent-pallets-g-and-f-alternate-locks',
    motion: {
      balancePeriod,
      directBeat:
        'f unlocks; an advancing tooth impulses j directly; g relocks',
      escapeWheelDirection: 'clockwise only',
      escapeWheelTeethPerBalanceCycle: 1,
      leverBeat:
        'g unlocks and its impulse drives C/e/i; f relocks',
      wheelAdvancePerHalfBeat,
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 396 page marks Animated unavailable; Reed patent US31999A supplies the four operating positions used for the reconstruction.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate396: {
        balanceApproximateCenterPixels: [169, 275],
        balanceApproximateRadiusPixels: 149,
        escapeWheelApproximateCenterPixels: [335, 273],
        escapeWheelApproximateRadiusPixels: 91,
        imageHeight: 525,
        imageWidth: 525,
        leverStaffApproximatePixels: [446, 276],
        measurementUncertaintyPixels: 8,
      },
      constructionEvidence: {
        brownDescription:
          'Brown explicitly distinguishes whole lever-transmitted impulse in one direction, whole direct chronometer-pallet impulse in the opposite direction, and one wheel lock/unlock at every impulse.',
        patentElements: {
          A: 'escape wheel and staff a',
          B: 'balance and staff b',
          C: 'lever on staff c with crook d and fork e',
          f: 'chronometer detent pallet only',
          g: 'combined detent and lever impulse pallet',
          h: 'balance roller',
          i: 'roller pin receiving lever impulse',
          j: 'direct chronometer impulse pallet on balance staff',
          k: 'lever guard pin',
          l: 'two banking pins',
        },
        patentSequence:
          'US31999A figs. 1-3 show g unlock, lever impulse, and f lock; figs. 3-4-1 show f unlock, direct impulse to j, and g lock.',
        reconstructionDisclosure:
          'Neither Brown nor the patent specifies absolute timing or scalable dimensions. Twelve teeth, contact angles, event fractions, smooth interpolation, colors, and omitted tooth-face details are explicit reconstruction choices.',
      },
      officialPage: movement.sourceUrl,
      patent: {
        date: '1861-04-09',
        inventor: 'George P. Reed of Roxbury, Massachusetts',
        number: 'US31999A',
        url: 'https://patents.google.com/patent/US31999A/en',
      },
      plate: 'Brown 1868, Movement 396',
    },
    stateAtTime,
    timeline: {
      balancePeriod,
      directImpulseHalfBeat: 1,
      leverImpulseHalfBeat: 0,
      leverMove: [leverMoveStart, leverMoveEnd],
      wheelAdvance: [wheelAdvanceStart, wheelAdvanceEnd],
    },
    transmission: {
      directForcePath:
        'escape wheel A tooth -> chronometer impulse pallet j -> balance B',
      leverForcePath:
        'escape wheel A tooth -> impulse pallet g -> lever C/fork e -> roller pin i -> balance B',
      lockSequence: 'g -> impulse through lever -> f -> direct impulse -> g',
      wheelLaw:
        'clockwise half a tooth pitch per impulse; one full tooth pitch per complete balance vibration',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.72, -2.84, -0.72),
    new THREE.Vector3(3.08, 2.55, 1.02),
  );
  root.userData.cameraDistanceScale = 1.07;
  root.userData.cameraDirection = new THREE.Vector3(6.8, 5.2, 12.8);
  root.userData.groundFloorY = -2.72;
  update(0);
  return finishReed396Parts({ root, update });
}

export function createAuthoredReedEscapementMovement(movement) {
  if (movement.id !== 396) return null;
  return reedHybridEscapement(movement);
}
