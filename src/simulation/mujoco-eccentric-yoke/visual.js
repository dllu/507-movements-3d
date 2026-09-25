import * as THREE from 'three';
import {makeEccentricYokeGeometry} from './geometry.js';
import {makeEccentricYokePhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';

export {THREE};

export function makeMujocoEccentricYoke(mujoco,options={}) {
  const visual = makeEccentricYokeGeometry(), u = visual.root.userData;
  let physics;
  try {physics = makeEccentricYokePhysics(mujoco,visual,options);}
  catch (error) {disposeObject3D(visual.root); throw error;}
  const {model,data,joints,bodies} = physics;
  const sync = () => {
    mujoco.mj_forward(model,data);
    for (const [name,id] of Object.entries(bodies)) {
      u.blocks[name].position.fromArray(data.xpos,id*3);
      u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);
    }
    u.state = {time:data.time,inputAngle:data.qpos[joints.input.q],yokePosition:data.qpos[joints.yoke.q],
      qpos:Array.from(data.qpos),qvel:Array.from(data.qvel)};
    visual.root.updateMatrixWorld(true); return u.state;
  };
  const playback = createPhysicsPlayback(physics,sync);
  let disposed = false;
  const dispose = () => {if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
  // Frame Brown's plate: the stubs to his break line over the full stroke
  // with a margin. The guides and rod runs past the plate edge stay out of
  // the fit (visible on zoom-out or rotation).
  const x = Math.max(...u.geometry.rodTips.map(Math.abs))+2*u.geometry.eccentricity+.02;
  Object.assign(u,{mechanism:'mujoco-eccentric-elongated-yoke',simulationBackend:'mujoco',physics,
    fidelity:'authored',reconstructionStatus:'integrated',supportsRestart:true,
    reconstructionNote:'The guides (just past the plate edge, carried from behind), the rod runs into them, the rear shaft bearing and depth are reconstructed. The yoke’s working faces are made straight to clear the eccentric’s full sweep.',
    cameraFitBounds:new THREE.Box3(new THREE.Vector3(-x,-2.32,-.88),new THREE.Vector3(x,2.02,.32)),
    sampledMotionBounds:{min:[-x,-2.32,-.88],max:[x,2.02,.32]},
    animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1},
    qualification:'Only the shaft is actuated. MuJoCo contact drives the passive yoke slider. Ideal bearings and guides, axial dimensions, uniform density, friction and damping are assumptions. The collision cylinder fills the shaft bore, which cannot meet the yoke.'});
  try {sync();} catch(error) {dispose();throw error;}
  return {...visual,physics,sync,...playback,dispose};
}
