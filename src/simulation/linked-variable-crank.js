import * as THREE from 'three';
import {plate, poly, circle, capsule, disk, polygonClipping as clip} from './finite-plate-geometry.js';
import {PALETTE, matte, markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';
import {supportMaterial} from './back-plate-support.js';
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
  // Both crank shafts run back into plain bearings flanged to the framing
  // behind the mechanism (z = -0.55), so neither floats. The small crank sits
  // just behind the pitman, where its sweep clears the link and main pin.
  add('mainShaft', disk(.10, -.55, -.08, 96), 'fixed', PALETTE.ink, [...g.mainPivot, 0]);
  const bearing = (name, center, front) => {
    add(name, plate(clip.difference(hole([0, 0], .2), hole([0, 0], .104)), -.47, front), 'fixed', PALETTE.muted, [...center, 0]);
    add(name + 'Flange', plate(clip.difference(hole([0, 0], .27), hole([0, 0], .104)), -.55, -.47), 'fixed', PALETTE.muted, [...center, 0]);
  };
  bearing('mainShaftBearing', g.mainPivot, -.30);
  bearing('auxiliaryShaftBearing', [0, 0], -.06);
  const auxiliaryShape = clip.difference(clip.union(hole([0, 0], .19), hole([g.radius, 0], .15), capsule([0, 0], [g.radius, 0], .09)),
    hole([0, 0], .104), hole([g.radius, 0], .104));
  add('auxiliaryCrank', plate(auxiliaryShape, .215, .295), 'auxiliary', PALETTE.brass);
  add('auxiliaryShaft', disk(.10, -.55, .295, 96), 'fixed', PALETTE.ink);
  const L = g.leftSpan, R = g.rightSpan;
  // Brown's pitman is a slender tapered bar with a modest boss at the
  // auxiliary pin, not a broad plate.
  const pitmanOutline = clip.union(poly([[-L, -.10], [0, -.20], [R, -.13], [R, .13], [0, .20], [-L, .10]]),
    hole([-L, 0], .14), hole([0, 0], .22), hole([R, 0], .20));
  add('pitman', plate(clip.difference(pitmanOutline, hole([-L, 0], .104), hole([0, 0], .104), hole([R, 0], .114)), .30, .46), 'pitman', PALETTE.driver);
  add('pitmanEndPin', disk(.10, 0, .50, 96), 'pitman', PALETTE.ink, [-L, 0, 0]);
  add('auxiliaryPin', disk(.10, .215, .52, 96), 'pitman', PALETTE.ink);
  add('wristPin', disk(.11, 0, .50, 96), 'pitman', PALETTE.ink, [R, 0, 0]);
  // Brown crops the power rocker 1.36 from its wrist. It is whole: it runs
  // on to its fixed fulcrum pin, carried by a bearing block, beyond the
  // plate's view.
  const Lr = g.rockerLength;
  const rockerOutline = clip.union(hole([0, 0], .20), hole([Lr, 0], .26),
    poly([[0, -.14], [1.36, -.18], [Lr, -.2], [Lr, .2], [1.36, .18], [0, .14]]));
  add('powerRocker', plate(clip.difference(rockerOutline, hole([0, 0], .114), hole([Lr, 0], .124)), .02, .20), 'rocker', PALETTE.driven);
  add('rockerFulcrumPin', disk(.12, -.22, .26, 96), 'fixed', PALETTE.ink, [...g.rockerPivot, 0]);
  add('rockerFulcrumBearing', plate(clip.difference(clip.union(hole([0, 0], .34), poly([[-.34, 0], [.34, 0], [.42, -.62], [-.42, -.62]])),
    hole([0, 0], .124)), -.20, 0), 'fixed', PALETTE.muted, [...g.rockerPivot, 0]);
  // Brown draws no frame. Each shaft bearing's flange and the rocker's
  // fulcrum block are carried by a stay running straight back to a round
  // flange on the framing wall behind the mechanism; stay and flange lie
  // within the bearing flange's outline, so the plate's view is unchanged.
  {
    const frame = supportMaterial(); frame.fog = false;
    const support = new THREE.Group(); support.userData.role = 'fixed-framing-behind-crank-bearings';
    const aux = new THREE.Vector2(0, 0), main = new THREE.Vector2(...g.mainPivot), zWall = -1.6;
    const stay = (role, x, y, zFront) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, zFront - zWall), frame); bar.position.set(x, y, (zFront + zWall) / 2);
      bar.userData.role = role; bar.name = role;
      const flange = new THREE.Mesh(disk(.26, zWall - .08, zWall, 64), frame); flange.position.set(x, y, 0);
      flange.userData.role = role + '-flange'; flange.name = role + '-flange';
      support.add(bar, flange);
    };
    stay('fixed-stay-from-auxiliary-bearing-to-framing-wall', aux.x, aux.y, -.55);
    stay('fixed-stay-from-main-bearing-to-framing-wall', main.x, main.y, -.55);
    stay('fixed-stay-from-rocker-fulcrum-block-to-framing-wall', ...g.rockerPivot, -.20);
    support.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    blocks.fixed.add(support);
  }

  // The default view frames Brown's drawn length of the rocker only.
  const drawnRocker = new THREE.Mesh(plate(poly([[0, -.2], [1.36, -.2], [1.36, .2], [0, .2]]), .02, .20));
  const update = time => {
    const angle = g.phase + 2 * Math.PI * time / g.period, s = linkedVariableCrankAtAngle(angle, g);
    blocks.link.position.set(...s.slotPin, 0); blocks.link.rotation.z = Math.atan2(s.mainPin[1] - s.slotPin[1], s.mainPin[0] - s.slotPin[0]);
    blocks.main.position.set(...g.mainPivot, 0); blocks.main.rotation.z = s.mainAngle;
    blocks.auxiliary.rotation.z = angle;
    blocks.pitman.position.set(...s.auxiliaryPin, 0); blocks.pitman.rotation.z = s.pitmanAngle;
    blocks.rocker.position.set(...s.wrist, 0); blocks.rocker.rotation.z = Math.atan2(g.rockerPivot[1] - s.wrist[1], g.rockerPivot[0] - s.wrist[0]);
    root.updateMatrixWorld(true); root.userData.state = s;
  };
  // Brown's dashed pin orbits are construction notation and are not drawn.
  const bounds = new THREE.Box3();
  for (let i = 0; i <= 128; i++) {
    update(g.period * i / 128);
    for (const name of ['main', 'auxiliary', 'pitman', 'link']) bounds.union(new THREE.Box3().setFromObject(blocks[name], true));
    for (const name of ['mainShaft', 'auxiliaryShaft']) bounds.union(new THREE.Box3().setFromObject(parts[name], true));
    drawnRocker.position.copy(blocks.rocker.position); drawnRocker.rotation.copy(blocks.rocker.rotation); drawnRocker.updateMatrixWorld(true);
    bounds.union(new THREE.Box3().setFromObject(drawnRocker, true));
  }
  drawnRocker.geometry.dispose();
  bounds.expandByScalar(.04); update(0); markShadows(root);
  Object.assign(root.userData, {parts, families, blocks, geometry: g, mechanism: 'source-linked-variable-crank',
    simulationBackend: 'analytic', fidelity: 'authored', reconstructionStatus: 'reconstructed', supportsRestart: true,
    hideGround: true, cameraFitBounds: bounds, cameraFov: 8,
    animationTiming: {authoredCyclePeriod: g.period, displayCycleDuration: g.period, playbackTimeScale: 1},
    reconstructionNote: 'The added link replaces the slotted crank of movement 168. Rigid closure uses measured shaft spacing and pitman spans. The power rocker runs whole to an inferred fulcrum pin and bearing block below the drawing; both crank shafts turn in inferred rear bearings; depths, clearances and the four-second cycle are inferred.'});
  return {root, update, reset: () => update(0), focus: bounds.getCenter(new THREE.Vector3()),
    cameraDirection: new THREE.Vector3(.01, .01, 15), dispose: () => disposeObject3D(root)};
}
