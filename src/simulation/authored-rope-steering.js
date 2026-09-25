import * as THREE from 'three';
import {LaidRopeGeometry, replaceWithLaidRope} from './laid-rope.js';
import {correctSteeringSolids} from './steering-spatial-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;

// In Brown's plan the wheel is edge-on: its rim reads as a bar and the
// turned handles project beyond it at each spoke. The very narrow view keeps
// the wheel edge-on at the left of the frame instead of opening it into an
// ellipse.
function addHandwheelHandles(root) {
  const blocks = root.userData.blocks;
  const rim = blocks.handwheelRim;
  const rimRadius = rim.geometry.parameters.radius;
  const tube = rim.geometry.parameters.tube;
  const profile = [
    [0.050, 0], [0.050, 0.08], [0.085, 0.20], [0.070, 0.34],
    [0.055, 0.42], [0.075, 0.50], [0.060, 0.56], [0.001, 0.58],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geometry = new THREE.LatheGeometry(profile, 24)
    .translate(0, rimRadius + tube * 0.5, 0);
  blocks.handwheelHandles = blocks.handwheelSpokes.map((spoke, index) => {
    const handle = new THREE.Mesh(index ? geometry.clone() : geometry, rim.material);
    handle.userData.role = `turned-handwheel-handle-${index + 1}`;
    handle.rotation.x = index * Math.PI / 4;
    handle.position.x = rim.position.x;
    rim.parent.add(handle);
    return handle;
  });
  const bounds = root.userData.cameraFitBounds;
  bounds.min.y = Math.min(bounds.min.y, -3.45);
  bounds.max.y = Math.max(bounds.max.y, 3.45);
  bounds.min.z = Math.min(bounds.min.z, -3.1);
  bounds.max.z = Math.max(bounds.max.z, 3.1);
  root.userData.cameraDirection.set(-0.6, 0.35, 16);
  root.userData.cameraFov = 8;
}

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
  for (let index = 0; steps > 0 && index <= steps; index += 1) {
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
  const drumCenter = new THREE.Vector2(-1.67, 0);
  const drumRadius = 0.44;
  const drumHalfWidth = 0.46;
  const guideRadius = 0.44;
  const upperGuideCenter = new THREE.Vector2(-1.03, 2.63);
  const lowerGuideCenter = new THREE.Vector2(-1.03, -2.52);
  const rudderCenter = new THREE.Vector2(3.07, 0);
  const tillerLength = 2.90;
  const maximumTillerAngle = THREE.MathUtils.degToRad(25);
  const cycleDuration = 8;
  const cycleAngularFrequency = FULL_TURN / cycleDuration;
  const upperRopePlaneZ = drumRadius;
  const lowerRopePlaneZ = drumRadius;
  const ropeRadius = 0.025;
  const visibleFullWrapCount = 5;

  // The barrel axis lies across the plan (X), unlike the guide axes (Z).
  // Both free branches leave the front barrel generator, at opposite axial ends.
  const upperDrumContact = new THREE.Vector2(drumCenter.x - .33, drumCenter.y);
  const lowerDrumContact = new THREE.Vector2(drumCenter.x + .33, drumCenter.y);
  const upperFixedGuideContact = tangentPointFromExternalPoint(
    upperGuideCenter, guideRadius, upperDrumContact, -1);
  const lowerFixedGuideContact = tangentPointFromExternalPoint(
    lowerGuideCenter, guideRadius, lowerDrumContact, 1);
  const upperDrumContactAngle = Math.PI / 2;
  const helicalAngleSpan = visibleFullWrapCount * FULL_TURN;
  const visibleWrapCount = visibleFullWrapCount;

  const tillerTipAtAngle = (angleRadian) => new THREE.Vector2(
    rudderCenter.x - tillerLength * Math.cos(angleRadian),
    rudderCenter.y - tillerLength * Math.sin(angleRadian),
  );

  const routeFromAttachmentToDrum = ({
    attachment,
    attachmentTangentSide,
    drumContact,
    fixedGuideContact,
    guideCenter,
    ropePlaneZ,
    includePoints,
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
      steps: includePoints ? 18 : 0,
      z: ropePlaneZ,
    });
    const points = [];
    if (includePoints) {
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
    }
    const straightLength = attachment.distanceTo(attachmentGuideContact)
      + fixedGuideContact.distanceTo(drumContact);
    return {
      attachment: attachment.clone(),
      arcDelta: arc.arcDelta,
      attachmentGuideContact,
      branchLength: straightLength + guideRadius * Math.abs(arc.arcDelta),
      fixedGuideContact: fixedGuideContact.clone(),
      points,
    };
  };

  const branchRoutesAtTillerAngle = (tillerAngleRadian, includePoints = true) => {
    const attachment = tillerTipAtAngle(tillerAngleRadian);
    const offset = new THREE.Vector2(-Math.sin(tillerAngleRadian), Math.cos(tillerAngleRadian)).multiplyScalar(.12);
    const upperAttachment = attachment.clone().add(offset);
    const lowerAttachment = attachment.clone().sub(offset);
    const upper = routeFromAttachmentToDrum({
      attachment: upperAttachment,
      attachmentTangentSide: 1,
      drumContact: upperDrumContact,
      fixedGuideContact: upperFixedGuideContact,
      guideCenter: upperGuideCenter,
      ropePlaneZ: upperRopePlaneZ,
      includePoints,
    });
    const lower = routeFromAttachmentToDrum({
      attachment: lowerAttachment,
      attachmentTangentSide: -1,
      drumContact: lowerDrumContact,
      fixedGuideContact: lowerFixedGuideContact,
      guideCenter: lowerGuideCenter,
      ropePlaneZ: lowerRopePlaneZ,
      includePoints,
    });
    return {
      attachment,
      differentialLength: lower.branchLength - upper.branchLength,
      lower,
      totalFreeBranchLength: lower.branchLength + upper.branchLength,
      upper,
    };
  };

  // Equal slack bows retain one fixed-length rope without assigning an
  // unsupported tension/friction law to the ordinary unquadranted tiller.
  const freeRopeLength = .03 + Math.max(...Array.from({length:513}, (_, i) =>
    branchRoutesAtTillerAngle(maximumTillerAngle * (2*i/512-1), false).totalFreeBranchLength));
  const bowSamples = Array.from({length:65}, (_, i) => ({
    slope: Math.PI * Math.sin(2*Math.PI*i/64), weight: i===0||i===64 ? 1 : i%2 ? 4 : 2,
  }));
  const bowedLength = (distance, amplitude) => bowSamples.reduce((sum, q) =>
    sum + q.weight * Math.hypot(distance, amplitude*q.slope), 0) / 192;
  const bowAmplitude = (distance, extra) => {
    let low=0,high=1;
    while(bowedLength(distance,high)<distance+extra)high*=2;
    for(let i=0;i<32;i++){const mid=(low+high)/2;
      if(bowedLength(distance,mid)<distance+extra)low=mid;else high=mid;}
    return (low+high)/2;
  };
  const neutralRoutes = branchRoutesAtTillerAngle(0);
  const neutralDifferentialLength = neutralRoutes.differentialLength;
  const positiveExtremeRoutes = branchRoutesAtTillerAngle(
    maximumTillerAngle,
  );
  const maximumDifferentialExcursion =
    Math.abs(positiveExtremeRoutes.differentialLength - neutralDifferentialLength);
  const drumAngleAmplitude =
    maximumDifferentialExcursion / (2 * drumRadius);

  const solveTillerAngleForDifferential = (targetDifferentialLength) => {
    let low = -maximumTillerAngle;
    let high = maximumTillerAngle;
    const increasing = branchRoutesAtTillerAngle(high, false).differentialLength
      > branchRoutesAtTillerAngle(low, false).differentialLength;
    for (let iteration = 0; iteration < 64; iteration += 1) {
      const middle = (low + high) / 2;
      const difference = branchRoutesAtTillerAngle(middle, false)
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
      branchRoutesAtTillerAngle(angleRadian + step, false).differentialLength
      - branchRoutesAtTillerAngle(angleRadian - step, false).differentialLength
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
      // The grooved rim is the sheave itself, not a black tyre.
      drivenMaterial,
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

  const axialLead = (lowerDrumContact.x - upperDrumContact.x) / helicalAngleSpan;
  const entrySlope = -drumRadius * (upperDrumContact.x - upperFixedGuideContact.x)
    / (upperDrumContact.y - upperFixedGuideContact.y);
  const exitSlope = -drumRadius * (lowerFixedGuideContact.x - lowerDrumContact.x)
    / (lowerFixedGuideContact.y - lowerDrumContact.y);
  const transition = Math.PI / 2;
  const hermite = (a, b, da, db, u) => (2*u**3-3*u*u+1)*a
    +(u**3-2*u*u+u)*da+(-2*u**3+3*u*u)*b+(u**3-u*u)*db;
  const helicalPoints = Array.from({ length: 241 }, (_, index) => {
    const theta = helicalAngleSpan * index / 240;
    const angle = upperDrumContactAngle + theta;
    let x = upperDrumContact.x + axialLead * theta;
    if (theta < transition) x = hermite(upperDrumContact.x,
      upperDrumContact.x + axialLead * transition, entrySlope * transition,
      axialLead * transition, theta / transition);
    if (theta > helicalAngleSpan - transition) x = hermite(
      lowerDrumContact.x - axialLead * transition, lowerDrumContact.x,
      axialLead * transition, exitSlope * transition,
      (theta - helicalAngleSpan + transition) / transition);
    return new THREE.Vector3(x, drumCenter.y + drumRadius * Math.cos(angle),
      drumRadius * Math.sin(angle));
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
  // Brown hatches the tiller rope as a laid rope: the shared three-strand
  // rope, whose lay travels with the drum payout (no painted markers).
  const rope = addRole(new THREE.Mesh(
    new LaidRopeGeometry(
      new THREE.LineCurve3(
        new THREE.Vector3(),
        new THREE.Vector3(0.001, 0, 0),
      ),
      420,
      ropeRadius,
      7,
      false,
    ),
    ropeMaterial,
  ), 'one-continuous-tiller-rope-including-both-branches-and-barrel-wraps');
  rope.userData.isBelt = false;
  rope.userData.isSingleContinuousRope = true;
  root.add(rope);
  const buildContinuousRopeCurve = (routes) => {
    const points = [];
    const slack = (freeRopeLength-routes.totalFreeBranchLength)/2;
    const bowedBranch = route => {
      const [start,end] = route.points;
      const amplitude=bowAmplitude(start.distanceTo(end),slack), result=[];
      for(let i=0;i<=32;i++){
        const u=i/32,point=start.clone().lerp(end,u);
        point.z+=amplitude*Math.sin(Math.PI*u)**2;
        result.push(point);
      }
      result.push(...route.points.slice(2));
      return result;
    };
    for (const point of bowedBranch(routes.upper)) appendPoint(points, point);
    for (let index = 1; index < helicalPoints.length; index += 1) {
      appendPoint(points, helicalPoints[index]);
    }
    const reversedLower = bowedBranch(routes.lower).reverse();
    for (let index = 1; index < reversedLower.length; index += 1) {
      appendPoint(points, reversedLower[index]);
    }
    const curve = new THREE.CatmullRomCurve3(
      points,
      false,
      'centripetal',
    );
    curve.arcLengthDivisions = 1400;
    ropePathState.curve = curve;
    ropePathState.pathLength = curve.getLength();
    ropePathState.points = points;
    return curve;
  };

  const updateRopeGeometry = (routes, travel) => {
    const curve = buildContinuousRopeCurve(routes);
    replaceWithLaidRope(rope, curve, {
      radius: ropeRadius,
      travel,
      tubularSegments: 420,
      radialSegments: 7,
    });
    return curve;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    wheelAndBarrel.rotation.x = state.handwheelAngleRadian;
    upperGuide.rotating.rotation.z = state.upperGuideAngleRadian;
    lowerGuide.rotating.rotation.z = state.lowerGuideAngleRadian;
    tiller.rotation.z = state.tillerAngleRadian;
    updateRopeGeometry(state.routes, state.ropeDisplacement);
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
    maximumDifferentialExcursion,
    maximumTillerAngle,
    neutralDifferentialLength,
    ropeRadius,
    freeRopeLength,
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
      targetCycleDuration: cycleDuration,
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
        'There is exactly one Curve3 centerline and one laid-rope mesh: upper tiller end to upper guide, continuous multi-turn barrel helix, lower guide, and lower tiller end. Every adjacent sampled section shares its endpoint.',
      historicalSlackDisclosure:
        'The ordinary unquadranted tiller does not keep its taut branch-length sum constant. Reconstructed equal smooth slack bows preserve the ideal fixed free-rope length and differential payout. Bow shape and imposed guide rotation do not solve tension, friction or axial creep on the barrel.',
      layTravel:
        'The rope is the shared three-strand laid rope. Its lay phase advances by the signed analytic drum payout, measured by arc length along the single uninterrupted rope curve, so the visible twist moves smoothly through free spans, guide arcs, and barrel turns without painted markers.',
      sourceProjectionDisclosure:
        'The barrel and handwheel share the across-plan X shaft; guide and rudder axes are Z. Both branches meet the front barrel generator and a five-turn helix joins them with reconstructed axial lead transitions. Depths, supports, tension and axial creep are inferred.',
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'One rope begins at one side of the tiller-end boss, runs tangentially around the upper guide sheave, follows a common external tangent to the handwheel barrel, makes one continuous multi-turn helical wrap, leaves by the opposite barrel tangent, passes around the lower guide sheave, and terminates at the other side of the tiller-end boss. The handwheel and barrel are one rotor. Turning it winds one branch while paying out the other; the exact differential free-branch length determines tiller and rudder angle.',
    motion: {
      barrelAxis: new THREE.Vector3(1, 0, 0),
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
          'The one-rope topology, wound barrel, two guides, tiller-end attachments, coaxial handwheel, wind-one/pay-out-the-other action, and rudder rotation are source-grounded. Exact dimensions, tangency choices, five-turn helical display, spatial exit routing, maximum helm angle, smooth cycle, colors, and supports are independently engineered and exposed; the corroborating source’s middle fastening is recorded but not separately imposed on Brown’s schematic.',
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
  root.userData.hideGround = true;
  root.traverse(object => {
    for (const material of object.material ? [].concat(object.material) : []) material.fog = false;
  });
  correctSteeringSolids(root);
  addHandwheelHandles(root);
  root.userData.minimumDisplayCycleSeconds=cycleDuration;
  markShadows(root);
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
