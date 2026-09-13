import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate} from './lib/weighted-clutch-distributed-candidate.mjs';
import {makeWeightedClutchKeyEngagementEvents} from './lib/weighted-clutch-key-engagement-events.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-fixed-orbit-following-lift',
  input=process.env.PROBE_INPUT??'artifacts/review/087-fixed-orbit-seating-fine.json',parent=readStudyReport(input),
  holdStep=Number(process.env.PROBE_HOLD_DT??.005),liftStep=Number(process.env.PROBE_LIFT_DT??.0005),horizon=75,
  sources=freezeStudySources([...parent.sources.map(s=>s.file),input,
    'scripts/study-weighted-clutch-fixed-orbit-following-lift.mjs'],prefix),
  model=makeWeightedClutchDistributedCandidate(parent.options),summaries=[];
verifyStudySources(parent.sources);assert(holdStep>0&&liftStep>0&&Number.isFinite(holdStep+liftStep));
for(const branch of parent.summaries){
  assert(branch.settled&&!branch.error);
  const d=makeWeightedClutchKeyEngagementEvents(model,branch.profile,branch.friction,[branch.originalProfile]),
    start=branch.end,rows=[start],events=[];
  let state=start,error=null,nextStud=null,lastKey=start.active.find(c=>c.friction==='axial-key'&&c.impulse>1e-12)?.kind??null;
  try{while(state.time<start.time+horizon&&!(nextStud&&state.time>=nextStud.time+.5-1e-12)){
    const before=state,gap=d.stud.evaluate(state.q[0],d.phase(state.q,state.time).e).gap,
      h=nextStud||gap<.005?liftStep:holdStep,remaining=nextStud?nextStud.time+.5-state.time:start.time+horizon-state.time;
    state=d.advance(state,Math.min(h,remaining));rows.push(state);
    const key=state.active.find(c=>c.friction==='axial-key'&&c.impulse>1e-12)?.kind??null;
    if(key!==lastKey)events.push({kind:key??'key-unloaded',time:state.time,q:state.q,v:state.v});lastKey=key;
    if(!nextStud&&state.active.some(c=>c.kind==='stud'&&c.impulse>1e-12)){
      nextStud=state;events.push({kind:'next-stud',time:state.time,bracket:[before.time,state.time],q:state.q,v:state.v});
      console.log({direction:branch.direction,event:'next-stud',time:state.time,elapsed:state.time-start.time,q:state.q,v:state.v});
    }
    if(rows.length%5000===0)console.log({direction:branch.direction,time:state.time,states:rows.length});
  }}catch(e){error={message:e.message,stack:e.stack};}
  const max=fn=>rows.reduce((n,r)=>Math.max(n,fn(r)),-Infinity),
    summary={direction:branch.direction,side:branch.side,profile:branch.profile,originalProfile:branch.originalProfile,
      friction:branch.friction,holdStep,liftStep,horizon,states:rows.length,parameters:d.parameters,start,end:state,error,nextStud,events,
      elapsed:state.time-start.time,maximumWithdrawal:max(r=>(r.q[2]-start.q[2])*(branch.side==='left'?1:-1)),
      minimumGap:-max(r=>-r.minimumGap),maximumSelectedPriorityVelocitySpread:max(r=>r.selectedPriorityVelocitySpread??0),
      stepHalvings:rows.reduce((n,r)=>n+(r.rejectedSteps?.length??0),0)},file=prefix+'-'+branch.direction+'.json.gz';
  verifyStudySources(sources);
  await writeGzipStudyReport(file,{movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
    sources,options:parent.options,...summary,rows});
  summaries.push({...summary,file});console.log({direction:branch.direction,states:rows.length,error,elapsed:summary.elapsed,
    nextStud:nextStud?.time,maximumWithdrawal:summary.maximumWithdrawal,end:{time:state.time,q:state.q,v:state.v}});
}
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,options:parent.options,input,summaries,
  qualification:'Continuous continuation of the fixed-orbit seated states through held rotation, key load changes and the next stud-driven half-time-unit lift. A smaller step is used near the native stud and after its first loaded encounter. No position, velocity, key preload or input phase is retargeted. Long-held step sensitivity, native clearance and repeated transfers require independent checks.'})+'\n',{flag:'wx'});
assert(summaries.every(s=>!s.error&&s.nextStud&&s.end.time>=s.nextStud.time+.5-1e-12));
