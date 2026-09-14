import * as THREE from 'three';
import {makePersianDrillGeometry} from './geometry.js';
import {makePersianDrillPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};
export function makeMujocoPersianDrill(mujoco,options={}) {
 const visual=makePersianDrillGeometry(options),u=visual.root.userData;let physics;
 try{physics=makePersianDrillPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
 const sync=()=>{const {model,data,bodies}=physics;mujoco.mj_forward(model,data);for(const [n,id]of Object.entries(bodies)){u.blocks[n].position.fromArray(data.xpos,3*id);u.blocks[n].quaternion.set(data.xquat[4*id+1],data.xquat[4*id+2],data.xquat[4*id+3],data.xquat[4*id]);}visual.root.updateMatrixWorld(true);return u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel),contacts:data.ncon};};
 const playback=createPhysicsPlayback(physics,sync);let disposed=false;const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
 const f=u.profile,bounds=new THREE.Box3(new THREE.Vector3(-.6,f.tip-.08,-.6),new THREE.Vector3(.6,f.top+.08,.6));
 Object.assign(u,{mechanism:'mujoco-persian-drill',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'integrated',supportsRestart:true,cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},reconstructionNote:'Moving the hand grip turns the drill through matching screw threads. Six starts are inferred from the engraving; the head bearing and the hand’s grip against rotation are ideal.',animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1}});
 try{sync();}catch(error){dispose();throw error;}return {...visual,physics,sync,...playback,dispose};
}
