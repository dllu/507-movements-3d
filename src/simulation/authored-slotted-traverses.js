import * as THREE from 'three';
import { fitPistonGuide, boredJournal } from './piston-guide-parts.js';
import { circle, plate, poly, polygonClipping as clip } from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function smootherStep01(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return u ** 3 * (u * (u * 6 - 15) + 10);
}

function smootherStepFirst(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * u ** 2 * (u - 1) ** 2;
}

function smootherStepSecond(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * u * (u - 1) * (2 * u - 1);
}

function cross2(a, b) {
  return a.x * b.y - a.y * b.x;
}

function cylinderAlongZ(radius, depth, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function capsuleShape(startX, endX, radius) {
  const shape = new THREE.Shape();
  shape.moveTo(startX, -radius);
  shape.lineTo(endX, -radius);
  shape.absarc(endX, 0, radius, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(startX, radius);
  shape.absarc(startX, 0, radius, Math.PI / 2, Math.PI * 1.5, false);
  shape.closePath();
  return shape;
}

function capsuleHole(startX, endX, radius) {
  const hole = new THREE.Path();
  hole.moveTo(startX, -radius);
  hole.absarc(startX, 0, radius, -Math.PI / 2, -Math.PI * 1.5, true);
  hole.lineTo(endX, radius);
  hole.absarc(endX, 0, radius, Math.PI / 2, -Math.PI / 2, true);
  hole.lineTo(startX, -radius);
  hole.closePath();
  return hole;
}

function slottedCapsuleGeometry({
  depth,
  holeEnd,
  holeRadius,
  holeStart,
  outerEnd,
  outerRadius,
  outerStart,
  scale,
}) {
  const shape = capsuleShape(
    outerStart * scale,
    outerEnd * scale,
    outerRadius * scale,
  );
  shape.holes.push(capsuleHole(
    holeStart * scale,
    holeEnd * scale,
    holeRadius * scale,
  ));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    curveSegments: 44,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateZ(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
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

function boreRectangularMember(mesh, x, y, radius) {
  const { width: w, height: h, depth: d } = mesh.geometry.parameters;
  mesh.geometry.dispose();
  mesh.geometry = plate(clip.difference(poly([[-w / 2, -h / 2], [w / 2, -h / 2],
    [w / 2, h / 2], [-w / 2, h / 2]]), poly(circle([x, y], radius, 64))), -d / 2, d / 2);
}

function slottedTraverse(movement) {
  const root = new THREE.Group();

  // Exact official canvas coordinates. The fixed upper pin is O=(0,0), the
  // driven lower pin D moves along y=-4.81066, and the bar joint C moves along
  // y=-1.06066. The source translates C and D through the same normalized
  // fraction, so C=(1.06066/4.81066)D and O,C,D remain exactly collinear.
  const sourceFixedPinO = new THREE.Vector2(0, 0);
  const sourceOutputGuideY = -1.06066;
  const sourceInputGuideY = -4.81066;
  const sourceOutputHalfStroke = 1.06066;
  const sourceInputHalfStroke = 4.81066;
  const sourceDisplacementRatio = sourceOutputHalfStroke
    / sourceInputHalfStroke;
  const sourceUpperSlotMinimum = 0.93566;
  const sourceUpperSlotMaximum = 1.625;
  const sourceLowerSlotMinimumMagnitude = 3.625;
  const sourceLowerSlotMaximumMagnitude = 5.428301;
  const sourceSlotHalfWidth = 0.25;
  const sourceLeverOrientationReference = new THREE.Vector2(0, -5.428301);
  const sourceOutputRailYFromC = -2.5;
  const sourceOutputRailHalfLength = 7.75;
  const sourceGuideXs = [-6, 6];
  // Brown's plate draws a much shorter bar with guides a, a close to the
  // lever; these keep the bar in both guides over the full traverse.
  const plateOutputRailHalfLength = 5.2;
  const plateGuideXs = [-4, 4];
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const sourceKeyframePhases = [0, 0.4, 0.5, 0.9];
  const sourceView = [-6.5, -8.90533, 13, 13];
  const officialCanvasWidth = 525;
  const officialCanvasHeight = 525;

  const sourceScale = 0.56;
  const worldOffsetY = 3.32;
  const fixedFramePlaneZ = -0.42;
  const outputBarPlaneZ = 0.03;
  const leverPlaneZ = 0.30;
  const jointPlaneZ = 0.48;
  const leverDepth = 0.16;
  const barDepth = 0.18;

  const officialTravelAtPhase = (unwrappedPhase) => {
    const phase = positiveModulo(unwrappedPhase, 1);
    if (phase < 0.4) {
      return {
        accelerationPerPhaseSquared: 0,
        phase,
        segment: 'outward-linear-traverse',
        value: phase / 0.4,
        velocityPerPhase: 1 / 0.4,
      };
    }
    if (phase < 0.5) {
      return {
        accelerationPerPhaseSquared: 0,
        phase,
        segment: 'outer-dwell',
        value: 1,
        velocityPerPhase: 0,
      };
    }
    if (phase < 0.9) {
      return {
        accelerationPerPhaseSquared: 0,
        phase,
        segment: 'return-linear-traverse',
        value: 1 - (phase - 0.5) / 0.4,
        velocityPerPhase: -1 / 0.4,
      };
    }
    return {
      accelerationPerPhaseSquared: 0,
      phase,
      segment: 'inner-dwell',
      value: 0,
      velocityPerPhase: 0,
    };
  };

  const smoothTravelAtPhase = (unwrappedPhase) => {
    const phase = positiveModulo(unwrappedPhase, 1);
    let u;
    if (phase < 0.4) {
      u = phase / 0.4;
      return {
        accelerationPerPhaseSquared:
          smootherStepSecond(u) / 0.4 ** 2,
        phase,
        segment: 'smooth-outward-traverse',
        value: smootherStep01(u),
        velocityPerPhase: smootherStepFirst(u) / 0.4,
      };
    }
    if (phase < 0.5) {
      return {
        accelerationPerPhaseSquared: 0,
        phase,
        segment: 'outer-dwell',
        value: 1,
        velocityPerPhase: 0,
      };
    }
    if (phase < 0.9) {
      u = (phase - 0.5) / 0.4;
      return {
        accelerationPerPhaseSquared:
          -smootherStepSecond(u) / 0.4 ** 2,
        phase,
        segment: 'smooth-return-traverse',
        value: 1 - smootherStep01(u),
        velocityPerPhase: -smootherStepFirst(u) / 0.4,
      };
    }
    return {
      accelerationPerPhaseSquared: 0,
      phase,
      segment: 'inner-dwell',
      value: 0,
      velocityPerPhase: 0,
    };
  };

  const sourceStateAtTravel = (travel, travelRate = 0,
    travelAcceleration = 0) => {
    const inputX = -sourceInputHalfStroke
      + 2 * sourceInputHalfStroke * travel;
    const inputXVelocity = 2 * sourceInputHalfStroke * travelRate;
    const inputXAcceleration = 2 * sourceInputHalfStroke
      * travelAcceleration;
    const outputX = sourceDisplacementRatio * inputX;
    const outputXVelocity = sourceDisplacementRatio * inputXVelocity;
    const outputXAcceleration = sourceDisplacementRatio
      * inputXAcceleration;
    const radialDistance = Math.hypot(inputX, sourceInputHalfStroke);
    const radialVelocity = inputX * inputXVelocity / radialDistance;
    const radialAcceleration = (
      inputXVelocity ** 2 + inputX * inputXAcceleration
    ) / radialDistance
      - inputX ** 2 * inputXVelocity ** 2 / radialDistance ** 3;
    const leverAngle = Math.atan2(inputX, sourceInputHalfStroke);
    const leverAngularVelocity = sourceInputHalfStroke * inputXVelocity
      / radialDistance ** 2;
    const leverAngularAcceleration = sourceInputHalfStroke * (
      inputXAcceleration * radialDistance ** 2
        - 2 * inputX * inputXVelocity ** 2
    ) / radialDistance ** 4;
    const fixedPinCoordinate = sourceDisplacementRatio * radialDistance;
    const movingPinCoordinate = (1 - sourceDisplacementRatio)
      * radialDistance;
    const fixedPinCoordinateVelocity = sourceDisplacementRatio
      * radialVelocity;
    const movingPinCoordinateVelocity = (1 - sourceDisplacementRatio)
      * radialVelocity;
    const fixedPinCoordinateAcceleration = sourceDisplacementRatio
      * radialAcceleration;
    const movingPinCoordinateAcceleration = (1 - sourceDisplacementRatio)
      * radialAcceleration;
    return {
      fixedPinCoordinate,
      fixedPinCoordinateAcceleration,
      fixedPinCoordinateVelocity,
      fixedPinO: sourceFixedPinO.clone(),
      inputX,
      inputXAcceleration,
      inputXVelocity,
      leverAngle,
      leverAngularAcceleration,
      leverAngularVelocity,
      movingPinCoordinate,
      movingPinCoordinateAcceleration,
      movingPinCoordinateVelocity,
      movingPinD: new THREE.Vector2(inputX, sourceInputGuideY),
      outputJointC: new THREE.Vector2(outputX, sourceOutputGuideY),
      outputX,
      outputXAcceleration,
      outputXVelocity,
      radialDistance,
      radialAcceleration,
      radialVelocity,
      travel,
      travelAcceleration,
      travelRate,
    };
  };

  const sourcePointToWorld = (point, z = jointPlaneZ) =>
    new THREE.Vector3(
      point.x * sourceScale,
      worldOffsetY + point.y * sourceScale,
      z,
    );
  const sourceVectorToWorld = (vector) => new THREE.Vector3(
    vector.x * sourceScale,
    vector.y * sourceScale,
    0,
  );
  const stateFromTravelSchedule = (schedule, time) => {
    const phaseRate = 1 / cyclePeriod;
    const travelRate = schedule.velocityPerPhase * phaseRate;
    const travelAcceleration = schedule.accelerationPerPhaseSquared
      * phaseRate ** 2;
    const source = sourceStateAtTravel(
      schedule.value,
      travelRate,
      travelAcceleration,
    );
    return {
      fixedPin: {
        coordinate: source.fixedPinCoordinate * sourceScale,
        coordinateAcceleration:
          source.fixedPinCoordinateAcceleration * sourceScale,
        coordinateVelocity:
          source.fixedPinCoordinateVelocity * sourceScale,
        pointO: sourcePointToWorld(source.fixedPinO),
        slotClearanceHigh: (
          sourceUpperSlotMaximum - source.fixedPinCoordinate
        ) * sourceScale,
        slotClearanceLow: (
          source.fixedPinCoordinate - sourceUpperSlotMinimum
        ) * sourceScale,
      },
      input: {
        acceleration: sourceVectorToWorld(new THREE.Vector2(
          source.inputXAcceleration,
          0,
        )),
        pointD: sourcePointToWorld(source.movingPinD),
        velocity: sourceVectorToWorld(new THREE.Vector2(
          source.inputXVelocity,
          0,
        )),
        x: source.inputX * sourceScale,
      },
      lever: {
        angle: source.leverAngle,
        angularAcceleration: source.leverAngularAcceleration,
        angularVelocity: source.leverAngularVelocity,
      },
      movingPin: {
        coordinate: source.movingPinCoordinate * sourceScale,
        coordinateAcceleration:
          source.movingPinCoordinateAcceleration * sourceScale,
        coordinateVelocity:
          source.movingPinCoordinateVelocity * sourceScale,
        slotClearanceHigh: (
          sourceLowerSlotMaximumMagnitude
            - source.movingPinCoordinate
        ) * sourceScale,
        slotClearanceLow: (
          source.movingPinCoordinate
            - sourceLowerSlotMinimumMagnitude
        ) * sourceScale,
      },
      output: {
        acceleration: sourceVectorToWorld(new THREE.Vector2(
          source.outputXAcceleration,
          0,
        )),
        jointC: sourcePointToWorld(source.outputJointC),
        velocity: sourceVectorToWorld(new THREE.Vector2(
          source.outputXVelocity,
          0,
        )),
        x: source.outputX * sourceScale,
      },
      phase: schedule.phase,
      scheduleSegment: schedule.segment,
      source,
      time,
      travel: schedule.value,
      travelAcceleration,
      travelRate,
    };
  };

  const officialSourceStateAtTime = (time) => {
    const phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    const schedule = officialTravelAtPhase(phase);
    return sourceStateAtTravel(
      schedule.value,
      schedule.velocityPerPhase / cyclePeriod,
      schedule.accelerationPerPhaseSquared / cyclePeriod ** 2,
    );
  };
  const stateAtTime = (time) => {
    const phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    return stateFromTravelSchedule(smoothTravelAtPhase(phase), time);
  };
  const canonicalTimes = {
    sourceStart: 0,
    outwardMidpoint: cyclePeriod * 0.2,
    rightExtreme: cyclePeriod * 0.4,
    rightDwellEnd: cyclePeriod * 0.5,
    returnMidpoint: cyclePeriod * 0.7,
    leftExtreme: cyclePeriod * 0.9,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.16,
    roughness: 0.64,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.46,
  });
  const barMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.56,
  });
  const leverMaterial = matte(PALETTE.driver, {
    metalness: 0.15,
    roughness: 0.54,
    side: THREE.DoubleSide,
  });
  const inputMaterial = matte(0x3e9368, {
    metalness: 0.14,
    roughness: 0.53,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role =
    'fixed-frame-upper-pin-output-guides-a-a-and-lower-input-guide';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(10.30, 0.19, 1.45),
    frameMaterial,
  );
  base.position.set(0, 0.095, -0.22);
  base.userData.role = 'fixed-wide-base';
  const baseEdge = new THREE.Mesh(
    new THREE.BoxGeometry(10.52, 0.05, 1.58),
    inkMaterial,
  );
  baseEdge.position.set(0, 0.215, -0.22);
  baseEdge.userData.role = 'fixed-base-edge';

  const sourceOutputRailWorldY = worldOffsetY
    + (sourceOutputGuideY + sourceOutputRailYFromC) * sourceScale;
  const outputGuideAssemblies = plateGuideXs.map((sourceX, index) => {
    const guide = new THREE.Group();
    guide.position.x = sourceX * sourceScale;
    guide.userData.role = `fixed-output-guide-a-${index + 1}`;
    // A short flange, as Brown draws guide a, behind the bar.
    const upright = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.62, 0.54),
      frameMaterial,
    );
    upright.position.set(0, sourceOutputRailWorldY, fixedFramePlaneZ + 0.04);
    const lips = [-1, 1].map((side) => {
      const lip = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, 0.12, 0.30),
        frameMaterial,
      );
      lip.position.set(
        side * 0.14,
        sourceOutputRailWorldY + side * 0.19,
        outputBarPlaneZ,
      );
      guide.add(lip);
      return lip;
    });
    upright.userData.role = `guide-a-${index + 1}-upright`;
    lips.forEach((lip, lipIndex) => {
      lip.userData.role =
        `guide-a-${index + 1}-${lipIndex === 0 ? 'lower' : 'upper'}-lip`;
    });
    guide.add(upright);
    fixedFrame.add(guide);
    return { guide, lips, upright };
  });

  const fixedPinWorld = sourcePointToWorld(
    sourceFixedPinO,
    jointPlaneZ,
  );
  const fixedPinSupport = beamBetween3D(
    new THREE.Vector3(-2.15, 0.28, fixedFramePlaneZ),
    new THREE.Vector3(
      fixedPinWorld.x,
      fixedPinWorld.y,
      fixedFramePlaneZ,
    ),
    0.20,
    0.24,
    frameMaterial,
  );
  fixedPinSupport.userData.role = 'fixed-upper-pin-rear-support';
  const fixedPinBearing = cylinderAlongZ(0.18, 0.38,
    inkMaterial, 34);
  fixedPinBearing.position.set(
    fixedPinWorld.x,
    fixedPinWorld.y,
    fixedFramePlaneZ + 0.11,
  );
  fixedPinBearing.userData.role = 'fixed-upper-slot-pin-bearing-O';

  const inputGuideWorldY = worldOffsetY
    + sourceInputGuideY * sourceScale;
  const inputGuideRail = new THREE.Group();
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(
      sourceInputHalfStroke * 2 * sourceScale + 0.34, 0.03, 0.24), frameMaterial);
    rail.position.y = side * 0.12;
    inputGuideRail.add(rail);
  }
  inputGuideRail.position.set(0, inputGuideWorldY, -0.05);
  inputGuideRail.userData.role =
    'fixed-horizontal-guide-for-driven-lower-pin-D';
  const inputGuideDashes = [];
  const dashCount = 23;
  for (let index = 0; index < dashCount; index += 1) {
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.025, 0.025),
      inkMaterial,
    );
    dash.position.set(
      THREE.MathUtils.lerp(
        -sourceInputHalfStroke * sourceScale,
        sourceInputHalfStroke * sourceScale,
        index / (dashCount - 1),
      ),
      inputGuideWorldY - 0.09,
      0.02,
    );
    dash.userData.role = `lower-input-direction-dash-${index + 1}`;
    fixedFrame.add(dash);
    inputGuideDashes.push(dash);
  }
  fixedFrame.add(
    base,
    baseEdge,
    fixedPinSupport,
    fixedPinBearing,
    inputGuideRail,
  );
  root.add(fixedFrame);

  const outputBar = new THREE.Group();
  outputBar.userData.role =
    'guided-output-bar-with-offset-riser-clearing-fixed-pin';
  const outputRail = new THREE.Mesh(
    new THREE.BoxGeometry(
      plateOutputRailHalfLength * 2 * sourceScale,
      0.24,
      barDepth,
    ),
    barMaterial,
  );
  outputRail.position.set(
    0,
    sourceOutputRailYFromC * sourceScale,
    0,
  );
  outputRail.userData.role = 'horizontal-traversing-rail-in-guides-a-a';
  const riserOffsetX = 0.46 * sourceScale;
  const riserTopY = -0.36 * sourceScale;
  const riserBottomY = (sourceOutputRailYFromC + 0.12) * sourceScale;
  const outputRiser = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.26,
      riserTopY - riserBottomY,
      barDepth,
    ),
    barMaterial,
  );
  outputRiser.position.set(
    riserOffsetX,
    (riserTopY + riserBottomY) / 2,
    0,
  );
  outputRiser.userData.role =
    'source-corrected-offset-vertical-riser-avoiding-fixed-pin-O';
  const jointToRiser = beamBetween3D(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(riserOffsetX, riserTopY, 0),
    0.25,
    barDepth,
    barMaterial,
  );
  boreRectangularMember(jointToRiser, -jointToRiser.geometry.parameters.width / 2, 0, 0.136);
  jointToRiser.userData.role =
    'angled-neck-from-output-joint-C-to-clearance-riser';
  const riserToRail = beamBetween3D(
    new THREE.Vector3(riserOffsetX, riserBottomY, 0),
    new THREE.Vector3(0, sourceOutputRailYFromC * sourceScale, 0),
    0.25,
    barDepth,
    barMaterial,
  );
  riserToRail.userData.role = 'lower-neck-joining-riser-to-output-rail';
  const outputJointBoss = boredJournal(0.24, 0.136, barDepth * 1.12, barMaterial);
  outputJointBoss.userData.role = 'output-bar-joint-boss-C';
  const outputJointAnchor = new THREE.Object3D();
  outputJointAnchor.position.z = jointPlaneZ - outputBarPlaneZ;
  outputJointAnchor.userData.role = 'output-bar-analytic-joint-anchor-C';
  const railIndexes = [-5.0, -1.65, 1.70, 5.0].map(
    (sourceX, index) => {
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.19, barDepth + 0.025),
        index === 1 ? whiteMaterial : inkMaterial,
      );
      marker.position.set(
        sourceX * sourceScale,
        sourceOutputRailYFromC * sourceScale,
        0.012,
      );
      marker.userData.role = index === 1
        ? 'white-traverse-index-on-output-bar'
        : `output-bar-motion-rib-${index + 1}`;
      outputBar.add(marker);
      return marker;
    },
  );
  outputBar.add(
    outputRail,
    outputRiser,
    jointToRiser,
    riserToRail,
    outputJointBoss,
    outputJointAnchor,
  );
  root.add(outputBar);

  const leverAssembly = new THREE.Group();
  leverAssembly.userData.role =
    'rocking-lever-with-separated-upper-and-lower-longitudinal-slots';
  const upperSlottedEnd = new THREE.Mesh(
    slottedCapsuleGeometry({
      depth: leverDepth,
      holeEnd: sourceUpperSlotMaximum,
      holeRadius: sourceSlotHalfWidth,
      holeStart: sourceUpperSlotMinimum,
      outerEnd: 1.76,
      outerRadius: 0.42,
      outerStart: 0.68,
      scale: sourceScale,
    }),
    leverMaterial,
  );
  upperSlottedEnd.userData.actualThroughSlot = true;
  upperSlottedEnd.userData.role = 'upper-actual-slot-for-fixed-pin-O';
  const lowerSlottedEnd = new THREE.Mesh(
    slottedCapsuleGeometry({
      depth: leverDepth,
      holeEnd: -sourceLowerSlotMinimumMagnitude,
      holeRadius: sourceSlotHalfWidth,
      holeStart: -sourceLowerSlotMaximumMagnitude,
      outerEnd: -3.42,
      outerRadius: 0.42,
      outerStart: -5.64,
      scale: sourceScale,
    }),
    leverMaterial,
  );
  lowerSlottedEnd.userData.actualThroughSlot = true;
  lowerSlottedEnd.userData.role = 'lower-actual-slot-for-moving-pin-D';
  const upperNeck = new THREE.Mesh(
    new THREE.BoxGeometry(0.47, 0.36, leverDepth),
    leverMaterial,
  );
  upperNeck.position.y = 0.18;
  boreRectangularMember(upperNeck, 0, -upperNeck.position.y, 0.136);
  upperNeck.userData.role = 'upper-slot-neck-to-center-C';
  const lowerNeckLength = 3.42 * sourceScale;
  const lowerNeck = new THREE.Mesh(
    new THREE.BoxGeometry(0.47, lowerNeckLength, leverDepth),
    leverMaterial,
  );
  lowerNeck.position.y = -lowerNeckLength / 2;
  boreRectangularMember(lowerNeck, 0, -lowerNeck.position.y, 0.136);
  lowerNeck.userData.role = 'lower-slot-neck-to-center-C';
  const centerBoss = boredJournal(0.35, 0.136, leverDepth * 1.18, leverMaterial);
  centerBoss.userData.role = 'lever-center-boss-at-output-joint-C';
  const upperSlotOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(upperSlottedEnd.geometry, 24),
    new THREE.LineBasicMaterial({ color: PALETTE.ink }),
  );
  upperSlotOutline.userData.noShadow = true;
  upperSlotOutline.userData.role = 'upper-slot-machined-outline';
  const lowerSlotOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(lowerSlottedEnd.geometry, 24),
    new THREE.LineBasicMaterial({ color: PALETTE.ink }),
  );
  lowerSlotOutline.userData.noShadow = true;
  lowerSlotOutline.userData.role = 'lower-slot-machined-outline';
  const leverJointAnchor = new THREE.Object3D();
  leverJointAnchor.position.z = jointPlaneZ - leverPlaneZ;
  leverJointAnchor.userData.role = 'lever-analytic-joint-anchor-C';
  const fixedPinSlotAnchor = new THREE.Object3D();
  fixedPinSlotAnchor.position.z = jointPlaneZ - leverPlaneZ;
  fixedPinSlotAnchor.userData.role = 'lever-upper-slot-contact-anchor-O';
  const movingPinSlotAnchor = new THREE.Object3D();
  movingPinSlotAnchor.position.z = jointPlaneZ - leverPlaneZ;
  movingPinSlotAnchor.userData.role = 'lever-lower-slot-contact-anchor-D';
  leverAssembly.add(
    upperSlottedEnd,
    lowerSlottedEnd,
    upperNeck,
    lowerNeck,
    centerBoss,
    upperSlotOutline,
    lowerSlotOutline,
    leverJointAnchor,
    fixedPinSlotAnchor,
    movingPinSlotAnchor,
  );
  root.add(leverAssembly);

  const fixedPinO = cylinderAlongZ(0.112, 0.76, whiteMaterial, 32);
  fixedPinO.position.copy(fixedPinWorld).setZ(0.09);
  fixedPinO.userData.role = 'stationary-white-pin-in-upper-lever-slot-O';
  const fixedPinCap = cylinderAlongZ(0.065, 0.035, inkMaterial, 28);
  fixedPinCap.position.copy(fixedPinWorld).setZ(0.505);
  fixedPinCap.userData.role = 'fixed-pin-O-front-index';
  root.add(fixedPinO, fixedPinCap);

  const movingInput = new THREE.Group();
  movingInput.userData.role =
    'driven-lower-pin-D-translating-in-fixed-horizontal-guide';
  const inputShoe = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.20, 0.22),
    inputMaterial,
  );
  inputShoe.position.z = -0.05;
  inputShoe.userData.role = 'lower-input-horizontal-guide-shoe';
  const movingPinD = cylinderAlongZ(0.112, 0.72, whiteMaterial, 32);
  movingPinD.position.z = 0.23;
  movingPinD.userData.role = 'moving-white-pin-in-lower-lever-slot-D';
  const movingPinCap = cylinderAlongZ(0.065, 0.035, inputMaterial, 28);
  movingPinCap.position.z = 0.61;
  movingPinCap.userData.role = 'moving-pin-D-green-front-index';
  const movingPinAnchor = new THREE.Object3D();
  movingPinAnchor.position.z = jointPlaneZ;
  movingPinAnchor.userData.role = 'moving-input-analytic-pin-anchor-D';
  movingInput.add(
    inputShoe,
    movingPinD,
    movingPinCap,
    movingPinAnchor,
  );
  root.add(movingInput);

  const centralJointPin = cylinderAlongZ(0.13, 0.74,
    whiteMaterial, 34);
  centralJointPin.userData.role =
    'shared-revolute-pin-lever-to-output-bar-at-C';
  const centralJointCap = cylinderAlongZ(0.075, 0.035,
    inkMaterial, 28);
  centralJointCap.userData.role = 'central-joint-C-front-index';
  root.add(centralJointPin, centralJointCap);

  const contacts = {
    fixedPinOInUpperLeverSlot: {
      fixedMember: fixedFrame,
      movingMember: leverAssembly,
      point: new THREE.Vector3(),
      slotCoordinate: 0,
      type: 'sliding-fixed-pin-O-in-upper-longitudinal-lever-slot',
    },
    leverAtOutputBarC: {
      members: [leverAssembly, outputBar],
      point: new THREE.Vector3(),
      type: 'revolute-lever-to-guided-output-bar-at-C',
    },
    movingPinDInHorizontalGuide: {
      axis: new THREE.Vector3(1, 0, 0),
      fixedMember: fixedFrame,
      movingMember: movingInput,
      point: new THREE.Vector3(),
      type: 'horizontal-prismatic-input-guide-for-lower-pin-D',
    },
    movingPinDInLowerLeverSlot: {
      members: [movingInput, leverAssembly],
      point: new THREE.Vector3(),
      slotCoordinate: 0,
      type: 'sliding-moving-pin-D-in-lower-longitudinal-lever-slot',
    },
    outputBarInGuidesAA: {
      axis: new THREE.Vector3(1, 0, 0),
      fixedMembers: outputGuideAssemblies.map(({ guide }) => guide),
      movingMember: outputBar,
      points: [new THREE.Vector3(), new THREE.Vector3()],
      type: 'horizontal-prismatic-output-bar-through-two-fixed-guides-a-a',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    outputBar.position.set(
      state.output.jointC.x,
      state.output.jointC.y,
      outputBarPlaneZ,
    );
    outputBar.userData.velocity = state.output.velocity.clone();
    outputBar.userData.acceleration = state.output.acceleration.clone();
    leverAssembly.position.set(
      state.output.jointC.x,
      state.output.jointC.y,
      leverPlaneZ,
    );
    leverAssembly.rotation.z = state.lever.angle;
    leverAssembly.userData.angularVelocity =
      state.lever.angularVelocity;
    leverAssembly.userData.angularAcceleration =
      state.lever.angularAcceleration;
    fixedPinSlotAnchor.position.y = state.fixedPin.coordinate;
    movingPinSlotAnchor.position.y = -state.movingPin.coordinate;
    movingInput.position.set(
      state.input.pointD.x,
      state.input.pointD.y,
      0,
    );
    movingInput.userData.velocity = state.input.velocity.clone();
    movingInput.userData.acceleration = state.input.acceleration.clone();
    centralJointPin.position.copy(state.output.jointC).setZ(0.27);
    centralJointCap.position.copy(state.output.jointC).setZ(0.60);

    contacts.fixedPinOInUpperLeverSlot.point
      .copy(state.fixedPin.pointO);
    contacts.fixedPinOInUpperLeverSlot.slotCoordinate =
      state.fixedPin.coordinate;
    contacts.leverAtOutputBarC.point.copy(state.output.jointC);
    contacts.movingPinDInHorizontalGuide.point.copy(state.input.pointD);
    contacts.movingPinDInLowerLeverSlot.point.copy(state.input.pointD);
    contacts.movingPinDInLowerLeverSlot.slotCoordinate =
      -state.movingPin.coordinate;
    contacts.outputBarInGuidesAA.points.forEach((point, index) => {
      point.set(
        plateGuideXs[index] * sourceScale,
        sourceOutputRailWorldY,
        outputBarPlaneZ,
      );
    });
    root.userData.kinematics = state;
  };

  const modelPointToOfficialAnimationRaster = (point) => {
    const sourceX = point.x / sourceScale;
    const sourceY = (point.y - worldOffsetY) / sourceScale;
    return new THREE.Vector2(
      (sourceX - sourceView[0])
        * officialCanvasWidth / sourceView[2],
      officialCanvasHeight - (sourceY - sourceView[1])
        * officialCanvasHeight / sourceView[3],
    );
  };

  root.userData.archetype =
    'two-slotted-lever-reduced-horizontal-traverse';
  root.userData.blocks = {
    base,
    baseEdge,
    centralJointCap,
    centralJointPin,
    centerBoss,
    fixedFrame,
    fixedPinBearing,
    fixedPinCap,
    fixedPinO,
    fixedPinSlotAnchor,
    fixedPinSupport,
    inputGuideDashes,
    inputGuideRail,
    inputShoe,
    jointToRiser,
    leverAssembly,
    leverJointAnchor,
    lowerNeck,
    lowerSlotOutline,
    lowerSlottedEnd,
    movingInput,
    movingPinAnchor,
    movingPinCap,
    movingPinD,
    movingPinSlotAnchor,
    outputBar,
    outputGuideAssemblies,
    outputJointAnchor,
    outputJointBoss,
    outputRail,
    outputRiser,
    railIndexes,
    riserToRail,
    upperNeck,
    upperSlotOutline,
    upperSlottedEnd,
  };
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.12, 0, -0.85),
    new THREE.Vector3(5.12, 4.55, 0.82),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    input:
      'one lower pin D constrained to translate on its fixed horizontal guide',
    mechanism: 1,
    output:
      'one bar joint C and its rigid bar constrained to translate through guides a,a',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    barDepth,
    cyclePeriod,
    fixedFramePlaneZ,
    jointPlaneZ,
    leverDepth,
    leverPlaneZ,
    outputBarPlaneZ,
    sourceDisplacementRatio,
    sourceFixedPinO,
    sourceInputGuideY,
    sourceInputHalfStroke,
    sourceLeverOrientationReference,
    sourceLowerSlotMaximumMagnitude,
    sourceLowerSlotMinimumMagnitude,
    sourceOutputGuideY,
    sourceOutputHalfStroke,
    sourceOutputRailHalfLength,
    sourceOutputRailYFromC,
    sourceScale,
    sourceSlotHalfWidth,
    sourceUpperSlotMaximum,
    sourceUpperSlotMinimum,
    worldOffsetY,
  };
  root.userData.groundFloorY = 0;
  root.userData.mechanism =
    'stationary-upper-pin-O-in-upper-lever-slot-driven-lower-pin-D-in-horizontal-guide-and-lower-lever-slot-collinear-output-joint-C-on-horizontal-guided-bar-with-source-corrected-clearance-riser';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.officialSourceStateAtTime = officialSourceStateAtTime;
  root.userData.officialTravelAtPhase = officialTravelAtPhase;
  root.userData.smoothTravelAtPhase = smoothTravelAtPhase;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: sourceCyclesPerMinute,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialFunctionChain: [
      'add_pos_interp-guided-output-bar-C',
      'add_pos_interp-horizontal-input-pin-D',
      'add_rot_to-two-slotted-lever-from-C-toward-D',
    ],
    officialGeometry: {
      fixedPinO: sourceFixedPinO,
      guideXs: sourceGuideXs,
      inputGuideY: sourceInputGuideY,
      inputHalfStroke: sourceInputHalfStroke,
      leverOrientationReference: sourceLeverOrientationReference,
      lowerSlotMaximumMagnitude: sourceLowerSlotMaximumMagnitude,
      lowerSlotMinimumMagnitude: sourceLowerSlotMinimumMagnitude,
      outputGuideY: sourceOutputGuideY,
      outputHalfStroke: sourceOutputHalfStroke,
      outputRailHalfLength: sourceOutputRailHalfLength,
      outputRailYFromC: sourceOutputRailYFromC,
      slotHalfWidth: sourceSlotHalfWidth,
      upperSlotMaximum: sourceUpperSlotMaximum,
      upperSlotMinimum: sourceUpperSlotMinimum,
      view: sourceView,
    },
    officialKeyframePhases: sourceKeyframePhases,
    officialWebsiteCorrection: {
      applied: true,
      note:
        'Brown’s illustrated bar riser appears to interfere with the fixed pin; the official animation reroutes the riser and adds motion ribs, and the 3D model follows that corrected construction.',
    },
    referenceScope:
      'official fixed and moving pin paths, finite upper/lower slot ranges, lever pose, corrected guided-bar outline, guides a,a, view, four animation keyframes, and 15-cpm timing',
    sourceUrl: movement.sourceUrl,
    timingRefinement: {
      changesExtremaOrDwells: false,
      interpolation: 'quintic smootherstep',
      reason:
        'the source linear interpolation changes speed instantaneously at traverse/dwell boundaries; C2-continuous interpolation removes endpoint jerk while retaining its paths, extrema, dwells, and duration',
    },
  };
  root.userData.sourceReference = {
    brownPlate350: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one long two-slotted rocking lever, stationary upper pin, horizontally moving lower pin, central bar joint, and two horizontal output guides a,a',
      measurementUncertaintyPixels: 10,
      rasterFixedUpperPin: new THREE.Vector2(304, 211),
      rasterLeverBarJoint: new THREE.Vector2(227, 288),
      rasterMovingLowerPin: new THREE.Vector2(75, 435),
      rasterOutputGuideLeft: new THREE.Vector2(27, 386),
      rasterOutputGuideRight: new THREE.Vector2(490, 386),
    },
    officialAnimationView: {
      canvasHeight: officialCanvasHeight,
      canvasWidth: officialCanvasWidth,
      minimum: new THREE.Vector2(sourceView[0], sourceView[1]),
      viewHeight: sourceView[3],
      viewWidth: sourceView[2],
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.sourceStateAtTravel = sourceStateAtTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    collinearityConstraint:
      'O=(0,0), D=(x,-4.81066), and C=(1.06066/4.81066)D, hence cross(O-C,D-C)=0',
    displacementRatio: sourceDisplacementRatio,
    input:
      'lower pin D traverses x=-4.81066..+4.81066 on y=-4.81066',
    output:
      'joint C and bar traverse x=-1.06066..+1.06066 on y=-1.06066 through guides a,a',
    strokeRatio:
      'output stroke / input stroke = 1.06066 / 4.81066',
  };

  update(0);
  fitPistonGuide(root, update, cyclePeriod);
  // Frame the bar, guides and lever as Brown does, without the input drive.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.2, 0.1, -0.7),
    new THREE.Vector3(3.2, 3.85, 0.7),
  );
  markShadows(root);
  upperSlotOutline.castShadow = false;
  upperSlotOutline.receiveShadow = false;
  lowerSlotOutline.castShadow = false;
  lowerSlotOutline.receiveShadow = false;
  return {
    cameraDirection: new THREE.Vector3(1.2, 0.6, 14),
    root,
    update,
  };
}

export function createAuthoredSlottedTraverseMovement(movement) {
  if (movement.id !== 350) return null;
  return slottedTraverse(movement);
}
