import * as THREE from 'three';
import {loadBakedBundle,sampleBakedMotion} from './playback.js';
import {makeWaveCamUpdater,waveCamPlaybackState} from '../mujoco-wave-cam/update-solids.js';
import {disposeObject3D} from '../dispose-model.js';
// Brown lets the upright output bar run out of the plate and shows no support
// for the lever's fulcrum pin. A minimal fixed guide boxes the bar below the
// lever, and a flat bracket behind the moving parts carries both that guide
// and a standoff under the fulcrum pin, so neither floats.
function addWaveCamSupports(root){
 const frame=new THREE.MeshStandardMaterial({color:0x59605f,roughness:.7,metalness:.12,fog:false});
 const group=new THREE.Group();group.name='output-guide-and-fulcrum-bracket';
 const add=(name,geometry)=>{const m=new THREE.Mesh(geometry,frame);m.name=name;m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
 const gx=-5.387,gy=-1.1,half=.3,gap=.145,back=2.40,plateTop=2.52,holeLow=2.66,holeHigh=2.82,front=2.90,gh=.3;
 const box=(name,x0,x1,z0,z1)=>add(name,new THREE.BoxGeometry(x1-x0,gh,z1-z0).translate((x0+x1)/2,gy,(z0+z1)/2));
 box('output-guide-cheek',gx-half,gx-gap,plateTop,front);box('output-guide-cheek',gx+gap,gx+half,plateTop,front);
 box('output-guide-front-bridge',gx-gap,gx+gap,holeHigh,front);box('output-guide-rear-bridge',gx-gap,gx+gap,plateTop,holeLow);
 const fx=-3.114,fy=1.39,dx=fx-gx,dy=fy-gy,len=Math.hypot(dx,dy),nx=-dy/len*.16,ny=dx/len*.16;
 const shape=new THREE.Shape();shape.moveTo(gx-half,gy-gh/2);shape.lineTo(gx+half,gy-gh/2);shape.lineTo(gx+half+nx*0,gy+gh/2);
 shape.lineTo(fx-nx,fy-ny);shape.absarc(fx,fy,.24,Math.atan2(-ny,-nx),Math.atan2(ny,nx),false);shape.lineTo(gx-half,gy+gh/2);shape.closePath();
 add('fulcrum-and-guide-bracket',new THREE.ExtrudeGeometry(shape,{depth:plateTop-back,bevelEnabled:false,curveSegments:32}).translate(0,0,back));
 add('fulcrum-standoff',new THREE.CylinderGeometry(.144,.144,2.78-plateTop,32).rotateX(Math.PI/2).translate(fx,fy,(2.78+plateTop)/2));
 root.add(group);
}
export function makeWaveCamModel(bundle){
 const root=new THREE.ObjectLoader().parse(bundle.object),sync=makeWaveCamUpdater(root,bundle.geometry),bounds=new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max)),parts={},families={};let disposed=false;
 root.traverse(o=>{if(o.isMesh){parts[o.name]=o;let b=o.parent;while(b&&!b.name.startsWith('body:'))b=b.parent;families[o.name]=b?.name;}});
 const update=time=>{if(disposed)throw new Error('Movement disposed');sync({...waveCamPlaybackState(sampleBakedMotion(bundle,time),bundle.geometry),time});};
 Object.assign(root.userData,{parts,families,geometry:bundle.geometry,mechanism:'waved-face-cam',simulationBackend:'baked-quasistatic',fidelity:'authored',reconstructionStatus:'reconstructed',supportsRestart:true,hideGround:true,cameraFitBounds:bounds,sampledMotionBounds:bundle.bounds,cameraFov:8,animationTiming:{authoredCyclePeriod:bundle.period,displayCycleDuration:bundle.period,playbackTimeScale:1},reconstructionNote:'Six identical, evenly spaced sinusoidal lobes drive the upright bar through a roller and lever. Motion assumes a weighted bar keeping the roller seated quasistatically; the guide, eye clearance and depths are inferred. Roller motion illustrates tangential rolling with axial slip.'});
 addWaveCamSupports(root);
 update(0);return{root,update,reset:()=>update(0),focus:new THREE.Vector3(...bundle.focus),cameraDirection:new THREE.Vector3(...bundle.cameraDirection),dispose:()=>{if(!disposed){disposed=true;disposeObject3D(root);}}};
}
export async function makeBakedWaveCam(){return makeWaveCamModel(await loadBakedBundle(new URL('./assets/165.json.gz',import.meta.url)));}
