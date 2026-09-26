import * as THREE from 'three';
import {
  PALETTE,
  makeDynamicCable,
  markShadows,
  matte,
} from './primitives.js';

import {fitPistonGuide} from './piston-guide-parts.js';
import {makeBoredLinkRod} from './bored-link-rod.js';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function centeredExtrusion(shape, depth, bevel = 0.018) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevel > 0,
    bevelSegments: 2,
    bevelSize: bevel,
    bevelThickness: bevel,
    curveSegments: 2,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function polygonMesh(points, depth, material, role, bevel = 0.018) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length; index += 1) {
    shape.lineTo(points[index][0], points[index][1]);
  }
  shape.closePath();
  return addRole(new THREE.Mesh(
    centeredExtrusion(shape, depth, bevel),
    material,
  ), role);
}

function cylinderAlongZ(radius, length, material, role, sides = 24) {
  const cylinder = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, sides),
    material,
  ), role);
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function cylinderBetween(start, end, radius, material, role, sides = 16) {
  const direction = end.clone().sub(start);
  const cylinder = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), sides),
    material,
  ), role);
  cylinder.position.copy(start).add(end).multiplyScalar(0.5);
  cylinder.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  return cylinder;
}

function stoneLewis(movement) {
  const root = new THREE.Group();

  // The authored source animation runs at 15 cycles/minute. Its drawing uses
  // the coordinates below and simple linear interpolation at the six phase
  // landmarks. Keeping the values in source units makes every contact and
  // stage transition independently testable before scaling into the scene.
  const officialCyclesPerMinute = 15;
  const cycleDuration = 60 / officialCyclesPerMinute;
  const sourceScale = 0.72;
  const sourceVerticalOriginScene = -1.72;
  const sourcePhaseLandmarks = [0, 0.138, 0.4, 0.5, 0.762, 0.9, 1];
  const centerPinStartY = 5.470583;
  const centerPinStroke = 2;
  const centralWedgeTopY = -0.91225;
  const centralWedgeBottomY = -4.13725;
  const centralWedgeTopHalfWidth = 0.25;
  const centralWedgeBottomHalfWidth = 0.472414;
  const packingAnchorStartX = 0.702414;
  const packingAnchorContactX = 0.75;
  const packingMaximumSpread =
    packingAnchorContactX - packingAnchorStartX;
  const packingAnchorStartY = 4.1;
  const packingBottomY = -2.766667;
  const packingInnerBottomOffset = 0.23;
  const packingInnerTopOffset = 0.420805;
  const boreHalfWidth = 0.75;
  const boreBottomY = 1.333333;
  const boreTopY = 4;
  const stoneLiftStroke = 1.31;
  const lockingPhase = 0.138;
  const fullyRaisedPhase = 0.4;
  const loweringStartPhase = 0.5;
  const stoneHomePhase = 0.762;
  const releasedPhase = 0.9;
  const lockStroke = centerPinStroke * lockingPhase / fullyRaisedPhase;
  const kinematicWedgeSlope = packingMaximumSpread / lockStroke;
  const sourceCentralTaperSlope =
    (centralWedgeBottomHalfWidth - centralWedgeTopHalfWidth)
      / (centralWedgeTopY - centralWedgeBottomY);
  const sourcePackingTaperSlope =
    (packingInnerTopOffset - packingInnerBottomOffset)
      / -packingBottomY;

  const centralLiftAtPhase = (phase) => {
    if (phase < fullyRaisedPhase) {
      return centerPinStroke * phase / fullyRaisedPhase;
    }
    if (phase <= loweringStartPhase) return centerPinStroke;
    if (phase < releasedPhase) {
      return centerPinStroke
        * (releasedPhase - phase)
        / (releasedPhase - loweringStartPhase);
    }
    return 0;
  };

  const stoneLiftAtPhase = (phase) => {
    if (phase <= lockingPhase) return 0;
    if (phase < fullyRaisedPhase) {
      return stoneLiftStroke
        * (phase - lockingPhase)
        / (fullyRaisedPhase - lockingPhase);
    }
    if (phase <= loweringStartPhase) return stoneLiftStroke;
    if (phase < stoneHomePhase) {
      return stoneLiftStroke
        * (stoneHomePhase - phase)
        / (stoneHomePhase - loweringStartPhase);
    }
    return 0;
  };

  const packingSpreadAtPhase = (phase) => {
    if (phase < lockingPhase) {
      return packingMaximumSpread * phase / lockingPhase;
    }
    if (phase <= stoneHomePhase) return packingMaximumSpread;
    if (phase < releasedPhase) {
      return packingMaximumSpread
        * (releasedPhase - phase)
        / (releasedPhase - stoneHomePhase);
    }
    return 0;
  };

  const centralVelocityAtPhase = (phase) => {
    if (phase < fullyRaisedPhase) {
      return centerPinStroke / fullyRaisedPhase / cycleDuration;
    }
    if (phase < loweringStartPhase) return 0;
    if (phase < releasedPhase) {
      return -centerPinStroke
        / (releasedPhase - loweringStartPhase)
        / cycleDuration;
    }
    return 0;
  };

  const stoneVelocityAtPhase = (phase) => {
    if (phase > lockingPhase && phase < fullyRaisedPhase) {
      return stoneLiftStroke
        / (fullyRaisedPhase - lockingPhase)
        / cycleDuration;
    }
    if (phase > loweringStartPhase && phase < stoneHomePhase) {
      return -stoneLiftStroke
        / (stoneHomePhase - loweringStartPhase)
        / cycleDuration;
    }
    return 0;
  };

  const packingSpreadVelocityAtPhase = (phase) => {
    if (phase < lockingPhase) {
      return packingMaximumSpread / lockingPhase / cycleDuration;
    }
    if (phase > stoneHomePhase && phase < releasedPhase) {
      return -packingMaximumSpread
        / (releasedPhase - stoneHomePhase)
        / cycleDuration;
    }
    return 0;
  };

  const centralHalfWidthAtLocalY = (localY) =>
    centralWedgeTopHalfWidth
      + sourceCentralTaperSlope * (centralWedgeTopY - localY);

  const rightPackingInnerXAtLocalY = (
    localY,
    anchorX = packingAnchorStartX,
  ) => {
    const fromBottom = (localY - packingBottomY) / -packingBottomY;
    const inwardOffset = THREE.MathUtils.lerp(
      packingInnerBottomOffset,
      packingInnerTopOffset,
      fromBottom,
    );
    return anchorX - inwardOffset;
  };

  // The hoist starts and stops smoothly. The source's poses are kept as a
  // function of a motion phase, and the hoisting and lowering runs are eased
  // at both ends (cosine speed ramps over motionEaseFraction of the cycle), so
  // there is no instant start after the lowered dwell at the loop point nor
  // instant stop at the raised dwell. Dwell landmarks keep their times.
  const motionEaseFraction = 0.06;
  const motionRuns = [[0, fullyRaisedPhase], [loweringStartPhase, releasedPhase]];
  const easedPhaseAt = (cyclePhase) => {
    for (const [start, end] of motionRuns) {
      if (cyclePhase < start || cyclePhase > end) continue;
      const length = end - start, r = motionEaseFraction, v = length / (length - r);
      const ramp = (w) => ({s: v * (w / 2 - r / (2 * Math.PI) * Math.sin(Math.PI * w / r)),
        rate: v * (1 - Math.cos(Math.PI * w / r)) / 2});
      const u = cyclePhase - start;
      if (u < r) { const a = ramp(u); return {phase: start + a.s, rate: a.rate}; }
      if (length - u < r) { const a = ramp(length - u); return {phase: end - a.s, rate: a.rate}; }
      return {phase: start + v * (u - r / 2), rate: v};
    }
    return {phase: cyclePhase, rate: 0};
  };
  const cyclePhaseAtPhase = (phase) => {
    let low = 0, high = 1;
    for (let i = 0; i < 64; i += 1) {
      const middle = (low + high) / 2;
      if (easedPhaseAt(middle).phase < phase) low = middle; else high = middle;
    }
    return high;
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const {phase, rate} = easedPhaseAt(cycleTime / cycleDuration);
    const centralLift = centralLiftAtPhase(phase);
    const stoneLift = stoneLiftAtPhase(phase);
    const packingSpread = packingSpreadAtPhase(phase);
    const packingAnchorX = packingAnchorStartX + packingSpread;
    const packingAnchorY = packingAnchorStartY + stoneLift;
    const centerPinAnchorY = centerPinStartY + centralLift;
    const relativeWedgeAdvance = centralLift - stoneLift;
    const kinematicPackingSpread =
      kinematicWedgeSlope * relativeWedgeAdvance;
    const wallClearance = boreHalfWidth - packingAnchorX;
    const packingsAgainstWall = Math.abs(wallClearance) <= 1e-12;
    return {
      centerPinAnchorY,
      centerPinVelocitySourceUnitPerSecond:
        centralVelocityAtPhase(phase) * rate,
      centralLift,
      cycleTime,
      kinematicPackingSpread,
      packingAnchorX,
      packingAnchorY,
      packingSpread,
      packingSpreadClosureError:
        packingSpread - kinematicPackingSpread,
      packingSpreadVelocitySourceUnitPerSecond:
        packingSpreadVelocityAtPhase(phase) * rate,
      packingsAgainstWall,
      phase,
      relativeWedgeAdvance,
      stoneLift,
      stoneSupportedByWedgedPackings: packingsAgainstWall,
      stoneVelocitySourceUnitPerSecond: stoneVelocityAtPhase(phase) * rate,
      wallClearance,
    };
  };

  const wedgeInterfaceAtState = (state, progress) => {
    const centerBottom = state.centerPinAnchorY + centralWedgeBottomY;
    const centerTop = state.centerPinAnchorY + centralWedgeTopY;
    const packingBottom = state.packingAnchorY + packingBottomY;
    const packingTop = state.packingAnchorY;
    const overlapBottom = Math.max(centerBottom, packingBottom);
    const overlapTop = Math.min(centerTop, packingTop);
    const sampleY = THREE.MathUtils.lerp(
      overlapBottom,
      overlapTop,
      THREE.MathUtils.clamp(progress, 0, 1),
    );
    const centralLocalY = sampleY - state.centerPinAnchorY;
    const packingLocalY = sampleY - state.packingAnchorY;
    const centralRightX = centralHalfWidthAtLocalY(centralLocalY);
    const packingRightX = rightPackingInnerXAtLocalY(
      packingLocalY,
      state.packingAnchorX,
    );
    return {
      centralLeftX: -centralRightX,
      centralRightX,
      leftClosureError: -packingRightX + centralRightX,
      overlapBottom,
      overlapTop,
      packingLeftX: -packingRightX,
      packingRightX,
      rightClosureError: packingRightX - centralRightX,
      sampleY,
    };
  };

  const stoneMaterial = matte(PALETTE.muted, {
    metalness: 0.02,
    roughness: 0.91,
  });
  const cutMaterial = matte(PALETTE.frame, {
    metalness: 0.01,
    roughness: 0.96,
  });
  const centerMaterial = matte(PALETTE.driver, {
    metalness: 0.31,
    roughness: 0.43,
  });
  const packingMaterial = matte(PALETTE.driven, {
    metalness: 0.30,
    roughness: 0.45,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.36,
    roughness: 0.38,
  });
  const contactMaterial = matte(PALETTE.white, {
    opacity: 0.98,
    roughness: 0.18,
    transparent: true,
  });
  contactMaterial.depthWrite = false;

  const scalePoints = (points) => points.map(([x, y]) => [
    x * sourceScale,
    y * sourceScale,
  ]);

  const stone = addRole(new THREE.Group(),
    'single-stone-translated-only-after-packing-contact');
  stone.position.y = sourceVerticalOriginScene;
  root.add(stone);
  // Brown's ragged outline is his break-line convention for a stone that
  // runs on; the model shows a whole squared block of the same extent, with
  // the lewis hole cut down from its top face.
  const sourceStoneOutline = [
    [0.75, 4],
    [3.5, 4],
    [3.5, 0],
    [-3.5, 0],
    [-3.5, 4],
    [-0.75, 4],
    [-0.75, 1.333333],
    [0.75, 1.333333],
  ];

  // The lewis hole is a blind pocket, not a slot through the block. Brown's
  // plate is a section through the hole; the stone's front face is that
  // section plane, so the pocket opens at the top and at the cut face only.
  // Behind the pocket the block is whole.
  const stoneFrontZ = 1.355;
  const stoneBackZ = -2.395;
  const pocketBackZ = 0.45;
  const stoneBody = polygonMesh(
    scalePoints(sourceStoneOutline),
    stoneFrontZ - pocketBackZ,
    stoneMaterial,
    'source-profiled-stone-with-open-front-sectional-bore',
    0,
  );
  stoneBody.position.z = (stoneFrontZ + pocketBackZ) / 2;
  stone.add(stoneBody);
  const stoneBehindPocket = polygonMesh(
    scalePoints(sourceStoneOutline.slice(0, -2)),
    pocketBackZ - stoneBackZ,
    stoneMaterial,
    'solid-stone-behind-the-blind-lewis-pocket',
    0,
  );
  stoneBehindPocket.position.z = (pocketBackZ + stoneBackZ) / 2;
  stone.add(stoneBehindPocket);
  const pocketDepth = stoneFrontZ - pocketBackZ;
  const pocketCenterZ = (stoneFrontZ + pocketBackZ) / 2;

  const boreBack = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(
      boreHalfWidth * 2 * sourceScale,
      (boreTopY - boreBottomY) * sourceScale,
      0.055,
    ),
    cutMaterial,
  ), 'dark-rear-wall-of-sectioned-lewis-bore');
  boreBack.position.set(
    0,
    (boreBottomY + boreTopY) * sourceScale / 2,
    pocketBackZ + 0.0275,
  );
  stone.add(boreBack);
  const boreBottom = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(
      boreHalfWidth * 2 * sourceScale,
      0.055,
      pocketDepth,
    ),
    cutMaterial,
  ), 'bottom-face-of-sectioned-lewis-bore');
  boreBottom.position.set(0, boreBottomY * sourceScale - .0275, pocketCenterZ);
  stone.add(boreBottom);
  const boreWalls = [-1, 1].map((side, index) => {
    const wall = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(
        0.045,
        (boreTopY - boreBottomY) * sourceScale,
        pocketDepth,
      ),
      cutMaterial,
    ), `vertical-bore-contact-wall-${index + 1}`);
    wall.position.set(
      side * (boreHalfWidth * sourceScale + .0225),
      (boreBottomY + boreTopY) * sourceScale / 2,
      pocketCenterZ,
    );
    stone.add(wall);
    return wall;
  });
  // The bore liners share faces with the stone's own hole and cut face;
  // in the stone's material those coincident faces cannot flicker into
  // dashed marks along the hole edges.
  for (const liner of [boreBottom, ...boreWalls]) liner.material = stoneMaterial;

  const makePacking = (side) => {
    const packing = addRole(new THREE.Group(),
      `${side < 0 ? 'left' : 'right'}-wedge-like-packing-piece`);
    const sourcePoints = side > 0
      ? [
        [-packingInnerBottomOffset, packingBottomY],
        [0, packingBottomY],
        [0, 0],
        [-packingInnerTopOffset, 0],
      ]
      : [
        [packingInnerBottomOffset, packingBottomY],
        [0, packingBottomY],
        [0, 0],
        [packingInnerTopOffset, 0],
      ];
    const body = polygonMesh(
      scalePoints(sourcePoints),
      0.68,
      packingMaterial,
      `${side < 0 ? 'left' : 'right'}-packing-taper-body`,
      0,
    );
    packing.add(body);
    const wallPad = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(
        0.038,
        -packingBottomY * sourceScale * 0.91,
        0.58,
      ),
      darkMaterial,
    ), `${side < 0 ? 'left' : 'right'}-packing-outer-contact-face`);
    wallPad.position.set(
      -side*.019,
      packingBottomY * sourceScale * 0.5,
      0,
    );
    packing.add(wallPad);
    const wallContactMarker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 18, 12),
      contactMaterial,
    ), `${side < 0 ? 'left' : 'right'}-wall-contact-index`);
    wallContactMarker.position.set(
      0,
      packingBottomY * sourceScale * 0.48,
      0.39,
    );
    packing.add(wallContactMarker);
    root.add(packing);
    return {
      body,
      packing,
      side,
      wallContactMarker,
      wallPad,
    };
  };

  const leftPacking = makePacking(-1);
  const rightPacking = makePacking(1);

  const centerPin = addRole(new THREE.Group(),
    'hoisted-central-taper-pin-and-shackle');
  centerPin.position.set(
    0,
    sourceVerticalOriginScene + centerPinStartY * sourceScale,
    0.93,
  );
  root.add(centerPin);
  const centerTaper = polygonMesh(scalePoints([
    [-centralWedgeBottomHalfWidth, centralWedgeBottomY],
    [centralWedgeBottomHalfWidth, centralWedgeBottomY],
    [centralWedgeTopHalfWidth, centralWedgeTopY],
    [-centralWedgeTopHalfWidth, centralWedgeTopY],
  ]), 0.72, centerMaterial, 'central-broad-bottom-taper-wedge', 0);
  centerPin.add(centerTaper);
  const centerHead = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(
      0.50 * sourceScale,
      0.60 * sourceScale,
      0.76,
    ),
    centerMaterial,
  ), 'central-wedge-upper-shackle-block');
  centerHead.position.y = -0.61225 * sourceScale;
  centerHead.geometry.dispose();
  centerHead.geometry=plate(clip.difference(poly([[-.25*sourceScale,-.30*sourceScale],[.25*sourceScale,-.30*sourceScale],[.25*sourceScale,.30*sourceScale],[-.25*sourceScale,.30*sourceScale]]),poly(circle([0,(.61225-.49)*sourceScale],.089,64))),-.38,.38);
  centerPin.add(centerHead);
  const shackleRing = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(
      .44,
      0.105 * sourceScale,
      12,
      48,
      Math.PI,
    ),
    centerMaterial,
  ), 'lifting-shackle-carried-by-central-wedge');
  shackleRing.position.y = 0.34 * sourceScale;
  shackleRing.rotation.y=Math.PI/2;
  centerPin.add(shackleRing);
  const shackleArms = [-1, 1].map((side, index) => {
    const {rod:arm}=makeBoredLinkRod({bodyMaterial:centerMaterial,depth:.10,length:(.34+.49)*sourceScale,planeZ:side*.44,role:`shackle-side-arm-${index+1}`,width:.14,startBoreRadius:.089,boreRadius:.04});
    arm.position.y=-.49*sourceScale;
    arm.rotation.z=Math.PI/2;
    centerPin.add(arm);
    return arm;
  });
  const shacklePin = cylinderAlongZ(
    0.085,
    1.06,
    darkMaterial,
    'transverse-pin-through-central-wedge-shackle',
    24,
  );
  shacklePin.position.y = -0.49 * sourceScale;
  centerPin.add(shacklePin);
  const shacklePinEnds = [-1, 1].map((side, index) => {
    const end = cylinderAlongZ(
      0.13,
      0.085,
      centerMaterial,
      `shackle-pin-retainer-${index + 1}`,
      22,
    );
    end.position.set(0, -0.49 * sourceScale, side * 0.57);
    centerPin.add(end);
    return end;
  });

  // Brown shows the shackle face-on, its bow ring open to the viewer and the
  // pin crossing the picture; turn the head block, bow, arms and pin a
  // quarter turn about the wedge axis together so their bores still align.
  {
    const quarter = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.PI / 2,
    );
    for (const part of [centerHead, shackleRing, ...shackleArms, shacklePin,
      ...shacklePinEnds]) {
      part.position.applyQuaternion(quarter);
      part.quaternion.premultiply(quarter);
    }
  }

  const contactMarkerLocalY = -2.30;
  const contactMarkerHalfWidth =
    centralHalfWidthAtLocalY(contactMarkerLocalY);
  const wedgeContactMarkers = [-1, 1].map((side, index) => {
    const marker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.058, 18, 12),
      contactMaterial,
    ), `central-to-packing-contact-index-${index + 1}`);
    marker.position.set(
      side * contactMarkerHalfWidth * sourceScale,
      contactMarkerLocalY * sourceScale,
      0.41,
    );
    centerPin.add(marker);
    return marker;
  });

  const fixedHoistPoint = new THREE.Vector3(0, 5.05, 0.93);
  const shackleRopePointLocalY =
    .34*sourceScale+.44+.105*sourceScale;
  // Brown draws the hoist rope laid (twisted): the shared laid rope.
  const hoistRope = addRole(makeDynamicCable({
    color: PALETTE.belt,
    laid: true,
    maxSegments: 18,
    radius: 0.052,
  }), 'single-hoist-rope-pulling-only-the-central-wedge');
  hoistRope.userData.isBelt = false;
  hoistRope.userData.isHoistRope = true;
  root.add(hoistRope);
  const hoistGuide = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(0.20, 0.065, 10, 38),
    darkMaterial,
  ), 'fixed-overhead-hoist-eye');
  hoistGuide.position.copy(fixedHoistPoint);
  root.add(hoistGuide);

  const upwardIndex = addRole(new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.36, 20),
    contactMaterial,
  ), 'white-index-of-upward-hoist-direction');
  upwardIndex.position.set(0.50, 4.62, 0.95);
  root.add(upwardIndex);
  const upwardIndexShaft = cylinderBetween(
    new THREE.Vector3(0.50, 4.22, 0.95),
    new THREE.Vector3(0.50, 4.52, 0.95),
    0.026,
    contactMaterial,
    'white-upward-hoist-index-shaft',
    12,
  );
  root.add(upwardIndexShaft);

  const update = (time) => {
    const state = stateAtTime(time);
    stone.position.y = sourceVerticalOriginScene
      + state.stoneLift * sourceScale;
    centerPin.position.y = sourceVerticalOriginScene
      + state.centerPinAnchorY * sourceScale;
    leftPacking.packing.position.set(
      -state.packingAnchorX * sourceScale,
      sourceVerticalOriginScene + state.packingAnchorY * sourceScale,
      0.93,
    );
    rightPacking.packing.position.set(
      state.packingAnchorX * sourceScale,
      sourceVerticalOriginScene + state.packingAnchorY * sourceScale,
      0.93,
    );
    leftPacking.wallContactMarker.visible = state.packingsAgainstWall;
    rightPacking.wallContactMarker.visible = state.packingsAgainstWall;
    const movingRopePoint = new THREE.Vector3(
      0,
      centerPin.position.y + shackleRopePointLocalY,
      centerPin.position.z,
    );
    // The lay is fixed to the shackle end, which rises with the wedge.
    hoistRope.userData.setPoints([
      fixedHoistPoint,
      movingRopePoint,
    ], fixedHoistPoint.distanceTo(movingRopePoint));
  };

  const geometry = {
    boreBottomY,
    boreHalfWidth,
    boreTopY,
    centerPinStartY,
    centerPinStroke,
    centralWedgeBottomHalfWidth,
    centralWedgeBottomY,
    centralWedgeTopHalfWidth,
    centralWedgeTopY,
    contactMarkerLocalY,
    cycleDuration,
    cyclePhaseAtPhase,
    easedPhaseAt,
    motionEaseFraction,
    fixedHoistPoint,
    fullyRaisedPhase,
    kinematicWedgeSlope,
    lockStroke,
    lockingPhase,
    loweringStartPhase,
    officialCyclesPerMinute,
    packingAnchorContactX,
    packingAnchorStartX,
    packingAnchorStartY,
    packingBottomY,
    packingInnerBottomOffset,
    packingInnerTopOffset,
    packingMaximumSpread,
    releasedPhase,
    shackleRopePointLocalY,
    sourceCentralTaperSlope,
    sourcePackingTaperSlope,
    sourcePhaseLandmarks,
    sourceScale,
    sourceStoneOutline,
    sourceVerticalOriginScene,
    stoneHomePhase,
    stoneLiftStroke,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'central-hoist-wedge-spreading-two-stone-lifting-packing-pieces',
    blocks: {
      boreBack,
      boreBottom,
      boreWalls,
      centerHead,
      centerPin,
      centerTaper,
      hoistGuide,
      hoistRope,
      leftPacking,
      rightPacking,
      shackleArms,
      shacklePin,
      shacklePinEnds,
      shackleRing,
      stone,
      stoneBody,
      stoneBehindPocket,
      upwardIndex,
      upwardIndexShaft,
      wedgeContactMarkers,
    },
    degreesOfFreedom: {
      independentHoistInputs: 1,
      independentPackingCoordinates: 0,
      independentStoneCoordinates: 0,
      packingPieces: 2,
      rigidStoneCoordinates: 1,
    },
    dynamics: {
      contactSequence:
        'The hoist first raises only the broad-bottom central wedge. Its parallel taper interfaces drive the two packing pieces symmetrically outward. At exact wall contact the packing pieces become stationary relative to the stone; continued hoisting then carries center wedge, packings, and stone upward together.',
      forcePath:
        'Hoist tension enters the central wedge through its shackle, produces opposed normal forces on the two packing tapers, presses their vertical outer faces into the bore walls, and transfers the stone weight back through wall contact. The visualization asserts the kinematic load path, not a safe working load or material-specific friction capacity.',
      sourceLinearTimingDisclosure:
        'The official canvas uses piecewise-linear interpolation with instantaneous speed changes at its published phase landmarks. This model retains those exact source poses along the motion phase, the four-second period and the dwells, but eases each hoisting and lowering run in and out so the hoist never starts or stops instantly (including at the loop point).',
      straightBoreDisclosure:
        'Fidler describes the traditional separate-piece Lewis in a hole wider at the bottom, but Brown’s Movement 493 canvas explicitly draws a 1.5-unit straight-sided slot and drives vertical-faced packing pieces against it. The 3D cutaway follows that movement-specific canvas construction.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'One hoisted broad-bottom central taper slides between two mirrored packing wedges. During the first 0.138 cycle their matched interfaces convert 0.69 source units of central rise into 0.047586 units of outward travel per packing. Once both outer faces close on the stone bore, a further 1.31-unit hoist raises the packings and stone without relative slip.',
    motion: {
      centerPinDirection: new THREE.Vector3(0, 1, 0),
      packingDirections: [
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(1, 0, 0),
      ],
      stoneDirection: new THREE.Vector3(0, 1, 0),
    },
    sourceAnimation: {
      available: true,
      officialCanvasModelPresent: true,
      officialCyclePeriodSecond: cycleDuration,
      officialCyclesPerMinute,
      officialPhaseLandmarks: sourcePhaseLandmarks,
      sourcePrescribedAbsoluteTiming: true,
    },
    sourceReference: {
      brownBookScanUrl:
        'https://upload.wikimedia.org/wikipedia/commons/c/c3/Five_hundred_and_seven_mechanial_movements%2C_embracing_all_those_which_are_most_important_in_dynamics%2C_hydraulics%2C_hydrostatics%2C_pneumatics%2C_steam_engines%2C_mill_and_other_gearing_.._%28IA_fivehundredseven02brow%29.pdf',
      brownPlate493: {
        approximateBoreBoundsPixels: [207, 244, 307, 414],
        approximateHoistCenterXPixels: 258,
        approximateShackleBoundsPixels: [211, 105, 307, 248],
        approximateStoneBoundsPixels: [46, 244, 490, 496],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 8,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'one central taper pin or wedge',
          'two wedge-like packing pieces, one on each side',
          'all three pieces enter one drilled hole in the stone',
          'hoisting the center wedge drives both packings outward',
          'packing pressure against the hole enables the stone lift',
        ],
        fidlerCorroboration:
          'Henry Fidler’s 1893 Notes on Building Construction, volume II, pages 217–218, distinguishes the three separate iron pieces and also explains the operating principle: upward motion of a broad-bottom center wedge forces the side pieces outward, with increasing strain tightening the grip.',
        officialCanvasEvidence:
          'The official inline mm_493 model supplies a 15-cycles-per-minute cycle, phase landmarks 0/.138/.4/.5/.762/.9, a 2-unit center-pin stroke, a .047586-unit symmetric packing spread, a 1.31-unit stone lift, and the exact straight bore and taper profiles preserved here.',
        reconstructionDisclosure:
          'The three source-space profiles, contact sequence, phase timing, and relative travels come from Brown and the official canvas. Extrusion depth, cutaway depth treatment, materials, shackle solids, contact markers, overhead eye, camera, lighting, and the sectional presentation are original 3D engineering choices.',
      },
      fidlerArchivePageUrl:
        'https://archive.org/details/notesonbuildingc02fidliala/page/n243/mode/2up',
      officialInlineModelUrl: movement.sourceUrl,
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 493',
    },
    stateAtTime,
    transmission: {
      lockedLiftConstraint:
        'delta_y_packing=delta_y_stone and delta_y_center-delta_y_stone=0.69 after wall contact',
      symmetricSpreadConstraint:
        'x_right=-x_left=0.702414+k_wedge*(delta_y_center-delta_y_stone)',
      wallContactConstraint:
        'abs(x_packing_outer)=bore_half_width=0.75 before stone motion',
      wedgeSlopeConstraint:
        'k_wedge=0.047586/0.69',
    },
    update,
    wedgeInterfaceAtState,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.82, -1.78, -2.52),
    new THREE.Vector3(2.82, 5.40, 1.62),
  );
  root.userData.cameraDistanceScale = 1.04;
  root.userData.cameraDirection = new THREE.Vector3(1.8, 1.5, 11);
  root.userData.groundFloorY = -1.78;
  markShadows(root);
  for (const marker of [
    ...wedgeContactMarkers,
    leftPacking.wallContactMarker,
    rightPacking.wallContactMarker,
    upwardIndex,
    upwardIndexShaft,
  ]) marker.castShadow = false;
  fitPistonGuide(root, update, cycleDuration);
  // Brown draws the stone in flat section; view it square to the cut.
  root.userData.cameraDirection.set(0.03, 0.05, 11);
  root.userData.cameraFov = 10;
  root.userData.hideGround = true;
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredStoneLewisMovement(movement) {
  if (movement.id !== 493) return null;
  return stoneLewis(movement);
}
