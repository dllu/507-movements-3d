import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function quinticState(parameter) {
  const u = THREE.MathUtils.clamp(parameter, 0, 1);
  return {
    acceleration: 60 * u * (1 - u) * (1 - 2 * u),
    rate: 30 * u ** 2 * (1 - u) ** 2,
    value: u ** 3 * (10 + u * (-15 + 6 * u)),
  };
}

function cylinderAlongAxis(radius, length, axis, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    axis.clone().normalize(),
  );
  return cylinder;
}

function beamBetween(start, end, width, depth, material) {
  const direction = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(direction.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(direction.y, direction.x);
  return beam;
}

function lawWithDwells(phase, {
  endDwellEnd,
  forwardEnd,
  forwardStart,
  returnEnd,
  returnStart,
}) {
  const p = positiveModulo(phase, 1);
  if (p < forwardStart) {
    return {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      stage: 'rear-dwell',
      value: 0,
    };
  }
  if (p < forwardEnd) {
    const width = forwardEnd - forwardStart;
    const motion = quinticState((p - forwardStart) / width);
    return {
      accelerationPerPhaseSquared: motion.acceleration / width ** 2,
      ratePerPhase: motion.rate / width,
      stage: 'cam-driven-forward-stroke',
      value: motion.value,
    };
  }
  if (p < returnStart) {
    return {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      stage: 'forward-dwell',
      value: 1,
    };
  }
  if (p < returnEnd) {
    const width = returnEnd - returnStart;
    const motion = quinticState((p - returnStart) / width);
    return {
      accelerationPerPhaseSquared: -motion.acceleration / width ** 2,
      ratePerPhase: -motion.rate / width,
      stage: 'spring-return-stroke',
      value: 1 - motion.value,
    };
  }
  if (p < endDwellEnd || endDwellEnd === 1) {
    return {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      stage: 'rear-dwell',
      value: 0,
    };
  }
  throw new Error('invalid four-motion feed phase');
}

function liftLawAtPhase(phase) {
  const p = positiveModulo(phase, 1);
  const riseStart = 0.10;
  const riseEnd = 0.22;
  const dropStart = 0.48;
  const dropEnd = 0.58;
  if (p < riseStart) {
    return {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      stage: 'lowered-dwell',
      value: 0,
    };
  }
  if (p < riseEnd) {
    const width = riseEnd - riseStart;
    const motion = quinticState((p - riseStart) / width);
    return {
      accelerationPerPhaseSquared: motion.acceleration / width ** 2,
      ratePerPhase: motion.rate / width,
      stage: 'radial-cam-rise',
      value: motion.value,
    };
  }
  if (p < dropStart) {
    return {
      accelerationPerPhaseSquared: 0,
      ratePerPhase: 0,
      stage: 'raised-dwell',
      value: 1,
    };
  }
  if (p < dropEnd) {
    const width = dropEnd - dropStart;
    const motion = quinticState((p - dropStart) / width);
    return {
      accelerationPerPhaseSquared: -motion.acceleration / width ** 2,
      ratePerPhase: -motion.rate / width,
      stage: 'gravity-drop-on-receding-cam',
      value: 1 - motion.value,
    };
  }
  return {
    accelerationPerPhaseSquared: 0,
    ratePerPhase: 0,
    stage: 'lowered-dwell',
    value: 0,
  };
}

class SampledCamFaceCurve3 extends THREE.Curve {
  constructor(points) {
    super();
    this.points = points.map((point) => point.clone());
  }

  getPoint(parameter, target = new THREE.Vector3()) {
    const coordinate = positiveModulo(parameter, 1) * this.points.length;
    const index = Math.floor(coordinate) % this.points.length;
    const nextIndex = (index + 1) % this.points.length;
    return target.copy(this.points[index]).lerp(
      this.points[nextIndex],
      coordinate - Math.floor(coordinate),
    );
  }

  getPointAt(parameter, target = new THREE.Vector3()) {
    return this.getPoint(parameter, target);
  }
}

class UnitHorizontalSpringCurve3 extends THREE.Curve {
  constructor(length, radius, turns) {
    super();
    this.length = length;
    this.radius = radius;
    this.turns = turns;
  }

  getPoint(parameter, target = new THREE.Vector3()) {
    const endFraction = 0.08;
    if (parameter < endFraction) {
      return target.set(
        this.length * parameter,
        0,
        0,
      );
    }
    if (parameter > 1 - endFraction) {
      return target.set(
        this.length * parameter,
        0,
        0,
      );
    }
    const coilParameter = (parameter - endFraction)
      / (1 - 2 * endFraction);
    const angle = FULL_TURN * this.turns * coilParameter;
    return target.set(
      this.length * parameter,
      this.radius * Math.cos(angle),
      this.radius * Math.sin(angle),
    );
  }

  getPointAt(parameter, target = new THREE.Vector3()) {
    return this.getPoint(parameter, target);
  }
}

function makeCompoundCam({
  axialBaseFront,
  axialStroke,
  backFace,
  baseRadius,
  darkMaterial,
  driverMaterial,
  profileSampleCount,
  radialLift,
  whiteMaterial,
}) {
  const cam = new THREE.Group();
  cam.userData.role =
    'single-rigid-x-axis-compound-cam-C-with-radial-and-axial-prominence';

  const exactSurfaceAtPhase = (phase) => {
    const feed = lawWithDwells(phase, {
      endDwellEnd: 1,
      forwardEnd: 0.36,
      forwardStart: 0.10,
      returnEnd: 0.84,
      returnStart: 0.58,
    });
    const lift = liftLawAtPhase(phase);
    return {
      axialFront: axialBaseFront + axialStroke * feed.value,
      radialRadius: baseRadius + radialLift * lift.value,
    };
  };

  const profilePoints = [];
  const faceRimPoints = [];
  const frontVertices = [];
  const frontIndices = [];
  const innerRadius = 0.23;
  for (let index = 0; index <= profileSampleCount; index += 1) {
    const theta = FULL_TURN * index / profileSampleCount;
    const phase = positiveModulo((Math.PI / 2 - theta) / FULL_TURN, 1);
    const surface = exactSurfaceAtPhase(phase);
    const shapeX = surface.radialRadius * Math.cos(theta);
    const shapeY = surface.radialRadius * Math.sin(theta);
    profilePoints.push(new THREE.Vector2(shapeX, shapeY));

    const outerY = surface.radialRadius * Math.sin(theta);
    const outerZ = -surface.radialRadius * Math.cos(theta);
    const innerY = innerRadius * Math.sin(theta);
    const innerZ = -innerRadius * Math.cos(theta);
    faceRimPoints.push(new THREE.Vector3(
      surface.axialFront + 0.015,
      outerY,
      outerZ,
    ));
    frontVertices.push(
      surface.axialFront, innerY, innerZ,
      surface.axialFront, outerY, outerZ,
      axialBaseFront, outerY, outerZ,
    );
    if (index < profileSampleCount) {
      const here = index * 3;
      const next = (index + 1) * 3;
      // Variable front annulus.
      frontIndices.push(
        here, next + 1, next,
        here, here + 1, next + 1,
      );
      // Outer wall from the base cylinder to the advancing face.
      frontIndices.push(
        here + 2, next + 1, here + 1,
        here + 2, next + 2, next + 1,
      );
    }
  }

  const shape = new THREE.Shape();
  shape.moveTo(profilePoints[0].x, profilePoints[0].y);
  for (let index = 1; index < profilePoints.length; index += 1) {
    shape.lineTo(profilePoints[index].x, profilePoints[index].y);
  }
  shape.closePath();
  const radialBodyGeometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth: axialBaseFront - backFace,
    steps: 1,
  });
  radialBodyGeometry.rotateY(Math.PI / 2);
  radialBodyGeometry.translate(backFace, 0, 0);
  const radialBody = new THREE.Mesh(radialBodyGeometry, driverMaterial);
  radialBody.userData.role =
    'nearly-cylindrical-radial-cam-with-one-broad-lifting-prominence';
  cam.add(radialBody);

  const frontGeometry = new THREE.BufferGeometry();
  frontGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(frontVertices, 3),
  );
  frontGeometry.setIndex(frontIndices);
  frontGeometry.computeVertexNormals();
  const axialFace = new THREE.Mesh(frontGeometry, driverMaterial);
  axialFace.userData.role =
    'front-extension-of-same-prominence-driving-carrier-forward';
  cam.add(axialFace);

  const faceRimCurve = new SampledCamFaceCurve3(
    faceRimPoints.slice(0, profileSampleCount),
  );
  const faceRim = new THREE.Mesh(
    new THREE.TubeGeometry(faceRimCurve, profileSampleCount, 0.035,
      8, true),
    darkMaterial,
  );
  faceRim.userData.role = 'visible-compound-cam-working-edge';
  cam.add(faceRim);

  const shaft = cylinderAlongAxis(
    0.15,
    axialBaseFront - backFace + 1.25,
    new THREE.Vector3(1, 0, 0),
    darkMaterial,
    30,
  );
  shaft.position.x = (axialBaseFront + backFace) / 2 - 0.15;
  shaft.userData.role = 'constant-speed-camshaft';
  cam.add(shaft);

  const indexSurface = exactSurfaceAtPhase(0.75);
  const index = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 18, 12),
    whiteMaterial,
  );
  const indexTheta = Math.PI / 2 - FULL_TURN * 0.75;
  index.position.set(
    indexSurface.axialFront + 0.075,
    indexSurface.radialRadius * Math.sin(indexTheta),
    -indexSurface.radialRadius * Math.cos(indexTheta),
  );
  index.userData.role = 'white-index-showing-continuous-camshaft-rotation';
  cam.add(index);

  const surfaceSamples = Array.from(
    { length: profileSampleCount + 1 },
    (_, index) => ({
      phase: index / profileSampleCount,
      ...exactSurfaceAtPhase(index / profileSampleCount),
    }),
  );
  const renderedSurfaceAtPhase = (phase) => {
    const coordinate = positiveModulo(phase, 1) * profileSampleCount;
    const index = Math.floor(coordinate) % profileSampleCount;
    const amount = coordinate - Math.floor(coordinate);
    const first = surfaceSamples[index];
    const second = surfaceSamples[index + 1];
    return {
      axialFront: THREE.MathUtils.lerp(
        first.axialFront,
        second.axialFront,
        amount,
      ),
      radialRadius: THREE.MathUtils.lerp(
        first.radialRadius,
        second.radialRadius,
        amount,
      ),
    };
  };

  cam.userData.axialFace = axialFace;
  cam.userData.exactSurfaceAtPhase = exactSurfaceAtPhase;
  cam.userData.faceRim = faceRim;
  cam.userData.index = index;
  cam.userData.radialBody = radialBody;
  cam.userData.renderedSurfaceAtPhase = renderedSurfaceAtPhase;
  cam.userData.shaft = shaft;
  cam.userData.surfaceSamples = surfaceSamples;
  return markShadows(cam);
}

