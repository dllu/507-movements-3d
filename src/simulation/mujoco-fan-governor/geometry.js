import * as THREE from 'three';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';
import {fanGovernorSource as s,fanGovernorTrack as g,fanGovernorTrackCells} from './source.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {rigidFamilyInertia} from '../mujoco/mass.js';
import {disposeObject3D} from '../dispose-model.js';
import {plate,poly,circle,capsule,polygonClipping as clip} from '../finite-plate-geometry.js';

const lathe=profile=>new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),96);
const tube=(inner,outer,low,high)=>lathe([[inner,low],[outer,low],[outer,high],[inner,high],[inner,low]]);
export function makeFanGovernorGeometry({segments=160}={}){
 const root=new THREE.Group(),parts={},families={},blocks={};
 for(const name of ['fixed','shaft','crosshead','roller0','roller1','collar','lever']){blocks[name]=new THREE.Group();blocks[name].name=name;}
 root.add(blocks.fixed,blocks.shaft,blocks.crosshead,blocks.collar,blocks.lever);blocks.crosshead.add(blocks.roller0,blocks.roller1);
 blocks.roller0.position.x=-g.radius;blocks.roller1.position.x=g.radius;
 const materials=Object.fromEntries(['frame','driver','driven','brass','ink'].map(name=>{
  const m=matte(PALETTE[name],{roughness:.65,metalness:.15});m.fog=false;return[name,m];
 }));
 const add=(name,geometry,family,color)=>{const mesh=new THREE.Mesh(geometry,materials[color]);mesh.name=name;blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 for(const cell of fanGovernorTrackCells(segments))add(cell.name,new ConvexGeometry(cell.vertices.map(p=>new THREE.Vector3(...p))),'shaft','driver');
 add('shaft',new THREE.CylinderGeometry(s.shaftRadius,s.shaftRadius,6.35,64).translate(0,.325,0),'shaft','ink');
 add('shaft-base-hub',tube(.131,.38,-1.45,-1.15),'shaft','driver');
 add('track-foundation-ring',tube(g.radius-g.halfWidth-.04,g.radius+g.halfWidth+.04,g.foundation-.12,g.foundation),'shaft','driver');
 for(let i=0;i<4;i++)add('foundation-spoke-'+i,new THREE.BoxGeometry(1.20,.12,.16)
  .translate(.94,g.foundation-.06,0).rotateY(i*Math.PI/2),'shaft','driver');
 add('lower-bearing',tube(.133,.29,-2.25,-1.85),'fixed','frame');
 add('loose-crosshead-sleeve',tube(.14,.40,-.30,.30),'crosshead','driven');
 // Radius/height profile traced approximately from the bulb and neck.
 const outer=[[.40,.30],[.56,.44],[.95,.73],[1.16,1.10],[1.18,1.42],[1.06,1.80],[.80,2.15],[.35,2.50],[.25,2.70]];
 const smoothOuter=new THREE.SplineCurve(outer.map(p=>new THREE.Vector2(...p))).getPoints(128).map(p=>p.toArray());
 add('bored-weight',lathe([[.14,.30],...smoothOuter,[.14,2.70],[.14,.30]]),'crosshead','driven');
 add('upper-neck',lathe([[.14,2.70],[.25,2.70],[.25,2.82],[.32,2.82],[.32,2.86],
  [.25,2.86],[.25,3.02],[.32,3.02],[.32,3.06],[.25,3.06],[.25,3.10],[.14,3.10],[.14,2.70]]),'crosshead','driven');
 // Reconstructed unloaded output joint: the collar follows lift but does not
 // rotate. The slotted lever pivots at its right end; valve load is omitted.
 add('output-collar',tube(.255,.31,2.865,3.015),'collar','brass');
 add('collar-pin',new THREE.CylinderGeometry(.045,.045,.25,48).rotateX(Math.PI/2).translate(0,2.94,.375),'collar','brass');
 const leverOutline=clip.union(poly([[-3.2,-.075],[-3.2,.075],[0,.17],[.10,.12],[.10,-.12],[0,-.17]]),
  capsule([-3.10,0],[-2.98,0],.095,32));
 const leverShape=clip.difference(leverOutline,capsule([-3.10,0],[-2.98,0],.050,48),poly(circle([0,0],.063,64)));
 add('output-lever',plate(leverShape,.33,.43),'lever','driven');
 blocks.lever.position.set(3,2.94,0);
 add('lever-pivot',new THREE.CylinderGeometry(.06,.06,.36,48).rotateX(Math.PI/2).translate(3,2.94,.32),'fixed','brass');
 add('lever-pivot-support',new THREE.BoxGeometry(.24,.32,.12).translate(3,2.94,.20),'fixed','frame');
 for(const side of [-1,1]){
  for(const [index,[low,high,r]] of [[.40,g.radius-.125,.09],[g.radius-.125,g.radius+.125,.052],[g.radius+.125,2.85,.09]].entries()){
   const arm=new THREE.CylinderGeometry(r,r,high-low,48).rotateZ(-Math.PI/2).translate(side*(low+high)/2,0,0);
   add('fan-arm-'+side+'-'+index,arm,'crosshead','driven');
  }
  add('fan-panel-'+side,new THREE.BoxGeometry(s.fanWidth*s.scale,s.fanHeight*s.scale,.04).translate(side*192*s.scale,0,0),'crosshead','driven');
 }
 const half=s.rollerHalfWidth*s.scale,profile=[[.055,-half]];
 for(let i=0;i<=32;i++){const x=-half+2*half*i/32;profile.push([Math.sqrt(g.rollerRadius**2-x*x),x]);}
 profile.push([.055,half],[.055,-half]);
 for(let i=0;i<2;i++)add('crowned-roller-'+i,lathe(profile).rotateZ(-Math.PI/2),'roller'+i,'brass');
 const mass={};for(const family of ['crosshead','roller0','roller1'])mass[family]=rigidFamilyInertia(parts,families,family);
 const sync=state=>{blocks.shaft.rotation.y=state.shaft;blocks.crosshead.position.y=state.lift;blocks.crosshead.rotation.y=state.yaw;
  blocks.collar.position.y=state.lift;blocks.lever.rotation.z=-Math.atan2(state.lift,3);
  blocks.roller0.rotation.x=state.roll0??0;blocks.roller1.rotation.x=state.roll1??0;root.updateMatrixWorld(true);};
 Object.assign(root.userData,{parts,families,blocks,mass,reconstructionStatus:'candidate',hideGround:true});
 markShadows(root);sync({shaft:.55,lift:0,yaw:0});
 return {root,sync,dispose:()=>disposeObject3D(root)};
}
