import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildStudy, TAU, add, sub, scale, dot, cross, norm, unit, rotate, polar, closestSegment } from './lib/tappet-stop-study.mjs';
const sharp=process.env.STUDY_SHARP_TOE==='1', prefix=sharp?'065-sharp-toe-planar':'065-finite-planar';
const m=buildStudy(sharp?{toeRadius:0,leftExtension:.05,rightExtension:-.03}:{}), {p}=m, count=2048;
const rows=[];
for(let i=0;i<=count;i++){
  const gamma=p.gammaStart+(p.gammaEnd-p.gammaStart)*i/count;
  const state=m.motion(gamma), stop=m.stopAt(state.beta);
  const center=rotate(add(p.pivot,rotate(p.toeCenter,stop.theta)),-gamma);
  rows.push({gamma,beta:state.beta,stage:state.stage,theta:stop.theta,stopGap:stop.gap,center,
    stopStud:stop.stud,stopEdge:stop.edge,stopPoint:stop.point,stopNormal:stop.normal});
}
const cam=sharp?[
  ...rows.map(row=>row.center),
  ...Array.from({length:4096},(_,i)=>polar(p.driverRadius,TAU*i/4096)).filter(q=>{
    const a=Math.atan2(q[1],q[0]);return a<Math.atan2(rows[0].center[1],rows[0].center[0])||a>Math.atan2(rows.at(-1).center[1],rows.at(-1).center[0]);
  }),
].sort((a,b)=>Math.atan2(a[1],a[0])-Math.atan2(b[1],b[0])):Array.from({length:4096},(_,i)=>{
  const angle=TAU*i/4096, u=polar(1,angle);let radius=p.driverRadius;
  for(const row of rows){const normal=cross(u,row.center);if(Math.abs(normal)>p.toeRadius)continue;
    const along=dot(u,row.center);if(along<=0)continue;
    radius=Math.min(radius,along-Math.sqrt(p.toeRadius**2-normal**2));}
  return polar(radius,angle);
});
const contacts=rows.filter((_,i)=>i%4===0||i===count).map(row=>{
  let best={distance:Infinity};
  for(let j=0;j<cam.length;j++){const hit=closestSegment(row.center,cam[j],cam[(j+1)%cam.length]);if(hit.distance<best.distance)best={...hit,edge:j};}
  const edge=sub(cam[(best.edge+1)%cam.length],cam[best.edge]);
  const n=sharp?unit([edge[1],-edge[0]]):unit(sub(row.center,best.point)), toeForce=rotate(n,row.gamma);
  const toeWorld=sub(add(p.pivot,rotate(p.toeCenter,row.theta)),scale(toeForce,p.toeRadius));
  const leverNormal=rotate(row.stopNormal,row.theta), point=add(p.pivot,rotate(row.stopPoint,row.theta));
  return {gamma:row.gamma,beta:row.beta,theta:row.theta,gap:best.distance-p.toeRadius,
    camMoment:cross(sub(toeWorld,p.pivot),toeForce),
    studMoment:cross(sub(point,p.pivot),scale(leverNormal,-1))};
});
let minBetaStep=Infinity, maxStopGap=0;
for(let i=1;i<rows.length;i++)minBetaStep=Math.min(minBetaStep,rows[i].beta-rows[i-1].beta);
for(const row of rows)maxStopGap=Math.max(maxStopGap,Math.abs(row.stopGap));
const summary={poses:rows.length,studPitch:p.pitch,advance:rows.at(-1).beta-rows[0].beta,
  minBetaStep,maxStopGap,minStopAngle:Math.min(...rows.map(r=>r.theta)),
  finiteCamMinimumGap:Math.min(...contacts.map(r=>r.gap)),finiteCamMaximumGap:Math.max(...contacts.map(r=>r.gap)),
  camMinimumMoment:Math.min(...contacts.map(r=>r.camMoment)),camMaximumMoment:Math.max(...contacts.map(r=>r.camMoment)),
  studMinimumMoment:Math.min(...contacts.map(r=>r.studMoment)),studMaximumMoment:Math.max(...contacts.map(r=>r.studMoment))};
const report={movement:65,status:'isolated-planar-study',productionChanged:false,parameters:p,summary,
  qualification:'Planar ideal-circle construction and finite toe envelope diagnostic only. Full tappet/body clearance, independent force and 3D hardware checks are still required.',
  hashes: Object.fromEntries(await Promise.all(['scripts/lib/tappet-stop-study.mjs','scripts/study-tappet-stop-geometry.mjs'].map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')]))),
  rows,cam,contacts};
await writeFile(`artifacts/review/${prefix}-study.json`,JSON.stringify(report,null,2)+'\n');
console.log(summary);
const X=q=>[352+260*q[0],415-260*q[1]], coords=q=>X(q).join(','), path=points=>points.map((q,i)=>(i?'L':'M')+coords(q)).join(' ')+' Z';
const circle=(c,r,color)=>`<circle cx="${X(c)[0]}" cy="${X(c)[1]}" r="${r*260}" stroke="${color}" fill="none"/>`;
const sourceGamma=16.15*Math.PI/180;
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="870" viewBox="0 0 1400 870"><image href="../reference/brown-065-detail.png" width="1400" height="870"/><g stroke-width="2.5" fill="none">`;
svg+=`<path d="${path(cam.map(q=>rotate(q,sourceGamma)))}" stroke="#00f4ff"/>`;
svg+=circle([p.D,0],1.26,'#00f4ff')+circle([0,0],.26,'#00f4ff')+circle([p.D,0],.26,'#00f4ff')+circle(p.pivot,.23,'#ffd000');
for(let i=0;i<10;i++)svg+=circle(m.pin(p.betaStart+i*p.pitch),p.pinRadius,'#00f4ff');
svg+=`<path d="M${p.tooth.map(q=>coords(add(p.pivot,q))).join(' L')}" stroke="#ff3cce"/>`+circle(add(p.pivot,p.toeCenter),p.toeRadius,'#ff3cce');
svg+=`<path d="M${coords(rotate([.18,-p.h],sourceGamma))} L${coords(rotate([p.tipCenter[0],-p.h],sourceGamma))}" stroke="#32ff78"/>`+circle(rotate(p.tipCenter,sourceGamma),p.tipRadius,'#32ff78');
svg+='</g></svg>';
await writeFile(`artifacts/review/${prefix}-source.svg`,svg);
