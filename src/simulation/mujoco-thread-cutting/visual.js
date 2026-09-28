import * as THREE from 'three';
import {makeThreadCuttingGeometry} from './geometry.js';
import {makeThreadCuttingPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};
export function makeMujocoThreadCutting(mujoco,options={}) {
 const visual=makeThreadCuttingGeometry(options),u=visual.root.userData;let physics;
 try{physics=makeThreadCuttingPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
 const {model,data,bodies}=physics;
 const sync=()=>{mujoco.mj_forward(model,data);physics.observe(data);for(const [name,id]of Object.entries(bodies)){u.blocks[name].position.fromArray(data.xpos,id*3);u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);}
  u.syncCut(data.time,data.qpos[1],physics.description.options.period);visual.root.updateMatrixWorld(true);
  return u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel),maximumWorkAngle:physics.progress.maximumWorkAngle};};
 const playback=createPhysicsPlayback(physics,sync);let disposed=false;
 const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
 const bounds=new THREE.Box3(new THREE.Vector3(-1.6,-1.9,-1.4),new THREE.Vector3(1.6,1.7,1.4));
 Object.assign(u,{mechanism:'mujoco-thread-cutting',cameraFov:9,simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'under-review',supportsRestart:true,cameraFitBounds:bounds,
  sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},reconstructionNote:'Change gears set the pitch cut by the guided tool: the drawn gear rims fix a 52:76 pair, so the work thread is 76/52 as coarse as the lead screw where Brown draws them nearly equal. The shaft depth offset and opposite-handed cut correct the drawing. The thread is cut only where the tool has passed on its descent, with the plain blank below; the tool returns up its finished groove and a fresh blank replaces the screw at the top. Bearings, gears and screw feed are ideal; material removal is shown geometrically.',
  animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1}});
 try{sync();}catch(error){dispose();throw error;}return {...visual,physics,sync,...playback,dispose};
}
