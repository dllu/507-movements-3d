import * as THREE from 'three';
import {makeHeartCamGeometry} from './geometry.js';
import {makeHeartCamPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};
export function makeMujocoHeartCam(mujoco,options={}) {
  const visual=makeHeartCamGeometry(options),u=visual.root.userData;let physics;
  try{physics=makeHeartCamPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
  const {model,data,bodies}=physics;
  const sync=()=>{mujoco.mj_forward(model,data);for(const [name,id] of Object.entries(bodies)){
    u.blocks[name].position.fromArray(data.xpos,id*3);u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);}
    u.updateSpring(data.qpos[1]);visual.root.updateMatrixWorld(true);u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel)};return u.state;};
  const playback=createPhysicsPlayback(physics,sync);let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
  const bounds=new THREE.Box3(new THREE.Vector3(-1.70,-1.7,-.84),new THREE.Vector3(3.98,1.7,.5));
  Object.assign(u,{mechanism:'mujoco-heart-cam',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'integrated',supportsRestart:true,
    reconstructionNote:'The cam outline is corrected by up to 11 engraving pixels for the roller and smooth reversals. The bar is shifted up 6 pixels to align with the shaft and runs on past Brown’s break into inferred guides just beyond the plate edge; an added return spring (not displayed) maintains contact.',
    cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1},
    qualification:'Only the cam shaft is actuated. Native contact drives the bar and roller against an ideal linear spring; the visible coil follows its compression. Axle, guides, depth and spring properties are inferred.'});
  try{sync();}catch(error){dispose();throw error;}return {...visual,physics,sync,...playback,dispose};
}
