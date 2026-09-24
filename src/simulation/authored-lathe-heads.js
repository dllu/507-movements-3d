import * as THREE from 'three';
import { plate, poly, circle, polygonClipping, ring } from './finite-plate-geometry.js';
import { helicalThread, threadAngles } from './mujoco-screw/thread-geometry.js';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);

function cylinderAlongX(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function horizontalHelixCurve({
  maximumX,
  minimumX,
  phase = 0,
  pitch,
  radius,
}) {
  const length = maximumX - minimumX;
  return new class extends THREE.Curve {
    getPoint(parameter, target = new THREE.Vector3()) {
      const x = minimumX + length * parameter;
      const angle = phase + (x - minimumX) / pitch * FULL_TURN;
      return target.set(
        x,
        radius * Math.cos(angle),
        radius * Math.sin(angle),
      );
    }
  }();
}

function septicSmoothstep(normalized) {
  const u = THREE.MathUtils.clamp(normalized, 0, 1);
  const u2 = u * u;
  const u3 = u2 * u;
  const oneMinusU = 1 - u;
  return {
    firstDerivative: 140 * u3 * oneMinusU ** 3,
    secondDerivative: 420 * u2 * oneMinusU ** 2 * (1 - 2 * u),
    value: 35 * u ** 4 - 84 * u ** 5 + 70 * u ** 6 - 20 * u ** 7,
  };
}

function latheTailstockScrewFeed(movement) {
  const root = new THREE.Group();

  // The official page marks Movement 285's animation unavailable. Dimensions
  // are independently measured from Brown's 525 px public-domain cutaway.
  // The cutaway identifies the retained screw, traveling keyed quill/nut, and
  // center as distinct members, which prevents the common error of rotating
  // the lathe center together with the handwheel.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.014;
  const sourceRasterAxisOrigin = new THREE.Vector2(282, 219);
  const sourceRasterCenterTip = new THREE.Vector2(39, 219);
  const sourceRasterQuillNose = new THREE.Vector2(147, 219);
  const sourceRasterThreadLeft = new THREE.Vector2(169, 219);
  const sourceRasterThreadRight = new THREE.Vector2(397, 219);
  const sourceRasterThreadTop = new THREE.Vector2(282, 205);
  const sourceRasterHandwheelCenter = new THREE.Vector2(443, 219);
  const sourceRasterHandwheelTop = new THREE.Vector2(443, 119);
  const sourceRasterHandwheelBottom = new THREE.Vector2(443, 320);
  const sourceRasterHandwheelGrip = new THREE.Vector2(467, 131);
  const sourceRasterHousingLeftTop = new THREE.Vector2(91, 174);
  const sourceRasterHousingRightBottom = new THREE.Vector2(421, 263);
  const sourceRasterBaseLeft = new THREE.Vector2(54, 426);
  const sourceRasterBaseRight = new THREE.Vector2(497, 426);
  const sourceRasterBaseBottom = new THREE.Vector2(273, 492);
  const sourceRasterClampLeverPivot = new THREE.Vector2(204, 154);

  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterAxisOrigin.x) * sourceScale,
    (sourceRasterAxisOrigin.y - y) * sourceScale,
  );
  const centerTip = sourcePointToModel(sourceRasterCenterTip);
  const quillNose = sourcePointToModel(sourceRasterQuillNose);
  const threadLeft = sourcePointToModel(sourceRasterThreadLeft);
  const threadRight = sourcePointToModel(sourceRasterThreadRight);
  const handwheelCenter = sourcePointToModel(sourceRasterHandwheelCenter);
  const handwheelTop = sourcePointToModel(sourceRasterHandwheelTop);
  const handwheelBottom = sourcePointToModel(sourceRasterHandwheelBottom);
  const sourceHandwheelGrip = sourcePointToModel(sourceRasterHandwheelGrip);
  const handwheelRadius = (
    handwheelCenter.distanceTo(handwheelTop)
    + handwheelCenter.distanceTo(handwheelBottom)
  ) / 2;

  const threadStarts = 1;
  const threadMinimumX = threadLeft.x;
  const threadMaximumX = threadRight.x;
  const threadLength = threadMaximumX - threadMinimumX;
  const threadTurnCount = 23;
  const threadPitch = threadLength / threadTurnCount;
  const threadLead = threadPitch * threadStarts;
  const threadLeadPerRadian = threadLead / FULL_TURN;
  const threadWaveNumber = FULL_TURN / threadPitch;
  const threadCoreRadius = 0.13;
  const externalThreadRadius = sourcePointToModel(
    sourceRasterThreadTop,
  ).y;
  const externalThreadTubeRadius = 0.035;
  const internalThreadRadius = 0.285;
  const internalThreadTubeRadius = 0.025;
  const threadPitchRadius = 0.18;
  // Root and crest running clearance; the mating flanks overlap radially.
  const threadRadialClearance = 0.004;
  const threadCrestRadius = externalThreadRadius + externalThreadTubeRadius;
  const externalProfile = { inner: threadCoreRadius - 0.001, outer: threadCrestRadius,
    low: threadMinimumX, high: threadMaximumX, width: threadPitch / 2,
    lead: threadLeadPerRadian, phase: threadMinimumX };
  const threadGeometry = (profile) => helicalThread(profile, threadAngles(profile, 96))
    .rotateZ(Math.PI / 2).rotateY(Math.PI / 2);
  const threadSegmentsPerTurn = 24;
  const threadSegments = Math.ceil(
    threadTurnCount * threadSegmentsPerTurn,
  );
  const screwTravelTurns = 4;
  const screwAngularTravel = screwTravelTurns * FULL_TURN;
  const quillTravel = screwTravelTurns * threadLead;
  const sourceQuillX = 0;
  const sourceNutCenterX = 1.37;
  const quillMinimumX = sourceQuillX - quillTravel;
  const quillMaximumX = sourceQuillX;
  const cyclePeriod = 8;
  const outwardStrokeFraction = 0.42;
  const outerDwellFraction = 0.08;
  const inwardStrokeFraction = 0.42;
  const innerDwellFraction = 0.08;
  const outwardEndPhase = outwardStrokeFraction;
  const outerDwellEndPhase = outwardEndPhase + outerDwellFraction;
  const inwardEndPhase = outerDwellEndPhase + inwardStrokeFraction;

  const motionAtCyclePhase = (unwrappedPhase) => {
    const cycleIndex = Math.floor(unwrappedPhase);
    const cyclePhase = unwrappedPhase - cycleIndex;
    let driverAngle = 0;
    let driverFirstDerivativeByPhase = 0;
    let driverSecondDerivativeByPhase = 0;
    let stage = 'inner-end-dwell';
    if (cyclePhase < outwardEndPhase) {
      const normalized = cyclePhase / outwardStrokeFraction;
      const law = septicSmoothstep(normalized);
      driverAngle = screwAngularTravel * law.value;
      driverFirstDerivativeByPhase = screwAngularTravel
        * law.firstDerivative / outwardStrokeFraction;
      driverSecondDerivativeByPhase = screwAngularTravel
        * law.secondDerivative / outwardStrokeFraction ** 2;
      stage = 'handwheel-right-outward-feed';
    } else if (cyclePhase < outerDwellEndPhase) {
      driverAngle = screwAngularTravel;
      stage = 'outer-end-dwell';
    } else if (cyclePhase < inwardEndPhase) {
      const normalized = (
        cyclePhase - outerDwellEndPhase
      ) / inwardStrokeFraction;
      const law = septicSmoothstep(normalized);
      driverAngle = screwAngularTravel * (1 - law.value);
      driverFirstDerivativeByPhase = -screwAngularTravel
        * law.firstDerivative / inwardStrokeFraction;
      driverSecondDerivativeByPhase = -screwAngularTravel
        * law.secondDerivative / inwardStrokeFraction ** 2;
      stage = 'handwheel-left-inward-return';
    }
    return {
      cycleIndex,
      cyclePhase,
      driverAngle,
      driverAngularAcceleration: driverSecondDerivativeByPhase
        / cyclePeriod ** 2,
      driverAngularSpeed: driverFirstDerivativeByPhase / cyclePeriod,
      stage,
    };
  };

  const stateAtCyclePhase = (cyclePhase) => {
    const motion = motionAtCyclePhase(cyclePhase);
    const quillDisplacement = -threadLeadPerRadian * motion.driverAngle;
    const quillX = sourceQuillX + quillDisplacement;
    const quillVelocity = -threadLeadPerRadian
      * motion.driverAngularSpeed;
    const quillAcceleration = -threadLeadPerRadian
      * motion.driverAngularAcceleration;
    const contactX = sourceNutCenterX + quillDisplacement;
    const contactAngle = threadWaveNumber
      * (contactX - threadMinimumX) + motion.driverAngle;
    const contactCosine = Math.cos(contactAngle);
    const contactSine = Math.sin(contactAngle);
    const threadContactPoint = new THREE.Vector3(
      contactX,
      threadPitchRadius * contactCosine,
      threadPitchRadius * contactSine,
    );
    const circumferentialDirection = new THREE.Vector3(
      0,
      -contactSine,
      contactCosine,
    );
    const screwThreadVelocity = circumferentialDirection.clone()
      .multiplyScalar(
        motion.driverAngularSpeed * threadPitchRadius,
      );
    const quillThreadVelocity = new THREE.Vector3(quillVelocity, 0, 0);
    const relativeThreadVelocity = quillThreadVelocity.clone()
      .sub(screwThreadVelocity);
    const flankNormal = new THREE.Vector3(
      threadWaveNumber * threadPitchRadius,
      contactSine,
      -contactCosine,
    ).normalize();
    const radialNormal = new THREE.Vector3(
      0,
      contactCosine,
      contactSine,
    );
    const helixTangent = new THREE.Vector3(
      1,
      -threadWaveNumber * threadPitchRadius * contactSine,
      threadWaveNumber * threadPitchRadius * contactCosine,
    ).normalize();
    return {
      ...motion,
      axialConstraintError: quillDisplacement
        + threadLeadPerRadian * motion.driverAngle,
      centerTipX: centerTip.x + quillDisplacement,
      contactAngle,
      flankNormal,
      helixTangent,
      nutCenterX: sourceNutCenterX + quillDisplacement,
      phaseConstraintError: threadWaveNumber * quillDisplacement
        + motion.driverAngle,
      quillAcceleration,
      quillDisplacement,
      quillVelocity,
      quillX,
      radialNormal,
      screwAxialDisplacement: 0,
      screwThreadVelocity,
      spindleAngularSpeed: 0,
      threadContactPoint,
      threadFlankNormalVelocityError: relativeThreadVelocity.dot(
        flankNormal,
      ),
      threadRadialNormalVelocityError: relativeThreadVelocity.dot(
        radialNormal,
      ),
      threadSlidingSpeed: relativeThreadVelocity.dot(helixTangent),
    };
  };
  const stateAtTime = (time) => stateAtCyclePhase(time / cyclePeriod);

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.53,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.61,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.16,
    roughness: 0.55,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.45 });
  const glassMaterial = matte(0x83aebe, {
    metalness: 0.02,
    opacity: 0.24,
    roughness: 0.38,
    side: THREE.DoubleSide,
    transparent: true,
  });

  const frame = new THREE.Group();
  frame.userData.role = 'fixed-lathe-tailstock-casting-and-quill-guide';
  root.add(frame);
  const housingLeftTop = sourcePointToModel(sourceRasterHousingLeftTop);
  const housingRightBottom = sourcePointToModel(
    sourceRasterHousingRightBottom,
  );
  const housingMinimumX = housingLeftTop.x;
  const housingMaximumX = housingRightBottom.x;
  const housingLength = housingMaximumX - housingMinimumX;
  const housingCenterX = (housingMinimumX + housingMaximumX) / 2;
  const barrelUpper = new THREE.Mesh(
    new THREE.BoxGeometry(housingLength, 0.20, 1.06),
    frameMaterial,
  );
  barrelUpper.position.set(housingCenterX, 0.54, 0);
  barrelUpper.userData.role = 'fixed-upper-quill-guide-rail';
  frame.add(barrelUpper);
  const barrelLower = new THREE.Mesh(
    new THREE.BoxGeometry(housingLength, 0.20, 1.06),
    frameMaterial,
  );
  barrelLower.position.set(housingCenterX, -0.54, 0);
  barrelLower.userData.role = 'fixed-lower-quill-guide-rail';
  frame.add(barrelLower);
  const rectangle = (left, bottom, right, top) => poly([[left, bottom], [right, bottom], [right, top], [left, top]]);
  const guideSection = polygonClipping.difference(rectangle(-0.53, -0.64, 0.53, 0.64),
    poly(circle([0, 0], 0.382, 128)), rectangle(-0.112, 0, 0.112, 0.435));
  for (const x of [housingMinimumX, housingMaximumX]) {
    const endCheek = new THREE.Mesh(
      plate(guideSection, -0.09, 0.09).rotateY(Math.PI / 2),
      frameMaterial,
    );
    endCheek.position.set(x, 0, 0);
    endCheek.userData.role = x < 0
      ? 'front-fixed-tailstock-guide-cheek'
      : 'rear-fixed-thrust-bearing-cheek';
    frame.add(endCheek);
  }

  // Two inferred bearing lands overlap the quill throughout its entire travel.
  const quillGuides = [-1.5, 0.65].map(x => {
    const profile = polygonClipping.difference(rectangle(-0.53, -0.54, 0.53, 0.54),
      poly(circle([0, 0], 0.335, 128)), rectangle(-0.112, 0, 0.112, 0.435));
    const guide = new THREE.Mesh(plate(profile, -0.08, 0.08).rotateY(Math.PI / 2), frameMaterial);
    guide.position.x = x; guide.userData.role = 'bored-keyed-quill-bearing-land'; frame.add(guide); return guide;
  });

  const baseLeft = sourcePointToModel(sourceRasterBaseLeft);
  const baseRight = sourcePointToModel(sourceRasterBaseRight);
  const baseBottom = sourcePointToModel(sourceRasterBaseBottom);
  const baseLength = baseRight.x - baseLeft.x;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(baseLength, 0.42, 1.75),
    frameMaterial,
  );
  base.position.set((baseLeft.x + baseRight.x) / 2, baseLeft.y - 0.21, 0);
  base.userData.role = 'tailstock-bed-clamping-base';
  frame.add(base);
  const leftColumn = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 2.448, 1.14),
    frameMaterial,
  );
  leftColumn.position.set(-1.98, -1.674, 0);
  leftColumn.userData.role = 'front-tailstock-casting-column';
  // Brown draws one solid casting pierced by an octagonal window rather than
  // two separate columns and a bridge; keep those three blocks as one mesh.
  {
    const chamfer = 0.34;
    const [wl, wr, wb, wt] = [-1.62, 1.14, -2.28, -0.86];
    const casting = polygonClipping.difference(
      rectangle(-2.19, -2.898, 1.76, -0.62),
      poly([[wl + chamfer, wb], [wr - chamfer, wb], [wr, wb + chamfer], [wr, wt - chamfer],
        [wr - chamfer, wt], [wl + chamfer, wt], [wl, wt - chamfer], [wl, wb + chamfer]]),
    );
    leftColumn.geometry.dispose();
    leftColumn.geometry = plate(casting, -0.57, 0.57);
    leftColumn.position.set(0, 0, 0);
    leftColumn.userData.role = 'octagonal-window-tailstock-casting';
  }
  frame.add(leftColumn);
  const rightColumn = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 2.458, 1.14),
    frameMaterial,
  );
  rightColumn.position.set(1.53, -1.669, 0);
  rightColumn.userData.role = 'rear-tailstock-casting-column';
  const lowerBridge = new THREE.Mesh(
    new THREE.BoxGeometry(3.28, 0.36, 1.14),
    frameMaterial,
  );
  lowerBridge.position.set(-0.18, -2.42, 0);
  lowerBridge.userData.role = 'tailstock-casting-lower-window-bridge';
  const baseClampBolt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 1.96, 30),
    darkMaterial,
  );
  baseClampBolt.position.set(-0.13, baseBottom.y + 0.43, 0);
  baseClampBolt.userData.role = 'vertical-tailstock-bed-clamp-bolt';
  frame.add(baseClampBolt);
  const baseClampNut = new THREE.Mesh(
    new THREE.CylinderGeometry(0.30, 0.30, 0.20, 6),
    darkMaterial,
  );
  baseClampNut.position.set(-0.13, baseBottom.y + 0.04, 0);
  baseClampNut.userData.role = 'tailstock-bed-clamp-nut';
  frame.add(baseClampNut);

  const screw = new THREE.Group();
  screw.userData.axis = X_AXIS.clone();
  screw.userData.role = 'axially-retained-right-hand-tailstock-leadscrew';
  root.add(screw);
  const screwCore = cylinderAlongX(
    threadCoreRadius,
    threadLength + 1.12,
    driverMaterial,
    30,
  );
  screwCore.position.x = (threadMinimumX + threadMaximumX) / 2 + 0.34;
  screwCore.userData.role = 'tailstock-leadscrew-core';
  screw.add(screwCore);
  const externalThreadCurve = horizontalHelixCurve({
    maximumX: threadMaximumX,
    minimumX: threadMinimumX,
    pitch: threadPitch,
    radius: externalThreadRadius,
  });
  const externalThread = new THREE.Mesh(
    threadGeometry(externalProfile),
    driverMaterial,
  );
  externalThread.userData.role =
    'one-continuous-visible-right-hand-leadscrew-thread';
  screw.add(externalThread);
  const handwheel = new THREE.Group();
  handwheel.position.set(handwheelCenter.x, 0, 0);
  handwheel.userData.axis = X_AXIS.clone();
  handwheel.userData.role = 'rear-handwheel-rigid-with-leadscrew';
  screw.add(handwheel);
  // Brown's plate draws the turning member as one straight bar across the
  // screw axis (a T crank seen along its broad face edge-on) with a boss on
  // the frame side and a bulbous grip at its upper end, not a spoked wheel.
  // The historical block names (handwheel, wheelRim) are kept for callers.
  const crankBarThickness = 0.16;
  const crankBarWidth = 0.24;
  const wheelRim = new THREE.Mesh(
    new THREE.BoxGeometry(
      crankBarThickness,
      handwheelRadius * 2,
      crankBarWidth,
    ),
    driverMaterial,
  );
  wheelRim.userData.role = 'tailstock-t-crank-bar';
  handwheel.add(wheelRim);
  // The fixed-to-screw thrust collar doubles as the crank boss drawn
  // between the frame end and the bar; the screw end is the outer stub.
  const handwheelGripAngle = Math.atan2(
    sourceHandwheelGrip.y - handwheelCenter.y,
    0.34,
  );
  const gripCarrier = new THREE.Group();
  gripCarrier.position.set(0, sourceHandwheelGrip.y - handwheelCenter.y, 0);
  gripCarrier.userData.role = 't-crank-handle-carrier';
  handwheel.add(gripCarrier);
  const gripProfile = [
    [0, 0.0], [0.07, 0.0], [0.07, 0.1], [0.06, 0.16], [0.1, 0.28],
    [0.14, 0.42], [0.13, 0.52], [0.08, 0.58], [0, 0.6],
  ].map(([radius, height]) => new THREE.Vector2(radius, height));
  const handwheelGrip = new THREE.Mesh(
    new THREE.LatheGeometry(gripProfile, 28).rotateZ(-Math.PI / 2),
    darkMaterial,
  );
  handwheelGrip.position.x = crankBarThickness / 2 - 0.001;
  handwheelGrip.userData.role = 'tailstock-t-crank-turning-grip';
  gripCarrier.add(handwheelGrip);
  const wheelIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 18, 12),
    whiteMaterial,
  );
  wheelIndex.position.set(0.10, handwheelRadius, 0);
  wheelIndex.userData.role = 'white-handwheel-rotation-index';

  const thrustCollar = cylinderAlongX(0.32, 0.18, darkMaterial, 34);
  thrustCollar.position.x = housingMaximumX + 0.18;
  thrustCollar.userData.role = 'fixed-axial-thrust-collar';
  screw.add(thrustCollar);
  const rearBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.33, 0.07, 10, 42),
    frameMaterial,
  );
  rearBearing.rotation.y = Math.PI / 2;
  rearBearing.position.set(housingMaximumX + 0.02, 0, 0);
  rearBearing.userData.role = 'fixed-leadscrew-radial-and-thrust-bearing';
  root.add(rearBearing);

  const quill = new THREE.Group();
  quill.userData.axis = X_AXIS.clone();
  quill.userData.role = 'keyed-nonrotating-translating-tailstock-quill';
  root.add(quill);
  const quillRearX = 1.58;
  const quillLength = quillRearX - quillNose.x;
  const quillSleeve = cylinderAlongX(0.33, quillLength,
    glassMaterial, 48);
  quillSleeve.geometry.dispose();
  quillSleeve.geometry = ring(0.265, 0.33, -quillLength / 2, quillLength / 2, 128)
    .rotateX(Math.PI / 2);
  quillSleeve.position.x = (quillNose.x + quillRearX) / 2;
  quillSleeve.userData.role = 'transparent-cutaway-sliding-quill-sleeve';
  quill.add(quillSleeve);
  const quillRings = [];
  for (const x of [quillNose.x, quillRearX]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.33, 0.045, 9, 44),
      drivenMaterial,
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.x = x;
    ring.userData.role = 'sliding-quill-end-ring';
    quillRings.push(ring);
    quill.add(ring);
  }
  const centerShankLength = quillNose.x - (centerTip.x + 0.52);
  const centerShank = cylinderAlongX(0.18, centerShankLength,
    drivenMaterial, 30);
  centerShank.position.x = (quillNose.x + centerTip.x + 0.52) / 2;
  centerShank.userData.role = 'tailstock-center-rigid-shank';
  quill.add(centerShank);
  const centerCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 1.04, 36),
    drivenMaterial,
  );
  centerCone.rotation.z = Math.PI / 2;
  centerCone.position.x = centerTip.x + 0.52;
  centerCone.userData.role = 'pointed-lathe-center-fixed-in-quill';
  quill.add(centerCone);
  const quillKey = new THREE.Mesh(
    new THREE.BoxGeometry(quillLength * 0.72, 0.11, 0.16),
    drivenMaterial,
  );
  quillKey.position.set(0.03, 0.37, 0);
  quillKey.userData.role = 'quill-anti-rotation-longitudinal-key';
  quill.add(quillKey);
  const quillIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.08, 0.20),
    drivenMaterial,
  );
  quillIndex.position.set(-0.72, 0.37, 0);
  quillIndex.userData.role = 'white-quill-translation-index';
  quill.add(quillIndex);

  const nut = cylinderAlongX(0.31, 0.42, accentMaterial, 34);
  nut.geometry.dispose();
  nut.geometry = ring(threadCrestRadius + threadRadialClearance, 0.31, -0.21, 0.21, 128);
  nut.geometry.rotateX(Math.PI / 2); // Existing cylinder mesh turns Y onto X.
  nut.position.x = sourceNutCenterX;
  nut.userData.role = 'nonrotating-nut-fixed-inside-traveling-quill';
  quill.add(nut);
  const internalThreadMinimumX = sourceNutCenterX - 0.19;
  const internalThreadMaximumX = sourceNutCenterX + 0.19;
  const internalThreadPhase = threadWaveNumber * (
    internalThreadMinimumX - threadMinimumX
  );
  const internalThreadCurve = horizontalHelixCurve({
    maximumX: internalThreadMaximumX,
    minimumX: internalThreadMinimumX,
    phase: internalThreadPhase,
    pitch: threadPitch,
    radius: internalThreadRadius,
  });
  const internalThread = new THREE.Mesh(
    threadGeometry({ ...externalProfile, inner: threadCoreRadius + threadRadialClearance,
      outer: threadCrestRadius + threadRadialClearance, low: internalThreadMinimumX,
      high: internalThreadMaximumX, width: threadPitch / 2 - 0.004,
      phase: externalProfile.phase + threadPitch / 2 }),
    darkMaterial,
  );
  internalThread.userData.role =
    'matching-internal-thread-rigid-with-quill-nut';
  quill.add(internalThread);

  const fixedKeyGuide = new THREE.Mesh(
    plate(polygonClipping.difference(rectangle(-0.155, -0.075, 0.155, 0.075),
      rectangle(-0.112, -0.076, 0.112, 0.015)),
    -(housingLength - 0.4) / 2, (housingLength - 0.4) / 2).rotateY(Math.PI / 2),
    darkMaterial,
  );
  fixedKeyGuide.position.set(housingCenterX - 0.1, 0.435, 0);
  fixedKeyGuide.userData.role = 'fixed-longitudinal-keyway-guide';
  frame.add(fixedKeyGuide);

  const clampLeverPivot = sourcePointToModel(sourceRasterClampLeverPivot);
  const clampPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.10, 0.50, 24),
    darkMaterial,
  );
  clampPost.position.set(clampLeverPivot.x, 0.84, 0);
  clampPost.userData.role = 'fixed-quill-clamp-screw';
  frame.add(clampPost);
  const clampLever = makeBeam(
    new THREE.Vector3(clampLeverPivot.x, 1.08, 0),
    new THREE.Vector3(clampLeverPivot.x + 0.78, 1.08, 0.18),
    {
      color: PALETTE.accent,
      depth: 0.12,
      thickness: 0.11,
    },
  );
  clampLever.userData.role = 'stationary-quill-locking-lever';
  frame.add(clampLever);

  const threadContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 18, 12),
    whiteMaterial,
  );
  threadContactMarker.userData.role = 'active-screw-nut-contact-marker';

  root.userData.archetype =
    'handwheel-retained-leadscrew-keyed-tailstock-quill-center-feed';
  root.userData.blocks = {
    base,
    baseClampBolt,
    baseClampNut,
    barrelLower,
    barrelUpper,
    centerCone,
    centerShank,
    clampLever,
    externalThread,
    fixedKeyGuide,
    frame,
    handwheel,
    handwheelGrip,
    internalThread,
    nut,
    quill,
    quillIndex,
    quillKey,
    quillRings,
    quillSleeve,
    quillGuides,
    rearBearing,
    screw,
    screwCore,
    threadContactMarker,
    thrustCollar,
    wheelIndex,
    wheelRim,
  };
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.25, -4.15, -1.35),
    new THREE.Vector3(3.65, 1.65, 1.55),
  );
  root.userData.curves = {
    externalThread: externalThreadCurve,
    internalThread: internalThreadCurve,
  };
  root.userData.geometry = {
    cyclePeriod,
    externalThreadRadius,
    externalThreadTubeRadius,
    handwheelGripAngle,
    handwheelRadius,
    innerDwellFraction,
    internalThreadRadius,
    internalThreadTubeRadius,
    quillMaximumX,
    quillMinimumX,
    quillTravel,
    screwAngularTravel,
    screwTravelTurns,
    sourceNutCenterX,
    sourceQuillX,
    sourceScale,
    threadCoreRadius,
    threadLead,
    threadLeadPerRadian,
    threadLength,
    threadMaximumX,
    threadMinimumX,
    threadPitch,
    threadPitchRadius,
    threadRadialClearance,
    threadSegments,
    threadSegmentsPerTurn,
    threadStarts,
    threadTurnCount,
    threadWaveNumber,
  };
  root.userData.mechanism =
    'one rear handwheel is rigidly fixed to one axially retained right-hand leadscrew; the screw turns inside one nonrotating nut rigidly fixed in the sliding quill, so exact thread lead translates the keyed quill and its pointed lathe center while neither the quill nor center rotates';
  root.userData.movement = movement;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 285 page marks its animation unavailable and has no ae.add_model or mm_present animation script.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate285: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'the edge-view rear handwheel shares the horizontal axis and rotation of an axially retained screw; a keyed cylindrical quill surrounds it, carries the matching nut, and translates the pointed center at its front end',
      measurementUncertaintyPixels: 6,
      rasterAxisOrigin: {
        x: sourceRasterAxisOrigin.x,
        y: sourceRasterAxisOrigin.y,
      },
      rasterBaseBottom: {
        x: sourceRasterBaseBottom.x,
        y: sourceRasterBaseBottom.y,
      },
      rasterBaseLeft: {
        x: sourceRasterBaseLeft.x,
        y: sourceRasterBaseLeft.y,
      },
      rasterBaseRight: {
        x: sourceRasterBaseRight.x,
        y: sourceRasterBaseRight.y,
      },
      rasterCenterTip: {
        x: sourceRasterCenterTip.x,
        y: sourceRasterCenterTip.y,
      },
      rasterHandwheelBottom: {
        x: sourceRasterHandwheelBottom.x,
        y: sourceRasterHandwheelBottom.y,
      },
      rasterHandwheelCenter: {
        x: sourceRasterHandwheelCenter.x,
        y: sourceRasterHandwheelCenter.y,
      },
      rasterHandwheelGrip: {
        x: sourceRasterHandwheelGrip.x,
        y: sourceRasterHandwheelGrip.y,
      },
      rasterHandwheelTop: {
        x: sourceRasterHandwheelTop.x,
        y: sourceRasterHandwheelTop.y,
      },
      rasterHousingLeftTop: {
        x: sourceRasterHousingLeftTop.x,
        y: sourceRasterHousingLeftTop.y,
      },
      rasterHousingRightBottom: {
        x: sourceRasterHousingRightBottom.x,
        y: sourceRasterHousingRightBottom.y,
      },
      rasterQuillNose: {
        x: sourceRasterQuillNose.x,
        y: sourceRasterQuillNose.y,
      },
      rasterThreadLeft: {
        x: sourceRasterThreadLeft.x,
        y: sourceRasterThreadLeft.y,
      },
      rasterThreadRight: {
        x: sourceRasterThreadRight.x,
        y: sourceRasterThreadRight.y,
      },
      rasterThreadTop: {
        x: sourceRasterThreadTop.x,
        y: sourceRasterThreadTop.y,
      },
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 75,
      edition: 21,
      illustrationPage: 74,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cyclePeriod,
    innerDwellFraction,
    inwardEndPhase,
    inwardStrokeFraction,
    outerDwellEndPhase,
    outerDwellFraction,
    outwardEndPhase,
    outwardStrokeFraction,
    schedule: [
      'four-turn-outward-feed',
      'outer-end-dwell',
      'four-turn-inward-return',
      'inner-end-dwell',
    ],
  };
  root.userData.transmission = {
    axialTravelPerHandwheelTurn: threadLead,
    handwheelAndScrewRigidlyCoaxial: true,
    output:
      'nonrotating keyed quill and pointed center translate together on the screw axis',
    quillRotation: 0,
    screwAxiallyRetained: true,
    screwLaw:
      'quill-displacement = -driver-angle * thread-lead / (2*pi)',
    threadHand: 'right-hand',
  };

  const update = (time) => {
    const state = stateAtTime(time);
    screw.rotation.x = state.driverAngle;
    screw.userData.angularAcceleration = state.driverAngularAcceleration;
    screw.userData.angularSpeed = state.driverAngularSpeed;
    screw.userData.axialDisplacement = 0;
    quill.position.set(state.quillX, 0, 0);
    quill.rotation.set(0, 0, 0);
    quill.userData.angularSpeed = 0;
    quill.userData.velocity = new THREE.Vector3(
      state.quillVelocity,
      0,
      0,
    );
    threadContactMarker.position.copy(state.threadContactPoint);
    root.userData.contacts = {
      quillKeyGuide: {
        axis: X_AXIS.clone(),
        lineError: Math.hypot(quill.position.y, quill.position.z),
        rotationError: quill.rotation.x,
      },
      screwBearing: {
        axialDisplacementError: state.screwAxialDisplacement,
        axis: X_AXIS.clone(),
      },
      screwThread: {
        axialConstraintError: state.axialConstraintError,
        contactPoint: state.threadContactPoint.clone(),
        flankNormal: state.flankNormal.clone(),
        flankNormalVelocityError: state.threadFlankNormalVelocityError,
        lead: threadLead,
        phaseConstraintError: state.phaseConstraintError,
        pitch: threadPitch,
        radialClearance: threadRadialClearance,
        radialNormalVelocityError: state.threadRadialNormalVelocityError,
        singleStart: threadStarts === 1,
        slidingSpeed: state.threadSlidingSpeed,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData.hideGround = true;
  root.userData.cameraFov = 8;
  root.userData.solidReview = { externalProfile, threadCrestRadius, threadRadialClearance,
    flankClearance: 0.002, qualification: 'Prescribed screw lead law; inferred square threads, running clearance and bored keyed guides. No passive force or friction validation.' };
  root.traverse(object => { for (const material of object.material ? [].concat(object.material) : []) material.fog = false; });
  update(0);
  markShadows(root);
  return {
    root,
    update,
    // Brown draws a flat side elevation with the handwheel edge-on.
    cameraDirection: new THREE.Vector3(0, 0, 16),
  };
}

export function createAuthoredLatheHeadMovement(movement) {
  if (movement.id !== 285) return null;
  const result = latheTailstockScrewFeed(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
