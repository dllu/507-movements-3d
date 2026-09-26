import * as THREE from 'three';
import { circle, plate, poly, polygonClipping, ring } from './finite-plate-geometry.js';
import { markShadows } from './primitives.js';
import { lanternContact297 as c } from './lantern-pallet-contact.js';
import { lanternState297, lanternBake297 } from './lantern-pallet-playback.js';
const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
export function installLanternFinitePlayback297(root) {
  const d = root.userData, b = d.blocks, g = d.geometry;
  g.armAmplitude = c.amplitude; g.palletBodyWidth = .18; g.palletPlaneZ = c.palletZ;
  // Brown dashes arm A behind the wheel: the plain front disc carries the
  // eight pins, whose ends show on its face as Brown's circles, and the pins
  // reach back from it to the pallet layer; arm A lies behind the pin ends.
  g.trundleFront = g.sidePlateOffset + g.sidePlateDepth / 2 + .005; g.trundleRear = .10;
  g.trundleLength = g.trundleFront - g.trundleRear; g.trundleAxialCenter = (g.trundleFront + g.trundleRear) / 2;
  for (const trundle of b.trundles) {
    replace(trundle, new THREE.CylinderGeometry(c.pinRadius, c.pinRadius, g.trundleLength, 128));
    trundle.position.z = g.trundleAxialCenter;
  }
  b.wheelIndex.position.z = 1.2005;
  b.armA.position.z = c.armZ;
  const armDepth = .22, armBack = c.armZ - armDepth / 2, armFront = c.armZ + armDepth / 2;
  replace(b.armHub, ring(.166, .30, armBack - .06, armFront + .06, 96)); b.armHub.rotation.set(0, 0, 0);
  const arbor = d.lanternWorkingParts.armArbor;
  replace(arbor, new THREE.CylinderGeometry(.16, .16, armDepth + .30, 64)); arbor.position.z = c.armZ - .03;
  d.lanternWorkingParts.pairs.push([arbor, b.armHub]);
  // Arm A is one flat plate (Brown's tapered arm from its pivot, with the
  // outlines of B and C) behind the pin ends; B and C are straight bars of
  // Brown's hatched section standing forward from the plate along the pins,
  // stopping short of the disc.
  const barFront = c.palletZ + c.depth / 2, barBack = armFront - .04;
  const barOutline = bar => {
    const [cx, cy] = bar.center, u = [Math.cos(bar.angle), Math.sin(bar.angle)], v = [-u[1], u[0]];
    return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [
      cx + i * bar.length / 2 * u[0] + j * bar.width / 2 * v[0],
      cy + i * bar.length / 2 * u[1] + j * bar.width / 2 * v[1]]);
  };
  const armOutline = polygonClipping.union(
    poly([[-.27, 0], [.27, 0], [.2, -2.85], [-.45, -2.95]]),
    poly(circle([0, 0], .34, 96)),
    ...c.bars.map(bar => poly(barOutline(bar))),
  );
  replace(b.armA, plate(polygonClipping.difference(armOutline, poly(circle([0, 0], .166, 96))), -armDepth / 2, armDepth / 2));
  b.armA.position.set(0, 0, c.armZ); b.armA.rotation.set(0, 0, 0);
  b.armA.userData.role = 'one-piece-rocking-arm-A';
  for (const bar of c.bars) {
    const body = b[`pallet${bar.name}Body`], group = b[`pallet${bar.name}`];
    replace(body, new THREE.BoxGeometry(bar.length, bar.width, barFront - barBack));
    body.position.set(...bar.center, (barFront + barBack) / 2); body.rotation.z = bar.angle;
    const bridge = group.children.find(x => /rigid-mount/.test(x.userData.role));
    if (bridge) { bridge.removeFromParent(); bridge.geometry.dispose(); }
    b[`pallet${bar.name}Face`].visible = false;
    for (const child of group.children) if (/label-marker/.test(child.userData.role)) child.visible = false;
    const profile = d.palletProfiles[bar.name];
    profile.normal.multiplyScalar(-1);
    const center = new THREE.Vector2(...bar.center);
    profile.facePointLocal = center.clone().addScaledVector(profile.normal, bar.width / 2);
    profile.workingRange = [-bar.length / 2, bar.length / 2];
    profile.workingFaceLocalPoints = profile.workingRange.map(x => profile.facePointLocal.clone().addScaledVector(profile.tangent, x));
    Object.assign(profile, { finiteBar: bar, sourceLongAxisPreserved: true });
  }
  b.contactMarker.visible = false;
  const update = time => {
    const s = lanternState297(time);
    b.armAssembly.rotation.z = s.armAngle; b.wheelRotor.rotation.z = s.wheelAngle;
    b.armAssembly.userData.angularSpeed = s.armAngularSpeed;
    b.wheelRotor.userData.angularSpeed = s.wheelAngularSpeed;
    b.wheelRotor.userData.angularAcceleration = s.wheelAngularAcceleration;
    d.kinematics = s; d.contacts = s.contact;
  };
  d.stateAtTime = lanternState297; d.stateAtCyclePhase = phase => lanternState297(phase * c.period);
  for (const key of ['contactPinAngle', 'contactPinAngleDerivatives', 'palletFaceFrame', 'dropState', 'trundleIndexForHalfBeat']) delete d[key];
  for (const key of ['dropDuration', 'dropHalfPhaseDuration', 'landingHalfPhase', 'releaseHalfPhase']) delete g[key];
  d.canonicalTimes = { palletB: 1, palletBRelease: 2.5625, dropToC: 2.7, palletC: 3.2, palletCRelease: 3.8025, dropToB: 0, oneArmOscillation: 4 };
  d.canonicalStates = Object.fromEntries(Object.entries(d.canonicalTimes).map(([name, time]) => [name, lanternState297(time)]));
  Object.assign(d.transmission, { recoil: 'finite contact produces recoil; released wheel coasts under the applied torque and can rebound on landing',
    dynamics: 'offline MuJoCo with an imposed arm oscillator and constant wheel torque' });
  delete d.transmission.evenToOddDropAdvance; delete d.transmission.oddToEvenDropAdvance;
  d.timeline = { demonstrationPeriod: 4, schedule: ['finite-B-contact', 'inherited-speed-free-drop', 'finite-C-contact', 'inherited-speed-free-drop'] };
  d.lanternFiniteContact = { bars: c.bars, bake: lanternBake297.metadata,
    collisionModel: 'planar sphere/box supports equal the visible cylinder/box supports; all motion is constrained to XY',
    softContactCorrection: 'offline projection onto finite bar surfaces, maximum angle correction below 0.0015 rad' };
  d.reconstructionNote = 'Offline MuJoCo drives the full trundles against finite B/C bars; release retains wheel speed, with landing rebound. Arm motion, constant torque and frictionless contact are prescribed assumptions, not a self-running clock. The inferred ±18° stroke, B shifted 0.25 along its axis, C length 1.28, and the pins reaching back from the disc to the pallet bars make the finite geometry compatible; they are not dimensioned in the engraving. A sub-0.0015-radian offline projection removes solver overlap; spring, bearing loss and impact compliance remain unvalidated.';
  root.traverse(o => { for (const mat of [].concat(o.material ?? [])) mat.fog = false; });
  markShadows(root);
  for (const marker of [b.wheelIndex, b.rimIndex, b.contactMarker]) marker.castShadow = marker.receiveShadow = false;
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  for (let i = 0; i <= 64; i++) {
    update(c.period * i / 64); root.updateMatrixWorld(true);
    root.traverseVisible(o => { const p = o.geometry?.attributes.position;
      if (p) for (let j = 0; j < p.count; j++) bounds.expandByPoint(point.fromBufferAttribute(p, j).applyMatrix4(o.matrixWorld)); });
  }
  d.cameraFitBounds = bounds.expandByScalar(.15); update(0);
  return update;
}
