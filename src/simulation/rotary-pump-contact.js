import {oldPumpVaneOutline} from './old-pump-vane-geometry.js';
export {oldPumpVaneOutline} from './old-pump-vane-geometry.js';
import oldProfile from './old-pump-contact-profile.js';
import * as THREE from 'three';
import {capsule,circle,poly,plate,polygonClipping} from './finite-plate-geometry.js';
import {curvedPipeWall,mergePassageParts} from './finite-fluid-passages.js';

// Cary's pistons c, c are one rigid bar through the drum. Its two rollers
// bear on opposite sides of the fixed heart cam a, so the cam has constant
// width through the axle: r(t)+r(t+pi)=2*CARY_MEAN_RADIUS. A retracted dwell
// at E (bottom) therefore pairs with an extended dwell at the top, joined by
// harmonic flanks; the chamber wall is the matching curve traced by the bar
// ends, so the chamber is eccentric about the drum as Brown draws it.
const CARY_DWELL=20*Math.PI/180,CARY_MEAN_RADIUS=.89,CARY_LIFT=.36;
export function caryFollowerLaw(angle) {
  const signed=THREE.MathUtils.euclideanModulo(angle+Math.PI/2+Math.PI,2*Math.PI)-Math.PI;
  const s=Math.abs(signed),sign=Math.sign(signed),span=Math.PI-2*CARY_DWELL;
  if(s<=CARY_DWELL)return {radius:CARY_MEAN_RADIUS-CARY_LIFT,first:0,second:0};
  if(s>=Math.PI-CARY_DWELL)return {radius:CARY_MEAN_RADIUS+CARY_LIFT,first:0,second:0};
  const u=(s-CARY_DWELL)/span,k=Math.PI/span;
  return {
    radius:CARY_MEAN_RADIUS-CARY_LIFT*Math.cos(Math.PI*u),
    first:CARY_LIFT*k*Math.sin(Math.PI*u)*sign,
    second:CARY_LIFT*k*k*Math.cos(Math.PI*u),
  };
}
// Chamber wall: the envelope of the bar-end sealing heads (half-width
// angle 0.09) plus a 0.003 running clearance.
export function caryWallRadius(angle,pistonLength){
  let radius=0;
  for(let i=-8;i<=8;i++)radius=Math.max(radius,caryFollowerLaw(angle+.09*i/8).radius+pistonLength);
  return radius+.003;
}

const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};

