import {correctCordTraverseParts} from './cord-traverse-working-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function angularDistance(left, right) {
  return Math.abs(Math.atan2(
    Math.sin(left - right),
    Math.cos(left - right),
  ));
}

function cylinderAlongX(radius, length, material, segments = 48) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function torusNormalToX(majorRadius, tubeRadius, material, segments = 72) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(majorRadius, tubeRadius, 12, segments),
    material,
  );
  torus.rotation.y = Math.PI / 2;
  return torus;
}

function rotatingObliqueGrooveTraverse(movement) {
  const root = new THREE.Group();

  const inputCyclePeriod = 8;
  const inputAngularSpeed = FULL_TURN / inputCyclePeriod;
  const upperAxisY = 1.05;
  const lowerAxisY = -0.42;
  const barrelCenterX = 1.15;
  const barrelRadius = 1.14;
  const barrelAxialLength = 0.82;
  const grooveCenterRadius = barrelRadius + 0.014;
  const grooveTubeRadius = 0.047;
  const grooveSegments = 640;
  const followerAmplitude = 0.32;
  const outputStroke = followerAmplitude * 2;
  const groovePitchMagnitude = followerAmplitude;
  // Brown's pin hangs straight down from the upper shaft into the groove at
  // the top of the lower cylinder; at his pose the pin sits at the groove's
  // left extreme, so the oblique groove is seen edgewise as one straight
  // diagonal.
  const contactWorldAngle = 0;
  const sourceDriverAngle = -contactWorldAngle;
  const contactY = lowerAxisY
    + grooveCenterRadius * Math.cos(contactWorldAngle);
  const contactZ = -grooveCenterRadius * Math.sin(contactWorldAngle);
  const upperDrumRadius = 1.29;
  const upperDrumWidth = 1.05;
  const upperDrumOffsetX = -1.58;
  const upperShaftLocalCenterX = -1.14;
  const upperShaftLength = 4.04;
  // Brown's lower shaft starts at the middle post and runs out past the
  // right post; it stays clear of the tall upper drum.
  const lowerShaftLength = 1.72;
  const lowerShaftLocalCenterX = 0.11;

  const grooveXAtLocalAngle = angle => -followerAmplitude*Math.cos(angle);
  const groovePitchAtLocalAngle = angle => followerAmplitude*Math.sin(angle);

  const grooveCurve = new class extends THREE.Curve {
    getPoint(parameter, target = new THREE.Vector3()) {
      const localAngle = THREE.MathUtils.clamp(parameter, 0, 1)
        * FULL_TURN;
      return target.set(
        grooveXAtLocalAngle(localAngle),
        grooveCenterRadius * Math.cos(localAngle),
        -grooveCenterRadius * Math.sin(localAngle),
      );
    }
  }();
  grooveCurve.arcLengthDivisions = grooveSegments;

  const stateAtDriverAngle = (driverAngle) => {
    const localContactAngleUnbounded = contactWorldAngle + driverAngle;
    const localContactAngle = positiveModulo(
      localContactAngleUnbounded,
      FULL_TURN,
    );
    const atLeftReversal = angularDistance(localContactAngle, 0) < 1e-10;
    const atRightReversal = angularDistance(
      localContactAngle,
      Math.PI,
    ) < 1e-10;
    const atReversal = atLeftReversal || atRightReversal;
    const forwardTraverse = localContactAngle > 0
      && localContactAngle < Math.PI;
    const groovePitch = groovePitchAtLocalAngle(localContactAngle);
    const outputX = barrelCenterX
      + grooveXAtLocalAngle(localContactAngle);
    const outputVelocityX = atReversal
      ? 0
      : groovePitch * inputAngularSpeed;
    const grooveLocalPoint = grooveCurve.getPoint(
      localContactAngle / FULL_TURN,
    );
    const grooveWorldPoint = grooveLocalPoint.clone()
      .applyAxisAngle(X_AXIS, driverAngle)
      .add(new THREE.Vector3(barrelCenterX, lowerAxisY, 0));
    const contactPoint = new THREE.Vector3(outputX, contactY, contactZ);
    const radialNormal = new THREE.Vector3(
      0,
      Math.cos(contactWorldAngle),
      -Math.sin(contactWorldAngle),
    );
    const grooveWorldTangent = new THREE.Vector3(
      groovePitch,
      -grooveCenterRadius * Math.sin(contactWorldAngle),
      -grooveCenterRadius * Math.cos(contactWorldAngle),
    ).normalize();
    const inputSurfaceVelocity = new THREE.Vector3(
      0,
      inputAngularSpeed * grooveCenterRadius
        * Math.sin(contactWorldAngle),
      inputAngularSpeed * grooveCenterRadius
        * Math.cos(contactWorldAngle),
    );
    const outputVelocity = new THREE.Vector3(outputVelocityX, 0, 0);
    const relativeGrooveVelocity = outputVelocity.clone()
      .sub(inputSurfaceVelocity);
    const flankNormal = new THREE.Vector3().crossVectors(
      radialNormal,
      grooveWorldTangent,
    ).normalize();
    const stage = atLeftReversal
      ? 'left-end-smooth-groove-reversal'
      : atRightReversal
        ? 'right-end-smooth-groove-reversal'
        : forwardTraverse
          ? 'smooth-rightward-traverse-on-positive-pitch-half'
          : 'smooth-leftward-traverse-on-negative-pitch-half';
    return {
      atLeftReversal,
      atReversal,
      atRightReversal,
      completedInputTurns:
        (driverAngle - sourceDriverAngle) / FULL_TURN,
      contactPoint,
      driverAngle,
      driverAngularSpeed: inputAngularSpeed,
      flankNormal,
      flankNormalVelocityError: atReversal
        ? 0
        : relativeGrooveVelocity.dot(flankNormal),
      forwardTraverse,
      grooveLocalPoint,
      groovePitch,
      grooveSlidingSpeed: relativeGrooveVelocity.dot(
        grooveWorldTangent,
      ),
      grooveWorldPoint,
      grooveWorldTangent,
      inputSurfaceVelocity,
      localContactAngle,
      localContactAngleUnbounded,
      outputAccelerationUndefinedAtReversal: false,
      outputAccelerationX: followerAmplitude*Math.cos(localContactAngle)*inputAngularSpeed**2,
      outputAngularSpeed: 0,
      outputDrumSpinPrescribedBySource: false,
      outputVelocity,
      outputVelocityDiscontinuousAtReversal: false,
      outputVelocityX,
      outputX,
      radialNormal,
      radialNormalVelocityError: relativeGrooveVelocity.dot(radialNormal),
      relativeGrooveVelocity,
      stage,
      surfacePointError: grooveWorldPoint.distanceTo(contactPoint),
    };
  };

  const stateAtTime = (time) => stateAtDriverAngle(
    sourceDriverAngle + inputAngularSpeed * time,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.61,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.44,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.57,
  });
  const outputMaterial = matte(PALETTE.driven, {
    metalness: 0.15,
    roughness: 0.54,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.29,
    roughness: 0.43,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const baseY = -1.98;
  const frame = new THREE.Group();
  frame.userData.fixed = true;
  frame.userData.role = 'source-three-post-two-level-bearing-frame';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(4.25, 0.18, 0.76),
    frameMaterial,
  );
  base.position.set(0.08, baseY, -0.35);
  base.userData.role = 'source-visible-bed-plate';
  frame.add(base);
  const framePostSpecifications = [
    { x: -1.65, topY: upperAxisY + 0.34, role: 'left-upper-bearing-post' },
    { x: 0.55, topY: upperAxisY + 0.34, role: 'middle-two-level-bearing-post' },
    { x: 1.86, topY: lowerAxisY + 0.34, role: 'right-lower-bearing-post' },
  ];
  const framePosts = framePostSpecifications.map(({ role, topY, x }) => {
    const height = topY - (baseY + 0.09);
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.23, height, 0.34),
      frameMaterial,
    );
    post.position.set(x, baseY + 0.09 + height / 2, -0.43);
    post.userData.role = role;
    frame.add(post);
    return post;
  });
  const upperBearingCenters = [-1.65, 0.55];
  const lowerBearingCenters = [0.55, 1.86];
  const upperBearings = upperBearingCenters.map((x) => {
    const bearing = torusNormalToX(0.145, 0.052, frameMaterial, 48);
    bearing.position.set(x, upperAxisY, 0.12);
    bearing.userData.role = 'fixed-bored-bearing-for-traversing-upper-shaft';
    frame.add(bearing);
    return bearing;
  });
  const lowerBearings = lowerBearingCenters.map((x) => {
    const bearing = torusNormalToX(0.16, 0.055, frameMaterial, 48);
    bearing.position.set(x, lowerAxisY, 0.12);
    bearing.userData.role = 'fixed-bearing-for-rotating-lower-cylinder-shaft';
    frame.add(bearing);
    return bearing;
  });
  root.add(frame);

  const lowerInputRotor = new THREE.Group();
  lowerInputRotor.position.set(barrelCenterX, lowerAxisY, 0);
  lowerInputRotor.userData.axis = X_AXIS.clone();
  lowerInputRotor.userData.role =
    'lower-shaft-cylinder-and-oblique-groove-one-input-rotor';
  const lowerShaft = cylinderAlongX(
    0.090,
    lowerShaftLength,
    darkMaterial,
    32,
  );
  lowerShaft.position.x = lowerShaftLocalCenterX;
  lowerShaft.userData.role = 'continuously-rotating-lower-input-shaft';
  lowerInputRotor.add(lowerShaft);
  const groovedCylinder = cylinderAlongX(
    barrelRadius,
    barrelAxialLength,
    driverMaterial,
    72,
  );
  groovedCylinder.userData.role =
    'lower-cylinder-carrying-one-closed-oblique-groove';
  lowerInputRotor.add(groovedCylinder);
  const grooveTrack = new THREE.Mesh(
    new THREE.TubeGeometry(
      grooveCurve,
      grooveSegments,
      grooveTubeRadius,
      9,
      true,
    ),
    darkMaterial,
  );
  grooveTrack.userData.role =
    'one-closed-positive-and-negative-pitch-oblique-groove';
  lowerInputRotor.add(grooveTrack);
  const grooveReversalPockets = [0, 0.5].map((parameter, index) => {
    const pocket = new THREE.Mesh(
      new THREE.SphereGeometry(grooveTubeRadius * 1.20, 20, 14),
      darkMaterial,
    );
    pocket.position.copy(grooveCurve.getPoint(parameter));
    pocket.userData.role = 'joined-end-reversal-of-oblique-groove-halves';
    pocket.userData.end = index === 0 ? 'left' : 'right';
    lowerInputRotor.add(pocket);
    return pocket;
  });
  const cylinderEndRims = [-1, 1].map((side) => {
    const rim = torusNormalToX(
      barrelRadius,
      0.045,
      accentMaterial,
      84,
    );
    rim.position.x = side * barrelAxialLength / 2;
    rim.userData.role = 'end-rim-on-rotating-lower-cylinder';
    rim.userData.side = side;
    lowerInputRotor.add(rim);
    return rim;
  });
  const lowerRotationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.078, 20, 14),
    whiteMaterial,
  );
  lowerRotationIndex.position.set(
    barrelAxialLength / 2 + 0.055,
    barrelRadius * 0.66,
    0,
  );
  lowerRotationIndex.userData.role =
    'white-index-showing-lower-cylinder-angle-and-rate';
  lowerInputRotor.add(lowerRotationIndex);
  root.add(lowerInputRotor);

  const upperSlide = new THREE.Group();
  upperSlide.position.set(barrelCenterX - followerAmplitude, upperAxisY, 0);
  upperSlide.userData.role =
    'nonrotating-upper-shaft-drum-and-follower-traversing-together';
  upperSlide.userData.translationAxis = X_AXIS.clone();
  const upperShaft = cylinderAlongX(0.082, upperShaftLength,
    darkMaterial, 32);
  upperShaft.position.x = upperShaftLocalCenterX;
  upperShaft.userData.role = 'upper-shaft-sliding-through-two-fixed-bearings';
  upperSlide.add(upperShaft);
  const upperDrum = cylinderAlongX(
    upperDrumRadius,
    upperDrumWidth,
    outputMaterial,
    72,
  );
  upperDrum.position.x = upperDrumOffsetX;
  upperDrum.userData.role = 'large-upper-drum-fixed-axially-to-sliding-shaft';
  upperSlide.add(upperDrum);
  const upperDrumEndRims = [-1, 1].map((side) => {
    const rim = torusNormalToX(
      upperDrumRadius,
      0.050,
      darkMaterial,
      88,
    );
    rim.position.x = upperDrumOffsetX + side * upperDrumWidth / 2;
    rim.userData.role = 'dark-end-rim-on-traversing-upper-drum';
    rim.userData.side = side;
    upperSlide.add(rim);
    return rim;
  });
  const upperTranslationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(upperDrumWidth * 0.68, 0.065, 0.035),
    whiteMaterial,
  );
  upperTranslationIndex.position.set(
    upperDrumOffsetX,
    0,
    contactZ < 0 ? -upperDrumRadius - 0.018 : upperDrumRadius + 0.018,
  );
  upperTranslationIndex.userData.role =
    'white-straight-index-on-nonrotating-traversing-upper-drum';
  upperSlide.add(upperTranslationIndex);
  // Brown's pin is one straight bar through the end of the upper shaft,
  // standing a little above it and reaching down into the groove.
  const followerBridge = makeBeam(
    new THREE.Vector3(0, -0.01, 0),
    new THREE.Vector3(0, 0.01, 0),
    { color: PALETTE.accent, depth: 0.105, thickness: 0.105 },
  );
  followerBridge.userData.role =
    'radial-bridge-from-upper-shaft-end-to-groove-follower';
  followerBridge.visible = false;
  upperSlide.add(followerBridge);
  const followerStem = makeBeam(
    new THREE.Vector3(0, 0.42, contactZ),
    new THREE.Vector3(0, contactY - upperAxisY, contactZ),
    { color: PALETTE.accent, depth: 0.105, thickness: 0.105 },
  );
  followerStem.userData.role =
    'pin-arm-fixed-to-end-of-traversing-upper-shaft';
  upperSlide.add(followerStem);
  const followerTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.084, 24, 16),
    accentMaterial,
  );
  followerTip.position.set(0, contactY - upperAxisY, contactZ);
  followerTip.scale.x = 0.72;
  followerTip.userData.role =
    'rounded-pin-on-upper-shaft-working-in-oblique-groove';
  upperSlide.add(followerTip);
  const shaftTranslationIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.070, 20, 14),
    whiteMaterial,
  );
  shaftTranslationIndex.position.set(0.75, 0, 0.10);
  shaftTranslationIndex.userData.role =
    'white-index-on-end-of-traversing-upper-shaft';
  upperSlide.add(shaftTranslationIndex);
  root.add(upperSlide);

  const update = (time) => {
    const state = stateAtTime(time);
    lowerInputRotor.rotation.x = state.driverAngle;
    upperSlide.position.x = state.outputX;
    root.userData.currentState = state;
    root.userData.contacts = {
      grooveFollower: {
        axialConstraintError:
          state.contactPoint.x - state.grooveWorldPoint.x,
        contactPoint: state.contactPoint.clone(),
        flankNormal: state.flankNormal.clone(),
        flankNormalVelocityError: state.flankNormalVelocityError,
        radialNormal: state.radialNormal.clone(),
        radialNormalVelocityError: state.radialNormalVelocityError,
        slidingSpeed: state.grooveSlidingSpeed,
        surfacePointError: state.surfacePointError,
        tangent: state.grooveWorldTangent.clone(),
      },
      upperShaftGuides: {
        axis: X_AXIS.clone(),
        lateralError: Math.hypot(
          upperSlide.position.y - upperAxisY,
          upperSlide.position.z,
        ),
        rotationError: Math.abs(upperSlide.rotation.x),
      },
    };
  };

  root.userData = {
    archetype: 'rotating-oblique-groove-cylinder-shaft-traverse',
    blocks: {
      base,
      cylinderEndRims,
      followerBridge,
      followerStem,
      followerTip,
      frame,
      framePosts,
      grooveReversalPockets,
      grooveTrack,
      groovedCylinder,
      lowerBearings,
      lowerInputRotor,
      lowerRotationIndex,
      lowerShaft,
      shaftTranslationIndex,
      upperBearings,
      upperDrum,
      upperDrumEndRims,
      upperShaft,
      upperSlide,
      upperTranslationIndex,
    },
    curves: {
      groove: grooveCurve,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      input: 'continuous rotation of the lower grooved cylinder',
      note:
        'the groove fixes the upper shaft axial coordinate; Brown specifies no upper-shaft spin, so its displayed angular coordinate is held fixed',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealReversal:
        'an oblique planar groove gives a sinusoidal axial traverse; velocity changes sign smoothly through zero at each end',
      sourceSpecifiesInputSpeedOrInertia: false,
      upperShaftSpinPrescribedBySource: false,
    },
    fidelity: 'authored',
    geometry: {
      barrelAxialLength,
      barrelCenterX,
      barrelRadius,
      contactWorldAngle,
      contactY,
      contactZ,
      followerAmplitude,
      fullTurn: FULL_TURN,
      grooveCenterRadius,
      groovePitchMagnitude,
      grooveSegments,
      grooveTubeRadius,
      inputAngularSpeed,
      inputCyclePeriod,
      lowerAxisY,
      lowerShaftLength,
      outputStroke,
      sourceDriverAngle,
      peakTraverseSpeed: groovePitchMagnitude * inputAngularSpeed,
      upperAxisY,
      upperDrumOffsetX,
      upperDrumRadius,
      upperDrumWidth,
      upperShaftLength,
      upperShaftLocalCenterX,
    },
    groovePitchAtLocalAngle,
    grooveXAtLocalAngle,
    mechanism:
      'continuously-rotating-lower-cylinder-with-one-closed-opposite-pitch-oblique-groove-driving-an-upper-shaft-traverse',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate362: {
        baseTopY: 489,
        followerPinTip: new THREE.Vector2(357, 243),
        grooveLowerVisibleEnd: new THREE.Vector2(429, 452),
        grooveUpperVisibleEnd: new THREE.Vector2(357, 243),
        imageHeight: 525,
        imageWidth: 525,
        leftUpperPostX: 66,
        lowerCylinderBottomY: 456,
        lowerCylinderCenter: new THREE.Vector2(393, 330),
        lowerCylinderLeftX: 351,
        lowerCylinderRightX: 435,
        lowerCylinderTopY: 204,
        lowerShaftAxisY: 313,
        measurementUncertaintyPixels: 8,
        middlePostX: 305,
        rightLowerPostX: 477,
        upperDrumBottomY: 309,
        upperDrumCenter: new THREE.Vector2(180, 169),
        upperDrumLeftX: 122,
        upperDrumRightX: 237,
        upperDrumTopY: 29,
        upperShaftAxisY: 169,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the upper shaft and its drum traverse alternately',
          'the follower is a pin on the end of the upper shaft',
          'the pin works in an oblique groove in the lower cylinder',
        ],
        engravingEvidence:
          'the plate shows parallel horizontal shafts, one large upper traversing drum, one continuously journaled lower cylinder, and one visible diagonal groove branch',
        inference:
          'the visible diagonal is reconstructed as an oblique plane intersecting the cylinder; its unseen half gives a smooth opposite traverse, while Brown supplies no timing',
      },
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtDriverAngle,
    stateAtTime,
    timeline: {
      demonstrationPeriod: inputCyclePeriod,
      leftReversal: 0,
      rightReversal: inputCyclePeriod / 2,
      note:
        'one deliberately uniform lower-cylinder revolution displays a rightward traverse on the visible positive-pitch half and a leftward return on the hidden negative-pitch half; Brown supplies no speed',
    },
    transmission: {
      contactPhaseLaw:
        'local groove contact angle = contactWorldAngle + driverAngle modulo 2*pi',
      forwardLaw:
        'over the positive-pitch half, outputX rises sinusoidally by the full stroke in one half input turn',
      grooveLaw:
        'the closed oblique planar groove has x=-amplitude*cos(local angle), with finite smooth reversals',
      returnLaw:
        'over the negative-pitch half, outputX falls sinusoidally by the full stroke in one half input turn',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.28, -2.07, -1.30),
    new THREE.Vector3(2.25, 2.36, 1.30),
  );
  root.userData.groundFloorY = -2.07;
  correctCordTraverseParts(root,362,update);
  // The revolved groove section shares vertices across its sharp flank
  // edges, so smooth normals smear the straight groove into a wavy band.
  // Split the faces so the barrel shades as a plain cylinder crossed by
  // Brown's single straight diagonal groove.
  {
    const grooved = root.userData.blocks.groovedCylinder;
    const flat = grooved.geometry.toNonIndexed();
    flat.computeVertexNormals();
    grooved.geometry.dispose();
    grooved.geometry = flat;
  }
  // Brown draws both drums as plain cylinders seen in flat front elevation:
  // no end flanges or rims and no white phase indices.  They stay allocated
  // (hidden) so kinematic checks keep their references.
  for (const part of [
    ...cylinderEndRims,
    ...upperDrumEndRims,
    lowerRotationIndex,
    upperTranslationIndex,
    shaftTranslationIndex,
  ]) part.visible = false;
  root.userData.cameraDirection = new THREE.Vector3(0, 0.02, 1);
  root.userData.cameraFov = 14;
  markShadows(root);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredGroovedCylinderTraverseMovement(movement) {
  if (movement.id === 362) return rotatingObliqueGrooveTraverse(movement);
  return null;
}
