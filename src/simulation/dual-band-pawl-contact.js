import * as THREE from 'three';
import { plate, poly, circle, polygonClipping as clip } from './finite-plate-geometry.js';
import { dualBand390Pawl } from './dual-band-pawl-profile.js';
export const dualBandPawlDimensions=Object.freeze({
  teeth:12,outerRadius:.34,rootRadius:.255,pivotRadius:.42,length:.24,
  tipRadius:.018,armHalfWidth:.0085,bow:.055,eyeRadius:.036,bore:.021,
  pinRadius:.020,depth:.035,seatAngle:2.4,seatClearance:.00004,
  runningClearance:.00015,overtravel:.065,dropStart:-.035,dropEnd:.055,
  mountPhase:2.4,
});
const d=dualBandPawlDimensions,TAU=2*Math.PI;
export const dualBandToothPitch=TAU/d.teeth;
export const turn390=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
export function ratchet390Outline(phase=0){
  const points=[];
  for(let i=0;i<d.teeth;i++)for(const[r,t]of[[d.outerRadius,0],[d.rootRadius,.95]])points.push(turn390([r,0],phase+(i+t)*dualBandToothPitch));
  return points;
}
export function nearest390Outline(point,outline){
  let distance=Infinity,inside=false,result;
  for(let i=0,j=outline.length-1;i<outline.length;j=i++){
    const a=outline[j],b=outline[i],dx=b[0]-a[0],dy=b[1]-a[1];
    const u=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)));
    const q=[a[0]+u*dx,a[1]+u*dy],r=Math.hypot(point[0]-q[0],point[1]-q[1]);
    if(r<distance){distance=r;result={point:q,edge:j,u};}
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return{...result,distance:inside?-distance:distance};
}
const unrotatedOutline=ratchet390Outline();
export function toe390Contact(angle,wheelAngle){
  const toe=[d.pivotRadius+d.length*Math.cos(angle),d.length*Math.sin(angle)];
  const hit=nearest390Outline(turn390(toe,-wheelAngle),unrotatedOutline),point=turn390(hit.point,wheelAngle);
  const normal=[(toe[0]-point[0])/hit.distance,(toe[1]-point[1])/hit.distance];
  return{...hit,point,toe,normal,gap:hit.distance-d.tipRadius,
    seatingMoment:(toe[0]-d.pivotRadius)*normal[1]-toe[1]*normal[0],
    outputMoment:-(point[0]*normal[1]-point[1]*normal[0])};
}
let seatLow=.139,seatHigh=.141;
for(let i=0;i<48;i++){const a=(seatLow+seatHigh)/2;if(toe390Contact(d.seatAngle,a).gap<d.seatClearance)seatLow=a;else seatHigh=a;}
export const dualBandSeatPhase=(seatLow+seatHigh)/2;
// Least-clearance pawl angle of the finite chisel pawl at a relative tooth
// phase (flywheel minus carrier). Driving and take-up sit at the seat angle
// because the table is zero there; the options are retained for callers.
export function pawl390Angle(relativeAngle,_options={}){
  const t=dualBand390Pawl;let q=((relativeAngle%dualBandToothPitch)+dualBandToothPitch)%dualBandToothPitch;if(dualBandToothPitch-q<1e-9)q=0;
  const x=q/dualBandToothPitch*t.count,i=Math.floor(x)%t.count,f=x-Math.floor(x);
  const a=t.lifts[i],b=t.lifts[(i+1)%t.count];
  // A drop (crest passing) snaps at the sample boundary rather than
  // interpolating through the crest, so no in-between pose cuts the tooth.
  return d.seatAngle+(b>a+.01?a:a+f*(b-a));
}
// Is a pawl lift (relative to the seat angle, negative raises) clear of the
// ratchet at this relative angle? Conservative across the two nearest samples.
export function pawl390LiftClear(relativeAngle,lift){
  const t=dualBand390Pawl;let q=((relativeAngle%dualBandToothPitch)+dualBandToothPitch)%dualBandToothPitch;if(dualBandToothPitch-q<1e-9)q=0;
  const x=q/dualBandToothPitch*t.count,i=Math.floor(x)%t.count;
  const inside=sets=>sets.some(([a,b])=>lift<=a+1e-12&&lift>=b-1e-12);
  return inside(t.clearSets[i])&&inside(t.clearSets[(i+1)%t.count]);
}
// Lowest clear lift magnitude at or above a blocked candidate (the nose
// resting on the flank that still stands in front of it).
export function pawl390RestingLift(relativeAngle,lift){
  let l=lift;for(let k=0;k<400&&!pawl390LiftClear(relativeAngle,l);k++)l-=dualBand390Pawl.clearStep/4;return l;
}
export function install390Pawls(root){
  const b=root.userData.blocks;
  // Brown draws a point-symmetric pair of pawls on the ratchet face. Each loose
  // pulley carries two identical pawls half a turn apart; with twelve teeth
  // both sit in roots at once, so they share one lift law and share the load.
  for(const[carrier,wheel,phase]of[[b.openCarrier,b.openRatchet,d.mountPhase],[b.crossedCarrier,b.crossedRatchet,d.mountPhase+Math.PI]]){
    const pawl=carrier.userData.pawl,oldBody=carrier.userData.pawlBody;
    let material;oldBody.traverse(o=>{if(o.isMesh&&!material)material=o.material;});
    const pinMaterial=pawl.children.find(o=>o.userData.role?.endsWith('hinge-pin')).material;
    const white=carrier.userData.contactIndex.material;
    for(const child of [...pawl.children]){pawl.remove(child);child.traverse(o=>o.geometry?.dispose());}
    // One flat bored curled link: a circular-arc band whose chisel nose sits in
    // the V root, working face along the driving flank (designed offline).
    const shape=clip.difference(clip.union(poly(dualBand390Pawl.outline),poly(circle([0,0],.047,64))),poly(circle([0,0],d.bore,64)));
    const bodyGeometry=plate(shape,-d.depth/2,d.depth/2);
    const pinGeometry=new THREE.CylinderGeometry(d.pinRadius,d.pinRadius,.11,48).rotateX(Math.PI/2);
    const nose=dualBand390Pawl.outline.reduce((best,q)=>Math.hypot(...q)>Math.hypot(...best)?q:best);
    const twin=new THREE.Group();twin.userData.role=`${pawl.userData.role}-mirrored-twin`;carrier.add(twin);
    const plane=carrier.userData.pulley.position.z;
    const pawls=[],bodies=[],pins=[],indices=[];
    for(const[group,mount]of[[pawl,phase],[twin,phase+Math.PI]]){
      const body=new THREE.Mesh(bodyGeometry,material);
      body.userData.role='finite-curved-bored-ratchet-pawl';group.add(body);
      group.position.set(d.pivotRadius*Math.cos(mount),d.pivotRadius*Math.sin(mount),plane+.165);
      group.userData.baseAngle=mount+d.seatAngle;
      group.userData.mountPhase=mount;
      const pin=new THREE.Mesh(pinGeometry,pinMaterial);
      pin.position.set(group.position.x,group.position.y,plane+.145);pin.userData.role='carrier-fixed-pawl-journal';carrier.add(pin);
      // Brown draws no stop beside the pawl: the ratchet root itself seats it.
      const index=new THREE.Mesh(new THREE.CircleGeometry(.008,24),white);
      index.position.set(nose[0],nose[1],d.depth/2+.0003);index.userData.role='white-active-pawl-contact-index';group.add(index);
      pawls.push(group);bodies.push(body);pins.push(pin);indices.push(index);
    }
    const outline=ratchet390Outline(d.mountPhase+dualBandSeatPhase);
    wheel.geometry.dispose();wheel.geometry=plate(clip.difference(poly(outline),poly(circle([0,0],.107,64))),-.05,.05);
    wheel.userData.finiteOutline=outline;
    carrier.userData.pawls=pawls;carrier.userData.pawlBodies=bodies;carrier.userData.pawlPins=pins;carrier.userData.contactIndices=indices;
    carrier.userData.twinPawl=twin;
    carrier.userData.pawlBody=bodies[0];carrier.userData.pawlLength=d.length;carrier.userData.contactIndex=indices[0];
    carrier.userData.pawlPin=pins[0];carrier.userData.pawlStop=null;
  }
  b.openPawlContactIndex=b.openCarrier.userData.contactIndex;b.crossedPawlContactIndex=b.crossedCarrier.userData.contactIndex;
  b.openTwinPawl=b.openCarrier.userData.twinPawl;b.crossedTwinPawl=b.crossedCarrier.userData.twinPawl;
  root.userData.finiteInterfaceReview.qualification='Finite pulley grooves, journals and pawl/ratchet geometry; carrier take-up and pawl bias/return are prescribed, not a force solution.';
  root.userData.finitePawlReview={dimensions:d,seatPhase:dualBandSeatPhase,seatContact:toe390Contact(d.seatAngle,dualBandSeatPhase),pawlsPerCarrier:2,
    qualification:'Two identical point-symmetric pawls per loose pulley, half a turn (six teeth) apart, with one least-clearance lift law: each rides a tooth back in overrun, drops into the next root as the crest passes, and the carrier overtravel is the backlash taken up before both drive with their noses in roots. Spring bias, drop dynamics, impact, flywheel inertia and load transfer are not force-solved.',outline:dualBand390Pawl.outline};
}
