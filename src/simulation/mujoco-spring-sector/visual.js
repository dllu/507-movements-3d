import * as THREE from 'three';
import {makeSpringSectorGeometry} from './geometry.js';
import {makeSpringSectorPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';

export {THREE};

export function makeMujocoSpringSector(mujoco, options = {}) {
  const visual = makeSpringSectorGeometry(), u = visual.root.userData;
  let physics;
  try { physics = makeSpringSectorPhysics(mujoco, visual, options); }
  catch (error) { disposeObject3D(visual.root); throw error; }
  const {model, data, joints, bodies} = physics;
  const sync = () => {
    mujoco.mj_forward(model, data);
    for (const [name, id] of Object.entries(bodies)) {
      const block = u.blocks[name]; if (!block) continue;
      block.position.fromArray(data.xpos, id * 3);
      block.quaternion.set(data.xquat[id * 4 + 1], data.xquat[id * 4 + 2], data.xquat[id * 4 + 3], data.xquat[id * 4]);
    }
    const shaftAngle = data.qpos[joints.shaft.q], lifts = ['front', 'rear'].map(name => data.qpos[joints[name].q]);
    for (const spring of u.springs) {
      spring.coil.update(-.27 + u.geometry.guideOffset + lifts[spring.side], -.04 + u.geometry.guideOffset, spring.x, spring.guideZ);
      u.blocks[spring.family].position.set(0, 0, spring.plane); u.blocks[spring.family].rotation.z = shaftAngle;
    }
    u.state = {time: data.time, shaftAngle, wheelAngle: data.qpos[joints.wheel.q], lifts,
      wheelSpeed: data.qvel[joints.wheel.v], qpos: Array.from(data.qpos), qvel: Array.from(data.qvel)};
    visual.root.updateMatrixWorld(true);
    return u.state;
  };
  const playback = createPhysicsPlayback(physics, sync);
  let disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; physics.dispose(); disposeObject3D(visual.root); };
  Object.assign(u, {mechanism: 'mujoco-spring-sector-crown-ratchet', simulationBackend: 'mujoco', physics,
    fidelity: 'authored', reconstructionStatus: 'integrated', supportsRestart: true,
    reconstructionNote: 'The springs are described in Brown’s text. Their guides, the remote input support and dimensions in depth are reconstructed.',
    cameraFitBounds: new THREE.Box3(new THREE.Vector3(-2.43,-3.80,-2.16),new THREE.Vector3(4.75,1.30,2.16)),
    sampledMotionBounds: {min:[-2.43,-3.80,-2.16],max:[4.75,1.30,2.16]},
    shadowCameraHalfExtent:6,shadowBias:-.00003,shadowNormalBias:.003,
    animationTiming: {authoredCyclePeriod: physics.description.options.period, displayCycleDuration: physics.description.options.period, playbackTimeScale: 1},
    qualification: 'One input slider drives the pinned rod and rockshaft. MuJoCo advances the passive spring-guided sectors and crown wheel. Hidden guides, supports, masses, spring stiffness, damping and contact properties are reconstruction assumptions; the engraving does not specify them.'});
  try { sync(); } catch (error) { dispose(); throw error; }
  return {...visual, physics, sync, ...playback, dispose};
}
