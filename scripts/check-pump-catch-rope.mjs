import fs from 'node:fs';
import {pumpCatchRope} from './lib/pump-catch-rope.mjs';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-finite-rope-geometry',parameters={radius:1.2730796995674873,ropeLength:4.75},errors={gradient:0,polylineLength:0,wrappedLift:0,inside:0},issues=[];
const sources=freezeStudySources(['scripts/check-pump-catch-rope.mjs','scripts/lib/pump-catch-rope.mjs','scripts/lib/study-report-io.mjs'],prefix);
let poses=0;const modes=new Set();
for(let i=0;i<=160;i++)for(const y of [-1,0,1,2,3.3]){
  const q=[-7+i*.0875,0,y],c=pumpCatchRope(q,parameters),p=c.path;poses++;modes.add(p.winding);
  for(const k of [0,2]){const plus=q.slice(),minus=q.slice(),h=1e-6;plus[k]+=h;minus[k]-=h;
    const derivative=(pumpCatchRope(plus,parameters).gap-pumpCatchRope(minus,parameters).gap)/(2*h);
    errors.gradient=Math.max(errors.gradient,Math.abs(derivative-c.gradient[k]));}
  let length=0,previous=p.anchor;
  const segments=Math.max(1,Math.ceil(p.arcAngle*4096));
  for(let j=1;j<=segments;j++){
    const angle=p.alpha+p.winding*p.arcAngle*j/segments,next=[parameters.radius*Math.cos(angle),parameters.radius*Math.sin(angle)];
    length+=Math.hypot(...next.map((v,k)=>v-previous[k]));previous=next;
  }
  length+=Math.hypot(...p.pump.map((v,k)=>v-previous[k]));errors.polylineLength=Math.max(errors.polylineLength,Math.abs(length-p.pathLength));
  for(let j=0;j<=100;j++){const point=p.tangent.map((v,k)=>v+(p.pump[k]-v)*j/100);errors.inside=Math.max(errors.inside,parameters.radius-Math.hypot(...point));}
  if(q[0]<0&&y<parameters.ropeLength)errors.wrappedLift=Math.max(errors.wrappedLift,Math.abs(c.gap-(y+parameters.radius*q[0])));
  if(c.gradient.some(v=>!Number.isFinite(v))||!Number.isFinite(c.gap))issues.push({q,c});
}
// Complete turns in either direction consume finite rope. The attachment
// transitions through a straight segment; it cannot accumulate free slack.
const forward=pumpCatchRope([2*Math.PI,0,0],parameters),backward=pumpCatchRope([-2*Math.PI,0,0],parameters);
const passed=!issues.length&&errors.gradient<1e-7&&errors.polylineLength<1e-7&&errors.wrappedLift<1e-12&&errors.inside<1e-12&&forward.gap<0&&backward.gap<0&&modes.size===3;
verifyStudySources(sources);const report={movement:86,status:'finite-attached-rope-geometry-diagnostic',passed,mechanicsPassed:false,candidateIntegrated:false,poses,modes:[...modes],parameters,errors,forwardGap:forward.gap,backwardGap:backward.gap,issues,sources,
  qualification:'Analytic length gradients checked by centered differences; arc and straight lengths checked by independent polygonal paths. Assumed guide, attachment, winding radius and omitted bucket remain subject to reconstruction. No rope mesh or mechanism dynamics qualification.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});if(!passed)process.exitCode=1;
