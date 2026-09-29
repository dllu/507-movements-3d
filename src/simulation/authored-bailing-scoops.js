import * as THREE from 'three';
import {correctWaterLiftParts} from './well-scoop-gutter-parts.js';
import {WaterStream,collectWaterStreams,guidedPath,ballisticPath,joinPaths} from './water-stream.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (10 + x * (-15 + 6 * x));
}

function smootherStepDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * x ** 2 * (1 - x) ** 2;
}

function smootherStepSecondDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * x * (1 - x) * (1 - 2 * x);
}

function fixedProfile(value) {
  return {
    firstDerivativeByPhase: 0,
    secondDerivativeByPhase: 0,
    value,
  };
}

function transitionProfile(phase, startPhase, endPhase, startValue, endValue) {
  const duration = endPhase - startPhase;
  const normalized = (phase - startPhase) / duration;
  const delta = endValue - startValue;
  return {
    firstDerivativeByPhase:
      delta * smootherStepDerivative(normalized) / duration,
    secondDerivativeByPhase:
      delta * smootherStepSecondDerivative(normalized) / duration ** 2,
    value: startValue + delta * smootherStep(normalized),
  };
}

function profileRate(profile, phaseSpeed) {
  return profile.firstDerivativeByPhase * phaseSpeed;
}

function profileAcceleration(profile, phaseSpeed, phaseAcceleration) {
  return profile.secondDerivativeByPhase * phaseSpeed ** 2
    + profile.firstDerivativeByPhase * phaseAcceleration;
}

function crossZ(vector) {
  return new THREE.Vector3(-vector.y, vector.x, 0);
}

function rotateLocal(local, angle) {
  return local.clone().applyAxisAngle(Z_AXIS, angle);
}

function setRodBetween(mesh, start, end) {
  const delta = end.clone().sub(start);
  const length = Math.max(0.001, delta.length());
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.y = length;
  mesh.quaternion.setFromUnitVectors(Y_AXIS, delta.normalize());
}

function makePlateGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0.02, 0.12);
  shape.lineTo(2.82, -0.31);
  shape.lineTo(3.43, -0.08);
  shape.lineTo(3.24, -0.92);
  shape.lineTo(2.56, -1.20);
  shape.lineTo(1.78, -0.88);
  shape.lineTo(0.02, -0.10);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.018,
    bevelThickness: 0.018,
    depth: 0.065,
    curveSegments: 2,
  });
  geometry.translate(0, 0, -0.0325);
  return geometry;
}

