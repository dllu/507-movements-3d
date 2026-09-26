import {correctScriberDynamometer} from './scriber-dynamometer-gears.js';
import * as THREE from 'three';
import { makeSeeThrough } from './see-through-part.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  PALETTE,
  makeGear,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function quintic(progress) {
  const u = THREE.MathUtils.clamp(progress, 0, 1);
  return u * u * u * (10 + u * (-15 + 6 * u));
}

function quinticDerivative(progress) {
  const u = THREE.MathUtils.clamp(progress, 0, 1);
  return 30 * u * u * (1 - u) * (1 - u);
}

function cylinderAlongX(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function torusNormalToY(majorRadius, tubeRadius, material, segments = 64) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(majorRadius, tubeRadius, 10, segments),
    material,
  );
  torus.rotation.x = Math.PI / 2;
  return torus;
}

function makePitchConeGear({
  axis,
  boreRadius,
  color,
  indexTooth,
  innerDistance,
  outerDistance,
  pitchConeAngle,
  teeth,
  toothHeight,
}) {
  const root = new THREE.Group();
  const rotor = new THREE.Group();
  root.add(rotor);
  root.quaternion.setFromUnitVectors(Z_AXIS, axis.clone().normalize());
  root.userData.axis = axis.clone().normalize();
  root.userData.rotor = rotor;

  const pitchRadiusAt = (distance) => distance * Math.tan(pitchConeAngle);
  const toothHeightAt = (distance) => toothHeight
    * distance / outerDistance;
  const innerRootRadius = pitchRadiusAt(innerDistance)
    - toothHeightAt(innerDistance) * 0.44;
  const outerRootRadius = pitchRadiusAt(outerDistance)
    - toothHeight * 0.44;
  const bodyGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(boreRadius, innerDistance),
    new THREE.Vector2(innerRootRadius, innerDistance),
    new THREE.Vector2(outerRootRadius, outerDistance),
    new THREE.Vector2(boreRadius, outerDistance),
  ], 72);
  bodyGeometry.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(
    bodyGeometry,
    matte(color, { metalness: 0.15, roughness: 0.58 }),
  );
  body.userData.role = 'pitch-cone-bevel-gear-body';
  rotor.add(body);

  const toothMaterial = matte(color, {
    metalness: 0.17,
    roughness: 0.53,
    side: THREE.DoubleSide,
  });
  const indexMaterial = matte(PALETTE.white, {
    roughness: 0.42,
    side: THREE.DoubleSide,
  });
  const halfToothAngle = Math.PI / teeth * 0.54;
  const toothMeshes = [];
  const vertex = (distance, radialOffset, angle) => {
    const radius = pitchRadiusAt(distance) + radialOffset;
    return [
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      distance,
    ];
  };
  for (let index = 0; index < teeth; index += 1) {
    const angle = index / teeth * FULL_TURN;
    const innerHeight = toothHeightAt(innerDistance);
    const vertices = [
      ...vertex(innerDistance, -innerHeight * 0.44,
        angle - halfToothAngle),
      ...vertex(innerDistance, -innerHeight * 0.44,
        angle + halfToothAngle),
      ...vertex(innerDistance, innerHeight * 0.56,
        angle + halfToothAngle),
      ...vertex(innerDistance, innerHeight * 0.56,
        angle - halfToothAngle),
      ...vertex(outerDistance, -toothHeight * 0.44,
        angle - halfToothAngle),
      ...vertex(outerDistance, -toothHeight * 0.44,
        angle + halfToothAngle),
      ...vertex(outerDistance, toothHeight * 0.56,
        angle + halfToothAngle),
      ...vertex(outerDistance, toothHeight * 0.56,
        angle - halfToothAngle),
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setIndex([
      0, 3, 2, 0, 2, 1,
      4, 5, 6, 4, 6, 7,
      0, 1, 5, 0, 5, 4,
      3, 7, 6, 3, 6, 2,
      0, 4, 7, 0, 7, 3,
      1, 2, 6, 1, 6, 5,
    ]);
    geometry.computeVertexNormals();
    const tooth = new THREE.Mesh(
      geometry,
      toothMaterial,
    );
    tooth.userData.bevelTooth = true;
    tooth.userData.index = index;
    tooth.userData.role = 'closed-pitch-cone-bevel-tooth';
    rotor.add(tooth);
    toothMeshes.push(tooth);
  }

  const faceRing = new THREE.Mesh(
    new THREE.TorusGeometry(
      pitchRadiusAt(outerDistance) * 0.62,
      0.027,
      8,
      56,
    ),
    matte(PALETTE.ink, { metalness: 0.18, roughness: 0.50 }),
  );
  faceRing.position.z = outerDistance + 0.018;
  faceRing.userData.role = 'bevel-gear-angle-index-ring';
  rotor.add(faceRing);
  const faceIndex = new THREE.Mesh(
    new THREE.BoxGeometry(
      pitchRadiusAt(outerDistance) * 0.50,
      0.044,
      0.025,
    ),
    indexMaterial,
  );
  faceIndex.position.set(
    pitchRadiusAt(outerDistance) * 0.43,
    0,
    outerDistance + 0.034,
  );
  faceIndex.userData.role = 'white-index-showing-bevel-gear-angle';
  rotor.add(faceIndex);

  root.userData.body = body;
  root.userData.boreRadius = boreRadius;
  root.userData.faceIndex = faceIndex;
  root.userData.faceRing = faceRing;
  root.userData.innerDistance = innerDistance;
  root.userData.outerDistance = outerDistance;
  root.userData.outerPitchRadius = pitchRadiusAt(outerDistance);
  root.userData.pitchConeAngle = pitchConeAngle;
  root.userData.teeth = teeth;
  root.userData.toothHeight = toothHeight;
  root.userData.toothMeshes = toothMeshes;
  return markShadows(root);
}

