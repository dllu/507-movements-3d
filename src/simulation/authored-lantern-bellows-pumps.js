import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import { correctFlexiblePumpParts } from './flexible-pump-working-parts.js';
import {horizontalRing as solidRing, horizontalTurned, horizontalPlate} from './horizontal-turbine-solids.js';
import {curvedPipeWall, mergePassageParts} from './finite-fluid-passages.js';
import {circle, plate, poly, polygonClipping} from './finite-plate-geometry.js';
import {latheAtAngles, stackedFluidGeometry, withoutPlaneFaces} from './stacked-fluid-volume.js';
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

function horizontalRing(radius, tubeRadius, material) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 12, 48),
    material,
  );
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function setCylinderBetween(mesh, start, end) {
  const delta = end.clone().sub(start);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    delta.clone().normalize(),
  );
  mesh.scale.set(1, delta.length(), 1);
}

function positiveC2Lobe(value) {
  return Math.max(0, value) ** 3;
}

function makeTube(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const tube = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(curve, 72, radius, 16, false),
    material,
  ), role);
  tube.userData.curve = curve;
  return tube;
}

function doubleLanternBellowsPump(movement) {
  const root = new THREE.Group();
  const cycleDuration = 5.4;
  const inputAngularSpeed = FULL_TURN / cycleDuration;
  const beamPivot = new THREE.Vector3(0, 3.20, 0);
  const beamPinHalfSpan = 1.75;
  const beamAmplitude = THREE.MathUtils.degToRad(18);
  const connectingRodLength = 1.18;
  const linkEyeHeight = .29;
  const topPlateHalfThickness = 0.07;
  const bellowsFloorY = -0.11;
  const bellowsCenterXs = Object.freeze({ left: -1.75, right: 1.75 });
  const bellowsWaterRadius = 0.67;
  const bellowsEffectiveArea = Math.PI * bellowsWaterRadius ** 2;
  const maximumValveLift = 0.15;
  const groundY = -3.00;
  const maximumFlapAngle = THREE.MathUtils.degToRad(35);
  // Hinge axes of Brown's four flap checks (see the chest below).
  const valveSeats = Object.freeze({
    leftDelivery: new THREE.Vector3(-0.43, -0.37, 0),
    leftSuction: new THREE.Vector3(-1.51, -1.07, 0),
    rightDelivery: new THREE.Vector3(0.43, -0.37, 0),
    rightSuction: new THREE.Vector3(1.51, -1.07, 0),
  });

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
    const strokeSine = Math.abs(sine) < 1e-12 ? 0 : sine;
    const beamAngle = -beamAmplitude * cosine;
    const beamAngularSpeed = beamAmplitude * strokeSine * inputSpeed;
    const beamAngularAcceleration = beamAmplitude * (
      cosine * inputSpeed ** 2 + sine * inputAcceleration
    );
    const pinCosine = Math.cos(beamAngle);
    const pinSine = Math.sin(beamAngle);
    const leftBeamPin = new THREE.Vector3(
      beamPivot.x - beamPinHalfSpan * pinCosine,
      beamPivot.y - beamPinHalfSpan * pinSine,
      0,
    );
    const rightBeamPin = new THREE.Vector3(
      beamPivot.x + beamPinHalfSpan * pinCosine,
      beamPivot.y + beamPinHalfSpan * pinSine,
      0,
    );
    const leftPinVelocity = new THREE.Vector3(
      beamPinHalfSpan * pinSine * beamAngularSpeed,
      -beamPinHalfSpan * pinCosine * beamAngularSpeed,
      0,
    );
    const rightPinVelocity = leftPinVelocity.clone().multiplyScalar(-1);
    const leftPinAcceleration = new THREE.Vector3(
      beamPinHalfSpan * (
        pinCosine * beamAngularSpeed ** 2
          + pinSine * beamAngularAcceleration
      ),
      beamPinHalfSpan * (
        pinSine * beamAngularSpeed ** 2
          - pinCosine * beamAngularAcceleration
      ),
      0,
    );
    const rightPinAcceleration = leftPinAcceleration
      .clone()
      .multiplyScalar(-1);
    const leftTopPlateCenter = leftBeamPin.clone();
    leftTopPlateCenter.y -= connectingRodLength + linkEyeHeight;
    const rightTopPlateCenter = rightBeamPin.clone();
    rightTopPlateCenter.y -= connectingRodLength + linkEyeHeight;
    const leftBellowsTopY = leftTopPlateCenter.y
      - topPlateHalfThickness;
    const rightBellowsTopY = rightTopPlateCenter.y
      - topPlateHalfThickness;
    const leftBellowsHeight = leftBellowsTopY - bellowsFloorY;
    const rightBellowsHeight = rightBellowsTopY - bellowsFloorY;
    const leftBellowsVelocity = leftPinVelocity.y;
    const rightBellowsVelocity = -leftBellowsVelocity;
    const leftBellowsAcceleration = leftPinAcceleration.y;
    const rightBellowsAcceleration = -leftBellowsAcceleration;
    const leftBellowsWaterVolume = bellowsEffectiveArea
      * leftBellowsHeight;
    const rightBellowsWaterVolume = bellowsEffectiveArea
      * rightBellowsHeight;
    const leftBellowsWaterVolumeRate = bellowsEffectiveArea
      * leftBellowsVelocity;
    const rightBellowsWaterVolumeRate = -leftBellowsWaterVolumeRate;
    const leftSuctionFlowRate = Math.max(
      0,
      leftBellowsWaterVolumeRate,
    );
    const leftDeliveryFlowRate = Math.max(
      0,
      -leftBellowsWaterVolumeRate,
    );
    const rightSuctionFlowRate = Math.max(
      0,
      rightBellowsWaterVolumeRate,
    );
    const rightDeliveryFlowRate = Math.max(
      0,
      -rightBellowsWaterVolumeRate,
    );
    const leftCompressingOpen = positiveC2Lobe(strokeSine);
    const leftExpandingOpen = positiveC2Lobe(-strokeSine);
    let mode;
    if (strokeSine === 0) {
      mode = cosine >= 0
        ? 'left-distended-right-compressed-dead-center-all-checks-seated'
        : 'right-distended-left-compressed-dead-center-all-checks-seated';
    } else if (strokeSine > 0) {
      mode = 'left-compressing-to-discharge-right-expanding-from-suction';
    } else {
      mode = 'right-compressing-to-discharge-left-expanding-from-suction';
    }
    return {
      beamAngle,
      beamAngularAcceleration,
      beamAngularSpeed,
      bellowsEffectiveArea,
      inputAcceleration,
      inputAngle: cycleAngle,
      inputSpeed,
      leftBeamPin,
      leftBellowsAcceleration,
      leftBellowsHeight,
      leftBellowsTopY,
      leftBellowsVelocity,
      leftBellowsWaterVolume,
      leftBellowsWaterVolumeRate,
      leftDeliveryFlowRate,
      leftDeliveryValveLift: maximumValveLift * leftCompressingOpen,
      leftDeliveryValveOpen: leftCompressingOpen,
      leftPinAcceleration,
      leftPinVelocity,
      leftSuctionFlowRate,
      leftSuctionValveLift: maximumValveLift * leftExpandingOpen,
      leftSuctionValveOpen: leftExpandingOpen,
      leftTopPlateCenter,
      mode,
      phase,
      rightBeamPin,
      rightBellowsAcceleration,
      rightBellowsHeight,
      rightBellowsTopY,
      rightBellowsVelocity,
      rightBellowsWaterVolume,
      rightBellowsWaterVolumeRate,
      rightDeliveryFlowRate,
      rightDeliveryValveLift: maximumValveLift * leftExpandingOpen,
      rightDeliveryValveOpen: leftExpandingOpen,
      rightPinAcceleration,
      rightPinVelocity,
      rightSuctionFlowRate,
      rightSuctionValveLift: maximumValveLift * leftCompressingOpen,
      rightSuctionValveOpen: leftCompressingOpen,
      rightTopPlateCenter,
      totalDeliveryFlowRate:
        leftDeliveryFlowRate + rightDeliveryFlowRate,
      totalSuctionFlowRate: leftSuctionFlowRate + rightSuctionFlowRate,
    };
  };

  const stateAtTime = (time) => stateAtInputAngle(
    inputAngularSpeed * time,
    inputAngularSpeed,
    0,
  );

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.60,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.20,
    roughness: 0.50,
  });
  const beamMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.56,
  });
  const bellowsMaterial = matte(PALETTE.driven, {
    opacity: 0.86,
    roughness: 0.56,
    side: THREE.DoubleSide,
    transparent: true,
  });
  const shellMaterial = matte(PALETTE.muted, {
    opacity: 0.28,
    roughness: 0.72,
    side: THREE.DoubleSide,
    transparent: true,
  });
  shellMaterial.depthWrite = false;
  const waterMaterial = matte(PALETTE.fluid, {
    opacity: 0.68,
    roughness: 0.30,
    side: THREE.DoubleSide,
    transparent: true,
  });
  waterMaterial.depthWrite = false;
  const suctionValveMaterial = matte(PALETTE.accent, {
    metalness: 0.12,
    roughness: 0.48,
  });
  const deliveryValveMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.48,
  });

  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 0.15, 3.0),
    frameMaterial,
  ), 'fixed-double-bellows-pump-foundation');
  base.position.set(0, groundY + 0.075, 0);
  root.add(base);

  const beam = addRole(new THREE.Group(),
    'single-common-rocking-lever-driving-bellows-in-opposition');
  beam.position.copy(beamPivot);
  root.add(beam);
  const beamBody = new THREE.Mesh(
    new THREE.BoxGeometry(6.55, 0.22, 0.38),
    beamMaterial,
  );
  beamBody.position.x = 0.32;
  beam.add(beamBody);
  // Pass 98: Brown draws no grip on the beam's broken-off right end; the old
  // plain cylinder (r 0.15) was undrawn and the beam's 0.38-deep end ran
  // through it with its faces standing out of it, so it is not built.

  const pivotAxle = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.74, 32),
    darkMaterial,
  ), 'fixed-rocking-beam-fulcrum');
  pivotAxle.rotation.x = Math.PI / 2;
  pivotAxle.position.copy(beamPivot);
  root.add(pivotAxle);
  const pivotCollar = horizontalRing(0.24, 0.055, suctionValveMaterial);
  pivotCollar.position.copy(beamPivot);
  root.add(pivotCollar);

  const makeBeamPin = (x) => {
    const pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.58, 24),
      darkMaterial,
    );
    pin.rotation.x = Math.PI / 2;
    pin.position.x = x;
    beam.add(pin);
    return pin;
  };
  makeBeamPin(-beamPinHalfSpan);
  makeBeamPin(beamPinHalfSpan);

  const topPlateGeometry = new THREE.CylinderGeometry(
    0.97,
    0.97,
    topPlateHalfThickness * 2,
    48,
  );
  const leftTopPlate = addRole(new THREE.Mesh(
    topPlateGeometry,
    beamMaterial,
  ), 'left-moving-lantern-bellows-top-plate');
  const rightTopPlate = addRole(new THREE.Mesh(
    topPlateGeometry,
    beamMaterial,
  ), 'right-moving-lantern-bellows-top-plate');
  root.add(leftTopPlate, rightTopPlate);

  // Pass 70: the bellows stand directly on the chest top (no separate plates).

  const rodGeometry = new THREE.CylinderGeometry(0.085, 0.085, 1, 24);
  const leftConnectingRod = addRole(new THREE.Mesh(
    rodGeometry,
    darkMaterial,
  ), 'left-constant-length-vertical-beam-to-bellows-rod');
  const rightConnectingRod = addRole(new THREE.Mesh(
    rodGeometry,
    darkMaterial,
  ), 'right-constant-length-vertical-beam-to-bellows-rod');
  root.add(leftConnectingRod, rightConnectingRod);

  const pleatRadii = [0.76, 0.93, 0.73, 0.93, 0.73,
    0.93, 0.73, 0.93, 0.76];
  const makeBellows = (side) => {
    const group = addRole(new THREE.Group(),
      `${side}-flexible-lantern-bellows-with-eight-visible-pleats`);
    root.add(group);
    const rings = pleatRadii.map((radius, index) => {
      const ring = addRole(horizontalRing(
        radius,
        index === 0 || index === pleatRadii.length - 1 ? 0.055 : 0.07,
        darkMaterial,
      ), `${side}-bellows-pleat-ring-${index + 1}`);
      group.add(ring);
      return ring;
    });
    const skins = Array.from(
      { length: pleatRadii.length - 1 },
      (_, index) => {
        const skin = new THREE.Mesh(
          new THREE.CylinderGeometry(
            pleatRadii[index + 1],
            pleatRadii[index],
            1,
            40,
            1,
            true,
          ),
          bellowsMaterial,
        );
        group.add(skin);
        return skin;
      },
    );
    // Pass 88: a unit-height column whose floor is an annulus round the
    // chest opening (the chest water continues through it), sheared each
    // frame so the floor stays level on the chest.
    const openingAngles = Array.from({length: 128}, (_, i) => 2 * Math.PI * i / 128);
    const water = addRole(new THREE.Mesh(
      latheAtAngles([[0, 0.45 - 0.008], [0, bellowsWaterRadius], [1, bellowsWaterRadius], [1, 0]], openingAngles),
      waterMaterial,
    ), `${side}-water-volume-inside-lantern-bellows`);
    water.matrixAutoUpdate = false;
    group.add(water);
    return { group, rings, skins, water };
  };
  const leftBellows = makeBellows('left');
  const rightBellows = makeBellows('right');

  // Pass 70: Brown's flat valve chest and semicircular suction channel,
  // drawn as plane sections (extrusions through the depth), with four hinged
  // flap checks, a flared discharge riser and his hanging beam post.
  //   chest     outer x ±2.85, y -1.25..-0.11, z ±0.86 (walls 0.13)
  //   channel   circular arc about (0, -0.78): water between r 1.06 and 1.49
  //             below the chest floor, depth ±0.40, walls to r 0.93 / 1.66
  //   mouths    floor openings x ±(0.95..1.41), z ±0.40, under the suction flaps
  //   centre    partitions at x ±(0.50..0.60) with ports y -0.95..-0.45,
  //             z ±0.33, closed by the discharge flaps on their inner faces
  const chest = Object.freeze({
    halfWidth: 2.85, inner: 2.72, halfDepth: 0.86, innerDepth: 0.73,
    topLow: -0.25, topHigh: bellowsFloorY, floorLow: -1.25, floorHigh: -1.12,
    partitionInner: 0.50, partitionOuter: 0.60, portLow: -0.95, portHigh: -0.45, portDepth: 0.33,
    channelCenterY: -0.78, channelInner: 1.06, channelOuter: 1.49, channelWall: 0.17,
    domeInner: 0.93, channelDepth: 0.40, channelPlateDepth: 0.52,
    mouthInner: 0.95, mouthOuter: 1.41, bossHalfWidth: 0.30, bossLow: -2.46, bossHigh: -2.28,
    suctionInner: 0.20, suctionOuter: 0.28, suctionBottom: -2.95,
    riserInner: 0.25, riserOuter: 0.33, riserStraightTop: 1.90,
  });
  const rect = (x0, y0, x1, y1) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const belowFloor = rect(-3, -4, 3, chest.floorLow);
  const ringAbout = (inner, outer) => polygonClipping.difference(
    poly(circle([0, chest.channelCenterY], outer, 256)),
    poly(circle([0, chest.channelCenterY], inner, 256)));
  const plumbingMaterial = frameMaterial;

  const valveChest = addRole(new THREE.Mesh(mergePassageParts([
    plate(polygonClipping.union(rect(-chest.halfWidth, chest.floorHigh, -chest.inner, chest.topLow),
      rect(chest.inner, chest.floorHigh, chest.halfWidth, chest.topLow)), -chest.halfDepth, chest.halfDepth),
    ...[-1, 1].map(side => new THREE.BoxGeometry(2 * chest.inner, chest.topLow - chest.floorHigh, chest.halfDepth - chest.innerDepth)
      .translate(0, (chest.floorHigh + chest.topLow) / 2, side * (chest.innerDepth + chest.halfDepth) / 2)),
    horizontalPlate(polygonClipping.difference(
      rect(-chest.halfWidth, -chest.halfDepth, chest.halfWidth, chest.halfDepth),
      poly(circle([bellowsCenterXs.left, 0], 0.45, 128)),
      poly(circle([bellowsCenterXs.right, 0], 0.45, 128)),
      poly(circle([0, 0], chest.partitionInner, 128))), chest.topLow, chest.topHigh),
  ]), plumbingMaterial), 'fixed-common-valve-chest-beneath-both-bellows');
  root.add(valveChest);
  const chestBottom = addRole(new THREE.Mesh(horizontalPlate(polygonClipping.difference(
    rect(-chest.halfWidth, -chest.halfDepth, chest.halfWidth, chest.halfDepth),
    rect(-chest.mouthOuter, -chest.channelDepth, -chest.mouthInner, chest.channelDepth),
    rect(chest.mouthInner, -chest.channelDepth, chest.mouthOuter, chest.channelDepth)),
  chest.floorLow, chest.floorHigh), plumbingMaterial), 'fixed-valve-chest-floor-with-channel-mouths');
  root.add(chestBottom);
  const partitionParts = (side) => {
    const x = side * (chest.partitionInner + chest.partitionOuter) / 2, w = chest.partitionOuter - chest.partitionInner;
    const box = (y0, y1, z0, z1) => new THREE.BoxGeometry(w, y1 - y0, z1 - z0).translate(x, (y0 + y1) / 2, (z0 + z1) / 2);
    return [box(chest.portHigh, chest.topLow, -chest.innerDepth, chest.innerDepth),
      box(chest.floorHigh, chest.portLow, -chest.innerDepth, chest.innerDepth),
      box(chest.portLow, chest.portHigh, chest.portDepth, chest.innerDepth),
      box(chest.portLow, chest.portHigh, -chest.innerDepth, -chest.portDepth)];
  };
  const chestPartitions = addRole(new THREE.Mesh(mergePassageParts([...partitionParts(-1), ...partitionParts(1)]), plumbingMaterial),
    'fixed-ported-partitions-round-central-discharge-chamber');
  root.add(chestPartitions);

  const channelSection = polygonClipping.union(
    polygonClipping.difference(polygonClipping.intersection(ringAbout(chest.channelOuter, chest.channelOuter + chest.channelWall), belowFloor),
      rect(-chest.bossHalfWidth, -4, chest.bossHalfWidth, -2.0)),
    polygonClipping.intersection(ringAbout(chest.domeInner, chest.channelInner), belowFloor));
  const channelCover = polygonClipping.intersection(poly(circle([0, chest.channelCenterY], chest.channelOuter + chest.channelWall, 256)), belowFloor);
  const suctionChannel = addRole(new THREE.Mesh(mergePassageParts([
    plate(channelSection, -chest.channelDepth, chest.channelDepth),
    plate(channelCover, chest.channelDepth, chest.channelPlateDepth),
    plate(channelCover, -chest.channelPlateDepth, -chest.channelDepth),
    horizontalPlate(polygonClipping.difference(rect(-chest.bossHalfWidth, -chest.channelPlateDepth, chest.bossHalfWidth, chest.channelPlateDepth),
      poly(circle([0, 0], chest.suctionInner, 96))), chest.bossLow, chest.bossHigh),
  ]), plumbingMaterial), 'fixed-semicircular-suction-channel-under-chest');
  root.add(suctionChannel);
  const suctionPipe = addRole(new THREE.Mesh(solidRing(chest.suctionInner, chest.suctionOuter, chest.suctionBottom, chest.bossLow),
    plumbingMaterial), 'common-suction-pipe-below-valve-chest');
  root.add(suctionPipe);

  // The riser flares into the chest top over the central chamber, rises,
  // leans right as Brown draws it, then turns back through the post and
  // rises behind it out of the plate.
  const flare = (centerR, semiR) => Array.from({length: 17}, (_, i) => {
    const t = Math.PI / 2 * i / 16;
    return [0.30 - 0.41 * Math.cos(t), centerR - semiR * Math.sin(t)];
  });
  const riserProfile = [...flare(chest.partitionInner, chest.partitionInner - chest.riserInner),
    [chest.riserStraightTop + 0.01, chest.riserInner], [chest.riserStraightTop + 0.01, chest.riserOuter],
    ...flare(0.62, 0.62 - chest.riserOuter).reverse()];
  riserProfile[0][0] = chest.topHigh;riserProfile.at(-1)[0] = chest.topHigh;
  const riserBend = new THREE.CurvePath();
  riserBend.add(new THREE.CubicBezierCurve3(new THREE.Vector3(0, chest.riserStraightTop, 0), new THREE.Vector3(0, 2.30, 0),
    new THREE.Vector3(0.22, 2.45, 0), new THREE.Vector3(0.22, 2.45, -0.45)));
  riserBend.add(new THREE.LineCurve3(new THREE.Vector3(0.22, 2.45, -0.45), new THREE.Vector3(0.22, 2.45, -0.90)));
  // Behind the post it turns up again and rises out of the plate.
  class RiserElbow extends THREE.Curve {
    getPoint(t, target = new THREE.Vector3()) {
      const a = Math.PI / 2 * t;
      return target.set(0.22, 2.80 - 0.35 * Math.cos(a), -0.90 - 0.35 * Math.sin(a));
    }
  }
  riserBend.add(new RiserElbow());
  riserBend.add(new THREE.LineCurve3(new THREE.Vector3(0.22, 2.80, -1.25), new THREE.Vector3(0.22, 4.55, -1.25)));
  const dischargeShell = addRole(new THREE.Mesh(mergePassageParts([
    horizontalTurned(riserProfile.slice().reverse()), curvedPipeWall(riserBend, chest.riserInner, chest.riserOuter, 160, 40)]), plumbingMaterial),
  'common-upright-discharge-pipe-behind-rocking-beam');
  dischargeShell.userData.curve = riserBend;
  root.add(dischargeShell);

  // Brown's post hangs from above the plate and carries the beam fulcrum;
  // the riser passes through a bore in it.
  const standard = addRole(new THREE.Mesh(plate(polygonClipping.difference(rect(-0.47, 1.86, 0.47, 4.60),
    poly(circle([0.22, 2.45], chest.riserOuter + 0.005, 96))), -0.80, -0.50), frameMaterial),
  'fixed-hanging-post-carrying-rocking-beam-pivot');
  root.add(standard);

  // Water: one body from the suction pipe through the channel and mouths to
  // the chest, its three chambers, ports and bellows openings, and one body
  // up the riser. It is all primed and incompressible.
  // Pass 88: every water surface stands `waterGap` (about 7e-4 of the model
  // diagonal) off the walls, floor, partitions and top it lies against, so
  // no water face is coplanar with a solid one, and the pieces are built as
  // open surfaces that continue one another (suction water -> chest stack ->
  // bellows and riser), so no internal water sheet is drawn.
  const waterGap = 0.008;
  const channelWater = polygonClipping.union(
    polygonClipping.intersection(ringAbout(chest.channelInner + waterGap, chest.channelOuter - waterGap), belowFloor),
    rect(-chest.bossHalfWidth + waterGap, chest.bossHigh + waterGap, chest.bossHalfWidth - waterGap, -2.15));
  // The channel water's top edges at the floor are the mouths the chest
  // water rises from.
  const mouthXs = [];
  for (const [outer] of channelWater) for (const [x, y] of outer) if (Math.abs(y - chest.floorLow) < 1e-9 && x > 0) mouthXs.push(Math.fround(x));
  const mouthX = [Math.min(...mouthXs), Math.max(...mouthXs)];
  const waterDepth = chest.channelDepth - waterGap;
  const suctionRadius = chest.suctionInner - waterGap;
  const suctionAngles = Array.from({length: 64}, (_, i) => 2 * Math.PI * i / 64);
  let channelGeometry = plate(channelWater, -waterDepth, waterDepth);
  channelGeometry = withoutPlaneFaces(channelGeometry, 'y', Math.fround(chest.floorLow), 1);
  channelGeometry = withoutPlaneFaces(channelGeometry, 'y', Math.fround(chest.bossHigh + waterGap), -1);
  const suctionWater = addRole(new THREE.Mesh(mergePassageParts([
    latheAtAngles([[chest.suctionBottom, 0], [chest.suctionBottom, suctionRadius], [chest.bossHigh + waterGap, suctionRadius]], suctionAngles),
    channelGeometry,
    stackedFluidGeometry([], {caps: [{region: polygonClipping.difference(
      rect(-chest.bossHalfWidth + waterGap, -waterDepth, chest.bossHalfWidth - waterGap, waterDepth),
      poly(suctionAngles.map((a) => [suctionRadius * Math.cos(a), suctionRadius * Math.sin(a)]))), y: chest.bossHigh + waterGap, up: false}]}),
  ]), waterMaterial), 'water-in-common-suction-channel-and-inlet');

  // The riser water is a surface of revolution meeting its tube ring for
  // ring, and both stand open into the chest water below.
  const riserTube = new THREE.TubeGeometry(riserBend, 160, chest.riserInner - 0.005, 64, false);
  const riserAngles = Array.from({length: 64}, (_, j) => {
    const p = riserTube.attributes.position;
    return Math.atan2(p.getZ(j), p.getX(j));
  });
  const riserFoot = chest.partitionInner - 1.5 * waterGap;
  const riserWaterProfile = [[chest.topLow - waterGap, riserFoot], [chest.topHigh, riserFoot],
    ...flare(chest.partitionInner, chest.partitionInner - chest.riserInner).slice(1).map(([y, r]) => [y, r - 0.005]),
    [chest.riserStraightTop, chest.riserInner - 0.005]];
  const riserOpening = poly(riserAngles.map((a) => [riserFoot * Math.cos(a), riserFoot * Math.sin(a)]));
  const dischargeWater = addRole(new THREE.Mesh(mergePassageParts([latheAtAngles(riserWaterProfile, riserAngles), riserTube]), waterMaterial),
    'water-in-common-discharge-riser');

  // The chest water: a stack of plan layers from the mouths up to the
  // bellows openings, the ports bridging the partitions in the middle one.
  const bellowsOpeningRadius = 0.45 - waterGap;
  const bellowsOpeningAngles = Array.from({length: 128}, (_, i) => 2 * Math.PI * i / 128);
  const bellowsOpenings = polygonClipping.union(...[bellowsCenterXs.left, bellowsCenterXs.right].map((x) =>
    poly(bellowsOpeningAngles.map((a) => [x + bellowsOpeningRadius * Math.cos(a), bellowsOpeningRadius * Math.sin(a)]))));
  const partitionStrips = [-1, 1].map((side) => side > 0
    ? rect(chest.partitionInner - waterGap, -1, chest.partitionOuter + waterGap, 1)
    : rect(-chest.partitionOuter - waterGap, -1, -chest.partitionInner + waterGap, 1));
  const chamberPlan = polygonClipping.difference(
    rect(-chest.inner + waterGap, -chest.innerDepth + waterGap, chest.inner - waterGap, chest.innerDepth - waterGap), ...partitionStrips);
  const portPlan = polygonClipping.union(chamberPlan, ...[-1, 1].map((side) => polygonClipping.intersection(partitionStrips[(side + 1) / 2],
    rect(-3, -chest.portDepth + waterGap, 3, chest.portDepth - waterGap))));
  const mouthPlan = polygonClipping.union(rect(mouthX[0], -waterDepth, mouthX[1], waterDepth), rect(-mouthX[1], -waterDepth, -mouthX[0], waterDepth));
  const chestWater = addRole(new THREE.Mesh(stackedFluidGeometry([
    {region: mouthPlan, y0: chest.floorLow, y1: chest.floorHigh + waterGap},
    {region: chamberPlan, y0: chest.floorHigh + waterGap, y1: chest.portLow + waterGap},
    {region: portPlan, y0: chest.portLow + waterGap, y1: chest.portHigh - waterGap},
    {region: chamberPlan, y0: chest.portHigh - waterGap, y1: chest.topLow - waterGap, open: riserOpening},
    {region: bellowsOpenings, y0: chest.topLow - waterGap, y1: bellowsFloorY + 0.05},
  ], {openBottom: mouthPlan, openTop: bellowsOpenings}), waterMaterial), 'water-filling-valve-chest-chambers');
  root.add(suctionWater, chestWater, dischargeWater);
  const commonSuction = {shell: suctionPipe, water: suctionWater};
  const commonDischarge = {shell: dischargeShell, water: dischargeWater};

  // Four flap checks, each a plate extruded through the depth with a bored
  // hinge boss on a fixed pin carried by two journals. Suction flaps lie on
  // the floor over the channel mouths, hinged at their outer ends; discharge
  // flaps hang on the inner faces of the partitions, hinged at the top.
  const flapShape = (body, arm, boss = 0.04, bore = 0.018) => polygonClipping.difference(
    polygonClipping.union(body, arm, poly(circle([0, 0], boss, 64))), poly(circle([0, 0], bore, 48)));
  const makeFlap = ({pivot, shape, halfDepth, journalDepth, journal, material, role, sign}) => {
    const valve = addRole(new THREE.Group(), role);
    valve.position.copy(pivot);
    const flap = new THREE.Mesh(plate(shape, -halfDepth, halfDepth), material);
    flap.userData.role = `${role}-flap`;
    valve.add(flap);
    // Pass 88: the pin ends stand 0.006 inside the journals' outer faces.
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2 * journalDepth[1] - 0.012, 24).rotateX(Math.PI / 2), darkMaterial);
    pin.userData.role = `${role}-fixed-hinge-pin`;pin.position.copy(pivot);
    const journals = new THREE.Mesh(mergePassageParts([-1, 1].map(s => new THREE.BoxGeometry(...journal.size)
      .translate(journal.offset[0], journal.offset[1], s * (journalDepth[0] + journalDepth[1]) / 2))), plumbingMaterial);
    journals.userData.role = `${role}-fixed-hinge-journals`;journals.position.copy(pivot);
    root.add(valve, pin, journals);
    valve.userData.disk = flap;valve.userData.sign = sign;valve.userData.pin = pin;valve.userData.journals = journals;
    return valve;
  };
  const suctionFlap = (side) => makeFlap({
    pivot: new THREE.Vector3(side * 1.51, chest.floorHigh + 0.05, 0),
    shape: flapShape(rect(side > 0 ? -0.61 : 0.05, -0.05, side > 0 ? -0.05 : 0.61, 0), rect(side > 0 ? -0.05 : 0, -0.05, side > 0 ? 0 : 0.05, 0)),
    halfDepth: 0.45, journalDepth: [0.47, 0.53], journal: {size: [0.12, 0.09, 0.06], offset: [0, -0.005]},
    material: suctionValveMaterial, sign: side > 0 ? -1 : 1,
    role: `${side < 0 ? 'left' : 'right'}-suction-check-opening-only-while-${side < 0 ? 'left' : 'right'}-bellows-expands`,
  });
  const deliveryFlap = (side) => makeFlap({
    pivot: new THREE.Vector3(side * 0.43, -0.37, 0),
    shape: flapShape(rect(side > 0 ? 0.02 : -0.07, -0.63, side > 0 ? 0.07 : -0.02, 0), rect(side > 0 ? 0 : -0.07, -0.04, side > 0 ? 0.07 : 0, 0)),
    halfDepth: 0.38, journalDepth: [0.39, 0.45], journal: {size: [0.10, 0.08, 0.06], offset: [side * 0.02, 0]},
    material: deliveryValveMaterial, sign: side > 0 ? -1 : 1,
    role: `${side < 0 ? 'left' : 'right'}-delivery-check-opening-only-while-${side < 0 ? 'left' : 'right'}-bellows-compresses`,
  });
  const leftSuctionValve = suctionFlap(-1), rightSuctionValve = suctionFlap(1);
  const leftDeliveryValve = deliveryFlap(-1), rightDeliveryValve = deliveryFlap(1);

  const updateBellows = (bellows, fixedX, topCenter, topY) => {
    const bottom = new THREE.Vector3(fixedX, bellowsFloorY, 0);
    const top = new THREE.Vector3(topCenter.x, topY, 0);
    const ringPoints = bellows.rings.map((ring, index) => {
      const fraction = index / (bellows.rings.length - 1);
      const point = bottom.clone().lerp(top, fraction);
      ring.position.copy(point);
      return point;
    });
    bellows.skins.forEach((skin, index) => {
      setCylinderBetween(skin, ringPoints[index], ringPoints[index + 1]);
    });
    const waterBottom = bottom.clone();
    waterBottom.y += 0.05;
    const waterTop = top.clone();
    waterTop.y -= 0.05;
    const shear = waterTop.clone().sub(waterBottom);
    bellows.water.matrix.set(1, shear.x, 0, waterBottom.x, 0, shear.y, 0, waterBottom.y, 0, shear.z, 1, waterBottom.z, 0, 0, 0, 1);
    bellows.water.matrixWorldNeedsUpdate = true;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    beam.rotation.z = state.beamAngle;
    leftTopPlate.position.copy(state.leftTopPlateCenter);
    rightTopPlate.position.copy(state.rightTopPlateCenter);
    setCylinderBetween(
      leftConnectingRod,
      state.leftTopPlateCenter.clone().add(new THREE.Vector3(0,linkEyeHeight,0)),
      state.leftBeamPin,
    );
    setCylinderBetween(
      rightConnectingRod,
      state.rightTopPlateCenter.clone().add(new THREE.Vector3(0,linkEyeHeight,0)),
      state.rightBeamPin,
    );
    updateBellows(
      leftBellows,
      bellowsCenterXs.left,
      state.leftTopPlateCenter,
      state.leftBellowsTopY,
    );
    updateBellows(
      rightBellows,
      bellowsCenterXs.right,
      state.rightTopPlateCenter,
      state.rightBellowsTopY,
    );
    for (const [valve, open] of [[leftSuctionValve, state.leftSuctionValveOpen],
      [rightSuctionValve, state.rightSuctionValveOpen], [leftDeliveryValve, state.leftDeliveryValveOpen],
      [rightDeliveryValve, state.rightDeliveryValveOpen]]) valve.rotation.z = valve.userData.sign * maximumFlapAngle * open;
    root.userData.updateSolids?.(state);
  };

  const sourceState = stateAtInputAngle(0);
  const geometry = {
    beamAmplitude,
    beamPinHalfSpan,
    beamPivot,
    bellowsCenterXs,
    bellowsEffectiveArea,
    bellowsFloorY,
    bellowsWaterRadius,
    connectingRodLength,
    linkEyeHeight,
    cycleDuration,
    groundY,
    inputAngularSpeed,
    maximumFlapAngle,
    maximumValveLift,
    chest,
    topPlateHalfThickness,
    valveSeats,
  };
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'double-lantern-bellows-pump-with-common-rocking-lever-opposed-strokes-four-checks-and-shared-suction-discharge',
    blocks: {
      base,
      chestBottom,
      chestPartitions,
      chestWater,
      suctionChannel,
      beam,
      commonDischarge,
      commonSuction,
      leftBellows,
      leftConnectingRod,
      leftDeliveryValve,
      leftSuctionValve,
      leftTopPlate,
      pivotAxle,
      rightBellows,
      rightConnectingRod,
      rightDeliveryValve,
      rightSuctionValve,
      rightTopPlate,
      standard,
      valveChest,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      leftBellowsIndependent: false,
      leftDeliveryCheckIndependent: false,
      leftSuctionCheckIndependent: false,
      operatingDegreesOfFreedom: 1,
      rightBellowsIndependent: false,
      rightDeliveryCheckIndependent: false,
      rightSuctionCheckIndependent: false,
    },
    dynamics: {
      fullAirRarefactionWaterPressureValveImpactLeakageBellowsElasticityAndLeverForceModeled:
        false,
      checkValveModel:
        'Four hinged flap checks, as Brown draws them, swing through disjoint C2 cubic stroke lobes. Each suction flap lies on the chest floor over a mouth of the semicircular suction channel and opens only while its bellows expands; each discharge flap hangs on a partition of the central discharge chamber and opens only while its bellows compresses; every flap is seated at reversal.',
      flowModel:
        'Both primed bellows use the same effective area. The central beam gives exactly opposite vertical plate velocities, so at every moving instant the expanding side suction flow exactly equals the compressing side delivery flow. Pressure losses, leakage, trapped air and pipe compliance are omitted.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'One centrally pivoted hand lever carries equal-radius pins on opposite sides. Equal vertical rods hold the two lantern-bellows top plates at opposite heights: as one pleated chamber distends and fills through its own suction check, the other compresses and expels through its own delivery check. The two inlet branches share one suction pipe, the two outlet branches share one upright discharge pipe, and all four checks seat together at each reversal.',
    motion: {
      cycleDuration,
      inputAngularSpeed,
      motionType:
        'single-rocking-beam-with-opposed-lantern-bellows-expansion-and-compression',
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 453 page supplies Brown\'s static engraving and caption; its Animated control is unavailable and the page contains no Canvas mechanism or timing.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      beamAngle: sourceState.beamAngle,
      leftBellowsHeight: sourceState.leftBellowsHeight,
      leftDeliveryValveOpen: sourceState.leftDeliveryValveOpen,
      leftSuctionValveOpen: sourceState.leftSuctionValveOpen,
      mode: sourceState.mode,
      rightBellowsHeight: sourceState.rightBellowsHeight,
      rightDeliveryValveOpen: sourceState.rightDeliveryValveOpen,
      rightSuctionValveOpen: sourceState.rightSuctionValveOpen,
    },
    sourceReference: {
      brownPlate453: {
        approximateBeamPivotPixels: [239, 117],
        approximateCommonDischargePixels: [252, 82],
        approximateCommonSuctionPixels: [253, 468],
        approximateLeftBellowsCenterPixels: [137, 270],
        approximateRightBellowsCenterPixels: [352, 298],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 18,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the machine is a double lantern-bellows pump',
          'one common lever distends one bellows while compressing the other',
          'distension rarefies the enclosed air and admits water through the suction pipe',
          'simultaneous compression expels the other bellows contents through the discharge pipe',
          'the valves work as in the ordinary force pump',
        ],
        engravingEvidence:
          'Brown’s section shows one centrally pivoted beam with a vertical rod to each bellows top, a tall distended left bellows, a short compressed right bellows, a flat valve chest divided round a central discharge chamber, a semicircular suction channel under it with the suction pipe at its foot, four flap valves, a flared central discharge pipe and the post carrying the beam, broken off above.',
        reconstructionDisclosure:
          'Brown gives no bellows diameter, stroke, pleat count, rod length, valve lift, exact flap geometry, water pressure, leakage, elasticity, applied force or timing. Those dimensions, flap proportions and hinge journals, the riser turning back through the post above Brown’s break, the cutaway, colors and 5.4-second harmonic beam cycle are independently engineered. The single beam, opposed bellows states, two checks per chamber, common suction and common discharge are source-grounded.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 453',
    },
    stateAtInputAngle,
    stateAtTime,
    transmission: {
      chamberBalance:
        'For each bellows dV/dt=Q_suction-Q_delivery exactly; because v_right=-v_left, total suction equals total delivery at every instant.',
      leverConstraint:
        'The two beam pins lie at equal opposite radii and both connecting rods remain vertical with constant length, making the two top-plate vertical displacements exactly equal and opposite.',
      valveSequence:
        'sin(phi)>0 opens left delivery plus right suction; sin(phi)<0 opens left suction plus right delivery; sin(phi)=0 seats all four checks.',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.65, groundY, -1.65),
    new THREE.Vector3(3.90, 4.60, 1.55),
  );
  root.userData.cameraDistanceScale = 1.06;
  root.userData.cameraDirection = new THREE.Vector3(6.8, 4.8, 10.8);
  root.userData.groundFloorY = groundY;
  correctFlexiblePumpParts(root,453);
  markShadows(root);
  base.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredLanternBellowsPumpMovement(movement) {
  if (movement.id !== 453) return null;
  return applyCutawayFor(doubleLanternBellowsPump(movement), movement.id);
}
