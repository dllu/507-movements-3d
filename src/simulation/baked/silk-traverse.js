import * as THREE from 'three';
import {loadBakedBundle} from './playback.js';
import {disposeObject3D} from '../dispose-model.js';
import {silkTraverseGeometry as g,silkTraverseAtTime} from '../silk-traverse-kinematics.js';
export function makeSilkTraverseModel(bundle){
 const root=new THREE.ObjectLoader().parse(bundle.object),blocks=Object.fromEntries(['carrier','planet','rod','slider'].map(n=>[n,root.getObjectByName('body:'+n)]));
 const bounds=new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max));let disposed=false;
 const update=time=>{if(disposed)throw new Error('Movement disposed');const s=silkTraverseAtTime(time);blocks.carrier.rotation.z=s.angle;blocks.planet.rotation.z=g.ratio*s.angle;blocks.rod.position.set(...s.wrist,0);blocks.rod.rotation.z=s.rodAngle;blocks.slider.position.set(...s.slider,0);root.updateMatrixWorld(true);root.userData.state=s;};
 Object.assign(root.userData,{blocks,mechanism:'six-tooth-fixed-pinion-variable-silk-traverse',simulationBackend:'analytic',fidelity:'authored',reconstructionStatus:'verified',hideGround:true,supportsRestart:true,cameraFitBounds:bounds,cameraDistanceScale:1.18,sampledMotionBounds:bundle.bounds,reconstructionNote:'The fixed six-tooth pinion turns the orbiting gear and changes the crank reach over three disk revolutions. The engraving omits the rod’s far end; its full length, output guide, supports and axial depths are reconstructed.',animationTiming:{authoredCyclePeriod:g.period,displayCycleDuration:g.period,playbackTimeScale:1}});
 update(0);return {root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.08,.04,15),update,reset:()=>update(0),dispose:()=>{if(disposed)return;disposed=true;disposeObject3D(root);}};
}
export async function makeBakedSilkTraverse(){return makeSilkTraverseModel(await loadBakedBundle(new URL('./assets/142.json.gz',import.meta.url)));}
