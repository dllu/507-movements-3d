import * as THREE from 'three';
import {correctReactionFerry} from './reaction-ferry-parts.js';
import {waterVolumeMaterial} from './water-volume.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function beamBetween(start, end, width, depth, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.y = -Math.atan2(delta.z, delta.x);
  return beam;
}

function horizontalRing(radius, tubeRadius, material) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 12, 48),
    material,
  );
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function makeBoatHull(material) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.bezierCurveTo(0.30, 0.58, 0.74, 0.78, 1.44, 0.82);
  shape.lineTo(2.38, 0.65);
  shape.quadraticCurveTo(2.72, 0.48, 2.75, 0);
  shape.quadraticCurveTo(2.72, -0.48, 2.38, -0.65);
  shape.lineTo(1.44, -0.82);
  shape.bezierCurveTo(0.74, -0.78, 0.30, -0.58, 0, 0);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.06,
    bevelThickness: 0.05,
    curveSegments: 24,
    depth: 0.34,
    steps: 1,
  });
  const hull = new THREE.Mesh(geometry, material);
  hull.rotation.x = Math.PI / 2;
  hull.position.y = 0.35;
  return hull;
}

function reactionFerry(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6.2;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  // The anchor lies on the river bed; its ring is the fixed centre of the
  // ferry's plan-view arc. The line rises from the ring to the bow, so its
  // true length is the plan radius combined with that constant rise.
  // Pass 56: the river is deeper (bed at -2.0) and the bed is solid earth,
  // so the anchor reads as lying on the bed well below the surface; the bow
  // stays at its old height, so the line rises the full depth to it.
  const riverBedY = -2.0;
  const anchorPoint = new THREE.Vector3(-3.72, riverBedY + 0.176, 0);
  const tetherLength = 2.92;
  const bowRise = 0.18 - anchorPoint.y;
  const ropeLength = Math.hypot(tetherLength, bowRise);
  const maximumTraverseAngle = THREE.MathUtils.degToRad(30);
  const maximumRudderAngle = THREE.MathUtils.degToRad(24);
  const boatCenterFromBow = 1.40;
  const sternFromBow = 2.68;
  const riverHalfWidth = 3.75;
  const waterY = -0.08;
  const groundY = -0.48;
  const streamSpeed = 1.15;

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const phase = THREE.MathUtils.euclideanModulo(
      inputAngle / FULL_TURN,
      1,
    );
    const cycleAngle = FULL_TURN * phase;
    const sine = Math.sin(cycleAngle);
    const cosine = Math.cos(cycleAngle);
    const traverseAngle = maximumTraverseAngle * sine;
    const traverseAngularSpeed = maximumTraverseAngle
      * cosine * inputSpeed;
    const traverseAngularAcceleration = maximumTraverseAngle * (
      -sine * inputSpeed ** 2 + cosine * inputAcceleration
    );
    const radial = new THREE.Vector3(
      Math.cos(traverseAngle),
      0,
      Math.sin(traverseAngle),
    );
    const tangent = new THREE.Vector3(
      -Math.sin(traverseAngle),
      0,
      Math.cos(traverseAngle),
    );
    const bowPoint = anchorPoint.clone().addScaledVector(
      radial,
      tetherLength,
    );
    bowPoint.y += bowRise;
    const boatCenter = bowPoint.clone().addScaledVector(
      radial,
      boatCenterFromBow,
    );
    const sternPoint = bowPoint.clone().addScaledVector(
      radial,
      sternFromBow,
    );
    const bowVelocity = tangent.clone().multiplyScalar(
      tetherLength * traverseAngularSpeed,
    );
    const bowAcceleration = radial.clone().multiplyScalar(
      -tetherLength * traverseAngularSpeed ** 2,
    ).addScaledVector(
      tangent,
      tetherLength * traverseAngularAcceleration,
    );
    const rudderAngle = maximumRudderAngle * cosine;
    const rudderAngularSpeed = -maximumRudderAngle
      * sine * inputSpeed;
    const rudderAngularAcceleration = -maximumRudderAngle * (
      cosine * inputSpeed ** 2 + sine * inputAcceleration
    );
    const crossingDirection = Math.abs(cosine) < 1e-12
      ? 'turning-at-bank'
      : cosine > 0
        ? 'crossing-toward-positive-bank'
        : 'crossing-toward-negative-bank';
    return {
      anchorPoint: anchorPoint.clone(),
      boatCenter,
      boatHeadingAngle: traverseAngle,
      bowAcceleration,
      bowPoint,
      bowVelocity,
      crossingDirection,
      inputAcceleration,
      inputAngle: cycleAngle,
      inputSpeed,
      phase,
      radial,
      rudderAngle,
      rudderAngularAcceleration,
      rudderAngularSpeed,
      sternPoint,
      streamVelocity: new THREE.Vector3(streamSpeed, 0, 0),
      tangent,
      tetherLength,
      traverseAngle,
      traverseAngularAcceleration,
      traverseAngularSpeed,
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
    inputAngularSpeed,
    0,
  );

  const bankMaterial = matte(0xa49a83, { roughness: 0.92 });
  const waterMaterial = waterVolumeMaterial();
  const hullMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.62,
  });
  const deckMaterial = matte(PALETTE.accent, {
    metalness: 0.12,
    roughness: 0.64,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.20,
    roughness: 0.50,
  });
  const ropeMaterial = matte(PALETTE.belt, {
    metalness: 0.06,
    roughness: 0.78,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  // The river is a translucent water body between the banks, from its
  // surface down to a bed below the rudder; the banks are solid earth rising
  // a little above the water.
  const bedY = riverBedY;
  // The water's cropped ends stand 0.004 inside the banks' (their end faces
  // overlapped in one plane where the banks' inner faces run into it).
  const river = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(10.0 - 0.008, waterY - bedY, riverHalfWidth * 2),
    waterMaterial,
  ), 'river-current-driving-rudder-downstream');
  river.position.set(0, (waterY + bedY) / 2, 0);
  river.renderOrder = 1;
  root.add(river);

  const bankTopY = waterY + 0.10;
  const nearBank = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(10.0, bankTopY - bedY, 1.25),
    bankMaterial,
  ), 'fixed-river-bank');
  nearBank.position.set(0, (bankTopY + bedY) / 2, riverHalfWidth + 0.62);
  root.add(nearBank);
  const riverBed = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(10.0, 0.20, riverHalfWidth * 2 + 0.01),
    bankMaterial,
  ), 'fixed-river-bed-under-anchor');
  riverBed.position.set(0, bedY - 0.10, 0);
  root.add(riverBed);
  const farBank = nearBank.clone();
  farBank.userData.role = 'fixed-river-bank';
  farBank.position.z = -riverHalfWidth - 0.62;
  root.add(farBank);

  // Brown's feathered current arrow is notation, not a part: not modelled.
  const flowArrows = [];

  const anchor = addRole(new THREE.Group(),
    'fixed-anchor-center-of-ferry-arc');
  anchor.position.copy(anchorPoint);
  root.add(anchor);
  const anchorShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.15, 0.76, 28),
    darkMaterial,
  );
  anchorShaft.position.y = -0.15;
  anchor.add(anchorShaft);
  const anchorRing = horizontalRing(0.26, 0.06, darkMaterial);
  anchorRing.position.y = 0.16;
  anchor.add(anchorRing);
  for (const angle of [Math.PI / 4, -Math.PI / 4]) {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.10, 0.12),
      darkMaterial,
    );
    arm.position.y = -0.40;
    arm.rotation.y = angle;
    anchor.add(arm);
  }

  const boat = addRole(new THREE.Group(),
    'reaction-ferry-moving-on-anchor-centered-arc');
  root.add(boat);
  const hull = addRole(makeBoatHull(hullMaterial),
    'boat-hull-radial-to-anchor');
  boat.add(hull);

  const deck = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(1.62, 0.10, 1.06),
    deckMaterial,
  ), 'ferry-deck');
  deck.position.set(1.58, 0.37, 0);
  boat.add(deck);
  const cockpitFrames = [1.12, 1.96].map((x) => {
    // The well coamings are deck timber, not black outlines.
    const frame = horizontalRing(0.34, 0.055, deckMaterial);
    frame.scale.z = 1.36;
    frame.position.set(x, 0.46, 0);
    boat.add(frame);
    return frame;
  });

  const bowRing = horizontalRing(0.16, 0.045, darkMaterial);
  bowRing.position.set(0.08, 0.24, 0);
  boat.add(bowRing);

  const rudderPivot = addRole(new THREE.Group(),
    'operator-reversed-rudder-pivot');
  rudderPivot.position.set(sternFromBow, 0.18, 0);
  boat.add(rudderPivot);
  const rudderPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.52, 24),
    darkMaterial,
  );
  rudderPost.position.y = 0.05;
  rudderPivot.add(rudderPost);
  const rudderBlade = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.12, 0.28),
    deckMaterial,
  ), 'stream-deflecting-rudder-blade');
  rudderBlade.position.x = 0.49;
  rudderPivot.add(rudderBlade);
  const rudderTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 18, 12),
    whiteMaterial,
  );
  rudderTip.position.x = 0.98;
  rudderPivot.add(rudderTip);

  const rope = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 1, 16),
    ropeMaterial,
  ), 'single-taut-anchor-rope');
  rope.userData.isRope = true;
  root.add(rope);
  const ropeStartMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 20, 14),
    whiteMaterial,
  );
  root.add(ropeStartMarker);
  const ropeEndMarker = ropeStartMarker.clone();
  root.add(ropeEndMarker);

  const ropeEndpoints = () => {
    rope.updateMatrixWorld(true);
    return {
      end: new THREE.Vector3(0, 0.5, 0).applyMatrix4(rope.matrixWorld),
      start: new THREE.Vector3(0, -0.5, 0).applyMatrix4(rope.matrixWorld),
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    boat.position.copy(state.bowPoint);
    boat.rotation.y = -state.boatHeadingAngle;
    rudderPivot.rotation.y = state.rudderAngle;

    const ropeVector = state.bowPoint.clone().sub(anchorPoint);
    rope.position.copy(anchorPoint).add(state.bowPoint).multiplyScalar(0.5);
    // Local y runs along the line and local x stays level, so the plan-view
    // slack drawn into the rope geometry lies in the water plane.
    const ropeAxis = ropeVector.clone().normalize();
    const ropeSide = new THREE.Vector3(0, 1, 0).cross(ropeAxis).normalize();
    rope.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      ropeSide,
      ropeAxis,
      ropeSide.clone().cross(ropeAxis),
    ));
    rope.scale.set(1, ropeVector.length(), 1);
    ropeStartMarker.position.copy(anchorPoint);
    ropeEndMarker.position.copy(state.bowPoint);
    // Each swivel turns with the line, so its blind bore faces the rope.
    const ropeDirection = ropeVector.clone().normalize();
    // The anchor eye and bow ring are swivels too: their ports turn to face
    // the line (it rises steeply from the bed to the bow).
    anchor.children[1]?.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), ropeDirection);
    bowRing.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0),
      ropeDirection.clone().applyQuaternion(boat.quaternion.clone().invert()));
    ropeStartMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ropeDirection);
    ropeEndMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ropeDirection.negate());
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    anchorPoint: anchorPoint.clone(),
    boatCenterFromBow,
    bowRise,
    ropeLength,
    cycleDuration,
    groundY,
    inputAngularSpeed,
    maximumRudderAngle,
    maximumTraverseAngle,
    riverHalfWidth,
    sternFromBow,
    streamSpeed,
    tetherLength,
    waterY,
  };
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'rhine-reaction-ferry-with-fixed-anchor-taut-radius-rope-stream-deflected-rudder-and-bank-to-bank-circular-arc',
    blocks: {
      anchor,
      boat,
      bowRing,
      cockpitFrames,
      deck,
      farBank,
      flowArrows,
      hull,
      nearBank,
      river,
      rope,
      ropeEndMarker,
      ropeStartMarker,
      rudderBlade,
      rudderPivot,
    },
    constraints: {
      anchorFixed: true,
      boatHeading:
        'The boat longitudinal axis remains radial from the fixed anchor through the bow attachment in this reconstruction.',
      bowCircularLocus:
        '|bow-anchor| equals the single rope length at every sampled time.',
      ropeInextensibleAndTaut: true,
    },
    degreesOfFreedom: {
      boatHeadingIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      ropeLengthIndependent: false,
      rudderIndependent: false,
    },
    dynamics: {
      fullHullRudderFreeSurfaceHydrodynamicsModeled: false,
      steeringSchedule:
        'Brown specifies stream action on the rudder but supplies no rudder-control law. The demonstration prescribes a smooth cosine rudder reversal synchronized to a sinusoidal bank-to-bank traverse; it does not claim to solve the vessel dynamics.',
      streamModel:
        'A uniform downstream current is indicated. Current shear, wave making, hull drag, rudder lift and cable sag are not solved.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'A single taut rope holds the ferry bow at constant distance from a fixed upstream anchor, preventing downstream drift and constraining the bow to a circular arc. The river current acts on the angled rudder to produce a transverse component; reversing the rudder sends the boat toward the opposite bank. The hull stays outward of the bow attachment and rotates with the rope radius while the boat traverses the river.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'smooth-rudder-reversing-bank-to-bank-reaction-ferry-on-fixed-anchor-arc',
    },
    ropeEndpoints,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 447 page supplies Brown\'s static engraving and caption; its Animated control is unavailable and the page contains no Canvas mechanism or timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      boatCenter: sourceState.boatCenter.clone(),
      bowPoint: sourceState.bowPoint.clone(),
      rudderAngle: sourceState.rudderAngle,
      streamDirection: sourceState.streamVelocity.clone().normalize(),
      traverseAngle: sourceState.traverseAngle,
    },
    sourceReference: {
      brownPlate447: {
        approximateAnchorCenterPixels: [76, 253],
        approximateBoatCenterPixels: [319, 255],
        approximateBowAttachmentPixels: [231, 255],
        approximateCurrentArrowPixels: [165, 222],
        approximateRudderCenterPixels: [408, 259],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the method passes a boat from one river shore to the other',
          'the method is common on the Rhine and elsewhere',
          'the stream acts on the rudder',
          'the boat travels in the arc of a circle',
          'the anchor is the center of that circular arc',
          'the anchor keeps the boat from floating downstream',
        ],
        engravingEvidence:
          'Brown’s plan engraving shows two river banks, a downstream current arrow, one fixed anchor at left, one line from anchor to the pointed bow, a two-compartment boat, and an oblique stern rudder.',
        reconstructionDisclosure:
          'Brown gives no river width, anchor offset, rope length, boat dimensions, current speed, rudder angle, hull heading, mass, drag, lift, bank clearance, cable elasticity, or timing. Those values, the radial hull-heading convention, sinusoidal traverse, cosine steering schedule, colors, and 6.2-second cycle are independently engineered. The fixed anchor, single tether, circular path, downstream restraint, current, rudder, and shore-to-shore function are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 447',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      circularConstraint:
        'bow=anchor+L*(cos(theta),0,sin(theta))+(0,h,0) with the anchor on the river bed a constant h below the bow; the rope length sqrt(L^2+h^2) is exact and the anchor is exactly the plan centre of the path.',
      steering:
        'delta_rudder=delta_max*cos(inputAngle), reversing smoothly at the two bank-side extrema of theta=theta_max*sin(inputAngle).',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.45, groundY, -4.05),
    new THREE.Vector3(4.35, 1.12, 4.05),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(6.2, 8.8, 10.8);
  root.userData.groundFloorY = groundY;
  markShadows(root);
  nearBank.receiveShadow = true;
  farBank.receiveShadow = true;
  // Pass 69 (p69-w1): in Brown's plan the river reads as clear water; the
  // boat's and banks' shadows thrown two units down onto the bed read as a
  // second, ghost boat drifting beside the real one, so the bed takes none.
  riverBed.receiveShadow = false;
  update(0);
  correctReactionFerry(root);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredReactionFerryMovement(movement) {
  if (movement.id !== 447) return null;
  return reactionFerry(movement);
}
