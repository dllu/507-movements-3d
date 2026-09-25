import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeGear,
  markShadows,
  matte,
} from './primitives.js';

import { rackPinionGeometry, rackToothGeometry, RACK_PRESSURE_ANGLE } from './rack-pinion-parts.js';
import { boredCylinderGeometry, boredJournal, fitPistonGuide } from './piston-guide-parts.js';
import { circle, poly, plate, polygonClipping as clip } from './finite-plate-geometry.js';

const FULL_TURN = Math.PI * 2;
const HALF_TURN = Math.PI;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function rotate2(point, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * point.x - sine * point.y,
    sine * point.x + cosine * point.y,
  );
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

function handRockedPinionAndPumpRacks(movement) {
  const root = new THREE.Group();

  // The official canvas establishes the half-turn endpoints and the
  // 40/10/40/10 stroke-dwell sequence. Geometry is independently measured
  // from Brown's 525 px public-domain engraving and rebuilt in Three.js.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.018;
  const sourceRasterPinionCenter = new THREE.Vector2(270, 232);
  const sourceRasterPinionPitchLeft = new THREE.Vector2(217, 232);
  const sourceRasterPinionPitchRight = new THREE.Vector2(323, 232);
  const sourceRasterPinionOuterTop = new THREE.Vector2(270, 172);
  const sourceRasterPinionOuterBottom = new THREE.Vector2(270, 292);
  const sourceRasterHandleGrip = new THREE.Vector2(174, 130);
  const sourceRasterHandleRoot = new THREE.Vector2(226, 190);
  const sourceRasterLeftRackTop = new THREE.Vector2(211, 188);
  const sourceRasterLeftRackBottom = new THREE.Vector2(211, 385);
  const sourceRasterRightRackTop = new THREE.Vector2(328, 54);
  const sourceRasterRightRackBottom = new THREE.Vector2(328, 248);
  const sourceRasterBaseLeft = new THREE.Vector2(52, 408);
  const sourceRasterBaseRight = new THREE.Vector2(488, 408);
  const sourceRasterLeftSupportCenter = new THREE.Vector2(120, 290);
  const sourceRasterRightSupportCenter = new THREE.Vector2(417, 290);
  const sourceRasterLeftPumpMouth = new THREE.Vector2(191, 486);
  const sourceRasterRightPumpMouth = new THREE.Vector2(337, 486);

  const sourcePointToModel = ({ x, y }) => new THREE.Vector2(
    (x - sourceRasterPinionCenter.x) * sourceScale,
    (sourceRasterPinionCenter.y - y) * sourceScale,
  );
  const pinionCenter = sourcePointToModel(sourceRasterPinionCenter);
  const pitchRadiusLeft = sourcePointToModel(sourceRasterPinionPitchLeft)
    .distanceTo(pinionCenter);
  const pitchRadiusRight = sourcePointToModel(sourceRasterPinionPitchRight)
    .distanceTo(pinionCenter);
  const pinionPitchRadius = (pitchRadiusLeft + pitchRadiusRight) / 2;
  const sourceHandleGrip = sourcePointToModel(sourceRasterHandleGrip);
  const sourceHandleRoot = sourcePointToModel(sourceRasterHandleRoot);
  const handleLength = sourceHandleGrip.distanceTo(pinionCenter);
  const sourceHandleAngle = Math.atan2(
    sourceHandleGrip.y - pinionCenter.y,
    sourceHandleGrip.x - pinionCenter.x,
  );
  const pinionTeeth = 18;
  const pinionAngularPitch = FULL_TURN / pinionTeeth;
  const rackPitch = pinionPitchRadius * pinionAngularPitch;
  const pinionToothHeight = 0.20;
  const pinionOuterRadius = pinionPitchRadius + pinionToothHeight / 2;
  const rackToothCount = 16;
  const rackLength = rackPitch * rackToothCount;
  const rackBodyWidth = 0.18;
  const rackDepth = 0.34;
  const rackStroke = HALF_TURN * pinionPitchRadius;
  const sourceLeftRackY = -rackStroke / 2;
  const sourceRightRackY = rackStroke / 2;
  const pistonLocalY = -4.65;
  const pistonTravelTop = sourceRightRackY + pistonLocalY;
  const pistonTravelBottom = sourceLeftRackY + pistonLocalY;
  const pumpCylinderTravelClearance = 0.18;
  const pumpCylinderTop = pistonTravelTop + pumpCylinderTravelClearance;
  const pumpCylinderBottom = pistonTravelBottom - pumpCylinderTravelClearance;
  const pumpCylinderHeight = pumpCylinderTop - pumpCylinderBottom;
  const pumpCylinderCenterY = (pumpCylinderTop + pumpCylinderBottom) / 2;

  const cyclePeriod = 4;
  const forwardStrokeFraction = 0.4;
  const farDwellFraction = 0.1;
  const returnStrokeFraction = 0.4;
  const nearDwellFraction = 0.1;
  const forwardEndPhase = forwardStrokeFraction;
  const farDwellEndPhase = forwardEndPhase + farDwellFraction;
  const returnEndPhase = farDwellEndPhase + returnStrokeFraction;

  const motionAtCyclePhase = (unwrappedPhase) => {
    const cycleIndex = Math.floor(unwrappedPhase);
    const cyclePhase = unwrappedPhase - cycleIndex;
    let gearAngle = 0;
    let gearFirstDerivativeByPhase = 0;
    let gearSecondDerivativeByPhase = 0;
    let stage = 'near-end-dwell';
    let strokeProgress = 0;

    if (cyclePhase < forwardEndPhase) {
      const normalized = cyclePhase / forwardStrokeFraction;
      const law = septicSmoothstep(normalized);
      gearAngle = -HALF_TURN * law.value;
      gearFirstDerivativeByPhase = -HALF_TURN
        * law.firstDerivative / forwardStrokeFraction;
      gearSecondDerivativeByPhase = -HALF_TURN
        * law.secondDerivative / forwardStrokeFraction ** 2;
      stage = 'clockwise-half-turn';
      strokeProgress = law.value;
    } else if (cyclePhase < farDwellEndPhase) {
      gearAngle = -HALF_TURN;
      stage = 'far-end-dwell';
      strokeProgress = 1;
    } else if (cyclePhase < returnEndPhase) {
      const normalized = (
        cyclePhase - farDwellEndPhase
      ) / returnStrokeFraction;
      const law = septicSmoothstep(normalized);
      gearAngle = -HALF_TURN * (1 - law.value);
      gearFirstDerivativeByPhase = HALF_TURN
        * law.firstDerivative / returnStrokeFraction;
      gearSecondDerivativeByPhase = HALF_TURN
        * law.secondDerivative / returnStrokeFraction ** 2;
      stage = 'counterclockwise-half-turn';
      strokeProgress = 1 - law.value;
    }

    const gearAngularSpeed = gearFirstDerivativeByPhase / cyclePeriod;
    const gearAngularAcceleration = gearSecondDerivativeByPhase
      / cyclePeriod ** 2;
    return {
      cycleIndex,
      cyclePhase,
      gearAngle,
      gearAngularAcceleration,
      gearAngularSpeed,
      stage,
      strokeProgress,
    };
  };

  const stateAtCyclePhase = (cyclePhase) => {
    const motion = motionAtCyclePhase(cyclePhase);
    const leftRackY = sourceLeftRackY
      - pinionPitchRadius * motion.gearAngle;
    const rightRackY = sourceRightRackY
      + pinionPitchRadius * motion.gearAngle;
    const leftRackSpeed = -pinionPitchRadius * motion.gearAngularSpeed;
    const rightRackSpeed = pinionPitchRadius * motion.gearAngularSpeed;
    const leftRackAcceleration = -pinionPitchRadius
      * motion.gearAngularAcceleration;
    const rightRackAcceleration = pinionPitchRadius
      * motion.gearAngularAcceleration;
    const handleGrip = rotate2(sourceHandleGrip, motion.gearAngle);
    const handleTangent = new THREE.Vector2(-handleGrip.y, handleGrip.x);
    const handleGripVelocity = handleTangent.clone().multiplyScalar(
      motion.gearAngularSpeed,
    );
    const handleGripAcceleration = handleTangent.clone().multiplyScalar(
      motion.gearAngularAcceleration,
    ).addScaledVector(
      handleGrip,
      -(motion.gearAngularSpeed ** 2),
    );
    return {
      ...motion,
      handleGrip: new THREE.Vector3(handleGrip.x, handleGrip.y, 0),
      handleGripAcceleration: new THREE.Vector3(
        handleGripAcceleration.x,
        handleGripAcceleration.y,
        0,
      ),
      handleGripVelocity: new THREE.Vector3(
        handleGripVelocity.x,
        handleGripVelocity.y,
        0,
      ),
      leftContactPoint: new THREE.Vector3(-pinionPitchRadius, 0, 0),
      leftNoSlipError: leftRackSpeed
        + pinionPitchRadius * motion.gearAngularSpeed,
      leftPistonY: leftRackY + pistonLocalY,
      leftRackAcceleration: new THREE.Vector3(
        0,
        leftRackAcceleration,
        0,
      ),
      leftRackSpeed,
      leftRackVelocity: new THREE.Vector3(0, leftRackSpeed, 0),
      leftRackY,
      rackCenterMean: (leftRackY + rightRackY) / 2,
      rackSeparation: rightRackY - leftRackY,
      rightContactPoint: new THREE.Vector3(pinionPitchRadius, 0, 0),
      rightNoSlipError: rightRackSpeed
        - pinionPitchRadius * motion.gearAngularSpeed,
      rightPistonY: rightRackY + pistonLocalY,
      rightRackAcceleration: new THREE.Vector3(
        0,
        rightRackAcceleration,
        0,
      ),
      rightRackSpeed,
      rightRackVelocity: new THREE.Vector3(0, rightRackSpeed, 0),
      rightRackY,
    };
  };

  const stateAtTime = (time) => stateAtCyclePhase(time / cyclePeriod);

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const drivenDarkMaterial = matte(0x244f67, {
    metalness: 0.16,
    roughness: 0.54,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.68,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.5,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.44 });
  // Brown draws the pump barrels as opaque metal tubes broken off below
  // the bedplate, so the pistons and most of the barrel run out of view.
  const glassMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });

  const baseTopY = sourcePointToModel(sourceRasterBaseLeft).y;
  const base = new THREE.Group();
  base.userData.role = 'fixed-air-pump-bedplate';
  root.add(base);
  const baseSlab = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourcePointToModel(sourceRasterBaseRight).x
        - sourcePointToModel(sourceRasterBaseLeft).x,
      0.24,
      0.62,
    ),
    frameMaterial,
  );
  baseSlab.position.set(0, baseTopY - 0.12, -0.23);
  baseSlab.userData.role = 'pump-bedplate-slab';
  base.add(baseSlab);
  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(6.85, 0.18, 0.48),
    frameMaterial,
  );
  baseRail.position.set(0, baseTopY + 0.12, -0.23);
  baseRail.userData.role = 'rack-guide-base-rail';
  base.add(baseRail);
  for (const x of [-3.3, 3.3]) {
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.95, 0.58),
      frameMaterial,
    );
    foot.position.set(x, baseTopY - 0.48, -0.24);
    foot.userData.role = 'bedplate-foot';
    base.add(foot);
  }

  const leftSupportX = sourcePointToModel(
    sourceRasterLeftSupportCenter,
  ).x;
  const rightSupportX = sourcePointToModel(
    sourceRasterRightSupportCenter,
  ).x;
  const supportTopY = 0.48;
  const supportBottomY = baseTopY + 0.24;
  const supports = new THREE.Group();
  supports.userData.role = 'fixed-pinion-and-rack-guide-frame';
  root.add(supports);
  for (const [side, x] of [['left', leftSupportX], ['right', rightSupportX]]) {
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.28,
        supportTopY - supportBottomY, 32),
      frameMaterial,
    );
    column.position.set(x, (supportTopY + supportBottomY) / 2, -0.31);
    column.userData.role = `${side}-fixed-pump-support-column`;
    supports.add(column);
    const foot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.39, 0.44, 0.16, 36),
      frameMaterial,
    );
    foot.position.set(x, supportBottomY, -0.31);
    foot.userData.role = `${side}-support-foot`;
    supports.add(foot);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.98, 0.72, 0.58),
      frameMaterial,
    );
    head.position.set(x, 0.12, -0.28);
    head.userData.role = `${side}-fixed-guide-head`;
    supports.add(head);
    const cap = cylinderAlongZ(0.18, 0.64, darkMaterial, 28);
    cap.position.set(x, 0.58, -0.26);
    cap.userData.role = `${side}-guide-head-cap-bolt`;
    supports.add(cap);
  }
  for (const side of [-1, 1]) {
    const rackX = side * pinionPitchRadius;
    const guideOuterX = side * (pinionPitchRadius + 0.35);
    const sleeve = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.78, 0.52),
      frameMaterial,
    );
    sleeve.position.set(guideOuterX, 0, -0.14);
    sleeve.userData.role = side < 0
      ? 'left-fixed-rack-slide-guide'
      : 'right-fixed-rack-slide-guide';
    supports.add(sleeve);
    const bridgeStartX = side < 0 ? leftSupportX + 0.48 : rackX + 0.2;
    const bridgeEndX = side < 0 ? rackX - 0.2 : rightSupportX - 0.48;
    const bridge = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.abs(bridgeEndX - bridgeStartX),
        0.34,
        0.5,
      ),
      frameMaterial,
    );
    bridge.position.set((bridgeStartX + bridgeEndX) / 2, 0, -0.22);
    bridge.userData.role = side < 0
      ? 'left-guide-head-bridge'
      : 'right-guide-head-bridge';
    supports.add(bridge);
  }

  const pumpCylinders = [];
  for (const side of [-1, 1]) {
    const x = side * pinionPitchRadius;
    const cylinder = new THREE.Mesh(
      boredCylinderGeometry(.45,.365,pumpCylinderHeight),
      glassMaterial,
    );
    cylinder.position.set(x, pumpCylinderCenterY, 0.23);
    cylinder.userData.role = side < 0
      ? 'left-air-pump-barrel'
      : 'right-air-pump-barrel';
    pumpCylinders.push(cylinder);
    root.add(cylinder);
  }

  const pinion = makeGear({
    color: PALETTE.driver,
    depth: 0.44,
    radius: pinionPitchRadius,
    teeth: pinionTeeth,
    toothHeight: pinionToothHeight,
  });
  pinion.position.set(pinionCenter.x, pinionCenter.y, 0.28);
  pinion.userData.axis = Z_AXIS.clone();
  pinion.userData.role = 'handle-driven-half-turn-pinion';
  root.add(pinion);
  const pinionRotor = pinion.userData.rotor;
  const pinionBody=pinionRotor.children[0];
  pinionBody.geometry.dispose();
  pinionBody.geometry=rackPinionGeometry({radius:pinionPitchRadius,teeth:pinionTeeth,
    addendum:pinionToothHeight/2,depth:.44,bore:.153});
  // At the reference pose both racks have a tooth on y=0, so the pinion
  // must present a space at both horizontal pitch points (18 teeth).
  pinionBody.geometry.rotateZ(pinionAngularPitch/2);
  Object.assign(pinion.userData,{pressureAngle:RACK_PRESSURE_ANGLE,
    baseRadius:pinionBody.geometry.userData.baseRadius,
    rootRadius:pinionBody.geometry.userData.rootRadius,dedendum:pinionToothHeight/2+.006});
  const hub=pinionRotor.children[1];hub.geometry.dispose();
  hub.geometry=boredCylinderGeometry(.32,.153,.52);
  pinionRotor.children[2].visible=false;
  // makeGear's white phase indicator is not drawn by Brown.
  pinionRotor.remove(pinionRotor.children[3]);
  pinionRotor.userData.role = 'rigid-pinion-and-handle-rotor';
  // The handle is carried on the pinion's front face, so it sweeps in front
  // of both racks and their guides instead of through them.
  const handleZ = 0.62;
  const handleBossPoint = sourceHandleRoot.clone().multiplyScalar(
    0.6 / sourceHandleRoot.length(),
  );
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(handleBossPoint.x, handleBossPoint.y, handleZ),
    new THREE.Vector3(sourceHandleRoot.x, sourceHandleRoot.y, handleZ),
    new THREE.Vector3(-1.08, 1.24, handleZ),
    new THREE.Vector3(sourceHandleGrip.x, sourceHandleGrip.y, handleZ),
  ]);
  const handle = new THREE.Mesh(
    new THREE.TubeGeometry(handleCurve, 48, 0.095, 12, false),
    driverMaterial,
  );
  handle.userData.role = 'manual-handle-rigid-to-pinion';
  pinionRotor.add(handle);
  const handleBoss = cylinderAlongZ(0.14, 0.16, driverMaterial, 32);
  handleBoss.position.set(handleBossPoint.x, handleBossPoint.y, 0.56);
  handleBoss.userData.role = 'handle-boss-on-pinion-face';
  pinionRotor.add(handleBoss);
  const handleGrip = cylinderAlongZ(0.145, 0.54, darkMaterial, 32);
  handleGrip.position.set(sourceHandleGrip.x, sourceHandleGrip.y, 0.72);
  handleGrip.userData.role = 'manual-handle-grip';
  pinionRotor.add(handleGrip);
  const handleGripCap = cylinderAlongZ(0.09, 0.055, whiteMaterial, 30);
  handleGripCap.position.set(sourceHandleGrip.x, sourceHandleGrip.y, 0.64);
  handleGripCap.userData.role = 'white-handle-endpoint-index';
  const pinionAxle = cylinderAlongZ(0.15, 0.82, darkMaterial, 34);
  pinionAxle.position.set(0, 0, 0.29);
  pinionAxle.userData.role = 'fixed-pinion-axis';
  root.add(pinionAxle);

  const rackToothGeometries = {
    left:rackToothGeometry({pitch:rackPitch,addendum:pinionToothHeight/2,depth:rackDepth}).rotateZ(-Math.PI/2),
    right:rackToothGeometry({pitch:rackPitch,addendum:pinionToothHeight/2,depth:rackDepth}).rotateZ(Math.PI/2),
  };

  const makePumpRack = (side) => {
    const rack = new THREE.Group();
    rack.userData.role = side < 0
      ? 'left-vertical-air-pump-rack'
      : 'right-vertical-air-pump-rack';
    const innerDirection = -side;
    const rackX = side * pinionPitchRadius;
    const bodyCenterX = rackX - innerDirection * (
      pinionToothHeight / 2 + .006 + rackBodyWidth / 2
    );
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(rackBodyWidth, rackLength, rackDepth),
      drivenMaterial,
    );
    body.position.set(bodyCenterX, 0, 0.23);
    body.userData.role = side < 0
      ? 'left-rack-bar'
      : 'right-rack-bar';
    rack.add(body);
    const teeth = [];
    const toothGeometry = side < 0
      ? rackToothGeometries.left
      : rackToothGeometries.right;
    for (let index = 0; index < rackToothCount; index += 1) {
      const tooth = new THREE.Mesh(toothGeometry, drivenMaterial);
      tooth.position.set(
        rackX,
        (index - (rackToothCount - 1) / 2) * rackPitch,
        0.23,
      );
      tooth.userData.index = index;
      tooth.userData.role = side < 0
        ? 'left-rack-working-tooth'
        : 'right-rack-working-tooth';
      teeth.push(tooth);
      rack.add(tooth);
    }
    const upperCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 24, 14),
      drivenMaterial,
    );
    upperCap.scale.set(0.65, 1, 1);
    upperCap.position.set(bodyCenterX, rackLength / 2, 0.23);
    upperCap.userData.role = side < 0
      ? 'left-rack-rounded-upper-end'
      : 'right-rack-rounded-upper-end';
    rack.add(upperCap);
    const pistonRodTop = -rackLength / 2;
    const pistonRodLength = pistonRodTop - pistonLocalY;
    const pistonRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, pistonRodLength, 20),
      drivenDarkMaterial,
    );
    pistonRod.position.set(
      rackX,
      (pistonRodTop + pistonLocalY) / 2,
      0.23,
    );
    pistonRod.userData.role = side < 0
      ? 'left-rack-to-piston-rod'
      : 'right-rack-to-piston-rod';
    rack.add(pistonRod);
    const rodShoulder=new THREE.Mesh(new THREE.BoxGeometry(Math.abs(bodyCenterX-rackX)+rackBodyWidth,.14,rackDepth),drivenMaterial);
    rodShoulder.position.set((bodyCenterX+rackX)/2,pistonRodTop+.01,.23);
    rodShoulder.userData.role=side<0?'left-rack-rod-shoulder':'right-rack-rod-shoulder';
    rack.add(rodShoulder);
    const piston = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 0.13, 36),
      drivenMaterial,
    );
    piston.position.set(rackX, pistonLocalY, 0.23);
    piston.userData.role = side < 0
      ? 'left-air-pump-piston'
      : 'right-air-pump-piston';
    rack.add(piston);
    const index = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, rackPitch * 0.66, rackDepth + 0.006),
      whiteMaterial,
    );
    index.position.set(bodyCenterX, rackPitch / 2, 0.23);
    index.userData.role = side < 0
      ? 'white-left-rack-translation-index'
      : 'white-right-rack-translation-index';
    return {
      body,
      index,
      piston,
      pistonRod,
      rack,
      teeth,
      upperCap,
    };
  };

  const leftRackAssembly = makePumpRack(-1);
  const rightRackAssembly = makePumpRack(1);
  const leftRack = leftRackAssembly.rack;
  const rightRack = rightRackAssembly.rack;
  root.add(leftRack, rightRack);

  for(const slab of [baseSlab,baseRail]) {
    const {width,height}=slab.geometry.parameters;
    const holes=[-1,1].map(side=>poly(circle([side*pinionPitchRadius,-.23],.46,64)));
    slab.geometry.dispose();
    slab.geometry=plate(clip.difference(poly([[-width/2,-.76],[width/2,-.76],[width/2,.76],[-width/2,.76]]),...holes),-height/2,height/2).rotateX(-Math.PI/2);
    slab.position.z=0;
  }
  for(const side of [-1,1]) {
    const name=side<0?'left':'right',guide=supports.children.find(o=>o.userData.role===`${name}-fixed-rack-slide-guide`);
    const center=side*(pinionPitchRadius+pinionToothHeight/2+.006+ rackBodyWidth/2);
    guide.geometry.dispose();
    guide.geometry=plate(clip.difference(
      poly([[-.09,-.28],[.22,-.28],[.22,.28],[-.09,.28]].map(([x,z])=>[side*x,z])),
      poly([[-.096,-.177],[.095,-.177],[.095,.177],[-.096,.177]].map(([x,z])=>[side*x,z]))
    ),-.39,.39).rotateX(-Math.PI/2);
    guide.position.set(center,0,.23);
  }
  const axleBearing=boredJournal(.23,.153,.28,frameMaterial);
  axleBearing.position.set(0,0,-.30);
  axleBearing.userData.role='bored-fixed-pinion-bearing';root.add(axleBearing);
  const bearingBridge=new THREE.Mesh(new THREE.BoxGeometry(2.80,.22,.18),frameMaterial);
  bearingBridge.position.set(0,-.24,-.43);
  bearingBridge.userData.role='rear-pinion-bearing-bridge';root.add(bearingBridge);
  pinionAxle.geometry.dispose();pinionAxle.geometry=new THREE.CylinderGeometry(.15,.15,1.10,48);
  pinionAxle.position.z=.13;

  const contactMarkers = [-1, 1].map((side) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 22, 14),
      whiteMaterial,
    );
    marker.position.set(side * pinionPitchRadius, 0, 0.67);
    marker.userData.role = side < 0
      ? 'white-left-rack-pinion-pitch-contact'
      : 'white-right-rack-pinion-pitch-contact';
    marker.visible=false;
    return marker;
  });

  const pitchRadiusFitPixelErrors = {
    left: Math.abs(
      pitchRadiusLeft / sourceScale - pinionPitchRadius / sourceScale
    ),
    right: Math.abs(
      pitchRadiusRight / sourceScale - pinionPitchRadius / sourceScale
    ),
  };
  const outerRadiusFitPixelErrors = {
    bottom: Math.abs(
      sourceRasterPinionOuterBottom.distanceTo(sourceRasterPinionCenter)
        - pinionOuterRadius / sourceScale
    ),
    top: Math.abs(
      sourceRasterPinionOuterTop.distanceTo(sourceRasterPinionCenter)
        - pinionOuterRadius / sourceScale
    ),
  };

  root.userData.archetype =
    'half-turn-handle-pinion-opposed-air-pump-racks';
  root.userData.cameraDistanceScale = 1.15;
  root.userData.blocks = {
    base,
    baseRail,
    baseSlab,
    contactMarkers,
    handle,
    handleGrip,
    handleGripCap,
    leftPiston: leftRackAssembly.piston,
    leftPistonRod: leftRackAssembly.pistonRod,
    leftRack,
    leftRackBody: leftRackAssembly.body,
    leftRackIndex: leftRackAssembly.index,
    leftRackTeeth: leftRackAssembly.teeth,
    pinion,
    pinionAxle,
    pinionRotor,
    pumpCylinders,
    rightPiston: rightRackAssembly.piston,
    rightPistonRod: rightRackAssembly.pistonRod,
    rightRack,
    rightRackBody: rightRackAssembly.body,
    rightRackIndex: rightRackAssembly.index,
    rightRackTeeth: rightRackAssembly.teeth,
    supports,
  };
  root.userData.geometry = {
    cyclePeriod,
    handleLength,
    pinionAngularPitch,
    pinionOuterRadius,
    pinionPitchRadius,
    pinionTeeth,
    pinionToothHeight,
    pistonLocalY,
    pumpCylinderBottom,
    pumpCylinderTop,
    rackDepth,
    rackLength,
    rackPitch,
    rackStroke,
    rackToothCount,
    sourceHandleAngle,
    sourceLeftRackY,
    sourceRightRackY,
    sourceScale,
  };
  root.userData.mechanism =
    'one manual handle is rigidly fixed to one central pinion; a clockwise half-turn of that single rotor drives the left vertical rack upward and the right vertical rack downward by equal no-slip pitch travel, then the return half-turn reverses both racks, so their attached small-air-pump pistons always reciprocate equally and oppositely';
  root.userData.movement = movement;
  root.userData.sourceAnimation = {
    available: true,
    independentlyReconstructed: true,
    observedCycleFractions: [0, 0.4, 0.5, 0.9, 1],
    observedPinionAngularStroke: HALF_TURN,
    observedRackStrokeToPitchRadiusRatio: Math.PI,
    officialCanvasModelPresent: true,
    referenceScope:
      'the official canvas is used only to confirm the half-turn pinion stroke, equal opposite rack travel, source-side phase, and 40/10/40/10 stroke-dwell order; Three.js geometry, septic smoothing, derivatives, pump clearances, and rendering are independent',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate283: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'one fixed-axis eighteen-tooth pinion with one rigid manual handle simultaneously meshes a left inward-facing vertical rack and a right inward-facing vertical rack; each rack continues to one pump piston below the common bedplate',
      measurementUncertaintyPixels: 6,
      outerRadiusFitPixelErrors,
      pinionPitchRadiusPixels: pinionPitchRadius / sourceScale,
      pitchRadiusFitPixelErrors,
      rasterBaseLeft: {
        x: sourceRasterBaseLeft.x,
        y: sourceRasterBaseLeft.y,
      },
      rasterBaseRight: {
        x: sourceRasterBaseRight.x,
        y: sourceRasterBaseRight.y,
      },
      rasterHandleGrip: {
        x: sourceRasterHandleGrip.x,
        y: sourceRasterHandleGrip.y,
      },
      rasterHandleRoot: {
        x: sourceRasterHandleRoot.x,
        y: sourceRasterHandleRoot.y,
      },
      rasterLeftPumpMouth: {
        x: sourceRasterLeftPumpMouth.x,
        y: sourceRasterLeftPumpMouth.y,
      },
      rasterLeftRackBottom: {
        x: sourceRasterLeftRackBottom.x,
        y: sourceRasterLeftRackBottom.y,
      },
      rasterLeftRackTop: {
        x: sourceRasterLeftRackTop.x,
        y: sourceRasterLeftRackTop.y,
      },
      rasterLeftSupportCenter: {
        x: sourceRasterLeftSupportCenter.x,
        y: sourceRasterLeftSupportCenter.y,
      },
      rasterPinionCenter: {
        x: sourceRasterPinionCenter.x,
        y: sourceRasterPinionCenter.y,
      },
      rasterPinionOuterBottom: {
        x: sourceRasterPinionOuterBottom.x,
        y: sourceRasterPinionOuterBottom.y,
      },
      rasterPinionOuterTop: {
        x: sourceRasterPinionOuterTop.x,
        y: sourceRasterPinionOuterTop.y,
      },
      rasterPinionPitchLeft: {
        x: sourceRasterPinionPitchLeft.x,
        y: sourceRasterPinionPitchLeft.y,
      },
      rasterPinionPitchRight: {
        x: sourceRasterPinionPitchRight.x,
        y: sourceRasterPinionPitchRight.y,
      },
      rasterRightPumpMouth: {
        x: sourceRasterRightPumpMouth.x,
        y: sourceRasterRightPumpMouth.y,
      },
      rasterRightRackBottom: {
        x: sourceRasterRightRackBottom.x,
        y: sourceRasterRightRackBottom.y,
      },
      rasterRightRackTop: {
        x: sourceRasterRightRackTop.x,
        y: sourceRasterRightRackTop.y,
      },
      rasterRightSupportCenter: {
        x: sourceRasterRightSupportCenter.x,
        y: sourceRasterRightSupportCenter.y,
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
    farDwellEndPhase,
    farDwellFraction,
    forwardEndPhase,
    forwardStrokeFraction,
    nearDwellFraction,
    returnEndPhase,
    returnStrokeFraction,
    schedule: [
      'clockwise-half-turn',
      'far-end-dwell',
      'counterclockwise-half-turn',
      'near-end-dwell',
    ],
  };
  root.userData.transmission = {
    input: 'one manually vibrated handle rigidly fixed to the pinion',
    leftRackNoSlipLaw:
      'left-rack-speed = -pinion-pitch-radius * pinion-angular-speed',
    opposedRackConstraint:
      'left-rack-displacement + right-rack-displacement is constant',
    output:
      'two equal-stroke, opposite-phase vertical rack and air-pump-piston reciprocations',
    pinionAngularStroke: HALF_TURN,
    rackStroke,
    rightRackNoSlipLaw:
      'right-rack-speed = pinion-pitch-radius * pinion-angular-speed',
    septicEndpointConditions:
      'each 40-percent stroke has zero velocity, acceleration, and jerk at both dwell boundaries',
  };

  const update = (time) => {
    const state = stateAtTime(time);
    pinionRotor.rotation.z = state.gearAngle;
    pinion.userData.angularAcceleration = state.gearAngularAcceleration;
    pinion.userData.angularSpeed = state.gearAngularSpeed;
    leftRack.position.y = state.leftRackY;
    leftRack.userData.acceleration = state.leftRackAcceleration.clone();
    leftRack.userData.velocity = state.leftRackVelocity.clone();
    rightRack.position.y = state.rightRackY;
    rightRack.userData.acceleration = state.rightRackAcceleration.clone();
    rightRack.userData.velocity = state.rightRackVelocity.clone();
    root.userData.contacts = {
      leftRackPinion: {
        active: true,
        noSlipError: state.leftNoSlipError,
        pitchPoint: state.leftContactPoint.clone(),
        rackSpeed: state.leftRackSpeed,
      },
      rightRackPinion: {
        active: true,
        noSlipError: state.rightNoSlipError,
        pitchPoint: state.rightContactPoint.clone(),
        rackSpeed: state.rightRackSpeed,
      },
    };
    root.userData.kinematics = state;
  };

  root.userData.cameraFov=8;
  fitPistonGuide(root,update,cyclePeriod);
  // Crop at Brown's break line about 2.0 units below the bedplate top.
  root.userData.cameraFitBounds.min.y=baseTopY-2.0;
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(.4,.25,14),
  };
}

export function createAuthoredRackPumpMovement(movement) {
  if (movement.id !== 283) return null;
  const result = handRockedPinionAndPumpRacks(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
