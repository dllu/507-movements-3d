import * as THREE from 'three';
import {makeRulerArm, boredRulerPlate, finishDrawingRuler} from './drawing-ruler-parts.js';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherstep(value) {
  return value ** 3 * (value * (value * 6 - 15) + 10);
}

function smootherstepFirst(value) {
  return 30 * value ** 2 * (1 - value) ** 2;
}

function smootherstepSecond(value) {
  return 60 * value * (1 - value) * (1 - 2 * value);
}

function capsulePath(startX, endX, radius, samples = 20) {
  const path = new THREE.Path();
  path.moveTo(startX, -radius);
  for (let index = 1; index <= samples; index += 1) {
    const angle = -Math.PI / 2 - Math.PI * index / samples;
    path.lineTo(
      startX + Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    );
  }
  path.lineTo(endX, radius);
  for (let index = 1; index <= samples; index += 1) {
    const angle = Math.PI / 2 - Math.PI * index / samples;
    path.lineTo(
      endX + Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    );
  }
  path.closePath();
  return path;
}

function makeSlottedRuler({
  depth,
  halfLength,
  halfWidth,
  role,
  slotEndX,
  slotRadius,
  slotStartX,
  fixedPivotX,
}) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfLength, -halfWidth);
  shape.lineTo(halfLength, -halfWidth);
  shape.lineTo(halfLength, halfWidth);
  shape.lineTo(-halfLength, halfWidth);
  shape.closePath();
  shape.holes.push(capsulePath(slotStartX, slotEndX, slotRadius));
  const pivotBore = new THREE.Path();
  pivotBore.absarc(fixedPivotX, 0, .09, 0, Math.PI * 2, true);
  shape.holes.push(pivotBore);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 8,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateX(Math.PI / 2);
  const group = new THREE.Group();
  group.userData.role = role;
  group.userData.slot = {
    centerlineEndX: slotEndX,
    centerlineStartX: slotStartX,
    radius: slotRadius,
  };
  group.userData.solidDepth = depth;

  const body = new THREE.Mesh(geometry, [
    matte(PALETTE.driven, { metalness: 0.08, roughness: 0.66 }),
    matte(PALETTE.ink, { metalness: 0.12, roughness: 0.57 }),
  ]);
  body.userData.isRigidBody = true;
  body.userData.role = `${role}-solid-with-real-sliding-slot-B`;
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 22),
    new THREE.LineBasicMaterial({ color: PALETTE.ink }),
  );
  outline.userData.noShadow = true;
  outline.userData.role = `${role}-source-outline-and-slot-border`;

  const topBand = makeBeam(
    new THREE.Vector3(-halfLength + 0.05, depth / 2 + 0.024,
      halfWidth - 0.045),
    new THREE.Vector3(halfLength - 0.05, depth / 2 + 0.024,
      halfWidth - 0.045),
    {
      color: PALETTE.ink,
      depth: 0.030,
      jointRadius: 0.001,
      thickness: 0.040,
    },
  );
  topBand.userData.role = `${role}-long-parallel-working-edge`;
  group.add(body, outline, topBand);
  group.userData.body = body;
  group.userData.outline = outline;
  group.userData.workingEdgeBand = topBand;
  return markShadows(group);
}

function makeVerticalPin({
  baseY,
  height,
  radius,
  role,
  washerY,
}) {
  const group = new THREE.Group();
  group.userData.role = role;
  group.userData.radius = radius;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, height, 28),
    matte(PALETTE.ink, { metalness: 0.27, roughness: 0.42 }),
  );
  shaft.position.y = baseY + height / 2;
  shaft.userData.role = `${role}-vertical-shaft`;
  const washer = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.032, 10, 36),
    matte(PALETTE.white, { metalness: 0.08, roughness: 0.48 }),
  );
  washer.rotation.x = Math.PI / 2;
  washer.position.y = washerY;
  washer.userData.role = `${role}-white-joint-washer`;
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.74, radius * 0.74, 0.075, 28),
    matte(PALETTE.ink, { metalness: 0.24, roughness: 0.44 }),
  );
  cap.position.y = washerY + 0.035;
  cap.userData.role = `${role}-retaining-head`;
  group.add(shaft, washer, cap);
  return markShadows(group);
}

function makeSimpleRuler({ depth, length, role, width, pivotXs }) {
  const group = new THREE.Group();
  group.userData.role = role;
  group.userData.solidDepth = depth;
  const body = new THREE.Mesh(
    boredRulerPlate(length, width, depth, pivotXs),
    matte(PALETTE.driven, { metalness: 0.08, roughness: 0.66 }),
  );
  body.userData.isRigidBody = true;
  body.userData.role = `${role}-rigid-solid`;
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry),
    new THREE.LineBasicMaterial({ color: PALETTE.ink }),
  );
  outline.userData.noShadow = true;
  outline.userData.role = `${role}-source-outline`;
  const workingEdgeBand = makeBeam(
    new THREE.Vector3(-length / 2 + 0.05, depth / 2 + 0.024,
      width / 2 - 0.045),
    new THREE.Vector3(length / 2 - 0.05, depth / 2 + 0.024,
      width / 2 - 0.045),
    {
      color: PALETTE.ink,
      depth: 0.030,
      jointRadius: 0.001,
      thickness: 0.040,
    },
  );
  workingEdgeBand.userData.role = `${role}-long-parallel-working-edge`;
  group.add(body, outline, workingEdgeBand);
  group.userData.body = body;
  group.userData.outline = outline;
  group.userData.workingEdgeBand = workingEdgeBand;
  return markShadows(group);
}

