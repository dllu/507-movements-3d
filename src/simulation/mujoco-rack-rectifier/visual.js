import * as THREE from 'three';
import {makeRackRectifierGeometry} from './geometry.js';
import {makeRackRectifierPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};
export function makeMujocoRackRectifier(mujoco,options={}){
 const visual=makeRackRectifierGeometry(options),u=visual.root.userData;let physics;
 try{physics=makeRackRectifierPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
 const sync=()=>{const {model,data,bodies,joints}=physics;mujoco.mj_forward(model,data);for(const [n,id]of Object.entries(bodies)){u.blocks[n].position.fromArray(data.xpos,3*id);u.blocks[n].quaternion.set(data.xquat[4*id+1],data.xquat[4*id+2],data.xquat[4*id+3],data.xquat[4*id]);}visual.root.updateMatrixWorld(true);return u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel),positions:Object.fromEntries(Object.entries(joints).map(([n,j])=>[n,data.qpos[j.q]])),velocities:Object.fromEntries(Object.entries(joints).map(([n,j])=>[n,data.qvel[j.v]])),contacts:data.ncon};};
 const playback=createPhysicsPlayback(physics,sync);let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
 Object.assign(u,{mechanism:'mujoco-rack-rectifier',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'verified',supportsRestart:true,reconstructionNote:'The two loose pinions carry pawls that alternately drive the common shaft through ratchet contact. Pawl springs, hidden depth and ideal bearings and guides are reconstructed.',animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1}});
 try{sync();}catch(error){dispose();throw error;}return{...visual,physics,sync,...playback,dispose};
}
