import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeGear,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function smootherStep(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped ** 3 * (
    clamped * (clamped * 6 - 15) + 10
  );
}

function smootherStepDerivative(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * clamped ** 2 * (1 - clamped) ** 2;
}

function smootherStepSecondDerivative(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * clamped * (1 - clamped) * (1 - 2 * clamped);
}

function axialRotor(axis) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.quaternion.setFromUnitVectors(Z_AXIS, axis.clone().normalize());
  root.userData.axis = axis.clone().normalize();
  root.userData.rotor = rotor;
  root.add(rotor);
  return { root, rotor };
}

function cylinderAlongLocalZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function axialHelixCurve({
  handedness,
  maximum,
  minimum,
  phase = 0,
  pitch,
  radius,
}) {
  const length = maximum - minimum;
  return new class extends THREE.Curve {
    getPoint(parameter, target = new THREE.Vector3()) {
      const axialPosition = minimum + length * parameter;
      const angle = phase + handedness
        * axialPosition / pitch * FULL_TURN;
      return target.set(
        radius * Math.cos(angle),
        radius * Math.sin(angle),
        axialPosition,
      );
    }
  }();
}

function worldXHelixCurve({
  handedness,
  maximum,
  minimum,
  phase,
  pitch,
  radius,
}) {
  const length = maximum - minimum;
  return new class extends THREE.Curve {
    getPoint(parameter, target = new THREE.Vector3()) {
      const axialPosition = minimum + length * parameter;
      const angle = phase + handedness
        * axialPosition / pitch * FULL_TURN;
      return target.set(
        axialPosition,
        radius * Math.cos(angle),
        radius * Math.sin(angle),
      );
    }
  }();
}

function rectangularAnnularGeometry({
  boreRadius,
  depth,
  halfHeight,
  halfWidth,
}) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, -halfHeight);
  shape.lineTo(halfWidth, -halfHeight);
  shape.lineTo(halfWidth, halfHeight);
  shape.lineTo(-halfWidth, halfHeight);
  shape.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, 0, boreRadius, 0, FULL_TURN, true);
  bore.closePath();
  shape.holes.push(bore);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.018,
    bevelThickness: 0.018,
    curveSegments: 48,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function torusAroundX(radius, tube, material, segments = 44) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 10, segments),
    material,
  );
  torus.rotation.y = Math.PI / 2;
  return torus;
}

function torusAroundY(radius, tube, material, segments = 44) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 10, segments),
    material,
  );
  torus.rotation.x = Math.PI / 2;
  return torus;
}

function makeTravelingNut({
  bodyDepth,
  bodyHeight,
  bodyWidth,
  handedness,
  indexMaterial,
  internalThreadRadius,
  material,
  name,
  sourceX,
  threadPitch,
  threadTubeRadius,
}) {
  const nut = new THREE.Group();
  nut.userData.axis = X_AXIS.clone();
  nut.userData.handedness = handedness;
  nut.userData.role = `${name}-nonrotating-traveling-nut`;

  const body = new THREE.Mesh(
    rectangularAnnularGeometry({
      boreRadius: internalThreadRadius + threadTubeRadius * 1.15,
      depth: bodyWidth,
      halfHeight: bodyHeight / 2,
      halfWidth: bodyDepth / 2,
    }),
    material,
  );
  body.rotation.y = Math.PI / 2;
  body.userData.role = `${name}-square-nut-body-with-real-through-bore`;

  const boreRings = [-1, 1].map((sideSign) => {
    const ring = torusAroundX(
      internalThreadRadius + threadTubeRadius * 1.3,
      0.026,
      matte(PALETTE.ink, { metalness: 0.23, roughness: 0.50 }),
      42,
    );
    ring.position.x = sideSign * (bodyWidth / 2 + 0.020);
    ring.userData.role = `${name}-dark-rim-around-threaded-bore`;
    ring.userData.side = sideSign < 0 ? 'left-face' : 'right-face';
    return ring;
  });

  const internalThreadCurve = worldXHelixCurve({
    handedness,
    maximum: bodyWidth / 2 + 0.035,
    minimum: -bodyWidth / 2 - 0.035,
    phase: handedness * sourceX / threadPitch * FULL_TURN,
    pitch: threadPitch,
    radius: internalThreadRadius,
  });
  const internalThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      internalThreadCurve,
      Math.ceil(bodyWidth / threadPitch * 64),
      threadTubeRadius,
      8,
      false,
    ),
    matte(PALETTE.ink, { metalness: 0.26, roughness: 0.47 }),
  );
  internalThread.userData.handedness = handedness;
  internalThread.userData.role = `${name}-matching-stationary-internal-thread`;

  const guideStem = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.40, 0.16),
    material,
  );
  guideStem.position.set(0, -bodyHeight / 2 - 0.18, -0.35);
  guideStem.userData.role = `${name}-fixed-orientation-guide-stem`;

  const guideShoe = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.92, 0.16, 0.34),
    matte(PALETTE.ink, { metalness: 0.22, roughness: 0.52 }),
  );
  guideShoe.position.set(0, -0.79, -0.49);
  guideShoe.userData.role = `${name}-shoe-sliding-on-fixed-straight-guide`;

  const translationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth * 0.62, 0.050, 0.030),
    indexMaterial,
  );
  translationIndex.position.set(
    0,
    bodyHeight * 0.28,
    bodyDepth / 2 + 0.045,
  );
  translationIndex.userData.role = `${name}-white-rectilinear-motion-index`;

  nut.add(
    body,
    ...boreRings,
    internalThread,
    guideStem,
    guideShoe,
    translationIndex,
  );
  return {
    body,
    boreRings,
    guideShoe,
    guideStem,
    internalThread,
    internalThreadCurve,
    nut,
    translationIndex,
  };
}

