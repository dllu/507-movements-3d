import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchRopeDisplacement} from './lib/pump-catch-rope-displacement.mjs';
import {pumpCatchRopeCenterline,pumpCatchRopeMesh} from './lib/pump-catch-rope-mesh.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-rope-displacement-controls',input='artifacts/review/086-first-hybrid-compressed-motion.json',
  data=readStudyReport(input),bound=makePumpCatchRopeDisplacement({R:data.parameters.radius}),
  selected=new Set(Array.from({length:61},(_,i)=>Math.round((data.rows.length-2)*i/60))),
  mix=(a,b,f)=>a.map((v,k)=>v+f*(b[k]-v)),shift=q=>[q[0]+1e-7,q[1],q[2]+1e-7],
  counts={intervals:0,poses:0,fixedSectionVertices:0,arcVertices:0},maximum={amplitudeEnvelopeViolation:0,vertexDisplacement:0,relativeBound:0};
verifyStudySources(data.sources);
for(const i of selected){
  const a0=data.rows[i].q,a1=data.rows[i+1].q,b0=shift(a0),b1=shift(a1),result=bound.interval(a0,a1,b0,b1);counts.intervals++;
  for(const t of [0,.25,.5,.75,1]){
    const qA=mix(a0,a1,t),qB=mix(b0,b1,t),a=pumpCatchRopeCenterline(qA,data.parameters),b=pumpCatchRopeCenterline(qB,data.parameters),
      ga=pumpCatchRopeMesh(a),gb=pumpCatchRopeMesh(b),pa=ga.attributes.position,pb=gb.attributes.position,
      nA=a.points.length-579,nB=b.points.length-579;counts.poses++;
    for(const[field,envelope]of [[a,result.a],[b,result.b]]){
      const violation=Math.max(0,envelope.A[0]-field.amplitude,field.amplitude-envelope.A[1]);
      maximum.amplitudeEnvelopeViolation=Math.max(maximum.amplitudeEnvelopeViolation,violation);assert(violation<1e-12);
    }
    function check(value){maximum.vertexDisplacement=Math.max(maximum.vertexDisplacement,value);maximum.relativeBound=Math.max(maximum.relativeBound,value/result.displacement);assert(value<=result.displacement);}
    for(let ring=0;ring<579;ring++)for(let side=0;side<25;side++){
      const ia=(nA+ring)*25+side,ib=(nB+ring)*25+side;
      check(Math.hypot(pa.getX(ia)-pb.getX(ib),pa.getY(ia)-pb.getY(ib),pa.getZ(ia)-pb.getZ(ib)));counts.fixedSectionVertices++;
    }
    // Map winding vertices to the corresponding normalized arc parameter on
    // an actual longitudinal edge of the other tube, in both directions.
    for(const[p,q,n,m]of [[pa,pb,nA,nB],[pb,pa,nB,nA]])for(let ring=0;ring<n;ring++)for(let side=0;side<25;side++){
      const s=ring/n*m,lo=Math.floor(s),f=s-lo,ia=ring*25+side,ib=lo*25+side,ic=(lo+1)*25+side;
      check(Math.hypot(...['getX','getY','getZ'].map(get=>p[get](ia)-(q[get](ib)+f*(q[get](ic)-q[get](ib))))));counts.arcVertices++;
    }
    ga.dispose();gb.dispose();
  }
}
const rejected=[];
for(const q of [[.5,0,0],[0,0,4],[0,0,2],[NaN,0,0]]){assert.throws(()=>bound.envelope(q,q));rejected.push(q.map(v=>Number.isFinite(v)?v:'nonfinite'));}
const sources=freezeStudySources([input,'scripts/check-pump-catch-rope-displacement.mjs','scripts/lib/pump-catch-rope-displacement.mjs',
  'scripts/lib/pump-catch-rope-mesh.mjs','scripts/lib/pump-catch-rope.mjs'],prefix);verifyStudySources(sources);
const report={movement:86,passed:true,counts,maximum,rejected,sources,productionChanged:false,
  qualification:'Independent centerline amplitudes and actual Float32 mesh vertices are checked against the interval bound at five fractions of 61 compressed intervals, including a small pose perturbation. Winding vertices map to actual edges in both directions. Invalid angle, span, amplitude and nonfinite domains are rejected. These controls exercise the bound; the separate all-interval certificate supplies continuous coverage.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});
