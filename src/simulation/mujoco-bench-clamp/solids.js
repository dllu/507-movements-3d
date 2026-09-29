import * as THREE from 'three';
import {benchClampProfile} from './profile.js';
import {plate,poly,circle,capsule,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {disposeObject3D} from '../dispose-model.js';
import {makeBenchClampUpdater} from './update-solids.js';

export function makeBenchClampSolids(){
 const root=new THREE.Group(),parts={},families={},bodies={};
 for(const name of ['fixed','jaw0','jaw1','board']){const body=new THREE.Group();body.name='body:'+name;root.add(body);bodies[name]=body;}
 const add=(name,geometry,color,family)=>{const mesh=new THREE.Mesh(geometry,matte(color));mesh.name=name;mesh.material.fog=false;parts[name]=mesh;families[name]=family;bodies[family].add(mesh);return mesh;};
 const round=r=>poly(circle([0,0],r,128));
 const source=(x,y)=>[(x-123)*.012,(264-y)*.012];
 // Pass 104: the planks abut (0.012 slits showed the background from
 // behind); each seam is a shallow V-groove chamfered into the two top edges
 // that meet there. Section in (x, z), extruded along y over the bench.
 const chamfer=.012,top=-.31,bottom=-.49,[,yTop]=source(0,79),[,yBottom]=source(0,444);
 for(const [i,a,b]of [[0,16,228],[1,228,331],[2,331,500]]){
  const [x0]=source(a,0),[x1]=source(b,0),l=i?chamfer:0,r=i<2?chamfer:0;
  const section=[[x0,bottom],[x1,bottom],[x1,top-r],[x1-r,top],[x0+l,top],[x0,top-l]].filter((q,k,all)=>!k||q[0]!==all[k-1][0]||q[1]!==all[k-1][1]);
  add('bench'+i,plate(poly(section),-yTop,-yBottom).rotateX(Math.PI/2),PALETTE.frame,'fixed');
 }
 for(let side=0;side<2;side++){
  const p=benchClampProfile(side),z=side===0?.12:-.12;
  bodies['jaw'+side].position.set(...p.pivot,z);
  // Pass 104: the rear (lower) jaw is ochre, so the crossed tails do not
  // read as one blue X; Brown dots its tail behind the upper one.
  add('jaw'+side,plate(clip.difference(poly(p.points.map(p=>p.toArray())),round(.13)),-.08,.08),side===0?PALETTE.driven:PALETTE.accent,'jaw'+side);
  const place=(name,geometry)=>{const mesh=add(name+side,geometry,PALETTE.ink,'fixed');mesh.position.set(...p.pivot,0);return mesh;};
  place('shaft',plate(round(.125),-.35,z+.145));
  place('sleeve',plate(clip.difference(round(.155),round(.128)),-.31,z-.105));
  place('washer',plate(clip.difference(round(.19),round(.128)),z-.105,z-.085));
  place('headBase',plate(round(.345),z+.095,z+.17));
  const slot=capsule([-.40,0],[.40,0],.024);const slotAngle=side===0?.46:-.43;
  const slotRotated=slot.map(p=>p.map(r=>r.map(([x,y])=>[x*Math.cos(slotAngle)-y*Math.sin(slotAngle),x*Math.sin(slotAngle)+y*Math.cos(slotAngle)])));
  place('headCap',plate(clip.difference(round(.345),slotRotated),z+.17,z+.195));
 }
 const board=add('board',new THREE.BoxGeometry(4.764,.72,.6),PALETTE.driver,'board');board.position.x=2.382;
 const update=makeBenchClampUpdater(root);
 Object.assign(root.userData,{parts,families,hideGround:true,materialsIgnoreSceneFog:true,cameraFov:8});markShadows(root);
 return {root,parts,families,update,dispose:()=>disposeObject3D(root)};
}
