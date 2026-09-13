import * as THREE from 'three';
import {makeSlottedBarGeometry} from './geometry.js';
import {makeSlottedBarPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};

export function makeMujocoSlottedBar(mujoco,options={}) {
  const visual=makeSlottedBarGeometry(options),u=visual.root.userData;let physics;
  try{physics=makeSlottedBarPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
  const {model,data,bodies}=physics;
  const sync=()=>{mujoco.mj_forward(model,data);for(const [name,id] of Object.entries(bodies)){
    u.blocks[name].position.fromArray(data.xpos,id*3);u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);}
    visual.root.updateMatrixWorld(true);u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel)};return u.state;};
  const playback=createPhysicsPlayback(physics,sync);let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
  const bounds=new THREE.Box3(new THREE.Vector3(-3.6,-3.6,-.55),new THREE.Vector3(3.7,.35,.4));
  Object.assign(u,{mechanism:'mujoco-slotted-bar',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'integrated',supportsRestart:true,
    reconstructionNote:'The hanging lever drives the bar through its slot. The slot is widened slightly for the pin, and the bar is extended to stay in both guides. The swing, handle end and bearing depths are reconstructed.',
    cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1},
    qualification:'Only the hanging lever is actuated. Frictionless slot contact drives the passive bar in its ideal horizontal guide.'});
  try{sync();}catch(error){dispose();throw error;}return {...visual,physics,sync,...playback,dispose};
}
