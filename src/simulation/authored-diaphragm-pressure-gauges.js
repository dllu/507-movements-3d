import {correctElasticGaugeParts} from './elastic-gauge-working-parts.js';
import * as THREE from 'three';
import {applyCutawayFor} from './cutaway-presentations.js';
import {horizontalRing} from './horizontal-turbine-solids.js';
import {plate, poly, circle, capsule, sector as wedge, polygonClipping as clip} from './finite-plate-geometry.js';
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

// Half of a solid of revolution: the closed profile `loop` of [a, r] points
// (a along the axis, r >= 0 its radius) swept through the half turn behind
// the cut plane z = 0, closed there by two plain cut faces. The lathe axis is
// local Y and the radial direction at the cut is local +/-X. Topology is
// fixed, so a profile of the same point count can be reshaped every frame.
// Geometry group 0 is the turned surface, group 1 the cut faces.
function halfRevolvedSolid(count, { segments = 48, capTriangles = null } = {}) {
  const geometry = new THREE.BufferGeometry();
  const ringVertices = count * (segments + 1);
  const positions = new Float32Array((ringVertices + 2 * count) * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  let indexed = false;
  const setLoop = (loop) => {
    if (!indexed) {
      const triangles = capTriangles ?? THREE.ShapeUtils.triangulateShape(
        loop.map(([a, r]) => new THREE.Vector2(a, r)), []);
      const index = [];
      for (let k = 0; k < count; k += 1) {
        const l = (k + 1) % count;
        for (let j = 0; j < segments; j += 1) {
          const v = (i, jj) => i * (segments + 1) + jj;
          index.push(v(k, j), v(l, j), v(l, j + 1), v(k, j), v(l, j + 1), v(k, j + 1));
        }
      }
      const ringIndexCount = index.length;
      for (const [t0, t1, t2] of triangles) {
        index.push(ringVertices + t0, ringVertices + t1, ringVertices + t2);
        index.push(ringVertices + count + t2, ringVertices + count + t1, ringVertices + count + t0);
      }
      geometry.setIndex(index);
      geometry.addGroup(0, ringIndexCount, 0);
      geometry.addGroup(ringIndexCount, index.length - ringIndexCount, 1);
      indexed = true;
    }
    let o = 0;
    for (let k = 0; k < count; k += 1) {
      const [a, r] = loop[k];
      for (let j = 0; j <= segments; j += 1) {
        const phi = Math.PI / 2 + Math.PI * j / segments;
        positions[o++] = r * Math.sin(phi); positions[o++] = a; positions[o++] = Math.min(0, r * Math.cos(phi));
      }
    }
    for (const side of [1, -1]) {
      for (const [a, r] of loop) { positions[o++] = side * r; positions[o++] = a; positions[o++] = 0; }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  };
  return { geometry, setLoop };
}

// Brown's plate pairs the face view with a vertical section to its right:
// the shallow case with its front lip and glass, corrugated disk A clamped at
// its rim, sector e and the pointer pinion ahead of it, and the pressure
// passage running down the back of the case to the foot. This figure follows
// the plate's section proportions (plate pixels mapped at the face view's
// scale). The gauge front is on the left, as Brown draws it, and disk A bows
// toward the front with the same prescribed pressure fraction.
// It is modelled as the real gauge cut on its axial plane: the case, clamp
// ring, glass, dial, spindle, pinion and disk A are the back halves of solids
// of revolution about the gauge axis, the pressure pipe and foot the back
// halves of solids about the pipe axis, all closed by plain cut faces at
// z = 0 (Brown's section hatching is engraving notation, not modelled).
function brownSectionView({ frameMaterial, diaphragmMaterial, sectorMaterial, inkMaterial, pointerSweep }) {
  const s = 6.9 / 318;
  const P = ([x, y]) => [(x - 1029) * s, (375 - y) * s];
  const group = addRole(new THREE.Group(), 'brown-section-view-beside-face');
  const axisY = 369;
  const sided = (material, shade = 1) => {
    const clone = material.clone();
    clone.side = THREE.DoubleSide;
    if (shade !== 1) clone.color.multiplyScalar(shade);
    return clone;
  };
  const caseMaterials = [sided(frameMaterial), sided(frameMaterial, 0.82)];
  const inkMaterials = [sided(inkMaterial), sided(inkMaterial)];
  const dialMaterials = [sided(matte(PALETTE.white, { roughness: 0.5 })), sided(matte(PALETTE.white, { roughness: 0.5 }), 0.9)];
  const glassMaterial = matte(0xcfe3ea, { roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.32, side: THREE.DoubleSide });
  glassMaterial.depthWrite = false;
  const diaphragmMaterials = [sided(diaphragmMaterial), sided(diaphragmMaterial, 0.85)];
  // Solid about the gauge axis (horizontal, at plate row `centre`): profile
  // points are plate [x, y] with y above the centre.
  const aboutGaugeAxis = (points, materials, role, centre = axisY) => {
    const solid = halfRevolvedSolid(points.length);
    solid.setLoop(points.map(([x, y]) => [(x - 1029) * s, (centre - y) * s]));
    const mesh = addRole(new THREE.Mesh(solid.geometry, materials), role);
    mesh.rotation.z = -Math.PI / 2;
    mesh.position.y = (375 - centre) * s;
    return mesh;
  };
  // Solid about the vertical pipe axis at plate column `centreX`: profile
  // points are plate [x, y] with x right of the axis.
  const pipeX = 1332.5;
  const aboutPipeAxis = (points, materials, role) => {
    const solid = halfRevolvedSolid(points.length);
    solid.setLoop(points.map(([x, y]) => [(375 - y) * s, (x - pipeX) * s]));
    const mesh = addRole(new THREE.Mesh(solid.geometry, materials), role);
    mesh.position.x = (pipeX - 1029) * s;
    return mesh;
  };
  const holeY = axisY - 8;
  const caseShell = aboutGaugeAxis([[1200, 213], [1312, 213], [1312, holeY], [1302, holeY],
    [1302, 223], [1210, 223], [1210, 236], [1200, 236]], caseMaterials,
  'fixed-case-of-diaphragm-gauge-in-section');
  const clampRing = aboutGaugeAxis([[1266, 236], [1302, 236], [1302, 249], [1266, 249]],
    caseMaterials, 'rim-clamp-ring-of-disk-A-in-section');
  // The passage leaves the back of the case on the axis through a short
  // nipple seated in the pipe wall, and the pipe runs down to the foot.
  const nipple = aboutGaugeAxis([[1312, holeY], [1320, holeY], [1320, axisY - 14], [1312, axisY - 14]],
    caseMaterials, 'passage-nipple-behind-case-in-section');
  const pipe = aboutPipeAxis([[pipeX, 349.5], [1352, 349.5], [1352, 600], [1340, 600],
    [1340, 361.5], [pipeX, 361.5]], caseMaterials,
  'pressure-pipe-down-back-of-case-in-section');
  const foot = aboutPipeAxis([[1340, 600], [1366, 600], [1366, 610], [1340, 610]], caseMaterials,
    'pipe-foot-flange-in-section');
  // Brown carries the glass and the dial plate across the whole case: both
  // run out into the case wall (its inner face is row 223), where they are
  // seated behind the front lip, so neither hangs free inside the case; they
  // end 1 px inside the wall so their rims do not share its face.
  const glass = aboutGaugeAxis([[1213, axisY], [1217, axisY], [1217, 222], [1213, 222]],
    [glassMaterial, glassMaterial], 'front-glass-in-section');
  const dial = aboutGaugeAxis([[1221, axisY - 1.6], [1224, axisY - 1.6], [1224, 222], [1221, 222]],
    dialMaterials, 'dial-plate-in-section');
  // Pass 58: the moving train is complete from disk A to the pointer.
  // The pointer spindle runs on the gauge axis from the pointer, just behind
  // the glass, through a bore in the dial to the pinion. Sector e turns on a
  // stud across the section (Brown's small circle) carried by a plain bracket
  // screwed to the back of the dial; its toothed rim lies just behind the
  // pinion and engages the pinion's back as a crown sector (Brown's toothed
  // arcs above and below the pinion). Arm e carries a pin, and a short rod
  // links it to a lug on the boss at the centre of disk A. These moving parts
  // are whole (not cut by the section plane) so their motion reads in every
  // view; the pointer's sweep is centred on the cut so it lies mostly inside
  // the case.
  // Brown's disk spans rows 251-487; its rim runs 2 px on into the clamp
  // ring (inner radius 120 px), where it is held.
  const rimRadius = 122;
  const diskX = (r, bow) => {
    const dish = r < 0.28 ? 1 : (1 - ((r - 0.28) / 0.72) ** 2) ** 2;
    const ripple = r < 0.28 ? 0 : 3 * Math.sin(4 * Math.PI * (r - 0.28) / 0.72) * (1 - r);
    return 1290 - bow * dish - ripple;
  };
  const bowAt = (pressureFraction) => 6 + 12 * pressureFraction;
  const X = (x) => (x - 1029) * s;
  const Y = (row) => (375 - row) * s;
  const px = (value) => value * s;
  const pinionRadius = 7;
  const crownRadius = 28;
  const crownRatio = crownRadius / pinionRadius;
  const pinionTeeth = 8;
  const contactX = 1229;
  const sectorPivot = new THREE.Vector3(X(contactX + crownRadius), Y(axisY), 0);
  const sweep = pointerSweep;
  const needleZero = sweep / 2 - Math.PI / 2;
  const spindleGroup = addRole(new THREE.Group(), 'pointer-spindle-assembly-in-section');
  spindleGroup.position.set(0, Y(axisY), 0);
  const alongX = (geometry) => geometry.rotateZ(-Math.PI / 2);
  const spindle = addRole(new THREE.Mesh(alongX(new THREE.CylinderGeometry(px(1.2), px(1.2), px(1233 - 1218.2), 32))
    .translate(X((1233 + 1218.2) / 2), 0, 0), inkMaterial), 'pointer-spindle-on-gauge-axis-in-section');
  const needleHub = addRole(new THREE.Mesh(alongX(new THREE.CylinderGeometry(px(2.6), px(2.6), px(2.1), 32))
    .translate(X(1219.25), 0, 0), sectorMaterial), 'pointer-hub-in-section');
  const needleBody = addRole(new THREE.Mesh(new THREE.BoxGeometry(px(1.5), px(85 + 30), px(2))
    .translate(X(1219.25), px((85 - 30) / 2), 0), inkMaterial), 'pointer-needle-behind-glass-in-section');
  // Pinion: teeth centred so that a tooth space faces the crown sector at zero
  // pressure; the pitch then keeps the crown teeth in the spaces.
  const toothPitch = Math.PI * 2 / pinionTeeth;
  const pinionOutline = [];
  for (let k = 0; k < pinionTeeth; k += 1) {
    const centre = -needleZero + toothPitch / 2 + k * toothPitch;
    for (const [offset, radius] of [[-0.5, 5.6], [-0.26, 5.6], [-0.15, 8.0], [0.15, 8.0], [0.26, 5.6]]) {
      const angle = centre + offset * toothPitch;
      pinionOutline.push([px(radius) * Math.cos(angle), px(radius) * Math.sin(angle)]);
    }
  }
  const pinionGeometry = plate(clip.difference(poly(pinionOutline), poly(circle([0, 0], px(1.2), 32))), X(1225), X(1233));
  // rotateY maps the extrusion axis z onto x (and local x onto -z).
  pinionGeometry.rotateY(Math.PI / 2);
  const pinion = addRole(new THREE.Mesh(pinionGeometry, sectorMaterial), 'pointer-pinion-in-section');
  spindleGroup.add(spindle, needleHub, needleBody, pinion);
  // Sector e: crown rim, two spokes, hub and arm e, one plate behind the pinion.
  const sectorBack = -0.225, sectorFront = -0.177;
  const ridgePitch = toothPitch * pinionRadius / crownRadius;
  const sectorTravel = sweep / crownRatio;
  const ridgeCount = Math.ceil(sectorTravel / ridgePitch) + 2;
  const bandStart = Math.PI - (ridgeCount - 1) * ridgePitch - 0.1, bandEnd = Math.PI + ridgePitch + 0.1;
  const L = (v) => px(v);
  const armLength = sectionArmLength(sectorTravel);
  const armStart = Math.PI / 3;
  const pinLocal = [L(armLength) * Math.cos(armStart), L(armLength) * Math.sin(armStart)];
  const sectorShape = clip.difference(clip.union(
    wedge(L(crownRadius - 4), L(crownRadius + 3.5), bandStart, bandEnd, 96),
    capsule([0, 0], [L(crownRadius - 3) * Math.cos(bandStart + 0.12), L(crownRadius - 3) * Math.sin(bandStart + 0.12)], L(1.8), 16),
    capsule([0, 0], [L(crownRadius - 3) * Math.cos(bandEnd - 0.12), L(crownRadius - 3) * Math.sin(bandEnd - 0.12)], L(1.8), 16),
    capsule([0, 0], pinLocal, L(2.2), 16),
    poly(circle([0, 0], L(4), 48)),
  ), poly(circle([0, 0], L(1.3), 32)), poly(circle(pinLocal, L(1.0), 24)));
  const sectorE = addRole(new THREE.Group(), 'sector-e-in-section');
  sectorE.position.copy(sectorPivot);
  const sectorBody = addRole(new THREE.Mesh(plate(sectorShape, sectorBack, sectorFront), sectorMaterial),
    'sector-e-lever-in-section');
  sectorE.add(sectorBody);
  for (let j = -1; j < ridgeCount - 1; j += 1) {
    const angle = Math.PI - j * ridgePitch;
    const ridge = addRole(new THREE.Mesh(new THREE.BoxGeometry(L(7), L(1.4), 0.029)
      .translate(L(crownRadius - 0.5), 0, sectorFront + 0.0145).rotateZ(angle), sectorMaterial),
    `crown-tooth-${j + 2}-of-sector-e-in-section`);
    sectorE.add(ridge);
  }
  const armPin = addRole(new THREE.Mesh(new THREE.CylinderGeometry(L(1.0), L(1.0), -0.105 - sectorFront, 24)
    .rotateX(Math.PI / 2).translate(pinLocal[0], pinLocal[1], (sectorFront - 0.105) / 2), inkMaterial),
  'pin-in-arm-e-in-section');
  const armPinHead = addRole(new THREE.Mesh(new THREE.CylinderGeometry(L(1.8), L(1.8), 0.012, 24)
    .rotateX(Math.PI / 2).translate(pinLocal[0], pinLocal[1], -0.105 + 0.006), inkMaterial),
  'pin-head-on-arm-e-in-section');
  sectorE.add(armPin, armPinHead);
  // Fixed bracket behind sector e, screwed to the back of the dial, and the
  // stud on which the sector turns.
  const bracketBack = -0.29, bracketFront = -0.25;
  const bracket = addRole(new THREE.Mesh(plate(poly([[X(1224), Y(axisY) - L(5)], [sectorPivot.x + L(4), Y(axisY) - L(5)],
    [sectorPivot.x + L(4), Y(axisY) + L(5)], [X(1224), Y(axisY) + L(5)]]), bracketBack, bracketFront), caseMaterials[0]),
  'bracket-for-sector-e-behind-dial-in-section');
  const stud = addRole(new THREE.Mesh(new THREE.CylinderGeometry(L(1.3), L(1.3), sectorFront + 0.012 - bracketFront, 24)
    .rotateX(Math.PI / 2).translate(sectorPivot.x, sectorPivot.y, (bracketFront + sectorFront + 0.012) / 2), inkMaterial),
  'fixed-stud-of-sector-e-in-section');
  const studHead = addRole(new THREE.Mesh(new THREE.CylinderGeometry(L(2.4), L(2.4), 0.01, 24)
    .rotateX(Math.PI / 2).translate(sectorPivot.x, sectorPivot.y, sectorFront + 0.017), inkMaterial),
  'fixed-stud-head-of-sector-e-in-section');
  // Disk A: a thin corrugated plate of revolution, 4 plate pixels thick,
  // clamped at its rim; its profile is reshaped each frame. Its centre boss
  // carries a lug and pin for the rod.
  const diaphragmSamples = 49;
  const diaphragmCap = [];
  for (let i = 0; i < diaphragmSamples - 1; i += 1) {
    const front = [i, i + 1], back = [2 * diaphragmSamples - 1 - i, 2 * diaphragmSamples - 2 - i];
    diaphragmCap.push([front[0], front[1], back[1]], [front[0], back[1], back[0]]);
  }
  const diaphragmSolid = halfRevolvedSolid(2 * diaphragmSamples, { capTriangles: diaphragmCap });
  const diaphragmSection = addRole(new THREE.Mesh(diaphragmSolid.geometry, diaphragmMaterials),
    'corrugated-disk-A-in-section');
  diaphragmSection.rotation.z = -Math.PI / 2;
  diaphragmSection.position.y = (375 - axisY) * s;
  const boss = aboutGaugeAxis([[-6, axisY], [-2, axisY], [-2, axisY - 10], [-6, axisY - 10]].map(([x, y]) => [x + 1029, y]),
    diaphragmMaterials, 'centre-boss-of-disk-A-in-section');
  const lugZ = [-0.195, -0.155];
  boss.position.y = 0;
  const lug = addRole(new THREE.Mesh(new THREE.BoxGeometry(L(3.6), L(4.4), lugZ[1] - lugZ[0])
    .translate(L(-7.8), 0, (lugZ[0] + lugZ[1]) / 2), diaphragmMaterial), 'rod-lug-on-boss-of-disk-A-in-section');
  const lugPin = addRole(new THREE.Mesh(new THREE.CylinderGeometry(L(1.0), L(1.0), 0.09, 24)
    .rotateX(Math.PI / 2).translate(L(-7.8), 0, -0.15), inkMaterial), 'pin-in-rod-lug-in-section');
  const lugPinHead = addRole(new THREE.Mesh(new THREE.CylinderGeometry(L(1.8), L(1.8), 0.012, 24)
    .rotateX(Math.PI / 2).translate(L(-7.8), 0, -0.105 + 0.006), inkMaterial), 'pin-head-on-rod-lug-in-section');
  const bossGroup = addRole(new THREE.Group(), 'moving-centre-of-disk-A-in-section');
  bossGroup.add(boss, lug, lugPin, lugPinHead);
  const rodZ = -0.135, rodHalf = 0.02;
  const rodStrip = sectionStrip(2, L(1.2), rodHalf);
  const rod = addRole(new THREE.Mesh(rodStrip.geometry, inkMaterial),
    'rod-from-disk-A-to-arm-e-in-section');
  rod.position.z = rodZ;
  const eyeGeometry = () => plate(clip.difference(poly(circle([0, 0], L(2.4), 32)), poly(circle([0, 0], L(1.0), 24))),
    rodZ - rodHalf, rodZ + rodHalf);
  const rodEyes = [0, 1].map((i) => addRole(new THREE.Mesh(eyeGeometry(), inkMaterial),
    `rod-eye-${i + 1}-in-section`));
  group.add(caseShell, clampRing, nipple, pipe, foot, glass, dial, spindleGroup, sectorE, bracket, stud, studHead,
    diaphragmSection, bossGroup, rod, ...rodEyes);
  const lugPinAt = (bow) => new THREE.Vector3(X(diskX(0, bow) - 2 - 4) - L(1.8), Y(axisY), 0);
  const pinAt = (angle) => new THREE.Vector3(pinLocal[0], pinLocal[1], 0).applyAxisAngle(Z_AXIS, angle).add(sectorPivot);
  const rodLength = lugPinAt(bowAt(0)).distanceTo(pinAt(0));
  // The rod is one rigid bar of constant length between its two eyes; it is
  // built once and carried by its transform, not reshaped every frame.
  rodStrip.setPoints([[L(2), 0], [rodLength - L(2), 0]]);
  const solveSector = (bow) => {
    const lug = lugPinAt(bow);
    let lower = 0, upper = 1.6;
    for (let i = 0; i < 60; i += 1) {
      const middle = (lower + upper) / 2;
      if (lug.distanceTo(pinAt(middle)) < rodLength) lower = middle; else upper = middle;
    }
    return (lower + upper) / 2;
  };
  const update = (state) => {
    const bow = bowAt(state.pressureFraction);
    const mid = Array.from({ length: diaphragmSamples }, (_, i) => {
      const r = i / (diaphragmSamples - 1);
      return [(diskX(r, bow) - 1029) * s, r * rimRadius * s];
    });
    const w = 2 * s;
    diaphragmSolid.setLoop([...mid.map(([a, r]) => [a - w, r]),
      ...[...mid].reverse().map(([a, r]) => [a + w, r])]);
    bossGroup.position.set(X(diskX(0, bow)), Y(axisY), 0);
    const sectorAngle = solveSector(bow);
    sectorE.rotation.z = sectorAngle;
    spindleGroup.rotation.x = needleZero - crownRatio * sectorAngle;
    const lugPin = lugPinAt(bow), pin = pinAt(sectorAngle);
    rod.position.set(lugPin.x, lugPin.y, rodZ);
    rod.rotation.z = Math.atan2(pin.y - lugPin.y, pin.x - lugPin.x);
    rodEyes[0].position.set(lugPin.x, lugPin.y, 0);
    rodEyes[1].position.set(pin.x, pin.y, 0);
    group.userData.sectionState = { sectorAngle, needleAngle: spindleGroup.rotation.x, rodLength: lugPin.distanceTo(pin) };
  };
  // Arm length chosen so the section pointer sweeps the same angle as the
  // face-view pointer at full pressure.
  function sectionArmLength(travel) {
    const lugAt = (bow) => [(diskX(0, bow) - 6) - 1.8, 0];
    const rotation = (length) => {
      const pin = (t) => [contactX + crownRadius + length * Math.cos(Math.PI / 3 + t), length * Math.sin(Math.PI / 3 + t)];
      const d = (t, bow) => Math.hypot(pin(t)[0] - lugAt(bow)[0], pin(t)[1] - lugAt(bow)[1]);
      const target = d(0, bowAt(0));
      let lower = 0, upper = 1.6;
      for (let i = 0; i < 60; i += 1) { const m = (lower + upper) / 2; if (d(m, bowAt(1)) < target) lower = m; else upper = m; }
      return (lower + upper) / 2;
    };
    let shorter = 9, longer = 18;
    for (let i = 0; i < 50; i += 1) { const m = (shorter + longer) / 2; if (rotation(m) > travel) shorter = m; else longer = m; }
    return (shorter + longer) / 2;
  }
  return { group, update, blocks: { caseSection: caseShell, clampRing, pipe, foot, diaphragmSection,
    rod, rodEyes, sectorE, pinion, spindle, needle: needleBody, spindleGroup, bracket, stud, bossGroup, glass, dial } };
}

function diaphragmPressureGauge(movement) {
  const root = new THREE.Group();
  const cycleDuration = 8;
  const diaphragmRadius = 1.34;
  const diaphragmBaseZ = -0.48;
  const maximumCenterDeflection = 0.24;
  const corrugationCount = 4;
  const corrugationAmplitude = 0.072;
  // Pass 58: the pointer pinion sits on the dial axis (Brown's pointer turns
  // about the dial centre), and a short input crank on sector e gives the
  // pointer a sweep of about 210 degrees over the fully graduated dial.
  const sectorPitchRadius = 0.62;
  const sectorEquivalentTeeth = 31;
  const pinionPitchRadius = 0.16;
  const pinionTeeth = 8;
  const sectorPivot = new THREE.Vector3(0, -(sectorPitchRadius + pinionPitchRadius), 0.12);
  const sectorInputPinLocal = new THREE.Vector3(
    -0.24 * Math.sin(Math.PI / 12), 0.24 * Math.cos(Math.PI / 12), 0);
  const gearRatio = sectorPitchRadius / pinionPitchRadius;
  const pinionCenter = new THREE.Vector3(
    sectorPivot.x,
    sectorPivot.y + sectorPitchRadius + pinionPitchRadius,
    0.29,
  );
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
    let upper = 1.4;
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
  // The sweep is centred on the top of the dial: zero on the left, full
  // pressure on the right, turning clockwise as a gauge pointer does.
  const pointerZeroAngle = Math.PI / 2 + maximumSectorAngle * gearRatio / 2;

  const dialFace = addRole(new THREE.Mesh(
    // The outer edge runs 0.01 under the bezel's inner edge (r 3.11 once the
    // bezel is seated at the dial's plane), so no slot opens between them.
    new THREE.RingGeometry(1.56, 3.12, 96),
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
    new THREE.Vector3(0, -5.27, -0.73),
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

  // Brown's dial is graduated all round: a band between two fine cut
  // circles, crossed by twelve long graduations and fine ones between them,
  // centred on the pointer spindle. The lines are shallow ink-filled cuts
  // lying on the dial face, not raised marker blocks.
  const scaleInnerRadius = 2.62;
  const scaleOuterRadius = 2.86;
  const graduationZ = dialFace.position.z + 0.006;
  const lineWidth = 0.026;
  const graduationMaterial = inkMaterial.clone();
  graduationMaterial.polygonOffset = true;
  graduationMaterial.polygonOffsetFactor = -2;
  graduationMaterial.polygonOffsetUnits = -2;
  const scaleArc = addRole(new THREE.Group(), 'graduated-pressure-scale-band-all-round');
  for (const radius of [scaleInnerRadius, scaleOuterRadius]) {
    const ring = addRole(new THREE.Mesh(
      new THREE.RingGeometry(radius - lineWidth / 2, radius + lineWidth / 2, 192),
      graduationMaterial,
    ), `cut-scale-circle-r${radius}`);
    ring.position.set(pinionCenter.x, pinionCenter.y, graduationZ);
    scaleArc.add(ring);
  }
  const graduationCount = 60;
  const scaleTicks = [];
  for (let index = 0; index < graduationCount; index += 1) {
    const angle = Math.PI / 2 - Math.PI * 2 * index / graduationCount;
    const major = index % 5 === 0;
    const inner = major ? scaleInnerRadius : scaleOuterRadius - 0.11;
    const tick = addRole(new THREE.Mesh(
      new THREE.PlaneGeometry(major ? 0.032 : 0.02, scaleOuterRadius - inner),
      graduationMaterial,
    ), `dial-graduation-${index}`);
    const middle = (inner + scaleOuterRadius) / 2;
    tick.position.set(
      pinionCenter.x + middle * Math.cos(angle),
      pinionCenter.y + middle * Math.sin(angle),
      graduationZ,
    );
    tick.rotation.z = angle - Math.PI / 2;
    tick.userData.angle = angle;
    tick.userData.major = major;
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
    pointerSweep: maximumSectorAngle * gearRatio,
    diaphragmMaterial,
    frameMaterial,
    inkMaterial,
    sectorMaterial,
  });
  // Pass 56: Brown's section is a separate figure: stand it clear of the
  // gauge (a 1.86 gap instead of the old 0.26) so that in rotated views its cut
  // back half does not read as a half-drum stuck to the gauge's side.
  sectionView.group.position.x += 1.6;
  root.add(sectionView.group);
  // The section's pointer turns about the gauge axis, which lies in the cut
  // plane, so half its sweep would stand in front of the cut. Like every
  // other part of the section it keeps only the half behind the plane.
  {
    const needle = sectionView.blocks.needle;
    sectionView.group.updateMatrixWorld(true);
    const cut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0).applyMatrix4(sectionView.group.matrixWorld);
    needle.material = needle.material.clone();
    Object.assign(needle.material, { clippingPlanes: [cut], side: THREE.DoubleSide });
    root.userData.localClippingEnabled = true;
  }

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
    // (pointerZeroAngle is fixed above from the solved full-pressure sweep.)
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
    new THREE.Vector3(-3.62, -5.35, -1.18),
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
    pointerZeroAngle,
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
      'The official page marks Animated unavailable. Brown fixes the face-and-section topology, circular corrugated disk A, pressure-induced disk deflection, sector e, pointer pinion, and motion chain but gives no dimensions, tooth counts, pressure range, elastic constants, or timing. The four corrugations, 0.24-unit axial travel, exact spatial rod, 31:8 pitch ratio, roughly 210-degree pointer sweep over a dial graduated all round, 0-to-500-kPa eight-second demonstration, central cutaway, depth, and colors are explicit reconstruction choices.',
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
  // Brown's face view hangs a round stem about a third of the dial across
  // below the case, ending in a hex union nut (measured on the plate: stem
  // 0.80 wide from the case rim to y = -4.90, nut 1.19 across and 0.37 deep).
  // The stem sleeves the inlet pipe, which now runs down to the nut's face.
  {
    const { inletCollar } = root.userData.blocks;
    const stemTop = -3.30;
    const stemBottom = -4.90;
    const nutBottom = -5.27;
    inletCollar.geometry.dispose();
    inletCollar.geometry = horizontalRing(0.17, 0.40, stemBottom, stemTop, 64);
    inletCollar.position.set(0, 0, -0.73);
    inletCollar.material = root.userData.blocks.outerRim.material;
    inletCollar.userData.role = 'stem-below-gauge-case-over-inlet-pipe';
    const hexNut = new THREE.Shape(Array.from({ length: 6 }, (_, index) => {
      const angle = index * Math.PI / 3;
      return new THREE.Vector2(0.62 * Math.cos(angle), 0.62 * Math.sin(angle));
    }));
    const bore = new THREE.Path();
    bore.absarc(0, 0, 0.17, 0, Math.PI * 2, true);
    hexNut.holes.push(bore);
    const nutGeometry = new THREE.ExtrudeGeometry(hexNut, {
      bevelEnabled: false, curveSegments: 48, depth: stemBottom - nutBottom,
    });
    nutGeometry.rotateX(Math.PI / 2).translate(0, stemBottom, 0);
    const unionNut = addRole(new THREE.Mesh(nutGeometry, frameMaterial),
      'hex-union-nut-at-foot-of-stem');
    unionNut.position.z = -0.73;
    root.add(unionNut);
    root.userData.blocks.unionNut = unionNut;
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
  return applyCutawayFor(diaphragmPressureGauge(movement), movement.id);
}
