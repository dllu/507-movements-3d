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
  // Brown's horse climbs the rising side: its body is tilted nose-up, the
  // forelegs reach forward onto the rising treads and the hind legs push
  // down onto the lowest ones. Base angles are in the tilted body frame.
  const upperLegBaseAngles = [-1.15, -0.06, -0.98, 0.04];
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
      wheelMaterial,
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
    new THREE.Vector3(-0.80, 0.37, 0),
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
  head.position.set(-0.94, 0.40, 0);
  head.rotation.z = -0.16;
  head.userData.role = 'stylized-horse-head-facing-up-tread';
  animal.add(head);
  const muzzle = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 24, 14),
    animalMaterial,
  );
  muzzle.scale.set(1.15, 0.72, 0.70);
  muzzle.position.set(-1.14, 0.34, 0);
  muzzle.userData.role = 'horse-muzzle';
  animal.add(muzzle);
  const ears = [];
  for (const z of [-0.10, 0.10]) {
    const ear = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.17, 14),
      animalDarkMaterial,
    );
    ear.position.set(-0.84, 0.62, z);
    ear.rotation.z = -0.18;
    ear.userData.role = 'horse-ear';
    ears.push(ear);
    animal.add(ear);
  }
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 14, 10),
    darkMaterial,
  );
  eye.position.set(-1.06, 0.47, wheelWidth * 0.27);
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
      neck,
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

// A rounded solid from a side-view outline: the bevel starts inside the
// outline, so the silhouette is exactly the traced profile.
function roundedProfile(points, depth, bevel, material) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelOffset: -bevel,
    bevelSegments: 4,
    bevelSize: bevel,
    bevelThickness: bevel * 1.2,
    curveSegments: 12,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

// Plate 376 engraves a realistic horse: a deep barrel with a rounded croup,
// a crested neck carried forward and a long head with the nose dropped, and
// slim jointed legs. The outlines below are that side view in the horse's
// own frame (head toward -x, back up), drawn to Brown's proportions; the
// whole horse is tilted nose-up on the rising side as he draws it.
const HORSE_BARREL = [
  [-0.62, 0.00], [-0.60, 0.18], [-0.46, 0.36], [-0.34, 0.40], [-0.18, 0.34],
  [-0.05, 0.31], [0.12, 0.31], [0.28, 0.33], [0.46, 0.37], [0.60, 0.34],
  [0.70, 0.24], [0.75, 0.09], [0.72, -0.04], [0.64, -0.14], [0.50, -0.22],
  [0.40, -0.23], [0.30, -0.225], [0.15, -0.25], [-0.10, -0.26],
  [-0.30, -0.25], [-0.42, -0.225], [-0.54, -0.19], [-0.60, -0.11],
];
const HORSE_NECK = [
  [-0.45, 0.08], [-0.60, 0.10], [-0.78, 0.22], [-0.96, 0.38], [-1.07, 0.52],
  [-1.11, 0.66], [-1.06, 0.76], [-0.96, 0.77], [-0.80, 0.68], [-0.62, 0.55],
  [-0.46, 0.44], [-0.34, 0.36], [-0.32, 0.24],
];
const HORSE_HEAD = [
  [-1.00, 0.72], [-1.06, 0.80], [-1.15, 0.78], [-1.22, 0.66], [-1.28, 0.50],
  [-1.32, 0.39], [-1.33, 0.33], [-1.29, 0.28], [-1.21, 0.29], [-1.12, 0.38],
  [-1.03, 0.50], [-0.98, 0.62],
];
// Leg outlines hang from their hip or knee pivot (y = 0) down the leg. The
// tops are round about the pivot so a swinging leg never rises into the
// belly.
const legTop = (radius) => Array.from({ length: 9 }, (_, index) => {
  const angle = Math.PI * (1 - index / 8);
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
});
const HORSE_FOREARM = [
  ...legTop(0.072), [0.066, -0.10], [0.042, -0.30],
  [0.036, -0.37], [0.012, -0.394], [-0.028, -0.392], [-0.045, -0.36],
  [-0.058, -0.20], [-0.068, -0.06],
];
const HORSE_GASKIN = [
  ...legTop(0.074), [0.098, -0.10], [0.070, -0.26],
  [0.074, -0.35], [0.052, -0.39], [0.006, -0.395], [-0.036, -0.375],
  [-0.050, -0.26], [-0.066, -0.10],
];
// The cannon's top is a round knee cap about the knee pivot, so the leg
// reads as jointed at every bend without reaching into the upper bar.
const HORSE_CANNON = [
  ...Array.from({ length: 9 }, (_, index) => {
    const angle = Math.PI * (1 - index / 8);
    return [0.029 * Math.cos(angle), 0.029 * Math.sin(angle)];
  }),
  [0.028, -0.25], [0.042, -0.30],
  [0.030, -0.335], [0.004, -0.37], [-0.040, -0.375], [-0.040, -0.345],
  [-0.030, -0.30], [-0.030, -0.25],
];
const HORSE_HOOF = [
  [-0.085, 0.030], [0.015, 0.030], [0.045, -0.050], [-0.118, -0.050],
];
function horseTailOutline() {
  const spine = [[0.00, 0.00], [0.10, -0.08], [0.18, -0.22], [0.21, -0.38],
    [0.22, -0.52], [0.27, -0.64]];
  const widths = [0.07, 0.10, 0.13, 0.13, 0.10, 0.05];
  const left = [];
  const right = [];
  for (let index = 0; index < spine.length; index += 1) {
    const previous = spine[Math.max(0, index - 1)];
    const next = spine[Math.min(spine.length - 1, index + 1)];
    const tangent = new THREE.Vector2(next[0] - previous[0], next[1] - previous[1]).normalize();
    const normal = new THREE.Vector2(-tangent.y, tangent.x);
    const half = widths[index] / 2;
    left.push([spine[index][0] + normal.x * half, spine[index][1] + normal.y * half]);
    right.push([spine[index][0] - normal.x * half, spine[index][1] - normal.y * half]);
  }
  return [...left, ...right.reverse()];
}

