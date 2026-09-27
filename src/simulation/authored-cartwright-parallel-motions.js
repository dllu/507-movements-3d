import * as THREE from 'three';
import {spokedWheelGeometry} from './spoked-wheel.js';
import {boredCylinderGeometry,boredJournal,fitPistonGuide} from './piston-guide-parts.js';
import {
  PALETTE,
  makeGear,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  const remainder = value % modulus;
  if (remainder === 0) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function centeredExtrusion(shape, depth, bevelSize = 0.008) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: bevelSize > 0,
    bevelSegments: 1,
    bevelSize,
    bevelThickness: bevelSize,
    curveSegments: 24,
    depth,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function annulusGeometry(outerRadius, innerRadius, depth) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, FULL_TURN, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, FULL_TURN, true);
  hole.closePath();
  shape.holes.push(hole);
  return centeredExtrusion(shape, depth);
}

function taperedCrankGeometry(hubRadius, pinRadius, length, pinBore, depth) {
  const lean = Math.asin((hubRadius - pinRadius) / length);
  const shape = new THREE.Shape();
  shape.absarc(0, 0, hubRadius, Math.PI / 2 - lean, Math.PI * 3 / 2 + lean, false);
  shape.absarc(length, 0, pinRadius, -Math.PI / 2 + lean, Math.PI / 2 - lean, false);
  shape.closePath();
  const bore = new THREE.Path();
  bore.absarc(length, 0, pinBore, 0, FULL_TURN, true);
  shape.holes.push(bore);
  return centeredExtrusion(shape, depth, 0);
}

function clearGuideGearFlanks(gear) {
  // Tiny tooth-thickness allowance for polygonal involute chords. Keep pitch,
  // root and tip radii unchanged; both flanks move towards the tooth center.
  const backlash=.0001,halfPitch=Math.PI/gear.userData.teeth;
  const body=gear.userData.rotor.children[0],p=body.geometry.parameters;
  const outline=p.shapes.getPoints(1);
  if(outline.length>1&&outline[0].distanceTo(outline.at(-1))<1e-9)outline.pop();
  const points=outline.map(point=>{
    const radius=point.length(),angle=Math.atan2(point.y,point.x);
    const local=positiveModulo(angle+halfPitch,2*halfPitch)-halfPitch;
    const shifted=Math.abs(local)<halfPitch-1e-8
      ?angle-Math.sign(local)*backlash/(2*gear.userData.radius):angle;
    return new THREE.Vector2(radius*Math.cos(shifted),radius*Math.sin(shifted));
  });
  body.geometry.dispose();
  body.geometry=new THREE.ExtrudeGeometry(new THREE.Shape(points),{...p.options,bevelEnabled:false}).translate(0,0,-p.options.depth/2);
  gear.userData.runningBacklash=backlash;
  // The plate draws plain wheels: no face ring or rotation index.
  for(const child of [...gear.userData.rotor.children]) {
    if(child.geometry?.type!=='TorusGeometry'&&child.geometry?.type!=='BoxGeometry')continue;
    child.removeFromParent();child.geometry.dispose();
  }
}

function openWheelBody(gear,boreRadius) {
  const rotor=gear.userData.rotor,body=rotor.children[0],hub=rotor.children[1];
  const p=body.geometry.parameters,outline=p.shapes.getPoints(1);
  if(outline.length>1&&outline[0].distanceTo(outline.at(-1))<1e-9)outline.pop();
  // Brown's wheels C are flat webs with four windows: one plate
  // (spoked-wheel.js), each window two spoke edges and an arc concentric
  // with the wheel, rounded more at the hub than at the rim; the toothed
  // outline and its working flanks are unchanged.
  body.geometry.dispose();
  body.geometry=spokedWheelGeometry({outline,rimInnerRadius:gear.userData.rootRadius-.11,spokes:4,
    spokeWidth:gear.userData.radius*.17,hubRadius:gear.userData.radius*.30,rimFillet:gear.userData.radius*.05,
    boreRadius,thickness:p.options.depth,arcSegments:192,
    // Brown's crossings stand as an X (within 6 degrees on both wheels) at
    // the opening pose.
    phase:THREE.MathUtils.degToRad(-3)});
  body.userData.noRotationIndicator=true;
  const hp=hub.geometry.parameters;hub.geometry.dispose();
  hub.geometry=boredCylinderGeometry(hp.radiusTop,boreRadius,hp.height);
  gear.userData.sourceSpokeCount=4;
}

function makeInputFlywheelPinion({
  darkMaterial,
  driverMaterial,
  flywheelDepth,
  flywheelInnerRadius,
  flywheelOuterRadius,
  flywheelPlaneZ,
  pinionDepth,
  pinionPlaneZ,
  pinionRadius,
  pinionTeeth,
  scale,
  toothHeight,
  toothIndexOffset,
  whiteMaterial,
}) {
  const rotor = new THREE.Group();
  rotor.userData.axis = Z_AXIS.clone();
  rotor.userData.role =
    'one-rigid-input-flywheel-central-pinion-and-shaft';

  const rim = new THREE.Mesh(
    annulusGeometry(
      flywheelOuterRadius,
      flywheelInnerRadius,
      flywheelDepth,
    ),
    driverMaterial,
  );
  rim.position.z = flywheelPlaneZ;
  rim.userData.role = 'Cartwright-input-flywheel-rim';
  const spokes = [];
  const hubRadius = 1.10 * scale;
  const spokeInnerRadius = hubRadius * 0.70;
  const spokeLength = flywheelInnerRadius - spokeInnerRadius + 0.10;
  const spokeCenterRadius = (flywheelInnerRadius + spokeInnerRadius) / 2;
  for (let index = 0; index < 4; index += 1) {
    const angle = index * Math.PI / 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(
        spokeLength,
        1.25 * scale,
        flywheelDepth * 0.76,
      ),
      driverMaterial,
    );
    spoke.position.set(
      Math.cos(angle) * spokeCenterRadius,
      Math.sin(angle) * spokeCenterRadius,
      flywheelPlaneZ,
    );
    spoke.rotation.z = angle;
    spoke.userData.role = `input-flywheel-rigid-spoke-${index + 1}`;
    spokes.push(spoke);
  }
  const hub = cylinderAlongZ(
    hubRadius,
    flywheelDepth * 1.32,
    driverMaterial,
    44,
  );
  hub.position.z = flywheelPlaneZ;
  hub.userData.role = 'input-flywheel-hub';

  const pinion = makeGear({
    axis: Z_AXIS,
    color: PALETTE.driver,
    depth: pinionDepth,
    radius: pinionRadius,
    teeth: pinionTeeth,
    toothHeight,
  });
  pinion.position.z = pinionPlaneZ;
  clearGuideGearFlanks(pinion);
  pinion.userData.rotor.rotation.z = toothIndexOffset;
  pinion.userData.role = 'twelve-tooth-input-pinion-rigid-on-flywheel';
  pinion.userData.toothIndexOffset = toothIndexOffset;

  const shaft = cylinderAlongZ(
    0.62 * scale,
    pinionPlaneZ + .21 - (flywheelPlaneZ - .18),
    darkMaterial,
    36,
  );
  shaft.position.z = (pinionPlaneZ + .21 + flywheelPlaneZ - .18) / 2;
  shaft.userData.axis = Z_AXIS.clone();
  shaft.userData.role = 'input-flywheel-and-pinion-shaft';
  const centerAnchor = new THREE.Object3D();
  centerAnchor.position.z = pinionPlaneZ;
  centerAnchor.userData.role = 'analytic-input-pinion-center';

  rotor.add(
    rim,
    ...spokes,
    hub,
    pinion,
    shaft,
    centerAnchor,
  );
  return {
    centerAnchor,
    hub,
    pinion,
    rim,
    rotor,
    shaft,
    spokes,
  };
}

