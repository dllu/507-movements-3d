import * as THREE from 'three';
import {makeBellCrankGeometry} from './geometry.js';
import {makeBellCrankPhysics} from './physics.js';
import {bowDrillTube} from '../mujoco-bow-drill/geometry.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};

export function makeMujocoBellCrank(mujoco,options={}){
 const visual=makeBellCrankGeometry(options),u=visual.root.userData;let physics;
 try{physics=makeBellCrankPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
 const sync=()=>{
  const{data,model,bodies}=physics;mujoco.mj_forward(model,data);
  for(const[n,id]of Object.entries(bodies)){u.blocks[n].position.fromArray(data.xpos,3*id);u.blocks[n].quaternion.set(data.xquat[4*id+1],data.xquat[4*id+2],data.xquat[4*id+3],data.xquat[4*id]);}
  for(const name of ['input','output']){const points=physics.getCordPoints(name),geometry=bowDrillTube(points,points.map(()=>u.profile.cordRadius));u.parts[name+'Cord'].geometry.dispose();u.parts[name+'Cord'].geometry=geometry;}
  visual.root.updateMatrixWorld(true);
  return u.state={time:data.time,qpos:Object.fromEntries(Object.entries(physics.joints).map(([n,j])=>[n,data.qpos[j.q]])),qvel:Object.fromEntries(Object.entries(physics.joints).map(([n,j])=>[n,data.qvel[j.v]])),contacts:data.ncon};
 };
 const playback=createPhysicsPlayback(physics,sync);let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
 Object.assign(u,{mechanism:'mujoco-bell-crank',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'under-review',supportsRestart:true,reconstructionNote:'The input cord turns the pulley and pulls the bell crank to redirect the output force. Bearings, cord clamps, endpoint guides, return load and hidden depths are reconstructed. Native contact and clearances remain under review.',animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1}});
 try{sync();}catch(error){dispose();throw error;}
 return{...visual,physics,sync,...playback,dispose};
}
