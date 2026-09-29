import { correctMirrorPolisher } from './polishing-joint-parts.js';
import { plate, poly, circle, polygonClipping } from './finite-plate-geometry.js';
import { buildMirrorSLink, makeSLinkSolver, simulateSLinkDrive } from './mirror-s-link-click.js';
import { makeSeeThrough } from './see-through-part.js';
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

function mirrorPolishingCompoundMotion(movement) {
  const root = new THREE.Group();

  const inputCyclePeriod = 5;
  // Brown marks no direction. The crank turns clockwise in the plate, so the
  // eccentric's strap comes down on the bar's right side while the S-link's
  // hook pushes the ratchet's left-hand teeth down (anticlockwise).
  const inputAngularSpeed = -FULL_TURN / inputCyclePeriod;
  const inputStartAngle = THREE.MathUtils.degToRad(110);
  // The crank side stands in front of the bar: the shaft ends at the eye
  // crank in front of the bar face, so the bar can sweep past the shaft
  // axis. Front to back: handle crank, upper rail, eye crank, bar; the lower
  // rail lies behind the bar, as Brown draws both rails. Behind the lower
  // rail, in one plane, lie the ratchet, the S-link and the eccentric that
  // drives it, and behind them the mirror, as Brown dashes the rod, ratchet
  // and mirror behind the bar. The mirror sits 2.85 below the top eye
  // (Brown: about 3.6 crank radii, here 4.0) so that its axle, which crosses
  // the rail's depth, always stays above the rail.
  const crankPlaneZ = 0;
  const barPlaneZ = 0.10;
  const crankCenter = new THREE.Vector3(0, 2.32, 0);
  const crankRadius = 0.72;
  const handleRadius = 0.88;
  const guidePoint = new THREE.Vector3(0, -1.58, barPlaneZ);
  const guidePinOffset = 0.43;
  const guidePinRadius = 0.09;
  const longBarWidth = 0.58;
  // Brown's bar ends at the lower rail's bottom edge near the top of the
  // stroke (his pose): 1.05 x the eye-to-rail distance there.
  const longBarLength = 4.82;
  const mirrorDistanceFromTopEye = 2.85;
  const mirrorSize = 1.10;
  const mirrorThickness = 0.08;
  const ratchetToothCount = 12;
  const ratchetToothPitch = FULL_TURN / ratchetToothCount;
  // Brown's ratchet spans about 0.83 of the mirror's side.
  const ratchetOuterRadius = 0.52;
  const ratchetRootRadius = 0.416;
  const ratchetRake = 0.06;
  // Brown's hook comes down the ratchet's left side from above and pushes
  // its teeth downward: the wheel turns anticlockwise (clickHand +1).
  const clickHand = 1;
  // The hook seats (mid-drive) in the root at 160 degrees, upper left.
  const clickRootAngle = THREE.MathUtils.degToRad(160);
  // Brown's rod rises behind the bar toward its top eye, not to the shaft:
  // an eccentric on the shaft itself would need the shaft to pierce the bar,
  // which sweeps right across the shaft's axis. The eccentric is keyed on
  // the crankpin's rear end, rigid with the crank, so relative to the bar
  // its centre circles the eye at the throw. At phase 0 (Brown's pose) the
  // strap stands at the top of its circle.
  const eccentricity = 0.15;
  const eccentricPhase = THREE.MathUtils.degToRad(-20);
  const eccentricDiscRadius = eccentricity + 0.12 + 0.05;
  const sLinkWidth = 0.10;
  const sLinkDepth = 0.12;
  const mirrorRotorZ = -0.54;
  // World depth of the ratchet / S-link / eccentric plane (behind the lower
  // rail, whose back face is at z -0.21).
  const clickPlaneZ = -0.31;
  const wheelCentre = [0, -mirrorDistanceFromTopEye];
  const eRef = [eccentricity, 0];
  const sLink = buildMirrorSLink({
    wheelCentre,
    radius: ratchetOuterRadius,
    rootRadius: ratchetRootRadius,
    teeth: ratchetToothCount,
    rake: ratchetRake,
    rootAngle: clickRootAngle,
    eRef,
    discRadius: eccentricDiscRadius,
    strapWidth: 0.065,
    width: sLinkWidth,
    stemLength: 0.16,
    crossingY: wheelCentre[1] + 0.76,
    bendRadius: 0.2,
  });
  const sLinkSolver = makeSLinkSolver(sLink, { wheelCentre, eRef });

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

  const barAtPose = (poseAngle) => {
    const crankPin = crankCenter.clone().add(new THREE.Vector3(
      crankRadius * Math.cos(poseAngle),
      crankRadius * Math.sin(poseAngle),
      barPlaneZ,
    ));
    const guideToEye = crankPin.clone().sub(guidePoint);
    guideToEye.z = 0;
    const length = guideToEye.length();
    const barUpDirection = guideToEye.clone().divideScalar(length);
    return {
      crankPin,
      guideToEye,
      guideCoordinateFromTopEye: length,
      barUpDirection,
      barWorldAngle: Math.atan2(-barUpDirection.x, barUpDirection.y),
    };
  };
  // The strap centre in the bar frame: the eccentric's centre is fixed in
  // the crank, at the throw from the crankpin.
  const strapCentreAt = (phase) => {
    const pose = inputStartAngle + FULL_TURN * phase * Math.sign(inputAngularSpeed);
    const a = pose + eccentricPhase - barAtPose(pose).barWorldAngle;
    return [eccentricity * Math.cos(a), eccentricity * Math.sin(a)];
  };
  // The rod is marched round three crank turns from a seated start; the
  // steady last turn is the playback table (w(phase + 1) = w(phase) + pitch).
  const driveSamples = 720;
  const driveTurns = 2;
  const driveRecord = simulateSLinkDrive(sLinkSolver, strapCentreAt, {
    samples: driveSamples,
    turns: driveTurns,
    rake: ratchetRake,
  });
  const driveBase = driveRecord[0].w - (driveTurns - 1) * ratchetToothPitch;
  const driveAt = (phase) => {
    const u = phase * driveSamples;
    const i = Math.min(driveSamples - 1, Math.floor(u));
    const t = u - i;
    const a = driveRecord[i], b = driveRecord[i + 1];
    return {
      beta: a.beta + (b.beta - a.beta) * t,
      w: a.w + (b.w - a.w) * t - driveRecord[0].w,
      wRate: (b.w - a.w) * driveSamples / inputCyclePeriod,
      engaged: t < 0.5 ? a.engaged : b.engaged,
    };
  };

  const stateAtTime = (time) => {
    const { cycleIndex, phase } = inputCycleAtTime(time);
    const phaseAngle = FULL_TURN * phase;
    const unwrappedTurns = cycleIndex + phase;
    const inputAngle = inputStartAngle
      + Math.sign(inputAngularSpeed) * FULL_TURN * unwrappedTurns;
    const inputPoseAngle = inputStartAngle
      + Math.sign(inputAngularSpeed) * phaseAngle;
    const {
      crankPin,
      guideToEye,
      guideCoordinateFromTopEye,
      barUpDirection,
      barWorldAngle,
    } = barAtPose(inputPoseAngle);
    const crankPinVelocity = new THREE.Vector3(
      -crankRadius * inputAngularSpeed * Math.sin(inputPoseAngle),
      crankRadius * inputAngularSpeed * Math.cos(inputPoseAngle),
      0,
    );
    const barLocalXDirection = new THREE.Vector3(
      barUpDirection.y,
      -barUpDirection.x,
      0,
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
    const drive = driveAt(phase);
    const ratchetAngle = clickHand
      * (driveBase + cycleIndex * ratchetToothPitch + drive.w);
    const ratchetAngularSpeed = drive.wRate;
    const strapCentre = strapCentreAt(phase);
    const toWorldFromBar = (x, y, z) => (
      crankPin.clone()
        .addScaledVector(barLocalXDirection, x)
        .addScaledVector(barUpDirection, y)
        .setZ(z)
    );
    const eccentricCenter = toWorldFromBar(strapCentre[0], strapCentre[1], clickPlaneZ);
    const noseLocal = sLinkSolver.nosePoint(strapCentre, drive.beta);
    const clickNoseWorld = toWorldFromBar(noseLocal[0], noseLocal[1], clickPlaneZ);
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
      clickEngaged: drive.engaged,
      clickNoseWorld,
      clickRotation: drive.beta,
      crankPin,
      crankPinVelocity,
      cycleIndex,
      eccentricCenter,
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
      phase,
      ratchetAngle,
      ratchetAngularSpeed,
      stage: drive.engaged
        ? 'eccentric-driven-click-advancing-ratchet-one-tooth'
        : 'click-overrunning-back-across-stationary-ratchet',
      strapCentre,
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
  const linkMaterial = matte(PALETTE.ink, { metalness: 0.24, roughness: 0.48 });

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
  // The crankpin runs from the eye crank back through the bar's eye to the
  // eccentric keyed on its rear end, stopping just inside the eccentric.
  const pinFront = 0.35;
  const pinBack = clickPlaneZ + sLinkDepth / 2 - 0.005;
  const crankPinBoss = cylinderAlongZ(0.12, pinFront - pinBack, darkMaterial, 32);
  crankPinBoss.position.set(crankRadius, 0, (pinFront + pinBack) / 2);
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
  // One solid round sheave keyed on the crankpin's rear end, centred at the
  // throw from the pin.
  const eccentricCentreInCrank = [
    crankRadius + eccentricity * Math.cos(eccentricPhase),
    eccentricity * Math.sin(eccentricPhase),
  ];
  const eccentricDisk = new THREE.Mesh(
    plate([[circle(eccentricCentreInCrank, eccentricDiscRadius, 128)]],
      clickPlaneZ - sLinkDepth / 2, clickPlaneZ + sLinkDepth / 2),
    driverMaterial,
  );
  eccentricDisk.userData.role =
    'eccentric-sheave-keyed-on-the-crankpin-rear-end';
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
  // The saw ratchet, bored for the axle, in the S-link's plane.
  const ratchetBore = 0.107;
  const ratchetDepth = 0.14;
  const ratchetWheel = new THREE.Mesh(
    plate(polygonClipping.difference(
      poly(sLink.wheel.outline),
      poly(circle([0, 0], ratchetBore, 96)),
    ), -ratchetDepth / 2, ratchetDepth / 2),
    ratchetMaterial,
  );
  ratchetWheel.position.z = clickPlaneZ - barPlaneZ - mirrorRotorZ;
  ratchetWheel.userData.role =
    'ratchet-wheel-rigidly-secured-to-square-mirror';
  ratchetWheel.userData.ratchetProfile = {
    outline: sLink.wheel.outline,
    radius: ratchetOuterRadius,
    bore: ratchetBore,
    teeth: ratchetToothCount,
    hand: clickHand,
    phase: sLink.wheel.phase,
    depth: ratchetDepth,
    rootRadius: ratchetRootRadius,
    rake: ratchetRake,
  };
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

  // Brown's S-shaped eccentric rod: strap, rod and hook are one plate in
  // the ratchet's plane, placed about its strap centre.
  const sLinkBody = new THREE.Mesh(
    plate(sLink.polygons.map((polygon) => polygon.map((ring) => ring.map(
      (p) => [p[0] - eRef[0], p[1] - eRef[1]],
    ))), -sLinkDepth / 2, sLinkDepth / 2),
    linkMaterial,
  );
  sLinkBody.position.z = clickPlaneZ - barPlaneZ;
  sLinkBody.userData.role = 'brown-s-shaped-eccentric-rod-and-click';
  longBar.add(sLinkBody);

  // Brown's dashed box on the bar: a loose keeper (a U-staple from the bar's
  // back) that the rod's straight run passes through. It holds the rod in
  // its plane and bounds its swing; it is sized from the rod's sweep below.
  const barBackLocal = -0.08;
  const rodSweep = (y) => {
    let low = Infinity, high = -Infinity;
    for (const { e, beta } of driveRecord) {
      // The rod's straight run: points (eRef.x, y') in the reference pose.
      for (const yRef of [y - 0.12, y, y + 0.12]) {
        const q = [0, yRef - eRef[1]];
        const x = e[0] + q[0] * Math.cos(beta) - q[1] * Math.sin(beta);
        low = Math.min(low, x); high = Math.max(high, x);
      }
    }
    return [low - sLinkWidth / 2, high + sLinkWidth / 2];
  };
  const keeperY = -1.62;
  const keeperHeight = 0.14;
  const [sweepLow, sweepHigh] = rodSweep(keeperY);
  const keeperGap = 0.02;
  const keeperWall = 0.05;
  const keeperInner = [sweepLow - keeperGap, sweepHigh + keeperGap];
  const rodBackLocal = clickPlaneZ - barPlaneZ - sLinkDepth / 2;
  // The U in the bar's (x, depth) section, extruded along the bar.
  const keeperDepthFront = barBackLocal + 0.005;
  const keeperDepthBack = rodBackLocal - keeperGap - keeperWall;
  const keeperShape = polygonClipping.difference(
    poly([
      [keeperInner[0] - keeperWall, -keeperDepthFront],
      [keeperInner[1] + keeperWall, -keeperDepthFront],
      [keeperInner[1] + keeperWall, -keeperDepthBack],
      [keeperInner[0] - keeperWall, -keeperDepthBack],
    ]),
    poly([
      [keeperInner[0], -keeperDepthFront - 0.01],
      [keeperInner[1], -keeperDepthFront - 0.01],
      [keeperInner[1], -(keeperDepthBack + keeperWall)],
      [keeperInner[0], -(keeperDepthBack + keeperWall)],
    ]),
  );
  const keeperGeometry = plate(keeperShape, -keeperHeight / 2, keeperHeight / 2);
  keeperGeometry.rotateX(-Math.PI / 2);
  const rodKeeper = new THREE.Mesh(keeperGeometry, frameMaterial);
  rodKeeper.position.y = keeperY;
  rodKeeper.userData.role = 'loose-rod-keeper-on-bar-back';
  longBar.add(rodKeeper);

  const update = (time) => {
    const state = stateAtTime(time);
    inputRotor.rotation.z = state.inputAngle;
    longBar.position.copy(state.crankPin);
    longBar.quaternion.setFromUnitVectors(Y_AXIS, state.barUpDirection);
    mirrorRotor.rotation.z = state.ratchetAngle;
    sLinkBody.position.x = state.strapCentre[0];
    sLinkBody.position.y = state.strapCentre[1];
    sLinkBody.rotation.z = state.clickRotation;
    root.userData.currentState = state;
    root.userData.constraints = {
      clickContact: {
        engaged: state.clickEngaged,
        noseWorld: state.clickNoseWorld.clone(),
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
        clickRotation: state.clickRotation,
        cumulativeAdvance: state.ratchetAngle,
        toothPitch: ratchetToothPitch,
      },
    };
  };

  root.userData = {
    archetype:
      'crank-guided-sliding-oscillating-bar-eccentric-click-mirror-ratchet',
    blocks: {
      barBody,
      crankBearing,
      crankPinBoss,
      eccentricDisk,
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
      railFasteners,
      ratchetWheel,
      rodKeeper,
      sLinkBody,
      shaftIndex,
      upperEye,
      upperEyeBore,
      upperRail,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      input: 'continuous hand-crank angle',
      note:
        'the upper crankpin and lower loose pin guide determine bar slide and oscillation; the eccentric keyed on the crankpin moves the S-link strap round the bar eye, and the hook, hanging against the teeth, drives the ratchet one tooth per turn',
      storedEnergyStates: 0,
    },
    driveTable: {
      record: driveRecord,
      samples: driveSamples,
      turns: driveTurns,
    },
    dynamics: {
      sourceSpecifiesDimensionsTimingClearanceOrPolishingLoad: false,
      treatment:
        'the kinematic reconstruction omits polishing force and inertia; the hook is taken to hang against the teeth under its own weight and the wheel to hold still (polishing friction) while the hook overruns; Brown gives topology but no dimensions, clearances, ratchet tooth count, or operating speed',
    },
    fidelity: 'authored',
    geometry: {
      barPlaneZ,
      clickHand,
      clickPlaneZ,
      clickRootAngle,
      crankCenter: crankCenter.clone(),
      crankPlaneZ,
      crankRadius,
      eccentricDiscRadius,
      eccentricity,
      eccentricPhase,
      guidePinOffset,
      guidePinRadius,
      guidePoint: guidePoint.clone(),
      handleRadius,
      inputAngularSpeed,
      inputCyclePeriod,
      inputStartAngle,
      keeperInner,
      keeperY,
      longBarLength,
      longBarWidth,
      mirrorDistanceFromTopEye,
      mirrorRotorZ,
      mirrorSize,
      mirrorThickness,
      ratchetOuterRadius,
      ratchetRake,
      ratchetRootRadius,
      ratchetToothCount,
      ratchetToothPitch,
      sLinkDepth,
      sLinkWidth,
      strapInnerRadius: sLink.strapInner,
      strapOuterRadius: sLink.strapOuter,
    },
    sLink,
    sLinkSolver,
    mechanism:
      'one-hand-crank-carries-the-long-bar-eye-around-a-fixed-shaft-the-lower-pin-guide-forces-simultaneous-bar-slide-and-oscillation-and-a-crankpin-eccentric-drives-brown-s-shaped-click-rod-that-indexes-the-bar-mounted-mirror-ratchet',
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
          'dimensions, loose-guide clearance, twelve-tooth ratchet, eccentric throw and phase (keyed on the crankpin rear end), S-link outline, keeper size, tooth engagement phase, and operating period are engineered because Brown supplies no numerical values and the official page has no canvas animation',
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
        'the eccentric keyed on the crankpin carries the S-link strap centre round the bar eye at the throw; the rod hangs from it and its hook rests on the ratchet outline',
      compoundMirrorLaw:
        'mirror center follows its fixed station on the sliding/oscillating bar, and mirror world angle equals bar angle plus cumulative ratchet angle',
      ratchetLaw:
        'while the strap descends the hook slides down the flank into the root, then drives the tooth face and the wheel one tooth; while it rises the wheel dwells and the hook rides up the flank, passes the tip and drops (at a finite rate) onto the next flank',
    },
  };

  correctMirrorPolisher(root);
  // Brown dashes the rod, its keeper and the ratchet behind the bar: the bar
  // is see-through (the shared style) so they show.
  makeSeeThrough(barBody);
  makeSeeThrough(upperEye);
  root.userData.reconstructionNote = 'The guided bar follows the crank exactly. Brown\'s S-shaped rod lies in the ratchet\'s plane behind the bar: its strap rides an eccentric keyed on the crankpin\'s rear end (an eccentric on the shaft itself would need the shaft to pierce the bar, which sweeps across it), it passes a loose keeper on the bar\'s back, and its hook, hanging against the teeth, drives the ratchet anticlockwise one tooth per crank turn and overruns on the return. The hook\'s contact is solved geometrically on the actual outlines; the wheel is assumed to hold still (polishing friction) while the hook overruns, and no polishing load is modelled.';
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
