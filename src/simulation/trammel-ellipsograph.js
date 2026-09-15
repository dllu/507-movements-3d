import * as THREE from 'three';
import {createAuthoredDrawingInstrumentMovement} from './authored-drawing-instruments.js';
import {plate,poly,circle,ring,polygonClipping as clip} from './finite-plate-geometry.js';
import {matte,PALETTE} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';

export function makeTrammelEllipsograph(){
 const model=createAuthoredDrawingInstrumentMovement({id:152}),root=model.root,u=root.userData,b=u.blocks,g=u.geometry,legacyUpdate=model.update;
 const material=matte(PALETTE.driven,{metalness:.15,roughness:.6});material.fog=false;
 const shoeMaterial=matte(PALETTE.accent,{metalness:.1,roughness:.65});shoeMaterial.fog=false;
 const add=(name,geometry,parent,mat=material)=>{const mesh=new THREE.Mesh(geometry,mat);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;};
 // Fixed-to-bar bushings fill the deliberately oversized legacy bores.
 for(const [name,assembly,inner] of [['horizontal',b.horizontalStudAssembly,g.studRadius??.12],['vertical',b.verticalStudAssembly,g.studRadius??.12],['pencil',b.pencilAssembly,g.pencilRadius]]){
  add(`${name}-bar-bushing`,ring(inner+.001,.18,-g.barThickness/2,g.barThickness/2,96).rotateX(-Math.PI/2),assembly);
 }
 const shoes=[];
 for(const [name,width,length] of [['horizontal',.332,.68],['vertical',.412,.68]]){
  const shoe=new THREE.Group();shoe.name=`${name}-guide-shoe`;root.add(shoe);
  const hx=name==='horizontal'?length/2:width/2,hz=name==='horizontal'?width/2:length/2;
  const outline=poly([[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]]);
  add(`${name}-bored-guide-shoe`,plate(clip.difference(outline,poly(circle([0,0],.124,96))),.21,.41).rotateX(-Math.PI/2),shoe,shoeMaterial);
  shoes.push(shoe);
 }
 // The trace is an annotation, not a raised rail or moving contact ball.
 b.traceMarker.removeFromParent();b.traceMarker.geometry.dispose();
 b.ellipseTrace.material.color.set(PALETTE.ink);b.ellipseTrace.castShadow=false;b.ellipseTrace.receiveShadow=false;
 root.rotation.x=Math.PI/2;
 const update=time=>{legacyUpdate(time);const s=u.kinematics;shoes[0].position.set(s.horizontalStud.position.x,0,s.horizontalStud.position.z);shoes[1].position.set(s.verticalStud.position.x,0,s.verticalStud.position.z);root.updateMatrixWorld(true);};
 Object.assign(b,{guideShoes:shoes});
 Object.assign(u,{hideGround:true,cameraFov:18,supportsRestart:true,reconstructionStatus:'reviewed-ideal-guides',
  reconstructionNote:'The two studs slide in perpendicular grooves while the pencil traces an ellipse. Hidden guide shoes and close-fitting bushings are reconstructed. The joints and guides are ideal; friction and backlash are omitted.',
  animationTiming:{authoredCyclePeriod:6,displayCycleDuration:6,playbackTimeScale:1}});
 update(0);
 return {root,update,reset:()=>update(0),cameraDirection:new THREE.Vector3(.02,.03,15),dispose:()=>disposeObject3D(root)};
}
