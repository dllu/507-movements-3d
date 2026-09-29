import * as THREE from 'three';
import { horizontalPlate } from './horizontal-turbine-solids.js';
import { mergePassageParts } from './finite-fluid-passages.js';
import { circle, plate, poly, polygonClipping } from './finite-plate-geometry.js';
import { waterVolumeMaterial } from './water-volume.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

function addRole(object, role) {
  object.userData.role = role;
  return object;
}
function positiveC2Lobe(value) {
  return Math.max(0, value) ** 3;
}

function doubleActingPump(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4.9;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  // Brown's section, measured on the 525-pixel plate: x=(px-272.5)/72 and
  // y=(276.5-py)/72, so the bore between the two cored jackets is 1.58 wide.
  const PX = 1 / 72;
  const sx = (px) => (px - 272.5) * PX;
  const sy = (py) => (276.5 - py) * PX;
  const pistonCenterY = 0;
  // Pass 73: a shorter stroke and longer rod keep the rod's plain top end
  // standing clear above the gland at the bottom of the stroke, as Brown
  // draws it, with the top of the stroke unchanged.
  const pistonAmplitude = 0.90;
  const pistonThickness = 0.64;
  const pistonRadius = 0.772;
  const boreHalfWidth = 0.79;
  const casingHalfDepth = 0.62;
  // Piston and flaps fill the section's depth (back plate to cut face) with a
  // running clearance: a narrower piston would leave a bypass round it.
  const pistonHalfDepth = casingHalfDepth - 0.006;
  const chamberWaterRadius = boreHalfWidth;
  const chamberArea = 2 * boreHalfWidth * 2 * pistonHalfDepth;
  const lowerChamberEndY = sy(442);
  const upperChamberEndY = sy(114);
  const rodLength = 3.85;
  const rodRadius = 0.085;
  const stuffingBoxY = sy(104);
  const maximumValveLift = 0.16;
  const maximumFlapAngle = 0.62;
  const hingeDrop = 0.045;
  // Pass 101: the hinge axes stand flapHingeShift left of their old places
  // so the bolder flaps (0.086 thick, was 0.05), centred on them, keep their
  // seat-side faces where they were.
  const flapHingeShift = 0.018;
  const flapThickness = 0.086;
  // Hinges of the four flaps: 1 and 4 hang from the top wall, 3 from the
  // underside of the left jacket and 2 from the lip of the right jacket.
  const valveSeats = Object.freeze({
    lowerDischarge3: new THREE.Vector3(sx(200) - flapHingeShift, sy(408) - hingeDrop, 0),
    lowerSuction2: new THREE.Vector3(sx(372) - flapHingeShift, sy(415) - hingeDrop, 0),
    upperDischarge4: new THREE.Vector3(sx(210) - flapHingeShift, sy(114) - hingeDrop, 0),
    upperSuction1: new THREE.Vector3(sx(372) - flapHingeShift, sy(114) - hingeDrop, 0),
  });
  const flapLengths = {
    lowerDischarge3: sy(408) - sy(442) - hingeDrop - 0.05,
    lowerSuction2: sy(415) - sy(442) - hingeDrop - 0.05,
    upperDischarge4: sy(114) - sy(145) - hingeDrop - 0.05,
    upperSuction1: sy(114) - sy(137) - hingeDrop - 0.05,
  };
  const groundY = sy(500);

  const stateAtInputAngle = (
    inputAngle,
    inputSpeed = inputAngularSpeed,
    inputAcceleration = 0,
  ) => {
    const phase = THREE.MathUtils.euclideanModulo(
      inputAngle / FULL_TURN,
      1,
    );
    const cycleAngle = FULL_TURN * phase;
    const sine = Math.sin(cycleAngle);
    const cosine = Math.cos(cycleAngle);
    const strokeCosine = Math.abs(cosine) < 1e-12 ? 0 : cosine;
    const pistonY = pistonCenterY - pistonAmplitude * sine;
    const pistonVelocity = -pistonAmplitude * strokeCosine * inputSpeed;
    const pistonAcceleration = pistonAmplitude * (
      sine * inputSpeed ** 2 - cosine * inputAcceleration
    );
    const pistonBottomY = pistonY - pistonThickness / 2;
    const pistonTopY = pistonY + pistonThickness / 2;
    const downstrokeOpen = positiveC2Lobe(strokeCosine);
    const upstrokeOpen = positiveC2Lobe(-strokeCosine);
    const downstrokeFlow = chamberArea * Math.max(0, -pistonVelocity);
    const upstrokeFlow = chamberArea * Math.max(0, pistonVelocity);
    const upperSuctionFlowRate = downstrokeFlow;
    const lowerDischargeFlowRate = downstrokeFlow;
    const lowerSuctionFlowRate = upstrokeFlow;
    const upperDischargeFlowRate = upstrokeFlow;
    const upperChamberWaterVolume = chamberArea
      * (upperChamberEndY - pistonTopY);
    const upperChamberWaterVolumeRate = -chamberArea * pistonVelocity;
    const lowerChamberWaterVolume = chamberArea
      * (pistonBottomY - lowerChamberEndY);
    const lowerChamberWaterVolumeRate = chamberArea * pistonVelocity;
    let mode;
    if (Math.abs(cosine) < 1e-12) {
      mode = sine > 0
        ? 'bottom-dead-center-all-four-checks-seated'
        : 'top-dead-center-all-four-checks-seated';
    } else if (cosine > 0) {
      mode = 'piston-down-upper-suction-1-and-lower-discharge-3-open';
    } else {
      mode = 'piston-up-lower-suction-2-and-upper-discharge-4-open';
    }
    return {
      chamberArea,
      inputAcceleration,
      inputAngle: cycleAngle,
      inputSpeed,
      lowerChamberWaterVolume,
      lowerChamberWaterVolumeRate,
      lowerDischarge3Lift: maximumValveLift * downstrokeOpen,
      lowerDischarge3Open: downstrokeOpen,
      lowerDischargeFlowRate,
      lowerSuction2Lift: maximumValveLift * upstrokeOpen,
      lowerSuction2Open: upstrokeOpen,
      lowerSuctionFlowRate,
      mode,
      phase,
      pistonAcceleration,
      pistonBottomY,
      pistonTopY,
      pistonVelocity,
      pistonY,
      rodBottomY: pistonTopY,
      rodTopY: pistonTopY + rodLength,
      totalDischargeFlowRate:
        lowerDischargeFlowRate + upperDischargeFlowRate,
      totalSuctionFlowRate: lowerSuctionFlowRate + upperSuctionFlowRate,
      upperChamberWaterVolume,
      upperChamberWaterVolumeRate,
      upperDischarge4Lift: maximumValveLift * upstrokeOpen,
      upperDischarge4Open: upstrokeOpen,
      upperDischargeFlowRate,
      upperSuction1Lift: maximumValveLift * downstrokeOpen,
      upperSuction1Open: downstrokeOpen,
      upperSuctionFlowRate,
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
    inputAngularSpeed,
    0,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.62,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.22,
    roughness: 0.50,
  });
  const pistonMaterial = matte(PALETTE.driver, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const suctionValveMaterial = matte(PALETTE.accent, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const dischargeValveMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.52,
  });
  // The casing's rear half behind the section plane: plain muted, since
  // white would read as holes on the cream page.
  const interiorMaterial = matte(PALETTE.muted, { roughness: 0.82 });

  // Planar section pieces: polygons in plate pixels, extruded through the
  // casing depth with the cut face towards the viewer.
  const px = (points) => points.map(([x, y]) => [sx(x), sy(y)]);
  const rect = (x0, y0, x1, y1) => poly(px([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]));
  const arcPoints = (cx, cy, radius, start, end, count = 32) => Array.from(
    { length: count + 1 },
    (_, i) => {
      const angle = start + (end - start) * i / count;
      return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    },
  );
  const bend = (cx, cy, inner, outer, start, end) => poly(px([
    ...arcPoints(cx, cy, outer, start, end),
    ...arcPoints(cx, cy, inner, end, start),
  ]));
  const wall = (...polygons) => plate(
    polygonClipping.union(...polygons),
    -casingHalfDepth,
    casingHalfDepth,
  );
  const roundedLeftBox = (x0, y0, x1, y1, radius) => poly(px([
    ...arcPoints(x0 + radius, y0 + radius, radius, Math.PI, 1.5 * Math.PI, 12),
    [x1, y0], [x1, y1],
    ...arcPoints(x0 + radius, y1 - radius, radius, 0.5 * Math.PI, Math.PI, 12),
  ]));

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 0.16, 3.3),
    frameMaterial,
  ), 'fixed-double-acting-pump-foundation');
  base.position.set(0, groundY - 0.3, 0);
  root.add(base);

  // Discharge B: the pipe mouth and the outer wall of the left passage,
  // which wraps round the left jacket to valves 4 and 3.
  const dischargeManifold = addRole(new THREE.Mesh(wall(
    rect(112, 42, 122, 417),
    rect(155, 42, 165, 84),
    bend(185, 84, 20, 30, Math.PI, 0.5 * Math.PI),
  ), frameMaterial), 'common-discharge-pipe-B-receiving-two-outlet-checks');
  root.add(dischargeManifold);
  // Suction A: the pipe rising up the right passage to valves 2 and 1.
  const suctionManifold = addRole(new THREE.Mesh(wall(
    rect(408, 145, 418, 500),
    bend(377, 145, 31, 41, -0.5 * Math.PI, 0),
  ), frameMaterial), 'common-suction-pipe-A-feeding-two-inlet-checks');
  root.add(suctionManifold);
  // Lower cover: the bottom of the casing, closing the lower chamber and
  // turning down as the inner wall of pipe A.
  const lowerCover = addRole(new THREE.Mesh(wall(
    bend(147, 417, 25, 35, 0.5 * Math.PI, Math.PI),
    rect(147, 442, 378, 452),
    rect(368, 442, 378, 500),
  ), frameMaterial), 'fixed-closed-lower-cylinder-end');
  root.add(lowerCover);
  // Upper cover: the straight top wall, bored for the rod.
  const rodBore = poly(circle([0, 0], rodRadius + 0.012, 96));
  const upperCover = addRole(new THREE.Mesh(horizontalPlate(
    polygonClipping.difference(
      poly([[sx(185), -casingHalfDepth], [sx(377), -casingHalfDepth],
        [sx(377), casingHalfDepth], [sx(185), casingHalfDepth]]),
      rodBore,
    ),
    sy(114),
    sy(104),
  ), frameMaterial), 'fixed-closed-upper-cylinder-end');
  root.add(upperCover);
  // The cylinder: two cored jackets whose inner faces are the bore, with the
  // right jacket's lips forming the seats of valves 1 and 2.
  const barrel = addRole(new THREE.Mesh(wall(
    polygonClipping.difference(
      roundedLeftBox(150, 145, 216, 408, 22),
      roundedLeftBox(159, 154, 207, 399, 13),
    ),
    polygonClipping.difference(rect(330, 145, 376, 408), rect(339, 154, 367, 399)),
    rect(368, 137, 376, 145),
    rect(368, 408, 376, 415),
  ), frameMaterial), 'closed-double-acting-cylinder');
  root.add(barrel);
  const backPlate = addRole(new THREE.Mesh(plate(poly(px([
    [112, 42], [112, 417],
    ...arcPoints(147, 417, 35, Math.PI, 0.5 * Math.PI, 16),
    [368, 452], [368, 500], [418, 500], [418, 145],
    ...arcPoints(377, 145, 41, 0, -0.5 * Math.PI, 16),
    ...arcPoints(185, 84, 20, 0.5 * Math.PI, Math.PI, 16),
    [165, 42],
  ])), -casingHalfDepth - 0.08, -casingHalfDepth), interiorMaterial),
  'rear-half-of-sectioned-pump-casing');
  root.add(backPlate);
  const barrelRails = addRole(new THREE.Group(),
    'fixed-cutaway-double-acting-cylinder-outline');
  root.add(barrelRails);

  const stuffingBox = addRole(new THREE.Group(),
    'fixed-stuffing-box-at-upper-cylinder-end');
  root.add(stuffingBox);
  const glandDepth = 0.32;
  const glandRect = (x0, x1) => poly([[x0, -glandDepth], [x1, -glandDepth],
    [x1, glandDepth], [x0, glandDepth]]);
  const stuffingBody = new THREE.Mesh(mergePassageParts([
    horizontalPlate(polygonClipping.difference(glandRect(sx(250), sx(315)), rodBore),
      stuffingBoxY, sy(76)),
    horizontalPlate(polygonClipping.union(
      polygonClipping.difference(glandRect(sx(250), sx(282)), rodBore),
      glandRect(sx(302), sx(315)),
    ), sy(76), sy(70)),
  ]), frameMaterial);
  stuffingBody.userData.role = 'bored-stuffing-box-gland';
  stuffingBox.add(stuffingBody);

  const piston = addRole(new THREE.Group(),
    'solid-double-acting-piston-separating-upper-and-lower-chambers');
  root.add(piston);
  const pistonBody = new THREE.Mesh(
    new THREE.BoxGeometry(2 * pistonRadius, pistonThickness, 2 * pistonHalfDepth),
    pistonMaterial,
  );
  piston.add(pistonBody);
  const pistonNut = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.06, 0.36),
    darkMaterial,
  );
  pistonNut.position.y = -pistonThickness / 2 - 0.03;
  piston.add(pistonNut);
  const pistonRod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(rodRadius, rodRadius, rodLength, 32),
    darkMaterial,
  ), 'piston-rod-sliding-through-one-end-stuffing-box');
  root.add(pistonRod);
  const rodTopMarker = new THREE.Mesh(
    new THREE.CylinderGeometry(rodRadius, rodRadius, 0.001, 16),
    darkMaterial,
  );
  rodTopMarker.visible = false;
  root.add(rodTopMarker);

  // Hinged flaps 1–4: each hangs from a fixed knuckle block and swings its
  // lower edge to the left (into the chamber for suction 1 and 2, into
  // passage B for discharge 3 and 4). Brown's small round stops sit beside
  // each hinge.
  const makeValve = (name, material, role) => {
    const length = flapLengths[name];
    const group = addRole(new THREE.Group(), role);
    group.position.copy(valveSeats[name]);
    const mountTop = name === 'lowerSuction2' ? sy(415)
      : name === 'lowerDischarge3' ? sy(408) : sy(114);
    // The knuckle's hanger: a short block from just over the knuckle up
    // into the wall it hangs from (0.0015 running clearance).
    const hangerBottom = flapThickness / 2 + 0.0015, hangerTop = mountTop - valveSeats[name].y + 0.015;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, hangerTop - hangerBottom, 2 * pistonHalfDepth),
      frameMaterial,
    );
    body.position.y = (hangerTop + hangerBottom) / 2;
    body.userData.role = 'fixed-flap-hinge-block';
    group.add(body);
    const stop = new THREE.Mesh(
      plate(poly([...arcPoints(0, 0, 0.05, Math.PI, 2 * Math.PI, 16)]),
        -pistonHalfDepth, pistonHalfDepth),
      frameMaterial,
    );
    stop.position.set(-0.14 + flapHingeShift, mountTop - valveSeats[name].y, 0);
    stop.userData.role = 'fixed-flap-stop';
    group.add(stop);
    const disk = new THREE.Group();
    // Pass 101: the knuckle is the flap's rounded top, radius half its
    // thickness.
    const knuckle = new THREE.Mesh(
      new THREE.CylinderGeometry(flapThickness / 2, flapThickness / 2, 2 * pistonHalfDepth - 0.004, 40),
      material,
    );
    knuckle.rotation.x = Math.PI / 2;
    disk.add(knuckle);
    const flap = new THREE.Mesh(
      new THREE.BoxGeometry(flapThickness, length - 0.02, 2 * pistonHalfDepth - 0.004),
      material,
    );
    flap.position.set(0, -0.01 - length / 2, 0);
    disk.add(flap);
    group.add(disk);
    group.userData.disk = disk;
    group.userData.flapLength = length;
    root.add(group);
    return group;
  };
  const upperSuctionValve1 = makeValve('upperSuction1', suctionValveMaterial,
    'number-1-upper-suction-check');
  const lowerSuctionValve2 = makeValve('lowerSuction2', suctionValveMaterial,
    'number-2-lower-suction-check');
  const lowerDischargeValve3 = makeValve('lowerDischarge3', dischargeValveMaterial,
    'number-3-lower-discharge-check');
  const upperDischargeValve4 = makeValve('upperDischarge4', dischargeValveMaterial,
    'number-4-upper-discharge-check');

  // Pass 69: seats. Every flap opens to the left, so reverse flow presses it
  // to the right: a lip on that side of each flap's free end (on the jacket
  // top for 4 and 1, on the lower cover for 3 and 2) takes it and closes the
  // port; Brown's round stops on the left limit the opening.
  const seatLips = addRole(new THREE.Mesh(wall(
    rect(212.5, 134, 216, 145),
    rect(374.5, 128, 376.5, 137),
    rect(202.5, 434, 206, 442),
    rect(374.5, 434, 377.5, 442),
  ), frameMaterial), 'fixed-seat-lips-closing-flaps-1-to-4');
  root.add(seatLips);

  // Pass 69: the primed pump is full of water. The passages A and B and the
  // spaces round the flaps are one fixed body; the two chambers follow the
  // piston (their volumes change as it sweeps, what one gains the passages
  // give and the other passes on).
  const waterMaterial = waterVolumeMaterial({ opacity: 0.34 });
  // Pass 101: the water's front face stands 0.027 behind the flaps' front
  // faces, so the working flaps read opaque and crisp on the section rather
  // than tinted behind a water layer.
  const waterFrontZ = 0.585;
  const inside = poly(px([
    [122, 42], [122, 417],
    ...arcPoints(147, 417, 25, Math.PI, 0.5 * Math.PI, 16),
    [378, 442], [378, 500], [408, 500], [408, 145],
    ...arcPoints(377, 145, 31, 0, -0.5 * Math.PI, 16),
    [185, 114], ...arcPoints(185, 84, 30, 0.5 * Math.PI, Math.PI, 16).slice(1), [155, 42],
  ]));
  const solids = [
    rect(150, 145, 216, 408), rect(330, 145, 376, 408), rect(368, 137, 376, 145), rect(368, 408, 376, 415),
    rect(147, 442, 378, 452), rect(185, 104, 377, 114),
    rect(212.5, 134, 216, 145), rect(374.5, 128, 376.5, 137), rect(202.5, 434, 206, 442), rect(374.5, 434, 377.5, 442),
  ];
  const chamber = rect(216, 114, 330, 442);
  const passageWater = addRole(new THREE.Mesh(
    plate(polygonClipping.difference(inside, ...solids, chamber), -casingHalfDepth + 0.004, waterFrontZ),
    waterMaterial,
  ), 'water-filling-passages-A-B-and-valve-ports');
  passageWater.renderOrder = 1;
  root.add(passageWater);
  const chamberBox = () => {
    const back = -casingHalfDepth + 0.004;
    const geometry = new THREE.BoxGeometry(sx(330) - sx(216), 1, waterFrontZ - back);
    geometry.translate((sx(216) + sx(330)) / 2, 0.5, (waterFrontZ + back) / 2);
    return geometry;
  };
  const upperChamberWater = addRole(new THREE.Mesh(chamberBox(), waterMaterial),
    'water-in-upper-chamber-above-piston');
  const lowerChamberWater = addRole(new THREE.Mesh(chamberBox(), waterMaterial),
    'water-in-lower-chamber-below-piston');
  for (const water of [upperChamberWater, lowerChamberWater]) { water.renderOrder = 1; root.add(water); }
  const setChamberWater = (state) => {
    upperChamberWater.position.y = state.pistonTopY + 0.004;
    upperChamberWater.scale.y = Math.max(1e-4, upperChamberEndY - state.pistonTopY - 0.004);
    lowerChamberWater.position.y = lowerChamberEndY;
    lowerChamberWater.scale.y = Math.max(1e-4, state.pistonBottomY - 0.004 - lowerChamberEndY);
  };

  const flapAngleFor = (open) => -maximumFlapAngle * open;
  const update = (time) => {
    const state = stateAtTime(time);
    piston.position.y = state.pistonY;
    pistonRod.position.y = (state.rodBottomY + state.rodTopY) / 2;
    rodTopMarker.position.set(0, state.rodTopY, 0);
    upperSuctionValve1.userData.disk.rotation.z = flapAngleFor(state.upperSuction1Open);
    lowerSuctionValve2.userData.disk.rotation.z = flapAngleFor(state.lowerSuction2Open);
    lowerDischargeValve3.userData.disk.rotation.z = flapAngleFor(state.lowerDischarge3Open);
    upperDischargeValve4.userData.disk.rotation.z = flapAngleFor(state.upperDischarge4Open);
    setChamberWater(state);
  };
  const sourceState = stateAtInputAngle(0);
  const geometry = {
    chamberArea,
    chamberWaterRadius,
    cycleDuration,
    groundY,
    inputAngularSpeed,
    lowerChamberEndY,
    boreHalfWidth,
    casingHalfDepth,
    flapLengths,
    maximumFlapAngle,
    maximumValveLift,
    pistonAmplitude,
    pistonCenterY,
    pistonRadius,
    pistonThickness,
    rodLength,
    stuffingBoxY,
    upperChamberEndY,
    valveSeats,
  };
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'closed-double-acting-pump-with-stuffing-box-four-numbered-checks-opposite-chamber-suction-and-discharge',
    blocks: {
      backPlate,
      barrel,
      barrelRails,
      base,
      dischargeManifold,
      lowerCover,
      lowerDischargeValve3,
      lowerSuctionValve2,
      piston,
      pistonBody,
      pistonRod,
      rodTopMarker,
      stuffingBox,
      suctionManifold,
      upperCover,
      upperDischargeValve4,
      upperSuctionValve1,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      lowerDischarge3Independent: false,
      lowerSuction2Independent: false,
      operatingDegreesOfFreedom: 1,
      upperDischarge4Independent: false,
      upperSuction1Independent: false,
    },
    dynamics: {
      fullPressureWaveValveImpactLeakageRodAreaDifferenceCavitationAndDriveForceModeled:
        false,
      checkValveModel:
        'Each stroke pair uses a C2 cubic lobe that swings its hinged flaps open by up to 0.62 rad. Valves 1 and 3 share the downstroke lobe; valves 2 and 4 share the disjoint upstroke lobe; all four seat at dead center.',
      flowModel:
        'Both closed cylinder chambers are treated as primed and incompressible with equal effective areas. Rod displacement, pressure losses and leakage are neglected, so one suction and the opposite discharge have exactly equal flow on every moving stroke.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'The solid piston divides a cylinder closed at both ends, and its rod slides through a stuffing box in the upper cover. On the depicted downstroke, upper suction valve 1 admits water while lower discharge valve 3 sends the displaced lower-chamber water into common pipe B; lower suction 2 and upper discharge 4 remain shut. On the upstroke, lower suction 2 admits water while upper discharge 4 sends the upper-chamber displacement to B; valves 1 and 3 shut. Thus common suction pipe A and common discharge pipe B serve opposite ends alternately.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'closed-double-acting-piston-with-alternating-diagonal-pairs-of-four-check-valves',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 452 page supplies Brown\'s static engraving and caption; its Animated control is unavailable and the page contains no Canvas mechanism or timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      lowerDischarge3Open: sourceState.lowerDischarge3Open,
      lowerSuction2Open: sourceState.lowerSuction2Open,
      mode: sourceState.mode,
      pistonVelocity: sourceState.pistonVelocity,
      upperDischarge4Open: sourceState.upperDischarge4Open,
      upperSuction1Open: sourceState.upperSuction1Open,
    },
    sourceReference: {
      brownPlate452: {
        approximateDischargePipeBCenterPixels: [112, 197],
        approximateLowerDischarge3Pixels: [191, 446],
        approximateLowerSuction2Pixels: [341, 446],
        approximatePistonCenterPixels: [279, 281],
        approximateSuctionPipeACenterPixels: [415, 309],
        approximateUpperDischarge4Pixels: [195, 120],
        approximateUpperSuction1Pixels: [350, 126],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the pump is double acting',
          'the cylinder is closed at each end',
          'the piston rod passes through a stuffing box at one end',
          'four openings have two suction and two discharge valves',
          'A is the common suction pipe and B the common discharge pipe',
          'downstroke opens upper suction 1 and lower discharge 3',
          'upstroke opens lower suction 2 and upper discharge 4',
        ],
        engravingEvidence:
          'Brown’s section shows a central closed vertical cylinder and solid piston, a rod through the top packing, right suction manifold A, left discharge manifold B, and the four checks in their numbered upper-right, lower-right, lower-left and upper-left positions. The cylinder bore is formed by two cored jackets; passage A rises up the right side to flaps 2 and 1, and passage B wraps round the left jacket from flaps 3 and 4. Its arrow depicts the piston moving downward.',
        reconstructionDisclosure:
          'Brown gives no bore, stroke, rod area, valve lift, manifold size, water source level, pressure, losses, leakage, drive, or timing. Those values, equal effective chamber areas, sinusoidal stroke, C2 flap lobes and 0.62-rad flap swing, the planar section depth, colors, and 4.9-second cycle are independently engineered. The two closed ends, stuffing box, four numbered ports, common A/B pipes, and diagonal stroke-pair sequence are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 452',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      downstrokePair:
        'upperSuction1=lowerDischarge3=max(cos(phi),0)^3.',
      massBalance:
        'dV_upper/dt=Q_upper_suction-Q_upper_discharge and dV_lower/dt=Q_lower_suction-Q_lower_discharge exactly. Total suction equals total discharge=A*|v_piston|.',
      upstrokePair:
        'lowerSuction2=upperDischarge4=max(-cos(phi),0)^3.',
    },
    update,
  };
  // Frame Brown's section: pipe mouths B and A at top and bottom. Brown
  // shows the rod's plain top end standing just above the gland, so the
  // frame reaches a little above the rod end at the top of the stroke and
  // the end stays in view throughout (the engineered stroke is longer than
  // his rod stub, so the frame is taller than the plate's crop).
  const topOfStrokeRodEndY = pistonCenterY + pistonAmplitude
    + pistonThickness / 2 + rodLength;
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(sx(100), sy(506), -1.0),
    new THREE.Vector3(sx(430), topOfStrokeRodEndY + 0.10, 1.0),
  );
  root.userData.cameraDistanceScale = 1.0;
  root.userData.cameraFov = 14;
  root.userData.cameraDirection = new THREE.Vector3(0.08, 0.05, 1);
  root.userData.groundFloorY = groundY;
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
  root.userData.solidReview = {
    qualification: 'Planar section: bored top wall and gland, piston clearance in the jacketed bore, and hinged flaps clear of their knuckle blocks, stops and seats. Flap swings and primed-fluid displacement remain prescribed; pressure, valve impact and sealing losses are not solved.',
  };
  root.traverse((object) => {
    for (const material of object.material ? [].concat(object.material) : []) {
      material.fog = false;
    }
  });
  markShadows(root);
  base.receiveShadow = true;
  // Pass 73: the rear section face takes no shadows. Light slipping past the
  // gland notch and rod bore printed pale rectangles on it, seen through the
  // cylinder water.
  backPlate.receiveShadow = false;
  // Pass 96: tagged so the render-time shadow policy (shadow-policy.js) does
  // not switch its shadow receiving back on (the pale rectangles returned).
  backPlate.userData.noShadow = true;
  for (const water of [passageWater, upperChamberWater, lowerChamberWater]) { water.castShadow = false; water.receiveShadow = false; }
  root.userData.blocks = { ...(root.userData.blocks ?? {}), passageWater, upperChamberWater, lowerChamberWater, seatLips };
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredDoubleActingPumpMovement(movement) {
  if (movement.id !== 452) return null;
  return doubleActingPump(movement);
}
