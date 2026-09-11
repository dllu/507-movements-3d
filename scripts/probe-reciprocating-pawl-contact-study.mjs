import { writeFile } from 'node:fs/promises';
import { makeReciprocatingPawlStudy, pawlLoadIntervals } from './lib/reciprocating-pawl-contact-study.mjs';

const study=makeReciprocatingPawlStudy(),rows=[];
for(let i=0;i<193;i++){
  const phase=(i+.371)/193,state=study.atPhase(phase);
  rows.push({phase,state});
}
const trials=[];
for(const holdingMassFactor of [.02,.05,.1,.2,.5,1,2]){
  const intervals=[];
  for(const row of rows){const state={...row.state,H:{...row.state.H,gravityMoment:row.state.H.gravityMoment*holdingMassFactor}};
    const options=pawlLoadIntervals(state);intervals.push({phase:row.phase,countB:state.B.contacts.length,countH:state.H.contacts.length,
      low:Math.min(...options.map(q=>q.low)),high:Math.max(...options.map(q=>q.high)),empty:!options.length});}
  const extrema=list=>({low:Math.max(...list.map(q=>q.low)),high:Math.min(...list.map(q=>q.high)),
    lowWitness:list.reduce((a,b)=>a.low>b.low?a:b),highWitness:list.reduce((a,b)=>a.high<b.high?a:b)});
  trials.push({holdingMassFactor,full:extrema(intervals),drive:extrema(intervals.filter(r=>r.phase<.5)),
    return:extrema(intervals.filter(r=>r.phase>.5)),intervals});
}
const report={movement:75,status:'isolated-pawl-contact-force-study',productionChanged:false,parameters:study.parameters,rows,trials,
  qualification:'Circular working noses contact the complete reconstructed polygonal wheel. Both gravity-closing pawls follow the first contact reached from an open pose; seated noses admit two separate normal reactions. Three equilibrium equations require nonnegative reactions for both pawls and the wheel. Output load is an externally applied counterclockwise resisting torque. Mass-factor trials investigate whether a single constant load can support the prescribed drive and dwell. Full body outlines, 3D hardware, inertia and source-fit acceptance remain pending.'};
await writeFile('artifacts/review/075-initial-contact-force-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(trials.map(t=>({factor:t.holdingMassFactor,full:[t.full.low,t.full.high],drive:[t.drive.low,t.drive.high],return:[t.return.low,t.return.high],
  lowPhase:t.full.lowWitness.phase,highPhase:t.full.highWitness.phase})));
