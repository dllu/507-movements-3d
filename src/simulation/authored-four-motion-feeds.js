import * as THREE from 'three';
import {circle, plate, poly, polygonClipping, ring} from './finite-plate-geometry.js';
import {sphereFaceSupport} from './sphere-face-support.js';
import {creaseIndexedNormals} from './crease-normals.js';
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
    // A plain helix end to end: its end coils bear on the leg and the stop.
    // (Straight axial leads that jumped out to the coil radius twisted the
    // tube's frames and inverted its shading.)
    // The end coils stop one wire radius short of the leg and the stop, so
    // they bear on their faces.
    const angle = FULL_TURN * this.turns * parameter;
    const wire = 0.035;
    return target.set(
      wire + (this.length - 2 * wire) * parameter,
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

  const nominalControlAtPhase = (phase) => {
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
  // The face annulus stays inside the radial body so B's follower pad clears it.
  const axialOuterRadius = Math.min(0.68, baseRadius - 0.02);
  const followerRadius = 0.08;
  const radialMeshAllowance = 0.00006;
  const axialContactTriangles = [];
  for (let index = 0; index <= profileSampleCount; index += 1) {
    const theta = FULL_TURN * index / profileSampleCount;
    const phase = positiveModulo((Math.PI / 2 - theta) / FULL_TURN, 1);
    const surface = nominalControlAtPhase(phase);
    // Inward normal offset of the rounded radial follower's pitch curve.
    const pitchRadius = surface.radialRadius + followerRadius;
    const derivative = -radialLift * liftLawAtPhase(phase).ratePerPhase / FULL_TURN;
    const speed = Math.hypot(pitchRadius, derivative);
    const shapeX = pitchRadius * Math.cos(theta)
      - (followerRadius + radialMeshAllowance) * (pitchRadius * Math.cos(theta) + derivative * Math.sin(theta)) / speed;
    const shapeY = pitchRadius * Math.sin(theta)
      - (followerRadius + radialMeshAllowance) * (pitchRadius * Math.sin(theta) - derivative * Math.cos(theta)) / speed;
    profilePoints.push(new THREE.Vector2(shapeX, shapeY));

    const outerY = axialOuterRadius * Math.sin(theta);
    const outerZ = -axialOuterRadius * Math.cos(theta);
    const innerY = innerRadius * Math.sin(theta);
    const innerZ = -innerRadius * Math.cos(theta);
    // The dark working-edge line runs just outside the bore, inside the
    // annulus the carrier's face button sweeps (radius 0.42-0.58).
    faceRimPoints.push(new THREE.Vector3(
      surface.axialFront - 0.04,
      (innerRadius + 0.07) * Math.sin(theta),
      -(innerRadius + 0.07) * Math.cos(theta),
    ));
    frontVertices.push(
      surface.axialFront, innerY, innerZ,
      surface.axialFront, outerY, outerZ,
      axialBaseFront, outerY, outerZ,
      axialBaseFront, innerY, innerZ,
    );
    if (index < profileSampleCount) {
      const here = index * 4, next = (index + 1) * 4;
      frontIndices.push(
        here, next + 1, next, here, here + 1, next + 1,
        here + 2, next + 1, here + 1, here + 2, next + 2, next + 1,
        here + 3, next + 2, here + 2, here + 3, next + 3, next + 2,
        here, next + 3, here + 3, here, next, next + 3,
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
  const finiteVertices = frontGeometry.attributes.position;
  for (let i = 0; i < profileSampleCount; i++) {
    const here = i * 4, next = (i + 1) * 4;
    for (const indices of [[here, next + 1, next], [here, here + 1, next + 1]]) {
      axialContactTriangles.push(indices.map(j => [finiteVertices.getX(j), finiteVertices.getY(j), finiteVertices.getZ(j)]));
    }
  }
  // The four walls share each station's corner vertices; crease them so the
  // flat front face, rim, back and bore shade flat instead of as one blob.
  creaseIndexedNormals(frontGeometry);
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
  faceRim.visible = false; // ink edge line only: kept for references, not drawn
  faceRim.userData.retiredInkOutline = true;
  cam.add(faceRim);

  const shaft = cylinderAlongAxis(
    0.12,
    // Brown's shaft runs well out either side of the thin cam.
    axialBaseFront + axialStroke - backFace + 1.90,
    new THREE.Vector3(1, 0, 0),
    darkMaterial,
    30,
  );
  shaft.position.x = (axialBaseFront + axialStroke + backFace) / 2;
  shaft.userData.role = 'constant-speed-camshaft';
  cam.add(shaft);

  const indexSurface = nominalControlAtPhase(0.75);
  const index = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 18, 12),
    whiteMaterial,
  );
  const indexTheta = Math.PI / 2 - FULL_TURN * 0.75;
  index.position.set(
    indexSurface.axialFront + 0.03,
    0.28 * Math.sin(indexTheta),
    -0.28 * Math.cos(indexTheta),
  );
  index.userData.role = 'white-index-showing-continuous-camshaft-rotation';
  cam.add(index);

  const surfaceSamples = Array.from(
    { length: profileSampleCount + 1 },
    (_, index) => ({
      phase: index / profileSampleCount,
      ...nominalControlAtPhase(index / profileSampleCount),
    }),
  );
  const sampledControlAtPhase = (phase) => {
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
  cam.userData.axialContactTriangles = axialContactTriangles;
  cam.userData.axialSphereSupport = sphereFaceSupport(axialContactTriangles, followerRadius);
  cam.userData.nominalControlAtPhase = nominalControlAtPhase;
  cam.userData.faceRim = faceRim;
  cam.userData.index = index;
  cam.userData.radialBody = radialBody;
  cam.userData.sampledControlAtPhase = sampledControlAtPhase;
  cam.userData.shaft = shaft;
  cam.userData.surfaceSamples = surfaceSamples;
  return markShadows(cam);
}

function makeCarrierA({
  axialBaseFront,
  camCenterY,
  carrierMaterial,
  darkMaterial,
  pivotX,
  pivotY,
}) {
  const carrier = new THREE.Group();
  carrier.userData.role =
    'forked-horizontal-carrier-bar-A-sliding-only-in-feed-direction';

  // Brown draws A as a deep bar; its rails are 0.24 deep.
  const rails = [-0.25, 0.25].map((z) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(5.025, 0.24, 0.13),
      carrierMaterial,
    );
    rail.position.set(-0.3125, pivotY + 0.49, z);
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

  // Two fork legs clear B; a narrow neck carries the rounded face button.
  const projection = new THREE.Group();
  projection.userData.role = 'downward-carrier-projection-following-axial-cam-face';
  // The face button runs 0.50 above the cam axis; the legs rise to the rails.
  const rearX = axialBaseFront + 0.60, contactY = camCenterY + 0.50;
  const legTop = pivotY + 0.37;
  for (const z of [-0.25, 0.25]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, legTop - contactY, 0.13), carrierMaterial);
    leg.position.set(rearX, (legTop + contactY) / 2, z);projection.add(leg);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.63), carrierMaterial);
  bridge.position.set(rearX, contactY, 0);projection.add(bridge);
  const neck = cylinderAlongAxis(0.045, rearX - axialBaseFront - 0.08, new THREE.Vector3(1, 0, 0), darkMaterial, 24);
  neck.position.set((rearX + axialBaseFront + 0.08) / 2, contactY, 0);projection.add(neck);
  carrier.add(projection);
  const projectionContact = new THREE.Mesh(new THREE.SphereGeometry(0.08, 40, 24), darkMaterial);
  projectionContact.position.set(axialBaseFront + 0.08, contactY, 0);
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
    new THREE.BoxGeometry(dogX + 0.35 - 0.18, 0.15, 0.22),
    feedMaterial,
  );
  beam.position.set((dogX + 0.35 + 0.18) / 2, 0, 0);
  beam.userData.role = 'rigid-feed-bar-B';
  bar.add(beam);

  const pivotHub = new THREE.Mesh(ring(0.16, 0.23, -0.17, 0.17, 64), darkMaterial);
  pivotHub.userData.role = 'feed-bar-B-pivot-hub';
  bar.add(pivotHub);

  const followerPad = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 40, 24),
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
  dogIndex.position.set(0.28, 0.20, 0);
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
  // Brown's cam C is thin along its shaft (about half its diameter). B's pad
  // slides across the periphery by one feed stroke and the front face adds
  // one more, so the stroke is shortened to keep the cam that narrow.
  const feedStroke = 0.32;
  const radialLift = 0.29;
  // Brown's cam C is small beside the bars: its radius is reduced and its
  // axis raised by the same amount, so every working contact keeps its height.
  const camBaseRadius = 0.60;
  const camCenterY = 0.05;
  const camBackFace = 0.30;
  const camAxialBaseFront = 0.75; // exact in float32, so the rest face sits at carrier zero
  const camProfileSampleCount = 720;
  const pivotX = -2.58;
  const pivotY = 0.88;
  const followerArm = 2.98;
  const followerOffsetY = -0.15;
  const followerPadHalfHeight = 0.08;
  const dogX = 5.35;
  const workPlateY = 1.17;
  // Brown draws the return spring inside A at its left end: it bears
  // between A's left cross-leg and a fixed stop inside the fork, and is
  // compressed as A feeds forward, so it pushes A back.
  const springCarrierLocalX = -2.74;
  const springBaseLength = 1.18;
  const springFixedX = springCarrierLocalX + springBaseLength;
  const springY = 1.37;

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
    camCenterY,
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

  // Coil radius 0.11: the coils (0.145 outside) stay within the stop's
  // face and clear of the strap above it.
  const springCurve = new UnitHorizontalSpringCurve3(
    springBaseLength,
    0.11,
    8,
  );
  const returnSpring = new THREE.Mesh(
    new THREE.TubeGeometry(springCurve, 144, 0.035, 8, false),
    springMaterial,
  );
  returnSpring.position.set(springCarrierLocalX, springY, 0);
  returnSpring.userData.role =
    'preloaded-carrier-return-spring-pushing-bar-A-rearward';
  root.add(markShadows(returnSpring));

  // A's left cross-leg joining the fork rails, on which the spring bears.
  const springLeg = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.24, 0.40),
    carrierMaterial,
  );
  springLeg.position.set(springCarrierLocalX - 0.04, springY, 0);
  springLeg.userData.role = 'carrier-A-left-cross-leg-bearing-return-spring';
  carrierA.add(markShadows(springLeg));
  // Brown's hatched stop inside the fork (its frame support is undrawn).
  const rearSpringAnchor = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 0.30, 0.30),
    frameMaterial,
  );
  rearSpringAnchor.position.set(springFixedX + 0.10, springY, 0);
  rearSpringAnchor.userData.role = 'fixed-return-spring-stop-inside-fork-A';
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
    new THREE.BoxGeometry(3.20, 0.12, 0.48),
    frameMaterial,
  );
  workPlateLeft.position.set(2.55, workPlateY, -0.60);
  workPlateLeft.userData.role = 'fixed-work-plate-left-of-feed-dog-slot';
  const workPlateRight = new THREE.Mesh(
    new THREE.BoxGeometry(3.20, 0.12, 0.48),
    frameMaterial,
  );
  workPlateRight.position.set(2.55, workPlateY, 0.60);
  workPlateRight.userData.role = 'fixed-work-plate-right-of-feed-dog-slot';
  root.add(markShadows(workPlateLeft), markShadows(workPlateRight));

  const shaftBearings = [camBackFace - 0.28, camAxialBaseFront + feedStroke + 0.28].map((x) => {
    const support = beamBetween(
      new THREE.Vector3(x, -1.65, 0),
      new THREE.Vector3(x, camCenterY - 0.21, 0),
      0.15,
      0.22,
      frameMaterial,
    );
    support.userData.role = 'fixed-camshaft-bearing-support';
    const bearing = new THREE.Mesh(ring(0.18, 0.25, -0.12, 0.12, 64), frameMaterial);
    bearing.rotation.y = Math.PI / 2;bearing.position.set(x, camCenterY, 0);
    bearing.userData.role = 'bored-fixed-camshaft-bearing';
    root.add(support, bearing);
    support.userData.bearing = bearing;
    return support;
  });
  const base = beamBetween(
    new THREE.Vector3(-4.42, -1.65, 0),
    new THREE.Vector3(4.15, -1.65, 0),
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

  const axialStateAtPhase = phase => {
    const angle = FULL_TURN * phase;
    return cam.userData.axialSphereSupport(0.50 * Math.cos(angle), -0.50 * Math.sin(angle));
  };
  const axialVelocity = (phase, contact) => {
    const angle = FULL_TURN * phase, n = contact.normal;
    return 0.50 * (n[1] * Math.sin(angle) + n[2] * Math.cos(angle)) / n[0] * FULL_TURN / cycleDuration;
  };
  const stateAtTime = (time) => {
    const cycleCoordinate = time / cycleDuration;
    const cyclePhase = positiveModulo(cycleCoordinate, 1);
    const feed = feedLawAtPhase(cyclePhase);
    const lift = liftLawAtPhase(cyclePhase);
    const axialContact = axialStateAtPhase(cyclePhase);
    const carrierX = axialContact.x - camAxialBaseFront - 0.08;
    const carrierVelocity = axialVelocity(cyclePhase, axialContact);
    const epsilon = 1e-6;
    const carrierAcceleration = (axialVelocity(cyclePhase + epsilon, axialStateAtPhase(cyclePhase + epsilon))
      - axialVelocity(cyclePhase - epsilon, axialStateAtPhase(cyclePhase - epsilon))) / (2 * epsilon * cycleDuration);
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
    const axialCamFrontX = axialContact.point[0];
    const pitchRadius = camBaseRadius + 0.08 + radialLift * lift.value;
    const derivative = -radialLift * lift.ratePerPhase / FULL_TURN;
    const pitchSpeed = Math.hypot(pitchRadius, derivative);
    const radialNormal = new THREE.Vector3(0, pitchRadius / pitchSpeed, -derivative / pitchSpeed);
    const radialContactPoint = new THREE.Vector3(followerPadCenterWorld.x, followerPadCenterWorld.y, 0)
      .addScaledVector(radialNormal, -0.08);
    const dogPointLocal = new THREE.Vector2(dogX, 0.27)
      .rotateAround(new THREE.Vector2(0, 0), rockerAngle);
    const feedDogTipWorld = new THREE.Vector2(
      carrierX + pivotX + dogPointLocal.x,
      pivotY + dogPointLocal.y,
    );
    return {
      axialCamContactError: Math.hypot(axialContact.x - axialContact.point[0],
        0.50 * Math.cos(FULL_TURN * cyclePhase) - axialContact.point[1],
        -0.50 * Math.sin(FULL_TURN * cyclePhase) - axialContact.point[2]) - 0.08,
      axialContact,
      nominalCarrierX: feedStroke * feed.value,
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
      overallStage: lift.value < 1e-10 && Math.abs(carrierVelocity) > 1e-8
        ? carrierVelocity > 0 ? 'lowered-forward-clearance-takeup' : 'spring-return-below-work'
        : overallStageAtPhase(cyclePhase),
      radialCamContactError: new THREE.Vector3(followerPadCenterWorld.x, followerPadCenterWorld.y, 0)
        .distanceTo(radialContactPoint) - 0.08,
      radialCamTopY,
      radialContactPoint,
      radialNormal,
      rockerAngle,
      springExtension: carrierX,
      springLength: springBaseLength - carrierX,
      springReturnActive: carrierVelocity < -1e-8,
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
    returnSpring.position.x = state.carrierX + springCarrierLocalX;
    returnSpring.scale.x = state.springLength / springBaseLength;
    root.userData.contacts = {
      axialCamToCarrierProjection: {
        active: true,
        faceX: state.axialCamFrontX,
        residual: state.axialCamContactError,
        springLoaded: true,
        point: new THREE.Vector3(...state.axialContact.point)
          .applyAxisAngle(new THREE.Vector3(1, 0, 0), state.camAngle).add(cam.position),
        normal: new THREE.Vector3(...state.axialContact.normal)
          .applyAxisAngle(new THREE.Vector3(1, 0, 0), state.camAngle),
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
        topY: state.radialContactPoint.y,
        point: state.radialContactPoint.clone(),
        normal: state.radialNormal.clone(),
        renderedClearanceAllowance: 0.00006,
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
      nominalControlAtPhase: cam.userData.nominalControlAtPhase,
      profileSampleCount: camProfileSampleCount,
      sampledControlAtPhase: cam.userData.sampledControlAtPhase,
      surfaceSamples: cam.userData.surfaceSamples,
      sampleMeaning: 'nominal radial pitch radius minus follower radius, and axial front control ordinates',
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
        'rounded gravity-loaded radial contact with 0.00006 mesh allowance',
        'finite rounded spring-loaded axial contact solved against the face triangles',
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
      radialFollowerRadius: 0.08,
      axialFollowerRadius: 0.08,
      radialMeshAllowance: 0.00006,
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
          'Brown supplies no dimensions, cam coordinates, phase intervals, speed, or lift and stroke magnitudes. The smooth dwell schedule is independently synthesized. Rounded followers, fork legs and a longitudinal work-plate opening are inferred. The finite axial button shifts the nominal feed timing slightly; gravity and spring preload are not dynamically solved.',
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
        'carrier translation is the exact finite-sphere support of the triangulated axial face; the original feed law defines that face',
      radialCamLaw:
        'B rotates so its rounded follower center follows the radial pitch curve; the cam is its inward normal offset',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.62, -1.86, -1.35),
    new THREE.Vector3(4.30, 1.82, 1.35),
  );
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraDirection = new THREE.Vector3(7.8, 5.0, 11.8);
  root.userData.hideGround = true;
  root.traverse(object => {
    for (const material of object.material ? [].concat(object.material) : []) material.fog = false;
  });
  addFourMotionFeedSupports(root, frameMaterial);
  update(0);
  return { root, update };
}

// Pass 57: Brown draws no frame. A plain back bar behind the rails carries
// two C-guides round the rear rail of A (open toward the fork, so A slides
// only in the feed direction) and a strap holding the spring stop; a pillar
// grounds it. The camshaft runs in two bored pedestals on the same floor.
function addFourMotionFeedSupports(root, material) {
  const floorY = -1.20, barBack = -1.02, barFront = -0.92;
  const railLow = 1.25, railHigh = 1.49, railInner = -0.19, railOuter = -0.31;
  const shaftY = 0.05, shaftRadius = 0.12;
  const add = (geometry, role) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.role = role;mesh.castShadow = true;mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };
  const box = (x0, x1, y0, y1, z0, z1) => new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)
    .translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  // Extrude a (z, y) outline along x from x0 to x1 (shape x = -world z).
  const alongX = (outline, x0, x1) => plate(outline, x0, x1).rotateY(Math.PI / 2);
  const zy = (z0, z1, y0, y1) => poly([[-z1, y0], [-z0, y0], [-z0, y1], [-z1, y1]]);
  add(box(-1.62, 0.55, railLow, railHigh, barBack, barFront), 'fixed-back-bar-behind-carrier-A');
  const guide = polygonClipping.difference(zy(barFront - 0.001, railInner, railLow - 0.06, railHigh + 0.06),
    zy(railOuter - 0.008, railInner + 0.01, railLow - 0.008, railHigh + 0.008));
  for (const [x0, x1] of [[-0.95, -0.65], [0.15, 0.45]]) add(alongX(guide, x0, x1), 'fixed-c-guide-round-rear-rail-of-A');
  // The spring stop hangs from a strap running over the rear rail.
  add(alongX(zy(barFront - 0.001, 0.15, 1.52, 1.60), -1.56, -1.36), 'fixed-strap-carrying-return-spring-stop');
  add(box(-1.05, -0.85, floorY + 0.08, railLow + 0.001, barBack, barFront), 'fixed-back-bar-pillar');
  add(box(-1.25, -0.65, floorY, floorY + 0.08, barBack - 0.18, barFront + 0.18), 'fixed-back-bar-foot');
  const pedestal = polygonClipping.difference(
    polygonClipping.union(zy(-0.20, 0.20, floorY + 0.08, shaftY + 0.01), poly(circle([0, shaftY], 0.23, 48))),
    poly(circle([0, shaftY], shaftRadius + 0.0005, 48)));
  for (const [x0, x1] of [[-0.55, -0.35], [1.80, 2.00]]) {
    add(alongX(pedestal, x0, x1), 'fixed-bored-camshaft-pedestal');
    add(box(x0 - 0.12, x1 + 0.12, floorY, floorY + 0.08, -0.34, 0.34), 'fixed-camshaft-pedestal-foot');
  }
}

export function createAuthoredFourMotionFeedMovement(movement) {
  if (movement.id !== 400) return null;
  return fourMotionFeed(movement);
}
