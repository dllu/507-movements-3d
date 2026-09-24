import * as THREE from 'three';
import {correctWaterLiftParts} from './well-scoop-gutter-parts.js';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
import { ruledWaterLines, ruledWaterMaterial } from './ruled-water-lines.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return THREE.MathUtils.clamp(
    x ** 3 * (10 + x * (-15 + 6 * x)),
    0,
    1,
  );
}

function smootherStepDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * x ** 2 * (1 - x) ** 2;
}

function smootherStepSecondDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * x * (1 - x) * (1 - 2 * x);
}

function positiveHalfWave(angle, sign, speed, acceleration) {
  const rawSine = Math.sin(angle);
  const sine = Math.abs(rawSine) < 1e-15 ? 0 : rawSine;
  const cosine = Math.cos(angle);
  const raw = sign * sine;
  if (raw <= 0) {
    return { acceleration: 0, rate: 0, value: 0 };
  }
  const rawDerivative = sign * cosine;
  const rawSecondDerivative = -sign * sine;
  const firstDerivativeByAngle = smootherStepDerivative(raw) * rawDerivative;
  const secondDerivativeByAngle =
    smootherStepSecondDerivative(raw) * rawDerivative ** 2
    + smootherStepDerivative(raw) * rawSecondDerivative;
  return {
    acceleration: secondDerivativeByAngle * speed ** 2
      + firstDerivativeByAngle * acceleration,
    rate: firstDerivativeByAngle * speed,
    value: smootherStep(raw),
  };
}

function rotateLocal(local, angle) {
  return local.clone().applyAxisAngle(Z_AXIS, angle);
}

function setRodBetween(mesh, start, end) {
  const delta = end.clone().sub(start);
  const length = Math.max(0.001, delta.length());
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.y = length;
  mesh.quaternion.setFromUnitVectors(Y_AXIS, delta.normalize());
}

function setBeamBetween(mesh, start, end) {
  const delta = end.clone().sub(start);
  const length = Math.max(0.001, delta.length());
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.x = length;
  mesh.rotation.z = Math.atan2(delta.y, delta.x);
}

