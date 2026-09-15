import * as THREE from 'three';
import {loadBakedBundle,sampleBakedMotion} from './playback.js';
import {makeSpringTreadleUpdater} from '../mujoco-spring-return-treadle/update-solids.js';
import {springTreadleState} from '../mujoco-spring-return-treadle/kinematics.js';
import {disposeObject3D} from '../dispose-model.js';
export function makeSpringTreadleModel(bundle){
 const root=new THREE.ObjectLoader().parse(bundle.object),sync=makeSpringTreadleUpdater(root,{widths:bundle.leafWidths}),bounds=new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max));let disposed=false;
 const update=time=>{if(disposed)throw new Error('Movement has been disposed');const q=sampleBakedMotion(bundle,time);sync({...springTreadleState(q,bundle.rest),time,qpos:q});};
 Object.assign(root.userData,{mechanism:'spring-return-treadle',simulationBackend:'baked-mujoco',fidelity:'authored',reconstructionStatus:'reconstructed',supportsRestart:true,hideGround:true,cameraFitBounds:bounds,sampledMotionBounds:bundle.bounds,cameraFov:8,shadowCameraHalfExtent:5,shadowBias:-.00002,shadowNormalBias:.002,animationTiming:{authoredCyclePeriod:4,displayCycleDuration:4,playbackTimeScale:1},reconstructionNote:'Foot pressure bends the spring through a full-wrap band; stored spring energy returns the treadle. The model assumes an ideal massless pulley, slight band compliance, and inferred spring properties, preload and mounting depths.'});
 update(0);return{root,focus:new THREE.Vector3(...bundle.focus),cameraDirection:new THREE.Vector3(...bundle.cameraDirection),update,reset:()=>update(0),dispose:()=>{if(disposed)return;disposed=true;disposeObject3D(root);}};
}
export async function makeBakedSpringTreadle(){return makeSpringTreadleModel(await loadBakedBundle(new URL('./assets/160.json.gz',import.meta.url)));}
