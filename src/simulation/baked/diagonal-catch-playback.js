import * as THREE from 'three';
import {sampleBakedMotion} from './playback.js';
import {makeDiagonalCatchUpdater} from '../mujoco-diagonal-catch/update-solids.js';
import {disposeObject3D} from '../dispose-model.js';
import {PALETTE,matte} from '../primitives.js';

// Drive a finished diagonal-catch assembly (deserialized from the bake, or
// rebuilt synchronously for offline reviews) with baked generalized coordinates.
export function makeDiagonalCatchPlayback(root,bundle,id=181){
 const sync=makeDiagonalCatchUpdater(root),parts={},families={};
 root.traverse(o=>{if(o.isMesh){parts[o.name]=o;let parent=o;while(parent&&!parent.name.startsWith('body:'))parent=parent.parent;families[o.name]=parent?.name.slice(5)??'fixed';}});
 const phaseOffset=id===182?bundle.period/2:0;
 const stateAtTime=time=>{
  if(!Number.isFinite(time)||time<0)throw new RangeError('Invalid playback time');
  return sampleBakedMotion(bundle,(time+phaseOffset)%bundle.period);
 };
 const update=time=>sync(stateAtTime(time));
 addDiagonalCatchFrame(root);
 Object.assign(root.userData,{parts,families,stateAtTime,phaseOffset,fidelity:'authored',simulationBackend:'baked-mujoco',
  mechanism:'passive-diagonal-catch',reconstructionStatus:'under-review',hideGround:true,materialsIgnoreSceneFog:true,
  supportsRestart:true,cameraFov:8,cameraDistanceScale:1.02,
  cameraFitBounds:new THREE.Box3(new THREE.Vector3(...bundle.bounds.min),new THREE.Vector3(...bundle.bounds.max)),
  animationTiming:{authoredCyclePeriod:bundle.period,displayCycleDuration:12,playbackTimeScale:bundle.period/12},
  reconstructionNote:'Passive weighted handles and catch follow baked MuJoCo motion with small contact-clearance corrections. Finger supports and depths are inferred; the contours remain under source review. Back-weight rods run to the fixed lower edge of the drawing. The piston rod runs whole through two inferred guides beyond the plate.'});
 update(0);
 return {root,update,reset:()=>update(0),focus:new THREE.Vector3(...bundle.focus),cameraDirection:new THREE.Vector3(0,0,1),dispose:()=>disposeObject3D(root)};
}

