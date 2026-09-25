import {boredCylinderGeometry, fitPistonGuide} from './piston-guide-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeShaft,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function wrappedAngle(angle) {
  const turns = angle / FULL_TURN;
  if (Math.abs(turns - Math.round(turns)) < 1e-11) return 0;
  return THREE.MathUtils.euclideanModulo(angle, FULL_TURN);
}

function axialRotor(axis) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.quaternion.setFromUnitVectors(Z_AXIS, axis.clone().normalize());
  root.userData.axis = axis.clone().normalize();
  root.userData.rotor = rotor;
  root.add(rotor);
  return { root, rotor };
}

function cylinderAlongLocalZ({
  depth,
  material,
  radiusBottom,
  radiusTop = radiusBottom,
  radialSegments = 72,
}) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radiusTop,
      radiusBottom,
      depth,
      radialSegments,
      1,
      false,
    ),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function traversingRollerConeDrive(movement) {
  const root = new THREE.Group();
  root.scale.setScalar(0.88);

  const coneLength = 3.3;
  const coneLargeRadius = 1.45;
  const coneSmallRadius = 0.52;
  const coneLargeEndX = -coneLength / 2;
  const coneSmallEndX = coneLength / 2;
  // Brown's drum is a concave horn, not a straight cone: its radius falls
  // quickly from the large end and flattens toward the small end. The
  // quadratic generator r(x) = small + (large - small) * ((xs - x) / L)^2
  // matches the plate's end radii and its radius under the roller.
  const radiusDrop = coneLargeRadius - coneSmallRadius;
  const profileCurvature = 2 * radiusDrop / coneLength ** 2;
  const traverseAmplitude = 1.2;
  const meanContactRadius = coneSmallRadius
    + radiusDrop * (coneSmallEndX ** 2 + traverseAmplitude ** 2 / 2)
      / coneLength ** 2;
  const coneTurnsPerTraverse = 4;
  const rollerTurnsPerTraverse = 4;
  const rollerPitchRadius = coneTurnsPerTraverse
    * meanContactRadius / rollerTurnsPerTraverse;
  const rollerWidth = 0.22;
  const rollerTreadTubeRadius = 0.045;
  const rollerBodyRadius = rollerPitchRadius - rollerTreadTubeRadius;
  const sourceContactAxialPosition = 0.482;
  const sourceTraversePhase = Math.asin(
    sourceContactAxialPosition / traverseAmplitude,
  );
  const traversePeriod = 8;
  const traverseAngularFrequency = FULL_TURN / traversePeriod;
  const coneAngularSpeed = FULL_TURN
    * coneTurnsPerTraverse / traversePeriod;
  const coneRadiusAtAxialPosition = (axialPosition) => (
    coneSmallRadius
      + radiusDrop * ((coneSmallEndX - axialPosition) / coneLength) ** 2
  );
  const radiusSlopeAtAxialPosition = (axialPosition) => (
    -profileCurvature * (coneSmallEndX - axialPosition)
  );
  const generatorAxisAtAxialPosition = (axialPosition) => new THREE.Vector3(
    1,
    radiusSlopeAtAxialPosition(axialPosition),
    0,
  ).normalize();
  const surfaceNormalAtAxialPosition = (axialPosition) => new THREE.Vector3(
    -radiusSlopeAtAxialPosition(axialPosition),
    1,
    0,
  ).normalize();
  const contactPointAtAxialPosition = (axialPosition) => new THREE.Vector3(
    axialPosition,
    coneRadiusAtAxialPosition(axialPosition),
    0,
  );
  const coneGeneratorAxis = generatorAxisAtAxialPosition(
    sourceContactAxialPosition,
  );
  const coneSurfaceNormal = surfaceNormalAtAxialPosition(
    sourceContactAxialPosition,
  );
  // Brown's roller shaft keeps one slope (the generator tangent at his
  // contact station). The rounded tread rides the concave drum, so the
  // shaft only rises and falls parallel to itself, as a spring-pressed
  // shaft would; its axis never swings. The tread tube's centre stays one
  // tube radius out along the local drum normal, and the roller centre lies
  // one body radius beyond it along the fixed shaft normal.
  const treadCenterAtAxialPosition = (axialPosition) => (
    contactPointAtAxialPosition(axialPosition).addScaledVector(
      surfaceNormalAtAxialPosition(axialPosition),
      rollerTreadTubeRadius,
    )
  );
  const rollerCenterAtAxialPosition = (axialPosition) => (
    treadCenterAtAxialPosition(axialPosition).addScaledVector(
      coneSurfaceNormal,
      rollerBodyRadius,
    )
  );
  // d(center)/dx = (1 - t k / w^3) (1, r') for tread tube radius t.
  const rollerCenterVelocityPerAxialSpeed = (axialPosition) => {
    const slope = radiusSlopeAtAxialPosition(axialPosition);
    const scale = Math.hypot(1, slope);
    const factor = 1 - rollerTreadTubeRadius * profileCurvature / scale ** 3;
    return new THREE.Vector3(factor, factor * slope, 0);
  };

  const inputMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const rollerMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.56,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.46,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const coneAssembly = axialRotor(X_AXIS);
  const cone = coneAssembly.root;
  const coneRotor = coneAssembly.rotor;
  cone.userData.role = 'uniformly-rotating-conical-friction-drum';
  // Chords of a concave generator bulge outward; inset each vertex by the
  // chord sag so the faceted drum never stands proud of the true surface.
  const profileSamples = 64;
  const chordSag = profileCurvature
    * (coneLength / profileSamples) ** 2 / 8;
  const profilePoints = [new THREE.Vector2(0, coneLargeEndX)];
  for (let sample = 0; sample <= profileSamples; sample += 1) {
    const axial = coneLargeEndX + coneLength * sample / profileSamples;
    profilePoints.push(new THREE.Vector2(
      coneRadiusAtAxialPosition(axial) - chordSag,
      axial,
    ));
  }
  profilePoints.push(new THREE.Vector2(0, coneSmallEndX));
  const coneBody = new THREE.Mesh(
    new THREE.LatheGeometry(profilePoints, 112),
    inputMaterial,
  );
  coneBody.rotation.x = Math.PI / 2;
  coneBody.userData.role =
    'concave-generator-horn-shaped-friction-drum';
  coneRotor.add(coneBody);

  const coneHub = cylinderAlongLocalZ({
    depth: coneLength + 0.24,
    material: inkMaterial,
    radiusBottom: 0.19,
    radialSegments: 36,
  });
  coneHub.userData.role = 'cone-drum-hub-rigid-with-input-shaft';
  coneRotor.add(coneHub);

  const coneIndices = [
    { radius: coneLargeRadius, side: -1 },
    { radius: coneSmallRadius, side: 1 },
  ].map(({ radius, side }) => {
    const index = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.52, 0.055, 0.028),
      whiteMaterial,
    );
    index.position.set(
      radius * 0.38,
      0,
      side * (coneLength / 2 + 0.04),
    );
    index.userData.role = side < 0
      ? 'large-face-white-cone-speed-index'
      : 'small-face-white-cone-speed-index';
    coneRotor.add(index);
    return index;
  });

  const coneShaft = makeShaft({
    axis: X_AXIS,
    length: 5,
    radius: 0.075,
  });
  coneShaft.userData.role = 'constant-speed-horizontal-cone-input-shaft';

  const rollerAssembly = axialRotor(coneGeneratorAxis);
  // The roller's axle keeps Brown's fixed slope; the rounded tread follows
  // the concave drum.
  const roller = rollerAssembly.root;
  const rollerRotor = rollerAssembly.rotor;
  roller.userData.role =
    'fixed-slope-friction-roller-traversing-concave-drum';
  const rollerBody = cylinderAlongLocalZ({
    depth: rollerWidth,
    material: rollerMaterial,
    radiusBottom: rollerBodyRadius,
    radialSegments: 72,
  });
  rollerBody.geometry.dispose();
  rollerBody.geometry = boredCylinderGeometry(rollerBodyRadius, .061, rollerWidth);
  rollerBody.userData.role = 'thin-friction-roller-disk';
  rollerRotor.add(rollerBody);
  const rollerTread = new THREE.Mesh(
    new THREE.TorusGeometry(
      rollerBodyRadius,
      rollerTreadTubeRadius,
      // The drum touches the tread up to ~12 degrees off its lowest point.
      20,
      88,
    ),
    // The rounded tread is the roller's own edge, not an ink rim.
    rollerMaterial,
  );
  rollerTread.userData.role = 'round-friction-tread-touching-cone';
  rollerRotor.add(rollerTread);
  const rollerHub = cylinderAlongLocalZ({
    depth: rollerWidth + 0.18,
    material: inkMaterial,
    radiusBottom: 0.16,
    radialSegments: 32,
  });
  rollerHub.geometry.dispose();
  rollerHub.geometry = boredCylinderGeometry(.16, .061, rollerWidth + .18);
  rollerHub.userData.role = 'roller-hub-sliding-on-guide-shaft';
  rollerRotor.add(rollerHub);
  const rollerIndices = [-1, 1].map((side) => {
    const index = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 18, 12),
      whiteMaterial,
    );
    index.position.set(
      rollerPitchRadius * 0.58,
      0,
      side * (rollerWidth / 2 + 0.05),
    );
    index.userData.role = side < 0
      ? 'rear-white-variable-roller-speed-index'
      : 'front-white-variable-roller-speed-index';
    rollerRotor.add(index);
    return index;
  });

  // Plate 265 draws the roller shaft as one long line running past the
  // small end; it is the roller's own output axle at a fixed slope
  // (bearings undrawn), sliding endwise with the roller.
  const rollerGuideRear = 0.87;
  const rollerGuideFront = 3.05;
  const rollerGuideLength = rollerGuideRear + rollerGuideFront;
  const rollerGuide = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: rollerGuideLength,
    radius: 0.057,
  });
  rollerGuide.position.z = (rollerGuideFront - rollerGuideRear) / 2;
  rollerGuide.userData.role =
    'fixed-slope-roller-output-axle';
  roller.add(rollerGuide);

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.058, 18, 12),
    whiteMaterial,
  );
  contactMarker.userData.role = 'moving-no-slip-cone-roller-contact';

  root.add(
    cone,
    coneShaft,
    roller,
    contactMarker,
  );

  const stateAtTime = (time) => {
    const traversePhase = traverseAngularFrequency * time
      + sourceTraversePhase;
    const contactAxialPosition = traverseAmplitude * Math.sin(traversePhase);
    const contactAxialVelocity = traverseAmplitude
      * traverseAngularFrequency * Math.cos(traversePhase);
    const contactAxialAcceleration = -traverseAmplitude
      * traverseAngularFrequency ** 2 * Math.sin(traversePhase);
    const coneRadiusAtContact = coneRadiusAtAxialPosition(
      contactAxialPosition,
    );
    const coneRadiusRate = radiusSlopeAtAxialPosition(contactAxialPosition)
      * contactAxialVelocity;
    const coneAngleUnwrapped = coneAngularSpeed * time;
    // Exact integral of the quadratic radius along the sinusoidal traverse.
    const integratedContactRadius = meanContactRadius * time
      - 2 * radiusDrop * coneSmallEndX / coneLength ** 2
        * traverseAmplitude * (
          Math.cos(sourceTraversePhase) - Math.cos(traversePhase)
        ) / traverseAngularFrequency
      - radiusDrop * traverseAmplitude ** 2 / coneLength ** 2 * (
        Math.sin(2 * traversePhase) - Math.sin(2 * sourceTraversePhase)
      ) / (4 * traverseAngularFrequency);
    const rollerAngleUnwrapped = -coneAngularSpeed
      * integratedContactRadius / rollerPitchRadius;
    const rollerAngularSpeed = -coneAngularSpeed
      * coneRadiusAtContact / rollerPitchRadius;
    const rollerAngularAcceleration = -coneAngularSpeed
      * coneRadiusRate / rollerPitchRadius;
    const contactPoint = contactPointAtAxialPosition(contactAxialPosition);
    const surfaceNormal = surfaceNormalAtAxialPosition(contactAxialPosition);
    const generatorAxis = generatorAxisAtAxialPosition(contactAxialPosition);
    const rollerCenter = rollerCenterAtAxialPosition(contactAxialPosition);
    const treadCenter = treadCenterAtAxialPosition(contactAxialPosition);
    const rollerCenterVelocity = rollerCenterVelocityPerAxialSpeed(
      contactAxialPosition,
    ).multiplyScalar(contactAxialVelocity);
    // Endwise slide along the fixed shaft and parallel lift across it.
    const guideVelocity = rollerCenterVelocity.dot(coneGeneratorAxis);
    const shaftLiftVelocity = rollerCenterVelocity.dot(coneSurfaceNormal);
    const coneContactTangentialSpeed = coneAngularSpeed
      * coneRadiusAtContact;
    const rollerContactTangentialSpeed = -rollerAngularSpeed
      * rollerPitchRadius;
    return {
      coneAngle: wrappedAngle(coneAngleUnwrapped),
      coneAngleUnwrapped,
      coneAngularSpeed,
      coneContactTangentialSpeed,
      coneRadiusAtContact,
      coneRadiusRate,
      contactAxialAcceleration,
      contactAxialPosition,
      contactAxialVelocity,
      contactPoint,
      generatorAxis,
      guideVelocity,
      integratedContactRadius,
      noSlipTangentialError: rollerContactTangentialSpeed
        - coneContactTangentialSpeed,
      rollerAngle: wrappedAngle(rollerAngleUnwrapped),
      rollerAngleUnwrapped,
      rollerAngularAcceleration,
      rollerAngularSpeed,
      rollerCenter,
      rollerAxis: coneGeneratorAxis,
      rollerCenterVelocity,
      rollerContactTangentialSpeed,
      shaftLiftVelocity,
      treadCenter,
      speedRatio: rollerAngularSpeed / coneAngularSpeed,
      surfaceNormal,
      time,
      traversePhase,
    };
  };

  root.userData.archetype =
    'uniform-conical-drum-driving-generator-aligned-axially-traversing-friction-roller';
  root.userData.mechanism =
    'constant-speed-conical-drum-friction-drives-one-generator-axis-roller-whose-smooth-lengthwise-traverse-varies-output-speed-in-direct-proportion-to-local-cone-radius';
  root.userData.blocks = {
    cone,
    coneBody,
    coneHub,
    coneIndices,
    coneRotor,
    coneShaft,
    contactMarker,
    roller,
    rollerBody,
    rollerGuide,
    rollerHub,
    rollerIndices,
    rollerRotor,
    rollerTread,
  };
  root.userData.canonicalTimes = {
    cycleClosure: traversePeriod,
    firstLargeEndReversal:
      (Math.PI * 3 / 2 - sourceTraversePhase) / traverseAngularFrequency,
    firstSmallEndReversal:
      (Math.PI / 2 - sourceTraversePhase) / traverseAngularFrequency,
    sourcePose: 0,
  };
  root.userData.contactDefinition = {
    contactPointAtAxialPosition,
    generatorAxisAtAxialPosition,
    rollerCenterAtAxialPosition,
    surfaceNormalAtAxialPosition,
    treadCenterAtAxialPosition,
    rollingLaw:
      'roller-angular-speed=-cone-angular-speed*local-cone-radius/roller-pitch-radius',
  };
  root.userData.driveSchedule = {
    coneInput: 'source-required-uniform-continuous-rotation',
    purpose:
      'a smooth periodic guide traverse demonstrates the full source variable-speed range without teleporting',
    sourcePrescribesTraverseSchedule: false,
    traverse: 'sinusoidal-reciprocation-with-zero-speed-at-both-ends',
  };
  root.userData.geometry = {
    coneAxis: X_AXIS.clone(),
    coneGeneratorAxis,
    coneLargeEndX,
    coneLargeRadius,
    coneLength,
    coneSmallEndX,
    coneSmallRadius,
    coneSurfaceNormal,
    meanContactRadius,
    profileCurvature,
    radiusDrop,
    radiusSlopeAtAxialPosition,
    rollerBodyRadius,
    rollerGuideLength,
    rollerPitchRadius,
    rollerTreadTubeRadius,
    rollerWidth,
    sourceContactAxialPosition,
    traverseAmplitude,
  };
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'the official movement 265 page marks its animation unavailable',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate265: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one horizontal concave horn-shaped drum, one thin edge-on friction roller, and one roller shaft parallel to the upper drum generator at the contact',
      measurementUncertaintyPixels: 7,
      officialAnimationAvailable: false,
      rasterConeLargeEnd: {
        bottom: 369,
        centerX: 75,
        centerY: 254,
        top: 139,
      },
      rasterConeSmallEnd: {
        bottom: 294,
        centerX: 335,
        centerY: 253,
        top: 212,
      },
      rasterContactPoint: { x: 243, y: 204 },
      rasterRollerCenter: { x: 260, y: 144 },
      rasterRollerShaftLine: {
        left: { x: 191, y: 126 },
        right: { x: 502, y: 202 },
      },
      rasterShaftEndpointsX: [13, 449],
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 67,
      edition: 21,
      illustrationPage: 66,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    coneTurnsPerTraverse,
    demonstrationPeriod: traversePeriod,
    rollerTurnsPerTraverse,
    traverseAngularFrequency,
  };
  root.userData.transmission = {
    coneAngularSpeed,
    coneRadiusAtAxialPosition,
    maximumSpeedRatioMagnitude: coneRadiusAtAxialPosition(
      -traverseAmplitude,
    ) / rollerPitchRadius,
    minimumSpeedRatioMagnitude: coneRadiusAtAxialPosition(
      traverseAmplitude,
    ) / rollerPitchRadius,
    rollerAngularSpeedAtAxialPosition: (axialPosition) => (
      -coneAngularSpeed
        * coneRadiusAtAxialPosition(axialPosition) / rollerPitchRadius
    ),
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(cone, state.coneAngle);
    setSpin(coneShaft, state.coneAngle);
    roller.position.copy(state.rollerCenter);
    roller.quaternion.setFromUnitVectors(Z_AXIS, coneGeneratorAxis);
    roller.userData.axis = coneGeneratorAxis.clone();
    setSpin(roller, state.rollerAngle);
    contactMarker.position.copy(state.contactPoint);
    cone.userData.angularSpeed = state.coneAngularSpeed;
    roller.userData.angularSpeed = state.rollerAngularSpeed;
    roller.userData.axialVelocity = state.guideVelocity;
    root.userData.contacts = {
      coneToTraversingRoller: {
        noSlipTangentialError: state.noSlipTangentialError,
        point: state.contactPoint,
        rollerCenter: state.rollerCenter,
      },
    };
    root.userData.kinematics = state;
  };
  contactMarker.visible = false;
  // Brown draws plain drum ends and a plain roller: no white speed marks.
  for (const index of [...coneIndices, ...rollerIndices]) index.visible = false;
  root.userData.minimumDisplayCycleSeconds = 8;
  root.userData.cameraFov = 8;
  root.userData.reconstructionNote = 'The roller traverses the concave drum while its circumferential speed follows the local radius. Its shaft keeps the plate\'s fixed slope and slides endwise with it; the rounded tread follows the concave drum, so the shaft rises and falls parallel to itself as a spring-pressed shaft would. Its bearings and spring are not drawn. The traverse is illustrative; sideways sliding is permitted at the contact.';
  fitPistonGuide(root, update, traversePeriod);
  markShadows(root);
  return {
    root,
    update,
    cameraDirection: new THREE.Vector3(-.75, .15, 14),
  };
}

export function createAuthoredConeFrictionDriveMovement(movement) {
  if (movement.id !== 265) return null;
  const result = traversingRollerConeDrive(movement);
  result.root.userData.fidelity = 'authored';
  return result;
}