function modelBrownHorse(blocks) {
  const replaceGeometry = (mesh, geometry) => {
    mesh.geometry.dispose();
    mesh.geometry = geometry;
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);
  };
  const bodyMaterial = blocks.torso.material;
  replaceGeometry(blocks.torso, roundedProfile(HORSE_BARREL, 0.28, 0.10, bodyMaterial));
  blocks.torso.userData.role = 'engraved-horse-barrel-chest-and-croup';
  replaceGeometry(blocks.neck, roundedProfile(HORSE_NECK, 0.16, 0.07, bodyMaterial));
  blocks.neck.userData.role = 'engraved-horse-crested-neck';
  replaceGeometry(blocks.head, roundedProfile(HORSE_HEAD, 0.12, 0.06, bodyMaterial));
  blocks.head.userData.role = 'engraved-horse-long-head-nose-dropped';
  // The traced head already includes the muzzle.
  blocks.muzzle.visible = false;
  blocks.ears.forEach((ear, index) => {
    ear.position.set(-1.06, 0.86, index === 0 ? -0.05 : 0.05);
    ear.rotation.set(0, 0, -0.35);
  });
  blocks.eye.position.set(-1.16, 0.64, 0.135);
  blocks.legRoots.forEach((legRoot, index) => {
    const front = index % 2 === 0;
    const upper = blocks.upperLegs[index];
    const lower = blocks.lowerLegs[index];
    const hoof = blocks.hooves[index];
    replaceGeometry(upper, roundedProfile(front ? HORSE_FOREARM : HORSE_GASKIN, 0.07, 0.025, upper.material));
    replaceGeometry(lower, roundedProfile(HORSE_CANNON, 0.05, 0.02, lower.material));
    const hoofPosition = hoof.position.clone();
    replaceGeometry(hoof, roundedProfile(HORSE_HOOF, 0.06, 0.02, hoof.material));
    hoof.position.copy(hoofPosition);
  });
  blocks.tailPivot.position.set(0.765, 0.19, 0);
  const tailMaterial = blocks.tail.material;
  replaceGeometry(blocks.tail, roundedProfile(horseTailOutline(), 0.04, 0.012, tailMaterial));
  blocks.tail.userData.role = 'engraved-horse-flowing-tail';
}

// Plate 376 draws the horse's back rising about 24 degrees toward its head.
const animalClimbTilt = THREE.MathUtils.degToRad(24);

