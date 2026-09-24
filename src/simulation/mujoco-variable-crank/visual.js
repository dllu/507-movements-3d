import * as THREE from 'three';
import {makeVariableCrankGeometry} from './geometry.js';
import {makeVariableCrankPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';

export {THREE};
export function makeMujocoVariableCrank(mujoco,options={}) {
  const visual=makeVariableCrankGeometry(options),u=visual.root.userData;let physics;
  try{physics=makeVariableCrankPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
  const {model,data,bodies}=physics;
  const sync=()=>{
    mujoco.mj_forward(model,data);
    for(const [name,id] of Object.entries(bodies)) {
      u.blocks[name].position.fromArray(data.xpos,id*3);
      u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);
    }
    u.updateHiddenGroove();visual.root.updateMatrixWorld(true);
    u.state={time:data.time,inputAngle:data.qpos[0],boltRadius:data.qpos[1],qpos:Array.from(data.qpos),qvel:Array.from(data.qvel)};return u.state;
  };
  const playback=createPhysicsPlayback(physics,sync);let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
  const bounds=new THREE.Box3(new THREE.Vector3(-2.3,-2.1,-.84),new THREE.Vector3(2.3,2.1,.45));
  Object.assign(u,{mechanism:'mujoco-variable-crank',simulationBackend:'mujoco',physics,
    fidelity:'authored',reconstructionStatus:'integrated',supportsRestart:true,
    reconstructionNote:'The radial plate is held during adjustment; the spiral groove behind it is dashed where the plate is solid, as Brown draws it. The stepped bolt, depth and supports are reconstructed; radial slots are widened slightly to fit the bolt.',
    cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1},
    qualification:'Only the spiral plate is actuated. MuJoCo contact moves the bolt in an ideal radial guide. This demonstrates adjustment with the radial plate held; clamping and subsequent crank operation are not simulated.'});
  try{sync();}catch(error){dispose();throw error;}
  return {...visual,physics,sync,...playback,dispose};
}
