import * as THREE from 'three';
import {makeReverseThreadGeometry} from './geometry.js';
import {makeReverseThreadPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};
export function makeMujocoReverseThread(mujoco,options={}) {
 const visual=makeReverseThreadGeometry(options),u=visual.root.userData;let physics;
 try{physics=makeReverseThreadPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
 const {model,data,bodies}=physics;
 const sync=()=>{mujoco.mj_forward(model,data);for(const [name,id] of Object.entries(bodies)){u.blocks[name].position.fromArray(data.xpos,id*3);u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);}visual.root.updateMatrixWorld(true);return u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel),contacts:data.ncon};};
 const playback=createPhysicsPlayback(physics,sync);let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
 const bounds=new THREE.Box3(new THREE.Vector3(-1.8,-1.95,-.9),new THREE.Vector3(.9,1.85,.9));
 Object.assign(u,{mechanism:'mujoco-reverse-thread',cameraFov:14,simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'under-review',supportsRestart:true,cameraFitBounds:bounds,
  sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},reconstructionNote:'A swiveling shoe follows the intersecting grooves through each return. The double-start groove (two starts per hand, two and a half barrel turns per traverse, five front crossings), the circular barrel, shoe, depths and ideal bearings are reconstructed.',animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1}});
 try{sync();}catch(error){dispose();throw error;}return{...visual,physics,sync,...playback,dispose};
}
