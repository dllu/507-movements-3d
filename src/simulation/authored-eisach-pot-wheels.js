import * as THREE from 'three';
import { ring, plate, poly } from './finite-plate-geometry.js';
import { makeCellWaterGeometry, updateClippedCell } from './clipped-fluid-cell.js';
import { waterVolume } from './water-volume.js';
import { WaterStream, collectWaterStreams, guidedPath } from './water-stream.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function beamBetween(start, end, width, depth, material) {
  const delta = end.clone().sub(start);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(delta.length(), width, depth),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.rotation.z = Math.atan2(delta.y, delta.x);
  return beam;
}

// Brown's pots are lozenges: spindle-shaped vessels lying axially between
// the rims, pointed at both ends. The closed finite shell leaves a slot
// facing the axle (local +y) as the inward mouth.
function lozengePotGeometry(maxRadius, halfLength, wall, centerY, mouthHalfAngle) {
  const stations = 40;
  const arc = 28;
  const start = Math.PI / 2 + mouthHalfAngle;
  const sweep = FULL_TURN - 2 * mouthHalfAngle;
  const loops = [];
  for (let i = 0; i <= stations; i += 1) {
    const z = -halfLength + 2 * halfLength * i / stations;
    const outer = Math.max(maxRadius * (1 - (z / halfLength) ** 2), 0.014);
    const inner = Math.max(outer - wall, 0.007);
    const loop = [];
    for (let j = 0; j <= arc; j += 1) {
      const angle = start + sweep * j / arc;
      loop.push([outer * Math.cos(angle), centerY + outer * Math.sin(angle), z]);
    }
    for (let j = arc; j >= 0; j -= 1) {
      const angle = start + sweep * j / arc;
      loop.push([inner * Math.cos(angle), centerY + inner * Math.sin(angle), z]);
    }
    loops.push(loop);
  }
  const positions = [];
  const push = (...points) => points.forEach(point => positions.push(...point));
  const count = loops[0].length;
  for (let i = 0; i < stations; i += 1) {
    for (let j = 0; j < count; j += 1) {
      const a = loops[i][j], b = loops[i][(j + 1) % count];
      const c = loops[i + 1][(j + 1) % count], d = loops[i + 1][j];
      push(a, b, c, a, c, d);
    }
  }
  for (const [loop, flip] of [[loops[0], true], [loops[stations], false]]) {
    const contour = loop.map(([x, y]) => new THREE.Vector2(x, y));
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
      if (flip === THREE.ShapeUtils.isClockWise(contour)) push(loop[a], loop[b], loop[c]);
      else push(loop[a], loop[c], loop[b]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  let volume = 0;
  for (let k = 0; k < positions.length; k += 9) {
    const [a, b, c] = [0, 3, 6].map(o => new THREE.Vector3(
      positions[k + o], positions[k + o + 1], positions[k + o + 2]));
    volume += a.dot(b.clone().cross(c)) / 6;
  }
  if (volume < 0) {
    const attribute = geometry.getAttribute('position');
    for (let k = 0; k < attribute.count; k += 3) {
      const x = attribute.getX(k + 1), y = attribute.getY(k + 1), z = attribute.getZ(k + 1);
      attribute.setXYZ(k + 1, attribute.getX(k + 2), attribute.getY(k + 2), attribute.getZ(k + 2));
      attribute.setXYZ(k + 2, x, y, z);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

function smoothStep5(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped ** 3 * (clamped * (clamped * 6 - 15) + 10);
}

function smoothStep5First(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  if (clamped === 0 || clamped === 1) return 0;
  return 30 * clamped ** 2 * (clamped - 1) ** 2;
}

function eisachPotWheel(movement) {
  const root = new THREE.Group();
  const cycleDuration = 12;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const sourceWheelAngle = 0;
  const wheelCenter = new THREE.Vector3(0.38, 0.28, 0);
  const wheelRadius = 2.43;
  const potCount = 12;
  const potPivotRadius = 1.85;
  const rimDepth = 1.46;
  const potTangentialWidth = 0.58;
  const potRadialDepth = 0.58;
  const potAxialWidth = 1.20;
  const potLozengeRadius = 0.30;
  // Pass 80: the pointed pot ends run into the rims, which pass through
  // the pot axes (r = potPivotRadius - potLozengeCenterY), so each pot is
  // held between the two rims as Brown draws it.
  const potLozengeHalfLength = 0.72;
  const potLozengeCenterY = -0.30;
  const potMouthHalfAngle = THREE.MathUtils.degToRad(38);
  const potCapacity = 0.0036;
  const pickupStartAngle = THREE.MathUtils.degToRad(220);
  const pickupEndAngle = THREE.MathUtils.degToRad(305);
  const dumpStartAngle = THREE.MathUtils.degToRad(78);
  const dumpPeakAngle = Math.PI / 2;
  const dumpEndAngle = THREE.MathUtils.degToRad(102);
  const pickupEndTravel = THREE.MathUtils.euclideanModulo(
    pickupEndAngle - pickupStartAngle,
    FULL_TURN,
  ) / FULL_TURN;
  const dumpStartTravel = THREE.MathUtils.euclideanModulo(
    dumpStartAngle - pickupStartAngle,
    FULL_TURN,
  ) / FULL_TURN;
  const dumpPeakTravel = THREE.MathUtils.euclideanModulo(
    dumpPeakAngle - pickupStartAngle,
    FULL_TURN,
  ) / FULL_TURN;
  const dumpEndTravel = THREE.MathUtils.euclideanModulo(
    dumpEndAngle - pickupStartAngle,
    FULL_TURN,
  ) / FULL_TURN;
  const streamSurfaceY = -1.37;
  const streamVelocityX = 1.30;
  const representativeCurrentForce = 6.20;
  const currentDriveTorque = wheelRadius * representativeCurrentForce;
  // Pass 70: Brown's trough lies about halfway between the wheel top and the
  // axle, well below the top pots, so their pour falls visibly into it (it
  // was 0.1 below the pot mouths). The spokes are all in the rear rim plane
  // and the pots' inner faces stay beyond r = 1.9, so the trough runs
  // through the wheel clear of both.
  const dischargeTroughY = 1.40;
  const dischargeTroughX = 0.10;
  const groundY = -2.75;
  const derivativeMaximum = 1.875;

  const potStateAtWorldAngle = (worldAngleValue) => {
    const worldAngle = THREE.MathUtils.euclideanModulo(
      worldAngleValue,
      FULL_TURN,
    );
    const travel = THREE.MathUtils.euclideanModulo(
      worldAngle - pickupStartAngle,
      FULL_TURN,
    ) / FULL_TURN;
    let fill = 0;
    if (travel < pickupEndTravel) {
      fill = smoothStep5(travel / pickupEndTravel);
    } else if (travel < dumpStartTravel) {
      fill = 1;
    } else if (travel < dumpEndTravel) {
      fill = 1 - smoothStep5(
        (travel - dumpStartTravel)
          / (dumpEndTravel - dumpStartTravel),
      );
    }
    let dischargeFlow = 0;
    if (travel >= dumpStartTravel && travel < dumpEndTravel) {
      const progress = (travel - dumpStartTravel)
        / (dumpEndTravel - dumpStartTravel);
      dischargeFlow = smoothStep5First(progress) / derivativeMaximum;
    }
    const inwardOpeningDirection = new THREE.Vector2(
      -Math.cos(worldAngle),
      -Math.sin(worldAngle),
    );
    return {
      dischargeFlow,
      inwardOpeningDirection,
      openingDirectionAngle: worldAngle + Math.PI,
      potFill: fill,
      potWorldRotation: worldAngle + Math.PI / 2,
      travel,
      worldAngle,
    };
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const inputRotation = THREE.MathUtils.euclideanModulo(
      inputAngle,
      FULL_TURN,
    );
    const wheelAngle = sourceWheelAngle + inputRotation;
    const potStates = [];
    for (let index = 0; index < potCount; index += 1) {
      const baseAngle = index * FULL_TURN / potCount;
      const worldAngle = wheelAngle + baseAngle;
      const potState = potStateAtWorldAngle(worldAngle);
      const pivotPosition = new THREE.Vector3(
        wheelCenter.x + potPivotRadius * Math.cos(worldAngle),
        wheelCenter.y + potPivotRadius * Math.sin(worldAngle),
        0,
      );
      potStates.push({
        ...potState,
        baseAngle,
        potIndex: index,
        potLocalRotation: baseAngle + Math.PI / 2,
        pivotPosition,
      });
    }
    const activeDischargeCount = potStates.filter(
      ({ dischargeFlow }) => dischargeFlow > 1e-12,
    ).length;
    const immersedPotCount = potStates.filter(
      ({ pivotPosition }) => pivotPosition.y < streamSurfaceY + 0.32,
    ).length;
    return {
      activeDischargeCount,
      currentDriveTorque,
      immersedPotCount,
      inputAcceleration,
      inputAngle,
      inputRotation,
      inputSpeed,
      phase: inputRotation / FULL_TURN,
      potStates,
      streamVelocityAtBottomDotWheelTangent:
        streamVelocityX * inputSpeed * wheelRadius,
      wheelAngle,
      wheelAngularAcceleration: inputAcceleration,
      wheelAngularSpeed: inputSpeed,
    };
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    return {
      ...stateAtInputAngle(inputAngularSpeed * cycleTime),
      cycleTime,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.19,
    roughness: 0.59,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.32,
    roughness: 0.45,
  });
  const wheelMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.50,
  });
  const potMaterial = matte(PALETTE.accent, {
    metalness: 0.15,
    roughness: 0.47,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.64,
    roughness: 0.27,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const paleWaterMaterial = matte(0x8ad9e5, {
    opacity: 0.67,
    roughness: 0.24,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.40 });

  const wheel = new THREE.Group();
  wheel.position.copy(wheelCenter);
  wheel.userData.role =
    'one-rigid-counterclockwise-eisach-pot-wheel';
  root.add(wheel);
  const rimRadius = potPivotRadius - potLozengeCenterY;
  const rims = [-1, 1].map((sign) => {
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(rimRadius, 0.085, 10, 96),
      wheelMaterial,
    );
    rim.position.z = sign * rimDepth / 2;
    rim.userData.role =
      `rigid-${sign < 0 ? 'rear' : 'front'}-pot-supporting-rim`;
    wheel.add(rim);
    return rim;
  });
  // Hub and spokes are one rigid wheel with the rims (not black bars).
  const hub = cylinderAlongZ(0.44, rimDepth + 0.28, wheelMaterial, 36);
  hub.geometry.dispose();
  hub.geometry = ring(.184,.44,-.80,.80);
  hub.rotation.set(0,0,0);
  hub.userData.role = 'rigid-pot-wheel-hub';
  wheel.add(hub);
  const hubIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, 0.07, 0.02),
    whiteMaterial,
  );
  hubIndex.position.set(0.31, 0, .81);
  hubIndex.userData.role = 'visible-pot-wheel-rotation-index';
  wheel.add(hubIndex);

  const spokes = [];
  const pots = [];
  const potWaters = [];
  const dischargeStreams = [];
  for (let index = 0; index < potCount; index += 1) {
    const baseAngle = index * FULL_TURN / potCount;
    for (const z of [-rimDepth / 2]) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(wheelRadius * 1.78, 0.075, 0.075),
        wheelMaterial,
      );
      spoke.geometry.dispose();
      // One radial spoke per pot, from inside the hub into the rear rim
      // (a full diameter bar per pot doubled every spoke).
      spoke.geometry = plate(poly([[0.30,-.0375],[rimRadius,-.0375],[rimRadius,.0375],[0.30,.0375]]),-.0375,.0375);
      spoke.position.z = z;
      spoke.rotation.z = baseAngle;
      spoke.userData.role = `rigid-pot-wheel-spoke-${index + 1}`;
      wheel.add(spoke);
      spokes.push(spoke);
    }

    const pot = new THREE.Group();
    pot.position.set(
      potPivotRadius * Math.cos(baseAngle),
      potPivotRadius * Math.sin(baseAngle),
      0,
    );
    pot.rotation.z = baseAngle + Math.PI / 2;
    pot.userData.role =
      `rigid-inward-opening-peripheral-pot-${index + 1}`;
    pot.userData.potIndex = index;
    wheel.add(pot);
    pots.push(pot);

    const shell = new THREE.Mesh(lozengePotGeometry(potLozengeRadius,
      potLozengeHalfLength, 0.035, potLozengeCenterY, potMouthHalfAngle),
    potMaterial);
    shell.userData.role = `lozenge-pot-${index + 1}-with-inward-facing-mouth`;
    pot.add(shell);
    const potWater = new THREE.Mesh(
      new THREE.BoxGeometry(
        potTangentialWidth - 0.15,
        1,
        potAxialWidth - 0.16,
      ),
      waterMaterial,
    );
    potWater.geometry.dispose();
    potWater.geometry = makeCellWaterGeometry();
    potWater.userData.role = `water-carried-in-rigid-pot-${index + 1}`;
    pot.add(potWater);
    potWaters.push(potWater);
    pot.userData.parts = { shell };

    // One continuous falling stream per pot, re-shaped in place each frame
    // (no allocation) from the inverted pot's mouth to the trough water.
    const dischargePath = {
      points: Array.from({length: 17}, (_, k) => new THREE.Vector3(0, -k * 0.05, 0)),
      speeds: new Array(17).fill(1),
      times: Array.from({length: 17}, (_, k) => k * 0.02),
    };
    const discharge = new WaterStream(dischargePath, {
      // A sheet as wide as the pot's mouth, pouring over its whole length.
      width: 0.42, thickness: 0.05, widthAxis: new THREE.Vector3(0, 0, 1), widthExponent: 0.2,
      spread: {start: 0.4, width: 1.12, thickness: 1.8}, fadeIn: 0.12,
      foam: {start: 0.85, amount: 0.45}, cyclePeriod: cycleDuration, streakRate: 1.6, opacity: 0.45,
    });
    discharge.userData.dischargePath = dischargePath;
    discharge.userData.role =
      `pot-${index + 1}-discharge-into-upper-trough`;
    root.add(discharge);
    dischargeStreams.push(discharge);
  }

  // Brown's long axle runs out to a trestle on each bank.
  const trestleZ = 2.65;
  const axle = cylinderAlongZ(0.18, 2 * trestleZ + 0.50, darkMaterial, 32);
  axle.position.copy(wheelCenter);
  axle.userData.role = 'fixed-horizontal-pot-wheel-axis';
  root.add(axle);
  const bearings = [-1, 1].map((sign) => {
    const bearing = new THREE.Mesh(
      new THREE.TorusGeometry(0.30, 0.075, 10, 36),
      frameMaterial,
    );
    bearing.geometry.dispose();
    bearing.geometry = ring(.184,.375,-.075,.075);
    bearing.position.set(
      wheelCenter.x,
      wheelCenter.y,
      sign * trestleZ,
    );
    bearing.userData.role =
      `fixed-${sign < 0 ? 'rear' : 'front'}-wheel-bearing`;
    root.add(bearing);
    return bearing;
  });

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(8.00, 0.24, 3.54),
    frameMaterial,
  );
  base.position.set(0, groundY + 0.12, 0);
  base.userData.role = 'fixed-eisach-wheel-base';
  root.add(base);
  const supports = [];
  for (const z of [-trestleZ, trestleZ]) {
    const left = beamBetween(
      new THREE.Vector3(-1.25, groundY + 0.27, z),
      new THREE.Vector3(wheelCenter.x, wheelCenter.y - 0.18, z),
      0.22,
      0.24,
      frameMaterial,
    );
    const right = beamBetween(
      new THREE.Vector3(2.02, groundY + 0.27, z),
      new THREE.Vector3(wheelCenter.x, wheelCenter.y - 0.18, z),
      0.22,
      0.24,
      frameMaterial,
    );
    left.userData.role = 'fixed-wheel-bearing-frame';
    right.userData.role = 'fixed-wheel-bearing-frame';
    root.add(left, right);
    supports.push(left, right);
  }

  const streamBed = new THREE.Mesh(
    new THREE.BoxGeometry(7.92, 0.20, 3.46),
    frameMaterial,
  );
  streamBed.position.set(0, groundY + 0.34, 0);
  streamBed.userData.role = 'fixed-river-bed-under-pot-wheel';
  root.add(streamBed);
  // The stream is a translucent water body running with the current under
  // the wheel, from its surface down to the bed; the lowest pots dip in.
  const streamWater = waterVolume({ xMin: -3.85, xMax: 3.85, surfaceY: streamSurfaceY, bottomY: groundY + 0.44, zMin: -1.30, zMax: 1.30 });
  streamWater.userData.role =
    'rightward-stream-partly-immersing-peripheral-pots';
  root.add(streamWater);
  const currentMarkers = [];
  for (let index = 0; index < 15; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.072, 14, 10),
      paleWaterMaterial,
    );
    marker.userData.role = `rightward-river-current-marker-${index + 1}`;
    root.add(marker);
    currentMarkers.push(marker);
  }

  const dischargeTrough = new THREE.Group();
  dischargeTrough.position.set(dischargeTroughX, dischargeTroughY, 1.50);
  dischargeTrough.rotation.y = Math.PI/2;
  dischargeTrough.rotation.z = 0;
  dischargeTrough.userData.role =
    'fixed-trough-above-stream-receiving-overturned-pots';
  root.add(dischargeTrough);
  const troughLength = 4.36;
  // Pass 93: one U-section trough (it was a plank with 0.03 lips): floor
  // 0.10 thick, walls 0.04 thick standing 0.22 above the floor, and the
  // raised water 0.13 deep (about 60% up the walls). The water's sides and
  // bottom run 0.01 into the walls and floor, so none of its faces lie on
  // theirs.
  const troughFloorTop = 0.05, troughWallTop = troughFloorTop + 0.22, troughWaterTop = troughFloorTop + 0.13;
  const troughSection = poly([[-.45, -.05], [.45, -.05], [.45, troughWallTop], [.41, troughWallTop],
    [.41, troughFloorTop], [-.41, troughFloorTop], [-.41, troughWallTop], [-.45, troughWallTop]]);
  const troughBottom = new THREE.Mesh(
    plate(troughSection, -troughLength / 2, troughLength / 2).rotateY(Math.PI / 2),
    frameMaterial,
  );
  troughBottom.userData.role = 'u-section-discharge-trough';
  dischargeTrough.add(troughBottom);
  // The U is one extrusion; its walls are part of it.
  const troughSides = [];
  const troughWater = new THREE.Mesh(
    new THREE.BoxGeometry(troughLength - 0.18, troughWaterTop - troughFloorTop + 0.01, .84),
    waterMaterial,
  );
  troughWater.position.y = (troughWaterTop + troughFloorTop - 0.01) / 2;
  troughWater.userData.role = 'raised-water-flow-in-discharge-trough';
  dischargeTrough.add(troughWater);
  // Pass 101: the delivered water visibly runs along the trough toward the
  // near (bank) end: a thin streaked sheet over the trough water's
  // surface, so the delivery reads from the default view even while the
  // pour itself is hidden behind the front rim (its underside 0.008 clear
  // of the trough water's top face).
  const troughSurfaceY = dischargeTroughY + troughWaterTop + 0.012;
  const troughRun = new WaterStream(guidedPath([
    new THREE.Vector3(dischargeTroughX, troughSurfaceY, 1.50 - (troughLength - 0.24) / 2),
    new THREE.Vector3(dischargeTroughX, troughSurfaceY, 1.50 + (troughLength - 0.24) / 2),
  ], {speed: 0.7, samples: 24}), {
    width: 0.39, thickness: 0.004, widthAxis: 'horizontal', widthExponent: 1,
    fadeIn: 0.04, fadeOut: 0.04, cyclePeriod: cycleDuration, streakRate: 1.4, opacity: 0.4,
  });
  troughRun.userData.role = 'delivered-water-running-along-discharge-trough';
  root.add(troughRun);
  const troughSupports = [dischargeTroughX-.25, dischargeTroughX+.25].map((x) => {
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.22,
        dischargeTroughY - groundY - 0.20,
        0.26,
      ),
      frameMaterial,
    );
    support.position.set(
      x,
      (dischargeTroughY + groundY + 0.20) / 2,
      2.9,
    );
    support.userData.role = 'fixed-raised-trough-support';
    root.add(support);
    return support;
  });

  const updatePotWater = (water, potState) => {
    const x = .10;
    updateClippedCell(water, [[-x,potLozengeCenterY-.17],[x,potLozengeCenterY-.17],[x,potLozengeCenterY+.05],[-x,potLozengeCenterY+.05]], potState.potWorldRotation, potState.potFill, .22, .56);
    water.visible = potState.potFill > .01;
  };

  const updateDischarge = (stream, potState) => {
    stream.visible = potState.dischargeFlow > 0.01;
    if (!stream.visible) return;
    // The water leaves the downturned mouth with the pot's own velocity
    // (the wheel turns counter-clockwise, so leftward at the top) and falls
    // freely onto the trough water.
    const mouth = potState.pivotPosition;
    const path = stream.userData.dischargePath;
    const vx = -inputAngularSpeed * (mouth.y - wheelCenter.y);
    const vy = inputAngularSpeed * (mouth.x - wheelCenter.x);
    const x0 = mouth.x, y0 = mouth.y - 0.08, z0 = 0;
    const landY = dischargeTroughY + troughWaterTop;
    const g = 9.81;
    // Time to fall to the trough water: y0 + vy t - g t^2 / 2 = landY.
    const tEnd = (vy + Math.sqrt(vy * vy + 2 * g * (y0 - landY))) / g;
    const n = path.points.length - 1;
    for (let k = 0; k <= n; k += 1) {
      const t = tEnd * k / n;
      path.points[k].set(x0 + vx * t, y0 + vy * t - 0.5 * g * t * t, z0);
      path.speeds[k] = Math.hypot(vx, vy - g * t);
      path.times[k] = t;
    }
    stream.flow = 0.35 + 0.65 * potState.dischargeFlow;
    stream.setPath(path);
    // The pour fades in and out with the flow instead of switching on
    // (Pass 101: bolder and fading in sooner, so it reads through the rim).
    stream.material.opacity = 0.6 * THREE.MathUtils.smoothstep(potState.dischargeFlow, 0.01, 0.2);
  };

  const updateWaterStreams = collectWaterStreams(root);
  const update = (time) => {
    const state = stateAtTime(time);
    wheel.rotation.z = state.wheelAngle;
    updateWaterStreams(time);
    for (let index = 0; index < potCount; index += 1) {
      const potState = state.potStates[index];
      updatePotWater(potWaters[index], potState);
      updateDischarge(dischargeStreams[index], potState);
    }
    const flowPhase = THREE.MathUtils.euclideanModulo(time / 1.02, 1);
    for (let index = 0; index < currentMarkers.length; index += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        flowPhase + index / currentMarkers.length,
        1,
      );
      currentMarkers[index].position.set(
        -3.72 + 7.44 * progress,
        streamSurfaceY + 0.08,
        -1.05 + 2.10 * ((index % 4) / 3),
      );
      currentMarkers[index].scale.setScalar(
        Math.sqrt(Math.sin(Math.PI * progress)),
      );
    }
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    currentDriveTorque,
    cycleDuration,
    dischargeTroughY,
    dumpEndAngle,
    dumpEndTravel,
    dumpPeakAngle,
    dumpPeakTravel,
    dumpStartAngle,
    dumpStartTravel,
    groundY,
    inputAngularSpeed,
    pickupEndAngle,
    pickupEndTravel,
    pickupStartAngle,
    potAxialWidth,
    potCapacity,
    potCount,
    potPivotRadius,
    potRadialDepth,
    potTangentialWidth,
    representativeCurrentForce,
    rimDepth,
    rimRadius,
    sourceWheelAngle,
    streamSurfaceY,
    streamVelocityX,
    wheelCenter: wheelCenter.clone(),
    wheelRadius,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: cycleDuration,
    },
    archetype:
      'eisach-current-driven-pot-wheel-with-twelve-rigid-inward-opening-peripheral-pots-and-high-discharge-trough',
    blocks: {
      axle,
      base,
      bearings,
      currentMarkers,
      dischargeStreams,
      dischargeTrough,
      hub,
      hubIndex,
      pots,
      potWaters,
      rims,
      spokes,
      streamBed,
      streamWater,
      supports,
      troughBottom,
      troughSides,
      troughSupports,
      troughWater,
      wheel,
    },
    degreesOfFreedom: {
      axleTranslationIndependent: false,
      potOrientationIndependent: false,
      potWaterIndependent: false,
      potsIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
    },
    dynamics: {
      currentPressurePotCaptureRetentionLeakageFreeSurfaceSloshDischargeBearingFrictionAndRotationalInertiaModeled:
        false,
      potFillSchedule:
        'Each rigid pot fills with a quintic ramp over the submerged lower arc, carries that prescribed load around the rising right side, and empties with a quintic ramp through a twenty-four-degree window centered at the upper trough. The historical source supplies no fluid timing or pot section.',
      waterRendering:
        'The visible water loads are counter-rotated to keep a horizontal world-space surface, but their free-surface shape and shifting center within each turning pot are not solved.',
      streamDrive:
        'A representative rightward current force at the bottom radius records the counterclockwise torque sign shown by Brown’s right-side upward arrow; hydrodynamic speed equilibrium is not integrated.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'One rigid wheel carries twelve equal pots secured around its periphery between two rims. Every pot has one inward-facing mouth and therefore no independent gravity-suspension pivot: at the bottom the mouth points upward while immersed and fills; counterclockwise wheel rotation raises the filled pot on the right; at the top the same rigid mouth points downward and the pot empties into the fixed trough above the stream. A rightward current acting at the immersed bottom radius supplies positive counterclockwise torque, matching Brown’s direction arrow.',
    metering: {
      elevatedVolumePerWheelRevolution: potCapacity * potCount,
      potCapacity,
      potsPerWheelRevolution: potCount,
    },
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'continuous-counterclockwise-current-driven-rigid-pot-wheel',
      wheelRevolutionsPerCycle: 1,
    },
    potStateAtWorldAngle,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 442 page supplies Brown’s static engraving and caption; its Animated control is unavailable and the page contains no Canvas mechanism or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      potFills: sourceState.potStates.map(({ potFill }) => potFill),
      potPivotPositions: sourceState.potStates.map(
        ({ pivotPosition }) => pivotPosition.clone(),
      ),
      wheelAngle: sourceState.wheelAngle,
    },
    sourceReference: {
      brownPlate442: {
        approximateAxleCenterPixels: [286, 241],
        approximateBottomPotCenterPixels: [294, 425],
        approximateDischargeTroughRightEndPixels: [273, 128],
        approximateRightDirectionArrowPixels: [386, 60],
        approximateTopPotCenterPixels: [277, 48],
        approximateWheelOuterRadiusPixels: 192,
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 22,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the ancient machine was still used on the river Eisach in the Tyrol',
          'the river current keeps the wheel in motion',
          'pots are arranged on the wheel periphery',
          'the pots are successively immersed and filled',
          'the raised pots empty into a trough above the stream',
        ],
        engravingEvidence:
          'Brown’s engraving shows a vertical two-rim wheel on a horizontal axle, a regular series of pots secured between the rims, lower pots entering the river, an upward direction arrow on the right, and the upper pot discharging into a fixed elevated wooden trough.',
        reconstructionDisclosure:
          'Brown gives no wheel or pot count, dimensions, pot attachment angle, capacity, current speed or force, immersion depth, rotation speed, fluid-retention shape, discharge duration, axle friction, losses, or timing. The twelve-pot count estimated from the engraving, inward-facing open pot geometry, dimensions, frame, tracers, colors, and twelve-second cycle are independently engineered. The rigid peripheral-pot topology (contrasting with Movement 441’s explicitly suspended buckets), current-driven rotation, successive immersion, filling, raising, and discharge into a trough above the stream are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 442',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      potOpeningDirection:
        'Each rigid pot has world opening direction -er=(cos(theta+pi),sin(theta+pi)); it points upward at the bottom and downward at the top without an independent hinge.',
      rigidAttachment:
        'potLocalRotation=baseAngle+pi/2 is constant in the wheel frame, so pot world rotation advances one-for-one with wheel angle.',
      streamTorque:
        'At the bottom r=(0,-R) and rightward F=(+F,0), hence tau_z=-r_y*F_x=R*F>0, counterclockwise.',
      successiveDischarge:
        'The twenty-four-degree dump window is narrower than the thirty-degree spacing of twelve pots, so at most one pot empties at a time.',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    // Brown looks along the wheel plane, so the depth along the current
    // need not widen the fit.
    new THREE.Vector3(-2.60, groundY, -3.05),
    new THREE.Vector3(2.60, 3.10, 3.35),
  );
  root.userData.cameraDistanceScale = 0.9;
  root.userData.cameraDirection = new THREE.Vector3(5.8, 4.3, 11.8);
  root.userData.groundFloorY = groundY;
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
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

export function createAuthoredEisachPotWheelMovement(movement) {
  if (movement.id !== 442) return null;
  return eisachPotWheel(movement);
}
