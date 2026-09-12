import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchIndependentCandidate} from './lib/weighted-clutch-independent-candidate.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-seating-profile',
 tolerance=Number(process.env.PROBE_TOLERANCE??2e-7),input='artifacts/review/087-first-gravity-jaw-impact.json',
 parent=readStudyReport(input),sources=freezeStudySources([...parent.sources.map(s=>s.file),input,
  'scripts/study-weighted-clutch-seating-profile.mjs'],prefix),
 model=makeWeightedClutchIndependentCandidate(),jaws=makeWeightedClutchNativeJaws(model),profiles=[];
assert(tolerance>0&&tolerance<=2e-7);verifyStudySources(parent.sources);
const journal=fs.openSync(prefix+'-queries.jsonl','wx');
try{
 for(const impact of parent.rows){
  const flight=readStudyReport('artifacts/review/087-sixteenth-step-gravity-shift-'+impact.direction+'.json.gz'),
   start=flight.end.jaw.relativeAngle,center=Math.round(start/(Math.PI/6))*Math.PI/6,
   low=Math.min(start-.002,center-.012),high=Math.max(start+.002,center+.012),cache=new Map(),leaves=[];
  const sample=angle=>{
   if(cache.has(angle))return cache.get(angle);
   const q=jaws.evaluate(impact.side,angle),row={angle,gap:q.gap,triangles:[q.witness.looseTriangle,q.witness.slidingTriangle]};
   cache.set(angle,row);fs.writeSync(journal,JSON.stringify({direction:impact.direction,...row})+'\n');
   if(cache.size%128===0)console.log({direction:impact.direction,queries:cache.size,leaves:leaves.length});
   return row;
  };
  function refine(a,b,depth=0){
   const checks=[.25,.5,.75].map(f=>sample(a.angle+(b.angle-a.angle)*f)),
    error=Math.max(...checks.map((p,i)=>Math.abs(p.gap-(a.gap+(b.gap-a.gap)*(i+1)/4))));
   if(error<=tolerance){leaves.push({a,b,error,depth});return;}
   if(depth>=24)throw Error('Seating profile refinement limit');
   const m=checks[1];refine(a,m,depth+1);refine(m,b,depth+1);
  }
  const seeds=[low,high,start,center,...Array.from({length:33},(_,i)=>low+(high-low)*i/32)].sort((a,b)=>a-b),
   unique=[...new Set(seeds)];
  for(let i=1;i<unique.length;i++)refine(sample(unique[i-1]),sample(unique[i]));
  const knots=[leaves[0].a,...leaves.map(l=>l.b)],peak=knots.reduce((a,b)=>a.gap>b.gap?a:b),
   profile={direction:impact.direction,side:impact.side,start,input0:flight.end.phase.input,
    omegaInput:flight.parameters.omegaInput,low,high,center,tolerance,queries:cache.size,
    maximumCheckedChordError:Math.max(...leaves.map(l=>l.error)),knots,peak};
  profiles.push(profile);verifyStudySources(sources);
  fs.writeFileSync(prefix+'-'+impact.direction+'.json',JSON.stringify({sources,...profile})+'\n',{flag:'wx'});
  console.log({direction:impact.direction,queries:cache.size,knots:knots.length,peak});
 }
}finally{fs.closeSync(journal);}
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,profiles,
 qualification:'Adaptive linear interpolation of complete native jaw-front intersection queries over the first seating range. Quarter-point error checks are numerical evidence, not a continuous interpolation bound. No tooth-period symmetry is assumed; absolute relative phases retain Float32 and radial-grid differences. Loaded trajectories require independent full-native gap checks.'})+'\n',{flag:'wx'});
