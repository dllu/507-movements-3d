import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherStep01(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return u ** 3 * (u * (u * 6 - 15) + 10);
}

function smootherStepFirstDerivative(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * u ** 2 * (u - 1) ** 2;
}

function smootherStepSecondDerivative(value) {
  const u = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * u * (u - 1) * (2 * u - 1);
}

function transitionState(time, start, end, from, to) {
  if (time <= start) return { acceleration: 0, value: from, velocity: 0 };
  if (time >= end) return { acceleration: 0, value: to, velocity: 0 };
  const duration = end - start;
  const u = (time - start) / duration;
  const travel = to - from;
  return {
    acceleration: travel * smootherStepSecondDerivative(u) / duration ** 2,
    value: from + travel * smootherStep01(u),
    velocity: travel * smootherStepFirstDerivative(u) / duration,
  };
}

function helixCurve({ maximumY, minimumY, phase = 0, pitch, radius }) {
  const height = maximumY - minimumY;
  return new class extends THREE.Curve {
    getPoint(parameter, target = new THREE.Vector3()) {
      const y = minimumY + height * parameter;
      const angle = phase + (y - minimumY) / pitch * FULL_TURN;
      return target.set(
        radius * Math.cos(angle),
        y,
        radius * Math.sin(angle),
      );
    }
  }();
}

function makeCutawayLathe({
  cutawayHalfAngle,
  material,
  profile,
  role,
  sectionMaterial,
  segments = 96,
}) {
  const group = new THREE.Group();
  group.userData.cutawayHalfAngle = cutawayHalfAngle;
  group.userData.role = role;
  const shell = new THREE.Mesh(
    new THREE.LatheGeometry(
      profile,
      segments,
      cutawayHalfAngle,
      FULL_TURN - 2 * cutawayHalfAngle,
    ),
    material,
  );
  shell.userData.physicalSectionCutaway = true;
  shell.userData.role = `${role}-shell`;
  group.add(shell);

  const sectionShape = new THREE.Shape();
  profile.forEach((point, index) => {
    if (index === 0) sectionShape.moveTo(point.x, point.y);
    else sectionShape.lineTo(point.x, point.y);
  });
  sectionShape.closePath();
  const sectionGeometry = new THREE.ShapeGeometry(sectionShape, 20);
  const sectionFaces = [
    cutawayHalfAngle,
    FULL_TURN - cutawayHalfAngle,
  ].map((angle, index) => {
    const face = new THREE.Mesh(sectionGeometry, sectionMaterial);
    face.rotation.y = angle - Math.PI / 2;
    face.userData.role = `${role}-section-face-${index + 1}`;
    group.add(face);
    return face;
  });
  return { group, sectionFaces, shell };
}

function makeCutawayAnnularCylinder({
  cutawayHalfAngle,
  innerRadius,
  material,
  maximumY,
  minimumY,
  outerRadius,
  role,
  sectionMaterial,
}) {
  return makeCutawayLathe({
    cutawayHalfAngle,
    material,
    profile: [
      new THREE.Vector2(innerRadius, minimumY),
      new THREE.Vector2(outerRadius, minimumY),
      new THREE.Vector2(outerRadius, maximumY),
      new THREE.Vector2(innerRadius, maximumY),
    ],
    role,
    sectionMaterial,
  });
}

function makeThread({
  color,
  maximumY,
  minimumY,
  phase = 0,
  pitch,
  radius,
  role,
  tubeRadius,
  turns,
}) {
  const curve = helixCurve({
    maximumY,
    minimumY,
    phase,
    pitch,
    radius,
  });
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(
      curve,
      Math.ceil(turns * 56),
      tubeRadius,
      8,
      false,
    ),
    matte(color, { metalness: 0.22, roughness: 0.48 }),
  );
  mesh.userData.pitch = pitch;
  mesh.userData.radius = radius;
  mesh.userData.rightHand = true;
  mesh.userData.role = role;
  mesh.userData.turns = turns;
  return { curve, mesh };
}

