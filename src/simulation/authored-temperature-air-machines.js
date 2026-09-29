import {makeTemperatureBevel,mitreBevelPhases} from './temperature-bevel-pair.js';
import {crownToothGeometry} from './face-gear-geometry.js';
import {plate, poly, circle, polygonClipping, ring} from './finite-plate-geometry.js';
import {mergePassageParts} from './finite-fluid-passages.js';
import { correctTemperatureAirMachine } from './thermal-steam-working-parts.js';
import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import {
  PALETTE,
  makeGear,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smootherStep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x ** 3 * (10 + x * (-15 + 6 * x));
}

function smootherStepDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 30 * x ** 2 * (1 - x) ** 2;
}

function smootherStepSecondDerivative(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return 60 * x * (1 - x) * (1 - 2 * x);
}

function cylinderAlongZ(radius, length, material, segments = 30) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

// A rigid pipe centreline: straight runs joined by circular fillets of the
// given radius (one per interior corner), as Brown draws the air tube.
function filletedPipePath(points, radii) {
  const path = new THREE.CurvePath();
  let start = points[0].clone();
  for (let i = 1; i < points.length - 1; i += 1) {
    const corner = points[i];
    const inDir = corner.clone().sub(points[i - 1]).normalize();
    const outDir = points[i + 1].clone().sub(corner).normalize();
    const turn = Math.acos(THREE.MathUtils.clamp(inDir.dot(outDir), -1, 1));
    const radius = radii[i - 1];
    const cut = radius * Math.tan(turn / 2);
    const a = corner.clone().addScaledVector(inDir, -cut);
    const b = corner.clone().addScaledVector(outDir, cut);
    path.add(new THREE.LineCurve3(start, a));
    const normal = outDir.clone().sub(inDir.clone().multiplyScalar(inDir.dot(outDir))).normalize();
    const center = a.clone().addScaledVector(normal, radius);
    const u = a.clone().sub(center), v = inDir.clone().multiplyScalar(radius);
    const arc = new THREE.Curve();
    arc.getPoint = (t, target = new THREE.Vector3()) => target.copy(center)
      .addScaledVector(u, Math.cos(t * turn)).addScaledVector(v, Math.sin(t * turn));
    path.add(arc);
    start = b;
  }
  path.add(new THREE.LineCurve3(start, points.at(-1).clone()));
  return path;
}

// Brown's air vessel at the foot of the screw: a bottle standing on the cold
// cistern's floor. Straight sides rise to rounded shoulders that close in on
// a short neck carrying the air duct; the front and back are flat (a flask),
// the screw casing enters the right side through a hole that fits it, and
// the neck's top plate is bored for the duct.
function airBottleGeometry({x0, x1, z, floorY, shoulderY, neckY, roofY, neckHalf, wall, casingHole, pipeBore, pipeX}) {
  const parts = [];
  // Outline from the left shoulder foot round the neck to the right foot.
  const shoulder = (left, right, half, low, top, neckTop) => {
    const points = [];
    for (let i = 0; i <= 24; i += 1) {
      const a = Math.PI / 2 * i / 24;
      points.push([pipeX - half - (pipeX - half - left) * Math.cos(a), low + (top - low) * Math.sin(a)]);
    }
    points.push([pipeX - half, neckTop], [pipeX + half, neckTop]);
    for (let i = 24; i >= 0; i -= 1) {
      const a = Math.PI / 2 * i / 24;
      points.push([pipeX + half + (right - pipeX - half) * Math.cos(a), low + (top - low) * Math.sin(a)]);
    }
    return points;
  };
  const outlineRegion = polygonClipping.union(poly([[x0, floorY], [x1, floorY], [x1, shoulderY], [x0, shoulderY]]),
    poly(shoulder(x0, x1, neckHalf, shoulderY, neckY, roofY)));
  // Front and back walls: the bottle's outline.
  for (const [low, high] of [[z - wall, z], [-z, -z + wall]]) parts.push(plate(outlineRegion, low, high));
  const rectXY = (a, b, c, d) => poly([[a, c], [b, c], [b, d], [a, d]]);
  // Shoulder band and neck walls, extruded through the depth between them.
  const band = polygonClipping.difference(
    polygonClipping.intersection(outlineRegion, rectXY(x0 - 1, x1 + 1, shoulderY, roofY)),
    poly(shoulder(x0 + wall, x1 - wall, neckHalf - wall, shoulderY - 1e-3, neckY - wall, roofY + 1)));
  parts.push(plate(band, -z + wall, z - wall));
  // Left and right sides: YZ plates extruded along x (plate x -> world -z, plate y -> world y).
  const yz = (holes = []) => polygonClipping.difference(poly([[-z + wall, floorY], [z - wall, floorY], [z - wall, shoulderY], [-z + wall, shoulderY]]), ...holes);
  const alongX = (polys, low, high) => plate(polys, low, high).rotateY(Math.PI / 2);
  parts.push(alongX(yz(), x0, x0 + wall));
  const hole = poly(Array.from({length: 96}, (_, i) => [
    casingHole.z * Math.cos(i * Math.PI / 48), casingHole.y + casingHole.halfHeight * Math.sin(i * Math.PI / 48)]));
  parts.push(alongX(yz([hole]), x1 - wall, x1));
  // Floor, and the neck's top plate bored for the duct (XZ plates; plate y -> world -z).
  const alongY = (polys, low, high) => plate(polys, low, high).rotateX(-Math.PI / 2);
  parts.push(alongY(poly([[x0 + wall, -z + wall], [x1 - wall, -z + wall], [x1 - wall, z - wall], [x0 + wall, z - wall]]), floorY, floorY + wall));
  parts.push(alongY(polygonClipping.difference(poly([[pipeX - neckHalf, -z], [pipeX + neckHalf, -z], [pipeX + neckHalf, z], [pipeX - neckHalf, z]]),
    poly(circle([pipeX, 0], pipeBore, 64))), roofY - wall, roofY));
  return mergePassageParts(parts);
}

