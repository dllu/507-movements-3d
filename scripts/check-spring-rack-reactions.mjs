import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeSpringRackCandidate} from './lib/spring-rack-candidate.mjs';
import {renderedPrism,boundaryCone} from './lib/crossed-rack-mesh-prisms.mjs';
import {rotate} from '../src/simulation/finite-plate-geometry.js';
const input=process.env.PROBE_INPUT??'artifacts/review/081-interval-finer-dynamics.json',prefix=process.env.PROBE_PREFIX??'artifacts/review/081-finer-reactions',
 data=JSON.parse(fs.readFileSync(input)),candidate=makeSpringRackCandidate(data.geometry),u=candidate.root.userData,p=u.geometry,
 prisms=Object.fromEntries(['workingGear','slottedRackRearWall','fixedTravelStopPin',...Array.from({length:7},(_,i)=>'rackTooth'+i)]
  .map(name=>[name,renderedPrism(u.parts[name].geometry)])),issues=[];
assert.equal(data.failures.length,0);
let checked=0,gearContacts=0,stopContacts=0,maximumBoundaryDistance=0,maximumConeError=0,maximumJacobianError=0,maximumSeparation=0;
for(const [index,row]of data.rows.entries())for(const c of row.diagnostic?.contacts??[]){
 let first,second,A,B,n,m,jacobianError=0;
 if(c.key==='gear-rack'){
  const tooth=Number(c.id.match(/R(\d+)/)[1]),angle=p.gearPhase+row.q;
  first=prisms.workingGear;second=prisms['rackTooth'+tooth];
  A=rotate(c.gearPoint,-angle);B=[c.rackPoint[0],c.rackPoint[1]-row.x[0]];
  n=rotate(c.normal,-angle);m=c.normal.map(v=>-v);
  maximumSeparation=Math.max(maximumSeparation,Math.hypot(c.gearPoint[0]-c.rackPoint[0],c.gearPoint[1]-c.rackPoint[1]));
  const inputJ=-c.gearPoint[0]*c.normal[1]+c.gearPoint[1]*c.normal[0];
  jacobianError=Math.max(Math.abs(c.J[0]-c.normal[1]),Math.abs(c.inputNormalVelocity+data.parameters.omega*inputJ));gearContacts++;
 }else{
  assert(['lower-stop','upper-stop'].includes(c.key));const sign=c.key==='lower-stop'?1:-1,
   pin=u.parts.fixedTravelStopPin.position,radius=p.stop.pinRadius/p.source.scale;
  first=prisms.fixedTravelStopPin;second=prisms.slottedRackRearWall;
  A=[0,sign*radius];B=[pin.x,pin.y+sign*radius-row.x[0]];n=[0,sign];m=[0,-sign];
  jacobianError=Math.max(Math.abs(c.J[0]-sign),Math.abs(c.inputNormalVelocity));stopContacts++;
 }
 assert(Math.max(first.low,second.low)<Math.min(first.high,second.high),'Actual depth overlap at the reaction');
 const a=boundaryCone(first,A,n),b=boundaryCone(second,B,m);
 maximumBoundaryDistance=Math.max(maximumBoundaryDistance,a.distance,b.distance);
 maximumConeError=Math.max(maximumConeError,a.residual,b.residual);maximumJacobianError=Math.max(maximumJacobianError,jacobianError);checked++;
 if(c.impulse<0||a.distance>2e-7||b.distance>2e-7||a.residual>2e-5||b.residual>2e-5||jacobianError>2e-6)
  issues.push({index,time:row.time,id:c.id,impulse:c.impulse,A,B,n,m,a,b,jacobianError});
}
const sources=['scripts/check-spring-rack-reactions.mjs','scripts/lib/crossed-rack-mesh-prisms.mjs','scripts/lib/spring-rack-candidate.mjs',
 'scripts/lib/spring-rack-source.mjs','scripts/lib/spring-rack-coil.mjs',input].map((file,i)=>{
 const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
 return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const report={movement:81,status:'actual-mesh-contact-reaction-study',productionChanged:false,mechanicsPassed:false,
 passed:checked>0&&issues.length===0&&maximumSeparation<2e-7,checked,gearContacts,stopContacts,maximumBoundaryDistance,maximumConeError,
 maximumJacobianError,maximumSeparation,issues,prisms:Object.fromEntries(Object.entries(prisms).map(([k,p])=>[k,p.validation])),sources,
 qualification:'Every positive recorded reaction is checked against independent cap/side reconstructions of actual Float32 gear, rack, slot and pin meshes. Both boundary distances, both outward normal cones, layer overlap and rack/input Jacobians are checked. Complete interpolation clearance and time-step accuracy remain separate requirements.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,issues:issues.slice(0,5),sources:undefined,prisms:undefined});
if(!report.passed)process.exitCode=1;
