import * as THREE from 'three';
import {WaterStream,collectWaterStreams,guidedPath,ballisticPath,joinPaths} from './water-stream.js';
import {poly,circle,plate,turned,polygonClipping} from './finite-plate-geometry.js';
import {makeCellWaterGeometry,updateClippedCell} from './clipped-fluid-cell.js';
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

function smoothStep5(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped ** 3 * (clamped * (clamped * 6 - 15) + 10);
}

function smoothStep5First(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  if (clamped === 0 || clamped === 1) return 0;
  return 30 * clamped ** 2 * (clamped - 1) ** 2;
}

function smoothStep5Second(value) {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  if (clamped === 0 || clamped === 1) return 0;
  return 60 * clamped * (2 * clamped ** 2 - 3 * clamped + 1);
}

function segmentKinematics(
  phase,
  startPhase,
  endPhase,
  startValue,
  endValue,
) {
  if (phase <= startPhase) {
    return { first: 0, second: 0, value: startValue };
  }
  if (phase >= endPhase) {
    return { first: 0, second: 0, value: endValue };
  }
  const duration = endPhase - startPhase;
  const progress = (phase - startPhase) / duration;
  const delta = endValue - startValue;
  return {
    first: delta * smoothStep5First(progress) / duration,
    second: delta * smoothStep5Second(progress) / duration ** 2,
    value: startValue + delta * smoothStep5(progress),
  };
}

function transformLocalPoint(localPoint, pivot, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector3(
    pivot.x + localPoint.x * cosine - localPoint.y * sine,
    pivot.y + localPoint.x * sine + localPoint.y * cosine,
    localPoint.z,
  );
}