function compoundCrossedArmParallelRuler(movement) {
  const root = new THREE.Group();

  // The official canvas publishes an exact 15 by 2 ruler, a 13-unit arm,
  // and the two separation limits below.  A uniform half-scale keeps all
  // those ratios intact in the 3D study.
  const officialScale = 0.5;
  const rulerLength = 15 * officialScale;
  const rulerWidth = 2 * officialScale;
  const rulerDepth = 0.18;
  const rulerTopY = rulerDepth / 2;
  const fixedPivotX = 6.5 * officialScale;
  const slotStartX = -6.5 * officialScale;
  const slotEndX = -2.5 * officialScale;
  const slotRadius = 0.30 * officialScale;
  const sliderPinRadius = 0.24 * officialScale;
  const fixedPinRadius = 0.25 * officialScale;
  const centerPinRadius = 0.27 * officialScale;
  const armLength = 13 * officialScale;
  const armMidpointStation = armLength / 2;
  const minimumHalfSeparation = 2 * officialScale;
  const maximumHalfSeparation = 4.366061 * officialScale;
  const demonstrationPeriod = 5;
  const outwardEndPhase = 0.40;
  const outwardHoldEndPhase = 0.50;
  const returnEndPhase = 0.90;
  const transitionDuration = demonstrationPeriod * outwardEndPhase;
  const armLayerUpperToLower = 0.35;
  const armLayerLowerToUpper = 0.49;
  const pinBaseY = -rulerDepth / 2 - 0.02;
  const pinHeight = 0.74;
  const pinWasherY = 0.60;
  const paperTopY = -rulerDepth / 2 - 0.055;

  const sliderXForHalfSeparation = (halfSeparation) => fixedPivotX
    - Math.sqrt(armLength ** 2 - (2 * halfSeparation) ** 2);
  const referenceSliderX = sliderXForHalfSeparation(
    minimumHalfSeparation,
  );
  const referenceCenterPivotX = (fixedPivotX + referenceSliderX) / 2;

  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterCenterPivot = new THREE.Vector2(280, 273);
  const sourceRasterUpperRuler = {
    bottomLeft: new THREE.Vector2(14, 238),
    bottomRight: new THREE.Vector2(518, 238),
    topLeft: new THREE.Vector2(13, 170),
    topRight: new THREE.Vector2(518, 170),
  };
  const sourceRasterLowerRuler = {
    bottomLeft: new THREE.Vector2(13, 378),
    bottomRight: new THREE.Vector2(516, 379),
    topLeft: new THREE.Vector2(13, 308),
    topRight: new THREE.Vector2(516, 309),
  };
  const sourceRasterUpperFixedPivot = new THREE.Vector2(480, 201);
  const sourceRasterLowerFixedPivot = new THREE.Vector2(477, 345);
  const sourceRasterUpperSliderB = new THREE.Vector2(75, 201);
  const sourceRasterLowerSlider = new THREE.Vector2(75, 345);
  const sourceScaleX = rulerLength / 505;
  const sourceScaleZ = rulerWidth / 68;
  const sourcePointToReferenceFront = (point) => new THREE.Vector3(
    referenceCenterPivotX
      + (point.x - sourceRasterCenterPivot.x) * sourceScaleX,
    rulerTopY,
    -(point.y - sourceRasterCenterPivot.y) * sourceScaleZ,
  );

  const upperRulerA = makeSlottedRuler({
    depth: rulerDepth,
    halfLength: rulerLength / 2,
    halfWidth: rulerWidth / 2,
    role: 'upper-simple-ruler-A',
    slotEndX,
    slotRadius,
    slotStartX,
    fixedPivotX,
  });
  const lowerRulerA = makeSlottedRuler({
    depth: rulerDepth,
    halfLength: rulerLength / 2,
    halfWidth: rulerWidth / 2,
    role: 'lower-simple-ruler-A',
    slotEndX,
    slotRadius,
    slotStartX,
    fixedPivotX,
  });

  const upperFixedPin = makeVerticalPin({
    baseY: pinBaseY,
    height: pinHeight,
    radius: fixedPinRadius,
    role: 'fixed-arm-pivot-on-upper-ruler-A',
    washerY: pinWasherY,
  });
  upperFixedPin.position.x = fixedPivotX;
  const lowerFixedPin = makeVerticalPin({
    baseY: pinBaseY,
    height: pinHeight,
    radius: fixedPinRadius,
    role: 'fixed-arm-pivot-on-lower-ruler-A',
    washerY: pinWasherY,
  });
  lowerFixedPin.position.x = fixedPivotX;
  upperRulerA.add(upperFixedPin);
  lowerRulerA.add(lowerFixedPin);

  const upperSliderPinB = makeVerticalPin({
    baseY: pinBaseY,
    height: pinHeight,
    radius: sliderPinRadius,
    role: 'upper-slot-sliding-pin-B',
    washerY: pinWasherY,
  });
  const lowerSliderPin = makeVerticalPin({
    baseY: pinBaseY,
    height: pinHeight,
    radius: sliderPinRadius,
    role: 'lower-slot-sliding-pin-equivalent-to-B',
    washerY: pinWasherY,
  });
  const centerPivot = makeVerticalPin({
    baseY: armLayerUpperToLower - .075,
    height: .38,
    radius: centerPinRadius,
    role: 'common-midpoint-pivot-of-both-crossed-arms',
    washerY: pinWasherY + 0.035,
  });

  const armUpperFixedToLowerSlider = makeRulerArm(armLength, {middleEye: true});
  armUpperFixedToLowerSlider.userData.nominalLength = armLength;
  armUpperFixedToLowerSlider.userData.role =
    'crossed-arm-upper-fixed-to-lower-slot';
  const armLowerFixedToUpperSlider = makeRulerArm(armLength, {middleEye: true});
  armLowerFixedToUpperSlider.userData.nominalLength = armLength;
  armLowerFixedToUpperSlider.userData.role =
    'crossed-arm-lower-fixed-to-upper-slot';

  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(9.0, 0.07, 7.3),
    matte(PALETTE.paper, { roughness: 0.98 }),
  );
  paper.position.y = paperTopY - 0.035;
  paper.userData.role = 'drawing-plane-beneath-compound-parallel-ruler';
  const paperOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(paper.geometry),
    new THREE.LineBasicMaterial({ color: 0xc5beb1 }),
  );
  paperOutline.position.copy(paper.position);
  paperOutline.userData.noShadow = true;
  paperOutline.userData.role = 'compound-ruler-drawing-sheet-outline';

  root.add(
    paper,
    paperOutline,
    upperRulerA,
    lowerRulerA,
    armUpperFixedToLowerSlider,
    armLowerFixedToUpperSlider,
    upperSliderPinB,
    lowerSliderPin,
    centerPivot,
  );

  const motionAtPhase = (phase) => {
    const separationRange = maximumHalfSeparation
      - minimumHalfSeparation;
    if (phase <= outwardEndPhase) {
      const progress = phase / outwardEndPhase;
      return {
        acceleration: separationRange
          * smootherstepSecond(progress) / transitionDuration ** 2,
        halfSeparation: minimumHalfSeparation
          + separationRange * smootherstep(progress),
        mode: 'opening-rulers-with-both-slot-pins-sliding-inward',
        rate: separationRange
          * smootherstepFirst(progress) / transitionDuration,
      };
    }
    if (phase <= outwardHoldEndPhase) {
      return {
        acceleration: 0,
        halfSeparation: maximumHalfSeparation,
        mode: 'holding-maximum-parallel-separation',
        rate: 0,
      };
    }
    if (phase <= returnEndPhase) {
      const progress = (phase - outwardHoldEndPhase)
        / (returnEndPhase - outwardHoldEndPhase);
      return {
        acceleration: -separationRange
          * smootherstepSecond(progress) / transitionDuration ** 2,
        halfSeparation: maximumHalfSeparation
          - separationRange * smootherstep(progress),
        mode: 'closing-rulers-with-both-slot-pins-sliding-outward',
        rate: -separationRange
          * smootherstepFirst(progress) / transitionDuration,
      };
    }
    return {
      acceleration: 0,
      halfSeparation: minimumHalfSeparation,
      mode: 'holding-minimum-parallel-separation',
      rate: 0,
    };
  };

  const stateAtTime = (time) => {
    const phase = positiveModulo(time, demonstrationPeriod)
      / demonstrationPeriod;
    const motion = motionAtPhase(phase);
    const halfSeparation = motion.halfSeparation;
    const horizontalProjection = Math.sqrt(
      armLength ** 2 - (2 * halfSeparation) ** 2,
    );
    const sliderX = fixedPivotX - horizontalProjection;
    const sliderRate = 4 * halfSeparation * motion.rate
      / horizontalProjection;
    const sliderAcceleration = 4 * (
      motion.rate ** 2 + halfSeparation * motion.acceleration
    ) / horizontalProjection
      + 16 * halfSeparation ** 2 * motion.rate ** 2
        / horizontalProjection ** 3;

    const upperFixed = new THREE.Vector3(
      fixedPivotX,
      0,
      halfSeparation,
    );
    const lowerFixed = new THREE.Vector3(
      fixedPivotX,
      0,
      -halfSeparation,
    );
    const upperSlider = new THREE.Vector3(
      sliderX,
      0,
      halfSeparation,
    );
    const lowerSlider = new THREE.Vector3(
      sliderX,
      0,
      -halfSeparation,
    );
    const midpointUpperToLower = upperFixed.clone()
      .add(lowerSlider).multiplyScalar(0.5);
    const midpointLowerToUpper = lowerFixed.clone()
      .add(upperSlider).multiplyScalar(0.5);
    const vectorUpperToLower = lowerSlider.clone().sub(upperFixed);
    const vectorLowerToUpper = upperSlider.clone().sub(lowerFixed);
    const derivativeUpperToLower = new THREE.Vector3(
      sliderRate,
      0,
      -2 * motion.rate,
    );
    const derivativeLowerToUpper = new THREE.Vector3(
      sliderRate,
      0,
      2 * motion.rate,
    );
    const signedAngularRate = (vector, derivative) => (
      vector.x * derivative.z - vector.z * derivative.x
    ) / armLength ** 2;

    return {
      arms: {
        lowerFixedToUpperSlider: {
          angularRate: signedAngularRate(
            vectorLowerToUpper,
            derivativeLowerToUpper,
          ),
          end: upperSlider.clone(),
          length: vectorLowerToUpper.length(),
          midpoint: midpointLowerToUpper,
          start: lowerFixed.clone(),
        },
        upperFixedToLowerSlider: {
          angularRate: signedAngularRate(
            vectorUpperToLower,
            derivativeUpperToLower,
          ),
          end: lowerSlider.clone(),
          length: vectorUpperToLower.length(),
          midpoint: midpointUpperToLower,
          start: upperFixed.clone(),
        },
      },
      centerPivot: {
        closureResidual: midpointUpperToLower.clone()
          .sub(midpointLowerToUpper),
        position: midpointUpperToLower.clone(),
        velocity: new THREE.Vector3(sliderRate / 2, 0, 0),
      },
      halfSeparation,
      halfSeparationAcceleration: motion.acceleration,
      halfSeparationRate: motion.rate,
      horizontalProjection,
      lowerRuler: {
        endEdgeDirection: new THREE.Vector3(0, 0, rulerWidth),
        longEdgeDirection: new THREE.Vector3(rulerLength, 0, 0),
        rotation: 0,
        translation: new THREE.Vector3(0, 0, -halfSeparation),
      },
      mode: motion.mode,
      phase,
      pins: {
        lowerFixed,
        lowerSlider,
        upperFixed,
        upperSlider,
      },
      sliderAcceleration,
      sliderRate,
      sliderX,
      slots: {
        lower: {
          endMargin: slotEndX - sliderX,
          normalResidual: lowerSlider.z + halfSeparation,
          startMargin: sliderX - slotStartX,
        },
        upper: {
          endMargin: slotEndX - sliderX,
          normalResidual: upperSlider.z - halfSeparation,
          startMargin: sliderX - slotStartX,
        },
      },
      upperRuler: {
        endEdgeDirection: new THREE.Vector3(0, 0, rulerWidth),
        longEdgeDirection: new THREE.Vector3(rulerLength, 0, 0),
        rotation: 0,
        translation: new THREE.Vector3(0, 0, halfSeparation),
      },
    };
  };

  const withLayer = (point, layer) => new THREE.Vector3(
    point.x,
    layer,
    point.z,
  );
  const update = (time) => {
    const state = stateAtTime(time);
    upperRulerA.position.copy(state.upperRuler.translation);
    lowerRulerA.position.copy(state.lowerRuler.translation);
    upperRulerA.rotation.set(0, 0, 0);
    lowerRulerA.rotation.set(0, 0, 0);
    upperSliderPinB.position.copy(state.pins.upperSlider);
    lowerSliderPin.position.copy(state.pins.lowerSlider);
    centerPivot.position.copy(state.centerPivot.position);
    armUpperFixedToLowerSlider.userData.setEndpoints(
      withLayer(
        state.arms.upperFixedToLowerSlider.start,
        armLayerUpperToLower,
      ),
      withLayer(
        state.arms.upperFixedToLowerSlider.end,
        armLayerUpperToLower,
      ),
    );
    armUpperFixedToLowerSlider.userData.renderedStart = withLayer(
      state.arms.upperFixedToLowerSlider.start,
      armLayerUpperToLower,
    );
    armUpperFixedToLowerSlider.userData.renderedEnd = withLayer(
      state.arms.upperFixedToLowerSlider.end,
      armLayerUpperToLower,
    );
    armLowerFixedToUpperSlider.userData.setEndpoints(
      withLayer(
        state.arms.lowerFixedToUpperSlider.start,
        armLayerLowerToUpper,
      ),
      withLayer(
        state.arms.lowerFixedToUpperSlider.end,
        armLayerLowerToUpper,
      ),
    );
    armLowerFixedToUpperSlider.userData.renderedStart = withLayer(
      state.arms.lowerFixedToUpperSlider.start,
      armLayerLowerToUpper,
    );
    armLowerFixedToUpperSlider.userData.renderedEnd = withLayer(
      state.arms.lowerFixedToUpperSlider.end,
      armLayerLowerToUpper,
    );
    root.userData.contacts = {
      centerArmPivot: state.centerPivot,
      lowerSlotPin: state.slots.lower,
      upperSlotPinB: state.slots.upper,
    };
    root.userData.renderState = state;
  };
  update(0);

  root.userData.archetype =
    'crossed-midpoint-arm-slotted-compound-parallel-ruler';
  root.userData.blocks = {
    armLowerFixedToUpperSlider,
    armUpperFixedToLowerSlider,
    centerPivot,
    lowerFixedPin,
    lowerRulerA,
    lowerSliderPin,
    paper,
    paperOutline,
    upperFixedPin,
    upperRulerA,
    upperSliderPinB,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.45, paperTopY - 0.08, -3.0),
    new THREE.Vector3(4.45, 0.72, 3.0),
  );
  root.userData.constraints = {
    armLengths: 'both crossed arms retain length 13 source units',
    centerPivot: 'midpoint(upper fixed, lower slider) = midpoint(lower fixed, upper slider)',
    parallelRulers: 'rotation_upper = rotation_lower = 0',
    slots: 'slider pins remain on each ruler centerline and within the capsule limits',
    symmetry: 'translation_upper + translation_lower = 0',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    armLayerLowerToUpper,
    armLayerUpperToLower,
    armLength,
    armMidpointStation,
    centerPinRadius,
    demonstrationPeriod,
    fixedPinRadius,
    fixedPivotX,
    maximumHalfSeparation,
    minimumHalfSeparation,
    officialScale,
    outwardEndPhase,
    outwardHoldEndPhase,
    paperTopY,
    referenceCenterPivotX,
    referenceSliderX,
    returnEndPhase,
    rulerDepth,
    rulerLength,
    rulerTopY,
    rulerWidth,
    sliderPinRadius,
    slotEndX,
    slotRadius,
    slotStartX,
    sourceImageHeight,
    sourceImageWidth,
    sourceScaleX,
    sourceScaleZ,
    transitionDuration,
  };
  root.userData.mechanism =
    'two simple rulers A, A are joined by equal crossed arms: each arm is pivoted at the right end of one ruler, its opposite pin slides in slot B of the other ruler, and the arms share an exact midpoint pivot; this symmetric closure keeps both ruler ends and long edges parallel';
  root.userData.sourceAnimation = {
    available: true,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialGeometry: {
      armLength: 13,
      armMidpoint: 6.5,
      fixedPivotX: 0,
      rulerMaximumX: 1,
      rulerMinimumX: -14,
      rulerWidth: 2,
      slotEndX: -9,
      slotRadius: 0.25,
      slotStartX: -13,
    },
    officialKeyframes: [
      { lowerOrigin: new THREE.Vector2(0, -2), phase: 0, upperOrigin: new THREE.Vector2(0, 2) },
      { lowerOrigin: new THREE.Vector2(0, -4.366061), phase: 0.4, upperOrigin: new THREE.Vector2(0, 4.366061) },
      { lowerOrigin: new THREE.Vector2(0, -4.366061), phase: 0.5, upperOrigin: new THREE.Vector2(0, 4.366061) },
      { lowerOrigin: new THREE.Vector2(0, -2), phase: 0.9, upperOrigin: new THREE.Vector2(0, 2) },
      { lowerOrigin: new THREE.Vector2(0, -2), phase: 1, upperOrigin: new THREE.Vector2(0, 2) },
    ],
    officialPageAnimatedTabDisabled: false,
    referenceScope: 'The source canvas confirms two 15-by-2 rulers, slots from x=-13 to -9 with quarter-unit end radii, two equal 13-unit arms with midpoint holes, symmetric half-separation limits 2 and 4.366061, and move/hold/return/hold phases 0, 0.4, 0.5, 0.9, and 1. Material, thickness, pin stack, and interpolation easing are not dimensioned.',
    sourceUrl: 'https://507movements.com/mm_324.html',
  };
  root.userData.sourcePointToReferenceFront = sourcePointToReferenceFront;
  root.userData.sourceReference = {
    brownPlate324: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'two parallel slotted rulers A, A, two equal crossed arms, right-end fixed pivots, left slot pins including B, and one shared arm-midpoint pivot',
      measurementUncertaintyPixels: 12,
      rasterCenterPivot: sourceRasterCenterPivot.clone(),
      rasterLowerFixedPivot: sourceRasterLowerFixedPivot.clone(),
      rasterLowerRuler: {
        bottomLeft: sourceRasterLowerRuler.bottomLeft.clone(),
        bottomRight: sourceRasterLowerRuler.bottomRight.clone(),
        topLeft: sourceRasterLowerRuler.topLeft.clone(),
        topRight: sourceRasterLowerRuler.topRight.clone(),
      },
      rasterLowerSlider: sourceRasterLowerSlider.clone(),
      rasterUpperFixedPivot: sourceRasterUpperFixedPivot.clone(),
      rasterUpperRuler: {
        bottomLeft: sourceRasterUpperRuler.bottomLeft.clone(),
        bottomRight: sourceRasterUpperRuler.bottomRight.clone(),
        topLeft: sourceRasterUpperRuler.topLeft.clone(),
        topRight: sourceRasterUpperRuler.topRight.clone(),
      },
      rasterUpperSliderB: sourceRasterUpperSliderB.clone(),
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
  };
  root.userData.sliderXForHalfSeparation = sliderXForHalfSeparation;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod,
    schedule: [
      { event: 'minimum ruler separation begins opening', phase: 0 },
      { event: 'maximum separation reached', phase: outwardEndPhase },
      { event: 'maximum-separation hold ends', phase: outwardHoldEndPhase },
      { event: 'minimum separation restored', phase: returnEndPhase },
      { event: 'minimum-separation hold closes cycle', phase: 1 },
    ],
  };
  root.userData.transmission = {
    input: 'symmetric separation of the two rulers A, A',
    output: 'equal opposite slot-pin travel and rotation of both crossed arms about their common midpoint',
    rulerTranslationRatio: -1,
  };

  markShadows(root);
  paperOutline.castShadow = false;
  paperOutline.receiveShadow = false;
  finishDrawingRuler(root, [paper, paperOutline]);
  return {
    cameraDirection: new THREE.Vector3(0, 12, .9),
    root,
    update,
  };
}

