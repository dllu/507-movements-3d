import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { helicalThread, threadAngles } from './mujoco-screw/thread-geometry.js';
import { horizontalRing } from './horizontal-turbine-solids.js';
import { ring, plate, sector } from './finite-plate-geometry.js';
import { waterVolume, waterVolumeMaterial } from './water-volume.js';
import { flowingStreamSurface } from './flowing-stream-surface.js';
import {WaterStream,collectWaterStreams,ballisticPath,solveBallisticSpeed} from './water-stream.js';
import { makeSeeThrough } from './see-through-part.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

// A tube swept along a curve with flat end caps, so it is a closed solid.
function cappedTube(curve, tubularSegments, radius, radialSegments) {
  const tube = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false).toNonIndexed();
  const ringSize = radialSegments + 1;
  const tubeIndex = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
  const ringPoint = (ring, j) => new THREE.Vector3().fromBufferAttribute(tubeIndex.attributes.position, ring * ringSize + j);
  const caps = [];
  for (const [ring, t, flip] of [[0, 0, true], [tubularSegments, 1, false]]) {
    const center = curve.getPoint(t);
    for (let j = 0; j < radialSegments; j += 1) {
      const a = ringPoint(ring, j), b = ringPoint(ring, j + 1);
      caps.push(...(flip ? [center, b, a] : [center, a, b]));
    }
  }
  const cap = new THREE.BufferGeometry().setFromPoints(caps);
  cap.computeVertexNormals();
  cap.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(caps.length * 2), 2));
  const merged = mergeGeometries([tube, cap]);
  [tube, tubeIndex, cap].forEach(g => g.dispose());
  return merged;
}