function unionPipeCoupling(movement) {
  const root = new THREE.Group();

  // Brown's 525 px plate is a longitudinal section. Pipe A is unhatched so
  // its flange and locating spigot remain distinct from the hatched nut B and
  // fixed threaded pipe C. All radii below retain those measured proportions.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.012;
  const sourcePipeABounds = {
    bottom: 309,
    left: 159,
    right: 352,
    top: 13,
  };
  const sourcePipeAFlangeBounds = {
    bottom: 241,
    left: 114,
    right: 399,
    top: 198,
  };
  const sourceNutBBounds = {
    bottom: 349,
    left: 62,
    right: 462,
    top: 160,
  };
  const sourcePipeCBodyBounds = {
    bottom: 502,
    left: 159,
    right: 368,
    top: 239,
  };
  const sourcePipeBoreBounds = {
    left: 193,
    right: 329,
  };
  const sourceThreadBounds = {
    bottom: 355,
    left: 111,
    right: 413,
    top: 238,
  };

  const cutawayHalfAngle = 0.72;
  const pipeBoreRadius = 0.54;
  const pipeAOuterRadius = 0.84;
  const pipeAMinimumY = 1.3;
  const pipeAMaximumY = 4.5;
  const flangeBottomY = 1;
  const flangeTopY = 1.3;
  const flangeRadius = 1.18;
  const spigotOuterRadius = 0.72;
  const spigotMinimumY = 0.28;
  const spigotMaximumY = flangeBottomY;
  const pipeCSeatY = flangeBottomY;
  const pipeCBodyOuterRadius = 0.9;
  const pipeCBodyMinimumY = -3;
  const pipeCBodyMaximumY = spigotMinimumY - 0.03;
  const counterboreRadius = 0.76;
  const spigotRadialClearance = counterboreRadius - spigotOuterRadius;
  const spigotBottomClearance = spigotMinimumY - pipeCBodyMaximumY;
  const threadedBossCoreRadius = 1.02;
  const threadedBossMinimumY = pipeCBodyMaximumY;
  const threadedBossMaximumY = pipeCSeatY;

  const threadPitch = 0.36;
  const threadStarts = 1;
  const threadLead = threadPitch * threadStarts;
  const threadLeadPerRadian = threadLead / FULL_TURN;
  const threadWaveNumber = FULL_TURN / threadPitch;
  const threadTurns = 3;
  const externalThreadMinimumY = -0.2;
  const externalThreadMaximumY = externalThreadMinimumY
    + threadTurns * threadPitch;
  const externalThreadRadius = 1.12;
  const externalThreadTubeRadius = 0.07;
  const internalThreadMinimumY = -0.95;
  const internalThreadMaximumY = internalThreadMinimumY
    + threadTurns * threadPitch;
  const internalThreadRadius = 1.245;
  const internalThreadTubeRadius = 0.04;
  const threadPitchRadius = 1.18;
  const threadRadialClearance = internalThreadRadius
    - internalThreadTubeRadius
    - externalThreadRadius
    - externalThreadTubeRadius;

  const nutOuterBodyRadius = 1.65;
  const nutOuterCollarRadius = 1.82;
  const nutCavityRadius = 1.3;
  const nutShoulderBoreRadius = 0.94;
  const nutMinimumLocalY = -1.02;
  const nutCollarTopLocalY = -0.55;
  const nutMaximumLocalY = 0.86;
  const nutShoulderUndersideLocalY = 0.53;
  const tightNutY = flangeTopY - nutShoulderUndersideLocalY;
  const loosenTurns = 3;
  const looseNutAngle = -loosenTurns * FULL_TURN;
  const unscrewTravel = loosenTurns * threadLead;
  const looseNutY = tightNutY + unscrewTravel;
  const disengagedThreadAxialClearance = looseNutY
    + internalThreadMinimumY - externalThreadMaximumY;
  const pipeToShoulderRadialClearance = nutShoulderBoreRadius
    - pipeAOuterRadius;
  const flangeToNutCavityRadialClearance = nutCavityRadius - flangeRadius;
  const captiveShoulderOverlap = flangeRadius - nutShoulderBoreRadius;
  const separationTravel = 1.5;

  const cyclePeriod = 12;
  const timeline = Object.freeze({
    tightDwellEnd: 0.6,
    unscrewed: 3.1,
    looseDwellEnd: 3.5,
    flangeCaptured: 4.4,
    fullySeparated: 5.7,
    separatedDwellEnd: 6.4,
    returnedTogether: 7.7,
    pipeAReseated: 8.6,
    retightened: 11.1,
    cycleClosure: cyclePeriod,
  });

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.15,
    roughness: 0.57,
    side: THREE.DoubleSide,
  });
  const driverSectionMaterial = matte(0xb94832, {
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
  const nutMaterial = matte(PALETTE.driven, {
    metalness: 0.17,
    roughness: 0.54,
    side: THREE.DoubleSide,
  });
  const nutSectionMaterial = matte(0x234b62, {
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
  const pipeCMaterial = matte(PALETTE.frame, {
    metalness: 0.16,
    roughness: 0.61,
    side: THREE.DoubleSide,
  });
  const pipeCSectionMaterial = matte(0x434a49, {
    roughness: 0.75,
    side: THREE.DoubleSide,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.45 });

  const pipeC = new THREE.Group();
  pipeC.userData.axis = Y_AXIS.clone();
  pipeC.userData.fixed = true;
  pipeC.userData.role = 'fixed-lower-pipe-C-with-external-threaded-end';
  const pipeCBodyParts = makeCutawayAnnularCylinder({
    cutawayHalfAngle,
    innerRadius: pipeBoreRadius,
    material: pipeCMaterial,
    maximumY: pipeCBodyMaximumY,
    minimumY: pipeCBodyMinimumY,
    outerRadius: pipeCBodyOuterRadius,
    role: 'hollow-lower-body-of-pipe-C',
    sectionMaterial: pipeCSectionMaterial,
  });
  const pipeCBossParts = makeCutawayAnnularCylinder({
    cutawayHalfAngle,
    innerRadius: counterboreRadius,
    material: pipeCMaterial,
    maximumY: threadedBossMaximumY,
    minimumY: threadedBossMinimumY,
    outerRadius: threadedBossCoreRadius,
    role: 'counterbored-thread-core-at-end-of-pipe-C',
    sectionMaterial: pipeCSectionMaterial,
  });
  const pipeCSeat = new THREE.Mesh(
    new THREE.TorusGeometry(
      (counterboreRadius + flangeRadius) / 2,
      (flangeRadius - counterboreRadius) / 2,
      10,
      72,
      FULL_TURN - 2 * cutawayHalfAngle,
    ),
    darkMaterial,
  );
  pipeCSeat.rotation.x = Math.PI / 2;
  pipeCSeat.rotation.z = cutawayHalfAngle;
  pipeCSeat.position.y = pipeCSeatY - 0.018;
  pipeCSeat.userData.role = 'annular-end-face-of-C-abutting-flange-A';
  const externalThreadParts = makeThread({
    color: PALETTE.ink,
    maximumY: externalThreadMaximumY,
    minimumY: externalThreadMinimumY,
    pitch: threadPitch,
    radius: externalThreadRadius,
    role: 'three-turn-right-hand-external-thread-on-pipe-C',
    tubeRadius: externalThreadTubeRadius,
    turns: threadTurns,
  });
  pipeC.add(
    pipeCBodyParts.group,
    pipeCBossParts.group,
    pipeCSeat,
    externalThreadParts.mesh,
  );
  root.add(pipeC);

  const pipeA = new THREE.Group();
  pipeA.userData.axis = Y_AXIS.clone();
  pipeA.userData.role =
    'nonrotating-upper-pipe-A-with-small-flange-and-locating-spigot';
  const pipeABodyParts = makeCutawayAnnularCylinder({
    cutawayHalfAngle,
    innerRadius: pipeBoreRadius,
    material: driverMaterial,
    maximumY: pipeAMaximumY,
    minimumY: pipeAMinimumY,
    outerRadius: pipeAOuterRadius,
    role: 'hollow-upper-body-of-pipe-A',
    sectionMaterial: driverSectionMaterial,
  });
  const flangeParts = makeCutawayAnnularCylinder({
    cutawayHalfAngle,
    innerRadius: pipeBoreRadius,
    material: driverMaterial,
    maximumY: flangeTopY,
    minimumY: flangeBottomY,
    outerRadius: flangeRadius,
    role: 'small-captive-abutting-flange-on-pipe-A',
    sectionMaterial: driverSectionMaterial,
  });
  const spigotParts = makeCutawayAnnularCylinder({
    cutawayHalfAngle,
    innerRadius: pipeBoreRadius,
    material: driverMaterial,
    maximumY: spigotMaximumY,
    minimumY: spigotMinimumY,
    outerRadius: spigotOuterRadius,
    role: 'locating-spigot-of-A-inside-counterbore-C',
    sectionMaterial: driverSectionMaterial,
  });
  pipeA.add(
    pipeABodyParts.group,
    flangeParts.group,
    spigotParts.group,
  );
  root.add(pipeA);

  const nutB = new THREE.Group();
  nutB.userData.axis = Y_AXIS.clone();
  nutB.userData.role =
    'rotating-captive-union-nut-B-with-internal-right-hand-thread';
  const nutProfile = [
    new THREE.Vector2(nutCavityRadius, nutMinimumLocalY),
    new THREE.Vector2(nutOuterCollarRadius, nutMinimumLocalY),
    new THREE.Vector2(nutOuterCollarRadius, nutCollarTopLocalY),
    new THREE.Vector2(nutOuterBodyRadius, nutCollarTopLocalY),
    new THREE.Vector2(nutOuterBodyRadius, nutMaximumLocalY),
    new THREE.Vector2(nutShoulderBoreRadius, nutMaximumLocalY),
    new THREE.Vector2(
      nutShoulderBoreRadius,
      nutShoulderUndersideLocalY,
    ),
    new THREE.Vector2(nutCavityRadius, nutShoulderUndersideLocalY),
  ];
  const nutBodyParts = makeCutawayLathe({
    cutawayHalfAngle,
    material: nutMaterial,
    profile: nutProfile,
    role: 'stepped-hollow-body-and-inward-shoulder-of-nut-B',
    sectionMaterial: nutSectionMaterial,
    segments: 112,
  });
  nutB.add(nutBodyParts.group);

  const internalThreadPhase = threadWaveNumber * (
    tightNutY + internalThreadMinimumY - externalThreadMinimumY
  );
  const internalThreadParts = makeThread({
    color: PALETTE.brass,
    maximumY: internalThreadMaximumY,
    minimumY: internalThreadMinimumY,
    phase: internalThreadPhase,
    pitch: threadPitch,
    radius: internalThreadRadius,
    role: 'matching-three-turn-internal-thread-in-nut-B',
    tubeRadius: internalThreadTubeRadius,
    turns: threadTurns,
  });
  nutB.add(internalThreadParts.mesh);

  const gripRibs = Array.from({ length: 10 }, (_, index) => {
    const fraction = (index + 0.5) / 10;
    const angle = THREE.MathUtils.lerp(
      cutawayHalfAngle,
      FULL_TURN - cutawayHalfAngle,
      fraction,
    );
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.78, 0.15),
      index === 2 ? whiteMaterial : darkMaterial,
    );
    const radius = nutOuterBodyRadius + 0.055;
    rib.position.set(
      radius * Math.sin(angle),
      0.08,
      radius * Math.cos(angle),
    );
    rib.rotation.y = angle;
    rib.userData.role = index === 2
      ? 'white-rotation-index-on-nut-B'
      : 'raised-grip-rib-on-nut-B';
    nutB.add(rib);
    return rib;
  });
  root.add(nutB);

  const stageAtTime = (cycleTime) => {
    if (cycleTime < timeline.tightDwellEnd) return 'tight-dwell';
    if (cycleTime < timeline.unscrewed) return 'unscrewing-nut-B';
    if (cycleTime < timeline.looseDwellEnd) return 'loose-thread-dwell';
    if (cycleTime < timeline.flangeCaptured) {
      return 'lifting-A-to-captive-shoulder';
    }
    if (cycleTime < timeline.fullySeparated) {
      return 'withdrawing-captive-A-and-B';
    }
    if (cycleTime < timeline.separatedDwellEnd) return 'separated-dwell';
    if (cycleTime < timeline.returnedTogether) {
      return 'returning-captive-A-and-B';
    }
    if (cycleTime < timeline.pipeAReseated) return 'lowering-A-onto-C';
    if (cycleTime < timeline.retightened) return 'tightening-nut-B';
    return 'tight-dwell';
  };

  const stateAtTime = (time) => {
    const cycleTime = positiveModulo(time, cyclePeriod);
    let nutAngleState = { acceleration: 0, value: 0, velocity: 0 };
    let nutYState = { acceleration: 0, value: tightNutY, velocity: 0 };
    let pipeAYState = { acceleration: 0, value: 0, velocity: 0 };

    if (cycleTime >= timeline.tightDwellEnd
      && cycleTime < timeline.unscrewed) {
      nutAngleState = transitionState(
        cycleTime,
        timeline.tightDwellEnd,
        timeline.unscrewed,
        0,
        looseNutAngle,
      );
      nutYState = {
        acceleration: -threadLeadPerRadian
          * nutAngleState.acceleration,
        value: tightNutY - threadLeadPerRadian * nutAngleState.value,
        velocity: -threadLeadPerRadian * nutAngleState.velocity,
      };
    } else if (cycleTime >= timeline.unscrewed
      && cycleTime < timeline.flangeCaptured) {
      nutAngleState = {
        acceleration: 0,
        value: looseNutAngle,
        velocity: 0,
      };
      nutYState = { acceleration: 0, value: looseNutY, velocity: 0 };
      if (cycleTime >= timeline.looseDwellEnd) {
        pipeAYState = transitionState(
          cycleTime,
          timeline.looseDwellEnd,
          timeline.flangeCaptured,
          0,
          unscrewTravel,
        );
      }
    } else if (cycleTime >= timeline.flangeCaptured
      && cycleTime < timeline.fullySeparated) {
      const commonLift = transitionState(
        cycleTime,
        timeline.flangeCaptured,
        timeline.fullySeparated,
        0,
        separationTravel,
      );
      nutAngleState = {
        acceleration: 0,
        value: looseNutAngle,
        velocity: 0,
      };
      nutYState = {
        acceleration: commonLift.acceleration,
        value: looseNutY + commonLift.value,
        velocity: commonLift.velocity,
      };
      pipeAYState = {
        acceleration: commonLift.acceleration,
        value: unscrewTravel + commonLift.value,
        velocity: commonLift.velocity,
      };
    } else if (cycleTime >= timeline.fullySeparated
      && cycleTime < timeline.separatedDwellEnd) {
      nutAngleState = {
        acceleration: 0,
        value: looseNutAngle,
        velocity: 0,
      };
      nutYState = {
        acceleration: 0,
        value: looseNutY + separationTravel,
        velocity: 0,
      };
      pipeAYState = {
        acceleration: 0,
        value: unscrewTravel + separationTravel,
        velocity: 0,
      };
    } else if (cycleTime >= timeline.separatedDwellEnd
      && cycleTime < timeline.returnedTogether) {
      const commonReturn = transitionState(
        cycleTime,
        timeline.separatedDwellEnd,
        timeline.returnedTogether,
        separationTravel,
        0,
      );
      nutAngleState = {
        acceleration: 0,
        value: looseNutAngle,
        velocity: 0,
      };
      nutYState = {
        acceleration: commonReturn.acceleration,
        value: looseNutY + commonReturn.value,
        velocity: commonReturn.velocity,
      };
      pipeAYState = {
        acceleration: commonReturn.acceleration,
        value: unscrewTravel + commonReturn.value,
        velocity: commonReturn.velocity,
      };
    } else if (cycleTime >= timeline.returnedTogether
      && cycleTime < timeline.pipeAReseated) {
      nutAngleState = {
        acceleration: 0,
        value: looseNutAngle,
        velocity: 0,
      };
      nutYState = { acceleration: 0, value: looseNutY, velocity: 0 };
      pipeAYState = transitionState(
        cycleTime,
        timeline.returnedTogether,
        timeline.pipeAReseated,
        unscrewTravel,
        0,
      );
    } else if (cycleTime >= timeline.pipeAReseated
      && cycleTime < timeline.retightened) {
      nutAngleState = transitionState(
        cycleTime,
        timeline.pipeAReseated,
        timeline.retightened,
        looseNutAngle,
        0,
      );
      nutYState = {
        acceleration: -threadLeadPerRadian
          * nutAngleState.acceleration,
        value: tightNutY - threadLeadPerRadian * nutAngleState.value,
        velocity: -threadLeadPerRadian * nutAngleState.velocity,
      };
    } else if (cycleTime >= timeline.retightened) {
      nutAngleState = { acceleration: 0, value: 0, velocity: 0 };
      nutYState = { acceleration: 0, value: tightNutY, velocity: 0 };
    }

    const stage = stageAtTime(cycleTime);
    const shoulderUndersideY = nutYState.value
      + nutShoulderUndersideLocalY;
    const flangeBottomWorldY = flangeBottomY + pipeAYState.value;
    const flangeTopWorldY = flangeTopY + pipeAYState.value;
    const shoulderGap = shoulderUndersideY - flangeTopWorldY;
    const seatGap = flangeBottomWorldY - pipeCSeatY;
    const threadEngaged = stage === 'tight-dwell'
      || stage === 'unscrewing-nut-B'
      || stage === 'tightening-nut-B';
    const threadAxialConstraintError = nutYState.value - tightNutY
      + threadLeadPerRadian * nutAngleState.value;
    const threadPhaseError = -(
      threadWaveNumber * (nutYState.value - tightNutY)
      + nutAngleState.value
    );
    const threadPhaseVelocityError = -(
      threadWaveNumber * nutYState.velocity + nutAngleState.velocity
    );
    const threadPhaseAccelerationError = -(
      threadWaveNumber * nutYState.acceleration
      + nutAngleState.acceleration
    );
    const contactY = 0.34;
    const contactPhase = threadWaveNumber
      * (contactY - externalThreadMinimumY);
    const contactCosine = Math.cos(contactPhase);
    const contactSine = Math.sin(contactPhase);
    const threadContactPoint = new THREE.Vector3(
      threadPitchRadius * contactCosine,
      contactY,
      threadPitchRadius * contactSine,
    );
    const nutSurfaceVelocity = new THREE.Vector3(
      nutAngleState.velocity * threadContactPoint.z,
      nutYState.velocity,
      -nutAngleState.velocity * threadContactPoint.x,
    );
    const radialNormal = new THREE.Vector3(
      contactCosine,
      0,
      contactSine,
    );
    const helixTangent = new THREE.Vector3(
      -threadWaveNumber * threadContactPoint.z,
      1,
      threadWaveNumber * threadContactPoint.x,
    ).normalize();
    const flankNormal = new THREE.Vector3().crossVectors(
      radialNormal,
      helixTangent,
    ).normalize();
    const shoulderContactActive = Math.abs(shoulderGap) < 1e-10;
    const seatContactActive = Math.abs(seatGap) < 1e-10;
    const internalThreadLowestWorldY = nutYState.value
      + internalThreadMinimumY;
    const threadAxialClearance = internalThreadLowestWorldY
      - externalThreadMaximumY;

    return {
      captiveCarryActive: shoulderContactActive && !threadEngaged,
      cyclePhase: cycleTime / cyclePeriod,
      cycleTime,
      flangeBottomWorldY,
      flangeTopWorldY,
      flangeToCContactActive: seatContactActive,
      jointSealed: shoulderContactActive
        && seatContactActive
        && threadEngaged,
      nutAngle: nutAngleState.value,
      nutAngularAcceleration: nutAngleState.acceleration,
      nutAngularSpeed: nutAngleState.velocity,
      nutShoulderToFlangeContactActive: shoulderContactActive,
      nutSurfaceVelocity,
      nutY: nutYState.value,
      nutYAcceleration: nutYState.acceleration,
      nutYVelocity: nutYState.velocity,
      pipeAAcceleration: pipeAYState.acceleration,
      pipeAOffset: pipeAYState.value,
      pipeARotation: 0,
      pipeAVelocity: pipeAYState.velocity,
      radialNormal,
      seatGap,
      shoulderGap,
      sourcePose: cycleTime === 0,
      spigotBottomWorldY: spigotMinimumY + pipeAYState.value,
      spigotInCounterbore: pipeAYState.value < spigotMaximumY
        - spigotMinimumY,
      stage,
      threadAxialClearance,
      threadAxialConstraintError,
      threadContactPoint,
      threadEngaged,
      threadFlankNormalVelocityError: nutSurfaceVelocity.dot(flankNormal),
      threadPhaseAccelerationError,
      threadPhaseError,
      threadPhaseVelocityError,
      threadRadialNormalVelocityError: nutSurfaceVelocity.dot(radialNormal),
      threadSlidingSpeed: nutSurfaceVelocity.dot(helixTangent),
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(phase * cyclePeriod);

  root.userData.archetype =
    'three-part-union-pipe-coupling-with-captive-flange-nut-and-right-hand-thread';
  root.userData.mechanism =
    'nut-B-rotates-and-screws-on-fixed-pipe-C-so-its-inward-shoulder-clamps-the-nonrotating-flange-of-pipe-A-against-C';
  root.userData.blocks = {
    externalThread: externalThreadParts.mesh,
    flange: flangeParts.group,
    flangeSectionFaces: flangeParts.sectionFaces,
    gripRibs,
    internalThread: internalThreadParts.mesh,
    nutB,
    nutBody: nutBodyParts.group,
    nutSectionFaces: nutBodyParts.sectionFaces,
    pipeA,
    pipeABody: pipeABodyParts.group,
    pipeASectionFaces: pipeABodyParts.sectionFaces,
    pipeC,
    pipeCBody: pipeCBodyParts.group,
    pipeCBoss: pipeCBossParts.group,
    pipeCSeat,
    pipeCSectionFaces: [
      ...pipeCBodyParts.sectionFaces,
      ...pipeCBossParts.sectionFaces,
    ],
    spigot: spigotParts.group,
    spigotSectionFaces: spigotParts.sectionFaces,
  };
  root.userData.geometry = {
    axis: Y_AXIS.clone(),
    captiveShoulderOverlap,
    counterboreRadius,
    cutawayHalfAngle,
    disengagedThreadAxialClearance,
    externalThreadMaximumY,
    externalThreadMinimumY,
    externalThreadRadius,
    externalThreadTubeRadius,
    flangeBottomY,
    flangeRadius,
    flangeToNutCavityRadialClearance,
    flangeTopY,
    internalThreadMaximumY,
    internalThreadMinimumY,
    internalThreadPhase,
    internalThreadRadius,
    internalThreadTubeRadius,
    looseNutAngle,
    looseNutY,
    loosenTurns,
    nutCavityRadius,
    nutMaximumLocalY,
    nutMinimumLocalY,
    nutOuterBodyRadius,
    nutOuterCollarRadius,
    nutShoulderBoreRadius,
    nutShoulderUndersideLocalY,
    pipeAOuterRadius,
    pipeBoreRadius,
    pipeCBodyOuterRadius,
    pipeCSeatY,
    pipeToShoulderRadialClearance,
    separationTravel,
    spigotBottomClearance,
    spigotMaximumY,
    spigotMinimumY,
    spigotOuterRadius,
    spigotRadialClearance,
    threadedBossCoreRadius,
    threadLead,
    threadLeadPerRadian,
    threadPitch,
    threadPitchRadius,
    threadRadialClearance,
    threadStarts,
    threadTurns,
    threadWaveNumber,
    tightNutY,
    unscrewTravel,
  };
  root.userData.timeline = {
    ...timeline,
    demonstrationPeriod: cyclePeriod,
  };
  root.userData.transmission = {
    captiveNut: true,
    fixedMember: 'externally-threaded-pipe-C',
    jointType: 'three-part-union-coupling',
    pipeRotationRequired: false,
    removableMember: 'flanged-pipe-A',
    rotatingMember: 'internally-threaded-nut-B',
    sealingAction:
      'nut-shoulder-presses-flange-A-onto-the-annular-end-face-of-C',
    threadHand: 'right-hand',
    threadLead,
    threadStarts,
  };
  root.userData.sourceAnimation = {
    available: false,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    reason: 'The official Movement 248 page marks its animation unavailable.',
    referenceScope:
      'A flange, captive nut B, externally threaded end C, and their sectional assembly',
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate248: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'B has an inward shoulder above A flange and a matching internal thread around the external thread of C',
      measurementUncertaintyPixels: 4,
      officialAnimationAvailable: false,
      rasterNutBBounds: { ...sourceNutBBounds },
      rasterPipeABounds: { ...sourcePipeABounds },
      rasterPipeAFlangeBounds: { ...sourcePipeAFlangeBounds },
      rasterPipeBoreBounds: { ...sourcePipeBoreBounds },
      rasterPipeCBodyBounds: { ...sourcePipeCBodyBounds },
      rasterThreadBounds: { ...sourceThreadBounds },
      view: 'longitudinal-section-through-three-coaxial-union-parts',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 63,
      edition: 21,
      illustrationPage: 62,
      publicationYear: 1908,
    },
    sourceScale,
  };
  root.userData.curves = {
    externalThread: externalThreadParts.curve,
    internalThread: internalThreadParts.curve,
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.canonicalStates = {
    captive: stateAtTime(timeline.flangeCaptured),
    separated: stateAtTime(timeline.fullySeparated),
    source: stateAtTime(0),
    threadDisengaged: stateAtTime(timeline.unscrewed),
  };

  const update = (time) => {
    const state = stateAtTime(time);
    pipeA.position.set(0, state.pipeAOffset, 0);
    pipeA.rotation.set(0, 0, 0);
    nutB.position.set(0, state.nutY, 0);
    nutB.rotation.set(0, state.nutAngle, 0);
    pipeA.userData.velocity = new THREE.Vector3(
      0,
      state.pipeAVelocity,
      0,
    );
    pipeA.userData.acceleration = new THREE.Vector3(
      0,
      state.pipeAAcceleration,
      0,
    );
    nutB.userData.angularSpeed = state.nutAngularSpeed;
    nutB.userData.angularAcceleration = state.nutAngularAcceleration;
    nutB.userData.velocity = new THREE.Vector3(
      0,
      state.nutYVelocity,
      0,
    );
    nutB.userData.acceleration = new THREE.Vector3(
      0,
      state.nutYAcceleration,
      0,
    );
    root.userData.contacts = {
      AFlangeToCEndFace: {
        active: state.flangeToCContactActive,
        gap: state.seatGap,
        planeY: pipeCSeatY,
      },
      ASpigotToCCounterbore: {
        active: state.spigotInCounterbore,
        axialBottomClearance: state.spigotBottomWorldY
          - pipeCBodyMaximumY,
        radialClearance: spigotRadialClearance,
      },
      BShoulderToAFlange: {
        active: state.nutShoulderToFlangeContactActive,
        captiveOverlap: captiveShoulderOverlap,
        gap: state.shoulderGap,
      },
      BThreadToCThread: {
        active: state.threadEngaged,
        axialConstraintError: state.threadAxialConstraintError,
        contactPoint: state.threadContactPoint.clone(),
        flankNormalVelocityError: state.threadFlankNormalVelocityError,
        phaseAccelerationError: state.threadPhaseAccelerationError,
        phaseError: state.threadPhaseError,
        phaseVelocityError: state.threadPhaseVelocityError,
        radialClearance: threadRadialClearance,
        radialNormalVelocityError: state.threadRadialNormalVelocityError,
        slidingSpeed: state.threadSlidingSpeed,
      },
      continuousFluidBore: {
        aligned: true,
        radius: pipeBoreRadius,
        separationGap: state.seatGap,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);

  root.userData.fidelity = 'authored';
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.15, -3.05, -2.15),
    new THREE.Vector3(2.15, 7.55, 2.15),
  );
  markShadows(root);

  return {
    cameraDirection: new THREE.Vector3(2.8, 4.5, 11.4),
    root,
    update,
  };
}

export function createAuthoredPipeCouplingMovement(movement) {
  if (movement.id === 248) return unionPipeCoupling(movement);
  return null;
}
