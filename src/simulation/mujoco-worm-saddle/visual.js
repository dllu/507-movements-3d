import * as THREE from 'three';
import {makeWormSaddleGeometry} from './geometry.js';
import {makeWormSaddlePhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
import {saddleWheelCut} from './wheel-data.js';
export {THREE};
export function makeMujocoWormSaddle(mujoco,{cut=saddleWheelCut,...options}={}) {
  const visual=makeWormSaddleGeometry(cut,options),u=visual.root.userData;let physics;
  try{physics=makeWormSaddlePhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
  const {model,data,bodies}=physics;
  const sync=()=>{mujoco.mj_forward(model,data);for(const [n,id] of Object.entries(bodies)){
    u.blocks[n].position.fromArray(data.xpos,id*3);u.blocks[n].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);}
    visual.root.updateMatrixWorld(true);u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel),mode:u.configuration};return u.state;};
  const playback=createPhysicsPlayback(physics,sync);let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
  const bounds=new THREE.Box3(new THREE.Vector3(-1.85,-1.45,-.40),new THREE.Vector3(2.15,1.40,.55));
  Object.assign(u,{mechanism:'mujoco-worm-saddle',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'integrated',supportsRestart:true,
    configuration:options.mode??'worm',configurationLabel:'Input',configurations:[{id:'worm',label:'Screw drives wheel'},{id:'wheel',label:'Wheel moves slide'}],
    setConfiguration:value=>{physics.setMode(value);u.configuration=value;playback.reset();},
    cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    reconstructionNote:'Choose the screw or wheel as input. An ideal gear coupling drives the wheel or slide through matching tooth geometry. Backlash and tooth friction are omitted. Tooth count, bearings, guide, depths and reversing drive are reconstructed.',
    animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1}});
  try{sync();}catch(error){dispose();throw error;}return {...visual,physics,sync,...playback,dispose};
}
