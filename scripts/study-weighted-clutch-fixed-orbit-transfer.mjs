import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate} from './lib/weighted-clutch-distributed-candidate.mjs';
import {makeWeightedClutchKeyNeutral} from './lib/weighted-clutch-key-neutral.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-fixed-orbit-transfer-coarse',
  input=process.env.PROBE_INPUT??'artifacts/review/087-fixed-orbit-lift-fine.json',parent=readStudyReport(input),
  geometryFile='artifacts/review/087-first-fixed-orbit-geometry.json',geometry=readStudyReport(geometryFile),
  h=Number(process.env.PROBE_DT??.001),horizon=Number(process.env.PROBE_HORIZON??15),
  sources=freezeStudySources([...parent.sources.map(s=>s.file),...geometry.sources.map(s=>s.file),input,geometryFile,
    ...parent.summaries.map(s=>s.file),'scripts/study-weighted-clutch-fixed-orbit-transfer.mjs',
    'scripts/lib/weighted-clutch-key-neutral.mjs','scripts/lib/weighted-clutch-jaw-bound.mjs'],prefix),
  model=makeWeightedClutchDistributedCandidate(parent.options),summaries=[];
verifyStudySources(parent.sources);verifyStudySources(geometry.sources);
assert(h>0&&horizon>0&&Number.isFinite(h+horizon));
for(const branch of parent.summaries){
  const original=readStudyReport(branch.file),profile=original.profile,
    friction={staticCoefficient:branch.staticCoefficient,kineticCoefficient:branch.kineticCoefficient},
    d=makeWeightedClutchKeyNeutral(model,profile,friction),start=branch.end,rows=[start],events=[],
    sign=branch.direction==='CCW'?1:-1,farSlot=branch.side==='left'?'slot-upper':'slot-lower',
    loaded=(row,kind)=>row.active.some(c=>c.kind===kind&&c.impulse>1e-12);
  let state=start,error=null,withdrawal=0,lastStud=loaded(start,'stud'),lastKey=start.active.find(c=>c.friction==='axial-key')?.kind??null;
  assert.equal(branch.staticCoefficient,.78);assert(!branch.error);
  try{while(state.time<start.time+horizon-1e-12&&!state.oppositeJawImpact){
    const before=state;state=d.advance(state,Math.min(h,start.time+horizon-state.time));rows.push(state);
    withdrawal=(state.q[2]-start.q[2])*(branch.side==='left'?1:-1);
    const stud=loaded(state,'stud'),key=state.active.find(c=>c.friction==='axial-key'&&c.impulse>1e-12)?.kind??null,
      event=kind=>events.push({kind,time:state.time,bracket:[before.time,state.time],q:state.q,v:state.v});
    if(stud!==lastStud)event(stud?'stud-contact':'stud-release');lastStud=stud;
    if(key!==lastKey)event(key??'key-unloaded');lastKey=key;
    if(!events.some(e=>e.kind==='weight-over-center')&&sign*(state.q[0]-model.root.userData.linkage.parameters.overCenterAngle)>=0)event('weight-over-center');
    if(!events.some(e=>e.kind==='far-slot')&&loaded(state,farSlot))event('far-slot');
    if(!events.some(e=>e.kind==='axial-release')&&withdrawal>1e-7)event('axial-release');
    if(!events.some(e=>e.kind==='withdrawal-threshold')&&withdrawal>=.002)event('withdrawal-threshold');
    if(state.oppositeJawImpact)event('opposite-jaw');
    if(rows.length%5000===0)console.log({direction:branch.direction,time:state.time,q:state.q,withdrawal,states:rows.length});
  }}catch(e){error={message:e.message,stack:e.stack};}
  const max=fn=>rows.reduce((m,r)=>Math.max(m,fn(r)),-Infinity),
    summary={direction:branch.direction,side:branch.side,h,horizon,states:rows.length,parameters:d.parameters,profile,friction,
      start,end:state,error,events,withdrawal,nativeQueries:d.nativeQueries,
      maximumSelectedPriorityVelocitySpread:max(r=>r.selectedPriorityVelocitySpread??0),
      maximumTransportPriorityVelocitySpread:max(r=>r.transportPriorityVelocitySpread??0),minimumGap:-max(r=>-r.minimumGap)},
    file=prefix+'-'+branch.direction+'.json.gz';
  verifyStudySources(sources);
  await writeGzipStudyReport(file,{movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
    sources,options:parent.options,...summary,rows});
  summaries.push({...summary,file});console.log({direction:branch.direction,states:rows.length,error,time:state.time,q:state.q,v:state.v,
    withdrawal,nativeQueries:d.nativeQueries,events:events.filter(e=>['weight-over-center','far-slot','axial-release','opposite-jaw'].includes(e.kind))});
}
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,options:parent.options,input,summaries,
  qualification:'Continues the fixed-orbit candidate from the previously checked initial-lift states through lifting, release and neutral travel to first native opposite-jaw contact. Five coordinates and the input clock are preserved without reassignment. The opposite native jaw terminates the pre-impact stage; its impulse, seating and repeated cycles are subsequent work. Material, source proportions, continuous clearance and final speed remain unresolved.'})+'\n',{flag:'wx'});
assert(summaries.every(s=>!s.error&&s.end.oppositeJawImpact&&Math.abs(s.end.oppositeJaw.gap)<1e-9));
