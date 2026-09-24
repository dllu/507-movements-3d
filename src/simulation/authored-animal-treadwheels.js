import { correctRunnerTreadParts, finishRunnerTread } from './treadwheel-working-parts.js';
import * as THREE from 'three';
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

function animalInteriorTreadwheel(movement) {
  const root = new THREE.Group();

  const wheelRadius = 2.05;
  const innerTreadRadius = 1.70;
  const wheelWidth = 1.16;
  const wheelPeriod = 4;
  const wheelAngularSpeed = FULL_TURN / wheelPeriod;
  // The plate's lattice stands about 17 degrees clockwise of square.
  const wheelStartAngle = THREE.MathUtils.degToRad(-17);
  const latticeOffset = 0.40;
  const treadCount = 16;
  const treadPitch = FULL_TURN / treadCount;
  const gaitCyclesPerWheelTurn = treadCount / 2;
  const gaitAngularSpeed = gaitCyclesPerWheelTurn * wheelAngularSpeed;
  const animalStationAngle = THREE.MathUtils.degToRad(-132);
  const animalStationPoint = new THREE.Vector3(
    Math.cos(animalStationAngle) * innerTreadRadius,
    Math.sin(animalStationAngle) * innerTreadRadius,
    0,
  );
  const animalRelativeClimbSpeed = innerTreadRadius * wheelAngularSpeed;
  const animalMass = 1.40;
  const gravity = 9.81;
  const animalCenterOfMass = new THREE.Vector3(-0.58, -0.60, 0);
  const animalWeight = new THREE.Vector3(0, -animalMass * gravity, 0);
  const animalWeightTorque = animalCenterOfMass.clone()
    .cross(animalWeight).z;
  const outputPower = animalWeightTorque * wheelAngularSpeed;
  const legPhaseOffsets = [0, Math.PI, Math.PI, 0];
  const upperLegBaseAngles = [-0.10, 0.12, 0.08, -0.14];
  const upperLegAmplitude = 0.29;
  const lowerLegBaseAngle = 0.20;
  const lowerLegAmplitude = 0.34;
  const tailAmplitude = 0.20;

  const stateAtTime = (time) => {
    const wheelTravel = wheelAngularSpeed * time;
    const wheelAngle = wheelStartAngle + wheelTravel;
    const wheelAngularVelocity = Z_AXIS.clone()
      .multiplyScalar(wheelAngularSpeed);
    const treadStates = Array.from({ length: treadCount }, (_, index) => {
      const angle = wheelAngle + index * treadPitch;
      const center = new THREE.Vector3(
        Math.cos(angle) * innerTreadRadius,
        Math.sin(angle) * innerTreadRadius,
        0,
      );
      const velocity = new THREE.Vector3().crossVectors(
        wheelAngularVelocity,
        center,
      );
      return { angle, center, index, velocity };
    });
    const surfaceVelocityAtAnimal = new THREE.Vector3().crossVectors(
      wheelAngularVelocity,
      animalStationPoint,
    );
    const relativeClimbVelocity = surfaceVelocityAtAnimal.clone().negate();
    const gaitPhase = gaitAngularSpeed * time;
    const legStates = legPhaseOffsets.map((offset, index) => {
      const phase = gaitPhase + offset;
      return {
        index,
        lowerAngle: lowerLegBaseAngle
          + lowerLegAmplitude * Math.sin(phase + Math.PI / 2),
        lowerAngularSpeed: lowerLegAmplitude * gaitAngularSpeed
          * Math.cos(phase + Math.PI / 2),
        phase,
        upperAngle: upperLegBaseAngles[index]
          + upperLegAmplitude * Math.sin(phase),
        upperAngularSpeed: upperLegAmplitude * gaitAngularSpeed
          * Math.cos(phase),
      };
    });
    return {
      animalCenterOfMass: animalCenterOfMass.clone(),
      animalRelativeClimbSpeed,
      animalWeight: animalWeight.clone(),
      animalWeightTorque,
      gaitAngularSpeed,
      gaitPhase,
      legStates,
      netAnimalWorldVelocity: surfaceVelocityAtAnimal.clone()
        .add(relativeClimbVelocity),
      outputPower,
      relativeClimbVelocity,
      surfaceVelocityAtAnimal,
      tailAngle: tailAmplitude * Math.sin(gaitPhase / 2),
      treadPassingFrequency: treadCount / wheelPeriod,
      treads: treadStates,
      wheelAngle,
      wheelAngularSpeed,
      wheelTravel,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const wheelMaterial = matte(PALETTE.driven, {
    metalness: 0.10,
    roughness: 0.62,
  });
  const treadMaterial = matte(PALETTE.brass, {
    metalness: 0.10,
    roughness: 0.67,
  });
  const animalMaterial = matte(PALETTE.driver, {
    metalness: 0.02,
    roughness: 0.78,
  });
  const animalDarkMaterial = matte(0x5b3826, {
    metalness: 0.01,
    roughness: 0.84,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.44 });

  const wheelRotor = new THREE.Group();
  wheelRotor.userData.axis = Z_AXIS.clone();
  wheelRotor.userData.role =
    'horizontal-axis-cage-wheel-turned-by-animal-weight';
  root.add(wheelRotor);
  const sideRings = [];
  const radialSpokes = [];
  for (const side of [-1, 1]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(wheelRadius - 0.07, 0.070, 12, 96),
      darkMaterial,
    );
    ring.position.z = side * wheelWidth / 2;
    ring.userData.side = side;
    ring.userData.role = 'one-of-two-rigid-side-rings-of-treadwheel';
    sideRings.push(ring);
    wheelRotor.add(ring);
    // Brown draws each face as a square lattice: two pairs of parallel
    // chord bars crossing at right angles around a square about the axle,
    // not radial spokes.
    for (let index = 0; index < 4; index += 1) {
      const direction = index < 2 ? 0 : Math.PI / 2;
      const offset = (index % 2 === 0 ? -1 : 1) * latticeOffset;
      const halfLength = Math.sqrt(
        (wheelRadius - 0.07) ** 2 - offset ** 2,
      );
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(2 * halfLength, 0.12, 0.060),
        wheelMaterial,
      );
      spoke.rotation.z = direction;
      spoke.position.set(
        -Math.sin(direction) * offset,
        Math.cos(direction) * offset,
        side * wheelWidth / 2,
      );
      spoke.userData.halfLength = halfLength;
      spoke.userData.latticeOffset = offset;
      spoke.userData.index = index;
      spoke.userData.side = side;
      spoke.userData.role = 'radial-cage-wheel-side-spoke';
      radialSpokes.push(spoke);
      wheelRotor.add(spoke);
    }
  }
  const treadBoards = [];
  for (let index = 0; index < treadCount; index += 1) {
    const angle = index * treadPitch;
    const tread = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.085, wheelWidth * 0.92),
      treadMaterial,
    );
    tread.position.set(
      Math.cos(angle) * innerTreadRadius,
      Math.sin(angle) * innerTreadRadius,
      0,
    );
    tread.rotation.z = angle + Math.PI / 2;
    tread.userData.index = index;
    tread.userData.role =
      'cross-width-internal-tread-board-rigid-with-wheel';
    treadBoards.push(tread);
    wheelRotor.add(tread);
  }
  const axialRails = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = index * FULL_TURN / 8;
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.075, wheelWidth),
      wheelMaterial,
    );
    rail.position.set(
      Math.cos(angle) * (wheelRadius - 0.07),
      Math.sin(angle) * (wheelRadius - 0.07),
      0,
    );
    rail.userData.index = index;
    rail.userData.role = 'internal-cage-brace-between-treadwheel-rings';
    axialRails.push(rail);
    wheelRotor.add(rail);
  }
  const wheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.065, 0.035),
    whiteMaterial,
  );
  wheelIndex.position.set(1.37, 0, wheelWidth / 2 + 0.055);
  wheelIndex.userData.role =
    'white-index-showing-treadwheel-and-output-shaft-rotation';
  wheelRotor.add(wheelIndex);

  const animal = new THREE.Group();
  animal.position.set(-0.32, -0.60, 0.03);
  animal.userData.fixedInWorld = true;
  animal.userData.role =
    'animal-held-at-one-side-while-walking-up-moving-interior';
  root.add(animal);
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.36, 0.70, 8, 20),
    animalMaterial,
  );
  torso.rotation.z = Math.PI / 2;
  torso.scale.z = 0.74;
  torso.userData.role = 'stylized-horse-torso';
  animal.add(torso);
  const neck = tubeBetween(
    new THREE.Vector3(-0.43, 0.18, 0),
    new THREE.Vector3(-0.72, 0.55, 0),
    0.18,
    animalMaterial,
  );
  neck.userData.role = 'stylized-horse-neck';
  animal.add(neck);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 28, 18),
    animalMaterial,
  );
  head.scale.set(1.34, 0.72, 0.74);
  head.position.set(-0.88, 0.60, 0);
  head.rotation.z = -0.16;
  head.userData.role = 'stylized-horse-head-facing-up-tread';
  animal.add(head);
  const muzzle = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 24, 14),
    animalDarkMaterial,
  );
  muzzle.scale.set(1.30, 0.62, 0.68);
  muzzle.position.set(-1.14, 0.55, 0);
  muzzle.userData.role = 'horse-muzzle';
  animal.add(muzzle);
  const ears = [];
  for (const z of [-0.10, 0.10]) {
    const ear = new THREE.Mesh(
      new THREE.ConeGeometry(0.075, 0.25, 14),
      animalDarkMaterial,
    );
    ear.position.set(-0.80, 0.86, z);
    ear.rotation.z = -0.18;
    ear.userData.role = 'horse-ear';
    ears.push(ear);
    animal.add(ear);
  }
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 14, 10),
    darkMaterial,
  );
  eye.position.set(-1.00, 0.67, wheelWidth * 0.27);
  eye.userData.role = 'horse-eye';
  animal.add(eye);

  const legRoots = [];
  const kneePivots = [];
  const upperLegs = [];
  const lowerLegs = [];
  const hooves = [];
  const upperLegLength = 0.43;
  const lowerLegLength = 0.38;
  const legDefinitions = [
    [-0.42, -0.28, 0.23],
    [0.31, -0.28, 0.23],
    [-0.43, -0.25, -0.23],
    [0.32, -0.25, -0.23],
  ];
  for (let index = 0; index < legDefinitions.length; index += 1) {
    const [x, y, z] = legDefinitions[index];
    const legRoot = new THREE.Group();
    legRoot.position.set(x, y, z);
    legRoot.userData.index = index;
    legRoot.userData.role = 'horse-leg-hip-pivot';
    animal.add(legRoot);
    legRoots.push(legRoot);
    const upperLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.105, upperLegLength, 0.105),
      index < 2 ? animalDarkMaterial : animalMaterial,
    );
    upperLeg.position.y = -upperLegLength / 2;
    upperLeg.userData.role = 'horse-upper-leg';
    legRoot.add(upperLeg);
    upperLegs.push(upperLeg);
    const knee = new THREE.Group();
    knee.position.y = -upperLegLength;
    knee.userData.index = index;
    knee.userData.role = 'horse-knee-pivot';
    legRoot.add(knee);
    kneePivots.push(knee);
    const lowerLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.085, lowerLegLength, 0.085),
      index < 2 ? animalDarkMaterial : animalMaterial,
    );
    lowerLeg.position.y = -lowerLegLength / 2;
    lowerLeg.userData.role = 'horse-lower-leg';
    knee.add(lowerLeg);
    lowerLegs.push(lowerLeg);
    const hoof = new THREE.Mesh(
      new THREE.BoxGeometry(0.21, 0.10, 0.14),
      darkMaterial,
    );
    hoof.position.set(-0.045, -lowerLegLength, 0);
    hoof.userData.role = 'horse-hoof';
    knee.add(hoof);
    hooves.push(hoof);
  }
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0.66, 0.18, 0);
  tailPivot.userData.role = 'smoothly-swinging-horse-tail-pivot';
  animal.add(tailPivot);
  const tail = tubeBetween(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.35, -0.53, 0),
    0.055,
    animalDarkMaterial,
  );
  tail.userData.role = 'horse-tail';
  tailPivot.add(tail);

  const axle = cylinderAlongZ(0.12, 2.18, darkMaterial, 30);
  axle.userData.role = 'horizontal-output-axle-rigid-with-treadwheel';
  wheelRotor.add(axle);
  const fixedBearings = [];
  const bearingArms = [];
  const supportPosts = [];
  for (const side of [-1, 1]) {
    const bearing = cylinderAlongZ(0.22, 0.28, frameMaterial, 30);
    bearing.position.z = side * 0.82;
    bearing.userData.fixed = true;
    bearing.userData.role = 'fixed-side-bearing-for-treadwheel-axle';
    fixedBearings.push(bearing);
    root.add(bearing);
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 2.22, 0.30),
      frameMaterial,
    );
    post.position.set(1.86, -1.08, side * 0.84);
    post.userData.fixed = true;
    post.userData.role = 'fixed-bearing-standard-outside-wheel-cage';
    supportPosts.push(post);
    root.add(post);
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(1.92, 0.18, 0.30),
      frameMaterial,
    );
    arm.position.set(0.93, 0, side * 0.84);
    arm.userData.fixed = true;
    arm.userData.role = 'fixed-overhung-arm-carrying-wheel-bearing';
    bearingArms.push(arm);
    root.add(arm);
  }
  const baseRails = [];
  for (const z of [-0.86, 0.86]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(4.82, 0.18, 0.34),
      frameMaterial,
    );
    rail.position.set(0, -2.17, z);
    rail.userData.fixed = true;
    rail.userData.role = 'fixed-base-rail-for-treadwheel-frame';
    baseRails.push(rail);
    root.add(rail);
  }

  const update = (time) => {
    const state = stateAtTime(time);
    wheelRotor.rotation.z = state.wheelAngle;
    for (let index = 0; index < legRoots.length; index += 1) {
      legRoots[index].rotation.z = state.legStates[index].upperAngle;
      kneePivots[index].rotation.z = state.legStates[index].lowerAngle;
    }
    tailPivot.rotation.z = state.tailAngle;
    root.userData.currentState = state;
    root.userData.weightDrive = {
      outputPower: state.outputPower,
      torque: state.animalWeightTorque,
    };
  };

  root.userData = {
    archetype: movement.archetype,
    blocks: {
      animal,
      axle,
      axialRails,
      baseRails,
      bearingArms,
      ears,
      eye,
      fixedBearings,
      head,
      hooves,
      kneePivots,
      legRoots,
      lowerLegs,
      muzzle,
      radialSpokes,
      sideRings,
      supportPosts,
      tail,
      tailPivot,
      torso,
      treadBoards,
      upperLegs,
      wheelIndex,
      wheelRotor,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      input:
        'animal walking upward relative to the interior tread at the same speed that the wheel surface moves downward',
      note:
        'the wheel and output axle are one rigid rotor; the four leg gestures are smooth gait visualization driven by wheel phase rather than additional mechanical coordinates',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid cage wheel, axle, braces, and tread boards',
        'animal body held at one mean world position while its legs display a smooth gait',
        'no relative slip in the mean animal-to-tread climbing balance',
        'constant animal mass and gravitational field',
        'steady output load balancing the animal-weight torque so speed is uniform',
      ],
      sourceSpecifiesDimensionsTimingTreadCountAnimalMassOrLoad: false,
      treatment:
        'Brown specifies the weight-driven operating principle and historical applications but no numerical dimensions, speed, tread count, animal mass, or load; geometry and gait are engineered, while rigid-wheel motion, relative climb, gravity torque, and power are solved analytically',
    },
    fidelity: 'authored',
    geometry: {
      animalCenterOfMass,
      animalStationAngle,
      animalStationPoint,
      gaitAngularSpeed,
      gaitCyclesPerWheelTurn,
      innerTreadRadius,
      legPhaseOffsets,
      lowerLegAmplitude,
      lowerLegBaseAngle,
      treadCount,
      treadPitch,
      upperLegAmplitude,
      upperLegBaseAngles,
      wheelPeriod,
      wheelRadius,
      wheelStartAngle,
      wheelWidth,
    },
    mechanism:
      'one-animal-walks-up-one-side-of-the-interior-of-one-horizontal-axis-cage-treadwheel-so-gravity-turns-the-rigid-wheel-and-coaxial-output-shaft',
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate376: {
        horseHeadCenter: new THREE.Vector2(151, 250),
        horseTorsoCenter: new THREE.Vector2(252, 317),
        imageHeight: 525,
        imageWidth: 525,
        innerWheelBottom: new THREE.Vector2(269, 457),
        innerWheelLeft: new THREE.Vector2(70, 257),
        measurementUncertaintyPixels: 9,
        outerWheelBottom: new THREE.Vector2(266, 499),
        outerWheelCenter: new THREE.Vector2(265, 261),
        outerWheelLeft: new THREE.Vector2(29, 257),
        outerWheelRight: new THREE.Vector2(501, 257),
        outerWheelTop: new THREE.Vector2(265, 26),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'animal weight turns a tread wheel',
          'the animal attempts to walk up one side of the wheel interior',
          'horse-powered examples drove ferry-boat paddle wheels and other machinery',
          'smaller historical examples used a turn-spit dog to rotate roasting meat',
        ],
        engravingEvidence:
          'the plate shows one horse entirely inside a large circular cage wheel, two concentric side rims, repeated internal tread and brace members, and the animal facing upward on the left-hand interior side',
        reconstructionDisclosure:
          'wheel depth, sixteen tread boards, four diameter braces per side, eight axial ring connectors, supports, colors, speed, animal mass, and stylized smooth leg gait are engineered because Brown gives no values and the official page has no canvas animation; the gait is explanatory and not a biomechanical force simulation',
      },
      officialPage: 'https://507movements.com/mm_376.html',
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod: wheelPeriod,
      note:
        'one displayed wheel revolution advances all sixteen tread boards once around the cage and contains eight smooth closed gait cycles, returning every visible rigid and articulated index to its start pose',
    },
    transmission: {
      animalRelativeClimbSpeed,
      meanNoDriftLaw:
        'animal climbing velocity relative to the wheel is equal and opposite to the interior tread surface velocity at the animal station',
      outputPower,
      outputTorque: animalWeightTorque,
      treadPassingFrequency: treadCount / wheelPeriod,
      weightTorqueLaw:
        'output torque about the horizontal axle is the cross product of the animal center-of-mass offset and its weight',
    },
  };

  correctRunnerTreadParts(root, 376);
  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.62, -2.40, -1.26),
    new THREE.Vector3(2.62, 2.37, 1.26),
  );
  root.userData.groundFloorY = -2.27;
  // A narrow field keeps the face-on plate view flat: the rear rim and the
  // tread ends stay hidden behind the front rim band.
  root.userData.cameraFov = 16;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(2.8, 2.0, 11.8),
    root,
    update,
  };
}

export function createAuthoredAnimalTreadwheelMovement(movement) {
  if (movement.id !== 376) return null;
  return finishRunnerTread(animalInteriorTreadwheel(movement), 376);
}
