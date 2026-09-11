import { writeFile } from 'node:fs/promises';
import { makeReciprocatingPawlStudy } from './lib/reciprocating-pawl-contact-study.mjs';
import { pawlFrictionIntervals } from './lib/reciprocating-pawl-friction-study.mjs';

const rows=[];
for(const teeth of [33,34])for(const rootRadius of [.87,.9])for(const faceAngle of [.025,.04,.06,.08]){
  const study=makeReciprocatingPawlStudy({teeth,rootRadius,faceAngle,sourcePoseGravity:true}),states=[];
  let failure=null;
  try{for(let i=0;i<97;i++)states.push(study.atPhase((i+.337)/97));}catch(e){failure=e.message;}
  const trials=[];
  for(const mu of [.1,.15,.2,.25,.3,.35])for(const massFactor of [.5,1,2,4]){
    let low=0,high=Infinity,emptyCount=0,worstLow=null,worstHigh=null;
    for(const state of states){
      const range=pawlFrictionIntervals(state,mu,massFactor);
      if(range.low>low){low=range.low;worstLow=state.phase;}
      if(range.high<high){high=range.high;worstHigh=state.phase;}
      if(!range.intervals.length)emptyCount++;
    }
    trials.push({mu,massFactor,low,high,worstLow,worstHigh,emptyCount,passes:!failure&&low<=high});
  }
  const gravityClosing=states.every(s=>s.B.gravityMoment<0&&s.H.gravityMoment<0),
    counts=states.every(s=>s.B.contacts.length+s.H.contacts.length===3),passes=trials.filter(t=>t.passes);
  rows.push({parameters:study.parameters,failure,gravityClosing,counts,trials,states:states.map(s=>({phase:s.phase,
    angleB:s.B.angle,angleH:s.H.angle,gravityB:s.B.gravityMoment,gravityH:s.H.gravityMoment,
    contactsB:s.B.contacts,contactsH:s.H.contacts}))});
  console.log({teeth,rootRadius,faceAngle,gravityClosing,counts,passes,failure});
}
await writeFile('artifacts/review/075-friction-contact-study.json',JSON.stringify({movement:75,status:'isolated-friction-contact-study',
  productionChanged:false,rows,qualification:'Planar quasistatic Coulomb contact diagnostic. Sliding friction opposes computed relative contact velocity; seated contacts use the static friction cone. Gravity centroids are aligned to the source pose. This is not a 3D model or final source fit.'},null,2)+'\n',{flag:'wx'});
