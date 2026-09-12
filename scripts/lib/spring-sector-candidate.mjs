import * as THREE from 'three';
import source from './spring-sector-source.mjs';
import {plate, poly, circle, capsule, ring, disk, polygonClipping as clip} from '../../src/simulation/finite-plate-geometry.js';
import {PALETTE, matte, markShadows} from '../../src/simulation/primitives.js';
import {makeSpringRackCoil} from './spring-rack-coil.mjs';
import {makeSpringSectorLinkage} from './spring-sector-linkage.mjs';

// Review cameras use the same Vite-resolved Three instance as the model.
export {THREE};

// Isolated reconstruction candidate. Twin radial guides behind each plate
// retain shaft clocking while allowing spring-supported rise. The engraving
// specifies the function but leaves this guide construction unshown.
export function makeSpringSectorCandidate() {
  const root = new THREE.Group(), parts = {}, families = {}, blocks = {}, profiles = {};
  const linkage = makeSpringSectorLinkage(), springs = [];
  const scale = source.scale, p = source.profile, pitch = 2 * Math.PI / p.divisions;
  const point = q => [(q[0] - source.center[0]) / scale, (source.center[1] - q[1]) / scale];
  const polar = (radius, angle) => [radius * Math.cos(angle) / scale, radius * Math.sin(angle) / scale];
  const phase = p.phaseDegrees * Math.PI / 180, [first, last] = p.tipIndices;
  const edge = [polar(p.rootRadiusPixels, phase + (first - 1 + p.shortFaceFraction) * pitch)];
  for (let i = first; i <= last; i++) {
    edge.push(polar(p.tipRadiusPixels, phase + i * pitch));
    if (i < last) edge.push(polar(p.rootRadiusPixels, phase + (i + p.shortFaceFraction) * pitch));
  }
  const outline = poly([point([562, 416]), ...edge, point([651, 414])]);
  const holes = ['leftOpening', 'rightOpening'].map(name => {
    const curve = new THREE.CatmullRomCurve3(source.landmarks[name].map(q => new THREE.Vector3(...point(q), 0)), true, 'centripetal');
    return poly(curve.getPoints(192).slice(0, -1).map(q => [q.x, q.y]));
  });
  // Shaft clearance is hidden behind the fixed hub cover. This is a guide
  // clearance in the sector, not a slot in the ordinary-pin input rod.
  const sectorProfile = clip.difference(outline, ...holes, capsule([0, -.18], [0, .06], 25 / scale, 64));
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
  const toothHeight = 27 / scale, depth = 24 / scale, guideOffset = -.2;
  for (const [name, sign, color] of [['front', 1, PALETTE.brass], ['rear', -1, PALETTE.driver]]) {
    const shape = sectorProfile.map(polygon => polygon.map(contour => contour.map(([x, y]) => [sign * x, y])));
    profiles[name] = shape;
    attach(name + 'Sector', plate(shape, -depth / 2, depth / 2), name, color);
    const plane = sign * wheelPitchRadius, guideZ = -sign * .17;
    const cover = clip.difference(clip.union(poly(circle([0, 0], source.circles.rockshaftEyeOuter.radius / scale, 128)),
      capsule([0, 0], [0, -.18], .12, 48)), poly(circle([0, 0], 25 / scale, 128)));
    attach(name + 'HubCover', plate(cover, Math.min(sign * .065, sign * .125), Math.max(sign * .065, sign * .125)),
      'shaft', color, [0, 0, plane]);
    attach(name + 'CarrierHub', ring(25 / scale, .2, Math.min(-sign * .30, -sign * .25), Math.max(-sign * .30, -sign * .25), 128),
      'shaft', PALETTE.muted, [0, 0, plane]);
    const frame = clip.union(poly([[-.18, -.51], [.18, -.51], [.18, -.45], [-.18, -.45]]),
      poly([[-.18, -.04], [.18, -.04], [.18, .02], [-.18, .02]]),
      poly([[-.18, -.48], [-.14, -.48], [-.14, -.01], [-.18, -.01]]),
      poly([[.14, -.48], [.18, -.48], [.18, -.01], [.14, -.01]]));
    attach(name + 'GuideFrame', plate(frame, Math.min(-sign * .21, -sign * .12), Math.max(-sign * .21, -sign * .12)),
      'shaft', PALETTE.muted, [0, guideOffset, plane]);
    attach(name + 'CarrierBridge', new THREE.BoxGeometry(.30, .055, .18), 'shaft', PALETTE.muted, [0, -.008 + guideOffset, plane - sign * .21]);
    for (const [i, x] of [-.09, .09].entries()) {
      const localBack = -guideZ + sign * .038, localFront = sign * depth / 2;
      const boss = clip.difference(poly([[x - .045, localFront], [x + .045, localFront], [x + .045, localBack], [x - .045, localBack]]),
        poly(circle([x, -guideZ], .018, 64)));
      const housing = attach(name + 'SliderHousing' + i, plate(boss, -.39 + guideOffset, -.27 + guideOffset), name, color);
      housing.rotation.x = -Math.PI / 2;
      const rod = attach(name + 'GuideRod' + i, disk(.015, -.48 + guideOffset, -.02 + guideOffset, 64), 'shaft', PALETTE.muted, [x, 0, plane + guideZ]);
      rod.rotation.x = -Math.PI / 2;
      const coil = makeSpringRackCoil({turns: 4, radius: .024, wireRadius: .004, referenceSpan: .222, segments: 128, sides: 12});
      const family = name + 'Spring' + i;
      attach(family, coil.geometry, family, PALETTE.ink);
      springs.push({name, side: sign === 1 ? 0 : 1, family, x, plane, guideZ, coil});
    }
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
    // On the visible front half, the high edge is on the left and the long
    // ramp descends toward +X, as in D in the engraving. This lets the front
    // sector's steep face drive the wheel during the positive shaft stroke.
    const a = crownPhase - i * wheelPitch, b = a - wheelPitch * .94;
    const q = (r, angle, y) => [r * Math.cos(angle), y, r * Math.sin(angle)];
    const vertices = [q(wheelInnerRadius, a, wheelTop), q(wheelOuterRadius, a, wheelTop),
      q(wheelInnerRadius, b, wheelTop), q(wheelOuterRadius, b, wheelTop),
      q(wheelInnerRadius, a, wheelTop + toothHeight), q(wheelOuterRadius, a, wheelTop + toothHeight)];
    const indices = [0, 2, 3, 0, 3, 1, 4, 5, 3, 4, 3, 2, 0, 1, 5, 0, 5, 4, 0, 4, 2, 1, 3, 5];
    // The descending angular order and the Y-axis mapping reverse handedness
    // twice, so these faces are already outward-wound.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices.flat(), 3)); geometry.setIndex(indices);
    const flat = geometry.toNonIndexed(); geometry.dispose(); flat.computeVertexNormals();
    attach('wheelTooth' + i, flat, 'wheel', PALETTE.driven);
  }
  const hub = attach('wheelHub', ring(24 / scale, 88 / scale, (source.center[1] - 1012) / scale, wheelBottom, 128), 'wheel', PALETTE.driven);
  hub.rotation.x = -Math.PI / 2;
  // The output axle turns with D. Its matching 128-sided hub bore provides
  // the fixed joint; the wheel body's finer bore has a small chord clearance.
  const axle = attach('outputAxle', disk(24 / scale, (source.center[1] - 1155) / scale, wheelTop - .005, 128), 'wheel', PALETTE.muted);
  axle.rotation.x = -Math.PI / 2;
  const setState = ({shaftAngle = 0, wheelAngle = 0, lifts = [0, 0]} = {}) => {
    if (lifts.some(lift => lift < -.06 || lift > .18)) throw Error('Sector guide travel exceeded');
    blocks.wheel.rotation.y = wheelAngle; blocks.shaft.rotation.z = shaftAngle;
    for (const [i, name] of ['front', 'rear'].entries()) {
      blocks[name].rotation.z = shaftAngle;
      blocks[name].position.set(-Math.sin(shaftAngle) * lifts[i], Math.cos(shaftAngle) * lifts[i], (i === 0 ? 1 : -1) * wheelPitchRadius);
    }
    for (const spring of springs) {
      spring.coil.update(-.27 + guideOffset + lifts[spring.side], -.04 + guideOffset, spring.x, spring.guideZ);
      blocks[spring.family].position.set(0, 0, spring.plane); blocks[spring.family].rotation.z = shaftAngle;
    }
    const input = linkage.atAngle(shaftAngle);
    blocks.rod.rotation.z = input.angleDelta; blocks.rod.position.set(...input.translation, 0);
    root.updateMatrixWorld(true); root.userData.state = {shaftAngle, wheelAngle, lifts: [...lifts], input};
  };
  root.userData = {parts, families, blocks, profiles, source, setState, linkage, springs, geometry: {sectorPitchRadius,
    wheelTeeth, wheelPitchRadius, wheelInnerRadius, wheelOuterRadius, wheelTop, wheelBottom, toothHeight, depth, guideOffset},
    mechanism: 'isolated-spring-sector-geometry-candidate', fidelity: 'candidate', hideGround: true, cameraFov: 8,
    qualification: 'Reconstruction study with paired radial spring guides and ordinary-pin input closure. Hidden guide construction is an explicit assumption. Crown contact dynamics, guide loads, supporting bearings and final playback remain unqualified.'};
  setState(); markShadows(root); return {root, setState, update: () => setState(), cameraDirection: new THREE.Vector3(0, 0, 10)};
}
