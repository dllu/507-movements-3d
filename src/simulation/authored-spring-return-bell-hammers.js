import * as THREE from 'three';
import { makeLaidRopeMesh } from './laid-rope.js';
import { makeHaulingHand } from './hauling-hand.js';
import { boreBoxAtLocalPoint, boreZCylinder, addZJournal, finishSpringFamily, bellLipSphereGap } from './spring-pivot-family-parts.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function updateCylinderBetween(cylinder, start, end) {
  const delta = end.clone().sub(start);
  const length = delta.length();
  cylinder.position.copy(start).add(end).multiplyScalar(0.5);
  cylinder.quaternion.setFromUnitVectors(
    Y_AXIS,
    delta.clone().multiplyScalar(1 / length),
  );
  cylinder.scale.set(1, length, 1);
}

function makeSegmentedLeafSpring(segmentCount, radius, material) {
  const spring = new THREE.Group();
  spring.userData.role =
    'preloaded-under-lever-return-leaf-spring';
  spring.userData.segmentCount = segmentCount;
  const segments = [];
  for (let index = 0; index < segmentCount; index += 1) {
    const segment = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, 1, 10),
      material,
    );
    segment.userData.role = 'flexing-segment-of-return-leaf-spring';
    spring.add(segment);
    segments.push(segment);
  }
  spring.userData.setCurve = (start, controlA, controlB, end) => {
    const curve = new THREE.CubicBezierCurve3(
      start,
      controlA,
      controlB,
      end,
    );
    for (let index = 0; index < segmentCount; index += 1) {
      updateCylinderBetween(
        segments[index],
        curve.getPoint(index / segmentCount),
        curve.getPoint((index + 1) / segmentCount),
      );
    }
  };
  return spring;
}

const quintic = (u) => {
  const x = THREE.MathUtils.clamp(u, 0, 1);
  return x ** 3 * (10 - 15 * x + 6 * x ** 2);
};
// Ease-out with zero start and end speed that stays ahead of u^2: the
// released hand rises faster than the falling hammer's tail.
const leadingEase = (u) => {
  const x = THREE.MathUtils.clamp(u, 0, 1);
  return 6 * x ** 2 - 8 * x ** 3 + 3 * x ** 4;
};

// Catenary of length `length` hanging between a and b (x-y plane, a.x != b.x).
// A rope that is exactly taut is the straight chord.
function catenaryPoints(a, b, length, count) {
  const chord = a.distanceTo(b);
  const points = [];
  if (length - chord < 1e-6) {
    for (let i = 0; i <= count; i++) points.push(a.clone().lerp(b, i / count));
    return points;
  }
  const [p, q] = a.x < b.x ? [a, b] : [b, a];
  const h = q.x - p.x, v = q.y - p.y;
  const ratio = Math.sqrt(length ** 2 - v ** 2) / h;
  let low = 1e-9, high = 50;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    if (Math.sinh(mid) / mid < ratio) low = mid; else high = mid;
  }
  const scale = h / (low + high); // h / (2 xi)
  const x0 = (p.x + q.x) / 2 - scale * Math.atanh(v / length);
  const c = p.y - scale * Math.cosh((p.x - x0) / scale);
  for (let i = 0; i <= count; i++) {
    const t = a.x < b.x ? i / count : 1 - i / count;
    const x = p.x + h * t;
    points.push(new THREE.Vector3(x, scale * Math.cosh((x - x0) / scale) + c, a.z));
  }
  return points;
}

function bellRingAngle(
  cycleTime,
  strikeTime,
  ringDuration,
  amplitude,
  angularFrequency,
  decayRate,
) {
  const elapsed = cycleTime - strikeTime;
  if (elapsed <= 0 || elapsed >= ringDuration) return 0;
  const normalized = elapsed / ringDuration;
  const smoothCutoff = 1 - (
    10 * normalized ** 3
      - 15 * normalized ** 4
      + 6 * normalized ** 5
  );
  return amplitude
    * Math.exp(-decayRate * elapsed)
    * smoothCutoff
    * Math.sin(angularFrequency * elapsed);
}

