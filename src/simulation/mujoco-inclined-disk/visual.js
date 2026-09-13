import * as THREE from 'three';
import {makeInclinedDiskGeometry} from './geometry.js';
import {makeInclinedDiskPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};
export function makeMujocoInclinedDisk(mujoco,options={}) {
  const visual=makeInclinedDiskGeometry(options),u=visual.root.userData;let physics;
  try{physics=makeInclinedDiskPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
  const {model,data,bodies}=physics;
  const sync=()=>{mujoco.mj_forward(model,data);for(const [name,id] of Object.entries(bodies)){
    u.blocks[name].position.fromArray(data.xpos,id*3);u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);}
    visual.root.updateMatrixWorld(true);u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel)};return u.state;};
  const playback=createPhysicsPlayback(physics,sync);let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
  const bounds=new THREE.Box3(new THREE.Vector3(-1.46,-2.74,-1.78),new THREE.Vector3(2.88,1.68,1.46));
  Object.assign(u,{mechanism:'mujoco-inclined-disk',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'integrated',supportsRestart:true,
    reconstructionNote:'The fork holds a freely turning roller. Its radial axle, the rod guide, wall depth and hidden hub are reconstructed; the disk is completed beyond the engraving’s broken left edge.',
    cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1},
    qualification:'Only the upright shaft is actuated. MuJoCo contact and gravity move the ideally guided rod and turn its passive roller. Depth, materials and friction are inferred.'});
  try{sync();}catch(error){dispose();throw error;}return {...visual,physics,sync,...playback,dispose};
}
