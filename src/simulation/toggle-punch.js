import * as THREE from 'three';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
import {matte,PALETTE,markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';
import {togglePunchDimensions as source} from '../data/toggle-punch-dimensions.js';
import {togglePunchGeometry as g,togglePunchAtTime} from './toggle-punch-kinematics.js';

export function makeTogglePunch(){
 const root=new THREE.Group(),parts={},blocks={};
 const world=([x,y])=>[(x-278)/100,(216-y)/100];
 const rect=(x1,y1,x2,y2)=>poly([[x1,y1],[x2,y1],[x2,y2],[x1,y2]]);
 const drawn=p=>poly(p.map(world));
 const curve=points=>new THREE.SplineCurve(points.map(p=>new THREE.Vector2(...p))).getPoints(72).map(p=>p.toArray());
 const add=(parent,name,p,z1,z2,color)=>{const m=new THREE.Mesh(plate(p,z1,z2),matte(color));m.name=name;parent.add(m);parts[name]=m;return m;};
 const bore=(p,points,r=.046)=>clip.difference(p,...points.map(p=>poly(circle(p,r,48))));
 const pin=(parent,name,p,z1,z2,r=.045)=>add(parent,name,poly(circle(p,r,48)),z1,z2,PALETTE.ink);
 const group=name=>{const o=new THREE.Group();o.name=name;root.add(o);blocks[name]=o;return o;};
 const eye=(a,b,r=.09)=>clip.union(capsule(a,b,.05,24),poly(circle(a,r,48)),poly(circle(b,r,48)));
 // Separate rear support plate and front pedestal reproduce the engraving's
 // casting and cutaway. Their hidden depths are reconstructed.
 // The rear plate's lower part runs on behind the pedestal's web (hidden by
 // it from the front) so, seen from behind, it is visibly carried by the web
 // rather than hanging short of the base.
 add(root,'rear-frame',bore(drawn([[185,66],[224,65],[224,131],[242,149],[279,148],[279,400],[185,400]]),[g.top,[0,0]],.0715),-.25,-.15,PALETTE.frame);
 add(root,'pedestal',drawn([[239,248],[280,248],...curve([[280,265],[299,282],[326,308],[343,335],[347,361],[348,390],[359,417],[375,436],[387,447]]),[408,447],[408,483],[118,483],[118,448],...curve([[218,448],[232,439],[239,421]])]),-.15,.16,PALETTE.frame);
 const lever=group('lever');
 const leverShape=clip.union(eye([0,0],g.pin,.10),capsule([0,0],g.handleEnd,.065,32),poly(circle([0,0],.15,64)));
 add(lever,'hand-lever',bore(leverShape,[[0,0]],.0715),.25,.33,PALETTE.driver);
 pin(lever,'lever-connector-pin',g.pin,.245,.45);
 pin(root,'fixed-lever-shaft',[0,0],-.26,.35,.07);
 pin(root,'fixed-top-shaft',g.top,-.26,.095,.045);
 // A bored boss locates the smaller upper shaft in the larger cast passage.
 add(root,'top-bearing',bore(poly(circle(g.top,.085,48)),[g.top]),-.26,-.14,PALETTE.ink);
 const upper=group('upper'),lower=group('lower'),connector=group('connector'),ram=group('ram');
 for(const [parent,name,length,z]of [[upper,'upper-toggle',g.upperLength,.02],[lower,'lower-toggle',g.lowerLength,.09],[connector,'connecting-link',g.connectorLength,.37]]){
  add(parent,name,bore(eye([0,0],[length,0]),[[0,0],[length,0]]),z,z+.06,name==='connecting-link'?PALETTE.accent:PALETTE.driven);
 }
 pin(upper,'knee-pin',[g.upperLength,0],.015,.45);
 add(ram,'ram-eye',bore(poly(circle([0,0],.09,48)),[[0,0]]),.01,.07,PALETTE.driven);
 pin(ram,'ram-joint-pin',[0,0],.005,.165);
 const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.92,48),matte(PALETTE.driven));shaft.position.set(0,-.53,.03);shaft.name='punch-shaft';ram.add(shaft);parts[shaft.name]=shaft;
 const tip=new THREE.Mesh(new THREE.ConeGeometry(.055,.08,48),matte(PALETTE.driven));tip.rotation.z=Math.PI;tip.position.set(0,-1.03,.03);tip.name='punch-tip';ram.add(tip);parts[tip.name]=tip;
 // Open-ended guide: the lower toggle enters the upper part during closing.
 for(const [side,x1,x2]of [['left',185,198],['right',218,225]]){
  add(root,side+'-guide',drawn([[x1,305],[x2,305],[x2,358],[x1,358]]),-.15,.195,PALETTE.frame);
 }
 for(const [side,x1,x2]of [['left',198,201],['right',215,218]])add(root,side+'-guide-lip',drawn([[x1,305],[x2,305],[x2,358],[x1,358]]),.165,.195,PALETTE.frame);
 // The shelf has a vertical through-hole, allowing the tool to pass below
 // its surface without inventing a solid workpiece or material-cutting force.
 const shelfShape=clip.difference(rect(-.93,-.25,-.39,.24),poly(circle([g.ram[0],.03],.058,64)));
 const shelf=new THREE.Mesh(plate(shelfShape,0,.06),matte(PALETTE.frame));
 shelf.rotation.x=Math.PI/2;shelf.position.y=(216-source.shelfY)/100;shelf.name='bored-die-shelf';root.add(shelf);parts[shelf.name]=shelf;
 const place=(block,a,b)=>{block.position.set(a[0],a[1],0);block.rotation.z=Math.atan2(b[1]-a[1],b[0]-a[0]);};
 const update=time=>{const s=togglePunchAtTime(time);lever.rotation.z=s.angle;place(upper,g.top,s.knee);place(lower,s.knee,s.ram);place(connector,s.pin,s.knee);ram.position.set(...s.ram,0);root.updateMatrixWorld(true);root.userData.state=s;};
 update(0);markShadows(root);root.traverse(o=>{if(o.material)o.material.fog=false;});
 const bounds=new THREE.Box3();for(let i=0;i<=120;i++){update(g.period*i/120);bounds.union(new THREE.Box3().setFromObject(root));}bounds.expandByScalar(.025);update(0);
 Object.assign(root.userData,{parts,blocks,mechanism:'engraving-fitted-unequal-toggle-punch',simulationBackend:'analytic',fidelity:'authored',reconstructionStatus:'verified',hideGround:true,supportsRestart:true,cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},reconstructionNote:'The hand lever straightens two unequal toggle links to lower the punch. Joint centres follow the engraving; the resulting lever swing differs from the source animation. Depths, the open guide and the die passage are reconstructed.',animationTiming:{authoredCyclePeriod:g.period,displayCycleDuration:g.period,playbackTimeScale:1}});
 return {root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.08,.04,15),update,reset:()=>update(0),dispose:()=>disposeObject3D(root)};
}
