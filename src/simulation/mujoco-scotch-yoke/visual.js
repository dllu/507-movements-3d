import * as THREE from 'three';
import {makeScotchYokeGeometry} from './geometry.js';
import {makeScotchYokePhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';

export {THREE};
export function makeMujocoScotchYoke(mujoco,options={}) {
  const visual=makeScotchYokeGeometry(),u=visual.root.userData;let physics;
  try{physics=makeScotchYokePhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
  const {model,data,bodies}=physics;
  const sync=()=>{
    mujoco.mj_forward(model,data);
    for(const [name,id] of Object.entries(bodies)) {
      u.blocks[name].position.fromArray(data.xpos,id*3);
      u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);
    }
    visual.root.updateMatrixWorld(true);
    u.state={time:data.time,inputAngle:data.qpos[0],yokePosition:data.qpos[1],qpos:Array.from(data.qpos),qvel:Array.from(data.qvel)};return u.state;
  };
  const playback=createPhysicsPlayback(physics,sync);let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
  const extent=u.geometry.stemEnd+u.geometry.crankRadius+.04,bounds=new THREE.Box3(new THREE.Vector3(-2.06,-extent,-.84),new THREE.Vector3(2.06,extent,.65));
  Object.assign(u,{mechanism:'mujoco-scotch-yoke',simulationBackend:'mujoco',physics,
    fidelity:'authored',reconstructionStatus:'integrated',supportsRestart:true,
    reconstructionNote:'The slot is widened to fit the measured wrist. Stem extensions, guides, rear support and depth are reconstructed.',
    cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1},
    qualification:'Only the shaft is actuated. MuJoCo wrist/slot contact moves the passive yoke. Shaft retention and guide constraints are ideal joints; material and contact parameters are assumptions.'});
  try{sync();}catch(error){dispose();throw error;}
  return {...visual,physics,sync,...playback,dispose};
}
