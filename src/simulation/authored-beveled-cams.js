import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function centeredExtrusion(shape, depth, bevel = 0.008) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevel > 0,
    bevelSegments: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 40,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function annularShape(innerRadius, outerRadius) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  shape.holes.push(hole);
  return shape;
}

function cylinderAlongX(radius, length, material, segments = 40) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongY(radius, length, material, segments = 32) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function sleeveAlongDirection({
  direction,
  innerRadius,
  length,
  material,
  outerRadius,
  role,
}) {
  const sleeve = new THREE.Mesh(
    centeredExtrusion(annularShape(innerRadius, outerRadius), length),
    material,
  );
  sleeve.quaternion.setFromUnitVectors(Z_AXIS, direction.clone().normalize());
  sleeve.userData.innerRadius = innerRadius;
  sleeve.userData.role = role;
  return sleeve;
}

function wedgeDiskGeometry({
  backX,
  frontX,
  radius,
  segments,
  tiltCoefficient,
}) {
  const positions = [];
  const frontCenterIndex = 0;
  positions.push(frontX, 0, 0);
  const backCenterIndex = 1;
  positions.push(backX, 0, 0);
  const frontRingStart = positions.length / 3;
  for (let index = 0; index < segments; index += 1) {
    const angle = FULL_TURN * index / segments;
    const y = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    positions.push(frontX + tiltCoefficient * y, y, z);
  }
  const backRingStart = positions.length / 3;
  for (let index = 0; index < segments; index += 1) {
    const angle = FULL_TURN * index / segments;
    positions.push(
      backX,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    );
  }
  const indices = [];
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    const front = frontRingStart + index;
    const frontNext = frontRingStart + next;
    const back = backRingStart + index;
    const backNext = backRingStart + next;
    indices.push(frontCenterIndex, frontNext, front);
    indices.push(backCenterIndex, back, backNext);
    indices.push(front, frontNext, back);
    indices.push(frontNext, backNext, back);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.closedSolid = true;
  return geometry;
}

function bevelSurfaceGeometry({
  frontX,
  innerRadius,
  outerRadius,
  outwardOffset,
  segments,
  tiltCoefficient,
}) {
  const localNormal = new THREE.Vector3(
    -1,
    tiltCoefficient,
    0,
  ).normalize();
  const positions = [];
  for (const radius of [innerRadius, outerRadius]) {
    for (let index = 0; index < segments; index += 1) {
      const angle = FULL_TURN * index / segments;
      const y = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      positions.push(
        frontX + tiltCoefficient * y + localNormal.x * outwardOffset,
        y + localNormal.y * outwardOffset,
        z,
      );
    }
  }
  const indices = [];
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    const inner = index;
    const innerNext = next;
    const outer = segments + index;
    const outerNext = segments + next;
    indices.push(inner, outerNext, outer);
    indices.push(inner, innerNext, outerNext);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeWavyEdge({
  frontX,
  material,
  radius,
  role,
  segments,
  tiltCoefficient,
}) {
  const points = Array.from({ length: segments }, (_, index) => {
    const angle = FULL_TURN * index / segments;
    const y = Math.cos(angle) * radius;
    return new THREE.Vector3(
      frontX + tiltCoefficient * y,
      y,
      Math.sin(angle) * radius,
    );
  });
  const edge = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points, true, 'centripetal'),
      segments * 2,
      0.035,
      8,
      true,
    ),
    material,
  );
  edge.userData.role = role;
  return edge;
}

