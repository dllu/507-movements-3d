import { correctCompensationJournals } from './pendulum-journal-parts.js';
import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {trapezoidThread} from './differential-thread-solids.js';
import {mergeGeometries, mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {creaseIndexedNormals} from './crease-normals.js';
import {makeSeeThrough} from './see-through-part.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  PALETTE,
  makeBeam,
  markShadows,
  matte,
} from './primitives.js';

const FULL_TURN = Math.PI * 2;
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function cylinderAlongX(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.z = Math.PI / 2;
  return cylinder;
}

function cylinderAlongY(radius, length, material, segments = 36) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
}

function cylinderAlongZ(radius, length, material, segments = 32) {
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, segments),
    material,
  );
  cylinder.rotation.x = Math.PI / 2;
  return cylinder;
}

function torusAroundY(majorRadius, tubeRadius, material, segments = 64) {
  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(majorRadius, tubeRadius, 10, segments),
    material,
  );
  torus.rotation.x = Math.PI / 2;
  return torus;
}

function tubeThrough(points, radius, material, role) {
  const curve = new THREE.CatmullRomCurve3(
    points,
    false,
    'centripetal',
  );
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 48, radius, 10, false),
    material,
  );
  tube.userData.role = role;
  return tube;
}

// p104 (317): one bent lamina of compound bar C as a single solid strip.
// The interface curve is sampled at fixed stations and the lamina is swept
// on the side `sign` of it (+1 above, -1 below), ending at both tips in a
// quarter round so the two laminae together end in a round knob. The
// interface faces are shared with the other lamina and are omitted, so the
// pair forms one closed bar with no coincident internal faces. The topology
// is fixed; positions and normals are rewritten each frame.
function makeBentLamina({ material, role, layer, sign, stations = 120,
  capSegments = 10 }) {
  const n = stations;
  const k = capSegments;
  const outlineCount = (n + 1) * 2 + (k + 1) * 2;
  const wallCount = (k + 1) + (n - 1) + (k + 1);
  const vertexCount = outlineCount * 2 + wallCount * 2;
  const position = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3);
  const normal = new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3);
  const indices = [];
  // Face vertex indices: P[i] = i, O[i] = n+1+i, A[j] = 2(n+1)+j, B[j] = 2(n+1)+k+1+j.
  const P = (i) => i;
  const O = (i) => n + 1 + i;
  const A = (j) => 2 * (n + 1) + j;
  const B = (j) => 2 * (n + 1) + k + 1 + j;
  for (const offset of [0, outlineCount]) {
    for (let i = 0; i < n; i += 1) {
      indices.push(offset + P(i), offset + P(i + 1), offset + O(i + 1),
        offset + P(i), offset + O(i + 1), offset + O(i));
    }
    for (let j = 0; j < k; j += 1) {
      indices.push(offset + P(n), offset + A(j), offset + A(j + 1));
      indices.push(offset + P(0), offset + B(j), offset + B(j + 1));
    }
  }
  const wallBase = outlineCount * 2;
  for (let w = 0; w + 1 < wallCount; w += 1) {
    const a = wallBase + w * 2;
    indices.push(a, a + 2, a + 3, a, a + 3, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', position);
  geometry.setAttribute('normal', normal);
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.userData.role = role;
  mesh.userData.layer = layer;
  let oriented = false;
  const set = ({ curve, tangent, xStart, xEnd, thickness, depth }) => {
    const put = (index, x, y, z, nx, ny, nz) => {
      position.setXYZ(index, x, y, z);
      normal.setXYZ(index, nx, ny, nz);
    };
    const outline = [];
    const unit = (x) => {
      const [tx, ty] = tangent(x);
      const length = Math.hypot(tx, ty);
      return [tx / length, ty / length];
    };
    const points = [];
    for (let i = 0; i <= n; i += 1) {
      const x = xStart + (xEnd - xStart) * i / n;
      const [tx, ty] = unit(x);
      points.push({ p: [x, curve(x)], t: [tx, ty], nrm: [-ty, tx] });
    }
    for (let i = 0; i <= n; i += 1) outline[P(i)] = points[i].p;
    for (let i = 0; i <= n; i += 1) {
      const { p, nrm } = points[i];
      outline[O(i)] = [p[0] + sign * thickness * nrm[0], p[1] + sign * thickness * nrm[1]];
    }
    const capPoint = (end, direction, j) => {
      const phi = (Math.PI / 2) * j / k;
      const rx = Math.cos(phi) * direction * end.t[0] + sign * Math.sin(phi) * end.nrm[0];
      const ry = Math.cos(phi) * direction * end.t[1] + sign * Math.sin(phi) * end.nrm[1];
      return { p: [end.p[0] + thickness * rx, end.p[1] + thickness * ry], r: [rx, ry] };
    };
    const capsA = [];
    const capsB = [];
    for (let j = 0; j <= k; j += 1) {
      capsA.push(capPoint(points[n], 1, j));
      capsB.push(capPoint(points[0], -1, j));
      outline[A(j)] = capsA[j].p;
      outline[B(j)] = capsB[j].p;
    }
    for (const [offset, z, nz] of [[0, depth / 2, 1], [outlineCount, -depth / 2, -1]]) {
      outline.forEach(([x, y], index) => put(offset + index, x, y, z, 0, 0, nz));
    }
    const wall = [
      ...capsB.map(({ p, r }) => ({ p, r })),
      ...points.slice(1, n).map(({ p, nrm }) => ({
        p: [p[0] + sign * thickness * nrm[0], p[1] + sign * thickness * nrm[1]],
        r: [sign * nrm[0], sign * nrm[1]],
      })),
      ...capsA.slice().reverse(),
    ];
    wall.forEach(({ p, r }, w) => {
      put(wallBase + w * 2, p[0], p[1], depth / 2, r[0], r[1], 0);
      put(wallBase + w * 2 + 1, p[0], p[1], -depth / 2, r[0], r[1], 0);
    });
    position.needsUpdate = true;
    normal.needsUpdate = true;
    if (!oriented) {
      // Fix each triangle's winding once so it faces along its normal.
      const index = geometry.index.array;
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      const c = new THREE.Vector3();
      const m = new THREE.Vector3();
      for (let f = 0; f < index.length; f += 3) {
        a.fromBufferAttribute(position, index[f]);
        b.fromBufferAttribute(position, index[f + 1]).sub(a);
        c.fromBufferAttribute(position, index[f + 2]).sub(a);
        m.fromBufferAttribute(normal, index[f])
          .add(new THREE.Vector3().fromBufferAttribute(normal, index[f + 1]))
          .add(new THREE.Vector3().fromBufferAttribute(normal, index[f + 2]));
        if (b.cross(c).dot(m) < 0) {
          const swap = index[f + 1];
          index[f + 1] = index[f + 2];
          index[f + 2] = swap;
        }
      }
      geometry.index.needsUpdate = true;
      oriented = true;
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  };
  return { mesh, set };
}

function mercurialCompensationPendulum(movement) {
  const root = new THREE.Group();

  // Brown's drawing gives the topology but no material dimensions. The
  // static plate is measured here to retain its proportions. Thermal travel
  // is deliberately magnified, while the mercury level is solved from a
  // transparent three-body physical-pendulum model so I/(M d), the distance
  // to the center of oscillation, remains exactly constant at every shown
  // temperature.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterSuspension = new THREE.Vector2(265, 11);
  const sourceRasterAdjusterCenter = new THREE.Vector2(266, 82);
  const sourceRasterJarTop = new THREE.Vector2(264, 121);
  const sourceRasterJarBottom = new THREE.Vector2(264, 496);
  const sourceRasterJarLeft = new THREE.Vector2(177, 310);
  const sourceRasterJarRight = new THREE.Vector2(350, 310);
  const sourceRasterMercuryTop = new THREE.Vector2(264, 230);
  const sourceRasterMercuryBottom = new THREE.Vector2(264, 480);
  const sourceRasterRodEnd = new THREE.Vector2(265, 444);
  const sourceRasterLeftClamp = new THREE.Vector2(178, 169);
  const sourceRasterRightClamp = new THREE.Vector2(350, 169);

  const pivot = new THREE.Vector3(0, 4.80, 0);
  const jarLength = 7.30;
  const sourceScale = jarLength / (
    sourceRasterJarBottom.y - sourceRasterJarTop.y
  );
  const referenceJarCenterDistance = (
    (sourceRasterJarTop.y + sourceRasterJarBottom.y) / 2
      - sourceRasterSuspension.y
  ) * sourceScale;
  const referenceRodLength = (
    sourceRasterRodEnd.y - sourceRasterSuspension.y
  ) * sourceScale;
  const referenceMercuryBottomDistance = (
    sourceRasterMercuryBottom.y - sourceRasterSuspension.y
  ) * sourceScale;
  const referenceFillHeight = (
    sourceRasterMercuryBottom.y - sourceRasterMercuryTop.y
  ) * sourceScale;
  const jarOuterRadius = (
    sourceRasterJarRight.x - sourceRasterJarLeft.x
  ) * sourceScale / 2;
  const jarInnerRadius = jarOuterRadius * 0.88;
  const jarIntrinsicRadiusOfGyrationSquared = jarLength ** 2 / 12
    + jarOuterRadius ** 2 / 2;

  const rodMass = 0.55;
  const jarMass = 1.40;
  const mercuryMass = 9.50;
  const totalMass = rodMass + jarMass + mercuryMass;
  const maximumRodExtension = 0.22;
  const nominalTemperature = 20;
  const temperatureAmplitude = 30;
  const thermalCyclePeriod = 4;
  const thermalAngularFrequency = FULL_TURN / thermalCyclePeriod;
  const swingPeriod = thermalCyclePeriod / 2;
  const swingAngularFrequency = FULL_TURN / swingPeriod;
  const swingAmplitude = THREE.MathUtils.degToRad(14);

  const massProperties = (rodExtension, fillHeight) => {
    const rodLength = referenceRodLength + rodExtension;
    const jarCenterDistance = referenceJarCenterDistance + rodExtension;
    const mercuryBottomDistance = referenceMercuryBottomDistance
      + rodExtension;
    const mercuryCenterDistance = mercuryBottomDistance - fillHeight / 2;
    const firstMoment = rodMass * rodLength / 2
      + jarMass * jarCenterDistance
      + mercuryMass * mercuryCenterDistance;
    const rodInertia = rodMass * rodLength ** 2 / 3;
    const jarInertia = jarMass * (
      jarCenterDistance ** 2
      + jarIntrinsicRadiusOfGyrationSquared
    );
    const mercuryIntrinsicInertia = mercuryMass * (
      fillHeight ** 2 / 12
      + jarInnerRadius ** 2 / 4
    );
    const mercuryInertia = mercuryMass * mercuryCenterDistance ** 2
      + mercuryIntrinsicInertia;
    const inertia = rodInertia + jarInertia + mercuryInertia;
    return {
      centerOfMassDistance: firstMoment / totalMass,
      effectiveLength: inertia / firstMoment,
      firstMoment,
      inertia,
      jarCenterDistance,
      jarInertia,
      mercuryBottomDistance,
      mercuryCenterDistance,
      mercuryInertia,
      mercuryIntrinsicInertia,
      rodInertia,
      rodLength,
      totalMass,
    };
  };

  const referenceMassProperties = massProperties(0, referenceFillHeight);
  const referenceEffectiveLength = referenceMassProperties.effectiveLength;

  const fillStateAtRodExtension = (rodExtension) => {
    const rodLength = referenceRodLength + rodExtension;
    const jarCenterDistance = referenceJarCenterDistance + rodExtension;
    const mercuryBottomDistance = referenceMercuryBottomDistance
      + rodExtension;
    const otherFirstMoment = rodMass * rodLength / 2
      + jarMass * jarCenterDistance;
    const otherInertia = rodMass * rodLength ** 2 / 3
      + jarMass * (
        jarCenterDistance ** 2
        + jarIntrinsicRadiusOfGyrationSquared
      );
    const quadraticA = mercuryMass / 3;
    const quadraticB = mercuryMass * (
      -mercuryBottomDistance + referenceEffectiveLength / 2
    );
    const quadraticC = otherInertia + mercuryMass * (
      mercuryBottomDistance ** 2 + jarInnerRadius ** 2 / 4
    ) - referenceEffectiveLength * (
      otherFirstMoment + mercuryMass * mercuryBottomDistance
    );
    const discriminant = quadraticB ** 2
      - 4 * quadraticA * quadraticC;
    const squareRoot = Math.sqrt(Math.max(0, discriminant));
    const lowerRoot = (-quadraticB - squareRoot) / (2 * quadraticA);
    const upperRoot = (-quadraticB + squareRoot) / (2 * quadraticA);
    const fillHeight = lowerRoot;

    const partialFill = mercuryMass * (
      -mercuryBottomDistance
      + 2 * fillHeight / 3
      + referenceEffectiveLength / 2
    );
    const partialExtension = 2 * rodMass * rodLength / 3
      + 2 * jarMass * jarCenterDistance
      + mercuryMass * (2 * mercuryBottomDistance - fillHeight)
      - referenceEffectiveLength * (
        rodMass / 2 + jarMass + mercuryMass
      );
    const fillDerivative = -partialExtension / partialFill;
    const partialFillFill = 2 * mercuryMass / 3;
    const partialFillExtension = -mercuryMass;
    const partialExtensionExtension = 2 * rodMass / 3
      + 2 * jarMass + 2 * mercuryMass;
    const fillSecondDerivative = -(
      partialExtensionExtension
      + 2 * partialFillExtension * fillDerivative
      + partialFillFill * fillDerivative ** 2
    ) / partialFill;

    return {
      discriminant,
      fillDerivative,
      fillHeight,
      fillSecondDerivative,
      lowerRoot,
      quadraticA,
      quadraticB,
      quadraticC,
      upperRoot,
    };
  };

  const pointKinematics = ({
    distance,
    distanceAcceleration = 0,
    distanceVelocity = 0,
    swingAngle,
    swingAngularAcceleration,
    swingAngularVelocity,
  }) => {
    const rotation = new THREE.Quaternion().setFromAxisAngle(
      Z_AXIS,
      swingAngle,
    );
    const localPosition = new THREE.Vector3(0, -distance, 0);
    const localVelocity = new THREE.Vector3(0, -distanceVelocity, 0);
    const localAcceleration = new THREE.Vector3(
      0,
      -distanceAcceleration,
      0,
    );
    const angularVelocity = new THREE.Vector3(
      0,
      0,
      swingAngularVelocity,
    );
    const angularAcceleration = new THREE.Vector3(
      0,
      0,
      swingAngularAcceleration,
    );
    const rotationalVelocity = angularVelocity.clone().cross(
      localPosition,
    );
    const velocity = localVelocity.clone().add(rotationalVelocity)
      .applyQuaternion(rotation);
    const acceleration = localAcceleration.clone()
      .add(angularAcceleration.clone().cross(localPosition))
      .add(angularVelocity.clone().cross(localVelocity)
        .multiplyScalar(2))
      .add(angularVelocity.clone().cross(
        angularVelocity.clone().cross(localPosition),
      ))
      .applyQuaternion(rotation);
    const position = localPosition.applyQuaternion(rotation).add(pivot);
    return { acceleration, position, velocity };
  };

  const stateAtTime = (time) => {
    const unwrappedThermalAngle = thermalAngularFrequency * time;
    const thermalAngle = positiveModulo(unwrappedThermalAngle, FULL_TURN);
    const temperatureCoordinate = Math.sin(thermalAngle);
    const temperatureCoordinateVelocity = thermalAngularFrequency
      * Math.cos(thermalAngle);
    const temperatureCoordinateAcceleration = -(thermalAngularFrequency ** 2)
      * Math.sin(thermalAngle);
    const rodExtension = maximumRodExtension * temperatureCoordinate;
    const rodExtensionVelocity = maximumRodExtension
      * temperatureCoordinateVelocity;
    const rodExtensionAcceleration = maximumRodExtension
      * temperatureCoordinateAcceleration;
    const fill = fillStateAtRodExtension(rodExtension);
    const fillHeightVelocity = fill.fillDerivative
      * rodExtensionVelocity;
    const fillHeightAcceleration = fill.fillSecondDerivative
      * rodExtensionVelocity ** 2
      + fill.fillDerivative * rodExtensionAcceleration;
    const properties = massProperties(rodExtension, fill.fillHeight);

    const swingArgument = swingAngularFrequency * time;
    const swingAngle = swingAmplitude * Math.sin(swingArgument);
    const swingAngularVelocity = swingAmplitude * swingAngularFrequency
      * Math.cos(swingArgument);
    const swingAngularAcceleration = -swingAmplitude
      * swingAngularFrequency ** 2 * Math.sin(swingArgument);

    const jarCenterVelocity = rodExtensionVelocity;
    const jarCenterAcceleration = rodExtensionAcceleration;
    const mercuryBottomVelocity = rodExtensionVelocity;
    const mercuryBottomAcceleration = rodExtensionAcceleration;
    const mercuryCenterVelocity = rodExtensionVelocity
      - fillHeightVelocity / 2;
    const mercuryCenterAcceleration = rodExtensionAcceleration
      - fillHeightAcceleration / 2;
    const mercuryTopDistance = properties.mercuryBottomDistance
      - fill.fillHeight;
    const mercuryTopVelocity = rodExtensionVelocity
      - fillHeightVelocity;
    const mercuryTopAcceleration = rodExtensionAcceleration
      - fillHeightAcceleration;

    const commonPointArguments = {
      swingAngle,
      swingAngularAcceleration,
      swingAngularVelocity,
    };
    const rodEnd = pointKinematics({
      ...commonPointArguments,
      distance: properties.rodLength,
      distanceAcceleration: rodExtensionAcceleration,
      distanceVelocity: rodExtensionVelocity,
    });
    const jarCenter = pointKinematics({
      ...commonPointArguments,
      distance: properties.jarCenterDistance,
      distanceAcceleration: jarCenterAcceleration,
      distanceVelocity: jarCenterVelocity,
    });
    const mercuryBottom = pointKinematics({
      ...commonPointArguments,
      distance: properties.mercuryBottomDistance,
      distanceAcceleration: mercuryBottomAcceleration,
      distanceVelocity: mercuryBottomVelocity,
    });
    const mercuryCenter = pointKinematics({
      ...commonPointArguments,
      distance: properties.mercuryCenterDistance,
      distanceAcceleration: mercuryCenterAcceleration,
      distanceVelocity: mercuryCenterVelocity,
    });
    const mercuryTop = pointKinematics({
      ...commonPointArguments,
      distance: mercuryTopDistance,
      distanceAcceleration: mercuryTopAcceleration,
      distanceVelocity: mercuryTopVelocity,
    });
    const centerOfOscillation = pointKinematics({
      ...commonPointArguments,
      distance: referenceEffectiveLength,
    });
    const pendulumQuaternion = new THREE.Quaternion().setFromAxisAngle(
      Z_AXIS,
      swingAngle,
    );
    const mercuryVolume = Math.PI * jarInnerRadius ** 2
      * fill.fillHeight;
    const referenceMercuryVolume = Math.PI * jarInnerRadius ** 2
      * referenceFillHeight;

    return {
      centerOfOscillation,
      centerOfOscillationDistance: properties.effectiveLength,
      centerOfOscillationError: properties.effectiveLength
        - referenceEffectiveLength,
      centerOfMassDistance: properties.centerOfMassDistance,
      cycleIndex: Math.floor(unwrappedThermalAngle / FULL_TURN),
      cyclePhase: thermalAngle / FULL_TURN,
      fillDiscriminant: fill.discriminant,
      fillHeight: fill.fillHeight,
      fillHeightAcceleration,
      fillHeightDerivativePerRodExtension: fill.fillDerivative,
      fillHeightSecondDerivativePerRodExtension:
        fill.fillSecondDerivative,
      fillHeightVelocity,
      glassJarCenter: jarCenter,
      massProperties: properties,
      mercuryBottom,
      mercuryCenter,
      mercuryDensityRatio: referenceMercuryVolume / mercuryVolume,
      mercuryTop,
      mercuryTopDistance,
      mercuryVolume,
      mercuryVolumeRatio: mercuryVolume / referenceMercuryVolume,
      pendulumQuaternion,
      rodEnd,
      rodExtension,
      rodExtensionAcceleration,
      rodExtensionVelocity,
      swingAngle,
      swingAngularAcceleration,
      swingAngularVelocity,
      temperature: nominalTemperature
        + temperatureAmplitude * temperatureCoordinate,
      temperatureCoordinate,
      temperatureCoordinateAcceleration,
      temperatureCoordinateVelocity,
      temperatureState: temperatureCoordinate > 0.02
        ? 'warming-expanded'
        : temperatureCoordinate < -0.02
          ? 'cooling-contracted'
          : 'neutral',
      thermalAngle,
      unwrappedThermalAngle,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.16,
    roughness: 0.66,
  });
  const darkMaterial = matte(PALETTE.ink, {
    metalness: 0.28,
    roughness: 0.46,
  });
  const driverMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.60,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.25,
    roughness: 0.50,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.48,
  });
  const mercuryMaterial = matte(PALETTE.fluid, {
    metalness: 0.32,
    opacity: 0.86,
    roughness: 0.34,
    transparent: true,
  });
  mercuryMaterial.depthWrite = true;
  const glassMaterial = matte(0x9fc4cc, {
    metalness: 0.02,
    opacity: 0.25,
    roughness: 0.23,
    side: THREE.DoubleSide,
    transparent: true,
  });
  glassMaterial.depthWrite = false;

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-mercurial-pendulum-suspension-frame';
  const ceilingPlate = new THREE.Mesh(
    new THREE.BoxGeometry(2.30, 0.28, 1.36),
    frameMaterial,
  );
  ceilingPlate.position.set(0, 5.25, 0);
  ceilingPlate.userData.role = 'fixed-upper-suspension-plate';
  const bracketSides = [-0.48, 0.48].map((x) => {
    const side = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.66, 0.42),
      frameMaterial,
    );
    side.position.set(x, 4.97, 0);
    side.userData.role = 'fixed-pendulum-pivot-bracket';
    return side;
  });
  const fixedPivotShaft = cylinderAlongZ(0.18, 1.25, darkMaterial, 36);
  fixedPivotShaft.position.copy(pivot);
  fixedPivotShaft.userData.role = 'fixed-horizontal-pendulum-pivot';
  fixedFrame.add(ceilingPlate, ...bracketSides, fixedPivotShaft);

  const pendulumCarrier = new THREE.Group();
  pendulumCarrier.position.copy(pivot);
  pendulumCarrier.userData.axis = Z_AXIS.clone();
  pendulumCarrier.userData.role = 'thermally-compensated-swinging-pendulum';

  const movingPivotHub = cylinderAlongZ(0.30, 0.74, driverMaterial, 36);
  movingPivotHub.userData.role = 'moving-pendulum-pivot-hub';
  // p104: Brown's rod is about 20 px (0.39) wide; it was a 0.19 wire.
  const rodRadius = 0.16;
  const rod = cylinderAlongY(rodRadius, 1, darkMaterial, 40);
  rod.userData.role = 'thermally-expanding-steel-pendulum-rod';
  const rodIndex = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.62, 0.055),
    whiteMaterial,
  );
  rodIndex.position.set(0.10, -1.02, 0);
  rodIndex.userData.role = 'white-pendulum-swing-index';

  // Jar-local heights read from the plate (y = 3.65 at the cap top, py 121).
  const plateY = (py) => jarLength / 2 - (py - sourceRasterJarTop.y) * sourceScale;
  const capTopY = jarLength / 2;
  const neckTopY = plateY(138);
  const capPlugBottomY = plateY(158);
  const capSkirtBottomY = plateY(193);
  const clampScrewY = plateY(sourceRasterLeftClamp.y);
  const handleY = plateY(sourceRasterAdjusterCenter.y);
  const handleBlockSize = 0.72;

  // p104: a solid cut V thread (the shared trapezoid builder, root sunk in
  // the rod) from the handle block down through the cap into the neck, as
  // Brown hatches it; it was a loose wire coil standing off the rod. It is
  // carried with the jar, so the cap's threaded boss never slides on it.
  const threadProfile = {
    inner: rodRadius - 0.006,
    outer: rodRadius + 0.048,
    low: plateY(222),
    high: handleY - handleBlockSize / 2 + 0.03,
    rootWidth: 0.082,
    crestWidth: 0.022,
    lead: 0.10 / FULL_TURN,
    phase: 0,
  };
  const threadHelix = new THREE.Mesh(
    trapezoidThread(threadProfile, 96).rotateX(-Math.PI / 2),
    darkMaterial,
  );
  threadHelix.userData.role = 'visible-thread-on-pendulum-adjustment-rod';
  threadHelix.userData.threadProfile = threadProfile;

  const jarAssembly = new THREE.Group();
  jarAssembly.userData.role = 'thermally-translated-mercury-jar-assembly';

  // p104: one closed glass solid of revolution: thick rounded bottom, body,
  // an S-shoulder into a short neck, and a lip at the mouth (Brown's neck
  // sits in the cap's groove). It was an open dome the rod passed through.
  const neckOuterRadius = 1.18;
  const neckInnerRadius = 0.90;
  const lipRadius = 1.32;
  const lipBottomY = neckTopY - 0.20;
  const shoulderTopY = plateY(190);
  const shoulderBottomY = plateY(232);
  const glassInnerRadius = jarInnerRadius + 0.005;
  const mercuryBottomLocal = referenceMercuryBottomDistance
    - referenceJarCenterDistance;
  const glassInnerBottomY = -mercuryBottomLocal - 0.005;
  const bottomFillet = 0.30;
  const smooth = (t) => t * t * (3 - 2 * t);
  const glassProfile = [];
  const arc = (cx, cy, r, a0, a1, n, out) => {
    for (let i = 0; i <= n; i += 1) {
      const a = a0 + (a1 - a0) * i / n;
      out.push(new THREE.Vector2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
    }
  };
  const outerBottomY = -jarLength / 2;
  glassProfile.push(new THREE.Vector2(0, outerBottomY));
  arc(jarOuterRadius - 0.36, outerBottomY + 0.36, 0.36, -Math.PI / 2, 0, 12,
    glassProfile);
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24;
    glassProfile.push(new THREE.Vector2(
      jarOuterRadius + (neckOuterRadius - jarOuterRadius) * smooth(t),
      shoulderBottomY + (shoulderTopY - shoulderBottomY) * t,
    ));
  }
  glassProfile.push(new THREE.Vector2(neckOuterRadius, lipBottomY));
  arc(lipRadius - 0.07, lipBottomY + 0.07, 0.07, -Math.PI / 2, 0, 5,
    glassProfile);
  arc(lipRadius - 0.07, neckTopY - 0.07, 0.07, 0, Math.PI / 2, 5,
    glassProfile);
  arc(neckInnerRadius + 0.05, neckTopY - 0.05, 0.05, Math.PI / 2, Math.PI, 4,
    glassProfile);
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24;
    glassProfile.push(new THREE.Vector2(
      neckInnerRadius + (glassInnerRadius - neckInnerRadius) * smooth(t),
      shoulderTopY - 0.02 + (shoulderBottomY - 0.12 - shoulderTopY + 0.02) * t,
    ));
  }
  arc(glassInnerRadius - bottomFillet, glassInnerBottomY + bottomFillet,
    bottomFillet, 0, -Math.PI / 2, 12, glassProfile);
  glassProfile.push(new THREE.Vector2(0, glassInnerBottomY));
  const glassJar = new THREE.Mesh(
    new THREE.LatheGeometry(glassProfile, 96),
    glassMaterial,
  );
  glassJar.renderOrder = 3;
  glassJar.userData.role = 'transparent-glass-mercury-jar';
  const jarRims = [
    { radius: jarOuterRadius * 0.59, y: jarLength / 2 - 0.05 },
    { radius: jarOuterRadius * 0.94, y: -jarLength / 2 + 0.22 },
  ].map(({ radius, y }) => {
    const rim = torusAroundY(radius, 0.055, darkMaterial, 64);
    rim.position.y = y;
    rim.userData.role = 'glass-jar-protective-rim';
    // Brown's ink edge of the glass/mercury only: kept, not drawn.
    rim.visible = false;
    rim.userData.retiredInkOutline = true;
    return rim;
  });

  // p104: the mercury is one solid of revolution whose rounded bottom edge
  // follows the glass's inner base fillet; only its top face moves as it
  // expands (it was a flat-bottomed scaled cylinder, a dark disc from below).
  const mercuryFillet = bottomFillet - 0.005;
  const mercuryProfile = [new THREE.Vector2(0, 0)];
  arc(jarInnerRadius - mercuryFillet, mercuryFillet, mercuryFillet,
    -Math.PI / 2, 0, 12, mercuryProfile);
  mercuryProfile.push(
    new THREE.Vector2(jarInnerRadius, referenceFillHeight),
    new THREE.Vector2(0, referenceFillHeight),
  );
  const mercuryColumn = new THREE.Mesh(
    new THREE.LatheGeometry(mercuryProfile, 96),
    mercuryMaterial,
  );
  mercuryColumn.position.y = -mercuryBottomLocal;
  mercuryColumn.frustumCulled = false;
  mercuryColumn.renderOrder = 1;
  mercuryColumn.userData.role = 'constant-mass-expanding-mercury-column';
  let mercuryTopHeight = referenceFillHeight;
  const setMercuryHeight = (height) => {
    const position = mercuryColumn.geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      if (Math.abs(position.getY(i) - mercuryTopHeight) < 1e-6) {
        position.setY(i, height);
      }
    }
    position.needsUpdate = true;
    mercuryTopHeight = height;
    mercuryColumn.userData.topHeight = height;
  };
  const mercurySurface = cylinderAlongY(
    jarInnerRadius,
    0.055,
    whiteMaterial,
    64,
  );
  mercurySurface.renderOrder = 2;
  mercurySurface.userData.role = 'white-mercury-level-motion-index';
  const mercuryMeniscus = torusAroundY(
    jarInnerRadius * 0.95,
    0.040,
    darkMaterial,
    64,
  );
  mercuryMeniscus.renderOrder = 2;
  mercuryMeniscus.userData.role = 'mercury-meniscus-rim';
  // Brown's ink edge of the glass/mercury only: kept, not drawn.
  mercuryMeniscus.visible = false;
  mercuryMeniscus.userData.retiredInkOutline = true;

  // p104: Brown's inverted-U cap: a flat stirrup (one 2D extrusion 0.60
  // deep) whose chamfered top spans the mouth, with a plug into the neck and
  // a leg outside it on each side, the neck's lip seated in the groove
  // between them. A round boss through its middle carries the threaded
  // bore for the rod. It replaces the curved straps and side-clamp boxes.
  const capBore = threadProfile.outer + 0.008;
  const capDepth = 0.60;
  const capLegOuter = 1.68;
  const capLegInner = lipRadius + 0.02;
  const capPlugHalf = neckInnerRadius - 0.02;
  const capGrooveRoof = neckTopY + 0.02;
  const capTopHalf = 1.42;
  const capChamferY = neckTopY + 0.03;
  const capBossRadius = 0.45;
  const capSlotHalf = 0.30;
  const capShapes = [-1, 1].map((side) => new THREE.Shape([
    [capSlotHalf, capTopY],
    [capTopHalf, capTopY],
    [capLegOuter, capChamferY],
    [capLegOuter, capSkirtBottomY],
    [capLegInner, capSkirtBottomY],
    [capLegInner, capGrooveRoof],
    [capPlugHalf, capGrooveRoof],
    [capPlugHalf, capPlugBottomY],
    [capSlotHalf, capPlugBottomY],
  ].map(([x, y]) => new THREE.Vector2(side * x, y))));
  const jarCap = new THREE.Mesh(
    new THREE.ExtrudeGeometry(capShapes, {
      bevelEnabled: false,
      depth: capDepth,
    }).translate(0, 0, -capDepth / 2),
    frameMaterial,
  );
  jarCap.userData.role = 'inverted-u-jar-neck-cap-stirrup';
  const capBoss = new THREE.Mesh(boredLatheGeometry([
    { radial: capBossRadius, axial: capPlugBottomY - 0.05 },
    { radial: capBossRadius, axial: capTopY + 0.05 },
  ], capBore, 72), frameMaterial);
  capBoss.userData.role = 'jar-cap-threaded-boss-on-adjusting-screw';
  // Brown blacks in the cement packing between the neck and each leg.
  const padAngle = Math.asin((capDepth / 2) / (capLegInner - 0.006));
  const neckPacking = [-1, 1].map((side) => {
    const inner = neckOuterRadius + 0.006;
    const outer = capLegInner - 0.006;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, -padAngle, padAngle, false);
    shape.absarc(0, 0, inner, padAngle, -padAngle, true);
    shape.closePath();
    const height = lipBottomY - 0.012 - (capSkirtBottomY + 0.10);
    const pad = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        bevelEnabled: false,
        curveSegments: 24,
        depth: height,
      }).rotateX(-Math.PI / 2).rotateY(side < 0 ? Math.PI : 0),
      darkMaterial,
    );
    pad.position.y = capSkirtBottomY + 0.10;
    pad.userData.role = 'cement-packing-between-jar-neck-and-cap-leg';
    return pad;
  });
  const shoulderHangers = [];
  // The two side screws through the legs that bear on the packing.
  const sideClamps = [-1, 1].map((side) => {
    const nut = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.34, 0.34),
      darkMaterial,
    );
    nut.position.set(side * (capLegOuter - 0.005 + 0.07), clampScrewY, 0);
    nut.userData.role = 'glass-jar-side-clamp';
    return nut;
  });
  const clampPins = [-1, 1].map((side) => {
    const shank = cylinderAlongX(0.075, 0.56, darkMaterial, 24);
    shank.position.set(side * (capLegInner - 0.04 + 0.28), clampScrewY, 0);
    shank.userData.role = 'jar-clamp-fastener';
    return shank;
  });
  // Brown's small screw in the cap top beside the rod.
  const capScrewHead = cylinderAlongY(0.12, 0.09, frameMaterial, 32);
  capScrewHead.position.set(-0.52, capTopY + 0.04, 0);
  capScrewHead.userData.role = 'jar-cap-top-screw-head';

  // p104: Brown's handle: a square block pinned to the rod, a tapered round
  // arm ending in a ball on the left and, on the right, an arm carrying a
  // vertical index plate (it was a symmetric bar with two balls).
  const blockHalf = handleBlockSize / 2;
  const blockShape = new THREE.Shape([
    [-blockHalf, -blockHalf], [blockHalf, -blockHalf],
    [blockHalf, blockHalf], [-blockHalf, blockHalf],
  ].map(([x, y]) => new THREE.Vector2(x, y)));
  const blockBore = new THREE.Path();
  blockBore.absarc(0, 0, rodRadius + 0.002, 0, FULL_TURN, true);
  blockShape.holes.push(blockBore);
  const adjusterBlock = new THREE.Mesh(
    new THREE.ExtrudeGeometry(blockShape, {
      bevelEnabled: false,
      curveSegments: 40,
      depth: handleBlockSize,
    }).translate(0, 0, -blockHalf).rotateX(-Math.PI / 2),
    driverMaterial,
  );
  adjusterBlock.position.y = handleY;
  adjusterBlock.userData.role = 'threaded-jar-height-adjuster-block';
  // Brown's pin through the block into the rod: its two visible ends.
  const pinLength = blockHalf + 0.02 - (rodRadius + 0.002);
  const blockPin = new THREE.Mesh(
    mergeGeometries([-1, 1].map((side) => new THREE.CylinderGeometry(
      0.07, 0.07, pinLength, 24,
    ).rotateX(Math.PI / 2).translate(0, 0,
      side * (rodRadius + 0.002 + pinLength / 2)))),
    darkMaterial,
  );
  blockPin.position.y = handleY;
  blockPin.userData.role = 'adjuster-block-cross-pin';
  const armStart = handleBlockSize / 2 - 0.06;
  const leftArmProfile = [new THREE.Vector2(0, 0)];
  for (let i = 0; i <= 16; i += 1) {
    const a = 0.62 * i / 16;
    leftArmProfile.push(new THREE.Vector2(
      0.09 + 0.15 * (0.5 + 0.5 * Math.cos(Math.PI * a / 0.62)), a));
  }
  const ballRadius = 0.22;
  const ballOffset = Math.sqrt(ballRadius ** 2 - 0.09 ** 2);
  const ballStart = Math.asin(0.09 / ballRadius);
  for (let i = 1; i <= 24; i += 1) {
    const psi = ballStart + (Math.PI - ballStart) * i / 24;
    leftArmProfile.push(new THREE.Vector2(
      i === 24 ? 0 : ballRadius * Math.sin(psi),
      0.62 + ballOffset - ballRadius * Math.cos(psi),
    ));
  }
  const leftArm = new THREE.LatheGeometry(leftArmProfile, 40)
    .rotateZ(Math.PI / 2).translate(-armStart, handleY, 0);
  const indexPlateInner = 1.60;
  const rightArmProfile = [new THREE.Vector2(0, 0)];
  for (let i = 0; i <= 12; i += 1) {
    const a = 0.55 * i / 12;
    rightArmProfile.push(new THREE.Vector2(
      0.12 + 0.11 * (0.5 + 0.5 * Math.cos(Math.PI * a / 0.55)), a));
  }
  const rightArmLength = indexPlateInner + 0.02 - armStart;
  rightArmProfile.push(
    new THREE.Vector2(0.12, rightArmLength),
    new THREE.Vector2(0, rightArmLength),
  );
  const rightArm = new THREE.LatheGeometry(rightArmProfile, 40)
    .rotateZ(-Math.PI / 2).translate(armStart, handleY, 0);
  const indexPlateTop = handleY + 0.24;
  const indexPlateBottom = plateY(128);
  const indexPlate = new RoundedBoxGeometry(
    0.07, indexPlateTop - indexPlateBottom, 0.56, 3, 0.025,
  ).translate(indexPlateInner + 0.035, (indexPlateTop + indexPlateBottom) / 2, 0);
  // The lathes' normals were smoothed round their square shoulders and
  // ends; weld and crease them so only the turned curves shade smoothly.
  const handleGeometry = mergeGeometries([leftArm, rightArm, indexPlate]
    .map((g) => (g.index ? g.toNonIndexed() : g)));
  handleGeometry.deleteAttribute('normal');
  handleGeometry.deleteAttribute('uv');
  const adjusterHandle = new THREE.Mesh(
    creaseIndexedNormals(mergeVertices(handleGeometry, 1e-5), Math.PI * 2 / 9),
    driverMaterial,
  );
  adjusterHandle.userData.role = 'jar-adjustment-cross-handle';
  jarAssembly.add(
    mercuryColumn,
    mercurySurface,
    mercuryMeniscus,
    glassJar,
    ...jarRims,
    jarCap,
    capBoss,
    ...neckPacking,
    capScrewHead,
    threadHelix,
    adjusterBlock,
    blockPin,
    adjusterHandle,
    ...sideClamps,
    ...clampPins,
  );

  const compensationDatumRing = torusAroundY(
    jarOuterRadius + 0.12,
    0.035,
    matte(PALETTE.white, {
      opacity: 0.76,
      roughness: 0.50,
      transparent: true,
    }),
    72,
  );
  compensationDatumRing.position.y = -referenceEffectiveLength;
  compensationDatumRing.userData.nonPhysicalReference = true;
  compensationDatumRing.userData.role =
    'nonphysical-fixed-center-of-oscillation-datum-ring';
  const centerOfOscillationMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 24, 16),
    whiteMaterial,
  );
  centerOfOscillationMarker.position.y = -referenceEffectiveLength;
  centerOfOscillationMarker.userData.nonPhysicalReference = true;
  centerOfOscillationMarker.userData.role =
    'white-fixed-center-of-oscillation-marker';

  pendulumCarrier.add(
    movingPivotHub,
    rod,
    rodIndex,
    jarAssembly,
    compensationDatumRing,
    centerOfOscillationMarker,
  );
  root.add(fixedFrame, pendulumCarrier);

  const update = (time) => {
    const state = stateAtTime(time);
    pendulumCarrier.rotation.z = state.swingAngle;
    rod.scale.y = state.massProperties.rodLength - 0.25;
    rod.position.y = -(state.massProperties.rodLength + 0.25) / 2;
    rodIndex.position.y = -1.02
      * state.massProperties.rodLength / referenceRodLength;
    jarAssembly.position.y = -state.massProperties.jarCenterDistance;
    setMercuryHeight(state.fillHeight);
    mercurySurface.position.y = state.massProperties.jarCenterDistance
      - state.mercuryTopDistance;
    mercuryMeniscus.position.y = mercurySurface.position.y;
    root.userData.compensationState = {
      centerOfOscillationError: state.centerOfOscillationError,
      effectiveLength: state.centerOfOscillationDistance,
      fillHeight: state.fillHeight,
      rodExtension: state.rodExtension,
      temperature: state.temperature,
    };
    root.userData.renderState = state;
  };

  const sourcePointToNeutralFront = (point) => new THREE.Vector3(
    (point.x - sourceRasterSuspension.x) * sourceScale,
    pivot.y - (point.y - sourceRasterSuspension.y) * sourceScale,
    0,
  );

  root.userData.archetype =
    'mercurial-compensation-pendulum-constant-center-of-oscillation';
  root.userData.blocks = {
    adjusterBlock,
    adjusterHandle,
    blockPin,
    capBoss,
    capScrewHead,
    centerOfOscillationMarker,
    ceilingPlate,
    clampPins,
    compensationDatumRing,
    fixedFrame,
    fixedPivotShaft,
    glassJar,
    jarAssembly,
    jarCap,
    jarRims,
    mercuryColumn,
    mercuryMeniscus,
    mercurySurface,
    movingPivotHub,
    neckPacking,
    pendulumCarrier,
    rod,
    rodIndex,
    shoulderHangers,
    sideClamps,
    threadHelix,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-4.35, -5.30, -2.15),
    new THREE.Vector3(4.35, 5.62, 2.15),
  );
  root.userData.canonicalTimes = {
    cold: thermalCyclePeriod * 0.75,
    cycleClosure: thermalCyclePeriod,
    hot: thermalCyclePeriod * 0.25,
    neutralCooling: thermalCyclePeriod * 0.50,
    neutralHeating: 0,
  };
  root.userData.fillStateAtRodExtension = fillStateAtRodExtension;
  root.userData.geometry = {
    jarInnerRadius,
    jarLength,
    jarOuterRadius,
    maximumRodExtension,
    nominalTemperature,
    pivot: pivot.clone(),
    referenceEffectiveLength,
    referenceFillHeight,
    referenceJarCenterDistance,
    referenceMercuryBottomDistance,
    referenceRodLength,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    swingAmplitude,
    swingAngularFrequency,
    swingPeriod,
    temperatureAmplitude,
    thermalAngularFrequency,
    thermalCyclePeriod,
  };
  root.userData.groundFloorY = -5.30;
  root.userData.massModel = {
    glassJar: {
      intrinsicRadiusOfGyrationSquared:
        jarIntrinsicRadiusOfGyrationSquared,
      mass: jarMass,
    },
    mercury: {
      constantMass: true,
      mass: mercuryMass,
      referenceVolume: Math.PI * jarInnerRadius ** 2
        * referenceFillHeight,
    },
    reference: referenceMassProperties,
    rod: {
      mass: rodMass,
      model: 'uniform-slender-rod-about-upper-pivot',
    },
    totalMass,
  };
  root.userData.massProperties = massProperties;
  root.userData.mechanism =
    'a glass-jar mercury bob moves downward as its steel pendulum rod expands, while the constant mercury mass expands upward inside the jar by the calibrated amount that keeps I divided by total first moment—and therefore the center of oscillation—constant';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'Brown supplies the threaded central rod, cross-handle adjuster, two-sided jar hanger, glass vessel, mercury level, and immersed rod. The thermal amplitude, masses, material coefficients, depth, and operating cadence are not dimensioned.',
    sourceUrl: 'https://507movements.com/mm_316.html',
  };
  root.userData.sourcePointToNeutralFront = sourcePointToNeutralFront;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    brownPlate316: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one suspended steel rod, one threaded adjuster and cross-handle, one two-sided hanger, one glass jar bob, and one constant mercury charge',
      measurementUncertaintyPixels: 10,
      rasterAdjusterCenter: sourceRasterAdjusterCenter.clone(),
      rasterJarBottom: sourceRasterJarBottom.clone(),
      rasterJarLeft: sourceRasterJarLeft.clone(),
      rasterJarRight: sourceRasterJarRight.clone(),
      rasterJarTop: sourceRasterJarTop.clone(),
      rasterLeftClamp: sourceRasterLeftClamp.clone(),
      rasterMercuryBottom: sourceRasterMercuryBottom.clone(),
      rasterMercuryTop: sourceRasterMercuryTop.clone(),
      rasterRightClamp: sourceRasterRightClamp.clone(),
      rasterRodEnd: sourceRasterRodEnd.clone(),
      rasterSuspension: sourceRasterSuspension.clone(),
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: thermalCyclePeriod,
    schedule: [
      'neutral-rod-and-reference-mercury-level',
      'warming-elongates-rod-and-lowers-glass-jar',
      'mercury-expansion-raises-fluid-level-and-aggregate-center',
      'center-of-oscillation-remains-at-fixed-effective-length',
      'cooling-contracts-rod-and-lowers-mercury-relative-to-jar',
      'pendulum-completes-two-visible-swings-per-thermal-cycle',
    ],
  };
  root.userData.transmission = {
    compensationTarget: 'constant physical-pendulum effective length I/(M d)',
    glassJarThermalTravelPerRodExtension: 1,
    mercuryMassConstant: true,
    output: 'temperature-compensated pendulum oscillation',
    thermalInput: 'exaggerated cyclic temperature applied to steel rod and mercury',
  };

  correctCompensationJournals(root, movement.id);
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
  for (const object of [
    compensationDatumRing,
    centerOfOscillationMarker,
    glassJar,
    mercuryMeniscus,
    mercurySurface,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';

  return {
    cameraDirection: new THREE.Vector3(1.2, .6, 16),
    root,
    update,
  };
}

function compoundBarCompensationPendulum(movement) {
  const root = new THREE.Group();

  // Brown crops the suspension above the plate: the visible vertical rod
  // begins at the top edge, but it is not a pivot.  The extra upper length is
  // therefore explicit instead of silently treating the crop as the bearing.
  // Plate distances determine the neutral proportions.  The thermal strain
  // is magnified for legibility; at every temperature the required end-weight
  // height is solved from I/Q, rather than prescribed as decorative motion.
  const sourceImageWidth = 525;
  const sourceImageHeight = 525;
  const sourceRasterVisibleRodTop = new THREE.Vector2(265, 15);
  const sourceRasterBarCenter = new THREE.Vector2(265, 200);
  const sourceRasterLeftWeightCenter = new THREE.Vector2(60, 177);
  const sourceRasterRightWeightCenter = new THREE.Vector2(464, 177);
  const sourceRasterMainBobTopLeft = new THREE.Vector2(169, 214);
  const sourceRasterMainBobBottomRight = new THREE.Vector2(360, 460);
  const sourceRasterRodEnd = new THREE.Vector2(264, 520);
  const sourceRasterLeftBarTip = new THREE.Vector2(11, 164);
  const sourceRasterRightBarTip = new THREE.Vector2(516, 164);

  const pivot = new THREE.Vector3(0, 5.20, 0);
  const mainBobHeight = 4.45;
  const sourceScale = mainBobHeight / (
    sourceRasterMainBobBottomRight.y - sourceRasterMainBobTopLeft.y
  );
  const unshownUpperRodLength = 3.20;
  const sourceDistanceFromPivot = (rasterY) => (
    unshownUpperRodLength
      + (rasterY - sourceRasterVisibleRodTop.y) * sourceScale
  );
  const referenceRodLength = sourceDistanceFromPivot(
    sourceRasterRodEnd.y,
  );
  const referenceBarCenterDistance = sourceDistanceFromPivot(
    sourceRasterBarCenter.y,
  );
  const referenceMainBobCenterDistance = sourceDistanceFromPivot(
    (sourceRasterMainBobTopLeft.y
      + sourceRasterMainBobBottomRight.y) / 2,
  );
  const referenceWeightDistance = sourceDistanceFromPivot(
    (sourceRasterLeftWeightCenter.y
      + sourceRasterRightWeightCenter.y) / 2,
  );
  const barHalfSpan = (
    sourceRasterRightWeightCenter.x - sourceRasterLeftWeightCenter.x
  ) * sourceScale / 2;
  const referenceBarEndLift = referenceBarCenterDistance
    - referenceWeightDistance;
  const mainBobWidth = (
    sourceRasterMainBobBottomRight.x - sourceRasterMainBobTopLeft.x
  ) * sourceScale;
  const mainBobDepth = 0.86;
  const weightWidth = 1.16;
  const weightHeight = 1.01;
  const weightDepth = 0.80;
  const mainBobIntrinsicRadiusOfGyrationSquared = (
    mainBobWidth ** 2 + mainBobHeight ** 2
  ) / 12;
  const weightIntrinsicRadiusOfGyrationSquared = (
    weightWidth ** 2 + weightHeight ** 2
  ) / 12;

  const rodMass = 0.60;
  const mainBobMass = 8.00;
  const eachWeightMass = 1.40;
  const totalMass = rodMass + mainBobMass + 2 * eachWeightMass;
  const maximumRodExtension = 0.04;
  const nominalTemperature = 20;
  const temperatureAmplitude = 30;
  const thermalCyclePeriod = 4;
  const thermalAngularFrequency = FULL_TURN / thermalCyclePeriod;
  const swingPeriod = thermalCyclePeriod / 2;
  const swingAngularFrequency = FULL_TURN / swingPeriod;
  const swingAmplitude = THREE.MathUtils.degToRad(13);

  const massProperties = (rodExtension, weightDistance) => {
    const rodLength = referenceRodLength + rodExtension;
    const mainBobCenterDistance = referenceMainBobCenterDistance
      + rodExtension;
    const rodFirstMoment = rodMass * rodLength / 2;
    const mainBobFirstMoment = mainBobMass * mainBobCenterDistance;
    const weightsFirstMoment = 2 * eachWeightMass * weightDistance;
    const firstMoment = rodFirstMoment + mainBobFirstMoment
      + weightsFirstMoment;
    const rodInertia = rodMass * rodLength ** 2 / 3;
    const mainBobInertia = mainBobMass * (
      mainBobCenterDistance ** 2
        + mainBobIntrinsicRadiusOfGyrationSquared
    );
    const weightsInertia = 2 * eachWeightMass * (
      barHalfSpan ** 2 + weightDistance ** 2
        + weightIntrinsicRadiusOfGyrationSquared
    );
    const inertia = rodInertia + mainBobInertia + weightsInertia;
    return {
      centerOfMassDistance: firstMoment / totalMass,
      effectiveLength: inertia / firstMoment,
      firstMoment,
      inertia,
      mainBobCenterDistance,
      mainBobFirstMoment,
      mainBobInertia,
      rodFirstMoment,
      rodInertia,
      rodLength,
      totalMass,
      weightDistance,
      weightsFirstMoment,
      weightsInertia,
    };
  };

  const referenceMassProperties = massProperties(
    0,
    referenceWeightDistance,
  );
  const referenceEffectiveLength =
    referenceMassProperties.effectiveLength;

  const weightStateAtRodExtension = (rodExtension) => {
    const rodLength = referenceRodLength + rodExtension;
    const mainBobCenterDistance = referenceMainBobCenterDistance
      + rodExtension;
    const otherFirstMoment = rodMass * rodLength / 2
      + mainBobMass * mainBobCenterDistance;
    const otherInertia = rodMass * rodLength ** 2 / 3
      + mainBobMass * (
        mainBobCenterDistance ** 2
          + mainBobIntrinsicRadiusOfGyrationSquared
      );
    const quadraticA = 2 * eachWeightMass;
    const quadraticB = -2 * eachWeightMass
      * referenceEffectiveLength;
    const quadraticC = otherInertia + 2 * eachWeightMass * (
      barHalfSpan ** 2 + weightIntrinsicRadiusOfGyrationSquared
    ) - referenceEffectiveLength * otherFirstMoment;
    const discriminant = quadraticB ** 2
      - 4 * quadraticA * quadraticC;
    const squareRoot = Math.sqrt(Math.max(0, discriminant));
    const lowerRoot = (-quadraticB - squareRoot)
      / (2 * quadraticA);
    const upperRoot = (-quadraticB + squareRoot)
      / (2 * quadraticA);

    // Brown's weights lie on the lower, long-radius branch.  The other root
    // is the mathematically valid but physically different short pendulum.
    const weightDistance = upperRoot;
    const partialWeight = 2 * eachWeightMass * (
      2 * weightDistance - referenceEffectiveLength
    );
    const partialExtension = 2 * rodMass * rodLength / 3
      + 2 * mainBobMass * mainBobCenterDistance
      - referenceEffectiveLength * (rodMass / 2 + mainBobMass);
    const weightDistanceDerivative = -partialExtension / partialWeight;
    const partialExtensionExtension = 2 * rodMass / 3
      + 2 * mainBobMass;
    const partialWeightWeight = 4 * eachWeightMass;
    const weightDistanceSecondDerivative = -(
      partialExtensionExtension
        + partialWeightWeight * weightDistanceDerivative ** 2
    ) / partialWeight;
    const barCenterDistance = referenceBarCenterDistance + rodExtension;
    const barEndLift = barCenterDistance - weightDistance;

    return {
      barCenterDistance,
      barEndLift,
      barEndLiftDerivative: 1 - weightDistanceDerivative,
      barEndLiftSecondDerivative: -weightDistanceSecondDerivative,
      discriminant,
      lowerRoot,
      quadraticA,
      quadraticB,
      quadraticC,
      upperRoot,
      weightDistance,
      weightDistanceDerivative,
      weightDistanceSecondDerivative,
    };
  };

  const pointKinematics = ({
    distance,
    distanceAcceleration = 0,
    distanceVelocity = 0,
    horizontal = 0,
    swingAngle,
    swingAngularAcceleration,
    swingAngularVelocity,
  }) => {
    const rotation = new THREE.Quaternion().setFromAxisAngle(
      Z_AXIS,
      swingAngle,
    );
    const localPosition = new THREE.Vector3(horizontal, -distance, 0);
    const localVelocity = new THREE.Vector3(0, -distanceVelocity, 0);
    const localAcceleration = new THREE.Vector3(
      0,
      -distanceAcceleration,
      0,
    );
    const angularVelocity = new THREE.Vector3(
      0,
      0,
      swingAngularVelocity,
    );
    const angularAcceleration = new THREE.Vector3(
      0,
      0,
      swingAngularAcceleration,
    );
    const velocity = localVelocity.clone()
      .add(angularVelocity.clone().cross(localPosition))
      .applyQuaternion(rotation);
    const acceleration = localAcceleration.clone()
      .add(angularAcceleration.clone().cross(localPosition))
      .add(angularVelocity.clone().cross(localVelocity)
        .multiplyScalar(2))
      .add(angularVelocity.clone().cross(
        angularVelocity.clone().cross(localPosition),
      ))
      .applyQuaternion(rotation);
    const position = localPosition.applyQuaternion(rotation).add(pivot);
    return { acceleration, position, velocity };
  };

  const stateAtTime = (time) => {
    const unwrappedThermalAngle = thermalAngularFrequency * time;
    const thermalAngle = positiveModulo(unwrappedThermalAngle, FULL_TURN);
    const temperatureCoordinate = Math.sin(thermalAngle);
    const temperatureCoordinateVelocity = thermalAngularFrequency
      * Math.cos(thermalAngle);
    const temperatureCoordinateAcceleration = -(thermalAngularFrequency ** 2)
      * Math.sin(thermalAngle);
    const rodExtension = maximumRodExtension * temperatureCoordinate;
    const rodExtensionVelocity = maximumRodExtension
      * temperatureCoordinateVelocity;
    const rodExtensionAcceleration = maximumRodExtension
      * temperatureCoordinateAcceleration;
    const weightState = weightStateAtRodExtension(rodExtension);
    const weightDistanceVelocity = weightState.weightDistanceDerivative
      * rodExtensionVelocity;
    const weightDistanceAcceleration =
      weightState.weightDistanceSecondDerivative
        * rodExtensionVelocity ** 2
      + weightState.weightDistanceDerivative * rodExtensionAcceleration;
    const barEndLiftVelocity = weightState.barEndLiftDerivative
      * rodExtensionVelocity;
    const barEndLiftAcceleration = weightState.barEndLiftSecondDerivative
      * rodExtensionVelocity ** 2
      + weightState.barEndLiftDerivative * rodExtensionAcceleration;
    const properties = massProperties(
      rodExtension,
      weightState.weightDistance,
    );

    const swingArgument = swingAngularFrequency * time;
    const swingAngle = swingAmplitude * Math.sin(swingArgument);
    const swingAngularVelocity = swingAmplitude * swingAngularFrequency
      * Math.cos(swingArgument);
    const swingAngularAcceleration = -swingAmplitude
      * swingAngularFrequency ** 2 * Math.sin(swingArgument);
    const commonPointArguments = {
      swingAngle,
      swingAngularAcceleration,
      swingAngularVelocity,
    };
    const rodEnd = pointKinematics({
      ...commonPointArguments,
      distance: properties.rodLength,
      distanceAcceleration: rodExtensionAcceleration,
      distanceVelocity: rodExtensionVelocity,
    });
    const mainBobCenter = pointKinematics({
      ...commonPointArguments,
      distance: properties.mainBobCenterDistance,
      distanceAcceleration: rodExtensionAcceleration,
      distanceVelocity: rodExtensionVelocity,
    });
    const barCenter = pointKinematics({
      ...commonPointArguments,
      distance: weightState.barCenterDistance,
      distanceAcceleration: rodExtensionAcceleration,
      distanceVelocity: rodExtensionVelocity,
    });
    const leftWeight = pointKinematics({
      ...commonPointArguments,
      distance: weightState.weightDistance,
      distanceAcceleration: weightDistanceAcceleration,
      distanceVelocity: weightDistanceVelocity,
      horizontal: -barHalfSpan,
    });
    const rightWeight = pointKinematics({
      ...commonPointArguments,
      distance: weightState.weightDistance,
      distanceAcceleration: weightDistanceAcceleration,
      distanceVelocity: weightDistanceVelocity,
      horizontal: barHalfSpan,
    });
    const centerOfMassDistanceDerivative = (
      rodMass / 2 + mainBobMass
        + 2 * eachWeightMass
          * weightState.weightDistanceDerivative
    ) / totalMass;
    const centerOfMassDistanceSecondDerivative = (
      2 * eachWeightMass
        * weightState.weightDistanceSecondDerivative
    ) / totalMass;
    const centerOfMassDistanceVelocity =
      centerOfMassDistanceDerivative * rodExtensionVelocity;
    const centerOfMassDistanceAcceleration =
      centerOfMassDistanceSecondDerivative * rodExtensionVelocity ** 2
        + centerOfMassDistanceDerivative * rodExtensionAcceleration;
    const centerOfMass = pointKinematics({
      ...commonPointArguments,
      distance: properties.centerOfMassDistance,
      distanceAcceleration: centerOfMassDistanceAcceleration,
      distanceVelocity: centerOfMassDistanceVelocity,
    });
    const centerOfOscillation = pointKinematics({
      ...commonPointArguments,
      distance: referenceEffectiveLength,
    });
    const pendulumQuaternion = new THREE.Quaternion().setFromAxisAngle(
      Z_AXIS,
      swingAngle,
    );

    const barPointAtNormalizedX = (normalizedX) => {
      const normalizedSquared = normalizedX ** 2;
      const distance = weightState.barCenterDistance
        - weightState.barEndLift * normalizedSquared;
      const distanceVelocity = rodExtensionVelocity
        - barEndLiftVelocity * normalizedSquared;
      const distanceAcceleration = rodExtensionAcceleration
        - barEndLiftAcceleration * normalizedSquared;
      const localSlope = 2 * weightState.barEndLift
        * normalizedX / barHalfSpan;
      const localSlopeVelocity = 2 * barEndLiftVelocity
        * normalizedX / barHalfSpan;
      const localSlopeAcceleration = 2 * barEndLiftAcceleration
        * normalizedX / barHalfSpan;
      const tangentAngle = Math.atan(localSlope);
      const tangentAngularVelocity = localSlopeVelocity
        / (1 + localSlope ** 2);
      const tangentAngularAcceleration = localSlopeAcceleration
          / (1 + localSlope ** 2)
        - 2 * localSlope * localSlopeVelocity ** 2
          / (1 + localSlope ** 2) ** 2;
      return {
        ...pointKinematics({
          ...commonPointArguments,
          distance,
          distanceAcceleration,
          distanceVelocity,
          horizontal: normalizedX * barHalfSpan,
        }),
        distance,
        distanceAcceleration,
        distanceVelocity,
        localSlope,
        tangentAngle,
        tangentAngularAcceleration,
        tangentAngularVelocity,
        worldTangentAngle: swingAngle + tangentAngle,
      };
    };

    return {
      barCenter,
      barCenterDistance: weightState.barCenterDistance,
      barEndLift: weightState.barEndLift,
      barEndLiftAcceleration,
      barEndLiftVelocity,
      barPointAtNormalizedX,
      centerOfMass,
      centerOfMassDistance: properties.centerOfMassDistance,
      centerOfMassDistanceAcceleration,
      centerOfMassDistanceDerivative,
      centerOfMassDistanceSecondDerivative,
      centerOfMassDistanceVelocity,
      centerOfOscillation,
      centerOfOscillationDistance: properties.effectiveLength,
      centerOfOscillationError: properties.effectiveLength
        - referenceEffectiveLength,
      cycleIndex: Math.floor(unwrappedThermalAngle / FULL_TURN),
      cyclePhase: thermalAngle / FULL_TURN,
      leftWeight,
      massProperties: properties,
      mainBobCenter,
      pendulumQuaternion,
      rightWeight,
      rodEnd,
      rodExtension,
      rodExtensionAcceleration,
      rodExtensionVelocity,
      swingAngle,
      swingAngularAcceleration,
      swingAngularVelocity,
      temperature: nominalTemperature
        + temperatureAmplitude * temperatureCoordinate,
      temperatureCoordinate,
      temperatureCoordinateAcceleration,
      temperatureCoordinateVelocity,
      temperatureState: temperatureCoordinate > 0.02
        ? 'hot-bar-curved-upward'
        : temperatureCoordinate < -0.02
          ? 'cold-bar-relaxed-downward'
          : 'neutral',
      thermalAngle,
      unwrappedThermalAngle,
      weightDistance: weightState.weightDistance,
      weightDistanceAcceleration,
      weightDistanceVelocity,
      weightState,
    };
  };

  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.62,
  });
  const steelMaterial = matte(PALETTE.ink, {
    metalness: 0.34,
    roughness: 0.42,
  });
  const brassMaterial = matte(PALETTE.brass, {
    metalness: 0.30,
    roughness: 0.46,
  });
  const bobMaterial = matte(PALETTE.driver, {
    metalness: 0.12,
    roughness: 0.58,
  });
  const weightMaterial = matte(PALETTE.driven, {
    metalness: 0.20,
    roughness: 0.52,
  });
  const whiteMaterial = matte(PALETTE.white, {
    metalness: 0.02,
    roughness: 0.45,
  });

  const fixedFrame = new THREE.Group();
  fixedFrame.userData.role = 'fixed-compound-pendulum-suspension-frame';
  const ceilingPlate = new THREE.Mesh(
    new THREE.BoxGeometry(2.15, 0.26, 1.25),
    frameMaterial,
  );
  ceilingPlate.position.set(0, 5.62, 0);
  ceilingPlate.userData.role = 'fixed-upper-suspension-plate';
  const pivotBrackets = [-0.47, 0.47].map((x) => {
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.68, 0.38),
      frameMaterial,
    );
    bracket.position.set(x, 5.30, 0);
    bracket.userData.role = 'fixed-pendulum-pivot-bracket';
    return bracket;
  });
  const fixedPivotShaft = cylinderAlongZ(0.17, 1.20, steelMaterial, 36);
  fixedPivotShaft.position.copy(pivot);
  fixedPivotShaft.userData.role = 'fixed-horizontal-pendulum-pivot';
  fixedFrame.add(ceilingPlate, ...pivotBrackets, fixedPivotShaft);

  const pendulumCarrier = new THREE.Group();
  pendulumCarrier.position.copy(pivot);
  pendulumCarrier.userData.axis = Z_AXIS.clone();
  pendulumCarrier.userData.role = 'compound-bar-compensated-pendulum';
  const movingPivotHub = cylinderAlongZ(0.28, 0.72, bobMaterial, 36);
  movingPivotHub.userData.role = 'moving-pendulum-pivot-hub';
  // p104: Brown's broad flat rod flaring through two tangent concave arcs
  // into C, brazed on the bar, as one flat extrusion on the mechanism plane
  // (it was a thin wire off-plane at z = -0.16 meeting a small cube).
  const layerThickness = 0.135;
  const rodTopBelowPivot = 0.25;
  const rodHalfWidth = 0.20;
  const rodDepth = 0.30;
  const collarHalfWidth = 0.29;
  const collarHeight = 0.30;
  const flareToe = 1.07;
  const referenceBarTopDistance = referenceBarCenterDistance - layerThickness;
  const rodShape = (() => {
    const top = 0;
    const barTop = rodTopBelowPivot - referenceBarTopDistance;
    const liftAt = (x, lift) => lift * (x / barHalfSpan) ** 2;
    const minimumLift = Math.min(
      weightStateAtRodExtension(maximumRodExtension).barEndLift,
      weightStateAtRodExtension(-maximumRodExtension).barEndLift,
      referenceBarEndLift,
    );
    const collarTop = barTop + collarHeight;
    const toeY = barTop + liftAt(flareToe, minimumLift) - 0.008;
    const embed = barTop - 0.03;
    const a = flareToe - collarHalfWidth;
    const b = collarTop - toeY;
    const right = [[rodHalfWidth, top], [rodHalfWidth, collarTop],
      [collarHalfWidth, collarTop]];
    for (let i = 1; i <= 40; i += 1) {
      const theta = Math.PI + (Math.PI / 2) * i / 40;
      right.push([collarHalfWidth + a + a * Math.cos(theta),
        collarTop + b * Math.sin(theta)]);
    }
    right.push([flareToe, embed]);
    const outline = [...right, ...right.slice().reverse().map(([x, y]) => [-x, y])];
    return new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  })();
  const rod = new THREE.Mesh(
    new THREE.ExtrudeGeometry(rodShape, {
      bevelEnabled: false,
      curveSegments: 1,
      depth: rodDepth,
    }).translate(0, 0, -rodDepth / 2),
    frameMaterial,
  );
  rod.position.y = -rodTopBelowPivot;
  rod.userData.role = 'thermally-expanding-steel-pendulum-rod';

  const mainBobShape = new THREE.Shape();
  const halfBobWidth = mainBobWidth / 2;
  const halfBobHeight = mainBobHeight / 2;
  const shoulderRadius = 0.52;
  mainBobShape.moveTo(-halfBobWidth, -halfBobHeight);
  mainBobShape.lineTo(halfBobWidth, -halfBobHeight);
  mainBobShape.lineTo(halfBobWidth, halfBobHeight - shoulderRadius);
  mainBobShape.quadraticCurveTo(
    halfBobWidth,
    halfBobHeight,
    halfBobWidth - shoulderRadius,
    halfBobHeight,
  );
  mainBobShape.lineTo(-halfBobWidth + shoulderRadius, halfBobHeight);
  mainBobShape.quadraticCurveTo(
    -halfBobWidth,
    halfBobHeight,
    -halfBobWidth,
    halfBobHeight - shoulderRadius,
  );
  mainBobShape.closePath();
  const mainBobGeometry = new THREE.ExtrudeGeometry(mainBobShape, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.08,
    bevelThickness: 0.06,
    curveSegments: 18,
    depth: mainBobDepth,
    steps: 1,
  });
  mainBobGeometry.translate(0, 0, -mainBobDepth / 2);
  const mainBob = new THREE.Mesh(mainBobGeometry, bobMaterial);
  mainBob.userData.role = 'central-main-pendulum-weight-M';
  const mainBobHub = cylinderAlongZ(0.30, mainBobDepth + 0.20,
    steelMaterial, 36);
  mainBobHub.userData.role = 'main-bob-central-rod-hub';
  const mainBobWitness = torusAroundY(0.34, 0.045, whiteMaterial, 40);
  mainBobWitness.rotation.x = 0;
  mainBobWitness.rotation.z = 0;
  mainBobWitness.position.z = mainBobDepth / 2 + 0.08;
  mainBobWitness.userData.role = 'white-main-weight-motion-index';
  mainBob.add(mainBobWitness);

  // p104: the lower adjusting screw is a solid cut V thread from the shared
  // builder on a round stub, with a bored nut, all centred on z = 0.
  const lowerNutRadius = 0.40;
  const lowerNutHeight = 0.50;
  const lowerStubLength = (sourceRasterRodEnd.y
    - sourceRasterMainBobBottomRight.y) * sourceScale;
  const lowerStubRadius = 0.15;
  const lowerThreadProfile = {
    inner: lowerStubRadius - 0.005,
    outer: lowerStubRadius + 0.04,
    low: -lowerStubLength,
    high: -0.02,
    rootWidth: 0.075,
    crestWidth: 0.02,
    lead: 0.09 / FULL_TURN,
    phase: 0,
  };
  const lowerThread = new THREE.Mesh(
    mergeGeometries([
      trapezoidThread(lowerThreadProfile, 96).rotateX(-Math.PI / 2),
      new THREE.CylinderGeometry(lowerStubRadius, lowerStubRadius,
        lowerStubLength + 0.01, 40).translate(0, -(lowerStubLength - 0.01) / 2, 0)
        .toNonIndexed().deleteAttribute('uv'),
    ]),
    steelMaterial,
  );
  lowerThread.userData.role = 'visible-lower-bob-adjustment-thread';
  lowerThread.userData.threadProfile = lowerThreadProfile;
  const lowerAdjuster = new THREE.Mesh(boredLatheGeometry([
    { radial: lowerNutRadius, axial: -lowerNutHeight },
    { radial: lowerNutRadius, axial: 0.005 },
  ], lowerThreadProfile.outer + 0.006, 72), bobMaterial);
  lowerAdjuster.userData.role = 'main-bob-lower-adjusting-nut';

  const compoundBar = new THREE.Group();
  compoundBar.userData.role = 'compound-bimetallic-bar-C';
  // p104: each lamina is one bent strip running right through both W
  // weights to Brown's rounded knob ends (it was 40 boxes per layer, ending
  // inside W, with a separate stub beyond).
  const layerDepth = 1.02;
  const barTipOverhang = (sourceRasterLeftWeightCenter.x
    - sourceRasterLeftBarTip.x) * sourceScale;
  const barKnobCenter = barHalfSpan + barTipOverhang - layerThickness;
  const steelLamina = makeBentLamina({
    layer: 'iron-or-steel-upper',
    material: steelMaterial,
    role: 'upper-iron-or-steel-layer-of-compound-bar',
    sign: 1,
  });
  const brassLamina = makeBentLamina({
    layer: 'brass-lower',
    material: brassMaterial,
    role: 'lower-brass-layer-of-compound-bar',
    sign: -1,
  });
  const segmentMeshes = [{ brass: brassLamina.mesh, steel: steelLamina.mesh }];
  compoundBar.add(brassLamina.mesh, steelLamina.mesh);
  const makeEndWeight = (side) => {
    const group = new THREE.Group();
    group.userData.role = side < 0
      ? 'left-adjustable-end-weight-W'
      : 'right-adjustable-end-weight-W';
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(weightWidth, weightHeight, weightDepth),
      weightMaterial,
    );
    block.userData.role = 'adjustable-compensation-weight-W';
    const bore = cylinderAlongZ(0.16, weightDepth + 0.14,
      steelMaterial, 28);
    bore.position.y = 0.08;
    bore.userData.role = 'end-weight-bar-bore';
    const setScrew = cylinderAlongY(0.09, 0.47, brassMaterial, 24);
    setScrew.position.y = weightHeight / 2 + 0.18;
    setScrew.userData.role = 'end-weight-W-set-screw';
    const screwHead = cylinderAlongY(0.16, 0.10, brassMaterial, 24);
    screwHead.position.y = weightHeight / 2 + 0.43;
    screwHead.userData.role = 'end-weight-W-set-screw-head';
    const outerStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.72, 24),
      steelMaterial,
    );
    outerStem.rotation.z = Math.PI / 2;
    outerStem.position.x = side * (weightWidth / 2 + 0.34);
    outerStem.userData.role = 'compound-bar-projecting-end';
    const witness = new THREE.Mesh(
      new THREE.SphereGeometry(0.10, 20, 14),
      whiteMaterial,
    );
    witness.position.set(0, 0, weightDepth / 2 + 0.08);
    witness.userData.role = 'white-end-weight-motion-index';
    group.add(block, bore, setScrew, screwHead, outerStem, witness);
    return { block, bore, group, outerStem, screwHead, setScrew, witness };
  };
  const leftEndWeight = makeEndWeight(-1);
  const rightEndWeight = makeEndWeight(1);

  const centerOfOscillationMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 24, 16),
    whiteMaterial,
  );
  centerOfOscillationMarker.position.set(
    0,
    -referenceEffectiveLength,
    mainBobDepth / 2 + 0.20,
  );
  centerOfOscillationMarker.userData.nonPhysicalReference = true;
  centerOfOscillationMarker.userData.role =
    'white-fixed-center-of-oscillation-marker';
  const compensationDatum = new THREE.Mesh(
    new THREE.BoxGeometry(mainBobWidth + 0.65, 0.035, 0.035),
    whiteMaterial,
  );
  compensationDatum.position.set(
    0,
    -referenceEffectiveLength,
    mainBobDepth / 2 + 0.19,
  );
  compensationDatum.userData.nonPhysicalReference = true;
  compensationDatum.userData.role =
    'nonphysical-fixed-center-of-oscillation-datum';

  pendulumCarrier.add(
    movingPivotHub,
    rod,
    mainBob,
    mainBobHub,
    lowerThread,
    lowerAdjuster,
    compoundBar,
    leftEndWeight.group,
    rightEndWeight.group,
    compensationDatum,
    centerOfOscillationMarker,
  );
  root.add(fixedFrame, pendulumCarrier);

  const update = (time) => {
    const state = stateAtTime(time);
    pendulumCarrier.rotation.z = state.swingAngle;
    // The flat rod and C stretch with the rod's thermal extension (at most
    // 0.4%), so C stays brazed to the bar centre.
    rod.scale.y = (state.barCenterDistance - rodTopBelowPivot)
      / (referenceBarCenterDistance - rodTopBelowPivot);
    mainBob.position.y = -state.massProperties.mainBobCenterDistance;
    mainBobHub.position.y = mainBob.position.y;
    compoundBar.position.y = -state.barCenterDistance;
    const lift = state.barEndLift;
    const lamina = {
      curve: (x) => lift * (x / barHalfSpan) ** 2,
      depth: layerDepth,
      tangent: (x) => [1, 2 * lift * x / barHalfSpan ** 2],
      thickness: layerThickness,
      xEnd: barKnobCenter,
      xStart: -barKnobCenter,
    };
    steelLamina.set(lamina);
    brassLamina.set(lamina);
    const leftBarPoint = state.barPointAtNormalizedX(-1);
    const rightBarPoint = state.barPointAtNormalizedX(1);
    leftEndWeight.group.position.set(
      -barHalfSpan,
      -state.weightDistance,
      0,
    );
    leftEndWeight.group.rotation.z = leftBarPoint.tangentAngle;
    rightEndWeight.group.position.set(
      barHalfSpan,
      -state.weightDistance,
      0,
    );
    rightEndWeight.group.rotation.z = rightBarPoint.tangentAngle;
    const bobBottomDistance = state.massProperties.mainBobCenterDistance
      + mainBobHeight / 2;
    lowerAdjuster.position.y = -bobBottomDistance;
    lowerThread.position.y = -bobBottomDistance;
    root.userData.compensationState = {
      barEndLift: state.barEndLift,
      centerOfOscillationError: state.centerOfOscillationError,
      effectiveLength: state.centerOfOscillationDistance,
      rodExtension: state.rodExtension,
      temperature: state.temperature,
      weightDistance: state.weightDistance,
    };
    root.userData.renderState = state;
  };

  const sourcePointToNeutralFront = (point) => new THREE.Vector3(
    (point.x - sourceRasterVisibleRodTop.x) * sourceScale,
    pivot.y - unshownUpperRodLength
      - (point.y - sourceRasterVisibleRodTop.y) * sourceScale,
    0,
  );

  root.userData.archetype =
    'compound-bimetal-bar-constant-center-of-oscillation-pendulum';
  root.userData.blocks = {
    brassLamina: brassLamina.mesh,
    ceilingPlate,
    centerOfOscillationMarker,
    compensationDatum,
    compoundBar,
    fixedFrame,
    fixedPivotShaft,
    leftEndWeight,
    lowerAdjuster,
    lowerThread,
    mainBob,
    mainBobHub,
    mainBobWitness,
    movingPivotHub,
    pendulumCarrier,
    pivotBrackets,
    rightEndWeight,
    rod,
    segmentMeshes,
    steelLamina: steelLamina.mesh,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-5.15, -7.55, -2.10),
    new THREE.Vector3(5.15, 5.95, 2.10),
  );
  root.userData.canonicalTimes = {
    cold: thermalCyclePeriod * 0.75,
    cycleClosure: thermalCyclePeriod,
    hot: thermalCyclePeriod * 0.25,
    neutralCooling: thermalCyclePeriod * 0.50,
    neutralHeating: 0,
  };
  root.userData.geometry = {
    barHalfSpan,
    layerDepth,
    layerThickness,
    mainBobDepth,
    mainBobHeight,
    mainBobWidth,
    maximumRodExtension,
    nominalTemperature,
    pivot: pivot.clone(),
    referenceBarCenterDistance,
    referenceBarEndLift,
    referenceEffectiveLength,
    referenceMainBobCenterDistance,
    referenceRodLength,
    referenceWeightDistance,
    sourceImageHeight,
    sourceImageWidth,
    sourceScale,
    swingAmplitude,
    swingAngularFrequency,
    swingPeriod,
    temperatureAmplitude,
    thermalAngularFrequency,
    thermalCyclePeriod,
    unshownUpperRodLength,
    weightDepth,
    weightHeight,
    weightWidth,
  };
  root.userData.groundFloorY = -7.55;
  root.userData.massModel = {
    compoundBar: {
      assumption: 'negligible mass relative to M and the two W weights',
      brassLayerBelowSteel: true,
    },
    eachEndWeight: {
      count: 2,
      intrinsicRadiusOfGyrationSquared:
        weightIntrinsicRadiusOfGyrationSquared,
      mass: eachWeightMass,
    },
    mainBob: {
      intrinsicRadiusOfGyrationSquared:
        mainBobIntrinsicRadiusOfGyrationSquared,
      mass: mainBobMass,
    },
    reference: referenceMassProperties,
    rod: {
      mass: rodMass,
      model: 'uniform-slender-rod-about-unshown-upper-pivot',
    },
    totalMass,
  };
  root.userData.massProperties = massProperties;
  root.userData.mechanism =
    'the lower brass layer expands more than the upper iron-or-steel layer, bending compound bar C upward and lifting both W weights; their solved rise offsets steel-rod elongation so I divided by total first moment—and therefore the center of oscillation—remains constant';
  root.userData.sourceAnimation = {
    available: false,
    independentlyReconstructed: true,
    officialCanvasModelPresent: false,
    officialPageAnimatedTabDisabled: true,
    referenceScope: 'Brown supplies the cropped central rod, compound two-layer bar C with brass downward, symmetric adjustable weights W, central weight M, and lower adjuster. The true upper suspension, material coefficients, masses, depth, thermal magnitude, and cadence are not dimensioned.',
    sourceUrl: 'https://507movements.com/mm_317.html',
  };
  root.userData.sourcePointToNeutralFront = sourcePointToNeutralFront;
  root.userData.sourceReference = {
    officialDescription: movement.description,
    brownPlate317: {
      imageHeight: sourceImageHeight,
      imageWidth: sourceImageWidth,
      inferredTopology: 'one cropped pendulum rod, one center-fastened brass-under-steel compound bar C, two symmetric adjustable weights W, one main weight M, and one lower threaded adjuster',
      measurementUncertaintyPixels: 10,
      rasterBarCenter: sourceRasterBarCenter.clone(),
      rasterLeftBarTip: sourceRasterLeftBarTip.clone(),
      rasterLeftWeightCenter: sourceRasterLeftWeightCenter.clone(),
      rasterMainBobBottomRight:
        sourceRasterMainBobBottomRight.clone(),
      rasterMainBobTopLeft: sourceRasterMainBobTopLeft.clone(),
      rasterRightBarTip: sourceRasterRightBarTip.clone(),
      rasterRightWeightCenter: sourceRasterRightWeightCenter.clone(),
      rasterRodEnd: sourceRasterRodEnd.clone(),
      rasterVisibleRodTop: sourceRasterVisibleRodTop.clone(),
    },
    primaryScan: {
      archiveIdentifier: 'fivehundredseven00browiala',
      descriptionPage: 79,
      edition: 21,
      illustrationPage: 78,
      publicationYear: 1908,
    },
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.timeline = {
    demonstrationPeriod: thermalCyclePeriod,
    schedule: [
      'neutral-compound-bar-matches-Brown-plate',
      'warming-elongates-the-steel-pendulum-rod',
      'brass-underlayer-expands-more-and-curves-bar-C-upward',
      'both-W-weights-rise-to-hold-the-effective-length-fixed',
      'cooling-relaxes-the-bar-and-lowers-both-W-weights',
      'pendulum-completes-two-visible-swings-per-thermal-cycle',
    ],
  };
  root.userData.transmission = {
    brassLayer: 'lower high-expansion layer',
    compensationTarget: 'constant physical-pendulum effective length I/(M d)',
    ironOrSteelLayer: 'upper low-expansion layer',
    output: 'temperature-compensated pendulum oscillation',
    symmetricEndWeights: 2,
    thermalInput: 'exaggerated cyclic temperature applied to rod and bimetal bar',
  };
  root.userData.weightStateAtRodExtension = weightStateAtRodExtension;

  correctCompensationJournals(root, movement.id);
  // p104: rebuilt after the shared journal pass, which drilled M along the
  // old off-plane rod and slotted W far taller than the bar.
  {
    // Brown's M: straight sides and flat top with large tangent shoulder
    // arcs, one smooth extrusion whose top meets the bar's underside at C.
    const bevel = 0.04;
    const shoulder = 0.62;
    const half = mainBobWidth / 2 - bevel;
    const top = referenceMainBobCenterDistance - referenceBarCenterDistance
      - layerThickness - 0.003 - bevel;
    const bottom = -mainBobHeight / 2 + bevel;
    const outline = new THREE.Shape();
    outline.moveTo(-half, bottom);
    outline.lineTo(half, bottom);
    outline.lineTo(half, top - shoulder);
    outline.absarc(half - shoulder, top - shoulder, shoulder, 0, Math.PI / 2, false);
    outline.lineTo(-half + shoulder, top);
    outline.absarc(-half + shoulder, top - shoulder, shoulder, Math.PI / 2, Math.PI, false);
    outline.closePath();
    mainBob.geometry.dispose();
    mainBob.geometry = new THREE.ExtrudeGeometry(outline, {
      bevelEnabled: true,
      bevelSegments: 4,
      bevelSize: bevel,
      bevelThickness: bevel,
      curveSegments: 48,
      depth: mainBobDepth - 2 * bevel,
      steps: 1,
    }).translate(0, 0, -(mainBobDepth - 2 * bevel) / 2);
    mainBob.position.z = 0;
    // W: a block whose rectangular passage fits the two-layer bar section
    // (0.004 all round, plus the bar's worst sag across W's width).
    const maximumLift = Math.max(
      weightStateAtRodExtension(maximumRodExtension).barEndLift,
      weightStateAtRodExtension(-maximumRodExtension).barEndLift,
    );
    const sag = maximumLift / barHalfSpan ** 2 * (weightWidth / 2) ** 2;
    const passage = {
      bottom: -layerThickness - 0.004,
      halfDepth: layerDepth / 2 + 0.004,
      top: layerThickness + 0.004 + sag,
    };
    const blockHalfDepth = layerDepth / 2 + 0.09;
    for (const weight of [leftEndWeight, rightEndWeight]) {
      const shape = new THREE.Shape([
        [-blockHalfDepth, -weightHeight / 2],
        [blockHalfDepth, -weightHeight / 2],
        [blockHalfDepth, weightHeight / 2],
        [-blockHalfDepth, weightHeight / 2],
      ].map(([x, y]) => new THREE.Vector2(x, y)));
      shape.holes.push(new THREE.Path([
        [-passage.halfDepth, passage.bottom],
        [-passage.halfDepth, passage.top],
        [passage.halfDepth, passage.top],
        [passage.halfDepth, passage.bottom],
      ].map(([x, y]) => new THREE.Vector2(x, y))));
      weight.block.geometry.dispose();
      weight.block.geometry = new THREE.ExtrudeGeometry(shape, {
        bevelEnabled: false,
        depth: weightWidth,
      }).translate(0, 0, -weightWidth / 2).rotateY(Math.PI / 2);
      weight.block.userData.passage = passage;
      // The laminae now run through W to the knob; no separate stub.
      weight.group.remove(weight.outerStem);
      // Brown's set screw: a small countersunk head in W's top.
      weight.setScrew.geometry.dispose();
      weight.setScrew.geometry = new THREE.CylinderGeometry(0.07, 0.07, 0.07, 24)
        .translate(0, 0.035 - 0.005, 0);
      weight.setScrew.position.set(0, weightHeight / 2, 0);
      weight.screwHead.geometry.dispose();
      weight.screwHead.geometry = new THREE.CylinderGeometry(0.15, 0.08, 0.10, 32)
        .translate(0, 0.05, 0);
      weight.screwHead.position.set(0, weightHeight / 2 + 0.065, 0);
    }
    lowerAdjuster.geometry.dispose();
    lowerAdjuster.geometry = boredLatheGeometry([
      { radial: lowerNutRadius, axial: -lowerNutHeight },
      { radial: lowerNutRadius, axial: 0.005 },
    ], lowerThreadProfile.outer + 0.006, 72);
    lowerAdjuster.position.z = 0;
    lowerThread.position.z = 0;
  }
  root.userData.reconstructionNote = 'Swing and temperature are prescribed '
    + 'and exaggerated. The bar curvature is chosen to preserve the ideal '
    + 'compound-pendulum effective length I/Q; it is not calculated from real '
    + 'steel/brass expansion or bending stiffness. The upper suspension beyond '
    + 'the cropped engraving is inferred.';
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
  for (const object of [
    centerOfOscillationMarker,
    compensationDatum,
  ]) {
    object.castShadow = false;
    object.receiveShadow = false;
  }
  root.userData.fidelity = 'authored';

  return {
    cameraDirection: new THREE.Vector3(1.2, .6, 16),
    root,
    update,
  };
}

export function createAuthoredCompensationPendulumMovement(movement) {
  if (movement.id === 316) {
    // The mercury is a full column inside the clear glass (it was a
    // half-cylinder section, so the jar looked half empty when turned).
    const model = applyCutawayFor(mercurialCompensationPendulum(movement), 316);
    // Brown sections the jar to show the rod running down into the mercury
    // nearly to the bottom: the mercury takes the house see-through style so
    // the steel rod shows inside it.
    model.root.traverse((object) => {
      if (object.isMesh && object.userData.role === 'constant-mass-expanding-mercury-column') {
        makeSeeThrough(object, { opacity: 0.7, edgeOpacity: 0.95 });
      }
    });
    return model;
  }
  if (movement.id === 317) {
    return compoundBarCompensationPendulum(movement);
  }
  return null;
}
