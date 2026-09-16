import { correctCompensationBalance } from './watch-balance-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongY(radius, length, material, segments = 32) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function tubeThrough(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(24, points.length * 3),
      radius, 10, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

function compensationBalance(movement) {
  const root = new THREE.Group();

  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterCenter = new THREE.Vector2(264, 265);
  const sourceRasterTopAttachmentT = new THREE.Vector2(265, 65);
  const sourceRasterBottomAttachmentTPrime = new THREE.Vector2(265, 465);
  const sourceRasterTopTimingScrew = new THREE.Vector2(265, 32);
  const sourceRasterBottomTimingScrew = new THREE.Vector2(265, 495);
  const sourceRasterRightWeightB = new THREE.Vector2(469, 275);
  const sourceRasterLeftWeightBPrime = new THREE.Vector2(57, 241);
  const sourceRasterHubLeft = new THREE.Vector2(229, 265);
  const sourceRasterHubRight = new THREE.Vector2(299, 265);

  const referenceAttachmentRadius = 3.45;
  const sourceScale = referenceAttachmentRadius / (
    (sourceRasterBottomAttachmentTPrime.y
      - sourceRasterTopAttachmentT.y) / 2
  );
  const referenceWeightRadius = 3.52;
  const freeEndAngleOffset = THREE.MathUtils.degToRad(-4.7);
  const hubRadius = (
    sourceRasterHubRight.x - sourceRasterHubLeft.x
  ) * sourceScale / 2;
  const timingScrewOffset = 0.50;
  const weightWidth = 1.34;
  const weightHeight = 1.42;
  const weightDepth = 0.66;
  const weightIntrinsicRadiusOfGyrationSquared = (
    weightWidth ** 2 + weightHeight ** 2
  ) / 12;
  const timingNutRadius = 0.24;
  const timingNutIntrinsicRadiusOfGyrationSquared = (
    timingNutRadius ** 2 / 2 + 0.26 ** 2 / 12
  );

  const hubMass = 1.00;
  const mainBarMass = 1.50;
  const eachCompoundArmMass = 0.80;
  const eachCompensationWeightMass = 2.20;
  const eachTimingScrewMass = 0.22;
  const hubInertia = hubMass * hubRadius ** 2 / 2;
  const radialWeightCoefficient = eachCompoundArmMass
    + 2 * eachCompensationWeightMass;
  const maximumAttachmentExpansion = 0.055;
  const springSofteningFraction = 0.08;
  const nominalTemperature = 20;
  const temperatureAmplitude = 30;
  const thermalCyclePeriod = 8;
  const thermalAngularFrequency = FULL_TURN / thermalCyclePeriod;
  const balancePeriod = 1;
  const balanceAngularFrequency = FULL_TURN / balancePeriod;
  const balanceAmplitude = THREE.MathUtils.degToRad(25);

  const constantInertiaAtAttachmentRadius = (attachmentRadius) => (
    hubInertia
      + mainBarMass * attachmentRadius ** 2 / 3
      + 2 * eachTimingScrewMass * (
        (attachmentRadius + timingScrewOffset) ** 2
          + timingNutIntrinsicRadiusOfGyrationSquared
      )
      + eachCompoundArmMass * attachmentRadius ** 2
      + 2 * eachCompensationWeightMass
        * weightIntrinsicRadiusOfGyrationSquared
  );
  const referenceInertia = constantInertiaAtAttachmentRadius(
    referenceAttachmentRadius,
  ) + radialWeightCoefficient * referenceWeightRadius ** 2;
  const referenceSpringStiffness = referenceInertia
    * balanceAngularFrequency ** 2;

  const compensationAtTemperatureCoordinate = (temperatureCoordinate) => {
    const attachmentRadius = referenceAttachmentRadius
      + maximumAttachmentExpansion * temperatureCoordinate;
    const springStiffnessRatio = 1
      - springSofteningFraction * temperatureCoordinate;
    const targetInertia = referenceInertia * springStiffnessRatio;
    const constantInertia = constantInertiaAtAttachmentRadius(
      attachmentRadius,
    );
    const weightRadiusSquared = (
      targetInertia - constantInertia
    ) / radialWeightCoefficient;
    const weightRadius = Math.sqrt(weightRadiusSquared);

    const constantFirstDerivative = 2 * attachmentRadius * (
      mainBarMass / 3 + eachCompoundArmMass
    ) + 4 * eachTimingScrewMass * (
      attachmentRadius + timingScrewOffset
    );
    const constantSecondDerivative = 2 * (
      mainBarMass / 3 + eachCompoundArmMass
    ) + 4 * eachTimingScrewMass;
    const weightRadiusSquaredDerivative = (
      -referenceInertia * springSofteningFraction
        - constantFirstDerivative * maximumAttachmentExpansion
    ) / radialWeightCoefficient;
    const weightRadiusSquaredSecondDerivative = -(
      constantSecondDerivative * maximumAttachmentExpansion ** 2
    ) / radialWeightCoefficient;
    const weightRadiusDerivative = weightRadiusSquaredDerivative
      / (2 * weightRadius);
    const weightRadiusSecondDerivative =
      weightRadiusSquaredSecondDerivative / (2 * weightRadius)
        - weightRadiusSquaredDerivative ** 2
          / (4 * weightRadius ** 3);

    return {
      attachmentRadius,
      constantFirstDerivative,
      constantInertia,
      constantSecondDerivative,
      springStiffnessRatio,
      targetInertia,
      weightRadius,
      weightRadiusDerivative,
      weightRadiusSecondDerivative,
      weightRadiusSquared,
      weightRadiusSquaredDerivative,
      weightRadiusSquaredSecondDerivative,
    };
  };

  const massProperties = ({ attachmentRadius, weightRadius }) => {
    const mainBarInertia = mainBarMass * attachmentRadius ** 2 / 3;
    const timingScrewRadius = attachmentRadius + timingScrewOffset;
    const timingScrewsInertia = 2 * eachTimingScrewMass * (
      timingScrewRadius ** 2
        + timingNutIntrinsicRadiusOfGyrationSquared
    );
    // Equal material increments along each reference quarter-circle retain
    // their parameter labels while bending.  The mean squared radius of the
    // resulting quarter ellipse is exactly (R_attach^2 + R_weight^2)/2.
    const compoundArmsInertia = eachCompoundArmMass * (
      attachmentRadius ** 2 + weightRadius ** 2
    );
    const compensationWeightsInertia = 2
      * eachCompensationWeightMass * (
        weightRadius ** 2
          + weightIntrinsicRadiusOfGyrationSquared
      );
    const inertia = hubInertia + mainBarInertia
      + timingScrewsInertia + compoundArmsInertia
      + compensationWeightsInertia;
    return {
      attachmentRadius,
      compensationWeightsInertia,
      compoundArmsInertia,
      hubInertia,
      inertia,
      mainBarInertia,
      naturalAngularFrequency: null,
      timingScrewRadius,
      timingScrewsInertia,
      weightRadius,
    };
  };

  const transformLocalKinematics = ({
    balanceAngle,
    balanceAngularAcceleration,
    balanceAngularVelocity,
    localAcceleration,
    localPosition,
    localVelocity,
  }) => {
    const rotation = new THREE.Quaternion().setFromAxisAngle(
      Z_AXIS,
      balanceAngle,
    );
    const angularVelocity = new THREE.Vector3(
      0,
      0,
      balanceAngularVelocity,
    );
    const angularAcceleration = new THREE.Vector3(
      0,
      0,
      balanceAngularAcceleration,
    );
    const velocity = localVelocity.clone()
      .add(angularVelocity.clone().cross(localPosition))
      .applyQuaternion(rotation);
    const acceleration = localAcceleration.clone()
      .add(angularAcceleration.clone().cross(localPosition))
      .add(angularVelocity.clone().cross(localVelocity)
        .multiplyScalar(2))
      .add(angularVelocity.clone().cross(
        angularVelocity.clone().cross(localPosition),
      ))
      .applyQuaternion(rotation);
    const position = localPosition.clone().applyQuaternion(rotation);
    return { acceleration, position, velocity };
  };

  const stateAtTime = (time) => {
    const unwrappedThermalAngle = thermalAngularFrequency * time;
    const thermalAngle = positiveModulo(unwrappedThermalAngle, FULL_TURN);
    const temperatureCoordinate = Math.sin(thermalAngle);
    const temperatureCoordinateVelocity = thermalAngularFrequency
      * Math.cos(thermalAngle);
    const temperatureCoordinateAcceleration = -(thermalAngularFrequency ** 2)
      * Math.sin(thermalAngle);
    const compensation = compensationAtTemperatureCoordinate(
      temperatureCoordinate,
    );
    const attachmentRadiusVelocity = maximumAttachmentExpansion
      * temperatureCoordinateVelocity;
    const attachmentRadiusAcceleration = maximumAttachmentExpansion
      * temperatureCoordinateAcceleration;
    const weightRadiusVelocity = compensation.weightRadiusDerivative
      * temperatureCoordinateVelocity;
    const weightRadiusAcceleration =
      compensation.weightRadiusSecondDerivative
        * temperatureCoordinateVelocity ** 2
      + compensation.weightRadiusDerivative
        * temperatureCoordinateAcceleration;
    const properties = massProperties(compensation);
    const springStiffness = referenceSpringStiffness
      * compensation.springStiffnessRatio;
    properties.naturalAngularFrequency = Math.sqrt(
      springStiffness / properties.inertia,
    );

    const unwrappedBalancePhase = balanceAngularFrequency * time;
    const balancePhase = positiveModulo(unwrappedBalancePhase, FULL_TURN);
    const balanceAngle = balanceAmplitude * Math.sin(balancePhase);
    const balanceAngularVelocity = balanceAmplitude
      * balanceAngularFrequency * Math.cos(balancePhase);
    const balanceAngularAcceleration = -balanceAmplitude
      * balanceAngularFrequency ** 2 * Math.sin(balancePhase);
    const commonKinematics = {
      balanceAngle,
      balanceAngularAcceleration,
      balanceAngularVelocity,
    };

    const armPoint = (side, parameter) => {
      const arcAngle = Math.PI * parameter / 2;
      const sine = Math.sin(arcAngle);
      const cosine = Math.cos(arcAngle);
      const materialAngleOffset = freeEndAngleOffset * parameter;
      const rotateMaterialPoint = (x, y) => new THREE.Vector3(
        x * Math.cos(materialAngleOffset)
          - y * Math.sin(materialAngleOffset),
        x * Math.sin(materialAngleOffset)
          + y * Math.cos(materialAngleOffset),
        0,
      );
      return transformLocalKinematics({
        ...commonKinematics,
        localAcceleration: rotateMaterialPoint(
          side * weightRadiusAcceleration * sine,
          side * attachmentRadiusAcceleration * cosine,
        ),
        localPosition: rotateMaterialPoint(
          side * compensation.weightRadius * sine,
          side * compensation.attachmentRadius * cosine,
        ),
        localVelocity: rotateMaterialPoint(
          side * weightRadiusVelocity * sine,
          side * attachmentRadiusVelocity * cosine,
        ),
      });
    };
    const timingScrewPoint = (side) => {
      const radius = compensation.attachmentRadius + timingScrewOffset;
      return transformLocalKinematics({
        ...commonKinematics,
        localAcceleration: new THREE.Vector3(
          0,
          side * attachmentRadiusAcceleration,
          0,
        ),
        localPosition: new THREE.Vector3(0, side * radius, 0),
        localVelocity: new THREE.Vector3(
          0,
          side * attachmentRadiusVelocity,
          0,
        ),
      });
    };
    const rightWeight = armPoint(1, 1);
    const leftWeight = armPoint(-1, 1);
    const topAttachment = armPoint(1, 0);
    const bottomAttachment = armPoint(-1, 0);
    const topTimingScrew = timingScrewPoint(1);
    const bottomTimingScrew = timingScrewPoint(-1);
    const balanceSpringPoint = (parameter) => {
      const boundedParameter = THREE.MathUtils.clamp(parameter, 0, 1);
      const radius = THREE.MathUtils.lerp(
        springInnerRadius,
        springOuterRadius,
        boundedParameter,
      );
      const baselineAngle = springTurns * FULL_TURN * boundedParameter;
      const elasticTwist = balanceAngle * (1 - boundedParameter);
      const angle = baselineAngle + elasticTwist;
      return {
        angle,
        baselineAngle,
        elasticTwist,
        parameter: boundedParameter,
        position: new THREE.Vector3(
          radius * Math.cos(angle),
          radius * Math.sin(angle),
          springPlaneZ,
        ),
        radius,
      };
    };

    return {
      armPoint,
      attachmentRadius: compensation.attachmentRadius,
      attachmentRadiusAcceleration,
      attachmentRadiusVelocity,
      balanceAngle,
      balanceAngularAcceleration,
      balanceAngularVelocity,
      balancePhase,
      balanceSpringPoint,
      bottomAttachment,
      bottomTimingScrew,
      compensation,
      cycleIndex: Math.floor(unwrappedThermalAngle / FULL_TURN),
      cyclePhase: thermalAngle / FULL_TURN,
      inertia: properties.inertia,
      inertiaError: properties.inertia - compensation.targetInertia,
      leftWeight,
      massProperties: properties,
      naturalAngularFrequency: properties.naturalAngularFrequency,
      rightWeight,
      springStiffness,
      springStiffnessRatio: compensation.springStiffnessRatio,
      temperature: nominalTemperature
        + temperatureAmplitude * temperatureCoordinate,
      temperatureCoordinate,
      temperatureCoordinateAcceleration,
      temperatureCoordinateVelocity,
      temperatureState: temperatureCoordinate > 0.02
        ? 'hot-weights-drawn-inward'
        : temperatureCoordinate < -0.02
          ? 'cold-weights-moved-outward'
          : 'neutral',
      thermalAngle,
      topAttachment,
      topTimingScrew,
      unwrappedBalancePhase,
      unwrappedThermalAngle,
      weightRadius: compensation.weightRadius,
      weightRadiusAcceleration,
      weightRadiusVelocity,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.62,
  });
  const steelMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.42,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.30,
    roughness: 0.46,
  });
  const balanceMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.55,
  });
  const weightMaterial = matte(PALETTE.driven, {
    metalness: 0.22,
    roughness: 0.50,
  });
  const springMaterial = matte(0x2d7088, {
    metalness: 0.26,
    roughness: 0.46,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.44,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-compensation-balance-frame';
  const backPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(4.38, 4.38, 0.15, 96),
    matte(PALETTE.paper, {
      metalness: 0.03,
      roughness: 0.84,
    }),
  );
  backPlate.rotation.x = Math.PI / 2;
  backPlate.position.z = -0.62;
  backPlate.userData.role = 'fixed-watch-movement-backplate';
  const fixedBearing = cylinderAlongZ(0.38, 0.74, frameMaterial, 40);
  fixedBearing.position.z = -0.18;
  fixedBearing.userData.role = 'fixed-balance-staff-bearing';
  fixedFrame.add(backPlate, fixedBearing);

  const balanceAssembly = new THREE.Group();
  balanceAssembly.userData.axis = Z_AXIS.clone();
  balanceAssembly.userData.role = 'temperature-compensated-oscillating-balance';
  const hub = cylinderAlongZ(hubRadius, 0.52, balanceMaterial, 48);
  hub.position.z = 0.08;
  hub.userData.role = 'balance-center-a';
  const staff = cylinderAlongZ(0.14, 1.36, steelMaterial, 28);
  staff.position.z = 0.36;
  staff.userData.role = 'balance-staff';
  const mainBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 1, 0.34),
    balanceMaterial,
  );
  mainBar.userData.role = 'thermally-expanding-main-balance-bar-t-a-t-prime';

  const compoundArmSegmentCount = 42;
  const compoundArmSegments = [1, -1].map((side) => (
    Array.from({ length: compoundArmSegmentCount }, () => {
      const steel = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.105, 0.42),
        steelMaterial,
      );
      steel.userData.layer = 'radially-inner-steel';
      steel.userData.role = 'inner-steel-layer-of-compound-balance-arm';
      const brass = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.105, 0.42),
        brassMaterial,
      );
      brass.userData.layer = 'radially-outer-brass';
      brass.userData.role = 'outer-brass-layer-of-compound-balance-arm';
      balanceAssembly.add(steel, brass);
      return { brass, side, steel };
    })
  ));

  const makeCompensationWeight = (side) => {
    const group = new THREE.Group();
    group.userData.role = side > 0
      ? 'right-compensation-weight-b'
      : 'left-compensation-weight-b-prime';
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(weightWidth, weightHeight, weightDepth),
      weightMaterial,
    );
    block.userData.role = 'bimetal-arm-carried-compensation-weight';
    const clampSlot = new THREE.Mesh(
      new THREE.BoxGeometry(0.17, weightHeight + 0.08, 0.09),
      steelMaterial,
    );
    clampSlot.position.z = weightDepth / 2 + 0.05;
    clampSlot.userData.role = 'compensation-weight-arm-clamp-slot';
    const clampScrew = cylinderAlongZ(0.10, weightDepth + 0.18,
      brassMaterial, 24);
    clampScrew.position.set(0, 0.32, 0);
    clampScrew.userData.role = 'compensation-weight-clamp-screw';
    const witness = new THREE.Mesh(
      new THREE.SphereGeometry(0.10, 22, 14),
      whiteMaterial,
    );
    witness.position.set(0, 0, weightDepth / 2 + 0.09);
    witness.userData.role = 'white-compensation-weight-motion-index';
    group.add(block, clampSlot, clampScrew, witness);
    return { block, clampScrew, group, witness };
  };
  const rightWeight = makeCompensationWeight(1);
  const leftWeight = makeCompensationWeight(-1);

  const makeTimingScrew = (side) => {
    const group = new THREE.Group();
    group.userData.role = side > 0
      ? 'top-timing-screw-at-t'
      : 'bottom-timing-screw-at-t-prime';
    const stem = cylinderAlongY(0.095, 0.78, steelMaterial, 24);
    stem.position.y = side * 0.02;
    stem.userData.role = 'timing-screw-threaded-stem';
    const nut = cylinderAlongY(timingNutRadius, 0.26,
      balanceMaterial, 32);
    nut.position.y = side * 0.18;
    nut.userData.role = 'timing-regulation-screw-nut';
    const crossSlot = new THREE.Mesh(
      new THREE.BoxGeometry(0.30, 0.035, 0.055),
      whiteMaterial,
    );
    crossSlot.position.set(0, side * 0.32, 0.15);
    crossSlot.userData.role = 'white-timing-screw-index-slot';
    group.add(stem, nut, crossSlot);
    return { crossSlot, group, nut, stem };
  };
  const topTimingScrew = makeTimingScrew(1);
  const bottomTimingScrew = makeTimingScrew(-1);

  balanceAssembly.add(
    hub,
    staff,
    mainBar,
    rightWeight.group,
    leftWeight.group,
    topTimingScrew.group,
    bottomTimingScrew.group,
  );

  const springPlaneZ = -0.34;
  const springInnerRadius = 0.28;
  const springOuterRadius = 1.22;
  const springTurns = 2.5;
  const springSampleCount = 112;
  const springSamples = Array.from(
    { length: springSampleCount + 1 },
    (_, index) => {
      const parameter = index / springSampleCount;
      const angle = springTurns * FULL_TURN * parameter;
      const radius = THREE.MathUtils.lerp(
        springInnerRadius,
        springOuterRadius,
        parameter,
      );
      return { angle, parameter, radius };
    },
  );
  const springSegments = Array.from(
    { length: springSampleCount },
    () => {
      const segment = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 1, 9),
        springMaterial,
      );
      segment.userData.role = 'temperature-softening-balance-spring-segment';
      root.add(segment);
      return segment;
    },
  );
  const springOuterAngle = springTurns * FULL_TURN;
  const springFixedStud = cylinderAlongZ(0.12, 0.58,
    brassMaterial, 24);
  springFixedStud.position.set(
    springOuterRadius * Math.cos(springOuterAngle),
    springOuterRadius * Math.sin(springOuterAngle),
    springPlaneZ,
  );
  springFixedStud.userData.role = 'fixed-outer-balance-spring-stud';
  const springStudBracket = makeBeam(
    springFixedStud.position.clone(),
    new THREE.Vector3(
      -(springOuterRadius + 0.48),
      0,
      springPlaneZ,
    ),
    {
      color: PALETTE.frame,
      depth: 0.18,
      thickness: 0.14,
    },
  );
  springStudBracket.userData.role = 'fixed-balance-spring-stud-bracket';

  root.add(
    fixedFrame,
    balanceAssembly,
    springFixedStud,
    springStudBracket,
  );

  const setLinearSegment = (mesh, start, end, offset) => {
    const delta = end.clone().sub(start);
    const length = delta.length();
    const tangentAngle = Math.atan2(delta.y, delta.x);
    const midpoint = start.clone().add(end).multiplyScalar(0.5);
    const radial = midpoint.clone().setZ(0).normalize();
    mesh.position.copy(midpoint).addScaledVector(radial, offset);
    mesh.rotation.z = tangentAngle;
    mesh.scale.x = length;
  };

  const setSpringSegment = (segment, start, end) => {
    const delta = end.clone().sub(start);
    const length = delta.length();
    segment.position.copy(start).add(end).multiplyScalar(0.5);
    segment.quaternion.setFromUnitVectors(
      Y_AXIS,
      delta.clone().normalize(),
    );
    segment.scale.y = length;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    balanceAssembly.rotation.z = state.balanceAngle;
    mainBar.scale.y = 2 * state.attachmentRadius;
    for (const [armIndex, side] of [1, -1].entries()) {
      const segments = compoundArmSegments[armIndex];
      for (let index = 0; index < compoundArmSegmentCount;
        index += 1) {
        const startParameter = index / compoundArmSegmentCount;
        const endParameter = (index + 1) / compoundArmSegmentCount;
        const startAngle = Math.PI * startParameter / 2;
        const endAngle = Math.PI * endParameter / 2;
        const unrotatedStart = new THREE.Vector3(
          side * state.weightRadius * Math.sin(startAngle),
          side * state.attachmentRadius * Math.cos(startAngle),
          0,
        );
        const unrotatedEnd = new THREE.Vector3(
          side * state.weightRadius * Math.sin(endAngle),
          side * state.attachmentRadius * Math.cos(endAngle),
          0,
        );
        const start = unrotatedStart.applyAxisAngle(
          Z_AXIS,
          freeEndAngleOffset * startParameter,
        );
        const end = unrotatedEnd.applyAxisAngle(
          Z_AXIS,
          freeEndAngleOffset * endParameter,
        );
        setLinearSegment(segments[index].brass, start, end, 0.055);
        setLinearSegment(segments[index].steel, start, end, -0.055);
      }
    }
    rightWeight.group.position.set(
      state.weightRadius * Math.cos(freeEndAngleOffset),
      state.weightRadius * Math.sin(freeEndAngleOffset),
      0,
    );
    leftWeight.group.position.copy(rightWeight.group.position)
      .multiplyScalar(-1);
    rightWeight.group.rotation.z = freeEndAngleOffset;
    leftWeight.group.rotation.z = freeEndAngleOffset;
    topTimingScrew.group.position.set(
      0,
      state.massProperties.timingScrewRadius,
      0,
    );
    bottomTimingScrew.group.position.set(
      0,
      -state.massProperties.timingScrewRadius,
      0,
    );
    for (let index = 0; index < springSegments.length; index += 1) {
      const startSample = springSamples[index];
      const endSample = springSamples[index + 1];
      setSpringSegment(
        springSegments[index],
        state.balanceSpringPoint(startSample.parameter).position,
        state.balanceSpringPoint(endSample.parameter).position,
      );
    }
    root.userData.compensationState = {
      attachmentRadius: state.attachmentRadius,
      balanceInertia: state.inertia,
      inertiaError: state.inertiaError,
      naturalAngularFrequency: state.naturalAngularFrequency,
      springStiffnessRatio: state.springStiffnessRatio,
      temperature: state.temperature,
      weightRadius: state.weightRadius,
    };
    root.userData.renderState = state;
  };

  const sourcePointToNeutralFront = (point) => new THREE.Vector3(
    (point.x - sourceRasterCenter.x) * sourceScale,
    -(point.y - sourceRasterCenter.y) * sourceScale,
    0,
  );

  root.userData.archetype =
    'cut-bimetallic-rim-constant-rate-compensation-balance';
  root.userData.blocks = {
    backPlate,
    balanceAssembly,
    bottomTimingScrew,
    compoundArmSegments,
    fixedBearing,
    fixedFrame,
    hub,
    leftWeight,
    mainBar,
    rightWeight,
    springFixedStud,
    springSamples,
    springSegments,
    springStudBracket,
    staff,
    topTimingScrew,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.00, -5.00, -1.45),
    new THREE.Vector3(5.00, 5.00, 1.50),
  );
  root.userData.canonicalTimes = {
    cold: thermalCyclePeriod * 0.75,
    cycleClosure: thermalCyclePeriod,
    hot: thermalCyclePeriod * 0.25,
    neutralCooling: thermalCyclePeriod * 0.50,
    neutralHeating: 0,
  };
  root.userData.compensationAtTemperatureCoordinate =
    compensationAtTemperatureCoordinate;
  root.userData.geometry = {
    balanceAmplitude,
    balanceAngularFrequency,
    balancePeriod,
    compoundArmSegmentCount,
    freeEndAngleOffset,
    hubRadius,
    maximumAttachmentExpansion,
    nominalTemperature,
    referenceAttachmentRadius,
    referenceInertia,
    referenceWeightRadius,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    springInnerRadius,
    springOuterRadius,
    springPlaneZ,
    springSofteningFraction,
    springTurns,
    temperatureAmplitude,
    thermalAngularFrequency,
    thermalCyclePeriod,
    timingNutRadius,
    timingScrewOffset,
    weightDepth,
    weightHeight,
    weightWidth,
  };
  root.userData.groundFloorY = -5.00;
  root.userData.massModel = {
    balance: {
      eachCompensationWeightMass,
      eachCompoundArmMass,
      eachTimingScrewMass,
      hubMass,
      mainBarMass,
      radialWeightCoefficient,
      referenceInertia,
      weightIntrinsicRadiusOfGyrationSquared,
    },
    spring: {
      referenceStiffness: referenceSpringStiffness,
      softeningFractionAcrossHotExcursion: springSofteningFraction,
      stiffnessLaw: 'kappa = kappa_reference * (1 - thermalSoftening * temperatureCoordinate)',
    },
  };
  root.userData.massProperties = massProperties;
  root.userData.mechanism =
    'heat expands main balance bar t–a–t′ and its timing screws outward while softening the balance spring; greater expansion of each radially outer brass layer bends its steel-backed quarter-rim inward and draws b and b′ to the exact radius that reduces total inertia in the same ratio as spring stiffness, keeping sqrt(kappa/I) constant';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'Brown supplies central staff a, main bar t–a–t′, two end timing screws, two cut quarter-rim compound bars with brass outside and steel inside, and weights b and b′. Material coefficients, masses, spring stiffness, depth, temperature range, and cadence are not dimensioned.',
    sourceUrl: 'https://507movements.com/mm_319.html',
  };
  root.userData.sourcePointToNeutralFront = sourcePointToNeutralFront;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    brownPlate319: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one central staff a, one diametral main bar t–a–t′ with two timing screws, two opposing cut quarter-rim bimetal arms having brass outside and steel inside, and two free-end weights b and b′',
      measurementUncertaintyPixels: 12,
      rasterBottomAttachmentTPrime:
        sourceRasterBottomAttachmentTPrime.clone(),
      rasterBottomTimingScrew: sourceRasterBottomTimingScrew.clone(),
      rasterCenter: sourceRasterCenter.clone(),
      rasterHubLeft: sourceRasterHubLeft.clone(),
      rasterHubRight: sourceRasterHubRight.clone(),
      rasterLeftWeightBPrime: sourceRasterLeftWeightBPrime.clone(),
      rasterRightWeightB: sourceRasterRightWeightB.clone(),
      rasterTopAttachmentT: sourceRasterTopAttachmentT.clone(),
      rasterTopTimingScrew: sourceRasterTopTimingScrew.clone(),
    },
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
    demonstrationPeriod: thermalCyclePeriod,
    schedule: [
      'neutral-source-proportions-and-balanced-rate',
      'heating-expands-main-bar-and-softens-balance-spring',
      'outer-brass-layers-bend-bimetal-arms-inward',
      'weights-b-and-b-prime-reduce-total-inertia',
      'cooling-moves-both-weights-outward-again',
      'eight-balance-vibrations-close-with-one-thermal-cycle',
    ],
  };
  root.userData.transmission = {
    bimetalLayerOrder: 'brass radially outside, steel radially inside',
    compensationTarget: 'constant natural frequency sqrt(kappa / I)',
    coldResponse: 'b and b′ move outward as the arms relax',
    hotResponse: 'b and b′ move inward as outer brass expands more',
    output: 'temperature-compensated balance oscillation',
    springResponse: 'balance-spring stiffness decreases with heat',
    timingScrewCount: 2,
  };

  correctCompensationBalance(root);
  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  for (const object of springSegments) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';

  return {
    cameraDirection: new THREE.Vector3(.6, .7, 14),
    root,
    update,
  };
}

export function createAuthoredCompensationBalanceMovement(movement) {
  if (movement.id !== 319) return null;
  return compensationBalance(movement);
}
