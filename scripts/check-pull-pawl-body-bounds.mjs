import fs from 'node:fs';
import crypto from 'node:crypto';
import {makePullPawlCandidate} from './lib/pull-pawl-candidate.mjs';
import {triangulateContactPolygon,triangleTree} from './lib/pull-pawl-triangle-bounds.mjs';
const file=process.env.PLAYBACK_FILE??'artifacts/review/078-playback-finest-candidate.json',cache=JSON.parse(fs.readFileSync(file)),
 candidate=makePullPawlCandidate(cache.geometry),u=candidate.root.userData,p=u.geometry,tolerance=1e-6,roundoff=1e-12,
 profiles=Object.fromEntries(['left','right'].map(key=>[key,triangulateContactPolygon(u.parts[key+'Pawl'].geometry.parameters.shapes[0].getPoints().map(v=>v.toArray()))])),
 tree=triangleTree(profiles.left.triangles),deltaArm=p.arms.right.map((v,k)=>v-p.arms.left[k]),armLength=Math.hypot(...deltaArm),
 dot=(a,b)=>a[0]*b[0]+a[1]*b[1],rotate=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)],
 stats={evaluations:0,trianglePairs:0,axisChecks:0,minimumLowerBound:Infinity};
const evaluate=row=>{
 stats.evaluations++;const P=rotate(deltaArm,row[1]-row[3]),angle=row[4]-row[3],c=Math.cos(angle),s=Math.sin(angle);
 return{row,points:profiles.right.points.map(v=>[P[0]+c*v[0]-s*v[1],P[1]+s*v[0]+c*v[1]])};
};
const check=(a,b)=>{
 const middle=evaluate(a.row.map((v,k)=>(v+b.row[k])/2)),dq=b.row[1]-a.row[1],dl=b.row[3]-a.row[3],dr=b.row[4]-a.row[4],
  error=profiles.right.radii.map(r=>(armLength*(dq-dl)**2+r*(dr-dl)**2)/8+roundoff),angle=middle.row[4]-middle.row[3];
 let witness=null,minimum=Infinity;
 for(const right of profiles.right.triangles){
  const box={min:[0,1].map(k=>Math.min(...right.ids.map(j=>Math.min(a.points[j][k],b.points[j][k])-error[j]))),
   max:[0,1].map(k=>Math.max(...right.ids.map(j=>Math.max(a.points[j][k],b.points[j][k])+error[j])))},axes=right.normals.map(n=>rotate(n,angle));
  tree.query(box,left=>{
   stats.trianglePairs++;let best=-Infinity,midpointBest=-Infinity;
   for(const n of [...left.normals,...axes]){
    stats.axisChecks++;const values=left.points.map(v=>dot(n,v)),lo=Math.min(...values),hi=Math.max(...values);let rlo=Infinity,rhi=-Infinity,mlo=Infinity,mhi=-Infinity;
    for(const j of right.ids){const x=dot(n,a.points[j]),y=dot(n,b.points[j]),m=dot(n,middle.points[j]);
     rlo=Math.min(rlo,x-error[j],y-error[j]);rhi=Math.max(rhi,x+error[j],y+error[j]);mlo=Math.min(mlo,m);mhi=Math.max(mhi,m);
    }
    const lower=Math.max(rlo-hi,lo-rhi);best=Math.max(best,lower);midpointBest=Math.max(midpointBest,mlo-hi,lo-mhi);if(lower>=-tolerance)break;
   }
   minimum=Math.min(minimum,best);if(best< -tolerance&&(!witness||best<witness.lower))witness={lower:best,midpointSeparation:midpointBest,leftTriangle:left.ids,rightTriangle:right.ids};
  });
 }
 if(!witness)stats.minimumLowerBound=Math.min(stats.minimumLowerBound,minimum);return{okay:!witness,middle,witness};
};
const failures=[],rows=[];let certified=0,subdivisions=0,maximumDepth=0;
const certify=(a,b,depth,label)=>{
 maximumDepth=Math.max(maximumDepth,depth);const result=check(a,b);if(result.okay){certified++;return true;}
 if(result.witness.midpointSeparation< -tolerance-roundoff||depth>=20){failures.push({reason:depth>=20?'unresolved-interval':'midpoint-overlap',label,depth,a:a.row,b:b.row,...result.witness});return false;}
 subdivisions++;return certify(a,result.middle,depth+1,label)&&certify(result.middle,b,depth+1,label);
};
for(const [label,table]of [['initial',cache.first],['periodic',cache.steady]]){
 const before={certified,subdivisions};let previous=evaluate(table[0]),okay=true;
 for(let i=1;i<table.length;i++){const current=evaluate(table[i]);if(!certify(previous,current,0,{table:label,segment:i-1})){okay=false;break;}previous=current;}
 rows.push({table:label,knots:table.length,okay,certified:certified-before.certified,subdivisions:subdivisions-before.subdivisions});if(!okay)break;
}
const files=[file,'scripts/check-pull-pawl-body-bounds.mjs','scripts/lib/pull-pawl-candidate.mjs','scripts/lib/pull-pawl-triangle-bounds.mjs'],
 report={movement:78,status:'continuous-pawl-body-face-bounds',productionChanged:false,mechanicsPassed:false,passed:failures.length===0&&rows.length===2,
 tolerance,roundoff,rows,certified,subdivisions,maximumDepth,...stats,failures,triangulations:Object.fromEntries(Object.entries(profiles).map(([k,p])=>[k,p.validation])),
 method:'In the left pawl frame every right-pawl vertex follows R(q-alphaLeft)*(armRight-armLeft) + R(alphaRight-alphaLeft)*vertex. Its deviation from the endpoint chord is bounded by (|armRight-armLeft|*(dq-dalphaLeft)² + |vertex|*(dalphaRight-dalphaLeft)²)/8. Complete actual outer profiles, with bores conservatively filled, are triangulated with checked oriented edge cancellation and area. Endpoint boxes and fixed midpoint triangle axes bound whole-face separation throughout each playback interval. Wheel angle does not occur, so the same bound covers every periodic wheel orientation.',
 sources:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(process.env.PROBE_OUTPUT??'artifacts/review/078-pawl-body-clearance-bounds.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({passed:report.passed,rows,certified,subdivisions,maximumDepth,stats,failures});if(!report.passed)process.exitCode=1;
