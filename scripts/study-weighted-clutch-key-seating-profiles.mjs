import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchKeyCandidate} from './lib/weighted-clutch-key-candidate.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/087-first-key-seating-profiles',
 input='artifacts/review/087-first-key-jaw-impact.json',impacts=readStudyReport(input),
 oldFile='artifacts/review/087-refined-seating-cusps.json',old=readStudyReport(oldFile),tolerance=2e-7,
 sources=freezeStudySources([...impacts.sources.map(s=>s.file),...old.sources.map(s=>s.file),input,oldFile,
  'scripts/study-weighted-clutch-key-seating-profiles.mjs'],prefix),model=makeWeightedClutchKeyCandidate(),
 jaws=makeWeightedClutchNativeJaws(model),profiles=[],checks=[],journal=fs.openSync(prefix+'-queries.jsonl','wx');
verifyStudySources(impacts.sources);verifyStudySources(old.sources);
try{for(const impact of impacts.rows){
 const side=impact.side,start=impact.relativeAngle,center=Math.round(start/(Math.PI/6))*Math.PI/6,cache=new Map(),
  sample=angle=>{
   if(cache.has(angle))return cache.get(angle);
   const q=jaws.evaluate(side,angle),row={angle,gap:q.gap,triangles:[q.witness.looseTriangle,q.witness.slidingTriangle]};
   cache.set(angle,row);fs.writeSync(journal,JSON.stringify({direction:impact.direction,side,...row})+'\n');
   if(cache.size%128===0)console.log({direction:impact.direction,side,queries:cache.size});return row;
  };
 let profile;
 if(side==='left'){
  const previous=old.profiles.find(p=>p.side===side),offset=Math.round((center-previous.peak.angle)/(2*Math.PI))*2*Math.PI,
   shifted=previous.knots.map(k=>({...k,angle:k.angle+offset})),exact=[start-1e-6,start,start+1e-6].map(sample),periodChecks=[];
  assert(start>shifted[0].angle&&start<shifted.at(-1).angle);
  for(let i=0;i<=32;i++){
   const knot=previous.knots[Math.floor((previous.knots.length-1)*i/32)],query=sample(knot.angle+offset);
   periodChecks.push({angle:query.angle,error:Math.abs(query.gap-knot.gap)});
  }
  assert(periodChecks.every(c=>c.error<1e-12));
  profile={...previous,direction:impact.direction,knots:[...shifted.filter(k=>k.angle<exact[0].angle||k.angle>exact[2].angle),...exact].sort((a,b)=>a.angle-b.angle),
   peak:{...previous.peak,angle:previous.peak.angle+offset},fullRotationReuse:{offset,periodChecks},
   low:shifted[0].angle,high:shifted.at(-1).angle};
 }else{
  // Locate this particular native tooth cusp; do not transfer the normals
  // from another tooth on the assumption of exact Float32 pitch symmetry.
  let lo=center-.001,hi=center+.001;
  const ratio=(Math.sqrt(5)-1)/2;let a=hi-ratio*(hi-lo),b=lo+ratio*(hi-lo),ga=sample(a),gb=sample(b);
  for(let i=0;i<52;i++){
   if(ga.gap<gb.gap){lo=a;a=b;ga=gb;b=lo+ratio*(hi-lo);gb=sample(b);}
   else{hi=b;b=a;gb=ga;a=hi-ratio*(hi-lo);ga=sample(a);}
  }
  sample((lo+hi)/2);const peak=[...cache.values()].reduce((a,b)=>a.gap>b.gap?a:b),
   left=sample(peak.angle-1e-6),right=sample(peak.angle+1e-6),slopes={left:(peak.gap-left.gap)/1e-6,right:(right.gap-peak.gap)/1e-6},cuspChecks=[];
  for(const h of [1e-7,1e-8])cuspChecks.push({h,left:(peak.gap-sample(peak.angle-h).gap)/h,right:(sample(peak.angle+h).gap-peak.gap)/h});
  assert(slopes.left>0&&slopes.right<0&&cuspChecks.every(c=>Math.abs(c.left-slopes.left)<1e-4&&Math.abs(c.right-slopes.right)<1e-4));
  const low=center-.10,high=Math.max(center+.30,start+.03),leaves=[];
  function refine(a,b,depth=0){
   const values=[.25,.5,.75].map(f=>sample(a.angle+(b.angle-a.angle)*f)),
    error=Math.max(...values.map((p,i)=>Math.abs(p.gap-a.gap-(b.gap-a.gap)*(i+1)/4)));
   if(error<=tolerance){leaves.push({a,b,error,depth});return;}
   if(depth>=24)throw Error('Native key seating profile refinement limit');
   refine(a,values[1],depth+1);refine(values[1],b,depth+1);
  }
  const seeds=[low,high,start,start-1e-6,start+1e-6,left.angle,peak.angle,right.angle,
   ...Array.from({length:49},(_,i)=>low+(high-low)*i/48)].sort((a,b)=>a-b),unique=[...new Set(seeds)];
  for(let i=1;i<unique.length;i++)refine(sample(unique[i-1]),sample(unique[i]));
  profile={direction:impact.direction,side,low,high,knots:[leaves[0].a,...leaves.map(l=>l.b)],peak,tolerance,
   maximumCheckedChordError:Math.max(...leaves.map(l=>l.error)),cuspRefined:true,cuspSlopes:slopes,cuspBracket:[lo,hi]};
  checks.push({side,peak,slopes,cuspChecks});
 }
 profile={...profile,start,center,input0:impact.originalProfile.input0,omegaInput:impact.originalProfile.omegaInput,
  impactTime:impact.time,queries:cache.size};profiles.push(profile);verifyStudySources(sources);
 fs.writeFileSync(prefix+'-'+impact.direction+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,profiles:[profile]})+'\n',{flag:'wx'});
 console.log({direction:impact.direction,side,queries:cache.size,knots:profile.knots.length,range:[profile.low,profile.high],peak:profile.peak});
}}finally{fs.closeSync(journal);}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,profiles,checks,
 qualification:'Native jaw profiles for the two opposite-jaw impacts reached after key-friction lifting/withdrawal. Left reuses a measured profile only by an exact integer number of full rotations, with native parity samples. Right measures its own tooth and sharp cusp. Both include the actual impact angle. Chord checks remain sampled interpolation evidence; loaded trajectories need independent native-gap checks.'})+'\n',{flag:'wx'});
