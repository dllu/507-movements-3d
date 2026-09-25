import * as THREE from 'three';
import {plate, poly, circle, capsule, disk, polygonClipping as clip} from './finite-plate-geometry.js';
import {PALETTE, matte, markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';
import {sourceVariableCrankGeometry, variableRadiusCrankAtAngle} from './variable-radius-crank-motion.js';

export function makeVariableRadiusCrank() {
  const g = sourceVariableCrankGeometry(), root = new THREE.Group(), parts = {}, families = {}, blocks = {};
  for (const name of ['fixed', 'main', 'auxiliary', 'pitman', 'rocker']) {
    blocks[name] = new THREE.Group(); blocks[name].name = 'body:' + name; root.add(blocks[name]);
  }
  const materials = new Map();
  const add = (name, geometry, family, color, position = [0, 0, 0]) => {
    if (!materials.has(color)) { const material = matte(color); material.fog = false; materials.set(color, material); }
    const mesh = new THREE.Mesh(geometry, materials.get(color)); mesh.name = name; mesh.position.set(...position);
    blocks[family].add(mesh); parts[name] = mesh; families[name] = family; return mesh;
  };
  const hole = (center, radius) => poly(circle(center, radius, 128));
  const mainOutline = clip.union(hole([0, 0], .312), capsule([.20, 0], [1.46, 0], .18));
  const mainShape = clip.difference(mainOutline, hole([0, 0], .104), capsule([.35, 0], [1.46, 0], .088));
  add('slottedCrank', plate(mainShape, 0, .18), 'main', PALETTE.driven);
  add('mainShaft', disk(.10, -.30, .22, 96), 'fixed', PALETTE.ink, [...g.mainPivot, 0]);
  const auxiliaryShape = clip.difference(clip.union(hole([0, 0], .19), capsule([0, 0], [g.radius, 0], .15)),
    hole([0, 0], .104), hole([g.radius, 0], .104));
  add('auxiliaryCrank', plate(auxiliaryShape, .58, .76), 'auxiliary', PALETTE.brass);
  add('auxiliaryShaft', disk(.10, .50, .90, 96), 'fixed', PALETTE.ink);
  const L = g.leftSpan, R = g.rightSpan;
  // Brown's pitman is a slender tapered bar with a modest boss at the
  // auxiliary pin, not a broad plate.
  const pitmanOutline = clip.union(poly([[-L, -.10], [0, -.20], [R, -.13], [R, .13], [0, .20], [-L, .10]]),
    hole([-L, 0], .14), hole([0, 0], .22), hole([R, 0], .20));
  add('pitman', plate(clip.difference(pitmanOutline, hole([-L, 0], .076), hole([0, 0], .104), hole([R, 0], .114)), .30, .46), 'pitman', PALETTE.driver);
  add('slotPin', disk(.072, -.02, .50, 96), 'pitman', PALETTE.ink, [-L, 0, 0]);
  add('auxiliaryPin', disk(.10, .28, .80, 96), 'pitman', PALETTE.ink);
  add('wristPin', disk(.11, 0, .50, 96), 'pitman', PALETTE.ink, [R, 0, 0]);
  // Only the source-visible lower length is drawn; the hidden pivot closes
  // the rigid rocker mathematically, without an invented external frame.
  const rockerOutline = clip.union(hole([0, 0], .20), poly([[0, -.14], [1.36, -.18], [1.36, .18], [0, .14]]));
  add('powerRocker', plate(clip.difference(rockerOutline, hole([0, 0], .114)), .02, .20), 'rocker', PALETTE.driven);
  const update = time => {
    const angle = g.phase + 2 * Math.PI * time / g.period, s = variableRadiusCrankAtAngle(angle, g);
    blocks.main.position.set(...g.mainPivot, 0); blocks.main.rotation.z = s.mainAngle;
    blocks.auxiliary.rotation.z = angle;
    blocks.pitman.position.set(...s.auxiliaryPin, 0); blocks.pitman.rotation.z = s.pitmanAngle;
    blocks.rocker.position.set(...s.wrist, 0); blocks.rocker.rotation.z = Math.atan2(g.rockerPivot[1] - s.wrist[1], g.rockerPivot[0] - s.wrist[0]);
    root.updateMatrixWorld(true); root.userData.state = s;
  };
  // Brown's dashed pin orbits are construction notation and are not drawn.
  const bounds = new THREE.Box3();
  for (let i = 0; i <= 128; i++) { update(g.period * i / 128); bounds.union(new THREE.Box3().setFromObject(root, true)); }
  bounds.expandByScalar(.04); update(0); markShadows(root);
  // The initial fit measures posed vertices only; an unrendered envelope of
  // the whole swing keeps the rocker inside the frame later in the cycle.
  const envelope = new THREE.Mesh(new THREE.BoxGeometry(...bounds.getSize(new THREE.Vector3()).multiplyScalar(.999).toArray()),
    new THREE.MeshBasicMaterial({colorWrite: false, depthWrite: false, transparent: true, opacity: 0, fog: false}));
  envelope.position.copy(bounds.getCenter(new THREE.Vector3())); envelope.name = 'invisible-swept-camera-envelope';
  envelope.userData.cameraFitGuide = true; envelope.castShadow = envelope.receiveShadow = false; root.add(envelope);
  Object.assign(root.userData, {parts, families, blocks, geometry: g, mechanism: 'source-variable-radius-crank',
    simulationBackend: 'analytic', fidelity: 'authored', reconstructionStatus: 'reconstructed', supportsRestart: true,
    hideGround: true, cameraFitBounds: bounds, cameraFov: 8,
    animationTiming: {authoredCyclePeriod: g.period, displayCycleDuration: g.period, playbackTimeScale: 1},
    reconstructionNote: 'Rigid linkage closure uses the engraved unequal pitman spans. The power rocker continues to an inferred pivot above the drawing. The later animation validates the closure method with its own dimensions; depths, clearances and the four-second cycle are inferred.'});
  return {root, update, reset: () => update(0), focus: bounds.getCenter(new THREE.Vector3()),
    cameraDirection: new THREE.Vector3(.01, .01, 15), dispose: () => disposeObject3D(root)};
}
