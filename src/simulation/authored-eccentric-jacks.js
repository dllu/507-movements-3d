import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import {
  PALETTE,
  markShadows,
  matte,
} from './primitives.js';

import {fitPistonGuide,boredCylinderGeometry} from './piston-guide-parts.js';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
import {pawlPolygon,clearRackPawl,boundedRetreat,firstClearRetreat} from './lifting-jack-contact.js';

const FULL_TURN = Math.PI * 2;

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function quinticState(parameter) {
  const u = THREE.MathUtils.clamp(parameter, 0, 1);
  return {
    acceleration: 60 * u * (1 - u) * (1 - 2 * u),
    rate: 30 * u ** 2 * (1 - u) ** 2,
    value: u ** 3 * (10 + u * (-15 + 6 * u)),
  };
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function refineExtremum(fn, approximateAngle, maximize, halfWidth) {
  let lower = approximateAngle - halfWidth;
  let upper = approximateAngle + halfWidth;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const first = lower + (upper - lower) / 3;
    const second = upper - (upper - lower) / 3;
    const firstValue = fn(first);
    const secondValue = fn(second);
    const moveLower = maximize
      ? firstValue < secondValue
      : firstValue > secondValue;
    if (moveLower) lower = first;
    else upper = second;
  }
  return (lower + upper) / 2;
}

function findPeriodicExtrema(fn) {
  const samples = 2048;
  const step = FULL_TURN / samples;
  let minimum = { angle: 0, value: fn(0) };
  let maximum = { angle: 0, value: fn(0) };
  for (let index = 1; index < samples; index += 1) {
    const angle = index * step;
    const value = fn(angle);
    if (value < minimum.value) minimum = { angle, value };
    if (value > maximum.value) maximum = { angle, value };
  }
  const lowAngle = refineExtremum(
    fn,
    minimum.angle,
    false,
    step * 1.4,
  );
  let highAngle = refineExtremum(
    fn,
    maximum.angle,
    true,
    step * 1.4,
  );
  while (highAngle <= lowAngle) highAngle += FULL_TURN;
  return {
    highAngle,
    highValue: fn(highAngle),
    lowAngle,
    lowValue: fn(lowAngle),
  };
}

function makeVerticalRatchetRack({
  bodyMaterial,
  bodyWidth,
  depth,
  driveReferenceY,
  rackLength,
  saddleMaterial,
  toothDepth,
  toothMaterial,
  toothPitch,
  whiteMaterial,
}) {
  const group = new THREE.Group();
  group.userData.role = 'vertically-guided-load-bearing-ratchet-rack';

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth, rackLength, depth),
    bodyMaterial,
  );
  body.position.y = -0.755 + rackLength / 2;
  body.userData.role = 'vertical-jack-rack-bar';
  group.add(body);

  const toothShape = new THREE.Shape();
  toothShape.moveTo(0, -toothPitch / 2);
  toothShape.lineTo(toothDepth, -toothPitch / 2);
  toothShape.lineTo(0, toothPitch / 2);
  toothShape.closePath();
  const toothGeometry = new THREE.ExtrudeGeometry(toothShape, {
    bevelEnabled: false,
    curveSegments: 1,
    depth,
    steps: 1,
  });
  toothGeometry.translate(0, 0, -depth / 2);

  const teeth = [];
  const toothSeatOffsets = [];
  for (let toothIndex = -13; toothIndex <= 4; toothIndex += 1) {
    const tooth = new THREE.Mesh(toothGeometry, toothMaterial);
    const seatY = driveReferenceY + toothIndex * toothPitch;
    tooth.position.set(bodyWidth / 2, seatY + toothPitch / 2, 0);
    tooth.userData.materialToothIndex = toothIndex;
    tooth.userData.role = 'one-way-vertical-rack-tooth';
    tooth.userData.seatY = seatY;
    group.add(tooth);
    teeth.push(tooth);
    toothSeatOffsets.push(seatY);
  }

  const saddle = new THREE.Group();
  saddle.position.set(0, -0.755 + rackLength + 0.040, 0);
  saddle.userData.role = 'jack-load-saddle';
  const saddleStem = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.48, depth * 0.92),
    saddleMaterial,
  );
  saddleStem.position.y = 0.18;
  saddleStem.userData.role = 'jack-saddle-stem';
  saddle.add(saddleStem);
  const saddlePlate = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, 0.24, 1.05),
    saddleMaterial,
  );
  saddlePlate.position.y = 0.48;
  saddlePlate.userData.role = 'jack-load-bearing-top-plate';
  saddle.add(saddlePlate);
  group.add(saddle);

  const liftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, toothPitch * 0.72, 0.035),
    whiteMaterial,
  );
  liftIndex.position.set(-bodyWidth / 2 - 0.06, 1.15, depth / 2 + 0.02);
  liftIndex.userData.role = 'white-rack-vertical-lift-index';
  group.add(liftIndex);

  group.userData.body = body;
  group.userData.liftIndex = liftIndex;
  group.userData.saddle = saddle;
  group.userData.teeth = teeth;
  group.userData.toothSeatOffsets = toothSeatOffsets;
  return markShadows(group);
}

