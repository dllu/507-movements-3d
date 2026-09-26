import * as THREE from 'three';
import {plate,poly,circle,capsule,ring,disk,polygonClipping as clip} from './finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';
import {slottedElbowSource as source,slottedElbowParameters,slottedElbowState} from './slotted-elbow-motion.js';

// Straight run of the rod past its ideally guided lower end, far enough that
// the clean end stays below the default view throughout the stroke.
const ROD_RUN_ON=1.2;

export function makeSlottedElbow(){
 const root=new THREE.Group(),g=slottedElbowParameters(),blocks={},parts={},families={};
 for(const name of ['input','lever','rod','fixed']){blocks[name]=new THREE.Group();root.add(blocks[name]);}
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
 // Brown breaks the rod off 205 raster pixels below its eye. The whole rod
 // runs on straight past his break and past the default view at every
 // phase, and ends cleanly in a plain rounded end (p62). Its lower end is
 // ideally guided along the vertical output line (the kinematic rod length
 // g.rodLength); Brown draws no guide or crosshead, so none is modelled.
 const drawnRodLength=205*source.scale;
 const rodEnd=g.rodLength+ROD_RUN_ON;
 const rodShape=clip.difference(clip.union(poly(circle([0,0],.42,128)),poly(circle([rodEnd,0],.10,96)),poly([[0,-.21],[.95,-.21],[1.05,-.10],[rodEnd,-.10],[rodEnd,.10],[1.05,.10],[.95,.21],[0,.21]])),poly(circle([0,0],.204,128)));
 // The default view frames the drawn part of the rod only.
 const drawnRodProxy=new THREE.Mesh(plate(poly([[0,-.21],[drawnRodLength+.04,-.21],[drawnRodLength+.04,.21],[0,.21]]),.66,.82));
 add('connectingRod',plate(rodShape,.66,.82),'rod',PALETTE.brass);
 // The disk axle and the elbow's fixed pivot end as plain stubs: Brown
 // draws no bearings, posts or base (p62 removes the unmounted bearings).
 place('diskAxle',disk(.16,-.45,.18,128),'fixed',[0,0],PALETTE.ink);
 place('pivotAxle',disk(.30,.10,.65,128),'fixed',g.pivot,PALETTE.ink);
 place('pivotRetainer',ring(.30,.38,.524,.61,128),'fixed',g.pivot,PALETTE.ink);
 let disposed=false;
 const update=time=>{if(disposed)throw new Error('Movement has been disposed');const s=slottedElbowState(time,g);blocks.input.rotation.z=s.driverAngle;blocks.lever.position.set(...g.pivot,0);blocks.lever.rotation.z=s.slotAngle;blocks.rod.position.set(...s.output,0);blocks.rod.rotation.z=s.rodAngle;root.userData.state=s;root.updateMatrixWorld(true);};
 Object.assign(root.userData,{blocks,parts,families,geometry:g,source,hideGround:true,cameraFov:18,supportsRestart:true,mechanism:'source-slotted-elbow-variable-reciprocator',fidelity:'authored',reconstructionStatus:'reconstructed',reconstructionNote:'The disk pin slides along the elbow slot, and the pinned rod moves the output. The linkage follows the engraving; the rod runs on straight past Brown\'s break and ends cleanly below the view, its lower end ideally guided on the vertical output line (no guide, crosshead, bearings or posts are drawn or modelled). Motion uses ideal pin and slot constraints.',animationTiming:{authoredCyclePeriod:g.period,displayCycleDuration:g.period,playbackTimeScale:1}});
 root.traverse(o=>{if(o.material)o.material.fog=false;});
 markShadows(root);const bounds=new THREE.Box3();for(let i=0;i<=128;i++){update(g.period*i/128);for(const name of ['input','lever'])bounds.union(new THREE.Box3().setFromObject(blocks[name],true));drawnRodProxy.position.copy(blocks.rod.position);drawnRodProxy.rotation.copy(blocks.rod.rotation);drawnRodProxy.updateMatrixWorld(true);bounds.union(new THREE.Box3().setFromObject(drawnRodProxy,true));}drawnRodProxy.geometry.dispose();bounds.expandByScalar(.03);root.userData.cameraFitBounds=bounds;
 // Fit the whole swept linkage: an authored box alone crops to the initial pose,
 // which let the upright slotted end and the lowest rod stub leave the view.
 root.userData.sampledMotionBounds={min:bounds.min.toArray(),max:bounds.max.toArray()};root.userData.shadowCameraHalfExtent=8;update(0);
 return{root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.02,.03,15),update,reset:()=>update(0),dispose:()=>{if(disposed)return;disposed=true;disposeObject3D(root);}};
}
