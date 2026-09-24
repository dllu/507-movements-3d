import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import {hollowPipeBall} from './folding-joint-parts.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate, poly, circle, sector, polygonClipping as clip} from './finite-plate-geometry.js';
import {boredCylinderGeometry, boredJournal, fitPistonGuide} from './piston-guide-parts.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (10 + x * (-15 + 6 * x));
}

function smootherStepDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * x ** 2 * (1 - x) ** 2;
}

function smootherStepSecondDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * x * (1 - x) * (1 - 2 * x);
}

function setRodBetween(mesh, start, end) {
  const delta = end.clone().sub(start);
  const length = Math.max(0.001, delta.length());
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.y = length;
  mesh.quaternion.setFromUnitVectors(Y_AXIS, delta.normalize());
}

function cylinderAlongX(radius, length, material, segments = 36,
  openEnded = false) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      radius,
      radius,
      length,
      segments,
      1,
      openEnded,
    ),
    material,
  );
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

function cylinderAlongZ(radius, length, material, segments = 28) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function torusNormalX(majorRadius, tubeRadius, material, radialSegments = 10,
  tubularSegments = 48) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(
      majorRadius,
      tubeRadius,
      radialSegments,
      tubularSegments,
    ),
    material,
  );
  mesh.rotation.y = Math.PI / 2;
  return mesh;
}

function rodBetween(start, end, radius, material, segments = 18) {
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 1, segments),
    material,
  );
  setRodBetween(rod, start, end);
  return rod;
}

function hingeArmBetween(start, pivot, radius, material) {
  // Attach to the outside of the bored journal, never fill its axle passage.
  const end = pivot.clone().lerp(start, .105 / start.distanceTo(pivot));
  return rodBetween(start, end, radius, material);
}

// Brown's plate draws one flexible joint twice: a sectional elevation above,
// flexed as the frames follow the bed, and a plan below. Each figure is the
// same rigid two-frame assembly about the ball centre: the downstream frame
// carries the spherical socket and the transverse trunnion pin; the upstream
// frame carries the hollow ball and swings about that pin. Dimensions are
// normalized reconstructions read from the plate, not Robison's sizes.
const FIGURE = {
  pipeOuter: 0.26,
  pipeInner: 0.20,
  ballOuter: 0.40,
  ballCavity: 0.34,
  socketInner: 0.41,
  socketOuter: 0.47,
  socketMouthAxial: -0.13,
  upstreamEnd: -1.55,
  downstreamEnd: 1.95,
  logHalfWidth: 0.12,
  logCenterY: -0.52,
  logCenterZ: 0.76,
  logGap: 0.16,
  tieTopY: -0.28,
  pinRadius: 0.055,
  pinBore: 0.059,
  upstreamPlateZ: [0.885, 0.925],
  downstreamPlateZ: [0.595, 0.635],
};

function lathedAlongX(profile, bore, material, role) {
  const mesh = new THREE.Mesh(
    boredLatheGeometry(profile, bore, 72).rotateZ(-Math.PI / 2),
    material,
  );
  return addRole(mesh, role);
}

function hingePlateGeometry(side, [low, high]) {
  const f = FIGURE;
  // An upright strap from the ball centre down to the log, turned along it.
  const x0 = Math.min(0, side * 0.60), x1 = Math.max(0, side * 0.60);
  const outline = clip.union(
    poly([[x0, f.logCenterY - 0.10], [x1, f.logCenterY - 0.10],
      [x1, f.logCenterY + 0.10], [x0, f.logCenterY + 0.10]]),
    poly([[-0.075, f.logCenterY - 0.10], [0.075, f.logCenterY - 0.10],
      [0.075, 0], [-0.075, 0]]),
    poly(circle([0, 0], 0.12, 48)),
  );
  return plate(clip.difference(outline, poly(circle([0, 0], f.pinBore, 48))),
    low, high);
}