function makeCrankedEqualGear({
  crankDepth,
  crankPlaneZ,
  crankRadius,
  darkMaterial,
  drivenMaterial,
  gearDepth,
  gearPlaneZ,
  gearRadius,
  gearTeeth,
  role,
  scale,
  toothHeight,
  toothIndexOffset,
  whiteMaterial,
}) {
  const assembly = new THREE.Group();
  assembly.userData.axis = Z_AXIS.clone();
  assembly.userData.role = role;
  const rotatingBody = new THREE.Group();
  rotatingBody.userData.role = `${role}-one-rigid-gear-crank-body`;

  const gear = makeGear({
    axis: Z_AXIS,
    color: PALETTE.driven,
    depth: gearDepth,
    radius: gearRadius,
    teeth: gearTeeth,
    toothHeight,
  });
  gear.position.z = gearPlaneZ;
  clearGuideGearFlanks(gear);
  openWheelBody(gear,.47*scale+.004);
  gear.userData.rotor.rotation.z = toothIndexOffset;
  gear.userData.role = `${role}-equal-toothed-wheel-C`;
  gear.userData.toothIndexOffset = toothIndexOffset;

  const crankDisk = cylinderAlongZ(
    1.0 * scale,
    crankDepth,
    drivenMaterial,
    42,
  );
  crankDisk.position.z = crankPlaneZ;
  crankDisk.userData.role = `${role}-crank-center-disk`;
  // Brown's cranks A are fat tapered arms, rounded at both ends, with the
  // rod pin running in a bore at the outer end.
  const pinBore = 0.25 * scale + .012;
  const crankArm = new THREE.Mesh(
    taperedCrankGeometry(1.0 * scale, 0.62 * scale, crankRadius, pinBore,
      crankDepth),
    drivenMaterial,
  );
  crankArm.position.z = crankPlaneZ;
  crankArm.userData.role = `${role}-equal-radius-crank-A`;
  const crankPinBoss = boredJournal(0.52 * scale, pinBore, crankDepth * 1.24,
    drivenMaterial, 32);
  crankPinBoss.position.set(crankRadius, 0, crankPlaneZ);
  crankPinBoss.userData.role = `${role}-crank-A-moving-pin-boss`;
  const shaft = cylinderAlongZ(
    0.47 * scale,
    crankPlaneZ + .12 + .33,
    darkMaterial,
    34,
  );
  shaft.position.z = (crankPlaneZ + .12 - .33) / 2;
  shaft.userData.role = `${role}-live-equal-wheel-shaft`;
  const crankPinAnchor = new THREE.Object3D();
  crankPinAnchor.position.set(crankRadius, 0, crankPlaneZ);
  crankPinAnchor.userData.role = `${role}-analytic-crank-A-pin`;
  const centerAnchor = new THREE.Object3D();
  centerAnchor.position.z = gearPlaneZ;
  centerAnchor.userData.role = `${role}-analytic-wheel-C-center`;

  rotatingBody.add(
    gear,
    crankDisk,
    crankArm,
    crankPinBoss,
    shaft,
    crankPinAnchor,
    centerAnchor,
  );
  assembly.add(rotatingBody);
  assembly.userData.rotatingBody = rotatingBody;
  return {
    assembly,
    centerAnchor,
    crankArm,
    crankDisk,
    crankPinAnchor,
    gear,
    rotatingBody,
    shaft,
  };
}

function makeConnectingRod({
  darkMaterial,
  depth,
  driverMaterial,
  eyeRadius,
  length,
  role,
}) {
  const rod = new THREE.Group();
  rod.userData.nominalLength = length;
  rod.userData.role = role;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(length - .18,
      eyeRadius * 0.66, depth),
    driverMaterial,
  );
  body.position.x = length / 2;
  body.userData.role = `${role}-constant-length-shank`;
  const crankEyeBody = boredJournal(
    eyeRadius, .0565,
    depth,
    driverMaterial,
    34,
  );
  crankEyeBody.userData.role = `${role}-crank-eye-body`;
  const wristEyeBody = boredJournal(
    eyeRadius * .90, .08275,
    depth,
    driverMaterial,
    34,
  );
  wristEyeBody.position.x = length;
  wristEyeBody.userData.role = `${role}-crosshead-eye-body`;
  const crankEye = boredJournal(eyeRadius * .95,.0565,.012,darkMaterial);
  crankEye.position.z=depth/2+.006;
  crankEye.userData.role=`${role}-crank-pin-eye`;
  const wristEye=boredJournal(eyeRadius * .88,.08275,.012,darkMaterial);
  wristEye.position.set(length,0,depth/2+.006);
  wristEye.userData.role=`${role}-crosshead-pin-eye`;
  const crankAnchor = new THREE.Object3D();
  crankAnchor.userData.role = `${role}-analytic-crank-eye`;
  const wristAnchor = new THREE.Object3D();
  wristAnchor.position.x = length;
  wristAnchor.userData.role = `${role}-analytic-crosshead-eye`;
  rod.add(
    body,
    crankEyeBody,
    wristEyeBody,
    crankEye,
    wristEye,
    crankAnchor,
    wristAnchor,
  );
  return {
    body,
    crankAnchor,
    rod,
    wristAnchor,
  };
}

