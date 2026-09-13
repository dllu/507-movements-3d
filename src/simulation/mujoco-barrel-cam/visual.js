import * as THREE from 'three';
import {makeBarrelCamGeometry} from './geometry.js';
import {makeBarrelCamPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};
export function makeMujocoBarrelCam(mujoco,options={}) {
  const visual=makeBarrelCamGeometry(options),u=visual.root.userData;let physics;
  try{physics=makeBarrelCamPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
  const {model,data,bodies}=physics;
  const sync=()=>{mujoco.mj_forward(model,data);for(const [name,id] of Object.entries(bodies)){
    u.blocks[name].position.fromArray(data.xpos,id*3);u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);}
    visual.root.updateMatrixWorld(true);u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel),contacts:data.ncon};return u.state;};
  const playback=createPhysicsPlayback(physics,sync);let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
  const bounds=new THREE.Box3(new THREE.Vector3(-1.95,-1.15,-1.15),new THREE.Vector3(1.75,2.65,1.15));
  Object.assign(u,{mechanism:'mujoco-barrel-cam',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'integrated',supportsRestart:true,
    cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    reconstructionNote:'A pin in the rotating groove drives the guided rod. The groove is corrected for uniform travel with short smooth reversals. The rounded working end, rigid attachment, depths and ideal shaft bearings are reconstructed.',
    animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1}});
  try{sync();}catch(error){dispose();throw error;}return{...visual,physics,sync,...playback,dispose};
}
