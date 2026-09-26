import { correctGoingBarrel } from './maintaining-clock-parts.js';
import {
  circle,
  plate,
  poly,
  polygonClipping,
} from './finite-plate-geometry.js';
import * as THREE from 'three';
import { replaceWithLaidRope } from './laid-rope.js';
import {
  PALETTE,
  makeBeam,
  makeGear,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherstep(value) {
  return value ** 3 * (value * (value * 6 - 15) + 10);
}

function smootherstepFirst(value) {
  return 30 * value ** 2 * (1 - value) ** 2;
}

function smootherstepSecond(value) {
  return 60 * value * (1 - value) * (1 - 2 * value);
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function makeRatchetShape(outerRadius, innerRadius, toothCount) {
  const shape = new THREE.Shape();
  const pitch = FULL_TURN / toothCount;
  let first = true;
  for (let tooth = 0; tooth < toothCount; tooth += 1) {
    for (const sample of [
      { offset: -0.50, radius: outerRadius * 0.82 },
      { offset: -0.35, radius: outerRadius },
      { offset: 0.38, radius: outerRadius * 0.94 },
      { offset: 0.50, radius: outerRadius * 0.82 },
    ]) {
      const angle = tooth * pitch + sample.offset * pitch;
      const x = Math.cos(angle) * sample.radius;
      const y = Math.sin(angle) * sample.radius;
      if (first) {
        shape.moveTo(x, y);
        first = false;
      } else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  if (innerRadius > 0) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
    shape.holes.push(hole);
  }
  return shape;
}

function makeRatchetMesh({
  color,
  depth,
  innerRadius = 0,
  outerRadius,
  role,
  toothCount,
}) {
  const geometry = new THREE.ExtrudeGeometry(
    makeRatchetShape(outerRadius, innerRadius, toothCount),
    { bevelEnabled: false, depth },
  );
  geometry.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(
    geometry,
    matte(color, { metalness: 0.14, roughness: 0.60 }),
  );
  mesh.userData.role = role;
  mesh.userData.toothCount = toothCount;
  return mesh;
}

function makeRotor(role) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.userData.axis = Z_AXIS.clone();
  root.userData.role = role;
  root.userData.rotor = rotor;
  return root;
}

function setRotorAngle(root, angle) {
  root.userData.rotor.rotation.z = angle;
}

function makePawl({ color, contact, pivot, role, z }) {
  const root = new THREE.Group();
  root.position.set(pivot.x, pivot.y, z);
  root.userData.role = role;
  const displacement = contact.clone().sub(pivot);
  const length = displacement.length();
  const baseAngle = Math.atan2(displacement.y, displacement.x);
  const material = matte(color, { metalness: 0.16, roughness: 0.52 });
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(length, 0.14, 0.13),
    material,
  );
  body.position.x = length / 2;
  body.userData.role = `${role}-body`;
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.30, 4),
    material,
  );
  tip.position.x = length;
  tip.rotation.z = -Math.PI / 2;
  tip.userData.role = `${role}-tip`;
  const pin = cylinderAlongZ(
    0.14,
    0.28,
    matte(PALETTE.ink, { metalness: 0.24, roughness: 0.44 }),
    24,
  );
  pin.userData.role = `${role}-pivot`;
  root.add(body, tip, pin);
  root.rotation.z = baseAngle;

  const relative = displacement.clone();
  const plus = relative.clone().rotateAround(
    new THREE.Vector2(),
    0.01,
  ).add(pivot).length();
  const minus = relative.clone().rotateAround(
    new THREE.Vector2(),
    -0.01,
  ).add(pivot).length();
  root.userData.baseAngle = baseAngle;
  root.userData.contact = contact.clone();
  root.userData.length = length;
  root.userData.liftSign = plus >= minus ? 1 : -1;
  root.userData.pivot = pivot.clone();
  return markShadows(root);
}

function setBoxBetween(box, start, end) {
  const displacement = end.clone().sub(start);
  box.position.copy(start).add(end).multiplyScalar(0.5);
  box.rotation.z = Math.atan2(displacement.y, displacement.x);
  box.scale.x = displacement.length();
}