export function correctCaryPump(root) {
  const d=root.userData,b=d.blocks,g=d.geometry;
  const rollerRadius=.11,outline=[];
  for(let i=0;i<2048;i++){
    const a=i*2*Math.PI/2048,{radius:r,first:rp}=caryFollowerLaw(a),c=Math.cos(a),s=Math.sin(a),length=Math.hypot(r,rp);
    outline.push([r*c-rollerRadius*(r*c+rp*s)/length,r*s-rollerRadius*(r*s-rp*c)/length]);
  }
  // The cam sits behind the bar's central bridge, which crosses in front of it.
  const camBack=-g.casingDepth*.38,camFront=.10;
  replace(b.fixedHeartCam,plate(polygonClipping.difference(poly(outline),poly(circle([0,0],.234,256))),camBack,camFront));
  const outlineLine=root.children.find(o=>o.userData.role==='fixed-heart-cam-contact-outline');
  replace(outlineLine,new THREE.BufferGeometry().setFromPoints([...outline,outline[0]].map(([x,y])=>new THREE.Vector3(x,y,camFront+.001))));
  const slots=poly([[-1.8,-.14],[1.8,-.14],[1.8,.14],[-1.8,.14]]);
  replace(b.drumShell,plate(polygonClipping.difference(poly(circle([0,0],g.drumOuterRadius,512)),poly(circle([0,0],g.drumInnerRadius,512)),slots),-g.casingDepth*.415,g.casingDepth*.415));
  const spider=polygonClipping.union(poly(circle([0,0],.35,128)),poly([[-1.42,-.08],[1.42,-.08],[1.42,.08],[-1.42,.08]]),poly([[-.08,-1.42],[.08,-1.42],[.08,1.42],[-.08,1.42]]));
  const rearSpider=new THREE.Mesh(plate(spider,-.44,-.315),b.drumShell.material);rearSpider.userData.role='rear-spider-joining-drum-to-driving-axle';b.drum.add(rearSpider);b.rearSpider=rearSpider;
  for(const p of b.pistons){
    replace(p.blade,new THREE.BoxGeometry(g.pistonLength-.10,.17,g.casingDepth*.63));p.blade.position.x=-.05;
    // Rollers run in the cam's layer only.
    replace(p.follower,new THREE.CylinderGeometry(rollerRadius,rollerRadius,camFront-camBack-.02,64));p.follower.position.z=(camFront+camBack)/2;
    const edge=Array.from({length:33},(_,i)=>{const y=-.135+.27*i/32;return[Math.sqrt((g.casingInnerRadius-.0001)**2-y*y)-g.camMaximumRadius-g.pistonLength/2,y]});
    const shape=poly([...edge,...edge.map(([x,y])=>[x-.13,y]).reverse()]);
    replace(p.sealingHead,plate(shape,-g.casingDepth*.34,g.casingDepth*.34));p.sealingHead.position.x=0;
  }
  // Brown's single rigid bar c-c: a bridge in front of the cam joins the two
  // rollers, swelling round a slot that lets it slide past the axle.
  {
    const half=g.pistonLength/2,width=2*g.camMeanRadius,near=-half,far=-half-width;
    const slotNear=-(g.camMinimumRadius+half),slotFar=-(g.camMaximumRadius+half),slotHalf=.245;
    const body=polygonClipping.union(
      poly([[far,-.075],[near,-.075],[near,.075],[far,.075]]),
      capsule([slotFar,0],[slotNear,0],slotHalf+.09,96));
    const bridge=new THREE.Mesh(plate(polygonClipping.difference(body,capsule([slotFar,0],[slotNear,0],slotHalf,96)),.12,g.casingDepth*.38),b.pistons[0].blade.material);
    bridge.userData.role='rigid-bridge-joining-pistons-c-c-into-one-bar';
    b.pistons[0].piston.add(bridge);b.pistonBridge=bridge;
  }
  // Chamber wall traced by the bar ends; E is the thick lower wall between
  // ports L and M, with a packing block at its crown.
  const wall=[],outer=[];
  for(let i=0;i<720;i++){const a=i*2*Math.PI/720,r=caryWallRadius(a,g.pistonLength);wall.push([r*Math.cos(a),r*Math.sin(a)]);outer.push([(r+.30)*Math.cos(a),(r+.30)*Math.sin(a)]);}
  const outletAngle=-Math.PI/3,rot=([x,y])=>[x*Math.cos(outletAngle)-y*Math.sin(outletAngle),x*Math.sin(outletAngle)+y*Math.cos(outletAngle)];
  const port=poly([[1.3,-.35],[2.8,-.35],[2.8,.35],[1.3,.35]].map(rot));
  const inletPort=poly([[-1.18,-3.2],[-.52,-3.2],[-.52,-1.0],[-1.18,-1.0]]);
  const packing=poly([...Array.from({length:17},(_,i)=>{const a=-Math.PI/2-.14+.28*i/16;return[1.575*Math.cos(a),1.575*Math.sin(a)];}),...Array.from({length:17},(_,i)=>{const a=-Math.PI/2+.14-.28*i/16;return[1.74*Math.cos(a),1.74*Math.sin(a)];})]);
  replace(b.casing,plate(polygonClipping.difference(poly(outer),poly(wall),port,inletPort,packing),-g.casingDepth/2,g.casingDepth/2));
  replace(b.portSeparatorE,plate(polygonClipping.difference(packing,poly(wall)),-g.casingDepth*.45,g.casingDepth*.45));b.portSeparatorE.position.set(0,0,0);
  d.caryWallRadiusAtAngle=angle=>caryWallRadius(angle,g.pistonLength);
  // H leaves M through the wall's throat, then climbs the right side.
  const curve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(...rot([1.72,0]),0),
    new THREE.Vector3(...rot([2.35,0]),0),
    new THREE.Vector3(2.25,-2.30,0),new THREE.Vector3(2.90,-1.45,0),
    new THREE.Vector3(3.05,-.45,0),new THREE.Vector3(3.05,1.35,0),
    new THREE.Vector3(3.28,2.27,0),new THREE.Vector3(3.76,2.05,0),new THREE.Vector3(3.86,1.30,0),
  ]);
  replace(b.dischargeH.shell,curvedPipeWall(curve,.29,.34,128));
  b.dischargeH.shell.userData.curve=curve;
  replace(b.dischargeH.water,new THREE.TubeGeometry(curve,128,.21,12,false));
  // F rises straight into L beside E.
  b.inletF.position.set(-.13,.75,0);
  const inletShell=b.inletF.children[0];
  const walls=[new THREE.BoxGeometry(.1,1.58,.8268),new THREE.BoxGeometry(.1,1.58,.8268),new THREE.BoxGeometry(.66,1.58,.06),new THREE.BoxGeometry(.66,1.58,.06)];
  walls[0].translate(-.38,0,0);walls[1].translate(.38,0,0);walls[2].translate(0,0,-.3834);walls[3].translate(0,0,.3834);
  replace(inletShell,mergePassageParts(walls));inletShell.position.y=-3.0;
  replace(b.frontCover,plate(polygonClipping.difference(poly(circle([0,0],g.casingInnerRadius,512)),poly(circle([0,0],.234,128))),-.006,.006));
  d.solidReview={qualification:'One rigid piston bar c-c whose rollers bear on opposite sides of a constant-width heart cam; the eccentric chamber wall is the envelope of its ends. Radial drum slots, a bridge slot past the axle, the rear drive spider and open casing ports are finite. The 20-degree dwells and harmonic flanks are reconstructed; cam contact is kinematic, with no solved pressure, return load or hydraulic torque.'};
  finish(root);
}

