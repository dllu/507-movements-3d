import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate} from './lib/weighted-clutch-distributed-candidate.mjs';
import {makeWeightedClutchKeyEngagementTightStud} from './lib/weighted-clutch-key-engagement-tight-stud.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-fixed-orbit-following-CCW-tight-coarse',
  input='artifacts/review/087-fixed-orbit-following-CCW-fine.json',parent=readStudyReport(input),
  h=Number(process.env.PROBE_DT??.00025),sources=freezeStudySources([...parent.sources.map(s=>s.file),input,
    ...parent.summaries.map(s=>s.file),'scripts/study-weighted-clutch-fixed-orbit-following-tight-stud.mjs',
    'scripts/lib/weighted-clutch-key-engagement-tight-stud.mjs'],prefix),model=makeWeightedClutchDistributedCandidate(parent.options),summaries=[];
verifyStudySources(parent.sources);assert(h>0&&Number.isFinite(h));
for(const branch of parent.summaries){
  assert(!branch.error&&branch.nextStud);
  const original=readStudyReport(branch.file),seedIndex=original.rows.findLastIndex(r=>r.time<=branch.nextStud.time-.25),
    rows=original.rows.slice(0,seedIndex+1),seed=rows.at(-1),events=original.events.filter(e=>e.time<=seed.time),
    d=makeWeightedClutchKeyEngagementTightStud(model,branch.profile,branch.friction,[branch.originalProfile]);
  assert(seedIndex>0&&!seed.active.some(c=>c.kind==='stud'&&c.impulse>1e-12));
  let state=seed,error=null,nextStud=null,lastKey=seed.active.find(c=>c.friction==='axial-key'&&c.impulse>1e-12)?.kind??null;
  try{while(state.time<seed.time+2&&!(nextStud&&state.time>=nextStud.time+.5-1e-12)){
    const before=state;state=d.advance(state,Math.min(h,nextStud?nextStud.time+.5-state.time:seed.time+2-state.time));rows.push(state);
    const key=state.active.find(c=>c.friction==='axial-key'&&c.impulse>1e-12)?.kind??null;
    if(key!==lastKey)events.push({kind:key??'key-unloaded',time:state.time,q:state.q,v:state.v});lastKey=key;
    if(!nextStud&&state.active.some(c=>c.kind==='stud'&&c.impulse>1e-12)){
      nextStud=state;events.push({kind:'next-stud',time:state.time,bracket:[before.time,state.time],q:state.q,v:state.v});
    }
  }}catch(e){error={message:e.message,stack:e.stack};}
  const max=fn=>rows.reduce((n,r)=>Math.max(n,fn(r)),-Infinity),
    summary={...branch,parameters:d.parameters,states:rows.length,end:state,error,nextStud,events,liftStep:h,
      elapsed:state.time-branch.start.time,refinement:{originalFile:branch.file,seedIndex,seedTime:seed.time,
        unchangedPrefixRows:seedIndex+1,newRows:rows.length-seedIndex-1,studVelocityContactTolerance:2e-12},
      maximumWithdrawal:max(r=>(r.q[2]-branch.start.q[2])*(branch.side==='left'?1:-1)),minimumGap:-max(r=>-r.minimumGap),
      maximumSelectedPriorityVelocitySpread:max(r=>r.selectedPriorityVelocitySpread??0)},file=prefix+'-'+branch.direction+'.json.gz';
  delete summary.file;verifyStudySources(sources);
  await writeGzipStudyReport(file,{movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources,options:parent.options,...summary,rows});
  summaries.push({...summary,file});console.log({direction:branch.direction,h,states:rows.length,error,nextStud:nextStud?.time,
    refinement:summary.refinement,end:{time:state.time,q:state.q,v:state.v}});
}
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,options:parent.options,input,summaries,
  qualification:'Reuses the verified fine held prefix without changing its last state, then recomputes the following lift with stud velocity impulses restricted to gaps at most 2e-12. The former tolerance could apply a sizeable recontact impulse while still positively separated. No position, velocity, phase or key preload is reset; original results and the failed complementarity check remain retained. Local step sensitivity is checked separately.'})+'\n',{flag:'wx'});
assert(summaries.every(s=>!s.error&&s.nextStud&&s.end.time>=s.nextStud.time+.5-1e-12));
