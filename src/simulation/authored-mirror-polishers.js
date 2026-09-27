import { correctMirrorPolisher } from './polishing-joint-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongZ(radius, length, material, segments = 28) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function makeRatchetWheel({
  depth,
  material,
  outerRadius,
  rootRadius,
  toothCount,
  z,
}) {
  const shape = new THREE.Shape();
  const pitch = FULL_TURN / toothCount;
  let first = true;
  for (let tooth = 0; tooth < toothCount; tooth += 1) {
    for (const sample of [
      { offset: -0.50, radius: rootRadius },
      { offset: -0.38, radius: outerRadius },
      { offset: 0.34, radius: outerRadius * 0.91 },
      { offset: 0.50, radius: rootRadius },
    ]) {
      const angle = tooth * pitch + sample.offset * pitch;
      const x = sample.radius * Math.cos(angle);
      const y = sample.radius * Math.sin(angle);
      if (first) {
        shape.moveTo(x, y);
        first = false;
      } else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.016,
    bevelThickness: 0.016,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  const wheel = new THREE.Mesh(geometry, material);
  wheel.position.z = z;
  wheel.userData.outerRadius = outerRadius;
  wheel.userData.role =
    'ratchet-wheel-rigidly-secured-to-square-mirror';
  wheel.userData.rootRadius = rootRadius;
  wheel.userData.toothCount = toothCount;
  wheel.userData.toothPitch = pitch;
  return wheel;
}

function makeTelescopingFollower({ darkMaterial, followerMaterial }) {
  const group = new THREE.Group();
  const outer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.043, 0.043, 1, 12),
    darkMaterial,
  );
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.029, 0.029, 1, 12),
    followerMaterial,
  );
  const upperJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.070, 18, 12),
    followerMaterial,
  );
  const lowerJoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.062, 18, 12),
    followerMaterial,
  );
  group.add(outer, inner, upperJoint, lowerJoint);
  const setSegment = (mesh, start, end) => {
    const direction = end.clone().sub(start);
    const length = direction.length();
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.scale.set(1, length, 1);
    mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
  };
  group.userData.setEndpoints = (upper, lower) => {
    const midpoint = upper.clone().lerp(lower, 0.57);
    setSegment(outer, upper, midpoint.clone().lerp(lower, 0.10));
    setSegment(inner, midpoint.clone().lerp(upper, 0.08), lower);
    upperJoint.position.copy(upper);
    lowerJoint.position.copy(lower);
    group.userData.currentLength = upper.distanceTo(lower);
    group.userData.lowerEndpoint = lower.clone();
    group.userData.upperEndpoint = upper.clone();
  };
  group.userData.inner = inner;
  group.userData.lowerJoint = lowerJoint;
  group.userData.outer = outer;
  group.userData.role =
    'sliding-follower-transmitting-crankshaft-eccentric-to-click-carrier';
  group.userData.upperJoint = upperJoint;
  return markShadows(group);
}

