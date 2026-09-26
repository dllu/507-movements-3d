import * as THREE from 'three';
import { recess398Cam, finishGrooveDrive } from './groove-drive-working-parts.js';
import { makeBoredPlanarLink } from './bored-planar-link.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

// These are the six circular arcs in the official Movement 398 canvas
// model.  They form the working edge of the rounded three-sided cam groove.
const SOURCE_CONTACT_ARCS = Object.freeze([
  [4, -7.949994, 1.982629, 6, 5.635297, 0.001357],
  [4, 3.66848, 6.790009, 6, 3.924877, 4.658174],
  [4, 2.455853, -6.747401, 6, 1.446336, 2.393388],
  [4, 3.3, 0, 0.8, 4.587929, 1.516582],
  [4, -1.15, 1.991858, 0.8, 0.783284, 3.14295],
  [4, -2.527947, -2.121199, 0.8, 2.493704, 5.534981],
]);

// The second outline in the official drawing is a parallel visual edge:
// the three concave radii shrink by 0.5 and the three convex radii grow by
// 0.5.  Contact is calculated against SOURCE_CONTACT_ARCS only.
const SOURCE_OFFSET_ARCS = Object.freeze([
  [4, 3.66848, 6.790009, 5.5, 3.924877, 4.658174],
  [4, -1.15, 1.991858, 1.3, 0.783284, 3.14295],
  [4, -7.949994, 1.982629, 5.5, 5.635297, 0.001357],
  [4, -2.527947, -2.121199, 1.3, 2.493704, 5.534981],
  [4, 2.455853, -6.747401, 5.5, 1.446336, 2.393388],
  [4, 3.3, 0, 1.3, 4.587929, 1.516582],
]);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function normalizedAngle(angle) {
  return positiveModulo(angle, FULL_TURN);
}

function angleInSourceArc(angle, startAngle, endAngle) {
  const normalized = normalizedAngle(angle);
  const start = normalizedAngle(startAngle);
  const end = normalizedAngle(endAngle);
  if (Math.abs(normalized - start) < 1e-12
      || Math.abs(normalized - end) < 1e-12) return true;
  return start > end
    ? normalized > start || normalized < end
    : normalized > start && normalized < end;
}

function shortestSweep(startAngle, endAngle) {
  let sweep = normalizedAngle(endAngle - startAngle);
  if (sweep > Math.PI) sweep -= FULL_TURN;
  return sweep;
}

function rotatePoint(x, y, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * x - sine * y,
    sine * x + cosine * y,
  );
}

class PlanarArcCurve3 extends THREE.Curve {
  constructor(center, radius, startAngle, sweep, z) {
    super();
    this.center = center.clone();
    this.radius = radius;
    this.startAngle = startAngle;
    this.sweep = sweep;
    this.z = z;
  }

  getPoint(parameter, target = new THREE.Vector3()) {
    const angle = this.startAngle + this.sweep * parameter;
    return target.set(
      this.center.x + this.radius * Math.cos(angle),
      this.center.y + this.radius * Math.sin(angle),
      this.z,
    );
  }

  getPointAt(parameter, target = new THREE.Vector3()) {
    return this.getPoint(parameter, target);
  }

  getTangent(parameter, target = new THREE.Vector3()) {
    const angle = this.startAngle + this.sweep * parameter;
    return target.set(
      -Math.sin(angle) * Math.sign(this.sweep),
      Math.cos(angle) * Math.sign(this.sweep),
      0,
    );
  }

  getTangentAt(parameter, target = new THREE.Vector3()) {
    return this.getTangent(parameter, target);
  }
}

function cylinderAlongZ(radius, length, material, segments = 36) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
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

function makeDynamicRod(radius, material) {
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 1, 26),
    material,
  );
  rod.userData.setEndpoints = (start, end) => {
    const direction = end.clone().sub(start);
    rod.position.copy(start).add(end).multiplyScalar(0.5);
    rod.scale.set(1, direction.length(), 1);
    rod.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );
  };
  return rod;
}

function circleIntersections(firstCenter, firstRadius, secondCenter,
  secondRadius) {
  const direction = secondCenter.clone().sub(firstCenter);
  const distance = direction.length();
  const along = (firstRadius ** 2 - secondRadius ** 2 + distance ** 2)
    / (2 * distance);
  const height = Math.sqrt(Math.max(0, firstRadius ** 2 - along ** 2));
  const unit = direction.multiplyScalar(1 / distance);
  const base = firstCenter.clone().addScaledVector(unit, along);
  const normal = new THREE.Vector2(-unit.y, unit.x).multiplyScalar(height);
  return [base.clone().add(normal), base.clone().sub(normal)];
}

