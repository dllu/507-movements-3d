import fs from 'node:fs';
import source from './lib/weighted-clutch-source.mjs';
import {canonicalWeightedClutchFit} from './lib/weighted-clutch-distributed-candidate.mjs';
import {sourceFitStudContacts,sourceFitBranchMargins} from './lib/weighted-clutch-source-fit.mjs';
import {distributedClutchSources} from './lib/weighted-clutch-distributed-sources.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-contact-aware-source-fit',input='artifacts/review/087-first-fixed-orbit-fit.json',prior=readStudyReport(input),
  sources=freezeStudySources([...distributedClutchSources,input,'scripts/study-weighted-clutch-contact-aware-fit.mjs'],prefix),
  names=['F','A','G','B','upper'],freeAngle=prior.freeAngle,rows=[],target={forward:.1,returning:.02};
verifyStudySources(prior.sources);let evaluations=0,randomState=870903;
const random=()=>((randomState=(Math.imul(randomState,1664525)+1013904223)>>>0)/4294967296),
  decode=(v,radius)=>({E:[0,0],stud:[0,source.origin[1]-source.wheelE.hub.center[1]],...Object.fromEntries(names.map((name,i)=>{
    const p=v.slice(2*i,2*i+2),scale=radius/Math.max(1,Math.hypot(...p));return[name,p.map(x=>x*scale)];
  }))});
function evaluate(vector,radius){
  evaluations++;
  try{
    const options={shifts:decode(vector,radius),freeAngle},fit=canonicalWeightedClutchFit(options),L=fit.parameters;
    let missing=0,coveragePenalty=0,forcePenalty=0,minimumTorque=Infinity;
    for(const direction of ['CCW','CW'])for(let i=0;i<=24;i++){
      const q=direction==='CCW'?L.overCenterAngle*i/24:L.overCenterAngle+(L.leverLeft-L.overCenterAngle)*i/24,
        r=sourceFitStudContacts(fit,q),contacts=r.contacts.filter(c=>c['approach'+direction]);
      if(!contacts.length){missing++;coveragePenalty+=Math.max(0,r.radialGap)**2;}
      else{
        const torque=Math.min(...contacts.map(c=>direction==='CCW'?c.torqueF:-c.torqueF));minimumTorque=Math.min(minimumTorque,torque);
        forcePenalty+=Math.max(0,target[direction==='CCW'?'forward':'returning']-torque)**2;
      }
    }
    const errors=Object.values(L.shifts).map(p=>Math.hypot(...p)),meanSquared=errors.reduce((n,v)=>n+v*v,0)/errors.length,
      materialPenalty=1000*Math.max(0,.003-L.pinEdgeMaterial),displacementPenalty=10*Math.max(0,L.maximumDisplacement-radius)/source.scale,
      score=4*missing/50+8*coveragePenalty/50+forcePenalty/50+materialPenalty+displacementPenalty+.001*meanSquared/radius**2;
    return{vector,score,options,missing,coveragePenalty,forcePenalty,minimumTorque,materialPenalty,displacementPenalty,meanSquared,
      maximumDisplacement:L.maximumDisplacement,cranks:[Math.hypot(...L.armF)*source.scale,L.radiusG*source.scale]};
  }catch(error){return{vector,score:100,error:error.message};}
}
for(const radius of [20,24,28,30,32]){
  const warm=names.flatMap(name=>prior.options.shifts[name].map(v=>v/32)),population=Array.from({length:80},(_,i)=>evaluate(i===0?warm:Array.from({length:10},()=>2*random()-1),radius));
  let best=population.reduce((a,b)=>a.score<b.score?a:b);
  for(let generation=0;generation<240;generation++)for(let i=0;i<population.length;i++){
    const indices=[];while(indices.length<3){const j=Math.floor(random()*population.length);if(j!==i&&!indices.includes(j))indices.push(j);}
    const[a,b,c]=indices.map(j=>population[j].vector),forced=Math.floor(random()*10),
      v=population[i].vector.map((x,k)=>random()<.85||k===forced?Math.max(-1,Math.min(1,a[k]+.7*(b[k]-c[k]))):x),candidate=evaluate(v,radius);
    if(candidate.score<population[i].score)population[i]=candidate;if(candidate.score<best.score)best=candidate;
  }
  for(let step=.05;step>1e-5;step/=2)for(let round=0;round<15;round++){
    let improved=false;for(let k=0;k<10;k++)for(const sign of [-1,1]){
      const v=[...best.vector];v[k]=Math.max(-1,Math.min(1,v[k]+sign*step));const c=evaluate(v,radius);
      if(c.score<best.score){best=c;improved=true;}
    }if(!improved)break;
  }
  const fit=canonicalWeightedClutchFit(best.options),margins=sourceFitBranchMargins(fit,2048),
    feasible=best.materialPenalty===0&&best.displacementPenalty<1e-10&&margins.forward>=target.forward&&margins.returning>=target.returning;
  rows.push({radius,...best,margins,feasible});console.log({radius,feasible,missing:best.missing,margins,cranks:best.cranks,maximumDisplacement:best.maximumDisplacement});
}
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,input,target,evaluations,rows,
  qualification:'A bounded search with contact-coverage distance and count penalties instead of a constant missing-contact margin. The source stud orbit, E axis and slot travel remain fixed. Analytic torque targets are deliberately lower than the old fit reserve; no native contact or dynamics acceptance follows from a successful search. All solutions receive a 2049-sample-per-branch analytic recheck. An unsuccessful population search is not proof of geometric impossibility.'},null,2)+'\n',{flag:'wx'});