function makeVerticalRack({
  bodyDepth,
  bodyWidth,
  length,
  localBottom,
  pitch,
  pitchPlaneZ,
  positionX,
  toothHeight,
}) {
  const group = new THREE.Group();
  const rackMaterial = matte(PALETTE.driven, {
    metalness: 0.13,
    roughness: 0.59,
  });
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth, length, bodyDepth),
    rackMaterial,
  );
  body.position.set(
    positionX,
    localBottom + length / 2,
    pitchPlaneZ - toothHeight - bodyDepth / 2,
  );
  body.userData.role = 'vertically-sliding-rack-backbone';
  group.add(body);

  const toothCount = Math.floor(length / pitch) + 1;
  const teeth = [];
  for (let index = 0; index < toothCount; index += 1) {
    const tooth = new THREE.Mesh(
      new THREE.BoxGeometry(
        bodyWidth * 1.05,
        pitch * 0.52,
        toothHeight,
      ),
      // Uniform teeth: Brown marks no index tooth.
      rackMaterial,
    );
    tooth.position.set(
      positionX,
      localBottom + index * pitch,
      pitchPlaneZ - toothHeight / 2,
    );
    tooth.rotation.x = THREE.MathUtils.degToRad(-12);
    tooth.userData.index = index;
    tooth.userData.role = 'rack-tooth-at-spur-circular-pitch';
    group.add(tooth);
    teeth.push(tooth);
  }
  group.userData.body = body;
  group.userData.length = length;
  group.userData.localBottom = localBottom;
  group.userData.pitch = pitch;
  group.userData.pitchPlaneZ = pitchPlaneZ;
  group.userData.teeth = teeth;
  group.userData.toothCount = toothCount;
  return markShadows(group);
}

class CylinderHelixCurve extends THREE.Curve {
  constructor({
    angularTravel,
    bottomY,
    initialMaterialAngle,
    radius,
    stroke,
  }) {
    super();
    this.angularTravel = angularTravel;
    this.bottomY = bottomY;
    this.initialMaterialAngle = initialMaterialAngle;
    this.radius = radius;
    this.stroke = stroke;
  }

  getPoint(progress, target = new THREE.Vector3()) {
    const angle = this.initialMaterialAngle
      + this.angularTravel * progress;
    return target.set(
      this.radius * Math.cos(angle),
      this.bottomY + this.stroke * progress,
      this.radius * Math.sin(angle),
    );
  }
}