function makeCam({
  contactArcs,
  darkMaterial,
  driverMaterial,
  scale,
  whiteMaterial,
}) {
  const cam = new THREE.Group();
  cam.userData.role =
    'constant-speed-clockwise-disc-cam-with-rounded-three-sided-groove';

  const disk = cylinderAlongZ(5 * scale, 0.42, driverMaterial, 72);
  disk.userData.role = 'single-solid-input-cam-disc';
  cam.add(disk);

  const addArcSet = (arcs, role) => arcs.map((arc, index) => {
    const [, centerX, centerY, radius, startAngle, endAngle] = arc;
    const curve = new PlanarArcCurve3(
      new THREE.Vector2(centerX * scale, centerY * scale),
      radius * scale,
      startAngle,
      shortestSweep(startAngle, endAngle),
      0.255,
    );
    const edge = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 34, 0.038, 10, false),
      darkMaterial,
    );
    edge.userData.arcIndex = index;
    edge.userData.role = role;
    cam.add(edge);
    return edge;
  });
  const contactEdges = addArcSet(
    contactArcs,
    'exact-working-edge-of-three-sided-cam-groove',
  );
  const offsetEdges = addArcSet(
    SOURCE_OFFSET_ARCS,
    'parallel-visible-edge-of-three-sided-cam-groove',
  );

  const shaft = cylinderAlongZ(0.32, 0.84, darkMaterial, 32);
  shaft.position.z = -0.05;
  shaft.userData.role = 'fixed-axis-input-camshaft';
  cam.add(shaft);

  const index = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 22, 14),
    whiteMaterial,
  );
  index.position.set(4.58 * scale, 0, 0.37);
  index.userData.role = 'white-index-showing-constant-cam-rotation';
  cam.add(index);

  cam.userData.contactEdges = contactEdges;
  cam.userData.disk = disk;
  cam.userData.index = index;
  cam.userData.offsetEdges = offsetEdges;
  cam.userData.shaft = shaft;
  recess398Cam(cam,contactArcs,scale);
  return markShadows(cam);
}

function makeFollower({
  darkMaterial,
  followerMaterial,
  rollerRadius,
  scale,
  whiteMaterial,
}) {
  const follower = new THREE.Group();
  follower.userData.role =
    'one-piece-horizontal-roller-crosshead-and-rod-pivot-carriage';

  const roller = cylinderAlongZ(rollerRadius, 0.62, followerMaterial, 32);
  roller.position.z = 0.37;
  roller.userData.role = 'cam-contact-roller-constrained-to-horizontal-line';
  follower.add(roller);

  const pivotOffset = 8.197955 * scale;
  const railStart = 0.57 * scale;
  const railEnd = 7.43 * scale;
  const rails = [-0.095, 0.095].map((y) => {
    const rail = beamBetween(
      new THREE.Vector3(railStart, y, 0.55),
      new THREE.Vector3(railEnd, y, 0.55),
      0.075,
      0.16,
      followerMaterial,
    );
    rail.userData.role = 'horizontal-follower-crosshead-rail';
    follower.add(rail);
    return rail;
  });

  const blocks = [4.65, 7.35].map((sourceX) => {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.72, 0.36),
      followerMaterial,
    );
    block.position.set(sourceX * scale, 0, 0.45);
    block.userData.role = 'guided-follower-crosshead-block';
    follower.add(block);
    return block;
  });

  const pivot = cylinderAlongZ(0.14, 0.58, darkMaterial, 28);
  pivot.position.set(pivotOffset, 0, 0.54);
  pivot.userData.role = 'crosshead-pin-to-finite-connecting-rod';
  follower.add(pivot);
  const pivotIndex = cylinderAlongZ(0.072, 0.10, whiteMaterial, 22);
  pivotIndex.position.set(pivotOffset, 0, 0.89);
  pivotIndex.userData.role = 'white-index-on-crosshead-rod-pin';
  follower.add(pivotIndex);

  follower.userData.blocks = blocks;
  follower.userData.pivot = pivot;
  follower.userData.pivotIndex = pivotIndex;
  follower.userData.rails = rails;
  follower.userData.roller = roller;
  return markShadows(follower);
}

