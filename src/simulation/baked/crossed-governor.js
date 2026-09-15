import * as THREE from 'three';
import {loadBakedBundle, sampleBakedMotion} from './playback.js';
import {makeCrossedGovernorUpdater} from '../mujoco-crossed-governor/update-solids.js';
import {disposeObject3D} from '../dispose-model.js';

export function makeCrossedGovernorModel(bundle) {
  const root = new THREE.ObjectLoader().parse(bundle.object), sync = makeCrossedGovernorUpdater(root, bundle.geometry);
  const bounds = new THREE.Box3(new THREE.Vector3(...bundle.bounds.min), new THREE.Vector3(...bundle.bounds.max));
  const parts = {}, families = {}; let disposed = false;
  root.traverse(o => { if (o.isMesh) {
    parts[o.name] = o; let b = o.parent; while (b && !b.name.startsWith('body:')) b = b.parent;
    const family = b?.name.slice(5);
    families[o.name] = family === 'inputBevel' ? 'input' : family === 'outputBevel' ? 'rotor' : family;
  } });
  const update = time => {
    if (disposed) throw new Error('Movement disposed');
    const q = sampleBakedMotion(bundle, time);
    sync(Object.fromEntries(bundle.names.map((name, i) => [name, q[i]])));
  };
  Object.assign(root.userData, {parts, families, geometry: bundle.geometry, mechanism: 'crossed-arm-governor',
    simulationBackend: 'baked-mujoco', fidelity: 'authored', reconstructionStatus: 'reconstructed', supportsRestart: true,
    hideGround: true, cameraFitBounds: bounds, sampledMotionBounds: bundle.bounds, cameraFov: 8,
    animationTiming: {authoredCyclePeriod: bundle.period, displayCycleDuration: bundle.period, playbackTimeScale: 1},
    reconstructionNote: 'Crossed arms pull the valve rod through two short links. Their motion is baked from passive MuJoCo dynamics; the spindle speed, masses, damping and bearing details are inferred. Equal bevel gearing is scripted; steam feedback is not modeled.'});
  update(0);
  return {root, update, reset: () => update(0), focus: new THREE.Vector3(...bundle.focus), cameraDirection: new THREE.Vector3(...bundle.cameraDirection),
    dispose: () => { if (!disposed) { disposed = true; disposeObject3D(root); } }};
}
export async function makeBakedCrossedGovernor() {
  return makeCrossedGovernorModel(await loadBakedBundle(new URL('./assets/170.json.gz', import.meta.url)));
}