function makeCarrierA({
  axialBaseFront,
  carrierMaterial,
  darkMaterial,
  pivotX,
  pivotY,
}) {
  const carrier = new THREE.Group();
  carrier.userData.role =
    'forked-horizontal-carrier-bar-A-sliding-only-in-feed-direction';

  const rails = [-0.25, 0.25].map((z) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(5.95, 0.17, 0.13),
      carrierMaterial,
    );
    rail.position.set(0.15, pivotY + 0.49, z);
    rail.userData.role = 'forked-carrier-A-long-rail';
    carrier.add(rail);
    return rail;
  });
  const cheeks = [-0.25, 0.25].map((z) => {
    const cheek = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.62, 0.16),
      carrierMaterial,
    );
    cheek.position.set(pivotX, pivotY + 0.25, z);
    cheek.userData.role = 'carrier-A-fork-cheek-around-B-pivot';
    carrier.add(cheek);
    return cheek;
  });
  const pivotShaft = cylinderAlongAxis(
    0.145,
    0.78,
    new THREE.Vector3(0, 0, 1),
    darkMaterial,
    28,
  );
  pivotShaft.position.set(pivotX, pivotY, 0);
  pivotShaft.userData.role = 'pivot-joining-feed-bar-B-inside-fork-A';
  carrier.add(pivotShaft);

  const projection = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 0.88, 0.64),
    carrierMaterial,
  );
  projection.position.set(axialBaseFront + 0.10, 0.30, 0);
  projection.userData.role =
    'downward-carrier-projection-following-axial-cam-face';
  carrier.add(projection);
  const projectionContact = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.42, 0.42),
    darkMaterial,
  );
  projectionContact.position.set(axialBaseFront - 0.022, 0.08, 0);
  projectionContact.userData.role = 'axial-cam-face-contact-pad';
  carrier.add(projectionContact);

  carrier.userData.cheeks = cheeks;
  carrier.userData.pivotShaft = pivotShaft;
  carrier.userData.projection = projection;
  carrier.userData.projectionContact = projectionContact;
  carrier.userData.rails = rails;
  return markShadows(carrier);
}

