import { finishSounding247Parts } from './release-mechanism-working-parts.js';
import * as THREE from 'three';
import {
  PALETTE,
  makeBeam,
  makeDynamicCable,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

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

function rotateVector2(vector, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    vector.x * cosine - vector.y * sine,
    vector.x * sine + vector.y * cosine,
  );
}

function rigidPointState(localPoint, angleState) {
  const point = rotateVector2(localPoint, angleState.value);
  return {
    acceleration: new THREE.Vector2(
      -point.x * angleState.velocity ** 2
        - point.y * angleState.acceleration,
      -point.y * angleState.velocity ** 2
        + point.x * angleState.acceleration,
    ),
    point,
    velocity: new THREE.Vector2(
      -point.y * angleState.velocity,
      point.x * angleState.velocity,
    ),
  };
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

// Closes an open TubeGeometry with a flat fan at each end that reuses the
// end-ring vertices, so the tube is a watertight solid.
function capTubeEnds(geometry, tubularSegments, radialSegments) {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const uv = geometry.attributes.uv;
  const ring = radialSegments + 1;
  const positions = Array.from(position.array);
  const normals = Array.from(normal.array);
  const uvs = Array.from(uv.array);
  const indices = Array.from(geometry.index.array);
  for (const [ringIndex, sign] of [[0, -1], [tubularSegments, 1]]) {
    const start = ringIndex * ring;
    const center = new THREE.Vector3();
    for (let j = 0; j < radialSegments; j += 1) {
      center.add(new THREE.Vector3().fromBufferAttribute(position, start + j));
    }
    center.multiplyScalar(1 / radialSegments);
    const centerIndex = positions.length / 3;
    positions.push(center.x, center.y, center.z);
    normals.push(0, 0, 0);
    uvs.push(0.5, 0.5);
    for (let j = 0; j < radialSegments; j += 1) {
      const a = start + j;
      const b = start + j + 1;
      if (sign > 0) indices.push(centerIndex, a, b);
      else indices.push(centerIndex, b, a);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
}

function openCylinderAlongY({
  centerY,
  cutawayHalfAngle,
  height,
  material,
  radius,
  segments = 72,
}) {
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radius,
      radius,
      height,
      segments,
      1,
      true,
      cutawayHalfAngle,
      FULL_TURN - 2 * cutawayHalfAngle,
    ),
    material,
  );
  shell.position.y = centerY;
  return shell;
}

function boredSphericalWeightProfile(outerRadius, boreRadius, samples = 72) {
  const openingHalfHeight = Math.sqrt(
    outerRadius ** 2 - boreRadius ** 2,
  );
  const outerPoints = Array.from({ length: samples + 1 }, (_, index) => {
    const y = THREE.MathUtils.lerp(
      -openingHalfHeight,
      openingHalfHeight,
      index / samples,
    );
    return new THREE.Vector2(
      Math.sqrt(Math.max(0, outerRadius ** 2 - y ** 2)),
      y,
    );
  });
  return {
    openingHalfHeight,
    points: [
      ...outerPoints,
      new THREE.Vector2(boreRadius, openingHalfHeight),
      new THREE.Vector2(boreRadius, -openingHalfHeight),
    ],
  };
}

function makeBoredSphericalWeight({
  boreRadius,
  cutawayHalfAngle,
  material,
  outerRadius,
  sectionMaterial,
}) {
  const profile = boredSphericalWeightProfile(outerRadius, boreRadius);
  const group = new THREE.Group();
  group.userData.role =
    'detachable-bored-spherical-sounding-weight-with-front-section-cutaway';
  const shell = new THREE.Mesh(
    new THREE.LatheGeometry(
      profile.points,
      112,
      cutawayHalfAngle,
      FULL_TURN - 2 * cutawayHalfAngle,
    ),
    material,
  );
  shell.userData.role = 'bored-lead-weight-shell';
  shell.userData.isMechanicallyCompleteDespiteDisplayCutaway = true;
  group.add(shell);

  const sectionShape = new THREE.Shape();
  profile.points.forEach((point, index) => {
    if (index === 0) sectionShape.moveTo(point.x, point.y);
    else sectionShape.lineTo(point.x, point.y);
  });
  sectionShape.closePath();
  const sectionGeometry = new THREE.ShapeGeometry(sectionShape, 24);
  const sectionFaces = [
    cutawayHalfAngle,
    FULL_TURN - cutawayHalfAngle,
  ].map((angle, index) => {
    const face = new THREE.Mesh(sectionGeometry, sectionMaterial);
    face.rotation.y = angle - Math.PI / 2;
    face.userData.role = `visible-weight-section-face-${index + 1}`;
    group.add(face);
    return face;
  });

  group.userData.boreRadius = boreRadius;
  group.userData.cutawayHalfAngle = cutawayHalfAngle;
  group.userData.openingHalfHeight = profile.openingHalfHeight;
  group.userData.outerRadius = outerRadius;
  return { group, sectionFaces, shell };
}

function solveDescendingAngleForReach(
  pivotX,
  localPoint,
  targetReach,
) {
  let engaged = 0;
  let retracted = -0.8;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (engaged + retracted) / 2;
    const reach = pivotX + rotateVector2(localPoint, middle).x;
    if (reach > targetReach) engaged = middle;
    else retracted = middle;
  }
  return (engaged + retracted) / 2;
}

