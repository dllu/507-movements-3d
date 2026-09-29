import * as THREE from 'three';
import {plate,poly,circle,ring,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {disposeObject3D} from '../dispose-model.js';
import {sourceLeaf} from './source.js';
import {ReturnBandRoute} from './band-route.js';
import {makeSpringTreadleUpdater,TREADLE_CORD_LOOP} from './update-solids.js';
import {replaceWithLaidRope} from '../laid-rope.js';

// Visible reconstruction candidate. Native dynamics are supplied by the caller;
// no simulation or motion clock is hidden in this geometry factory.
export function makeSpringTreadleSolids({segments=32,tailSegments=6}={}){
 const root=new THREE.Group(),parts={},families={},blocks={},materials=new Map(),leaf=sourceLeaf({segments,tailSegments}),pivot=[-2.862,-2.898],scale=.018;
 for(const name of ['fixed','treadle','pulley','spring']){blocks[name]=new THREE.Group();blocks[name].name="body:"+name;root.add(blocks[name]);}
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
 // p109: the cord now ends in the treadle's own plane (z 0), so the pulley
 // sits 0.26 further back: its groove spans the cord's helix from the
 // spring end (z 0.24) down to the treadle eye (z 0).
 add('pulleyCore',ring(.144,.726,-.03,.27,128),'pulley',PALETTE.brass);
 add('pulleyRearFlange',ring(.144,.774,-.09,-.03,128),'pulley',PALETTE.brass);
 add('pulleyFrontFlange',ring(.144,.774,.27,.33,128),'pulley',PALETTE.brass);
 // Brown draws the pulley on its axle with no hanger: the fixed axle ends as
 // a plain stub behind the pulley (p62; no bearing, pad or post).
 add('pulleyAxle',disk(.14,-.15,.38,96),'fixed',PALETTE.ink);
 add('pulleyRetainer',ring(.14,.20,.334,.38,96),'fixed',PALETTE.ink);
 add('floor',plate(imagePoly([[16,459],[466,459],[466,465],[16,465]]),-.62,.40),'fixed',PALETTE.frame);
 // Brown crops the bow's fixed end and draws no hanger for the pulley. The
 // bow simply ends at his cut: no end block, clamp or floor posts are
 // modelled (p62/p63); its fixed end is the cantilever root off the plate.
 // Rounded fastening heads contain only the terminal cord material. Their
 // hidden shoulders/stems and the separated endpoint depths are inferred.
 const anchor=(name,family,point,low,high)=>{
  const stem=add(name+'Stem',disk(.065,low,high-.04,48),family,PALETTE.ink,point);
  const head=add(name+'Head',new THREE.SphereGeometry(.08,24,16),family,PALETTE.ink,point);head.position.z=high;
  return{stem,head};
 };
 const upperAnchor=anchor('springAnchor','spring',[.774,2.664],.03,.24);
 // p109: no peg at the treadle. The cord ends in a small laid-rope loop in
 // the eye's mid-plane, threaded through the eye and round its crown (as
 // 154's cord through its lever's eye); the cord's end is buried in the
 // loop's top.
 {const {crown,radius,rope}=TREADLE_CORD_LOOP,center=new THREE.Vector3(eye[0],eye[1]+crown,0),temp=new THREE.Mesh();
  replaceWithLaidRope(temp,Array.from({length:48},(_,i)=>{const a=2*Math.PI*i/48;return center.clone().add(new THREE.Vector3(0,radius*Math.cos(a),radius*Math.sin(a)));}),{closed:true,radius:rope,tubularSegments:96});
  const loop=new THREE.BufferGeometry();for(const [k,v] of Object.entries(temp.geometry.attributes))loop.setAttribute(k,v.clone());loop.setIndex(temp.geometry.index.clone());temp.geometry.dispose();
  add('treadleCordLoop',loop,'treadle',PALETTE.belt);}
 const n=leaf.points.length,positions=new Float32Array(n*12),indices=[];
 for(let i=0;i<n-1;i++){const a=4*i,b=a+4;indices.push(a,b,a+1,a+1,b,b+1,a+2,a+3,b+2,a+3,b+3,b+2,a,a+2,b,a+2,b+2,b,a+1,b+1,a+3,a+3,b+1,b+3);}
 indices.push(0,1,2,1,3,2,4*n-4,4*n-2,4*n-3,4*n-3,4*n-2,4*n-1);
 for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 const springGeometry=new THREE.BufferGeometry();springGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));springGeometry.setIndex(indices);
 const spring=add('leaf',springGeometry,'spring',PALETTE.driver);spring.material=spring.material.clone();spring.material.flatShading=true;
 const widths=leaf.points.map(p=>{const x=319+p.x/scale;return (x<120?25.5:x<280?25.5-(x-120)*5.5/160:20-(x-280)*5.5/135)*scale;});
 const band=add('band',new THREE.BufferGeometry(),'fixed',PALETTE.ink);
 const update=makeSpringTreadleUpdater(root,{widths,pivot});

 Object.assign(root.userData,{parts,families,blocks,leafWidths:widths,hideGround:true,sourceScale:scale,reconstructionNote:'Unregistered source-shaped candidate. Pedestal and solid pulley follow the engraving; depth and cord fastenings are inferred; the bow ends at the plate cut; the pulley axle is a plain stub. Native effective masses and flexural properties are not inferred from the stylized visible strip thickness.'});
 const route=new ReturnBandRoute([.774,2.664],[.738,-2.322]);update({treadle:0,rotorPhase:route.rotorPhase,upper:[.774,2.664,0],lower:[.738,-2.322,0],leafPoints:leaf.points.map(p=>p.toArray())});markShadows(root);
 return{root,update,dispose:()=>disposeObject3D(root)};
}
