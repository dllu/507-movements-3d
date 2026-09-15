import * as THREE from 'three';
import {loadBakedBundle,sampleBakedMotion} from './playback.js';
import {disposeObject3D} from '../dispose-model.js';
import {idealCordShape} from '../mujoco-cord-treadle/ideal-cord-shape.js';
export function makeCordTreadleModel(bundle){
 const root=new THREE.ObjectLoader().parse(bundle.object),blocks=Object.fromEntries(['disk','treadle','pulley'].map(n=>[n,root.getObjectByName('body:'+n)]));
 const segments=256,sides=8,positions=new Float32Array((segments+1)*sides*3),normals=new Float32Array(positions.length),indices=[];
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=a+sides,d=b+sides;indices.push(a,b,c,b,d,c);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
 const cord=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x29383b,roughness:.8,metalness:.12,fog:false}));cord.name='ideal-cord';cord.castShadow=cord.receiveShadow=true;root.add(cord);
 const bounds=new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max));let disposed=false;
 const update=time=>{
  if(disposed)throw Error('Movement has been disposed');
  const q=sampleBakedMotion(bundle,time);['disk','treadle','pulley'].forEach((name,i)=>blocks[name].rotation.z=q[i]);
  const shape=idealCordShape(q[0],q[1],{segments,bakedAmplitude:q[3]}),points=shape.points;
  for(let i=0;i<=segments;i++){
   const before=points[Math.max(0,i-1)],after=points[Math.min(segments,i+1)],dx=after[0]-before[0],dy=after[1]-before[1],length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;
   for(let j=0;j<sides;j++){const angle=2*Math.PI*j/sides,c=Math.cos(angle),s=Math.sin(angle),k=(i*sides+j)*3;normals[k]=c*nx;normals[k+1]=c*ny;normals[k+2]=s;positions[k]=points[i][0]+.045*normals[k];positions[k+1]=points[i][1]+.045*normals[k+1];positions[k+2]=points[i][2]+.045*s;}
  }
  geometry.attributes.position.needsUpdate=geometry.attributes.normal.needsUpdate=true;geometry.computeBoundingSphere();root.updateMatrixWorld(true);
  root.userData.state={time,qpos:Object.fromEntries(bundle.names.map((n,i)=>[n,q[i]])),cordLength:shape.length,tendonExtension:shape.tendonExtension};
 };
 Object.assign(root.userData,{blocks,mechanism:'ideal-cord-treadle',simulationBackend:'baked-mujoco',fidelity:'authored',reconstructionStatus:'reconstructed',supportsRestart:true,reconstructionNote:'The crank drives a passive treadle through an ideal massless cord. The foot rests on the floor while slack is taken up. The slack profile preserves length and illustrates the ideal cord; it does not predict rope vibration. Bearings, depths and attachment construction are inferred.',hideGround:true,cameraFitBounds:bounds,sampledMotionBounds:bundle.bounds,cameraFov:8,shadowCameraHalfExtent:5,shadowBias:-.00002,shadowNormalBias:.002,animationTiming:{authoredCyclePeriod:4,displayCycleDuration:4,playbackTimeScale:1}});
 update(0);return{root,focus:new THREE.Vector3(...bundle.focus),cameraDirection:new THREE.Vector3(...bundle.cameraDirection),update,reset:()=>update(0),dispose:()=>{if(disposed)return;disposed=true;disposeObject3D(root);}};
}
export async function makeBakedCordTreadle(){return makeCordTreadleModel(await loadBakedBundle(new URL('./assets/159.json.gz',import.meta.url)));}
