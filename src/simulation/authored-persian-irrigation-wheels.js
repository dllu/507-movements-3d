import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function beamBetween(start, end, width, depth, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(delta.y, delta.x);
  return beam;
}

function smoothStep5(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped ** 3 * (clamped * (clamped * 6 - 15) + 10);
}

function smoothStep5First(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  if (clamped === 0 || clamped === 1) return 0;
  return 30 * clamped ** 2 * (clamped - 1) ** 2;
}

function makeFloatCenterline(innerRadius, outerRadius, sweepAngle) {
  const points = [];
  for (let index = 0; index <= 32; index += 1) {
    const progress = index / 32;
    const radius = THREE.MathUtils.lerp(
      innerRadius,
      outerRadius,
      progress,
    );
    const angle = -sweepAngle * (1 - progress);
    points.push(new THREE.Vector3(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
      0,
    ));
  }
  return new THREE.CatmullRomCurve3(points, false, 'centripetal');
}

function makeCurvedFloatGeometry(curve, depth) {
  const left = [];
  const right = [];
  const sampleCount = 42;
  for (let index = 0; index <= sampleCount; index += 1) {
    const progress = index / sampleCount;
    const point = curve.getPoint(progress);
    const tangent = curve.getTangent(progress).normalize();
    const normal = new THREE.Vector2(-tangent.y, tangent.x);
    const halfWidth = THREE.MathUtils.lerp(0.13, 0.27, progress);
    left.push(new THREE.Vector2(
      point.x + normal.x * halfWidth,
      point.y + normal.y * halfWidth,
    ));
    right.push(new THREE.Vector2(
      point.x - normal.x * halfWidth,
      point.y - normal.y * halfWidth,
    ));
  }
  const shape = new THREE.Shape();
  shape.moveTo(left[0].x, left[0].y);
  left.slice(1).forEach((point) => shape.lineTo(point.x, point.y));
  [...right].reverse().forEach((point) => shape.lineTo(point.x, point.y));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 32,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function makeHollowShaftGeometry(outerRadius, innerRadius, length) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 48,
    depth: length,
    steps: 1,
  });
  geometry.translate(0, 0, -length / 2);
  return geometry;
}

function rotateVector2(vector, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    vector.x * cosine - vector.y * sine,
    vector.x * sine + vector.y * cosine,
  );
}

