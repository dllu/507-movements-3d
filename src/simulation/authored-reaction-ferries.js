import * as THREE from 'three';
import {correctReactionFerry} from './reaction-ferry-parts.js';
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
  const anchorPoint = new THREE.Vector3(-3.72, 0.18, 0);
  const tetherLength = 2.92;
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
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.68,
    roughness: 0.30,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
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

  const river = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(10.0, 0.18, riverHalfWidth * 2),
    waterMaterial,
  ), 'river-current-driving-rudder-downstream');
  river.position.set(0, waterY - 0.10, 0);
  root.add(river);

  const nearBank = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(10.0, 0.34, 1.25),
    bankMaterial,
  ), 'fixed-river-bank');
  nearBank.position.set(0, groundY + 0.17, riverHalfWidth + 0.62);
  root.add(nearBank);
  const farBank = nearBank.clone();
  farBank.userData.role = 'fixed-river-bank';
  farBank.position.z = -riverHalfWidth - 0.62;
  root.add(farBank);

  for (const bank of [nearBank, farBank]) {
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(10.0, 0.08, 0.12),
      darkMaterial,
    );
    edge.position.set(0, 0.19, bank.position.z > 0 ? -0.57 : 0.57);
    bank.add(edge);
  }

  // Brown draws one feathered current arrow just above the line, between the
  // anchor and the bow; it is kept as a flat dark mark on the water surface.
  const currentArrow = addRole(new THREE.Group(),
    'fixed-downstream-current-arrow-drawn-by-brown');
  currentArrow.position.set(-2.80, waterY + 0.03, -0.66);
  const arrowShaft = new THREE.Mesh(
    new THREE.BoxGeometry(1.14, 0.03, 0.045),
    darkMaterial,
  );
  arrowShaft.position.x = 0.57;
  currentArrow.add(arrowShaft);
  const arrowHead = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.28, 3),
    darkMaterial,
  );
  arrowHead.rotation.z = -Math.PI / 2;
  arrowHead.scale.z = 0.25;
  arrowHead.position.x = 1.26;
  currentArrow.add(arrowHead);
  for (const x of [0.04, 0.14, 0.24]) {
    for (const side of [-1, 1]) {
      const feather = new THREE.Mesh(
        new THREE.BoxGeometry(0.19, 0.03, 0.03),
        darkMaterial,
      );
      feather.position.set(x + 0.06, 0, side * 0.055);
      feather.rotation.y = side * 0.75;
      currentArrow.add(feather);
    }
  }
  root.add(currentArrow);
  const flowArrows = [currentArrow];

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
    const frame = horizontalRing(0.34, 0.055, darkMaterial);
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
    rope.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      ropeVector.clone().normalize(),
    );
    rope.scale.set(1, ropeVector.length(), 1);
    ropeStartMarker.position.copy(anchorPoint);
    ropeEndMarker.position.copy(state.bowPoint);
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    anchorPoint: anchorPoint.clone(),
    boatCenterFromBow,
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
        'bow=anchor+L*(cos(theta),0,sin(theta)); therefore the rope length L is exact and the anchor is exactly the center of the path.',
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
