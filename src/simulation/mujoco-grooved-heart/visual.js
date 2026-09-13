import * as THREE from 'three';
import {makeGroovedHeartGeometry} from './geometry.js';
import {makeGroovedHeartPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};

export function makeMujocoGroovedHeart(mujoco,options={}) {
  const visual=makeGroovedHeartGeometry(options),u=visual.root.userData;let physics;
  try{physics=makeGroovedHeartPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
  const {model,data,bodies}=physics;
  const sync=()=>{mujoco.mj_forward(model,data);for(const [name,id] of Object.entries(bodies)){
    u.blocks[name].position.fromArray(data.xpos,id*3);u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);}
    visual.root.updateMatrixWorld(true);u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel)};return u.state;};
  const playback=createPhysicsPlayback(physics,sync);let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
  const bounds=new THREE.Box3(new THREE.Vector3(-1.95,-1.95,-.84),new THREE.Vector3(3.92,1.95,.56));
  Object.assign(u,{mechanism:'mujoco-grooved-heart',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'integrated',supportsRestart:true,
    reconstructionNote:'The groove follows the drawing, with varying traverse speed. The bar is raised 5 engraving pixels and the rim enlarged by 5 pixels. Guides, the cylindrical pin and hidden depths are reconstructed.',
    cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1},
    qualification:'Only the shaft is actuated. Native contact with both groove faces drives the passive bar without a spring. The fixed cylindrical pin slides in the groove; its construction and the ideal guide are inferred.'});
  try{sync();}catch(error){dispose();throw error;}return {...visual,physics,sync,...playback,dispose};
}
