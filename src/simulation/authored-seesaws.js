import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
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

function seesawMovement(movement) {
  const root = new THREE.Group();

  const sourceCyclesPerMinute = 15;
  const cyclePeriod = 60 / sourceCyclesPerMinute;
  const angularFrequency = FULL_TURN / cyclePeriod;
  const beamAmplitude = Math.PI / 6;
  const pivot = new THREE.Vector3(0, 1.34, 0);
  const beamHalfLength = 2.82;
  const beamLength = beamHalfLength * 2;
  const beamThickness = 0.15;
  const beamDepth = 0.34;
  const seatStation = 2.38;
  const handleStation = 2.04;

  const pointStateAtLocalPosition = (
    localPosition,
    angle,
    angularSpeed,
    angularAcceleration,
  ) => {
    const rotated = localPosition.clone().applyAxisAngle(Z_AXIS, angle);
    const position = pivot.clone().add(rotated);
    const velocity = new THREE.Vector3(
      -angularSpeed * rotated.y,
      angularSpeed * rotated.x,
      0,
    );
    const acceleration = new THREE.Vector3(
      -angularAcceleration * rotated.y
        - angularSpeed * angularSpeed * rotated.x,
      angularAcceleration * rotated.x
        - angularSpeed * angularSpeed * rotated.y,
      0,
    );
    return {
      acceleration,
      position,
      radius: rotated.length(),
      velocity,
    };
  };

  const stateAtTime = (time) => {
    const phaseUnbounded = time / cyclePeriod;
    const phase = positiveModulo(phaseUnbounded, 1);
    const phaseAngle = FULL_TURN * phaseUnbounded;
    const officialInterpolation = 0.5 + 0.5 * Math.cos(phaseAngle);
    const beamAngle = -beamAmplitude
      + 2 * beamAmplitude * officialInterpolation;
    const beamAngularSpeed = -beamAmplitude * angularFrequency
      * Math.sin(phaseAngle);
    const beamAngularAcceleration = -beamAmplitude
      * angularFrequency * angularFrequency * Math.cos(phaseAngle);
    const leftEndpoint = pointStateAtLocalPosition(
      new THREE.Vector3(-beamHalfLength, 0, 0),
      beamAngle,
      beamAngularSpeed,
      beamAngularAcceleration,
    );
    const rightEndpoint = pointStateAtLocalPosition(
      new THREE.Vector3(beamHalfLength, 0, 0),
      beamAngle,
      beamAngularSpeed,
      beamAngularAcceleration,
    );
    const stage = Math.abs(Math.sin(phaseAngle)) < 1e-10
      ? Math.cos(phaseAngle) > 0
        ? 'positive-angle-reversal'
        : 'negative-angle-reversal'
      : beamAngularSpeed > 0
        ? 'counterclockwise-swing'
        : 'clockwise-swing';
    return {
      beamAngle,
      beamAngularAcceleration,
      beamAngularSpeed,
      centerOfMass: pivot.clone(),
      cycleIndex: Math.floor(phaseUnbounded),
      leftEndpoint,
      officialInterpolation,
      phase,
      phaseUnbounded,
      pivot: pivot.clone(),
      rightEndpoint,
      stage,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.29,
    roughness: 0.45,
  });
  const beamMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.57,
  });
  const seatMaterial = matte(PALETTE.driver, {
    metalness: 0.10,
    roughness: 0.59,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.28,
    roughness: 0.43,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const baseY = 0;
  const frame = new THREE.Group();
  frame.userData.fixed = true;
  frame.userData.role = 'fixed-pedestal-and-two-plane-a-frame';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(3.34, 0.18, 1.28),
    frameMaterial,
  );
  base.position.set(0, baseY + 0.09, 0);
  base.userData.role = 'source-visible-seesaw-base';
  frame.add(base);
  const centerPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, pivot.y - 0.12, 0.54),
    frameMaterial,
  );
  centerPost.position.set(0, (pivot.y + 0.06) / 2, 0);
  centerPost.userData.role = 'central-vertical-fulcrum-post';
  frame.add(centerPost);
  const frameLegs = [];
  for (const z of [-0.43, 0.43]) {
    for (const side of [-1, 1]) {
      const leg = makeBeam(
        new THREE.Vector3(side * 1.18, baseY + 0.18, z),
        new THREE.Vector3(0, pivot.y - 0.04, z),
        { color: PALETTE.frame, depth: 0.12, thickness: 0.16 },
      );
      leg.userData.role = 'inclined-leg-of-fixed-a-frame';
      leg.userData.side = side;
      leg.userData.planeZ = z;
      frame.add(leg);
      frameLegs.push(leg);
    }
  }
  const apexCaps = [-0.43, 0.43].map((z) => {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 24, 16),
      frameMaterial,
    );
    cap.position.set(0, pivot.y, z);
    cap.scale.set(1, 1.22, 0.48);
    cap.userData.role = 'rounded-fixed-fulcrum-cheek';
    cap.userData.planeZ = z;
    frame.add(cap);
    return cap;
  });
  root.add(frame);

  const beamRotor = new THREE.Group();
  beamRotor.position.copy(pivot);
  beamRotor.userData.axis = Z_AXIS.clone();
  beamRotor.userData.role =
    'one-rigid-seesaw-beam-seats-and-handles-rocking-about-fixed-axle';
  const plank = new THREE.Mesh(
    new THREE.BoxGeometry(beamLength, beamThickness, beamDepth),
    beamMaterial,
  );
  plank.userData.role = 'single-straight-balanced-seesaw-plank';
  beamRotor.add(plank);
  const plankEdgeRails = [-1, 1].map((side) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(beamLength, 0.040, 0.055),
      darkMaterial,
    );
    rail.position.set(0, beamThickness / 2 + 0.012, side * 0.14);
    rail.userData.role = 'dark-longitudinal-edge-of-rigid-plank';
    rail.userData.side = side;
    beamRotor.add(rail);
    return rail;
  });
  const pivotBoss = cylinderAlongZ(0.235, 0.72, beamMaterial, 48);
  pivotBoss.userData.role = 'moving-beam-bearing-boss-around-fixed-axle';
  beamRotor.add(pivotBoss);

  const seats = [];
  const handlePosts = [];
  const handleBars = [];
  const endpointIndexes = [];
  for (const side of [-1, 1]) {
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.13, 0.72),
      seatMaterial,
    );
    seat.position.set(side * seatStation, 0.16, 0);
    seat.userData.role = 'end-seat-rigidly-fastened-to-seesaw-beam';
    seat.userData.side = side;
    beamRotor.add(seat);
    seats.push(seat);

    const handlePost = cylinderAlongY(0.055, 0.46,
      accentMaterial, 24);
    handlePost.position.set(side * handleStation, 0.29, 0);
    handlePost.userData.role = 'upright-handhold-post-on-moving-beam';
    handlePost.userData.side = side;
    beamRotor.add(handlePost);
    handlePosts.push(handlePost);

    const handleBar = cylinderAlongZ(0.060, 0.70,
      darkMaterial, 24);
    handleBar.position.set(side * handleStation, 0.50, 0);
    handleBar.userData.role = 'transverse-handgrip-on-moving-beam';
    handleBar.userData.side = side;
    beamRotor.add(handleBar);
    handleBars.push(handleBar);

    const endpointIndex = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 20, 14),
      whiteMaterial,
    );
    endpointIndex.position.set(side * beamHalfLength, 0, 0.20);
    endpointIndex.userData.role = 'white-index-at-seesaw-beam-end';
    endpointIndex.userData.side = side;
    beamRotor.add(endpointIndex);
    endpointIndexes.push(endpointIndex);
  }
  root.add(beamRotor);

  const pivotAxle = cylinderAlongZ(0.105, 1.42, darkMaterial, 32);
  pivotAxle.position.copy(pivot);
  pivotAxle.userData.role = 'fixed-fulcrum-axle-through-moving-beam';
  root.add(pivotAxle);
  const axleCaps = [-1, 1].map((side) => {
    const cap = cylinderAlongZ(0.155, 0.09, accentMaterial, 32);
    cap.position.set(pivot.x, pivot.y, side * 0.73);
    cap.userData.role = 'fixed-fulcrum-axle-retaining-cap';
    cap.userData.side = side;
    root.add(cap);
    return cap;
  });

  const update = (time) => {
    const state = stateAtTime(time);
    beamRotor.rotation.z = state.beamAngle;
    root.userData.currentState = state;
    root.userData.constraints = {
      fixedPivot: {
        axis: Z_AXIS.clone(),
        centerError: beamRotor.position.distanceTo(pivot),
      },
      rigidBeam: {
        endpointDistance:
          state.leftEndpoint.position.distanceTo(
            state.rightEndpoint.position,
          ),
        midpointError: state.leftEndpoint.position.clone()
          .add(state.rightEndpoint.position)
          .multiplyScalar(0.5)
          .distanceTo(pivot),
      },
    };
  };

  root.userData = {
    archetype: 'single-pivot-rigid-seesaw',
    blocks: {
      apexCaps,
      axleCaps,
      base,
      beamRotor,
      centerPost,
      endpointIndexes,
      frame,
      frameLegs,
      handleBars,
      handlePosts,
      pivotAxle,
      pivotBoss,
      plank,
      plankEdgeRails,
      seats,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      input: 'one limited rocking angle about the fixed transverse fulcrum',
      note:
        'all plank, seat, handle, and beam-end coordinates belong to one rigid body; no crank, belt, cam, or second moving link exists',
      storedEnergyStates: 0,
    },
    dynamics: {
      balanceModel:
        'the centered unloaded beam has no gravity restoring torque; its harmonic display angle is therefore a prescribed human-like input, not a claimed free dynamic response',
      massesOrRiderForcesSpecifiedBySource: false,
      sourceIsKinematicIllustrationOnly: true,
    },
    fidelity: 'authored',
    geometry: {
      angularFrequency,
      beamAmplitude,
      beamDepth,
      beamHalfLength,
      beamLength,
      beamThickness,
      cyclePeriod,
      handleStation,
      pivot: pivot.clone(),
      seatStation,
      sourceCyclesPerMinute,
    },
    mechanism:
      'one-rigid-seesaw-beam-with-end-seats-oscillating-on-one-fixed-central-fulcrum',
    officialDescription: movement.description,
    pointStateAtLocalPosition,
    sourceAnimation: {
      available: true,
      cyclesPerMinute: sourceCyclesPerMinute,
      durationSeconds: cyclePeriod,
      independentlyReconstructed: true,
      officialCanvasModelPresent: true,
      officialFunctionChain: [
        'add_stat',
        'add_pos_interp',
        'add_text',
      ],
      officialGeometry: {
        beamEndRay: [
          new THREE.Vector2(-0.000002, 0),
          new THREE.Vector2(0.866025, 0.5),
        ],
        beamHalfSwing: beamAmplitude,
        beamStartRay: [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(0.866026, -0.500002),
        ],
        pivotRadius: 0.125,
        view: [-5, -4.75, 10, 10],
      },
      officialInterpolationLaw:
        'q = 0.5 + sin(2*(cyclePos + 0.25)*pi)/2 = 0.5 + cos(2*pi*cyclePos)/2',
      officialPageAnimatedTabDisabled: false,
      referenceScope:
        'official fixed stand, one rigid moving beam, ±30-degree rays, cosine interpolation, view, and 15-cycle-per-minute timing',
      sourceUrl: movement.sourceUrl,
    },
    sourceReference: {
      brownPlate363: {
        baseLeft: new THREE.Vector2(46, 490),
        baseRight: new THREE.Vector2(431, 490),
        engravingBeamAngleDegrees: -33,
        fulcrumPivot: new THREE.Vector2(239, 270),
        imageHeight: 525,
        imageWidth: 525,
        leftBeamEnd: new THREE.Vector2(23, 104),
        leftFrameFoot: new THREE.Vector2(82, 488),
        measurementUncertaintyPixels: 8,
        rightBeamEnd: new THREE.Vector2(469, 393),
        rightFrameFoot: new THREE.Vector2(389, 489),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the device is a see-saw',
          'its motion is limited oscillating or alternate circular motion',
        ],
        engravingEvidence:
          'one long rigid plank, two end seats and handholds, one central axle, and a fixed braced pedestal',
        officialAnimationEvidence:
          'the embedded model supplies opposite 30-degree beam rays and a symmetric cosine interpolation at 15 cycles per minute',
      },
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod: cyclePeriod,
      negativeReversal: cyclePeriod / 2,
      positiveReversal: 0,
      quarterCycleLevelCrossings: [cyclePeriod / 4, cyclePeriod * 3 / 4],
    },
    transmission: {
      endpointLaw:
        'both beam ends follow equal-radius circular arcs about the one fixed fulcrum and remain diametrically opposite',
      motionClass:
        'limited alternate circular motion with total angular range pi/3',
      rigidBodyLaw:
        'every moving component shares exactly the beam angle; endpoint separation is constant at twice the half-length',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.20, -0.10, -0.88),
    new THREE.Vector3(3.20, 2.95, 0.88),
  );
  root.userData.groundFloorY = -0.09;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(4.6, 3.0, 8.6),
    root,
    update,
  };
}

export function createAuthoredSeesawMovement(movement) {
  if (movement.id === 363) return seesawMovement(movement);
  return null;
}
