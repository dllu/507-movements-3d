import * as THREE from 'three';
import {makeReversibleClickGeometry} from './geometry.js';
import {makeReversibleClickPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};
export function makeMujocoReversibleClick(mujoco,options={}){
 const visual=makeReversibleClickGeometry(options),u=visual.root.userData;let physics;
 try{physics=makeReversibleClickPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
 const sync=()=>{const {model,data,bodies}=physics;mujoco.mj_forward(model,data);for(const[n,id]of Object.entries(bodies)){u.blocks[n].position.fromArray(data.xpos,3*id);u.blocks[n].quaternion.set(data.xquat[4*id+1],data.xquat[4*id+2],data.xquat[4*id+3],data.xquat[4*id]);}visual.root.updateMatrixWorld(true);return u.state={time:data.time,qpos:Object.fromEntries(Object.entries(physics.joints).map(([n,j])=>[n,data.qpos[j.q]])),qvel:Object.fromEntries(Object.entries(physics.joints).map(([n,j])=>[n,data.qvel[j.v]])),contacts:data.ncon};};
 const playback=createPhysicsPlayback(physics,sync);let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
 Object.assign(u,{mechanism:'mujoco-reversible-click',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'verified',supportsRestart:true,configuration:options.mode??'forward',configurationLabel:'Click position',configurations:[{id:'forward',label:'As engraved'},{id:'reverse',label:'Thrown over'}],setConfiguration:value=>{physics.setMode(value);u.configuration=value;playback.reset();},reconstructionNote:'The rod rocks the disk, and the hinged click drives the cog by tooth contact. Throwing over the click reverses the feed. The upper guide, pin joints, depths, click damping and resisting shaft load are inferred.',animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1}});
 try{sync();}catch(error){dispose();throw error;}return{...visual,physics,sync,...playback,dispose};
}
