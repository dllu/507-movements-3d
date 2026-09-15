import * as THREE from 'three';
import {plate,poly,circle,capsule,ring,disk,polygonClipping as clip} from './finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';
import {pinnedElbowParameters,pinnedElbowState} from './pinned-elbow-motion.js';
import {pinnedElbowFittedSource as source} from './pinned-elbow-fit.js';

export function makePinnedElbow(){
 const root=new THREE.Group(),g=pinnedElbowParameters(source),blocks={},parts={},families={};
 for(const name of ['input','lever','coupler','rod','slider','fixed']){blocks[name]=new THREE.Group();root.add(blocks[name]);}
 const materials=new Map();
 const add=(name,geometry,family,color)=>{if(!materials.has(color))materials.set(color,matte(color,{metalness:.15,roughness:.6,fog:false}));const mesh=new THREE.Mesh(geometry,materials.get(color));mesh.name=name;blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 const place=(name,geometry,family,point,color)=>{const mesh=add(name,geometry,family,color);mesh.position.set(...point,0);return mesh;};
 const rectangle=(x0,x1,y0,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
 const pinRadius=.17;
 add('disk',ring(.164,source.diskRadius*source.scale,-.30,0,128),'input',PALETTE.driver);
 add('diskHub',ring(.164,.238,0,.12,128),'input',PALETTE.ink);
 place('crankPin',disk(pinRadius,0,.88,128),'input',g.pin,PALETTE.brass);
 place('crankRetainer',ring(pinRadius,pinRadius+.045,.824,.88,128),'input',g.pin,PALETTE.ink);
 place('crankFace',disk(pinRadius*.72,.88,.90,128),'input',g.pin,PALETTE.white);
 const outputLocal=[g.outputLength*Math.cos(g.includedAngle),g.outputLength*Math.sin(g.includedAngle)];
 const inputLocal=[g.inputLength,0];
 const taper=(a,b,ra,rb)=>{const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length;return poly([[a[0]+nx*ra,a[1]+ny*ra],[b[0]+nx*rb,b[1]+ny*rb],[b[0]-nx*rb,b[1]-ny*rb],[a[0]-nx*ra,a[1]-ny*ra]]);};
 const outline=clip.union(taper([0,0],inputLocal,.36,.22),taper([0,0],outputLocal,.36,.19),poly(circle([0,0],.378,128)),poly(circle(inputLocal,.294,128)),poly(circle(outputLocal,.28,128)));
 add('bellCrank',plate(clip.difference(outline,poly(circle([0,0],.242,128))),.30,.52),'lever',PALETTE.driven);
 add('leverSleeve',ring(.242,.34,.24,.30,128),'lever',PALETTE.driven);
 for(const [name,point]of [['upper',inputLocal],['output',outputLocal]]){
  place(name+'Pin',disk(.17,.52,.88,128),'lever',point,PALETTE.ink);
  place(name+'Retainer',ring(.17,.215,.824,.88,128),'lever',point,PALETTE.ink);
 }
 const couplerShape=clip.difference(clip.union(capsule([0,0],[g.couplerLength,0],.095,64),poly(circle([0,0],.294,128)),poly(circle([g.couplerLength,0],.294,128))),poly(circle([0,0],.174,128)),poly(circle([g.couplerLength,0],.174,128)));
 add('inputRod',plate(couplerShape,.66,.82),'coupler',PALETTE.brass);
 const rodShape=clip.difference(clip.union(poly(circle([0,0],.28,128)),poly([[0,-.13],[g.rodLength,-.13],[g.rodLength,.13],[0,.13]]),poly(circle([g.rodLength,0],.22,128))),poly(circle([0,0],.174,128)),poly(circle([g.rodLength,0],.104,128)));
 add('connectingRod',plate(rodShape,.66,.82),'rod',PALETTE.brass);
 add('crosshead',plate(rectangle(-.28,.28,-.16,.16),.32,.62),'slider',PALETTE.brass);
 add('sliderPin',disk(.10,.62,.88,128),'slider',PALETTE.ink);
 add('sliderRetainer',ring(.10,.14,.824,.88,128),'slider',PALETTE.ink);
 let low=Infinity,high=-Infinity;
 for(let i=0;i<=512;i++){const y=pinnedElbowState(g.period*i/512,g).slider[1];low=Math.min(low,y);high=Math.max(high,y);}
 const baseY=low-.40,guideLow=low-.20,guideHigh=high+.20;
 place('diskAxle',disk(.16,-.85,.18,128),'fixed',[0,0],PALETTE.ink);
 place('diskBearing',ring(.164,.32,-.78,-.54,128),'fixed',[0,0],PALETTE.frame);
 place('pivotAxle',disk(.238,-.85,.65,128),'fixed',g.pivot,PALETTE.ink);
 place('pivotBearing',ring(.242,.38,-.78,-.54,128),'fixed',g.pivot,PALETTE.frame);
 place('pivotRetainer',ring(.238,.30,.524,.61,128),'fixed',g.pivot,PALETTE.ink);
 add('base',plate(rectangle(-1.90,g.guideX+.60,baseY-.12,baseY),-.92,-.66),'fixed',PALETTE.frame);
 add('diskPost',plate(rectangle(-.12,.12,baseY,.05),-.90,-.78),'fixed',PALETTE.frame);
 add('pivotPost',plate(rectangle(g.pivot[0]-.12,g.pivot[0]+.12,baseY,g.pivot[1]+.05),-.90,-.78),'fixed',PALETTE.frame);
 add('guidePost',plate(rectangle(g.guideX+.38,g.guideX+.52,baseY,guideHigh),-.90,-.76),'fixed',PALETTE.frame);
 add('guideBack',plate(rectangle(g.guideX-.40,g.guideX+.40,guideLow,guideHigh),.28,.316),'fixed',PALETTE.frame);
 for(const x of [g.guideX-.342,g.guideX+.342])add('guideRail'+x,plate(rectangle(x-.058,x+.058,guideLow,guideHigh),.316,.62),'fixed',PALETTE.frame);
 for(const y of [guideLow+.10,guideHigh-.10]){
  add('guideBackArm'+y,plate(rectangle(g.guideX-.38,g.guideX+.52,y-.06,y+.06),-.90,-.76),'fixed',PALETTE.frame);
  for(const x of [g.guideX-.34,g.guideX+.34])place('guideStandoff'+x+','+y,disk(.045,-.76,.28,64),'fixed',[x,y],PALETTE.frame);
 }
 let disposed=false;
 const update=time=>{if(disposed)throw new Error('Movement has been disposed');const s=pinnedElbowState(time,g);blocks.input.rotation.z=s.driverAngle;blocks.lever.position.set(...g.pivot,0);blocks.lever.rotation.z=s.bellAngle;blocks.coupler.position.set(...s.pin,0);blocks.coupler.rotation.z=s.couplerAngle;blocks.rod.position.set(...s.output,0);blocks.rod.rotation.z=s.rodAngle;blocks.slider.position.set(...s.slider,0);root.userData.state=s;root.updateMatrixWorld(true);};
 Object.assign(root.userData,{blocks,parts,families,geometry:g,source,hideGround:true,cameraFov:18,supportsRestart:true,mechanism:'source-pinned-elbow-variable-reciprocator',fidelity:'authored',reconstructionStatus:'reconstructed',reconstructionNote:'Two pinned rods connect the disk, bell crank and guided output. Three joint centers are adjusted by 9–12 pixels from the engraving to permit a full crank turn. The lower rod length, guide and rear supports are reconstructed. Motion uses ideal rigid-link constraints.',animationTiming:{authoredCyclePeriod:g.period,displayCycleDuration:g.period,playbackTimeScale:1}});
 root.traverse(o=>{if(o.material)o.material.fog=false;});
 markShadows(root);const bounds=new THREE.Box3();for(let i=0;i<=128;i++){update(g.period*i/128);bounds.union(new THREE.Box3().setFromObject(root,true));}bounds.expandByScalar(.03);root.userData.cameraFitBounds=bounds;root.userData.shadowCameraHalfExtent=8;update(0);
 return{root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.02,.03,15),update,reset:()=>update(0),dispose:()=>{if(disposed)return;disposed=true;disposeObject3D(root);}};
}
