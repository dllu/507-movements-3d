import * as THREE from 'three';
import { ring } from './finite-plate-geometry.js';
import { markShadows } from './primitives.js';
import { lanternContact297 as c } from './lantern-pallet-contact.js';
import { lanternState297, lanternBake297 } from './lantern-pallet-playback.js';
const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
export function installLanternFinitePlayback297(root) {
  const d = root.userData, b = d.blocks, g = d.geometry;
  g.armAmplitude = c.amplitude; g.palletBodyWidth = .18; g.palletPlaneZ = c.palletZ;
  g.trundleLength = 2.01; g.trundleAxialCenter = .195; g.trundleFront = 1.20; g.trundleRear = -.81;
  for (const trundle of b.trundles) {
    replace(trundle, new THREE.CylinderGeometry(c.pinRadius, c.pinRadius, g.trundleLength, 128));
    trundle.position.z = g.trundleAxialCenter;
  }
  b.wheelIndex.position.z = 1.2005;
  b.armA.position.z = c.armZ;
  replace(b.armHub, ring(.166, .34, -.95, 1.61, 96)); b.armHub.rotation.set(0, 0, 0);
  const arbor = d.lanternWorkingParts.armArbor;
  replace(arbor, new THREE.CylinderGeometry(.16, .16, 3.26, 64)); arbor.position.z = -.02;
  d.lanternWorkingParts.pairs.push([arbor, b.armHub]);
  const mounts = [];
  for (const bar of c.bars) {
    const body = b[`pallet${bar.name}Body`], group = b[`pallet${bar.name}`];
    replace(body, new THREE.BoxGeometry(bar.length, bar.width, c.depth));
    body.position.set(...bar.center, c.palletZ); body.rotation.z = bar.angle;
    const bridge = group.children.find(x => /rigid-mount/.test(x.userData.role));
    const direction = new THREE.Vector2(-1.02, -3.62).normalize();
    const center = new THREE.Vector2(...bar.center), attach = direction.multiplyScalar(center.dot(direction));
    replace(bridge, new THREE.BoxGeometry(center.distanceTo(attach) + .08, .14, .18));
    bridge.position.set((center.x + attach.x) / 2, (center.y + attach.y) / 2, c.armZ);
    bridge.rotation.z = Math.atan2(center.y - attach.y, center.x - attach.x);
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .48, 24), body.material);
    mount.rotation.x = Math.PI / 2; mount.position.set(...bar.center, 1.34);
    mount.userData.role = `finite-axial-pallet-${bar.name}-mount-in-bar-footprint`;
    group.add(mount); mounts.push(mount);
    b[`pallet${bar.name}Face`].visible = false;
    for (const child of group.children) if (/label-marker/.test(child.userData.role)) child.visible = false;
    const profile = d.palletProfiles[bar.name];
    profile.normal.multiplyScalar(-1);
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
  d.lanternFiniteContact = { bars: c.bars, mounts, bake: lanternBake297.metadata,
    collisionModel: 'planar sphere/box supports equal the visible cylinder/box supports; all motion is constrained to XY',
    softContactCorrection: 'offline projection onto finite bar surfaces, maximum angle correction below 0.0015 rad' };
  d.reconstructionNote = 'Offline MuJoCo drives the full trundles against finite B/C bars; release retains wheel speed, with landing rebound. Arm motion, constant torque and frictionless contact are prescribed assumptions, not a self-running clock. The inferred ±18° stroke, B shifted 0.25 along its axis, C length 1.28, and forward trundle ends make the finite geometry compatible; they are not dimensioned in the engraving. A sub-0.0015-radian offline projection removes solver overlap; spring, bearing loss and impact compliance remain unvalidated.';
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