function makeFeedBarB({
  darkMaterial,
  dogX,
  followerArm,
  followerOffsetY,
  feedMaterial,
  whiteMaterial,
}) {
  const bar = new THREE.Group();
  bar.userData.role =
    'feed-bar-B-pivoted-in-fork-A-and-carrying-the-toothed-feeder';

  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(dogX + 0.35, 0.15, 0.22),
    feedMaterial,
  );
  beam.position.set((dogX + 0.35) / 2, 0, 0);
  beam.userData.role = 'rigid-feed-bar-B';
  bar.add(beam);

  const pivotHub = cylinderAlongAxis(
    0.23,
    0.42,
    new THREE.Vector3(0, 0, 1),
    darkMaterial,
    30,
  );
  pivotHub.userData.role = 'feed-bar-B-pivot-hub';
  bar.add(pivotHub);

  const followerPad = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.16, 0.52),
    darkMaterial,
  );
  followerPad.position.set(followerArm, followerOffsetY, 0);
  followerPad.userData.role =
    'underside-pad-resting-by-gravity-on-radial-cam-prominence';
  bar.add(followerPad);

  const dog = new THREE.Group();
  dog.position.set(dogX, 0.07, 0);
  dog.userData.role = 'spur-or-feeder-carried-at-end-of-bar-B';
  const dogPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.12, 0.52),
    feedMaterial,
  );
  dogPlate.userData.role = 'feed-dog-base';
  dog.add(dogPlate);
  const teeth = Array.from({ length: 6 }, (_, index) => {
    const tooth = new THREE.Mesh(
      new THREE.ConeGeometry(0.075, 0.20, 4),
      darkMaterial,
    );
    tooth.position.set(-0.33 + index * 0.132, 0.15, 0);
    tooth.rotation.y = Math.PI / 4;
    tooth.userData.role = 'upward-feed-dog-tooth';
    dog.add(tooth);
    return tooth;
  });
  const dogIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 18, 12),
    whiteMaterial,
  );
  dogIndex.position.set(0.28, 0.20, 0.30);
  dogIndex.userData.role = 'white-index-tracing-the-four-motion-feed-path';
  dog.add(dogIndex);
  bar.add(dog);

  bar.userData.beam = beam;
  bar.userData.dog = dog;
  bar.userData.dogIndex = dogIndex;
  bar.userData.followerPad = followerPad;
  bar.userData.pivotHub = pivotHub;
  bar.userData.teeth = teeth;
  return markShadows(bar);
}