function harrisonGoingBarrel(movement) {
  const root = new THREE.Group();

  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterCenter = new THREE.Vector2(239, 242);
  const sourceRasterFrameClickPivotT = new THREE.Vector2(479, 47);
  const sourceRasterFrameClickContactT = new THREE.Vector2(181, 80);
  const sourceRasterCarriedClickPivotR = new THREE.Vector2(369, 269);
  const sourceRasterCarriedClickContactR = new THREE.Vector2(293, 320);
  const sourceRasterOuterSpringAnchorSPrime = new THREE.Vector2(65, 208);
  const sourceRasterInnerSpringAnchorS = new THREE.Vector2(162, 132);
  const sourceRasterWeightCenter = new THREE.Vector2(173, 487);
  const sourceScale = 0.0145;

  const demonstrationPeriod = 8;
  // Going fills most of the cycle. Winding takes an eighth: G runs 45
  // degrees ahead of the held larger ratchet, which Brown's short curved
  // wire S-S' takes up by opening its hairpin (a quarter turn would need a
  // wire longer than the chord between its anchors). The spring recovers in
  // the last twelfth, as the re-engaged weight quickly recharges it.
  // Winding starts on a whole tooth of the larger ratchet (19 of 24) so T
  // seats, and the short recovery keeps the weight near its wound height at
  // the plate pose (see below).
  const windingStartPhase = 19 / 24;
  const windingEndPhase = 22 / 24;
  const greatWheelToothCount = 48;
  const greatWheelPitchRadius = 2.95;
  const largeRatchetToothCount = 24;
  const largeRatchetPitchRadius = Math.hypot(
    (sourceRasterFrameClickContactT.x - sourceRasterCenter.x) * sourceScale,
    (sourceRasterFrameClickContactT.y - sourceRasterCenter.y) * sourceScale,
  );
  const largeRatchetOuterRadius = largeRatchetPitchRadius * 1.025;
  const largeRatchetInnerRadius = 1.50;
  const barrelRatchetToothCount = 12;
  const barrelRatchetPitchRadius = Math.hypot(
    (sourceRasterCarriedClickContactR.x - sourceRasterCenter.x) * sourceScale,
    (sourceRasterCarriedClickContactR.y - sourceRasterCenter.y) * sourceScale,
  );
  const barrelFaceRadius = 1.02;
  // Each cycle the weight falls one drum turn and winding lifts it back.
  // Brown hangs it just under G (his box top is 13 px below G's lowest
  // teeth), so the plate pose must be close to the wound top of travel. The
  // plate pose (t = 0) is the moment R has re-engaged after winding. Between
  // the end of winding and then, B turns only the winding lag plus G's
  // recovery advance (5/24 of a turn), so the small drum (0.2, just
  // outside the bored barrel arbor) lifts the weight 0.26 above its plate
  // height. The weight's top hangs 0.34 below G's tips at the plate pose
  // (Brown: 0.19 below his slightly smaller G) and stays 0.08 clear of them
  // at the top of its travel.
  const ropeDrumPitchRadius = 0.20;
  const weightHalfHeight = 0.45;
  const greatWheelTipClearanceY = -3.12;
  const windingOvershootAngle = FULL_TURN * (1 - windingStartPhase);
  const referenceWeightY = greatWheelTipClearanceY - weightHalfHeight
    - ropeDrumPitchRadius * windingOvershootAngle;
  const weightX = -ropeDrumPitchRadius;
  const springOuterAnchorRadius = 2.60;
  const springInnerAnchorRadius = 1.98;
  const springOuterBaseAngle = Math.atan2(0.50, -2.55);
  const springInnerBaseAngle = Math.atan2(1.65, -1.10);
  // Brown draws S-S' as one curved wire, not a coil: from S' on G it runs
  // in toward the arbor with a gentle S-bend, turns in a hairpin over the
  // lower left of B and comes back out to S on the larger ratchet. The
  // angular position along the wire is monotone (so it can never cross
  // itself) and eases in at both anchors; the hairpin's depth is solved each
  // frame so the wire keeps one material length. When T holds the larger
  // ratchet and G runs ahead, the hairpin opens and shallows; it closes
  // again as R re-engages.
  const springSegmentCount = 240;
  const springWireRadius = 0.035;
  const springPreload = 2.20;
  const springStiffness = 0.60;
  const springHairpinExponent = 3;
  const springReferenceDepth = 1.62;
  const springBendAmplitude = 0.08;
  const goingLoadTorque = 0.30;
  const largeRatchetLagMaximum = FULL_TURN
    * (windingEndPhase - windingStartPhase);
  const greatWheelAngularVelocity = FULL_TURN / demonstrationPeriod;
  const largeRatchetToothPitch = FULL_TURN / largeRatchetToothCount;
  const barrelRatchetToothPitch = FULL_TURN / barrelRatchetToothCount;

  const springSweep = (greatWheelAngle, largeRatchetAngle) =>
    springInnerBaseAngle + largeRatchetAngle
    - springOuterBaseAngle - greatWheelAngle;
  // u runs from S' (0) to S (1). The angular fraction is nearly flat along
  // each leg, so the legs leave their anchors almost radially as Brown
  // draws, and turns quickly at the bottom; with the flat-bottomed dip this
  // gives the rounded U of the plate rather than a sharp V. A small angular
  // wave puts Brown's S-bend in the leg from S'.
  const springAngleSteepness = 6;
  const springAngleFraction = (u) => 0.5
    + 0.5 * Math.tanh(springAngleSteepness * (u - 0.5))
      / Math.tanh(springAngleSteepness / 2);
  const springBendAt = (u) => (u < 0.5
    ? springBendAmplitude * Math.sin(FULL_TURN * u / 0.5)
    : 0);
  const springRadiusAt = (u) => springOuterAnchorRadius
    + (springInnerAnchorRadius - springOuterAnchorRadius) * u
    - springReferenceDepth
      * (1 - Math.abs(2 * u - 1) ** springHairpinExponent);
  const springAnchorsAt = (greatWheelAngle, sweep) => {
    const outerAngle = springOuterBaseAngle + greatWheelAngle;
    const innerAngle = outerAngle + sweep;
    return [
      new THREE.Vector2(Math.cos(outerAngle), Math.sin(outerAngle))
        .multiplyScalar(springOuterAnchorRadius),
      new THREE.Vector2(Math.cos(innerAngle), Math.sin(innerAngle))
        .multiplyScalar(springInnerAnchorRadius),
    ];
  };
  // opening 0 is Brown's hairpin; opening 1 is the straight chord between
  // the anchors. Both pass through the anchors, so every blend does too.
  const springPointAt = (u, greatWheelAngle, sweep, opening) => {
    if (u <= 0 || u >= 1) {
      const anchor = springAnchorsAt(greatWheelAngle, sweep)[u <= 0 ? 0 : 1];
      return new THREE.Vector3(anchor.x, anchor.y, 1.16);
    }
    const angle = springOuterBaseAngle + greatWheelAngle
      + sweep * springAngleFraction(u) + springBendAt(u);
    const radius = springRadiusAt(u);
    const [outer, inner] = springAnchorsAt(greatWheelAngle, sweep);
    const chord = outer.lerp(inner, u);
    return new THREE.Vector3(
      THREE.MathUtils.lerp(Math.cos(angle) * radius, chord.x, opening),
      THREE.MathUtils.lerp(Math.sin(angle) * radius, chord.y, opening),
      1.16,
    );
  };
  const springLengthSamples = 2048;
  const springLength = (sweep, opening) => {
    let length = 0;
    let previous = springPointAt(0, 0, sweep, opening);
    for (let index = 1; index <= springLengthSamples; index += 1) {
      const point = springPointAt(index / springLengthSamples, 0, sweep,
        opening);
      length += point.distanceTo(previous);
      previous = point;
    }
    return length;
  };
  const springReferenceSweep = springSweep(0, 0);
  const springMaterialLength = springLength(springReferenceSweep, 0);

  const springGeometryAtAngles = (greatWheelAngle, largeRatchetAngle) => {
    const sweep = springSweep(greatWheelAngle, largeRatchetAngle);
    // When G runs ahead of the held ratchet the hairpin would lengthen, so
    // it opens toward the chord just enough to keep the material length.
    let opening = 0;
    if (springLength(sweep, 0) > springMaterialLength) {
      let low = 0;
      let high = 1;
      if (springLength(sweep, high) > springMaterialLength) {
        throw new RangeError('The fixed-length maintaining spring cannot reach both anchors.');
      }
      for (let iteration = 0; iteration < 64; iteration += 1) {
        const middle = (low + high) / 2;
        if (springLength(sweep, middle) > springMaterialLength) low = middle;
        else high = middle;
      }
      opening = (low + high) / 2;
    } else if (springLength(sweep, 0) < springMaterialLength - 1e-9) {
      throw new RangeError('The maintaining spring is never shorter than Brown\'s hairpin.');
    }
    const cumulative = new Float64Array(springLengthSamples + 1);
    let previous = springPointAt(0, greatWheelAngle, sweep, opening);
    let minimumRadius = Math.hypot(previous.x, previous.y);
    for (let index = 1; index <= springLengthSamples; index += 1) {
      const point = springPointAt(index / springLengthSamples,
        greatWheelAngle, sweep, opening);
      cumulative[index] = cumulative[index - 1] + point.distanceTo(previous);
      minimumRadius = Math.min(minimumRadius, Math.hypot(point.x, point.y));
      previous = point;
    }
    const measuredLength = cumulative[springLengthSamples];
    const parameterAtMaterialFraction = (fraction) => {
      const target = THREE.MathUtils.clamp(fraction, 0, 1)
        * cumulative[springLengthSamples];
      let lower = 0;
      let upper = springLengthSamples;
      while (upper - lower > 1) {
        const middle = Math.floor((lower + upper) / 2);
        if (cumulative[middle] < target) lower = middle;
        else upper = middle;
      }
      const interval = cumulative[upper] - cumulative[lower];
      const local = interval > 1e-15
        ? (target - cumulative[lower]) / interval
        : 0;
      return (lower + local) / springLengthSamples;
    };
    return {
      opening,
      minimumRadius,
      sweep,
      materialLength: springMaterialLength,
      measuredLength,
      pointAtMaterialFraction: (fraction) => {
        if (fraction <= 0) return springPointAt(0, greatWheelAngle, sweep, opening);
        if (fraction >= 1) return springPointAt(1, greatWheelAngle, sweep, opening);
        return springPointAt(parameterAtMaterialFraction(fraction),
          greatWheelAngle, sweep, opening);
      },
    };
  };

  const kinematicStateAtTime = (time) => {
    const cycleIndex = Math.floor(time / demonstrationPeriod);
    const localTime = time - cycleIndex * demonstrationPeriod;
    const phase = localTime / demonstrationPeriod;
    const greatWheelAngle = cycleIndex * FULL_TURN + FULL_TURN * phase;
    let largeRatchetLocalAngle;
    let largeRatchetPhaseRate;
    let largeRatchetPhaseAcceleration;
    let barrelAngle;
    let barrelPhaseRate;
    let barrelPhaseAcceleration;
    let mode;

    if (phase <= windingStartPhase) {
      largeRatchetLocalAngle = FULL_TURN * phase;
      largeRatchetPhaseRate = FULL_TURN;
      largeRatchetPhaseAcceleration = 0;
      barrelAngle = FULL_TURN * phase;
      barrelPhaseRate = FULL_TURN;
      barrelPhaseAcceleration = 0;
      mode = 'going-weight-drives-B-through-R-spring-and-G';
    } else if (phase <= windingEndPhase) {
      const windingProgress = (
        phase - windingStartPhase
      ) / (windingEndPhase - windingStartPhase);
      const shaped = smootherstep(windingProgress);
      const shapedFirst = smootherstepFirst(windingProgress);
      const shapedSecond = smootherstepSecond(windingProgress);
      largeRatchetLocalAngle = FULL_TURN * windingStartPhase;
      largeRatchetPhaseRate = 0;
      largeRatchetPhaseAcceleration = 0;
      barrelAngle = FULL_TURN * windingStartPhase - FULL_TURN * shaped;
      barrelPhaseRate = -FULL_TURN * shapedFirst
        / (windingEndPhase - windingStartPhase);
      barrelPhaseAcceleration = -FULL_TURN * shapedSecond
        / (windingEndPhase - windingStartPhase) ** 2;
      mode = 'winding-B-backward-R-ratcheting-T-holds-spring-drives-G';
    } else {
      const recoveryProgress = (
        phase - windingEndPhase
      ) / (1 - windingEndPhase);
      const shaped = smootherstep(recoveryProgress);
      const shapedFirst = smootherstepFirst(recoveryProgress);
      const shapedSecond = smootherstepSecond(recoveryProgress);
      const greatLocalAngle = FULL_TURN * phase;
      const lag = largeRatchetLagMaximum * (1 - shaped);
      largeRatchetLocalAngle = greatLocalAngle - lag;
      largeRatchetPhaseRate = FULL_TURN
        + largeRatchetLagMaximum * shapedFirst
          / (1 - windingEndPhase);
      largeRatchetPhaseAcceleration = largeRatchetLagMaximum
        * shapedSecond / (1 - windingEndPhase) ** 2;
      barrelAngle = largeRatchetLocalAngle - FULL_TURN;
      barrelPhaseRate = largeRatchetPhaseRate;
      barrelPhaseAcceleration = largeRatchetPhaseAcceleration;
      mode = 'post-winding-R-reengaged-weight-recharges-spring';
    }
    const largeRatchetAngle = cycleIndex * FULL_TURN
      + largeRatchetLocalAngle;
    const phaseRateToTime = 1 / demonstrationPeriod;
    const largeRatchetAngularVelocity = largeRatchetPhaseRate
      * phaseRateToTime;
    const largeRatchetAngularAcceleration = largeRatchetPhaseAcceleration
      * phaseRateToTime ** 2;
    const barrelAngularVelocity = barrelPhaseRate * phaseRateToTime;
    const barrelAngularAcceleration = barrelPhaseAcceleration
      * phaseRateToTime ** 2;
    const relativeSpringRotation = largeRatchetAngle - greatWheelAngle;
    const springDeflection = springPreload + relativeSpringRotation;
    const springTorque = springStiffness * springDeflection;
    const springEnergy = 0.5 * springStiffness * springDeflection ** 2;
    const isWinding = phase > windingStartPhase
      && phase <= windingEndPhase;
    const springGeometry = springGeometryAtAngles(
      greatWheelAngle,
      largeRatchetAngle,
    );

    const clickRToothProgress = positiveModulo(
      (largeRatchetAngle - barrelAngle) / barrelRatchetToothPitch,
      1,
    );
    const clickTToothProgress = positiveModulo(
      largeRatchetAngle / largeRatchetToothPitch,
      1,
    );
    const clickRLift = isWinding
      ? 0.115 * Math.sin(Math.PI * clickRToothProgress) ** 4
      : 0;
    const clickTLift = isWinding
      ? 0
      : 0.095 * Math.sin(Math.PI * clickTToothProgress) ** 4;
    return {
      barrelAngle,
      barrelAngularAcceleration,
      barrelAngularVelocity,
      clickRLift,
      clickRMode: isWinding
        ? 'ratcheting-over-reversing-barrel-teeth'
        : 'engaged-transmitting-weight-torque',
      clickRToothProgress,
      clickTLift,
      clickTMode: isWinding
        ? 'engaged-holding-large-ratchet-against-fallback'
        : 'ratcheting-forward-over-large-ratchet',
      clickTToothProgress,
      cycleIndex,
      greatWheelAngle,
      greatWheelAngularAcceleration: 0,
      greatWheelAngularVelocity,
      isWinding,
      largeRatchetAngle,
      largeRatchetAngularAcceleration,
      largeRatchetAngularVelocity,
      mode,
      phase,
      powerSource: isWinding
        ? 'stored-maintaining-spring-S-S-prime'
        : 'descending-weight-through-barrel-B-and-click-R',
      relativeSpringRotation,
      ropeTravel: ropeDrumPitchRadius * barrelAngle,
      springDeflection,
      springEnergy,
      springGeometry,
      springTorque,
      weightAcceleration: -ropeDrumPitchRadius
        * barrelAngularAcceleration,
      weightPosition: new THREE.Vector3(
        weightX,
        referenceWeightY - ropeDrumPitchRadius * barrelAngle,
        1.48,
      ),
      weightVelocity: -ropeDrumPitchRadius * barrelAngularVelocity,
    };
  };

  const clickRPivot = new THREE.Vector2(
    (sourceRasterCarriedClickPivotR.x - sourceRasterCenter.x) * sourceScale,
    -(sourceRasterCarriedClickPivotR.y - sourceRasterCenter.y) * sourceScale,
  );
  const clickRContact = new THREE.Vector2(
    (sourceRasterCarriedClickContactR.x - sourceRasterCenter.x) * sourceScale,
    -(sourceRasterCarriedClickContactR.y - sourceRasterCenter.y) * sourceScale,
  );
  const clickTPivot = new THREE.Vector2(
    (sourceRasterFrameClickPivotT.x - sourceRasterCenter.x) * sourceScale,
    -(sourceRasterFrameClickPivotT.y - sourceRasterCenter.y) * sourceScale,
  );
  const clickTContact = new THREE.Vector2(
    (sourceRasterFrameClickContactT.x - sourceRasterCenter.x) * sourceScale,
    -(sourceRasterFrameClickContactT.y - sourceRasterCenter.y) * sourceScale,
  );

  const greatWheel = makeGear({
    axis: Z_AXIS,
    color: PALETTE.driven,
    depth: 0.30,
    radius: greatWheelPitchRadius,
    teeth: greatWheelToothCount,
    toothHeight: 0.18,
  });
  greatWheel.position.z = -0.28;
  greatWheel.userData.role = 'great-going-wheel-G';
  // Brown draws G plain: drop the generic gear's decorative face ring (it
  // stood into the larger ratchet) and its white face index bar.
  for (const part of [...greatWheel.userData.rotor.children]) {
    if (part.geometry?.type === 'TorusGeometry'
      || (part.geometry?.type === 'BoxGeometry'
        && part.material?.color?.getHex() === PALETTE.white)) {
      greatWheel.userData.rotor.remove(part);
      part.geometry.dispose();
    }
  }
  const greatIndexMaterial = matte(PALETTE.white, { roughness: 0.48 });
  const greatWheelIndices = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = index * FULL_TURN / 6;
    const marker = cylinderAlongZ(0.075, 0.08, greatIndexMaterial, 14);
    marker.position.set(
      Math.cos(angle) * 2.62,
      Math.sin(angle) * 2.62,
      0.19,
    );
    marker.userData.role = 'great-wheel-G-symmetric-rotation-index';
    greatWheel.userData.rotor.add(marker);
    greatWheelIndices.push(marker);
  }

  const largeRatchet = makeRotor('larger-ratchet-wheel');
  const largeRatchetMesh = makeRatchetMesh({
    color: PALETTE.accent,
    depth: 0.19,
    innerRadius: largeRatchetInnerRadius,
    outerRadius: largeRatchetOuterRadius,
    role: 'larger-ratchet-wheel-held-by-T',
    toothCount: largeRatchetToothCount,
  });
  largeRatchet.userData.rotor.add(largeRatchetMesh);
  const ringRim = new THREE.Mesh(
    new THREE.TorusGeometry(largeRatchetInnerRadius, 0.065, 9, 72),
    matte(PALETTE.ink, { metalness: 0.16, roughness: 0.50 }),
  );
  ringRim.userData.role = 'larger-ratchet-inner-rim';
  ringRim.visible = false; // Brown's inner edge line only: kept, not drawn
  ringRim.userData.retiredInkOutline = true;
  largeRatchet.userData.rotor.add(ringRim);

  const barrel = makeRotor('weight-going-barrel-B');
  barrel.position.z = 0.29;
  const barrelBody = cylinderAlongZ(
    barrelFaceRadius,
    0.43,
    matte(PALETTE.driver, { metalness: 0.11, roughness: 0.65 }),
    56,
  );
  barrelBody.userData.role = 'barrel-B-face-and-weight-drum-flange';
  const ropeDrum = cylinderAlongZ(
    ropeDrumPitchRadius,
    0.64,
    matte(PALETTE.ink, { metalness: 0.22, roughness: 0.48 }),
    36,
  );
  ropeDrum.userData.role = 'narrow-weight-rope-drum-on-barrel-B';
  const barrelRatchet = makeRatchetMesh({
    color: PALETTE.driver,
    depth: 0.16,
    outerRadius: barrelRatchetPitchRadius * 1.04,
    role: 'small-ratchet-fixed-to-barrel-B',
    toothCount: barrelRatchetToothCount,
  });
  barrelRatchet.position.z = 0.50;
  const barrelHub = cylinderAlongZ(
    0.22,
    1.10,
    matte(PALETTE.ink, { metalness: 0.26, roughness: 0.42 }),
    28,
  );
  barrelHub.userData.role = 'common-going-barrel-arbor';
  barrel.userData.rotor.add(
    barrelBody,
    ropeDrum,
    barrelRatchet,
    barrelHub,
  );
  const barrelIndices = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = index * FULL_TURN / 6;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 12, 9),
      greatIndexMaterial,
    );
    marker.position.set(
      Math.cos(angle) * 0.72,
      Math.sin(angle) * 0.72,
      0.60,
    );
    marker.userData.role = 'barrel-B-symmetric-rotation-index';
    barrel.userData.rotor.add(marker);
    barrelIndices.push(marker);
  }

  const clickR = makePawl({
    color: PALETTE.ink,
    contact: clickRContact,
    pivot: clickRPivot,
    role: 'click-R-carried-by-larger-ratchet',
    z: 1.30,
  });
  largeRatchet.userData.rotor.add(clickR);
  const clickT = makePawl({
    color: PALETTE.ink,
    contact: clickTContact,
    pivot: clickTPivot,
    role: 'fixed-frame-click-T',
    z: 0.26,
  });

  const springMaterial = matte(PALETTE.ink, {
    metalness: 0.16,
    roughness: 0.56,
  });
  // One continuous round wire, rebuilt in place each frame along the hairpin.
  const springSides = 10;
  const springRingCount = springSegmentCount + 1;
  const springPositions = new Float32Array(springRingCount * springSides * 3);
  const springNormals = new Float32Array(springRingCount * springSides * 3);
  const springIndices = [];
  for (let ring = 0; ring < springSegmentCount; ring += 1) {
    for (let side = 0; side < springSides; side += 1) {
      const a = ring * springSides + side;
      const b = ring * springSides + (side + 1) % springSides;
      const c = a + springSides;
      const d = b + springSides;
      // Counterclockwise seen from outside, matching the outward normals.
      springIndices.push(a, b, c, b, d, c);
    }
  }
  const springWireGeometry = new THREE.BufferGeometry();
  springWireGeometry.setAttribute('position',
    new THREE.BufferAttribute(springPositions, 3));
  springWireGeometry.setAttribute('normal',
    new THREE.BufferAttribute(springNormals, 3));
  springWireGeometry.setIndex(springIndices);
  const springWire = new THREE.Mesh(springWireGeometry, springMaterial);
  springWire.userData.role = 'maintaining-spring-S-S-prime-curved-wire';
  springWire.frustumCulled = false;
  root.add(springWire);
  const springSegments = [springWire];
  const shapeSpringWire = (springGeometry) => {
    const points = Array.from({ length: springRingCount }, (_, index) =>
      springGeometry.pointAtMaterialFraction(index / springSegmentCount));
    for (let ring = 0; ring < springRingCount; ring += 1) {
      const before = points[Math.max(0, ring - 1)];
      const after = points[Math.min(springSegmentCount, ring + 1)];
      const tangentX = after.x - before.x;
      const tangentY = after.y - before.y;
      const tangentLength = Math.hypot(tangentX, tangentY) || 1;
      const normalX = -tangentY / tangentLength;
      const normalY = tangentX / tangentLength;
      for (let side = 0; side < springSides; side += 1) {
        const phi = side / springSides * FULL_TURN;
        const nx = Math.cos(phi) * normalX;
        const ny = Math.cos(phi) * normalY;
        const nz = Math.sin(phi);
        const offset = (ring * springSides + side) * 3;
        springPositions[offset] = points[ring].x + springWireRadius * nx;
        springPositions[offset + 1] = points[ring].y + springWireRadius * ny;
        springPositions[offset + 2] = points[ring].z + springWireRadius * nz;
        springNormals[offset] = nx;
        springNormals[offset + 1] = ny;
        springNormals[offset + 2] = nz;
      }
    }
    springWireGeometry.attributes.position.needsUpdate = true;
    springWireGeometry.attributes.normal.needsUpdate = true;
    springWireGeometry.computeBoundingSphere();
    springWireGeometry.computeBoundingBox();
  };
  const springMarkers = Array.from({ length: 5 }, (_, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 12, 9),
      matte(PALETTE.white, { roughness: 0.48 }),
    );
    marker.userData.materialCoordinate = (index + 1) / 6;
    marker.userData.role = 'maintaining-spring-material-index';
    root.add(marker);
    return marker;
  });
  const springOuterAnchor = cylinderAlongZ(
    0.11,
    0.24,
    matte(PALETTE.ink, { metalness: 0.20, roughness: 0.48 }),
    20,
  );
  springOuterAnchor.position.set(
    Math.cos(springOuterBaseAngle) * springOuterAnchorRadius,
    Math.sin(springOuterBaseAngle) * springOuterAnchorRadius,
    1.44,
  );
  springOuterAnchor.userData.role = 'spring-outer-anchor-S-prime-on-G';
  greatWheel.userData.rotor.add(springOuterAnchor);
  const springInnerAnchor = cylinderAlongZ(
    0.11,
    0.24,
    springOuterAnchor.material,
    20,
  );
  springInnerAnchor.position.set(
    Math.cos(springInnerBaseAngle) * springInnerAnchorRadius,
    Math.sin(springInnerBaseAngle) * springInnerAnchorRadius,
    1.16,
  );
  springInnerAnchor.userData.role = 'spring-inner-anchor-S-on-larger-ratchet';
  largeRatchet.userData.rotor.add(springInnerAnchor);

  // The weight's back face stays just in front of the spring's plane when
  // winding lifts it past the hairpin.
  const weight = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, weightHalfHeight * 2, 0.56),
    matte(PALETTE.driver, { metalness: 0.08, roughness: 0.74 }),
  );
  weight.userData.role = 'driving-weight-on-barrel-B';
  // Brown's weight cord is one laid rope: wound 1.7 turns-worth of arc on
  // the drum's exposed front groove, then hanging straight to the weight.
  const rope = new THREE.Mesh(
    new THREE.BufferGeometry(),
    matte(PALETTE.belt, { roughness: 0.78 }),
  );
  rope.userData.role = 'single-weight-rope-wound-on-barrel-B';
  rope.userData.crossSection = 'laid-rope';
  const ropeContact = new THREE.Vector3(
    weightX,
    0,
    1.48,
  );

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-clock-frame-and-T-bearing';
  fixedFrame.add(
    makeBeam(
      new THREE.Vector3(-3.75, 3.45, -0.60),
      new THREE.Vector3(3.85, 3.45, -0.60),
      { color: PALETTE.frame, depth: 0.28, thickness: 0.20 },
    ),
    makeBeam(
      new THREE.Vector3(3.48, 3.45, -0.60),
      new THREE.Vector3(3.48, 2.83, -0.60),
      { color: PALETTE.frame, depth: 0.24, thickness: 0.16 },
    ),
  );
  const rearBearing = cylinderAlongZ(
    0.34,
    0.35,
    matte(PALETTE.frame, { metalness: 0.16, roughness: 0.58 }),
    32,
  );
  rearBearing.position.z = -0.63;
  rearBearing.userData.role = 'fixed-coaxial-going-barrel-bearing';
  fixedFrame.add(rearBearing);

  root.add(
    fixedFrame,
    greatWheel,
    largeRatchet,
    barrel,
    clickT,
    rope,
    weight,
  );

  const pawlTipPosition = (pawl, parentAngle, lift) => {
    const pivot = pawl.userData.pivot;
    const displacement = pawl.userData.contact.clone().sub(pivot)
      .rotateAround(
        new THREE.Vector2(),
        pawl.userData.liftSign * lift,
      );
    const local = pivot.clone().add(displacement);
    return local.rotateAround(new THREE.Vector2(), parentAngle);
  };

  const stateAtTime = (time) => {
    const state = kinematicStateAtTime(time);
    const clickRTip2 = pawlTipPosition(
      clickR,
      state.largeRatchetAngle,
      state.clickRLift,
    );
    const clickTTip2 = pawlTipPosition(clickT, 0, state.clickTLift);
    return {
      ...state,
      contacts: {
        R: {
          active: !state.isWinding,
          clearance: clickRTip2.length() - barrelRatchetPitchRadius,
          point: new THREE.Vector3(clickRTip2.x, clickRTip2.y, 1.30),
          ratcheting: state.isWinding,
        },
        T: {
          activeHold: state.isWinding,
          clearance: clickTTip2.length() - largeRatchetPitchRadius,
          point: new THREE.Vector3(clickTTip2.x, clickTTip2.y, 0.26),
          ratchetingForward: !state.isWinding,
        },
      },
      rope: {
        freeLength: ropeContact.y
          - (state.weightPosition.y + 0.45),
        pitchRadius: ropeDrumPitchRadius,
        slipError: state.weightPosition.y - referenceWeightY
          + ropeDrumPitchRadius * state.barrelAngle,
        topContact: ropeContact.clone(),
        weightAttachment: state.weightPosition.clone().add(
          new THREE.Vector3(0, 0.45, 0),
        ),
      },
    };
  };

  const ropeRadius = 0.035;
  const ropeWrapPoints = Array.from({ length: 65 }, (_, i) => {
    const angle = Math.PI - 1.7 * Math.PI * (64 - i) / 64;
    return new THREE.Vector3(
      ropeDrumPitchRadius * Math.cos(angle),
      ropeDrumPitchRadius * Math.sin(angle),
      ropeContact.z,
    );
  });
  const ropeWrapCurve = new THREE.CatmullRomCurve3(ropeWrapPoints);
  const shapeRope = (state) => {
    const path = new THREE.CurvePath();
    path.add(ropeWrapCurve);
    path.add(new THREE.LineCurve3(
      state.rope.topContact.clone(),
      state.rope.weightAttachment.clone(),
    ));
    // The lay moves with the rope as the barrel pays it out.
    replaceWithLaidRope(rope, path, {
      radius: ropeRadius,
      travel: ropeDrumPitchRadius * state.barrelAngle,
      tubularSegments: 256,
    });
  };
  const update = (time) => {
    const state = stateAtTime(time);
    setRotorAngle(greatWheel, state.greatWheelAngle);
    setRotorAngle(largeRatchet, state.largeRatchetAngle);
    setRotorAngle(barrel, state.barrelAngle);
    clickR.rotation.z = clickR.userData.baseAngle
      + clickR.userData.liftSign * state.clickRLift;
    clickT.rotation.z = clickT.userData.baseAngle
      + clickT.userData.liftSign * state.clickTLift;
    weight.position.copy(state.weightPosition);
    shapeRope(state);
    shapeSpringWire(state.springGeometry);
    for (const marker of springMarkers) {
      marker.position.copy(state.springGeometry.pointAtMaterialFraction(
        marker.userData.materialCoordinate,
      ));
      marker.position.z += 0.03;
    }
    root.userData.contacts = state.contacts;
    root.userData.renderState = state;
    root.userData.updateClockInterfaces?.(state);
  };

  const sourcePointToReferenceFront = (point) => new THREE.Vector3(
    (point.x - sourceRasterCenter.x) * sourceScale,
    -(point.y - sourceRasterCenter.y) * sourceScale,
    0,
  );

  root.userData.archetype =
    'harrison-spring-maintaining-power-going-barrel';
  root.userData.blocks = {
    barrel,
    barrelBody,
    barrelHub,
    barrelIndices,
    barrelRatchet,
    clickR,
    clickT,
    fixedFrame,
    greatWheel,
    greatWheelIndices,
    largeRatchet,
    largeRatchetMesh,
    rope,
    ropeDrum,
    springInnerAnchor,
    springMarkers,
    springOuterAnchor,
    springSegments,
    weight,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.85, -4.60, -1.05),
    new THREE.Vector3(4.00, 3.60, 1.55),
  );
  root.userData.canonicalTimes = {
    cycleClosure: demonstrationPeriod,
    goingMidStroke: demonstrationPeriod * windingStartPhase / 2,
    windingBegins: demonstrationPeriod * windingStartPhase,
    windingMidStroke: demonstrationPeriod
      * (windingStartPhase + windingEndPhase) / 2,
    windingEnds: demonstrationPeriod * windingEndPhase,
    springRecoveryMidStroke: demonstrationPeriod * (windingEndPhase + 1) / 2,
  };
  root.userData.geometry = {
    barrelFaceRadius,
    barrelRatchetPitchRadius,
    barrelRatchetToothCount,
    barrelRatchetToothPitch,
    demonstrationPeriod,
    goingLoadTorque,
    greatWheelAngularVelocity,
    greatWheelPitchRadius,
    greatWheelToothCount,
    largeRatchetInnerRadius,
    largeRatchetLagMaximum,
    largeRatchetOuterRadius,
    largeRatchetPitchRadius,
    largeRatchetToothCount,
    largeRatchetToothPitch,
    springBendAmplitude,
    springHairpinExponent,
    springReferenceDepth,
    springWireRadius,
    referenceWeightY,
    ropeDrumPitchRadius,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    springInnerAnchorRadius,
    springMaterialLength,
    springOuterAnchorRadius,
    springPreload,
    springSegmentCount,
    springStiffness,
    windingEndPhase,
    windingStartPhase,
  };
  root.userData.kinematicStateAtTime = kinematicStateAtTime;
  root.userData.mechanism =
    'weight unwinds barrel B and its small ratchet drives carried click R, the larger ratchet, preloaded spring S–S′, and great wheel G; while B reverses to wind the weight, R clicks backward, fixed click T holds the larger ratchet, and the spring alone keeps G advancing';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'Brown supplies coaxial barrel B, its small ratchet, carried click R, the larger ratchet, fixed-frame click T, spring S–S′, outer great wheel G, and the weight cord. Tooth counts, spring stiffness and preload, drum depth, masses, and timing are not dimensioned.',
    sourceUrl: 'https://507movements.com/mm_321.html',
  };
  root.userData.sourcePointToReferenceFront = sourcePointToReferenceFront;
  root.userData.sourceReference = {
    brownPlate321: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'coaxial outer great wheel G, spring-coupled larger ratchet carrying R, small ratchet fixed to barrel B, fixed-frame holding click T, and one weight rope',
      measurementUncertaintyPixels: 11,
      rasterBarrelCenterB: sourceRasterCenter.clone(),
      rasterCarriedClickContactR:
        sourceRasterCarriedClickContactR.clone(),
      rasterCarriedClickPivotR: sourceRasterCarriedClickPivotR.clone(),
      rasterFrameClickContactT: sourceRasterFrameClickContactT.clone(),
      rasterFrameClickPivotT: sourceRasterFrameClickPivotT.clone(),
      rasterInnerSpringAnchorS: sourceRasterInnerSpringAnchorS.clone(),
      rasterOuterSpringAnchorSPrime:
        sourceRasterOuterSpringAnchorSPrime.clone(),
      rasterWeightCenter: sourceRasterWeightCenter.clone(),
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
  };
  root.userData.springGeometryAtAngles = springGeometryAtAngles;
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod,
    schedule: [
      'weight-descends-and-B-drives-carried-click-R',
      'larger-ratchet-loads-spring-S-S-prime-and-drives-G',
      'winding-reverses-B-and-lifts-the-weight',
      'R-ratchets-while-fixed-click-T-holds-the-larger-ratchet',
      'stored-spring-energy-keeps-G-advancing',
      'R-reengages-and-restores-the-spring-preload',
    ],
  };
  root.userData.transmission = {
    carriedClick: 'R is pivoted on the larger ratchet and engages the small ratchet fixed to B',
    fixedClick: 'T is pivoted in the frame and prevents the larger ratchet falling back during winding',
    goingPath: 'weight → barrel B → small ratchet → R → larger ratchet → spring S–S′ → great wheel G',
    outputContinuity: 'G has strictly positive constant angular velocity through going, winding, and spring recovery',
    ropeNoSlipLaw: 'weight displacement = -barrel angle × rope-drum pitch radius',
    springLaw: 'torque = stiffness × (preload + larger-ratchet angle - G angle)',
    windingPath: 'operator reverses B; R overruns, T holds the larger ratchet, and S–S′ alone supplies G',
  };

  correctGoingBarrel(root);
  // Brown draws no frame, bearing or stud: T turns on a short journal pin
  // through its eye, and the common arbor ends as a plain cut stub just
  // behind G, so no undrawn back bar is needed.
  {
    const { blocks } = root.userData;
    const clickT = blocks.finiteClicks.find((follower) => follower.name === 'T');
    const pinLength = 0.26;
    clickT.pin.geometry.dispose();
    clickT.pin.geometry = new THREE.CylinderGeometry(0.08, 0.08, pinLength, 32);
    clickT.pin.position.z = -0.01;
    root.updateMatrixWorld(true);
    const hubBox = new THREE.Box3().setFromObject(blocks.barrelHub);
    const wheelBox = new THREE.Box3().setFromObject(blocks.greatWheelBody);
    const arborBack = wheelBox.min.z - 0.08;
    const arborLength = hubBox.max.z - arborBack;
    blocks.barrelHub.geometry.dispose();
    blocks.barrelHub.geometry = new THREE.CylinderGeometry(0.14, 0.14, arborLength, 40);
    blocks.barrelHub.position.z += (hubBox.max.z + arborBack) / 2 - (hubBox.max.z + hubBox.min.z) / 2;
  }
  // The laid rope already runs round the exposed groove; the helper's
  // separate wrap stays only as a reference.
  root.userData.blocks.ropeWrap.visible = false;
  root.userData.blocks.ropeWrap.userData.retiredDuplicateRope = true;
  // The spring lies in front of barrel B, its small ratchet and click R, so
  // each anchor stands on a post from the wheel that carries it. S's post
  // rises from the larger ratchet's face. S' belongs to G, behind the
  // ratchet: its post comes up through an arc slot in the ratchet ring
  // (G runs up to 45 degrees ahead of the ratchet) clear of B's small
  // ratchet, then a short arm above the wire's plane reaches S'.
  {
    const postRadius = 0.07;
    // Both anchor pins are placed in their rotor's frame; the ratchet sits
    // at z = 0 and G behind it.
    const springPinBottomZ = largeRatchet.position.z
      + springInnerAnchor.position.z
      - springInnerAnchor.geometry.parameters.height / 2;
    const springPinTopZ = greatWheel.position.z
      + springOuterAnchor.position.z
      + springOuterAnchor.geometry.parameters.height / 2;
    const ratchetFrontZ = largeRatchet.position.z
      + largeRatchetMesh.position.z
      + largeRatchetMesh.userData.ratchetProfile.depth / 2;
    const innerPostLength = springPinBottomZ - ratchetFrontZ + 0.02;
    const innerPost = cylinderAlongZ(postRadius, innerPostLength,
      largeRatchetMesh.material, 20);
    innerPost.position.set(
      springInnerAnchor.position.x,
      springInnerAnchor.position.y,
      ratchetFrontZ - 0.01 + innerPostLength / 2 - largeRatchet.position.z,
    );
    innerPost.userData.role = 'spring-S-post-on-larger-ratchet';
    largeRatchet.userData.rotor.add(innerPost);

    const outerPostRadius = 1.66;
    const outerPostAngle = THREE.MathUtils.degToRad(192);
    const greatWheelFrontZ = greatWheel.position.z + 0.15;
    const armBottomZ = springPinTopZ - 0.01;
    const armDepth = 0.08;
    const outerPostTopZ = armBottomZ + armDepth;
    const outerPostLength = outerPostTopZ - greatWheelFrontZ + 0.02;
    const greatWheelLocalZ = (z) => z - greatWheel.position.z;
    const outerPost = cylinderAlongZ(postRadius, outerPostLength,
      greatWheel.userData.rotor.children[0].material, 20);
    const postPoint = new THREE.Vector2(
      Math.cos(outerPostAngle) * outerPostRadius,
      Math.sin(outerPostAngle) * outerPostRadius,
    );
    outerPost.position.set(postPoint.x, postPoint.y,
      greatWheelLocalZ(greatWheelFrontZ - 0.02 + outerPostLength / 2));
    outerPost.userData.role = 'spring-S-prime-post-on-G';
    greatWheel.userData.rotor.add(outerPost);
    const anchorPoint = new THREE.Vector2(
      springOuterAnchor.position.x,
      springOuterAnchor.position.y,
    );
    const armSpan = anchorPoint.clone().sub(postPoint);
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(armSpan.length(), 0.14, armDepth),
      outerPost.material,
    );
    arm.position.set(
      (postPoint.x + anchorPoint.x) / 2,
      (postPoint.y + anchorPoint.y) / 2,
      greatWheelLocalZ(armBottomZ + armDepth / 2),
    );
    arm.rotation.z = Math.atan2(armSpan.y, armSpan.x);
    arm.userData.role = 'spring-S-prime-arm-on-G';
    greatWheel.userData.rotor.add(arm);

    const profile = largeRatchetMesh.userData.ratchetProfile;
    const slotInner = outerPostRadius - postRadius - 0.025;
    const slotOuter = outerPostRadius + postRadius + 0.025;
    const slotHalfAngle = (postRadius + 0.03) / outerPostRadius;
    const slotStart = outerPostAngle - slotHalfAngle;
    const slotEnd = outerPostAngle + THREE.MathUtils.degToRad(45)
      + slotHalfAngle;
    const slotSteps = 48;
    const slot = [
      ...Array.from({ length: slotSteps + 1 }, (_, index) => {
        const angle = slotStart + (slotEnd - slotStart) * index / slotSteps;
        return [slotOuter * Math.cos(angle), slotOuter * Math.sin(angle)];
      }),
      ...Array.from({ length: slotSteps + 1 }, (_, index) => {
        const angle = slotEnd - (slotEnd - slotStart) * index / slotSteps;
        return [slotInner * Math.cos(angle), slotInner * Math.sin(angle)];
      }),
    ];
    largeRatchetMesh.geometry.dispose();
    largeRatchetMesh.geometry = plate(polygonClipping.difference(
      poly(profile.outline),
      poly(circle([0, 0], profile.bore, 64)),
      poly(slot),
    ), -profile.depth / 2, profile.depth / 2);
    Object.assign(root.userData.blocks, {
      springInnerPost: innerPost,
      springOuterArm: arm,
      springOuterPost: outerPost,
    });
  }
  // Frame the lowered weight's lowest point (just before winding).
  root.userData.cameraFitBounds.min.y = Math.min(
    root.userData.cameraFitBounds.min.y,
    referenceWeightY - ropeDrumPitchRadius * FULL_TURN * windingStartPhase
      - weightHalfHeight - 0.05,
  );
  update(0);
  root.traverse((object) => {
    const materials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    for (const material of materials) material.fog = false;
  });
  root.userData.materialsIgnoreSceneFog = true;
  markShadows(root);
  for (const segment of springSegments) {
    segment.castShadow = false;
    segment.receiveShadow = false;
  }
  rope.castShadow = false;
  rope.receiveShadow = false;
  root.userData.fidelity = 'authored';

  return {
    cameraDirection: new THREE.Vector3(.6, .8, 15),
    root,
    update,
  };
}

export function createAuthoredGoingBarrelMovement(movement) {
  if (movement.id !== 321) return null;
  return harrisonGoingBarrel(movement);
}
