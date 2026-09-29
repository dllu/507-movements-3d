import * as THREE from 'three';
import { PALETTE, markShadows, matte } from './primitives.js';
import { LaidRopeGeometry } from './laid-rope.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { capsule, circle, plate, poly, polygonClipping as clip } from './finite-plate-geometry.js';

// Movement 492, Brown & Level's boat-detaching hook, rebuilt from the plate:
// one unit in Brown's elevation. The threaded standard (secured to the boat)
// carries the tongue on a hinge pin at its top and the bent lever on a
// fulcrum pin at its middle. The tongue runs left from its hinge through the
// throat of the tackle hook and ends in the rectangular eye at the lever's
// upper end; the lever's long lower arm curves down to the rope eye whose
// release rope runs off to the right. Scene units: 60 plate pixels, origin at
// the lever fulcrum (plate pixel 247, 238), y up; the mechanism plane is XY.

const PX = 60;
const FULCRUM_PX = [247, 238];
const fromPlate = ([x, y]) => new THREE.Vector2((x - FULCRUM_PX[0]) / PX, (FULCRUM_PX[1] - y) / PX);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function smootherstep(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

// 0 before start, 1 after end, C2-smooth between.
const ramp = (phase, start, end) => smootherstep((phase - start) / (end - start));

const rotate2 = (v, a) => new THREE.Vector2(
  v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a));

function cylinderAlongZ(radius, low, high, material, role, segments = 32) {
  const mesh = addRole(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, high - low, segments), material), role);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.z = (low + high) / 2;
  return mesh;
}

