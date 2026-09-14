import * as THREE from 'three';
import {makeRackPinionGeometry} from './geometry.js';
import {makeRackPinionPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};
export function makeMujocoRackPinion(mujoco,options={}){
 const visual=makeRackPinionGeometry(options),u=visual.root.userData;let physics;
 try{physics=makeRackPinionPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
 const sync=()=>{const {model,data,bodies}=physics;mujoco.mj_forward(model,data);for(const [n,id]of Object.entries(bodies)){u.blocks[n].position.fromArray(data.xpos,3*id);u.blocks[n].quaternion.set(data.xquat[4*id+1],data.xquat[4*id+2],data.xquat[4*id+3],data.xquat[4*id]);}visual.root.updateMatrixWorld(true);return u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel),contacts:data.ncon,mode:u.configuration};};
 const playback=createPhysicsPlayback(physics,sync);let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
 const f=u.profile,bounds=new THREE.Box3(new THREE.Vector3(f.left-f.amplitude-.1,-.65,-.3),new THREE.Vector3(f.right+f.amplitude+.1,1.35,.5));
 Object.assign(u,{mechanism:'mujoco-rack-pinion',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'integrated',supportsRestart:true,configuration:options.mode??'pinion',configurationLabel:'Input',configurations:[{id:'pinion',label:'Pinion drives rack'},{id:'rack',label:'Rack turns pinion'}],setConfiguration:value=>{physics.setMode(value);u.configuration=value;playback.reset();},cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},reconstructionNote:'Choose the pinion or rack as input. Matching involute teeth transmit motion by contact, and the rollers turn freely. Tooth spacing, depths, shaft bearings and the rack’s orientation guide are reconstructed.',animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1}});
 try{sync();}catch(error){dispose();throw error;}return {...visual,physics,sync,...playback,dispose};
}