function twoArmParallelogramRuler(movement) {
  const root = new THREE.Group();

  const officialScale = 0.5;
  const rulerLength = 15 * officialScale;
  const rulerWidth = 2 * officialScale;
  const rulerDepth = 0.18;
  const rulerTopY = rulerDepth / 2;
  const armLength = 9 * officialScale;
  const armHalfLength = armLength / 2;
  const armCenterHalfSpacing = 1.968871 * officialScale;
  const rulerPivotSpacing = 2 * armCenterHalfSpacing;
  const startAngle = Math.asin(-2 / 4.5);
  const endAngle = startAngle - Math.PI / 6;
  const angleRange = endAngle - startAngle;
  const upperLeftPivotOffsetX = -6.5 * officialScale;
  const upperRightPivotOffsetX = upperLeftPivotOffsetX
    + rulerPivotSpacing;
  const lowerRightPivotOffsetX = 6.5 * officialScale;
  const lowerLeftPivotOffsetX = lowerRightPivotOffsetX
    - rulerPivotSpacing;
  const demonstrationPeriod = 5;
  const outwardEndPhase = 0.40;
  const outwardHoldEndPhase = 0.50;
  const returnEndPhase = 0.90;
  const transitionDuration = demonstrationPeriod * outwardEndPhase;
  const armLayerY = 0.37;
  const pinBaseY = -rulerDepth / 2 - 0.02;
  const pinHeight = 0.67;
  const pinWasherY = 0.52;
  const pivotRadius = 0.125;
  const paperTopY = -rulerDepth / 2 - 0.055;

  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterJointCentroid = new THREE.Vector2(258.25, 243.75);
  const sourceRasterUpperRuler = {
    bottomLeft: new THREE.Vector2(43, 211),
    bottomRight: new THREE.Vector2(518, 209),
    topLeft: new THREE.Vector2(42, 140),
    topRight: new THREE.Vector2(518, 140),
  };
  const sourceRasterLowerRuler = {
    bottomLeft: new THREE.Vector2(8, 354),
    bottomRight: new THREE.Vector2(489, 352),
    topLeft: new THREE.Vector2(8, 280),
    topRight: new THREE.Vector2(490, 281),
  };
  const sourceRasterUpperLeftPivot = new THREE.Vector2(68, 170);
  const sourceRasterUpperRightPivot = new THREE.Vector2(210, 169);
  const sourceRasterLowerLeftPivot = new THREE.Vector2(301, 317);
  const sourceRasterLowerRightPivot = new THREE.Vector2(454, 319);
  const sourceScaleX = rulerLength / 479;
  const sourceScaleZ = rulerWidth / 71;
  const sourcePointToReferenceFront = (point) => new THREE.Vector3(
    (point.x - sourceRasterJointCentroid.x) * sourceScaleX,
    rulerTopY,
    -(point.y - sourceRasterJointCentroid.y) * sourceScaleZ,
  );

  const upperRulerA = makeSimpleRuler({
    depth: rulerDepth,
    length: rulerLength,
    role: 'upper-simple-ruler-A',
    width: rulerWidth,
    pivotXs: [upperLeftPivotOffsetX, upperRightPivotOffsetX],
  });
  const lowerRulerB = makeSimpleRuler({
    depth: rulerDepth,
    length: rulerLength,
    role: 'lower-simple-ruler-B',
    width: rulerWidth,
    pivotXs: [lowerLeftPivotOffsetX, lowerRightPivotOffsetX],
  });
  const leftArmC = makeRulerArm(armLength);
  leftArmC.userData.nominalLength = armLength;
  leftArmC.userData.role = 'left-pivoted-swinging-arm-C';
  const rightArmC = makeRulerArm(armLength);
  rightArmC.userData.nominalLength = armLength;
  rightArmC.userData.role = 'right-pivoted-swinging-arm-C';

  const jointPins = {
    lowerLeft: makeVerticalPin({
      baseY: pinBaseY,
      height: pinHeight,
      radius: pivotRadius,
      role: 'lower-left-revolute-joint-B-to-C',
      washerY: pinWasherY,
    }),
    lowerRight: makeVerticalPin({
      baseY: pinBaseY,
      height: pinHeight,
      radius: pivotRadius,
      role: 'lower-right-revolute-joint-B-to-C',
      washerY: pinWasherY,
    }),
    upperLeft: makeVerticalPin({
      baseY: pinBaseY,
      height: pinHeight,
      radius: pivotRadius,
      role: 'upper-left-revolute-joint-A-to-C',
      washerY: pinWasherY,
    }),
    upperRight: makeVerticalPin({
      baseY: pinBaseY,
      height: pinHeight,
      radius: pivotRadius,
      role: 'upper-right-revolute-joint-A-to-C',
      washerY: pinWasherY,
    }),
  };

  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(10.0, 0.07, 6.7),
    matte(PALETTE.paper, { roughness: 0.98 }),
  );
  paper.position.y = paperTopY - 0.035;
  paper.userData.role = 'drawing-plane-beneath-two-arm-parallel-ruler';
  const paperOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(paper.geometry),
    new THREE.LineBasicMaterial({ color: 0xc5beb1 }),
  );
  paperOutline.position.copy(paper.position);
  paperOutline.userData.noShadow = true;
  paperOutline.userData.role = 'two-arm-ruler-drawing-sheet-outline';
  const guideLineMaterial = new THREE.LineBasicMaterial({
    color: 0xc1b9ac,
    transparent: true,
    opacity: 0.55,
  });
  const guideLines = [-2.35, -1.50, 1.50, 2.35].map((z, index) => {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-4.5, paperTopY + 0.006, z),
        new THREE.Vector3(4.5, paperTopY + 0.006, z),
      ]),
      guideLineMaterial,
    );
    line.userData.noShadow = true;
    line.userData.role = `parallel-reference-line-${index + 1}`;
    return line;
  });
  root.add(
    paper,
    paperOutline,
    ...guideLines,
    upperRulerA,
    lowerRulerB,
    leftArmC,
    rightArmC,
    ...Object.values(jointPins),
  );

  const motionAtPhase = (phase) => {
    if (phase <= outwardEndPhase) {
      const progress = phase / outwardEndPhase;
      return {
        angle: startAngle + angleRange * smootherstep(progress),
        angularAcceleration: angleRange
          * smootherstepSecond(progress) / transitionDuration ** 2,
        angularVelocity: angleRange
          * smootherstepFirst(progress) / transitionDuration,
        mode: 'swinging-C-arms-to-wider-parallel-offset',
      };
    }
    if (phase <= outwardHoldEndPhase) {
      return {
        angle: endAngle,
        angularAcceleration: 0,
        angularVelocity: 0,
        mode: 'holding-wider-parallel-offset',
      };
    }
    if (phase <= returnEndPhase) {
      const progress = (phase - outwardHoldEndPhase)
        / (returnEndPhase - outwardHoldEndPhase);
      return {
        angle: endAngle - angleRange * smootherstep(progress),
        angularAcceleration: -angleRange
          * smootherstepSecond(progress) / transitionDuration ** 2,
        angularVelocity: -angleRange
          * smootherstepFirst(progress) / transitionDuration,
        mode: 'swinging-C-arms-back-to-nearer-parallel-offset',
      };
    }
    return {
      angle: startAngle,
      angularAcceleration: 0,
      angularVelocity: 0,
      mode: 'holding-nearer-parallel-offset',
    };
  };

  const stateAtTime = (time) => {
    const phase = positiveModulo(time, demonstrationPeriod)
      / demonstrationPeriod;
    const motion = motionAtPhase(phase);
    const halfArmVector = new THREE.Vector3(
      armHalfLength * Math.cos(motion.angle),
      0,
      armHalfLength * Math.sin(motion.angle),
    );
    const leftCenter = new THREE.Vector3(-armCenterHalfSpacing, 0, 0);
    const rightCenter = new THREE.Vector3(armCenterHalfSpacing, 0, 0);
    const upperLeft = leftCenter.clone().sub(halfArmVector);
    const upperRight = rightCenter.clone().sub(halfArmVector);
    const lowerLeft = leftCenter.clone().add(halfArmVector);
    const lowerRight = rightCenter.clone().add(halfArmVector);
    const upperCenter = upperLeft.clone().add(
      new THREE.Vector3(-upperLeftPivotOffsetX, 0, 0),
    );
    const lowerCenter = lowerRight.clone().add(
      new THREE.Vector3(-lowerRightPivotOffsetX, 0, 0),
    );
    const upperSpan = upperRight.clone().sub(upperLeft);
    const lowerSpan = lowerRight.clone().sub(lowerLeft);
    const leftConnector = lowerLeft.clone().sub(upperLeft);
    const rightConnector = lowerRight.clone().sub(upperRight);
    const tangentHalfArmVector = new THREE.Vector3(
      -halfArmVector.z,
      0,
      halfArmVector.x,
    ).multiplyScalar(motion.angularVelocity);
    const tangentHalfArmAcceleration = new THREE.Vector3(
      -halfArmVector.z,
      0,
      halfArmVector.x,
    ).multiplyScalar(motion.angularAcceleration).addScaledVector(
      halfArmVector,
      -(motion.angularVelocity ** 2),
    );

    return {
      armAngle: motion.angle,
      armAngularAcceleration: motion.angularAcceleration,
      armAngularVelocity: motion.angularVelocity,
      arms: {
        leftC: {
          center: leftCenter,
          end: lowerLeft,
          length: leftConnector.length(),
          start: upperLeft,
        },
        rightC: {
          center: rightCenter,
          end: lowerRight,
          length: rightConnector.length(),
          start: upperRight,
        },
      },
      joints: {
        lowerLeft,
        lowerRight,
        upperLeft,
        upperRight,
      },
      mode: motion.mode,
      parallelogram: {
        connectorEqualityResidual: leftConnector.clone()
          .sub(rightConnector),
        lowerSpan,
        parallelCrossResidual: upperSpan.x * lowerSpan.z
          - upperSpan.z * lowerSpan.x,
        spanClosureResidual: upperSpan.clone().sub(lowerSpan),
        upperSpan,
      },
      phase,
      rulerB: {
        acceleration: tangentHalfArmAcceleration.clone(),
        endEdgeDirection: new THREE.Vector3(0, 0, rulerWidth),
        longEdgeDirection: new THREE.Vector3(rulerLength, 0, 0),
        rotation: 0,
        translation: lowerCenter,
        velocity: tangentHalfArmVector.clone(),
      },
      rulerA: {
        acceleration: tangentHalfArmAcceleration.clone().negate(),
        endEdgeDirection: new THREE.Vector3(0, 0, rulerWidth),
        longEdgeDirection: new THREE.Vector3(rulerLength, 0, 0),
        rotation: 0,
        translation: upperCenter,
        velocity: tangentHalfArmVector.clone().negate(),
      },
    };
  };

  const withLayer = (point) => new THREE.Vector3(
    point.x,
    armLayerY,
    point.z,
  );
  const update = (time) => {
    const state = stateAtTime(time);
    upperRulerA.position.copy(state.rulerA.translation);
    lowerRulerB.position.copy(state.rulerB.translation);
    upperRulerA.rotation.set(0, 0, 0);
    lowerRulerB.rotation.set(0, 0, 0);
    leftArmC.userData.setEndpoints(
      withLayer(state.arms.leftC.start),
      withLayer(state.arms.leftC.end),
    );
    rightArmC.userData.setEndpoints(
      withLayer(state.arms.rightC.start),
      withLayer(state.arms.rightC.end),
    );
    leftArmC.userData.renderedStart = withLayer(state.arms.leftC.start);
    leftArmC.userData.renderedEnd = withLayer(state.arms.leftC.end);
    rightArmC.userData.renderedStart = withLayer(state.arms.rightC.start);
    rightArmC.userData.renderedEnd = withLayer(state.arms.rightC.end);
    for (const [name, pin] of Object.entries(jointPins)) {
      pin.position.copy(state.joints[name]);
    }
    root.userData.contacts = {
      lowerLeftRevolute: state.joints.lowerLeft,
      lowerRightRevolute: state.joints.lowerRight,
      upperLeftRevolute: state.joints.upperLeft,
      upperRightRevolute: state.joints.upperRight,
    };
    root.userData.renderState = state;
  };
  update(0);

  root.userData.archetype =
    'equal-swinging-arm-parallelogram-parallel-ruler';
  root.userData.blocks = {
    guideLines,
    jointPins,
    leftArmC,
    lowerRulerB,
    paper,
    paperOutline,
    rightArmC,
    upperRulerA,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.0, paperTopY - 0.08, -3.0),
    new THREE.Vector3(5.0, 0.64, 3.0),
  );
  root.userData.constraints = {
    armEquality: 'length_C_left = length_C_right = 9 source units',
    fourBarClosure: 'upper pivot span = lower pivot span and left connector = right connector',
    parallelRulers: 'rotation_A = rotation_B = 0',
    revoluteJoints: 'each C-arm endpoint remains coincident with its ruler pin',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    angleRange,
    armCenterHalfSpacing,
    armHalfLength,
    armLayerY,
    armLength,
    demonstrationPeriod,
    endAngle,
    lowerLeftPivotOffsetX,
    lowerRightPivotOffsetX,
    officialScale,
    outwardEndPhase,
    outwardHoldEndPhase,
    paperTopY,
    pivotRadius,
    returnEndPhase,
    rulerDepth,
    rulerLength,
    rulerPivotSpacing,
    rulerTopY,
    rulerWidth,
    sourceImageHeight,
    sourceImageWidth,
    sourceScaleX,
    sourceScaleZ,
    startAngle,
    transitionDuration,
    upperLeftPivotOffsetX,
    upperRightPivotOffsetX,
  };
  root.userData.mechanism =
    'simple rulers A and B form opposite sides of an exact parallelogram with two equal, parallel, pivoted swinging arms C, C; four revolute joints preserve equal pivot spans so A and B translate while their ends and long edges retain zero relative angle';
  root.userData.sourceAnimation = {
    available: true,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialGeometry: {
      armCenterHalfSpacing: 1.968871,
      armEndpointRadius: 0.25,
      armHalfLength: 4.5,
      rulerMaximumX: 1,
      rulerMinimumX: -14,
      rulerWidth: 2,
    },
    officialKeyframes: [
      {
        leftArmCenter: new THREE.Vector2(-1.968871, 0),
        leftPin: new THREE.Vector2(-6, 2),
        phase: 0,
        rightArmCenter: new THREE.Vector2(1.968871, 0),
        rightPin: new THREE.Vector2(6, -2),
      },
      {
        leftArmCenter: new THREE.Vector2(-1.968871, 0),
        leftPin: new THREE.Vector2(-4.459931, 3.747615),
        phase: 0.4,
        rightArmCenter: new THREE.Vector2(1.968871, 0),
        rightPin: new THREE.Vector2(4.459931, -3.747615),
      },
      {
        leftArmCenter: new THREE.Vector2(-1.968871, 0),
        leftPin: new THREE.Vector2(-4.459931, 3.747615),
        phase: 0.5,
        rightArmCenter: new THREE.Vector2(1.968871, 0),
        rightPin: new THREE.Vector2(4.459931, -3.747615),
      },
      {
        leftArmCenter: new THREE.Vector2(-1.968871, 0),
        leftPin: new THREE.Vector2(-6, 2),
        phase: 0.9,
        rightArmCenter: new THREE.Vector2(1.968871, 0),
        rightPin: new THREE.Vector2(6, -2),
      },
      {
        leftArmCenter: new THREE.Vector2(-1.968871, 0),
        leftPin: new THREE.Vector2(-6, 2),
        phase: 1,
        rightArmCenter: new THREE.Vector2(1.968871, 0),
        rightPin: new THREE.Vector2(6, -2),
      },
    ],
    officialPageAnimatedTabDisabled: false,
    referenceScope: 'The source canvas confirms two 15-by-2 rulers, equal 9-unit arms C with quarter-unit endpoint pins, equal ruler pivot spans, a 30-degree arm swing, and move/hold/return/hold phases 0, 0.4, 0.5, 0.9, and 1. Thickness, material, and interpolation easing are not dimensioned.',
    sourceUrl: 'https://507movements.com/mm_325.html',
  };
  root.userData.sourcePointToReferenceFront = sourcePointToReferenceFront;
  root.userData.sourceReference = {
    brownPlate325: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'upper ruler A and lower ruler B joined only by two equal parallel swinging arms C, C and four revolute pins',
      measurementUncertaintyPixels: 26,
      rasterJointCentroid: sourceRasterJointCentroid.clone(),
      rasterLowerLeftPivot: sourceRasterLowerLeftPivot.clone(),
      rasterLowerRightPivot: sourceRasterLowerRightPivot.clone(),
      rasterLowerRuler: {
        bottomLeft: sourceRasterLowerRuler.bottomLeft.clone(),
        bottomRight: sourceRasterLowerRuler.bottomRight.clone(),
        topLeft: sourceRasterLowerRuler.topLeft.clone(),
        topRight: sourceRasterLowerRuler.topRight.clone(),
      },
      rasterUpperLeftPivot: sourceRasterUpperLeftPivot.clone(),
      rasterUpperRightPivot: sourceRasterUpperRightPivot.clone(),
      rasterUpperRuler: {
        bottomLeft: sourceRasterUpperRuler.bottomLeft.clone(),
        bottomRight: sourceRasterUpperRuler.bottomRight.clone(),
        topLeft: sourceRasterUpperRuler.topLeft.clone(),
        topRight: sourceRasterUpperRuler.topRight.clone(),
      },
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod,
    schedule: [
      { event: 'nearer parallel offset begins opening', phase: 0 },
      { event: '30-degree C-arm swing reaches wider offset', phase: outwardEndPhase },
      { event: 'wider-offset hold ends', phase: outwardHoldEndPhase },
      { event: 'nearer offset restored', phase: returnEndPhase },
      { event: 'nearer-offset hold closes cycle', phase: 1 },
    ],
  };
  root.userData.transmission = {
    input: 'swing of either equal arm C',
    output: 'parallel translation of ruler B relative to ruler A',
    relativeArmAngularRatio: 1,
  };

  markShadows(root);
  for (const object of [paperOutline, ...guideLines]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  finishDrawingRuler(root, [paper, paperOutline, ...guideLines]);
  return {
    cameraDirection: new THREE.Vector3(0, 12, .9),
    root,
    update,
  };
}

export function createAuthoredCompoundParallelRulerMovement(movement) {
  switch (movement.id) {
    case 324: return compoundCrossedArmParallelRuler(movement);
    case 325: return twoArmParallelogramRuler(movement);
    default: return null;
  }
}
