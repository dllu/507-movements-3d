import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import {replaceWithLaidRope} from './laid-rope.js';
import {correctWaterSealedPump} from './water-sealed-pump-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function setRodBetween(mesh, start, end) {
  const delta = end.clone().sub(start);
  const length = Math.max(0.001, delta.length());
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.scale.y = length;
  mesh.quaternion.setFromUnitVectors(Y_AXIS, delta.normalize());
}

// Brown draws these as laid ropes: the shared three-strand rope, its lay
// fixed from the upper end. Every rope here is taut and of constant length,
// so it is built once along local -Y and then carried rigidly by its
// transform from the upper end towards the lower one.
const ROPE_DOWN = new THREE.Vector3(0, -1, 0);
function setRopeBetween(mesh, start, end, radius) {
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (mesh.userData.rigidRopeLength === undefined) {
    replaceWithLaidRope(mesh, new THREE.LineCurve3(
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -length, 0)),
    {radius, tubularSegments: 32});
    mesh.userData.rigidRopeLength = length;
  }
  mesh.position.copy(start);
  mesh.scale.set(1, 1, 1);
  mesh.quaternion.setFromUnitVectors(ROPE_DOWN, delta.normalize());
}

function waterSealedBellPump(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4.0;
  const angularVelocity = FULL_TURN / cycleDuration;
  const leverAngleAmplitude = 0.18;
  const leverPivotY = 3.05;
  const leverPivotX = 1.05;
  const leverInnerArmLength = 1.50;
  const leverOuterArmLength = 1.25;
  const suspensionRopeLength = 1.50;
  const bellLugX = 0.36;
  const bellLugLocalY = 1.21;
  const bellHeight = 2.18;
  const bellOuterRadius = 0.63;
  const bellInnerRadius = 0.55;
  const bellRoofThickness = 0.09;
  const gasArea = Math.PI * bellInnerRadius ** 2;
  const externalWaterLineY = 0.28;
  const outerTubBottomY = -0.86;
  const outerTubTopY = 1.08;
  const outerTubInnerRadius = 0.91;
  const inletPipeTopY = externalWaterLineY + 0.24;
  const inletPipeBottomY = -1.02;
  const atmosphericPressurePascal = 101325;
  const inletSourcePressurePascal = atmosphericPressurePascal;
  const inletValveCrackingPressurePascal = 450;
  const outletValveCrackingPressurePascal = 450;
  const inletOpenChamberPressurePascal = inletSourcePressurePascal
    - inletValveCrackingPressurePascal;
  const outletOpenChamberPressurePascal = atmosphericPressurePascal
    + outletValveCrackingPressurePascal;
  const waterDensityKilogramPerCubicMetre = 998;
  const gravityMetrePerSecondSquared = 9.81;
  const polytropicExponent = 1.35;

  const leverKinematicsAtPhase = (unwrappedPhase) => {
    const rawPhase = positiveModulo(unwrappedPhase, 1);
    const phase = Math.abs(rawPhase - 0.5) < 1e-12
      ? 0.5
      : Math.abs(rawPhase) < 1e-12
        ? 0
        : rawPhase;
    const phaseAngle = FULL_TURN * unwrappedPhase;
    const leverAngle = leverAngleAmplitude * Math.cos(phaseAngle);
    const leverAngularVelocity = -leverAngleAmplitude
      * angularVelocity * Math.sin(phaseAngle);
    const leverAngularAcceleration = -leverAngleAmplitude
      * angularVelocity ** 2 * Math.cos(phaseAngle);
    const cosine = Math.cos(leverAngle);
    const sine = Math.sin(leverAngle);
    const leftPivot = new THREE.Vector3(-leverPivotX, leverPivotY, 0.24);
    const rightPivot = new THREE.Vector3(leverPivotX, leverPivotY, -0.24);
    const leftInnerEnd = new THREE.Vector3(
      leftPivot.x + leverInnerArmLength * cosine,
      leverPivotY + leverInnerArmLength * sine,
      leftPivot.z,
    );
    const rightInnerEnd = new THREE.Vector3(
      rightPivot.x - leverInnerArmLength * cosine,
      leverPivotY + leverInnerArmLength * sine,
      rightPivot.z,
    );
    const leftOuterEnd = new THREE.Vector3(
      leftPivot.x - leverOuterArmLength * cosine,
      leverPivotY - leverOuterArmLength * sine,
      leftPivot.z,
    );
    const rightOuterEnd = new THREE.Vector3(
      rightPivot.x + leverOuterArmLength * cosine,
      leverPivotY - leverOuterArmLength * sine,
      rightPivot.z,
    );
    const leftLugX = -bellLugX;
    const leftHorizontalOffset = leftInnerEnd.x - leftLugX;
    const ropeVerticalDrop = Math.sqrt(Math.max(
      0,
      suspensionRopeLength ** 2 - leftHorizontalOffset ** 2,
    ));
    const bellCenterY = leftInnerEnd.y - ropeVerticalDrop
      - bellLugLocalY;

    const innerEndVelocityX = -leverInnerArmLength * sine
      * leverAngularVelocity;
    const innerEndVelocityY = leverInnerArmLength * cosine
      * leverAngularVelocity;
    const innerEndAccelerationX = -leverInnerArmLength * (
      cosine * leverAngularVelocity ** 2
      + sine * leverAngularAcceleration
    );
    const innerEndAccelerationY = leverInnerArmLength * (
      -sine * leverAngularVelocity ** 2
      + cosine * leverAngularAcceleration
    );
    const ropeDropVelocity = -leftHorizontalOffset
      * innerEndVelocityX / ropeVerticalDrop;
    const ropeDropAcceleration = -(
      innerEndVelocityX ** 2
      + leftHorizontalOffset * innerEndAccelerationX
    ) / ropeVerticalDrop - (
      leftHorizontalOffset ** 2 * innerEndVelocityX ** 2
    ) / ropeVerticalDrop ** 3;
    const bellVelocity = innerEndVelocityY - ropeDropVelocity;
    const bellAcceleration = innerEndAccelerationY
      - ropeDropAcceleration;
    const leftBellLug = new THREE.Vector3(
      -bellLugX,
      bellCenterY + bellLugLocalY,
      leftPivot.z,
    );
    const rightBellLug = new THREE.Vector3(
      bellLugX,
      bellCenterY + bellLugLocalY,
      rightPivot.z,
    );
    return {
      bellAcceleration,
      bellCenterY,
      bellVelocity,
      leftBellLug,
      leftInnerEnd,
      leftOuterEnd,
      leftPivot,
      leverAngle,
      leverAngularAcceleration,
      leverAngularVelocity,
      phase,
      phaseAngle,
      rightBellLug,
      rightInnerEnd,
      rightOuterEnd,
      rightPivot,
      ropeVerticalDrop,
    };
  };

  const topBellState = leverKinematicsAtPhase(0);
  const bottomBellState = leverKinematicsAtPhase(0.5);
  const bellStroke = topBellState.bellCenterY
    - bottomBellState.bellCenterY;

  const gasGeometryAtPressure = (bell, pressurePascal) => {
    const bellInnerRoofY = bell.bellCenterY + bellHeight / 2
      - bellRoofThickness;
    const internalWaterLineY = externalWaterLineY - (
      pressurePascal - atmosphericPressurePascal
    ) / (waterDensityKilogramPerCubicMetre
      * gravityMetrePerSecondSquared);
    const chamberHeight = bellInnerRoofY - internalWaterLineY;
    return {
      bellInnerRoofY,
      chamberHeight,
      chamberVolume: gasArea * chamberHeight,
      internalWaterLineY,
    };
  };

  const topIntakeGeometry = gasGeometryAtPressure(
    topBellState,
    inletOpenChamberPressurePascal,
  );
  const bottomExhaustGeometry = gasGeometryAtPressure(
    bottomBellState,
    outletOpenChamberPressurePascal,
  );
  const compressionPolytropicConstant = inletOpenChamberPressurePascal
    * topIntakeGeometry.chamberVolume ** polytropicExponent;
  const expansionPolytropicConstant = outletOpenChamberPressurePascal
    * bottomExhaustGeometry.chamberVolume ** polytropicExponent;

  const solveSealedPressure = (bell, constant) => {
    let low = inletOpenChamberPressurePascal;
    let high = outletOpenChamberPressurePascal;
    for (let iteration = 0; iteration < 72; iteration += 1) {
      const middle = (low + high) / 2;
      const geometry = gasGeometryAtPressure(bell, middle);
      const residual = middle
        * geometry.chamberVolume ** polytropicExponent - constant;
      if (residual > 0) high = middle;
      else low = middle;
    }
    return (low + high) / 2;
  };

  const gasStateAtPhase = (unwrappedPhase) => {
    const bell = leverKinematicsAtPhase(unwrappedPhase);
    const { phase } = bell;
    let chamberPressurePascal;
    let mode;
    let lowerInletValveOpen = false;
    let upperOutletValveOpen = false;
    let polytropicConstant = null;
    if (phase === 0) {
      chamberPressurePascal = inletOpenChamberPressurePascal;
      lowerInletValveOpen = true;
      mode = 'lower-upward-check-admits-shaft-gas-at-top-of-stroke';
    } else if (phase < 0.5) {
      const outletTrial = gasGeometryAtPressure(
        bell,
        outletOpenChamberPressurePascal,
      );
      const residualAtOutletThreshold = outletOpenChamberPressurePascal
        * outletTrial.chamberVolume ** polytropicExponent
        - compressionPolytropicConstant;
      if (residualAtOutletThreshold <= 0) {
        chamberPressurePascal = outletOpenChamberPressurePascal;
        upperOutletValveOpen = true;
        mode = 'upper-upward-check-expels-gas-during-bell-descent';
      } else {
        chamberPressurePascal = solveSealedPressure(
          bell,
          compressionPolytropicConstant,
        );
        polytropicConstant = compressionPolytropicConstant;
        mode = 'both-checks-closed-during-initial-compression';
      }
    } else if (phase === 0.5) {
      chamberPressurePascal = outletOpenChamberPressurePascal;
      upperOutletValveOpen = true;
      mode = 'upper-upward-check-open-at-bottom-of-stroke';
    } else {
      const inletTrial = gasGeometryAtPressure(
        bell,
        inletOpenChamberPressurePascal,
      );
      const residualAtInletThreshold = inletOpenChamberPressurePascal
        * inletTrial.chamberVolume ** polytropicExponent
        - expansionPolytropicConstant;
      if (residualAtInletThreshold >= 0) {
        chamberPressurePascal = inletOpenChamberPressurePascal;
        lowerInletValveOpen = true;
        mode = 'lower-upward-check-draws-gas-from-shaft-during-rise';
      } else {
        chamberPressurePascal = solveSealedPressure(
          bell,
          expansionPolytropicConstant,
        );
        polytropicConstant = expansionPolytropicConstant;
        mode = 'both-checks-closed-during-initial-rarefaction';
      }
    }
    const gas = gasGeometryAtPressure(bell, chamberPressurePascal);
    const descending = bell.bellVelocity < 0;
    const rising = bell.bellVelocity > 0;
    const outletVolumetricFlow = upperOutletValveOpen && descending
      ? -gasArea * bell.bellVelocity
      : 0;
    const inletVolumetricFlow = lowerInletValveOpen && rising
      ? gasArea * bell.bellVelocity
      : 0;
    const bellRimY = bell.bellCenterY - bellHeight / 2;
    return {
      ...bell,
      ...gas,
      bellRimY,
      compressionPolytropicResidual:
        polytropicConstant === compressionPolytropicConstant
          ? chamberPressurePascal
            * gas.chamberVolume ** polytropicExponent
            - compressionPolytropicConstant
          : 0,
      gasPressureForceOnRoofNewton: (
        chamberPressurePascal - atmosphericPressurePascal
      ) * gasArea,
      inletVolumetricFlow,
      lowerInletValveOpen,
      mode,
      outletVolumetricFlow,
      polytropicConstant,
      upperOutletValveOpen,
      expansionPolytropicResidual:
        polytropicConstant === expansionPolytropicConstant
          ? chamberPressurePascal
            * gas.chamberVolume ** polytropicExponent
            - expansionPolytropicConstant
          : 0,
      waterSealMarginExternal: externalWaterLineY - bellRimY,
      waterSealMarginInternal: gas.internalWaterLineY - bellRimY,
      chamberPressurePascal,
    };
  };

  const stateAtTime = (time) => gasStateAtPhase(time / cycleDuration);

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.68,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.38,
    roughness: 0.42,
  });
  const bellMaterial = matte(PALETTE.driver, {
    transparent: true,
    opacity: 0.58,
    metalness: 0.18,
    roughness: 0.42,
    side: THREE.DoubleSide,
  });
  bellMaterial.depthWrite = false;
  const tubMaterial = matte(PALETTE.driven, {
    transparent: true,
    opacity: 0.36,
    roughness: 0.34,
    side: THREE.DoubleSide,
  });
  tubMaterial.depthWrite = false;
  const waterMaterial = matte(0x55a9c1, {
    transparent: true,
    opacity: 0.34,
    roughness: 0.16,
    side: THREE.DoubleSide,
  });
  waterMaterial.depthWrite = false;
  const shaftGasMaterial = matte(0xa2d9b1, {
    transparent: true,
    opacity: 0.54,
    roughness: 0.18,
  });
  shaftGasMaterial.depthWrite = false;
  const exhaustGasMaterial = matte(0xe4c675, {
    transparent: true,
    opacity: 0.45,
    roughness: 0.20,
  });
  exhaustGasMaterial.depthWrite = false;
  const valveMaterial = matte(PALETTE.accent, {
    roughness: 0.66,
  });
  const ropeMaterial = matte(PALETTE.rope, {
    roughness: 0.66,
  });

  const groundY = -1.08;
  const foundation = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(4.95, 0.18, 1.72),
    frameMaterial,
  ), 'water-sealed-air-pump-foundation');
  foundation.position.set(0, groundY + 0.09, 0);
  root.add(foundation);

  const fixedFrame = addRole(new THREE.Group(),
    'fixed-lever-support-frame');
  root.add(fixedFrame);
  for (const side of [-1, 1]) {
    const column = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 3.92, 0.30),
      frameMaterial,
    );
    column.position.set(side * leverPivotX, 1.08, -0.06);
    fixedFrame.add(column);
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.24, 0.62),
      frameMaterial,
    );
    foot.position.set(side * leverPivotX, groundY + 0.20, -0.02);
    fixedFrame.add(foot);
  }
  const crosshead = new THREE.Mesh(
    new THREE.BoxGeometry(2.36, 0.22, 0.52),
    frameMaterial,
  );
  crosshead.position.set(0, 3.02, -0.04);
  fixedFrame.add(crosshead);

  const outerTub = addRole(new THREE.Group(),
    'larger-fixed-water-tub');
  root.add(outerTub);
  const tubShell = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      outerTubInnerRadius + 0.08,
      outerTubInnerRadius + 0.12,
      outerTubTopY - outerTubBottomY,
      54,
      1,
      true,
      Math.PI * 0.10,
      Math.PI * 1.72,
    ),
    tubMaterial,
  ), 'front-cutaway-outer-water-tub');
  tubShell.position.y = (outerTubTopY + outerTubBottomY) / 2;
  outerTub.add(tubShell);
  const tubBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(1.03, 1.03, 0.13, 52),
    darkMaterial,
  );
  tubBottom.position.y = outerTubBottomY - 0.08;
  outerTub.add(tubBottom);
  // Brown's dotted water line is notation; the water itself shows the level.
  const tubRings = [outerTubBottomY, outerTubTopY]
    .map((y, index) => {
      const ring = addRole(new THREE.Mesh(
        new THREE.TorusGeometry(outerTubInnerRadius + 0.10, 0.048, 9, 56),
        darkMaterial,
      ), `outer-tub-hoop-${index === 0 ? 1 : 3}`);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      outerTub.add(ring);
      return ring;
    });

  const outerWaterHeight = externalWaterLineY - outerTubBottomY;
  const outerWater = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      outerTubInnerRadius * 0.96,
      outerTubInnerRadius * 0.96,
      outerWaterHeight,
      48,
    ),
    waterMaterial,
  ), 'fixed-outer-tub-water');
  outerWater.position.y = outerTubBottomY + outerWaterHeight / 2;
  root.add(outerWater);
  const outerWaterSurface = addRole(new THREE.Mesh(
    new THREE.CircleGeometry(outerTubInnerRadius * 0.96, 56),
    waterMaterial,
  ), 'fixed-external-water-surface');
  outerWaterSurface.rotation.x = -Math.PI / 2;
  outerWaterSurface.position.y = externalWaterLineY + 0.006;
  root.add(outerWaterSurface);

  const inletPipe = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.085,
      0.085,
      inletPipeTopY - inletPipeBottomY,
      24,
    ),
    darkMaterial,
  ), 'shaft-exhaust-pipe-standing-in-tub');
  inletPipe.position.y = (inletPipeTopY + inletPipeBottomY) / 2;
  root.add(inletPipe);
  const inletGasColumn = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.052,
      0.052,
      inletPipeTopY - inletPipeBottomY + 0.08,
      18,
    ),
    shaftGasMaterial,
  ), 'carbonic-acid-gas-column-from-deep-shaft');
  inletGasColumn.position.y = (inletPipeTopY + inletPipeBottomY) / 2;
  root.add(inletGasColumn);
  const inletGasJet = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.052, 0.34, 18),
    shaftGasMaterial,
  ), 'shaft-gas-rising-through-open-lower-check');
  inletGasJet.position.y = inletPipeTopY + 0.24;
  root.add(inletGasJet);
  const lowerInletValveSeat = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.055, 28),
    darkMaterial,
  ), 'lower-upward-opening-check-valve-seat');
  lowerInletValveSeat.position.y = inletPipeTopY;
  root.add(lowerInletValveSeat);
  const lowerInletValveDisk = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.045, 28),
    valveMaterial,
  ), 'lower-upward-opening-check-valve-disk');
  root.add(lowerInletValveDisk);

  const movingBell = addRole(new THREE.Group(),
    'smaller-inverted-moving-tub');
  root.add(movingBell);
  const bellShell = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      bellOuterRadius,
      bellOuterRadius + 0.045,
      bellHeight,
      50,
      1,
      true,
      Math.PI * 0.10,
      Math.PI * 1.72,
    ),
    bellMaterial,
  ), 'front-cutaway-inverted-bell-shell');
  movingBell.add(bellShell);
  const bellRoof = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      bellOuterRadius,
      bellOuterRadius,
      bellRoofThickness,
      48,
    ),
    bellMaterial,
  ), 'closed-roof-of-inverted-bell');
  bellRoof.position.y = bellHeight / 2 - bellRoofThickness / 2;
  movingBell.add(bellRoof);
  const bellRim = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(bellOuterRadius + 0.02, 0.045, 9, 52),
    darkMaterial,
  ), 'submerged-open-bell-rim-water-seal');
  bellRim.rotation.x = Math.PI / 2;
  bellRim.position.y = -bellHeight / 2;
  movingBell.add(bellRim);
  const bellHoops = [-0.30, 0.20, 0.62].map((y, index) => {
    const hoop = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(bellOuterRadius + 0.015, 0.034, 8, 48),
      darkMaterial,
    ), `moving-bell-hoop-${index + 1}`);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = y;
    movingBell.add(hoop);
    return hoop;
  });
  const bellLugs = [-1, 1].map((side, index) => {
    const lug = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(0.10, 0.032, 8, 24),
      darkMaterial,
    ), `bell-suspension-lug-${index + 1}`);
    lug.position.set(side * bellLugX, bellLugLocalY,
      side < 0 ? 0.24 : -0.24);
    movingBell.add(lug);
    return lug;
  });

  const upperOutletPipe = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.078, 0.078, 0.27, 22),
    darkMaterial,
  ), 'short-top-outlet-pipe');
  upperOutletPipe.position.y = bellHeight / 2 + 0.11;
  movingBell.add(upperOutletPipe);
  const upperOutletValveSeat = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.045, 28),
    darkMaterial,
  ), 'upper-upward-opening-check-valve-seat');
  upperOutletValveSeat.position.y = bellHeight / 2 + 0.245;
  movingBell.add(upperOutletValveSeat);
  const upperOutletValveDisk = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.042, 28),
    valveMaterial,
  ), 'upper-upward-opening-check-valve-disk');
  movingBell.add(upperOutletValveDisk);

  const trappedGas = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      bellInnerRadius,
      bellInnerRadius,
      1,
      42,
    ),
    shaftGasMaterial,
  ), 'trapped-gas-inside-water-sealed-bell');
  root.add(trappedGas);
  const internalWaterSurface = addRole(new THREE.Mesh(
    new THREE.CircleGeometry(bellInnerRadius, 48),
    waterMaterial,
  ), 'hydrostatic-water-surface-inside-bell');
  internalWaterSurface.rotation.x = -Math.PI / 2;
  root.add(internalWaterSurface);
  const outletGasPlume = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.085, 0.36, 18),
    exhaustGasMaterial,
  ), 'gas-expelled-upward-through-top-check');
  root.add(outletGasPlume);

  const leverMaterial = matte(PALETTE.driver, {
    metalness: 0.20,
    roughness: 0.48,
  });
  const leftLever = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 1, 18),
    leverMaterial,
  ), 'left-hand-operating-lever');
  const rightLever = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 1, 18),
    leverMaterial,
  ), 'right-hand-operating-lever');
  root.add(leftLever, rightLever);
  // Brown draws stout laid ropes (about as thick as the levers' ends);
  // the suspension ropes still pass freely through the lug eyes (bore 0.068).
  const suspensionRopeRadius = 0.045;
  const pullRopeRadius = 0.05;
  const pullRopeLength = leverPivotY - 0.20;
  const leftSuspensionRope = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 1, 12),
    ropeMaterial,
  ), 'left-constant-length-bell-suspension-rope');
  const rightSuspensionRope = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 1, 12),
    ropeMaterial,
  ), 'right-constant-length-bell-suspension-rope');
  root.add(leftSuspensionRope, rightSuspensionRope);
  const leftPullRope = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1, 12),
    ropeMaterial,
  ), 'left-manual-pull-rope');
  const rightPullRope = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1, 12),
    ropeMaterial,
  ), 'right-manual-pull-rope');
  root.add(leftPullRope, rightPullRope);
  // Pass 109: each pull rope is made fast to its lever by a turn of the same
  // rope round the lever's end (a ring about the lever's axis, its bore
  // clearing the 0.14 x 0.13 bar's corners), and hangs from the bottom of
  // that turn instead of butting on the lever's underside.
  const PULL_LOOP_RADIUS = 0.14, PULL_LOOP_TUBE = 0.045, PULL_LOOP_INSET = 0.05;
  const pullLoops = ['left', 'right'].map((side) => {
    const loop = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(PULL_LOOP_RADIUS, PULL_LOOP_TUBE, 12, 40),
      ropeMaterial,
    ), `${side}-pull-rope-turn-round-lever-end`);
    // It rides with its lever; its own spin is not a shaft's speed.
    loop.userData.rotationallySymmetric = true;
    root.add(loop);
    return loop;
  });
  const loopAxis = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, 1);
  const placePullLoop = (loop, outer, inner) => {
    loopAxis.subVectors(inner, outer).normalize();
    // The rope's pull seats the turn on the bar's top face (half-height 0.07).
    loop.position.copy(outer).addScaledVector(loopAxis, PULL_LOOP_INSET);
    loop.position.y -= PULL_LOOP_RADIUS - PULL_LOOP_TUBE - 0.07;
    loop.quaternion.setFromUnitVectors(zAxis, loopAxis);
    return loop.position.clone().add(new THREE.Vector3(0, -PULL_LOOP_RADIUS, 0));
  };
  const handGrips = [-1, 1].map((side, index) => {
    const grip = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.54, 18),
      darkMaterial,
    ), `manual-hand-grip-${index + 1}`);
    grip.rotation.z = Math.PI / 2;
    root.add(grip);
    return grip;
  });
  const leverPivots = [-1, 1].map((side, index) => {
    const pivot = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, 0.62, 24),
      darkMaterial,
    ), `fixed-lever-pivot-${index + 1}`);
    pivot.rotation.x = Math.PI / 2;
    pivot.position.set(side * leverPivotX, leverPivotY,
      side < 0 ? 0.24 : -0.24);
    root.add(pivot);
    return pivot;
  });

  const update = (time) => {
    const state = stateAtTime(time);
    movingBell.position.y = state.bellCenterY;
    setRodBetween(leftLever, state.leftOuterEnd, state.leftInnerEnd);
    setRodBetween(rightLever, state.rightOuterEnd, state.rightInnerEnd);
    setRopeBetween(
      leftSuspensionRope,
      state.leftInnerEnd,
      state.leftBellLug,
      suspensionRopeRadius,
    );
    setRopeBetween(
      rightSuspensionRope,
      state.rightInnerEnd,
      state.rightBellLug,
      suspensionRopeRadius,
    );
    // Each pull rope keeps its length: the grip hangs below its lever end
    // and rises and falls with it (at y 0.20 when the levers stand level).
    const leftHang = placePullLoop(pullLoops[0], state.leftOuterEnd, state.leftInnerEnd);
    const rightHang = placePullLoop(pullLoops[1], state.rightOuterEnd, state.rightInnerEnd);
    const leftGrip = new THREE.Vector3(
      leftHang.x,
      state.leftOuterEnd.y - pullRopeLength,
      leftHang.z,
    );
    const rightGrip = new THREE.Vector3(
      rightHang.x,
      state.rightOuterEnd.y - pullRopeLength,
      rightHang.z,
    );
    setRopeBetween(leftPullRope, leftHang, leftGrip, pullRopeRadius);
    setRopeBetween(rightPullRope, rightHang, rightGrip, pullRopeRadius);
    handGrips[0].position.copy(leftGrip);
    handGrips[1].position.copy(rightGrip);

    lowerInletValveDisk.position.set(
      0,
      inletPipeTopY + 0.05
        + (state.lowerInletValveOpen ? 0.10 : 0),
      0,
    );
    upperOutletValveDisk.position.set(
      0,
      bellHeight / 2 + 0.285
        + (state.upperOutletValveOpen ? 0.10 : 0),
      0,
    );
    trappedGas.scale.y = Math.max(0.001, state.chamberHeight);
    trappedGas.position.set(
      0,
      state.internalWaterLineY + state.chamberHeight / 2,
      0,
    );
    internalWaterSurface.position.set(0, state.internalWaterLineY, 0);
    // The gas shown passing each check swells and thins with the valve's
    // eased lift instead of appearing and vanishing at full size.
    const lift = root.userData.valveLiftAtPhase?.(state.phase) ?? {
      lower: state.lowerInletValveOpen ? 1 : 0, upper: state.upperOutletValveOpen ? 1 : 0};
    outletGasPlume.visible = state.upperOutletValveOpen
      && state.outletVolumetricFlow > 0 && lift.upper > 0;
    outletGasPlume.scale.set(lift.upper, 1, lift.upper);
    outletGasPlume.position.set(
      0,
      state.bellCenterY + bellHeight / 2 + 0.52,
      0,
    );
    inletGasColumn.visible = state.lowerInletValveOpen && lift.lower > 0;
    inletGasColumn.scale.set(lift.lower, 1, lift.lower);
    inletGasJet.visible = state.lowerInletValveOpen
      && state.inletVolumetricFlow > 0 && lift.lower > 0;
    inletGasJet.scale.set(lift.lower, 1, lift.lower);
    root.userData.updateWorkingParts?.(state);
    trappedGas.material = state.upperOutletValveOpen
      ? exhaustGasMaterial
      : shaftGasMaterial;
  };

  const geometry = {
    atmosphericPressurePascal,
    bellHeight,
    bellInnerRadius,
    bellLugLocalY,
    bellLugX,
    bellOuterRadius,
    bellRoofThickness,
    bellStroke,
    bottomBellCenterY: bottomBellState.bellCenterY,
    bottomExhaustVolume: bottomExhaustGeometry.chamberVolume,
    compressionPolytropicConstant,
    cycleDuration,
    expansionPolytropicConstant,
    externalWaterLineY,
    gasArea,
    gravityMetrePerSecondSquared,
    inletOpenChamberPressurePascal,
    inletPipeBottomY,
    inletPipeTopY,
    inletSourcePressurePascal,
    inletValveCrackingPressurePascal,
    leverAngleAmplitude,
    leverInnerArmLength,
    leverOuterArmLength,
    leverPivotX,
    leverPivotY,
    outletOpenChamberPressurePascal,
    outletValveCrackingPressurePascal,
    outerTubBottomY,
    outerTubInnerRadius,
    outerTubTopY,
    polytropicExponent,
    suspensionRopeLength,
    theoreticalSweptVolume: gasArea * bellStroke,
    topBellCenterY: topBellState.bellCenterY,
    topIntakeVolume: topIntakeGeometry.chamberVolume,
    waterDensityKilogramPerCubicMetre,
  };
  const sourceState = gasStateAtPhase(0.76);
  root.userData = {
    archetype:
      'water-sealed-inverted-bell-air-pump-with-mirrored-rope-levers-two-upward-check-valves-polytropic-gas-cycle-hydrostatic-interface-and-deep-shaft-inlet',
    blocks: {
      bellHoops,
      bellLugs,
      bellRim,
      bellRoof,
      bellShell,
      crosshead,
      fixedFrame,
      foundation,
      handGrips,
      inletGasColumn,
      inletGasJet,
      inletPipe,
      internalWaterSurface,
      leftLever,
      leftPullRope,
      leftSuspensionRope,
      leverPivots,
      lowerInletValveDisk,
      lowerInletValveSeat,
      movingBell,
      outerTub,
      outerWater,
      outerWaterSurface,
      outletGasPlume,
      rightLever,
      rightPullRope,
      rightSuspensionRope,
      trappedGas,
      tubBottom,
      tubRings,
      tubShell,
      upperOutletPipe,
      upperOutletValveDisk,
      upperOutletValveSeat,
    },
    degreesOfFreedom: {
      bellAndLeverIndependent: false,
      independentPrescribedInputs: 1,
      passivePressureOperatedCheckValves: 2,
      suspensionRopesExtensible: false,
    },
    dynamics: {
      gasModel:
        'Between valve events the trapped charge obeys exact P*V^1.35. While a check is open its pressure is the corresponding source pressure plus or minus the stated cracking differential.',
      omittedEffects:
        'Water inertia, meniscus curvature, CO2 dissolution, leakage, valve inertia, rope stretch, bell mass and operator force are not supplied by Brown and are not silently invented.',
      waterModel:
        'The internal water level is solved from hydrostatic pressure head against the fixed external dotted-line level; chamber volume therefore depends on both bell height and pressure.',
    },
    fidelity: 'authored',
    gasStateAtPhase,
    geometry,
    leverKinematicsAtPhase,
    mechanism:
      'Two mirrored levers lift and lower the smaller inverted bell on constant-length ropes while its open rim remains submerged in the larger water tub. Descent compresses the trapped gas until the upper upward-opening check exhausts it. Rise expands the remaining charge until rarefaction opens the upward inlet check on the shaft pipe and draws carbonic-acid gas into the bell. Water supplies the sliding seal.',
    motion: {
      cycleDuration,
      motionType:
        'harmonically-rocked-mirrored-levers-with-exact-rope-suspended-bell-and-passive-pressure-checks',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      sourcePrescribedAbsoluteTiming: false,
      sourcePrescribedNormalizedTiming: false,
    },
    sourcePose: {
      bellCenterY: sourceState.bellCenterY,
      chamberPressurePascal: sourceState.chamberPressurePascal,
      internalWaterLineY: sourceState.internalWaterLineY,
      lowerInletValveOpen: sourceState.lowerInletValveOpen,
    },
    sourceReference: {
      brownPlate473: {
        approximateBellBoundsPixels: [184, 137, 159, 280],
        approximateFrameBoundsPixels: [158, 50, 211, 405],
        approximateLeverBoundsPixels: [39, 31, 439, 291],
        approximateOuterTubBoundsPixels: [174, 253, 190, 171],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 14,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'smaller tub is inverted inside a larger water-filled tub',
          'shaft exhaust pipe rises through the water and ends a few inches above it with an upward-opening valve',
          'short pipe and second upward-opening valve are on top of the upper tub',
          'upper tub is suspended by ropes from levers',
          'descent expels air through the upper valve and subsequent rise produces rarefaction that draws gas through the lower valve',
          'apparatus successfully removed carbonic acid from a large deep shaft',
        ],
        engravingEvidence:
          'Brown shows the fixed outer tub and dotted water level, a smaller tapered inverted bell, central shaft pipe, top check, paired crossed overhead levers, two suspension ropes, and manual pull ropes.',
        reconstructionDisclosure:
          'Brown gives no dimensions, lever angles, rope lengths, speed, valve cracking pressure, water-head scale, gas exponent, losses or operator force. The measured layout, 4-second educational cycle, exact mirrored rope geometry, 450-Pa ideal check differentials, hydrostatic interface and 1.35 polytropic sealed stages are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 473',
    },
    stateAtTime,
    transmission: {
      gasPath:
        'deep shaft -> fixed center pipe -> lower upward check -> water-sealed bell chamber -> short roof pipe -> upper upward check -> atmosphere',
      leverToBell:
        'each mirrored inner lever endpoint remains exactly one fixed rope length from its vertically guided bell lug',
      waterSeal:
        'the open bell rim remains below both the fixed external water line and the pressure-dependent internal water interface throughout the cycle',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.58, groundY - 0.05, -1.08),
    new THREE.Vector3(2.58, 3.65, 1.08),
  );
  root.userData.cameraDistanceScale = 1.00;
  root.userData.cameraDirection = new THREE.Vector3(5.6, 3.5, 10.8);
  root.userData.groundFloorY = groundY;

  correctWaterSealedPump(root);
  markShadows(root);
  for (const object of [bellShell, bellRoof, tubShell, outerWater,
    outerWaterSurface, internalWaterSurface, trappedGas, inletGasColumn,
    inletGasJet, outletGasPlume]) {
    object.castShadow = false;
  }
  root.traverse(object => {
    if (object.material?.transparent) {
      object.castShadow = false;
      object.receiveShadow = false;
    }
  });
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredWaterSealedAirPumpMovement(movement) {
  if (movement.id !== 473) return null;
  return applyCutawayFor(waterSealedBellPump(movement), movement.id);
}
