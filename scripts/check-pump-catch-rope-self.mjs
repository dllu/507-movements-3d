import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pumpCatchRopeSelfBounds} from './lib/pump-catch-rope-self-bounds.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-complete-rope-self-bounds',input=process.env.PROBE_INPUT??'artifacts/review/086-first-rope-controls-baseline.json',
  data=readStudyReport(input),R=1.2730796995674873,r=.0625,
  parameters={R,r,thetaMin:data.qRange[0][0],thetaMax:data.qRange[0][1],Dmin:data.Dmin,Dmax:data.Dmax,amplitudeMax:data.amplitudeMax,
    quietDmin:3.7-data.qRange[2][1]-1e-10,quietAmplitudeMax:data.quietAmplitudeMax};
assert(data.passed);verifyStudySources(data.sources);
const result=pumpCatchRopeSelfBounds(parameters),controls=[];
for(const[name,change]of [['full-circle-overlap',{thetaMin:-2*Math.PI}],['folded-bow',{amplitudeMax:12}],['oversized-section',{r:1.4}]]){
  const p={...parameters,...change},test=pumpCatchRopeSelfBounds(p);assert(!test.passed,name);
  if(name==='folded-bow')assert(p.r*2*Math.PI**2*p.amplitudeMax/p.Dmin**2>1,'Inner parallel curve actually reverses at peak curvature');
  controls.push({name,rejected:true,result:test});
}
// Every center/section coordinate lies within +/-8. Float32 nearest rounding
// then moves one coordinate by at most 2^-22, and a vertex by sqrt(3)*2^-22.
// Two exact disjoint surfaces can consequently intrude by no more than twice
// that vertex displacement, below the existing mesh tolerance.
const maximumCoordinate=8,vertexRounding=Math.sqrt(3)*2**-22,roundingIntrusion=2*vertexRounding,tolerance=1e-6;
assert(roundingIntrusion<tolerance);assert(Math.max(R+r,4.75+r,Math.abs(-.49)+data.amplitudeMax+r)<maximumCoordinate);
const sources=freezeStudySources([input,'scripts/check-pump-catch-rope-self.mjs','scripts/lib/pump-catch-rope-self-bounds.mjs',
  'scripts/lib/pump-catch-rope-mesh.mjs','scripts/lib/pump-catch-rope.mjs','scripts/lib/study-report-io.mjs'],prefix);
verifyStudySources(sources);const report={movement:86,parameters,...result,controls,maximumCoordinate,vertexRounding,roundingIntrusion,tolerance,sources};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});if(!report.passed)process.exitCode=1;
