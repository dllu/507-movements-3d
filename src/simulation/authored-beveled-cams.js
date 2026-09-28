import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';
import { creaseIndexedNormals } from './crease-normals.js';

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

// Brown's plate 272 shows a thick disk on a horizontal shaft. Its front face
// is a trough whose rim, seen from the side, is his first wavy line; a narrow
// chamfer (the band between his two wavy lines) runs from that rim out to
// the peak edge, and the circumference behind the peak is bevelled back to a
// flat rear face. The rod's end bears on the chamfer, whose section at the
// top of the disk is drawn square to the rod: the chamfer generator is
// perpendicular to the rod and the bevel cone parallel to it. The face height
// depends only on the cam-local y coordinate, x = H(y).
function troughFaceX(y, profile) {
  return profile.centerX - profile.depth * (y / profile.referenceRadius) ** 2;
}

// Radius at which the face meets the chamfer at material angle psi (from
// the cam-local +y axis). The chamfer generator of length L runs from that
// rim point along (a, b) in (x, radius) and ends on the fixed bevel cone
// radius = peakRadius - slope * (x - peakTopX): a quadratic in the radius.
function chamferInnerRadiusAtAngle(angle, profile) {
  const { chamferAxial: a, chamferRadial: b, chamferLength: length } = profile;
  const quadratic = profile.slope * profile.depth * Math.cos(angle) ** 2
    / profile.referenceRadius ** 2;
  const constant = b * length - profile.peakRadius
    + profile.slope * (profile.centerX + a * length - profile.peakTopX);
  // Root of q r^2 - r - K = 0 near r = -K, in the cancellation-free form.
  return -2 * constant / (1 + Math.sqrt(1 + 4 * quadratic * constant));
}

function chamferSection(angle, profile) {
  const innerRadius = chamferInnerRadiusAtAngle(angle, profile);
  const innerX = troughFaceX(innerRadius * Math.cos(angle), profile);
  return {
    innerRadius,
    innerX,
    outerRadius: innerRadius + profile.chamferRadial * profile.chamferLength,
    outerX: innerX + profile.chamferAxial * profile.chamferLength,
  };
}