function makeJackFrame({
  rackBodyWidth,
  rackGuideTop,
  material,
  toothPitch,
  whiteMaterial,
}) {
  const group = new THREE.Group();
  group.userData.role = 'fixed-cast-jack-frame-and-rack-guide';

  // Brown draws the cast stand in section: a hollow column whose two
  // hatched walls flare concavely into stepped feet either side of the rack,
  // the right wall stopping below the eccentric.  A thin sole plate ties the
  // two walls on the ground line.
  const standDepth = 1.0;
  const standBackZ = -0.55;
  const groundY = -1.17;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(3.02, 0.12, standDepth),
    material,
  );
  base.position.set(0.16, groundY + 0.06, standBackZ + standDepth / 2);
  base.userData.role = 'wide-jack-foot';
  group.add(base);

  const guideBack = new THREE.Mesh(
    new THREE.BoxGeometry(rackBodyWidth + 0.42, rackGuideTop + 0.82, 0.24),
    material,
  );
  guideBack.position.set(0, (rackGuideTop - 0.62) / 2, -0.47);
  guideBack.userData.role = 'fixed-rear-rack-guide-cheek';
  group.add(guideBack);

  const wallProfile = (side) => {
    // side -1: left wall (inner edge beside the rack body); side 1: right
    // wall (inner edge clear of the tooth tips).
    const inner = side < 0 ? -0.33 : 0.54;
    const top = side < 0 ? 2.3 : 1.12;
    const neck = side < 0 ? 0.19 : 0.26;
    const bottom = groundY + 0.12;
    const x = (offset) => inner + side * offset;
    const shape = new THREE.Shape();
    shape.moveTo(x(0), bottom);
    shape.lineTo(x(0), top);
    shape.lineTo(x(neck), top);
    shape.lineTo(x(neck + 0.03), 0.42);
    shape.quadraticCurveTo(x(neck + 0.05), -0.52, x(0.67), -0.60);
    shape.lineTo(x(0.80), -0.60);
    shape.lineTo(x(0.80), -0.84);
    shape.lineTo(x(1.02), -0.84);
    shape.lineTo(x(1.02), bottom);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      bevelEnabled: false,
      curveSegments: 18,
      depth: standDepth,
    });
    geometry.translate(0, 0, standBackZ);
    return geometry;
  };

  const feet = [];
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(wallProfile(side), material);
    foot.userData.role = 'cast-jack-frame-flared-foot';
    group.add(foot);
    feet.push(foot);
  }

  const scaleTicks = [];
  for (let index = 0; index <= 3; index += 1) {
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.035, 0.035),
      whiteMaterial,
    );
    tick.position.set(-0.61, 0.58 + index * toothPitch, 0.35);
    tick.userData.role = 'white-one-pitch-lift-scale-tick';
    tick.userData.tickIndex = index;
    group.add(tick);
    scaleTicks.push(tick);
  }

  group.userData.base = base;
  group.userData.feet = feet;
  group.userData.guideBack = guideBack;
  group.userData.scaleTicks = scaleTicks;
  return markShadows(group);
}

