import * as THREE from 'three';
import {makeEndlessGrooveGeometry} from './geometry.js';
import {makeEndlessGroovePhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};

export function makeMujocoEndlessGroove(mujoco,options={}) {
  const visual=makeEndlessGrooveGeometry(options),u=visual.root.userData;let physics;
  try{physics=makeEndlessGroovePhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
  const {model,data,bodies}=physics;
  const sync=()=>{mujoco.mj_forward(model,data);for(const [name,id] of Object.entries(bodies)){
    u.blocks[name].position.fromArray(data.xpos,id*3);u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);}
    visual.root.updateMatrixWorld(true);u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel)};return u.state;};
  const playback=createPhysicsPlayback(physics,sync);let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
  const bounds=new THREE.Box3(new THREE.Vector3(-1.75,-1.75,-1.02),new THREE.Vector3(2.9,2.95,.3));
  Object.assign(u,{mechanism:'mujoco-endless-groove',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'integrated',supportsRestart:true,
    reconstructionNote:'Section view removes the arm’s front cover to reveal its rear groove. With the drawn crank radius, the pin reverses along one side of the loop. The larger working pin, bearing support and hidden depths are reconstructed.',
    cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1},
    qualification:'Only the circular disk is actuated. Native pin contact with both groove faces drives the passive hinged arm. No branch changes or arm trajectory are prescribed.'});
  try{sync();}catch(error){dispose();throw error;}return {...visual,physics,sync,...playback,dispose};
}
