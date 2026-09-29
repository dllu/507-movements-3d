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
 // p109: Brown dashes the jaw's upper tip inside the side-piece. At the open
 // end of the recorded swing the tip poked 0.05 past the side-piece's left
 // face (x -1.44) as a blue tick. Compress the tip smoothly along the world
 // x axis at that extreme angle (visual only; the tip touches nothing: the
 // jaw has no contact with the side-piece and the board is far below it), so
 // it stays 0.035 inside the face over the whole swing and keeps its rounded
 // point. Vertices more than 0.15 inside the limit are untouched.
 {const jaw=parts.jaw,body=root.getObjectByName('body:jaw'),side=parts['fixed-side'];
  if(jaw&&body&&side){side.geometry.computeBoundingBox();
   const limit=side.geometry.boundingBox.min.x+.01,band=.15,theta=Math.max(...bundle.motion.map(r=>r[1+bundle.names.indexOf('jaw')]));
   const c=Math.cos(theta),s=Math.sin(theta),pos=jaw.geometry.attributes.position;
   for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),past=limit-(body.position.x+x*c-y*s);
    if(past<=-band)continue;const kept=-band+band*(1-Math.exp(-(past+band)/band)),shift=past-kept;
    pos.setXY(i,x+shift*c,y-shift*s);}
   pos.needsUpdate=true;jaw.geometry.computeBoundingBox();jaw.geometry.computeBoundingSphere();}}
 update(0);return {root,update,reset:()=>update(0),cameraDirection:new THREE.Vector3(0,0,1),focus:new THREE.Vector3(...bundle.focus),dispose:()=>disposeObject3D(root)};
}
export async function makeBakedSingleClamp(){return makeBakedSingleClampModel(await loadBakedBundle(new URL('./assets/180.json.gz',import.meta.url)));}
