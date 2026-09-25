import * as THREE from 'three';
import {loadBakedBundle,sampleBakedMotion} from './playback.js';
import {disposeObject3D} from '../dispose-model.js';
import {idealCordShape} from '../mujoco-cord-treadle/ideal-cord-shape.js';
import {makeLaidRopeMesh,replaceWithLaidRope} from '../laid-rope.js';
import {matte,PALETTE} from '../primitives.js';
export function makeCordTreadleModel(bundle){
 const root=new THREE.ObjectLoader().parse(bundle.object),blocks=Object.fromEntries(['disk','treadle','pulley'].map(n=>[n,root.getObjectByName('body:'+n)]));
 const segments=256;
 // Brown hatches the cord as a laid rope: the shared three-strand rope along
 // the ideal centreline. Its lay is fixed in the material from the crank pin.
 const cordMaterial=matte(PALETTE.belt,{roughness:.78});cordMaterial.fog=false;
 const cord=makeLaidRopeMesh([new THREE.Vector3(0,0,0),new THREE.Vector3(0,-1,0)],cordMaterial,{radius:.045,tubularSegments:256});
 cord.name='ideal-cord';cord.castShadow=cord.receiveShadow=true;root.add(cord);
 const bounds=new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max));let disposed=false;
 const update=time=>{
  if(disposed)throw Error('Movement has been disposed');
  const q=sampleBakedMotion(bundle,time);['disk','treadle','pulley'].forEach((name,i)=>blocks[name].rotation.z=q[i]);
  const shape=idealCordShape(q[0],q[1],{segments,bakedAmplitude:q[3]}),points=shape.points;
  replaceWithLaidRope(cord,new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal'),{radius:.045,tubularSegments:256});root.updateMatrixWorld(true);
  root.userData.state={time,qpos:Object.fromEntries(bundle.names.map((n,i)=>[n,q[i]])),cordLength:shape.length,tendonExtension:shape.tendonExtension};
 };
 Object.assign(root.userData,{blocks,mechanism:'ideal-cord-treadle',simulationBackend:'baked-mujoco',fidelity:'authored',reconstructionStatus:'reconstructed',supportsRestart:true,reconstructionNote:'The crank drives a passive treadle through an ideal massless cord. The foot rests on the floor while slack is taken up. The slack profile preserves length and illustrates the ideal cord; it does not predict rope vibration. Bearings, depths and attachment construction are inferred.',hideGround:true,cameraFitBounds:bounds,sampledMotionBounds:bundle.bounds,cameraFov:8,shadowCameraHalfExtent:5,shadowBias:-.00002,shadowNormalBias:.002,animationTiming:{authoredCyclePeriod:4,displayCycleDuration:4,playbackTimeScale:1}});
 update(0);return{root,focus:new THREE.Vector3(...bundle.focus),cameraDirection:new THREE.Vector3(...bundle.cameraDirection),update,reset:()=>update(0),dispose:()=>{if(disposed)return;disposed=true;disposeObject3D(root);}};
}
export async function makeBakedCordTreadle(){return makeCordTreadleModel(await loadBakedBundle(new URL('./assets/159.json.gz',import.meta.url)));}