function fourMotionFeed(movement) {
  const root = new THREE.Group();

  // Brown's side elevation is reconstructed as a genuine compound cam. Its
  // radial profile selects B's pivot angle while its variable front face
  // selects A's translation. The profiles use the same angular schedule.
  const cycleDuration = 6;
  const feedStroke = 0.68;
  const radialLift = 0.29;
  const camBaseRadius = 0.82;
  const camCenterY = -0.17;
  const camBackFace = -1.08;
  const camAxialBaseFront = 1.12;
  const camProfileSampleCount = 720;
  const pivotX = -2.58;
  const pivotY = 0.88;
  const followerArm = 2.98;
  const followerOffsetY = -0.15;
  const followerPadHalfHeight = 0.08;
  const dogX = 5.35;
  const workPlateY = 1.17;
  const springFixedX = -4.08;
  const springCarrierLocalX = -2.90;
  const springY = 1.37;
  const springBaseLength = springCarrierLocalX - springFixedX;

  const feedLawAtPhase = (phase) => lawWithDwells(phase, {
    endDwellEnd: 1,
    forwardEnd: 0.36,
    forwardStart: 0.10,
    returnEnd: 0.84,
    returnStart: 0.58,
  });

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.20,
    roughness: 0.50,
  });
  const carrierMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.57,
  });
  const feedMaterial = matte(PALETTE.driven, {
    metalness: 0.18,
    roughness: 0.53,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.42,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.67,
  });
  const springMaterial = matte(PALETTE.accent, {
    metalness: 0.25,
    roughness: 0.46,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.46 });

  const cam = makeCompoundCam({
    axialBaseFront: camAxialBaseFront,
    axialStroke: feedStroke,
    backFace: camBackFace,
    baseRadius: camBaseRadius,
    darkMaterial,
    driverMaterial,
    profileSampleCount: camProfileSampleCount,
    radialLift,
    whiteMaterial,
  });
  cam.position.y = camCenterY;
  root.add(cam);

  const carrierA = makeCarrierA({
    axialBaseFront: camAxialBaseFront,
    carrierMaterial,
    darkMaterial,
    pivotX,
    pivotY,
  });
  root.add(carrierA);

  const feedBarB = makeFeedBarB({
    darkMaterial,
    dogX,
    followerArm,
    followerOffsetY,
    feedMaterial,
    whiteMaterial,
  });
  root.add(feedBarB);

  const springCurve = new UnitHorizontalSpringCurve3(
    springBaseLength,
    0.13,
    8,
  );
  const returnSpring = new THREE.Mesh(
    new THREE.TubeGeometry(springCurve, 144, 0.035, 8, false),
    springMaterial,
  );
  returnSpring.position.set(springFixedX, springY, -0.50);
  returnSpring.userData.role =
    'preloaded-carrier-return-spring-pulling-bar-A-rearward';
  root.add(markShadows(returnSpring));

  const rearSpringAnchor = cylinderAlongAxis(
    0.12,
    0.72,
    new THREE.Vector3(0, 0, 1),
    darkMaterial,
    26,
  );
  rearSpringAnchor.position.set(springFixedX, springY, -0.50);
  rearSpringAnchor.userData.role = 'fixed-return-spring-anchor';
  root.add(markShadows(rearSpringAnchor));

  const guideRails = [-0.39, 0.39].map((z) => {
    const guide = new THREE.Mesh(
      new THREE.BoxGeometry(6.90, 0.10, 0.10),
      frameMaterial,
    );
    guide.position.set(-0.10, pivotY + 0.49, z);
    guide.userData.role = 'fixed-horizontal-guide-for-carrier-A';
    root.add(guide);
    return guide;
  });

  const workPlateLeft = new THREE.Mesh(
    new THREE.BoxGeometry(1.20, 0.12, 1.38),
    frameMaterial,
  );
  workPlateLeft.position.set(1.80, workPlateY, 0);
  workPlateLeft.userData.role = 'fixed-work-plate-left-of-feed-dog-slot';
  const workPlateRight = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.12, 1.38),
    frameMaterial,
  );
  workPlateRight.position.set(3.45, workPlateY, 0);
  workPlateRight.userData.role = 'fixed-work-plate-right-of-feed-dog-slot';
  root.add(markShadows(workPlateLeft), markShadows(workPlateRight));

  const shaftBearings = [-1.60, 2.25].map((x) => {
    const support = beamBetween(
      new THREE.Vector3(x, -1.65, -0.82),
      new THREE.Vector3(x, camCenterY, -0.82),
      0.15,
      0.22,
      frameMaterial,
    );
    support.userData.role = 'fixed-camshaft-bearing-support';
    root.add(support);
    return support;
  });
  const base = beamBetween(
    new THREE.Vector3(-4.42, -1.65, -0.82),
    new THREE.Vector3(4.15, -1.65, -0.82),
    0.17,
    0.30,
    frameMaterial,
  );
  base.userData.role = 'fixed-four-motion-feed-base';
  root.add(base);

  const rockerAngleAtLiftFraction = (liftFraction) => {
    const armRadius = Math.hypot(followerArm, followerOffsetY);
    const offsetAngle = Math.atan2(followerOffsetY, followerArm);
    return Math.asin(
      (followerOffsetY + radialLift * liftFraction) / armRadius,
    ) - offsetAngle;
  };

  const overallStageAtPhase = (phase) => {
    const p = positiveModulo(phase, 1);
    if (p < 0.10) return 'lowered-rear-dwell';
    if (p < 0.22) return 'simultaneous-cam-rise-and-forward-feed';
    if (p < 0.36) return 'raised-forward-feed';
    if (p < 0.48) return 'raised-at-forward-limit';
    if (p < 0.58) return 'gravity-drop-at-forward-limit';
    if (p < 0.84) return 'spring-return-below-work';
    return 'lowered-rear-dwell';
  };

  const stateAtTime = (time) => {
    const cycleCoordinate = time / cycleDuration;
    const cyclePhase = positiveModulo(cycleCoordinate, 1);
    const feed = feedLawAtPhase(cyclePhase);
    const lift = liftLawAtPhase(cyclePhase);
    const carrierX = feedStroke * feed.value;
    const carrierVelocity = feedStroke * feed.ratePerPhase
      / cycleDuration;
    const carrierAcceleration = feedStroke
      * feed.accelerationPerPhaseSquared / cycleDuration ** 2;
    const rockerAngle = rockerAngleAtLiftFraction(lift.value);
    const followerPointLocal = new THREE.Vector2(
      followerArm,
      followerOffsetY,
    ).rotateAround(new THREE.Vector2(0, 0), rockerAngle);
    const followerPadCenterWorld = new THREE.Vector2(
      carrierX + pivotX + followerPointLocal.x,
      pivotY + followerPointLocal.y,
    );
    const radialCamTopY = camCenterY + camBaseRadius
      + radialLift * lift.value;
    const axialCamFrontX = camAxialBaseFront + carrierX;
    const dogPointLocal = new THREE.Vector2(dogX, 0.27)
      .rotateAround(new THREE.Vector2(0, 0), rockerAngle);
    const feedDogTipWorld = new THREE.Vector2(
      carrierX + pivotX + dogPointLocal.x,
      pivotY + dogPointLocal.y,
    );
    return {
      axialCamContactError:
        carrierX + camAxialBaseFront - axialCamFrontX,
      axialCamFrontX,
      camAngle: FULL_TURN * cycleCoordinate,
      camAngularSpeed: FULL_TURN / cycleDuration,
      carrierAcceleration,
      carrierVelocity,
      carrierX,
      clothEngaged: feedDogTipWorld.y >= workPlateY,
      cycleCoordinate,
      cyclePhase,
      feedDogTipWorld,
      feedLaw: feed,
      followerPadCenterWorld,
      gravityDropActive: lift.stage === 'gravity-drop-on-receding-cam',
      liftLaw: lift,
      overallStage: overallStageAtPhase(cyclePhase),
      radialCamContactError:
        followerPadCenterWorld.y - followerPadHalfHeight
        - radialCamTopY,
      radialCamTopY,
      rockerAngle,
      springExtension: carrierX,
      springLength: springBaseLength + carrierX,
      springReturnActive: feed.stage === 'spring-return-stroke',
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    cam.rotation.x = state.camAngle;
    carrierA.position.x = state.carrierX;
    feedBarB.position.set(
      state.carrierX + pivotX,
      pivotY,
      0,
    );
    feedBarB.rotation.z = state.rockerAngle;
    returnSpring.scale.x = state.springLength / springBaseLength;
    root.userData.contacts = {
      axialCamToCarrierProjection: {
        active: true,
        faceX: state.axialCamFrontX,
        residual: state.axialCamContactError,
        springLoaded: true,
      },
      forkAToBarBPivot: {
        active: true,
        pivot: new THREE.Vector2(
          state.carrierX + pivotX,
          pivotY,
        ),
      },
      radialCamToBarB: {
        active: true,
        gravityLoaded: true,
        residual: state.radialCamContactError,
        topY: state.radialCamTopY,
      },
    };
    root.userData.kinematics = state;
  };

  const lowState = stateAtTime(0);
  const highState = stateAtTime(cycleDuration * 0.30);
  root.userData = {
    archetype:
      'wilson-compound-radial-and-axial-cam-driving-forked-carrier-and-pivoted-feed-dog-through-four-motion-cycle',
    blocks: {
      base,
      cam,
      carrierA,
      feedBarB,
      guideRails,
      rearSpringAnchor,
      returnSpring,
      shaftBearings,
      workPlateLeft,
      workPlateRight,
    },
    camSynthesis: {
      exactSurfaceAtPhase: cam.userData.exactSurfaceAtPhase,
      profileSampleCount: camProfileSampleCount,
      renderedSurfaceAtPhase: cam.userData.renderedSurfaceAtPhase,
      surfaceSamples: cam.userData.surfaceSamples,
    },
    constraintResiduals: {
      highRadialContact: highState.radialCamContactError,
      lowRadialContact: lowState.radialCamContactError,
      rearAxialContact: lowState.axialCamContactError,
      strokeAxialContact: highState.axialCamContactError,
    },
    constraints: {
      barA:
        'Forked carrier A has one horizontal translation and carries the pivot of B; the return spring keeps its projection against the compound cam front.',
      barB:
        'Feed bar B is rigidly pivoted inside A’s fork, carries the feeder teeth, and rests by gravity on the radial cam surface.',
      cam:
        'One fixed-axis rigid cam C turns continuously; its radial prominence raises B and its coincident axial extension drives A forward.',
      return:
        'After the prominence recedes, B drops and the extended spring returns A while the teeth remain below the work plate.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'carrier A horizontal translation selected by axial cam face',
        'feed bar B pivot angle selected by radial cam surface',
      ],
      independentPrescribedInputs: 1,
      inputs: ['constant-speed compound-cam angle'],
      note:
        'Gravity and spring preload maintain the two unilateral cam contacts; their force dynamics are not integrated.',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid cam, carrier, feed bar, pivot, feeder, and frame',
        'zero-clearance gravity-loaded radial contact',
        'zero-clearance spring-loaded axial contact',
        'constant camshaft speed and prescribed quasi-static return',
        'inertia, impact, friction, fabric load, and spring-force magnitude omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless compound-cam kinematic reconstruction',
    },
    fidelity: 'authored',
    geometry: {
      camAxialBaseFront,
      camBackFace,
      camBaseRadius,
      camCenterY,
      camProfileSampleCount,
      dogX,
      feedStroke,
      followerArm,
      followerOffsetY,
      followerPadHalfHeight,
      pivotX,
      pivotY,
      radialLift,
      springBaseLength,
      springCarrierLocalX,
      springFixedX,
      workPlateY,
    },
    mechanism:
      'one-constant-speed-compound-cam-C-uses-a-radial-prominence-to-lift-pivoted-feed-bar-B-and-the-same-prominences-axial-front-extension-to-drive-forked-carrier-A-forward-before-gravity-drop-and-spring-return',
    motion: {
      cycleDuration,
      phaseIntervals: {
        forwardCamStroke: [0.10, 0.36],
        gravityDrop: [0.48, 0.58],
        lifted: [0.22, 0.48],
        radialRise: [0.10, 0.22],
        rearDwell: [[0, 0.10], [0.84, 1]],
        springReturn: [0.58, 0.84],
      },
      sequence:
        'lowered rear -> rise while forward feed begins -> raised forward feed -> drop at forward limit -> spring return below work -> lowered rear',
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 400 page marks Animated unavailable and supplies only Brown’s static side elevation.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate400: {
        barAApproximatePixels: [52, 400, 225, 248],
        camCenterApproximatePixels: [344, 296],
        feedDogApproximatePixels: [423, 485, 218, 243],
        forkPivotApproximatePixels: [108, 261],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 7,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'A is forked',
          'B is pivoted in A’s fork and carries the spur or feeder',
          'a radial projection on cam C lifts B while both bars move forward',
          'a spring produces the return stroke',
          'B drops by gravity',
        ],
        engravingEvidence:
          'The side elevation shows long forked carrier A, the nested feed bar B and its right-hand teeth, a left fork pivot, a spring, and cam C on a shaft parallel to the feed direction.',
        reconstructionDisclosure:
          'Brown supplies no dimensions, cam coordinates, phase intervals, speed, or lift and stroke magnitudes. The smooth dwell schedule and the exact radial/axial cam surfaces realizing it are independently synthesized.',
      },
      officialPage: movement.sourceUrl,
      usPatent12116: {
        date: '1854-12-19',
        inventor: 'Allen B. Wilson',
        number: 'US12116A',
        operationalEvidence:
          'The specification says the cam is nearly cylindrical and concentric with one peripheral prominence extending to the front: its radial portion raises the toothed spring-bar, its front acts on the feed-bar projection, and spring n returns the feed bar after the prominence passes.',
        url: 'https://patents.google.com/patent/US12116A/en',
      },
      plate: 'Brown 1868, Movement 400',
    },
    stateAtTime,
    timeline: {
      cycleDuration,
      sourcePosePhase: 0,
    },
    transmission: {
      axialCamLaw:
        'x_A(phi)=feedStroke*feedLaw(phi); the spring-loaded projection follows the cam front x=baseFront+x_A',
      radialCamLaw:
        'r(phi)=baseRadius+radialLift*liftLaw(phi); B rotates so its underside pad remains on the upper radial surface',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.62, -1.86, -1.35),
    new THREE.Vector3(4.30, 1.82, 1.35),
  );
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraDirection = new THREE.Vector3(7.8, 5.0, 11.8);
  root.userData.groundFloorY = -1.78;
  update(0);
  return { root, update };
}

export function createAuthoredFourMotionFeedMovement(movement) {
  if (movement.id !== 400) return null;
  return fourMotionFeed(movement);
}
