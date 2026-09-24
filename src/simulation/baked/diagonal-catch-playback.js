import * as THREE from 'three';
import {sampleBakedMotion} from './playback.js';
import {makeDiagonalCatchUpdater} from '../mujoco-diagonal-catch/update-solids.js';
import {disposeObject3D} from '../dispose-model.js';

// Drive a finished diagonal-catch assembly (deserialized from the bake, or
// rebuilt synchronously for offline reviews) with baked generalized coordinates.
export function makeDiagonalCatchPlayback(root,bundle,id=181){
 const sync=makeDiagonalCatchUpdater(root),parts={},families={};
 root.traverse(o=>{if(o.isMesh){parts[o.name]=o;let parent=o;while(parent&&!parent.name.startsWith('body:'))parent=parent.parent;families[o.name]=parent?.name.slice(5)??'fixed';}});
 const phaseOffset=id===182?bundle.period/2:0;
 const stateAtTime=time=>{
  if(!Number.isFinite(time)||time<0)throw new RangeError('Invalid playback time');
  return sampleBakedMotion(bundle,(time+phaseOffset)%bundle.period);
 };
 const update=time=>sync(stateAtTime(time));
 Object.assign(root.userData,{parts,families,stateAtTime,phaseOffset,fidelity:'authored',simulationBackend:'baked-mujoco',
  mechanism:'passive-diagonal-catch',reconstructionStatus:'under-review',hideGround:true,materialsIgnoreSceneFog:true,
  supportsRestart:true,cameraFov:8,cameraDistanceScale:1.02,
  cameraFitBounds:new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max)),
  animationTiming:{authoredCyclePeriod:bundle.period,displayCycleDuration:12,playbackTimeScale:bundle.period/12},
  reconstructionNote:'Passive weighted handles and catch follow baked MuJoCo motion with small contact-clearance corrections. Finger supports and depths are inferred; the contours remain under source review. Back-weight rods run to the fixed lower edge of the drawing.'});
 update(0);
 return {root,update,reset:()=>update(0),focus:new THREE.Vector3(...bundle.focus),cameraDirection:new THREE.Vector3(0,0,1),dispose:()=>disposeObject3D(root)};
}
