import fs from 'node:fs';
import * as THREE from 'three';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
import {irregularCircularProfile} from '../src/simulation/irregular-gear-family.js';
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')).movements;
const model=id=>createAuthoredGearMovement(catalog[id-1]);
const xy=p=>[p.x,p.y];
const shape=mesh=>{const s=mesh.geometry.parameters.shapes;return {outline:s.extractPoints(64).shape.map(xy),buffer:mesh.geometry.parameters.options.bevelSize??0};};
const result=[];
// IRREGULAR_IDS=201 regenerates a subset; the Python pass keeps the other baked profiles.
const ids=(process.env.IRREGULAR_IDS??'191,196,201').split(',').map(Number);
for(const id of ids){
 const m=model(id),u=m.root.userData,b=u.blocks,g=u.geometry;
 const period=u.transmission.cyclePeriod??u.transmission.inputCyclePeriod;
 let a,bb,blank,cutters;
 if(id===191){a=b.driven;bb=b.driver;blank=u.profileGenerationBlank??[shape(b.drivenBody),...b.drivenTeeth.map(shape)];cutters=[shape(b.driverBody),...b.driverTeeth.map(shape)];}
 if(id===196){a=b.wheel;bb=b.pinion;const profile=irregularCircularProfile(g.pinionPitchRadius,g.pinionTeeth,g.wheelDepth,.070);cutters=[{outline:profile.userData.outline.map(p=>{const angle=-Math.PI/(2*g.pinionTeeth);return[p.x*Math.cos(angle)-p.y*Math.sin(angle),p.x*Math.sin(angle)+p.y*Math.cos(angle)];}),buffer:0}];blank=[{outline:Array.from({length:1024},(_,i)=>{const p=u.profileAtParameter(g.sourceProfileParameter+i*2*Math.PI/1024);return xy(p.pitchPoint.clone().addScaledVector(p.outwardNormal,.85*g.module));}),buffer:0}];}
 // 201: the actual rendered pinion rolls round the addendum blank of the
 // traced pitch curve and cuts the driver's teeth.
 if(id===201){a=b.eccentricGear;bb=b.pinion;const drive=u.transmission.irregularDrive;blank=[{outline:drive.blankOutline(4096).map(xy),buffer:0}];cutters=[{outline:drive.pinionOutline.map(xy),buffer:0}];}
 const poseAt=time=>{m.update(time);m.root.updateMatrixWorld(true);const mat=a.userData.rotor.matrixWorld.clone().invert().multiply(bb.userData.rotor.matrixWorld),e=mat.elements;return[e[0],e[4],e[1],e[5],e[12],e[13]];};
 // 191: both scrolls are hobbed by one straight-sided rack rolling along
 // their pitch spirals (slightly past each seam), so the two tooth forms are
 // conjugate and match; the Python pass clips each rack pose to its own side
 // of the stepped seam.
 const rack=id===191?(()=>{const C=g.centerDistance,a=g.minimumDriverRadius,k=g.radialSlope,span=.7,count=6001;
  const phis=Array.from({length:count},(_,i)=>-span+i*(2*Math.PI+2*span)/(count-1));
  const driver=phis.map(phi=>{const r=a+k*phi,t=-Math.PI/2+phi;return[r*Math.cos(t),r*Math.sin(t)];});
  const driven=phis.map(phi=>{const r=C-a-k*phi,t=Math.PI/2+phi-C/k*Math.log((C-a)/(C-a-k*phi));return[r*Math.cos(t),r*Math.sin(t)];});
  return{phis,driver,driven,pitch:g.circularPitch,addendum:g.addendum,dedendum:g.dedendum,perimeter:g.pitchPerimeter};})():undefined;
 result.push({id,rack,period,bore:id===191?g.boreRadius:id===196?g.boreRadius:.13,depth:id===196?g.wheelDepth:.34,blank,cutters,poses:Array.from({length:id===196?2049:8193},(_,i)=>poseAt(period*i/(id===196?2048:8192))),auditPoses:Array.from({length:129},(_,i)=>poseAt(period*(i+.37)/129))});
}
fs.writeFileSync('/dev/shm/irregular-profile-input.json',JSON.stringify(result));
