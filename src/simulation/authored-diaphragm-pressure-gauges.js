import {correctElasticGaugeParts} from './elastic-gauge-working-parts.js';
import * as THREE from 'three';
import {plate, poly, circle, polygonClipping as clip} from './finite-plate-geometry.js';
import {
  PALETTE,
  makeDynamicLink,
  makeGear,
  markShadows,
  matte,
  setSpin,
} from './primitives.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

function addRole(object, role) {
  object.userData.role = role;
  return object;
}

function makeCorrugatedDiaphragm({
  angularSegments,
  baseZ,
  corrugationAmplitude,
  corrugationCount,
  material,
  radialSegments,
  radius,
}) {
  const vertexCount = 1 + radialSegments * angularSegments;
  const positions = new Float32Array(vertexCount * 3);
  const indices = [];
  const ringIndex = (ring, angularIndex) => (
    1 + (ring - 1) * angularSegments
    + THREE.MathUtils.euclideanModulo(angularIndex, angularSegments)
  );
  for (let angularIndex = 0; angularIndex < angularSegments;
    angularIndex += 1) {
    indices.push(
      0,
      ringIndex(1, angularIndex),
      ringIndex(1, angularIndex + 1),
    );
  }
  for (let ring = 1; ring < radialSegments; ring += 1) {
    for (let angularIndex = 0; angularIndex < angularSegments;
      angularIndex += 1) {
      const a = ringIndex(ring, angularIndex);
      const b = ringIndex(ring, angularIndex + 1);
      const c = ringIndex(ring + 1, angularIndex + 1);
      const d = ringIndex(ring + 1, angularIndex);
      indices.push(a, d, c, a, c, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setIndex(indices);
  const diaphragm = addRole(new THREE.Mesh(geometry, material),
    'circular-corrugated-metal-disk-A-fixed-at-rim');
  const centerShape = (normalizedRadius) => (
    (1 - normalizedRadius ** 2) ** 2
  );
  const neutralCorrugation = (normalizedRadius) => (
    corrugationAmplitude
    * Math.sin(Math.PI * normalizedRadius)
    * Math.sin(Math.PI * 2 * corrugationCount * normalizedRadius)
  );
  diaphragm.userData.setDeflection = (
    centerDeflection,
    pressureFraction,
  ) => {
    const corrugationScale = 1 - 0.26 * pressureFraction;
    positions[0] = 0;
    positions[1] = 0;
    positions[2] = baseZ + centerDeflection;
    for (let ring = 1; ring <= radialSegments; ring += 1) {
      const normalizedRadius = ring / radialSegments;
      const ringRadius = radius * normalizedRadius;
      const z = baseZ
        + centerDeflection * centerShape(normalizedRadius)
        + neutralCorrugation(normalizedRadius) * corrugationScale;
      for (let angularIndex = 0; angularIndex < angularSegments;
        angularIndex += 1) {
        const angle = Math.PI * 2 * angularIndex / angularSegments;
        const vertex = ringIndex(ring, angularIndex) * 3;
        positions[vertex] = ringRadius * Math.cos(angle);
        positions[vertex + 1] = ringRadius * Math.sin(angle);
        positions[vertex + 2] = z;
      }
    }
    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    diaphragm.userData.centerZ = positions[2];
    diaphragm.userData.centerDeflection = centerDeflection;
    diaphragm.userData.corrugationScale = corrugationScale;
  };
  diaphragm.userData.angularSegments = angularSegments;
  diaphragm.userData.baseZ = baseZ;
  diaphragm.userData.centerIndex = 0;
  diaphragm.userData.corrugationAmplitude = corrugationAmplitude;
  diaphragm.userData.corrugationCount = corrugationCount;
  diaphragm.userData.radialSegments = radialSegments;
  diaphragm.userData.radius = radius;
  diaphragm.userData.rimIndices = Array.from(
    { length: angularSegments },
    (_, angularIndex) => ringIndex(radialSegments, angularIndex),
  );
  return diaphragm;
}

function makeArcTube({ center, material, radius, role, start, end, z }) {
  const points = [];
  for (let index = 0; index <= 64; index += 1) {
    const angle = THREE.MathUtils.lerp(start, end, index / 64);
    points.push(new THREE.Vector3(
      center.x + radius * Math.cos(angle),
      center.y + radius * Math.sin(angle),
      z,
    ));
  }
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return addRole(new THREE.Mesh(
    new THREE.TubeGeometry(curve, 96, 0.024, 8, false),
    material,
  ), role);
}

// Closed thin strip of in-plane half-width w and depth 2d along an open
// polyline. Its vertex topology is fixed, so the diaphragm section can be
// reshaped in place every frame.
function sectionStrip(count, w, d) {
  const geometry = new THREE.BufferGeometry();
  const quads = (count - 1) * 4 + 2;
  geometry.setAttribute('position',
    new THREE.Float32BufferAttribute(new Float32Array(quads * 18), 3));
  const setPoints = (points) => {
    const edge = points.map((p, i) => {
      const a = points[Math.max(0, i - 1)], b = points[Math.min(count - 1, i + 1)];
      const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty);
      const nx = -ty / l * w, ny = tx / l * w;
      return [[p[0] + nx, p[1] + ny], [p[0] - nx, p[1] - ny]];
    });
    const out = geometry.attributes.position.array;
    let k = 0;
    const quad = (a, b, c, e) => {
      for (const v of [a, b, c, a, c, e]) { out[k++] = v[0]; out[k++] = v[1]; out[k++] = v[2]; }
    };
    const v = (i, side, z) => [edge[i][side][0], edge[i][side][1], z];
    for (let i = 0; i < count - 1; i += 1) {
      quad(v(i, 0, d), v(i, 1, d), v(i + 1, 1, d), v(i + 1, 0, d));
      quad(v(i, 1, -d), v(i, 0, -d), v(i + 1, 0, -d), v(i + 1, 1, -d));
      quad(v(i, 0, -d), v(i, 0, d), v(i + 1, 0, d), v(i + 1, 0, -d));
      quad(v(i + 1, 1, -d), v(i + 1, 1, d), v(i, 1, d), v(i, 1, -d));
    }
    quad(v(0, 1, -d), v(0, 1, d), v(0, 0, d), v(0, 0, -d));
    const n = count - 1;
    quad(v(n, 0, -d), v(n, 0, d), v(n, 1, d), v(n, 1, -d));
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  };
  return { geometry, setPoints };
}

// Brown's plate pairs the face view with a vertical section to its right:
// the shallow case with its front lip and glass, corrugated disk A clamped at
// its rim, sector e and the pointer pinion ahead of it, and the pressure
// passage running down the back of the case to the foot. This figure follows
// the plate's section proportions (plate pixels mapped at the face view's
// scale). The gauge front is on the left, as Brown draws it, and disk A bows
// toward the front with the same prescribed pressure fraction.
function brownSectionView({ frameMaterial, diaphragmMaterial, sectorMaterial, inkMaterial }) {
  const s = 6.9 / 318;
  const P = ([x, y]) => [(x - 1029) * s, (375 - y) * s];
  const region = (points) => poly(points.map(P));
  const group = addRole(new THREE.Group(), 'brown-section-view-beside-face');
  const caseRegion = clip.union(
    region([[1200, 213], [1312, 213], [1312, 223], [1210, 223], [1210, 236], [1200, 236]]),
    region([[1302, 223], [1312, 223], [1312, 345], [1352, 383], [1352, 600], [1340, 600], [1340, 391], [1302, 353]]),
    region([[1313, 398], [1325, 404], [1325, 600], [1313, 600]]),
    region([[1200, 515], [1313, 515], [1313, 525], [1200, 525]]),
    region([[1200, 498], [1210, 498], [1210, 515], [1200, 515]]),
    region([[1266, 236], [1302, 236], [1302, 249], [1266, 249]]),
    region([[1266, 489], [1302, 489], [1302, 502], [1266, 502]]),
    region([[1300, 600], [1366, 600], [1366, 610], [1300, 610]]),
  );
  // Brown draws the cut walls white with fine diagonal hatching.
  const cutMaterial = frameMaterial.clone();
  cutMaterial.color.set(0xe9e5dc);
  const caseSection = addRole(new THREE.Mesh(plate(caseRegion, -0.10, 0.10), cutMaterial),
    'fixed-case-of-diaphragm-gauge-in-section');
  const hatchStrokes = [];
  {
    const xs = caseRegion.flat(2).map((p) => p[0]), ys = caseRegion.flat(2).map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const rise = y1 - y0, pitch = 0.075, width = 0.016;
    for (let x = x0 - rise; x < x1; x += pitch) {
      hatchStrokes.push(poly([[x, y0], [x + width, y0], [x + width + rise, y1], [x + rise, y1]]));
    }
  }
  const caseHatching = addRole(new THREE.Mesh(
    plate(clip.intersection(caseRegion, clip.union(...hatchStrokes)), 0.10, 0.104), inkMaterial),
  'section-hatching-on-cut-case-walls');
  caseSection.add(caseHatching);
  const glass = addRole(new THREE.Mesh(plate(region([[1213, 236], [1217, 236], [1217, 498], [1213, 498]]), -0.06, 0.06), inkMaterial),
    'front-glass-in-section');
  const dial = addRole(new THREE.Mesh(plate(region([[1221, 262], [1224, 262], [1224, 474], [1221, 474]]), -0.06, 0.06), inkMaterial),
    'dial-plate-in-section');
  const spindle = addRole(new THREE.Mesh(plate(region([[1224, 362], [1238, 362], [1238, 366], [1224, 366]]), -0.04, 0.04), inkMaterial),
    'pointer-spindle-in-section');
  const pinion = addRole(new THREE.Mesh(plate(region([[1238, 356], [1246, 356], [1246, 372], [1238, 372]]), -0.07, 0.07), inkMaterial),
    'pointer-pinion-edge-on-in-section');
  const pivot = new THREE.Vector3(...P([1256, 398]), 0);
  const sectorE = addRole(new THREE.Group(), 'sector-e-in-section');
  sectorE.position.copy(pivot);
  const local = (x, y) => { const [a, b] = P([x, y]); return [a - pivot.x, b - pivot.y]; };
  const sectorShape = clip.difference(clip.union(
    poly([local(1246, 378), local(1251, 375), local(1259, 394), local(1253, 399)]),
    poly([local(1254, 394), local(1260, 380), local(1265, 383), local(1259, 399)]),
    poly(circle([0, 0], 5 * s, 32)),
  ), poly(circle([0, 0], 2 * s, 24)));
  const sectorBody = addRole(new THREE.Mesh(plate(sectorShape, -0.05, 0.05), sectorMaterial),
    'sector-e-lever-in-section');
  sectorE.add(sectorBody);
  const sectorPinLocal = new THREE.Vector3(...local(1262, 382), 0);
  const diaphragmSamples = 97;
  const diaphragmStrip = sectionStrip(diaphragmSamples, 2 * s, 0.08);
  const diaphragmSection = addRole(new THREE.Mesh(diaphragmStrip.geometry, diaphragmMaterial),
    'corrugated-disk-A-in-section');
  const rodStrip = sectionStrip(2, 1.4 * s, 0.03);
  const rod = addRole(new THREE.Mesh(rodStrip.geometry, inkMaterial),
    'rod-from-disk-A-to-sector-e-in-section');
  group.add(caseSection, glass, dial, spindle, pinion, sectorE, diaphragmSection, rod);
  const top = 251, bottom = 487, middle = (top + bottom) / 2, half = (bottom - top) / 2;
  const update = (state) => {
    const bow = 6 + 12 * state.pressureFraction;
    const points = Array.from({ length: diaphragmSamples }, (_, i) => {
      const y = top + (bottom - top) * i / (diaphragmSamples - 1);
      const r = Math.abs(y - middle) / half;
      const dish = r < 0.28 ? 1 : (1 - ((r - 0.28) / 0.72) ** 2) ** 2;
      const ripple = r < 0.28 ? 0 : 3 * Math.sin(4 * Math.PI * (r - 0.28) / 0.72) * (1 - r);
      return P([1290 - bow * dish - ripple, y]);
    });
    diaphragmStrip.setPoints(points);
    sectorE.rotation.z = state.sectorAngle;
    const pin = sectorPinLocal.clone().applyAxisAngle(Z_AXIS, state.sectorAngle).add(pivot);
    const centre = P([1290 - bow - 2.6, middle]);
    const toward = new THREE.Vector3(centre[0] - pin.x, centre[1] - pin.y, 0).normalize();
    // The rod meets the arm's face at the pin rather than passing into it.
    const end = pin.clone().addScaledVector(toward, 3.5 * s);
    rodStrip.setPoints([centre, [end.x, end.y]]);
  };
  return { group, update, blocks: { caseSection, diaphragmSection, rod, sectorE, pinion, spindle, glass, dial } };
}

function diaphragmPressureGauge(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8;
  const diaphragmRadius = 1.34;
  const diaphragmBaseZ = -0.48;
  const maximumCenterDeflection = 0.24;
  const corrugationCount = 4;
  const corrugationAmplitude = 0.072;
  const sectorPivot = new THREE.Vector3(0, -0.72, 0.12);
  const sectorInputPinLocal = new THREE.Vector3(-0.50, -0.18, 0);
  const sectorPitchRadius = 0.62;
  const sectorEquivalentTeeth = 31;
  const pinionPitchRadius = 0.20;
  const pinionTeeth = 10;
  const gearRatio = sectorPitchRadius / pinionPitchRadius;
  const pinionCenter = new THREE.Vector3(
    sectorPivot.x,
    sectorPivot.y + sectorPitchRadius + pinionPitchRadius,
    0.29,
  );
  const pointerZeroAngle = 2.35;
  const maximumScaleReading = 10;
  const maximumDemonstrationPressurePascal = 500_000;

  const inkMaterial = matte(PALETTE.ink, {
    metalness: 0.24,
    roughness: 0.46,
  });
  const frameMaterial = matte(PALETTE.frame, {
    metalness: 0.20,
    roughness: 0.62,
  });
  const diaphragmMaterial = matte(PALETTE.brass, {
    metalness: 0.56,
    roughness: 0.28,
    side: THREE.DoubleSide,
  });
  const sectorMaterial = matte(PALETTE.driver, {
    metalness: 0.20,
    roughness: 0.42,
  });
  const dialMaterial = matte(PALETTE.paper, {
    opacity: 0.89,
    roughness: 0.88,
    side: THREE.DoubleSide,
    transparent: true,
  });
  dialMaterial.depthWrite = false;
  const chamberMaterial = matte(PALETTE.frame, {
    opacity: 0.34,
    roughness: 0.62,
    side: THREE.DoubleSide,
    transparent: true,
  });
  chamberMaterial.depthWrite = false;
  const pressureMaterial = matte(PALETTE.driver, {
    opacity: 0.34,
    roughness: 0.48,
    side: THREE.DoubleSide,
    transparent: true,
  });
  pressureMaterial.depthWrite = false;

  const sectorPinWorld = (sectorAngle) => sectorInputPinLocal.clone()
    .applyAxisAngle(Z_AXIS, sectorAngle)
    .add(sectorPivot);
  const diaphragmCenter = (centerDeflection) => new THREE.Vector3(
    0,
    0,
    diaphragmBaseZ + centerDeflection,
  );
  const relaxedCenter = diaphragmCenter(0);
  const relaxedSectorPin = sectorPinWorld(0);
  const connectingRodLength = relaxedCenter.distanceTo(relaxedSectorPin);
  const solveSectorAngle = (centerDeflection) => {
    if (centerDeflection === 0) return 0;
    const center = diaphragmCenter(centerDeflection);
    const targetSquared = connectingRodLength ** 2;
    const residual = (angle) => center.distanceToSquared(
      sectorPinWorld(angle),
    ) - targetSquared;
    let lower = 0;
    let upper = 0.8;
    if (residual(lower) > 1e-12 || residual(upper) < 0) {
      throw new Error('Diaphragm-to-sector linkage solution is not bracketed');
    }
    for (let iteration = 0; iteration < 64; iteration += 1) {
      const middle = (lower + upper) / 2;
      if (residual(middle) > 0) upper = middle;
      else lower = middle;
    }
    return (lower + upper) / 2;
  };
  const maximumSectorAngle = solveSectorAngle(maximumCenterDeflection);

  const dialFace = addRole(new THREE.Mesh(
    new THREE.RingGeometry(1.56, 3.08, 96),
    dialMaterial,
  ), 'annular-dial-face-with-center-cutaway-showing-disk-A');
  dialFace.position.z = 0.50;
  const outerRim = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(3.28, 0.17, 16, 96),
    frameMaterial,
  ), 'fixed-round-magdeburg-gauge-case-rim');
  outerRim.position.z = 0.05;

  const chamber = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 1.55, 0.52, 64, 1, true),
    chamberMaterial,
  ), 'cutaway-pressure-chamber-behind-corrugated-disk');
  chamber.rotation.x = Math.PI / 2;
  chamber.position.z = diaphragmBaseZ - 0.22;
  const chamberBack = addRole(new THREE.Mesh(
    new THREE.CircleGeometry(1.55, 64),
    chamberMaterial,
  ), 'fixed-back-wall-of-pressure-chamber');
  chamberBack.position.z = diaphragmBaseZ - 0.47;
  const pressureFill = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(1.27, 1.27, 0.24, 64),
    pressureMaterial,
  ), 'visible-pressure-medium-acting-over-disk-area');
  pressureFill.rotation.x = Math.PI / 2;
  pressureFill.position.z = diaphragmBaseZ - 0.17;

  const diaphragm = makeCorrugatedDiaphragm({
    angularSegments: 72,
    baseZ: diaphragmBaseZ,
    corrugationAmplitude,
    corrugationCount,
    material: diaphragmMaterial,
    radialSegments: 32,
    radius: diaphragmRadius,
  });
  diaphragm.userData.sourceLabel = 'A';
  const diaphragmClamp = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(diaphragmRadius, 0.095, 12, 72),
    frameMaterial,
  ), 'fixed-pressure-tight-peripheral-clamp-of-disk-A');
  diaphragmClamp.position.z = diaphragmBaseZ;
  const diaphragmBoss = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.20, 28),
    diaphragmMaterial,
  ), 'axially-moving-center-boss-of-diaphragm-A');
  diaphragmBoss.rotation.x = Math.PI / 2;

  const inletPipePoints = [
    new THREE.Vector3(0, -3.82, -0.73),
    new THREE.Vector3(0, -3.20, -0.73),
    new THREE.Vector3(0, -2.48, -0.76),
    new THREE.Vector3(0, -1.40, -0.75),
  ];
  const inletCurve = new THREE.CatmullRomCurve3(
    inletPipePoints,
    false,
    'centripetal',
  );
  const inletPipe = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(inletCurve, 72, 0.25, 18, false),
    frameMaterial,
  ), 'bottom-pressure-inlet-leading-to-diaphragm-chamber');
  const inletPressureCore = addRole(new THREE.Mesh(
    new THREE.TubeGeometry(inletCurve, 72, 0.13, 14, false),
    pressureMaterial,
  ), 'visible-pressure-medium-in-bottom-inlet');
  const inletCollar = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.27, 32),
    inkMaterial,
  ), 'threaded-process-pressure-connection-collar');
  inletCollar.position.set(0, -3.42, -0.73);

  const connectingRod = addRole(makeDynamicLink({
    color: PALETTE.ink,
    depth: 0.115,
    jointRadius: 0.10,
    thickness: 0.075,
  }), 'constant-length-spatial-rod-from-diaphragm-center-to-sector-e');
  const sector = addRole(new THREE.Group(),
    'toothed-sector-e-driven-by-diaphragm-deflection');
  sector.position.copy(sectorPivot);
  const sectorHub = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.24, 28),
    inkMaterial,
  ), 'fixed-pivot-bearing-of-sector-e');
  sectorHub.rotation.x = Math.PI / 2;
  const sectorInputArm = makeDynamicLink({
    color: PALETTE.driver,
    depth: 0.16,
    jointRadius: 0.10,
    thickness: 0.11,
  });
  sectorInputArm.userData.role = 'input-arm-of-sector-e';
  sectorInputArm.userData.setEndpoints(
    new THREE.Vector3(0, 0, 0),
    sectorInputPinLocal,
  );
  const sectorAngularPitch = Math.PI * 2 / sectorEquivalentTeeth;
  const sectorTeeth = [];
  for (let index = 0; index < 5; index += 1) {
    const angle = Math.PI / 2 + (index - 2) * sectorAngularPitch;
    const tooth = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.082, 0.17),
      sectorMaterial,
    ), `tooth-${index + 1}-of-sector-e`);
    tooth.position.set(
      Math.cos(angle) * (sectorPitchRadius + 0.034),
      Math.sin(angle) * (sectorPitchRadius + 0.034),
      0,
    );
    tooth.rotation.z = angle - Math.PI / 2;
    tooth.userData.pitchAngle = angle;
    sectorTeeth.push(tooth);
  }
  const sectorRim = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(
      sectorPitchRadius - 0.025,
      0.088,
      10,
      28,
      sectorAngularPitch * 5.15,
    ),
    sectorMaterial,
  ), 'pitch-arc-of-toothed-sector-e');
  sectorRim.rotation.z = Math.PI / 2 - sectorAngularPitch * 2.575;
  sector.add(sectorHub, sectorInputArm, sectorRim, ...sectorTeeth);

  const pinion = makeGear({
    color: PALETTE.ink,
    depth: 0.18,
    radius: pinionPitchRadius,
    teeth: pinionTeeth,
    toothHeight: 0.064,
  });
  pinion.userData.role = 'small-pinion-on-pointer-spindle';
  pinion.position.copy(pinionCenter);
  const pointer = addRole(new THREE.Group(),
    'pointer-rigidly-keyed-to-pinion-spindle');
  pointer.position.copy(pinionCenter);
  pointer.position.z = 0.72;
  const pointerNeedle = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(2.45, 0.055, 0.075),
    inkMaterial,
  ), 'pressure-pointer-needle');
  pointerNeedle.position.x = 1.18;
  const pointerTip = addRole(new THREE.Mesh(
    new THREE.ConeGeometry(0.105, 0.28, 3),
    inkMaterial,
  ), 'pressure-pointer-arrowhead');
  pointerTip.rotation.z = -Math.PI / 2;
  pointerTip.position.x = 2.45;
  const pointerHub = addRole(new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.13, 28),
    sectorMaterial,
  ), 'front-pointer-spindle-hub');
  pointerHub.rotation.x = Math.PI / 2;
  const pointerCounterweightArm = addRole(new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.055, 0.075),
    inkMaterial,
  ), 'short-opposite-pointer-counterweight-arm');
  pointerCounterweightArm.position.x = -0.33;
  const pointerCounterweight = addRole(new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.040, 9, 28),
    inkMaterial,
  ), 'c-shaped-counterweight-shown-opposite-pointer');
  pointerCounterweight.position.x = -0.69;
  pointer.add(
    pointerNeedle,
    pointerTip,
    pointerHub,
    pointerCounterweightArm,
    pointerCounterweight,
  );

  const pointerMaximumAngle = pointerZeroAngle
    - maximumSectorAngle * gearRatio;
  const scaleRadius = 2.55;
  const scaleArc = makeArcTube({
    center: pinionCenter,
    end: pointerZeroAngle,
    material: inkMaterial,
    radius: scaleRadius,
    role: 'graduated-pressure-scale-arc',
    start: pointerMaximumAngle,
    z: 0.58,
  });
  const scaleTicks = [];
  for (let value = 0; value <= maximumScaleReading; value += 1) {
    const angle = THREE.MathUtils.lerp(
      pointerZeroAngle,
      pointerMaximumAngle,
      value / maximumScaleReading,
    );
    const tick = addRole(new THREE.Mesh(
      new THREE.BoxGeometry(
        0.055,
        value % 5 === 0 ? 0.31 : 0.19,
        0.07,
      ),
      inkMaterial,
    ), `dial-scale-mark-${value}`);
    tick.position.set(
      pinionCenter.x + scaleRadius * Math.cos(angle),
      pinionCenter.y + scaleRadius * Math.sin(angle),
      0.60,
    );
    tick.rotation.z = angle - Math.PI / 2;
    tick.userData.angle = angle;
    tick.userData.value = value;
    scaleTicks.push(tick);
  }

  root.add(
    chamberBack,
    pressureFill,
    chamber,
    inletPipe,
    inletPressureCore,
    inletCollar,
    diaphragm,
    diaphragmClamp,
    diaphragmBoss,
    dialFace,
    outerRim,
    scaleArc,
    ...scaleTicks,
    connectingRod,
    sector,
    pinion,
    pointer,
  );
  const sectionView = brownSectionView({
    diaphragmMaterial,
    frameMaterial,
    inkMaterial,
    sectorMaterial,
  });
  root.add(sectionView.group);

  const stateAtTime = (time) => {
    const cycleTime = THREE.MathUtils.euclideanModulo(time, cycleDuration);
    const cyclePosition = cycleTime / cycleDuration;
    const phaseAngle = Math.PI * 2 * cyclePosition;
    const pressureFraction = (1 - Math.cos(phaseAngle)) / 2;
    const pressureFractionVelocity = Math.PI / cycleDuration
      * Math.sin(phaseAngle);
    const centerDeflection = maximumCenterDeflection * pressureFraction;
    const centerDeflectionVelocity = maximumCenterDeflection
      * pressureFractionVelocity;
    const centerPoint = diaphragmCenter(centerDeflection);
    const sectorAngle = solveSectorAngle(centerDeflection);
    const sectorInputPin = sectorPinWorld(sectorAngle);
    const rotatedInputPin = sectorInputPinLocal.clone()
      .applyAxisAngle(Z_AXIS, sectorAngle);
    const pinDerivativeBySectorAngle = new THREE.Vector3(
      -rotatedInputPin.y,
      rotatedInputPin.x,
      0,
    );
    const separation = centerPoint.clone().sub(sectorInputPin);
    const centerVelocity = new THREE.Vector3(
      0,
      0,
      centerDeflectionVelocity,
    );
    const sectorAngularVelocity = Math.abs(pressureFractionVelocity) < 1e-15
      ? 0
      : separation.dot(centerVelocity)
        / separation.dot(pinDerivativeBySectorAngle);
    const sectorPinVelocity = pinDerivativeBySectorAngle.clone()
      .multiplyScalar(sectorAngularVelocity);
    const pinionAngle = -sectorAngle * gearRatio;
    const pinionAngularVelocity = -sectorAngularVelocity * gearRatio;
    return {
      centerDeflection,
      centerDeflectionVelocity,
      centerPoint,
      cyclePosition,
      cycleTime,
      gaugePressurePascal:
        maximumDemonstrationPressurePascal * pressureFraction,
      gearPitchVelocityResidual:
        sectorAngularVelocity * sectorPitchRadius
        + pinionAngularVelocity * pinionPitchRadius,
      pinionAngle,
      pinionAngularVelocity,
      pointerAngle: pointerZeroAngle + pinionAngle,
      pressureFraction,
      pressureFractionVelocity,
      scaleReading: maximumScaleReading * pressureFraction,
      sectorAngle,
      sectorAngularVelocity,
      sectorInputPin,
      spatialLinkLengthResidual:
        centerPoint.distanceTo(sectorInputPin) - connectingRodLength,
      spatialLinkVelocityResidual: separation.dot(
        centerVelocity.clone().sub(sectorPinVelocity),
      ),
    };
  };

  root.userData.archetype =
    'corrugated-circular-diaphragm-spatial-link-sector-pinion-pressure-gauge';
  root.userData.mechanism =
    'pressure-axially-deflects-rim-fixed-corrugated-disk-A-constant-length-link-turns-sector-e-sector-meshes-pointer-pinion';
  root.userData.blocks = {
    chamber,
    chamberBack,
    connectingRod,
    dialFace,
    diaphragm,
    diaphragmBoss,
    diaphragmClamp,
    inletCollar,
    inletPipe,
    inletPressureCore,
    outerRim,
    pinion,
    pointer,
    pointerCounterweight,
    pointerCounterweightArm,
    pointerHub,
    pointerNeedle,
    pointerTip,
    pressureFill,
    scaleArc,
    scaleTicks,
    sector,
    sectorHub,
    sectorInputArm,
    sectorRim,
    sectorTeeth,
    sectionView: sectionView.blocks,
  };
  root.userData.cameraFitBounds = new THREE.Box3(
    new THREE.Vector3(-3.62, -4.18, -1.18),
    new THREE.Vector3(3.62, 3.62, 1.02),
  );
  root.userData.canonicalTimes = {
    maximumPressure: cycleDuration / 2,
    returnToZero: cycleDuration,
    sourcePose: cycleDuration * 0.30,
    zeroPressure: 0,
  };
  root.userData.degreesOfFreedom = {
    independentDiaphragmCoordinates: 0,
    independentPointerCoordinates: 0,
    independentPressureInputs: 1,
    independentSectorCoordinates: 0,
  };
  root.userData.geometry = {
    corrugationAmplitude,
    corrugationCount,
    cycleDuration,
    diaphragmBaseZ,
    diaphragmRadius,
    maximumCenterDeflection,
    maximumScaleReading,
    maximumSectorAngle,
    pinionCenter,
    pinionPitchRadius,
    sectorPitchRadius,
    sectorPivot,
  };
  root.userData.linkage = {
    connectingRodLength,
    sectorInputPinLocal,
    solver:
      'the sector angle is solved by bisection so the spatial center-boss rod retains exactly one length while the diaphragm center remains on its axial guide',
  };
  root.userData.sourceAnimation = {
    available: false,
    officialCanvasModelPresent: false,
    sourceUrl: movement.sourceUrl,
  };
  root.userData.sourceReference = {
    historicalEngineeringCorroboration: {
      detail:
        'Collacott describes a rim-secured corrugated disc as radially stiff and axially flexible, explains corrugation unwrapping, and identifies the Schaffer diaphragm gauge chain as disc, plunger, movement, and pointer.',
      paper:
        'R. A. Collacott, The Design and Production of Pressure Gauges, Transactions of the Institute of Marine Engineers, vol. LVII, part 4 (1945)',
      url:
        'https://library.imarest.org/nanna/record/26/files/7.pdf?registerDownload=1&version=1&withMetadata=0&withWatermark=0',
    },
    officialDescription: movement.description,
    officialEngraving: './engravings/mm_500.png',
    officialInlineModelUrl: movement.sourceUrl,
    reconstructionDisclosure:
      'The official page marks Animated unavailable. Brown fixes the face-and-section topology, circular corrugated disk A, pressure-induced disk deflection, sector e, pointer pinion, and motion chain but gives no dimensions, tooth counts, pressure range, elastic constants, or timing. The four corrugations, 0.24-unit axial travel, exact spatial rod, 31:10 pitch ratio, 0-to-500-kPa eight-second demonstration, central cutaway, depth, and colors are explicit reconstruction choices.',
    sourceUrl: movement.sourceUrl,
  };
  root.userData.stateAtTime = stateAtTime;
  root.userData.transmission = {
    externalMeshEquation:
      'sectorAngularVelocity * sectorPitchRadius + pinionAngularVelocity * pinionPitchRadius = 0',
    gearRatio,
    maximumDemonstrationPressurePascal,
    pinionTeeth,
    pointerTurnsWithPinion: true,
    sectorEquivalentTeeth,
  };
  root.userData.cameraDistanceScale = 1.02;

  const update = (time) => {
    const state = stateAtTime(time);
    diaphragm.userData.setDeflection(
      state.centerDeflection,
      state.pressureFraction,
    );
    diaphragmBoss.position.copy(state.centerPoint);
    diaphragmBoss.position.z += 0.085;
    connectingRod.userData.setEndpoints(
      state.centerPoint,
      state.sectorInputPin,
    );
    sector.rotation.z = state.sectorAngle;
    setSpin(pinion, state.pinionAngle);
    pointer.rotation.z = state.pointerAngle;
    pressureFill.material.opacity = 0.10
      + 0.48 * state.pressureFraction;
    inletPressureCore.material.opacity = 0.10
      + 0.48 * state.pressureFraction;
    pressureFill.userData.gaugePressurePascal = state.gaugePressurePascal;
    sectionView.update(state);
    root.userData.kinematics = state;
  };
  update(0);
  root.userData.fidelity = 'authored';
  correctElasticGaugeParts(root,500,update);
  // The fixed journal stops just behind the pointer hub: the pointer is keyed
  // to the pinion it carries, so the journal no longer runs through the
  // unbored hub, needle and counterweight arm.
  {
    const { pinionShaft, pointerHub } = root.userData.blocks;
    root.updateMatrixWorld(true);
    const back = pinionShaft.position.z - pinionShaft.geometry.parameters.height / 2;
    const front = new THREE.Box3().setFromObject(pointerHub).min.z - 0.005;
    pinionShaft.geometry.dispose();
    pinionShaft.geometry = new THREE.CylinderGeometry(0.056, 0.056, front - back, 48);
    pinionShaft.position.z = (front + back) / 2;
  }
  // The sector's pivot sleeve stopped past the pointer plane, where the
  // pointer's counterweight swept through it; it now ends short of that plane.
  {
    const hub = root.userData.blocks.sectorHub;
    const back = hub.position.z - hub.geometry.parameters.height / 2;
    const front = 0.52;
    hub.geometry.dispose();
    hub.geometry = new THREE.CylinderGeometry(0.08, 0.08, front - back, 48);
    hub.position.z = (front + back) / 2;
  }
  markShadows(root);
  dialFace.castShadow = false;
  chamber.castShadow = false;
  chamberBack.castShadow = false;
  pressureFill.castShadow = false;
  inletPressureCore.castShadow = false;
  // Brown's dial carries no shadow copy of the pointer or scale.
  dialFace.receiveShadow = false;
  return {
    root,
    update,
    cameraDirection: root.userData.cameraDirection,
  };
}

export function createAuthoredDiaphragmPressureGaugeMovement(movement) {
  if (movement.id !== 500) return null;
  return diaphragmPressureGauge(movement);
}
