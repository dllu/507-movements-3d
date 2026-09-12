import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWiperStampCandidate} from './lib/wiper-stamp-candidate.mjs';
import {makeWiperStampContact} from './lib/wiper-stamp-contact.mjs';
import {renderedPrism} from './lib/crossed-rack-mesh-prisms.mjs';
import {readStudyReport,verifyStudySources,freezeStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const input=process.env.PROBE_INPUT??'artifacts/review/085-first-playback-data.json';
const prepFile=process.env.PROBE_PREPARATION??'artifacts/review/085-first-playback.json';
const prefix=process.env.PROBE_PREFIX??'artifacts/review/085-first-playback-bound';
const data=readStudyReport(input),prep=readStudyReport(prepFile);verifyStudySources(prep.sources);assert(prep.passed);assert.equal(hashStudyFile(input),prep.output.sha256);
const model=makeWiperStampCandidate(),u=model.root.userData,cam=renderedPrism(u.parts.twoWipers.geometry),pad=renderedPrism(u.parts.flatProjectionB.geometry);
const contact=makeWiperStampContact(model),edgeKey=(a,b)=>[a.join(','),b.join(',')].sort().join('/');
assert.deepEqual(cam.boundary.map(e=>edgeKey(e.a,e.b)).sort(),contact.boundary.map(e=>edgeKey(e.a,e.b)).sort());
const p=u.geometry.projection;assert(pad.points.every(v=>[p.left,p.right].includes(v[0])&&[p.bottom,p.top].includes(v[1])));
assert(cam.low<pad.high&&pad.low<cam.high);
const limit=data.projectionLimitPixels/data.scale,guard=data.camGuard,roundoff=1e-10,omega=data.angularSpeed;
const radius=Math.max(...cam.radii),top=radius-data.range[0]+1;
assert(top>radius-data.range[0]);
// This rectangle continues above every possible cam point. Separation proves
// the cam is below the chosen B height or outside B's horizontal span; a cam
// above B cannot accidentally count as a feasible witness.
const rectangle=[[p.left,p.bottom+limit-guard],[p.right,p.bottom+limit-guard],[p.right,top],[p.left,top]];
const triangles=cam.triangles.map(t=>({...t,radius:Math.max(...t.points.map(v=>Math.hypot(...v)))}));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const pose=(points,t,y)=>{const c=Math.cos(omega*t),s=Math.sin(omega*t);return points.map(v=>[c*v[0]-s*v[1],s*v[0]+c*v[1]-y]);};
const bounds=points=>({low:[0,1].map(k=>Math.min(...points.map(v=>v[k]))),high:[0,1].map(k=>Math.max(...points.map(v=>v[k])))});
const R=bounds(rectangle),counts={intervals:0,triangleIntervals:0,boxCertificates:0,axisCertificates:0,subdivisions:0,failedIntervals:0};
let minimumBound=Infinity,maximumDepth=0;const failures=[];
function certify(triangle,a,b,A,B,depth=0) {
  maximumDepth=Math.max(maximumDepth,depth);counts.triangleIntervals++;
  const h=b[0]-a[0],error=triangle.radius*(omega*h)**2/8+roundoff;
  const joined=bounds([...A,...B]),boxGap=Math.max(...[0,1].map(k=>Math.max(joined.low[k]-R.high[k],R.low[k]-joined.high[k])))-error;
  if(boxGap>0){counts.boxCertificates++;minimumBound=Math.min(minimumBound,boxGap);return true;}
  const mid=(a[0]+b[0])/2,c=Math.cos(omega*mid),s=Math.sin(omega*mid);
  for(const local of triangle.normals) {
    const n=[c*local[0]-s*local[1],s*local[0]+c*local[1]],values=[...A,...B].map(v=>dot(v,n)),rect=rectangle.map(v=>dot(v,n));
    const gap=Math.max(Math.min(...values)-Math.max(...rect),Math.min(...rect)-Math.max(...values))-error;
    if(gap>0){counts.axisCertificates++;minimumBound=Math.min(minimumBound,gap);return true;}
  }
  if(depth===18)return false;
  counts.subdivisions++;const m=[mid,(a[1]+b[1])/2],M=pose(triangle.points,...m);
  return certify(triangle,a,m,A,M,depth+1)&&certify(triangle,m,b,M,B,depth+1);
}
const started=performance.now();
for(let i=1;i<data.knots.length;i++) {
  const a=data.knots[i-1],b=data.knots[i];assert(b[0]>a[0]);assert(Math.min(a[1],b[1])>=data.range[0]-1e-14);
  assert(Math.max(a[1],b[1])+limit<=data.range[1]);counts.intervals++;
  const A=pose(cam.points,...a),B=pose(cam.points,...b);
  for(const triangle of triangles)if(!certify(triangle,a,b,triangle.ids.map(j=>A[j]),triangle.ids.map(j=>B[j]))) {
    counts.failedIntervals++;if(failures.length<30)failures.push({index:i,start:a,end:b,triangle:triangle.ids});
  }
  if(i%1000===0)console.log({knot:i,counts,seconds:(performance.now()-started)/1000});
}
const sources=freezeStudySources([input,prepFile,'scripts/bound-wiper-stamp-playback.mjs','scripts/lib/crossed-rack-mesh-prisms.mjs',...prep.sources.map(s=>s.file)],prefix);
const report={movement:85,status:'continuous-flat-projection-clearance-and-correction-bound',passed:!counts.failedIntervals,productionChanged:false,mechanicsPassed:false,
  candidateIntegrated:false,input,counts,minimumBound,maximumDepth,seconds:(performance.now()-started)/1000,
  correctionBound:limit,correctionPixels:limit*data.scale,guard,roundoff,range:data.range,cam:cam.validation,pad:pad.validation,
  boundaryCorrespondence:true,upperWitnessRectangle:rectangle,failures,sources,
  qualification:'Complete rendered cam cap triangles and matching side faces prove the finite footprint. Every compressed interval has a feasible height within the positive correction limit: fixed-axis separation bounds endpoints plus the analytic R*omega^2*h^2/8 rotation departure from the chord. The witness strip extends above all possible cam points. Its bottom clears the full footprint, so the upward envelope projection is bounded at every time. The bed minimum also holds continuously. Other hardware pairs, dynamics accuracy and final rendering require separate checks.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});if(!report.passed)process.exitCode=1;