function mirrorPolishingCompoundMotion(movement) {
  const root = new THREE.Group();

  const inputCyclePeriod = 5;
  const inputAngularSpeed = FULL_TURN / inputCyclePeriod;
  const inputStartAngle = THREE.MathUtils.degToRad(110);
  // The whole crank side stands in front of the bar: the shaft ends at the
  // eye crank in front of the bar face, so the bar can sweep past the shaft
  // axis. Front to back: handle crank, upper rail, eccentric, eye crank, bar;
  // the lower rail lies behind the bar, as Brown draws both rails, and the
  // click carrier, ratchet and mirror lie behind the lower rail, so Brown's
  // mirror and ratchet stand behind the bar and pass behind the rail and its
  // pins at the bottom of each stroke. The mirror sits 2.85 below the top
  // eye (Brown: about 3.6 crank radii, here 4.0) so that its axle, which
  // crosses the rail's depth, always stays above the rail; Brown's own
  // proportions would carry it through the rail.
  const crankPlaneZ = 0;
  const barPlaneZ = 0.10;
  const crankCenter = new THREE.Vector3(0, 2.32, 0);
  const crankRadius = 0.72;
  const handleRadius = 0.88;
  const guidePoint = new THREE.Vector3(0, -1.58, barPlaneZ);
  const guidePinOffset = 0.43;
  const guidePinRadius = 0.09;
  const longBarWidth = 0.58;
  const longBarLength = 5.38;
  const mirrorDistanceFromTopEye = 2.85;
  const mirrorSize = 1.10;
  const mirrorThickness = 0.08;
  const ratchetToothCount = 12;
  const ratchetToothPitch = FULL_TURN / ratchetToothCount;
  // Brown's ratchet spans about 0.83 of the mirror's side.
  const ratchetOuterRadius = 0.52;
  const ratchetRootRadius = 0.44;
  // Brown's click hooks the ratchet's upper-left teeth and draws them
  // upward: the wheel turns clockwise in the plate (clickHand -1, angles
  // counterclockwise positive), its tooth tips pointing counterclockwise.
  const clickHand = -1;
  // The carrier swings 160 -> 130 degrees, so its pivot (where the eccentric
  // rod's click stem passes the bar's plane) always stays beside the bar.
  const carrierBaseAngle = THREE.MathUtils.degToRad(160);
  const carrierPivotRadius = 0.68;
  const pawlContactRadius = ratchetOuterRadius;
  const pawlMaximumLift = 0.105;
  const eccentricity = 0.18;
  const mirrorRotorZ = -0.60;
  // World depths: the ratchet/click plane behind the lower rail (rail back
  // face at z -0.21); the carrier-pivot follower joint and the shaft
  // eccentric in front of the bar (face at z 0.18).
  const clickPlaneZ = -0.37;
  const followerLowerZ = 0.56;
  const eccentricPlaneZ = 0.43;

  const inputCycleAtTime = (time) => {
    const turns = time / inputCyclePeriod;
    let cycleIndex = Math.floor(turns);
    let phase = turns - cycleIndex;
    if (Math.abs(phase) < 1e-12) phase = 0;
    if (Math.abs(phase - 1) < 1e-12) {
      cycleIndex += 1;
      phase = 0;
    }
    if (phase < 0) {
      phase += 1;
      cycleIndex -= 1;
    }
    return { cycleIndex, phase };
  };

  const stateAtTime = (time) => {
    const { cycleIndex, phase } = inputCycleAtTime(time);
    const phaseAngle = FULL_TURN * phase;
    const sine = phase === 0 || phase === 0.5
      ? 0
      : Math.sin(phaseAngle);
    const cosine = phase === 0
      ? 1
      : phase === 0.5 ? -1 : Math.cos(phaseAngle);
    const unwrappedTurns = cycleIndex + phase;
    const inputAngle = inputStartAngle + FULL_TURN * unwrappedTurns;
    const inputPoseAngle = inputStartAngle + phaseAngle;
    const crankPin = crankCenter.clone().add(new THREE.Vector3(
      crankRadius * Math.cos(inputPoseAngle),
      crankRadius * Math.sin(inputPoseAngle),
      barPlaneZ,
    ));
    const crankPinVelocity = new THREE.Vector3(
      -crankRadius * inputAngularSpeed * Math.sin(inputPoseAngle),
      crankRadius * inputAngularSpeed * Math.cos(inputPoseAngle),
      0,
    );
    const guideToEye = crankPin.clone().sub(guidePoint);
    guideToEye.z = 0;
    const guideCoordinateFromTopEye = guideToEye.length();
    const barUpDirection = guideToEye.clone()
      .divideScalar(guideCoordinateFromTopEye);
    const barLocalXDirection = new THREE.Vector3(
      barUpDirection.y,
      -barUpDirection.x,
      0,
    );
    const barWorldAngle = Math.atan2(
      -barUpDirection.x,
      barUpDirection.y,
    );
    const barLongitudinalSpeed = barUpDirection.dot(crankPinVelocity);
    const guideSideClearance = guidePinOffset
      * Math.abs(barUpDirection.y)
      - longBarWidth / 2
      - guidePinRadius;
    const barAngularSpeed = (
      guideToEye.x * crankPinVelocity.y
        - guideToEye.y * crankPinVelocity.x
    ) / guideCoordinateFromTopEye ** 2;
    const barDirectionVelocity = crankPinVelocity.clone()
      .addScaledVector(barUpDirection, -barLongitudinalSpeed)
      .divideScalar(guideCoordinateFromTopEye);
    const mirrorCenter = crankPin.clone().addScaledVector(
      barUpDirection,
      -mirrorDistanceFromTopEye,
    );
    mirrorCenter.z = barPlaneZ + mirrorRotorZ;
    const mirrorCenterVelocity = crankPinVelocity.clone().addScaledVector(
      barDirectionVelocity,
      -mirrorDistanceFromTopEye,
    );

    const carrierFraction = 0.5 * (1 - cosine);
    const carrierFractionRate = 0.5 * sine * inputAngularSpeed;
    const carrierAngle = carrierBaseAngle
      + clickHand * ratchetToothPitch * carrierFraction;
    const carrierAngularSpeed = clickHand * ratchetToothPitch
      * carrierFractionRate;
    const drivingStroke = phase <= 0.5;
    const stepFraction = drivingStroke ? carrierFraction : 1;
    const stepFractionRate = drivingStroke ? carrierFractionRate : 0;
    const ratchetAngle = clickHand * (cycleIndex * ratchetToothPitch
      + ratchetToothPitch * stepFraction);
    const ratchetAngularSpeed = clickHand * ratchetToothPitch
      * stepFractionRate;
    const pawlLift = drivingStroke
      ? 0
      : pawlMaximumLift * sine ** 2;
    const pawlLiftRate = drivingStroke
      ? 0
      : pawlMaximumLift * 2 * sine * cosine * inputAngularSpeed;
    const engagedToothIndex = positiveModulo(
      -cycleIndex,
      ratchetToothCount,
    );
    const selectedToothIndex = drivingStroke
      ? engagedToothIndex
      : positiveModulo(Math.round(
        (carrierAngle - carrierBaseAngle - ratchetAngle)
          / (clickHand * ratchetToothPitch),
      ), ratchetToothCount);
    const pawlTipRadius = pawlContactRadius + pawlLift;
    const pawlTipLocal = new THREE.Vector3(
      pawlTipRadius * Math.cos(carrierAngle),
      -mirrorDistanceFromTopEye
        + pawlTipRadius * Math.sin(carrierAngle),
      clickPlaneZ,
    );
    const carrierPivotLocal = new THREE.Vector3(
      carrierPivotRadius * Math.cos(carrierAngle),
      -mirrorDistanceFromTopEye
        + carrierPivotRadius * Math.sin(carrierAngle),
      followerLowerZ,
    );
    const toWorldFromBar = (localPoint) => (
      crankPin.clone()
        .addScaledVector(barLocalXDirection, localPoint.x)
        .addScaledVector(barUpDirection, localPoint.y)
        .setZ(localPoint.z)
    );
    const pawlTipWorld = toWorldFromBar(pawlTipLocal);
    const carrierPivotWorld = toWorldFromBar(carrierPivotLocal);
    const selectedToothAngle = drivingStroke
      ? carrierAngle
      : positiveModulo(
        ratchetAngle
          + clickHand * selectedToothIndex * ratchetToothPitch
          + carrierBaseAngle,
        FULL_TURN,
      );
    const selectedToothLocal = new THREE.Vector3(
      pawlContactRadius * Math.cos(selectedToothAngle),
      -mirrorDistanceFromTopEye
        + pawlContactRadius * Math.sin(selectedToothAngle),
      clickPlaneZ,
    );
    const selectedToothWorld = toWorldFromBar(selectedToothLocal);
    const eccentricCenter = crankCenter.clone().add(new THREE.Vector3(
      eccentricity * Math.cos(inputPoseAngle),
      eccentricity * Math.sin(inputPoseAngle),
      eccentricPlaneZ,
    ));
    const mirrorWorldAngle = barWorldAngle + ratchetAngle;
    const mirrorWorldAngularSpeed = barAngularSpeed + ratchetAngularSpeed;
    const mirrorIndexPoint = mirrorCenter.clone()
      .add(new THREE.Vector3(
        mirrorSize * 0.34 * Math.cos(mirrorWorldAngle),
        mirrorSize * 0.34 * Math.sin(mirrorWorldAngle),
        0,
      ))
      .setZ(barPlaneZ + mirrorRotorZ + 0.39);
    return {
      barAngularSpeed,
      barLocalXDirection,
      barLongitudinalSpeed,
      barUpDirection,
      barWorldAngle,
      carrierAngle,
      carrierAngularSpeed,
      carrierFraction,
      carrierPivotWorld,
      crankPin,
      crankPinVelocity,
      cycleIndex,
      eccentricCenter,
      engagedToothIndex,
      guideCoordinateFromTopEye,
      guideSideClearance,
      inputAngle,
      inputAngularSpeed,
      inputPoseAngle,
      mirrorCenter,
      mirrorCenterVelocity,
      mirrorIndexPoint,
      mirrorWorldAngle,
      mirrorWorldAngularSpeed,
      pawlLift,
      pawlLiftRate,
      pawlTipWorld,
      phase,
      ratchetAngle,
      ratchetAngularSpeed,
      selectedToothWorld,
      selectedToothIndex,
      stage: drivingStroke
        ? 'eccentric-driven-click-advancing-ratchet-one-tooth'
        : 'click-overrunning-back-across-stationary-ratchet',
      stepFraction,
      stepFractionRate,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.17,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.27,
    roughness: 0.46,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.56,
  });
  const barMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const ratchetMaterial = matte(PALETTE.accent, {
    metalness: 0.27,
    roughness: 0.45,
  });
  const mirrorMaterial = matte(PALETTE.white, {
    metalness: 0.36,
    roughness: 0.24,
  });
  const followerMaterial = matte(PALETTE.muted, {
    metalness: 0.19,
    roughness: 0.55,
  });

  const upperRail = new THREE.Mesh(
    new THREE.BoxGeometry(4.40, 0.35, 0.42),
    frameMaterial,
  );
  upperRail.position.set(0, crankCenter.y, -0.21);
  upperRail.userData.fixed = true;
  upperRail.userData.role = 'fixed-upper-rail-carrying-crankshaft-bearing';
  root.add(upperRail);
  const lowerRail = new THREE.Mesh(
    new THREE.BoxGeometry(4.75, 0.34, 0.20),
    frameMaterial,
  );
  lowerRail.position.set(0, guidePoint.y, -0.11);
  lowerRail.userData.fixed = true;
  lowerRail.userData.role = 'fixed-lower-rail-carrying-bar-guide-pins';
  root.add(lowerRail);

  const crankBearing = cylinderAlongZ(0.19, 0.58, frameMaterial, 32);
  crankBearing.position.copy(crankCenter).setZ(-0.01);
  crankBearing.userData.fixed = true;
  crankBearing.userData.role = 'fixed-crankshaft-bearing-in-upper-rail';
  root.add(crankBearing);

  const guidePins = [-1, 1].map((side) => {
    // The pins stand from the lower rail forward through the bar's depth;
    // the mirror and ratchet pass behind the rail.
    const pin = cylinderAlongZ(guidePinRadius, 0.35, darkMaterial, 28);
    pin.position.set(
      guidePoint.x + side * guidePinOffset,
      guidePoint.y,
      0.025,
    );
    pin.userData.fixed = true;
    pin.userData.role = 'one-of-two-fixed-lower-rail-bar-guide-pins';
    root.add(pin);
    return pin;
  });
  const railFasteners = [-1.92, 1.92].map((x) => {
    const fastener = cylinderAlongZ(0.075, 0.24, darkMaterial, 24);
    fastener.position.set(x, guidePoint.y, -0.11);
    fastener.userData.fixed = true;
    fastener.userData.role = 'lower-rail-fastener';
    root.add(fastener);
    return fastener;
  });

  const inputRotor = new THREE.Group();
  inputRotor.position.copy(crankCenter).setZ(crankPlaneZ);
  inputRotor.userData.axis = Z_AXIS.clone();
  inputRotor.userData.role =
    'hand-crank-and-eccentric-common-input-shaft-rotor';
  root.add(inputRotor);
  const eyeArm = new THREE.Mesh(
    new THREE.BoxGeometry(crankRadius, 0.13, 0.18),
    driverMaterial,
  );
  eyeArm.position.x = crankRadius / 2;
  eyeArm.userData.role = 'crank-arm-to-long-bar-upper-eye';
  inputRotor.add(eyeArm);
  const handleArm = new THREE.Mesh(
    new THREE.BoxGeometry(handleRadius, 0.13, 0.18),
    driverMaterial,
  );
  handleArm.position.x = -handleRadius / 2;
  handleArm.userData.role = 'opposite-hand-handle-crank-arm';
  inputRotor.add(handleArm);
  const crankPinBoss = cylinderAlongZ(0.12, 0.33, darkMaterial, 28);
  crankPinBoss.position.x = crankRadius;
  crankPinBoss.userData.role = 'crankpin-through-long-bar-upper-eye';
  inputRotor.add(crankPinBoss);
  const handle = cylinderAlongZ(0.095, 0.48, darkMaterial, 28);
  handle.position.set(-handleRadius, 0, 0.18);
  handle.userData.role = 'free-turning-hand-handle';
  inputRotor.add(handle);
  const handleKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 20, 14),
    driverMaterial,
  );
  handleKnob.position.set(-handleRadius, 0, 0.44);
  handleKnob.userData.role = 'hand-handle-end-knob';
  inputRotor.add(handleKnob);
  const eccentricDisk = cylinderAlongZ(0.25, 0.12, driverMaterial, 36);
  eccentricDisk.position.set(eccentricity, 0, 0.31);
  eccentricDisk.userData.role =
    'off-center-disk-eccentric-on-common-crankshaft';
  inputRotor.add(eccentricDisk);
  const shaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.045, 0.035),
    mirrorMaterial,
  );
  shaftIndex.position.set(0.22, 0, 0.40);
  shaftIndex.userData.role = 'white-crankshaft-angle-index';
  inputRotor.add(shaftIndex);

  const longBar = new THREE.Group();
  longBar.userData.role =
    'long-bar-with-longitudinal-and-oscillating-motion';
  root.add(longBar);
  const barBody = new THREE.Mesh(
    new THREE.BoxGeometry(
      longBarWidth,
      longBarLength,
      0.20,
    ),
    barMaterial,
  );
  barBody.position.y = -longBarLength / 2;
  barBody.userData.role = 'rigid-long-sliding-oscillating-bar-body';
  longBar.add(barBody);
  const upperEye = cylinderAlongZ(0.18, 0.30, barMaterial, 32);
  upperEye.userData.role = 'upper-eye-pinned-to-crankpin';
  longBar.add(upperEye);
  const upperEyeBore = cylinderAlongZ(0.080, 0.34, darkMaterial, 28);
  upperEyeBore.userData.role = 'visible-upper-eye-bore';
  longBar.add(upperEyeBore);

  const mirrorRotor = new THREE.Group();
  mirrorRotor.position.set(0, -mirrorDistanceFromTopEye, mirrorRotorZ);
  mirrorRotor.userData.axis = Z_AXIS.clone();
  mirrorRotor.userData.role =
    'mirror-and-ratchet-rigid-common-output-rotor';
  longBar.add(mirrorRotor);
  const mirrorBacking = new THREE.Mesh(
    new THREE.BoxGeometry(
      mirrorSize + 0.10,
      mirrorSize + 0.10,
      mirrorThickness + 0.07,
    ),
    barMaterial,
  );
  mirrorBacking.position.z = 0.22;
  mirrorBacking.userData.role = 'square-mirror-backing-rigid-to-ratchet';
  mirrorRotor.add(mirrorBacking);
  const mirrorFace = new THREE.Mesh(
    new THREE.BoxGeometry(mirrorSize, mirrorSize, mirrorThickness),
    mirrorMaterial,
  );
  mirrorFace.position.z = 0.32;
  mirrorFace.userData.role = 'square-polishing-mirror-face';
  mirrorRotor.add(mirrorFace);
  const ratchetWheel = makeRatchetWheel({
    depth: 0.34,
    material: ratchetMaterial,
    outerRadius: ratchetOuterRadius,
    rootRadius: ratchetRootRadius,
    toothCount: ratchetToothCount,
    z: 0.07,
  });
  ratchetWheel.rotation.z = carrierBaseAngle
    + ratchetToothPitch * 0.38;
  mirrorRotor.add(ratchetWheel);
  const mirrorAxle = cylinderAlongZ(0.105, 0.52, darkMaterial, 30);
  mirrorAxle.position.z = 0.02;
  mirrorAxle.userData.role = 'mirror-ratchet-axle-carried-by-long-bar';
  mirrorRotor.add(mirrorAxle);
  const mirrorIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.055, 0.035),
    barMaterial,
  );
  mirrorIndex.position.set(mirrorSize * 0.34, 0, 0.39);
  mirrorIndex.userData.role =
    'asymmetric-index-showing-intermittent-mirror-rotation';
  mirrorRotor.add(mirrorIndex);

  const clickCarrier = new THREE.Group();
  clickCarrier.position.set(0, -mirrorDistanceFromTopEye, 0.53);
  clickCarrier.userData.axis = Z_AXIS.clone();
  clickCarrier.userData.role =
    'eccentric-oscillated-click-carrier-about-ratchet-axis';
  longBar.add(clickCarrier);
  const carrierArm = new THREE.Mesh(
    new THREE.BoxGeometry(carrierPivotRadius, 0.085, 0.09),
    followerMaterial,
  );
  carrierArm.position.x = carrierPivotRadius / 2;
  carrierArm.userData.role = 'oscillating-click-carrier-arm';
  clickCarrier.add(carrierArm);
  const carrierPivot = cylinderAlongZ(0.090, 0.18, darkMaterial, 24);
  carrierPivot.position.x = carrierPivotRadius;
  carrierPivot.userData.role = 'click-pivot-on-oscillating-carrier';
  clickCarrier.add(carrierPivot);
  const pawlSlide = new THREE.Group();
  pawlSlide.userData.role = 'radially-lifting-overrunning-click';
  clickCarrier.add(pawlSlide);
  const pawlLength = carrierPivotRadius - pawlContactRadius;
  const pawlBody = new THREE.Mesh(
    new THREE.BoxGeometry(pawlLength, 0.10, 0.10),
    ratchetMaterial,
  );
  pawlBody.position.x = (carrierPivotRadius + pawlContactRadius) / 2;
  pawlBody.userData.role = 'spring-biased-ratchet-click-body';
  pawlSlide.add(pawlBody);
  const pawlTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.085, 0.18, 3),
    ratchetMaterial,
  );
  pawlTip.rotation.z = Math.PI / 2;
  pawlTip.position.x = pawlContactRadius + 0.09;
  pawlTip.userData.role = 'click-tip-engaging-one-ratchet-tooth';
  pawlSlide.add(pawlTip);
  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.040, 16, 12),
    mirrorMaterial,
  );
  contactMarker.position.x = pawlContactRadius;
  contactMarker.userData.role = 'visible-click-tooth-contact-marker';
  pawlSlide.add(contactMarker);

  const eccentricFollower = makeTelescopingFollower({
    darkMaterial,
    followerMaterial,
  });
  root.add(eccentricFollower);

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.inputAngle;
    longBar.position.copy(state.crankPin);
    longBar.quaternion.setFromUnitVectors(Y_AXIS, state.barUpDirection);
    mirrorRotor.rotation.z = state.ratchetAngle;
    clickCarrier.rotation.z = state.carrierAngle;
    pawlSlide.position.x = state.pawlLift;
    eccentricFollower.userData.setEndpoints(
      state.eccentricCenter,
      state.carrierPivotWorld,
    );
    root.userData.updatePolishingInterfaces?.(state);
    root.userData.currentState = state;
    root.userData.constraints = {
      clickContact: {
        clearance: state.pawlTipWorld.distanceTo(state.selectedToothWorld),
        engaged: state.phase <= 0.5,
        pawlPoint: state.pawlTipWorld.clone(),
        selectedToothIndex: state.selectedToothIndex,
        toothPoint: state.selectedToothWorld.clone(),
      },
      guide: {
        centerlineError: state.crankPin.clone()
          .addScaledVector(
            state.barUpDirection,
            -state.guideCoordinateFromTopEye,
          )
          .distanceTo(guidePoint),
        guideCoordinateFromTopEye: state.guideCoordinateFromTopEye,
        guidePoint: guidePoint.clone(),
        sideClearance: state.guideSideClearance,
      },
      mirror: {
        center: state.mirrorCenter.clone(),
        compoundAngularSpeed: state.mirrorWorldAngularSpeed,
        worldAngle: state.mirrorWorldAngle,
      },
      ratchet: {
        carrierAngle: state.carrierAngle,
        cumulativeAdvance: state.ratchetAngle,
        pawlLift: state.pawlLift,
        toothPitch: ratchetToothPitch,
      },
    };
  };

  root.userData = {
    archetype:
      'crank-guided-sliding-oscillating-bar-eccentric-click-mirror-ratchet',
    blocks: {
      barBody,
      carrierArm,
      carrierPivot,
      clickCarrier,
      contactMarker,
      crankBearing,
      crankPinBoss,
      eccentricDisk,
      eccentricFollower,
      guidePins,
      handle,
      handleArm,
      handleKnob,
      inputRotor,
      longBar,
      lowerRail,
      mirrorAxle,
      mirrorBacking,
      mirrorFace,
      mirrorIndex,
      mirrorRotor,
      pawlBody,
      pawlSlide,
      pawlTip,
      railFasteners,
      ratchetWheel,
      shaftIndex,
      upperEye,
      upperEyeBore,
      upperRail,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      input: 'continuous hand-crank angle',
      note:
        'the upper crankpin and lower loose pin guide determine bar slide and oscillation; the keyed eccentric phase determines click-carrier stroke and one-way ratchet indexing',
      storedEnergyStates: 0,
    },
    dynamics: {
      sourceSpecifiesDimensionsTimingClearanceOrPolishingLoad: false,
      treatment:
        'the ideal kinematic reconstruction omits polishing force and inertia; Brown gives topology but no dimensions, eccentric law, clearances, ratchet tooth count, or operating speed',
    },
    fidelity: 'authored',
    geometry: {
      barPlaneZ,
      carrierBaseAngle,
      carrierPivotRadius,
      clickHand,
      clickPlaneZ,
      crankCenter: crankCenter.clone(),
      crankPlaneZ,
      crankRadius,
      eccentricity,
      eccentricPlaneZ,
      followerLowerZ,
      guidePinOffset,
      guidePinRadius,
      guidePoint: guidePoint.clone(),
      handleRadius,
      inputAngularSpeed,
      inputCyclePeriod,
      inputStartAngle,
      longBarLength,
      longBarWidth,
      mirrorDistanceFromTopEye,
      mirrorRotorZ,
      mirrorSize,
      mirrorThickness,
      pawlContactRadius,
      pawlMaximumLift,
      ratchetOuterRadius,
      ratchetRootRadius,
      ratchetToothCount,
      ratchetToothPitch,
    },
    mechanism:
      'one-hand-crank-carries-the-long-bar-eye-around-a-fixed-shaft-the-lower-pin-guide-forces-simultaneous-bar-slide-and-oscillation-and-a-coaxial-eccentric-oscillates-a-click-that-indexes-the-bar-mounted-mirror-ratchet',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate370: {
        crankHandlePin: new THREE.Vector2(296, 235),
        crankShaftCenter: new THREE.Vector2(251, 136),
        imageHeight: 525,
        imageWidth: 525,
        leftGuidePin: new THREE.Vector2(247, 480),
        longBarTopEye: new THREE.Vector2(218, 51),
        measurementUncertaintyPixels: 9,
        mirrorRatchetCenter: new THREE.Vector2(274, 376),
        rightGuidePin: new THREE.Vector2(342, 473),
        upperRailLeft: new THREE.Vector2(39, 92),
        upperRailRight: new THREE.Vector2(397, 92),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'a handle turns the crank',
          'the long bar and attached ratchet wheel are connected to the crank',
          'the mirror is rigidly secured to the ratchet wheel',
          'pins in the lower rail guide the long bar',
          'the long bar has both longitudinal and oscillating movement',
          'a click operated by an eccentric on the crankshaft rotates the ratchet intermittently',
          'the resulting mirror motion is compound and varies the rubbing',
        ],
        engravingEvidence:
          'the plate shows the long-bar upper eye on one side of the upper fixed crank axis, the hand handle on the opposite crank arm, two lower-rail guide pins flanking the bar, a toothed wheel and square mirror centered on the bar, and dotted hidden click/eccentric outlines',
        reconstructionDisclosure:
          'dimensions, loose-guide clearance, twelve-tooth ratchet, harmonic eccentric follower law, telescoping follower representation, tooth engagement phase, and operating period are engineered because Brown supplies no numerical values and the official page has no canvas animation',
      },
      officialPage: 'https://507movements.com/mm_370.html',
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod: inputCyclePeriod,
      note:
        'each displayed crank turn makes one complete guided-bar orbit and advances the mirror by one ratchet tooth; cumulative indexing is intentionally unwrapped and continuous across crank-cycle boundaries',
    },
    transmission: {
      barConstraintLaw:
        'bar upper eye equals crank center plus crank radius at input angle; bar centerline is the line from the fixed lower-guide midpoint to that eye',
      barMotionLaw:
        'distance from upper eye to fixed guide is the longitudinal slide coordinate, while the direction of that line is the bar oscillation coordinate',
      clickCarrierLaw:
        'the shaft eccentric gives carrier fraction (1-cos(input phase))/2: the carrier advances one tooth pitch during the first half-turn and returns during the second',
      compoundMirrorLaw:
        'mirror center follows its fixed station on the sliding/oscillating bar, and mirror world angle equals bar angle plus cumulative ratchet angle',
      ratchetLaw:
        'the click drives the wheel with the carrier on the forward half-turn; on the return half-turn the wheel dwells while the click lifts and overruns',
    },
  };

  correctMirrorPolisher(root);
  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.48, -3.88, -0.55),
    new THREE.Vector3(2.48, 3.40, 1.65),
  );
  root.userData.groundFloorY = -2.17;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(.6, .8, 15),
    root,
    update,
  };
}

export function createAuthoredMirrorPolisherMovement(movement) {
  if (movement.id !== 370) return null;
  return mirrorPolishingCompoundMotion(movement);
}
