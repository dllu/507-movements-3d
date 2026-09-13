import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate} from './lib/weighted-clutch-distributed-candidate.mjs';
import {makeWeightedClutchKeyEngagementEvents} from './lib/weighted-clutch-key-engagement-events.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-fixed-orbit-seating-coarse',
 impactFile='artifacts/review/087-fixed-orbit-jaw-impact.json',impact=readStudyReport(impactFile),
 profileFile=process.env.PROBE_PROFILES??'artifacts/review/087-fixed-orbit-jaw-profiles-pruned.json',profiles=readStudyReport(profileFile),
 neutralFile='artifacts/review/087-fixed-orbit-transfer-fine.json',neutral=readStudyReport(neutralFile),
 h=Number(process.env.PROBE_DT??.001),horizon=Number(process.env.PROBE_HORIZON??12),
 sources=freezeStudySources([...profiles.sources.map(s=>s.file),...impact.sources.map(s=>s.file),impactFile,profileFile,neutralFile,
  'scripts/lib/weighted-clutch-key-engagement-events.mjs','scripts/study-weighted-clutch-fixed-orbit-seating.mjs'],prefix),
 model=makeWeightedClutchDistributedCandidate(impact.options),summaries=[];
verifyStudySources(profiles.sources);verifyStudySources(impact.sources);verifyStudySources(neutral.sources);assert(h>0&&horizon>0&&Number.isFinite(h+horizon));
for(const first of impact.rows.filter(r=>profiles.profiles.some(p=>p.direction===r.direction))){
 const profile=profiles.profiles.find(p=>p.direction===first.direction),
  d=makeWeightedClutchKeyEngagementEvents(model,profile,first.friction,[first.originalProfile]),
  incoming=neutral.summaries.find(s=>s.direction===first.direction).end,E=d.energy(first.q,first.velocityAfter),
  jumpDefect=E-incoming.energy-first.impact.work+first.impact.loss,
  initial={...incoming,v:first.velocityAfter,energy:E,active:first.impact.active,phase:d.phase(first.q,first.time),
   work:incoming.work+first.impact.work,loss:incoming.loss+first.impact.loss,
   defect:incoming.defect+jumpDefect,absoluteDefect:incoming.absoluteDefect+Math.abs(jumpDefect),newJawImpact:true},
  rows=[initial],events=[],sign=first.side==='left'?1:-1;
 assert.deepEqual(first.q,incoming.q);assert.equal(first.time,incoming.time);assert.deepEqual(first.velocityBefore,incoming.v);
 let state=initial,error=null,seat=null;
 const seated=r=>Math.abs(r.phase.relative-profile.peak.angle)<1e-8&&Math.abs(profile.peak.gap+sign*r.q[2])<1e-8&&
  Math.max(...r.v.slice(0,3).map(Math.abs))<1e-7&&Math.max(...r.v.slice(3).map(v=>Math.abs(v-d.parameters.omegaOutput)))<1e-6;
 try{while(state.time<initial.time+horizon&&!(seat&&state.time>seat.time+.25)){
  state=d.advance(state,h);rows.push(state);
  if(state.seatingCornerImpact)events.push({kind:'jaw-corner',side:state.cornerSide,time:state.time,q:state.q,v:state.v});
  if(seated(state)){
   if(!seat){seat=state;events.push({kind:'seat-candidate',time:state.time,q:state.q,v:state.v});}
  }else if(seat){events.push({kind:'seat-departure',time:state.time,q:state.q,v:state.v});seat=null;}
 }}catch(e){error={message:e.message,stack:e.stack};}
 const summary={direction:first.direction,side:first.side,h,horizon,states:rows.length,parameters:d.parameters,profile,originalProfile:first.originalProfile,friction:first.friction,
  start:initial,end:state,error,seat,events,settled:!!seat&&state.time>seat.time+.25,
  minimumGap:Math.min(...rows.map(r=>r.minimumGap)),
  maximumSelectedPriorityVelocitySpread:Math.max(...rows.map(r=>r.selectedPriorityVelocitySpread??0)),
  maximumTransportPriorityVelocitySpread:Math.max(...rows.map(r=>r.transportPriorityVelocitySpread??0)),
  jumpDefect,elapsed:state.time-initial.time},file=prefix+'-'+first.direction+'.json.gz';
 verifyStudySources(sources);await writeGzipStudyReport(file,{movement:87,productionChanged:false,mechanicsPassed:false,candidateIntegrated:false,options:impact.options,sources,...summary,rows});
 summaries.push({...summary,file});console.log({direction:first.direction,side:first.side,states:rows.length,error,settled:summary.settled,
  elapsed:summary.elapsed,seat:seat?{time:seat.time,q:seat.q,v:seat.v}:null,end:{time:state.time,q:state.q,v:state.v,phase:state.phase},
  corners:events.filter(e=>e.kind==='jaw-corner').length});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,candidateIntegrated:false,options:impact.options,sources,summaries,
 qualification:'Opposite-jaw engagement after continuously connected key-friction lifting, withdrawal, neutral travel and native first impact. Both jaws, actual feather clearance, static/sliding friction, output gravity and native-cusp events remain active. Reported seating is an observed state sustained for .25 time units, not a constraint. Finite-horizon, profile-range and non-seating outcomes are retained.'})+'\n',{flag:'wx'});
assert(summaries.every(s=>!s.error));
