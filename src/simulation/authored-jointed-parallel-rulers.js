import { disposeObject3D } from './dispose-model.js';
import { ornamentalRulerArmGeometry } from './ornamental-ruler-arm.js';
import { circle, poly, plate, polygonClipping as clip } from './finite-plate-geometry.js';
import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

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

function rigidVectorRates(vector, velocity, acceleration) {
  const lengthSquared = vector.lengthSq();
  const crossVelocity = cross2(vector, velocity);
  return {
    angle: Math.atan2(vector.y, vector.x),
    angularAcceleration: (
      cross2(vector, acceleration) * lengthSquared
        - 2 * vector.dot(velocity) * crossVelocity
    ) / lengthSquared ** 2,
    angularVelocity: crossVelocity / lengthSquared,
  };
}

function cylinderAlongY(radius, height, material, segments = 36) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, segments),
    material,
  );
}

function makePlanarLink({ depth, length, material, role }) {
  const group = new THREE.Group();
  group.userData.nominalLength = length;
  group.userData.role = role;
  const geometry = ornamentalRulerArmGeometry(349, length, depth, .104, .119);
  geometry.rotateX(-Math.PI / 2);
  const shank = new THREE.Mesh(geometry, material);
  shank.userData.role = `${role}-bored-source-outline`;
  // Lower arms pass above upper arms at the common middle pivots.
  shank.position.y = role.startsWith('lower') ? .17 : 0;
  if (role.startsWith('lower')) shank.scale.z = -1;
  const startAnchor = new THREE.Object3D(), endAnchor = new THREE.Object3D();
  endAnchor.position.x = length;
  group.add(shank, startAnchor, endAnchor);
  return { bosses: [], eyeRings: [], group, shank, startAnchor, endAnchor };
}

