import * as THREE from 'three';
import {loadBakedBundle,sampleBakedMotion} from './playback.js';
import {makeBeltGovernorUpdater} from '../mujoco-belt-governor/update-solids.js';
import {beltGovernorState} from '../mujoco-belt-governor/kinematics.js';
import {disposeObject3D} from '../dispose-model.js';
export function makeBeltGovernorModel(bundle){
 const root=new THREE.ObjectLoader().parse(bundle.object),sync=makeBeltGovernorUpdater(root,bundle.geometry,{beltSeamSpacing:bundle.beltSeamSpacing}),bounds=new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max));let disposed=false;
 // Closely spaced thin faces produce self-shadow acne at the scene shadow-map
 // resolution. Keep their lighting and cast shadows, but avoid self-reception.
 root.traverse(o=>{if(o.isMesh&&(o.name==='flatBelt'||o.name.endsWith('Pulley')||o.name.startsWith('beltSeam')))o.receiveShadow=false;if(o.name.startsWith('beltSeam'))o.castShadow=false;});
 const update=time=>{if(disposed)throw new Error('Movement disposed');const state=beltGovernorState(sampleBakedMotion(bundle,time),bundle.geometry);sync(state);root.userData.state={time,...state};};
 Object.assign(root.userData,{mechanism:'belt-shifting-governor',simulationBackend:'baked-mujoco',fidelity:'authored',reconstructionStatus:'reconstructed',supportsRestart:true,hideGround:true,cameraFitBounds:bounds,sampledMotionBounds:bundle.bounds,cameraFov:8,shadowCameraHalfExtent:7,shadowBias:-.00002,shadowNormalBias:.002,animationTiming:{authoredCyclePeriod:bundle.period,displayCycleDuration:bundle.period,playbackTimeScale:1},reconstructionNote:'The middle pulley is loose; partial belt contact with either fast pulley transmits drive. Collar depths, belt tension and friction are inferred. The remote gate transmission is outside the drawing.'});
 endlessBeltBeyondCrop(root,bundle,update);
 update(0);return{root,update,reset:()=>update(0),focus:new THREE.Vector3(...bundle.focus),cameraDirection:new THREE.Vector3(...bundle.cameraDirection),dispose:()=>{if(!disposed){disposed=true;disposeObject3D(root);}}};
}
// Brown crops the belt at the right edge. It is endless: both runs continue
// past the crop to a driving drum as tall as the belt's shift, so no run
// stops square in mid-air. The seam strips that showed belt travel are
// marker stripes Brown does not draw, so they stay hidden.
function endlessBeltBeyondCrop(root,bundle,update){
 const belt=root.getObjectByName('body:belt'),band=root.getObjectByName('flatBelt');if(!belt||!band)return;
 for(const seam of belt.children.filter(o=>o.name.startsWith('beltSeam')))Object.defineProperty(seam,'visible',{configurable:true,get:()=>false,set:()=>{}});
 const r0=bundle.geometry.pulleyRadius+.0002,r1=r0+.025,x0=4.48,xr=x0+6,shape=new THREE.Shape();
 shape.moveTo(x0,-r0);shape.lineTo(xr,-r0);shape.absarc(xr,0,r0,-Math.PI/2,Math.PI/2,false);shape.lineTo(x0,r0);shape.lineTo(x0,r1);shape.lineTo(xr,r1);shape.absarc(xr,0,r1,Math.PI/2,-Math.PI/2,true);shape.lineTo(x0,-r1);
 const run=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.324,bevelEnabled:false,curveSegments:48}).translate(0,0,-.162).rotateX(Math.PI/2),band.material);
 run.name='beltReturnBeyondCrop';run.userData.role='endless-belt-return-beyond-plate-crop';run.castShadow=true;belt.add(run);
 let low=Infinity,high=-Infinity;for(let i=0;i<=64;i++){update(bundle.period*i/64);low=Math.min(low,belt.position.y);high=Math.max(high,belt.position.y);}
 const pulley=root.getObjectByName('middlePulley')??band,height=high-low+.324+.1;
 const drum=new THREE.Mesh(new THREE.CylinderGeometry(r0-.001,r0-.001,height,64),pulley.material);
 drum.position.set(xr,(low+high)/2,0);drum.name='drivingDrumBeyondCrop';drum.userData.role='driving-drum-of-endless-belt-beyond-plate-crop';root.add(drum);
}
export async function makeBakedBeltGovernor(){return makeBeltGovernorModel(await loadBakedBundle(new URL('./assets/163.json.gz',import.meta.url)));}
