import * as THREE from 'three';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
import {matte,PALETTE,markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';
import {makeSilkTraverseGears} from './silk-traverse-gears.js';
import {silkTraverseGeometry as k,silkTraverseAtTime} from './silk-traverse-kinematics.js';

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
 const dashed=[];for(let i=0;i<80;i++)for(const t of [0,.55]){const a=(i+t)*2*Math.PI/80;dashed.push(1.58*Math.cos(a),1.58*Math.sin(a),-.098);}
 const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.Float32BufferAttribute(dashed,3));carrier.add(new THREE.LineSegments(lineGeometry,new THREE.LineBasicMaterial({color:PALETTE.ink,fog:false})));
 for(const [name,geometry,parent,phase,color]of [['sun-gear',gears.sun,root,gears.sunPhase,PALETTE.ink],['planet-gear',gears.planet,planet,gears.planetPhase,PALETTE.driven]]){
  const mesh=new THREE.Mesh(geometry,matte(color));mesh.name=name;mesh.rotation.z=phase;parent.add(mesh);parts[name]=mesh;
 }
 pin(root,'fixed-stud',[0,0],-.45,.08,.078);
 add(root,'visible-stud-cap',circleAt([0,0],.24),.08,.17,PALETTE.frame);
 pin(root,'fixed-sun-collar',[0,0],.06,.08,.16);
 add(root,'rear-bearing',bore(circleAt([0,0],.16),[[0,0]],.079),-.45,-.30,PALETTE.frame);
 add(root,'rear-post',rect(-.09,-5.96,.09,-.12),-.42,-.32,PALETTE.frame);
 pin(carrier,'planet-axle',k.orbit,-.18,.285,.078);
 const hex=poly(circle(k.orbit,.115,6));add(carrier,'planet-axle-nut',hex,.285,.325,PALETTE.ink);
 const crank=clip.union(capsule([0,0],k.crank,.17,32),rect(-.17,-.20,.19,.23),circleAt(k.crank,.18));
 add(planet,'bolted-crank',bore(crank,[[0,0]],.081),.19,.27,PALETTE.accent);
 add(planet,'crank-hub',bore(circleAt([0,0],.12),[[0,0]],.081),.06,.19,PALETTE.driven);
 pin(planet,'crank-fastener',[.01,-.42],.04,.28,.035);
 add(planet,'square-bolt-head',rect(-.055,-.485,.075,-.355),.28,.315,PALETTE.ink);
 pin(planet,'wrist-pin',k.crank,.185,.575,.07);
 const rodShape=clip.union(capsule([0,0],[k.rodLength,0],.08,32),circleAt([0,0],.18),circleAt([k.rodLength,0],.10));
 add(rod,'connecting-rod',bore(rodShape,[[0,0],[k.rodLength,0]],.071),.49,.55,PALETTE.driven);
 let minimum=Infinity,maximum=-Infinity;for(let i=0;i<=3000;i++){const s=silkTraverseAtTime(k.period*i/3000);minimum=Math.min(minimum,s.slider[1]);maximum=Math.max(maximum,s.slider[1]);}
 const railBottom=minimum-.25,railTop=maximum+.25;
 add(root,'output-guide-rail',rect(-.38,railBottom,-.30,railTop),.70,.82,PALETTE.frame);
 add(root,'guide-support-post',rect(-.64,-5.96,-.56,railTop+.08),.65,.83,PALETTE.frame);
 add(root,'guide-upper-bridge',rect(-.64,railTop,-.30,railTop+.08),.65,.83,PALETTE.frame);
 add(root,'guide-lower-bridge',rect(-.64,-5.96,-.30,railBottom+.03),.65,.83,PALETTE.frame);
 const shoe=new THREE.Mesh(plate(clip.difference(rect(-.41,.67,-.27,.85),rect(-.381,.699,-.299,.821)),0,.26),matte(PALETTE.driven));shoe.rotation.x=Math.PI/2;shoe.position.y=.13;shoe.name='bored-slider-shoe';slider.add(shoe);parts[shoe.name]=shoe;
 // The plate shows only a short stub below the crank; the guide bar is
 // kept to a short lug ending in the thread eye rather than a long arm.
 add(slider,'traversing-guide-bar',clip.difference(clip.union(rect(-.27,-.06,.30,.06),circleAt([0,0],.10),circleAt([.30,0],.09)),circleAt([.30,0],.04)),.73,.79,PALETTE.driven);
 pin(slider,'slider-joint-pin',[0,0],.485,.86,.07);
 add(root,'base',rect(-2.05,-6.08,2.05,-5.96),-.45,.90,PALETTE.frame);
 const update=time=>{const s=silkTraverseAtTime(time);carrier.rotation.z=s.angle;planet.rotation.z=k.ratio*s.angle;rod.position.set(...s.wrist,0);rod.rotation.z=s.rodAngle;slider.position.set(...s.slider,0);root.updateMatrixWorld(true);root.userData.state=s;};
 update(0);markShadows(root);root.traverse(o=>{if(o.material)o.material.fog=false;});
 Object.assign(root.userData,{parts,blocks,guide:{minimum,maximum,railBottom,railTop},assumptions:'The engraving truncates the rod. Its 370-pixel length, vertical output guide, supports and all axial depths are reconstructed.'});
 return {root,update,dispose:()=>disposeObject3D(root)};
}
