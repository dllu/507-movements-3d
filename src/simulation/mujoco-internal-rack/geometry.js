import * as THREE from 'three';
import {plate,poly,circle,capsule,polygonClipping as clip} from '../finite-plate-geometry.js';
import {matte,PALETTE,markShadows} from '../primitives.js';
import {internalRackPitchDimensions} from './profile.js';

// The swept opening contains thousands of almost-collinear cutter vertices.
// Match the native collision mesh's 0.015-pixel contour tolerance offline.
const simplify=(p,epsilon=.00015)=>{
 if(p.length<=2)return p;const a=p[0],b=p.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy;let maximum=0,index=0;
 for(let i=1;i<p.length-1;i++){const t=l?Math.max(0,Math.min(1,((p[i][0]-a[0])*dx+(p[i][1]-a[1])*dy)/l)):0;const d=Math.hypot(p[i][0]-a[0]-t*dx,p[i][1]-a[1]-t*dy);if(d>maximum){maximum=d;index=i;}}
 return maximum<=epsilon?[a,b]:[...simplify(p.slice(0,index+1),epsilon).slice(0,-1),...simplify(p.slice(index),epsilon)];
};
const reduced=p=>p.map(p=>p.map(r=>simplify([...r,r[0]])));
// Rim half-depth (the native collision cells span z +/-0.06) and the backing's rear face.
const RIM=.06,BACK0=-.075;
/** Source proportions with explicit, lightweight-sheet/weighted-coupler depths. */
export function makeInternalRackGeometry(profile){
 profile={...profile,body:reduced(profile.body),opening:reduced(profile.opening)};
 const root=new THREE.Group(),frame=new THREE.Group(),rack=new THREE.Group(),pinion=new THREE.Group();
 root.add(frame,pinion);frame.position.x=-.05;frame.add(rack);const d=internalRackPitchDimensions();rack.position.y=d.orbit;
 const blocks={pinion,frame,rack},parts={};
 const area=p=>p.reduce((sum,p)=>sum+p.reduce((sum,r,k)=>{let a=0;for(let i=0;i<r.length;i++){const b=r[(i+1)%r.length];a+=r[i][0]*b[1]-b[0]*r[i][1];}return sum+(k===0?1:-1)*Math.abs(a)/2;},0),0);
 const rect=(x1,y1,x2,y2)=>poly([[x1,y1],[x2,y1],[x2,y2],[x1,y2]]);
 const bore=(p,centres,r=.0268)=>clip.difference(p,...centres.map(c=>poly(circle(c,r,48))));
 const add=(parent,name,p,z1,z2,color)=>{const m=new THREE.Mesh(plate(p,z1,z2),matte(color));m.name=name;parent.add(m);parts[name]=m;return m;};
 const pin=(parent,name,p,z1,z2,r=.026)=>add(parent,name,poly(circle(p,r,48)),z1,z2,PALETTE.ink);
 const eyeLink=(a,b,width=.04)=>clip.union(capsule(a,b,width,32),poly(circle(a,.065,48)),poly(circle(b,.065,48)));
 const backing=clip.difference(rect(-1.39,-.55-d.orbit,1.46,.88-d.orbit),profile.opening);
 const rimMass=area(profile.body)*.01*.0006*7850,backingMass=area(backing)*.01*.00025*2700,rackMass=rimMass+backingMass;
 // The toothed rim is rendered at the native collision depth (+/-0.06), so
 // the 0.114 pinion meshes with solid teeth; the backing sheet sits behind it.
 // Panel masses above stay the lightweight feasibility assumptions.
 add(rack,'steel-tooth-rim',profile.body,-RIM,RIM,PALETTE.driven);
 add(rack,'rack-backing',backing,BACK0,-RIM,PALETTE.driven);
 const wheel=bore(poly(profile.pinion),[[0,0]],.108),pinionDepth=rackMass/(area(wheel)*.01*2700)/.1;
 add(pinion,'pinion-teeth',wheel,-pinionDepth/2,pinionDepth/2,PALETTE.driver);pin(pinion,'input-shaft',[0,0],-.24,pinionDepth/2+.025,.1075);
 const frameShape=clip.union(clip.difference(rect(-1.80,-1.31,1.90,1.40),rect(-1.39,-.91,1.46,.88)),rect(-2.40,-1.31,2.53,-.93));
 const frameDepth=2*rackMass/(area(frameShape)*.01*450)/.1;
 add(frame,'carriage',frameShape,.18,.18+frameDepth,PALETTE.frame);
 for(const [side,x,length]of [['left',-2.03,.50],['right',2.15,.54]]){
  const g=new THREE.CylinderGeometry(.12,.12,length,48);g.rotateZ(Math.PI/2);
  const m=new THREE.Mesh(g,matte(PALETTE.frame));m.position.set(x,0,.20);m.name=side+'-output-rod';frame.add(m);parts[m.name]=m;
 }
 const crankShape=bore(clip.union(eyeLink([0,0],[-.075,.58]),eyeLink([0,0],[.37,.24])),[[0,0],[-.075,.58],[.37,.24]]);
 const rodShape=bore(eyeLink([0,0],[.01,-.575]),[[0,0],[.01,-.575]]);
 const crankDepth=.4*rackMass/(2*area(crankShape)*.01*2700)/.1,rodDepth=.2*rackMass/(2*area(rodShape)*.01*2700)/.1;
 const couplerShape=bore(eyeLink([0,0],[2.54,0]),[[0,0],[2.54,0]]),couplerDepth=8*rackMass/(area(couplerShape)*.01*8500)/.1;
 for(const [side,x]of [['left',-1.60],['right',.94]]){
  const crank=new THREE.Group();crank.position.set(x,1.01,0);frame.add(crank);blocks[side+'Crank']=crank;
  add(crank,side+'-crank',crankShape,.25,.25+crankDepth,PALETTE.accent);
  pin(frame,side+'-frame-pivot',[x,1.01],.175,.25+crankDepth+.015);
  const rod=new THREE.Group();rod.position.set(.37,.24,0);crank.add(rod);blocks[side+'Rod']=rod;
  add(rod,side+'-rod',rodShape,.31,.31+rodDepth,PALETTE.accent);
  pin(crank,side+'-wrist',[.37,.24],.245,.31+rodDepth+.015);
  pin(crank,side+'-top-pin',[-.075,.58],.245,.31+couplerDepth+.015);
  const rx=x+.38,ry=.675-d.orbit;
  // The boss stands 0.003 behind the 0.0055 backing (at 0.006 it lay within depth tolerance and z-fought).
  add(rack,side+'-rack-boss',poly(circle([rx,ry],.065,48)),BACK0-.003,.015,PALETTE.ink);
  pin(rack,side+'-rack-pin',[rx,ry],BACK0-.0005,.31+rodDepth+.015);
 }
 const coupler=new THREE.Group();frame.add(coupler);blocks.coupler=coupler;
 add(coupler,'weighted-coupler',couplerShape,.31,.31+couplerDepth,PALETTE.brass);
 // Thin rack edges run in real U channels behind the wooden carriage.
 for(const [side,x,sign]of [['left',-1.39,-1],['right',1.46,1]]){
  add(frame,side+'-guide-web',rect(x+sign*.01,-.99,x+sign*.05,.96),BACK0-.0115,-RIM+.0095,PALETTE.frame);
  for(const [face,z1,z2]of [['rear',BACK0-.0115,BACK0-.0015],['front',-RIM+.0005,-RIM+.0095]])add(frame,side+'-guide-'+face,rect(x-.04,-.99,x+.04,.96),z1,z2,PALETTE.frame);
  add(frame,side+'-guide-mount',rect(x+sign*.04,-.99,x+sign*.10,.96),-RIM+.0005,.20,PALETTE.frame);
 }
 // Fixed shaft bearing and horizontal ways; inferred rear supports stay behind moving parts.
 add(root,'shaft-bearing',bore(poly(circle([0,0],.16,48)),[[0,0]],.108),-.24,-.17,PALETTE.frame);
 add(root,'bearing-post',rect(-.08,-1.86,.08,-.14),-.24,-.17,PALETTE.frame);
 add(root,'base',rect(-3.0,-1.93,3.0,-1.83),-.25,-.05,PALETTE.frame);
 for(const [i,x]of [-1.28,1.36].entries()){
  const roller=new THREE.Group();roller.position.set(x,-1.54,0);root.add(roller);blocks['roller'+i]=roller;
  add(roller,'support-roller-'+i,bore(poly(circle([0,0],.23,96)),[[0,0]],.036),.17,.24,PALETTE.frame);
  for(const [j,z]of [.16,.24].entries())add(roller,'roller-flange-'+i+'-'+j,bore(poly(circle([0,0],.25,96)),[[0,0]],.036),z,z+.01,PALETTE.frame);
  pin(root,'roller-axle-'+i,[x,-1.54],-.16,.26,.035);
  add(root,'roller-bearing-'+i,bore(poly(circle([x,-1.54],.065,48)),[[x,-1.54]],.036),-.16,-.10,PALETTE.frame);
  add(root,'roller-post-'+i,rect(x-.06,-1.86,x+.06,-1.58),-.16,-.10,PALETTE.frame);
 }
 const sync=q=>{
  pinion.rotation.z=q[0];frame.position.x=-.05+q[1];rack.position.y=d.orbit+q[2];
  for(const side of ['left','right']){blocks[side+'Crank'].rotation.z=q[3];blocks[side+'Rod'].rotation.z=q[4];}
  const c=Math.cos(q[3]),s=Math.sin(q[3]);coupler.position.set(-1.60-.075*c-.58*s,1.01-.075*s+.58*c,0);
  for(let i=0;i<2;i++)blocks['roller'+i].rotation.z=-q[1]/.23;
  root.updateMatrixWorld(true);
 };
 sync([-Math.PI/2,0,0,0,0]);markShadows(root);root.traverse(o=>{if(o.material)o.material.fog=false;});
 root.userData={blocks,parts,massAssumptions:{rackMass,rimMass,backingMass,pinionDepth,frameDepth,crankDepth,rodDepth,couplerDepth,materials:{rackRim:'steel',backing:'aluminium',frame:'light wood',links:'aluminium',coupler:'brass'},note:'Primary panel masses match the candidate ratios. Fasteners, output rods and mesh-derived inertias still need inclusion in the native model.'}};
 return {root,sync};
}