function buildPlateJointFigure(materials, name) {
  const f = FIGURE;
  const figure = addRole(new THREE.Group(), `plate-${name}-figure-of-one-flexible-joint`);
  const downstream = addRole(new THREE.Group(), `plate-${name}-downstream-socket-frame`);
  const upstream = addRole(new THREE.Group(), `plate-${name}-upstream-ball-frame`);
  figure.add(downstream, upstream);

  // Upstream pipe: open collared mouth, plain barrel, hollow ball.
  const ballGeometry = hollowPipeBall(f.ballOuter, f.ballCavity, f.pipeInner);
  const ballEnd = ballGeometry.userData.outerEnd;
  upstream.add(lathedAlongX([
    { axial: f.upstreamEnd, radial: 0.34 },
    { axial: f.upstreamEnd + 0.20, radial: 0.34 },
    { axial: f.upstreamEnd + 0.20, radial: f.pipeOuter },
    { axial: -ballEnd - 0.004, radial: f.pipeOuter },
  ], f.pipeInner, materials.pipe, `plate-${name}-collared-upstream-pipe`));
  upstream.add(addRole(new THREE.Mesh(ballGeometry, materials.ball),
    `plate-${name}-hollow-pipe-ball`));

  // Downstream pipe: spherical socket seat opening into the barrel.
  const mouth = f.socketMouthAxial;
  const seatEnd = Math.sqrt(f.socketInner ** 2 - f.pipeInner ** 2);
  const profile = [];
  for (let i = 0; i <= 24; i += 1) {
    const x = mouth + (0.30 - mouth) * i / 24;
    profile.push(new THREE.Vector2(Math.sqrt(f.socketOuter ** 2 - x ** 2), x));
  }
  profile.push(new THREE.Vector2(f.pipeOuter, 0.62),
    new THREE.Vector2(f.pipeOuter, f.downstreamEnd),
    new THREE.Vector2(f.pipeInner, f.downstreamEnd),
    new THREE.Vector2(f.pipeInner, seatEnd));
  for (let i = 1; i <= 24; i += 1) {
    const x = seatEnd + (mouth - seatEnd) * i / 24;
    profile.push(new THREE.Vector2(Math.sqrt(f.socketInner ** 2 - x ** 2), x));
  }
  profile.push(profile[0].clone());
  const socketMaterial = materials.socket.clone();
  socketMaterial.side = THREE.DoubleSide;
  downstream.add(addRole(new THREE.Mesh(
    new THREE.LatheGeometry(profile, 72).rotateZ(-Math.PI / 2),
    socketMaterial,
  ), `plate-${name}-spherical-socket-and-downstream-pipe`));

  // Paired longitudinal logs, one cross tie and one pipe strap per frame.
  const frameParts = (group, side) => {
    const start = side < 0 ? f.upstreamEnd - 0.20 : f.logGap;
    const end = side < 0 ? -f.logGap : f.downstreamEnd;
    for (const z of [-1, 1]) {
      const log = addRole(new THREE.Mesh(
        new THREE.BoxGeometry(end - start, 2 * f.logHalfWidth, 2 * f.logHalfWidth),
        materials.wood,
      ), `plate-${name}-${side < 0 ? 'upstream' : 'downstream'}-frame-log`);
      log.position.set((start + end) / 2, f.logCenterY, z * f.logCenterZ);
      group.add(log);
    }
    const tieX = side < 0 ? -1.05 : 1.30;
    // Brown marks each cross-tie end on the logs' outer faces with a
    // square crossed by an X, and draws bolt holes along the logs' tops.
    const tieEnd = clip.union(
      clip.difference(poly([[-0.10, -0.10], [0.10, -0.10], [0.10, 0.10], [-0.10, 0.10]]),
        poly([[-0.078, -0.078], [0.078, -0.078], [0.078, 0.078], [-0.078, 0.078]])),
      ...[1, -1].map((k) => poly([[-0.09, -0.09 * k - 0.014], [-0.09, -0.09 * k + 0.014],
        [0.09, 0.09 * k + 0.014], [0.09, 0.09 * k - 0.014]])),
    );
    for (const z of [-1, 1]) {
      const face = z * (f.logCenterZ + f.logHalfWidth);
      const mark = addRole(new THREE.Mesh(
        plate(tieEnd, z > 0 ? face : face - 0.006, z > 0 ? face + 0.006 : face),
        materials.iron,
      ), `plate-${name}-crossed-tie-end-mark`);
      mark.position.set(tieX, f.logCenterY, 0);
      group.add(mark);
      for (const fraction of [0.2, 0.5, 0.8]) {
        const bolt = addRole(new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 0.012, 20),
          materials.iron,
        ), `plate-${name}-log-bolt-head`);
        bolt.position.set(start + (end - start) * fraction,
          f.logCenterY + f.logHalfWidth + 0.006, z * f.logCenterZ);
        group.add(bolt);
      }
    }
    const tieBottom = f.logCenterY + 0.02;
    const tie = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.22, f.tieTopY - tieBottom,
        2 * (f.logCenterZ - f.logHalfWidth) - 0.004),
      materials.wood,
    ), `plate-${name}-frame-cross-tie`);
    tie.position.set(tieX, (f.tieTopY + tieBottom) / 2, 0);
    group.add(tie);
    const strapRadius = f.pipeOuter + 0.036;
    const hoop = addRole(new THREE.Mesh(
      plate(sector(strapRadius - 0.03, strapRadius + 0.03, 0, Math.PI, 40),
        -0.03, 0.03),
      materials.strap,
    ), `plate-${name}-pipe-strap`);
    hoop.rotation.y = Math.PI / 2;
    hoop.position.x = tieX;
    group.add(hoop);
    for (const z of [-1, 1]) {
      const leg = addRole(new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, -f.tieTopY, 12),
        materials.strap,
      ), `plate-${name}-pipe-strap-leg`);
      leg.position.set(tieX, f.tieTopY / 2, z * strapRadius);
      group.add(leg);
    }
    for (const z of [-1, 1]) {
      const range = side < 0 ? f.upstreamPlateZ : f.downstreamPlateZ;
      const hingePlate = addRole(new THREE.Mesh(
        hingePlateGeometry(side, z > 0 ? range : [-range[1], -range[0]]),
        materials.iron,
      ), `plate-${name}-${side < 0 ? 'ball' : 'socket'}-frame-hinge-strap`);
      group.add(hingePlate);
    }
  };
  frameParts(upstream, -1);
  frameParts(downstream, 1);

  // Transverse trunnion pin through the ball centre, carried by the socket.
  for (const z of [-1, 1]) {
    const inner = f.socketOuter;
    const outer = f.upstreamPlateZ[1] + 0.035;
    const pin = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(f.pinRadius, f.pinRadius, outer - inner, 24),
      materials.iron,
    ), `plate-${name}-transverse-trunnion-pin`);
    pin.rotation.x = Math.PI / 2;
    pin.position.z = z * (inner + outer) / 2;
    downstream.add(pin);
    const head = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.04, 24),
      materials.iron,
    ), `plate-${name}-trunnion-pin-head`);
    head.rotation.x = Math.PI / 2;
    head.position.z = z * (outer + 0.02);
    downstream.add(head);
  }
  figure.userData.upstream = upstream;
  figure.userData.downstream = downstream;
  return figure;
}

