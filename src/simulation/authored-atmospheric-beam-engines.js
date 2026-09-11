import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function cylinderAlongZ(radius, depth, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function beamBetween3D(start, end, width, depth, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    delta.clone().normalize(),
  );
  return beam;
}

function ringSectorGeometry({
  depth,
  endAngle,
  innerRadius,
  outerRadius,
  segments = 52,
  startAngle,
}) {
  const shape = new THREE.Shape();
  for (let index = 0; index <= segments; index += 1) {
    const angle = startAngle
      + (endAngle - startAngle) * index / segments;
    const x = outerRadius * Math.cos(angle);
    const y = outerRadius * Math.sin(angle);
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let index = segments; index >= 0; index -= 1) {
    const angle = startAngle
      + (endAngle - startAngle) * index / segments;
    shape.lineTo(
      innerRadius * Math.cos(angle),
      innerRadius * Math.sin(angle),
    );
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function makeFlexibleChainLink({
  chainMaterial,
  darkMaterial,
  depth,
  nominalPitch,
  width,
}) {
  const link = new THREE.Group();
  link.userData.nominalPitch = nominalPitch;
  link.userData.role = 'articulated-atmospheric-engine-chain-link';
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(nominalPitch, width, depth),
    chainMaterial,
  );
  body.position.set(nominalPitch / 2, 0, 0.76);
  body.userData.role = 'green-chain-link-side-plate';
  const startBoss = cylinderAlongZ(width * 0.62, depth * 1.25,
    chainMaterial, 28);
  startBoss.position.z = 0.76;
  startBoss.userData.role = 'chain-link-start-boss';
  const endBoss = cylinderAlongZ(width * 0.62, depth * 1.25,
    chainMaterial, 28);
  endBoss.position.set(nominalPitch, 0, 0.76);
  endBoss.userData.role = 'chain-link-end-boss';
  const startPin = cylinderAlongZ(width * 0.21, depth * 1.75,
    darkMaterial, 22);
  startPin.position.z = 0.76;
  startPin.userData.role = 'chain-link-start-pin';
  const endPin = cylinderAlongZ(width * 0.21, depth * 1.75,
    darkMaterial, 22);
  endPin.position.set(nominalPitch, 0, 0.76);
  endPin.userData.role = 'chain-link-end-pin';
  const startAnchor = new THREE.Object3D();
  startAnchor.position.z = 0.76;
  startAnchor.userData.role = 'analytic-chain-link-start';
  const endAnchor = new THREE.Object3D();
  endAnchor.position.set(nominalPitch, 0, 0.76);
  endAnchor.userData.role = 'analytic-chain-link-end';
  link.add(
    body,
    startBoss,
    endBoss,
    startPin,
    endPin,
    startAnchor,
    endAnchor,
  );
  return {
    body,
    endAnchor,
    endBoss,
    endPin,
    link,
    startAnchor,
    startBoss,
    startPin,
  };
}

function atmosphericChainBeamPumpingEngine(movement) {
  const root = new THREE.Group();

  // The source interpolates the piston between y=-1.811 and y=-10.189.
  // Those three-decimal endpoints make the illustrated chain grow by
  // 0.000421831 source unit. Its intended law is exact: the free vertical
  // chain pays out at the same speed that a 12-unit circular beam segment
  // winds it in. Centering the stroke on source y=-6 gives y=-6-12*theta,
  // changing either source endpoint by only 0.000210916 unit while making
  // every material point tangent-continuous at the straight/arc transition.
  const sourceScale = 0.30;
  const sourceBeamPivot = new THREE.Vector2(0, 0);
  const sourceBeamStartRay = new THREE.Vector2(1.879385, -0.68404);
  const sourceBeamEndRay = new THREE.Vector2(1.879385, 0.68404);
  const sourceBeamStartAngle = Math.atan2(
    sourceBeamStartRay.y,
    sourceBeamStartRay.x,
  );
  const sourceBeamEndAngle = Math.atan2(
    sourceBeamEndRay.y,
    sourceBeamEndRay.x,
  );
  const sourceBeamHalfSwing = (sourceBeamEndAngle
    - sourceBeamStartAngle) / 2;
  const sourcePitchRadius = 12;
  const sourceRawChainAttachment = new THREE.Vector2(
    -10.879452,
    5.073172,
  );
  const sourceChainAttachmentRadius = sourceRawChainAttachment.length();
  const sourceChainAttachmentAngle = Math.atan2(
    sourceRawChainAttachment.y,
    sourceRawChainAttachment.x,
  );
  const sourceTerminalTangentAngleOffset = Math.acos(
    sourcePitchRadius / sourceChainAttachmentRadius,
  );
  const sourceTerminalTangentLength = Math.sqrt(
    sourceChainAttachmentRadius ** 2 - sourcePitchRadius ** 2,
  );
  const sourcePistonLineX = -12;
  const sourceCanvasPistonStartY = -1.811;
  const sourceCanvasPistonEndY = -10.189;
  const sourcePistonMidY = (
    sourceCanvasPistonStartY + sourceCanvasPistonEndY
  ) / 2;
  const sourcePistonRodLength = 11.181114;
  const sourcePistonHeadCenterOffset = -11.681114;
  const sourcePumpRodJoint = new THREE.Vector2(10, 0);
  const sourcePumpRodLength = 11.5;
  const sourceShoeInnerRadius = 10.2;
  const sourceShoeOuterRadius = 11.7;
  const sourceShoeStartAngle = 2.70526;
  const sourceShoeEndAngle = 3.577925;
  const sourceChainLinkPitch = 1;
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / cyclePeriod;

  const beamPivot = sourceBeamPivot.clone().multiplyScalar(sourceScale);
  const pitchRadius = sourcePitchRadius * sourceScale;
  const rawChainAttachment = sourceRawChainAttachment.clone()
    .multiplyScalar(sourceScale);
  const chainAttachmentRadius = sourceChainAttachmentRadius * sourceScale;
  const terminalTangentLength = sourceTerminalTangentLength * sourceScale;
  const pistonLineX = sourcePistonLineX * sourceScale;
  const canvasPistonStartY = sourceCanvasPistonStartY * sourceScale;
  const canvasPistonEndY = sourceCanvasPistonEndY * sourceScale;
  const pistonMidY = sourcePistonMidY * sourceScale;
  const pistonRodLength = sourcePistonRodLength * sourceScale;
  const pistonHeadCenterOffset = sourcePistonHeadCenterOffset * sourceScale;
  const pumpRodJoint = sourcePumpRodJoint.clone().multiplyScalar(sourceScale);
  const pumpRodLength = sourcePumpRodLength * sourceScale;
  const chainLinkPitch = sourceChainLinkPitch * sourceScale;
  const chainLinkCount = 11;

  const rotatePoint = (point, angle) => new THREE.Vector2(
    point.x * Math.cos(angle) - point.y * Math.sin(angle),
    point.x * Math.sin(angle) + point.y * Math.cos(angle),
  );

  const chainGeometry = (pistonTopY, beamAngle) => {
    const attachmentPoint = rotatePoint(rawChainAttachment, beamAngle);
    const attachmentAngle = sourceChainAttachmentAngle + beamAngle;
    const terminalTangentAngle = attachmentAngle
      + sourceTerminalTangentAngleOffset;
    const terminalTangentPoint = new THREE.Vector2(
      pitchRadius * Math.cos(terminalTangentAngle),
      pitchRadius * Math.sin(terminalTangentAngle),
    );
    const straightTangentPoint = new THREE.Vector2(-pitchRadius, 0);
    const straightLength = -pistonTopY;
    const arcSweep = Math.PI - terminalTangentAngle;
    const arcLength = pitchRadius * arcSweep;
    const terminalVector = attachmentPoint.clone()
      .sub(terminalTangentPoint);
    const calculatedTerminalLength = terminalVector.length();
    const terminalDirection = terminalVector.clone()
      .multiplyScalar(1 / calculatedTerminalLength);
    return {
      arcLength,
      arcSweep,
      attachmentAngle,
      attachmentPoint,
      pathLength: straightLength + arcLength + calculatedTerminalLength,
      straightLength,
      straightTangentPoint,
      terminalDirection,
      terminalLength: calculatedTerminalLength,
      terminalStartDistance: straightLength + arcLength,
      terminalTangentAngle,
      terminalTangentPoint,
    };
  };

  const canvasStateAtInputTravel = (inputTravel) => {
    const unwrappedInputAngle = inputTravel;
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const strokeProgress = 0.5 * (1 - Math.cos(inputAngle));
    const beamAngle = sourceBeamStartAngle + (
      sourceBeamEndAngle - sourceBeamStartAngle
    ) * strokeProgress;
    const pistonTopY = canvasPistonStartY + (
      canvasPistonEndY - canvasPistonStartY
    ) * strokeProgress;
    const chain = chainGeometry(pistonTopY, beamAngle);
    return {
      beamAngle,
      chain,
      inputAngle,
      pistonHead: new THREE.Vector2(
        pistonLineX,
        pistonTopY + pistonHeadCenterOffset,
      ),
      pistonTop: new THREE.Vector2(pistonLineX, pistonTopY),
      strokeProgress,
      unwrappedInputAngle,
    };
  };

  const constantChainPathLength = chainGeometry(
    pistonMidY,
    0,
  ).pathLength;

  const stateAtInputTravel = (
    inputTravel,
    resolvedInputAngularSpeed = inputAngularSpeed,
    inputAngularAcceleration = 0,
  ) => {
    const canvas = canvasStateAtInputTravel(inputTravel);
    const unwrappedInputAngle = inputTravel;
    const { inputAngle } = canvas;
    const sine = Math.sin(inputAngle);
    const cosine = Math.cos(inputAngle);
    const beamAngle = -sourceBeamHalfSwing * cosine;
    const beamAngularVelocity = sourceBeamHalfSwing * sine
      * resolvedInputAngularSpeed;
    const beamAngularAcceleration = sourceBeamHalfSwing * (
      cosine * resolvedInputAngularSpeed ** 2
        + sine * inputAngularAcceleration
    );
    const pistonTopY = pistonMidY - pitchRadius * beamAngle;
    const pistonVelocityY = -pitchRadius * beamAngularVelocity;
    const pistonAccelerationY = -pitchRadius * beamAngularAcceleration;
    const chain = chainGeometry(pistonTopY, beamAngle);
    const attachmentPointVelocity = new THREE.Vector2(
      -chain.attachmentPoint.y * beamAngularVelocity,
      chain.attachmentPoint.x * beamAngularVelocity,
    );
    const attachmentPointAcceleration = new THREE.Vector2(
      -chain.attachmentPoint.x * beamAngularVelocity ** 2
        - chain.attachmentPoint.y * beamAngularAcceleration,
      -chain.attachmentPoint.y * beamAngularVelocity ** 2
        + chain.attachmentPoint.x * beamAngularAcceleration,
    );
    const terminalTangentVelocity = new THREE.Vector2(
      -chain.terminalTangentPoint.y * beamAngularVelocity,
      chain.terminalTangentPoint.x * beamAngularVelocity,
    );
    const terminalTangentAcceleration = new THREE.Vector2(
      -chain.terminalTangentPoint.x * beamAngularVelocity ** 2
        - chain.terminalTangentPoint.y * beamAngularAcceleration,
      -chain.terminalTangentPoint.y * beamAngularVelocity ** 2
        + chain.terminalTangentPoint.x * beamAngularAcceleration,
    );
    const pistonTop = new THREE.Vector2(pistonLineX, pistonTopY);
    const pistonTopVelocity = new THREE.Vector2(0, pistonVelocityY);
    const pistonTopAcceleration = new THREE.Vector2(
      0,
      pistonAccelerationY,
    );
    const pistonHead = new THREE.Vector2(
      pistonLineX,
      pistonTopY + pistonHeadCenterOffset,
    );
    const pumpRodTop = rotatePoint(pumpRodJoint, beamAngle);
    const pumpRodVelocity = new THREE.Vector2(
      -pumpRodTop.y * beamAngularVelocity,
      pumpRodTop.x * beamAngularVelocity,
    );
    const pumpRodAcceleration = new THREE.Vector2(
      -pumpRodTop.x * beamAngularVelocity ** 2
        - pumpRodTop.y * beamAngularAcceleration,
      -pumpRodTop.y * beamAngularVelocity ** 2
        + pumpRodTop.x * beamAngularAcceleration,
    );
    const canvasPistonVelocityY = (
      canvasPistonEndY - canvasPistonStartY
    ) * 0.5 * sine * resolvedInputAngularSpeed;
    const canvasPistonAccelerationY = (
      canvasPistonEndY - canvasPistonStartY
    ) * 0.5 * (
      cosine * resolvedInputAngularSpeed ** 2
        + sine * inputAngularAcceleration
    );
    const normalizedPhase = inputAngle / FULL_TURN;
    let cycleStage;
    if (normalizedPhase === 0) {
      cycleStage = 'upper-reversal-condensation-begins';
    } else if (normalizedPhase < 0.5) {
      cycleStage = 'atmospheric-power-stroke-drawing-pump-rod-up';
    } else if (normalizedPhase === 0.5) {
      cycleStage = 'lower-reversal-low-pressure-steam-admission-begins';
    } else {
      cycleStage = 'weighted-pump-rod-return-lifting-piston';
    }

    return {
      beam: {
        angle: beamAngle,
        angularAcceleration: beamAngularAcceleration,
        angularVelocity: beamAngularVelocity,
      },
      canvasApproximation: {
        beamAngle: canvas.beamAngle,
        chainPathLength: canvas.chain.pathLength,
        pistonAccelerationY: canvasPistonAccelerationY,
        pistonHead: canvas.pistonHead,
        pistonTop: canvas.pistonTop,
        pistonVelocityY: canvasPistonVelocityY,
      },
      chain: {
        ...chain,
        attachmentPointAcceleration,
        attachmentPointVelocity,
        lengthResidual: chain.pathLength - constantChainPathLength,
        terminalTangentAcceleration,
        terminalTangentVelocity,
      },
      cycleStage,
      inputAngle,
      inputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      pistonAccelerationY,
      pistonHead,
      pistonTop,
      pistonTopAcceleration,
      pistonTopVelocity,
      pistonVelocityY,
      pumpRodAcceleration,
      pumpRodBottom: pumpRodTop.clone().add(new THREE.Vector2(
        0,
        -pumpRodLength,
      )),
      pumpRodTop,
      pumpRodVelocity,
      sourceCorrection: {
        chainPathLength: chain.pathLength - canvas.chain.pathLength,
        pistonTop: pistonTop.distanceTo(canvas.pistonTop),
        signedPistonY: pistonTop.y - canvas.pistonTop.y,
      },
      strokeProgress: canvas.strokeProgress,
      unwrappedInputAngle,
    };
  };

  const stateAtTime = (time) => {
    const state = stateAtInputTravel(
      inputAngularSpeed * time,
      inputAngularSpeed,
      0,
    );
    state.phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    state.time = time;
    return state;
  };

  const sourceStateAtTime = (time) => canvasStateAtInputTravel(
    inputAngularSpeed * time,
  );

  const chainPointAtDistance = (state, distanceFromPiston) => {
    const distance = THREE.MathUtils.clamp(
      distanceFromPiston,
      0,
      state.chain.pathLength,
    );
    if (distance <= state.chain.straightLength) {
      return {
        acceleration: state.pistonTopAcceleration.clone(),
        angularAcceleration: 0,
        angularVelocity: 0,
        curve: 'vertical-free-chain',
        pathAngle: Math.PI / 2,
        point: new THREE.Vector2(
          pistonLineX,
          state.pistonTop.y + distance,
        ),
        velocity: state.pistonTopVelocity.clone(),
      };
    }
    if (distance <= state.chain.terminalStartDistance) {
      const arcDistance = distance - state.chain.straightLength;
      const angle = Math.PI - arcDistance / pitchRadius;
      const point = new THREE.Vector2(
        pitchRadius * Math.cos(angle),
        pitchRadius * Math.sin(angle),
      );
      return {
        acceleration: new THREE.Vector2(
          -point.x * state.beam.angularVelocity ** 2
            - point.y * state.beam.angularAcceleration,
          -point.y * state.beam.angularVelocity ** 2
            + point.x * state.beam.angularAcceleration,
        ),
        angularAcceleration: state.beam.angularAcceleration,
        angularVelocity: state.beam.angularVelocity,
        curve: 'circular-beam-segment',
        pathAngle: angle - Math.PI / 2,
        point,
        velocity: new THREE.Vector2(
          -point.y * state.beam.angularVelocity,
          point.x * state.beam.angularVelocity,
        ),
      };
    }
    const fraction = (
      distance - state.chain.terminalStartDistance
    ) / state.chain.terminalLength;
    const point = state.chain.terminalTangentPoint.clone().lerp(
      state.chain.attachmentPoint,
      fraction,
    );
    return {
      acceleration: state.chain.terminalTangentAcceleration.clone().lerp(
        state.chain.attachmentPointAcceleration,
        fraction,
      ),
      angularAcceleration: state.beam.angularAcceleration,
      angularVelocity: state.beam.angularVelocity,
      curve: 'terminal-tangent-to-beam-pin',
      pathAngle: Math.atan2(
        state.chain.terminalDirection.y,
        state.chain.terminalDirection.x,
      ),
      point,
      velocity: state.chain.terminalTangentVelocity.clone().lerp(
        state.chain.attachmentPointVelocity,
        fraction,
      ),
    };
  };

  const canonicalTimes = {
    upperPistonReversal: 0,
    powerMidStroke: cyclePeriod / 4,
    lowerPistonReversal: cyclePeriod / 2,
    returnMidStroke: cyclePeriod * 3 / 4,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([key, time]) => [key, stateAtTime(time)]),
  );

  let maximumCanvasChainLength = -Infinity;
  let maximumPistonCorrectionFromCanvas = 0;
  let minimumCanvasChainLength = Infinity;
  let maximumChainLengthResidual = 0;
  let maximumPistonY = -Infinity;
  let minimumPistonY = Infinity;
  for (let sample = 0; sample <= 16384; sample += 1) {
    const state = stateAtInputTravel(FULL_TURN * sample / 16384);
    maximumCanvasChainLength = Math.max(maximumCanvasChainLength,
      state.canvasApproximation.chainPathLength);
    minimumCanvasChainLength = Math.min(minimumCanvasChainLength,
      state.canvasApproximation.chainPathLength);
    maximumPistonCorrectionFromCanvas = Math.max(
      maximumPistonCorrectionFromCanvas,
      state.sourceCorrection.pistonTop,
    );
    maximumChainLengthResidual = Math.max(maximumChainLengthResidual,
      Math.abs(state.chain.lengthResidual));
    maximumPistonY = Math.max(maximumPistonY, state.pistonTop.y);
    minimumPistonY = Math.min(minimumPistonY, state.pistonTop.y);
  }

  const geometry = {
    beamEndAngle: sourceBeamEndAngle,
    beamHalfSwing: sourceBeamHalfSwing,
    beamPivot,
    beamStartAngle: sourceBeamStartAngle,
    canvasPistonEndY,
    canvasPistonStartY,
    chainAttachmentAngle: sourceChainAttachmentAngle,
    chainAttachmentRadius,
    chainLinkCount,
    chainLinkPitch,
    constantChainPathLength,
    cyclePeriod,
    inputAngularSpeed,
    maximumCanvasChainLength,
    maximumCanvasChainLengthDrift:
      maximumCanvasChainLength - minimumCanvasChainLength,
    maximumChainLengthResidual,
    maximumPistonCorrectionFromCanvas,
    maximumPistonY,
    minimumCanvasChainLength,
    minimumPistonY,
    outputStroke: maximumPistonY - minimumPistonY,
    pistonHeadCenterOffset,
    pistonLineX,
    pistonMidY,
    pistonRodLength,
    pitchRadius,
    pumpRodJoint,
    pumpRodLength,
    rawChainAttachment,
    shoeEndAngle: sourceShoeEndAngle,
    shoeInnerRadius: sourceShoeInnerRadius * sourceScale,
    shoeOuterRadius: sourceShoeOuterRadius * sourceScale,
    shoeStartAngle: sourceShoeStartAngle,
    sourceScale,
    terminalTangentAngleOffset: sourceTerminalTangentAngleOffset,
    terminalTangentLength,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.72,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const beamMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.60,
  });
  const chainMaterial = matte(0x4d8963, {
    metalness: 0.10,
    roughness: 0.57,
  });
  const pistonMaterial = matte(PALETTE.driver, {
    metalness: 0.09,
    roughness: 0.59,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.47 });
  const pressureMaterial = matte(PALETTE.fluid, {
    opacity: 0.23,
    roughness: 0.45,
    side: THREE.DoubleSide,
    transparent: true,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-atmospheric-engine-frame-open-cylinder-and-beam-bearing';
  const framePlaneZ = -0.64;
  const baseRail = new THREE.Mesh(
    new THREE.BoxGeometry(29 * sourceScale, 0.72 * sourceScale, 0.88),
    frameMaterial,
  );
  baseRail.position.set(-2 * sourceScale, -23.1 * sourceScale, framePlaneZ);
  baseRail.userData.fixed = true;
  baseRail.userData.role = 'fixed-atmospheric-engine-foundation';
  fixedFrame.add(baseRail);

  const supportColumns = [-1.38, 1.38].map((sourceX, index) => {
    const column = new THREE.Mesh(
      new THREE.BoxGeometry(0.52 * sourceScale, 21 * sourceScale, 0.76),
      frameMaterial,
    );
    column.position.set(sourceX * sourceScale, -11.9 * sourceScale,
      framePlaneZ);
    column.userData.fixed = true;
    column.userData.role = `fixed-central-beam-bearing-column-${index + 1}`;
    fixedFrame.add(column);
    return column;
  });
  const supportCrossRails = [-2.8, -17.2].map((sourceY, index) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(5.4 * sourceScale, 0.48 * sourceScale, 0.82),
      frameMaterial,
    );
    rail.position.set(0, sourceY * sourceScale, framePlaneZ);
    rail.userData.fixed = true;
    rail.userData.role = `fixed-central-frame-cross-rail-${index + 1}`;
    fixedFrame.add(rail);
    return rail;
  });
  const pivotBearing = cylinderAlongZ(1.12 * sourceScale, 0.82,
    frameMaterial, 44);
  pivotBearing.position.set(0, 0, -0.25);
  pivotBearing.userData.fixed = true;
  pivotBearing.userData.role = 'fixed-main-beam-bearing-at-origin';
  const pivotShaft = cylinderAlongZ(0.38 * sourceScale, 1.56,
    darkMaterial, 36);
  pivotShaft.position.set(0, 0, 0.12);
  pivotShaft.userData.fixed = true;
  pivotShaft.userData.role = 'fixed-main-beam-shaft';
  fixedFrame.add(pivotBearing, pivotShaft);

  const cylinderTopY = -11.75 * sourceScale;
  const cylinderBottomY = -22.55 * sourceScale;
  const cylinderHalfWidth = 3.05 * sourceScale;
  const cylinderWalls = [-1, 1].map((side, index) => {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.34 * sourceScale,
        cylinderTopY - cylinderBottomY, 0.82),
      frameMaterial,
    );
    wall.position.set(
      pistonLineX + side * cylinderHalfWidth,
      (cylinderTopY + cylinderBottomY) / 2,
      framePlaneZ,
    );
    wall.userData.fixed = true;
    wall.userData.role = `open-top-cylinder-side-wall-${index + 1}`;
    fixedFrame.add(wall);
    return wall;
  });
  const cylinderBottom = new THREE.Mesh(
    new THREE.BoxGeometry(6.7 * sourceScale, 0.65 * sourceScale, 0.92),
    frameMaterial,
  );
  cylinderBottom.position.set(pistonLineX, cylinderBottomY, framePlaneZ);
  cylinderBottom.userData.fixed = true;
  cylinderBottom.userData.role = 'closed-bottom-of-open-top-cylinder';
  const cylinderLip = [-1, 1].map((side, index) => {
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(0.58 * sourceScale, 0.42 * sourceScale, 1.02),
      frameMaterial,
    );
    lip.position.set(
      pistonLineX + side * cylinderHalfWidth,
      cylinderTopY,
      framePlaneZ,
    );
    lip.userData.fixed = true;
    lip.userData.role = `open-cylinder-top-lip-${index + 1}`;
    fixedFrame.add(lip);
    return lip;
  });
  const cylinderFoot = new THREE.Mesh(
    new THREE.BoxGeometry(8.0 * sourceScale, 0.72 * sourceScale, 1.02),
    frameMaterial,
  );
  cylinderFoot.position.set(pistonLineX,
    (cylinderBottomY - 0.55 * sourceScale), framePlaneZ);
  cylinderFoot.userData.fixed = true;
  cylinderFoot.userData.role = 'flared-cylinder-foundation-foot';
  fixedFrame.add(cylinderBottom, cylinderFoot);

  const pistonGuides = [-0.42, 0.42].map((offset, index) => {
    const guide = new THREE.Mesh(
      new THREE.BoxGeometry(0.15 * sourceScale, 10.2 * sourceScale, 0.42),
      frameMaterial,
    );
    guide.position.set(pistonLineX + offset * sourceScale,
      -6.0 * sourceScale, -0.35);
    guide.userData.fixed = true;
    guide.userData.role = `fixed-piston-rod-guide-${index + 1}`;
    fixedFrame.add(guide);
    return guide;
  });
  root.add(fixedFrame);

  const beam = new THREE.Group();
  beam.userData.axis = Z_AXIS.clone();
  beam.userData.role =
    'one-piece-rocking-atmospheric-beam-with-twelve-unit-chain-segment';
  const lowerBeam = beamBetween3D(
    new THREE.Vector3(-10.55 * sourceScale, -0.92 * sourceScale, 0.28),
    new THREE.Vector3(10.15 * sourceScale, -0.92 * sourceScale, 0.28),
    0.72 * sourceScale,
    0.34,
    beamMaterial,
  );
  lowerBeam.userData.role = 'long-lower-member-of-rocking-beam';
  const crownPoint = new THREE.Vector3(0, 4.55 * sourceScale, 0.28);
  const leftBrace = beamBetween3D(
    new THREE.Vector3(-9.55 * sourceScale, -0.64 * sourceScale, 0.28),
    crownPoint,
    0.34 * sourceScale,
    0.26,
    beamMaterial,
  );
  leftBrace.userData.role = 'left-diagonal-rocking-beam-brace';
  const rightBrace = beamBetween3D(
    crownPoint,
    new THREE.Vector3(9.65 * sourceScale, -0.64 * sourceScale, 0.28),
    0.34 * sourceScale,
    0.26,
    beamMaterial,
  );
  rightBrace.userData.role = 'right-diagonal-rocking-beam-brace';
  const crownPost = beamBetween3D(
    new THREE.Vector3(0, 0, 0.28),
    crownPoint,
    0.48 * sourceScale,
    0.30,
    beamMaterial,
  );
  crownPost.userData.role = 'central-rocking-beam-crown-post';
  const chainShoe = new THREE.Mesh(
    ringSectorGeometry({
      depth: 0.40,
      endAngle: sourceShoeEndAngle,
      innerRadius: sourceShoeInnerRadius * sourceScale,
      outerRadius: sourceShoeOuterRadius * sourceScale,
      startAngle: sourceShoeStartAngle,
    }),
    beamMaterial,
  );
  chainShoe.position.z = 0.30;
  chainShoe.userData.role =
    'curved-left-beam-segment-concentric-with-main-pivot';
  const pivotBoss = cylinderAlongZ(0.88 * sourceScale, 0.47,
    beamMaterial, 40);
  pivotBoss.position.z = 0.34;
  pivotBoss.userData.role = 'moving-main-beam-pivot-boss';
  const pivotBore = cylinderAlongZ(0.33 * sourceScale, 0.52,
    darkMaterial, 32);
  pivotBore.position.z = 0.35;
  pivotBore.userData.role = 'moving-main-beam-pivot-bore';
  const chainAttachmentBoss = cylinderAlongZ(0.46 * sourceScale, 0.46,
    chainMaterial, 32);
  chainAttachmentBoss.position.set(
    rawChainAttachment.x,
    rawChainAttachment.y,
    0.62,
  );
  chainAttachmentBoss.userData.role = 'beam-chain-terminal-boss';
  const chainAttachmentPin = cylinderAlongZ(0.17 * sourceScale, 0.60,
    whiteMaterial, 26);
  chainAttachmentPin.position.set(
    rawChainAttachment.x,
    rawChainAttachment.y,
    0.63,
  );
  chainAttachmentPin.userData.role = 'beam-chain-terminal-pin';
  const chainAttachmentAnchor = new THREE.Object3D();
  chainAttachmentAnchor.position.set(
    rawChainAttachment.x,
    rawChainAttachment.y,
    0.76,
  );
  chainAttachmentAnchor.userData.role = 'analytic-chain-terminal-on-beam';
  const pumpJointBoss = cylinderAlongZ(0.50 * sourceScale, 0.44,
    pistonMaterial, 34);
  pumpJointBoss.position.set(pumpRodJoint.x, pumpRodJoint.y, 0.20);
  pumpJointBoss.userData.role = 'far-end-weighted-pump-rod-joint';
  const pumpJointAnchor = new THREE.Object3D();
  pumpJointAnchor.position.set(pumpRodJoint.x, pumpRodJoint.y, 0.20);
  pumpJointAnchor.userData.role = 'analytic-far-end-pump-rod-joint';
  beam.add(
    lowerBeam,
    leftBrace,
    rightBrace,
    crownPost,
    chainShoe,
    pivotBoss,
    pivotBore,
    chainAttachmentBoss,
    chainAttachmentPin,
    chainAttachmentAnchor,
    pumpJointBoss,
    pumpJointAnchor,
  );
  const shoeIndexBosses = [158.5, 180, 200].map((degrees, index) => {
    const angle = THREE.MathUtils.degToRad(degrees);
    const radius = 10.83 * sourceScale;
    const boss = cylinderAlongZ(0.31 * sourceScale, 0.44,
      beamMaterial, 28);
    boss.position.set(radius * Math.cos(angle),
      radius * Math.sin(angle), 0.31);
    boss.userData.role = `curved-segment-web-boss-${index + 1}`;
    const bore = cylinderAlongZ(0.12 * sourceScale, 0.48,
      whiteMaterial, 24);
    bore.position.copy(boss.position);
    bore.userData.role = `curved-segment-web-hole-${index + 1}`;
    beam.add(boss, bore);
    return { bore, boss };
  });
  root.add(beam);

  const piston = new THREE.Group();
  piston.userData.rotationDegreesOfFreedom = 0;
  piston.userData.role =
    'vertical-piston-and-rod-in-open-top-atmospheric-cylinder';
  const pistonTopBoss = cylinderAlongZ(0.43 * sourceScale, 0.38,
    pistonMaterial, 32);
  pistonTopBoss.position.z = 0.42;
  pistonTopBoss.userData.role = 'piston-rod-chain-connection-eye';
  const pistonTopPin = cylinderAlongZ(0.15 * sourceScale, 0.52,
    whiteMaterial, 24);
  pistonTopPin.position.z = 0.43;
  pistonTopPin.userData.role = 'piston-rod-chain-connection-pin';
  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(0.38 * sourceScale, pistonRodLength, 0.22),
    pistonMaterial,
  );
  pistonRod.position.set(0, -pistonRodLength / 2, 0.42);
  pistonRod.userData.role = 'long-atmospheric-piston-rod';
  const pistonHead = new THREE.Mesh(
    new THREE.BoxGeometry(5.25 * sourceScale, 0.90 * sourceScale, 0.74),
    pistonMaterial,
  );
  pistonHead.position.set(0, pistonHeadCenterOffset, 0.24);
  pistonHead.userData.role = 'working-atmospheric-piston-head';
  const pistonTopAnchor = new THREE.Object3D();
  pistonTopAnchor.position.z = 0.42;
  pistonTopAnchor.userData.role = 'analytic-top-of-piston-rod';
  const pistonHeadAnchor = new THREE.Object3D();
  pistonHeadAnchor.position.set(0, pistonHeadCenterOffset, 0.24);
  pistonHeadAnchor.userData.role = 'analytic-piston-head-center';
  piston.add(
    pistonTopBoss,
    pistonTopPin,
    pistonRod,
    pistonHead,
    pistonTopAnchor,
    pistonHeadAnchor,
  );
  root.add(piston);

  const weightedPumpRod = new THREE.Group();
  weightedPumpRod.userData.rotationDegreesOfFreedom = 0;
  weightedPumpRod.userData.role =
    'gravity-hanging-pump-rod-at-opposite-end-of-beam';
  const pumpRodTopBoss = cylinderAlongZ(0.45 * sourceScale, 0.40,
    pistonMaterial, 32);
  pumpRodTopBoss.position.z = 0.20;
  pumpRodTopBoss.userData.role = 'weighted-pump-rod-top-eye';
  const pumpRodBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.42 * sourceScale, pumpRodLength, 0.24),
    pistonMaterial,
  );
  pumpRodBody.position.set(0, -pumpRodLength / 2, 0.20);
  pumpRodBody.userData.role = 'heavy-pump-rod-return-member';
  const pumpWeight = new THREE.Mesh(
    new THREE.BoxGeometry(2.7 * sourceScale, 1.35 * sourceScale, 0.82),
    pistonMaterial,
  );
  pumpWeight.position.set(0, -pumpRodLength, 0.08);
  pumpWeight.userData.role = 'pump-rod-return-weight';
  const pumpRodTopAnchor = new THREE.Object3D();
  pumpRodTopAnchor.position.z = 0.20;
  pumpRodTopAnchor.userData.role = 'analytic-weighted-pump-rod-top';
  weightedPumpRod.add(
    pumpRodTopBoss,
    pumpRodBody,
    pumpWeight,
    pumpRodTopAnchor,
  );
  root.add(weightedPumpRod);

  const pressureVolume = new THREE.Mesh(
    new THREE.BoxGeometry(5.45 * sourceScale, 1, 0.52),
    pressureMaterial,
  );
  pressureVolume.position.z = -0.02;
  pressureVolume.userData.role =
    'animated-low-pressure-steam-or-condensed-vacuum-below-piston';
  root.add(pressureVolume);

  const chainLinks = Array.from({ length: chainLinkCount }, (_, index) => {
    const parts = makeFlexibleChainLink({
      chainMaterial,
      darkMaterial,
      depth: 0.13,
      nominalPitch: chainLinkPitch,
      width: 0.57 * sourceScale,
    });
    parts.link.userData.index = index;
    root.add(parts.link);
    return parts;
  });
  const terminalConnectorNominalLength = constantChainPathLength
    - chainLinkCount * chainLinkPitch;
  const chainTerminalConnector = new THREE.Mesh(
    new THREE.BoxGeometry(terminalConnectorNominalLength,
      0.14 * sourceScale, 0.14),
    chainMaterial,
  );
  chainTerminalConnector.position.z = 0.76;
  chainTerminalConnector.userData.nominalLength =
    terminalConnectorNominalLength;
  chainTerminalConnector.userData.role =
    'short-terminal-chain-connector-to-rocking-beam';
  root.add(chainTerminalConnector);

  const contacts = {
    beamPivot: {
      fixedMember: fixedFrame,
      movingMember: beam,
      point: new THREE.Vector3(0, 0, 0.34),
      type: 'fixed-main-rocking-beam-revolute-pair',
    },
    chainAtPiston: {
      members: [piston, chainLinks[0].link],
      point: new THREE.Vector3(),
      type: 'chain-to-piston-rod-pin',
    },
    chainAtShoeTangent: {
      members: [beam, ...chainLinks.map(({ link }) => link)],
      point: new THREE.Vector3(-pitchRadius, 0, 0.76),
      type: 'tangent-continuous-chain-on-circular-beam-segment',
    },
    chainAtBeam: {
      members: [beam, chainTerminalConnector],
      point: new THREE.Vector3(),
      type: 'chain-terminal-to-moving-beam-pin',
    },
    pumpRodAtBeam: {
      members: [beam, weightedPumpRod],
      point: new THREE.Vector3(),
      type: 'far-end-beam-to-weighted-pump-rod-pin',
    },
  };

  const placeSpan = (mesh, start, end, nominalLength) => {
    const delta = end.clone().sub(start);
    mesh.position.set(
      (start.x + end.x) / 2,
      (start.y + end.y) / 2,
      0.76,
    );
    mesh.rotation.z = Math.atan2(delta.y, delta.x);
    mesh.scale.x = delta.length() / nominalLength;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    beam.rotation.z = state.beam.angle;
    beam.userData.angularSpeed = state.beam.angularVelocity;
    beam.userData.angularAcceleration = state.beam.angularAcceleration;
    piston.position.set(state.pistonTop.x, state.pistonTop.y, 0);
    piston.userData.velocity = new THREE.Vector3(
      state.pistonTopVelocity.x,
      state.pistonTopVelocity.y,
      0,
    );
    piston.userData.acceleration = new THREE.Vector3(
      state.pistonTopAcceleration.x,
      state.pistonTopAcceleration.y,
      0,
    );
    weightedPumpRod.position.set(state.pumpRodTop.x,
      state.pumpRodTop.y, 0);
    weightedPumpRod.userData.velocity = new THREE.Vector3(
      state.pumpRodVelocity.x,
      state.pumpRodVelocity.y,
      0,
    );
    weightedPumpRod.userData.acceleration = new THREE.Vector3(
      state.pumpRodAcceleration.x,
      state.pumpRodAcceleration.y,
      0,
    );

    chainLinks.forEach((parts, index) => {
      const start = chainPointAtDistance(state, index * chainLinkPitch).point;
      const end = chainPointAtDistance(
        state,
        (index + 1) * chainLinkPitch,
      ).point;
      const delta = end.clone().sub(start);
      const chordLength = delta.length();
      parts.link.position.set(start.x, start.y, 0);
      parts.link.rotation.z = Math.atan2(delta.y, delta.x);
      parts.body.scale.x = chordLength / chainLinkPitch;
      parts.body.position.x = chordLength / 2;
      parts.endBoss.position.x = chordLength;
      parts.endPin.position.x = chordLength;
      parts.endAnchor.position.x = chordLength;
      parts.link.userData.chordLength = chordLength;
      parts.link.userData.startCurve = chainPointAtDistance(
        state,
        index * chainLinkPitch,
      ).curve;
      parts.link.userData.endCurve = chainPointAtDistance(
        state,
        (index + 1) * chainLinkPitch,
      ).curve;
    });
    const lastChainPoint = chainPointAtDistance(
      state,
      chainLinkCount * chainLinkPitch,
    ).point;
    placeSpan(chainTerminalConnector, lastChainPoint,
      state.chain.attachmentPoint, terminalConnectorNominalLength);

    const volumeTop = state.pistonHead.y - 0.46 * sourceScale;
    const volumeHeight = Math.max(0.10, volumeTop - cylinderBottomY);
    pressureVolume.scale.y = volumeHeight;
    pressureVolume.position.set(
      pistonLineX,
      cylinderBottomY + volumeHeight / 2,
      -0.02,
    );
    if (state.phase < 0.5) {
      pressureMaterial.color.setHex(PALETTE.fluid);
      pressureMaterial.opacity = 0.20;
    } else {
      pressureMaterial.color.setHex(0xd89a55);
      pressureMaterial.opacity = 0.25;
    }

    contacts.chainAtPiston.point.set(
      state.pistonTop.x,
      state.pistonTop.y,
      0.76,
    );
    contacts.chainAtBeam.point.set(
      state.chain.attachmentPoint.x,
      state.chain.attachmentPoint.y,
      0.76,
    );
    contacts.pumpRodAtBeam.point.set(
      state.pumpRodTop.x,
      state.pumpRodTop.y,
      0.20,
    );
    contacts.chainAtShoeTangent.chainSurfaceVelocity = new THREE.Vector3(
      0,
      state.pistonVelocityY,
      0,
    );
    contacts.chainAtShoeTangent.shoeSurfaceVelocity = new THREE.Vector3(
      0,
      -pitchRadius * state.beam.angularVelocity,
      0,
    );
    contacts.chainAtShoeTangent.surfaceVelocityError =
      contacts.chainAtShoeTangent.chainSurfaceVelocity.clone().sub(
        contacts.chainAtShoeTangent.shoeSurfaceVelocity,
      );
    contacts.chainAtShoeTangent.pathLength = state.chain.pathLength;
    root.userData.kinematics = state;
  };

  const officialViewMinimum = new THREE.Vector2(-17.402965, -14.011987);
  const officialViewWidth = 22;
  const officialViewHeight = 22;
  const officialCanvasWidth = 525;
  const officialCanvasHeight = 525;
  const modelPointToOfficialAnimationRaster = (point) => {
    const sourceX = point.x / sourceScale;
    const sourceY = point.y / sourceScale;
    return new THREE.Vector2(
      (sourceX - officialViewMinimum.x)
        * officialCanvasWidth / officialViewWidth,
      officialCanvasHeight - (sourceY - officialViewMinimum.y)
        * officialCanvasHeight / officialViewHeight,
    );
  };

  root.userData.archetype =
    'atmospheric-single-acting-rocking-beam-chain-pumping-engine';
  root.userData.blocks = {
    baseRail,
    beam,
    chainAttachmentAnchor,
    chainAttachmentBoss,
    chainAttachmentPin,
    chainLinks,
    chainShoe,
    chainTerminalConnector,
    crownPost,
    cylinderBottom,
    cylinderFoot,
    cylinderLip,
    cylinderWalls,
    fixedFrame,
    leftBrace,
    lowerBeam,
    piston,
    pistonGuides,
    pistonHead,
    pistonHeadAnchor,
    pistonRod,
    pistonTopAnchor,
    pistonTopBoss,
    pistonTopPin,
    pivotBearing,
    pivotBore,
    pivotBoss,
    pivotShaft,
    pressureVolume,
    pumpJointAnchor,
    pumpJointBoss,
    pumpRodBody,
    pumpRodTopAnchor,
    pumpRodTopBoss,
    pumpWeight,
    rightBrace,
    shoeIndexBosses,
    supportColumns,
    supportCrossRails,
    weightedPumpRod,
  };
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-16.6 * sourceScale, -24.1 * sourceScale, -1.08),
    new THREE.Vector3(12.0 * sourceScale, 9.2 * sourceScale, 1.18),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.chainPointAtDistance = chainPointAtDistance;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    drivingCycle:
      'condensation and atmospheric pressure drive the downstroke; the weighted pump rod returns the beam while low-pressure steam is admitted',
    mechanism: 1,
    output:
      'the chain-constrained piston reciprocates vertically while the opposite weighted pump rod rises and falls',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = -7.25;
  root.userData.mechanism =
    'open-top-cylinder-piston-constant-length-chain-circular-beam-segment-fixed-beam-pivot-and-opposite-weighted-pump-rod';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: sourceCyclesPerMinute,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialFunctionChain: [
      'add_stat',
      'add_pos_interp',
      'add_pos_interp',
      'add_belt',
      'add_text',
    ],
    officialGeometry: {
      beamEndRay: sourceBeamEndRay,
      beamHalfSwing: sourceBeamHalfSwing,
      beamPivot: sourceBeamPivot,
      beamStartRay: sourceBeamStartRay,
      canvasPistonEndLine: [
        new THREE.Vector2(-12, -10.189),
        new THREE.Vector2(-11, -10.189),
      ],
      canvasPistonStartLine: [
        new THREE.Vector2(-12, -1.811),
        new THREE.Vector2(-11, -1.811),
      ],
      chainAttachment: sourceRawChainAttachment,
      chainLinkPitch: sourceChainLinkPitch,
      pistonHeadCenterOffset: sourcePistonHeadCenterOffset,
      pistonRodLength: sourcePistonRodLength,
      pitchRadius: sourcePitchRadius,
      shoeEndAngle: sourceShoeEndAngle,
      shoeInnerRadius: sourceShoeInnerRadius,
      shoeOuterRadius: sourceShoeOuterRadius,
      shoeStartAngle: sourceShoeStartAngle,
    },
    officialPageAnimatedTabDisabled: false,
    physicalCorrection: {
      canvasChainLengthDriftModel:
        maximumCanvasChainLength - minimumCanvasChainLength,
      canvasChainLengthDriftSource:
        (maximumCanvasChainLength - minimumCanvasChainLength) / sourceScale,
      correctedPistonLaw:
        'y=-6-12*beamAngle in source units',
      maximumPistonEndpointCorrectionModel:
        maximumPistonCorrectionFromCanvas,
      maximumPistonEndpointCorrectionSource:
        maximumPistonCorrectionFromCanvas / sourceScale,
      reason:
        'the source piston endpoints are rounded to three decimals, while a flexible inextensible chain requires free-span payout to equal circular-segment winding exactly',
    },
    referenceScope:
      'official trussed rocking beam, twelve-unit circular chain segment, chain attachment, piston endpoints, open cylinder, ±20-degree source interpolation, view, and 15-cycle-per-minute timing',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate342: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'a chain suspends the piston rod from a circular segment concentric with the rocking-beam pivot; the weighted pump rod acts at the opposite end',
      measurementUncertaintyPixels: 4,
    },
    officialAnimationView: {
      canvasHeight: officialCanvasHeight,
      canvasWidth: officialCanvasWidth,
      minimum: officialViewMinimum,
      viewHeight: officialViewHeight,
      viewWidth: officialViewWidth,
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.sourceStateAtTime = sourceStateAtTime;
  root.userData.stateAtInputTravel = stateAtInputTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    canvasRounding:
      'source piston endpoints -1.811 and -10.189 make the nominal chain length drift by 0.000421831 source unit',
    exactConstraint:
      'the physical piston obeys y=-6-12*theta, so its vertical payout exactly cancels chain winding on the twelve-unit circular beam segment',
    input:
      'condensation creates a vacuum below the piston for the atmospheric downstroke; low-pressure admission and pump-rod weight produce the return',
    output:
      'the piston descends 8.377578 source units while the far beam end raises the weighted pump rod',
  };

  update(0);
  markShadows(root);
  pressureVolume.castShadow = false;
  return {
    cameraDirection: new THREE.Vector3(5.0, 3.5, 13.8),
    root,
    update,
  };
}

export function createAuthoredAtmosphericBeamEngine(movement) {
  switch (movement.id) {
    case 342: return atmosphericChainBeamPumpingEngine(movement);
    default: return null;
  }
}