function springReturnBellHammer(movement) {
  const root = new THREE.Group();
  const cycleDuration = 4;
  // The ringer pulls the cord down, lifting the head; lets go, so the hammer
  // falls by its own weight onto the lip; the spring then lifts it clear.
  const pullStart = 0.30;
  const pullEnd = 1.40;
  const releaseTime = 1.55;
  const fallDuration = 0.34;
  const strikeTime = releaseTime + fallDuration;
  const handSettleStart = strikeTime + 0.10;
  const handSettleEnd = 3.30;
  const reboundDecay = 7;
  const reboundFrequency = 11;
  const reboundFadeStart = 0.9;
  const reboundFadeEnd = 1.3;
  const liftAngle = THREE.MathUtils.degToRad(62);
  const restAngle = THREE.MathUtils.degToRad(38);
  const strikeAngle = THREE.MathUtils.degToRad(18);
  const angularStroke = restAngle - strikeAngle;
  const pivot = new THREE.Vector3(-1.30, -0.48, 0.48);
  const hammerArmLength = 2.28;
  const hammerTailLength = 1.42;
  const strikerRadius = 0.23;
  const springContactRadius = 1.18;
  const springBase = new THREE.Vector3(-0.94, -1.54, 0.56);
  const springPreload = 0.08;
  const springStiffness = 4.6;
  const bellLipRadius = 0.92;
  // Brown's bell is a little shorter than its lip is wide.
  const bellHeight = 1.62;
  const strikeHeadCenter = new THREE.Vector3(
    pivot.x + hammerArmLength * Math.cos(strikeAngle),
    pivot.y + hammerArmLength * Math.sin(strikeAngle),
    pivot.z,
  );
  const bellBaseY = strikeHeadCenter.y - 0.02;
  const bellCenterX = strikeHeadCenter.x + bellLipRadius
    + Math.sqrt((strikerRadius + 0.075) ** 2 - 0.02 ** 2);
  const bellTopY = bellBaseY + bellHeight;
  const bellContactX = bellCenterX - bellLipRadius;
  const ringDuration = 2.05;
  const bellVibrationAmplitude = THREE.MathUtils.degToRad(1.25);
  const bellAngularFrequency = FULL_TURN * 6.4;
  const bellDecayRate = 2.2;
  const springRestContactY = pivot.y
    + springContactRadius * Math.sin(restAngle) - 0.1752 * Math.cos(restAngle);

  // Rope: tied to the tail end, held by the ringer's hand on a fixed line
  // just left of the tail. Taut (straight, full length) only while the hand
  // pulls; otherwise it hangs as a slack catenary.
  const pullCordLength = 3.35;
  const tailDirection = Math.PI - restAngle;
  const tailTipAt = (angle) => new THREE.Vector3(
    pivot.x + Math.cos(angle + tailDirection) * hammerTailLength,
    pivot.y + Math.sin(angle + tailDirection) * hammerTailLength,
    pivot.z,
  );
  // The ringer stands a little to the left, so the slack cord sags to the
  // left of its chord rather than looping below the fist.
  const handX = pivot.x - hammerTailLength - 0.30;
  // The cord enters the top of the (0.75-scale) fist this far above its centre.
  const gripEntry = 0.15 * 0.75;
  const restSlack = 0.03;
  const handYFor = (angle, slack) => {
    const tip = tailTipAt(angle);
    return tip.y - gripEntry
      - Math.sqrt((pullCordLength - slack) ** 2 - (tip.x - handX) ** 2);
  };
  const handRestY = handYFor(restAngle, restSlack);
  const handLowY = handYFor(liftAngle, 0);
  // Released, the hand relaxes upward just ahead of the rising tail, so the
  // cord goes slack at once and never tightens again until the next pull.
  const releaseSlackRamp = 0.08;
  const handYAt = (t) => {
    if (t < pullStart) return handRestY;
    if (t < releaseTime) return handRestY + (handLowY - handRestY) * quintic((t - pullStart) / (pullEnd - pullStart));
    return handYFor(angleAfterRelease(t), restSlack * leadingEase((t - releaseTime) / releaseSlackRamp));
  };
  const handPoint = (t) => new THREE.Vector3(handX, handYAt(t), pivot.z);
  const gripPoint = (t) => handPoint(t).add(new THREE.Vector3(0, gripEntry, 0));
  // While the hand pulls, the taut cord fixes the lever angle.
  const pulledAngle = (hand) => {
    if (tailTipAt(restAngle).distanceTo(hand) <= pullCordLength) return restAngle; // hand = grip entry
    let low = restAngle, high = liftAngle;
    for (let i = 0; i < 80; i++) {
      const mid = (low + high) / 2;
      if (tailTipAt(mid).distanceTo(hand) > pullCordLength) low = mid; else high = mid;
    }
    return (low + high) / 2;
  };
  const reboundDeviation = (tau) => {
    const fade = 1 - quintic((tau - reboundFadeStart) / (reboundFadeEnd - reboundFadeStart));
    return (restAngle - strikeAngle) * Math.exp(-reboundDecay * tau) * fade * (
      Math.cos(reboundFrequency * tau)
      + reboundDecay / reboundFrequency * Math.sin(reboundFrequency * tau));
  };
  const angleAfterRelease = (t) => {
    if (t < strikeTime) {
      return liftAngle - (liftAngle - strikeAngle) * ((t - releaseTime) / fallDuration) ** 2;
    }
    const tau = t - strikeTime;
    return tau >= reboundFadeEnd ? restAngle : restAngle - reboundDeviation(tau);
  };
  const angleAt = (t) => {
    if (t < pullStart) return restAngle;
    if (t < releaseTime) return pulledAngle(gripPoint(t));
    return angleAfterRelease(t);
  };
  const springContactAt = (angle) => pivot.clone()
    .add(new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0).multiplyScalar(springContactRadius))
    .add(new THREE.Vector3(Math.sin(angle), -Math.cos(angle), 0).multiplyScalar(0.1752));
  // Above this angle the leaf spring has reached its free length and the
  // lever lifts off it.
  let springFreeAngle = restAngle;
  {
    let low = restAngle, high = liftAngle;
    for (let i = 0; i < 80; i++) {
      const mid = (low + high) / 2;
      if (springPreload + springRestContactY - springContactAt(mid).y > 0) low = mid; else high = mid;
    }
    springFreeAngle = (low + high) / 2;
  }

  const stateAtCycleTime = (unwrappedTime) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(
      unwrappedTime,
      cycleDuration,
    );
    const step = 1e-5;
    const hammerAngle = angleAt(cycleTime);
    const onFallEdge = Math.abs(cycleTime - strikeTime) < step;
    const before = angleAt(Math.max(0, cycleTime - step));
    const after = angleAt(Math.min(cycleDuration, cycleTime + step));
    const hammerAngularSpeed = onFallEdge
      ? (hammerAngle - before) / step
      : (after - before) / (2 * step);
    const hammerAngularAcceleration = onFallEdge
      ? 0
      : (after - 2 * hammerAngle + before) / step ** 2;
    const hand = handPoint(cycleTime);
    const grip = gripPoint(cycleTime);
    const tailTip = tailTipAt(hammerAngle);
    const cordSpan = tailTip.distanceTo(grip);
    const cordTaut = pullCordLength - cordSpan < 1e-9;
    const radial = new THREE.Vector3(
      Math.cos(hammerAngle),
      Math.sin(hammerAngle),
      0,
    );
    const tangent = new THREE.Vector3(-radial.y, radial.x, 0);
    const hammerHeadCenter = pivot.clone().addScaledVector(
      radial,
      hammerArmLength,
    );
    const hammerHeadVelocity = tangent.clone().multiplyScalar(
      hammerArmLength * hammerAngularSpeed,
    );
    const hammerHeadAcceleration = tangent.clone().multiplyScalar(
      hammerArmLength * hammerAngularAcceleration,
    ).addScaledVector(
      radial,
      -hammerArmLength * hammerAngularSpeed ** 2,
    );
    const springContact = springContactAt(hammerAngle);
    const springDeflection = springRestContactY - springContact.y;
    const springCompression = Math.max(0, springPreload + springDeflection);
    const springOnLever = hammerAngle <= springFreeAngle;
    const springTip = springOnLever ? springContact.clone() : springContactAt(springFreeAngle);
    const returnSpringForce = springStiffness * springCompression;
    const returnSpringTorque = returnSpringForce
      * (springTip.x - pivot.x);
    const bellAngle = bellRingAngle(
      cycleTime,
      strikeTime,
      ringDuration,
      bellVibrationAmplitude,
      bellAngularFrequency,
      bellDecayRate,
    );
    const contactClearance = bellLipSphereGap(hammerHeadCenter,
      new THREE.Vector3(bellCenterX, bellTopY, pivot.z), bellAngle,
      bellHeight, bellLipRadius, 0.075, strikerRadius);
    const isImpact = Math.abs(cycleTime - strikeTime) <= 1e-12;
    return {
      bellAngle,
      contactClearance,
      cordSpan,
      cordTaut,
      cycleTime,
      gripPosition: grip,
      handPosition: hand,
      hammerAngle,
      hammerAngularAcceleration,
      hammerAngularSpeed,
      hammerClearOfBell: contactClearance > 1e-9,
      hammerHeadAcceleration,
      hammerHeadCenter,
      hammerHeadVelocity,
      isImpact,
      phase: cycleTime / cycleDuration,
      returnSpringForce,
      returnSpringTorque,
      springCompression,
      springContact,
      springDeflection,
      springElasticEnergy: 0.5 * springStiffness * springCompression ** 2,
      springOnLever,
      springTip,
      tailEnd: tailTip,
      tailTip,
    };
  };

  const stateAtTime = (time) => stateAtCycleTime(time);
  const geometry = {
    angularStroke,
    bellAngularFrequency,
    bellBaseY,
    bellCenterX,
    bellContactX,
    bellDecayRate,
    bellHeight,
    bellLipRadius,
    bellTopY,
    bellVibrationAmplitude,
    cycleDuration,
    hammerArmLength,
    hammerTailLength,
    pivot: pivot.clone(),
    restAngle,
    ringDuration,
    springBase: springBase.clone(),
    springContactRadius,
    springPreload,
    springStiffness,
    strikeAngle,
    strikeHeadCenter: strikeHeadCenter.clone(),
    strikerRadius,
    strikeTime,
    pullStart,
    pullEnd,
    releaseTime,
    fallDuration,
    liftAngle,
    pullCordLength,
    springFreeAngle,
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.22,
    roughness: 0.56,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.45,
  });
  const hammerMaterial = matte(PALETTE.driver, {
    metalness: 0.18,
    roughness: 0.50,
  });
  const springMaterial = matte(PALETTE.driven, {
    metalness: 0.34,
    roughness: 0.40,
  });
  const bellMaterial = matte(PALETTE.accent, {
    metalness: 0.58,
    roughness: 0.31,
    side: THREE.DoubleSide,
  });
  // Brown draws the pivot pin, striker nub and spring tip in plain line: no
  // white index dots.
  const pinMaterial = matte(PALETTE.ink, { metalness: 0.30, roughness: 0.42 });

  // Brown's plank runs under the hammer bracket and ends below the bell.
  const foundation = new THREE.Mesh(
    new THREE.BoxGeometry(5.1, 0.22, 1.72),
    frameMaterial,
  );
  foundation.position.set(-0.15, -1.78, -0.25);
  foundation.userData.role = 'fixed-foundation-for-bell-hammer';
  root.add(foundation);

  const pivotStand = new THREE.Group();
  pivotStand.userData.role = 'fixed-hammer-pivot-bracket';
  // Brown's bracket: an upright standard whose right edge slopes out to a
  // foot flange on the plank; its face stands just behind the hammer hub and
  // tail swinging past it.
  const pedestalShape = new THREE.Shape([
    [-1.80, -1.67], [-0.70, -1.67], [-0.70, -1.585], [-0.84, -1.585],
    [-0.99, -0.56], [-1.67, -0.56], [-1.67, -1.585], [-1.80, -1.585],
  ].map(([x, y]) => new THREE.Vector2(x, y)));
  const pedestal = new THREE.Mesh(
    new THREE.ExtrudeGeometry(pedestalShape, { depth: 0.72, bevelEnabled: false })
      .translate(0, 0, -0.36),
    frameMaterial,
  );
  pedestal.position.set(0, 0, -0.04);
  pedestal.userData.role = 'pedestal-below-hammer-pivot';
  pivotStand.add(pedestal);
  const bearing = cylinderAlongZ(0.25, 0.96, darkMaterial, 36);
  bearing.position.copy(pivot);
  bearing.position.z = 0.05;
  boreZCylinder(bearing, 0.25, 0.108, 0.50);
  bearing.userData.role = 'fixed-bearing-at-hammer-pivot';
  pivotStand.add(bearing);
  const pivotPin = cylinderAlongZ(0.105, 1.18, pinMaterial, 28);
  pivotPin.position.copy(pivot);
  pivotPin.position.z = 0.18;
  pivotPin.userData.role = 'hammer-pivot-pin';
  pivotStand.add(pivotPin);
  root.add(pivotStand);

  const hammer = new THREE.Group();
  hammer.position.copy(pivot);
  hammer.userData.role = 'pivoted-external-bell-hammer';
  const hammerArm = new THREE.Mesh(
    new THREE.BoxGeometry(hammerArmLength, 0.14, 0.24),
    hammerMaterial,
  );
  hammerArm.position.set(hammerArmLength / 2, 0, 0);
  boreBoxAtLocalPoint(hammerArm, [-hammerArmLength/2, 0], 0.108);
  hammerArm.userData.role = 'rigid-hammer-arm';
  hammer.add(hammerArm);
  const hammerTail = new THREE.Mesh(
    new THREE.BoxGeometry(hammerTailLength, 0.16, 0.26),
    hammerMaterial,
  );
  // Brown's hammer is a bent lever: the pull tail runs level to the left
  // from the pivot while the arm rises to the head (at the rest pose).
  hammerTail.position.set(Math.cos(tailDirection) * hammerTailLength / 2,
    Math.sin(tailDirection) * hammerTailLength / 2, 0);
  hammerTail.rotation.z = tailDirection - Math.PI;
  boreBoxAtLocalPoint(hammerTail, [hammerTailLength/2, 0], 0.108);
  const hammerHub = addZJournal(hammer, 0.21, 0.108, 0.26, hammerMaterial, new THREE.Vector3(), 'bored-hammer-pivot-hub');
  hammerTail.userData.role = 'abstract-actuating-tail-of-hammer';
  hammer.add(hammerTail);
  const hammerHead = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 0.46, 0.62),
    hammerMaterial,
  );
  hammerHead.position.set(hammerArmLength - 0.22, 0, 0);
  hammerHead.rotation.z = THREE.MathUtils.degToRad(8);
  hammerHead.userData.role = 'rectangular-hammer-head';
  hammer.add(hammerHead);
  const strikerFace = new THREE.Mesh(
    new THREE.SphereGeometry(strikerRadius, 26, 20),
    hammerMaterial,
  );
  strikerFace.position.set(hammerArmLength, 0, 0);
  strikerFace.userData.role = 'rounded-bell-contact-face';
  hammer.add(strikerFace);
  root.add(hammer);

  // Brown draws a twisted pull cord hanging from the end of the tail, just
  // past the end of the plank; it runs off the bottom of the plate to the
  // ringer's hand below the default view. The cord can only pull: it is a
  // straight taut chord while the hand hauls the tail down, and a slack
  // catenary of the same length whenever the hammer is free.
  const pullCordRadius = 0.035;
  const pullCordMaterial = matte(PALETTE.belt, { roughness: 0.78 });
  const pullCordPath = (state) => {
    const tip = state.tailTip;
    const tieIn = tip.clone().add(new THREE.Vector3(
      Math.cos(state.hammerAngle + tailDirection),
      Math.sin(state.hammerAngle + tailDirection), 0).multiplyScalar(-0.03));
    const points = catenaryPoints(tip, state.gripPosition, pullCordLength, 40);
    return new THREE.CatmullRomCurve3([tieIn, ...points], false, 'centripetal');
  };
  const pullCord = makeLaidRopeMesh(pullCordPath(stateAtCycleTime(0)), pullCordMaterial, {
    radius: pullCordRadius,
  });
  pullCord.userData.role = 'twisted-pull-cord-hanging-from-hammer-tail';
  root.add(pullCord);
  const pullHand = makeHaulingHand(new THREE.Vector3(0, 1, 0), pullCordRadius / 0.75, { clearance: 0.05 });
  pullHand.scale.setScalar(0.75);
  pullHand.userData.role = 'ringer-hand-on-pull-cord-below-plate';
  root.add(pullHand);
  const placePullHand = (state) => {
    pullHand.position.copy(state.handPosition);
  };

  const springHeel = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.34, 0.66),
    springMaterial,
  );
  springHeel.position.copy(springBase);
  springHeel.position.y -= 0.13;
  springHeel.position.z = springBase.z;
  springHeel.userData.role = 'fixed-heel-of-return-spring';
  root.add(springHeel);
  const returnLeafSpring = makeSegmentedLeafSpring(
    24,
    0.055,
    springMaterial,
  );
  root.add(returnLeafSpring);
  const springContactPad = new THREE.Mesh(
    new THREE.SphereGeometry(0.105, 22, 16),
    springMaterial,
  );
  springContactPad.userData.role =
    'sliding-contact-of-leaf-spring-under-hammer';
  root.add(springContactPad);

  const bellPivot = new THREE.Group();
  bellPivot.position.set(bellCenterX, bellTopY, pivot.z);
  bellPivot.userData.role = 'small-post-impact-bell-vibration-pivot';
  // Brown's shouldered bell: domed crown, near-straight waist, flared sound
  // bow and lip, with two raised bands at the shoulder and one above the lip.
  const bellProfile = [
    [0.20, 0], [0.36, 0.03], [0.47, 0.09], [0.54, 0.18], [0.57, 0.28],
    [0.575, 0.33], [0.60, 0.335], [0.60, 0.365], [0.578, 0.37],
    [0.58, 0.41], [0.605, 0.415], [0.605, 0.445], [0.582, 0.45],
    [0.60, 0.80], [0.64, 1.00], [0.72, 1.18], [0.80, 1.31],
    [0.84, 1.36], [0.87, 1.365], [0.885, 1.40], [0.86, 1.405],
    [0.89, 1.50], [bellLipRadius, bellHeight],
  ].map(([r, depth]) => new THREE.Vector2(r, bellHeight - depth));
  const bellBody = new THREE.Mesh(
    new THREE.LatheGeometry([...bellProfile,
      ...bellProfile.slice().reverse().map(p => new THREE.Vector2(p.x - 0.055, p.y)), bellProfile[0]].reverse(), 96),
    bellMaterial,
  );
  bellBody.position.set(0, -bellHeight, 0);
  bellBody.userData.role = 'fixed-mounted-struck-bell';
  bellPivot.add(bellBody);
  const bellLip = new THREE.Mesh(
    new THREE.TorusGeometry(bellLipRadius, 0.075, 14, 64),
    bellMaterial,
  );
  bellLip.rotation.x = Math.PI / 2;
  bellLip.position.set(0, -bellHeight, 0);
  bellLip.userData.role = 'reinforced-lip-at-hammer-contact-height';
  bellPivot.add(bellLip);
  const bellCrown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.34, 0.22, 40),
    bellMaterial,
  );
  // Set just below the hanger pin, which passes through the canon loop.
  bellCrown.position.set(0, -0.15, 0);
  bellCrown.userData.role = 'bell-crown-below-hanger';
  // The cast canon loop Brown draws on the crown; the hanger pin runs through it.
  const bellCanon = new THREE.Mesh(
    new THREE.TorusGeometry(0.26, 0.055, 14, 48),
    bellMaterial,
  );
  bellCanon.position.y = 0.08;
  bellCanon.userData.role = 'bell-canon-loop-on-hanger';
  bellPivot.add(bellCanon);
  bellPivot.add(bellCrown);
  root.add(bellPivot);

  const fixedBellSupport = new THREE.Group();
  fixedBellSupport.userData.role = 'fixed-overhead-bell-support';
  const supportPost = new THREE.Mesh(
    new THREE.BoxGeometry(0.20, bellTopY + 0.34 + 1.67, 0.28),
    frameMaterial,
  );
  supportPost.position.set(3.12, (bellTopY + 0.34 - 1.67) / 2, -0.38);
  supportPost.userData.role = 'fixed-bell-support-post';
  fixedBellSupport.add(supportPost);
  // The post stands on its own foot plate on the floor the plank rests on.
  const supportFoot = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.62), frameMaterial);
  supportFoot.position.set(3.12, -1.78, -0.38);
  supportFoot.userData.role = 'fixed-bell-support-post-foot';
  fixedBellSupport.add(supportFoot);
  const supportArm = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 0.18, 0.28),
    frameMaterial,
  );
  supportArm.position.set(2.62, bellTopY + 0.25, -0.38);
  supportArm.userData.role = 'fixed-overhead-arm-carrying-bell';
  fixedBellSupport.add(supportArm);
  const hanger = cylinderAlongZ(0.07, 1.04, darkMaterial, 26);
  hanger.position.set(bellCenterX, bellTopY + 0.08, 0.06);
  hanger.userData.role = 'fixed-bell-hanger-pin';
  fixedBellSupport.add(hanger);
  root.add(fixedBellSupport);

  const update = (time) => {
    const state = stateAtTime(time);
    hammer.rotation.z = state.hammerAngle;
    const cordCurve = pullCordPath(state);
    pullCord.userData.setCurve(cordCurve, 0);
    placePullHand(state);
    springContactPad.position.copy(state.springTip);
    returnLeafSpring.userData.setCurve(
      springBase,
      springBase.clone().add(new THREE.Vector3(0.52, 0.02, 0)),
      state.springTip.clone().add(new THREE.Vector3(-0.46, -0.42, 0)),
      state.springTip,
    );
    bellPivot.rotation.z = state.bellAngle;
  };

  const sourceState = stateAtTime(0);
  root.userData = {
    animationTiming: {
      authoredCyclePeriod: cycleDuration,
      targetCycleDuration: 2,
    },
    archetype:
      'pivoted-bell-hammer-with-preloaded-under-lever-return-leaf-spring-and-clear-ring-dwell',
    blocks: {
      bellBody,
      bellLip,
      bellPivot,
      fixedBellSupport,
      foundation,
      hammer,
      hammerArm,
      hammerHub,
      bearing,
      pivotPin,
      hammerHead,
      hammerTail,
      pivotStand,
      pullCord,
      pullHand,
      returnLeafSpring,
      springContactPad,
      springHeel,
      strikerFace,
    },
    degreesOfFreedom: {
      bellStructuralModesRepresented: 1,
      hammerAngleIndependent: false,
      independentPrescribedInputs: 1,
      operatingDegreesOfFreedom: 1,
      springDeflectionIndependent: false,
    },
    dynamics: {
      actuatorAndImpactContactForceHistoryModeled: false,
      bellResponse:
        'small finite-duration damped display rotation begins at the strike event; it is a legibility cue rather than an elastic shell solution',
      hammerMotion:
        'prescribed: the taut cord fixes the lever angle while the hand pulls; after release a constant-acceleration fall stands in for gravity, and a damped rebound for the spring lift; spring force is reported quasi-statically and is not integrated as a free dynamic state',
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsSpringRateOrLoads: false,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'A rigid external hammer pivots in one fixed bearing and rests clear of the bell on a preloaded leaf spring under its right-hand lever. A hand pulls the cord on the tail, raising the head (the lever lifts off the spring). Released, the cord goes slack and the hammer falls by its own weight onto the bell lip, compressing the spring, which immediately lifts it back to the clear rest angle, leaving the bell free to ring.',
    motion: {
      cycleDuration,
      hammerAngularStroke: angularStroke,
      strikeTime,
    },
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'The official Movement 420 page marks Animated unavailable and provides Brown’s static engraving only.',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourcePose: {
      hammerAngle: sourceState.hammerAngle,
      hammerHeadCenter: sourceState.hammerHeadCenter.clone(),
      springContact: sourceState.springContact.clone(),
    },
    sourceReference: {
      brownPlate420: {
        bellApproximateBoundsPixels: [295, 101, 502, 304],
        hammerHeadApproximateBoundsPixels: [249, 221, 301, 274],
        hammerPivotApproximateCenterPixels: [161, 327],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 12,
        returnSpringApproximateBoundsPixels: [167, 260, 254, 370],
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the arrangement is a hammer for striking bells',
          'a spring is below the hammer',
          'the spring raises the hammer after striking',
          'the hammer is taken out of contact with the bell',
          'clearance prevents interference with bell vibration',
        ],
        engravingEvidence:
          'Brown’s plate shows an external rectangular-headed hammer on a fixed pivot, a long left actuating tail, a curved leaf spring fixed below the right-hand lever, and a separate bell to the right.',
        reconstructionDisclosure:
          'Brown gives no actuator, dimensions, spring characteristic, impact speed, bell material model, or timing. The pull, release, constant-acceleration fall and damped spring rebound schedule, exact tangent contact pose, linear quasi-static spring readout, tiny damped bell rotation, frame, proportions, and four-second display cycle are independently engineered.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 420',
    },
    stateAtCycleTime,
    stateAtTime,
    transmission: {
      bellClearance:
        'distance from striker center to rotated bell lip centerline minus both contact radii',
      springCompression:
        'preload+restContactHeight-currentContactHeight',
      cord:
        'taut (span = cord length) only while the hand pulls; a slack catenary of the same length otherwise',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.22, -1.94, -1.08),
    new THREE.Vector3(3.35, 2.55, 1.12),
  );
  root.userData.cameraDistanceScale = 1.02;
  root.userData.cameraDirection = new THREE.Vector3(4.7, 3.0, 10.8);
  root.userData.groundFloorY = -1.94;
  finishSpringFamily(root, cycleDuration);
  markShadows(root);
  foundation.receiveShadow = true;
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredSpringReturnBellHammerMovement(movement) {
  if (movement.id !== 420) return null;
  return springReturnBellHammer(movement);
}
