import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {WaterStream,collectWaterStreams} from './water-stream.js';
import {makeCellWaterGeometry,updateClippedCell} from './clipped-fluid-cell.js';
import { curvedFloatChannel, portedFloatHub } from './water-lifting-solids.js';
import { horizontalTurned } from './horizontal-turbine-solids.js';
import { ring, capsule, plate, poly, circle, polygonClipping } from './finite-plate-geometry.js';
import { makePersianBucketTrip } from './persian-bucket-trip.js';
import { waterVolume } from './water-volume.js';
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
  const floatInnerRadius = 0.30;
  const floatOuterRadius = 2.48;
  const bucketPivotRadius = 2.58;
  const bucketPinBossRadius = 1.6 * 0.068;
  const floatSweepAngle = THREE.MathUtils.degToRad(82);
  const floatDepth = 0.34;
  const hollowShaftOuterRadius = 0.54;
  const hollowShaftInnerRadius = 0.31;
  const hollowShaftLength = 1.70;
  const streamSurfaceY = -1.36;
  const streamVelocityX = 1.25;
  const representativeStreamForce = 5.8;
  const streamDriveTorque = floatOuterRadius
    * representativeStreamForce;
  const pickupStartAngle = THREE.MathUtils.degToRad(220);
  const pickupEndAngle = THREE.MathUtils.degToRad(290);
  const dumpStartAngle = THREE.MathUtils.degToRad(40);
  const trip=makePersianBucketTrip(bucketPivotRadius,wheelCenter.y,dumpStartAngle);
  const dumpPeakAngle = trip.peak;
  const dumpEndAngle = trip.peak + THREE.MathUtils.degToRad(12);
  const maximumBucketTip = trip.maximum;
  const bucketPlaneZ=.57;
  const bucketCapacity = 0.0032;
  const highDeliveryY = 1.05;
  const groundY = -3.45;
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
  const bucketTripLugLocal = new THREE.Vector2(trip.shoeX, trip.shoeTop);

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
    const bucketTipAngle=trip.angleAt(worldAngle);
    const tipFraction=bucketTipAngle/maximumBucketTip;
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
      bucketTipAngle,
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
        bucketPlaneZ,
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
          trip.pin.z,
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
  const channel = curvedFloatChannel(floatCurve, floatDepth);
  const floatGeometry = channel.geometry;
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
  hollowShaft.geometry.dispose();
  hollowShaft.geometry = portedFloatHub(hollowShaftInnerRadius, hollowShaftOuterRadius, hollowShaftLength, channel.port, floatCount, floatDepth);
  // The ported hub turns with the floats and is one piece with them; Brown
  // draws it light, not as a black ring.
  hollowShaft.material = wheelMaterial;
  hollowShaft.userData.role =
    'rotating-hollow-shaft-receiving-float-lifted-water';
  wheel.add(hollowShaft);
  const shaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.07, 0.08),
    whiteMaterial,
  );
  shaftIndex.position.set(0.38, 0, hollowShaftLength / 2 + 0.05);
  shaftIndex.userData.role = 'visible-hollow-shaft-rotation-index';
  wheel.add(shaftIndex);

  // Brown draws a light circular rim through the float tips and bucket
  // pivots.
  // A plain wooden hoop in the wheel's colour (not a dark outline ring).
  const outerRim = new THREE.Mesh(ring(bucketPivotRadius - 0.05, bucketPivotRadius + 0.05, -0.05, 0.05), wheelMaterial);
  outerRim.userData.role = 'light-outer-rim-through-bucket-pivots';
  wheel.add(outerRim);
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
      new THREE.TubeGeometry(floatCurve, 96, 0.035, 9, false),
      floatWaterMaterial,
    );
    floatWater.position.z = 0;
    floatWater.userData.role =
      `water-lifted-inward-by-curved-float-${index + 1}`;
    arm.add(floatWater);
    floatWaters.push(floatWater);
    const channelMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 18, 12),
      paleWaterMaterial,
    );
    channelMarker.position.z = 0;
    channelMarker.userData.role =
      `inward-moving-float-water-marker-${index + 1}`;
    arm.add(channelMarker);
    channelMarkers.push(channelMarker);

    // Pass 92: the link runs from the float tip into the rim boss and stops
    // short of the pin, which the boss carries.
    const endLinkInner = floatOuterRadius - 0.06;
    const endLinkOuter = bucketPivotRadius - 0.085;
    const endLink = new THREE.Mesh(
      new THREE.BoxGeometry(endLinkOuter - endLinkInner, 0.10, 0.18),
      darkMaterial,
    );
    endLink.position.x = (endLinkInner + endLinkOuter) / 2;
    endLink.userData.role = `float-tip-bucket-pivot-link-${index + 1}`;
    arm.add(endLink);

    const bucket = new THREE.Group();
    bucket.position.set(bucketPivotRadius, 0, bucketPlaneZ);
    bucket.userData.role =
      `gravity-suspended-pin-tipped-bucket-${index + 1}`;
    bucket.userData.bucketIndex = index;
    arm.add(bucket);
    buckets.push(bucket);
    const bucketBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.30, 0.23, 0.50, 28, 1, true),
      bucketMaterial,
    );
    bucketBody.geometry.dispose();
    bucketBody.geometry = horizontalTurned([[-.25,.20],[-.25,.23],[.25,.30],[.25,.27]]);
    bucketBody.position.y = -0.39;
    bucketBody.userData.role = `open-irrigation-bucket-${index + 1}`;
    bucket.add(bucketBody);
    const bucketBottom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.23, 0.07, 28),
      bucketMaterial,
    );
    bucketBottom.position.y = -0.63;
    bucket.add(bucketBottom);
    // A rolled lip in the bucket's own colour, not an ink outline.
    const bucketRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.30, 0.035, 8, 32),
      bucketMaterial,
    );
    bucketRim.rotation.x = Math.PI / 2;
    bucketRim.position.y = -0.14;
    bucket.add(bucketRim);
    // Pass 90: one bail: an eye round the float-tip pin (bore 0.072 on the
    // 0.068 pin) and one arc from rim to rim through it (the two hanger bars
    // are gone). The arc passes through the eye's middle and lands on the
    // rim's centre line at both sides.
    const eyeMiddle = 0.106, rimY = -0.14, rimR = 0.30;
    const bailCenterY = (eyeMiddle * eyeMiddle - rimR * rimR - rimY * rimY) / (2 * (eyeMiddle - rimY));
    const bailRadius = eyeMiddle - bailCenterY, bailTube = 0.025;
    const bailEnd = Math.atan2(rimY - bailCenterY, rimR);
    const bailArc = new THREE.TorusGeometry(bailRadius, bailTube, 12, 48, Math.PI - 2 * bailEnd)
      .rotateZ(bailEnd).translate(0, bailCenterY, 0);
    const hinge = new THREE.Mesh(mergeGeometries([bailArc, ring(.072,.14,-.035,.035)].map((g) => {
      const flat = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(flat.attributes)) if (!['position', 'normal'].includes(k)) flat.deleteAttribute(k);
      return flat;
    })), darkMaterial);
    const suspensionPin = cylinderAlongZ(.068,.64,darkMaterial,32);
    suspensionPin.position.set(bucketPivotRadius,0,.30);
    suspensionPin.userData.role = `finite-bucket-suspension-pin-${index + 1}`;
    arm.add(suspensionPin);
    // Pass 92: Brown draws a small round boss on the rim at each bucket
    // pivot. It is part of the rim (wheel body), concentric with the pin
    // (1.6 x its radius), a little deeper than the rim and the float-tip link
    // so no face is coplanar, and it buries the link's square end.
    const pivotBoss = cylinderAlongZ(bucketPinBossRadius, 0.20, wheelMaterial, 40);
    pivotBoss.position.set(bucketPivotRadius * Math.cos(armAngle),
      bucketPivotRadius * Math.sin(armAngle), 0);
    pivotBoss.userData.role = `rim-boss-round-bucket-suspension-pin-${index + 1}`;
    wheel.add(pivotBoss);
    hinge.userData.role = `bucket-bail-hung-on-float-tip-pin-${index + 1}`;
    bucket.add(hinge);
    // Pass 69: a level body inscribed in the tapered bucket and clipped at
    // its lowest rim point, so a tipped bucket pours rather than holding a
    // disc of water through its staves.
    const bucketWater = new THREE.Mesh(makeCellWaterGeometry(), waterMaterial);
    bucketWater.userData.role =
      `gravity-level-water-load-in-bucket-${index + 1}`;
    bucket.add(bucketWater);
    bucketWaters.push(bucketWater);
    // Pass 93: the trip lug is one flat tab welded flush to the bucket's
    // side in its own mid-plane (it was a black shoe held out in front on a
    // rod). Its outer edge is the same capsule shoe the trip contact uses;
    // its inner edge is buried in the tapered wall, and above the wall it
    // runs into the rolled rim. The stationary pin reaches back to it.
    const tripLug = new THREE.Mesh(plate(polygonClipping.union(
      capsule([trip.shoeX,trip.shoeBottom],[trip.shoeX,trip.shoeTop],trip.shoeRadius,48),
      poly([[trip.shoeX,trip.shoeBottom],[-.22,trip.shoeBottom],[-.28,-.14],[trip.shoeX,-.14]]),
    ),-.03,.03),bucketMaterial);
    tripLug.userData.role = `stationary-pin-trip-lug-${index + 1}`;
    bucket.add(tripLug);tripLugs.push(tripLug);

    // Pass 69 (p69-w1): each tipped bucket pours from its lip as one
    // continuous stream that falls under gravity (recomputed in place as the
    // bucket travels), not a stiff vertical rod.
    const spillPath = {
      points: Array.from({length: 17}, () => new THREE.Vector3()),
      speeds: new Array(17).fill(1), times: new Array(17).fill(0),
    };
    const spill = new WaterStream(spillPath, {
      width: 0.16, thickness: 0.07, widthAxis: new THREE.Vector3(0, 0, 1), widthExponent: 0.4,
      fadeOut: 0.35, cyclePeriod: cycleDuration, streakRate: 1.4, opacity: 0.5,
    });
    spill.spillPath = spillPath;
    spill.userData.role = `high-level-bucket-discharge-stream-${index + 1}`;
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
    bearing.geometry.dispose();
    bearing.geometry = ring(hollowShaftOuterRadius+.004,hollowShaftOuterRadius+.175,-.09,.09);
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
      new THREE.Vector3(-1.42, groundY + 0.26, zSign * 1.12),
      new THREE.Vector3(0, wheelCenter.y, zSign * 1.12),
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
  // The stream is a translucent water body from its surface to the bed,
  // across the plate's width and the wheel's depth; the lowest floats and
  // bucket dip into it.
  const streamWater = waterVolume({ xMin: -3.75, xMax: 3.75, surfaceY: streamSurfaceY, bottomY: streamSurfaceY - 1.75, zMin: -1.5, zMax: 1.5 });
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

  const tripPinPosition = trip.pin.clone();
  // It runs from its arm back to 0.04 behind the buckets' mid-plane, where
  // it meets each bucket's welded tab.
  const tripPinBack = bucketPlaneZ - .04, tripPinFront = 1.31;
  const stationaryTripPin = cylinderAlongZ(trip.pinRadius, tripPinFront - tripPinBack,
    darkMaterial, 64);
  stationaryTripPin.position.copy(tripPinPosition);
  stationaryTripPin.position.z=(tripPinBack + tripPinFront) / 2;
  // Pass 90: the caption's stationary pin is shown (it and its bracket had
  // been removed from the presentation, so the buckets tipped by themselves).
  stationaryTripPin.userData.role =
    'stationary-tipping-pin-at-high-station';
  root.add(stationaryTripPin);
  // Pass 92: the arm is one flat extrusion ending in a round eye concentric
  // with the pin (0.6 of the pin's radius of margin round it), so the pin
  // stands centred in the arm's end instead of on its square edge.
  const tripPinEyeRadius = trip.pinRadius * 1.6;
  const tripPinBracket = new THREE.Mesh(
    plate(polygonClipping.union(
      poly([[3.42, tripPinPosition.y - 0.06], [tripPinPosition.x, tripPinPosition.y - 0.06],
        [tripPinPosition.x, tripPinPosition.y + 0.06], [3.42, tripPinPosition.y + 0.06]]),
      poly(circle([tripPinPosition.x, tripPinPosition.y], tripPinEyeRadius, 96)),
    ), 1.28, 1.40),
    frameMaterial,
  );
  tripPinBracket.userData.eyeRadius = tripPinEyeRadius;
  tripPinBracket.userData.role = 'stationary-tipping-pin-arm';
  root.add(tripPinBracket);
  // Pass 101: the post stands in the stream bed's top face (it used to run
  // on 0.25 below the bed's underside), seated 0.02 into it.
  const bedTopY = groundY + 0.45;
  const tripPinPost = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.12,
      tripPinPosition.y - bedTopY,
      0.12,
    ),
    frameMaterial,
  );
  tripPinPost.position.set(
    3.42,
    (tripPinPosition.y + bedTopY) / 2,
    1.34,
  );
  tripPinPost.userData.role = 'stationary-tipping-pin-post';
  root.add(tripPinPost);

  const deliveryTrough = new THREE.Group();
  deliveryTrough.position.set(.925, highDeliveryY, bucketPlaneZ);
  deliveryTrough.userData.role =
    'fixed-high-level-trough-receiving-tipped-bucket-water';
  root.add(deliveryTrough);
  const deliveryBottom = new THREE.Mesh(
    new THREE.BoxGeometry(1.85, 0.13, 0.68),
    frameMaterial,
  );
  deliveryTrough.add(deliveryBottom);
  const deliverySides = [-1, 1].map((sign) => {
    const side = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.22, 0.06),
      frameMaterial,
    );
    side.position.set(0, 0.10, sign * 0.31);
    deliveryTrough.add(side);
    return side;
  });

  const receiverPost=new THREE.Mesh(new THREE.BoxGeometry(.16,highDeliveryY-groundY,.16),frameMaterial);
  receiverPost.position.set(.10,(groundY+highDeliveryY)/2,1.34);
  receiverPost.userData.role='fixed-outboard-receiver-standard';root.add(receiverPost);
  const receiverBridge=new THREE.Mesh(new THREE.BoxGeometry(.16,.13,.80),frameMaterial);
  receiverBridge.position.set(.10,highDeliveryY,1.00);
  receiverBridge.userData.role='fixed-receiver-to-standard-bridge';root.add(receiverBridge);

  const payloadHalfDepth = 0.12, payloadFloor = -0.59, payloadRim = -0.16, payloadRise = 0.34;
  const payloadHalfWidth = (y) => {
    const r = 0.20 + 0.07 * (y + 0.64) / 0.5;
    return Math.sqrt(Math.max(0.001, r * r - payloadHalfDepth ** 2)) - 0.01;
  };
  const payloadOutline = [[-payloadHalfWidth(payloadFloor), payloadFloor], [payloadHalfWidth(payloadFloor), payloadFloor],
    [payloadHalfWidth(payloadRim), payloadRim], [-payloadHalfWidth(payloadRim), payloadRim]];
  const updateBucketWater = (water, fill, bucketTipAngle) => {
    const c = Math.cos(bucketTipAngle), sn = Math.sin(bucketTipAngle);
    const ys = payloadOutline.map(([x, y]) => x * sn + y * c);
    const rimLimit = Math.min(ys[2], ys[3]) - Math.min(...ys);
    const level = Math.min(fill, Math.max(0, rimLimit - 0.01) / payloadRise);
    updateClippedCell(water, payloadOutline, bucketTipAngle, level, payloadRise, 2 * payloadHalfDepth);
    water.visible = level > 0.01;
  };

  const updateSpill = (spill, bucketState) => {
    spill.visible = bucketState.dischargeFlow > .004;
    if (!spill.visible) return;
    const lip = rotateVector2(new THREE.Vector2(-.27, -.14), bucketState.bucketTipAngle);
    const x0 = bucketState.pivotPosition.x + lip.x, y0 = bucketState.pivotPosition.y + lip.y;
    const vx = -0.35 * Math.cos(bucketState.bucketTipAngle), g = 9.81;
    const tEnd = Math.min(1, bucketState.dischargeFlow / 0.3) * Math.sqrt(2 * Math.max(0.05, y0 - highDeliveryY) / g);
    const {points, speeds, times} = spill.spillPath;
    for (let i = 0; i < points.length; i += 1) {
      const t = tEnd * i / (points.length - 1);
      points[i].set(x0 + vx * t, y0 - 0.5 * g * t * t, bucketPlaneZ);
      speeds[i] = Math.hypot(vx, g * t) + 0.3;
      times[i] = t;
    }
    spill.flow = 0.25 + 0.75 * bucketState.dischargeFlow;
    spill.setPath(spill.spillPath);
  };

  const updateStreams = collectWaterStreams(root);
  const update = (time) => {
    updateStreams(time);
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
      channelMarkers[index].position.z = 0;
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
    bucketPlaneZ,
    trip,
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
      targetCycleDuration: cycleDuration,
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
      receiverPost,
      receiverBridge,
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
        'Each bucket is held gravity-upright by exact counter-rotation, then pin-tipped along exact round-pin/capsule-shoe tangency until its angular maximum. Its clear return swing and water filling/emptying remain prescribed; passive impact, inertia and fluid capture are not solved.',
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
        'A finite outboard capsule shoe meets a round stationary pin; the rising tip angle solves their tangency, then a continuous prescribed return clears the pin.',
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
  // Brown's flat front elevation: near-orthographic so the stream reads as a band.
  root.userData.cameraDirection = new THREE.Vector3(0, 0.01, 1);
  root.userData.cameraFov = 10;
  root.userData.groundFloorY = groundY;
  root.userData.solidReview = { status: 'qualified-geometry', residual: 'Finite shoe/pin tangency and clear receiver path are reconstructed; impact, passive swing and fluid volume/discharge remain prescribed, not dynamically solved.' };
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
  root.traverse(o => { for (const m of o.material ? [].concat(o.material) : []) m.fog = false; });
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
