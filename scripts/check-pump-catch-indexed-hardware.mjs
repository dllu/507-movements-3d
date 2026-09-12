import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchCompleteCandidate} from './lib/pump-catch-complete-candidate.mjs';
import {indexPumpCatchHardware} from './lib/pump-catch-indexed-hardware.mjs';
import {pumpCatchCompleteSources} from './lib/pump-catch-complete-sources.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-indexed-hardware',model=makePumpCatchCompleteCandidate(),
  before=Object.fromEntries(Object.entries(model.root.userData.parts).map(([name,m])=>[name,m.geometry.clone()])),results=indexPumpCatchHardware(model);
let values=0;
for(const{name}of results){
  const A=before[name],B=model.root.userData.parts[name].geometry;assert.equal(A.attributes.position.count,B.index.count);assert.deepEqual(A.groups,B.groups);
  for(let i=0;i<B.index.count;i++)for(const[key,attr]of Object.entries(A.attributes))for(let k=0;k<attr.itemSize;k++){
    assert.equal(attr.array[i*attr.itemSize+k],B.attributes[key].array[B.index.getX(i)*attr.itemSize+k]);values++;
  }
}
const sources=freezeStudySources(['scripts/check-pump-catch-indexed-hardware.mjs','scripts/lib/pump-catch-indexed-hardware.mjs',...pumpCatchCompleteSources],prefix);
verifyStudySources(sources);const report={movement:86,passed:true,expandedAttributeValues:values,oldVertices:results.reduce((s,r)=>s+r.oldVertices,0),
  newVertices:results.reduce((s,r)=>s+r.newVertices,0),results,sources,
  qualification:'Every expanded triangle position, normal, color and UV component matches exactly, including signed zero. All material groups are unchanged. The check covers all 41 rigid parts; the deforming rope retains its separate buffer parity audit.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,results:results.length,sources:undefined});
