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

// Brown's plate 272 shows a thick disk whose circumference is bevelled to a
// cone narrowing toward the rear, and whose front face is a trough: seen from
// the side its edge is the wavy line joining the cone to the face. The face
// height depends only on the cam-local y coordinate, x = H(y), so the side
// silhouette of the face is exactly that wavy rim line.
function troughFaceX(y, profile) {
  return profile.centerX - profile.depth * (y / profile.referenceRadius) ** 2;
}

function rimRadiusAtAngle(angle, profile) {
  // Intersect the trough with the cone rho = backRadius + (backX - x) * slope.
  const c2 = Math.cos(angle) ** 2;
  const quadratic = profile.depth * profile.slope * c2
    / profile.referenceRadius ** 2;
  const constant = profile.backRadius
    + profile.slope * (profile.backX - profile.centerX);
  if (quadratic < 1e-12) return constant;
  return (1 - Math.sqrt(1 - 4 * quadratic * constant)) / (2 * quadratic);
}

function wavyConeDiskGeometry(profile, segments, rings = 24) {
  const positions = [];
  const indices = [];
  const facePoint = (angle, fraction) => {
    const rho = rimRadiusAtAngle(angle, profile) * fraction;
    const y = rho * Math.cos(angle);
    return [troughFaceX(y, profile), y, rho * Math.sin(angle)];
  };
  positions.push(troughFaceX(0, profile), 0, 0);
  for (let ring = 1; ring <= rings; ring += 1) {
    for (let index = 0; index < segments; index += 1) {
      positions.push(...facePoint(FULL_TURN * index / segments, ring / rings));
    }
  }
  const backRingStart = positions.length / 3;
  for (let index = 0; index < segments; index += 1) {
    const angle = FULL_TURN * index / segments;
    positions.push(
      profile.backX,
      profile.backRadius * Math.cos(angle),
      profile.backRadius * Math.sin(angle),
    );
  }
  const backCenter = positions.length / 3;
  positions.push(profile.backX, 0, 0);
  const ringStart = (ring) => 1 + (ring - 1) * segments;
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    indices.push(0, ringStart(1) + index, ringStart(1) + next);
    for (let ring = 1; ring < rings; ring += 1) {
      const a = ringStart(ring) + index;
      const b = ringStart(ring) + next;
      const c = ringStart(ring + 1) + index;
      const d = ringStart(ring + 1) + next;
      indices.push(a, c, d, a, d, b);
    }
    const rimA = ringStart(rings) + index;
    const rimB = ringStart(rings) + next;
    const backA = backRingStart + index;
    const backB = backRingStart + next;
    indices.push(rimA, backA, backB, rimA, backB, rimB);
    indices.push(backCenter, backB, backA);
  }
  // Wind every triangle outward.
  for (let offset = 0; offset < indices.length; offset += 3) {
    [indices[offset + 1], indices[offset + 2]] = [indices[offset + 2], indices[offset + 1]];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.closedSolid = true;
  return geometry;
}