// Pass 74: the pipe's mouth under the wheel. A box open at the top, whose
// front, back and side walls end in arcs concentric with the wheel; the pipe
// enters the right wall through a hole of its own bore.
function wheelHoodGeometry({cx, cy, xL, xR, yBottom, arcRadius, zC, halfWidth, wall, pipeY, pipeBore}) {
  const arcY = (x) => cy - Math.sqrt(arcRadius ** 2 - (x - cx) ** 2);
  const profile = (a, b) => {
    const points = [[a, yBottom], [b, yBottom]];
    for (let i = 0; i <= 48; i += 1) {
      const x = b + (a - b) * i / 48;
      points.push([x, arcY(x)]);
    }
    return poly(points);
  };
  const parts = [];
  const outline = profile(xL, xR);
  parts.push(plate(outline, zC + halfWidth - wall, zC + halfWidth));
  parts.push(plate(outline, zC - halfWidth, zC - halfWidth + wall));
  parts.push(plate(profile(xL, xL + wall), zC - halfWidth + wall, zC + halfWidth - wall));
  // Right wall across the depth (plate x -> world -z, extrusion -> world x).
  const rightTop = arcY(xR - wall);
  const right = polygonClipping.difference(
    poly([[-(zC + halfWidth - wall), yBottom], [-(zC - halfWidth + wall), yBottom],
      [-(zC - halfWidth + wall), rightTop], [-(zC + halfWidth - wall), rightTop]]),
    poly(circle([-zC, pipeY], pipeBore, 64)));
  parts.push(plate(right, xR - wall, xR).rotateY(Math.PI / 2));
  // Floor (plate y -> world -z, extrusion -> world y).
  parts.push(plate(poly([[xL + wall, -(zC + halfWidth - wall)], [xR - wall, -(zC + halfWidth - wall)],
    [xR - wall, -(zC - halfWidth + wall)], [xL + wall, -(zC - halfWidth + wall)]]),
  yBottom, yBottom + wall).rotateX(-Math.PI / 2));
  return mergePassageParts(parts);
}

// The cutaway section (cutaway-presentations.js, 469) is the plane z = 0.6.
const TANK_WATER_FRONT_Z = 0.59;

function createTank({
  centerX,
  tankWidth,
  tankDepth,
  tankBottomY,
  tankTopY,
  waterTopY,
  waterFrontZ,
  waterMaterial,
  wallMaterial,
  rolePrefix,
}) {
  const tank = addRole(new THREE.Group(), `${rolePrefix}-cistern`);
  const wallThickness = 0.14;
  const tankHeight = tankTopY - tankBottomY;
  const base = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(tankWidth, wallThickness, tankDepth),
    wallMaterial,
  ), `${rolePrefix}-cistern-base`);
  base.position.set(centerX, tankBottomY, 0);
  tank.add(base);

  for (const side of [-1, 1]) {
    const endWall = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, tankHeight, tankDepth),
      wallMaterial,
    ), `${rolePrefix}-cistern-end-wall-${side < 0 ? 'left' : 'right'}`);
    endWall.position.set(
      centerX + side * (tankWidth / 2 - wallThickness / 2),
      tankBottomY + tankHeight / 2,
      0,
    );
    tank.add(endWall);
  }

  const backWall = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(tankWidth, tankHeight, wallThickness),
    wallMaterial,
  ), `${rolePrefix}-cistern-back-wall`);
  backWall.position.set(
    centerX,
    tankBottomY + tankHeight / 2,
    -tankDepth / 2 + wallThickness / 2,
  );
  tank.add(backWall);

  const cutawayFront = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(tankWidth, 0.34, wallThickness),
    wallMaterial,
  ), `${rolePrefix}-cistern-cutaway-front`);
  cutawayFront.position.set(
    centerX,
    tankBottomY + 0.17,
    tankDepth / 2 - wallThickness / 2,
  );
  tank.add(cutawayFront);

  // The water runs 0.03 into the floor, end walls and back wall, so none of
  // its faces lies on a wall face (coplanar faces z-fight); the buried faces
  // are hidden by the opaque walls. Its front face stands 0.01 behind the
  // section plane (z 0.6), where the cut end walls' faces lie, so the cut
  // water shows as a real face instead of only its far side.
  const waterSink = 0.03;
  const waterBottomY = tankBottomY + wallThickness / 2 - waterSink;
  const waterHeight = waterTopY - waterBottomY;
  const waterBackZ = -tankDepth / 2 + wallThickness - waterSink;
  const waterDepth = waterFrontZ - waterBackZ;
  const water = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(
      tankWidth - 2 * wallThickness + 2 * waterSink,
      waterHeight,
      waterDepth,
    ),
    waterMaterial,
  ), `${rolePrefix}-water-body`);
  water.position.set(
    centerX,
    waterBottomY + waterHeight / 2,
    waterBackZ + waterDepth / 2,
  );
  water.userData.sunkIntoWalls = waterSink;
  tank.add(water);
  return {
    base,
    cutawayFront,
    tank,
    water,
  };
}