function tippingWaterMeter(movement) {
  const root = new THREE.Group();
  const cycleDuration = 6;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const pivot = new THREE.Vector3(0, 0.34, 0);
  const maximumTiltAngle = THREE.MathUtils.degToRad(14);
  const troughHalfLength = 2.34;
  const troughWidth = 1.46;
  const floorLocalY = 0.31;
  const floorThickness = 0.16;
  const floorTopLocalY = floorLocalY + floorThickness / 2;
  const sideWallHeight = 0.72;
  const sideWallThickness = 0.12;
  const dividerHeight = 1.15;
  const dividerTopLocalY = floorTopLocalY + dividerHeight;
  const compartmentWaterCenterX = 1.12;
  const maximumWaterDepth = 0.43;
  const compartmentCapacity = 0.004;
  const fullWaterMass = 1.40;
  const gravity = 9.81;
  const rightFillEndPhase = 0.38;
  const rightTipEndPhase = 0.50;
  const leftFillEndPhase = 0.88;
  const leftTipEndPhase = 1;
  const tippingPhaseDuration = rightTipEndPhase - rightFillEndPhase;
  const inletFlowRate = compartmentCapacity
    / (cycleDuration * rightFillEndPhase);
  const groundY = -2.05;
  const streamX = pivot.x;
  const streamOutletY = 2.72;
  const streamBottomY = 1.08;
  const drainFlowDerivativeMaximum = 1.875;
  const leftWaterCenterLocal = new THREE.Vector3(
    -compartmentWaterCenterX,
    floorTopLocalY,
    0,
  );
  const rightWaterCenterLocal = new THREE.Vector3(
    compartmentWaterCenterX,
    floorTopLocalY,
    0,
  );
  const dividerTopLocal = new THREE.Vector3(0, dividerTopLocalY, 0);
  const leftOutletLocal = new THREE.Vector3(
    -troughHalfLength,
    floorTopLocalY + 0.04,
    0,
  );
  const rightOutletLocal = new THREE.Vector3(
    troughHalfLength,
    floorTopLocalY + 0.04,
    0,
  );

  const troughAngleKinematicsAtPhase = (phaseValue) => {
    const phase = THREE.MathUtils.euclideanModulo(phaseValue, 1);
    if (phase < rightFillEndPhase) {
      return { first: 0, second: 0, value: maximumTiltAngle };
    }
    if (phase < rightTipEndPhase) {
      return segmentKinematics(
        phase,
        rightFillEndPhase,
        rightTipEndPhase,
        maximumTiltAngle,
        -maximumTiltAngle,
      );
    }
    if (phase < leftFillEndPhase) {
      return { first: 0, second: 0, value: -maximumTiltAngle };
    }
    return segmentKinematics(
      phase,
      leftFillEndPhase,
      leftTipEndPhase,
      -maximumTiltAngle,
      maximumTiltAngle,
    );
  };

  const waterStateAtPhase = (phaseValue) => {
    const phase = THREE.MathUtils.euclideanModulo(phaseValue, 1);
    if (phase < rightFillEndPhase) {
      return {
        leftDrainFlow: 0,
        leftFill: 0,
        mode: 'right-compartment-filling-on-left-stop',
        rightDrainFlow: 0,
        rightFill: phase / rightFillEndPhase,
        stopContact: 'left',
      };
    }
    if (phase < rightTipEndPhase) {
      const progress = (phase - rightFillEndPhase)
        / tippingPhaseDuration;
      return {
        leftDrainFlow: 0,
        leftFill: 0,
        mode: 'right-compartment-descending-and-emptying',
        rightDrainFlow:
          smoothStep5First(progress) / drainFlowDerivativeMaximum,
        rightFill: 1 - smoothStep5(progress),
        stopContact: 'none',
      };
    }
    if (phase < leftFillEndPhase) {
      return {
        leftDrainFlow: 0,
        leftFill: (phase - rightTipEndPhase)
          / (leftFillEndPhase - rightTipEndPhase),
        mode: 'left-compartment-filling-on-right-stop',
        rightDrainFlow: 0,
        rightFill: 0,
        stopContact: 'right',
      };
    }
    const progress = (phase - leftFillEndPhase)
      / (leftTipEndPhase - leftFillEndPhase);
    return {
      leftDrainFlow:
        smoothStep5First(progress) / drainFlowDerivativeMaximum,
      leftFill: 1 - smoothStep5(progress),
      mode: 'left-compartment-descending-and-emptying',
      rightDrainFlow: 0,
      rightFill: 0,
      stopContact: 'none',
    };
  };

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const phase = THREE.MathUtils.euclideanModulo(
      inputAngle / FULL_TURN,
      1,
    );
    const phaseSpeed = inputSpeed / FULL_TURN;
    const phaseAcceleration = inputAcceleration / FULL_TURN;
    const angleKinematics = troughAngleKinematicsAtPhase(phase);
    const waterState = waterStateAtPhase(phase);
    const troughAngle = angleKinematics.value;
    const troughAngularSpeed = angleKinematics.first * phaseSpeed;
    const troughAngularAcceleration = angleKinematics.second
      * phaseSpeed ** 2
      + angleKinematics.first * phaseAcceleration;
    const leftWaterCenter = transformLocalPoint(
      leftWaterCenterLocal,
      pivot,
      troughAngle,
    );
    const rightWaterCenter = transformLocalPoint(
      rightWaterCenterLocal,
      pivot,
      troughAngle,
    );
    const leftWaterMass = fullWaterMass * waterState.leftFill;
    const rightWaterMass = fullWaterMass * waterState.rightFill;
    const waterTorqueAboutPivot = -gravity * (
      leftWaterMass * (leftWaterCenter.x - pivot.x)
      + rightWaterMass * (rightWaterCenter.x - pivot.x)
    );
    const dividerTop = transformLocalPoint(
      dividerTopLocal,
      pivot,
      troughAngle,
    );
    const streamOffsetFromDivider = streamX - dividerTop.x;
    let streamTargetSide = 'divider-transition';
    if (streamOffsetFromDivider > 1e-12) streamTargetSide = 'right';
    if (streamOffsetFromDivider < -1e-12) streamTargetSide = 'left';
    return {
      ...waterState,
      dividerTop,
      inputAcceleration,
      inputAngle,
      inputSpeed,
      inletFlowRate,
      leftOutletPoint: transformLocalPoint(
        leftOutletLocal,
        pivot,
        troughAngle,
      ),
      leftWaterCenter,
      leftWaterMass,
      storedWaterVolume:
        compartmentCapacity * (waterState.leftFill + waterState.rightFill),
      phase,
      phaseAcceleration,
      phaseSpeed,
      rightOutletPoint: transformLocalPoint(
        rightOutletLocal,
        pivot,
        troughAngle,
      ),
      rightWaterCenter,
      rightWaterMass,
      streamOffsetFromDivider,
      streamTargetSide,
      troughAngle,
      troughAngularAcceleration,
      troughAngularSpeed,
      waterTorqueAboutPivot,
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
    metalness: 0.20,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.32,
    roughness: 0.44,
  });
  const troughMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.50,
  });
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.5,
    roughness: 0.29,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const paleWaterMaterial = matte(0x8ad9e4, {
    opacity: 0.64,
    roughness: 0.25,
    transparent: true,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const trough = new THREE.Group();
  trough.position.copy(pivot);
  trough.userData.role =
    'one-rigid-trough-rocking-about-one-fixed-transverse-axis';
  root.add(trough);

  const makeCompartment = (side) => {
    const sign = side === 'left' ? -1 : 1;
    const compartment = new THREE.Group();
    compartment.position.x = sign * troughHalfLength / 2;
    compartment.userData.role =
      `${side}-equal-half-of-transversely-divided-trough`;
    compartment.userData.capacity = compartmentCapacity;
    trough.add(compartment);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(
        troughHalfLength,
        floorThickness,
        troughWidth,
      ),
      troughMaterial,
    );
    floor.position.y = floorLocalY;
    floor.userData.role = `${side}-compartment-floor`;
    compartment.add(floor);
    const sideWalls = [-1, 1].map((zSign) => {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(
          troughHalfLength,
          sideWallHeight,
          sideWallThickness,
        ),
        troughMaterial,
      );
      // Brown's compartments are wedges: each side wall rises from its
      // outer end to a peak at the central divider.
      const inner = -sign * troughHalfLength / 2, outer = sign * troughHalfLength / 2;
      wall.geometry.dispose();
      const profile = [
        [outer, floorTopLocalY], [inner, floorTopLocalY],
        [inner, floorTopLocalY + dividerHeight], [outer, floorTopLocalY + sideWallHeight],
      ];
      wall.geometry = plate(poly(sign > 0 ? profile.reverse() : profile), -sideWallThickness / 2, sideWallThickness / 2);
      wall.position.set(
        0,
        0,
        zSign * (troughWidth - sideWallThickness) / 2,
      );
      wall.userData.role =
        `${side}-compartment-${zSign < 0 ? 'rear' : 'front'}-side-wall`;
      compartment.add(wall);
      return wall;
    });
    return { compartment, floor, sideWalls };
  };

  const leftHalf = makeCompartment('left');
  const rightHalf = makeCompartment('right');
  const centralDivider = new THREE.Mesh(
    new THREE.BoxGeometry(
      sideWallThickness,
      dividerHeight,
      troughWidth - sideWallThickness,
    ),
    troughMaterial,
  );
  centralDivider.position.y = floorTopLocalY + dividerHeight / 2;
  centralDivider.userData.role =
    'single-transverse-divider-forming-two-equal-compartments';
  trough.add(centralDivider);

  const underBrace = new THREE.Mesh(
    new THREE.BoxGeometry(3.22, 0.18, 0.42),
    darkMaterial,
  );
  underBrace.geometry.dispose();underBrace.geometry=plate(polygonClipping.difference(poly([[-1.61,-.09],[1.61,-.09],[1.61,.09],[-1.61,.09]]),poly(circle([0,-(floorLocalY-.17)],.204,128))),-.21,.21);
  underBrace.material = troughMaterial; // part of the trough, not a black strip
  underBrace.position.y = floorLocalY - 0.17;
  underBrace.userData.role = 'rigid-trough-underframe-centered-on-axis';
  trough.add(underBrace);
  const angleIndicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.08, 0.11),
    whiteMaterial,
  );
  angleIndicator.position.set(0.73, -0.03, troughWidth / 2 + 0.06);
  angleIndicator.userData.role = 'visible-trough-angle-index';
  trough.add(angleIndicator);

  const leftWater = new THREE.Mesh(
    makeCellWaterGeometry(),
    waterMaterial,
  );
  leftWater.userData.role =
    'left-variable-water-load-with-horizontal-free-surface';
  trough.add(leftWater);
  const rightWater = new THREE.Mesh(
    makeCellWaterGeometry(),
    waterMaterial,
  );
  rightWater.userData.role =
    'right-variable-water-load-with-horizontal-free-surface';
  trough.add(rightWater);

  const axle = cylinderAlongZ(0.20, 2.38, darkMaterial, 36);
  axle.position.copy(pivot);
  axle.userData.role = 'single-fixed-transverse-trough-axis';
  root.add(axle);
  const bearingRings = [-1, 1].map((sign) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.29, 0.075, 10, 36),
      frameMaterial,
    );
    ring.geometry.dispose();ring.geometry=turned([[-.09,.204],[-.09,.365],[.09,.365],[.09,.204]]);
    ring.position.set(pivot.x, pivot.y, sign * 0.92);
    ring.userData.role = `fixed-${sign < 0 ? 'rear' : 'front'}-axis-bearing`;
    root.add(ring);
    return ring;
  });

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(5.70, 0.25, 2.74),
    frameMaterial,
  );
  // Brown's base is an open plank frame (two sills, end and middle cross
  // planks under the standards), not a slab.
  base.geometry.dispose();
  base.geometry = plate(polygonClipping.difference(
    poly([[-2.85, -1.10], [2.85, -1.10], [2.85, 1.10], [-2.85, 1.10]]),
    poly([[-2.49, -0.74], [-0.18, -0.74], [-0.18, 0.74], [-2.49, 0.74]]),
    // Offset a hair so no hole edge is collinear with the other's (keeps
    // the triangulated caps watertight).
    poly([[0.18, -0.745], [2.49, -0.745], [2.49, 0.745], [0.18, 0.745]]),
  ), -0.125, 0.125).rotateX(-Math.PI / 2);
  base.position.set(0, groundY + 0.125, 0);
  base.userData.role = 'fixed-water-meter-base';
  root.add(base);
  const supportPosts = [-1, 1].map((zSign) => {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 2.22, 0.30),
      frameMaterial,
    );
    post.geometry.dispose();post.geometry=plate(polygonClipping.difference(poly([[-.17,-1.11],[.17,-1.11],[.17,1.11],[-.17,1.11]]),poly(circle([0,pivot.y+.78],.204,128))),-.15,.15);
    post.position.set(0, -0.78, zSign * 0.92);
    post.userData.role =
      `fixed-${zSign < 0 ? 'rear' : 'front'}-pivot-standard`;
    root.add(post);
    return post;
  });
  const braces = [];
  for (const z of [-0.92, 0.92]) {
    for (const x of [-1.92, 1.92]) {
      const brace = beamBetween(
        new THREE.Vector3(x, groundY + 0.31, z),
        new THREE.Vector3(0, pivot.y - 0.20, z),
        0.18,
        0.22,
        frameMaterial,
      );
      brace.userData.role = 'fixed-diagonal-axis-frame-brace';
      root.add(brace);
      braces.push(brace);
    }
  }

  const lowFloorLocalY = floorLocalY - floorThickness / 2;
  const leftStopContact = transformLocalPoint(
    new THREE.Vector3(-2.02, lowFloorLocalY, 0),
    pivot,
    maximumTiltAngle,
  );
  const rightStopContact = transformLocalPoint(
    new THREE.Vector3(2.02, lowFloorLocalY, 0),
    pivot,
    -maximumTiltAngle,
  );
  const makeStop = (side, contact) => {
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.18, 0.64),
      darkMaterial,
    );
    const angle=side==='left'?maximumTiltAngle:-maximumTiltAngle;pad.rotation.z=angle;
    pad.position.set(contact.x+.09*Math.sin(angle),contact.y-.09*Math.cos(angle),0);
    pad.userData.role = `fixed-${side}-trough-travel-stop`;
    root.add(pad);
    return pad;
  };
  const leftStop = makeStop('left', leftStopContact);
  const rightStop = makeStop('right', rightStopContact);

  const flumeLength = 5.25;
  const flumeAngle = 0.35;
  const flumeDirection = new THREE.Vector3(
    Math.cos(flumeAngle),
    Math.sin(flumeAngle),
    0,
  );
  // The lip stands a little right of the axis: the slow sheet leaving it
  // curves down to land just beside the divider foot on the raised side.
  const flumeLipX = streamX + 0.12;
  const flumeOutlet = new THREE.Vector3(flumeLipX, streamOutletY, 0);
  const flumeCenter = flumeOutlet.clone().addScaledVector(
    flumeDirection,
    flumeLength / 2,
  );
  const flume = new THREE.Group();
  flume.position.copy(flumeCenter);
  flume.rotation.z = flumeAngle;
  flume.userData.role = 'fixed-flume-providing-continuous-fall';
  root.add(flume);
  const flumeBottom = new THREE.Mesh(
    new THREE.BoxGeometry(flumeLength, 0.08, 0.80),
    frameMaterial,
  );
  flumeBottom.userData.role = 'fixed-inlet-flume-bottom';
  flume.add(flumeBottom);
  const flumeRails = [-1, 1].map((sign) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(flumeLength, 0.26, 0.07),
      frameMaterial,
    );
    rail.position.set(0, 0.17, sign * 0.365);
    rail.userData.role = 'fixed-inlet-flume-side';
    flume.add(rail);
    return rail;
  });

  // Brown breaks the flume off beyond the plate's upper right. It carries
  // its water, a shallow sheet on the bottom that pours off the lower end
  // as the fall, and ends cleanly just beyond the default crop (the p56 post
  // and sill that held its upper end are not built; p62 support policy).
  const flumeWater = new THREE.Mesh(
    new THREE.BoxGeometry(flumeLength - 0.02, 0.06, 0.66),
    waterMaterial,
  );
  flumeWater.position.set(0.01, 0.07, 0);
  flumeWater.userData.role = 'water-running-down-the-inlet-flume';
  flume.add(flumeWater);

  // Pass 69 (p69-w1): the flume water and its fall are one continuous
  // stream: it runs down the flume floor, leaves the lip slowly and falls on
  // a projectile path past the swinging divider top into the raised half.
  flume.updateMatrix();
  const onFlumeFloor = (along) => new THREE.Vector3(along, 0.075, 0).applyMatrix4(flume.matrix);
  const lipSpeed = 0.3;
  const fallingWater = new WaterStream(joinPaths(
    guidedPath([onFlumeFloor(flumeLength / 2 - 0.05), onFlumeFloor(-flumeLength / 2)], {speed: lipSpeed, samples: 24}),
    ballisticPath({origin: onFlumeFloor(-flumeLength / 2), velocity: flumeDirection.clone().multiplyScalar(-lipSpeed),
      endY: 0.8, samples: 24}),
  ), {
    width: 0.3, thickness: 0.03, widthAxis: new THREE.Vector3(0, 0, 1), widthExponent: 0.4,
    foam: {start: 0.92, amount: 0.4}, cyclePeriod: cycleDuration, streakRate: 1.2, opacity: 0.5,
  });
  fallingWater.userData.role =
    'fixed-location-continuous-water-fall-over-moving-divider';
  root.add(fallingWater);
  flumeWater.visible = false; // the stream above carries the flume's water
  const streamMarkers = [];
  for (let index = 0; index < 8; index += 1) {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 14, 10),
      paleWaterMaterial,
    );
    marker.userData.role = `continuous-inlet-flow-marker-${index + 1}`;
    root.add(marker);
    streamMarkers.push(marker);
  }

  // Each emptying half pours from its open outer end as one stream whose
  // flow follows the drain rate; the pour is recomputed in place (no
  // allocation) as the trough swings, so it always falls under gravity.
  const spillSamples = 20;
  const makeSpill = (side) => {
    const path = {
      points: Array.from({length: spillSamples + 1}, () => new THREE.Vector3()),
      speeds: new Array(spillSamples + 1).fill(1),
      times: new Array(spillSamples + 1).fill(0),
    };
    const spill = new WaterStream(path, {
      width: 0.34, thickness: 0.05, widthAxis: new THREE.Vector3(0, 0, 1), widthExponent: 0.35,
      spread: {start: 0.55, width: 1.4, thickness: 2.2}, fadeOut: 0.3, cyclePeriod: cycleDuration,
      streakRate: 1.3, opacity: 0.46,
    });
    spill.userData.role = `${side}-outer-end-emptying-stream`;
    spill.spillPath = path;
    root.add(spill);
    return spill;
  };
  const leftSpill = makeSpill('left');
  const rightSpill = makeSpill('right');

  const updateWater = (water, side, fill, angle) => {
    const minimumX=side<0?-troughHalfLength+.025:.075;
    const maximumX=side<0?-.075:troughHalfLength-.025;
    updateClippedCell(water,[[minimumX,floorTopLocalY+.004],[maximumX,floorTopLocalY+.004],[maximumX,floorTopLocalY+sideWallHeight-.02],[minimumX,floorTopLocalY+sideWallHeight-.02]],angle,fill,maximumWaterDepth,troughWidth-2*sideWallThickness-.02);
  };

  const updateSpill = (spill, outlet, flow, side, angle) => {
    spill.visible = flow > 0.004;
    if (!spill.visible) return;
    const speed = 0.9;
    const vx = side * speed * Math.cos(angle), vy = speed * Math.sin(angle) * side;
    const g = 9.81, dropY = outlet.y - groundY;
    // The pour emerges from the lip as the flow starts (no full-length pop).
    const tEnd = Math.min(1, flow / 0.3) * (vy + Math.sqrt(vy * vy + 2 * g * dropY)) / g;
    const {points, speeds, times} = spill.spillPath;
    for (let i = 0; i <= spillSamples; i += 1) {
      const t = tEnd * i / spillSamples;
      points[i].set(outlet.x + vx * t, outlet.y + vy * t - 0.5 * g * t * t, 0);
      speeds[i] = Math.hypot(vx, vy - g * t);
      times[i] = t;
    }
    spill.flow = Math.max(0.004, flow);
    spill.setPath(spill.spillPath);
  };

  const updateStreams = collectWaterStreams(root);
  const update = (time) => {
    const state = stateAtTime(time);
    trough.rotation.z = state.troughAngle;
    updateWater(leftWater, -1, state.leftFill, state.troughAngle);
    updateWater(rightWater, 1, state.rightFill, state.troughAngle);
    updateSpill(leftSpill, state.leftOutletPoint, state.leftDrainFlow, -1, state.troughAngle);
    updateSpill(rightSpill, state.rightOutletPoint, state.rightDrainFlow, 1, state.troughAngle);
    updateStreams(time);
    const flowPhase = THREE.MathUtils.euclideanModulo(time / 0.72, 1);
    for (let index = 0; index < streamMarkers.length; index += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        flowPhase + index / streamMarkers.length,
        1,
      );
      streamMarkers[index].position.set(
        streamX,
        streamOutletY
          + (streamBottomY - streamOutletY) * progress,
        0.18,
      );
      streamMarkers[index].scale.setScalar(
        Math.sqrt(Math.sin(Math.PI * progress)),
      );
    }
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    compartmentCapacity,
    compartmentWaterCenterX,
    cycleDuration,
    dividerHeight,
    dividerTopLocal: dividerTopLocal.clone(),
    floorLocalY,
    floorThickness,
    floorTopLocalY,
    fullWaterMass,
    gravity,
    groundY,
    inletFlowRate,
    leftFillEndPhase,
    leftStopContact: leftStopContact.clone(),
    leftTipEndPhase,
    maximumTiltAngle,
    maximumWaterDepth,
    pivot: pivot.clone(),
    rightFillEndPhase,
    rightStopContact: rightStopContact.clone(),
    rightTipEndPhase,
    sideWallHeight,
    streamBottomY,
    streamOutletY,
    streamX,
    tippingPhaseDuration,
    troughHalfLength,
    troughWidth,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: cycleDuration,
    },
    archetype:
      'tipping-water-meter-with-equally-divided-pivoted-trough-alternately-filling-and-emptying',
    blocks: {
      angleIndicator,
      axle,
      base,
      bearingRings,
      braces,
      centralDivider,
      fallingWater,
      flume,
      flumeBottom,
      flumeRails,
      leftCompartment: leftHalf.compartment,
      leftFloor: leftHalf.floor,
      leftSideWalls: leftHalf.sideWalls,
      leftSpill,
      leftStop,
      leftWater,
      rightCompartment: rightHalf.compartment,
      rightFloor: rightHalf.floor,
      rightSideWalls: rightHalf.sideWalls,
      rightSpill,
      rightStop,
      rightWater,
      streamMarkers,
      supportPosts,
      trough,
      underBrace,
    },
    degreesOfFreedom: {
      compartmentFillsIndependent: false,
      dividerIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      pivotTranslationIndependent: false,
      troughHalvesIndependent: false,
    },
    dynamics: {
      fluidImpactSplashViscosityFreeSurfaceSloshDryTroughInertiaBearingFrictionStopImpactAndThresholdInstabilityModeled:
        false,
      phaseSchedule:
        'The two constant-flow filling dwells and the two rapid quintic zero-velocity, zero-acceleration tipping strokes are an independently engineered explanatory schedule. The water load in the descending half is smoothly removed during each stroke; threshold and impact dynamics are not integrated.',
      waterSurfaceTreatment:
        'Each visible water load is counter-rotated inside the rigid trough so its free surface remains horizontal in world space while its center follows the rocking compartment.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'One rigid trough is divided transversely into two equal open-ended compartments and rocks about one fixed axis in the frame beneath it. At either travel stop the raised inner half lies under the continuous fall and fills. Its increasing off-center water load supplies torque toward that side; at the tipping threshold the loaded side descends, discharges through its outer end, and carries the opposite half beneath the same fixed stream. The opposite fill and tip repeats, so each half-cycle meters one equal compartment volume.',
    metering: {
      compartmentCapacity,
      equalVolumePerTip: compartmentCapacity,
      tipsPerCycle: 2,
      volumePerCycle: 2 * compartmentCapacity,
    },
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType: 'alternating-fill-tip-empty-tip-back',
      troughAngleMaximum: maximumTiltAngle,
      troughAngleMinimum: -maximumTiltAngle,
      troughNetRevolutionsPerCycle: 0,
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 440 page supplies Brown’s static engraving and caption; its Animated control is unavailable and the page contains no Canvas mechanism or source timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      leftFill: sourceState.leftFill,
      stopContact: sourceState.stopContact,
      rightFill: sourceState.rightFill,
      streamTargetSide: sourceState.streamTargetSide,
      troughAngle: sourceState.troughAngle,
    },
    sourceReference: {
      brownPlate440: {
        approximateCentralDividerPixels: [273, 264],
        approximateFrameBaseLeftPixels: [52, 500],
        approximateFrameBaseRightPixels: [405, 500],
        approximateIncomingStreamImpactPixels: [280, 244],
        approximateLeftDischargePixels: [17, 411],
        approximatePivotPixels: [209, 301],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'one trough divided transversely into equal parts',
          'the divided trough is supported on an axis by a frame beneath',
          'falling water fills one side and vibrates the trough on its axis',
          'the filling side delivers its water while the opposite side is brought under the stream',
          'the alternating apparatus has been used as a water meter',
        ],
        engravingEvidence:
          'Brown’s engraving shows one long two-ended trough, a high transverse center division, one axle in a standard below it, a fixed elevated inlet flume, and water discharging from the lowered outer end.',
        reconstructionDisclosure:
          'Brown gives no dimensions, tilt limits, compartment capacity, flow rate, mass, center of gravity, tipping threshold, stop geometry, bearing friction, impact law, or timing. Those quantities, the symmetric stops, colors, free-surface rendering, flow tracers, and six-second cycle are independently engineered. The equal two-part rigid trough, single fixed axis, alternating fill-tip-discharge sequence, continuous fall, and equal-volume metering principle are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 440',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      fixedAxis:
        'The rigid trough transform is Rz(theta) about one fixed pivot; neither compartment has an independent pose.',
      gravityTorque:
        'tau_z=-g*(m_left*x_left+m_right*x_right), measured from the fixed pivot; a right-side load gives clockwise torque and a left-side load gives counterclockwise torque.',
      streamSelection:
        'The fixed stream is centered over the moving divider. Positive tilt shifts the divider top left of the stream so the right half receives it; negative tilt shifts the divider top right so the left half receives it.',
      symmetricStroke:
        'theta alternates between equal limits +14 degrees and -14 degrees, with exact zero speed and acceleration at both stops.',
    },
    troughAngleKinematicsAtPhase,
    update,
    waterStateAtPhase,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.10, groundY, -1.20),
    new THREE.Vector3(4.00, 4.12, 1.20),
  );
  root.userData.cameraDistanceScale = 1.07;
  root.userData.cameraDirection = new THREE.Vector3(6.1, 7.2, 10.8);
  root.userData.groundFloorY = groundY;
  root.userData.hideGround=true;
  root.userData.solidReview={qualification:'Finite passages, water envelopes and contact geometry; bucket/trough motion and fill remain prescribed, without validated passive dynamics or fluid loads.'};
  root.traverse(object=>{for(const material of object.material?[].concat(object.material):[])material.fog=false;});
  root.userData.minimumDisplayCycleSeconds=cycleDuration;
  markShadows(root);
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredTippingWaterMeterMovement(movement) {
  if (movement.id !== 440) return null;
  return tippingWaterMeter(movement);
}
