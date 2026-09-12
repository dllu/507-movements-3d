import fs from 'node:fs';
import assert from 'node:assert/strict';
import {rotatingContourEvents,rotate2,pointInsidePolygon} from './lib/weighted-clutch-native-contours.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-both-key-bores',input='artifacts/review/087-first-native-key.json',report=readStudyReport(input),
 sources=freezeStudySources([...report.sources.map(s=>s.file),input,'scripts/check-weighted-clutch-key-bores.mjs'],prefix),
 {holes,key,lower,upper}=report.parameters,rows=[];
for(const side of ['left','right']){
 const events=rotatingContourEvents(holes[side],key),bounds=[events.filter(e=>e.angle<0).at(-1),events.find(e=>e.angle>0)],samples=[];
 for(let i=0;i<257;i++){
  const gamma=lower.angle+(upper.angle-lower.angle)*(i+.5)/257;
  samples.push({gamma,inside:key.every(p=>pointInsidePolygon(rotate2(p,gamma),holes[side]))});
 }
 rows.push({side,vertices:holes[side].length,bounds,samples,
  boundDifferences:[bounds[0].angle-lower.angle,bounds[1].angle-upper.angle]});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,
 sources,rows,qualification:'The two native bore rings differ in their circular tessellation, so both are independently checked for first feather contact. Bounds agree and all interior clearance samples retain every feather vertex inside both keyed holes.'})+'\n',{flag:'wx'});
for(const r of rows)assert(r.samples.every(s=>s.inside)&&Math.max(...r.boundDifferences.map(Math.abs))<1e-12);
console.log(rows.map(({side,vertices,boundDifferences})=>({side,vertices,boundDifferences})));
