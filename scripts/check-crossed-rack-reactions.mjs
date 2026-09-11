import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {makeCrossedRackCandidate} from './lib/crossed-rack-candidate.mjs';
import {makeCrossedRackDynamics} from './lib/crossed-rack-dynamics-study.mjs';
import {renderedPrism,boundaryCone} from './lib/crossed-rack-mesh-prisms.mjs';
import {sub,rotate} from '../src/simulation/finite-plate-geometry.js';
const input=process.env.PROBE_INPUT??'artifacts/review/080-amplitude016-finest-dynamics.json',prefix=process.env.PROBE_PREFIX??'artifacts/review/080-finest-reactions',
 data=JSON.parse(fs.readFileSync(input)),candidate=makeCrossedRackCandidate(data.geometry),u=candidate.root.userData,
 physics=makeCrossedRackDynamics(candidate,data.parameters),prisms=Object.fromEntries(['rack','left','right'].map(k=>[k,renderedPrism(u.parts[k==='rack'?'slottedRack':k+'HookWeb'].geometry)])),
 issues=[],sources=['scripts/check-crossed-rack-reactions.mjs','scripts/lib/crossed-rack-mesh-prisms.mjs','scripts/lib/crossed-rack-dynamics-study.mjs',
 'scripts/lib/crossed-rack-contact-study.mjs','scripts/lib/crossed-rack-candidate.mjs','scripts/lib/crossed-rack-source.mjs',input].map((file,i)=>{
  const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);return{file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
 });
assert.equal(data.failures.length,0);assert.equal(data.rows.length,Math.round(data.duration/data.dt)+1);
for(const p of Object.values(prisms))assert(p.low<0&&p.high>0,'Reaction plane inside actual prism');
let checked=0,maximumSeparation=0,maximumBoundaryDistance=0,maximumConeError=0,maximumJacobianError=0,missing=0;
for(const [index,state]of data.rows.entries()){
 if(!state.contacts?.length)continue;
 const k=physics.input(state.time),rows=new Map(physics.constraints(state.x,state.time).rows.map(r=>[r.id,r]));
 for(const reaction of state.contacts){
  const r=rows.get(reaction.id);if(!r){missing++;issues.push({index,time:state.time,id:reaction.id,reason:'missing-contact-row'});continue;}
  const coordinate=r.key==='left'?1:2,alpha=state.x[coordinate],P=k.pawls[r.key].pivot,
   rackPoint=[r.rackPoint[0],r.rackPoint[1]-state.x[0]],pawlPoint=rotate(sub(r.pawlPoint,P),-alpha),
   outwardPawn=rotate(r.normal.map(v=>-v),-alpha),rack=boundaryCone(prisms.rack,rackPoint,r.normal),pawn=boundaryCone(prisms[r.key],pawlPoint,outwardPawn),
   separation=Math.hypot(...sub(r.pawlPoint,r.rackPoint)),arm=sub(r.pawlPoint,P),J=[-r.normal[1],arm[0]*r.normal[1]-arm[1]*r.normal[0]],
   jacobianError=Math.max(Math.abs(J[0]-r.J[0]),Math.abs(J[1]-r.J[coordinate]));
  checked++;maximumSeparation=Math.max(maximumSeparation,separation);maximumBoundaryDistance=Math.max(maximumBoundaryDistance,rack.distance,pawn.distance);
  maximumConeError=Math.max(maximumConeError,rack.residual,pawn.residual);maximumJacobianError=Math.max(maximumJacobianError,jacobianError);
  if(separation>2e-7||rack.distance>2e-7||pawn.distance>2e-7||rack.residual>2e-5||pawn.residual>2e-5||jacobianError>2e-6){
   const issue={index,time:state.time,id:r.id,impulse:reaction.impulse,gap:r.gap,separation,rack,pawn,jacobianError,rackPoint,pawlPoint,normal:r.normal};issues.push(issue);
   if(issues.length<=10)console.log({issue});
  }
 }
 if(index%10000===0)console.log({index,checked,issues:issues.length});
}
const passed=issues.length===0&&checked>0,report={movement:80,status:'actual-mesh-contact-reactions',productionChanged:false,mechanicsPassed:false,passed,
 completeTrajectory:true,checked,missing,maximumSeparation,maximumBoundaryDistance,maximumConeError,maximumJacobianError,issues,
 prisms:Object.fromEntries(Object.entries(prisms).map(([k,p])=>[k,p.validation])),sources,
 qualification:'Every recorded positive impulse is checked at z=0 against the boundary and outward normal cones of the actual Float32 rendered prisms, including the rack slot. Cap incidence, both cap areas, depth levels and all outward side triangles are independently checked. Contact moment arms must agree. This does not establish interpolated collision clearance or energy balance.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,issues:issues.slice(0,3),sources:undefined});if(!passed)process.exitCode=1;
