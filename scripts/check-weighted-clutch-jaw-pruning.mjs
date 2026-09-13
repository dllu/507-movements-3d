import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate} from './lib/weighted-clutch-distributed-candidate.mjs';
import {makeWeightedClutchNativeJaws} from './lib/weighted-clutch-native-jaws.mjs';
import {makeWeightedClutchNativeJawsPruned} from './lib/weighted-clutch-native-jaws-pruned.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-native-jaw-pruning',input='artifacts/review/087-fixed-orbit-jaw-impact.json',r=readStudyReport(input),
  sources=freezeStudySources([...r.sources.map(s=>s.file),input,'scripts/check-weighted-clutch-jaw-pruning.mjs',
    'scripts/lib/weighted-clutch-native-jaws-pruned.mjs'],prefix),
  model=makeWeightedClutchDistributedCandidate(r.options),reference=makeWeightedClutchNativeJaws(model),
  pruned=makeWeightedClutchNativeJawsPruned(model),rows=[];
verifyStudySources(r.sources);
for(const side of ['left','right']){
  const impact=r.rows.find(r=>r.side===side),center=Math.round(impact.relativeAngle/(Math.PI/6))*Math.PI/6,
    angles=[...Array.from({length:65},(_,i)=>-2*Math.PI+4*Math.PI*(i+.271)/65),
      impact.relativeAngle,center-.0003,center-.00027,center,center+.00027,center+.0003];
  for(const[at,angle]of angles.entries()){
    const shift=.3*Math.sin(at),start=performance.now(),a=reference.evaluate(side,angle,shift),middle=performance.now(),
      b=pruned.evaluate(side,angle,shift),end=performance.now(),
      gapError=Math.abs(a.gap-b.gap),witnessError=Math.max(...a.witness.pointLoose.map((v,i)=>Math.abs(v-b.witness.pointLoose[i])),
        ...a.witness.pointSliding.map((v,i)=>Math.abs(v-b.witness.pointSliding[i])));
    rows.push({side,angle,shift,gapError,witnessError,referenceMs:middle-start,prunedMs:end-middle,tested:b.tested,pruned:b.pruned});
  }
}
const total=key=>rows.reduce((s,r)=>s+r[key],0),summary={queries:rows.length,maximumGapError:Math.max(...rows.map(r=>r.gapError)),
  maximumWitnessError:Math.max(...rows.map(r=>r.witnessError)),referenceMs:total('referenceMs'),prunedMs:total('prunedMs'),
  tested:total('tested'),pruned:total('pruned')};
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,rows,summary,qualification:'Exact native-triangle query optimization. On each triangle pair the affine gap minimum over the intersection is bounded below by both whole-triangle minima; pairs are skipped only when that bound exceeds the current measured minimum plus 1e-12. Reference parity spans both sides, two full turns, independent shifts and the new impact/cusp neighborhoods. Timings describe this local run, not a general performance guarantee.'},null,2)+'\n',{flag:'wx'});
console.log(summary);assert(summary.maximumGapError<1e-12&&summary.maximumWitnessError<1e-10);
