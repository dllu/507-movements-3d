import fs from 'node:fs';import crypto from 'node:crypto';
import {makeAlternatingPegCandidate} from './lib/alternating-peg-candidate.mjs';
const files=(process.env.PROBE_TRAJECTORIES||'artifacts/review/077-long-lip-clock-slow.json,artifacts/review/077-long-lip-clock-fine.json,artifacts/review/077-long-lip-clock-finer.json').split(','),
 data=files.map(file=>JSON.parse(fs.readFileSync(file))),candidate=makeAlternatingPegCandidate(data[0].geometry),u=candidate.root.userData,
 radii=Object.fromEntries(['wheel','upper','lower'].map(family=>{
  let maximum=0;for(const[name,mesh]of Object.entries(u.parts))if(u.families[name]===family){const p=mesh.geometry.attributes.position;
   for(let i=0;i<p.count;i++)maximum=Math.max(maximum,Math.hypot(p.getX(i)+mesh.position.x,p.getY(i)+mesh.position.y));}
  return[family,maximum];
 })),comparisons=[];
for(let pair=0;pair<data.length-1;pair++){
 const a=data[pair],b=data[pair+1],ratio=Math.round(a.dt/b.dt),count=Math.min(a.rows.length,Math.floor((b.rows.length-1)/ratio)+1),
  maxima={wheel:0,upper:0,lower:0},stateErrors=[0,0,0],witnesses={},square=[0,0,0];
 for(let i=0;i<count;i++){
  const x=a.rows[i],y=b.rows[i*ratio];if(Math.abs(x.time-y.time)>1e-7)throw Error('Unaligned time grids');
  for(const [j,key]of ['wheel','upper','lower'].entries()){
   const difference=Math.abs(x.x[j]-y.x[j]),anchor=key==='wheel'?0:2*Math.hypot(...u.geometry.arms[key])*Math.sin(Math.abs(x.q-y.q)/2),
    displacement=(anchor+2*radii[key]*Math.sin(difference/2))*u.geometry.scale;
   stateErrors[j]=Math.max(stateErrors[j],difference);square[j]+=difference*difference;
   if(displacement>maxima[key]){maxima[key]=displacement;witnesses[key]={time:x.time,coarse:x.x,fine:y.x,displacement};}
  }
 }
 comparisons.push({coarse:files[pair],fine:files[pair+1],dt:[a.dt,b.dt],samples:count,maximumSourcePixelDisplacement:Math.max(...Object.values(maxima)),
  maxima,witnesses,stateErrors,rms:square.map(v=>Math.sqrt(v/count))});
}
const output=process.env.PROBE_OUTPUT||'artifacts/review/077-long-lip-clock-convergence.json',report={movement:77,productionChanged:false,mechanicsPassed:false,
 status:'observed-step-refinement',radii,comparisons,
 qualification:'Aligned angular-state differences are converted to conservative whole-body source-pixel displacement bounds using actual mesh radii and pivot separation. This records observed refinement, not a proof of the continuous dynamics. No tolerance is relaxed or result accepted automatically.',
 sources:[...files,'scripts/assess-alternating-peg-convergence.mjs','scripts/lib/alternating-peg-candidate.mjs'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log({output,comparisons:comparisons.map(({coarse,fine,maximumSourcePixelDisplacement,stateErrors})=>({coarse,fine,maximumSourcePixelDisplacement,stateErrors}))});
