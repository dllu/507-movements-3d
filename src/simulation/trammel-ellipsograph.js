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
 // Brown's ellipse is the pencil's line on the paper. Model the paper as a
 // plain drawing board under the instrument, the ellipse as a thin flat ink
 // line lying on it, and give the grooved cross-piece a solid base resting on
 // the board so neither the line nor the cross floats.
 const paperTop=.045,crossFloor=.148,wallBase=.2,ea=b.ellipseTrace.userData.semiMajor,eb=b.ellipseTrace.userData.semiMinor;
 const ellipse=(ra,rb,n=360)=>Array.from({length:n},(_,i)=>[ra*Math.cos(i/n*2*Math.PI),rb*Math.sin(i/n*2*Math.PI)]);
 b.ellipseTrace.geometry.dispose();
 b.ellipseTrace.geometry=plate(clip.difference(poly(ellipse(ea+.02,eb+.02)),poly(ellipse(ea-.02,eb-.02))),paperTop,paperTop+.004).rotateX(-Math.PI/2);
 b.ellipseTrace.material.color.set(PALETTE.ink);b.ellipseTrace.castShadow=false;b.ellipseTrace.receiveShadow=true;
 // Pass 93: the sheet is a parchment tint, not the page background colour
 // (#f3f0e9), so it reads as a sheet rather than only by its shadow.
 const boardMaterial=matte(0xe9e1cf,{roughness:.9});boardMaterial.fog=false;
 // Brown draws only the ellipse, no board edge: the paper is an elliptical
 // sheet with a plain margin round the line (and round the cross), not an
 // undrawn rectangular board.
 const boardMargin=.4;
 add('drawing-board-under-ellipse',plate(poly(ellipse(ea+boardMargin,eb+boardMargin,720)),paperTop-.1,paperTop).rotateX(-Math.PI/2),root,boardMaterial).castShadow=false;
 {
  const box=new THREE.Box3(),walls=[],floors=[];root.updateMatrixWorld(true);
  const toRoot=new THREE.Matrix4().copy(root.matrixWorld).invert();
  root.traverse(o=>{const r=o.userData?.role??'';if(!o.isMesh)return;
   if(/groove-side-wall|solid-corner-around|closed-(?:horizontal|vertical)-groove-end/.test(r)){box.setFromObject(o).applyMatrix4(toRoot);walls.push(box.clone());}
   if(/recessed-(?:horizontal|vertical)-groove-floor/.test(r)){box.setFromObject(o).applyMatrix4(toRoot);floors.push(box.clone());}});
  // Local frame: x across, z = minus the screen y, y up from the paper.
  const rect=bx=>poly([[bx.min.x,-bx.max.z],[bx.max.x,-bx.max.z],[bx.max.x,-bx.min.z],[bx.min.x,-bx.min.z]]);
  const outline=clip.union(...walls.map(rect),...floors.map(rect));
  let wallMesh;root.traverse(o=>{if(!wallMesh&&o.isMesh&&/groove-side-wall/.test(o.userData?.role??''))wallMesh=o;});
  add('cross-piece-solid-base-on-board',plate(outline,paperTop,crossFloor).rotateX(-Math.PI/2),root,wallMesh.material);
  add('cross-piece-base-under-groove-walls',plate(clip.difference(outline,...floors.map(rect)),crossFloor,wallBase).rotateX(-Math.PI/2),root,wallMesh.material);
 }
 root.rotation.x=Math.PI/2;
 const update=time=>{legacyUpdate(time);const s=u.kinematics;shoes[0].position.set(s.horizontalStud.position.x,0,s.horizontalStud.position.z);shoes[1].position.set(s.verticalStud.position.x,0,s.verticalStud.position.z);root.updateMatrixWorld(true);};
 Object.assign(b,{guideShoes:shoes});
 Object.assign(u,{hideGround:true,cameraFov:18,supportsRestart:true,reconstructionStatus:'reviewed-ideal-guides',
  reconstructionNote:'The two studs slide in perpendicular grooves while the pencil traces an ellipse. Hidden guide shoes and close-fitting bushings are reconstructed. The joints and guides are ideal; friction and backlash are omitted.',
  animationTiming:{authoredCyclePeriod:6,displayCycleDuration:6,playbackTimeScale:1}});
 update(0);
 return {root,update,reset:()=>update(0),cameraDirection:new THREE.Vector3(.02,.03,15),dispose:()=>disposeObject3D(root)};
}
