import * as THREE from 'three';
import {loadBakedBundle,sampleBakedMotion} from './playback.js';
import {makeBeltGovernorUpdater} from '../mujoco-belt-governor/update-solids.js';
import {beltGovernorState} from '../mujoco-belt-governor/kinematics.js';
import {disposeObject3D} from '../dispose-model.js';
export function makeBeltGovernorModel(bundle){
 const root=new THREE.ObjectLoader().parse(bundle.object),sync=makeBeltGovernorUpdater(root,bundle.geometry,{beltSeamSpacing:bundle.beltSeamSpacing}),bounds=new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max));let disposed=false;
 // Closely spaced thin faces produce self-shadow acne at the scene shadow-map
 // resolution. Keep their lighting and cast shadows, but avoid self-reception.
 root.traverse(o=>{if(o.isMesh&&(o.name==='flatBelt'||o.name.endsWith('Pulley')||o.name.startsWith('beltSeam')))o.receiveShadow=false;if(o.name.startsWith('beltSeam'))o.castShadow=false;});
 const update=time=>{if(disposed)throw new Error('Movement disposed');const state=beltGovernorState(sampleBakedMotion(bundle,time),bundle.geometry);sync(state);root.userData.state={time,...state};};
 Object.assign(root.userData,{mechanism:'belt-shifting-governor',simulationBackend:'baked-mujoco',fidelity:'authored',reconstructionStatus:'reconstructed',supportsRestart:true,hideGround:true,cameraFitBounds:bounds,sampledMotionBounds:bundle.bounds,cameraFov:8,shadowCameraHalfExtent:7,shadowBias:-.00002,shadowNormalBias:.002,animationTiming:{authoredCyclePeriod:bundle.period,displayCycleDuration:bundle.period,playbackTimeScale:1},reconstructionNote:'The middle pulley is loose; partial belt contact with either fast pulley transmits drive. Collar depths, belt tension and friction are inferred. The remote gate transmission is outside the drawing.'});
 update(0);return{root,update,reset:()=>update(0),focus:new THREE.Vector3(...bundle.focus),cameraDirection:new THREE.Vector3(...bundle.cameraDirection),dispose:()=>{if(!disposed){disposed=true;disposeObject3D(root);}}};
}
export async function makeBakedBeltGovernor(){return makeBeltGovernorModel(await loadBakedBundle(new URL('./assets/163.json.gz',import.meta.url)));}
