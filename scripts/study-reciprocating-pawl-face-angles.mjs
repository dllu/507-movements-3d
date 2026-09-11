import { writeFile } from 'node:fs/promises';
import { makeReciprocatingPawlStudy, pawlForceHalfPlanes } from './lib/reciprocating-pawl-contact-study.mjs';

const clip=(polygon,h)=>{
  const out=[],value=p=>h.constant+h.load*p[0]+h.mass*p[1];
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length],da=value(a),db=value(b);
    if(da>=0)out.push(a);
    if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((v,j)=>v+t*(b[j]-v)));}
  }
  return out;
};
const rows=[];
for(const faceAngle of [-.02,0,.012,.025,.04,.06,.08,.10])for(const rootRadius of [.84,.87,.90]){
  const study=makeReciprocatingPawlStudy({faceAngle,rootRadius}),samples=[],allPlanes=[];
  let feasible=[[0,.02],[20,.02],[20,10],[0,10]],failure=null;
  try{
    for(let i=0;i<97;i++){
      const phase=(i+.337)/97,state=study.atPhase(phase),planes=pawlForceHalfPlanes(state);
      samples.push({phase,angleB:state.B.angle,angleH:state.H.angle,countB:state.B.contacts.length,countH:state.H.contacts.length,
        gravityB:state.B.gravityMoment,gravityH:state.H.gravityMoment});
      if(!planes)throw new Error('Expected three independent contact reactions');
      for(const h of planes){allPlanes.push({phase,...h});feasible=clip(feasible,h);}
    }
  }catch(error){failure=error.message;feasible=[];}
  rows.push({faceAngle,rootRadius,parameters:study.parameters,feasible,samples,halfPlanes:allPlanes,failure});
  console.log({faceAngle,rootRadius,feasible,failure});
}
await writeFile('artifacts/review/075-face-angle-force-study.json',JSON.stringify({movement:75,status:'isolated-face-angle-study',productionChanged:false,rows,
  qualification:'Half-plane intersection in constant counterclockwise output load and holding-pawl mass factor. Every contact reaction must remain nonnegative at the sampled drive/return positions. This is a parameter diagnostic, not source-fit or 3D acceptance.'},null,2)+'\n',{flag:'wx'});