function beveledDiskInclinedFollower(movement) {
  const root = new THREE.Group();
  const camCenter = new THREE.Vector3(0, 0, 0);
  const camOuterRadius = 2.02;
  const bevelInnerRadius = 1.42;
  const camFrontX = -0.78;
  const camBackX = 0.48;
  const bevelTiltCoefficient = 0.18;
  const bevelAngle = Math.atan(bevelTiltCoefficient);
  const bevelSurfaceOffset = 0.012;
  const camSegments = 128;
  const shaftRadius = 0.13;
  const shaftLength = 5.7;
  const hubRadius = 0.34;
  const hubLength = 1.54;
  const shoeRadius = 0.12;
  const rodRadius = 0.105;
  const rodLength = 4.05;
  const translationIndexDistance = 3.15;
  const guideRunningClearance = 0.025;
  const guideInnerRadius = rodRadius + guideRunningClearance;
  const guideOuterRadius = 0.29;
  const guideLength = 0.42;
  const guideDistances = [1.18, 2.55];
  const sourceSurfacePoint = new THREE.Vector3(-0.5064, 1.52, 0);
  const followerDirection = new THREE.Vector3(-0.839, 0.544, 0).normalize();
  const planeNormalMagnitude = Math.sqrt(
    1 + bevelTiltCoefficient ** 2,
  );
  const sourceOutwardNormal = new THREE.Vector3(
    -1,
    bevelTiltCoefficient,
    0,
  ).normalize();
  const sourceShoeCenter = sourceSurfacePoint.clone().addScaledVector(
    sourceOutwardNormal,
    shoeRadius,
  );
  const driverAngularSpeed = -0.82;
  const cyclePeriod = FULL_TURN / Math.abs(driverAngularSpeed);
  const sourceDriverAngle = 0;
  const boundaryEpsilon = 1e-11;

  const stateAtDriverAngle = (driverAngle) => {
    const cosine = Math.cos(driverAngle);
    const sine = Math.sin(driverAngle);
    const pointProjection = cosine * sourceShoeCenter.y
      + sine * sourceShoeCenter.z;
    const directionProjection = cosine * followerDirection.y
      + sine * followerDirection.z;
    const pointProjectionDerivative = -sine * sourceShoeCenter.y
      + cosine * sourceShoeCenter.z;
    const directionProjectionDerivative = -sine * followerDirection.y
      + cosine * followerDirection.z;
    const numerator = sourceShoeCenter.x
      - bevelTiltCoefficient * pointProjection
      - camFrontX
      + shoeRadius * planeNormalMagnitude;
    const denominator = followerDirection.x
      - bevelTiltCoefficient * directionProjection;
    const numeratorDerivative = -bevelTiltCoefficient
      * pointProjectionDerivative;
    const denominatorDerivative = -bevelTiltCoefficient
      * directionProjectionDerivative;
    const numeratorSecondDerivative = bevelTiltCoefficient
      * pointProjection;
    const denominatorSecondDerivative = bevelTiltCoefficient
      * directionProjection;
    const quotientDerivativeNumerator = numeratorDerivative * denominator
      - numerator * denominatorDerivative;
    const displacement = -numerator / denominator;
    const displacementPerRadian = -quotientDerivativeNumerator
      / denominator ** 2;
    const displacementSecondPerRadian = -(
      numeratorSecondDerivative * denominator
        - numerator * denominatorSecondDerivative
    ) / denominator ** 2
      + 2 * quotientDerivativeNumerator * denominatorDerivative
        / denominator ** 3;
    const displacementSpeed = displacementPerRadian
      * driverAngularSpeed;
    const displacementAcceleration = displacementSecondPerRadian
      * driverAngularSpeed ** 2;
    const shoeCenter = sourceShoeCenter.clone().addScaledVector(
      followerDirection,
      displacement,
    );
    const shoeVelocity = followerDirection.clone().multiplyScalar(
      displacementSpeed,
    );
    const shoeAcceleration = followerDirection.clone().multiplyScalar(
      displacementAcceleration,
    );
    const planeGradient = new THREE.Vector3(
      1,
      -bevelTiltCoefficient * cosine,
      -bevelTiltCoefficient * sine,
    );
    const outwardNormal = planeGradient.clone().multiplyScalar(
      -1 / planeNormalMagnitude,
    );
    const contactPoint = shoeCenter.clone().addScaledVector(
      outwardNormal,
      -shoeRadius,
    );
    const localContactPoint = contactPoint.clone()
      .applyAxisAngle(X_AXIS, -driverAngle);
    const contactRadius = Math.hypot(
      localContactPoint.y,
      localContactPoint.z,
    );
    const camSurfaceVelocity = new THREE.Vector3().crossVectors(
      X_AXIS,
      contactPoint.clone().sub(camCenter),
    ).multiplyScalar(driverAngularSpeed);
    const relativeVelocity = shoeVelocity.clone().sub(camSurfaceVelocity);
    const normalizedDriverAngle = THREE.MathUtils.euclideanModulo(
      driverAngle,
      FULL_TURN,
    );
    const atDeadCenter = Math.abs(displacementPerRadian) < boundaryEpsilon;
    return {
      atDeadCenter,
      bevelPlaneError: Math.abs(
        localContactPoint.x
          - bevelTiltCoefficient * localContactPoint.y
          - camFrontX,
      ),
      camSurfaceVelocity,
      contactPoint,
      contactRadius,
      contactRadiusInnerClearance: contactRadius - bevelInnerRadius,
      contactRadiusOuterClearance: camOuterRadius - contactRadius,
      denominator,
      displacement,
      displacementAcceleration,
      displacementPerRadian,
      displacementSecondPerRadian,
      displacementSpeed,
      driverAngle,
      driverAngularSpeed,
      inputRevolutions: (driverAngle - sourceDriverAngle) / FULL_TURN,
      localContactPoint,
      normalVelocityError: relativeVelocity.dot(outwardNormal),
      normalizedDriverAngle,
      outwardNormal,
      planeGradient,
      relativeVelocity,
      shoeAcceleration,
      shoeCenter,
      shoePlaneGap: Math.abs(
        shoeCenter.x
          - bevelTiltCoefficient * (
            cosine * shoeCenter.y + sine * shoeCenter.z
          )
          - camFrontX
          + shoeRadius * planeNormalMagnitude,
      ),
      shoeVelocity,
      stage: atDeadCenter && Math.cos(driverAngle) > 0
        ? 'rod-inner-dead-center'
        : atDeadCenter
          ? 'rod-outer-dead-center'
          : displacementSpeed > 0
            ? 'rod-moving-outward-along-inclined-guides'
            : 'rod-moving-inward-toward-beveled-cam',
    };
  };
  const stateAtTime = (time) => stateAtDriverAngle(
    sourceDriverAngle + driverAngularSpeed * time,
  );
  const innerDeadCenter = stateAtDriverAngle(0);
  const outerDeadCenter = stateAtDriverAngle(Math.PI);
  const outputStroke = outerDeadCenter.displacement
    - innerDeadCenter.displacement;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const bevelMaterial = matte(PALETTE.accent, {
    metalness: 0.18,
    roughness: 0.54,
    side: THREE.DoubleSide,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.69,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.45 });

  const camAssembly = new THREE.Group();
  camAssembly.position.copy(camCenter);
  camAssembly.userData.axis = X_AXIS.clone();
  camAssembly.userData.role = 'horizontal-shaft-beveled-disk-cam-assembly';
  const camRotor = new THREE.Group();
  camRotor.userData.role = 'rigid-beveled-cam-and-shaft-rotor';
  camAssembly.add(camRotor);
  root.add(camAssembly);

  const camBody = new THREE.Mesh(
    wedgeDiskGeometry({
      backX: camBackX,
      frontX: camFrontX,
      radius: camOuterRadius,
      segments: camSegments,
      tiltCoefficient: bevelTiltCoefficient,
    }),
    driverMaterial,
  );
  camBody.userData.role = 'solid-circular-disk-with-oblique-front-face';
  camRotor.add(camBody);
  const bevelFace = new THREE.Mesh(
    bevelSurfaceGeometry({
      frontX: camFrontX,
      innerRadius: bevelInnerRadius,
      outerRadius: camOuterRadius,
      outwardOffset: bevelSurfaceOffset,
      segments: camSegments,
      tiltCoefficient: bevelTiltCoefficient,
    }),
    bevelMaterial,
  );
  bevelFace.userData.innerRadius = bevelInnerRadius;
  bevelFace.userData.outerRadius = camOuterRadius;
  bevelFace.userData.role = 'annular-oblique-working-bevel-surface';
  camRotor.add(bevelFace);
  const frontWavyEdge = makeWavyEdge({
    frontX: camFrontX,
    material: darkMaterial,
    radius: camOuterRadius,
    role: 'wavy-front-boundary-of-beveled-cam',
    segments: camSegments,
    tiltCoefficient: bevelTiltCoefficient,
  });
  camRotor.add(frontWavyEdge);
  const rearEdge = new THREE.Mesh(
    new THREE.TorusGeometry(camOuterRadius, 0.035, 8, camSegments),
    darkMaterial,
  );
  rearEdge.rotation.y = Math.PI / 2;
  rearEdge.position.x = camBackX;
  rearEdge.userData.role = 'circular-rear-boundary-of-beveled-cam';
  camRotor.add(rearEdge);
  const shaft = cylinderAlongX(
    shaftRadius,
    shaftLength,
    darkMaterial,
    44,
  );
  shaft.userData.role = 'continuous-horizontal-input-shaft';
  camRotor.add(shaft);
  const hub = cylinderAlongX(hubRadius, hubLength, darkMaterial, 48);
  hub.userData.role = 'cam-clamping-hub-on-horizontal-shaft';
  camRotor.add(hub);
  const rotationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 24, 16),
    whiteMaterial,
  );
  rotationIndex.position.set(
    camBackX + 0.045,
    camOuterRadius * 0.72,
    0,
  );
  rotationIndex.userData.role = 'white-index-on-visible-rear-cam-face';
  camRotor.add(rotationIndex);

  const follower = new THREE.Group();
  follower.userData.axis = followerDirection.clone();
  follower.userData.role = 'inclined-guided-output-rod-and-rounded-shoe';
  follower.quaternion.setFromUnitVectors(Y_AXIS, followerDirection);
  root.add(follower);
  const contactShoe = new THREE.Mesh(
    new THREE.SphereGeometry(shoeRadius, 32, 20),
    bevelMaterial,
  );
  contactShoe.userData.role = 'rounded-shoe-bearing-on-beveled-circumference';
  follower.add(contactShoe);
  const followerRod = cylinderAlongY(
    rodRadius,
    rodLength,
    drivenMaterial,
    36,
  );
  followerRod.position.y = rodLength / 2 + shoeRadius * 0.52;
  followerRod.userData.role = 'straight-output-rod-sliding-only-along-its-axis';
  follower.add(followerRod);
  const translationIndex = cylinderAlongY(
    rodRadius + 0.022,
    0.1,
    whiteMaterial,
    36,
  );
  translationIndex.position.y = translationIndexDistance;
  translationIndex.userData.role = 'white-index-on-translating-rod';
  follower.add(translationIndex);

  const followerGuides = guideDistances.map((distance, index) => {
    const guide = sleeveAlongDirection({
      direction: followerDirection,
      innerRadius: guideInnerRadius,
      length: guideLength,
      material: frameMaterial,
      outerRadius: guideOuterRadius,
      role: 'fixed-split-bearing-for-inclined-output-rod',
    });
    guide.position.copy(sourceShoeCenter).addScaledVector(
      followerDirection,
      distance,
    );
    guide.userData.distanceFromSourceShoe = distance;
    guide.userData.index = index;
    root.add(guide);
    return guide;
  });
  const guideBackingStart = followerGuides[0].position.clone();
  const guideBackingEnd = followerGuides.at(-1).position.clone();
  guideBackingStart.z = -0.72;
  guideBackingEnd.z = -0.72;
  const guideBackingRail = makeBeam(
    guideBackingStart,
    guideBackingEnd,
    { color: PALETTE.frame, depth: 0.24, thickness: 0.15 },
  );
  guideBackingRail.userData.role = 'fixed-backing-rail-for-inclined-guides';
  root.add(guideBackingRail);
  const guideBrackets = followerGuides.map((guide, index) => {
    const bracket = makeBeam(
      guide.position.clone().setZ(-0.72),
      guide.position.clone().setZ(-0.24),
      { color: PALETTE.frame, depth: 0.18, thickness: 0.13 },
    );
    bracket.userData.index = index;
    bracket.userData.role = 'fixed-bracket-from-backing-rail-to-rod-guide';
    root.add(bracket);
    return bracket;
  });

  const bearingPositions = [-2.28, 2.28];
  const shaftBearings = bearingPositions.map((x, index) => {
    const bearing = sleeveAlongDirection({
      direction: X_AXIS,
      innerRadius: shaftRadius + 0.025,
      length: 0.46,
      material: frameMaterial,
      outerRadius: 0.34,
      role: 'fixed-bearing-for-horizontal-cam-shaft',
    });
    bearing.position.x = x;
    bearing.userData.index = index;
    root.add(bearing);
    return bearing;
  });
  const baseRail = makeBeam(
    new THREE.Vector3(-2.88, -2.58, -0.72),
    new THREE.Vector3(2.88, -2.58, -0.72),
    { color: PALETTE.frame, depth: 0.3, thickness: 0.18 },
  );
  baseRail.userData.role = 'fixed-base-beneath-beveled-cam';
  root.add(baseRail);
  const bearingPosts = shaftBearings.map((bearing, index) => {
    const post = makeBeam(
      new THREE.Vector3(bearing.position.x, -2.58, -0.72),
      new THREE.Vector3(bearing.position.x, 0, -0.18),
      { color: PALETTE.frame, depth: 0.25, thickness: 0.17 },
    );
    post.userData.index = index;
    post.userData.role = 'fixed-post-supporting-cam-shaft-bearing';
    root.add(post);
    return post;
  });
  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 20, 14),
    whiteMaterial,
  );
  contactMarker.userData.role = 'visible-bevel-to-shoe-contact-marker';
  root.add(contactMarker);

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    baseRail,
    bearingPosts,
    bevelFace,
    camAssembly,
    camBody,
    camRotor,
    contactMarker,
    contactShoe,
    follower,
    followerGuides,
    followerRod,
    frontWavyEdge,
    guideBackingRail,
    guideBrackets,
    hub,
    rearEdge,
    rotationIndex,
    shaft,
    shaftBearings,
    translationIndex,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.38, -2.82, -1.2),
    new THREE.Vector3(2.92, 4.02, 2.25),
  );
  root.userData.geometry = {
    bevelAngle,
    bevelInnerRadius,
    bevelSurfaceOffset,
    bevelTiltCoefficient,
    camBackX,
    camCenter: camCenter.clone(),
    camFrontX,
    camOuterRadius,
    camSegments,
    followerDirection: followerDirection.clone(),
    guideDistances: [...guideDistances],
    guideInnerRadius,
    guideLength,
    guideOuterRadius,
    guideRunningClearance,
    hubLength,
    hubRadius,
    outputStroke,
    planeNormalMagnitude,
    rodLength,
    rodRadius,
    shaftLength,
    shaftRadius,
    shoeRadius,
    sourceShoeCenter: sourceShoeCenter.clone(),
    sourceSurfacePoint: sourceSurfacePoint.clone(),
    translationIndexDistance,
  };
  root.userData.mechanism =
    'one-horizontal-shaft-rotates-one-circular-disk-whose-annular-front-circumference-is-cut-as-an-oblique-bevel; one-gravity-preloaded-rod-slides-only-along-two-fixed-inclined-guides-while-its-rounded-shoe-follows-the-rotating-bevel-plane';
  root.userData.movement = movement;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason:
      'The official Movement 272 page labels the animation unavailable; the rotating oblique bevel and inclined follower contact were reconstructed from the public-domain engraving and description.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate272: {
      imageHeight: 525,
      imageWidth: 525,
      inferredPreload:
        'gravity along the descending inclined guide keeps the rod shoe on the unilateral bevel face',
      inferredTopology:
        'one horizontal shaft, one circular disk with a wavy oblique annular face, one inclined sliding rod, and two split guide stations',
      measurementUncertaintyPixels: 7,
      officialAnimationAvailable: false,
      rasterCam: {
        center: { x: 337, y: 344 },
        lowerFrontEdge: { x: 270, y: 451 },
        outerRadius: 140,
        upperFrontEdge: { x: 292, y: 205 },
      },
      rasterFollower: {
        contact: { x: 292, y: 209 },
        farEnd: { x: 70, y: 57 },
        guideStations: [
          { x: 119, y: 105 },
          { x: 237, y: 188 },
        ],
      },
      rasterShaft: {
        axisY: 344,
        leftEndX: 157,
        rightEndX: 490,
      },
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 69,
      edition: 21,
      illustrationPage: 68,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cyclePeriod,
    driverAngularSpeed,
    sourceDriverAngle,
  };
  root.userData.transmission = {
    contactLaw:
      'intersection-of-the-fixed-follower-centerline-with-the-rotating-shoe-offset-bevel-plane',
    followerMotion: 'reciprocating-rectilinear-along-one-fixed-inclined-axis',
    inputMotion: 'continuous-rotation-about-one-fixed-horizontal-axis',
    outputStroke,
    preload: 'gravity-maintained-unilateral-contact',
    stateAtDriverAngle,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    camRotor.rotation.x = state.driverAngle;
    follower.position.copy(state.shoeCenter);
    follower.userData.velocity = state.shoeVelocity.clone();
    camAssembly.userData.angularSpeed = state.driverAngularSpeed;
    shaft.userData.angularSpeed = state.driverAngularSpeed;
    follower.userData.speed = state.displacementSpeed;
    contactMarker.position.copy(state.contactPoint);
    root.userData.contacts = {
      bevelToFollowerShoe: {
        bevelPlaneError: state.bevelPlaneError,
        contactPoint: state.contactPoint.clone(),
        innerRadialClearance: state.contactRadiusInnerClearance,
        normal: state.outwardNormal.clone(),
        normalVelocityError: state.normalVelocityError,
        outerRadialClearance: state.contactRadiusOuterClearance,
        shoePlaneGap: state.shoePlaneGap,
      },
      followerGuides: followerGuides.map((guide, index) => ({
        axis: followerDirection.clone(),
        center: guide.position.clone(),
        index,
        radialClearance: guideRunningClearance,
        rotationError: 0,
      })),
      shaftBearings: shaftBearings.map((bearing, index) => ({
        axis: X_AXIS.clone(),
        center: bearing.position.clone(),
        index,
        radialClearance: bearing.userData.innerRadius - shaftRadius,
      })),
    };
    root.userData.kinematics = state;
  };
  update(0);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(6.3, 4.5, 10.8),
  };
}

export function createAuthoredBeveledCamMovement(movement) {
  if (movement.id !== 272) return null;
  const result = beveledDiskInclinedFollower(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
