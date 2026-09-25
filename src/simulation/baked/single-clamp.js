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
 // The recorded screws run 0.48 past the back of the side-piece and the pivot
 // bolt 0.2 past its back washer, poking out as bare pins where Brown shows
 // nothing. Trim them (visual only): the side-piece screws end inside the
 // side, and the pivot bolt just beyond its washer.
 const trim=(name,newLow)=>{const mesh=parts[name];if(!mesh)return;const pos=mesh.geometry.attributes.position;
  mesh.geometry.computeBoundingBox();const {min,max}=mesh.geometry.boundingBox;
  for(let i=0;i<pos.count;i++)pos.setZ(i,newLow+(pos.getZ(i)-min.z)*(max.z-newLow)/(max.z-min.z));
  pos.needsUpdate=true;mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();};
 trim('fixed0-shaft',.30);trim('fixed1-shaft',.30);trim('pivot-shaft',-.075);
 update(0);return {root,update,reset:()=>update(0),cameraDirection:new THREE.Vector3(0,0,1),focus:new THREE.Vector3(...bundle.focus),dispose:()=>disposeObject3D(root)};
}
export async function makeBakedSingleClamp(){return makeBakedSingleClampModel(await loadBakedBundle(new URL('./assets/180.json.gz',import.meta.url)));}
