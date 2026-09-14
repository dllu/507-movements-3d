import * as THREE from 'three';
import {makeHalfNutGeometry} from './geometry.js';
import {makeHalfNutPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};
export function makeMujocoHalfNut(mujoco,options={}) {
 const visual=makeHalfNutGeometry(options),u=visual.root.userData;let physics;
 try{physics=makeHalfNutPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
 const sync=()=>{const {model,data,bodies}=physics;mujoco.mj_forward(model,data);
  for(const [name,id]of Object.entries(bodies)){u.blocks[name].position.fromArray(data.xpos,id*3);u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);}
  visual.root.updateMatrixWorld(true);return u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel),contacts:data.ncon,selectorTarget:physics.control.target,transitions:physics.control.transitions.length};};
 const playback=createPhysicsPlayback(physics,sync);let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
 const bounds=new THREE.Box3(new THREE.Vector3(-2.1,-1.55,-.8),new THREE.Vector3(3,1.9,.8));
 Object.assign(u,{mechanism:'mujoco-half-nut',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'candidate',supportsRestart:true,cameraFitBounds:bounds,
  sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},reconstructionNote:'Opposite-hand screw threads drive the rod through alternate half-nuts. The selector is operated automatically for the demonstration. Bearings, depth and travel limits are reconstructed.',
  animationTiming:{authoredCyclePeriod:18,displayCycleDuration:18,playbackTimeScale:1}});
 try{sync();}catch(error){dispose();throw error;}
 return {...visual,physics,sync,...playback,dispose};
}
