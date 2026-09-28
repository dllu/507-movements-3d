import * as THREE from 'three';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
import {matte,PALETTE,markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';
import {makeSilkTraverseGears} from './silk-traverse-gears.js';
import {silkTraverseGeometry as k,silkTraverseAtTime} from './silk-traverse-kinematics.js';

// The rod's straight run past its ideal lower joint: long enough that its
// clean end stays below the default view even at the joint's highest point
// (y -1.92 against the plate edge at -3.2).
const ROD_RUN_ON=1.5;

export function makeSilkTraverseGeometry(){
 const gears=makeSilkTraverseGears(),root=new THREE.Group(),parts={},blocks={};
 const group=(name,parent=root)=>{const g=new THREE.Group();g.name='body:'+name;parent.add(g);blocks[name]=g;return g;};
 const rect=(a,b,c,d)=>poly([[a,b],[c,b],[c,d],[a,d]]);
 const circleAt=(p,r)=>poly(circle(p,r,64));
 const bore=(p,holes,r)=>clip.difference(p,...holes.map(p=>circleAt(p,r)));
 const add=(parent,name,p,z1,z2,color)=>{const m=new THREE.Mesh(plate(p,z1,z2),matte(color));m.name=name;parent.add(m);parts[name]=m;return m;};
 const pin=(parent,name,p,z1,z2,r)=>add(parent,name,circleAt(p,r),z1,z2,PALETTE.ink);
 const carrier=group('carrier'),planet=group('planet',carrier),rod=group('rod'),slider=group('slider');planet.position.set(...k.orbit,0);
 add(carrier,'carrier-disk',bore(circleAt([0,0],1.78),[[0,0]],.081),-.18,-.10,PALETTE.driver);
 add(carrier,'carrier-bearing',bore(circleAt([0,0],.18),[[0,0]],.081),-.28,-.18,PALETTE.driver);
 for(const [name,geometry,parent,phase,color]of [['sun-gear',gears.sun,root,gears.sunPhase,PALETTE.ink],['planet-gear',gears.planet,planet,gears.planetPhase,PALETTE.driven]]){
  const mesh=new THREE.Mesh(geometry,matte(color));mesh.name=name;mesh.rotation.z=phase;parent.add(mesh);parts[name]=mesh;
 }
 pin(root,'fixed-stud',[0,0],-.45,.08,.078);
 add(root,'visible-stud-cap',circleAt([0,0],.24),.08,.17,PALETTE.frame);
 pin(root,'fixed-sun-collar',[0,0],.06,.08,.16);
 // The axle stands 0.01 proud of the disk's back face (it was flush and z-fought).
 pin(carrier,'planet-axle',k.orbit,-.19,.285,.078);
 const hex=poly(circle(k.orbit,.115,6));add(carrier,'planet-axle-nut',hex,.285,.325,PALETTE.ink);
 const crank=clip.union(capsule([0,0],k.crank,.17,32),rect(-.17,-.20,.19,.23),circleAt(k.crank,.18));
 add(planet,'bolted-crank',bore(crank,[[0,0]],.081),.19,.27,PALETTE.accent);
 add(planet,'crank-hub',bore(circleAt([0,0],.12),[[0,0]],.081),.06,.19,PALETTE.driven);
 pin(planet,'crank-fastener',[.01,-.42],.04,.28,.035);
 add(planet,'square-bolt-head',rect(-.055,-.485,.075,-.355),.28,.315,PALETTE.ink);
 pin(planet,'wrist-pin',k.crank,.185,.575,.07);
 // Brown breaks the rod off below the crank eye; the traverse guide-bar the
 // caption names is not drawn. The whole rod runs on straight past the rod's
 // ideally guided lower joint (on the vertical line x=0, k.rodLength from the
 // wrist) and past the default view at every phase, ending cleanly in a
 // plain rounded end (p62). No guide rail, stand, bridges, rear post, rear
 // bearing or slider shoe is drawn, so none is modelled; the fixed stud ends
 // as a plain stub behind the carrier. The empty slider body marks the
 // ideal joint for the kinematics.
 const rodEnd=k.rodLength+ROD_RUN_ON;
 const rodShape=clip.union(capsule([0,0],[rodEnd,0],.08,32),circleAt([0,0],.18));
 add(rod,'connecting-rod',bore(rodShape,[[0,0]],.071),.49,.55,PALETTE.driven);
 let minimum=Infinity,maximum=-Infinity;for(let i=0;i<=3000;i++){const s=silkTraverseAtTime(k.period*i/3000);minimum=Math.min(minimum,s.slider[1]);maximum=Math.max(maximum,s.slider[1]);}
 const update=time=>{const s=silkTraverseAtTime(time);carrier.rotation.z=s.angle;planet.rotation.z=k.ratio*s.angle;rod.position.set(...s.wrist,0);rod.rotation.z=s.rodAngle;slider.position.set(...s.slider,0);root.updateMatrixWorld(true);root.userData.state=s;};
 update(0);markShadows(root);root.traverse(o=>{if(o.material)o.material.fog=false;});
 Object.assign(root.userData,{parts,blocks,guide:{minimum,maximum},assumptions:'The engraving truncates the rod. Its 370-pixel working length to an ideally guided vertical output joint and all axial depths are reconstructed; the rod runs on straight past that joint and ends cleanly. No guide, stand or supports are drawn or modelled.'});
 return {root,update,dispose:()=>disposeObject3D(root)};
}
