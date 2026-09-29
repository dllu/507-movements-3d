import {correctCordTraverseParts} from './cord-traverse-working-parts.js';
import { LAID_ROPE, replaceWithLaidRope } from './laid-rope.js';
import * as THREE from 'three';
import { crankArmGeometry, turnedHandleGeometry, handleShank, HANDLE_FOOT_EMBED } from './turned-handle.js';
import {
  PALETTE,
  makeBeam,
  makeDynamicMovingBelt,
  makePulley,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

// Sureda measured the distance covered by a skilled spinner's carriage in
// each of ten successive wheel revolutions.  Borgnis printed the observations
// in 1820 beside the double-cord fusee which mechanised that hand-controlled
// speed law.  Brown's reduced figure preserves the same essential topology
// but omits the dimensions and timing.
const SUREDA_TRAVEL_LINES = Object.freeze([
  112,
  88,
  74,
  62,
  53,
  46,
  41,
  38,
  36,
  30,
]);

function cylinderAlongY(radius, length, material, segments = 28) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function ringAroundY(radius, tubeRadius, material, segments = 36) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tubeRadius, 10, segments),
    material,
  );
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function integralSmootherstep(value) {
  const value2 = value * value;
  const value4 = value2 * value2;
  return value4 * (value2 - 3 * value + 2.5);
}

function smootherstep(value) {
  const value2 = value * value;
  const value3 = value2 * value;
  return value3 * (value * (value * 6 - 15) + 10);
}

function smootherstepDerivative(value) {
  return 30 * value ** 2 * (value - 1) ** 2;
}

function easedConstantSpeedStroke(time, duration, rampDuration) {
  const boundedTime = THREE.MathUtils.clamp(time, 0, duration);
  const cruiseArea = duration - rampDuration;
  if (boundedTime <= rampDuration) {
    const rampPhase = boundedTime / rampDuration;
    return {
      acceleration: smootherstepDerivative(rampPhase)
        / (rampDuration * cruiseArea),
      progress: rampDuration * integralSmootherstep(rampPhase)
        / cruiseArea,
      velocity: smootherstep(rampPhase) / cruiseArea,
    };
  }
  if (boundedTime < duration - rampDuration) {
    return {
      acceleration: 0,
      progress: (boundedTime - rampDuration / 2) / cruiseArea,
      velocity: 1 / cruiseArea,
    };
  }
  const rampPhase = (
    boundedTime - (duration - rampDuration)
  ) / rampDuration;
  const areaBeforeRamp = duration - 1.5 * rampDuration;
  return {
    acceleration: -smootherstepDerivative(rampPhase)
      / (rampDuration * cruiseArea),
    progress: (
      areaBeforeRamp
      + rampDuration * (rampPhase - integralSmootherstep(rampPhase))
    ) / cruiseArea,
    velocity: (1 - smootherstep(rampPhase)) / cruiseArea,
  };
}

