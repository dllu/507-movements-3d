import * as THREE from 'three';
import {loadBakedBundle,sampleBakedMotion} from './playback.js';
import {makeWaterGovernorUpdater} from '../mujoco-water-governor/update-solids.js';
import {waterGovernorState} from '../mujoco-water-governor/kinematics.js';
import {disposeObject3D} from '../dispose-model.js';
export function makeWaterGovernorModel(bundle){
 const root=new THREE.ObjectLoader().parse(bundle.object),sync=makeWaterGovernorUpdater(root,bundle.geometry),bounds=new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max));let disposed=false;
 const update=time=>{if(disposed)throw new Error('Movement disposed');const state=waterGovernorState(sampleBakedMotion(bundle,time),bundle.geometry);sync(state);root.userData.state={time,...state};};
 Object.assign(root.userData,{mechanism:'water-wheel-governor',simulationBackend:'baked-mujoco',fidelity:'authored',reconstructionStatus:'reconstructed',supportsRestart:true,hideGround:true,cameraFitBounds:bounds,sampledMotionBounds:bundle.bounds,cameraFov:8,shadowCameraHalfExtent:6,shadowBias:-.00002,shadowNormalBias:.002,animationTiming:{authoredCyclePeriod:bundle.period,displayCycleDuration:bundle.period,playbackTimeScale:1},reconstructionNote:'A sliding pin catches either loose gear to reverse the water-gate shaft. Passive contact dynamics are baked offline; masses, depths and output friction are inferred. The water wheel, remote gate and hydraulic feedback are outside the drawing.'});
 update(0);return{root,update,reset:()=>update(0),focus:new THREE.Vector3(...bundle.focus),cameraDirection:new THREE.Vector3(...bundle.cameraDirection),dispose:()=>{if(!disposed){disposed=true;disposeObject3D(root);}}};
}
export async function makeBakedWaterGovernor(){return makeWaterGovernorModel(await loadBakedBundle(new URL('./assets/162.json.gz',import.meta.url)));}