function smoothStep5(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped ** 3 * (clamped * (clamped * 6 - 15) + 10);
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function makeHelicalRibbonGeometry({
  bottomCrossAngle,
  innerRadius,
  length,
  outerRadius,
  turns,
}) {
  const samples = turns * 56;
  const positions = [];
  const indices = [];
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const angle = bottomCrossAngle - FULL_TURN * turns * progress;
    const y = -length / 2 + length * progress;
    positions.push(
      innerRadius * Math.cos(angle),
      y,
      innerRadius * Math.sin(angle),
      outerRadius * Math.cos(angle),
      y,
      outerRadius * Math.sin(angle),
    );
    if (index < samples) {
      const first = index * 2;
      indices.push(
        first,
        first + 1,
        first + 2,
        first + 1,
        first + 3,
        first + 2,
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function streamDrivenArchimedesScrew(movement) {
  const root = new THREE.Group();
  const shaftRevolutionDuration = 11;
  const inputAngularSpeed = FULL_TURN / shaftRevolutionDuration;
  const lowerEnd = new THREE.Vector3(1.72, -1.10, 0);
  const upperEnd = new THREE.Vector3(-1.72, 2.48, 0);
  const axisVector = upperEnd.clone().sub(lowerEnd);
  const screwLength = axisVector.length();
  const axisDirection = axisVector.clone().normalize();
  const assemblyCenter = lowerEnd.clone().add(upperEnd).multiplyScalar(0.5);
  const assemblyQuaternion = new THREE.Quaternion().setFromUnitVectors(
    Y_AXIS,
    axisDirection,
  );
  const assemblyQuaternionInverse = assemblyQuaternion.clone().invert();
  const casingRadius = 0.68;
  const centralShaftRadius = 0.14;
  const helixInnerRadius = 0.16;
  const helixOuterRadius = 0.60;
  const helixTurns = 5;
  const transportCycleDuration = shaftRevolutionDuration * helixTurns;
  const screwPitch = screwLength / helixTurns;
  const bottomCrossAngle = Math.PI;
  const waterPocketRadius = 0.38;
  const waterPocketCount = helixTurns;
  const waterPocketFadeFraction = 0.08;
  const wheelLocalY = -screwLength / 2 - 0.18;
  // Brown's paddle disc is well over twice the casing's diameter.
  const waterWheelRadius = 1.6;
  const waterWheelPaddleCount = 12;
  const streamSurfaceY = -1.34;
  const streamVelocityZ = 1.34;
  const representativeStreamForce = 6.1;
  const streamDriveTorque = waterWheelRadius
    * representativeStreamForce;
  const dischargeTroughY = 1.82;
  const groundY = -3.60;

  const worldFromAssemblyLocal = (localPoint) => localPoint.clone()
    .applyQuaternion(assemblyQuaternion)
    .add(assemblyCenter);

  const localFromWorldDirection = (worldDirection) => worldDirection.clone()
    .applyQuaternion(assemblyQuaternionInverse);

  const projectedGravityLocal = localFromWorldDirection(
    new THREE.Vector3(0, -1, 0)
      .addScaledVector(axisDirection, axisDirection.y),
  ).normalize();
  const waterWheelCenter = worldFromAssemblyLocal(
    new THREE.Vector3(0, wheelLocalY, 0),
  );

  const waterPocketState = (
    markerIndex,
    inputRotation,
    shaftRevolutions,
  ) => {
    const axialCycles = THREE.MathUtils.euclideanModulo(
      shaftRevolutions + markerIndex,
      helixTurns,
    );
    const axialFraction = axialCycles / helixTurns;
    const localPosition = new THREE.Vector3(
      waterPocketRadius * Math.cos(bottomCrossAngle),
      -screwLength / 2 + screwLength * axialFraction,
      waterPocketRadius * Math.sin(bottomCrossAngle),
    );
    const bladeLocalAngle = bottomCrossAngle
      - FULL_TURN * helixTurns * axialFraction;
    const bladeWorldCrossAngle = bladeLocalAngle + inputRotation;
    const markerScale = smoothStep5(
      axialFraction / waterPocketFadeFraction,
    ) * smoothStep5(
      (1 - axialFraction) / waterPocketFadeFraction,
    );
    return {
      axialCycles,
      axialFraction,
      bladeLocalAngle,
      bladeWorldCrossAngle,
      localPosition,
      markerIndex,
      scale: markerScale,
      worldPosition: worldFromAssemblyLocal(localPosition),
    };
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const transportAngle = THREE.MathUtils.euclideanModulo(
      inputAngle,
      FULL_TURN * helixTurns,
    );
    const inputRotation = THREE.MathUtils.euclideanModulo(
      transportAngle,
      FULL_TURN,
    );
    const shaftRevolutions = transportAngle / FULL_TURN;
    const waterPocketStates = Array.from(
      { length: waterPocketCount },
      (_, index) => waterPocketState(
        index,
        inputRotation,
        shaftRevolutions,
      ),
    );
    return {
      axialWaterAcceleration:
        screwPitch * inputAcceleration / FULL_TURN,
      axialWaterSpeed: screwPitch * inputSpeed / FULL_TURN,
      inputAcceleration,
      inputAngle,
      inputRotation,
      inputSpeed,
      phase: transportAngle / (FULL_TURN * helixTurns),
      rotorPhase: inputRotation / FULL_TURN,
      shaftRevolutions,
      screwAngle: inputRotation,
      screwAngularAcceleration: inputAcceleration,
      screwAngularSpeed: inputSpeed,
      streamDriveTorque,
      streamVelocityAtBottomDotWheelTangent:
        streamVelocityZ * inputSpeed * waterWheelRadius,
      waterPocketStates,
      waterWheelAngle: inputRotation,
      waterWheelAngularAcceleration: inputAcceleration,
      waterWheelAngularSpeed: inputSpeed,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(
      time,
      transportCycleDuration,
    );
    return {
      ...stateAtInputAngle(inputAngularSpeed * cycleTime),
      cycleTime,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.43,
  });
  const screwMaterial = matte(PALETTE.driver, {
    metalness: 0.15,
    roughness: 0.47,
    side: THREE.DoubleSide,
  });
  const wheelMaterial = matte(PALETTE.accent, {
    metalness: 0.16,
    roughness: 0.47,
  });
  const paddleMaterial = matte(PALETTE.brass, {
    metalness: 0.12,
    roughness: 0.52,
  });
  const casingMaterial = matte(PALETTE.driven, {
    opacity: 0.23,
    roughness: 0.31,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.63,
    roughness: 0.25,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const paleWaterMaterial = matte(0x8adbe7, {
    opacity: 0.70,
    roughness: 0.22,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const screwAssembly = new THREE.Group();
  screwAssembly.position.copy(assemblyCenter);
  screwAssembly.quaternion.copy(assemblyQuaternion);
  screwAssembly.userData.role =
    'fixed-oblique-axis-frame-for-stream-driven-screw';
  root.add(screwAssembly);
  const rotor = new THREE.Group();
  rotor.userData.role =
    'one-rigid-rotor-containing-wheel-shaft-and-helical-flight';
  screwAssembly.add(rotor);

  const centralShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(
      centralShaftRadius,
      centralShaftRadius,
      screwLength + 0.72,
      28,
    ),
    darkMaterial,
  );
  centralShaft.userData.role = 'continuous-oblique-wheel-and-screw-shaft';
  rotor.add(centralShaft);
  const helicalFlight = new THREE.Mesh(
    makeHelicalRibbonGeometry({
      bottomCrossAngle,
      innerRadius: helixInnerRadius,
      length: screwLength,
      outerRadius: helixOuterRadius,
      turns: helixTurns,
    }),
    screwMaterial,
  );
  const flightProfile = { inner: centralShaftRadius, outer: casingRadius-.04, low: -screwLength/2, high: screwLength/2, width: .035, lead: screwPitch/FULL_TURN, phase: -screwLength/2 + screwPitch/2 };
  helicalFlight.geometry.dispose();
  helicalFlight.geometry = helicalThread(flightProfile, threadAngles(flightProfile, 128)).rotateX(-Math.PI/2);
  helicalFlight.userData.role =
    'five-turn-helical-water-lifting-passage';
  rotor.add(helicalFlight);
  const casing = new THREE.Mesh(
    new THREE.CylinderGeometry(
      casingRadius,
      casingRadius,
      screwLength,
      48,
      1,
      true,
    ),
    casingMaterial,
  );
  casing.geometry.dispose();
  casing.geometry = horizontalRing(casingRadius-.04,casingRadius,-screwLength/2,screwLength/2);
  casing.userData.role = 'transparent-rotating-oblique-screw-casing';
  rotor.add(casing);
  const casingIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, screwLength * 0.92, 0.075),
    whiteMaterial,
  );
  casingIndex.position.x = casingRadius + 0.03;
  casingIndex.userData.role = 'visible-one-to-one-screw-rotation-index';
  rotor.add(casingIndex);
  const casingEndRings = [-1, 1].map((sign) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(casingRadius, 0.055, 9, 48),
      darkMaterial,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = sign * screwLength / 2;
    ring.userData.role =
      `${sign < 0 ? 'lower' : 'upper'}-screw-casing-ring`;
    rotor.add(ring);
    return ring;
  });

  const waterWheel = new THREE.Group();
  waterWheel.position.y = wheelLocalY;
  waterWheel.userData.role =
    'lower-stream-wheel-rigidly-fixed-to-screw-shaft';
  rotor.add(waterWheel);
  // Brown draws the wheel as one plain disc with box floats set behind
  // it round its edge, standing out past the rim, not a spoked double rim.
  const wheelRims = [0].map((offset) => {
    const rim = new THREE.Mesh(
      horizontalRing(centralShaftRadius + 0.004, waterWheelRadius, -0.06, 0.06),
      wheelMaterial,
    );
    rim.position.y = offset;
    rim.userData.role = 'lower-water-wheel-solid-disc';
    // Brown dots the casing, its spiral and the far floats where the disc
    // covers them, so the disc takes the shared see-through style.
    makeSeeThrough(rim);
    waterWheel.add(rim);
    return rim;
  });
  const paddles = [];
  for (let index = 0; index < waterWheelPaddleCount; index += 1) {
    const angle = index * FULL_TURN / waterWheelPaddleCount;
    const paddleCarrier = new THREE.Group();
    paddleCarrier.rotation.y = angle;
    waterWheel.add(paddleCarrier);
    // Brown's floats are box buckets standing well out past the rim on the
    // disc's far face: radial 1.0, axial 0.64, 0.30 wide, built as five
    // thin boards open on the leading side so they read as buckets rather
    // than as solid gear teeth.
    const wall = 0.045, radial = 1.0, axial = 0.64, width = 0.30;
    const boards = [
      [radial, axial, wall, 0, 0, width / 2 - wall / 2],
      [wall, axial, width, -radial / 2 + wall / 2, 0, 0],
      [wall, axial, width, radial / 2 - wall / 2, 0, 0],
      [radial, wall, width, 0, -axial / 2 + wall / 2, 0],
      [radial, wall, width, 0, axial / 2 - wall / 2, 0],
    ].map(([x, y, z, px, py, pz]) => new THREE.BoxGeometry(x, y, z).translate(px, py, pz));
    const paddle = new THREE.Mesh(mergeGeometries(boards), paddleMaterial);
    boards.forEach(board => board.dispose());
    paddle.position.set(waterWheelRadius + 0.12, -axial / 2 + 0.03, 0);
    paddle.userData.role = `stream-driven-lower-paddle-${index + 1}`;
    paddleCarrier.add(paddle);
    paddles.push(paddle);
  }

  // Pass 69 (p69-w1): each pocket is the water actually trapped in one turn
  // of the spiral passage, lying along the low side of the casing between
  // two turns of the flight (an annular sector of the passage), not a bead.
  // It clears the flight: its axial half-length (0.3 pitch) is less than the
  // flight's nearest approach across its angular spread (0.5 - 0.12 pitch).
  const pocketHalfAngle = 0.75;
  const pocketCentreRadius = (centralShaftRadius + 0.012 + casingRadius - 0.052) / 2;
  // Built about its own centre so it fades in and out in place.
  const pocketGeometry = plate(sector(centralShaftRadius + 0.012, casingRadius - 0.052, -pocketHalfAngle, pocketHalfAngle, 48),
    -0.3 * screwPitch, 0.3 * screwPitch).rotateX(Math.PI / 2).translate(-pocketCentreRadius, 0, 0);
  const pocketMaterial = waterVolumeMaterial({opacity: 0.55});
  const waterPockets = [];
  for (let index = 0; index < waterPocketCount; index += 1) {
    const pocket = new THREE.Mesh(pocketGeometry, pocketMaterial);
    pocket.renderOrder = 3;
    pocket.userData.role =
      `gravity-low-water-pocket-advancing-one-pitch-per-revolution-${index + 1}`;
    screwAssembly.add(pocket);
    waterPockets.push(pocket);
  }

  const bearingLocalPositions = [
    new THREE.Vector3(0, -screwLength * 0.34, 0),
    new THREE.Vector3(0, screwLength * 0.34, 0),
  ];
  const bearings = bearingLocalPositions.map((localPosition, index) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(casingRadius + 0.11, 0.09, 10, 48),
      frameMaterial,
    );
    bearing.geometry.dispose();
    bearing.geometry = ring(casingRadius+.073,casingRadius+.20,-.09,.09);
    bearing.quaternion.setFromUnitVectors(Z_AXIS, axisDirection);
    bearing.position.copy(worldFromAssemblyLocal(localPosition));
    bearing.userData.role =
      `fixed-oblique-screw-bearing-${index + 1}`;
    root.add(bearing);
    return bearing;
  });
  const bearingSupports = bearings.map((bearing, index) => {
    const height = bearing.position.y - groundY;
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, height, 0.28),
      frameMaterial,
    );
    support.position.set(
      bearing.position.x,
      groundY + height / 2,
      // Outside the enlarged paddle boards' sweep.
      index === 0 ? -2.45 : 2.45,
    );
    support.userData.role = `fixed-oblique-bearing-support-${index + 1}`;
    root.add(support);
    return support;
  });

  const bearingBridges = bearings.map((bearing, index) => {
    const sign = index === 0 ? -1 : 1;
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,1.61,24),frameMaterial);
    bridge.rotation.x = Math.PI/2;
    bridge.position.set(bearing.position.x,bearing.position.y,sign*1.645);
    bridge.userData.role = `finite-bearing-to-post-bridge-${index + 1}`;
    root.add(bridge);
    return bridge;
  });

  // Brown holds the top of the shaft in one curved arm reaching in from the
  // upper left: its rounded end is a boss bored for the shaft stub above the
  // casing, it hooks up and runs left over the trough, and (Brown crops it
  // at the plate edge) it turns down past the trough's open end to the
  // ground, one strap throughout (pass 90: the saddle across the trough
  // walls and the stud standing on it are gone).
  const upperStubBearing = new THREE.Mesh(
    ring(centralShaftRadius + 0.004, 0.36, -0.14, 0.12),
    frameMaterial,
  );
  upperStubBearing.quaternion.setFromUnitVectors(Z_AXIS, axisDirection);
  upperStubBearing.position.copy(worldFromAssemblyLocal(new THREE.Vector3(0, screwLength / 2 + 0.22, 0)));
  upperStubBearing.userData.role = 'fixed-bracket-bearing-on-upper-shaft-stub';
  root.add(upperStubBearing);
  const bossCenter = upperStubBearing.position.clone();
  // Perpendicular to the shaft in the picture plane, toward the upper right:
  // the strap leaves the boss there and hooks back over it to the left.
  const bossSide = new THREE.Vector3(-axisDirection.y, axisDirection.x, 0);
  if (bossSide.x < 0) bossSide.negate();
  // Trough frame (same transform as the trough built below).
  const troughFrame = new THREE.Object3D();
  troughFrame.position.set(upperEnd.x - 2.02, dischargeTroughY, 0);
  troughFrame.rotation.z = -0.05;
  troughFrame.updateMatrixWorld(true);
  const strapY = bossCenter.y + 0.50;
  // Clear of the trough's open left end (x -5.41).
  const armDropX = troughFrame.localToWorld(new THREE.Vector3(-1.67, 0, 0)).x - 0.30;
  const strapPath = new THREE.CatmullRomCurve3([
    bossCenter.clone().addScaledVector(bossSide, 0.26),
    bossCenter.clone().addScaledVector(bossSide, 0.36).add(new THREE.Vector3(0, 0.26, 0)),
    new THREE.Vector3(bossCenter.x - 0.20, strapY, 0),
    new THREE.Vector3(bossCenter.x - 0.90, strapY, 0),
    new THREE.Vector3(armDropX + 0.55, strapY, 0),
    new THREE.Vector3(armDropX + 0.08, strapY - 0.12, 0),
    new THREE.Vector3(armDropX, strapY - 0.60, 0),
    new THREE.Vector3(armDropX, groundY + 0.40, 0),
    new THREE.Vector3(armDropX, groundY - 0.02, 0),
  ], false, 'centripetal');
  const sweepStrap = (curve, width, thickness, segments) => {
    const positions = [];
    const frames = Array.from({ length: segments + 1 }, (_, i) => {
      const t = i / segments, point = curve.getPointAt(t), tangent = curve.getTangentAt(t);
      const normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
      return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) =>
        point.clone().addScaledVector(normal, u * width / 2).add(new THREE.Vector3(0, 0, v * thickness / 2)));
    });
    const quad = (a, b, c, d) => positions.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray());
    for (let i = 0; i < segments; i += 1) {
      const f = frames[i], g = frames[i + 1];
      for (let k = 0; k < 4; k += 1) quad(f[k], f[(k + 1) % 4], g[(k + 1) % 4], g[k]);
    }
    const [f0, f1] = [frames[0], frames[segments]];
    quad(f0[3], f0[2], f0[1], f0[0]);
    quad(f1[0], f1[1], f1[2], f1[3]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  };
  const bracketArm = new THREE.Mesh(sweepStrap(strapPath, 0.30, 0.16, 160), frameMaterial);
  bracketArm.userData.role = 'fixed-upper-shaft-bracket-arm';
  root.add(bracketArm);
  const upperBracketArms = [bracketArm];

  const base = new THREE.Mesh(
    // Thin (and hidden in the plate view) so the lowest box float clears it.
    new THREE.BoxGeometry(8.20, 0.04, 5.20),
    frameMaterial,
  );
  base.position.set(0, groundY + 0.02, 0);
  base.userData.role = 'fixed-archimedes-screw-base';
  root.add(base);
  // Thin enough to clear the lowest paddle board's sweep.
  const streamBed = new THREE.Mesh(
    new THREE.BoxGeometry(4.10, 0.03, 4.92),
    frameMaterial,
  );
  streamBed.position.set(lowerEnd.x + 0.20, groundY + 0.06, 0);
  streamBed.userData.role = 'fixed-stream-bed-around-lower-water-wheel';
  root.add(streamBed);
  // The stream is a translucent water body running with the current round
  // the lower wheel, from its surface down to the bed.
  const streamWater = waterVolume({ xMin: -7.4, xMax: 3.6, surfaceY: 0, bottomY: groundY + 0.075 - streamSurfaceY, zMin: -3.1, zMax: 3.3 });
  streamWater.position.set(lowerEnd.x + 0.20, streamSurfaceY, 0);
  streamWater.userData.role =
    'stream-immersing-lower-screw-inlet-and-driving-wheel';
  root.add(streamWater);
  // Pass 104: the current itself, a streaked sheet just under the surface
  // running along +z past the dipping paddles at the stream speed (about
  // 1.5 times the paddle-tip speed).
  root.add(flowingStreamSurface({
    start: new THREE.Vector3(lowerEnd.x + 0.20 - 1.9, streamSurfaceY, -3.05),
    end: new THREE.Vector3(lowerEnd.x + 0.20 - 1.9, streamSurfaceY, 3.25),
    halfWidth: 5.4,
    depth: 0.75,
    thickness: 0.68,
    opacity: 0.5,
    normalScale: 1.0,
    speed: streamVelocityZ,
    cyclePeriod: shaftRevolutionDuration,
    role: 'axial-stream-current-surface-driving-paddles',
  }));
  const streamMarkers = [];
  for (let index = 0; index < 12; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 14, 10),
      paleWaterMaterial,
    );
    marker.userData.role = `axial-driving-stream-marker-${index + 1}`;
    root.add(marker);
    streamMarkers.push(marker);
  }

  const dischargeTrough = new THREE.Group();
  dischargeTrough.position.set(upperEnd.x - 2.02, dischargeTroughY, 0);
  dischargeTrough.rotation.z = -0.05;
  dischargeTrough.userData.role =
    'fixed-upper-trough-receiving-continuous-screw-discharge';
  root.add(dischargeTrough);
  // Pass 90: the trough runs on 0.20 past its old left end into the bracket
  // arm's descending leg, which carries it (the saddle that did is gone).
  const troughBottom = new THREE.Mesh(
    new THREE.BoxGeometry(3.54, 0.14, 1.28),
    frameMaterial,
  );
  troughBottom.position.x = -0.10;
  dischargeTrough.add(troughBottom);
  const troughSides = [-1, 1].map((sign) => {
    const side = new THREE.Mesh(
      new THREE.BoxGeometry(3.54, 0.38, 0.09),
      frameMaterial,
    );
    side.position.set(-0.10, 0.18, sign * 0.59);
    dischargeTrough.add(side);
    return side;
  });
  const troughWater = new THREE.Mesh(
    new THREE.BoxGeometry(3.16, 0.09, 1.06),
    waterMaterial,
  );
  troughWater.position.y = 0.11;
  troughWater.userData.role = 'raised-water-leaving-upper-trough';
  dischargeTrough.add(troughWater);
  // The lifted water leaves the open top of the passage as one continuous
  // stream falling on a projectile path into the trough.
  const dischargeOrigin = upperEnd.clone().add(new THREE.Vector3(-0.05, -0.2, 0));
  const dischargeTarget = new THREE.Vector3(upperEnd.x - 0.75, dischargeTroughY + 0.13, 0);
  const dischargeDirection = new THREE.Vector3(-1, 0.15, 0).normalize();
  const dischargeSpeed = solveBallisticSpeed({origin: dischargeOrigin, direction: dischargeDirection, target: dischargeTarget}) ?? 1;
  const upperDischarge = new WaterStream(ballisticPath({
    origin: dischargeOrigin, velocity: dischargeDirection.clone().multiplyScalar(dischargeSpeed),
    endY: dischargeTarget.y, samples: 24,
  }), {
    width: 0.22, thickness: 0.07, widthAxis: new THREE.Vector3(0, 0, 1), widthExponent: 0.4,
    foam: {start: 0.85, amount: 0.45}, cyclePeriod: shaftRevolutionDuration, streakRate: 1.5, opacity: 0.5,
  });
  upperDischarge.userData.role =
    'continuous-water-discharge-from-top-of-spiral-passage';
  root.add(upperDischarge);
  troughWater.material = waterVolumeMaterial({opacity: 0.45});
  const updateStreams = collectWaterStreams(root);

  const update = (time) => {
    const state = stateAtTime(time);
    updateStreams(time);
    rotor.rotation.y = state.screwAngle;
    state.waterPocketStates.forEach((pocketState, index) => {
      const lowLine = Math.atan2(pocketState.localPosition.z, pocketState.localPosition.x);
      waterPockets[index].position.set(pocketCentreRadius * Math.cos(lowLine), pocketState.localPosition.y,
        pocketCentreRadius * Math.sin(lowLine));
      waterPockets[index].rotation.y = -lowLine;
      waterPockets[index].scale.setScalar(pocketState.scale);
      waterPockets[index].visible = pocketState.scale > 0.002;
    });
    const streamPhase = THREE.MathUtils.euclideanModulo(time / 0.96, 1);
    for (let index = 0; index < streamMarkers.length; index += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        streamPhase + index / streamMarkers.length,
        1,
      );
      streamMarkers[index].position.set(
        lowerEnd.x + 0.20,
        streamSurfaceY + 0.08,
        -2.20 + 4.40 * progress,
      );
      streamMarkers[index].scale.setScalar(
        Math.sqrt(Math.sin(Math.PI * progress)),
      );
    }
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    assemblyCenter: assemblyCenter.clone(),
    assemblyQuaternion: assemblyQuaternion.clone(),
    axisDirection: axisDirection.clone(),
    bottomCrossAngle,
    casingRadius,
    centralShaftRadius,
    dischargeTroughY,
    groundY,
    helixInnerRadius,
    helixOuterRadius,
    helixTurns,
    inputAngularSpeed,
    lowerEnd: lowerEnd.clone(),
    projectedGravityLocal: projectedGravityLocal.clone(),
    representativeStreamForce,
    shaftRevolutionDuration,
    screwLength,
    screwPitch,
    streamDriveTorque,
    streamSurfaceY,
    streamVelocityZ,
    transportCycleDuration,
    upperEnd: upperEnd.clone(),
    waterPocketCount,
    pocketCentreRadius,
    waterPocketFadeFraction,
    waterPocketRadius,
    waterWheelCenter: waterWheelCenter.clone(),
    waterWheelPaddleCount,
    waterWheelRadius,
    wheelLocalY,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: shaftRevolutionDuration,
      targetCycleDuration: shaftRevolutionDuration,
    },
    archetype:
      'stream-driven-inclined-archimedes-screw-with-one-to-one-lower-water-wheel-and-gravity-low-rising-pockets',
    blocks: {
      base,
      bearings,
      bearingSupports,
      bearingBridges,
      upperStubBearing,
      upperBracketArms,
      casing,
      casingEndRings,
      casingIndex,
      centralShaft,
      dischargeTrough,
      helicalFlight,
      paddles,
      rotor,
      screwAssembly,
      streamBed,
      streamMarkers,
      streamWater,
      troughBottom,
      troughSides,
      troughWater,
      upperDischarge,
      waterPockets,
      waterWheel,
      wheelRims,
    },
    degreesOfFreedom: {
      helicalFlightIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      screwAxisTranslationIndependent: false,
      waterPocketAxialMotionIndependent: false,
      waterWheelIndependent: false,
    },
    dynamics: {
      fluidCaptureLeakageSloshPressureViscosityPaddleHydrodynamicsBearingFrictionAndRotationalInertiaModeled:
        false,
      pocketTransport:
        'Five visible water packets remain on the gravity-low generator of the fixed oblique casing and advance axially by exactly one screw pitch per rotor revolution. Each packet fades to zero scale at the outlet before a new packet appears at the immersed inlet, representing continuous through-flow without a visible reset jump.',
      streamDrive:
        'A representative stream force in the positive local-z direction acts at the gravity-low paddle radius. Its moment about the oblique positive-y shaft is positive and agrees with the prescribed wheel and screw rotation; hydrodynamic speed equilibrium is not integrated.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'A lower paddle wheel, central shaft, transparent casing, and five-turn helical flight form one rigid rotor on one fixed oblique axis, so the drive wheel and screw rotate at exactly the same angle and speed. The supply stream partly immerses the lower inlet and acts on the lower wheel. For the reconstructed right-handed transport sense, each positive rotor revolution advances a gravity-low water pocket upward by one pitch through the spiral passage; successive pockets discharge continuously into the fixed upper trough.',
    motion: {
      inputAngularSpeed,
      materialStateCycleDuration: transportCycleDuration,
      motionType:
        'continuous-one-to-one-water-wheel-and-inclined-screw-rotation',
      screwRevolutionsPerCycle: 1,
      screwRevolutionsPerMaterialStateCycle: helixTurns,
      shaftRevolutionDuration,
      waterWheelRevolutionsPerCycle: 1,
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 443 page provides Brown’s static engraving and caption; its Animated control is unavailable and the page contains no Canvas construction or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      screwAngle: sourceState.screwAngle,
      waterPocketPositions: sourceState.waterPocketStates.map(
        ({ worldPosition }) => worldPosition.clone(),
      ),
      waterWheelAngle: sourceState.waterWheelAngle,
    },
    sourceReference: {
      brownPlate443: {
        approximateLowerWheelCenterPixels: [391, 367],
        approximateScrewLowerEndPixels: [354, 341],
        approximateScrewUpperEndPixels: [86, 75],
        approximateTubeRadiusPixels: 63,
        approximateUpperDischargePixels: [73, 117],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 22,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the apparatus applies Archimedes’s screw to raising water',
          'the supply stream is the motive power',
          'the wheel and spiral passage share one oblique shaft',
          'the spiral passage lower end is immersed',
          'the stream acts on the wheel at the lower end and produces rotation',
          'rotation conveys water continuously upward through the spiral passage and discharges it at the top',
        ],
        engravingEvidence:
          'Brown’s engraving shows one strongly inclined cylindrical screw body with an internal dotted helix, one coaxial paddle wheel at its lower immersed end, and water issuing from the upper end into a raised trough.',
        reconstructionDisclosure:
          'Brown gives no dimensions, screw diameter, pitch, turn count, handedness, inclination, wheel diameter or paddle count, stream direction or force, rotation speed, flow rate, bearing arrangement, losses, or timing. Those values, transparent casing, five gravity-low tracers, frame, colors, and eleven-second shaft revolution are independently engineered. The oblique one-shaft wheel-and-screw topology, lower immersion, stream drive, spiral upward transport, and continuous upper discharge are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 443',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      helicalPocketConstraint:
        'helixAngle(u)=bottomAngle-2*pi*turns*u; with u=(rotorRevolutions+integerPocketOffset)/turns, helixAngle+rotorAngle=bottomAngle modulo 2*pi while y rises by pitch per revolution.',
      oneToOneRigidShaft:
        'waterWheelAngle=screwAngle=inputRotation and all three rotating parts share the same rotor transform.',
      streamTorque:
        'In assembly coordinates the gravity-low contact is r=(-R,0,0) and stream force F=(0,0,+F), hence tau_y=r_z*F_x-r_x*F_z=R*F>0.',
      waterAdvance:
        'axialWaterSpeed=pitch*screwAngularSpeed/(2*pi) and axialWaterAcceleration=pitch*screwAngularAcceleration/(2*pi).',
    },
    update,
    waterPocketState,
    worldFromAssemblyLocal,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    // Brown's close view: the bracket's eye, its bend and the head of the
    // shaft sit well inside the upper left of the plate, with only the far
    // run of the arm and the trough's outer end leaving the left edge; the
    // stream fills the foot of the plate.
    new THREE.Vector3(-4.10, -2.40, -1.70),
    new THREE.Vector3(3.70, 3.75, 1.70),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(6.3, 4.8, 10.8);
  root.userData.groundFloorY = groundY;
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = shaftRevolutionDuration;
  root.traverse(o => { for (const m of o.material ? [].concat(o.material) : []) m.fog = false; });
  markShadows(root);
  base.receiveShadow = true;
  streamBed.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredStreamDrivenArchimedesScrewMovement(movement) {
  if (movement.id !== 443) return null;
  const model = applyCutawayFor(streamDrivenArchimedesScrew(movement), movement.id);
  // Brown dots the spiral passage inside the closed casing, so the casing
  // (made whole by the cutaway spec) takes the shared see-through style and
  // the flight and the water pockets it lifts show through it.
  model.root.traverse((object) => {
    // The flight is inside the (really opaque) casing: it throws no shadow
    // of its own through the see-through wall.
    if (object.userData.role === 'five-turn-helical-water-lifting-passage') object.castShadow = false;
    if (object.userData.role !== 'transparent-rotating-oblique-screw-casing') return;
    makeSeeThrough(object);
    object.castShadow = true; // the real casing is opaque: it shades as a whole tube
  });
  return model;
}
