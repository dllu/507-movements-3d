import * as THREE from 'three';
import face from '../data/face-worm-195.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {markShadows} from './primitives.js';
import {creaseIndexedNormals} from './crease-normals.js';

export function faceWorm195Geometry(){
 const {radialSteps:R,angularSteps:A,innerRadius,outerRadius,back,heights,teeth}=face;
 const positions=[],indices=[],S=A+1,N=(R+1)*S;
 for(let layer=0;layer<2;layer++)for(let r=0;r<=R;r++)for(let a=0;a<=A;a++){
  const radius=innerRadius+(outerRadius-innerRadius)*r/R,angle=(a/A-.5)*2*Math.PI/teeth;
  positions.push(radius*Math.cos(angle),radius*Math.sin(angle),layer?back:heights[r*S+a]);
 }
 const quad=(a,b,c,d)=>indices.push(a,b,c,a,c,d);
 for(let r=0;r<R;r++)for(let a=0;a<A;a++){const k=r*S+a;quad(k,k+S,k+S+1,k+1);}
 for(let a=0;a<A;a++){quad(a+N,a+N+1,R*S+a+N+1,R*S+a+N);quad(a,a+1,a+1+N,a+N);const k=R*S+a;quad(k,k+N,k+1+N,k+1);}
 for(let r=0;r<R;r++){const k=r*S;quad(k,k+N,k+S+N,k+S);const j=k+A;quad(j,j+S,j+S+N,j+N);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);creaseIndexedNormals(g);g.userData={profile:'finite-worm-swept-face-sector',...face};return g;
}
function bored(mesh,radius,bore,length,replaced){
 replaced.add(mesh.geometry);
 mesh.geometry=boredLatheGeometry([{radial:radius,axial:-length/2},{radial:radius,axial:length/2}],bore,64);mesh.userData.boreRadius=bore;
}
function mark(mesh,z,replaced,length=.42){replaced.add(mesh.geometry);mesh.geometry=new THREE.BoxGeometry(length,.045,.003);mesh.position.z=z;}
export function correctFeedWormAssembly(root,id){
 const d=root.userData,b=d.blocks;
 const journals=[],replaced=new Set();
 if(id===195){
  for(const side of ['upper','lower']){
   const old=b[side+'WheelBody'],rotor=b[side+'WheelRotor'],sign=side==='upper'?1:-1;
   old.visible=false;for(const groove of b[side+'Grooves'])groove.visible=false;b[side+'VisibleRim'].visible=false;
   const geometry=faceWorm195Geometry();if(sign<0)geometry.rotateX(Math.PI);
   const body=new THREE.InstancedMesh(geometry,old.material,24),matrix=new THREE.Matrix4();
   for(let i=0;i<24;i++)body.setMatrixAt(i,matrix.makeRotationZ(i*Math.PI/12));
   body.userData.role=side+'-generated-face-worm-wheel';rotor.add(body);b[side+'GeneratedFace']=body;
   const center=new THREE.Mesh(boredLatheGeometry([{radial:face.innerRadius,axial:-.36},{radial:face.innerRadius,axial:0}],.074,64),old.material);
   const back=new THREE.Mesh(boredLatheGeometry([{radial:face.outerRadius,axial:-.364},{radial:face.outerRadius,axial:-.359}],.074,96),old.material);back.rotation.x=sign*Math.PI/2;rotor.add(back);b[side+'SmoothBack']=back;
   center.rotation.x=Math.PI/2;if(sign<0)center.rotation.x=-Math.PI/2;rotor.add(center);b[side+'BoredCenter']=center;
   // Brown draws the same hub on both wheels: a boss about a quarter of the
   // wheel's radius with an inner circle half that size. It is turned in the
   // wheel's own metal as a boss with a short raised collar on each face.
   {const hub=b[side+'WheelHub'];replaced.add(hub.geometry);hub.material=old.material;
    hub.geometry=boredLatheGeometry([{radial:.16,axial:-.32},{radial:.16,axial:-.28},{radial:.32,axial:-.28},
     {radial:.32,axial:.28},{radial:.16,axial:.28},{radial:.16,axial:.32}],.074,96);hub.userData.boreRadius=.074;}
   back.userData.role=side+'-smooth-back-face';center.userData.role=side+'-bored-wheel-centre';
   journals.push({shaft:b[side+'WheelShaft'],part:b[side+'WheelHub'],radius:.073,bore:.074});
   mark(b[side+'Index'],side==='upper'?.0015:.3655,replaced);b[side+'WheelShaft'].scale.z=.4;b[side+'WheelShaft'].position.z=side==='upper'?-.18:.18;
  }
  for(const x of[b.frameFoot,b.framePost,b.lowerBearingArm,b.upperBearingArm,...b.wheelBearings,...b.wormBearings,...b.wormBearingPosts])x.visible=false;
  b.wormIndex.visible=false;
  d.reconstructionNote='Identical face-toothed wheels lie on opposite sides of one screw and turn at equal opposite 24:1 rates. The face teeth are reconstructed from the finite worm sweep. Dimensions, thread section and running clearances are inferred; motion is prescribed and loaded friction/backlash are not solved. Unpictured bearing frames are omitted.';
 }else{
  for(const side of ['left','right']){
   bored(b[side+'WheelHub'],.22,.093,.70,replaced);journals.push({shaft:b[side+'WheelShaft'],part:b[side+'WheelHub'],radius:.092,bore:.093});
   mark(b[side+'WheelIndex'],.1915,replaced,.36);b[side+'WheelShaft'].scale.z=.4;b[side+'WheelShaft'].position.z=0;
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
 return new THREE.Vector3(.15,.12,18);
}
