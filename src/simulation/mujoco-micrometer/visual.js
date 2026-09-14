import * as THREE from 'three';
import {makeMicrometerGeometry} from './geometry.js';
import {makeMicrometerPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};
export function makeMujocoMicrometer(mujoco,options={}) {
 const visual=makeMicrometerGeometry(options),u=visual.root.userData;let physics;
 try{physics=makeMicrometerPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
 const sync=()=>{const {model,data,bodies}=physics;mujoco.mj_forward(model,data);for(const [name,id]of Object.entries(bodies)){u.blocks[name].position.fromArray(data.xpos,id*3);u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);}visual.root.updateMatrixWorld(true);u.section.update(data.qpos[0],data.qpos[1]);return u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel),pose:physics.coordinates(),contacts:data.ncon};};
 const playback=createPhysicsPlayback(physics,sync);let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
 const f=u.profile,bounds=new THREE.Box3(new THREE.Vector3(-.45,f.tipLow-.05,-.45),new THREE.Vector3(.45,f.top+f.pitchOuter*f.turns+.1,.45));
 Object.assign(u,{mechanism:'mujoco-micrometer',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'under-review',supportsRestart:true,cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
  reconstructionNote:'Matching nested threads give the difference between the two pitches. The inner thread’s hand is corrected, and the sleeve is widened to fit it. Section view exposes the fit. Screw joints and the omitted antirotation guide are ideal.',
  animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1}});
 try{sync();}catch(error){dispose();throw error;}return {...visual,physics,sync,...playback,dispose};
}