// Brown draws the three shafts as cut sections with no frame. Beyond the
// plate they are carried: the two handle shafts run back into bosses on a
// slim frame bar behind the gear (clear of every swept part),
// and the catch's stud, which the upper handle's arm sweeps behind, is tied
// by a short strap (in the free layer just behind the catch) to the upper
// shaft. A stay runs straight back from the bar to the engine framing.
function addDiagonalCatchFrame(root){
 const find=prefix=>{let found=null;root.traverse(o=>{if(!found&&o.isMesh&&o.name.startsWith(prefix))found=o;});return found;};
 const centreOf=mesh=>{mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);};
 root.updateMatrixWorld(true);
 const upper=find('fixed-upper-valve-handle-pivot-fixed-shaft'),lower=find('fixed-lower-valve-handle-pivot-fixed-shaft'),central=find('fixed-central-diagonal-catch-pivot-fixed-shaft');
 if(!upper||!lower||!central)return;
 const material=matte(PALETTE.frame,{metalness:.15,roughness:.65}),steel=upper.material;
 const frame=new THREE.Group();frame.name='engine-frame-beyond-plate';frame.userData.beyondPlateCrop=true;
 const add=(name,geometry,x,y,z,mat=material)=>{const mesh=new THREE.Mesh(geometry,mat);mesh.name=name;mesh.position.set(x,y,z);frame.add(mesh);return mesh;};
 const zShaftBack=-.74,zBoss=-.9,zPlate=-1.02;
 for(const [label,shaft]of [['upper',upper],['lower',lower]]){
  const c=centreOf(shaft),r=shaft.geometry.parameters?.radiusTop??.11;
  add(`fixed-${label}-shaft-extension-into-frame`,new THREE.CylinderGeometry(r,r,zShaftBack-zBoss,32).rotateX(Math.PI/2),c.x,c.y,(zShaftBack+zBoss)/2,steel);
  add(`fixed-${label}-shaft-bearing-boss`,new THREE.CylinderGeometry(r+.13,r+.13,zBoss-zPlate,32).rotateX(Math.PI/2),c.x,c.y,(zBoss+zPlate)/2);
 }
 // The bar between the bosses lies behind the gear in the plate's view; a
 // stay runs straight back from it to a flange on the engine framing.
 const u=centreOf(upper),l=centreOf(lower),x=(u.x+l.x)/2,top=u.y+.3,bottom=l.y-.3,zFlange=-2.4;
 add('engine-frame-bar-behind-handle-shafts',new THREE.BoxGeometry(.24,top-bottom,zBoss-zPlate),x,(top+bottom)/2,(zBoss+zPlate)/2);
 add('engine-frame-stay-running-back',new THREE.BoxGeometry(.3,.3,zPlate-zFlange),x,(u.y+l.y)/2,(zPlate+zFlange)/2);
 add('engine-frame-stay-flange',new THREE.BoxGeometry(.9,.9,.08),x,(u.y+l.y)/2,zFlange-.04);
 // The catch stud extends back to the strap, which bolts to the upper shaft.
 const c=centreOf(central),cr=central.geometry.parameters?.radiusTop??.11,zStrapLow=.1,zStrapHigh=.28;
 add('fixed-catch-stud-extension',new THREE.CylinderGeometry(cr,cr,.32-zStrapLow,32).rotateX(Math.PI/2),c.x,c.y,(.32+zStrapLow)/2,steel);
 const strapLength=Math.hypot(u.x-c.x,u.y-c.y);
 const strap=add('fixed-strap-tying-catch-stud-to-upper-shaft',new THREE.BoxGeometry(.2,strapLength+.24,zStrapHigh-zStrapLow),(u.x+c.x)/2,(u.y+c.y)/2,(zStrapLow+zStrapHigh)/2);
 strap.rotation.z=-Math.atan2(u.x-c.x,u.y-c.y);
 // The piston rod runs whole through two plain rectangular guides beyond the
 // plate, clear of every swept part at full stroke: the rod is carried on up
 // (a straight extension of the same bar) through the upper guide, and its
 // lower end stays inside the lower guide. Each guide is carried straight
 // back by a web to a flange on the engine framing plane.
 const rod=find('piston-rod');
 if(rod){
  rod.geometry.computeBoundingBox();const b=rod.geometry.boundingBox.clone().applyMatrix4(rod.matrixWorld);
  const hx=(b.max.x-b.min.x)/2+.004,hz=(b.max.z-b.min.z)/2+.004,cx=(b.min.x+b.max.x)/2,cz=(b.min.z+b.max.z)/2,wall=.06;
  const localTop=b.max.y-rod.parent.position.y,extensionTop=5.5;
  const extension=new THREE.Mesh(new THREE.BoxGeometry(b.max.x-b.min.x,extensionTop-localTop+.01,b.max.z-b.min.z),rod.material);
  extension.name='piston-rod-whole-beyond-plate';extension.position.set(cx,(localTop-.01+extensionTop)/2,cz);rod.parent.add(extension);
  for(const [label,y0,y1]of [['upper',3.2,3.7],['lower',-5.3,-4.8]]){
   const shape=new THREE.Shape([[-hx-wall,-hz-wall],[hx+wall,-hz-wall],[hx+wall,hz+wall],[-hx-wall,hz+wall]].map(p=>new THREE.Vector2(...p)));
   shape.holes.push(new THREE.Path([[-hx,-hz],[-hx,hz],[hx,hz],[hx,-hz]].map(p=>new THREE.Vector2(...p))));
   add(`fixed-${label}-piston-rod-guide`,new THREE.ExtrudeGeometry(shape,{depth:y1-y0,bevelEnabled:false}).rotateX(Math.PI/2),cx,y1,cz);
   const webFront=cz-hz-wall/2;
   add(`fixed-${label}-piston-rod-guide-web`,new THREE.BoxGeometry(2*(hx+wall),y1-y0,webFront-zPlate),cx,(y0+y1)/2,(webFront+zPlate)/2);
   add(`fixed-${label}-piston-rod-guide-flange`,new THREE.BoxGeometry(.8,Math.max(.7,y1-y0+.2),.08),cx,(y0+y1)/2,zPlate-.04);
  }
 }
 frame.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.material.fog=false;}});
 root.add(frame);
}
