import * as THREE from 'three';
import {loadBakedBundle,sampleBakedMotion} from './playback.js';
import {makeSingleClampUpdater} from '../mujoco-single-clamp/update-solids.js';
import {disposeObject3D} from '../dispose-model.js';
export function makeBakedSingleClampModel(bundle){
 const root=new THREE.ObjectLoader().parse(bundle.object),sync=makeSingleClampUpdater(root),parts={},families={};
 root.traverse(o=>{if(o.isMesh){parts[o.name]=o;let parent=o.parent;while(parent&&!parent.name.startsWith('body:'))parent=parent.parent;families[o.name]=parent?.name.slice(5);}});
 const stateAtTime=time=>{const q=sampleBakedMotion(bundle,time);return Object.fromEntries(bundle.names.map((n,i)=>[n,q[i]]));};
 const update=time=>{const state=stateAtTime(time);sync(state);root.userData.kinematics=state;};
 Object.assign(root.userData,{parts,families,stateAtTime,fidelity:'authored',mechanism:'passive-single-jaw-bench-clamp',simulationBackend:'baked-mujoco',reconstructionStatus:'reconstructed',hideGround:true,materialsIgnoreSceneFog:true,cameraFov:8,supportsRestart:true,
 cameraFitBounds:new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max)),animationTiming:{authoredCyclePeriod:6,displayCycleDuration:6,playbackTimeScale:1}});
 update(0);return {root,update,reset:()=>update(0),cameraDirection:new THREE.Vector3(0,0,1),focus:new THREE.Vector3(...bundle.focus),dispose:()=>disposeObject3D(root)};
}
export async function makeBakedSingleClamp(){return makeBakedSingleClampModel(await loadBakedBundle(new URL('./assets/180.json.gz',import.meta.url)));}
