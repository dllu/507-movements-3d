import * as THREE from 'three';
import {plate,poly,circle,ring,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {disposeObject3D} from '../dispose-model.js';
import {sourceLeaf} from './source.js';
import {ReturnBandRoute} from './band-route.js';
import {makeCurveTubeBuffer} from '../curve-tube-buffer.js';
import {AxiallySeparatedBand} from '../axially-separated-band.js';

// Visible reconstruction candidate. Native dynamics are supplied by the caller;
// no simulation or motion clock is hidden in this geometry factory.
export function makeSpringTreadleSolids({segments=32,tailSegments=6}={}){
 const root=new THREE.Group(),parts={},families={},blocks={},materials=new Map(),leaf=sourceLeaf({segments,tailSegments}),pivot=[-2.862,-2.898],scale=.018;
 for(const name of ['fixed','treadle','pulley','spring']){blocks[name]=new THREE.Group();root.add(blocks[name]);}
 const material=color=>{if(!materials.has(color)){const m=matte(color,{roughness:.65,metalness:.12});m.fog=false;materials.set(color,m);}return materials.get(color);};
 const add=(name,geometry,family,color,point=[0,0])=>{const mesh=new THREE.Mesh(geometry,material(color));mesh.name=name;mesh.position.set(...point,0);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 const pixel=([x,y])=>[(x-319)*scale,(252-y)*scale],imagePoly=p=>poly(p.map(pixel));
 const local=p=>pixel(p).map((x,i)=>x-pivot[i]);
 const beam=poly([[177,406],[452,369],[453,379],[179,416]].map(local));
 const eye=local([360,381]),eyeCircle=poly(circle(eye,.36,96)),eyeTop=clip.intersection(eyeCircle,poly([[eye[0]-.4,eye[1]-.12],[eye[0]+.4,eye[1]-.12],[eye[0]+.4,eye[1]+.4],[eye[0]-.4,eye[1]+.4]]));
 const treadle=clip.difference(clip.union(beam,poly(circle([0,0],.396,96)),eyeTop),poly(circle([0,0],.166,96)),clip.intersection(poly(circle(eye,.245,96)),poly([[eye[0]-.3,eye[1]+.02],[eye[0]+.3,eye[1]+.02],[eye[0]+.3,eye[1]+.3],[eye[0]-.3,eye[1]+.3]])));
 add('treadle',plate(treadle,-.10,.10),'treadle',PALETTE.driven);
 const stand=new THREE.Shape();stand.moveTo(119,448);stand.bezierCurveTo(138,438,138,425,138,413);stand.bezierCurveTo(138,383,183,383,183,413);stand.bezierCurveTo(182,430,190,441,202,448);stand.lineTo(202,459);stand.lineTo(119,459);stand.closePath();
 add('pedestal',plate(clip.difference(imagePoly(stand.getPoints(96).map(p=>p.toArray())),poly(circle(pivot,.166,96))),-.55,-.17),'fixed',PALETTE.frame);
 add('pivotAxle',disk(.16,-.60,.20,96),'fixed',PALETTE.ink,pivot);
 add('pivotRetainer',ring(.16,.22,.104,.18,96),'fixed',PALETTE.ink,pivot);
 add('pulleyCore',ring(.144,.726,.23,.72,128),'pulley',PALETTE.brass);
 add('pulleyRearFlange',ring(.144,.774,.17,.23,128),'pulley',PALETTE.brass);
 add('pulleyFrontFlange',ring(.144,.774,.72,.78,128),'pulley',PALETTE.brass);
 add('pulleyAxle',disk(.14,-.60,.84,96),'fixed',PALETTE.ink);
 add('pulleyBearing',ring(.144,.25,-.48,.164,96),'fixed',PALETTE.frame);
 add('pulleyRetainer',ring(.14,.20,.784,.83,96),'fixed',PALETTE.ink);
 add('pulleyMount',plate(poly([[-.32,-.38],[.32,-.38],[.32,.38],[-.32,.38]]),-.60,-.48),'fixed',PALETTE.frame);
 add('floor',plate(imagePoly([[16,459],[466,459],[466,465],[16,465]]),-.62,.84),'fixed',PALETTE.frame);
 add('springClamp',plate(imagePoly([[26,181],[35,174],[48,194],[39,202]]),-.55,.08),'fixed',PALETTE.frame);
 // Rounded fastening heads contain only the terminal cord material. Their
 // hidden shoulders/stems and the separated endpoint depths are inferred.
 const anchor=(name,family,point,low,high)=>{
  const stem=add(name+'Stem',disk(.065,low,high-.04,48),family,PALETTE.ink,point);
  const head=add(name+'Head',new THREE.SphereGeometry(.08,24,16),family,PALETTE.ink,point);head.position.z=high;
  return{stem,head};
 };
 const upperAnchor=anchor('springAnchor','spring',[.774,2.664],.03,.24),lowerAnchor=anchor('treadleAnchor','treadle',eye,.10,.72);
 const n=leaf.points.length,positions=new Float32Array(n*12),indices=[];
 for(let i=0;i<n-1;i++){const a=4*i,b=a+4;indices.push(a,b,a+1,a+1,b,b+1,a+2,a+3,b+2,a+3,b+3,b+2,a,a+2,b,a+2,b+2,b,a+1,b+1,a+3,a+3,b+1,b+3);}
 indices.push(0,1,2,1,3,2,4*n-4,4*n-2,4*n-3,4*n-3,4*n-2,4*n-1);
 for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 const springGeometry=new THREE.BufferGeometry();springGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));springGeometry.setIndex(indices);
 const spring=add('leaf',springGeometry,'spring',PALETTE.driver);spring.material=spring.material.clone();spring.material.flatShading=true;
 const widths=leaf.points.map(p=>{const x=319+p.x/scale;return (x<120?25.5:x<280?25.5-(x-120)*5.5/160:20-(x-280)*5.5/135)*scale;});
 const tube=makeCurveTubeBuffer();
 const band=add('band',tube.geometry,'fixed',PALETTE.ink);
 const update=s=>{
  if(s.leafPoints.length!==n)throw new RangeError('Spring state resolution differs from visible geometry');
  blocks.treadle.position.set(...pivot,0);blocks.treadle.rotation.z=s.treadle;
  blocks.pulley.rotation.z=s.rotorPhase;
  for(const m of [upperAnchor.stem,upperAnchor.head]){m.position.x=s.upper[0];m.position.y=s.upper[1];}
  for(let i=0;i<n;i++){
   const before=s.leafPoints[Math.max(0,i-1)],after=s.leafPoints[Math.min(n-1,i+1)],dx=after[0]-before[0],dy=after[1]-before[1],l=Math.hypot(dx,dy),nx=-dy/l,ny=dx/l,p=s.leafPoints[i],h=widths[i]/2;
   positions.set([p[0]+nx*h,p[1]+ny*h,.03,p[0]-nx*h,p[1]-ny*h,.03,p[0]+nx*h,p[1]+ny*h,-.15,p[0]-nx*h,p[1]-ny*h,-.15],i*12);
  }
  springGeometry.attributes.position.needsUpdate=true;springGeometry.computeVertexNormals();springGeometry.computeBoundingBox();springGeometry.computeBoundingSphere();
  const curve=new AxiallySeparatedBand(new ReturnBandRoute(s.upper,s.lower),{startZ:.24,endZ:.72});tube.update(curve);
  root.userData.state=s;root.userData.bandCurve=curve;root.updateMatrixWorld(true);
 };
 Object.assign(root.userData,{parts,families,blocks,hideGround:true,sourceScale:scale,reconstructionNote:'Unregistered source-shaped candidate. Pedestal and solid pulley follow the engraving; depth, rear mounts, bearings and cord fastenings are inferred. Native effective masses and flexural properties are not inferred from the stylized visible strip thickness.'});
 const route=new ReturnBandRoute([.774,2.664],[.738,-2.322]);update({treadle:0,rotorPhase:route.rotorPhase,upper:[.774,2.664,0],lower:[.738,-2.322,0],leafPoints:leaf.points.map(p=>p.toArray())});markShadows(root);
 return{root,update,dispose:()=>disposeObject3D(root)};
}
