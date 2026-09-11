import * as THREE from 'three';
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

function cylinderBetween(start, end, radius, material, role, sides = 18) {
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), sides),
    material,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  mesh.userData.role = role;
  return mesh;
}

function signedShortestAngle(from, to) {
  return THREE.MathUtils.euclideanModulo(to - from + Math.PI, FULL_TURN)
    - Math.PI;
}

function tangentPointFromExternalPoint(center, radius, point, side) {
  const relative = point.clone().sub(center);
  const distanceSquared = relative.lengthSq();
  if (distanceSquared <= radius ** 2) {
    throw new Error('rope attachment must remain outside its guide sheave');
  }
  const perpendicular = new THREE.Vector2(-relative.y, relative.x);
  const radialScale = radius ** 2 / distanceSquared;
  const tangentScale = radius
    * Math.sqrt(distanceSquared - radius ** 2) / distanceSquared;
  return center.clone()
    .addScaledVector(relative, radialScale)
    .addScaledVector(perpendicular, side * tangentScale);
}

function externalCircleTangent(centerA, radiusA, centerB, radiusB, side) {
  const delta = centerB.clone().sub(centerA);
  const distanceSquared = delta.lengthSq();
  const radiusDifference = radiusA - radiusB;
  const discriminant = distanceSquared - radiusDifference ** 2;
  if (discriminant <= 0) throw new Error('guide and barrel overlap');
  const perpendicular = new THREE.Vector2(-delta.y, delta.x);
  const normal = delta.clone().multiplyScalar(
    radiusDifference / distanceSquared,
  ).addScaledVector(
    perpendicular,
    side * Math.sqrt(discriminant) / distanceSquared,
  );
  return {
    contactA: centerA.clone().addScaledVector(normal, radiusA),
    contactB: centerB.clone().addScaledVector(normal, radiusB),
    normal,
  };
}

function appendPoint(points, point) {
  if (points.length === 0 || points.at(-1).distanceToSquared(point) > 1e-18) {
    points.push(point);
  }
}

function arcPoints2D({ center, end, radius, start, steps, z }) {
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
  const arcDelta = signedShortestAngle(startAngle, endAngle);
  const points = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = startAngle + arcDelta * index / steps;
    points.push(new THREE.Vector3(
      center.x + radius * Math.cos(angle),
      center.y + radius * Math.sin(angle),
      z,
    ));
  }
  return { arcDelta, points };
}

