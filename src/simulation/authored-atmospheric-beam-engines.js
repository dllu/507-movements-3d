import {boredCylinderGeometry, fitPistonGuide} from './piston-guide-parts.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
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

function arcPoints(radius, start, end, count) {
  return Array.from({ length: count + 1 }, (_, index) => {
    const angle = start + (end - start) * index / count;
    return new THREE.Vector2(radius * Math.cos(angle), radius * Math.sin(angle));
  });
}

function roundEnd(center, radius, radial, tangent, sign, count) {
  return Array.from({ length: count - 1 }, (_, index) => {
    const psi = Math.PI * (index + 1) / count;
    return center.clone()
      .addScaledVector(radial, sign * radius * Math.cos(psi))
      .addScaledVector(tangent, sign * radius * Math.sin(psi));
  });
}

function quadraticPoints(start, control, end, count) {
  return new THREE.QuadraticBezierCurve(start, control, end)
    .getPoints(count).slice(1);
}

function extrudeCentered(shape, depth) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function extrudedOutline(points, scale, depth) {
  return extrudeCentered(new THREE.Shape(
    points.map(([x, y]) => new THREE.Vector2(x * scale, y * scale)),
  ), depth);
}

// Detour under the separately bored pivot boss where a top edge at height y
// (below the pivot) crosses it, running right to left.
function pivotNotch(radius, y) {
  const half = Math.sqrt(radius ** 2 - y ** 2);
  return arcPoints(radius, Math.atan2(y, half), Math.atan2(y, -half), 32);
}

// One casting in the beam frame: Brown's slotted arched segment head, its
// round ends, filleted roots and the straight beam running past the pivot.
function segmentHeadBeamGeometry({
  beamBottom,
  beamEnd,
  beamTop,
  bottomFillet,
  depth,
  endAngle,
  innerRadius,
  outerRadius,
  pivotBossRadius,
  scale,
  slotEnd,
  slotHalfWidth,
  slotStart,
  startAngle,
  topFillet,
}) {
  const mid = (outerRadius + innerRadius) / 2;
  const cap = (outerRadius - innerRadius) / 2;
  const radialAt = angle => new THREE.Vector2(Math.cos(angle), Math.sin(angle));
  const tangentAt = angle => new THREE.Vector2(-Math.sin(angle), Math.cos(angle));
  const endRadial = radialAt(endAngle);
  const startRadial = radialAt(startAngle);
  const innerEnd = endRadial.clone().multiplyScalar(innerRadius);
  const topJoin = radialAt(topFillet.joinAngle).multiplyScalar(innerRadius);
  const outline = [
    ...arcPoints(outerRadius, startAngle, endAngle, 120),
    ...roundEnd(endRadial.clone().multiplyScalar(mid), cap, endRadial,
      tangentAt(endAngle), 1, 16),
    innerEnd,
    ...quadraticPoints(innerEnd, bottomFillet.control, bottomFillet.end, 18),
    new THREE.Vector2(beamEnd, beamBottom),
    new THREE.Vector2(beamEnd, beamTop),
    ...pivotNotch(pivotBossRadius, beamTop),
    topFillet.start.clone(),
    ...quadraticPoints(topFillet.start, topFillet.control, topJoin, 18),
    ...arcPoints(innerRadius, topFillet.joinAngle, startAngle, 24).slice(1),
    ...roundEnd(startRadial.clone().multiplyScalar(mid), cap, startRadial,
      tangentAt(startAngle), -1, 16),
  ];
  const slotStartRadial = radialAt(slotStart);
  const slotEndRadial = radialAt(slotEnd);
  const slot = [
    ...arcPoints(mid + slotHalfWidth, slotStart, slotEnd, 60),
    ...roundEnd(slotEndRadial.clone().multiplyScalar(mid), slotHalfWidth,
      slotEndRadial, tangentAt(slotEnd), 1, 10),
    ...arcPoints(mid - slotHalfWidth, slotEnd, slotStart, 60),
    ...roundEnd(slotStartRadial.clone().multiplyScalar(mid), slotHalfWidth,
      slotStartRadial, tangentAt(slotStart), -1, 10),
  ];
  const shape = new THREE.Shape(outline.map(point => point.multiplyScalar(scale)));
  shape.holes.push(new THREE.Path(slot.map(point => point.multiplyScalar(scale))));
  return extrudeCentered(shape, depth);
}

