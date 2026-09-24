import * as THREE from 'three';
import {loadBakedBundle} from './playback.js';
import {disposeObject3D} from '../dispose-model.js';
import {silkTraverseGeometry as g,silkTraverseAtTime} from '../silk-traverse-kinematics.js';
import {plate,poly,circle,polygonClipping as clip} from '../finite-plate-geometry.js';
// Brown breaks the connecting rod off just below its crank eye and draws no
// slider or guide bar; the presented rod is that stub. The full rod, slider
// and guide stay in the bake for validation and the registry route.
const stubLength=1.05;
function rodStubGeometry(){
 const bar=poly([[0,-.08],[stubLength,-.062],[stubLength,.062],[0,.08]]),eye=poly(circle([0,0],.18,64)),bore=poly(circle([0,0],.071,64));
 return plate(clip.difference(clip.union(bar,eye),bore),.49,.55);
}
export function makeSilkTraverseModel(bundle){
 const root=new THREE.ObjectLoader().parse(bundle.object),blocks=Object.fromEntries(['carrier','planet','rod','slider'].map(n=>[n,root.getObjectByName('body:'+n)]));
 const bounds=new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max));let disposed=false;
 const update=time=>{if(disposed)throw new Error('Movement disposed');const s=silkTraverseAtTime(time);blocks.carrier.rotation.z=s.angle;blocks.planet.rotation.z=g.ratio*s.angle;blocks.rod.position.set(...s.wrist,0);blocks.rod.rotation.z=s.rodAngle;blocks.slider.position.set(...s.slider,0);root.updateMatrixWorld(true);root.userData.state=s;};
 Object.assign(root.userData,{blocks,mechanism:'six-tooth-fixed-pinion-variable-silk-traverse',simulationBackend:'analytic',fidelity:'authored',reconstructionStatus:'verified',hideGround:true,supportsRestart:true,cameraFitBounds:bounds,cameraDistanceScale:1.18,sampledMotionBounds:bundle.bounds,reconstructionNote:'The fixed six-tooth pinion turns the orbiting gear and changes the crank reach over three disk revolutions. The engraving omits the rod’s far end; its full length, output guide, supports and axial depths are reconstructed.',animationTiming:{authoredCyclePeriod:g.period,displayCycleDuration:g.period,playbackTimeScale:1}});
 const rod=blocks.rod.getObjectByName('connecting-rod');rod.geometry.dispose();rod.geometry=rodStubGeometry();rod.userData.presentedStub={length:stubLength,brokenOff:true};
 // Fit the disk, gears and rod stub over the whole cycle, not the slider stroke.
 const presented=new THREE.Box3();for(let i=0;i<=96;i++){update(g.period*i/96);for(const body of [blocks.carrier,blocks.rod])presented.union(new THREE.Box3().setFromObject(body,true));}
 bounds.copy(presented.expandByScalar(.06));
 update(0);return {root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.08,.04,15),update,reset:()=>update(0),dispose:()=>{if(disposed)return;disposed=true;disposeObject3D(root);}};
}
export async function makeBakedSilkTraverse(){return makeSilkTraverseModel(await loadBakedBundle(new URL('./assets/142.json.gz',import.meta.url)));}
