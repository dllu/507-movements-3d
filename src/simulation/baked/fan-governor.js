import * as THREE from 'three';
import {loadBakedBundle,sampleBakedMotion} from './playback.js';
import {disposeObject3D} from '../dispose-model.js';
export function makeFanGovernorModel(bundle){
 const root=new THREE.ObjectLoader().parse(bundle.object),names=['shaft','crosshead','roller0','roller1','collar','lever'];
 const blocks=Object.fromEntries(names.map(name=>[name,root.getObjectByName('body:'+name)]));
 const bounds=new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max));let disposed=false;
 root.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])m.fog=false;});
 const update=time=>{
  if(disposed)throw new Error('Movement disposed');
  const [shaft,lift,yaw,roll0,roll1]=sampleBakedMotion(bundle,time);
  blocks.shaft.rotation.y=shaft;blocks.crosshead.position.y=lift;blocks.crosshead.rotation.y=yaw;
  blocks.roller0.rotation.x=roll0;blocks.roller1.rotation.x=roll1;
  blocks.collar.position.y=lift;blocks.lever.rotation.z=-Math.atan2(lift,3);
  root.updateMatrixWorld(true);root.userData.state={time,shaft,lift,yaw,roll0,roll1};
 };
 Object.assign(root.userData,{blocks,mechanism:'air-drag-fan-inclined-plane-governor',simulationBackend:'baked-mujoco',fidelity:'authored',reconstructionStatus:'candidate',supportsRestart:true,hideGround:true,cameraFov:12,cameraFitBounds:bounds,sampledMotionBounds:bundle.bounds,
  animationTiming:{authoredCyclePeriod:bundle.period,displayCycleDuration:bundle.period,playbackTimeScale:1},
  reconstructionNote:'Air drag retards the heavy fan carrier, causing its rollers to climb the rotating ramps. Motion is baked from passive contact dynamics. Ramp curvature, depths, drag and uniform density are reconstructed. The collar and slotted regulating lever follow the lift without a valve load.'});
 update(0);return {root,update,reset:()=>update(0),focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(0,0,1),dispose:()=>{if(!disposed){disposed=true;disposeObject3D(root);}}};
}
export async function makeBakedFanGovernor(){return makeFanGovernorModel(await loadBakedBundle(new URL('./assets/147.json.gz',import.meta.url)));}