function troughFaceBandGeometry(profile, segments, innerFraction, rings = 10) {
  const positions = [];
  const indices = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    const fraction = innerFraction + (1 - innerFraction) * ring / rings;
    for (let index = 0; index < segments; index += 1) {
      const angle = FULL_TURN * index / segments;
      const rho = rimRadiusAtAngle(angle, profile) * fraction;
      const y = rho * Math.cos(angle);
      positions.push(troughFaceX(y, profile), y, rho * Math.sin(angle));
    }
  }
  for (let ring = 0; ring < rings; ring += 1) {
    for (let index = 0; index < segments; index += 1) {
      const next = (index + 1) % segments;
      const a = ring * segments + index;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + index;
      const d = (ring + 1) * segments + next;
      indices.push(a, c, d, a, d, b);
    }
  }
  for (let offset = 0; offset < indices.length; offset += 3) {
    [indices[offset + 1], indices[offset + 2]] = [indices[offset + 2], indices[offset + 1]];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function beveledDiskInclinedFollower(movement) {
  const root = new THREE.Group();
  const camCenter = new THREE.Vector3(0, 0, 0);
  const camOuterRadius = 2.02;
  const camFrontX = -0.78;
  const camBackX = 0.48;
  // The trough is 0.36 deep between the side rim (x = -0.42) and the top and
  // bottom rim (x = -0.78), measured from the plate's wavy edge.
  const troughDepth = 0.36;
  const followerDirection = new THREE.Vector3(-0.839, 0.544, 0).normalize();
  // The circumference is bevelled parallel to the inclined rod.
  const bevelSlope = -followerDirection.y / followerDirection.x;
  const bevelAngle = Math.atan(bevelSlope);
  const faceProfile = {
    backRadius: camOuterRadius - bevelSlope * (camBackX - camFrontX),
    backX: camBackX,
    centerX: camFrontX + troughDepth,
    depth: troughDepth,
    referenceRadius: camOuterRadius,
    slope: bevelSlope,
  };
  const camBackRadius = faceProfile.backRadius;
  const camSegments = 128;
  const workingBandInnerFraction = 0.62;
  const shaftRadius = 0.13;
  const shaftLength = 5.7;
  const hubRadius = 0.34;
  const hubLength = 0.36;
  const shoeRadius = 0.16;
  const rodRadius = 0.15;
  const rodLength = 4.05;
  const translationIndexDistance = 3.15;
  const guideRunningClearance = 0.025;
  const guideInnerRadius = rodRadius + guideRunningClearance;
  const guideOuterRadius = 0.34;
  const guideLength = 0.42;
  const guideDistances = [1.18, 2.55];
  const sourceContactRadius = 1.84;
  // Nominal running clearance covering the faceted rendered face.
  const contactClearance = 0.0005;
  const faceX = (y) => troughFaceX(y, faceProfile);
  const faceSlope = (y) => -2 * troughDepth * y / camOuterRadius ** 2;
  const sourceSurfacePoint = new THREE.Vector3(
    faceX(sourceContactRadius),
    sourceContactRadius,
    0,
  );
  const sourceOutwardNormal = new THREE.Vector3(
    -1,
    faceSlope(sourceContactRadius),
    0,
  ).normalize();
  const sourceShoeCenter = sourceSurfacePoint.clone().addScaledVector(
    sourceOutwardNormal,
    shoeRadius + contactClearance,
  );
  const driverAngularSpeed = -0.82;
  const cyclePeriod = FULL_TURN / Math.abs(driverAngularSpeed);
  const sourceDriverAngle = 0;
  const boundaryEpsilon = 1e-7;

  // The face is a cylinder along the cam-local z axis, so the nearest face
  // point to a local point lies in its own local (x, y) section: solve the
  // one-dimensional nearest point on x = H(y) by Newton iteration.
  const nearestFacePoint = (local) => {
    let y = local.y;
    for (let iteration = 0; iteration < 30; iteration += 1) {
      const x = faceX(y);
      const slope = faceSlope(y);
      const curvature = -2 * troughDepth / camOuterRadius ** 2;
      const gradient = (x - local.x) * slope + (y - local.y);
      const hessian = slope ** 2 + (x - local.x) * curvature + 1;
      const step = gradient / hessian;
      y -= step;
      if (Math.abs(step) < 1e-15) break;
    }
    const point = new THREE.Vector3(faceX(y), y, local.z);
    const signedDistance = point.distanceTo(local)
      * (local.x < faceX(local.y) ? 1 : -1);
    return { point, signedDistance };
  };
  const toCamLocal = (point, driverAngle) => point.clone()
    .applyAxisAngle(X_AXIS, -driverAngle);
  const shoeGapAt = (driverAngle, displacement) => {
    const center = sourceShoeCenter.clone().addScaledVector(
      followerDirection,
      displacement,
    );
    return nearestFacePoint(toCamLocal(center, driverAngle)).signedDistance
      - shoeRadius - contactClearance;
  };
  const solveDisplacement = (driverAngle) => {
    let low = -1.2;
    let high = 0.6;
    for (let iteration = 0; iteration < 200; iteration += 1) {
      const middle = (low + high) / 2;
      if (shoeGapAt(driverAngle, middle) > 0) high = middle;
      else low = middle;
      if (high - low < 1e-15) break;
    }
    return (low + high) / 2;
  };
  const derivativeStep = 1e-4;

  const stateAtDriverAngle = (driverAngle) => {
    const displacement = solveDisplacement(driverAngle);
    const before = solveDisplacement(driverAngle - derivativeStep);
    const after = solveDisplacement(driverAngle + derivativeStep);
    const displacementPerRadian = (after - before) / (2 * derivativeStep);
    const displacementSecondPerRadian = (after - 2 * displacement + before)
      / derivativeStep ** 2;
    const displacementSpeed = displacementPerRadian * driverAngularSpeed;
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
    const nearest = nearestFacePoint(toCamLocal(shoeCenter, driverAngle));
    const localContactPoint = nearest.point;
    const contactPoint = localContactPoint.clone()
      .applyAxisAngle(X_AXIS, driverAngle);
    const outwardNormal = shoeCenter.clone().sub(contactPoint).normalize();
    const contactRadius = Math.hypot(localContactPoint.y, localContactPoint.z);
    const localContactAngle = Math.atan2(
      localContactPoint.z,
      localContactPoint.y,
    );
    const camSurfaceVelocity = new THREE.Vector3().crossVectors(
      X_AXIS,
      contactPoint,
    ).multiplyScalar(driverAngularSpeed);
    const relativeVelocity = shoeVelocity.clone().sub(camSurfaceVelocity);
    const normalizedDriverAngle = THREE.MathUtils.euclideanModulo(
      driverAngle,
      FULL_TURN,
    );
    const atDeadCenter = Math.abs(displacementPerRadian) < boundaryEpsilon;
    const outerDead = Math.abs(Math.sin(driverAngle)) < 0.5;
    return {
      atDeadCenter,
      bevelPlaneError: Math.abs(localContactPoint.x - faceX(localContactPoint.y)),
      camSurfaceVelocity,
      contactPoint,
      contactRadius,
      contactRadiusOuterClearance: rimRadiusAtAngle(localContactAngle, faceProfile)
        - contactRadius,
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
      relativeVelocity,
      shoeAcceleration,
      shoeCenter,
      shoePlaneGap: Math.abs(shoeCenter.distanceTo(contactPoint) - shoeRadius
        - contactClearance),
      shoeVelocity,
      stage: atDeadCenter && outerDead
        ? 'rod-outer-dead-center'
        : atDeadCenter
          ? 'rod-inner-dead-center'
          : displacementSpeed > 0
            ? 'rod-moving-outward-along-inclined-guides'
            : 'rod-moving-inward-toward-beveled-cam',
    };
  };
  const stateAtTime = (time) => stateAtDriverAngle(
    sourceDriverAngle + driverAngularSpeed * time,
  );
  const outerDeadCenter = stateAtDriverAngle(0);
  const innerDeadCenter = stateAtDriverAngle(Math.PI / 2);
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
  // Offset depth testing, not the physical face: avoid z-fighting without
  // lifting the visible working surface into the tangent shoe.
  bevelMaterial.polygonOffset = true;
  bevelMaterial.polygonOffsetFactor = -1;
  bevelMaterial.polygonOffsetUnits = -1;
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
    wavyConeDiskGeometry(faceProfile, camSegments),
    driverMaterial,
  );
  camBody.userData.role = 'solid-disk-with-bevelled-rim-and-wavy-trough-face';
  camRotor.add(camBody);
  const bevelFace = new THREE.Mesh(
    troughFaceBandGeometry(faceProfile, camSegments, workingBandInnerFraction),
    bevelMaterial,
  );
  bevelFace.userData.innerFraction = workingBandInnerFraction;
  bevelFace.userData.role = 'wavy-working-band-of-trough-face';
  camRotor.add(bevelFace);
  // Brown's wavy line and rear circle are the inked edges of the solid
  // disk; the shaded 3D edges show them, so no dark edge tubes are added.
  const shaft = cylinderAlongX(
    shaftRadius,
    shaftLength,
    darkMaterial,
    44,
  );
  shaft.userData.role = 'continuous-horizontal-input-shaft';
  camRotor.add(shaft);
  // Brown draws the clamping collar behind the disk only.
  const hub = cylinderAlongX(hubRadius, hubLength, darkMaterial, 48);
  hub.position.x = camBackX + hubLength / 2 - 0.02;
  hub.userData.role = 'cam-clamping-hub-on-horizontal-shaft';
  camRotor.add(hub);
  const rotationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 24, 16),
    whiteMaterial,
  );
  rotationIndex.position.set(
    camBackX + 0.045,
    camBackRadius * 0.6,
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
    guideBackingRail,
    guideBrackets,
    hub,
    rotationIndex,
    shaft,
    shaftBearings,
    translationIndex,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.85, -2.82, -2.12),
    new THREE.Vector3(2.95, 4.35, 2.12),
  );
  root.userData.geometry = {
    bevelAngle,
    bevelSlope,
    camBackRadius,
    camBackX,
    camCenter: camCenter.clone(),
    camFrontX,
    camOuterRadius,
    camSegments,
    contactClearance,
    followerDirection: followerDirection.clone(),
    guideDistances: [...guideDistances],
    guideInnerRadius,
    guideLength,
    guideOuterRadius,
    guideRunningClearance,
    hubLength,
    hubRadius,
    outputStroke,
    faceProfile: { ...faceProfile },
    rodLength,
    rodRadius,
    shaftLength,
    shaftRadius,
    shoeRadius,
    sourceShoeCenter: sourceShoeCenter.clone(),
    sourceSurfacePoint: sourceSurfacePoint.clone(),
    translationIndexDistance,
    troughDepth,
    workingBandInnerFraction,
  };
  root.userData.mechanism =
    'one-horizontal-shaft-rotates-one-circular-disk-whose-circumference-is-bevelled-parallel-to-the-rod-and-whose-front-face-is-a-wavy-trough; one-gravity-preloaded-rod-slides-only-along-two-fixed-inclined-guides-while-its-rounded-shoe-follows-the-wavy-face-twice-per-turn';
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
  root.userData.faceXAtLocalY = faceX;
  root.userData.rimRadiusAtAngle = (angle) => rimRadiusAtAngle(angle, faceProfile);
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cyclePeriod,
    driverAngularSpeed,
    sourceDriverAngle,
  };
  root.userData.transmission = {
    contactLaw:
      'rounded-shoe-held-at-its-radius-from-the-rotating-trough-face-along-the-fixed-rod-axis',
    strokesPerRevolution: 2,
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
  root.userData.hideGround = true;
  root.traverse(object => {
    for (const material of object.material ? [].concat(object.material) : []) material.fog = false;
  });
  markShadows(root);
  bevelFace.castShadow = false;
  // Brown draws neither index marks nor a contact marker.
  for (const marker of [rotationIndex, translationIndex, contactMarker]) marker.visible = false;
  // Side elevation like the plate: shaft across the view, rod in its plane,
  // seen a little from the front so the wavy face shows.
  root.userData.cameraFov = 10;
  root.userData.reconstructionNote = 'The disk rim is a cone parallel to the rod and the front face a trough whose edge is Brown\'s wavy line, so the rod rises and falls twice per turn. The shoe/face contact is solved numerically on the finite trough; the gravity preload is assumed and friction and loads are not simulated.';
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(-0.12, 0.07, 1),
  };
}

export function createAuthoredBeveledCamMovement(movement) {
  if (movement.id !== 272) return null;
  const result = beveledDiskInclinedFollower(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
