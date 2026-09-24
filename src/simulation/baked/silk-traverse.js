import * as THREE from 'three';
import {loadBakedBundle} from './playback.js';
import {disposeObject3D} from '../dispose-model.js';
import {silkTraverseGeometry as g,silkTraverseAtTime} from '../silk-traverse-kinematics.js';
// Brown's rod runs straight down from the crank eye past the disk to the
// plate edge. The complete 370-pixel rod, its slider and the vertical guide
// rail are presented; the view is cropped at the plate's lower edge so the rod
// and guide run out of frame there, as Brown draws. The rod never points up
// freely: its lower end always rides the fixed vertical guide.
const plateEdge=-3.2;
export function makeSilkTraverseModel(bundle){
 const root=new THREE.ObjectLoader().parse(bundle.object),blocks=Object.fromEntries(['carrier','planet','rod','slider'].map(n=>[n,root.getObjectByName('body:'+n)]));
 const bounds=new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max));let disposed=false;
 const update=time=>{if(disposed)throw new Error('Movement disposed');const s=silkTraverseAtTime(time);blocks.carrier.rotation.z=s.angle;blocks.planet.rotation.z=g.ratio*s.angle;blocks.rod.position.set(...s.wrist,0);blocks.rod.rotation.z=s.rodAngle;blocks.slider.position.set(...s.slider,0);root.updateMatrixWorld(true);root.userData.state=s;};
 Object.assign(root.userData,{blocks,mechanism:'six-tooth-fixed-pinion-variable-silk-traverse',simulationBackend:'analytic',fidelity:'authored',reconstructionStatus:'verified',hideGround:true,supportsRestart:true,cameraFitBounds:bounds,cameraDistanceScale:1.18,sampledMotionBounds:bundle.bounds,reconstructionNote:'The fixed six-tooth pinion turns the orbiting gear and changes the crank reach over three disk revolutions. The engraving crops the rod at its lower edge; the full rod, its slider on a vertical guide rail (running out of the cropped view) and axial depths are reconstructed.',animationTiming:{authoredCyclePeriod:g.period,displayCycleDuration:g.period,playbackTimeScale:1}});
 // Fit the disk and gears over the whole cycle plus the rod down to the plate
 // edge; the slider's lower travel and the guide continue out of frame.
 const presented=new THREE.Box3();for(let i=0;i<=96;i++){update(g.period*i/96);presented.union(new THREE.Box3().setFromObject(blocks.carrier,true));}
 presented.expandByScalar(.06);presented.min.y=Math.min(presented.min.y,plateEdge);bounds.copy(presented);
 root.userData.presentedCrop={plateEdge,cropsGuide:true};
 update(0);return {root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.08,.04,15),update,reset:()=>update(0),dispose:()=>{if(disposed)return;disposed=true;disposeObject3D(root);}};
}
export async function makeBakedSilkTraverse(){return makeSilkTraverseModel(await loadBakedBundle(new URL('./assets/142.json.gz',import.meta.url)));}