function persianIrrigationWheel(movement) {
  const root = new THREE.Group();
  const cycleDuration = 12;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const sourceWheelAngle = Math.PI / 2;
  const wheelCenter = new THREE.Vector3(0, 0.34, 0);
  const floatCount = 6;
  const floatInnerRadius = 0.58;
  const floatOuterRadius = 2.48;
  const bucketPivotRadius = 2.58;
  const floatSweepAngle = THREE.MathUtils.degToRad(82);
  const floatDepth = 0.34;
  const hollowShaftOuterRadius = 0.54;
  const hollowShaftInnerRadius = 0.31;
  const hollowShaftLength = 0.92;
  const streamSurfaceY = -1.36;
  const streamVelocityX = 1.25;
  const representativeStreamForce = 5.8;
  const streamDriveTorque = floatOuterRadius
    * representativeStreamForce;
  const pickupStartAngle = THREE.MathUtils.degToRad(220);
  const pickupEndAngle = THREE.MathUtils.degToRad(290);
  const dumpStartAngle = THREE.MathUtils.degToRad(40);
  const dumpPeakAngle = THREE.MathUtils.degToRad(60);
  const dumpEndAngle = THREE.MathUtils.degToRad(80);
  const maximumBucketTip = THREE.MathUtils.degToRad(-76);
  const bucketCapacity = 0.0032;
  const highDeliveryY = 1.60;
  const groundY = -2.28;
  const pickupEndTravel = THREE.MathUtils.euclideanModulo(
    pickupEndAngle - pickupStartAngle,
    FULL_TURN,
  ) / FULL_TURN;
  const dumpStartTravel = THREE.MathUtils.euclideanModulo(
    dumpStartAngle - pickupStartAngle,
    FULL_TURN,
  ) / FULL_TURN;
  const dumpPeakTravel = THREE.MathUtils.euclideanModulo(
    dumpPeakAngle - pickupStartAngle,
    FULL_TURN,
  ) / FULL_TURN;
  const dumpEndTravel = THREE.MathUtils.euclideanModulo(
    dumpEndAngle - pickupStartAngle,
    FULL_TURN,
  ) / FULL_TURN;
  const derivativeMaximum = 1.875;
  const bucketTripLugLocal = new THREE.Vector2(0.23, -0.02);

  const bucketStateAtWorldAngle = (worldAngleValue) => {
    const worldAngle = THREE.MathUtils.euclideanModulo(
      worldAngleValue,
      FULL_TURN,
    );
    const travel = THREE.MathUtils.euclideanModulo(
      worldAngle - pickupStartAngle,
      FULL_TURN,
    ) / FULL_TURN;
    let fill = 0;
    if (travel < pickupEndTravel) {
      fill = smoothStep5(travel / pickupEndTravel);
    } else if (travel < dumpStartTravel) {
      fill = 1;
    } else if (travel < dumpEndTravel) {
      fill = 1 - smoothStep5(
        (travel - dumpStartTravel)
          / (dumpEndTravel - dumpStartTravel),
      );
    }
    let tipFraction = 0;
    if (travel >= dumpStartTravel && travel < dumpPeakTravel) {
      tipFraction = smoothStep5(
        (travel - dumpStartTravel)
          / (dumpPeakTravel - dumpStartTravel),
      );
    } else if (travel >= dumpPeakTravel && travel < dumpEndTravel) {
      tipFraction = 1 - smoothStep5(
        (travel - dumpPeakTravel)
          / (dumpEndTravel - dumpPeakTravel),
      );
    }
    let dischargeFlow = 0;
    if (travel >= dumpStartTravel && travel < dumpEndTravel) {
      const progress = (travel - dumpStartTravel)
        / (dumpEndTravel - dumpStartTravel);
      dischargeFlow = smoothStep5First(progress) / derivativeMaximum;
    }
    let channelMarkerParameter = 1;
    if (travel > pickupEndTravel && travel < dumpEndTravel) {
      channelMarkerParameter = 1 - smoothStep5(
        (travel - pickupEndTravel)
          / (dumpEndTravel - pickupEndTravel),
      );
    } else if (travel >= dumpEndTravel) {
      channelMarkerParameter = 0;
    }
    return {
      bucketFill: fill,
      bucketTipAngle: maximumBucketTip * tipFraction,
      channelMarkerParameter,
      channelMarkerVisible:
        fill > 0.015 && travel < dumpEndTravel,
      dischargeFlow,
      floatWaterFill: fill,
      tipFraction,
      travel,
      worldAngle,
    };
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const inputRotation = THREE.MathUtils.euclideanModulo(
      inputAngle,
      FULL_TURN,
    );
    const wheelAngle = sourceWheelAngle + inputRotation;
    const bucketStates = [];
    for (let index = 0; index < floatCount; index += 1) {
      const armAngle = index * FULL_TURN / floatCount;
      const worldAngle = wheelAngle + armAngle;
      const bucketState = bucketStateAtWorldAngle(worldAngle);
      const pivotPosition = new THREE.Vector3(
        wheelCenter.x + bucketPivotRadius * Math.cos(worldAngle),
        wheelCenter.y + bucketPivotRadius * Math.sin(worldAngle),
        0.30,
      );
      const tripLugOffset = rotateVector2(
        bucketTripLugLocal,
        bucketState.bucketTipAngle,
      );
      bucketStates.push({
        ...bucketState,
        armAngle,
        bucketIndex: index,
        bucketLocalAngle:
          -wheelAngle - armAngle + bucketState.bucketTipAngle,
        pivotPosition,
        tripLugPosition: new THREE.Vector3(
          pivotPosition.x + tripLugOffset.x,
          pivotPosition.y + tripLugOffset.y,
          0.48,
        ),
      });
    }
    const shaftDeliveryFlow = bucketStates.reduce(
      (sum, state) => sum + state.dischargeFlow,
      0,
    );
    const immersedFloatCount = bucketStates.filter(
      ({ pivotPosition }) => pivotPosition.y < streamSurfaceY + 0.32,
    ).length;
    return {
      bucketStates,
      immersedFloatCount,
      inputAcceleration,
      inputAngle,
      inputRotation,
      inputSpeed,
      phase: inputRotation / FULL_TURN,
      shaftDeliveryFlow,
      streamDriveTorque,
      streamVelocityAtBottomDotWheelTangent:
        streamVelocityX * inputSpeed * floatOuterRadius,
      wheelAngle,
      wheelAngularAcceleration: inputAcceleration,
      wheelAngularSpeed: inputSpeed,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...stateAtInputAngle(inputAngularSpeed * cycleTime),
      cycleTime,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.33,
    roughness: 0.44,
  });
  const wheelMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.50,
  });
  const bucketMaterial = matte(PALETTE.accent, {
    metalness: 0.15,
    roughness: 0.47,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.62,
    roughness: 0.27,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const paleWaterMaterial = matte(0x89d8e5, {
    opacity: 0.66,
    roughness: 0.23,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const floatCurve = makeFloatCenterline(
    floatInnerRadius,
    floatOuterRadius,
    floatSweepAngle,
  );
  const floatGeometry = makeCurvedFloatGeometry(floatCurve, floatDepth);
  const wheel = new THREE.Group();
  wheel.position.copy(wheelCenter);
  wheel.userData.role =
    'one-rigid-counterclockwise-persian-irrigation-wheel';
  root.add(wheel);

  const hollowShaft = new THREE.Mesh(
    makeHollowShaftGeometry(
      hollowShaftOuterRadius,
      hollowShaftInnerRadius,
      hollowShaftLength,
    ),
    darkMaterial,
  );
  hollowShaft.userData.role =
    'rotating-hollow-shaft-receiving-float-lifted-water';
  wheel.add(hollowShaft);
  const shaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.07, 0.08),
    whiteMaterial,
  );
  shaftIndex.position.set(0.38, 0, hollowShaftLength / 2 + 0.05);
  shaftIndex.userData.role = 'visible-hollow-shaft-rotation-index';
  wheel.add(shaftIndex);

  const arms = [];
  const buckets = [];
  const bucketWaters = [];
  const bucketSpills = [];
  const floatWaters = [];
  const channelMarkers = [];
  const tripLugs = [];
  for (let index = 0; index < floatCount; index += 1) {
    const armAngle = index * FULL_TURN / floatCount;
    const arm = new THREE.Group();
    arm.rotation.z = armAngle;
    arm.userData.role = `rigid-curved-float-${index + 1}`;
    arm.userData.floatIndex = index;
    wheel.add(arm);
    arms.push(arm);

    const blade = new THREE.Mesh(floatGeometry, wheelMaterial);
    blade.userData.role =
      `curved-stream-driven-float-blade-${index + 1}`;
    arm.add(blade);
    const floatWaterMaterial = waterMaterial.clone();
    const floatWater = new THREE.Mesh(
      new THREE.TubeGeometry(floatCurve, 96, 0.075, 9, false),
      floatWaterMaterial,
    );
    floatWater.position.z = floatDepth / 2 + 0.025;
    floatWater.userData.role =
      `water-lifted-inward-by-curved-float-${index + 1}`;
    arm.add(floatWater);
    floatWaters.push(floatWater);
    const channelMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 18, 12),
      paleWaterMaterial,
    );
    channelMarker.position.z = floatDepth / 2 + 0.08;
    channelMarker.userData.role =
      `inward-moving-float-water-marker-${index + 1}`;
    arm.add(channelMarker);
    channelMarkers.push(channelMarker);

    const endLink = new THREE.Mesh(
      new THREE.BoxGeometry(
        bucketPivotRadius - floatOuterRadius + 0.12,
        0.10,
        0.18,
      ),
      darkMaterial,
    );
    endLink.position.x = (bucketPivotRadius + floatOuterRadius) / 2;
    endLink.userData.role = `float-tip-bucket-pivot-link-${index + 1}`;
    arm.add(endLink);

    const bucket = new THREE.Group();
    bucket.position.set(bucketPivotRadius, 0, 0.30);
    bucket.userData.role =
      `gravity-suspended-pin-tipped-bucket-${index + 1}`;
    bucket.userData.bucketIndex = index;
    arm.add(bucket);
    buckets.push(bucket);
    const bucketBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.30, 0.23, 0.50, 28, 1, true),
      bucketMaterial,
    );
    bucketBody.position.y = -0.39;
    bucketBody.userData.role = `open-irrigation-bucket-${index + 1}`;
    bucket.add(bucketBody);
    const bucketBottom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.23, 0.07, 28),
      bucketMaterial,
    );
    bucketBottom.position.y = -0.63;
    bucket.add(bucketBottom);
    const bucketRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.30, 0.035, 8, 32),
      darkMaterial,
    );
    bucketRim.rotation.x = Math.PI / 2;
    bucketRim.position.y = -0.14;
    bucket.add(bucketRim);
    const hangerLeft = beamBetween(
      new THREE.Vector3(0, -0.02, 0),
      new THREE.Vector3(-0.28, -0.18, 0),
      0.045,
      0.045,
      darkMaterial,
    );
    const hangerRight = beamBetween(
      new THREE.Vector3(0, -0.02, 0),
      new THREE.Vector3(0.28, -0.18, 0),
      0.045,
      0.045,
      darkMaterial,
    );
    hangerLeft.userData.role = `bucket-hanger-${index + 1}`;
    hangerRight.userData.role = `bucket-hanger-${index + 1}`;
    bucket.add(hangerLeft, hangerRight);
    const hinge = new THREE.Mesh(
      new THREE.TorusGeometry(0.105, 0.035, 8, 24),
      darkMaterial,
    );
    hinge.userData.role = `free-bucket-suspension-pivot-${index + 1}`;
    bucket.add(hinge);
    const bucketWater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.255, 0.20, 1, 26),
      waterMaterial,
    );
    bucketWater.userData.role =
      `gravity-level-water-load-in-bucket-${index + 1}`;
    bucket.add(bucketWater);
    bucketWaters.push(bucketWater);
    const tripLug = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 16, 11),
      darkMaterial,
    );
    tripLug.position.set(
      bucketTripLugLocal.x,
      bucketTripLugLocal.y,
      0.18,
    );
    tripLug.userData.role = `stationary-pin-trip-lug-${index + 1}`;
    bucket.add(tripLug);
    tripLugs.push(tripLug);

    const spill = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.065, 1, 14),
      paleWaterMaterial,
    );
    spill.userData.role = `high-level-bucket-discharge-${index + 1}`;
    root.add(spill);
    bucketSpills.push(spill);
  }

  const shaftWater = cylinderAlongZ(
    hollowShaftInnerRadius * 0.78,
    hollowShaftLength + 0.36,
    waterMaterial,
    28,
  );
  shaftWater.position.copy(wheelCenter);
  shaftWater.userData.role =
    'water-delivered-through-center-of-hollow-shaft';
  root.add(shaftWater);

  const bearingRings = [-1, 1].map((sign) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(
        hollowShaftOuterRadius + 0.08,
        0.095,
        10,
        42,
      ),
      frameMaterial,
    );
    bearing.position.set(
      wheelCenter.x,
      wheelCenter.y,
      sign * (hollowShaftLength / 2 + 0.09),
    );
    bearing.userData.role =
      `fixed-${sign < 0 ? 'rear' : 'front'}-hollow-shaft-bearing`;
    root.add(bearing);
    return bearing;
  });

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(7.50, 0.23, 3.22),
    frameMaterial,
  );
  base.position.set(0, groundY + 0.115, 0);
  base.userData.role = 'fixed-persian-wheel-base';
  root.add(base);
  const supports = [-1, 1].map((zSign) => {
    const support = beamBetween(
      new THREE.Vector3(-1.42, groundY + 0.26, zSign * 0.70),
      new THREE.Vector3(0, wheelCenter.y, zSign * 0.70),
      0.23,
      0.24,
      frameMaterial,
    );
    support.userData.role = 'fixed-hollow-shaft-bearing-standard';
    root.add(support);
    return support;
  });

  const streamBed = new THREE.Mesh(
    new THREE.BoxGeometry(7.42, 0.22, 3.14),
    frameMaterial,
  );
  streamBed.position.set(0, groundY + 0.36, 0);
  streamBed.userData.role = 'fixed-stream-bed-beneath-wheel';
  root.add(streamBed);
  const streamWater = new THREE.Mesh(
    new THREE.BoxGeometry(7.20, 0.28, 2.82),
    waterMaterial,
  );
  streamWater.position.set(0, streamSurfaceY - 0.14, 0);
  streamWater.userData.role =
    'moving-stream-partly-immersing-curved-floats';
  root.add(streamWater);
  const currentMarkers = [];
  for (let index = 0; index < 14; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 14, 10),
      paleWaterMaterial,
    );
    marker.userData.role = `rightward-driving-stream-marker-${index + 1}`;
    root.add(marker);
    currentMarkers.push(marker);
  }

  const tripPivot = new THREE.Vector2(
    wheelCenter.x + bucketPivotRadius * Math.cos(dumpPeakAngle),
    wheelCenter.y + bucketPivotRadius * Math.sin(dumpPeakAngle),
  );
  const tripLugAtMaximum = rotateVector2(
    bucketTripLugLocal,
    maximumBucketTip,
  );
  const tripPinPosition = new THREE.Vector3(
    tripPivot.x + tripLugAtMaximum.x,
    tripPivot.y + tripLugAtMaximum.y,
    0.48,
  );
  const stationaryTripPin = cylinderAlongZ(0.10, 0.62,
    darkMaterial, 24);
  stationaryTripPin.position.copy(tripPinPosition);
  stationaryTripPin.userData.role =
    'fixed-pin-tilting-each-bucket-at-high-station';
  root.add(stationaryTripPin);
  const tripPinBracket = beamBetween(
    new THREE.Vector3(3.42, tripPinPosition.y, 0.48),
    tripPinPosition,
    0.12,
    0.16,
    frameMaterial,
  );
  tripPinBracket.userData.role = 'fixed-stationary-trip-pin-bracket';
  root.add(tripPinBracket);
  const tripPinPost = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.20,
      tripPinPosition.y - groundY - 0.16,
      0.20,
    ),
    frameMaterial,
  );
  tripPinPost.position.set(
    3.42,
    (tripPinPosition.y + groundY + 0.16) / 2,
    0.48,
  );
  tripPinPost.userData.role = 'fixed-trip-pin-support-post';
  root.add(tripPinPost);

  const deliveryTrough = new THREE.Group();
  deliveryTrough.position.set(2.66, highDeliveryY, 0.50);
  deliveryTrough.rotation.z = -0.10;
  deliveryTrough.userData.role =
    'fixed-high-level-trough-receiving-tipped-bucket-water';
  root.add(deliveryTrough);
  const deliveryBottom = new THREE.Mesh(
    new THREE.BoxGeometry(2.46, 0.13, 0.78),
    frameMaterial,
  );
  deliveryTrough.add(deliveryBottom);
  const deliverySides = [-1, 1].map((sign) => {
    const side = new THREE.Mesh(
      new THREE.BoxGeometry(2.46, 0.28, 0.09),
      frameMaterial,
    );
    side.position.set(0, 0.14, sign * 0.35);
    deliveryTrough.add(side);
    return side;
  });

  const updateBucketWater = (water, fill, bucketTipAngle) => {
    const waterDepth = 0.34 * fill;
    water.visible = fill > 0.01;
    water.position.set(0, -0.59 + waterDepth / 2, 0);
    water.rotation.z = -bucketTipAngle;
    water.scale.set(1, Math.max(waterDepth, 0.001), 1);
  };

  const updateSpill = (spill, bucketState) => {
    const streamTopY = bucketState.pivotPosition.y - 0.30;
    const streamLength = Math.max(0.08, streamTopY - highDeliveryY);
    spill.visible = bucketState.dischargeFlow > 0.01;
    spill.position.set(
      bucketState.pivotPosition.x + 0.20,
      streamTopY - streamLength / 2,
      0.48,
    );
    const width = 0.35 + 0.65 * bucketState.dischargeFlow;
    spill.scale.set(width, streamLength, width);
  };

  const update = (time) => {
    const state = stateAtTime(time);
    wheel.rotation.z = state.wheelAngle;
    for (let index = 0; index < floatCount; index += 1) {
      const bucketState = state.bucketStates[index];
      buckets[index].rotation.z = bucketState.bucketLocalAngle;
      updateBucketWater(
        bucketWaters[index],
        bucketState.bucketFill,
        bucketState.bucketTipAngle,
      );
      updateSpill(bucketSpills[index], bucketState);
      floatWaters[index].visible = bucketState.floatWaterFill > 0.015;
      floatWaters[index].material.opacity =
        0.16 + 0.50 * bucketState.floatWaterFill;
      channelMarkers[index].visible = bucketState.channelMarkerVisible;
      channelMarkers[index].position.copy(
        floatCurve.getPoint(bucketState.channelMarkerParameter),
      );
      channelMarkers[index].position.z = floatDepth / 2 + 0.08;
    }
    shaftWater.visible = state.shaftDeliveryFlow > 0.01;
    const shaftScale = 0.34 + 0.66 * Math.min(1, state.shaftDeliveryFlow);
    shaftWater.scale.set(shaftScale, 1, shaftScale);
    const streamPhase = THREE.MathUtils.euclideanModulo(time / 1.08, 1);
    for (let index = 0; index < currentMarkers.length; index += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        streamPhase + index / currentMarkers.length,
        1,
      );
      currentMarkers[index].position.set(
        -3.45 + 6.90 * progress,
        streamSurfaceY + 0.08,
        -0.95 + 1.90 * ((index % 3) / 2),
      );
      currentMarkers[index].scale.setScalar(
        Math.sqrt(Math.sin(Math.PI * progress)),
      );
    }
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    bucketCapacity,
    bucketPivotRadius,
    bucketTripLugLocal: bucketTripLugLocal.clone(),
    cycleDuration,
    dumpEndAngle,
    dumpEndTravel,
    dumpPeakAngle,
    dumpPeakTravel,
    dumpStartAngle,
    dumpStartTravel,
    floatCount,
    floatDepth,
    floatInnerRadius,
    floatOuterRadius,
    floatSweepAngle,
    groundY,
    highDeliveryY,
    hollowShaftInnerRadius,
    hollowShaftLength,
    hollowShaftOuterRadius,
    inputAngularSpeed,
    maximumBucketTip,
    pickupEndAngle,
    pickupEndTravel,
    pickupStartAngle,
    representativeStreamForce,
    sourceWheelAngle,
    streamDriveTorque,
    streamSurfaceY,
    streamVelocityX,
    tripPinPosition: tripPinPosition.clone(),
    wheelCenter: wheelCenter.clone(),
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'persian-irrigation-wheel-with-six-curved-stream-driven-floats-hollow-shaft-and-pin-tipped-suspended-buckets',
    blocks: {
      arms,
      base,
      bearingRings,
      buckets,
      bucketSpills,
      bucketWaters,
      channelMarkers,
      currentMarkers,
      deliveryBottom,
      deliverySides,
      deliveryTrough,
      floatWaters,
      hollowShaft,
      shaftIndex,
      shaftWater,
      stationaryTripPin,
      streamBed,
      streamWater,
      supports,
      tripLugs,
      tripPinBracket,
      tripPinPost,
      wheel,
    },
    bucketStateAtWorldAngle,
    degreesOfFreedom: {
      bucketFillAndTipIndependent: false,
      bucketSuspensionPivotsPassive: true,
      curvedFloatsIndependent: false,
      hollowShaftIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      wheelCenterTranslationIndependent: false,
    },
    dynamics: {
      bucketSwingImpactPinContactFluidCaptureLeakageSloshFloatHydrodynamicsBearingFrictionAndRotationalInertiaModeled:
        false,
      bucketTiming:
        'Each bucket is held gravity-upright by exact counter-rotation, filled with a quintic ramp while traversing the submerged pickup arc, carried full up the right side, and smoothly pin-tipped and emptied through a forty-degree high-level contact window.',
      floatWaterTransport:
        'A visible water band and a quintic material tracer move from each immersed curved float tip toward the hollow shaft during its rising travel. This illustrates Brown’s stated inward delivery without claiming a solved free-surface flow field.',
      streamDrive:
        'A representative rightward stream force is applied at the bottom immersed radius only to expose the positive counterclockwise torque sign; blade pressure and speed equilibrium are not integrated.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'One rigid six-float wheel turns counterclockwise about a fixed hollow shaft. The rightward stream partly immerses the wheel and acts on the convex curved floats; at the bottom contact its force has positive torque, matching the wheel direction. Each float carries water inward toward the hollow shaft. A bucket hangs from every float tip on a free pivot and is counter-rotated so gravity keeps it upright while it rises. At the high station its lug meets one fixed pin, the bucket tilts and empties into the elevated trough, then returns upright after passing the pin.',
    metering: {
      bucketCapacity,
      bucketsPerWheelRevolution: floatCount,
      elevatedBucketVolumePerWheelRevolution:
        bucketCapacity * floatCount,
    },
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'continuous-counterclockwise-stream-driven-rotation-with-passive-buckets',
      wheelRevolutionsPerCycle: 1,
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 441 page provides Brown’s static engraving and caption; its Animated control is unavailable and the page contains no Canvas construction or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      bucketFills: sourceState.bucketStates.map(({ bucketFill }) => bucketFill),
      bucketPivotPositions: sourceState.bucketStates.map(
        ({ pivotPosition }) => pivotPosition.clone(),
      ),
      wheelAngle: sourceState.wheelAngle,
    },
    sourceReference: {
      brownPlate441: {
        approximateBottomBucketPivotPixels: [260, 398],
        approximateHollowShaftCenterPixels: [253, 210],
        approximateLeftDirectionArrowPixels: [55, 169],
        approximateRightBucketPivotPixels: [411, 115],
        approximateStreamSurfaceYPixels: 362,
        approximateTopBucketPivotPixels: [228, 32],
        approximateWheelOuterRadiusPixels: 185,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the Persian irrigation wheel has a hollow shaft and curved floats',
          'buckets or tubs are suspended from the float extremities',
          'the wheel is partly immersed and the stream acts on the convex float surfaces',
          'each float elevates water and conducts it to the hollow shaft',
          'each bucket carries water to a higher level',
          'a stationary pin tilts each raised bucket to empty it',
        ],
        engravingEvidence:
          'Brown’s engraving shows six spiral-curved floats around one open central shaft, six small freely hung buckets at their outer tips, a partial lower immersion line, and a counterclockwise direction arrow down the wheel’s left side.',
        reconstructionDisclosure:
          'Brown gives no dimensions, float section, shaft bore, bucket capacity, stream speed, force, rotation speed, pickup arc, pin location, tilt angle, delivery-trough geometry, masses, losses, or timing. Those values, water tracers, frame, colors, and twelve-second cycle are independently engineered. The six rigid curved floats, hollow shaft, partial immersion, stream-driven counterclockwise direction, suspended buckets, inward float-water transport, and fixed-pin high-level emptying are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 441',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      bucketGravityOrientation:
        'bucketLocalAngle=-wheelAngle-armIndexAngle+pinTipAngle, so each untripped bucket has exactly zero world rotation while its pivot follows the wheel.',
      fixedPinContact:
        'At the sixty-degree dump center the moving bucket-lug center coincides with the reconstructed stationary-pin center and the bucket reaches its maximum clockwise tip.',
      streamTorque:
        'At the bottom contact r=(0,-R) and rightward F=(+F,0), hence tau_z=-r_y*F_x=R*F>0, counterclockwise.',
      waterPath:
        'Each curved-float tracer travels continuously from outer parameter 1 toward inner parameter 0 before delivery into the hollow shaft.',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.00, groundY, -1.85),
    new THREE.Vector3(4.08, 3.62, 1.85),
  );
  root.userData.cameraDistanceScale = 1.07;
  root.userData.cameraDirection = new THREE.Vector3(5.6, 4.2, 11.8);
  root.userData.groundFloorY = groundY;
  markShadows(root);
  base.receiveShadow = true;
  streamBed.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredPersianIrrigationWheelMovement(movement) {
  if (movement.id !== 441) return null;
  return persianIrrigationWheel(movement);
}