function bailingScoop(movement) {
  const root = new THREE.Group();
  const cycleDuration = 7.6;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const liftEndPhase = 0.40;
  // Pass 104: the high dwell, when the raised scoop pours into the channel,
  // lasts 0.16 of the cycle (it was 0.10, so the pour only flashed); the
  // empty scoop's lowering takes the difference.
  const dischargeEndPhase = 0.56;
  const loweringEndPhase = 0.90;
  const scoopPivot = new THREE.Vector3(-2.40, 0.15, 0);
  const beamPivot = new THREE.Vector3(1.30, 1.25, 0);
  const lowBeamAngle = Math.PI + 0.32;
  // Pass 69 (p69-w1): the beam swings far enough (79 degrees since pass 70) that the
  // raised scoop's floor slopes down to its pivot end, so the water it
  // lifted can run out; at the old 20-degree swing the raised bucket stayed
  // below its outlet and could never empty.
  const highBeamAngle = Math.PI - 1.05;
  const notchRadii = Object.freeze([1.30, 1.47, 1.65, 1.83, 2.00]);
  const selectedNotchIndex = 2;
  const selectedNotchRadius = notchRadii[selectedNotchIndex];
  // Pass 70: the low scoop hangs at Brown's slant: its pin line 25 degrees
  // below level and its top edge about 33 (they were 32 and 41), with the
  // pitman still hanging plumb from the middle notch as he draws it and the
  // mouth just under the pit water, which now stands 0.67 below the channel.
  // The pitman takes hold 2.45 from the pivot, and the 79-degree beam stroke
  // still raises the floor to 26 degrees, past the slope (24) that drains it
  // to the spout.
  const sourceScoopConnection = new THREE.Vector3(-2.40 + 2.45 * Math.cos(-25 * Math.PI / 180),
    0.15 + 2.45 * Math.sin(-25 * Math.PI / 180), 0);
  const scoopConnectionRadius = sourceScoopConnection.distanceTo(scoopPivot);
  const selectedSourceNotch = beamPivot.clone().add(new THREE.Vector3(
    Math.cos(lowBeamAngle) * selectedNotchRadius,
    Math.sin(lowBeamAngle) * selectedNotchRadius,
    0,
  ));
  const pitmanLength = selectedSourceNotch.distanceTo(sourceScoopConnection);
  const intakeLipLocal = new THREE.Vector3(3.43, -0.08, 0);
  // The spout beyond the pivot, over the ridge (Brown's beak).
  const outletLocal = new THREE.Vector3(-0.58, -0.21, 0);
  const groundY = -1.92;

  const solveOutput = (
    beamAngle,
    beamAngularSpeed,
    beamAngularAcceleration,
    notchIndex,
  ) => {
    const notchRadius = notchRadii[notchIndex];
    if (notchRadius === undefined) {
      throw new RangeError(`notch index ${notchIndex} is outside 0-${notchRadii.length - 1}`);
    }
    const beamRadius = new THREE.Vector3(
      Math.cos(beamAngle) * notchRadius,
      Math.sin(beamAngle) * notchRadius,
      0,
    );
    const upperPin = beamPivot.clone().add(beamRadius);
    const centers = upperPin.clone().sub(scoopPivot);
    const centerDistance = centers.length();
    const minimumCenterDistance = Math.abs(
      scoopConnectionRadius - pitmanLength,
    );
    const maximumCenterDistance = scoopConnectionRadius + pitmanLength;
    if (centerDistance < minimumCenterDistance
      || centerDistance > maximumCenterDistance) {
      throw new RangeError('selected notch makes the four-bar circles disjoint');
    }
    const radialUnit = centers.clone().multiplyScalar(1 / centerDistance);
    const along = (scoopConnectionRadius ** 2 - pitmanLength ** 2
      + centerDistance ** 2) / (2 * centerDistance);
    const perpendicularDistance = Math.sqrt(Math.max(
      0,
      scoopConnectionRadius ** 2 - along ** 2,
    ));
    const base = scoopPivot.clone().addScaledVector(radialUnit, along);
    const perpendicular = new THREE.Vector3(
      -radialUnit.y,
      radialUnit.x,
      0,
    );
    const candidates = [
      base.clone().addScaledVector(perpendicular, perpendicularDistance),
      base.clone().addScaledVector(perpendicular, -perpendicularDistance),
    ];
    const lowerPin = candidates[0].y < candidates[1].y
      ? candidates[0]
      : candidates[1];
    const scoopRadius = lowerPin.clone().sub(scoopPivot);
    const pitmanVector = lowerPin.clone().sub(upperPin);
    const upperPinVelocity = crossZ(beamRadius)
      .multiplyScalar(beamAngularSpeed);
    const upperPinAcceleration = crossZ(beamRadius)
      .multiplyScalar(beamAngularAcceleration)
      .addScaledVector(beamRadius, -(beamAngularSpeed ** 2));
    const outputDenominator = pitmanVector.dot(crossZ(scoopRadius));
    const scoopAngularSpeed = pitmanVector.dot(upperPinVelocity)
      / outputDenominator;
    const lowerPinVelocity = crossZ(scoopRadius)
      .multiplyScalar(scoopAngularSpeed);
    const relativeVelocity = lowerPinVelocity.clone()
      .sub(upperPinVelocity);
    const scoopAngularAcceleration = (
      -relativeVelocity.lengthSq()
      + pitmanVector.dot(upperPinAcceleration)
      + scoopAngularSpeed ** 2 * pitmanVector.dot(scoopRadius)
    ) / outputDenominator;
    const lowerPinAcceleration = crossZ(scoopRadius)
      .multiplyScalar(scoopAngularAcceleration)
      .addScaledVector(scoopRadius, -(scoopAngularSpeed ** 2));
    const scoopAngle = Math.atan2(scoopRadius.y, scoopRadius.x);
    const intakeRadius = rotateLocal(intakeLipLocal, scoopAngle);
    const outletRadius = rotateLocal(outletLocal, scoopAngle);
    const intakePoint = scoopPivot.clone().add(intakeRadius);
    const outletPoint = scoopPivot.clone().add(outletRadius);
    const intakeVelocity = crossZ(intakeRadius)
      .multiplyScalar(scoopAngularSpeed);
    const intakeAcceleration = crossZ(intakeRadius)
      .multiplyScalar(scoopAngularAcceleration)
      .addScaledVector(intakeRadius, -(scoopAngularSpeed ** 2));
    return {
      assemblyMode: 'open-lower-circle-intersection',
      centerDistance,
      circleClosureError: Math.max(
        Math.abs(lowerPin.distanceTo(scoopPivot) - scoopConnectionRadius),
        Math.abs(lowerPin.distanceTo(upperPin) - pitmanLength),
      ),
      inputToOutputInstantaneousRatio:
        pitmanVector.dot(crossZ(beamRadius)) / outputDenominator,
      intakeAcceleration,
      intakePoint,
      intakeRadius,
      intakeVelocity,
      lowerPin,
      lowerPinAcceleration,
      lowerPinVelocity,
      notchIndex,
      notchRadius,
      outletPoint,
      outputDenominator,
      pitmanLength: pitmanVector.length(),
      pitmanVector,
      scoopAngle,
      scoopAngularAcceleration,
      scoopAngularSpeed,
      upperPin,
      upperPinAcceleration,
      upperPinVelocity,
    };
  };

  const stateAtInputAngleForNotch = (
    inputAngle,
    notchIndex = selectedNotchIndex,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const rawPhase = THREE.MathUtils.euclideanModulo(
      inputAngle / FULL_TURN,
      1,
    );
    const phase = [0, liftEndPhase, dischargeEndPhase,
      loweringEndPhase].find(
      (boundary) => Math.abs(rawPhase - boundary) < 1e-12,
    ) ?? rawPhase;
    const phaseSpeed = inputSpeed / FULL_TURN;
    const phaseAcceleration = inputAcceleration / FULL_TURN;
    let beamProfile;
    let waterProfile;
    let mode;
    if (phase < liftEndPhase) {
      beamProfile = transitionProfile(
        phase,
        0,
        liftEndPhase,
        lowBeamAngle,
        highBeamAngle,
      );
      waterProfile = fixedProfile(1);
      mode = phase === 0
        ? 'low-full-scoop-ready-for-short-lift'
        : 'pitman-raising-full-scoop';
    } else if (phase < dischargeEndPhase) {
      beamProfile = fixedProfile(highBeamAngle);
      waterProfile = transitionProfile(
        phase,
        liftEndPhase,
        dischargeEndPhase,
        1,
        0,
      );
      mode = 'scoop-held-high-while-water-discharges';
    } else if (phase < loweringEndPhase) {
      beamProfile = transitionProfile(
        phase,
        dischargeEndPhase,
        loweringEndPhase,
        highBeamAngle,
        lowBeamAngle,
      );
      waterProfile = fixedProfile(0);
      mode = 'pitman-lowering-empty-scoop';
    } else {
      beamProfile = fixedProfile(lowBeamAngle);
      waterProfile = transitionProfile(
        phase,
        loweringEndPhase,
        1,
        0,
        1,
      );
      mode = 'scoop-held-low-while-filling';
    }
    const beamAngle = beamProfile.value;
    const beamAngularSpeed = profileRate(beamProfile, phaseSpeed);
    const beamAngularAcceleration = profileAcceleration(
      beamProfile,
      phaseSpeed,
      phaseAcceleration,
    );
    const linkage = solveOutput(
      beamAngle,
      beamAngularSpeed,
      beamAngularAcceleration,
      notchIndex,
    );
    const waterFraction = waterProfile.value;
    const waterFractionRate = profileRate(waterProfile, phaseSpeed);
    const waterFractionAcceleration = profileAcceleration(
      waterProfile,
      phaseSpeed,
      phaseAcceleration,
    );
    return {
      ...linkage,
      beamAngle,
      beamAngularAcceleration,
      beamAngularSpeed,
      dischargeFlowRate: Math.max(0, -waterFractionRate),
      inputAcceleration,
      inputAngle: FULL_TURN * phase,
      inputSpeed,
      mode,
      phase,
      waterFraction,
      waterFractionAcceleration,
      waterFractionRate,
    };
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => stateAtInputAngleForNotch(
    inputAngle,
    selectedNotchIndex,
    inputSpeed,
    inputAcceleration,
  );

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
    inputAngularSpeed,
    0,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.66,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.20,
    roughness: 0.50,
  });
  const scoopMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.58,
  });
  const beamMaterial = matte(PALETTE.brass, {
    metalness: 0.14,
    roughness: 0.56,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.72,
    roughness: 0.28,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const basinWaterMaterial = matte(PALETTE.fluid, {
    opacity: 0.42,
    roughness: 0.32,
    side: THREE.DoubleSide,
    transparent: true,
  });
  basinWaterMaterial.depthWrite = false;
  const basinMaterial = matte(PALETTE.muted, {
    opacity: 0.30,
    roughness: 0.76,
    side: THREE.DoubleSide,
    transparent: true,
  });
  basinMaterial.depthWrite = false;

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(8.2, 0.14, 3.3),
    frameMaterial,
  ), 'fixed-foundation-around-fairbairn-bailing-scoop');
  base.position.set(0, groundY + 0.07, 0);
  root.add(base);

  const basin = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(4.85, 1.35, 2.15),
    basinMaterial,
  ), 'lower-water-basin-containing-scoop-intake');
  basin.position.set(-0.15, -1.20, 0);
  root.add(basin);
  const basinWater = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(4.55, 0.12, 1.86),
    basinWaterMaterial,
  ), 'fixed-lower-water-surface');
  basinWater.position.set(-0.15, -0.66, 0);
  root.add(basinWater);

  const leftBank = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(2.25, 1.95, 2.55),
    frameMaterial,
  ), 'left-bank-supporting-fixed-scoop-pivot-and-delivery-level');
  leftBank.position.set(-3.10, -0.82, 0);
  root.add(leftBank);
  const rightBank = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(2.45, 3.05, 2.55),
    frameMaterial,
  ), 'right-bank-supporting-single-acting-engine-beam-pivot');
  rightBank.position.set(2.45, -0.27, 0);
  root.add(rightBank);
  const deliveryChannel = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(1.65, 0.18, 1.00),
    matte(PALETTE.muted, { metalness: 0.10, roughness: 0.68 }),
  ), 'elevated-left-delivery-channel');
  deliveryChannel.position.set(-3.28, -0.12, 0);
  root.add(deliveryChannel);
  const deliveryWater = new THREE.Mesh(
    new THREE.BoxGeometry(1.50, 0.055, 0.84),
    waterMaterial,
  );
  deliveryWater.position.set(-3.28, 0.015, 0);
  root.add(deliveryWater);

  const scoop = addRole(new THREE.Group(),
    'rigid-fairbairn-bailing-scoop-rocking-about-left-trunnion');
  scoop.position.copy(scoopPivot);
  root.add(scoop);
  const plateGeometry = makePlateGeometry();
  const scoopSidePlates = [-0.39, 0.39].map((z) => {
    const plate = new THREE.Mesh(plateGeometry, scoopMaterial);
    plate.position.z = z;
    scoop.add(plate);
    return plate;
  });
  const floorPoints = [
    new THREE.Vector3(-0.58, -0.24, 0),
    new THREE.Vector3(0.0, -0.24, 0),
    new THREE.Vector3(0.15, -0.08, 0),
    new THREE.Vector3(1.78, -0.88, 0),
    new THREE.Vector3(2.56, -1.20, 0),
    new THREE.Vector3(3.24, -0.92, 0),
    new THREE.Vector3(3.43, -0.08, 0),
  ];
  const scoopFloor = [];
  for (let index = 0; index < floorPoints.length - 1; index += 1) {
    const start = floorPoints[index];
    const end = floorPoints[index + 1];
    const delta = end.clone().sub(start);
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(delta.length(), 0.075, 0.76),
      scoopMaterial,
    );
    floor.position.copy(start).add(end).multiplyScalar(0.5);
    floor.rotation.z = Math.atan2(delta.y, delta.x);
    scoop.add(floor);
    scoopFloor.push(floor);
  }
  const scoopConnectionPin = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 0.98, 24),
    darkMaterial,
  ), 'fixed-pitman-pin-on-scoop');
  scoopConnectionPin.rotation.x = Math.PI / 2;
  scoopConnectionPin.position.set(scoopConnectionRadius, 0, 0);
  scoop.add(scoopConnectionPin);
  const scoopWater = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(1.08, 0.46, 0.66),
    waterMaterial,
  ), 'water-carried-in-bailing-scoop');
  scoopWater.position.set(2.57, -0.90, 0);
  scoop.add(scoopWater);

  const scoopPivotAxle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 1.28, 28),
    darkMaterial,
  ), 'fixed-left-scoop-trunnion');
  scoopPivotAxle.rotation.x = Math.PI / 2;
  scoopPivotAxle.position.copy(scoopPivot);
  root.add(scoopPivotAxle);

  const beam = addRole(new THREE.Group(),
    'rocking-engine-beam-with-five-adjustment-notches');
  beam.position.copy(beamPivot);
  root.add(beam);
  const beamBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.85, 0.25, 0.55),
    beamMaterial,
  );
  beamBody.position.x = 0.92;
  beam.add(beamBody);
  const beamTopRail = new THREE.Mesh(
    new THREE.BoxGeometry(2.55, 0.075, 0.62),
    darkMaterial,
  );
  beamTopRail.position.set(1.03, -0.15, 0);
  beam.add(beamTopRail);
  const notches = notchRadii.map((radius, index) => {
    const notch = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.13, 0.70),
      index === selectedNotchIndex
        ? matte(PALETTE.white, { roughness: 0.48 })
        : darkMaterial,
    ), index === selectedNotchIndex
      ? 'selected-adjustable-pitman-notch'
      : `available-adjustment-notch-${index + 1}`);
    notch.position.set(radius, 0.14, 0);
    notch.rotation.z = Math.PI / 4;
    beam.add(notch);
    return notch;
  });
  const upperPitmanPin = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 0.96, 24),
    darkMaterial,
  ), 'pitman-pin-seated-in-selected-beam-notch');
  upperPitmanPin.rotation.x = Math.PI / 2;
  upperPitmanPin.position.set(selectedNotchRadius, 0, 0);
  beam.add(upperPitmanPin);
  const beamPivotAxle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 1.12, 28),
    darkMaterial,
  ), 'fixed-right-engine-beam-pivot');
  beamPivotAxle.rotation.x = Math.PI / 2;
  beamPivotAxle.position.copy(beamPivot);
  root.add(beamPivotAxle);
  const beamPedestal = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.23, 0.90),
    frameMaterial,
  );
  beamPedestal.position.set(beamPivot.x, beamPivot.y - 0.24, 0);
  root.add(beamPedestal);

  const pitman = addRole(new THREE.Group(),
    'fixed-length-double-bar-pitman-between-selected-notch-and-scoop');
  root.add(pitman);
  const pitmanBars = [-0.25, 0.25].map((z) => {
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 1, 16),
      darkMaterial,
    );
    bar.position.z = z;
    pitman.add(bar);
    return bar;
  });

  // The source pose dips the scoop's mouth into the pit water. The
  // discharge at the high dwell (the scoop is then still): the lifted
  // water runs down the scoop floor, under the trunnion and out of the spout
  // over the ridge, falling into the upper channel; one continuous stream
  // whose flow follows the emptying rate.
  const highState = stateAtInputAngle(FULL_TURN * (liftEndPhase + dischargeEndPhase) / 2);
  const highPoint = (x, y) => scoopPivot.clone().add(rotateLocal(new THREE.Vector3(x, y, 0), highState.scoopAngle));
  const spoutLip = highPoint(-0.58, -0.17);
  const spoutDirection = highPoint(-0.58, -0.17).sub(highPoint(0, -0.17)).normalize();
  // Pass 90: the run-off leaves the draining water in the bucket as a sheet
  // the width of the scoop's mouth (0.68 between the side plates), deep
  // enough to read from the front, and pours off the spout lip.
  const dischargeRun = () => guidedPath([highPoint(1.78, -0.80), highPoint(0.95, -0.42), highPoint(0.15, -0.02),
    highPoint(0.0, -0.17), spoutLip], {speedAt: (u) => 0.7 + 0.7 * u, samples: 32});
  const dischargeFullPath = joinPaths(
    dischargeRun(),
    ballisticPath({origin: spoutLip, velocity: spoutDirection.clone().multiplyScalar(1.4), endY: -0.60, samples: 16}),
  );
  const dischargePath = {points: dischargeFullPath.points.map((point) => point.clone()),
    speeds: dischargeFullPath.speeds.slice(), times: dischargeFullPath.times.slice()};
  // The run-off starts at the bucket and advances along the floor as the
  // flow starts (sampled in place from the full path; no allocation).
  const setDischargeReach = (fraction) => {
    const last = dischargeFullPath.points.length - 1, count = dischargePath.points.length - 1;
    for (let i = 0; i <= count; i += 1) {
      const u = Math.max(0.02, fraction) * last * i / count, k = Math.min(last - 1, Math.floor(u)), w = u - k;
      dischargePath.points[i].lerpVectors(dischargeFullPath.points[k], dischargeFullPath.points[k + 1], w);
      dischargePath.speeds[i] = dischargeFullPath.speeds[k] * (1 - w) + dischargeFullPath.speeds[k + 1] * w;
      dischargePath.times[i] = dischargeFullPath.times[k] * (1 - w) + dischargeFullPath.times[k + 1] * w;
    }
  };
  const dischargeStream = addRole(new WaterStream(joinPaths(
    dischargeRun(),
    ballisticPath({origin: spoutLip, velocity: spoutDirection.multiplyScalar(1.4), endY: -0.60, samples: 16}),
  ), {width: 0.34, thickness: 0.12, widthAxis: new THREE.Vector3(0, 0, 1), widthExponent: 0.15,
    foam: {start: 0.9, amount: 0.4}, cyclePeriod: cycleDuration, streakRate: 1.2, opacity: 0.5}),
  'intermittent-discharge-from-raised-scoop-to-left-channel');
  root.add(dischargeStream);
  const maximumDischargeRate = 1.875 / ((dischargeEndPhase - liftEndPhase) * cycleDuration);
  const updateStreams = collectWaterStreams(root);

  const update = (time) => {
    const state = stateAtTime(time);
    beam.rotation.z = state.beamAngle;
    scoop.rotation.z = state.scoopAngle;
    for (const bar of pitmanBars) {
      const start = state.upperPin.clone();
      const end = state.lowerPin.clone();
      start.z = bar.position.z;
      end.z = bar.position.z;
      setRodBetween(bar, start, end);
    }
    scoopWater.visible = state.waterFraction > 1e-5;
    scoopWater.scale.y = Math.max(0.001, state.waterFraction);
    scoopWater.position.y = -1.11 + 0.21 * state.waterFraction;
    root.userData.updateSolids?.(state);
    const dischargeFlow = Math.min(1, state.dischargeFlowRate / maximumDischargeRate);
    dischargeStream.visible = dischargeFlow > 0.004;
    if (dischargeStream.visible) {
      setDischargeReach(Math.min(1, dischargeFlow / 0.3));
      dischargeStream.flow = Math.max(0.004, dischargeFlow);
      dischargeStream.setPath(dischargePath);
    }
    updateStreams(time);
  };

  const sourceState = stateAtInputAngle(0);
  const notchLiftHeights = notchRadii.map((_, notchIndex) => {
    const low = stateAtInputAngleForNotch(0, notchIndex);
    const high = stateAtInputAngleForNotch(
      FULL_TURN * liftEndPhase,
      notchIndex,
    );
    return high.intakePoint.y - low.intakePoint.y;
  });
  const geometry = {
    beamPivot,
    cycleDuration,
    dischargeEndPhase,
    groundY,
    highBeamAngle,
    inputAngularSpeed,
    intakeLipLocal,
    liftEndPhase,
    loweringEndPhase,
    lowBeamAngle,
    notchLiftHeights,
    notchRadii,
    outletLocal,
    pitmanLength,
    scoopConnectionRadius,
    scoopPivot,
    selectedNotchIndex,
    selectedNotchRadius,
  };
  root.userData = {
    archetype:
      'fairbairn-four-bar-bailing-scoop-with-adjustable-beam-notch-and-rigid-pitman',
    blocks: {
      base,
      basin,
      basinWater,
      beam,
      beamBody,
      beamPedestal,
      beamPivotAxle,
      deliveryChannel,
      deliveryWater,
      dischargeStream,
      leftBank,
      notches,
      pitman,
      pitmanBars,
      rightBank,
      scoop,
      scoopConnectionPin,
      scoopFloor,
      scoopPivotAxle,
      scoopSidePlates,
      scoopWater,
      upperPitmanPin,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      notchSelectionDuringOperation: false,
      operatingDegreesOfFreedom: 1,
      pitmanLengthIndependent: false,
      scoopAngleIndependent: false,
      selectedNotchIndex,
    },
    dynamics: {
      engineForceFluidInertiaLeakageImpactPitmanFlexureJointFrictionAndWaterSloshModeled:
        false,
      fillDischargeModel:
        'Water is displayed full during the lift, drained during a high dwell, absent during lowering, and refilled during a low dwell. This clarifies function but is a prescribed C2 volume schedule rather than a free-surface CFD solution.',
      linkageModel:
        'The beam pin, fixed-length pitman and scoop pin are solved as an exact planar four-bar using the lower circle-intersection branch. Velocity and acceleration follow the differentiated closure equation; no endpoint interpolation is used for the scoop.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Fairbairn’s rigid scoop rocks about the fixed left trunnion. A fixed-length double-bar pitman joins its lug to one of five notches along the left arm of a rocking single-acting-engine beam. The selected radial notch determines the upper pin’s arc; exact circle closure determines the scoop angle. Moving the pitman farther from the beam pivot increases both scoop angular travel and the vertical lift of its intake lip.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'C2-rocking-engine-beam-driving-exact-adjustable-four-bar-scoop-lift',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      sourcePrescribedAbsoluteTiming: false,
      sourcePrescribedNormalizedTiming: false,
    },
    sourcePose: {
      beamAngle: sourceState.beamAngle,
      lowerPin: sourceState.lowerPin.clone(),
      mode: sourceState.mode,
      notchIndex: sourceState.notchIndex,
      scoopAngle: sourceState.scoopAngle,
      upperPin: sourceState.upperPin.clone(),
    },
    sourceReference: {
      brownPlate460: {
        approximateBeamPivotPixels: [407, 174],
        approximatePitmanLowerPinPixels: [285, 321],
        approximatePitmanUpperPinPixels: [285, 225],
        approximateScoopIntakeLipPixels: [334, 342],
        approximateScoopPivotPixels: [111, 252],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 16,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'Fairbairn’s bailing scoop elevates water short distances',
          'the scoop is connected by a pitman',
          'the pitman connects to a lever or single-acting-engine beam',
          'moving the rod end among the shown notches alters lift distance',
        ],
        engravingEvidence:
          'Brown shows a fixed left scoop trunnion, a long open curved scoop dipping into a lower basin, a nearly vertical double-bar pitman, five notches on the underside of a right-supported rocking beam, and the rod pin seated in a middle notch.',
        reconstructionDisclosure:
          'Brown gives no pivot coordinates, link lengths, notch spacing, beam stroke, scoop cross-section, water capacity, load, speed or timing. Dimensions are reconstructed from the plate’s relative geometry; the five-notch exact four-bar family, C2 lift/dwell schedule, displayed basin and delivery water, colors and 7.6-second cycle are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 460',
    },
    stateAtInputAngle,
    stateAtInputAngleForNotch,
    stateAtTime,
    timeline: {
      dischargeEndPhase,
      liftEndPhase,
      loweringEndPhase,
      stages: [
        'full scoop raised by pitman',
        'scoop held high and discharged',
        'empty scoop lowered by pitman',
        'scoop held low and filled',
      ],
    },
    transmission: {
      adjustableLift:
        'The pitman length and scoop lug radius remain fixed. Selecting a different beam radius changes the exact circle-intersection output sweep; the five computed intake-lip lift heights increase with notch radius.',
      fourBarClosure:
        '|B-D|=selected notch radius, |C-A|=scoop lug radius, and |C-B|=pitman length at every pose.',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.25, groundY, -1.70),
    new THREE.Vector3(4.05, 2.15, 1.70),
  );
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraDirection = new THREE.Vector3(2.2, 3.2, 12.5);
  root.userData.groundFloorY = groundY;
  correctWaterLiftParts(root,460);
  markShadows(root);
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredBailingScoopMovement(movement) {
  if (movement.id !== 460) return null;
  return bailingScoop(movement);
}
