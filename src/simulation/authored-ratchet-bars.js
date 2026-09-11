import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function rotateVector(vector, angle) {
  return new THREE.Vector2(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  );
}

function perpendicular(vector) {
  return new THREE.Vector2(-vector.y, vector.x);
}

function centeredExtrusion(shape, depth, bevelSize = 0.018) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevelSize > 0,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 12,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function makeAxialPin({
  color = PALETTE.ink,
  depth,
  radius,
  role,
}) {
  const pin = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, 28),
    matte(color, { metalness: 0.24, roughness: 0.48 }),
  );
  pin.rotation.x = Math.PI / 2;
  pin.userData.role = role;
  return pin;
}

function makeBeamBetween(start, end, {
  depth,
  material,
  role,
  width,
}) {
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(start.distanceTo(end), width, depth),
    material,
  );
  beam.position.set(
    (start.x + end.x) / 2,
    (start.y + end.y) / 2,
    0,
  );
  beam.rotation.z = Math.atan2(end.y - start.y, end.x - start.x);
  beam.userData.role = role;
  return beam;
}

function makePawl({
  color,
  depth,
  length,
  role,
  width,
}) {
  const pawl = new THREE.Group();
  pawl.userData.length = length;
  pawl.userData.role = role;
  const material = matte(color, { metalness: 0.13, roughness: 0.61 });
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(length, width, depth),
    material,
  );
  beam.position.x = length / 2;
  beam.userData.role = `${role}-rigid-beam`;
  pawl.add(beam);

  const rootBoss = makeAxialPin({
    color: PALETTE.ink,
    depth: depth + 0.12,
    radius: width * 0.78,
    role: `${role}-lever-hinge-boss`,
  });
  rootBoss.position.z = 0.025;
  pawl.add(rootBoss);

  const hook = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.82, width * 1.72, depth * 1.04),
    material,
  );
  hook.position.set(length - width * 0.22, width * 0.47, 0);
  hook.rotation.z = 0.16;
  hook.userData.role = `${role}-downturned-hook`;
  pawl.add(hook);

  const nose = makeAxialPin({
    color: PALETTE.ink,
    depth: depth + 0.07,
    radius: width * 0.29,
    role: `${role}-point-contact-nose`,
  });
  nose.position.set(length, 0, 0.018);
  pawl.add(nose);
  pawl.userData.beam = beam;
  pawl.userData.hook = hook;
  pawl.userData.nose = nose;
  return pawl;
}

function makeRatchetRack({
  baseBottomY,
  baseFace,
  baseRight,
  baseLeft,
  depth,
  faceIndexMaximum,
  faceIndexMinimum,
  pitch,
  toothRootY,
  toothTipY,
}) {
  const rack = new THREE.Group();
  rack.userData.role = 'left-moving-asymmetric-ratchet-bar';
  const rackMaterial = matte(PALETTE.driven, {
    metalness: 0.11,
    roughness: 0.64,
  });
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(
      baseRight - baseLeft,
      toothRootY - baseBottomY,
      depth,
    ),
    rackMaterial,
  );
  body.position.set(
    (baseLeft + baseRight) / 2,
    (baseBottomY + toothRootY) / 2,
    0,
  );
  body.userData.role = 'uniform-sliding-ratchet-bar-body';
  rack.add(body);

  const toothShape = new THREE.Shape();
  const firstFace = baseFace + faceIndexMinimum * pitch;
  toothShape.moveTo(firstFace - pitch, toothRootY);
  const driveFaces = [];
  for (
    let faceIndex = faceIndexMinimum;
    faceIndex <= faceIndexMaximum;
    faceIndex += 1
  ) {
    const faceX = baseFace + faceIndex * pitch;
    toothShape.lineTo(faceX, toothTipY);
    toothShape.lineTo(faceX, toothRootY);
    driveFaces.push({
      faceIndex,
      root: new THREE.Vector2(faceX, toothRootY),
      tip: new THREE.Vector2(faceX, toothTipY),
    });
  }
  toothShape.closePath();
  const teeth = new THREE.Mesh(
    centeredExtrusion(toothShape, depth, 0.006),
    rackMaterial,
  );
  teeth.userData.driveFaces = driveFaces;
  teeth.userData.faceIndexMaximum = faceIndexMaximum;
  teeth.userData.faceIndexMinimum = faceIndexMinimum;
  teeth.userData.pitch = pitch;
  teeth.userData.profile = 'rising-return-ramp-and-vertical-left-pulling-face';
  teeth.userData.role = 'continuous-asymmetric-sawtooth-rack-profile';
  rack.add(teeth);

  const indexMaterial = matte(PALETTE.white, { roughness: 0.46 });
  const indexes = [];
  for (
    let faceIndex = faceIndexMinimum;
    faceIndex <= faceIndexMaximum;
    faceIndex += 2
  ) {
    const index = new THREE.Mesh(
      new THREE.BoxGeometry(pitch * 0.34, 0.07, 0.035),
      indexMaterial,
    );
    index.position.set(
      baseFace + faceIndex * pitch - pitch * 0.5,
      baseBottomY + 0.14,
      depth / 2 + 0.035,
    );
    index.userData.faceIndex = faceIndex;
    index.userData.role = 'two-pitch-periodic-bar-motion-index';
    rack.add(index);
    indexes.push(index);
  }
  rack.userData.body = body;
  rack.userData.driveFaces = driveFaces;
  rack.userData.indexes = indexes;
  rack.userData.teeth = teeth;
  return rack;
}

