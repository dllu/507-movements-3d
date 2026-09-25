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
    curveSegments: 3,
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

function cylinderBetween(start, end, radius, material, role, sides = 18) {
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

function makeDynamicRod(radius, material, role) {
  const rod = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 1, 18),
    material,
  ), role);
  const up = new THREE.Vector3(0, 1, 0);
  rod.userData.setEndpoints = (start, end) => {
    const direction = end.clone().sub(start);
    rod.position.copy(start).add(end).multiplyScalar(0.5);
    rod.scale.set(1, direction.length(), 1);
    rod.quaternion.setFromUnitVectors(up, direction.normalize());
  };
  return rod;
}

function tubeThrough(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  const tube = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(curve, 56, radius, 12, false),
    material,
  ), role);
  tube.userData.centerline = curve;
  return tube;
}

function rotateVector(vector, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new THREE.Vector2(
    cosine * vector.x - sine * vector.y,
    sine * vector.x + cosine * vector.y,
  );
}

function stoneLiftingTongs(movement) {
  const root = new THREE.Group();
  const officialCyclesPerMinute = 15;
  const cycleDuration = 60 / officialCyclesPerMinute;
  const sourceScale = 0.72;
  const sourceGroundY = -3.177038;
  const sourceBaselineScene = -1.78;
  const groundBedThickness = 0.2;
  const groundFloorY = sourceBaselineScene - groundBedThickness - 1e-3;
  const sourceVerticalOriginScene =
    sourceBaselineScene - sourceGroundY * sourceScale;
  const sourcePhaseLandmarks = [0, 0.2, 0.4, 0.5, 0.7, 0.9, 1];
  const jawPivotRestY = 4.25;
  const memberLength = 1.8;
  const openJawAngle = THREE.MathUtils.degToRad(35);
  const closedJawAngle = Math.PI / 4;
  const stoneLiftStroke = 0.480709;
  const leftBiteLocal = new THREE.Vector2(-3.712311, -0.883883);
  const rightBiteLocal = new THREE.Vector2(-3.712311, 0.883883);
  const leftStoneContactRest = new THREE.Vector2(-2, 1);
  const rightStoneContactRest = new THREE.Vector2(2, 1);

  const closureAtPhase = (phase) => {
    if (phase < 0.2) return phase / 0.2;
    if (phase <= 0.7) return 1;
    if (phase < 0.9) return (0.9 - phase) / 0.2;
    return 0;
  };

  const liftAtPhase = (phase) => {
    if (phase <= 0.2) return 0;
    if (phase < 0.4) return stoneLiftStroke * (phase - 0.2) / 0.2;
    if (phase <= 0.5) return stoneLiftStroke;
    if (phase < 0.7) return stoneLiftStroke * (0.7 - phase) / 0.2;
    return 0;
  };

  const closureVelocityAtPhase = (phase) => {
    if (phase < 0.2) return 1 / 0.2 / cycleDuration;
    if (phase > 0.7 && phase < 0.9) return -1 / 0.2 / cycleDuration;
    return 0;
  };

  const liftVelocityAtPhase = (phase) => {
    if (phase > 0.2 && phase < 0.4) {
      return stoneLiftStroke / 0.2 / cycleDuration;
    }
    if (phase > 0.5 && phase < 0.7) {
      return -stoneLiftStroke / 0.2 / cycleDuration;
    }
    return 0;
  };

  const leftBiteAt = (jawAngle, pivotY) => new THREE.Vector2(0, pivotY)
    .add(rotateVector(leftBiteLocal, jawAngle));
  const rightBiteAt = (jawAngle, pivotY) => new THREE.Vector2(0, pivotY)
    .add(rotateVector(rightBiteLocal, Math.PI - jawAngle));

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    const closureProgress = closureAtPhase(phase);
    const stoneLift = liftAtPhase(phase);
    const leftJawAngle = THREE.MathUtils.lerp(
      openJawAngle,
      closedJawAngle,
      closureProgress,
    );
    const rightJawAngle = Math.PI - leftJawAngle;
    const jawPivotY = jawPivotRestY + stoneLift;
    const sidePivotHalfWidth = memberLength * Math.cos(leftJawAngle);
    const sidePivotY = jawPivotY
      + memberLength * Math.sin(leftJawAngle);
    const leftLinkPivot = new THREE.Vector2(
      sidePivotHalfWidth,
      sidePivotY,
    );
    const rightLinkPivot = new THREE.Vector2(
      -sidePivotHalfWidth,
      sidePivotY,
    );
    const shacklePivot = new THREE.Vector2(
      0,
      jawPivotY + 2 * memberLength * Math.sin(leftJawAngle),
    );
    const leftBite = leftBiteAt(leftJawAngle, jawPivotY);
    const rightBite = rightBiteAt(leftJawAngle, jawPivotY);
    const leftStoneContact = leftStoneContactRest.clone();
    const rightStoneContact = rightStoneContactRest.clone();
    leftStoneContact.y += stoneLift;
    rightStoneContact.y += stoneLift;
    const biteInwardRatePerRadian =
      -leftBiteLocal.x * Math.sin(leftJawAngle)
      - leftBiteLocal.y * Math.cos(leftJawAngle);
    const shackleRiseRatePerRadian =
      2 * memberLength * Math.cos(leftJawAngle);
    const biteForcePerUnitHoistTension =
      shackleRiseRatePerRadian / (2 * biteInwardRatePerRadian);
    const phaseBoundaryTolerance = 1e-12;
    const biteContact = closureProgress >= 1 - phaseBoundaryTolerance
      && phase >= 0.2 - phaseBoundaryTolerance
      && phase <= 0.7 + phaseBoundaryTolerance;
    return {
      biteContact,
      biteForcePerUnitHoistTension,
      biteInwardRatePerRadian,
      closureProgress,
      closureVelocityPerSecond: closureVelocityAtPhase(phase),
      cycleTime,
      jawPivotY,
      leftBite,
      leftBiteContactError: leftBite.distanceTo(leftStoneContact),
      leftJawAngle,
      leftLinkPivot,
      leftStoneContact,
      liftVelocitySourceUnitPerSecond: liftVelocityAtPhase(phase),
      phase,
      rightBite,
      rightBiteContactError: rightBite.distanceTo(rightStoneContact),
      rightJawAngle,
      rightLinkPivot,
      rightStoneContact,
      shacklePivot,
      shackleRiseRatePerRadian,
      sidePivotHalfWidth,
      sidePivotY,
      stoneLift,
    };
  };

  const leftMaterial = matte(PALETTE.driven, {
    metalness: 0.30,
    roughness: 0.43,
  });
  const rightMaterial = matte(PALETTE.accent, {
    metalness: 0.29,
    roughness: 0.45,
  });
  const shackleMaterial = matte(PALETTE.driver, {
    metalness: 0.32,
    roughness: 0.41,
  });
  const stoneMaterial = matte(PALETTE.muted, {
    metalness: 0.01,
    roughness: 0.92,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.38,
    roughness: 0.36,
  });
  const contactMaterial = matte(PALETTE.white, {
    opacity: 0.98,
    roughness: 0.18,
    transparent: true,
  });
  contactMaterial.depthWrite = false;

  const stone = addRole(new THREE.Group(),
    'irregular-stone-carried-only-while-both-tong-points-bite');
  stone.position.y = sourceVerticalOriginScene;
  root.add(stone);
  const sourceStoneOutline = [
    [-2, 1],
    [-1.812928, 0.550908],
    [-2.155107, -0.277525],
    [-1.920985, -2.384625],
    [-1.362693, -3.177038],
    [0.600331, -2.924907],
    [1.628293, -3.114841],
    [1.832704, -2.892179],
    [2.113121, -1.214014],
    [1.933027, -0.295534],
    [2.239186, 0.406832],
    [2, 1],
    [2.149139, 1.757537],
    [1.82497, 2.820092],
    [0.708388, 3.162271],
    [-1.290656, 2.89213],
    [-1.512053, 2.970206],
    [-1.931097, 2.879805],
    [-2.155107, 1.307302],
  ];
  const stoneShapePoints = sourceStoneOutline.map(([x, y]) => [
    x * sourceScale,
    y * sourceScale,
  ]);
  const stoneBody = polygonMesh(
    stoneShapePoints,
    3.25,
    stoneMaterial,
    'source-profiled-lifted-stone',
    0,
  );
  stoneBody.position.z = -0.48;
  stone.add(stoneBody);
  // Brown draws the stone already hanging in the nippers. The canvas cycle
  // also opens the tongs while the stone is down, so the stone needs a
  // resting surface then: a plain flat bed whose top is the stone's
  // source baseline. It is the minimum undrawn support the cycle requires.
  const groundBedMaterial = matte(PALETTE.frame, {
    metalness: 0.0,
    roughness: 0.95,
  });
  const groundBed = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(5.0, groundBedThickness, 4.2),
    groundBedMaterial,
  ), 'flat-ground-bed-the-stone-rests-on-while-the-tongs-open');
  groundBed.position.set(0, sourceBaselineScene - groundBedThickness / 2, -0.48);
  root.add(groundBed);
  const stoneContactSockets = [
    leftStoneContactRest,
    rightStoneContactRest,
  ].map((point, index) => {
    const socket = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 20, 13),
      darkMaterial,
    ), `stone-bite-seat-${index + 1}`);
    socket.position.set(
      point.x * sourceScale,
      point.y * sourceScale,
      index === 0 ? 0.13 : -0.13,
    );
    socket.visible=false;
    stone.add(socket);
    return socket;
  });

  const leftJaw = addRole(new THREE.Group(),
    'left-biting-tong-with-upper-right-arm');
  const rightJaw = addRole(new THREE.Group(),
    'right-biting-tong-with-upper-left-arm');
  root.add(leftJaw, rightJaw);

  const sourceLeftCurve = [
    [0, 0],
    [-0.955, 0.601],
    [-2.121, 0.849],
    [-3.359, 0.460],
    [leftBiteLocal.x, leftBiteLocal.y],
  ];
  const makeJawParts = (jaw, side, material) => {
    const {rod:upperArm}=makeBoredLinkRod({bodyMaterial:material,depth:.18,length:memberLength*sourceScale,planeZ:0,role:`${side}-tong-upper-arm`,width:.20,startBoreRadius:.154,boreRadius:.109});
    jaw.add(upperArm);
    const curvePoints = sourceLeftCurve.map(([x, y]) => new THREE.Vector3(
      x * sourceScale,
      (side === 'left' ? y : -y) * sourceScale,
      0,
    ));
    const finalPoint=curvePoints.at(-1).clone();
    const tipDirection=new THREE.Vector3(Math.SQRT1_2,side==='left'?-Math.SQRT1_2:Math.SQRT1_2,0);
    curvePoints[0]=curvePoints[1].clone().normalize().multiplyScalar(.29);
    curvePoints[curvePoints.length-1].addScaledVector(tipDirection,-.24);
    const curvedJaw = tubeThrough(
      curvePoints,
      0.125,
      material,
      `${side}-curved-gripping-arm`,
    );
    jaw.add(curvedJaw);
    const biteTip = addRole(new THREE.Mesh(
      new THREE.ConeGeometry(0.145, 0.38, 20),
      darkMaterial,
    ), `${side}-inward-stone-biting-point`);
    biteTip.position.copy(finalPoint).addScaledVector(tipDirection, -0.19);
    biteTip.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      tipDirection,
    );
    jaw.add(biteTip);
    const sidePivotCollar = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.055, 10, 36),
      material,
    ), `${side}-upper-link-pivot-collar`);
    sidePivotCollar.position.x = memberLength * sourceScale;
    sidePivotCollar.visible=false;
    jaw.add(sidePivotCollar);
    const biteMarker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.060, 18, 12),
      contactMaterial,
    ), `${side}-white-bite-contact-index`);
    biteMarker.position.copy(finalPoint);
    biteMarker.position.z = 0;
    jaw.add(biteMarker);
    return {
      biteMarker,
      biteTip,
      curvedJaw,
      sidePivotCollar,
      upperArm,
    };
  };
  const leftJawParts = makeJawParts(leftJaw, 'left', leftMaterial);
  const rightJawParts = makeJawParts(rightJaw, 'right', rightMaterial);

  const makeUpperLink=(material,z,role)=>{
    const {rod}=makeBoredLinkRod({bodyMaterial:material,depth:.14,length:memberLength*sourceScale,planeZ:z,role,width:.18,startBoreRadius:.109,boreRadius:.124});
    rod.userData.setEndpoints=(a,b)=>{rod.position.set(a.x,a.y,0);rod.rotation.z=Math.atan2(b.y-a.y,b.x-a.x);};
    return rod;
  };
  const leftUpperLink=makeUpperLink(leftMaterial,.38,'left-link-from-jaw-arm-to-common-shackle');
  const rightUpperLink=makeUpperLink(rightMaterial,-.38,'right-link-from-jaw-arm-to-common-shackle');
  root.add(leftUpperLink, rightUpperLink);

  const jawPivotPin = cylinderAlongZ(
    0.15,
    1.18,
    darkMaterial,
    'common-crossed-tong-fulcrum-pin',
    26,
  );
  root.add(jawPivotPin);
  const sidePivotPins = [0, 1].map((_, index) => {
    const pin = cylinderAlongZ(
      0.105,
      1.04,
      darkMaterial,
      `upper-jaw-to-link-pin-${index + 1}`,
      22,
    );
    root.add(pin);
    return pin;
  });
  const shacklePivotPin = cylinderAlongZ(
    0.12,
    1.52,
    darkMaterial,
    'common-upper-link-shackle-pin',
    24,
  );
  root.add(shacklePivotPin);
  const pivotMarkers = [0, 1, 2, 3].map((_, index) => {
    const marker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 17, 11),
      contactMaterial,
    ), `white-rhombus-pivot-index-${index + 1}`);
    root.add(marker);
    return marker;
  });

  const shackle = addRole(new THREE.Group(),
    'upper-shackle-receiving-the-single-hoist-pull');
  root.add(shackle);
  const shackleRing = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.082, 11, 44),
    shackleMaterial,
  ), 'hoist-shackle-ring');
  shackleRing.position.y = 0.36;
  shackle.add(shackleRing);
  const shackleStem=addRole(new THREE.Mesh(plate(clip.difference(clip.union(poly(circle([0,0],.16,64)),poly([[-.08,0],[.08,0],[.08,.22],[-.08,.22]])),poly(circle([0,0],.124,64))),-.06,.06),shackleMaterial),'shackle-neck-above-common-link-pin');
  shackle.add(shackleStem);

  const fixedHoistPoint = new THREE.Vector3(0, 6.75, 0.62);
  const shackleRopePointLocal = new THREE.Vector3(0, 0.72, 0);
  // Brown draws the hoist rope laid: the shared three-strand rope.
  const hoistRope = addRole(makeDynamicCable({
    laid: true,
    color: PALETTE.belt,
    maxSegments: 18,
    radius: 0.052,
  }), 'single-hoist-rope-pulling-the-common-shackle');
  hoistRope.userData.isBelt = false;
  hoistRope.userData.isHoistRope = true;
  root.add(hoistRope);
  const fixedHoistEye = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(0.20, 0.063, 10, 38),
    darkMaterial,
  ), 'fixed-overhead-hoist-eye');
  fixedHoistEye.position.copy(fixedHoistPoint);
  root.add(fixedHoistEye);

  const sourceToScene = (point, z) => new THREE.Vector3(
    point.x * sourceScale,
    sourceVerticalOriginScene + point.y * sourceScale,
    z,
  );

  const update = (time) => {
    const state = stateAtTime(time);
    const jawPivotScene = sourceToScene(
      new THREE.Vector2(0, state.jawPivotY),
      0,
    );
    leftJaw.position.copy(jawPivotScene);
    rightJaw.position.copy(jawPivotScene);
    leftJaw.position.z = 0.13;
    rightJaw.position.z = -0.13;
    leftJaw.rotation.z = state.leftJawAngle;
    rightJaw.rotation.z = state.rightJawAngle;
    stone.position.y = sourceVerticalOriginScene
      + state.stoneLift * sourceScale;

    const leftLinkPivotScene = sourceToScene(state.leftLinkPivot, 0.13);
    const rightLinkPivotScene = sourceToScene(state.rightLinkPivot, -0.13);
    const shacklePivotScene = sourceToScene(state.shacklePivot, 0);
    leftUpperLink.userData.setEndpoints(
      leftLinkPivotScene,
      shacklePivotScene.clone().setZ(0.13),
    );
    rightUpperLink.userData.setEndpoints(
      rightLinkPivotScene,
      shacklePivotScene.clone().setZ(-0.13),
    );
    jawPivotPin.position.copy(jawPivotScene);
    sidePivotPins[0].position.copy(leftLinkPivotScene);
    sidePivotPins[1].position.copy(rightLinkPivotScene);
    shacklePivotPin.position.copy(shacklePivotScene);
    pivotMarkers[0].position.copy(jawPivotScene).setZ(0.63);
    pivotMarkers[1].position.copy(leftLinkPivotScene).setZ(0.63);
    pivotMarkers[2].position.copy(rightLinkPivotScene).setZ(0.63);
    pivotMarkers[3].position.copy(shacklePivotScene).setZ(0.63);
    shackle.position.copy(shacklePivotScene).setZ(0.62);
    leftJawParts.biteMarker.visible = state.biteContact;
    rightJawParts.biteMarker.visible = state.biteContact;

    const movingRopePoint = shackle.position.clone()
      .add(shackleRopePointLocal);
    hoistRope.userData.setPoints([fixedHoistPoint, movingRopePoint]);
  };

  const geometry = {
    closedJawAngle,
    cycleDuration,
    fixedHoistPoint,
    groundFloorY,
    jawPivotRestY,
    leftBiteLocal,
    leftStoneContactRest,
    memberLength,
    officialCyclesPerMinute,
    openJawAngle,
    rightBiteLocal,
    rightStoneContactRest,
    shackleRopePointLocal,
    sourceGroundY,
    sourceBaselineScene,
    sourcePhaseLandmarks,
    sourceScale,
    sourceStoneOutline,
    sourceVerticalOriginScene,
    stoneLiftStroke,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'weight-tightened-rhombus-link-stone-lifting-tongs',
    blocks: {
      fixedHoistEye,
      groundBed,
      hoistRope,
      jawPivotPin,
      leftJaw,
      leftJawParts,
      leftUpperLink,
      pivotMarkers,
      rightJaw,
      rightJawParts,
      rightUpperLink,
      shackle,
      shacklePivotPin,
      shackleRing,
      shackleStem,
      sidePivotPins,
      stone,
      stoneBody,
      stoneContactSockets,
    },
    degreesOfFreedom: {
      independentHoistInputs: 1,
      independentJawCoordinates: 0,
      independentLinkCoordinates: 0,
      independentStoneCoordinates: 0,
      tongJawBodies: 2,
      upperLinks: 2,
    },
    dynamics: {
      biteForceLaw:
        'For the ideal lossless rhombus during closure, virtual work gives F_bite_per_side/T_hoist=(dy_shackle/dtheta)/(2*dx_bite_inward/dtheta). The ratio is positive throughout the 35-to-45-degree closing stroke, so bite force rises linearly with suspended weight as Brown states.',
      contactSequence:
        'The common shackle first narrows the four equal 1.8-unit members, rotating both crossed tong bodies from 35 to 45 degrees while the stone stays down. Both points then meet the source seats at (-2,1) and (2,1); only in that closed pose does the entire tong-and-stone assembly rise 0.480709 unit.',
      safetyDisclosure:
        'This is a kinematic and ideal-force study, not a lifting rating. Fidler warns that bite seats must be far enough below the top to resist tearing out and that the stone center of gravity must remain below the points.',
      sourceLinearTimingDisclosure:
        'The official 15-cycles-per-minute canvas uses piecewise-linear jaw rotation and stone translation at phases 0/.2/.4/.5/.7/.9. The model preserves its exact four-second cycle and dwells.',
    },
    fidelity: 'authored',
    geometry,
    leftBiteAt,
    mechanism:
      'Two crossed curved tong bodies share a lower fulcrum. Their upper arms join two equal links at side pivots; those links meet at one hoisted shackle, forming an exact equal-sided rhombus. Upward shackle motion draws the side pivots inward, swings both lower points into the stone, and then carries the gripped stone.',
    motion: {
      hoistDirection: new THREE.Vector3(0, 1, 0),
      jawAxes: new THREE.Vector3(0, 0, 1),
      stoneDirection: new THREE.Vector3(0, 1, 0),
    },
    rightBiteAt,
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
      brownPlate494: {
        approximateBitePointPixels: [170, 367, 353, 367],
        approximateJawFulcrumPixels: [261, 217],
        approximateShacklePivotPixels: [261, 119],
        approximateSideLinkPivotsPixels: [212, 166, 309, 166],
        approximateStoneBoundsPixels: [166, 270, 352, 496],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 8,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'one shackle connects two upper links',
          'the links act on the two upper tong arms',
          'the lower tong points press against or into the stone',
          'increasing lifted weight increases the bite',
        ],
        fidlerCorroboration:
          'Henry Fidler’s 1893 Notes on Building Construction, volume II, page 218, describes stone nippers whose upper eyes are drawn inward by a chain and lifting ring, tightening their points on the stone as weight comes onto the chain; he also states the anti-tear-out and center-of-gravity precautions.',
        officialCanvasEvidence:
          'The official inline mm_494 model supplies four 1.8-unit rhombus members, 35- and 45-degree jaw poses, exact bite seats at (-2,1)/(2,1), a 0.480709-unit rigid stone lift, phases 0/.2/.4/.5/.7/.9, and 15 cycles per minute.',
        reconstructionDisclosure:
          'Source-space pivot, bite, outline, phase, and travel values are preserved. Curved-jaw centerline solids, layer separation at the crossed fulcrum, extrusion depths, materials, bite markers, hoist eye, camera, and ideal virtual-work annotation are original 3D engineering choices.',
      },
      fidlerArchivePageUrl:
        'https://archive.org/details/notesonbuildingc02fidliala/page/n244/mode/2up',
      officialInlineModelUrl: movement.sourceUrl,
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 494',
    },
    stateAtTime,
    transmission: {
      biteClosure:
        'R(theta_closed)*p_bite_left+P_fulcrum=(-2,1+delta_stone) and mirrored right=(2,1+delta_stone)',
      equalMemberConstraint:
        'distance(P_fulcrum,P_side_left)=distance(P_side_left,P_shackle)=distance(P_shackle,P_side_right)=distance(P_side_right,P_fulcrum)=1.8',
      loadLock:
        'delta_stone>0 only when theta_left=45deg, theta_right=135deg, and both bite contacts are closed',
      symmetry:
        'x_side_left=-x_side_right and x_bite_left=-x_bite_right',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.85, groundFloorY, -2.25),
    new THREE.Vector3(2.85, 6.56, 1.75),
  );
  root.userData.cameraDistanceScale = 1.03;
  root.userData.cameraDirection = new THREE.Vector3(1.8, 1.5, 11);
  root.userData.groundFloorY = groundFloorY;
  markShadows(root);
  for (const marker of [
    ...pivotMarkers,
    leftJawParts.biteMarker,
    rightJawParts.biteMarker,
  ]) marker.castShadow = false;
  fitPistonGuide(root, update, cycleDuration);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredStoneTongMovement(movement) {
  if (movement.id !== 494) return null;
  return stoneLiftingTongs(movement);
}