function setMaterialOpacity(root, opacity) {
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = opacity;
      material.depthWrite = opacity > 0.98;
    });
  });
}

function seabedTriggeredSoundingWeight(movement) {
  const root = new THREE.Group();

  // Brown's plate is a longitudinal section. The measurements below retain
  // its one sliding bottom probe, one fixed-axis bell crank, curved detent,
  // and the lower catch that supports the bored weight. The 3D model leaves
  // a front sector open so that the otherwise enclosed trip can be inspected.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceScale = 0.014;
  const sourceRodBounds = {
    bottom: 451,
    left: 240,
    right: 307,
    top: 20,
  };
  const sourceWeightBounds = {
    bottom: 385,
    left: 176,
    right: 383,
    top: 171,
  };
  const sourceWindowBounds = {
    bottom: 405,
    left: 252,
    right: 320,
    top: 198,
  };
  const sourceProbeFootBounds = {
    bottom: 512,
    left: 235,
    right: 288,
    top: 459,
  };
  const sourceLeverPivot = new THREE.Vector2(283, 322);
  const sourceProbeContact = new THREE.Vector2(258, 229);
  const sourceCatchSupport = new THREE.Vector2(322, 375);
  const sourceDetentTip = new THREE.Vector2(292, 266);

  const cyclePeriod = 11.1;
  const timeline = Object.freeze({
    loadedDwellEnd: 0.5,
    seabedContact: 3.3,
    supportRelease: 4.4,
    catchFullyRetracted: 4.6,
    weightImpact: 5.3,
    probeDecompressed: 5.6,
    rodRecovered: 7.3,
    manualReloadBegins: 7.8,
    manualReloadLifted: 9.3,
    manualCatchReset: 10.1,
    weightSeated: 10.6,
    cycleClosure: cyclePeriod,
  });

  const seabedY = 0;
  const housingRadius = 0.43;
  // Bore radius leaves the bell-crank roller (outer x 0.505 at z 0.18) clear
  // of the bore wall while the loaded weight sits on the catch.
  const boreRadius = 0.545;
  const boreRadialClearance = boreRadius - housingRadius;
  const weightOuterRadius = 1.5;
  const weightCutawayHalfAngle = 0.58;
  const weightProfile = boredSphericalWeightProfile(
    weightOuterRadius,
    boreRadius,
  );
  const weightOpeningHalfHeight = weightProfile.openingHalfHeight;
  const pivot = new THREE.Vector2(0.08, 0.35);
  const upperContactLocal = new THREE.Vector2(-0.52, 1.35);
  const catchSupportLocal = new THREE.Vector2(0.68, -0.72);
  const probeFootContactLocalY = -1.6;
  const seabedContactBodyY = -probeFootContactLocalY;
  const recoveredBodyY = 4.65;
  const releaseAngle = solveDescendingAngleForReach(
    pivot.x,
    catchSupportLocal,
    boreRadius,
  );
  const heldRetractedAngle = releaseAngle - 0.05;
  const rotatedUpperAtRest = rotateVector2(upperContactLocal, 0);
  const probeRiseAtAngle = (angle) => (
    rotateVector2(upperContactLocal, angle).y - rotatedUpperAtRest.y
  );
  const maximumProbeRise = probeRiseAtAngle(heldRetractedAngle);
  const compressedBodyY = seabedContactBodyY - maximumProbeRise;
  const engagedSupportLocalY = pivot.y + catchSupportLocal.y;
  const loadedWeightCenterRelativeY = engagedSupportLocalY
    + weightOpeningHalfHeight;
  const loadedWeightCenterY = recoveredBodyY
    + loadedWeightCenterRelativeY;
  const seatClearance = 0.12;
  const preloadedWeightCenterY = loadedWeightCenterY + seatClearance;
  const groundedWeightCenterY = seabedY + weightOpeningHalfHeight;

  const zeroAngleState = Object.freeze({
    acceleration: 0,
    value: 0,
    velocity: 0,
  });
  const heldAngleState = Object.freeze({
    acceleration: 0,
    value: heldRetractedAngle,
    velocity: 0,
  });

  const catchStateForTime = (cycleTime) => {
    if (cycleTime < timeline.seabedContact) return zeroAngleState;
    if (cycleTime < timeline.supportRelease) {
      return transitionState(
        cycleTime,
        timeline.seabedContact,
        timeline.supportRelease,
        0,
        releaseAngle,
      );
    }
    if (cycleTime < timeline.catchFullyRetracted) {
      return transitionState(
        cycleTime,
        timeline.supportRelease,
        timeline.catchFullyRetracted,
        releaseAngle,
        heldRetractedAngle,
      );
    }
    if (cycleTime < timeline.manualReloadLifted) return heldAngleState;
    if (cycleTime < timeline.manualCatchReset) {
      return transitionState(
        cycleTime,
        timeline.manualReloadLifted,
        timeline.manualCatchReset,
        heldRetractedAngle,
        0,
      );
    }
    return zeroAngleState;
  };

  const releaseAngleState = {
    acceleration: 0,
    value: releaseAngle,
    velocity: 0,
  };
  const releaseUpper = rigidPointState(
    upperContactLocal,
    releaseAngleState,
  );
  const releaseNose = rigidPointState(
    catchSupportLocal,
    releaseAngleState,
  );
  const probeRiseAtRelease = releaseUpper.point.y
    - upperContactLocal.y;
  const releaseBodyY = seabedContactBodyY - probeRiseAtRelease;
  const releaseLowerOpeningY = releaseBodyY + pivot.y
    + releaseNose.point.y;
  const releaseWeightCenterY = releaseLowerOpeningY
    + weightOpeningHalfHeight;
  const fallDuration = timeline.weightImpact - timeline.supportRelease;
  const modelGravity = 2 * (releaseWeightCenterY - groundedWeightCenterY)
    / fallDuration ** 2;

  const bodyStateForTime = (cycleTime, catchAngleState) => {
    if (cycleTime < timeline.loadedDwellEnd) {
      return { acceleration: 0, value: recoveredBodyY, velocity: 0 };
    }
    if (cycleTime < timeline.seabedContact) {
      return transitionState(
        cycleTime,
        timeline.loadedDwellEnd,
        timeline.seabedContact,
        recoveredBodyY,
        seabedContactBodyY,
      );
    }
    if (cycleTime < timeline.catchFullyRetracted) {
      const upper = rigidPointState(upperContactLocal, catchAngleState);
      const probeOffset = upper.point.y - upperContactLocal.y;
      const probeVelocity = upper.velocity.y;
      const probeAcceleration = upper.acceleration.y;
      return {
        acceleration: -probeAcceleration,
        value: seabedContactBodyY - probeOffset,
        velocity: -probeVelocity,
      };
    }
    if (cycleTime < timeline.weightImpact) {
      return { acceleration: 0, value: compressedBodyY, velocity: 0 };
    }
    if (cycleTime < timeline.probeDecompressed) {
      return transitionState(
        cycleTime,
        timeline.weightImpact,
        timeline.probeDecompressed,
        compressedBodyY,
        seabedContactBodyY,
      );
    }
    if (cycleTime < timeline.rodRecovered) {
      return transitionState(
        cycleTime,
        timeline.probeDecompressed,
        timeline.rodRecovered,
        seabedContactBodyY,
        recoveredBodyY,
      );
    }
    return { acceleration: 0, value: recoveredBodyY, velocity: 0 };
  };

  const weightStateForTime = (
    cycleTime,
    bodyState,
    catchAngleState,
  ) => {
    if (cycleTime < timeline.loadedDwellEnd) {
      return {
        acceleration: 0,
        externallySupported: false,
        value: loadedWeightCenterY,
        velocity: 0,
      };
    }
    if (cycleTime < timeline.seabedContact) {
      return {
        acceleration: bodyState.acceleration,
        externallySupported: false,
        value: bodyState.value + loadedWeightCenterRelativeY,
        velocity: bodyState.velocity,
      };
    }
    if (cycleTime < timeline.supportRelease) {
      const support = rigidPointState(
        catchSupportLocal,
        catchAngleState,
      );
      return {
        acceleration: bodyState.acceleration + support.acceleration.y,
        externallySupported: false,
        value: bodyState.value + pivot.y + support.point.y
          + weightOpeningHalfHeight,
        velocity: bodyState.velocity + support.velocity.y,
      };
    }
    if (cycleTime < timeline.weightImpact) {
      const elapsed = cycleTime - timeline.supportRelease;
      return {
        acceleration: -modelGravity,
        externallySupported: false,
        value: releaseWeightCenterY
          - modelGravity * elapsed ** 2 / 2,
        velocity: -modelGravity * elapsed,
      };
    }
    if (cycleTime < timeline.manualReloadBegins) {
      return {
        acceleration: 0,
        externallySupported: false,
        value: groundedWeightCenterY,
        velocity: 0,
      };
    }
    if (cycleTime < timeline.manualReloadLifted) {
      const lift = transitionState(
        cycleTime,
        timeline.manualReloadBegins,
        timeline.manualReloadLifted,
        groundedWeightCenterY,
        preloadedWeightCenterY,
      );
      return { ...lift, externallySupported: true };
    }
    if (cycleTime < timeline.manualCatchReset) {
      return {
        acceleration: 0,
        externallySupported: true,
        value: preloadedWeightCenterY,
        velocity: 0,
      };
    }
    if (cycleTime < timeline.weightSeated) {
      const seating = transitionState(
        cycleTime,
        timeline.manualCatchReset,
        timeline.weightSeated,
        preloadedWeightCenterY,
        loadedWeightCenterY,
      );
      return { ...seating, externallySupported: true };
    }
    return {
      acceleration: 0,
      externallySupported: false,
      value: loadedWeightCenterY,
      velocity: 0,
    };
  };

  const stageAtTime = (cycleTime) => {
    if (cycleTime < timeline.loadedDwellEnd) return 'loaded-dwell';
    if (cycleTime < timeline.seabedContact) return 'descent';
    if (cycleTime < timeline.supportRelease) return 'probe-trigger';
    if (cycleTime < timeline.catchFullyRetracted) {
      return 'catch-clearance-and-free-fall';
    }
    if (cycleTime < timeline.weightImpact) return 'weight-free-fall';
    if (cycleTime < timeline.probeDecompressed) {
      return 'probe-decompression-with-detent-held';
    }
    if (cycleTime < timeline.rodRecovered) return 'rod-recovery';
    if (cycleTime < timeline.manualReloadBegins) return 'released-dwell';
    if (cycleTime < timeline.manualReloadLifted) {
      return 'external-manual-weight-lift';
    }
    if (cycleTime < timeline.manualCatchReset) {
      return 'external-manual-detent-reset';
    }
    if (cycleTime < timeline.weightSeated) {
      return 'external-manual-weight-seating';
    }
    return 'loaded-dwell';
  };

  const stateAtTime = (time) => {
    const cycleTime = positiveModulo(time, cyclePeriod);
    const catchAngleState = catchStateForTime(cycleTime);
    const catchUpper = rigidPointState(
      upperContactLocal,
      catchAngleState,
    );
    const catchSupport = rigidPointState(
      catchSupportLocal,
      catchAngleState,
    );
    const body = bodyStateForTime(cycleTime, catchAngleState);

    let probeOffset = 0;
    let probeVelocity = 0;
    let probeAcceleration = 0;
    if (cycleTime >= timeline.seabedContact
      && cycleTime < timeline.catchFullyRetracted) {
      probeOffset = catchUpper.point.y - upperContactLocal.y;
      probeVelocity = catchUpper.velocity.y;
      probeAcceleration = catchUpper.acceleration.y;
    } else if (cycleTime >= timeline.catchFullyRetracted
      && cycleTime < timeline.weightImpact) {
      probeOffset = maximumProbeRise;
    } else if (cycleTime >= timeline.weightImpact
      && cycleTime < timeline.probeDecompressed) {
      probeOffset = seabedContactBodyY - body.value;
      probeVelocity = -body.velocity;
      probeAcceleration = -body.acceleration;
    }

    const weight = weightStateForTime(
      cycleTime,
      body,
      catchAngleState,
    );
    const catchUpperWorld = new THREE.Vector3(
      pivot.x + catchUpper.point.x,
      body.value + pivot.y + catchUpper.point.y,
      0.25,
    );
    const catchSupportWorld = new THREE.Vector3(
      pivot.x + catchSupport.point.x,
      body.value + pivot.y + catchSupport.point.y,
      0.25,
    );
    const probePusherWorldY = body.value + pivot.y
      + upperContactLocal.y + probeOffset;
    const probeFootContactY = body.value + probeFootContactLocalY
      + probeOffset;
    const weightLowerOpeningY = weight.value - weightOpeningHalfHeight;
    const weightUpperOpeningY = weight.value + weightOpeningHalfHeight;
    const supportRadialReach = catchSupportWorld.x;
    const supportOverlap = supportRadialReach - boreRadius;
    const detentLatched = cycleTime >= timeline.supportRelease
      && cycleTime < timeline.manualReloadLifted;
    const manualResetActive = cycleTime >= timeline.manualReloadBegins
      && cycleTime < timeline.weightSeated;
    const probeToCatchContactActive = (
      cycleTime < timeline.weightImpact
      || cycleTime >= timeline.manualCatchReset
    );
    const catchToWeightContactActive = (
      cycleTime < timeline.supportRelease
      || cycleTime >= timeline.weightSeated
    );
    const weightOnSeabed = cycleTime >= timeline.weightImpact
      && cycleTime < timeline.manualReloadBegins;
    const resetSlingOpacity = cycleTime < timeline.manualReloadBegins
      || cycleTime >= timeline.weightSeated
      ? 0
      : cycleTime < timeline.manualReloadBegins + 0.18
        ? smootherStep01(
          (cycleTime - timeline.manualReloadBegins) / 0.18,
        )
        : cycleTime > timeline.weightSeated - 0.18
          ? 1 - smootherStep01(
            (cycleTime - (timeline.weightSeated - 0.18)) / 0.18,
          )
          : 1;

    return {
      bodyAcceleration: body.acceleration,
      bodyPositionY: body.value,
      bodyVelocity: body.velocity,
      catchAngle: catchAngleState.value,
      catchAngularAcceleration: catchAngleState.acceleration,
      catchAngularSpeed: catchAngleState.velocity,
      catchSupportAcceleration: new THREE.Vector3(
        catchSupport.acceleration.x,
        body.acceleration + catchSupport.acceleration.y,
        0,
      ),
      catchSupportPosition: catchSupportWorld,
      catchSupportVelocity: new THREE.Vector3(
        catchSupport.velocity.x,
        body.velocity + catchSupport.velocity.y,
        0,
      ),
      catchToWeightContactActive,
      catchUpperPosition: catchUpperWorld,
      cyclePhase: cycleTime / cyclePeriod,
      cycleTime,
      detentLatched,
      manualResetActive,
      probeAcceleration,
      probeFootContactY,
      probeOffset,
      probePusherClearance: catchUpperWorld.y - probePusherWorldY,
      probePusherWorldY,
      probeToCatchContactActive,
      probeVelocity,
      resetSlingOpacity,
      sourcePose: cycleTime === 0,
      stage: stageAtTime(cycleTime),
      supportOverlap,
      supportRadialClearance: boreRadius - supportRadialReach,
      supportRadialReach,
      weightAcceleration: weight.acceleration,
      weightCenterY: weight.value,
      weightExternallySupported: weight.externallySupported,
      weightLowerOpeningY,
      weightOnSeabed,
      weightUpperOpeningY,
      weightVelocity: weight.velocity,
    };
  };
  const stateAtCyclePhase = (phase) => stateAtTime(phase * cyclePeriod);

  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const housingMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.58,
    side: THREE.DoubleSide,
  });
  const housingSectionMaterial = matte(0xb84a35, {
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
  const catchMaterial = matte(PALETTE.brass, {
    metalness: 0.18,
    roughness: 0.5,
  });
  const probeMaterial = matte(PALETTE.white, { roughness: 0.46 });
  const weightMaterial = matte(PALETTE.driven, {
    metalness: 0.16,
    roughness: 0.57,
    side: THREE.DoubleSide,
  });
  const weightSectionMaterial = matte(0x234b62, {
    metalness: 0.08,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
  const seabedMaterial = matte(0xc8b792, { roughness: 0.94 });

  const seabed = new THREE.Group();
  // Brown draws no sea bottom. The probe and the dropped weight still need
  // a contact plane, so it is kept as a thin line just wider than the weight.
  const seabedSlab = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.03, 0.5),
    seabedMaterial,
  );
  seabedSlab.position.y = seabedY - 0.015;
  seabedSlab.userData.role = 'sea-bottom-contact-plane';
  const seabedRings = [];
  seabed.add(seabedSlab);
  seabed.userData.fixed = true;
  seabed.userData.role = 'fixed-seabed';
  root.add(seabed);

  const bodyAssembly = new THREE.Group();
  bodyAssembly.userData.axis = new THREE.Vector3(0, 1, 0);
  bodyAssembly.userData.role = 'recoverable-hollow-sounding-rod';
  const housingTop = new THREE.Mesh(
    new THREE.CylinderGeometry(housingRadius, housingRadius, 1.9, 72),
    housingMaterial,
  );
  housingTop.position.y = 2.85;
  housingTop.userData.role = 'solid-upper-sounding-rod';
  // Brown draws a longitudinal section, so the rod is shown as its back half
  // (the front 206 degrees open). The bell crank, probe pad and catch nose
  // swing outside the rod radius and must pass through that opening.
  const housingCutawayHalfAngle = 1.8;
  const windowShell = openCylinderAlongY({
    centerY: 0.55,
    cutawayHalfAngle: housingCutawayHalfAngle,
    height: 2.7,
    material: housingMaterial,
    radius: housingRadius,
  });
  windowShell.userData.role = 'front-open-trip-mechanism-housing';
  windowShell.userData.frontWindowIsPhysicalOpening = true;
  const lowerHousing = openCylinderAlongY({
    centerY: -1.05,
    cutawayHalfAngle: housingCutawayHalfAngle,
    height: 0.5,
    material: housingMaterial,
    radius: housingRadius,
  });
  lowerHousing.userData.role = 'lower-open-guide-sleeve';
  // Narrow enough that its back corners stay inside the weight's bore.
  const windowBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.60, 2.55, 0.09),
    housingSectionMaterial,
  );
  windowBack.position.set(0, 0.55, -0.36);
  windowBack.userData.role = 'sectioned-back-wall-of-hollow-rod';
  const lowerGuideBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.42, 0.68),
    housingSectionMaterial,
  );
  // Raised clear of the probe foot at the probe's greatest rise.
  lowerGuideBlock.position.set(0, -1.10, -0.02);
  lowerGuideBlock.userData.role = 'probe-lower-guide-block';
  bodyAssembly.add(
    housingTop,
    windowShell,
    lowerHousing,
    windowBack,
    lowerGuideBlock,
  );

  const probeAssembly = new THREE.Group();
  probeAssembly.userData.axis = new THREE.Vector3(0, 1, 0);
  probeAssembly.userData.role =
    'bottom-projecting-seabed-probe-sliding-relative-to-rod';
  const probeX = pivot.x + upperContactLocal.x + 0.09;
  const probeShaftTopY = pivot.y + upperContactLocal.y - 0.08;
  const probeShaftBottomY = probeFootContactLocalY + 0.12;
  const probeShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.055,
      0.055,
      probeShaftTopY - probeShaftBottomY,
      24,
    ),
    probeMaterial,
  );
  // The stem runs in front of the bell-crank plane, under the pusher pad.
  probeShaft.position.set(
    probeX,
    (probeShaftTopY + probeShaftBottomY) / 2,
    0.41,
  );
  probeShaft.userData.role = 'vertical-sliding-probe-stem';
  const probePusher = new THREE.Mesh(
    new THREE.BoxGeometry(0.31, 0.12, 0.22),
    probeMaterial,
  );
  probePusher.position.set(
    probeX + 0.055,
    pivot.y + upperContactLocal.y - 0.06,
    0.25,
  );
  probePusher.userData.contactSurfaceY = pivot.y + upperContactLocal.y;
  probePusher.userData.role = 'probe-upper-pusher-pad';
  // The foot is set toward the rod axis so it passes up through the
  // released weight's bore when the rod is recovered.
  const probeFoot = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 0.18, 0.42),
    probeMaterial,
  );
  probeFoot.position.set(
    probeX + 0.20,
    probeFootContactLocalY + 0.09,
    0.25,
  );
  probeFoot.userData.contactSurfaceY = probeFootContactLocalY;
  probeFoot.userData.role = 'seabed-contact-foot';
  probeAssembly.add(probeShaft, probePusher, probeFoot);
  bodyAssembly.add(probeAssembly);

  const catchAssembly = new THREE.Group();
  catchAssembly.position.set(pivot.x, pivot.y, 0.25);
  catchAssembly.userData.axis = Z_AXIS.clone();
  catchAssembly.userData.role =
    'single-rigid-bell-crank-and-weight-support-catch';
  const upperCatchArm = makeBeam(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(
      upperContactLocal.x,
      upperContactLocal.y,
      0,
    ),
    {
      color: PALETTE.brass,
      depth: 0.18,
      jointRadius: 0.095,
      thickness: 0.13,
    },
  );
  upperCatchArm.userData.role = 'probe-driven-upper-bell-crank-arm';
  const lowerCatchArm = makeBeam(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(
      catchSupportLocal.x - 0.08,
      catchSupportLocal.y + 0.06,
      0,
    ),
    {
      color: PALETTE.brass,
      depth: 0.18,
      jointRadius: 0.095,
      thickness: 0.17,
    },
  );
  lowerCatchArm.userData.role = 'lower-weight-releasing-catch-arm';
  const catchNoseShape = new THREE.Shape();
  catchNoseShape.moveTo(0.43, -0.73);
  catchNoseShape.lineTo(catchSupportLocal.x, catchSupportLocal.y);
  catchNoseShape.lineTo(0.55, -0.55);
  catchNoseShape.lineTo(0.40, -0.61);
  catchNoseShape.closePath();
  const catchNoseGeometry = new THREE.ExtrudeGeometry(catchNoseShape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    depth: 0.18,
  });
  catchNoseGeometry.translate(0, 0, -0.09);
  const catchNose = new THREE.Mesh(catchNoseGeometry, catchMaterial);
  catchNose.userData.localSupportPoint = catchSupportLocal.clone();
  catchNose.userData.role = 'radially-withdrawing-weight-support-nose';
  const catchIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 18, 12),
    probeMaterial,
  );
  catchIndex.position.set(catchSupportLocal.x, catchSupportLocal.y, 0.11);
  catchIndex.userData.role = 'white-catch-contact-index';
  catchAssembly.add(
    upperCatchArm,
    lowerCatchArm,
    catchNose,
    catchIndex,
  );
  bodyAssembly.add(catchAssembly);

  const pivotPin = cylinderAlongZ(0.15, 0.72, darkMaterial, 36);
  pivotPin.position.set(pivot.x, pivot.y, 0.25);
  pivotPin.userData.fixedToHousing = true;
  pivotPin.userData.role = 'fixed-bell-crank-pivot-pin';
  bodyAssembly.add(pivotPin);

  // One smoothly bent flat-ended spring rebuilt each frame (a deforming
  // part), rather than straight segments overlapping at every bend.
  // Its buffers are allocated once and rewritten in place.
  const springTube = (points) => {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const tube = new THREE.TubeGeometry(curve, 24, 0.035, 10, false);
    capTubeEnds(tube, 24, 10);
    return tube;
  };
  const detentSpring = new THREE.Group();
  const detentSpringMesh = new THREE.Mesh(
    springTube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]),
    matte(PALETTE.ink, { roughness: 0.78 }),
  );
  detentSpringMesh.userData.role =
    'curved-spring-detent-holding-catch-after-release';
  detentSpring.add(detentSpringMesh);
  detentSpring.userData.setPoints = (points) => {
    const tube = springTube(points);
    for (const name of ['position', 'normal']) {
      detentSpringMesh.geometry.attributes[name].array.set(tube.attributes[name].array);
      detentSpringMesh.geometry.attributes[name].needsUpdate = true;
    }
    detentSpringMesh.geometry.computeBoundingSphere();
    detentSpringMesh.geometry.computeBoundingBox();
    tube.dispose();
  };
  detentSpring.userData.role =
    'curved-spring-detent-holding-catch-after-release';
  bodyAssembly.add(detentSpring);
  root.add(bodyAssembly);

  const weightParts = makeBoredSphericalWeight({
    boreRadius,
    cutawayHalfAngle: weightCutawayHalfAngle,
    material: weightMaterial,
    outerRadius: weightOuterRadius,
    sectionMaterial: weightSectionMaterial,
  });
  const weightAssembly = weightParts.group;
  weightAssembly.userData.massRole = 'discarded-ballast';
  root.add(weightAssembly);

  const resetSling = new THREE.Group();
  resetSling.userData.external = true;
  resetSling.userData.role =
    'visible-external-sling-used-only-for-nonautomatic-loop-reload';
  const slingMain = makeDynamicCable({
    color: PALETTE.accent,
    maxSegments: 3,
    radius: 0.026,
  });
  const slingLeft = makeDynamicCable({
    color: PALETTE.accent,
    maxSegments: 3,
    radius: 0.026,
  });
  const slingRight = makeDynamicCable({
    color: PALETTE.accent,
    maxSegments: 3,
    radius: 0.026,
  });
  const slingHook = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 20, 12),
    matte(PALETTE.accent, { metalness: 0.16, roughness: 0.5 }),
  );
  slingHook.userData.role = 'external-reload-sling-hook';
  resetSling.add(slingMain, slingLeft, slingRight, slingHook);
  setMaterialOpacity(resetSling, 0);
  root.add(resetSling);

  root.userData.archetype =
    'seabed-triggered-sounding-weight-release-with-sliding-probe-and-latched-bell-crank';
  root.userData.mechanism =
    'bottom-probe-slides-upward-against-a-bell-crank-which-withdraws-and-detent-latches-the-catch-from-beneath-the-bored-sounding-weight';
  root.userData.blocks = {
    bodyAssembly,
    catchAssembly,
    catchIndex,
    catchNose,
    detentSpring,
    housingTop,
    lowerGuideBlock,
    lowerHousing,
    pivotPin,
    probeAssembly,
    probeFoot,
    probePusher,
    probeShaft,
    resetSling,
    seabed,
    seabedSlab,
    weightAssembly,
    weightSectionFaces: weightParts.sectionFaces,
    weightShell: weightParts.shell,
    windowBack,
    windowShell,
  };
  root.userData.geometry = {
    boreRadialClearance,
    boreRadius,
    catchSupportLocal: catchSupportLocal.clone(),
    compressedBodyY,
    engagedSupportLocalY,
    heldRetractedAngle,
    housingRadius,
    loadedWeightCenterRelativeY,
    loadedWeightCenterY,
    maximumProbeRise,
    modelGravity,
    pivot: pivot.clone(),
    preloadedWeightCenterY,
    probeFootContactLocalY,
    recoveredBodyY,
    releaseAngle,
    releaseBodyY,
    releaseLowerOpeningY,
    releaseWeightCenterY,
    seatClearance,
    seabedContactBodyY,
    seabedY,
    sourceScale,
    upperContactLocal: upperContactLocal.clone(),
    weightCutawayHalfAngle,
    weightOpeningHalfHeight,
    weightOuterRadius,
  };
  root.userData.timeline = {
    ...timeline,
    demonstrationPeriod: cyclePeriod,
  };
  root.userData.transmission = {
    automaticReset: false,
    catchDetainedAfterTrip: true,
    catchType: 'single-pivot-bell-crank-with-radial-support-nose',
    input: 'bottom-projecting-seabed-probe',
    loopReset:
      'explicit-external-sling-lifts-the-discarded-weight-and-manually-resets-the-detent',
    oneShotRelease: true,
    output: 'detachable-bored-sounding-weight',
    probeDegreeOfFreedom: 'one-vertical-prismatic-slide-relative-to-rod',
    trigger:
      'probe-foot-contact-with-seabed-followed-by-rod-overtravel',
  };
  root.userData.sourceAnimation = {
    available: false,
    durationSeconds: cyclePeriod,
    independentlyReconstructed: true,
    reason: 'The official Movement 247 page marks its animation unavailable.',
    referenceScope:
      'sectional topology, seabed-probe input, catch withdrawal, dropped weight, and light-rod recovery',
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate247: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology:
        'one bottom slider contacts one pivoted catch; a curved detent retains the catch while a bored spherical weight drops',
      measurementUncertaintyPixels: 4,
      officialAnimationAvailable: false,
      rasterCatchSupport: sourceCatchSupport.clone(),
      rasterDetentTip: sourceDetentTip.clone(),
      rasterLeverPivot: sourceLeverPivot.clone(),
      rasterProbeContact: sourceProbeContact.clone(),
      rasterProbeFootBounds: { ...sourceProbeFootBounds },
      rasterRodBounds: { ...sourceRodBounds },
      rasterWeightBounds: { ...sourceWeightBounds },
      rasterWindowBounds: { ...sourceWindowBounds },
      view: 'longitudinal-section-through-rod-and-bored-weight',
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 63,
      edition: 21,
      illustrationPage: 62,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtCyclePhase = stateAtCyclePhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.canonicalStates = {
    impact: stateAtTime(timeline.weightImpact),
    loaded: stateAtTime(0),
    recovered: stateAtTime(timeline.rodRecovered),
    release: stateAtTime(timeline.supportRelease),
    seabedContact: stateAtTime(timeline.seabedContact),
  };

  const update = (time) => {
    const state = stateAtTime(time);
    bodyAssembly.position.y = state.bodyPositionY;
    probeAssembly.position.y = state.probeOffset;
    catchAssembly.rotation.z = state.catchAngle;
    weightAssembly.position.y = state.weightCenterY;

    const detentContactLocal = rotateVector2(
      new THREE.Vector2(-0.28, 1.12),
      state.catchAngle,
    ).add(pivot);
    detentSpring.userData.setPoints([
      new THREE.Vector3(-0.02, 1.93, 0.25),
      new THREE.Vector3(0.18, 1.81, 0.25),
      new THREE.Vector3(0.25, 1.57, 0.25),
      new THREE.Vector3(
        detentContactLocal.x + 0.09,
        detentContactLocal.y + 0.08,
        0.25,
      ),
      new THREE.Vector3(
        detentContactLocal.x,
        detentContactLocal.y,
        0.25,
      ),
    ]);

    // The sling runs in front of the rod (radius 0.43), not through it.
    const slingJunction = new THREE.Vector3(
      0,
      state.weightCenterY + weightOuterRadius + 0.38,
      0.62,
    );
    const slingAnchor = new THREE.Vector3(0, 8.68, 0.62);
    const shoulderY = state.weightCenterY
      + Math.sqrt((weightOuterRadius + 0.03) ** 2 - 0.82 ** 2 - 0.18 ** 2);
    const leftShoulder = new THREE.Vector3(-0.82, shoulderY, 0.18);
    const rightShoulder = new THREE.Vector3(0.82, shoulderY, 0.18);
    slingMain.userData.setPoints([slingAnchor, slingJunction]);
    slingLeft.userData.setPoints([slingJunction, leftShoulder]);
    slingRight.userData.setPoints([slingJunction, rightShoulder]);
    slingHook.position.copy(slingJunction);
    resetSling.visible = state.resetSlingOpacity > 0;
    setMaterialOpacity(resetSling, state.resetSlingOpacity);

    bodyAssembly.userData.velocity = new THREE.Vector3(
      0,
      state.bodyVelocity,
      0,
    );
    bodyAssembly.userData.acceleration = new THREE.Vector3(
      0,
      state.bodyAcceleration,
      0,
    );
    probeAssembly.userData.velocity = new THREE.Vector3(
      0,
      state.probeVelocity,
      0,
    );
    probeAssembly.userData.acceleration = new THREE.Vector3(
      0,
      state.probeAcceleration,
      0,
    );
    catchAssembly.userData.angularSpeed = state.catchAngularSpeed;
    catchAssembly.userData.angularAcceleration =
      state.catchAngularAcceleration;
    weightAssembly.userData.velocity = new THREE.Vector3(
      0,
      state.weightVelocity,
      0,
    );
    weightAssembly.userData.acceleration = new THREE.Vector3(
      0,
      state.weightAcceleration,
      0,
    );
    root.userData.contacts = {
      catchDetent: {
        active: state.detentLatched,
        automaticReset: false,
        catchAngle: state.catchAngle,
      },
      catchToWeight: {
        active: state.catchToWeightContactActive,
        radialOverlap: state.supportOverlap,
        supportPoint: state.catchSupportPosition.clone(),
        verticalGap: state.weightLowerOpeningY
          - state.catchSupportPosition.y,
      },
      externalReloadSling: {
        active: state.manualResetActive,
        automatic: false,
        opacity: state.resetSlingOpacity,
      },
      housingToWeightBore: {
        interference: false,
        radialClearance: boreRadialClearance,
      },
      probeToBellCrank: {
        active: state.probeToCatchContactActive,
        clearance: state.probePusherClearance,
        contactPoint: state.catchUpperPosition.clone(),
      },
      probeToSeabed: {
        active: Math.abs(state.probeFootContactY - seabedY) < 1e-9,
        gap: state.probeFootContactY - seabedY,
      },
      weightToSeabed: {
        active: state.weightOnSeabed,
        gap: state.weightLowerOpeningY - seabedY,
        impactSpeed: modelGravity * fallDuration,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);

  root.userData.fidelity = 'authored';
  root.userData.cameraDistanceScale = 1.08;
  // Brown's plate is a front section; a narrow lens keeps the view nearly
  // orthographic so the contact slab reads edge-on, as a ground line.
  root.userData.cameraFov = 10;
  markShadows(root);
  for (const ring of seabedRings) {
    ring.castShadow = false;
    ring.receiveShadow = false;
  }

  return {
    cameraDirection: new THREE.Vector3(0.9, 0.75, 12),
    root,
    update,
  };
}

export function createAuthoredSoundingWeightMovement(movement) {
  if (movement.id === 247) {
    const model = finishSounding247Parts(seabedTriggeredSoundingWeight(movement));
    // Keep the stem-to-pad bridge in front of the bell-crank plane with the
    // stem it joins.
    const bridge = model.root.userData.releaseWorkingParts?.bridge;
    if (bridge) bridge.position.z = 0.42;
    // Fit the camera to the instrument's own travel and the minimal bottom
    // line rather than the stale measured envelope of the former wide slab.
    // Only visible parts count: hidden reference solids used to widen the box.
    // Brown breaks the rod off above the weight, so the rod's upper end and
    // the reload sling may pass out of the top of the frame; everything else,
    // down to the bottom line, stays in view.
    const { root } = model;
    const fitBounds = new THREE.Box3();
    const partBounds = new THREE.Box3();
    for (let sample = 0; sample <= 96; sample += 1) {
      model.update(root.userData.timeline.cycleClosure * sample / 96);
      root.updateMatrixWorld(true);
      root.traverseVisible((object) => {
        if (!object.geometry) return;
        fitBounds.union(partBounds.setFromObject(object, true));
      });
    }
    const { loadedWeightCenterY, weightOuterRadius } = root.userData.geometry;
    fitBounds.max.y = Math.min(fitBounds.max.y,
      loadedWeightCenterY + weightOuterRadius + 0.85);
    root.userData.cameraFitBounds = fitBounds.expandByScalar(0.05);
    model.update(0);
    return model;
  }
  return null;
}
