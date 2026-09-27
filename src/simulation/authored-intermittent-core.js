import { finishSplitRim213 } from './split-rim-213-contact.js';
import { finishGeneva212Contact } from './geneva-212-contact.js';
import { installLanternStop233 } from './lantern-stop-233-working-parts.js';
import { stop240Definitions } from './ratchet-stop-240-contact.js';
import { stateStops240, finishStops240, stop240MaximumLifts } from './ratchet-stop-240-working-parts.js';
import { crown237Return, crown237LiftAtTravel, crown237Triangles, crown237Closest, installCrown237Parts, fitCrown237 } from './crown-pawl-237-working-parts.js';
import { finishSingleTooth241 } from './single-tooth-241-working-parts.js';
import { installAlternatingPawl236 } from './alternating-pawl-236-working-parts.js';
import { starTappetState, finishStarTappet } from './star-tappet-working-parts.js';
import { carrierPawlFlank225, carrierPawlClearance225, carrierPawlBarLiftLimit225, installCarrierPawl225 } from './carrier-pawl-225-working-parts.js';
import {finishLiftDrawPawl232} from './lift-draw-pawl-232-working-parts.js';
import { finishGenevaWorkingParts } from './geneva-stop-working-parts.js';
import { capsule as clipCapsule, circle as clipCircle, poly as clipPoly, polygonClipping } from './finite-plate-geometry.js';
import { correctGearFingerStop } from './gear-finger-stop-working-parts.js';
import snapCounterMotion from './baked/intermittent-63-211-snap-counter-cuts.js';
import {
  SOURCE_SCALE as SNAP_COUNTER_SCALE,
  makeSnapCounterMechanism,
  snapCounterMotionFingerprint,
  starOutline,
} from './snap-counter-63-mechanism.js';
import * as THREE from 'three';
import { makeSeeThrough } from './see-through-part.js';
import { applyRotationIndicator } from './rotation-indicator.js';
import {
  PALETTE,
  makeBeam,
  makeDynamicCable,
  makeDynamicLink,
  makeGear,
  makePulley,
  makeScrew,
  makeShaft,
  makeSpring,
  markShadows,
  matte,
  setSpin,
  smoothStep01,
} from './primitives.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

function finish(root, update, cameraDirection = new THREE.Vector3(6.4, 4.4, 8.6)) {
  root.userData.fidelity = 'authored';
  markShadows(root);
  return { root, update, cameraDirection };
}

function centeredExtrusion(shape, depth) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: Math.min(0.025, depth * 0.12),
    bevelThickness: Math.min(0.025, depth * 0.12),
    curveSegments: 18,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function makePlanarRotor() {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.userData.axis = Z_AXIS.clone();
  root.userData.rotor = rotor;
  return root;
}

function flatCenteredExtrusion(shapes, depth) {
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    bevelEnabled: false,
    curveSegments: 18,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function circleRing(radius, segments, clockwise = false) {
  const ring = Array.from({ length: segments }, (_, index) => {
    const angle = index * Math.PI * 2 / segments;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
  return clockwise ? ring.reverse() : ring;
}

function makeAnnulusGeometry(innerRadius, outerRadius, depth) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return centeredExtrusion(shape, depth);
}

function makeHalfAnnulusGeometry(innerRadius, outerRadius, depth, startAngle) {
  const endAngle = startAngle + Math.PI;
  const shape = new THREE.Shape();
  shape.moveTo(
    Math.cos(startAngle) * innerRadius,
    Math.sin(startAngle) * innerRadius,
  );
  shape.lineTo(
    Math.cos(startAngle) * outerRadius,
    Math.sin(startAngle) * outerRadius,
  );
  shape.absarc(0, 0, outerRadius, startAngle, endAngle, false);
  shape.lineTo(
    Math.cos(endAngle) * innerRadius,
    Math.sin(endAngle) * innerRadius,
  );
  shape.absarc(0, 0, innerRadius, endAngle, startAngle, true);
  shape.closePath();
  return centeredExtrusion(shape, depth);
}







function makeOpenRimTappetDriver({
  baseDepth,
  basePlaneZ,
  baseRadius,
  openingEndAngle,
  openingStartAngle,
  rimDepth,
  rimInnerRadius,
  rimOuterRadius,
  rimPlaneZ,
  tappetDepth,
  tappetHalfWidth,
  tappetLength,
}) {
  const root = makePlanarRotor();
  const rotor = root.userData.rotor;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(baseRadius, baseRadius, baseDepth, 80),
    matte(PALETTE.driver, { metalness: 0.1, roughness: 0.66 }),
  );
  body.rotation.x = Math.PI / 2;
  body.position.z = basePlaneZ;
  body.userData.driverWheelCBody = true;
  rotor.add(body);

  const longArcStart = openingEndAngle;
  const longArcEnd = openingStartAngle + Math.PI * 2;
  const rimSamples = 112;
  const outerArc = Array.from({ length: rimSamples + 1 }, (_, index) => {
    const angle = THREE.MathUtils.lerp(
      longArcStart,
      longArcEnd,
      index / rimSamples,
    );
    return new THREE.Vector2(
      Math.cos(angle) * rimOuterRadius,
      Math.sin(angle) * rimOuterRadius,
    );
  });
  const innerArc = Array.from({ length: rimSamples + 1 }, (_, index) => {
    const angle = THREE.MathUtils.lerp(
      longArcEnd,
      longArcStart,
      index / rimSamples,
    );
    return new THREE.Vector2(
      Math.cos(angle) * rimInnerRadius,
      Math.sin(angle) * rimInnerRadius,
    );
  });
  const rimShape = new THREE.Shape();
  for (const [index, point] of [...outerArc, ...innerArc].entries()) {
    if (index === 0) rimShape.moveTo(point.x, point.y);
    else rimShape.lineTo(point.x, point.y);
  }
  rimShape.closePath();
  const rimGeometry = new THREE.ExtrudeGeometry(rimShape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth: rimDepth,
  });
  rimGeometry.translate(0, 0, -rimDepth / 2);
  const rim = new THREE.Mesh(
    rimGeometry,
    matte(PALETTE.driver, { metalness: 0.12, roughness: 0.61 }),
  );
  rim.position.z = rimPlaneZ;
  rim.userData.openLockingRim = true;
  rim.userData.role = 'raised-rim-of-driving-wheel-C';
  rotor.add(rim);

  const tappetShape = new THREE.Shape();
  tappetShape.moveTo(0.2, -tappetHalfWidth);
  tappetShape.lineTo(tappetLength, -tappetHalfWidth);
  tappetShape.quadraticCurveTo(
    tappetLength + tappetHalfWidth * 0.46,
    0,
    tappetLength - tappetHalfWidth * 0.3,
    tappetHalfWidth,
  );
  tappetShape.lineTo(0.24, tappetHalfWidth * 1.55);
  tappetShape.quadraticCurveTo(0.14, 0.04, 0.2, -tappetHalfWidth);
  tappetShape.closePath();
  const tappet = new THREE.Mesh(
    centeredExtrusion(tappetShape, tappetDepth),
    matte(PALETTE.brass, { metalness: 0.12, roughness: 0.58 }),
  );
  tappet.position.z = rimPlaneZ;
  tappet.userData.contactFaceOffset = -tappetHalfWidth;
  tappet.userData.fixedTappetB = true;
  tappet.userData.role = 'single-radial-tappet-B';
  rotor.add(tappet);

  const bridgeStart = basePlaneZ - baseDepth / 2;
  const bridgeEnd = rimPlaneZ + rimDepth / 2 + 0.06;
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.23, bridgeEnd - bridgeStart, 30),
    matte(PALETTE.ink, { metalness: 0.25, roughness: 0.47 }),
  );
  hub.rotation.x = Math.PI / 2;
  hub.position.z = (bridgeStart + bridgeEnd) / 2;
  rotor.add(hub);
  const faceRing = new THREE.Mesh(
    new THREE.TorusGeometry(baseRadius * 0.47, 0.036, 8, 52),
    matte(PALETTE.ink, { metalness: 0.14, roughness: 0.55 }),
  );
  faceRing.position.z = basePlaneZ + baseDepth / 2 + 0.022;
  rotor.add(faceRing);
  const indicatorAngle = Math.PI / 2;
  const indicator = new THREE.Mesh(
    new THREE.BoxGeometry(rimOuterRadius * 0.38, 0.052, 0.025),
    matte(PALETTE.white, { roughness: 0.48 }),
  );
  indicator.position.set(
    0,
    rimOuterRadius * 0.78,
    rimPlaneZ + rimDepth / 2 + 0.04,
  );
  indicator.rotation.z = indicatorAngle;
  indicator.userData.driverRotationIndicator = true;
  rotor.add(indicator);

  root.userData.baseDepth = baseDepth;
  root.userData.basePlaneZ = basePlaneZ;
  root.userData.baseRadius = baseRadius;
  root.userData.body = body;
  root.userData.indicator = indicator;
  root.userData.openingEndAngle = openingEndAngle;
  root.userData.openingSpan = openingEndAngle - openingStartAngle;
  root.userData.openingStartAngle = openingStartAngle;
  root.userData.rim = rim;
  root.userData.rimDepth = rimDepth;
  root.userData.rimInnerArcPoints = innerArc;
  root.userData.rimInnerRadius = rimInnerRadius;
  root.userData.rimOuterArcPoints = outerArc;
  root.userData.rimOuterRadius = rimOuterRadius;
  root.userData.rimPlaneZ = rimPlaneZ;
  root.userData.role = 'driving-wheel-C-with-open-locking-rim-and-tappet-B';
  root.userData.tappet = tappet;
  root.userData.tappetDepth = tappetDepth;
  root.userData.tappetHalfWidth = tappetHalfWidth;
  root.userData.tappetLength = tappetLength;
  return markShadows(root);
}

function makeSpringIndexedRatchet({
  boreRadius,
  depth,
  mountPhase,
  outerRadius,
  rootRadius,
  teeth,
  toothOuterStartPhase,
  toothOuterEndPhase,
  sharkFin = false,
}) {
  const root = makePlanarRotor();
  const rotor = root.userData.rotor;
  const fullTurn = Math.PI * 2;
  const toothPitch = fullTurn / teeth;
  const profilePoints = [];
  const toothFaces = [];
  const shape = new THREE.Shape();
  for (let toothIndex = 0; toothIndex < teeth; toothIndex += 1) {
    const rootAngle = mountPhase + toothIndex * toothPitch;
    const outerStartAngle = rootAngle
      + toothOuterStartPhase * toothPitch;
    const outerEndAngle = rootAngle + toothOuterEndPhase * toothPitch;
    const nextRootAngle = rootAngle + toothPitch;
    let points = [
      new THREE.Vector2(
        Math.cos(rootAngle) * rootRadius,
        Math.sin(rootAngle) * rootRadius,
      ),
      new THREE.Vector2(
        Math.cos(outerStartAngle) * outerRadius,
        Math.sin(outerStartAngle) * outerRadius,
      ),
      new THREE.Vector2(
        Math.cos(outerEndAngle) * outerRadius,
        Math.sin(outerEndAngle) * outerRadius,
      ),
    ];
    if (sharkFin) {
      const start = points[0];
      const tip = points[2];
      const middleAngle = (rootAngle + outerEndAngle) / 2;
      const control = start.clone().add(tip).multiplyScalar(0.5)
        .add(new THREE.Vector2(Math.cos(middleAngle), Math.sin(middleAngle)).multiplyScalar(0.13));
      points = Array.from({length: 25}, (_, index) => {
        const t = index / 24;
        return start.clone().multiplyScalar((1-t)**2)
          .addScaledVector(control, 2*t*(1-t)).addScaledVector(tip, t*t);
      });
    }
    for (const point of points) {
      if (profilePoints.length === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
      profilePoints.push(point);
    }
    const nextRoot = new THREE.Vector2(
      Math.cos(nextRootAngle) * rootRadius,
      Math.sin(nextRootAngle) * rootRadius,
    );
    const faceTangent = nextRoot.clone().sub(points.at(-1)).normalize();
    const outwardNormal = new THREE.Vector2(
      faceTangent.y,
      -faceTangent.x,
    );
    toothFaces.push({
      outer: points.at(-1),
      outwardNormal,
      root: nextRoot,
      tangent: faceTangent,
      toothIndex,
    });
  }
  shape.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, 0, boreRadius, 0, fullTurn, true);
  shape.holes.push(bore);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  const body = new THREE.Mesh(
    geometry,
    matte(PALETTE.driven, { metalness: 0.12, roughness: 0.63 }),
  );
  body.userData.springIndexedRatchetBody = true;
  rotor.add(body);
  const hub = new THREE.Mesh(
    makeAnnulusGeometry(boreRadius, boreRadius + 0.14, depth * 1.42),
    matte(PALETTE.ink, { metalness: 0.24, roughness: 0.48 }),
  );
  hub.userData.ratchetHub = true;
  rotor.add(hub);
  const indicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, outerRadius * 0.45, 0.024),
    matte(PALETTE.white, { roughness: 0.48 }),
  );
  indicator.position.set(0, outerRadius * 0.69, depth / 2 + 0.032);
  indicator.userData.ratchetRotationIndicator = true;
  rotor.add(indicator);

  root.userData.body = body;
  root.userData.boreRadius = boreRadius;
  root.userData.depth = depth;
  root.userData.hub = hub;
  root.userData.indicator = indicator;
  root.userData.mountPhase = mountPhase;
  root.userData.outerRadius = outerRadius;
  root.userData.profilePoints = profilePoints;
  root.userData.rootRadius = rootRadius;
  root.userData.role = 'eight-tooth-intermittent-ratchet-wheel-A';
  root.userData.teeth = teeth;
  root.userData.toothFaces = toothFaces;
  root.userData.toothOuterEndPhase = toothOuterEndPhase;
  root.userData.toothOuterStartPhase = toothOuterStartPhase;
  root.userData.toothPitch = toothPitch;
  return markShadows(root);
}

function makeInternalRatchetWheel({
  boreRadius,
  depth,
  driveFaceMountPhase,
  innerRootRadius,
  innerTipRadius,
  outerRadius,
  teeth,
  toothRampPhase,
}) {
  const root = makePlanarRotor();
  const rotor = root.userData.rotor;
  const fullTurn = Math.PI * 2;
  const toothPitch = fullTurn / teeth;
  const wheelMaterial = matte(PALETTE.driven, {
    metalness: 0.1,
    roughness: 0.65,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.18,
    roughness: 0.53,
  });

  const webDepth = depth * 0.52;
  const web = new THREE.Mesh(
    makeAnnulusGeometry(boreRadius, innerRootRadius * 0.985, webDepth),
    wheelMaterial,
  );
  web.position.z = -depth * 0.29;
  web.userData.internalRatchetWebA = true;
  rotor.add(web);
  const rim = new THREE.Mesh(
    makeAnnulusGeometry(innerRootRadius, outerRadius, depth),
    wheelMaterial,
  );
  rim.userData.internalRatchetRimA = true;
  rotor.add(rim);

  const toothFaces = [];
  const toothTriangles = [];
  const faceTicks = [];
  const toothBodies = Array.from({ length: teeth }, (_, toothIndex) => {
    const driveFaceAngle = driveFaceMountPhase + toothIndex * toothPitch;
    const rampRootAngle = driveFaceAngle + toothRampPhase * toothPitch;
    const faceRoot = new THREE.Vector2(
      Math.cos(driveFaceAngle) * innerRootRadius,
      Math.sin(driveFaceAngle) * innerRootRadius,
    );
    const faceTip = new THREE.Vector2(
      Math.cos(driveFaceAngle) * innerTipRadius,
      Math.sin(driveFaceAngle) * innerTipRadius,
    );
    const rampRoot = new THREE.Vector2(
      Math.cos(rampRootAngle) * innerRootRadius,
      Math.sin(rampRootAngle) * innerRootRadius,
    );
    const triangle = [faceRoot, faceTip, rampRoot];
    const shape = new THREE.Shape();
    shape.moveTo(faceRoot.x, faceRoot.y);
    shape.lineTo(faceTip.x, faceTip.y);
    shape.lineTo(rampRoot.x, rampRoot.y);
    shape.closePath();
    const tooth = new THREE.Mesh(
      centeredExtrusion(shape, depth),
      wheelMaterial,
    );
    tooth.userData.index = toothIndex;
    tooth.userData.inwardRatchetTooth = true;
    rotor.add(tooth);
    const faceTick = makeBeam(
      new THREE.Vector3(
        Math.cos(driveFaceAngle) * innerTipRadius,
        Math.sin(driveFaceAngle) * innerTipRadius,
        depth / 2 + 0.032,
      ),
      new THREE.Vector3(
        Math.cos(driveFaceAngle) * outerRadius * 0.985,
        Math.sin(driveFaceAngle) * outerRadius * 0.985,
        depth / 2 + 0.032,
      ),
      {
        color: PALETTE.ink,
        depth: 0.025,
        thickness: 0.034,
      },
    );
    faceTick.userData.index = toothIndex;
    faceTick.userData.internalRatchetFaceTick = true;
    rotor.add(faceTick);
    faceTicks.push(faceTick);
    toothTriangles.push(triangle);
    toothFaces.push({
      driveFaceAngle,
      faceRoot,
      faceTip,
      rampRoot,
      toothIndex,
    });
    return tooth;
  });

  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(outerRadius * 0.985, 0.035, 8, 72),
    darkMaterial,
  );
  outerRing.position.z = depth / 2 + 0.025;
  outerRing.userData.internalRatchetOuterRing = true;
  rotor.add(outerRing);
  const hub = new THREE.Mesh(
    makeAnnulusGeometry(boreRadius, boreRadius + 0.18, depth * 1.36),
    darkMaterial,
  );
  hub.userData.internalRatchetHubA = true;
  rotor.add(hub);
  const witnessAngle = -2.3;
  const indicator = makeBeam(
    new THREE.Vector3(
      Math.cos(witnessAngle) * (boreRadius + 0.24),
      Math.sin(witnessAngle) * (boreRadius + 0.24),
      depth / 2 + 0.052,
    ),
    new THREE.Vector3(
      Math.cos(witnessAngle) * innerRootRadius * 0.72,
      Math.sin(witnessAngle) * innerRootRadius * 0.72,
      depth / 2 + 0.052,
    ),
    {
      color: PALETTE.white,
      depth: 0.028,
      thickness: 0.065,
    },
  );
  indicator.userData.internalRatchetRotationIndicator = true;
  rotor.add(indicator);

  root.userData.boreRadius = boreRadius;
  root.userData.depth = depth;
  root.userData.driveFaceMountPhase = driveFaceMountPhase;
  root.userData.faceTicks = faceTicks;
  root.userData.hub = hub;
  root.userData.indicator = indicator;
  root.userData.innerRootRadius = innerRootRadius;
  root.userData.innerTipRadius = innerTipRadius;
  root.userData.outerRadius = outerRadius;
  root.userData.outerRing = outerRing;
  root.userData.rim = rim;
  root.userData.role = 'clockwise-internal-ratchet-wheel-A';
  root.userData.teeth = teeth;
  root.userData.toothBodies = toothBodies;
  root.userData.toothFaces = toothFaces;
  root.userData.toothPitch = toothPitch;
  root.userData.toothRampPhase = toothRampPhase;
  root.userData.toothTriangles = toothTriangles;
  root.userData.web = web;
  return markShadows(root);
}

function makePegRatchetWheel({
  boreRadius,
  depth,
  outerRadius,
  pinCount,
  pinLength,
  pinMountPhase,
  pinOrbitRadius,
  pinRadius,
}) {
  const root = makePlanarRotor();
  const rotor = root.userData.rotor;
  const innerRimRadius = outerRadius * 0.66;
  const rim = new THREE.Mesh(
    makeAnnulusGeometry(innerRimRadius, outerRadius, depth),
    matte(PALETTE.driven, { metalness: 0.11, roughness: 0.64 }),
  );
  rim.userData.pegRatchetRimB = true;
  rotor.add(rim);

  const hubOuterRadius = outerRadius * 0.2;
  const hub = new THREE.Mesh(
    makeAnnulusGeometry(boreRadius, hubOuterRadius, depth * 1.5),
    matte(PALETTE.ink, { metalness: 0.24, roughness: 0.48 }),
  );
  hub.userData.pegWheelHub = true;
  rotor.add(hub);

  const spokes = Array.from({ length: 4 }, (_, index) => {
    const spoke = makeBeam(
      new THREE.Vector3(hubOuterRadius * 0.78, 0, 0),
      new THREE.Vector3(innerRimRadius + 0.08, 0, 0),
      {
        color: PALETTE.driven,
        depth: depth * 0.7,
        thickness: 0.17,
      },
    );
    spoke.rotation.z = index * Math.PI / 2;
    spoke.userData.pegWheelSpoke = true;
    spoke.userData.index = index;
    rotor.add(spoke);
    return spoke;
  });

  const pinMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const pinHeadMaterial = matte(PALETTE.muted, {
    metalness: 0.19,
    roughness: 0.53,
  });
  const pinPitch = Math.PI * 2 / pinCount;
  const pinBackZ = depth / 2 - 0.03;
  const pinFrontZ = pinBackZ + pinLength;
  const pins = Array.from({ length: pinCount }, (_, index) => {
    const mountAngle = pinMountPhase + index * pinPitch;
    const pin = new THREE.Group();
    pin.position.set(
      Math.cos(mountAngle) * pinOrbitRadius,
      Math.sin(mountAngle) * pinOrbitRadius,
      0,
    );
    pin.userData.index = index;
    pin.userData.mountAngle = mountAngle;
    pin.userData.orbitRadius = pinOrbitRadius;
    pin.userData.pegRatchetPin = true;
    pin.userData.radius = pinRadius;

    const stud = new THREE.Mesh(
      new THREE.CylinderGeometry(pinRadius, pinRadius, pinLength, 24),
      pinMaterial,
    );
    stud.rotation.x = Math.PI / 2;
    stud.position.z = (pinBackZ + pinFrontZ) / 2;
    stud.userData.rimPinStud = true;
    pin.add(stud);

    const head = new THREE.Mesh(
      new THREE.TorusGeometry(pinRadius * 1.08, 0.018, 8, 24),
      index === 0
        ? matte(PALETTE.white, { roughness: 0.48 })
        : pinHeadMaterial,
    );
    head.position.z = pinFrontZ + 0.006;
    head.userData.rimPinHead = true;
    head.userData.rotationIndex = index === 0;
    pin.add(head);
    rotor.add(pin);
    return pin;
  });

  const faceRing = new THREE.Mesh(
    new THREE.TorusGeometry(innerRimRadius, 0.035, 8, 64),
    matte(PALETTE.ink, { metalness: 0.15, roughness: 0.55 }),
  );
  faceRing.position.z = depth / 2 + 0.025;
  rotor.add(faceRing);
  const indicator = new THREE.Mesh(
    new THREE.BoxGeometry(outerRadius * 0.58, 0.065, 0.028),
    matte(PALETTE.white, { roughness: 0.48 }),
  );
  indicator.position.set(outerRadius * 0.46, 0, depth / 2 + 0.045);
  indicator.userData.pegWheelRotationIndicator = true;
  rotor.add(indicator);

  root.userData.boreRadius = boreRadius;
  root.userData.depth = depth;
  root.userData.hub = hub;
  root.userData.indicator = indicator;
  root.userData.innerRimRadius = innerRimRadius;
  root.userData.outerRadius = outerRadius;
  root.userData.pinCount = pinCount;
  root.userData.pinFrontZ = pinFrontZ;
  root.userData.pinLength = pinLength;
  root.userData.pinMountPhase = pinMountPhase;
  root.userData.pinOrbitRadius = pinOrbitRadius;
  root.userData.pinPitch = pinPitch;
  root.userData.pinRadius = pinRadius;
  root.userData.pins = pins;
  root.userData.rim = rim;
  root.userData.role = 'counterclockwise-peg-ratchet-wheel-B';
  root.userData.spokes = spokes;
  return markShadows(root);
}

function makeOpenHookPawl({
  depth,
  hookArc,
  hookInnerRadius,
  hookTubeRadius,
  length,
  role,
}) {
  const root = new THREE.Group();
  const pawlMaterial = matte(PALETTE.accent, {
    metalness: 0.11,
    roughness: 0.6,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.49,
  });
  const hookMajorRadius = hookInnerRadius + hookTubeRadius;
  const body = makeBeam(
    new THREE.Vector3(0.04, 0, 0),
    new THREE.Vector3(length - hookMajorRadius * 0.72, 0, 0),
    {
      color: PALETTE.accent,
      depth,
      jointRadius: 0.001,
      thickness: 0.105,
    },
  );
  body.userData.rigidPawlBody = true;
  root.add(body);

  const hook = new THREE.Mesh(
    new THREE.TorusGeometry(
      hookMajorRadius,
      hookTubeRadius,
      10,
      40,
      hookArc,
    ),
    pawlMaterial,
  );
  hook.position.x = length;
  hook.rotation.z = Math.PI * 0.23;
  hook.userData.hookArc = hookArc;
  hook.userData.hookInnerRadius = hookInnerRadius;
  hook.userData.openRimPinHook = true;
  hook.userData.role = 'open-working-hook-for-rim-pin';
  root.add(hook);

  const pivotHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, depth * 1.9, 26),
    darkMaterial,
  );
  pivotHub.rotation.x = Math.PI / 2;
  pivotHub.userData.pawlPivotHub = true;
  root.add(pivotHub);
  const pivotRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.032, 8, 30),
    matte(PALETTE.white, { roughness: 0.49 }),
  );
  pivotRing.position.z = depth * 0.72;
  pivotRing.userData.pawlPivotIndicator = true;
  root.add(pivotRing);

  root.userData.axis = Z_AXIS.clone();
  root.userData.body = body;
  root.userData.depth = depth;
  root.userData.hook = hook;
  root.userData.hookArc = hookArc;
  root.userData.hookInnerRadius = hookInnerRadius;
  root.userData.hookMajorRadius = hookMajorRadius;
  root.userData.hookTubeRadius = hookTubeRadius;
  root.userData.length = length;
  root.userData.pivotHub = pivotHub;
  root.userData.role = role;
  root.userData.tipLocal = new THREE.Vector3(length, 0, 0);
  return markShadows(root);
}

function makePullingRatchetPawl({
  catchDepth,
  depth,
  length,
  role,
}) {
  const root = new THREE.Group();
  const pawlMaterial = matte(PALETTE.accent, {
    metalness: 0.11,
    roughness: 0.6,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.49,
  });
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-0.045, -0.085);
  bodyShape.lineTo(length - 0.22, -0.075);
  bodyShape.lineTo(length, 0);
  bodyShape.lineTo(length - 0.17, 0.115);
  bodyShape.lineTo(-0.045, 0.105);
  bodyShape.closePath();
  const body = new THREE.Mesh(
    centeredExtrusion(bodyShape, depth),
    pawlMaterial,
  );
  body.userData.pointedPullingPawlBody = true;
  root.add(body);

  const contactFinger = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.046, catchDepth, 20),
    darkMaterial,
  );
  contactFinger.rotation.x = Math.PI / 2;
  contactFinger.position.set(
    length,
    0,
    -depth / 2 - catchDepth / 2 + 0.012,
  );
  contactFinger.userData.pawlToothContactFinger = true;
  root.add(contactFinger);

  const pivotHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, depth * 1.9, 26),
    darkMaterial,
  );
  pivotHub.rotation.x = Math.PI / 2;
  pivotHub.userData.pawlPivotHub = true;
  root.add(pivotHub);
  const pivotRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.125, 0.03, 8, 30),
    matte(PALETTE.white, { roughness: 0.49 }),
  );
  pivotRing.position.z = depth * 0.72;
  pivotRing.userData.pawlPivotIndicator = true;
  root.add(pivotRing);

  const tipMarker = new THREE.Object3D();
  tipMarker.position.x = length;
  tipMarker.userData.pointedPawlTip = true;
  root.add(tipMarker);

  root.userData.axis = Z_AXIS.clone();
  root.userData.body = body;
  root.userData.catchDepth = catchDepth;
  root.userData.contactFinger = contactFinger;
  root.userData.depth = depth;
  root.userData.length = length;
  root.userData.pivotHub = pivotHub;
  root.userData.role = role;
  root.userData.tipLocal = new THREE.Vector3(length, 0, 0);
  root.userData.tipMarker = tipMarker;
  return markShadows(root);
}

function taperedLinkShape(start, startRadius, end, endRadius, holes = []) {
  const axis = end.clone().sub(start);
  const axisAngle = Math.atan2(axis.y, axis.x);
  const tangentAngle = Math.acos(
    THREE.MathUtils.clamp((startRadius - endRadius) / axis.length(), -1, 1),
  );
  const shape = new THREE.Shape();
  shape.moveTo(
    start.x + Math.cos(axisAngle + tangentAngle) * startRadius,
    start.y + Math.sin(axisAngle + tangentAngle) * startRadius,
  );
  shape.absarc(
    start.x,
    start.y,
    startRadius,
    axisAngle + tangentAngle,
    axisAngle + Math.PI * 2 - tangentAngle,
    false,
  );
  shape.lineTo(
    end.x + Math.cos(axisAngle - tangentAngle) * endRadius,
    end.y + Math.sin(axisAngle - tangentAngle) * endRadius,
  );
  shape.absarc(
    end.x,
    end.y,
    endRadius,
    axisAngle - tangentAngle,
    axisAngle + tangentAngle,
    false,
  );
  shape.closePath();
  for (const { center, radius } of holes) {
    const hole = new THREE.Path();
    hole.absarc(center.x, center.y, radius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  return shape;
}

function makeCurvedSharedPivotPawl({
  depth,
  length,
  outline,
  role,
  boreRadius = 0,
  fingerRadius = null,
  hubDepth = depth * 1.9,
  hubRadius = 0.105,
}) {
  const root = new THREE.Group();
  const pawlMaterial = matte(PALETTE.accent, {
    metalness: 0.11,
    roughness: 0.61,
  });
  // The pawl is one flat extrusion of its authored outline (local frame:
  // pivot at the origin, finger centre at (length, 0)). Its rounded nose is
  // part of that outline, so it bears on the tooth in its own plane.
  const bodyShape = new THREE.Shape(outline);
  const body = new THREE.Mesh(
    centeredExtrusion(bodyShape, depth),
    pawlMaterial,
  );
  body.userData.curvedPointedPawlBody = true;
  body.userData.outline = outline.map((point) => point.clone());
  root.add(body);

  // Marks the centre of the rounded nose that bears on the tooth.
  const contactFinger = new THREE.Object3D();
  contactFinger.position.set(length, 0, 0);
  contactFinger.userData.pawlToothContactFinger = true;
  contactFinger.userData.radius = fingerRadius;
  root.add(contactFinger);

  const pivotHub = new THREE.Mesh(
    boreRadius > 0
      ? makeAnnulusGeometry(boreRadius, hubRadius, hubDepth)
      : new THREE.CylinderGeometry(hubRadius, hubRadius, hubDepth, 26),
    pawlMaterial,
  );
  if (boreRadius === 0) pivotHub.rotation.x = Math.PI / 2;
  pivotHub.userData.pawlPivotHub = true;
  root.add(pivotHub);
  root.userData.axis = Z_AXIS.clone();
  root.userData.body = body;
  root.userData.contactFinger = contactFinger;
  root.userData.depth = depth;
  root.userData.independentAtSharedPivot = true;
  root.userData.length = length;
  root.userData.pivotHub = pivotHub;
  root.userData.role = role;
  root.userData.tipLocal = new THREE.Vector3(length, 0, 0);
  return markShadows(root);
}

function makeCounterweightedRatchetPawl({
  catchDepth,
  catchRadius,
  counterweightCenterLocal,
  depth,
  tipLength,
}) {
  const root = new THREE.Group();
  const pawlMaterial = matte(PALETTE.accent, {
    metalness: 0.1,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.2,
    roughness: 0.5,
  });

  const nose = makeBeam(
    new THREE.Vector3(0.03, 0, 0),
    new THREE.Vector3(tipLength - catchRadius * 0.45, 0, 0),
    {
      color: PALETTE.accent,
      depth,
      jointRadius: 0.001,
      thickness: 0.1,
    },
  );
  nose.userData.pawlWorkingNose = true;
  root.add(nose);

  const counterweightCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.08, 0),
    new THREE.Vector3(0.02, 0.62, 0),
    new THREE.Vector3(0.13, 1.36, 0),
    new THREE.Vector3(0.38, 2.18, 0),
    counterweightCenterLocal.clone(),
  ], false, 'centripetal');
  const counterweightArm = new THREE.Mesh(
    new THREE.TubeGeometry(counterweightCurve, 72, 0.065, 10, false),
    pawlMaterial,
  );
  counterweightArm.userData.curvedPawlCounterweightArm = true;
  root.add(counterweightArm);

  const counterweight = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, depth * 1.55, 36),
    pawlMaterial,
  );
  counterweight.rotation.x = Math.PI / 2;
  counterweight.position.copy(counterweightCenterLocal);
  counterweight.userData.counterweightB = true;
  counterweight.userData.mass = 1;
  root.add(counterweight);
  const counterweightRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.035, 8, 36),
    darkMaterial,
  );
  counterweightRing.position.copy(counterweightCenterLocal);
  counterweightRing.position.z = depth * 0.84;
  counterweightRing.userData.counterweightRing = true;
  root.add(counterweightRing);

  const catchPad = new THREE.Mesh(
    new THREE.CylinderGeometry(catchRadius, catchRadius, catchDepth, 28),
    darkMaterial,
  );
  catchPad.rotation.x = Math.PI / 2;
  catchPad.position.set(tipLength, 0, -catchDepth * 0.37);
  catchPad.userData.finiteRadiusPawlCatch = true;
  catchPad.userData.radius = catchRadius;
  catchPad.userData.role = 'working-catch-of-pawl-B';
  root.add(catchPad);

  const pivotHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, depth * 1.8, 28),
    darkMaterial,
  );
  pivotHub.rotation.x = Math.PI / 2;
  pivotHub.position.z = -depth * 0.18;
  pivotHub.userData.pawlPivotHub = true;
  root.add(pivotHub);
  const pivotRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.035, 8, 32),
    darkMaterial,
  );
  pivotRing.position.z = depth * 0.72;
  root.add(pivotRing);

  root.userData.axis = Z_AXIS.clone();
  root.userData.catchDepth = catchDepth;
  root.userData.catchPad = catchPad;
  root.userData.catchRadius = catchRadius;
  root.userData.counterweight = counterweight;
  root.userData.counterweightArm = counterweightArm;
  root.userData.counterweightCenterLocal = counterweightCenterLocal.clone();
  root.userData.depth = depth;
  root.userData.nose = nose;
  root.userData.pivotHub = pivotHub;
  root.userData.role = 'pivoted-counterweighted-pawl-B';
  root.userData.tipLength = tipLength;
  root.userData.tipLocal = new THREE.Vector3(tipLength, 0, 0);
  return markShadows(root);
}

function makeJointedTappetPawl({
  catchDepth,
  catchRadius,
  depth,
  length,
}) {
  const root = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-0.04, 0.075);
  shape.lineTo(length * 0.72, 0.075);
  shape.lineTo(length - catchRadius * 0.6, catchRadius * 0.72);
  shape.lineTo(length, 0);
  shape.lineTo(length - catchRadius * 0.6, -catchRadius * 0.72);
  shape.lineTo(length * 0.72, -0.075);
  shape.lineTo(-0.04, -0.075);
  shape.closePath();
  const body = new THREE.Mesh(
    centeredExtrusion(shape, depth),
    matte(PALETTE.accent, { metalness: 0.1, roughness: 0.62 }),
  );
  body.userData.jointedTappetPawlBody = true;
  root.add(body);

  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.2,
    roughness: 0.5,
  });
  const catchPad = new THREE.Mesh(
    new THREE.CylinderGeometry(catchRadius, catchRadius, catchDepth, 28),
    darkMaterial,
  );
  catchPad.rotation.x = Math.PI / 2;
  catchPad.position.set(length, 0, -catchDepth * 0.42);
  catchPad.userData.finiteRadiusJointedCatch = true;
  catchPad.userData.radius = catchRadius;
  catchPad.userData.role = 'jointed-working-end-of-tappet-B';
  root.add(catchPad);

  const pivotHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, depth * 1.9, 28),
    darkMaterial,
  );
  pivotHub.rotation.x = Math.PI / 2;
  pivotHub.position.z = -depth * 0.12;
  pivotHub.userData.jointedPawlPivot = true;
  root.add(pivotHub);
  const pivotRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.125, 0.03, 8, 32),
    matte(PALETTE.white, { roughness: 0.5 }),
  );
  pivotRing.position.z = depth * 0.72;
  pivotRing.userData.jointedPawlIndicator = true;
  root.add(pivotRing);

  root.userData.axis = Z_AXIS.clone();
  root.userData.body = body;
  root.userData.catchDepth = catchDepth;
  root.userData.catchPad = catchPad;
  root.userData.catchRadius = catchRadius;
  root.userData.depth = depth;
  root.userData.length = length;
  root.userData.pivotHub = pivotHub;
  root.userData.role = 'hinged-ratchet-end-of-tappet-B';
  root.userData.tipLocal = new THREE.Vector3(length, 0, 0);
  return markShadows(root);
}

// A flat leaf of rectangular section swept along a planar curve: its face is
// in the curve's plane, so a face-on view shows Brown's double-lined band
// rather than a round wire. `halfWidthAt(u)` gives the in-plane half width
// along the curve; the axial half depth is fixed.
function makeFlatBandGeometry(curve, segments, halfWidthAt, halfDepth, endTrim = 0, zRangeAt = null) {
  const rings = segments + 1;
  const vertexCount = rings * 8 + 8;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const indices = [];
  // Sides: 0 outer (+n), 1 back (-z), 2 inner (-n), 3 front (+z); two
  // vertices per side per ring so the faces shade flat.
  for (let ring = 0; ring < segments; ring += 1) {
    for (let side = 0; side < 4; side += 1) {
      const a = ring * 8 + side * 2;
      const b = a + 1;
      const c = a + 8;
      const d = b + 8;
      indices.push(a, c, b, b, c, d);
    }
  }
  const capStart = rings * 8;
  indices.push(capStart, capStart + 1, capStart + 2, capStart, capStart + 2, capStart + 3);
  indices.push(capStart + 4, capStart + 6, capStart + 5, capStart + 4, capStart + 7, capStart + 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  const fill = (source) => {
    const point = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const set = (index, x, y, z, nx, ny, nz) => {
      positions.set([x, y, z], index * 3);
      normals.set([nx, ny, nz], index * 3);
    };
    // An end trim stops the leaf where it meets a round tip pad instead of
    // running into the pad's centre.
    const endFraction = endTrim > 0
      ? Math.max(0.5, 1 - endTrim / source.getLength())
      : 1;
    for (let ring = 0; ring < rings; ring += 1) {
      const u = ring / segments * endFraction;
      source.getPointAt(u, point);
      source.getTangentAt(u, tangent);
      const length = Math.hypot(tangent.x, tangent.y) || 1;
      const nx = -tangent.y / length;
      const ny = tangent.x / length;
      const w = halfWidthAt(u);
      // zRangeAt gives the band's [back, front] offsets from the curve at
      // u (a leaf whose depth changes along it); otherwise ±halfDepth.
      const [back, front] = zRangeAt ? zRangeAt(u) : [-halfDepth, halfDepth];
      const corners = [
        [w, front], [w, back], [w, back], [-w, back],
        [-w, back], [-w, front], [-w, front], [w, front],
      ];
      const sideNormals = [[nx, ny, 0], [0, 0, -1], [-nx, -ny, 0], [0, 0, 1]];
      for (let corner = 0; corner < 8; corner += 1) {
        const [offset, z] = corners[corner];
        const normal = sideNormals[corner >> 1];
        set(
          ring * 8 + corner,
          point.x + nx * offset,
          point.y + ny * offset,
          point.z + z,
          ...normal,
        );
      }
      if (ring === 0 || ring === segments) {
        const cap = ring === 0 ? capStart : capStart + 4;
        const sign = ring === 0 ? -1 : 1;
        const tx = (tangent.x / length) * sign;
        const ty = (tangent.y / length) * sign;
        [[w, front], [w, back], [-w, back], [-w, front]]
          .forEach(([offset, z], corner) => set(
            cap + corner,
            point.x + nx * offset,
            point.y + ny * offset,
            point.z + z,
            tx,
            ty,
            0,
          ));
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  };
  fill(curve);
  geometry.userData.refill = fill;
  return geometry;
}

// A clamped leaf bent by a load at its free end: the relaxed centreline plus
// the small-deflection cantilever shape (3x^2 - x^3) / 2 along its length.
// The leaf leaves its clamp tangentially, bends most near the clamp and
// carries its tip to the required point with no kink or S-bend.
class CantileverLeafCurve extends THREE.Curve {
  constructor(relaxedPoints, tipDisplacement) {
    super();
    this.relaxedPoints = relaxedPoints;
    this.tipDisplacement = tipDisplacement.clone();
  }

  getPoint(t, target = new THREE.Vector3()) {
    const u = THREE.MathUtils.clamp(t, 0, 1);
    const last = this.relaxedPoints.length - 1;
    const scaled = u * last;
    const index = Math.min(Math.floor(scaled), last - 1);
    target.lerpVectors(
      this.relaxedPoints[index],
      this.relaxedPoints[index + 1],
      scaled - index,
    );
    return target.addScaledVector(this.tipDisplacement, u * u * (3 - u) / 2);
  }
}

function cantileverLeafCurve(relaxedPoints, tip) {
  return new CantileverLeafCurve(
    relaxedPoints,
    new THREE.Vector3(
      tip.x - relaxedPoints.at(-1).x,
      tip.y - relaxedPoints.at(-1).y,
      0,
    ),
  );
}

// First crossing of two planar leaves seen along z, refined on the curves.
function planarLeafCrossing(first, second, samples = 96) {
  const a = first.getPoints(samples);
  const b = second.getPoints(samples);
  for (let i = 0; i < samples; i += 1) {
    for (let j = 0; j < samples; j += 1) {
      const p = a[i];
      const r = a[i + 1].clone().sub(p);
      const q = b[j];
      const s = b[j + 1].clone().sub(q);
      const denominator = r.x * s.y - r.y * s.x;
      if (Math.abs(denominator) < 1e-14) continue;
      const qp = q.clone().sub(p);
      const t = (qp.x * s.y - qp.y * s.x) / denominator;
      const v = (qp.x * r.y - qp.y * r.x) / denominator;
      if (t < 0 || t > 1 || v < 0 || v > 1) continue;
      let firstFraction = (i + t) / samples;
      let secondFraction = (j + v) / samples;
      const step = 1e-7;
      for (let iteration = 0; iteration < 12; iteration += 1) {
        const f = first.getPoint(firstFraction);
        const g = second.getPoint(secondFraction);
        const ex = f.x - g.x;
        const ey = f.y - g.y;
        if (Math.hypot(ex, ey) < 1e-15) break;
        const df = first.getPoint(Math.min(1, firstFraction + step)).sub(f)
          .divideScalar(step);
        const dg = second.getPoint(Math.min(1, secondFraction + step)).sub(g)
          .divideScalar(step);
        const determinant = -df.x * dg.y + dg.x * df.y;
        if (Math.abs(determinant) < 1e-14) break;
        firstFraction -= (-ex * dg.y + dg.x * ey) / determinant;
        secondFraction -= (df.x * ey - df.y * ex) / determinant;
        firstFraction = THREE.MathUtils.clamp(firstFraction, 0, 1);
        secondFraction = THREE.MathUtils.clamp(secondFraction, 0, 1);
      }
      const firstPoint = first.getPoint(firstFraction);
      const secondPoint = second.getPoint(secondFraction);
      return {
        distance: firstPoint.distanceTo(secondPoint),
        firstFraction,
        firstPoint,
        secondFraction,
        secondPoint,
      };
    }
  }
  return null;
}

function makeDynamicLeafSpring(initialCurve, {
  color,
  planeZ,
  radius,
  tubularSegments = 72,
  band = null,
}) {
  if (band) {
    const root = new THREE.Group();
    const halfWidthAt = band.halfWidthAt ?? (() => radius);
    const mesh = new THREE.Mesh(
      makeFlatBandGeometry(
        initialCurve,
        tubularSegments,
        halfWidthAt,
        radius,
        band.endTrim ?? 0,
        band.zRangeAt ?? null,
      ),
      matte(color, { metalness: 0.1, roughness: 0.58 }),
    );
    mesh.userData.flexibleLeafSpring = true;
    mesh.userData.flatBandSection = true;
    root.add(mesh);
    root.userData.curve = initialCurve;
    root.userData.mesh = mesh;
    root.userData.planeZ = planeZ;
    root.userData.radius = radius;
    root.userData.setCurve = (curve) => {
      mesh.geometry.userData.refill(curve);
      root.userData.curve = curve;
    };
    return markShadows(root);
  }
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(
      initialCurve,
      tubularSegments,
      radius,
      9,
      false,
    ),
    matte(color, { metalness: 0.1, roughness: 0.58 }),
  );
  mesh.userData.flexibleLeafSpring = true;
  root.add(mesh);
  root.userData.curve = initialCurve;
  root.userData.mesh = mesh;
  root.userData.planeZ = planeZ;
  root.userData.radius = radius;
  root.userData.setCurve = (curve) => {
    const replacement = new THREE.TubeGeometry(
      curve,
      tubularSegments,
      radius,
      9,
      false,
    );
    const current = mesh.geometry;
    const canReuse = current.attributes.position?.count
      === replacement.attributes.position?.count;
    if (canReuse) {
      for (const name of ['position', 'normal']) {
        current.attributes[name].array.set(replacement.attributes[name].array);
        current.attributes[name].needsUpdate = true;
      }
      current.computeBoundingBox();
      current.computeBoundingSphere();
      replacement.dispose();
    } else {
      mesh.geometry = replacement;
      current.dispose();
    }
    root.userData.curve = curve;
  };
  return markShadows(root);
}





function makeSingleToothLockingDriver({
  bodyFlag = 'singleToothDriverBody',
  depth,
  lockRadius,
  reliefHalfAngle,
  reliefRadius,
  role = 'self-locking-wheel-B-with-single-tooth-A',
  tipFlag = 'toothTipA',
  toothFlag = 'drivingToothA',
  toothOrbitRadius,
  toothRole = 'single-projecting-driving-tooth-A',
  toothShankHalfWidth = 0.008,
  toothTipRadius,
}) {
  const root = makePlanarRotor();
  const rotor = root.userData.rotor;
  const radiusAt = (angle) => {
    const signed = Math.atan2(Math.sin(angle), Math.cos(angle));
    const magnitude = Math.abs(signed);
    if (magnitude >= reliefHalfAngle) return lockRadius;
    const reliefFraction = smoothStep01(1 - magnitude / reliefHalfAngle);
    return lockRadius - (lockRadius - reliefRadius) * reliefFraction;
  };
  const profileSamples = 256;
  const profilePoints = Array.from({ length: profileSamples }, (_, index) => {
    const angle = index / profileSamples * Math.PI * 2;
    const radius = radiusAt(angle);
    return new THREE.Vector2(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    );
  });
  const bodyShape = new THREE.Shape();
  for (const [index, point] of profilePoints.entries()) {
    if (index === 0) bodyShape.moveTo(point.x, point.y);
    else bodyShape.lineTo(point.x, point.y);
  }
  bodyShape.closePath();
  const bodyGeometry = new THREE.ExtrudeGeometry(bodyShape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth,
  });
  bodyGeometry.translate(0, 0, -depth / 2);
  const body = new THREE.Mesh(
    bodyGeometry,
    matte(PALETTE.driver, { metalness: 0.1, roughness: 0.66 }),
  );
  body.userData[bodyFlag] = true;
  rotor.add(body);

  const toothHalfWidth = toothTipRadius;
  const toothShape = new THREE.Shape();
  toothShape.moveTo(reliefRadius - 0.025, -toothShankHalfWidth);
  toothShape.lineTo(lockRadius - 0.05, -toothShankHalfWidth);
  toothShape.lineTo(toothOrbitRadius - toothTipRadius, 0);
  toothShape.lineTo(lockRadius - 0.05, toothShankHalfWidth);
  toothShape.lineTo(reliefRadius - 0.025, toothShankHalfWidth);
  toothShape.closePath();
  const toothGeometry = new THREE.ExtrudeGeometry(toothShape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth: depth * 1.04,
  });
  toothGeometry.translate(0, 0, -depth * 1.04 / 2);
  const tooth = new THREE.Mesh(
    toothGeometry,
    matte(PALETTE.brass, { metalness: 0.12, roughness: 0.58 }),
  );
  tooth.userData[toothFlag] = true;
  tooth.userData.mountAngle = 0;
  tooth.userData.role = toothRole;
  tooth.userData.tipLocal = new THREE.Vector3(toothOrbitRadius, 0, 0);
  rotor.add(tooth);
  const toothTip = new THREE.Mesh(
    new THREE.CylinderGeometry(
      toothTipRadius,
      toothTipRadius,
      depth * 1.04,
      28,
    ),
    tooth.material,
  );
  toothTip.rotation.x = Math.PI / 2;
  toothTip.position.x = toothOrbitRadius;
  toothTip.userData.radius = toothTipRadius;
  toothTip.userData.role = 'rounded-working-head-of-tooth-A';
  toothTip.userData[tipFlag] = true;
  rotor.add(toothTip);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, depth * 1.42, 30),
    matte(PALETTE.ink, { metalness: 0.24, roughness: 0.48 }),
  );
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);
  const faceRing = new THREE.Mesh(
    new THREE.TorusGeometry(lockRadius * 0.42, 0.035, 8, 48),
    matte(PALETTE.ink, { metalness: 0.14, roughness: 0.55 }),
  );
  faceRing.position.z = depth / 2 + 0.022;
  rotor.add(faceRing);
  const indicatorAngle = Math.PI * 0.72;
  const indicator = new THREE.Mesh(
    new THREE.BoxGeometry(lockRadius * 0.31, 0.052, 0.025),
    matte(PALETTE.white, { roughness: 0.48 }),
  );
  indicator.position.set(
    Math.cos(indicatorAngle) * lockRadius * 0.78,
    Math.sin(indicatorAngle) * lockRadius * 0.78,
    depth / 2 + 0.04,
  );
  indicator.rotation.z = indicatorAngle;
  indicator.userData.driverRotationIndicator = true;
  rotor.add(indicator);

  root.userData.body = body;
  root.userData.depth = depth;
  root.userData.indicator = indicator;
  root.userData.lockRadius = lockRadius;
  root.userData.profilePoints = profilePoints;
  root.userData.profileSamples = profileSamples;
  root.userData.radiusAt = radiusAt;
  root.userData.reliefHalfAngle = reliefHalfAngle;
  root.userData.reliefRadius = reliefRadius;
  root.userData.role = role;
  root.userData.tooth = tooth;
  root.userData.toothHalfWidth = toothHalfWidth;
  root.userData.toothOrbitRadius = toothOrbitRadius;
  root.userData.toothShankHalfWidth = toothShankHalfWidth;
  root.userData.toothTip = toothTip;
  root.userData.toothTipRadius = toothTipRadius;
  return markShadows(root);
}

function makeEightNotchLockWheel({
  centerDistance,
  depth,
  driverFitRadius,
  notchCount,
  notchMountPhase,
  notchRootRadius,
  outerRadius,
  slotHalfWidth,
}) {
  const root = makePlanarRotor();
  const rotor = root.userData.rotor;
  const notchPitch = Math.PI * 2 / notchCount;
  const hollowMountPhase = notchMountPhase + notchPitch / 2;
  const notchMouthCenterRadius = Math.sqrt(
    outerRadius ** 2 - slotHalfWidth ** 2,
  );
  const notchMouthHalfAngle = Math.atan2(
    slotHalfWidth,
    notchMouthCenterRadius,
  );
  const hollowHalfWidth = Math.acos(
    (outerRadius ** 2 + centerDistance ** 2 - driverFitRadius ** 2)
      / (2 * centerDistance * outerRadius),
  );
  const hollowRadiusAtDelta = (hollowDelta) => {
    if (Math.abs(hollowDelta) > hollowHalfWidth) return outerRadius;
    const radicand = driverFitRadius ** 2
      - centerDistance ** 2 * Math.sin(hollowDelta) ** 2;
    return Math.min(
      outerRadius,
      centerDistance * Math.cos(hollowDelta) - Math.sqrt(Math.max(0, radicand)),
    );
  };

  const profilePoints = [];
  const bottomArcSamples = 14;
  const outerArcSamples = 38;
  for (let index = 0; index < notchCount; index += 1) {
    const notchAngle = notchMountPhase + index * notchPitch;
    const direction = new THREE.Vector2(
      Math.cos(notchAngle),
      Math.sin(notchAngle),
    );
    const normal = new THREE.Vector2(-direction.y, direction.x);
    const lowerMouth = direction.clone()
      .multiplyScalar(notchMouthCenterRadius)
      .addScaledVector(normal, -slotHalfWidth);
    const lowerRoot = direction.clone()
      .multiplyScalar(notchRootRadius)
      .addScaledVector(normal, -slotHalfWidth);
    if (index === 0) profilePoints.push(lowerMouth);
    profilePoints.push(lowerRoot);
    for (let sample = 1; sample <= bottomArcSamples; sample += 1) {
      const arcAngle = -Math.PI / 2 - sample / bottomArcSamples * Math.PI;
      profilePoints.push(
        direction.clone().multiplyScalar(notchRootRadius)
          .addScaledVector(direction, Math.cos(arcAngle) * slotHalfWidth)
          .addScaledVector(normal, Math.sin(arcAngle) * slotHalfWidth),
      );
    }
    const upperMouth = direction.clone()
      .multiplyScalar(notchMouthCenterRadius)
      .addScaledVector(normal, slotHalfWidth);
    profilePoints.push(upperMouth);
    const outerStartAngle = notchAngle + notchMouthHalfAngle;
    const outerEndAngle = notchAngle + notchPitch - notchMouthHalfAngle;
    const hollowCenterAngle = notchAngle + notchPitch / 2;
    for (let sample = 1; sample <= outerArcSamples; sample += 1) {
      const angle = THREE.MathUtils.lerp(
        outerStartAngle,
        outerEndAngle,
        sample / outerArcSamples,
      );
      const radius = hollowRadiusAtDelta(angle - hollowCenterAngle);
      profilePoints.push(new THREE.Vector2(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      ));
    }
  }
  const profileSamples = profilePoints.length;
  const shape = new THREE.Shape();
  for (const [index, point] of profilePoints.entries()) {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  }
  shape.closePath();
  const bodyGeometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth,
  });
  bodyGeometry.translate(0, 0, -depth / 2);
  const body = new THREE.Mesh(
    bodyGeometry,
    matte(PALETTE.driven, { metalness: 0.1, roughness: 0.66 }),
  );
  body.userData.eightNotchLockWheelBody = true;
  body.userData.role = 'eight-notch-intermittent-wheel-C';
  rotor.add(body);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.23, 0.23, depth * 1.42, 30),
    matte(PALETTE.ink, { metalness: 0.24, roughness: 0.48 }),
  );
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);
  const faceRing = new THREE.Mesh(
    new THREE.TorusGeometry(outerRadius * 0.37, 0.036, 8, 48),
    matte(PALETTE.ink, { metalness: 0.14, roughness: 0.55 }),
  );
  faceRing.position.z = depth / 2 + 0.022;
  rotor.add(faceRing);
  const indicatorAngle = Math.PI / 2;
  const indicator = new THREE.Mesh(
    new THREE.BoxGeometry(outerRadius * 0.28, 0.054, 0.025),
    matte(PALETTE.white, { roughness: 0.48 }),
  );
  indicator.position.set(
    Math.cos(indicatorAngle) * outerRadius * 0.68,
    Math.sin(indicatorAngle) * outerRadius * 0.68,
    depth / 2 + 0.04,
  );
  indicator.rotation.z = indicatorAngle;
  indicator.userData.drivenRotationIndicator = true;
  rotor.add(indicator);

  const hollowAngles = Array.from(
    { length: notchCount },
    (_, index) => hollowMountPhase + index * notchPitch,
  );
  const notchAngles = Array.from(
    { length: notchCount },
    (_, index) => notchMountPhase + index * notchPitch,
  );
  root.userData.body = body;
  root.userData.depth = depth;
  root.userData.driverFitRadius = driverFitRadius;
  root.userData.hollowAngles = hollowAngles;
  root.userData.hollowHalfWidth = hollowHalfWidth;
  root.userData.hollowMountPhase = hollowMountPhase;
  root.userData.hollowRadiusAtDelta = hollowRadiusAtDelta;
  root.userData.indicator = indicator;
  root.userData.notchAngles = notchAngles;
  root.userData.notchBottomArcSamples = bottomArcSamples;
  root.userData.notchCount = notchCount;
  root.userData.notchMouthCenterRadius = notchMouthCenterRadius;
  root.userData.notchMouthHalfAngle = notchMouthHalfAngle;
  root.userData.notchMountPhase = notchMountPhase;
  root.userData.notchPitch = notchPitch;
  root.userData.notchRootRadius = notchRootRadius;
  root.userData.outerRadius = outerRadius;
  root.userData.outerArcSamples = outerArcSamples;
  root.userData.profilePoints = profilePoints;
  root.userData.profileSamples = profileSamples;
  root.userData.role = 'eight-notch-wheel-with-concave-self-locking-hollows';
  root.userData.slotHalfWidth = slotHalfWidth;
  return markShadows(root);
}

function makeScallopedStopWheel({
  centerDistance,
  depth,
  gapCount,
  gapMountPhase,
  lockFitRadius,
  slotHalfWidth,
  slotMouthCenterRadius,
  slotRootCenterRadius,
}) {
  const root = makePlanarRotor();
  const rotor = root.userData.rotor;
  const gapPitch = Math.PI * 2 / gapCount;
  const halfGapPitch = gapPitch / 2;
  const slotMouthHalfAngle = Math.atan2(
    slotHalfWidth,
    slotMouthCenterRadius,
  );
  const lockRadiusAtDelta = (delta) => {
    const radicand = lockFitRadius ** 2
      - centerDistance ** 2 * Math.sin(delta) ** 2;
    if (radicand < -1e-12) {
      throw new RangeError('The locking pocket cannot span one tooth pitch.');
    }
    return centerDistance * Math.cos(delta)
      - Math.sqrt(Math.max(0, radicand));
  };
  const toothOuterRadius = lockRadiusAtDelta(halfGapPitch);
  const hollowRootRadius = centerDistance - lockFitRadius;
  const gapAngles = Array.from(
    { length: gapCount },
    (_, index) => gapMountPhase + index * gapPitch,
  );
  const toothTipAngles = gapAngles.map((angle) => angle + halfGapPitch);
  const profilePoints = [];
  const lockArcSamples = 18;
  const bottomArcSamples = 12;
  for (const gapAngle of gapAngles) {
    const direction = new THREE.Vector2(
      Math.cos(gapAngle),
      Math.sin(gapAngle),
    );
    const normal = new THREE.Vector2(-direction.y, direction.x);
    for (let sample = 0; sample <= lockArcSamples; sample += 1) {
      const delta = THREE.MathUtils.lerp(
        -halfGapPitch,
        -slotMouthHalfAngle,
        sample / lockArcSamples,
      );
      const angle = gapAngle + delta;
      const radius = lockRadiusAtDelta(delta);
      profilePoints.push(new THREE.Vector2(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      ));
    }
    const lowerMouth = direction.clone()
      .multiplyScalar(slotMouthCenterRadius)
      .addScaledVector(normal, -slotHalfWidth);
    const lowerRoot = direction.clone()
      .multiplyScalar(slotRootCenterRadius)
      .addScaledVector(normal, -slotHalfWidth);
    profilePoints.push(lowerMouth, lowerRoot);
    for (let sample = 1; sample <= bottomArcSamples; sample += 1) {
      const arcAngle = -Math.PI / 2 - sample / bottomArcSamples * Math.PI;
      profilePoints.push(
        direction.clone().multiplyScalar(slotRootCenterRadius)
          .addScaledVector(direction, Math.cos(arcAngle) * slotHalfWidth)
          .addScaledVector(normal, Math.sin(arcAngle) * slotHalfWidth),
      );
    }
    const upperMouth = direction.clone()
      .multiplyScalar(slotMouthCenterRadius)
      .addScaledVector(normal, slotHalfWidth);
    profilePoints.push(upperMouth);
    for (let sample = 1; sample <= lockArcSamples; sample += 1) {
      const delta = THREE.MathUtils.lerp(
        slotMouthHalfAngle,
        halfGapPitch,
        sample / lockArcSamples,
      );
      const angle = gapAngle + delta;
      const radius = lockRadiusAtDelta(delta);
      profilePoints.push(new THREE.Vector2(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      ));
    }
  }

  const shape = new THREE.Shape();
  for (const [index, point] of profilePoints.entries()) {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  }
  shape.closePath();
  const bodyGeometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth,
  });
  bodyGeometry.translate(0, 0, -depth / 2);
  const body = new THREE.Mesh(
    bodyGeometry,
    matte(PALETTE.driven, { metalness: 0.1, roughness: 0.66 }),
  );
  body.userData.twentyFourToothStopWheelBody = true;
  body.userData.role = 'twenty-four-tooth-intermittent-wheel-A';
  rotor.add(body);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, depth * 1.42, 32),
    matte(PALETTE.ink, { metalness: 0.24, roughness: 0.48 }),
  );
  hub.rotation.x = Math.PI / 2;
  rotor.add(hub);
  const faceRing = new THREE.Mesh(
    new THREE.TorusGeometry(toothOuterRadius * 0.24, 0.04, 8, 56),
    matte(PALETTE.ink, { metalness: 0.14, roughness: 0.55 }),
  );
  faceRing.position.z = depth / 2 + 0.022;
  rotor.add(faceRing);
  const indicatorAngle = Math.PI * 1.16;
  const indicator = new THREE.Mesh(
    new THREE.BoxGeometry(toothOuterRadius * 0.33, 0.055, 0.025),
    matte(PALETTE.white, { roughness: 0.48 }),
  );
  indicator.position.set(
    Math.cos(indicatorAngle) * toothOuterRadius * 0.63,
    Math.sin(indicatorAngle) * toothOuterRadius * 0.63,
    depth / 2 + 0.04,
  );
  indicator.rotation.z = indicatorAngle;
  indicator.userData.drivenRotationIndicator = true;
  rotor.add(indicator);

  root.userData.body = body;
  root.userData.depth = depth;
  root.userData.gapAngles = gapAngles;
  root.userData.gapCount = gapCount;
  root.userData.gapMountPhase = gapMountPhase;
  root.userData.gapPitch = gapPitch;
  root.userData.halfGapPitch = halfGapPitch;
  root.userData.hollowRootRadius = hollowRootRadius;
  root.userData.indicator = indicator;
  root.userData.lockArcSamples = lockArcSamples;
  root.userData.lockFitRadius = lockFitRadius;
  root.userData.lockRadiusAtDelta = lockRadiusAtDelta;
  root.userData.outerRadius = toothOuterRadius;
  root.userData.profilePoints = profilePoints;
  root.userData.profileSamples = profilePoints.length;
  root.userData.role = 'scalloped-twenty-four-tooth-wheel-A';
  root.userData.slotBottomArcSamples = bottomArcSamples;
  root.userData.slotHalfWidth = slotHalfWidth;
  root.userData.slotMouthCenterRadius = slotMouthCenterRadius;
  root.userData.slotMouthHalfAngle = slotMouthHalfAngle;
  root.userData.slotRootCenterRadius = slotRootCenterRadius;
  root.userData.toothTipAngles = toothTipAngles;
  return markShadows(root);
}

function segmentEase(value, start, end) {
  if (value <= start) return { derivative: 0, value: 0 };
  if (value >= end) return { derivative: 0, value: 1 };
  const normalized = (value - start) / (end - start);
  return {
    derivative: 6 * normalized * (1 - normalized) / (end - start),
    value: smoothStep01(normalized),
  };
}

function snapActionStarCounter() {
  const root = new THREE.Group();
  const mechanism = makeSnapCounterMechanism();
  const L = mechanism.layout;
  const k = SNAP_COUNTER_SCALE;
  const fullTurn = Math.PI * 2;
  const { pinPitch, starPitch } = mechanism;
  // Brown's source pixels (y up) to plate units, keeping the star where the
  // earlier model had it.
  const origin = new THREE.Vector2(-0.8, -0.65);
  const toWorld = ([x, y]) => new THREE.Vector2(
    (x - L.starCenter[0]) * k + origin.x,
    (y - L.starCenter[1]) * k + origin.y,
  );
  const localRing = (ring, [ox, oy]) => ring.map(([x, y]) => [(x - ox) * k, (y - oy) * k]);
  const ringShape = (ring, holes = []) => {
    const shape = new THREE.Shape(ring.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
    return shape;
  };
  const slab = (shape, back, front, material) => {
    const mesh = new THREE.Mesh(flatCenteredExtrusion([shape], front - back), material);
    mesh.position.z = (back + front) / 2;
    return mesh;
  };
  const cylinder = (radius, back, front, material, segments = 32) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, front - back, segments), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = (back + front) / 2;
    return mesh;
  };
  const inkMaterial = matte(PALETTE.ink, { metalness: 0.24, roughness: 0.48 });

  // Depth layers, back to front: the pin disk, the drop (a thick plate
  // whose leg the pins' front ends strike), then the pawl flush with the
  // star it works. The pins end short of the pawl and star, so they touch
  // only the drop's leg.
  const z = {
    diskBack: -0.62,
    diskFront: -0.38,
    dropBack: -0.33,
    dropFront: -0.15,
    pinBack: -0.5,
    pinFront: -0.13,
    pawlBack: -0.09,
    pawlFront: 0.15,
    screwHeadFront: 0.18,
    starBack: -0.09,
    starFront: 0.15,
  };

  // Star: ten points on Brown's hatched shaft.
  const star = makePlanarRotor();
  star.position.set(...toWorld(L.starCenter).toArray(), 0);
  const starBody = slab(
    ringShape(localRing(starOutline(), [0, 0])),
    z.starBack,
    z.starFront,
    matte(PALETTE.driven, { metalness: 0.1, roughness: 0.66 }),
  );
  starBody.userData.starWheelBody = true;
  const starShaft = cylinder(0.24, z.diskBack - 0.1, z.starFront + 0.04, inkMaterial);
  starShaft.userData.role = 'intermittent-output-shaft';
  star.userData.rotor.add(starBody, starShaft);
  star.userData.role = 'ten-point-intermittent-counter-star';
  star.userData.body = starBody;

  // Pin disk behind the star, turning clockwise.
  const driver = makePlanarRotor();
  driver.position.set(...toWorld(L.driverCenter).toArray(), 0);
  const driverBody = cylinder(
    L.driverRadius * k,
    z.diskBack,
    z.diskFront,
    matte(PALETTE.driver, { metalness: 0.1, roughness: 0.65 }),
    72,
  );
  driverBody.userData.driverDisk = true;
  const driverShaft = cylinder(0.28, z.diskBack - 0.1, z.diskFront + 0.02, inkMaterial);
  driverShaft.userData.role = 'continuous-input-shaft';
  driver.userData.rotor.add(driverBody, driverShaft);
  const pinMaterial = matte(PALETTE.brass, { metalness: 0.18, roughness: 0.52 });
  const pins = Array.from({ length: L.pinCount }, (_, index) => {
    const angle = -mechanism.pinPhase - index * pinPitch;
    const pin = cylinder(L.pinRadius * k, z.pinBack, z.pinFront, pinMaterial, 24);
    pin.position.x = Math.cos(angle) * L.pinOrbitRadius * k;
    pin.position.y = Math.sin(angle) * L.pinOrbitRadius * k;
    pin.userData.driverPin = true;
    pin.userData.index = index;
    driver.userData.rotor.add(pin);
    return pin;
  });
  driver.userData.role = 'continuous-three-pin-driving-disk';
  driver.userData.pins = pins;

  // The drop swings on its spring about the spring's virtual hinge.
  const hinge = L.dropHinge;
  const drop = makePlanarRotor();
  drop.position.set(...toWorld(hinge).toArray(), 0);
  const dropMaterial = matte(PALETTE.brass, { metalness: 0.1, roughness: 0.65 });
  // The drop is one whole solid plate: its tail over the spring, the boss
  // behind the pawl's ring, the arch over the star and Brown's broad pointed
  // leg, which runs behind the pawl's lobe and in front of the pin disk,
  // where the pins' front ends strike it.
  const dropBody = slab(
    ringShape(localRing(mechanism.dropOutline, hinge)),
    z.dropBack,
    z.dropFront,
    dropMaterial,
  );
  dropBody.userData.springDropBody = true;
  const [strikerX, strikerY] = localRing([mechanism.striker], hinge)[0];
  // Brown draws the striker as an open circle; it is a plain steel stud
  // riveted through the drop.
  const openPinMaterial = matte('#c3c7c1', { metalness: 0.2, roughness: 0.5 });
  const striker = cylinder(L.strikerRadius * k, z.dropBack + 0.01, z.pawlFront + 0.012, openPinMaterial, 24);
  striker.position.x = strikerX;
  striker.position.y = strikerY;
  striker.userData.dropStrikerStud = true;
  const [pivotX, pivotY] = localRing([L.pawlPivot], hinge)[0];
  const screwShank = cylinder(L.screwShankRadius * k, z.dropBack + 0.01, z.pawlFront, inkMaterial);
  screwShank.position.x = pivotX;
  screwShank.position.y = pivotY;
  const screwHead = cylinder(L.screwRadius * k, z.pawlFront + 0.002, z.screwHeadFront, dropMaterial, 40);
  screwHead.position.x = pivotX;
  screwHead.position.y = pivotY;
  screwHead.userData.pawlPivotScrew = true;
  // Brown draws the screw's slot.
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(L.screwRadius * k * 1.7, 0.035, 0.012),
    inkMaterial,
  );
  slot.rotation.z = -1.05;
  slot.position.set(pivotX, pivotY, z.screwHeadFront + 0.004);
  slot.userData.surfaceMarking = true;
  drop.userData.rotor.add(dropBody, striker, screwShank, screwHead, slot);
  drop.userData.role = 'spring-carried-drop';

  // The broad hooked pawl hangs on the screw: one plate with Brown's smooth
  // outline, flush with the star it works. Brown dots the drop's leg and the
  // disk's rim behind its lobe, so the pawl is see-through
  // (see-through-part.js) and those working parts show.
  const pawl = makePlanarRotor();
  pawl.position.set(pivotX, pivotY, 0);
  const pawlMaterial = matte(PALETTE.accent, { metalness: 0.08, roughness: 0.67 });
  const bore = circleRing((L.screwShankRadius + 2) * k, 40, true);
  const pawlBody = slab(
    ringShape(localRing(mechanism.pawlPlateOutline, L.pawlPivot), [bore]),
    z.pawlBack,
    z.pawlFront,
    pawlMaterial,
  );
  pawlBody.userData.pawlBody = true;
  pawlBody.userData.role = 'see-through-broad-hooked-pawl-plate';
  makeSeeThrough(pawlBody);
  pawl.userData.rotor.add(pawlBody);
  pawl.userData.role = 'broad-hooked-pawl-on-drop';
  drop.userData.rotor.add(pawl);

  // The leaf spring, broken off at the plate's left edge, carries the drop
  // by its tail; it bends as an end-loaded cantilever, so its end turns with
  // the drop about the hinge.
  const springPlaneZ = z.dropFront + 0.02;
  const springRelaxed = Array.from({ length: 33 }, (_, index) => {
    const point = toWorld([
      L.springClamp[0] + (L.springEnd[0] - L.springClamp[0]) * index / 32,
      L.springClamp[1] + (L.springEnd[1] - L.springClamp[1]) * index / 32,
    ]);
    return new THREE.Vector3(point.x, point.y, springPlaneZ);
  });
  const springCurveAt = (delta) => cantileverLeafCurve(
    springRelaxed,
    toWorld(mechanism.rotateAboutHinge(L.springEnd, delta)),
  );
  const springLeaf = makeDynamicLeafSpring(springCurveAt(0), {
    band: { halfWidthAt: () => 0.028 },
    color: PALETTE.muted,
    planeZ: springPlaneZ,
    radius: 0.016,
    tubularSegments: 48,
  });
  springLeaf.userData.flexibleLeafSpring = true;
  springLeaf.userData.role = 'flat-leaf-spring-carrying-drop';

  // Brown's fixed stop pin under the tail. Brown draws it and the striker as
  // open circles; the model shows plain steel pins. The stop pin stands on a
  // slim fixed strap behind the drop, which also carries the clamp block
  // holding the leaf spring's end (Brown breaks the spring off at the plate
  // edge; the clamp gives it a real, held end).
  const steelPinMaterial = matte('#c3c7c1', { metalness: 0.2, roughness: 0.5 });
  const frameMaterial = matte(PALETTE.frame, { metalness: 0.1, roughness: 0.7 });
  const strapBack = z.dropBack - 0.18, strapFront = z.dropBack - 0.10;
  const stopPin = cylinder(L.stopPinRadius * k, strapFront, z.dropFront + 0.03, steelPinMaterial, 28);
  const stopPoint = toWorld(mechanism.stopPin), clampPoint = toWorld(L.springClamp);
  stopPin.position.x = stopPoint.x;
  stopPin.position.y = stopPoint.y;
  stopPin.userData.fixed = true;
  stopPin.userData.role = 'fixed-drop-stop-pin';
  const strapWidth = 0.1, strapVector = stopPoint.clone().sub(clampPoint);
  const strapShape = new THREE.Shape();
  strapShape.absarc(0, 0, strapWidth / 2, Math.PI / 2, 3 * Math.PI / 2, false);
  strapShape.absarc(strapVector.length(), 0, strapWidth / 2 + 0.02, -Math.PI / 2, Math.PI / 2, false);
  strapShape.closePath();
  const strap = slab(strapShape, strapBack, strapFront, frameMaterial);
  strap.position.x = clampPoint.x;
  strap.position.y = clampPoint.y;
  strap.rotation.z = Math.atan2(strapVector.y, strapVector.x);
  strap.userData.fixed = true;
  strap.userData.role = 'fixed-strap-carrying-stop-pin-and-spring-clamp';
  const clampBlock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, springPlaneZ + 0.05 - strapFront), frameMaterial);
  clampBlock.position.set(clampPoint.x, clampPoint.y, (springPlaneZ + 0.05 + strapFront) / 2);
  clampBlock.userData.fixed = true;
  clampBlock.userData.role = 'fixed-clamp-block-holding-leaf-spring-end';

  root.add(strap, clampBlock, stopPin, star, driver, drop, springLeaf);

  // The steady contact solution for one pin event, baked offline.
  const fingerprint = snapCounterMotionFingerprint();
  const motion = snapCounterMotion.fingerprint === fingerprint
    ? snapCounterMotion
    : { ...mechanism.periodicEvent(), fingerprint, live: true };
  const steps = motion.stepsPerEvent;
  // The star's rest orientation (ten-fold, so whole events do not matter)
  // and the pin disk's turn at the start of the baked event.
  const startSigma = motion.startSigma;
  const phaseOffset = motion.phaseOffset;
  const driverAngularSpeed = 0.78;
  const eventPeriod = pinPitch / driverAngularSpeed;
  const sampleAt = (values, position) => {
    const index = Math.min(steps - 1, Math.floor(position));
    const fraction = position - index;
    return values[index] + (values[index + 1] - values[index]) * fraction;
  };
  const stateAtTime = (time) => {
    const driverTravel = driverAngularSpeed * time;
    const rawEvent = driverTravel / pinPitch;
    const nearest = Math.round(rawEvent);
    const eventCoordinate = Math.abs(rawEvent - nearest) < 1e-12 ? nearest : rawEvent;
    const eventIndex = Math.floor(eventCoordinate);
    const phase = eventCoordinate - eventIndex;
    const position = phase * steps;
    const dropAngle = sampleAt(motion.delta, position);
    const pawlAngle = sampleAt(motion.rho, position);
    const starTurn = sampleAt(motion.sigma, position);
    const starAngle = startSigma + starTurn - eventIndex * starPitch;
    const stepIndex = Math.min(steps - 1, Math.floor(position));
    const dropRate = (motion.delta[stepIndex + 1] - motion.delta[stepIndex]) * steps / eventPeriod;
    const pawlRate = (motion.rho[stepIndex + 1] - motion.rho[stepIndex]) * steps / eventPeriod;
    const starRate = (motion.sigma[stepIndex + 1] - motion.sigma[stepIndex]) * steps / eventPeriod;
    let stage = 'rest';
    if (starRate < -1e-9) stage = 'star-drive';
    else if (dropRate < -1e-9) stage = 'drop-falling';
    else if (dropRate > 1e-9) stage = 'lifting-drop';
    else if (dropAngle > 0.01) stage = 'drop-held';
    return {
      driverAngle: -(eventCoordinate + phaseOffset) * pinPitch,
      driverAngularSpeed: -driverAngularSpeed,
      dropAngle,
      dropAngularSpeed: dropRate,
      eventIndex,
      eventPeriod,
      eventPhase: phase,
      pawlAngle,
      pawlAngularSpeed: pawlRate,
      stage,
      starAngle,
      starAngularSpeed: starRate,
      starLocked: Math.abs(starRate) < 1e-9,
      completedSteps: eventIndex + starTurn / -starPitch,
    };
  };

  root.userData.mechanism = 'three-pin-spring-drop-ten-point-star-counter';
  root.userData.hideGround = true;
  root.userData.blocks = {
    driver,
    driverShaft,
    drop,
    pawl,
    springLeaf,
    star,
    starShaft,
    stopPin,
    striker,
  };
  root.userData.geometry = {
    driverAngularSpeed,
    eventPeriod,
    pinPitch,
    sourceScale: k,
    starPitch,
    z,
  };
  root.userData.snapCounter = { fingerprint, mechanism, motion, toWorld };
  root.userData.stateAtTime = stateAtTime;
  root.userData.reconstructionNote = 'Follows Brown\'s plate and Sam Gallagher\'s reconstruction: the spring carries the drop, which swings about the spring\'s virtual hinge; the broad hooked pawl hangs on the drop\'s screw and the striker stops it rising. The pins strike only the drop\'s broad pointed leg (Brown\'s dashed wedge) and lift the whole drop; the pawl rides with it, its nose sliding out of its space and over the next point into the next space; when the pin escapes past the leg\'s tip the spring throws the drop down and the pawl turns the star one point. The motion is a baked quasi-static planar contact solution with finite fall speeds; the pawl works flush with the star, in front of the pins\' ends.';

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(driver, state.driverAngle);
    setSpin(star, state.starAngle);
    setSpin(drop, state.dropAngle);
    setSpin(pawl, state.pawlAngle);
    springLeaf.userData.setCurve(springCurveAt(state.dropAngle));
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(1.2, 0.9, 12.4));
}




function internalGuardTappetStudIndex() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const studCount = 10;
  const studPitch = fullTurn / studCount;
  // Proportions of Brown's plate as fractions of the B–C centre distance:
  // C's disk 0.790, stud orbit 0.662, B's outer circle 0.861, stud 0.038.
  const centerDistance = 2.25;
  const drivenRadius = 0.79 * centerDistance;
  const studOrbitRadius = 0.662 * centerDistance;
  const studRadius = 0.038 * centerDistance;
  const guardOuterRadius = 0.861 * centerDistance;
  const tappetHalfWidth = 0.04 * centerDistance;
  const tappetContactOffset = tappetHalfWidth + studRadius;
  // Three of C's studs lie inside B's rim during dwell: the struck middle stud
  // and the two lock studs one pitch either side of it.
  const restStudAngle = THREE.MathUtils.degToRad(1.2);
  const releaseStudAngle = restStudAngle - studPitch;
  const studDistance = (angle) => Math.sqrt(
    centerDistance ** 2 + studOrbitRadius ** 2
      - 2 * centerDistance * studOrbitRadius * Math.cos(angle),
  );
  const tappetLength = studDistance(releaseStudAngle) - tappetContactOffset;
  const guardInnerRadius = studDistance(restStudAngle + studPitch) + studRadius;
  const lockPlay = studDistance(restStudAngle + studPitch)
    - studDistance(restStudAngle - studPitch);
  const layoutTilt = THREE.MathUtils.degToRad(7.7);
  const driverLayoutX = 0.98;
  const layout = new THREE.Group();
  layout.rotation.z = layoutTilt;
  layout.position.set(0.12, -0.12, 0);
  const axis = Z_AXIS.clone();

  // Planar kinematics in layout coordinates relative to B's centre. C sits at
  // (-centerDistance, 0); φ is the direction of the tappet's centre line.
  const studFromDriver = (angle) => new THREE.Vector2(
    -centerDistance + studOrbitRadius * Math.cos(angle),
    studOrbitRadius * Math.sin(angle),
  );
  const wrapNear = (angle, reference) => reference + Math.atan2(
    Math.sin(angle - reference),
    Math.cos(angle - reference),
  );
  const windowCenter = restStudAngle - studPitch / 2;
  const pushCandidates = (driverAngle) => {
    const direction = new THREE.Vector2(Math.cos(driverAngle), Math.sin(driverAngle));
    const candidates = [];
    const flankSine = (tappetContactOffset - centerDistance * Math.sin(driverAngle))
      / studOrbitRadius;
    if (Math.abs(flankSine) <= 1) {
      for (const base of [Math.asin(flankSine), Math.PI - Math.asin(flankSine)]) {
        const angle = wrapNear(driverAngle + base, windowCenter);
        const projection = studFromDriver(angle).dot(direction);
        if (projection >= 0 && projection <= tappetLength + 1e-9) {
          candidates.push({ angle, kind: 'flank', projection });
        }
      }
    }
    const fromTip = new THREE.Vector2(
      -centerDistance - tappetLength * direction.x,
      -tappetLength * direction.y,
    );
    const tipDistance = fromTip.length();
    const tipCosine = (tappetContactOffset ** 2 - tipDistance ** 2
      - studOrbitRadius ** 2) / (2 * studOrbitRadius * tipDistance);
    if (Math.abs(tipCosine) <= 1) {
      const heading = Math.atan2(fromTip.y, fromTip.x);
      for (const sign of [-1, 1]) {
        const angle = wrapNear(heading + sign * Math.acos(tipCosine), windowCenter);
        const projection = studFromDriver(angle).dot(direction);
        if (projection >= tappetLength - 1e-9) {
          candidates.push({ angle, kind: 'tip', projection });
        }
      }
    }
    return candidates.filter(({ angle }) => (
      angle >= releaseStudAngle - 1e-9 && angle <= restStudAngle + 1e-9
    ));
  };
  const flankGap = (driverAngle) => centerDistance * Math.sin(driverAngle)
    + studOrbitRadius * Math.sin(restStudAngle - driverAngle)
    - tappetContactOffset;
  let low = Math.PI / 2;
  let high = Math.PI;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (low + high) / 2;
    if (flankGap(middle) > 0) low = middle;
    else high = middle;
  }
  const contactStartDriverAngle = (low + high) / 2;
  const releasePoint = studFromDriver(releaseStudAngle);
  const contactEndDriverAngle = wrapNear(
    Math.atan2(releasePoint.y, releasePoint.x),
    contactStartDriverAngle + Math.PI / 2,
  );
  const contactDriverAngleSpan = contactEndDriverAngle - contactStartDriverAngle;
  const pushState = (driverAngle) => {
    if (driverAngle <= contactStartDriverAngle) {
      return { angle: restStudAngle, kind: 'guard', projection: null };
    }
    if (driverAngle >= contactEndDriverAngle) {
      return { angle: releaseStudAngle, kind: 'guard', projection: null };
    }
    const candidates = pushCandidates(driverAngle);
    if (candidates.length === 0) {
      throw new Error(`movement 71 lost tappet contact at ${driverAngle}`);
    }
    return candidates.reduce((best, candidate) => (
      candidate.angle < best.angle ? candidate : best
    ));
  };
  const pushRate = (driverAngle, push) => {
    if (push.kind === 'guard') return 0;
    const stud = studFromDriver(push.angle);
    const studTangent = new THREE.Vector2(
      -studOrbitRadius * Math.sin(push.angle),
      studOrbitRadius * Math.cos(push.angle),
    );
    if (push.kind === 'flank') {
      const normal = new THREE.Vector2(-Math.sin(driverAngle), Math.cos(driverAngle));
      const normalRate = centerDistance * Math.cos(driverAngle)
        - studOrbitRadius * Math.cos(push.angle - driverAngle);
      return -normalRate / studTangent.dot(normal);
    }
    const tip = new THREE.Vector2(Math.cos(driverAngle), Math.sin(driverAngle))
      .multiplyScalar(tappetLength);
    const tipVelocity = new THREE.Vector2(-tip.y, tip.x);
    const separation = stud.clone().sub(tip);
    return separation.dot(tipVelocity) / separation.dot(studTangent);
  };

  const notchProfileSamples = 1440;
  const notchAngularClearance = 0.012;
  const notchRanges = {
    entering: { end: -Infinity, start: Infinity },
    leaving: { end: -Infinity, start: Infinity },
  };
  const notchPaths = { entering: [], leaving: [] };
  for (let sample = 0; sample <= notchProfileSamples; sample += 1) {
    const driverAngle = contactStartDriverAngle
      + contactDriverAngleSpan * sample / notchProfileSamples;
    const advance = pushState(driverAngle).angle - restStudAngle;
    for (const [kind, offset] of [['leaving', -1], ['entering', 2]]) {
      const local = studFromDriver(restStudAngle + offset * studPitch + advance)
        .rotateAround(new THREE.Vector2(), -driverAngle);
      const distance = local.length();
      if (
        distance + studRadius >= guardInnerRadius - 0.1
        && distance - studRadius <= guardOuterRadius + 0.1
      ) notchPaths[kind].push(local.clone());
      if (
        distance + studRadius >= guardInnerRadius
        && distance - studRadius <= guardOuterRadius
      ) {
        const center = Math.atan2(local.y, local.x);
        const extent = Math.asin(studRadius / distance);
        notchRanges[kind].start = Math.min(notchRanges[kind].start, center - extent);
        notchRanges[kind].end = Math.max(notchRanges[kind].end, center + extent);
      }
    }
  }
  const enteringNotchStart = notchRanges.entering.start - notchAngularClearance;
  const enteringNotchEnd = notchRanges.entering.end + notchAngularClearance;
  const leavingNotchStart = notchRanges.leaving.start - notchAngularClearance;
  const leavingNotchEnd = notchRanges.leaving.end + notchAngularClearance;
  // Brown cuts each notch as a narrow slanted slit, not a sector: the stud
  // crosses the rim obliquely in B's frame, so the rim only needs the channel
  // the stud actually sweeps (its radius plus a running clearance).
  const notchChannelClearance = 0.02;
  // Where a stud only grazes the rim's inner lock face (entering a lock or
  // leaving one), the clearance tapers to its actual overlap, so the lock
  // face is never gouged.
  const channelRegion = (path) => {
    const widthAt = (point) => studRadius + THREE.MathUtils.clamp(
      point.length() + studRadius - guardInnerRadius, 0, notchChannelClearance,
    );
    const offsetSide = (sign) => path.map((point, index) => {
      const before = path[Math.max(0, index - 1)];
      const after = path[Math.min(path.length - 1, index + 1)];
      const tangent = after.clone().sub(before).normalize();
      const width = widthAt(point);
      return [point.x - sign * tangent.y * width, point.y + sign * tangent.x * width];
    });
    const cap = (center, from, sweep, width = widthAt(center)) => Array.from({ length: 17 }, (_, index) => {
      const angle = from + sweep * index / 16;
      return [center.x + Math.cos(angle) * width, center.y + Math.sin(angle) * width];
    });
    const startTangent = path[1].clone().sub(path[0]);
    const endTangent = path.at(-1).clone().sub(path.at(-2));
    const endNormal = Math.atan2(endTangent.x, -endTangent.y);
    const startNormal = Math.atan2(-startTangent.x, startTangent.y);
    return clipPoly([
      ...offsetSide(1),
      ...cap(path.at(-1), endNormal, -Math.PI).slice(1, -1),
      ...offsetSide(-1).reverse(),
      ...cap(path[0], startNormal, -Math.PI).slice(1, -1),
    ]);
  };
  const notchChannels = polygonClipping.union(
    channelRegion(notchPaths.entering),
    channelRegion(notchPaths.leaving),
  );
  // The inner lock face is circumscribed, so its chords never reach inside
  // the true lock circle the resting studs bear on.
  const guardInnerPolygonRadius = guardInnerRadius / Math.cos(Math.PI / 720);
  const guardRimRegions = polygonClipping.difference(
    clipPoly(clipCircle([0, 0], guardOuterRadius, 720)),
    clipPoly(clipCircle([0, 0], guardInnerPolygonRadius, 720)),
    notchChannels,
  );

  const drivenDepth = 0.24;
  const studBaseZ = drivenDepth / 2 - 0.02;
  const studLength = 0.46;
  const rimBackZ = 0.17;
  const plateBackZ = studBaseZ + studLength + 0.03;
  const plateDepth = 0.14;
  const tappetBackZ = 0.2;
  const tappetDepth = plateBackZ - tappetBackZ;
  const studContactPlaneZ = (tappetBackZ + plateBackZ) / 2;
  const driverMaterial = matte(PALETTE.driver, { metalness: 0.1, roughness: 0.64 });
  const drivenMaterial = matte(PALETTE.driven, { metalness: 0.1, roughness: 0.66 });
  const inkMaterial = matte(PALETTE.ink, { metalness: 0.23, roughness: 0.49 });

  const arcPoints = (radius, start, end, circumscribe) => {
    const segments = Math.max(8, Math.ceil(Math.abs(end - start) / fullTurn * 720));
    const step = (end - start) / segments;
    const vertexRadius = circumscribe ? radius / Math.cos(step / 2) : radius;
    const points = [new THREE.Vector2(Math.cos(start) * radius, Math.sin(start) * radius)];
    for (let index = 0; index < segments; index += 1) {
      const angle = start + step * (index + 0.5);
      points.push(new THREE.Vector2(
        Math.cos(angle) * vertexRadius,
        Math.sin(angle) * vertexRadius,
      ));
    }
    points.push(new THREE.Vector2(Math.cos(end) * radius, Math.sin(end) * radius));
    return points;
  };
  const flatExtrusion = (points, depth, holes = []) => {
    const shape = new THREE.Shape(points);
    shape.holes.push(...holes);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: false,
      curveSegments: 48,
      depth,
    });
    return geometry;
  };
  const circlePath = (radius) => {
    const path = new THREE.Path();
    path.absarc(0, 0, radius, 0, fullTurn, true);
    return path;
  };

  const driver = makePlanarRotor();
  driver.position.set(driverLayoutX, 0, 0);
  driver.userData.role = 'continuous-driving-wheel-B-with-internal-guard';
  const driverRotor = driver.userData.rotor;
  const driverShaftRadius = 0.11 * centerDistance;
  const driverBoss = 0.16 * centerDistance;
  const ahead = (angle, from) => from
    + THREE.MathUtils.euclideanModulo(angle - from, fullTurn);
  const shortSpanStart = enteringNotchEnd;
  const shortSpanEnd = ahead(leavingNotchStart, shortSpanStart);
  const longSpanStart = ahead(leavingNotchEnd, shortSpanEnd);
  const longSpanEnd = ahead(enteringNotchStart, longSpanStart);
  const guardSpans = [
    [shortSpanStart, shortSpanEnd],
    [longSpanStart, longSpanEnd],
  ];
  const regionPoints = (ring) => ring.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y));
  if (guardRimRegions.length !== guardSpans.length) {
    throw new Error('movement 71 notch channels must split the rim in two');
  }
  // Pair each rim piece with its span: the piece holding the span's middle.
  const regionHolds = (region, [x, y]) => {
    let inside = false;
    const ring = region[0];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      if ((ring[i][1] > y) !== (ring[j][1] > y)
        && x < (ring[j][0] - ring[i][0]) * (y - ring[i][1]) / (ring[j][1] - ring[i][1]) + ring[i][0]) inside = !inside;
    }
    return inside;
  };
  const orderedRimRegions = guardSpans.map(([start, end]) => {
    const angle = (start + end) / 2;
    const radius = (guardInnerRadius + guardOuterRadius) / 2;
    return guardRimRegions.find((region) => regionHolds(region, [radius * Math.cos(angle), radius * Math.sin(angle)]));
  });
  const guardSegments = guardSpans.map(([startAngle, endAngle], index) => {
    const outline = regionPoints(orderedRimRegions[index][0]);
    const segment = new THREE.Mesh(
      flatExtrusion(outline, plateBackZ - rimBackZ),
      driverMaterial,
    );
    segment.position.z = rimBackZ;
    Object.assign(segment.userData, {
      endAngle,
      guardRimSegment: true,
      index,
      outline,
      role: `B-internal-guard-rim-arc-${index}`,
      startAngle,
    });
    driverRotor.add(segment);
    return segment;
  });
  const plateRegion = polygonClipping.difference(
    clipPoly(clipCircle([0, 0], guardOuterRadius, 720)),
    polygonClipping.difference(notchChannels, clipPoly(clipCircle([0, 0], guardInnerPolygonRadius, 720))),
  );
  const plateOutline = regionPoints(plateRegion[0][0]);
  const driverBody = new THREE.Mesh(
    flatExtrusion(plateOutline, plateDepth, [circlePath(driverShaftRadius + 0.01)]),
    driverMaterial,
  );
  // Brown dots B's rim, tappet and the interior studs behind the plate; the
  // plate is see-through (see-through-part.js) so they show as working parts.
  driverBody.material = matte(PALETTE.driver, {
    metalness: 0.1,
    roughness: 0.64,
  });
  makeSeeThrough(driverBody);
  driverBody.position.z = plateBackZ;
  driverBody.userData.driverWheelBBody = true;
  driverBody.userData.role = 'B-front-plate-carrying-guard-rim';
  driverRotor.add(driverBody);
  const driverHubRing = new THREE.Mesh(
    flatExtrusion(arcPoints(driverBoss, 0, fullTurn, false), 0.05,
      [circlePath(driverShaftRadius + 0.01)]),
    inkMaterial,
  );
  driverHubRing.position.z = plateBackZ + plateDepth;
  driverRotor.add(driverHubRing);
  const tappetShape = new THREE.Shape();
  tappetShape.moveTo(0, -tappetHalfWidth);
  tappetShape.lineTo(tappetLength, -tappetHalfWidth);
  tappetShape.absarc(tappetLength, 0, tappetHalfWidth, -Math.PI / 2, Math.PI / 2, false);
  tappetShape.lineTo(0, tappetHalfWidth);
  tappetShape.absarc(0, 0, tappetHalfWidth, Math.PI / 2, Math.PI * 1.5, false);
  const tappet = new THREE.Mesh(
    new THREE.ExtrudeGeometry(tappetShape, {
      bevelEnabled: false,
      curveSegments: 32,
      depth: tappetDepth,
    }),
    matte(PALETTE.brass, { metalness: 0.12, roughness: 0.58 }),
  );
  tappet.position.z = tappetBackZ;
  tappet.userData.contactFaceOffset = tappetHalfWidth;
  tappet.userData.fixedTappetA = true;
  tappet.userData.role = 'single-radial-tappet-A';
  driverRotor.add(tappet);
  const tappetHub = new THREE.Mesh(
    flatExtrusion(arcPoints(driverBoss, 0, fullTurn, false), tappetDepth,
      [circlePath(driverShaftRadius + 0.01)]),
    tappet.material,
  );
  tappetHub.position.z = tappetBackZ;
  driverRotor.add(tappetHub);
  const driverIndicator = new THREE.Object3D();
  driverIndicator.position.set(0, guardOuterRadius * 0.8, plateBackZ + plateDepth);
  driverIndicator.userData.driverRotationIndicator = true;
  driverRotor.add(driverIndicator);
  Object.assign(driver.userData, {
    enteringNotchEnd,
    enteringNotchStart,
    guardInnerRadius,
    guardOuterRadius,
    leavingNotchEnd,
    leavingNotchStart,
  });
  const driverShaft = makeShaft({ length: 1.5, radius: driverShaftRadius });
  driverShaft.position.set(driverLayoutX, 0, 0.3);
  driverShaft.userData.radius = driverShaftRadius;
  driverShaft.userData.role = 'continuous-input-shaft-B';

  const drivenX = driverLayoutX - centerDistance;
  const driven = makePlanarRotor();
  driven.position.set(drivenX, 0, 0);
  driven.userData.role = 'clockwise-intermittent-ten-stud-wheel-C';
  const drivenRotor = driven.userData.rotor;
  const drivenShaftRadius = 0.075 * centerDistance;
  const drivenBody = new THREE.Mesh(
    flatExtrusion(arcPoints(drivenRadius, 0, fullTurn, false), drivenDepth,
      [circlePath(drivenShaftRadius + 0.01)]),
    drivenMaterial,
  );
  drivenBody.position.z = -drivenDepth / 2;
  drivenBody.userData.studdedIndexDiskBody = true;
  drivenRotor.add(drivenBody);
  const drivenHubRing = new THREE.Mesh(
    flatExtrusion(arcPoints(0.12 * centerDistance, 0, fullTurn, false), 0.05,
      [circlePath(drivenShaftRadius + 0.01)]),
    inkMaterial,
  );
  drivenHubRing.position.z = drivenDepth / 2;
  drivenRotor.add(drivenHubRing);
  const studMountPhase = restStudAngle;
  const studs = Array.from({ length: studCount }, (_, index) => {
    const mountAngle = studMountPhase + index * studPitch;
    const stud = new THREE.Mesh(
      new THREE.CylinderGeometry(studRadius, studRadius, studLength, 28),
      inkMaterial,
    );
    stud.rotation.x = Math.PI / 2;
    stud.position.set(
      Math.cos(mountAngle) * studOrbitRadius,
      Math.sin(mountAngle) * studOrbitRadius,
      studBaseZ + studLength / 2,
    );
    Object.assign(stud.userData, {
      index,
      indexingStud: true,
      mountAngle,
      orbitRadius: studOrbitRadius,
      radius: studRadius,
    });
    drivenRotor.add(stud);
    return stud;
  });
  const drivenIndicator = new THREE.Object3D();
  drivenIndicator.position.set(drivenRadius * 0.5, 0, drivenDepth / 2);
  drivenIndicator.userData.drivenRotationIndicator = true;
  drivenRotor.add(drivenIndicator);
  Object.assign(driven.userData, { studCount, studPitch, studs });
  const drivenShaft = makeShaft({ length: 0.9, radius: drivenShaftRadius });
  drivenShaft.position.set(drivenX, 0, 0.05);
  drivenShaft.userData.radius = drivenShaftRadius;
  drivenShaft.userData.role = 'intermittent-output-shaft-C';

  const driverAngularSpeed = 0.85;
  const driverCyclePeriod = fullTurn / driverAngularSpeed;
  const cycleBoundaryDriverAngle = contactStartDriverAngle - 1;
  const initialDriverAngle = contactStartDriverAngle - 0.14;
  const toWorld = (planar, z) => layout.localToWorld(
    new THREE.Vector3(planar.x + driverLayoutX, planar.y, z),
  );
  const toWorldDirection = (planar) => new THREE.Vector3(planar.x, planar.y, 0)
    .applyAxisAngle(Z_AXIS, layoutTilt);
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const stateAtTime = (time) => {
    const driverAngle = initialDriverAngle + driverAngularSpeed * time;
    const cycleIndex = Math.floor((driverAngle - cycleBoundaryDriverAngle) / fullTurn);
    const cycleDriverAngle = driverAngle - cycleIndex * fullTurn;
    const push = pushState(cycleDriverAngle);
    const drivenAdvanceAngle = push.angle - restStudAngle;
    const drivenAngle = -cycleIndex * studPitch + drivenAdvanceAngle;
    const drivenAngularSpeed = driverAngularSpeed * pushRate(cycleDriverAngle, push);
    const indexing = push.kind !== 'guard';
    const activeStudIndex = THREE.MathUtils.euclideanModulo(cycleIndex, studCount);
    const leavingStudIndex = THREE.MathUtils.euclideanModulo(cycleIndex - 1, studCount);
    const enteringStudIndex = THREE.MathUtils.euclideanModulo(cycleIndex + 2, studCount);
    const planarStud = (index) => studFromDriver(
      studMountPhase + index * studPitch + drivenAngle,
    );
    const direction = new THREE.Vector2(Math.cos(driverAngle), Math.sin(driverAngle));
    const normal = new THREE.Vector2(-direction.y, direction.x);
    let contact = null;
    if (indexing) {
      const stud = planarStud(activeStudIndex);
      const forceDirection = push.kind === 'flank'
        ? normal.clone()
        : stud.clone().sub(direction.clone().multiplyScalar(tappetLength)).normalize();
      const studPoint = stud.clone().addScaledVector(forceDirection, -studRadius);
      const tappetPoint = push.kind === 'flank'
        ? direction.clone().multiplyScalar(push.projection)
          .addScaledVector(normal, tappetHalfWidth)
        : direction.clone().multiplyScalar(tappetLength)
          .addScaledVector(forceDirection, tappetHalfWidth);
      const fromDriven = studPoint.clone().add(new THREE.Vector2(centerDistance, 0));
      const tappetVelocity = new THREE.Vector2(-tappetPoint.y, tappetPoint.x)
        .multiplyScalar(driverAngularSpeed);
      const studVelocity = new THREE.Vector2(-fromDriven.y, fromDriven.x)
        .multiplyScalar(drivenAngularSpeed);
      contact = {
        driverTorque: cross(tappetPoint, forceDirection.clone().negate()),
        error: studPoint.distanceTo(tappetPoint),
        forceDirection: toWorldDirection(forceDirection),
        kind: push.kind,
        normalVelocityError: Math.abs(
          studVelocity.clone().sub(tappetVelocity).dot(forceDirection),
        ),
        outputTorque: cross(fromDriven, forceDirection),
        projection: push.projection,
        studPoint: toWorld(studPoint, studContactPlaneZ),
        tappetPoint: toWorld(tappetPoint, studContactPlaneZ),
      };
    }
    const guardStudContacts = indexing ? [] : [
      cycleDriverAngle < contactStartDriverAngle ? activeStudIndex + 1 : activeStudIndex + 2,
    ].map((raw) => {
      const index = THREE.MathUtils.euclideanModulo(raw, studCount);
      const stud = planarStud(index);
      const radial = stud.clone().normalize();
      return {
        error: Math.abs(stud.length() + studRadius - guardInnerRadius),
        guardPoint: toWorld(radial.clone().multiplyScalar(guardInnerRadius), studContactPlaneZ),
        index,
        studPoint: toWorld(stud.clone().addScaledVector(radial, studRadius), studContactPlaneZ),
      };
    });
    return {
      activeStudIndex,
      contact,
      cycleIndex,
      drivenAdvanceAngle,
      drivenAngle,
      drivenAngularSpeed,
      drivenLocked: !indexing,
      driverAngle,
      driverAngularSpeed,
      enteringStudIndex,
      guardStudContacts,
      indexing,
      leavingStudIndex,
      planarStud,
      stage: indexing ? `tappet-${push.kind}-push` : 'guard-locked',
    };
  };

  layout.add(drivenShaft, driverShaft, driven, driver);
  root.add(layout);
  root.userData.mechanism = 'internal-guard-three-stud-tappet-ten-stud-index';
  root.userData.hideGround = true;
  root.userData.blocks = {
    driven,
    drivenBody,
    drivenIndicator,
    drivenShaft,
    driver,
    driverBody,
    driverIndicator,
    driverShaft,
    guardSegments,
    layout,
    studs,
    tappet,
    tappetHub,
  };
  root.userData.geometry = {
    axis,
    centerDistance,
    contactDriverAngleSpan,
    contactEndDriverAngle,
    contactStartDriverAngle,
    cycleBoundaryDriverAngle,
    drivenDepth,
    drivenRadius,
    driverAngularSpeed,
    driverCyclePeriod,
    driverLayoutX,
    enteringNotchEnd,
    enteringNotchStart,
    fullTurn,
    guardInnerRadius,
    guardOuterRadius,
    guardRimRegions: orderedRimRegions,
    initialDriverAngle,
    layoutTilt,
    leavingNotchEnd,
    leavingNotchStart,
    lockPlay,
    notchAngularClearance,
    notchChannelClearance,
    plateBackZ,
    releaseStudAngle,
    restStudAngle,
    rimBackZ,
    studContactPlaneZ,
    studCount,
    studDistance,
    studLength,
    studMountPhase,
    studOrbitRadius,
    studPitch,
    studRadius,
    tappetBackZ,
    tappetContactOffset,
    tappetDepth,
    tappetHalfWidth,
    tappetLength,
  };
  root.userData.reconstructionNote = 'B is a front plate carrying a notched internal rim and one radial tappet; C carries ten studs. The tappet pushes the middle of three interior studs with its leading flank and then its rounded tip, releasing it exactly one pitch later; the rim holds the upper stud (with the lower stud a small play away) through dwell. Each notch is the narrow slanted channel the stud sweeps through the rim, as Brown draws his slits. Brown dots the interior studs, tappet and rim behind B; B\'s plate is see-through so they show.';
  root.userData.stateAtTime = stateAtTime;
  root.userData.sectionView = false;
  root.userData.fullCameraDirection = new THREE.Vector3(1.2, 0.9, 12.4);
  root.userData.setSectionView = (enabled) => {
    root.userData.sectionView = Boolean(enabled);
    driverBody.visible = !enabled;
    driverHubRing.visible = !enabled;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(driver, state.driverAngle);
    setSpin(driverShaft, state.driverAngle);
    setSpin(driven, state.drivenAngle);
    setSpin(drivenShaft, state.drivenAngle);
    root.userData.contacts = {
      guardStuds: { contacts: state.guardStudContacts, engaged: !state.indexing },
      tappetStud: state.contact
        ? { engaged: true, studIndex: state.activeStudIndex, ...state.contact }
        : { engaged: false, studIndex: state.activeStudIndex },
    };
    root.userData.kinematics = state;
  };
  update(0);
  const finished = finish(root, update, new THREE.Vector3(1.2, 0.9, 12.4));
  // Brown draws C's studs end-on as small circles; the long studs would
  // otherwise cast shadow sweeps the plate does not show (the see-through
  // plate casts none).
  driverBody.castShadow = false;
  for (const stud of studs) stud.castShadow = false;
  return finished;
}

// A leaf clamped part-way along its length: the relaxed centreline plus a
// cantilever deflection (3v^2 - v^3) / 2 of the free end beyond clampFraction
// (v runs 0..1 over that free end). Used for C, whose shallow tip is the
// flexible part while its deep pressing web stays put.
class ClampedTipLeafCurve extends THREE.Curve {
  constructor(relaxedPoints, tipDisplacement, clampFraction) {
    super();
    this.relaxedPoints = relaxedPoints;
    this.tipDisplacement = tipDisplacement.clone();
    this.clampFraction = clampFraction;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const u = THREE.MathUtils.clamp(t, 0, 1);
    const last = this.relaxedPoints.length - 1;
    const scaled = u * last;
    const index = Math.min(Math.floor(scaled), last - 1);
    target.lerpVectors(this.relaxedPoints[index], this.relaxedPoints[index + 1], scaled - index);
    const v = THREE.MathUtils.clamp((u - this.clampFraction) / (1 - this.clampFraction), 0, 1);
    return target.addScaledVector(this.tipDisplacement, v * v * (3 - v) / 2);
  }
}

// A leaf clamped at its start and guided at its end (the end keeps its
// direction): the relaxed centreline plus the end displacement times
// 3u^2 - 2u^3.
class GuidedLeafCurve extends THREE.Curve {
  constructor(relaxedPoints, tipDisplacement) {
    super();
    this.relaxedPoints = relaxedPoints;
    this.tipDisplacement = tipDisplacement.clone();
  }

  getPoint(t, target = new THREE.Vector3()) {
    const u = THREE.MathUtils.clamp(t, 0, 1);
    const last = this.relaxedPoints.length - 1;
    const scaled = u * last;
    const index = Math.min(Math.floor(scaled), last - 1);
    target.lerpVectors(this.relaxedPoints[index], this.relaxedPoints[index + 1], scaled - index);
    return target.addScaledVector(this.tipDisplacement, u * u * (3 - 2 * u));
  }
}

// Points evenly spaced in arc length along a polyline (Vector3s).
function evenPolyline(points, count) {
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) lengths.push(lengths[i - 1] + points[i].distanceTo(points[i - 1]));
  const total = lengths.at(-1);
  const out = [];
  for (let k = 0, j = 1; k < count; k += 1) {
    const target = total * k / (count - 1);
    while (j < points.length - 1 && lengths[j] < target) j += 1;
    const f = THREE.MathUtils.clamp((target - lengths[j - 1]) / Math.max(1e-12, lengths[j] - lengths[j - 1]), 0, 1);
    out.push(points[j - 1].clone().lerp(points[j], f));
  }
  return { points: out, lengths, total };
}

function hermitePoints(start, startTangent, end, endTangent, count) {
  return Array.from({ length: count + 1 }, (_, index) => {
    const t = index / count;
    const h00 = 2 * t ** 3 - 3 * t ** 2 + 1, h10 = t ** 3 - 2 * t ** 2 + t;
    const h01 = -2 * t ** 3 + 3 * t ** 2, h11 = t ** 3 - t ** 2;
    return new THREE.Vector3()
      .addScaledVector(start, h00).addScaledVector(startTangent, h10)
      .addScaledVector(end, h01).addScaledVector(endTangent, h11);
  });
}

function springPressedRatchetIndex() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const toothCount = 11;
  const toothPitch = fullTurn / toothCount;
  // Brown's teeth are shallow: roots at about 0.8 of the tip radius, with
  // short, nearly radial faces that barely overhang.
  const ratchetRootRadius = 0.8;
  const ratchetOuterRadius = 1;
  const toothOuterStartPhase = 0.28;
  const toothOuterEndPhase = 1.02;
  const stopFaceFraction = 0.3;
  // C's end seats in A's teeth at the upper left, as Brown draws it.
  const stopFaceWorldAngle = THREE.MathUtils.degToRad(140);
  const baseFaceOuter = new THREE.Vector2(
    Math.cos(toothOuterEndPhase * toothPitch) * ratchetOuterRadius,
    Math.sin(toothOuterEndPhase * toothPitch) * ratchetOuterRadius,
  );
  const baseFaceRoot = new THREE.Vector2(
    Math.cos(toothPitch) * ratchetRootRadius,
    Math.sin(toothPitch) * ratchetRootRadius,
  );
  const baseStopPoint = baseFaceRoot.clone().lerp(baseFaceOuter, stopFaceFraction);
  const ratchetMountPhase = stopFaceWorldAngle - Math.atan2(baseStopPoint.y, baseStopPoint.x);
  const ratchetDepth = 0.2;
  const ratchetPlaneZ = 0.08;
  const ratchet = makeSpringIndexedRatchet({
    boreRadius: 0.18,
    depth: ratchetDepth,
    mountPhase: ratchetMountPhase,
    outerRadius: ratchetOuterRadius,
    rootRadius: ratchetRootRadius,
    teeth: toothCount,
    toothOuterEndPhase,
    toothOuterStartPhase,
    sharkFin: true,
  });
  ratchet.position.z = ratchetPlaneZ;
  ratchet.userData.role = 'clockwise-intermittent-ratchet-wheel-A';
  const ratchetBody = ratchet.userData.body;
  ratchet.userData.rotor.remove(ratchet.userData.indicator);
  const ratchetIndicator = new THREE.Object3D();
  ratchetIndicator.position.copy(ratchet.userData.indicator.position);
  ratchetIndicator.userData.ratchetRotationIndicator = true;
  ratchet.userData.rotor.add(ratchetIndicator);
  ratchet.userData.indicator = ratchetIndicator;
  const ratchetShaft = makeShaft({ length: 1.34, radius: 0.09 });
  ratchetShaft.position.z = ratchetPlaneZ;
  ratchetShaft.userData.radius = 0.09;
  ratchetShaft.userData.role = 'intermittent-output-shaft-A';
  const profile = ratchet.userData.profilePoints;

  // Depth layers (z, front is +z). A spans its whole depth. B is a flat
  // leaf lying on D's face behind A; only its end, the nib, is deep enough to
  // reach forward into A's back half. C lies in front: its long pressing web
  // is deep enough to reach back to the nib, and its thin flexible end works
  // in A's front half. So B's leaf and clamp pass under C (Brown: "B passes
  // under the strong spring C"), C's web bears radially on the back of B's
  // nib, and B's nib and C's end can share a tooth space without meeting.
  const ratchetBack = ratchetPlaneZ - ratchetDepth / 2;
  const catchLeafZ = [-0.19, -0.07];
  const catchNibZ = [-0.19, 0.07];
  const strongWebZ = [ratchetBack, 0.19];
  const strongTipZ = [0.09, 0.19];

  // C's end is round (radius strongHalfWidth), seated on the working face.
  const stopPadRadius = 0.035;
  const facePointAt = (face, fraction) => face.root.clone().lerp(face.outer, fraction);
  const stopFace = ratchet.userData.toothFaces[0];
  const stopFacePoint = facePointAt(stopFace, stopFaceFraction);
  const idealStopPadCenter = stopFacePoint.clone().addScaledVector(stopFace.outwardNormal, stopPadRadius);
  const stopPawlDirection = idealStopPadCenter.clone().normalize();

  const pointInsideRatchet = (point) => {
    let inside = false;
    for (let index = 0, previousIndex = profile.length - 1; index < profile.length; previousIndex = index, index += 1) {
      const current = profile[index];
      const previous = profile[previousIndex];
      if ((current.y > point.y) !== (previous.y > point.y)
        && point.x < (previous.x - current.x) * (point.y - current.y) / (previous.y - current.y) + current.x) inside = !inside;
    }
    return inside;
  };
  const closestRatchetProfilePoint = (point) => {
    let distance = Infinity;
    let pointOnProfile = null;
    let segmentIndex = -1;
    for (let index = 0; index < profile.length; index += 1) {
      const start = profile[index];
      const end = profile[(index + 1) % profile.length];
      const edge = end.clone().sub(start);
      const denominator = edge.lengthSq();
      const fraction = denominator < 1e-18 ? 0
        : THREE.MathUtils.clamp(point.clone().sub(start).dot(edge) / denominator, 0, 1);
      const candidate = start.clone().addScaledVector(edge, fraction);
      const candidateDistance = point.distanceTo(candidate);
      if (candidateDistance < distance) {
        distance = candidateDistance;
        pointOnProfile = candidate;
        segmentIndex = index;
      }
    }
    return { distance, point: pointOnProfile, segmentIndex };
  };
  // Outermost radius of A's rest profile along a world ray.
  const profileRadiusAt = (angle) => {
    const direction = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
    let radius = 0;
    for (let index = 0; index < profile.length; index += 1) {
      const a = profile[index];
      const b = profile[(index + 1) % profile.length];
      const e = b.clone().sub(a);
      const denominator = direction.x * e.y - direction.y * e.x;
      if (Math.abs(denominator) < 1e-14) continue;
      const distance = (a.x * e.y - a.y * e.x) / denominator;
      const fraction = (a.x * direction.y - a.y * direction.x) / denominator;
      if (distance > 0 && fraction >= 0 && fraction <= 1) radius = Math.max(radius, distance);
    }
    return radius;
  };
  const stopContactAtDrivenAngle = (drivenAngle) => {
    const localCenterAtRadius = (radius) => stopPawlDirection.clone()
      .multiplyScalar(radius).rotateAround(new THREE.Vector2(), -drivenAngle);
    const collidesAtRadius = (radius) => {
      const localCenter = localCenterAtRadius(radius);
      return pointInsideRatchet(localCenter)
        || closestRatchetProfilePoint(localCenter).distance < stopPadRadius;
    };
    let low = ratchetRootRadius * 0.5;
    let high = ratchetOuterRadius + stopPadRadius + 0.28;
    if (!collidesAtRadius(low) || collidesAtRadius(high)) {
      throw new RangeError('The fixed strong spring cannot reach ratchet A.');
    }
    // A shark-fin crest overhangs its root; step out before bisecting so C
    // lands in its seat rather than on the crest.
    const inner = low;
    const outer = high;
    for (let index = 1; index <= 256; index += 1) {
      const radius = inner + (outer - inner) * index / 256;
      if (!collidesAtRadius(radius)) { high = radius; break; }
      low = radius;
    }
    for (let iteration = 0; iteration < 58; iteration += 1) {
      const middle = (low + high) / 2;
      if (collidesAtRadius(middle)) low = middle;
      else high = middle;
    }
    const centerRadius = (low + high) / 2;
    const center = stopPawlDirection.clone().multiplyScalar(centerRadius);
    const localCenter = center.clone().rotateAround(new THREE.Vector2(), -drivenAngle);
    const closest = closestRatchetProfilePoint(localCenter);
    const contactPoint = closest.point.clone().rotateAround(new THREE.Vector2(), drivenAngle);
    const normal = center.clone().sub(contactPoint).normalize();
    const padPoint = center.clone().addScaledVector(normal, -stopPadRadius);
    return {
      center,
      centerRadius,
      contactError: padPoint.distanceTo(contactPoint),
      contactPoint,
      localCenter,
      localContactPoint: closest.point,
      normal,
      padPoint,
      segmentIndex: closest.segmentIndex,
    };
  };
  const restStopContact = stopContactAtDrivenAngle(0);

  // --- C and the path of B's nib, in world polar coordinates (ψ is the
  // angle of the nib's front face, r the radius of its centre line). The nib
  // pushes the crest corner of face 1, one pitch behind C's seat, from ψ0
  // through one pitch, so at the end it arrives in C's tooth space.
  const nibHalfWidth = 0.085;
  const nibLength = 0.11;
  const toothClearance = 0.012;
  const pressGap = 0.004;
  const wrapNear = (angle, reference) => reference
    + THREE.MathUtils.euclideanModulo(angle - reference + Math.PI, fullTurn) - Math.PI;
  const face1Outer = ratchet.userData.toothFaces[1].outer;
  const drivePsi0 = wrapNear(Math.atan2(face1Outer.y, face1Outer.x), stopFaceWorldAngle + toothPitch);
  const driveEndPsi = drivePsi0 - toothPitch;
  const nibAngle = (radius) => nibLength / radius;
  // Highest tooth under an angular footprint of A at rest.
  const footprintMax = (psi, span) => {
    let radius = 0;
    for (let k = 1; k <= 24; k += 1) radius = Math.max(radius, profileRadiusAt(psi + span * k / 24));
    return radius;
  };
  // Driving, the nib's inner edge clears the next tooth's back under its
  // footprint while its end face spans the crest radius.
  const driveRadius = footprintMax(drivePsi0, nibAngle(0.93)) + toothClearance + nibHalfWidth;
  const relaxedNibRadius = ratchetOuterRadius + nibHalfWidth + 0.025;
  const escapeRadius = ratchetOuterRadius + nibHalfWidth + 0.004;
  const escapeSpan = THREE.MathUtils.degToRad(9);
  const relaxSpan = THREE.MathUtils.degToRad(10);
  const escapeStartPsi = driveEndPsi + escapeSpan;
  // C is a nearly straight strong leaf, as Brown draws it, from the block
  // towards A. Its deep part is straight: its inner edge is the line at
  // distance webDistance from A's centre, normal at the middle of the drive.
  const webDistance = driveRadius + nibHalfWidth + pressGap;
  const webNormalAngle = drivePsi0 - toothPitch / 2;
  const webInnerAt = (theta) => webDistance / Math.cos(theta - webNormalAngle);
  // The deep web ends where the nib's rear corner is at escape start; C
  // continues shallow (in A's front half) to its end in C's seat.
  const webEndTheta = escapeStartPsi + nibAngle(driveRadius);
  // The nib follows C's web: the web touches the highest point of the nib's
  // back under the deep web.
  const followRadius = (psi) => {
    const alpha = nibAngle(driveRadius);
    let radius = relaxedNibRadius;
    for (let k = 0; k <= 32; k += 1) {
      const theta = psi + alpha * k / 32;
      if (theta < webEndTheta - 1e-9 || Math.abs(theta - webNormalAngle) > 1.4) continue;
      radius = Math.min(radius, webInnerAt(theta) - nibHalfWidth - pressGap);
    }
    return radius;
  };
  const escapeFrom = followRadius(escapeStartPsi);
  // Nib radius for a front angle ψ in [driveEndPsi, driveEndPsi + 2π).
  const nibRadiusAt = (psi) => {
    const past = driveEndPsi + fullTurn - psi;
    if (past < relaxSpan) {
      return THREE.MathUtils.lerp(escapeRadius, relaxedNibRadius, smoothStep01(past / relaxSpan));
    }
    if (psi >= escapeStartPsi) return followRadius(psi);
    return THREE.MathUtils.lerp(escapeFrom, escapeRadius, smoothStep01((escapeStartPsi - psi) / escapeSpan));
  };
  let pressStartPsi = drivePsi0;
  while (followRadius(pressStartPsi) < relaxedNibRadius && pressStartPsi < drivePsi0 + 1.2) pressStartPsi += 0.0005;
  // Checks of the designed path: the pressed nib clears A's teeth, and its
  // end face spans the crest it drives from ψ0 to the escape.
  let pressToothMargin = Infinity;
  for (let k = 1; k <= 200; k += 1) {
    const psi = drivePsi0 + (pressStartPsi - drivePsi0) * k / 200;
    pressToothMargin = Math.min(pressToothMargin,
      nibRadiusAt(psi) - nibHalfWidth - footprintMax(psi, nibAngle(nibRadiusAt(psi))));
  }
  let driveCrestSpan = Infinity;
  for (let k = 0; k <= 200; k += 1) {
    const psi = drivePsi0 - (drivePsi0 - escapeStartPsi) * k / 200;
    const radius = nibRadiusAt(psi);
    driveCrestSpan = Math.min(driveCrestSpan, ratchetOuterRadius - (radius - nibHalfWidth), radius + nibHalfWidth - ratchetOuterRadius);
  }
  if (!(pressToothMargin > 0 && driveCrestSpan > 0)) {
    throw new RangeError(`movement 73 nib path fails: tooth margin ${pressToothMargin}, crest span ${driveCrestSpan}`);
  }

  // C's centre line: from the block's corner, joining the straight web, and
  // at the end curving in to its seat.
  const strongHalfWidth = stopPadRadius;
  const webNormal = new THREE.Vector3(Math.cos(webNormalAngle), Math.sin(webNormalAngle), 0);
  const webDirection = new THREE.Vector3(Math.sin(webNormalAngle), -Math.cos(webNormalAngle), 0); // clockwise
  const webLinePoint = (theta) => webNormal.clone().multiplyScalar(webDistance + strongHalfWidth)
    .addScaledVector(webDirection, (webDistance + strongHalfWidth) * Math.tan(theta - webNormalAngle) * -1);
  // C rises from the top right corner of Brown's hatched block, which
  // stands just clear of D's rim at the lower left.
  const strongSpringAnchor = new THREE.Vector3(-1.56, -1.14, 0);
  const webJoinTheta = pressStartPsi + THREE.MathUtils.degToRad(10);
  const webJoin = webLinePoint(webJoinTheta);
  const rootPoints = hermitePoints(
    strongSpringAnchor,
    webDirection.clone().multiplyScalar(strongSpringAnchor.distanceTo(webJoin)),
    webJoin,
    webDirection.clone().multiplyScalar(strongSpringAnchor.distanceTo(webJoin)),
    40,
  );
  const webCenter = Array.from({ length: 81 }, (_, index) => webLinePoint(
    THREE.MathUtils.lerp(webJoinTheta, webEndTheta, index / 80)));
  const stopCenter3 = new THREE.Vector3(restStopContact.center.x, restStopContact.center.y, 0);
  const hookStart = webCenter.at(-1);
  const hookEntry = (() => {
    // Arriving inward and a little clockwise, into the tooth space.
    const direction = stopPawlDirection.clone().negate().rotateAround(new THREE.Vector2(), 0.5);
    return new THREE.Vector3(direction.x, direction.y, 0);
  })();
  const hookPoints = hermitePoints(
    hookStart,
    webDirection.clone().multiplyScalar(hookStart.distanceTo(stopCenter3) * 1.1),
    stopCenter3,
    hookEntry.multiplyScalar(hookStart.distanceTo(stopCenter3) * 1.1),
    40,
  );
  const polylineLength = (points) => points.reduce(
    (length, point, index) => index ? length + point.distanceTo(points[index - 1]) : 0, 0);
  const strongRaw = [...rootPoints, ...webCenter.slice(1), ...hookPoints.slice(1)];
  const strongEven = evenPolyline(strongRaw, 257);
  const relaxedStrongPoints = strongEven.points;
  const webEndFraction = (polylineLength(rootPoints) + polylineLength(webCenter)) / strongEven.total;
  const webTaper = 0.004;
  const strongCurveAt = (tipCenter) => new ClampedTipLeafCurve(
    relaxedStrongPoints,
    new THREE.Vector3(tipCenter.x - stopCenter3.x, tipCenter.y - stopCenter3.y, 0),
    webEndFraction,
  );
  const strongZRangeAt = (u) => {
    const f = smoothStep01((u - webEndFraction) / webTaper);
    return [THREE.MathUtils.lerp(strongWebZ[0], strongTipZ[0], f), strongWebZ[1]];
  };
  const strongSpring = makeDynamicLeafSpring(strongCurveAt(restStopContact.center), {
    band: { zRangeAt: strongZRangeAt },
    color: PALETTE.muted,
    planeZ: 0,
    radius: strongHalfWidth,
    tubularSegments: 256,
  });
  strongSpring.userData.role = 'fixed-strong-press-and-stop-spring-C';
  strongSpring.userData.strongSpringC = true;
  // C's rounded end: a half-round of exactly the band's width and depth
  // on the band's square end, so the leaf simply ends round.
  const halfRound = new THREE.Shape();
  halfRound.absarc(0, 0, stopPadRadius, -Math.PI / 2, Math.PI / 2, false);
  halfRound.closePath();
  const halfRoundGeometry = new THREE.ExtrudeGeometry(halfRound, {
    bevelEnabled: false, curveSegments: 24, depth: strongTipZ[1] - strongTipZ[0],
  });
  halfRoundGeometry.translate(0, 0, strongTipZ[0]);
  const stopPad = new THREE.Mesh(halfRoundGeometry, strongSpring.userData.mesh.material);
  const stopPadZ = (strongTipZ[0] + strongTipZ[1]) / 2;
  const placeStopPad = (curve) => {
    const end = curve.getPoint(1);
    const tangent = curve.getTangent(1);
    stopPad.position.set(end.x, end.y, 0);
    stopPad.rotation.z = Math.atan2(tangent.y, tangent.x);
  };
  placeStopPad(strongSpring.userData.curve);
  stopPad.userData.radius = stopPadRadius;
  stopPad.userData.strongSpringStopTipC = true;
  stopPad.userData.role = 'rounded-end-of-strong-spring-C';
  strongSpring.add(stopPad);

  // --- D, the driving wheel, with B clamped to its face.
  const driver = makePlanarRotor();
  const driverRotor = driver.userData.rotor;
  const driverRadius = 1.5;
  const driverDepth = 0.18;
  const driverPlaneZ = -0.3;
  const driverBoreRadius = 0.15;
  const driverShape = new THREE.Shape();
  driverShape.absarc(0, 0, driverRadius, 0, fullTurn, false);
  const driverBore = new THREE.Path();
  driverBore.absarc(0, 0, driverBoreRadius, 0, fullTurn, true);
  driverShape.holes.push(driverBore);
  const driverGeometry = new THREE.ExtrudeGeometry(driverShape, {
    bevelEnabled: false,
    curveSegments: 96,
    depth: driverDepth,
  });
  driverGeometry.translate(0, 0, -driverDepth / 2);
  const driverBody = new THREE.Mesh(driverGeometry, matte(PALETTE.driver, { metalness: 0.08, roughness: 0.68 }));
  driverBody.position.z = driverPlaneZ;
  driverBody.userData.drivingWheelDBody = true;
  // D is a plain turning disc: it carries the shared quadrant cue.
  applyRotationIndicator(driverBody, { axis: 'z' });
  driverRotor.add(driverBody);
  // D turns loose on A's shaft; its sleeve stops short of A's back.
  const driverSleeve = new THREE.Mesh(
    makeAnnulusGeometry(driverBoreRadius + 0.025, 0.27, 0.34),
    matte(PALETTE.ink, { metalness: 0.24, roughness: 0.47 }),
  );
  driverSleeve.position.z = -0.29;
  driverSleeve.userData.hollowDriverSleeveD = true;
  driverRotor.add(driverSleeve);
  const driverIndicator = new THREE.Object3D();
  driverIndicator.position.set(0, -driverRadius * 0.72, driverPlaneZ + driverDepth / 2 + 0.04);
  driverIndicator.userData.driverRotationIndicator = true;
  driverRotor.add(driverIndicator);
  driver.userData.body = driverBody;
  driver.userData.indicator = driverIndicator;
  driver.userData.radius = driverRadius;
  driver.userData.role = 'continuous-clockwise-driving-wheel-D';
  driver.userData.sleeve = driverSleeve;
  const driverFace = driverPlaneZ + driverDepth / 2;

  // B in D's frame: clamped near D's rim, running clockwise along it and in
  // towards A, ending in the nib, whose front face is square to the leaf.
  // Relaxed, the nib stands just clear of A's crests.
  const catchTipAngle = 0; // B's front in D's frame
  const catchSpan = 1.3;
  const catchMountRadius = 1.3;
  const catchSamples = 96;
  const catchMount = new THREE.Vector3(
    Math.cos(catchTipAngle + catchSpan) * catchMountRadius,
    Math.sin(catchTipAngle + catchSpan) * catchMountRadius,
    0,
  );
  const catchTipRelaxed = new THREE.Vector3(relaxedNibRadius, 0, 0);
  const catchLength = catchSpan * 1.22;
  const relaxedCatchPoints = evenPolyline(hermitePoints(
    catchMount,
    new THREE.Vector3(Math.sin(catchTipAngle + catchSpan), -Math.cos(catchTipAngle + catchSpan), 0)
      .multiplyScalar(catchLength),
    catchTipRelaxed,
    new THREE.Vector3(0, -catchLength, 0),
    160,
  ), catchSamples + 1).points;
  // C's straight web bears along the whole back of the nib, so it holds the
  // nib square as well as pressing it in: B bends as a leaf clamped at D and
  // guided at the nib (deflection 3u^2 - 2u^3), and its square end face stays
  // radial, flat on the crest it drives.
  const catchCurveLocalAt = (nibRadius) => new GuidedLeafCurve(
    relaxedCatchPoints,
    new THREE.Vector3(nibRadius - relaxedNibRadius, 0, 0),
  );
  const catchTotalLength = relaxedCatchPoints.reduce(
    (length, point, index) => index ? length + point.distanceTo(relaxedCatchPoints[index - 1]) : 0, 0);
  const nibStartFraction = 1 - nibLength / catchTotalLength;
  const nibTaper = 0.012;
  const catchLeafHalfWidth = 0.05;
  const catchSpring = makeDynamicLeafSpring(catchCurveLocalAt(relaxedNibRadius), {
    band: {
      halfWidthAt: (u) => THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(catchLeafHalfWidth, 0.035, THREE.MathUtils.smoothstep(u, 0.4, 0.75)),
        nibHalfWidth,
        smoothStep01((u - (nibStartFraction - nibTaper)) / nibTaper),
      ),
      zRangeAt: (u) => [catchLeafZ[0], THREE.MathUtils.lerp(catchLeafZ[1], catchNibZ[1],
        smoothStep01((u - (nibStartFraction - nibTaper)) / nibTaper))],
    },
    color: PALETTE.brass,
    planeZ: 0,
    radius: 0.06,
    tubularSegments: 192,
  });
  catchSpring.userData.catchSpringB = true;
  catchSpring.userData.role = 'driver-carried-bent-catch-spring-B';
  driverRotor.add(catchSpring);
  const catchClamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.15, catchLeafZ[1] + 0.02 - driverFace),
    matte(PALETTE.ink, { metalness: 0.2, roughness: 0.5 }),
  );
  catchClamp.position.copy(catchMount).setZ((driverFace + catchLeafZ[1] + 0.02) / 2);
  catchClamp.rotation.z = catchTipAngle + catchSpan + Math.PI / 2;
  catchClamp.userData.catchSpringClamp = true;
  driverRotor.add(catchClamp);

  // Brown's small hatched block at lower left, with C rising from its
  // corner. Brown's hatching marks it as a cut solid; the model shows the
  // plain fixed block.
  const clampWidth = 1.0;
  const clampHeight = 1.1;
  const clampDepth = 0.26;
  const strongSpringClamp = new THREE.Mesh(
    new THREE.BoxGeometry(clampWidth, clampHeight, clampDepth),
    matte(PALETTE.frame, { metalness: 0.08, roughness: 0.8 }),
  );
  strongSpringClamp.position.copy(strongSpringAnchor)
    .add(new THREE.Vector3(0.045 - clampWidth / 2, 0.045 - clampHeight / 2, (strongWebZ[0] + strongWebZ[1]) / 2));
  strongSpringClamp.userData.fixedStrongSpringClamp = true;

  root.add(strongSpringClamp, driver, ratchetShaft, ratchet, strongSpring);

  // --- Motion. D turns clockwise at a constant rate. Each turn, B's nib
  // meets C's web, is pressed down into the space before face 1, drives A
  // exactly one pitch with the crest corner on its end face, escapes up the
  // end of the web as A's face comes round into C's space, and springs back
  // out; C's thin end rides over the tooth and drops in behind it.
  const driverAngularSpeed = 0.72;
  const driverCyclePeriod = fullTurn / driverAngularSpeed;
  // Brown draws B at rest with its clamp near the top of D and its end at
  // the right.
  const initialFrontAngle = THREE.MathUtils.degToRad(10);
  const boundaryEpsilon = 1e-12;
  const stageFor = (psi) => {
    if (driveEndPsi + fullTurn - psi < relaxSpan) return 'catch-spring-release';
    if (psi >= pressStartPsi) return 'ratchet-dwell';
    if (psi > drivePsi0) return 'strong-spring-press';
    if (psi >= driveEndPsi + escapeSpan) return 'catch-spring-index';
    return 'catch-spring-escape';
  };
  const stateAtTime = (time) => {
    const inputTravelAngle = driverAngularSpeed * time;
    // Front angle unwrapped, then measured within the cycle that ends at the
    // end of a drive (so the cycle index counts completed indexes).
    const front = initialFrontAngle - inputTravelAngle;
    const x = (front - driveEndPsi) / fullTurn;
    const nearest = Math.round(x);
    const coordinate = Math.abs(x - nearest) < boundaryEpsilon ? nearest : x;
    const turnsSinceDrive = Math.floor(coordinate);
    const psi = driveEndPsi + (coordinate - turnsSinceDrive) * fullTurn;
    const initialTurns = Math.floor((initialFrontAngle - driveEndPsi) / fullTurn);
    const completedIndexes = initialTurns - turnsSinceDrive;
    const driving = psi <= drivePsi0 + boundaryEpsilon;
    const eventAngle = driving ? drivePsi0 - psi : 0;
    const drivenAngle = -(completedIndexes * toothPitch + eventAngle);
    const stage = stageFor(psi);
    const indexing = driving;
    const nibRadius = nibRadiusAt(psi);
    const driverAngle = front - catchTipAngle;
    const catchCurveLocal = catchCurveLocalAt(nibRadius);
    const stopContact = stopContactAtDrivenAngle(drivenAngle);
    const strongCurve = strongCurveAt(stopContact.center);
    const pressing = psi < pressStartPsi;
    const activeToothIndex = THREE.MathUtils.euclideanModulo(completedIndexes + 1, toothCount);
    const crest = ratchet.userData.toothFaces[activeToothIndex].outer.clone()
      .rotateAround(new THREE.Vector2(), drivenAngle);
    return {
      activeToothIndex,
      completedIndexes,
      crest,
      cycleCoordinate: coordinate,
      drivenAngle,
      drivenAngularSpeed: indexing ? -driverAngularSpeed : 0,
      driverActualAngularSpeed: -driverAngularSpeed,
      driverAngle,
      driverInputRevolutions: inputTravelAngle / fullTurn,
      eventFraction: eventAngle / toothPitch,
      indexing,
      inputTravelAngle,
      nibFrontAngle: psi,
      nibRadius,
      catchCurveLocal,
      catchSpringDeflection: (relaxedNibRadius - nibRadius) / (relaxedNibRadius - driveRadius),
      catchToothContactEngaged: indexing,
      ratchetLocked: !indexing,
      ratchetTeethAdvanced: -drivenAngle / toothPitch,
      stage,
      stopContact,
      stopContactEngaged: true,
      stopMode: indexing ? 'riding-next-tooth' : 'holding-ratchet',
      strongCurve,
      strongSpringPressEngaged: pressing,
    };
  };

  root.userData.mechanism = 'spring-pressed-eleven-tooth-ratchet-index';
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.52, -2.3, -0.59),
    new THREE.Vector3(1.5, 1.5, 0.75),
  );
  root.userData.hideGround = true;
  // One turn of D takes at least 10 s on screen, so the press, the
  // one-tooth index and the escape each read (the index lasts about 1 s).
  root.userData.minimumDisplayCycleSeconds = 10;
  root.userData.blocks = {
    catchClamp,
    catchSpring,
    driver,
    driverBody,
    driverIndicator,
    driverSleeve,
    ratchet,
    ratchetBody,
    ratchetIndicator,
    ratchetShaft,
    stopPad,
    strongSpring,
    strongSpringClamp,
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    catchLeafZ,
    catchMount,
    catchNibZ,
    catchSpan,
    catchTipAngle,
    driveEndPsi,
    drivePsi0,
    driveRadius,
    driverAngularSpeed,
    driverBoreRadius,
    driverCyclePeriod,
    driverDepth,
    driverPlaneZ,
    driverRadius,
    escapeRadius,
    escapeSpan,
    fullTurn,
    nibAngularLength: nibAngle(driveRadius),
    nibHalfWidth,
    nibLength,
    pressGap,
    pressStartPsi,
    ratchetDepth,
    ratchetMountPhase,
    ratchetOuterRadius,
    ratchetPlaneZ,
    ratchetRootRadius,
    relaxedNibRadius,
    relaxSpan,
    restStopContact,
    stopFaceFraction,
    stopFaceWorldAngle,
    stopPadRadius,
    stopPawlDirection,
    strongHalfWidth,
    strongSpringAnchor,
    strongTipZ,
    strongWebZ,
    toothClearance,
    toothCount,
    toothOuterEndPhase,
    toothOuterStartPhase,
    toothPitch,
    driveCrestSpan,
    escapeStartPsi,
    pressToothMargin,
    webDistance,
    webEndFraction,
    webEndTheta,
    webNormalAngle,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.stopContactAtDrivenAngle = stopContactAtDrivenAngle;
  root.userData.nibRadiusAt = nibRadiusAt;
  root.userData.webInnerAt = webInnerAt;
  root.userData.profileRadiusAt = profileRadiusAt;
  root.userData.reconstructionNote = 'B is a flat leaf clamped to D\'s face behind A; its square-ended nib reaches forward into A\'s back half. C is fixed: its deep web bears on the back of the nib and presses it into the space before a tooth, the nib drives that tooth one pitch by its crest, then escapes up the end of the web and springs back out. C\'s thin end, in A\'s front half, is the stop: it rides over the tooth and drops in behind it. The nib path is designed from A\'s teeth and C\'s web is its envelope, so the press is a kinematic contact, not a force solution.';

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(driver, state.driverAngle);
    setSpin(ratchet, state.drivenAngle);
    setSpin(ratchetShaft, state.drivenAngle);
    catchSpring.userData.setCurve(state.catchCurveLocal);
    strongSpring.userData.setCurve(state.strongCurve);
    placeStopPad(state.strongCurve);
    root.userData.contacts = {
      catchTooth: {
        engaged: state.catchToothContactEngaged,
        toothIndex: state.activeToothIndex,
        toothPoint: state.catchToothContactEngaged
          ? new THREE.Vector3(state.crest.x, state.crest.y, (catchNibZ[1] + ratchetBack) / 2) : null,
      },
      springPress: { engaged: state.strongSpringPressEngaged },
      strongStop: {
        engaged: state.stopContactEngaged,
        error: state.stopContact.contactError,
        mode: state.stopMode,
        normal: state.stopContact.normal.clone(),
        padPoint: new THREE.Vector3(state.stopContact.padPoint.x, state.stopContact.padPoint.y, stopPadZ),
        ratchetPoint: new THREE.Vector3(state.stopContact.contactPoint.x, state.stopContact.contactPoint.y, stopPadZ),
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(1.3, 1.0, 12.4));
}





function opposedTreadleAlternatingPawlRatchet() {
  const root = new THREE.Group();
  const origin = new THREE.Vector2();
  const fullTurn = Math.PI * 2;
  const toothCount = 30;
  const toothPitch = fullTurn / toothCount;
  const teethPerHalfStroke = 4;
  const teethPerCycle = teethPerHalfStroke * 2;
  const armSwing = teethPerHalfStroke * toothPitch;
  const cyclesPerSecond = 0.22;
  const initialCyclePhase = 0.12;

  const wheelCenter = new THREE.Vector2(-1.05, 1);
  const treadlePivot = new THREE.Vector2(-2.5, -1.55);
  const armRadius = 1.9;
  const treadleRodJointRadius = 3;
  const neutralArmJoint = wheelCenter.clone().add(
    new THREE.Vector2(armRadius, 0),
  );
  const neutralTreadleJoint = treadlePivot.clone().add(
    new THREE.Vector2(treadleRodJointRadius, 0),
  );
  const connectingRodLength = neutralArmJoint.distanceTo(
    neutralTreadleJoint,
  );

  const armAngleAtTreadle = (treadleAngle) => {
    const treadleJoint = treadlePivot.clone().add(
      new THREE.Vector2(
        Math.cos(treadleAngle),
        Math.sin(treadleAngle),
      ).multiplyScalar(treadleRodJointRadius),
    );
    const centerVector = treadleJoint.clone().sub(wheelCenter);
    const centerDistance = centerVector.length();
    const along = (
      armRadius ** 2
        - connectingRodLength ** 2
        + centerDistance ** 2
    ) / (2 * centerDistance);
    const perpendicular = Math.sqrt(Math.max(
      0,
      armRadius ** 2 - along ** 2,
    ));
    const unit = centerVector.clone().divideScalar(centerDistance);
    const base = wheelCenter.clone().addScaledVector(unit, along);
    const normal = new THREE.Vector2(-unit.y, unit.x);
    const candidates = [
      base.clone().addScaledVector(normal, perpendicular),
      base.clone().addScaledVector(normal, -perpendicular),
    ];
    const angles = candidates.map((point) => Math.atan2(
      point.y - wheelCenter.y,
      point.x - wheelCenter.x,
    ));
    return Math.abs(angles[0]) <= Math.abs(angles[1])
      ? angles[0]
      : angles[1];
  };
  let amplitudeLow = 0.01;
  let amplitudeHigh = 0.4;
  for (let iteration = 0; iteration < 72; iteration += 1) {
    const candidate = (amplitudeLow + amplitudeHigh) / 2;
    const candidateSwing = armAngleAtTreadle(candidate)
      - armAngleAtTreadle(-candidate);
    if (candidateSwing < armSwing) amplitudeLow = candidate;
    else amplitudeHigh = candidate;
  }
  const treadleAmplitude = (amplitudeLow + amplitudeHigh) / 2;
  const highArmAngle = armAngleAtTreadle(treadleAmplitude);
  const lowArmAngle = armAngleAtTreadle(-treadleAmplitude);
  const armEndpointAt = (angle) => wheelCenter.clone().add(
    new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(
      armRadius,
    ),
  );
  const treadleJointAt = (angle) => treadlePivot.clone().add(
    new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(
      treadleRodJointRadius,
    ),
  );
  const armDerivativeAtTreadle = (treadleAngle, armAngle) => {
    const armJoint = armEndpointAt(armAngle);
    const treadleJoint = treadleJointAt(treadleAngle);
    const rodVector = armJoint.clone().sub(treadleJoint);
    const armTangent = new THREE.Vector2(
      -Math.sin(armAngle),
      Math.cos(armAngle),
    );
    const treadleTangent = new THREE.Vector2(
      -Math.sin(treadleAngle),
      Math.cos(treadleAngle),
    );
    return treadleRodJointRadius * rodVector.dot(treadleTangent)
      / (armRadius * rodVector.dot(armTangent));
  };

  const ratchetRootRadius = 1.28;
  const ratchetOuterRadius = 1.58;
  const toothOuterStartPhase = 0.12;
  const toothOuterEndPhase = 0.42;
  const driveFaceFraction = 0.02;
  const driveContactWorldAngle = 0.45;
  const baseFaceOuter = new THREE.Vector2(
    Math.cos(toothOuterEndPhase * toothPitch) * ratchetOuterRadius,
    Math.sin(toothOuterEndPhase * toothPitch) * ratchetOuterRadius,
  );
  const baseFaceRoot = new THREE.Vector2(
    Math.cos(toothPitch) * ratchetRootRadius,
    Math.sin(toothPitch) * ratchetRootRadius,
  );
  const unmountedDrivePoint = baseFaceOuter.clone().lerp(
    baseFaceRoot,
    driveFaceFraction,
  );
  const ratchetMountPhase = driveContactWorldAngle - Math.atan2(
    unmountedDrivePoint.y,
    unmountedDrivePoint.x,
  );
  const ratchetDepth = 0.28;
  const ratchetPlaneZ = 0.02;
  const ratchet = makeSpringIndexedRatchet({
    boreRadius: 0.22,
    depth: ratchetDepth,
    mountPhase: ratchetMountPhase,
    outerRadius: ratchetOuterRadius,
    rootRadius: ratchetRootRadius,
    teeth: toothCount,
    toothOuterEndPhase,
    toothOuterStartPhase,
  });
  ratchet.position.set(wheelCenter.x, wheelCenter.y, ratchetPlaneZ);
  ratchet.userData.role = 'clockwise-nearly-continuous-ratchet-wheel-A';
  const ratchetBody = ratchet.userData.body;
  const ratchetHub = ratchet.userData.hub;
  const ratchetIndicator = ratchet.userData.indicator;
  const ratchetShaft = makeShaft({ length: 1.55, radius: 0.11 });
  ratchetShaft.position.set(wheelCenter.x, wheelCenter.y, 0.49);
  ratchetShaft.userData.radius = 0.11;
  ratchetShaft.userData.role = 'clockwise-output-shaft-of-ratchet-A';
  const driveFace = ratchet.userData.toothFaces[0];
  const drivePointLocal = driveFace.outer.clone().lerp(
    driveFace.root,
    driveFaceFraction,
  );
  const contactOrbitRadius = drivePointLocal.length();
  const highArmEndpoint = armEndpointAt(highArmAngle);
  const initialContactPoint = wheelCenter.clone().add(drivePointLocal);
  const pawlLength = highArmEndpoint.distanceTo(initialContactPoint);
  const basePawlAngle = Math.atan2(
    initialContactPoint.y - highArmEndpoint.y,
    initialContactPoint.x - highArmEndpoint.x,
  );
  const resetPawlSwing = -3;

  const pulleyPitchRadius = 0.32;
  const pulleyCenter = new THREE.Vector3(1.1, 0, 0.66);
  const rearPlaneZ = pulleyCenter.z - pulleyPitchRadius;
  const frontPlaneZ = pulleyCenter.z + pulleyPitchRadius;
  const armDepth = 0.14;
  const makeVibratingArm = (planeZ, role) => {
    const arm = makePlanarRotor();
    const rotor = arm.userData.rotor;
    arm.position.set(wheelCenter.x, wheelCenter.y, planeZ);
    arm.userData.role = role;
    const body = makeBeam(
      new THREE.Vector3(0.12, 0, 0),
      new THREE.Vector3(armRadius, 0, 0),
      { color: PALETTE.driver, depth: armDepth, thickness: 0.16 },
    );
    body.userData.vibratingRadialArmB = true;
    rotor.add(body);
    const centerHub = new THREE.Mesh(
      makeAnnulusGeometry(0.115, 0.24, armDepth * 1.35),
      matte(PALETTE.driver, { metalness: 0.13, roughness: 0.58 }),
    );
    centerHub.userData.armHubOnRatchetShaft = true;
    rotor.add(centerHub);
    const outerJoint = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.034, 8, 30),
      matte(PALETTE.white, { roughness: 0.49 }),
    );
    outerJoint.position.set(armRadius, 0, armDepth * 0.62);
    outerJoint.userData.armRodAndPawlJoint = true;
    rotor.add(outerJoint);
    const indicator = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.05, 0.025),
      matte(PALETTE.white, { roughness: 0.48 }),
    );
    indicator.position.set(armRadius * 0.63, 0, armDepth * 0.63);
    indicator.userData.armVibrationIndicator = true;
    rotor.add(indicator);
    arm.userData.body = body;
    arm.userData.centerHub = centerHub;
    arm.userData.indicator = indicator;
    arm.userData.outerJoint = outerJoint;
    return arm;
  };
  const rearArm = makeVibratingArm(
    rearPlaneZ,
    'rear-vibrating-radial-arm-B',
  );
  const frontArm = makeVibratingArm(
    frontPlaneZ,
    'front-vibrating-radial-arm-B',
  );

  const pawlDepth = 0.14;
  const ratchetContactZ = ratchetPlaneZ + ratchetDepth / 2 - 0.002;
  const catchDepthAt = (planeZ) => (
    planeZ - pawlDepth / 2 + 0.012 - ratchetContactZ
  );
  const rearPawl = makePullingRatchetPawl({
    catchDepth: catchDepthAt(rearPlaneZ),
    depth: pawlDepth,
    length: pawlLength,
    role: 'rear-alternating-pawl-on-arm-B',
  });
  const frontPawl = makePullingRatchetPawl({
    catchDepth: catchDepthAt(frontPlaneZ),
    depth: pawlDepth,
    length: pawlLength,
    role: 'front-alternating-pawl-on-arm-B',
  });

  const makeTreadle = (planeZ, role) => {
    const treadle = makePlanarRotor();
    const rotor = treadle.userData.rotor;
    treadle.position.set(treadlePivot.x, treadlePivot.y, planeZ);
    treadle.userData.role = role;
    const body = makeBeam(
      new THREE.Vector3(0.08, 0, 0),
      new THREE.Vector3(4.18, 0, 0),
      { color: PALETTE.driver, depth: 0.14, thickness: 0.14 },
    );
    body.userData.treadleDLever = true;
    rotor.add(body);
    const footPad = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.34, 0.2),
      matte(PALETTE.driver, { metalness: 0.08, roughness: 0.69 }),
    );
    footPad.position.set(4.02, 0.05, 0.02);
    footPad.userData.footPadD = true;
    rotor.add(footPad);
    const rodJoint = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.032, 8, 28),
      matte(PALETTE.white, { roughness: 0.49 }),
    );
    rodJoint.position.set(
      treadleRodJointRadius,
      0,
      armDepth * 0.62,
    );
    rodJoint.userData.connectingRodJointOnTreadleD = true;
    rotor.add(rodJoint);
    const strapOffset = pulleyCenter.x - treadlePivot.x;
    const minimumSlotCoordinate = strapOffset;
    const maximumSlotCoordinate = strapOffset
      / Math.cos(treadleAmplitude);
    const slotLength = maximumSlotCoordinate
      - minimumSlotCoordinate + 0.34;
    const strapSlot = new THREE.Mesh(
      new THREE.BoxGeometry(slotLength, 0.052, 0.026),
      matte(PALETTE.ink, { metalness: 0.18, roughness: 0.53 }),
    );
    strapSlot.position.set(
      (minimumSlotCoordinate + maximumSlotCoordinate) / 2,
      0,
      0.086,
    );
    strapSlot.userData.longitudinalStrapPinSlot = true;
    rotor.add(strapSlot);
    treadle.userData.body = body;
    treadle.userData.footPad = footPad;
    treadle.userData.rodJoint = rodJoint;
    treadle.userData.strapSlot = strapSlot;
    return treadle;
  };
  const rearTreadle = makeTreadle(rearPlaneZ, 'rear-treadle-D');
  const frontTreadle = makeTreadle(frontPlaneZ, 'front-treadle-D');
  const treadleShaft = makeShaft({ length: 1.25, radius: 0.1 });
  treadleShaft.position.set(treadlePivot.x, treadlePivot.y, 0.66);
  treadleShaft.userData.fixedPivot = true;
  treadleShaft.userData.role = 'common-fixed-fulcrum-for-two-treadles-D';

  const rearConnectingRod = makeDynamicLink({
    color: PALETTE.ink,
    depth: 0.11,
    jointRadius: 0.105,
    thickness: 0.095,
  });
  rearConnectingRod.userData.role = 'rear-rigid-link-D-to-B';
  rearConnectingRod.userData.rigidConnectingRod = true;
  const frontConnectingRod = makeDynamicLink({
    color: PALETTE.ink,
    depth: 0.11,
    jointRadius: 0.105,
    thickness: 0.095,
  });
  frontConnectingRod.userData.role = 'front-rigid-link-D-to-B';
  frontConnectingRod.userData.rigidConnectingRod = true;

  const rearStrapPin = makeShaft({ length: 0.23, radius: 0.08 });
  rearStrapPin.userData.slidingStrapPinOnTreadleD = true;
  rearStrapPin.userData.role = 'rear-strap-attachment-to-treadle-D';
  const frontStrapPin = makeShaft({ length: 0.23, radius: 0.08 });
  frontStrapPin.userData.slidingStrapPinOnTreadleD = true;
  frontStrapPin.userData.role = 'front-strap-attachment-to-treadle-D';
  const rearPinRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.11, 0.027, 8, 28),
    matte(PALETTE.white, { roughness: 0.49 }),
  );
  rearPinRing.userData.strapAttachmentIndicator = true;
  const frontPinRing = rearPinRing.clone();
  frontPinRing.userData.strapAttachmentIndicator = true;

  const pulley = makePulley({
    axis: new THREE.Vector3(1, 0, 0),
    color: PALETTE.accent,
    grooves: 1,
    radius: 0.36,
    spokes: 5,
    width: 0.34,
  });
  pulley.position.copy(pulleyCenter);
  pulley.userData.pitchRadius = pulleyPitchRadius;
  pulley.userData.role = 'edge-on-equalizing-pulley-C';
  const pulleyShaft = makeShaft({
    axis: new THREE.Vector3(1, 0, 0),
    length: 0.9,
    radius: 0.075,
  });
  pulleyShaft.position.copy(pulleyCenter);
  pulleyShaft.userData.role = 'fixed-axis-of-pulley-C';
  const couplingStrap = makeDynamicCable({
    color: PALETTE.belt,
    maxSegments: 24,
    radius: 0.037,
  });
  couplingStrap.userData.couplingStrap = true;
  couplingStrap.userData.isBelt = true;
  couplingStrap.userData.role = 'single-continuous-strap-over-pulley-C';

  const frameZ = -0.36;
  const baseY = -2.83;
  const baseRail = makeBeam(
    new THREE.Vector3(-3.12, baseY, frameZ),
    new THREE.Vector3(1.82, baseY, frameZ),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.18 },
  );
  baseRail.userData.fixedBaseRail = true;
  const wheelPost = makeBeam(
    new THREE.Vector3(wheelCenter.x, baseY, frameZ),
    new THREE.Vector3(wheelCenter.x, wheelCenter.y, frameZ),
    { color: PALETTE.frame, depth: 0.21, thickness: 0.17 },
  );
  wheelPost.userData.fixedWheelPost = true;
  const wheelBearingBridge = makeBeam(
    new THREE.Vector3(wheelCenter.x - 0.42, wheelCenter.y, frameZ),
    new THREE.Vector3(wheelCenter.x + 0.42, wheelCenter.y, frameZ),
    { color: PALETTE.frame, depth: 0.2, thickness: 0.15 },
  );
  wheelBearingBridge.userData.fixedWheelBearingBridge = true;
  const wheelBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.26, 0.055, 9, 40),
    matte(PALETTE.frame, { metalness: 0.16, roughness: 0.6 }),
  );
  wheelBearing.position.set(wheelCenter.x, wheelCenter.y, 1.28);
  wheelBearing.userData.fixedWheelBearing = true;
  const treadlePedestalLeft = makeBeam(
    new THREE.Vector3(treadlePivot.x - 0.42, baseY, frameZ),
    new THREE.Vector3(treadlePivot.x, treadlePivot.y, frameZ),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.17 },
  );
  const treadlePedestalRight = makeBeam(
    new THREE.Vector3(treadlePivot.x + 0.42, baseY, frameZ),
    new THREE.Vector3(treadlePivot.x, treadlePivot.y, frameZ),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.17 },
  );
  treadlePedestalLeft.userData.fixedTreadlePedestal = true;
  treadlePedestalRight.userData.fixedTreadlePedestal = true;
  const pulleyPosts = [-1, 1].map((sign, index) => {
    const post = makeBeam(
      new THREE.Vector3(
        pulleyCenter.x + sign * 0.28,
        baseY,
        pulleyCenter.z,
      ),
      new THREE.Vector3(
        pulleyCenter.x + sign * 0.28,
        pulleyCenter.y,
        pulleyCenter.z,
      ),
      { color: PALETTE.frame, depth: 0.18, thickness: 0.14 },
    );
    post.userData.fixedPulleyCPost = true;
    post.userData.index = index;
    return post;
  });
  const cameraFitGuides = [
    new THREE.Vector3(-3.35, 2.82, 0.45),
    new THREE.Vector3(2.02, -2.82, 0.66),
  ].map((position, index) => {
    const guide = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 6),
      new THREE.MeshBasicMaterial({
        color: PALETTE.paper,
        depthWrite: false,
        opacity: 0,
        transparent: true,
      }),
    );
    guide.position.copy(position);
    guide.castShadow = false;
    guide.receiveShadow = false;
    guide.userData.cameraFitGuide = true;
    guide.userData.index = index;
    return guide;
  });

  root.add(
    baseRail,
    wheelPost,
    wheelBearingBridge,
    wheelBearing,
    treadlePedestalLeft,
    treadlePedestalRight,
    ...pulleyPosts,
    ratchet,
    ratchetShaft,
    rearArm,
    frontArm,
    rearPawl,
    frontPawl,
    rearTreadle,
    frontTreadle,
    treadleShaft,
    rearConnectingRod,
    frontConnectingRod,
    rearStrapPin,
    frontStrapPin,
    rearPinRing,
    frontPinRing,
    pulley,
    pulleyShaft,
    couplingStrap,
    ...cameraFitGuides,
  );

  const pointInsideRatchet = (point) => {
    const profile = ratchet.userData.profilePoints;
    let inside = false;
    for (
      let index = 0, previousIndex = profile.length - 1;
      index < profile.length;
      previousIndex = index, index += 1
    ) {
      const current = profile[index];
      const previous = profile[previousIndex];
      if (
        (current.y > point.y) !== (previous.y > point.y)
        && point.x < (previous.x - current.x)
          * (point.y - current.y) / (previous.y - current.y) + current.x
      ) inside = !inside;
    }
    return inside;
  };
  const closestRatchetProfilePoint = (point) => {
    const profile = ratchet.userData.profilePoints;
    let distance = Infinity;
    let pointOnProfile = null;
    let segmentIndex = -1;
    for (let index = 0; index < profile.length; index += 1) {
      const start = profile[index];
      const end = profile[(index + 1) % profile.length];
      const edge = end.clone().sub(start);
      const denominator = edge.lengthSq();
      const fraction = denominator < 1e-18
        ? 0
        : THREE.MathUtils.clamp(
          point.clone().sub(start).dot(edge) / denominator,
          0,
          1,
        );
      const candidate = start.clone().addScaledVector(edge, fraction);
      const candidateDistance = point.distanceTo(candidate);
      if (candidateDistance < distance) {
        distance = candidateDistance;
        pointOnProfile = candidate;
        segmentIndex = index;
      }
    }
    return { distance, point: pointOnProfile, segmentIndex };
  };
  const profileClearanceAt = (worldPoint, wheelAngle) => {
    const localPoint = worldPoint.clone().sub(wheelCenter).rotateAround(
      origin,
      -wheelAngle,
    );
    const closest = closestRatchetProfilePoint(localPoint);
    const inside = pointInsideRatchet(localPoint);
    return {
      clearance: closest.distance < 1e-10
        ? 0
        : (inside ? -closest.distance : closest.distance),
      inside,
      localPoint,
      localProfilePoint: closest.point,
      profilePoint: closest.point.clone().rotateAround(
        origin,
        wheelAngle,
      ).add(wheelCenter),
      segmentIndex: closest.segmentIndex,
    };
  };
  const pawlTipAt = (anchor, angle) => anchor.clone().add(
    new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(
      pawlLength,
    ),
  );
  const strapYAt = (treadleAngle) => treadlePivot.y
    + (pulleyCenter.x - treadlePivot.x) * Math.tan(treadleAngle);
  const cablePointsAt = (frontY, rearY) => {
    const points = [
      new THREE.Vector3(
        pulleyCenter.x,
        frontY,
        frontPlaneZ,
      ),
    ];
    const arcSegments = 16;
    for (let index = 0; index <= arcSegments; index += 1) {
      const angle = index * Math.PI / arcSegments;
      points.push(new THREE.Vector3(
        pulleyCenter.x,
        pulleyCenter.y + pulleyPitchRadius * Math.sin(angle),
        pulleyCenter.z + pulleyPitchRadius * Math.cos(angle),
      ));
    }
    points.push(new THREE.Vector3(
      pulleyCenter.x,
      rearY,
      rearPlaneZ,
    ));
    return points;
  };

  const stateAtCycleCoordinate = (cycleCoordinate) => {
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const frontDriving = cyclePhase < 0.5;
    const halfFraction = frontDriving
      ? cyclePhase * 2
      : (cyclePhase - 0.5) * 2;
    const easedHalfFraction = smoothStep01(halfFraction);
    const easeDerivative = 6 * halfFraction * (1 - halfFraction);
    const frontTreadleAngle = frontDriving
      ? THREE.MathUtils.lerp(
        treadleAmplitude,
        -treadleAmplitude,
        easedHalfFraction,
      )
      : THREE.MathUtils.lerp(
        -treadleAmplitude,
        treadleAmplitude,
        easedHalfFraction,
      );
    const frontTreadleAngularSpeed = (frontDriving ? -1 : 1)
      * 2 * treadleAmplitude * easeDerivative * 2 * cyclesPerSecond;
    const rearTreadleAngle = -frontTreadleAngle;
    const rearTreadleAngularSpeed = -frontTreadleAngularSpeed;
    const frontArmAngle = armAngleAtTreadle(frontTreadleAngle);
    const rearArmAngle = armAngleAtTreadle(rearTreadleAngle);
    const frontArmAngularSpeed = armDerivativeAtTreadle(
      frontTreadleAngle,
      frontArmAngle,
    ) * frontTreadleAngularSpeed;
    const rearArmAngularSpeed = armDerivativeAtTreadle(
      rearTreadleAngle,
      rearArmAngle,
    ) * rearTreadleAngularSpeed;
    const wheelAngle = -cycleIndex * 2 * armSwing + (frontDriving
      ? frontArmAngle - highArmAngle
      : -armSwing + rearArmAngle - highArmAngle);
    const wheelAngularSpeed = frontDriving
      ? frontArmAngularSpeed
      : rearArmAngularSpeed;
    const activePhysicalToothIndex = cycleIndex * teethPerCycle
      + (frontDriving ? 0 : teethPerHalfStroke);
    const activeToothIndex = THREE.MathUtils.euclideanModulo(
      activePhysicalToothIndex,
      toothCount,
    );
    const activeToothLocalPoint = drivePointLocal.clone().rotateAround(
      origin,
      activePhysicalToothIndex * toothPitch,
    );
    const activeToothPoint = activeToothLocalPoint.clone().rotateAround(
      origin,
      wheelAngle,
    ).add(wheelCenter);
    const frontAnchor = armEndpointAt(frontArmAngle);
    const rearAnchor = armEndpointAt(rearArmAngle);
    const resetAngle = THREE.MathUtils.lerp(
      basePawlAngle - armSwing,
      basePawlAngle,
      easedHalfFraction,
    ) + resetPawlSwing * Math.sin(Math.PI * halfFraction) ** 2;
    const frontPawlAngle = frontDriving
      ? basePawlAngle + frontArmAngle - highArmAngle
      : resetAngle;
    const rearPawlAngle = frontDriving
      ? resetAngle
      : basePawlAngle + rearArmAngle - highArmAngle;
    const frontTip = pawlTipAt(frontAnchor, frontPawlAngle);
    const rearTip = pawlTipAt(rearAnchor, rearPawlAngle);
    const frontProfileContact = profileClearanceAt(
      frontTip,
      wheelAngle,
    );
    const rearProfileContact = profileClearanceAt(rearTip, wheelAngle);
    const activeAnchor = frontDriving ? frontAnchor : rearAnchor;
    const activeArmAngle = frontDriving ? frontArmAngle : rearArmAngle;
    const activePawlVector = activeToothPoint.clone().sub(activeAnchor);
    const activeContactRelative = activeToothPoint.clone().sub(wheelCenter);
    const activeContactVelocity = new THREE.Vector2(
      -activeContactRelative.y,
      activeContactRelative.x,
    ).multiplyScalar(wheelAngularSpeed);
    const activeAnchorRelative = activeAnchor.clone().sub(wheelCenter);
    const activeAnchorVelocity = new THREE.Vector2(
      -activeAnchorRelative.y,
      activeAnchorRelative.x,
    ).multiplyScalar(wheelAngularSpeed);
    const reconstructedTipVelocity = activeAnchorVelocity.clone().add(
      new THREE.Vector2(
        -activePawlVector.y,
        activePawlVector.x,
      ).multiplyScalar(wheelAngularSpeed),
    );
    const pullDirection = activeAnchor.clone().sub(
      activeToothPoint,
    ).normalize();
    const pullTorque = activeContactRelative.x * pullDirection.y
      - activeContactRelative.y * pullDirection.x;
    const frontRodTop = frontAnchor;
    const rearRodTop = rearAnchor;
    const frontRodBottom = treadleJointAt(frontTreadleAngle);
    const rearRodBottom = treadleJointAt(rearTreadleAngle);
    const frontStrapY = strapYAt(frontTreadleAngle);
    const rearStrapY = strapYAt(rearTreadleAngle);
    const frontStrapSpeed = (
      pulleyCenter.x - treadlePivot.x
    ) / Math.cos(frontTreadleAngle) ** 2 * frontTreadleAngularSpeed;
    const rearStrapSpeed = -frontStrapSpeed;
    const pulleyAngle = -(frontStrapY - treadlePivot.y)
      / pulleyPitchRadius;
    const pulleyAngularSpeed = -frontStrapSpeed / pulleyPitchRadius;
    const cableLength = pulleyCenter.y - frontStrapY
      + pulleyCenter.y - rearStrapY
      + Math.PI * pulleyPitchRadius;
    const frontStrapSlotCoordinate = (
      pulleyCenter.x - treadlePivot.x
    ) / Math.cos(frontTreadleAngle);
    const rearStrapSlotCoordinate = (
      pulleyCenter.x - treadlePivot.x
    ) / Math.cos(rearTreadleAngle);
    return {
      activeArmAngle,
      activeClockwisePullTorque: -pullTorque,
      activeContactVelocity,
      activePawl: frontDriving ? 'front' : 'rear',
      activePhysicalToothIndex,
      activeToothIndex,
      activeToothLocalPoint,
      activeToothPoint,
      cableLength,
      cablePoints: cablePointsAt(frontStrapY, rearStrapY),
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      easedHalfFraction,
      frontAnchor,
      frontArmAngle,
      frontArmAngularSpeed,
      frontDriving,
      frontPawlAngle,
      frontPawlLengthError: Math.abs(
        frontAnchor.distanceTo(frontTip) - pawlLength,
      ),
      frontProfileClearance: frontProfileContact.clearance,
      frontProfileContact,
      frontRodBottom,
      frontRodLengthError: Math.abs(
        frontRodBottom.distanceTo(frontRodTop) - connectingRodLength,
      ),
      frontRodTop,
      frontStrapSlotCoordinate,
      frontStrapSpeed,
      frontStrapY,
      frontTip,
      frontTreadleAngle,
      frontTreadleAngularSpeed,
      halfFraction,
      inputReversing: Math.abs(frontTreadleAngularSpeed) < 1e-12,
      pitchesAdvancedClockwise: -wheelAngle / toothPitch,
      pulleyAngle,
      pulleyAngularSpeed,
      pulleyFrontNoSlipError: Math.abs(
        -pulleyAngularSpeed * pulleyPitchRadius - frontStrapSpeed,
      ),
      pulleyRearNoSlipError: Math.abs(
        pulleyAngularSpeed * pulleyPitchRadius - rearStrapSpeed,
      ),
      rearAnchor,
      rearArmAngle,
      rearArmAngularSpeed,
      rearDriving: !frontDriving,
      rearPawlAngle,
      rearPawlLengthError: Math.abs(
        rearAnchor.distanceTo(rearTip) - pawlLength,
      ),
      rearProfileClearance: rearProfileContact.clearance,
      rearProfileContact,
      rearRodBottom,
      rearRodLengthError: Math.abs(
        rearRodBottom.distanceTo(rearRodTop) - connectingRodLength,
      ),
      rearRodTop,
      rearStrapSlotCoordinate,
      rearStrapSpeed,
      rearStrapY,
      rearTip,
      rearTreadleAngle,
      rearTreadleAngularSpeed,
      stage: frontDriving
        ? 'front-treadle-D-descends-front-pawl-drives-rear-resets'
        : 'rear-treadle-D-descends-rear-pawl-drives-front-resets',
      strapLengthError: Math.abs(
        cableLength - (
          2 * (pulleyCenter.y - treadlePivot.y)
            + Math.PI * pulleyPitchRadius
        ),
      ),
      treadleOppositionError: Math.abs(
        frontTreadleAngle + rearTreadleAngle,
      ),
      activeTipVelocityError: reconstructedTipVelocity.distanceTo(
        activeContactVelocity,
      ),
      toothContactError: (frontDriving ? frontTip : rearTip).distanceTo(
        activeToothPoint,
      ),
      wheelAngle,
      wheelAngularSpeed,
    };
  };
  const stateAtTime = (time) => stateAtCycleCoordinate(
    time * cyclesPerSecond + initialCyclePhase,
  );

  root.userData.mechanism = 'opposed-treadle-alternating-pawl-ratchet';
  root.userData.blocks = {
    baseRail,
    cameraFitGuides,
    couplingStrap,
    frontArm,
    frontConnectingRod,
    frontPawl,
    frontPinRing,
    frontStrapPin,
    frontTreadle,
    pulley,
    pulleyPosts,
    pulleyShaft,
    ratchet,
    ratchetBody,
    ratchetHub,
    ratchetIndicator,
    ratchetShaft,
    rearArm,
    rearConnectingRod,
    rearPawl,
    rearPinRing,
    rearStrapPin,
    rearTreadle,
    treadlePedestalLeft,
    treadlePedestalRight,
    treadleShaft,
    wheelBearing,
    wheelBearingBridge,
    wheelPost,
  };
  root.userData.geometry = {
    armRadius,
    armSwing,
    axis: Z_AXIS.clone(),
    basePawlAngle,
    connectingRodLength,
    contactOrbitRadius,
    cyclesPerSecond,
    driveContactWorldAngle,
    driveFaceFraction,
    frontPlaneZ,
    fullTurn,
    highArmAngle,
    initialCyclePhase,
    lowArmAngle,
    pawlLength,
    pulleyCenter: pulleyCenter.clone(),
    pulleyPitchRadius,
    ratchetDepth,
    ratchetMountPhase,
    ratchetOuterRadius,
    ratchetPlaneZ,
    ratchetRootRadius,
    rearPlaneZ,
    resetPawlSwing,
    teethPerCycle,
    teethPerHalfStroke,
    toothCount,
    toothOuterEndPhase,
    toothOuterStartPhase,
    toothPitch,
    treadleAmplitude,
    treadlePivot: treadlePivot.clone(),
    treadleRodJointRadius,
    wheelCenter: wheelCenter.clone(),
  };
  root.userData.armAngleAtTreadle = armAngleAtTreadle;
  root.userData.profileClearanceAt = profileClearanceAt;
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(ratchet, state.wheelAngle);
    setSpin(ratchetShaft, state.wheelAngle);
    setSpin(frontArm, state.frontArmAngle);
    setSpin(rearArm, state.rearArmAngle);
    setSpin(frontTreadle, state.frontTreadleAngle);
    setSpin(rearTreadle, state.rearTreadleAngle);
    frontPawl.position.set(
      state.frontAnchor.x,
      state.frontAnchor.y,
      frontPlaneZ,
    );
    frontPawl.rotation.z = state.frontPawlAngle;
    rearPawl.position.set(
      state.rearAnchor.x,
      state.rearAnchor.y,
      rearPlaneZ,
    );
    rearPawl.rotation.z = state.rearPawlAngle;
    frontConnectingRod.userData.setEndpoints(
      new THREE.Vector3(
        state.frontRodBottom.x,
        state.frontRodBottom.y,
        frontPlaneZ,
      ),
      new THREE.Vector3(
        state.frontRodTop.x,
        state.frontRodTop.y,
        frontPlaneZ,
      ),
    );
    rearConnectingRod.userData.setEndpoints(
      new THREE.Vector3(
        state.rearRodBottom.x,
        state.rearRodBottom.y,
        rearPlaneZ,
      ),
      new THREE.Vector3(
        state.rearRodTop.x,
        state.rearRodTop.y,
        rearPlaneZ,
      ),
    );
    frontStrapPin.position.set(
      pulleyCenter.x,
      state.frontStrapY,
      frontPlaneZ,
    );
    frontPinRing.position.set(
      pulleyCenter.x,
      state.frontStrapY,
      frontPlaneZ + 0.13,
    );
    rearStrapPin.position.set(
      pulleyCenter.x,
      state.rearStrapY,
      rearPlaneZ,
    );
    rearPinRing.position.set(
      pulleyCenter.x,
      state.rearStrapY,
      rearPlaneZ + 0.13,
    );
    couplingStrap.userData.setPoints(state.cablePoints);
    setSpin(pulley, state.pulleyAngle);
    setSpin(pulleyShaft, state.pulleyAngle);
    frontTreadle.userData.angle = state.frontTreadleAngle;
    rearTreadle.userData.angle = state.rearTreadleAngle;
    pulley.userData.angle = state.pulleyAngle;
    ratchet.userData.angle = state.wheelAngle;
    root.userData.contacts = {
      frontPawlTooth: {
        clearance: state.frontProfileClearance,
        engaged: state.frontDriving,
        error: state.frontDriving ? state.toothContactError : null,
        mode: state.frontDriving
          ? 'pulling-clockwise-driving-face'
          : 'lifted-reset-over-tooth-tips',
        pawlTip: new THREE.Vector3(
          state.frontTip.x,
          state.frontTip.y,
          ratchetContactZ,
        ),
        ratchetPoint: state.frontDriving
          ? new THREE.Vector3(
            state.activeToothPoint.x,
            state.activeToothPoint.y,
            ratchetContactZ,
          )
          : null,
        toothIndex: state.frontDriving ? state.activeToothIndex : null,
        velocityError: state.frontDriving
          ? state.activeTipVelocityError
          : null,
      },
      pulleyStrap: {
        cableLength: state.cableLength,
        frontNoSlipError: state.pulleyFrontNoSlipError,
        rearNoSlipError: state.pulleyRearNoSlipError,
        strapLengthError: state.strapLengthError,
      },
      rearPawlTooth: {
        clearance: state.rearProfileClearance,
        engaged: state.rearDriving,
        error: state.rearDriving ? state.toothContactError : null,
        mode: state.rearDriving
          ? 'pulling-clockwise-driving-face'
          : 'lifted-reset-over-tooth-tips',
        pawlTip: new THREE.Vector3(
          state.rearTip.x,
          state.rearTip.y,
          ratchetContactZ,
        ),
        ratchetPoint: state.rearDriving
          ? new THREE.Vector3(
            state.activeToothPoint.x,
            state.activeToothPoint.y,
            ratchetContactZ,
          )
          : null,
        toothIndex: state.rearDriving ? state.activeToothIndex : null,
        velocityError: state.rearDriving
          ? state.activeTipVelocityError
          : null,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(4.2, 3, 10.6));
}

function opposedSpringSectorCrownRatchet() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const wheelAxis = new THREE.Vector3(0, 1, 0);
  const rockshaftAxis = Z_AXIS.clone();
  const wheelToothCount = 36;
  const wheelToothPitch = fullTurn / wheelToothCount;
  const wheelPitchRadius = 1.55;
  const wheelFaceWidth = 0.42;
  const wheelInnerRadius = wheelPitchRadius - wheelFaceWidth / 2;
  const wheelOuterRadius = wheelPitchRadius + wheelFaceWidth / 2;
  const wheelBodyThickness = 0.24;
  const wheelToothHeight = 0.2;
  const wheelCenterY = -1.18;
  const wheelCenter = new THREE.Vector3(0, wheelCenterY, 0);
  const rockshaftCenter = new THREE.Vector3(0, 1.42, 0);
  const sectorPitchRadius = 2.32;
  const circularPitch = fullTurn * wheelPitchRadius / wheelToothCount;
  const sectorToothPitch = circularPitch / sectorPitchRadius;
  const teethPerHalfStroke = 4;
  const teethPerCycle = teethPerHalfStroke * 2;
  const rockshaftSwing = teethPerHalfStroke * sectorToothPitch;
  const rockshaftAmplitude = rockshaftSwing / 2;
  const lowRockAngle = -rockshaftAmplitude;
  const highRockAngle = rockshaftAmplitude;
  const sectorRootRadius = 2.2;
  const sectorOuterRadius = 2.42;
  const sectorDepth = 0.22;
  const sectorToothHalfPhase = sectorToothPitch * 0.43;
  const sectorToothIndices = Array.from(
    { length: 13 },
    (_, index) => index - 6,
  );
  const frontSectorZ = wheelPitchRadius;
  const rearSectorZ = -wheelPitchRadius;
  const springResetLift = 0.16;
  const springFreeLength = 0.32;
  const cyclesPerSecond = 0.24;
  const initialCyclePhase = 0.14;
  const wheelContactY = rockshaftCenter.y - sectorPitchRadius;

  const makeCrownRatchetWheel = () => {
    const crown = new THREE.Group();
    const rotor = new THREE.Group();
    crown.add(rotor);
    crown.quaternion.setFromUnitVectors(Z_AXIS, wheelAxis);
    crown.userData.axis = wheelAxis.clone();
    crown.userData.rotor = rotor;
    crown.userData.role = 'horizontal-crown-ratchet-wheel-D';
    const wheelMaterial = matte(PALETTE.driven, {
      metalness: 0.11,
      roughness: 0.64,
    });
    const darkMaterial = matte(PALETTE.ink, {
      metalness: 0.2,
      roughness: 0.53,
    });
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(
        wheelOuterRadius + 0.08,
        wheelOuterRadius + 0.08,
        wheelBodyThickness,
        80,
      ),
      wheelMaterial,
    );
    body.rotation.x = Math.PI / 2;
    body.userData.horizontalWheelBodyD = true;
    rotor.add(body);
    const toothBaseFace = wheelBodyThickness / 2;
    const toothTipFace = toothBaseFace + wheelToothHeight;
    const toothHalfAngle = wheelToothPitch * 0.45;
    const wheelMountPhase = -Math.PI / 2 + toothHalfAngle;
    const crownTeeth = [];
    const driveFaceTicks = [];
    const point = (radius, angle, axialPosition) => [
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      axialPosition,
    ];
    for (let toothIndex = 0; toothIndex < wheelToothCount; toothIndex += 1) {
      const centerAngle = wheelMountPhase + toothIndex * wheelToothPitch;
      const lowAngle = centerAngle - toothHalfAngle;
      const highAngle = centerAngle + toothHalfAngle;
      const vertices = [
        ...point(wheelInnerRadius, lowAngle, toothBaseFace),
        ...point(wheelOuterRadius, lowAngle, toothBaseFace),
        ...point(wheelInnerRadius, highAngle, toothBaseFace),
        ...point(wheelOuterRadius, highAngle, toothBaseFace),
        ...point(wheelInnerRadius, lowAngle, toothTipFace),
        ...point(wheelOuterRadius, lowAngle, toothTipFace),
      ];
      const indices = [
        0, 2, 3, 0, 3, 1,
        4, 5, 3, 4, 3, 2,
        0, 1, 5, 0, 5, 4,
        0, 4, 2,
        1, 3, 5,
      ];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const tooth = new THREE.Mesh(geometry, wheelMaterial);
      tooth.userData.crownRatchetToothD = true;
      tooth.userData.driveFaceAngle = lowAngle;
      tooth.userData.index = toothIndex;
      rotor.add(tooth);
      crownTeeth.push(tooth);
      const driveFaceTick = makeBeam(
        new THREE.Vector3(
          Math.cos(lowAngle) * wheelInnerRadius,
          Math.sin(lowAngle) * wheelInnerRadius,
          toothTipFace + 0.014,
        ),
        new THREE.Vector3(
          Math.cos(lowAngle) * wheelOuterRadius,
          Math.sin(lowAngle) * wheelOuterRadius,
          toothTipFace + 0.014,
        ),
        { color: PALETTE.ink, depth: 0.02, thickness: 0.026 },
      );
      driveFaceTick.userData.crownRatchetDriveFaceTick = true;
      driveFaceTick.userData.index = toothIndex;
      rotor.add(driveFaceTick);
      driveFaceTicks.push(driveFaceTick);
    }
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.23, 0.23, 0.58, 32),
      darkMaterial,
    );
    hub.rotation.x = Math.PI / 2;
    hub.userData.crownWheelHubD = true;
    rotor.add(hub);
    const indicator = new THREE.Mesh(
      new THREE.BoxGeometry(wheelPitchRadius * 0.72, 0.065, 0.03),
      matte(PALETTE.white, { roughness: 0.48 }),
    );
    indicator.position.set(
      wheelPitchRadius * 0.47,
      0,
      toothTipFace + 0.04,
    );
    indicator.userData.crownWheelRotationIndicator = true;
    rotor.add(indicator);
    crown.userData.body = body;
    crown.userData.crownTeeth = crownTeeth;
    crown.userData.driveFaceTicks = driveFaceTicks;
    crown.userData.faceDirection = wheelAxis.clone();
    crown.userData.hub = hub;
    crown.userData.indicator = indicator;
    crown.userData.innerFaceRadius = wheelInnerRadius;
    crown.userData.mountPhase = wheelMountPhase;
    crown.userData.outerFaceRadius = wheelOuterRadius;
    crown.userData.pitchRadius = wheelPitchRadius;
    crown.userData.risingFaces = crownTeeth.map((tooth) => ({
      angle: tooth.userData.driveFaceAngle,
      toothIndex: tooth.userData.index,
    }));
    crown.userData.teeth = wheelToothCount;
    crown.userData.toothBaseFace = toothBaseFace;
    crown.userData.toothHeight = wheelToothHeight;
    crown.userData.toothPitch = wheelToothPitch;
    crown.userData.toothTipFace = toothTipFace;
    return markShadows(crown);
  };

  const makeRockingSector = ({ color, driveDirection, planeZ, role }) => {
    const sector = makePlanarRotor();
    const rotor = sector.userData.rotor;
    sector.position.copy(rockshaftCenter);
    sector.position.z = planeZ;
    sector.userData.driveDirection = driveDirection;
    sector.userData.role = role;
    const carrierMaterial = matte(color, {
      metalness: 0.1,
      roughness: 0.64,
    });
    const darkMaterial = matte(PALETTE.ink, {
      metalness: 0.2,
      roughness: 0.52,
    });
    const arcHalfSpan = 0.77;
    const carrierRadius = 2.02;
    const carrierAngles = [
      -Math.PI / 2 - arcHalfSpan,
      -Math.PI / 2,
      -Math.PI / 2 + arcHalfSpan,
    ];
    const carrierBeams = carrierAngles.map((angle, index) => {
      const beam = makeBeam(
        new THREE.Vector3(
          Math.cos(angle) * 0.25,
          Math.sin(angle) * 0.25,
          0,
        ),
        new THREE.Vector3(
          Math.cos(angle) * carrierRadius,
          Math.sin(angle) * carrierRadius,
          0,
        ),
        { color, depth: sectorDepth * 0.82, thickness: 0.15 },
      );
      beam.userData.index = index;
      beam.userData.springSectorCarrierSpokeC = true;
      rotor.add(beam);
      return beam;
    });
    const hub = new THREE.Mesh(
      makeAnnulusGeometry(0.115, 0.28, sectorDepth * 1.25),
      carrierMaterial,
    );
    hub.userData.sectorHubFastOnRockshaftB = true;
    rotor.add(hub);

    const shoe = new THREE.Group();
    shoe.userData.springLiftedToothedShoeC = true;
    rotor.add(shoe);
    const rimRadius = sectorRootRadius - 0.035;
    const rimPoints = Array.from({ length: 33 }, (_, index) => {
      const angle = -Math.PI / 2 - arcHalfSpan
        + index / 32 * arcHalfSpan * 2;
      return new THREE.Vector3(
        Math.cos(angle) * rimRadius,
        Math.sin(angle) * rimRadius,
        0,
      );
    });
    const rimCurve = new THREE.CatmullRomCurve3(rimPoints);
    const rim = new THREE.Mesh(
      new THREE.TubeGeometry(rimCurve, 64, 0.11, 9, false),
      carrierMaterial,
    );
    rim.userData.curvedSectorRimC = true;
    shoe.add(rim);
    const teeth = [];
    const driveFaceTicks = [];
    for (const toothIndex of sectorToothIndices) {
      const centerAngle = -Math.PI / 2
        - driveDirection * sectorToothHalfPhase
        + toothIndex * sectorToothPitch;
      const lowAngle = centerAngle - sectorToothHalfPhase;
      const highAngle = centerAngle + sectorToothHalfPhase;
      const driveFaceAngle = driveDirection > 0 ? highAngle : lowAngle;
      const rampRootAngle = driveDirection > 0 ? lowAngle : highAngle;
      const polarPoint = (radius, angle) => new THREE.Vector2(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      );
      const rampRoot = polarPoint(sectorRootRadius, rampRootAngle);
      const tip = polarPoint(sectorOuterRadius, driveFaceAngle);
      const faceRoot = polarPoint(sectorRootRadius, driveFaceAngle);
      const shape = new THREE.Shape();
      shape.moveTo(rampRoot.x, rampRoot.y);
      shape.lineTo(tip.x, tip.y);
      shape.lineTo(faceRoot.x, faceRoot.y);
      shape.closePath();
      const tooth = new THREE.Mesh(
        centeredExtrusion(shape, sectorDepth),
        carrierMaterial,
      );
      tooth.userData.driveDirection = driveDirection;
      tooth.userData.driveFaceAngle = driveFaceAngle;
      tooth.userData.index = toothIndex;
      tooth.userData.ratchetToothOnSectorC = true;
      shoe.add(tooth);
      teeth.push(tooth);
      const driveFaceTick = makeBeam(
        new THREE.Vector3(
          Math.cos(driveFaceAngle) * sectorRootRadius,
          Math.sin(driveFaceAngle) * sectorRootRadius,
          sectorDepth / 2 + 0.02,
        ),
        new THREE.Vector3(
          Math.cos(driveFaceAngle) * sectorOuterRadius,
          Math.sin(driveFaceAngle) * sectorOuterRadius,
          sectorDepth / 2 + 0.02,
        ),
        { color: PALETTE.ink, depth: 0.02, thickness: 0.025 },
      );
      driveFaceTick.userData.index = toothIndex;
      driveFaceTick.userData.sectorRatchetDriveFaceTick = true;
      shoe.add(driveFaceTick);
      driveFaceTicks.push(driveFaceTick);
    }
    const springXCoordinates = [-0.66, 0.66];
    const springs = springXCoordinates.map((x, index) => {
      const spring = makeSpring({
        color: PALETTE.ink,
        length: springFreeLength,
        radius: 0.065,
        turns: 5,
      });
      spring.position.set(x, -2.06, sectorDepth * 0.58);
      spring.userData.compressionSpringForSectorC = true;
      spring.userData.freeLength = springFreeLength;
      spring.userData.index = index;
      rotor.add(spring);
      return spring;
    });
    const indicator = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.48, 0.026),
      matte(PALETTE.white, { roughness: 0.48 }),
    );
    indicator.position.set(0, -1.18, sectorDepth * 0.53);
    indicator.userData.sectorRockingIndicator = true;
    rotor.add(indicator);
    sector.userData.carrierBeams = carrierBeams;
    sector.userData.driveFaceTicks = driveFaceTicks;
    sector.userData.hub = hub;
    sector.userData.indicator = indicator;
    sector.userData.rim = rim;
    sector.userData.shoe = shoe;
    sector.userData.springs = springs;
    sector.userData.teeth = teeth;
    return sector;
  };

  const crownWheel = makeCrownRatchetWheel();
  crownWheel.position.copy(wheelCenter);
  const crownWheelShaft = makeShaft({
    axis: wheelAxis,
    length: 2.3,
    radius: 0.11,
  });
  crownWheelShaft.position.set(0, -1.67, 0);
  crownWheelShaft.userData.role = 'vertical-output-shaft-of-wheel-D';
  const frontSector = makeRockingSector({
    color: PALETTE.driver,
    driveDirection: 1,
    planeZ: frontSectorZ,
    role: 'front-positive-stroke-ratchet-sector-C',
  });
  const rearSector = makeRockingSector({
    color: PALETTE.brass,
    driveDirection: -1,
    planeZ: rearSectorZ,
    role: 'rear-negative-stroke-ratchet-sector-C',
  });
  const rockshaft = makeShaft({
    axis: rockshaftAxis,
    length: 3.95,
    radius: 0.105,
  });
  rockshaft.position.copy(rockshaftCenter);
  rockshaft.userData.role = 'common-transverse-rockshaft-B';

  const crankMountAngle = Math.PI / 2;
  const crankRadius = 0.86;
  const inputPlaneZ = frontSectorZ + 0.43;
  const inputCrank = makePlanarRotor();
  const inputCrankRotor = inputCrank.userData.rotor;
  inputCrank.position.set(
    rockshaftCenter.x,
    rockshaftCenter.y,
    inputPlaneZ,
  );
  inputCrank.userData.role = 'input-crank-fast-on-rockshaft-B';
  const crankStart = new THREE.Vector3(
    Math.cos(crankMountAngle) * 0.12,
    Math.sin(crankMountAngle) * 0.12,
    0,
  );
  const crankEnd = new THREE.Vector3(
    Math.cos(crankMountAngle) * crankRadius,
    Math.sin(crankMountAngle) * crankRadius,
    0,
  );
  const crankBody = makeBeam(crankStart, crankEnd, {
    color: PALETTE.driver,
    depth: 0.17,
    thickness: 0.16,
  });
  crankBody.userData.inputCrankBody = true;
  inputCrankRotor.add(crankBody);
  const crankHub = new THREE.Mesh(
    makeAnnulusGeometry(0.11, 0.23, 0.2),
    matte(PALETTE.driver, { metalness: 0.12, roughness: 0.6 }),
  );
  crankHub.userData.inputCrankHubOnB = true;
  inputCrankRotor.add(crankHub);
  const crankPin = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.034, 8, 30),
    matte(PALETTE.white, { roughness: 0.49 }),
  );
  crankPin.position.copy(crankEnd);
  crankPin.position.z = 0.12;
  crankPin.userData.inputRodPin = true;
  inputCrankRotor.add(crankPin);
  const inputRodLength = 3.2;
  const sliderLineY = 2.05;
  const inputRod = makeDynamicLink({
    color: PALETTE.driver,
    depth: 0.13,
    jointRadius: 0.105,
    thickness: 0.13,
  });
  inputRod.userData.role = 'reciprocating-input-rod-A';
  inputRod.userData.rigidInputRod = true;
  const slider = new THREE.Group();
  slider.position.z = inputPlaneZ;
  slider.userData.axis = new THREE.Vector3(1, 0, 0);
  slider.userData.role = 'rectilinear-input-slider-A';
  const sliderBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.26, 0.3),
    matte(PALETTE.driver, { metalness: 0.1, roughness: 0.64 }),
  );
  sliderBody.userData.inputSliderBodyA = true;
  slider.add(sliderBody);
  const sliderRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.032, 8, 28),
    matte(PALETTE.white, { roughness: 0.49 }),
  );
  sliderRing.position.z = 0.17;
  slider.add(sliderRing);
  const sliderGuide = makeBeam(
    new THREE.Vector3(2.42, sliderLineY, inputPlaneZ - 0.28),
    new THREE.Vector3(3.92, sliderLineY, inputPlaneZ - 0.28),
    { color: PALETTE.frame, depth: 0.18, thickness: 0.14 },
  );
  sliderGuide.userData.fixedRectilinearGuideForA = true;

  const baseY = -2.72;
  const frameZ = -2.12;
  const baseRail = makeBeam(
    new THREE.Vector3(-2.25, baseY, frameZ),
    new THREE.Vector3(2.25, baseY, frameZ),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.18 },
  );
  baseRail.userData.fixedBaseRail = true;
  const leftRockshaftPost = makeBeam(
    new THREE.Vector3(-1.42, baseY, frameZ),
    new THREE.Vector3(0, rockshaftCenter.y, frameZ),
    { color: PALETTE.frame, depth: 0.2, thickness: 0.17 },
  );
  const rightRockshaftPost = makeBeam(
    new THREE.Vector3(1.42, baseY, frameZ),
    new THREE.Vector3(0, rockshaftCenter.y, frameZ),
    { color: PALETTE.frame, depth: 0.2, thickness: 0.17 },
  );
  leftRockshaftPost.userData.fixedRockshaftSupport = true;
  rightRockshaftPost.userData.fixedRockshaftSupport = true;
  const rockshaftBearings = [-2.04, 2.04].map((z, index) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.055, 9, 38),
      matte(PALETTE.frame, { metalness: 0.16, roughness: 0.6 }),
    );
    bearing.position.set(rockshaftCenter.x, rockshaftCenter.y, z);
    bearing.userData.fixedRockshaftBearing = true;
    bearing.userData.index = index;
    return bearing;
  });
  const outputPedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.52, 0.3, 36),
    matte(PALETTE.frame, { metalness: 0.13, roughness: 0.64 }),
  );
  outputPedestal.position.set(0, baseY + 0.15, 0);
  outputPedestal.userData.fixedOutputPedestal = true;
  const outputBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.055, 9, 38),
    matte(PALETTE.frame, { metalness: 0.16, roughness: 0.6 }),
  );
  outputBearing.rotation.x = Math.PI / 2;
  outputBearing.position.set(0, -2.3, 0);
  outputBearing.userData.fixedVerticalOutputBearing = true;
  const cameraFitGuides = [
    new THREE.Vector3(-2.35, 2.65, 1.9),
    new THREE.Vector3(4.15, -2.65, -1.9),
  ].map((position, index) => {
    const guide = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 6),
      new THREE.MeshBasicMaterial({
        color: PALETTE.paper,
        depthWrite: false,
        opacity: 0,
        transparent: true,
      }),
    );
    guide.position.copy(position);
    guide.castShadow = false;
    guide.receiveShadow = false;
    guide.userData.cameraFitGuide = true;
    guide.userData.index = index;
    return guide;
  });

  root.add(
    baseRail,
    leftRockshaftPost,
    rightRockshaftPost,
    ...rockshaftBearings,
    outputPedestal,
    outputBearing,
    sliderGuide,
    crownWheel,
    crownWheelShaft,
    frontSector,
    rearSector,
    rockshaft,
    inputCrank,
    inputRod,
    slider,
    ...cameraFitGuides,
  );

  const crankPinAt = (rockAngle) => {
    const angle = crankMountAngle + rockAngle;
    return new THREE.Vector2(
      rockshaftCenter.x + Math.cos(angle) * crankRadius,
      rockshaftCenter.y + Math.sin(angle) * crankRadius,
    );
  };
  const stateAtCycleCoordinate = (cycleCoordinate) => {
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const frontDriving = cyclePhase < 0.5;
    const halfFraction = frontDriving
      ? cyclePhase * 2
      : (cyclePhase - 0.5) * 2;
    const easedHalfFraction = smoothStep01(halfFraction);
    const easeDerivative = 6 * halfFraction * (1 - halfFraction);
    const rockAngle = frontDriving
      ? THREE.MathUtils.lerp(
        lowRockAngle,
        highRockAngle,
        easedHalfFraction,
      )
      : THREE.MathUtils.lerp(
        highRockAngle,
        lowRockAngle,
        easedHalfFraction,
      );
    const rockAngularSpeed = (frontDriving ? 1 : -1)
      * rockshaftSwing * easeDerivative * 2 * cyclesPerSecond;
    const halfWheelAdvance = teethPerHalfStroke * wheelToothPitch;
    const localWheelAngle = frontDriving
      ? (rockAngle - lowRockAngle) * sectorPitchRadius
        / wheelPitchRadius
      : halfWheelAdvance + (highRockAngle - rockAngle)
        * sectorPitchRadius / wheelPitchRadius;
    const wheelAngle = cycleIndex * 2 * halfWheelAdvance
      + localWheelAngle;
    const wheelAngularSpeed = (frontDriving ? 1 : -1)
      * rockAngularSpeed * sectorPitchRadius / wheelPitchRadius;
    const resetLift = springResetLift
      * Math.sin(Math.PI * halfFraction) ** 2;
    const frontShoeLift = frontDriving ? 0 : resetLift;
    const rearShoeLift = frontDriving ? resetLift : 0;
    const frontSpringLength = springFreeLength - frontShoeLift;
    const rearSpringLength = springFreeLength - rearShoeLift;
    const activeSectorToothIndex = Math.round(
      -rockAngle / sectorToothPitch,
    );
    const activeWheelContactAngle = frontDriving
      ? -Math.PI / 2
      : Math.PI / 2;
    const baseWheelDriveFaceAngle = -Math.PI / 2;
    const activePhysicalWheelToothIndex = Math.round((
      activeWheelContactAngle
        - wheelAngle
        - baseWheelDriveFaceAngle
    ) / wheelToothPitch);
    const activeWheelToothIndex = THREE.MathUtils.euclideanModulo(
      activePhysicalWheelToothIndex,
      wheelToothCount,
    );
    const activeContactPoint = new THREE.Vector3(
      0,
      wheelContactY,
      frontDriving ? frontSectorZ : rearSectorZ,
    );
    const sectorSurfaceSpeed = sectorPitchRadius * rockAngularSpeed;
    const wheelSurfaceSpeed = frontDriving
      ? wheelPitchRadius * wheelAngularSpeed
      : -wheelPitchRadius * wheelAngularSpeed;
    const sectorTravelPitches = frontDriving
      ? (rockAngle - lowRockAngle) / sectorToothPitch
      : (highRockAngle - rockAngle) / sectorToothPitch;
    const wheelHalfTravelPitches = frontDriving
      ? localWheelAngle / wheelToothPitch
      : (localWheelAngle - halfWheelAdvance) / wheelToothPitch;
    const crankPoint = crankPinAt(rockAngle);
    const verticalRodOffset = sliderLineY - crankPoint.y;
    const horizontalRodReach = Math.sqrt(
      inputRodLength ** 2 - verticalRodOffset ** 2,
    );
    const sliderX = crankPoint.x + horizontalRodReach;
    const crankAngle = crankMountAngle + rockAngle;
    const crankVelocity = new THREE.Vector2(
      -Math.sin(crankAngle) * crankRadius * rockAngularSpeed,
      Math.cos(crankAngle) * crankRadius * rockAngularSpeed,
    );
    const sliderSpeed = crankVelocity.x
      + verticalRodOffset * crankVelocity.y / horizontalRodReach;
    const inputRodLengthError = Math.abs(
      crankPoint.distanceTo(new THREE.Vector2(sliderX, sliderLineY))
        - inputRodLength,
    );
    return {
      activeContactPoint,
      activePhysicalWheelToothIndex,
      activeSector: frontDriving ? 'front' : 'rear',
      activeSectorToothIndex,
      activeSurfaceVelocityError: Math.abs(
        sectorSurfaceSpeed - wheelSurfaceSpeed,
      ),
      activeWheelContactAngle,
      activeWheelToothIndex,
      crankPoint,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      easedHalfFraction,
      frontDriving,
      frontShoeLift,
      frontSpringCompression: frontShoeLift,
      frontSpringLength,
      halfFraction,
      inputReversing: Math.abs(sliderSpeed) < 1e-12,
      inputRodLengthError,
      localWheelAngle,
      pitchesAdvanced: wheelAngle / wheelToothPitch,
      rearDriving: !frontDriving,
      rearShoeLift,
      rearSpringCompression: rearShoeLift,
      rearSpringLength,
      rockAngle,
      rockAngularSpeed,
      sectorSurfaceSpeed,
      sectorTravelPitches,
      sliderSpeed,
      sliderX,
      stage: frontDriving
        ? 'front-sector-C-drives-near-side-rear-sector-spring-resets'
        : 'rear-sector-C-drives-far-side-front-sector-spring-resets',
      toothPitchPhaseError: Math.abs(
        sectorTravelPitches - wheelHalfTravelPitches,
      ),
      wheelAngle,
      wheelAngularSpeed,
      wheelHalfTravelPitches,
      wheelSurfaceSpeed,
    };
  };
  const stateAtTime = (time) => stateAtCycleCoordinate(
    time * cyclesPerSecond + initialCyclePhase,
  );

  root.userData.mechanism = 'opposed-spring-sector-crown-ratchet';
  root.userData.blocks = {
    baseRail,
    cameraFitGuides,
    crankBody,
    crankHub,
    crankPin,
    crownWheel,
    crownWheelShaft,
    frontSector,
    inputCrank,
    inputRod,
    leftRockshaftPost,
    outputBearing,
    outputPedestal,
    rearSector,
    rightRockshaftPost,
    rockshaft,
    rockshaftBearings,
    slider,
    sliderBody,
    sliderGuide,
    sliderRing,
  };
  root.userData.geometry = {
    circularPitch,
    crankMountAngle,
    crankRadius,
    cyclesPerSecond,
    frontSectorZ,
    fullTurn,
    highRockAngle,
    initialCyclePhase,
    inputPlaneZ,
    inputRodLength,
    lowRockAngle,
    rearSectorZ,
    rockshaftAmplitude,
    rockshaftCenter: rockshaftCenter.clone(),
    rockshaftSwing,
    sectorDepth,
    sectorOuterRadius,
    sectorPitchRadius,
    sectorRootRadius,
    sectorToothHalfPhase,
    sectorToothIndices,
    sectorToothPitch,
    sliderLineY,
    springFreeLength,
    springResetLift,
    teethPerCycle,
    teethPerHalfStroke,
    wheelAxis: wheelAxis.clone(),
    wheelBodyThickness,
    wheelCenter: wheelCenter.clone(),
    wheelContactY,
    wheelFaceWidth,
    wheelInnerRadius,
    wheelOuterRadius,
    wheelPitchRadius,
    wheelToothCount,
    wheelToothHeight,
    wheelToothPitch,
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;

  const updateSectorSpring = (sector, shoeLift, springLength) => {
    sector.userData.shoe.position.y = shoeLift;
    for (const spring of sector.userData.springs) {
      spring.position.y = -2.06 + shoeLift / 2;
      spring.scale.y = springLength / springFreeLength;
      spring.userData.compression = shoeLift;
      spring.userData.currentLength = springLength;
    }
  };
  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(crownWheel, state.wheelAngle);
    setSpin(crownWheelShaft, state.wheelAngle);
    setSpin(frontSector, state.rockAngle);
    setSpin(rearSector, state.rockAngle);
    setSpin(rockshaft, state.rockAngle);
    setSpin(inputCrank, state.rockAngle);
    updateSectorSpring(
      frontSector,
      state.frontShoeLift,
      state.frontSpringLength,
    );
    updateSectorSpring(
      rearSector,
      state.rearShoeLift,
      state.rearSpringLength,
    );
    inputRod.userData.setEndpoints(
      new THREE.Vector3(
        state.crankPoint.x,
        state.crankPoint.y,
        inputPlaneZ,
      ),
      new THREE.Vector3(state.sliderX, sliderLineY, inputPlaneZ),
    );
    slider.position.set(state.sliderX, sliderLineY, inputPlaneZ);
    crownWheel.userData.angle = state.wheelAngle;
    frontSector.userData.angle = state.rockAngle;
    frontSector.userData.shoeLift = state.frontShoeLift;
    rearSector.userData.angle = state.rockAngle;
    rearSector.userData.shoeLift = state.rearShoeLift;
    slider.userData.speed = state.sliderSpeed;
    root.userData.contacts = {
      frontSectorWheel: {
        clearance: state.frontShoeLift,
        contactPoint: state.frontDriving
          ? state.activeContactPoint.clone()
          : null,
        engaged: state.frontDriving,
        sectorToothIndex: state.frontDriving
          ? state.activeSectorToothIndex
          : null,
        surfaceVelocityError: state.frontDriving
          ? state.activeSurfaceVelocityError
          : null,
        wheelToothIndex: state.frontDriving
          ? state.activeWheelToothIndex
          : null,
      },
      rearSectorWheel: {
        clearance: state.rearShoeLift,
        contactPoint: state.rearDriving
          ? state.activeContactPoint.clone()
          : null,
        engaged: state.rearDriving,
        sectorToothIndex: state.rearDriving
          ? state.activeSectorToothIndex
          : null,
        surfaceVelocityError: state.rearDriving
          ? state.activeSurfaceVelocityError
          : null,
        wheelToothIndex: state.rearDriving
          ? state.activeWheelToothIndex
          : null,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finish(root, update, new THREE.Vector3(5.2, 3.8, 10.4));
}

function reversibleClickDiskCogIndex() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.012;
  const sourceDiskRadius = 193.5;
  const sourceCogRootRadius = 108;
  const sourceCogOuterRadius = 127;
  const sourceCogHubRadius = 57;
  const sourceOutputShaftRadius = 22;
  const sourcePawlPivotRadius = 145;
  const sourcePawlPivotAngle = THREE.MathUtils.degToRad(102);
  const sourceCrankRadius = 143.5;
  const sourceCrankAngle = THREE.MathUtils.degToRad(-15.8);
  const sourcePawlPivotToNose = 90;
  const sourceRodLength = 240;
  const toothCount = 24;
  const toothPitch = fullTurn / toothCount;
  const diskRadius = sourceDiskRadius * sourceScale;
  const cogRootRadius = sourceCogRootRadius * sourceScale;
  const cogOuterRadius = sourceCogOuterRadius * sourceScale;
  const cogHubRadius = sourceCogHubRadius * sourceScale;
  const outputShaftRadius = sourceOutputShaftRadius * sourceScale * 0.42;
  const pawlPivotRadius = sourcePawlPivotRadius * sourceScale;
  const crankRadius = sourceCrankRadius * sourceScale;
  const rodLength = sourceRodLength * sourceScale;
  const toothOuterHalfPhase = 0.27;
  const driveFaceFraction = 0.55;
  const reverseBaseFaceIndex = 6;
  const cogMountPhase = sourcePawlPivotAngle - 3 * toothPitch;
  const diskDepth = 0.2;
  const cogDepth = 0.25;
  const pawlDepth = 0.18;
  const diskPlaneZ = -0.34;
  const cogPlaneZ = 0;
  const pawlPlaneZ = 0.34;
  const rodPlaneZ = 0.46;
  const clearTipRadius = cogOuterRadius + 0.14;
  const driveEndPhase = 0.38;
  const liftEndPhase = 0.48;
  const returnEndPhase = 0.86;
  const settleEndPhase = 0.96;
  const cyclePeriod = 3.2;
  const cyclesPerSecond = 1 / cyclePeriod;
  const sourceDirection = -1;
  let selectedClickDirection = sourceDirection;

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.11,
    roughness: 0.64,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const pawlMaterial = matte(PALETTE.brass, {
    metalness: 0.13,
    roughness: 0.6,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const indexMaterial = matte(PALETTE.white, {
    metalness: 0.03,
    roughness: 0.5,
  });

  const makeSymmetricCog = () => {
    const cog = makePlanarRotor();
    const rotor = cog.userData.rotor;
    const shape = new THREE.Shape();
    const profilePoints = [];
    const clockwiseFaces = [];
    const counterclockwiseFaces = [];
    for (let toothIndex = 0; toothIndex < toothCount; toothIndex += 1) {
      const centerAngle = cogMountPhase + toothIndex * toothPitch;
      const rootBefore = new THREE.Vector2(
        Math.cos(centerAngle - toothPitch / 2) * cogRootRadius,
        Math.sin(centerAngle - toothPitch / 2) * cogRootRadius,
      );
      const outerBefore = new THREE.Vector2(
        Math.cos(centerAngle - toothOuterHalfPhase * toothPitch)
          * cogOuterRadius,
        Math.sin(centerAngle - toothOuterHalfPhase * toothPitch)
          * cogOuterRadius,
      );
      const outerAfter = new THREE.Vector2(
        Math.cos(centerAngle + toothOuterHalfPhase * toothPitch)
          * cogOuterRadius,
        Math.sin(centerAngle + toothOuterHalfPhase * toothPitch)
          * cogOuterRadius,
      );
      const rootAfter = new THREE.Vector2(
        Math.cos(centerAngle + toothPitch / 2) * cogRootRadius,
        Math.sin(centerAngle + toothPitch / 2) * cogRootRadius,
      );
      for (const point of [
        rootBefore,
        outerBefore,
        outerAfter,
        rootAfter,
      ]) {
        if (profilePoints.length === 0) shape.moveTo(point.x, point.y);
        else shape.lineTo(point.x, point.y);
        profilePoints.push(point);
      }
      const clockwiseTangent = rootAfter.clone().sub(outerAfter).normalize();
      const counterclockwiseTangent = outerBefore.clone()
        .sub(rootBefore).normalize();
      clockwiseFaces.push({
        outer: outerAfter,
        outwardNormal: new THREE.Vector2(
          clockwiseTangent.y,
          -clockwiseTangent.x,
        ),
        root: rootAfter,
        toothIndex,
      });
      counterclockwiseFaces.push({
        outer: outerBefore,
        outwardNormal: new THREE.Vector2(
          counterclockwiseTangent.y,
          -counterclockwiseTangent.x,
        ),
        root: rootBefore,
        toothIndex,
      });
    }
    shape.closePath();
    const body = new THREE.Mesh(
      centeredExtrusion(shape, cogDepth),
      drivenMaterial,
    );
    body.userData.role = 'twenty-four-tooth-intermittent-cog-wheel';
    rotor.add(body);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(
        cogHubRadius,
        cogHubRadius,
        cogDepth * 1.4,
        48,
      ),
      drivenMaterial,
    );
    hub.rotation.x = Math.PI / 2;
    hub.userData.role = 'output-cog-hub';
    rotor.add(hub);
    const indicator = new THREE.Mesh(
      new THREE.BoxGeometry(cogHubRadius * 0.72, 0.055, 0.035),
      indexMaterial,
    );
    indicator.position.set(
      Math.cos(cogMountPhase) * cogHubRadius * 0.45,
      Math.sin(cogMountPhase) * cogHubRadius * 0.45,
      cogDepth / 2 + 0.06,
    );
    indicator.rotation.z = cogMountPhase;
    indicator.userData.role = 'white-output-index';
    rotor.add(indicator);
    cog.userData.body = body;
    cog.userData.clockwiseFaces = clockwiseFaces;
    cog.userData.counterclockwiseFaces = counterclockwiseFaces;
    cog.userData.hub = hub;
    cog.userData.indicator = indicator;
    cog.userData.mountPhase = cogMountPhase;
    cog.userData.outerRadius = cogOuterRadius;
    cog.userData.profilePoints = profilePoints;
    cog.userData.rootRadius = cogRootRadius;
    cog.userData.teeth = toothCount;
    return cog;
  };

  const carrierDisk = makePlanarRotor();
  const carrierRotor = carrierDisk.userData.rotor;
  carrierDisk.position.z = diskPlaneZ;
  carrierDisk.userData.role = 'coaxial-oscillating-disk-wheel';
  const carrierBody = new THREE.Mesh(
    makeAnnulusGeometry(outputShaftRadius * 1.75, diskRadius, diskDepth),
    driverMaterial,
  );
  carrierBody.userData.role = 'large-source-proportioned-disk-wheel';
  carrierRotor.add(carrierBody);
  const carrierSleeve = new THREE.Mesh(
    makeAnnulusGeometry(
      outputShaftRadius * 1.22,
      outputShaftRadius * 2.15,
      diskDepth * 1.42,
    ),
    inkMaterial,
  );
  carrierSleeve.userData.role = 'loose-disk-sleeve-around-output-shaft';
  carrierRotor.add(carrierSleeve);
  const carrierRotationIndex = new THREE.Mesh(
    new THREE.BoxGeometry(diskRadius * 0.33, 0.055, 0.034),
    indexMaterial,
  );
  carrierRotationIndex.position.set(
    diskRadius * 0.78,
    0,
    diskDepth / 2 + 0.055,
  );
  carrierRotationIndex.userData.role = 'white-index-on-oscillating-disk';
  carrierRotor.add(carrierRotationIndex);

  const cogWheel = makeSymmetricCog();
  cogWheel.position.z = cogPlaneZ;
  cogWheel.userData.role = 'independently-rotating-coaxial-cog-wheel';
  const cogBody = cogWheel.userData.body;
  const cogHub = cogWheel.userData.hub;
  const cogIndicator = cogWheel.userData.indicator;
  const outputShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 1.5,
    radius: outputShaftRadius,
  });
  outputShaft.userData.role = 'intermittently-rotating-cog-output-shaft';

  const pivotLocal2 = new THREE.Vector2(
    Math.cos(sourcePawlPivotAngle) * pawlPivotRadius,
    Math.sin(sourcePawlPivotAngle) * pawlPivotRadius,
  );
  const pivotLocal3 = new THREE.Vector3(
    pivotLocal2.x,
    pivotLocal2.y,
    pawlPlaneZ - diskPlaneZ,
  );
  const facePointAt = (face) => face.outer.clone().lerp(
    face.root,
    driveFaceFraction,
  );
  const sourceForwardFace = cogWheel.userData.clockwiseFaces[0];
  const sourceReverseFace = cogWheel.userData.counterclockwiseFaces[
    reverseBaseFaceIndex
  ];
  const forwardTipLocal = facePointAt(sourceForwardFace);
  const reverseTipLocal = facePointAt(sourceReverseFace);
  const forwardPawlVector = forwardTipLocal.clone().sub(pivotLocal2);
  const reversePawlVector = reverseTipLocal.clone().sub(pivotLocal2);
  const pawlLength = forwardPawlVector.length();
  const reversePawlLengthError = Math.abs(
    reversePawlVector.length() - pawlLength,
  );
  const forwardPawlMountAngle = Math.atan2(
    forwardPawlVector.y,
    forwardPawlVector.x,
  );
  const reversePawlMountAngle = Math.atan2(
    reversePawlVector.y,
    reversePawlVector.x,
  );
  const clearTriangleCosine = THREE.MathUtils.clamp(
    (
      pawlPivotRadius ** 2 + clearTipRadius ** 2 - pawlLength ** 2
    ) / (2 * pawlPivotRadius * clearTipRadius),
    -1,
    1,
  );
  const clearPolarOffset = Math.acos(clearTriangleCosine);
  const clearPointForDirection = (direction) => new THREE.Vector2(
    Math.cos(sourcePawlPivotAngle + direction * clearPolarOffset)
      * clearTipRadius,
    Math.sin(sourcePawlPivotAngle + direction * clearPolarOffset)
      * clearTipRadius,
  );
  const clearMountAngleForDirection = (direction) => {
    const vector = clearPointForDirection(direction).sub(pivotLocal2);
    return Math.atan2(vector.y, vector.x);
  };

  const makeReversibleClick = () => {
    const click = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-0.14, 0.18);
    shape.quadraticCurveTo(-0.27, 0.16, -0.27, 0);
    shape.quadraticCurveTo(-0.27, -0.17, -0.1, -0.2);
    shape.lineTo(pawlLength * 0.56, -0.13);
    shape.quadraticCurveTo(
      pawlLength * 0.82,
      -0.12,
      pawlLength,
      0,
    );
    shape.lineTo(pawlLength * 0.84, 0.17);
    shape.lineTo(pawlLength * 0.75, 0.76);
    shape.lineTo(pawlLength * 0.58, 0.8);
    shape.lineTo(pawlLength * 0.62, 0.2);
    shape.lineTo(pawlLength * 0.22, 0.17);
    shape.quadraticCurveTo(0.02, 0.23, -0.14, 0.18);
    shape.closePath();
    const body = new THREE.Mesh(
      centeredExtrusion(shape, pawlDepth),
      pawlMaterial,
    );
    body.userData.role = 'throw-over-hooked-click-body';
    click.add(body);
    const tipMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 12),
      indexMaterial,
    );
    tipMarker.position.set(pawlLength, 0, pawlDepth / 2 + 0.045);
    tipMarker.userData.role = 'white-click-nose-contact-marker';
    click.add(tipMarker);
    click.userData.body = body;
    click.userData.length = pawlLength;
    click.userData.role = 'reversible-click-attached-to-disk-wheel';
    click.userData.tipMarker = tipMarker;
    return click;
  };

  const pawl = makeReversibleClick();
  pawl.position.copy(pivotLocal3);
  pawl.rotation.z = forwardPawlMountAngle;
  carrierRotor.add(pawl);
  const pawlBody = pawl.userData.body;
  const pawlTipMarker = pawl.userData.tipMarker;
  const pawlPivotStud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.74, 26),
    inkMaterial,
  );
  pawlPivotStud.rotation.x = Math.PI / 2;
  pawlPivotStud.position.set(
    pivotLocal2.x,
    pivotLocal2.y,
    (pawlPlaneZ - diskPlaneZ) / 2,
  );
  pawlPivotStud.userData.role = 'disk-carried-click-pivot-stud';
  carrierRotor.add(pawlPivotStud);

  const crankLocal2 = new THREE.Vector2(
    Math.cos(sourceCrankAngle) * crankRadius,
    Math.sin(sourceCrankAngle) * crankRadius,
  );
  const crankPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.11, 0.7, 28),
    inkMaterial,
  );
  crankPin.rotation.x = Math.PI / 2;
  crankPin.position.set(
    crankLocal2.x,
    crankLocal2.y,
    rodPlaneZ - diskPlaneZ,
  );
  crankPin.userData.role = 'rod-pin-fixed-in-oscillating-disk';
  carrierRotor.add(crankPin);
  const crankJointRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.15, 0.04, 9, 36),
    driverMaterial,
  );
  crankJointRing.position.copy(crankPin.position);
  crankJointRing.position.z += 0.13;
  crankJointRing.userData.role = 'rod-eye-on-disk-crank-pin';
  carrierRotor.add(crankJointRing);

  const sliderX = crankLocal2.x;
  const initialCrankPoint = new THREE.Vector3(
    crankLocal2.x,
    crankLocal2.y,
    rodPlaneZ,
  );
  const initialSliderPoint = new THREE.Vector3(
    sliderX,
    crankLocal2.y + rodLength,
    rodPlaneZ,
  );
  const sliderStemLength = 1.16;
  const sliderStemCenterOffset = 0.51;
  const connectingRod = makeBeam(initialCrankPoint, initialSliderPoint, {
    color: PALETTE.driver,
    depth: 0.14,
    thickness: 0.12,
  });
  connectingRod.userData.role = 'finite-rod-with-alternating-rectilinear-end';
  const inputSlider = new THREE.Group();
  inputSlider.position.copy(initialSliderPoint);
  inputSlider.userData.role = 'vertically-guided-rectilinear-input-end';
  const sliderStem = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, sliderStemLength, 0.16),
    driverMaterial,
  );
  sliderStem.position.y = sliderStemCenterOffset;
  sliderStem.userData.role = 'upper-reciprocating-rod-stem';
  const sliderEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.16, 0.045, 9, 36),
    driverMaterial,
  );
  sliderEye.userData.role = 'lower-eye-of-rectilinear-rod';
  const sliderJointPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.34, 24),
    inkMaterial,
  );
  sliderJointPin.rotation.x = Math.PI / 2;
  sliderJointPin.userData.role = 'finite-rod-to-slider-joint';
  inputSlider.add(sliderStem, sliderEye, sliderJointPin);

  const rearZ = -0.72;
  const baseY = -diskRadius - 0.46;
  const baseRail = makeBeam(
    new THREE.Vector3(-2.75, baseY, rearZ),
    new THREE.Vector3(2.85, baseY, rearZ),
    { color: PALETTE.frame, depth: 0.24, thickness: 0.18 },
  );
  baseRail.userData.role = 'fixed-base-under-disk-and-rod';
  const centerPost = makeBeam(
    new THREE.Vector3(0, baseY, rearZ),
    new THREE.Vector3(0, 0, rearZ),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.16 },
  );
  centerPost.userData.role = 'rear-support-for-common-center-shaft';
  const centerBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.07, 10, 44),
    frameMaterial,
  );
  centerBearing.position.z = rearZ + 0.18;
  centerBearing.userData.role = 'fixed-bearing-behind-coaxial-wheels';
  const guideYPositions = [2.5, 3];
  const rodGuides = guideYPositions.map((guideY, index) => {
    const guide = new THREE.Mesh(
      new THREE.TorusGeometry(0.13, 0.038, 9, 32),
      frameMaterial,
    );
    guide.rotation.x = Math.PI / 2;
    guide.position.set(sliderX, guideY, rodPlaneZ);
    guide.userData.index = index;
    guide.userData.role = 'fixed-guide-for-rectilinear-rod-stem';
    return guide;
  });
  const rodGuidePostX = 2.55;
  const rodGuidePost = makeBeam(
    new THREE.Vector3(rodGuidePostX, baseY, rearZ),
    new THREE.Vector3(rodGuidePostX, guideYPositions[1] + 0.25, rearZ),
    { color: PALETTE.frame, depth: 0.2, thickness: 0.14 },
  );
  rodGuidePost.userData.role = 'fixed-post-carrying-two-rod-guides';
  const rodGuideSupports = guideYPositions.map((guideY) => makeBeam(
    new THREE.Vector3(sliderX, guideY, rearZ),
    new THREE.Vector3(rodGuidePostX, guideY, rearZ),
    { color: PALETTE.frame, depth: 0.17, thickness: 0.11 },
  ));
  const rodGuideStandoffs = guideYPositions.map((guideY) => makeBeam(
    new THREE.Vector3(sliderX, guideY, rearZ),
    new THREE.Vector3(sliderX, guideY, rodPlaneZ - 0.08),
    { color: PALETTE.frame, depth: 0.13, thickness: 0.1 },
  ));
  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 6.65, 0.01),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.y = 0.25;
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-full-stroke-framing-envelope';

  root.add(
    cameraEnvelope,
    baseRail,
    centerPost,
    centerBearing,
    rodGuidePost,
    ...rodGuideSupports,
    ...rodGuideStandoffs,
    ...rodGuides,
    outputShaft,
    carrierDisk,
    cogWheel,
    connectingRod,
    inputSlider,
  );

  const pointInsideCog = (point) => {
    const profile = cogWheel.userData.profilePoints;
    let inside = false;
    for (
      let index = 0, previousIndex = profile.length - 1;
      index < profile.length;
      previousIndex = index, index += 1
    ) {
      const current = profile[index];
      const previous = profile[previousIndex];
      if (
        (current.y > point.y) !== (previous.y > point.y)
        && point.x < (previous.x - current.x)
          * (point.y - current.y) / (previous.y - current.y) + current.x
      ) inside = !inside;
    }
    return inside;
  };
  const closestCogProfilePoint = (point) => {
    const profile = cogWheel.userData.profilePoints;
    let distance = Infinity;
    let pointOnProfile = null;
    let segmentIndex = -1;
    for (let index = 0; index < profile.length; index += 1) {
      const start = profile[index];
      const end = profile[(index + 1) % profile.length];
      const edge = end.clone().sub(start);
      const denominator = edge.lengthSq();
      const fraction = denominator < 1e-18
        ? 0
        : THREE.MathUtils.clamp(
          point.clone().sub(start).dot(edge) / denominator,
          0,
          1,
        );
      const candidate = start.clone().addScaledVector(edge, fraction);
      const candidateDistance = point.distanceTo(candidate);
      if (candidateDistance < distance) {
        distance = candidateDistance;
        pointOnProfile = candidate;
        segmentIndex = index;
      }
    }
    return { distance, point: pointOnProfile, segmentIndex };
  };
  const cogClearanceAt = (worldPoint, wheelAngle) => {
    const localPoint = worldPoint.clone().rotateAround(
      new THREE.Vector2(),
      -wheelAngle,
    );
    const closest = closestCogProfilePoint(localPoint);
    return {
      clearance: pointInsideCog(localPoint)
        ? -closest.distance
        : closest.distance,
      localPoint,
      localProfilePoint: closest.point,
      profilePoint: closest.point.clone().rotateAround(
        new THREE.Vector2(),
        wheelAngle,
      ),
      segmentIndex: closest.segmentIndex,
    };
  };
  const lerpAngle = (start, end, amount) => start + Math.atan2(
    Math.sin(end - start),
    Math.cos(end - start),
  ) * amount;
  const boundaryEpsilon = 1e-12;
  const normalizedCycleCoordinate = (coordinate) => {
    const nearest = Math.round(coordinate);
    return Math.abs(coordinate - nearest) < boundaryEpsilon
      ? nearest
      : coordinate;
  };
  const stateAtTime = (time, directionOverride = selectedClickDirection) => {
    const clickDirection = directionOverride < 0 ? -1 : 1;
    const cycleCoordinate = normalizedCycleCoordinate(time / cyclePeriod);
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const drive = segmentEase(cyclePhase, 0, driveEndPhase);
    const lift = segmentEase(cyclePhase, driveEndPhase, liftEndPhase);
    const diskReturn = segmentEase(
      cyclePhase,
      liftEndPhase,
      returnEndPhase,
    );
    const settle = segmentEase(
      cyclePhase,
      returnEndPhase,
      settleEndPhase,
    );
    let stage;
    let eventFraction;
    let eventFractionSpeed;
    let diskAngle;
    let diskAngularSpeed;
    let pawlMountAngle;
    let relativePawlAngularSpeed;
    let driveEngaged;
    let seated;
    let contactCycleIndex;
    const drivePawlMountAngle = clickDirection < 0
      ? forwardPawlMountAngle
      : reversePawlMountAngle;
    const clearPawlMountAngle = clearMountAngleForDirection(clickDirection);
    if (cyclePhase < driveEndPhase) {
      diskAngle = -toothPitch * drive.value;
      diskAngularSpeed = -toothPitch * drive.derivative / cyclePeriod;
    } else if (cyclePhase < liftEndPhase) {
      diskAngle = -toothPitch;
      diskAngularSpeed = 0;
    } else if (cyclePhase < returnEndPhase) {
      diskAngle = -toothPitch * (1 - diskReturn.value);
      diskAngularSpeed = toothPitch
        * diskReturn.derivative / cyclePeriod;
    } else {
      diskAngle = 0;
      diskAngularSpeed = 0;
    }

    if (clickDirection < 0) {
      driveEngaged = cyclePhase < driveEndPhase;
      seated = cyclePhase >= settleEndPhase;
      contactCycleIndex = driveEngaged ? cycleIndex : cycleIndex + 1;
      eventFraction = driveEngaged ? drive.value : 1;
      eventFractionSpeed = driveEngaged
        ? drive.derivative / cyclePeriod
        : 0;
      if (cyclePhase < driveEndPhase) {
        stage = 'rod-outbound-stroke-click-drives-cog-clockwise';
        pawlMountAngle = drivePawlMountAngle;
        relativePawlAngularSpeed = 0;
      } else if (cyclePhase < liftEndPhase) {
        stage = 'click-lifts-clear-of-driven-tooth';
        pawlMountAngle = lerpAngle(
          drivePawlMountAngle,
          clearPawlMountAngle,
          lift.value,
        );
        relativePawlAngularSpeed = Math.atan2(
          Math.sin(clearPawlMountAngle - drivePawlMountAngle),
          Math.cos(clearPawlMountAngle - drivePawlMountAngle),
        ) * lift.derivative / cyclePeriod;
      } else if (cyclePhase < returnEndPhase) {
        stage = 'disk-and-rod-return-while-cog-dwells';
        pawlMountAngle = clearPawlMountAngle;
        relativePawlAngularSpeed = 0;
      } else if (cyclePhase < settleEndPhase) {
        stage = 'click-settles-on-next-cog-tooth';
        pawlMountAngle = lerpAngle(
          clearPawlMountAngle,
          drivePawlMountAngle,
          settle.value,
        );
        relativePawlAngularSpeed = Math.atan2(
          Math.sin(drivePawlMountAngle - clearPawlMountAngle),
          Math.cos(drivePawlMountAngle - clearPawlMountAngle),
        ) * settle.derivative / cyclePeriod;
      } else {
        stage = 'cog-and-disk-dwell-with-click-seated';
        pawlMountAngle = drivePawlMountAngle;
        relativePawlAngularSpeed = 0;
      }
    } else {
      driveEngaged = cyclePhase >= liftEndPhase
        && cyclePhase < returnEndPhase;
      seated = false;
      contactCycleIndex = cycleIndex + 1;
      eventFraction = cyclePhase < liftEndPhase
        ? 0
        : cyclePhase < returnEndPhase ? diskReturn.value : 1;
      eventFractionSpeed = driveEngaged
        ? diskReturn.derivative / cyclePeriod
        : 0;
      if (cyclePhase < driveEndPhase) {
        stage = 'disk-and-rod-outbound-while-cog-dwells';
        pawlMountAngle = clearPawlMountAngle;
        relativePawlAngularSpeed = 0;
      } else if (cyclePhase < liftEndPhase) {
        stage = 'reversed-click-settles-on-next-cog-tooth';
        pawlMountAngle = lerpAngle(
          clearPawlMountAngle,
          drivePawlMountAngle,
          lift.value,
        );
        relativePawlAngularSpeed = Math.atan2(
          Math.sin(drivePawlMountAngle - clearPawlMountAngle),
          Math.cos(drivePawlMountAngle - clearPawlMountAngle),
        ) * lift.derivative / cyclePeriod;
      } else if (cyclePhase < returnEndPhase) {
        stage = 'rod-return-stroke-click-drives-cog-counterclockwise';
        pawlMountAngle = drivePawlMountAngle;
        relativePawlAngularSpeed = 0;
      } else if (cyclePhase < settleEndPhase) {
        stage = 'reversed-click-lifts-clear-of-driven-tooth';
        pawlMountAngle = lerpAngle(
          drivePawlMountAngle,
          clearPawlMountAngle,
          settle.value,
        );
        relativePawlAngularSpeed = Math.atan2(
          Math.sin(clearPawlMountAngle - drivePawlMountAngle),
          Math.cos(clearPawlMountAngle - drivePawlMountAngle),
        ) * settle.derivative / cyclePeriod;
      } else {
        stage = 'cog-and-disk-dwell-with-reversed-click-clear';
        pawlMountAngle = clearPawlMountAngle;
        relativePawlAngularSpeed = 0;
      }
    }
    if (diskAngle === 0) diskAngle = 0;
    if (diskAngularSpeed === 0) diskAngularSpeed = 0;
    if (relativePawlAngularSpeed === 0) relativePawlAngularSpeed = 0;
    const wheelCoordinate = clickDirection * (cycleIndex + eventFraction);
    const wheelAngle = wheelCoordinate === 0
      ? 0
      : wheelCoordinate * toothPitch;
    const wheelAngularSpeed = eventFractionSpeed === 0
      ? 0
      : clickDirection * toothPitch * eventFractionSpeed;
    const absolutePawlAngle = diskAngle + pawlMountAngle;
    const absolutePawlAngularSpeed = diskAngularSpeed
      + relativePawlAngularSpeed;
    const pawlPivot = pivotLocal2.clone().rotateAround(
      new THREE.Vector2(),
      diskAngle,
    );
    const pawlTipVector = new THREE.Vector2(
      Math.cos(absolutePawlAngle) * pawlLength,
      Math.sin(absolutePawlAngle) * pawlLength,
    );
    const pawlTip = pawlPivot.clone().add(pawlTipVector);
    const faceArray = clickDirection < 0
      ? cogWheel.userData.clockwiseFaces
      : cogWheel.userData.counterclockwiseFaces;
    const baseFaceIndex = clickDirection < 0 ? 0 : reverseBaseFaceIndex;
    const activeToothIndex = THREE.MathUtils.euclideanModulo(
      baseFaceIndex - clickDirection * contactCycleIndex,
      toothCount,
    );
    const activeFace = faceArray[activeToothIndex];
    const activeFacePoint = facePointAt(activeFace).rotateAround(
      new THREE.Vector2(),
      wheelAngle,
    );
    const activeFaceNormal = activeFace.outwardNormal.clone().rotateAround(
      new THREE.Vector2(),
      wheelAngle,
    );
    const contactEngaged = driveEngaged || seated;
    const pawlTipVelocity = new THREE.Vector2(
      -pawlPivot.y * diskAngularSpeed,
      pawlPivot.x * diskAngularSpeed,
    ).add(new THREE.Vector2(
      -pawlTipVector.y * absolutePawlAngularSpeed,
      pawlTipVector.x * absolutePawlAngularSpeed,
    ));
    const facePointVelocity = new THREE.Vector2(
      -activeFacePoint.y * wheelAngularSpeed,
      activeFacePoint.x * wheelAngularSpeed,
    );
    const contactVelocityDifference = pawlTipVelocity.clone().sub(
      facePointVelocity,
    );
    const profileClearance = cogClearanceAt(pawlTip, wheelAngle);

    const crankPoint2 = crankLocal2.clone().rotateAround(
      new THREE.Vector2(),
      diskAngle,
    );
    const crankVelocity2 = new THREE.Vector2(
      -crankPoint2.y * diskAngularSpeed,
      crankPoint2.x * diskAngularSpeed,
    );
    const horizontalRodOffset = sliderX - crankPoint2.x;
    const verticalRodSpan = Math.sqrt(Math.max(
      0,
      rodLength ** 2 - horizontalRodOffset ** 2,
    ));
    const sliderY = crankPoint2.y + verticalRodSpan;
    const sliderVelocityY = crankVelocity2.y
      + horizontalRodOffset * crankVelocity2.x / verticalRodSpan;
    const crankPoint = new THREE.Vector3(
      crankPoint2.x,
      crankPoint2.y,
      rodPlaneZ,
    );
    const sliderPoint = new THREE.Vector3(
      sliderX,
      sliderY,
      rodPlaneZ,
    );
    return {
      absolutePawlAngle,
      absolutePawlAngularSpeed,
      activeFaceNormal,
      activeFacePoint,
      activeToothIndex,
      clickDirection,
      clickDirectionLabel: clickDirection < 0
        ? 'engraved-clockwise-indexing-position'
        : 'thrown-over-counterclockwise-indexing-position',
      cogProfileClearance: profileClearance.clearance,
      cogProfilePoint: profileClearance.profilePoint,
      cogProfileSegmentIndex: profileClearance.segmentIndex,
      contactEngaged,
      contactNormalVelocityError: contactEngaged
        ? Math.abs(contactVelocityDifference.dot(activeFaceNormal))
        : null,
      contactPointError: contactEngaged
        ? pawlTip.distanceTo(activeFacePoint)
        : null,
      contactSurfaceVelocityError: contactEngaged
        ? contactVelocityDifference.length()
        : null,
      crankPoint,
      crankRadiusError: crankPoint2.length() - crankRadius,
      crankVelocity: new THREE.Vector3(
        crankVelocity2.x,
        crankVelocity2.y,
        0,
      ),
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      diskAngle,
      diskAngularSpeed,
      driveEngaged,
      eventFraction,
      pawlLengthError: pawlPivot.distanceTo(pawlTip) - pawlLength,
      pawlMountAngle,
      pawlPivot,
      pawlTip,
      pawlTipRadius: pawlTip.length(),
      pawlTipVelocity,
      profileLocalPoint: profileClearance.localPoint,
      relativePawlAngularSpeed,
      rodAngle: Math.atan2(
        sliderPoint.y - crankPoint.y,
        sliderPoint.x - crankPoint.x,
      ),
      rodLengthError: crankPoint.distanceTo(sliderPoint) - rodLength,
      seated,
      sliderPoint,
      sliderVelocity: new THREE.Vector3(0, sliderVelocityY, 0),
      stage,
      teethAdvanced: wheelAngle / toothPitch,
      wheelAngle,
      wheelAngularSpeed,
      wheelDwelling: !driveEngaged,
    };
  };

  root.userData.mechanism = 'reversible-click-on-oscillating-disk-intermittent-cog-index';
  root.userData.cameraDistanceScale = 0.98;
  root.userData.blocks = {
    baseRail,
    cameraEnvelope,
    carrierBody,
    carrierDisk,
    carrierRotationIndex,
    carrierRotor,
    carrierSleeve,
    centerBearing,
    centerPost,
    cogBody,
    cogHub,
    cogIndicator,
    cogRotor: cogWheel.userData.rotor,
    cogWheel,
    connectingRod,
    crankJointRing,
    crankPin,
    inputSlider,
    outputShaft,
    pawl,
    pawlBody,
    pawlPivotStud,
    pawlTipMarker,
    rodGuidePost,
    rodGuideStandoffs,
    rodGuideSupports,
    rodGuides,
    sliderEye,
    sliderJointPin,
    sliderStem,
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    clearPolarOffset,
    clearTipRadius,
    cogDepth,
    cogHubRadius,
    cogMountPhase,
    cogOuterRadius,
    cogPlaneZ,
    cogRootRadius,
    crankRadius,
    cyclePeriod,
    cyclesPerSecond,
    diskDepth,
    diskPlaneZ,
    diskRadius,
    driveEndPhase,
    driveFaceFraction,
    forwardPawlMountAngle,
    forwardTipLocal,
    guideYPositions,
    liftEndPhase,
    outputShaftRadius,
    pawlDepth,
    pawlLength,
    pawlPlaneZ,
    pawlPivotRadius,
    pivotLocal: pivotLocal2.clone(),
    returnEndPhase,
    reverseBaseFaceIndex,
    reversePawlLengthError,
    reversePawlMountAngle,
    reverseTipLocal,
    rodLength,
    rodPlaneZ,
    settleEndPhase,
    sliderStemCenterOffset,
    sliderStemLength,
    sliderX,
    sourceCogHubRadius,
    sourceCogOuterRadius,
    sourceCogRootRadius,
    sourceCrankAngle,
    sourceCrankRadius,
    sourceDirection,
    sourceDiskRadius,
    sourceOutputShaftRadius,
    sourcePawlPivotAngle,
    sourcePawlPivotRadius,
    sourcePawlPivotToNose,
    sourceRodLength,
    sourceScale,
    toothCount,
    toothOuterHalfPhase,
    toothPitch,
  };
  root.userData.cogClearanceAt = cogClearanceAt;
  root.userData.getClickDirection = () => selectedClickDirection;
  root.userData.setClickDirection = (direction) => {
    selectedClickDirection = direction < 0 ? -1 : 1;
    return selectedClickDirection;
  };
  root.userData.stateAtTime = stateAtTime;
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(carrierDisk, state.diskAngle);
    setSpin(cogWheel, state.wheelAngle);
    setSpin(outputShaft, state.wheelAngle);
    pawl.rotation.z = state.pawlMountAngle;
    connectingRod.userData.setEndpoints(
      state.crankPoint,
      state.sliderPoint,
    );
    inputSlider.position.copy(state.sliderPoint);
    carrierDisk.userData.angularSpeed = state.diskAngularSpeed;
    cogWheel.userData.angularSpeed = state.wheelAngularSpeed;
    pawl.userData.absoluteAngularSpeed = state.absolutePawlAngularSpeed;
    inputSlider.userData.velocity = state.sliderVelocity.clone();
    root.userData.contacts = {
      clickCogTooth: {
        clickPoint: state.contactEngaged
          ? new THREE.Vector3(
            state.pawlTip.x,
            state.pawlTip.y,
            pawlPlaneZ,
          )
          : null,
        direction: state.clickDirection,
        engaged: state.contactEngaged,
        error: state.contactPointError,
        normal: state.contactEngaged
          ? new THREE.Vector3(
            state.activeFaceNormal.x,
            state.activeFaceNormal.y,
            0,
          )
          : null,
        normalVelocityError: state.contactNormalVelocityError,
        profileClearance: state.cogProfileClearance,
        surfaceVelocityError: state.contactSurfaceVelocityError,
        toothIndex: state.activeToothIndex,
        toothPoint: state.contactEngaged
          ? new THREE.Vector3(
            state.activeFacePoint.x,
            state.activeFacePoint.y,
            pawlPlaneZ,
          )
          : null,
      },
      finiteInputRod: {
        crankPoint: state.crankPoint.clone(),
        crankRadiusError: state.crankRadiusError,
        length: rodLength,
        lengthError: state.rodLengthError,
        sliderPoint: state.sliderPoint.clone(),
      },
      coaxialWheelPair: {
        carrierAngle: state.diskAngle,
        commonCenterDistance: 0,
        outputAngle: state.wheelAngle,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  const model = finish(root, update, new THREE.Vector3(2.4, 3.1, 11));
  cameraEnvelope.castShadow = false;
  cameraEnvelope.receiveShadow = false;
  pawlTipMarker.castShadow = false;
  return model;
}

function reciprocatingElbowPawlRatchetFeed() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;

  // Measurements are taken from the 525 px source engraving. The idealized
  // centers reconcile Brown's hand-drawn six-pixel offset at the upper pin
  // while preserving the visibly coaxial wheel and elbow-lever.
  const sourceScale = 0.013;
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceWheelCenter = new THREE.Vector2(226, 300);
  const sourceWheelRootRadius = 154;
  const sourceWheelOuterRadius = 210;
  const sourceWheelHubRadius = 65;
  const sourceWheelBoreRadius = 42;
  const sourceUpperPivot = new THREE.Vector2(232, 37);
  const sourceRightJoint = new THREE.Vector2(477, 300);
  const sourcePawlTip = new THREE.Vector2(321, 137);
  const sourceInputTop = new THREE.Vector2(477, 68);
  const sourceInputHalfWidth = 15;
  const toothCount = 20;
  const toothPitch = fullTurn / toothCount;
  const toothHalfPhase = 0.28;
  const toothHalfAngle = toothHalfPhase * toothPitch;
  const wheelRootRadius = sourceWheelRootRadius * sourceScale;
  const wheelOuterRadius = sourceWheelOuterRadius * sourceScale;
  const wheelHubRadius = sourceWheelHubRadius * sourceScale;
  const wheelBoreRadius = sourceWheelBoreRadius * sourceScale;
  const upperArmLength = (
    sourceWheelCenter.y - sourceUpperPivot.y
  ) * sourceScale;
  const rightArmLength = (
    sourceRightJoint.x - sourceWheelCenter.x
  ) * sourceScale;
  const sourceContactPoint = new THREE.Vector2(
    (sourcePawlTip.x - sourceWheelCenter.x) * sourceScale,
    (sourceWheelCenter.y - sourcePawlTip.y) * sourceScale,
  );
  const pawlContactRadius = sourceContactPoint.length();
  const sourceRightFaceAngle = Math.atan2(
    sourceContactPoint.y,
    sourceContactPoint.x,
  );
  const sourceLeftFaceAngle = Math.PI - sourceRightFaceAngle;
  const sourceMappedUpperPivot = new THREE.Vector2(
    sourceWheelCenter.x,
    sourceWheelCenter.y - upperArmLength / sourceScale,
  );
  const sourceMappedRightJoint = new THREE.Vector2(
    sourceWheelCenter.x + rightArmLength / sourceScale,
    sourceWheelCenter.y,
  );
  const sourceIdealUpperPivot = new THREE.Vector2(0, upperArmLength);
  const pawlLength = sourceIdealUpperPivot.distanceTo(sourceContactPoint);
  const pawlClearRadius = wheelOuterRadius + 0.13;
  const leverAmplitude = toothPitch / 2;
  const cyclePeriod = 4.4;
  const cyclesPerSecond = 1 / cyclePeriod;
  const sourceCyclePhase = 0.25;
  const slipLiftEnd = 0.18;
  const slipSettleStart = 0.82;
  const wheelDepth = 0.32;
  const leverDepth = 0.27;
  const pawlDepth = 0.2;
  const wheelPlaneZ = 0;
  const leverPlaneZ = 0.43;
  const pawlPlaneZ = 0.78;
  const inputPlaneZ = 0.8;
  const rearFrameZ = -0.58;
  const slotHalfLength = 0.23;
  const slotHalfWidth = 0.12;
  const inputStemLength = (
    sourceRightJoint.y - sourceInputTop.y
  ) * sourceScale + 0.25;
  const rightWheelOffset = 0;
  const wheelMountPhase = sourceRightFaceAngle
    - toothPitch / 2 + toothHalfAngle;
  const leftWheelOffset = sourceLeftFaceAngle + toothPitch / 2
    - wheelMountPhase - toothHalfAngle;
  let selectedPawlDirection = 1;

  const wheelMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.62,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.1,
    roughness: 0.64,
  });
  const pawlMaterial = matte(PALETTE.brass, {
    metalness: 0.13,
    roughness: 0.58,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.23,
    roughness: 0.48,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.68,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.5,
  });

  const wheel = makePlanarRotor();
  wheel.position.z = wheelPlaneZ;
  wheel.userData.role = 'twenty-tooth-reversible-feed-ratchet-wheel';
  const wheelRotor = wheel.userData.rotor;
  const wheelShape = new THREE.Shape();
  const wheelProfilePoints = [];
  const leadingFaces = [];
  const trailingFaces = [];
  for (let toothIndex = 0; toothIndex < toothCount; toothIndex += 1) {
    const centerAngle = wheelMountPhase + toothIndex * toothPitch;
    const leadingAngle = centerAngle - toothHalfAngle;
    const trailingAngle = centerAngle + toothHalfAngle;
    const rootLeading = new THREE.Vector2(
      Math.cos(leadingAngle) * wheelRootRadius,
      Math.sin(leadingAngle) * wheelRootRadius,
    );
    const outerLeading = new THREE.Vector2(
      Math.cos(leadingAngle) * wheelOuterRadius,
      Math.sin(leadingAngle) * wheelOuterRadius,
    );
    const outerTrailing = new THREE.Vector2(
      Math.cos(trailingAngle) * wheelOuterRadius,
      Math.sin(trailingAngle) * wheelOuterRadius,
    );
    const rootTrailing = new THREE.Vector2(
      Math.cos(trailingAngle) * wheelRootRadius,
      Math.sin(trailingAngle) * wheelRootRadius,
    );
    for (const point of [
      rootLeading,
      outerLeading,
      outerTrailing,
      rootTrailing,
    ]) {
      if (wheelProfilePoints.length === 0) {
        wheelShape.moveTo(point.x, point.y);
      } else {
        wheelShape.lineTo(point.x, point.y);
      }
      wheelProfilePoints.push(point);
    }
    leadingFaces.push({
      angle: leadingAngle,
      outer: outerLeading,
      root: rootLeading,
      toothIndex,
    });
    trailingFaces.push({
      angle: trailingAngle,
      outer: outerTrailing,
      root: rootTrailing,
      toothIndex,
    });
  }
  wheelShape.closePath();
  const wheelBody = new THREE.Mesh(
    centeredExtrusion(wheelShape, wheelDepth),
    wheelMaterial,
  );
  wheelBody.userData.role = 'source-proportioned-square-tooth-wheel-body';
  wheelRotor.add(wheelBody);
  const wheelHub = new THREE.Mesh(
    new THREE.CylinderGeometry(
      wheelHubRadius,
      wheelHubRadius,
      wheelDepth * 1.42,
      56,
    ),
    wheelMaterial,
  );
  wheelHub.rotation.x = Math.PI / 2;
  wheelHub.userData.role = 'ratchet-output-hub';
  wheelRotor.add(wheelHub);
  const wheelIndex = makeBeam(
    new THREE.Vector3(wheelBoreRadius * 0.75, 0, wheelDepth * 0.73),
    new THREE.Vector3(wheelHubRadius * 0.78, 0, wheelDepth * 0.73),
    { color: PALETTE.white, depth: 0.03, thickness: 0.075 },
  );
  wheelIndex.userData.role = 'white-ratchet-output-index';
  wheelRotor.add(wheelIndex);
  wheel.userData.depth = wheelDepth;
  wheel.userData.leadingFaces = leadingFaces;
  wheel.userData.mountPhase = wheelMountPhase;
  wheel.userData.outerRadius = wheelOuterRadius;
  wheel.userData.profilePoints = wheelProfilePoints;
  wheel.userData.rootRadius = wheelRootRadius;
  wheel.userData.teeth = toothCount;
  wheel.userData.toothHalfAngle = toothHalfAngle;
  wheel.userData.toothPitch = toothPitch;
  wheel.userData.trailingFaces = trailingFaces;

  const outputShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 1.5,
    radius: wheelBoreRadius * 0.58,
  });
  outputShaft.userData.role = 'intermittently-rotating-output-shaft';

  const lever = new THREE.Group();
  lever.position.z = leverPlaneZ;
  lever.userData.axis = Z_AXIS.clone();
  lever.userData.role = 'coaxial-right-angle-elbow-lever';
  const leverShape = new THREE.Shape();
  leverShape.moveTo(-0.56, -0.52);
  leverShape.quadraticCurveTo(-0.64, -0.2, -0.54, 0.14);
  leverShape.lineTo(-0.43, upperArmLength - 0.23);
  leverShape.quadraticCurveTo(-0.42, upperArmLength + 0.24, 0, upperArmLength + 0.29);
  leverShape.quadraticCurveTo(0.43, upperArmLength + 0.25, 0.45, upperArmLength - 0.2);
  leverShape.lineTo(0.56, 0.93);
  leverShape.quadraticCurveTo(0.58, 0.45, 0.92, 0.27);
  leverShape.lineTo(rightArmLength - 0.2, 0.25);
  leverShape.quadraticCurveTo(rightArmLength + 0.27, 0.24, rightArmLength + 0.28, 0);
  leverShape.quadraticCurveTo(rightArmLength + 0.26, -0.25, rightArmLength - 0.18, -0.27);
  leverShape.lineTo(0.58, -0.67);
  leverShape.quadraticCurveTo(0.02, -0.82, -0.56, -0.52);
  leverShape.closePath();
  const leverBody = new THREE.Mesh(
    centeredExtrusion(leverShape, leverDepth),
    driverMaterial,
  );
  leverBody.userData.role = 'source-outline-elbow-lever-body';
  lever.add(leverBody);

  const slotBack = makeBeam(
    new THREE.Vector3(
      rightArmLength - slotHalfLength,
      0,
      leverDepth / 2 + 0.032,
    ),
    new THREE.Vector3(
      rightArmLength + slotHalfLength,
      0,
      leverDepth / 2 + 0.032,
    ),
    {
      color: PALETTE.ink,
      depth: 0.04,
      thickness: slotHalfWidth * 2,
    },
  );
  slotBack.userData.role = 'concealed-horizontal-input-pin-slot';
  lever.add(slotBack);
  const slotLip = makeBeam(
    new THREE.Vector3(
      rightArmLength - slotHalfLength,
      0,
      leverDepth / 2 + 0.058,
    ),
    new THREE.Vector3(
      rightArmLength + slotHalfLength,
      0,
      leverDepth / 2 + 0.058,
    ),
    {
      color: PALETTE.driver,
      depth: 0.022,
      thickness: slotHalfWidth * 0.72,
    },
  );
  slotLip.userData.role = 'narrow-visible-slot-opening';
  lever.add(slotLip);

  const pawl = new THREE.Group();
  pawl.position.set(0, upperArmLength, pawlPlaneZ - leverPlaneZ);
  pawl.userData.axis = Z_AXIS.clone();
  pawl.userData.length = pawlLength;
  pawl.userData.role = 'one-reversible-throw-over-pawl';
  const pawlShape = new THREE.Shape();
  pawlShape.moveTo(-0.13, 0.16);
  pawlShape.quadraticCurveTo(
    pawlLength * 0.24,
    0.28,
    pawlLength * 0.52,
    0.29,
  );
  pawlShape.quadraticCurveTo(
    pawlLength * 0.7,
    0.31,
    pawlLength * 0.77,
    0.7,
  );
  pawlShape.lineTo(pawlLength * 0.94, 0.74);
  pawlShape.lineTo(pawlLength, 0.1);
  pawlShape.lineTo(pawlLength, 0);
  pawlShape.lineTo(pawlLength * 0.84, -0.13);
  pawlShape.quadraticCurveTo(
    pawlLength * 0.42,
    -0.12,
    -0.12,
    -0.13,
  );
  pawlShape.closePath();
  const pawlBody = new THREE.Mesh(
    centeredExtrusion(pawlShape, pawlDepth),
    pawlMaterial,
  );
  pawlBody.userData.role = 'source-profile-hooked-pawl-body';
  pawl.add(pawlBody);
  const pawlTipMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 16, 12),
    whiteMaterial,
  );
  pawlTipMarker.position.set(
    pawlLength,
    0,
    pawlDepth / 2 + 0.04,
  );
  pawlTipMarker.userData.role = 'white-single-pawl-contact-marker';
  pawl.add(pawlTipMarker);
  lever.add(pawl);
  const pawlPivotStud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 0.78, 28),
    inkMaterial,
  );
  pawlPivotStud.rotation.x = Math.PI / 2;
  pawlPivotStud.position.set(
    0,
    upperArmLength,
    (pawlPlaneZ - leverPlaneZ) / 2,
  );
  pawlPivotStud.userData.role = 'one-elbow-carried-pawl-pivot-stud';
  lever.add(pawlPivotStud);

  const inputSlider = new THREE.Group();
  inputSlider.position.set(rightArmLength, 0, inputPlaneZ);
  inputSlider.userData.role = 'strictly-vertical-reciprocating-input-slider';
  const inputStem = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourceInputHalfWidth * sourceScale * 0.72,
      inputStemLength,
      0.2,
    ),
    driverMaterial,
  );
  inputStem.position.y = inputStemLength / 2;
  inputStem.userData.role = 'vertically-translating-input-stem';
  inputSlider.add(inputStem);
  const inputPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.7, 28),
    inkMaterial,
  );
  inputPin.rotation.x = Math.PI / 2;
  inputPin.position.z = -0.14;
  inputPin.userData.role = 'slider-pin-engaged-in-elbow-slot';
  inputSlider.add(inputPin);
  const inputEye = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.055, 9, 40),
    driverMaterial,
  );
  inputEye.position.z = 0.05;
  inputEye.userData.role = 'input-slider-joint-eye';
  inputSlider.add(inputEye);
  const inputMotionIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      sourceInputHalfWidth * sourceScale * 0.8,
      0.13,
      0.218,
    ),
    whiteMaterial,
  );
  inputMotionIndex.position.y = inputStemLength * 0.64;
  inputMotionIndex.userData.role = 'white-rectilinear-input-index';
  inputSlider.add(inputMotionIndex);

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-rear-support-and-slider-guides';
  const baseY = -wheelOuterRadius - 0.42;
  const baseRail = makeBeam(
    new THREE.Vector3(-2.95, baseY, rearFrameZ),
    new THREE.Vector3(rightArmLength + 0.72, baseY, rearFrameZ),
    { color: PALETTE.frame, depth: 0.24, thickness: 0.18 },
  );
  baseRail.userData.role = 'fixed-base-rail';
  const centerPost = makeBeam(
    new THREE.Vector3(0, baseY, rearFrameZ),
    new THREE.Vector3(0, 0, rearFrameZ),
    { color: PALETTE.frame, depth: 0.22, thickness: 0.17 },
  );
  centerPost.userData.role = 'rear-output-bearing-post';
  const centerBearing = new THREE.Mesh(
    new THREE.TorusGeometry(wheelBoreRadius * 0.8, 0.075, 10, 48),
    frameMaterial,
  );
  centerBearing.position.z = rearFrameZ + 0.14;
  centerBearing.userData.role = 'fixed-coaxial-wheel-and-elbow-bearing';
  const guidePostX = rightArmLength + 0.58;
  const guidePost = makeBeam(
    new THREE.Vector3(guidePostX, baseY, rearFrameZ),
    new THREE.Vector3(guidePostX, 2.58, rearFrameZ),
    { color: PALETTE.frame, depth: 0.2, thickness: 0.15 },
  );
  guidePost.userData.role = 'fixed-input-guide-post';
  const guideYPositions = [1.3, 2.12];
  const inputGuides = guideYPositions.map((guideY, index) => {
    const guide = new THREE.Mesh(
      new THREE.TorusGeometry(0.135, 0.045, 9, 34),
      frameMaterial,
    );
    guide.rotation.x = Math.PI / 2;
    guide.position.set(rightArmLength, guideY, inputPlaneZ);
    guide.userData.index = index;
    guide.userData.role = 'fixed-collar-for-vertical-input-slider';
    return guide;
  });
  const guideSupports = guideYPositions.map((guideY, index) => {
    const support = makeBeam(
      new THREE.Vector3(guidePostX, guideY, rearFrameZ),
      new THREE.Vector3(rightArmLength, guideY, inputPlaneZ - 0.08),
      { color: PALETTE.frame, depth: 0.12, thickness: 0.1 },
    );
    support.userData.index = index;
    support.userData.role = 'fixed-slider-guide-standoff';
    return support;
  });
  fixedFrame.add(
    baseRail,
    centerPost,
    centerBearing,
    guidePost,
    ...guideSupports,
    ...inputGuides,
  );

  const cameraEnvelope = new THREE.Mesh(
    new THREE.BoxGeometry(7.9, 7.75, 1.75),
    new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      opacity: 0,
      transparent: true,
    }),
  );
  cameraEnvelope.position.set(0.3, 0.38, 0.15);
  cameraEnvelope.userData.cameraFramingEnvelope = true;
  cameraEnvelope.userData.role = 'invisible-complete-ratchet-feed-envelope';

  root.add(
    cameraEnvelope,
    fixedFrame,
    outputShaft,
    wheel,
    lever,
    inputSlider,
  );

  const pointInsideWheel = (point) => {
    let inside = false;
    for (
      let index = 0, previousIndex = wheelProfilePoints.length - 1;
      index < wheelProfilePoints.length;
      previousIndex = index, index += 1
    ) {
      const current = wheelProfilePoints[index];
      const previous = wheelProfilePoints[previousIndex];
      if (
        (current.y > point.y) !== (previous.y > point.y)
        && point.x < (previous.x - current.x)
          * (point.y - current.y) / (previous.y - current.y) + current.x
      ) inside = !inside;
    }
    return inside;
  };
  const closestWheelProfilePoint = (point) => {
    let distance = Infinity;
    let pointOnProfile = null;
    let segmentIndex = -1;
    for (let index = 0; index < wheelProfilePoints.length; index += 1) {
      const start = wheelProfilePoints[index];
      const end = wheelProfilePoints[
        (index + 1) % wheelProfilePoints.length
      ];
      const edge = end.clone().sub(start);
      const denominator = edge.lengthSq();
      const fraction = denominator < 1e-18
        ? 0
        : THREE.MathUtils.clamp(
          point.clone().sub(start).dot(edge) / denominator,
          0,
          1,
        );
      const candidate = start.clone().addScaledVector(edge, fraction);
      const candidateDistance = point.distanceTo(candidate);
      if (candidateDistance < distance) {
        distance = candidateDistance;
        pointOnProfile = candidate;
        segmentIndex = index;
      }
    }
    return { distance, point: pointOnProfile, segmentIndex };
  };
  const wheelClearanceAt = (worldPoint, wheelAngle) => {
    const localPoint = worldPoint.clone().rotateAround(
      new THREE.Vector2(),
      -wheelAngle,
    );
    const closest = closestWheelProfilePoint(localPoint);
    return {
      clearance: pointInsideWheel(localPoint)
        ? -closest.distance
        : closest.distance,
      localPoint,
      localProfilePoint: closest.point,
      profilePoint: closest.point.clone().rotateAround(
        new THREE.Vector2(),
        wheelAngle,
      ),
      segmentIndex: closest.segmentIndex,
    };
  };

  const smootherKinematics = (value) => {
    const t = THREE.MathUtils.clamp(value, 0, 1);
    return {
      acceleration: 60 * t * (2 * t * t - 3 * t + 1),
      speed: 30 * t * t * (t - 1) * (t - 1),
      value: t * t * t * (t * (t * 6 - 15) + 10),
    };
  };
  const boundaryEpsilon = 1e-12;
  const normalizedCycleCoordinate = (coordinate) => {
    const nearest = Math.round(coordinate);
    return Math.abs(coordinate - nearest) < boundaryEpsilon
      ? nearest
      : coordinate;
  };
  const circleIntersectionForTip = ({
    direction,
    leverAngle,
    tipRadius,
  }) => {
    const pivotPolarAngle = Math.PI / 2 + leverAngle;
    const triangleCosine = THREE.MathUtils.clamp(
      (
        upperArmLength ** 2 + tipRadius ** 2 - pawlLength ** 2
      ) / (2 * upperArmLength * tipRadius),
      -1,
      1,
    );
    const triangleAngle = Math.acos(triangleCosine);
    const tipPolarAngle = pivotPolarAngle - direction * triangleAngle;
    const pivot = new THREE.Vector2(
      Math.cos(pivotPolarAngle) * upperArmLength,
      Math.sin(pivotPolarAngle) * upperArmLength,
    );
    const tip = new THREE.Vector2(
      Math.cos(tipPolarAngle) * tipRadius,
      Math.sin(tipPolarAngle) * tipRadius,
    );
    return {
      pivot,
      pivotPolarAngle,
      tip,
      tipPolarAngle,
      triangleAngle,
      triangleCosine,
    };
  };
  const stateAtTime = (
    time,
    directionOverride = selectedPawlDirection,
  ) => {
    const pawlDirection = directionOverride < 0 ? -1 : 1;
    const cycleCoordinate = normalizedCycleCoordinate(
      time / cyclePeriod + sourceCyclePhase,
    );
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const firstHalf = cyclePhase < 0.5;
    const halfFraction = firstHalf
      ? cyclePhase * 2
      : (cyclePhase - 0.5) * 2;
    const halfMotion = smootherKinematics(halfFraction);
    const halfRate = 2 / cyclePeriod;
    const leverAngle = firstHalf
      ? -leverAmplitude + toothPitch * halfMotion.value
      : leverAmplitude - toothPitch * halfMotion.value;
    const leverAngularSpeed = (
      firstHalf ? 1 : -1
    ) * toothPitch * halfMotion.speed * halfRate;
    const leverAngularAcceleration = (
      firstHalf ? 1 : -1
    ) * toothPitch * halfMotion.acceleration * halfRate ** 2;
    const driving = pawlDirection > 0 ? firstHalf : !firstHalf;
    const driveFraction = driving ? halfMotion.value : null;
    const wheelOffset = pawlDirection > 0
      ? rightWheelOffset
      : leftWheelOffset;
    let wheelStepCoordinate;
    let wheelAngularSpeed;
    let wheelAngularAcceleration;
    if (pawlDirection > 0) {
      wheelStepCoordinate = firstHalf
        ? cycleIndex + halfMotion.value
        : cycleIndex + 1;
      wheelAngularSpeed = firstHalf
        ? toothPitch * halfMotion.speed * halfRate
        : 0;
      wheelAngularAcceleration = firstHalf
        ? toothPitch * halfMotion.acceleration * halfRate ** 2
        : 0;
    } else {
      wheelStepCoordinate = firstHalf
        ? -cycleIndex
        : -cycleIndex - halfMotion.value;
      wheelAngularSpeed = firstHalf
        ? 0
        : -toothPitch * halfMotion.speed * halfRate;
      wheelAngularAcceleration = firstHalf
        ? 0
        : -toothPitch * halfMotion.acceleration * halfRate ** 2;
    }
    const wheelAngle = wheelOffset + wheelStepCoordinate * toothPitch;
    const slipFraction = driving ? null : halfFraction;
    let pawlTipRadius = pawlContactRadius;
    let pawlTipRadialSpeed = 0;
    let pawlTipRadialAcceleration = 0;
    let stage;
    if (driving) {
      stage = pawlDirection > 0
        ? 'right-side-pawl-indexes-wheel-counterclockwise'
        : 'left-side-pawl-indexes-wheel-clockwise';
    } else if (slipFraction < slipLiftEnd) {
      const lift = smootherKinematics(slipFraction / slipLiftEnd);
      const localRate = halfRate / slipLiftEnd;
      pawlTipRadius = THREE.MathUtils.lerp(
        pawlContactRadius,
        pawlClearRadius,
        lift.value,
      );
      pawlTipRadialSpeed = (
        pawlClearRadius - pawlContactRadius
      ) * lift.speed * localRate;
      pawlTipRadialAcceleration = (
        pawlClearRadius - pawlContactRadius
      ) * lift.acceleration * localRate ** 2;
      stage = pawlDirection > 0
        ? 'right-side-pawl-lifts-out-of-tooth-space'
        : 'left-side-pawl-lifts-out-of-tooth-space';
    } else if (slipFraction < slipSettleStart) {
      pawlTipRadius = pawlClearRadius;
      stage = pawlDirection > 0
        ? 'right-side-pawl-slips-over-one-stationary-tooth'
        : 'left-side-pawl-slips-over-one-stationary-tooth';
    } else {
      const settle = smootherKinematics(
        (slipFraction - slipSettleStart) / (1 - slipSettleStart),
      );
      const localRate = halfRate / (1 - slipSettleStart);
      pawlTipRadius = THREE.MathUtils.lerp(
        pawlClearRadius,
        pawlContactRadius,
        settle.value,
      );
      pawlTipRadialSpeed = (
        pawlContactRadius - pawlClearRadius
      ) * settle.speed * localRate;
      pawlTipRadialAcceleration = (
        pawlContactRadius - pawlClearRadius
      ) * settle.acceleration * localRate ** 2;
      stage = pawlDirection > 0
        ? 'right-side-pawl-settles-on-next-tooth-face'
        : 'left-side-pawl-settles-on-next-tooth-face';
    }
    const tipClosure = circleIntersectionForTip({
      direction: pawlDirection,
      leverAngle,
      tipRadius: pawlTipRadius,
    });
    const triangleSine = Math.sqrt(Math.max(
      1e-18,
      1 - tipClosure.triangleCosine ** 2,
    ));
    const cosineDerivative = 1 / (2 * upperArmLength)
      - (
        upperArmLength ** 2 - pawlLength ** 2
      ) / (2 * upperArmLength * pawlTipRadius ** 2);
    const triangleAngleRadialDerivative = -cosineDerivative / triangleSine;
    const pawlTipPolarSpeed = leverAngularSpeed
      - pawlDirection * triangleAngleRadialDerivative
        * pawlTipRadialSpeed;
    const pivotVelocity = new THREE.Vector2(
      -tipClosure.pivot.y * leverAngularSpeed,
      tipClosure.pivot.x * leverAngularSpeed,
    );
    const pawlTipVelocity = new THREE.Vector2(
      Math.cos(tipClosure.tipPolarAngle) * pawlTipRadialSpeed
        - Math.sin(tipClosure.tipPolarAngle) * pawlTipRadius
          * pawlTipPolarSpeed,
      Math.sin(tipClosure.tipPolarAngle) * pawlTipRadialSpeed
        + Math.cos(tipClosure.tipPolarAngle) * pawlTipRadius
          * pawlTipPolarSpeed,
    );
    const pawlVector = tipClosure.tip.clone().sub(tipClosure.pivot);
    const pawlAbsoluteAngle = Math.atan2(pawlVector.y, pawlVector.x);
    const relativePawlAngle = pawlAbsoluteAngle - leverAngle;
    const relativeTipVelocity = pawlTipVelocity.clone().sub(pivotVelocity);
    const pawlAbsoluteAngularSpeed = (
      pawlVector.x * relativeTipVelocity.y
        - pawlVector.y * relativeTipVelocity.x
    ) / pawlLength ** 2;
    const relativePawlAngularSpeed = pawlAbsoluteAngularSpeed
      - leverAngularSpeed;

    const activeToothIndex = THREE.MathUtils.euclideanModulo(
      pawlDirection > 0 ? -cycleIndex : cycleIndex,
      toothCount,
    );
    const nextToothIndex = THREE.MathUtils.euclideanModulo(
      pawlDirection > 0 ? -(cycleIndex + 1) : cycleIndex + 1,
      toothCount,
    );
    const activeFace = pawlDirection > 0
      ? leadingFaces[activeToothIndex]
      : trailingFaces[activeToothIndex];
    const activeFaceAngle = activeFace.angle + wheelAngle;
    const activeFacePoint = new THREE.Vector2(
      Math.cos(activeFaceAngle) * pawlContactRadius,
      Math.sin(activeFaceAngle) * pawlContactRadius,
    );
    const activeFaceNormal = pawlDirection > 0
      ? new THREE.Vector2(
        Math.sin(activeFaceAngle),
        -Math.cos(activeFaceAngle),
      )
      : new THREE.Vector2(
        -Math.sin(activeFaceAngle),
        Math.cos(activeFaceAngle),
      );
    const activeFaceVelocity = new THREE.Vector2(
      -activeFacePoint.y * wheelAngularSpeed,
      activeFacePoint.x * wheelAngularSpeed,
    );
    const contactVelocityDifference = pawlTipVelocity.clone().sub(
      activeFaceVelocity,
    );
    const contactEngaged = driving;
    const pawlProfile = wheelClearanceAt(tipClosure.tip, wheelAngle);

    const sliderY = rightArmLength * Math.tan(leverAngle);
    const secant = 1 / Math.cos(leverAngle);
    const sliderVelocityY = rightArmLength * secant ** 2
      * leverAngularSpeed;
    const sliderAccelerationY = rightArmLength * secant ** 2 * (
      leverAngularAcceleration
        + 2 * Math.tan(leverAngle) * leverAngularSpeed ** 2
    );
    const slotStation = rightArmLength * secant;
    const slotStationSpeed = rightArmLength * secant
      * Math.tan(leverAngle) * leverAngularSpeed;
    const sliderPoint = new THREE.Vector3(
      rightArmLength,
      sliderY,
      inputPlaneZ,
    );
    const slotPointWorld = new THREE.Vector2(
      Math.cos(leverAngle) * slotStation,
      Math.sin(leverAngle) * slotStation,
    );
    return {
      activeFaceAngle,
      activeFaceNormal,
      activeFacePoint,
      activeToothIndex,
      contactEngaged,
      contactNormalVelocityError: contactEngaged
        ? Math.abs(contactVelocityDifference.dot(activeFaceNormal))
        : null,
      contactPointError: contactEngaged
        ? tipClosure.tip.distanceTo(activeFacePoint)
        : null,
      contactSurfaceVelocityError: contactEngaged
        ? contactVelocityDifference.length()
        : null,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      driveFraction,
      driving,
      inputAcceleration: new THREE.Vector3(0, sliderAccelerationY, 0),
      inputPositionError: Math.hypot(
        slotPointWorld.x - sliderPoint.x,
        slotPointWorld.y - sliderPoint.y,
      ),
      inputVelocity: new THREE.Vector3(0, sliderVelocityY, 0),
      leverAngle,
      leverAngularAcceleration,
      leverAngularSpeed,
      nextToothIndex,
      pawlAbsoluteAngle,
      pawlAbsoluteAngularSpeed,
      pawlDirection,
      pawlSide: pawlDirection > 0
        ? 'engraved-right-side-counterclockwise-feed'
        : 'opposite-left-side-clockwise-feed',
      pawlLengthError: tipClosure.pivot.distanceTo(tipClosure.tip)
        - pawlLength,
      pawlPivot: tipClosure.pivot,
      pawlProfileClearance: pawlProfile.clearance,
      pawlProfilePoint: pawlProfile.profilePoint,
      pawlProfileSegmentIndex: pawlProfile.segmentIndex,
      pawlRelativeAngle: relativePawlAngle,
      pawlRelativeAngularSpeed: relativePawlAngularSpeed,
      pawlTip: tipClosure.tip,
      pawlTipPolarAngle: tipClosure.tipPolarAngle,
      pawlTipRadialAcceleration,
      pawlTipRadialSpeed,
      pawlTipRadius,
      pawlTipVelocity,
      pivotVelocity,
      sliderAccelerationY,
      sliderPoint,
      sliderVelocityY,
      slipFraction,
      slotPointWorld,
      slotStation,
      slotStationError: slotStation - rightArmLength,
      slotStationSpeed,
      stage,
      teethAdvanced: wheelStepCoordinate,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
      wheelDwelling: !driving,
      wheelOffset,
    };
  };

  root.userData.mechanism =
    'rectilinear-slider-coaxial-elbow-reversible-pawl-ratchet-feed';
  root.userData.cameraDistanceScale = 0.98;
  root.userData.blocks = {
    baseRail,
    cameraEnvelope,
    centerBearing,
    centerPost,
    fixedFrame,
    guidePost,
    guideSupports,
    inputEye,
    inputGuides,
    inputMotionIndex,
    inputPin,
    inputSlider,
    inputStem,
    lever,
    leverBody,
    outputShaft,
    pawl,
    pawlBody,
    pawlPivotStud,
    pawlTipMarker,
    slotBack,
    slotLip,
    wheel,
    wheelBody,
    wheelHub,
    wheelIndex,
    wheelRotor,
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    cyclePeriod,
    cyclesPerSecond,
    inputPlaneZ,
    inputStemLength,
    leftWheelOffset,
    leverAmplitude,
    leverDepth,
    leverPlaneZ,
    pawlClearRadius,
    pawlContactRadius,
    pawlDepth,
    pawlLength,
    pawlPlaneZ,
    rearFrameZ,
    rightArmLength,
    rightWheelOffset,
    slotHalfLength,
    slotHalfWidth,
    slipLiftEnd,
    slipSettleStart,
    sourceContactPoint: sourceContactPoint.clone(),
    sourceCyclePhase,
    sourceImageHeight,
    sourceImageWidth,
    sourceInputHalfWidth,
    sourceInputTop: sourceInputTop.clone(),
    sourceLeftFaceAngle,
    sourceMappedRightJoint,
    sourceMappedUpperPivot,
    sourcePawlTip: sourcePawlTip.clone(),
    sourceRightFaceAngle,
    sourceRightJoint: sourceRightJoint.clone(),
    sourceScale,
    sourceUpperPivot: sourceUpperPivot.clone(),
    sourceWheelBoreRadius,
    sourceWheelCenter: sourceWheelCenter.clone(),
    sourceWheelHubRadius,
    sourceWheelOuterRadius,
    sourceWheelRootRadius,
    toothCount,
    toothHalfAngle,
    toothHalfPhase,
    toothPitch,
    upperArmLength,
    wheelBoreRadius,
    wheelDepth,
    wheelHubRadius,
    wheelMountPhase,
    wheelOuterRadius,
    wheelPlaneZ,
    wheelRootRadius,
  };
  root.userData.getPawlDirection = () => selectedPawlDirection;
  root.userData.setPawlDirection = (direction) => {
    selectedPawlDirection = direction < 0 ? -1 : 1;
    return selectedPawlDirection;
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.wheelClearanceAt = wheelClearanceAt;
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(wheel, state.wheelAngle);
    setSpin(outputShaft, state.wheelAngle);
    lever.rotation.z = state.leverAngle;
    lever.userData.angularSpeed = state.leverAngularSpeed;
    pawl.rotation.z = state.pawlRelativeAngle;
    pawl.userData.absoluteAngularSpeed = state.pawlAbsoluteAngularSpeed;
    pawl.userData.direction = state.pawlDirection;
    pawl.userData.side = state.pawlSide;
    inputSlider.position.copy(state.sliderPoint);
    inputSlider.userData.velocity = state.inputVelocity.clone();
    wheel.userData.angle = state.wheelAngle;
    wheel.userData.angularSpeed = state.wheelAngularSpeed;
    outputShaft.userData.angle = state.wheelAngle;
    outputShaft.userData.angularSpeed = state.wheelAngularSpeed;
    root.userData.contacts = {
      coaxialWheelAndElbow: {
        centerDistance: 0,
        leverAngle: state.leverAngle,
        wheelAngle: state.wheelAngle,
      },
      pawlToothFace: {
        direction: state.pawlDirection,
        engaged: state.contactEngaged,
        error: state.contactPointError,
        normal: state.contactEngaged
          ? new THREE.Vector3(
            state.activeFaceNormal.x,
            state.activeFaceNormal.y,
            0,
          )
          : null,
        normalVelocityError: state.contactNormalVelocityError,
        pawlPoint: state.contactEngaged
          ? new THREE.Vector3(
            state.pawlTip.x,
            state.pawlTip.y,
            pawlPlaneZ,
          )
          : null,
        profileClearance: state.pawlProfileClearance,
        surfaceVelocityError: state.contactSurfaceVelocityError,
        toothIndex: state.contactEngaged
          ? state.activeToothIndex
          : null,
        toothPoint: state.contactEngaged
          ? new THREE.Vector3(
            state.activeFacePoint.x,
            state.activeFacePoint.y,
            pawlPlaneZ,
          )
          : null,
      },
      rectilinearPinInElbowSlot: {
        inputPoint: state.sliderPoint.clone(),
        positionError: state.inputPositionError,
        slotPoint: new THREE.Vector3(
          state.slotPointWorld.x,
          state.slotPointWorld.y,
          inputPlaneZ,
        ),
        slotStation: state.slotStation,
        slotStationError: state.slotStationError,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  const model = finish(root, update, new THREE.Vector3(5.6, 4.2, 11.8));
  cameraEnvelope.castShadow = false;
  cameraEnvelope.receiveShadow = false;
  pawlTipMarker.castShadow = false;
  pawlTipMarker.receiveShadow = false;
  inputMotionIndex.castShadow = false;
  inputMotionIndex.receiveShadow = false;
  return model;
}

function sharedPivotDoubleStrokeRatchet() {
  const root = new THREE.Group();
  const origin = new THREE.Vector2();
  const fullTurn = Math.PI * 2;
  // Brown draws about 52 fine teeth with hooked points. 53 lets the right
  // pawl bear on its face at the engraved contact angle (within 0.07
  // degrees) and lets both fingers clear the teeth as they reset. Each tooth
  // is Brown's hook: a short face undercut 0.04 pitch under a sharp tip and
  // a straight back from the tip to the next root, which the fingers push
  // clockwise. Without the old flat land the back is longer, so the teeth
  // are 0.33 deep to keep both drive forces within 62 degrees of its normal.
  const toothCount = 53;
  const toothPitch = fullTurn / toothCount;
  const ratchetOuterRadius = 2.38;
  const ratchetRootRadius = 2.05;
  const toothOuterStartPhase = -0.04;
  const toothOuterEndPhase = 0;
  const sourceWheelCenter = new THREE.Vector2(260, 299);
  const sourceWheelTipRadius = 182;
  const sourceScale = ratchetOuterRadius / sourceWheelTipRadius;
  const sourceFixedLeverPivot = new THREE.Vector2(338, 49);
  const sourceSharedPawlPivot = new THREE.Vector2(257, 66);
  const sourceLeftPawlTip = new THREE.Vector2(94, 203);
  const sourceRightPawlTip = new THREE.Vector2(408, 193);
  const sourceHandleEnd = new THREE.Vector2(421, 17);
  const sourcePointToModel = (point) => new THREE.Vector2(
    (point.x - sourceWheelCenter.x) * sourceScale,
    (sourceWheelCenter.y - point.y) * sourceScale,
  );
  const modelPointToSource = (point) => new THREE.Vector2(
    sourceWheelCenter.x + point.x / sourceScale,
    sourceWheelCenter.y - point.y / sourceScale,
  );
  const wheelCenter = new THREE.Vector2();
  const fixedLeverPivot = sourcePointToModel(sourceFixedLeverPivot);
  const sharedPawlPivotAtSource = sourcePointToModel(
    sourceSharedPawlPivot,
  );
  const leftSourceContact = sourcePointToModel(sourceLeftPawlTip);
  const rightSourceContact = sourcePointToModel(sourceRightPawlTip);
  const pawlCarrierRadius = fixedLeverPivot.distanceTo(
    sharedPawlPivotAtSource,
  );
  const pawlCarrierMeanAngle = Math.atan2(
    sharedPawlPivotAtSource.y - fixedLeverPivot.y,
    sharedPawlPivotAtSource.x - fixedLeverPivot.x,
  );
  const handleMeanAngle = pawlCarrierMeanAngle + Math.PI;
  const handleLength = sourcePointToModel(sourceHandleEnd).distanceTo(
    fixedLeverPivot,
  );
  const leftSourceContactAngle = Math.atan2(
    leftSourceContact.y,
    leftSourceContact.x,
  );
  const leftFaceFraction = 0.43;
  const rightFaceFraction = 0.28;
  const rightToothOffset = -16;
  const cyclesPerSecond = 0.3;
  const inputCyclePeriod = 1 / cyclesPerSecond;
  const initialCyclePhase = 0.25;

  const unmountedOuterEnd = new THREE.Vector2(
    Math.cos(toothOuterEndPhase * toothPitch) * ratchetOuterRadius,
    Math.sin(toothOuterEndPhase * toothPitch) * ratchetOuterRadius,
  );
  const unmountedNextRoot = new THREE.Vector2(
    Math.cos(toothPitch) * ratchetRootRadius,
    Math.sin(toothPitch) * ratchetRootRadius,
  );
  // The finger surface, not its axis, bears on the tooth face.
  const pawlFingerRadius = 0.045;
  const unmountedFaceTangent = unmountedNextRoot.clone()
    .sub(unmountedOuterEnd)
    .normalize();
  const unmountedFaceNormal = new THREE.Vector2(
    unmountedFaceTangent.y,
    -unmountedFaceTangent.x,
  );
  const leftUnmountedDrivePoint = unmountedOuterEnd.clone().lerp(
    unmountedNextRoot,
    leftFaceFraction,
  ).addScaledVector(unmountedFaceNormal, pawlFingerRadius);
  const rightUnmountedDrivePoint = unmountedOuterEnd.clone().lerp(
    unmountedNextRoot,
    rightFaceFraction,
  ).addScaledVector(unmountedFaceNormal, pawlFingerRadius);
  const leftContactOrbitRadius = leftUnmountedDrivePoint.length();
  const rightContactOrbitRadius = rightUnmountedDrivePoint.length();
  const ratchetMountPhase = leftSourceContactAngle - Math.atan2(
    leftUnmountedDrivePoint.y,
    leftUnmountedDrivePoint.x,
  );
  // The wheel is thick enough that both flat pawls, stacked on their common
  // pin, lie inside its tooth band and bear on the teeth in their own planes.
  const ratchetDepth = 0.39;
  const ratchet = makeSpringIndexedRatchet({
    boreRadius: 0.23,
    depth: ratchetDepth,
    mountPhase: ratchetMountPhase,
    outerRadius: ratchetOuterRadius,
    rootRadius: ratchetRootRadius,
    teeth: toothCount,
    toothOuterEndPhase,
    toothOuterStartPhase,
  });
  const ratchetPlaneZ = 0.215;
  ratchet.position.z = ratchetPlaneZ;
  ratchet.userData.role =
    'fifty-three-tooth-clockwise-double-stroke-ratchet-wheel';
  const ratchetBody = ratchet.userData.body;
  const ratchetHub = ratchet.userData.hub;
  ratchet.userData.rotor.remove(ratchet.userData.indicator);
  delete ratchet.userData.indicator;
  // Brown's inner face circle: a low rim step just inside the tooth roots,
  // clear of the pawl fingers, which bear no nearer the axis than 2.035.
  const ratchetFaceStep = new THREE.Mesh(
    makeAnnulusGeometry(1.94, 2.03, 0.02),
    ratchetBody.material,
  );
  ratchetFaceStep.position.z = ratchetDepth / 2 + 0.01;
  ratchetFaceStep.userData.role = 'ratchet-face-rim-step';
  ratchet.userData.rotor.add(ratchetFaceStep);
  const ratchetShaft = makeShaft({ length: 0.62, radius: 0.19 });
  ratchetShaft.position.z = ratchetPlaneZ;
  ratchetShaft.userData.radius = 0.19;
  ratchetShaft.userData.role = 'clockwise-output-shaft-keyed-to-ratchet';

  const leftDriveFace = ratchet.userData.toothFaces[0];
  const leftDrivePointLocal = leftDriveFace.outer.clone().lerp(
    leftDriveFace.root,
    leftFaceFraction,
  ).addScaledVector(leftDriveFace.outwardNormal, pawlFingerRadius);
  const rightDriveFace = ratchet.userData.toothFaces[0];
  const rightDrivePointOnToothZero = rightDriveFace.outer.clone().lerp(
    rightDriveFace.root,
    rightFaceFraction,
  ).addScaledVector(rightDriveFace.outwardNormal, pawlFingerRadius);
  const rightDrivePointLocal = rightDrivePointOnToothZero.clone()
    .rotateAround(origin, rightToothOffset * toothPitch);
  const rightDrivePointLocalAngle = Math.atan2(
    rightDrivePointLocal.y,
    rightDrivePointLocal.x,
  );

  const sharedPawlPivotAtRockerAngle = (rockerAngle) => (
    fixedLeverPivot.clone().add(
      new THREE.Vector2(
        Math.cos(rockerAngle - Math.PI) * pawlCarrierRadius,
        Math.sin(rockerAngle - Math.PI) * pawlCarrierRadius,
      ),
    )
  );
  const unwrapNear = (angle, target) => {
    let unwrapped = angle;
    while (unwrapped - target > Math.PI) unwrapped -= fullTurn;
    while (unwrapped - target < -Math.PI) unwrapped += fullTurn;
    return unwrapped;
  };
  const constrainedContactAngleAt = ({
    anchor,
    expectedAngle,
    orbitRadius,
    pawlLength,
  }) => {
    const centerDistance = anchor.length();
    const cosine = THREE.MathUtils.clamp(
      (
        centerDistance ** 2 + orbitRadius ** 2 - pawlLength ** 2
      ) / (2 * centerDistance * orbitRadius),
      -1,
      1,
    );
    const separation = Math.acos(cosine);
    const anchorAngle = Math.atan2(anchor.y, anchor.x);
    const candidates = [
      anchorAngle - separation,
      anchorAngle + separation,
    ].map((angle) => unwrapNear(angle, expectedAngle));
    return Math.abs(candidates[0] - expectedAngle)
      <= Math.abs(candidates[1] - expectedAngle)
      ? candidates[0]
      : candidates[1];
  };
  const calibrationAtAmplitude = (rockerAmplitude) => {
    const lowAnchor = sharedPawlPivotAtRockerAngle(
      handleMeanAngle + rockerAmplitude,
    );
    const highAnchor = sharedPawlPivotAtRockerAngle(
      handleMeanAngle - rockerAmplitude,
    );
    const leftPawlLength = lowAnchor.distanceTo(leftDrivePointLocal);
    const leftEndWorldAngle = constrainedContactAngleAt({
      anchor: highAnchor,
      expectedAngle: leftSourceContactAngle - toothPitch * 0.36,
      orbitRadius: leftContactOrbitRadius,
      pawlLength: leftPawlLength,
    });
    const risingAdvance = leftSourceContactAngle - leftEndWorldAngle;
    const rightStartWorldAngle = rightDrivePointLocalAngle - risingAdvance;
    const rightStartPoint = new THREE.Vector2(
      Math.cos(rightStartWorldAngle) * rightContactOrbitRadius,
      Math.sin(rightStartWorldAngle) * rightContactOrbitRadius,
    );
    const rightPawlLength = highAnchor.distanceTo(rightStartPoint);
    const rightEndWorldAngle = constrainedContactAngleAt({
      anchor: lowAnchor,
      expectedAngle: rightStartWorldAngle - toothPitch * 0.64,
      orbitRadius: rightContactOrbitRadius,
      pawlLength: rightPawlLength,
    });
    const fallingAdvance = rightStartWorldAngle - rightEndWorldAngle;
    return {
      fallingAdvance,
      highAnchor,
      leftEndWorldAngle,
      leftPawlLength,
      lowAnchor,
      rightEndWorldAngle,
      rightPawlLength,
      rightStartWorldAngle,
      risingAdvance,
      totalAdvance: risingAdvance + fallingAdvance,
    };
  };
  let amplitudeLower = 0.04;
  let amplitudeUpper = 0.2;
  for (let iteration = 0; iteration < 88; iteration += 1) {
    const middle = (amplitudeLower + amplitudeUpper) / 2;
    if (calibrationAtAmplitude(middle).totalAdvance < toothPitch) {
      amplitudeLower = middle;
    } else {
      amplitudeUpper = middle;
    }
  }
  const rockerAmplitude = (amplitudeLower + amplitudeUpper) / 2;
  const calibration = calibrationAtAmplitude(rockerAmplitude);
  if (Math.abs(calibration.totalAdvance - toothPitch) > 2e-14) {
    throw new RangeError(
      'Movement 206 pawl strokes do not close by one ratchet pitch.',
    );
  }
  const {
    fallingAdvance,
    highAnchor,
    leftEndWorldAngle,
    leftPawlLength,
    lowAnchor,
    rightEndWorldAngle,
    rightPawlLength,
    rightStartWorldAngle,
    risingAdvance,
  } = calibration;
  const pawlAngleBetween = (anchor, point) => Math.atan2(
    point.y - anchor.y,
    point.x - anchor.x,
  );
  const leftStartPawlAngle = pawlAngleBetween(
    lowAnchor,
    leftDrivePointLocal,
  );
  const leftEndPawlAngle = pawlAngleBetween(
    highAnchor,
    new THREE.Vector2(
      Math.cos(leftEndWorldAngle) * leftContactOrbitRadius,
      Math.sin(leftEndWorldAngle) * leftContactOrbitRadius,
    ),
  );
  const rightStartPawlAngle = pawlAngleBetween(
    highAnchor,
    new THREE.Vector2(
      Math.cos(rightStartWorldAngle) * rightContactOrbitRadius,
      Math.sin(rightStartWorldAngle) * rightContactOrbitRadius,
    ),
  );
  const rightEndPawlAngle = pawlAngleBetween(
    lowAnchor,
    new THREE.Vector2(
      Math.cos(rightEndWorldAngle) * rightContactOrbitRadius,
      Math.sin(rightEndWorldAngle) * rightContactOrbitRadius,
    ),
  );
  const leftResetSwing = -0.18;
  const rightResetSwing = 0.15;
  const returnedPawlAngleAt = ({
    endAngle,
    fraction,
    startAngle,
    swing,
  }) => {
    const eased = smoothStep01(fraction);
    const unwrappedStart = unwrapNear(startAngle, endAngle);
    return THREE.MathUtils.lerp(unwrappedStart, endAngle, eased)
      + swing * Math.sin(Math.PI * fraction) ** 2;
  };

  const rocker = makePlanarRotor();
  const rockerRotor = rocker.userData.rotor;
  // Brown draws only the wheel, the two pawls on their common pin and the
  // lever on its hatched fulcrum; there is no stand or painted index.
  const rockerPlaneZ = 0.56;
  rocker.position.set(
    fixedLeverPivot.x,
    fixedLeverPivot.y,
    rockerPlaneZ,
  );
  rocker.userData.role =
    'vibrating-input-lever-carrying-one-common-pawl-pin';
  const fulcrumRadius = 0.15;
  const leverDepth = 0.16;
  const leverBevel = Math.min(0.025, leverDepth * 0.12);
  const leverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.6,
  });
  const fulcrumCenter = new THREE.Vector2(0, 0);
  const pinCenter = new THREE.Vector2(-pawlCarrierRadius, 0);
  const handleEndCenter = new THREE.Vector2(handleLength - 0.07, 0);
  const fulcrumBore = {
    center: fulcrumCenter,
    radius: fulcrumRadius + leverBevel + 0.006,
  };
  const rockerBody = new THREE.Mesh(
    centeredExtrusion(
      taperedLinkShape(pinCenter, 0.17, fulcrumCenter, 0.29, [fulcrumBore]),
      leverDepth,
    ),
    leverMaterial,
  );
  rockerBody.userData.vibratingLeverBody = true;
  rockerRotor.add(rockerBody);
  const rockerHandle = new THREE.Mesh(
    centeredExtrusion(
      taperedLinkShape(
        fulcrumCenter,
        0.285,
        handleEndCenter,
        0.075,
        [fulcrumBore],
      ),
      leverDepth - 0.01,
    ),
    leverMaterial,
  );
  rockerHandle.userData.vibratingLeverHandle = true;
  rockerRotor.add(rockerHandle);
  const rockerHub = rockerBody;
  const commonPawlJoint = new THREE.Group();
  commonPawlJoint.position.x = -pawlCarrierRadius;
  commonPawlJoint.userData.commonMovingPawlPivot = true;
  commonPawlJoint.userData.role =
    'single-moving-pin-carrying-two-independent-pawls';
  const commonPawlStudLength = 0.66;
  const commonPawlStud = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, commonPawlStudLength, 24),
    matte(PALETTE.ink, { metalness: 0.23, roughness: 0.47 }),
  );
  commonPawlStud.rotation.x = Math.PI / 2;
  commonPawlStud.position.z = leverDepth / 2 + 0.05 - commonPawlStudLength / 2;
  commonPawlStud.userData.commonPawlPivotStud = true;
  const commonPawlHead = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.05, 28),
    matte(PALETTE.ink, { metalness: 0.23, roughness: 0.47 }),
  );
  commonPawlHead.rotation.x = Math.PI / 2;
  commonPawlHead.position.z = leverDepth / 2 + leverBevel + 0.03;
  commonPawlJoint.add(commonPawlStud, commonPawlHead);
  rockerRotor.add(commonPawlJoint);

  // Brown's pawls are broad flat bands that run round outside the tooth
  // tips; the square-cut end of each drops a short nose into one tooth
  // space. Each outline is set out at mid-stroke in the wheel's frame: a
  // band concentric with the wheel and clear of the tips, ending square just
  // past a rounded nose that enters the tooth space through its opening and
  // ends on the solved finger centre. The nose is part of the flat pawl, in
  // the ratchet's tooth plane.
  const pawlBandHalfWidth = 0.12;
  const pawlBandClearance = 0.11;
  const pawlArcRadius = ratchetOuterRadius + pawlBandHalfWidth
    + pawlBandClearance;
  const pawlNoseBaseHalfWidth = 0.1;
  const pawlNoseFaceBias = 0.15;
  const pawlNoseBlendAngle = 0.08;
  // The extrusion bevel grows the outline by its bevel size, so the drawn
  // nose radius is the finger radius less that bevel.
  const pawlNoseOutlineRadius = pawlFingerRadius - Math.min(0.025, 0.13 * 0.12);
  const hookedPawlOutline = (right) => {
    const pivot = sharedPawlPivotAtRockerAngle(handleMeanAngle);
    const orbitRadius = right
      ? rightContactOrbitRadius
      : leftContactOrbitRadius;
    const pawlLength = right ? rightPawlLength : leftPawlLength;
    const contactAngle = constrainedContactAngleAt({
      anchor: pivot,
      expectedAngle: right
        ? (rightStartWorldAngle + rightEndWorldAngle) / 2
        : (leftSourceContactAngle + leftEndWorldAngle) / 2,
      orbitRadius,
      pawlLength,
    });
    const drivenAngle = contactAngle - (
      right ? rightDrivePointLocalAngle : leftSourceContactAngle
    );
    const contact = new THREE.Vector2(
      Math.cos(contactAngle) * orbitRadius,
      Math.sin(contactAngle) * orbitRadius,
    );
    const tipAngles = ratchet.userData.profilePoints
      .filter((point) => point.length() > ratchetOuterRadius - 1e-6)
      .map((point) => unwrapNear(
        Math.atan2(point.y, point.x) + drivenAngle,
        contactAngle,
      ) - contactAngle);
    const aheadTip = Math.min(...tipAngles.filter((angle) => angle > 0));
    const behindTip = Math.max(...tipAngles.filter((angle) => angle < 0));
    const openingAngle = contactAngle + (aheadTip + behindTip) / 2;
    const opening = new THREE.Vector2(
      Math.cos(openingAngle) * ratchetOuterRadius,
      Math.sin(openingAngle) * ratchetOuterRadius,
    );
    // The nose leaves the tooth space between its opening and the driven
    // face's normal, so the finger's front half bears on that face.
    const face = ratchet.userData.toothFaces[
      right ? THREE.MathUtils.euclideanModulo(rightToothOffset, toothCount) : 0
    ];
    const faceNormal = face.outwardNormal.clone().rotateAround(
      origin,
      drivenAngle,
    );
    const noseDirection = opening.clone().sub(contact).normalize()
      .multiplyScalar(1 - pawlNoseFaceBias)
      .addScaledVector(faceNormal, pawlNoseFaceBias)
      .normalize();
    const noseNormal = new THREE.Vector2(-noseDirection.y, noseDirection.x);
    const innerRadius = pawlArcRadius - pawlBandHalfWidth;
    const outerRadius = pawlArcRadius + pawlBandHalfWidth;
    // Where each nose flank meets the band's inner edge.
    const flankBase = (side) => {
      const start = contact.clone().addScaledVector(
        noseNormal,
        side * pawlNoseOutlineRadius,
      );
      const along = start.dot(noseDirection);
      const distance = -along + Math.sqrt(
        along ** 2 - start.lengthSq() + (innerRadius + 0.02) ** 2,
      );
      return start.clone().addScaledVector(noseDirection, distance)
        .addScaledVector(noseNormal, side * (
          pawlNoseBaseHalfWidth - pawlNoseOutlineRadius
        ));
    };
    // The band starts inside the pawl's eye, clear of the common pin.
    const pivotAngle = Math.atan2(pivot.y, pivot.x)
      + Math.sign(contactAngle - Math.atan2(pivot.y, pivot.x))
        * 0.105 / pivot.length();
    const unwrapToPivot = (point) => unwrapNear(
      Math.atan2(point.y, point.x),
      contactAngle,
    );
    const direction = Math.sign(pivotAngle - contactAngle);
    const bases = [flankBase(1), flankBase(-1)].sort(
      (first, second) => direction * (
        unwrapToPivot(first) - unwrapToPivot(second)
      ),
    );
    // bases[0] is the flank nearer the band's square end, bases[1] nearer
    // the pivot.
    // The square end continues the outer nose flank straight out to the
    // band's outer edge, so the cut end's inner corner is the nose.
    const flankAlong = bases[0].dot(noseDirection);
    const endCorner = bases[0].clone().addScaledVector(
      noseDirection,
      -flankAlong + Math.sqrt(
        flankAlong ** 2 - bases[0].lengthSq() + outerRadius ** 2,
      ),
    );
    const endAngle = unwrapToPivot(endCorner);
    const pivotRadius = pivot.length();
    // Brown's bands bow clear of the teeth and come down to them only at
    // their working ends: the centreline rises from the end radius to the
    // pin, flattening as it reaches the eye. The long right band keeps close
    // round the teeth for its first part and rises in its middle, as drawn.
    const riseProfile = right ? 1 : 0;
    const radiusAt = (angle) => {
      const fraction = THREE.MathUtils.clamp(
        (angle - endAngle) / (pivotAngle - endAngle), 0, 1);
      return THREE.MathUtils.lerp(
        pawlArcRadius,
        pivotRadius,
        THREE.MathUtils.lerp(Math.sin(Math.PI / 2 * fraction), smoothStep01(fraction), riseProfile),
      );
    };
    // The band narrows into the pin eye.
    const halfWidthAt = (angle) => {
      const fraction = (angle - endAngle) / (pivotAngle - endAngle);
      return THREE.MathUtils.lerp(
        pawlBandHalfWidth,
        0.09,
        smoothStep01(THREE.MathUtils.clamp((fraction - 0.8) / 0.2, 0, 1)),
      );
    };
    const polar = (angle, radius) => new THREE.Vector2(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    );
    const points = [];
    const arcSteps = 72;
    // Outer edge from the pivot round to the square end.
    for (let index = 0; index <= arcSteps; index += 1) {
      const angle = THREE.MathUtils.lerp(pivotAngle, endAngle, index / arcSteps);
      points.push(polar(angle, radiusAt(angle) + halfWidthAt(angle)));
    }
    // Down the square end and its nose flank, round the nose, and back
    // along the inner edge to the pivot.
    points.push(bases[0].clone());
    const noseAngle = Math.atan2(-noseDirection.y, -noseDirection.x);
    const firstSide = Math.sign(
      bases[0].clone().sub(contact).dot(noseNormal),
    );
    const noseSteps = 16;
    for (let index = 0; index <= noseSteps; index += 1) {
      const angle = noseAngle - firstSide * (
        Math.PI / 2 - Math.PI * index / noseSteps
      );
      points.push(polar(angle, pawlNoseOutlineRadius).add(contact));
    }
    // The inner edge runs down into the nose along a smooth curve, so the
    // end reads as the band's own square end rather than a separate wedge.
    const returnStart = unwrapToPivot(bases[1]) + direction * pawlNoseBlendAngle;
    const blendEnd = polar(returnStart, radiusAt(returnStart) - halfWidthAt(returnStart));
    const noseEnd = points.at(-1).clone();
    const blendSteps = 12;
    for (let index = 1; index < blendSteps; index += 1) {
      const t = index / blendSteps;
      points.push(noseEnd.clone().multiplyScalar((1 - t) ** 2)
        .addScaledVector(bases[1], 2 * t * (1 - t))
        .addScaledVector(blendEnd, t ** 2));
    }
    for (let index = 0; index <= arcSteps; index += 1) {
      const angle = THREE.MathUtils.lerp(
        returnStart,
        pivotAngle,
        index / arcSteps,
      );
      points.push(polar(angle, radiusAt(angle) - halfWidthAt(angle)));
    }
    const pawlAngle = Math.atan2(contact.y - pivot.y, contact.x - pivot.x);
    const local = points.map((point) => point.clone().sub(pivot)
      .rotateAround(origin, -pawlAngle));
    // Keep the outline counter-clockwise for the extrusion.
    let area = 0;
    for (let index = 0; index < local.length; index += 1) {
      const current = local[index];
      const next = local[(index + 1) % local.length];
      area += current.x * next.y - next.x * current.y;
    }
    return area < 0 ? local.reverse() : local;
  };
  const pawlDepth = 0.13;
  const pawlHubDepth = 0.16;
  const pawlHubBevel = Math.min(0.025, pawlHubDepth * 0.12);
  // Both pawls lie in the wheel's tooth band (0.02 to 0.41).
  const leftPawlPlaneZ = 0.12;
  const rightPawlPlaneZ = 0.32;
  const pawlOptions = {
    boreRadius: 0.085 + pawlHubBevel + 0.006,
    depth: pawlDepth,
    fingerRadius: pawlFingerRadius,
    hubDepth: pawlHubDepth,
    // Brown's small pin eye clears the tooth tips at the low reversal.
    hubRadius: 0.155,
  };
  const leftPawl = makeCurvedSharedPivotPawl({
    ...pawlOptions,
    length: leftPawlLength,
    outline: hookedPawlOutline(false),
    role: 'left-curved-pawl-driving-while-common-pin-rises',
  });
  const rightPawl = makeCurvedSharedPivotPawl({
    ...pawlOptions,
    length: rightPawlLength,
    outline: hookedPawlOutline(true),
    role: 'right-curved-pawl-driving-while-common-pin-falls',
  });
  const leftPawlBody = leftPawl.userData.body;
  const leftPawlContactFinger = leftPawl.userData.contactFinger;
  const leftPawlPivotHub = leftPawl.userData.pivotHub;
  const rightPawlBody = rightPawl.userData.body;
  const rightPawlContactFinger = rightPawl.userData.contactFinger;
  const rightPawlPivotHub = rightPawl.userData.pivotHub;

  const fixedLeverShaft = makeShaft({ length: 0.36, radius: fulcrumRadius });
  fixedLeverShaft.position.set(
    fixedLeverPivot.x,
    fixedLeverPivot.y,
    rockerPlaneZ + 0.04,
  );
  fixedLeverShaft.userData.fixedPivot = true;
  fixedLeverShaft.userData.radius = fulcrumRadius;
  fixedLeverShaft.userData.role = 'fixed-fulcrum-of-vibrating-lever';

  root.add(
    ratchetShaft,
    ratchet,
    fixedLeverShaft,
    leftPawl,
    rightPawl,
    rocker,
  );

  const pointInsideRatchet = (point) => {
    const profile = ratchet.userData.profilePoints;
    let inside = false;
    for (
      let index = 0, previousIndex = profile.length - 1;
      index < profile.length;
      previousIndex = index, index += 1
    ) {
      const current = profile[index];
      const previous = profile[previousIndex];
      if (
        (current.y > point.y) !== (previous.y > point.y)
        && point.x < (previous.x - current.x)
          * (point.y - current.y) / (previous.y - current.y) + current.x
      ) inside = !inside;
    }
    return inside;
  };
  const closestRatchetProfilePoint = (point) => {
    const profile = ratchet.userData.profilePoints;
    let distance = Infinity;
    let pointOnProfile = null;
    let segmentIndex = -1;
    for (let index = 0; index < profile.length; index += 1) {
      const start = profile[index];
      const end = profile[(index + 1) % profile.length];
      const edge = end.clone().sub(start);
      const denominator = edge.lengthSq();
      const fraction = denominator < 1e-18
        ? 0
        : THREE.MathUtils.clamp(
          point.clone().sub(start).dot(edge) / denominator,
          0,
          1,
        );
      const candidate = start.clone().addScaledVector(edge, fraction);
      const candidateDistance = point.distanceTo(candidate);
      if (candidateDistance < distance) {
        distance = candidateDistance;
        pointOnProfile = candidate;
        segmentIndex = index;
      }
    }
    return { distance, point: pointOnProfile, segmentIndex };
  };
  const profileClearanceAt = (worldPoint, drivenAngle) => {
    const localPoint = worldPoint.clone().rotateAround(origin, -drivenAngle);
    const closest = closestRatchetProfilePoint(localPoint);
    const inside = pointInsideRatchet(localPoint);
    return {
      clearance: closest.distance < 1e-10
        ? 0
        : (inside ? -closest.distance : closest.distance),
      inside,
      localPoint,
      localProfilePoint: closest.point,
      profilePoint: closest.point.clone().rotateAround(origin, drivenAngle),
      segmentIndex: closest.segmentIndex,
    };
  };
  const selectedDrivePointAt = ({
    cycleIndex,
    drivenAngle,
    right,
  }) => {
    const toothIndex = THREE.MathUtils.euclideanModulo(
      cycleIndex + (right ? rightToothOffset : 0),
      toothCount,
    );
    const toothZeroPoint = right
      ? rightDrivePointOnToothZero
      : leftDrivePointLocal;
    const localPoint = toothZeroPoint.clone().rotateAround(
      origin,
      toothIndex * toothPitch,
    );
    return {
      localPoint,
      point: localPoint.clone().rotateAround(origin, drivenAngle),
      toothIndex,
    };
  };
  const snapCycleCoordinate = (coordinate) => {
    const nearestHalf = Math.round(coordinate * 2) / 2;
    return Math.abs(coordinate - nearestHalf) < 1e-12
      ? nearestHalf
      : coordinate;
  };
  const stateAtCycleCoordinate = (coordinate) => {
    const cycleCoordinate = snapCycleCoordinate(coordinate);
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const leftDriving = cyclePhase < 0.5;
    const rightDriving = !leftDriving;
    const workingHalfFraction = leftDriving
      ? cyclePhase * 2
      : (cyclePhase - 0.5) * 2;
    const easedHalfFraction = smoothStep01(workingHalfFraction);
    const rockerAngle = handleMeanAngle
      + rockerAmplitude * Math.cos(fullTurn * cyclePhase);
    const rockerAngularSpeed = -rockerAmplitude * fullTurn
      * cyclesPerSecond * Math.sin(fullTurn * cyclePhase);
    const sharedPawlPivot = sharedPawlPivotAtRockerAngle(rockerAngle);
    const activePawlLength = leftDriving
      ? leftPawlLength
      : rightPawlLength;
    const activeOrbitRadius = leftDriving
      ? leftContactOrbitRadius
      : rightContactOrbitRadius;
    const expectedActiveWorldAngle = leftDriving
      ? THREE.MathUtils.lerp(
        leftSourceContactAngle,
        leftEndWorldAngle,
        easedHalfFraction,
      )
      : THREE.MathUtils.lerp(
        rightStartWorldAngle,
        rightEndWorldAngle,
        easedHalfFraction,
      );
    const activeContactWorldAngle = constrainedContactAngleAt({
      anchor: sharedPawlPivot,
      expectedAngle: expectedActiveWorldAngle,
      orbitRadius: activeOrbitRadius,
      pawlLength: activePawlLength,
    });
    const localDrivenAngle = activeContactWorldAngle - (
      leftDriving ? leftSourceContactAngle : rightDrivePointLocalAngle
    );
    const drivenAngle = -cycleIndex * toothPitch + localDrivenAngle;
    const activeTooth = selectedDrivePointAt({
      cycleIndex,
      drivenAngle,
      right: rightDriving,
    });
    const activeContactPoint = new THREE.Vector2(
      Math.cos(activeContactWorldAngle) * activeOrbitRadius,
      Math.sin(activeContactWorldAngle) * activeOrbitRadius,
    );
    const activePawlVector = activeContactPoint.clone().sub(
      sharedPawlPivot,
    );
    const activePawlAngle = Math.atan2(
      activePawlVector.y,
      activePawlVector.x,
    );

    const inactivePawlAngle = leftDriving
      ? returnedPawlAngleAt({
        endAngle: rightStartPawlAngle,
        fraction: workingHalfFraction,
        startAngle: rightEndPawlAngle,
        swing: rightResetSwing,
      })
      : returnedPawlAngleAt({
        endAngle: leftStartPawlAngle,
        fraction: workingHalfFraction,
        startAngle: leftEndPawlAngle,
        swing: leftResetSwing,
      });
    const inactivePawlLength = leftDriving
      ? rightPawlLength
      : leftPawlLength;
    const inactivePawlVector = new THREE.Vector2(
      Math.cos(inactivePawlAngle) * inactivePawlLength,
      Math.sin(inactivePawlAngle) * inactivePawlLength,
    );
    const inactiveTip = sharedPawlPivot.clone().add(inactivePawlVector);
    const leftPawlAngle = leftDriving
      ? activePawlAngle
      : inactivePawlAngle;
    const rightPawlAngle = rightDriving
      ? activePawlAngle
      : inactivePawlAngle;
    const leftTip = leftDriving
      ? activeContactPoint
      : inactiveTip;
    const rightTip = rightDriving
      ? activeContactPoint
      : inactiveTip;
    const leftProfileContact = profileClearanceAt(leftTip, drivenAngle);
    const rightProfileContact = profileClearanceAt(rightTip, drivenAngle);

    const anchorRelative = sharedPawlPivot.clone().sub(fixedLeverPivot);
    const anchorDerivative = new THREE.Vector2(
      -anchorRelative.y,
      anchorRelative.x,
    );
    const contactDerivative = new THREE.Vector2(
      -activeContactPoint.y,
      activeContactPoint.x,
    );
    const drivenAngleDerivativePerRockerAngle = activePawlVector.dot(
      anchorDerivative,
    ) / activePawlVector.dot(contactDerivative);
    const drivenAngularSpeed = drivenAngleDerivativePerRockerAngle
      * rockerAngularSpeed;
    const activeAnchorVelocity = anchorDerivative.clone().multiplyScalar(
      rockerAngularSpeed,
    );
    const activeContactVelocity = contactDerivative.clone().multiplyScalar(
      drivenAngularSpeed,
    );
    const relativeTipVelocity = activeContactVelocity.clone().sub(
      activeAnchorVelocity,
    );
    const activePawlAngularSpeed = (
      activePawlVector.x * relativeTipVelocity.y
      - activePawlVector.y * relativeTipVelocity.x
    ) / activePawlVector.lengthSq();
    const reconstructedTipVelocity = activeAnchorVelocity.clone().add(
      new THREE.Vector2(
        -activePawlVector.y * activePawlAngularSpeed,
        activePawlVector.x * activePawlAngularSpeed,
      ),
    );

    const activeFace = ratchet.userData.toothFaces[
      activeTooth.toothIndex
    ];
    const activeFaceNormal = activeFace.outwardNormal.clone().rotateAround(
      origin,
      drivenAngle,
    );
    const activeForceDirection = leftDriving
      ? sharedPawlPivot.clone().sub(activeContactPoint).normalize()
      : activeContactPoint.clone().sub(sharedPawlPivot).normalize();
    const activeTorque = activeContactPoint.x * activeForceDirection.y
      - activeContactPoint.y * activeForceDirection.x;
    const activeProfileContact = leftDriving
      ? leftProfileContact
      : rightProfileContact;
    return {
      activeClockwiseTorque: -activeTorque,
      activeContactPoint,
      activeContactVelocity,
      activeFaceNormal,
      activeFaceSegmentIndex: activeTooth.toothIndex * 3 + 2,
      activeForceDirection,
      activeForceNormalAlignment: activeForceDirection.dot(
        activeFaceNormal,
      ),
      activePawl: leftDriving ? 'left' : 'right',
      activePawlAngle,
      activePawlAngularSpeed,
      activePawlLength,
      activePawlLengthError: Math.abs(
        activePawlVector.length() - activePawlLength,
      ),
      activePawlVector,
      activeProfileContact,
      activeTipVelocityError: reconstructedTipVelocity.distanceTo(
        activeContactVelocity,
      ),
      activeToothIndex: activeTooth.toothIndex,
      activeToothLocalPoint: activeTooth.localPoint,
      activeToothPoint: activeTooth.point,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      drivenAngle,
      drivenAngleDerivativePerRockerAngle,
      drivenAngularSpeed,
      easedHalfFraction,
      fallingAdvance,
      inactivePawl: leftDriving ? 'right' : 'left',
      inactivePawlLengthError: Math.abs(
        inactivePawlVector.length()
          - inactivePawlLength,
      ),
      inactiveProfileSegmentIndex: leftDriving
        ? rightProfileContact.segmentIndex
        : leftProfileContact.segmentIndex,
      inputReversing: Math.abs(rockerAngularSpeed) < 1e-12,
      leftContactMode: leftDriving
        ? 'hooked-driving-contact-on-long-tooth-face'
        : 'free-pawl-resetting-clear-of-ratchet-profile',
      leftDriving,
      leftPawlAngle,
      leftPawlLengthError: Math.abs(
        sharedPawlPivot.distanceTo(leftTip) - leftPawlLength,
      ),
      leftProfileClearance: leftProfileContact.clearance,
      leftProfileContact,
      leftTip,
      localDrivenAngle,
      pitchesAdvancedClockwise: -drivenAngle / toothPitch,
      rightContactMode: rightDriving
        ? 'hooked-driving-contact-on-long-tooth-face'
        : 'free-pawl-resetting-clear-of-ratchet-profile',
      rightDriving,
      rightPawlAngle,
      rightPawlLengthError: Math.abs(
        sharedPawlPivot.distanceTo(rightTip) - rightPawlLength,
      ),
      rightProfileClearance: rightProfileContact.clearance,
      rightProfileContact,
      rightTip,
      risingAdvance,
      rockerAngle,
      rockerAngularSpeed,
      sharedPawlPivot,
      stage: leftDriving
        ? 'common-pin-rising-left-pawl-drives-right-pawl-resets'
        : 'common-pin-falling-right-pawl-drives-left-pawl-resets',
      toothContactError: activeContactPoint.distanceTo(activeTooth.point),
      workingHalfFraction,
    };
  };
  const stateAtTime = (time) => stateAtCycleCoordinate(
    initialCyclePhase + time * cyclesPerSecond,
  );

  root.userData.archetype =
    'shared-pivot-opposed-curved-pawl-double-stroke-forty-four-tooth-ratchet';
  root.userData.mechanism =
    'one-vibrating-lever-pin-carries-two-independent-curved-pawls-driving-one-clockwise-ratchet-on-opposite-strokes';
  root.userData.variant =
    'left-pawl-rising-right-pawl-falling-with-one-tooth-per-complete-vibration';
  root.userData.blocks = {
    commonPawlHead,
    commonPawlJoint,
    commonPawlStud,
    fixedLeverShaft,
    leftPawl,
    leftPawlBody,
    leftPawlContactFinger,
    leftPawlPivotHub,
    ratchet,
    ratchetBody,
    ratchetHub,
    ratchetShaft,
    rightPawl,
    rightPawlBody,
    rightPawlContactFinger,
    rightPawlPivotHub,
    rocker,
    rockerBody,
    rockerHandle,
    rockerHub,
  };
  root.userData.canonicalCyclePhases = {
    fallingMidpoint: 0.75,
    highReversal: 0.5,
    lowReversal: 1,
    risingMidpoint: 0.25,
    risingStart: 0,
    sourcePose: initialCyclePhase,
  };
  root.userData.canonicalTimes = {
    fallingMidpoint: inputCyclePeriod * 0.5,
    fullWheelClosure: inputCyclePeriod * toothCount,
    highReversal: inputCyclePeriod * 0.25,
    lowReversal: inputCyclePeriod * 0.75,
    nextSourcePose: inputCyclePeriod,
    sourcePose: 0,
  };
  root.userData.geometry = {
    axis: Z_AXIS.clone(),
    cyclesPerSecond,
    fallingAdvance,
    fixedLeverPivot: fixedLeverPivot.clone(),
    fullTurn,
    handleLength,
    handleMeanAngle,
    highAnchor: highAnchor.clone(),
    initialCyclePhase,
    inputCyclePeriod,
    leftContactOrbitRadius,
    leftDrivePointLocal: leftDrivePointLocal.clone(),
    leftEndPawlAngle,
    leftEndWorldAngle,
    leftFaceFraction,
    leftPawlLength,
    leftPawlPlaneZ,
    leftResetSwing,
    leftSourceContact: leftSourceContact.clone(),
    leftSourceContactAngle,
    leftStartPawlAngle,
    lowAnchor: lowAnchor.clone(),
    pawlCarrierMeanAngle,
    pawlCarrierRadius,
    pawlFingerRadius,
    ratchetDepth,
    ratchetMountPhase,
    ratchetOuterRadius,
    ratchetRootRadius,
    rightContactOrbitRadius,
    rightDrivePointLocal: rightDrivePointLocal.clone(),
    rightDrivePointOnToothZero: rightDrivePointOnToothZero.clone(),
    rightEndPawlAngle,
    rightEndWorldAngle,
    rightFaceFraction,
    rightPawlLength,
    rightPawlPlaneZ,
    rightResetSwing,
    rightSourceContact: rightSourceContact.clone(),
    rightStartPawlAngle,
    rightStartWorldAngle,
    rightToothOffset,
    risingAdvance,
    rockerAmplitude,
    rockerPlaneZ,
    sharedPawlPivotAtSource: sharedPawlPivotAtSource.clone(),
    toothCount,
    toothOuterEndPhase,
    toothOuterStartPhase,
    toothPitch,
  };
  root.userData.modelPointToSource = modelPointToSource;
  root.userData.profileClearanceAt = profileClearanceAt;
  root.userData.sourceAnimation = { available: false };
  root.userData.sourceAnchors = {
    fixedLeverPivot: sourceFixedLeverPivot.clone(),
    handleEnd: sourceHandleEnd.clone(),
    leftPawlTip: sourceLeftPawlTip.clone(),
    rightPawlTip: sourceRightPawlTip.clone(),
    sharedPawlPivot: sourceSharedPawlPivot.clone(),
    wheelCenter: sourceWheelCenter.clone(),
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceRaster = {
    imageSize: new THREE.Vector2(525, 525),
    modelUnitsPerPixel: sourceScale,
    sourceUrl: 'https://507movements.com/mm_206.html',
    wheelToothCount: toothCount,
    wheelToothTipRadiusPixels: sourceWheelTipRadius,
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    clockwiseOutput: true,
    continuousAcrossBothInputStrokes: true,
    fallingPawl: 'right',
    fallingStrokeAdvance: fallingAdvance,
    inputCyclePeriod,
    outputTurnsPerInputCycle: -1 / toothCount,
    risingPawl: 'left',
    risingStrokeAdvance: risingAdvance,
    toothCount,
    toothPitch,
    wheelClosureInputCycles: toothCount,
    wheelPitchesPerInputCycle: 1,
    zeroOutputSpeedOnlyAtInputReversals: true,
  };
  root.userData.cameraDistanceScale = 1.03;

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(ratchet, state.drivenAngle);
    setSpin(ratchetShaft, state.drivenAngle);
    setSpin(rocker, state.rockerAngle);
    leftPawl.position.set(
      state.sharedPawlPivot.x,
      state.sharedPawlPivot.y,
      leftPawlPlaneZ,
    );
    leftPawl.rotation.z = state.leftPawlAngle;
    rightPawl.position.set(
      state.sharedPawlPivot.x,
      state.sharedPawlPivot.y,
      rightPawlPlaneZ,
    );
    rightPawl.rotation.z = state.rightPawlAngle;
    ratchet.userData.angularSpeed = state.drivenAngularSpeed;
    ratchetShaft.userData.angularSpeed = state.drivenAngularSpeed;
    rocker.userData.angularSpeed = state.rockerAngularSpeed;
    root.userData.contacts = {
      leftPawlTooth: {
        clearance: state.leftProfileClearance,
        driving: state.leftDriving,
        engaged: state.leftDriving,
        error: state.leftDriving ? state.toothContactError : null,
        mode: state.leftContactMode,
        pawlTip: new THREE.Vector3(
          state.leftTip.x,
          state.leftTip.y,
          ratchet.position.z + ratchetDepth / 2,
        ),
        profileSegmentIndex: state.leftProfileContact.segmentIndex,
        ratchetPoint: state.leftDriving
          ? new THREE.Vector3(
            state.leftProfileContact.profilePoint.x,
            state.leftProfileContact.profilePoint.y,
            ratchet.position.z + ratchetDepth / 2,
          )
          : null,
        toothIndex: state.leftDriving ? state.activeToothIndex : null,
        velocityError: state.leftDriving
          ? state.activeTipVelocityError
          : null,
      },
      rightPawlTooth: {
        clearance: state.rightProfileClearance,
        driving: state.rightDriving,
        engaged: state.rightDriving,
        error: state.rightDriving ? state.toothContactError : null,
        mode: state.rightContactMode,
        pawlTip: new THREE.Vector3(
          state.rightTip.x,
          state.rightTip.y,
          ratchet.position.z + ratchetDepth / 2,
        ),
        profileSegmentIndex: state.rightProfileContact.segmentIndex,
        ratchetPoint: state.rightDriving
          ? new THREE.Vector3(
            state.rightProfileContact.profilePoint.x,
            state.rightProfileContact.profilePoint.y,
            ratchet.position.z + ratchetDepth / 2,
          )
          : null,
        toothIndex: state.rightDriving ? state.activeToothIndex : null,
        velocityError: state.rightDriving
          ? state.activeTipVelocityError
          : null,
      },
    };
    root.userData.kinematics = state;
  };
  // Brown draws no ground line or shadow.
  root.userData.hideGround = true;
  update(0);
  return finish(root, update, new THREE.Vector3(1.5, 1.1, 12.4));
}

function pinGuidedHalfToothIntermittentLockingDrive() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const constructionScale = 0.23;
  const centerDistance = 12 * constructionScale;
  const driverCenter = new THREE.Vector2(0, 0);
  const pinionCenter = new THREE.Vector2(-centerDistance, 0);
  const driverDepth = 0.34;
  const pinionDepth = 0.4;

  // Brown's plate, measured about both centres, fixes the proportions: the
  // wheel's teeth are fine (tips at 8.9 and roots at 8.1 construction units
  // against the plain rim at 9.25), eleven of them span about 88 degrees up
  // to the pin, and the pinion's tips run 20 degrees apart: thirteen teeth
  // with five positions missing where the concave lock faces the wheel. The
  // working construction keeps that: a forty-five-position wheel (8 degrees)
  // with eleven installed teeth and an eighteen-position pinion (20 degrees)
  // with thirteen teeth. The active ratio is still 5:2, so the pitch radii
  // match the plate's, the tips stay inside the plain rim, and the pinion
  // makes one turn while the wheel turns 144 degrees. (The site's animation
  // used twelve coarse teeth over 135 degrees at 2:1.)
  // The entry pin sits on the wheel's pitch circle, so the guide flank is
  // the offset epicycloid it traces on the pinion: the pin drives at exactly
  // the pitch ratio until the first tooth takes over. The plain rim stands
  // only slightly beyond the tooth tips, as drawn, and every relief on the
  // wheel is generated by sweeping the pinion outline through the cycle.
  const driverEquivalentToothCount = 45;
  const pinionEquivalentToothCount = 18;
  const driverInstalledToothCount = 11;
  const pinionInstalledToothCount = 13;
  const indexingRatio = driverEquivalentToothCount / pinionEquivalentToothCount;
  const indexArc = fullTurn / indexingRatio;
  const rawCenterDistance = 12;
  const rawDriverPitchRadius = rawCenterDistance * indexingRatio
    / (indexingRatio + 1);
  const rawPinionPitchRadius = rawCenterDistance / (indexingRatio + 1);
  const rawModule = 2 * rawPinionPitchRadius / pinionEquivalentToothCount;
  const rawAddendum = 0.8 * rawModule;
  // Deep enough that the mating tips, swept with the 0.08 running
  // clearance, never cut below the root.
  const rawDedendum = Math.max(rawModule, rawAddendum + 0.09);
  const rawPlainRadius = 9.1;
  const rawLockRadius = rawPlainRadius + 0.125;
  const rawDriverRootRadius = rawDriverPitchRadius - rawDedendum;
  const rawDriverToothOuterRadius = rawDriverPitchRadius + rawAddendum;
  const rawPinionRootRadius = rawPinionPitchRadius - rawDedendum;
  const rawPinionToothOuterRadius = rawPinionPitchRadius + rawAddendum;
  const driverPitchRadius = rawDriverPitchRadius * constructionScale;
  const pinionPitchRadius = rawPinionPitchRadius * constructionScale;
  const driverPitchAngle = fullTurn / driverEquivalentToothCount;
  const pinionPitchAngle = fullTurn / pinionEquivalentToothCount;
  const driverRootRadius = rawDriverRootRadius * constructionScale;
  const driverToothOuterRadius = rawDriverToothOuterRadius * constructionScale;
  const driverPlainRadius = rawPlainRadius * constructionScale;
  const pinionRootRadius = rawPinionRootRadius * constructionScale;
  const pinionToothOuterRadius = rawPinionToothOuterRadius * constructionScale;
  const pinionLockRadius = rawLockRadius * constructionScale;
  const lockRadialClearance = pinionLockRadius - driverPlainRadius;
  const lockAngularPlay = 2 * Math.asin(
    lockRadialClearance / (2 * centerDistance),
  );
  const driverBoreRadius = constructionScale;
  const pinionBoreRadius = constructionScale;
  const rawPinRadius = 0.375;
  const driverPinRadius = rawPinRadius * constructionScale;
  const rawDriverPinLocal = new THREE.Vector2(-rawDriverPitchRadius, 0);
  const driverPinLocal = rawDriverPinLocal.clone()
    .multiplyScalar(constructionScale);

  const degreesToRadians = THREE.MathUtils.degToRad;
  const rotateVector2 = (vector, angle) => {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return new THREE.Vector2(
      cosine * vector.x - sine * vector.y,
      sine * vector.x + cosine * vector.y,
    );
  };
  const rawPolarPoint = (radius, angle) => new THREE.Vector2(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
  );
  const scaleRawPoints = (points) => points.map(
    (point) => point.clone().multiplyScalar(constructionScale),
  );
  const appendDistinct = (target, points, tolerance = 0.00001) => {
    for (const point of points) {
      if (target.length === 0 || target.at(-1).distanceTo(point) > tolerance) {
        target.push(point);
      }
    }
  };
  const signedAngle = (point) => Math.atan2(point.y, point.x);
  const rawArc = (center, radius, start, end, segments) => Array.from(
    { length: segments + 1 },
    (_, index) => rawPolarPoint(
      radius,
      THREE.MathUtils.lerp(start, end, index / segments),
    ).add(center),
  );

  // Near-square teeth, as Brown draws them: straight flanks leaning 8
  // degrees off radial, a flat top and a flat root.
  const flankLean = Math.tan(degreesToRadians(8));
  const toothHalfThicknessAt = (pitchRadius, toothCount, radius) => (
    Math.PI * pitchRadius / toothCount / 2 * 0.94
      + (pitchRadius - radius) * flankLean
  );

  // Pinion: thirteen teeth on an eighteen-position circle; the five
  // positions facing the wheel at rest are cut away by the concave lock arc.
  const pinionMissingToothCount = pinionEquivalentToothCount
    - pinionInstalledToothCount;
  const pinionToothCenterAngles = Array.from(
    { length: pinionInstalledToothCount },
    (_, index) => -(pinionMissingToothCount / 2 + 0.5) * pinionPitchAngle
      - index * pinionPitchAngle,
  );
  const pinionMissingToothCenterAngles = Array.from(
    { length: pinionMissingToothCount },
    (_, index) => (index - (pinionMissingToothCount - 1) / 2)
      * pinionPitchAngle,
  );
  const pinionLockCornerAngle = Math.acos(
    (rawCenterDistance ** 2 + rawPinionRootRadius ** 2 - rawLockRadius ** 2)
      / (2 * rawCenterDistance * rawPinionRootRadius),
  );
  const pinionToothPoints = (centerAngle) => {
    const halfRoot = toothHalfThicknessAt(
      rawPinionPitchRadius,
      pinionEquivalentToothCount,
      rawPinionRootRadius,
    ) / rawPinionRootRadius;
    const halfTip = toothHalfThicknessAt(
      rawPinionPitchRadius,
      pinionEquivalentToothCount,
      rawPinionToothOuterRadius,
    ) / rawPinionToothOuterRadius;
    // Clockwise order (decreasing angle), matching the outline direction.
    return [
      rawPolarPoint(rawPinionRootRadius, centerAngle + halfRoot),
      ...rawArc(
        new THREE.Vector2(),
        rawPinionToothOuterRadius,
        centerAngle + halfTip,
        centerAngle - halfTip,
        2,
      ),
      rawPolarPoint(rawPinionRootRadius, centerAngle - halfRoot),
    ];
  };
  const pinionToothedProfileRaw = [
    rawPolarPoint(rawPinionRootRadius, -pinionLockCornerAngle),
  ];
  pinionToothCenterAngles.forEach((centerAngle, index) => {
    const teeth = pinionToothPoints(centerAngle);
    if (index > 0) {
      const previousEnd = signedAngle(pinionToothedProfileRaw.at(-1));
      const nextStart = signedAngle(teeth[0]);
      let resolvedPrevious = previousEnd;
      while (resolvedPrevious < nextStart) resolvedPrevious += fullTurn;
      appendDistinct(pinionToothedProfileRaw, rawArc(
        new THREE.Vector2(),
        rawPinionRootRadius,
        resolvedPrevious,
        nextStart,
        3,
      ));
    } else {
      appendDistinct(pinionToothedProfileRaw, rawArc(
        new THREE.Vector2(),
        rawPinionRootRadius,
        -pinionLockCornerAngle,
        signedAngle(teeth[0]),
        4,
      ));
    }
    appendDistinct(pinionToothedProfileRaw, teeth);
  });
  {
    let lastAngle = signedAngle(pinionToothedProfileRaw.at(-1));
    while (lastAngle < pinionLockCornerAngle) lastAngle += fullTurn;
    appendDistinct(pinionToothedProfileRaw, rawArc(
      new THREE.Vector2(),
      rawPinionRootRadius,
      lastAngle,
      pinionLockCornerAngle,
      4,
    ));
  }
  const pinionOutlineRaw = pinionToothedProfileRaw.map((point) => (
    point.clone()
  ));
  const pocketCenter = new THREE.Vector2(rawCenterDistance, 0);
  const pocketHalfAngle = Math.atan2(
    rawPolarPoint(rawPinionRootRadius, pinionLockCornerAngle).y,
    rawCenterDistance
      - rawPolarPoint(rawPinionRootRadius, pinionLockCornerAngle).x,
  );
  appendDistinct(pinionOutlineRaw, rawArc(
    pocketCenter,
    rawLockRadius,
    Math.PI - pocketHalfAngle,
    Math.PI + pocketHalfAngle,
    40,
  ));
  if (pinionOutlineRaw.at(-1).distanceTo(pinionOutlineRaw[0]) < 1e-6) {
    pinionOutlineRaw.pop();
  }

  // Kinematics shared by the construction and the running model.
  const pinionAngleAtPhase = (phase) => -Math.min(
    phase * indexingRatio,
    fullTurn,
  );
  const rawPinionCenter = new THREE.Vector2(-rawCenterDistance, 0);

  // Guide: the pin centre traces an epicycloid on the pinion from the pitch
  // point. The working flank is that path offset by the pin radius and a
  // small running clearance on the clockwise (pushed) side.
  const guideRunningClearance = 0.012;
  const guideThickness = 1.15;
  const guideEntryEndPhase = degreesToRadians(22.5);
  const rawPinPathInPinion = (phase) => rotateVector2(
    rotateVector2(rawDriverPinLocal, phase).sub(rawPinionCenter),
    -pinionAngleAtPhase(phase),
  );
  const guideSamples = 48;
  const guideUpper = [];
  const guideLower = [];
  for (let index = 0; index <= guideSamples; index += 1) {
    const phase = guideEntryEndPhase * (index / guideSamples) ** 1.5;
    const point = rawPinPathInPinion(phase);
    let normal = new THREE.Vector2(0, -1);
    if (phase > 1e-6) {
      const step = Math.max(phase * 1e-4, 1e-7);
      const tangent = rawPinPathInPinion(phase + step)
        .sub(rawPinPathInPinion(phase - step));
      normal = new THREE.Vector2(tangent.y, -tangent.x).normalize();
    }
    guideUpper.push(point.clone().addScaledVector(
      normal,
      rawPinRadius + guideRunningClearance,
    ));
    guideLower.push(point.clone().addScaledVector(
      normal,
      rawPinRadius + guideRunningClearance + guideThickness,
    ));
  }
  const guideRootX = 1.75;
  const guideRootCenter = new THREE.Vector2(
    guideRootX,
    (guideUpper[0].y + guideLower[0].y) / 2,
  );
  const guideTipCenter = guideUpper.at(-1).clone()
    .add(guideLower.at(-1)).multiplyScalar(0.5);
  const guideTipStart = guideUpper.at(-1).clone().sub(guideTipCenter).angle();
  const guideOutlineRaw = [];
  appendDistinct(guideOutlineRaw, [
    new THREE.Vector2(guideRootX, guideUpper[0].y),
    ...guideUpper,
  ]);
  appendDistinct(guideOutlineRaw, rawArc(
    guideTipCenter,
    guideThickness / 2,
    guideTipStart,
    guideTipStart - Math.PI,
    16,
  ));
  appendDistinct(guideOutlineRaw, [
    ...guideLower.slice().reverse(),
    new THREE.Vector2(guideRootX, guideLower[0].y),
  ]);
  appendDistinct(guideOutlineRaw, rawArc(
    guideRootCenter,
    guideThickness / 2,
    -Math.PI / 2,
    -Math.PI * 1.5,
    16,
  ).slice(1, -1));

  // Wheel: fine square teeth on the toothed arc, the plain locking rim, and
  // root-level relief between them. Every point is then limited by the
  // pinion outline (dilated by a running clearance) swept through the index.
  const driverToothCenterAngles = Array.from(
    { length: driverInstalledToothCount },
    // The first tooth is 3.5 wheel pitches behind the pin, so its centre
    // meets a pinion space on the line of centres.
    (_, index) => Math.PI - 3.5 * driverPitchAngle - index * driverPitchAngle,
  );
  const driverToothedStartAngle = driverToothCenterAngles[0]
    + driverPitchAngle / 2;
  const driverToothedEndAngle = driverToothCenterAngles.at(-1)
    - driverPitchAngle / 2;
  const plainRimLeadAngle = Math.PI - indexArc;
  const sweepClearance = 0.08;
  const dilatePolygon = (points, distance) => {
    let area = 0;
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length];
      area += point.x * next.y - next.x * point.y;
    });
    const sign = area > 0 ? 1 : -1;
    return points.map((point, index) => {
      const previous = points[(index - 1 + points.length) % points.length];
      const next = points[(index + 1) % points.length];
      const inEdge = point.clone().sub(previous).normalize();
      const outEdge = next.clone().sub(point).normalize();
      const inNormal = new THREE.Vector2(inEdge.y, -inEdge.x)
        .multiplyScalar(sign);
      const outNormal = new THREE.Vector2(outEdge.y, -outEdge.x)
        .multiplyScalar(sign);
      const bisector = inNormal.clone().add(outNormal);
      if (bisector.lengthSq() < 1e-12) {
        return point.clone().addScaledVector(inNormal, distance);
      }
      bisector.normalize();
      const scale = Math.min(2, 1 / Math.max(bisector.dot(inNormal), 0.5));
      return point.clone().addScaledVector(bisector, distance * scale);
    });
  };
  const sweptPinion = dilatePolygon(pinionOutlineRaw, sweepClearance);
  const raySteps = 3600;
  const rayStep = fullTurn / raySteps;
  const sweptLimit = new Float64Array(raySteps).fill(Infinity);
  const sweepSteps = 1440;
  const rayCos = Float64Array.from({ length: raySteps }, (_, ray) => (
    Math.cos(ray * rayStep)
  ));
  const raySin = Float64Array.from({ length: raySteps }, (_, ray) => (
    Math.sin(ray * rayStep)
  ));
  const sweptX = new Float64Array(sweptPinion.length);
  const sweptY = new Float64Array(sweptPinion.length);
  for (let step = 0; step <= sweepSteps; step += 1) {
    const phase = indexArc * step / sweepSteps;
    // Pinion point in the wheel's frame: rotate by the pinion angle about
    // its centre, then by minus the wheel angle about the wheel centre.
    const pinionAngle = pinionAngleAtPhase(phase);
    const pinionCos = Math.cos(pinionAngle);
    const pinionSin = Math.sin(pinionAngle);
    const wheelCos = Math.cos(-phase);
    const wheelSin = Math.sin(-phase);
    for (let index = 0; index < sweptPinion.length; index += 1) {
      const { x, y } = sweptPinion[index];
      const worldX = pinionCos * x - pinionSin * y + rawPinionCenter.x;
      const worldY = pinionSin * x + pinionCos * y + rawPinionCenter.y;
      sweptX[index] = wheelCos * worldX - wheelSin * worldY;
      sweptY[index] = wheelSin * worldX + wheelCos * worldY;
    }
    for (let index = 0; index < sweptPinion.length; index += 1) {
      const next = (index + 1) % sweptPinion.length;
      const startX = sweptX[index];
      const startY = sweptY[index];
      const edgeX = sweptX[next] - startX;
      const edgeY = sweptY[next] - startY;
      const startAngle = Math.atan2(startY, startX);
      let endAngle = Math.atan2(sweptY[next], sweptX[next]);
      if (endAngle - startAngle > Math.PI) endAngle -= fullTurn;
      if (startAngle - endAngle > Math.PI) endAngle += fullTurn;
      const low = Math.ceil(Math.min(startAngle, endAngle) / rayStep);
      const high = Math.floor(Math.max(startAngle, endAngle) / rayStep);
      const numerator = startX * edgeY - startY * edgeX;
      for (let ray = low; ray <= high; ray += 1) {
        const slot = ((ray % raySteps) + raySteps) % raySteps;
        const denominator = rayCos[slot] * edgeY - raySin[slot] * edgeX;
        if (Math.abs(denominator) < 1e-12) continue;
        const radius = numerator / denominator;
        if (radius <= 0) continue;
        if (radius < sweptLimit[slot]) sweptLimit[slot] = radius;
      }
    }
  }
  const angleWithin = (angle, low, high) => {
    const span = THREE.MathUtils.euclideanModulo(high - low, fullTurn);
    return THREE.MathUtils.euclideanModulo(angle - low, fullTurn) <= span;
  };
  const pinBossHalfAngle = degreesToRadians(3.5);
  const driverTargetRadius = (angle) => {
    if (!angleWithin(angle, driverToothedEndAngle, driverToothedStartAngle)) {
      return rawPlainRadius;
    }
    let nearest = Infinity;
    driverToothCenterAngles.forEach((centerAngle) => {
      const offset = Math.abs(THREE.MathUtils.euclideanModulo(
        angle - centerAngle + Math.PI,
        fullTurn,
      ) - Math.PI);
      nearest = Math.min(nearest, offset);
    });
    const halfWidthConstant = toothHalfThicknessAt(
      rawDriverPitchRadius,
      driverEquivalentToothCount,
      0,
    );
    return THREE.MathUtils.clamp(
      halfWidthConstant / (nearest + flankLean),
      rawDriverRootRadius,
      rawDriverToothOuterRadius,
    );
  };
  const driverRadiusSamples = Array.from({ length: raySteps }, (_, index) => (
    Math.min(driverTargetRadius(index * rayStep), sweptLimit[index])
  ));
  // Douglas-Peucker thinning keeps the rim and flanks within 0.002 units.
  const simplifyClosed = (points, tolerance) => {
    const keep = new Uint8Array(points.length);
    const stack = [[0, points.length - 1]];
    keep[0] = 1;
    keep[points.length - 1] = 1;
    while (stack.length) {
      const [first, last] = stack.pop();
      const a = points[first];
      const b = points[last];
      const edge = b.clone().sub(a);
      const length = Math.max(edge.length(), 1e-12);
      let worst = -1;
      let worstDistance = tolerance;
      for (let index = first + 1; index < last; index += 1) {
        const offset = points[index].clone().sub(a);
        const distance = Math.abs(offset.x * edge.y - offset.y * edge.x)
          / length;
        if (distance > worstDistance) {
          worst = index;
          worstDistance = distance;
        }
      }
      if (worst >= 0) {
        keep[worst] = 1;
        stack.push([first, worst], [worst, last]);
      }
    }
    return points.filter((_, index) => keep[index]);
  };
  // Clockwise from just past the pin, as the former construction ran.
  const outlineStartIndex = Math.round(
    (Math.PI - pinBossHalfAngle) / rayStep,
  );
  const driverOutlineDense = Array.from({ length: raySteps }, (_, step) => {
    const index = THREE.MathUtils.euclideanModulo(
      outlineStartIndex - step,
      raySteps,
    );
    return rawPolarPoint(driverRadiusSamples[index], index * rayStep);
  });
  const driverOutlineRaw = simplifyClosed(driverOutlineDense, 0.002);
  const driverToothedProfileRaw = driverOutlineRaw.filter((point) => (
    angleWithin(point.angle(), driverToothedEndAngle, driverToothedStartAngle)
  ));
  const plainRimSampleIndices = driverRadiusSamples
    .map((radius, index) => (radius >= rawPlainRadius - 1e-9 ? index : -1))
    .filter((index) => index >= 0);
  // The plain arc runs clockwise from its lead end (near the relock side)
  // round to the pin; store its start and end as in the former construction.
  let driverPlainArcStart = null;
  let driverPlainArcEnd = null;
  {
    const plainSet = new Set(plainRimSampleIndices);
    const leadIndex = Math.round(plainRimLeadAngle / rayStep);
    let startIndex = leadIndex;
    while (plainSet.has(THREE.MathUtils.euclideanModulo(startIndex + 1, raySteps))) {
      startIndex += 1;
    }
    let endIndex = leadIndex;
    while (plainSet.has(THREE.MathUtils.euclideanModulo(endIndex - 1, raySteps))) {
      endIndex -= 1;
    }
    driverPlainArcStart = startIndex * rayStep;
    driverPlainArcEnd = THREE.MathUtils.euclideanModulo(
      endIndex * rayStep,
      fullTurn,
    );
  }

  const driverOutline = scaleRawPoints(driverOutlineRaw);
  const pinionOutline = scaleRawPoints(pinionOutlineRaw);
  const guideOutline = scaleRawPoints(guideOutlineRaw);
  const driverToothedProfile = scaleRawPoints(driverToothedProfileRaw);
  const pinionToothedProfile = scaleRawPoints(pinionToothedProfileRaw);

  const shapeFromOutline = (outline, boreRadius = null) => {
    const shape = new THREE.Shape();
    outline.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    });
    shape.closePath();
    if (Number.isFinite(boreRadius)) {
      const bore = new THREE.Path();
      bore.absarc(0, 0, boreRadius, 0, fullTurn, true);
      shape.holes.push(bore);
    }
    return shape;
  };
  const extrudeProfile = (shape, depth) => {
    // The tooth constructions contain intentional radial shoulders. A bevel
    // miter at those nearly coincident vertices can flare beyond the source
    // profile, so the dark face tube supplies the edge treatment instead.
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: false,
      curveSegments: 18,
      depth,
      steps: 1,
    });
    geometry.translate(0, 0, -depth / 2);
    geometry.computeVertexNormals();
    return geometry;
  };
  const makeProfileTube = (outline, z, radius, material, role) => {
    const curve = new THREE.CurvePath();
    for (let index = 0; index < outline.length; index += 1) {
      const start = outline[index];
      const end = outline[(index + 1) % outline.length];
      curve.add(new THREE.LineCurve3(
        new THREE.Vector3(start.x, start.y, z),
        new THREE.Vector3(end.x, end.y, z),
      ));
    }
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(
        curve,
        Math.max(64, outline.length * 2),
        radius,
        6,
        true,
      ),
      material,
    );
    tube.userData.role = role;
    return tube;
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.1,
    roughness: 0.64,
    side: THREE.DoubleSide,
  });
  const pinionMaterial = matte(PALETTE.driven, {
    metalness: 0.11,
    roughness: 0.62,
    side: THREE.DoubleSide,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.21,
    roughness: 0.49,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.2,
    roughness: 0.52,
    side: THREE.DoubleSide,
  });

  const driver = makePlanarRotor();
  driver.position.set(driverCenter.x, driverCenter.y, 0);
  driver.userData.role = 'continuous-half-toothed-locking-driver';
  const driverBody = new THREE.Mesh(
    extrudeProfile(
      shapeFromOutline(driverOutline, driverBoreRadius),
      driverDepth,
    ),
    driverMaterial,
  );
  driverBody.userData.role =
    'forty-five-position-wheel-with-eleven-teeth-and-plain-locking-rim';
  driverBody.userData.partialGearBody = true;
  const driverHub = new THREE.Mesh(
    makeAnnulusGeometry(
      driverBoreRadius,
      2 * constructionScale,
      0.075,
    ),
    driverMaterial,
  );
  driverHub.position.z = driverDepth / 2 + 0.025;
  driverHub.userData.role = 'driver-front-hub-ring';
  const driverIndexTip = new THREE.Object3D();
  driverIndexTip.position.set(1.255, 0, driverDepth / 2 + 0.075);
  driverIndexTip.userData.role = 'driver-index-tip';
  const driverPinLength = 0.32;
  const driverPin = new THREE.Mesh(
    new THREE.CylinderGeometry(
      driverPinRadius,
      driverPinRadius,
      driverPinLength,
      28,
    ),
    brassMaterial,
  );
  driverPin.rotation.x = Math.PI / 2;
  driverPin.position.set(
    driverPinLocal.x,
    driverPinLocal.y,
    driverDepth / 2 + driverPinLength / 2 - 0.015,
  );
  driverPin.userData.role = 'single-entry-driving-pin';
  driver.userData.rotor.add(
    driverBody,
    driverHub,
    driverIndexTip,
    driverPin,
  );

  const pinion = makePlanarRotor();
  pinion.position.set(pinionCenter.x, pinionCenter.y, 0);
  pinion.userData.role = 'intermittent-locking-output-pinion';
  const pinionBody = new THREE.Mesh(
    extrudeProfile(
      shapeFromOutline(pinionOutline, pinionBoreRadius),
      pinionDepth,
    ),
    pinionMaterial,
  );
  pinionBody.userData.role =
    'eighteen-position-pinion-with-thirteen-teeth-and-concave-lock-pocket';
  pinionBody.userData.partialGearBody = true;
  const pinionHub = new THREE.Mesh(
    makeAnnulusGeometry(
      pinionBoreRadius,
      1.375 * constructionScale,
      0.078,
    ),
    pinionMaterial,
  );
  pinionHub.position.z = pinionDepth / 2 + 0.026;
  pinionHub.userData.role = 'pinion-front-hub-ring';
  const pinionIndexTip = new THREE.Object3D();
  pinionIndexTip.position.set(0.64, 0, pinionDepth / 2 + 0.075);
  pinionIndexTip.userData.role = 'pinion-index-tip';

  // The guide stands proud of the pinion face so it clears the driver's
  // face where it overhangs the plain rim.
  const guideDepth = 0.14;
  const guideZ = pinionDepth / 2 + guideDepth / 2 + 0.005;
  const guidePiece = new THREE.Group();
  guidePiece.position.z = guideZ;
  guidePiece.userData.rigidWithPinion = true;
  guidePiece.userData.role = 'pinion-rigid-entry-guide-piece';
  const guideBody = new THREE.Mesh(
    extrudeProfile(shapeFromOutline(guideOutline), guideDepth),
    brassMaterial,
  );
  guideBody.userData.role = 'curved-entry-guide-body';
  guidePiece.add(guideBody);
  pinion.userData.rotor.add(
    pinionBody,
    pinionHub,
    pinionIndexTip,
    guidePiece,
  );

  const driverShaft = makeShaft({
    axis: Z_AXIS,
    length: 1.1,
    radius: 0.21,
  });
  driverShaft.position.set(driverCenter.x, driverCenter.y, 0);
  driverShaft.userData.role = 'continuous-input-shaft';
  const pinionShaft = makeShaft({
    axis: Z_AXIS,
    length: 1.1,
    radius: 0.21,
  });
  pinionShaft.position.set(pinionCenter.x, pinionCenter.y, 0);
  pinionShaft.userData.role = 'intermittent-output-shaft';

  // Brown draws the two wheels, the pin and the guide only: no stand,
  // bearings or painted indexes.
  root.add(
    driver,
    pinion,
    driverShaft,
    pinionShaft,
  );

  const meshStartAngle = Math.PI - driverToothedStartAngle;
  const meshEndAngle = Math.PI - driverToothedEndAngle;
  const inputAngularSpeed = 0.52;
  const inputPeriod = fullTurn / inputAngularSpeed;
  const sourceDriverAngle = 0;
  const sourcePinionAngle = 0;
  const pinionAngleAtDriverAngle = (driverAngle) => {
    const relativeAngle = driverAngle - sourceDriverAngle;
    const completedTurns = Math.floor(relativeAngle / fullTurn);
    const phase = THREE.MathUtils.euclideanModulo(relativeAngle, fullTurn);
    return sourcePinionAngle - completedTurns * fullTurn
      - Math.min(phase * indexingRatio, fullTurn);
  };
  const closestPointOnGuide = (point) => {
    let minimumDistanceSquared = Infinity;
    let closestPoint = guideOutline[0].clone();
    let segmentIndex = 0;
    for (let index = 0; index < guideOutline.length; index += 1) {
      const start = guideOutline[index];
      const end = guideOutline[(index + 1) % guideOutline.length];
      const segment = end.clone().sub(start);
      const lengthSquared = segment.lengthSq();
      const fraction = lengthSquared > 1e-18
        ? THREE.MathUtils.clamp(
          point.clone().sub(start).dot(segment) / lengthSquared,
          0,
          1,
        )
        : 0;
      const candidate = start.clone().addScaledVector(segment, fraction);
      const distanceSquared = candidate.distanceToSquared(point);
      if (distanceSquared < minimumDistanceSquared) {
        minimumDistanceSquared = distanceSquared;
        closestPoint = candidate;
        segmentIndex = index;
      }
    }
    return {
      distance: Math.sqrt(minimumDistanceSquared),
      point: closestPoint,
      segmentIndex,
    };
  };
  const pinGuideStateAtAngles = (driverAngle, pinionAngle) => {
    const pinCenter = rotateVector2(driverPinLocal, driverAngle)
      .add(driverCenter);
    const pinCenterInGuide = rotateVector2(
      pinCenter.clone().sub(pinionCenter),
      -pinionAngle,
    );
    const closest = closestPointOnGuide(pinCenterInGuide);
    const guidePoint = rotateVector2(closest.point, pinionAngle)
      .add(pinionCenter);
    return {
      clearance: closest.distance - driverPinRadius,
      guidePoint,
      guidePointLocal: closest.point,
      pinCenter,
      pinCenterInGuide,
      segmentIndex: closest.segmentIndex,
    };
  };
  const pinGuideClearanceAtPhase = (phase) => pinGuideStateAtAngles(
    phase,
    pinionAngleAtPhase(phase),
  ).clearance;
  // The offset flank keeps an almost constant running clearance, so find
  // the closest pass by a dense scan before refining it.
  const guideScanEnd = guideEntryEndPhase * 1.25;
  const guideScanSteps = 4096;
  let closestScanIndex = 0;
  let closestScanClearance = Infinity;
  for (let index = 0; index <= guideScanSteps; index += 1) {
    const clearance = pinGuideClearanceAtPhase(
      guideScanEnd * index / guideScanSteps,
    );
    if (clearance < closestScanClearance) {
      closestScanClearance = clearance;
      closestScanIndex = index;
    }
  }
  let closestGuideLow = guideScanEnd
    * Math.max(closestScanIndex - 1, 0) / guideScanSteps;
  let closestGuideHigh = guideScanEnd
    * Math.min(closestScanIndex + 1, guideScanSteps) / guideScanSteps;
  for (let iteration = 0; iteration < 96; iteration += 1) {
    const firstThird = (closestGuideLow * 2 + closestGuideHigh) / 3;
    const secondThird = (closestGuideLow + closestGuideHigh * 2) / 3;
    if (
      pinGuideClearanceAtPhase(firstThird)
        < pinGuideClearanceAtPhase(secondThird)
    ) {
      closestGuideHigh = secondThird;
    } else {
      closestGuideLow = firstThird;
    }
  }
  const closestGuidePhase = (closestGuideLow + closestGuideHigh) / 2;
  const minimumGuideClearance = pinGuideClearanceAtPhase(
    closestGuidePhase,
  );
  const guideStrikeTolerance = 0.02 * constructionScale;
  const driverToothGridBase = 0;
  const pinionToothGridBase = THREE.MathUtils.euclideanModulo(
    pinionToothCenterAngles[0],
    pinionPitchAngle,
  );
  const pitchContactPoint = new THREE.Vector2(-driverPitchRadius, 0);
  const angularDistance = (left, right) => Math.abs(
    THREE.MathUtils.euclideanModulo(left - right + Math.PI, fullTurn)
      - Math.PI,
  );
  const nearestAngleIndex = (angles, target) => {
    let closestIndex = 0;
    let closestDistance = Infinity;
    angles.forEach((angle, index) => {
      const distance = angularDistance(angle, target);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });
    return { distance: closestDistance, index: closestIndex };
  };
  const pointVelocity = (point, center, angularSpeed) => {
    const radial = point.clone().sub(center);
    return new THREE.Vector2(
      -radial.y * angularSpeed,
      radial.x * angularSpeed,
    );
  };
  const angleOnClockwiseArc = (angle, start, end) => (
    THREE.MathUtils.euclideanModulo(start - angle, fullTurn)
      <= THREE.MathUtils.euclideanModulo(start - end, fullTurn) + 1e-12
  );

  const stateAtDriverAngle = (
    driverAngle,
    driverAngularSpeed = inputAngularSpeed,
  ) => {
    const relativeAngle = driverAngle - sourceDriverAngle;
    const completedInputTurns = Math.floor(relativeAngle / fullTurn);
    const phase = THREE.MathUtils.euclideanModulo(relativeAngle, fullTurn);
    const indexing = phase < indexArc;
    const pinionAngle = pinionAngleAtDriverAngle(driverAngle);
    const pinionAngularSpeed = indexing
      ? -indexingRatio * driverAngularSpeed
      : 0;
    const contactBoundaryTolerance = 1e-12;
    const gearMeshActive = phase >= meshStartAngle - contactBoundaryTolerance
      && phase <= meshEndAngle + contactBoundaryTolerance;
    let stage;
    if (phase < meshStartAngle - contactBoundaryTolerance) {
      stage = 'entry-pin-and-guide-transfer';
    } else if (phase <= meshEndAngle + contactBoundaryTolerance) {
      stage = 'eleven-tooth-indexing-mesh';
    }
    else if (phase < indexArc) stage = 'relocking-transition';
    else stage = 'plain-rim-locked-dwell';

    const driverContactLocalAngle = Math.PI - phase;
    const pinionContactLocalAngle = -pinionAngle;
    const driverGridCoordinate = (
      driverContactLocalAngle - driverToothGridBase
    ) / driverPitchAngle;
    const pinionGridCoordinate = (
      pinionContactLocalAngle - pinionToothGridBase
    ) / pinionPitchAngle;
    const halfPitchPhase = THREE.MathUtils.euclideanModulo(
      driverGridCoordinate + pinionGridCoordinate,
      1,
    );
    const meshPhaseError = Math.abs(halfPitchPhase - 0.5);
    const driverSurfaceVelocity = pointVelocity(
      pitchContactPoint,
      driverCenter,
      driverAngularSpeed,
    );
    const pinionSurfaceVelocity = pointVelocity(
      pitchContactPoint,
      pinionCenter,
      pinionAngularSpeed,
    );
    const meshVelocityError = driverSurfaceVelocity.distanceTo(
      pinionSurfaceVelocity,
    );
    const driverContactAngleWrapped = THREE.MathUtils.euclideanModulo(
      driverContactLocalAngle,
      fullTurn,
    );
    const pinionContactAngleWrapped = THREE.MathUtils.euclideanModulo(
      pinionContactLocalAngle,
      fullTurn,
    );
    const activeDriverTooth = nearestAngleIndex(
      driverToothCenterAngles,
      driverContactAngleWrapped,
    );
    const nearestPinionTooth = nearestAngleIndex(
      pinionToothCenterAngles.map((angle) => (
        THREE.MathUtils.euclideanModulo(angle, fullTurn)
      )),
      pinionContactAngleWrapped,
    );

    const lockPocketCenter = rotateVector2(
      new THREE.Vector2(centerDistance, 0),
      pinionAngle,
    ).add(pinionCenter);
    const lockConcentricityError = lockPocketCenter.distanceTo(driverCenter);
    const plainRimLocalAngle = THREE.MathUtils.euclideanModulo(
      Math.PI - phase,
      fullTurn,
    );
    const pinGuide = pinGuideStateAtAngles(driverAngle, pinionAngle);
    const pinGuideEngaged = pinGuide.clearance <= guideStrikeTolerance;
    const outputTurns = -(completedInputTurns
      + Math.min(phase / indexArc, 1));

    return {
      completedInputTurns,
      contactMode: stage,
      driverAngle,
      driverAngularSpeed,
      driverPinGuide: {
        ...pinGuide,
        engaged: pinGuideEngaged,
        minimumConstructionClearance: minimumGuideClearance,
        tolerance: guideStrikeTolerance,
      },
      gearMesh: {
        active: gearMeshActive,
        activeDriverToothIndex: gearMeshActive
          ? activeDriverTooth.index
          : null,
        contactPoint: pitchContactPoint.clone(),
        driverContactLocalAngle,
        driverGridCoordinate,
        driverSurfaceVelocity,
        halfPitchPhase,
        nearestPinionToothIndex: gearMeshActive
          ? nearestPinionTooth.index
          : null,
        phaseError: gearMeshActive ? meshPhaseError : null,
        pinionContactLocalAngle,
        pinionGridCoordinate,
        pinionSurfaceVelocity,
        pitchTangencyError: centerDistance
          - driverPitchRadius - pinionPitchRadius,
        velocityError: gearMeshActive ? meshVelocityError : null,
      },
      indexProgress: Math.min(phase / indexArc, 1),
      indexing,
      lock: {
        active: !indexing,
        angularPlay: lockAngularPlay,
        concentricityError: lockConcentricityError,
        pocketCenter: lockPocketCenter,
        plainRimLocalAngle,
        plainRimOnConstructedArc: angleOnClockwiseArc(
          plainRimLocalAngle,
          driverPlainArcStart,
          driverPlainArcEnd,
        ),
        radialClearance: lockRadialClearance,
      },
      outputTurns,
      phase,
      pinionAngle,
      pinionAngularSpeed,
      stage,
    };
  };
  const stateAtTime = (time) => ({
    ...stateAtDriverAngle(
      sourceDriverAngle + inputAngularSpeed * time,
      inputAngularSpeed,
    ),
    time,
  });

  const canonicalTimes = {
    closestGuidePass: closestGuidePhase / inputAngularSpeed,
    cycleClosure: inputPeriod,
    firstRegularToothContact: meshStartAngle / inputAngularSpeed,
    lastRegularToothContact: meshEndAngle / inputAngularSpeed,
    lockEntry: indexArc / inputAngularSpeed,
    midDwell: (indexArc + fullTurn) / 2 / inputAngularSpeed,
    midIndex: indexArc / 2 / inputAngularSpeed,
    sourcePinStrike: 0,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const sourceRasterImageSize = new THREE.Vector2(525, 525);
  const sourceDriverCenter = new THREE.Vector2(
    339.13877124,
    266.81935912,
  );
  const sourcePinionCenter = new THREE.Vector2(
    113.32760853,
    260.63389817,
  );
  const sourceCenterVector = new THREE.Vector2(
    sourceDriverCenter.x - sourcePinionCenter.x,
    sourcePinionCenter.y - sourceDriverCenter.y,
  );
  const sourceCenterDistance = sourceCenterVector.length();
  const sourceLineDirection = sourceCenterVector.clone()
    .divideScalar(sourceCenterDistance);
  const sourceLineNormal = new THREE.Vector2(
    -sourceLineDirection.y,
    sourceLineDirection.x,
  );
  const sourceScale = centerDistance / sourceCenterDistance;
  const sourcePointToModel = (point, z = 0) => {
    const displacement = new THREE.Vector2(
      point.x - sourceDriverCenter.x,
      sourceDriverCenter.y - point.y,
    );
    return new THREE.Vector3(
      displacement.dot(sourceLineDirection) * sourceScale,
      displacement.dot(sourceLineNormal) * sourceScale,
      z,
    );
  };
  const modelPointToSourceRaster = (point) => {
    const sourcePlanar = new THREE.Vector2(point.x, point.y)
      .divideScalar(sourceScale);
    const displacement = sourceLineDirection.clone()
      .multiplyScalar(sourcePlanar.x)
      .addScaledVector(sourceLineNormal, sourcePlanar.y);
    return new THREE.Vector2(
      sourceDriverCenter.x + displacement.x,
      sourceDriverCenter.y - displacement.y,
    );
  };

  root.userData.archetype =
    'half-toothed-thirty-two-position-driver-pin-guided-sixteen-position-locking-pinion';
  root.userData.mechanism =
    'single-entry-pin-starts-an-eleven-tooth-five-to-two-index-before-a-concave-pinion-pocket-locks-on-the-plain-driver-rim';
  root.userData.variant =
    'one-output-turn-during-two-fifths-of-an-input-turn-followed-by-a-positive-lock-dwell';
  root.userData.blocks = {
    driver,
    driverBody,
    driverHub,
    driverIndexTip,
    driverPin,
    driverShaft,
    guideBody,
    guidePiece,
    pinion,
    pinionBody,
    pinionHub,
    pinionIndexTip,
    pinionShaft,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = {
    centerDistance,
    closestGuidePhase,
    constructionScale,
    driverBoreRadius,
    driverCenter,
    driverDepth,
    driverEquivalentToothCount,
    driverInstalledToothCount,
    driverOutline,
    driverOutlineRaw,
    driverPinLocal,
    driverPinRadius,
    driverPitchAngle,
    driverPitchRadius,
    driverPlainArcEnd,
    driverPlainArcStart,
    driverPlainRadius,
    driverRootRadius,
    driverToothCenterAngles,
    driverToothedEndAngle,
    driverToothedProfile,
    driverToothedProfileRaw,
    driverToothedStartAngle,
    driverToothOuterRadius,
    guideOutline,
    guideOutlineRaw,
    guideStrikeTolerance,
    lockAngularPlay,
    lockRadialClearance,
    meshEndAngle,
    meshStartAngle,
    minimumGuideClearance,
    pinionBoreRadius,
    pinionCenter,
    pinionDepth,
    pinionEquivalentToothCount,
    pinionInstalledToothCount,
    pinionLockRadius,
    pinionMissingToothCenterAngles,
    pinionOutline,
    pinionOutlineRaw,
    pinionPitchAngle,
    pinionPitchRadius,
    pinionRootRadius,
    pinionToothCenterAngles,
    pinionToothedProfile,
    pinionToothedProfileRaw,
    pinionToothOuterRadius,
    pitchContactPoint,
    sourceDriverAngle,
    sourcePinionAngle,
  };
  root.userData.modelPointToSourceRaster = modelPointToSourceRaster;
  root.userData.pinionAngleAtDriverAngle = pinionAngleAtDriverAngle;
  root.userData.pinGuideStateAtAngles = pinGuideStateAtAngles;
  root.userData.sourceAnchors = {
    driverCenter: sourceDriverCenter.clone(),
    modeledDriverCenter: modelPointToSourceRaster(driverCenter),
    modeledPinionCenter: modelPointToSourceRaster(pinionCenter),
    pinionCenter: sourcePinionCenter.clone(),
  };
  root.userData.sourceAnimation = {
    available: true,
    constructionDiffersSlightlyFromBrown: true,
    indexingCycleInterval: [0, 0.5],
    lockedDwellCycleInterval: [0.5, 1],
    note: 'The official page states that its construction is adjusted to clarify the lock and prevent tooth jamming.',
    pinionPoseVectors: {
      mid: [new THREE.Vector2(-12, 0), new THREE.Vector2(-15, 0)],
      start: [new THREE.Vector2(-12, 0), new THREE.Vector2(-9, 0)],
    },
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceRaster = {
    fittedDriverCenter: sourceDriverCenter.clone(),
    fittedDriverPlainRadius: 173.3818932,
    fittedPinionCenter: sourcePinionCenter.clone(),
    height: sourceRasterImageSize.y,
    sourcePose: 'entry-pin-at-horizontal-pinion-guide',
    sourceUrl: 'https://507movements.com/mm_211.html',
    width: sourceRasterImageSize.x,
  };
  root.userData.stateAtDriverAngle = stateAtDriverAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    activeInputFraction: 1 / indexingRatio,
    direction: 'opposite-during-index-and-locked-during-dwell',
    driverEquivalentToothCount,
    driverInstalledToothCount,
    indexingSpeedRatio: -indexingRatio,
    inputAngularSpeed,
    inputPeriod,
    lockAngularPlay,
    lockRadialClearance,
    outputTurnsPerInputTurn: -1,
    pinionEquivalentToothCount,
    pinionInstalledToothCount,
  };
  root.userData.cameraDistanceScale = 1.08;

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(driver, state.driverAngle);
    setSpin(driverShaft, state.driverAngle);
    setSpin(pinion, state.pinionAngle);
    setSpin(pinionShaft, state.pinionAngle);
    driver.userData.angularSpeed = state.driverAngularSpeed;
    driverShaft.userData.angularSpeed = state.driverAngularSpeed;
    pinion.userData.angularSpeed = state.pinionAngularSpeed;
    pinionShaft.userData.angularSpeed = state.pinionAngularSpeed;
    guidePiece.userData.angularSpeed = state.pinionAngularSpeed;
    root.userData.contacts = {
      entryPinGuide: state.driverPinGuide,
      lockingPocket: state.lock,
      toothedMesh: state.gearMesh.active ? state.gearMesh : null,
    };
    root.userData.kinematics = state;
  };
  // Brown draws no ground line or shadow.
  root.userData.hideGround = true;
  update(0);
  return finish(root, update, new THREE.Vector3(1.4, 1.0, 12.4));
}

function fiveSlotGenevaWindingStop() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const degreesToRadians = THREE.MathUtils.degToRad;
  const constructionScale = 0.42;
  const rawCenterDistance = 7.442189;
  const centerDistance = rawCenterDistance * constructionScale;
  const driverCenter = new THREE.Vector2(0, -1.45);
  const stopWheelCenter = new THREE.Vector2(
    driverCenter.x,
    driverCenter.y + centerDistance,
  );
  const driverDepth = 0.36;
  const stopWheelDepth = 0.4;
  const driverBoreRadius = constructionScale;
  const stopWheelBoreRadius = constructionScale;
  const driverLockingRadius = 4 * constructionScale;
  const driverFingerRadius = 4.5 * constructionScale;
  const stopSectorRadius = 4 * constructionScale;
  const nominalSlotCount = 5;
  const stopStepAngle = fullTurn / nominalSlotCount;
  const normalIndexInputAngle = degreesToRadians(51);
  const sourceTerminalInputAngle = Math.atan2(2.46763, 3.763084);
  const sourceTerminalTimedAngle = degreesToRadians(33.25);
  const sourceTerminalStopWheelAngle = Math.atan2(
    11.41364 - rawCenterDistance,
    -0.556933,
  ) - fullTurn;
  const normalIndexCount = 3;
  const forwardInputLimit = normalIndexCount * fullTurn
    + sourceTerminalInputAngle;
  const terminalStopWheelAdvance = -sourceTerminalStopWheelAngle
    - normalIndexCount * stopStepAngle;
  const normalIndexRatio = -stopStepAngle / normalIndexInputAngle;
  const terminalIndexRatio = -terminalStopWheelAdvance
    / sourceTerminalInputAngle;

  const rotateVector2 = (vector, angle) => {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    return new THREE.Vector2(
      cosine * vector.x - sine * vector.y,
      sine * vector.x + cosine * vector.y,
    );
  };
  const scaleRawPoints = (points) => points.map(
    (point) => point.clone().multiplyScalar(constructionScale),
  );
  const sampleRawArc = ({
    center,
    clockwise = false,
    end,
    radius,
    segments,
    start,
  }) => {
    let resolvedEnd = end;
    if (clockwise) {
      while (resolvedEnd >= start) resolvedEnd -= fullTurn;
    } else {
      while (resolvedEnd <= start) resolvedEnd += fullTurn;
    }
    return Array.from({ length: segments + 1 }, (_, index) => {
      const angle = THREE.MathUtils.lerp(
        start,
        resolvedEnd,
        index / segments,
      );
      return new THREE.Vector2(
        center.x + Math.cos(angle) * radius,
        center.y + Math.sin(angle) * radius,
      );
    });
  };
  const appendDistinct = (
    target,
    points,
    { reverse = false, tolerance = 0.00001 } = {},
  ) => {
    const ordered = reverse ? [...points].reverse() : points;
    for (const point of ordered) {
      if (target.length === 0 || target.at(-1).distanceTo(point) > tolerance) {
        target.push(point.clone());
      }
    }
  };

  // Exact path construction embedded in the official Movement 212 page.
  // The lower member is a four-unit locking rim with one broad winding finger
  // rising to radius 4.5. Two circular reliefs let that finger enter and leave
  // each radial Geneva slot without the body colliding with the stop wheel.
  const driverFingerArcRaw = sampleRawArc({
    center: new THREE.Vector2(0, 0),
    end: 1.34854,
    radius: 4.5,
    segments: 128,
    start: 0.904027,
  });
  const driverLeftReliefRaw = sampleRawArc({
    center: new THREE.Vector2(0.796323, 3.7172),
    end: 1.287571,
    radius: 0.7,
    segments: 76,
    start: 3.769911,
  });
  const driverRightReliefRaw = sampleRawArc({
    center: new THREE.Vector2(2.384433, 2.960774),
    clockwise: true,
    end: 0.964995,
    radius: 0.7,
    segments: 76,
    start: 4.765841,
  });
  const driverLockingArcRaw = sampleRawArc({
    center: new THREE.Vector2(0, 0),
    end: 0.614753,
    radius: 4,
    segments: 1024,
    start: 1.637813,
  });
  const driverOutlineRaw = [];
  appendDistinct(driverOutlineRaw, driverFingerArcRaw);
  appendDistinct(driverOutlineRaw, driverLeftReliefRaw, { reverse: true });
  appendDistinct(driverOutlineRaw, [
    new THREE.Vector2(0.230011, 3.30575),
    new THREE.Vector2(-0.267867, 3.991021),
  ]);
  appendDistinct(driverOutlineRaw, driverLockingArcRaw);
  appendDistinct(driverOutlineRaw, [
    new THREE.Vector2(3.267663, 2.307029),
    new THREE.Vector2(2.421831, 2.261774),
  ]);
  appendDistinct(driverOutlineRaw, driverRightReliefRaw);

  const convexStopArcRaw = sampleRawArc({
    center: new THREE.Vector2(0, 0),
    end: 3.83139,
    radius: 4,
    segments: 256,
    start: 3.080114,
  });
  const slotPolylinesRaw = [
    [
      new THREE.Vector2(-3.388993, 2.144138),
      new THREE.Vector2(-2.107846, 1.727868),
      new THREE.Vector2(-2.720899, -0.158914),
      new THREE.Vector2(-4.002045, 0.257356),
    ],
    [
      new THREE.Vector2(-3.086453, -2.560548),
      new THREE.Vector2(-2.294661, -1.47074),
      new THREE.Vector2(-0.689668, -2.636836),
      new THREE.Vector2(-1.48146, -3.726644),
    ],
    [
      new THREE.Vector2(1.48146, -3.726644),
      new THREE.Vector2(0.689668, -2.636836),
      new THREE.Vector2(2.294661, -1.47074),
      new THREE.Vector2(3.086453, -2.560548),
    ],
    [
      new THREE.Vector2(4.002045, 0.257356),
      new THREE.Vector2(2.720899, -0.158914),
      new THREE.Vector2(2.107846, 1.727868),
      new THREE.Vector2(3.388993, 2.144138),
    ],
    [
      new THREE.Vector2(0.99194, 3.885699),
      new THREE.Vector2(0.99194, 2.538622),
      new THREE.Vector2(-0.99194, 2.538622),
      new THREE.Vector2(-0.99194, 3.885699),
    ],
  ];
  const lockPocketCentersRaw = [
    new THREE.Vector2(0, -7.442189),
    new THREE.Vector2(7.077943, -2.299763),
    new THREE.Vector2(4.374409, 6.020858),
    new THREE.Vector2(-4.374409, 6.020858),
  ];
  const lockPocketArcsRaw = [
    sampleRawArc({
      center: new THREE.Vector2(-4.374409, 6.020858),
      end: 5.720109,
      radius: 4,
      segments: 256,
      start: 4.961306,
    }),
    sampleRawArc({
      center: new THREE.Vector2(0, -7.442189),
      end: 1.950198,
      radius: 4,
      segments: 256,
      start: 1.191394,
    }),
    sampleRawArc({
      center: new THREE.Vector2(7.077943, -2.299763),
      end: 3.206835,
      radius: 4,
      segments: 256,
      start: 2.448031,
    }),
    sampleRawArc({
      center: new THREE.Vector2(4.374409, 6.020858),
      end: 4.463472,
      radius: 4,
      segments: 256,
      start: 3.704669,
    }),
  ];

  // Join the source's separately stroked segments into one watertight outline.
  // The tiny bridges only close sub-pixel rounding gaps in the official data.
  const stopWheelOutlineRaw = [];
  appendDistinct(stopWheelOutlineRaw, convexStopArcRaw);
  appendDistinct(stopWheelOutlineRaw, slotPolylinesRaw[1]);
  appendDistinct(stopWheelOutlineRaw, lockPocketArcsRaw[1], { reverse: true });
  appendDistinct(stopWheelOutlineRaw, slotPolylinesRaw[2]);
  appendDistinct(stopWheelOutlineRaw, lockPocketArcsRaw[2], { reverse: true });
  appendDistinct(stopWheelOutlineRaw, slotPolylinesRaw[3]);
  appendDistinct(stopWheelOutlineRaw, lockPocketArcsRaw[3], { reverse: true });
  appendDistinct(stopWheelOutlineRaw, slotPolylinesRaw[4]);
  appendDistinct(stopWheelOutlineRaw, lockPocketArcsRaw[0], { reverse: true });
  appendDistinct(stopWheelOutlineRaw, slotPolylinesRaw[0]);

  const driverOutline = scaleRawPoints(driverOutlineRaw);
  const stopWheelOutline = scaleRawPoints(stopWheelOutlineRaw);
  const driverFingerArc = scaleRawPoints(driverFingerArcRaw);
  const convexStopArc = scaleRawPoints(convexStopArcRaw);
  const lockPocketCenters = scaleRawPoints(lockPocketCentersRaw);
  const lockPocketArcs = lockPocketArcsRaw.map(scaleRawPoints);
  const slotPolylines = slotPolylinesRaw.map(scaleRawPoints);

  const shapeFromOutline = (outline, boreRadius) => {
    const shape = new THREE.Shape();
    outline.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    });
    shape.closePath();
    const bore = new THREE.Path();
    bore.absarc(0, 0, boreRadius, 0, fullTurn, true);
    shape.holes.push(bore);
    return shape;
  };
  const extrudeProfile = (shape, depth) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: false,
      curveSegments: 20,
      depth,
      steps: 1,
    });
    geometry.translate(0, 0, -depth / 2);
    geometry.computeVertexNormals();
    return geometry;
  };
  const curveFromPoints = (points, z, closed) => {
    const curve = new THREE.CurvePath();
    const limit = closed ? points.length : points.length - 1;
    for (let index = 0; index < limit; index += 1) {
      const start = points[index];
      const end = points[(index + 1) % points.length];
      curve.add(new THREE.LineCurve3(
        new THREE.Vector3(start.x, start.y, z),
        new THREE.Vector3(end.x, end.y, z),
      ));
    }
    return curve;
  };
  const makeProfileTube = ({
    closed,
    material,
    points,
    radius,
    role,
    z,
  }) => {
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(
        curveFromPoints(points, z, closed),
        Math.max(48, points.length * 2),
        radius,
        6,
        closed,
      ),
      material,
    );
    tube.userData.role = role;
    return tube;
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.1,
    roughness: 0.64,
    side: THREE.DoubleSide,
  });
  const stopWheelMaterial = matte(PALETTE.driven, {
    metalness: 0.11,
    roughness: 0.62,
    side: THREE.DoubleSide,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.2,
    roughness: 0.5,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.19,
    roughness: 0.5,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.46,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.67,
  });

  const driver = makePlanarRotor();
  driver.position.set(driverCenter.x, driverCenter.y, 0);
  driver.userData.role = 'finite-range-winding-driver-A';
  const driverBody = new THREE.Mesh(
    extrudeProfile(
      shapeFromOutline(driverOutline, driverBoreRadius),
      driverDepth,
    ),
    driverMaterial,
  );
  driverBody.userData.role =
    'single-finger-locking-rim-geneva-driver-A';
  driverBody.userData.trueGenevaDriverProfile = true;
  const driverEdge = makeProfileTube({
    closed: true,
    material: inkMaterial,
    points: driverOutline,
    radius: 0.013,
    role: 'driver-locking-rim-and-finger-outline',
    z: driverDepth / 2 + 0.012,
  });
  const driverFingerHighlight = makeProfileTube({
    closed: false,
    material: whiteMaterial,
    points: driverFingerArc,
    radius: 0.024,
    role: 'single-winding-finger-face-highlight',
    z: driverDepth / 2 + 0.062,
  });
  const driverHub = new THREE.Mesh(
    // Brown's hub rings are about a quarter of each wheel's width.
    makeAnnulusGeometry(driverBoreRadius, 0.95 * constructionScale, 0.08),
    driverMaterial,
  );
  driverHub.position.z = driverDepth / 2 + 0.026;
  driverHub.userData.role = 'driver-A-front-hub-ring';
  const driverFingerMidAngle = (
    driverFingerArcRaw[0].angle()
      + driverFingerArcRaw.at(-1).angle()
  ) / 2;
  const driverIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.052, 0.026),
    whiteMaterial,
  );
  driverIndex.position.set(
    Math.cos(driverFingerMidAngle) * 1.23,
    Math.sin(driverFingerMidAngle) * 1.23,
    driverDepth / 2 + 0.069,
  );
  driverIndex.rotation.z = driverFingerMidAngle;
  driverIndex.userData.role = 'driver-A-radial-winding-index';
  const driverIndexTip = new THREE.Object3D();
  driverIndexTip.position.set(
    Math.cos(driverFingerMidAngle) * 1.52,
    Math.sin(driverFingerMidAngle) * 1.52,
    driverDepth / 2 + 0.069,
  );
  driverIndexTip.userData.role = 'driver-A-index-tip';
  driver.userData.rotor.add(
    driverBody,
    driverEdge,
    driverFingerHighlight,
    driverHub,
    driverIndex,
    driverIndexTip,
  );

  const stopWheel = makePlanarRotor();
  stopWheel.position.set(stopWheelCenter.x, stopWheelCenter.y, 0);
  stopWheel.userData.role = 'five-slot-geneva-stop-wheel-B';
  const stopWheelBody = new THREE.Mesh(
    extrudeProfile(
      shapeFromOutline(stopWheelOutline, stopWheelBoreRadius),
      stopWheelDepth,
    ),
    stopWheelMaterial,
  );
  stopWheelBody.userData.role =
    'five-slot-four-pocket-wheel-with-one-convex-stop-sector';
  stopWheelBody.userData.trueGenevaStopProfile = true;
  const stopWheelEdge = makeProfileTube({
    closed: true,
    material: inkMaterial,
    points: stopWheelOutline,
    radius: 0.013,
    role: 'five-slots-lock-pockets-and-stop-sector-outline',
    z: stopWheelDepth / 2 + 0.012,
  });
  const convexStopHighlight = makeProfileTube({
    closed: false,
    material: brassMaterial,
    points: convexStopArc,
    radius: 0.027,
    role: 'convex-a-b-terminal-stop-sector-highlight',
    z: stopWheelDepth / 2 + 0.065,
  });
  const stopSectorEndpointMarkers = [
    convexStopArc[0],
    convexStopArc.at(-1),
  ].map((point, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 18, 12),
      whiteMaterial,
    );
    marker.position.set(
      point.x,
      point.y,
      stopWheelDepth / 2 + 0.085,
    );
    marker.userData.role = index === 0
      ? 'convex-stop-sector-endpoint-a'
      : 'convex-stop-sector-endpoint-b';
    return marker;
  });
  const stopWheelHub = new THREE.Mesh(
    makeAnnulusGeometry(
      stopWheelBoreRadius,
      0.97 * constructionScale,
      0.082,
    ),
    stopWheelMaterial,
  );
  stopWheelHub.position.z = stopWheelDepth / 2 + 0.027;
  stopWheelHub.userData.role = 'stop-wheel-B-front-hub-ring';
  const stopIndexAngle = Math.PI / 2;
  const stopWheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.53, 0.052, 0.026),
    whiteMaterial,
  );
  stopWheelIndex.position.set(
    Math.cos(stopIndexAngle) * 1.14,
    Math.sin(stopIndexAngle) * 1.14,
    stopWheelDepth / 2 + 0.071,
  );
  stopWheelIndex.rotation.z = stopIndexAngle;
  stopWheelIndex.userData.role = 'stop-wheel-B-radial-index';
  const stopWheelIndexTip = new THREE.Object3D();
  stopWheelIndexTip.position.set(
    Math.cos(stopIndexAngle) * 1.405,
    Math.sin(stopIndexAngle) * 1.405,
    stopWheelDepth / 2 + 0.071,
  );
  stopWheelIndexTip.userData.role = 'stop-wheel-B-index-tip';
  stopWheel.userData.rotor.add(
    stopWheelBody,
    stopWheelEdge,
    convexStopHighlight,
    ...stopSectorEndpointMarkers,
    stopWheelHub,
    stopWheelIndex,
    stopWheelIndexTip,
  );

  const driverShaft = makeShaft({
    axis: Z_AXIS,
    length: 1.58,
    radius: 0.085,
  });
  driverShaft.position.set(driverCenter.x, driverCenter.y, 0);
  driverShaft.userData.role = 'finite-range-winding-input-shaft-A';
  const stopWheelShaft = makeShaft({
    axis: Z_AXIS,
    length: 1.58,
    radius: 0.082,
  });
  stopWheelShaft.position.set(stopWheelCenter.x, stopWheelCenter.y, 0);
  stopWheelShaft.userData.role = 'limited-geneva-stop-shaft-B';

  const terminalContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.061, 18, 12),
    whiteMaterial,
  );
  terminalContactMarker.visible = false;
  terminalContactMarker.userData.role =
    'terminal-winding-limit-contact-marker';

  const rearZ = -0.77;
  const baseY = -3.48;
  const sideX = -2.2;
  const baseRail = makeBeam(
    new THREE.Vector3(-2.45, baseY, rearZ),
    new THREE.Vector3(2.45, baseY, rearZ),
    { color: PALETTE.frame, depth: 0.18, thickness: 0.14 },
  );
  baseRail.userData.role = 'geneva-stop-fixed-base-rail';
  const upright = makeBeam(
    new THREE.Vector3(sideX, baseY, rearZ),
    new THREE.Vector3(sideX, 2.35, rearZ),
    { color: PALETTE.frame, depth: 0.17, thickness: 0.14 },
  );
  upright.userData.role = 'geneva-stop-fixed-bearing-upright';
  const bearingArms = [driverCenter, stopWheelCenter].map((center, index) => {
    const arm = makeBeam(
      new THREE.Vector3(sideX, center.y, rearZ),
      new THREE.Vector3(center.x, center.y, rearZ),
      { color: PALETTE.frame, depth: 0.16, thickness: 0.13 },
    );
    arm.userData.role = index === 0
      ? 'driver-A-rear-bearing-arm'
      : 'stop-wheel-B-rear-bearing-arm';
    return arm;
  });
  const bearings = [driverCenter, stopWheelCenter].map((center, index) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.052, 10, 38),
      frameMaterial,
    );
    bearing.position.set(center.x, center.y, rearZ + 0.045);
    bearing.userData.fixed = true;
    bearing.userData.role = index === 0
      ? 'fixed-driver-A-bearing'
      : 'fixed-stop-wheel-B-bearing';
    return bearing;
  });
  const feet = [-2.16, 2.15].map((x, index) => {
    const foot = makeBeam(
      new THREE.Vector3(x, baseY, rearZ - 0.42),
      new THREE.Vector3(x, baseY, 0.34),
      { color: PALETTE.frame, depth: 0.16, thickness: 0.13 },
    );
    foot.userData.role = index === 0
      ? 'geneva-stop-left-transverse-foot'
      : 'geneva-stop-right-transverse-foot';
    return foot;
  });
  root.add(
    driver,
    stopWheel,
    driverShaft,
    stopWheelShaft,
    terminalContactMarker,
    baseRail,
    upright,
    ...bearingArms,
    ...bearings,
    ...feet,
  );

  const transformRawPoint = (point, angle, center) => rotateVector2(
    point,
    angle,
  ).multiplyScalar(constructionScale).add(center);
  const terminalDriverAngle = sourceTerminalInputAngle;
  const terminalStopAngle = sourceTerminalStopWheelAngle;
  const terminalStopShoulderRaw = slotPolylinesRaw[0].slice(0, 2);
  const terminalStopShoulder = terminalStopShoulderRaw.map((point) => (
    transformRawPoint(point, terminalStopAngle, stopWheelCenter)
  ));
  const circleSegmentIntersections = (
    center,
    radius,
    start,
    end,
  ) => {
    const offset = start.clone().sub(center);
    const direction = end.clone().sub(start);
    const a = direction.lengthSq();
    const b = 2 * offset.dot(direction);
    const c = offset.lengthSq() - radius * radius;
    const discriminant = Math.max(0, b * b - 4 * a * c);
    const rootDiscriminant = Math.sqrt(discriminant);
    return [
      (-b - rootDiscriminant) / (2 * a),
      (-b + rootDiscriminant) / (2 * a),
    ].filter((fraction) => fraction >= 0 && fraction <= 1)
      .map((fraction) => start.clone().addScaledVector(
        direction,
        fraction,
      ));
  };
  const terminalContactCandidates = circleSegmentIntersections(
    driverCenter,
    driverFingerRadius,
    terminalStopShoulder[0],
    terminalStopShoulder[1],
  );
  const terminalFingerArcStart = 0.904027 + terminalDriverAngle;
  const terminalFingerArcEnd = 1.34854 + terminalDriverAngle;
  const terminalContactPoint = terminalContactCandidates.find((point) => {
    const angle = point.clone().sub(driverCenter).angle();
    return angle >= terminalFingerArcStart - 1e-8
      && angle <= terminalFingerArcEnd + 1e-8;
  }) ?? terminalContactCandidates[0];
  const terminalShoulderDirection = terminalStopShoulder[1].clone()
    .sub(terminalStopShoulder[0]).normalize();
  const terminalStopNormal = new THREE.Vector2(
    -terminalShoulderDirection.y,
    terminalShoulderDirection.x,
  );
  const unitDriverContactVelocity = new THREE.Vector2(
    -(terminalContactPoint.y - driverCenter.y),
    terminalContactPoint.x - driverCenter.x,
  );
  const blockedForwardClosingRate = Math.abs(
    unitDriverContactVelocity.dot(terminalStopNormal),
  );
  terminalContactMarker.position.set(
    terminalContactPoint.x,
    terminalContactPoint.y,
    Math.max(driverDepth, stopWheelDepth) / 2 + 0.105,
  );

  const indexDuration = 1.1;
  const freeTurnDuration = 2.8;
  const terminalApproachDuration = 0.9;
  const stopHoldDuration = 1.3;
  const startHoldDuration = 1.1;
  const forwardSegments = [];
  for (let index = 0; index < normalIndexCount; index += 1) {
    const turnStart = index * fullTurn;
    forwardSegments.push({
      duration: indexDuration,
      endAngle: turnStart + normalIndexInputAngle,
      name: `slot-${index + 1}-index`,
      startAngle: turnStart,
    });
    forwardSegments.push({
      duration: freeTurnDuration,
      endAngle: (index + 1) * fullTurn,
      name: `pocket-${index + 1}-locked-free-turn`,
      startAngle: turnStart + normalIndexInputAngle,
    });
  }
  forwardSegments.push({
    duration: terminalApproachDuration,
    endAngle: forwardInputLimit,
    name: 'convex-sector-terminal-stop-approach',
    startAngle: normalIndexCount * fullTurn,
  });
  let accumulatedSegmentTime = 0;
  for (const segment of forwardSegments) {
    segment.startTime = accumulatedSegmentTime;
    accumulatedSegmentTime += segment.duration;
    segment.endTime = accumulatedSegmentTime;
  }
  const forwardMotionDuration = accumulatedSegmentTime;
  const reverseMotionStart = forwardMotionDuration + stopHoldDuration;
  const startHoldStart = reverseMotionStart + forwardMotionDuration;
  const demonstrationPeriod = startHoldStart + startHoldDuration;

  const smootherStep = (fraction) => {
    const clamped = THREE.MathUtils.clamp(fraction, 0, 1);
    return clamped * clamped * clamped
      * (10 + clamped * (-15 + 6 * clamped));
  };
  const smootherStepDerivative = (fraction) => {
    const clamped = THREE.MathUtils.clamp(fraction, 0, 1);
    return 30 * clamped * clamped
      * (clamped - 1) * (clamped - 1);
  };
  const smootherStepSecondDerivative = (fraction) => {
    const clamped = THREE.MathUtils.clamp(fraction, 0, 1);
    return 60 * clamped
      * (2 * clamped * clamped - 3 * clamped + 1);
  };
  const evaluateForwardMotion = (elapsed) => {
    const clampedTime = THREE.MathUtils.clamp(
      elapsed,
      0,
      forwardMotionDuration,
    );
    const segment = forwardSegments.find((candidate) => (
      clampedTime <= candidate.endTime + 1e-12
    )) ?? forwardSegments.at(-1);
    const localTime = THREE.MathUtils.clamp(
      clampedTime - segment.startTime,
      0,
      segment.duration,
    );
    const linearFraction = localTime / segment.duration;
    const angleTravel = segment.endAngle - segment.startAngle;
    return {
      angle: segment.startAngle
        + angleTravel * smootherStep(linearFraction),
      angularAcceleration: angleTravel
        * smootherStepSecondDerivative(linearFraction)
        / (segment.duration * segment.duration),
      angularSpeed: angleTravel
        * smootherStepDerivative(linearFraction)
        / segment.duration,
      linearFraction,
      name: segment.name,
      segment,
    };
  };
  const inputStateAtTime = (time) => {
    const phaseTime = THREE.MathUtils.euclideanModulo(
      time,
      demonstrationPeriod,
    );
    if (phaseTime <= forwardMotionDuration) {
      return {
        ...evaluateForwardMotion(phaseTime),
        direction: 'winding-toward-stop',
        phaseTime,
      };
    }
    if (phaseTime <= reverseMotionStart) {
      return {
        angle: forwardInputLimit,
        angularAcceleration: 0,
        angularSpeed: 0,
        direction: 'held-at-convex-stop',
        linearFraction: 1,
        name: 'terminal-stop-hold',
        phaseTime,
        segment: null,
      };
    }
    if (phaseTime <= startHoldStart) {
      const reverseElapsed = phaseTime - reverseMotionStart;
      const forwardState = evaluateForwardMotion(
        forwardMotionDuration - reverseElapsed,
      );
      return {
        ...forwardState,
        angularAcceleration: forwardState.angularAcceleration,
        angularSpeed: -forwardState.angularSpeed,
        direction: 'unwinding-away-from-stop',
        name: `reverse-${forwardState.name}`,
        phaseTime,
      };
    }
    return {
      angle: 0,
      angularAcceleration: 0,
      angularSpeed: 0,
      direction: 'held-at-source-start',
      linearFraction: 0,
      name: 'source-start-hold',
      phaseTime,
      segment: null,
    };
  };

  const stopWheelAngleAtInputAngle = (requestedAngle) => {
    const driverAngle = THREE.MathUtils.clamp(
      requestedAngle,
      0,
      forwardInputLimit,
    );
    if (driverAngle >= normalIndexCount * fullTurn) {
      const terminalProgress = (
        driverAngle - normalIndexCount * fullTurn
      ) / sourceTerminalInputAngle;
      return -normalIndexCount * stopStepAngle
        - terminalProgress * terminalStopWheelAdvance;
    }
    const completedTurns = Math.floor(driverAngle / fullTurn);
    const phase = driverAngle - completedTurns * fullTurn;
    return -completedTurns * stopStepAngle
      - Math.min(phase / normalIndexInputAngle, 1) * stopStepAngle;
  };

  const stateAtInputAngle = (
    requestedInputAngle,
    driverAngularSpeed = 0,
    driverAngularAcceleration = 0,
  ) => {
    let inputAngle = THREE.MathUtils.clamp(
      requestedInputAngle,
      0,
      forwardInputLimit,
    );
    const exactPoseAngles = [
      0,
      normalIndexInputAngle,
      fullTurn,
      fullTurn + normalIndexInputAngle,
      fullTurn * 2,
      fullTurn * 2 + normalIndexInputAngle,
      fullTurn * 3,
      forwardInputLimit,
    ];
    const exactPose = exactPoseAngles.find((angle) => (
      Math.abs(inputAngle - angle) <= 1e-10
    ));
    if (exactPose !== undefined) inputAngle = exactPose;
    // At the exact reversal pose the input is blocked while winding, but it
    // must be free to leave that same pose with a negative (run-down) speed.
    // Including direction here avoids one frame of false lock as the smooth
    // timeline reverses away from the convex sector.
    const atTerminalStop = inputAngle >= forwardInputLimit - 1e-11
      && driverAngularSpeed >= -1e-12;
    const resolvedDriverAngularSpeed = atTerminalStop
      ? 0
      : driverAngularSpeed;
    const resolvedDriverAngularAcceleration = atTerminalStop
      ? 0
      : driverAngularAcceleration;
    const inTerminalApproach = inputAngle >= normalIndexCount * fullTurn;
    const completedInputTurns = Math.min(
      Math.floor(inputAngle / fullTurn),
      normalIndexCount,
    );
    const inputPhase = inTerminalApproach
      ? inputAngle - normalIndexCount * fullTurn
      : inputAngle - completedInputTurns * fullTurn;
    const normalIndexing = !inTerminalApproach
      && inputPhase < normalIndexInputAngle - 1e-12;
    const normalLockedDwell = !inTerminalApproach && !normalIndexing;
    const stopWheelAngle = stopWheelAngleAtInputAngle(inputAngle);
    const instantaneousRatio = atTerminalStop
      ? 0
      : inTerminalApproach
        ? terminalIndexRatio
        : normalIndexing
          ? normalIndexRatio
          : 0;
    const stopWheelAngularSpeed = instantaneousRatio
      * resolvedDriverAngularSpeed;
    const stopWheelAngularAcceleration = instantaneousRatio
      * resolvedDriverAngularAcceleration;
    const lockPoseIndex = normalLockedDwell
      ? completedInputTurns + 1
      : null;
    const lockPocketCenter = lockPoseIndex === null
      ? null
      : rotateVector2(
        lockPocketCenters[lockPoseIndex],
        stopWheelAngle,
      ).add(stopWheelCenter);
    const lockConcentricityError = lockPocketCenter
      ? lockPocketCenter.distanceTo(driverCenter)
      : null;
    const terminalProgress = inTerminalApproach
      ? THREE.MathUtils.clamp(
        inputPhase / sourceTerminalInputAngle,
        0,
        1,
      )
      : 0;
    const normalIndexProgress = normalIndexing
      ? inputPhase / normalIndexInputAngle
      : normalLockedDwell
        ? 1
        : null;
    let stage;
    if (atTerminalStop) stage = 'convex-sector-terminal-stop';
    else if (inTerminalApproach) stage = 'terminal-stop-approach';
    else if (normalIndexing) {
      stage = `winding-finger-indexes-slot-${completedInputTurns + 1}`;
    } else {
      stage = `concentric-pocket-${lockPoseIndex}-locked-dwell`;
    }
    const stopArcEndpoints = convexStopArc.map((point) => (
      rotateVector2(point, stopWheelAngle).add(stopWheelCenter)
    ));
    const expectedStopWheelAngle = inTerminalApproach
      ? -normalIndexCount * stopStepAngle
        + inputPhase * terminalIndexRatio
      : -completedInputTurns * stopStepAngle
        + Math.min(inputPhase, normalIndexInputAngle) * normalIndexRatio;

    return {
      atTerminalStop,
      completedInputTurns,
      contactMode: stage,
      driverAngle: inputAngle,
      driverAngularAcceleration: resolvedDriverAngularAcceleration,
      driverAngularSpeed: resolvedDriverAngularSpeed,
      engagement: {
        active: normalIndexing || (
          inTerminalApproach && !atTerminalStop
        ),
        activeSlotIndex: inTerminalApproach
          ? 4
          : normalIndexing
            ? completedInputTurns + 1
            : null,
        inputProgress: inTerminalApproach
          ? terminalProgress
          : normalIndexProgress,
        normalIndexInputAngle,
        normalIndexRatio,
        officialPhaseError: Math.abs(
          stopWheelAngle - expectedStopWheelAngle
        ),
        terminalIndexRatio,
      },
      inputPhase,
      limit: {
        blocked: atTerminalStop,
        blockedForwardClosingRate,
        contactPoint: terminalContactPoint.clone(),
        convexArcEndpoints: [
          stopArcEndpoints[0],
          stopArcEndpoints.at(-1),
        ],
        inputLimitAngle: forwardInputLimit,
        overtravelPrevented: Math.max(
          requestedInputAngle - forwardInputLimit,
          0,
        ),
        remainingInputAngle: forwardInputLimit - inputAngle,
        stopNormal: terminalStopNormal.clone(),
        terminalInputAngle: sourceTerminalInputAngle,
        terminalProgress,
      },
      lock: {
        active: normalLockedDwell,
        concentricityError: lockConcentricityError,
        pocketCenter: lockPocketCenter,
        pocketIndex: lockPoseIndex,
        radialClearance: 0,
      },
      outputSteps: -stopWheelAngle / stopStepAngle,
      stage,
      stopWheelAngle,
      stopWheelAngularAcceleration,
      stopWheelAngularSpeed,
    };
  };
  const stateAtTime = (time) => {
    const input = inputStateAtTime(time);
    return {
      ...stateAtInputAngle(
        input.angle,
        input.angularSpeed,
        input.angularAcceleration,
      ),
      demonstrationDirection: input.direction,
      phaseTime: input.phaseTime,
      timelineSegment: input.name,
      time,
    };
  };

  const canonicalTimes = {
    cycleClosure: demonstrationPeriod,
    firstIndexComplete: forwardSegments[0].endTime,
    firstLockedDwellMid: (
      forwardSegments[1].startTime + forwardSegments[1].endTime
    ) / 2,
    secondIndexStart: forwardSegments[2].startTime,
    secondIndexComplete: forwardSegments[2].endTime,
    secondLockedDwellMid: (
      forwardSegments[3].startTime + forwardSegments[3].endTime
    ) / 2,
    sourceStart: 0,
    terminalApproachStart: forwardSegments.at(-1).startTime,
    terminalStop: forwardMotionDuration,
    terminalStopMidHold: forwardMotionDuration + stopHoldDuration / 2,
    thirdIndexComplete: forwardSegments[4].endTime,
    thirdLockedDwellMid: (
      forwardSegments[5].startTime + forwardSegments[5].endTime
    ) / 2,
    unwindFromStop: reverseMotionStart,
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const sourceRasterImageSize = new THREE.Vector2(525, 525);
  const sourceDriverCenter = new THREE.Vector2(
    249.36201660336283,
    378.4113183769806,
  );
  const sourceStopWheelCenter = new THREE.Vector2(
    235.4680746957663,
    144.76607169304785,
  );
  const sourceCenterVector = new THREE.Vector2(
    sourceStopWheelCenter.x - sourceDriverCenter.x,
    sourceDriverCenter.y - sourceStopWheelCenter.y,
  );
  const sourceCenterDistance = sourceCenterVector.length();
  const sourceCenterDirection = sourceCenterVector.clone()
    .divideScalar(sourceCenterDistance);
  const sourceCenterNormal = new THREE.Vector2(
    sourceCenterDirection.y,
    -sourceCenterDirection.x,
  );
  const sourceScale = centerDistance / sourceCenterDistance;
  const sourcePointToModel = (point, z = 0) => {
    const displacement = new THREE.Vector2(
      point.x - sourceDriverCenter.x,
      sourceDriverCenter.y - point.y,
    );
    return new THREE.Vector3(
      driverCenter.x + displacement.dot(sourceCenterNormal) * sourceScale,
      driverCenter.y + displacement.dot(sourceCenterDirection) * sourceScale,
      z,
    );
  };
  const modelPointToSourceRaster = (point) => {
    const modelDisplacement = new THREE.Vector2(
      point.x - driverCenter.x,
      point.y - driverCenter.y,
    ).divideScalar(sourceScale);
    const sourceDisplacement = sourceCenterNormal.clone()
      .multiplyScalar(modelDisplacement.x)
      .addScaledVector(sourceCenterDirection, modelDisplacement.y);
    return new THREE.Vector2(
      sourceDriverCenter.x + sourceDisplacement.x,
      sourceDriverCenter.y - sourceDisplacement.y,
    );
  };

  root.userData.archetype =
    'five-slot-geneva-winding-stop-three-indexes-and-convex-terminal-sector';
  root.userData.mechanism =
    'one-winding-finger-indexes-four-lock-poses-before-the-fifth-convex-sector-blocks-overwinding';
  root.userData.variant =
    'finite-three-turn-watch-winding-range-with-reversible-run-down-demonstration';
  root.userData.blocks = {
    baseRail,
    bearingArms,
    bearings,
    convexStopHighlight,
    driver,
    driverBody,
    driverEdge,
    driverFingerHighlight,
    driverHub,
    driverIndex,
    driverIndexTip,
    driverShaft,
    feet,
    stopSectorEndpointMarkers,
    stopWheel,
    stopWheelBody,
    stopWheelEdge,
    stopWheelHub,
    stopWheelIndex,
    stopWheelIndexTip,
    stopWheelShaft,
    terminalContactMarker,
    upright,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = {
    blockedForwardClosingRate,
    centerDistance,
    constructionScale,
    convexStopArc,
    convexStopArcRaw,
    driverBoreRadius,
    driverCenter,
    driverDepth,
    driverFingerArc,
    driverFingerArcRaw,
    driverFingerMidAngle,
    driverFingerRadius,
    driverLeftReliefRaw,
    driverLockingArcRaw,
    driverLockingRadius,
    driverOutline,
    driverOutlineRaw,
    driverRightReliefRaw,
    forwardInputLimit,
    lockPocketArcs,
    lockPocketArcsRaw,
    lockPocketCenters,
    lockPocketCentersRaw,
    nominalSlotCount,
    normalIndexCount,
    normalIndexInputAngle,
    rawCenterDistance,
    slotPolylines,
    slotPolylinesRaw,
    sourceTerminalInputAngle,
    sourceTerminalTimedAngle,
    stopSectorRadius,
    stopStepAngle,
    stopWheelBoreRadius,
    stopWheelCenter,
    stopWheelDepth,
    stopWheelOutline,
    stopWheelOutlineRaw,
    terminalContactPoint,
    terminalStopNormal,
    terminalStopShoulder,
    terminalStopWheelAdvance,
  };
  root.userData.inputStateAtTime = inputStateAtTime;
  root.userData.modelPointToSourceRaster = modelPointToSourceRaster;
  root.userData.sourceAnchors = {
    driverCenter: sourceDriverCenter.clone(),
    modeledDriverCenter: modelPointToSourceRaster(driverCenter),
    modeledStopWheelCenter: modelPointToSourceRaster(stopWheelCenter),
    stopWheelCenter: sourceStopWheelCenter.clone(),
  };
  root.userData.sourceAnimation = {
    available: true,
    driverFinalPoseDegrees: THREE.MathUtils.radToDeg(
      sourceTerminalInputAngle,
    ),
    driverFullTurnsBeforeStop: normalIndexCount,
    officialDurationSeconds: 12,
    officialLoopResetsDiscontinuously: true,
    officialNormalIndexInputDegrees: 51,
    officialNormalizedIntervals: {
      firstIndex: [0, (51 / 360) / 4],
      secondIndex: [0.25, (1 + 51 / 360) / 4],
      terminalApproach: [0.75, (3 + 33.25 / 360) / 4],
      terminalHold: [(3 + 33.25 / 360) / 4, 1],
      thirdIndex: [0.5, (2 + 51 / 360) / 4],
    },
    runtimeUsesContinuousReverseReturn: true,
    stopWheelFinalPoseDegrees: THREE.MathUtils.radToDeg(
      sourceTerminalStopWheelAngle,
    ),
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceRaster = {
    fittedDriverCenter: sourceDriverCenter.clone(),
    fittedDriverOuterRadius: 136.28425792802648,
    fittedStopWheelCenter: sourceStopWheelCenter.clone(),
    height: sourceRasterImageSize.y,
    sourcePose: 'winding-finger-entering-first-geneva-slot',
    sourceUrl: 'https://507movements.com/mm_212.html',
    width: sourceRasterImageSize.x,
  };
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.stopWheelAngleAtInputAngle = stopWheelAngleAtInputAngle;
  root.userData.timeline = {
    demonstrationPeriod,
    forwardMotionDuration,
    forwardSegments,
    reverseMotionStart,
    startHoldDuration,
    startHoldStart,
    stopHoldDuration,
  };
  root.userData.transmission = {
    direction: 'opposite-during-each-index-and-locked-between-indexes',
    forwardInputLimit,
    inputTurnsBeforeTerminalStop: forwardInputLimit / fullTurn,
    nominalSlotCount,
    normalIndexCount,
    normalIndexInputAngle,
    normalIndexRatio,
    outputStepsAtStop: -sourceTerminalStopWheelAngle / stopStepAngle,
    stopStepAngle,
    terminalIndexRatio,
    terminalStopWheelAdvance,
  };
  root.userData.cameraDistanceScale = 1.08;

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(driver, state.driverAngle);
    setSpin(driverShaft, state.driverAngle);
    setSpin(stopWheel, state.stopWheelAngle);
    setSpin(stopWheelShaft, state.stopWheelAngle);
    terminalContactMarker.visible = state.atTerminalStop;
    driver.userData.angularSpeed = state.driverAngularSpeed;
    driverShaft.userData.angularSpeed = state.driverAngularSpeed;
    stopWheel.userData.angularSpeed = state.stopWheelAngularSpeed;
    stopWheelShaft.userData.angularSpeed = state.stopWheelAngularSpeed;
    root.userData.contacts = {
      convexTerminalStop: state.atTerminalStop ? state.limit : null,
      lockingPocket: state.lock.active ? state.lock : null,
      windingFingerSlot: state.engagement.active
        ? state.engagement
        : null,
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finishGeneva212Contact(finishGenevaWorkingParts(finish(root, update, new THREE.Vector3(4.8, 3.9, 10.5)), 212));
}

function splitRimFacePinWindingStop() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.02;

  // Measurements are from the original 525 px Movement 213 engraving. The
  // lower member is a ratchet wheel on the winding arbor. Its teeth are in a
  // rear plane and do not mesh with the upper member. The small round pin on
  // its face is the only driver of the split, friction-held stop wheel.
  const sourceRasterImageSize = new THREE.Vector2(525, 525);
  const sourceDriverCenter = new THREE.Vector2(
    255.6910994764398,
    312.6614310645724,
  );
  const sourceStopWheelCenter = new THREE.Vector2(
    264.42509368,
    148.03630403,
  );
  const sourceFacePinCenter = new THREE.Vector2(
    246.18305324,
    243.28089158,
  );
  const sourceStopOuterRadius = 106.20631146;
  const sourceStopInnerRadius = 51.18879083;
  // Outer edge of the pin's inked ring (15.7 px across). The earlier 9.58 px
  // fit took in ink blur and made the pin wider than Brown's tooth gaps.
  const sourceFacePinRadius = 7.8;
  const sourceCenterVector = new THREE.Vector2(
    sourceStopWheelCenter.x - sourceDriverCenter.x,
    sourceDriverCenter.y - sourceStopWheelCenter.y,
  );
  const sourceCenterDistance = sourceCenterVector.length();
  const sourceCenterDirection = sourceCenterVector.clone()
    .divideScalar(sourceCenterDistance);
  const sourceCenterNormal = new THREE.Vector2(
    sourceCenterDirection.y,
    -sourceCenterDirection.x,
  );
  const sourceFacePinVector = new THREE.Vector2(
    sourceFacePinCenter.x - sourceDriverCenter.x,
    sourceDriverCenter.y - sourceFacePinCenter.y,
  );
  const sourceFacePinInModelBasis = new THREE.Vector2(
    sourceFacePinVector.dot(sourceCenterNormal),
    sourceFacePinVector.dot(sourceCenterDirection),
  );

  const centerDistance = sourceCenterDistance * sourceScale;
  const driverCenter = new THREE.Vector2(0, -centerDistance / 2);
  const stopWheelCenter = new THREE.Vector2(0, centerDistance / 2);
  const stopOuterRadius = sourceStopOuterRadius * sourceScale;
  const stopInnerRadius = sourceStopInnerRadius * sourceScale;
  const stopToothRootRadius = 85 * sourceScale;
  const facePinOrbitRadius = sourceFacePinInModelBasis.length()
    * sourceScale;
  const facePinRadius = sourceFacePinRadius * sourceScale;
  const driverRatchetTipRadius = 98 * sourceScale;
  const driverRatchetRootRadius = 82 * sourceScale;
  const driverRatchetToothCount = 22;
  const stopEquivalentToothCount = 22;
  const installedStopToothCount = 5;
  const stopGapCount = installedStopToothCount + 1;
  const stopPitchAngle = fullTurn / stopEquivalentToothCount;
  const stopSectorCenterAngle = -Math.PI / 2;
  const stopSectorStartAngle = stopSectorCenterAngle
    - stopGapCount * stopPitchAngle / 2;
  const stopSectorEndAngle = stopSectorCenterAngle
    + stopGapCount * stopPitchAngle / 2;
  const stopToothTopFraction = 0.36;
  const splitHalfAngle = THREE.MathUtils.degToRad(4.8);
  const driverDepth = 0.34;
  const stopWheelDepth = 0.34;
  const driverPlaneZ = -0.46;
  const stopWheelPlaneZ = 0.22;
  const axialClearance = stopWheelPlaneZ - stopWheelDepth / 2
    - (driverPlaneZ + driverDepth / 2);

  const polarPoint = (radius, angle) => new THREE.Vector2(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
  );
  const appendArc = (
    points,
    radius,
    startAngle,
    endAngle,
    segmentCount,
  ) => {
    for (let index = 0; index <= segmentCount; index += 1) {
      if (index === 0 && points.length > 0) continue;
      const angle = THREE.MathUtils.lerp(
        startAngle,
        endAngle,
        index / segmentCount,
      );
      points.push(polarPoint(radius, angle));
    }
  };
  const extrudeProfile = (shape, depth) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: false,
      curveSegments: 24,
      depth,
      steps: 1,
    });
    geometry.translate(0, 0, -depth / 2);
    geometry.computeVertexNormals();
    return geometry;
  };
  const shapeFromPoints = (points) => {
    const shape = new THREE.Shape();
    points.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    });
    shape.closePath();
    return shape;
  };
  const makeProfileTube = ({
    closed = true,
    material,
    points,
    radius = 0.014,
    role,
    z,
  }) => {
    const path = new THREE.CurvePath();
    const segmentCount = closed ? points.length : points.length - 1;
    for (let index = 0; index < segmentCount; index += 1) {
      const start = points[index];
      const end = points[(index + 1) % points.length];
      path.add(new THREE.LineCurve3(
        new THREE.Vector3(start.x, start.y, z),
        new THREE.Vector3(end.x, end.y, z),
      ));
    }
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(
        path,
        Math.max(72, points.length * 2),
        radius,
        6,
        closed,
      ),
      material,
    );
    tube.userData.role = role;
    return tube;
  };

  const stopToothCenters = Array.from(
    { length: installedStopToothCount },
    (_, index) => stopSectorCenterAngle
      + (index - (installedStopToothCount - 1) / 2)
        * stopPitchAngle,
  );
  const stopToothArcs = [];
  const stopOuterProfile = [];
  const splitStartAngle = Math.PI / 2 + splitHalfAngle;
  const splitEndAngle = Math.PI / 2 + fullTurn - splitHalfAngle;
  appendArc(
    stopOuterProfile,
    stopOuterRadius,
    splitStartAngle,
    stopSectorStartAngle + fullTurn,
    132,
  );
  stopOuterProfile.push(
    polarPoint(stopToothRootRadius, stopSectorStartAngle + fullTurn),
  );
  let currentRootAngle = stopSectorStartAngle + fullTurn;
  for (const toothCenter of stopToothCenters) {
    const resolvedCenter = toothCenter + fullTurn;
    const toothHalfAngle = stopPitchAngle * stopToothTopFraction / 2;
    const toothStart = resolvedCenter - toothHalfAngle;
    const toothEnd = resolvedCenter + toothHalfAngle;
    appendArc(
      stopOuterProfile,
      stopToothRootRadius,
      currentRootAngle,
      toothStart,
      12,
    );
    stopOuterProfile.push(polarPoint(stopOuterRadius, toothStart));
    const toothArc = [];
    appendArc(
      toothArc,
      stopOuterRadius,
      toothStart,
      toothEnd,
      8,
    );
    stopToothArcs.push(toothArc);
    stopOuterProfile.push(...toothArc.slice(1));
    stopOuterProfile.push(polarPoint(stopToothRootRadius, toothEnd));
    currentRootAngle = toothEnd;
  }
  appendArc(
    stopOuterProfile,
    stopToothRootRadius,
    currentRootAngle,
    stopSectorEndAngle + fullTurn,
    12,
  );
  stopOuterProfile.push(
    polarPoint(stopOuterRadius, stopSectorEndAngle + fullTurn),
  );
  appendArc(
    stopOuterProfile,
    stopOuterRadius,
    stopSectorEndAngle + fullTurn,
    splitEndAngle,
    132,
  );

  const stopInnerProfile = [];
  appendArc(
    stopInnerProfile,
    stopInnerRadius,
    splitEndAngle,
    splitStartAngle,
    150,
  );
  const stopRingOutline = [
    ...stopOuterProfile,
    polarPoint(stopInnerRadius, splitEndAngle),
    ...stopInnerProfile.slice(1),
  ];
  const stopRingShape = shapeFromPoints(stopRingOutline);

  const driverRatchetOutline = [];
  const driverToothAngles = [];
  const driverToothPhase = THREE.MathUtils.degToRad(3.5);
  for (let index = 0; index < driverRatchetToothCount; index += 1) {
    const center = driverToothPhase
      + index * fullTurn / driverRatchetToothCount;
    const pitch = fullTurn / driverRatchetToothCount;
    driverRatchetOutline.push(
      polarPoint(driverRatchetRootRadius, center - pitch * 0.49),
      polarPoint(driverRatchetTipRadius, center + pitch * 0.14),
      polarPoint(driverRatchetRootRadius, center + pitch * 0.49),
    );
    driverToothAngles.push(center + pitch * 0.14);
  }
  const driverRatchetShape = shapeFromPoints(driverRatchetOutline);
  const squareBoreHalfSize = 0.22;
  const squareBore = new THREE.Path();
  squareBore.moveTo(-squareBoreHalfSize, -squareBoreHalfSize);
  squareBore.lineTo(-squareBoreHalfSize, squareBoreHalfSize);
  squareBore.lineTo(squareBoreHalfSize, squareBoreHalfSize);
  squareBore.lineTo(squareBoreHalfSize, -squareBoreHalfSize);
  squareBore.closePath();
  driverRatchetShape.holes.push(squareBore);

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.62,
    side: THREE.DoubleSide,
  });
  const stopMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.49,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.2,
    roughness: 0.48,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.44,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.13,
    roughness: 0.66,
  });

  const driver = makePlanarRotor();
  driver.position.set(driverCenter.x, driverCenter.y, 0);
  driver.userData.role = 'twenty-two-tooth-winding-ratchet-A';
  const driverBody = new THREE.Mesh(
    extrudeProfile(driverRatchetShape, driverDepth),
    driverMaterial,
  );
  driverBody.position.z = driverPlaneZ;
  driverBody.userData.role =
    'rear-plane-ratchet-wheel-not-meshed-to-stop-ring';
  driverBody.userData.ratchetToothCount = driverRatchetToothCount;
  driverBody.userData.directlyMeshesStopWheel = false;
  const driverIndex = new THREE.Mesh(
    new THREE.BoxGeometry(1.02, 0.064, 0.028),
    whiteMaterial,
  );
  driverIndex.position.set(
    0.78,
    0,
    driverPlaneZ + driverDepth / 2 + 0.052,
  );
  driverIndex.userData.role = 'winding-ratchet-radial-speed-index';
  const driverIndexTip = new THREE.Object3D();
  driverIndexTip.position.set(
    1.29,
    0,
    driverPlaneZ + driverDepth / 2 + 0.052,
  );
  driverIndexTip.userData.role = 'winding-ratchet-index-tip';
  driver.userData.rotor.add(
    driverBody,
    driverIndex,
    driverIndexTip,
  );

  const contactCircleRadius = stopOuterRadius + facePinRadius;
  const contactSine = (
    facePinOrbitRadius * facePinOrbitRadius
      + centerDistance * centerDistance
      - contactCircleRadius * contactCircleRadius
  ) / (2 * facePinOrbitRadius * centerDistance);
  const entryContactPhase = Math.asin(contactSine);
  const exitContactPhase = Math.PI - entryContactPhase;
  const activeIndexInputAngle = exitContactPhase - entryContactPhase;
  const freeApproachInputAngle = fullTurn - activeIndexInputAngle;
  const facePinMountPhase = exitContactPhase;
  const facePinLength = 0.9;
  const facePin = new THREE.Mesh(
    new THREE.CylinderGeometry(
      facePinRadius,
      facePinRadius,
      facePinLength,
      32,
    ),
    brassMaterial,
  );
  facePin.rotation.x = Math.PI / 2;
  facePin.position.set(
    Math.cos(facePinMountPhase) * facePinOrbitRadius,
    Math.sin(facePinMountPhase) * facePinOrbitRadius,
    0.02,
  );
  facePin.userData.role = 'single-round-face-pin-indexing-driver';
  facePin.userData.onlyStopWheelDriver = true;
  const facePinCap = new THREE.Mesh(
    new THREE.CylinderGeometry(
      facePinRadius * 0.58,
      facePinRadius * 0.58,
      0.034,
      28,
    ),
    whiteMaterial,
  );
  facePinCap.rotation.x = Math.PI / 2;
  facePinCap.position.set(
    facePin.position.x,
    facePin.position.y,
    stopWheelPlaneZ + stopWheelDepth / 2 + 0.055,
  );
  facePinCap.userData.role = 'face-pin-front-motion-index';
  driver.userData.rotor.add(facePin, facePinCap);

  const stopWheel = makePlanarRotor();
  stopWheel.position.set(stopWheelCenter.x, stopWheelCenter.y, 0);
  stopWheel.userData.role = 'five-tooth-split-friction-stop-wheel-B';
  const stopWheelBody = new THREE.Mesh(
    extrudeProfile(stopRingShape, stopWheelDepth),
    stopMaterial,
  );
  stopWheelBody.position.z = stopWheelPlaneZ;
  stopWheelBody.userData.role =
    'split-rim-five-teeth-six-gaps-and-uncut-stop-arc';
  stopWheelBody.userData.installedToothCount = installedStopToothCount;
  stopWheelBody.userData.selfHoldingSplitRing = true;
  const stopWheelOutline = makeProfileTube({
    material: inkMaterial,
    points: stopRingOutline,
    radius: 0.013,
    role: 'split-rim-inner-outer-and-partial-tooth-outline',
    z: stopWheelPlaneZ + stopWheelDepth / 2 + 0.012,
  });
  const stopToothHighlights = stopToothArcs.map((points, index) => {
    const highlight = makeProfileTube({
      closed: false,
      material: whiteMaterial,
      points,
      radius: 0.022,
      role: `partial-stop-tooth-${index + 1}-tip-highlight`,
      z: stopWheelPlaneZ + stopWheelDepth / 2 + 0.062,
    });
    return highlight;
  });
  const stopShoulderAngles = [
    stopSectorStartAngle,
    stopSectorEndAngle,
  ];
  const stopShoulderHighlights = stopShoulderAngles.map((angle, index) => {
    const highlight = makeProfileTube({
      closed: false,
      material: brassMaterial,
      points: [
        polarPoint(stopToothRootRadius, angle),
        polarPoint(stopOuterRadius, angle),
      ],
      radius: 0.024,
      role: index === 0
        ? 'initial-uncut-rim-stop-boundary'
        : 'final-uncut-rim-stop-boundary',
      z: stopWheelPlaneZ + stopWheelDepth / 2 + 0.066,
    });
    return highlight;
  });
  const stopWheelIndexAngle = 0;
  const stopWheelIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.82, 0.06, 0.028),
    whiteMaterial,
  );
  stopWheelIndex.position.set(
    1.39,
    0,
    stopWheelPlaneZ + stopWheelDepth / 2 + 0.066,
  );
  stopWheelIndex.userData.role = 'split-stop-wheel-radial-speed-index';
  const stopWheelIndexTip = new THREE.Object3D();
  stopWheelIndexTip.position.set(
    1.8,
    0,
    stopWheelPlaneZ + stopWheelDepth / 2 + 0.066,
  );
  stopWheelIndexTip.userData.role = 'split-stop-wheel-index-tip';
  stopWheel.userData.rotor.add(
    stopWheelBody,
    stopWheelOutline,
    ...stopToothHighlights,
    ...stopShoulderHighlights,
    stopWheelIndex,
    stopWheelIndexTip,
  );

  const driverShaft = makeShaft({
    axis: Z_AXIS,
    length: 1.72,
    radius: 0.105,
  });
  driverShaft.position.set(driverCenter.x, driverCenter.y, -0.08);
  driverShaft.userData.role = 'square-arbor-winding-input-shaft';
  // The arbor square fills Brown's square bore with a 0.01 side clearance.
  const driverSquareSide = 2 * squareBoreHalfSize - 0.02;
  const driverSquare = new THREE.Mesh(
    new THREE.BoxGeometry(driverSquareSide, driverSquareSide, 0.48),
    inkMaterial,
  );
  driverSquare.position.set(0, 0, driverPlaneZ + 0.03);
  driverSquare.userData.role = 'winding-arbor-square';
  driver.userData.rotor.add(driverSquare);

  const frictionDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(
      stopInnerRadius - 0.075,
      stopInnerRadius - 0.075,
      0.24,
      64,
    ),
    frameMaterial,
  );
  frictionDrum.rotation.x = Math.PI / 2;
  frictionDrum.position.set(
    stopWheelCenter.x,
    stopWheelCenter.y,
    stopWheelPlaneZ - 0.1,
  );
  frictionDrum.userData.fixed = true;
  frictionDrum.userData.role = 'fixed-undercut-friction-stud-drum';
  const frictionBand = new THREE.Mesh(
    new THREE.TorusGeometry(
      stopInnerRadius - 0.055,
      0.026,
      10,
      64,
    ),
    brassMaterial,
  );
  frictionBand.position.set(
    stopWheelCenter.x,
    stopWheelCenter.y,
    stopWheelPlaneZ + 0.025,
  );
  frictionBand.userData.fixed = true;
  frictionBand.userData.role = 'split-ring-static-friction-interface';
  const stopWheelStud = makeShaft({
    axis: Z_AXIS,
    length: 1.42,
    radius: 0.095,
  });
  stopWheelStud.position.set(
    stopWheelCenter.x,
    stopWheelCenter.y,
    -0.02,
  );
  stopWheelStud.userData.role = 'fixed-split-ring-center-stud';
  stopWheelStud.userData.fixed = true;

  const activeContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.062, 18, 12),
    whiteMaterial,
  );
  activeContactMarker.visible = false;
  activeContactMarker.userData.role =
    'moving-face-pin-to-partial-tooth-contact-marker';
  const stopContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 18, 12),
    whiteMaterial,
  );
  stopContactMarker.visible = false;
  stopContactMarker.userData.role =
    'face-pin-to-uncut-rim-hard-stop-contact-marker';

  const rearZ = -0.94;
  const baseY = driverCenter.y - 2.23;
  const sideX = -2.62;
  const baseRail = makeBeam(
    new THREE.Vector3(-2.85, baseY, rearZ),
    new THREE.Vector3(2.85, baseY, rearZ),
    { color: PALETTE.frame, depth: 0.18, thickness: 0.15 },
  );
  baseRail.userData.role = 'friction-stop-fixed-base-rail';
  const upright = makeBeam(
    new THREE.Vector3(sideX, baseY, rearZ),
    new THREE.Vector3(sideX, stopWheelCenter.y + 2.3, rearZ),
    { color: PALETTE.frame, depth: 0.18, thickness: 0.15 },
  );
  upright.userData.role = 'friction-stop-fixed-bearing-upright';
  const bearingArms = [driverCenter, stopWheelCenter].map((center, index) => {
    const arm = makeBeam(
      new THREE.Vector3(sideX, center.y, rearZ),
      new THREE.Vector3(center.x, center.y, rearZ),
      { color: PALETTE.frame, depth: 0.17, thickness: 0.14 },
    );
    arm.userData.role = index === 0
      ? 'winding-arbor-rear-bearing-arm'
      : 'split-stop-stud-rear-bearing-arm';
    return arm;
  });
  const bearings = [driverCenter, stopWheelCenter].map((center, index) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.052, 10, 40),
      frameMaterial,
    );
    bearing.position.set(center.x, center.y, rearZ + 0.05);
    bearing.userData.fixed = true;
    bearing.userData.role = index === 0
      ? 'fixed-winding-arbor-bearing'
      : 'fixed-split-stop-wheel-bearing';
    return bearing;
  });
  const feet = [-2.48, 2.42].map((x, index) => {
    const foot = makeBeam(
      new THREE.Vector3(x, baseY, rearZ - 0.44),
      new THREE.Vector3(x, baseY, 0.4),
      { color: PALETTE.frame, depth: 0.17, thickness: 0.14 },
    );
    foot.userData.role = index === 0
      ? 'friction-stop-left-transverse-foot'
      : 'friction-stop-right-transverse-foot';
    return foot;
  });
  root.add(
    driver,
    stopWheel,
    driverShaft,
    frictionDrum,
    frictionBand,
    stopWheelStud,
    activeContactMarker,
    stopContactMarker,
    baseRail,
    upright,
    ...bearingArms,
    ...bearings,
    ...feet,
  );

  const smootherStep = (fraction) => {
    const clamped = THREE.MathUtils.clamp(fraction, 0, 1);
    return clamped * clamped * clamped
      * (10 + clamped * (-15 + 6 * clamped));
  };
  const smootherStepDerivative = (fraction) => {
    const clamped = THREE.MathUtils.clamp(fraction, 0, 1);
    return 30 * clamped * clamped
      * (clamped - 1) * (clamped - 1);
  };
  const smootherStepSecondDerivative = (fraction) => {
    const clamped = THREE.MathUtils.clamp(fraction, 0, 1);
    return 60 * clamped
      * (2 * clamped * clamped - 3 * clamped + 1);
  };
  const sourceFacePinPhase = sourceFacePinInModelBasis.angle();
  const sourceActiveProgress = (
    sourceFacePinPhase - entryContactPhase
  ) / activeIndexInputAngle;
  const sourceIndexProgress = smootherStep(sourceActiveProgress);
  const initialStopWheelAngle = (
    2 + sourceIndexProgress
  ) * stopPitchAngle;
  const finalStopWheelAngle = initialStopWheelAngle
    - installedStopToothCount * stopPitchAngle;
  const sourceTurnPhase = THREE.MathUtils.euclideanModulo(
    sourceFacePinPhase - facePinMountPhase,
    fullTurn,
  );
  const sourceInputTravel = 2 * fullTurn + sourceTurnPhase;
  const forwardInputLimit = installedStopToothCount * fullTurn
    + freeApproachInputAngle;

  const pinCenterAtInputTravel = (inputTravel) => {
    const phase = facePinMountPhase + inputTravel;
    return new THREE.Vector2(
      driverCenter.x + Math.cos(phase) * facePinOrbitRadius,
      driverCenter.y + Math.sin(phase) * facePinOrbitRadius,
    );
  };
  const pinToStopContactPoint = (pinCenter) => {
    const normal = pinCenter.clone().sub(stopWheelCenter).normalize();
    return stopWheelCenter.clone().addScaledVector(
      normal,
      stopOuterRadius,
    );
  };
  const initialFacePinCenter = pinCenterAtInputTravel(0);
  const finalFacePinCenter = pinCenterAtInputTravel(forwardInputLimit);
  const initialStopContactPoint = pinToStopContactPoint(
    initialFacePinCenter,
  );
  const finalStopContactPoint = pinToStopContactPoint(finalFacePinCenter);
  const initialStopNormal = initialStopContactPoint.clone()
    .sub(stopWheelCenter).normalize();
  const finalStopNormal = finalStopContactPoint.clone()
    .sub(stopWheelCenter).normalize();
  const pinVelocityPerInputRadian = (inputTravel) => {
    const phase = facePinMountPhase + inputTravel;
    return new THREE.Vector2(
      -Math.sin(phase) * facePinOrbitRadius,
      Math.cos(phase) * facePinOrbitRadius,
    );
  };
  const initialBlockedReverseClosingRate = Math.abs(
    pinVelocityPerInputRadian(0).dot(initialStopNormal),
  );
  const finalBlockedForwardClosingRate = Math.abs(
    pinVelocityPerInputRadian(forwardInputLimit).dot(finalStopNormal),
  );
  const normalizeSignedAngle = (angle) => Math.atan2(
    Math.sin(angle),
    Math.cos(angle),
  );
  const initialContactAngle = initialStopNormal.angle();
  const finalContactAngle = finalStopNormal.angle();
  const initialUncutRimMarginAngle = normalizeSignedAngle(
    stopSectorStartAngle + initialStopWheelAngle - initialContactAngle,
  );
  const finalUncutRimMarginAngle = normalizeSignedAngle(
    finalContactAngle - (stopSectorEndAngle + finalStopWheelAngle),
  );

  const stopWheelAngleAtInputTravel = (requestedInputTravel) => {
    const inputTravel = THREE.MathUtils.clamp(
      requestedInputTravel,
      0,
      forwardInputLimit,
    );
    if (inputTravel >= installedStopToothCount * fullTurn) {
      return finalStopWheelAngle;
    }
    const completedIndexes = Math.floor(inputTravel / fullTurn);
    const turnPhase = inputTravel - completedIndexes * fullTurn;
    if (turnPhase <= freeApproachInputAngle) {
      return initialStopWheelAngle
        - completedIndexes * stopPitchAngle;
    }
    const activeProgress = (
      turnPhase - freeApproachInputAngle
    ) / activeIndexInputAngle;
    return initialStopWheelAngle
      - (completedIndexes + smootherStep(activeProgress))
        * stopPitchAngle;
  };

  const stateAtInputTravel = (
    requestedInputTravel,
    driverAngularSpeed = 0,
    driverAngularAcceleration = 0,
  ) => {
    let inputTravel = THREE.MathUtils.clamp(
      requestedInputTravel,
      0,
      forwardInputLimit,
    );
    const exactInputAngles = [
      0,
      ...Array.from(
        { length: installedStopToothCount },
        (_, index) => (index + 1) * fullTurn,
      ),
      sourceInputTravel,
      forwardInputLimit,
    ];
    const exactInput = exactInputAngles.find((angle) => (
      Math.abs(inputTravel - angle) <= 1e-10
    ));
    if (exactInput !== undefined) inputTravel = exactInput;

    const tryingPastInitialStop = inputTravel <= 1e-11
      && driverAngularSpeed <= 1e-12;
    const tryingPastFinalStop = inputTravel >= forwardInputLimit - 1e-11
      && driverAngularSpeed >= -1e-12;
    const resolvedDriverAngularSpeed = (
      tryingPastInitialStop || tryingPastFinalStop
    ) ? 0 : driverAngularSpeed;
    const resolvedDriverAngularAcceleration = (
      tryingPastInitialStop || tryingPastFinalStop
    ) ? 0 : driverAngularAcceleration;

    const inFinalApproach = inputTravel
      >= installedStopToothCount * fullTurn;
    const completedIndexes = inFinalApproach
      ? installedStopToothCount
      : Math.floor(inputTravel / fullTurn);
    const turnPhase = inFinalApproach
      ? inputTravel - installedStopToothCount * fullTurn
      : inputTravel - completedIndexes * fullTurn;
    const inActiveIndex = !inFinalApproach
      && turnPhase > freeApproachInputAngle + 1e-12;
    const activeProgress = inActiveIndex
      ? (turnPhase - freeApproachInputAngle) / activeIndexInputAngle
      : null;
    const outputProgress = inActiveIndex
      ? smootherStep(activeProgress)
      : null;
    const instantaneousRatio = inActiveIndex
      ? -stopPitchAngle / activeIndexInputAngle
        * smootherStepDerivative(activeProgress)
      : 0;
    const ratioDerivative = inActiveIndex
      ? -stopPitchAngle
        / (activeIndexInputAngle * activeIndexInputAngle)
        * smootherStepSecondDerivative(activeProgress)
      : 0;
    const stopWheelAngle = stopWheelAngleAtInputTravel(inputTravel);
    const stopWheelAngularSpeed = instantaneousRatio
      * resolvedDriverAngularSpeed;
    const stopWheelAngularAcceleration = instantaneousRatio
      * resolvedDriverAngularAcceleration
      + ratioDerivative
        * resolvedDriverAngularSpeed * resolvedDriverAngularSpeed;
    const pinCenter = pinCenterAtInputTravel(inputTravel);
    const pinTowardStop = stopWheelCenter.clone().sub(pinCenter).normalize();
    const movingContactPoint = pinCenter.clone().addScaledVector(
      pinTowardStop,
      facePinRadius,
    );
    const atInitialStop = tryingPastInitialStop;
    const atFinalStop = tryingPastFinalStop;
    const frictionHeld = !inActiveIndex;
    let stage;
    if (atInitialStop) stage = 'initial-uncut-rim-hard-stop';
    else if (atFinalStop) stage = 'final-uncut-rim-hard-stop';
    else if (inActiveIndex) {
      stage = `face-pin-indexes-stop-tooth-${completedIndexes + 1}`;
    } else if (inFinalApproach) {
      stage = 'friction-held-final-rim-approach';
    } else if (completedIndexes === 0) {
      stage = 'friction-held-before-first-index';
    } else {
      stage = `friction-held-after-index-${completedIndexes}`;
    }

    const activeToothIndex = inActiveIndex
      ? completedIndexes + 1
      : null;
    const stopContact = atInitialStop
      ? {
        blockedDirection: 'reverse',
        closingRatePerInputRadian: initialBlockedReverseClosingRate,
        contactPoint: initialStopContactPoint.clone(),
        normal: initialStopNormal.clone(),
        side: 'initial',
      }
      : atFinalStop
        ? {
          blockedDirection: 'forward',
          closingRatePerInputRadian: finalBlockedForwardClosingRate,
          contactPoint: finalStopContactPoint.clone(),
          normal: finalStopNormal.clone(),
          side: 'final',
        }
        : null;

    return {
      activeIndex: activeToothIndex,
      atFinalStop,
      atInitialStop,
      completedIndexes,
      contactMode: stage,
      driverAngle: inputTravel,
      driverAngularAcceleration: resolvedDriverAngularAcceleration,
      driverAngularSpeed: resolvedDriverAngularSpeed,
      engagement: {
        active: inActiveIndex,
        contactPoint: movingContactPoint,
        inputProgress: activeProgress,
        instantaneousRatio,
        outputProgress,
        pinCenter,
        toothIndex: activeToothIndex,
      },
      frictionRetention: {
        active: frictionHeld,
        angularSlip: 0,
        fixedStudRadius: stopInnerRadius - 0.075,
        method: 'self-sprung-split-rim-on-undercut-fixed-stud',
      },
      inputTravel,
      limit: {
        blocked: atInitialStop || atFinalStop,
        finalInputLimit: forwardInputLimit,
        initialUndertravelPrevented: Math.max(-requestedInputTravel, 0),
        overtravelPrevented: Math.max(
          requestedInputTravel - forwardInputLimit,
          0,
        ),
        remainingInputTravel: forwardInputLimit - inputTravel,
        stopContact,
      },
      stage,
      stopWheelAngle,
      stopWheelAngularAcceleration,
      stopWheelAngularSpeed,
      turnPhase,
    };
  };

  const initialHoldDuration = 1.1;
  const forwardMotionDuration = 18;
  const finalHoldDuration = 1.4;
  const reverseMotionDuration = forwardMotionDuration;
  const forwardMotionStart = initialHoldDuration;
  const forwardMotionEnd = forwardMotionStart + forwardMotionDuration;
  const reverseMotionStart = forwardMotionEnd + finalHoldDuration;
  const demonstrationPeriod = reverseMotionStart + reverseMotionDuration;
  const evaluateForwardMotion = (elapsed) => {
    const linearFraction = THREE.MathUtils.clamp(
      elapsed / forwardMotionDuration,
      0,
      1,
    );
    return {
      angle: forwardInputLimit * smootherStep(linearFraction),
      angularAcceleration: forwardInputLimit
        * smootherStepSecondDerivative(linearFraction)
        / (forwardMotionDuration * forwardMotionDuration),
      angularSpeed: forwardInputLimit
        * smootherStepDerivative(linearFraction)
        / forwardMotionDuration,
      linearFraction,
    };
  };
  const inputStateAtTime = (time) => {
    const phaseTime = THREE.MathUtils.euclideanModulo(
      time,
      demonstrationPeriod,
    );
    if (phaseTime <= forwardMotionStart) {
      return {
        angle: 0,
        angularAcceleration: 0,
        angularSpeed: 0,
        direction: 'held-at-initial-stop',
        linearFraction: 0,
        phaseTime,
        timelineSegment: 'initial-stop-hold',
      };
    }
    if (phaseTime <= forwardMotionEnd) {
      return {
        ...evaluateForwardMotion(phaseTime - forwardMotionStart),
        direction: 'winding-toward-final-stop',
        phaseTime,
        timelineSegment: 'forward-five-index-winding-traverse',
      };
    }
    if (phaseTime <= reverseMotionStart) {
      return {
        angle: forwardInputLimit,
        angularAcceleration: 0,
        angularSpeed: 0,
        direction: 'held-at-final-stop',
        linearFraction: 1,
        phaseTime,
        timelineSegment: 'final-stop-hold',
      };
    }
    const reverseElapsed = phaseTime - reverseMotionStart;
    const forward = evaluateForwardMotion(
      forwardMotionDuration - reverseElapsed,
    );
    return {
      ...forward,
      angularSpeed: -forward.angularSpeed,
      direction: 'running-down-toward-initial-stop',
      phaseTime,
      timelineSegment: 'reverse-five-index-run-down-traverse',
    };
  };
  const stateAtTime = (time) => {
    const input = inputStateAtTime(time);
    return {
      ...stateAtInputTravel(
        input.angle,
        input.angularSpeed,
        input.angularAcceleration,
      ),
      demonstrationDirection: input.direction,
      phaseTime: input.phaseTime,
      time,
      timelineSegment: input.timelineSegment,
    };
  };
  const inverseSmootherStep = (value) => {
    let lower = 0;
    let upper = 1;
    for (let iteration = 0; iteration < 64; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (smootherStep(middle) < value) lower = middle;
      else upper = middle;
    }
    return (lower + upper) / 2;
  };
  const forwardTimeAtInputTravel = (inputTravel) => (
    forwardMotionStart + forwardMotionDuration * inverseSmootherStep(
      inputTravel / forwardInputLimit,
    )
  );
  const indexMidInputTravels = Array.from(
    { length: installedStopToothCount },
    (_, index) => index * fullTurn
      + freeApproachInputAngle + activeIndexInputAngle / 2,
  );
  const canonicalTimes = {
    cycleClosure: demonstrationPeriod,
    fifthIndexComplete: forwardTimeAtInputTravel(5 * fullTurn),
    finalApproachMid: forwardTimeAtInputTravel(
      5 * fullTurn + freeApproachInputAngle / 2,
    ),
    finalStop: forwardMotionEnd,
    finalStopMidHold: forwardMotionEnd + finalHoldDuration / 2,
    firstIndexComplete: forwardTimeAtInputTravel(fullTurn),
    firstIndexMid: forwardTimeAtInputTravel(indexMidInputTravels[0]),
    initialStop: 0,
    sourcePose: forwardTimeAtInputTravel(sourceInputTravel),
    unwindFromFinalStop: reverseMotionStart,
    ...Object.fromEntries(indexMidInputTravels.map((inputTravel, index) => [
      `index${index + 1}Mid`,
      forwardTimeAtInputTravel(inputTravel),
    ])),
    ...Object.fromEntries(Array.from(
      { length: installedStopToothCount },
      (_, index) => [
        `index${index + 1}Complete`,
        forwardTimeAtInputTravel((index + 1) * fullTurn),
      ],
    )),
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const sourcePointToModel = (point, z = 0) => {
    const displacement = new THREE.Vector2(
      point.x - sourceDriverCenter.x,
      sourceDriverCenter.y - point.y,
    );
    return new THREE.Vector3(
      driverCenter.x + displacement.dot(sourceCenterNormal) * sourceScale,
      driverCenter.y + displacement.dot(sourceCenterDirection) * sourceScale,
      z,
    );
  };
  const modelPointToSourceRaster = (point) => {
    const modelDisplacement = new THREE.Vector2(
      point.x - driverCenter.x,
      point.y - driverCenter.y,
    ).divideScalar(sourceScale);
    const sourceDisplacement = sourceCenterNormal.clone()
      .multiplyScalar(modelDisplacement.x)
      .addScaledVector(sourceCenterDirection, modelDisplacement.y);
    return new THREE.Vector2(
      sourceDriverCenter.x + sourceDisplacement.x,
      sourceDriverCenter.y - sourceDisplacement.y,
    );
  };

  root.userData.archetype =
    'face-pin-indexed-five-tooth-split-rim-friction-winding-stop';
  root.userData.mechanism =
    'one-face-pin-indexes-a-five-tooth-split-ring-once-per-winding-revolution-and-the-uncut-rim-stops-both-directions';
  root.userData.variant =
    'rear-plane-twenty-two-tooth-ratchet-with-front-plane-self-holding-stop-ring';
  root.userData.blocks = {
    activeContactMarker,
    baseRail,
    bearingArms,
    bearings,
    driver,
    driverBody,
    driverIndex,
    driverIndexTip,
    driverShaft,
    facePin,
    facePinCap,
    feet,
    frictionBand,
    frictionDrum,
    stopContactMarker,
    stopShoulderHighlights,
    stopToothHighlights,
    stopWheel,
    stopWheelBody,
    stopWheelIndex,
    stopWheelIndexTip,
    stopWheelOutline,
    stopWheelStud,
    upright,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.geometry = {
    activeIndexInputAngle,
    axialClearance,
    centerDistance,
    driverCenter,
    driverDepth,
    driverPlaneZ,
    driverRatchetOutline,
    driverRatchetRootRadius,
    driverRatchetTipRadius,
    driverRatchetToothCount,
    driverToothAngles,
    entryContactPhase,
    exitContactPhase,
    facePinMountPhase,
    facePinOrbitRadius,
    facePinRadius,
    finalBlockedForwardClosingRate,
    finalFacePinCenter,
    finalStopContactPoint,
    finalStopNormal,
    finalStopWheelAngle,
    finalUncutRimMarginAngle,
    forwardInputLimit,
    freeApproachInputAngle,
    initialBlockedReverseClosingRate,
    initialFacePinCenter,
    initialStopContactPoint,
    initialStopNormal,
    initialStopWheelAngle,
    initialUncutRimMarginAngle,
    installedStopToothCount,
    sourceActiveProgress,
    sourceFacePinPhase,
    sourceIndexProgress,
    sourceInputTravel,
    sourceScale,
    splitHalfAngle,
    stopEquivalentToothCount,
    stopGapCount,
    stopInnerProfile,
    stopInnerRadius,
    stopOuterProfile,
    stopOuterRadius,
    stopPitchAngle,
    stopRingOutline,
    stopSectorCenterAngle,
    stopSectorEndAngle,
    stopSectorStartAngle,
    stopShoulderAngles,
    stopToothArcs,
    stopToothCenters,
    stopToothRootRadius,
    stopToothTopFraction,
    stopWheelCenter,
    stopWheelDepth,
    stopWheelIndexAngle,
    stopWheelPlaneZ,
  };
  root.userData.inputStateAtTime = inputStateAtTime;
  root.userData.modelPointToSourceRaster = modelPointToSourceRaster;
  root.userData.pinCenterAtInputTravel = pinCenterAtInputTravel;
  root.userData.sourceAnchors = {
    driverCenter: sourceDriverCenter.clone(),
    facePinCenter: sourceFacePinCenter.clone(),
    modeledDriverCenter: modelPointToSourceRaster(driverCenter),
    modeledFacePinAtSource: modelPointToSourceRaster(
      pinCenterAtInputTravel(sourceInputTravel),
    ),
    modeledStopWheelCenter: modelPointToSourceRaster(stopWheelCenter),
    stopWheelCenter: sourceStopWheelCenter.clone(),
  };
  root.userData.sourceAnimation = {
    available: false,
    engravingHasStaticSourcePoseOnly: true,
    runtimeUsesContinuousReverseReturn: true,
  };
  root.userData.sourcePointToModel = sourcePointToModel;
  root.userData.sourceRaster = {
    fittedDriverCenter: sourceDriverCenter.clone(),
    fittedFacePinCenter: sourceFacePinCenter.clone(),
    fittedFacePinRadius: sourceFacePinRadius,
    fittedStopInnerRadius: sourceStopInnerRadius,
    fittedStopOuterRadius: sourceStopOuterRadius,
    fittedStopWheelCenter: sourceStopWheelCenter.clone(),
    height: sourceRasterImageSize.y,
    observedDriverRatchetToothCount: driverRatchetToothCount,
    observedStopGapCount: stopGapCount,
    observedStopToothCount: installedStopToothCount,
    sourcePose: 'third-face-pin-index-in-progress',
    sourceUrl: 'https://507movements.com/mm_213.html',
    width: sourceRasterImageSize.x,
  };
  root.userData.stateAtInputTravel = stateAtInputTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.stopWheelAngleAtInputTravel =
    stopWheelAngleAtInputTravel;
  root.userData.timeline = {
    demonstrationPeriod,
    finalHoldDuration,
    forwardMotionDuration,
    forwardMotionEnd,
    forwardMotionStart,
    indexMidInputTravels,
    initialHoldDuration,
    reverseMotionDuration,
    reverseMotionStart,
  };
  root.userData.transmission = {
    directRatchetToStopWheelMesh: false,
    direction: 'opposite-only-while-the-single-face-pin-indexes',
    driverRatchetToothCount,
    frictionHeldBetweenIndexes: true,
    inputTurnsBetweenStops: forwardInputLimit / fullTurn,
    installedStopToothCount,
    outputTravelAngle: installedStopToothCount * stopPitchAngle,
    pinIndexesPerInputTurn: 1,
    stopEquivalentToothCount,
    stopGapCount,
    stopPitchAngle,
  };
  root.userData.cameraDistanceScale = 1.08;

  const markerZ = stopWheelPlaneZ + stopWheelDepth / 2 + 0.105;
  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(driver, state.driverAngle);
    setSpin(driverShaft, state.driverAngle);
    setSpin(stopWheel, state.stopWheelAngle);
    activeContactMarker.visible = state.engagement.active;
    if (state.engagement.active) {
      activeContactMarker.position.set(
        state.engagement.contactPoint.x,
        state.engagement.contactPoint.y,
        markerZ,
      );
    }
    const stopContact = state.limit.stopContact;
    stopContactMarker.visible = stopContact !== null;
    if (stopContact) {
      stopContactMarker.position.set(
        stopContact.contactPoint.x,
        stopContact.contactPoint.y,
        markerZ,
      );
    }
    driver.userData.angularSpeed = state.driverAngularSpeed;
    driverShaft.userData.angularSpeed = state.driverAngularSpeed;
    stopWheel.userData.angularSpeed = state.stopWheelAngularSpeed;
    root.userData.contacts = {
      directRatchetToStopWheelMesh: null,
      facePinTooth: state.engagement.active
        ? state.engagement
        : null,
      initialUncutRimStop: state.atInitialStop
        ? state.limit.stopContact
        : null,
      selfHoldingSplitRingFriction: state.frictionRetention.active
        ? state.frictionRetention
        : null,
      finalUncutRimStop: state.atFinalStop
        ? state.limit.stopContact
        : null,
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finishSplitRim213(root, update);
}

function opposedGearFingerWindingStop() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const sourceScale = 0.48;
  const driverTeeth = 10;
  const drivenTeeth = 12;
  const gearRatio = driverTeeth / drivenTeeth;

  // The source animation supplies an unusually complete construction for
  // Movement 214. Its right (red) input has ten teeth on pitch radius 5; the
  // left (blue) wheel has twelve teeth on pitch radius 6. Their centers are
  // 11 units apart, so the pitch circles are tangent and the driven member
  // must counter-rotate at 10 / 12 = 5 / 6 of input speed. The triangular
  // face pieces are rigid stop fingers, not decorative direction arrows.
  const sourceDriverCenter = new THREE.Vector2(11, 0);
  const sourceDrivenCenter = new THREE.Vector2(0, 0);
  const sourceDriverPitchRadius = 5;
  const sourceDrivenPitchRadius = 6;
  const sourceDriverRootRadius = 3.75;
  const sourceDrivenRootRadius = 4.75;
  const sourceDriverOuterRadius = 6;
  const sourceDrivenOuterRadius = 7;
  const sourceDriverToothCenterPhase = THREE.MathUtils.degToRad(18);
  const sourceDrivenToothCenterPhase = 0;
  const sourceDriverFinger = [
    new THREE.Vector2(-1.28409, -0.775315),
    new THREE.Vector2(-5.345768, 5.951703),
    new THREE.Vector2(0.908215, 1.193794),
  ];
  const sourceDrivenFinger = [
    new THREE.Vector2(0.717892, -1.317054),
    new THREE.Vector2(-6.181818, -5.077905),
    new THREE.Vector2(-1.152551, 0.960014),
  ];
  const sourceDriverBore = [
    new THREE.Vector2(0.269489, -1.271182),
    new THREE.Vector2(1.271182, 0.269489),
    new THREE.Vector2(-0.269489, 1.271182),
    new THREE.Vector2(-1.271182, -0.269489),
  ];
  const sourceDrivenBore = [
    new THREE.Vector2(-0.708304, -1.089419),
    new THREE.Vector2(1.089419, -0.708304),
    new THREE.Vector2(0.708304, 1.089419),
    new THREE.Vector2(-1.089419, 0.708304),
  ];
  const centerDistance = 11 * sourceScale;
  const driverCenter = new THREE.Vector2(centerDistance / 2, 0);
  const drivenCenter = new THREE.Vector2(-centerDistance / 2, 0);
  const driverPitchRadius = sourceDriverPitchRadius * sourceScale;
  const drivenPitchRadius = sourceDrivenPitchRadius * sourceScale;
  const driverRootRadius = sourceDriverRootRadius * sourceScale;
  const drivenRootRadius = sourceDrivenRootRadius * sourceScale;
  const driverOuterRadius = sourceDriverOuterRadius * sourceScale;
  const drivenOuterRadius = sourceDrivenOuterRadius * sourceScale;
  // Brown's plate draws teardrop fingers, not the site's long triangles: a
  // round boss about the square arbor tapering to a point, the input's
  // pointing up and right (34.5 degrees) and the counterwheel's nearly
  // upright (plate 79 degrees). Each outline is the convex hull of the boss
  // circle and the point, so both flanks are the straight tangents. Index 1
  // is the point; indices 0 and 2 are the tangent points. Lengths and the
  // counterwheel angle (75 degrees, 4 degrees off the plate) are tuned so
  // one of the six encounters in the 6-turn relative period blocks solidly
  // (about 1.1 rad of input overlap) while the other five pass at least
  // 0.6 clear.
  const plateFingerBossRadius = 0.78;
  const plateTeardrop = (length, angle, arcSamples = 64) => {
    const half = Math.acos(plateFingerBossRadius / length);
    const onBoss = (theta) => new THREE.Vector2(
      plateFingerBossRadius * Math.cos(theta),
      plateFingerBossRadius * Math.sin(theta),
    );
    const points = [
      onBoss(angle - half),
      new THREE.Vector2(length * Math.cos(angle), length * Math.sin(angle)),
      onBoss(angle + half),
    ];
    for (let index = 1; index < arcSamples; index += 1) {
      points.push(onBoss(
        angle + half + (fullTurn - 2 * half) * index / arcSamples,
      ));
    }
    return points;
  };
  const driverFingerLocal = plateTeardrop(3.2, THREE.MathUtils.degToRad(34.5));
  const drivenFingerLocal = plateTeardrop(3.65, THREE.MathUtils.degToRad(75));
  const driverBoreLocal = sourceDriverBore.map((point) => (
    point.clone().multiplyScalar(sourceScale)
  ));
  const drivenBoreLocal = sourceDrivenBore.map((point) => (
    point.clone().multiplyScalar(sourceScale)
  ));

  const rotatePoint = (point, angle) => new THREE.Vector2(
    point.x * Math.cos(angle) - point.y * Math.sin(angle),
    point.x * Math.sin(angle) + point.y * Math.cos(angle),
  );
  const transformProfile = (profile, center, angle) => profile.map(
    (point) => rotatePoint(point, angle).add(center),
  );
  const projectPointToLine = (point, lineStart, lineEnd) => {
    const edge = lineEnd.clone().sub(lineStart);
    const along = point.clone().sub(lineStart).dot(edge) / edge.lengthSq();
    return {
      along,
      point: lineStart.clone().addScaledVector(edge, along),
    };
  };
  const signedPointLineDistance = (point, lineStart, lineEnd) => {
    const edge = lineEnd.clone().sub(lineStart);
    return edge.cross(point.clone().sub(lineStart)) / edge.length();
  };
  const fingerGeometryAtInputTravel = (inputTravel) => {
    const driverAngle = inputTravel;
    const drivenAngle = -gearRatio * inputTravel;
    return {
      drivenAngle,
      drivenFinger: transformProfile(
        drivenFingerLocal,
        drivenCenter,
        drivenAngle,
      ),
      driverAngle,
      driverFinger: transformProfile(
        driverFingerLocal,
        driverCenter,
        driverAngle,
      ),
    };
  };
  // Forward, the input's point meets the counterwheel finger's flank from
  // tangent point 0 to the point; in reverse, the counterwheel's point meets
  // the input finger's flank [0, 1]. Both are straight tangent flanks.
  const stopPairs = {
    forward: { tipMember: 'driver', flankMember: 'driven' },
    reverse: { tipMember: 'driven', flankMember: 'driver' },
  };
  const stopParts = (inputTravel, side) => {
    const geometry = fingerGeometryAtInputTravel(inputTravel);
    const { tipMember, flankMember } = stopPairs[side];
    return {
      firstPoint: geometry[`${flankMember}Finger`][0],
      secondPoint: geometry[`${flankMember}Finger`][1],
      tip: geometry[`${tipMember}Finger`][1],
    };
  };
  const rawFlankDistance = (inputTravel, side) => {
    const { firstPoint, secondPoint, tip } = stopParts(inputTravel, side);
    return signedPointLineDistance(tip, firstPoint, secondPoint);
  };
  const solveSignedDistanceRoot = (lowerBound, upperBound, side) => {
    let lower = lowerBound;
    let upper = upperBound;
    let lowerValue = rawFlankDistance(lower, side);
    const upperValue = rawFlankDistance(upper, side);
    if (Math.sign(lowerValue) === Math.sign(upperValue)) {
      throw new Error('Movement 214 stop-contact root is not bracketed');
    }
    for (let iteration = 0; iteration < 80; iteration += 1) {
      const middle = (lower + upper) / 2;
      const middleValue = rawFlankDistance(middle, side);
      if (Math.sign(middleValue) === Math.sign(lowerValue)) {
        lower = middle;
        lowerValue = middleValue;
      } else {
        upper = middle;
      }
    }
    return (lower + upper) / 2;
  };

  // The initial pose is the plate's (both fingers up). The site animation
  // instead starts elsewhere, its triangles meeting after exactly three
  // turns. With the plate's teardrops the first encounter forward is 1.34
  // input turns away and the opposite stop 4.48 turns back: the same
  // blocking encounter approached from its two sides, 1.10 rad short of the
  // six-turn relative period.
  const forwardInputLimit = solveSignedDistanceRoot(8.3, 8.5, 'forward');
  const reverseInputLimit = solveSignedDistanceRoot(-28.25, -28.1, 'reverse');
  const totalInputTravel = forwardInputLimit - reverseInputLimit;
  const sourcePoseInputTravel = 0;

  const contactAtLimit = (inputTravel, side) => {
    const { firstPoint, secondPoint, tip } = stopParts(inputTravel, side);
    const projection = projectPointToLine(
      tip,
      firstPoint,
      secondPoint,
    );
    const tangent = secondPoint.clone().sub(firstPoint).normalize();
    const leftNormal = new THREE.Vector2(-tangent.y, tangent.x);
    const interiorInputTravel = side === 'forward'
      ? inputTravel - 1e-6
      : inputTravel + 1e-6;
    const interiorSign = Math.sign(rawFlankDistance(
      interiorInputTravel,
      side,
    ));
    const normal = leftNormal.multiplyScalar(interiorSign || 1);
    return {
      alongFlank: projection.along,
      contactPoint: tip.clone().add(projection.point).multiplyScalar(0.5),
      flank: [firstPoint, secondPoint],
      flankMember: stopPairs[side].flankMember,
      normal,
      projectedPoint: projection.point,
      side,
      tangent,
      tip,
      tipMember: stopPairs[side].tipMember,
    };
  };
  const forwardStopContact = contactAtLimit(forwardInputLimit, 'forward');
  const reverseStopContact = contactAtLimit(reverseInputLimit, 'reverse');
  const closingDerivativeStep = 1e-7;
  const forwardBlockedClosingRate = Math.abs(
    rawFlankDistance(forwardInputLimit - closingDerivativeStep, 'forward')
      - rawFlankDistance(forwardInputLimit, 'forward'),
  ) / closingDerivativeStep;
  const reverseBlockedClosingRate = Math.abs(
    rawFlankDistance(reverseInputLimit + closingDerivativeStep, 'reverse')
      - rawFlankDistance(reverseInputLimit, 'reverse'),
  ) / closingDerivativeStep;

  const shapeFromPoints = (points) => {
    const shape = new THREE.Shape();
    points.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    });
    shape.closePath();
    return shape;
  };
  const addPolygonHole = (shape, points) => {
    const hole = new THREE.Path();
    [...points].reverse().forEach((point, index) => {
      if (index === 0) hole.moveTo(point.x, point.y);
      else hole.lineTo(point.x, point.y);
    });
    hole.closePath();
    shape.holes.push(hole);
  };
  const makeGearOutline = ({
    outerRadius,
    rootRadius,
    teeth,
    toothCenterPhase,
  }) => {
    const points = [];
    const pitch = fullTurn / teeth;
    for (let index = 0; index < teeth; index += 1) {
      const center = toothCenterPhase + index * pitch;
      for (const [fraction, radius] of [
        [-0.375, rootRadius],
        [-0.125, outerRadius],
        [0.125, outerRadius],
        [0.375, rootRadius],
      ]) {
        const angle = center + fraction * pitch;
        points.push(new THREE.Vector2(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
        ));
      }
    }
    return points;
  };
  const gearDepth = 0.4;
  const fingerDepth = 0.19;
  // Both fingers occupy one raised face plane. Their common underside clears
  // either gear face as they sweep across the mesh, while the clamping hubs
  // bridge the small axial gap back to their keyed wheel centers.
  const fingerPlaneZ = gearDepth / 2 + fingerDepth / 2 + 0.075;
  const driverGearOutline = makeGearOutline({
    outerRadius: driverOuterRadius,
    rootRadius: driverRootRadius,
    teeth: driverTeeth,
    toothCenterPhase: sourceDriverToothCenterPhase,
  });
  const drivenGearOutline = makeGearOutline({
    outerRadius: drivenOuterRadius,
    rootRadius: drivenRootRadius,
    teeth: drivenTeeth,
    toothCenterPhase: sourceDrivenToothCenterPhase,
  });
  const makeFingerGear = ({
    bore,
    center,
    color,
    finger,
    gearOutline,
    role,
    teeth,
  }) => {
    const member = makePlanarRotor();
    member.position.set(center.x, center.y, 0);
    member.userData.role = role;
    member.userData.teeth = teeth;
    const rotor = member.userData.rotor;
    const gearShape = shapeFromPoints(gearOutline);
    addPolygonHole(gearShape, bore);
    const gearBody = new THREE.Mesh(
      centeredExtrusion(gearShape, gearDepth),
      matte(color, {
        metalness: 0.12,
        roughness: 0.61,
        side: THREE.DoubleSide,
      }),
    );
    gearBody.userData.role = `${role}-spur-gear-body`;
    gearBody.userData.teeth = teeth;
    gearBody.userData.integralStopFinger = false;
    const fingerBody = new THREE.Mesh(
      centeredExtrusion(shapeFromPoints(finger), fingerDepth),
      matte(color, {
        metalness: 0.13,
        roughness: 0.56,
        side: THREE.DoubleSide,
      }),
    );
    fingerBody.position.z = fingerPlaneZ;
    fingerBody.userData.role = `${role}-integral-rigid-stop-finger`;
    fingerBody.userData.integralStopFinger = true;
    const hubRadius = 0.73;
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(hubRadius, hubRadius, 0.24, 48),
      matte(color, { metalness: 0.15, roughness: 0.53 }),
    );
    hub.rotation.x = Math.PI / 2;
    hub.position.z = fingerPlaneZ + 0.02;
    hub.userData.role = `${role}-finger-clamping-hub`;
    const boreRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.055, 10, 48),
      matte(PALETTE.ink, { metalness: 0.24, roughness: 0.46 }),
    );
    boreRing.position.z = fingerPlaneZ + fingerDepth / 2 + 0.035;
    boreRing.userData.role = `${role}-square-arbor-surround`;
    const tip = finger[1];
    const tipDirection = tip.clone().normalize();
    const indexStart = tipDirection.clone().multiplyScalar(0.93);
    const indexEnd = tipDirection.clone().multiplyScalar(1.62);
    const motionIndex = makeBeam(
      new THREE.Vector3(indexStart.x, indexStart.y, fingerPlaneZ + 0.13),
      new THREE.Vector3(indexEnd.x, indexEnd.y, fingerPlaneZ + 0.13),
      {
        color: PALETTE.white,
        depth: 0.035,
        thickness: 0.055,
      },
    );
    motionIndex.userData.role = `${role}-angular-rate-index`;
    const tipReference = new THREE.Object3D();
    tipReference.position.set(tip.x, tip.y, fingerPlaneZ);
    tipReference.userData.role = `${role}-stop-finger-tip-reference`;
    rotor.add(
      gearBody,
      fingerBody,
      hub,
      boreRing,
      motionIndex,
      tipReference,
    );
    return {
      boreRing,
      fingerBody,
      gearBody,
      hub,
      member,
      motionIndex,
      tipReference,
    };
  };

  const driverAssembly = makeFingerGear({
    bore: driverBoreLocal,
    center: driverCenter,
    color: PALETTE.driver,
    finger: driverFingerLocal,
    gearOutline: driverGearOutline,
    role: 'right-ten-tooth-winding-input',
    teeth: driverTeeth,
  });
  const drivenAssembly = makeFingerGear({
    bore: drivenBoreLocal,
    center: drivenCenter,
    color: PALETTE.driven,
    finger: drivenFingerLocal,
    gearOutline: drivenGearOutline,
    role: 'left-twelve-tooth-stop-counterwheel',
    teeth: drivenTeeth,
  });
  const driver = driverAssembly.member;
  const driven = drivenAssembly.member;

  const driverShaft = makeShaft({
    axis: Z_AXIS,
    length: 1.72,
    radius: 0.12,
  });
  driverShaft.position.set(driverCenter.x, driverCenter.y, -0.04);
  driverShaft.userData.role = 'right-winding-input-shaft';
  const drivenShaft = makeShaft({
    axis: Z_AXIS,
    length: 1.58,
    radius: 0.12,
  });
  drivenShaft.position.set(drivenCenter.x, drivenCenter.y, -0.06);
  drivenShaft.userData.role = 'left-geared-stop-shaft';
  const squareArbors = [
    [driver, driverBoreLocal, 'right-input-square-arbor'],
    [driven, drivenBoreLocal, 'left-counterwheel-square-arbor'],
  ].map(([member, bore, role]) => {
    const xs = bore.map((point) => point.x);
    const ys = bore.map((point) => point.y);
    const side = Math.min(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys),
    ) * 0.62;
    const arbor = new THREE.Mesh(
      new THREE.BoxGeometry(side, side, 0.72),
      matte(PALETTE.ink, { metalness: 0.28, roughness: 0.43 }),
    );
    arbor.position.z = 0.34;
    arbor.userData.role = role;
    member.userData.rotor.add(arbor);
    return arbor;
  });

  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.2,
    roughness: 0.5,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.43,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.22,
    roughness: 0.45,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.65,
  });
  const gearMeshMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.065, 18, 12),
    brassMaterial,
  );
  const gearContactPoint = new THREE.Vector2(
    driverCenter.x - driverPitchRadius,
    driverCenter.y,
  );
  gearMeshMarker.position.set(
    gearContactPoint.x,
    gearContactPoint.y,
    gearDepth / 2 + 0.055,
  );
  gearMeshMarker.userData.role = 'constant-ten-to-twelve-tooth-mesh-contact';
  const forwardContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 20, 14),
    whiteMaterial,
  );
  forwardContactMarker.position.set(
    forwardStopContact.contactPoint.x,
    forwardStopContact.contactPoint.y,
    fingerPlaneZ + fingerDepth / 2 + 0.08,
  );
  forwardContactMarker.visible = false;
  forwardContactMarker.userData.role =
    'forward-input-point-to-counterwheel-finger-flank-contact';
  const reverseContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 20, 14),
    whiteMaterial,
  );
  reverseContactMarker.position.set(
    reverseStopContact.contactPoint.x,
    reverseStopContact.contactPoint.y,
    fingerPlaneZ + fingerDepth / 2 + 0.08,
  );
  reverseContactMarker.visible = false;
  reverseContactMarker.userData.role =
    'reverse-counterwheel-point-to-input-finger-flank-contact';

  const rearZ = -0.82;
  const baseY = -4.25;
  const baseRail = makeBeam(
    new THREE.Vector3(-4.35, baseY, rearZ),
    new THREE.Vector3(4.35, baseY, rearZ),
    { color: PALETTE.frame, depth: 0.18, thickness: 0.16 },
  );
  baseRail.userData.role = 'gear-finger-stop-base-rail';
  const uprights = [drivenCenter.x, driverCenter.x].map((x, index) => {
    const upright = makeBeam(
      new THREE.Vector3(x, baseY, rearZ),
      new THREE.Vector3(x, 0, rearZ),
      { color: PALETTE.frame, depth: 0.18, thickness: 0.15 },
    );
    upright.userData.role = index === 0
      ? 'left-stop-counterwheel-bearing-upright'
      : 'right-winding-input-bearing-upright';
    return upright;
  });
  const bearings = [drivenCenter, driverCenter].map((center, index) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.06, 10, 40),
      frameMaterial,
    );
    bearing.position.set(center.x, center.y, rearZ + 0.06);
    bearing.userData.fixed = true;
    bearing.userData.role = index === 0
      ? 'fixed-left-counterwheel-bearing'
      : 'fixed-right-input-bearing';
    return bearing;
  });
  const feet = [-3.7, 3.7].map((x, index) => {
    const foot = makeBeam(
      new THREE.Vector3(x, baseY, rearZ - 0.48),
      new THREE.Vector3(x, baseY, 0.48),
      { color: PALETTE.frame, depth: 0.18, thickness: 0.15 },
    );
    foot.userData.role = index === 0
      ? 'gear-finger-stop-left-foot'
      : 'gear-finger-stop-right-foot';
    return foot;
  });
  root.add(
    driver,
    driven,
    driverShaft,
    drivenShaft,
    gearMeshMarker,
    forwardContactMarker,
    reverseContactMarker,
    baseRail,
    ...uprights,
    ...bearings,
    ...feet,
  );

  const stateAtInputTravel = (
    requestedInputTravel,
    driverAngularSpeed = 0,
    driverAngularAcceleration = 0,
  ) => {
    let inputTravel = THREE.MathUtils.clamp(
      requestedInputTravel,
      reverseInputLimit,
      forwardInputLimit,
    );
    for (const exactAngle of [
      reverseInputLimit,
      sourcePoseInputTravel,
      ...Array.from({ length: 6 }, (_, index) => (
        (index + 1) * Math.PI
      )),
      forwardInputLimit,
    ]) {
      if (Math.abs(inputTravel - exactAngle) <= 1e-10) {
        inputTravel = exactAngle;
        break;
      }
    }
    const tryingPastForwardStop = inputTravel
      >= forwardInputLimit - 1e-11
      && driverAngularSpeed >= -1e-12;
    const tryingPastReverseStop = inputTravel
      <= reverseInputLimit + 1e-11
      && driverAngularSpeed <= 1e-12;
    const blocked = tryingPastForwardStop || tryingPastReverseStop;
    const resolvedDriverAngularSpeed = blocked ? 0 : driverAngularSpeed;
    const resolvedDriverAngularAcceleration = blocked
      ? 0
      : driverAngularAcceleration;
    const drivenAngle = -gearRatio * inputTravel;
    const drivenAngularSpeed = -gearRatio * resolvedDriverAngularSpeed;
    const drivenAngularAcceleration = -gearRatio
      * resolvedDriverAngularAcceleration;
    const fingerGeometry = fingerGeometryAtInputTravel(inputTravel);
    const driverPitchVelocity = new THREE.Vector2(
      0,
      -resolvedDriverAngularSpeed * driverPitchRadius,
    );
    const drivenPitchVelocity = new THREE.Vector2(
      0,
      drivenAngularSpeed * drivenPitchRadius,
    );
    const stopContact = tryingPastForwardStop
      ? {
        ...forwardStopContact,
        blockedDirection: 'forward',
        closingRatePerInputRadian: forwardBlockedClosingRate,
      }
      : tryingPastReverseStop
        ? {
          ...reverseStopContact,
          blockedDirection: 'reverse',
          closingRatePerInputRadian: reverseBlockedClosingRate,
        }
        : null;
    let stage = 'free-geared-travel';
    if (tryingPastForwardStop) stage = 'forward-finger-flank-hard-stop';
    else if (tryingPastReverseStop) {
      stage = 'reverse-opposite-finger-flank-hard-stop';
    } else if (inputTravel > sourcePoseInputTravel) {
      stage = 'winding-toward-forward-finger-stop';
    } else if (inputTravel < sourcePoseInputTravel) {
      stage = 'running-down-toward-opposite-flank-stop';
    } else stage = 'plate-source-open-pose';
    return {
      atForwardStop: tryingPastForwardStop,
      atReverseStop: tryingPastReverseStop,
      contactMode: stage,
      drivenAngle,
      drivenAngularAcceleration,
      drivenAngularSpeed,
      drivenFinger: fingerGeometry.drivenFinger,
      drivenPitchLineSpeed: drivenAngularSpeed * drivenPitchRadius,
      driverAngle: inputTravel,
      driverAngularAcceleration: resolvedDriverAngularAcceleration,
      driverAngularSpeed: resolvedDriverAngularSpeed,
      driverFinger: fingerGeometry.driverFinger,
      driverPitchLineSpeed: resolvedDriverAngularSpeed * driverPitchRadius,
      gearMesh: {
        active: true,
        contactPoint: gearContactPoint.clone(),
        drivenPitchVelocity,
        driverPitchVelocity,
        meshPhaseInvariant: driverTeeth * inputTravel
          + drivenTeeth * drivenAngle,
        ratio: -gearRatio,
      },
      inputTravel,
      limit: {
        blocked,
        forwardInputLimit,
        overtravelPrevented: Math.max(
          requestedInputTravel - forwardInputLimit,
          0,
        ),
        remainingForwardTravel: forwardInputLimit - inputTravel,
        remainingReverseTravel: inputTravel - reverseInputLimit,
        reverseInputLimit,
        stopContact,
        undertravelPrevented: Math.max(
          reverseInputLimit - requestedInputTravel,
          0,
        ),
      },
      stage,
    };
  };

  const smootherStep = (fraction) => {
    const clamped = THREE.MathUtils.clamp(fraction, 0, 1);
    return clamped * clamped * clamped
      * (clamped * (clamped * 6 - 15) + 10);
  };
  const smootherStepDerivative = (fraction) => {
    const clamped = THREE.MathUtils.clamp(fraction, 0, 1);
    return 30 * clamped * clamped
      * (clamped * (clamped - 2) + 1);
  };
  const smootherStepSecondDerivative = (fraction) => {
    const clamped = THREE.MathUtils.clamp(fraction, 0, 1);
    return 60 * clamped * (2 * clamped * clamped - 3 * clamped + 1);
  };
  const evaluateMotion = (elapsed, duration, startAngle, endAngle) => {
    const fraction = THREE.MathUtils.clamp(elapsed / duration, 0, 1);
    const travel = endAngle - startAngle;
    return {
      angle: startAngle + travel * smootherStep(fraction),
      angularAcceleration: travel
        * smootherStepSecondDerivative(fraction) / (duration * duration),
      angularSpeed: travel * smootherStepDerivative(fraction) / duration,
      fraction,
    };
  };
  const sourceHoldDuration = 1;
  // Keep the site track's winding rate: seven seconds per three input turns.
  const forwardMotionDuration = 7 * forwardInputLimit / (3 * fullTurn);
  const forwardStopHoldDuration = 1.25;
  const nominalSecondsPerInputRadian = forwardMotionDuration
    / forwardInputLimit;
  const fullReverseMotionDuration = totalInputTravel
    * nominalSecondsPerInputRadian;
  const reverseStopHoldDuration = 1.25;
  const sourceReturnDuration = -reverseInputLimit
    * nominalSecondsPerInputRadian;
  const forwardMotionStart = sourceHoldDuration;
  const forwardMotionEnd = forwardMotionStart + forwardMotionDuration;
  const forwardStopHoldEnd = forwardMotionEnd + forwardStopHoldDuration;
  const fullReverseMotionEnd = forwardStopHoldEnd
    + fullReverseMotionDuration;
  const reverseStopHoldEnd = fullReverseMotionEnd
    + reverseStopHoldDuration;
  const demonstrationPeriod = reverseStopHoldEnd + sourceReturnDuration;
  const inputStateAtTime = (time) => {
    const phaseTime = THREE.MathUtils.euclideanModulo(
      time,
      demonstrationPeriod,
    );
    if (phaseTime <= forwardMotionStart) {
      return {
        angle: sourcePoseInputTravel,
        angularAcceleration: 0,
        angularSpeed: 0,
        direction: 'held-at-official-source-open-pose',
        phaseTime,
        timelineSegment: 'source-pose-hold',
      };
    }
    if (phaseTime <= forwardMotionEnd) {
      return {
        ...evaluateMotion(
          phaseTime - forwardMotionStart,
          forwardMotionDuration,
          sourcePoseInputTravel,
          forwardInputLimit,
        ),
        direction: 'winding-forward-to-source-terminal-stop',
        phaseTime,
        timelineSegment: 'forward-traverse-to-finger-stop',
      };
    }
    if (phaseTime <= forwardStopHoldEnd) {
      return {
        angle: forwardInputLimit,
        angularAcceleration: 0,
        angularSpeed: 0,
        direction: 'held-at-forward-finger-stop',
        phaseTime,
        timelineSegment: 'forward-stop-hold',
      };
    }
    if (phaseTime <= fullReverseMotionEnd) {
      return {
        ...evaluateMotion(
          phaseTime - forwardStopHoldEnd,
          fullReverseMotionDuration,
          forwardInputLimit,
          reverseInputLimit,
        ),
        direction: 'running-down-to-opposite-flank-stop',
        phaseTime,
        timelineSegment: 'full-reverse-traverse',
      };
    }
    if (phaseTime <= reverseStopHoldEnd) {
      return {
        angle: reverseInputLimit,
        angularAcceleration: 0,
        angularSpeed: 0,
        direction: 'held-at-reverse-finger-stop',
        phaseTime,
        timelineSegment: 'reverse-stop-hold',
      };
    }
    return {
      ...evaluateMotion(
        phaseTime - reverseStopHoldEnd,
        sourceReturnDuration,
        reverseInputLimit,
        sourcePoseInputTravel,
      ),
      direction: 'returning-to-official-source-open-pose',
      phaseTime,
      timelineSegment: 'source-pose-return',
    };
  };
  const stateAtTime = (time) => {
    const input = inputStateAtTime(time);
    return {
      ...stateAtInputTravel(
        input.angle,
        input.angularSpeed,
        input.angularAcceleration,
      ),
      demonstrationDirection: input.direction,
      phaseTime: input.phaseTime,
      time,
      timelineSegment: input.timelineSegment,
    };
  };
  const inverseSmootherStep = (value) => {
    let lower = 0;
    let upper = 1;
    for (let iteration = 0; iteration < 64; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (smootherStep(middle) < value) lower = middle;
      else upper = middle;
    }
    return (lower + upper) / 2;
  };
  const forwardTimeAtInputTravel = (inputTravel) => (
    forwardMotionStart + forwardMotionDuration * inverseSmootherStep(
      inputTravel / forwardInputLimit,
    )
  );
  const canonicalTimes = {
    cycleClosure: demonstrationPeriod,
    firstHalfTurn: forwardTimeAtInputTravel(Math.PI),
    forwardStop: forwardMotionEnd,
    forwardStopMidHold: forwardMotionEnd + forwardStopHoldDuration / 2,
    reverseStop: fullReverseMotionEnd,
    reverseStopMidHold: fullReverseMotionEnd
      + reverseStopHoldDuration / 2,
    sourcePose: 0,
    sourcePoseOnReverse: forwardStopHoldEnd
      + fullReverseMotionDuration
        * inverseSmootherStep(forwardInputLimit / totalInputTravel),
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const sourceAnimationKeyframes = Array.from({ length: 7 }, (_, index) => ({
    cpos: index / 8,
    drivenAngle: -index * THREE.MathUtils.degToRad(150),
    driverAngle: index * Math.PI,
  }));
  sourceAnimationKeyframes.push({
    cpos: 1,
    drivenAngle: -5 * Math.PI,
    driverAngle: 6 * Math.PI,
  });
  const sourceAnimationPointToModel = (point, z = 0) => new THREE.Vector3(
    (point.x - 5.5) * sourceScale,
    point.y * sourceScale,
    z,
  );
  const modelPointToSourceAnimation = (point) => new THREE.Vector2(
    point.x / sourceScale + 5.5,
    point.y / sourceScale,
  );
  const sourceAnimationPointToRaster = (point) => new THREE.Vector2(
    (point.x + 9.5) * 17.5,
    525 - (point.y + 15) * 17.5,
  );

  root.userData.archetype =
    'ten-tooth-twelve-tooth-opposed-finger-winding-stop';
  root.userData.mechanism =
    'ten-tooth-input-counter-rotates-a-twelve-tooth-wheel-at-five-sixths-speed-until-one-finger-point-meets-the-other-finger-flank';
  root.userData.variant =
    'coplanar-spur-pair-with-raised-integral-face-fingers-and-two-hard-limits';
  root.userData.blocks = {
    baseRail,
    bearings,
    driven,
    drivenAssembly,
    drivenShaft,
    driver,
    driverAssembly,
    driverShaft,
    feet,
    forwardContactMarker,
    gearMeshMarker,
    reverseContactMarker,
    squareArbors,
    uprights,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.fingerGeometryAtInputTravel = fingerGeometryAtInputTravel;
  root.userData.geometry = {
    centerDistance,
    drivenBoreLocal,
    drivenCenter,
    drivenFingerLocal,
    drivenGearOutline,
    drivenOuterRadius,
    drivenPitchRadius,
    drivenRootRadius,
    driverBoreLocal,
    driverCenter,
    driverFingerLocal,
    driverGearOutline,
    driverOuterRadius,
    driverPitchRadius,
    driverRootRadius,
    fingerDepth,
    fingerPlaneZ,
    forwardBlockedClosingRate,
    forwardInputLimit,
    forwardStopContact,
    gearContactPoint,
    gearDepth,
    reverseBlockedClosingRate,
    reverseInputLimit,
    reverseStopContact,
    sourceDrivenBore,
    sourceDrivenCenter,
    sourceDrivenFinger,
    sourceDrivenOuterRadius,
    sourceDrivenPitchRadius,
    sourceDrivenRootRadius,
    sourceDrivenToothCenterPhase,
    sourceDriverBore,
    sourceDriverCenter,
    sourceDriverFinger,
    sourceDriverOuterRadius,
    sourceDriverPitchRadius,
    sourceDriverRootRadius,
    sourceDriverToothCenterPhase,
    sourcePoseInputTravel,
    sourceScale,
    totalInputTravel,
  };
  root.userData.inputStateAtTime = inputStateAtTime;
  root.userData.modelPointToSourceAnimation = modelPointToSourceAnimation;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: 15,
    driverHalfTurnsBeforeStop: 6,
    driverTurnsBeforeStop: 3,
    durationSeconds: 8,
    keyframes: sourceAnimationKeyframes,
    normalizedTerminalPosition: 0.75,
    officialLoopResetsDiscontinuously: true,
    officialTrackStartsAtOpenPose: true,
    officialTrackStopsAtForwardContact: true,
    runtimeAddsContinuousReverseDemonstration: true,
    terminalHoldSeconds: 2,
  };
  root.userData.sourceAnimationPointToModel = sourceAnimationPointToModel;
  root.userData.sourceAnimationPointToRaster = sourceAnimationPointToRaster;
  root.userData.sourceRaster = {
    fittedDrivenCenter: sourceAnimationPointToRaster(sourceDrivenCenter),
    fittedDrivenOuterRadius: sourceDrivenOuterRadius * 17.5,
    fittedDriverCenter: sourceAnimationPointToRaster(sourceDriverCenter),
    fittedDriverOuterRadius: sourceDriverOuterRadius * 17.5,
    height: 525,
    sourcePose: 'official-animation-open-pose-before-six-half-turns',
    sourceUrl: 'https://507movements.com/mm_214.html',
    width: 525,
  };
  root.userData.stateAtInputTravel = stateAtInputTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod,
    forwardMotionDuration,
    forwardMotionEnd,
    forwardMotionStart,
    forwardStopHoldDuration,
    forwardStopHoldEnd,
    fullReverseMotionDuration,
    fullReverseMotionEnd,
    reverseStopHoldDuration,
    reverseStopHoldEnd,
    sourceHoldDuration,
    sourceReturnDuration,
  };
  root.userData.transmission = {
    direction: 'opposite-through-the-entire-free-travel',
    drivenTeeth,
    driverTeeth,
    forwardInputTurnsFromSourcePose: forwardInputLimit / fullTurn,
    gearRatio: -gearRatio,
    inputTurnsBetweenStops: totalInputTravel / fullTurn,
    reverseInputTurnsFromSourcePose: -reverseInputLimit / fullTurn,
    speedRelationship: 'omega_driven=-(10/12)*omega_driver',
  };
  root.userData.cameraDistanceScale = 1.08;

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(driver, state.driverAngle);
    setSpin(driverShaft, state.driverAngle);
    setSpin(driven, state.drivenAngle);
    setSpin(drivenShaft, state.drivenAngle);
    forwardContactMarker.visible = state.atForwardStop;
    reverseContactMarker.visible = state.atReverseStop;
    driver.userData.angularSpeed = state.driverAngularSpeed;
    driverShaft.userData.angularSpeed = state.driverAngularSpeed;
    driven.userData.angularSpeed = state.drivenAngularSpeed;
    drivenShaft.userData.angularSpeed = state.drivenAngularSpeed;
    root.userData.contacts = {
      constantSpurMesh: state.gearMesh,
      forwardFingerFlankStop: state.atForwardStop
        ? state.limit.stopContact
        : null,
      reverseFingerFlankStop: state.atReverseStop
        ? state.limit.stopContact
        : null,
    };
    root.userData.kinematics = state;
  };
  update(0);
  return correctGearFingerStop(finish(root, update, new THREE.Vector3(6.9, 5.2, 11.8)));
}

function crescentPinSixSlotWindingStop() {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const stopStepAngle = fullTurn / 6;
  const sourceScale = 0.58;

  // Exact construction values exposed by the official Movement 215
  // animation. The left member combines a rear carrier disk, one raised
  // crescent locking cam, and a single projecting face pin. The right member
  // is a six-slot intermittent wheel: five sectors have the usual concave
  // locking surface, while the sixth is left convex to stop the travel.
  const sourceDriverCenter = new THREE.Vector2(0, 0);
  const sourceStopWheelCenter = new THREE.Vector2(8, 0);
  const sourceCenterDistance = 8;
  const sourceDriverOuterRadius = 5.3;
  const sourceDriverInnerRadius = 4;
  const sourcePinLocal = new THREE.Vector2(4, 2.309401);
  const sourcePinRadius = 0.3;
  const sourcePinOrbitRadius = sourcePinLocal.length();
  const sourcePinPhase = sourcePinLocal.angle();
  const sourceSlotInnerEndRadius = 3.331198;
  const sourceSlotOuterRadius = 4.618802;
  const sourceSlotHalfWidth = 0.3;
  const sourceSpecialSectorRadius = 4.833622;
  const sourceSpecialSectorStartAngle = 4.820506;
  const sourceSpecialSectorEndAngle = 5.651469;
  const sourceCrescentEccentricArc = {
    center: new THREE.Vector2(6.928203, 4),
    endAngle: 4.086633,
    radius: 5,
    startAngle: 3.243749,
  };
  const sourceCrescentInnerArc = {
    center: new THREE.Vector2(0, 0),
    endAngle: 6.270034,
    radius: 4,
    startAngle: 1.060349,
  };
  const sourceDriverBore = [
    new THREE.Vector2(-0.921427, -0.416184),
    new THREE.Vector2(0.416184, -0.921427),
    new THREE.Vector2(0.921427, 0.416184),
    new THREE.Vector2(-0.416184, 0.921427),
  ];
  const sourceDriverTerminalVector = new THREE.Vector2(
    3.873761,
    -2.515414,
  );
  const sourceDriverUpperCusp = new THREE.Vector2(
    Math.cos(sourceCrescentInnerArc.startAngle)
      * sourceCrescentInnerArc.radius,
    Math.sin(sourceCrescentInnerArc.startAngle)
      * sourceCrescentInnerArc.radius,
  );
  const sourceDriverLowerCusp = new THREE.Vector2(
    Math.cos(sourceCrescentInnerArc.endAngle)
      * sourceCrescentInnerArc.radius,
    Math.sin(sourceCrescentInnerArc.endAngle)
      * sourceCrescentInnerArc.radius,
  );

  // Segment types retain the source animation's construction convention:
  // 0 is a line, 2 is a clockwise arc, and 4 is a counter-clockwise arc.
  // The ordering below stitches the separately drawn construction segments
  // into one manufacturable stop-wheel outline.
  const sourceStopWheelSegments = [
    [4, 2.884902, 1.665599, 0.3, 2.094395, 5.235988],
    [0, 4.15, 2.049593, 3.034902, 1.405791],
    [0, 3.85, 2.569209, 2.734902, 1.925407],
    [2, 4.239403, 1.87027, 0.2, 2.094395, 5.821673],
    [4, 3.739403, 2.736296, 0.2, 5.235988, 1.50871],
    [4, 0, 3.331198, 0.3, 3.141593, 0],
    [0, 0.3, 4.618802, 0.3, 3.331198],
    [0, -0.3, 4.618802, -0.3, 3.331198],
    [2, 0.5, 4.606566, 0.2, 3.141593, 0.585686],
    [4, -0.5, 4.606566, 0.2, 6.283185, 2.555907],
    [4, -2.884902, 1.665599, 0.3, 4.18879, 1.047198],
    [0, -3.85, 2.569209, -2.734902, 1.925407],
    [0, -4.15, 2.049593, -3.034902, 1.405791],
    [2, -3.739403, 2.736296, 0.2, 4.18879, 1.632883],
    [4, -4.239403, 1.87027, 0.2, 1.047198, 3.603105],
    [4, -2.884902, -1.665599, 0.3, 5.235988, 2.094395],
    [0, -4.15, -2.049593, -3.034902, -1.405791],
    [0, -3.85, -2.569209, -2.734902, -1.925407],
    [2, -4.239403, -1.87027, 0.2, 5.235988, 2.680081],
    [4, -3.739403, -2.736296, 0.2, 2.094395, 4.650302],
    [4, 0, -3.331198, 0.3, 0, 3.141593],
    [0, -0.3, -4.618802, -0.3, -3.331198],
    [0, 0.3, -4.618802, 0.3, -3.331198],
    [2, -0.5, -4.606566, 0.2, 0, 3.727278],
    [4, 2.884902, -1.665599, 0.3, 1.047198, 4.18879],
    [0, 3.85, -2.569209, 2.734902, -1.925407],
    [0, 4.15, -2.049593, 3.034902, -1.405791],
    [4, 4.239403, -1.87027, 0.2, 4.18879, 0.461512],
    [4, 4, 6.928203, 4, 3.727278, 4.650302],
    [4, -4, 6.928203, 4, 4.774476, 5.6975],
    [4, -8, 0, 4, 5.821673, 0.461512],
    [4, -4, -6.928203, 4, 0.585686, 1.50871],
    [4, 8, 0, 4, 2.680081, 3.603105],
    [4, 0, 0, 4.833622, 4.820506, 5.651469],
    [4, 3.739403, -2.736296, 0.2, 5.651469, 0.986092],
    [4, 0.5, -4.606566, 0.200374, 3.202698, 4.820506],
  ];
  const sourceStopWheelSegmentOrder = [
    [33, false], [34, false], [25, false], [24, true],
    [26, true], [27, false], [32, true], [3, true],
    [1, false], [0, true], [2, true], [4, false],
    [28, true], [8, true], [6, false], [5, true],
    [7, true], [9, false], [29, true], [13, true],
    [11, false], [10, true], [12, true], [14, false],
    [30, true], [18, true], [16, false], [15, true],
    [17, true], [19, false], [31, true], [23, true],
    [21, false], [20, true], [22, true], [35, false],
  ];

  const normalizePositiveAngle = (angle) => THREE.MathUtils.euclideanModulo(
    angle,
    fullTurn,
  );
  const normalizeSignedAngle = (angle) => Math.atan2(
    Math.sin(angle),
    Math.cos(angle),
  );
  const polarPoint = (radius, angle) => new THREE.Vector2(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
  );
  const rotatePoint = (point, angle) => new THREE.Vector2(
    point.x * Math.cos(angle) - point.y * Math.sin(angle),
    point.x * Math.sin(angle) + point.y * Math.cos(angle),
  );
  const sampleSourceSegment = (segment, reverse = false) => {
    let points;
    if (segment[0] === 0) {
      points = [];
      for (let index = 1; index < segment.length; index += 2) {
        points.push(new THREE.Vector2(segment[index], segment[index + 1]));
      }
    } else {
      const [, centerX, centerY, radius, startAngle, endAngle] = segment;
      let sweep = endAngle - startAngle;
      if (segment[0] === 2 || segment[0] === 3) {
        while (sweep > 0) sweep -= fullTurn;
      } else {
        while (sweep < 0) sweep += fullTurn;
      }
      const segmentCount = Math.max(6, Math.ceil(Math.abs(sweep) * 128));
      points = Array.from({ length: segmentCount + 1 }, (_, index) => {
        const angle = startAngle + sweep * index / segmentCount;
        return new THREE.Vector2(
          centerX + Math.cos(angle) * radius,
          centerY + Math.sin(angle) * radius,
        );
      });
    }
    return reverse ? points.reverse() : points;
  };
  const polygonSignedArea = (points) => points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0) / 2;
  const sourceStopWheelOutline = [];
  for (const [segmentIndex, reverse] of sourceStopWheelSegmentOrder) {
    const points = sampleSourceSegment(
      sourceStopWheelSegments[segmentIndex],
      reverse,
    );
    if (sourceStopWheelOutline.length > 0) points.shift();
    sourceStopWheelOutline.push(...points);
  }
  if (polygonSignedArea(sourceStopWheelOutline) < 0) {
    sourceStopWheelOutline.reverse();
  }
  const sourceSpecialSectorArc = sampleSourceSegment(
    sourceStopWheelSegments[33],
  );
  const sampleArc = ({ center, endAngle, radius, startAngle }, count = 120) => {
    let sweep = endAngle - startAngle;
    while (sweep < 0) sweep += fullTurn;
    return Array.from({ length: count + 1 }, (_, index) => {
      const angle = startAngle + sweep * index / count;
      return new THREE.Vector2(
        center.x + Math.cos(angle) * radius,
        center.y + Math.sin(angle) * radius,
      );
    });
  };
  const sourceCrescentInnerProfile = sampleArc(
    sourceCrescentInnerArc,
    1024,
  );
  const sourceCrescentEccentricProfile = sampleArc(
    sourceCrescentEccentricArc,
    256,
  );
  // These two source arcs meet at both ends and describe the raised
  // crescent locking cam seen inside the larger carrier circle. They are
  // not a hole through the carrier: the carrier runs behind the Geneva
  // wheel, while this cam alone shares the wheel's locking plane.
  const sourceLockingCamOutline = [
    ...sourceCrescentInnerProfile,
    ...[...sourceCrescentEccentricProfile].reverse().slice(1),
  ];
  if (polygonSignedArea(sourceLockingCamOutline) > 0) {
    sourceLockingCamOutline.reverse();
  }

  const centerDistance = sourceCenterDistance * sourceScale;
  const driverCenter = new THREE.Vector2(-centerDistance / 2, 0);
  const stopWheelCenter = new THREE.Vector2(centerDistance / 2, 0);
  const driverOuterRadius = sourceDriverOuterRadius * sourceScale;
  const driverInnerRadius = sourceDriverInnerRadius * sourceScale;
  const pinLocal = sourcePinLocal.clone().multiplyScalar(sourceScale);
  const pinRadius = sourcePinRadius * sourceScale;
  const pinOrbitRadius = sourcePinOrbitRadius * sourceScale;
  const slotInnerEndRadius = sourceSlotInnerEndRadius * sourceScale;
  const slotOuterRadius = sourceSlotOuterRadius * sourceScale;
  const slotHalfWidth = sourceSlotHalfWidth * sourceScale;
  const specialSectorRadius = sourceSpecialSectorRadius * sourceScale;
  const driverUpperCuspLocal = sourceDriverUpperCusp.clone()
    .multiplyScalar(sourceScale);
  const driverLowerCuspLocal = sourceDriverLowerCusp.clone()
    .multiplyScalar(sourceScale);
  const driverBoreLocal = sourceDriverBore.map((point) => (
    point.clone().multiplyScalar(sourceScale)
  ));
  const stopWheelOutline = sourceStopWheelOutline.map((point) => (
    point.clone().multiplyScalar(sourceScale)
  ));
  const specialSectorArc = sourceSpecialSectorArc.map((point) => (
    point.clone().multiplyScalar(sourceScale)
  ));
  const lockingCamOutline = sourceLockingCamOutline.map((point) => (
    point.clone().multiplyScalar(sourceScale)
  ));

  const driverAngleAtInputTravel = (inputTravel) => -inputTravel;
  const pinCenterAtInputTravel = (inputTravel) => rotatePoint(
    pinLocal,
    driverAngleAtInputTravel(inputTravel),
  ).add(driverCenter);
  const pinBearingFromStopWheel = (inputTravel) => pinCenterAtInputTravel(
    inputTravel,
  ).sub(stopWheelCenter).angle();
  const forwardEntryPinBearing = 5 * Math.PI / 6;
  const reverseEntryPinBearing = -5 * Math.PI / 6;
  const snapStopWheelAngle = (angle) => {
    const nearestStep = Math.round(angle / stopStepAngle) * stopStepAngle;
    return Math.abs(angle - nearestStep) <= 2e-8 ? nearestStep : angle;
  };
  const stopWheelAngleAtInputTravel = (inputTravel) => {
    if (inputTravel >= 0) {
      const completedTurns = Math.floor(inputTravel / fullTurn);
      const turnPhase = inputTravel - completedTurns * fullTurn;
      if (turnPhase <= stopStepAngle + 1e-12) {
        const increment = normalizePositiveAngle(
          pinBearingFromStopWheel(inputTravel) - forwardEntryPinBearing,
        );
        return snapStopWheelAngle(
          completedTurns * stopStepAngle + increment,
        );
      }
      return (completedTurns + 1) * stopStepAngle;
    }
    const reverseTravel = -inputTravel;
    const completedTurns = Math.floor(reverseTravel / fullTurn);
    const turnPhase = reverseTravel - completedTurns * fullTurn;
    if (turnPhase >= fullTurn - stopStepAngle - 1e-12) {
      const increment = normalizeSignedAngle(
        pinBearingFromStopWheel(inputTravel) - reverseEntryPinBearing,
      );
      return snapStopWheelAngle(
        -completedTurns * stopStepAngle + increment,
      );
    }
    return -completedTurns * stopStepAngle;
  };
  const engagementAtInputTravel = (inputTravel) => {
    let active;
    let completedTurns;
    let turnPhase;
    if (inputTravel >= 0) {
      completedTurns = Math.floor(inputTravel / fullTurn);
      turnPhase = inputTravel - completedTurns * fullTurn;
      active = turnPhase <= stopStepAngle + 1e-12;
    } else {
      const reverseTravel = -inputTravel;
      completedTurns = Math.floor(reverseTravel / fullTurn);
      turnPhase = reverseTravel - completedTurns * fullTurn;
      active = turnPhase >= fullTurn - stopStepAngle - 1e-12;
    }
    const driverAngle = driverAngleAtInputTravel(inputTravel);
    const pinAngle = sourcePinPhase + driverAngle;
    const pinDistanceSq = sourceCenterDistance * sourceCenterDistance
      + sourcePinOrbitRadius * sourcePinOrbitRadius
      - 2 * sourceCenterDistance * sourcePinOrbitRadius * Math.cos(pinAngle);
    const numerator = sourceCenterDistance * sourcePinOrbitRadius
      * Math.cos(pinAngle)
      - sourcePinOrbitRadius * sourcePinOrbitRadius;
    const instantaneousRatio = active ? numerator / pinDistanceSq : 0;
    const ratioDerivative = active
      ? sourceCenterDistance * sourcePinOrbitRadius
        * (
          sourceCenterDistance * sourceCenterDistance
            - sourcePinOrbitRadius * sourcePinOrbitRadius
        )
        * Math.sin(pinAngle) / (pinDistanceSq * pinDistanceSq)
      : 0;
    const outputAngle = stopWheelAngleAtInputTravel(inputTravel);
    const pinCenter = pinCenterAtInputTravel(inputTravel);
    const pinInStopWheelLocal = rotatePoint(
      pinCenter.clone().sub(stopWheelCenter),
      -outputAngle,
    );
    const localPinAngle = normalizePositiveAngle(pinInStopWheelLocal.angle());
    const slotIndex = active
      ? THREE.MathUtils.euclideanModulo(
        Math.round((localPinAngle - Math.PI / 6) / stopStepAngle),
        6,
      )
      : null;
    const slotCenterAngle = slotIndex === null
      ? null
      : Math.PI / 6 + slotIndex * stopStepAngle;
    return {
      active,
      completedTurns,
      instantaneousRatio,
      localPinAngle,
      pinCenter,
      pinInStopWheelLocal,
      pinRadius,
      ratioDerivative,
      slotCenterAngle,
      slotIndex,
      slotRadialPosition: pinInStopWheelLocal.length(),
      turnPhase,
    };
  };

  const sourceForwardTerminalTimedAngle = THREE.MathUtils.degToRad(33);
  const sourceForwardTerminalExtraAngle = -Math.atan2(
    sourceDriverTerminalVector.y,
    sourceDriverTerminalVector.x,
  );
  const forwardInputLimit = 3 * fullTurn + sourceForwardTerminalExtraAngle;
  const rawCuspSectorGap = (inputTravel, cuspLocal) => {
    const cusp = rotatePoint(
      cuspLocal,
      driverAngleAtInputTravel(inputTravel),
    ).add(driverCenter);
    return cusp.distanceTo(stopWheelCenter) - specialSectorRadius;
  };
  const solveGapRoot = (lowerBound, upperBound, cuspLocal) => {
    let lower = lowerBound;
    let upper = upperBound;
    let lowerValue = rawCuspSectorGap(lower, cuspLocal);
    const upperValue = rawCuspSectorGap(upper, cuspLocal);
    if (Math.sign(lowerValue) === Math.sign(upperValue)) {
      throw new Error('Movement 215 stop-contact root is not bracketed');
    }
    for (let iteration = 0; iteration < 80; iteration += 1) {
      const middle = (lower + upper) / 2;
      const middleValue = rawCuspSectorGap(middle, cuspLocal);
      if (Math.sign(middleValue) === Math.sign(lowerValue)) {
        lower = middle;
        lowerValue = middleValue;
      } else {
        upper = middle;
      }
    }
    return (lower + upper) / 2;
  };
  // Running backward first completes one 60-degree index. On the following
  // reverse index, the uncut convex sector reaches the other crescent cusp.
  // rawCuspSectorGap has later roots too, but they lie beyond solid-profile
  // interference; bracket the first physically reachable encounter.
  const reverseInputLimit = solveGapRoot(
    -(fullTurn + 5.75 * stopStepAngle),
    -(fullTurn + 5.25 * stopStepAngle),
    driverLowerCuspLocal,
  );
  const totalInputTravel = forwardInputLimit - reverseInputLimit;
  const contactAtLimit = (inputTravel, cuspLocal, side) => {
    const driverAngle = driverAngleAtInputTravel(inputTravel);
    const stopWheelAngle = stopWheelAngleAtInputTravel(inputTravel);
    const cuspPoint = rotatePoint(cuspLocal, driverAngle).add(driverCenter);
    const normal = cuspPoint.clone().sub(stopWheelCenter).normalize();
    const sectorPoint = stopWheelCenter.clone().addScaledVector(
      normal,
      specialSectorRadius,
    );
    const sectorLocalAngle = normalizePositiveAngle(
      normal.angle() - stopWheelAngle,
    );
    return {
      contactPoint: cuspPoint.clone().add(sectorPoint).multiplyScalar(0.5),
      cuspPoint,
      driverCusp: side === 'forward' ? 'upper' : 'lower',
      normal,
      sectorLocalAngle,
      sectorPoint,
      side,
      specialSectorEndAngle: sourceSpecialSectorEndAngle,
      specialSectorStartAngle: sourceSpecialSectorStartAngle,
    };
  };
  const forwardStopContact = contactAtLimit(
    forwardInputLimit,
    driverUpperCuspLocal,
    'forward',
  );
  const reverseStopContact = contactAtLimit(
    reverseInputLimit,
    driverLowerCuspLocal,
    'reverse',
  );
  const derivativeStep = 1e-7;
  const forwardBlockedClosingRate = Math.abs(
    rawCuspSectorGap(
      forwardInputLimit + derivativeStep,
      driverUpperCuspLocal,
    )
      - rawCuspSectorGap(
        forwardInputLimit - derivativeStep,
        driverUpperCuspLocal,
      ),
  ) / (2 * derivativeStep);
  const reverseBlockedClosingRate = Math.abs(
    rawCuspSectorGap(
      reverseInputLimit + derivativeStep,
      driverLowerCuspLocal,
    )
      - rawCuspSectorGap(
        reverseInputLimit - derivativeStep,
        driverLowerCuspLocal,
      ),
  ) / (2 * derivativeStep);

  const shapeFromPoints = (points) => {
    const shape = new THREE.Shape();
    points.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, point.y);
      else shape.lineTo(point.x, point.y);
    });
    shape.closePath();
    return shape;
  };
  const addPolygonHole = (shape, points) => {
    const resolvedPoints = polygonSignedArea(points) < 0
      ? points
      : [...points].reverse();
    const hole = new THREE.Path();
    resolvedPoints.forEach((point, index) => {
      if (index === 0) hole.moveTo(point.x, point.y);
      else hole.lineTo(point.x, point.y);
    });
    hole.closePath();
    shape.holes.push(hole);
  };
  const makeProfileTube = ({ material, points, radius, role, z }) => {
    const path = new THREE.CurvePath();
    for (let index = 0; index < points.length - 1; index += 1) {
      path.add(new THREE.LineCurve3(
        new THREE.Vector3(points[index].x, points[index].y, z),
        new THREE.Vector3(points[index + 1].x, points[index + 1].y, z),
      ));
    }
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(
        path,
        Math.max(48, points.length * 2),
        radius,
        7,
        false,
      ),
      material,
    );
    tube.userData.role = role;
    return tube;
  };

  const driverCarrierDepth = 0.24;
  const lockingCamDepth = 0.34;
  const stopWheelDepth = 0.34;
  const commonLockingPlaneZ = 0;
  const axialLayerGap = 0.06;
  const driverCarrierBevelThickness = Math.min(
    0.025,
    driverCarrierDepth * 0.12,
  );
  const stopWheelBevelThickness = Math.min(
    0.025,
    stopWheelDepth * 0.12,
  );
  const driverCarrierZ = -(
    stopWheelDepth / 2
      + stopWheelBevelThickness
      + axialLayerGap
      + driverCarrierDepth / 2
      + driverCarrierBevelThickness
  );
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.59,
    side: THREE.DoubleSide,
  });
  const stopMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.59,
    side: THREE.DoubleSide,
  });
  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.47,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.22,
    roughness: 0.45,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.43,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.14,
    roughness: 0.65,
  });

  const driver = makePlanarRotor();
  driver.position.set(driverCenter.x, driverCenter.y, commonLockingPlaneZ);
  driver.userData.role =
    'left-rear-carrier-raised-crescent-locking-winding-driver';
  const driverOuterProfile = Array.from({ length: 192 }, (_, index) => (
    polarPoint(driverOuterRadius, fullTurn * index / 192)
  ));
  const driverShape = shapeFromPoints(driverOuterProfile);
  addPolygonHole(driverShape, driverBoreLocal);
  const driverBody = new THREE.Mesh(
    centeredExtrusion(driverShape, driverCarrierDepth),
    driverMaterial,
  );
  driverBody.position.z = driverCarrierZ;
  driverBody.userData.role =
    'rear-full-driver-carrier-disk-with-square-bore';
  driverBody.userData.singleFacePinDriver = true;
  const lockingCamShape = shapeFromPoints(
    polygonSignedArea(lockingCamOutline) < 0
      ? [...lockingCamOutline].reverse()
      : lockingCamOutline,
  );
  addPolygonHole(lockingCamShape, driverBoreLocal);
  const lockingCamBody = new THREE.Mesh(
    centeredExtrusion(lockingCamShape, lockingCamDepth),
    driverMaterial,
  );
  lockingCamBody.userData.role =
    'front-raised-crescent-locking-cam-with-square-bore';
  lockingCamBody.userData.normalLockingCam = true;
  const pinLength = 0.94;
  const facePin = new THREE.Mesh(
    new THREE.CylinderGeometry(pinRadius, pinRadius, pinLength, 28),
    brassMaterial,
  );
  facePin.rotation.x = Math.PI / 2;
  facePin.position.set(pinLocal.x, pinLocal.y, 0.19);
  facePin.userData.role = 'single-crescent-driver-face-pin';
  facePin.userData.onlyIndexingDriver = true;
  const facePinCap = new THREE.Mesh(
    new THREE.CylinderGeometry(pinRadius * 0.62, pinRadius * 0.62, 0.045, 24),
    whiteMaterial,
  );
  facePinCap.rotation.x = Math.PI / 2;
  facePinCap.position.set(pinLocal.x, pinLocal.y, 0.665);
  facePinCap.userData.role = 'visible-face-pin-contact-cap';
  const driverIndexDirection = pinLocal.clone().normalize();
  const driverIndex = makeBeam(
    new THREE.Vector3(
      driverIndexDirection.x * 0.72,
      driverIndexDirection.y * 0.72,
      lockingCamDepth / 2 + 0.065,
    ),
    new THREE.Vector3(
      driverIndexDirection.x * 1.5,
      driverIndexDirection.y * 1.5,
      lockingCamDepth / 2 + 0.065,
    ),
    { color: PALETTE.white, depth: 0.035, thickness: 0.055 },
  );
  driverIndex.userData.role = 'crescent-driver-angular-rate-index';
  driver.userData.rotor.add(
    driverBody,
    lockingCamBody,
    facePin,
    facePinCap,
    driverIndex,
  );

  const stopWheel = makePlanarRotor();
  stopWheel.position.set(
    stopWheelCenter.x,
    stopWheelCenter.y,
    commonLockingPlaneZ,
  );
  stopWheel.userData.role = 'right-six-slot-convex-sector-stop-wheel';
  const stopWheelShape = shapeFromPoints(stopWheelOutline);
  const stopWheelBoreRadius = 0.5 * sourceScale;
  const stopWheelBore = new THREE.Path();
  stopWheelBore.absarc(0, 0, stopWheelBoreRadius, 0, fullTurn, true);
  stopWheelShape.holes.push(stopWheelBore);
  const stopWheelBody = new THREE.Mesh(
    centeredExtrusion(stopWheelShape, stopWheelDepth),
    stopMaterial,
  );
  stopWheelBody.userData.role =
    'six-radial-slots-five-concave-locks-one-convex-terminal-sector';
  stopWheelBody.userData.radialSlotCount = 6;
  stopWheelBody.userData.normalLockingSectorCount = 5;
  stopWheelBody.userData.convexTerminalSectorCount = 1;
  const specialSectorHighlight = makeProfileTube({
    material: brassMaterial,
    points: specialSectorArc,
    radius: 0.028,
    role: 'uncut-convex-terminal-sector-highlight',
    z: stopWheelDepth / 2 + 0.052,
  });
  const stopWheelIndex = makeBeam(
    new THREE.Vector3(0.72, 0, stopWheelDepth / 2 + 0.065),
    new THREE.Vector3(1.54, 0, stopWheelDepth / 2 + 0.065),
    { color: PALETTE.white, depth: 0.035, thickness: 0.055 },
  );
  stopWheelIndex.userData.role = 'six-slot-wheel-angular-rate-index';
  stopWheel.userData.rotor.add(
    stopWheelBody,
    specialSectorHighlight,
    stopWheelIndex,
  );

  const driverShaft = makeShaft({
    axis: Z_AXIS,
    length: 1.68,
    radius: 0.115,
  });
  driverShaft.position.set(driverCenter.x, driverCenter.y, -0.06);
  driverShaft.userData.role = 'crescent-winding-input-shaft';
  const stopWheelShaft = makeShaft({
    axis: Z_AXIS,
    length: 1.56,
    radius: 0.115,
  });
  stopWheelShaft.position.set(stopWheelCenter.x, stopWheelCenter.y, -0.07);
  stopWheelShaft.userData.role = 'six-slot-stop-wheel-shaft';
  // The arbor fills Brown's square bore: the bore's corners lie at 24.3
  // degrees plus quarter turns, so the box (corners at 45 degrees to its
  // faces) turns 45 degrees less, with a 0.01 side clearance.
  const squareArborSide = sourceDriverBore[0].distanceTo(sourceDriverBore[1])
    * sourceScale - 0.02;
  const squareArbor = new THREE.Mesh(
    new THREE.BoxGeometry(squareArborSide, squareArborSide, 1.05),
    inkMaterial,
  );
  squareArbor.position.z = 0.15;
  squareArbor.rotation.z = Math.atan2(
    sourceDriverBore[2].y,
    sourceDriverBore[2].x,
  ) - Math.PI / 4;
  squareArbor.userData.role = 'square-winding-arbor';
  driver.userData.rotor.add(squareArbor);
  const stopHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.43, 0.47, 40),
    inkMaterial,
  );
  stopHub.rotation.x = Math.PI / 2;
  stopHub.position.z = 0.12;
  stopHub.userData.role = 'six-slot-wheel-keyed-hub';
  stopWheel.userData.rotor.add(stopHub);

  const forwardContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.082, 20, 14),
    whiteMaterial,
  );
  forwardContactMarker.position.set(
    forwardStopContact.contactPoint.x,
    forwardStopContact.contactPoint.y,
    stopWheelDepth / 2 + 0.12,
  );
  forwardContactMarker.visible = false;
  forwardContactMarker.userData.role =
    'forward-convex-sector-to-upper-crescent-cusp-contact';
  const reverseContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.082, 20, 14),
    whiteMaterial,
  );
  reverseContactMarker.position.set(
    reverseStopContact.contactPoint.x,
    reverseStopContact.contactPoint.y,
    stopWheelDepth / 2 + 0.12,
  );
  reverseContactMarker.visible = false;
  reverseContactMarker.userData.role =
    'reverse-convex-sector-to-lower-crescent-cusp-contact';

  const rearZ = -0.8;
  const baseY = -3.72;
  const baseRail = makeBeam(
    new THREE.Vector3(-4.55, baseY, rearZ),
    new THREE.Vector3(4.55, baseY, rearZ),
    { color: PALETTE.frame, depth: 0.18, thickness: 0.16 },
  );
  baseRail.userData.role = 'crescent-stop-base-rail';
  const uprights = [driverCenter.x, stopWheelCenter.x].map((x, index) => {
    const upright = makeBeam(
      new THREE.Vector3(x, baseY, rearZ),
      new THREE.Vector3(x, 0, rearZ),
      { color: PALETTE.frame, depth: 0.18, thickness: 0.15 },
    );
    upright.userData.role = index === 0
      ? 'crescent-driver-bearing-upright'
      : 'six-slot-wheel-bearing-upright';
    return upright;
  });
  const bearings = [driverCenter, stopWheelCenter].map((center, index) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(0.235, 0.058, 10, 40),
      frameMaterial,
    );
    bearing.position.set(center.x, center.y, rearZ + 0.06);
    bearing.userData.fixed = true;
    bearing.userData.role = index === 0
      ? 'fixed-crescent-driver-bearing'
      : 'fixed-six-slot-wheel-bearing';
    return bearing;
  });
  const feet = [-3.9, 3.9].map((x, index) => {
    const foot = makeBeam(
      new THREE.Vector3(x, baseY, rearZ - 0.48),
      new THREE.Vector3(x, baseY, 0.48),
      { color: PALETTE.frame, depth: 0.18, thickness: 0.15 },
    );
    foot.userData.role = index === 0
      ? 'crescent-stop-left-foot'
      : 'crescent-stop-right-foot';
    return foot;
  });
  root.add(
    driver,
    stopWheel,
    driverShaft,
    stopWheelShaft,
    forwardContactMarker,
    reverseContactMarker,
    baseRail,
    ...uprights,
    ...bearings,
    ...feet,
  );

  const exactInputAngles = [
    reverseInputLimit,
    -(fullTurn + 5 * stopStepAngle),
    -fullTurn,
    -5 * stopStepAngle,
    0,
    stopStepAngle,
    fullTurn,
    fullTurn + stopStepAngle,
    2 * fullTurn,
    2 * fullTurn + stopStepAngle,
    3 * fullTurn,
    forwardInputLimit,
  ];
  const stateAtInputTravel = (
    requestedInputTravel,
    inputAngularSpeed = 0,
    inputAngularAcceleration = 0,
  ) => {
    let inputTravel = THREE.MathUtils.clamp(
      requestedInputTravel,
      reverseInputLimit,
      forwardInputLimit,
    );
    const exactInput = exactInputAngles.find((angle) => (
      Math.abs(inputTravel - angle) <= 1e-10
    ));
    if (exactInput !== undefined) inputTravel = exactInput;
    const tryingPastForwardStop = inputTravel
      >= forwardInputLimit - 1e-11
      && inputAngularSpeed >= -1e-12;
    const tryingPastReverseStop = inputTravel
      <= reverseInputLimit + 1e-11
      && inputAngularSpeed <= 1e-12;
    const blocked = tryingPastForwardStop || tryingPastReverseStop;
    const resolvedInputAngularSpeed = blocked ? 0 : inputAngularSpeed;
    const resolvedInputAngularAcceleration = blocked
      ? 0
      : inputAngularAcceleration;
    const driverAngle = driverAngleAtInputTravel(inputTravel);
    const engagement = engagementAtInputTravel(inputTravel);
    const stopWheelAngle = stopWheelAngleAtInputTravel(inputTravel);
    const stopWheelAngularSpeed = engagement.instantaneousRatio
      * resolvedInputAngularSpeed;
    const stopWheelAngularAcceleration = engagement.instantaneousRatio
      * resolvedInputAngularAcceleration
      + engagement.ratioDerivative
        * resolvedInputAngularSpeed * resolvedInputAngularSpeed;
    const targetPocketAngle = normalizePositiveAngle(
      Math.PI - stopWheelAngle,
    );
    const targetPocketIndex = Math.round(targetPocketAngle / stopStepAngle) % 6;
    const normalPocket = targetPocketIndex !== 5;
    const lockActive = !engagement.active && normalPocket;
    const lockingPocketCenterLocal = polarPoint(
      centerDistance,
      targetPocketIndex * stopStepAngle,
    );
    const lockingPocketCenterWorld = rotatePoint(
      lockingPocketCenterLocal,
      stopWheelAngle,
    ).add(stopWheelCenter);
    const stopContact = tryingPastForwardStop
      ? {
        ...forwardStopContact,
        blockedDirection: 'forward',
        closingRatePerInputRadian: forwardBlockedClosingRate,
      }
      : tryingPastReverseStop
        ? {
          ...reverseStopContact,
          blockedDirection: 'reverse',
          closingRatePerInputRadian: reverseBlockedClosingRate,
        }
        : null;
    let stage;
    if (tryingPastForwardStop) {
      stage = 'convex-sector-upper-crescent-cusp-forward-stop';
    } else if (tryingPastReverseStop) {
      stage = 'convex-sector-lower-crescent-cusp-reverse-stop';
    } else if (engagement.active) {
      stage = inputTravel >= 0
        ? `face-pin-forward-index-slot-${engagement.slotIndex + 1}`
        : `face-pin-reverse-index-slot-${engagement.slotIndex + 1}`;
    } else if (!normalPocket) {
      stage = 'convex-terminal-sector-approaching-crescent-cusp';
    } else {
      stage = `crescent-lock-dwell-pocket-${targetPocketIndex + 1}`;
    }
    return {
      atForwardStop: tryingPastForwardStop,
      atReverseStop: tryingPastReverseStop,
      contactMode: stage,
      driverAngle,
      driverAngularAcceleration: -resolvedInputAngularAcceleration,
      driverAngularSpeed: -resolvedInputAngularSpeed,
      engagement,
      inputAngularAcceleration: resolvedInputAngularAcceleration,
      inputAngularSpeed: resolvedInputAngularSpeed,
      inputTravel,
      limit: {
        blocked,
        forwardInputLimit,
        overtravelPrevented: Math.max(
          requestedInputTravel - forwardInputLimit,
          0,
        ),
        remainingForwardTravel: forwardInputLimit - inputTravel,
        remainingReverseTravel: inputTravel - reverseInputLimit,
        reverseInputLimit,
        stopContact,
        undertravelPrevented: Math.max(
          reverseInputLimit - requestedInputTravel,
          0,
        ),
      },
      lock: {
        active: lockActive,
        concaveRadius: driverInnerRadius,
        normalPocket,
        pocketCenterLocal: lockingPocketCenterLocal,
        pocketCenterWorld: lockingPocketCenterWorld,
        pocketIndex: targetPocketIndex,
      },
      stage,
      stopWheelAngle,
      stopWheelAngularAcceleration,
      stopWheelAngularSpeed,
    };
  };

  const smootherStep = (fraction) => {
    const clamped = THREE.MathUtils.clamp(fraction, 0, 1);
    return clamped * clamped * clamped
      * (clamped * (clamped * 6 - 15) + 10);
  };
  const smootherStepDerivative = (fraction) => {
    const clamped = THREE.MathUtils.clamp(fraction, 0, 1);
    return 30 * clamped * clamped
      * (clamped * (clamped - 2) + 1);
  };
  const smootherStepSecondDerivative = (fraction) => {
    const clamped = THREE.MathUtils.clamp(fraction, 0, 1);
    return 60 * clamped * (2 * clamped * clamped - 3 * clamped + 1);
  };
  const evaluateMotion = (elapsed, duration, startAngle, endAngle) => {
    const fraction = THREE.MathUtils.clamp(elapsed / duration, 0, 1);
    const travel = endAngle - startAngle;
    return {
      angle: startAngle + travel * smootherStep(fraction),
      angularAcceleration: travel
        * smootherStepSecondDerivative(fraction) / (duration * duration),
      angularSpeed: travel * smootherStepDerivative(fraction) / duration,
      fraction,
    };
  };
  const nominalInputRate = 2.55;
  const buildTraversal = (startAngle, endAngle, startTime, label) => {
    const direction = Math.sign(endAngle - startAngle);
    const interior = exactInputAngles.filter((angle) => direction > 0
      ? angle > startAngle + 1e-10 && angle < endAngle - 1e-10
      : angle < startAngle - 1e-10 && angle > endAngle + 1e-10);
    interior.sort((left, right) => direction > 0 ? left - right : right - left);
    const waypoints = [startAngle, ...interior, endAngle];
    const segments = [];
    let cursor = startTime;
    for (let index = 0; index < waypoints.length - 1; index += 1) {
      const segmentStart = waypoints[index];
      const segmentEnd = waypoints[index + 1];
      const duration = Math.max(
        0.58,
        Math.abs(segmentEnd - segmentStart) / nominalInputRate,
      );
      segments.push({
        direction: direction > 0 ? 'forward' : 'reverse',
        duration,
        endAngle: segmentEnd,
        endTime: cursor + duration,
        label,
        startAngle: segmentStart,
        startTime: cursor,
      });
      cursor += duration;
    }
    return { endTime: cursor, segments };
  };
  const sourceHoldDuration = 1;
  const forwardTraversal = buildTraversal(
    0,
    forwardInputLimit,
    sourceHoldDuration,
    'source-to-forward-stop',
  );
  const forwardStopHoldDuration = 1.2;
  const forwardStopHoldEnd = forwardTraversal.endTime
    + forwardStopHoldDuration;
  const fullReverseTraversal = buildTraversal(
    forwardInputLimit,
    reverseInputLimit,
    forwardStopHoldEnd,
    'forward-stop-to-reverse-stop',
  );
  const reverseStopHoldDuration = 1.2;
  const reverseStopHoldEnd = fullReverseTraversal.endTime
    + reverseStopHoldDuration;
  const sourceReturnTraversal = buildTraversal(
    reverseInputLimit,
    0,
    reverseStopHoldEnd,
    'reverse-stop-to-source',
  );
  const demonstrationPeriod = sourceReturnTraversal.endTime;
  const allMotionSegments = [
    ...forwardTraversal.segments,
    ...fullReverseTraversal.segments,
    ...sourceReturnTraversal.segments,
  ];
  const inputStateAtTime = (time) => {
    const phaseTime = THREE.MathUtils.euclideanModulo(
      time,
      demonstrationPeriod,
    );
    if (phaseTime <= sourceHoldDuration) {
      return {
        angle: 0,
        angularAcceleration: 0,
        angularSpeed: 0,
        direction: 'held-at-official-source-pose',
        phaseTime,
        timelineSegment: 'source-pose-hold',
      };
    }
    if (phaseTime > forwardTraversal.endTime
      && phaseTime <= forwardStopHoldEnd) {
      return {
        angle: forwardInputLimit,
        angularAcceleration: 0,
        angularSpeed: 0,
        direction: 'held-at-forward-convex-sector-stop',
        phaseTime,
        timelineSegment: 'forward-stop-hold',
      };
    }
    if (phaseTime > fullReverseTraversal.endTime
      && phaseTime <= reverseStopHoldEnd) {
      return {
        angle: reverseInputLimit,
        angularAcceleration: 0,
        angularSpeed: 0,
        direction: 'held-at-reverse-convex-sector-stop',
        phaseTime,
        timelineSegment: 'reverse-stop-hold',
      };
    }
    const segment = allMotionSegments.find(({ startTime, endTime }) => (
      phaseTime >= startTime - 1e-12 && phaseTime <= endTime + 1e-12
    ));
    if (!segment) {
      return {
        angle: 0,
        angularAcceleration: 0,
        angularSpeed: 0,
        direction: 'held-at-official-source-pose',
        phaseTime,
        timelineSegment: 'cycle-seam-source-pose',
      };
    }
    return {
      ...evaluateMotion(
        phaseTime - segment.startTime,
        segment.duration,
        segment.startAngle,
        segment.endAngle,
      ),
      direction: segment.direction === 'forward'
        ? 'winding-forward'
        : 'running-down-reverse',
      phaseTime,
      timelineSegment: `${segment.label}-${segment.direction}`,
    };
  };
  const stateAtTime = (time) => {
    const input = inputStateAtTime(time);
    return {
      ...stateAtInputTravel(
        input.angle,
        input.angularSpeed,
        input.angularAcceleration,
      ),
      demonstrationDirection: input.direction,
      phaseTime: input.phaseTime,
      time,
      timelineSegment: input.timelineSegment,
    };
  };
  const forwardEventTimes = Object.fromEntries(
    forwardTraversal.segments.map((segment) => [
      segment.endAngle.toFixed(12),
      segment.endTime,
    ]),
  );
  const reverseSourceSegment = fullReverseTraversal.segments.find(
    (segment) => Math.abs(segment.endAngle) <= 1e-12,
  );
  const canonicalTimes = {
    cycleClosure: demonstrationPeriod,
    firstIndexComplete: forwardEventTimes[stopStepAngle.toFixed(12)],
    firstTurnComplete: forwardEventTimes[fullTurn.toFixed(12)],
    forwardStop: forwardTraversal.endTime,
    forwardStopMidHold: forwardTraversal.endTime
      + forwardStopHoldDuration / 2,
    reverseSourcePose: reverseSourceSegment.endTime,
    reverseStop: fullReverseTraversal.endTime,
    reverseStopMidHold: fullReverseTraversal.endTime
      + reverseStopHoldDuration / 2,
    sourcePose: 0,
    thirdIndexComplete: forwardEventTimes[
      (2 * fullTurn + stopStepAngle).toFixed(12)
    ],
    thirdTurnComplete: forwardEventTimes[(3 * fullTurn).toFixed(12)],
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const sourceAnimationKeyframes = [
    [0, 0, 0],
    [1 / 24, stopStepAngle, stopStepAngle],
    [0.25, fullTurn, stopStepAngle],
    [7 / 24, fullTurn + stopStepAngle, 2 * stopStepAngle],
    [0.5, 2 * fullTurn, 2 * stopStepAngle],
    [13 / 24, 2 * fullTurn + stopStepAngle, 3 * stopStepAngle],
    [0.75, 3 * fullTurn, 3 * stopStepAngle],
    [
      (3 + 33 / 360) / 4,
      forwardInputLimit,
      stopWheelAngleAtInputTravel(forwardInputLimit),
    ],
    [1, forwardInputLimit, stopWheelAngleAtInputTravel(forwardInputLimit)],
  ].map(([cpos, inputTravel, stopWheelAngle]) => ({
    cpos,
    driverAngle: -inputTravel,
    inputTravel,
    stopWheelAngle,
  }));
  const sourceAnimationPointToModel = (point, z = 0) => new THREE.Vector3(
    (point.x - 4) * sourceScale,
    point.y * sourceScale,
    z,
  );
  const modelPointToSourceAnimation = (point) => new THREE.Vector2(
    point.x / sourceScale + 4,
    point.y / sourceScale,
  );
  const sourceAnimationPointToRaster = (point) => {
    const scale = 525 / 22;
    return new THREE.Vector2(
      (point.x + 7) * scale,
      525 - (point.y + 11) * scale,
    );
  };

  root.userData.archetype =
    'crescent-pin-six-slot-geneva-stop-with-convex-terminal-sector';
  root.userData.mechanism =
    'one-rear-carrier-face-pin-indexes-a-six-slot-wheel-a-raised-crescent-locks-five-dwells-and-one-convex-sector-stops-both-directions';
  root.userData.variant =
    'three-full-forward-indexes-and-one-full-reverse-index-with-partial-terminal-indexes-at-opposite-crescent-cusps';
  root.userData.blocks = {
    baseRail,
    bearings,
    driver,
    driverBody,
    driverIndex,
    driverShaft,
    facePin,
    facePinCap,
    feet,
    forwardContactMarker,
    lockingCamBody,
    reverseContactMarker,
    specialSectorHighlight,
    squareArbor,
    stopHub,
    stopWheel,
    stopWheelBody,
    stopWheelIndex,
    stopWheelShaft,
    uprights,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.engagementAtInputTravel = engagementAtInputTravel;
  root.userData.geometry = {
    axialLayerGap,
    centerDistance,
    commonLockingPlaneZ,
    driverBoreLocal,
    driverCarrierBevelThickness,
    driverCarrierDepth,
    driverCarrierZ,
    driverCenter,
    driverInnerRadius,
    driverLowerCuspLocal,
    driverOuterProfile,
    driverOuterRadius,
    driverUpperCuspLocal,
    forwardBlockedClosingRate,
    forwardInputLimit,
    forwardStopContact,
    lockingCamDepth,
    lockingCamOutline,
    pinLocal,
    pinOrbitRadius,
    pinRadius,
    reverseBlockedClosingRate,
    reverseInputLimit,
    reverseStopContact,
    slotHalfWidth,
    slotInnerEndRadius,
    slotOuterRadius,
    sourceCenterDistance,
    sourceCrescentEccentricArc,
    sourceCrescentEccentricProfile,
    sourceCrescentInnerArc,
    sourceCrescentInnerProfile,
    sourceDriverBore,
    sourceDriverCenter,
    sourceDriverLowerCusp,
    sourceDriverOuterRadius,
    sourceDriverTerminalVector,
    sourceDriverUpperCusp,
    sourceLockingCamOutline,
    sourcePinLocal,
    sourcePinOrbitRadius,
    sourcePinPhase,
    sourcePinRadius,
    sourceScale,
    sourceSlotHalfWidth,
    sourceSlotInnerEndRadius,
    sourceSlotOuterRadius,
    sourceSpecialSectorEndAngle,
    sourceSpecialSectorRadius,
    sourceSpecialSectorStartAngle,
    sourceStopWheelCenter,
    sourceStopWheelOutline,
    sourceStopWheelSegmentOrder,
    sourceStopWheelSegments,
    specialSectorArc,
    specialSectorRadius,
    stopStepAngle,
    stopWheelBevelThickness,
    stopWheelCenter,
    stopWheelDepth,
    stopWheelOutline,
    totalInputTravel,
  };
  root.userData.inputStateAtTime = inputStateAtTime;
  root.userData.modelPointToSourceAnimation = modelPointToSourceAnimation;
  root.userData.pinCenterAtInputTravel = pinCenterAtInputTravel;
  root.userData.sourceAnimation = {
    available: true,
    cyclesPerMinute: 15,
    durationSeconds: 8,
    forwardFullIndexes: 3,
    forwardInputTurnsBeforeStop: forwardInputLimit / fullTurn,
    keyframes: sourceAnimationKeyframes,
    normalizedTerminalPosition: (3 + 33 / 360) / 4,
    officialLoopResetsDiscontinuously: true,
    officialScheduledTerminalExtraInputDegrees: THREE.MathUtils.radToDeg(
      sourceForwardTerminalTimedAngle,
    ),
    officialTerminalPoseExtraInputDegrees: THREE.MathUtils.radToDeg(
      sourceForwardTerminalExtraAngle,
    ),
    runtimeAddsContinuousTwoLimitReverseDemonstration: true,
    terminalOutputDegrees: THREE.MathUtils.radToDeg(
      stopWheelAngleAtInputTravel(forwardInputLimit),
    ),
  };
  root.userData.sourceAnimationPointToModel = sourceAnimationPointToModel;
  root.userData.sourceAnimationPointToRaster = sourceAnimationPointToRaster;
  root.userData.sourceRaster = {
    fittedDriverCenter: sourceAnimationPointToRaster(sourceDriverCenter),
    fittedDriverOuterRadius: sourceDriverOuterRadius * 525 / 22,
    fittedStopWheelCenter: sourceAnimationPointToRaster(sourceStopWheelCenter),
    height: 525,
    sourcePose: 'face-pin-at-entry-of-first-sixty-degree-index',
    sourceUrl: 'https://507movements.com/mm_215.html',
    width: 525,
  };
  root.userData.stateAtInputTravel = stateAtInputTravel;
  root.userData.stateAtTime = stateAtTime;
  root.userData.stopWheelAngleAtInputTravel = stopWheelAngleAtInputTravel;
  root.userData.timeline = {
    allMotionSegments,
    demonstrationPeriod,
    forwardStopHoldDuration,
    forwardStopHoldEnd,
    forwardTraversal,
    fullReverseTraversal,
    nominalInputRate,
    reverseStopHoldDuration,
    reverseStopHoldEnd,
    sourceHoldDuration,
    sourceReturnTraversal,
  };
  root.userData.transmission = {
    direction: 'driver-clockwise-stop-wheel-counterclockwise-during-indexes',
    forwardFullIndexes: 3,
    forwardInputTurnsFromSourcePose: forwardInputLimit / fullTurn,
    forwardPartialIndexAngle: stopWheelAngleAtInputTravel(forwardInputLimit)
      - 3 * stopStepAngle,
    inputTurnsBetweenStops: totalInputTravel / fullTurn,
    normalIndexAngle: stopStepAngle,
    normalIndexesPerInputTurn: 1,
    reverseFullIndexes: 1,
    reverseInputTurnsFromSourcePose: -reverseInputLimit / fullTurn,
    reversePartialIndexAngle: -stopWheelAngleAtInputTravel(reverseInputLimit)
      - stopStepAngle,
    sixSlotWheel: true,
  };
  root.userData.cameraDistanceScale = 1.08;

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(driver, state.driverAngle);
    setSpin(driverShaft, state.driverAngle);
    setSpin(stopWheel, state.stopWheelAngle);
    setSpin(stopWheelShaft, state.stopWheelAngle);
    forwardContactMarker.visible = state.atForwardStop;
    reverseContactMarker.visible = state.atReverseStop;
    driver.userData.angularSpeed = state.driverAngularSpeed;
    driverShaft.userData.angularSpeed = state.driverAngularSpeed;
    stopWheel.userData.angularSpeed = state.stopWheelAngularSpeed;
    stopWheelShaft.userData.angularSpeed = state.stopWheelAngularSpeed;
    root.userData.contacts = {
      convexTerminalSector: state.limit.stopContact,
      crescentLockingPocket: state.lock.active ? state.lock : null,
      facePinSlot: state.engagement.active ? state.engagement : null,
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finishGenevaWorkingParts(finish(root, update, new THREE.Vector3(6.8, 5.1, 11.6)), 215);
}

function vibratingCarrierSinglePawlRatchet(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const toothCount = 20;
  const toothPitch = fullTurn / toothCount;
  const sourceScale = 0.0108;
  const sourceWheelCenter = new THREE.Vector2(208, 271);
  const sourceCarrierPivot = new THREE.Vector2(409, 464);
  const sourcePawlPivot = new THREE.Vector2(409, 57);
  const sourceToModel = (point) => new THREE.Vector2(
    (point.x - sourceWheelCenter.x) * sourceScale,
    (sourceWheelCenter.y - point.y) * sourceScale,
  );
  const carrierPivot = sourceToModel(sourceCarrierPivot);
  const sourceTopPivot = sourceToModel(sourcePawlPivot);
  const carrierLength = carrierPivot.distanceTo(sourceTopPivot);
  const ratchetOuterRadius = 1.56;
  const ratchetRootRadius = 1.3;
  // Brown's pawl end is a slim rounded point bearing high on the steep face,
  // so the long back of the tooth behind stays under the nearly straight bar.
  const pawlNoseRadius = 0.06;
  const workingFlank = carrierPawlFlank225({ outerRadius: ratchetOuterRadius, rootRadius: ratchetRootRadius, pitch: toothPitch, noseRadius: pawlNoseRadius, flankFraction: 0.8 });
  const pawlContactCenterRadius = workingFlank.radius;
  const pawlLength = 2.64;
  const carrierMidAngle = Math.PI / 2;

  const carrierTopAt = (carrierAngle) => new THREE.Vector2(
    carrierPivot.x + carrierLength * Math.cos(carrierAngle),
    carrierPivot.y + carrierLength * Math.sin(carrierAngle),
  );
  const contactGeometryAtCarrierAngle = (carrierAngle) => {
    const pawlPivot = carrierTopAt(carrierAngle);
    const centerDistance = pawlPivot.length();
    const lineAngle = Math.atan2(pawlPivot.y, pawlPivot.x);
    const cosine = (
      centerDistance ** 2 + pawlContactCenterRadius ** 2 - pawlLength ** 2
    ) / (2 * centerDistance * pawlContactCenterRadius);
    const triangleAngle = Math.acos(THREE.MathUtils.clamp(cosine, -1, 1));
    const contactAngle = lineAngle + triangleAngle;
    const pawlContactCenter = new THREE.Vector2(
      Math.cos(contactAngle) * pawlContactCenterRadius,
      Math.sin(contactAngle) * pawlContactCenterRadius,
    );
    const pawlVector = pawlContactCenter.clone().sub(pawlPivot);
    return {
      centerDistance,
      contactAngle,
      pawlAngle: Math.atan2(pawlVector.y, pawlVector.x),
      pawlContactCenter,
      pawlPivot,
      pawlVector,
    };
  };
  const contactAngleDerivative = (carrierAngle) => {
    const pawlPivot = carrierTopAt(carrierAngle);
    const pivotDerivative = new THREE.Vector2(
      -carrierLength * Math.sin(carrierAngle),
      carrierLength * Math.cos(carrierAngle),
    );
    const distance = pawlPivot.length();
    const distanceDerivative = pawlPivot.dot(pivotDerivative) / distance;
    const lineAngleDerivative = (
      pawlPivot.x * pivotDerivative.y
      - pawlPivot.y * pivotDerivative.x
    ) / distance ** 2;
    const radius = pawlContactCenterRadius;
    const cosine = (
      distance ** 2 + radius ** 2 - pawlLength ** 2
    ) / (2 * distance * radius);
    const cosineDerivative = distanceDerivative / (2 * radius) * (
      1 - (radius ** 2 - pawlLength ** 2) / distance ** 2
    );
    return lineAngleDerivative - cosineDerivative
      / Math.sqrt(Math.max(1e-18, 1 - cosine ** 2));
  };

  let lowerSwing = 0;
  let upperSwing = THREE.MathUtils.degToRad(8);
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const middle = (lowerSwing + upperSwing) / 2;
    const travel = contactGeometryAtCarrierAngle(
      carrierMidAngle + middle,
    ).contactAngle - contactGeometryAtCarrierAngle(
      carrierMidAngle - middle,
    ).contactAngle;
    if (travel < toothPitch) lowerSwing = middle;
    else upperSwing = middle;
  }
  const carrierSwing = (lowerSwing + upperSwing) / 2;
  const carrierStartAngle = carrierMidAngle - carrierSwing;
  const carrierEndAngle = carrierMidAngle + carrierSwing;
  const driveStart = contactGeometryAtCarrierAngle(carrierStartAngle);
  const driveEnd = contactGeometryAtCarrierAngle(carrierEndAngle);
  const toothOuterStartPhase = 0.16;
  const toothOuterEndPhase = 0.25;
  const ratchetMountPhase = driveStart.contactAngle - workingFlank.angle;
  const pawlReturnLift = -0.25;
  let returnOutlineCache = null;
  let returnEndGapsCache = null;
  const cyclesPerSecond = 0.25;
  const cyclePeriod = 1 / cyclesPerSecond;
  const sourceCycleCoordinate = 0.25;
  const boundaryEpsilon = 1e-12;
  const quintic = (value) => value ** 3 * (value * (value * 6 - 15) + 10);
  const quinticFirst = (value) => 30 * value ** 2 * (value - 1) ** 2;
  const normalizedCoordinate = (coordinate) => {
    const nearest = Math.round(coordinate);
    return Math.abs(coordinate - nearest) < boundaryEpsilon
      ? nearest
      : coordinate;
  };
  const stateAtCycleCoordinate = (rawCoordinate) => {
    const cycleCoordinate = normalizedCoordinate(rawCoordinate);
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const driving = cyclePhase < 0.5;
    const local = driving ? cyclePhase * 2 : (cyclePhase - 0.5) * 2;
    const progress = quintic(local);
    const progressRate = quinticFirst(local) * 2 * cyclesPerSecond;
    const carrierAngle = driving
      ? THREE.MathUtils.lerp(carrierStartAngle, carrierEndAngle, progress)
      : THREE.MathUtils.lerp(carrierEndAngle, carrierStartAngle, progress);
    const carrierAngularSpeed = driving
      ? (carrierEndAngle - carrierStartAngle) * progressRate
      : (carrierStartAngle - carrierEndAngle) * progressRate;
    const pawlPivot = carrierTopAt(carrierAngle);
    const pawlPivotVelocity = new THREE.Vector2(
      -carrierLength * Math.sin(carrierAngle) * carrierAngularSpeed,
      carrierLength * Math.cos(carrierAngle) * carrierAngularSpeed,
    );
    let wheelAngle;
    let wheelAngularSpeed;
    let pawlAngle;
    let pawlAngularSpeed;
    let pawlContactCenter;
    let returnClearance;
    if (driving) {
      const geometry = contactGeometryAtCarrierAngle(carrierAngle);
      wheelAngle = cycleIndex * toothPitch
        + geometry.contactAngle - driveStart.contactAngle;
      wheelAngularSpeed = contactAngleDerivative(carrierAngle)
        * carrierAngularSpeed;
      pawlAngle = geometry.pawlAngle;
      pawlContactCenter = geometry.pawlContactCenter;
      const centerVelocity = new THREE.Vector2(
        -pawlContactCenter.y * wheelAngularSpeed,
        pawlContactCenter.x * wheelAngularSpeed,
      );
      const relativeVelocity = centerVelocity.clone().sub(pawlPivotVelocity);
      pawlAngularSpeed = (
        geometry.pawlVector.x * relativeVelocity.y
        - geometry.pawlVector.y * relativeVelocity.x
      ) / pawlLength ** 2;
      returnClearance = 0;
    } else {
      wheelAngle = (cycleIndex + 1) * toothPitch;
      wheelAngularSpeed = 0;
      // On the return stroke the weighted pawl drags back over the teeth: its
      // nose rides the wheel outline a hair clear, dropping into each gap it
      // passes. At both ends the target clearance equals the drive stroke's
      // own running gap (about 0.0002), so the pose joins the drive stroke
      // exactly instead of pressing the nose to zero clearance; the sin^2
      // ramp and quintic blend keep the angular speed continuous there.
      const returnOutline = () => (returnOutlineCache ??= ratchet.userData.profilePoints.map(p => p.toArray()));
      returnEndGapsCache ??= [
        carrierPawlClearance225(driveEnd.pawlContactCenter, toothPitch, returnOutline(), pawlNoseRadius),
        carrierPawlClearance225(driveStart.pawlContactCenter, 0, returnOutline(), pawlNoseRadius),
      ];
      const returnPawlAngle = (localValue) => {
        const pivot = carrierTopAt(THREE.MathUtils.lerp(carrierEndAngle, carrierStartAngle, quintic(localValue)));
        const base = THREE.MathUtils.lerp(driveEnd.pawlAngle, driveStart.pawlAngle, quintic(localValue));
        const endGap = THREE.MathUtils.lerp(returnEndGapsCache[0], returnEndGapsCache[1], quintic(localValue));
        const target = endGap + (0.003 - endGap) * Math.sin(Math.PI * localValue) ** 2;
        const clearanceAt = (angle) => carrierPawlClearance225(pivot.clone().add(new THREE.Vector2(
          Math.cos(angle) * pawlLength, Math.sin(angle) * pawlLength)), wheelAngle, returnOutline(), pawlNoseRadius);
        let low = base - pawlReturnLift * 0.6, high = base + pawlReturnLift;
        let noseAngle;
        if (clearanceAt(low) >= target) noseAngle = low;
        else if (clearanceAt(high) < target) noseAngle = high;
        else {
          for (let step = 0; step < 48; step += 1) {
            const middle = (low + high) / 2;
            if (clearanceAt(middle) >= target) high = middle; else low = middle;
          }
          noseAngle = high;
        }
        // The bar itself must also ride over the tooth behind the nose.
        return Math.min(noseAngle, carrierPawlBarLiftLimit225(pivot, noseAngle, wheelAngle, root.userData.geometry.pawlWheelEdge, returnOutline(), 0.003));
      };
      pawlAngle = returnPawlAngle(local);
      // A 1e-6 central difference (bisection bracket ~1e-15 rad) keeps the
      // one-sided window at the stroke ends from biasing the joining speed.
      const step = 1e-6;
      pawlAngularSpeed = (returnPawlAngle(Math.min(1, local + step)) - returnPawlAngle(Math.max(0, local - step)))
        / (Math.min(1, local + step) - Math.max(0, local - step)) * 2 * cyclesPerSecond;
      pawlContactCenter = pawlPivot.clone().add(new THREE.Vector2(
        Math.cos(pawlAngle) * pawlLength,
        Math.sin(pawlAngle) * pawlLength,
      ));
      returnClearance = carrierPawlClearance225(pawlContactCenter, wheelAngle, returnOutline(), pawlNoseRadius);
    }
    const workingAngle = ratchetMountPhase + wheelAngle - cycleIndex * toothPitch;
    const contactNormal = workingFlank.normal.clone().rotateAround(new THREE.Vector2(), workingAngle);
    const pawlContactPoint = pawlContactCenter.clone().addScaledVector(
      contactNormal,
      -pawlNoseRadius,
    );
    const ratchetContactPoint = workingFlank.point.clone().rotateAround(new THREE.Vector2(), workingAngle);
    const pawlSurfaceVelocity = pawlPivotVelocity.clone().add(new THREE.Vector2(
      -(pawlContactPoint.y - pawlPivot.y) * pawlAngularSpeed,
      (pawlContactPoint.x - pawlPivot.x) * pawlAngularSpeed,
    ));
    const ratchetSurfaceVelocity = new THREE.Vector2(
      -ratchetContactPoint.y * wheelAngularSpeed,
      ratchetContactPoint.x * wheelAngularSpeed,
    );
    const surfaceVelocityDifference = pawlSurfaceVelocity.clone().sub(
      ratchetSurfaceVelocity,
    );
    return {
      activeToothIndex: THREE.MathUtils.euclideanModulo(-cycleIndex, toothCount),
      carrierAngle,
      carrierAngularSpeed,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      driving,
      pawlAngle,
      pawlAngularSpeed,
      pawlContactCenter,
      pawlContactError: driving
        ? pawlContactPoint.distanceTo(ratchetContactPoint)
        : null,
      pawlContactPoint,
      contactNormal,
      outputMomentArm: -(ratchetContactPoint.x * contactNormal.y - ratchetContactPoint.y * contactNormal.x),
      pawlPivot,
      pawlPivotVelocity,
      pawlSurfaceVelocity,
      pawlToothSurfaceVelocityError: driving
        ? surfaceVelocityDifference.length()
        : null,
      pawlToothNormalVelocityError: driving
        ? Math.abs(surfaceVelocityDifference.dot(contactNormal))
        : null,
      progress,
      ratchetContactPoint,
      ratchetSurfaceVelocity,
      returnClearance,
      stage: driving ? 'pawl-driving-one-tooth' : 'pawl-clicking-over-return',
      teethAdvanced: wheelAngle / toothPitch,
      wheelAngle,
      wheelAngularSpeed,
      wheelDwelling: !driving,
    };
  };
  const stateAtTime = (time) => stateAtCycleCoordinate(
    sourceCycleCoordinate + time * cyclesPerSecond,
  );

  const ratchet = makeSpringIndexedRatchet({
    boreRadius: 0.18,
    depth: 0.28,
    mountPhase: ratchetMountPhase,
    outerRadius: ratchetOuterRadius,
    rootRadius: ratchetRootRadius,
    teeth: toothCount,
    toothOuterStartPhase,
    toothOuterEndPhase,
  });
  ratchet.userData.role = 'twenty-tooth-single-action-ratchet-wheel';
  ratchet.userData.body.userData.role = 'source-sawtooth-ratchet-body';
  // The wheel and the flat pawl share one plane.
  const pawlPlaneZ = 0.23;
  ratchet.position.z = pawlPlaneZ;
  root.add(ratchet);
  const ratchetShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 0.95,
    radius: 0.105,
  });
  ratchetShaft.position.z = pawlPlaneZ - 0.04;
  ratchetShaft.userData.role = 'fixed-axis-ratchet-output-shaft';
  root.add(ratchetShaft);

  const carrier = makeDynamicLink({
    color: PALETTE.driver,
    depth: 0.15,
    jointRadius: 0.13,
    thickness: 0.17,
  });
  carrier.userData.role = 'floor-pivoted-vibrating-pawl-carrier';
  root.add(carrier);
  const pawl = new THREE.Group();
  pawl.userData.axis = Z_AXIS.clone();
  pawl.userData.role = 'separately-hinged-gravity-return-pawl';
  const pawlCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(pawlLength * 0.48, 0.18, 0),
    new THREE.Vector3(pawlLength, 0, 0),
  ], false, 'centripetal');
  const pawlBody = new THREE.Mesh(
    new THREE.TubeGeometry(pawlCurve, 48, 0.105, 10, false),
    matte(PALETTE.driver, { metalness: 0.12, roughness: 0.62 }),
  );
  pawlBody.userData.role = 'curved-pawl-body-from-carrier-hinge-to-wheel';
  // The working nose is the flat pawl's own rounded end, in the ratchet's
  // plane; this marker records its centre.
  const pawlNose = new THREE.Object3D();
  pawlNose.position.set(pawlLength, 0, 0);
  pawlNose.userData.role = 'rounded-pawl-working-nose';
  const pawlIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  pawlIndex.position.set(pawlLength * 0.72, 0.075, 0.1);
  pawlIndex.userData.role = 'white-pawl-motion-index';
  pawl.add(pawlBody, pawlNose, pawlIndex);
  root.add(pawl);

  const bottomBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.052, 10, 36),
    matte(PALETTE.ink, { metalness: 0.2, roughness: 0.52 }),
  );
  bottomBearing.position.set(carrierPivot.x, carrierPivot.y, 0.08);
  bottomBearing.userData.role = 'fixed-floor-carrier-bearing';
  const baseFoot = new THREE.Mesh(
    new THREE.BoxGeometry(0.78, 0.13, 0.34),
    matte(PALETTE.frame, { metalness: 0.12, roughness: 0.69 }),
  );
  baseFoot.position.set(carrierPivot.x, carrierPivot.y - 0.24, -0.03);
  baseFoot.userData.role = 'small-source-floor-foot';
  // Brown draws only the bearing lug on hatched ground, no base block.
  baseFoot.visible = false;
  root.add(bottomBearing, baseFoot);
  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  contactMarker.position.z = 0.47;
  contactMarker.userData.role = 'active-pawl-tooth-contact-marker';
  root.add(contactMarker);

  const sourceState = stateAtTime(0);
  const cycleState = stateAtTime(cyclePeriod);
  root.userData.archetype =
    'floor-pivoted-vibrating-carrier-single-hinged-pawl-ratchet';
  root.userData.blocks = {
    baseFoot,
    bottomBearing,
    carrier,
    contactMarker,
    pawl,
    pawlBody,
    pawlIndex,
    pawlNose,
    ratchet,
    ratchetShaft,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.95, -2.65, -0.7),
    new THREE.Vector3(2.85, 2.75, 0.8),
  );
  root.userData.canonicalTimes = {
    cycleClosure: cyclePeriod,
    driveEnd: cyclePeriod * 0.25,
    returnEnd: cyclePeriod * 0.75,
    sourcePose: 0,
  };
  root.userData.geometry = {
    workingFlank,
    carrierEndAngle,
    carrierLength,
    carrierMidAngle,
    carrierPivot,
    carrierStartAngle,
    carrierSwing,
    cyclePeriod,
    cyclesPerSecond,
    driveEndContactAngle: driveEnd.contactAngle,
    driveStartContactAngle: driveStart.contactAngle,
    pawlNoseDepth: 0.13,
    pawlPlaneZ,
    pawlContactCenterRadius,
    pawlLength,
    pawlNoseRadius,
    pawlReturnLift,
    ratchetMountPhase,
    ratchetDepth: 0.28,
    ratchetOuterRadius,
    ratchetRootRadius,
    sourceScale,
    sourceCycleCoordinate,
    sourceTopPivot,
    toothCount,
    toothOuterEndPhase,
    toothOuterStartPhase,
    toothPitch,
  };
  root.userData.mechanism =
    'vibrating-floor-carrier-hinges-one-pawl-for-drive-and-click-return';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 225 page has no canvas, ae.add_model or mm_present registration; its animation is unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate225: {
      imageHeight: 525,
      imageWidth: 525,
      inferredRatchetTeeth: toothCount,
      rasterCarrierFloorPivot: sourceCarrierPivot,
      rasterPawlHinge: sourcePawlPivot,
      rasterRatchetCenter: sourceWheelCenter,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.contactGeometryAtCarrierAngle =
    contactGeometryAtCarrierAngle;
  root.userData.contactAngleDerivative = contactAngleDerivative;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    carrierSwingDegrees: THREE.MathUtils.radToDeg(2 * carrierSwing),
    cyclePeriod,
    direction: 'counterclockwise-one-tooth-index',
    outputTeethPerCarrierCycle: (
      cycleState.wheelAngle - sourceState.wheelAngle
    ) / toothPitch,
    returnStrokeWheelDwell: true,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    const carrierStart = new THREE.Vector3(
      carrierPivot.x,
      carrierPivot.y,
      0.32,
    );
    const carrierEnd = new THREE.Vector3(
      state.pawlPivot.x,
      state.pawlPivot.y,
      0.32,
    );
    carrier.userData.setEndpoints(carrierStart, carrierEnd);
    pawl.position.set(state.pawlPivot.x, state.pawlPivot.y, pawlPlaneZ);
    pawl.rotation.z = state.pawlAngle;
    setSpin(ratchet, state.wheelAngle);
    setSpin(ratchetShaft, state.wheelAngle);
    contactMarker.visible = state.driving;
    contactMarker.position.x = state.ratchetContactPoint.x;
    contactMarker.position.y = state.ratchetContactPoint.y;
    carrier.userData.angularSpeed = state.carrierAngularSpeed;
    pawl.userData.angularSpeed = state.pawlAngularSpeed;
    ratchet.userData.angularSpeed = state.wheelAngularSpeed;
    ratchetShaft.userData.angularSpeed = state.wheelAngularSpeed;
    root.userData.contacts = {
      pawlTooth: state.driving ? {
        contactError: state.pawlContactError,
        point: state.ratchetContactPoint,
        normalVelocityError: state.pawlToothNormalVelocityError,
        surfaceVelocityError: state.pawlToothSurfaceVelocityError,
      } : null,
      returnClearance: state.returnClearance,
    };
    root.userData.kinematics = state;
    root.userData.updateWorkingParts225?.(state);
  };
  installCarrierPawl225(root);
  update(0);
  return finish(root, update, new THREE.Vector3(2.4, -2.8, 12.5));
}

function parallelogramLiftAndDrawPawlRatchet(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const toothCount = 20;
  const toothPitch = fullTurn / toothCount;
  const wheelCenter = new THREE.Vector2(0, 0);
  const groundLength = 2.08;
  const shortLinkLength = 0.6;
  const upperGroundPivot = new THREE.Vector2(0, groundLength);
  const wheelOuterRadius = 2.02;
  const wheelRootRadius = 1.69;
  const gapHalfAngle = toothPitch * 0.18;
  const sourceHookRadius = 1.78;
  const sourceHookPolarAngle = THREE.MathUtils.degToRad(36);
  const workingHookLocal = new THREE.Vector2(
    Math.cos(sourceHookPolarAngle) * sourceHookRadius,
    Math.sin(sourceHookPolarAngle) * sourceHookRadius - groundLength,
  );

  const rotateVector = (vector, angle) => new THREE.Vector2(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  );
  const transformFromUpperPivot = (localPoint, pawlAngle) => (
    rotateVector(localPoint, pawlAngle).add(upperGroundPivot)
  );
  const hookGeometryAtPawlAngle = (pawlAngle) => {
    const hookPoint = transformFromUpperPivot(workingHookLocal, pawlAngle);
    const hookRadius = hookPoint.length();
    const hookPolarAngle = Math.atan2(hookPoint.y, hookPoint.x);
    const localRadiusVector = rotateVector(workingHookLocal, pawlAngle);
    const hookPointDerivative = new THREE.Vector2(
      -localRadiusVector.y,
      localRadiusVector.x,
    );
    const hookPointSecondDerivative = localRadiusVector.clone().negate();
    const radiusSquared = hookRadius ** 2;
    const hookPolarDerivative = (
      hookPoint.x * hookPointDerivative.y
      - hookPoint.y * hookPointDerivative.x
    ) / radiusSquared;
    const crossSecond = hookPoint.x * hookPointSecondDerivative.y
      - hookPoint.y * hookPointSecondDerivative.x;
    const radialDerivative = hookPoint.dot(hookPointDerivative);
    const hookPolarSecondDerivative = crossSecond / radiusSquared
      - 2 * (
        hookPoint.x * hookPointDerivative.y
        - hookPoint.y * hookPointDerivative.x
      ) * radialDerivative / radiusSquared ** 2;
    return {
      hookPoint,
      hookPointDerivative,
      hookPointSecondDerivative,
      hookPolarAngle,
      hookPolarDerivative,
      hookPolarSecondDerivative,
      hookRadius,
    };
  };

  const sourceHookGeometry = hookGeometryAtPawlAngle(0);
  let lowerSwing = 0;
  let upperSwing = Math.PI / 2;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const middle = (lowerSwing + upperSwing) / 2;
    const polarTravel = hookGeometryAtPawlAngle(middle).hookPolarAngle
      - sourceHookGeometry.hookPolarAngle;
    if (polarTravel < toothPitch) lowerSwing = middle;
    else upperSwing = middle;
  }
  const inputSwing = (lowerSwing + upperSwing) / 2;
  const liftedHookGeometry = hookGeometryAtPawlAngle(inputSwing);
  const gapMountPhase = sourceHookPolarAngle;

  const contactSurfaceAtPawlAngle = (pawlAngle) => {
    const hookGeometry = hookGeometryAtPawlAngle(pawlAngle);
    const contactPolarAngle = hookGeometry.hookPolarAngle - gapHalfAngle;
    const contactPoint = new THREE.Vector2(
      Math.cos(contactPolarAngle) * wheelOuterRadius,
      Math.sin(contactPolarAngle) * wheelOuterRadius,
    );
    const contactRelativeToPivot = contactPoint.clone().sub(
      upperGroundPivot,
    );
    const contactLocal = rotateVector(
      contactRelativeToPivot,
      -pawlAngle,
    );
    const contactPointDerivative = new THREE.Vector2(
      -contactPoint.y * hookGeometry.hookPolarDerivative,
      contactPoint.x * hookGeometry.hookPolarDerivative,
    );
    const inverseRotatedDerivative = rotateVector(
      contactPointDerivative,
      -pawlAngle,
    );
    const contactLocalDerivative = inverseRotatedDerivative.sub(
      new THREE.Vector2(-contactLocal.y, contactLocal.x),
    );
    return {
      contactLocal,
      contactLocalDerivative,
      contactPoint,
      contactPolarAngle,
      hookGeometry,
    };
  };

  const makeSquareToothWheel = () => {
    const wheel = makePlanarRotor();
    const rotor = wheel.userData.rotor;
    const shape = new THREE.Shape();
    const profilePoints = [];
    const gapCenters = [];
    const trailingCorners = [];
    for (let index = 0; index < toothCount; index += 1) {
      const gapCenter = gapMountPhase + index * toothPitch;
      const trailingAngle = gapCenter - gapHalfAngle;
      const leadingAngle = gapCenter + gapHalfAngle;
      const nextTrailingAngle = gapCenter + toothPitch - gapHalfAngle;
      const points = [
        new THREE.Vector2(
          Math.cos(trailingAngle) * wheelOuterRadius,
          Math.sin(trailingAngle) * wheelOuterRadius,
        ),
        new THREE.Vector2(
          Math.cos(trailingAngle) * wheelRootRadius,
          Math.sin(trailingAngle) * wheelRootRadius,
        ),
        new THREE.Vector2(
          Math.cos(leadingAngle) * wheelRootRadius,
          Math.sin(leadingAngle) * wheelRootRadius,
        ),
        new THREE.Vector2(
          Math.cos(leadingAngle) * wheelOuterRadius,
          Math.sin(leadingAngle) * wheelOuterRadius,
        ),
        new THREE.Vector2(
          Math.cos(nextTrailingAngle) * wheelOuterRadius,
          Math.sin(nextTrailingAngle) * wheelOuterRadius,
        ),
      ];
      for (const point of points) {
        if (profilePoints.length === 0) shape.moveTo(point.x, point.y);
        else shape.lineTo(point.x, point.y);
        profilePoints.push(point);
      }
      gapCenters.push(gapCenter);
      trailingCorners.push(points[0]);
    }
    shape.closePath();
    const bore = new THREE.Path();
    bore.absarc(0, 0, 0.18, 0, fullTurn, true);
    shape.holes.push(bore);
    const wheelDepth = 0.38;
    const body = new THREE.Mesh(
      centeredExtrusion(shape, wheelDepth),
      matte(PALETTE.driven, { metalness: 0.12, roughness: 0.63 }),
    );
    body.userData.role = 'twenty-square-tooth-output-wheel-body';
    rotor.add(body);
    const index = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, wheelOuterRadius * 0.56, 0.026),
      matte(PALETTE.white, { roughness: 0.47 }),
    );
    index.position.set(0, -wheelOuterRadius * 0.63, wheelDepth / 2 + 0.04);
    index.userData.role = 'white-output-index';
    rotor.add(index);
    wheel.userData.body = body;
    wheel.userData.depth = wheelDepth;
    wheel.userData.gapCenters = gapCenters;
    wheel.userData.index = index;
    wheel.userData.outerRadius = wheelOuterRadius;
    wheel.userData.profilePoints = profilePoints;
    wheel.userData.rootRadius = wheelRootRadius;
    wheel.userData.role = 'twenty-tooth-intermittent-output-wheel';
    wheel.userData.teeth = toothCount;
    wheel.userData.trailingCorners = trailingCorners;
    return markShadows(wheel);
  };

  const makeCapsulePlate = ({
    boreRadius = 0,
    color,
    depth,
    length,
    radius,
  }) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, radius);
    shape.lineTo(length, radius);
    shape.absarc(length, 0, radius, Math.PI / 2, -Math.PI / 2, true);
    shape.lineTo(0, -radius);
    shape.absarc(0, 0, radius, -Math.PI / 2, Math.PI / 2, true);
    shape.closePath();
    if (boreRadius > 0) {
      const bore = new THREE.Path();
      bore.absarc(0, 0, boreRadius, 0, fullTurn, true);
      shape.holes.push(bore);
    }
    return new THREE.Mesh(
      centeredExtrusion(shape, depth),
      matte(color, { metalness: 0.11, roughness: 0.64 }),
    );
  };

  const wheel = makeSquareToothWheel();
  root.add(wheel);
  const outputShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 1.18,
    radius: 0.105,
  });
  outputShaft.position.z = 0.17;
  outputShaft.userData.role = 'fixed-axis-intermittent-output-shaft';
  root.add(outputShaft);

  const pawlSurfaceSamples = Array.from({ length: 65 }, (_, index) => (
    contactSurfaceAtPawlAngle(inputSwing * index / 64).contactLocal
  ));
  const pawlShape = new THREE.Shape();
  pawlShape.moveTo(-0.15, 0.12);
  pawlShape.quadraticCurveTo(0.28, 0.18, 0.72, 0.06);
  pawlShape.quadraticCurveTo(1.43, -0.18, 2.03, -0.87);
  pawlShape.lineTo(1.72, -1.05);
  for (const point of pawlSurfaceSamples) {
    pawlShape.lineTo(point.x, point.y);
  }
  pawlShape.quadraticCurveTo(0.22, -0.93, 0.2, -0.34);
  pawlShape.lineTo(0.18, 0.03);
  pawlShape.quadraticCurveTo(0.02, 0.18, -0.15, 0.12);
  pawlShape.closePath();
  const pawlWindow = new THREE.Path();
  pawlWindow.moveTo(0.34, -0.18);
  pawlWindow.quadraticCurveTo(0.78, -0.08, 1.2, -0.38);
  pawlWindow.lineTo(1.54, -0.74);
  pawlWindow.lineTo(1.34, -0.86);
  pawlWindow.quadraticCurveTo(0.96, -0.72, 0.63, -0.86);
  pawlWindow.lineTo(0.43, -0.72);
  pawlWindow.quadraticCurveTo(0.32, -0.44, 0.34, -0.18);
  pawlWindow.closePath();
  pawlShape.holes.push(pawlWindow);
  const pawlBore = new THREE.Path();
  pawlBore.absarc(0, 0, 0.09, 0, fullTurn, true);
  pawlShape.holes.push(pawlBore);
  const pawl = new THREE.Group();
  pawl.position.set(upperGroundPivot.x, upperGroundPivot.y, 0.14);
  pawl.userData.axis = Z_AXIS.clone();
  pawl.userData.role = 'upper-frame-pivoted-curved-drawing-pawl-C';
  const pawlBody = new THREE.Mesh(
    centeredExtrusion(pawlShape, 0.16),
    matte(PALETTE.brass, { metalness: 0.14, roughness: 0.59 }),
  );
  pawlBody.userData.role = 'curved-pawl-C-body-with-generated-working-face';
  const pawlIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  pawlIndex.position.set(1.52, -0.57, 0.105);
  pawlIndex.userData.role = 'white-pawl-C-motion-index';
  pawl.add(pawlBody, pawlIndex);
  root.add(pawl);

  const frameShape = new THREE.Shape();
  frameShape.moveTo(-0.19, groundLength + 0.16);
  frameShape.quadraticCurveTo(0.03, groundLength + 0.23, 0.22, groundLength + 0.1);
  frameShape.lineTo(0.24, 0.78);
  frameShape.quadraticCurveTo(0.24, 0.55, 0.46, 0.49);
  frameShape.lineTo(0.94, 0.47);
  frameShape.quadraticCurveTo(1.2, 0.42, 1.26, 0.17);
  frameShape.lineTo(1.28, -0.3);
  frameShape.quadraticCurveTo(1.12, -0.48, 0.8, -0.49);
  frameShape.lineTo(-0.04, -0.49);
  frameShape.quadraticCurveTo(-0.38, -0.46, -0.46, -0.12);
  frameShape.quadraticCurveTo(-0.5, 0.2, -0.36, 0.58);
  frameShape.lineTo(-0.19, groundLength + 0.16);
  frameShape.closePath();
  for (const [center, radius] of [
    [wheelCenter, 0.17],
    [upperGroundPivot, 0.09],
    [new THREE.Vector2(0.97, -0.27), 0.075],
  ]) {
    const hole = new THREE.Path();
    hole.absarc(center.x, center.y, radius, 0, fullTurn, true);
    frameShape.holes.push(hole);
  }
  const framePlate = new THREE.Mesh(
    centeredExtrusion(frameShape, 0.14),
    matte(PALETTE.frame, { metalness: 0.13, roughness: 0.67 }),
  );
  framePlate.position.z = 0.34;
  framePlate.userData.role = 'fixed-three-hole-frame-plate-A';
  root.add(framePlate);

  const inputLever = new THREE.Group();
  inputLever.position.z = 0.5;
  inputLever.userData.axis = Z_AXIS.clone();
  inputLever.userData.role = 'wheel-axis-pivoted-vibrating-arm-B';
  const inputLeverBody = makeCapsulePlate({
    boreRadius: 0.13,
    color: PALETTE.driver,
    depth: 0.14,
    length: 3.28,
    radius: 0.13,
  });
  inputLeverBody.userData.role = 'long-source-handle-B-body';
  const inputIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  inputIndex.position.set(2.58, 0.08, 0.095);
  inputIndex.userData.role = 'white-input-arm-motion-index';
  inputLever.add(inputLeverBody, inputIndex);
  root.add(inputLever);

  const coupler = makeDynamicLink({
    color: PALETTE.driver,
    depth: 0.12,
    jointRadius: 0.115,
    thickness: 0.13,
  });
  coupler.userData.role = 'vertical-equal-length-parallelogram-coupler';
  root.add(coupler);

  const retainingPivot = new THREE.Vector2(1.13, 0.42);
  const retainingNoseAtRest = new THREE.Vector2(
    wheelRootRadius + 0.075,
    0,
  );
  const retainingVector = retainingNoseAtRest.clone().sub(retainingPivot);
  const retainingLength = retainingVector.length();
  const retainingRestAngle = Math.atan2(retainingVector.y, retainingVector.x);
  const retainingLift = THREE.MathUtils.degToRad(16);
  const retainingClick = new THREE.Group();
  retainingClick.position.set(retainingPivot.x, retainingPivot.y, 0.235);
  retainingClick.userData.axis = Z_AXIS.clone();
  retainingClick.userData.role = 'face-mounted-return-stroke-retaining-click';
  const retainingBody = makeCapsulePlate({
    boreRadius: 0.065,
    color: PALETTE.brass,
    depth: 0.12,
    length: retainingLength,
    radius: 0.17,
  });
  retainingBody.userData.role = 'unlabeled-semicircular-retaining-click-body';
  const retainingNose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.2, 22),
    matte(PALETTE.ink, { metalness: 0.19, roughness: 0.52 }),
  );
  retainingNose.rotation.x = Math.PI / 2;
  retainingNose.position.set(retainingLength, 0, 0);
  retainingNose.userData.role = 'retaining-click-working-nose';
  retainingClick.add(retainingBody, retainingNose);
  root.add(retainingClick);

  const makePin = ({ color = PALETTE.ink, length, radius, role }) => {
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, length, 24),
      matte(color, { metalness: 0.2, roughness: 0.5 }),
    );
    pin.rotation.x = Math.PI / 2;
    pin.userData.role = role;
    return pin;
  };
  const upperPivotPin = makePin({
    length: 0.64,
    radius: 0.075,
    role: 'frame-A-to-pawl-C-upper-pivot-pin',
  });
  upperPivotPin.position.set(0, groundLength, 0.35);
  const inputCouplerPin = makePin({
    length: 0.36,
    radius: 0.07,
    role: 'arm-B-to-vertical-coupler-pin',
  });
  const pawlCouplerPin = makePin({
    length: 0.58,
    radius: 0.07,
    role: 'pawl-C-to-vertical-coupler-pin',
  });
  const retainingPivotPin = makePin({
    length: 0.4,
    radius: 0.065,
    role: 'fixed-retaining-click-pivot-pin',
  });
  retainingPivotPin.position.set(retainingPivot.x, retainingPivot.y, 0.3);
  const frameMountBolt = makePin({
    length: 0.24,
    radius: 0.065,
    role: 'fixed-frame-A-lower-mount-bolt',
  });
  frameMountBolt.position.set(0.97, -0.27, 0.38);
  root.add(
    upperPivotPin,
    inputCouplerPin,
    pawlCouplerPin,
    retainingPivotPin,
    frameMountBolt,
  );

  const contactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  contactMarker.position.z = 0.255;
  contactMarker.userData.role = 'sliding-pawl-C-tooth-corner-contact-marker';
  root.add(contactMarker);

  const cyclesPerSecond = 0.25;
  const cyclePeriod = 1 / cyclesPerSecond;
  const boundaryEpsilon = 1e-12;
  const quintic = (value) => value ** 3 * (value * (value * 6 - 15) + 10);
  const quinticFirst = (value) => 30 * value ** 2 * (value - 1) ** 2;
  const quinticSecond = (value) => 60 * value
    * (2 * value ** 2 - 3 * value + 1);
  const normalizedCoordinate = (coordinate) => {
    const nearest = Math.round(coordinate);
    return Math.abs(coordinate - nearest) < boundaryEpsilon
      ? nearest
      : coordinate;
  };
  const stateAtCycleCoordinate = (rawCoordinate) => {
    const cycleCoordinate = normalizedCoordinate(rawCoordinate);
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const lifting = cyclePhase < 0.5;
    const localCoordinate = lifting
      ? cyclePhase * 2
      : (cyclePhase - 0.5) * 2;
    const progress = quintic(localCoordinate);
    const localRate = 2 * cyclesPerSecond;
    const progressRate = quinticFirst(localCoordinate) * localRate;
    const progressAcceleration = quinticSecond(localCoordinate)
      * localRate ** 2;
    const pawlAngle = lifting
      ? inputSwing * progress
      : inputSwing * (1 - progress);
    const pawlAngularSpeed = lifting
      ? inputSwing * progressRate
      : -inputSwing * progressRate;
    const pawlAngularAcceleration = lifting
      ? inputSwing * progressAcceleration
      : -inputSwing * progressAcceleration;
    const hookGeometry = hookGeometryAtPawlAngle(pawlAngle);
    let wheelAngle = -cycleIndex * toothPitch;
    let wheelAngularSpeed = 0;
    let wheelAngularAcceleration = 0;
    if (!lifting) {
      wheelAngle += hookGeometry.hookPolarAngle
        - liftedHookGeometry.hookPolarAngle;
      wheelAngularSpeed = hookGeometry.hookPolarDerivative
        * pawlAngularSpeed;
      wheelAngularAcceleration = hookGeometry.hookPolarSecondDerivative
          * pawlAngularSpeed ** 2
        + hookGeometry.hookPolarDerivative * pawlAngularAcceleration;
    }
    const shortDirection = new THREE.Vector2(
      Math.cos(pawlAngle),
      Math.sin(pawlAngle),
    );
    const shortTangent = new THREE.Vector2(
      -shortDirection.y,
      shortDirection.x,
    );
    const inputCouplerPivot = shortDirection.clone().multiplyScalar(
      shortLinkLength,
    );
    const pawlCouplerPivot = inputCouplerPivot.clone().add(
      upperGroundPivot,
    );
    const couplerVelocity = shortTangent.clone().multiplyScalar(
      shortLinkLength * pawlAngularSpeed,
    );
    const couplerAcceleration = shortTangent.clone().multiplyScalar(
      shortLinkLength * pawlAngularAcceleration,
    ).addScaledVector(
      shortDirection,
      -shortLinkLength * pawlAngularSpeed ** 2,
    );
    const clickAngle = lifting
      ? retainingRestAngle
      : retainingRestAngle
        + retainingLift * Math.sin(Math.PI * progress);
    const clickAngularSpeed = lifting
      ? 0
      : retainingLift * Math.PI * Math.cos(Math.PI * progress)
        * progressRate;
    const clickAngularAcceleration = lifting
      ? 0
      : retainingLift * (
        -(Math.PI ** 2) * Math.sin(Math.PI * progress) * progressRate ** 2
        + Math.PI * Math.cos(Math.PI * progress) * progressAcceleration
      );
    const retainingNosePoint = retainingPivot.clone().add(
      new THREE.Vector2(
        Math.cos(clickAngle) * retainingLength,
        Math.sin(clickAngle) * retainingLength,
      ),
    );
    const contactSurface = contactSurfaceAtPawlAngle(pawlAngle);
    const activeGapIndex = lifting ? cycleIndex : cycleIndex + 1;
    const activeCornerLocalAngle = gapMountPhase
      + activeGapIndex * toothPitch - gapHalfAngle;
    const activeCornerWorldAngle = activeCornerLocalAngle + wheelAngle;
    const wheelContactPoint = new THREE.Vector2(
      Math.cos(activeCornerWorldAngle) * wheelOuterRadius,
      Math.sin(activeCornerWorldAngle) * wheelOuterRadius,
    );
    let contact = null;
    if (!lifting) {
      const contactPoint = contactSurface.contactPoint;
      const pawlRadiusVector = contactPoint.clone().sub(upperGroundPivot);
      const pawlSurfaceVelocity = new THREE.Vector2(
        -pawlRadiusVector.y * pawlAngularSpeed,
        pawlRadiusVector.x * pawlAngularSpeed,
      );
      const wheelSurfaceVelocity = new THREE.Vector2(
        -contactPoint.y * wheelAngularSpeed,
        contactPoint.x * wheelAngularSpeed,
      );
      const surfaceTangent = rotateVector(
        contactSurface.contactLocalDerivative,
        pawlAngle,
      ).normalize();
      const surfaceNormal = new THREE.Vector2(
        -surfaceTangent.y,
        surfaceTangent.x,
      );
      const relativeSurfaceVelocity = wheelSurfaceVelocity.clone().sub(
        pawlSurfaceVelocity,
      );
      contact = {
        activeGapIndex: THREE.MathUtils.euclideanModulo(
          activeGapIndex,
          toothCount,
        ),
        activeToothCornerLocalAngle: activeCornerLocalAngle,
        normalVelocityError: Math.abs(
          relativeSurfaceVelocity.dot(surfaceNormal),
        ),
        pawlPoint: contactPoint,
        pawlSurfaceVelocity,
        positionError: contactPoint.distanceTo(wheelContactPoint),
        slidingSpeed: Math.abs(relativeSurfaceVelocity.dot(surfaceTangent)),
        surfaceNormal,
        surfaceTangent,
        wheelPoint: wheelContactPoint,
        wheelSurfaceVelocity,
      };
    }
    return {
      activeGapIndex: THREE.MathUtils.euclideanModulo(
        activeGapIndex,
        toothCount,
      ),
      clickAngle,
      clickAngularAcceleration,
      clickAngularSpeed,
      contact,
      couplerAcceleration,
      couplerAngle: Math.PI / 2,
      couplerAngularSpeed: 0,
      couplerLengthError: pawlCouplerPivot.distanceTo(inputCouplerPivot)
        - groundLength,
      couplerVelocity,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      driving: !lifting,
      fourBarClosureError: pawlCouplerPivot.clone()
        .sub(inputCouplerPivot)
        .distanceTo(upperGroundPivot),
      hookPoint: hookGeometry.hookPoint,
      hookPolarAngle: hookGeometry.hookPolarAngle,
      hookRadius: hookGeometry.hookRadius,
      inputAngle: pawlAngle,
      inputAngularAcceleration: pawlAngularAcceleration,
      inputAngularSpeed: pawlAngularSpeed,
      inputCouplerPivot,
      inputShortLinkLengthError: inputCouplerPivot.length()
        - shortLinkLength,
      lifting,
      outputShortLinkLengthError: pawlCouplerPivot.distanceTo(
        upperGroundPivot,
      ) - shortLinkLength,
      pawlAngle,
      pawlAngularAcceleration,
      pawlAngularSpeed,
      pawlCouplerPivot,
      pawlLiftClearance: hookGeometry.hookRadius - sourceHookRadius,
      progress,
      retainingClickEngaged: lifting || progress <= 1e-12
        || progress >= 1 - 1e-12,
      retainingNosePoint,
      retainingNoseRadialLift: retainingNosePoint.length()
        - retainingNoseAtRest.length(),
      stage: lifting
        ? 'arm-B-lift-pawl-C-backward-wheel-held-by-click'
        : 'arm-B-lower-pawl-C-draws-one-tooth-click-rides-over',
      teethAdvanced: -wheelAngle / toothPitch,
      wheelAngle,
      wheelAngularAcceleration,
      wheelAngularSpeed,
      wheelDwelling: lifting,
    };
  };
  const stateAtTime = (time) => stateAtCycleCoordinate(
    time * cyclesPerSecond,
  );

  const sourceState = stateAtCycleCoordinate(0);
  const liftedState = stateAtCycleCoordinate(0.5);
  const cycleState = stateAtCycleCoordinate(1);
  root.userData.archetype =
    'parallelogram-lift-and-draw-pawl-ratchet-with-retaining-click';
  root.userData.blocks = {
    contactMarker,
    coupler,
    frameMountBolt,
    framePlate,
    inputCouplerPin,
    inputIndex,
    inputLever,
    inputLeverBody,
    outputShaft,
    pawl,
    pawlBody,
    pawlCouplerPin,
    pawlIndex,
    retainingBody,
    retainingClick,
    retainingNose,
    retainingPivotPin,
    upperPivotPin,
    wheel,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.35, -2.35, -0.75),
    new THREE.Vector3(3.55, 3.65, 1.05),
  );
  root.userData.canonicalTimes = {
    cycleClosure: cyclePeriod,
    driveMidpoint: cyclePeriod * 0.75,
    liftedReversal: cyclePeriod * 0.5,
    sourcePose: 0,
  };
  root.userData.contactSurfaceAtPawlAngle = contactSurfaceAtPawlAngle;
  root.userData.geometry = {
    axialLayers: {
      coupler: { center: 0.66, depth: 0.12 },
      frameA: { center: 0.34, depth: 0.14 },
      inputB: { center: 0.5, depth: 0.14 },
      pawlC: { center: 0.14, depth: 0.16 },
      retainingClick: { center: 0.235, depth: 0.12 },
      wheel: { center: 0, depth: 0.38 },
    },
    cyclePeriod,
    cyclesPerSecond,
    gapHalfAngle,
    gapMountPhase,
    groundLength,
    inputSwing,
    liftedHookPolarAngle: liftedHookGeometry.hookPolarAngle,
    liftedHookRadius: liftedHookGeometry.hookRadius,
    pawlSurfaceSamples,
    retainingLength,
    retainingLift,
    retainingNoseAtRest,
    retainingPivot,
    retainingRestAngle,
    shortLinkLength,
    sourceHookPolarAngle,
    sourceHookRadius,
    toothCount,
    toothPitch,
    upperGroundPivot,
    wheelCenter,
    wheelOuterRadius,
    wheelRootRadius,
    workingHookLocal,
  };
  root.userData.hookGeometryAtPawlAngle = hookGeometryAtPawlAngle;
  root.userData.mechanism =
    'fixed-frame-A-and-equal-opposed-links-make-B-and-C-a-parallelogram-C-lifts-backward-then-its-curved-face-draws-one-wheel-tooth-while-a-second-click-holds-return';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 232 page marks its animation unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate232: {
      frameLabel: 'A',
      inferredToothCount: toothCount,
      inputLabel: 'B',
      officialAnimationAvailable: false,
      pawlLabel: 'C',
      rasterFrameMountHole: new THREE.Vector2(307, 281),
      rasterInputCouplerPivot: new THREE.Vector2(269, 260),
      rasterPawlCouplerPivot: new THREE.Vector2(269, 58),
      rasterRetainingClickPivot: new THREE.Vector2(320, 220),
      rasterUpperGroundPivot: new THREE.Vector2(210, 52),
      rasterWheelCenter: new THREE.Vector2(208, 261),
      visibleRetainingClick: true,
    },
    primaryScan: {
      bookPage: 58,
      edition: 21,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    inputOutputDirectionOnDrive: 'lowering-B-drives-wheel-clockwise',
    inputStroke: 'vibrating-rocker-about-wheel-axis',
    outputTeethPerCycle: cycleState.teethAdvanced
      - sourceState.teethAdvanced,
    pawlBackwardTravelDegrees: THREE.MathUtils.radToDeg(
      liftedState.hookPolarAngle - sourceState.hookPolarAngle,
    ),
    returnStrokeWheelDwell: true,
    retainingClick: true,
    topology: 'equal-link-parallelogram-pawl-actuator',
  };
  root.userData.cameraDistanceScale = 0.9;

  const update = (time) => {
    const state = stateAtTime(time);
    inputLever.rotation.z = state.inputAngle;
    pawl.rotation.z = state.pawlAngle;
    retainingClick.rotation.z = state.clickAngle;
    setSpin(wheel, state.wheelAngle);
    setSpin(outputShaft, state.wheelAngle);
    coupler.userData.setEndpoints(
      new THREE.Vector3(
        state.inputCouplerPivot.x,
        state.inputCouplerPivot.y,
        0.66,
      ),
      new THREE.Vector3(
        state.pawlCouplerPivot.x,
        state.pawlCouplerPivot.y,
        0.66,
      ),
    );
    inputCouplerPin.position.set(
      state.inputCouplerPivot.x,
      state.inputCouplerPivot.y,
      0.58,
    );
    pawlCouplerPin.position.set(
      state.pawlCouplerPivot.x,
      state.pawlCouplerPivot.y,
      0.4,
    );
    contactMarker.visible = state.driving;
    if (state.contact) {
      contactMarker.position.x = state.contact.wheelPoint.x;
      contactMarker.position.y = state.contact.wheelPoint.y;
    }
    inputLever.userData.angularSpeed = state.inputAngularSpeed;
    pawl.userData.angularSpeed = state.pawlAngularSpeed;
    retainingClick.userData.angularSpeed = state.clickAngularSpeed;
    wheel.userData.angularSpeed = state.wheelAngularSpeed;
    outputShaft.userData.angularSpeed = state.wheelAngularSpeed;
    root.userData.contacts = {
      drawingPawlToothCorner: state.contact,
      retainingClick: {
        engaged: state.retainingClickEngaged,
        nosePoint: state.retainingNosePoint,
        radialLift: state.retainingNoseRadialLift,
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finishLiftDrawPawl232(finish(root, update, new THREE.Vector3(3.2, -3.5, 12.8)));
}

function rollerAndLatchStopsForLanternWheel(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const trundleCount = 14;
  const trundlePitch = fullTurn / trundleCount;
  const halfPitch = trundlePitch / 2;
  const wheelRadius = 2.4;
  const trundleOrbitRadius = 1.98;
  const trundleRadius = 0.175;
  const rollerRadius = 0.43;
  const rollerContactDistance = trundleRadius + rollerRadius;
  const rollerGapAngle = THREE.MathUtils.degToRad(116.5);
  const latchGapAngle = rollerGapAngle - 3 * trundlePitch;
  const rollerPivot = new THREE.Vector2(-3.63, 0.824);
  const latchPivot = new THREE.Vector2(4.45, 1.42);
  const rollerParkAngle = THREE.MathUtils.degToRad(15);
  const latchParkAngle = THREE.MathUtils.degToRad(-18);
  const latchLiftAmplitude = THREE.MathUtils.degToRad(4);
  const cyclePeriod = 8;
  const cyclesPerSecond = 1 / cyclePeriod;
  const driveSegments = {
    latch: { start: 0.58, end: 0.82 },
    roller: { start: 0.16, end: 0.4 },
  };

  const perpendicular = (vector) => new THREE.Vector2(-vector.y, vector.x);
  const rotate = (vector, angle) => new THREE.Vector2(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  );
  const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
  const positiveModulo = (value, modulus) => ((value % modulus) + modulus) % modulus;
  const smoother = (value) => {
    const u = THREE.MathUtils.clamp(value, 0, 1);
    return u ** 3 * (10 + u * (-15 + 6 * u));
  };
  const smootherDerivative = (value) => {
    if (value <= 0 || value >= 1) return 0;
    return 30 * value ** 2 * (1 - value) ** 2;
  };
  const smootherSecondDerivative = (value) => {
    if (value <= 0 || value >= 1) return 0;
    return 60 * value * (1 - value) * (1 - 2 * value);
  };
  const segmentState = (cyclePhase, start, end) => {
    const span = end - start;
    const u = (cyclePhase - start) / span;
    if (u <= 0) return { acceleration: 0, progress: 0, speed: 0 };
    if (u >= 1) return { acceleration: 0, progress: 1, speed: 0 };
    return {
      acceleration: smootherSecondDerivative(u) / span ** 2,
      progress: smoother(u),
      speed: smootherDerivative(u) / span,
    };
  };
  const circleIntersections = (centerA, radiusA, centerB, radiusB) => {
    const centerVector = centerB.clone().sub(centerA);
    const centerDistance = centerVector.length();
    if (
      centerDistance > radiusA + radiusB + 1e-10
      || centerDistance < Math.abs(radiusA - radiusB) - 1e-10
    ) {
      throw new RangeError('The stop geometry has no real contact configuration.');
    }
    const alongDistance = (
      radiusA ** 2 - radiusB ** 2 + centerDistance ** 2
    ) / (2 * centerDistance);
    const normalDistance = Math.sqrt(Math.max(
      0,
      radiusA ** 2 - alongDistance ** 2,
    ));
    const along = centerVector.divideScalar(centerDistance);
    const across = perpendicular(along);
    const base = centerA.clone().addScaledVector(along, alongDistance);
    return [
      base.clone().addScaledVector(across, normalDistance),
      base.clone().addScaledVector(across, -normalDistance),
    ];
  };

  const rollerRestCenterRadius = trundleOrbitRadius * Math.cos(halfPitch)
    + Math.sqrt(
      rollerContactDistance ** 2
      - (trundleOrbitRadius * Math.sin(halfPitch)) ** 2,
    );
  const rollerRestCenter = new THREE.Vector2(
    Math.cos(rollerGapAngle) * rollerRestCenterRadius,
    Math.sin(rollerGapAngle) * rollerRestCenterRadius,
  );
  const rollerArmLocal = rollerRestCenter.clone().sub(rollerPivot);
  const rollerArmLength = rollerArmLocal.length();
  const rollerRestArmAngle = Math.atan2(rollerArmLocal.y, rollerArmLocal.x);
  const rollerContactAtProgress = (progress) => {
    const pinAngle = rollerGapAngle + halfPitch - progress * trundlePitch;
    const pinCenter = new THREE.Vector2(
      Math.cos(pinAngle) * trundleOrbitRadius,
      Math.sin(pinAngle) * trundleOrbitRadius,
    );
    const candidates = circleIntersections(
      rollerPivot,
      rollerArmLength,
      pinCenter,
      rollerContactDistance,
    ).map((center) => ({
      armAngle: Math.atan2(
        center.y - rollerPivot.y,
        center.x - rollerPivot.x,
      ),
      center,
    })).map((candidate) => ({
      ...candidate,
      armDelta: normalizeAngle(candidate.armAngle - rollerRestArmAngle),
    }));
    const outward = candidates
      .filter(({ armDelta }) => armDelta >= -1e-8)
      .sort((first, second) => Math.abs(first.armDelta)
        - Math.abs(second.armDelta))[0];
    if (!outward) throw new RangeError('The roller stop cannot lift outward.');
    const rollerCenter = outward.center;
    const contactNormal = rollerCenter.clone()
      .sub(pinCenter)
      .normalize();
    const contactTangent = perpendicular(contactNormal);
    const pinContactPoint = pinCenter.clone()
      .addScaledVector(contactNormal, trundleRadius);
    const rollerContactPoint = rollerCenter.clone()
      .addScaledVector(contactNormal, -rollerRadius);
    const pinCenterDerivative = new THREE.Vector2(
      Math.sin(pinAngle) * trundleOrbitRadius * trundlePitch,
      -Math.cos(pinAngle) * trundleOrbitRadius * trundlePitch,
    );
    const rollerRadiusVector = rollerCenter.clone().sub(rollerPivot);
    const armAngleDerivative = contactNormal.dot(pinCenterDerivative)
      / contactNormal.dot(perpendicular(rollerRadiusVector));
    const rollerCenterDerivative = perpendicular(rollerRadiusVector)
      .multiplyScalar(armAngleDerivative);
    const wheelAngleDerivative = -trundlePitch;
    const wheelContactVelocity = perpendicular(pinContactPoint)
      .multiplyScalar(wheelAngleDerivative);
    const rollerSpinDerivative = (
      contactTangent.dot(rollerCenterDerivative)
      - contactTangent.dot(wheelContactVelocity)
    ) / rollerRadius;
    const rollerContactVelocity = rollerCenterDerivative.clone().add(
      perpendicular(
        rollerContactPoint.clone().sub(rollerCenter),
      ).multiplyScalar(rollerSpinDerivative),
    );
    return {
      armAngle: outward.armAngle,
      armAngleDerivative,
      armDelta: outward.armDelta,
      contactNormal,
      contactTangent,
      pinAngle,
      pinCenter,
      pinCenterDerivative,
      pinContactPoint,
      rollerCenter,
      rollerCenterDerivative,
      rollerContactPoint,
      rollerContactVelocity,
      rollerSpinDerivative,
      rollingVelocityError: rollerContactVelocity.clone()
        .sub(wheelContactVelocity),
      wheelContactVelocity,
    };
  };

  const rollerSpinSampleCount = 8192;
  const rollerSpinIntegral = new Float64Array(rollerSpinSampleCount + 1);
  let previousRollerDerivative = rollerContactAtProgress(0)
    .rollerSpinDerivative;
  for (let index = 1; index <= rollerSpinSampleCount; index += 1) {
    const progress = index / rollerSpinSampleCount;
    const derivative = rollerContactAtProgress(progress)
      .rollerSpinDerivative;
    rollerSpinIntegral[index] = rollerSpinIntegral[index - 1]
      + (previousRollerDerivative + derivative)
      / (2 * rollerSpinSampleCount);
    previousRollerDerivative = derivative;
  }
  const rollerSpinPerPitch = rollerSpinIntegral[rollerSpinSampleCount];
  const rollerSpinAtProgress = (progress) => {
    const scaled = THREE.MathUtils.clamp(progress, 0, 1)
      * rollerSpinSampleCount;
    const lower = Math.floor(scaled);
    const upper = Math.min(rollerSpinSampleCount, lower + 1);
    return THREE.MathUtils.lerp(
      rollerSpinIntegral[lower],
      rollerSpinIntegral[upper],
      scaled - lower,
    );
  };

  const latchAngleAtProgress = (progress) => (
    -latchLiftAmplitude * Math.sin(Math.PI * progress)
  );
  const latchAngleDerivativeAtProgress = (progress) => (
    -latchLiftAmplitude * Math.PI * Math.cos(Math.PI * progress)
  );
  const latchAngleSecondDerivativeAtProgress = (progress) => (
    latchLiftAmplitude * Math.PI ** 2 * Math.sin(Math.PI * progress)
  );
  const latchEnvelopeAtProgress = (progress) => {
    const pinAngle = latchGapAngle - halfPitch + progress * trundlePitch;
    const latchAngle = latchAngleAtProgress(progress);
    const latchAngleDerivative = latchAngleDerivativeAtProgress(progress);
    const pinCenter = new THREE.Vector2(
      Math.cos(pinAngle) * trundleOrbitRadius,
      Math.sin(pinAngle) * trundleOrbitRadius,
    );
    const pinCenterDerivative = new THREE.Vector2(
      -Math.sin(pinAngle) * trundleOrbitRadius * trundlePitch,
      Math.cos(pinAngle) * trundleOrbitRadius * trundlePitch,
    );
    const centerFromPivot = pinCenter.clone().sub(latchPivot);
    const localPinCenter = rotate(centerFromPivot, -latchAngle);
    const localPinCenterDerivative = rotate(
      pinCenterDerivative,
      -latchAngle,
    ).addScaledVector(
      perpendicular(localPinCenter),
      -latchAngleDerivative,
    );
    let localNormal = perpendicular(localPinCenterDerivative).normalize();
    if (localNormal.dot(localPinCenter.clone().negate()) < 0) {
      localNormal.negate();
    }
    const localContactPoint = localPinCenter.clone()
      .addScaledVector(localNormal, trundleRadius);
    const worldNormal = rotate(localNormal, latchAngle);
    const worldContactPoint = latchPivot.clone().add(
      rotate(localContactPoint, latchAngle),
    );
    const wheelContactVelocity = perpendicular(worldContactPoint)
      .multiplyScalar(trundlePitch);
    const latchContactVelocity = perpendicular(
      worldContactPoint.clone().sub(latchPivot),
    ).multiplyScalar(latchAngleDerivative);
    return {
      latchAngle,
      latchAngleDerivative,
      localContactPoint,
      localNormal,
      localPinCenter,
      localPinCenterDerivative,
      normalVelocityError: wheelContactVelocity.clone()
        .sub(latchContactVelocity)
        .dot(worldNormal),
      pinAngle,
      pinCenter,
      pinCenterDerivative,
      tangentialSlidingSpeed: wheelContactVelocity.clone()
        .sub(latchContactVelocity)
        .dot(perpendicular(worldNormal)),
      wheelContactVelocity,
      worldContactPoint,
      worldNormal,
    };
  };

  const wheel = makePlanarRotor();
  const wheelRotor = wheel.userData.rotor;
  const wheelMaterial = matte(PALETTE.driven, {
    metalness: 0.12,
    roughness: 0.63,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.25,
    roughness: 0.48,
  });
  const trundleMaterial = matte(PALETTE.brass, {
    metalness: 0.26,
    roughness: 0.48,
  });
  // Brown breaks the wheel off below with an irregular line; that is his
  // drawing convention, so the plates, rims and trundles are modelled whole.
  const rearPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.2, 80),
    wheelMaterial,
  );
  rearPlate.rotation.x = Math.PI / 2;
  rearPlate.position.z = -0.24;
  rearPlate.userData.lanternWheelRearPlate = true;
  const frontPlate = rearPlate.clone();
  frontPlate.position.z = 0.18;
  frontPlate.userData.lanternWheelFrontPlate = true;
  wheelRotor.add(rearPlate, frontPlate);
  const trundles = Array.from({ length: trundleCount }, (_, index) => {
    const mountAngle = rollerGapAngle + halfPitch + index * trundlePitch;
    const trundle = new THREE.Mesh(
      new THREE.CylinderGeometry(
        trundleRadius,
        trundleRadius,
        0.92,
        24,
      ),
      trundleMaterial,
    );
    trundle.rotation.x = Math.PI / 2;
    trundle.position.set(
      Math.cos(mountAngle) * trundleOrbitRadius,
      Math.sin(mountAngle) * trundleOrbitRadius,
      0.22,
    );
    trundle.userData.index = index;
    trundle.userData.lanternTrundle = true;
    trundle.userData.mountAngle = mountAngle;
    wheelRotor.add(trundle);
    return trundle;
  });
  const wheelHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.82, 36),
    darkMaterial,
  );
  wheelHub.rotation.x = Math.PI / 2;
  wheelHub.position.z = 0.12;
  wheelRotor.add(wheelHub);
  const wheelIndicator = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.075, 0.035),
    matte(PALETTE.white, { roughness: 0.48 }),
  );
  wheelIndicator.position.set(0.9, 0, 0.315);
  wheelIndicator.userData.rotationWitness = true;
  wheelIndicator.userData.role = 'lantern-wheel-rotation-witness';
  wheelRotor.add(wheelIndicator);
  wheel.userData.depth = 0.62;
  wheel.userData.pinCount = trundleCount;
  wheel.userData.pinMountPhase = rollerGapAngle + halfPitch;
  wheel.userData.pinOrbitRadius = trundleOrbitRadius;
  wheel.userData.pinRadius = trundleRadius;
  wheel.userData.radius = wheelRadius;
  wheel.userData.trundles = trundles;
  root.add(wheel);

  const wheelShaft = makeShaft({ length: 1.35, radius: 0.13 });
  wheelShaft.position.z = 0.04;
  root.add(wheelShaft);

  const frameMaterialZ = -0.58;
  const frameBeams = [
    makeBeam(
      new THREE.Vector3(-4.12, -2.72, frameMaterialZ),
      new THREE.Vector3(4.92, -2.72, frameMaterialZ),
      { color: PALETTE.frame, depth: 0.24, thickness: 0.22 },
    ),
    makeBeam(
      new THREE.Vector3(-4.02, -2.72, frameMaterialZ),
      new THREE.Vector3(rollerPivot.x, rollerPivot.y, frameMaterialZ),
      { color: PALETTE.frame, depth: 0.24, thickness: 0.2 },
    ),
    makeBeam(
      new THREE.Vector3(4.78, -2.72, frameMaterialZ),
      new THREE.Vector3(latchPivot.x, latchPivot.y, frameMaterialZ),
      { color: PALETTE.frame, depth: 0.24, thickness: 0.2 },
    ),
  ];
  for (const beam of frameBeams) beam.userData.role = 'lantern-stop-rear-support-frame-beam';
  root.add(...frameBeams);

  const rollerStop = new THREE.Group();
  rollerStop.position.set(rollerPivot.x, rollerPivot.y, 0);
  const rollerArm = makeBeam(
    new THREE.Vector3(0, 0, 0.61),
    new THREE.Vector3(rollerArmLocal.x, rollerArmLocal.y, 0.61),
    {
      color: PALETTE.driver,
      depth: 0.15,
      jointRadius: 0.14,
      thickness: 0.18,
    },
  );
  rollerArm.userData.rollerStopArm = true;
  rollerStop.add(rollerArm);
  const rollerWheel = new THREE.Group();
  rollerWheel.position.set(rollerArmLocal.x, rollerArmLocal.y, 0.61);
  const rollerRotor = new THREE.Group();
  rollerWheel.add(rollerRotor);
  const rollerDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(rollerRadius, rollerRadius, 0.18, 48),
    matte(PALETTE.accent, { metalness: 0.18, roughness: 0.52 }),
  );
  rollerDisk.rotation.x = Math.PI / 2;
  rollerDisk.userData.freeStopRoller = true;
  rollerRotor.add(rollerDisk);
  const rollerRim = new THREE.Mesh(
    new THREE.TorusGeometry(rollerRadius, 0.045, 9, 48),
    darkMaterial,
  );
  rollerRim.position.z = 0.1;
  // Brown's roller edge is only its outline: the ring stays (the 233 helper
  // reads the rotor's children by position) but is not drawn.
  rollerRim.visible = false;
  rollerRim.userData.retiredInkOutline = true;
  rollerRotor.add(rollerRim);
  const rollerWitness = new THREE.Mesh(
    new THREE.BoxGeometry(rollerRadius * 0.72, 0.055, 0.025),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  rollerWitness.position.set(rollerRadius * 0.42, 0, 0.115);
  rollerWitness.userData.rollerRotationWitness = true;
  rollerWitness.userData.role = 'stop-roller-rotation-witness';
  rollerRotor.add(rollerWitness);
  rollerWheel.userData.rotor = rollerRotor;
  rollerStop.add(rollerWheel);
  root.add(rollerStop);

  const latchFaceSamples = 128;
  const latchFacePoints = Array.from(
    { length: latchFaceSamples + 1 },
    (_, index) => latchEnvelopeAtProgress(index / latchFaceSamples)
      .localContactPoint,
  );
  const latchShape = new THREE.Shape();
  latchShape.moveTo(latchFacePoints[0].x, latchFacePoints[0].y);
  for (const point of latchFacePoints.slice(1)) {
    latchShape.lineTo(point.x, point.y);
  }
  const upperFace = latchFacePoints.at(-1);
  latchShape.quadraticCurveTo(
    upperFace.x + 0.18,
    upperFace.y + 0.22,
    -2.72,
    0.34,
  );
  latchShape.lineTo(-0.3, 0.3);
  latchShape.quadraticCurveTo(0.12, 0.28, 0.16, 0);
  latchShape.quadraticCurveTo(0.12, -0.26, -0.3, -0.27);
  latchShape.lineTo(latchFacePoints[0].x + 0.12, latchFacePoints[0].y - 0.03);
  latchShape.closePath();
  const latchStop = new THREE.Group();
  latchStop.position.set(latchPivot.x, latchPivot.y, 0);
  const latchBody = new THREE.Mesh(
    centeredExtrusion(latchShape, 0.16),
    matte(PALETTE.accent, { metalness: 0.12, roughness: 0.61 }),
  );
  latchBody.position.z = 0.61;
  latchBody.userData.latchStopBody = true;
  latchStop.add(latchBody);
  root.add(latchStop);

  const makePivotPin = (pivot, role) => {
    const pin = makeShaft({ length: 0.98, radius: 0.095 });
    pin.position.set(pivot.x, pivot.y, 0.22);
    pin.userData.role = role;
    root.add(pin);
    return pin;
  };
  const rollerPivotPin = makePivotPin(rollerPivot, 'roller-stop-fixed-pivot');
  const latchPivotPin = makePivotPin(latchPivot, 'latch-stop-fixed-pivot');

  const rollerRestBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.22, 0.24),
    matte(PALETTE.frame, { metalness: 0.12, roughness: 0.66 }),
  );
  rollerRestBlock.position.set(-3.38, 1.16, 0.42);
  rollerRestBlock.rotation.z = rollerRestArmAngle - 0.36;
  rollerRestBlock.userData.inwardTravelStop = true;
  const latchRestBlock = rollerRestBlock.clone();
  latchRestBlock.position.set(4.12, 1.77, 0.42);
  latchRestBlock.rotation.z = -0.22;
  rollerRestBlock.userData.role = 'roller-arm-inward-travel-stop-block';
  latchRestBlock.userData.role = 'latch-inward-travel-stop-block';
  root.add(rollerRestBlock, latchRestBlock);

  const rollerContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 16, 12),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  rollerContactMarker.position.z = 0.79;
  rollerContactMarker.userData.contactMarker = 'roller-stop-to-trundle';
  const latchContactMarker = rollerContactMarker.clone();
  latchContactMarker.userData.contactMarker = 'latch-stop-to-trundle';
  rollerContactMarker.userData.role = 'roller-stop-to-trundle-contact-marker';
  latchContactMarker.userData.role = 'latch-stop-to-trundle-contact-marker';
  root.add(rollerContactMarker, latchContactMarker);

  const stateAtCycleCoordinate = (cycleCoordinate) => {
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const rollerDrive = segmentState(
      cyclePhase,
      driveSegments.roller.start,
      driveSegments.roller.end,
    );
    const latchDrive = segmentState(
      cyclePhase,
      driveSegments.latch.start,
      driveSegments.latch.end,
    );
    const wheelAngle = trundlePitch * (
      latchDrive.progress - rollerDrive.progress
    );
    const wheelAngleDerivative = trundlePitch * (
      latchDrive.speed - rollerDrive.speed
    );
    const wheelAngleSecondDerivative = trundlePitch * (
      latchDrive.acceleration - rollerDrive.acceleration
    );
    const rollerGeometry = rollerContactAtProgress(rollerDrive.progress);
    const latchGeometry = latchEnvelopeAtProgress(latchDrive.progress);
    const rollerActive = cyclePhase >= driveSegments.roller.start
      && cyclePhase <= driveSegments.roller.end;
    const latchActive = cyclePhase >= driveSegments.latch.start
      && cyclePhase <= driveSegments.latch.end;

    let rollerLeverDelta = 0;
    let rollerLeverDerivative = 0;
    let rollerLeverSecondDerivative = 0;
    if (rollerActive) {
      rollerLeverDelta = rollerGeometry.armDelta;
      rollerLeverDerivative = rollerGeometry.armAngleDerivative
        * rollerDrive.speed;
    } else if (cyclePhase >= 0.52 && cyclePhase < 0.58) {
      const changeover = segmentState(cyclePhase, 0.52, 0.58);
      rollerLeverDelta = rollerParkAngle * changeover.progress;
      rollerLeverDerivative = rollerParkAngle * changeover.speed;
      rollerLeverSecondDerivative = rollerParkAngle * changeover.acceleration;
    } else if (cyclePhase >= 0.58 && cyclePhase < 0.88) {
      rollerLeverDelta = rollerParkAngle;
    } else if (cyclePhase >= 0.88 && cyclePhase < 0.94) {
      const changeover = segmentState(cyclePhase, 0.88, 0.94);
      rollerLeverDelta = rollerParkAngle * (1 - changeover.progress);
      rollerLeverDerivative = -rollerParkAngle * changeover.speed;
      rollerLeverSecondDerivative = -rollerParkAngle
        * changeover.acceleration;
    }

    let latchAngle = 0;
    let latchAngleDerivative = 0;
    let latchAngleSecondDerivative = 0;
    if (cyclePhase >= 0.08 && cyclePhase < 0.16) {
      const changeover = segmentState(cyclePhase, 0.08, 0.16);
      latchAngle = latchParkAngle * changeover.progress;
      latchAngleDerivative = latchParkAngle * changeover.speed;
      latchAngleSecondDerivative = latchParkAngle * changeover.acceleration;
    } else if (cyclePhase >= 0.16 && cyclePhase < 0.46) {
      latchAngle = latchParkAngle;
    } else if (cyclePhase >= 0.46 && cyclePhase < 0.52) {
      const changeover = segmentState(cyclePhase, 0.46, 0.52);
      latchAngle = latchParkAngle * (1 - changeover.progress);
      latchAngleDerivative = -latchParkAngle * changeover.speed;
      latchAngleSecondDerivative = -latchParkAngle
        * changeover.acceleration;
    } else if (latchActive) {
      latchAngle = latchGeometry.latchAngle;
      latchAngleDerivative = latchGeometry.latchAngleDerivative
        * latchDrive.speed;
      latchAngleSecondDerivative = (
        latchAngleSecondDerivativeAtProgress(latchDrive.progress)
          * latchDrive.speed ** 2
        + latchGeometry.latchAngleDerivative * latchDrive.acceleration
      );
    }

    const rollerSpinAngle = cycleIndex * rollerSpinPerPitch
      + rollerSpinAtProgress(rollerDrive.progress);
    const rollerSpinDerivative = rollerActive
      ? rollerGeometry.rollerSpinDerivative * rollerDrive.speed
      : 0;
    const rollerContact = rollerActive ? {
      centerDistanceError: rollerGeometry.rollerCenter.distanceTo(
        rollerGeometry.pinCenter,
      ) - rollerContactDistance,
      normalVelocityError: rollerGeometry.rollingVelocityError.dot(
        rollerGeometry.contactNormal,
      ) * rollerDrive.speed * cyclesPerSecond,
      pinCenter: rollerGeometry.pinCenter,
      point: rollerGeometry.pinContactPoint,
      rollerCenter: rollerGeometry.rollerCenter,
      rollerPoint: rollerGeometry.rollerContactPoint,
      rollingVelocityError: rollerGeometry.rollingVelocityError.clone()
        .multiplyScalar(rollerDrive.speed * cyclesPerSecond),
      tangentialVelocityError: rollerGeometry.rollingVelocityError.dot(
        rollerGeometry.contactTangent,
      ) * rollerDrive.speed * cyclesPerSecond,
      trundleIndex: 0,
    } : null;
    const latchContact = latchActive ? {
      normalVelocityError: latchGeometry.normalVelocityError
        * latchDrive.speed * cyclesPerSecond,
      pinCenter: latchGeometry.pinCenter,
      point: latchGeometry.worldContactPoint,
      separationError: latchGeometry.worldContactPoint.distanceTo(
        latchGeometry.pinCenter,
      ) - trundleRadius,
      tangentialSlidingSpeed: latchGeometry.tangentialSlidingSpeed
        * latchDrive.speed * cyclesPerSecond,
      trundleIndex: trundleCount - 3,
    } : null;
    const sourcePose = (
      (cyclePhase < 0.08 || cyclePhase >= 0.94)
      && Math.abs(wheelAngle) <= 1e-12
    ) || Math.abs(cyclePhase - 0.52) <= 1e-12;
    let stage = 'both-alternative-stops-seated-source-comparison';
    if (cyclePhase >= 0.08 && cyclePhase < 0.16) {
      stage = 'withdraw-latch-stop';
    } else if (rollerActive) {
      stage = 'roller-stop-yields-clockwise-and-reseats';
    } else if (cyclePhase >= 0.4 && cyclePhase < 0.52) {
      stage = 'return-latch-to-shared-source-pose';
    } else if (cyclePhase >= 0.52 && cyclePhase < 0.58) {
      stage = 'withdraw-roller-stop';
    } else if (latchActive) {
      stage = 'latch-stop-yields-counterclockwise-and-reseats';
    } else if (cyclePhase >= 0.82 && cyclePhase < 0.94) {
      stage = 'return-roller-to-shared-source-pose';
    }
    return {
      activeAlternative: rollerActive ? 'roller-stop'
        : latchActive ? 'latch-stop' : null,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      latchActive,
      latchAngle,
      latchAngularAcceleration: latchAngleSecondDerivative
        * cyclesPerSecond ** 2,
      latchAngularSpeed: latchAngleDerivative * cyclesPerSecond,
      latchContact,
      latchParked: Math.abs(latchAngle - latchParkAngle) <= 1e-9,
      latchProgress: latchDrive.progress,
      rollerActive,
      rollerContact,
      rollerLeverAngle: rollerRestArmAngle + rollerLeverDelta,
      rollerLeverAngularAcceleration: rollerLeverSecondDerivative
        * cyclesPerSecond ** 2,
      rollerLeverAngularSpeed: rollerLeverDerivative * cyclesPerSecond,
      rollerLeverDelta,
      rollerParked: Math.abs(rollerLeverDelta - rollerParkAngle) <= 1e-9,
      rollerProgress: rollerDrive.progress,
      rollerSpinAngle,
      rollerSpinAngularSpeed: rollerSpinDerivative * cyclesPerSecond,
      sourcePose,
      stage,
      wheelAngle,
      wheelAngularAcceleration: wheelAngleSecondDerivative
        * cyclesPerSecond ** 2,
      wheelAngularSpeed: wheelAngleDerivative * cyclesPerSecond,
    };
  };
  const stateAtTime = (time) => stateAtCycleCoordinate(
    time * cyclesPerSecond,
  );

  root.userData.archetype =
    'alternating-roller-and-latch-stops-for-lantern-wheel';
  root.userData.blocks = {
    frameBeams,
    latchBody,
    latchContactMarker,
    latchPivotPin,
    latchRestBlock,
    latchStop,
    rollerArm,
    rollerContactMarker,
    rollerPivotPin,
    rollerRestBlock,
    rollerStop,
    rollerWheel,
    rollerWitness,
    wheel,
    wheelIndicator,
    wheelShaft,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.3, -2.9, -0.8),
    new THREE.Vector3(5.05, 3.45, 1.05),
  );
  root.userData.canonicalTimes = {
    cycleClosure: cyclePeriod,
    latchDriveMidpoint: cyclePeriod * 0.7,
    rollerDriveMidpoint: cyclePeriod * 0.28,
    sharedSourcePose: cyclePeriod * 0.52,
    sourcePose: 0,
  };
  root.userData.geometry = {
    axialLayers: {
      frame: { center: frameMaterialZ, depth: 0.24 },
      frontPlate: { center: 0.18, depth: 0.2 },
      latchStop: { center: 0.61, depth: 0.16 },
      rollerStop: { center: 0.61, depth: 0.18 },
      trundles: { center: 0.22, length: 0.92 },
    },
    cyclePeriod,
    cyclesPerSecond,
    driveSegments,
    latchFacePoints,
    latchGapAngle,
    latchLiftAmplitude,
    latchParkAngle,
    latchPivot,
    rollerArmLength,
    rollerArmLocal,
    rollerContactDistance,
    rollerGapAngle,
    rollerParkAngle,
    rollerPivot,
    rollerRadius,
    rollerRestArmAngle,
    rollerRestCenter,
    rollerRestCenterRadius,
    rollerSpinPerPitch,
    trundleCount,
    trundleOrbitRadius,
    trundlePitch,
    trundleRadius,
    wheelRadius,
  };
  root.userData.latchEnvelopeAtProgress = latchEnvelopeAtProgress;
  root.userData.mechanism =
    'one-fourteen-trundle-lantern-wheel-compares-a-yielding-roller-gap-detent-with-a-positive-latch-stop-in-separate-demonstration-phases';
  root.userData.rollerContactAtProgress = rollerContactAtProgress;
  root.userData.rollerSpinAtProgress = rollerSpinAtProgress;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 233 page marks its animation unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    corroboratingClassification: {
      caption: 'Roller stop and latch stop for lantern wheel.',
      publication: 'Pictorial Handbook of Technical Devices',
      publicationYear: 1971,
      section: 'Machine Technology / Gearing / Pawls and Ratchets',
    },
    officialDescription: movement.description,
    plate233: {
      inferredTrundleCount: trundleCount,
      officialAnimationAvailable: false,
      rasterImageHeight: 525,
      rasterImageWidth: 525,
      rasterLatchNose: new THREE.Vector2(303, 240),
      rasterLatchPivot: new THREE.Vector2(490, 220),
      rasterRollerCenter: new THREE.Vector2(177, 183),
      rasterRollerPivot: new THREE.Vector2(29, 254),
      rasterWheelCenter: new THREE.Vector2(236, 301),
      sharedWheelAlternativeStops: true,
    },
    primaryScan: {
      bookPage: 58,
      edition: 21,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    alternativesSimultaneouslyLoaded: false,
    latchDemonstrationDirection: 'counterclockwise-one-trundle-pitch',
    latchType: 'positive-faced-pivoted-stop',
    rollerDemonstrationDirection: 'clockwise-one-trundle-pitch',
    rollerType: 'freely-rolling-gap-detent',
    trundlesPerDemonstrationStroke: 1,
    wheelReturnsToSourceAngleEachCycle: true,
  };
  root.userData.cameraDistanceScale = 0.9;

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(wheel, state.wheelAngle);
    setSpin(wheelShaft, state.wheelAngle);
    rollerStop.rotation.z = state.rollerLeverDelta;
    rollerRotor.rotation.z = state.rollerSpinAngle - state.rollerLeverDelta;
    latchStop.rotation.z = state.latchAngle;
    rollerContactMarker.visible = state.rollerContact !== null;
    latchContactMarker.visible = state.latchContact !== null;
    if (state.rollerContact) {
      rollerContactMarker.position.x = state.rollerContact.point.x;
      rollerContactMarker.position.y = state.rollerContact.point.y;
    }
    if (state.latchContact) {
      latchContactMarker.position.x = state.latchContact.point.x;
      latchContactMarker.position.y = state.latchContact.point.y;
    }
    wheel.userData.angularSpeed = state.wheelAngularSpeed;
    wheelShaft.userData.angularSpeed = state.wheelAngularSpeed;
    rollerStop.userData.angularSpeed = state.rollerLeverAngularSpeed;
    rollerWheel.userData.angularSpeed = state.rollerSpinAngularSpeed;
    latchStop.userData.angularSpeed = state.latchAngularSpeed;
    root.userData.contacts = {
      latchStopToTrundle: state.latchContact,
      rollerStopToTrundle: state.rollerContact,
    };
    root.userData.kinematics = state;
  };
  installLanternStop233(root, latchShape, update);
  return finish(root, update, new THREE.Vector3(0.4, 0.2, 15));
}

function springTappetArmStarRatchet(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const toothCount = 6;
  const toothPitch = fullTurn / toothCount;
  const sourceScale = 0.016;
  const sourceWheelCenter = new THREE.Vector2(168, 235);
  const sourceCarrierPivot = new THREE.Vector2(455, 338);
  const sourceTappetHinge = new THREE.Vector2(319, 331);
  const sourceTappetNose = new THREE.Vector2(192, 303);
  const sourceHoldingClickPivot = new THREE.Vector2(159, 153);
  const sourceToModel = (point) => new THREE.Vector2(
    (point.x - sourceWheelCenter.x) * sourceScale,
    (sourceWheelCenter.y - point.y) * sourceScale,
  );
  const carrierPivot = sourceToModel(sourceCarrierPivot);
  const sourceHinge = sourceToModel(sourceTappetHinge);
  const sourceNoseCenter = sourceToModel(sourceTappetNose);
  const holdingClickPivot = sourceToModel(sourceHoldingClickPivot);
  const carrierLength = carrierPivot.distanceTo(sourceHinge);
  const tappetLength = sourceHinge.distanceTo(sourceNoseCenter);
  const sourceCarrierAngle = Math.atan2(
    sourceHinge.y - carrierPivot.y,
    sourceHinge.x - carrierPivot.x,
  );
  const sourceTappetAngle = Math.atan2(
    sourceNoseCenter.y - sourceHinge.y,
    sourceNoseCenter.x - sourceHinge.x,
  );
  const tappetRestRelativeAngle = sourceTappetAngle - sourceCarrierAngle;
  const rotateVector = (vector, angle) => new THREE.Vector2(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  );
  const cross2 = (first, second) => (
    first.x * second.y - first.y * second.x
  );

  const ratchetOuterRadius = 1.22;
  const ratchetRootRadius = 0.5;
  // The star is as thick as the tappet hook and the holding click that bear
  // on it in its own plane.
  const ratchetDepth = 0.22;
  const starPlaneZ = 0.5;
  const tappetNoseRadius = 0.07;
  const driveFaceAngularSpan = THREE.MathUtils.degToRad(35);
  const sharpTipPhase = 1 - driveFaceAngularSpan / toothPitch;
  const baseDriveFaceOuter = new THREE.Vector2(ratchetOuterRadius, 0);
  const baseDriveFaceRoot = new THREE.Vector2(
    Math.cos(driveFaceAngularSpan - toothPitch) * ratchetRootRadius,
    Math.sin(driveFaceAngularSpan - toothPitch) * ratchetRootRadius,
  );
  const baseDriveFaceVector = baseDriveFaceRoot.clone().sub(
    baseDriveFaceOuter,
  );
  const baseDriveFaceTangent = baseDriveFaceVector.clone().normalize();
  const baseDriveFaceNormal = new THREE.Vector2(
    -baseDriveFaceTangent.y,
    baseDriveFaceTangent.x,
  );
  const baseNoseCenterOuter = baseDriveFaceOuter.clone().addScaledVector(
    baseDriveFaceNormal,
    tappetNoseRadius,
  );
  const sourceNoseRadius = sourceNoseCenter.length();
  const faceQuadraticA = baseDriveFaceVector.lengthSq();
  const faceQuadraticB = 2 * baseNoseCenterOuter.dot(
    baseDriveFaceVector,
  );
  const sourceFaceQuadraticC = baseNoseCenterOuter.lengthSq()
    - sourceNoseRadius ** 2;
  const sourceFaceDiscriminant = faceQuadraticB ** 2
    - 4 * faceQuadraticA * sourceFaceQuadraticC;
  const sourceContactFraction = (
    -faceQuadraticB - Math.sqrt(sourceFaceDiscriminant)
  ) / (2 * faceQuadraticA);
  const sourceCenterLinePoint = baseNoseCenterOuter.clone().addScaledVector(
    baseDriveFaceVector,
    sourceContactFraction,
  );
  const driveFaceWorldPhase = Math.atan2(
    sourceNoseCenter.y,
    sourceNoseCenter.x,
  ) - Math.atan2(sourceCenterLinePoint.y, sourceCenterLinePoint.x);
  const ratchetMountPhase = driveFaceWorldPhase
    - sharpTipPhase * toothPitch;

  const carrierHingeAt = (carrierAngle) => new THREE.Vector2(
    carrierPivot.x + carrierLength * Math.cos(carrierAngle),
    carrierPivot.y + carrierLength * Math.sin(carrierAngle),
  );
  const tappetNoseCenterAt = (carrierAngle, tappetDelta = 0) => {
    const hinge = carrierHingeAt(carrierAngle);
    const tappetAngle = carrierAngle
      + tappetRestRelativeAngle + tappetDelta;
    return hinge.add(new THREE.Vector2(
      tappetLength * Math.cos(tappetAngle),
      tappetLength * Math.sin(tappetAngle),
    ));
  };
  const tappetNoseDerivativeAt = (carrierAngle, tappetDelta = 0) => {
    const tappetAngle = carrierAngle
      + tappetRestRelativeAngle + tappetDelta;
    return new THREE.Vector2(
      -carrierLength * Math.sin(carrierAngle)
        - tappetLength * Math.sin(tappetAngle),
      carrierLength * Math.cos(carrierAngle)
        + tappetLength * Math.cos(tappetAngle),
    );
  };
  const driveContactAtCarrierAngle = (carrierAngle) => {
    const noseCenter = tappetNoseCenterAt(carrierAngle);
    const noseCenterDerivative = tappetNoseDerivativeAt(carrierAngle);
    const noseRadius = noseCenter.length();
    const quadraticC = baseNoseCenterOuter.lengthSq() - noseRadius ** 2;
    const discriminant = Math.max(
      0,
      faceQuadraticB ** 2 - 4 * faceQuadraticA * quadraticC,
    );
    const contactRoots = [
      (-faceQuadraticB - Math.sqrt(discriminant))
        / (2 * faceQuadraticA),
      (-faceQuadraticB + Math.sqrt(discriminant))
        / (2 * faceQuadraticA),
    ].filter((fraction) => fraction >= -1e-10 && fraction <= 1 + 1e-10);
    if (contactRoots.length === 0) {
      throw new RangeError('The tappet nose cannot reach the ratchet drive face.');
    }
    const contactFraction = Math.min(...contactRoots);
    const centerLinePoint = baseNoseCenterOuter.clone().addScaledVector(
      baseDriveFaceVector,
      contactFraction,
    );
    let wheelTravel = Math.atan2(noseCenter.y, noseCenter.x)
      - driveFaceWorldPhase
      - Math.atan2(centerLinePoint.y, centerLinePoint.x);
    while (wheelTravel < -1e-10) wheelTravel += fullTurn;
    while (wheelTravel >= fullTurn - 1e-10) wheelTravel -= fullTurn;
    const contactFractionDerivative = noseCenter.dot(noseCenterDerivative)
      / centerLinePoint.dot(baseDriveFaceVector);
    const nosePolarDerivative = cross2(
      noseCenter,
      noseCenterDerivative,
    ) / noseCenter.lengthSq();
    const facePolarDerivative = cross2(
      centerLinePoint,
      baseDriveFaceVector,
    ) / centerLinePoint.lengthSq() * contactFractionDerivative;
    const wheelDerivative = nosePolarDerivative - facePolarDerivative;
    return {
      centerLinePoint,
      contactFraction,
      contactFractionDerivative,
      noseCenter,
      noseCenterDerivative,
      wheelDerivative,
      wheelTravel,
    };
  };

  let driveSwingLow = 0;
  let driveSwingHigh = THREE.MathUtils.degToRad(22);
  for (let iteration = 0; iteration < 72; iteration += 1) {
    const driveSwingMiddle = (driveSwingLow + driveSwingHigh) / 2;
    const contact = driveContactAtCarrierAngle(
      sourceCarrierAngle - driveSwingMiddle,
    );
    if (contact.wheelTravel < toothPitch) {
      driveSwingLow = driveSwingMiddle;
    } else {
      driveSwingHigh = driveSwingMiddle;
    }
  }
  const driveCarrierSwing = (driveSwingLow + driveSwingHigh) / 2;
  const driveCarrierEndAngle = sourceCarrierAngle - driveCarrierSwing;
  const highCarrierAngle = driveCarrierEndAngle;
  const returnContactReleaseAngle = sourceCarrierAngle
    + THREE.MathUtils.degToRad(12);
  const lowCarrierAngle = sourceCarrierAngle
    + THREE.MathUtils.degToRad(15);

  const ratchet = makeSpringIndexedRatchet({
    boreRadius: 0.17,
    depth: ratchetDepth,
    mountPhase: ratchetMountPhase,
    outerRadius: ratchetOuterRadius,
    rootRadius: ratchetRootRadius,
    teeth: toothCount,
    toothOuterEndPhase: sharpTipPhase,
    toothOuterStartPhase: sharpTipPhase,
  });
  ratchet.userData.role = 'six-point-counterclockwise-star-ratchet-wheel';
  ratchet.userData.body.userData.role = 'source-six-point-star-ratchet-body';
  ratchet.userData.indicator.userData.role = 'ratchet-wheel-face-index';
  ratchet.position.z = starPlaneZ;
  root.add(ratchet);
  const ratchetShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 0.94,
    radius: 0.1,
  });
  ratchetShaft.position.z = starPlaneZ - 0.02;
  ratchetShaft.userData.role = 'fixed-axis-intermittent-output-shaft';
  root.add(ratchetShaft);

  const profilePoints = ratchet.userData.profilePoints;
  const pointInsideRatchet = (point) => {
    let inside = false;
    for (
      let index = 0, previousIndex = profilePoints.length - 1;
      index < profilePoints.length;
      previousIndex = index, index += 1
    ) {
      const current = profilePoints[index];
      const previous = profilePoints[previousIndex];
      if (
        (current.y > point.y) !== (previous.y > point.y)
        && point.x < (previous.x - current.x)
          * (point.y - current.y) / (previous.y - current.y) + current.x
      ) inside = !inside;
    }
    return inside;
  };
  const closestRatchetProfilePoint = (point) => {
    let distance = Infinity;
    let pointOnProfile = null;
    let segmentFraction = 0;
    let segmentIndex = -1;
    for (let index = 0; index < profilePoints.length; index += 1) {
      const start = profilePoints[index];
      const end = profilePoints[(index + 1) % profilePoints.length];
      const edge = end.clone().sub(start);
      const denominator = edge.lengthSq();
      if (denominator < 1e-18) continue;
      const fraction = THREE.MathUtils.clamp(
        point.clone().sub(start).dot(edge) / denominator,
        0,
        1,
      );
      const candidate = start.clone().addScaledVector(edge, fraction);
      const candidateDistance = point.distanceTo(candidate);
      if (candidateDistance < distance) {
        distance = candidateDistance;
        pointOnProfile = candidate;
        segmentFraction = fraction;
        segmentIndex = index;
      }
    }
    return {
      distance,
      point: pointOnProfile,
      segmentFraction,
      segmentIndex,
    };
  };
  const profileClearanceAt = (center, padRadius, wheelAngle) => {
    const centerLocal = rotateVector(center, -wheelAngle);
    const closest = closestRatchetProfilePoint(centerLocal);
    const inside = pointInsideRatchet(centerLocal);
    const signedDistance = inside ? -closest.distance : closest.distance;
    const profilePoint = rotateVector(closest.point, wheelAngle);
    const normal = center.clone().sub(profilePoint).normalize();
    const padPoint = center.clone().addScaledVector(normal, -padRadius);
    return {
      center,
      centerLocal,
      clearance: signedDistance - padRadius,
      contactError: padPoint.distanceTo(profilePoint),
      inside,
      normal,
      padPoint,
      profilePoint,
      segmentFraction: closest.segmentFraction,
      segmentIndex: closest.segmentIndex,
    };
  };
  const returnClearanceAt = (carrierAngle, tappetDelta) => (
    profileClearanceAt(
      tappetNoseCenterAt(carrierAngle, tappetDelta),
      tappetNoseRadius,
      toothPitch,
    )
  );
  const returnContactAtCarrierAngle = (carrierAngle) => {
    const minimumDelta = THREE.MathUtils.degToRad(-72);
    const sampleCount = 96;
    let lowerDelta = minimumDelta;
    let lowerClearance = returnClearanceAt(
      carrierAngle,
      lowerDelta,
    ).clearance;
    for (let sample = 1; sample <= sampleCount; sample += 1) {
      const upperDelta = THREE.MathUtils.lerp(
        minimumDelta,
        0,
        sample / sampleCount,
      );
      const upperClearance = returnClearanceAt(
        carrierAngle,
        upperDelta,
      ).clearance;
      if (lowerClearance >= 0 && upperClearance <= 0) {
        let outsideDelta = lowerDelta;
        let insideDelta = upperDelta;
        for (let iteration = 0; iteration < 58; iteration += 1) {
          const middleDelta = (outsideDelta + insideDelta) / 2;
          if (
            returnClearanceAt(carrierAngle, middleDelta).clearance >= 0
          ) outsideDelta = middleDelta;
          else insideDelta = middleDelta;
        }
        const tappetDelta = (outsideDelta + insideDelta) / 2;
        return {
          ...returnClearanceAt(carrierAngle, tappetDelta),
          engaged: true,
          tappetDelta,
        };
      }
      lowerDelta = upperDelta;
      lowerClearance = upperClearance;
    }
    return {
      ...returnClearanceAt(carrierAngle, 0),
      engaged: false,
      tappetDelta: 0,
    };
  };
  const releaseContact = returnContactAtCarrierAngle(
    returnContactReleaseAngle,
  );
  if (!releaseContact.engaged) {
    throw new RangeError('The returning tappet does not reach the next tooth.');
  }
  const returnReleaseDelta = releaseContact.tappetDelta;
  const tipClearDeltaSlope = -2;
  const tipClearDeltaAt = (carrierAngle) => returnReleaseDelta
    + tipClearDeltaSlope
      * (carrierAngle - returnContactReleaseAngle);
  const lowCarrierTappetDelta = tipClearDeltaAt(lowCarrierAngle);
  const approachReliefDelta = THREE.MathUtils.degToRad(-5);

  const holdingClickRadius = 0.055;
  const holdingFaceIndex = 4;
  const holdingFaceFraction = 0.55;
  const holdingFaceRoot = profilePoints[holdingFaceIndex * 3];
  const holdingFaceTip = profilePoints[holdingFaceIndex * 3 + 1];
  const holdingFaceVector = holdingFaceTip.clone().sub(holdingFaceRoot);
  const holdingFaceTangent = holdingFaceVector.clone().normalize();
  const holdingFaceNormal = new THREE.Vector2(
    holdingFaceTangent.y,
    -holdingFaceTangent.x,
  );
  const holdingFacePoint = holdingFaceRoot.clone().lerp(
    holdingFaceTip,
    holdingFaceFraction,
  );
  const holdingClickRestCenter = holdingFacePoint.clone().addScaledVector(
    holdingFaceNormal,
    holdingClickRadius,
  );
  const holdingClickLength = holdingClickPivot.distanceTo(
    holdingClickRestCenter,
  );
  const holdingClickRestAngle = Math.atan2(
    holdingClickRestCenter.y - holdingClickPivot.y,
    holdingClickRestCenter.x - holdingClickPivot.x,
  );
  const holdingClickCenterAt = (clickDelta) => new THREE.Vector2(
    holdingClickPivot.x
      + holdingClickLength * Math.cos(holdingClickRestAngle + clickDelta),
    holdingClickPivot.y
      + holdingClickLength * Math.sin(holdingClickRestAngle + clickDelta),
  );
  const holdingClickStateAtWheelAngle = (wheelAngle) => {
    const restContact = profileClearanceAt(
      holdingClickCenterAt(0),
      holdingClickRadius,
      wheelAngle,
    );
    if (restContact.clearance >= -1e-10) {
      return {
        ...restContact,
        clickDelta: 0,
        deflected: false,
        engaged: Math.abs(restContact.clearance) < 1e-8,
      };
    }
    let insideDelta = 0;
    let outsideDelta = THREE.MathUtils.degToRad(-45);
    if (
      profileClearanceAt(
        holdingClickCenterAt(outsideDelta),
        holdingClickRadius,
        wheelAngle,
      ).clearance < 0
    ) {
      throw new RangeError('The holding click cannot clear the passing tooth.');
    }
    for (let iteration = 0; iteration < 58; iteration += 1) {
      const middleDelta = (insideDelta + outsideDelta) / 2;
      if (
        profileClearanceAt(
          holdingClickCenterAt(middleDelta),
          holdingClickRadius,
          wheelAngle,
        ).clearance < 0
      ) insideDelta = middleDelta;
      else outsideDelta = middleDelta;
    }
    const clickDelta = (insideDelta + outsideDelta) / 2;
    return {
      ...profileClearanceAt(
        holdingClickCenterAt(clickDelta),
        holdingClickRadius,
        wheelAngle,
      ),
      clickDelta,
      deflected: true,
      engaged: true,
    };
  };

  const cyclePeriod = 4;
  const cyclesPerSecond = 1 / cyclePeriod;
  const driveEndPhase = 0.24;
  const topOvertravelEndPhase = 0.36;
  const clearReturnEndPhase = 0.46;
  const returnContactEndPhase = 0.72;
  const tipClearEndPhase = 0.76;
  const springReleaseEndPhase = 0.84;
  const boundaryEpsilon = 1e-12;
  const quintic = (value) => value ** 3 * (value * (value * 6 - 15) + 10);
  const quinticFirst = (value) => 30 * value ** 2 * (value - 1) ** 2;
  const normalizedCoordinate = (coordinate) => {
    const nearest = Math.round(coordinate);
    return Math.abs(coordinate - nearest) < boundaryEpsilon
      ? nearest
      : coordinate;
  };
  const segmentMotion = (phase, start, end) => {
    const local = THREE.MathUtils.clamp((phase - start) / (end - start), 0, 1);
    return {
      local,
      progress: quintic(local),
      progressRate: quinticFirst(local) * cyclesPerSecond / (end - start),
    };
  };
  const returnDeltaDerivativeAt = (carrierAngle) => {
    const epsilon = 2e-6;
    const lowerAngle = Math.max(driveCarrierEndAngle, carrierAngle - epsilon);
    const upperAngle = Math.min(
      returnContactReleaseAngle,
      carrierAngle + epsilon,
    );
    if (upperAngle - lowerAngle < 1e-12) return 0;
    return (
      returnContactAtCarrierAngle(upperAngle).tappetDelta
      - returnContactAtCarrierAngle(lowerAngle).tappetDelta
    ) / (upperAngle - lowerAngle);
  };
  const clickDeltaDerivativeAt = (wheelAngle) => {
    const epsilon = 2e-6;
    return (
      holdingClickStateAtWheelAngle(wheelAngle + epsilon).clickDelta
      - holdingClickStateAtWheelAngle(wheelAngle - epsilon).clickDelta
    ) / (2 * epsilon);
  };
  const nominalStateAtCycleCoordinate = (rawCoordinate) => {
    const cycleCoordinate = normalizedCoordinate(rawCoordinate);
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    let carrierAngle;
    let carrierAngularSpeed;
    let stage;
    let tappetDelta = 0;
    let tappetDeltaSpeed = 0;
    let wheelAngle;
    let wheelAngularSpeed = 0;
    let driveContact = null;
    let returnContact = null;
    if (cyclePhase < driveEndPhase) {
      stage = 'spring-held-tappet-driving-one-tooth';
      const motion = segmentMotion(cyclePhase, 0, driveEndPhase);
      carrierAngle = THREE.MathUtils.lerp(
        sourceCarrierAngle,
        driveCarrierEndAngle,
        motion.progress,
      );
      carrierAngularSpeed = (
        driveCarrierEndAngle - sourceCarrierAngle
      ) * motion.progressRate;
      const contactGeometry = driveContactAtCarrierAngle(carrierAngle);
      wheelAngle = cycleIndex * toothPitch + contactGeometry.wheelTravel;
      wheelAngularSpeed = contactGeometry.wheelDerivative
        * carrierAngularSpeed;
      const activeToothIndex = THREE.MathUtils.euclideanModulo(
        -cycleIndex,
        toothCount,
      );
      const activeFaceAngle = driveFaceWorldPhase
        - cycleIndex * toothPitch;
      const ratchetContactLocal = rotateVector(
        baseDriveFaceOuter.clone().addScaledVector(
          baseDriveFaceVector,
          contactGeometry.contactFraction,
        ),
        activeFaceAngle,
      );
      const ratchetContactPoint = rotateVector(
        ratchetContactLocal,
        wheelAngle,
      );
      const contactNormal = rotateVector(
        baseDriveFaceNormal,
        activeFaceAngle + wheelAngle,
      );
      const tappetContactPoint = contactGeometry.noseCenter.clone()
        .addScaledVector(contactNormal, -tappetNoseRadius);
      const hinge = carrierHingeAt(carrierAngle);
      const hingeRadius = hinge.clone().sub(carrierPivot);
      const hingeVelocity = new THREE.Vector2(
        -hingeRadius.y * carrierAngularSpeed,
        hingeRadius.x * carrierAngularSpeed,
      );
      const tappetContactRadius = tappetContactPoint.clone().sub(hinge);
      const tappetSurfaceVelocity = hingeVelocity.add(new THREE.Vector2(
        -tappetContactRadius.y * carrierAngularSpeed,
        tappetContactRadius.x * carrierAngularSpeed,
      ));
      const ratchetSurfaceVelocity = new THREE.Vector2(
        -ratchetContactPoint.y * wheelAngularSpeed,
        ratchetContactPoint.x * wheelAngularSpeed,
      );
      const relativeSurfaceVelocity = tappetSurfaceVelocity.clone().sub(
        ratchetSurfaceVelocity,
      );
      driveContact = {
        activeToothIndex,
        contactError: tappetContactPoint.distanceTo(ratchetContactPoint),
        contactFraction: contactGeometry.contactFraction,
        normal: contactNormal,
        normalVelocityError: Math.abs(
          relativeSurfaceVelocity.dot(contactNormal),
        ),
        point: ratchetContactPoint,
        ratchetSurfaceVelocity,
        slidingSpeed: Math.abs(
          relativeSurfaceVelocity.dot(rotateVector(contactNormal, Math.PI / 2)),
        ),
        tappetPoint: tappetContactPoint,
        tappetSurfaceVelocity,
      };
    } else if (cyclePhase < topOvertravelEndPhase) {
      stage = 'arm-rising-clear-after-index';
      const motion = segmentMotion(
        cyclePhase,
        driveEndPhase,
        topOvertravelEndPhase,
      );
      carrierAngle = THREE.MathUtils.lerp(
        driveCarrierEndAngle,
        highCarrierAngle,
        motion.progress,
      );
      carrierAngularSpeed = (
        highCarrierAngle - driveCarrierEndAngle
      ) * motion.progressRate;
      wheelAngle = (cycleIndex + 1) * toothPitch;
    } else if (cyclePhase < clearReturnEndPhase) {
      stage = 'arm-returning-clear-to-next-tooth';
      const motion = segmentMotion(
        cyclePhase,
        topOvertravelEndPhase,
        clearReturnEndPhase,
      );
      carrierAngle = THREE.MathUtils.lerp(
        highCarrierAngle,
        driveCarrierEndAngle,
        motion.progress,
      );
      carrierAngularSpeed = (
        driveCarrierEndAngle - highCarrierAngle
      ) * motion.progressRate;
      wheelAngle = (cycleIndex + 1) * toothPitch;
    } else if (cyclePhase < returnContactEndPhase) {
      stage = 'tappet-yielding-over-next-tooth';
      const motion = segmentMotion(
        cyclePhase,
        clearReturnEndPhase,
        returnContactEndPhase,
      );
      carrierAngle = THREE.MathUtils.lerp(
        driveCarrierEndAngle,
        returnContactReleaseAngle,
        motion.progress,
      );
      carrierAngularSpeed = (
        returnContactReleaseAngle - driveCarrierEndAngle
      ) * motion.progressRate;
      returnContact = returnContactAtCarrierAngle(carrierAngle);
      tappetDelta = returnContact.tappetDelta;
      tappetDeltaSpeed = returnDeltaDerivativeAt(carrierAngle)
        * carrierAngularSpeed;
      wheelAngle = (cycleIndex + 1) * toothPitch;
    } else if (cyclePhase < tipClearEndPhase) {
      stage = 'tappet-clearing-tooth-tip';
      const motion = segmentMotion(
        cyclePhase,
        returnContactEndPhase,
        tipClearEndPhase,
      );
      carrierAngle = THREE.MathUtils.lerp(
        returnContactReleaseAngle,
        lowCarrierAngle,
        motion.progress,
      );
      carrierAngularSpeed = (
        lowCarrierAngle - returnContactReleaseAngle
      ) * motion.progressRate;
      tappetDelta = tipClearDeltaAt(carrierAngle);
      tappetDeltaSpeed = tipClearDeltaSlope * carrierAngularSpeed;
      wheelAngle = (cycleIndex + 1) * toothPitch;
    } else if (cyclePhase < springReleaseEndPhase) {
      stage = 'spring-returning-tappet-to-stop';
      const motion = segmentMotion(
        cyclePhase,
        tipClearEndPhase,
        springReleaseEndPhase,
      );
      carrierAngle = lowCarrierAngle;
      carrierAngularSpeed = 0;
      tappetDelta = THREE.MathUtils.lerp(
        lowCarrierTappetDelta,
        0,
        motion.progress,
      );
      tappetDeltaSpeed = -lowCarrierTappetDelta * motion.progressRate;
      wheelAngle = (cycleIndex + 1) * toothPitch;
    } else {
      stage = 'arm-rising-from-low-clearance-to-drive-face';
      const motion = segmentMotion(
        cyclePhase,
        springReleaseEndPhase,
        1,
      );
      carrierAngle = THREE.MathUtils.lerp(
        lowCarrierAngle,
        sourceCarrierAngle,
        motion.progress,
      );
      carrierAngularSpeed = (
        sourceCarrierAngle - lowCarrierAngle
      ) * motion.progressRate;
      tappetDelta = approachReliefDelta
        * Math.sin(Math.PI * motion.progress);
      tappetDeltaSpeed = approachReliefDelta * Math.PI
        * Math.cos(Math.PI * motion.progress) * motion.progressRate;
      wheelAngle = (cycleIndex + 1) * toothPitch;
    }

    const tappetAngle = carrierAngle
      + tappetRestRelativeAngle + tappetDelta;
    const tappetAngularSpeed = carrierAngularSpeed + tappetDeltaSpeed;
    const tappetHinge = carrierHingeAt(carrierAngle);
    const tappetNoseCenter = tappetNoseCenterAt(
      carrierAngle,
      tappetDelta,
    );
    const tappetClearance = driveContact
      ? 0
      : profileClearanceAt(
        tappetNoseCenter,
        tappetNoseRadius,
        wheelAngle,
      ).clearance;
    const holdingClickState = holdingClickStateAtWheelAngle(wheelAngle);
    const holdingClickDeltaDerivative = clickDeltaDerivativeAt(wheelAngle);
    const holdingClickAngularSpeed = holdingClickDeltaDerivative
      * wheelAngularSpeed;
    const holdingTorque = holdingClickState.engaged
      ? cross2(
        holdingClickState.profilePoint,
        holdingClickState.normal.clone().negate(),
      )
      : null;
    return {
      carrierAngle,
      carrierAngularSpeed,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      driveContact,
      holdingClickAngle: holdingClickRestAngle
        + holdingClickState.clickDelta,
      holdingClickAngularSpeed,
      holdingClickDeflected: holdingClickState.deflected,
      holdingClickDelta: holdingClickState.clickDelta,
      holdingClickEngaged: holdingClickState.engaged,
      holdingClickState,
      holdingTorque,
      outputTeethAdvanced: wheelAngle / toothPitch,
      ratchetLockedAgainstReverse: wheelAngularSpeed === 0
        && holdingClickState.engaged,
      returnContact,
      stage,
      tappetAngle,
      tappetAngularSpeed,
      tappetClearance,
      tappetDelta,
      tappetDeltaSpeed,
      tappetHinge,
      tappetNoseCenter,
      wheelAngle,
      wheelAngularSpeed,
      wheelDwelling: wheelAngularSpeed === 0,
    };
  };
  const stateAtCycleCoordinate = rawCoordinate => starTappetState(
    nominalStateAtCycleCoordinate(rawCoordinate),
    {tappetRestRelativeAngle,tappetLength,tappetNoseRadius,holdingClickRestAngle,holdingClickPivot,holdingClickLength,holdingClickRadius},
    profileClearanceAt,
  );
  const stateAtTime = (time) => stateAtCycleCoordinate(
    time * cyclesPerSecond,
  );

  const carrierGroup = new THREE.Group();
  carrierGroup.position.set(carrierPivot.x, carrierPivot.y, 0.3);
  carrierGroup.userData.axis = Z_AXIS.clone();
  carrierGroup.userData.role = 'ground-pivoted-oscillating-tappet-arm';
  const carrierArmLength = carrierLength + 1.28;
  const carrierShape = new THREE.Shape();
  carrierShape.moveTo(-0.1, -0.11);
  carrierShape.lineTo(carrierArmLength - 0.18, -0.13);
  carrierShape.lineTo(carrierArmLength + 0.06, 0.07);
  carrierShape.lineTo(carrierArmLength - 0.28, 0.4);
  carrierShape.lineTo(carrierLength + 0.25, 0.49);
  carrierShape.lineTo(carrierLength - 0.08, 0.27);
  carrierShape.lineTo(0.12, 0.12);
  carrierShape.closePath();
  const carrierBody = new THREE.Mesh(
    centeredExtrusion(carrierShape, 0.17),
    matte(PALETTE.driver, { metalness: 0.11, roughness: 0.64 }),
  );
  carrierBody.userData.role = 'long-source-oscillating-arm-body';
  carrierGroup.add(carrierBody);
  const carrierIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  carrierIndex.position.set(0.72, 0.13, 0.12);
  carrierIndex.userData.role = 'white-carrier-angle-index';
  carrierGroup.add(carrierIndex);
  root.add(carrierGroup);

  const carrierBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.05, 10, 40),
    matte(PALETTE.ink, { metalness: 0.2, roughness: 0.5 }),
  );
  carrierBearing.position.set(carrierPivot.x, carrierPivot.y, 0.42);
  carrierBearing.userData.role = 'fixed-right-hand-arm-bearing';
  const carrierShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 0.72,
    radius: 0.085,
  });
  carrierShaft.position.set(carrierPivot.x, carrierPivot.y, 0.1);
  carrierShaft.userData.role = 'fixed-tappet-arm-pivot-pin';
  root.add(carrierBearing, carrierShaft);

  const tappet = new THREE.Group();
  tappet.userData.axis = Z_AXIS.clone();
  tappet.userData.role = 'separately-hinged-spring-held-tappet';
  const tappetShape = new THREE.Shape();
  tappetShape.moveTo(-0.08, -0.12);
  tappetShape.lineTo(tappetLength * 0.58, -0.17);
  tappetShape.lineTo(tappetLength * 0.8, -0.28);
  tappetShape.lineTo(tappetLength - 0.08, -0.18);
  tappetShape.lineTo(tappetLength + 0.08, 0);
  tappetShape.lineTo(tappetLength - 0.22, 0.24);
  tappetShape.lineTo(tappetLength * 0.63, 0.33);
  tappetShape.lineTo(tappetLength * 0.24, 0.19);
  tappetShape.lineTo(-0.08, 0.12);
  tappetShape.closePath();
  const tappetBody = new THREE.Mesh(
    centeredExtrusion(tappetShape, 0.18),
    matte(PALETTE.brass, { metalness: 0.12, roughness: 0.61 }),
  );
  tappetBody.userData.role = 'hooked-source-tappet-body';
  // The working nose is the rounded end of the flat hook (see
  // finishStarTappet); this marker records its centre.
  const tappetNose = new THREE.Object3D();
  tappetNose.position.set(tappetLength, 0, 0);
  tappetNose.userData.role = 'rounded-working-and-click-over-nose';
  const tappetHingeHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.34, 28),
    matte(PALETTE.ink, { metalness: 0.22, roughness: 0.48 }),
  );
  tappetHingeHub.rotation.x = Math.PI / 2;
  tappetHingeHub.userData.role = 'independent-tappet-hinge';
  const tappetHingeIndex = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.03, 8, 34),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  tappetHingeIndex.position.z = 0.19;
  tappetHingeIndex.userData.role = 'white-tappet-hinge-index';
  tappet.add(tappetBody, tappetNose, tappetHingeHub, tappetHingeIndex);
  root.add(tappet);

  const springPlaneZ = 0.5;
  const springCurveAt = (tappetDelta) => {
    const relativeAngle = tappetRestRelativeAngle + tappetDelta;
    // As on Brown's plate the tip bears up on the tappet's tail lobe behind
    // the hinge (finishStarTappet: circle (-0.5, 0.28), radius 0.2), below
    // the arm: lobe bottom + tube radius + 0.008 clearance.
    const springContactDistance = -0.5;
    const springUndersideOffset = 0.528;
    const springTip = new THREE.Vector3(
      carrierLength + springContactDistance * Math.cos(relativeAngle)
        - springUndersideOffset * Math.sin(relativeAngle),
      springContactDistance * Math.sin(relativeAngle)
        + springUndersideOffset * Math.cos(relativeAngle),
      springPlaneZ,
    );
    return new THREE.CubicBezierCurve3(
      new THREE.Vector3(0.38, 0.18, springPlaneZ),
      new THREE.Vector3(0.82, 0.5, springPlaneZ),
      // The last span follows the lobe as it presses the spring down.
      // (tangent to the lobe bottom, in the tappet's frame).
      new THREE.Vector3(
        springTip.x - 0.42 * Math.cos(relativeAngle)
          - 0.06 * Math.sin(relativeAngle),
        springTip.y - 0.42 * Math.sin(relativeAngle)
          + 0.06 * Math.cos(relativeAngle),
        springPlaneZ,
      ),
      springTip,
    );
  };
  const tappetSpring = makeDynamicLeafSpring(springCurveAt(0), {
    color: PALETTE.brass,
    planeZ: springPlaneZ,
    radius: 0.04,
    tubularSegments: 54,
  });
  tappetSpring.userData.role = 'small-under-arm-tappet-return-spring';
  carrierGroup.add(tappetSpring);
  const springClamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.16, 0.14),
    matte(PALETTE.ink, { metalness: 0.18, roughness: 0.52 }),
  );
  springClamp.position.set(0.39, 0.16, springPlaneZ);
  springClamp.userData.role = 'arm-mounted-spring-clamp';
  carrierGroup.add(springClamp);

  const holdingClick = new THREE.Group();
  holdingClick.position.set(
    holdingClickPivot.x,
    holdingClickPivot.y,
    starPlaneZ,
  );
  holdingClick.userData.axis = Z_AXIS.clone();
  holdingClick.userData.role = 'upper-pivoted-reverse-holding-click';
  const holdingClickCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(holdingClickLength * 0.32, 0.12, 0),
    new THREE.Vector3(holdingClickLength * 0.72, 0.14, 0),
    new THREE.Vector3(holdingClickLength, 0, 0),
  ], false, 'centripetal');
  const holdingClickBody = new THREE.Mesh(
    new THREE.TubeGeometry(holdingClickCurve, 42, 0.085, 10, false),
    matte(PALETTE.muted, { metalness: 0.12, roughness: 0.62 }),
  );
  holdingClickBody.userData.role = 'curved-source-holding-click-body';
  const holdingClickNose = new THREE.Object3D();
  holdingClickNose.position.set(holdingClickLength, 0, 0);
  holdingClickNose.userData.role = 'reverse-locking-click-nose';
  const holdingClickIndex = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 18, 12),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  holdingClickIndex.position.set(holdingClickLength * 0.58, 0.12, 0.11);
  holdingClickIndex.userData.role = 'white-holding-click-motion-index';
  holdingClick.add(holdingClickBody, holdingClickNose, holdingClickIndex);
  root.add(holdingClick);
  const holdingClickBearing = new THREE.Mesh(
    new THREE.TorusGeometry(0.15, 0.04, 9, 36),
    matte(PALETTE.ink, { metalness: 0.2, roughness: 0.5 }),
  );
  holdingClickBearing.position.set(
    holdingClickPivot.x,
    holdingClickPivot.y,
    // In front of the star's face, clear of the passing points.
    starPlaneZ + 0.15,
  );
  holdingClickBearing.userData.role = 'fixed-upper-click-bearing';
  const holdingClickShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 0.58,
    radius: 0.07,
  });
  holdingClickShaft.position.set(
    holdingClickPivot.x,
    holdingClickPivot.y,
    starPlaneZ + 0.03,
  );
  holdingClickShaft.userData.role = 'fixed-upper-click-pivot-pin';
  root.add(holdingClickBearing, holdingClickShaft);

  const driveContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 18, 12),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  driveContactMarker.position.z = 0.64;
  driveContactMarker.userData.role = 'active-drive-face-contact-marker';
  const returnContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.047, 18, 12),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  returnContactMarker.position.z = 0.65;
  returnContactMarker.userData.role = 'active-click-over-contact-marker';
  const holdingContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.043, 18, 12),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  holdingContactMarker.position.z = 0.66;
  holdingContactMarker.userData.role = 'active-holding-click-contact-marker';
  root.add(driveContactMarker, returnContactMarker, holdingContactMarker);

  const sourceState = stateAtCycleCoordinate(0);
  const closureState = stateAtCycleCoordinate(1);
  root.userData.archetype =
    'spring-held-hinged-tappet-arm-six-tooth-star-ratchet';
  root.userData.blocks = {
    carrierBearing,
    carrierBody,
    carrierGroup,
    carrierIndex,
    carrierShaft,
    driveContactMarker,
    holdingClick,
    holdingClickBearing,
    holdingClickBody,
    holdingClickIndex,
    holdingClickNose,
    holdingClickShaft,
    holdingContactMarker,
    ratchet,
    ratchetShaft,
    returnContactMarker,
    springClamp,
    tappet,
    tappetBody,
    tappetHingeHub,
    tappetHingeIndex,
    tappetNose,
    tappetSpring,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.55, -2.35, -0.65),
    new THREE.Vector3(5.05, 1.75, 0.9),
  );
  root.userData.canonicalTimes = {
    cycleClosure: cyclePeriod,
    driveEnd: driveEndPhase * cyclePeriod,
    sourcePose: 0,
    springRelease: springReleaseEndPhase * cyclePeriod,
    wheelLock: driveEndPhase * cyclePeriod,
  };
  root.userData.geometry = {
    baseDriveFaceNormal,
    baseDriveFaceOuter,
    baseDriveFaceRoot,
    carrierLength,
    carrierPivot,
    driveCarrierEndAngle,
    driveCarrierSwing,
    driveFaceAngularSpan,
    driveFaceWorldPhase,
    highCarrierAngle,
    holdingClickLength,
    holdingClickPivot,
    holdingClickRadius,
    holdingClickRestAngle,
    holdingClickRestCenter,
    lowCarrierAngle,
    lowCarrierTappetDelta,
    approachReliefDelta,
    ratchetDepth,
    ratchetMountPhase,
    ratchetOuterRadius,
    ratchetRootRadius,
    returnContactReleaseAngle,
    returnReleaseDelta,
    sharpTipPhase,
    sourceCarrierAngle,
    sourceContactFraction,
    sourceHinge,
    sourceNoseCenter,
    sourceScale,
    tappetLength,
    tappetNoseRadius,
    tappetRestRelativeAngle,
    toothCount,
    toothPitch,
  };
  root.userData.mechanism =
    'spring-held-drive-tappet-yields-on-return-while-upper-click-holds-wheel';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 235 page marks its animation unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate235: {
      imageHeight: 525,
      imageWidth: 525,
      inferredRatchetTeeth: toothCount,
      inferredTopology:
        'one six-point ratchet, one hinged driving tappet, and one fixed-pivot holding click',
      officialAnimationAvailable: false,
      rasterCarrierPivot: sourceCarrierPivot,
      rasterHoldingClickPivot: sourceHoldingClickPivot,
      rasterTappetHinge: sourceTappetHinge,
      rasterTappetNose: sourceTappetNose,
      rasterWheelCenter: sourceWheelCenter,
    },
    primaryScan: {
      edition: 21,
      printedPage: 61,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.nominalStateAtCycleCoordinate = nominalStateAtCycleCoordinate;
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.driveContactAtCarrierAngle = driveContactAtCarrierAngle;
  root.userData.profileClearanceAt = profileClearanceAt;
  root.userData.returnContactAtCarrierAngle = returnContactAtCarrierAngle;
  root.userData.holdingClickStateAtWheelAngle =
    holdingClickStateAtWheelAngle;
  root.userData.timeline = {
    clearReturnEndPhase,
    cyclePeriod,
    cyclesPerSecond,
    driveEndPhase,
    springReleaseEndPhase,
    tipClearEndPhase,
    topOvertravelEndPhase,
    returnContactEndPhase,
  };
  root.userData.transmission = {
    carrierTotalSwingDegrees: THREE.MathUtils.radToDeg(
      lowCarrierAngle - highCarrierAngle,
    ),
    cyclePeriod,
    direction: 'counterclockwise-one-sixth-turn-per-arm-oscillation',
    holdingClickPreventsReverse: true,
    outputTeethPerCarrierCycle: (
      closureState.wheelAngle - sourceState.wheelAngle
    ) / toothPitch,
    returnStrokeWheelDwell: true,
    tappetRigidAgainstSpringStopDuringDrive: true,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    carrierGroup.rotation.z = state.carrierAngle;
    tappet.position.set(state.tappetHinge.x, state.tappetHinge.y, 0.5);
    tappet.rotation.z = state.tappetAngle;
    tappetSpring.userData.setCurve(springCurveAt(state.tappetDelta));
    setSpin(ratchet, state.wheelAngle);
    setSpin(ratchetShaft, state.wheelAngle);
    holdingClick.rotation.z = state.holdingClickAngle;
    driveContactMarker.visible = state.driveContact !== null;
    if (state.driveContact) {
      driveContactMarker.position.x = state.driveContact.point.x;
      driveContactMarker.position.y = state.driveContact.point.y;
    }
    returnContactMarker.visible = state.returnContact?.engaged === true;
    if (state.returnContact?.engaged) {
      returnContactMarker.position.x = state.returnContact.profilePoint.x;
      returnContactMarker.position.y = state.returnContact.profilePoint.y;
    }
    holdingContactMarker.visible = state.holdingClickEngaged;
    if (state.holdingClickEngaged) {
      holdingContactMarker.position.x = state.holdingClickState.profilePoint.x;
      holdingContactMarker.position.y = state.holdingClickState.profilePoint.y;
    }
    carrierGroup.userData.angularSpeed = state.carrierAngularSpeed;
    tappet.userData.angularSpeed = state.tappetAngularSpeed;
    ratchet.userData.angularSpeed = state.wheelAngularSpeed;
    ratchetShaft.userData.angularSpeed = state.wheelAngularSpeed;
    holdingClick.userData.angularSpeed = state.holdingClickAngularSpeed;
    root.userData.contacts = {
      driveTappetToTooth: state.driveContact,
      holdingClickToTooth: state.holdingClickEngaged
        ? state.holdingClickState
        : null,
      returnTappetToTooth: state.returnContact?.engaged
        ? state.returnContact
        : null,
      tappetClearance: state.tappetClearance,
    };
    root.userData.kinematics = state;
  };
  finishStarTappet(root);
  update(0);
  return finish(root, update, new THREE.Vector3(1.1, -0.7, 18));
}

function alternatingTwoPawlContinuousRatchet(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const toothCount = 15;
  const toothPitch = fullTurn / toothCount;
  const sourceScale = 0.016;
  const sourceWheelCenter = new THREE.Vector2(285, 335);
  const sourceFulcrum = new THREE.Vector2(326, 140);
  const sourceLongPawlPivot = new THREE.Vector2(242, 130);
  const sourceShortPawlPivot = new THREE.Vector2(372, 178);
  const sourceHandleEnd = new THREE.Vector2(48, 113);
  const sourceLongPawlNose = new THREE.Vector2(205, 305);
  const sourceShortPawlNose = new THREE.Vector2(260, 243);
  const sourceToModel = (point) => new THREE.Vector2(
    (point.x - sourceWheelCenter.x) * sourceScale,
    (sourceWheelCenter.y - point.y) * sourceScale,
  );
  const fulcrum = sourceToModel(sourceFulcrum);
  const sourceLongAnchor = sourceToModel(sourceLongPawlPivot);
  const sourceShortAnchor = sourceToModel(sourceShortPawlPivot);
  const sourceHandlePoint = sourceToModel(sourceHandleEnd);
  const rotateVector = (vector, angle) => new THREE.Vector2(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  );
  const cross2 = (first, second) => (
    first.x * second.y - first.y * second.x
  );
  const perpendicular = (vector) => new THREE.Vector2(
    -vector.y,
    vector.x,
  );
  const unwrapNear = (angle, target) => {
    let unwrapped = angle;
    while (unwrapped - target > Math.PI) unwrapped -= fullTurn;
    while (unwrapped - target < -Math.PI) unwrapped += fullTurn;
    return unwrapped;
  };

  const ratchetOuterRadius = 1.62;
  const ratchetRootRadius = 1.23;
  // The wheel is thick enough that both flat pawls b and c, one behind the
  // other on the lever, lie in its tooth band and bear on it with their own
  // rounded toes.
  const ratchetDepth = 0.32;
  const ratchetPlaneZ = 0.36;
  const toothOuterStartPhase = 0.08;
  const toothOuterEndPhase = 0.2;
  const pawlNoseRadius = 0.045;
  const longDriveFaceFraction = 0;
  const shortDriveFaceFraction = 0;
  const shortToothOffset = -4;
  const cyclesPerSecond = 0.25;
  const cyclePeriod = 1 / cyclesPerSecond;
  const sourceCyclePhase = 0.25;
  const initialCyclePhase = 0; // Both independent pawls are seated at the opening handoff.
  const longResetSwing = THREE.MathUtils.degToRad(-18);
  const shortResetSwing = THREE.MathUtils.degToRad(-18);
  const returnClearanceSwing = 0.15;

  const baseFaceOuter = new THREE.Vector2(
    Math.cos(toothOuterStartPhase * toothPitch) * ratchetOuterRadius,
    Math.sin(toothOuterStartPhase * toothPitch) * ratchetOuterRadius,
  );
  const baseFaceRoot = new THREE.Vector2(
    ratchetRootRadius,
    0,
  );
  const baseFaceVector = baseFaceRoot.clone().sub(baseFaceOuter);
  const baseFaceTangent = baseFaceVector.clone().normalize();
  const baseFaceNormal = new THREE.Vector2(
    Math.cos(toothOuterStartPhase * toothPitch - THREE.MathUtils.degToRad(10)),
    Math.sin(toothOuterStartPhase * toothPitch - THREE.MathUtils.degToRad(10)),
  );
  const driveGeometryAtFraction = (fraction) => {
    const profilePoint = baseFaceOuter.clone().addScaledVector(
      baseFaceVector,
      fraction,
    );
    const center = profilePoint.clone().addScaledVector(
      baseFaceNormal,
      pawlNoseRadius,
    );
    return {
      center,
      centerAngle: Math.atan2(center.y, center.x),
      centerRadius: center.length(),
      fraction,
      profilePoint,
    };
  };
  const longDriveGeometry = driveGeometryAtFraction(
    longDriveFaceFraction,
  );
  const shortDriveGeometry = driveGeometryAtFraction(
    shortDriveFaceFraction,
  );
  const anchorAt = (sourceAnchor, leverAngle) => fulcrum.clone().add(
    rotateVector(sourceAnchor.clone().sub(fulcrum), leverAngle),
  );
  const equalLengthStartAngles = ({
    advance,
    contactRadius,
    endAnchor,
    expectedAngle,
    startAnchor,
  }) => {
    const rotatedEndAnchor = rotateVector(endAnchor, -advance);
    const difference = startAnchor.clone().sub(rotatedEndAnchor);
    const denominator = 2 * contactRadius * difference.length();
    const cosine = (
      startAnchor.lengthSq() - endAnchor.lengthSq()
    ) / denominator;
    if (Math.abs(cosine) > 1 + 1e-12) {
      throw new RangeError('A pawl cannot span both drive endpoints.');
    }
    const separation = Math.acos(THREE.MathUtils.clamp(cosine, -1, 1));
    const baseAngle = Math.atan2(difference.y, difference.x);
    return [
      baseAngle - separation,
      baseAngle + separation,
    ].map((angle) => unwrapNear(angle, expectedAngle))
      .sort((left, right) => (
        Math.abs(left - expectedAngle) - Math.abs(right - expectedAngle)
      ));
  };
  const handoffTarget = shortDriveGeometry.centerAngle
    - longDriveGeometry.centerAngle
    + (shortToothOffset + 1) * toothPitch;
  const driveStartsAtAmplitude = (amplitude) => {
    const longStartAnchor = anchorAt(sourceLongAnchor, -amplitude);
    const longEndAnchor = anchorAt(sourceLongAnchor, amplitude);
    const shortStartAnchor = anchorAt(sourceShortAnchor, amplitude);
    const shortEndAnchor = anchorAt(sourceShortAnchor, -amplitude);
    const longStartAngle = equalLengthStartAngles({
      advance: toothPitch,
      contactRadius: longDriveGeometry.centerRadius,
      endAnchor: longEndAnchor,
      expectedAngle: THREE.MathUtils.degToRad(149),
      startAnchor: longStartAnchor,
    })[0];
    const shortStartAngle = equalLengthStartAngles({
      advance: toothPitch,
      contactRadius: shortDriveGeometry.centerRadius,
      endAnchor: shortEndAnchor,
      expectedAngle: THREE.MathUtils.degToRad(68),
      startAnchor: shortStartAnchor,
    })[0];
    return {
      handoffError: shortStartAngle - longStartAngle - handoffTarget,
      longStartAngle,
      shortStartAngle,
    };
  };
  let amplitudeLow = THREE.MathUtils.degToRad(14.9);
  let amplitudeHigh = THREE.MathUtils.degToRad(15.05);
  let lowHandoffError = driveStartsAtAmplitude(
    amplitudeLow,
  ).handoffError;
  const highHandoffError = driveStartsAtAmplitude(
    amplitudeHigh,
  ).handoffError;
  if (lowHandoffError * highHandoffError > 0) {
    throw new RangeError('The alternating-pawl handoff has no solution.');
  }
  for (let iteration = 0; iteration < 72; iteration += 1) {
    const amplitudeMiddle = (amplitudeLow + amplitudeHigh) / 2;
    const middleHandoffError = driveStartsAtAmplitude(
      amplitudeMiddle,
    ).handoffError;
    if (lowHandoffError * middleHandoffError <= 0) {
      amplitudeHigh = amplitudeMiddle;
    } else {
      amplitudeLow = amplitudeMiddle;
      lowHandoffError = middleHandoffError;
    }
  }
  const leverAmplitude = (amplitudeLow + amplitudeHigh) / 2;
  const {
    handoffError,
    longStartAngle,
    shortStartAngle,
  } = driveStartsAtAmplitude(leverAmplitude);
  const ratchetMountPhase = longStartAngle
    - longDriveGeometry.centerAngle;
  const shortBaseContactAngle = ratchetMountPhase
    + shortDriveGeometry.centerAngle
    + shortToothOffset * toothPitch;
  const longPawlLength = anchorAt(
    sourceLongAnchor,
    -leverAmplitude,
  ).distanceTo(new THREE.Vector2(
    Math.cos(longStartAngle) * longDriveGeometry.centerRadius,
    Math.sin(longStartAngle) * longDriveGeometry.centerRadius,
  ));
  const shortPawlLength = anchorAt(
    sourceShortAnchor,
    leverAmplitude,
  ).distanceTo(new THREE.Vector2(
    Math.cos(shortStartAngle) * shortDriveGeometry.centerRadius,
    Math.sin(shortStartAngle) * shortDriveGeometry.centerRadius,
  ));

  const ratchet = makeSpringIndexedRatchet({
    boreRadius: 0.2,
    depth: ratchetDepth,
    mountPhase: ratchetMountPhase,
    outerRadius: ratchetOuterRadius,
    rootRadius: ratchetRootRadius,
    teeth: toothCount,
    toothOuterEndPhase,
    toothOuterStartPhase,
  });
  ratchet.userData.role =
    'fifteen-tooth-counterclockwise-nearly-continuous-ratchet-wheel';
  ratchet.userData.body.userData.role = 'source-fifteen-tooth-ratchet-body';
  ratchet.userData.indicator.userData.role = 'ratchet-wheel-rotation-index';
  ratchet.position.z = ratchetPlaneZ;
  root.add(ratchet);
  const ratchetShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 0.96,
    radius: 0.1,
  });
  ratchetShaft.position.z = ratchetPlaneZ - 0.02;
  ratchetShaft.userData.role = 'counterclockwise-output-shaft';
  root.add(ratchetShaft);

  const profilePoints = ratchet.userData.profilePoints;
  const pointInsideRatchet = (point) => {
    let inside = false;
    for (
      let index = 0, previousIndex = profilePoints.length - 1;
      index < profilePoints.length;
      previousIndex = index, index += 1
    ) {
      const current = profilePoints[index];
      const previous = profilePoints[previousIndex];
      if (
        (current.y > point.y) !== (previous.y > point.y)
        && point.x < (previous.x - current.x)
          * (point.y - current.y) / (previous.y - current.y) + current.x
      ) inside = !inside;
    }
    return inside;
  };
  const closestRatchetProfilePoint = (point) => {
    let distance = Infinity;
    let pointOnProfile = null;
    let segmentFraction = 0;
    let segmentIndex = -1;
    for (let index = 0; index < profilePoints.length; index += 1) {
      const start = profilePoints[index];
      const end = profilePoints[(index + 1) % profilePoints.length];
      const edge = end.clone().sub(start);
      const denominator = edge.lengthSq();
      if (denominator < 1e-18) continue;
      const fraction = THREE.MathUtils.clamp(
        point.clone().sub(start).dot(edge) / denominator,
        0,
        1,
      );
      const candidate = start.clone().addScaledVector(edge, fraction);
      const candidateDistance = point.distanceTo(candidate);
      if (candidateDistance < distance) {
        distance = candidateDistance;
        pointOnProfile = candidate;
        segmentFraction = fraction;
        segmentIndex = index;
      }
    }
    return {
      distance,
      point: pointOnProfile,
      segmentFraction,
      segmentIndex,
    };
  };
  const profileClearanceAt = (center, padRadius, wheelAngle) => {
    const centerLocal = rotateVector(center, -wheelAngle);
    const closest = closestRatchetProfilePoint(centerLocal);
    const inside = pointInsideRatchet(centerLocal);
    const signedDistance = inside ? -closest.distance : closest.distance;
    const profilePoint = rotateVector(closest.point, wheelAngle);
    const normal = center.clone().sub(profilePoint).normalize();
    const padPoint = center.clone().addScaledVector(normal, -padRadius);
    return {
      center,
      centerLocal,
      clearance: signedDistance - padRadius,
      contactError: padPoint.distanceTo(profilePoint),
      inside,
      normal,
      padPoint,
      profilePoint,
      segmentFraction: closest.segmentFraction,
      segmentIndex: closest.segmentIndex,
    };
  };
  const contactCenterAtAngle = (angle, radius) => new THREE.Vector2(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius,
  );
  const pawlTipAt = (anchor, length, angle) => anchor.clone().add(
    new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(
      length,
    ),
  );
  const constrainedWheelAngleAt = ({
    anchor,
    baseContactAngle,
    contactRadius,
    expectedWheelAngle,
    pawlLength,
  }) => {
    const anchorRadius = anchor.length();
    const cosine = THREE.MathUtils.clamp(
      (
        anchorRadius ** 2 + contactRadius ** 2 - pawlLength ** 2
      ) / (2 * anchorRadius * contactRadius),
      -1,
      1,
    );
    const separation = Math.acos(cosine);
    const anchorAngle = Math.atan2(anchor.y, anchor.x);
    return [
      anchorAngle - separation - baseContactAngle,
      anchorAngle + separation - baseContactAngle,
    ].map((angle) => unwrapNear(angle, expectedWheelAngle))
      .sort((left, right) => (
        Math.abs(left - expectedWheelAngle)
        - Math.abs(right - expectedWheelAngle)
      ))[0];
  };
  const pawlAngleBetween = (anchor, tip) => Math.atan2(
    tip.y - anchor.y,
    tip.x - anchor.x,
  );
  const longReturnStartAngle = pawlAngleBetween(
    anchorAt(sourceLongAnchor, leverAmplitude),
    contactCenterAtAngle(
      longStartAngle + toothPitch,
      longDriveGeometry.centerRadius,
    ),
  );
  const longReturnEndAngle = unwrapNear(pawlAngleBetween(
    anchorAt(sourceLongAnchor, -leverAmplitude),
    contactCenterAtAngle(
      longStartAngle,
      longDriveGeometry.centerRadius,
    ),
  ), longReturnStartAngle);
  const shortReturnStartAngle = pawlAngleBetween(
    anchorAt(sourceShortAnchor, -leverAmplitude),
    contactCenterAtAngle(
      shortStartAngle + toothPitch,
      shortDriveGeometry.centerRadius,
    ),
  );
  const shortReturnEndAngle = unwrapNear(pawlAngleBetween(
    anchorAt(sourceShortAnchor, leverAmplitude),
    contactCenterAtAngle(
      shortStartAngle,
      shortDriveGeometry.centerRadius,
    ),
  ), shortReturnStartAngle);
  const returnedPawlStateAt = ({
    endAngle,
    fraction,
    startAngle,
    swing,
  }) => {
    const eased = smoothStep01(fraction);
    const easedDerivative = 6 * fraction * (1 - fraction);
    const angle = THREE.MathUtils.lerp(startAngle, endAngle, eased)
      + swing * Math.sin(Math.PI * eased)
      - returnClearanceSwing * Math.sin(Math.PI * fraction) ** 2;
    const derivativePerFraction = (
      endAngle - startAngle
      + swing * Math.PI * Math.cos(Math.PI * eased)
    ) * easedDerivative
      - returnClearanceSwing * Math.PI * Math.sin(2 * Math.PI * fraction);
    return { angle, derivativePerFraction, eased };
  };
  const boundaryEpsilon = 1e-12;
  const normalizedCycleCoordinate = (coordinate) => {
    const nearest = Math.round(coordinate);
    return Math.abs(coordinate - nearest) < boundaryEpsilon
      ? nearest
      : coordinate;
  };
  // Lever pose and the driven wheel angle within one lever cycle.
  const localDriveAt = (cyclePhase) => {
    const longDriving = cyclePhase < 0.5;
    const workingHalfFraction = longDriving
      ? cyclePhase * 2
      : (cyclePhase - 0.5) * 2;
    const leverAngle = -leverAmplitude * Math.cos(fullTurn * cyclePhase);
    const longAnchor = anchorAt(sourceLongAnchor, leverAngle);
    const shortAnchor = anchorAt(sourceShortAnchor, leverAngle);
    let localWheelAngle = constrainedWheelAngleAt({
      anchor: longDriving ? longAnchor : shortAnchor,
      baseContactAngle: longDriving ? longStartAngle : shortBaseContactAngle,
      contactRadius: longDriving
        ? longDriveGeometry.centerRadius
        : shortDriveGeometry.centerRadius,
      expectedWheelAngle: longDriving
        ? toothPitch * workingHalfFraction
        : toothPitch * (1 + workingHalfFraction),
      pawlLength: longDriving ? longPawlLength : shortPawlLength,
    });
    if (cyclePhase < boundaryEpsilon) localWheelAngle = 0;
    if (Math.abs(cyclePhase - 0.5) < boundaryEpsilon) {
      localWheelAngle = toothPitch;
    }
    return {
      leverAngle,
      localWheelAngle,
      longAnchor,
      longDriving,
      shortAnchor,
      workingHalfFraction,
    };
  };
  // Brown draws both pawls lying on the teeth, so the idle pawl is not lifted
  // clear. At each instant it is swung inward about its hinge until its
  // rounded toe first meets the wheel outline, and so it rides back over the
  // teeth in the wheel plane. Where the toe slips off a tooth corner it drops
  // with a constant prescribed angular acceleration (a stand-in for its
  // gravity or spring bias) until it lands on the next flank.
  // Straight flanks of the flat pawl outline in its own frame, from the ends
  // of its rounded toe back to the hinge (see alternating-pawl-236 parts).
  const pawlToeSpan = THREE.MathUtils.degToRad(105);
  const pawlFlankPolylines = (length) => {
    const toeX = length + pawlNoseRadius * Math.cos(pawlToeSpan);
    const toeY = pawlNoseRadius * Math.sin(pawlToeSpan);
    return [
      [[toeX, -toeY], [length - 0.18, -0.065], [length * 0.16, -0.115],
        [-0.04, -0.1]],
      [[toeX, toeY], [length - 0.17, 0.05], [length * 0.5, 0.1],
        [-0.04, 0.11]],
    ];
  };
  const idleFallAcceleration = 900;
  const idleJumpThreshold = 0.02;
  const restingPawlAngleAt = (anchor, length, wheelAngle, outAngle) => {
    const local = rotateVector(anchor, -wheelAngle);
    const start = outAngle - wheelAngle;
    const r = pawlNoseRadius;
    let best = Infinity;
    const consider = (angle) => {
      let candidate = angle;
      while (candidate < start) candidate += fullTurn;
      while (candidate - start >= fullTurn) candidate -= fullTurn;
      if (candidate < best) best = candidate;
    };
    const count = profilePoints.length;
    for (let index = 0; index < count; index += 1) {
      const a = profilePoints[index];
      const b = profilePoints[(index + 1) % count];
      const dx = local.x - a.x;
      const dy = local.y - a.y;
      // Entry into the toe-radius disk about this outline corner.
      const d = Math.hypot(dx, dy);
      const k = (r * r - d * d - length * length) / (2 * length * d);
      if (k > -1 && k < 1) consider(Math.atan2(dy, dx) + Math.acos(k));
      // Entry into the toe-radius band along this outline edge.
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const e = Math.hypot(ex, ey);
      if (e < 1e-12) continue;
      const tx = ex / e;
      const ty = ey / e;
      const psi = Math.atan2(tx, -ty);
      const offset = -dx * ty + dy * tx;
      for (const side of [1, -1]) {
        const q = (side * r - offset) / length;
        if (q <= -1 || q >= 1) continue;
        const angle = psi + side * Math.acos(q);
        const along = (dx + length * Math.cos(angle)) * tx
          + (dy + length * Math.sin(angle)) * ty;
        if (along >= 0 && along <= e) consider(angle);
      }
    }
    // The straight flanks of the flat pawl behind its toe must also clear
    // the tooth corners, and its corners the tooth flanks.
    const flanks = pawlFlankPolylines(length);
    const crossings = (radius, from, to, visit) => {
      const fx = to[0] - from[0];
      const fy = to[1] - from[1];
      const aa = fx * fx + fy * fy;
      const bb = 2 * (from[0] * fx + from[1] * fy);
      const cc = from[0] ** 2 + from[1] ** 2 - radius * radius;
      const disc = bb * bb - 4 * aa * cc;
      if (disc < 0 || aa < 1e-18) return;
      for (const sign of [-1, 1]) {
        const t = (-bb + sign * Math.sqrt(disc)) / (2 * aa);
        if (t >= 0 && t <= 1) {
          visit(Math.atan2(from[1] + t * fy, from[0] + t * fx));
        }
      }
    };
    for (const polyline of flanks) {
      for (let index = 0; index + 1 < polyline.length; index += 1) {
        const from = polyline[index];
        const to = polyline[index + 1];
        for (const vertex of profilePoints) {
          const wx = vertex.x - local.x;
          const wy = vertex.y - local.y;
          const phase = Math.atan2(wy, wx);
          crossings(Math.hypot(wx, wy), from, to, (beta) => consider(phase - beta));
        }
      }
      for (const corner of polyline) {
        const radius = Math.hypot(corner[0], corner[1]);
        const phase = Math.atan2(corner[1], corner[0]);
        for (let index = 0; index < count; index += 1) {
          const a = profilePoints[index];
          const b = profilePoints[(index + 1) % count];
          crossings(
            radius,
            [a.x - local.x, a.y - local.y],
            [b.x - local.x, b.y - local.y],
            (gamma) => consider(gamma - phase),
          );
        }
      }
    }
    return best + wheelAngle;
  };
  const idleRestAt = (cyclePhase) => {
    const drive = localDriveAt(cyclePhase);
    const longIdle = !drive.longDriving;
    const lifted = returnedPawlStateAt(longIdle
      ? {
        endAngle: longReturnEndAngle,
        fraction: drive.workingHalfFraction,
        startAngle: longReturnStartAngle,
        swing: longResetSwing,
      }
      : {
        endAngle: shortReturnEndAngle,
        fraction: drive.workingHalfFraction,
        startAngle: shortReturnStartAngle,
        swing: shortResetSwing,
      }).angle - 0.5;
    return restingPawlAngleAt(
      longIdle ? drive.longAnchor : drive.shortAnchor,
      longIdle ? longPawlLength : shortPawlLength,
      drive.localWheelAngle,
      lifted,
    );
  };
  // Precompute where the riding toe slips off a tooth corner in each half.
  const idleDepartures = [0, 0.5].map((halfStart) => {
    const departures = [];
    const samples = 4000;
    let previousPhase = halfStart;
    let previousRest = idleRestAt(previousPhase);
    for (let sample = 1; sample < samples; sample += 1) {
      const phase = halfStart + 0.5 * sample / samples;
      const rest = idleRestAt(phase);
      if (rest - previousRest > idleJumpThreshold) {
        let low = previousPhase;
        let high = phase;
        const lowRest = previousRest;
        for (let iteration = 0; iteration < 64; iteration += 1) {
          const middle = (low + high) / 2;
          if (idleRestAt(middle) - lowRest < (rest - lowRest) / 2) {
            low = middle;
          } else {
            high = middle;
          }
        }
        departures.push({ angle: idleRestAt(low), phase: low });
      }
      previousPhase = phase;
      previousRest = rest;
    }
    return departures;
  });
  const idlePawlAngleAt = (cyclePhase) => {
    const rest = idleRestAt(cyclePhase);
    let last = null;
    for (const departure of idleDepartures[cyclePhase < 0.5 ? 0 : 1]) {
      if (departure.phase <= cyclePhase) last = departure;
    }
    if (!last) return { angle: rest, resting: true };
    const elapsed = cyclePhase - last.phase;
    const falling = last.angle + 0.5 * idleFallAcceleration * elapsed ** 2;
    return falling < rest
      ? { angle: falling, resting: false }
      : { angle: rest, resting: true };
  };
  const idlePawlStateAt = (cyclePhase) => {
    const { angle, resting } = idlePawlAngleAt(cyclePhase);
    // Numerical rate, one-sided at the half-cycle ends.
    const step = 1e-7;
    const halfStart = cyclePhase < 0.5 ? 0 : 0.5;
    const low = Math.max(halfStart, cyclePhase - step);
    const high = Math.min(halfStart + 0.5 - 1e-15, cyclePhase + step);
    const rate = (idlePawlAngleAt(high).angle - idlePawlAngleAt(low).angle)
      / (high - low);
    return { angle, angularSpeed: rate * cyclesPerSecond, resting };
  };
  const stateAtCycleCoordinate = (coordinate) => {
    const cycleCoordinate = normalizedCycleCoordinate(coordinate);
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const longDriving = cyclePhase < 0.5;
    const shortDriving = !longDriving;
    const workingHalfFraction = longDriving
      ? cyclePhase * 2
      : (cyclePhase - 0.5) * 2;
    const leverAngle = -leverAmplitude * Math.cos(
      fullTurn * cyclePhase,
    );
    const leverAngularSpeed = leverAmplitude * fullTurn * cyclesPerSecond
      * Math.sin(fullTurn * cyclePhase);
    const longAnchor = anchorAt(sourceLongAnchor, leverAngle);
    const shortAnchor = anchorAt(sourceShortAnchor, leverAngle);
    const longAnchorDerivative = perpendicular(
      longAnchor.clone().sub(fulcrum),
    );
    const shortAnchorDerivative = perpendicular(
      shortAnchor.clone().sub(fulcrum),
    );
    const activeAnchor = longDriving ? longAnchor : shortAnchor;
    const activePawlLength = longDriving
      ? longPawlLength
      : shortPawlLength;
    const activeContactRadius = longDriving
      ? longDriveGeometry.centerRadius
      : shortDriveGeometry.centerRadius;
    const activeBaseContactAngle = longDriving
      ? longStartAngle
      : shortBaseContactAngle;
    const expectedLocalWheelAngle = longDriving
      ? toothPitch * workingHalfFraction
      : toothPitch * (1 + workingHalfFraction);
    let localWheelAngle = constrainedWheelAngleAt({
      anchor: activeAnchor,
      baseContactAngle: activeBaseContactAngle,
      contactRadius: activeContactRadius,
      expectedWheelAngle: expectedLocalWheelAngle,
      pawlLength: activePawlLength,
    });
    if (cyclePhase < boundaryEpsilon) localWheelAngle = 0;
    if (Math.abs(cyclePhase - 0.5) < boundaryEpsilon) {
      localWheelAngle = toothPitch;
    }
    const wheelAngle = cycleIndex * 2 * toothPitch + localWheelAngle;
    const activeContactCenter = contactCenterAtAngle(
      activeBaseContactAngle + localWheelAngle,
      activeContactRadius,
    );
    const activePawlVector = activeContactCenter.clone().sub(activeAnchor);
    const activePawlAngle = Math.atan2(
      activePawlVector.y,
      activePawlVector.x,
    );
    const anchorDerivative = longDriving
      ? longAnchorDerivative
      : shortAnchorDerivative;
    const contactDerivative = perpendicular(activeContactCenter);
    const wheelAngleDerivativePerLeverAngle = activePawlVector.dot(
      anchorDerivative,
    ) / activePawlVector.dot(contactDerivative);
    const wheelAngularSpeed = wheelAngleDerivativePerLeverAngle
      * leverAngularSpeed;
    const activeAnchorVelocity = anchorDerivative.clone().multiplyScalar(
      leverAngularSpeed,
    );
    const activeContactVelocity = contactDerivative.clone().multiplyScalar(
      wheelAngularSpeed,
    );
    const relativeTipVelocity = activeContactVelocity.clone().sub(
      activeAnchorVelocity,
    );
    const activePawlAngularSpeed = cross2(
      activePawlVector,
      relativeTipVelocity,
    ) / activePawlVector.lengthSq();
    const reconstructedTipVelocity = activeAnchorVelocity.clone().add(
      perpendicular(activePawlVector).multiplyScalar(
        activePawlAngularSpeed,
      ),
    );
    const returnedPawlState = idlePawlStateAt(cyclePhase);
    const longPawlAngle = longDriving
      ? activePawlAngle
      : returnedPawlState.angle;
    const shortPawlAngle = shortDriving
      ? activePawlAngle
      : returnedPawlState.angle;
    const longTipCenter = pawlTipAt(
      longAnchor,
      longPawlLength,
      longPawlAngle,
    );
    const shortTipCenter = pawlTipAt(
      shortAnchor,
      shortPawlLength,
      shortPawlAngle,
    );
    const longProfileContact = profileClearanceAt(
      longTipCenter,
      pawlNoseRadius,
      wheelAngle,
    );
    const shortProfileContact = profileClearanceAt(
      shortTipCenter,
      pawlNoseRadius,
      wheelAngle,
    );
    const returnedPawlAngularSpeed = returnedPawlState.angularSpeed;
    const longPawlAngularSpeed = longDriving
      ? activePawlAngularSpeed
      : returnedPawlAngularSpeed;
    const shortPawlAngularSpeed = shortDriving
      ? activePawlAngularSpeed
      : returnedPawlAngularSpeed;
    const activeToothIndex = THREE.MathUtils.euclideanModulo(
      (longDriving ? 0 : shortToothOffset) - 2 * cycleIndex,
      toothCount,
    );
    const activeFacePointBase = longDriving
      ? longDriveGeometry.profilePoint
      : shortDriveGeometry.profilePoint;
    const activeFaceRotation = ratchetMountPhase
      + activeToothIndex * toothPitch + wheelAngle;
    const activeProfilePoint = rotateVector(
      activeFacePointBase,
      activeFaceRotation,
    );
    const activeContactNormal = rotateVector(
      baseFaceNormal,
      activeFaceRotation,
    );
    const renderedContactCenter = activeProfilePoint.clone().addScaledVector(
      activeContactNormal,
      pawlNoseRadius,
    );
    const activeForceDirection = activeContactNormal.clone().negate();
    const activeCompressionTorque = cross2(
      activeProfilePoint,
      activeForceDirection,
    );
    return {
      activeAnchor,
      activeCompressionTorque,
      activeContactCenter,
      activeContactNormal,
      activeContactVelocity,
      activePawl: longDriving ? 'long-b' : 'short-c',
      activePawlAngle,
      activePawlAngularSpeed,
      activePawlLength,
      activePawlLengthError: Math.abs(
        activePawlVector.length() - activePawlLength,
      ),
      activeProfilePoint,
      activeTipVelocityError: reconstructedTipVelocity.distanceTo(
        activeContactVelocity,
      ),
      activeToothIndex,
      contactCenterError: activeContactCenter.distanceTo(
        renderedContactCenter,
      ),
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      inputReversing: Math.abs(leverAngularSpeed) < 1e-12,
      leverAngle,
      leverAngularSpeed,
      localWheelAngle,
      longAnchor,
      longDriving,
      longPawlAngle,
      longPawlAngularSpeed,
      longPawlLengthError: Math.abs(
        longAnchor.distanceTo(longTipCenter) - longPawlLength,
      ),
      longProfileClearance: longProfileContact.clearance,
      longProfileContact,
      longTipCenter,
      pitchesAdvanced: wheelAngle / toothPitch,
      returnedPawlResting: returnedPawlState.resting,
      returnedPawlLiftedClear: longDriving
        ? shortProfileContact.clearance >= -1e-10
        : longProfileContact.clearance >= -1e-10,
      shortAnchor,
      shortDriving,
      shortPawlAngle,
      shortPawlAngularSpeed,
      shortPawlLengthError: Math.abs(
        shortAnchor.distanceTo(shortTipCenter) - shortPawlLength,
      ),
      shortProfileClearance: shortProfileContact.clearance,
      shortProfileContact,
      shortTipCenter,
      stage: longDriving
        ? 'long-pawl-b-drives-short-pawl-c-resets'
        : 'short-pawl-c-drives-long-pawl-b-resets',
      wheelAngle,
      wheelAngleDerivativePerLeverAngle,
      wheelAngularSpeed,
      wheelDwelling: Math.abs(wheelAngularSpeed) < 1e-12,
      workingHalfFraction,
    };
  };
  const stateAtTime = (time) => stateAtCycleCoordinate(
    initialCyclePhase + time * cyclesPerSecond,
  );

  const lever = makePlanarRotor();
  const leverRotor = lever.userData.rotor;
  const leverPlaneZ = 0.72;
  lever.position.set(fulcrum.x, fulcrum.y, leverPlaneZ);
  lever.userData.role = 'vibrating-source-lever-a';
  const leverOutlinePixels = [
    new THREE.Vector2(47, 106),
    new THREE.Vector2(334, 125),
    new THREE.Vector2(391, 170),
    new THREE.Vector2(389, 183),
    new THREE.Vector2(372, 191),
    new THREE.Vector2(336, 168),
    new THREE.Vector2(51, 124),
  ];
  const leverShape = new THREE.Shape();
  for (const [index, pixel] of leverOutlinePixels.entries()) {
    const modelPoint = sourceToModel(pixel).sub(fulcrum);
    if (index === 0) leverShape.moveTo(modelPoint.x, modelPoint.y);
    else leverShape.lineTo(modelPoint.x, modelPoint.y);
  }
  leverShape.closePath();
  const leverBody = new THREE.Mesh(
    centeredExtrusion(leverShape, 0.18),
    matte(PALETTE.driver, { metalness: 0.12, roughness: 0.62 }),
  );
  leverBody.userData.role = 'tapered-handle-and-elbow-body-a';
  leverRotor.add(leverBody);
  const leverJointDefinitions = [
    {
      point: sourceLongAnchor,
      role: 'long-pawl-b-pivot-on-lever-a',
    },
    {
      point: fulcrum,
      role: 'fixed-fulcrum-of-lever-a',
    },
    {
      point: sourceShortAnchor,
      role: 'short-pawl-c-pivot-on-lever-a',
    },
  ];
  const leverJoints = leverJointDefinitions.map(({ point, role }, index) => {
    const joint = new THREE.Group();
    joint.position.set(point.x - fulcrum.x, point.y - fulcrum.y, 0.02);
    joint.userData.index = index;
    joint.userData.role = role;
    const hub = new THREE.Mesh(
      makeAnnulusGeometry(0.07, 0.14, 0.24),
      matte(PALETTE.driver, { metalness: 0.13, roughness: 0.58 }),
    );
    joint.add(hub);
    leverRotor.add(joint);
    return joint;
  });
  const handleIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.05, 0.028),
    matte(PALETTE.white, { roughness: 0.47 }),
  );
  const handleIndexLocal = sourceHandlePoint.clone().sub(fulcrum).lerp(
    sourceLongAnchor.clone().sub(fulcrum),
    0.36,
  );
  handleIndex.position.set(handleIndexLocal.x, handleIndexLocal.y, 0.13);
  handleIndex.rotation.z = Math.atan2(
    sourceLongAnchor.y - sourceHandlePoint.y,
    sourceLongAnchor.x - sourceHandlePoint.x,
  );
  handleIndex.userData.role = 'white-lever-a-motion-index';
  leverRotor.add(handleIndex);
  root.add(lever);
  const fulcrumShaft = makeShaft({
    axis: Z_AXIS,
    color: PALETTE.ink,
    length: 0.82,
    radius: 0.075,
  });
  fulcrumShaft.position.set(fulcrum.x, fulcrum.y, 0.4);
  fulcrumShaft.userData.role = 'fixed-pivot-pin-for-lever-a';
  root.add(fulcrumShaft);

  const makeSourcePawl = ({ depth, length, role }) => {
    const pawl = new THREE.Group();
    pawl.userData.axis = Z_AXIS.clone();
    pawl.userData.length = length;
    pawl.userData.role = role;
    const pawlShape = new THREE.Shape();
    pawlShape.moveTo(-0.04, -0.1);
    pawlShape.lineTo(length * 0.16, -0.115);
    pawlShape.lineTo(length - 0.18, -0.065);
    pawlShape.lineTo(length + 0.015, 0);
    pawlShape.lineTo(length - 0.17, 0.1);
    pawlShape.lineTo(-0.04, 0.11);
    pawlShape.closePath();
    const body = new THREE.Mesh(
      centeredExtrusion(pawlShape, depth),
      matte(PALETTE.accent, { metalness: 0.11, roughness: 0.61 }),
    );
    body.userData.role = `${role}-tapered-body`;
    const pivotHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, depth * 1.8, 24),
      matte(PALETTE.ink, { metalness: 0.22, roughness: 0.48 }),
    );
    pivotHub.rotation.x = Math.PI / 2;
    pivotHub.userData.role = `${role}-pivot-hub`;
    const pivotIndex = new THREE.Mesh(
      new THREE.TorusGeometry(0.112, 0.024, 8, 28),
      matte(PALETTE.white, { roughness: 0.47 }),
    );
    pivotIndex.position.z = depth * 0.72;
    pivotIndex.userData.role = `${role}-pivot-index`;
    // The toe is the rounded end of the flat pawl itself, in the wheel's
    // plane; this marker records its centre.
    const contactFinger = new THREE.Object3D();
    contactFinger.position.set(length, 0, 0);
    contactFinger.userData.radius = pawlNoseRadius;
    contactFinger.userData.role = `${role}-round-tooth-contact`;
    const tipMarker = new THREE.Object3D();
    tipMarker.position.x = length;
    tipMarker.userData.role = `${role}-nose-center`;
    pawl.add(body, pivotHub, pivotIndex, contactFinger, tipMarker);
    pawl.userData.body = body;
    pawl.userData.contactFinger = contactFinger;
    pawl.userData.pivotHub = pivotHub;
    pawl.userData.pivotIndex = pivotIndex;
    pawl.userData.tipMarker = tipMarker;
    return markShadows(pawl);
  };
  const longPawlPlaneZ = 0.30;
  const shortPawlPlaneZ = 0.42;
  const longPawl = makeSourcePawl({
    depth: 0.13,
    length: longPawlLength,
    role: 'long-alternating-pawl-b',
  });
  const shortPawl = makeSourcePawl({
    depth: 0.13,
    length: shortPawlLength,
    role: 'short-alternating-pawl-c',
  });
  root.add(longPawl, shortPawl);

  const activeContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 18, 12),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  activeContactMarker.position.z = 0.53;
  activeContactMarker.userData.role = 'alternating-active-pawl-contact-marker';
  root.add(activeContactMarker);

  const sourceState = stateAtCycleCoordinate(sourceCyclePhase);
  const cycleStartState = stateAtCycleCoordinate(0);
  const cycleEndState = stateAtCycleCoordinate(1);
  root.userData.archetype =
    'alternating-two-pawl-nearly-continuous-fifteen-tooth-ratchet';
  root.userData.blocks = {
    activeContactMarker,
    fulcrumShaft,
    handleIndex,
    lever,
    leverBody,
    leverJoints,
    longPawl,
    longPawlBody: longPawl.userData.body,
    longPawlContactFinger: longPawl.userData.contactFinger,
    longPawlPivotHub: longPawl.userData.pivotHub,
    longPawlTipMarker: longPawl.userData.tipMarker,
    ratchet,
    ratchetShaft,
    shortPawl,
    shortPawlBody: shortPawl.userData.body,
    shortPawlContactFinger: shortPawl.userData.contactFinger,
    shortPawlPivotHub: shortPawl.userData.pivotHub,
    shortPawlTipMarker: shortPawl.userData.tipMarker,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.1, -1.8, -0.65),
    new THREE.Vector3(2.25, 3.8, 0.95),
  );
  root.userData.canonicalTimes = {
    cycleClosure: cyclePeriod,
    longToShortHandoff: (0.5 - initialCyclePhase) * cyclePeriod,
    sourcePose: (sourceCyclePhase - initialCyclePhase) * cyclePeriod,
  };
  root.userData.geometry = {
    pawlFlankPolylines,
    axis: Z_AXIS.clone(),
    baseFaceNormal,
    baseFaceOuter,
    baseFaceRoot,
    cyclePeriod,
    cyclesPerSecond,
    fulcrum,
    handoffError,
    handoffTarget,
    initialCyclePhase,
    leverAmplitude,
    longDriveFaceFraction,
    longDriveGeometry,
    longPawlLength,
    longPawlPlaneZ,
    longResetSwing,
    longStartAngle,
    pawlNoseRadius,
    ratchetDepth,
    ratchetMountPhase,
    ratchetOuterRadius,
    ratchetRootRadius,
    shortBaseContactAngle,
    shortDriveFaceFraction,
    shortDriveGeometry,
    shortPawlLength,
    shortPawlPlaneZ,
    shortResetSwing,
    returnClearanceSwing,
    shortStartAngle,
    shortToothOffset,
    sourceCyclePhase,
    sourceHandlePoint,
    sourceLongAnchor,
    sourceScale,
    sourceShortAnchor,
    toothCount,
    toothOuterEndPhase,
    toothOuterStartPhase,
    toothPitch,
  };
  root.userData.mechanism =
    'opposed-lever-pivots-alternate-two-pawls-for-nearly-continuous-counterclockwise-ratchet-motion';
  root.userData.profileClearanceAt = profileClearanceAt;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official page has an unavailable marker and no inline animation registration.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate236: {
      imageHeight: 525,
      imageWidth: 525,
      inferredRatchetTeeth: toothCount,
      inferredTopology:
        'one fixed-pivot vibrating lever, two alternately driving hinged pawls, and one external ratchet wheel',
      officialAnimationAvailable: false,
      rasterFulcrum: sourceFulcrum,
      rasterHandleEnd: sourceHandleEnd,
      rasterLongPawlNose: sourceLongPawlNose,
      rasterLongPawlPivot: sourceLongPawlPivot,
      rasterShortPawlNose: sourceShortPawlNose,
      rasterShortPawlPivot: sourceShortPawlPivot,
      rasterWheelCenter: sourceWheelCenter,
    },
    primaryScan: {
      edition: 21,
      printedPage: 61,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    cyclePeriod,
    direction: 'counterclockwise-on-both-lever-half-strokes',
    longPawlDrivesFirstHalf: true,
    outputTeethPerLeverCycle: (
      cycleEndState.wheelAngle - cycleStartState.wheelAngle
    ) / toothPitch,
    shortPawlDrivesSecondHalf: true,
    sourcePoseLongPawlDriving: sourceState.longDriving,
    wheelDwellsOnlyAtLeverReversals: true,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(ratchet, state.wheelAngle);
    setSpin(ratchetShaft, state.wheelAngle);
    setSpin(lever, state.leverAngle);
    longPawl.position.set(
      state.longAnchor.x,
      state.longAnchor.y,
      longPawlPlaneZ,
    );
    longPawl.rotation.z = state.longPawlAngle;
    shortPawl.position.set(
      state.shortAnchor.x,
      state.shortAnchor.y,
      shortPawlPlaneZ,
    );
    shortPawl.rotation.z = state.shortPawlAngle;
    activeContactMarker.position.x = state.activeProfilePoint.x;
    activeContactMarker.position.y = state.activeProfilePoint.y;
    lever.userData.angularSpeed = state.leverAngularSpeed;
    longPawl.userData.angularSpeed = state.longPawlAngularSpeed;
    ratchet.userData.angularSpeed = state.wheelAngularSpeed;
    ratchetShaft.userData.angularSpeed = state.wheelAngularSpeed;
    shortPawl.userData.angularSpeed = state.shortPawlAngularSpeed;
    root.userData.contacts = {
      activePawlToRatchet: {
        center: state.activeContactCenter,
        centerError: state.contactCenterError,
        engaged: true,
        normal: state.activeContactNormal,
        pawl: state.activePawl,
        profilePoint: state.activeProfilePoint,
        toothIndex: state.activeToothIndex,
        velocityError: state.activeTipVelocityError,
      },
      longPawlToRatchet: {
        clearance: state.longProfileClearance,
        engaged: state.longDriving,
        mode: state.longDriving ? 'driving' : 'resetting-clear',
      },
      shortPawlToRatchet: {
        clearance: state.shortProfileClearance,
        engaged: state.shortDriving,
        mode: state.shortDriving ? 'driving' : 'resetting-clear',
      },
    };
    root.userData.kinematics = state;
  };
  update(0);
  installAlternatingPawl236(root);
  return finish(root, update, new THREE.Vector3(0.5, 0.4, 14));
}

function coaxialArmCrownRatchet(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const verticalAxis = new THREE.Vector3(0, 1, 0);
  const toothCount = 20;
  const toothPitch = fullTurn / toothCount;
  // Brown's crown is a thin open cup: the saw teeth stand upright on a
  // narrow rim, whose band still contains the pawl nose's whole radial path
  // (centre radius 1.552-1.594, nose radius 0.055); the inner edge keeps
  // the ramp-triangle crease clear of the climbing path.
  const wheelInnerRadius = 1.46;
  const wheelOuterRadius = 1.64;
  const wheelBodyThickness = 0.52;
  const wheelToothHeight = 0.46;
  const wheelBaseHeight = 0;
  const wheelTipHeight = wheelBaseHeight + wheelToothHeight;
  const armPivotHeight = 1.02;
  const armPawlPivotRadius = 1.5;
  // Plate proportion: handle end 1.40 wheel radii from the fulcrum.
  const armHandleRadius = wheelOuterRadius * 2.55 / 1.82;
  const pawlTipTangent = -0.4;
  const pawlTipVertical = -0.62;
  const pawlNoseRadius = 0.055;
  const pawlLength = Math.hypot(pawlTipTangent, pawlTipVertical);
  const baseTipRadius = Math.hypot(
    armPawlPivotRadius,
    pawlTipTangent,
  );
  const baseTipAngleOffset = Math.atan2(
    pawlTipTangent,
    armPawlPivotRadius,
  );
  const faceContactOffset = Math.asin(pawlNoseRadius / baseTipRadius);
  const overtravel = toothPitch * 0.45;
  const armSwing = toothPitch + overtravel;
  const highArmAngle = armSwing / 2;
  const lowArmAngle = -armSwing / 2;
  const crownMountPhase = highArmAngle
    + baseTipAngleOffset
    - faceContactOffset
    - overtravel;
  const cyclesPerSecond = 0.25;
  const cyclePeriod = 1 / cyclesPerSecond;
  const sourceCyclePhase = 0.25;
  const initialCyclePhase = sourceCyclePhase;
  const sourceArmFulcrum = new THREE.Vector2(236, 195);
  const sourcePawlHinge = new THREE.Vector2(350, 125);
  const sourcePawlNose = new THREE.Vector2(387, 176);
  const sourceHandleEnd = new THREE.Vector2(422, 80);
  const sourceWheelLeft = new THREE.Vector2(87, 235);
  const sourceWheelRight = new THREE.Vector2(400, 226);
  const sourceOutputShaftBottom = new THREE.Vector2(239, 453);
  const boundaryEpsilon = 2e-12;

  const rotateVector = (vector, angle) => new THREE.Vector2(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  );
  const perpendicular = (vector) => new THREE.Vector2(
    -vector.y,
    vector.x,
  );
  const cross2 = (first, second) => (
    first.x * second.y - first.y * second.x
  );
  const planarToWorld = (point, height) => new THREE.Vector3(
    point.x,
    height,
    -point.y,
  );
  const inverseSmoothStep01 = (value) => {
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 64; iteration += 1) {
      const middle = (low + high) / 2;
      if (smoothStep01(middle) < value) low = middle;
      else high = middle;
    }
    return (low + high) / 2;
  };

  const tipGeometryAtLift = (liftAngle) => {
    const cosine = Math.cos(liftAngle);
    const sine = Math.sin(liftAngle);
    const tangent = pawlTipTangent * cosine
      + pawlTipVertical * sine;
    const vertical = -pawlTipTangent * sine
      + pawlTipVertical * cosine;
    const tangentDerivative = vertical;
    const verticalDerivative = -tangent;
    const radius = Math.hypot(armPawlPivotRadius, tangent);
    const angleOffset = Math.atan2(tangent, armPawlPivotRadius);
    const angleOffsetDerivative = armPawlPivotRadius
      * tangentDerivative / radius ** 2;
    const centerHeight = armPivotHeight + vertical;
    return {
      angleOffset,
      angleOffsetDerivative,
      bottomHeight: centerHeight - pawlNoseRadius,
      centerHeight,
      radius,
      tangent,
      tangentDerivative,
      vertical,
      verticalDerivative,
    };
  };
  const baseTipGeometry = tipGeometryAtLift(0);
  const peakLiftAngle = crown237Return.peakLift;
  const peakLiftDerivative = 0;
  const releaseReturnTravel = crown237Return.peakTravel;
  const rampContactStartTravel = crown237Return.startTravel;
  const fallTravel = armSwing - releaseReturnTravel;
  const rampSlope = wheelToothHeight / toothPitch;
  const liftAtReturnTravel = crown237LiftAtTravel;

  const makeCrownWheel = () => {
    const crown = makePlanarRotor();
    crown.quaternion.setFromUnitVectors(Z_AXIS, verticalAxis);
    crown.userData.axis = verticalAxis.clone();
    const rotor = crown.userData.rotor;
    const wheelMaterial = matte(PALETTE.driven, {
      metalness: 0.12,
      roughness: 0.62,
    });
    const darkMaterial = matte(PALETTE.ink, {
      metalness: 0.22,
      roughness: 0.49,
    });
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(
        wheelOuterRadius,
        wheelOuterRadius,
        wheelBodyThickness,
        96,
      ),
      wheelMaterial,
    );
    body.rotation.x = Math.PI / 2;
    body.position.z = -wheelBodyThickness / 2;
    body.userData.role = 'horizontal-crown-ratchet-disk';
    rotor.add(body);
    const crownTeeth = [];
    const rampFaces = [];
    const driveFaceTicks = [];
    const radialPoint = (radius, angle, height) => [
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      height,
    ];
    for (let toothIndex = 0; toothIndex < toothCount; toothIndex += 1) {
      const lowAngle = crownMountPhase + toothIndex * toothPitch;
      const highAngle = lowAngle + toothPitch;
      const vertices = [
        ...radialPoint(wheelInnerRadius, lowAngle, wheelBaseHeight),
        ...radialPoint(wheelOuterRadius, lowAngle, wheelBaseHeight),
        ...radialPoint(wheelInnerRadius, highAngle, wheelBaseHeight),
        ...radialPoint(wheelOuterRadius, highAngle, wheelBaseHeight),
        ...radialPoint(wheelInnerRadius, highAngle, wheelTipHeight),
        ...radialPoint(wheelOuterRadius, highAngle, wheelTipHeight),
      ];
      const indices = [
        0, 2, 3, 0, 3, 1,
        0, 1, 5, 0, 5, 4,
        2, 4, 5, 2, 5, 3,
        0, 4, 2,
        1, 3, 5,
      ];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const tooth = new THREE.Mesh(geometry, wheelMaterial);
      tooth.userData.driveFaceAngle = highAngle;
      tooth.userData.index = toothIndex;
      tooth.userData.lowAngle = lowAngle;
      tooth.userData.rampRisesCounterclockwise = true;
      tooth.userData.role = 'axial-sawtooth-on-crown-ratchet';
      rotor.add(tooth);
      crownTeeth.push(tooth);
      rampFaces.push({
        highAngle,
        index: toothIndex,
        lowAngle,
        rise: wheelToothHeight,
      });
      const driveFaceTick = makeBeam(
        new THREE.Vector3(
          Math.cos(highAngle) * wheelInnerRadius,
          Math.sin(highAngle) * wheelInnerRadius,
          wheelTipHeight + 0.018,
        ),
        new THREE.Vector3(
          Math.cos(highAngle) * wheelOuterRadius,
          Math.sin(highAngle) * wheelOuterRadius,
          wheelTipHeight + 0.018,
        ),
        { color: PALETTE.ink, depth: 0.022, thickness: 0.023 },
      );
      driveFaceTick.userData.index = toothIndex;
      driveFaceTick.userData.role = 'radial-crown-drive-face-index';
      rotor.add(driveFaceTick);
      driveFaceTicks.push(driveFaceTick);
    }
    const faceInset = new THREE.Mesh(
      new THREE.TorusGeometry(wheelInnerRadius * 0.62, 0.035, 8, 64),
      darkMaterial,
    );
    faceInset.position.z = 0.022;
    faceInset.userData.role = 'crown-wheel-face-inset';
    rotor.add(faceInset);
    const hub = new THREE.Mesh(
      makeAnnulusGeometry(0.13, 0.3, 0.24),
      darkMaterial,
    );
    hub.position.z = 0.02;
    hub.userData.role = 'crown-wheel-output-hub';
    rotor.add(hub);
    const indicator = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.055, 0.026),
      matte(PALETTE.white, { roughness: 0.47 }),
    );
    indicator.position.set(0.76, 0, 0.045);
    indicator.userData.role = 'white-crown-wheel-rotation-index';
    rotor.add(indicator);
    crown.userData.body = body;
    crown.userData.crownTeeth = crownTeeth;
    crown.userData.driveFaceTicks = driveFaceTicks;
    crown.userData.faceInset = faceInset;
    crown.userData.hub = hub;
    crown.userData.indicator = indicator;
    crown.userData.rampFaces = rampFaces;
    crown.userData.role = 'twenty-tooth-horizontal-crown-ratchet';
    crown.userData.teeth = toothCount;
    crown.userData.toothPitch = toothPitch;
    return crown;
  };

  const crownWheel = makeCrownWheel();
  const contactTriangles = crown237Triangles(crownWheel);
  root.add(crownWheel);
  // Brown draws the output shaft hanging well below the drum.
  const outputShaft = makeShaft({
    axis: verticalAxis,
    color: PALETTE.ink,
    length: 2.62,
    radius: 0.1,
  });
  outputShaft.position.y = -1.3;
  outputShaft.userData.role = 'vertical-crown-wheel-output-shaft';
  root.add(outputShaft);
  const outputBearing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.31, 0.18, 36),
    matte(PALETTE.frame, { metalness: 0.14, roughness: 0.62 }),
  );
  outputBearing.position.y = -1.53;
  outputBearing.userData.role = 'fixed-lower-output-bearing';
  root.add(outputBearing);

  const arm = makePlanarRotor();
  arm.quaternion.setFromUnitVectors(Z_AXIS, verticalAxis);
  arm.position.y = armPivotHeight;
  arm.userData.axis = verticalAxis.clone();
  arm.userData.role = 'coaxial-reciprocating-top-arm';
  const armRotor = arm.userData.rotor;
  // Brown's boss sits low on the stud, about a tooth height above the face;
  // the straight arm rises from it through the pawl hinge (which keeps its
  // height over the teeth) to the handle end.
  const armBossHeight = 0.5;
  const armBossLocalZ = armBossHeight - armPivotHeight;
  const armRiseAt = (radius) => armBossLocalZ
    * (1 - radius / armPawlPivotRadius);
  // Through the pawl eye the bar runs level, so the inclined arm stays
  // inside the eye's bore; the kink (under 0.03) is hidden in the eye.
  const armEyeHalfSpan = 0.17;
  const armSegment = (startRadius, startZ, endRadius, endZ) => makeBeam(
    new THREE.Vector3(startRadius, 0, startZ),
    new THREE.Vector3(endRadius, 0, endZ),
    { color: PALETTE.driver, depth: 0.15, thickness: 0.12 },
  );
  const armBody = armSegment(
    0.2,
    armRiseAt(0.2),
    armPawlPivotRadius - armEyeHalfSpan + 0.02,
    armRiseAt(armPawlPivotRadius - armEyeHalfSpan + 0.02),
  );
  armBody.userData.role = 'source-radial-top-arm-and-handle';
  const armEyeBar = armSegment(
    armPawlPivotRadius - armEyeHalfSpan,
    0,
    armPawlPivotRadius + armEyeHalfSpan,
    0,
  );
  armEyeBar.userData.role = 'source-radial-top-arm-and-handle';
  const armHandle = armSegment(
    armPawlPivotRadius + armEyeHalfSpan - 0.02,
    armRiseAt(armPawlPivotRadius + armEyeHalfSpan - 0.02),
    armHandleRadius,
    armRiseAt(armHandleRadius),
  );
  armHandle.userData.role = 'source-radial-top-arm-and-handle';
  armRotor.add(armBody, armEyeBar, armHandle);
  const armHub = new THREE.Mesh(
    makeAnnulusGeometry(0.105, 0.31, 0.2),
    matte(PALETTE.driver, { metalness: 0.13, roughness: 0.59 }),
  );
  armHub.position.z = armBossLocalZ;
  armHub.userData.role = 'loose-top-arm-hub-on-fixed-stud';
  armRotor.add(armHub);
  const armHubRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.035, 9, 38),
    matte(PALETTE.ink, { metalness: 0.21, roughness: 0.5 }),
  );
  armHubRing.position.z = armBossLocalZ + 0.115;
  armHubRing.userData.role = 'top-arm-bearing-outline';
  armRotor.add(armHubRing);
  const armIndicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.052, 0.028),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  armIndicator.position.set(2.13, 0, 0.1);
  armIndicator.userData.role = 'white-top-arm-motion-index';
  armRotor.add(armIndicator);
  const pawlHingeBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.26, 28),
    matte(PALETTE.ink, { metalness: 0.22, roughness: 0.48 }),
  );
  pawlHingeBarrel.rotation.z = Math.PI / 2;
  pawlHingeBarrel.position.x = armPawlPivotRadius;
  pawlHingeBarrel.userData.role = 'radial-pawl-hinge-pin-on-arm';
  armRotor.add(pawlHingeBarrel);

  const pawl = new THREE.Group();
  pawl.position.x = armPawlPivotRadius;
  pawl.userData.axis = new THREE.Vector3(1, 0, 0);
  pawl.userData.length = pawlLength;
  pawl.userData.role = 'single-vertically-yielding-crown-pawl';
  const pawlShape = new THREE.Shape();
  pawlShape.moveTo(-0.025, 0.075);
  pawlShape.quadraticCurveTo(-0.2, 0.055, -0.31, -0.18);
  pawlShape.quadraticCurveTo(-0.42, -0.4, -0.4, -0.62);
  pawlShape.lineTo(-0.325, -0.58);
  pawlShape.quadraticCurveTo(-0.32, -0.41, -0.23, -0.23);
  pawlShape.quadraticCurveTo(-0.13, -0.065, -0.015, -0.065);
  pawlShape.closePath();
  const pawlGeometry = centeredExtrusion(pawlShape, 0.16);
  pawlGeometry.applyMatrix4(new THREE.Matrix4().set(
    0, 0, 1, 0,
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 0, 1,
  ));
  const pawlBody = new THREE.Mesh(
    pawlGeometry,
    matte(PALETTE.brass, { metalness: 0.12, roughness: 0.59 }),
  );
  pawlBody.userData.role = 'curved-source-crown-pawl-body';
  const pawlHingeRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.135, 0.03, 9, 34),
    matte(PALETTE.brass, { metalness: 0.14, roughness: 0.57 }),
  );
  pawlHingeRing.rotation.y = Math.PI / 2;
  pawlHingeRing.userData.role = 'pawl-eye-around-radial-hinge';
  const pawlNose = new THREE.Mesh(
    new THREE.SphereGeometry(pawlNoseRadius, 20, 14),
    matte(PALETTE.ink, { metalness: 0.23, roughness: 0.47 }),
  );
  pawlNose.position.set(0, pawlTipTangent, pawlTipVertical);
  pawlNose.userData.radius = pawlNoseRadius;
  pawlNose.userData.role = 'round-crown-tooth-contact-nose';
  const pawlIndicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 16, 10),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  pawlIndicator.position.set(0.085, -0.285, -0.25);
  pawlIndicator.userData.role = 'white-pawl-lift-index';
  const pawlTipMarker = new THREE.Object3D();
  pawlTipMarker.position.copy(pawlNose.position);
  pawlTipMarker.userData.role = 'pawl-nose-center-witness';
  pawl.add(
    pawlBody,
    pawlHingeRing,
    pawlNose,
    pawlIndicator,
    pawlTipMarker,
  );
  armRotor.add(pawl);
  root.add(arm);

  // The fixed stud stands up from the centre of the face through the low
  // arm boss, as Brown draws it; it passes clear through the wheel's bore.
  const armFulcrumShaft = makeShaft({
    axis: verticalAxis,
    color: PALETTE.ink,
    length: armBossHeight + 0.2 - 0.01,
    radius: 0.075,
  });
  armFulcrumShaft.position.y = (armBossHeight + 0.2 + 0.01) / 2;
  armFulcrumShaft.userData.role = 'fixed-coaxial-top-arm-fulcrum-stud';
  root.add(armFulcrumShaft);

  const driveContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 18, 12),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  driveContactMarker.userData.role = 'active-crown-drive-face-contact';
  root.add(driveContactMarker);
  const rampContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 18, 12),
    matte(PALETTE.white, { roughness: 0.46 }),
  );
  rampContactMarker.userData.role = 'active-crown-ramp-return-contact';
  root.add(rampContactMarker);

  const crownSurfaceHeightAt = (worldAngle, wheelAngle) => {
    const phase = THREE.MathUtils.euclideanModulo(
      worldAngle - wheelAngle - crownMountPhase,
      toothPitch,
    );
    return {
      height: wheelBaseHeight + rampSlope * phase,
      phase,
      phaseFraction: phase / toothPitch,
    };
  };

  const stateAtCycleCoordinate = (cycleCoordinate) => {
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const drivingHalf = cyclePhase < 0.5;
    const halfFraction = drivingHalf
      ? cyclePhase * 2
      : (cyclePhase - 0.5) * 2;
    const easedHalfFraction = smoothStep01(halfFraction);
    const easeDerivative = 6 * halfFraction * (1 - halfFraction);
    const halfTravel = easedHalfFraction * armSwing;
    const halfTravelSpeed = easeDerivative * armSwing
      * 2 * cyclesPerSecond;
    const armAngle = drivingHalf
      ? highArmAngle - halfTravel
      : lowArmAngle + halfTravel;
    const armAngularSpeed = drivingHalf
      ? -halfTravelSpeed
      : halfTravelSpeed;
    const driveTravel = drivingHalf ? halfTravel : armSwing;
    const drivenTravel = THREE.MathUtils.clamp(
      driveTravel - overtravel,
      0,
      toothPitch,
    );
    const driveEngaged = drivingHalf
      && driveTravel >= overtravel - boundaryEpsilon;
    const wheelAngle = drivingHalf
      ? -cycleIndex * toothPitch - drivenTravel
      : -(cycleIndex + 1) * toothPitch;
    const wheelAngularSpeed = driveEngaged
      && drivenTravel < toothPitch - boundaryEpsilon
      ? -halfTravelSpeed
      : 0;
    const liftState = drivingHalf
      ? {
        derivativePerTravel: 0,
        liftAngle: 0,
        mode: driveEngaged
          ? 'pawl-driving-radial-crown-face'
          : 'pawl-approaching-radial-crown-face',
      }
      : liftAtReturnTravel(halfTravel);
    const pawlLiftAngle = liftState.liftAngle;
    const pawlLiftAngularSpeed = drivingHalf
      ? 0
      : liftState.derivativePerTravel * halfTravelSpeed;
    const tipGeometry = tipGeometryAtLift(pawlLiftAngle);
    const hingePlanar = rotateVector(
      new THREE.Vector2(armPawlPivotRadius, 0),
      armAngle,
    );
    const tipPlanar = rotateVector(
      new THREE.Vector2(armPawlPivotRadius, tipGeometry.tangent),
      armAngle,
    );
    const tipAngle = Math.atan2(tipPlanar.y, tipPlanar.x);
    const hingeWorld = planarToWorld(hingePlanar, armPivotHeight);
    const tipWorld = planarToWorld(tipPlanar, tipGeometry.centerHeight);
    const tipBottomWorld = planarToWorld(
      tipPlanar,
      tipGeometry.bottomHeight,
    );
    const planarTipVelocity = perpendicular(tipPlanar).multiplyScalar(
      armAngularSpeed,
    ).add(
      rotateVector(
        new THREE.Vector2(
          0,
          tipGeometry.tangentDerivative * pawlLiftAngularSpeed,
        ),
        armAngle,
      ),
    );
    const tipVerticalSpeed = tipGeometry.verticalDerivative
      * pawlLiftAngularSpeed;
    const tipVelocity = planarToWorld(planarTipVelocity, tipVerticalSpeed);
    const activePhysicalToothIndex = cycleIndex;
    const activeToothIndex = THREE.MathUtils.euclideanModulo(
      activePhysicalToothIndex,
      toothCount,
    );
    const driveFaceAngle = crownMountPhase
      + activePhysicalToothIndex * toothPitch
      + wheelAngle;
    const faceDifference = tipAngle - driveFaceAngle;
    const faceTangentDistance = tipGeometry.radius
      * Math.sin(faceDifference);
    const faceContactRadius = tipGeometry.radius
      * Math.cos(faceDifference);
    const driveFacePlanar = new THREE.Vector2(
      Math.cos(driveFaceAngle) * faceContactRadius,
      Math.sin(driveFaceAngle) * faceContactRadius,
    );
    const driveFaceWorld = planarToWorld(
      driveFacePlanar,
      tipGeometry.centerHeight,
    );
    const faceNormalPlanar = new THREE.Vector2(
      -Math.sin(driveFaceAngle),
      Math.cos(driveFaceAngle),
    );
    const driveFaceVelocity = perpendicular(
      driveFacePlanar,
    ).multiplyScalar(wheelAngularSpeed);
    const driveNormalVelocityError = driveEngaged
      ? Math.abs(
        planarTipVelocity.clone().sub(driveFaceVelocity)
          .dot(faceNormalPlanar),
      )
      : null;
    const projectedPawlVector = tipPlanar.clone().sub(hingePlanar);
    const compressionDirection = new THREE.Vector3(
      projectedPawlVector.x,
      tipGeometry.vertical,
      -projectedPawlVector.y,
    ).normalize();
    const driveCompressionTorque = cross2(
      driveFacePlanar,
      new THREE.Vector2(
        compressionDirection.x,
        -compressionDirection.z,
      ),
    );

    const returnRawPhase = faceContactOffset
      + halfTravel
      + tipGeometry.angleOffset
      - baseTipAngleOffset;
    const crownSurface = crownSurfaceHeightAt(tipAngle, wheelAngle);
    const climbingRamp = !drivingHalf
      && liftState.mode === 'pawl-climbing-crown-ramp';
    const releaseBoundary = !drivingHalf
      && Math.abs(halfTravel - releaseReturnTravel) <= boundaryEpsilon;
    const resetSurfaceHeight = climbingRamp || releaseBoundary
      ? wheelBaseHeight + rampSlope * Math.min(
        returnRawPhase,
        toothPitch,
      )
      : crownSurface.height;
    const localCenter = new THREE.Vector3(tipPlanar.x, tipPlanar.y, tipGeometry.centerHeight).applyAxisAngle(Z_AXIS, -wheelAngle);
    const finiteContact = crown237Closest(localCenter, contactTriangles);
    const resetProfileClearance = finiteContact.distance - pawlNoseRadius;
    const finitePoint = finiteContact.point.clone().applyAxisAngle(Z_AXIS, wheelAngle);
    const finiteNormal = finiteContact.normal.clone().applyAxisAngle(Z_AXIS, wheelAngle);
    const returnConstraintVelocityError = climbingRamp
      ? Math.abs(planarTipVelocity.x * finiteNormal.x + planarTipVelocity.y * finiteNormal.y + tipVerticalSpeed * finiteNormal.z)
      : null;
    const rampContactWorld = planarToWorld(finitePoint, finitePoint.z);
    return {
      activePhysicalToothIndex,
      activeToothIndex,
      armAngle,
      armAngularSpeed,
      armReversing: Math.abs(armAngularSpeed) < 1e-12,
      compressionDirection,
      crownSurface,
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      driveCompressionTorque,
      driveContactCenterError: driveEngaged
        ? tipWorld.distanceTo(driveFaceWorld) - pawlNoseRadius
        : null,
      driveEngaged,
      driveFaceAngle,
      driveFacePlanar,
      driveFaceWorld,
      driveNormalVelocityError,
      driveTravel,
      drivenTravel,
      easedHalfFraction,
      faceContactRadius,
      faceTangentDistance,
      halfFraction,
      halfTravel,
      halfTravelSpeed,
      hingePlanar,
      hingeWorld,
      pawlLengthError: Math.abs(
        hingeWorld.distanceTo(tipWorld) - pawlLength,
      ),
      pawlLiftAngle,
      pawlLiftAngularSpeed,
      pawlMode: liftState.mode,
      rampContactEngaged: climbingRamp,
      rampContactWorld,
      resetProfileClearance,
      resetSurfaceHeight,
      returnConstraintVelocityError,
      returnRawPhase,
      returningHalf: !drivingHalf,
      stage: drivingHalf
        ? (driveEngaged
          ? 'clockwise-drive-against-axial-face'
          : 'clockwise-lost-motion-approach')
        : liftState.mode,
      tipAngle,
      tipBottomWorld,
      tipGeometry,
      tipPlanar,
      tipVelocity,
      tipVerticalSpeed,
      tipWorld,
      wheelAngle,
      wheelAngularSpeed,
      wheelDwelling: Math.abs(wheelAngularSpeed) < 1e-12,
      wheelPitchesAdvanced: -wheelAngle / toothPitch,
    };
  };
  const stateAtTime = (time) => stateAtCycleCoordinate(
    initialCyclePhase + time * cyclesPerSecond,
  );

  const driveContactPhase = 0.5 * inverseSmoothStep01(
    overtravel / armSwing,
  );
  const rampContactPhase = 0.5 + 0.5 * inverseSmoothStep01(
    rampContactStartTravel / armSwing,
  );
  const faceReleasePhase = 0.5 + 0.5 * inverseSmoothStep01(
    releaseReturnTravel / armSwing,
  );
  const sourceState = stateAtCycleCoordinate(sourceCyclePhase);
  const cycleStartState = stateAtCycleCoordinate(0);
  const cycleEndState = stateAtCycleCoordinate(1);
  root.userData.archetype =
    'coaxial-vibrating-arm-pawl-twenty-tooth-crown-ratchet';
  root.userData.blocks = {
    arm,
    armBody,
    armFulcrumShaft,
    armHub,
    armHubRing,
    armIndicator,
    crownWheel,
    crownWheelBody: crownWheel.userData.body,
    crownWheelHub: crownWheel.userData.hub,
    crownWheelIndicator: crownWheel.userData.indicator,
    driveContactMarker,
    outputBearing,
    outputShaft,
    pawl,
    pawlBody,
    pawlHingeBarrel,
    pawlHingeRing,
    pawlIndicator,
    pawlNose,
    pawlTipMarker,
    rampContactMarker,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.08, -1.66, -2.08),
    new THREE.Vector3(2.72, 1.4, 2.08),
  );
  root.userData.canonicalTimes = {
    crownFaceRelease: (faceReleasePhase - initialCyclePhase)
      * cyclePeriod,
    cycleClosure: cyclePeriod,
    driveContact: (driveContactPhase - initialCyclePhase + 1)
      % 1 * cyclePeriod,
    rampContact: (rampContactPhase - initialCyclePhase)
      * cyclePeriod,
    sourcePose: 0,
  };
  root.userData.crownSurfaceHeightAt = crownSurfaceHeightAt;
  root.userData.geometry = {
    armHandleRadius,
    armPawlPivotRadius,
    armPivotHeight,
    armSwing,
    axis: verticalAxis.clone(),
    baseTipAngleOffset,
    baseTipGeometry,
    baseTipRadius,
    crownMountPhase,
    cyclePeriod,
    cyclesPerSecond,
    faceContactOffset,
    fallTravel,
    highArmAngle,
    initialCyclePhase,
    lowArmAngle,
    overtravel,
    pawlLength,
    pawlNoseRadius,
    pawlTipTangent,
    pawlTipVertical,
    peakLiftAngle,
    peakLiftDerivative,
    rampContactStartTravel,
    releaseReturnTravel,
    sourceCyclePhase,
    toothCount,
    toothPitch,
    wheelBaseHeight,
    wheelBodyThickness,
    wheelInnerRadius,
    wheelOuterRadius,
    wheelTipHeight,
    wheelToothHeight,
  };
  root.userData.liftAtReturnTravel = liftAtReturnTravel;
  root.userData.mechanism =
    'one-coaxial-top-arm-and-hinged-pawl-index-a-horizontal-crown-ratchet-clockwise';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 237 page marks its animation unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate237: {
      imageHeight: 525,
      imageWidth: 525,
      inferredCrownTeeth: toothCount,
      inferredTopology:
        'one coaxial reciprocating top arm, one radially hinged yielding pawl, and one horizontal axial-tooth crown ratchet',
      officialAnimationAvailable: false,
      rasterArmFulcrum: sourceArmFulcrum,
      rasterHandleEnd: sourceHandleEnd,
      rasterOutputShaftBottom: sourceOutputShaftBottom,
      rasterPawlHinge: sourcePawlHinge,
      rasterPawlNose: sourcePawlNose,
      rasterWheelLeft: sourceWheelLeft,
      rasterWheelRight: sourceWheelRight,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 61,
      edition: 21,
      illustrationPage: 60,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cyclePeriod,
    driveContactPhase,
    faceReleasePhase,
    rampContactPhase,
  };
  root.userData.transmission = {
    armSwingDegrees: THREE.MathUtils.radToDeg(armSwing),
    cyclePeriod,
    direction: 'clockwise-one-twentieth-turn-per-arm-oscillation',
    noHoldingClickDepicted: true,
    outputTeethPerArmCycle: -(
      cycleEndState.wheelAngle - cycleStartState.wheelAngle
    ) / toothPitch,
    pawlClimbsAxialRampOnReturn: true,
    returnStrokeWheelDwell: true,
    sourcePoseDriving: sourceState.driveEngaged,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(crownWheel, state.wheelAngle);
    setSpin(outputShaft, state.wheelAngle);
    setSpin(arm, state.armAngle);
    pawl.rotation.x = -state.pawlLiftAngle;
    driveContactMarker.visible = state.driveEngaged;
    if (state.driveEngaged) {
      driveContactMarker.position.copy(state.driveFaceWorld);
    }
    rampContactMarker.visible = state.rampContactEngaged;
    if (state.rampContactEngaged) {
      rampContactMarker.position.copy(state.rampContactWorld);
    }
    arm.userData.angularSpeed = state.armAngularSpeed;
    crownWheel.userData.angularSpeed = state.wheelAngularSpeed;
    outputShaft.userData.angularSpeed = state.wheelAngularSpeed;
    pawl.userData.angularSpeed = -state.pawlLiftAngularSpeed;
    pawl.userData.liftAngle = state.pawlLiftAngle;
    root.userData.contacts = {
      pawlToCrownDriveFace: {
        centerError: state.driveContactCenterError,
        compressionTorque: state.driveEngaged
          ? state.driveCompressionTorque
          : null,
        contactPoint: state.driveEngaged
          ? state.driveFaceWorld.clone()
          : null,
        engaged: state.driveEngaged,
        normalVelocityError: state.driveNormalVelocityError,
        toothIndex: state.driveEngaged ? state.activeToothIndex : null,
      },
      pawlToCrownRamp: {
        clearance: state.resetProfileClearance,
        constraintVelocityError: state.returnConstraintVelocityError,
        contactPoint: state.rampContactEngaged
          ? state.rampContactWorld.clone()
          : null,
        engaged: state.rampContactEngaged,
        mode: state.pawlMode,
      },
    };
    root.userData.kinematics = state;
  };
  installCrown237Parts(root);
  fitCrown237(root, update);
  return finish(root, update, new THREE.Vector3(5, 3, 12));
}

function threeAlternativeRatchetStops(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const toothCount = 18;
  const toothPitch = fullTurn / toothCount;
  // Brown's wheel: tips about 135 px about its hub at (213, 234).
  const wheelRootRadius = 1.56;
  const wheelOuterRadius = 1.9;
  const wheelDepth = 0.32;
  // The wheel shares the stops' plane (their bodies span 0.23 to 0.41), so
  // each flat stop bears on the teeth with its own rounded toe.
  const wheelPlaneZ = 0.32;
  const wheelMountPhase = THREE.MathUtils.degToRad(120);
  const toothOuterStartPhase = 0.69;
  const toothOuterEndPhase = 0.73;
  const cyclePeriod = 6;
  const cyclesPerSecond = 1 / cyclePeriod;
  const demonstrationsPerCycle = 3;
  const selectionPhases = {
    parkedBefore: 0.08,
    lowerEnd: 0.2,
    driveStart: 0.28,
    driveEnd: 0.7,
    parkStart: 0.84,
    parkEnd: 0.96,
  };
  const initialCycleCoordinate = 0.24 / demonstrationsPerCycle;
  const sourceImageCenter = new THREE.Vector2(213, 234);
  const sourceScale = 0.014;
  const sourceHookPivot = new THREE.Vector2(49, 240);
  const sourceHookNose = new THREE.Vector2(151, 121);
  const sourceStraightPivot = new THREE.Vector2(478, 140);
  const sourceStraightNose = new THREE.Vector2(302, 113);
  const sourceSpringJoint = new THREE.Vector2(214, 365);
  const sourceSpringNose = new THREE.Vector2(169, 382);
  const sourceSpringAnchor = new THREE.Vector2(239, 465);

  const positiveModulo = (value, modulus) => ((value % modulus) + modulus)
    % modulus;
  const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
  const perpendicular = (vector) => new THREE.Vector2(-vector.y, vector.x);
  const rotateVector = (vector, angle) => new THREE.Vector2(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  );
  const sourceToWorld = (point) => new THREE.Vector2(
    (point.x - sourceImageCenter.x) * sourceScale,
    (sourceImageCenter.y - point.y) * sourceScale,
  );
  const smoother = (value) => {
    const u = THREE.MathUtils.clamp(value, 0, 1);
    return u ** 3 * (10 + u * (-15 + 6 * u));
  };
  const smootherDerivative = (value) => {
    if (value <= 0 || value >= 1) return 0;
    return 30 * value ** 2 * (1 - value) ** 2;
  };
  const smootherSecondDerivative = (value) => {
    if (value <= 0 || value >= 1) return 0;
    return 60 * value * (1 - value) * (1 - 2 * value);
  };
  const smoothSegment = (value, start, end) => {
    const span = end - start;
    const u = (value - start) / span;
    return {
      acceleration: smootherSecondDerivative(u) / span ** 2,
      progress: smoother(u),
      speed: smootherDerivative(u) / span,
    };
  };

  const wheel = makeSpringIndexedRatchet({
    boreRadius: 0.25,
    depth: wheelDepth,
    mountPhase: wheelMountPhase,
    outerRadius: wheelOuterRadius,
    rootRadius: wheelRootRadius,
    teeth: toothCount,
    toothOuterEndPhase,
    toothOuterStartPhase,
  });
  wheel.userData.role = 'shared-eighteen-tooth-clockwise-ratchet-wheel';
  wheel.userData.body.userData.role = 'source-asymmetric-ratchet-wheel-body';
  wheel.userData.indicator.userData.role = 'ratchet-wheel-face-index';
  wheel.position.z = wheelPlaneZ;
  root.add(wheel);

  const wheelShaft = makeShaft({ length: 1.1, radius: 0.12 });
  wheelShaft.position.z = wheelPlaneZ - 0.01;
  wheelShaft.userData.role = 'shared-ratchet-wheel-shaft';
  root.add(wheelShaft);

  const localProfilePoints = wheel.userData.profilePoints
    .map((point) => point.clone());
  const localProfileEdges = localProfilePoints.map((start, index) => ({
    end: localProfilePoints[(index + 1) % localProfilePoints.length],
    index,
    start,
    toothIndex: Math.floor(index / 3),
    type: ['rising-ramp', 'short-tip', 'reverse-lock-face'][index % 3],
  }));
  const profileEdgesAtWheelAngle = (wheelAngle) => localProfileEdges
    .map((edge) => ({
      ...edge,
      end: rotateVector(edge.end, wheelAngle),
      start: rotateVector(edge.start, wheelAngle),
    }));
  const pointInsideWheelAtAngle = (point, wheelAngle) => {
    const vertices = localProfilePoints.map((profilePoint) => (
      rotateVector(profilePoint, wheelAngle)
    ));
    let inside = false;
    for (
      let index = 0, previous = vertices.length - 1;
      index < vertices.length;
      previous = index, index += 1
    ) {
      const first = vertices[index];
      const second = vertices[previous];
      if (
        (first.y > point.y) !== (second.y > point.y)
        && point.x < (second.x - first.x) * (point.y - first.y)
          / (second.y - first.y) + first.x
      ) inside = !inside;
    }
    return inside;
  };
  const pointSegmentMetrics = (point, start, end) => {
    const delta = end.clone().sub(start);
    const denominator = delta.lengthSq();
    const coordinate = denominator > 0
      ? THREE.MathUtils.clamp(
        point.clone().sub(start).dot(delta) / denominator,
        0,
        1,
      )
      : 0;
    const closest = start.clone().addScaledVector(delta, coordinate);
    return {
      closest,
      coordinate,
      distance: closest.distanceTo(point),
    };
  };
  const circleSegmentIntersections = (
    center,
    radius,
    start,
    end,
  ) => {
    const delta = end.clone().sub(start);
    const offset = start.clone().sub(center);
    const quadratic = delta.lengthSq();
    const linear = 2 * offset.dot(delta);
    const constant = offset.lengthSq() - radius ** 2;
    const discriminant = linear ** 2 - 4 * quadratic * constant;
    if (discriminant < -1e-11 || quadratic === 0) return [];
    const rootDiscriminant = Math.sqrt(Math.max(0, discriminant));
    const coordinates = [
      (-linear - rootDiscriminant) / (2 * quadratic),
      (-linear + rootDiscriminant) / (2 * quadratic),
    ];
    return coordinates.filter((coordinate, index) => (
      coordinate >= -1e-9
      && coordinate <= 1 + 1e-9
      && (index === 0 || Math.abs(coordinate - coordinates[0]) > 1e-10)
    )).map((coordinate) => ({
      coordinate: THREE.MathUtils.clamp(coordinate, 0, 1),
      point: start.clone().addScaledVector(
        delta,
        THREE.MathUtils.clamp(coordinate, 0, 1),
      ),
    }));
  };
  const seatedPointFor = (rootIndex, driveFaceCoordinate) => {
    const previousTooth = positiveModulo(rootIndex - 1, toothCount);
    const driveFaceOuter = localProfilePoints[previousTooth * 3 + 2];
    const rootPoint = localProfilePoints[rootIndex * 3];
    return driveFaceOuter.clone().lerp(rootPoint, driveFaceCoordinate);
  };

  const stopDefinitions = [
    {
      color: PALETTE.driver,
      driveFaceCoordinate: 1,
      key: 'hook-gravity-stop',
      pivot: sourceToWorld(sourceHookPivot),
      rootIndex: 0,
      sourceNose: sourceHookNose,
      sourcePivot: sourceHookPivot,
      style: 'hook',
    },
    {
      color: PALETTE.accent,
      driveFaceCoordinate: 1,
      key: 'straight-gravity-stop',
      pivot: sourceToWorld(sourceStraightPivot),
      rootIndex: 15,
      sourceNose: sourceStraightNose,
      sourcePivot: sourceStraightPivot,
      style: 'straight',
    },
    {
      color: PALETTE.brass,
      driveFaceCoordinate: 1,
      key: 'spring-pawl-stop',
      pivot: sourceToWorld(sourceSpringAnchor),
      rootIndex: 6,
      sourceNose: sourceSpringNose,
      sourceJoint: sourceSpringJoint,
      sourcePivot: sourceSpringAnchor,
      style: 'spring',
    },
  ].map((definition, index) => {
    const seatedPoint = seatedPointFor(
      definition.rootIndex,
      definition.driveFaceCoordinate,
    );
    const arm = seatedPoint.clone().sub(definition.pivot);
    const restAngle = Math.atan2(arm.y, arm.x);
    const radial = seatedPoint.clone().normalize();
    const liftSign = Math.sign(radial.dot(perpendicular(arm))) || 1;
    return {
      ...definition,
      arm,
      armLength: arm.length(),
      index,
      liftSign,
      restAngle,
      seatedPoint,
    };
  });

  const contactAtWheelAngle = (
    stop,
    wheelAngle,
    preferredEdgeType = null,
  ) => {
    const restPoint = stop.pivot.clone().add(
      new THREE.Vector2(
        Math.cos(stop.restAngle) * stop.armLength,
        Math.sin(stop.restAngle) * stop.armLength,
      ),
    );
    const edges = profileEdgesAtWheelAngle(wheelAngle);
    const boundary = edges.map((edge) => ({
      edge,
      metrics: pointSegmentMetrics(restPoint, edge.start, edge.end),
    })).sort((first, second) => (
      first.metrics.distance - second.metrics.distance
    ))[0];
    const restInside = pointInsideWheelAtAngle(restPoint, wheelAngle);
    if (!restInside && boundary.metrics.distance > 2e-9) {
      return {
        angle: stop.restAngle,
        angleDerivative: 0,
        contact: false,
        edge: null,
        lift: 0,
        point: restPoint,
      };
    }
    const candidates = [];
    for (const edge of edges) {
      for (const intersection of circleSegmentIntersections(
        stop.pivot,
        stop.armLength,
        edge.start,
        edge.end,
      )) {
        const angle = Math.atan2(
          intersection.point.y - stop.pivot.y,
          intersection.point.x - stop.pivot.x,
        );
        const lift = positiveModulo(
          stop.liftSign * (angle - stop.restAngle),
          fullTurn,
        );
        if (lift > Math.PI) continue;
        const outsideProbe = stop.pivot.clone().add(new THREE.Vector2(
          Math.cos(angle + stop.liftSign * 1e-6) * stop.armLength,
          Math.sin(angle + stop.liftSign * 1e-6) * stop.armLength,
        ));
        if (pointInsideWheelAtAngle(outsideProbe, wheelAngle)) continue;
        candidates.push({
          angle,
          edge,
          edgeCoordinate: intersection.coordinate,
          lift,
          point: intersection.point,
        });
      }
    }
    candidates.sort((first, second) => first.lift - second.lift);
    const minimumLift = candidates[0]?.lift ?? Infinity;
    const selected = preferredEdgeType
      ? candidates.find((candidate) => (
        candidate.edge.type === preferredEdgeType
        && candidate.lift <= minimumLift + 2e-8
      )) ?? candidates[0]
      : candidates[0];
    if (!selected) {
      throw new RangeError(`${stop.key} has no collision-free ratchet contact.`);
    }
    const edgeTangent = selected.edge.end.clone()
      .sub(selected.edge.start)
      .normalize();
    const outwardNormal = new THREE.Vector2(
      edgeTangent.y,
      -edgeTangent.x,
    );
    const pawlRadius = selected.point.clone().sub(stop.pivot);
    const denominator = outwardNormal.dot(perpendicular(pawlRadius));
    const angleDerivative = Math.abs(denominator) > 1e-10
      ? outwardNormal.dot(perpendicular(selected.point)) / denominator
      : 0;
    return {
      ...selected,
      angleDerivative,
      contact: true,
      edgeTangent,
      normalClearance: 0,
      outwardNormal,
    };
  };
  const contactAngleSecondDerivative = (stop, wheelAngle, contact) => {
    const delta = 2e-5;
    const before = contactAtWheelAngle(stop, wheelAngle - delta);
    const after = contactAtWheelAngle(stop, wheelAngle + delta);
    if (
      !before.contact
      || !after.contact
      || before.edge?.type !== contact.edge?.type
      || after.edge?.type !== contact.edge?.type
    ) return 0;
    return (after.angleDerivative - before.angleDerivative) / (2 * delta);
  };

  // The finite follower maxima were baked offline; avoid thousands of
  // circle/edge intersections during browser construction.
  for (const stop of stopDefinitions) {
    stop.maximumContactLift = stop240MaximumLifts[stop.index];
    stop.parkLift = stop.maximumContactLift + THREE.MathUtils.degToRad(9);
    stop.parkDelta = stop.liftSign * stop.parkLift;
  }

  const makeRibbonShape = (centerPoints, halfWidths) => {
    const left = [];
    const right = [];
    for (let index = 0; index < centerPoints.length; index += 1) {
      const previous = centerPoints[Math.max(0, index - 1)];
      const next = centerPoints[Math.min(centerPoints.length - 1, index + 1)];
      const tangent = next.clone().sub(previous).normalize();
      const normal = perpendicular(tangent);
      left.push(centerPoints[index].clone().addScaledVector(
        normal,
        halfWidths[index],
      ));
      right.push(centerPoints[index].clone().addScaledVector(
        normal,
        -halfWidths[index],
      ));
    }
    const shape = new THREE.Shape();
    shape.moveTo(left[0].x, left[0].y);
    for (const point of left.slice(1)) shape.lineTo(point.x, point.y);
    for (const point of right.reverse()) shape.lineTo(point.x, point.y);
    shape.closePath();
    return shape;
  };
  const makeStopBodyShape = (stop) => {
    const unit = stop.arm.clone().normalize();
    const normal = perpendicular(unit);
    if (stop.style === 'hook') {
      const outward = stop.seatedPoint.clone().normalize();
      return makeRibbonShape([
        new THREE.Vector2(),
        stop.arm.clone().multiplyScalar(0.24)
          .addScaledVector(outward, 0.24),
        stop.arm.clone().multiplyScalar(0.52)
          .addScaledVector(outward, 0.34),
        stop.arm.clone().multiplyScalar(0.76)
          .addScaledVector(outward, 0.25),
        stop.arm.clone().multiplyScalar(0.92)
          .addScaledVector(outward, 0.09),
        stop.arm.clone(),
      ], [0.18, 0.18, 0.17, 0.15, 0.11, 0]);
    }
    if (stop.style === 'straight') {
      return makeRibbonShape([
        new THREE.Vector2(),
        stop.arm.clone().multiplyScalar(0.48).addScaledVector(normal, 0.04),
        stop.arm.clone().multiplyScalar(0.86).addScaledVector(normal, 0.025),
        stop.arm.clone(),
      ], [0.17, 0.16, 0.11, 0]);
    }
    const shape = new THREE.Shape();
    const joint = sourceToWorld(stop.sourceJoint).sub(stop.pivot);
    const pawlAxis = stop.arm.clone().sub(joint).normalize();
    const pawlNormal = perpendicular(pawlAxis);
    const points = [
      stop.arm.clone(),
      stop.arm.clone().addScaledVector(pawlAxis, -0.22)
        .addScaledVector(pawlNormal, 0.11),
      joint.clone().addScaledVector(pawlNormal, 0.2),
      joint.clone().addScaledVector(pawlAxis, -0.32)
        .addScaledVector(pawlNormal, 0.16),
      joint.clone().addScaledVector(pawlAxis, -0.42)
        .addScaledVector(pawlNormal, -0.06),
      joint.clone().addScaledVector(pawlAxis, -0.25)
        .addScaledVector(pawlNormal, -0.22),
      joint.clone().addScaledVector(pawlNormal, -0.18),
      stop.arm.clone().addScaledVector(pawlAxis, -0.2)
        .addScaledVector(pawlNormal, -0.1),
    ];
    shape.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) shape.lineTo(point.x, point.y);
    shape.closePath();
    return shape;
  };

  const stopLayerZ = 0.32;
  const stopDepth = 0.18;
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.5,
  });
  const contactMaterial = matte(PALETTE.white, { roughness: 0.46 });
  const stopBlocks = stopDefinitions.map((stop) => {
    const group = new THREE.Group();
    group.position.set(stop.pivot.x, stop.pivot.y, 0);
    group.userData.role = stop.key;
    group.userData.restAngle = stop.restAngle;
    group.userData.liftSign = stop.liftSign;
    const body = new THREE.Mesh(
      centeredExtrusion(makeStopBodyShape(stop), stopDepth),
      matte(stop.color, { metalness: 0.12, roughness: 0.61 }),
    );
    body.position.z = stopLayerZ;
    body.userData.role = `${stop.key}-source-shaped-body`;
    group.add(body);
    const pivotRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.045, 9, 36),
      darkMaterial,
    );
    pivotRing.position.z = stopLayerZ + stopDepth / 2 + 0.025;
    pivotRing.userData.role = `${stop.key}-pivot-ring`;
    group.add(pivotRing);
    const witness = new THREE.Mesh(
      new THREE.BoxGeometry(stop.armLength * 0.3, 0.045, 0.025),
      contactMaterial,
    );
    witness.position.set(
      Math.cos(stop.restAngle) * stop.armLength * 0.19,
      Math.sin(stop.restAngle) * stop.armLength * 0.19,
      stopLayerZ + stopDepth / 2 + 0.045,
    );
    witness.rotation.z = stop.restAngle;
    witness.userData.role = `${stop.key}-rotation-witness`;
    group.add(witness);
    root.add(group);

    // A plain fixed pin through the stop's eye and its collar.
    const pivotShaft = makeShaft({ length: 0.34, radius: 0.085 });
    pivotShaft.position.set(stop.pivot.x, stop.pivot.y, 0.33);
    pivotShaft.userData.role = `${stop.key}-fixed-pivot`;
    root.add(pivotShaft);
    const contactMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 16, 12),
      contactMaterial,
    );
    contactMarker.position.z = stopLayerZ + stopDepth / 2 + 0.08;
    contactMarker.userData.role = `${stop.key}-contact-marker`;
    root.add(contactMarker);
    return {
      body,
      contactMarker,
      group,
      pivotRing,
      pivotShaft,
      stop,
      witness,
    };
  });

  const springStopBlock = stopBlocks[2];
  const springAnchor = sourceToWorld(sourceSpringAnchor);
  const springAnchorShaft = springStopBlock.pivotShaft;
  springAnchorShaft.userData.role = 'spring-pawl-leaf-fixed-anchor';
  // Brown draws a flat leaf spring (a broad double-lined band), not a round
  // wire: sweep a thin rectangular leaf whose face lies in the plate plane.
  // Just in front of the spring stop's pivot ring (z to 0.47), which the leaf crosses at its clamped root.
  const leafSpringPlaneZ = stopLayerZ + stopDepth / 2 + 0.12;
  const leafSpring = makeDynamicLeafSpring(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(springAnchor.x, springAnchor.y, leafSpringPlaneZ),
      new THREE.Vector3(springAnchor.x + 1, springAnchor.y, leafSpringPlaneZ),
    ]),
    {
      // Brown's band is about 25 plate pixels (0.35) broad, widening into a
      // leaf at its anchored root; the steel is thin across the plate.
      band: { halfWidthAt: (u) => 0.15 + 0.08 * Math.max(0, 1 - u / 0.2) ** 2, endTrim: 0.075 },
      color: PALETTE.frame,
      planeZ: leafSpringPlaneZ,
      radius: 0.025,
      tubularSegments: 64,
    },
  );
  leafSpring.userData.role = 'spring-pawl-curved-leaf-spring';
  root.add(leafSpring);
  const springBearingLocal = sourceToWorld(sourceSpringJoint)
    .sub(springAnchor);

  const finiteStopDefinitions = stop240Definitions(stopDefinitions, localProfilePoints);
  const nominalStateAtCycleCoordinate = (cycleCoordinate) => {
    const globalStepCoordinate = cycleCoordinate * demonstrationsPerCycle;
    const stepIndex = Math.floor(globalStepCoordinate);
    const stepPhase = globalStepCoordinate - stepIndex;
    const selectedIndex = positiveModulo(stepIndex, demonstrationsPerCycle);
    const selectedStop = stopDefinitions[selectedIndex];
    const drive = smoothSegment(
      stepPhase,
      selectionPhases.driveStart,
      selectionPhases.driveEnd,
    );
    const driving = stepPhase > selectionPhases.driveStart
      && stepPhase < selectionPhases.driveEnd;
    const wheelAngle = -toothPitch * (stepIndex + drive.progress);
    const wheelAngleDerivative = driving
      ? -toothPitch * drive.speed * demonstrationsPerCycle
      : 0;
    const wheelAngleSecondDerivative = driving
      ? -toothPitch * drive.acceleration * demonstrationsPerCycle ** 2
      : 0;
    const active = stepPhase >= selectionPhases.lowerEnd
      && stepPhase < selectionPhases.parkStart;
    let selectionAction = 'all-alternatives-parked';
    if (
      stepPhase >= selectionPhases.parkedBefore
      && stepPhase < selectionPhases.lowerEnd
    ) selectionAction = `lowering-${selectedStop.key}`;
    else if (active) selectionAction = `demonstrating-${selectedStop.key}`;
    else if (
      stepPhase >= selectionPhases.parkStart
      && stepPhase < selectionPhases.parkEnd
    ) selectionAction = `parking-${selectedStop.key}`;

    const pawls = stopDefinitions.map((stop, index) => {
      let angleDelta = stop.parkDelta;
      let angleDerivative = 0;
      let angleSecondDerivative = 0;
      let contact = null;
      let mode = 'parked-clear-of-wheel';
      if (index === selectedIndex) {
        if (
          stepPhase >= selectionPhases.parkedBefore
          && stepPhase < selectionPhases.lowerEnd
        ) {
          const lower = smoothSegment(
            stepPhase,
            selectionPhases.parkedBefore,
            selectionPhases.lowerEnd,
          );
          angleDelta = stop.parkDelta * (1 - lower.progress);
          angleDerivative = -stop.parkDelta * lower.speed
            * demonstrationsPerCycle;
          angleSecondDerivative = -stop.parkDelta * lower.acceleration
            * demonstrationsPerCycle ** 2;
          mode = 'lowering-without-contact';
        } else if (active) {
          const contactSolution = contactAtWheelAngle(
            stop,
            wheelAngle,
            driving ? null : 'reverse-lock-face',
          );
          angleDelta = normalizeAngle(
            contactSolution.angle - stop.restAngle,
          );
          if (contactSolution.contact) {
            contact = contactSolution;
            const contactSecondDerivative = contactAngleSecondDerivative(
              stop,
              wheelAngle,
              contact,
            );
            angleDerivative = contact.angleDerivative * wheelAngleDerivative;
            angleSecondDerivative = contactSecondDerivative
              * wheelAngleDerivative ** 2
              + contact.angleDerivative * wheelAngleSecondDerivative;
            if (driving) mode = `riding-${contact.edge.type}`;
            else mode = 'reverse-locked-on-steep-face';
          } else {
            mode = 'spring-returned-through-free-tooth-clearance';
          }
        } else if (
          stepPhase >= selectionPhases.parkStart
          && stepPhase < selectionPhases.parkEnd
        ) {
          const park = smoothSegment(
            stepPhase,
            selectionPhases.parkStart,
            selectionPhases.parkEnd,
          );
          angleDelta = stop.parkDelta * park.progress;
          angleDerivative = stop.parkDelta * park.speed
            * demonstrationsPerCycle;
          angleSecondDerivative = stop.parkDelta * park.acceleration
            * demonstrationsPerCycle ** 2;
          mode = 'lifting-to-park-without-contact';
        }
      }
      const angularSpeed = angleDerivative * cyclesPerSecond;
      const normalVelocityError = contact
        ? perpendicular(contact.point.clone().sub(stop.pivot))
          .multiplyScalar(angularSpeed)
          .sub(
            perpendicular(contact.point)
              .multiplyScalar(wheelAngleDerivative * cyclesPerSecond),
          )
          .dot(contact.outwardNormal)
        : null;
      return {
        angle: stop.restAngle + angleDelta,
        angleDelta,
        angularAcceleration: angleSecondDerivative * cyclesPerSecond ** 2,
        angularSpeed,
        contact,
        engaged: active && index === selectedIndex,
        key: stop.key,
        mode,
        normalVelocityError,
        nosePoint: stop.pivot.clone().add(new THREE.Vector2(
          Math.cos(stop.restAngle + angleDelta) * stop.armLength,
          Math.sin(stop.restAngle + angleDelta) * stop.armLength,
        )),
        parked: !(active && index === selectedIndex),
      };
    });
    let stage = selectionAction;
    if (active && !driving && stepPhase < selectionPhases.driveStart) {
      stage = `${selectedStop.key}-reverse-lock-before-clockwise-step`;
    } else if (active && driving) {
      stage = `${selectedStop.key}-rides-one-clockwise-tooth`;
    } else if (active) {
      stage = `${selectedStop.key}-reverse-lock-after-clockwise-step`;
    }
    return {
      activeAlternative: active ? selectedStop.key : null,
      activeAlternativeCount: active ? 1 : 0,
      cycleCoordinate,
      driveProgress: drive.progress,
      pawls,
      selectedAlternative: selectedStop.key,
      selectedIndex,
      selectionAction,
      sourcePose: Math.abs(cycleCoordinate - initialCycleCoordinate) < 1e-12,
      stage,
      stepIndex,
      stepPhase,
      wheelAngle,
      wheelAngularAcceleration: wheelAngleSecondDerivative
        * cyclesPerSecond ** 2,
      wheelAngularSpeed: wheelAngleDerivative * cyclesPerSecond,
      wheelDwelling: !driving,
      wheelPitchesAdvanced: -wheelAngle / toothPitch,
    };
  };
  const stateAtCycleCoordinate = coordinate => stateStops240(nominalStateAtCycleCoordinate(coordinate), finiteStopDefinitions, localProfilePoints, toothPitch);
  const stateAtTime = (time) => stateAtCycleCoordinate(
    initialCycleCoordinate + time * cyclesPerSecond,
  );

  root.userData.archetype =
    'three-alternative-hook-straight-gravity-and-spring-ratchet-stops';
  root.userData.blocks = {
    hookGravityStop: stopBlocks[0].group,
    hookGravityStopBody: stopBlocks[0].body,
    hookGravityStopContactMarker: stopBlocks[0].contactMarker,
    hookGravityStopPivot: stopBlocks[0].pivotShaft,
    leafSpring,
    springAnchorShaft,
    springPawlStop: stopBlocks[2].group,
    springPawlStopBody: stopBlocks[2].body,
    springPawlStopContactMarker: stopBlocks[2].contactMarker,
    springPawlStopPivot: stopBlocks[2].pivotShaft,
    straightGravityStop: stopBlocks[1].group,
    straightGravityStopBody: stopBlocks[1].body,
    straightGravityStopContactMarker: stopBlocks[1].contactMarker,
    straightGravityStopPivot: stopBlocks[1].pivotShaft,
    wheel,
    wheelBody: wheel.userData.body,
    wheelIndicator: wheel.userData.indicator,
    wheelShaft,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.05, -3.15, -0.45),
    new THREE.Vector3(4.05, 2.75, 0.7),
  );
  root.userData.contactAtWheelAngle = (stopKey, wheelAngle) => {
    const stop = stopDefinitions.find((candidate) => candidate.key === stopKey);
    if (!stop) throw new RangeError(`Unknown ratchet stop: ${stopKey}`);
    return contactAtWheelAngle(stop, wheelAngle);
  };
  root.userData.geometry = {
    cyclePeriod,
    cyclesPerSecond,
    demonstrationsPerCycle,
    initialCycleCoordinate,
    localProfileEdges,
    localProfilePoints,
    selectionPhases,
    sourceImageCenter,
    sourceScale,
    springAnchor,
    springBearingLocal,
    stopDefinitions,
    toothCount,
    toothOuterEndPhase,
    toothOuterStartPhase,
    toothPitch,
    wheelDepth,
    wheelMountPhase,
    wheelOuterRadius,
    wheelRootRadius,
  };
  root.userData.mechanism =
    'one-shared-ratchet-wheel-demonstrates-hook-straight-gravity-and-spring-stops-one-at-a-time';
  root.userData.pointInsideWheelAtAngle = pointInsideWheelAtAngle;
  root.userData.profileEdgesAtWheelAngle = profileEdgesAtWheelAngle;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 240 page marks its animation unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    corroboratingClassification: {
      edition: 7,
      figure: 1023,
      forms: [
        'hook stop',
        'straight gravity pawl',
        'spring pawl',
      ],
      publication: 'Mechanical Movements, Powers, Devices, and Appliances',
      publicationYear: 1901,
    },
    officialDescription: movement.description,
    plate240: {
      imageHeight: 525,
      imageWidth: 525,
      inferredToothCount: toothCount,
      inferredTopology:
        'three alternative stop-pawl forms arranged around one shared ratchet wheel for comparison',
      officialAnimationAvailable: false,
      rasterHookNose: sourceHookNose,
      rasterHookPivot: sourceHookPivot,
      rasterSpringAnchor: sourceSpringAnchor,
      rasterSpringNose: sourceSpringNose,
      rasterSpringJoint: sourceSpringJoint,
      rasterStraightNose: sourceStraightNose,
      rasterStraightPivot: sourceStraightPivot,
      rasterWheelCenter: sourceImageCenter,
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 61,
      edition: 21,
      illustrationPage: 60,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cyclePeriod,
    demonstrationsPerCycle,
    selectionPhases,
  };
  root.userData.transmission = {
    actuationDepictedBySource: false,
    alternativeCount: stopDefinitions.length,
    alternativesSimultaneouslyLoaded: false,
    demonstrationsPerCycle,
    direction: 'clockwise-free-running-and-reverse-locked',
    oneStopEngagedAtATime: true,
    ratchetTeethPerDemonstrationStroke: 1,
    sourceIsComparisonPlate: true,
    wheelPitchesPerCycle: -demonstrationsPerCycle,
    wheelRevolutionsPerSixCycles: -1,
  };

  const updateLeafSpring = (springPawlState) => {
    const bearing = springStopBlock.stop.pivot.clone().add(
      rotateVector(springBearingLocal, springPawlState.angleDelta),
    );
    const controlPoints = [
      springAnchor,
      new THREE.Vector2(0.85, -2.62),
      new THREE.Vector2(1.86, -2.18),
      new THREE.Vector2(1.68, -1.82),
      new THREE.Vector2(0.5, -1.88),
      bearing,
    ];
    const curve = new THREE.CatmullRomCurve3(
      controlPoints.map((point) => new THREE.Vector3(
        point.x,
        point.y,
        leafSpringPlaneZ,
      )),
      false,
      'centripetal',
    );
    leafSpring.userData.setCurve(curve);
    leafSpring.userData.bearingPoint = bearing;
  };
  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(wheel, state.wheelAngle);
    setSpin(wheelShaft, state.wheelAngle);
    for (const [index, block] of stopBlocks.entries()) {
      const pawl = state.pawls[index];
      block.group.rotation.z = pawl.angleDelta;
      block.group.userData.angularSpeed = pawl.angularSpeed;
      block.group.userData.engaged = pawl.engaged;
      block.group.userData.mode = pawl.mode;
      block.contactMarker.visible = false; // Diagnostic points are metadata, not working parts.
      if (pawl.contact) {
        block.contactMarker.position.x = pawl.contact.point.x;
        block.contactMarker.position.y = pawl.contact.point.y;
      }
    }
    updateLeafSpring(state.pawls[2]);
    wheel.userData.angularSpeed = state.wheelAngularSpeed;
    wheelShaft.userData.angularSpeed = state.wheelAngularSpeed;
    root.userData.contacts = Object.fromEntries(state.pawls.map((pawl) => [
      pawl.key,
      pawl.contact ? {
        edgeCoordinate: pawl.contact.edgeCoordinate,
        edgeType: pawl.contact.edge.type,
        engaged: true,
        normalClearance: pawl.contact.normalClearance,
        normalVelocityError: pawl.normalVelocityError,
        point: pawl.contact.point,
        toothIndex: pawl.contact.edge.toothIndex,
      } : null,
    ]));
    root.userData.kinematics = state;
  };
  finishStops240(root, finiteStopDefinitions);
  update(0);
  return finish(root, update, new THREE.Vector3(1.1, 0.7, 18));
}

function singleToothContinuousRatchetIndex(movement) {
  const root = new THREE.Group();
  const fullTurn = Math.PI * 2;
  const outputToothCount = 19;
  const outputPitch = fullTurn / outputToothCount;
  const outputRootRadius = 1.7;
  const outputDepth = 0.3;
  const driverCenter = new THREE.Vector2(-2.444, -1.261);
  const driverBodyRadius = 0.66;
  const driverContactRadius = 0.92;
  const toothOuterStartPhase = 0.9;
  const toothOuterEndPhase = 1;
  const holdingRootIndex = 14;
  const holdingPivot = new THREE.Vector2(-2.54, 1.155);
  const cyclePeriod = 4;
  const cyclesPerSecond = 1 / cyclePeriod;
  const sourceDriverAngle = THREE.MathUtils.degToRad(27);
  const sourceImageCenter = new THREE.Vector2(315, 253);
  const sourceScale = 0.013;
  const sourceDriverCenter = new THREE.Vector2(127, 350);
  const sourceDriverToothTip = new THREE.Vector2(190, 318);
  const sourceHoldingPivot = new THREE.Vector2(118, 159);
  const sourceHoldingNose = new THREE.Vector2(285, 111);

  const positiveModulo = (value, modulus) => ((value % modulus) + modulus)
    % modulus;
  const normalizeAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
  const perpendicular = (vector) => new THREE.Vector2(-vector.y, vector.x);
  const rotateVector = (vector, angle) => new THREE.Vector2(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle),
  );
  const cross2 = (first, second) => first.x * second.y - first.y * second.x;
  const sourceToWorld = (point) => new THREE.Vector2(
    (point.x - sourceImageCenter.x) * sourceScale,
    (sourceImageCenter.y - point.y) * sourceScale,
  );
  const driverTipPointAtAngle = (driverAngle) => driverCenter.clone().add(
    new THREE.Vector2(
      Math.cos(driverAngle) * driverContactRadius,
      Math.sin(driverAngle) * driverContactRadius,
    ),
  );
  const driverTipPolarAngle = (driverAngle) => {
    const point = driverTipPointAtAngle(driverAngle);
    return Math.atan2(point.y, point.x);
  };
  const driverClosestApproachAngle = Math.atan2(
    -driverCenter.y,
    -driverCenter.x,
  );
  let engagementHalfAngleLow = 0;
  let engagementHalfAngleHigh = Math.PI / 3;
  for (let iteration = 0; iteration < 72; iteration += 1) {
    const halfAngle = (
      engagementHalfAngleLow + engagementHalfAngleHigh
    ) / 2;
    const entryPolar = driverTipPolarAngle(
      driverClosestApproachAngle - halfAngle,
    );
    const exitPolar = driverTipPolarAngle(
      driverClosestApproachAngle + halfAngle,
    );
    const polarTravel = positiveModulo(entryPolar - exitPolar, fullTurn);
    if (polarTravel < outputPitch) engagementHalfAngleLow = halfAngle;
    else engagementHalfAngleHigh = halfAngle;
  }
  const driverEngagementHalfAngle = (
    engagementHalfAngleLow + engagementHalfAngleHigh
  ) / 2;
  const driverEntryAngle = driverClosestApproachAngle
    - driverEngagementHalfAngle;
  const driverExitAngle = driverClosestApproachAngle
    + driverEngagementHalfAngle;
  const driverEngagementSpan = driverExitAngle - driverEntryAngle;
  const engagementFraction = driverEngagementSpan / fullTurn;
  const entryContactPoint = driverTipPointAtAngle(driverEntryAngle);
  const activeFaceWorldAngle = Math.atan2(
    entryContactPoint.y,
    entryContactPoint.x,
  );
  const outputOuterRadius = entryContactPoint.length();
  const outputMountPhase = activeFaceWorldAngle - outputPitch;
  const initialCycleCoordinate = (
    sourceDriverAngle - driverEntryAngle
  ) / fullTurn;
  const measuredDriverCenter = sourceToWorld(sourceDriverCenter);
  const measuredDriverToothTip = sourceToWorld(sourceDriverToothTip);
  const measuredHoldingPivot = sourceToWorld(sourceHoldingPivot);
  const measuredHoldingNose = sourceToWorld(sourceHoldingNose);

  const outputWheel = makeSpringIndexedRatchet({
    boreRadius: 0.25,
    depth: outputDepth,
    mountPhase: outputMountPhase,
    outerRadius: outputOuterRadius,
    rootRadius: outputRootRadius,
    teeth: outputToothCount,
    toothOuterEndPhase,
    toothOuterStartPhase,
  });
  outputWheel.userData.role = 'nineteen-tooth-clockwise-indexed-wheel-A';
  outputWheel.userData.body.userData.role = 'source-ratchet-wheel-A-body';
  outputWheel.userData.indicator.userData.role = 'wheel-A-face-index';
  root.add(outputWheel);
  const outputShaft = makeShaft({ length: 1.12, radius: 0.12 });
  outputShaft.position.z = -0.01;
  outputShaft.userData.role = 'intermittent-output-shaft-A';
  root.add(outputShaft);

  const driverContactAtProgress = (progress) => {
    const u = THREE.MathUtils.clamp(progress, 0, 1);
    const driverAngle = driverEntryAngle + driverEngagementSpan * u;
    const driverRadiusVector = new THREE.Vector2(
      Math.cos(driverAngle) * driverContactRadius,
      Math.sin(driverAngle) * driverContactRadius,
    );
    const point = driverCenter.clone().add(driverRadiusVector);
    const rawOutputAngle = normalizeAngle(
      Math.atan2(point.y, point.x) - activeFaceWorldAngle,
    );
    const outputAngle = u === 0
      ? 0
      : (u === 1 ? -outputPitch : rawOutputAngle);
    const faceAngle = activeFaceWorldAngle + outputAngle;
    const faceTangent = new THREE.Vector2(
      Math.cos(faceAngle),
      Math.sin(faceAngle),
    );
    const faceNormal = perpendicular(faceTangent);
    const contactRadius = point.length();
    const driverLocalPoint = new THREE.Vector2(driverContactRadius, 0);
    const driverVelocityPerRadian = perpendicular(driverRadiusVector);
    const driverAccelerationPerRadianSquared = driverRadiusVector.clone()
      .negate();
    const pointRadiusSquared = point.lengthSq();
    const polarNumerator = cross2(point, driverVelocityPerRadian);
    const outputAngularDerivative = polarNumerator / pointRadiusSquared;
    const outputAngularSecondDerivative = (
      cross2(point, driverAccelerationPerRadianSquared) * pointRadiusSquared
      - polarNumerator * 2 * point.dot(driverVelocityPerRadian)
    ) / pointRadiusSquared ** 2;
    const outputVelocityPerRadian = perpendicular(point)
      .multiplyScalar(outputAngularDerivative);
    const relativeVelocityPerRadian = driverVelocityPerRadian.clone()
      .sub(outputVelocityPerRadian);
    return {
      contactRadius,
      driverAngle,
      driverAccelerationPerRadianSquared,
      driverLocalPoint,
      driverVelocityPerRadian,
      faceAngle,
      faceNormal,
      faceTangent,
      normalVelocityErrorPerRadian: relativeVelocityPerRadian.dot(faceNormal),
      outputAngle,
      outputAngularDerivative,
      outputAngularSecondDerivative,
      outputVelocityPerRadian,
      point,
      progress: u,
      radialSlidingPerRadian: relativeVelocityPerRadian.dot(faceTangent),
      toothFaceCoordinate: (
        outputOuterRadius - contactRadius
      ) / (outputOuterRadius - outputRootRadius),
    };
  };

  const driver = makePlanarRotor();
  driver.position.set(driverCenter.x, driverCenter.y, 0);
  driver.userData.role = 'continuous-counterclockwise-single-tooth-driver';
  const driverRotor = driver.userData.rotor;
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.61,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.49,
  });
  const driverDisk = new THREE.Mesh(
    new THREE.CylinderGeometry(
      driverBodyRadius,
      driverBodyRadius,
      0.24,
      64,
    ),
    driverMaterial,
  );
  driverDisk.rotation.x = Math.PI / 2;
  driverDisk.position.z = 0.18;
  driverDisk.userData.role = 'single-tooth-driver-disk';
  driverRotor.add(driverDisk);
  const driverToothShape = new THREE.Shape();
  driverToothShape.moveTo(driverContactRadius, 0);
  // Brown's tooth is a broad tapered horn rising from the disk; the leading
  // (working) edge and tip are unchanged, the trailing side is broadened.
  driverToothShape.quadraticCurveTo(0.86, -0.2, 0.72, -0.29);
  driverToothShape.quadraticCurveTo(0.58, -0.35, 0.47, -0.25);
  driverToothShape.lineTo(0.54, -0.09);
  driverToothShape.quadraticCurveTo(0.68, -0.13, 0.78, -0.1);
  driverToothShape.quadraticCurveTo(0.87, -0.07, driverContactRadius, 0);
  driverToothShape.closePath();
  const driverToothOutlinePoints = driverToothShape.getPoints(24)
    .map((point) => point.clone());
  const driverTooth = new THREE.Mesh(
    centeredExtrusion(driverToothShape, 0.18),
    driverMaterial,
  );
  driverTooth.position.z = 0.14;
  driverTooth.userData.contactTipLocal = new THREE.Vector2(
    driverContactRadius,
    0,
  );
  driverTooth.userData.outlinePoints = driverToothOutlinePoints;
  driverTooth.userData.role = 'one-source-shaped-curved-driving-tooth';
  driverRotor.add(driverTooth);
  const driverHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.64, 32),
    darkMaterial,
  );
  driverHub.rotation.x = Math.PI / 2;
  driverHub.position.z = 0.13;
  driverRotor.add(driverHub);
  const driverIndicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.05, 0.025),
    matte(PALETTE.white, { roughness: 0.47 }),
  );
  driverIndicator.position.set(0.28, 0, 0.405);
  driverIndicator.userData.role = 'single-tooth-driver-face-index';
  driverRotor.add(driverIndicator);
  driver.userData.bodyRadius = driverBodyRadius;
  driver.userData.indicator = driverIndicator;
  driver.userData.tooth = driverTooth;
  driver.userData.toothOutlinePoints = driverToothOutlinePoints;
  root.add(driver);
  const driverShaft = makeShaft({ length: 0.96, radius: 0.095 });
  driverShaft.position.set(driverCenter.x, driverCenter.y, 0.15);
  driverShaft.userData.role = 'continuous-driver-shaft';
  root.add(driverShaft);

  const localProfilePoints = outputWheel.userData.profilePoints
    .map((point) => point.clone());
  const localProfileEdges = localProfilePoints.map((start, index) => ({
    end: localProfilePoints[(index + 1) % localProfilePoints.length],
    index,
    start,
    toothIndex: Math.floor(index / 3),
    type: ['rising-ramp', 'short-tip', 'radial-lock-face'][index % 3],
  }));
  const profileEdgesAtOutputAngle = (outputAngle) => localProfileEdges
    .map((edge) => ({
      ...edge,
      end: rotateVector(edge.end, outputAngle),
      start: rotateVector(edge.start, outputAngle),
    }));
  const pointInsideOutputAtAngle = (point, outputAngle) => {
    const vertices = localProfilePoints.map((profilePoint) => (
      rotateVector(profilePoint, outputAngle)
    ));
    let inside = false;
    for (
      let index = 0, previous = vertices.length - 1;
      index < vertices.length;
      previous = index, index += 1
    ) {
      const first = vertices[index];
      const second = vertices[previous];
      if (
        (first.y > point.y) !== (second.y > point.y)
        && point.x < (second.x - first.x) * (point.y - first.y)
          / (second.y - first.y) + first.x
      ) inside = !inside;
    }
    return inside;
  };
  const pointSegmentDistance = (point, start, end) => {
    const delta = end.clone().sub(start);
    const coordinate = delta.lengthSq() > 0
      ? THREE.MathUtils.clamp(
        point.clone().sub(start).dot(delta) / delta.lengthSq(),
        0,
        1,
      )
      : 0;
    return start.clone().addScaledVector(delta, coordinate).distanceTo(point);
  };
  const circleSegmentIntersections = (center, radius, start, end) => {
    const delta = end.clone().sub(start);
    const offset = start.clone().sub(center);
    const quadratic = delta.lengthSq();
    const linear = 2 * offset.dot(delta);
    const constant = offset.lengthSq() - radius ** 2;
    const discriminant = linear ** 2 - 4 * quadratic * constant;
    if (quadratic === 0 || discriminant < -1e-11) return [];
    const rootDiscriminant = Math.sqrt(Math.max(0, discriminant));
    return [
      (-linear - rootDiscriminant) / (2 * quadratic),
      (-linear + rootDiscriminant) / (2 * quadratic),
    ].filter((coordinate, index, coordinates) => (
      coordinate >= -1e-9
      && coordinate <= 1 + 1e-9
      && (index === 0 || Math.abs(coordinate - coordinates[0]) > 1e-10)
    )).map((coordinate) => ({
      coordinate: THREE.MathUtils.clamp(coordinate, 0, 1),
      point: start.clone().addScaledVector(
        delta,
        THREE.MathUtils.clamp(coordinate, 0, 1),
      ),
    }));
  };

  const holdingSeatPoint = localProfilePoints[holdingRootIndex * 3].clone();
  const holdingArm = holdingSeatPoint.clone().sub(holdingPivot);
  const holdingArmLength = holdingArm.length();
  const holdingRestAngle = Math.atan2(holdingArm.y, holdingArm.x);
  const holdingLiftSign = Math.sign(
    holdingSeatPoint.clone().normalize().dot(perpendicular(holdingArm)),
  ) || 1;
  const holdingContactAtOutputAngle = (
    outputAngle,
    preferLockFace = false,
  ) => {
    const restPoint = holdingPivot.clone().add(new THREE.Vector2(
      Math.cos(holdingRestAngle) * holdingArmLength,
      Math.sin(holdingRestAngle) * holdingArmLength,
    ));
    const edges = profileEdgesAtOutputAngle(outputAngle);
    const pitchCoordinate = outputAngle / outputPitch;
    if (
      Math.abs(pitchCoordinate - Math.round(pitchCoordinate)) < 1e-10
    ) {
      const preferredType = preferLockFace
        ? 'radial-lock-face'
        : 'rising-ramp';
      const edge = edges
        .filter(({ type }) => type === preferredType)
        .sort((first, second) => (
          pointSegmentDistance(restPoint, first.start, first.end)
          - pointSegmentDistance(restPoint, second.start, second.end)
        ))[0];
      const edgeDelta = edge.end.clone().sub(edge.start);
      const edgeCoordinate = THREE.MathUtils.clamp(
        restPoint.clone().sub(edge.start).dot(edgeDelta)
          / edgeDelta.lengthSq(),
        0,
        1,
      );
      const edgeTangent = edgeDelta.normalize();
      const outwardNormal = new THREE.Vector2(
        edgeTangent.y,
        -edgeTangent.x,
      );
      const pawlRadius = restPoint.clone().sub(holdingPivot);
      const denominator = outwardNormal.dot(perpendicular(pawlRadius));
      return {
        angle: holdingRestAngle,
        angleDerivative: Math.abs(denominator) > 1e-10
          ? outwardNormal.dot(perpendicular(restPoint)) / denominator
          : 0,
        edge,
        edgeCoordinate,
        edgeTangent,
        lift: 0,
        normalClearance: 0,
        outwardNormal,
        point: restPoint,
      };
    }
    const boundaryDistance = Math.min(...edges.map((edge) => (
      pointSegmentDistance(restPoint, edge.start, edge.end)
    )));
    const candidates = [];
    if (
      pointInsideOutputAtAngle(restPoint, outputAngle)
      || boundaryDistance <= 2e-9
    ) {
      for (const edge of edges) {
        for (const intersection of circleSegmentIntersections(
          holdingPivot,
          holdingArmLength,
          edge.start,
          edge.end,
        )) {
          const angle = Math.atan2(
            intersection.point.y - holdingPivot.y,
            intersection.point.x - holdingPivot.x,
          );
          const lift = positiveModulo(
            holdingLiftSign * (angle - holdingRestAngle),
            fullTurn,
          );
          if (lift > Math.PI) continue;
          const outsideProbe = holdingPivot.clone().add(new THREE.Vector2(
            Math.cos(angle + holdingLiftSign * 1e-6) * holdingArmLength,
            Math.sin(angle + holdingLiftSign * 1e-6) * holdingArmLength,
          ));
          if (pointInsideOutputAtAngle(outsideProbe, outputAngle)) continue;
          candidates.push({
            angle,
            edge,
            edgeCoordinate: intersection.coordinate,
            lift,
            point: intersection.point,
          });
        }
      }
    }
    candidates.sort((first, second) => first.lift - second.lift);
    const minimumLift = candidates[0]?.lift ?? Infinity;
    const selected = preferLockFace
      ? candidates.find((candidate) => (
        candidate.edge.type === 'radial-lock-face'
        && candidate.lift <= minimumLift + 2e-8
      )) ?? candidates[0]
      : candidates[0];
    if (!selected) {
      throw new RangeError('The holding click has no collision-free contact.');
    }
    const edgeTangent = selected.edge.end.clone()
      .sub(selected.edge.start)
      .normalize();
    const outwardNormal = new THREE.Vector2(edgeTangent.y, -edgeTangent.x);
    const pawlRadius = selected.point.clone().sub(holdingPivot);
    const denominator = outwardNormal.dot(perpendicular(pawlRadius));
    return {
      ...selected,
      angleDerivative: Math.abs(denominator) > 1e-10
        ? outwardNormal.dot(perpendicular(selected.point)) / denominator
        : 0,
      edgeTangent,
      normalClearance: 0,
      outwardNormal,
    };
  };
  const holdingSecondDerivative = (outputAngle, contact) => {
    const delta = 2e-5;
    const before = holdingContactAtOutputAngle(outputAngle - delta);
    const after = holdingContactAtOutputAngle(outputAngle + delta);
    if (
      before.edge.type !== contact.edge.type
      || after.edge.type !== contact.edge.type
    ) return 0;
    return (after.angleDerivative - before.angleDerivative) / (2 * delta);
  };

  const holdingClick = new THREE.Group();
  holdingClick.position.set(holdingPivot.x, holdingPivot.y, 0);
  holdingClick.userData.role = 'upper-curved-gravity-holding-click';
  const holdingUnit = holdingArm.clone().normalize();
  const holdingNormal = perpendicular(holdingUnit);
  const holdingOutward = holdingSeatPoint.clone().normalize();
  const clickCenters = [
    new THREE.Vector2(),
    holdingArm.clone().multiplyScalar(0.25)
      .addScaledVector(holdingOutward, 0.22),
    holdingArm.clone().multiplyScalar(0.54)
      .addScaledVector(holdingOutward, 0.32),
    holdingArm.clone().multiplyScalar(0.8)
      .addScaledVector(holdingOutward, 0.2),
    holdingArm.clone().multiplyScalar(0.94)
      .addScaledVector(holdingNormal, 0.13),
    holdingArm.clone(),
  ];
  const clickOuterOffsets = [0.18, 0.18, 0.17, 0.14, 0.08, 0];
  const clickInnerOffsets = [-0.18, -0.12, -0.06, 0.02, 0.04, 0];
  const clickOuter = [];
  const clickInner = [];
  for (let index = 0; index < clickCenters.length; index += 1) {
    const previous = clickCenters[Math.max(0, index - 1)];
    const next = clickCenters[Math.min(clickCenters.length - 1, index + 1)];
    const tangent = next.clone().sub(previous).normalize();
    const normal = perpendicular(tangent);
    if (normal.dot(holdingNormal) < 0) normal.negate();
    clickOuter.push(clickCenters[index].clone().addScaledVector(
      normal,
      clickOuterOffsets[index],
    ));
    clickInner.push(clickCenters[index].clone().addScaledVector(
      normal,
      clickInnerOffsets[index],
    ));
  }
  const clickShape = new THREE.Shape();
  clickShape.moveTo(clickOuter[0].x, clickOuter[0].y);
  for (const point of clickOuter.slice(1)) clickShape.lineTo(point.x, point.y);
  for (const point of clickInner.reverse()) clickShape.lineTo(point.x, point.y);
  clickShape.closePath();
  const holdingClickOutlinePoints = clickShape.getPoints(12)
    .map((point) => point.clone());
  const clickBody = new THREE.Mesh(
    centeredExtrusion(clickShape, 0.18),
    matte(PALETTE.accent, { metalness: 0.12, roughness: 0.61 }),
  );
  clickBody.position.z = 0.14;
  clickBody.userData.outlinePoints = holdingClickOutlinePoints;
  clickBody.userData.role = 'source-curved-holding-click-body';
  holdingClick.add(clickBody);
  const clickWitness = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.045, 0.025),
    matte(PALETTE.white, { roughness: 0.47 }),
  );
  clickWitness.position.set(
    Math.cos(holdingRestAngle) * 0.34,
    Math.sin(holdingRestAngle) * 0.34,
    0.305,
  );
  clickWitness.rotation.z = holdingRestAngle;
  clickWitness.userData.role = 'holding-click-rotation-witness';
  holdingClick.add(clickWitness);
  root.add(holdingClick);
  const holdingPivotShaft = makeShaft({ length: 0.88, radius: 0.085 });
  holdingPivotShaft.position.set(holdingPivot.x, holdingPivot.y, 0.11);
  holdingPivotShaft.userData.role = 'holding-click-fixed-pivot';
  root.add(holdingPivotShaft);

  const contactMaterial = matte(PALETTE.white, { roughness: 0.46 });
  const driverContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 12),
    contactMaterial,
  );
  driverContactMarker.position.z = 0.285;
  driverContactMarker.userData.role = 'single-tooth-to-wheel-A-contact';
  const holdingContactMarker = driverContactMarker.clone();
  holdingContactMarker.userData.role = 'holding-click-to-wheel-A-contact';
  root.add(driverContactMarker, holdingContactMarker);

  const stateAtCycleCoordinate = (cycleCoordinate) => {
    const cycleIndex = Math.floor(cycleCoordinate);
    const cyclePhase = cycleCoordinate - cycleIndex;
    const driverAngle = driverEntryAngle + fullTurn * cycleCoordinate;
    const driverAngularSpeed = fullTurn * cyclesPerSecond;
    const engaged = cyclePhase >= 0 && cyclePhase < engagementFraction;
    const engagementProgress = engaged
      ? cyclePhase / engagementFraction
      : 1;
    const driverContactGeometry = engaged
      ? driverContactAtProgress(engagementProgress)
      : null;
    const withinCycleOutputAngle = driverContactGeometry
      ? driverContactGeometry.outputAngle
      : -outputPitch;
    const outputAngle = -outputPitch * cycleIndex
      + withinCycleOutputAngle;
    const outputAngularSpeed = engaged
      ? driverContactGeometry.outputAngularDerivative * driverAngularSpeed
      : 0;
    const outputAngularAcceleration = engaged
      ? driverContactGeometry.outputAngularSecondDerivative
        * driverAngularSpeed ** 2
      : 0;
    const holdingContact = holdingContactAtOutputAngle(
      outputAngle,
      !engaged,
    );
    const holdingAngleDelta = normalizeAngle(
      holdingContact.angle - holdingRestAngle,
    );
    const holdingAngularSpeed = holdingContact.angleDerivative
      * outputAngularSpeed;
    const holdingAngularAcceleration = (
      holdingSecondDerivative(outputAngle, holdingContact)
      * outputAngularSpeed ** 2
      + holdingContact.angleDerivative * outputAngularAcceleration
    );
    const holdingVelocity = perpendicular(
      holdingContact.point.clone().sub(holdingPivot),
    ).multiplyScalar(holdingAngularSpeed);
    const holdingWheelVelocity = perpendicular(holdingContact.point)
      .multiplyScalar(outputAngularSpeed);
    const driverNormalVelocityError = driverContactGeometry
      ? driverContactGeometry.normalVelocityErrorPerRadian
        * driverAngularSpeed
      : null;
    return {
      cycleCoordinate,
      cycleIndex,
      cyclePhase,
      driverAngle,
      driverAngularSpeed,
      driverContact: driverContactGeometry ? {
        ...driverContactGeometry,
        normalVelocityError: driverNormalVelocityError,
      } : null,
      driverEngaged: engaged,
      engagementProgress,
      holdingAngle: holdingRestAngle + holdingAngleDelta,
      holdingAngleDelta,
      holdingAngularAcceleration,
      holdingAngularSpeed,
      holdingContact: {
        ...holdingContact,
        normalVelocityError: holdingVelocity.clone()
          .sub(holdingWheelVelocity)
          .dot(holdingContact.outwardNormal),
      },
      outputAngle,
      outputAngularAcceleration,
      outputAngularSpeed,
      outputDwelling: !engaged,
      outputPitchesAdvanced: -outputAngle / outputPitch,
      sourcePose: Math.abs(cycleCoordinate - initialCycleCoordinate) < 1e-12,
      stage: engaged
        ? 'single-curved-tooth-indexes-wheel-A-clockwise'
        : 'upper-gravity-click-holds-wheel-A-during-driver-dwell',
    };
  };
  const stateAtTime = (time) => stateAtCycleCoordinate(
    initialCycleCoordinate + time * cyclesPerSecond,
  );

  root.userData.archetype =
    'continuous-single-curved-tooth-driver-with-nineteen-tooth-ratchet-and-holding-click';
  root.userData.blocks = {
    driver,
    driverContactMarker,
    driverDisk,
    driverIndicator,
    driverShaft,
    driverTooth,
    holdingClick,
    holdingClickBody: clickBody,
    holdingClickPivot: holdingPivotShaft,
    holdingContactMarker,
    outputShaft,
    outputWheel,
    outputWheelBody: outputWheel.userData.body,
    outputWheelIndicator: outputWheel.userData.indicator,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.35, -2.45, -0.45),
    new THREE.Vector3(2.45, 2.5, 0.65),
  );
  root.userData.driverContactAtProgress = driverContactAtProgress;
  root.userData.geometry = {
    activeFaceWorldAngle,
    cyclePeriod,
    cyclesPerSecond,
    driverBodyRadius,
    driverCenter,
    driverClosestApproachAngle,
    driverContactRadius,
    driverEngagementSpan,
    driverEngagementHalfAngle,
    driverEntryAngle,
    driverExitAngle,
    driverToothOutlinePoints,
    engagementFraction,
    holdingArm,
    holdingArmLength,
    holdingLiftSign,
    holdingClickOutlinePoints,
    holdingPivot,
    holdingRestAngle,
    holdingRootIndex,
    holdingSeatPoint,
    initialCycleCoordinate,
    localProfileEdges,
    localProfilePoints,
    outputDepth,
    outputMountPhase,
    outputOuterRadius,
    outputPitch,
    outputRootRadius,
    outputToothCount,
    sourceImageCenter,
    sourceScale,
    toothOuterEndPhase,
    toothOuterStartPhase,
  };
  root.userData.holdingContactAtOutputAngle = holdingContactAtOutputAngle;
  root.userData.mechanism =
    'one-continuously-counterclockwise-curved-tooth-rotor-indexes-wheel-A-clockwise-while-an-upper-gravity-click-holds-the-dwell';
  root.userData.pointInsideOutputAtAngle = pointInsideOutputAtAngle;
  root.userData.profileEdgesAtOutputAngle = profileEdgesAtOutputAngle;
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    reason: 'The official Movement 241 page marks its animation unavailable.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    officialDescription: movement.description,
    plate241: {
      imageHeight: 525,
      imageWidth: 525,
      inferredOutputToothCount: outputToothCount,
      inferredTopology:
        'one continuous one-tooth lower driver, one nineteen-tooth wheel A, and one upper gravity holding click',
      officialAnimationAvailable: false,
      rasterDriverCenter: sourceDriverCenter,
      rasterDriverToothTip: sourceDriverToothTip,
      rasterHoldingNose: sourceHoldingNose,
      rasterHoldingPivot: sourceHoldingPivot,
      rasterOutputCenter: sourceImageCenter,
      reconstructedDriverCenter: driverCenter,
      reconstructedHoldingPivot: holdingPivot,
      sourceMappedDriverCenter: measuredDriverCenter,
      sourceMappedDriverToothTip: measuredDriverToothTip,
      sourceMappedHoldingNose: measuredHoldingNose,
      sourceMappedHoldingPivot: measuredHoldingPivot,
      holdingPivotClosureAdjustment: holdingPivot.clone().sub(
        measuredHoldingPivot,
      ),
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 61,
      edition: 21,
      illustrationPage: 60,
      publicationYear: 1908,
    },
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtCycleCoordinate = stateAtCycleCoordinate;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    cyclePeriod,
    driverEngagementSpan,
    engagementFraction,
  };
  root.userData.transmission = {
    driverDirection: 'counterclockwise-continuous',
    driverRevolutionsPerOutputTooth: 1,
    holdingClickPresent: true,
    holdingClickReseatsAtPitchBoundary: true,
    holdingClickUsesIdealRigidImpact: true,
    outputDirection: 'clockwise-intermittent',
    outputTeeth: outputToothCount,
    outputTeethPerDriverRevolution: 1,
    outputToDriverAverageRatio: -1 / outputToothCount,
    sourceDepictsRotationArrows: true,
  };

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(driver, state.driverAngle);
    setSpin(driverShaft, state.driverAngle);
    setSpin(outputWheel, state.outputAngle);
    setSpin(outputShaft, state.outputAngle);
    holdingClick.rotation.z = state.holdingAngleDelta;
    driverContactMarker.visible = state.driverContact !== null;
    if (state.driverContact) {
      driverContactMarker.position.x = state.driverContact.point.x;
      driverContactMarker.position.y = state.driverContact.point.y;
    }
    holdingContactMarker.visible = state.holdingContact !== null;
    if (state.holdingContact) {
      holdingContactMarker.position.x = state.holdingContact.point.x;
      holdingContactMarker.position.y = state.holdingContact.point.y;
    }
    driver.userData.angularSpeed = state.driverAngularSpeed;
    driverShaft.userData.angularSpeed = state.driverAngularSpeed;
    outputWheel.userData.angularSpeed = state.outputAngularSpeed;
    outputShaft.userData.angularSpeed = state.outputAngularSpeed;
    holdingClick.userData.angularSpeed = state.holdingAngularSpeed;
    root.userData.contacts = {
      driverToWheelA: state.driverContact,
      holdingClickToWheelA: state.holdingContact,
    };
    root.userData.kinematics = state;
  };
  update(0);
  return finishSingleTooth241(finish(root, update, new THREE.Vector3(0.5, 0.5, 14)));
}

// Brown draws no phase indices, contact markers, witness dots or sector
// highlights on these plates. Parts keep their roles (tests and kinematics
// still read them) but are hidden, whatever their colour; real pins stay.
const PLATE_MARKER_ROLE = /(?:^|-)(?:index|indicator|marker|witness|highlight|endpoint)(?:-|$)/;
const MARKER_FREE_IDS = new Set([212, 213, 214, 225, 232, 235, 236, 237, 240, 241]);
const UNSHADOWED_ARBOR_IDS = new Set([212, 213, 241]);
function hidePlateMarkers(model, id) {
  model.root.traverse((object) => {
    if (!object.isMesh) return;
    // Thin arbors seen end-on otherwise cast long dark stripes across the
    // wheel faces, reading as index marks the plate does not draw.
    const cylinder = object.geometry?.parameters;
    const role = object.userData.role ?? object.name ?? '';
    if (UNSHADOWED_ARBOR_IDS.has(id) && (object.geometry?.type === 'CylinderGeometry' && cylinder.radiusTop < 0.2
      || /(?:^|-)(?:hub|arbor|shaft)(?:-|$)/.test(role))) {
      object.castShadow = false;
    }
    if (PLATE_MARKER_ROLE.test(role) || object.userData.ratchetRotationIndicator) {
      // A hidden material survives updates that toggle contact markers.
      object.material = [].concat(object.material).map((material) => {
        const hidden = material.clone();
        hidden.visible = false;
        return hidden;
      });
      if (object.material.length === 1) object.material = object.material[0];
      object.visible = false;
      object.userData.hiddenReason = 'marker not drawn on the plate';
    }
  });
  return model;
}

export function createAuthoredIntermittentCoreMovement(movement) {
  const model = createIntermittentCoreModel(movement);
  return model && MARKER_FREE_IDS.has(movement.id) ? hidePlateMarkers(model, movement.id) : model;
}

function createIntermittentCoreModel(movement) {
  switch (movement.id) {
    case 63: return snapActionStarCounter();
    case 71: return internalGuardTappetStudIndex();
    case 73: return springPressedRatchetIndex();
    case 82: return opposedTreadleAlternatingPawlRatchet();
    case 83: return opposedSpringSectorCrownRatchet();
    case 121: return reversibleClickDiskCogIndex();
    case 155: return reciprocatingElbowPawlRatchetFeed();
    case 206: return sharedPivotDoubleStrokeRatchet();
    case 211: return pinGuidedHalfToothIntermittentLockingDrive();
    case 212: return fiveSlotGenevaWindingStop();
    case 213: return splitRimFacePinWindingStop();
    case 214: return opposedGearFingerWindingStop();
    case 215: return crescentPinSixSlotWindingStop();
    case 225: return vibratingCarrierSinglePawlRatchet(movement);
    case 232: return parallelogramLiftAndDrawPawlRatchet(movement);
    case 233: return rollerAndLatchStopsForLanternWheel(movement);
    case 235: return springTappetArmStarRatchet(movement);
    case 236: return alternatingTwoPawlContinuousRatchet(movement);
    case 237: return coaxialArmCrownRatchet(movement);
    case 240: return threeAlternativeRatchetStops(movement);
    case 241: return singleToothContinuousRatchetIndex(movement);
    default: return null;
  }
}