// A side plate spanning two pin centres whose ends are hollowed to seat
// against the round end bosses instead of passing through them.
function concaveEndPlateGeometry(length, width, depth, endRadius) {
  const half = width / 2;
  const inset = Math.sqrt(endRadius ** 2 - half ** 2);
  const swing = Math.atan2(half, inset);
  const left = -length / 2;
  const right = length / 2;
  const points = [
    new THREE.Vector2(left + inset, -half),
    new THREE.Vector2(right - inset, -half),
    ...arcPoints(endRadius, Math.PI + swing, Math.PI - swing, 12)
      .map(point => point.add(new THREE.Vector2(right, 0))).slice(1, -1),
    new THREE.Vector2(right - inset, half),
    new THREE.Vector2(left + inset, half),
    ...arcPoints(endRadius, swing, -swing, 12)
      .map(point => point.add(new THREE.Vector2(left, 0))).slice(1, -1),
  ];
  return extrudeCentered(new THREE.Shape(points), depth);
}

function makeFlexibleChainLink({
  chainMaterial,
  darkMaterial,
  depth,
  nominalPitch,
  planeZ,
  width,
}) {
  const link = new THREE.Group();
  link.userData.nominalPitch = nominalPitch;
  link.userData.role = 'articulated-atmospheric-engine-chain-link';
  const body = new THREE.Mesh(
    concaveEndPlateGeometry(nominalPitch, width, depth, width * 0.62 + .001),
    chainMaterial,
  );
  body.position.set(nominalPitch / 2, 0, planeZ);
  body.userData.role = 'green-chain-link-side-plate';
  const startBoss = cylinderAlongZ(width * 0.62, depth * 1.25,
    chainMaterial, 28);
  startBoss.geometry.dispose();
  startBoss.geometry = boredCylinderGeometry(width * .62, .054, depth * 1.25);
  startBoss.position.z = planeZ;
  startBoss.userData.role = 'chain-link-start-boss';
  const endBoss = cylinderAlongZ(width * 0.62, depth * 1.25,
    chainMaterial, 28);
  endBoss.geometry.dispose();
  endBoss.geometry = boredCylinderGeometry(width * .62, .054, depth * 1.25);
  endBoss.position.set(nominalPitch, 0, planeZ);
  endBoss.userData.role = 'chain-link-end-boss';
  const startPin = cylinderAlongZ(.051, .84,
    darkMaterial, 22);
  startPin.position.z = .57;
  startPin.userData.role = 'chain-link-start-pin';
  const endPin = cylinderAlongZ(.051, .84,
    darkMaterial, 22);
  endPin.position.set(nominalPitch, 0, .57);
  endPin.userData.role = 'chain-link-end-pin';
  const startAnchor = new THREE.Object3D();
  startAnchor.position.z = 0.76;
  startAnchor.userData.role = 'analytic-chain-link-start';
  const endAnchor = new THREE.Object3D();
  endAnchor.position.set(nominalPitch, 0, 0.76);
  endAnchor.userData.role = 'analytic-chain-link-end';
  const roller = cylinderAlongZ(.09, .20, chainMaterial, 64);
  roller.geometry.dispose();
  roller.geometry = boredCylinderGeometry(.09, .054, .20);
  roller.position.z = .30;
  roller.userData.role = 'chain-pin-roller-bearing-on-circular-shoe';
  const endRoller = roller.clone();
  endRoller.position.x = nominalPitch;
  link.add(roller, endRoller);
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
    roller,
    endRoller,
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
  const chainLinkCount = 10;

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

  // Brown draws the beam rising about 12 degrees toward the pivot, with the
  // segment head down: the beam edges read 10-14 degrees, and at 12 degrees
  // the chain-top block (+2.7 source units) and piston crosshead (about -8.5)
  // sit where the plate draws them. Model time 0 is that plate pose on the
  // atmospheric downstroke; the official animation's t=0 upper reversal falls
  // at canonicalTimes.upperPistonReversal.
  const plateBeamAngle = THREE.MathUtils.degToRad(12);
  const plateInputAngle = Math.acos(-plateBeamAngle / sourceBeamHalfSwing);
  const plateTimeOffset = plateInputAngle / inputAngularSpeed;

  const stateAtTime = (time) => {
    const state = stateAtInputTravel(
      inputAngularSpeed * time + plateInputAngle,
      inputAngularSpeed,
      0,
    );
    state.phase = positiveModulo(time + plateTimeOffset, cyclePeriod)
      / cyclePeriod;
    state.time = time;
    return state;
  };

  // The official canvas keeps its own clock (t=0 at the upper reversal).
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

  const sourceTime = (fraction) => positiveModulo(
    cyclePeriod * fraction - plateTimeOffset,
    cyclePeriod,
  );
  const canonicalTimes = {
    platePose: 0,
    upperPistonReversal: sourceTime(0),
    powerMidStroke: sourceTime(1 / 4),
    lowerPistonReversal: sourceTime(1 / 2),
    returnMidStroke: sourceTime(3 / 4),
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
    plateBeamAngle,
    plateInputAngle,
    plateTimeOffset,
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
  // A mid stone tone: the pale 0xb9b1a2 read washed-out beside the plate's
  // firmly drawn pier.
  const masonryMaterial = matte(0x7d776d, { roughness: 0.9 });
  const timberMaterial = matte(0x9a8466, { roughness: 0.85 });
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
  const stayMaterial = matte(PALETTE.frame, { metalness: 0.2, roughness: 0.55 });

  const fixedBox = (min, max, z0, z1, material, role) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(
      (max.x - min.x) * sourceScale,
      (max.y - min.y) * sourceScale,
      z1 - z0,
    ), material);
    mesh.position.set(
      (min.x + max.x) / 2 * sourceScale,
      (min.y + max.y) / 2 * sourceScale,
      (z0 + z1) / 2,
    );
    mesh.userData.fixed = true;
    mesh.userData.role = role;
    return mesh;
  };

  // Brown's plate 342 is a close-up of the cylinder end only. Its segment arc
  // is concentric with the strap bolt at plate pixel (442, 162), 28.1 pixels
  // per source unit, with the beam drawn at about +12 degrees.
  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-atmospheric-engine-pier-open-cylinder-and-beam-bearing';
  const wallTopY = -2.78;
  const masonryPier = fixedBox(new THREE.Vector2(-1.6, -13.6),
    new THREE.Vector2(1.78, wallTopY), -1.4, 0, masonryMaterial,
    'fixed-masonry-bob-wall-pier-behind-beam');
  // Brown's plank runs the full plate width over the pier; nothing is
  // drawn beside the pier.
  const floorBeam = fixedBox(new THREE.Vector2(-14.66, wallTopY),
    new THREE.Vector2(6.0, -1.39), -1.0, -0.55, timberMaterial,
    'fixed-horizontal-floor-beam-behind-engine');
  const bearingPedestal = fixedBox(new THREE.Vector2(-0.75, wallTopY),
    new THREE.Vector2(0.75, -0.8), -0.54, -0.10, frameMaterial,
    'fixed-plummer-block-pedestal-on-wall-top');
  const pivotBearing = cylinderAlongZ(1.12 * sourceScale, 0.44,
    frameMaterial, 44);
  pivotBearing.position.set(0, 0, -.32);
  pivotBearing.geometry.dispose();
  pivotBearing.geometry = boredCylinderGeometry(1.12 * sourceScale, .38 * sourceScale + .012, .44);
  pivotBearing.userData.fixed = true;
  pivotBearing.userData.role = 'fixed-main-beam-bearing-at-origin';
  const pivotShaft = cylinderAlongZ(0.38 * sourceScale, 1.22,
    darkMaterial, 36);
  pivotShaft.position.set(0, 0, -0.01);
  pivotShaft.userData.fixed = true;
  pivotShaft.userData.role = 'fixed-main-beam-shaft';
  fixedFrame.add(masonryPier, floorBeam, bearingPedestal,
    pivotBearing, pivotShaft);

  const cylinderZ = .42;
  const cylinderTopY = -9.79 * sourceScale;
  const cylinderBottomY = -23.2 * sourceScale;
  const cylinderBoreRadius = 2.40 * sourceScale;
  const cylinderBarrelRadius = 2.67 * sourceScale;
  const openCylinder = new THREE.Mesh(boredLatheGeometry([
    { axial: cylinderBottomY, radial: cylinderBarrelRadius },
    { axial: -10.43 * sourceScale, radial: cylinderBarrelRadius },
    { axial: -9.97 * sourceScale, radial: 3.2 * sourceScale },
    { axial: cylinderTopY, radial: 3.2 * sourceScale },
  ], cylinderBoreRadius, 72), frameMaterial);
  openCylinder.position.set(pistonLineX, 0, cylinderZ);
  openCylinder.userData.fixed = true;
  openCylinder.userData.role = 'open-top-atmospheric-cylinder-with-flared-rim';
  const cylinderBottom = new THREE.Mesh(new THREE.CylinderGeometry(
    cylinderBarrelRadius, cylinderBarrelRadius, 0.6 * sourceScale, 72,
  ), frameMaterial);
  cylinderBottom.position.set(pistonLineX,
    cylinderBottomY + 0.3 * sourceScale, cylinderZ);
  cylinderBottom.userData.fixed = true;
  cylinderBottom.userData.role = 'closed-bottom-of-open-top-cylinder';
  fixedFrame.add(openCylinder, cylinderBottom);
  root.add(fixedFrame);

  const beam = new THREE.Group();
  beam.userData.axis = Z_AXIS.clone();
  beam.userData.role =
    'one-piece-rocking-atmospheric-beam-with-twelve-unit-chain-segment';
  const beamTopY = -0.17;
  const beamBottomY = -1.89;
  const chainShoe = new THREE.Mesh(
    segmentHeadBeamGeometry({
      beamBottom: beamBottomY,
      beamEnd: 6.8,
      beamTop: beamTopY,
      bottomFillet: {
        control: new THREE.Vector2(-8.4, -2.0),
        end: new THREE.Vector2(-6.2, beamBottomY),
      },
      depth: 0.40,
      endAngle: sourceShoeEndAngle,
      innerRadius: 10.4,
      outerRadius: sourceShoeOuterRadius,
      pivotBossRadius: 0.7,
      scale: sourceScale,
      slotEnd: THREE.MathUtils.degToRad(202),
      slotHalfWidth: 0.24,
      slotStart: THREE.MathUtils.degToRad(158),
      startAngle: sourceShoeStartAngle,
      topFillet: {
        control: new THREE.Vector2(-10.1, beamTopY),
        joinAngle: THREE.MathUtils.degToRad(175),
        start: new THREE.Vector2(-7.6, beamTopY),
      },
    }),
    beamMaterial,
  );
  chainShoe.position.z = 0.30;
  chainShoe.userData.role =
    'slotted-arched-segment-head-and-beam-concentric-with-main-pivot';
  const lowerBeam = chainShoe;
  const pivotBossRadius = 0.7;
  const postFoot = beamTopY - 0.2;
  const postRight = 0.21;
  const kingPost = new THREE.Mesh(extrudedOutline([
    [-1.23, postFoot],
    ...arcPoints(pivotBossRadius,
      Math.atan2(postFoot, -Math.sqrt(pivotBossRadius ** 2 - postFoot ** 2))
        + Math.PI * 2,
      Math.acos(postRight / pivotBossRadius), 32).map(({ x, y }) => [x, y]),
    [postRight, 3.55], [-0.22, 4.35], [-0.8, 4.35], [-1.23, 3.55],
  ], sourceScale, 0.34), beamMaterial);
  kingPost.position.z = 0.30;
  kingPost.userData.role = 'king-post-strapped-over-beam-pivot';
  const strapParts = [
    [[-1.60, -2.15], [-1.30, 1.25], 0.50, 0.56, 'left-leg'],
    [[0.85, -2.15], [1.15, 1.25], 0.50, 0.56, 'right-leg'],
    [[-1.80, 0.75], [1.45, 1.25], 0.08, 0.56, 'cap'],
    [[-1.80, -2.20], [1.45, beamBottomY], 0.08, 0.56, 'bottom-bar'],
    [[-1.75, 1.25], [-1.15, 1.50], 0.20, 0.50, 'left-nut'],
    [[0.70, 1.25], [1.30, 1.50], 0.20, 0.50, 'right-nut'],
  ].map(([min, max, z0, z1, name]) => {
    const part = fixedBox(new THREE.Vector2(...min), new THREE.Vector2(...max),
      z0, z1, stayMaterial, `king-post-u-strap-${name}`);
    part.userData.fixed = false;
    return part;
  });
  const pivotBoss = cylinderAlongZ(0.7 * sourceScale, 0.44,
    beamMaterial, 40);
  pivotBoss.geometry.dispose();
  pivotBoss.geometry = boredCylinderGeometry(pivotBossRadius * sourceScale, .38 * sourceScale + .012, .44);
  pivotBoss.position.z = 0.30;
  pivotBoss.userData.role = 'moving-main-beam-pivot-boss';
  const pivotBore = pivotBoss;
  const chainLug = new THREE.Mesh(
    new THREE.BoxGeometry(1.3 * sourceScale, 0.9 * sourceScale, 0.40),
    beamMaterial,
  );
  chainLug.position.set(
    11.65 * sourceScale * Math.cos(sourceChainAttachmentAngle),
    11.65 * sourceScale * Math.sin(sourceChainAttachmentAngle),
    0.30,
  );
  chainLug.rotation.z = sourceChainAttachmentAngle;
  chainLug.userData.role = 'segment-head-chain-lug';
  const chainAttachmentBoss = cylinderAlongZ(0.46 * sourceScale, .20,
    chainMaterial, 32);
  chainAttachmentBoss.geometry.dispose();
  chainAttachmentBoss.geometry = boredCylinderGeometry(.46 * sourceScale, .054, .20);
  chainAttachmentBoss.position.set(
    rawChainAttachment.x,
    rawChainAttachment.y,
    .40,
  );
  chainAttachmentBoss.userData.role = 'beam-chain-terminal-boss';
  const chainAttachmentPin = cylinderAlongZ(0.17 * sourceScale, .80,
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
  beam.add(
    chainShoe,
    kingPost,
    ...strapParts,
    pivotBoss,
    chainLug,
    chainAttachmentBoss,
    chainAttachmentPin,
    chainAttachmentAnchor,
  );

  const polarPoint = (radius, degrees) => new THREE.Vector2(
    radius * Math.cos(THREE.MathUtils.degToRad(degrees)),
    radius * Math.sin(THREE.MathUtils.degToRad(degrees)),
  );
  const postTopPin = new THREE.Vector2(-0.5, 3.85);
  const stays = [
    [polarPoint(10.55, 157.5), new THREE.Vector2(-5.96, -1.05), 0.58,
      'segment-top-to-beam-diagonal-stay'],
    [postTopPin, new THREE.Vector2(-9.74, -1.15), 0.70,
      'king-post-to-segment-root-diagonal-stay'],
    [postTopPin, new THREE.Vector2(5.7, -0.45), 0.58,
      'king-post-to-far-beam-stay'],
  ].map(([start, end, z, role]) => {
    const stay = new THREE.Group();
    stay.userData.role = role;
    const from = new THREE.Vector3(start.x * sourceScale, start.y * sourceScale, z);
    const to = new THREE.Vector3(end.x * sourceScale, end.y * sourceScale, z);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(
      0.12 * sourceScale, 0.12 * sourceScale, from.distanceTo(to), 16,
    ), stayMaterial);
    rod.position.copy(from).add(to).multiplyScalar(0.5);
    rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
      to.clone().sub(from).normalize());
    rod.userData.role = `${role}-rod`;
    stay.add(rod);
    for (const point of [from, to]) {
      const eye = cylinderAlongZ(0.3 * sourceScale, 0.10, stayMaterial, 24);
      eye.position.copy(point);
      eye.userData.role = `${role}-eye`;
      stay.add(eye);
    }
    beam.add(stay);
    return { from, rod, stay, to };
  });
  const stayPins = [
    [polarPoint(10.55, 157.5), 0.08, 0.66],
    [new THREE.Vector2(-5.96, -1.05), 0.08, 0.66],
    [postTopPin, 0.12, 0.78],
    [new THREE.Vector2(-9.74, -1.15), 0.08, 0.78],
    [new THREE.Vector2(5.7, -0.45), 0.08, 0.66],
  ].map(([point, z0, z1]) => {
    const pin = cylinderAlongZ(0.13 * sourceScale, z1 - z0, whiteMaterial, 18);
    pin.position.set(point.x * sourceScale, point.y * sourceScale, (z0 + z1) / 2);
    pin.userData.role = 'stay-end-pin';
    beam.add(pin);
    return pin;
  });
  const shoeIndexBosses = [[160.5, 0.18], [172.5, 0.18], [186, 0.3], [201, 0.18]]
    .map(([degrees, head], index) => {
      const point = polarPoint(11.05, degrees).multiplyScalar(sourceScale);
      const bolt = cylinderAlongZ(0.18 * sourceScale, 0.44, darkMaterial, 20);
      bolt.position.set(point.x, point.y, 0.30);
      bolt.userData.role = `segment-slot-bolt-${index + 1}`;
      const boss = cylinderAlongZ(head * sourceScale, 0.06, darkMaterial, 24);
      boss.position.set(point.x, point.y, 0.53);
      boss.userData.role = `segment-slot-bolt-head-${index + 1}`;
      beam.add(bolt, boss);
      return { bolt, boss };
    });
  root.add(beam);

  const piston = new THREE.Group();
  piston.userData.rotationDegreesOfFreedom = 0;
  piston.userData.role =
    'vertical-piston-and-rod-in-open-top-atmospheric-cylinder';
  const pistonTopBoss = cylinderAlongZ(0.43 * sourceScale, 0.12,
    pistonMaterial, 32);
  pistonTopBoss.geometry.dispose();
  pistonTopBoss.geometry = boredCylinderGeometry(.43 * sourceScale, .054, .12);
  pistonTopBoss.position.z = 0.48;
  pistonTopBoss.userData.role = 'piston-rod-chain-connection-eye';
  const pistonCrosshead = new THREE.Mesh(
    new THREE.BoxGeometry(1.14 * sourceScale, 0.9 * sourceScale, 0.26),
    pistonMaterial,
  );
  pistonCrosshead.position.set(0, -0.85 * sourceScale, cylinderZ);
  pistonCrosshead.userData.role = 'chain-crosshead-block-on-piston-rod';
  const pistonRodTop = -1.25 * sourceScale;
  const pistonRodBottom = pistonHeadCenterOffset + 0.4 * sourceScale;
  const pistonRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19 * sourceScale, 0.19 * sourceScale,
      pistonRodTop - pistonRodBottom, 24),
    pistonMaterial,
  );
  pistonRod.position.set(0, (pistonRodTop + pistonRodBottom) / 2, cylinderZ);
  pistonRod.userData.role = 'long-atmospheric-piston-rod';
  const pistonHead = new THREE.Mesh(
    new THREE.CylinderGeometry(2.28 * sourceScale, 2.28 * sourceScale,
      0.90 * sourceScale, 64),
    pistonMaterial,
  );
  pistonHead.position.set(0, pistonHeadCenterOffset, cylinderZ);
  pistonHead.userData.role = 'working-atmospheric-piston-head';
  const pistonTopAnchor = new THREE.Object3D();
  pistonTopAnchor.position.z = 0.42;
  pistonTopAnchor.userData.role = 'analytic-top-of-piston-rod';
  const pistonHeadAnchor = new THREE.Object3D();
  pistonHeadAnchor.position.set(0, pistonHeadCenterOffset, .42);
  pistonHeadAnchor.userData.role = 'analytic-piston-head-center';
  piston.add(
    pistonTopBoss,
    pistonCrosshead,
    pistonRod,
    pistonHead,
    pistonTopAnchor,
    pistonHeadAnchor,
  );
  root.add(piston);

  const chainLinks = Array.from({ length: chainLinkCount }, (_, index) => {
    const parts = makeFlexibleChainLink({
      chainMaterial,
      darkMaterial,
      depth: 0.13,
      nominalPitch: chainLinkPitch,
      planeZ: index % 2 ? .87 : .64,
      width: 0.57 * sourceScale,
    });
    parts.link.userData.index = index;
    parts.endPin.visible = index === chainLinkCount - 1;
    parts.endRoller.visible = index === chainLinkCount - 1;
    root.add(parts.link);
    return parts;
  });
  // The first pin never reaches the segment; the piston eye replaces its roller.
  chainLinks[0].roller.visible = false;
  const terminalConnectorNominalLength = constantChainPathLength
    - chainLinkCount * chainLinkPitch;
  const chainTerminalConnector = new THREE.Mesh(
    concaveEndPlateGeometry(terminalConnectorNominalLength,
      0.14 * sourceScale, .05, .10),
    chainMaterial,
  );
  chainTerminalConnector.position.z = 0.76;
  chainTerminalConnector.userData.nominalLength =
    terminalConnectorNominalLength;
  chainTerminalConnector.userData.role =
    'short-terminal-chain-connector-to-rocking-beam';
  const terminalEyes = [0, 1].map(() => {
    const eye = cylinderAlongZ(.10, .05, chainMaterial);
    eye.geometry.dispose(); eye.geometry = boredCylinderGeometry(.10, .054, .05);
    eye.userData.role = 'bored-last-chain-link-eye'; root.add(eye); return eye;
  });
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
      parts.endRoller.position.x = chordLength;
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
    terminalEyes[0].position.set(lastChainPoint.x, lastChainPoint.y, .76);
    terminalEyes[1].position.set(state.chain.attachmentPoint.x, state.chain.attachmentPoint.y, .76);
    placeSpan(chainTerminalConnector, lastChainPoint,
      state.chain.attachmentPoint, terminalConnectorNominalLength);

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
    beam,
    bearingPedestal,
    chainAttachmentAnchor,
    chainAttachmentBoss,
    chainAttachmentPin,
    chainLinks,
    chainLug,
    chainShoe,
    chainTerminalConnector,
    terminalEyes,
    cylinderBottom,
    fixedFrame,
    floorBeam,
    kingPost,
    lowerBeam,
    masonryPier,
    openCylinder,
    piston,
    pistonCrosshead,
    pistonHead,
    pistonHeadAnchor,
    pistonRod,
    pistonTopAnchor,
    pistonTopBoss,
    pivotBearing,
    pivotBore,
    pivotBoss,
    pivotShaft,
    shoeIndexBosses,
    stayPins,
    stays,
    strapParts,
  };
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
      plateCalibration: {
        beamAngleDegrees: 12,
        defaultPose:
          'model time 0 shows this 12-degree plate pose on the downstroke; the official animation starts at the upper reversal',
        pivotPixel: new THREE.Vector2(442, 162),
        pixelsPerSourceUnit: 28.1,
        scope:
          'close-up of the cylinder end only: slotted segment head, stays, king post and strap, chain, cylinder rim, floor beam and masonry pier; the far beam end and pump rod lie beyond the plate edge and are not modelled',
      },
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

  fitPistonGuide(root, update, cyclePeriod);
  root.userData.sweptBounds = root.userData.cameraFitBounds;
  // Plate crop from the cylinder rim to just past the king post, raised
  // enough to keep the segment head in view at the upper reversal.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-15.9 * sourceScale, -12.6 * sourceScale, -0.6),
    new THREE.Vector3(3.2 * sourceScale, 9.3 * sourceScale, 1.0),
  );
  root.userData.cameraDistanceScale = 0.96;
  root.userData.cameraFov = 8;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.45, 0.28, 14),
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