function temperatureAirMachine(movement) {
  const root = new THREE.Group();
  const cycleDuration = 13.8;
  const operationEndPhase = 0.68;
  const thermalResetStartPhase = 0.82;
  const totalScrewTurns = 4;
  const initialColdTemperatureKelvin = 293.15;
  const initialWarmTemperatureKelvin = 313.15;
  const equilibriumTemperatureKelvin = (
    initialColdTemperatureKelvin + initialWarmTemperatureKelvin
  ) / 2;
  const initialTemperatureDifferenceKelvin =
    initialWarmTemperatureKelvin - initialColdTemperatureKelvin;
  const ambientPressurePascal = 101325;
  const referenceAirVolumeCubicMeter = 0.0001;
  // Pass 69: Brown's proportions and gearing. The cisterns are as deep as
  // Brown draws them; the screw rises at his 47.6 degrees and ends above the
  // cold cistern (it used to run through both cistern walls). A mitre pair
  // at its head turns an inclined shaft S that crosses above the warm
  // cistern's wall to the wheel's hub, where a second mitre pair turns the
  // wheel, as the plate shows (no spur gear is drawn). The air vessel stands
  // on the cold cistern's floor round the screw's foot, and the rigid air
  // tube rises from it, crosses high above and descends into the warm
  // cistern to a hood fitted under the wheel.
  const tankBottomY = -2.10;
  const tankTopY = 0.74;
  const waterTopY = 0.54;
  // Pass 74: just deep enough front to back for the hood behind the wheel.
  const tankDepth = 2.20;
  const coldTankCenterX = -2.15;
  const warmTankCenterX = 1.55;
  const coldTankWidth = 3.35;
  const warmTankWidth = 3.25;
  const screwInclination = THREE.MathUtils.degToRad(47.6);
  const screwAxis = new THREE.Vector3(Math.cos(screwInclination), Math.sin(screwInclination), 0);
  const transferShaftDirection = new THREE.Vector3(screwAxis.y, -screwAxis.x, 0);
  const bevelApexExtension = .56;
  const transferCenter = new THREE.Vector3(-0.60, 1.483, 0);
  const screwLength = 3.2;
  const screwUpperPoint = transferCenter.clone().addScaledVector(screwAxis, -bevelApexExtension);
  const screwLowerPoint = screwUpperPoint.clone().addScaledVector(screwAxis, -screwLength);
  const screwFlightTurns = 6;
  const screwPitch = screwLength / screwFlightTurns;
  const screwRadius = 0.30;
  // Pass 70: Brown's head gears are large (about half the wheel's radius).
  // Pass 72: at the wheel Brown draws a face gear: a ring of radial teeth on
  // the wheel's front face, between its hub and its paddles, turned by a
  // pinion on S lying across the ring. S runs parallel to the face and over
  // the wheel's axis. A 12-tooth involute pinion drives a 48-tooth face gear
  // generated by that pinion, so the wheel makes one turn to the screw's four.
  const headBevelScale = 1.5;
  const faceGearTeeth = 48, facePinionTeeth = 12, faceGearModule = 0.022;
  const facePinionPitchRadius = faceGearModule * facePinionTeeth / 2;
  const faceGearPitchRadius = faceGearModule * faceGearTeeth / 2;
  const faceGearInnerRadius = 0.43, faceGearOuterRadius = 0.63;
  const faceGearDiskRadius = 0.66, faceGearDiskThickness = 0.10;
  const faceGearTipFace = facePinionPitchRadius - faceGearModule;
  const faceGearBaseFace = facePinionPitchRadius + 1.25 * faceGearModule;
  const faceGearRatio = facePinionTeeth / faceGearTeeth;
  const screwBevelPitchRadius = 0.32 * headBevelScale;
  const outputBevelPitchRadius = 0.32 * headBevelScale;
  const wheelCenterX = 1.30;
  const transferShaftLength = (wheelCenterX - transferCenter.x) / transferShaftDirection.x;
  const wheelCenter = transferCenter.clone().addScaledVector(transferShaftDirection, transferShaftLength);
  const gearCenterDirection = transferShaftDirection.clone();
  const waterWheelRadius = 0.84;
  const waterWheelBladeCount = 14;
  // The face-gear disk stands on the wheel's hub, just in front of the
  // paddles.
  const wheelPlaneZ = -0.62;
  const wheelMeshPhase = 0;
  const waterRaisingRotationSign = 1;
  const operatingScrewRotationSign = -1;
  const bubbleCount = 14;
  const bubbleBaseRadius = 0.055;
  const groundY = tankBottomY - 0.09;

  const wallMaterial = matte(PALETTE.frame, {
    metalness: 0.12,
    roughness: 0.72,
  });
  const coldInitialColor = new THREE.Color(0x3e83a4);
  const coldWaterMaterial = matte(coldInitialColor, {
    transparent: true,
    opacity: 0.43,
    roughness: 0.24,
  });
  const warmWaterMaterial = matte(coldInitialColor, {
    transparent: true,
    opacity: 0.43,
    roughness: 0.24,
  });
  coldWaterMaterial.depthWrite = false;
  warmWaterMaterial.depthWrite = false;

  const coldTankParts = createTank({
    centerX: coldTankCenterX,
    rolePrefix: 'natural-temperature-left',
    tankBottomY,
    tankDepth,
    tankTopY,
    tankWidth: coldTankWidth,
    wallMaterial,
    waterMaterial: coldWaterMaterial,
    waterTopY,
    waterFrontZ: TANK_WATER_FRONT_Z,
  });
  const warmTankParts = createTank({
    centerX: warmTankCenterX,
    rolePrefix: 'higher-temperature-right',
    tankBottomY,
    tankDepth,
    tankTopY,
    tankWidth: warmTankWidth,
    wallMaterial,
    waterMaterial: warmWaterMaterial,
    waterTopY,
    waterFrontZ: TANK_WATER_FRONT_Z,
  });
  root.add(coldTankParts.tank, warmTankParts.tank);
  // Pass 101: Brown's bottom line runs unbroken under both cisterns: one
  // base slab carries the two tanks and bridges the space between their
  // inner walls (they stood on two separate bases with a gap between).
  {
    const left = coldTankCenterX - coldTankWidth / 2, right = warmTankCenterX + warmTankWidth / 2;
    const commonBase = coldTankParts.base;
    commonBase.geometry.dispose();
    commonBase.geometry = new THREE.BoxGeometry(right - left, 0.14, tankDepth);
    commonBase.position.x = (left + right) / 2;
    commonBase.userData.role = 'common-base-under-both-cisterns';
    warmTankParts.base.removeFromParent();
    warmTankParts.base.geometry.dispose();
    warmTankParts.base = commonBase;
    // The left cistern's low cut front runs on across the space to the right
    // cistern's, so the base's front edge is one unbroken lip.
    const front = coldTankParts.cutawayFront, warmLeft = warmTankCenterX - warmTankWidth / 2;
    const frontWidth = warmLeft - left;
    front.geometry.dispose();
    front.geometry = new THREE.BoxGeometry(frontWidth, 0.34, 0.14);
    front.position.x = left + frontWidth / 2;
  }

  const screwMount = addRole(new THREE.Group(),
    'inclined-archimedean-screw-mount');
  screwMount.position.copy(screwLowerPoint).add(screwUpperPoint)
    .multiplyScalar(0.5);
  screwMount.quaternion.setFromUnitVectors(Y_AXIS, screwAxis);
  root.add(screwMount);

  const screwBarrelMaterial = matte(PALETTE.white, {
    transparent: true,
    opacity: 0.29,
    roughness: 0.24,
    side: THREE.DoubleSide,
  });
  screwBarrelMaterial.depthWrite = false;
  const screwBarrel = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(
      screwRadius + 0.055,
      screwRadius + 0.055,
      screwLength,
      42,
      1,
      true,
    ),
    screwBarrelMaterial,
  ), 'transparent-inclined-screw-barrel');
  screwMount.add(screwBarrel);

  const screwRotor = addRole(new THREE.Group(),
    'reversed-archimedean-screw-rotor');
  screwMount.add(screwRotor);
  const screwShaftMaterial = matte(PALETTE.ink, {
    metalness: 0.44,
    roughness: 0.38,
  });
  const screwShaft = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, screwLength + 0.62, 48),
    screwShaftMaterial,
  ), 'archimedean-screw-shaft');
  screwShaft.position.y = .10;
  screwRotor.add(screwShaft);

  const helixPoints = [];
  const helixSamples = 220;
  for (let sample = 0; sample <= helixSamples; sample += 1) {
    const fraction = sample / helixSamples;
    const angle = FULL_TURN * screwFlightTurns * fraction;
    helixPoints.push(new THREE.Vector3(
      screwRadius * Math.cos(angle),
      -screwLength / 2 + screwLength * fraction,
      screwRadius * Math.sin(angle),
    ));
  }
  const screwHelixCurve = new THREE.CatmullRomCurve3(
    helixPoints,
    false,
    'centripetal',
  );
  const screwFlight = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(screwHelixCurve, 300, 0.047, 11, false),
    matte(PALETTE.accent, { metalness: 0.36, roughness: 0.42 }),
  ), 'right-handed-air-conveying-screw-flight');
  screwRotor.add(screwFlight);

  // Inclined transfer shaft S: its own frame has +z along S from the apex
  // at the screw's head to the apex at the wheel's hub.
  const transferShaftMount = addRole(new THREE.Group(),
    'inclined-transfer-shaft-S-mount');
  transferShaftMount.position.copy(transferCenter);
  const transferShaftQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), transferShaftDirection);
  transferShaftMount.quaternion.copy(transferShaftQuaternion);
  root.add(transferShaftMount);
  const transferShaftRotor = addRole(new THREE.Group(),
    'inclined-transfer-shaft-S-from-screw-head-to-wheel-hub');
  transferShaftMount.add(transferShaftRotor);

  const waterWheelAssembly = addRole(new THREE.Group(),
    'warm-cistern-water-wheel-assembly');
  waterWheelAssembly.position.copy(wheelCenter);
  root.add(waterWheelAssembly);
  const waterWheelRotor = addRole(new THREE.Group(),
    'geared-bubble-driven-water-wheel-rotor');
  waterWheelAssembly.add(waterWheelRotor);

  const inputAxisLocal = new THREE.Vector3(0, -1, 0);
  const headPair = mitreBevelPhases(
    {axis: inputAxisLocal, parentQuaternion: screwMount.quaternion},
    {axis: new THREE.Vector3(0, 0, 1), parentQuaternion: transferShaftQuaternion},
  );
  const bevelLayout = {
    inputAxis: inputAxisLocal.clone(),
    headContact: headPair.contact.clone(),
    inputPhase: headPair.phaseA,
    outputPhase: headPair.phaseB,
  };
  const inputBevel=makeTemperatureBevel({axis:inputAxisLocal,phase:headPair.phaseA,color:PALETTE.driver,role:'screw-shaft-input-bevel',scale:headBevelScale});
  inputBevel.position.y=screwLength/2+bevelApexExtension;
  screwRotor.add(inputBevel);
  const outputBevel=makeTemperatureBevel({axis:new THREE.Vector3(0,0,1),phase:headPair.phaseB,color:PALETTE.driven,role:'transfer-shaft-S-head-bevel',scale:headBevelScale});
  transferShaftRotor.add(outputBevel);
  // Face-gear pair at the wheel. The face gear's frame has x outward along
  // -S (the pinion's axis), z = -world z (its teeth face the pinion, whose
  // axis lies in the engraving plane z = 0) and y = z x x. The pinion's
  // profile frame has x = -world z, y = S x world z and its axis along -S,
  // the frame crownToothGeometry generates the teeth in.
  const worldZ = new THREE.Vector3(0, 0, 1);
  const outward = transferShaftDirection.clone().negate();
  const faceGear = addRole(new THREE.Group(), 'water-wheel-face-gear');
  faceGear.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    outward, new THREE.Vector3().crossVectors(worldZ, transferShaftDirection), worldZ.clone().negate()));
  waterWheelRotor.add(faceGear);
  const facePinion = addRole(new THREE.Group(), 'transfer-shaft-S-face-gear-pinion');
  const pinionWorldQuaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    worldZ.clone().negate(), new THREE.Vector3().crossVectors(transferShaftDirection, worldZ), outward));
  facePinion.quaternion.copy(transferShaftQuaternion.clone().invert().multiply(pinionWorldQuaternion));
  const facePinionCenterRadius = (faceGearInnerRadius + faceGearOuterRadius) / 2;
  facePinion.position.z = transferShaftLength - facePinionCenterRadius;
  transferShaftRotor.add(facePinion);
  const pinionTemplate = makeGear({
    teeth: facePinionTeeth,
    radius: facePinionPitchRadius,
    depth: faceGearOuterRadius - faceGearInnerRadius - 0.02,
    addendum: faceGearModule,
    dedendum: 1.25 * faceGearModule,
    chamfer: 0.004,
  });
  const pinionExtrusion = pinionTemplate.userData.rotor.children
    .find((part) => part.geometry?.type === 'ExtrudeGeometry');
  const facePinionMaterial = matte(PALETTE.driven, {metalness: 0.24, roughness: 0.48});
  const facePinionBody = addRole(new THREE.Mesh(pinionExtrusion.geometry, facePinionMaterial),
    'involute-face-gear-pinion-on-S');
  facePinionBody.rotation.z = Math.PI / facePinionTeeth;
  facePinion.add(facePinionBody);
  pinionTemplate.traverse((part) => {
    if (part.isMesh && part !== pinionExtrusion) part.geometry.dispose();
    if (part.isMesh) part.material.dispose();
  });
  const faceToothGeometry = crownToothGeometry({
    profile: pinionExtrusion.geometry.parameters.shapes.getPoints(),
    pinionTeeth: facePinionTeeth,
    pinionCenterX: 0,
    crownTeeth: faceGearTeeth,
    innerRadius: faceGearInnerRadius,
    outerRadius: faceGearOuterRadius,
    baseFace: faceGearBaseFace,
    tipFace: faceGearTipFace,
  }, {radialSteps: 10, angularSteps: 48, rotationSteps: 480});
  const faceGearMaterial = matte(PALETTE.driver, {metalness: 0.24, roughness: 0.48});
  const faceGearTeethMeshes = Array.from({length: faceGearTeeth}, (_, index) => {
    const tooth = addRole(new THREE.Mesh(faceToothGeometry, faceGearMaterial),
      'pinion-generated-face-gear-tooth');
    tooth.rotation.z = index * FULL_TURN / faceGearTeeth;
    tooth.userData.faceTooth = true;
    tooth.userData.index = index;
    faceGear.add(tooth);
    return tooth;
  });
  // The ring of teeth stands on a disk bored for the stub axle.
  const faceGearDisk = addRole(new THREE.Mesh(
    ring(0.07, faceGearDiskRadius, faceGearBaseFace, faceGearBaseFace + faceGearDiskThickness, 192),
    faceGearMaterial,
  ), 'face-gear-disk-on-wheel-front');
  faceGear.add(faceGearDisk);
  faceGear.userData = {
    ...faceGear.userData, rotor: faceGear, toothMeshes: faceGearTeethMeshes, body: faceGearDisk,
    teeth: faceGearTeeth, innerRadius: faceGearInnerRadius, outerRadius: faceGearOuterRadius,
  };
  facePinion.userData = {
    ...facePinion.userData, rotor: facePinion, body: facePinionBody, toothMeshes: [facePinionBody],
    teeth: facePinionTeeth, pitchRadius: facePinionPitchRadius,
  };
  // S runs from behind its head bevel to its end over the wheel's axis.
  const transferShaftStart = 0.234;
  const transferShaft = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, transferShaftLength - transferShaftStart, 48),
    screwShaftMaterial,
  ), 'inclined-transfer-shaft-S');
  transferShaft.rotation.x = Math.PI / 2;
  transferShaft.position.z = (transferShaftLength + transferShaftStart) / 2;
  transferShaftRotor.add(transferShaft);

  const receiver = addRole(new THREE.Mesh(
    new THREE.BufferGeometry(),
    matte(PALETTE.driven, {
      metalness: 0.18,
      roughness: 0.52,
    }),
  ), 'submerged-air-receiver-at-lower-screw-end');
  root.add(receiver);

  const wheelMaterial = matte(PALETTE.driver, {
    metalness: 0.24,
    roughness: 0.48,
  });
  const wheelRims = [wheelPlaneZ - 0.20, wheelPlaneZ + 0.20].map((z, index) => {
    const rim = addRole(new THREE.Mesh(
      new THREE.TorusGeometry(waterWheelRadius, 0.064, 10, 72),
      wheelMaterial,
    ), `water-wheel-rim-${index + 1}`);
    rim.position.z = z;
    waterWheelRotor.add(rim);
    return rim;
  });
  const wheelBlades = [];
  for (let index = 0; index < waterWheelBladeCount; index += 1) {
    const angle = index * FULL_TURN / waterWheelBladeCount;
    const blade = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.12, 0.36),
      wheelMaterial,
    ), `water-wheel-bubble-blade-${index + 1}`);
    blade.position.set(
      Math.cos(angle) * waterWheelRadius * 0.76,
      Math.sin(angle) * waterWheelRadius * 0.76,
      wheelPlaneZ,
    );
    blade.rotation.z = angle;
    waterWheelRotor.add(blade);
    wheelBlades.push(blade);
  }
  const wheelHub = cylinderAlongZ(0.16, 0.48, screwShaftMaterial, 30);
  wheelHub.position.z = wheelPlaneZ;
  waterWheelRotor.add(wheelHub);
  // The wheel turns on a stub axle carried by the warm cistern's back wall.
  // Its back end stops 0.04 inside the 0.14 wall, so the end cap is buried
  // (an end flush with the wall's outer face z-fights with it).
  const axleBack = -tankDepth / 2 + 0.04, axleFront = -0.10;
  const fixedWheelAxle = addRole(cylinderAlongZ(
    0.055,
    axleFront - axleBack,
    screwShaftMaterial,
    24,
  ), 'fixed-water-wheel-horizontal-axle');
  fixedWheelAxle.position.z = (axleFront + axleBack) / 2;
  waterWheelAssembly.add(fixedWheelAxle);

  // Air vessel round the screw's foot, standing on the cold cistern floor.
  const bottleFloorY = tankBottomY + 0.07;
  const bottleShoulderY = -0.10, bottleNeckY = 0.22, bottleRoofY = 0.32, bottleNeckHalf = 0.26;
  const bottleX0 = -3.62, bottleX1 = -2.62, bottleHalfDepth = 0.45, airDuctRadius = 0.19;
  const bottlePipeX = (bottleX0 + bottleX1) / 2;
  const casingRadius = screwRadius + 0.055;
  const casingAtWallY = screwLowerPoint.y + (bottleX1 - screwLowerPoint.x) * screwAxis.y / screwAxis.x;
  receiver.geometry = airBottleGeometry({
    x0: bottleX0, x1: bottleX1, z: bottleHalfDepth, floorY: bottleFloorY, shoulderY: bottleShoulderY, neckY: bottleNeckY,
    roofY: bottleRoofY, neckHalf: bottleNeckHalf, wall: 0.05,
    casingHole: {y: casingAtWallY, z: casingRadius + 0.003, halfHeight: casingRadius / screwAxis.x + 0.035},
    pipeBore: airDuctRadius - 0.006, pipeX: bottlePipeX,
  });

  // Brown's duct is broad: about a fifth of the bottle's width.
  // Pass 74: it descends close beside the wheel, turns in under it and ends
  // in a broad hood whose lips are arcs concentric with the wheel, 0.02 clear
  // of its rims (Brown's stepped chamber under the wheel), so the air has no
  // way out but up into the paddles.
  const pipeTopY = 2.20, pipeRightX = 2.50, pipeBottomY = -1.52;
  const hoodSpec = {
    cx: wheelCenter.x, cy: wheelCenter.y, xL: wheelCenter.x - 0.30, xR: wheelCenter.x + 0.40,
    yBottom: -1.80, arcRadius: waterWheelRadius + 0.064 + 0.02, zC: wheelPlaneZ, halfWidth: 0.32,
    wall: 0.035, pipeY: pipeBottomY, pipeBore: airDuctRadius - 0.035,
  };
  const outletPoint = new THREE.Vector3(hoodSpec.xR, pipeBottomY, wheelPlaneZ);
  const pipePoints = [
    new THREE.Vector3(bottlePipeX, bottleRoofY, 0),
    new THREE.Vector3(bottlePipeX, pipeTopY, 0),
    new THREE.Vector3(pipeRightX, pipeTopY, 0),
    new THREE.Vector3(pipeRightX, pipeBottomY, 0),
    new THREE.Vector3(pipeRightX, pipeBottomY, wheelPlaneZ),
    outletPoint.clone(),
  ];
  const pressurePipeCurve = filletedPipePath(pipePoints, [0.40, 0.40, 0.28, 0.28]);
  const wheelHood = addRole(new THREE.Mesh(wheelHoodGeometry(hoodSpec)),
    'air-pipe-mouth-hood-fitted-under-wheel');
  root.add(wheelHood);
  // The air leaves the pipe inside the hood and rises on the wheel's right.
  const bubbleRiseX = wheelCenter.x + 0.24;
  const bubbleRiseCurve = new THREE.CurvePath();
  bubbleRiseCurve.add(new THREE.QuadraticBezierCurve3(outletPoint.clone(),
    new THREE.Vector3(bubbleRiseX, pipeBottomY, wheelPlaneZ),
    new THREE.Vector3(bubbleRiseX, pipeBottomY + 0.16, wheelPlaneZ)));
  bubbleRiseCurve.add(new THREE.LineCurve3(
    new THREE.Vector3(bubbleRiseX, pipeBottomY + 0.16, wheelPlaneZ),
    new THREE.Vector3(bubbleRiseX, waterTopY - 0.04, wheelPlaneZ)));
  const airPath = new THREE.CurvePath();
  airPath.add(pressurePipeCurve);
  airPath.add(bubbleRiseCurve);
  const pressurePipeLength = pressurePipeCurve.getLength();
  const bubbleRiseLength = bubbleRiseCurve.getLength();
  const airPathLength = pressurePipeLength + bubbleRiseLength;
  const warmBathEntryDistance = pressurePipeLength;

  const conduitMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.45,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
  });
  conduitMaterial.depthWrite = false;
  const airConduit = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(pressurePipeCurve, 260, airDuctRadius, 24, false),
    conduitMaterial,
  ), 'air-pipe-ascending-crossing-descending-to-wheel-underside');
  root.add(airConduit);
  wheelHood.material = conduitMaterial;
  const airBubbleMaterial = new THREE.MeshBasicMaterial({
    color: 0xbfefff,
    depthWrite: false,
    transparent: true,
    opacity: 0.96,
  });
  const airBubbles = Array.from({ length: bubbleCount }, (_, index) => {
    const bubble = addRole(new THREE.Mesh(
      new THREE.SphereGeometry(bubbleBaseRadius, 20, 14),
      airBubbleMaterial,
    ), `smooth-air-bubble-${index + 1}`);
    bubble.renderOrder = 4;
    root.add(bubble);
    return bubble;
  });

  const thermometerMaterial = matte(PALETTE.white, {
    transparent: true,
    opacity: 0.38,
    roughness: 0.18,
    side: THREE.DoubleSide,
  });
  thermometerMaterial.depthWrite = false;
  const thermometerColumns = [];
  const thermometerGroups = [
    { color: 0x3d88ad, x: -3.45, role: 'cold' },
    { color: 0xd55f3f, x: 3.02, role: 'warm' },
  ].map(({ color, x, role }) => {
    const group = addRole(new THREE.Group(), `${role}-bath-thermometer`);
    group.position.set(x, 0.87, 0.70);
    root.add(group);
    const casing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.92, 18, 1, true),
      thermometerMaterial,
    );
    group.add(casing);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 20, 14),
      matte(color, { roughness: 0.34 }),
    );
    bulb.position.y = -0.48;
    group.add(bulb);
    const column = addRole(new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1, 14),
      matte(color, { roughness: 0.34 }),
    ), `${role}-temperature-column`);
    group.add(column);
    thermometerColumns.push(column);
    return group;
  });

  const stateAtPhase = (unwrappedPhase) => {
    const rawPhase = positiveModulo(unwrappedPhase, 1);
    const phase = [0, operationEndPhase, thermalResetStartPhase]
      .find((boundary) => Math.abs(rawPhase - boundary) < 1e-12)
      ?? rawPhase;
    let rotationProgress = 1;
    let rotationProgressRate = 0;
    let rotationProgressAcceleration = 0;
    let temperatureContrast = 0;
    let temperatureContrastRate = 0;
    let regime;

    if (phase < operationEndPhase) {
      const local = phase / operationEndPhase;
      const intervalTime = operationEndPhase * cycleDuration;
      rotationProgress = smootherStep(local);
      rotationProgressRate = smootherStepDerivative(local) / intervalTime;
      rotationProgressAcceleration = smootherStepSecondDerivative(local)
        / intervalTime ** 2;
      temperatureContrast = 1 - rotationProgress;
      temperatureContrastRate = -rotationProgressRate;
      regime = local < 0.32
        ? 'external-start-turns-screw-opposite-water-raising-direction'
        : 'proposed-expanded-air-drive-runs-down-as-baths-equilibrate';
    } else if (phase < thermalResetStartPhase) {
      temperatureContrast = 0;
      regime = 'equal-temperature-baths-and-geared-machine-stopped';
    } else {
      const local = (phase - thermalResetStartPhase)
        / (1 - thermalResetStartPhase);
      const intervalTime = (1 - thermalResetStartPhase) * cycleDuration;
      temperatureContrast = smootherStep(local);
      temperatureContrastRate = smootherStepDerivative(local) / intervalTime;
      regime = 'explicit-external-heat-reset-restores-temperature-gradient';
    }

    const coldTemperatureKelvin = equilibriumTemperatureKelvin
      - initialTemperatureDifferenceKelvin * temperatureContrast / 2;
    const warmTemperatureKelvin = equilibriumTemperatureKelvin
      + initialTemperatureDifferenceKelvin * temperatureContrast / 2;
    const temperatureDifferenceKelvin = warmTemperatureKelvin
      - coldTemperatureKelvin;
    const screwAngle = operatingScrewRotationSign * totalScrewTurns
      * FULL_TURN * rotationProgress;
    const screwAngularVelocity = operatingScrewRotationSign
      * totalScrewTurns * FULL_TURN * rotationProgressRate;
    const screwAngularAcceleration = operatingScrewRotationSign
      * totalScrewTurns * FULL_TURN * rotationProgressAcceleration;
    // Head mitre pair: the input bevel turns by -screwAngle about its axis
    // (down the screw), so shaft S turns by +screwAngle about +S. Hub mitre
    // pair: S's lower bevel turns by -angle about -S, so the wheel bevel
    // turns by +angle about -z, i.e. the wheel by -angle about +z.
    const bevelOutputAngle = screwAngle
      * screwBevelPitchRadius / outputBevelPitchRadius;
    const bevelOutputAngularVelocity = screwAngularVelocity
      * screwBevelPitchRadius / outputBevelPitchRadius;
    const bevelOutputAngularAcceleration = screwAngularAcceleration
      * screwBevelPitchRadius / outputBevelPitchRadius;
    // Face pair: S turns the pinion by -angle about its axis (-S); the face
    // gear turns by ratio*angle about -z, i.e. the wheel by -ratio*angle.
    const waterWheelAngle = wheelMeshPhase - faceGearRatio * bevelOutputAngle;
    const waterWheelAngularVelocity = -faceGearRatio * bevelOutputAngularVelocity;
    const waterWheelAngularAcceleration = -faceGearRatio * bevelOutputAngularAcceleration;
    const airAxialDisplacement = screwPitch * screwAngle / FULL_TURN;
    const airAxialVelocity = screwPitch * screwAngularVelocity / FULL_TURN;
    const airTransportDistance = -airAxialDisplacement;
    const airPathSpeed = -airAxialVelocity;
    const warmToColdAbsoluteTemperatureRatio = warmTemperatureKelvin
      / coldTemperatureKelvin;
    const warmedAirVolumeCubicMeter = referenceAirVolumeCubicMeter
      * warmToColdAbsoluteTemperatureRatio;
    const expansionBoundaryWorkJoule = ambientPressurePascal
      * (warmedAirVolumeCubicMeter - referenceAirVolumeCubicMeter);
    return {
      airAxialDisplacement,
      airAxialVelocity,
      airPathSpeed,
      airTransportDistance,
      bevelOutputAngle,
      bevelOutputAngularAcceleration,
      bevelOutputAngularVelocity,
      coldTemperatureKelvin,
      expansionBoundaryWorkJoule,
      phase,
      regime,
      rotationProgress,
      rotationProgressAcceleration,
      rotationProgressRate,
      screwAngle,
      screwAngularAcceleration,
      screwAngularVelocity,
      temperatureContrast,
      temperatureContrastRate,
      temperatureDifferenceKelvin,
      warmedAirVolumeCubicMeter,
      warmTemperatureKelvin,
      warmToColdAbsoluteTemperatureRatio,
      waterWheelAngle,
      waterWheelAngularAcceleration,
      waterWheelAngularVelocity,
    };
  };

  const stateAtTime = (time) => stateAtPhase(time / cycleDuration);

  const bubbleStateAt = (index, state) => {
    const spacing = airPathLength / bubbleCount;
    const pathDistance = positiveModulo(
      state.airTransportDistance + index * spacing,
      airPathLength,
    );
    const pathFraction = pathDistance / airPathLength;
    const position = airPath.getPointAt(pathFraction);
    const warmProgress = pathDistance <= warmBathEntryDistance
      ? 0
      : smootherStep((pathDistance - warmBathEntryDistance)
        / bubbleRiseLength);
    const localAirTemperatureKelvin = THREE.MathUtils.lerp(
      state.coldTemperatureKelvin,
      state.warmTemperatureKelvin,
      warmProgress,
    );
    const volumeRatio = localAirTemperatureKelvin
      / state.coldTemperatureKelvin;
    const radiusScale = Math.cbrt(volumeRatio);
    const endFadeDistance = airPathLength * 0.045;
    // Bubbles swell in and out with the screw's speed instead of switching
    // on at a threshold (pass 69: no pop when the start begins or ends).
    const speedFade = smootherStep(Math.abs(state.screwAngularVelocity) / 0.6);
    const fade = speedFade * smootherStep(Math.min(
      pathDistance / endFadeDistance,
      (airPathLength - pathDistance) / endFadeDistance,
      1,
    ));
    return {
      fade,
      localAirTemperatureKelvin,
      pathDistance,
      pathFraction,
      position,
      radiusScale,
      // Air inside the opaque pressure pipe is not seen; only the bubbles
      // rising free through the warm bath are.
      visible: fade > 1e-4
        && pathDistance > warmBathEntryDistance,
      volumeRatio,
      warmProgress,
    };
  };

  const updateThermometer = (column, temperatureKelvin) => {
    const minimumKelvin = 288;
    const maximumKelvin = 318;
    const height = THREE.MathUtils.lerp(
      0.20,
      0.75,
      THREE.MathUtils.clamp(
        (temperatureKelvin - minimumKelvin)
          / (maximumKelvin - minimumKelvin),
        0,
        1,
      ),
    );
    column.scale.y = height;
    column.position.y = -0.45 + height / 2;
  };

  const update = (time) => {
    const state = stateAtTime(time);
    screwRotor.rotation.y = state.screwAngle;
    transferShaftRotor.rotation.z = state.bevelOutputAngle;
    waterWheelRotor.rotation.z = state.waterWheelAngle;
    airBubbles.forEach((bubble, index) => {
      const bubbleState = bubbleStateAt(index, state);
      bubble.position.copy(bubbleState.position);
      const scale = bubbleState.radiusScale * bubbleState.fade;
      bubble.scale.setScalar(scale);
      bubble.visible = bubbleState.visible;
    });
    // Colour is not a signal: both cisterns hold plain water of one colour.
    coldWaterMaterial.color.copy(coldInitialColor);
    warmWaterMaterial.color.copy(coldInitialColor);
    updateThermometer(
      thermometerColumns[0],
      state.coldTemperatureKelvin,
    );
    updateThermometer(
      thermometerColumns[1],
      state.warmTemperatureKelvin,
    );
  };

  const sourceState = stateAtPhase(0.24);
  const geometry = {
    airDuctRadius,
    airPathLength,
    bevelApexExtension,
    bevelApex: transferCenter.clone(),
    bevelLayout,
    ambientPressurePascal,
    bubbleBaseRadius,
    bubbleCount,
    bubbleRiseLength,
    coldTankCenterX,
    coldTankWidth,
    cycleDuration,
    equilibriumTemperatureKelvin,
    gearCenterDirection: gearCenterDirection.clone(),
    initialColdTemperatureKelvin,
    initialTemperatureDifferenceKelvin,
    initialWarmTemperatureKelvin,
    operationEndPhase,
    operatingScrewRotationSign,
    outputBevelPitchRadius,
    faceGearBaseFace,
    faceGearDiskRadius,
    faceGearDiskThickness,
    faceGearInnerRadius,
    faceGearModule,
    faceGearOuterRadius,
    faceGearPitchRadius,
    faceGearRatio,
    faceGearTeeth,
    faceGearTipFace,
    facePinionCenterRadius,
    facePinionPitchRadius,
    facePinionTeeth,
    pressurePipeLength,
    referenceAirVolumeCubicMeter,
    screwAxis: screwAxis.clone(),
    screwBevelPitchRadius,
    screwFlightTurns,
    screwLength,
    screwLowerPoint: screwLowerPoint.clone(),
    screwPitch,
    screwRadius,
    screwUpperPoint: screwUpperPoint.clone(),
    tankBottomY,
    tankDepth,
    tankTopY,
    thermalResetStartPhase,
    totalScrewTurns,
    transferCenter: transferCenter.clone(),
    transferShaftDirection: transferShaftDirection.clone(),
    transferShaftLength,
    warmBathEntryDistance,
    warmTankCenterX,
    warmTankWidth,
    waterRaisingRotationSign,
    waterTopY,
    waterWheelBladeCount,
    waterWheelRadius,
    wheelCenter: wheelCenter.clone(),
    wheelMeshPhase,
    wheelPlaneZ,
    screwInclination,
  };

  root.userData = {
    airPath,
    archetype:
      'thermal-air-circulation-proposal-with-reversed-archimedean-screw-bubble-wheel-exact-gearing-and-unmaintained-temperature-gradient',
    blocks: {
      airBubbles,
      airConduit,
      coldTank: coldTankParts.tank,
      coldWater: coldTankParts.water,
      fixedWheelAxle,
      inputBevel,
      outputBevel,
      receiver,
      faceGear,
      facePinion,
      wheelHood,
      screwBarrel,
      screwFlight,
      screwMount,
      screwRotor,
      screwShaft,
      thermometerColumns,
      thermometerGroups,
      transferShaft,
      transferShaftRotor,
      warmTank: warmTankParts.tank,
      warmWater: warmTankParts.water,
      waterWheelAssembly,
      waterWheelRotor,
      wheelBlades,
      wheelHub,
      wheelRims,
    },
    bubbleRiseCurve,
    bubbleStateAt,
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      screwAndWheelIndependent: false,
      thermalGradientIsMechanicalDegreeOfFreedom: false,
      transferShaftAndWheelIndependent: false,
      wheelOperatingDegreesOfFreedom: 1,
    },
    dynamics: {
      airCompressibilityHydrostaticHeadBubbleSlipBladeDragGearFrictionHeatTransferRatesAndTankMixingSolved:
        false,
      airVolumeModel:
        'Displayed bubble volume follows V_warm/V_cold=T_warm/T_cold at common pressure; marker radius therefore follows the exact cube root of absolute-temperature ratio.',
      transientModel:
        'A prescribed C2 start turns the screw in the direction opposite water raising. The proposed coupled train then runs down while the finite bath temperature difference is driven to zero. No positive speed remains after equilibration.',
    },
    energyAudit: {
      brownIdentifiesMissingTemperatureMaintenance: true,
      externalHeatRequiredToRestoreGradient: true,
      lossesWouldReduceAvailableOutput: true,
      selfSustainingClaimAccepted: false,
      thermalResetIsPartOfHistoricalMachine: false,
    },
    fidelity: 'authored',
    geometry,
    mechanism:
      'The inclined right-handed Archimedean screw is first turned opposite its water-raising direction, carrying air downward into the air vessel standing round its foot. Pressurized air rises through the rigid external tube from the vessel’s roof, crosses above the cisterns, descends beside the warm-bath wheel into a hood fitted closely under it, and bubbles upward on the wheel’s right side. A mitre pair at the screw’s head drives an inclined shaft over the warm cistern’s wall, and a pinion on that shaft turns the face gear on the wheel’s front, so the wheel makes one turn to the screw’s four. The displayed temperature difference is finite and must be restored by an external heat source.',
    motion: {
      cycleDuration,
      motionType:
        'six-turn-c2-reversed-screw-start-geared-bubble-wheel-run-down-equilibrium-hold-and-explicit-external-thermal-reset',
    },
    pressurePipeCurve,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      officialPageMarksAnimationUnavailable: true,
      sourcePrescribedAbsoluteTiming: false,
      sourcePrescribedNormalizedTiming: false,
    },
    sourcePose: {
      bubblePathPositions: Array.from({ length: bubbleCount }, (_, index) =>
        bubbleStateAt(index, sourceState).position.clone()),
      screwAngle: sourceState.screwAngle,
      waterWheelAngle: sourceState.waterWheelAngle,
    },
    sourceReference: {
      brownPlate469: {
        approximateAirPipeBoundsPixels: [82, 157, 357, 289],
        approximateApparatusBoundsPixels: [54, 154, 407, 307],
        approximateInclinedScrewBoundsPixels: [102, 245, 194, 174],
        approximateWaterWheelBoundsPixels: [286, 246, 123, 126],
        imageHeight: 525,
        imageWidth: 525,
        measurementUncertaintyPixels: 15,
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the left cistern contains water at natural temperature',
          'the right cistern contains water at a higher temperature',
          'a water-wheel in the right cistern is geared to an Archimedean screw in the left',
          'the screw is started opposite its water-raising direction to force air downward',
          'air rises through a tube, crosses, descends, and reaches the underside of the wheel',
          'the claimed continuation relies on air-volume increase with temperature',
          'Brown states that the means of maintaining the temperature difference is not given',
        ],
        engravingEvidence:
          'Brown shows two open cisterns, an inclined enclosed screw at left, intersecting geared members above, a bladed wheel in the right bath, and one high external air conduit descending beneath that wheel.',
        reconstructionDisclosure:
          'Brown gives no screw hand, pitch, gear tooth counts, bath temperatures, air quantity, pressure, conduit section, heat-transfer law, torque, loss data or timing. A right-handed six-flight screw, a pair of 24-tooth shared-apex mitre bevels with Tredgold profiles and a 12-tooth involute pinion driving a pinion-generated 48-tooth face gear on an inclined shaft, 293.15/313.15 K initial baths, ideal-gas marker expansion, finite-gradient run-down, colors and a 13.8-second loop are independently engineered. The last loop branch explicitly adds external heat and is not attributed to the historical proposal.',
      },
      officialPage: movement.sourceUrl,
      plate: 'Brown 1868, Movement 469',
    },
    stateAtPhase,
    stateAtTime,
    transmission: {
      airTransport:
        'axial air displacement=pitch*screw angle/(2*pi); negative operating screw angle carries air toward the submerged lower receiver',
      bevelMesh:
        'head mitre: shaft S omega about +S = screw omega; face gear: wheel omega about +z = -(12/48) shaft S omega',
      bubbleTorque:
        'air exits into the hood under the warm-bath wheel and rises on its right side; upward buoyancy there has the same positive-z torque sign as the constrained wheel rotation',
    },
    update,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.86, groundY - 0.02, -1.20),
    new THREE.Vector3(3.30, 2.42, 1.20),
  );
  root.userData.cameraDistanceScale = 1.00;
  root.userData.cameraDirection = new THREE.Vector3(6.8, 4.4, 11.8);
  root.userData.groundFloorY = groundY;

  correctTemperatureAirMachine(root);
  markShadows(root);
  for (const object of [coldTankParts.water, warmTankParts.water,
    screwBarrel, airConduit, ...airBubbles]) {
    object.castShadow = false;
  }
  update(0);
  return {
    cameraDirection: root.userData.cameraDirection,
    root,
    update,
  };
}

export function createAuthoredTemperatureAirMachineMovement(movement) {
  if (movement.id !== 469) return null;
  return applyCutawayFor(temperatureAirMachine(movement), movement.id);
}
