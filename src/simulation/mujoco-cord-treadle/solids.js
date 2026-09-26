import * as THREE from 'three';
import {plate,poly,circle,ring,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {disposeObject3D} from '../dispose-model.js';
import {cordTreadleSource as source,cordTreadleParameters} from '../cord-treadle-motion.js';
// Source-shaped rigid core and inferred cord anchor studs. Full cord contact
// validation remains outstanding; this factory is not registered in the app.
export function makeCordTreadleSolids(){
 const root=new THREE.Group(),g=cordTreadleParameters(),blocks={},parts={},families={},materials=new Map();
 for(const name of ['disk','treadle','pulley','fixed']){blocks[name]=new THREE.Group();root.add(blocks[name]);}
 const add=(name,geometry,family,color,point=[0,0])=>{if(!materials.has(color)){const m=matte(color,{metalness:.15,roughness:.6});m.fog=false;materials.set(color,m);}const mesh=new THREE.Mesh(geometry,materials.get(color));mesh.name=name;mesh.position.set(...point,0);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 const pixel=p=>[(p[0]-source.diskCenter[0])*source.scale,(source.diskCenter[1]-p[1])*source.scale];
 const imagePoly=points=>poly(points.map(pixel));
 const fromShape=s=>imagePoly(s.getPoints(48).map(p=>[p.x,p.y]));
 add('disk',ring(.144,source.diskRadius*source.scale,-.47,-.13,128),'disk',PALETTE.driver);
 add('diskHub',ring(.144,.22,-.13,-.02,128),'disk',PALETTE.ink);
 add('diskAxle',disk(.14,-.95,.02,128),'fixed',PALETTE.ink);
 add('diskBearing',ring(.144,.26,-.55,-.49,128),'fixed',PALETTE.frame);
 const stand=new THREE.Shape();stand.moveTo(45,444);stand.bezierCurveTo(76,438,84,426,84,399);stand.lineTo(84,266);stand.bezierCurveTo(84,227,143,227,143,266);stand.lineTo(145,416);stand.bezierCurveTo(148,436,157,443,174,444);stand.lineTo(174,457);stand.lineTo(45,457);stand.closePath();
 add('diskStand',plate(clip.difference(fromShape(stand),poly(circle([0,0],.144,128))),-.95,-.55),'fixed',PALETTE.frame);
 // Lower attachment eye measured independently from the cord's upper endpoint.
 // Its hidden neck and union with the treadle are reconstruction assumptions.
 const eyeImage=[322,408],eyeDelta=pixel(eyeImage).map((v,i)=>v-g.pivot[i]),cs=Math.cos(g.initialTreadle),sn=Math.sin(g.initialTreadle);
 const lowerEye=[eyeDelta[0]*cs+eyeDelta[1]*sn,-eyeDelta[0]*sn+eyeDelta[1]*cs],eyeOuter=13*source.scale,eyeInner=7*source.scale;
 const eyeNeck=poly([[lowerEye[0]-.065,-.07],[lowerEye[0]+.065,-.07],[lowerEye[0]+.065,lowerEye[1]+eyeOuter*.65],[lowerEye[0]-.065,lowerEye[1]+eyeOuter*.65]]);
 const treadle=clip.difference(clip.union(poly([[-g.footLength,-.085],[0,-.085],[0,.085],[-g.footLength,.085]]),poly(circle([0,0],.25,128)),poly(circle(lowerEye,eyeOuter,128)),eyeNeck),poly(circle([0,0],.184,128)),poly(circle(lowerEye,eyeInner,128)));
 add('treadle',plate(treadle,.05,.29),'treadle',PALETTE.driven);
 const support=new THREE.Shape();support.moveTo(403,444);support.bezierCurveTo(432,430,433,389,434,354);support.bezierCurveTo(434,322,477,322,479,352);support.bezierCurveTo(480,391,484,421,508,444);support.lineTo(508,457);support.lineTo(403,457);support.closePath();
 const bearing=clip.difference(fromShape(support),poly(circle(g.pivot,.184,128)));
 add('treadleFrontBearing',plate(bearing,.34,.48),'fixed',PALETTE.frame);
 add('treadleRearBearing',plate(bearing,-.95,-.55),'fixed',PALETTE.frame);
 add('treadleBase',plate(imagePoly([[403,444],[508,444],[508,457],[403,457]]),-.55,.34),'fixed',PALETTE.frame);
 add('treadleAxle',disk(.18,-.95,.54,128),'fixed',PALETTE.ink,g.pivot);
 add('treadleRetainer',ring(.18,.24,.484,.53,128),'fixed',PALETTE.ink,g.pivot);
 add('pulleyCore',ring(.144,g.guideRadius-.045,.56,.72,128),'pulley',PALETTE.brass);
 add('pulleyRearFlange',ring(.144,g.guideRadius,.50,.56,128),'pulley',PALETTE.brass);
 add('pulleyFrontFlange',ring(.144,g.guideRadius,.72,.78,128),'pulley',PALETTE.brass);
 // Brown draws the guide pulley on its axle with no hanger. The fixed axle
 // ends as a plain stub behind the pulley (p62): the undrawn rear bearing,
 // mounting pad and floor post are not modelled.
 add('pulleyAxle',disk(.14,.30,.84,128),'fixed',PALETTE.ink,g.guide);
 add('pulleyRetainer',ring(.14,.22,.784,.83,128),'fixed',PALETTE.ink,g.guide);
 add('floor',plate(imagePoly([[22,457],[512,457],[512,464],[22,464]]),-1.15,.90),'fixed',PALETTE.frame);
 // The flexible cord is secured at the center of a rounded anchor head. The
 // short embedded cord end is an intended fastening, not a free sliding contact.
 // Closed lathe profiles avoid overlapping primitive volumes in mass integration.
 const anchor=base=>{
  const radius=.075,join=.64-Math.sqrt(radius**2-.055**2);
  const profile=[[0,base],[.055,base],[.055,.38],[.14,.38],[.14,.46],[.055,.46],[.055,join]];
  const start=Math.acos((join-.64)/radius);
  for(let i=1;i<=24;i++){const a=start*(1-i/24);profile.push([radius*Math.sin(a),.64+radius*Math.cos(a)]);}
  const geometry=new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),64);
  // LatheGeometry emits collapsed apex triangles; omit them so distance and
  // collision queries never encounter zero-area faces.
  const indices=[],positions=geometry.attributes.position,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<geometry.index.count;i+=3){const face=[0,1,2].map(j=>geometry.index.getX(i+j));a.fromBufferAttribute(positions,face[0]);b.fromBufferAttribute(positions,face[1]);c.fromBufferAttribute(positions,face[2]);if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-20)indices.push(...face);}
  geometry.setIndex(indices);geometry.rotateX(Math.PI/2);return geometry;
 };
 add('crankCordAnchor',anchor(-.13),'disk',PALETTE.ink,g.pin);
 add('treadleCordAnchor',anchor(.29),'treadle',PALETTE.ink,[-g.armLength,0]);
 const update=state=>{blocks.disk.rotation.z=state.disk;blocks.treadle.position.set(...g.pivot,0);blocks.treadle.rotation.z=state.treadle;blocks.pulley.position.set(...g.guide,0);blocks.pulley.rotation.z=state.pulley;root.updateMatrixWorld(true);};
 Object.assign(root.userData,{parts,families,blocks,geometry:g,source,lowerEye:{local:lowerEye,image:eyeImage,outerRadius:eyeOuter,innerRadius:eyeInner},hideGround:true,attachmentSites:{crank:[...g.pin,.64],treadle:[-g.armLength,0,.64]},reconstructionNote:'Unregistered rigid-core prototype. Pedestals follow the engraving; shaft depths, bearings, pulley groove and rear mounting pad are inferred. Lower treadle eye follows the engraving; its hidden neck and rigid attachment are inferred. Shouldered rounded cord-anchor studs are inferred; cord ends are secured inside the heads. Full rope/anchor clearance and attachment behavior remain unqualified.'});
 update({disk:0,treadle:g.initialTreadle,pulley:0});markShadows(root);return{root,update,dispose:()=>disposeObject3D(root)};
}