function CartwrightParallelMotion(movement) {
  const root = new THREE.Group();

  // Exact source geometry.  The input pinion and the two equal C wheels use
  // pitch radii 2:5:5 (12:30:30 teeth), while the two A cranks have equal
  // 3.5-unit radii and the two connecting rods are each 15 units long.
  const sourceScale = 0.21;
  const sourceInputPinionRadius = 2;
  const sourceEqualGearRadius = 5;
  const inputPinionTeeth = 12;
  const equalGearTeeth = 30;
  const sourceCrankRadius = 3.5;
  const sourceConnectingRodLength = 15;
  const sourceGearCenterY = 7;
  const sourceEqualGearCenterSpacing = 10;
  const sourceFlywheelOuterRadius = 15;
  const sourceFlywheelInnerRadius = 12.5;
  const sourceCrossheadSpan = 10;
  const sourcePistonRodTopLocalY = -1.125;
  const sourcePistonRodBottomLocalY = -20.5;
  const sourceInputCyclesPerMinute = 15;
  const inputCyclePeriod = 60 / sourceInputCyclesPerMinute;
  const inputAngularSpeed = FULL_TURN / inputCyclePeriod;
  const equalGearRatio = sourceInputPinionRadius / sourceEqualGearRadius;
  const equalGearAngularSpeed = equalGearRatio * inputAngularSpeed;
  const outputCyclePeriod = FULL_TURN / equalGearAngularSpeed;
  const assemblyClosurePeriod = inputCyclePeriod * 5;

  const inputPinionRadius = sourceInputPinionRadius * sourceScale;
  const equalGearRadius = sourceEqualGearRadius * sourceScale;
  const crankRadius = sourceCrankRadius * sourceScale;
  const connectingRodLength = sourceConnectingRodLength * sourceScale;
  const gearCenterY = sourceGearCenterY * sourceScale;
  const equalGearCenterSpacing = sourceEqualGearCenterSpacing * sourceScale;
  const leftGearCenter = new THREE.Vector2(-equalGearCenterSpacing,
    gearCenterY);
  const rightGearCenter = new THREE.Vector2(0, gearCenterY);
  const pistonAxisX = -equalGearCenterSpacing / 2;
  // Brown's flywheel rim is thin and about 1.36 wheel-C spacings in radius,
  // smaller than the official canvas ring; the linkage does not depend on it.
  const plateFlywheelOuterRadius = 13.6;
  const plateFlywheelInnerRadius = 12.9;
  const flywheelOuterRadius = plateFlywheelOuterRadius * sourceScale;
  const flywheelInnerRadius = plateFlywheelInnerRadius * sourceScale;
  const crossheadSpan = sourceCrossheadSpan * sourceScale;
  const pistonRodTopLocalY = sourcePistonRodTopLocalY * sourceScale;
  const pistonRodBottomLocalY = sourcePistonRodBottomLocalY * sourceScale;
  const pistonStroke = 2 * crankRadius;
  const frameBottomY = -27.875 * sourceScale;
  const commonToothHeight = 0.60 * sourceScale;

  const flywheelPlaneZ = -0.48;
  const flywheelDepth = 0.24;
  const inputPinionPlaneZ = .51;
  const inputPinionDepth = 0.28;
  const equalGearPlaneZ = .51;
  const equalGearDepth = 0.28;
  const crankPlaneZ = 1.10;
  const crankDepth = 0.18;
  const rodPlaneZ = 1.34;
  const rodDepth = 0.14;
  const crossheadPlaneZ = 0.55;

  const inputPinionToothOffset = Math.PI / inputPinionTeeth;
  const rightGearToothOffset = Math.PI / equalGearTeeth;
  const leftGearToothOffset = 0;

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.10,
    roughness: 0.72,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.09,
    roughness: 0.63,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.09,
    roughness: 0.62,
  });
  const rodMaterial = matte(PALETTE.accent, {
    metalness: 0.09,
    roughness: 0.61,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.48 });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.fixed = true;
  fixedFrame.userData.role = 'fixed-Cartwright-engine-frame';
  // Brown draws the bed in front of both wheels C, hiding their mesh with the
  // pinion, with a pillow block on its top face under each wheel shaft.
  const bedFrontZ = 0.96;
  const bedBackZ = equalGearPlaneZ + 0.21;
  const bedBottomY = 1.7 * sourceScale;
  const bedTopY = 4.3 * sourceScale;
  const bedLeftX = -16.1 * sourceScale;
  const bedRightX = 11.1 * sourceScale;
  const upperBeam = new THREE.Mesh(
    new THREE.BoxGeometry(bedRightX - bedLeftX, bedTopY - bedBottomY,
      bedFrontZ - bedBackZ),
    frameMaterial,
  );
  upperBeam.position.set((bedLeftX + bedRightX) / 2, (bedTopY + bedBottomY) / 2,
    (bedFrontZ + bedBackZ) / 2);
  upperBeam.userData.fixed = true;
  upperBeam.userData.role = 'fixed-upper-bed-carrying-both-equal-wheels-C';

  const shaftBore = .47 * sourceScale + .012;
  const makeBearingPedestal = (center, role) => {
    const group = new THREE.Group();
    group.position.set(center.x, center.y, 0);
    group.userData.fixed = true;
    group.userData.role = role;
    const foot = bedTopY - center.y - .002;
    const shape = new THREE.Shape([
      new THREE.Vector2(-1.5 * sourceScale, foot),
      new THREE.Vector2(1.5 * sourceScale, foot),
      new THREE.Vector2(1.5 * sourceScale, foot + 0.9 * sourceScale),
      new THREE.Vector2(1.05 * sourceScale, foot + 0.9 * sourceScale),
      new THREE.Vector2(1.05 * sourceScale, 0.95 * sourceScale),
      new THREE.Vector2(-1.05 * sourceScale, 0.95 * sourceScale),
      new THREE.Vector2(-1.05 * sourceScale, foot + 0.9 * sourceScale),
      new THREE.Vector2(-1.5 * sourceScale, foot + 0.9 * sourceScale),
    ]);
    const hole = new THREE.Path();
    hole.absarc(0, 0, shaftBore, 0, FULL_TURN, true);
    shape.holes.push(hole);
    const block = new THREE.Mesh(centeredExtrusion(shape, bedFrontZ - bedBackZ, 0),
      frameMaterial);
    block.position.z = (bedFrontZ + bedBackZ) / 2;
    block.userData.fixed = true;
    block.userData.role = `${role}-pillow-block-on-bed`;
    group.add(block);
    group.userData.housing = block;
    return group;
  };
  const leftBearing = makeBearingPedestal(
    leftGearCenter,
    'left-wheel-C-fixed-bearing',
  );
  const rightBearing = makeBearingPedestal(
    rightGearCenter,
    'right-wheel-C-fixed-bearing',
  );

  // Only the cylinder top shows at the foot of the plate: a cover as wide as
  // the crosshead, a stuffing box, neck and gland under piston-rod B.
  const rodBore = .10;
  const coverTopY = -15.3 * sourceScale;
  const cylinderTop = new THREE.Mesh(
    boredCylinderGeometry(5.0 * sourceScale, rodBore, 1.1 * sourceScale),
    frameMaterial,
  );
  cylinderTop.position.set(pistonAxisX, coverTopY - 0.55 * sourceScale,
    crossheadPlaneZ);
  cylinderTop.userData.fixed = true;
  cylinderTop.userData.role = 'fixed-cylinder-top-cap';
  const cylinderBodyTop = coverTopY - 1.0 * sourceScale;
  const cylinderBodyBottom = -34.6 * sourceScale;
  const cylinderBody = new THREE.Mesh(
    boredCylinderGeometry(4.2 * sourceScale, .20,
      cylinderBodyTop - cylinderBodyBottom),
    frameMaterial,
  );
  cylinderBody.position.set(pistonAxisX,
    (cylinderBodyTop + cylinderBodyBottom) / 2, crossheadPlaneZ);
  cylinderBody.userData.fixed = true;
  cylinderBody.userData.role = 'fixed-upright-cylinder-below-piston-rod-B';
  const stuffingBox = new THREE.Mesh(
    boredCylinderGeometry(.95 * sourceScale, rodBore, .9 * sourceScale),
    frameMaterial,
  );
  stuffingBox.position.set(pistonAxisX, coverTopY + .45 * sourceScale,
    crossheadPlaneZ);
  stuffingBox.userData.fixed = true;
  stuffingBox.userData.role = 'fixed-piston-rod-B-stuffing-box';
  const glandNeck = new THREE.Mesh(
    boredCylinderGeometry(.55 * sourceScale, rodBore, 1.5 * sourceScale),
    frameMaterial,
  );
  glandNeck.position.set(pistonAxisX, coverTopY + .75 * sourceScale,
    crossheadPlaneZ);
  glandNeck.userData.fixed = true;
  glandNeck.userData.role = 'hollow-neck-joining-cylinder-cap-to-gland';
  const pistonGland = new THREE.Mesh(
    boredCylinderGeometry(.70 * sourceScale, rodBore, .8 * sourceScale),
    drivenMaterial,
  );
  pistonGland.position.set(pistonAxisX, coverTopY + 1.8 * sourceScale,
    crossheadPlaneZ);
  pistonGland.userData.fixed = true;
  pistonGland.userData.role = 'fixed-piston-rod-B-gland';
  fixedFrame.add(
    glandNeck,
    upperBeam,
    leftBearing,
    rightBearing,
    cylinderBody,
    cylinderTop,
    stuffingBox,
    pistonGland,
  );

  const inputParts = makeInputFlywheelPinion({
    darkMaterial,
    driverMaterial,
    flywheelDepth,
    flywheelInnerRadius,
    flywheelOuterRadius,
    flywheelPlaneZ,
    pinionDepth: inputPinionDepth,
    pinionPlaneZ: inputPinionPlaneZ,
    pinionRadius: inputPinionRadius,
    pinionTeeth: inputPinionTeeth,
    scale: sourceScale,
    toothHeight: commonToothHeight,
    toothIndexOffset: inputPinionToothOffset,
    whiteMaterial,
  });

  const leftGearParts = makeCrankedEqualGear({
    crankDepth,
    crankPlaneZ,
    crankRadius,
    darkMaterial,
    drivenMaterial,
    gearDepth: equalGearDepth,
    gearPlaneZ: equalGearPlaneZ,
    gearRadius: equalGearRadius,
    gearTeeth: equalGearTeeth,
    role: 'left-Cartwright-wheel-C',
    scale: sourceScale,
    toothHeight: commonToothHeight,
    toothIndexOffset: leftGearToothOffset,
    whiteMaterial,
  });
  leftGearParts.assembly.position.set(
    leftGearCenter.x,
    leftGearCenter.y,
    0,
  );
  const rightGearParts = makeCrankedEqualGear({
    crankDepth,
    crankPlaneZ,
    crankRadius,
    darkMaterial,
    drivenMaterial,
    gearDepth: equalGearDepth,
    gearPlaneZ: equalGearPlaneZ,
    gearRadius: equalGearRadius,
    gearTeeth: equalGearTeeth,
    role: 'right-Cartwright-wheel-C',
    scale: sourceScale,
    toothHeight: commonToothHeight,
    toothIndexOffset: rightGearToothOffset,
    whiteMaterial,
  });
  rightGearParts.assembly.position.set(
    rightGearCenter.x,
    rightGearCenter.y,
    0,
  );

  const leftRodParts = makeConnectingRod({
    darkMaterial,
    depth: rodDepth,
    driverMaterial: rodMaterial,
    eyeRadius: 0.54 * sourceScale,
    length: connectingRodLength,
    role: 'left-equal-obliquity-connecting-rod',
  });
  const rightRodParts = makeConnectingRod({
    darkMaterial,
    depth: rodDepth,
    driverMaterial: rodMaterial,
    eyeRadius: 0.54 * sourceScale,
    length: connectingRodLength,
    role: 'right-equal-obliquity-connecting-rod',
  });

  const crosshead = new THREE.Group();
  crosshead.userData.role =
    'rigid-horizontal-crosshead-joining-both-rods-to-piston-rod-B';
  crosshead.userData.rotationDegreesOfFreedom = 0;
  const crossheadBar = new THREE.Mesh(
    new THREE.BoxGeometry(crossheadSpan, 0.50 * sourceScale, 0.18),
    drivenMaterial,
  );
  crossheadBar.position.z = crossheadPlaneZ;
  crossheadBar.userData.role = 'horizontal-crosshead-rigid-span';
  const crossheadPins = [-1, 1].map((side) => {
    const pin = cylinderAlongZ(
      0.375 * sourceScale,
      rodPlaneZ - crossheadPlaneZ + 0.23,
      darkMaterial,
      30,
    );
    pin.position.set(
      side * crossheadSpan / 2,
      0,
      (rodPlaneZ + crossheadPlaneZ) / 2,
    );
    pin.userData.role =
      `${side < 0 ? 'left' : 'right'}-crosshead-rod-joint-pin`;
    return pin;
  });
  const pistonRodLength = pistonRodTopLocalY - pistonRodBottomLocalY;
  const pistonRod = new THREE.Mesh(
    new THREE.BoxGeometry(0.50 * sourceScale, pistonRodLength, 0.15),
    drivenMaterial,
  );
  pistonRod.position.set(
    0,
    (pistonRodTopLocalY + pistonRodBottomLocalY) / 2,
    crossheadPlaneZ,
  );
  pistonRod.userData.role = 'vertical-piston-rod-B-rigid-with-crosshead';
  const leftWristAnchor = new THREE.Object3D();
  leftWristAnchor.position.set(-crossheadSpan / 2, 0, rodPlaneZ);
  leftWristAnchor.userData.role = 'analytic-left-crosshead-wrist';
  const rightWristAnchor = new THREE.Object3D();
  rightWristAnchor.position.set(crossheadSpan / 2, 0, rodPlaneZ);
  rightWristAnchor.userData.role = 'analytic-right-crosshead-wrist';
  const pistonAxisAnchor = new THREE.Object3D();
  pistonAxisAnchor.position.set(0, 0, crossheadPlaneZ);
  pistonAxisAnchor.userData.role = 'analytic-piston-rod-B-axis-on-crosshead';
  const pistonBoss=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.30,48),drivenMaterial);
  pistonBoss.position.set(0,-.13,crossheadPlaneZ);
  pistonBoss.userData.role='crosshead-boss-attaching-piston-rod-B';
  crosshead.add(
    pistonBoss,
    pistonRod,
    crossheadBar,
    ...crossheadPins,
    leftWristAnchor,
    rightWristAnchor,
    pistonAxisAnchor,
  );

  const leftCrankPinShaft = cylinderAlongZ(
    0.25 * sourceScale,
    rodPlaneZ - crankPlaneZ + 0.24,
    darkMaterial,
    30,
  );
  leftCrankPinShaft.position.z = (rodPlaneZ + crankPlaneZ) / 2;
  leftCrankPinShaft.userData.role = 'left-crank-A-to-rod-pin';
  const rightCrankPinShaft = leftCrankPinShaft.clone();
  rightCrankPinShaft.userData.role = 'right-crank-A-to-rod-pin';

  root.add(
    inputParts.rotor,
    fixedFrame,
    leftGearParts.assembly,
    rightGearParts.assembly,
    crosshead,
    leftCrankPinShaft,
    rightCrankPinShaft,
    leftRodParts.rod,
    rightRodParts.rod,
  );

  const cross2 = (left, right) => left.x * right.y
    - left.y * right.x;
  const rodRates = (
    vector,
    relativeVelocity,
    relativeAcceleration,
  ) => {
    const lengthSquared = vector.lengthSq();
    const angularVelocity = cross2(vector, relativeVelocity)
      / lengthSquared;
    const angularAcceleration = (
      cross2(vector, relativeAcceleration) * lengthSquared
        - cross2(vector, relativeVelocity)
          * 2 * vector.dot(relativeVelocity)
    ) / lengthSquared ** 2;
    return { angularAcceleration, angularVelocity };
  };

  const stateAtInputAngle = (
    unwrappedInputAngle,
    angularVelocity = inputAngularSpeed,
  ) => {
    const inputAngle = positiveModulo(unwrappedInputAngle, FULL_TURN);
    const gearCoordinate = equalGearRatio * unwrappedInputAngle;
    const gearCoordinateAngle = positiveModulo(gearCoordinate, FULL_TURN);
    const rightGearUnwrappedAngle = -gearCoordinate;
    const leftGearUnwrappedAngle = Math.PI + gearCoordinate;
    const rightGearAngle = positiveModulo(
      rightGearUnwrappedAngle,
      FULL_TURN,
    );
    const leftGearAngle = positiveModulo(
      leftGearUnwrappedAngle,
      FULL_TURN,
    );
    const gearAngularVelocity = equalGearRatio * angularVelocity;
    const sine = Math.sin(gearCoordinateAngle);
    const cosine = Math.cos(gearCoordinateAngle);
    const horizontalThrow = crankRadius * cosine;
    const commonCrankY = gearCenterY - crankRadius * sine;
    const leftCrankPin = new THREE.Vector2(
      leftGearCenter.x - horizontalThrow,
      commonCrankY,
    );
    const rightCrankPin = new THREE.Vector2(
      rightGearCenter.x + horizontalThrow,
      commonCrankY,
    );
    const leftCrankPinVelocity = new THREE.Vector2(
      crankRadius * sine * gearAngularVelocity,
      -crankRadius * cosine * gearAngularVelocity,
    );
    const rightCrankPinVelocity = new THREE.Vector2(
      -crankRadius * sine * gearAngularVelocity,
      -crankRadius * cosine * gearAngularVelocity,
    );
    const leftCrankPinAcceleration = new THREE.Vector2(
      crankRadius * cosine * gearAngularVelocity ** 2,
      crankRadius * sine * gearAngularVelocity ** 2,
    );
    const rightCrankPinAcceleration = new THREE.Vector2(
      -crankRadius * cosine * gearAngularVelocity ** 2,
      crankRadius * sine * gearAngularVelocity ** 2,
    );

    const circleLineRadicand = connectingRodLength ** 2
      - horizontalThrow ** 2;
    const circleLineRoot = Math.sqrt(Math.max(0, circleLineRadicand));
    const rootFirstByGearAngle = crankRadius ** 2
      * cosine * sine / circleLineRoot;
    const rootSecondByGearAngle = crankRadius ** 2
      * (cosine ** 2 - sine ** 2) / circleLineRoot
      - (crankRadius ** 2 * cosine * sine) ** 2
        / circleLineRoot ** 3;
    const crossheadY = commonCrankY - circleLineRoot;
    const crossheadFirstByGearAngle = -crankRadius * cosine
      - rootFirstByGearAngle;
    const crossheadSecondByGearAngle = crankRadius * sine
      - rootSecondByGearAngle;
    const crossheadVelocityY = crossheadFirstByGearAngle
      * gearAngularVelocity;
    const crossheadAccelerationY = crossheadSecondByGearAngle
      * gearAngularVelocity ** 2;
    const leftWristPin = new THREE.Vector2(leftGearCenter.x, crossheadY);
    const rightWristPin = new THREE.Vector2(rightGearCenter.x, crossheadY);
    const wristVelocity = new THREE.Vector2(0, crossheadVelocityY);
    const wristAcceleration = new THREE.Vector2(
      0,
      crossheadAccelerationY,
    );
    const leftRodVector = leftWristPin.clone().sub(leftCrankPin);
    const rightRodVector = rightWristPin.clone().sub(rightCrankPin);
    const leftRates = rodRates(
      leftRodVector,
      wristVelocity.clone().sub(leftCrankPinVelocity),
      wristAcceleration.clone().sub(leftCrankPinAcceleration),
    );
    const rightRates = rodRates(
      rightRodVector,
      wristVelocity.clone().sub(rightCrankPinVelocity),
      wristAcceleration.clone().sub(rightCrankPinAcceleration),
    );

    const inputPinionPitchContact = new THREE.Vector2(
      0,
      inputPinionRadius,
    );
    const rightGearLowerPitchContact = new THREE.Vector2(
      0,
      rightGearCenter.y - equalGearRadius,
    );
    const equalGearPitchContact = new THREE.Vector2(
      pistonAxisX,
      gearCenterY,
    );
    const inputPinionContactVelocity = new THREE.Vector2(
      -angularVelocity * inputPinionRadius,
      0,
    );
    const rightLowerContactVelocity = new THREE.Vector2(
      -gearAngularVelocity * equalGearRadius,
      0,
    );
    const rightLeftContactVelocity = new THREE.Vector2(
      0,
      gearAngularVelocity * equalGearRadius,
    );
    const leftRightContactVelocity = new THREE.Vector2(
      0,
      gearAngularVelocity * equalGearRadius,
    );

    return {
      assemblyPhase: positiveModulo(
        unwrappedInputAngle / (5 * FULL_TURN),
        1,
      ),
      circleLineRadicand,
      circleLineRoot,
      crosshead: {
        acceleration: new THREE.Vector2(0, crossheadAccelerationY),
        center: new THREE.Vector2(pistonAxisX, crossheadY),
        leftEnd: leftWristPin.clone(),
        rightEnd: rightWristPin.clone(),
        rotation: 0,
        span: crossheadSpan,
        velocity: wristVelocity.clone(),
      },
      crossheadAccelerationY,
      crossheadFirstByGearAngle,
      crossheadSecondByGearAngle,
      crossheadVelocityY,
      crossheadY,
      gearCoordinate,
      gearCoordinateAngle,
      inputAngle,
      inputAngularVelocity: angularVelocity,
      inputPinionContactVelocity,
      inputPinionPitchContact,
      inputPhase: inputAngle / FULL_TURN,
      leftCrankPin,
      leftCrankPinAcceleration,
      leftCrankPinVelocity,
      leftGearAngle,
      leftGearAngularVelocity: gearAngularVelocity,
      leftGearUnwrappedAngle,
      leftRightContactVelocity,
      leftRod: {
        angle: Math.atan2(leftRodVector.y, leftRodVector.x),
        angularAcceleration: leftRates.angularAcceleration,
        angularVelocity: leftRates.angularVelocity,
        length: leftRodVector.length(),
        lengthResidual: leftRodVector.length() - connectingRodLength,
        obliquityFromVertical: Math.atan2(
          leftRodVector.x,
          -leftRodVector.y,
        ),
        vector: leftRodVector,
      },
      leftWristPin,
      mesh: {
        equalGearCenterDistance: leftGearCenter.distanceTo(rightGearCenter),
        equalGearPitchContact,
        equalGearSlipVelocity: leftRightContactVelocity.clone()
          .sub(rightLeftContactVelocity),
        inputCenterDistance: inputPinionRadius + equalGearRadius,
        inputPitchPointResidual: inputPinionPitchContact.clone()
          .sub(rightGearLowerPitchContact),
        inputSlipVelocity: inputPinionContactVelocity.clone()
          .sub(rightLowerContactVelocity),
        rightGearLowerPitchContact,
        rightLeftContactVelocity,
      },
      pistonAxisResidual: new THREE.Vector2(
        (leftWristPin.x + rightWristPin.x) / 2 - pistonAxisX,
        leftWristPin.y - rightWristPin.y,
      ),
      rightCrankPin,
      rightCrankPinAcceleration,
      rightCrankPinVelocity,
      rightGearAngle,
      rightGearAngularVelocity: -gearAngularVelocity,
      rightGearUnwrappedAngle,
      rightRod: {
        angle: Math.atan2(rightRodVector.y, rightRodVector.x),
        angularAcceleration: rightRates.angularAcceleration,
        angularVelocity: rightRates.angularVelocity,
        length: rightRodVector.length(),
        lengthResidual: rightRodVector.length() - connectingRodLength,
        obliquityFromVertical: Math.atan2(
          rightRodVector.x,
          -rightRodVector.y,
        ),
        vector: rightRodVector,
      },
      rightWristPin,
      unwrappedInputAngle,
    };
  };

  // Brown draws both cranks A turned inward and below their shafts, the
  // crosshead just past the bottom of its stroke. One full input turn from the
  // official start advances the wheels 0.4 turn (144 degrees, exactly twelve
  // teeth) to that pose while the flywheel and pinion return to their start.
  const plateStartInputAngle = FULL_TURN;
  const plateStartOutputPhase = equalGearRatio;
  const stateAtTime = (time) => {
    const elapsed = Number.isFinite(Number(time)) ? Number(time) : 0;
    return stateAtInputAngle(plateStartInputAngle
      + elapsed * inputAngularSpeed);
  };
  const outputTimeAt = (officialPhase) => outputCyclePeriod
    * positiveModulo(officialPhase - plateStartOutputPhase, 1);
  const canonicalTimes = {
    assemblyCycleClosure: assemblyClosurePeriod,
    bottomDeadCenter: outputTimeAt(0.25),
    cycleClosure: assemblyClosurePeriod,
    firstOutputClosure: outputCyclePeriod,
    oppositeMidStroke: outputTimeAt(0.50),
    officialStart: outputTimeAt(0),
    sourceStart: 0,
    topDeadCenter: outputTimeAt(0.75),
  };
  const canonicalStates = Object.fromEntries(
    Object.entries(canonicalTimes).map(([name, time]) => [
      name,
      stateAtTime(time),
    ]),
  );

  const officialViewMinimum = new THREE.Vector2(-17, -18.847584);
  const officialViewWidth = 34;
  const officialViewHeight = 34;
  const officialCanvasWidth = 525;
  const officialCanvasHeight = 525;
  const modelPointToOfficialAnimationRaster = (point) => {
    const rawX = point.x / sourceScale;
    const rawY = point.y / sourceScale;
    return new THREE.Vector2(
      (rawX - officialViewMinimum.x)
        * officialCanvasWidth / officialViewWidth,
      officialCanvasHeight - (rawY - officialViewMinimum.y)
        * officialCanvasHeight / officialViewHeight,
    );
  };

  const geometry = {
    assemblyClosurePeriod,
    commonToothHeight,
    connectingRodLength,
    crankDepth,
    crankPlaneZ,
    crankRadius,
    crossheadPlaneZ,
    crossheadSpan,
    equalGearAngularSpeed,
    equalGearCenterSpacing,
    equalGearDepth,
    equalGearPlaneZ,
    equalGearRadius,
    equalGearRatio,
    equalGearTeeth,
    flywheelDepth,
    flywheelInnerRadius,
    flywheelOuterRadius,
    flywheelPlaneZ,
    frameBottomY,
    gearCenterY,
    inputAngularSpeed,
    inputCyclePeriod,
    inputPinionDepth,
    inputPinionPlaneZ,
    inputPinionRadius,
    inputPinionTeeth,
    inputPinionToothOffset,
    leftGearCenter,
    leftGearToothOffset,
    outputCyclePeriod,
    pistonAxisX,
    pistonRodBottomLocalY,
    pistonRodTopLocalY,
    pistonStroke,
    rightGearCenter,
    rightGearToothOffset,
    rodDepth,
    rodPlaneZ,
    sourceConnectingRodLength,
    sourceCrankRadius,
    sourceCrossheadSpan,
    sourceEqualGearCenterSpacing,
    sourceEqualGearRadius,
    sourceFlywheelInnerRadius,
    sourceFlywheelOuterRadius,
    sourceGearCenterY,
    sourceInputCyclesPerMinute,
    sourceInputPinionRadius,
    sourcePistonRodBottomLocalY,
    sourcePistonRodTopLocalY,
    sourceScale,
  };

  const contacts = {
    inputPinionToRightWheelC: {
      driver: inputParts.pinion,
      driven: rightGearParts.gear,
      pitchPoint: new THREE.Vector3(
        0,
        inputPinionRadius,
        inputPinionPlaneZ,
      ),
      ratio: -equalGearRatio,
      slipVelocity: new THREE.Vector2(),
      type: 'external-involute-gear-mesh',
    },
    rightWheelCToLeftWheelC: {
      driver: rightGearParts.gear,
      driven: leftGearParts.gear,
      pitchPoint: new THREE.Vector3(
        pistonAxisX,
        gearCenterY,
        equalGearPlaneZ,
      ),
      ratio: -1,
      slipVelocity: new THREE.Vector2(),
      type: 'equal-external-involute-gear-mesh',
    },
  };

  const update = (time) => {
    const state = stateAtTime(time);
    inputParts.rotor.rotation.z = state.inputAngle;
    leftGearParts.rotatingBody.rotation.z = state.leftGearAngle;
    rightGearParts.rotatingBody.rotation.z = state.rightGearAngle;

    crosshead.position.set(pistonAxisX, state.crossheadY, 0);
    leftRodParts.rod.position.set(
      state.leftCrankPin.x,
      state.leftCrankPin.y,
      rodPlaneZ,
    );
    leftRodParts.rod.rotation.z = state.leftRod.angle;
    rightRodParts.rod.position.set(
      state.rightCrankPin.x,
      state.rightCrankPin.y,
      rodPlaneZ,
    );
    rightRodParts.rod.rotation.z = state.rightRod.angle;
    leftCrankPinShaft.position.set(
      state.leftCrankPin.x,
      state.leftCrankPin.y,
      (rodPlaneZ + crankPlaneZ) / 2,
    );
    rightCrankPinShaft.position.set(
      state.rightCrankPin.x,
      state.rightCrankPin.y,
      (rodPlaneZ + crankPlaneZ) / 2,
    );
    contacts.inputPinionToRightWheelC.slipVelocity.copy(
      state.mesh.inputSlipVelocity,
    );
    contacts.rightWheelCToLeftWheelC.slipVelocity.copy(
      state.mesh.equalGearSlipVelocity,
    );
    root.userData.kinematics = state;
  };

  root.userData.archetype =
    'Cartwright-opposed-equal-crank-geared-parallel-motion';
  root.userData.blocks = {
    crosshead,
    crossheadBar,
    crossheadPins,
    cylinderBody,
    cylinderTop,
    fixedFrame,
    inputFlywheel: inputParts.rotor,
    inputFlywheelRim: inputParts.rim,
    inputFlywheelSpokes: inputParts.spokes,
    inputPinion: inputParts.pinion,
    inputShaft: inputParts.shaft,
    leftBearing,
    leftCrankA: leftGearParts.crankArm,
    leftCrankPinAnchor: leftGearParts.crankPinAnchor,
    leftCrankPinShaft,
    leftGearBody: leftGearParts.rotatingBody,
    leftRod: leftRodParts.rod,
    leftRodCrankAnchor: leftRodParts.crankAnchor,
    leftRodWristAnchor: leftRodParts.wristAnchor,
    leftWheelC: leftGearParts.gear,
    stuffingBox,
    pistonAxisAnchor,
    pistonGland,
    glandNeck,
    pistonBoss,
    pistonRodB: pistonRod,
    rightBearing,
    rightCrankA: rightGearParts.crankArm,
    rightCrankPinAnchor: rightGearParts.crankPinAnchor,
    rightCrankPinShaft,
    rightGearBody: rightGearParts.rotatingBody,
    rightRod: rightRodParts.rod,
    rightRodCrankAnchor: rightRodParts.crankAnchor,
    rightRodWristAnchor: rightRodParts.wristAnchor,
    rightWheelC: rightGearParts.gear,
    upperBeam,
  };
  root.userData.canonicalStates = canonicalStates;
  root.userData.canonicalTimes = canonicalTimes;
  root.userData.contacts = contacts;
  root.userData.degreesOfFreedom = {
    crossheadRotation: 0,
    crossheadTranslationAxes: 1,
    input: 'one continuous flywheel and pinion rotation',
    mechanism: 1,
    output:
      'one rectilinear piston-rod translation created by opposed equal crank obliquities',
  };
  root.userData.fidelity = 'authored';
  root.userData.geometry = geometry;
  root.userData.groundFloorY = frameBottomY - 0.025;
  root.userData.mechanism =
    'Cartwright-1787-twelve-to-thirty-to-thirty-gears-opposite-equal-cranks-twin-equal-rods-horizontal-crosshead';
  root.userData.modelPointToOfficialAnimationRaster =
    modelPointToOfficialAnimationRaster;
  root.userData.sourceAnimation = {
    available: true,
    assemblyClosureSeconds: assemblyClosurePeriod,
    baseCycleSeconds: inputCyclePeriod,
    cyclesPerMinute: sourceInputCyclesPerMinute,
    independentlyReconstructed: true,
    officialCanvasModelPresent: true,
    officialGeometry: {
      connectingRodLength: sourceConnectingRodLength,
      crankRadius: sourceCrankRadius,
      crossheadSpan: sourceCrossheadSpan,
      equalGearCenterSpacing: sourceEqualGearCenterSpacing,
      equalGearPitchRadius: sourceEqualGearRadius,
      equalGearRotationPerInputTurn: 0.4,
      flywheelInnerRadius: sourceFlywheelInnerRadius,
      flywheelOuterRadius: sourceFlywheelOuterRadius,
      gearCenterY: sourceGearCenterY,
      inputPinionPitchRadius: sourceInputPinionRadius,
      leftGearInitialTurn: 0.5,
      pistonRodBottomLocalY: sourcePistonRodBottomLocalY,
      pistonRodTopLocalY: sourcePistonRodTopLocalY,
      rightGearInitialTurn: 0,
    },
    officialKeyframes: [0, 0.25, 0.50, 0.75, 1].map((phase) => {
      const state = stateAtInputAngle(outputCyclePeriod * phase * inputAngularSpeed);
      return {
        crossheadY: state.crossheadY / sourceScale,
        leftCrankPin: state.leftCrankPin.clone().multiplyScalar(
          1 / sourceScale,
        ),
        phase,
        rightCrankPin: state.rightCrankPin.clone().multiplyScalar(
          1 / sourceScale,
        ),
      };
    }),
    officialPageAnimatedTabDisabled: false,
    outputCycleSeconds: outputCyclePeriod,
    referenceScope:
      'official input flywheel and 2-unit pinion, equal 5-unit wheels C C, equal opposite 3.5-unit cranks A A, twin 15-unit rods, crosshead, and piston-rod B',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    brownPlate328: {
      imageHeight: 525,
      imageWidth: 525,
      inferredTopology:
        'one flywheel pinion driving two equal meshing wheels C C, two equal opposite cranks A A, two equal rods, one horizontal crosshead, and central piston-rod B',
      measurementUncertaintyPixels: 24,
      rasterCrossheadLeftPin: new THREE.Vector2(118, 379),
      rasterCrossheadRightPin: new THREE.Vector2(279, 378),
      rasterInputPinionCenter: new THREE.Vector2(286, 244),
      rasterLeftCrankPinA: new THREE.Vector2(176, 169),
      rasterLeftWheelCenterC: new THREE.Vector2(119, 106),
      rasterPistonAxisB: new THREE.Vector2(200, 440),
      rasterRightCrankPinA: new THREE.Vector2(233, 169),
      rasterRightWheelCenterC: new THREE.Vector2(285, 107),
    },
    officialAnimationView: {
      canvasHeight: officialCanvasHeight,
      canvasWidth: officialCanvasWidth,
      minimum: officialViewMinimum,
      viewHeight: officialViewHeight,
      viewWidth: officialViewWidth,
    },
    officialDescription: movement.description,
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      edition: 21,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtInputAngle = stateAtInputAngle;
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    crossheadConstraint:
      'equal 15-unit rods on mirror-opposed 3.5-unit cranks give identical endpoint heights',
    input: 'flywheel-fixed 2-unit pinion rotating at 15 rpm',
    leftWheelRatio: equalGearRatio,
    output:
      'central piston-rod B translates on x = -5 source units with zero crosshead yaw',
    rightWheelRatio: -equalGearRatio,
    wheelToWheelRatio: -1,
  };

  fitPistonGuide(root,update,assemblyClosurePeriod);
  root.userData.sweptBounds = root.userData.cameraFitBounds;
  // Brown's crop: from the bed's left end to the flywheel's right rim, and
  // from the tops of wheels C down to the cylinder cover. Brown draws no
  // standards, bed plate or flywheel-shaft hanger, so none is built; the
  // whole cylinder runs on below the crop and ends at its foot.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.65, -3.5, -0.6),
    new THREE.Vector3(3.05, 3.15, 1.45),
  );
  root.userData.cameraDistanceScale = 1.0;
  root.userData.cameraFov = 8;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(0.45, 0.28, 14),
    root,
    update,
  };
}

export function createAuthoredCartwrightParallelMotion(movement) {
  if (movement.id !== 328) return null;
  return CartwrightParallelMotion(movement);
}
