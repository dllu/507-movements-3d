import * as THREE from 'three';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

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

      const pipeShell = addRole(cylinderAlongX(
        outerRadius,
        pipeBarrelLength,
        ironMaterials[mainIndex],
        48,
        true,
      ), `${insideDiameterInches}-inch-pipe-shell-${segmentIndex + 1}`);
      pipeShell.position.x = framePitch / 2;
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
          new THREE.SphereGeometry(ballRadius, 40, 24),
          jointMaterials[mainIndex],
        ), `${insideDiameterInches}-inch-ball-joint-${segmentIndex + 1}`);
        ball.position.x = framePitch;
        ball.userData.centerLocal = new THREE.Vector3(framePitch, 0, 0);
        segmentGroup.add(ball);
        localBallJoints.push(ball);
        ballJoints.push(ball);

        const hingePin = addRole(cylinderAlongZ(
          hingePinRadius,
          hingePinLength,
          hingeMaterial,
        ), `${insideDiameterInches}-inch-horizontal-hinge-pin-${segmentIndex + 1}`);
        hingePin.position.x = framePitch;
        hingePin.userData.axisLocal = Z_AXIS.clone();
        hingePin.userData.centerLocal = new THREE.Vector3(framePitch, 0, 0);
        segmentGroup.add(hingePin);
        localHingePins.push(hingePin);
        hingePins.push(hingePin);

        for (const side of [-1, 1]) {
          const hingeArm = addRole(rodBetween(
            new THREE.Vector3(
              framePitch - 0.34,
              frameLogY,
              side * frameLogOffsetZ,
            ),
            new THREE.Vector3(
              framePitch,
              0,
              side * frameLogOffsetZ,
            ),
            0.058,
            hingeMaterial,
          ), `${insideDiameterInches}-inch-upstream-hinge-arm-${segmentIndex + 1}`);
          segmentGroup.add(hingeArm);

          const hingeBarrel = cylinderAlongZ(
            0.105,
            0.22,
            hingeMaterial,
            22,
          );
          hingeBarrel.position.set(
            framePitch,
            0,
            side * (frameLogOffsetZ + 0.01),
          );
          segmentGroup.add(hingeBarrel);
        }
      }

      if (segmentIndex > 0) {
        const socketBand = addRole(new THREE.Mesh(
          new THREE.SphereGeometry(
            socketRadius,
            44,
            18,
            Math.PI * 0.16,
            Math.PI * 1.68,
            Math.PI / 2 - socketBandHalfAngle,
            socketBandHalfAngle * 2,
          ),
          socketMaterials[mainIndex],
        ), `${insideDiameterInches}-inch-socket-zone-${segmentIndex}`);
        socketBand.rotation.z = Math.PI / 2;
        socketBand.userData.centerLocal = new THREE.Vector3(0, 0, 0);
        segmentGroup.add(socketBand);
        localSocketJoints.push(socketBand);
        socketJoints.push(socketBand);

        const socketMouthRadius = socketRadius
          * Math.cos(socketBandHalfAngle);
        for (const sign of [-1, 1]) {
          const socketLip = torusNormalX(
            socketMouthRadius,
            0.036,
            hingeMaterial,
            9,
            44,
          );
          socketLip.position.x = sign * socketRadius
            * Math.sin(socketBandHalfAngle);
          segmentGroup.add(socketLip);
        }

        for (const side of [-1, 1]) {
          const hingeArm = addRole(rodBetween(
            new THREE.Vector3(
              0.34,
              frameLogY,
              side * frameLogOffsetZ,
            ),
            new THREE.Vector3(0, 0, side * frameLogOffsetZ),
            0.058,
            hingeMaterial,
          ), `${insideDiameterInches}-inch-downstream-hinge-arm-${segmentIndex}`);
          segmentGroup.add(hingeArm);
        }
        const centerBarrel = cylinderAlongZ(
          0.105,
          0.34,
          hingeMaterial,
          22,
        );
        segmentGroup.add(centerBarrel);
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
        '15-inch and 18-inch clear bores remain center-continuous through their spherical joints; the two mains are separate and transmit no motion to one another',
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
  root.userData.cameraDirection = new THREE.Vector3(8.9, 6.4, 12.2);
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
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredFlexibleWaterMainMovement(movement) {
  if (movement.id !== 468) return null;
  return flexibleWaterMain(movement);
}