function swingingGutterPump(movement) {
  const root = new THREE.Group();
  const cycleDuration = 5.8;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const swingAmplitude = THREE.MathUtils.degToRad(12);
  const gutterPivot = new THREE.Vector3(0, 0.90, 0);
  const branchHalfWidth = 1.55;
  const rowLevels = Object.freeze([-2.05, -1.15, -0.25, 0.65, 1.55, 2.45]);
  const bottomScoopLocal = new THREE.Vector3(-branchHalfWidth, -2.55, 0);
  const outletLocal = new THREE.Vector3(-2.55, rowLevels.at(-1), 0);
  const localPathPoints = [bottomScoopLocal.clone()];
  for (const rowY of rowLevels) {
    localPathPoints.push(new THREE.Vector3(branchHalfWidth, rowY, 0));
    localPathPoints.push(new THREE.Vector3(-branchHalfWidth, rowY, 0));
  }
  localPathPoints.push(outletLocal.clone());
  const segmentLengths = localPathPoints.slice(0, -1).map(
    (point, index) => point.distanceTo(localPathPoints[index + 1]),
  );
  const totalConduitLength = segmentLengths.reduce(
    (sum, length) => sum + length,
    0,
  );
  const junctionLocalPoints = localPathPoints.slice(1, -2);
  const valveCount = junctionLocalPoints.length;
  const maximumFlapAngle = THREE.MathUtils.degToRad(52);
  const turnSigns = junctionLocalPoints.map((_, index) => {
    const incoming = localPathPoints[index + 1].clone()
      .sub(localPathPoints[index]).normalize();
    const outgoing = localPathPoints[index + 2].clone()
      .sub(localPathPoints[index + 1]).normalize();
    const cross = incoming.x * outgoing.y - incoming.y * outgoing.x;
    return Math.sign(cross) || (index % 2 === 0 ? 1 : -1);
  });
  const reservoirSurfaceY = -1.36;
  const groundY = -1.92;

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const rawCycleAngle = THREE.MathUtils.euclideanModulo(
      inputAngle,
      FULL_TURN,
    );
    const cycleAngle = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].find(
      (boundary) => Math.abs(rawCycleAngle - boundary) < 1e-12,
    ) ?? rawCycleAngle;
    const phase = cycleAngle / FULL_TURN;
    const swingAngle = swingAmplitude * Math.sin(cycleAngle);
    const swingAngularSpeed =
      swingAmplitude * Math.cos(cycleAngle) * inputSpeed;
    const swingAngularAcceleration = swingAmplitude * (
      -Math.sin(cycleAngle) * inputSpeed ** 2
      + Math.cos(cycleAngle) * inputAcceleration
    );
    const evenValveProfile = positiveHalfWave(
      cycleAngle,
      1,
      inputSpeed,
      inputAcceleration,
    );
    const oddValveProfile = positiveHalfWave(
      cycleAngle,
      -1,
      inputSpeed,
      inputAcceleration,
    );
    const valveOpenAmounts = turnSigns.map((_, index) => (
      index % 2 === 0
        ? evenValveProfile.value
        : oddValveProfile.value
    ));
    const valveOpenRates = turnSigns.map((_, index) => (
      index % 2 === 0
        ? evenValveProfile.rate
        : oddValveProfile.rate
    ));
    const valveOpenAccelerations = turnSigns.map((_, index) => (
      index % 2 === 0
        ? evenValveProfile.acceleration
        : oddValveProfile.acceleration
    ));
    const flapAngles = valveOpenAmounts.map(
      (amount) => maximumFlapAngle * amount,
    );
    const segmentFillFractions = segmentLengths.map((_, index) => {
      const profile = index % 2 === 0
        ? evenValveProfile
        : oddValveProfile;
      return 0.28 + 0.72 * profile.value;
    });
    const segmentFillRates = segmentLengths.map((_, index) => {
      const profile = index % 2 === 0
        ? evenValveProfile
        : oddValveProfile;
      return 0.72 * profile.rate;
    });
    const worldPathPoints = localPathPoints.map(
      (point) => rotateLocal(point, swingAngle).add(gutterPivot),
    );
    const pointVelocities = localPathPoints.map((point) => {
      const radius = rotateLocal(point, swingAngle);
      return new THREE.Vector3(-radius.y, radius.x, 0)
        .multiplyScalar(swingAngularSpeed);
    });
    const pointAccelerations = localPathPoints.map((point) => {
      const radius = rotateLocal(point, swingAngle);
      return new THREE.Vector3(-radius.y, radius.x, 0)
        .multiplyScalar(swingAngularAcceleration)
        .addScaledVector(radius, -(swingAngularSpeed ** 2));
    });
    let activeValveSet = 'all-flaps-seated-at-neutral-crossing';
    if (evenValveProfile.value > 1e-12) {
      activeValveSet = 'even-elbow-flaps-forward-open';
    } else if (oddValveProfile.value > 1e-12) {
      activeValveSet = 'odd-elbow-flaps-forward-open';
    }
    const bottomScoop = worldPathPoints[0];
    const outlet = worldPathPoints.at(-1);
    return {
      activeValveSet,
      bottomScoop,
      bottomScoopAcceleration: pointAccelerations[0],
      bottomScoopImmersion: reservoirSurfaceY - bottomScoop.y,
      bottomScoopVelocity: pointVelocities[0],
      evenValveOpenAcceleration: evenValveProfile.acceleration,
      evenValveOpenAmount: evenValveProfile.value,
      evenValveOpenRate: evenValveProfile.rate,
      flapAngles,
      inputAcceleration,
      inputAngle: cycleAngle,
      inputSpeed,
      oddValveOpenAcceleration: oddValveProfile.acceleration,
      oddValveOpenAmount: oddValveProfile.value,
      oddValveOpenRate: oddValveProfile.rate,
      outlet,
      outletAcceleration: pointAccelerations.at(-1),
      outletDischargeFraction: evenValveProfile.value,
      outletVelocity: pointVelocities.at(-1),
      phase,
      pointAccelerations,
      pointVelocities,
      segmentFillFractions,
      segmentFillRates,
      swingAngle,
      swingAngularAcceleration,
      swingAngularSpeed,
      valveOpenAccelerations,
      valveOpenAmounts,
      valveOpenRates,
      worldPathPoints,
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
    inputAngularSpeed,
    0,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.66,
  });
  const gutterMaterial = matte(PALETTE.brass, {
    metalness: 0.14,
    roughness: 0.56,
  });
  const boxMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    opacity: 0.78,
    roughness: 0.58,
    transparent: true,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.74,
    roughness: 0.28,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const reservoirMaterial = matte(PALETTE.fluid, {
    opacity: 0.40,
    roughness: 0.34,
    side: THREE.DoubleSide,
    transparent: true,
  });
  reservoirMaterial.depthWrite = false;

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(8.0, 0.14, 3.5),
    frameMaterial,
  ), 'fixed-foundation-below-swinging-gutter-water-lift');
  base.position.set(0, groundY + 0.07, 0);
  root.add(base);
  const reservoir = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.62, 2.5),
    reservoirMaterial,
  ), 'lower-reservoir-entered-by-bottom-scoop');
  reservoir.position.set(0, reservoirSurfaceY - 0.31, 0);
  root.add(reservoir);
  const reservoirRim = new THREE.Mesh(
    new THREE.BoxGeometry(7.45, 0.16, 2.8),
    frameMaterial,
  );
  reservoirRim.position.set(0, reservoirSurfaceY - 0.02, 0);
  root.add(reservoirRim);
  const reservoirOpening = new THREE.Mesh(
    new THREE.BoxGeometry(6.9, 0.18, 2.42),
    reservoirMaterial,
  );
  reservoirOpening.position.set(0, reservoirSurfaceY + 0.04, 0);
  root.add(reservoirOpening);

  const support = addRole(new THREE.Group(),
    'fixed-bearing-frame-for-central-gutter-pendulum-axis');
  root.add(support);
  for (const z of [-0.82, -0.58]) {
    const leftLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 3.35, 0.18),
      frameMaterial,
    );
    leftLeg.position.set(-0.82, -0.38, z);
    leftLeg.rotation.z = THREE.MathUtils.degToRad(-16);
    support.add(leftLeg);
    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.82;
    rightLeg.rotation.z = THREE.MathUtils.degToRad(16);
    support.add(rightLeg);
  }
  const pivotAxle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 1.78, 28),
    darkMaterial,
  ), 'fixed-central-pendulum-pivot-axle');
  pivotAxle.rotation.x = Math.PI / 2;
  pivotAxle.position.copy(gutterPivot);
  root.add(pivotAxle);

  const swingingGutter = addRole(new THREE.Group(),
    'one-rigid-serpentine-swinging-gutter-pendulum');
  swingingGutter.position.copy(gutterPivot);
  root.add(swingingGutter);

  const branchAssemblies = [];
  const waterSlugs = [];
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const start = localPathPoints[index];
    const end = localPathPoints[index + 1];
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.055, 0.30),
      gutterMaterial,
    );
    setBeamBetween(floor, start, end);
    swingingGutter.add(floor);
    const rails = [-0.17, 0.17].map((z) => {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.12, 0.045),
        darkMaterial,
      );
      setBeamBetween(rail, start, end);
      rail.position.z = z;
      swingingGutter.add(rail);
      return rail;
    });
    const water = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.045, 0.22),
      waterMaterial,
    ), `forward-water-slug-in-conduit-branch-${index + 1}`);
    swingingGutter.add(water);
    waterSlugs.push(water);
    branchAssemblies.push({ end, floor, rails, start });
  }

  const valveBoxes = [];
  const flaps = [];
  for (let index = 0; index < valveCount; index += 1) {
    const point = junctionLocalPoints[index];
    const box = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.32, 0.46),
      boxMaterial,
    ), `intermediate-elbow-box-with-one-way-flap-${index + 1}`);
    box.position.copy(point);
    swingingGutter.add(box);
    valveBoxes.push(box);
    const outgoing = localPathPoints[index + 2].clone()
      .sub(localPathPoints[index + 1]);
    const mount = new THREE.Group();
    mount.position.copy(point);
    mount.position.z = 0.27;
    mount.rotation.z = Math.atan2(outgoing.y, outgoing.x);
    swingingGutter.add(mount);
    const flap = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.24, 0.20),
      index % 2 === 0
        ? matte(PALETTE.white, { roughness: 0.50 })
        : matte(PALETTE.accent, { metalness: 0.10, roughness: 0.58 }),
    ), `one-way-flap-valve-${index + 1}`);
    flap.position.y = -0.06;
    mount.add(flap);
    flaps.push({ flap, mount });
  }

  const bottomScoop = addRole(new THREE.Group(),
    'bottom-open-scoop-termination-feeding-first-branch');
  bottomScoop.position.copy(bottomScoopLocal);
  swingingGutter.add(bottomScoop);
  const scoopFloor = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.08, 0.50),
    gutterMaterial,
  );
  scoopFloor.rotation.z = THREE.MathUtils.degToRad(12);
  scoopFloor.position.x = -0.16;
  bottomScoop.add(scoopFloor);
  for (const z of [-0.27, 0.27]) {
    const side = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.28, 0.055),
      gutterMaterial,
    );
    side.position.set(-0.16, 0.10, z);
    side.rotation.z = THREE.MathUtils.degToRad(12);
    bottomScoop.add(side);
  }

  const outletMouth = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.22, 0.48),
    darkMaterial,
  ), 'top-open-pipe-termination-discharging-raised-water');
  outletMouth.position.copy(outletLocal);
  swingingGutter.add(outletMouth);

  const dischargeJets = Array.from({ length: 4 }, (_, index) => {
    const jet = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.032, 1, 10),
      waterMaterial,
    ), `top-discharge-jet-${index + 1}`);
    root.add(jet);
    return jet;
  });

  const update = (time) => {
    const state = stateAtTime(time);
    swingingGutter.rotation.z = state.swingAngle;
    for (let index = 0; index < waterSlugs.length; index += 1) {
      const fraction = state.segmentFillFractions[index];
      const start = localPathPoints[index];
      const end = localPathPoints[index + 1];
      const waterEnd = start.clone().lerp(end, fraction);
      setBeamBetween(waterSlugs[index], start, waterEnd);
      waterSlugs[index].position.z = 0.02;
    }
    for (let index = 0; index < flaps.length; index += 1) {
      flaps[index].flap.rotation.z = state.flapAngles[index];
    }
    root.userData.updateSolids?.();
    const dischargeVisible = state.outletDischargeFraction > 1e-4;
    for (let index = 0; index < dischargeJets.length; index += 1) {
      const jet = dischargeJets[index];
      jet.visible = dischargeVisible;
      if (!dischargeVisible) continue;
      const start = state.outlet.clone();
      start.z += (index - 1.5) * 0.10;
      const end = start.clone().add(new THREE.Vector3(
        -0.62 - index * 0.08,
        -0.30 - index * 0.08,
        0,
      ));
      setRodBetween(jet, start, end);
    }
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    branchHalfWidth,
    cycleDuration,
    groundY,
    gutterPivot,
    inputAngularSpeed,
    junctionLocalPoints,
    localPathPoints,
    maximumFlapAngle,
    outletLocal,
    reservoirSurfaceY,
    rowLevels,
    segmentLengths,
    swingAmplitude,
    totalConduitLength,
    turnSigns,
    valveCount,
  };
  root.userData = {
    archetype:
      'rigid-serpentine-swinging-gutter-with-bottom-scoop-top-outlet-and-one-way-flap-boxes',
    blocks: {
      base,
      bottomScoop,
      branchAssemblies,
      dischargeJets,
      flaps,
      outletMouth,
      pivotAxle,
      reservoir,
      reservoirOpening,
      reservoirRim,
      support,
      swingingGutter,
      valveBoxes,
      waterSlugs,
    },
    degreesOfFreedom: {
      branchMotionIndependent: false,
      flapOpeningIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      swingingAssemblyIsRigid: true,
    },
    dynamics: {
      fullFluidMomentumFreeSurfaceLossesValveImpactLeakagePendulumDriveTorqueAndStructuralFlexureModeled:
        false,
      flowModel:
        'The steady-state demonstration alternates the two interleaved flap sets on opposite pendulum half-cycles. Blue slugs always extend from each branch’s upstream point toward its downstream point, and the top outlet pulses on the even transfer half-cycle; pressures and delivered volume are not solved.',
      swingModel:
        'The complete serpentine conduit is one rigid pendulum with a sinusoidal 12-degree swing. Flap opening uses a quintic-smoothed positive half-wave, so each one-way plate seats with continuous velocity and acceleration at reversal.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'One rigid serpentine gutter swings about a central fixed axle. Its bottom open scoop feeds a diagonal rising branch, then eleven flap-valved elbow boxes join alternating diagonal risers and horizontal branches into a single continuous upward flow path. Each elbow has a one-way plate. Opposite pendulum half-swings open alternating valve sets, rectifying oscillatory fluid inertia so water advances from the lower reservoir to the final open pipe at the top.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'sinusoidal-rigid-pendulum-with-alternating-one-way-valve-transfer',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      sourcePrescribedAbsoluteTiming: false,
      sourcePrescribedNormalizedTiming: false,
    },
    sourcePose: {
      activeValveSet: sourceState.activeValveSet,
      bottomScoop: sourceState.bottomScoop.clone(),
      outlet: sourceState.outlet.clone(),
      swingAngle: sourceState.swingAngle,
    },
    sourceReference: {
      brownPlate461: {
        approximateBottomScoopPixels: [190, 405],
        approximateCentralPivotPixels: [257, 282],
        approximateLowerWaterlinePixels: [264, 414],
        approximateTopOutletPixels: [94, 126],
        approximateTopRightElbowPixels: [307, 126],
        horizontalBranchCount: 6,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'pendulums or swinging gutters raise water by pendulous motion',
          'the bottom termination is a scoop',
          'the top termination is an open pipe',
          'intermediate angles are boxes containing a flap valve',
          'each intermediate box joins two pipe branches',
        ],
        engravingEvidence:
          'Brown shows six near-horizontal branches, repeated parallel diagonal risers, boxed elbows alternating at the branch ends, a scoop immersed at the lower-left termination, an open upper-left pipe visibly discharging, and a dashed central pendulum axis through the rigid lattice.',
        reconstructionDisclosure:
          'Brown gives no branch dimensions, valve count in prose, valve hinge orientation, pivot coordinates, swing amplitude, period, fluid volume, head, pressure or drive. The plate supports a single rigid serpentine path with six horizontal stages and eleven intermediate elbows; exact dimensions, alternating C2 flap schedule, steady-state water slugs, colors and 5.8-second cycle are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 461',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      flowPath:
        'Path indices increase continuously from bottom scoop through every diagonal and horizontal branch to the top open outlet; every displayed water slug is anchored at the lower-index endpoint.',
      rigidBody:
        'Every path point is transformed by the same Rz(theta) about the central pivot, preserving all branch lengths and elbow angles exactly.',
      valveRectification:
        'Even elbow flaps open only for sin(phi)>0 and odd elbow flaps only for sin(phi)<0; each flap angle is constrained to its signed forward-opening side and never reverses through its seat.',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.65, -2.50, -1.75),
    new THREE.Vector3(3.65, 3.78, 1.75),
  );
  root.userData.cameraDistanceScale = 1.08;
  root.userData.cameraDirection = new THREE.Vector3(3.0, 3.3, 12.0);
  // Brown draws a flat elevation (camera in source-presentation); keep it near-orthographic.
  root.userData.cameraFov = 10;
  root.userData.groundFloorY = groundY;
  correctWaterLiftParts(root,461);
  {
    // Brown draws the gutters as slender pipes with small elbow boxes, not
    // broad troughs: rebuild the finite channel walls on a narrower bore.
    const b=root.userData.blocks,g=root.userData.geometry;
    const segments=g.localPathPoints.slice(0,-1).map((p,i)=>[[p.x,p.y],[g.localPathPoints[i+1].x,g.localPathPoints[i+1].y]]);
    const square=(p,r)=>poly([[p.x-r,p.y-r],[p.x+r,p.y-r],[p.x+r,p.y+r],[p.x-r,p.y+r]]);
    const inside=clip.union(...segments.map(([a,c])=>capsule(a,c,.085,12)),...g.junctionLocalPoints.map(p=>square(p,.22)));
    const outside=clip.union(...segments.map(([a,c])=>capsule(a,c,.12,12)),...g.junctionLocalPoints.map(p=>square(p,.255)));
    const openEnds=[g.localPathPoints[0],g.localPathPoints.at(-1)].map(p=>poly(circle([p.x,p.y],.20,64)));
    for(const [mesh,geometry] of [[b.conduitBack,plate(outside,-.22,-.18)],[b.conduitWalls,plate(clip.difference(outside,inside,...openEnds),-.18,.18)]]){mesh.geometry.dispose();mesh.geometry=geometry;}
    // Brown rules the water below as close horizontal strokes, not a
    // translucent slab.
    b.reservoir.geometry.dispose();
    b.reservoir.geometry=ruledWaterLines({xMin:-3.45,xMax:3.45,surfaceY:0,rows:12,spacing:.1,thickness:.03,dash:[.7,2.2],gap:[.06,.22],seed:461});
    b.reservoir.material=ruledWaterMaterial();
    b.reservoir.position.set(0,reservoirSurfaceY,-.9);
  }
  markShadows(root);
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredSwingingGutterPumpMovement(movement) {
  if (movement.id !== 461) return null;
  return swingingGutterPump(movement);
}
