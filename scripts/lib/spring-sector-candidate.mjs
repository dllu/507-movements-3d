import * as THREE from 'three';
import source from './spring-sector-source.mjs';
import {plate, poly, circle, ring, disk, polygonClipping as clip} from '../../src/simulation/finite-plate-geometry.js';
import {PALETTE, matte, markShadows} from '../../src/simulation/primitives.js';

// Review cameras use the same Vite-resolved Three instance as the model.
export {THREE};

// Static reconstruction candidate. The source does not specify how each arc
// rises while remaining angularly fast on B; no spring/guide or motion law is
// invented here. Explicit state inputs keep the missing mechanics visible.
export function makeSpringSectorCandidate() {
  const root = new THREE.Group(), parts = {}, families = {}, blocks = {}, profiles = {};
  const scale = source.scale, p = source.profile, pitch = 2 * Math.PI / p.divisions;
  const point = q => [(q[0] - source.center[0]) / scale, (source.center[1] - q[1]) / scale];
  const polar = (radius, angle) => [radius * Math.cos(angle) / scale, radius * Math.sin(angle) / scale];
  const phase = p.phaseDegrees * Math.PI / 180, [first, last] = p.tipIndices;
  const edge = [polar(p.rootRadiusPixels, phase + (first - 1 + p.shortFaceFraction) * pitch)];
  for (let i = first; i <= last; i++) {
    edge.push(polar(p.tipRadiusPixels, phase + i * pitch));
    if (i < last) edge.push(polar(p.rootRadiusPixels, phase + (i + p.shortFaceFraction) * pitch));
  }
  const outline = clip.union(poly([point([562, 416]), ...edge, point([651, 414])]),
    poly(circle([0, 0], source.circles.rockshaftEyeOuter.radius / scale, 128)));
  const holes = ['leftOpening', 'rightOpening'].map(name => {
    const curve = new THREE.CatmullRomCurve3(source.landmarks[name].map(q => new THREE.Vector3(...point(q), 0)), true, 'centripetal');
    return poly(curve.getPoints(192).slice(0, -1).map(q => [q.x, q.y]));
  });
  const sectorProfile = clip.difference(outline, ...holes, poly(circle([0, 0], 25 / scale, 128)));
  const attach = (name, geometry, family, color, position = [0, 0, 0]) => {
    blocks[family] ??= new THREE.Group(); if (!blocks[family].parent) root.add(blocks[family]);
    const mesh = new THREE.Mesh(geometry, matte(color, {metalness: .14, roughness: .62}));
    mesh.name = name; mesh.position.fromArray(position); blocks[family].add(mesh);
    parts[name] = mesh; families[name] = family; return mesh;
  };
  // Equal nominal circular pitch is only a layout choice. Finite crown/sector
  // contact must determine the final count, flank shapes, and depth placement.
  const wheelTeeth = 38, sectorPitchRadius = (p.tipRadiusPixels + p.rootRadiusPixels) / (2 * scale);
  const wheelPitchRadius = sectorPitchRadius * wheelTeeth / p.divisions;
  const wheelOuterRadius = (source.landmarks.wheel.right - source.landmarks.wheel.left) / (2 * scale);
  const wheelInnerRadius = 2 * wheelPitchRadius - wheelOuterRadius;
  const wheelTop = (source.center[1] - 899) / scale, wheelBottom = (source.center[1] - 968) / scale;
  const toothHeight = 27 / scale, depth = 24 / scale;
  for (const [name, sign, color] of [['front', 1, PALETTE.brass], ['rear', -1, PALETTE.driver]]) {
    const shape = sectorProfile.map(polygon => polygon.map(contour => contour.map(([x, y]) => [sign * x, y])));
    profiles[name] = shape;
    attach(name + 'Sector', plate(shape, -depth / 2, depth / 2), name, color);
  }
  const pin = point(source.circles.rodEyeOuter.center), rodEnd = point([1020, 282]);
  const crankOutline = clip.union(poly([point([587, 209]), point([626, 209]), point([638, 358]), point([578, 358])]),
    poly(circle([0, 0], source.circles.rockshaftEyeOuter.radius / scale, 128)),
    poly(circle(pin, source.circles.rodEyeOuter.radius / scale, 128)));
  const crank = clip.difference(crankOutline, poly(circle([0, 0], 25 / scale, 128)), poly(circle(pin, 22.6 / scale, 128)));
  attach('crank', plate(crank, -.15, -.075), 'shaft', PALETTE.driver, [0, 0, wheelPitchRadius]);
  const rodAngle = Math.atan2(rodEnd[1] - pin[1], rodEnd[0] - pin[0]);
  const normal = [-Math.sin(rodAngle) * 21 / scale, Math.cos(rodAngle) * 21 / scale];
  const offset = (q, sign) => q.map((v, i) => v + sign * normal[i]);
  const rodOutline = clip.union(poly([offset(pin, 1), offset(rodEnd, 1), offset(rodEnd, -1), offset(pin, -1)]),
    poly(circle(pin, source.circles.rodEyeOuter.radius / scale, 128)));
  attach('inputRod', plate(clip.difference(rodOutline, poly(circle(pin, source.circles.rodEyeInner.radius / scale, 128))), .065, .135),
    'rod', PALETTE.accent, [0, 0, wheelPitchRadius]);
  attach('inputPin', disk(21.8 / scale, -.153, .138, 128), 'shaft', PALETTE.muted, [...pin, wheelPitchRadius]);
  attach('rockshaft', disk(24 / scale, -wheelPitchRadius - .2, wheelPitchRadius + .058, 128), 'shaft', PALETTE.muted);
  const body = attach('wheelBody', ring(24 / scale, wheelOuterRadius, wheelBottom, wheelTop, 256), 'wheel', PALETTE.driven);
  body.rotation.x = -Math.PI / 2;
  const wheelPitch = 2 * Math.PI / wheelTeeth, crownPhase = Math.PI / 2;
  // Flat normals on individual faces preserve the wedge corners. Each tooth
  // is a closed six-vertex prism; there are no bevels enlarging contact faces.
  for (let i = 0; i < wheelTeeth; i++) {
    const a = crownPhase + i * wheelPitch, b = a + wheelPitch * .94;
    const q = (r, angle, y) => [r * Math.cos(angle), y, r * Math.sin(angle)];
    const vertices = [q(wheelInnerRadius, a, wheelTop), q(wheelOuterRadius, a, wheelTop),
      q(wheelInnerRadius, b, wheelTop), q(wheelOuterRadius, b, wheelTop),
      q(wheelInnerRadius, a, wheelTop + toothHeight), q(wheelOuterRadius, a, wheelTop + toothHeight)];
    const indices = [0, 2, 3, 0, 3, 1, 4, 5, 3, 4, 3, 2, 0, 1, 5, 0, 5, 4, 0, 4, 2, 1, 3, 5];
    // Swapping the original axial-Z and radial-Y coordinates reverses handedness.
    for (let j = 0; j < indices.length; j += 3) [indices[j + 1], indices[j + 2]] = [indices[j + 2], indices[j + 1]];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3)); geometry.setIndex(indices);
    const flat = geometry.toNonIndexed(); geometry.dispose(); flat.computeVertexNormals();
    attach('wheelTooth' + i, flat, 'wheel', PALETTE.driven);
  }
  const hub = attach('wheelHub', ring(24 / scale, 88 / scale, (source.center[1] - 1012) / scale, wheelBottom, 128), 'wheel', PALETTE.driven);
  hub.rotation.x = -Math.PI / 2;
  const axle = attach('outputAxle', disk(23 / scale, (source.center[1] - 1155) / scale, wheelTop - .005, 128), 'fixed', PALETTE.muted);
  axle.rotation.x = -Math.PI / 2;
  const setState = ({shaftAngle = 0, wheelAngle = 0, lifts = [0, 0]} = {}) => {
    blocks.wheel.rotation.y = wheelAngle; blocks.shaft.rotation.z = shaftAngle;
    for (const [i, name] of ['front', 'rear'].entries()) {
      blocks[name].rotation.z = shaftAngle;
      blocks[name].position.set(0, lifts[i], (i === 0 ? 1 : -1) * wheelPitchRadius);
    }
    // Nonzero shaft poses require solving the rectilinear input linkage and
    // the lift guides before this construction can be used as an animation.
    root.updateMatrixWorld(true); root.userData.state = {shaftAngle, wheelAngle, lifts: [...lifts]};
  };
  root.userData = {parts, families, blocks, profiles, source, setState, geometry: {sectorPitchRadius,
    wheelTeeth, wheelPitchRadius, wheelInnerRadius, wheelOuterRadius, wheelTop, wheelBottom, toothHeight, depth},
    mechanism: 'isolated-spring-sector-geometry-candidate', fidelity: 'candidate', hideGround: true, cameraFov: 8,
    qualification: 'Static source-layout study. Crown count/depth, springs, guides, finite contact, ordinary-pin input kinematics and supporting bearings remain unqualified.'};
  setState(); markShadows(root); return {root, setState, update: () => setState(), cameraDirection: new THREE.Vector3(0, 0, 10)};
}
