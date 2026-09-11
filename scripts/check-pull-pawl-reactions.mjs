import fs from 'node:fs';
import crypto from 'node:crypto';
import {makePullPawlCandidate} from './lib/pull-pawl-candidate.mjs';
import {makePullPawlDynamics} from './lib/pull-pawl-dynamics-study.mjs';
import {planarContactSurface,forceInNormalCone} from './lib/planar-contact-surface.mjs';
const file='artifacts/review/078-amplitude-038-finest.json',data=JSON.parse(fs.readFileSync(file)),candidate=makePullPawlCandidate(data.geometry),
 physics=makePullPawlDynamics(candidate,data.parameters),gapTolerance=1e-7,angleTolerance=1e-5,
 profiles=Object.fromEntries(Object.entries(physics.contact.profiles).map(([key,p])=>[key,planarContactSurface(p.points,{gapTolerance})])),
 rotate=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)],sub=(a,b)=>a.map((v,i)=>v-b[i]),
 totals={left:{contacts:0,impulse:0,wheelAngularImpulse:0,clockwiseWork:0,counterclockwiseWork:0},right:{contacts:0,impulse:0,wheelAngularImpulse:0,clockwiseWork:0,counterclockwiseWork:0}},
 failures=[],counts={states:0,contacts:0,boundaryChecks:0,coneChecks:0,failedBoundary:0,failedCone:0};
let maximumGap=0;
const fail=(reason,detail)=>{if(failures.length<30)failures.push({reason,...detail});};
for(const state of data.rows.slice(1)){
 counts.states++;if(!state.contacts.length)continue;const contacts=new Map(physics.constraints(state.x,state.time).rows.map(row=>[row.id,row]));
 for(const contact of state.contacts){
  counts.contacts++;const row=contacts.get(contact.id);if(!row){counts.failedBoundary++;fail('missing-contact',{time:state.time,id:contact.id});continue;}
  const key=row.key,index=key==='left'?1:2,P=physics.input(state.time).pawls[key].pivot,
   samples=[{key:'wheel',point:rotate(row.wheelPoint,-state.x[0]),force:rotate(row.normal,-state.x[0])},
    {key,point:rotate(sub(row.pawlPoint,P),-state.x[index]),force:rotate(row.normal.map(v=>-v),-state.x[index])}];
  for(const sample of samples){
   counts.boundaryChecks++;counts.coneChecks++;let boundary=false,cone=false;
   profiles[sample.key].near(sample.point,f=>{boundary=true;if(forceInNormalCone(sample.force,f.normals,angleTolerance))cone=true;});
   if(!boundary){counts.failedBoundary++;fail('point-not-on-boundary',{time:state.time,id:contact.id,body:sample.key,point:sample.point});}
   if(!cone){counts.failedCone++;fail('reaction-outside-normal-cone',{time:state.time,id:contact.id,body:sample.key,point:sample.point,force:sample.force});}
  }
  maximumGap=Math.max(maximumGap,Math.abs(row.gap));const t=totals[key],angularImpulse=row.J[0]*contact.impulse,work=angularImpulse*state.v[0];
  t.contacts++;t.impulse+=contact.impulse;t.wheelAngularImpulse+=angularImpulse;if(angularImpulse<0)t.clockwiseWork+=work;else t.counterclockwiseWork+=work;
 }
}
const files=[file,'scripts/check-pull-pawl-reactions.mjs','scripts/lib/pull-pawl-candidate.mjs','scripts/lib/pull-pawl-dynamics-study.mjs','scripts/lib/pull-pawl-contact-study.mjs','scripts/lib/planar-contact-surface.mjs'],
 report={movement:78,status:'finite-surface-reaction-cone-check',productionChanged:false,mechanicsPassed:false,passed:!counts.failedBoundary&&!counts.failedCone,
 gapTolerance,angleTolerance,counts,maximumGap,totals,failures,
 qualification:'Every positive normal impulse recorded in the finest trajectory is reconstructed at its two actual finite profile boundaries. An independent edge/vertex normal-cone query checks the wheel force direction and the opposite pawl direction. Work and angular impulse totals identify which pawl drives the wheel. This checks discrete contact reactions; continuous playback geometry is covered by separate bounds.',
 sources:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('artifacts/review/078-reaction-cones.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({passed:report.passed,counts,maximumGap,totals,failures});if(!report.passed)process.exitCode=1;
