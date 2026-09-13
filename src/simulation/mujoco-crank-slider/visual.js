import * as THREE from 'three';
import {makeCrankSliderGeometry} from './geometry.js';
import {makeCrankSliderPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';

export {THREE};
export function makeMujocoCrankSlider(mujoco,options={}) {
  const visual=makeCrankSliderGeometry(),u=visual.root.userData;let physics;
  try{physics=makeCrankSliderPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
  const {model,data,bodies}=physics;
  const sync=()=>{
    mujoco.mj_forward(model,data);
    for(const [name,id] of Object.entries(bodies)) {
      u.blocks[name].position.fromArray(data.xpos,id*3);
      u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);
    }
    visual.root.updateMatrixWorld(true);
    u.state={time:data.time,inputAngle:data.qpos[0],sliderPosition:data.qpos[2],qpos:Array.from(data.qpos),qvel:Array.from(data.qvel)};
    return u.state;
  };
  const playback=createPhysicsPlayback(physics,sync);let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
  const r=u.geometry.outerRadius+.04,bounds=new THREE.Box3(new THREE.Vector3(-r,-r,-.51),new THREE.Vector3(u.geometry.right+.04,r,.40));
  Object.assign(u,{mechanism:'mujoco-ordinary-crank-slider',simulationBackend:'mujoco',physics,
    fidelity:'authored',reconstructionStatus:'integrated',supportsRestart:true,
    reconstructionNote:'The curved spokes follow the engraving. Guide shoes, rear support and depth are reconstructed; pins and guides use ideal joints.',
    cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1},
    qualification:'Only the crankshaft is actuated. MuJoCo hinge/slider joints and a wrist closure determine rod and crosshead motion. Bearings are ideal constraints, with independent finite hardware clearance checks.'});
  try{sync();}catch(error){dispose();throw error;}
  return {...visual,physics,sync,...playback,dispose};
}
