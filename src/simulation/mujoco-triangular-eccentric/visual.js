import * as THREE from 'three';
import {makeTriangularEccentricGeometry} from './geometry.js';
import {makeTriangularEccentricPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';

export {THREE};

export function makeMujocoTriangularEccentric(mujoco,options={}) {
  const visual=makeTriangularEccentricGeometry(options),u=visual.root.userData;let physics;
  try{physics=makeTriangularEccentricPhysics(mujoco,visual,options);}
  catch(error){disposeObject3D(visual.root);throw error;}
  const {model,data,joints,bodies}=physics;
  const sync=()=>{
    mujoco.mj_forward(model,data);
    for(const [name,id] of Object.entries(bodies)) {
      u.blocks[name].position.fromArray(data.xpos,id*3);
      u.blocks[name].quaternion.set(data.xquat[id*4+1],data.xquat[id*4+2],data.xquat[id*4+3],data.xquat[id*4]);
    }
    u.state={time:data.time,inputAngle:data.qpos[joints.input.q],yokePosition:data.qpos[joints.yoke.q],qpos:Array.from(data.qpos),qvel:Array.from(data.qvel)};
    visual.root.updateMatrixWorld(true);return u.state;
  };
  const playback=createPhysicsPlayback(physics,sync);let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
  // Frame Brown's plate: the stubs to his break line over the full stroke.
  // The guides and rod runs past the plate edge stay out of the fit.
  const y=Math.max(...u.geometry.rodTips.map(Math.abs))+2*u.profile.amplitude+.05;
  Object.assign(u,{mechanism:'mujoco-triangular-eccentric-valve-motion',simulationBackend:'mujoco',physics,
    fidelity:'authored',reconstructionStatus:'integrated',supportsRestart:true,
    reconstructionNote:'The cam is fitted as a constant-width profile. Frame clearance, the guides just past the plate edge (carried from behind), the rod runs into them, the rear shaft bearing and depth are reconstructed.',
    cameraFitBounds:new THREE.Box3(new THREE.Vector3(-1.85,-y,-.79),new THREE.Vector3(1.85,y,.34)),
    sampledMotionBounds:{min:[-1.85,-y,-.79],max:[1.85,y,.34]},
    animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1},
    qualification:'Only the shaft is actuated. MuJoCo contact advances the passive yoke between two bearing faces. Fixed guides and shaft retention are ideal joints. Masses, friction and contact compliance are assumptions; the cam collider fills a shaft bore that cannot reach the bearing faces.'});
  try{sync();}catch(error){dispose();throw error;}
  return {...visual,physics,sync,...playback,dispose};
}