function eccentricPawlJack(movement) {
  const root = new THREE.Group();

  // Movement 389 has no official animation or dimensions.  The geometry is
  // proportioned from Brown's plate and closed as an eccentric strap whose
  // rigid pawl nose is constrained to the rack face. Follower travel includes
  // tooth pitch, finite-pawl overtravel and return undershoot.
  const rackFaceX = 0.49;
  const eccentricShaft = new THREE.Vector3(1.23, 2.02, 0);
  const eccentricity = 0.16;
  const drivePawlLength = 1.20;
  const eccentricDiskRadius = 0.48;
  const eccentricStrapRadius = 0.512;
  const rackBodyWidth = 0.60;
  const rackDepth = 0.54;
  const toothDepth = .21;
  const liftStrokeCount = 3;
  const strokeDuration = 2.2;
  const operatingDuration = liftStrokeCount * strokeDuration;
  const raisedDwellDuration = 0.7;
  const resetDuration = operatingDuration;
  const bottomDwellDuration = 0.5;
  const cycleDuration = operatingDuration + raisedDwellDuration
    + resetDuration + bottomDwellDuration;
  const returnClearance = 0.24;
  const parkFraction=.75;

  const camCenterAtAngle = (angle) => new THREE.Vector3(
    eccentricShaft.x - eccentricity * Math.cos(angle),
    eccentricShaft.y + eccentricity * Math.sin(angle),
    0,
  );
  const driveNoseAtAngle = (angle, clearance = 0) => {
    const camCenter = camCenterAtAngle(angle);
    const x = rackFaceX + clearance;
    const horizontal = camCenter.x - x;
    const vertical = Math.sqrt(
      drivePawlLength ** 2 - horizontal ** 2,
    );
    return new THREE.Vector3(x, camCenter.y + vertical, 0);
  };
  const engagedNoseY = (angle) => driveNoseAtAngle(angle).y;
  const followerExtrema = findPeriodicExtrema(engagedNoseY);
  const followerExcursion=followerExtrema.highValue-followerExtrema.lowValue;
  const seatingOvertravel=.10, returnUndershoot=.04;
  const toothPitch=followerExcursion-seatingOvertravel-returnUndershoot;
  const driveReferenceY=followerExtrema.lowValue+returnUndershoot;
  const rackLength=driveReferenceY+5*toothPitch+0.875;
  let startLow=followerExtrema.lowAngle,startHigh=followerExtrema.highAngle;
  for(let i=0;i<60;i++){const mid=(startLow+startHigh)/2;if(engagedNoseY(mid)<driveReferenceY)startLow=mid;else startHigh=mid;}
  const cycleStartAngle=(startLow+startHigh)/2;
  const drivePowerAngle=followerExtrema.highAngle-cycleStartAngle;
  const drivePowerFraction=drivePowerAngle/FULL_TURN;
  let seatLow=followerExtrema.highAngle,seatHigh=followerExtrema.lowAngle+FULL_TURN;
  for(let i=0;i<60;i++){const mid=(seatLow+seatHigh)/2;if(engagedNoseY(mid)>driveReferenceY+toothPitch)seatLow=mid;else seatHigh=mid;}
  const transferFraction=((seatLow+seatHigh)/2-cycleStartAngle)/FULL_TURN;
  const returnEndFraction=(followerExtrema.lowAngle+FULL_TURN-cycleStartAngle)/FULL_TURN;
  const returnRetreat=phase=>returnClearance*Math.sin(Math.PI*THREE.MathUtils.clamp((phase-transferFraction)/(returnEndFraction-transferFraction),0,1))**2;
  const parkedClearance=returnRetreat(parkFraction);
  const parkedAngle=cycleStartAngle+FULL_TURN*parkFraction;
  const rackTriangles=Array.from({length:18},(_,i)=>{
    const y=driveReferenceY+(i-13)*toothPitch;
    return [[rackBodyWidth/2,y],[rackBodyWidth/2+toothDepth,y],[rackBodyWidth/2,y+toothPitch]];
  });
  const driveOutline=pawlPolygon(drivePawlLength);
  const stopBaseToothIndex = 3;
  const stopSeatY = driveReferenceY + stopBaseToothIndex * toothPitch;
  const holdingPawlLength = 0.82;
  const holdingVerticalOffset = 0.48;
  const holdingHorizontalOffset = Math.sqrt(
    holdingPawlLength ** 2 - holdingVerticalOffset ** 2,
  );
  const holdingPivot = new THREE.Vector3(
    rackFaceX + holdingHorizontalOffset,
    stopSeatY - holdingVerticalOffset,
    0,
  );
  const holdingBaseAngle = Math.atan2(
    holdingVerticalOffset,
    -holdingHorizontalOffset,
  );
  const holdOutline=pawlPolygon(holdingPawlLength);
  const crestRetreat=firstClearRetreat(a=>clearRackPawl(holdOutline,holdingPivot,holdingBaseAngle-a,rackTriangles,toothPitch-1e-7),0,.85);

  const rackMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.58,
  });
  const toothMaterial = matte(PALETTE.ink, {
    metalness: 0.26,
    roughness: 0.47,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.16,
    roughness: 0.55,
  });
  const pawlMaterial = matte(PALETTE.brass, {
    metalness: 0.18,
    roughness: 0.52,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.10,
    roughness: 0.69,
  });
  const pinMaterial = matte(PALETTE.ink, {
    metalness: 0.31,
    roughness: 0.42,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0,
    roughness: 0.43,
  });

  const frame = makeJackFrame({
    material: frameMaterial,
    rackBodyWidth,
    rackGuideTop: 2.2,
    toothPitch,
    whiteMaterial,
  });
  root.add(frame);

  const rack = makeVerticalRatchetRack({
    bodyMaterial: rackMaterial,
    bodyWidth: rackBodyWidth,
    depth: rackDepth,
    driveReferenceY,
    rackLength,
    saddleMaterial: rackMaterial,
    toothDepth,
    toothMaterial,
    toothPitch,
    whiteMaterial,
  });
  root.add(rack);

  const eccentricRotor = new THREE.Group();
  eccentricRotor.position.copy(eccentricShaft);
  eccentricRotor.userData.role = 'continuously-rotating-eccentric-driver';
  root.add(eccentricRotor);
  const eccentricDisk = cylinderAlongZ(
    eccentricDiskRadius,
    0.44,
    driverMaterial,
    56,
  );
  eccentricDisk.geometry.dispose();
  eccentricDisk.geometry=plate(clip.difference(poly(circle([0,0],eccentricDiskRadius,96)),poly(circle([eccentricity,0],.134,64))),-.22,.22);
  eccentricDisk.rotation.x=0;
  eccentricDisk.position.x = -eccentricity;
  eccentricDisk.userData.role = 'offset-eccentric-disk';
  eccentricRotor.add(eccentricDisk);
  const eccentricIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.055, 0.035),
    whiteMaterial,
  );
  eccentricIndex.position.set(-eccentricity + 0.19, 0, 0.245);
  eccentricIndex.userData.role = 'white-eccentric-disk-spin-index';
  eccentricRotor.add(eccentricIndex);

  const eccentricShaftPin = cylinderAlongZ(0.13, 0.84, pinMaterial, 28);
  eccentricShaftPin.position.set(
    eccentricShaft.x,
    eccentricShaft.y,
    0,
  );
  eccentricShaftPin.userData.role = 'fixed-eccentric-input-shaft';
  root.add(eccentricShaftPin);

  const eccentricStrap = new THREE.Mesh(plate(clip.difference(poly(circle([0,0],.54,96)),poly(circle([0,0],eccentricDiskRadius+.004,96))),-.14,.14),pawlMaterial);
  eccentricStrap.userData.role='eccentric-following-circular-pawl-strap';
  root.add(eccentricStrap);
  const drivingPawl=new THREE.Group();
  drivingPawl.userData.role='rigid-eccentric-strap-lifting-pawl';
  const driveBody=new THREE.Mesh(plate(clip.difference(poly(driveOutline),poly(circle([0,0],eccentricDiskRadius+.004,96))),-.09,.09),pawlMaterial);
  driveBody.userData.role='finite-pointed-eccentric-strap-pawl';
  drivingPawl.add(driveBody);
  drivingPawl.userData.setEndpoints=(a,b)=>{drivingPawl.position.copy(a);drivingPawl.rotation.z=Math.atan2(b.y-a.y,b.x-a.x);};
  root.add(drivingPawl);
  const drivingNose=new THREE.Object3D();
  drivingNose.userData.role='lifting-pawl-rack-working-nose';
  root.add(drivingNose);
  const holdingPawl=new THREE.Group();holdingPawl.position.copy(holdingPivot);
  holdingPawl.userData.role='upper-fixed-pivot-load-holding-stop-pawl';
  const holdingPawlBody=new THREE.Mesh(plate(clip.difference(clip.union(poly(holdOutline),poly(circle([0,0],.17,64))),poly(circle([0,0],.124,64))),-.09,.09),pawlMaterial);
  holdingPawlBody.userData.role='upper-stop-pawl-rigid-body';holdingPawl.add(holdingPawlBody);
  const holdingPivotPin=cylinderAlongZ(.12,.84,pinMaterial,32);
  holdingPivotPin.userData.role='upper-stop-pawl-fixed-pivot-pin';holdingPawl.add(holdingPivotPin);root.add(holdingPawl);
  const fixedSupports=[];
  for(const [pivot,radius] of [[eccentricShaft,.134],[holdingPivot,.124]]){
    const journal=new THREE.Mesh(boredCylinderGeometry(radius+.08,radius,.24),frameMaterial);
    journal.rotation.x=Math.PI/2;journal.position.set(pivot.x,pivot.y,-.43);
    journal.userData.role='fixed-bored-jack-pawl-support';root.add(journal);fixedSupports.push(journal);
    const bridge=new THREE.Mesh(new THREE.BoxGeometry(pivot.x-radius-.07,.16,.24),frameMaterial);
    bridge.position.set((pivot.x-radius-.07)/2,pivot.y,-.51);bridge.userData.role='fixed-rear-pawl-support-bridge';root.add(bridge);fixedSupports.push(bridge);
  }
  const supportSpine=new THREE.Mesh(new THREE.BoxGeometry(.25,holdingPivot.y+.6,.24),frameMaterial);
  supportSpine.position.set(-.12,(holdingPivot.y-.6)/2,-.51);supportSpine.userData.role='fixed-rear-pawl-support-spine';root.add(supportSpine);fixedSupports.push(supportSpine);
  for(const y of [.35,1.15]){
    const cheek=new THREE.Mesh(new THREE.BoxGeometry(.44,.18,.12),frameMaterial);cheek.position.set(-.04,y,.35);cheek.userData.role='fixed-front-rack-guide-strap';root.add(cheek);fixedSupports.push(cheek);
    const web=new THREE.Mesh(new THREE.BoxGeometry(.12,.18,.88),frameMaterial);web.position.set(-.39,y,-.03);web.userData.role='fixed-rack-guide-strap-web';root.add(web);fixedSupports.push(web);
  }

  const driveContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.060, 18, 12),
    whiteMaterial,
  );
  driveContactMarker.position.z = 0.16;
  driveContactMarker.userData.role = 'white-active-lifting-pawl-contact-index';
  root.add(driveContactMarker);
  const stopContactMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 18, 12),
    whiteMaterial,
  );
  stopContactMarker.position.z = 0.16;
  stopContactMarker.userData.role = 'white-active-upper-stop-contact-index';
  root.add(stopContactMarker);

  const followerDerivativeAtAngle = (angle) => {
    const camCenter = camCenterAtAngle(angle);
    const horizontal = camCenter.x - rackFaceX;
    const vertical = Math.sqrt(
      drivePawlLength ** 2 - horizontal ** 2,
    );
    const centerXDerivative = eccentricity * Math.sin(angle);
    const centerYDerivative = eccentricity * Math.cos(angle);
    return centerYDerivative
      - horizontal * centerXDerivative / vertical;
  };

  const holdingTipAtAngle = (angle) => holdingPivot.clone().add(
    new THREE.Vector3(
      holdingPawlLength * Math.cos(angle),
      holdingPawlLength * Math.sin(angle),
      0,
    ),
  );

  const stateAtTime = (time) => {
    const wrappedTime = positiveModulo(time, cycleDuration);
    const raisedDwellStarts = operatingDuration;
    const resetStarts = raisedDwellStarts + raisedDwellDuration;
    const bottomDwellStarts = resetStarts + resetDuration;
    let rackDisplacement;
    let rackSpeed = 0;
    let rackAcceleration = 0;
    let eccentricAngle = cycleStartAngle;
    let eccentricAngularSpeed = 0;
    let driveClearance = 0;
    let drivingEngaged = false;
    let holdingEngaged = true;
    let holdingAngle = holdingBaseAngle;
    let stage;
    let strokeIndex = liftStrokeCount;
    let strokePhase = 0;
    let strokeProgress = 1;

    if (wrappedTime < operatingDuration) {
      const strokeCoordinate = wrappedTime / strokeDuration;
      strokeIndex = Math.min(
        liftStrokeCount - 1,
        Math.floor(strokeCoordinate),
      );
      strokePhase = strokeCoordinate - strokeIndex;
      const parked=strokeIndex===liftStrokeCount-1&&strokePhase>parkFraction;
      if(parked)strokePhase=parkFraction;
      eccentricAngle = cycleStartAngle
        + FULL_TURN * strokePhase;
      eccentricAngularSpeed = parked?0:FULL_TURN / strokeDuration;
      if (strokePhase <= drivePowerFraction + 1e-12) {
        const engagedNose = driveNoseAtAngle(eccentricAngle);
        const withinStroke = engagedNose.y - driveReferenceY;
        strokeProgress = THREE.MathUtils.clamp(
          withinStroke / (toothPitch+seatingOvertravel),
          0,
          1,
        );
        rackDisplacement = strokeIndex * toothPitch + withinStroke;
        rackSpeed = followerDerivativeAtAngle(eccentricAngle)
          * eccentricAngularSpeed;
        drivingEngaged = true;
        holdingEngaged = strokeProgress <= 1e-12;
        const retreat=withinStroke<toothPitch-1e-7
          ?firstClearRetreat(a=>clearRackPawl(holdOutline,holdingPivot,holdingBaseAngle-a,rackTriangles,rackDisplacement),0,.85)
          :withinStroke-toothPitch<.08
            ?crestRetreat+1.1*(withinStroke-toothPitch)
            :(crestRetreat+.088)*(1-quinticState((withinStroke-toothPitch-.08)/(seatingOvertravel-.08)).value);
        holdingAngle=holdingBaseAngle-retreat;
        stage = 'eccentric-power-stroke-lifting-rack';
      } else if(strokePhase<transferFraction) {
        const withinStroke=engagedNoseY(eccentricAngle)-driveReferenceY;
        rackDisplacement=strokeIndex*toothPitch+withinStroke;
        rackSpeed=followerDerivativeAtAngle(eccentricAngle)*eccentricAngularSpeed;
        drivingEngaged=true;holdingEngaged=false;holdingAngle=holdingBaseAngle;
        stage='overtravel-settling-onto-seated-upper-stop';
      } else {
        driveClearance = returnRetreat(strokePhase);
        rackDisplacement = (strokeIndex + 1) * toothPitch;
        strokeProgress = 1;
        holdingEngaged = true;
        stage = 'lifting-pawl-return-upper-stop-holding';
      }
    } else if (wrappedTime < resetStarts) {
      rackDisplacement = liftStrokeCount * toothPitch;
      eccentricAngle = parkedAngle;
      driveClearance=parkedClearance;
      holdingEngaged = true;
      stage = 'three-pitch-raised-load-dwell';
    } else if (wrappedTime < bottomDwellStarts) {
      // Lowering: the operator reverses the eccentric, so the lifting strokes
      // play backward. The strap pawl lets the rack down one pitch per turn
      // while the stop pawl is held clear of each descending tooth; every pose
      // is a lifting pose, so the finite clearances carry over unchanged.
      const mirrored = stateAtTime(operatingDuration - (wrappedTime - resetStarts));
      return {
        ...mirrored,
        eccentricAngularSpeed: -mirrored.eccentricAngularSpeed,
        rackSpeed: -mirrored.rackSpeed,
        stage: `lowering-reversed-${mirrored.stage}`,
      };
    } else {
      return {...stateAtTime(0), eccentricAngularSpeed: 0, rackSpeed: 0, rackAcceleration: 0, stage: 'lowered-jack-dwell'};
    }

    const camCenter = camCenterAtAngle(eccentricAngle);
    if(!drivingEngaged)driveClearance=boundedRetreat(clearance=>{
      const tip=driveNoseAtAngle(eccentricAngle,clearance);
      return clearRackPawl(driveOutline,camCenter,Math.atan2(tip.y-camCenter.y,tip.x-camCenter.x),rackTriangles,rackDisplacement);
    },driveClearance,.62);
    if(!holdingEngaged)holdingAngle=holdingBaseAngle-boundedRetreat(retreat=>clearRackPawl(holdOutline,holdingPivot,holdingBaseAngle-retreat,rackTriangles,rackDisplacement),holdingBaseAngle-holdingAngle,.85);
    const driveNose = driveNoseAtAngle(
      eccentricAngle,
      driveClearance,
    );
    const holdingTip = holdingTipAtAngle(holdingAngle);
    const completedStrokeCount = Math.round(
      rackDisplacement / toothPitch,
    );
    const driveMaterialToothIndex = -strokeIndex;
    const driveToothSeatY = driveReferenceY
      + driveMaterialToothIndex * toothPitch + rackDisplacement;
    const holdingMaterialToothIndex = stopBaseToothIndex
      - completedStrokeCount;
    const holdingToothSeatY = driveReferenceY
      + holdingMaterialToothIndex * toothPitch + rackDisplacement;
    return {
      camCenter,
      completedStrokeCount,
      driveClearance,
      driveMaterialToothIndex,
      driveNose,
      drivePawlLength: camCenter.distanceTo(driveNose),
      driveToothSeatY,
      drivingContactError: drivingEngaged
        ? driveNose.y - driveToothSeatY
        : null,
      drivingEngaged,
      eccentricAngle,
      eccentricAngularSpeed,
      eccentricRotorAngle: positiveModulo(-eccentricAngle, FULL_TURN),
      holdingAngle,
      holdingContactError: holdingEngaged
        ? holdingTip.distanceTo(
          new THREE.Vector3(rackFaceX, stopSeatY, 0),
        )
        : null,
      holdingEngaged,
      holdingMaterialToothIndex,
      holdingTip,
      holdingToothSeatY,
      rackAcceleration,
      rackDisplacement,
      rackSpeed,
      stage,
      stopSeatY,
      strokeIndex,
      strokePhase,
      strokeProgress,
    };
  };

  const update = (time) => {
    const state = stateAtTime(time);
    rack.position.y = state.rackDisplacement;
    rack.userData.velocity = new THREE.Vector3(0, state.rackSpeed, 0);
    eccentricRotor.rotation.z = state.eccentricRotorAngle;
    eccentricRotor.userData.angularSpeed = -state.eccentricAngularSpeed;
    eccentricStrap.position.x = state.camCenter.x;
    eccentricStrap.position.y = state.camCenter.y;
    drivingPawl.userData.setEndpoints(state.camCenter, state.driveNose);
    // The strap and its pawl are one rigid forging turning together about
    // the eccentric.
    eccentricStrap.rotation.z = drivingPawl.rotation.z;
    drivingPawl.userData.endpoints = {
      end: state.driveNose.clone(),
      start: state.camCenter.clone(),
    };
    drivingNose.position.x = state.driveNose.x;
    drivingNose.position.y = state.driveNose.y;
    holdingPawl.rotation.z = state.holdingAngle;
    driveContactMarker.visible = state.drivingEngaged;
    driveContactMarker.position.x = state.driveNose.x;
    driveContactMarker.position.y = state.driveNose.y;
    stopContactMarker.visible = state.holdingEngaged;
    stopContactMarker.position.x = rackFaceX;
    stopContactMarker.position.y = stopSeatY;
    root.userData.contacts = {
      drivingPawlToRack: {
        active: state.drivingEngaged,
        clearance: state.driveClearance,
        contactError: state.drivingContactError,
        materialToothIndex: state.driveMaterialToothIndex,
      },
      upperStopToRack: {
        active: state.holdingEngaged,
        contactError: state.holdingContactError,
        materialToothIndex: state.holdingMaterialToothIndex,
        seatY: state.holdingToothSeatY,
      },
    };
    root.userData.kinematics = state;
  };

  const firstPowerEnd = stateAtTime(
    strokeDuration * drivePowerFraction,
  );
  root.userData = {
    archetype:
      'eccentric-strap-lifting-pawl-linear-ratchet-rack-upper-holding-stop-jack',
    blocks: {
      driveContactMarker,
      driveBody,
      fixedSupports,
      drivingNose,
      drivingPawl,
      eccentricDisk,
      eccentricIndex,
      eccentricRotor,
      eccentricShaftPin,
      eccentricStrap,
      frame,
      frameScaleTicks: frame.userData.scaleTicks,
      holdingPawl,
      holdingPawlBody,
      holdingPivotPin,
      rack,
      rackBody: rack.userData.body,
      rackLiftIndex: rack.userData.liftIndex,
      rackSaddle: rack.userData.saddle,
      rackTeeth: rack.userData.teeth,
      stopContactMarker,
    },
    constraintResiduals: {
      driveFollowerStrokeBudget:
        followerExtrema.highValue - followerExtrema.lowValue - toothPitch - seatingOvertravel - returnUndershoot,
      firstPowerStrokeRackAdvance:
        firstPowerEnd.rackDisplacement - toothPitch - seatingOvertravel,
      holdingPawlSeatedLength: holdingPivot.distanceTo(
        new THREE.Vector3(rackFaceX, stopSeatY, 0),
      ) - holdingPawlLength,
      lowFollowerLinkLength: camCenterAtAngle(
        followerExtrema.lowAngle,
      ).distanceTo(driveNoseAtAngle(followerExtrema.lowAngle))
        - drivePawlLength,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      inputs: [
        'continuous eccentric-shaft angle during each lifting stroke',
      ],
      note:
        'the eccentric center, rigid strap pawl and rack-face constraint determine one follower excursion; the upper pawl stores each one-pitch ratchet advance during the lifting-pawl return',
      storedEnergyStates: 0,
    },
    dynamics: {
      idealizations: [
        'the eccentric disk turns about one fixed shaft inside a finite strap with 0.004 nominal running clearance',
        'the lifting pawl is rigid from strap center to rack nose and is laterally spring-retracted only on its return',
        'the upper stop follows a prescribed continuous clearance branch, reseats during overtravel, and carries the settled rack during lifting-pawl return; gravity, preload and handoff forces are not solved',
        'rack, saddle and load are rigid; pivots are frictionless and tooth impact, deformation, force, friction and inertia are omitted',
        'three lifting strokes followed by three reversed lowering strokes (the stop pawl held clear by hand), plus all dimensions, timing, easing, materials, depth and camera, are reconstruction decisions',
      ],
      sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces: false,
      treatment:
        'geometrically closed eccentric-follower power strokes with exact one-pitch ratchet storage, then the same strokes reversed to let the rack down a pitch at a time',
    },
    fidelity: 'authored',
    geometry: {
      drivePawlLength,
      seatingOvertravel,
      returnUndershoot,
      rackToothCount: 18,
      cycleStartAngle,
      returnEndFraction,
      followerExcursion,
      transferFraction,
      drivePowerAngle,
      drivePowerFraction,
      driveReferenceY,
      eccentricDiskRadius,
      eccentricShaft: eccentricShaft.clone(),
      eccentricStrapRadius,
      eccentricity,
      followerHighAngle: followerExtrema.highAngle,
      followerHighY: followerExtrema.highValue,
      followerLowAngle: followerExtrema.lowAngle,
      followerLowY: followerExtrema.lowValue,
      holdingBaseAngle,
      holdingPawlLength,
      holdingVerticalOffset,
      holdingPivot: holdingPivot.clone(),
      liftStrokeCount,
      rackBodyWidth,
      rackDepth,
      rackFaceX,
      rackLength,
      returnClearance,
      stopBaseToothIndex,
      stopSeatY,
      toothDepth,
      toothPitch,
    },
    mechanism:
      'one-fixed-shaft-eccentric-disk-one-circular-strap-and-rigid-lifting-pawl-one-vertical-ratchet-rack-one-separate-upper-load-holding-stop-pawl',
    sourceAnimation: {
      available: false,
      independentlyReconstructed: true,
      officialCanvasModelPresent: false,
      reason:
        'the official Movement 389 page exposes no canvas animation; topology and working direction are reconstructed from Brown\'s public-domain engraving and description',
      sourcePrescribedAbsoluteTiming: false,
    },
    sourceReference: {
      brownPlate389: {
        drivePawlNosePixels: [244, 137],
        eccentricOuterCenterPixels: [289, 211],
        eccentricOuterRadiusPixels: 35,
        eccentricShaftPixels: [287, 197],
        holdingPawlNosePixels: [244, 89],
        holdingPawlPivotPixels: [275, 121],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 7,
        rackBodyEdgesPixels: {
          leftX: 208,
          rightX: 243,
        },
        rackToothPitchPixels: 17,
        rackToothTipX: 255,
        saddleExtentPixels: {
          maximumX: 278,
          maximumY: 55,
          minimumX: 190,
          minimumY: 31,
        },
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the machine is a lifting jack',
          'the operating elements are an eccentric, pawl, and ratchet',
          'the upper pawl is specifically a stop',
        ],
        engravingEvidence:
          'the plate shows a load saddle on a vertically guided one-sided rack, a lower circular eccentric strap with an integral pointed lifting pawl, and a separately fixed-pivot upper pawl bearing on the same tooth row',
        reconstructionDisclosure:
          'no official animation is available; eccentricity, rigid follower closure, tooth pitch, pawl lift and clearance, three-stroke timing, reversed lowering strokes, absolute geometry, materials, depth, indexes, and camera are independently engineered',
      },
      officialPage: movement.sourceUrl,
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      bottomDwellDuration,
      cycleDuration,
      demonstrationPeriod: cycleDuration,
      events: {
        bottomDwellStarts:
          operatingDuration + raisedDwellDuration + resetDuration,
        raisedDwellStarts: operatingDuration,
        resetStarts: operatingDuration + raisedDwellDuration,
      },
      liftStrokeCount,
      operatingDuration,
      raisedDwellDuration,
      resetDuration,
      strokeDuration,
      note:
        'three true eccentric lifting strokes are followed by a raised dwell and three lowering strokes, the lifting strokes played backward with the eccentric reversed, so the rack comes down one pitch per turn on the strap pawl while the stop pawl is held clear by hand',
    },
    transmission: {
      driveFollowerLaw:
        'camCenter=(Sx-e*cos(theta), Sy+e*sin(theta)); the rigid pawl nose lies on rackFaceX at the positive circle-intersection ordinate',
      holdingLaw:
        'the upper stop lifts over one rising tooth during the power stroke, reseats in the next gap, and alone prevents rack descent during lifting-pawl return',
      indexingLaw:
        'one follower excursion covers rack pitch plus seating overtravel and return undershoot; each completed eccentric turn stores exactly one additional pitch',
      resetLaw:
        'lowering reverses the eccentric: the strap pawl carries the rack down one pitch per turn and the stop pawl is held clear of each descending tooth (the prescribed lifting clearances, time-reversed)',
    },
  };

  update(0);
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-1.62, -1.31, -1.02),
    new THREE.Vector3(2.62, 7.82, 1.18),
  );
  root.userData.cameraDistanceScale = 1.22;
  root.userData.groundFloorY = -1.18;
  fitPistonGuide(root, update, cycleDuration);
  root.userData.minimumDisplayCycleSeconds = cycleDuration;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.12, 0.18, 11),
    root,
    update,
  };
}

export function createAuthoredEccentricJackMovement(movement) {
  if (movement.id !== 389) return null;
  return applyCutawayFor(eccentricPawlJack(movement), movement.id);
}
