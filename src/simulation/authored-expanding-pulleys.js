import {correctVariableFaceGear} from './variable-face-gear-parts.js';
import bakedClickRest from './generated-expanding-pulley-click.js';
import * as THREE from 'three';
import {capsule, circle, poly, polygonClipping, sector} from './finite-plate-geometry.js';
import {
  PALETTE,
  makeGear,
  makeShaft,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function unwrapNear(principalAngle, referenceAngle) {
  return principalAngle + FULL_TURN * Math.round(
    (referenceAngle - principalAngle) / FULL_TURN,
  );
}

function radialPoint(radius, angle) {
  return new THREE.Vector2(radius * Math.cos(angle), radius * Math.sin(angle));
}

function centeredExtrusion(shape, depth) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008,
    curveSegments: 2,
    depth,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function annularSegmentShape(innerRadius, outerRadius, halfAngle) {
  const shape = new THREE.Shape();
  const segments = 24;
  for (let index = 0; index <= segments; index += 1) {
    const angle = -halfAngle + 2 * halfAngle * index / segments;
    const point = radialPoint(outerRadius, angle);
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  }
  for (let index = segments; index >= 0; index -= 1) {
    const angle = -halfAngle + 2 * halfAngle * index / segments;
    const point = radialPoint(innerRadius, angle);
    shape.lineTo(point.x, point.y);
  }
  shape.closePath();
  return shape;
}

function quinticStep(u) {
  const t = Math.min(1, Math.max(0, u));
  return t * t * t * (10 + t * (-15 + 6 * t));
}

function quinticStepDerivative(u) {
  if (u <= 0 || u >= 1) return 0;
  return 30 * u * u * (1 - u) * (1 - u);
}

// Segmented pinion law: hold contracted, turn d forward three teeth (the
// click riding over them) a little past the seat, let the belt tension slip
// it back onto the click, hold expanded, lift the click by hand, turn d back
// three teeth and drop the click again.
const PULLEY_SCHEDULE = Object.freeze({
  expandStart: 0.06,
  expandEnd: 0.4,
  slipEnd: 0.45,
  liftStart: 0.56,
  liftEnd: 0.62,
  contractStart: 0.64,
  contractEnd: 0.9,
  lowerStart: 0.9,
  lowerEnd: 0.97,
});

function pinionLawAtFraction(u, contractedHold, travel, overshoot) {
  const s = PULLEY_SCHEDULE;
  const segment = (start, end, from, to) => {
    const span = end - start, v = (u - start) / span;
    return {angle: from + (to - from) * quinticStep(v), rate: (to - from) * quinticStepDerivative(v) / span};
  };
  if (u < s.expandStart) return {angle: contractedHold, rate: 0, stage: 'contracted-hold'};
  if (u < s.expandEnd) return {...segment(s.expandStart, s.expandEnd, contractedHold, contractedHold + travel + overshoot), stage: 'expanding-click-ratchets'};
  if (u < s.slipEnd) return {...segment(s.expandEnd, s.slipEnd, contractedHold + travel + overshoot, contractedHold + travel), stage: 'belt-tension-slips-back-onto-click'};
  if (u < s.contractStart) return {angle: contractedHold + travel, rate: 0, stage: u < s.liftStart ? 'expanded-hold' : 'click-lifted'};
  if (u < s.contractEnd) return {...segment(s.contractStart, s.contractEnd, contractedHold + travel, contractedHold), stage: 'contracting-click-held-clear'};
  return {angle: contractedHold, rate: 0, stage: u < s.lowerEnd ? 'click-lowered' : 'contracted-hold'};
}

function clickLiftAtFraction(u) {
  const s = PULLEY_SCHEDULE;
  if (u < s.liftStart || u >= s.lowerEnd) return 0;
  if (u < s.liftEnd) return quinticStep((u - s.liftStart) / (s.liftEnd - s.liftStart));
  if (u < s.lowerStart) return 1;
  return 1 - quinticStep((u - s.lowerStart) / (s.lowerEnd - s.lowerStart));
}

function expandingPulley(movement) {
  const root = new THREE.Group();
  const armCount = 6;
  const wheelTeeth = 32;
  const pinionTeeth = 10;
  const module = 0.096875;
  const wheelPitchRadius = module * wheelTeeth / 2;
  const pinionPitchRadius = module * pinionTeeth / 2;
  const gearCenterDistance = wheelPitchRadius + pinionPitchRadius;
  const slotMidRadius = 0.88;
  const slotSweep = 0.9;
  const slotRadialTravel = 0.62;
  const slotSlope = slotRadialTravel / slotSweep;
  const slotHalfWidth = 0.09;
  // Click e holds d against belt tension: d turns three teeth per stroke,
  // overshooting by the click's two-sided angular clearance before slipping
  // back onto it. The wheel's extremes stay inside the slot ends.
  const pinionPitchAngle = FULL_TURN / pinionTeeth;
  const pinionTravel = 3 * pinionPitchAngle;
  const clickAngularClearance = 0.012;
  const clickOvershoot = 2 * clickAngularClearance;
  const contractedPinionHold = -(pinionTravel + clickOvershoot) / 2;
  const clickDesignPinionAngle = contractedPinionHold + clickAngularClearance;
  const adjustmentAmplitude = -contractedPinionHold * pinionTeeth / wheelTeeth;
  const studRadius = 0.075;
  const studLength = 0.6;
  // Brown draws wheel c in front: the six arms slide behind it and their
  // studs project forward through its curved slots.
  const armZ = -0.55;
  const studCenterZ = -0.28;
  const rimMidRadius = 2.84;
  const rimInnerRadius = 2.76;
  const rimOuterRadius = 2.92;
  const rimHalfAngle = THREE.MathUtils.degToRad(24.5);
  const wheelAngularFrequency = 0.55;
  const cyclePeriod = FULL_TURN / wheelAngularFrequency;

  const stateAtPhase = (phase, phaseRate = wheelAngularFrequency) => {
    const fraction = positiveModulo(phase, FULL_TURN) / FULL_TURN;
    const law = pinionLawAtFraction(fraction, contractedPinionHold, pinionTravel, clickOvershoot);
    const wheelAngle = -law.angle * pinionTeeth / wheelTeeth;
    const wheelAngularSpeed = -law.rate / FULL_TURN * phaseRate * pinionTeeth / wheelTeeth;
    const radialOffset = -slotSlope * wheelAngle;
    const radialSpeed = -slotSlope * wheelAngularSpeed;
    const studRadius = slotMidRadius + radialOffset;
    const pulleyRadius = rimMidRadius + radialOffset;
    const pinionAngle = -wheelAngle * wheelTeeth / pinionTeeth;
    const pinionAngularSpeed = -wheelAngularSpeed * wheelTeeth / pinionTeeth;
    const slotStates = Array.from({ length: armCount }, (_, index) => {
      const guideAngle = index * FULL_TURN / armCount;
      const stud = radialPoint(studRadius, guideAngle);
      const cosine = Math.cos(-wheelAngle);
      const sine = Math.sin(-wheelAngle);
      const localStud = new THREE.Vector2(
        cosine * stud.x - sine * stud.y,
        sine * stud.x + cosine * stud.y,
      );
      const localAngle = unwrapNear(
        Math.atan2(localStud.y, localStud.x),
        guideAngle - wheelAngle,
      );
      const expectedLocalAngle = guideAngle - wheelAngle;
      const expectedRadius = slotMidRadius
        + slotSlope * (expectedLocalAngle - guideAngle);
      return {
        expectedLocalAngle,
        expectedRadius,
        guideAngle,
        localAngle,
        angularResidual: localAngle - expectedLocalAngle,
        guideResidual: Math.abs(
          stud.x * Math.sin(guideAngle) - stud.y * Math.cos(guideAngle)
        ),
        localRadius: localStud.length(),
        radialResidual: localStud.length() - expectedRadius,
        stud,
      };
    });
    const wheelContactPhase = (
      Math.PI / 2 - wheelAngle
    ) / (FULL_TURN / wheelTeeth);
    const pinionContactPhase = (
      -Math.PI / 2 - pinionAngle
    ) / (FULL_TURN / pinionTeeth);
    const meshPhaseSum = positiveModulo(
      wheelContactPhase + pinionContactPhase,
      1,
    );
    const wheelSurfaceSpeed = -wheelPitchRadius * wheelAngularSpeed;
    const pinionSurfaceSpeed = pinionPitchRadius * pinionAngularSpeed;
    const clickLift = clickLiftAtFraction(fraction);
    const clickRest = clickRestAtPinionAngle(pinionAngle);
    const clickAngle = Math.min(clickRest, clickRest * (1 - clickLift) + clickLiftedAngle * clickLift);
    return {
      clickAngle,
      clickLift,
      clickRest,
      clickSeated: clickLift === 0 && Math.abs(clickRest - clickSeatAngle) < 1e-9,
      fraction,
      stage: law.stage,
      gearNoSlipError: Math.abs(wheelSurfaceSpeed - pinionSurfaceSpeed),
      meshPhaseError: Math.abs(meshPhaseSum - 0.5),
      meshPhaseSum,
      phase,
      pinionAngle,
      pinionAngularSpeed,
      pulleyRadius,
      radialOffset,
      radialSpeed,
      slotStates,
      studRadius,
      wheelAngle,
      wheelAngularSpeed,
      wheelSurfaceSpeed,
      pinionSurfaceSpeed,
    };
  };
  // Replaced below, once d's finite tooth outline and click e exist.
  let clickRestAtPinionAngle = () => 0;
  let clickSeatAngle = 0;
  let clickLiftedAngle = 0;
  const stateAtTime = (time) => stateAtPhase(
    time * wheelAngularFrequency,
    wheelAngularFrequency,
  );

  const driverMaterial = matte(PALETTE.driver, { metalness: 0.13, roughness: 0.58 });
  const drivenMaterial = matte(PALETTE.driven, { metalness: 0.12, roughness: 0.61 });
  const frameMaterial = matte(PALETTE.frame, { metalness: 0.13, roughness: 0.66 });
  const darkMaterial = matte(PALETTE.ink, { metalness: 0.22, roughness: 0.49 });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.47 });
  // Pass 101: the arms and the rim segments were wheel c's blue, so the arms
  // vanished under c and against the rim. Three drawn parts, three tones:
  // c stays blue, the arms are light steel and the rim segments brass.
  const armMaterial = matte(0x9aa2a4, { metalness: 0.2, roughness: 0.52 });
  const rimMaterial = matte(PALETTE.brass, { metalness: 0.16, roughness: 0.56 });

  const wheelGear = makeGear({
    color: PALETTE.driven,
    depth: 0.22,
    radius: wheelPitchRadius,
    teeth: wheelTeeth,
    toothHeight: module * 2.05,
  });
  wheelGear.position.z = -0.2;
  wheelGear.userData.role = 'thirty-two-tooth-adjusting-wheel-c';
  root.add(wheelGear);

  const slotPlateShape = new THREE.Shape();
  slotPlateShape.absarc(0, 0, wheelPitchRadius * 0.88, 0, FULL_TURN, false);
  const slotSampleCount = 30;
  const slotPaths = [];
  for (let armIndex = 0; armIndex < armCount; armIndex += 1) {
    const baseAngle = armIndex * FULL_TURN / armCount;
    const hole = new THREE.Path();
    const centerline = [];
    for (let index = 0; index <= slotSampleCount; index += 1) {
      const offsetAngle = -slotSweep / 2 + slotSweep * index / slotSampleCount;
      const radius = slotMidRadius + slotSlope * offsetAngle;
      centerline.push(radialPoint(radius, baseAngle + offsetAngle));
      const point = radialPoint(radius + slotHalfWidth, baseAngle + offsetAngle);
      if (index === 0) hole.moveTo(point.x, point.y);
      else hole.lineTo(point.x, point.y);
    }
    for (let index = slotSampleCount; index >= 0; index -= 1) {
      const offsetAngle = -slotSweep / 2 + slotSweep * index / slotSampleCount;
      const radius = slotMidRadius + slotSlope * offsetAngle;
      const point = radialPoint(radius - slotHalfWidth, baseAngle + offsetAngle);
      hole.lineTo(point.x, point.y);
    }
    hole.closePath();
    slotPlateShape.holes.push(hole);
    slotPaths.push(centerline);
  }
  const slotPlate = new THREE.Mesh(centeredExtrusion(slotPlateShape, 0.18), drivenMaterial);
  slotPlate.position.z = 0.06;
  slotPlate.userData.cutThroughSlotCount = armCount;
  slotPlate.userData.role = 'wheel-c-with-six-real-spiral-slots';
  wheelGear.userData.rotor.add(slotPlate);

  const pinion = makeGear({
    color: PALETTE.driver,
    depth: 0.28,
    radius: pinionPitchRadius,
    teeth: pinionTeeth,
    toothHeight: module * 2.05,
  });
  pinion.position.set(0, gearCenterDistance, -0.18);
  pinion.userData.role = 'ten-tooth-hand-adjusting-pinion-d';
  root.add(pinion);

  const sliders = [];
  const studs = [];
  const rimSegments = [];
  const guides = [];
  for (let index = 0; index < armCount; index += 1) {
    const angle = index * FULL_TURN / armCount;
    const guide = new THREE.Group();
    guide.rotation.z = angle;
    const rails = [-0.105, 0.105].map((lateral) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.055, 0.12), frameMaterial);
      rail.position.set(1.52, lateral, 0.36);
      return rail;
    });
    guide.add(...rails);
    guide.userData.role = `fixed-radial-guide-${index}`;
    guides.push(guide);
    root.add(guide);

    const slider = new THREE.Group();
    slider.rotation.z = angle;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.16, 0.13), armMaterial);
    arm.position.set(1.72, 0, armZ);
    arm.userData.role = `pulley-arm-${index}`;
    const rim = new THREE.Mesh(
      centeredExtrusion(annularSegmentShape(rimInnerRadius, rimOuterRadius, rimHalfAngle), 0.2),
      rimMaterial,
    );
    rim.position.z = armZ;
    rim.userData.role = `expanding-pulley-rim-segment-${index}`;
    const stud = new THREE.Mesh(
      new THREE.CylinderGeometry(
        studRadius,
        studRadius,
        studLength,
        24,
      ),
      darkMaterial,
    );
    stud.rotation.x = Math.PI / 2;
    stud.position.set(slotMidRadius, 0, studCenterZ);
    stud.userData.role = `slot-captive-arm-stud-${index}`;
    const studCap = new THREE.Mesh(new THREE.SphereGeometry(0.084, 18, 12), whiteMaterial);
    studCap.position.set(slotMidRadius, 0, 0.53);
    slider.add(arm, rim, stud, studCap);
    sliders.push(slider);
    studs.push(stud);
    rimSegments.push(rim);
    root.add(slider);
  }

  const centerShaft = makeShaft({ axis: Z_AXIS, color: PALETTE.ink, length: 0.9, radius: 0.12 });
  centerShaft.position.z = -0.4;
  centerShaft.userData.role = 'expanding-pulley-main-shaft';
  root.add(centerShaft);
  const pinionShaft = makeShaft({ axis: Z_AXIS, color: PALETTE.ink, length: 0.62, radius: 0.09 });
  pinionShaft.position.set(0, gearCenterDistance, -0.25);
  pinionShaft.userData.role = 'pinion-d-adjusting-shaft';
  root.add(pinionShaft);

  // Click e: one flat plate in d's plane, pivoted to the right of d as on
  // the plate. Its geometry is cut below from d's finite teeth.
  const click = new THREE.Group();
  click.userData.role = 'click-e-holding-pinion-d';
  root.add(click);

  root.userData.archetype = 'six-arm-spiral-slot-expanding-pulley';
  root.userData.blocks = { centerShaft, click, guides, pinion, pinionShaft, rimSegments, sliders, slotPlate, studs, wheelGear };
  root.userData.cameraFitBounds = new THREE.Box3(new THREE.Vector3(-3.35, -3.35, -0.9), new THREE.Vector3(3.35, 3.35, 1));
  root.userData.canonicalTimes = { contracted: cyclePeriod * 0.02, expanded: cyclePeriod * 0.5, sourcePose: 0, cycleClosure: cyclePeriod, clickLifted: cyclePeriod * 0.63, contracting: cyclePeriod * 0.77, ratcheting: cyclePeriod * 0.23 };
  root.userData.fidelity = 'authored';
  root.userData.geometry = {
    adjustmentAmplitude,
    armCount,
    gearCenterDistance,
    module,
    pinionPitchRadius,
    pinionTeeth,
    rimMidRadius,
    slotEndArcClearance: (
      slotMidRadius - slotSlope * adjustmentAmplitude
    ) * (slotSweep / 2 - adjustmentAmplitude) - studRadius,
    slotHalfWidth,
    slotMidRadius,
    slotPaths,
    slotRadialTravel,
    slotSlope,
    slotSweep,
    studCenterZ,
    studLength,
    studRadius,
    wheelPitchRadius,
    wheelTeeth,
  };
  root.userData.mechanism = 'pinion-d-rotates-slotted-wheel-c-to-slide-six-pulley-arms-radially';
  root.userData.sourceAnimation = { available: false, independentlyReconstructed: true, reason: 'The official Movement 224 page marks its animation unavailable.', sourceUrl: movement.sourceUrl };
  root.userData.sourceReference = { officialDescription: movement.description, plate224: { imageHeight: 525, imageWidth: 525, inferredArmCount: 6, inferredPinionTeeth: pinionTeeth, inferredWheelTeeth: wheelTeeth, rasterMainCenter: new THREE.Vector2(263, 263), rasterPinionCenter: new THREE.Vector2(263, 118) }, sourceUrl: movement.sourceUrl };
  root.userData.stateAtPhase = stateAtPhase;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = { cyclePeriod, pinionToWheelRatio: -wheelTeeth / pinionTeeth, radialTravel: slotSlope * pinionTravel * pinionTeeth / wheelTeeth, reversibleAdjustment: true, holdingClick: 'e-on-pinion-d' };

  function buildClick() {
    const pinionShape = pinion.userData.rotor.children[0].geometry.parameters.shapes;
    const outline = pinionShape.getPoints().map((point) => [point.x, point.y]);
    const tipRadius = Math.max(...outline.map(([x, y]) => Math.hypot(x, y)));
    const rootRadius = Math.min(...outline.map(([x, y]) => Math.hypot(x, y)));
    const rotated = (angle) => outline.map(([x, y]) => [
      x * Math.cos(angle) - y * Math.sin(angle),
      x * Math.sin(angle) + y * Math.cos(angle),
    ]);
    // Plate 224: the click's pivot lies 1.06 d-tip-radii... measured as
    // (55.5, -3.5) px from d's centre with d's tips at 29.5 px, and its tip
    // enters the tooth space at about 64 degrees.
    const plateScale = tipRadius / 29.5;
    const plateTipAngle = THREE.MathUtils.degToRad(64);
    // Find the tooth space of d nearest that angle at the design pose.
    const designTeeth = rotated(clickDesignPinionAngle);
    const spaceWindow = sector(rootRadius * 0.5, tipRadius - 0.004, plateTipAngle - pinionPitchAngle, plateTipAngle + pinionPitchAngle, 96);
    const spaces = polygonClipping.difference(spaceWindow, [[[...designTeeth, designTeeth[0]]]]);
    let spaceAngle = plateTipAngle, best = Infinity;
    for (const piece of spaces) {
      const ring = piece[0];
      const angles = ring.map(([x, y]) => Math.atan2(y, x));
      const mid = (Math.min(...angles) + Math.max(...angles)) / 2;
      if (Math.abs(mid - plateTipAngle) < best && Math.max(...angles) - Math.min(...angles) < pinionPitchAngle) {
        best = Math.abs(mid - plateTipAngle);
        spaceAngle = mid;
      }
    }
    const turn = spaceAngle - plateTipAngle;
    const pivot = new THREE.Vector2(55.5, -3.5).multiplyScalar(plateScale).rotateAround(new THREE.Vector2(), turn);
    // Brown sets the pivot beside the 60-degree channel; centre it on that
    // channel's outer rail so its pin seats on the fixed rail.
    const railDirection = new THREE.Vector2(Math.cos(Math.PI / 3), Math.sin(Math.PI / 3));
    const railNormal = new THREE.Vector2(-railDirection.y, railDirection.x);
    const pivotWorld = pivot.clone().add(new THREE.Vector2(0, gearCenterDistance));
    pivot.addScaledVector(railNormal, 0.115 - pivotWorld.dot(railNormal));
    // The tip is d's own tooth space, shrunk by the angular clearance on
    // both flanks and standing just off the root, carried straight out past
    // the tip circle as a neck.
    const dilated = [-1, -0.5, 0, 0.5, 1].map((k) => {
      const ring = rotated(clickDesignPinionAngle + k * clickAngularClearance);
      return [[...ring, ring[0]]];
    });
    const teeth = polygonClipping.union(...dilated);
    const neckTop = tipRadius + 0.11;
    const tipPieces = polygonClipping.difference(
      sector(rootRadius + 0.006, tipRadius - 0.006, spaceAngle - pinionPitchAngle / 2, spaceAngle + pinionPitchAngle / 2, 96),
      teeth,
    ).filter((piece) => {
      const [x, y] = piece[0].reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]);
      return Math.abs(Math.atan2(y, x) - spaceAngle) < pinionPitchAngle / 4;
    });
    if (tipPieces.length !== 1) throw new Error('Click e tip must fill one tooth space');
    const topAngles = tipPieces[0][0]
      .filter(([x, y]) => Math.hypot(x, y) > tipRadius - 0.012)
      .map(([x, y]) => Math.atan2(y, x));
    const neckHalf = (Math.max(...topAngles) - Math.min(...topAngles)) / 2;
    // Brown's arm arches over d from the tip to the pivot boss; it tapers
    // smoothly from the space's full top width into the arm.
    const armHalfWidth = 0.065;
    const armStartRadius = tipRadius + 0.05;
    const bulgeAngle = (spaceAngle + Math.atan2(pivot.y, pivot.x)) / 2;
    const bulgeRadius = neckTop + 0.08;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(armStartRadius * Math.cos(spaceAngle), armStartRadius * Math.sin(spaceAngle), 0),
      new THREE.Vector3(neckTop * Math.cos(spaceAngle - 0.12), neckTop * Math.sin(spaceAngle - 0.12), 0),
      new THREE.Vector3(bulgeRadius * Math.cos(bulgeAngle), bulgeRadius * Math.sin(bulgeAngle), 0),
      new THREE.Vector3(pivot.x, pivot.y, 0),
    ]).getPoints(32);
    const hull = (points) => {
      const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const half = (list) => list.reduce((result, point) => {
        while (result.length > 1 && cross(result.at(-2), result.at(-1), point) <= 0) result.pop();
        result.push(point);
        return result;
      }, []);
      const lower = half(sorted), upper = half([...sorted].reverse());
      return poly([...lower.slice(0, -1), ...upper.slice(0, -1)]);
    };
    const neckBase = tipPieces[0][0].filter(([x, y]) => Math.hypot(x, y) > tipRadius - 0.025);
    // The arm is as broad as the space's mouth where it leaves the tip and
    // tapers to the boss.
    const mouthHalfWidth = neckHalf * tipRadius;
    const widthAt = (index) => THREE.MathUtils.lerp(mouthHalfWidth, armHalfWidth, Math.min(1, index / 14));
    const neck = hull([...neckBase, ...circle([curve[3].x, curve[3].y], widthAt(3), 24)]);
    const armPieces = curve.slice(1).map((point, index) => {
      const pieces = [capsule([curve[index].x, curve[index].y], [point.x, point.y], Math.min(widthAt(index), widthAt(index + 1)), 12)];
      return hull([...pieces[0][0][0], ...circle([curve[index].x, curve[index].y], widthAt(index), 16), ...circle([point.x, point.y], widthAt(index + 1), 16)]);
    });
    const bossRadius = 0.13;
    let outlinePolygons = polygonClipping.union(tipPieces, neck, ...armPieces, poly(circle([pivot.x, pivot.y], bossRadius, 64)));
    if (outlinePolygons.length !== 1) throw new Error('Click e must be one plate');
    const clickOutline = outlinePolygons[0][0].slice(0, -1).map(([x, y]) => new THREE.Vector2(x - pivot.x, y - pivot.y));
    const shape = new THREE.Shape(clickOutline);
    const pinRadius = 0.045;
    const bore = new THREE.Path();
    bore.absarc(0, 0, pinRadius, 0, FULL_TURN, true);
    shape.holes.push(bore);
    const clickDepth = 0.2;
    const clickMaterial = matte(PALETTE.accent, { metalness: 0.18, roughness: 0.57 });
    clickMaterial.fog = false;
    const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth: clickDepth, bevelEnabled: false, curveSegments: 32}).translate(0, 0, -clickDepth / 2), clickMaterial);
    plate.userData.role = 'click-e-flat-plate';
    click.add(plate);
    click.position.set(pivot.x, gearCenterDistance + pivot.y, pinion.position.z);
    // The pivot pin runs back through the channel's front lip onto the face
    // of the fixed rail directly behind it.
    const pinBackZ = -0.47 - pinion.position.z;
    const pinFrontZ = clickDepth / 2 + 0.02;
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(pinRadius, pinRadius, pinFrontZ - pinBackZ, 24), darkMaterial);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(click.position.x, click.position.y, pinion.position.z + (pinFrontZ + pinBackZ) / 2);
    pin.userData.role = 'click-e-pivot-pin-in-guide-lip';
    root.add(pin);

    // Resting angle: e falls toward d until it touches d's finite teeth.
    // d has ten-fold symmetry, so tabulate one tooth pitch.
    const tipLocal = polygonClipping.union(tipPieces, neck)[0][0].slice(0, -1).map(([x, y]) => [x - pivot.x, y - pivot.y]);
    const densify = (ring, step) => ring.flatMap((a, i) => {
      const b = ring[(i + 1) % ring.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      return Array.from({length: n}, (_, k) => [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    });
    const tipPoints = densify(tipLocal, 0.004);
    const nearTeeth = outline.filter(([x, y]) => Math.hypot(x - Math.cos(spaceAngle) * rootRadius, y - Math.sin(spaceAngle) * rootRadius) < 0.75);
    const toothPoints = densify(nearTeeth, 0.004);
    const inside = (point, ring) => {
      let result = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > point[1]) !== (yj > point[1]) && point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi) result = !result;
      }
      return result;
    };
    // d's outline is star-shaped about its centre: tabulate its radius.
    const radiusSamples = 8192;
    let outlineRadius = null;
    const tabulateOutline = () => {
    outlineRadius = new Float64Array(radiusSamples);
    for (let k = 0; k < radiusSamples; k++) {
      const angle = k / radiusSamples * FULL_TURN, dx = Math.cos(angle), dy = Math.sin(angle);
      let far = 0;
      for (let i = 0; i < outline.length; i++) {
        const [ax, ay] = outline[i], [bx, by] = outline[(i + 1) % outline.length];
        const ex = bx - ax, ey = by - ay, det = ex * dy - ey * dx;
        if (Math.abs(det) < 1e-14) continue;
        const t = (dx * ay - dy * ax) / det, u = (ex * ay - ey * ax) / det;
        if (t >= 0 && t <= 1 && u > far) far = u;
      }
      outlineRadius[k] = far;
    }
    };
    const insidePinion = (x, y) => {
      if (!outlineRadius) tabulateOutline();
      const f = ((Math.atan2(y, x) / FULL_TURN) % 1 + 1) % 1 * radiusSamples;
      const i = Math.floor(f) % radiusSamples, w = f - Math.floor(f);
      return Math.hypot(x, y) < outlineRadius[i] * (1 - w) + outlineRadius[(i + 1) % radiusSamples] * w;
    };
    const tipXs = tipLocal.map((point) => point[0]), tipYs = tipLocal.map((point) => point[1]);
    const tipBox = [Math.min(...tipXs), Math.max(...tipXs), Math.min(...tipYs), Math.max(...tipYs)];
    const overlaps = (pinionAngle, clickAngle) => {
      const c = Math.cos(clickAngle), s = Math.sin(clickAngle), cp = Math.cos(-pinionAngle), sp = Math.sin(-pinionAngle);
      for (const [x, y] of tipPoints) {
        const wx = pivot.x + c * x - s * y, wy = pivot.y + s * x + c * y;
        if (insidePinion(cp * wx - sp * wy, sp * wx + cp * wy)) return true;
      }
      const cq = Math.cos(pinionAngle), sq = Math.sin(pinionAngle);
      for (const [x, y] of toothPoints) {
        const wx = cq * x - sq * y - pivot.x, wy = sq * x + cq * y - pivot.y;
        const lx = c * wx + s * wy, ly = -s * wx + c * wy;
        if (lx < tipBox[0] || lx > tipBox[1] || ly < tipBox[2] || ly > tipBox[3]) continue;
        if (inside([lx, ly], tipLocal)) return true;
      }
      return false;
    };
    const restAt = (pinionAngle) => {
      let low = -0.6, high = 0.15;
      if (!overlaps(pinionAngle, high)) return high;
      for (let i = 0; i < 18; i++) {
        const mid = (low + high) / 2;
        if (overlaps(pinionAngle, mid)) high = mid; else low = mid;
      }
      return low;
    };
    const samples = 240;
    const computeRestTable = () => {
      const result = Array.from({length: samples + 1}, (_, i) => restAt(clickDesignPinionAngle + pinionPitchAngle * (i / samples - 0.5)));
      result[samples] = result[0];
      return result;
    };
    // Baked offline by scripts/generate-expanding-pulley-click.mjs.
    const table = bakedClickRest.length === samples + 1 ? [...bakedClickRest] : computeRestTable();
    root.userData.computeClickRestTable = computeRestTable;
    clickRestAtPinionAngle = (pinionAngle) => {
      const x = (((pinionAngle - clickDesignPinionAngle) / pinionPitchAngle + 0.5) % 1 + 1) % 1 * samples;
      const i = Math.min(samples - 1, Math.floor(x)), f = x - i;
      // Linear interpolation between samples may graze a tooth corner;
      // stand off by a hair (0.0004 rad, under 0.0005 at the tip).
      return table[i] * (1 - f) + table[i + 1] * f - 0.0004;
    };
    clickSeatAngle = clickRestAtPinionAngle(contractedPinionHold);
    clickLiftedAngle = Math.min(...table) - 0.1;
    Object.assign(root.userData.geometry, {
      clickAngularClearance,
      clickBossRadius: bossRadius,
      clickDepth,
      clickDesignPinionAngle,
      clickLiftedAngle,
      clickOutline,
      clickPinRadius: pinRadius,
      clickPivot: pivot.clone().add(new THREE.Vector2(0, gearCenterDistance)),
      clickRestTable: table,
      clickSeatAngle,
      clickSpaceAngle: spaceAngle,
      clickTipOutline: tipLocal,
      contractedPinionHold,
      pinionOutline: outline,
      pinionPitchAngle,
      pinionTravel,
    });
    root.userData.clickOverlaps = overlaps;
    Object.assign(root.userData.blocks, {click, clickPin: pin, clickPlate: plate});
  }

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(wheelGear, state.wheelAngle);
    setSpin(centerShaft, state.wheelAngle);
    setSpin(pinion, state.pinionAngle);
    setSpin(pinionShaft, state.pinionAngle);
    click.rotation.z = state.clickAngle;
    sliders.forEach((slider) => { slider.position.set(Math.cos(slider.rotation.z) * state.radialOffset, Math.sin(slider.rotation.z) * state.radialOffset, 0); });
    wheelGear.userData.angularSpeed = state.wheelAngularSpeed;
    pinion.userData.angularSpeed = state.pinionAngularSpeed;
    root.userData.kinematics = state;
    root.userData.constraints = {
      gearNoSlipError: state.gearNoSlipError,
      maximumGuideResidual: Math.max(
        ...state.slotStates.map((slot) => slot.guideResidual),
      ),
      maximumSlotAngularResidual: Math.max(
        ...state.slotStates.map((slot) => Math.abs(slot.angularResidual)),
      ),
      maximumSlotRadialResidual: Math.max(
        ...state.slotStates.map((slot) => Math.abs(slot.radialResidual)),
      ),
      meshPhaseError: state.meshPhaseError,
    };
  };
  update(0);
  correctVariableFaceGear(root, 224);
  // Wheel c is one body: the raised slotted face now starts on the gear's
  // front face instead of overlapping the gear through its depth, and wears
  // the gear's material. The two used to share slot and bore walls through
  // 0.14 of depth and z-fought faintly (p88). The front face stays 0.04 proud.
  {
    const gearBody = wheelGear.userData.rotor.children[0];
    const gearFront = gearBody.geometry.boundingBox
      ?? (gearBody.geometry.computeBoundingBox(), gearBody.geometry.boundingBox);
    const plateFront = slotPlate.position.z + 0.09;
    const raisedDepth = plateFront - gearFront.max.z;
    const plateShapes = slotPlate.geometry.parameters.shapes;
    slotPlate.geometry.dispose();
    slotPlate.geometry = new THREE.ExtrudeGeometry(plateShapes, {
      bevelEnabled: false, curveSegments: 64, depth: raisedDepth,
    }).translate(0, 0, -raisedDepth / 2);
    slotPlate.position.z = gearFront.max.z + raisedDepth / 2;
    slotPlate.userData.raisedDepth = raisedDepth;
    slotPlate.material = gearBody.material;
  }
  // Move the shared guide channels behind wheel c with the arms, narrow the
  // front lips, and drop undrawn phase marks.
  const guideShift = armZ - 0.5;
  for (const guide of guides) {
    for (const [index, part] of guide.children.entries()) {
      part.position.z += guideShift;
      // Brown's channels run from wheel c's teeth out toward the rim.
      const size = part.geometry.parameters;
      part.geometry.dispose();
      part.geometry = new THREE.BoxGeometry(
        1.1,
        index >= 3 ? 0.05 : size.height,
        size.depth,
      );
      part.position.x = 1.85;
      if (index >= 3) part.position.y = Math.sign(part.position.y) * 0.108;
    }
  }
  buildClick();
  // p96: Brown carries d on a curved bearing strap spanning the two upper
  // arms' channels, its top edge an arc concentric with the pulley, just
  // inside the rim segments at their most contracted; its lower part lies
  // hidden behind c. It is a flat plate in the channels' plane whose side
  // edges run into the channel walls (0.12 off each channel's axis, inside
  // the 0.09-0.14 wall), and d's shaft ends in a bore through it.
  {
    let minimumOffset = Infinity;
    for (let index = 0; index <= 256; index += 1) minimumOffset = Math.min(minimumOffset, stateAtPhase(index / 256).radialOffset);
    const strapTop = rimInnerRadius + minimumOffset - 0.03, strapBottom = 1.72, wallOffset = 0.12;
    const band = sector(strapBottom, strapTop, Math.PI / 6, 5 * Math.PI / 6, 256);
    const side = (angle, sign) => {
      const u = [Math.cos(angle), Math.sin(angle)], n = [-u[1], u[0]], far = 4;
      const o = [n[0] * wallOffset * sign, n[1] * wallOffset * sign];
      return poly([[o[0], o[1]], [o[0] + u[0] * far, o[1] + u[1] * far], [o[0] + u[0] * far + n[0] * far * sign, o[1] + u[1] * far + n[1] * far * sign], [o[0] + n[0] * far * sign, o[1] + n[1] * far * sign]]);
    };
    const strapOutline = polygonClipping.difference(
      polygonClipping.intersection(band, side(Math.PI / 3, 1), side(2 * Math.PI / 3, -1)),
      poly(circle([0, gearCenterDistance], 0.095, 64)),
    );
    if (strapOutline.length !== 1) throw new Error('d strap must be one plate');
    const shape = new THREE.Shape(strapOutline[0][0].slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y)));
    for (const ring of strapOutline[0].slice(1)) shape.holes.push(new THREE.Path(ring.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y))));
    const strapDepth = 0.1, strapZ = -0.55;
    const strap = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth: strapDepth, bevelEnabled: false, curveSegments: 64}).translate(0, 0, strapZ - strapDepth / 2), frameMaterial);
    strap.userData.role = 'fixed-curved-bearing-strap-carrying-pinion-d';
    root.add(strap);
    Object.assign(root.userData.blocks, {pinionStrap: strap});
    Object.assign(root.userData.geometry, {pinionStrapBottomRadius: strapBottom, pinionStrapTopRadius: strapTop, pinionStrapZ: [strapZ - strapDepth / 2, strapZ + strapDepth / 2]});
  }
  update(0);
  for (const slider of sliders) slider.children[3].visible = false;
  // p96: each arm's inner end is a round boss concentric with its slot stud
  // (the stud used to sit on the arm's square end).
  for (const slider of sliders) {
    const arm = slider.children[0], p = arm.geometry.parameters, outer = arm.position.x + p.width / 2, halfWidth = p.height / 2;
    const armOutline = polygonClipping.union(
      poly([[slotMidRadius, -halfWidth], [outer, -halfWidth], [outer, halfWidth], [slotMidRadius, halfWidth]]),
      poly(circle([slotMidRadius, 0], 0.12, 64)),
    );
    const armShape = new THREE.Shape(armOutline[0][0].slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y)));
    arm.geometry.dispose();
    arm.geometry = new THREE.ExtrudeGeometry(armShape, {depth: p.depth, bevelEnabled: false, curveSegments: 64}).translate(0, 0, -p.depth / 2);
    arm.position.x = 0;
  }
  wheelGear.userData.rotor.children[3].visible = false;
  pinion.userData.rotor.children[3].visible = false;
  markShadows(root);
  return { root, update, cameraDirection: new THREE.Vector3(1.6, -2, 12) };
}

export function createAuthoredExpandingPulleyMovement(movement) {
  if (movement.id === 224) return expandingPulley(movement);
  return null;
}