// Brown draws the fusee as a straight (linear) cone: its outline runs
// straight from the large-end flange to the small-end collar, and the
// groove follows it. The pitch radius therefore falls linearly with the
// groove turn, and the carriage payout is its integral. Sureda's ten
// observations fix only the end radii (their first/last ratio 30/112
// matches the plate's last groove against its large end, about 0.3).
function makeFuseeProfile({ largeRadius, revolutionCount, smallRadius }) {
  const observedTotal = SUREDA_TRAVEL_LINES.reduce(
    (sum, value) => sum + value,
    0,
  );
  const turnsPerObservation = revolutionCount / SUREDA_TRAVEL_LINES.length;
  const radiusScale = largeRadius / SUREDA_TRAVEL_LINES[0];
  const sampledRadii = Array.from(
    { length: SUREDA_TRAVEL_LINES.length },
    (_, index) => THREE.MathUtils.lerp(
      largeRadius,
      smallRadius,
      (index + 0.5) / SUREDA_TRAVEL_LINES.length,
    ),
  );
  const knots = [
    { radius: largeRadius, turn: 0 },
    { radius: smallRadius, turn: revolutionCount },
  ];
  const segmentAreas = [];
  let totalArea = 0;
  for (let index = 0; index < knots.length - 1; index += 1) {
    const first = knots[index];
    const second = knots[index + 1];
    const area = (second.turn - first.turn)
      * (first.radius + second.radius) / 2;
    segmentAreas.push(totalArea);
    totalArea += area;
  }

  const segmentIndexAt = (turn) => {
    const boundedTurn = THREE.MathUtils.clamp(turn, 0, revolutionCount);
    for (let index = 0; index < knots.length - 1; index += 1) {
      if (boundedTurn <= knots[index + 1].turn) return index;
    }
    return knots.length - 2;
  };

  const radiusAt = (turn) => {
    const boundedTurn = THREE.MathUtils.clamp(turn, 0, revolutionCount);
    const segmentIndex = segmentIndexAt(boundedTurn);
    const first = knots[segmentIndex];
    const second = knots[segmentIndex + 1];
    const progress = (boundedTurn - first.turn)
      / (second.turn - first.turn);
    return THREE.MathUtils.lerp(first.radius, second.radius, progress);
  };

  const radiusDerivativeAt = (turn) => {
    const boundedTurn = THREE.MathUtils.clamp(
      turn,
      1e-12,
      revolutionCount - 1e-12,
    );
    const segmentIndex = segmentIndexAt(boundedTurn);
    const first = knots[segmentIndex];
    const second = knots[segmentIndex + 1];
    return (second.radius - first.radius)
      / (second.turn - first.turn);
  };

  const radiusIntegralAt = (turn) => {
    const boundedTurn = THREE.MathUtils.clamp(turn, 0, revolutionCount);
    if (boundedTurn === revolutionCount) return totalArea;
    const segmentIndex = segmentIndexAt(boundedTurn);
    const first = knots[segmentIndex];
    const second = knots[segmentIndex + 1];
    const width = boundedTurn - first.turn;
    const slope = (second.radius - first.radius)
      / (second.turn - first.turn);
    return segmentAreas[segmentIndex]
      + first.radius * width
      + slope * width ** 2 / 2;
  };

  return {
    knots,
    largeRadius,
    observedTotal,
    radiusAt,
    radiusDerivativeAt,
    radiusIntegralAt,
    radiusScale,
    sampledRadii,
    smallRadius,
    totalArea,
    turnsPerObservation,
  };
}

class FuseeGrooveSegmentCurve3 extends THREE.Curve {
  constructor(pointAtProgress, startProgress, endProgress) {
    super();
    this.pointAtProgress = pointAtProgress;
    this.startProgress = startProgress;
    this.endProgress = endProgress;
  }

  getPoint(value, target = new THREE.Vector3()) {
    const progress = THREE.MathUtils.lerp(
      this.startProgress,
      this.endProgress,
      value,
    );
    return target.copy(this.pointAtProgress(progress));
  }
}

function makeProfiledFuseeBody({
  bottomY,
  material,
  profile,
  revolutionCount,
  topY,
}) {
  const samples = 100;
  const lathePoints = Array.from({ length: samples + 1 }, (_, index) => {
    const progress = index / samples;
    return new THREE.Vector2(
      profile.radiusAt(progress * revolutionCount) - 0.022,
      THREE.MathUtils.lerp(topY, bottomY, progress),
    );
  });
  const body = new THREE.Mesh(
    new THREE.LatheGeometry(lathePoints, 72),
    material,
  );
  body.userData.role = 'straight-conical-fusee-body';
  return body;
}

function makeStaticGroove({
  bottomY,
  contactPhase,
  material,
  profile,
  revolutionCount,
  topY,
}) {
  const samples = revolutionCount * 32;
  const points = Array.from({ length: samples + 1 }, (_, index) => {
    const progress = index / samples;
    const radius = profile.radiusAt(progress * revolutionCount);
    const phase = contactPhase + FULL_TURN * revolutionCount * progress;
    return new THREE.Vector3(
      Math.cos(phase) * radius,
      THREE.MathUtils.lerp(topY, bottomY, progress),
      Math.sin(phase) * radius,
    );
  });
  const groove = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      revolutionCount * 48,
      0.026,
      7,
      false,
    ),
    material,
  );
  groove.userData.role = 'continuous-helical-fusee-groove';
  return groove;
}

// Replaces a cord's tube by the shared laid rope. Its lay is fixed in the
// cord material, measured from the fixed far end, so travel is the length.
function retainLaidTraverseCord(cord, radius) {
  const mesh = cord.userData.mesh;
  const rebuild = (curve) => {
    const length = curve.getLength();
    const laid = mesh.geometry._laid;
    // The long cords always use the laid rope's maximum sample count, so a
    // new centreline only needs new centres and frames (the index, lay and
    // buffers stay); rebuilding the whole geometry each frame was too slow.
    if (laid && !laid.closed && laid.along === LAID_ROPE.maxSamples
      && length / laid.dims.lay * LAID_ROPE.samplesPerLay > laid.along) {
      const frames = curve.computeFrenetFrames(laid.along, false);
      for (let i = 0; i <= laid.along; i += 1) {
        curve.getPointAt(i / laid.along, laid.centers[i]);
      }
      laid.frames = frames;
      laid.length = length;
      mesh.geometry.parameters.path = curve;
      mesh.geometry.userData.ropeLay.length = length;
      mesh.geometry.setTravel(length);
    } else {
      replaceWithLaidRope(mesh, curve, {
        radius,
        radialSegments: 6,
        travel: length,
      });
    }
    cord.userData.curve = curve;
    cord.userData.length = length;
    cord.userData.updateDistance(0);
  };
  rebuild(cord.userData.curve);
  cord.userData.setCurve = rebuild;
}