// Baked finite contact branch, followed by a disclosed hold and quintic return.
export const oldPumpContactGeometry=oldProfile;
export function oldPumpFoldAtHingeAngle(angle){
  const travel=THREE.MathUtils.euclideanModulo(-angle,2*Math.PI);
  if(travel>=Math.PI)return {fraction:0,fractionDerivativeByTravel:0,fractionSecondDerivativeByTravel:0,travel,contactEngaged:false};
  if(travel>=oldProfile.peakAngle){
    const duration=33*Math.PI/180,t=THREE.MathUtils.clamp((travel-145*Math.PI/180)/duration,0,1);
    return {fraction:1-t*t*t*(10+t*(-15+6*t)),
      fractionDerivativeByTravel:-30*t*t*(1-t)**2/duration,
      fractionSecondDerivativeByTravel:-60*t*(1-t)*(1-2*t)/(duration*duration),travel,contactEngaged:false};
  }
  const index=travel/oldProfile.step,i=Math.floor(index),t=index-i;
  const value=oldProfile.fold[i]*(1-t)+oldProfile.fold[i+1]*t;
  return {fraction:value/oldProfile.maximumFold,
    fractionDerivativeByTravel:(oldProfile.fold[i+1]-oldProfile.fold[i])/(oldProfile.step*oldProfile.maximumFold),
    fractionSecondDerivativeByTravel:0,travel,
    contactEngaged:value>1e-8&&travel<=oldProfile.peakAngle};
}


function finish(root){const d=root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=d.geometry.cycleDuration;root.traverse(o=>{for(const m of o.material?[].concat(o.material):[])m.fog=false;});}

