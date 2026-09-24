import * as THREE from 'three';
import {plate, poly, circle, capsule, disk, polygonClipping as clip} from './finite-plate-geometry.js';
import {PALETTE, matte, markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';
import {linkedVariableCrankGeometry, linkedVariableCrankAtAngle} from './linked-variable-crank-motion.js';

export function makeLinkedVariableCrank() {
  const g = linkedVariableCrankGeometry(), root = new THREE.Group(), parts = {}, families = {}, blocks = {};
  for (const name of ['fixed', 'main', 'auxiliary', 'pitman', 'rocker', 'link']) {
    blocks[name] = new THREE.Group(); blocks[name].name = 'body:' + name; root.add(blocks[name]);
  }
  const materials = new Map();
  const add = (name, geometry, family, color, position = [0, 0, 0]) => {
    if (!materials.has(color)) { const material = matte(color); material.fog = false; materials.set(color, material); }
    const mesh = new THREE.Mesh(geometry, materials.get(color)); mesh.name = name; mesh.position.set(...position);
    blocks[family].add(mesh); parts[name] = mesh; families[name] = family; return mesh;
  };
  const hole = (center, radius) => poly(circle(center, radius, 128));
  const mainShape = clip.difference(clip.union(hole([0, 0], .28), hole([g.mainRadius, 0], .20), capsule([0, 0], [g.mainRadius, 0], .10)), hole([0, 0], .104));
  add('mainCrank', plate(mainShape, -.28, -.10), 'main', PALETTE.driven);
  add('mainPin', disk(.10, -.12, .24, 96), 'main', PALETTE.ink, [g.mainRadius, 0, 0]);
  const linkShape = clip.difference(clip.union(hole([0, 0], .18), hole([g.linkLength, 0], .18), capsule([0, 0], [g.linkLength, 0], .065)), hole([0, 0], .104), hole([g.linkLength, 0], .104));
  add('connectingLink', plate(linkShape, .02, .20), 'link', PALETTE.brass);
  add('mainShaft', disk(.10, -.40, -.08, 96), 'fixed', PALETTE.ink, [...g.mainPivot, 0]);
  const auxiliaryShape = clip.difference(clip.union(hole([0, 0], .19), hole([g.radius, 0], .15), capsule([0, 0], [g.radius, 0], .09)),
    hole([0, 0], .104), hole([g.radius, 0], .104));
  add('auxiliaryCrank', plate(auxiliaryShape, .58, .76), 'auxiliary', PALETTE.brass);
  add('auxiliaryShaft', disk(.10, .50, .90, 96), 'fixed', PALETTE.ink);
  const L = g.leftSpan, R = g.rightSpan;
  // Brown's pitman is a slender tapered bar with a modest boss at the
  // auxiliary pin, not a broad plate.
  const pitmanOutline = clip.union(poly([[-L, -.10], [0, -.20], [R, -.13], [R, .13], [0, .20], [-L, .10]]),
    hole([-L, 0], .14), hole([0, 0], .22), hole([R, 0], .20));
  add('pitman', plate(clip.difference(pitmanOutline, hole([-L, 0], .104), hole([0, 0], .104), hole([R, 0], .114)), .30, .46), 'pitman', PALETTE.driver);
  add('pitmanEndPin', disk(.10, 0, .50, 96), 'pitman', PALETTE.ink, [-L, 0, 0]);
  add('auxiliaryPin', disk(.10, .28, .80, 96), 'pitman', PALETTE.ink);
  add('wristPin', disk(.11, 0, .50, 96), 'pitman', PALETTE.ink, [R, 0, 0]);
  // Only the source-visible lower length is drawn; the hidden pivot closes
  // the rigid rocker mathematically, without an invented external frame.
  const rockerOutline = clip.union(hole([0, 0], .20), poly([[0, -.14], [1.36, -.18], [1.36, .18], [0, .14]]));
  add('powerRocker', plate(clip.difference(rockerOutline, hole([0, 0], .114)), .02, .20), 'rocker', PALETTE.driven);
  const update = time => {
    const angle = g.phase + 2 * Math.PI * time / g.period, s = linkedVariableCrankAtAngle(angle, g);
    blocks.link.position.set(...s.slotPin, 0); blocks.link.rotation.z = Math.atan2(s.mainPin[1] - s.slotPin[1], s.mainPin[0] - s.slotPin[0]);
    blocks.main.position.set(...g.mainPivot, 0); blocks.main.rotation.z = s.mainAngle;
    blocks.auxiliary.rotation.z = angle;
    blocks.pitman.position.set(...s.auxiliaryPin, 0); blocks.pitman.rotation.z = s.pitmanAngle;
    blocks.rocker.position.set(...s.wrist, 0); blocks.rocker.rotation.z = Math.atan2(g.rockerPivot[1] - s.wrist[1], g.rockerPivot[0] - s.wrist[0]);
    root.updateMatrixWorld(true); root.userData.state = s;
  };
  const construction = (name, points) => {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p, -.04))),
      new THREE.LineDashedMaterial({color: PALETTE.ink, dashSize: .065, gapSize: .055, opacity: .5, transparent: true, fog: false}));
    line.name = name; line.computeLineDistances(); blocks.fixed.add(line);
  };
  construction('slotPinOrbit', Array.from({length: 513}, (_, i) => linkedVariableCrankAtAngle(i * 2 * Math.PI / 512, g).slotPin));
  construction('auxiliaryOrbit', Array.from({length: 257}, (_, i) => [g.radius * Math.cos(i * 2 * Math.PI / 256), g.radius * Math.sin(i * 2 * Math.PI / 256)]));
  const bounds = new THREE.Box3();
  for (let i = 0; i <= 128; i++) { update(g.period * i / 128); bounds.union(new THREE.Box3().setFromObject(root, true)); }
  bounds.expandByScalar(.04); update(0); markShadows(root);
  Object.assign(root.userData, {parts, families, blocks, geometry: g, mechanism: 'source-linked-variable-crank',
    simulationBackend: 'analytic', fidelity: 'authored', reconstructionStatus: 'reconstructed', supportsRestart: true,
    hideGround: true, cameraFitBounds: bounds, cameraFov: 8,
    animationTiming: {authoredCyclePeriod: g.period, displayCycleDuration: g.period, playbackTimeScale: 1},
    reconstructionNote: 'The added link replaces the slotted crank of movement 168. Rigid closure uses measured shaft spacing and pitman spans. The power rocker continues to an inferred pivot below the drawing; depths, clearances and the four-second cycle are inferred.'});
  return {root, update, reset: () => update(0), focus: bounds.getCenter(new THREE.Vector3()),
    cameraDirection: new THREE.Vector3(.01, .01, 15), dispose: () => disposeObject3D(root)};
}
