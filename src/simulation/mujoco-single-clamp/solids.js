import * as THREE from 'three';
import {singleClampProfile,singleClampSource as source} from './profile.js';
import {makeSingleClampUpdater} from './update-solids.js';
import {plate,poly,circle,capsule,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {disposeObject3D} from '../dispose-model.js';
export function makeSingleClampSolids(){
 const root=new THREE.Group(),parts={},families={},bodies={},p=singleClampProfile();
 for(const name of ['fixed','jaw','board']){const body=new THREE.Group();body.name='body:'+name;root.add(body);bodies[name]=body;}
 const add=(name,geometry,color,family)=>{const mesh=new THREE.Mesh(geometry,matte(color));mesh.name=name;mesh.material.fog=false;parts[name]=mesh;families[name]=family;bodies[family].add(mesh);return mesh;};
 const round=(r,center=[0,0])=>poly(circle(center,r,128));
 bodies.jaw.position.set(...p.pivot,.08);
 add('jaw',plate(clip.difference(poly(p.points.map(v=>v.toArray())),round(.13)),-.12,.12),PALETTE.driven,'jaw');
 const screwCenters=[[192,180],[192,450]],holes=screwCenters.map(c=>round(.075,source(...c)));
 add('fixed-side',plate(clip.difference(poly(p.fixedSide.map(c=>source(...c))),...holes),.23,.65),PALETTE.muted,'fixed');
 add('board',plate(poly(p.board.map(c=>source(...c))),-.04,.28),PALETTE.driver,'board');
 for(const [name,center,radius,shaftRadius,bottom,top,angle]of [
  ['pivot',p.pivot,.348,.125,-.25,.25,Math.PI/2],
  ...screwCenters.map((c,i)=>['fixed'+i,source(...c),.18,.07,-.25,.69,1.08])]){
  const place=(part,geometry)=>{const mesh=add(name+'-'+part,geometry,PALETTE.ink,'fixed');mesh.position.set(...center,0);return mesh;};
  place('shaft',plate(round(shaftRadius),bottom,top+.025));
  place('washer',plate(clip.difference(round(radius*.8),round(shaftRadius+.003)),top-.04,top-.02));
  place('head-base',plate(round(radius),top-.02,top+.055));
  const slot=capsule([-radius*1.1,0],[radius*1.1,0],.024).map(p=>p.map(r=>r.map(([x,y])=>[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle)])));
  place('head-cap',plate(clip.difference(round(radius),slot),top+.055,top+.08));
 }
 const back=add('pivot-back-washer',plate(clip.difference(round(.20),round(.128)),-.065,-.045),PALETTE.ink,'fixed');back.position.set(...p.pivot,0);
 const update=makeSingleClampUpdater(root);
 Object.assign(root.userData,{parts,families,hideGround:true,materialsIgnoreSceneFog:true,cameraFov:8});markShadows(root);
 return {root,parts,families,update,dispose:()=>disposeObject3D(root)};
}
