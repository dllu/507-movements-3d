import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchCompleteCandidate} from './lib/pump-catch-complete-candidate.mjs';
import {makePumpCatchLiveCandidate} from './lib/pump-catch-live-rope.mjs';
import {pumpCatchCompleteSources} from './lib/pump-catch-complete-sources.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-live-rope',input='artifacts/review/086-first-compressed-motion.json',data=readStudyReport(input),
  baseline=makePumpCatchCompleteCandidate(),live=makePumpCatchLiveCandidate(),geometry=live.root.userData.parts.pumpRope.geometry,
  errors={position:0,normal:0,uv:0},indices=new Set(Array.from({length:101},(_,i)=>Math.round((data.rows.length-1)*i/100))),rows=[];
verifyStudySources(data.sources);
for(let i=1;i<data.rows.length;i++)if(data.rows[i-1].q[0]*data.rows[i].q[0]<0){indices.add(i-1);indices.add(i);}
for(const i of [...indices].sort((a,b)=>a-b)){
  const row=data.rows[i],state={wheelAngle:row.q[0],catchAngle:row.q[1]-row.q[0],pumpHeight:row.q[2],camAngle:data.angularSpeed*row.time},timing={};
  for(const[name,model]of [['baseline',baseline],['live',live]]){const start=performance.now();model.setState(state);timing[name]=performance.now()-start;}
  assert.equal(live.root.userData.parts.pumpRope.geometry,geometry,'Buffer geometry must be reused');
  const other=baseline.root.userData.parts.pumpRope.geometry;
  assert.equal(geometry.index.count,other.index.count);assert.equal(geometry.drawRange.count,other.index.count);
  for(let k=0;k<other.index.count;k++)assert.equal(geometry.index.getX(k),other.index.getX(k));
  for(const[name,A]of Object.entries(other.attributes)){
    const B=geometry.attributes[name];assert.equal(A.count,B.count);
    for(let k=0;k<A.count*A.itemSize;k++)errors[name]=Math.max(errors[name],Math.abs(A.array[k]-B.array[k]));
  }
  for(const[name,mesh]of Object.entries(baseline.root.userData.parts))assert.deepEqual(mesh.matrixWorld.elements,live.root.userData.parts[name].matrixWorld.elements,name);
  rows.push({time:row.time,vertices:other.attributes.position.count,timing});
}
assert(errors.position<1e-6&&errors.normal<1e-6&&errors.uv<1e-6);
const sources=freezeStudySources([input,'scripts/check-pump-catch-live-rope.mjs','scripts/lib/pump-catch-live-rope.mjs',...pumpCatchCompleteSources],prefix);verifyStudySources(sources);
const report={movement:86,passed:true,poses:rows.length,errors,rows,sources,
  qualification:'Actual positions, normals, UVs, indices, draw counts and every rigid transform match the reference at selected motion and wrap-transition poses. The geometry object persists through every update. Timings are Node measurements; browser performance is assessed separately.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,rows:undefined,sources:undefined});
