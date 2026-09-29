import * as THREE from 'three';
import {slidingWormAtTime,slidingWormDimensions as g} from '../sliding-worm-kinematics.js';
import {disposeObject3D} from '../dispose-model.js';
import {loadBakedBundle} from './playback.js';

export function makeSlidingWormModel(bundle){
 const root=new THREE.ObjectLoader().parse(bundle.object),blocks=Object.fromEntries(['shaft','carriage','worm','wheel','rod'].map(n=>[n,root.getObjectByName('body:'+n)]));
 root.traverse(o=>{for(const material of Array.isArray(o.material)?o.material:o.material?[o.material]:[])material.fog=false;});
 // The key runs in the shaft's groove: it takes the shaft's steel, not a gold stripe along it.
 const key=root.getObjectByName('longitudinal-key'),shaftMesh=root.getObjectByName('shaft');if(key&&shaftMesh)key.material=shaftMesh.material;
 // The carriage slides behind the blue wheel: steel grey (lighter than the dark
 // fixed frame) so the wheel and its crank pin read against it.
 const carriageSteel=root.getObjectByName('bored-carriage')?.material?.clone();
 if(carriageSteel){carriageSteel.color.setHex(0x7e8584);for(const name of ['bored-carriage','left-worm-bearing','right-worm-bearing']){const mesh=root.getObjectByName(name);if(mesh)mesh.material=carriageSteel;}}
 const bounds=new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max));let disposed=false;
 const update=time=>{if(disposed)throw new Error('Movement disposed');const s=slidingWormAtTime(time);blocks.shaft.rotation.x=s.inputAngle;blocks.worm.rotation.x=s.inputAngle;blocks.wheel.rotation.z=s.wheelAngle;blocks.carriage.position.x=s.carriageX;blocks.rod.position.set(...s.wrist,0);blocks.rod.rotation.z=s.rodAngle;root.updateMatrixWorld(true);root.userData.state=s;};
 Object.assign(root.userData,{blocks,mechanism:'generated-keyed-worm-traverse',simulationBackend:'analytic',fidelity:'authored',reconstructionStatus:'verified',supportsRestart:true,hideGround:true,cameraFitBounds:bounds,sampledMotionBounds:bundle.bounds,animationTiming:{authoredCyclePeriod:g.period,displayCycleDuration:g.period,playbackTimeScale:1},reconstructionNote:'A keyed worm slides with the carriage while driving its wheel at 22:1. The fixed rod determines the traverse analytically. Generated tooth surfaces are simplified for display; wheel width, bearing depths and hidden supports are reconstructed.'});
 update(0);return {root,update,reset:()=>update(0),focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.05,.03,15),dispose:()=>{if(!disposed){disposed=true;disposeObject3D(root);}}};
}
export async function makeBakedSlidingWorm(){return makeSlidingWormModel(await loadBakedBundle(new URL('./assets/143.json.gz',import.meta.url)));}
