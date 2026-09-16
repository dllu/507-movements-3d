import * as THREE from 'three';
import { plate, poly, circle, polygonClipping as clip } from './finite-plate-geometry.js';
import { dualBandPawlSamples } from './dual-band-pawl-profile.js';
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
export function pawl390Angle(relativeAngle,{overrunning=false,advance=Infinity}={}){
  if(!overrunning||advance<d.dropEnd)return d.seatAngle;
  const q=((relativeAngle%dualBandToothPitch)+dualBandToothPitch)%dualBandToothPitch;
  const x=q/dualBandToothPitch*(dualBandPawlSamples.length-1),i=Math.floor(x),f=x-i;
  return dualBandPawlSamples[i]+f*(dualBandPawlSamples[i+1]-dualBandPawlSamples[i]);
}
export function install390Pawls(root){
  const b=root.userData.blocks;
  for(const[carrier,wheel,phase]of[[b.openCarrier,b.openRatchet,d.mountPhase],[b.crossedCarrier,b.crossedRatchet,d.mountPhase+Math.PI]]){
    const pawl=carrier.userData.pawl,oldBody=carrier.userData.pawlBody;
    let material;oldBody.traverse(o=>{if(o.isMesh&&!material)material=o.material;});
    const pinMaterial=pawl.children.find(o=>o.userData.role?.endsWith('hinge-pin')).material;
    const white=carrier.userData.contactIndex.material;
    for(const child of [...pawl.children]){pawl.remove(child);child.traverse(o=>o.geometry?.dispose());}
    const band=[1,-1].flatMap(side=>Array.from({length:65},(_,i)=>{
      const u=side===1?i/64:1-i/64,x=d.length*u,y=-d.bow*Math.sin(Math.PI*u),dy=-d.bow*Math.PI/d.length*Math.cos(Math.PI*u),n=Math.hypot(1,dy);
      return[x-side*d.armHalfWidth*dy/n,y+side*d.armHalfWidth/n];
    }));
    const shape=clip.difference(clip.union(poly(band),poly(circle([0,0],d.eyeRadius,64)),poly(circle([d.length,0],d.tipRadius,64))),poly(circle([0,0],d.bore,64)));
    const body=new THREE.Mesh(plate(shape,-d.depth/2,d.depth/2),material);
    body.userData.role='finite-curved-bored-ratchet-pawl';pawl.add(body);
    const plane=carrier.userData.pulley.position.z;
    pawl.position.set(d.pivotRadius*Math.cos(phase),d.pivotRadius*Math.sin(phase),plane+.165);
    pawl.userData.baseAngle=phase+d.seatAngle;
    pawl.userData.mountPhase=phase;
    const pin=new THREE.Mesh(new THREE.CylinderGeometry(d.pinRadius,d.pinRadius,.11,48).rotateX(Math.PI/2),pinMaterial);
    pin.position.set(pawl.position.x,pawl.position.y,plane+.145);pin.userData.role='carrier-fixed-pawl-journal';carrier.add(pin);
    // A small stop reacts the inward bias; lifting rotates the pawl away from it.
    const x=.075,y=-d.bow*Math.sin(Math.PI*x/d.length),length=Math.hypot(x,y),r=.014;
    const stopLocal=[x-y/length*(r+d.armHalfWidth+.0005),y+x/length*(r+d.armHalfWidth+.0005)];
    const stopPoint=turn390(stopLocal,phase+d.seatAngle);
    const stop=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.065,40).rotateX(Math.PI/2),pinMaterial);
    stop.position.set(pawl.position.x+stopPoint[0],pawl.position.y+stopPoint[1],plane+.15);stop.userData.role='carrier-fixed-pawl-seating-stop';carrier.add(stop);
    const index=new THREE.Mesh(new THREE.CircleGeometry(.008,24),white);
    index.position.set(d.length,0,d.depth/2+.0003);index.userData.role='white-active-pawl-contact-index';pawl.add(index);
    const outline=ratchet390Outline(d.mountPhase+dualBandSeatPhase);
    wheel.geometry.dispose();wheel.geometry=plate(clip.difference(poly(outline),poly(circle([0,0],.107,64))),-.05,.05);
    wheel.userData.finiteOutline=outline;
    carrier.userData.pawlBody=body;carrier.userData.pawlLength=d.length;carrier.userData.contactIndex=index;
    carrier.userData.pawlPin=pin;carrier.userData.pawlStop=stop;
  }
  b.openPawlContactIndex=b.openCarrier.userData.contactIndex;b.crossedPawlContactIndex=b.crossedCarrier.userData.contactIndex;
  root.userData.finiteInterfaceReview.qualification='Finite pulley grooves, journals and pawl/ratchet geometry; carrier take-up and pawl bias/return are prescribed, not a force solution.';
  root.userData.finitePawlReview={dimensions:d,seatPhase:dualBandSeatPhase,seatContact:toe390Contact(d.seatAngle,dualBandSeatPhase),
    qualification:'Finite-contact envelope with continuous prescribed drop and explicit carrier take-up. Spring bias, impact, flywheel inertia and load transfer are not force-solved.'};
}