function makeInputWheel({
  darkMaterial,
  driverMaterial,
  indexMaterial,
  radius,
}) {
  const wheel = new THREE.Group();
  wheel.userData.role = 'handwheel-rigid-with-upper-worm-shaft';
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.075, 12, 56),
    driverMaterial,
  );
  rim.userData.role = 'source-circular-upper-input-rim';
  const hub = cylinderAlongLocalZ(0.17, 0.18, darkMaterial, 30);
  hub.userData.role = 'input-wheel-hub-on-worm-shaft';
  const spokes = Array.from({ length: 4 }, (_, index) => {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 1.42, 0.072, 0.090),
      darkMaterial,
    );
    spoke.rotation.z = index * Math.PI / 4;
    spoke.userData.role = 'input-wheel-radial-spoke';
    return spoke;
  });
  const index = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.18, 0.035),
    indexMaterial,
  );
  index.position.set(radius * 0.93, 0, 0.105);
  index.userData.role = 'white-fast-worm-input-index';
  wheel.add(rim, hub, ...spokes, index);
  return { hub, index, rim, spokes, wheel };
}

function opposedScrewNutsDrivenByWorm() {
  const root = new THREE.Group();

  // Pixel landmarks were read from the 525 px source engraving. The common
  // horizontal screw axis is the datum; small drafting offsets are projected
  // back onto that exact axis rather than built into the mechanism.
  const sourceScale = 0.014;
  const sourceScrewAxis = new THREE.Vector2(270, 268);
  const sourceWheelCenter = new THREE.Vector2(270, 268);
  const sourceLeftNut = new THREE.Vector2(46, 269);
  const sourceRightNut = new THREE.Vector2(478, 267);
  const sourceInputCenter = new THREE.Vector2(269, 119);
  const sourceShaftLeftEnd = new THREE.Vector2(13, 268);
  const sourceShaftRightEnd = new THREE.Vector2(519, 268);
  const sourceWormBottom = new THREE.Vector2(269, 329);
  const fromSource = (point) => new THREE.Vector2(
    (point.x - sourceScrewAxis.x) * sourceScale,
    (sourceScrewAxis.y - point.y) * sourceScale,
  );

  const screwAxisY = 0;
  const screwAxisZ = 0;
  const sourceLeftNutMapped = fromSource(sourceLeftNut);
  const sourceRightNutMapped = fromSource(sourceRightNut);
  const sourceInputMapped = fromSource(sourceInputCenter);
  const sourceWormBottomMapped = fromSource(sourceWormBottom);
  const leftSourceX = sourceLeftNutMapped.x;
  const rightSourceX = sourceRightNutMapped.x;
  const inputCenterY = sourceInputMapped.y;
  const screwMinimumX = fromSource(sourceShaftLeftEnd).x;
  const screwMaximumX = fromSource(sourceShaftRightEnd).x;
  const screwLength = screwMaximumX - screwMinimumX;
  const screwCenterX = 0;

  const wheelTeeth = 16;
  const wheelPitchRadius = 0.54;
  const wheelToothHeight = 0.124;
  const wheelOuterRadius = wheelPitchRadius + wheelToothHeight / 2;
  const wheelRootRadius = wheelPitchRadius - wheelToothHeight / 2;
  const wheelDepth = 0.56;
  const wheelToothPitchAngle = FULL_TURN / wheelTeeth;
  const wheelToothReferenceAngle = -0.75 * Math.PI / wheelTeeth;

  const wormStarts = 1;
  const wormHandedness = -1;
  const wormLead = FULL_TURN * wheelPitchRadius / wheelTeeth;
  const wormPitch = wormLead / wormStarts;
  const wormLeadPerRadian = wormLead / FULL_TURN;
  const wormPitchRadius = 0.18;
  const wormThreadTubeRadius = 0.044;
  const wormCoreRadius = 0.105;
  const wormMinimumY = sourceWormBottomMapped.y;
  const wormMaximumY = 1.70;
  const wormLength = wormMaximumY - wormMinimumY;
  const wormCenterY = (wormMaximumY + wormMinimumY) / 2;
  const wormTurnCount = wormLength / wormPitch;
  const wormSegmentsPerTurn = 52;
  const wormThreadSegments = Math.ceil(
    wormTurnCount * wormSegmentsPerTurn
  );
  const wormAxisZ = wheelPitchRadius + wormPitchRadius;
  const pitchContactPoint = new THREE.Vector3(
    0,
    screwAxisY,
    wheelPitchRadius,
  );

  const threadPitch = 0.46;
  const threadLead = threadPitch;
  const threadLeadPerRadian = threadLead / FULL_TURN;
  const threadWaveNumber = FULL_TURN / threadPitch;
  const threadCoreRadius = 0.135;
  const threadPitchRadius = 0.22;
  const externalThreadTubeRadius = 0.044;
  const internalThreadRadius = threadPitchRadius + 0.035;
  const internalThreadTubeRadius = 0.022;
  const leftThreadMinimumX = -3.48;
  const leftThreadMaximumX = -0.72;
  const rightThreadMinimumX = 0.72;
  const rightThreadMaximumX = 3.36;
  const threadSegmentsPerTurn = 58;
  const nutBodyWidth = 0.62;
  const nutBodyHeight = 0.80;
  const nutBodyDepth = 0.72;
  const nutTravel = 1.70;
  const leftInnerX = leftSourceX + nutTravel;
  const rightInnerX = rightSourceX - nutTravel;
  const sourceNutMidpointX = (leftSourceX + rightSourceX) / 2;
  const sourceNutSeparation = rightSourceX - leftSourceX;
  const innerNutSeparation = rightInnerX - leftInnerX;

  const cyclePeriod = 36;
  const inwardPhaseEnd = 0.43;
  const innerDwellPhaseEnd = 0.50;
  const outwardPhaseEnd = 0.93;
  const inputAngleTravel = nutTravel * wheelTeeth / threadLeadPerRadian;
  const inputTurnsTravel = inputAngleTravel / FULL_TURN;
  const screwAngleTravel = -inputAngleTravel / wheelTeeth;
  const screwTurnsTravel = screwAngleTravel / FULL_TURN;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.15,
    roughness: 0.57,
  });
  const driverThreadMaterial = matte(0xb94734, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.58,
  });
  const drivenThreadMaterial = matte(0x254f68, {
    metalness: 0.20,
    roughness: 0.50,
  });
  const nutMaterial = matte(PALETTE.accent, {
    metalness: 0.14,
    roughness: 0.60,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.70,
  });
  const indexMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const screwAssembly = axialRotor(X_AXIS);
  const screw = screwAssembly.root;
  const screwRotor = screwAssembly.rotor;
  screw.position.set(screwCenterX, screwAxisY, screwAxisZ);
  screw.userData.role = 'one-rigid-horizontal-opposite-hand-screw-shaft';
  screwRotor.userData.role = 'worm-wheel-and-both-screw-threads-common-rotor';

  const shaftCore = cylinderAlongLocalZ(
    threadCoreRadius,
    screwLength,
    drivenMaterial,
    42,
  );
  shaftCore.position.z = (screwMinimumX + screwMaximumX) / 2 - screwCenterX;
  shaftCore.userData.role = 'continuous-core-through-both-thread-hands';

  const threadConfigs = [
    {
      handedness: 1,
      maximum: leftThreadMaximumX,
      minimum: leftThreadMinimumX,
      name: 'left-side-right-hand',
    },
    {
      handedness: -1,
      maximum: rightThreadMaximumX,
      minimum: rightThreadMinimumX,
      name: 'right-side-left-hand',
    },
  ];
  const externalThreadRecords = threadConfigs.map((config) => {
    const curve = axialHelixCurve({
      handedness: config.handedness,
      maximum: config.maximum - screwCenterX,
      minimum: config.minimum - screwCenterX,
      phase: Math.PI / 2 + config.handedness
        * screwCenterX / threadPitch * FULL_TURN,
      pitch: threadPitch,
      radius: threadPitchRadius,
    });
    const turns = (config.maximum - config.minimum) / threadPitch;
    const thread = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        Math.ceil(turns * threadSegmentsPerTurn),
        externalThreadTubeRadius,
        8,
        false,
      ),
      drivenThreadMaterial,
    );
    thread.userData.handedness = config.handedness;
    thread.userData.role = `${config.name}-external-screw-thread`;
    thread.userData.screwThread = true;
    screwRotor.add(thread);
    return { ...config, curve, thread, turns };
  });

  const wheel = makeGear({
    color: PALETTE.driven,
    depth: wheelDepth,
    radius: wheelPitchRadius,
    teeth: wheelTeeth,
    toothHeight: wheelToothHeight,
  });
  wheel.rotation.z = wheelToothReferenceAngle;
  wheel.userData.role = 'central-worm-wheel-rigid-with-opposed-screw-shaft';
  const wheelRotor = wheel.userData.rotor;
  const wheelRotationIndex = wheelRotor.children.at(-1);
  wheelRotationIndex.userData.role = 'white-slow-screw-shaft-rotation-index';

  const shaftRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.050, 0.060, 0.48),
    indexMaterial,
  );
  shaftRotationIndex.position.set(
    0,
    threadPitchRadius + 0.060,
    screwMaximumX - screwCenterX - 0.42,
  );
  shaftRotationIndex.userData.role = 'white-index-on-common-screw-shaft';

  const shaftTips = [-1, 1].map((sideSign) => {
    const tip = cylinderAlongLocalZ(0.085, 0.24, darkMaterial, 26);
    const endX = sideSign < 0 ? screwMinimumX : screwMaximumX;
    tip.position.z = endX - screwCenterX + sideSign * 0.10;
    tip.userData.role = 'projecting-end-of-common-screw-shaft';
    tip.userData.side = sideSign < 0 ? 'left' : 'right';
    return tip;
  });
  screwRotor.add(
    shaftCore,
    wheel,
    shaftRotationIndex,
    ...shaftTips,
  );

  const wormAssembly = axialRotor(Y_AXIS);
  const worm = wormAssembly.root;
  const wormRotor = wormAssembly.rotor;
  worm.position.set(0, 0, wormAxisZ);
  worm.userData.role = 'single-start-upper-worm-on-perpendicular-fixed-axis';
  wormRotor.userData.role = 'continuous-upper-input-worm-rotor';

  const wormCore = cylinderAlongLocalZ(
    wormCoreRadius,
    inputCenterY - wormMinimumY + 0.18,
    driverMaterial,
    38,
  );
  wormCore.position.z = (inputCenterY + wormMinimumY) / 2 - 0.02;
  wormCore.userData.role = 'solid-core-of-vertical-upper-worm-shaft';

  const wormThreadCurve = axialHelixCurve({
    handedness: wormHandedness,
    maximum: wormMaximumY,
    minimum: wormMinimumY,
    phase: Math.PI / 2,
    pitch: wormPitch,
    radius: wormPitchRadius,
  });
  const wormThread = new THREE.Mesh(
    new THREE.TubeGeometry(
      wormThreadCurve,
      wormThreadSegments,
      wormThreadTubeRadius,
      8,
      false,
    ),
    driverThreadMaterial,
  );
  wormThread.userData.handedness = wormHandedness;
  wormThread.userData.role = 'one-continuous-single-start-left-hand-worm-thread';
  wormThread.userData.screwThread = true;

  const inputWheel = makeInputWheel({
    darkMaterial,
    driverMaterial,
    indexMaterial,
    radius: 0.52,
  });
  inputWheel.wheel.position.z = inputCenterY;
  wormRotor.add(wormCore, wormThread, inputWheel.wheel);

  const nutRecords = [
    {
      handedness: 1,
      name: 'left',
      sourcePoint: sourceLeftNut,
      sourceX: leftSourceX,
    },
    {
      handedness: -1,
      name: 'right',
      sourcePoint: sourceRightNut,
      sourceX: rightSourceX,
    },
  ].map((config) => ({
    ...config,
    ...makeTravelingNut({
      bodyDepth: nutBodyDepth,
      bodyHeight: nutBodyHeight,
      bodyWidth: nutBodyWidth,
      handedness: config.handedness,
      indexMaterial,
      internalThreadRadius,
      material: nutMaterial,
      name: config.name,
      sourceX: config.sourceX,
      threadPitch,
      threadTubeRadius: internalThreadTubeRadius,
    }),
  }));

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-bearings-and-straight-nut-guide-frame';
  const baseY = -1.43;
  const baseRails = [-1, 1].map((sideSign) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(8.25, 0.18, 0.20),
      frameMaterial,
    );
    rail.position.set(-0.02, baseY, sideSign < 0 ? -0.87 : 1.33);
    rail.userData.role = 'fixed-longitudinal-base-rail';
    rail.userData.side = sideSign < 0 ? 'rear' : 'front';
    return rail;
  });
  const baseTies = [-3.92, 3.82].map((x, index) => {
    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.18, 2.40),
      frameMaterial,
    );
    tie.position.set(x, baseY, 0.23);
    tie.userData.role = 'fixed-transverse-base-tie';
    tie.userData.side = index === 0 ? 'left' : 'right';
    return tie;
  });
  const screwBearingX = 3.72;
  const screwBearingPosts = [-1, 1].map((sideSign) => {
    const postHeight = -baseY;
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, postHeight, 0.26),
      frameMaterial,
    );
    post.position.set(sideSign * screwBearingX, baseY / 2, 0);
    post.userData.role = 'fixed-bearing-post-for-common-screw-shaft';
    post.userData.side = sideSign < 0 ? 'left' : 'right';
    return post;
  });
  const screwBearings = [-1, 1].map((sideSign) => {
    const bearing = torusAroundX(0.23, 0.052, darkMaterial, 42);
    bearing.position.set(sideSign * screwBearingX, 0, 0);
    bearing.userData.role = 'fixed-radial-bearing-for-common-screw-shaft';
    bearing.userData.side = sideSign < 0 ? 'left' : 'right';
    return bearing;
  });
  const nutGuideRail = new THREE.Mesh(
    new THREE.BoxGeometry(6.95, 0.12, 0.16),
    frameMaterial,
  );
  nutGuideRail.position.set(sourceNutMidpointX, -0.82, -0.49);
  nutGuideRail.userData.role = 'fixed-straight-guide-preventing-both-nuts-from-rotating';
  const guideSupports = [-3.52, 3.42].map((x, index) => {
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.62, 0.16),
      frameMaterial,
    );
    support.position.set(x, -1.10, -0.49);
    support.userData.role = 'fixed-support-under-nut-guide';
    support.userData.side = index === 0 ? 'left' : 'right';
    return support;
  });

  const wormSupportX = 0.82;
  const wormSupportZ = 1.04;
  const wormSupportTopY = 1.82;
  const wormSupportPost = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.22,
      wormSupportTopY - baseY,
      0.22,
    ),
    frameMaterial,
  );
  wormSupportPost.position.set(
    wormSupportX,
    (wormSupportTopY + baseY) / 2,
    wormSupportZ,
  );
  wormSupportPost.userData.role = 'fixed-upright-carrying-upper-worm-bearings';
  const wormBearingYs = [wormMinimumY - 0.04, 1.74];
  const wormBearingArms = wormBearingYs.map((y, index) => {
    const arm = makeBeam(
      new THREE.Vector3(wormSupportX, y, wormSupportZ),
      new THREE.Vector3(0, y, wormAxisZ),
      { color: PALETTE.frame, depth: 0.18, thickness: 0.15 },
    );
    arm.userData.role = 'fixed-cross-arm-to-upper-worm-bearing';
    arm.userData.side = index === 0 ? 'lower' : 'upper';
    return arm;
  });
  const wormBearings = wormBearingYs.map((y, index) => {
    const bearing = torusAroundY(0.20, 0.050, darkMaterial, 42);
    bearing.position.set(0, y, wormAxisZ);
    bearing.userData.role = 'fixed-bearing-for-perpendicular-upper-worm';
    bearing.userData.side = index === 0 ? 'lower' : 'upper';
    return bearing;
  });
  fixedFrame.add(
    ...baseRails,
    ...baseTies,
    ...screwBearingPosts,
    ...screwBearings,
    nutGuideRail,
    ...guideSupports,
    wormSupportPost,
    ...wormBearingArms,
    ...wormBearings,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(9.0, 5.6, 4.1),
    new THREE.MeshBasicMaterial({
      color: PALETTE.paper,
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(-0.04, 0.20, 0.20);
  cameraEnvelope.userData.cameraFitGuide = true;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-source-and-full-nut-travel-envelope';

  root.add(
    cameraEnvelope,
    fixedFrame,
    screw,
    worm,
    ...nutRecords.map(({ nut }) => nut),
  );

  const motionAtTime = (time) => {
    const cycleIndex = Math.floor(time / cyclePeriod);
    const cycleTime = time - cycleIndex * cyclePeriod;
    const phase = cycleTime / cyclePeriod;
    let inputAngle;
    let inputAngularAcceleration;
    let inputAngularSpeed;
    let stage;
    if (phase < inwardPhaseEnd) {
      const duration = cyclePeriod * inwardPhaseEnd;
      const progress = phase / inwardPhaseEnd;
      inputAngle = inputAngleTravel * smootherStep(progress);
      inputAngularSpeed = inputAngleTravel
        * smootherStepDerivative(progress) / duration;
      inputAngularAcceleration = inputAngleTravel
        * smootherStepSecondDerivative(progress) / duration ** 2;
      stage = 'worm-turning-forward-nuts-approaching';
    } else if (phase < innerDwellPhaseEnd) {
      inputAngle = inputAngleTravel;
      inputAngularSpeed = 0;
      inputAngularAcceleration = 0;
      stage = 'inner-travel-limit-dwell';
    } else if (phase < outwardPhaseEnd) {
      const duration = cyclePeriod * (
        outwardPhaseEnd - innerDwellPhaseEnd
      );
      const progress = (phase - innerDwellPhaseEnd)
        / (outwardPhaseEnd - innerDwellPhaseEnd);
      inputAngle = inputAngleTravel * (1 - smootherStep(progress));
      inputAngularSpeed = -inputAngleTravel
        * smootherStepDerivative(progress) / duration;
      inputAngularAcceleration = -inputAngleTravel
        * smootherStepSecondDerivative(progress) / duration ** 2;
      stage = 'worm-reversed-nuts-separating';
    } else {
      inputAngle = 0;
      inputAngularSpeed = 0;
      inputAngularAcceleration = 0;
      stage = 'source-open-limit-dwell';
    }
    return {
      cycleIndex,
      cycleTime,
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed,
      phase,
      stage,
    };
  };

  const stateFromInput = ({
    cycleIndex = 0,
    cycleTime = 0,
    inputAngle,
    inputAngularAcceleration,
    inputAngularSpeed,
    phase = 0,
    stage = 'steady-one-direction-operation',
  }) => {
    const screwAngle = -inputAngle * wormStarts / wheelTeeth;
    const screwAngularSpeed = -inputAngularSpeed
      * wormStarts / wheelTeeth;
    const screwAngularAcceleration = -inputAngularAcceleration
      * wormStarts / wheelTeeth;
    const nutStates = nutRecords.map((record) => {
      const nutX = record.sourceX - record.handedness
        * threadLeadPerRadian * screwAngle;
      const nutVelocityX = -record.handedness
        * threadLeadPerRadian * screwAngularSpeed;
      const nutAccelerationX = -record.handedness
        * threadLeadPerRadian * screwAngularAcceleration;
      const contactPhase = record.handedness
        * threadWaveNumber * record.sourceX;
      const contactCosine = Math.cos(contactPhase);
      const contactSine = Math.sin(contactPhase);
      const threadContactPoint = new THREE.Vector3(
        nutX,
        threadPitchRadius * contactCosine,
        threadPitchRadius * contactSine,
      );
      const radialNormal = new THREE.Vector3(
        0,
        contactCosine,
        contactSine,
      );
      const circumferentialTangent = new THREE.Vector3(
        0,
        -contactSine,
        contactCosine,
      );
      const helixSlope = record.handedness
        * threadWaveNumber * threadPitchRadius;
      const helixTangent = new THREE.Vector3(
        1,
        helixSlope * circumferentialTangent.y,
        helixSlope * circumferentialTangent.z,
      ).normalize();
      const flankNormal = new THREE.Vector3(
        -helixSlope,
        circumferentialTangent.y,
        circumferentialTangent.z,
      ).normalize();
      const screwSurfaceVelocity = new THREE.Vector3(
        0,
        -screwAngularSpeed * threadContactPoint.z,
        screwAngularSpeed * threadContactPoint.y,
      );
      const nutVelocity = new THREE.Vector3(nutVelocityX, 0, 0);
      const relativeThreadVelocity = screwSurfaceVelocity.clone().sub(
        nutVelocity
      );
      const phaseConstraintError = record.handedness
        * threadWaveNumber * (nutX - record.sourceX) + screwAngle;
      const phaseVelocityError = record.handedness
        * threadWaveNumber * nutVelocityX + screwAngularSpeed;
      const phaseAccelerationError = record.handedness
        * threadWaveNumber * nutAccelerationX + screwAngularAcceleration;
      return {
        contactPhase,
        circumferentialTangent,
        flankNormal,
        flankNormalVelocityError: relativeThreadVelocity.dot(flankNormal),
        guideLineError: 0,
        handedness: record.handedness,
        helixTangent,
        name: record.name,
        nutAccelerationX,
        nutRotation: 0,
        nutVelocity,
        nutVelocityX,
        nutX,
        phaseAccelerationError,
        phaseConstraintError,
        phaseVelocityError,
        radialNormal,
        radialNormalVelocityError: relativeThreadVelocity.dot(radialNormal),
        relativeThreadVelocity,
        screwSurfaceVelocity,
        sourceX: record.sourceX,
        threadContactPoint,
        threadSlidingSpeed: relativeThreadVelocity.dot(helixTangent),
      };
    });
    const [leftNutState, rightNutState] = nutStates;
    const nutSeparation = rightNutState.nutX - leftNutState.nutX;
    const nutMidpointX = (
      leftNutState.nutX + rightNutState.nutX
    ) / 2;
    const wormThreadAxialSpeed = wormLeadPerRadian
      * inputAngularSpeed;
    const wormThreadAxialAcceleration = wormLeadPerRadian
      * inputAngularAcceleration;
    const wheelContactAxialSpeed = -screwAngularSpeed
      * wheelPitchRadius;
    const wheelContactAxialAcceleration = -screwAngularAcceleration
      * wheelPitchRadius;
    const wormContactPoint = new THREE.Vector3(
      0,
      screwAxisY,
      wormAxisZ - wormPitchRadius,
    );
    const wheelContactPoint = new THREE.Vector3(
      0,
      screwAxisY,
      wheelPitchRadius,
    );
    return {
      cycleIndex,
      cycleTime,
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed,
      inputRevolutions: inputAngle / FULL_TURN,
      leftNut: leftNutState,
      meshCenterDistanceError: wormAxisZ
        - wheelPitchRadius - wormPitchRadius,
      meshPhaseAccelerationError: inputAngularAcceleration * wormStarts
        + wheelTeeth * screwAngularAcceleration,
      meshPhaseError: inputAngle * wormStarts + wheelTeeth * screwAngle,
      meshPhaseVelocityError: inputAngularSpeed * wormStarts
        + wheelTeeth * screwAngularSpeed,
      meshPointError: wormContactPoint.distanceTo(wheelContactPoint),
      meshTangentialAccelerationError: wormThreadAxialAcceleration
        - wheelContactAxialAcceleration,
      meshTangentialVelocityError: wormThreadAxialSpeed
        - wheelContactAxialSpeed,
      nutMidpointError: nutMidpointX - sourceNutMidpointX,
      nutMidpointX,
      nutSeparation,
      nutSeparationAcceleration: rightNutState.nutAccelerationX
        - leftNutState.nutAccelerationX,
      nutSeparationVelocity: rightNutState.nutVelocityX
        - leftNutState.nutVelocityX,
      nutStates,
      phase,
      pitchContactPoint: pitchContactPoint.clone(),
      rightNut: rightNutState,
      screwAngle,
      screwAngularAcceleration,
      screwAngularSpeed,
      screwAxialDisplacement: 0,
      screwRevolutions: screwAngle / FULL_TURN,
      stage,
      wheelContactAxialAcceleration,
      wheelContactAxialSpeed,
      wheelContactPoint,
      wormContactPoint,
      wormThreadAxialAcceleration,
      wormThreadAxialSpeed,
    };
  };

  const stateAtTime = (time) => stateFromInput(motionAtTime(time));
  const stateAtCyclePhase = (phase) => stateAtTime(phase * cyclePeriod);
  const operatingStateAtInputAngle = (
    inputAngle,
    inputAngularSpeed = FULL_TURN * 2.4,
  ) => stateFromInput({
    inputAngle,
    inputAngularAcceleration: 0,
    inputAngularSpeed,
  });

  root.userData.mechanism =
    'single-start-perpendicular-worm-wheel-opposite-hand-screw-two-guided-nuts';
  root.userData.blocks = {
    baseRails,
    baseTies,
    cameraEnvelope,
    externalThreadRecords,
    fixedFrame,
    guideSupports,
    inputWheel,
    nutGuideRail,
    nutRecords,
    screw,
    screwBearingPosts,
    screwBearings,
    screwRotor,
    shaftCore,
    shaftRotationIndex,
    shaftTips,
    wheel,
    wheelRotationIndex,
    wheelRotor,
    worm,
    wormBearingArms,
    wormBearings,
    wormCore,
    wormRotor,
    wormSupportPost,
    wormThread,
  };
  root.userData.canonicalStates = {
    halfwayInward: stateAtCyclePhase(0.215),
    halfwayOutward: stateAtCyclePhase(0.715),
    innerLimit: stateAtCyclePhase(0.465),
    source: stateAtCyclePhase(0),
  };
  root.userData.curves = {
    externalThreads: externalThreadRecords.map(({ curve }) => curve),
    internalThreads: nutRecords.map(({ internalThreadCurve }) => (
      internalThreadCurve
    )),
    wormThread: wormThreadCurve,
  };
  root.userData.geometry = {
    axis: X_AXIS.clone(),
    baseY,
    cyclePeriod,
    externalThreadTubeRadius,
    fixedWormAxis: Y_AXIS.clone(),
    innerDwellPhaseEnd,
    innerNutSeparation,
    inputAngleTravel,
    inputCenterY,
    inputTurnsTravel,
    internalThreadRadius,
    internalThreadTubeRadius,
    inwardPhaseEnd,
    leftInnerX,
    leftSourceX,
    leftThreadMaximumX,
    leftThreadMinimumX,
    nutBodyDepth,
    nutBodyHeight,
    nutBodyWidth,
    nutTravel,
    outwardPhaseEnd,
    pitchContactPoint: pitchContactPoint.clone(),
    rightInnerX,
    rightSourceX,
    rightThreadMaximumX,
    rightThreadMinimumX,
    screwAngleTravel,
    screwAxisY,
    screwAxisZ,
    screwBearingX,
    screwCenterX,
    screwLength,
    screwMaximumX,
    screwMinimumX,
    screwTurnsTravel,
    sourceInputCenter: sourceInputCenter.clone(),
    sourceInputMapped: sourceInputMapped.clone(),
    sourceInputProjectionError: Math.abs(sourceInputMapped.x),
    sourceLeftNut: sourceLeftNut.clone(),
    sourceLeftNutMapped: sourceLeftNutMapped.clone(),
    sourceLeftNutProjectionError: Math.abs(sourceLeftNutMapped.y),
    sourceNutMidpointX,
    sourceNutSeparation,
    sourceRightNut: sourceRightNut.clone(),
    sourceRightNutMapped: sourceRightNutMapped.clone(),
    sourceRightNutProjectionError: Math.abs(sourceRightNutMapped.y),
    sourceScale,
    sourceScrewAxis: sourceScrewAxis.clone(),
    sourceShaftLeftEnd: sourceShaftLeftEnd.clone(),
    sourceShaftRightEnd: sourceShaftRightEnd.clone(),
    sourceWheelCenter: sourceWheelCenter.clone(),
    sourceWormBottom: sourceWormBottom.clone(),
    sourceWormBottomMapped: sourceWormBottomMapped.clone(),
    threadConfigs,
    threadCoreRadius,
    threadLead,
    threadLeadPerRadian,
    threadPitch,
    threadPitchRadius,
    threadSegmentsPerTurn,
    threadWaveNumber,
    wheelDepth,
    wheelOuterRadius,
    wheelPitchRadius,
    wheelRootRadius,
    wheelTeeth,
    wheelToothHeight,
    wheelToothPitchAngle,
    wheelToothReferenceAngle,
    wormAxisZ,
    wormCenterY,
    wormCoreRadius,
    wormHandedness,
    wormLead,
    wormLeadPerRadian,
    wormLength,
    wormMaximumY,
    wormMinimumY,
    wormPitch,
    wormPitchRadius,
    wormSegmentsPerTurn,
    wormStarts,
    wormThreadSegments,
    wormThreadTubeRadius,
    wormTurnCount,
  };
  root.userData.motionAtTime = motionAtTime;
  root.userData.operatingStateAtInputAngle = operatingStateAtInputAngle;
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    wormRotor.rotation.z = state.inputAngle;
    screwRotor.rotation.z = state.screwAngle;
    for (let index = 0; index < nutRecords.length; index += 1) {
      const record = nutRecords[index];
      const nutState = state.nutStates[index];
      record.nut.position.set(
        nutState.nutX,
        screwAxisY,
        screwAxisZ,
      );
      record.nut.rotation.set(0, 0, 0);
      record.nut.userData.velocity = nutState.nutVelocity.clone();
      record.nut.userData.acceleration = new THREE.Vector3(
        nutState.nutAccelerationX,
        0,
        0,
      );
    }
    worm.userData.angularSpeed = state.inputAngularSpeed;
    screw.userData.angularSpeed = state.screwAngularSpeed;
    wheel.userData.angularSpeed = state.screwAngularSpeed;
    root.userData.contacts = {
      nutGuides: state.nutStates.map((nutState) => ({
        axis: X_AXIS.clone(),
        lineError: nutState.guideLineError,
        name: nutState.name,
        rotationError: nutState.nutRotation,
      })),
      screwBearings: {
        axialDisplacementError: state.screwAxialDisplacement,
        axis: X_AXIS.clone(),
        radialClearance: 0.23 - threadCoreRadius,
      },
      threadMeshes: state.nutStates.map((nutState) => ({
        contactPoint: nutState.threadContactPoint.clone(),
        flankNormal: nutState.flankNormal.clone(),
        flankNormalVelocityError: nutState.flankNormalVelocityError,
        handedness: nutState.handedness,
        helixTangent: nutState.helixTangent.clone(),
        name: nutState.name,
        phaseAccelerationError: nutState.phaseAccelerationError,
        phaseConstraintError: nutState.phaseConstraintError,
        phaseVelocityError: nutState.phaseVelocityError,
        pitch: threadPitch,
        radialNormalVelocityError: nutState.radialNormalVelocityError,
        slidingSpeed: nutState.threadSlidingSpeed,
      })),
      wormWheelMesh: {
        centerDistanceError: state.meshCenterDistanceError,
        contactPoint: state.pitchContactPoint.clone(),
        lead: wormLead,
        phaseAccelerationError: state.meshPhaseAccelerationError,
        phaseConstraintError: state.meshPhaseError,
        phaseVelocityError: state.meshPhaseVelocityError,
        pointError: state.meshPointError,
        starts: wormStarts,
        tangentialAccelerationError: state.meshTangentialAccelerationError,
        tangentialVelocityError: state.meshTangentialVelocityError,
        teeth: wheelTeeth,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);

  root.userData.fidelity = 'authored';
  markShadows(root);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  for (const object of [
    cameraEnvelope,
    shaftRotationIndex,
    wheelRotationIndex,
    inputWheel.index,
    ...nutRecords.map(({ translationIndex }) => translationIndex),
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }

  return {
    cameraDirection: new THREE.Vector3(7.8, 4.8, 11.6),
    root,
    update,
  };
}

export function createAuthoredWormScrewMovement(movement) {
  switch (movement.id) {
    case 151: return opposedScrewNutsDrivenByWorm();
    default: return null;
  }
}