export function correctOldPump(root) {
  const d=root.userData,b=d.blocks,g=d.geometry,{blade,lip}=oldPumpVaneOutline(g.rotorRadius,g.valveLength);
  for(const v of b.valves){
    replace(v.blade,plate(blade,-g.casingDepth*.33,g.casingDepth*.33));v.blade.position.x=0;
    replace(v.flexibleLip,plate(lip,-g.casingDepth*.35,g.casingDepth*.35));v.flexibleLip.position.x=0;
  }
  // Full circular relief around each hinge eye clears its complete angular sweep;
  // the rear and front cheeks retain the pin's connection to the rotor.
  // Brown's rotor is a hollow hexagonal ring with the hinges at two opposite
  // corners, so each folded leaf lies along a facet. Its rear end plate
  // (a separate blank web) closes the drum behind the section.
  const body=poly(circle([0,0],g.rotorRadius,6)),boreRadius=.86,bore=poly(circle([0,0],boreRadius,128));
  const holes=[-1,1].map(sign=>poly(circle([sign*g.rotorRadius,0],.194,128)));
  const pocketRadius=g.valveLength+.09;
  const pockets=[0,Math.PI].map(rotation=>poly([[g.rotorRadius,0],...Array.from({length:129},(_,i)=>{const a=-.34+(oldProfile.maximumFold+.68)*i/128;return[g.rotorRadius+pocketRadius*Math.cos(a),pocketRadius*Math.sin(a)];})].map(([x,y])=>[x*Math.cos(rotation)-y*Math.sin(rotation),x*Math.sin(rotation)+y*Math.cos(rotation)])));
  const center=plate(polygonClipping.difference(body,bore,...holes,...pockets),-.265,.265);
  const cheeks=[[-.327,-.27],[.27,.327]].map(([low,high])=>plate(polygonClipping.difference(polygonClipping.union(body,...[-1,1].map(sign=>poly(circle([sign*g.rotorRadius,0],.175,96)))),bore),low,high));
  replace(b.rotorBody,mergePassageParts([center,...cheeks]));b.rotorBody.rotation.x=0;
  const web=new THREE.Mesh(plate(poly(circle([0,0],boreRadius,128)),-.327,-.27),b.rotorBody.material);
  web.userData.role='rotor-rear-end-web-behind-hollow-ring';b.rotorBody.parent.add(web);b.rotorRearWeb=web;
  // The shaft stays behind the web; Brown's section shows the ring empty.
  replace(b.shaft,new THREE.CylinderGeometry(.22,.22,.40,32));b.shaft.position.z=-.52;
  for(const cover of root.children.filter(o=>o.geometry?.type==='CircleGeometry'))replace(cover,plate(polygonClipping.difference(poly(circle([0,0],g.casingInnerRadius,512)),poly(circle([0,0],.224,128))),-.006,.006));
  const outletPort=poly([[2.2,-.34],[2.9,-.34],[2.9,.34],[2.2,.34]].map(([x,y])=>[x*Math.cos(g.outletAngle)-y*Math.sin(g.outletAngle),x*Math.sin(g.outletAngle)+y*Math.cos(g.outletAngle)]));
  replace(b.casing,plate(polygonClipping.difference(poly(circle([0,0],g.casingOuterRadius,512)),poly(circle([0,0],g.casingInnerRadius,512)),poly([[-.34,-3],[.34,-3],[.34,-2.2],[-.34,-2.2]]),outletPort),-g.casingDepth/2,g.casingDepth/2));
  for(const [shell,width,height] of [[b.inlet.children[0],.78,1.42],[b.outlet.children[0],1.48,.78]]){
    const panels=[-.38,.38].map(z=>{const geometry=new THREE.BoxGeometry(width,height,.06);geometry.translate(0,0,z);return geometry;});
    replace(shell,mergePassageParts(panels));
  }
  // Brown's square block in the lower-right annulus, carried by the rear
  // cover and stopping just short of the wall where the sealing lips run.
  replace(b.abutment,plate([[oldProfile.block]],-.386,g.casingDepth*.45));
  d.solidReview={qualification:'Finite polygon contact closes each vane against Brown\u2019s square abutment block, with a positive closing moment arm and a pocket between rotor cheeks. A prescribed hold and quintic return releases the vane continuously; fluid pressure, return loads and contact forces remain unsolved.',contact:oldProfile};
  finish(root);
}