// Distance from p to segment ab (3D).
function segmentDistance(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const t = THREE.MathUtils.clamp(((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz)
    / (abx * abx + aby * aby + abz * abz), 0, 1);
  return Math.hypot(p.x - a.x - t * abx, p.y - a.y - t * aby, p.z - a.z - t * abz);
}

function boatDetachingHook(movement) {
  const root = new THREE.Group();

  // Plate landmarks (525-pixel plate).
  const plateTongueHinge = [246, 153];
  const plateLeverEye = [190, 180];
  const plateRopeEye = [362, 427];
  const plateHookThroatX = 220;

  const hingeCenter = new THREE.Vector2(0, fromPlate(plateTongueHinge).y);
  const eyeCenterRest = fromPlate(plateLeverEye);
  const ropeEyeRest = fromPlate(plateRopeEye);
  const hookThroatX = fromPlate([plateHookThroatX, 0]).x;
  const upperArmLength = eyeCenterRest.length();

  // Depth layers. The standard is a flat forged bar about z 0; the tongue and
  // lever hang behind it in one plane and meet only at the eye.
  const standardDepth = 0.22;
  const mechanismZ = -0.25;
  const tongueRadius = 0.11;
  const leverThickness = 0.14;
  const pinRadius = 0.06;
  const boreRadius = 0.065;

  // The lever turns anticlockwise (the rope pulls its lower end to the
  // right), so the eye travels round the fulcrum toward lower left. The end
  // of the tongue lies along the chord of that travel, so the eye slides
  // straight off the tongue's end without ever pressing on it: the load on
  // the upper wall of the eye is radial to the lever and cannot open it.
  const eyeHalfLength = 0.15;
  const eyeInnerHalfWidth = 0.18;
  const eyeInnerHalfDepth = 0.15;
  const eyeWall = 0.08;
  const tongueTipBeyondEye = 0.20;
  const releaseTravel = tongueTipBeyondEye + tongueRadius + eyeHalfLength + 0.04;
  const leverReleaseAngle = 2 * Math.asin(releaseTravel / (2 * upperArmLength));
  const eyeCenterAt = angle => rotate2(eyeCenterRest, angle);
  const chord = eyeCenterAt(leverReleaseAngle).sub(eyeCenterRest).normalize();
  const tongueEndDirection = chord.clone();
  const upward = new THREE.Vector2(-tongueEndDirection.y, tongueEndDirection.x);
  if (upward.y < 0) upward.negate();
  // The tongue rests against the eye's upper inner wall.
  const restGap = 0.004;
  const tongueAxisAtEye = eyeCenterRest.clone().addScaledVector(upward, eyeInnerHalfWidth - tongueRadius - restGap);

  // Tongue centreline, local to the hinge (angle 0 = locked): straight left
  // from the hinge eye to a rounded knee, then along the chord to its end.
  const endLineLocal = tongueAxisAtEye.clone().sub(hingeCenter);
  const kneeT = -endLineLocal.y / -tongueEndDirection.y;
  const kneeLocal = endLineLocal.clone().addScaledVector(tongueEndDirection, -kneeT);
  const tipLocal = endLineLocal.clone().addScaledVector(tongueEndDirection, tongueTipBeyondEye);
  // Pass 109: Brown's tongue is one smooth curve, so the knee is the
  // largest arc tangent to both runs (it was a 0.16 elbow between two
  // straight rods): 0.9 of the radius at which the arc would use up the
  // shorter of the hinge run and the end run.
  const kneeTurn = Math.acos(THREE.MathUtils.clamp(new THREE.Vector2(-1, 0).dot(tongueEndDirection), -1, 1));
  const kneeRadius = Math.max(0.16, 0.9 * Math.min(
    Math.abs(kneeLocal.x) - 0.2, kneeLocal.distanceTo(tipLocal) - tongueRadius,
  ) / Math.tan(kneeTurn / 2));
  const tongueCenterline = (() => {
    const points = [];
    const horizontal = new THREE.Vector2(-1, 0);
    const turn = kneeTurn;
    const setback = kneeRadius * Math.tan(turn / 2);
    const start = new THREE.Vector2(0, 0), kneeIn = kneeLocal.clone().addScaledVector(horizontal, -setback);
    const kneeOut = kneeLocal.clone().addScaledVector(tongueEndDirection, setback);
    for (let i = 0; i <= 16; i++) points.push(start.clone().lerp(kneeIn, i / 16));
    const centre = kneeIn.clone().add(new THREE.Vector2(0, -kneeRadius));
    for (let i = 1; i <= 24; i++) {
      const a = Math.PI / 2 + turn * i / 24;
      points.push(new THREE.Vector2(centre.x + kneeRadius * Math.cos(a), centre.y + kneeRadius * Math.sin(a)));
    }
    points[points.length - 1] = kneeOut.clone();
    const tipCore = tipLocal.clone().addScaledVector(tongueEndDirection, -tongueRadius);
    for (let i = 1; i <= 16; i++) points.push(kneeOut.clone().lerp(tipCore, i / 16));
    return points;
  })();

  // Tackle hook: a round-bar J in a vertical plane turned 55 degrees from the
  // drawing, its bend round the tongue and its shank up to the block.
  const hookYaw = THREE.MathUtils.degToRad(55);
  const blockYaw = Math.atan2(0.28, 1);
  const hookU = new THREE.Vector3(Math.cos(hookYaw), 0, -Math.sin(hookYaw));
  const hookBendRadius = 0.34;
  // Pass 109: stouter, as Brown's forged hook (bar 0.13, bend 0.34; it
  // was 0.11 on 0.31). A 0.14 bar jams the released tongue in the throat.
  const hookBarRadius = 0.13;
  const hookGap = 0.003;
  const hookShankTop = 0.34;
  const hookBillTop = 0.22;
  const hookCenterline = (() => {
    const points = [];
    for (let i = 0; i <= 8; i++) points.push([-hookBendRadius, hookShankTop * (1 - i / 8)]);
    for (let i = 1; i <= 24; i++) {
      const a = Math.PI + Math.PI * i / 24;
      points.push([hookBendRadius * Math.cos(a), hookBendRadius * Math.sin(a)]);
    }
    for (let i = 1; i <= 6; i++) points.push([hookBendRadius, hookBillTop * i / 6]);
    return points;
  })();
  // The shank continues up in an S to the forged eye under the block.
  const hookNeck = [[-hookBendRadius, hookShankTop], [-0.2, 0.47], [-0.07, 0.56], [0, 0.62], [0, 0.64]];

  const hookNeckSegments = hookNeck.slice(1).map((p, i) => [
    new THREE.Vector3(hookNeck[i][0], hookNeck[i][1], 0), new THREE.Vector3(p[0], p[1], 0)]);
  const hookClear = (throat, tonguePoints) => {
    // Bend (a torus arc), shank, bill and neck against the tongue's axis
    // (the last point is the flat hinge eye, bounded by a sphere).
    const local = new THREE.Vector3(), hookLocal = new THREE.Vector3();
    for (const p of tonguePoints) {
      const limit = hookBarRadius + (p.userData?.radius ?? tongueRadius) + hookGap;
      local.copy(p).sub(throat);
      const u = local.dot(hookU), v = local.y, w = local.x * Math.sin(hookYaw) + local.z * Math.cos(hookYaw);
      if (Math.hypot(Math.hypot(u, Math.min(v, 0)) - hookBendRadius, w) < limit && v <= 0) return false;
      if (Math.hypot(u + hookBendRadius, w, Math.max(0, v - hookShankTop), Math.max(0, -v)) < limit) return false;
      if (Math.hypot(u - hookBendRadius, w, Math.max(0, v - hookBillTop), Math.max(0, -v)) < limit) return false;
      hookLocal.set(u, v, w);
      for (const [a, b] of hookNeckSegments) if (segmentDistance(hookLocal, a, b) < limit) return false;
    }
    return true;
  };
  const tonguePointsAt = angle => tongueCenterline.map(p => {
    const q = rotate2(p, angle).add(hingeCenter);
    return new THREE.Vector3(q.x, q.y, mechanismZ);
  });
  // Dense tongue axis samples for the hook contact.
  const denseTongue = angle => {
    const axis = tonguePointsAt(angle), dense = [];
    for (let i = 1; i < axis.length; i++) for (let k = 0; k < 4; k++) dense.push(axis[i - 1].clone().lerp(axis[i], k / 4));
    dense.push(axis.at(-1));
    const hingeEye = new THREE.Vector3(hingeCenter.x, hingeCenter.y, mechanismZ);
    hingeEye.userData = { radius: Math.hypot(0.2, tongueRadius) };
    return [...dense.filter(p => Math.abs(p.x - hookThroatX) < 0.7), hingeEye];
  };
  // The hook hangs straight down from the tackle and rests on the tongue in
  // its throat: its height is the highest at which the bend clears the
  // tongue, followed by continuation as the liberated tongue swings up
  // (clockwise, tip rising) until the tongue leaves the throat.
  const contactAbove = (angle, start) => {
    const points = denseTongue(angle), throat = new THREE.Vector3(hookThroatX, start, mechanismZ);
    if (!hookClear(throat, points)) throw new Error(`492 tongue jams in the hook at ${angle}`);
    let low = start, high = start;
    do {
      low = high; high += 0.01; throat.y = high;
      if (high > start + 0.8) return Infinity;
    } while (hookClear(throat, points));
    for (let i = 0; i < 18; i++) {
      throat.y = (low + high) / 2;
      if (hookClear(throat, points)) low = throat.y; else high = throat.y;
    }
    return low;
  };
  const swingPath = [[0, contactAbove(0, hingeCenter.y - 0.02)]];
  for (let angle = -0.008; ; angle -= 0.008) {
    const height = contactAbove(angle, swingPath.at(-1)[1]);
    if (height === Infinity) break;
    swingPath.push([angle, height]);
    if (angle < -Math.PI) throw new Error('492 tongue never leaves the hook');
  }
  const tongueExitAngle = swingPath.at(-1)[0];
  const throatHeightForSwing = fraction => {
    const x = THREE.MathUtils.clamp(fraction, 0, 1) * (swingPath.length - 1);
    const i = Math.min(Math.floor(x), swingPath.length - 2);
    return swingPath[i][1] + (swingPath[i + 1][1] - swingPath[i][1]) * (x - i);
  };
  const throatTable = swingPath.map(([, h]) => h);
  const lockedThroatHeight = throatTable[0];
  const exitThroatHeight = throatTable.at(-1);
  // Pass 96: a shorter free rise (was 1.1) keeps the released hook and block
  // in the default frame.
  const freeHookRise = 0.5;

  const cycleDuration = 10;
  const stateAtTime = time => {
    const cycleTime = positiveModulo(time, cycleDuration);
    const phase = cycleTime / cycleDuration;
    // Hold locked, pull the rope, tongue swings up out of the hook, hook
    // rises clear; then the demonstration resets in reverse.
    const leverProgress = ramp(phase, 0.08, 0.24) - ramp(phase, 0.90, 0.99);
    const tongueProgress = ramp(phase, 0.26, 0.50) - ramp(phase, 0.70, 0.89);
    const freeProgress = ramp(phase, 0.50, 0.58) - ramp(phase, 0.62, 0.70);
    const leverAngle = leverReleaseAngle * leverProgress;
    const tongueAngle = tongueExitAngle * tongueProgress;
    const engaged = tongueProgress < 1;
    const throatHeight = engaged
      ? throatHeightForSwing(tongueProgress)
      : exitThroatHeight + freeHookRise * freeProgress;
    const ropePull = ropeEyeRest.length() * leverAngle;
    return {
      cycleTime, phase, leverProgress, tongueProgress, freeProgress, leverAngle, tongueAngle,
      engaged, throatHeight, hookLift: throatHeight - lockedThroatHeight, ropePull,
      eyeCenter: eyeCenterAt(leverAngle), ropeEyeCenter: rotate2(ropeEyeRest, leverAngle),
    };
  };

  const standardMaterial = matte(PALETTE.frame, { metalness: 0.3, roughness: 0.5 });
  const leverMaterial = matte(PALETTE.accent, { metalness: 0.3, roughness: 0.44 });
  const tongueMaterial = matte(PALETTE.driver, { metalness: 0.24, roughness: 0.48 });
  const hookMaterial = matte(PALETTE.driven, { metalness: 0.32, roughness: 0.42 });
  const blockMaterial = matte(0x8a6a48, { metalness: 0.02, roughness: 0.8 });
  const darkMaterial = matte(PALETTE.ink, { metalness: 0.36, roughness: 0.4 });
  const ropeMaterial = matte(PALETTE.belt, { metalness: 0.03, roughness: 0.72 });

  // --- Standard: flat waisted bar with two pin bosses, turned collar and a
  // threaded shank.
  const standard = addRole(new THREE.Group(), 'boat-fixed-threaded-standard');
  root.add(standard);
  const standardRight = [[0.20, 1.20], [0.15, 0.96], [0.14, 0.70], [0.17, 0.42], [0.22, 0.20], [0.22, -0.20],
    [0.17, -0.45], [0.16, -0.72], [0.18, -1.00], [0.25, -1.28], [0.35, -1.50], [0.36, -1.60]];
  const standardSpline = new THREE.SplineCurve(standardRight.map(p => new THREE.Vector2(...p))).getPoints(60).map(p => [p.x, p.y]);
  const standardOutline = clip.difference(clip.union(
    poly([...standardSpline, ...standardSpline.slice().reverse().map(([x, y]) => [-x, y])]),
    poly(circle([0, hingeCenter.y], 0.27, 96)), poly(circle([0, 0], 0.28, 96))),
  poly(circle([0, hingeCenter.y], boreRadius, 48)), poly(circle([0, 0], boreRadius, 48)));
  const standardBar = addRole(new THREE.Mesh(plate(standardOutline, -standardDepth / 2, standardDepth / 2), standardMaterial),
    'boat-fixed-standard-plate');
  standard.add(standardBar);
  const collarTop = -1.56, collarBottom = -2.03;
  // The collar is bored for the shank, which runs up through it.
  const collar = addRole(new THREE.Mesh(boredLatheGeometry([
    [0.36, collarBottom], [0.40, collarBottom + 0.04], [0.40, collarTop - 0.04], [0.36, collarTop],
  ].map(([radial, axial]) => ({ radial, axial })), 0.148, 64), standardMaterial), 'turned-collar-seating-on-the-boat');
  standard.add(collar);
  const shankBottom = -3.55, threadTop = -2.78, shankRadius = 0.15;
  const shank = addRole(new THREE.Mesh(new THREE.CylinderGeometry(shankRadius, shankRadius, collarTop - shankBottom - 0.01, 40), darkMaterial),
    'threaded-shank-screwed-into-the-boat');
  shank.position.y = (collarTop - 0.01 + shankBottom) / 2;
  standard.add(shank);
  const threadTurns = 9;
  const threadCurve = new THREE.CatmullRomCurve3(Array.from({ length: threadTurns * 24 + 1 }, (_, i) => {
    const a = i / 24 * Math.PI * 2;
    return new THREE.Vector3(0.155 * Math.cos(a), threadTop - (threadTop - shankBottom - 0.06) * i / (threadTurns * 24), 0.155 * Math.sin(a));
  }));
  const thread = addRole(new THREE.Mesh(new THREE.TubeGeometry(threadCurve, threadTurns * 48, 0.035, 8, false), darkMaterial),
    'helical-screw-thread-on-the-shank');
  standard.add(thread);
  for (const t of [0, 1]) {
    const cap = addRole(new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), darkMaterial), `thread-end-${t + 1}`);
    cap.position.copy(threadCurve.getPoint(t));
    standard.add(cap);
  }
  // Pins run through the standard and the member behind it, with heads.
  const pinBack = mechanismZ - tongueRadius - 0.035, pinFront = standardDepth / 2 + 0.025;
  const makePin = (y, role) => {
    const pin = new THREE.Group();
    pin.position.y = y;
    pin.userData.role = role;
    pin.add(cylinderAlongZ(pinRadius, pinBack + 0.015, pinFront - 0.01, darkMaterial, `${role}-shank`));
    pin.add(cylinderAlongZ(0.1, standardDepth / 2 + 0.002, pinFront, darkMaterial, `${role}-front-head`));
    pin.add(cylinderAlongZ(0.1, pinBack, pinBack + 0.025, darkMaterial, `${role}-back-head`));
    standard.add(pin);
    return pin;
  };
  const tongueHingePin = makePin(hingeCenter.y, 'tongue-hinge-pin-at-standard-top');
  const leverFulcrumPin = makePin(0, 'lever-fulcrum-pin-at-standard-middle');

  // --- Tongue: flat hinge eye and round bar, one rigid part.
  const tongue = addRole(new THREE.Group(), 'hinged-tongue');
  tongue.position.set(hingeCenter.x, hingeCenter.y, mechanismZ);
  root.add(tongue);
  const tongueEye = addRole(new THREE.Mesh(plate(clip.difference(poly(circle([0, 0], 0.2, 96)),
    poly(circle([0, 0], boreRadius, 48))),
  -tongueRadius, tongueRadius), tongueMaterial), 'tongue-hinge-eye');
  tongue.add(tongueEye);
  const tongueBarCurve = new THREE.CatmullRomCurve3(tongueCenterline.slice(4).map(p => new THREE.Vector3(p.x, p.y, 0)), false, 'centripetal');
  const tongueBar = addRole(new THREE.Mesh(new THREE.TubeGeometry(tongueBarCurve, 96, tongueRadius, 20, false), tongueMaterial),
    'curved-tongue-body');
  tongue.add(tongueBar);
  const tongueTip = addRole(new THREE.Mesh(new THREE.SphereGeometry(tongueRadius, 24, 16), tongueMaterial), 'rounded-tongue-end');
  tongueTip.position.set(tongueCenterline.at(-1).x, tongueCenterline.at(-1).y, 0);
  tongue.add(tongueTip);

  // --- Lever: flat bent lever with the rectangular eye at its upper end.
  const lever = addRole(new THREE.Group(), 'bent-release-lever');
  lever.position.z = mechanismZ;
  root.add(lever);
  const downward = upward.clone().negate();
  const eyeOuterHalfWidth = eyeInnerHalfWidth + eyeWall;
  const armAttach = eyeCenterRest.clone().addScaledVector(downward, eyeOuterHalfWidth - 0.02);
  // Pass 101: the long lower arm is one circular arc of constant width from
  // the fulcrum to the rope eye, bowed to the outside by Brown's sagitta
  // (8 px; his traced points lie 0-9 px off the chord, all on that side),
  // instead of a spline through hand-traced points that wobbled into an S.
  const lowerArmSagitta = 8 / PX, lowerArmHalfWidth = 0.11;
  const lowerArmOutline = (() => {
    const chord = ropeEyeRest.length(), half = chord / 2;
    const radius = (half * half + lowerArmSagitta * lowerArmSagitta) / (2 * lowerArmSagitta);
    const along = ropeEyeRest.clone().normalize();
    // The bow lies on Brown's side of the chord, up and to the right.
    const bow = new THREE.Vector2(-along.y, along.x);
    const center = along.clone().multiplyScalar(half).addScaledVector(bow, lowerArmSagitta - radius);
    const a0 = Math.atan2(-center.y, -center.x), a1 = Math.atan2(ropeEyeRest.y - center.y, ropeEyeRest.x - center.x);
    let sweep = a1 - a0;
    if (sweep > Math.PI) sweep -= 2 * Math.PI;
    if (sweep < -Math.PI) sweep += 2 * Math.PI;
    const side = (r) => Array.from({length: 97}, (_, i) => {
      const a = a0 + sweep * i / 96;
      return [center.x + r * Math.cos(a), center.y + r * Math.sin(a)];
    });
    const outer = side(radius + lowerArmHalfWidth), inner = side(radius - lowerArmHalfWidth).reverse();
    return poly([...outer, ...inner]);
  })();
  const leverOutline = clip.difference(clip.union(
    poly(circle([0, 0], 0.21, 96)),
    capsule([0, 0], [armAttach.x, armAttach.y], 0.14, 24),
    lowerArmOutline,
    poly(circle([ropeEyeRest.x, ropeEyeRest.y], 0.19, 96))),
  poly(circle([0, 0], boreRadius, 48)), poly(circle([ropeEyeRest.x, ropeEyeRest.y], 0.09, 48)));
  const leverBody = addRole(new THREE.Mesh(plate(leverOutline, -leverThickness / 2, leverThickness / 2), leverMaterial),
    'bent-lever-arms-fulcrum-boss-and-rope-eye');
  lever.add(leverBody);
  // The eye: a rectangular loop whose opening runs along the tongue's end.
  const eyeRing = clip.difference(
    poly([[-eyeOuterHalfWidth, -eyeInnerHalfDepth - eyeWall], [eyeOuterHalfWidth, -eyeInnerHalfDepth - eyeWall],
      [eyeOuterHalfWidth, eyeInnerHalfDepth + eyeWall], [-eyeOuterHalfWidth, eyeInnerHalfDepth + eyeWall]]),
    poly([[-eyeInnerHalfWidth, -eyeInnerHalfDepth], [eyeInnerHalfWidth, -eyeInnerHalfDepth],
      [eyeInnerHalfWidth, eyeInnerHalfDepth], [-eyeInnerHalfWidth, eyeInnerHalfDepth]]));
  const eyeGeometry = plate(eyeRing, -eyeHalfLength, eyeHalfLength);
  // Local x -> "upward" across the tongue, local y -> depth, local z -> along the tongue.
  eyeGeometry.applyMatrix4(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(upward.x, upward.y, 0), new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(tongueEndDirection.x, tongueEndDirection.y, 0)));
  const leverEye = addRole(new THREE.Mesh(eyeGeometry, leverMaterial), 'upper-eye-locking-tongue');
  leverEye.position.set(eyeCenterRest.x, eyeCenterRest.y, 0);
  lever.add(leverEye);

  // --- Tackle: the lower block (cropped by Brown at the top), its hook and
  // the falls rising out of the plate.
  const tackle = addRole(new THREE.Group(), 'tackle-block-and-hook');
  root.add(tackle);
  const hookFrame = new THREE.Group();
  hookFrame.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hookYaw);
  tackle.add(hookFrame);
  const hookCurve = new THREE.CatmullRomCurve3([
    ...hookNeck.slice().reverse().map(([u, v]) => new THREE.Vector3(u, v, 0)).slice(0, -1),
    ...hookCenterline.map(([u, v]) => new THREE.Vector3(u, v, 0)),
  ], false, 'centripetal');
  const hookBar = addRole(new THREE.Mesh(new THREE.TubeGeometry(hookCurve, 160, hookBarRadius, 16, false), hookMaterial),
    'tackle-hook-bar');
  hookFrame.add(hookBar);
  const hookPoint = addRole(new THREE.Mesh(new THREE.SphereGeometry(hookBarRadius, 16, 12), hookMaterial), 'tackle-hook-point');
  hookPoint.position.set(hookBendRadius, hookBillTop, 0);
  const hookTopCap = hookPoint.clone();
  hookTopCap.userData = { role: 'tackle-hook-shank-to-eye-boss' };
  hookTopCap.position.set(0, hookNeck.at(-1)[1], 0);
  hookFrame.add(hookPoint, hookTopCap);
  // Brown's stropped block: a rope strop lies in a score round the shell, in
  // the plane across the sheave (between the two falls). Below the shell its
  // legs are seized together and its bight passes through the forged eye of
  // the hook, which hangs from it.
  const stropRadius = 0.05, eyeBarRadius = 0.07, stropGap = 0.003;
  const hookEyeRadius = eyeBarRadius + stropRadius + stropGap;
  const hookEyeCenterY = hookNeck.at(-1)[1] + hookEyeRadius;
  // The block turns on the hook's axis so that its strop faces the viewer
  // edge-on down the middle of the shell, as Brown draws it; the eye is
  // forged square to the strop's bight.
  const blockFrame = addRole(new THREE.Group(), 'tackle-block-frame');
  blockFrame.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), blockYaw);
  tackle.add(blockFrame);
  const hookEye = addRole(new THREE.Mesh(new THREE.TorusGeometry(hookEyeRadius, eyeBarRadius, 16, 48), hookMaterial),
    'tackle-hook-forged-eye');
  hookEye.position.y = hookEyeCenterY;
  blockFrame.add(hookEye);
  // The bight wraps the eye's top bar (axis along the hook plane).
  const eyeTopBarY = hookEyeCenterY + hookEyeRadius;
  const bightRadius = eyeBarRadius + stropRadius;
  const seizingLow = eyeTopBarY + 0.2, seizingHigh = seizingLow + 0.09;
  const blockRadii = [0.5, 0.64, 0.3];
  const blockBottom = seizingHigh + 0.06;
  const blockCenterY = blockBottom + blockRadii[1];
  // Strop centreline: half sunk in its score.
  const stropLift = stropRadius * 0.45;
  const stropOnShell = t => {
    // t from 0 (crown) to PI (arse); z = across the sheave (+ side).
    const e = new THREE.Vector2(blockRadii[2] * Math.sin(t), blockRadii[1] * Math.cos(t));
    const n = new THREE.Vector2(Math.sin(t) / blockRadii[2], Math.cos(t) / blockRadii[1]).normalize();
    return e.addScaledVector(n, stropLift).add(new THREE.Vector2(0, blockCenterY));
  };
  // Leave the shell where the leg heads straight for the seizing.
  const seizeTop = new THREE.Vector2(stropRadius, seizingHigh);
  const aim = t => {
    const p = stropOnShell(t), tangent = stropOnShell(t + 1e-5).sub(p), toSeize = seizeTop.clone().sub(p);
    return tangent.x * toSeize.y - tangent.y * toSeize.x;
  };
  let leaveT = Math.PI / 2;
  for (let i = 1; i <= 4000; i++) {
    const t = Math.PI / 2 + Math.PI / 2 * i / 4000;
    if (Math.sign(aim(t)) !== Math.sign(aim(Math.PI / 2))) { leaveT = t; break; }
  }
  const halfStrop = [];
  for (let i = 0; i <= 60; i++) halfStrop.push(stropOnShell(leaveT * i / 60));
  for (let i = 1; i <= 6; i++) halfStrop.push(stropOnShell(leaveT).lerp(seizeTop, i / 6));
  for (let i = 1; i <= 3; i++) halfStrop.push(new THREE.Vector2(stropRadius, seizingHigh - (seizingHigh - seizingLow) * i / 3));
  // From the seizing each leg runs straight to its tangent on the bight,
  // which wraps the eye's top bar.
  const legFoot = new THREE.Vector2(stropRadius, seizingLow - eyeTopBarY);
  const tangentAngle = Math.atan2(legFoot.y, legFoot.x) - Math.acos(bightRadius / legFoot.length());
  const bightPoint = a => new THREE.Vector2(bightRadius * Math.cos(a), eyeTopBarY + bightRadius * Math.sin(a));
  for (let i = 1; i <= 6; i++) halfStrop.push(new THREE.Vector2(stropRadius, seizingLow).lerp(bightPoint(tangentAngle), i / 6));
  for (let i = 1; i < 32; i++) halfStrop.push(bightPoint(tangentAngle + (-Math.PI / 2 - tangentAngle) * i / 32));
  const stropPoints = [...halfStrop, ...halfStrop.slice(1).reverse().map(p => new THREE.Vector2(-p.x, p.y))]
    .map(p => new THREE.Vector3(0, p.y, p.x));
  stropPoints.pop();
  const strop = addRole(new THREE.Mesh(new LaidRopeGeometry(stropPoints, 600, stropRadius, 8, true), ropeMaterial),
    'rope-strop-round-block-shell-and-hook-eye');
  blockFrame.add(strop);
  // The seizing binds the two legs just above the eye.
  const seizing = addRole(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, seizingHigh - seizingLow - 0.01, 40), ropeMaterial),
    'strop-seizing-above-hook-eye');
  seizing.scale.set(stropRadius + 0.012, 1, 2 * stropRadius + 0.012);
  seizing.position.y = (seizingHigh + seizingLow) / 2;
  blockFrame.add(seizing);
  // The shell, with the strop's score sunk round it across the sheave: the
  // score is cut exactly clear of the strop's own path, so it runs out under
  // the arse where the legs leave the shell.
  const shellGeometry = new THREE.SphereGeometry(1, 256, 96);
  {
    const position = shellGeometry.attributes.position, p = new THREE.Vector3(), q = new THREE.Vector2();
    const scoreRadius = stropRadius + stropGap;
    const path = halfStrop.map(v => new THREE.Vector2(v.x, v.y - blockCenterY));
    const pathDistance = (z, y) => {
      q.set(Math.abs(z), y);
      let best = Infinity;
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], d = path[i].clone().sub(a);
        const t = THREE.MathUtils.clamp(q.clone().sub(a).dot(d) / d.lengthSq(), 0, 1);
        best = Math.min(best, q.distanceTo(a.clone().addScaledVector(d, t)));
      }
      return best;
    };
    const clear = v => Math.hypot(v.x, pathDistance(v.z, v.y)) >= scoreRadius;
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).multiply(new THREE.Vector3(...blockRadii));
      if (Math.abs(p.x) < scoreRadius && !clear(p)) {
        const n = new THREE.Vector3(p.x / blockRadii[0] ** 2, p.y / blockRadii[1] ** 2, p.z / blockRadii[2] ** 2).normalize();
        let low = 0, high = 2 * scoreRadius;
        for (let k = 0; k < 30; k++) {
          const mid = (low + high) / 2;
          if (clear(p.clone().addScaledVector(n, -mid))) high = mid; else low = mid;
        }
        p.addScaledVector(n, -high);
      }
      position.setXYZ(i, p.x, p.y, p.z);
    }
    shellGeometry.computeVertexNormals();
  }
  const block = addRole(new THREE.Mesh(shellGeometry, blockMaterial), 'tackle-lower-block-shell');
  block.position.y = blockCenterY;
  blockFrame.add(block);
  // The falls run on well past every rotated view before ending.
  const fallTop = block.position.y + 14;
  const falls = [-0.2, 0.2].map((u, index) => {
    const start = new THREE.Vector3(u, block.position.y + blockRadii[1] * Math.sqrt(1 - (u / blockRadii[0]) ** 2) - 0.03, 0);
    const rope = addRole(new THREE.Mesh(new LaidRopeGeometry(new THREE.LineCurve3(start, new THREE.Vector3(u, fallTop, 0)), 200, 0.06, 8, false),
      ropeMaterial), `tackle-fall-lead-beyond-plate-${index + 1}`);
    rope.userData.beyondPlateCrop = true;
    blockFrame.add(rope);
    return rope;
  });

  // --- Release rope: seized to the lower eye, running straight off right.
  const ropeDirection = new THREE.Vector2(Math.cos(THREE.MathUtils.degToRad(-5)), Math.sin(THREE.MathUtils.degToRad(-5)));
  // It runs on straight well past every rotated view, so no cut end shows.
  const ropeLength = 16;
  const releaseRope = addRole(new THREE.Mesh(new LaidRopeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(ropeDirection.x * ropeLength, ropeDirection.y * ropeLength, 0)), 300, 0.05, 8, false), ropeMaterial),
  'release-rope-attached-to-lower-lever');
  releaseRope.userData.beyondPlateCrop = true;
  root.add(releaseRope);
  // The rope is seized round the eye; it leaves the rim along its own lead.
  const ropeAttachOffset = ropeDirection.clone().multiplyScalar(0.2);

  const update = time => {
    const state = stateAtTime(time);
    lever.rotation.z = state.leverAngle;
    tongue.rotation.z = state.tongueAngle;
    tackle.position.set(hookThroatX, state.throatHeight, mechanismZ);
    const attach = rotate2(ropeEyeRest, state.leverAngle).add(ropeAttachOffset);
    releaseRope.position.set(attach.x, attach.y, mechanismZ);
    releaseRope.geometry.setTravel?.(state.ropePull);
    for (const fall of falls) fall.geometry.setTravel?.(state.hookLift);
  };

  const geometry = {
    cycleDuration, eyeCenterRest, eyeHalfLength, eyeInnerHalfDepth, eyeInnerHalfWidth, eyeWall, freeHookRise,
    hingeCenter, hookBarRadius, hookBendRadius, hookGap, hookThroatX, hookYaw, leverReleaseAngle, lockedThroatHeight,
    mechanismZ, restGap, ropeEyeRest, standardDepth, tongueEndDirection, tongueExitAngle, tongueRadius,
    tongueTipBeyondEye, upperArmLength, exitThroatHeight,
  };
  root.userData = {
    animationTiming: { authoredCyclePeriod: cycleDuration, targetCycleDuration: cycleDuration },
    archetype: 'paired-eye-lever-boat-detachers-with-hinged-load-tongues',
    blocks: {
      block, blockFrame, collar, falls, hookBar, hookEye, hookFrame, hookPoint, seizing, strop, lever, leverBody, leverEye, leverFulcrumPin, releaseRope,
      shank, standard, standardBar, tackle, thread, tongue, tongueBar, tongueEye, tongueHingePin, tongueTip,
    },
    degreesOfFreedom: { releaseInputs: 1, leverCoordinates: 1, tongueCoordinates: 1, hookCoordinates: 1, standardCoordinates: 0 },
    dynamics: {
      eyeGeometry: 'The tongue end lies along the chord of the eye\'s travel about the fulcrum, so the eye slides off it without bearing on it; while locked the tongue presses the eye\'s upper wall radially to the lever, which therefore cannot be opened by the load.',
      hookContact: 'While engaged the hook rests on the tongue: its throat height is the highest at which its round bend, shank and bill clear the tongue, found analytically for every tongue angle. The tongue leaves the throat at the computed exit angle; the hook then rises freely.',
      disclosure: 'Prescribed demonstration timing and a reverse reset; gravity, rope tension and friction are not dynamically solved. The boat is not drawn (Brown shows only the threaded shank); the hook rising stands for the boat dropping away.',
    },
    fidelity: 'authored',
    geometry,
    mechanism: 'The threaded standard is screwed into the boat. The tongue, hinged at its top, passes through the throat of the tackle hook and ends in the rectangular eye at the upper end of the bent lever, which turns on a fulcrum at the middle of the standard. Pulling the rope on the lever\'s lower eye swings the eye along and off the tongue\'s end; the liberated tongue swings up under the hook\'s pull and slips out of it, detaching the boat.',
    stateAtTime,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      reason: 'The official Movement 492 page marks Animated unavailable.',
    },
    sourceReference: {
      brownPlate492: {
        imageWidth: 525,
        imageHeight: 525,
        tongueHingePixels: plateTongueHinge,
        leverFulcrumPixels: FULCRUM_PX,
        leverEyePixels: plateLeverEye,
        lowerRopeEyePixels: plateRopeEye,
        hookThroatXPixels: plateHookThroatX,
        pixelsPerUnit: PX,
      },
      explicitInBrownDescription: [
        'an upright standard is secured to the boat',
        'a tongue is hinged to the standard upper end',
        'the tongue enters an eye in a lever',
        'the lever fulcrum is at the middle of the standard',
        'the tackle hooks engage the tongues',
        'a rope attaches to the lower end of each lever',
        'pulling each rope slips the upper eye off the tongue',
        'the liberated tongue slips out of the tackle hook',
      ],
      reconstructionDisclosure: 'One unit as drawn (Brown notes a similar unit at the other end of the boat, not drawn). Plate positions of the pins, eye, rope eye and hook are kept; the tongue\'s knee, the chord-aligned end, depth layers, hook yaw, block and falls, timing and reset are engineered.',
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 492',
    },
    update,
  };
  update(0);
  // Pass 96: fitted to the hook's full travel (its eye tops out at 4.27).
  root.userData.cameraFitBounds = new THREE.Box3(new THREE.Vector3(-1.45, -3.62, -0.62), new THREE.Vector3(4.1, 4.55, 0.3));
  root.userData.cameraDirection = new THREE.Vector3(0.28, 0.12, 1);
  root.userData.cameraDistanceScale = 1.0;
  root.userData.hideGround = true;
  root.traverse(o => { for (const m of o.material ? [].concat(o.material) : []) m.fog = false; });
  markShadows(root);
  return { cameraDirection: root.userData.cameraDirection, root, update };
}

export function createAuthoredBoatDetacherMovement(movement) {
  if (movement.id !== 492) return null;
  return boatDetachingHook(movement);
}