function jointedParallelRuler(movement) {
  const root = new THREE.Group();

  // Exact official canvas coordinates. Each upper/lower ruler carries two
  // pivots at the same spacing. Four equal links meet the two pivots of the
  // intermediate bar, so every bar remains parallel for either independent
  // arm angle. The official animation selects a symmetric one-dimensional
  // path through this genuinely two-degree-of-freedom workspace.
  const sourceUpperRulerPoints = [
    [-5.5, 0],
    [0, 0],
    [0, 1],
    [-8, 1],
    [-8, -0.5],
    [-6, -0.5],
  ];
  const sourceLowerRulerPoints = [
    [-5.5, 0],
    [0, 0],
    [0, -1],
    [-8, -1],
    [-8, 0.5],
    [-6, 0.5],
  ];
  const sourceIntermediateBarPoints = [
    [3.166667, 0.5],
    [-2.333333, 0.5],
    [-2.833333, 0],
    [-2.333333, -0.5],
    [3.166667, -0.5],
  ];
  const sourceRulerTransformX = 0.5;
  const sourceLeftPivotX = -5.333333 + sourceRulerTransformX;
  const sourceRightPivotX = -2.666667 + sourceRulerTransformX;
  const sourceRulerPivotSpacing = sourceRightPivotX - sourceLeftPivotX;
  const sourceOfficialIntermediatePivotSpacing = 2.666667;
  const sourceIntermediatePivotSpacing = sourceRulerPivotSpacing;
  const sourceArmLength = 2.386304;
  const sourceMinimumHalfSeparation = 1;
  const sourceMaximumHalfSeparation = 2;
  // The official path closes to h = 1, where both main ruler edges lie on
  // the arrow bar's edges, the two tails meet edge to edge on the centre line
  // and the arrow nests in their V with zero clearance: coplanar same-colour
  // rulers then read as one plate with the bar inlaid (p104 audit). The 3D
  // path stops just short of that geometric limit so each ruler comes to rest
  // against the bar with a visible hairline clearance and never overlaps it.
  const closedHalfSeparation = 1.05;
  const closingTravel = sourceMaximumHalfSeparation - closedHalfSeparation;
  const sourcePhaseOffset = 0.2;
  const sourceKeyframePhases = [0, 0.4, 0.5, 0.9];
  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const sourceView = [-8, -4.5, 9, 9];
  const officialCanvasWidth = 525;
  const officialCanvasHeight = 525;

  const sourceScale = 0.74;
  const sourceCenterX = -3.5;
  const rulerPlaneY = 0.20;
  const rulerDepth = 0.16;
  const armPlaneY = 0.39;
  const armDepth = 0.13;
  const intermediatePlaneY = 0.20;
  const intermediateDepth = 0.14;
  const armWidth = 0.30;
  const armLength = sourceArmLength * sourceScale;
  const pivotSpacing = sourceIntermediatePivotSpacing * sourceScale;

  const officialHeightAtPhase = (unwrappedPhase) => {
    const phase = positiveModulo(unwrappedPhase, 1);
    if (phase < 0.2) {
      return {
        accelerationPerPhaseSquared: 0,
        phase,
        segment: 'upward-traverse-before-upper-dwell',
        value: 1.5 + 2.5 * phase,
        velocityPerPhase: 2.5,
      };
    }
    if (phase < 0.3) {
      return {
        accelerationPerPhaseSquared: 0,
        phase,
        segment: 'upper-dwell',
        value: 2,
        velocityPerPhase: 0,
      };
    }
    if (phase < 0.7) {
      return {
        accelerationPerPhaseSquared: 0,
        phase,
        segment: 'downward-traverse',
        value: 2 - 2.5 * (phase - 0.3),
        velocityPerPhase: -2.5,
      };
    }
    if (phase < 0.8) {
      return {
        accelerationPerPhaseSquared: 0,
        phase,
        segment: 'lower-dwell',
        value: 1,
        velocityPerPhase: 0,
      };
    }
    return {
      accelerationPerPhaseSquared: 0,
      phase,
      segment: 'upward-traverse-through-cycle-boundary',
      value: 1 + 2.5 * (phase - 0.8),
      velocityPerPhase: 2.5,
    };
  };

  const smoothHeightAtPhase = (unwrappedPhase) => {
    const phase = positiveModulo(unwrappedPhase, 1);
    let u;
    if (phase < 0.2 || phase >= 0.8) {
      // Treat 0.8 -> 1 -> 0.2 as one continuous 0.4-cycle traverse.
      u = phase >= 0.8
        ? (phase - 0.8) / 0.4
        : (phase + 0.2) / 0.4;
      return {
        accelerationPerPhaseSquared:
          closingTravel * smootherStepSecond(u) / 0.4 ** 2,
        phase,
        segment: 'smooth-upward-traverse',
        value: closedHalfSeparation + closingTravel * smootherStep01(u),
        velocityPerPhase: closingTravel * smootherStepFirst(u) / 0.4,
      };
    }
    if (phase < 0.3) {
      return {
        accelerationPerPhaseSquared: 0,
        phase,
        segment: 'upper-dwell',
        value: 2,
        velocityPerPhase: 0,
      };
    }
    if (phase < 0.7) {
      u = (phase - 0.3) / 0.4;
      return {
        accelerationPerPhaseSquared:
          -closingTravel * smootherStepSecond(u) / 0.4 ** 2,
        phase,
        segment: 'smooth-downward-traverse',
        value: sourceMaximumHalfSeparation - closingTravel * smootherStep01(u),
        velocityPerPhase: -closingTravel * smootherStepFirst(u) / 0.4,
      };
    }
    return {
      accelerationPerPhaseSquared: 0,
      phase,
      segment: 'lower-dwell',
      value: closedHalfSeparation,
      velocityPerPhase: 0,
    };
  };

  const sourceStateAtHeight = (halfSeparation, rate = 0,
    acceleration = 0) => {
    const reachSquared = sourceArmLength ** 2 - halfSeparation ** 2;
    if (reachSquared <= 0) {
      throw new RangeError('Parallel-ruler half-separation exceeds arm reach.');
    }
    const horizontalReach = Math.sqrt(reachSquared);
    const horizontalRate = -halfSeparation * rate / horizontalReach;
    const horizontalAcceleration = -(
      rate ** 2 + halfSeparation * acceleration
    ) / horizontalReach
      - halfSeparation ** 2 * rate ** 2 / horizontalReach ** 3;
    const topLeft = new THREE.Vector2(sourceLeftPivotX, halfSeparation);
    const topRight = new THREE.Vector2(sourceRightPivotX, halfSeparation);
    const bottomLeft = new THREE.Vector2(
      sourceLeftPivotX,
      -halfSeparation,
    );
    const bottomRight = new THREE.Vector2(
      sourceRightPivotX,
      -halfSeparation,
    );
    const middleLeft = new THREE.Vector2(
      sourceLeftPivotX + horizontalReach,
      0,
    );
    const middleRight = new THREE.Vector2(
      sourceRightPivotX + horizontalReach,
      0,
    );
    const topVelocity = new THREE.Vector2(0, rate);
    const bottomVelocity = new THREE.Vector2(0, -rate);
    const middleVelocity = new THREE.Vector2(horizontalRate, 0);
    const topAcceleration = new THREE.Vector2(0, acceleration);
    const bottomAcceleration = new THREE.Vector2(0, -acceleration);
    const middleAcceleration = new THREE.Vector2(
      horizontalAcceleration,
      0,
    );
    const upperVector = middleLeft.clone().sub(topLeft);
    const upperVelocity = middleVelocity.clone().sub(topVelocity);
    const upperAcceleration = middleAcceleration.clone()
      .sub(topAcceleration);
    const lowerVector = middleLeft.clone().sub(bottomLeft);
    const lowerVelocity = middleVelocity.clone().sub(bottomVelocity);
    const lowerAcceleration = middleAcceleration.clone()
      .sub(bottomAcceleration);
    const upperRates = rigidVectorRates(
      upperVector,
      upperVelocity,
      upperAcceleration,
    );
    const lowerRates = rigidVectorRates(
      lowerVector,
      lowerVelocity,
      lowerAcceleration,
    );
    return {
      arms: {
        lowerAngle: lowerRates.angle,
        lowerAngularAcceleration: lowerRates.angularAcceleration,
        lowerAngularVelocity: lowerRates.angularVelocity,
        upperAngle: upperRates.angle,
        upperAngularAcceleration: upperRates.angularAcceleration,
        upperAngularVelocity: upperRates.angularVelocity,
      },
      bottomAcceleration,
      bottomLeft,
      bottomRight,
      bottomVelocity,
      halfSeparation,
      halfSeparationAcceleration: acceleration,
      halfSeparationRate: rate,
      horizontalAcceleration,
      horizontalRate,
      horizontalReach,
      middleAcceleration,
      middleLeft,
      middleRight,
      middleVelocity,
      topAcceleration,
      topLeft,
      topRight,
      topVelocity,
    };
  };

  const sourceStateAtArmAngles = (upperAngle, lowerAngle) => {
    const topLeft = new THREE.Vector2(sourceLeftPivotX, 0);
    const topRight = new THREE.Vector2(sourceRightPivotX, 0);
    const upperVector = new THREE.Vector2(
      Math.cos(upperAngle),
      Math.sin(upperAngle),
    ).multiplyScalar(sourceArmLength);
    const lowerVector = new THREE.Vector2(
      Math.cos(lowerAngle),
      Math.sin(lowerAngle),
    ).multiplyScalar(sourceArmLength);
    const middleLeft = topLeft.clone().add(upperVector);
    const middleRight = topRight.clone().add(upperVector);
    const bottomLeft = middleLeft.clone().sub(lowerVector);
    const bottomRight = middleRight.clone().sub(lowerVector);
    return {
      bottomLeft,
      bottomRight,
      lowerAngle,
      middleLeft,
      middleRight,
      topLeft,
      topRight,
      upperAngle,
    };
  };

  const sourcePointToWorld = (point, height) => new THREE.Vector3(
    (point.x - sourceCenterX) * sourceScale,
    height,
    -point.y * sourceScale,
  );
  const sourceVectorToWorld = (vector) => new THREE.Vector3(
    vector.x * sourceScale,
    0,
    -vector.y * sourceScale,
  );

  const stateFromHeightSchedule = (schedule, time) => {
    const phaseRate = 1 / cyclePeriod;
    const halfSeparationRate = schedule.velocityPerPhase * phaseRate;
    const halfSeparationAcceleration =
      schedule.accelerationPerPhaseSquared * phaseRate ** 2;
    const source = sourceStateAtHeight(
      schedule.value,
      halfSeparationRate,
      halfSeparationAcceleration,
    );
    const point = (value, height) => sourcePointToWorld(value, height);
    const velocity = (value) => sourceVectorToWorld(value);
    return {
      arms: {
        lower: {
          angle: source.arms.lowerAngle,
          angularAcceleration: source.arms.lowerAngularAcceleration,
          angularVelocity: source.arms.lowerAngularVelocity,
        },
        upper: {
          angle: source.arms.upperAngle,
          angularAcceleration: source.arms.upperAngularAcceleration,
          angularVelocity: source.arms.upperAngularVelocity,
        },
      },
      bottomLeft: point(source.bottomLeft, armPlaneY),
      bottomRight: point(source.bottomRight, armPlaneY),
      bottomAcceleration: velocity(source.bottomAcceleration),
      bottomVelocity: velocity(source.bottomVelocity),
      halfSeparation: source.halfSeparation * sourceScale,
      halfSeparationAcceleration:
        source.halfSeparationAcceleration * sourceScale,
      halfSeparationRate: source.halfSeparationRate * sourceScale,
      horizontalReach: source.horizontalReach * sourceScale,
      middleAcceleration: velocity(source.middleAcceleration),
      middleLeft: point(source.middleLeft, armPlaneY),
      middleRight: point(source.middleRight, armPlaneY),
      middleVelocity: velocity(source.middleVelocity),
      phase: schedule.phase,
      scheduleSegment: schedule.segment,
      source,
      time,
      topLeft: point(source.topLeft, armPlaneY),
      topRight: point(source.topRight, armPlaneY),
      topAcceleration: velocity(source.topAcceleration),
      topVelocity: velocity(source.topVelocity),
    };
  };

  const officialSourceStateAtTime = (time) => {
    const phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    const schedule = officialHeightAtPhase(phase);
    const phaseRate = 1 / cyclePeriod;
    return sourceStateAtHeight(
      schedule.value,
      schedule.velocityPerPhase * phaseRate,
      schedule.accelerationPerPhaseSquared * phaseRate ** 2,
    );
  };
  const stateAtTime = (time) => {
    const phase = positiveModulo(time, cyclePeriod) / cyclePeriod;
    return stateFromHeightSchedule(smoothHeightAtPhase(phase), time);
  };
  const canonicalTimes = {
    sourceStart: 0,
    upperExtreme: cyclePeriod * 0.2,
    upperDwellEnd: cyclePeriod * 0.3,
    descendingMidpoint: cyclePeriod * 0.5,
    lowerExtreme: cyclePeriod * 0.7,
    lowerDwellEnd: cyclePeriod * 0.8,
    cycleClosure: cyclePeriod,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const rulerMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.60,
  });
  const rulerEdgeMaterial = new THREE.LineBasicMaterial({
    color: PALETTE.ink,
  });
  const armMaterial = matte(0x3e9368, {
    metalness: 0.13,
    roughness: 0.54,
  });
  const intermediateMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.56,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.47,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.45 });
  const capMaterial = matte(PALETTE.muted, { metalness: 0.2, roughness: 0.45 });

  const makeRuler = (points, role) => {
    const group = new THREE.Group();
    group.userData.role = role;
    const pivotY = role.startsWith('upper') ? .5 : -.5;
    const geometry = plate(clip.difference(poly(points.map(([x, y]) => [x * sourceScale, y * sourceScale])),
      ...[-5.333333, -2.666667].map(x => poly(circle([x * sourceScale, pivotY * sourceScale], .104, 64)))),
    -rulerDepth / 2, rulerDepth / 2).rotateX(-Math.PI / 2);
    const body = new THREE.Mesh(geometry, rulerMaterial);
    body.userData.role = `${role}-solid-body`;
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 24),
      rulerEdgeMaterial,
    );
    outline.userData.noShadow = true;
    outline.userData.role = `${role}-source-outline`;
    outline.visible = false; // ink edge line only: kept for references, not drawn
    outline.userData.retiredInkOutline = true;
    group.add(body, outline);
    return { body, group, outline };
  };
  const upperRuler = makeRuler(
    sourceUpperRulerPoints,
    'upper-parallel-ruler-end',
  );
  const lowerRuler = makeRuler(
    sourceLowerRulerPoints,
    'lower-parallel-ruler-end',
  );
  const intermediateBar = new THREE.Group();
  intermediateBar.userData.role =
    'intermediate-parallel-bar-joining-both-middle-joints';
  const intermediateGeometry = plate(clip.difference(poly(sourceIntermediateBarPoints.map(([x, y]) => [x * sourceScale, y * sourceScale])),
    ...[0, pivotSpacing].map(x => poly(circle([x, 0], .119, 64)))),
  -intermediateDepth / 2, intermediateDepth / 2).rotateX(-Math.PI / 2);
  const intermediateBody = new THREE.Mesh(
    intermediateGeometry,
    intermediateMaterial,
  );
  intermediateBody.userData.role = 'intermediate-arrow-ended-rigid-bar';
  const intermediateOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(intermediateGeometry, 24),
    rulerEdgeMaterial,
  );
  intermediateOutline.userData.noShadow = true;
  intermediateOutline.userData.role = 'intermediate-bar-source-outline';
  intermediateOutline.visible = false; // ink edge line only: kept for references, not drawn
  intermediateOutline.userData.retiredInkOutline = true;
  const middleLeftAnchor = new THREE.Object3D();
  middleLeftAnchor.position.y = armPlaneY - intermediatePlaneY;
  middleLeftAnchor.userData.role = 'intermediate-left-middle-pivot-anchor';
  const middleRightAnchor = new THREE.Object3D();
  middleRightAnchor.position.set(
    pivotSpacing,
    armPlaneY - intermediatePlaneY,
    0,
  );
  middleRightAnchor.userData.role = 'intermediate-right-middle-pivot-anchor';
  intermediateBar.add(
    intermediateBody,
    intermediateOutline,
    middleLeftAnchor,
    middleRightAnchor,
  );
  root.add(upperRuler.group, lowerRuler.group, intermediateBar);

  const links = {
    upperLeft: makePlanarLink({
      depth: armDepth,
      eyeMaterial: whiteMaterial,
      length: armLength,
      material: armMaterial,
      role: 'upper-left-equal-arm',
      width: armWidth,
    }),
    upperRight: makePlanarLink({
      depth: armDepth,
      eyeMaterial: whiteMaterial,
      length: armLength,
      material: armMaterial,
      role: 'upper-right-equal-arm',
      width: armWidth,
    }),
    lowerLeft: makePlanarLink({
      depth: armDepth,
      eyeMaterial: whiteMaterial,
      length: armLength,
      material: armMaterial,
      role: 'lower-left-equal-arm',
      width: armWidth,
    }),
    lowerRight: makePlanarLink({
      depth: armDepth,
      eyeMaterial: whiteMaterial,
      length: armLength,
      material: armMaterial,
      role: 'lower-right-equal-arm',
      width: armWidth,
    }),
  };
  root.add(...Object.values(links).map(({ group }) => group));

  const rulerPivotAnchors = {
    upperLeft: new THREE.Object3D(),
    upperRight: new THREE.Object3D(),
    lowerLeft: new THREE.Object3D(),
    lowerRight: new THREE.Object3D(),
  };
  const localLeftPivotX = -5.333333 * sourceScale;
  const localRightPivotX = -2.666667 * sourceScale;
  rulerPivotAnchors.upperLeft.position.set(
    localLeftPivotX,
    armPlaneY - rulerPlaneY,
    -0.5 * sourceScale,
  );
  rulerPivotAnchors.upperRight.position.set(
    localRightPivotX,
    armPlaneY - rulerPlaneY,
    -0.5 * sourceScale,
  );
  rulerPivotAnchors.lowerLeft.position.set(
    localLeftPivotX,
    armPlaneY - rulerPlaneY,
    0.5 * sourceScale,
  );
  rulerPivotAnchors.lowerRight.position.set(
    localRightPivotX,
    armPlaneY - rulerPlaneY,
    0.5 * sourceScale,
  );
  upperRuler.group.add(
    rulerPivotAnchors.upperLeft,
    rulerPivotAnchors.upperRight,
  );
  lowerRuler.group.add(
    rulerPivotAnchors.lowerLeft,
    rulerPivotAnchors.lowerRight,
  );

  const pivotPins = {
    upperLeft: cylinderAlongY(0.10, 0.58, inkMaterial, 30),
    upperRight: cylinderAlongY(0.10, 0.58, inkMaterial, 30),
    lowerLeft: cylinderAlongY(0.10, 0.58, inkMaterial, 30),
    lowerRight: cylinderAlongY(0.10, 0.58, inkMaterial, 30),
    middleLeft: cylinderAlongY(0.115, 0.58, inkMaterial, 32),
    middleRight: cylinderAlongY(0.115, 0.58, inkMaterial, 32),
  };
  const pivotCaps = Object.fromEntries(
    Object.entries(pivotPins).map(([name]) => {
      // Steel (the role name is historical): a white cap would read as a
      // hole on the cream page.
      const cap = cylinderAlongY(0.065, 0.035, capMaterial, 28);
      cap.userData.role = `${name}-white-pivot-cap`;
      return [name, cap];
    }),
  );
  Object.entries(pivotPins).forEach(([name, pin]) => {
    pin.userData.role = `${name}-shared-revolute-pin`;
    root.add(pin, pivotCaps[name]);
  });

  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(7.10, 0.055, 4.40),
    matte(PALETTE.paper, { roughness: 0.98 }),
  );
  paper.position.y = 0.0275;
  paper.userData.role = 'drawing-sheet-below-jointed-parallel-ruler';
  const paperOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(paper.geometry),
    new THREE.LineBasicMaterial({ color: 0xc5beb1 }),
  );
  paperOutline.position.copy(paper.position);
  paperOutline.userData.noShadow = true;
  paperOutline.userData.role = 'drawing-sheet-outline';
  const parallelGuideLines = [-1.50, 0, 1.50].map((z, index) => {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-3.38, 0.060, z),
        new THREE.Vector3(3.38, 0.060, z),
      ]),
      new THREE.LineBasicMaterial({
        color: 0xbcb5a9,
        transparent: true,
        opacity: 0.55,
      }),
    );
    line.userData.noShadow = true;
    line.userData.role = `parallel-reference-line-${index + 1}`;
    return line;
  });
  // Retain metadata compatibility, but the source drawing has no raised paper slab.
  paper.visible = paperOutline.visible = false;
  parallelGuideLines.forEach(line => { line.visible = false; });
  for (const object of [paper, paperOutline, ...parallelGuideLines]) disposeObject3D(object);

  const contacts = {
    lowerRulerPivots: {
      fixedToMember: lowerRuler.group,
      members: [links.lowerLeft.group, links.lowerRight.group],
      points: [new THREE.Vector3(), new THREE.Vector3()],
      type: 'two-revolute-joints-lower-ruler-to-equal-lower-arms',
    },
    middleTernaryPivots: {
      intermediateMember: intermediateBar,
      leftMembers: [links.upperLeft.group, links.lowerLeft.group],
      points: [new THREE.Vector3(), new THREE.Vector3()],
      rightMembers: [links.upperRight.group, links.lowerRight.group],
      type:
        'two-ternary-revolute-joints-each-sharing-upper-arm-lower-arm-and-intermediate-bar',
    },
    upperRulerPivots: {
      fixedToMember: upperRuler.group,
      members: [links.upperLeft.group, links.upperRight.group],
      points: [new THREE.Vector3(), new THREE.Vector3()],
      type: 'two-revolute-joints-upper-ruler-to-equal-upper-arms',
    },
  };

  const setLinkPose = (link, start, angle, angularVelocity,
    angularAcceleration) => {
    link.group.position.copy(start);
    link.group.rotation.y = angle;
    link.group.userData.angularVelocity = angularVelocity;
    link.group.userData.angularAcceleration = angularAcceleration;
  };
  const setPivot = (object, cap, point, middle) => {
    object.position.set(point.x, 0.40, point.z);
    cap.position.set(point.x, 0.7075, point.z);
  };
  const update = (time) => {
    const state = stateAtTime(time);
    const upperOrigin = sourcePointToWorld(
      new THREE.Vector2(sourceRulerTransformX,
        state.source.halfSeparation - 0.5),
      rulerPlaneY,
    );
    const lowerOrigin = sourcePointToWorld(
      new THREE.Vector2(sourceRulerTransformX,
        -state.source.halfSeparation + 0.5),
      rulerPlaneY,
    );
    upperRuler.group.position.copy(upperOrigin);
    lowerRuler.group.position.copy(lowerOrigin);
    intermediateBar.position.set(
      state.middleLeft.x,
      intermediatePlaneY,
      state.middleLeft.z,
    );

    setLinkPose(links.upperLeft, state.topLeft,
      state.arms.upper.angle,
      state.arms.upper.angularVelocity,
      state.arms.upper.angularAcceleration);
    setLinkPose(links.upperRight, state.topRight,
      state.arms.upper.angle,
      state.arms.upper.angularVelocity,
      state.arms.upper.angularAcceleration);
    setLinkPose(links.lowerLeft, state.bottomLeft,
      state.arms.lower.angle,
      state.arms.lower.angularVelocity,
      state.arms.lower.angularAcceleration);
    setLinkPose(links.lowerRight, state.bottomRight,
      state.arms.lower.angle,
      state.arms.lower.angularVelocity,
      state.arms.lower.angularAcceleration);

    setPivot(pivotPins.upperLeft, pivotCaps.upperLeft,
      state.topLeft, false);
    setPivot(pivotPins.upperRight, pivotCaps.upperRight,
      state.topRight, false);
    setPivot(pivotPins.lowerLeft, pivotCaps.lowerLeft,
      state.bottomLeft, false);
    setPivot(pivotPins.lowerRight, pivotCaps.lowerRight,
      state.bottomRight, false);
    setPivot(pivotPins.middleLeft, pivotCaps.middleLeft,
      state.middleLeft, true);
    setPivot(pivotPins.middleRight, pivotCaps.middleRight,
      state.middleRight, true);

    contacts.upperRulerPivots.points[0].copy(state.topLeft);
    contacts.upperRulerPivots.points[1].copy(state.topRight);
    contacts.lowerRulerPivots.points[0].copy(state.bottomLeft);
    contacts.lowerRulerPivots.points[1].copy(state.bottomRight);
    contacts.middleTernaryPivots.points[0].copy(state.middleLeft);
    contacts.middleTernaryPivots.points[1].copy(state.middleRight);
    root.userData.kinematics = state;
  };

  const modelPointToOfficialAnimationRaster = (point) => {
    const sourceX = point.x / sourceScale + sourceCenterX;
    const sourceY = -point.z / sourceScale;
    return new THREE.Vector2(
      (sourceX - sourceView[0])
        * officialCanvasWidth / sourceView[2],
      officialCanvasHeight - (sourceY - sourceView[1])
        * officialCanvasHeight / sourceView[3],
    );
  };

  root.userData.archetype =
    'jointed-two-dof-parallel-ruler-with-intermediate-bar';
  root.userData.blocks = {
    intermediateBar,
    intermediateBody,
    intermediateOutline,
    links,
    lowerRuler,
    middleLeftAnchor,
    middleRightAnchor,
    paper,
    paperOutline,
    parallelGuideLines,
    pivotCaps,
    pivotPins,
    rulerPivotAnchors,
    upperRuler,
  };
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.56, 0, -2.18),
    new THREE.Vector3(3.56, 0.76, 2.18),
  );
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    animatedPath:
      'one symmetric opening coordinate chosen only for the source demonstration',
    mechanism: 2,
    workspace:
      'independent common angles of the two equal upper arms and two equal lower arms translate the three mutually parallel bars',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    armDepth,
    armLength,
    armPlaneY,
    armWidth,
    cyclePeriod,
    intermediateDepth,
    intermediatePlaneY,
    pivotSpacing,
    rulerDepth,
    rulerPlaneY,
    sourceArmLength,
    sourceCenterX,
    sourceIntermediatePivotSpacing,
    closedHalfSeparation,
    sourceMaximumHalfSeparation,
    sourceMinimumHalfSeparation,
    sourceOfficialIntermediatePivotSpacing,
    sourceRulerPivotSpacing,
    sourceScale,
  };
  root.userData.groundFloorY = 0;
  root.userData.mechanism =
    'upper-and-lower-parallel-ruler-ends-with-two-equal-pivot-spacings-four-equal-jointed-arms-sharing-two-ternary-middle-pivots-on-one-rigid-intermediate-parallel-bar';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.officialHeightAtPhase = officialHeightAtPhase;
  root.userData.officialSourceStateAtTime = officialSourceStateAtTime;
  root.userData.smoothHeightAtPhase = smoothHeightAtPhase;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: sourceCyclesPerMinute,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialFunctionChain: [
      'add_pos_interp-upper-ruler',
      'add_pos_interp-lower-ruler',
      'four-add_c_rod-equal-arms-to-horizontal-middle-line',
      'add_tx-intermediate-bar-from-left-middle-pivot',
    ],
    officialGeometry: {
      armLength: sourceArmLength,
      intermediatePivotSpacing:
        sourceOfficialIntermediatePivotSpacing,
      lowerRulerPoints: sourceLowerRulerPoints,
      phaseOffset: sourcePhaseOffset,
      rulerPivotSpacing: sourceRulerPivotSpacing,
      upperRulerPoints: sourceUpperRulerPoints,
      view: sourceView,
    },
    officialKeyframePhases: sourceKeyframePhases,
    officialSymmetricHalfSeparationSchedule: [
      { phase: 0, value: 1.5 },
      { phase: 0.2, value: 2 },
      { phase: 0.3, value: 2 },
      { phase: 0.7, value: 1 },
      { phase: 0.8, value: 1 },
      { phase: 1, value: 1.5 },
    ],
    physicalCorrection: {
      applied: true,
      magnitudeSourceUnits: Math.abs(
        sourceOfficialIntermediatePivotSpacing
          - sourceRulerPivotSpacing,
      ),
      reason:
        'the published decimal ruler spacing is 2.666666 while the intermediate bar is 2.666667; the 3D bar uses 2.666666 so both ternary pins close exactly',
    },
    referenceScope:
      'official ruler and arrow-bar outlines, four equal 2.386304-unit arms, pivot stations, symmetric opening path, keyframe intervals, view, and 15-cpm demonstration timing',
    sourceUrl: movement.sourceUrl,
    closedStop: {
      officialHalfSeparation: sourceMinimumHalfSeparation,
      modelHalfSeparation: closedHalfSeparation,
      reason:
        'the official closed pose has the rulers, tails and arrow bar exactly edge to edge; the 3D path stops 0.05 source units short so the three bars never overlap and stay visibly separate',
    },
    timingRefinement: {
      changesExtremaOrDwells: true,
      interpolation: 'quintic smootherstep',
      reason:
        'the official linear add_pos_interp changes velocity instantaneously at its four traverse/dwell boundaries; C2-continuous interpolation removes visible endpoint jerk while preserving every pose constraint, the open extremum, every dwell interval and the cycle duration (only the closed dwell stops at closedStop.modelHalfSeparation)',
    },
  };
  root.userData.sourceReference = {
    brownPlate349: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'two long parallel ruler ends, two jointed equal-arm pairs, and one arrow-ended intermediate bar joining the two middle pivots',
      measurementUncertaintyPixels: 8,
      rasterIntermediateLeftPivot: new THREE.Vector2(244, 248),
      rasterIntermediateRightPivot: new THREE.Vector2(449, 252),
      rasterLowerLeftPivot: new THREE.Vector2(158, 357),
      rasterLowerRightPivot: new THREE.Vector2(359, 357),
      rasterUpperLeftPivot: new THREE.Vector2(161, 133),
      rasterUpperRightPivot: new THREE.Vector2(358, 133),
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
  root.userData.sourceStateAtArmAngles = sourceStateAtArmAngles;
  root.userData.sourceStateAtHeight = sourceStateAtHeight;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    arbitraryConfiguration:
      'if both upper arms share vector u and both lower arms share vector v, their equal pivot spacings force upper, intermediate, and lower bars to retain one common direction for arbitrary u and v',
    animatedInput:
      'symmetric manual change of upper/lower half-separation h between 1 and 2 source units',
    animatedOutput:
      'intermediate bar translates horizontally by q=sqrt(L^2-h^2) while all three bars remain parallel',
    armLengthConstraint: '|upper arm|=|lower arm|=L=2.386304',
    parallelismConstraint:
      'topRight-topLeft=middleRight-middleLeft=bottomRight-bottomLeft=(2.666666,0)',
  };

  root.userData.hideGround = true;
  root.userData.cameraFov = 8;
  root.traverse(object => { for (const material of [object.material].flat().filter(Boolean)) material.fog = false; });
  update(0);
  markShadows(root);
  for (const object of [
    upperRuler.outline,
    lowerRuler.outline,
    intermediateOutline,
    paperOutline,
    ...parallelGuideLines,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  return {
    cameraDirection: new THREE.Vector3(0, 12, .9),
    root,
    update,
  };
}

export function createAuthoredJointedParallelRulerMovement(movement) {
  if (movement.id !== 349) return null;
  return jointedParallelRuler(movement);
}
