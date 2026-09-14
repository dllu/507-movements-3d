import * as THREE from 'three';
import {disposeObject3D} from '../dispose-model.js';

export async function loadBakedBundle(url){
 const response=await fetch(url);
 if(!response.ok)throw new Error('Unable to load baked movement: '+response.status);
 // Some hosts label .gz with Content-Encoding and the browser decodes it;
 // plain static hosts serve the compressed bytes unchanged.
 const bytes=new Uint8Array(await response.arrayBuffer());
 const body=bytes[0]===0x1f&&bytes[1]===0x8b
  ?new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')):bytes;
 return new Response(body).json();
}

/** Interpolate unwrapped generalized coordinates; preserve the recorded startup. */
export function sampleBakedMotion(bundle,time){
 if(!Number.isFinite(time)||time<0)throw new RangeError('Invalid playback time');
 const {motion,loopStart,loopEnd,period,turns}=bundle;
 const loops=time>=loopEnd?Math.floor((time-loopStart)/period):0;
 const phase=time-loops*period;
 let lo=0,hi=motion.length-1;
 while(lo+1<hi){const mid=(lo+hi)>>1;if(motion[mid][0]<=phase)lo=mid;else hi=mid;}
 const a=motion[lo],b=motion[hi],t=Math.max(0,Math.min(1,(phase-a[0])/(b[0]-a[0])));
 return bundle.names.map((_,i)=>a[i+1]+t*(b[i+1]-a[i+1])+loops*turns[i]);
}

export function makeBakedRigidMovement(bundle,{mechanism,note,slideBodies=[]}={}){
 const root=new THREE.ObjectLoader().parse(bundle.object),blocks=Object.fromEntries(bundle.names.map(n=>[n,root.getObjectByName('body:'+n)]));
 const origins=Object.fromEntries(Object.entries(blocks).map(([n,b])=>[n,b.position.clone()]));
 const bounds=new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max));
 let disposed=false;
 const update=time=>{
  if(disposed)throw new Error('Movement has been disposed');
  const q=sampleBakedMotion(bundle,time);
  bundle.names.forEach((n,i)=>{if(slideBodies.includes(n))blocks[n].position.y=origins[n].y+q[i];else blocks[n].rotation.z=q[i];});
  root.updateMatrixWorld(true);root.userData.state={time,qpos:Object.fromEntries(bundle.names.map((n,i)=>[n,q[i]]))};
 };
 Object.assign(root.userData,{blocks,mechanism,simulationBackend:'baked-mujoco',fidelity:'authored',reconstructionStatus:'verified',supportsRestart:true,reconstructionNote:note,hideGround:true,cameraFitBounds:bounds,sampledMotionBounds:bundle.bounds,shadowCameraHalfExtent:5,shadowBias:-.00002,shadowNormalBias:.002,animationTiming:{authoredCyclePeriod:bundle.period,displayCycleDuration:bundle.period,playbackTimeScale:1}});
 update(0);
 return {root,focus:new THREE.Vector3(...bundle.focus),cameraDirection:new THREE.Vector3(...bundle.cameraDirection),update,reset:()=>update(0),dispose:()=>{if(disposed)return;disposed=true;disposeObject3D(root);}};
}
