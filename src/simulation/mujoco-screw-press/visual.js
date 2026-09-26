import * as THREE from 'three';
import {makeScrewPressGeometry} from './geometry.js';
import {makeScrewPressPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};
export function makeMujocoScrewPress(mujoco,options={}) {
  const visual=makeScrewPressGeometry(options),u=visual.root.userData;let physics;
  try{physics=makeScrewPressPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
  const {model,data,bodies}=physics;
  const sync=()=>{mujoco.mj_forward(model,data);for(const [name,id] of Object.entries(bodies)){
    u.blocks[name].position.fromArray(data.xpos,id*3);u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);}
    visual.root.updateMatrixWorld(true);u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel),contacts:data.ncon};return u.state;};
  const playback=createPhysicsPlayback(physics,sync);let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
  const bounds=new THREE.Box3(new THREE.Vector3(-2.15,-2.65,-2.15),new THREE.Vector3(2.15,1.65,2.15));
  // Brown breaks the frame off just below the raised ram. The default view
  // keeps his handle-to-ram composition and carries it on down to the foot of
  // the lower jaw, so the anvil and the struck blank sit wholly in view.
  const plateWindow=new THREE.Box3(new THREE.Vector3(-1.8,u.profile.baseBottom,-.25),new THREE.Vector3(1.95,1.5,.25));
  Object.assign(u,{mechanism:'mujoco-screw-press',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'integrated',supportsRestart:true,
    // The generic fit distance is sized for the window's bounding sphere;
    // this scale brings the window's height edge to edge as Brown crops it.
    cameraFitBounds:plateWindow,cameraDistanceScale:.8,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    reconstructionNote:'Turning the weighted handle lowers the guided ram onto a rigid blank. Section view exposes the threads and swivel. Their joints are ideal; thread friction is omitted. The lower frame, anvil, hidden bearing, depths and reversing drive are reconstructed.',
    animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1}});
  try{sync();}catch(error){dispose();throw error;}
  return {...visual,physics,sync,...playback,dispose};
}