// Brown draws the band as a stout laid rope (about a fifteenth of the large
// fusee diameter). The two cords lie side by side in the widened groove, each
// off its centre line by CORD_OFFSET, so they clear where they meet.
const CORD_RADIUS = 0.032;
const CORD_OFFSET = 0.034;

function fuseeCarriageTraverse(movement) {
  const root = new THREE.Group();

  // Sureda's fusee has ten turns, one per observation, and Brown's plan
  // hatches about eleven grooves; ten turns keep both. At the display's
  // one-turn-per-second crank ceiling a full out-and-return cycle takes
  // about 22 s.
  const revolutionCount = 10;
  // Brown's plan draws a stubby straight cone (large diameter about 1.2
  // times its length, the last groove about 0.3 of the large diameter).
  // The pitch radius falls linearly from 0.86 to 0.23, so the stroke is
  // the mean circumference times the turn count (about 34.2).
  const fuseeLargeRadius = 0.86;
  const fuseeSmallRadius = 0.23;
  const carriageStroke = Math.PI * revolutionCount
    * (fuseeLargeRadius + fuseeSmallRadius);
  const fuseeHeight = 1.52;
  const fuseeCenterY = 0.93;
  const fuseeTopY = fuseeCenterY + fuseeHeight / 2;
  const fuseeBottomY = fuseeCenterY - fuseeHeight / 2;
  const trackHalfLength = carriageStroke / 2 + 1.42;
  // The fixed cord ends stand just beyond the ends of the stroke: at each
  // end of the traverse the near anchor stand comes up at the edge of the
  // carriage-following view, so the cord is seen to run to a real fixed
  // attachment. (The cord's free length equals the stroke, so at mid-stroke
  // both anchors are necessarily far off.)
  const anchorHalfSpan = carriageStroke / 2 + 3.2;
  const wheelRadius = 0.42;
  // Brown's plan: the carriage frame bars run along the traverse, the two
  // wheel axles lie parallel to the fusee shaft, and each axle carries one
  // wheel seen edge-on. The rail lies directly beneath the wheels.
  // Brown's wheels stand about 2.0 from the shaft, outside his long bars.
  const truckAxleX = 2.0;
  const truckWheelY = -0.675;
  // Pass 99: the carriage frame (and the rail under its wheels) runs 1.25
  // below the shaft, so Brown's lower long bar can pass under the fusee's
  // large end, 0.71 from the shaft, and still clear the crank's sweep.
  const frameZ = -1.25;
  const railTopZ = frameZ - wheelRadius;
  const supportX = 1.12;
  const crankRadius = 1.3;
  // Pass 96: Brown's plan runs the shaft on from the fusee's large end
  // through two bearing blocks on a bracket to the crank. At the plate's
  // 0.0097 per pixel (fusee large diameter 177 px) the blocks stand 21 px
  // and 90 px and the crank 132 px beyond the large end face.
  const crankBearingYs = [1.9, 2.56];
  const crankHubY = 2.97;
  const shaftBottomY = -0.32;
  // The rendered cycle starts mid-stroke, where Brown draws the band
  // crossing the middle of the fusee and both remote anchors lie off-plate.
  const contactPhase = Math.PI / 2;
  // The cruise turns the crank at 10 / (10.7 - 0.6) = 0.99 turn per second,
  // just inside the display's sustained-rotation ceiling.
  const strokeDuration = 10.7;
  const dwellDuration = 0.3;
  const rampDuration = 0.6;
  const cyclePeriod = 2 * (strokeDuration + dwellDuration);
  const displayTimeOffset = strokeDuration / 2;
  const profile = makeFuseeProfile({
    largeRadius: fuseeLargeRadius,
    revolutionCount,
    smallRadius: fuseeSmallRadius,
  });
  const largeRadius = profile.largeRadius;
  const smallRadius = profile.smallRadius;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.58,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.43,
  });
  const fuseeMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.56,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.45 });

  const track = new THREE.Group();
  track.userData.role = 'fixed-parallel-carriage-rails';
  {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(trackHalfLength * 2 + 0.8, 0.10, 0.10),
      frameMaterial,
    );
    rail.position.set(0, truckWheelY, railTopZ - 0.05);
    rail.userData.role = 'fixed-carriage-guide-rail';
    track.add(rail);
  }
  for (const x of [-trackHalfLength - 0.25, trackHalfLength + 0.25]) {
    const sleeper = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 1.36, 0.12),
      frameMaterial,
    );
    sleeper.position.set(x, truckWheelY, railTopZ - 0.16);
    sleeper.userData.role = 'rail-end-cross-tie';
    track.add(sleeper);
  }
  root.add(track);

  const carriage = new THREE.Group();
  carriage.userData.role = 'fusee-bearing-traversing-carriage';
  const carriageBed = new THREE.Mesh(
    new THREE.BoxGeometry(2 * truckAxleX + 0.5, 0.13, 0.13),
    matte(PALETTE.driven, { metalness: 0.12, roughness: 0.62 }),
  );
  carriageBed.position.set(0, 2 * truckWheelY + 0.25, frameZ);
  carriageBed.userData.role = 'traversing-carriage-bed';
  carriage.add(carriageBed);

  const carriageWheels = [];
  for (const x of [-truckAxleX, truckAxleX]) {
    // Axis -Y rolls the wheel forward on the rail beneath it (-Z).
    const wheel = makePulley({
      axis: new THREE.Vector3(0, -1, 0),
      bore: 0.042,
      color: PALETTE.driven,
      grooves: 0,
      radius: wheelRadius,
      spokes: 0,
      width: 0.13,
    });
    wheel.position.set(x, truckWheelY, frameZ);
    // Brown's edge-on wheels carry no white index patches.
    for (const mark of [...wheel.userData.rotor.children]) {
      if (mark.geometry?.type === 'BoxGeometry') wheel.userData.rotor.remove(mark);
    }
    wheel.userData.role = 'carriage-wheel-rolling-without-slip';
    carriage.add(wheel);
    carriageWheels.push(wheel);
  }

  const rearSupportZ = frameZ;
  const supportLeft = makeBeam(
    new THREE.Vector3(-supportX, -0.25, rearSupportZ),
    new THREE.Vector3(-supportX, 2.02, rearSupportZ),
    { color: PALETTE.frame, depth: 0.13, thickness: 0.14 },
  );
  const supportRight = makeBeam(
    new THREE.Vector3(supportX, -0.25, rearSupportZ),
    new THREE.Vector3(supportX, 2.02, rearSupportZ),
    { color: PALETTE.frame, depth: 0.13, thickness: 0.14 },
  );
  const supportCrown = makeBeam(
    new THREE.Vector3(-supportX, 2.02, rearSupportZ),
    new THREE.Vector3(supportX, 2.02, rearSupportZ),
    { color: PALETTE.frame, depth: 0.13, thickness: 0.14 },
  );
  for (const support of [supportLeft, supportRight, supportCrown]) {
    support.userData.role = 'carriage-mounted-fusee-bearing-frame';
    carriage.add(support);
  }

  // The shaft runs from its small-end bearing into the crank hub.
  const fuseeShaft = cylinderAlongY(0.065, crankHubY - shaftBottomY, darkMaterial, 24);
  fuseeShaft.position.y = (crankHubY + shaftBottomY) / 2;
  fuseeShaft.userData.role = 'vertical-fusee-and-crank-shaft';
  carriage.add(fuseeShaft);
  for (const y of [-0.25, ...crankBearingYs]) {
    const bearing = ringAroundY(0.15, 0.052, frameMaterial, 28);
    bearing.position.y = y;
    bearing.userData.role = 'carriage-mounted-fusee-shaft-bearing';
    carriage.add(bearing);
  }

  const fuseeRotor = new THREE.Group();
  fuseeRotor.userData.axis = Y_AXIS.clone();
  fuseeRotor.userData.role = 'uniformly-rotated-profiled-fusee-and-crank';
  const fuseeBody = makeProfiledFuseeBody({
    bottomY: fuseeBottomY,
    material: fuseeMaterial,
    profile,
    revolutionCount,
    topY: fuseeTopY,
  });
  const fuseeGroove = makeStaticGroove({
    bottomY: fuseeBottomY,
    contactPhase,
    material: darkMaterial,
    profile,
    revolutionCount,
    topY: fuseeTopY,
  });
  fuseeRotor.add(fuseeBody, fuseeGroove);

  for (const { radius, y } of [
    { radius: largeRadius, y: fuseeTopY },
    { radius: smallRadius, y: fuseeBottomY },
  ]) {
    const endCollar = cylinderAlongY(radius, 0.055, fuseeMaterial, 48);
    endCollar.position.y = y;
    endCollar.userData.role = 'fusee-end-face';
    fuseeRotor.add(endCollar);
  }

  const spinIndicatorPoints = Array.from({ length: 28 }, (_, index) => {
    const progress = index / 27;
    const turn = progress * revolutionCount;
    return new THREE.Vector3(
      profile.radiusAt(turn) + 0.033,
      THREE.MathUtils.lerp(fuseeTopY, fuseeBottomY, progress),
      0,
    );
  });
  const spinIndicator = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(spinIndicatorPoints),
      72,
      0.022,
      7,
      false,
    ),
    whiteMaterial,
  );
  spinIndicator.userData.role = 'white-fusee-spin-rate-index';
  fuseeRotor.add(spinIndicator);

  const crankHub = cylinderAlongY(0.12, 0.12, darkMaterial, 24);
  crankHub.position.y = crankHubY;
  crankHub.userData.role = 'fusee-crank-hub';
  // Pass 92: Brown's crank is a flat arm carrying the usual turned handle
  // (a slim neck swelling to a bulb, about 0.32 of the crank radius long).
  // The arm is one extrusion whose ends are arcs concentric with the handle
  // and the shaft, so the handle's foot stands inside the arm's end with a
  // margin all round; its top lies 0.005 under the hub's top face.
  const crankArmTopY = crankHubY + 0.055;
  const crankArm = new THREE.Mesh(
    crankArmGeometry({ handleX: -crankRadius, handleEndRadius: 0.075,
      hubEndRadius: 0.075, bottomY: crankArmTopY - 0.10, topY: crankArmTopY }),
    fuseeMaterial,
  );
  crankArm.userData.role = 'source-visible-fusee-crank-arm';
  const crankHandle = new THREE.Mesh(
    turnedHandleGeometry({ height: 0.41 + HANDLE_FOOT_EMBED, side: [
      [0.05, 0], [0.038, 0.12], [0.036, 0.42], [0.06, 0.62], [0.082, 0.8],
    ], shank: handleShank(0.10) }), // pass 98: flush with the arm's back face
    darkMaterial,
  );
  crankHandle.position.set(-crankRadius, crankArmTopY - HANDLE_FOOT_EMBED, 0);
  crankHandle.userData.role = 'source-visible-fusee-crank-handle';
  fuseeRotor.add(crankHub, crankArm, crankHandle);
  carriage.add(fuseeRotor);
  root.add(carriage);

  const fixedAnchors = [];
  const leftAnchor = new THREE.Vector3(
    -anchorHalfSpan,
    fuseeBottomY,
    smallRadius,
  );
  const rightAnchor = new THREE.Vector3(
    anchorHalfSpan,
    fuseeTopY,
    largeRadius,
  );
  for (const [side, point] of [
    ['left-lower', leftAnchor],
    ['right-upper', rightAnchor],
  ]) {
    // Brown's band runs off the plate at both ends; no anchor hardware is
    // drawn, so each fixed end is an ideal fixed point where the laid band
    // simply ends, far beyond the crop (p62 support rule).
    const stand = new THREE.Group();
    stand.position.copy(point);
    stand.userData.role = `${side}-fixed-cord-end-point`;
    root.add(stand);
    fixedAnchors.push(stand);
  }

  const groovePointAt = (progress, state) => {
    const turn = progress * revolutionCount;
    const radius = profile.radiusAt(turn);
    const localPhase = contactPhase + FULL_TURN * turn;
    const worldPhase = localPhase - state.shaftAngle;
    return new THREE.Vector3(
      state.carriagePosition + Math.cos(worldPhase) * radius,
      THREE.MathUtils.lerp(fuseeTopY, fuseeBottomY, progress),
      Math.sin(worldPhase) * radius,
    );
  };

  const grooveTangentAt = (progress, state, direction) => {
    const step = 1e-5;
    const before = groovePointAt(
      THREE.MathUtils.clamp(progress - step, 0, 1),
      state,
    );
    const after = groovePointAt(
      THREE.MathUtils.clamp(progress + step, 0, 1),
      state,
    );
    const tangent = after.sub(before);
    if (tangent.lengthSq() < 1e-18) {
      tangent.set(-1, -fuseeHeight / (FULL_TURN * revolutionCount), 0);
    }
    return tangent.normalize().multiplyScalar(direction);
  };

  const makeCordCurve = (state, side) => {
    const progress = state.grooveProgress;
    const isLeft = side === 'left';
    const startProgress = isLeft ? 0 : 1;
    const anchor = isLeft ? leftAnchor : rightAnchor;
    const path = new THREE.CurvePath();
    const wrappedProgress = Math.abs(progress - startProgress);
    if (wrappedProgress > 1e-8) {
      path.add(new FuseeGrooveSegmentCurve3(
        (sampleProgress) => groovePointAt(sampleProgress, state).add(new THREE.Vector3(0,isLeft?CORD_OFFSET:-CORD_OFFSET,0)),
        startProgress,
        progress,
      ));
    }
    const contact = groovePointAt(progress, state).add(new THREE.Vector3(0,isLeft?CORD_OFFSET:-CORD_OFFSET,0));
    const freeDirection = anchor.clone().sub(contact);
    const freeLength = freeDirection.length();
    const wrappedDirection = grooveTangentAt(
      progress,
      state,
      isLeft ? 1 : -1,
    );
    const handleLength = Math.min(0.24, freeLength * 0.16);
    const finalDirection = freeDirection.clone().normalize();
    path.add(new THREE.CubicBezierCurve3(
      contact,
      contact.clone().addScaledVector(wrappedDirection, handleLength),
      anchor.clone().addScaledVector(finalDirection, -handleLength),
      anchor,
    ));
    path.userData = {
      contact: contact.clone(),
      freeLength,
      side,
      wrappedProgress,
    };
    return path;
  };

  const stateAtDriveTurns = (
    driveTurns,
    driveTurnsPerSecond = 0,
    driveTurnsAcceleration = 0,
  ) => {
    const boundedTurns = THREE.MathUtils.clamp(
      driveTurns,
      0,
      revolutionCount,
    );
    const grooveProgress = boundedTurns / revolutionCount;
    const localRadius = profile.radiusAt(boundedTurns);
    const radiusDerivative = profile.radiusDerivativeAt(boundedTurns);
    const displacement = FULL_TURN
      * profile.radiusIntegralAt(boundedTurns);
    const displacementVelocity = FULL_TURN
      * localRadius * driveTurnsPerSecond;
    const displacementAcceleration = FULL_TURN * (
      radiusDerivative * driveTurnsPerSecond ** 2
      + localRadius * driveTurnsAcceleration
    );
    const carriagePosition = carriageStroke / 2 - displacement;
    const carriageVelocity = -displacementVelocity;
    const carriageAcceleration = -displacementAcceleration;
    const shaftAngle = FULL_TURN * boundedTurns;
    const shaftAngularSpeed = FULL_TURN * driveTurnsPerSecond;
    const shaftAngularAcceleration = FULL_TURN
      * driveTurnsAcceleration;
    const contactY = THREE.MathUtils.lerp(
      fuseeTopY,
      fuseeBottomY,
      grooveProgress,
    );
    const contactPoint = new THREE.Vector3(
      carriagePosition,
      contactY,
      localRadius,
    );
    const surfaceTangentialVelocity = shaftAngularSpeed * localRadius;
    const surfaceContactVelocityX = carriageVelocity
      + surfaceTangentialVelocity;
    const wheelAngle = displacement / wheelRadius;
    const wheelAngularSpeed = displacementVelocity / wheelRadius;
    return {
      carriageAcceleration,
      carriagePosition,
      carriageVelocity,
      contactPoint,
      displacement,
      displacementAcceleration,
      displacementVelocity,
      driveTurns: boundedTurns,
      driveTurnsAcceleration,
      driveTurnsPerSecond,
      grooveProgress,
      localRadius,
      radiusDerivative,
      shaftAngle,
      shaftAngularAcceleration,
      shaftAngularSpeed,
      surfaceContactVelocityX,
      surfaceTangentialVelocity,
      wheelAngle,
      wheelAngularSpeed,
    };
  };

  const driveScheduleAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cyclePeriod);
    if (cycleTime <= strokeDuration) {
      const stroke = easedConstantSpeedStroke(
        cycleTime,
        strokeDuration,
        rampDuration,
      );
      return {
        acceleration: revolutionCount * stroke.acceleration,
        phase: 'large-to-small-radius-stroke',
        turns: revolutionCount * stroke.progress,
        velocity: revolutionCount * stroke.velocity,
      };
    }
    if (cycleTime < strokeDuration + dwellDuration) {
      return {
        acceleration: 0,
        phase: 'small-radius-end-dwell',
        turns: revolutionCount,
        velocity: 0,
      };
    }
    const returnStart = strokeDuration + dwellDuration;
    if (cycleTime <= returnStart + strokeDuration) {
      const stroke = easedConstantSpeedStroke(
        cycleTime - returnStart,
        strokeDuration,
        rampDuration,
      );
      return {
        acceleration: -revolutionCount * stroke.acceleration,
        phase: 'small-to-large-radius-return',
        turns: revolutionCount * (1 - stroke.progress),
        velocity: -revolutionCount * stroke.velocity,
      };
    }
    return {
      acceleration: 0,
      phase: 'large-radius-end-dwell',
      turns: 0,
      velocity: 0,
    };
  };

  const stateAtTime = (time) => {
    const schedule = driveScheduleAtTime(time);
    return {
      ...stateAtDriveTurns(
        schedule.turns,
        schedule.velocity,
        schedule.acceleration,
      ),
      cycleTime: THREE.MathUtils.euclideanModulo(time, cyclePeriod),
      phase: schedule.phase,
    };
  };

  const initialState = stateAtTime(displayTimeOffset);
  const leftCord = makeDynamicMovingBelt(
    makeCordCurve(initialState, 'left'),
    {
      closed: false,
      color: PALETTE.belt,
      markerCount: 9,
      radius: 0.034,
      tubularSegments: 192,
    },
  );
  leftCord.userData.role = 'first-opposed-fusee-cord';
  leftCord.userData.markers = leftCord.children.slice(0, 9);
  leftCord.userData.markers.forEach((marker, index) => {
    marker.userData.role = `fixed-material-marker-on-first-cord-${index}`;
  });
  const rightCord = makeDynamicMovingBelt(
    makeCordCurve(initialState, 'right'),
    {
      closed: false,
      // Both cords share Brown's one band colour: side by side in the groove
      // they read as the single band crossing the fusee.
      color: PALETTE.belt,
      markerCount: 9,
      radius: 0.034,
      tubularSegments: 192,
    },
  );
  rightCord.userData.role = 'second-opposed-fusee-cord';
  rightCord.userData.markers = rightCord.children.slice(0, 9);
  rightCord.userData.markers.forEach((marker, index) => {
    marker.userData.role = `fixed-material-marker-on-second-cord-${index}`;
  });
  root.add(leftCord, rightCord);

  const contacts = {
    carriageWheels: carriageWheels.map(() => ({
      rollingVelocityError: 0,
    })),
    fuseeCords: {
      commonTakeoffSeparation: 0,
      tangentialVelocityError: 0,
    },
  };

  const update = (time) => {
    const state = stateAtTime(time + displayTimeOffset);
    carriage.position.x = state.carriagePosition;
    if (root.userData.followCarriage) root.position.y = -state.carriagePosition;
    fuseeRotor.rotation.y = state.shaftAngle;
    carriageWheels.forEach((wheel, index) => {
      setSpin(wheel, state.wheelAngle);
      contacts.carriageWheels[index].rollingVelocityError =
        state.carriageVelocity
        + state.wheelAngularSpeed * wheelRadius;
    });
    const leftCurve = makeCordCurve(state, 'left');
    const rightCurve = makeCordCurve(state, 'right');
    leftCord.userData.setCurve(leftCurve);
    rightCord.userData.setCurve(rightCurve);
    // Marker coordinates are fixed fractions of each complete open cord.
    // Reparameterising by arc length lets each sphere cross the changing
    // free/wrapped boundary continuously instead of jumping at curve joins.
    leftCord.userData.updateDistance(0);
    rightCord.userData.updateDistance(0);
    contacts.fuseeCords.commonTakeoffSeparation =
      leftCurve.userData.contact.distanceTo(rightCurve.userData.contact);
    contacts.fuseeCords.tangentialVelocityError =
      state.surfaceContactVelocityX;
    root.userData.currentState = state;
    root.userData.cordState = {
      firstFreeLength: leftCurve.userData.freeLength,
      firstWrappedProgress: leftCurve.userData.wrappedProgress,
      secondFreeLength: rightCurve.userData.freeLength,
      secondWrappedProgress: rightCurve.userData.wrappedProgress,
    };
    return state;
  };

  root.userData = {
    archetype: 'double-cord-profiled-fusee-carriage',
    blocks: {
      carriage,
      carriageBed,
      carriageWheels,
      fixedAnchors,
      firstCord: leftCord,
      fuseeBody,
      fuseeGroove,
      fuseeRotor,
      secondCord: rightCord,
      spinIndicator,
      track,
    },
    contacts,
    degreesOfFreedom: {
      input: 'one prescribed rotation of the carriage-mounted fusee shaft',
      mechanism: 1,
      output:
        'carriage translation is constrained by the two inextensible opposed cords',
    },
    fidelity: 'authored',
    geometry: {
      carriageStroke,
      cyclePeriod,
      displayTimeOffset,
      fuseeBottomY,
      fuseeHeight,
      fuseeTopY,
      largeRadius,
      revolutionCount,
      smallRadius,
      trackHalfLength,
      anchorHalfSpan,
      crankBearingYs: [...crankBearingYs],
      crankHubY,
      crankRadius,
      shaftBottomY,
      wheelRadius,
    },
    historicalTrial: {
      carriageTravelLines: SUREDA_TRAVEL_LINES.slice(),
      profileInterpretation:
        'only the first/last observation ratio is used: Brown draws a straight cone, so the pitch radius falls linearly between them and the carriage speed falls linearly with the turn',
      totalTravelLines: profile.observedTotal,
    },
    mechanism:
      'carriage-mounted-profiled-fusee-rolling-along-two-oppositely-wound-fixed-cords',
    officialDescription: movement.description,
    profile: {
      knots: profile.knots.map(({ radius, turn }) => ({ radius, turn })),
      radiusAtTurns: profile.radiusAt,
      radiusDerivativeAtTurns: profile.radiusDerivativeAt,
      radiusIntegralAtTurns: profile.radiusIntegralAt,
      radiusScale: profile.radiusScale,
      sampledRadii: profile.sampledRadii.slice(),
    },
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      borgnisSureda: {
        figure: 'plate XIII, figure 3',
        publication:
          'J.-A. Borgnis, Traite complet de mecanique appliquee aux arts: Des machines propres a confectionner les etoffes',
        publicationYear: 1820,
        use:
          'establishes that the fusee is carried by the traversing carriage, that two cords occupy the groove in opposite senses and meet at one takeoff point, and that one winds while the other unwinds',
      },
      brownPlate358: {
        bandLimitLeft: new THREE.Vector2(236, 16),
        bandLimitRight: new THREE.Vector2(325, 25),
        carriageLowerRoller: new THREE.Vector2(445, 441),
        carriageUpperRoller: new THREE.Vector2(445, 105),
        currentBandAtAxis: new THREE.Vector2(294, 304),
        fuseeAxisLeft: new THREE.Vector2(64, 304),
        fuseeAxisRight: new THREE.Vector2(371, 304),
        fuseeLargeBottom: new THREE.Vector2(214, 394),
        fuseeLargeTop: new THREE.Vector2(214, 220),
        fuseeSmallBottom: new THREE.Vector2(361, 318),
        fuseeSmallTop: new THREE.Vector2(361, 290),
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 8,
      },
      fullerAnalyticalTable: {
        movementNumber: 100,
        publication:
          'John Douglas Pitts Fuller, A Key to the Analytical Table of Mechanical Movements',
        publicationYear: 1834,
        use:
          'direct predecessor of Brown 358; identifies the spiral fusee as the element varying carriage traverse according to the acting diameter',
      },
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        edition: 21,
        publicationYear: 1908,
      },
    },
    stateAtDriveTurns,
    stateAtTime,
    timeline: {
      demonstrationPeriod: cyclePeriod,
      dwellDuration,
      note:
        'Brown supplies no timing; the smooth out-and-return schedule is an explicit display cycle, while both working strokes obey the same source-supported fusee law',
      rampDuration,
      strokeDuration,
    },
    transmission: {
      doubleCordLaw:
        'the first cord winds by exactly the length released by the second; both meet at one takeoff point and therefore hold the carriage positively in either direction',
      localNoSlipLaw:
        'carriageVelocity + shaftAngularSpeed * localFuseeRadius = 0',
      profileLaw:
        'd(carriage displacement)/d(fusee angle) = local fusee pitch radius',
      wheelLaw:
        'wheelAngularSpeed = -carriageVelocity / wheelRadius',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-trackHalfLength - 0.55, -0.86, -0.82),
    new THREE.Vector3(trackHalfLength + 0.55, 2.62, 0.82),
  );
  root.userData.groundFloorY = -0.88;
  correctCordTraverseParts(root,358,update);
  // The carriage-following view holds the carriage still, so the traverse
  // reads through the fixed bands sliding past it. Brown draws each band as
  // a laid rope: the shared three-strand rope, its lay fixed in the material
  // at the fixed far end (the curve's end), makes that sliding visible.
  for (const cord of [leftCord, rightCord]) {
    retainLaidTraverseCord(cord, CORD_RADIUS);
    cord.userData.mesh.userData.role = cord === leftCord
      ? 'finite-fusee-cord-1' : 'finite-fusee-cord-2';
  }
  root.userData.cameraMaxDistance = 5 * (2 * anchorHalfSpan);
  update(0);
  markShadows(root);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredFuseeTraverseMovement(movement) {
  if (movement.id === 358) return fuseeCarriageTraverse(movement);
  return null;
}