function spiralCylinderScriber(movement) {
  const root = new THREE.Group();

  const demonstrationPeriod = 8;
  const schedule = {
    bottomDwellEnd: 0.08,
    forwardEnd: 0.46,
    topDwellEnd: 0.54,
    returnEnd: 0.92,
  };
  const driverTeeth = 18;
  const drivenTeeth = 30;
  const bevelRatio = driverTeeth / drivenTeeth;
  const spurTeeth = 16;
  const spurPitchRadius = 0.48;
  const spurModule = spurPitchRadius * 2 / spurTeeth;
  const rackPitch = Math.PI * spurModule;
  const cylinderRadius = 0.90;
  const cylinderHeight = 2.92;
  const drawableMargin = 0.19;
  const scribingBottomY = -cylinderHeight / 2 + drawableMargin;
  const scribingTopY = cylinderHeight / 2 - drawableMargin;
  const rackStroke = scribingTopY - scribingBottomY;
  const inputAngularTravel = rackStroke / spurPitchRadius;
  const cylinderAngularTravel = bevelRatio * inputAngularTravel;
  const helixTurns = cylinderAngularTravel / FULL_TURN;
  const helixAxialPitch = rackStroke / helixTurns;
  const inputStartAngle = THREE.MathUtils.degToRad(18);
  const cylinderStartAngle = THREE.MathUtils.degToRad(32);
  const drivenBevelStartAngle = -cylinderStartAngle;
  const apex = new THREE.Vector3(-1.10, 3.00, 0);
  const spurCenter = new THREE.Vector3(0.58, apex.y, apex.z);
  const cylinderCenter = new THREE.Vector3(-1.10, 0, 0);
  const stylusContactX = cylinderCenter.x + cylinderRadius;
  const driverPitchConeAngle = Math.atan2(driverTeeth, drivenTeeth);
  const drivenPitchConeAngle = Math.atan2(drivenTeeth, driverTeeth);
  const outerConeDistance = 0.92;
  const driverOuterDistance = outerConeDistance
    * Math.cos(driverPitchConeAngle);
  const drivenOuterDistance = outerConeDistance
    * Math.cos(drivenPitchConeAngle);
  const driverInnerDistance = driverOuterDistance * 0.30;
  const drivenInnerDistance = drivenOuterDistance * 0.30;
  const driverOuterPitchRadius = driverOuterDistance
    * Math.tan(driverPitchConeAngle);
  const drivenOuterPitchRadius = drivenOuterDistance
    * Math.tan(drivenPitchConeAngle);
  const bevelContactDirection = X_AXIS.clone()
    .multiplyScalar(Math.cos(driverPitchConeAngle))
    .addScaledVector(Y_AXIS, -Math.sin(driverPitchConeAngle));
  const bevelContactPoint = apex.clone().addScaledVector(
    bevelContactDirection,
    outerConeDistance,
  );
  const spurRackContactPoint = new THREE.Vector3(
    spurCenter.x,
    spurCenter.y,
    spurCenter.z - spurPitchRadius,
  );

  const motionAtTime = (time) => {
    const wrappedTime = positiveModulo(time, demonstrationPeriod);
    const rawCyclePhase = wrappedTime / demonstrationPeriod;
    let cyclePhase = rawCyclePhase;
    for (const boundary of [
      0,
      schedule.bottomDwellEnd,
      schedule.forwardEnd,
      schedule.topDwellEnd,
      schedule.returnEnd,
      1,
    ]) {
      if (Math.abs(rawCyclePhase - boundary) < 1e-12) {
        cyclePhase = boundary === 1 ? 0 : boundary;
        break;
      }
    }
    if (cyclePhase < schedule.bottomDwellEnd) {
      return {
        cyclePhase,
        progress: 0,
        progressRate: 0,
        stage: 'lower-end-dwell-before-forward-scribing-pass',
      };
    }
    if (cyclePhase < schedule.forwardEnd) {
      const duration = schedule.forwardEnd - schedule.bottomDwellEnd;
      const u = (cyclePhase - schedule.bottomDwellEnd) / duration;
      return {
        cyclePhase,
        progress: THREE.MathUtils.clamp(quintic(u), 0, 1),
        progressRate: quinticDerivative(u)
          / (duration * demonstrationPeriod),
        stage: 'forward-cranking-and-scribing-bottom-to-top',
      };
    }
    if (cyclePhase < schedule.topDwellEnd) {
      return {
        cyclePhase,
        progress: 1,
        progressRate: 0,
        stage: 'upper-end-dwell-before-manual-reversal',
      };
    }
    if (cyclePhase < schedule.returnEnd) {
      const duration = schedule.returnEnd - schedule.topDwellEnd;
      const u = (cyclePhase - schedule.topDwellEnd) / duration;
      return {
        cyclePhase,
        progress: THREE.MathUtils.clamp(1 - quintic(u), 0, 1),
        progressRate: -quinticDerivative(u)
          / (duration * demonstrationPeriod),
        stage: 'reverse-cranking-and-retracing-top-to-bottom',
      };
    }
    return {
      cyclePhase,
      progress: 0,
      progressRate: 0,
      stage: 'lower-end-dwell-before-forward-scribing-pass',
    };
  };

  const stateAtTime = (time) => {
    const motion = motionAtTime(time);
    const rackDisplacement = rackStroke * motion.progress;
    const rackVelocity = rackStroke * motion.progressRate;
    const inputAngle = inputStartAngle
      + rackDisplacement / spurPitchRadius;
    const inputAngularSpeed = rackVelocity / spurPitchRadius;
    const drivenBevelLocalAngle = drivenBevelStartAngle
      - bevelRatio * (inputAngle - inputStartAngle);
    const drivenBevelLocalAngularSpeed = -bevelRatio
      * inputAngularSpeed;
    const cylinderAngle = cylinderStartAngle
      + bevelRatio * (inputAngle - inputStartAngle);
    const cylinderAngularSpeed = bevelRatio * inputAngularSpeed;
    const scriberY = scribingBottomY + rackDisplacement;
    const stylusContactPoint = new THREE.Vector3(
      stylusContactX,
      scriberY,
      cylinderCenter.z,
    );
    const helixLocalPoint = new THREE.Vector3(
      cylinderRadius * Math.cos(cylinderAngle),
      scriberY,
      cylinderRadius * Math.sin(cylinderAngle),
    );
    const helixWorldPoint = helixLocalPoint.clone()
      .applyAxisAngle(Y_AXIS, cylinderAngle)
      .add(new THREE.Vector3(cylinderCenter.x, 0, cylinderCenter.z));
    const driverAngularVelocity = X_AXIS.clone()
      .multiplyScalar(inputAngularSpeed);
    const drivenPhysicalAngularVelocity = Y_AXIS.clone()
      .multiplyScalar(cylinderAngularSpeed);
    const bevelContactRadius = bevelContactPoint.clone().sub(apex);
    const driverBevelPitchVelocity = driverAngularVelocity.clone()
      .cross(bevelContactRadius);
    const drivenBevelPitchVelocity = drivenPhysicalAngularVelocity.clone()
      .cross(bevelContactRadius);
    const spurPitchVelocity = driverAngularVelocity.clone().cross(
      spurRackContactPoint.clone().sub(spurCenter),
    );
    const rackPitchVelocity = Y_AXIS.clone().multiplyScalar(rackVelocity);
    return {
      bevelContactPoint: bevelContactPoint.clone(),
      cyclePhase: motion.cyclePhase,
      cylinderAngle,
      cylinderAngularSpeed,
      driverBevelPitchVelocity,
      drivenBevelLocalAngle,
      drivenBevelLocalAngularSpeed,
      drivenBevelPitchVelocity,
      helixLocalPoint,
      helixWorldPoint,
      inputAngle,
      inputAngularSpeed,
      progress: motion.progress,
      progressRate: motion.progressRate,
      rackDisplacement,
      rackPitchVelocity,
      rackVelocity,
      scriberY,
      spurPitchVelocity,
      spurRackContactPoint: spurRackContactPoint.clone(),
      stage: motion.stage,
      stylusContactPoint,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.18,
    roughness: 0.63,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.29,
    roughness: 0.44,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.13,
    roughness: 0.56,
  });
  const drivenMaterial = matte(PALETTE.driven, {
    metalness: 0.14,
    roughness: 0.57,
  });
  const accentMaterial = matte(PALETTE.accent, {
    metalness: 0.28,
    roughness: 0.44,
  });
  const whiteMaterial = matte(PALETTE.white, { roughness: 0.42 });

  const table = new THREE.Mesh(
    new THREE.BoxGeometry(4.65, 0.16, 1.85),
    frameMaterial,
  );
  table.position.set(0.02, 1.72, -0.05);
  table.userData.fixed = true;
  table.userData.role = 'fixed-table-separating-drive-from-cylinder';
  root.add(table);

  const cylinderRotor = new THREE.Group();
  cylinderRotor.position.copy(cylinderCenter);
  cylinderRotor.userData.axis = Y_AXIS.clone();
  cylinderRotor.userData.role =
    'vertical-cylinder-and-shaft-rigid-rotating-assembly';
  root.add(cylinderRotor);
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(
      cylinderRadius,
      cylinderRadius,
      cylinderHeight,
      72,
      1,
      false,
    ),
    drivenMaterial,
  );
  cylinder.userData.role = 'cylinder-receiving-described-spiral-line';
  cylinderRotor.add(cylinder);
  const cylinderRims = [-1, 1].map((side) => {
    const rim = torusNormalToY(
      cylinderRadius,
      0.045,
      darkMaterial,
      72,
    );
    rim.position.y = side * cylinderHeight / 2;
    rim.userData.role = 'cylinder-end-rim';
    cylinderRotor.add(rim);
    return rim;
  });
  const cylinderShaft = new THREE.Mesh(
    // Brown's upright shaft stops inside the horizontal bevel wheel, below
    // the horizontal shaft, instead of crossing it.
    new THREE.CylinderGeometry(0.082, 0.082, apex.y - 0.10 + 1.74, 30),
    darkMaterial,
  );
  cylinderShaft.position.y = (apex.y - 0.10 - 1.74) / 2;
  cylinderShaft.userData.role =
    'vertical-shaft-keyed-to-bevel-wheel-and-cylinder';
  cylinderRotor.add(cylinderShaft);
  const cylinderIndexes = [-0.90, 0, 0.90].map((y) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 12),
      whiteMaterial,
    );
    const angle = cylinderStartAngle + Math.PI * 0.68;
    marker.position.set(
      (cylinderRadius + 0.025) * Math.cos(angle),
      y,
      (cylinderRadius + 0.025) * Math.sin(angle),
    );
    marker.userData.role = 'white-cylinder-spin-index';
    cylinderRotor.add(marker);
    return marker;
  });

  const helixCurve = new CylinderHelixCurve({
    angularTravel: cylinderAngularTravel,
    bottomY: scribingBottomY,
    initialMaterialAngle: cylinderStartAngle,
    radius: cylinderRadius,
    stroke: rackStroke,
  });
  const spiralTrace = new THREE.Mesh(
    // The drawn line is sunk into the surface so only a hairline stands
    // proud; the marking point rides on it instead of piercing a bead.
    new THREE.TubeGeometry(new (class extends THREE.Curve {
      getPoint(t, target = new THREE.Vector3()) {
        const point = helixCurve.getPoint(t, target);
        const scale = (cylinderRadius - 0.018) / cylinderRadius;
        return point.set(point.x * scale, point.y, point.z * scale);
      }
    })(), 180, 0.022, 9, false),
    matte(PALETTE.ink, { metalness: 0.06, roughness: 0.50 }),
  );
  spiralTrace.userData.role =
    'mechanically-derived-spiral-line-fixed-on-cylinder-surface';
  cylinderRotor.add(spiralTrace);
  // The spiral is a real groove cut into the cylinder along the same helix,
  // not a painted hairline: the cylinder's surface dips in a rounded channel
  // (0.028 deep, 0.09 wide) whose centre follows the helix, with rounded
  // ends. The former hairline tube is kept only as a hidden reference.
  {
    const grooveDepth = 0.028, grooveHalfWidth = 0.045;
    const unwrappedRun = cylinderRadius * cylinderAngularTravel;
    const lineLength = Math.hypot(unwrappedRun, rackStroke);
    const ux = unwrappedRun / lineLength, uy = rackStroke / lineLength;
    const grooveDistance = (angle, y) => {
      // Unwrapped coordinates relative to the helix start, taking the angle
      // branch nearest the helix at this height.
      const along = THREE.MathUtils.clamp((y - scribingBottomY) / rackStroke, 0, 1);
      const helixAngle = cylinderStartAngle + cylinderAngularTravel * along;
      let delta = angle - helixAngle;
      delta -= FULL_TURN * Math.round(delta / FULL_TURN);
      const px = cylinderRadius * (helixAngle + delta - cylinderStartAngle);
      const py = y - scribingBottomY;
      const t = THREE.MathUtils.clamp(px * ux + py * uy, 0, lineLength);
      return Math.hypot(px - t * ux, py - t * uy);
    };
    const around = 360, along = 320;
    const positions = [], indices = [];
    for (let j = 0; j <= along; j += 1) {
      const y = -cylinderHeight / 2 + cylinderHeight * j / along;
      for (let i = 0; i <= around; i += 1) {
        const angle = FULL_TURN * i / around;
        const d = grooveDistance(angle, y) / grooveHalfWidth;
        const r = cylinderRadius - (d < 1 ? grooveDepth * Math.sqrt(1 - d * d) : 0);
        positions.push(r * Math.cos(angle), y, r * Math.sin(angle));
      }
    }
    for (let j = 0; j < along; j += 1) {
      for (let i = 0; i < around; i += 1) {
        const a0 = j * (around + 1) + i, a1 = a0 + 1, b0 = a0 + around + 1, b1 = b0 + 1;
        indices.push(a0, b0, a1, a1, b0, b1);
      }
    }
    const side = new THREE.BufferGeometry();
    side.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    side.setIndex(indices);
    side.computeVertexNormals();
    // Weld the seam normals so the surface shades continuously round it.
    const normals = side.attributes.normal;
    for (let j = 0; j <= along; j += 1) {
      const first = j * (around + 1), last = first + around;
      const n = new THREE.Vector3().fromBufferAttribute(normals, first)
        .add(new THREE.Vector3().fromBufferAttribute(normals, last)).normalize();
      normals.setXYZ(first, n.x, n.y, n.z);
      normals.setXYZ(last, n.x, n.y, n.z);
    }
    const caps = [-1, 1].map((sign) => {
      const cap = new THREE.CircleGeometry(cylinderRadius, around);
      cap.rotateX(-sign * Math.PI / 2);
      cap.translate(0, sign * cylinderHeight / 2, 0);
      cap.deleteAttribute('uv');
      return cap.toNonIndexed();
    });
    const grooved = mergeGeometries([side.toNonIndexed(), ...caps]);
    grooved.computeBoundingBox();
    grooved.computeBoundingSphere();
    cylinder.geometry.dispose();
    cylinder.geometry = grooved;
    cylinder.userData.helicalGroove = { depth: grooveDepth, halfWidth: grooveHalfWidth };
    spiralTrace.visible = false;
    spiralTrace.userData.retiredPaintedLine = true;
  }

  const driverBevel = makePitchConeGear({
    axis: X_AXIS,
    boreRadius: 0.10,
    color: PALETTE.driver,
    indexTooth: 0,
    innerDistance: driverInnerDistance,
    outerDistance: driverOuterDistance,
    pitchConeAngle: driverPitchConeAngle,
    teeth: driverTeeth,
    toothHeight: 0.105,
  });
  driverBevel.position.copy(apex);
  driverBevel.userData.role =
    'input-shaft-bevel-pinion-driving-cylinder-shaft';
  root.add(driverBevel);

  const drivenBevel = makePitchConeGear({
    axis: Y_AXIS.clone().negate(),
    boreRadius: 0.105,
    color: PALETTE.accent,
    indexTooth: 0,
    innerDistance: drivenInnerDistance,
    outerDistance: drivenOuterDistance,
    pitchConeAngle: drivenPitchConeAngle,
    teeth: drivenTeeth,
    toothHeight: 0.105,
  });
  drivenBevel.position.copy(apex);
  drivenBevel.userData.role =
    'vertical-shaft-bevel-wheel-driving-cylinder';
  root.add(drivenBevel);

  const spurGear = makeGear({
    axis: X_AXIS,
    color: PALETTE.driver,
    depth: 0.31,
    radius: spurPitchRadius,
    teeth: spurTeeth,
    toothHeight: spurModule * 1.65,
  });
  spurGear.position.copy(spurCenter);
  spurGear.userData.role =
    'same-input-shaft-spur-pinion-driving-vertical-rack';
  root.add(spurGear);

  // The horizontal shaft runs from just inside the bevel pinion (clear of
  // the upright shaft) to the crank arm's face.
  const inputShaftLeft = apex.x + 0.10;
  const inputShaftRight = 1.995;
  const inputShaft = cylinderAlongX(0.072, inputShaftRight - inputShaftLeft, darkMaterial, 30);
  inputShaft.position.set((inputShaftLeft + inputShaftRight) / 2, apex.y, apex.z);
  inputShaft.userData.role =
    'single-keyed-horizontal-shaft-for-crank-spur-and-bevel-pinion';
  root.add(inputShaft);
  const shaftIndexRotor = new THREE.Group();
  shaftIndexRotor.position.set(1.37, apex.y, apex.z);
  const shaftIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.055, 0.105),
    whiteMaterial,
  );
  shaftIndex.position.y = 0.085;
  shaftIndex.userData.role = 'white-input-shaft-spin-index';
  shaftIndexRotor.add(shaftIndex);
  root.add(shaftIndexRotor);

  const crankRotor = new THREE.Group();
  crankRotor.position.set(2.05, apex.y, apex.z);
  crankRotor.userData.axis = X_AXIS.clone();
  crankRotor.userData.role = 'hand-crank-keyed-to-input-shaft';
  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.74, 0.105),
    driverMaterial,
  );
  crankArm.position.y = 0.37;
  crankArm.userData.role = 'input-crank-arm';
  crankRotor.add(crankArm);
  const crankHandle = cylinderAlongX(0.075, 0.43, darkMaterial, 28);
  crankHandle.position.set(0.19, 0.74, 0);
  crankHandle.userData.role = 'free-turning-hand-crank-handle';
  crankRotor.add(crankHandle);
  const crankKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.095, 20, 14),
    driverMaterial,
  );
  crankKnob.position.set(0.41, 0.74, 0);
  crankKnob.userData.role = 'crank-handle-end-knob';
  crankRotor.add(crankKnob);
  root.add(crankRotor);

  const rackAssembly = new THREE.Group();
  rackAssembly.userData.axis = Y_AXIS.clone();
  rackAssembly.userData.role =
    'vertical-rack-carriage-and-marking-point-assembly';
  root.add(rackAssembly);
  // Brown carries the marking point on the rack's own lower end, so the
  // rack runs down (by whole tooth pitches, keeping the pinion phase) and
  // seats on the marking carriage.
  const rackLocalBottom = 1.02 - 5 * rackPitch;
  const rackLength = 4.06 + 5 * rackPitch;
  const rack = makeVerticalRack({
    bodyDepth: 0.15,
    bodyWidth: 0.30,
    length: rackLength,
    localBottom: rackLocalBottom,
    pitch: rackPitch,
    pitchPlaneZ: spurRackContactPoint.z,
    positionX: spurCenter.x,
    toothHeight: 0.15,
  });
  rack.userData.role = 'finite-toothed-rack-sliding-through-guides';
  rackAssembly.add(rack);

  const rackCarrier = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.24, 0.38),
    drivenMaterial,
  );
  rackCarrier.position.set(
    spurCenter.x,
    0,
    spurRackContactPoint.z - 0.11,
  );
  rackCarrier.userData.role = 'rack-marking-carriage';
  rackAssembly.add(rackCarrier);
  const carriageBridge = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.17, 0.58),
    drivenMaterial,
  );
  carriageBridge.position.set(
    spurCenter.x,
    0,
    spurRackContactPoint.z / 2,
  );
  carriageBridge.userData.role =
    'bridge-from-rack-plane-to-cylinder-center-plane';
  rackAssembly.add(carriageBridge);
  // The arm ends in the base of the conical marking point.
  const stylusArmLength = spurCenter.x - stylusContactX - 0.20;
  const stylusArm = cylinderAlongX(
    0.052,
    stylusArmLength,
    accentMaterial,
    24,
  );
  stylusArm.position.set(
    (spurCenter.x + stylusContactX + 0.20) / 2,
    0,
    cylinderCenter.z,
  );
  stylusArm.userData.role = 'rigid-horizontal-marking-point-arm';
  rackAssembly.add(stylusArm);
  const stylusTip = new THREE.Mesh(
    new THREE.ConeGeometry(0.086, 0.22, 24),
    darkMaterial,
  );
  stylusTip.rotation.z = Math.PI / 2;
  // The point runs down into the helical groove, 0.006 above its floor.
  stylusTip.position.set(
    stylusContactX + 0.11 - 0.022,
    0,
    cylinderCenter.z,
  );
  stylusTip.userData.role = 'marking-point-touching-cylinder-surface';
  rackAssembly.add(stylusTip);
  const contactBead = new THREE.Mesh(
    new THREE.SphereGeometry(0.042, 16, 12),
    whiteMaterial,
  );
  contactBead.position.set(
    stylusContactX,
    0,
    cylinderCenter.z,
  );
  contactBead.userData.role = 'visible-exact-scribing-contact-point';
  rackAssembly.add(contactBead);

  const makeShaftBearing = (x) => {
    const group = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 1.14, 0.35),
      frameMaterial,
    );
    post.position.set(x, 2.35, 0);
    post.userData.fixed = true;
    post.userData.role = 'horizontal-input-shaft-bearing-post';
    group.add(post);
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.055, 9, 32),
      frameMaterial,
    );
    collar.position.set(x, apex.y, 0);
    collar.rotation.y = Math.PI / 2;
    collar.userData.fixed = true;
    collar.userData.role = 'horizontal-input-shaft-bearing-collar';
    group.add(collar);
    return group;
  };
  const shaftBearings = [-0.10, 1.32].map((x) => {
    const bearing = makeShaftBearing(x);
    root.add(bearing);
    return bearing;
  });

  const verticalBearing = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.24, 30),
    frameMaterial,
  );
  verticalBearing.position.set(cylinderCenter.x, 1.86, 0);
  verticalBearing.userData.fixed = true;
  verticalBearing.userData.role = 'table-bearing-for-cylinder-shaft';
  root.add(verticalBearing);

  const rackGuides = [1.88, 3.95].map((y) => {
    const guide = new THREE.Group();
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.47, 0.15, 0.13),
      frameMaterial,
    );
    back.position.set(spurCenter.x, y, spurRackContactPoint.z - 0.27);
    guide.add(back);
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(
        new THREE.BoxGeometry(0.10, 0.15, 0.32),
        frameMaterial,
      );
      cheek.position.set(
        spurCenter.x + side * 0.20,
        y,
        spurRackContactPoint.z - 0.12,
      );
      guide.add(cheek);
    }
    guide.userData.fixed = true;
    guide.userData.role = 'fixed-open-rack-slide-guide';
    root.add(guide);
    return guide;
  });

  const update = (time) => {
    const state = stateAtTime(time);
    setSpin(driverBevel, state.inputAngle);
    setSpin(spurGear, state.inputAngle);
    setSpin(drivenBevel, state.drivenBevelLocalAngle);
    shaftIndexRotor.rotation.x = state.inputAngle;
    crankRotor.rotation.x = state.inputAngle;
    cylinderRotor.rotation.y = state.cylinderAngle;
    rackAssembly.position.y = state.scriberY;
    root.userData.currentState = state;
    root.userData.constraints = {
      bevelPitchContact: {
        contactPoint: state.bevelContactPoint.clone(),
        driverPitchVelocity: state.driverBevelPitchVelocity.clone(),
        drivenPitchVelocity: state.drivenBevelPitchVelocity.clone(),
        slipVelocity: state.driverBevelPitchVelocity.clone()
          .sub(state.drivenBevelPitchVelocity),
      },
      coaxialOutput: {
        cylinderAngle: state.cylinderAngle,
        drivenBevelPhysicalAngle: -state.drivenBevelLocalAngle,
        keyedAngleDifference: state.cylinderAngle
          + state.drivenBevelLocalAngle,
      },
      rackPitchContact: {
        contactPoint: state.spurRackContactPoint.clone(),
        pitchPhaseResidual: state.rackDisplacement
          - spurPitchRadius * (state.inputAngle - inputStartAngle),
        rackVelocity: state.rackPitchVelocity.clone(),
        slipVelocity: state.spurPitchVelocity.clone()
          .sub(state.rackPitchVelocity),
        spurPitchVelocity: state.spurPitchVelocity.clone(),
      },
      scribingContact: {
        contactError: state.helixWorldPoint.distanceTo(
          state.stylusContactPoint,
        ),
        helixWorldPoint: state.helixWorldPoint.clone(),
        stylusPoint: state.stylusContactPoint.clone(),
      },
    };
  };

  root.userData = {
    archetype:
      'shared-shaft-spur-rack-bevel-cylinder-helix-scriber',
    blocks: {
      carriageBridge,
      contactBead,
      crankRotor,
      cylinder,
      cylinderIndexes,
      cylinderRims,
      cylinderRotor,
      cylinderShaft,
      driverBevel,
      drivenBevel,
      inputShaft,
      rack,
      rackAssembly,
      rackCarrier,
      rackGuides,
      shaftBearings,
      shaftIndex,
      spiralTrace,
      spurGear,
      stylusArm,
      stylusTip,
      table,
      verticalBearing,
    },
    degreesOfFreedom: {
      independentPrescribedInputs: 1,
      input:
        'hand-crank angle on the common horizontal spur-and-bevel shaft',
      note:
        'the rack and cylinder are both constrained by gears on that one shaft, so helix pitch is not an independent setting in the illustrated mechanism',
      storedEnergyStates: 0,
    },
    dynamics: {
      sourceSpecifiesTimingMassOrFriction: false,
      treatment:
        'a zero-velocity, zero-acceleration quintic hand-cranked pass and reverse retrace provide a continuous looping demonstration; Brown specifies neither speed nor automatic reversal',
    },
    fidelity: 'authored',
    geometry: {
      apex: apex.clone(),
      bevelContactPoint: bevelContactPoint.clone(),
      bevelRatio,
      cylinderAngularTravel,
      cylinderCenter: cylinderCenter.clone(),
      cylinderHeight,
      cylinderRadius,
      cylinderStartAngle,
      demonstrationPeriod,
      drawableMargin,
      drivenOuterDistance,
      drivenOuterPitchRadius,
      drivenPitchConeAngle,
      drivenBevelStartAngle,
      drivenTeeth,
      driverOuterDistance,
      driverOuterPitchRadius,
      driverPitchConeAngle,
      driverTeeth,
      helixAxialPitch,
      helixTurns,
      inputAngularTravel,
      inputStartAngle,
      outerConeDistance,
      rackLength,
      rackPitch,
      rackStroke,
      schedule: { ...schedule },
      scribingBottomY,
      scribingTopY,
      spurCenter: spurCenter.clone(),
      spurModule,
      spurPitchRadius,
      spurRackContactPoint: spurRackContactPoint.clone(),
      spurTeeth,
      stylusContactX,
    },
    helixCurve,
    mechanism:
      'one-hand-cranked-horizontal-shaft-carries-a-bevel-pinion-and-spur-pinion-the-bevel-pair-rotates-a-vertical-cylinder-while-the-spur-moves-a-vertical-rack-and-scribing-point',
    motionAtTime,
    officialDescription: movement.description,
    sourceAnimation: {
      available: false,
      officialCanvasModelPresent: false,
      pageMarksAnimationUnavailable: true,
      sourcePrescribedTiming: false,
    },
    sourceReference: {
      brownPlate368: {
        bevelPinionCenter: new THREE.Vector2(251, 106),
        bevelWheelCenter: new THREE.Vector2(168, 174),
        crankHandle: new THREE.Vector2(496, 138),
        cylinderBottom: new THREE.Vector2(162, 520),
        cylinderLeft: new THREE.Vector2(62, 397),
        cylinderRight: new THREE.Vector2(264, 397),
        cylinderTop: new THREE.Vector2(162, 283),
        imageHeight: 525,
        imageWidth: 525,
        markingPoint: new THREE.Vector2(250, 402),
        measurementUncertaintyPixels: 8,
        rackCenterline: new THREE.Vector2(385, 361),
        spurCenter: new THREE.Vector2(386, 117),
      },
      constructionEvidence: {
        explicitInBrownDescription: [
          'the apparatus describes a spiral line on a cylinder',
          'one spur gear drives the bevel gears',
          'that same spur gear also gears into the toothed rack',
          'the bevel gears give rotary motion to the cylinder',
          'the rack causes the marking point to traverse from end to end of the cylinder',
        ],
        engravingEvidence:
          'the plate shows a hand crank and horizontal common shaft above the table, a right-angle bevel pair leading to the vertical cylinder shaft, a vertical rack at the spur gear, and a rack-carried point touching the cylinder below',
        reconstructionDisclosure:
          'tooth counts, module, dimensions, stroke, helix pitch, and smooth forward-and-reverse demonstration timing are engineered from the engraving because Brown supplies no numerical values and the official page has no canvas animation',
      },
      officialPage: 'https://507movements.com/mm_368.html',
      primaryScan: {
        archiveIdentifier: 'fivehundredseven00browiala',
        publicationYear: 1908,
      },
    },
    stateAtTime,
    timeline: {
      demonstrationPeriod,
      note:
        'one cycle dwells at the lower end, makes a smooth forward scribing pass, dwells at the upper end, and reverses along the identical constrained helix for a seamless loop',
      schedule: { ...schedule },
    },
    transmission: {
      bevelLaw:
        'driven bevel local angle = start - (18/30)*(input angle - input start); equal module gives zero pitch-line slip on perpendicular axes',
      cylinderLaw:
        'the vertical cylinder is keyed to the driven bevel shaft, so its physical angle is the negative of that gear local angle about the downward axis',
      helixLaw:
        'eliminating input angle gives material helix angle = cylinder start + (driver bevel teeth / driven bevel teeth)*(axial travel / spur pitch radius)',
      helixPitchLaw:
        'axial pitch per full cylinder revolution = 2*pi*spur pitch radius*(driven bevel teeth / driver bevel teeth)',
      rackLaw:
        'rack displacement = spur pitch radius*(input angle - input start), with the rack on the negative-z pitch tangent',
      sharedShaftLaw:
        'hand crank, spur pinion, and bevel pinion carry one identical unwrapped input angle at all times',
    },
  };

  update(0);
  // Brown crops the rack at the top edge of the plate just above the bevel
  // wheels and runs the cylinder off the foot, so the cylinder fills the
  // lower half. The frame keeps the marking point's lowest start in view.
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-2.33, -1.42, -1.15),
    new THREE.Vector3(2.58, 3.62, 1.15),
  );
  root.userData.cameraFitCropsSource = true;
  correctScriberDynamometer(root, 368);
  // Brown draws the rack's teeth and the spur pinion in mesh at the default
  // view, but his rack behind the pinion cannot also give his helix sense
  // with the bevel pair where he draws it: the model keeps the rack on the
  // pinion's near side (the mirrored presentation) so the spiral runs as
  // engraved, and the rack's smooth backbone, the part covering the
  // mesh, uses the shared see-through style with its teeth, so the pinion
  // and the rack teeth both show through it.
  makeSeeThrough(rack.userData.body);
  for (const tooth of rack.userData.teeth) makeSeeThrough(tooth);
  // Brown draws plain wheels, a plain cylinder and no phase indices; those
  // cues stay allocated for the kinematic checks but are not presented.
  for (const part of [
    ...cylinderRims,
    ...cylinderIndexes,
    shaftIndex,
    driverBevel.userData.faceRing,
    driverBevel.userData.faceIndex,
    drivenBevel.userData.faceRing,
    drivenBevel.userData.faceIndex,
  ]) if (part) part.visible = false;
  root.userData.groundFloorY = -1.56;
  markShadows(root);
  return {
    cameraDirection: new THREE.Vector3(6.8, 5.0, 8.4),
    root,
    update,
  };
}

export function createAuthoredCylinderSpiralScriberMovement(movement) {
  if (movement.id !== 368) return null;
  return spiralCylinderScriber(movement);
}
