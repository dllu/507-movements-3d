import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { makeReciprocatingPawlStudy } from './lib/reciprocating-pawl-contact-study.mjs';
import { pawlFrictionIntervals } from './lib/reciprocating-pawl-friction-study.mjs';

const rows=[];
for(const teeth of [33,34]){
  const study=makeReciprocatingPawlStudy({teeth,faceAngle:.06,sourcePoseGravity:true}),states=[];
  for(const phase of [0,.5,1,study.parameters.sourcePhase,...Array.from({length:1297},(_,i)=>(i+.413)/1297)])states.push(study.atPhase(phase));
  states.sort((a,b)=>a.phase-b.phase);
  let low=0,high=Infinity,gravityMaximum=-Infinity,normalVelocityMaximum=0,maximumResidual=0,minimumNormal=Infinity,
    maximumFrictionRatio=0,minimumDissipation=Infinity,maximumReaction=0,maximumAngleStep=0;
  const failures=[],samples=[],mu=.2,load=3;
  for(let index=0;index<states.length;index++){
    const state=states[index],range=pawlFrictionIntervals(state,mu),basis=range.intervals.filter(x=>load>=x.low-1e-9&&load<=x.high+1e-9)
      .map(x=>({...x,reactions:x.base.map((v,i)=>v+load*x.slope[i])})).sort((a,b)=>Math.hypot(...a.reactions)-Math.hypot(...b.reactions))[0];
    low=Math.max(low,range.low);high=Math.min(high,range.high);
    gravityMaximum=Math.max(gravityMaximum,state.B.gravityMoment,state.H.gravityMoment);
    for(const x of range.sliding)normalVelocityMaximum=Math.max(normalVelocityMaximum,Math.abs(x.normalVelocity));
    if(index>0)maximumAngleStep=Math.max(maximumAngleStep,Math.abs(state.B.angle-states[index-1].B.angle),Math.abs(state.H.angle-states[index-1].H.angle));
    if(!basis){failures.push({phase:state.phase,reason:'No compressive Coulomb equilibrium',low:range.low,high:range.high});continue;}
    const contacts=new Map(),residual=[state.B.gravityMoment,state.H.gravityMoment,load];
    for(let i=0;i<3;i++){
      const column=range.columns[basis.chosen[i]],reaction=basis.reactions[i],key=column.kind+':'+column.feature;
      maximumReaction=Math.max(maximumReaction,reaction);
      for(let row=0;row<3;row++)residual[row]+=reaction*column.column[row];
      const previous=contacts.get(key)??{kind:column.kind,feature:column.feature,normal:0,tangent:0};
      previous.normal+=reaction;previous.tangent+=reaction*column.sign*mu;contacts.set(key,previous);
    }
    maximumResidual=Math.max(maximumResidual,...residual.map(Math.abs));
    for(const c of contacts.values()){
      minimumNormal=Math.min(minimumNormal,c.normal);
      if(c.normal>1e-10)maximumFrictionRatio=Math.max(maximumFrictionRatio,Math.abs(c.tangent)/c.normal);
      const sliding=range.sliding.find(s=>s.kind===c.kind&&s.feature===c.feature);
      if(sliding)minimumDissipation=Math.min(minimumDissipation,-c.tangent*sliding.slip);
    }
    samples.push({phase:state.phase,angleB:state.B.angle,angleH:state.H.angle,gravityB:state.B.gravityMoment,gravityH:state.H.gravityMoment,
      gapB:state.B.gap,gapH:state.H.gap,contacts:[...contacts.values()],sliding:range.sliding,residual});
  }
  const row={parameters:study.parameters,mu,load,poses:states.length,low,high,gravityMaximum,normalVelocityMaximum,maximumResidual,
    minimumNormal,maximumFrictionRatio,minimumDissipation,maximumReaction,maximumAngleStep,failures,samples};rows.push(row);
  console.log({...row,parameters:{teeth},samples:undefined});
}
const hash=async file=>({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
const files=await Promise.all(['scripts/lib/reciprocating-pawl-contact-study.mjs','scripts/lib/reciprocating-pawl-friction-study.mjs',
  'scripts/probe-reciprocating-pawl-friction-detail.mjs'].map(hash));
await writeFile('artifacts/review/075-dense-friction-contact-study.json',JSON.stringify({movement:75,status:'isolated-dense-friction-contact-study',
  productionChanged:false,rows,files,qualification:'Planar circular-nose quasistatic equilibrium at independent sample phases; constant opposing output torque, gravity and Coulomb contact friction. No inertia or 3D geometry is included. Numerical sample success is not a proof between samples.'},null,2)+'\n',{flag:'wx'});