function makeOutputWheel({
  crankVector,
  darkMaterial,
  drivenMaterial,
  radius,
  whiteMaterial,
}) {
  const wheel = new THREE.Group();
  wheel.userData.role =
    'intermittently-rocking-output-wheel-with-offset-crank-pin';

  // Brown draws the output wheel as a plain disc, not a spoked rim.
  const rim = cylinderAlongZ(radius + 0.12, 0.24, drivenMaterial, 96);
  rim.position.z = 0.10;
  rim.userData.role = 'rocking-output-wheel-rim';
  wheel.add(rim);
  const spokes = [];

  const hub = cylinderAlongZ(0.31, 0.56, darkMaterial, 32);
  hub.position.z = 0.10;
  hub.userData.role = 'fixed-axis-output-wheel-hub';
  wheel.add(hub);

  const crankStart = new THREE.Vector3(0, 0, 0.39);
  const crankEnd = new THREE.Vector3(
    crankVector.x,
    crankVector.y,
    0.39,
  );
  const crankArm = beamBetween(
    crankStart,
    crankEnd,
    0.18,
    0.22,
    drivenMaterial,
  );
  crankArm.userData.role = 'output-wheel-offset-crank-arm';
  wheel.add(crankArm);
  const crankPin = cylinderAlongZ(0.145, 0.64, darkMaterial, 30);
  crankPin.position.set(crankVector.x, crankVector.y, 0.50);
  crankPin.userData.role = 'output-crank-pin-driven-by-finite-rod';
  wheel.add(crankPin);

  const index = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 0.45, 0.085, 0.05),
    whiteMaterial,
  );
  index.position.set(radius * 0.72, 0, 0.28);
  index.userData.role = 'white-radial-index-showing-output-rocking-angle';
  wheel.add(index);

  wheel.userData.crankArm = crankArm;
  wheel.userData.crankPin = crankPin;
  wheel.userData.hub = hub;
  wheel.userData.index = index;
  wheel.userData.rim = rim;
  wheel.userData.spokes = spokes;
  return markShadows(wheel);
}

