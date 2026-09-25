import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import { makeSteppedRatchetPawl, finishRatchetBarSupports, pawlReturnLift } from './ratchet-bar-working-parts.js';
import { ring } from './finite-plate-geometry.js';
import { makeLaidRopeMesh } from './laid-rope.js';

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
    centeredExtrusion(toothShape, depth, 0),
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
      new THREE.BoxGeometry(pitch * 0.34, 0.07, 0.004),
      indexMaterial,
    );
    index.position.set(
      baseFace + faceIndex * pitch - pitch * 0.5,
      baseBottomY + 0.14,
      depth / 2 + 0.002,
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

  // Brown engraves about 22 small teeth, 10.5 px apart and about 6 px deep
  // (tips at the hook line, 284 px; roots at 290 px). A slim hook nose (0.022)
  // working 0.04 below the crests clears the next ramp at pickup at that
  // depth. They sit on a
  // thin bar lying on a table; the short pawl sits eight pitches behind.
  const rackPitch = 10.5 * sourceScale;
  const toothTipY = measuredLongNoseAtSource.y;
  const noseRadius = 0.022;
  const contactY = toothTipY - 0.04;
  const pickupTravel = 0.05;
  const pawlStroke = rackPitch + pickupTravel;
  const toothRootY = sourceToModel(new THREE.Vector2(432, 290)).y;
  const rackBaseBottomY = sourceToModel(new THREE.Vector2(432, 296)).y;
  const longPawlLength = measuredLongAnchorAtSource.distanceTo(
    new THREE.Vector2(measuredLongNoseAtSource.x, contactY),
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
    if (longTravelAtAmplitude(amplitudeMiddle) < pawlStroke) {
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
  const shortFaceOffset = 8;
  const shortStartTipX = longEndTipX + shortFaceOffset * rackPitch + pickupTravel;

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
    if (travel > pawlStroke) shortSourceYLow = sourceYMiddle;
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
  const baseFace = longStartTipX - noseRadius - pickupTravel;
  const cyclesPerSecond = 0.2;
  const demonstrationPeriod = 1 / cyclesPerSecond;
  const sourceCyclePhase = 0.5;
  const resetLift = 0.20;
  const boundaryEpsilon = 1e-11;

  const liftEnvelope = fraction => pawlReturnLift(fraction).value;
  const liftEnvelopeDerivative = fraction => pawlReturnLift(fraction).first;
  const liftEnvelopeSecondDerivative = fraction => pawlReturnLift(fraction).second;
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
    const halfStrokeStart = -2 * rackPitch * cycleIndex - (longDriving ? 0 : rackPitch);
    const proposedDisplacement = activePawl.tip.x - noseRadius - activeFaceLocalX;
    const barDisplacement = Math.min(halfStrokeStart, proposedDisplacement);
    const engaged = proposedDisplacement <= halfStrokeStart + 1e-12;
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
      activePawlContactError: Math.abs(activePawl.tip.x - noseRadius - activeContactPoint.x),
      engaged,
      pickupClearance: Math.max(0, proposedDisplacement - halfStrokeStart),
      activePawlLengthError: activePawl.lengthError,
      atHandoff,
      barAcceleration: engaged ? activePawl.tipAcceleration.x : 0,
      barDisplacement,
      barDirection: 'left',
      barPitchesAdvanced: -barDisplacement / rackPitch,
      barSpeed: engaged ? activePawl.tipSpeed.x : 0,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      drivingContactCount: engaged ? 1 : 0,
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
  // The demonstration runs two whole lever vibrations (four pitches of
  // leftward travel, from the bar's rightmost position clear of the post)
  // and then returns the bar in view instead of wrapping it: the long pawl,
  // which still has its pickup clearance, lifts; the lever eases forward a
  // few degrees so the short hook leaves its face; the short pawl lifts; and
  // with both hooks clear of the crests the bar slides back four pitches.
  // The pawls then drop back in reverse order onto exactly the start pose.
  // Brown's pose (cycle phase 0.5) opens the loop. The return is a
  // prescribed demonstration reset.
  const driveVibrations = 2;
  const driveDuration = driveVibrations / cyclesPerSecond;
  const returnDuration = 2.5;
  const loopPeriod = driveDuration + returnDuration;
  const returnStartTime = (driveVibrations - sourceCyclePhase) / cyclesPerSecond;
  const returnLeverForward = 0.15;
  const returnLift = resetLift;
  const quinticRamp = (value, start, end) => {
    const u = THREE.MathUtils.clamp((value - start) / (end - start), 0, 1);
    return u ** 3 * (10 - 15 * u + 6 * u ** 2);
  };
  const liftBump = (u, riseStart, riseEnd) => quinticRamp(u, riseStart, riseEnd)
    - quinticRamp(u, 1 - riseEnd, 1 - riseStart);
  const returnPositions = (u) => {
    const leverAngle = -leverAmplitude + returnLeverForward * liftBump(u, 0.05, 0.2);
    const zero = { acceleration: new THREE.Vector2(), velocity: new THREE.Vector2() };
    const longAnchor = { ...zero, position: rotateVector(longAnchorLocal, leverAngle) };
    const shortAnchor = { ...zero, position: rotateVector(shortAnchorLocal, leverAngle) };
    const pawl = (anchor, length, lift) => constrainedPawlState({
      anchor, length, targetY: contactY + returnLift * lift,
      targetYAcceleration: 0, targetYSpeed: 0,
    });
    const barStart = -2 * driveVibrations * rackPitch;
    return {
      barDisplacement: barStart * (1 - quinticRamp(u, 0.3, 0.7)),
      leverAngle,
      longAnchor: longAnchor.position,
      longPawl: pawl(longAnchor, longPawlLength, liftBump(u, 0, 0.15)),
      shortAnchor: shortAnchor.position,
      shortPawl: pawl(shortAnchor, shortPawlLength, liftBump(u, 0.12, 0.27)),
    };
  };
  const returnState = (u) => {
    const now = returnPositions(u);
    const du = 1e-5;
    const before = returnPositions(Math.max(0, u - du));
    const after = returnPositions(Math.min(1, u + du));
    const rate = 1 / ((Math.min(1, u + du) - Math.max(0, u - du)) * returnDuration);
    const tipVelocity = (key) => after[key].tip.clone().sub(before[key].tip).multiplyScalar(rate);
    const barSpeed = (after.barDisplacement - before.barDisplacement) * rate;
    const zero = new THREE.Vector2();
    return {
      activeContactPoint: null,
      activeFaceIndex: null,
      activePawl: null,
      activePawlContactError: 0,
      atHandoff: false,
      barAcceleration: 0,
      barDirection: 'right-return',
      barDisplacement: now.barDisplacement,
      barPitchesAdvanced: -now.barDisplacement / rackPitch,
      barSpeed,
      demonstrationReturn: true,
      drivingContactCount: 0,
      engaged: false,
      leverAngle: now.leverAngle,
      leverAngularAcceleration: 0,
      leverAngularSpeed: (after.leverAngle - before.leverAngle) * rate,
      longAnchor: now.longAnchor,
      longAnchorAcceleration: zero.clone(),
      longAnchorVelocity: after.longAnchor.clone().sub(before.longAnchor).multiplyScalar(rate),
      longDriving: false,
      longPawlAngle: now.longPawl.angle,
      longPawlAngularSpeed: (after.longPawl.angle - before.longPawl.angle) * rate,
      longPawlLengthError: now.longPawl.lengthError,
      longResetClearance: now.longPawl.tip.y - toothTipY,
      longTip: now.longPawl.tip,
      longTipAcceleration: zero.clone(),
      longTipVelocity: tipVelocity('longPawl'),
      renderedBarDisplacement: now.barDisplacement,
      returnFraction: u,
      shortAnchor: now.shortAnchor,
      shortAnchorAcceleration: zero.clone(),
      shortAnchorVelocity: after.shortAnchor.clone().sub(before.shortAnchor).multiplyScalar(rate),
      shortDriving: false,
      shortPawlAngle: now.shortPawl.angle,
      shortPawlAngularSpeed: (after.shortPawl.angle - before.shortPawl.angle) * rate,
      shortPawlLengthError: now.shortPawl.lengthError,
      shortResetClearance: now.shortPawl.tip.y - toothTipY,
      shortTip: now.shortPawl.tip,
      shortTipAcceleration: zero.clone(),
      shortTipVelocity: tipVelocity('shortPawl'),
      stage: 'both-pawls-lifted-bar-returned-for-demonstration',
    };
  };
  const stateAtTime = (time) => {
    const loopTime = ((time % loopPeriod) + loopPeriod) % loopPeriod;
    const returnEndTime = returnStartTime + returnDuration;
    if (loopTime >= returnStartTime - 1e-12 && loopTime < returnEndTime - 1e-12) {
      return returnState((loopTime - returnStartTime) / returnDuration);
    }
    const state = stateAtCycleCoordinate(loopTime < returnStartTime
      ? sourceCyclePhase + loopTime * cyclesPerSecond
      : (loopTime - returnEndTime) * cyclesPerSecond);
    // Within the demonstration the bar is drawn where it physically is.
    state.renderedBarDisplacement = state.barDisplacement;
    state.renderedFaceIndex = state.activeFaceIndex;
    state.activeContactPoint = new THREE.Vector2(
      baseFace + state.activeFaceIndex * rackPitch + state.barDisplacement,
      contactY,
    );
    return state;
  };

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
    baseLeft: sourceToModel(new THREE.Vector2(128, 0)).x,
    baseRight: -0.23,
    depth: 0.46,
    faceIndexMaximum: 16,
    faceIndexMinimum: -6,
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

  const longPawl = makeSteppedRatchetPawl({
    rootZ: 0.91,
    noseRadius,
    color: PALETTE.accent,
    depth: 0.18,
    length: longPawlLength,
    role: 'long-upper-alternating-pull-pawl',
    width: 0.14,
  });
  longPawl.position.z = 0.91;
  root.add(longPawl);
  const shortPawl = makeSteppedRatchetPawl({
    rootZ: 0.53,
    noseRadius,
    color: PALETTE.brass,
    depth: 0.18,
    length: shortPawlLength,
    role: 'short-lower-alternating-pull-pawl',
    width: 0.14,
  });
  shortPawl.position.z = 0.53;
  root.add(shortPawl);

  const longContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 12, 8),
    matte(PALETTE.white, { roughness: 0.44 }),
  );
  longContactMarker.position.z = 0.19;
  longContactMarker.userData.role = 'long-pawl-active-contact-marker';
  root.add(longContactMarker);
  const shortContactMarker = longContactMarker.clone();
  shortContactMarker.material = matte(PALETTE.white, { roughness: 0.44 });
  shortContactMarker.position.z = 0.19;
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
    noseRadius,
    pickupTravel,
    pawlStroke,
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
    'one-vibrating-three-pin-lever-carries-two-rigid-pawls-on-opposite-sides-of-its-fixed-fulcrum; the-long-upper-pawl-pulls-the-ratchet-bar-left-one-pitch-on-the-first-half-stroke-and-the-short-lower-pawl-pulls-it-left-one-pitch-on-the-second-half-stroke-after-finite-pickup; the-returning-pawl-lifts-clear-over-the-ratchet-crests';
  root.userData.movement = movement;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason:
      'The official Movement 271 page labels the animation unavailable and has no ae.add_model or mm_present registration; direction and pawl sequence were inferred from the engraving and description.',
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
        approximateToothCount: 22,
        barBottomY: 296,
        barLeftX: 128,
        pitchPixels: 10.5,
        rootY: 290,
        tipY: 284,
      },
      rasterTable: {
        bottomY: 342,
        groundY: 377,
        leftX: 135,
        legs: [{ left: 147, right: 190 }, { left: 318, right: 360 }],
        rightX: 413,
      },
      rasterLeftPulley: { center: { x: 38, y: 319 }, hubRadius: 8, radius: 26 },
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
    demonstrationPeriod: loopPeriod,
    driveDuration,
    driveVibrations,
    returnDuration,
    returnLeverForward,
    returnStartTime,
    sourceCyclePhase,
    vibrationPeriod: demonstrationPeriod,
  };
  root.userData.transmission = {
    advancePerHalfStroke: rackPitch,
    advancePerLeverVibration: 2 * rackPitch,
    driveSequence: [
      'long-upper-pawl-pulls-left',
      'short-lower-pawl-pulls-left',
    ],
    dwellIntervalsPerCycle: 2,
    instantaneousHandoffsPerCycle: 0,
    releaseEventsPerCycle: 2,
    pickupEventsPerCycle: 2,
    liftEnvelope,
    liftEnvelopeDerivative,
    liftEnvelopeSecondDerivative,
    outputDirection: 'leftward-unidirectional',
    demonstrationReturnPitches: 2 * driveVibrations,
    toothPitchesPerLeverVibration: 2,
  };

  finishRatchetBarSupports(root);
  // Brown's cord runs from the bar's left end over a free pulley and hangs
  // down the left edge of the plate; the pulley's bearing is not drawn.
  const pulleyCenter = sourceToModel(new THREE.Vector2(38, 319));
  const pulleyRadius = 26 * sourceScale;
  const cordRadius = 0.035;
  const cordCenterRadius = pulleyRadius + cordRadius;
  const cordY = pulleyCenter.y + cordCenterRadius;
  const cordBottomY = -2.85;
  const barLeftX = sourceToModel(new THREE.Vector2(128, 0)).x;
  const pulleyMaterial = matte(PALETTE.brass, { metalness: 0.14, roughness: 0.56 });
  const cordMaterial = matte(PALETTE.belt, { metalness: 0.04, roughness: 0.72 });
  const leftPulley = new THREE.Group();
  leftPulley.position.set(pulleyCenter.x, pulleyCenter.y, 0.02);
  leftPulley.userData.axis = Z_AXIS.clone();
  leftPulley.userData.role = 'free-left-cord-pulley';
  const pulleyWheel = new THREE.Mesh(
    ring(0.075, pulleyRadius, -0.1, 0.1, 128),
    pulleyMaterial,
  );
  pulleyWheel.userData.role = 'left-pulley-wheel-with-hub-bore';
  const pulleyHub = new THREE.Mesh(
    ring(0.075, 8 * sourceScale, 0.1, 0.13, 64),
    matte(PALETTE.ink, { metalness: 0.2, roughness: 0.5 }),
  );
  pulleyHub.userData.role = 'left-pulley-hub-face';
  leftPulley.add(pulleyWheel, pulleyHub);
  const pulleyAxle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.4, 32).rotateX(Math.PI / 2),
    matte(PALETTE.ink, { metalness: 0.25, roughness: 0.46 }),
  );
  pulleyAxle.position.set(pulleyCenter.x, pulleyCenter.y, 0.02);
  pulleyAxle.userData.role = 'fixed-left-pulley-axle';
  // Brown hatches the cord as laid rope. One continuous laid rope runs from
  // the bar's end over the pulley and down to a hanging weight that keeps it
  // taut; the weight hangs just below Brown's crop at the plate's bottom edge
  // and lowers by the bar's travel as the bar is drawn toward the pulley.
  const weightHookStartY = cordBottomY - 0.1;
  const ropeLength0 = (barLeftX - pulleyCenter.x) + Math.PI / 2 * cordCenterRadius
    + (pulleyCenter.y - weightHookStartY);
  const cordPath = (displacement) => {
    const barEnd = barLeftX + displacement;
    const spanLength = barEnd - pulleyCenter.x;
    const dropBottom = pulleyCenter.y
      - (ropeLength0 - spanLength - Math.PI / 2 * cordCenterRadius);
    const path = new THREE.CurvePath();
    path.add(new THREE.LineCurve3(
      new THREE.Vector3(barEnd, cordY, 0.02),
      new THREE.Vector3(pulleyCenter.x, cordY, 0.02)));
    const arc = new THREE.Curve();
    arc.getPoint = (t, target = new THREE.Vector3()) => {
      const angle = Math.PI / 2 + t * Math.PI / 2;
      return target.set(pulleyCenter.x + cordCenterRadius * Math.cos(angle),
        pulleyCenter.y + cordCenterRadius * Math.sin(angle), 0.02);
    };
    path.add(arc);
    path.add(new THREE.LineCurve3(
      new THREE.Vector3(pulleyCenter.x - cordCenterRadius, pulleyCenter.y, 0.02),
      new THREE.Vector3(pulleyCenter.x - cordCenterRadius, dropBottom, 0.02)));
    return {path, dropBottom};
  };
  const cordSpan = makeLaidRopeMesh(cordPath(0).path, cordMaterial, {radius: cordRadius});
  cordSpan.userData.role = 'laid-cord-from-bar-end-over-pulley-to-hanging-weight';
  const hangingWeight = new THREE.Group();
  hangingWeight.userData.role = 'hanging-weight-keeping-the-cord-taut';
  const weightBody = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.46, 40),
    matte(PALETTE.ink, { metalness: 0.25, roughness: 0.46 }));
  weightBody.position.y = -0.42;
  weightBody.userData.role = 'cast-iron-hanging-weight';
  const weightEye = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 10, 28),
    weightBody.material);
  weightEye.position.y = -0.078 - 0.002;
  weightEye.userData.role = 'eye-of-hanging-weight-tied-to-cord';
  const weightShank = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 12),
    weightBody.material);
  weightShank.position.y = -0.2;
  weightShank.userData.role = 'shank-of-hanging-weight';
  hangingWeight.add(weightBody, weightEye, weightShank);
  hangingWeight.position.set(pulleyCenter.x - cordCenterRadius, weightHookStartY, 0.02);
  // A plain strap bolted to the table's end carries the pulley's axle
  // behind the wheel.
  pulleyAxle.geometry.dispose();
  pulleyAxle.geometry = new THREE.CylinderGeometry(0.07, 0.07, 0.52, 32).rotateX(Math.PI / 2);
  pulleyAxle.position.z = -0.04;
  const tableEndX = -5.346;
  const pulleyStrap = new THREE.Mesh(
    new THREE.BoxGeometry(tableEndX - pulleyCenter.x + 0.14, 0.2, 0.1),
    matte(PALETTE.frame, { metalness: 0.13, roughness: 0.68 }));
  pulleyStrap.position.set((tableEndX + pulleyCenter.x - 0.14) / 2, pulleyCenter.y, -0.25);
  pulleyStrap.userData.role = 'strap-from-table-end-carrying-pulley-axle';
  root.add(hangingWeight, pulleyStrap);
  // Frame the weight at the cord's end through the bar's whole travel.
  root.userData.cameraFitBounds.min.y = weightHookStartY - 0.76 - 0.7;
  root.userData.cameraFitBounds.min.x = Math.min(root.userData.cameraFitBounds.min.x,
    pulleyCenter.x - cordCenterRadius - 0.26);
  root.add(leftPulley, pulleyAxle, cordSpan);
  Object.assign(root.userData.blocks, {
    cordSpan,
    hangingWeight,
    pulleyStrap,
    leftPulley,
    pulleyAxle,
  });
  Object.assign(root.userData.geometry, {
    barLeftX,
    cordCenterRadius,
    pulleyCenter,
    pulleyRadius,
  });
  // Brown draws no contact dots; the markers only keep their positions.
  const update = (time) => {
    const state = stateAtTime(time);
    rack.position.x = state.renderedBarDisplacement;
    const cord = cordPath(state.renderedBarDisplacement);
    cordSpan.userData.setCurve(cord.path, 0);
    hangingWeight.position.y = cord.dropBottom;
    leftPulley.rotation.z = -state.renderedBarDisplacement / cordCenterRadius;
    leverRotor.rotation.z = state.leverAngle;
    longPawl.position.x = state.longAnchor.x;
    longPawl.position.y = state.longAnchor.y;
    longPawl.rotation.z = state.longPawlAngle;
    shortPawl.position.x = state.shortAnchor.x;
    shortPawl.position.y = state.shortAnchor.y;
    shortPawl.rotation.z = state.shortPawlAngle;
    longContactMarker.visible = false;
    shortContactMarker.visible = false;
    longContactMarker.position.x = state.longTip.x - noseRadius;
    longContactMarker.position.y = state.longTip.y;
    shortContactMarker.position.x = state.shortTip.x - noseRadius;
    shortContactMarker.position.y = state.shortTip.y;
    rack.userData.velocity = new THREE.Vector3(state.barSpeed, 0, 0);
    lever.userData.angularSpeed = state.leverAngularSpeed;
    longPawl.userData.angularSpeed = state.longPawlAngularSpeed;
    shortPawl.userData.angularSpeed = state.shortPawlAngularSpeed;
    root.userData.contacts = {
      activePawlToRatchetBar: {
        contactError: state.activePawlContactError,
        drivingContactCount: state.drivingContactCount,
        faceIndex: state.activeFaceIndex,
        pawl: state.activePawl,
        point: state.activeContactPoint?.clone() ?? null,
        simultaneousDriving: false,
        normalOnRack: new THREE.Vector3(-1, 0, 0),
        finiteAxialOverlap: 0.2,
      },
      longPawlToRatchetBar: {
        toeCenterHeightAboveCrest: state.longTip.y - toothTipY,
        engaged: state.longDriving && state.engaged,
        mode: state.demonstrationReturn ? 'lifted-for-demonstration-return' : state.longDriving ? (state.engaged ? 'pulling-left' : 'taking-up-pickup-clearance') : 'prescribed-return-over-crests',
      },
      shortPawlToRatchetBar: {
        toeCenterHeightAboveCrest: state.shortTip.y - toothTipY,
        engaged: state.shortDriving && state.engaged,
        mode: state.demonstrationReturn ? 'lifted-for-demonstration-return' : state.shortDriving ? (state.engaged ? 'pulling-left' : 'taking-up-pickup-clearance') : 'prescribed-return-over-crests',
      },
    };
    root.userData.kinematics = state;
  };
  root.userData.minimumDisplayCycleSeconds = loopPeriod;
  root.userData.hideGround = true;
  root.traverse(object => {
    for (const material of [].concat(object.material ?? [])) material.fog = false;
  });
  root.userData.reconstructionNote = 'Finite stepped hooks engage the rack faces below the crests. Each lever half-stroke includes 0.05 of pickup travel before one tooth-pitch advance; the returning hook follows a prescribed smooth lift and drop. After two vibrations both hooks lift and the bar slides back four pitches in view (a prescribed demonstration reset, not a wrap). The unloaded bar is held during pickup; gravity, pawl bias, friction and inertial coast are not solved. No official animation is registered.';
  update(0);
  markShadows(root);
  // The pawls and lever stand in front of the table; their cast shadows
  // drew a dark wedge across its face that the plate does not have.
  for (const part of [longPawl, shortPawl, lever]) {
    part.traverse((object) => { object.castShadow = false; });
  }
  return {
    root,
    update,
    // Plate 271 is a flat side elevation.
    cameraDirection: new THREE.Vector3(0, 0, 1),
  };
}

export function createAuthoredRatchetBarMovement(movement) {
  if (movement.id !== 271) return null;
  const result = alternatingPawlRatchetBar(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
