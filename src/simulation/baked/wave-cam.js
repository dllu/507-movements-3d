import * as THREE from 'three';
import {loadBakedBundle,sampleBakedMotion} from './playback.js';
import {makeWaveCamUpdater,waveCamPlaybackState} from '../mujoco-wave-cam/update-solids.js';
import {disposeObject3D} from '../dispose-model.js';
export function makeWaveCamModel(bundle){
 const root=new THREE.ObjectLoader().parse(bundle.object),sync=makeWaveCamUpdater(root,bundle.geometry),bounds=new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max)),parts={},families={};let disposed=false;
 root.traverse(o=>{if(o.isMesh){parts[o.name]=o;let b=o.parent;while(b&&!b.name.startsWith('body:'))b=b.parent;families[o.name]=b?.name;}});
 const update=time=>{if(disposed)throw new Error('Movement disposed');sync({...waveCamPlaybackState(sampleBakedMotion(bundle,time),bundle.geometry),time});};
 Object.assign(root.userData,{parts,families,geometry:bundle.geometry,mechanism:'waved-face-cam',simulationBackend:'baked-quasistatic',fidelity:'authored',reconstructionStatus:'reconstructed',supportsRestart:true,hideGround:true,cameraFitBounds:bounds,sampledMotionBounds:bundle.bounds,cameraFov:8,animationTiming:{authoredCyclePeriod:bundle.period,displayCycleDuration:bundle.period,playbackTimeScale:1},reconstructionNote:'The waved cam drives the upright bar through a roller and lever. Motion assumes a weighted bar keeping the roller seated quasistatically; the guide, eye clearance and depths are inferred. Roller motion illustrates tangential rolling with axial slip.'});
 update(0);return{root,update,reset:()=>update(0),focus:new THREE.Vector3(...bundle.focus),cameraDirection:new THREE.Vector3(...bundle.cameraDirection),dispose:()=>{if(!disposed){disposed=true;disposeObject3D(root);}}};
}
export async function makeBakedWaveCam(){return makeWaveCamModel(await loadBakedBundle(new URL('./assets/165.json.gz',import.meta.url)));}