function wavyChamferedDiskGeometry(profile, segments, rings = 24) {
  const positions = [];
  const indices = [];
  const sections = Array.from({ length: segments }, (_, index) => {
    const angle = FULL_TURN * index / segments;
    return { angle, ...chamferSection(angle, profile) };
  });
  positions.push(troughFaceX(0, profile), 0, 0);
  for (let ring = 1; ring <= rings; ring += 1) {
    for (const { angle, innerRadius } of sections) {
      const rho = innerRadius * ring / rings;
      const y = rho * Math.cos(angle);
      positions.push(troughFaceX(y, profile), y, rho * Math.sin(angle));
    }
  }
  // Chamfer rings out to the peak edge (the chamfer's outer edge on the
  // bevel cone); the intermediate rings lie on the straight generators.
  const chamferRows = 8;
  const chamferRingStart = positions.length / 3;
  for (let row = 1; row <= chamferRows; row += 1) {
    const t = row / chamferRows;
    for (const { angle, innerRadius, innerX, outerRadius, outerX } of sections) {
      const radius = innerRadius + (outerRadius - innerRadius) * t;
      positions.push(innerX + (outerX - innerX) * t,
        radius * Math.cos(angle), radius * Math.sin(angle));
    }
  }
  const peakRingStart = chamferRingStart + (chamferRows - 1) * segments;
  const backRingStart = positions.length / 3;
  for (const { angle } of sections) {
    positions.push(profile.backX, profile.backRadius * Math.cos(angle),
      profile.backRadius * Math.sin(angle));
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
    for (let row = 0; row < chamferRows; row += 1) {
      const lower = row === 0 ? ringStart(rings) : chamferRingStart + (row - 1) * segments;
      const upper = chamferRingStart + row * segments;
      indices.push(lower + index, upper + index, upper + next,
        lower + index, upper + next, lower + next);
    }
    const peakA = peakRingStart + index;
    const peakB = peakRingStart + next;
    const backA = backRingStart + index;
    const backB = backRingStart + next;
    indices.push(peakA, backA, backB, peakA, backB, peakB);
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

function beveledDiskInclinedFollower(movement) {
  const root = new THREE.Group();
  const camCenter = new THREE.Vector3(0, 0, 0);
  const camOuterRadius = 2.02;
  // The trough is 0.36 deep between the side rim and the top and bottom rim,
  // measured from the plate's wavy edge.
  const troughDepth = 0.36;
  const troughCenterX = -0.42;
  const followerDirection = new THREE.Vector3(-0.839, 0.544, 0).normalize();
  // The circumference is bevelled parallel to the inclined rod, and the
  // chamfer the rod bears on is square to it.
  const bevelSlope = -followerDirection.y / followerDirection.x;
  const bevelAngle = Math.atan(bevelSlope);
  const chamferAxial = followerDirection.y;
  const chamferRadial = -followerDirection.x;
  // Brown's band is about 0.28 of the disk radius along its slant.
  const chamferLength = 0.56;
  const topInnerRadius = camOuterRadius - chamferRadial * chamferLength;
  const camFrontX = troughCenterX - troughDepth;
  const peakTopX = camFrontX + chamferAxial * chamferLength;
  // Brown's rear face is about two thirds of the disk's height.
  const camBackRadius = camOuterRadius * 0.66;
  const camBackX = peakTopX + (camOuterRadius - camBackRadius) / bevelSlope;
  const faceProfile = {
    backRadius: camBackRadius,
    backX: camBackX,
    centerX: troughCenterX,
    chamferAxial,
    chamferLength,
    chamferRadial,
    depth: troughDepth,
    peakRadius: camOuterRadius,
    peakTopX,
    referenceRadius: topInnerRadius,
    slope: bevelSlope,
  };
  const camSegments = 128;
  // Brown's shaft is about 22 px across on a 280 px disk; his collar is
  // about 65 px across and 18 px long.
  const shaftRadius = 0.16;
  const shaftLength = 5.7;
  const hubRadius = 0.46;
  const hubLength = 0.3;
  // The rod's end is a shallow dome (a cap of a 0.6 sphere across the
  // rod's 0.15 radius, 0.019 high), so it reads as Brown's square end yet
  // bears smoothly on the chamfer as its section tilts with the wave.
  // Brown's output rod is a broad flat bar (about 26 px across in the plate,
  // 0.38 of the disk's thickness). Its end is crowned: the same 0.6 sphere
  // clipped to the bar's section, so the working contact is unchanged. The
  // bar is 0.30 deep so the contact, which wanders up to 0.127 across the
  // bar's depth as the wave passes, stays on its end.
  const tipSphereRadius = 0.6;
  const rodWidth = 0.4;
  const rodDepth = 0.3;
  const rodRadius = rodDepth / 2;
  const tipCapHalfAngle = Math.asin(Math.hypot(rodWidth, rodDepth) / 2 / tipSphereRadius);
  const tipCapBaseOffset = tipSphereRadius * Math.cos(tipCapHalfAngle);
  const rodLength = 4.05;
  const translationIndexDistance = 3.15;
  const guideRunningClearance = 0.025;
  const guideInnerRadius = rodRadius + guideRunningClearance;
  // Square guide blocks: a rectangular frame round the bar, its hatched
  // blocks about 0.2 thick above and below the bar as Brown draws them.
  const guideWall = 0.2;
  const guideSideWall = 0.08;
  const guideOuterRadius = rodWidth / 2 + guideRunningClearance + guideWall;
  const guideLength = 0.38;
  // Guide stations measured along the rod from the tip-dome centre (1.34
  // and 2.71 from the rod's end, as drawn).
  const guideDistances = [0.74, 2.11];
  // Nominal running clearance covering the faceted rendered chamfer.
  const contactClearance = 0.0005;
  const faceX = (y) => troughFaceX(y, faceProfile);
  const sourceSection = chamferSection(0, faceProfile);
  // At the source pose the rod's axis meets the chamfer mid-slant at the top.
  const sourceSurfacePoint = new THREE.Vector3(
    sourceSection.innerX + chamferAxial * chamferLength / 2,
    sourceSection.innerRadius + chamferRadial * chamferLength / 2,
    0,
  );
  const sourceOutwardNormal = followerDirection.clone();
  const sourceShoeCenter = sourceSurfacePoint.clone().addScaledVector(
    sourceOutwardNormal,
    tipSphereRadius + contactClearance,
  );
  const driverAngularSpeed = -0.82;
  const cyclePeriod = FULL_TURN / Math.abs(driverAngularSpeed);
  const sourceDriverAngle = 0;
  const boundaryEpsilon = 1e-7;

  // Nearest point of the chamfer to a cam-local point: each material angle
  // contributes one straight generator segment; golden-section search over
  // the angle near the point's own angle.
  const generatorAt = (angle) => {
    const section = chamferSection(angle, faceProfile);
    const c = Math.cos(angle);
    const sn = Math.sin(angle);
    return {
      direction: new THREE.Vector3(chamferAxial, chamferRadial * c,
        chamferRadial * sn),
      start: new THREE.Vector3(section.innerX, section.innerRadius * c,
        section.innerRadius * sn),
    };
  };
  const nearestOnGenerator = (local, angle) => {
    const { direction, start } = generatorAt(angle);
    const along = THREE.MathUtils.clamp(
      local.clone().sub(start).dot(direction), 0, chamferLength);
    const point = start.addScaledVector(direction, along);
    return { along, angle, distance: point.distanceTo(local), point };
  };
  const nearestChamferPoint = (local) => {
    const center = Math.atan2(local.z, local.y);
    const ratio = (Math.sqrt(5) - 1) / 2;
    let low = center - 0.5;
    let high = center + 0.5;
    let first = high - ratio * (high - low);
    let second = low + ratio * (high - low);
    let firstValue = nearestOnGenerator(local, first).distance;
    let secondValue = nearestOnGenerator(local, second).distance;
    for (let iteration = 0; iteration < 70; iteration += 1) {
      if (firstValue < secondValue) {
        high = second;
        second = first;
        secondValue = firstValue;
        first = high - ratio * (high - low);
        firstValue = nearestOnGenerator(local, first).distance;
      } else {
        low = first;
        first = second;
        firstValue = secondValue;
        second = low + ratio * (high - low);
        secondValue = nearestOnGenerator(local, second).distance;
      }
    }
    return nearestOnGenerator(local, (low + high) / 2);
  };
  const toCamLocal = (point, driverAngle) => point.clone()
    .applyAxisAngle(X_AXIS, -driverAngle);
  const shoeGapAt = (driverAngle, displacement) => {
    const center = sourceShoeCenter.clone().addScaledVector(
      followerDirection,
      displacement,
    );
    return nearestChamferPoint(toCamLocal(center, driverAngle)).distance
      - tipSphereRadius - contactClearance;
  };
  const solveDisplacement = (driverAngle) => {
    let low = -0.8;
    let high = 0.4;
    for (let iteration = 0; iteration < 64; iteration += 1) {
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
    const nearest = nearestChamferPoint(toCamLocal(shoeCenter, driverAngle));
    const localContactPoint = nearest.point;
    const contactPoint = localContactPoint.clone()
      .applyAxisAngle(X_AXIS, driverAngle);
    const outwardNormal = shoeCenter.clone().sub(contactPoint).normalize();
    const contactRadius = Math.hypot(localContactPoint.y, localContactPoint.z);
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
    // Contact offset from the rod axis, within the tip dome's radius.
    const axisOffset = contactPoint.clone().sub(shoeCenter)
      .projectOnPlane(followerDirection).length();
    return {
      atDeadCenter,
      camSurfaceVelocity,
      chamferContactAlong: nearest.along,
      contactAngleFromRodAxis: outwardNormal.angleTo(followerDirection),
      contactAxisOffset: axisOffset,
      contactPoint,
      contactRadius,
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
      shoePlaneGap: Math.abs(shoeCenter.distanceTo(contactPoint)
        - tipSphereRadius - contactClearance),
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

  // Brown's disk has crisp edges: the wavy face, the chamfer (the band
  // between his two wavy lines), the bevel cone and the flat rear face meet
  // at creases, so shared rim vertices must not blend their normals into a
  // rounded, lens-like shading.
  const camBody = new THREE.Mesh(
    creaseIndexedNormals(wavyChamferedDiskGeometry(faceProfile, camSegments, 24), Math.PI / 8),
    driverMaterial,
  );
  camBody.userData.role = 'solid-disk-with-bevelled-rim-and-wavy-trough-face';
  camRotor.add(camBody);
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
  // The bar and its crowned end are one solid, centred on the follower
  // origin (the crown sphere's centre): a segmented box whose lower face is
  // pushed onto the sphere.
  const barTop = rodLength - tipCapBaseOffset + 0.02;
  const barGeometry = new THREE.BoxGeometry(rodWidth, 1, rodDepth, 16, 1, 12);
  {
    const position = barGeometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const z = position.getZ(i);
      position.setY(i, position.getY(i) > 0
        ? barTop
        : -Math.sqrt(tipSphereRadius ** 2 - x * x - z * z));
    }
    barGeometry.computeVertexNormals();
  }
  const contactShoe = new THREE.Mesh(barGeometry, drivenMaterial);
  contactShoe.userData.role = 'flat-output-bar-with-crowned-end-bearing-on-disk-chamfer';
  contactShoe.userData.width = rodWidth;
  contactShoe.userData.depth = rodDepth;
  follower.add(contactShoe);
  const followerRod = contactShoe;
  const translationIndex = cylinderAlongY(
    rodRadius + 0.022 + rodWidth / 2,
    0.1,
    whiteMaterial,
    36,
  );
  translationIndex.position.y = translationIndexDistance;
  translationIndex.userData.role = 'white-index-on-translating-rod';
  follower.add(translationIndex);

  const guideSection = new THREE.Shape();
  {
    const ow = rodWidth / 2 + guideRunningClearance + guideWall;
    const od = rodDepth / 2 + guideRunningClearance + guideSideWall;
    guideSection.moveTo(-ow, -od);
    guideSection.lineTo(ow, -od);
    guideSection.lineTo(ow, od);
    guideSection.lineTo(-ow, od);
    guideSection.closePath();
    const iw = rodWidth / 2 + guideRunningClearance;
    const id = rodDepth / 2 + guideRunningClearance;
    const bore = new THREE.Path();
    bore.moveTo(-iw, -id);
    bore.lineTo(-iw, id);
    bore.lineTo(iw, id);
    bore.lineTo(iw, -id);
    bore.closePath();
    guideSection.holes.push(bore);
  }
  const guideWidthAxis = new THREE.Vector3().crossVectors(Z_AXIS, followerDirection).normalize();
  const guideQuaternion = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(guideWidthAxis, Z_AXIS, followerDirection),
  );
  const followerGuides = guideDistances.map((distance, index) => {
    const guide = new THREE.Mesh(
      centeredExtrusion(guideSection, guideLength, 0.01),
      frameMaterial,
    );
    guide.quaternion.copy(guideQuaternion);
    guide.userData.innerRadius = guideInnerRadius;
    guide.userData.role = 'fixed-square-guide-block-for-inclined-output-bar';
    guide.position.copy(sourceShoeCenter).addScaledVector(
      followerDirection,
      distance,
    );
    guide.userData.distanceFromSourceShoe = distance;
    guide.userData.index = index;
    root.add(guide);
    return guide;
  });
  // Brown draws only the two guide stations on the rod and a bare shaft: no
  // base, posts, shaft bearings, backing rail or brackets (p62 support rule).
  // The guides and the shaft axis are fixed ideal constraints.
  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 20, 14),
    whiteMaterial,
  );
  contactMarker.userData.role = 'visible-bevel-to-shoe-contact-marker';
  root.add(contactMarker);

  root.userData.archetype = movement.archetype;
  root.userData.blocks = {
    camAssembly,
    camBody,
    camRotor,
    contactMarker,
    contactShoe,
    follower,
    followerGuides,
    followerRod,
    hub,
    rotationIndex,
    shaft,
    translationIndex,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.85, -2.3, -2.12),
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
    rodDepth,
    rodLength,
    rodRadius,
    rodWidth,
    shaftLength,
    shaftRadius,
    chamferLength,
    tipCapHalfAngle,
    tipSphereRadius,
    sourceShoeCenter: sourceShoeCenter.clone(),
    sourceSurfacePoint: sourceSurfacePoint.clone(),
    translationIndexDistance,
    troughDepth,
  };
  root.userData.mechanism =
    'one-horizontal-shaft-rotates-one-circular-disk-whose-circumference-is-bevelled-parallel-to-the-rod-and-whose-front-face-is-a-wavy-trough; one-gravity-preloaded-rod-slides-only-along-two-fixed-inclined-guides-while-its-domed-end-bears-on-the-wavy-chamfer-square-to-it-twice-per-turn';
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
  root.userData.chamferSectionAtAngle = (angle) => chamferSection(angle, faceProfile);
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cyclePeriod,
    driverAngularSpeed,
    sourceDriverAngle,
  };
  root.userData.transmission = {
    contactLaw:
      'domed-rod-end-held-at-its-radius-from-the-rotating-chamfer-along-the-fixed-rod-axis',
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
        chamferContactAlong: state.chamferContactAlong,
        contactPoint: state.contactPoint.clone(),
        normal: state.outwardNormal.clone(),
        normalVelocityError: state.normalVelocityError,
        shoePlaneGap: state.shoePlaneGap,
      },
      followerGuides: followerGuides.map((guide, index) => ({
        axis: followerDirection.clone(),
        center: guide.position.clone(),
        index,
        radialClearance: guideRunningClearance,
        rotationError: 0,
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
  // Brown draws neither index marks nor a contact marker.
  for (const marker of [rotationIndex, translationIndex, contactMarker]) marker.visible = false;
  // Side elevation like the plate: shaft across the view, rod in its plane,
  // seen a little from the front so the wavy face shows.
  root.userData.cameraFov = 10;
  root.userData.reconstructionNote = 'The front face is a trough whose rim is Brown\'s wavy line; a narrow chamfer square to the rod (the band between his two wavy lines) joins it to a rim bevelled parallel to the rod. The rod\'s end bears on that chamfer, which the wave carries along the rod, so the rod rises and falls twice per turn. The contact is solved numerically on the finite chamfer; the gravity preload is assumed and friction and loads are not simulated.';
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
