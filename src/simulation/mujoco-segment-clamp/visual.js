import * as THREE from 'three';
import {makeSegmentClampGeometry} from './geometry.js';
import {makeSegmentClampPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};
export function makeMujocoSegmentClamp(mujoco,options={}){
 const visual=makeSegmentClampGeometry(options),u=visual.root.userData;let physics;
 try{physics=makeSegmentClampPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
 const sync=()=>{const {model,data,bodies}=physics;mujoco.mj_forward(model,data);for(const[n,id]of Object.entries(bodies)){u.blocks[n].position.fromArray(data.xpos,3*id);u.blocks[n].quaternion.set(data.xquat[4*id+1],data.xquat[4*id+2],data.xquat[4*id+3],data.xquat[4*id]);}visual.root.updateMatrixWorld(true);return u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel),contacts:data.ncon};};
 const playback=createPhysicsPlayback(physics,sync);let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
 Object.assign(u,{mechanism:'mujoco-segment-clamp',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'verified',supportsRestart:true,reconstructionNote:'A compound shaft drives the two jaws through external and internal tooth contact. The default stroke closes the two jaw points onto one spot against native jaw contact, with both segments on their pinions. Bearings are ideal; the reversing drive, recessed frame arms and hidden jaw widths are reconstructed.',animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1}});
 try{sync();}catch(error){dispose();throw error;}return{...visual,physics,sync,...playback,dispose};
}
