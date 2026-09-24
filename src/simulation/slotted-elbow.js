import * as THREE from 'three';
import {plate,poly,circle,capsule,ring,disk,polygonClipping as clip} from './finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';
import {slottedElbowSource as source,slottedElbowParameters,slottedElbowState} from './slotted-elbow-motion.js';

export function makeSlottedElbow(){
 const root=new THREE.Group(),g=slottedElbowParameters(),blocks={},parts={},families={};
 for(const name of ['input','lever','rod','slider','fixed']){blocks[name]=new THREE.Group();root.add(blocks[name]);}
 const materials=new Map();
 const add=(name,geometry,family,color)=>{if(!materials.has(color))materials.set(color,matte(color,{metalness:.15,roughness:.6,fog:false}));const mesh=new THREE.Mesh(geometry,materials.get(color));mesh.name=name;blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 const place=(name,geometry,family,point,color)=>{const mesh=add(name,geometry,family,color);mesh.position.set(...point,0);return mesh;};
 const rectangle=(x0,x1,y0,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
 const pinRadius=source.pinRadius*source.scale,halfWidth=source.slotHalfWidth*source.scale;
 add('disk',ring(.164,source.diskRadius*source.scale,-.30,0,128),'input',PALETTE.driver);
 add('diskHub',ring(.164,.25,0,.12,128),'input',PALETTE.ink);
 place('crankPin',disk(pinRadius,0,.66,128),'input',g.pin,PALETTE.brass);
 place('crankRetainer',ring(pinRadius,pinRadius+.045,.524,.59,128),'input',g.pin,PALETTE.ink);
 place('crankFace',disk(pinRadius*.72,.66,.68,128),'input',g.pin,PALETTE.white);
 const outputLocal=[g.outputLength*Math.cos(g.includedAngle),g.outputLength*Math.sin(g.includedAngle)];
 const outline=clip.union(capsule([0,0],[g.farCapDistance,0],source.armHalfWidth*source.scale,96),capsule([0,0],outputLocal,.22,64),poly(circle([0,0],.56,128)),poly(circle(outputLocal,.42,128)));
 const leverShape=clip.difference(outline,capsule([g.nearCapDistance,0],[g.farCapDistance,0],halfWidth,96),poly(circle([0,0],.304,128)));
 add('slottedElbow',plate(leverShape,.30,.52),'lever',PALETTE.driven);
 add('leverSleeve',ring(.304,.45,.24,.30,128),'lever',PALETTE.driven);
 place('outputPin',disk(.20,.52,.88,128),'lever',outputLocal,PALETTE.ink);
 place('outputRetainer',ring(.20,.24,.824,.88,128),'lever',outputLocal,PALETTE.ink);
 // Brown breaks the rod off 205 raster pixels below its eye; its guided
 // lower end (the kinematic rod length) lies beyond the drawing.
 const drawnRodLength=205*source.scale;
 const rodShape=clip.difference(clip.union(poly(circle([0,0],.42,128)),poly([[0,-.21],[.95,-.21],[1.05,-.10],[drawnRodLength-.04,-.10],[drawnRodLength+.03,-.03],[drawnRodLength,.02],[drawnRodLength+.04,.10],[1.05,.10],[.95,.21],[0,.21]])),poly(circle([0,0],.204,128)));
 add('connectingRod',plate(rodShape,.66,.82),'rod',PALETTE.brass);
 add('crosshead',plate(rectangle(-.28,.28,-.16,.16),.32,.62),'slider',PALETTE.brass);
 add('sliderPin',disk(.10,.62,.88,128),'slider',PALETTE.ink);
 add('sliderRetainer',ring(.10,.14,.824,.88,128),'slider',PALETTE.ink);
 let low=Infinity,high=-Infinity;
 for(let i=0;i<=512;i++){const y=slottedElbowState(g.period*i/512,g).slider[1];low=Math.min(low,y);high=Math.max(high,y);}
 const baseY=low-.40,guideLow=low-.20,guideHigh=high+.20;
 place('diskAxle',disk(.16,-.85,.18,128),'fixed',[0,0],PALETTE.ink);
 place('diskBearing',ring(.164,.32,-.78,-.54,128),'fixed',[0,0],PALETTE.frame);
 place('pivotAxle',disk(.30,-.85,.65,128),'fixed',g.pivot,PALETTE.ink);
 place('pivotBearing',ring(.304,.46,-.78,-.54,128),'fixed',g.pivot,PALETTE.frame);
 place('pivotRetainer',ring(.30,.38,.524,.61,128),'fixed',g.pivot,PALETTE.ink);
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
 const update=time=>{if(disposed)throw new Error('Movement has been disposed');const s=slottedElbowState(time,g);blocks.input.rotation.z=s.driverAngle;blocks.lever.position.set(...g.pivot,0);blocks.lever.rotation.z=s.slotAngle;blocks.rod.position.set(...s.output,0);blocks.rod.rotation.z=s.rodAngle;blocks.slider.position.set(...s.slider,0);root.userData.state=s;root.updateMatrixWorld(true);};
 Object.assign(root.userData,{blocks,parts,families,geometry:g,source,hideGround:true,cameraFov:18,supportsRestart:true,mechanism:'source-slotted-elbow-variable-reciprocator',fidelity:'authored',reconstructionStatus:'reconstructed',reconstructionNote:'The disk pin slides along the elbow slot, and the pinned rod moves the guided output. The linkage follows the engraving; the rod is drawn broken off as on the plate, and its lower length, guide and rear supports are reconstructed off the drawing. Motion uses ideal pin and slot constraints.',animationTiming:{authoredCyclePeriod:g.period,displayCycleDuration:g.period,playbackTimeScale:1}});
 root.traverse(o=>{if(o.material)o.material.fog=false;});
 markShadows(root);const bounds=new THREE.Box3();for(let i=0;i<=128;i++){update(g.period*i/128);for(const name of ['input','lever','rod'])bounds.union(new THREE.Box3().setFromObject(blocks[name],true));}bounds.expandByScalar(.03);root.userData.cameraFitBounds=bounds;root.userData.shadowCameraHalfExtent=8;update(0);
 return{root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.02,.03,15),update,reset:()=>update(0),dispose:()=>{if(disposed)return;disposed=true;disposeObject3D(root);}};
}
