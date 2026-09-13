import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate} from './lib/weighted-clutch-distributed-candidate.mjs';
import {makeWeightedClutchNativeJawsPruned} from './lib/weighted-clutch-native-jaws-pruned.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const direction=process.env.PROBE_DIRECTION??'CW',prefix=process.env.PROBE_PREFIX??'artifacts/review/087-next-jaw-profile-'+direction,
  input='artifacts/review/087-fixed-orbit-next-transfer-'+direction+'-coarse.json',parent=readStudyReport(input),branch=parent.summaries[0],
  sources=freezeStudySources([...parent.sources.map(s=>s.file),input,'scripts/study-weighted-clutch-next-jaw-profiles.mjs',
    'scripts/lib/weighted-clutch-native-jaws-pruned.mjs'],prefix),model=makeWeightedClutchDistributedCandidate(parent.options),
  jaws=makeWeightedClutchNativeJawsPruned(model),match=branch.error?.message.match(/^Unmeasured potentially contacting (left|right) jaw phase ([-.\d]+)/),
  tolerance=2e-7,cache=new Map(),journal=fs.openSync(prefix+'-queries.jsonl','wx');
verifyStudySources(parent.sources);assert(match&&match[1]===branch.side);
const side=match[1],start=Number(match[2]),pitch=2*Math.PI/model.root.userData.geometry.jawCount,center=Math.round(start/pitch)*pitch;
function sample(angle){
  if(cache.has(angle))return cache.get(angle);
  const q=jaws.evaluate(side,angle),row={angle,gap:q.gap,triangles:[q.witness.looseTriangle,q.witness.slidingTriangle]};
  cache.set(angle,row);fs.writeSync(journal,JSON.stringify({direction,side,...row})+'\n');
  if(cache.size%512===0)console.log({direction,side,queries:cache.size});return row;
}
try{
  let lo=center-.001,hi=center+.001;
  const ratio=(Math.sqrt(5)-1)/2;let a=hi-ratio*(hi-lo),b=lo+ratio*(hi-lo),ga=sample(a),gb=sample(b);
  for(let i=0;i<52;i++){
    if(ga.gap<gb.gap){lo=a;a=b;ga=gb;b=lo+ratio*(hi-lo);gb=sample(b);}
    else{hi=b;b=a;gb=ga;a=hi-ratio*(hi-lo);ga=sample(a);}
  }
  sample((lo+hi)/2);
  const peak=[...cache.values()].reduce((a,b)=>a.gap>b.gap?a:b),left=sample(peak.angle-1e-6),right=sample(peak.angle+1e-6),
    slopes={left:(peak.gap-left.gap)/1e-6,right:(right.gap-peak.gap)/1e-6},cuspChecks=[];
  for(const h of [1e-7,1e-8])cuspChecks.push({h,left:(peak.gap-sample(peak.angle-h).gap)/h,right:(sample(peak.angle+h).gap-peak.gap)/h});
  assert(slopes.left>0&&slopes.right<0&&cuspChecks.every(c=>Math.abs(c.left-slopes.left)<1e-4&&Math.abs(c.right-slopes.right)<1e-4));
  const low=Math.min(center-.4,start-.03),high=Math.max(center+.4,start+.03),leaves=[];
  function refine(a,b,depth=0){
    const values=[.25,.5,.75].map(f=>sample(a.angle+(b.angle-a.angle)*f)),
      error=Math.max(...values.map((p,i)=>Math.abs(p.gap-a.gap-(b.gap-a.gap)*(i+1)/4)));
    if(error<=tolerance){leaves.push({a,b,error,depth});return;}
    if(depth>=24)throw Error('Native next-tooth refinement limit');
    refine(a,values[1],depth+1);refine(values[1],b,depth+1);
  }
  const seeds=[low,high,start,start-1e-6,start+1e-6,left.angle,peak.angle,right.angle,
    ...Array.from({length:81},(_,i)=>low+(high-low)*i/80)].sort((a,b)=>a-b),unique=[...new Set(seeds)];
  for(let i=1;i<unique.length;i++)refine(sample(unique[i-1]),sample(unique[i]));
  const profile={direction,side,low,high,start,center,input0:branch.profile.input0,omegaInput:branch.profile.omegaInput,
    queries:cache.size,knots:[leaves[0].a,...leaves.map(l=>l.b)],peak,tolerance,
    maximumCheckedChordError:Math.max(...leaves.map(l=>l.error)),cuspRefined:true,cuspSlopes:slopes,cuspBracket:[lo,hi]};
  verifyStudySources(sources);
  fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
    sources,options:parent.options,input,profiles:[profile],checks:[{side,peak,slopes,cuspChecks}],
    qualification:'Measures the actual Float32 jaw tooth approached by the continuously integrated next transfer. The earlier missing-profile stop is preserved. No pitch-symmetry substitution or physical state reassignment is used. Cusp slopes and sampled interpolation errors are checked; loaded motion still requires step comparison and independent native gaps.'})+'\n',{flag:'wx'});
  console.log({direction,side,queries:cache.size,knots:profile.knots.length,peak,range:[low,high]});
}finally{fs.closeSync(journal);}
