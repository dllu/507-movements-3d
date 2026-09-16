import { correctWormRack } from './differential-thread-solids.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function cylinderAlongY(radius, length, material, segments = 40) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function torusAroundY(radius, tube, material, segments = 44) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 10, segments),
    material,
  );
  torus.rotation.x = Math.PI / 2;
  return torus;
}

function wrapSignedAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function verticalHelixCurve({
  maximumY,
  minimumY,
  phase,
  radius,
  waveNumber,
}) {
  const length = maximumY - minimumY;
  return new class extends THREE.Curve {
    getPoint(parameter, target = new THREE.Vector3()) {
      const y = minimumY + length * parameter;
      const angle = phase + waveNumber * y;
      return target.set(
        radius * Math.cos(angle),
        y,
        --radius * Math.sin(angle),
      );
    }
  }();
}

function makeRackGuide({
  depth,
  guideClearance,
  guideMaterial,
  guideThickness,
  rackDepth,
  rackSpineCenterX,
  rackSpineWidth,
  role,
  y,
}) {
  const group = new THREE.Group();
  group.position.y = y;
  group.userData.clearance = guideClearance;
  group.userData.role = role;

  const rearShoe = new THREE.Mesh(
    new THREE.BoxGeometry(
      rackSpineWidth + guideThickness * 2,
      0.32,
      guideThickness,
    ),
    guideMaterial,
  );
  rearShoe.position.set(
    rackSpineCenterX,
    0,
    -rackDepth / 2 - guideClearance - guideThickness / 2,
  );
  rearShoe.userData.role = `${role}-rear-shoe`;
  const frontFingers = [-1, 1].map((side) => {
    const finger = new THREE.Mesh(
      new THREE.BoxGeometry(
        guideThickness,
        0.32,
        depth,
      ),
      guideMaterial,
    );
    finger.position.set(
      rackSpineCenterX
        + side * (rackSpineWidth / 2 + guideClearance
          + guideThickness / 2),
      0,
      0,
    );
    finger.userData.role = `${role}-side-finger`;
    group.add(finger);
    return finger;
  });
  group.add(rearShoe);
  group.userData.blocks = { frontFingers, rearShoe };
  return group;
}