function ropeSteering(movement) {
  const root = new THREE.Group();
  const drumCenter = new THREE.Vector2(-2.20, 0.32);
  const drumRadius = 0.38;
  const drumHalfWidth = 0.34;
  const guideRadius = 0.34;
  const upperGuideCenter = new THREE.Vector2(-0.18, 1.66);
  const lowerGuideCenter = new THREE.Vector2(-0.18, -1.02);
  const rudderCenter = new THREE.Vector2(2.66, 0.32);
  const tillerLength = 2.20;
  const maximumTillerAngle = THREE.MathUtils.degToRad(25);
  const cycleDuration = 8;
  const cycleAngularFrequency = FULL_TURN / cycleDuration;
  const upperRopePlaneZ = 0.38;
  const lowerRopePlaneZ = -0.38;
  const ropeRadius = 0.036;
  const visibleFullWrapCount = 5;
  const markerCount = 14;

  const upperDrumGuideTangent = externalCircleTangent(
    drumCenter,
    drumRadius,
    upperGuideCenter,
    guideRadius,
    1,
  );
  const lowerDrumGuideTangent = externalCircleTangent(
    drumCenter,
    drumRadius,
    lowerGuideCenter,
    guideRadius,
    -1,
  );
  const upperDrumContact = upperDrumGuideTangent.contactA;
  const upperFixedGuideContact = upperDrumGuideTangent.contactB;
  const lowerDrumContact = lowerDrumGuideTangent.contactA;
  const lowerFixedGuideContact = lowerDrumGuideTangent.contactB;
  const upperDrumContactAngle = Math.atan2(
    upperDrumContact.y - drumCenter.y,
    upperDrumContact.x - drumCenter.x,
  );
  let lowerDrumContactAngle = Math.atan2(
    lowerDrumContact.y - drumCenter.y,
    lowerDrumContact.x - drumCenter.x,
  );
  while (lowerDrumContactAngle <= upperDrumContactAngle) {
    lowerDrumContactAngle += FULL_TURN;
  }
  const helicalAngleSpan = visibleFullWrapCount * FULL_TURN
    + lowerDrumContactAngle - upperDrumContactAngle;
  const visibleWrapCount = helicalAngleSpan / FULL_TURN;

  const tillerTipAtAngle = (angleRadian) => new THREE.Vector2(
    rudderCenter.x - tillerLength * Math.cos(angleRadian),
    rudderCenter.y + tillerLength * Math.sin(angleRadian),
  );

  const routeFromAttachmentToDrum = ({
    attachment,
    attachmentTangentSide,
    drumContact,
    fixedGuideContact,
    guideCenter,
    ropePlaneZ,
  }) => {
    const attachmentGuideContact = tangentPointFromExternalPoint(
      guideCenter,
      guideRadius,
      attachment,
      attachmentTangentSide,
    );
    const arc = arcPoints2D({
      center: guideCenter,
      end: fixedGuideContact,
      radius: guideRadius,
      start: attachmentGuideContact,
      steps: 18,
      z: ropePlaneZ,
    });
    const points = [];
    appendPoint(points, new THREE.Vector3(
      attachment.x,
      attachment.y,
      ropePlaneZ,
    ));
    for (const point of arc.points) appendPoint(points, point);
    appendPoint(points, new THREE.Vector3(
      drumContact.x,
      drumContact.y,
      ropePlaneZ,
    ));
    const straightLength = attachment.distanceTo(attachmentGuideContact)
      + fixedGuideContact.distanceTo(drumContact);
    return {
      arcDelta: arc.arcDelta,
      attachmentGuideContact,
      branchLength: straightLength + guideRadius * Math.abs(arc.arcDelta),
      fixedGuideContact: fixedGuideContact.clone(),
      points,
    };
  };

  const branchRoutesAtTillerAngle = (tillerAngleRadian) => {
    const attachment = tillerTipAtAngle(tillerAngleRadian);
    const upper = routeFromAttachmentToDrum({
      attachment,
      attachmentTangentSide: 1,
      drumContact: upperDrumContact,
      fixedGuideContact: upperFixedGuideContact,
      guideCenter: upperGuideCenter,
      ropePlaneZ: upperRopePlaneZ,
    });
    const lower = routeFromAttachmentToDrum({
      attachment,
      attachmentTangentSide: -1,
      drumContact: lowerDrumContact,
      fixedGuideContact: lowerFixedGuideContact,
      guideCenter: lowerGuideCenter,
      ropePlaneZ: lowerRopePlaneZ,
    });
    return {
      attachment,
      differentialLength: lower.branchLength - upper.branchLength,
      lower,
      totalFreeBranchLength: lower.branchLength + upper.branchLength,
      upper,
    };
  };

  const neutralRoutes = branchRoutesAtTillerAngle(0);
  const neutralDifferentialLength = neutralRoutes.differentialLength;
  const positiveExtremeRoutes = branchRoutesAtTillerAngle(
    maximumTillerAngle,
  );
  const maximumDifferentialExcursion =
    positiveExtremeRoutes.differentialLength - neutralDifferentialLength;
  const drumAngleAmplitude =
    maximumDifferentialExcursion / (2 * drumRadius);

  const solveTillerAngleForDifferential = (targetDifferentialLength) => {
    let low = -maximumTillerAngle;
    let high = maximumTillerAngle;
    const increasing = branchRoutesAtTillerAngle(high).differentialLength
      > branchRoutesAtTillerAngle(low).differentialLength;
    for (let iteration = 0; iteration < 64; iteration += 1) {
      const middle = (low + high) / 2;
      const difference = branchRoutesAtTillerAngle(middle)
        .differentialLength;
      if ((difference < targetDifferentialLength) === increasing) {
        low = middle;
      } else {
        high = middle;
      }
    }
    return (low + high) / 2;
  };

  const differentialDerivativeAtAngle = (angleRadian) => {
    const step = 1e-6;
    return (
      branchRoutesAtTillerAngle(angleRadian + step).differentialLength
      - branchRoutesAtTillerAngle(angleRadian - step).differentialLength
    ) / (2 * step);
  };

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const phaseAngle = cycleAngularFrequency * time;
    const barrelAngleRadian = drumAngleAmplitude * Math.sin(phaseAngle);
    const barrelAngularVelocityRadianPerSecond = drumAngleAmplitude
      * cycleAngularFrequency * Math.cos(phaseAngle);
    const targetDifferentialLength = neutralDifferentialLength
      + 2 * drumRadius * barrelAngleRadian;
    const tillerAngleRadian = solveTillerAngleForDifferential(
      targetDifferentialLength,
    );
    const routes = branchRoutesAtTillerAngle(tillerAngleRadian);
    const differentialDerivative = differentialDerivativeAtAngle(
      tillerAngleRadian,
    );
    const tillerAngularVelocityRadianPerSecond =
      2 * drumRadius * barrelAngularVelocityRadianPerSecond
      / differentialDerivative;
    const ropeSpeed = drumRadius
      * barrelAngularVelocityRadianPerSecond;
    const upperGuideDirection = Math.sign(routes.upper.arcDelta) || 1;
    const lowerGuideDirection = -Math.sign(routes.lower.arcDelta) || 1;
    const upperGuideAngleRadian = upperGuideDirection
      * drumRadius / guideRadius * barrelAngleRadian;
    const lowerGuideAngleRadian = lowerGuideDirection
      * drumRadius / guideRadius * barrelAngleRadian;
    return {
      barrelAngleRadian,
      barrelAngularVelocityRadianPerSecond,
      cycleTime,
      differentialDerivative,
      differentialLength: routes.differentialLength,
      handwheelAngleRadian: barrelAngleRadian,
      lowerGuideAngleRadian,
      lowerGuideAngularVelocityRadianPerSecond:
        lowerGuideDirection * ropeSpeed / guideRadius,
      phase: cycleTime / cycleDuration,
      ropeDisplacement: drumRadius * barrelAngleRadian,
      ropeSpeed,
      routes,
      targetDifferentialLength,
      tillerAngleRadian,
      tillerAngularVelocityRadianPerSecond,
      upperGuideAngleRadian,
      upperGuideAngularVelocityRadianPerSecond:
        upperGuideDirection * ropeSpeed / guideRadius,
    };
  };

  const ropeMaterial = matte(PALETTE.belt, {
    metalness: 0.04,
    roughness: 0.67,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.22,
    roughness: 0.45,
  });
  const drivenMaterial = matte(PALETTE.accent, {
    metalness: 0.18,
    roughness: 0.50,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.30,
    roughness: 0.40,
  });
  const supportMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.58,
  });
  const markerMaterial = matte(PALETTE.white, {
    opacity: 0.97,
    roughness: 0.16,
    transparent: true,
  });
  markerMaterial.depthWrite = false;

  const wheelAndBarrel = addRole(new THREE.Group(),
    'coaxial-handwheel-and-rope-barrel-driver');
  wheelAndBarrel.position.set(drumCenter.x, drumCenter.y, 0);
  root.add(wheelAndBarrel);
  const handwheelRim = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(1.05, 0.085, 12, 64),
    driverMaterial,
  ), 'handwheel-rim-on-barrel-shaft');
  handwheelRim.position.z = -0.72;
  wheelAndBarrel.add(handwheelRim);
  const handwheelSpokes = [];
  for (let index = 0; index < 8; index += 1) {
    const spoke = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(1.84, 0.075, 0.075),
      driverMaterial,
    ), `handwheel-spoke-${index + 1}`);
    spoke.rotation.z = index * Math.PI / 4;
    spoke.position.z = -0.72;
    wheelAndBarrel.add(spoke);
    handwheelSpokes.push(spoke);
  }
  const barrel = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(drumRadius, drumRadius, 0.82, 40),
    darkMaterial,
  ), 'single-rope-winding-barrel-on-handwheel-shaft');
  barrel.rotation.x = Math.PI / 2;
  wheelAndBarrel.add(barrel);
  const barrelFlanges = [-0.43, 0.43].map((z, index) => {
    const flange = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.49, 0.49, 0.09, 40),
      driverMaterial,
    ), `barrel-end-flange-${index + 1}`);
    flange.rotation.x = Math.PI / 2;
    flange.position.z = z;
    wheelAndBarrel.add(flange);
    return flange;
  });
  const handwheelIndex = addRole(new THREE.Mesh(
    new THREE.SphereGeometry(0.078, 18, 12),
    markerMaterial,
  ), 'white-handwheel-and-barrel-index');
  handwheelIndex.position.set(0.77, 0, -0.72);
  wheelAndBarrel.add(handwheelIndex);

  const makeGuide = (center, z, label) => {
    const fixed = addRole(new THREE.Group(),
      `fixed-${label}-guide-sheave-bearing`);
    fixed.position.set(center.x, center.y, z);
    const rotating = addRole(new THREE.Group(),
      `${label}-guide-sheave-rotor`);
    const sheave = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(guideRadius * 0.82, guideRadius * 0.82,
        0.18, 36),
      drivenMaterial,
    ), `${label}-guide-sheave-body`);
    sheave.rotation.x = Math.PI / 2;
    const groove = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(guideRadius, 0.045, 10, 44),
      darkMaterial,
    ), `${label}-guide-sheave-rope-groove`);
    const index = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(guideRadius * 0.58, 0.050, 0.035),
      markerMaterial,
    ), `${label}-guide-sheave-white-index`);
    index.position.x = guideRadius * 0.43;
    rotating.add(sheave, groove, index);
    fixed.add(rotating);
    root.add(fixed);
    return { fixed, groove, index, rotating, sheave };
  };
  const upperGuide = makeGuide(
    upperGuideCenter,
    upperRopePlaneZ,
    'upper',
  );
  const lowerGuide = makeGuide(
    lowerGuideCenter,
    lowerRopePlaneZ,
    'lower',
  );

  const tiller = addRole(new THREE.Group(),
    'tiller-rigidly-fixed-to-rudder-head');
  tiller.position.set(rudderCenter.x, rudderCenter.y, 0.02);
  root.add(tiller);
  const tillerBar = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(tillerLength, 0.18, 0.25),
    drivenMaterial,
  ), 'tiller-lever');
  tillerBar.position.x = -tillerLength / 2;
  tiller.add(tillerBar);
  const tillerTipBoss = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 0.86, 28),
    darkMaterial,
  ), 'two-plane-rope-attachment-at-tiller-tip');
  tillerTipBoss.rotation.x = Math.PI / 2;
  tillerTipBoss.position.x = -tillerLength;
  tiller.add(tillerTipBoss);
  const rudderHead = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.44, 0.44, 0.66, 36),
    drivenMaterial,
  ), 'vertical-rudder-head-and-tiller-pivot');
  rudderHead.rotation.x = Math.PI / 2;
  tiller.add(rudderHead);
  const squareRudderKey = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.28, 0.07),
    darkMaterial,
  ), 'square-rudder-head-key');
  squareRudderKey.rotation.z = Math.PI / 4;
  squareRudderKey.position.z = 0.38;
  tiller.add(squareRudderKey);

  const fixedShaft = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 1.86, 24),
    darkMaterial,
  ), 'fixed-axis-through-handwheel-barrel');
  fixedShaft.rotation.x = Math.PI / 2;
  fixedShaft.position.set(drumCenter.x, drumCenter.y, -0.15);
  root.add(fixedShaft);
  const wheelPedestals = [-1, 1].map((side, index) => {
    const pedestal = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 1.58, 0.24),
      supportMaterial,
    ), `fixed-handwheel-pedestal-${index + 1}`);
    pedestal.position.set(drumCenter.x + side * 0.72, -0.66, -0.82);
    root.add(pedestal);
    return pedestal;
  });
  const deck = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(7.10, 4.50, 0.15),
    matte(PALETTE.muted, { roughness: 0.84 }),
  ), 'fixed-plan-view-demonstration-deck');
  deck.position.set(-0.12, 0.28, -1.04);
  root.add(deck);

  const helicalPoints = Array.from({ length: 181 }, (_, index) => {
    const progress = index / 180;
    const angle = upperDrumContactAngle + helicalAngleSpan * progress;
    return new THREE.Vector3(
      drumCenter.x + drumRadius * Math.cos(angle),
      drumCenter.y + drumRadius * Math.sin(angle),
      THREE.MathUtils.lerp(upperRopePlaneZ, lowerRopePlaneZ, progress),
    );
  });
  // Force the analytic tangent contacts exactly at the two endpoints.
  helicalPoints[0].set(
    upperDrumContact.x,
    upperDrumContact.y,
    upperRopePlaneZ,
  );
  helicalPoints.at(-1).set(
    lowerDrumContact.x,
    lowerDrumContact.y,
    lowerRopePlaneZ,
  );

  const ropePathState = {
    curve: null,
    pathLength: 0,
    points: [],
  };
  const rope = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.LineCurve3(
        new THREE.Vector3(),
        new THREE.Vector3(0.001, 0, 0),
      ),
      2,
      ropeRadius,
      7,
      false,
    ),
    ropeMaterial,
  ), 'one-continuous-tiller-rope-including-both-branches-and-barrel-wraps');
  rope.userData.isBelt = false;
  rope.userData.isSingleContinuousRope = true;
  root.add(rope);
  const ropeMarkers = Array.from({ length: markerCount }, (_, index) => {
    const marker = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(0.061, 16, 11),
      markerMaterial,
    ), `material-marker-on-single-steering-rope-${index + 1}`);
    root.add(marker);
    return marker;
  });
  const buildContinuousRopeCurve = (routes) => {
    const points = [];
    for (const point of routes.upper.points) appendPoint(points, point);
    for (let index = 1; index < helicalPoints.length; index += 1) {
      appendPoint(points, helicalPoints[index]);
    }
    const reversedLower = [...routes.lower.points].reverse();
    for (let index = 1; index < reversedLower.length; index += 1) {
      appendPoint(points, reversedLower[index]);
    }
    const curve = new THREE.CatmullRomCurve3(
      points,
      false,
      'centripetal',
    );
    curve.arcLengthDivisions = 600;
    ropePathState.curve = curve;
    ropePathState.pathLength = curve.getLength();
    ropePathState.points = points;
    return curve;
  };

  const updateRopeGeometry = (routes) => {
    const curve = buildContinuousRopeCurve(routes);
    const oldGeometry = rope.geometry;
    rope.geometry = new THREE.TubeGeometry(
      curve,
      220,
      ropeRadius,
      7,
      false,
    );
    oldGeometry.dispose();
    return curve;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    wheelAndBarrel.rotation.z = state.handwheelAngleRadian;
    upperGuide.rotating.rotation.z = state.upperGuideAngleRadian;
    lowerGuide.rotating.rotation.z = state.lowerGuideAngleRadian;
    tiller.rotation.z = state.tillerAngleRadian;
    const curve = updateRopeGeometry(state.routes);
    for (let index = 0; index < ropeMarkers.length; index += 1) {
      const progress = THREE.MathUtils.euclideanModulo(
        index / ropeMarkers.length
          + state.ropeDisplacement / ropePathState.pathLength,
        1,
      );
      ropeMarkers[index].position.copy(curve.getPointAt(progress));
      ropeMarkers[index].scale.setScalar(
        Math.sin(Math.PI * progress) ** 0.30,
      );
    }
  };

  const geometry = {
    cycleAngularFrequency,
    cycleDuration,
    drumAngleAmplitude,
    drumCenter,
    drumHalfWidth,
    drumRadius,
    guideRadius,
    helicalAngleSpan,
    lowerDrumContact,
    lowerGuideCenter,
    lowerRopePlaneZ,
    markerCount,
    maximumDifferentialExcursion,
    maximumTillerAngle,
    neutralDifferentialLength,
    ropeRadius,
    rudderCenter,
    tillerLength,
    upperDrumContact,
    upperGuideCenter,
    upperRopePlaneZ,
    visibleFullWrapCount,
    visibleWrapCount,
  };

  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'single-wound-steering-rope-over-two-guide-sheaves-driving-a-rudder-tiller',
    blocks: {
      barrel,
      barrelFlanges,
      deck,
      fixedShaft,
      handwheelIndex,
      handwheelRim,
      handwheelSpokes,
      lowerGuide,
      rope,
      ropeMarkers,
      rudderHead,
      squareRudderKey,
      tiller,
      tillerBar,
      tillerTipBoss,
      upperGuide,
      wheelAndBarrel,
      wheelPedestals,
    },
    branchRoutesAtTillerAngle,
    degreesOfFreedom: {
      independentOperatingCoordinates: 1,
      ropeBranchesIndependent: 0,
      tillerRotationConstrainedByDifferentialRopeLength: 1,
    },
    differentialDerivativeAtAngle,
    dynamics: {
      continuity:
        'There is exactly one Curve3 centerline and one tube mesh: upper tiller end to upper guide, continuous multi-turn barrel helix, lower guide, and lower tiller end. Every adjacent sampled section shares its endpoint.',
      historicalSlackDisclosure:
        'The ordinary unquadranted tiller layout does not keep the sum of its two free branch lengths perfectly constant at finite helm angle; the released branch accommodates the small geometric surplus, a known limitation that later steering slides addressed. Differential length and all no-slip rates remain exact.',
      markerContinuity:
        'White material markers use the signed analytic drum payout divided by current total path length and getPointAt arc-length sampling over the single uninterrupted rope curve, so transitions between free spans, guide arcs, and barrel turns are smooth.',
      sourceProjectionDisclosure:
        'Brown supplies a plan projection but no deck-height routing. The displayed coaxial plan-view extrusion preserves the topology and tangencies while separating the two rope planes axially so all turns remain inspectable.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'One rope begins at one side of the tiller-end boss, runs tangentially around the upper guide sheave, follows a common external tangent to the handwheel barrel, makes one continuous multi-turn helical wrap, leaves by the opposite barrel tangent, passes around the lower guide sheave, and terminates at the other side of the tiller-end boss. The handwheel and barrel are one rotor. Turning it winds one branch while paying out the other; the exact differential free-branch length determines tiller and rudder angle.',
    motion: {
      barrelAxis: new THREE.Vector3(0, 0, 1),
      guideAxes: [
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, 1),
      ],
      rudderAxis: new THREE.Vector3(0, 0, 1),
    },
    ropeConstruction: {
      helicalPoints,
      lowerDrumContact,
      lowerFixedGuideContact,
      upperDrumContact,
      upperFixedGuideContact,
    },
    ropePathState,
    solveTillerAngleForDifferential,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      reason:
        'The official Movement 490 HTML contains no animation library or canvas model and marks Animated unavailable.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate490: {
        approximateBarrelCenterPixels: [180, 280],
        approximateGuideCentersPixels: [218, 122, 218, 431],
        approximateRudderCenterPixels: [464, 282],
        approximateTillerEndPixels: [290, 284],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 9,
      },
      constructionEvidence: {
        ballantyneCorroboration:
          'R. M. Ballantyne describes the tiller as the lever moving the rudder and states that ropes and pulleys connect it to the drum of the steering wheel on large ships.',
        explicitInBrownDescription: [
          'the view is a plan of ordinary steering apparatus',
          'the handwheel shaft carries a rope-winding barrel',
          'one rope passes around guide pulleys',
          'the rope opposite ends attach to the tiller on the rudder',
          'wheel rotation winds one end while letting off the other',
          'the differential action turns the tiller in the corresponding direction',
        ],
        engravingEvidence:
          'Brown shows one handwheel and coaxial grooved barrel, exactly two guide pulleys, two free rope branches, one tiller lever, and one square-keyed rudder head.',
        imperialEncyclopaediaCorroboration:
          'The historical Imperial Encyclopaedia states that five turns of tiller rope were usually wound about the wheel barrel and that the middle turn was nailed to it.',
        reconstructionDisclosure:
          'The one-rope topology, wound barrel, two guides, tiller-end attachments, coaxial handwheel, wind-one/pay-out-the-other action, and rudder rotation are source-grounded. Exact dimensions, tangency choices, 5-plus-turn helical display, axial plane separation, maximum helm angle, smooth cycle, colors, and supports are independently engineered and exposed; the corroborating source’s middle fastening is recorded but not separately imposed on Brown’s schematic.',
      },
      ballantyneUrl:
        'https://www.gutenberg.org/files/21749/21749-h/21749-h.htm',
      brownBookScanUrl:
        'https://upload.wikimedia.org/wikipedia/commons/c/c3/Five_hundred_and_seven_mechanial_movements%2C_embracing_all_those_which_are_most_important_in_dynamics%2C_hydraulics%2C_hydrostatics%2C_pneumatics%2C_steam_engines%2C_mill_and_other_gearing_.._%28IA_fivehundredseven02brow%29.pdf',
      imperialEncyclopaediaUrl:
        'https://www.e-rara.ch/download/pdf/28670398.pdf',
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 490',
    },
    stateAtTime,
    transmission: {
      differentialConstraint:
        'L_lower(delta)-L_upper(delta)=DeltaL_0+2*r_barrel*theta_barrel',
      guideNoSlip:
        'abs(omega_guide)=abs(v_rope)/r_guide with v_rope=r_barrel*omega_barrel; signs follow each contacted guide arc',
      tillerRate:
        'delta_dot=2*r_barrel*theta_dot/(d(L_lower-L_upper)/d(delta))',
      wheelBarrelConstraint:
        'theta_handwheel=theta_barrel',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.83, -2.00, -1.14),
    new THREE.Vector3(3.45, 2.55, 1.00),
  );
  root.userData.cameraDistanceScale = 1.05;
  root.userData.cameraDirection = new THREE.Vector3(7.2, 6.5, 11.8);
  root.userData.groundFloorY = -2.00;
  markShadows(root);
  ropeMarkers.forEach((marker) => {
    marker.castShadow = false;
  });
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredRopeSteeringMovement(movement) {
  if (movement.id !== 490) return null;
  return ropeSteering(movement);
}
