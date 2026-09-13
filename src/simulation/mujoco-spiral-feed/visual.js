import * as THREE from 'three';
import {makeSpiralFeedGeometry} from './geometry.js';
import {makeSpiralFeedPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};

export function makeMujocoSpiralFeed(mujoco,options={}) {
  const visual=makeSpiralFeedGeometry(options),u=visual.root.userData;let physics;
  try{physics=makeSpiralFeedPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
  const {model,data,bodies}=physics;
  const sync=()=>{mujoco.mj_forward(model,data);for(const [name,id] of Object.entries(bodies)){
    u.blocks[name].position.fromArray(data.xpos,id*3);u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);}
    visual.root.updateMatrixWorld(true);u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel)};return u.state;};
  const playback=createPhysicsPlayback(physics,sync);let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
  const bounds=new THREE.Box3(new THREE.Vector3(-2.1,-4.12,-.96),new THREE.Vector3(2.1,2.1,.68));
  Object.assign(u,{mechanism:'mujoco-spiral-feed',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'integrated',supportsRestart:true,
    reconstructionNote:'Section view exposes the roller. Spiral corrections reach 8 engraving pixels; the guide is lowered by 6 pixels. The rod extension, roller journal and reversing drive are reconstructed.',
    cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1},
    qualification:'Only the disk is actuated. Native contact with adjacent spiral turns drives the passive feed rod and free roller. The external drive reverses before the follower leaves the open spiral.'});
  try{sync();}catch(error){dispose();throw error;}return {...visual,physics,sync,...playback,dispose};
}
