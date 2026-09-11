import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {makePullPawlCandidate} from './lib/pull-pawl-candidate.mjs';
import {finitePolygon} from './lib/pull-pawl-contact-study.mjs';
import {makePullPawlTriangleBounds} from './lib/pull-pawl-triangle-bounds.mjs';
const rectangle=(x,y,w,h)=>[[x-w,y-h],[x+w,y-h],[x+w,y+h],[x-w,y+h]],
 fixture=(wheel,hook,arm)=>({root:{userData:{geometry:{A:[0,0],arms:{left:arm,right:[5,0]}},profiles:{wheel,left:hook,right:hook}}}}),
 zero=[0,0,0,0,0],failures=[],fixtures=[];
const assessFixture=(name,test,detail)=>{fixtures.push({name,passed:test,...detail});if(!test)failures.push({reason:'fixture-failed',name});};
{
 const w=rectangle(0,0,1,.1),h=rectangle(0,0,.1,1),bounds=makePullPawlTriangleBounds(fixture(w,h,[0,0])),
  wheel=finitePolygon(w),hook=finitePolygon(h),verticesOutside=w.every(p=>hook.closest(p).gap>0)&&h.every(p=>wheel.closest(p).gap>0),result=bounds.check(bounds.evaluate(zero),bounds.evaluate(zero));
 assessFixture('crossing-edges-with-no-contained-vertices',verticesOutside&&!result.okay,{verticesOutside,witness:result.witness});
}
{
 const bounds=makePullPawlTriangleBounds(fixture(rectangle(0,0,1,.1),rectangle(0,0,.1,1),[3,0])),result=bounds.check(bounds.evaluate(zero),bounds.evaluate(zero));
 assessFixture('separated-polygons',result.okay,{});
}
{
 const bounds=makePullPawlTriangleBounds(fixture(rectangle(0,0,.1,.1),rectangle(-1.5,0,.02,.02),[1.5,0])),a=bounds.evaluate([0,0,0,-.2,0]),b=bounds.evaluate([1,0,0,.2,0]),
  endpoints=bounds.check(a,a).okay&&bounds.check(b,b).okay,result=bounds.check(a,b);
 assessFixture('clear-endpoints-with-mid-interval-collision',endpoints&&!result.okay,{endpoints,witness:result.witness});
}
const candidate=makePullPawlCandidate(),u=candidate.root.userData,p=u.geometry,bounds=makePullPawlTriangleBounds(candidate),
 rotate=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)],
 deltaArm=p.arms.right.map((v,k)=>v-p.arms.left[k]),rightBody=finitePolygon(u.parts.rightPawl.geometry.parameters.shapes[0].getPoints().map(v=>v.toArray())),
 counts={matrix:0,hookEnvelope:0,bodyMatrix:0,bodyEnvelope:0},maximum={matrix:0,hookEnvelopeExcess:0,bodyMatrix:0,bodyEnvelopeExcess:0};
let seed=527;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;},
 set=row=>u.setState({q:row[1],theta:row[2],leftAngle:row[3],rightAngle:row[4]}),
 bodyPoints=row=>{set(row);const matrix=u.parts.leftPawl.matrixWorld.clone().invert().multiply(u.parts.rightPawl.matrixWorld);return rightBody.points.map(v=>new THREE.Vector3(...v,0).applyMatrix4(matrix).toArray().slice(0,2));};
for(let sample=0;sample<64;sample++){
 const a=[0,(random()-.5)*.8,(random()-.5)*8,1.2+(random()-.5)*.5,.4+(random()-.5)*.5],
  d=[1,(random()-.5)*.1,(random()-.5)*.14,(random()-.5)*.16,(random()-.5)*.16],b=a.map((v,k)=>v+d[k]),
  first=bounds.evaluate(a),last=bounds.evaluate(b),firstBody=bodyPoints(a),lastBody=bodyPoints(b);
 for(const s of [.25,.5,.75]){
  const row=a.map((v,k)=>v+d[k]*s),mid=bounds.evaluate(row);set(row);const wheelInverse=u.parts.wheelBody.matrixWorld.clone().invert();
  for(const [index,key]of ['left','right'].entries()){
   const matrix=wheelInverse.clone().multiply(u.parts[key+'Hook'].matrixWorld),profile=bounds.profiles[key];
   for(let j=0;j<profile.points.length;j++){
    const v=profile.points[j],actual=new THREE.Vector3(...v,0).applyMatrix4(matrix).toArray().slice(0,2),
     matrixError=Math.hypot(...actual.map((v,k)=>v-mid.points[key][j][k])),
     chord=first.points[key][j].map((v,k)=>v+s*(last.points[key][j][k]-v)),distance=Math.hypot(...actual.map((v,k)=>v-chord[k])),
     limit=(Math.hypot(...p.A)*d[2]**2+Math.hypot(...p.arms[key])*(d[1]-d[2])**2+Math.hypot(...profile.points[j])*(d[index+3]-d[2])**2)/8;
    counts.matrix++;counts.hookEnvelope++;maximum.matrix=Math.max(maximum.matrix,matrixError);maximum.hookEnvelopeExcess=Math.max(maximum.hookEnvelopeExcess,distance-limit);
   }
  }
  const actual=bodyPoints(row),P=rotate(deltaArm,row[1]-row[3]);
  for(let j=0;j<rightBody.points.length;j++){
   const v=rightBody.points[j],r=rotate(v,row[4]-row[3]),expected=r.map((v,k)=>v+P[k]),
    matrixError=Math.hypot(...expected.map((v,k)=>v-actual[j][k])),chord=firstBody[j].map((v,k)=>v+s*(lastBody[j][k]-v)),
    distance=Math.hypot(...actual[j].map((v,k)=>v-chord[k])),limit=(Math.hypot(...deltaArm)*(d[1]-d[3])**2+Math.hypot(...v)*(d[4]-d[3])**2)/8;
   counts.bodyMatrix++;counts.bodyEnvelope++;maximum.bodyMatrix=Math.max(maximum.bodyMatrix,matrixError);maximum.bodyEnvelopeExcess=Math.max(maximum.bodyEnvelopeExcess,distance-limit);
  }
 }
}
for(const [key,value]of Object.entries(maximum))if(value>1e-11)failures.push({reason:'formula-error',key,value});
const files=['scripts/check-pull-pawl-bound-formulas.mjs','scripts/lib/pull-pawl-candidate.mjs','scripts/lib/pull-pawl-triangle-bounds.mjs','scripts/lib/pull-pawl-contact-study.mjs'],
 report={movement:78,status:'independent-playback-bound-formula-check',productionChanged:false,mechanicsPassed:false,passed:!failures.length,fixtures,counts,maximum,failures,
 qualification:'Adversarial fixtures exercise crossing edges and collisions between clear endpoint poses. Actual Three.js world matrices independently check both relative-coordinate formulas; sampled chord deviations check the analytic curvature envelopes. The complete interval certificates use those analytic bounds, not the sampling performed here.',
 sources:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('artifacts/review/078-bound-formulas.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({passed:report.passed,fixtures,counts,maximum,failures});if(!report.passed)process.exitCode=1;
