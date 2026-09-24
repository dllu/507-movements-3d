import { correctRunnerTreadParts, finishRunnerTread } from './treadwheel-working-parts.js';
import { treadmillLegState } from './treadmill-gait.js';
import * as THREE from 'three';
import {
  circle,
  plate,
  poly,
  polygonClipping,
} from './finite-plate-geometry.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function tubeBetween(start, end, radius, material) {
  return new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.LineCurve3(start, end),
      1,
      radius,
      10,
      false,
    ),
    material,
  );
}

// Brown's walker stands about as tall as the drum's radius plus his legs;
// the earlier full-size mannequin rose far above the drum.
const FIGURE_SCALE = 0.8;

function externalPersonTreadmill(movement) {
  const root = new THREE.Group();

  const wheelCenter = new THREE.Vector3(-0.62, -0.23, 0);
  const wheelRadius = 1.62;
  const treadRadius = 1.50;
  const drumWidth = 2.32;
  const treadCount = 14;
  const treadPitch = FULL_TURN / treadCount;
  const wheelPeriod = 4;
  const wheelAngularSpeed = -FULL_TURN / wheelPeriod;
  const wheelStartAngle = THREE.MathUtils.degToRad(6);
  const gaitCyclesPerWheelTurn = treadCount / 2;
  const gaitAngularSpeed = Math.abs(wheelAngularSpeed)
    * gaitCyclesPerWheelTurn;
  const personStationAngle = THREE.MathUtils.degToRad(20);
  const personStationPoint = wheelCenter.clone().add(new THREE.Vector3(
    Math.cos(personStationAngle) * treadRadius,
    Math.sin(personStationAngle) * treadRadius,
    0,
  ));
  const personRelativeClimbSpeed = treadRadius
    * Math.abs(wheelAngularSpeed);
  const personMass = 1.0;
  const gravity = 9.81;
  const personCenterOfMass = wheelCenter.clone().add(
    // Brown's man climbs on the descending side toward the far end of the
    // drum, right of the diagonal side bar in the level side view.
    // Scaled to Brown's figure, whose cap only just rises above the drum
    // top and whose feet are on the boards near axle height.
    new THREE.Vector3(2.15, 0.95 + 0.27 * FIGURE_SCALE, -0.45),
  );
  const personWeight = new THREE.Vector3(0, -personMass * gravity, 0);
  const personWeightTorque = personCenterOfMass.clone()
    .sub(wheelCenter).cross(personWeight).z;
  const outputPower = personWeightTorque * wheelAngularSpeed;
  const legPhaseOffsets = [0, Math.PI];
  const upperLegLength = 0.70 * FIGURE_SCALE;
  const lowerLegLength = 0.65 * FIGURE_SCALE;
  const gaitGeometry = { treadPitch, treadRadius, treadCount, wheelStartAngle,
    wheelPeriod, hipX: personCenterOfMass.x - wheelCenter.x,
    hipY: personCenterOfMass.y - wheelCenter.y - 0.27 * FIGURE_SCALE,
    upperLength: upperLegLength, lowerLength: lowerLegLength };

  const stateAtTime = (time) => {
    const wheelTravel = wheelAngularSpeed * time;
    const wheelAngle = wheelStartAngle + wheelTravel;
    const wheelAngularVelocity = Z_AXIS.clone()
      .multiplyScalar(wheelAngularSpeed);
    const treadStates = Array.from({ length: treadCount }, (_, index) => {
      const angle = wheelAngle + index * treadPitch;
      const localCenter = new THREE.Vector3(
        Math.cos(angle) * treadRadius,
        Math.sin(angle) * treadRadius,
        0,
      );
      const center = wheelCenter.clone().add(localCenter);
      const velocity = new THREE.Vector3().crossVectors(
        wheelAngularVelocity,
        localCenter,
      );
      return { angle, center, index, localCenter, velocity };
    });
    const stationRadiusVector = personStationPoint.clone()
      .sub(wheelCenter);
    const surfaceVelocityAtPerson = new THREE.Vector3().crossVectors(
      wheelAngularVelocity,
      stationRadiusVector,
    );
    const relativeClimbVelocity = surfaceVelocityAtPerson.clone().negate();
    const gaitPhase = gaitAngularSpeed * time;
    const legStates = legPhaseOffsets.map((_, index) => treadmillLegState(time, index, gaitGeometry));
    return {
      gaitAngularSpeed,
      gaitPhase,
      legStates,
      netPersonWorldVelocity: surfaceVelocityAtPerson.clone()
        .add(relativeClimbVelocity),
      outputPower,
      personCenterOfMass: personCenterOfMass.clone(),
      personRelativeClimbSpeed,
      personWeight: personWeight.clone(),
      personWeightTorque,
      relativeClimbVelocity,
      surfaceVelocityAtPerson,
      treadPassingFrequency: treadCount / wheelPeriod,
      treads: treadStates,
      wheelAngle,
      wheelAngularSpeed,
      wheelTravel,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.59,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const wheelMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.61,
  });
  const treadMaterial = matte(PALETTE.brass, {
    metalness: 0.10,
    roughness: 0.67,
  });
  const personMaterial = matte(PALETTE.driver, {
    metalness: 0.02,
    roughness: 0.76,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.43 });

  const wheelRotor = new THREE.Group();
  wheelRotor.position.copy(wheelCenter);
  wheelRotor.userData.axis = Z_AXIS.clone();
  wheelRotor.userData.role =
    'broad-horizontal-axis-treadmill-drum-and-output-shaft';
  root.add(wheelRotor);
  const endRings = [];
  const endSpokes = [];
  for (const side of [-1, 1]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(wheelRadius - 0.065, 0.065, 11, 84),
      darkMaterial,
    );
    ring.position.z = side * drumWidth / 2;
    ring.userData.side = side;
    ring.userData.role = 'one-of-two-rigid-end-rings-of-treadmill-drum';
    endRings.push(ring);
    wheelRotor.add(ring);
    for (let index = 0; index < 4; index += 1) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(wheelRadius * 1.72, 0.075, 0.060),
        wheelMaterial,
      );
      spoke.position.z = side * drumWidth / 2;
      spoke.rotation.z = index * Math.PI / 4;
      spoke.userData.index = index;
      spoke.userData.side = side;
      spoke.userData.role = 'end-wheel-diameter-brace';
      endSpokes.push(spoke);
      wheelRotor.add(spoke);
    }
  }
  const treadBoards = [];
  const outerLugs = [];
  for (let index = 0; index < treadCount; index += 1) {
    const angle = index * treadPitch;
    const tread = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.105, drumWidth * 0.95),
      treadMaterial,
    );
    tread.position.set(
      Math.cos(angle) * treadRadius,
      Math.sin(angle) * treadRadius,
      0,
    );
    // Radial boards provide upward-facing steps on the descending side.
    // Tangential boards would present a nearly vertical wall to the walker.
    tread.rotation.z = angle;
    tread.userData.index = index;
    tread.userData.role =
      'cross-width-peripheral-step-board-rigid-with-treadmill';
    treadBoards.push(tread);
    wheelRotor.add(tread);
    for (const side of [-1, 1]) {
      const lug = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.16, 0.16),
        wheelMaterial,
      );
      lug.position.set(
        Math.cos(angle) * (wheelRadius + 0.03),
        Math.sin(angle) * (wheelRadius + 0.03),
        side * drumWidth / 2,
      );
      lug.rotation.z = angle + Math.PI / 2;
      lug.userData.index = index;
      lug.userData.side = side;
      lug.userData.role = 'end-ring-step-lug-at-one-tread-board';
      outerLugs.push(lug);
      wheelRotor.add(lug);
    }
  }
  const axle = cylinderAlongZ(0.13, drumWidth + 1.10,
    darkMaterial, 30);
  axle.userData.role = 'coaxial-output-shaft-rigid-with-treadmill-drum';
  wheelRotor.add(axle);
  const wheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.060, 0.035),
    whiteMaterial,
  );
  wheelIndex.position.set(1.03, 0, drumWidth / 2 + 0.075);
  wheelIndex.userData.role =
    'white-index-showing-clockwise-treadmill-output-rotation';
  wheelRotor.add(wheelIndex);

  // Brown's near end shows a notched spur wheel on the axle, outboard of
  // the drum: a broad rim with round tooth spaces, a crossed pair of arms
  // and a hub, smaller than the tread circle.
  const gearRadius = 1.16;
  const gearNotchCount = 16;
  const gearNotchRadius = 0.105;
  const gearFaceZ = drumWidth / 2 + 0.14;
  const gearThickness = 0.10;
  const notches = Array.from({ length: gearNotchCount }, (_, index) => {
    const angle = (index + 0.5) * FULL_TURN / gearNotchCount;
    return poly(circle(
      [Math.cos(angle) * gearRadius, Math.sin(angle) * gearRadius],
      gearNotchRadius,
      48,
    ));
  });
  const gearWeb = polygonClipping.union(
    polygonClipping.difference(
      poly(circle([0, 0], gearRadius, 256)),
      poly(circle([0, 0], gearRadius * 0.70, 192)),
      ...notches,
    ),
    poly([[-0.84, -0.06], [0.84, -0.06], [0.84, 0.06], [-0.84, 0.06]]),
    poly([[-0.06, -0.84], [0.06, -0.84], [0.06, 0.84], [-0.06, 0.84]]),
    poly(circle([0, 0], 0.26, 96)),
  );
  const endGear = new THREE.Mesh(
    plate(
      polygonClipping.difference(gearWeb, poly(circle([0, 0], 0.13, 96))),
      gearFaceZ,
      gearFaceZ + gearThickness,
    ),
    wheelMaterial,
  );
  endGear.userData.role = 'source-visible-notched-spur-wheel-on-treadmill-axle';
  wheelRotor.add(endGear);

  const person = new THREE.Group();
  person.position.set(
    personCenterOfMass.x,
    personCenterOfMass.y,
    personCenterOfMass.z,
  );
  person.userData.fixedInWorld = true;
  person.userData.role =
    'world-stationary-person-stepping-up-descending-peripheral-boards';
  root.add(person);
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.24 * FIGURE_SCALE, 0.64 * FIGURE_SCALE, 8, 18),
    personMaterial,
  );
  torso.position.y = 0.10 * FIGURE_SCALE;
  torso.scale.z = 0.62;
  torso.userData.role = 'stylized-person-torso';
  person.add(torso);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.19 * FIGURE_SCALE, 24, 16),
    personMaterial,
  );
  head.position.y = 0.78 * FIGURE_SCALE;
  head.userData.role = 'stylized-person-head';
  person.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20 * FIGURE_SCALE, 0.17 * FIGURE_SCALE, 0.10 * FIGURE_SCALE, 24),
    darkMaterial,
  );
  cap.position.y = 0.95 * FIGURE_SCALE;
  cap.userData.role = 'source-visible-person-cap';
  person.add(cap);
  const arms = [];
  // He faces the drum and holds a rail at head height in front of him,
  // Brown's topmost horizontal line running the length of the drum.
  const handRailY = personCenterOfMass.y + 0.82 * FIGURE_SCALE;
  const handRailX = personCenterOfMass.x - 0.30 * FIGURE_SCALE;
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Vector3(
      0,
      0.44 * FIGURE_SCALE,
      side * 0.17 * FIGURE_SCALE,
    );
    const hand = new THREE.Vector3(
      handRailX - personCenterOfMass.x,
      handRailY - personCenterOfMass.y,
      side * 0.39 * FIGURE_SCALE,
    );
    const arm = tubeBetween(shoulder, hand, 0.065 * FIGURE_SCALE, personMaterial);
    arm.userData.side = side;
    arm.userData.role = 'person-arm-holding-fixed-safety-rail';
    arms.push(arm);
    person.add(arm);
  }
  const legRoots = [];
  const kneePivots = [];
  const upperLegs = [];
  const lowerLegs = [];
  const feet = [];
  for (let index = 0; index < 2; index += 1) {
    const legRoot = new THREE.Group();
    // Stylized joints are layered side by side so the folding swing leg
    // never passes through itself or the torso: the thighs hang beside the
    // torso's 0.149 half-depth, and each shin and foot ride just outboard
    // of their thigh like the plates of a jointed lay figure.
    const legSide = index === 0 ? 1 : -1;
    legRoot.position.set(
      0,
      -0.27 * FIGURE_SCALE,
      legSide * 0.205 * FIGURE_SCALE,
    );
    legRoot.userData.index = index;
    legRoot.userData.role = 'person-hip-pivot';
    person.add(legRoot);
    legRoots.push(legRoot);
    // Rounded limbs rather than boxes, like Brown's trousered legs.
    const upperLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.06 * FIGURE_SCALE, upperLegLength - 0.12 * FIGURE_SCALE, 6, 14),
      personMaterial,
    );
    upperLeg.position.y = -upperLegLength / 2;
    upperLeg.userData.role = 'person-upper-leg';
    legRoot.add(upperLeg);
    upperLegs.push(upperLeg);
    const knee = new THREE.Group();
    knee.position.y = -upperLegLength;
    knee.userData.index = index;
    knee.userData.role = 'person-knee-pivot';
    legRoot.add(knee);
    kneePivots.push(knee);
    const lowerLeg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.045 * FIGURE_SCALE, lowerLegLength - 0.09 * FIGURE_SCALE, 6, 14),
      personMaterial,
    );
    // Outboard of the thigh by both capsule radii, so the knee does not overlap.
    lowerLeg.position.set(0, -lowerLegLength / 2, legSide * (0.105 * FIGURE_SCALE + 0.004));
    lowerLeg.userData.role = 'person-lower-leg';
    knee.add(lowerLeg);
    lowerLegs.push(lowerLeg);
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.30 * FIGURE_SCALE, 0.10, 0.08 * FIGURE_SCALE),
      darkMaterial,
    );
    foot.position.set(-0.04 * FIGURE_SCALE, -lowerLegLength - 0.05, 0);
    foot.userData.role = 'person-foot-above-peripheral-step';
    knee.add(foot);
    feet.push(foot);
  }

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role =
    'fixed-bearing-pedestal-diagonal-guard-and-handrail';
  root.add(fixedFrame);
  // Brown's bearing standard stands in front of the spur wheel: a flared
  // A-frame whose legs spread to a plank on the ground.
  const pedestalZ = gearFaceZ + gearThickness + 0.20;
  const pedestalFootY = -1.96 - wheelCenter.y;
  const pedestalTopY = -0.22;
  const rearPedestal = new THREE.Mesh(
    plate(
      polygonClipping.difference(
        poly([
          [-0.86, pedestalFootY],
          [0.86, pedestalFootY],
          [0.20, pedestalTopY],
          [-0.20, pedestalTopY],
        ]),
        poly([
          [-0.56, pedestalFootY - 0.01],
          [0.56, pedestalFootY - 0.01],
          [0.07, pedestalTopY - 0.52],
          [-0.07, pedestalTopY - 0.52],
        ]),
      ),
      -0.09,
      0.09,
    ),
    frameMaterial,
  );
  rearPedestal.position.set(wheelCenter.x, wheelCenter.y, pedestalZ);
  rearPedestal.userData.role = 'source-visible-end-bearing-pedestal';
  fixedFrame.add(rearPedestal);
  const bearing = cylinderAlongZ(0.23, 0.32, frameMaterial, 30);
  bearing.position.set(
    wheelCenter.x,
    wheelCenter.y,
    pedestalZ,
  );
  bearing.userData.role = 'fixed-treadmill-end-bearing';
  fixedFrame.add(bearing);
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(4.92, 0.18, 3.36),
    frameMaterial,
  );
  base.position.set(0.02, -2.05, 0);
  base.userData.role = 'fixed-treadmill-foundation';
  fixedFrame.add(base);
  const pedestalPlank = new THREE.Mesh(
    new THREE.BoxGeometry(2.30, 0.12, 0.46),
    frameMaterial,
  );
  pedestalPlank.position.set(wheelCenter.x, -2.02, pedestalZ);
  pedestalPlank.userData.role = 'source-visible-plank-under-bearing-standard';
  fixedFrame.add(pedestalPlank);
  const handRailStart = new THREE.Vector3(
    handRailX,
    handRailY,
    -drumWidth / 2 - 0.20,
  );
  // The rail runs away from the viewer beyond the man's near hand, as
  // Brown draws it running off the plate to the right.
  const handRailEnd = new THREE.Vector3(
    handRailX,
    handRailY,
    drumWidth / 2,
  );
  const handRail = tubeBetween(
    handRailStart,
    handRailEnd,
    0.055,
    darkMaterial,
  );
  handRail.userData.role = 'fixed-hand-rail-above-person-station';
  fixedFrame.add(handRail);
  const diagonalGuard = tubeBetween(
    new THREE.Vector3(
      wheelCenter.x - 0.30,
      wheelCenter.y + wheelRadius + 0.35,
      drumWidth / 2 + 0.54,
    ),
    new THREE.Vector3(
      wheelCenter.x + 1.58,
      -2.00,
      drumWidth / 2 + 0.54,
    ),
    0.085,
    frameMaterial,
  );
  // Brown draws this side bar as a broad flat plank, not a round rod.
  {
    const start = new THREE.Vector3(
      wheelCenter.x - 0.30,
      wheelCenter.y + wheelRadius + 0.35,
      drumWidth / 2 + 0.54,
    );
    const end = new THREE.Vector3(wheelCenter.x + 1.58, -2.00, start.z);
    diagonalGuard.geometry.dispose();
    diagonalGuard.geometry = new THREE.BoxGeometry(
      0.22,
      start.distanceTo(end),
      0.09,
    );
    diagonalGuard.position.copy(start).add(end).multiplyScalar(0.5);
    diagonalGuard.rotation.z = Math.atan2(end.y - start.y, end.x - start.x)
      - Math.PI / 2;
  }
  diagonalGuard.userData.role =
    'source-visible-fixed-diagonal-side-frame';
  fixedFrame.add(diagonalGuard);
  const railPosts = [];
  for (const z of [-drumWidth / 2 - 0.16, personCenterOfMass.z + 0.48]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 2.12, 0.14),
      frameMaterial,
    );
    post.position.set(
      handRailX,
      handRailY - 1.03,
      z,
    );
    post.userData.role = 'fixed-hand-rail-support';
    railPosts.push(post);
    fixedFrame.add(post);
  }

  const update = (time) => {
    const state = stateAtTime(time);
    wheelRotor.rotation.z = state.wheelAngle;
    for (let index = 0; index < legRoots.length; index += 1) {
      const leg = state.legStates[index];
      legRoots[index].rotation.z = leg.upperAngle;
      kneePivots[index].rotation.z = leg.lowerAngle;
      const ankleRotation = leg.soleAngle - leg.upperAngle - leg.lowerAngle;
      feet[index].rotation.z = ankleRotation;
      feet[index].position.set(-0.04 * FIGURE_SCALE, -0.05, 0).applyAxisAngle(Z_AXIS, ankleRotation);
      feet[index].position.y -= lowerLegLength;
    }
    root.userData.currentState = state;
    root.userData.weightDrive = {
      outputPower: state.outputPower,
      torque: state.personWeightTorque,
    };
  };

  root.userData = {
    archetype: movement.archetype,
    blocks: {
      arms,
      axle,
      base,
      bearing,
      cap,
      diagonalGuard,
      endGear,
      endRings,
      endSpokes,
      feet,
      fixedFrame,
      handRail,
      head,
      kneePivots,
      legRoots,
      lowerLegs,
      outerLugs,
      pedestalPlank,
      person,
      railPosts,
      rearPedestal,
      torso,
      treadBoards,
      upperLegs,
      wheelIndex,
      wheelRotor,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      input:
        'person stepping upward relative to the descending peripheral boards on the right side of the broad treadmill',
      note:
        'the end wheels, cross-width tread boards, and output axle are one rigid rotor; planted feet track individual boards and two-link legs follow the prescribed feet',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid broad drum, output axle, end rings, and fourteen peripheral boards',
        'person torso held at one mean world station; feet alternate planted board tracking with a prescribed outside swing, using two-link inverse kinematics',
        'mean relative climb exactly cancels descending tread velocity',
        'constant person mass and gravitational field',
        'steady resisting load balances person-weight torque so wheel speed is uniform',
      ],
      sourceSpecifiesDimensionsTimingTreadCountPersonMassOrLoad: false,
      treatment:
        'Brown supplies the external stepping principle and historical uses but no dimensions, speed, tread count, person mass, or load; the broad drum and gait are engineered, while rigid tread motion, mean climb balance, gravity torque, and output power are analytic',
    },
    fidelity: 'authored',
    geometry: {
      drumWidth,
      gaitAngularSpeed,
      gaitCyclesPerWheelTurn,
      gaitGeometry,
      figureScale: FIGURE_SCALE,
      upperLegLength,
      lowerLegLength,
      legPhaseOffsets,
      personCenterOfMass,
      personStationAngle,
      personStationPoint,
      treadCount,
      treadPitch,
      treadRadius,
      wheelCenter,
      wheelPeriod,
      wheelRadius,
      wheelStartAngle,
    },
    mechanism:
      'one-person-steps-up-the-right-hand-descending-side-of-one-broad-horizontal-axis-treadmill-whose-fourteen-cross-width-peripheral-boards-end-rings-and-output-shaft-form-one-rigid-rotor',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate377: {
        diagonalFrameBottom: new THREE.Vector2(416, 500),
        diagonalFrameTop: new THREE.Vector2(230, 38),
        endWheelCenter: new THREE.Vector2(168, 278),
        endWheelLeft: new THREE.Vector2(45, 279),
        endWheelTop: new THREE.Vector2(169, 146),
        handRailY: 106,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 9,
        personHeadCenter: new THREE.Vector2(461, 89),
        personTorsoCenter: new THREE.Vector2(431, 215),
        treadFieldRight: 519,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'people turn the treadmill by their weight while stepping on peripheral tread boards',
          'the machine was used for penal labor and grinding grain',
          'Brown attributes the invention to China',
          'the same principle was still used in China to raise irrigation water',
        ],
        engravingEvidence:
          'the plate shows a broad field of cross-width peripheral steps, one braced end wheel and output axle at left, one person standing externally on the right side, a fixed handrail, and a diagonal fixed side frame',
        reconstructionDisclosure:
          'drum depth, fourteen tread boards with radial working faces, end-ring structure, supports, colors, speed, person mass, and tread-indexed gait are engineered because Brown gives no values and the official page has no canvas animation; finite sole placement is prescribed, while balance and muscle/contact forces remain unqualified',
      },
      officialPage: 'https://507movements.com/mm_377.html',
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod: wheelPeriod,
      note:
        'one clockwise treadmill revolution returns fourteen peripheral boards and both end wheels to their starting pose and contains seven smooth closed gait cycles',
    },
    transmission: {
      meanNoDriftLaw:
        'the person climbing velocity relative to the wheel is equal and opposite to the descending tread velocity at the right-hand station',
      outputPower,
      outputTorque: personWeightTorque,
      personRelativeClimbSpeed,
      treadPassingFrequency: treadCount / wheelPeriod,
      weightTorqueLaw:
        'the right-of-axis person weight produces a negative Z torque, matching the clockwise wheel angular velocity and positive delivered power',
    },
  };

  correctRunnerTreadParts(root, 377);
  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.55, -2.25, -1.75),
    new THREE.Vector3(2.26, 2.18, 2.06),
  );
  root.userData.groundFloorY = -2.15;
  // A narrow field keeps the drum's boards and rail near-parallel, as the
  // plate draws them.
  root.userData.cameraFov = 20;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(5.6, 3.2, 8.8),
    root,
    update,
  };
}

export function createAuthoredPersonTreadmillMovement(movement) {
  if (movement.id !== 377) return null;
  return finishRunnerTread(externalPersonTreadmill(movement), 377);
}
