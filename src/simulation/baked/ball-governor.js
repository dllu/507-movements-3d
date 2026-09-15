import * as THREE from 'three';
import {loadBakedBundle,sampleBakedMotion} from './playback.js';
import {makeBallGovernorUpdater} from '../mujoco-ball-governor/update-solids.js';
import {ballGovernorState} from '../mujoco-ball-governor/kinematics.js';
import {disposeObject3D} from '../dispose-model.js';
export function makeBallGovernorModel(bundle){
 const root=new THREE.ObjectLoader().parse(bundle.object),sync=makeBallGovernorUpdater(root),bounds=new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max));let disposed=false;
 const update=time=>{if(disposed)throw new Error('Movement disposed');const state=ballGovernorState(sampleBakedMotion(bundle,time));sync(state);root.userData.state={time,...state};};
 Object.assign(root.userData,{mechanism:'centrifugal-ball-governor',simulationBackend:'baked-mujoco',fidelity:'authored',reconstructionStatus:'reconstructed',supportsRestart:true,hideGround:true,cameraFitBounds:bounds,sampledMotionBounds:bundle.bounds,cameraFov:8,shadowCameraHalfExtent:6,shadowBias:-.00002,shadowNormalBias:.002,animationTiming:{authoredCyclePeriod:8,displayCycleDuration:8,playbackTimeScale:1},reconstructionNote:'The driven spindle spreads passive arms and raises the sleeve. Motion is baked from settled MuJoCo dynamics with inferred masses, gravity scale and ideal joints. The bevel pair uses an inferred 36:30 ratio and approximate involute teeth. The unloaded fork follows the sleeve; the remote valve, linkage and engine feedback are outside the drawing.'});
 update(0);return{root,update,reset:()=>update(0),focus:new THREE.Vector3(...bundle.focus),cameraDirection:new THREE.Vector3(...bundle.cameraDirection),dispose:()=>{if(!disposed){disposed=true;disposeObject3D(root);}}};
}
export async function makeBakedBallGovernor(){return makeBallGovernorModel(await loadBakedBundle(new URL('./assets/161.json.gz',import.meta.url)));}
