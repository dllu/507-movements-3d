import * as THREE from 'three';
import { boredCylinderGeometry, fitPistonGuide } from './piston-guide-parts.js';
import { circle, poly, plate, polygonClipping } from './finite-plate-geometry.js';
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
  // The source stand is 4 units tall for a beam half-span of 4.5.
  const pivot = new THREE.Vector3(0, 0.18 + 2.82 * 4 / 4.5, 0);
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

  const baseY = 0;
  const frame = new THREE.Group();
  frame.userData.fixed = true;
  frame.userData.role = 'fixed-pedestal-and-two-plane-a-frame';
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(3.76, 0.18, 1.28),
    frameMaterial,
  );
  base.position.set(0, baseY + 0.09, 0);
  base.userData.role = 'source-visible-seesaw-base';
  frame.add(base);
  const centerPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, pivot.y - 0.45, 0.74),
    frameMaterial,
  );
  centerPost.position.set(0, (pivot.y - 0.27) / 2, 0);
  centerPost.userData.role = 'central-vertical-fulcrum-post';
  frame.add(centerPost);
  // Each straight brace is one flat bar in its outer plane, cut to seat on
  // what it joins: its foot is cut level and sunk 0.01 into the base, and its
  // head is cut plumb and sunk 0.01 into the fulcrum cheek (x = +-0.25), so
  // it bears on both over its full section with no gap or sliver.
  const frameLegs = [];
  const legFoot = new THREE.Vector2(1.18, baseY + 0.18);
  const legHead = new THREE.Vector2(0, pivot.y - 0.95);
  const legWidth = 0.16;
  const legDepth = 0.12;
  const legSeatX = 0.25 - 0.01;
  const legSeatY = baseY + 0.18 - 0.01;
  for (const z of [-0.43, 0.43]) {
    for (const side of [-1, 1]) {
      const direction = legHead.clone().sub(legFoot).normalize();
      const normal = new THREE.Vector2(-direction.y, direction.x).multiplyScalar(legWidth / 2);
      const edges = [legFoot.clone().add(normal), legFoot.clone().sub(normal)];
      // Where each long edge crosses the level foot cut and the plumb head cut.
      const atY = (point, y) => point.clone().add(direction.clone().multiplyScalar((y - point.y) / direction.y));
      const atX = (point, x) => point.clone().add(direction.clone().multiplyScalar((x - point.x) / direction.x));
      const outline = [atY(edges[0], legSeatY), atY(edges[1], legSeatY), atX(edges[1], legSeatX), atX(edges[0], legSeatX)]
        .map((point) => [side * point.x, point.y]);
      const leg = new THREE.Mesh(plate(poly(side > 0 ? outline : outline.slice().reverse()), z - legDepth / 2, z + legDepth / 2), frameMaterial);
      leg.userData.role = 'inclined-leg-of-fixed-a-frame';
      leg.userData.side = side;
      leg.userData.planeZ = z;
      leg.userData.seats = { footY: legSeatY, headX: side * legSeatX };
      frame.add(leg);
      frameLegs.push(leg);
    }
  }
  // Brown's stand has two concave cast buttresses flanking the post, with
  // the straight braces seen inside them; the webs sit in the post's
  // mid-plane, clear of the braces in the two outer planes.
  const buttresses = [-1, 1].map((side) => {
    const footX = 1.81;
    const topY = 2.15;
    const outline = [[0.17, baseY + 0.18], [footX, baseY + 0.18], [footX, baseY + 0.27]];
    for (let i = 1; i <= 32; i += 1) {
      const t = Math.PI / 2 * i / 32;
      outline.push([
        footX - (footX - 0.27) * Math.sin(t),
        topY - (topY - baseY - 0.27) * Math.cos(t),
      ]);
    }
    outline.push([0.17, topY]);
    const web = new THREE.Mesh(
      plate(poly(outline.map(([x, y]) => [side * x, y])), -0.16, 0.16),
      frameMaterial,
    );
    web.userData.role = 'concave-cast-buttress-beside-fulcrum-post';
    web.userData.side = side;
    frame.add(web);
    return web;
  });
  const cheekOutline = [[-.25, .09], [.25, .09], [.25, pivot.y]];
  for (let i = 1; i <= 48; i++) {
    const angle = Math.PI * i / 48;
    cheekOutline.push([.25 * Math.cos(angle), pivot.y + .305 * Math.sin(angle)]);
  }
  const cheekProfile = polygonClipping.difference(poly(cheekOutline), poly(circle([0, pivot.y], .108, 96)));
  const apexCaps = [-0.43, 0.43].map((z) => {
    const cap = new THREE.Mesh(plate(cheekProfile, z - .09, z + .09), frameMaterial);
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
    plate(polygonClipping.difference(
      poly([[-beamHalfLength, -beamThickness/2], [beamHalfLength, -beamThickness/2],
        [beamHalfLength, beamThickness/2], [-beamHalfLength, beamThickness/2]]),
      poly(circle([0, 0], .109, 96))), -beamDepth/2, beamDepth/2),
    beamMaterial,
  );
  plank.userData.role = 'single-straight-balanced-seesaw-plank';
  beamRotor.add(plank);
  const pivotBoss = new THREE.Mesh(boredCylinderGeometry(.235, .109, .54), beamMaterial);
  pivotBoss.rotation.x = Math.PI / 2;
  pivotBoss.userData.role = 'moving-beam-bearing-boss-around-fixed-axle';
  beamRotor.add(pivotBoss);

  // Brown ends each plank in a shoe: an end board square to the plank with a
  // rounded heel piece filling the corner, and a small cleat inboard of it.
  // There are no handholds and no white end indices on the plate.
  const seats = [];
  const handlePosts = [];
  const handleBars = [];
  const endpointIndexes = [];
  const shoeReach = 0.46;
  const endBoardThickness = 0.07;
  for (const side of [-1, 1]) {
    const endX = beamHalfLength - endBoardThickness;
    const heelOutline = [[endX, beamThickness / 2], [endX - shoeReach, beamThickness / 2]];
    for (let i = 1; i < 24; i += 1) {
      const t = Math.PI / 2 * i / 24;
      // Convex heel: a quarter ellipse bulging away from the corner.
      heelOutline.push([
        endX - shoeReach * Math.cos(t),
        beamThickness / 2 + shoeReach * Math.sin(t),
      ]);
    }
    heelOutline.push([endX, beamThickness / 2 + shoeReach]);
    // Shoe, end board and cleat are exactly as wide as the plank (no overhang).
    const seatGeometry = plate(poly(heelOutline.map(([x, y]) => [side * x, y])), -beamDepth / 2, beamDepth / 2);
    const seat = new THREE.Mesh(seatGeometry, seatMaterial);
    seat.userData.role = 'rounded-shoe-heel-fastened-in-plank-end';
    seat.userData.side = side;
    beamRotor.add(seat);
    seats.push(seat);

    const boardHeight = shoeReach + 0.12;
    const endBoard = new THREE.Mesh(
      new THREE.BoxGeometry(endBoardThickness, boardHeight, beamDepth),
      seatMaterial,
    );
    endBoard.position.set(
      side * (beamHalfLength - endBoardThickness / 2),
      beamThickness / 2 + boardHeight / 2,
      0,
    );
    endBoard.userData.role = 'shoe-end-board-square-to-plank';
    endBoard.userData.side = side;
    beamRotor.add(endBoard);
    handlePosts.push(endBoard);

    const cleat = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.11, beamDepth),
      seatMaterial,
    );
    cleat.position.set(
      side * (beamHalfLength - 0.78),
      beamThickness / 2 + 0.055,
      0,
    );
    cleat.userData.role = 'foot-cleat-inboard-of-shoe';
    cleat.userData.side = side;
    beamRotor.add(cleat);
    handleBars.push(cleat);
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
      buttresses,
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
  root.userData.reconstructionNote = 'The source cosine animation prescribes the ±30° swing; rider forces and bearing friction are not simulated. Fulcrum height follows the source 4:4.5 stand/half-span ratio. Paired bored cheeks and a fixed axle reconstruct the hidden depth interfaces.';
  root.userData.minimumDisplayCycleSeconds = cyclePeriod;
  fitPistonGuide(root, update, cyclePeriod);
  root.userData.groundFloorY = -0.09;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(1.5, 0.9, 16),
    root,
    update,
  };
}

export function createAuthoredSeesawMovement(movement) {
  if (movement.id === 363) return seesawMovement(movement);
  return null;
}
