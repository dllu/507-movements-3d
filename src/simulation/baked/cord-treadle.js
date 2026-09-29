import * as THREE from 'three';
import {loadBakedBundle,sampleBakedMotion} from './playback.js';
import {disposeObject3D} from '../dispose-model.js';
import {idealCordShape} from '../mujoco-cord-treadle/ideal-cord-shape.js';
import {sampleCordLoop} from '../mujoco-cord-treadle/cord-dynamics.js';
import {decodeArray} from './mujoco-bake-format.js';
import {makeLaidRopeMesh,replaceWithLaidRope} from '../laid-rope.js';
import {matte,PALETTE} from '../primitives.js';
export function makeCordTreadleModel(bundle){
 const root=new THREE.ObjectLoader().parse(bundle.object),blocks=Object.fromEntries(['disk','treadle','pulley'].map(n=>[n,root.getObjectByName('body:'+n)]));
 // The baked cord pin stands on the treadle's front face by its flat end.
 // Its shank is carried on back through the treadle (to just short of the
 // rear face), so the pin is set into the bar rather than butting on it.
 {const pin=blocks.treadle.children.find(o=>o.isMesh&&o.material.color?.getHex()===0x252a2d);
  if(pin){const shank=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.24,40).rotateX(Math.PI/2).translate(-2.54,0,.18),pin.material);
   shank.name='cord-pin-shank-through-treadle';shank.castShadow=shank.receiveShadow=true;blocks.treadle.add(shank);}}
 const segments=256;
 // Brown hatches the cord as a laid rope: the shared three-strand rope along
 // the ideal centreline. Its lay is fixed in the material from the crank pin.
 const cordMaterial=matte(PALETTE.belt,{roughness:.78});cordMaterial.fog=false;
 const cord=makeLaidRopeMesh([new THREE.Vector3(0,0,0),new THREE.Vector3(0,-1,0)],cordMaterial,{radius:.045,tubularSegments:256});
 cord.name='ideal-cord';cord.castShadow=cord.receiveShadow=true;root.add(cord);
 const dynamicCord=bundle.cord&&{...bundle.cord,points:decodeArray(bundle.cord.points)},cordPoints=[];
 const bounds=new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max));let disposed=false;
 const update=time=>{
  if(disposed)throw Error('Movement has been disposed');
  const q=sampleBakedMotion(bundle,time);['disk','treadle','pulley'].forEach((name,i)=>blocks[name].rotation.z=q[i]);
  // The recorded cord has its own inertia (cord-dynamics.js); older bundles
  // fall back to the quasi-static ideal profile.
  let points,cordLength,tendonExtension=0;
  if(dynamicCord){points=sampleCordLoop(dynamicCord,time,cordPoints);cordLength=0;for(let i=1;i<points.length;i++)cordLength+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);}
  else{const shape=idealCordShape(q[0],q[1],{segments,bakedAmplitude:q[3]});points=shape.points;cordLength=shape.length;tendonExtension=shape.tendonExtension;}
  replaceWithLaidRope(cord,new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),false,'centripetal'),{radius:.045,tubularSegments:256});root.updateMatrixWorld(true);
  root.userData.state={time,qpos:Object.fromEntries(bundle.names.map((n,i)=>[n,q[i]])),cordLength,tendonExtension};
 };
 Object.assign(root.userData,{blocks,mechanism:'ideal-cord-treadle',simulationBackend:'baked-mujoco',fidelity:'authored',reconstructionStatus:'reconstructed',supportsRestart:true,reconstructionNote:'The crank drives a passive treadle through its cord. The cord stretches slightly under load (elastic and tension-only), so taking up the slack lifts the treadle smoothly rather than with a jerk. The foot rests on the floor while slack is taken up; the slack cord falls and straightens with its own weight and inertia (a simulated limp rope that does not load the treadle). Bearings, depths and attachment construction are inferred.',hideGround:true,cameraFitBounds:bounds,sampledMotionBounds:bundle.bounds,cameraFov:8,shadowCameraHalfExtent:5,shadowBias:-.00002,shadowNormalBias:.002,animationTiming:{authoredCyclePeriod:4,displayCycleDuration:4,playbackTimeScale:1}});
 update(0);return{root,focus:new THREE.Vector3(...bundle.focus),cameraDirection:new THREE.Vector3(...bundle.cameraDirection),update,reset:()=>update(0),dispose:()=>{if(disposed)return;disposed=true;disposeObject3D(root);}};
}
export async function makeBakedCordTreadle(){return makeCordTreadleModel(await loadBakedBundle(new URL('./assets/159.json.gz',import.meta.url)));}
