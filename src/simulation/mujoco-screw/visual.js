import * as THREE from 'three';
import {makeScrewGeometry} from './geometry.js';
import {makeScrewPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};

export function makeMujocoScrew(mujoco,options={}) {
  const visual=makeScrewGeometry(options),u=visual.root.userData;let physics;
  try{physics=makeScrewPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
  const {model,data,bodies}=physics;
  const sync=()=>{mujoco.mj_forward(model,data);for(const [name,id] of Object.entries(bodies)){
    u.blocks[name].position.fromArray(data.xpos,id*3);u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);}
    visual.root.updateMatrixWorld(true);u.state={time:data.time,qpos:Array.from(data.qpos),qvel:Array.from(data.qvel)};
    u.section.update(data.qpos[0],u.profile.nutBase+data.qpos[1]);return u.state;};
  const playback=createPhysicsPlayback(physics,sync);let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
  const bounds=new THREE.Box3(new THREE.Vector3(-.8,-3.05,-.8),new THREE.Vector3(.8,.75,.8));
  Object.assign(u,{mechanism:'mujoco-screw',simulationBackend:'mujoco',physics,fidelity:'authored',reconstructionStatus:'integrated',supportsRestart:true,
    reconstructionNote:'The nut climbs by thread contact. Section view exposes the mating threads. The engraving’s pitch is retained, but its steep diagonal slope is corrected to a continuous helix. Clearance and the reversing drive are reconstructed.',
    cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1},
    qualification:'Only nut rotation is actuated. Matching helical thread contact drives its passive axial slide; the bolt is held fixed and coaxial alignment is ideal.'});
  try{sync();}catch(error){dispose();throw error;}return {...visual,physics,sync,...playback,dispose};
}