function alternatingPawlRatchetBar(movement) {
  const root = new THREE.Group();
  const sourceScale = 0.018;
  const sourceFulcrumPixels = new THREE.Vector2(432, 246);
  const sourceToModel = (pixel) => new THREE.Vector2(
    (pixel.x - sourceFulcrumPixels.x) * sourceScale,
    (sourceFulcrumPixels.y - pixel.y) * sourceScale,
  );
  const sourceLongAnchorPixels = new THREE.Vector2(417, 228);
  const sourceShortAnchorPixels = new THREE.Vector2(440, 267);
  const sourceLongNosePixels = new THREE.Vector2(202, 284);
  const sourceShortNosePixels = new THREE.Vector2(286, 284);
  const sourceHandleEndPixels = new THREE.Vector2(516, 181);
  const measuredLongAnchorAtSource = sourceToModel(sourceLongAnchorPixels);
  const measuredShortAnchorAtSource = sourceToModel(sourceShortAnchorPixels);
  const measuredLongNoseAtSource = sourceToModel(sourceLongNosePixels);
  const measuredShortNoseAtSource = sourceToModel(sourceShortNosePixels);
  const measuredHandleEndAtSource = sourceToModel(sourceHandleEndPixels);

  const rackPitch = 14 * sourceScale;
  const contactY = measuredLongNoseAtSource.y;
  const toothTipY = contactY;
  const toothRootY = sourceToModel(new THREE.Vector2(432, 300)).y;
  const rackBaseBottomY = sourceToModel(new THREE.Vector2(432, 337)).y;
  const longPawlLength = measuredLongAnchorAtSource.distanceTo(
    measuredLongNoseAtSource,
  );
  const tipXAt = (anchor, length, targetY = contactY) => {
    const vertical = targetY - anchor.y;
    const radicand = length ** 2 - vertical ** 2;
    if (radicand < -1e-12) {
      throw new RangeError('The pawl cannot reach its requested rack height.');
    }
    return anchor.x - Math.sqrt(Math.max(0, radicand));
  };

  const longTravelAtAmplitude = (amplitude) => {
    const localAnchor = rotateVector(measuredLongAnchorAtSource, -amplitude);
    const startAnchor = rotateVector(localAnchor, -amplitude);
    const endAnchor = rotateVector(localAnchor, amplitude);
    return tipXAt(startAnchor, longPawlLength)
      - tipXAt(endAnchor, longPawlLength);
  };
  let amplitudeLow = THREE.MathUtils.degToRad(10);
  let amplitudeHigh = THREE.MathUtils.degToRad(24);
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const amplitudeMiddle = (amplitudeLow + amplitudeHigh) / 2;
    if (longTravelAtAmplitude(amplitudeMiddle) < rackPitch) {
      amplitudeLow = amplitudeMiddle;
    } else {
      amplitudeHigh = amplitudeMiddle;
    }
  }
  const leverAmplitude = (amplitudeLow + amplitudeHigh) / 2;
  const longAnchorLocal = rotateVector(
    measuredLongAnchorAtSource,
    -leverAmplitude,
  );
  const longStartAnchor = rotateVector(longAnchorLocal, -leverAmplitude);
  const longEndAnchor = rotateVector(longAnchorLocal, leverAmplitude);
  const longStartTipX = tipXAt(longStartAnchor, longPawlLength);
  const longEndTipX = tipXAt(longEndAnchor, longPawlLength);
  const shortFaceOffset = 6;
  const shortStartTipX = longEndTipX + shortFaceOffset * rackPitch;

  const shortTravelForSourceY = (sourceY) => {
    const sourceAnchor = new THREE.Vector2(
      measuredShortAnchorAtSource.x,
      sourceY,
    );
    const localAnchor = rotateVector(sourceAnchor, -leverAmplitude);
    const length = sourceAnchor.distanceTo(
      new THREE.Vector2(shortStartTipX, contactY),
    );
    const endAnchor = rotateVector(localAnchor, -leverAmplitude);
    return {
      endTipX: tipXAt(endAnchor, length),
      length,
      localAnchor,
      sourceAnchor,
    };
  };
  let shortSourceYLow = measuredShortAnchorAtSource.y - 0.14;
  let shortSourceYHigh = measuredShortAnchorAtSource.y + 0.14;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const sourceYMiddle = (shortSourceYLow + shortSourceYHigh) / 2;
    const result = shortTravelForSourceY(sourceYMiddle);
    const travel = shortStartTipX - result.endTipX;
    if (travel > rackPitch) shortSourceYLow = sourceYMiddle;
    else shortSourceYHigh = sourceYMiddle;
  }
  const adjustedShortSourceY = (shortSourceYLow + shortSourceYHigh) / 2;
  const shortSolution = shortTravelForSourceY(adjustedShortSourceY);
  const shortAnchorLocal = shortSolution.localAnchor;
  const shortPawlLength = shortSolution.length;
  const shortEndTipX = shortSolution.endTipX;
  const handleEndLocal = rotateVector(
    measuredHandleEndAtSource,
    -leverAmplitude,
  );
  const baseFace = longStartTipX;
  const cyclesPerSecond = 0.2;
  const demonstrationPeriod = 1 / cyclesPerSecond;
  const sourceCyclePhase = 0.5;
  const resetLift = 0.22;
  const boundaryEpsilon = 1e-11;

  const liftEnvelope = (fraction) => (
    64 * fraction ** 3 * (1 - fraction) ** 3
  );
  const liftEnvelopeDerivative = (fraction) => (
    192 * fraction ** 2 * (1 - fraction) ** 2 * (1 - 2 * fraction)
  );
  const liftEnvelopeSecondDerivative = (fraction) => (
    384 * fraction * (1 - fraction)
      * (1 - 5 * fraction + 5 * fraction ** 2)
  );
  const normalizedCycleCoordinate = (coordinate) => {
    const nearestInteger = Math.round(coordinate);
    return Math.abs(coordinate - nearestInteger) < boundaryEpsilon
      ? nearestInteger
      : coordinate;
  };
  const anchorState = (localAnchor, leverAngle, angularSpeed, angularAcceleration) => {
    const position = rotateVector(localAnchor, leverAngle);
    const derivative = perpendicular(position);
    const velocity = derivative.clone().multiplyScalar(angularSpeed);
    const acceleration = position.clone().multiplyScalar(
      -(angularSpeed ** 2),
    ).addScaledVector(derivative, angularAcceleration);
    return { acceleration, position, velocity };
  };
  const constrainedPawlState = ({
    anchor,
    length,
    targetY,
    targetYAcceleration,
    targetYSpeed,
  }) => {
    const vertical = targetY - anchor.position.y;
    const verticalSpeed = targetYSpeed - anchor.velocity.y;
    const verticalAcceleration = targetYAcceleration - anchor.acceleration.y;
    const horizontalMagnitude = Math.sqrt(Math.max(
      0,
      length ** 2 - vertical ** 2,
    ));
    const tip = new THREE.Vector2(
      anchor.position.x - horizontalMagnitude,
      targetY,
    );
    const tipSpeed = new THREE.Vector2(
      anchor.velocity.x
        + vertical * verticalSpeed / horizontalMagnitude,
      targetYSpeed,
    );
    const tipAcceleration = new THREE.Vector2(
      anchor.acceleration.x
        + (verticalSpeed ** 2 + vertical * verticalAcceleration)
          / horizontalMagnitude
        + vertical ** 2 * verticalSpeed ** 2
          / horizontalMagnitude ** 3,
      targetYAcceleration,
    );
    const pawlVector = tip.clone().sub(anchor.position);
    const relativeTipSpeed = tipSpeed.clone().sub(anchor.velocity);
    const angularSpeed = (
      pawlVector.x * relativeTipSpeed.y
      - pawlVector.y * relativeTipSpeed.x
    ) / length ** 2;
    return {
      angle: Math.atan2(pawlVector.y, pawlVector.x),
      angularSpeed,
      lengthError: Math.abs(pawlVector.length() - length),
      tip,
      tipAcceleration,
      tipSpeed,
    };
  };

  const stateAtCycleCoordinate = (coordinate) => {
    const cycleCoordinate = normalizedCycleCoordinate(coordinate);
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const longDriving = cyclePhase < 0.5;
    const shortDriving = !longDriving;
    const leverAngle = -leverAmplitude * Math.cos(FULL_TURN * cyclePhase);
    const cycleAngularFrequency = FULL_TURN * cyclesPerSecond;
    const leverAngularSpeed = leverAmplitude * cycleAngularFrequency
      * Math.sin(FULL_TURN * cyclePhase);
    const leverAngularAcceleration = leverAmplitude
      * cycleAngularFrequency ** 2 * Math.cos(FULL_TURN * cyclePhase);
    const longAnchor = anchorState(
      longAnchorLocal,
      leverAngle,
      leverAngularSpeed,
      leverAngularAcceleration,
    );
    const shortAnchor = anchorState(
      shortAnchorLocal,
      leverAngle,
      leverAngularSpeed,
      leverAngularAcceleration,
    );

    const longResetFraction = shortDriving
      ? (cyclePhase - 0.5) * 2
      : null;
    const shortResetFraction = longDriving ? cyclePhase * 2 : null;
    const pawlState = (anchor, length, resetFraction) => {
      if (resetFraction === null) {
        return constrainedPawlState({
          anchor,
          length,
          targetY: contactY,
          targetYAcceleration: 0,
          targetYSpeed: 0,
        });
      }
      const resetRate = 2 * cyclesPerSecond;
      return constrainedPawlState({
        anchor,
        length,
        targetY: contactY + resetLift * liftEnvelope(resetFraction),
        targetYAcceleration: resetLift
          * liftEnvelopeSecondDerivative(resetFraction) * resetRate ** 2,
        targetYSpeed: resetLift
          * liftEnvelopeDerivative(resetFraction) * resetRate,
      });
    };
    const longPawl = pawlState(
      longAnchor,
      longPawlLength,
      longResetFraction,
    );
    const shortPawl = pawlState(
      shortAnchor,
      shortPawlLength,
      shortResetFraction,
    );
    const activePawl = longDriving ? longPawl : shortPawl;
    const activePawlKey = longDriving ? 'long-upper' : 'short-lower';
    const activeFaceIndex = longDriving
      ? cycleIndex * 2
      : shortFaceOffset + cycleIndex * 2;
    const activeFaceLocalX = baseFace + activeFaceIndex * rackPitch;
    const barDisplacement = activePawl.tip.x - activeFaceLocalX;
    const cycleBaseDisplacement = -2 * rackPitch * cycleIndex;
    const renderedBarDisplacement = barDisplacement - cycleBaseDisplacement;
    const renderedFaceIndex = longDriving ? 0 : shortFaceOffset;
    const renderedFaceX = baseFace
      + renderedFaceIndex * rackPitch
      + renderedBarDisplacement;
    const activeContactPoint = new THREE.Vector2(renderedFaceX, contactY);
    const atHandoff = Math.abs(Math.sin(FULL_TURN * cyclePhase))
      < boundaryEpsilon;
    const longResetClearance = longDriving
      ? 0
      : longPawl.tip.y - toothTipY;
    const shortResetClearance = shortDriving
      ? 0
      : shortPawl.tip.y - toothTipY;
    return {
      activeContactPoint,
      activeFaceIndex,
      activeFaceLocalX,
      activePawl: activePawlKey,
      activePawlContactError: activePawl.tip.distanceTo(activeContactPoint),
      activePawlLengthError: activePawl.lengthError,
      atHandoff,
      barAcceleration: activePawl.tipAcceleration.x,
      barDisplacement,
      barDirection: 'left',
      barPitchesAdvanced: -barDisplacement / rackPitch,
      barSpeed: activePawl.tipSpeed.x,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      drivingContactCount: 1,
      instantaneousDwell: atHandoff,
      leverAngle,
      leverAngularAcceleration,
      leverAngularSpeed,
      longAnchor: longAnchor.position,
      longAnchorAcceleration: longAnchor.acceleration,
      longAnchorVelocity: longAnchor.velocity,
      longDriving,
      longPawlAngle: longPawl.angle,
      longPawlAngularSpeed: longPawl.angularSpeed,
      longPawlLengthError: longPawl.lengthError,
      longResetClearance,
      longResetFraction,
      longTip: longPawl.tip,
      longTipAcceleration: longPawl.tipAcceleration,
      longTipVelocity: longPawl.tipSpeed,
      renderedBarDisplacement,
      renderedFaceIndex,
      resetPawl: longDriving ? 'short-lower' : 'long-upper',
      shortAnchor: shortAnchor.position,
      shortAnchorAcceleration: shortAnchor.acceleration,
      shortAnchorVelocity: shortAnchor.velocity,
      shortDriving,
      shortPawlAngle: shortPawl.angle,
      shortPawlAngularSpeed: shortPawl.angularSpeed,
      shortPawlLengthError: shortPawl.lengthError,
      shortResetClearance,
      shortResetFraction,
      shortTip: shortPawl.tip,
      shortTipAcceleration: shortPawl.tipAcceleration,
      shortTipVelocity: shortPawl.tipSpeed,
      stage: longDriving
        ? 'long-upper-pawl-pulls-left-short-lower-pawl-resets'
        : 'short-lower-pawl-pulls-left-long-upper-pawl-resets',
    };
  };
  const stateAtTime = (time) => stateAtCycleCoordinate(
    sourceCyclePhase + time * cyclesPerSecond,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.69,
  });
  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(7.3, 0.16, 0.54),
    frameMaterial,
  );
  baseRail.position.set(-2.78, -2.2, -0.34);
  baseRail.userData.role = 'fixed-bed-rail';
  root.add(baseRail);
  const guidePosts = [-4.72, -1.54].map((x, index) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.92, 0.62),
      frameMaterial,
    );
    post.position.set(x, -1.72, -0.28);
    post.userData.index = index;
    post.userData.role = 'ratchet-bar-sliding-guide-pedestal';
    root.add(post);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.13, 0.7),
      frameMaterial,
    );
    cap.position.set(x, -1.24, -0.28);
    cap.userData.index = index;
    cap.userData.role = 'ratchet-bar-guide-cap';
    root.add(cap);
    return { cap, post };
  });
  const pivotStand = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 2.22, 0.7),
    frameMaterial,
  );
  pivotStand.position.set(0.04, -1.11, -0.34);
  pivotStand.userData.role = 'fixed-lever-fulcrum-standard';
  root.add(pivotStand);

  const rack = makeRatchetRack({
    baseBottomY: rackBaseBottomY,
    baseFace,
    baseLeft: -7.2,
    baseRight: 0.42,
    depth: 0.46,
    faceIndexMaximum: 17,
    faceIndexMinimum: -13,
    pitch: rackPitch,
    toothRootY,
    toothTipY,
  });
  rack.position.z = 0.02;
  root.add(rack);

  const lever = new THREE.Group();
  lever.userData.axis = Z_AXIS.clone();
  lever.userData.role = 'three-pin-vibrating-input-lever';
  const leverRotor = new THREE.Group();
  leverRotor.userData.role = 'rigid-vibrating-lever-rotor';
  lever.add(leverRotor);
  lever.position.z = 0.72;
  root.add(lever);
  const leverMaterial = matte(PALETTE.driver, {
    metalness: 0.11,
    roughness: 0.62,
  });
  const leverBody = new THREE.Group();
  leverBody.userData.role = 'forked-handle-joining-both-pawl-pins';
  leverBody.add(
    makeBeamBetween(new THREE.Vector2(), handleEndLocal, {
      depth: 0.2,
      material: leverMaterial,
      role: 'vibrating-lever-handle',
      width: 0.2,
    }),
    makeBeamBetween(new THREE.Vector2(), longAnchorLocal, {
      depth: 0.24,
      material: leverMaterial,
      role: 'upper-pawl-pin-arm',
      width: 0.28,
    }),
    makeBeamBetween(new THREE.Vector2(), shortAnchorLocal, {
      depth: 0.24,
      material: leverMaterial,
      role: 'lower-pawl-pin-arm',
      width: 0.28,
    }),
  );
  const leverPlate = makeAxialPin({
    color: PALETTE.driver,
    depth: 0.25,
    radius: 0.34,
    role: 'triangular-lever-center-plate',
  });
  leverBody.add(leverPlate);
  leverRotor.add(leverBody);
  const leverPins = [
    {
      point: longAnchorLocal,
      role: 'long-upper-pawl-pin-on-lever',
    },
    {
      point: new THREE.Vector2(),
      role: 'fixed-middle-fulcrum-pin',
    },
    {
      point: shortAnchorLocal,
      role: 'short-lower-pawl-pin-on-lever',
    },
  ].map(({ point, role }) => {
    const pin = makeAxialPin({
      depth: 0.44,
      radius: role === 'fixed-middle-fulcrum-pin' ? 0.11 : 0.085,
      role,
    });
    pin.position.set(point.x, point.y, 0.04);
    leverRotor.add(pin);
    return pin;
  });
  const fixedFulcrum = makeAxialPin({
    depth: 1.16,
    radius: 0.13,
    role: 'stationary-lever-fulcrum-shaft',
  });
  fixedFulcrum.position.z = 0.34;
  root.add(fixedFulcrum);

  const longPawl = makePawl({
    color: PALETTE.accent,
    depth: 0.18,
    length: longPawlLength,
    role: 'long-upper-alternating-pull-pawl',
    width: 0.14,
  });
  longPawl.position.z = 0.89;
  root.add(longPawl);
  const shortPawl = makePawl({
    color: PALETTE.brass,
    depth: 0.18,
    length: shortPawlLength,
    role: 'short-lower-alternating-pull-pawl',
    width: 0.14,
  });
  shortPawl.position.z = 0.61;
  root.add(shortPawl);

  const longContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 20, 14),
    matte(PALETTE.white, { roughness: 0.44 }),
  );
  longContactMarker.position.z = 1.04;
  longContactMarker.userData.role = 'long-pawl-active-contact-marker';
  root.add(longContactMarker);
  const shortContactMarker = longContactMarker.clone();
  shortContactMarker.material = matte(PALETTE.white, { roughness: 0.44 });
  shortContactMarker.position.z = 0.8;
  shortContactMarker.userData.role = 'short-pawl-active-contact-marker';
  root.add(shortContactMarker);

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    baseRail,
    fixedFulcrum,
    guidePosts,
    lever,
    leverBody,
    leverPins,
    leverRotor,
    longContactMarker,
    longPawl,
    pivotStand,
    rack,
    rackBody: rack.userData.body,
    rackIndexes: rack.userData.indexes,
    rackTeeth: rack.userData.teeth,
    shortContactMarker,
    shortPawl,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-6.35, -2.34, -0.72),
    new THREE.Vector3(1.82, 1.62, 1.14),
  );
  root.userData.geometry = {
    baseFace,
    contactY,
    handleEndLocal,
    leverAmplitude,
    longAnchorLocal,
    longEndTipX,
    longPawlLength,
    longStartTipX,
    rackBaseBottomY,
    rackPitch,
    resetLift,
    shortAnchorLocal,
    shortEndTipX,
    shortFaceOffset,
    shortPawlLength,
    shortStartTipX,
    toothHeight: toothTipY - toothRootY,
    toothRootY,
    toothTipY,
  };
  root.userData.mechanism =
    'one-vibrating-three-pin-lever-carries-two-rigid-pawls-on-opposite-sides-of-its-fixed-fulcrum; the-long-upper-pawl-pulls-the-ratchet-bar-left-one-pitch-on-the-first-half-stroke-and-the-short-lower-pawl-pulls-it-left-one-pitch-on-the-second-half-stroke; the-returning-pawl-lifts-clear-over-the-ratchet-crests';
  root.userData.movement = movement;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason:
      'The official Movement 271 page labels the animation unavailable; direction and pawl sequence were inferred from the public-domain engraving and description.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate271: {
      imageHeight: 525,
      imageWidth: 525,
      inferredDirection:
        'leftward rack travel, because each downturned pawl hook pulls the vertical face immediately to its left',
      inferredTopology:
        'one three-pin vibrating lever with a fixed middle fulcrum, a long upper pawl, a short lower pawl, and one horizontally guided asymmetric ratchet-bar',
      measurementUncertaintyPixels: 6,
      officialAnimationAvailable: false,
      rasterFulcrum: { x: 432, y: 246 },
      rasterHandleEnd: { x: 516, y: 181 },
      rasterLongPawl: {
        anchor: { x: 417, y: 228 },
        nose: { x: 202, y: 284 },
      },
      rasterRack: {
        approximateToothCount: 18,
        pitchPixels: 14,
        rootY: 300,
        tipY: 284,
      },
      rasterShortPawl: {
        anchor: { x: 440, y: 267 },
        nose: { x: 286, y: 284 },
      },
      sourceScale,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 69,
      edition: 21,
      illustrationPage: 68,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cyclesPerSecond,
    demonstrationPeriod,
    sourceCyclePhase,
  };
  root.userData.transmission = {
    advancePerHalfStroke: rackPitch,
    advancePerLeverVibration: 2 * rackPitch,
    driveSequence: [
      'long-upper-pawl-pulls-left',
      'short-lower-pawl-pulls-left',
    ],
    dwellIntervalsPerCycle: 0,
    instantaneousHandoffsPerCycle: 2,
    liftEnvelope,
    liftEnvelopeDerivative,
    liftEnvelopeSecondDerivative,
    outputDirection: 'leftward-unidirectional',
    periodicRenderWrap: 2 * rackPitch,
    toothPitchesPerLeverVibration: 2,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    rack.position.x = state.renderedBarDisplacement;
    leverRotor.rotation.z = state.leverAngle;
    longPawl.position.x = state.longAnchor.x;
    longPawl.position.y = state.longAnchor.y;
    longPawl.rotation.z = state.longPawlAngle;
    shortPawl.position.x = state.shortAnchor.x;
    shortPawl.position.y = state.shortAnchor.y;
    shortPawl.rotation.z = state.shortPawlAngle;
    longContactMarker.visible = state.longDriving;
    shortContactMarker.visible = state.shortDriving;
    longContactMarker.position.x = state.longTip.x;
    longContactMarker.position.y = state.longTip.y;
    shortContactMarker.position.x = state.shortTip.x;
    shortContactMarker.position.y = state.shortTip.y;
    rack.userData.velocity = new THREE.Vector3(state.barSpeed, 0, 0);
    lever.userData.angularSpeed = state.leverAngularSpeed;
    longPawl.userData.angularSpeed = state.longPawlAngularSpeed;
    shortPawl.userData.angularSpeed = state.shortPawlAngularSpeed;
    root.userData.contacts = {
      activePawlToRatchetBar: {
        contactError: state.activePawlContactError,
        drivingContactCount: 1,
        faceIndex: state.activeFaceIndex,
        pawl: state.activePawl,
        point: state.activeContactPoint.clone(),
        simultaneousDriving: false,
      },
      longPawlToRatchetBar: {
        clearance: state.longResetClearance,
        engaged: state.longDriving,
        mode: state.longDriving ? 'pulling-left' : 'resetting-above-crests',
      },
      shortPawlToRatchetBar: {
        clearance: state.shortResetClearance,
        engaged: state.shortDriving,
        mode: state.shortDriving ? 'pulling-left' : 'resetting-above-crests',
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(3.7, 3.2, 12.4),
  };
}

export function createAuthoredRatchetBarMovement(movement) {
  if (movement.id !== 271) return null;
  const result = alternatingPawlRatchetBar(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