function wormDrivenRack(movement) {
  const root = new THREE.Group();

  // Measurements from the 525 px public-domain engraving. Coordinates are
  // centered on the worm axis and on the middle of its threaded body.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.016;
  const sourceRasterWormAxisX = 285;
  const sourceRasterWormCenterY = 329;
  const sourceRasterRackSpineCenter = new THREE.Vector2(195.5, 248);
  const sourceRasterRackTop = new THREE.Vector2(195, 62);
  const sourceRasterRackBottom = new THREE.Vector2(196, 433);
  const sourceRasterRackToothTip = new THREE.Vector2(244, 267);
  const sourceRasterWormShaftTop = new THREE.Vector2(285, 216);
  const sourceRasterWormShaftBottom = new THREE.Vector2(285, 443);

  const wormAxisX = 0.55;
  const wormCoreRadius = 0.39;
  const wormThreadRadius = 0.66;
  const wormThreadTubeRadius = 0.16; // Square-thread axial half-width (legacy metadata key).
  const threadFlankClearance = .003;
  const wormThreadMinimumY = -1.45;
  const wormThreadMaximumY = 1.45;
  const wormShaftMinimumY = -1.824;
  const wormShaftMaximumY = 1.808;
  const wormShaftRadius = 0.105;
  const wormHandedness = 1;

  const rackToothPitch = 0.64;
  const wormLead = rackToothPitch;
  const leadPerRadian = wormHandedness * wormLead / FULL_TURN;
  const wormWaveNumber = wormHandedness * FULL_TURN / wormLead;
  const rackToothThickness = 0.314;
  const rackToothHalfThickness = rackToothThickness / 2;
  const rackToothDepth = 0.38;
  const rackToothTipX = wormAxisX
    + (sourceRasterRackToothTip.x - sourceRasterWormAxisX)
      * sourceScale;
  const rackSpineCenterX = wormAxisX
    + (sourceRasterRackSpineCenter.x - sourceRasterWormAxisX)
      * sourceScale;
  const rackSpineWidth = 0.17;
  const rackSpineDepth = 0.42;
  const rackSpineTopY = (
    sourceRasterWormCenterY - sourceRasterRackTop.y
  ) * sourceScale;
  const rackSpineBottomY = (
    sourceRasterWormCenterY - sourceRasterRackBottom.y
  ) * sourceScale;
  const rackSpineLength = rackSpineTopY - rackSpineBottomY;
  const rackToothStartX = rackSpineCenterX + rackSpineWidth / 2;
  const rackToothLength = rackToothTipX - rackToothStartX;
  const rackToothIndices = Array.from(
    { length: 9 },
    (_, index) => index - 4,
  );
  const sourceActiveToothY = (
    sourceRasterWormCenterY - sourceRasterRackToothTip.y
  ) * sourceScale;
  const sourceContactThreadCenterY = sourceActiveToothY
    + rackToothHalfThickness + wormThreadTubeRadius + threadFlankClearance;
  const sourceThreadPhase = Math.PI
    - wormWaveNumber * sourceContactThreadCenterY;

  const maximumWormAngle = 2 * FULL_TURN;
  const cyclePeriod = 8;
  const cycleAngularFrequency = FULL_TURN / cyclePeriod;
  const maximumRackTravel = Math.abs(
    leadPerRadian * maximumWormAngle,
  );
  const guideClearance = 0.025;
  const guideThickness = 0.13;
  const guideDepth = 0.66;
  const upperRackGuideY = 2.60;
  const lowerRackGuideY = -1.40;

  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    wormAxisX + (x - sourceRasterWormAxisX) * sourceScale,
    (sourceRasterWormCenterY - y) * sourceScale,
  );

  const stateAtPhase = (phase) => {
    const cosine = Math.cos(phase);
    const sine = Math.sin(phase);
    const wormAngle = maximumWormAngle * (1 - cosine) / 2;
    const wormAngularSpeed = maximumWormAngle
      * cycleAngularFrequency * sine / 2;
    const wormAngularAcceleration = maximumWormAngle
      * cycleAngularFrequency ** 2 * cosine / 2;
    const rackDisplacement = -leadPerRadian * wormAngle;
    const rackSpeed = -leadPerRadian * wormAngularSpeed;
    const rackAcceleration = -leadPerRadian * wormAngularAcceleration;
    const activeToothCenterY = sourceActiveToothY + rackDisplacement;
    const activeToothFlankY = activeToothCenterY
      + rackToothHalfThickness;
    const contactThreadCenterY = activeToothFlankY
      + wormThreadTubeRadius + threadFlankClearance;
    const contactThreadLocalAngle = sourceThreadPhase
      + wormWaveNumber * contactThreadCenterY;
    const contactThreadWorldAngle = contactThreadLocalAngle + wormAngle;
    const threadPhaseError = wrapSignedAngle(
      contactThreadWorldAngle - Math.PI,
    );
    const contactThreadCenter = new THREE.Vector3(
      wormAxisX - wormThreadRadius,
      contactThreadCenterY,
      0,
    );
    const contactPoint = new THREE.Vector3(
      wormAxisX - wormThreadRadius,
      activeToothFlankY,
      0,
    );
    const rackFlankVelocity = new THREE.Vector3(0, rackSpeed, 0);
    const wormSurfaceVelocity = new THREE.Vector3(
      0,
      0,
      wormThreadRadius * wormAngularSpeed,
    );
    const relativeContactVelocity = rackFlankVelocity.clone()
      .sub(wormSurfaceVelocity);
    const threadTangent = new THREE.Vector3(
      0,
      1,
      wormThreadRadius * wormWaveNumber,
    ).normalize();
    const radialNormal = new THREE.Vector3(-1, 0, 0);
    const flankNormal = new THREE.Vector3().crossVectors(
      radialNormal,
      threadTangent,
    ).normalize();
    const contactSurfaceGap = contactThreadCenter.distanceTo(contactPoint)
      - wormThreadTubeRadius;
    const leadConstraintError = rackDisplacement
      + leadPerRadian * wormAngle;
    const activeFlankPhaseY = (
      Math.PI - wormAngle - sourceThreadPhase
    ) / wormWaveNumber;
    const activeFlankPhaseError = contactThreadCenterY
      - activeFlankPhaseY;
    const upperGuideCoverage = rackSpineTopY + rackDisplacement
      - upperRackGuideY;
    const lowerGuideCoverage = lowerRackGuideY
      - (rackSpineBottomY + rackDisplacement);

    let stage;
    if (Math.abs(wormAngularSpeed) < 1e-10) {
      stage = wormAngle < maximumWormAngle / 2
        ? 'source-rack-up-worm-stopped-reversal'
        : 'rack-down-two-pitches-worm-stopped-reversal';
    } else {
      stage = wormAngularSpeed > 0
        ? 'worm-turning-forward-rack-descending'
        : 'worm-turning-reverse-rack-ascending';
    }

    return {
      activeFlankPhaseError,
      activeFlankPhaseY,
      activeToothCenterY,
      activeToothFlankY,
      contactPoint,
      contactSurfaceGap,
      contactThreadCenter,
      contactThreadCenterY,
      contactThreadLocalAngle,
      contactThreadWorldAngle,
      cyclePhase: THREE.MathUtils.euclideanModulo(phase, FULL_TURN)
        / FULL_TURN,
      flankNormal,
      flankNormalVelocityError: relativeContactVelocity.dot(flankNormal),
      leadConstraintError,
      lowerGuideCoverage,
      phase,
      rackAcceleration,
      rackDisplacement,
      rackFlankVelocity,
      rackSpeed,
      radialNormal,
      radialNormalVelocityError: relativeContactVelocity.dot(radialNormal),
      relativeContactVelocity,
      slidingSpeedAlongThread: relativeContactVelocity.dot(threadTangent),
      stage,
      threadPhaseError,
      threadTangent,
      upperGuideCoverage,
      wormAngle,
      wormAngularAcceleration,
      wormAngularSpeed,
      wormSurfaceVelocity,
    };
  };
  const stateAtTime = (time) => stateAtPhase(
    cycleAngularFrequency * time,
  );

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.59,
  });
  const threadMaterial = matte(0xb74633, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.61,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const worm = new THREE.Group();
  worm.position.x = wormAxisX;
  worm.userData.axis = Y_AXIS.clone();
  worm.userData.role = 'fixed-axis-vertical-driver-worm';
  const wormRotor = new THREE.Group();
  wormRotor.userData.axis = Y_AXIS.clone();
  wormRotor.userData.role = 'right-hand-single-start-worm-rotor';
  worm.add(wormRotor);
  root.add(worm);

  const wormShaft = cylinderAlongY(
    wormShaftRadius,
    wormShaftMaximumY - wormShaftMinimumY,
    darkMaterial,
    36,
  );
  wormShaft.position.y = (wormShaftMaximumY + wormShaftMinimumY) / 2;
  wormShaft.userData.role = 'worm-input-shaft-through-fixed-bearings';
  const wormCore = cylinderAlongY(
    wormCoreRadius,
    wormThreadMaximumY - wormThreadMinimumY + 0.16,
    driverMaterial,
    48,
  );
  wormCore.userData.role = 'solid-cylindrical-worm-core';
  const wormThreadCurve = verticalHelixCurve({
    maximumY: wormThreadMaximumY,
    minimumY: wormThreadMinimumY,
    phase: sourceThreadPhase,
    radius: wormThreadRadius,
    waveNumber: wormWaveNumber,
  });
  const wormThreadTurns = (
    wormThreadMaximumY - wormThreadMinimumY
  ) / wormLead;
  const wormThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      wormThreadCurve,
      Math.ceil(wormThreadTurns * 72),
      wormThreadTubeRadius,
      10,
      false,
    ),
    threadMaterial,
  );
  wormThread.userData.handedness = wormHandedness;
  wormThread.userData.lead = wormLead;
  wormThread.userData.role =
    'one-continuous-right-hand-worm-thread-one-rack-pitch-lead';
  const collars = [-1, 1].map((side) => {
    const collar = cylinderAlongY(0.22, 0.19, darkMaterial, 36);
    collar.position.y = side * 1.64;
    collar.userData.role = side > 0
      ? 'upper-worm-shaft-collar'
      : 'lower-worm-shaft-collar';
    wormRotor.add(collar);
    return collar;
  });
  const rotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.052, 0.16, 0.045),
    whiteMaterial,
  );
  rotationIndex.position.set(wormCoreRadius + 0.025, 1.64, 0);
  rotationIndex.userData.role = 'white-worm-rotation-index';
  const threadIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 24, 16),
    whiteMaterial,
  );
  threadIndex.position.set(
    -wormThreadRadius,
    sourceContactThreadCenterY,
    0,
  );
  threadIndex.userData.role = 'white-index-on-active-worm-thread-turn';
  wormRotor.add(
    rotationIndex,
    threadIndex,
    wormCore,
    wormShaft,
    wormThread,
  );

  const rack = new THREE.Group();
  rack.userData.axis = Y_AXIS.clone();
  rack.userData.role = 'nonrotating-vertically-translating-rack';
  root.add(rack);
  const rackSpine = new THREE.Mesh(
    new THREE.BoxGeometry(
      rackSpineWidth,
      rackSpineLength,
      rackSpineDepth,
    ),
    drivenMaterial,
  );
  rackSpine.position.set(
    rackSpineCenterX,
    (rackSpineTopY + rackSpineBottomY) / 2,
    0,
  );
  rackSpine.userData.role = 'straight-rack-backbone';
  rack.add(rackSpine);

  const rackTeeth = rackToothIndices.map((toothIndex) => {
    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(
        rackToothLength,
        rackToothThickness,
        rackToothDepth,
      ),
      drivenMaterial,
    );
    tooth.position.set(
      (rackToothStartX + rackToothTipX) / 2,
      sourceActiveToothY + toothIndex * rackToothPitch,
      0,
    );
    tooth.userData.index = toothIndex;
    tooth.userData.pitch = rackToothPitch;
    tooth.userData.role = `equal-pitch-rack-tooth-${toothIndex + 5}`;
    rack.add(tooth);
    return tooth;
  });
  const translationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      rackSpineWidth + 0.035,
      0.34,
      0.035,
    ),
    whiteMaterial,
  );
  translationIndex.position.set(rackSpineCenterX, 2.24, 0.23);
  translationIndex.userData.role = 'white-rack-translation-index';
  const contactIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.028, 0.13),
    whiteMaterial,
  );
  contactIndex.position.set(
    wormAxisX - wormThreadRadius,
    sourceActiveToothY + rackToothHalfThickness + 0.016,
    0.13,
  );
  contactIndex.userData.role = 'white-index-on-active-rack-flank';
  rack.add(contactIndex, translationIndex);

  const rackGuides = [
    { role: 'fixed-upper-straight-rack-guide', y: upperRackGuideY },
    { role: 'fixed-lower-straight-rack-guide', y: lowerRackGuideY },
  ].map(({ role, y }) => {
    const guide = makeRackGuide({
      depth: guideDepth,
      guideClearance,
      guideMaterial: frameMaterial,
      guideThickness,
      rackDepth: rackSpineDepth,
      rackSpineCenterX,
      rackSpineWidth,
      role,
      y,
    });
    root.add(guide);
    return guide;
  });

  const bearingYs = [-1.72, 1.72];
  const wormBearings = bearingYs.map((y, index) => {
    const bearing = new THREE.Group();
    bearing.position.set(wormAxisX, y, 0);
    bearing.userData.role = index === 0
      ? 'fixed-lower-worm-bearing'
      : 'fixed-upper-worm-bearing';
    const collar = torusAroundY(0.22, 0.06, frameMaterial);
    const post = makeBeam(
      new THREE.Vector3(0, 0, -0.18),
      new THREE.Vector3(0, 0, -1.02),
      { color: PALETTE.frame, depth: 0.17, thickness: 0.14 },
    );
    bearing.add(collar, post);
    root.add(bearing);
    return bearing;
  });
  const rearPost = makeBeam(
    new THREE.Vector3(wormAxisX, -2.36, -1.02),
    new THREE.Vector3(wormAxisX, 2.36, -1.02),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.18 },
  );
  rearPost.userData.role = 'fixed-rear-post-carrying-both-worm-bearings';
  const base = makeBeam(
    new THREE.Vector3(-1.55, -3.18, -1.02),
    new THREE.Vector3(2.20, -3.18, -1.02),
    { color: PALETTE.frame, depth: 0.28, thickness: 0.20 },
  );
  base.userData.role = 'fixed-worm-rack-display-base';
  const baseStem = makeBeam(
    new THREE.Vector3(wormAxisX, -3.18, -1.02),
    new THREE.Vector3(wormAxisX, -2.36, -1.02),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.18 },
  );
  baseStem.userData.role = 'fixed-base-to-worm-bearing-post-stem';
  root.add(base, baseStem, rearPost);

  const sourceState = stateAtPhase(0);
  const sourceIdealizationPixelErrors = {
    rackBottom: new THREE.Vector2(
      rackSpineCenterX,
      rackSpineBottomY,
    ).distanceTo(sourcePointToModel(sourceRasterRackBottom)) / sourceScale,
    rackCenter: new THREE.Vector2(
      rackSpineCenterX,
      (rackSpineTopY + rackSpineBottomY) / 2,
    ).distanceTo(sourcePointToModel(sourceRasterRackSpineCenter))
      / sourceScale,
    rackToothTip: new THREE.Vector2(
      rackToothTipX,
      sourceState.activeToothCenterY,
    ).distanceTo(sourcePointToModel(sourceRasterRackToothTip))
      / sourceScale,
    rackTop: new THREE.Vector2(
      rackSpineCenterX,
      rackSpineTopY,
    ).distanceTo(sourcePointToModel(sourceRasterRackTop)) / sourceScale,
    wormShaftBottom: new THREE.Vector2(
      wormAxisX,
      wormShaftMinimumY,
    ).distanceTo(sourcePointToModel(sourceRasterWormShaftBottom))
      / sourceScale,
    wormShaftTop: new THREE.Vector2(
      wormAxisX,
      wormShaftMaximumY,
    ).distanceTo(sourcePointToModel(sourceRasterWormShaftTop))
      / sourceScale,
  };

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    base,
    baseStem,
    collars,
    contactIndex,
    rack,
    rackGuides,
    rackSpine,
    rackTeeth,
    rearPost,
    rotationIndex,
    threadIndex,
    translationIndex,
    worm,
    wormBearings,
    wormCore,
    wormRotor,
    wormShaft,
    wormThread,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.95, -3.42, -1.42),
    new THREE.Vector3(2.48, 4.52, 1.35),
  );
  root.userData.geometry = {
    cyclePeriod,
    guideClearance,
    guideDepth,
    guideThickness,
    leadPerRadian,
    lowerRackGuideY,
    maximumRackTravel,
    maximumWormAngle,
    rackSpineBottomY,
    rackSpineCenterX,
    rackSpineDepth,
    rackSpineLength,
    rackSpineTopY,
    rackSpineWidth,
    rackToothDepth,
    rackToothHalfThickness,
    rackToothIndices: [...rackToothIndices],
    rackToothLength,
    rackToothPitch,
    rackToothStartX,
    rackToothThickness,
    rackToothTipX,
    sourceActiveToothY,
    sourceContactThreadCenterY,
    sourceScale,
    sourceThreadPhase,
    upperRackGuideY,
    wormAxisX,
    wormCoreRadius,
    wormHandedness,
    wormLead,
    wormShaftMaximumY,
    wormShaftMinimumY,
    wormShaftRadius,
    wormThreadMaximumY,
    wormThreadMinimumY,
    wormThreadRadius,
    wormThreadTubeRadius,
    wormThreadTurns,
    threadFlankClearance,
    wormWaveNumber,
  };
  root.userData.mechanism =
    'one fixed-axis right-hand single-start vertical worm rotates beside a nonrotating vertical rack whose tooth pitch equals the worm lead; the helical phase constraint converts each complete worm revolution into exactly one rack-tooth-pitch of rectilinear travel';
  root.userData.movement = movement;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason:
      'The official Movement 275 page marks its animation control unavailable; the one-start worm lead, equal-pitch rack, sliding flank contact, and smooth forward-and-return demonstration were reconstructed independently from the public-domain engraving and description.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate275: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'one vertical fixed-axis worm, one parallel nonrotating translating rack, nine equal-pitch rack teeth, two worm bearings, and two straight rack guides',
      measurementUncertaintyPixels: 4,
      officialAnimationAvailable: false,
      rasterRackBottom: {
        x: sourceRasterRackBottom.x,
        y: sourceRasterRackBottom.y,
      },
      rasterRackSpineCenter: {
        x: sourceRasterRackSpineCenter.x,
        y: sourceRasterRackSpineCenter.y,
      },
      rasterRackToothTip: {
        x: sourceRasterRackToothTip.x,
        y: sourceRasterRackToothTip.y,
      },
      rasterRackTop: {
        x: sourceRasterRackTop.x,
        y: sourceRasterRackTop.y,
      },
      rasterWormAxisX: sourceRasterWormAxisX,
      rasterWormCenterY: sourceRasterWormCenterY,
      rasterWormShaftBottom: {
        x: sourceRasterWormShaftBottom.x,
        y: sourceRasterWormShaftBottom.y,
      },
      rasterWormShaftTop: {
        x: sourceRasterWormShaftTop.x,
        y: sourceRasterWormShaftTop.y,
      },
      sourceIdealizationPixelErrors,
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
  root.userData.stateAtPhase = stateAtPhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cycleAngularFrequency,
    cyclePeriod,
    maximumWormTurns: maximumWormAngle / FULL_TURN,
    sourcePhase: 0,
  };
  root.userData.transmission = {
    constraintLaw:
      'rackDisplacement = -(wormLead/(2*pi))*wormAngle for a right-hand one-start worm',
    cyclePeriod,
    rackTravelPerWormTurn: -wormLead,
    rackToothPitch,
    slidingContact: true,
    stateAtPhase,
    stateAtTime,
    wormLead,
    wormStarts: 1,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    wormRotor.rotation.y = state.wormAngle;
    worm.userData.angularAcceleration = state.wormAngularAcceleration;
    worm.userData.angularSpeed = state.wormAngularSpeed;
    rack.position.y = state.rackDisplacement;
    rack.userData.acceleration = new THREE.Vector3(
      0,
      state.rackAcceleration,
      0,
    );
    rack.userData.velocity = new THREE.Vector3(0, state.rackSpeed, 0);
    root.userData.contacts = {
      wormRackFlank: {
        activeRackTooth: rackTeeth[4],
        contactPoint: state.contactPoint.clone(),
        flankNormal: state.flankNormal.clone(),
        flankNormalVelocityError: state.flankNormalVelocityError,
        phaseError: state.threadPhaseError,
        radialNormal: state.radialNormal.clone(),
        radialNormalVelocityError: state.radialNormalVelocityError,
        slidingSpeed: state.slidingSpeedAlongThread,
        surfaceGap: state.contactSurfaceGap,
        threadTangent: state.threadTangent.clone(),
        wormThread,
      },
    };
    root.userData.kinematics = state;
  };
  correctWormRack(root);
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(1.8, 1.4, 12),
  };
}

export function createAuthoredWormRackMovement(movement) {
  if (movement.id !== 275) return null;
  const result = wormDrivenRack(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