export function createAuthoredAnimalTreadwheelMovement(movement) {
  if (movement.id !== 376) return null;
  const model = animalInteriorTreadwheel(movement);
  const { blocks } = model.root.userData;
  // Brown's horse climbs the rising side left of and below the axle: the
  // body is tilted nose-up, the forelegs reach forward to the rising treads
  // and the hind legs stand on the lowest ones. The leg scales keep every
  // hoof inside the tread-board faces (radius 1.657) through the whole gait
  // (the forehooves reach 1.648) while the torso clears the axle.
  blocks.animal.position.set(-0.20, -0.55, 0.03);
  blocks.animal.rotation.z = -animalClimbTilt;
  const legScales = [0.84, 0.86, 0.84, 0.86];
  blocks.legRoots.forEach((legRoot, index) => legRoot.scale.setScalar(legScales[index]));
  model.root.userData.animalPlacement = {
    legScales,
    climbTilt: animalClimbTilt,
    maximumHoofRadius: 'kept below the 1.657 tread-board face radius',
  };
  // Joints: the hips hang just below the torso shell, the upper-leg bars
  // stop short of the knee so the bent lower bar's corners clear them, and
  // the tail is rooted on the rump surface rather than inside it.
  const hipHeights = [-0.31, -0.31, -0.29, -0.29];
  blocks.legRoots.forEach((legRoot, index) => {
    legRoot.position.y = hipHeights[index];
  });
  const kneeGap = 0.025;
  for (const upperLeg of blocks.upperLegs) {
    const { height, width, depth } = upperLeg.geometry.parameters;
    upperLeg.geometry.dispose();
    upperLeg.geometry = new THREE.BoxGeometry(width, height - kneeGap, depth);
    upperLeg.position.y = -(height - kneeGap) / 2;
  }
  blocks.tailPivot.position.set(0.722, 0.216, 0);
  modelBrownHorse(blocks);
  // Hooves on the treads: the tread face is a circle about the fixed axle,
  // so the lowest hoof's height above it depends only on the gait pose.
  // After posing the legs the body is let down along the local radius
  // until that hoof rests on the face, so one stance hoof always carries
  // the horse instead of the whole animal hovering by up to 0.08.
  const treadFaceRadius = model.root.userData.geometry.innerTreadRadius
    - 0.085 / 2;
  const hoofClearance = 0.003;
  const baseAnimalPosition = blocks.animal.position.clone();
  const corner = new THREE.Vector3();
  const lowestHoofGap = () => {
    blocks.animal.updateMatrixWorld(true);
    let gap = Infinity;
    // The hind hooves stand on the lowest treads and carry the body; the
    // forehooves reach onto the rising side, where the tread face is nearly
    // vertical, so they are posed to stay just inside it instead.
    for (const hoof of [blocks.hooves[1], blocks.hooves[3]]) {
      if (!hoof.geometry.boundingBox) hoof.geometry.computeBoundingBox();
      const { min, max } = hoof.geometry.boundingBox;
      for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) {
        corner.set(x, y, 0).applyMatrix4(hoof.matrixWorld);
        gap = Math.min(gap, treadFaceRadius - Math.hypot(corner.x, corner.y));
      }
    }
    return gap;
  };
  const baseUpdate = model.update;
  model.update = (time, ...rest) => {
    baseUpdate(time, ...rest);
    blocks.animal.position.copy(baseAnimalPosition);
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const gap = lowestHoofGap() - hoofClearance;
      if (Math.abs(gap) < 1e-6) break;
      blocks.animal.position.y -= gap;
    }
    model.root.userData.animalDrop = baseAnimalPosition.y
      - blocks.animal.position.y;
  };
  model.root.userData.animalPlacement.hoofContact =
    'body lowered each frame until the lower hind hoof rests on the tread face; the forehooves reach the rising side without penetrating it';
  model.root.userData.workingPartsReview.qualification = 'The leg animation and balanced mean weight torque remain prescribed. The body bobs so the lowest hoof rests on the tread-face circle; hoof loads and slip remain unqualified.';
  model.update(0);
  finishRunnerTread(model, 376);
  // Brown draws no separate treads, only a narrow inner ring just inside the
  // riveted band: the boards and their brackets take the rim's colour so
  // they read as that ring rather than as bright slats.
  const rimMaterial = blocks.faceRims[0].material;
  for (const part of [...blocks.treadBoards, ...blocks.treadMounts]) {
    part.material = rimMaterial;
  }
  return model;
}
