import * as THREE from 'three';
import {FACE_SLOT_WORM_195,pocketFaceWheel195Geometry} from './face-slot-worm-195.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {markShadows} from './primitives.js';

function bored(mesh,radius,bore,length,replaced){
 replaced.add(mesh.geometry);
 mesh.geometry=boredLatheGeometry([{radial:radius,axial:-length/2},{radial:radius,axial:length/2}],bore,64);mesh.userData.boreRadius=bore;
}
function mark(mesh,z,replaced,length=.42){replaced.add(mesh.geometry);mesh.geometry=new THREE.BoxGeometry(length,.045,.003);mesh.position.z=z;}
export function correctFeedWormAssembly(root,id){
 const d=root.userData,b=d.blocks;
 const journals=[],replaced=new Set();
 if(id===195){
  // p99: each wheel is one closed solid carrying Brown's 24 rectangular face
  // slots, open at the rim (face-slot-worm-195.js); the worm's crest is cut
  // by those slots, so the pair is exact without scalloped tooth spaces.
  const wheelGeometry=pocketFaceWheel195Geometry(),{wheelDepth:T,wheelOuterRadius:R,boreRadius:bore}=FACE_SLOT_WORM_195;
  for(const side of ['upper','lower']){
   const old=b[side+'WheelBody'],rotor=b[side+'WheelRotor'],sign=side==='upper'?1:-1;
   old.visible=false;for(const groove of b[side+'Grooves'])groove.visible=false;b[side+'VisibleRim'].visible=false;
   const geometry=sign<0?wheelGeometry.clone().rotateX(Math.PI):wheelGeometry;
   const body=new THREE.Mesh(geometry,old.material);
   body.userData.role=side+'-rim-slotted-face-worm-wheel';rotor.add(body);b[side+'GeneratedFace']=body;
   // The plain back face carries the lower wheel's rotation cue: a thin disc
   // just proud of the back, inside the rim so no faces coincide.
   const back=new THREE.Mesh(boredLatheGeometry([{radial:R-.002,axial:-T-.004},{radial:R-.002,axial:-T+.001}],bore,96),old.material);back.rotation.x=sign*Math.PI/2;rotor.add(back);b[side+'SmoothBack']=back;
   back.userData.role=side+'-smooth-back-face';
   // Brown draws the same hub on both wheels: a boss about a quarter of the
   // wheel's radius with an inner circle half that size. It is turned in the
   // wheel's own metal as a boss with a short raised collar on each face.
   // p101: a darker shade of the wheel metal with a 45-degree chamfer on the
   // collar, so the double ring reads without relying on shadow.
   {const hub=b[side+'WheelHub'];replaced.add(hub.geometry);hub.material=old.material.clone();hub.material.color.multiplyScalar(.66);
    hub.geometry=boredLatheGeometry([{radial:.16,axial:-.32},{radial:.16,axial:-.28},{radial:.29,axial:-.28},{radial:.32,axial:-.25},
     {radial:.32,axial:.25},{radial:.29,axial:.28},{radial:.16,axial:.28},{radial:.16,axial:.32}],.074,96);hub.userData.boreRadius=.074;}
   journals.push({shaft:b[side+'WheelShaft'],part:b[side+'WheelHub'],radius:.073,bore:.074});
   const faceZ=b[side+'Wheel'].position.z;
   mark(b[side+'Index'],side==='upper'?.0015:.3655,replaced);b[side+'WheelShaft'].scale.z=.4;b[side+'WheelShaft'].position.z=faceZ+(side==='upper'?-.18:.18);
  }
  for(const x of[b.frameFoot,b.framePost,b.lowerBearingArm,b.upperBearingArm,...b.wheelBearings,...b.wormBearings,...b.wormBearingPosts])x.visible=false;
  b.wormIndex.visible=false;
  d.reconstructionNote='Identical face-slotted wheels lie on opposite sides of one screw and turn at equal opposite 24:1 rates. Brown\'s rectangular slots are kept; the worm stands clear of both faces and only the outer part of its square thread enters the slots, its crest cut by the slots themselves. Dimensions, thread section and running clearances are inferred; motion is prescribed and loaded friction/backlash are not solved. Unpictured bearing frames are omitted.';
 }else{
  for(const side of ['left','right']){
   // The generated wheel is bored 0.093 on the 0.092 shaft (its running fit).
   // The hub's bore is 0.003 wider, so inside the wheel it is buried in solid
   // metal instead of coinciding with the wheel's bore wall (a flickering
   // double surface).
   bored(b[side+'WheelHub'],.22,.096,.70,replaced);journals.push({shaft:b[side+'WheelShaft'],part:b[side+'WheelHub'],radius:.092,bore:.096});
   mark(b[side+'WheelIndex'],.1915,replaced,.36);
   // p104: 0.03 proud of the hub faces (+-0.35); the longer stub threw a
   // stripe across the wheel face.
   b[side+'WheelShaft'].scale.z=.76/2.45;b[side+'WheelShaft'].position.z=0;
  }
  for(const x of[b.baseRail,...b.baseFeet,...b.wheelBearingPosts,...b.wheelBearings,...b.inputBearingPosts,...b.inputBearings])x.visible=false;
  b.shaftIndex.visible=false;
  d.reconstructionNote='Opposite-hand screws on one shaft turn equal 24-tooth wheels oppositely. Their reconstructed finite flanks retain small running clearance; rotation follows the ideal 24:1 law, without solved friction, load sharing or backlash. Unpictured bearing frames are omitted; full wheels continue the dotted source arcs.';
 }
 for(const geometry of replaced)geometry.dispose();
 d.sourceAnimation={available:false,sourceUrl:`https://507movements.com/mm_${id}.html`,reason:'Official HTML contains no registered add_model/mm_present animation.'};
 d.journalReview=journals;d.hideGround=true;d.cameraFov=8;d.cameraDistanceScale=1.02;d.minimumDisplayCycleSeconds=2*Math.PI/2.4;
 root.updateMatrixWorld(true);const box=new THREE.Box3();root.traverseVisible(o=>{if(o.isMesh){o.geometry.computeBoundingBox();if(o.isInstancedMesh){o.computeBoundingBox();box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));}else box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)m.fog=false;});
 // Tooth rotations fit within their source outer circle at every phase.
 box.expandByScalar(.08);d.cameraFitBounds=box;markShadows(root);
 // p101: 195's short shaft stubs cast a claw-shaped crescent across the hub
 // face in the default light; they still receive shadow.
 if(id===195)for(const side of ['upper','lower']){const shaft=b[side+'WheelShaft'];shaft.traverse(o=>{if(o.isMesh){o.userData.noShadow=true;o.castShadow=false;o.receiveShadow=true;}});}
 return new THREE.Vector3(.15,.12,18);
}
