import * as THREE from 'three';
import {makeCascadedTraverseGeometry} from './geometry.js';
import {makeCascadedTraversePhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};
export function makeMujocoCascadedTraverse(mujoco,options={}){
 const visual=makeCascadedTraverseGeometry(options),u=visual.root.userData;let physics;
 try{physics=makeCascadedTraversePhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
 const sync=()=>{const{data,bodies}=physics;mujoco.mj_forward(physics.model,data);for(const[n,id]of Object.entries(bodies)){u.blocks[n].position.fromArray(data.xpos,3*id);u.blocks[n].quaternion.set(data.xquat[4*id+1],data.xquat[4*id+2],data.xquat[4*id+3],data.xquat[4*id]);}visual.root.updateMatrixWorld(true);return u.state={time:data.time,qpos:Object.fromEntries(Object.entries(physics.joints).map(([n,j])=>[n,data.qpos[j.q]])),qvel:Object.fromEntries(Object.entries(physics.joints).map(([n,j])=>[n,data.qvel[j.v]])),contacts:data.ncon};};
 const playback=createPhysicsPlayback(physics,sync);let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
 Object.assign(u,{mechanism:'mujoco-cascaded-traverse',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'verified',supportsRestart:true,reconstructionNote:'Three unequal gears drive two cascaded links and a passive output stem. Gear teeth, coaxial axes, both central vertical guides and hidden depths are reconstructed.',animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1}});
 try{sync();}catch(error){dispose();throw error;}return{...visual,physics,sync,...playback,dispose};
}