function camRockingDrive(movement) {
  const root = new THREE.Group();

  // The dimensions below are copied from the official canvas model and then
  // uniformly scaled and translated for this 3-D scene.  The source contact
  // algorithm advances a circular roller from the right-hand end of its
  // guide until the first positive contact with one of the rotating arcs.
  const sourceScale = 0.40;
  const sourceOffsetX = -3.82;
  const cycleDuration = 7;
  const sourceGuideStart = new THREE.Vector2(15.5, 0);
  const sourceGuideEnd = new THREE.Vector2(0.5, 0);
  const sourceRollerRadius = 0.25;
  const sourceFollowerPivotOffset = 8.197955;
  const sourceConnectingRodLength = 8;
  const sourceOutputCenter = new THREE.Vector2(19.070509, 0);
  const sourceOutputReferencePoint = new THREE.Vector2(
    17.610726,
    0.531318,
  );
  const sourceOutputCrankVector = new THREE.Vector2(
    -1.459783,
    0.531318,
  );
  const sourceOutputCrankRadius = sourceOutputCrankVector.length();
  const sourceOutputReferenceAngle = Math.atan2(
    sourceOutputCrankVector.y,
    sourceOutputCrankVector.x,
  );

  const toWorldPoint = (sourcePoint) => new THREE.Vector2(
    sourceOffsetX + sourcePoint.x * sourceScale,
    sourcePoint.y * sourceScale,
  );

  const sourceFollowerAtPhase = (unwrappedPhase) => {
    const phase = positiveModulo(unwrappedPhase, 1);
    const camAngle = -FULL_TURN * phase;
    let guideDistance = sourceGuideStart.distanceTo(sourceGuideEnd);
    let activeContact = null;

    const acceptCandidate = (candidate, arcIndex, contactKind,
      transformedArc, endpoint = null) => {
      if (candidate > 0 && candidate < guideDistance) {
        guideDistance = candidate;
        activeContact = {
          arcIndex,
          contactKind,
          endpoint,
          transformedArc,
        };
      }
    };

    SOURCE_CONTACT_ARCS.forEach((arc, arcIndex) => {
      const [, centerX, centerY, radius, startAngle, endAngle] = arc;
      const worldCenter = rotatePoint(centerX, centerY, camAngle);

      // Transform the cam arc into the source animation's guide coordinate:
      // +x proceeds leftward from (15.5, 0).
      const guideCenterX = sourceGuideStart.x - worldCenter.x;
      const guideCenterY = -worldCenter.y;
      const guideStartAngle = startAngle + camAngle + Math.PI;
      const guideEndAngle = endAngle + camAngle + Math.PI;
      const transformedArc = {
        center: worldCenter,
        endAngle: endAngle + camAngle,
        guideCenterX,
        guideCenterY,
        guideEndAngle,
        guideStartAngle,
        radius,
        startAngle: startAngle + camAngle,
      };

      for (const endpointAngle of [guideStartAngle, guideEndAngle]) {
        const endpointX = guideCenterX + radius * Math.cos(endpointAngle);
        const endpointY = guideCenterY + radius * Math.sin(endpointAngle);
        if (Math.abs(endpointY) <= sourceRollerRadius) {
          const rollerEdgeX = Math.sqrt(Math.max(
            0,
            sourceRollerRadius ** 2 - endpointY ** 2,
          ));
          acceptCandidate(
            endpointX - rollerEdgeX,
            arcIndex,
            'arc-endpoint-to-roller-circle',
            transformedArc,
            new THREE.Vector2(
              sourceGuideStart.x - endpointX,
              -endpointY,
            ),
          );
        }
      }

      const differenceRadius = radius - sourceRollerRadius;
      if (differenceRadius > 0
          && Math.abs(guideCenterY) <= differenceRadius) {
        const tangentAngle = Math.asin(
          -guideCenterY / differenceRadius,
        );
        if (angleInSourceArc(
          tangentAngle,
          guideStartAngle,
          guideEndAngle,
        )) {
          acceptCandidate(
            guideCenterX
              + differenceRadius * Math.cos(tangentAngle),
            arcIndex,
            'internal-circle-tangency',
            transformedArc,
          );
        }
      }

      const sumRadius = radius + sourceRollerRadius;
      if (Math.abs(guideCenterY) <= sumRadius) {
        const tangentAngle = Math.asin(-guideCenterY / sumRadius);
        if (angleInSourceArc(
          Math.PI - tangentAngle,
          guideStartAngle,
          guideEndAngle,
        )) {
          acceptCandidate(
            guideCenterX - sumRadius * Math.cos(tangentAngle),
            arcIndex,
            'external-circle-tangency',
            transformedArc,
          );
        }
      }
    });

    const rollerCenter = new THREE.Vector2(
      sourceGuideStart.x - guideDistance,
      0,
    );
    const followerPivot = rollerCenter.clone().add(
      new THREE.Vector2(sourceFollowerPivotOffset, 0),
    );
    return {
      activeContact,
      camAngle,
      guideDistance,
      followerPivot,
      phase,
      rollerCenter,
    };
  };

  const sourceStateAtPhase = (unwrappedPhase) => {
    const followerState = sourceFollowerAtPhase(unwrappedPhase);
    const candidates = circleIntersections(
      followerState.followerPivot,
      sourceConnectingRodLength,
      sourceOutputCenter,
      sourceOutputCrankRadius,
    );
    const outputCrankPoint = candidates[0].distanceToSquared(
      sourceOutputReferencePoint,
    ) <= candidates[1].distanceToSquared(sourceOutputReferencePoint)
      ? candidates[0] : candidates[1];
    const crankWorldAngle = Math.atan2(
      outputCrankPoint.y - sourceOutputCenter.y,
      outputCrankPoint.x - sourceOutputCenter.x,
    );
    return {
      ...followerState,
      connectingRodLength: followerState.followerPivot.distanceTo(
        outputCrankPoint,
      ),
      outputCrankPoint,
      outputRotorAngle: crankWorldAngle - sourceOutputReferenceAngle,
    };
  };

  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.54,
  });
  const followerMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.45,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.67,
  });
  const rodMaterial = matte(0x3f8057, {
    metalness: 0.10,
    roughness: 0.58,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });

  const cam = makeCam({
    contactArcs: SOURCE_CONTACT_ARCS,
    darkMaterial,
    driverMaterial,
    scale: sourceScale,
    whiteMaterial,
  });
  cam.position.set(sourceOffsetX, 0, 0);
  root.add(cam);

  const follower = makeFollower({
    darkMaterial,
    followerMaterial,
    rollerRadius: sourceRollerRadius * sourceScale,
    scale: sourceScale,
    whiteMaterial,
  });
  root.add(follower);

  const outputCenter = toWorldPoint(sourceOutputCenter);
  const outputCrankVector = sourceOutputCrankVector.clone().multiplyScalar(
    sourceScale,
  );
  const outputWheel = makeOutputWheel({
    crankVector: outputCrankVector,
    darkMaterial,
    drivenMaterial: followerMaterial,
    radius: 5 * sourceScale,
    whiteMaterial,
  });
  outputWheel.position.set(outputCenter.x, outputCenter.y, 0);
  root.add(outputWheel);

  const connectingRod = makeBoredPlanarLink({length:sourceConnectingRodLength*sourceScale,width:.21,eyeRadius:.22,boreRadius:.148,depth:.12},rodMaterial);
  connectingRod.userData.role =
    'single-finite-connecting-rod-from-crosshead-to-output-crank';
  root.add(markShadows(connectingRod));

  const guideSourceStart = 5.573977;
  const guideSourceEnd = 12.573977;
  const guideStartX = sourceOffsetX + guideSourceStart * sourceScale;
  const guideEndX = sourceOffsetX + guideSourceEnd * sourceScale;
  const guides = [-0.44, 0.44].map((guideY) => {
    const guide = beamBetween(
      new THREE.Vector3(guideStartX, guideY, 0.43),
      new THREE.Vector3(guideEndX, guideY, 0.43),
      0.15,
      0.40,
      frameMaterial,
    );
    guide.userData.role = 'fixed-horizontal-crosshead-guide';
    root.add(guide);
    return guide;
  });

  const baseY = -2.55;
  const base = beamBetween(
    new THREE.Vector3(sourceOffsetX - 0.55, baseY, -0.20),
    new THREE.Vector3(outputCenter.x + 0.62, baseY, -0.20),
    0.18,
    0.32,
    frameMaterial,
  );
  base.userData.role = 'fixed-base-for-cam-guides-and-output-shaft';
  const supports = [sourceOffsetX, guideStartX, guideEndX, outputCenter.x]
    .map((supportX) => {
      const support = beamBetween(
        new THREE.Vector3(supportX, baseY, -0.20),
        new THREE.Vector3(supportX, -0.83, -0.20),
        0.15,
        0.28,
        frameMaterial,
      );
      support.userData.role = 'fixed-mechanism-bearing-support';
      root.add(support);
      return support;
    });
  root.add(base);

  // Pass 64: Brown draws no frame, legs or back bar. The cam and output
  // shafts end as short plain stubs behind their discs; the drawn crosshead
  // guide bars are fixed ideal constraints, as elsewhere in the family.
  for (const [parent, z0] of [[cam, -0.47], [outputWheel, -0.18]]) {
    const stubLength = 0.30;
    const journal = cylinderAlongZ(0.16, stubLength, darkMaterial, 32);
    journal.position.z = z0 + 0.02 - stubLength / 2;
    journal.userData.role = 'plain-shaft-stub-behind-disc';
    parent.add(journal);
  }

  const finiteDifferencePhase = 1e-5;
  const stateAtTime = (time) => {
    const cycleCoordinate = time / cycleDuration;
    const sourceState = sourceStateAtPhase(cycleCoordinate);
    const before = sourceStateAtPhase(
      cycleCoordinate - finiteDifferencePhase,
    );
    const after = sourceStateAtPhase(
      cycleCoordinate + finiteDifferencePhase,
    );
    let outputAngleDifference = after.outputRotorAngle
      - before.outputRotorAngle;
    if (outputAngleDifference > Math.PI) outputAngleDifference -= FULL_TURN;
    if (outputAngleDifference < -Math.PI) outputAngleDifference += FULL_TURN;
    const outputAngularSpeed = outputAngleDifference
      / (2 * finiteDifferencePhase * cycleDuration);
    const followerVelocity = (
      after.followerPivot.x - before.followerPivot.x
    ) * sourceScale / (2 * finiteDifferencePhase * cycleDuration);
    const rollerCenterWorld = toWorldPoint(sourceState.rollerCenter);
    const followerPivotWorld = toWorldPoint(sourceState.followerPivot);
    const outputCrankPointWorld = toWorldPoint(
      sourceState.outputCrankPoint,
    );
    const activeArc = sourceState.activeContact.transformedArc;
    const arcCenterWorld = toWorldPoint(activeArc.center);
    const centerDistance = rollerCenterWorld.distanceTo(arcCenterWorld);
    let camRollerCenterDistanceError;
    if (sourceState.activeContact.contactKind
        === 'internal-circle-tangency') {
      camRollerCenterDistanceError = centerDistance
        - (activeArc.radius - sourceRollerRadius) * sourceScale;
    } else if (sourceState.activeContact.contactKind
        === 'external-circle-tangency') {
      camRollerCenterDistanceError = centerDistance
        - (activeArc.radius + sourceRollerRadius) * sourceScale;
    } else {
      camRollerCenterDistanceError = rollerCenterWorld.distanceTo(
        toWorldPoint(sourceState.activeContact.endpoint),
      ) - sourceRollerRadius * sourceScale;
    }
    return {
      activeCamArcIndex: sourceState.activeContact.arcIndex,
      camAngle: -FULL_TURN * cycleCoordinate,
      camAngularSpeed: -FULL_TURN / cycleDuration,
      camContactKind: sourceState.activeContact.contactKind,
      camRollerCenterDistanceError,
      cycleCoordinate,
      cyclePhase: positiveModulo(cycleCoordinate, 1),
      followerPivotWorld,
      followerVelocity,
      guideError: Math.abs(rollerCenterWorld.y),
      outputAngularSpeed,
      outputCrankPointWorld,
      outputRotorAngle: sourceState.outputRotorAngle,
      rollerCenterWorld,
      sourceState,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    cam.rotation.z = state.camAngle;
    follower.position.set(
      state.rollerCenterWorld.x,
      state.rollerCenterWorld.y,
      0,
    );
    outputWheel.rotation.z = state.outputRotorAngle;
    connectingRod.userData.setEndpoints(
      new THREE.Vector3(
        state.followerPivotWorld.x,
        state.followerPivotWorld.y,
        0.72,
      ),
      new THREE.Vector3(
        state.outputCrankPointWorld.x,
        state.outputCrankPointWorld.y,
        0.72,
      ),
    );
    root.userData.contacts = {
      camToFollowerRoller: {
        active: true,
        arcIndex: state.activeCamArcIndex,
        centerDistanceError: state.camRollerCenterDistanceError,
        kind: state.camContactKind,
        rollerCenter: state.rollerCenterWorld.clone(),
      },
      connectingRodToCrosshead: {
        active: true,
        point: state.followerPivotWorld.clone(),
      },
      connectingRodToOutputCrank: {
        active: true,
        lengthError: state.followerPivotWorld.distanceTo(
          state.outputCrankPointWorld,
        ) - sourceConnectingRodLength * sourceScale,
        point: state.outputCrankPointWorld.clone(),
      },
    };
    root.userData.kinematics = state;
  };

  const referenceState = sourceStateAtPhase(0);
  root.userData = {
    archetype:
      'constant-speed-three-sided-disc-cam-driving-horizontal-roller-crosshead-finite-rod-and-intermittently-rocking-wheel',
    blocks: {
      base,
      cam,
      connectingRod,
      follower,
      guides,
      outputWheel,
      supports,
    },
    constraintResiduals: {
      referenceConnectingRodLength:
        referenceState.connectingRodLength - sourceConnectingRodLength,
      referenceFollowerPivotX:
        referenceState.followerPivot.x - 12.547955,
      referenceOutputCrankPointX:
        referenceState.outputCrankPoint.x - 20.530291785460342,
      referenceOutputCrankPointY:
        referenceState.outputCrankPoint.y - 0.5313185894420261,
    },
    constraints: {
      cam:
        'The one input cam turns clockwise at exactly one constant-speed revolution per cycle; its six source arcs rotate as one rigid profile.',
      follower:
        'One circular roller and its crosshead translate only along the fixed horizontal guide, at the first positive contact with the rotating cam profile.',
      output:
        'A fixed-radius crank on one fixed-axis wheel is joined to the crosshead by one rigid finite connecting rod.',
    },
    degreesOfFreedom: {
      dependentCoordinates: [
        'horizontal roller and crosshead displacement selected by cam contact',
        'finite-rod output crank angle',
      ],
      independentPrescribedInputs: 1,
      inputs: ['constant-speed clockwise cam angle'],
      note:
        'The cam-contact, guide, finite-rod, and output-crank constraints close the single-input chain.',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'rigid cam, roller, crosshead, connecting rod, wheel, and frame',
        'zero-clearance circular-arc cam contact',
        'constant input angular speed',
        'inertia, friction, backlash, elasticity, gravity, and load omitted',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      type: 'dimensionless constrained rigid-body kinematics',
    },
    fidelity: 'authored',
    geometry: {
      cycleDuration,
      outputCenter,
      outputCrankRadius: sourceOutputCrankRadius * sourceScale,
      rollerRadius: sourceRollerRadius * sourceScale,
      sourceConnectingRodLength,
      sourceContactArcs: SOURCE_CONTACT_ARCS.map((arc) => [...arc]),
      sourceFollowerPivotOffset,
      sourceGuideEnd: sourceGuideEnd.clone(),
      sourceGuideStart: sourceGuideStart.clone(),
      sourceOffsetX,
      sourceOutputCenter: sourceOutputCenter.clone(),
      sourceOutputCrankRadius,
      sourceOutputCrankVector: sourceOutputCrankVector.clone(),
      sourceOutputReferencePoint: sourceOutputReferencePoint.clone(),
      sourceRollerRadius,
      sourceScale,
    },
    mechanism:
      'one-constant-speed-clockwise-rounded-three-sided-disc-cam-positively-positions-one-horizontal-roller-crosshead-whose-single-finite-rod-rocks-one-fixed-axis-output-wheel-intermittently',
    motion: {
      cycleDuration,
      inputDirection: 'clockwise continuously',
      outputCharacter:
        'nonuniform alternating circular arcs with instantaneous reversals/rests, returning after each cam revolution',
      outputIsContinuousUnidirectionalRotation: false,
    },
    sourceAnimation: {
      available: true,
      canvasGeometryReproduced: true,
      independentlyReconstructed: false,
      officialCanvasModelPresent: true,
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      constructionEvidence: {
        explicitInBrownDescription: [
          'continuous circular input',
          'intermittent circular output',
          'cam C is the driver',
        ],
        officialAnimationEvidence:
          'The official canvas defines one clockwise rotating cam, one circular roller on a horizontal crosshead, one finite rod, and one fixed-axis output crank/wheel.',
        reproductionDisclosure:
          'The six working cam arcs, roller radius, guide, follower-pivot offset, rod length, output center, crank reference, and circle-intersection branch are reproduced numerically from the official canvas model. Only uniform scene scale, translation, depth, materials, and demonstration period are added.',
      },
      officialCanvasCheckpoints: [
        [0, 12.547955, 20.530292, 0.531319, -2.44346],
        [0.25, 10.560238, 18.433751, 1.41697, -0.799392],
        [0.5, 10.750572, 18.611694, 1.484168, -0.92191],
        [0.75, 9.746194, 17.710832, 0.751361, -0.155773],
        [1, 12.547955, 20.530292, 0.531319, -2.44346],
      ],
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 398',
    },
    sourceStateAtPhase,
    stateAtTime,
    timeline: {
      cycleDuration,
      inputRevolutionsPerCycle: -1,
    },
    transmission: {
      camContactLaw:
        'advance the roller from the guide start to the smallest positive separation produced by endpoint or circle-circle contact with the six rotating source arcs',
      outputLaw:
        'intersect the radius-8 rod circle about the crosshead pin with the radius-1.553... crank circle about the output shaft and select the source-reference assembly branch',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-6.08, -2.72, -0.70),
    new THREE.Vector3(6.05, 2.50, 1.15),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(0.25, 0.2, 16);
  root.userData.reconstructionNote = 'The cam arcs and follower/link closure reproduce the official 2D animation. Finite recessed walls add small running clearance around its ideal contact law. Input motion and follower branch are prescribed; loads, friction and backlash are not dynamically solved.';
  finishGrooveDrive(root,cycleDuration);
  root.userData.groundFloorY = -2.66;
  update(0);
  return { root, update, cameraDirection: root.userData.cameraDirection };
}

export function createAuthoredCamRockingDriveMovement(movement) {
  if (movement.id !== 398) return null;
  return camRockingDrive(movement);
}