function flexibleWaterMain(movement) {
  const root = new THREE.Group();
  const cycleDuration = 13.2;
  const straightHoldEndPhase = 0.12;
  const deploymentEndPhase = 0.48;
  const installedHoldEndPhase = 0.74;
  const historicalPipePieceLengthFeet = 9;
  const modelUnitsPerFoot = 0.28;
  const pipeBarrelLength = historicalPipePieceLengthFeet
    * modelUnitsPerFoot;
  const jointAllowance = 0.28;
  const framePitch = pipeBarrelLength + jointAllowance;
  const segmentCount = 4;
  const pipeInsideDiametersInches = [15, 18];
  const pipelineCenterZ = [-1.20, 1.20];
  const pipeWallThickness = 0.045;
  const frameLogRadius = 0.13;
  const frameLogOffsetZ = 0.50;
  const frameLogY = -0.42;
  const hingePinRadius = 0.072;
  const hingePinLength = frameLogOffsetZ * 2 + 0.42;
  const socketAngularCapacity = THREE.MathUtils.degToRad(30);
  const targetSegmentAngles = [-7, -18, 5, 17]
    .map(THREE.MathUtils.degToRad);
  const baseAnchor = new THREE.Vector3(-6.10, 1.25, 0);
  const haulingTravel = 0.80;
  const winchPoint = new THREE.Vector3(7.16, 1.25, 0);
  const winchSpoolRadius = 0.24;
  const bedThickness = 0.18;
  const installedFrameClearance = 0.08;
  const bedNormalOffset = -frameLogY + frameLogRadius
    + bedThickness / 2 + installedFrameClearance;
  const socketBandHalfAngle = THREE.MathUtils.degToRad(37);
  const groundY = -1.06;

  const chainKinematics = (
    deploymentProgress,
    deploymentProgressRate = 0,
    deploymentProgressAcceleration = 0,
  ) => {
    const progress = THREE.MathUtils.clamp(deploymentProgress, 0, 1);
    const anchor = baseAnchor.clone().add(new THREE.Vector3(
      haulingTravel * progress,
      0,
      0,
    ));
    const anchorVelocity = new THREE.Vector3(
      haulingTravel * deploymentProgressRate,
      0,
      0,
    );
    const anchorAcceleration = new THREE.Vector3(
      haulingTravel * deploymentProgressAcceleration,
      0,
      0,
    );
    const segments = [];
    const jointCenters = [anchor.clone()];
    let start = anchor;
    let startVelocity = anchorVelocity;
    let startAcceleration = anchorAcceleration;

    for (let index = 0; index < segmentCount; index += 1) {
      const targetAngle = targetSegmentAngles[index];
      const angle = targetAngle * progress;
      const angularVelocity = targetAngle * deploymentProgressRate;
      const angularAcceleration = targetAngle
        * deploymentProgressAcceleration;
      const axis = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
      const normal = new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0);
      const end = start.clone().addScaledVector(axis, framePitch);
      const endVelocity = startVelocity.clone()
        .addScaledVector(normal, framePitch * angularVelocity);
      const endAcceleration = startAcceleration.clone()
        .addScaledVector(normal, framePitch * angularAcceleration)
        .addScaledVector(
          axis,
          -framePitch * angularVelocity ** 2,
        );
      const center = start.clone().add(end).multiplyScalar(0.5);
      const centerVelocity = startVelocity.clone()
        .add(endVelocity).multiplyScalar(0.5);
      const centerAcceleration = startAcceleration.clone()
        .add(endAcceleration).multiplyScalar(0.5);
      segments.push({
        angle,
        angularAcceleration,
        angularVelocity,
        axis,
        center,
        centerAcceleration,
        centerVelocity,
        end,
        endAcceleration,
        endVelocity,
        index,
        normal,
        start: start.clone(),
        startAcceleration: startAcceleration.clone(),
        startVelocity: startVelocity.clone(),
        targetAngle,
      });
      jointCenters.push(end.clone());
      start = end;
      startVelocity = endVelocity;
      startAcceleration = endAcceleration;
    }

    const jointDeflections = segments.slice(1).map((segment, index) => ({
      angle: segment.angle - segments[index].angle,
      angularAcceleration: segment.angularAcceleration
        - segments[index].angularAcceleration,
      angularVelocity: segment.angularVelocity
        - segments[index].angularVelocity,
      center: segment.start.clone(),
      index,
      targetAngle: segment.targetAngle - segments[index].targetAngle,
    }));

    return {
      anchor,
      anchorAcceleration,
      anchorVelocity,
      deploymentProgress: progress,
      jointCenters,
      jointDeflections,
      northEnd: segments.at(-1).end.clone(),
      northEndAcceleration: segments.at(-1).endAcceleration.clone(),
      northEndVelocity: segments.at(-1).endVelocity.clone(),
      segments,
    };
  };

  const initialChain = chainKinematics(0);
  const initialCableLength = winchPoint.distanceTo(initialChain.northEnd);

  const cableKinematics = (chain) => {
    const cableVector = winchPoint.clone().sub(chain.northEnd);
    const cableLength = cableVector.length();
    const cableDirection = cableVector.clone().multiplyScalar(1 / cableLength);
    const relativeVelocity = chain.northEndVelocity.clone().negate();
    const relativeAcceleration = chain.northEndAcceleration.clone().negate();
    const cableLengthRate = cableDirection.dot(relativeVelocity);
    const cableLengthAcceleration = (
      relativeVelocity.lengthSq()
      + cableVector.dot(relativeAcceleration)
      - cableLengthRate ** 2
    ) / cableLength;
    const reeledCableLength = initialCableLength - cableLength;
    const reeledCableRate = -cableLengthRate;
    const reeledCableAcceleration = -cableLengthAcceleration;
    return {
      cableDirection,
      cableLength,
      cableLengthAcceleration,
      cableLengthRate,
      reeledCableAcceleration,
      reeledCableLength,
      reeledCableRate,
      winchAngle: reeledCableLength / winchSpoolRadius,
      winchAngularAcceleration:
        reeledCableAcceleration / winchSpoolRadius,
      winchAngularVelocity: reeledCableRate / winchSpoolRadius,
    };
  };

  const stateAtPhase = (unwrappedPhase) => {
    const rawPhase = positiveModulo(unwrappedPhase, 1);
    const phase = [0, straightHoldEndPhase, deploymentEndPhase,
      installedHoldEndPhase].find((boundary) =>
      Math.abs(rawPhase - boundary) < 1e-12) ?? rawPhase;
    let deploymentProgress = 0;
    let deploymentProgressRate = 0;
    let deploymentProgressAcceleration = 0;
    let regime;

    if (phase < straightHoldEndPhase) {
      regime = 'straight-shore-assembled-frames-await-hauling';
    } else if (phase < deploymentEndPhase) {
      const local = (phase - straightHoldEndPhase)
        / (deploymentEndPhase - straightHoldEndPhase);
      const intervalTime = (deploymentEndPhase - straightHoldEndPhase)
        * cycleDuration;
      deploymentProgress = smootherStep(local);
      deploymentProgressRate = smootherStepDerivative(local) / intervalTime;
      deploymentProgressAcceleration = smootherStepSecondDerivative(local)
        / intervalTime ** 2;
      regime = 'plugged-north-ends-hauled-as-hinged-frames-follow-bed';
    } else if (phase < installedHoldEndPhase) {
      deploymentProgress = 1;
      regime = 'ball-socket-mains-rest-on-river-bed';
    } else {
      const local = (phase - installedHoldEndPhase)
        / (1 - installedHoldEndPhase);
      const intervalTime = (1 - installedHoldEndPhase) * cycleDuration;
      deploymentProgress = 1 - smootherStep(local);
      deploymentProgressRate = -smootherStepDerivative(local) / intervalTime;
      deploymentProgressAcceleration = -smootherStepSecondDerivative(local)
        / intervalTime ** 2;
      regime = 'nonhistorical-reverse-demonstration-reset';
    }

    const chain = chainKinematics(
      deploymentProgress,
      deploymentProgressRate,
      deploymentProgressAcceleration,
    );
    const cable = cableKinematics(chain);
    return {
      ...cable,
      chain,
      deploymentProgress,
      deploymentProgressAcceleration,
      deploymentProgressRate,
      phase,
      regime,
    };
  };

  const stateAtTime = (time) => stateAtPhase(time / cycleDuration);

  const ironMaterials = [
    matte(PALETTE.driver, { metalness: 0.32, roughness: 0.43 }),
    matte(PALETTE.driven, { metalness: 0.30, roughness: 0.44 }),
  ];
  const jointMaterials = [
    matte(0xa94732, { metalness: 0.38, roughness: 0.38 }),
    matte(0x244f67, { metalness: 0.38, roughness: 0.38 }),
  ];
  const socketMaterials = ironMaterials.map((material) => {
    const socketMaterial = material.clone();
    socketMaterial.transparent = true;
    socketMaterial.opacity = 0.52;
    socketMaterial.side = THREE.DoubleSide;
    socketMaterial.depthWrite = false;
    return socketMaterial;
  });
  const waterMaterial = matte(PALETTE.fluid, {
    transparent: true,
    opacity: 0.62,
    roughness: 0.22,
  });
  waterMaterial.depthWrite = false;
  const woodMaterial = matte(0x765d45, { roughness: 0.84 });
  const hingeMaterial = matte(PALETTE.ink, {
    metalness: 0.56,
    roughness: 0.34,
  });
  const strapMaterial = matte(PALETTE.brass, {
    metalness: 0.48,
    roughness: 0.38,
  });
  const plugMaterial = matte(PALETTE.accent, {
    metalness: 0.34,
    roughness: 0.44,
  });
  const cableMaterial = matte(PALETTE.ink, {
    metalness: 0.35,
    roughness: 0.54,
  });

  const pipelines = [];
  const segmentGroups = [];
  const pipeShells = [];
  const waterCores = [];
  const frameLogs = [];
  const straps = [];
  const ballJoints = [];
  const socketJoints = [];
  const hingePins = [];
  const southMouths = [];
  const northPlugs = [];
  const towCables = [];
  const winchRotors = [];
  const winches = [];

  pipeInsideDiametersInches.forEach((insideDiameterInches, mainIndex) => {
    const pipeline = addRole(new THREE.Group(),
      `${insideDiameterInches}-inch-independent-water-main`);
    root.add(pipeline);
    pipelines.push(pipeline);
    const localSegmentGroups = [];
    const localPipeShells = [];
    const localWaterCores = [];
    const localFrameLogs = [];
    const localStraps = [];
    const localBallJoints = [];
    const localSocketJoints = [];
    const localHingePins = [];
    const innerRadius = insideDiameterInches / 24 * modelUnitsPerFoot;
    const outerRadius = innerRadius + pipeWallThickness;
    const ballRadius = outerRadius + 0.105;
    const socketRadius = ballRadius + 0.042;

    for (let segmentIndex = 0; segmentIndex < segmentCount;
      segmentIndex += 1) {
      const segmentGroup = addRole(new THREE.Group(),
        `${insideDiameterInches}-inch-nine-foot-pipe-frame-${segmentIndex + 1}`);
      pipeline.add(segmentGroup);
      localSegmentGroups.push(segmentGroup);
      segmentGroups.push(segmentGroup);

      const ballGeometry = hollowPipeBall(ballRadius, ballRadius - pipeWallThickness, innerRadius);
      const ballEnd = ballGeometry.userData.outerEnd;
      const barrelStartX = segmentIndex === 0 ? .14 : .40;
      const barrelEndX = segmentIndex < segmentCount - 1 ? framePitch - ballEnd : framePitch;
      const pipeShell = addRole(new THREE.Mesh(
        boredCylinderGeometry(outerRadius, innerRadius, barrelEndX - barrelStartX),
        ironMaterials[mainIndex]), `${insideDiameterInches}-inch-pipe-shell-${segmentIndex + 1}`);
      pipeShell.rotation.z = -Math.PI / 2;
      pipeShell.position.x = (barrelStartX + barrelEndX) / 2;
      segmentGroup.add(pipeShell);
      localPipeShells.push(pipeShell);
      pipeShells.push(pipeShell);

      const waterCore = addRole(cylinderAlongX(
        innerRadius * 0.91,
        framePitch + 0.05,
        waterMaterial,
        36,
      ), `${insideDiameterInches}-inch-continuous-water-bore-${segmentIndex + 1}`);
      waterCore.position.x = framePitch / 2;
      segmentGroup.add(waterCore);
      localWaterCores.push(waterCore);
      waterCores.push(waterCore);

      for (const side of [-1, 1]) {
        const frameLog = addRole(cylinderAlongX(
          frameLogRadius,
          pipeBarrelLength,
          woodMaterial,
          18,
        ), `${insideDiameterInches}-inch-frame-${segmentIndex + 1}-log-${side < 0 ? 'near' : 'far'}`);
        frameLog.position.set(
          framePitch / 2,
          frameLogY,
          side * frameLogOffsetZ,
        );
        segmentGroup.add(frameLog);
        localFrameLogs.push(frameLog);
        frameLogs.push(frameLog);
      }

      for (const strapFraction of [0.28, 0.72]) {
        const strapX = framePitch * strapFraction;
        const strap = addRole(torusNormalX(
          outerRadius + 0.024,
          0.036,
          strapMaterial,
          9,
          44,
        ), `${insideDiameterInches}-inch-pipe-strap-${segmentIndex + 1}`);
        strap.position.x = strapX;
        segmentGroup.add(strap);
        localStraps.push(strap);
        straps.push(strap);

        const crossTie = addRole(new THREE.Mesh(
          new THREE.BoxGeometry(
            0.15,
            0.13,
            frameLogOffsetZ * 2 + 0.24,
          ),
          woodMaterial,
        ), `${insideDiameterInches}-inch-frame-cross-tie-${segmentIndex + 1}`);
        crossTie.position.set(strapX, frameLogY, 0);
        segmentGroup.add(crossTie);

        for (const side of [-1, 1]) {
          const cradle = addRole(rodBetween(
            new THREE.Vector3(
              strapX,
              frameLogY + 0.03,
              side * frameLogOffsetZ,
            ),
            new THREE.Vector3(
              strapX,
              -outerRadius * 0.60,
              side * (outerRadius + 0.015),
            ),
            0.045,
            strapMaterial,
            14,
          ), `${insideDiameterInches}-inch-pipe-cradle-${segmentIndex + 1}`);
          segmentGroup.add(cradle);
        }
      }

      const barrelStart = framePitch / 2 - pipeBarrelLength / 2;
      const barrelEnd = framePitch / 2 + pipeBarrelLength / 2;
      for (const endX of [barrelStart, barrelEnd]) {
        const barrelBand = torusNormalX(
          outerRadius + 0.012,
          0.028,
          hingeMaterial,
          8,
          40,
        );
        barrelBand.position.x = endX;
        segmentGroup.add(barrelBand);
      }

      if (segmentIndex < segmentCount - 1) {
        const ball = addRole(new THREE.Mesh(
          ballGeometry,
          jointMaterials[mainIndex],
        ), `${insideDiameterInches}-inch-ball-joint-${segmentIndex + 1}`);
        ball.position.x = framePitch;
        ball.userData.centerLocal = new THREE.Vector3(framePitch, 0, 0);
        segmentGroup.add(ball);
        localBallJoints.push(ball);
        ballJoints.push(ball);

        // Coaxial outboard stub pins leave the hydraulic passage unobstructed.
        const hingePin = addRole(new THREE.Group(),
          `${insideDiameterInches}-inch-horizontal-hinge-pin-${segmentIndex + 1}`);
        hingePin.rotation.x = Math.PI / 2;
        for (const side of [-1, 1]) {
          const stub = new THREE.Mesh(new THREE.CylinderGeometry(hingePinRadius,
            hingePinRadius, .34, 28), hingeMaterial);
          stub.position.y = side * .56;
          stub.userData.role = 'outboard-water-main-hinge-stub';
          hingePin.add(stub);
        }
        hingePin.position.x = framePitch;
        hingePin.userData.axisLocal = Z_AXIS.clone();
        hingePin.userData.centerLocal = new THREE.Vector3(framePitch, 0, 0);
        segmentGroup.add(hingePin);
        localHingePins.push(hingePin);
        hingePins.push(hingePin);

        for (const side of [-1, 1]) {
          const hingeArm = addRole(hingeArmBetween(
            new THREE.Vector3(
              framePitch - 0.34,
              frameLogY,
              side * frameLogOffsetZ,
            ),
            new THREE.Vector3(
              framePitch,
              0,
              side * .47,
            ),
            0.058,
            hingeMaterial,
          ), `${insideDiameterInches}-inch-upstream-hinge-arm-${segmentIndex + 1}`);
          segmentGroup.add(hingeArm);

          const hingeBarrel = boredJournal(.105, hingePinRadius + .004, .10, hingeMaterial);
          hingeBarrel.userData.role = 'upstream-bored-hinge-barrel';
          hingeBarrel.position.set(
            framePitch,
            0,
            side * .47,
          );
          segmentGroup.add(hingeBarrel);
        }
      }

      if (segmentIndex > 0) {
        // A finite spherical seat opens into the downstream pipe neck.
        // Clearance is geometric; no gasket preload or hydraulic solve is implied.
        const socketInner = ballRadius + .008;
        const socketProfile = [];
        for (let i = 0; i <= 24; i++) {
          const x = -.12 + .40 * i / 24;
          socketProfile.push(new THREE.Vector2(Math.sqrt(socketInner ** 2 - x ** 2) + .04, x));
        }
        socketProfile.push(new THREE.Vector2(outerRadius, .40), new THREE.Vector2(innerRadius, .40));
        for (let i = 24; i >= 0; i--) {
          const x = -.12 + .40 * i / 24;
          socketProfile.push(new THREE.Vector2(Math.sqrt(socketInner ** 2 - x ** 2), x));
        }
        socketProfile.push(socketProfile[0].clone());
        const socketBand = addRole(new THREE.Mesh(
          new THREE.LatheGeometry(socketProfile, 64).rotateZ(-Math.PI / 2),
          socketMaterials[mainIndex]), `${insideDiameterInches}-inch-socket-zone-${segmentIndex}`);
        socketBand.userData.centerLocal = new THREE.Vector3();
        socketBand.geometry.userData = {socketInnerRadius: socketInner};
        segmentGroup.add(socketBand);
        localSocketJoints.push(socketBand);
        socketJoints.push(socketBand);

        for (const side of [-1, 1]) {
          const hingeArm = addRole(hingeArmBetween(
            new THREE.Vector3(
              0.34,
              frameLogY,
              side * frameLogOffsetZ,
            ),
            new THREE.Vector3(0, 0, side * .61),
            0.058,
            hingeMaterial,
          ), `${insideDiameterInches}-inch-downstream-hinge-arm-${segmentIndex}`);
          segmentGroup.add(hingeArm);
        }
        for (const side of [-1, 1]) {
          const barrel = boredJournal(.105, hingePinRadius + .004, .10, hingeMaterial);
          barrel.position.z = side * .61;
          barrel.userData.role = 'downstream-bored-hinge-barrel';
          segmentGroup.add(barrel);
        }
      }

      if (segmentIndex === 0) {
        const mouth = addRole(torusNormalX(
          (innerRadius + outerRadius) / 2,
          (outerRadius - innerRadius) / 2,
          hingeMaterial,
          10,
          48,
        ), `${insideDiameterInches}-inch-open-south-mouth`);
        mouth.position.x = barrelStart - 0.012;
        segmentGroup.add(mouth);
        southMouths.push(mouth);
      }

      if (segmentIndex === segmentCount - 1) {
        ballGeometry.dispose();
        const plug = addRole(cylinderAlongX(
          outerRadius + 0.055,
          0.10,
          plugMaterial,
          40,
        ), `${insideDiameterInches}-inch-plugged-north-end`);
        plug.position.x = framePitch;
        segmentGroup.add(plug);
        northPlugs.push(plug);

        const towEye = addRole(new THREE.Mesh(
          new THREE.TorusGeometry(0.13, 0.032, 9, 32),
          hingeMaterial,
        ), `${insideDiameterInches}-inch-north-tow-eye`);
        towEye.rotation.y = Math.PI / 2;
        towEye.position.x = framePitch + 0.09;
        segmentGroup.add(towEye);
      }
    }

    const towCable = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.034, 0.034, 1, 16),
      cableMaterial,
    ), `${insideDiameterInches}-inch-independent-hauling-cable`);
    root.add(towCable);
    towCables.push(towCable);

    const winch = addRole(new THREE.Group(),
      `${insideDiameterInches}-inch-north-bank-winch`);
    winch.position.set(winchPoint.x, winchPoint.y, pipelineCenterZ[mainIndex]);
    root.add(winch);
    winches.push(winch);
    const winchRotor = addRole(new THREE.Group(),
      `${insideDiameterInches}-inch-winch-rotor`);
    winch.add(winchRotor);
    winchRotors.push(winchRotor);

    const drum = cylinderAlongZ(
      winchSpoolRadius,
      0.56,
      strapMaterial,
      36,
    );
    winchRotor.add(drum);
    for (const side of [-1, 1]) {
      const flange = new THREE.Mesh(
        new THREE.TorusGeometry(
          winchSpoolRadius + 0.055,
          0.038,
          9,
          40,
        ),
        hingeMaterial,
      );
      flange.position.z = side * 0.30;
      winchRotor.add(flange);
    }
    const winchIndicator = new THREE.Mesh(
      new THREE.BoxGeometry(winchSpoolRadius * 1.45, 0.055, 0.035),
      matte(PALETTE.white, { roughness: 0.50 }),
    );
    winchIndicator.position.set(winchSpoolRadius * 0.48, 0, 0.335);
    winchRotor.add(winchIndicator);

    const axle = cylinderAlongZ(0.075, 0.92, hingeMaterial, 24);
    winch.add(axle);
    for (const side of [-1, 1]) {
      const support = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.95, 0.16),
        woodMaterial,
      );
      support.position.set(0, -0.47, side * 0.39);
      winch.add(support);
    }

    pipeline.userData = {
      ballJoints: localBallJoints,
      frameLogs: localFrameLogs,
      hingePins: localHingePins,
      insideDiameterInches,
      innerRadius,
      outerRadius,
      pipeShells: localPipeShells,
      segmentGroups: localSegmentGroups,
      socketJoints: localSocketJoints,
      straps: localStraps,
      waterCores: localWaterCores,
    };
  });

  const installedChain = chainKinematics(1);
  const riverBed = addRole(new THREE.Group(), 'prepared-river-bed-trench');
  root.add(riverBed);
  const bedPieces = [];
  const bedMaterial = matte(0x8a7965, { roughness: 0.96 });
  installedChain.segments.forEach((segment, index) => {
    const bedPiece = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(framePitch + 0.08, bedThickness, 4.60),
      bedMaterial,
    ), `river-bed-piece-${index + 1}`);
    bedPiece.position.copy(segment.center)
      .addScaledVector(segment.normal, -bedNormalOffset);
    bedPiece.rotation.z = segment.angle;
    riverBed.add(bedPiece);
    bedPieces.push(bedPiece);
  });

  const riverMaterial = matte(PALETTE.fluid, {
    transparent: true,
    opacity: 0.16,
    roughness: 0.18,
  });
  riverMaterial.depthWrite = false;
  const riverMargins = [-2.33, 2.33].map((z, index) => {
    const margin = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(14.2, 0.035, 0.42),
      riverMaterial,
    ), `river-surface-reference-${index + 1}`);
    margin.position.set(0.25, 2.04, z);
    root.add(margin);
    return margin;
  });

  const bankMaterial = matte(0xb7a383, { roughness: 0.92 });
  const southBank = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 1.05, 4.85),
    bankMaterial,
  ), 'south-assembly-bank');
  southBank.position.set(-6.57, 0.18, 0);
  root.add(southBank);
  const northBank = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 1.05, 4.85),
    bankMaterial,
  ), 'north-machinery-bank');
  northBank.position.set(7.43, 0.18, 0);
  root.add(northBank);

  const update = (time) => {
    const state = stateAtTime(time);
    pipelines.forEach((pipeline, mainIndex) => {
      const z = pipelineCenterZ[mainIndex];
      pipeline.userData.segmentGroups.forEach((segmentGroup, segmentIndex) => {
        const segmentState = state.chain.segments[segmentIndex];
        segmentGroup.position.set(
          segmentState.start.x,
          segmentState.start.y,
          z,
        );
        segmentGroup.rotation.z = segmentState.angle;
      });
      const cableStart = state.chain.northEnd.clone();
      cableStart.z = z;
      const cableEnd = winchPoint.clone();
      cableEnd.z = z;
      setRodBetween(towCables[mainIndex], cableStart, cableEnd);
      winchRotors[mainIndex].rotation.z = state.winchAngle;
    });
  };

  const sourceState = stateAtPhase(0.61);
  const geometry = {
    baseAnchor: baseAnchor.clone(),
    bedNormalOffset,
    bedThickness,
    cycleDuration,
    deploymentEndPhase,
    frameLogOffsetZ,
    frameLogRadius,
    frameLogY,
    framePitch,
    haulingTravel,
    hingeAxis: Z_AXIS.clone(),
    hingePinLength,
    hingePinRadius,
    historicalPipePieceLengthFeet,
    initialCableLength,
    installedFrameClearance,
    installedHoldEndPhase,
    jointAllowance,
    modelUnitsPerFoot,
    pipeBarrelLength,
    pipelineCenterZ: [...pipelineCenterZ],
    pipeInsideDiametersInches: [...pipeInsideDiametersInches],
    pipeWallThickness,
    segmentCount,
    socketAngularCapacity,
    straightHoldEndPhase,
    targetSegmentAngles: [...targetSegmentAngles],
    winchPoint: winchPoint.clone(),
    winchSpoolRadius,
  };

  root.userData = {
    archetype:
      'watt-twin-flexible-water-mains-with-ball-socket-pipe-joints-coaxial-horizontal-frame-hinges-and-plugged-hauling-ends',
    blocks: {
      ballJoints,
      bedPieces,
      frameLogs,
      hingePins,
      northBank,
      northPlugs,
      pipeShells,
      pipelines,
      riverBed,
      riverMargins,
      segmentGroups,
      socketJoints,
      southBank,
      southMouths,
      straps,
      towCables,
      waterCores,
      winches,
      winchRotors,
    },
    cableKinematics,
    chainKinematics,
    degreesOfFreedom: {
      ballSocketAndFrameHingeCentersIndependent: false,
      hingeDegreesOfFreedomPerMain: segmentCount - 1,
      hingeTwistAllowed: false,
      independentPrescribedInputs: 1,
      mainsMechanicallyCoupled: false,
      operatingDegreesOfFreedomPerMain: segmentCount - 1,
      synchronizedDisplayOnly: true,
    },
    dynamics: {
      bedContactHydrodynamicDragPipeElasticitySealCompressionCableSagAndWinchInertiaModeled:
        false,
      installationModel:
        'One C2 display coordinate advances each otherwise independent main, translates its assembled frames toward the north machinery bank, and applies a measured bed-following angle to each rigid nine-foot representative section. The closing branch reverses only to loop the exhibit.',
      jointModel:
        'Each neighboring frame shares one horizontal pin line through the coincident center of its pipe ball and spherical socket zone. The pins permit pitch in the vertical plane but no yaw, roll, axial slip, or pipe twist.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'Each iron main is carried by its own paired-log frame. Adjacent rigid frames pitch about horizontal cross-pins whose axes pass through the exact centers of the corresponding ball-and-socket pipe joints, so the sealed water passage bends without separating while the train follows the prepared river bed. The north end is plugged during hauling.',
    motion: {
      cycleDuration,
      motionType:
        'c2-shore-assembly-to-plugged-haul-and-river-bed-following-demonstration-with-explicit-reset',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      sourcePrescribedAbsoluteTiming: false,
      sourcePrescribedNormalizedTiming: false,
    },
    sourcePose: {
      deploymentProgress: sourceState.deploymentProgress,
      jointCenters: sourceState.chain.jointCenters.map((point) => point.clone()),
      segmentAngles: sourceState.chain.segments.map(({ angle }) => angle),
    },
    sourceReference: {
      brownPlate468: {
        approximatePlanBoundsPixels: [73, 282, 415, 211],
        approximatePlanJointCenterPixels: [278, 380],
        approximateSectionBoundsPixels: [122, 62, 373, 202],
        approximateSectionJointCenterPixels: [285, 163],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 14,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'two separate mains have 15-inch and 18-inch interior diameters',
          'pipes are secured to strong log frames',
          'the frames have hinges with horizontal pivots',
          'frames and pipes were assembled on the south side',
          'the north pipe end was plugged while machinery hauled it from the north side',
          'the flexible structure follows the river bed',
        ],
        engravingEvidence:
          'Brown gives both elevation and plan: a spherical pipe joint is centered between neighboring collars, paired longitudinal logs flank the pipe, straps fasten pipe to frame, and the transverse frame hinge crosses the same joint center.',
        primaryEngineeringAccount:
          'Robison’s 1820 account states that the submerged pieces were nine feet long exclusive of joints; movable joints resembled ball-and-socket or universal joints; hinge pivots lay horizontally at right angles to the pipe axes and passed through the centers of the socket spheres. It also records the original 15-inch main and the later similar 18-inch main.',
        reconstructionDisclosure:
          'Brown supplies no frame count, river-bed profile, haul distance, joint angular limit, wall thickness, seal clearance, winch size, velocity or timing. Four representative pieces per independent main, a 30-degree socket capacity, normalized dimensions, synchronized comparative display, C2 deployment, colored materials and a 13.2-second reversible exhibit cycle are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 468',
      supplementaryPrimarySource:
        'John Robison, Edinburgh Philosophical Journal, vol. III (1820), pp. 60–62',
    },
    stateAtPhase,
    stateAtTime,
    transmission: {
      bedFollowing:
        'successive rigid log frames pitch at their shared transverse hinge centers; the pipe balls and sockets articulate about those identical centers',
      hauling:
        'each plugged north end has its own tow cable and winch; displayed winch rotation equals reeled cable length divided by spool radius',
      hydraulicPassage:
        'the nominal 15-inch and 18-inch pipes open into hollow spherical joints; articulation changes the overlapping port area, and flow and sealing are not simulated',
      jointConstraint:
        'hinge axis dot each adjacent pipe axis is zero because every pipe axis remains in the vertical installation plane and every hinge pin remains horizontal across it',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-6.95, groundY - 0.02, -2.68),
    new THREE.Vector3(7.90, 2.18, 2.68),
  );
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraDirection = new THREE.Vector3(3.5, 5.5, 15);
  root.userData.groundFloorY = groundY;

  markShadows(root);
  riverMargins.forEach((margin) => {
    margin.castShadow = false;
  });
  waterCores.forEach((waterCore) => {
    waterCore.castShadow = false;
  });
  socketJoints.forEach((socket) => {
    socket.castShadow = false;
  });
  fitPistonGuide(root, update, cycleDuration);
  // Brown draws one ball-and-socket joint, not the crossing: a sectional
  // elevation above and a plan below. The analytic crossing (two mains, banks,
  // winches) stays as the hidden motion source; both figures show its front
  // 18-inch main's middle joint, whose deflection they reproduce. The figures
  // start at the installed pose Brown draws (source phase 0.61).
  const crossing = [...root.children];
  crossing.forEach((object) => { object.visible = false; });
  const figureMaterials = {
    ball: jointMaterials[1],
    iron: hingeMaterial,
    pipe: ironMaterials[1],
    socket: ironMaterials[1],
    strap: strapMaterial,
    wood: woodMaterial,
  };
  const elevation = buildPlateJointFigure(figureMaterials, 'elevation');
  elevation.position.set(0, 1.0, 0);
  const plan = buildPlateJointFigure(figureMaterials, 'plan');
  plan.position.set(0, -0.96, 0);
  plan.rotation.x = Math.PI / 2;
  root.add(elevation, plan);
  const figureJointIndex = 1;
  const figureSourcePhase = 0.61;
  const figureDeflectionAtTime = (time) => stateAtPhase(
    time / cycleDuration + figureSourcePhase,
  ).chain.jointDeflections[figureJointIndex].angle;
  const updateAll = (time) => {
    update(time);
    const deflection = figureDeflectionAtTime(time);
    for (const figure of [elevation, plan]) {
      figure.userData.upstream.rotation.z = -deflection;
    }
  };
  markShadows(elevation);
  markShadows(plan);
  // The elevation sits above the plan on the page; it must not shade it.
  elevation.traverse((object) => { object.castShadow = false; });
  elevation.traverse((object) => { if (object.material) object.material.fog = false; });
  plan.traverse((object) => { if (object.material) object.material.fog = false; });
  root.userData.blocks.crossing = crossing;
  root.userData.blocks.plateFigures = { elevation, plan };
  root.userData.plateFigures = {
    figureDeflectionAtTime,
    figureJointIndex,
    figureSourcePhase,
    geometry: { ...FIGURE },
    presentation:
      'two figures of one joint as Brown draws it: sectional elevation above, plan below; the crossing is the hidden analytic motion source',
  };
  root.userData.update = updateAll;
  updateAll(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.92, -1.98, -1.02),
    new THREE.Vector3(2.00, 1.98, 1.02),
  );
  root.userData.cameraDirection = new THREE.Vector3(0.25, 0.2, 16);
  root.userData.cameraFov = 12;
  root.userData.cameraMaxDistance = 40;
  root.userData.cameraDistanceScale = 1.0;
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update: updateAll,
  };
}

export function createAuthoredFlexibleWaterMainMovement(movement) {
  if (movement.id !== 468) return null;
  return flexibleWaterMain(movement);
}
