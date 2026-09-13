import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate} from './lib/weighted-clutch-distributed-candidate.mjs';
import {makeWeightedClutchKeyEngagementTightStud} from './lib/weighted-clutch-key-engagement-tight-stud.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const direction=process.env.PROBE_DIRECTION??'CW',
  prefix=process.env.PROBE_PREFIX??'artifacts/review/087-fixed-orbit-next-measured-'+direction+'-coarse',
  input=process.env.PROBE_INPUT??'artifacts/review/087-fixed-orbit-following-'+direction+(direction==='CCW'?'-tight-fine.json':'-fine.json'),
  parent=readStudyReport(input),branch=parent.summaries.find(s=>s.direction===direction),
  profilesFile='artifacts/review/087-fixed-orbit-jaw-profiles-pruned.json',profiles=readStudyReport(profilesFile),
  extraFile=process.env.PROBE_PROFILES??'artifacts/review/087-next-jaw-profile-'+direction+'.json',extra=readStudyReport(extraFile),
  resumeFile=process.env.PROBE_RESUME_FROM,resume=resumeFile?readStudyReport(resumeFile):null,
  h=Number(process.env.PROBE_DT??.001),horizon=Number(process.env.PROBE_HORIZON??15),
  sources=freezeStudySources([...parent.sources.map(s=>s.file),...profiles.sources.map(s=>s.file),input,branch.file,profilesFile,extraFile,...extra.sources.map(s=>s.file),...(resume?[resumeFile,...resume.sources.map(s=>s.file)]:[]),
    'scripts/study-weighted-clutch-fixed-orbit-next-measured.mjs','scripts/lib/weighted-clutch-key-engagement-tight-stud.mjs'],prefix),
  model=makeWeightedClutchDistributedCandidate(parent.options),otherProfiles=[branch.originalProfile,...profiles.profiles.filter(p=>p.side!==branch.side),...extra.profiles],
  d=makeWeightedClutchKeyEngagementTightStud(model,branch.profile,branch.friction,otherProfiles),
  start=branch.end,rows=resume?resume.rows.slice():[start],events=resume?resume.events.slice():[],side=branch.side==='left'?'right':'left',
  sign=branch.side==='left'?-1:1,farSlot=branch.side==='left'?'slot-upper':'slot-lower',
  outputSpeed=side==='left'?-.12:.12,tau=2*Math.PI;
verifyStudySources(parent.sources);verifyStudySources(profiles.sources);verifyStudySources(extra.sources);
if(resume){verifyStudySources(resume.sources);assert.deepEqual(resume.start,start);assert(resume.error?.message.startsWith('Unmeasured potentially contacting'));assert.equal(resume.h,h);}
assert(!branch.error&&branch.nextStud&&h>0&&horizon>0&&Number.isFinite(h+horizon));
assert.equal(start.phase.input,d.phase(start.q,start.time).input);
const loaded=(r,kind)=>r.active.some(c=>c.kind===kind&&c.impulse>1e-12),
  contact=r=>r.active.some(c=>c.kind.startsWith('jaw-'+side+'-')&&c.impulse>1e-12),
  seated=r=>d.tables.filter(t=>t.profile.side===side).find(t=>{
    const peak=t.profile.peak,delta=r.phase.relativeJaws[side],turns=Math.round((delta-peak.angle)/tau);
    return Math.abs(delta-peak.angle-turns*tau)<1e-8&&Math.abs(peak.gap+(side==='left'?1:-1)*r.q[2])<1e-8&&
      Math.max(...r.v.slice(0,3).map(Math.abs))<1e-7&&Math.max(...r.v.slice(3).map(v=>Math.abs(v-outputSpeed)))<1e-6;
  });
let state=rows.at(-1),error=null,seat=null,seatProfile=null,lastStud=loaded(rows.at(-1),'stud');
try{while(state.time<start.time+horizon-1e-12&&!(seat&&state.time>=seat.time+.25-1e-12)){
  const before=state;state=d.advance(state,Math.min(h,start.time+horizon-state.time));rows.push(state);
  const event=kind=>events.push({kind,time:state.time,bracket:[before.time,state.time],q:state.q,v:state.v}),stud=loaded(state,'stud');
  if(stud!==lastStud)event(stud?'stud-contact':'stud-release');lastStud=stud;
  if(!events.some(e=>e.kind==='weight-over-center')&&sign*(state.q[0]-model.root.userData.linkage.parameters.overCenterAngle)>=0)event('weight-over-center');
  if(!events.some(e=>e.kind==='far-slot')&&loaded(state,farSlot))event('far-slot');
  if(!events.some(e=>e.kind==='withdrawal-threshold')&&(state.q[2]-start.q[2])*(branch.side==='left'?1:-1)>.002)event('withdrawal-threshold');
  if(!events.some(e=>e.kind==='opposite-jaw-loaded')&&contact(state))event('opposite-jaw-loaded');
  const table=seated(state);
  if(table){if(!seat){seat=state;seatProfile=table.profile;event('seat-candidate');}}
  else if(seat){event('seat-departure');seat=null;seatProfile=null;}
  if(rows.length%5000===0)console.log({direction,time:state.time,states:rows.length,q:state.q});
}}catch(e){error={message:e.message,stack:e.stack};}
const file=prefix+'-'+direction+'.json.gz',summary={direction,fromSide:branch.side,side,h,horizon,states:rows.length,
  profile:branch.profile,otherProfiles,resume:resume?{file:resumeFile,unchangedPrefixRows:resume.rows.length,time:resume.end.time}:null,friction:branch.friction,parameters:d.parameters,start,end:state,error,events,seat,seatProfile,
  settled:!!seat&&state.time>=seat.time+.25-1e-12,minimumGap:rows.reduce((m,r)=>Math.min(m,r.minimumGap),Infinity),
  maximumWithdrawal:rows.reduce((m,r)=>Math.max(m,(r.q[2]-start.q[2])*(branch.side==='left'?1:-1)),0)};
verifyStudySources(sources);
await writeGzipStudyReport(file,{movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,options:parent.options,...summary,rows});
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,options:parent.options,input,summaries:[{...summary,file}],
  qualification:'Continues the exact integrated following-lift endpoint through the next transfer with both jaw sides and strict stud velocity activation. Freshly measured next-tooth profiles supplement the earlier native profiles, reused only modulo full turns; missing near-contact phases stop the run. Optional coarse continuation retains the exact stopped prefix. No physical state or motor phase is reset. Seating is observed and sustained, not imposed. Step, native-contact, energy and rendered-clearance checks remain separate.'})+'\n',{flag:'wx'});
console.log({direction,h,states:rows.length,error,settled:summary.settled,seat:seat?.time,end:{time:state.time,q:state.q,v:state.v},events:events.filter(e=>!e.kind.startsWith('stud-'))});
assert(!error&&summary.settled);
