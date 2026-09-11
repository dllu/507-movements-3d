import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeAlternatingPegCandidate} from './lib/alternating-peg-candidate.mjs';
import {closePegPawl,pegPawlProfile,sub,rotate} from './lib/alternating-peg-contact-study.mjs';

const steps=Number(process.env.PROBE_STEPS||2000),output=process.env.PROBE_OUTPUT||'artifacts/review/077-initial-gravity-return.json',
 candidate=makeAlternatingPegCandidate(),{root,motion}=candidate,p=root.userData.geometry,profiles=root.userData.profiles,
 angles={...p.initialAngles},rows=[],failures=[],transitions=[];
let lastContacts={},largestAngleStep=0;
for(let i=0;i<=steps;i++){
 const state=motion.atPhase(i/steps),pins=Array.from({length:24},(_,j)=>motion.pinAt(j,state.theta)),row={...state,pawls:{}};
 for(const key of ['upper','lower']){
  const previous=angles[key],profile=pegPawlProfile(profiles[key]),P=state.anchors[key],
   gap=angle=>Math.min(...pins.map(pin=>profile.closest(rotate(sub(pin,P),-angle)).signedDistance-p.pinRadius));
  try{
   let contact;
   if(key===state.active){angles[key]=state.activeAngle;contact={angle:angles[key],minimumGap:gap(angles[key]),prescribedSeat:true};}
   else{
    let opening=previous,openingSteps=0;
    while(gap(opening)< -1e-7&&openingSteps<250){opening-=.0002;openingSteps++;}
    contact=closePegPawl(profiles[key],P,pins,p.pinRadius,{lower:opening,upper:previous+.5});angles[key]=contact.angle;
    contact.openingSteps=openingSteps;delete contact.gaps;
   }
   largestAngleStep=Math.max(largestAngleStep,Math.abs(angles[key]-previous));
   const signature=contact.contacts?.map(c=>c.pin).filter((v,j,a)=>a.indexOf(v)===j).join(',')||'seat';
   if(lastContacts[key]!==signature){transitions.push({phase:i/steps,key,from:lastContacts[key],to:signature,angle:angles[key],angleStep:angles[key]-previous});lastContacts[key]=signature;}
   row.pawls[key]={...contact,previousAngle:previous,angleStep:angles[key]-previous};
   if(contact.minimumGap< -1e-7)failures.push({phase:i/steps,key,kind:'prescribed-seat-penetration',gap:contact.minimumGap});
   if(Math.abs(angles[key]-previous)>.015)failures.push({phase:i/steps,key,kind:'quasistatic-angle-jump',angleStep:angles[key]-previous});
  }catch(error){failures.push({phase:i/steps,key,error:error.message,previousAngle:previous,gap:gap(previous)});}
 }
 rows.push(row);if(failures.length)break;
 if(i%250===0)console.log({step:i,phase:i/steps,angles,largestAngleStep});
}
const report={movement:77,status:failures.length?'geometry-study-rejected':'sampled-quasistatic-return-candidate',productionChanged:false,mechanicsPassed:false,
 qualification:'The wheel and driving pawl are constrained to a pin center. The inactive pawl is closed quasistatically from the previous pose with local lift only for obstructed starts. This studies geometric return feasibility; it does not establish force feasibility, time-continuous clearance, or free-flight dynamics.',steps,largestAngleStep,parameters:p,transitions,failures,rows,
 sources:['scripts/probe-alternating-peg-return.mjs','scripts/lib/alternating-peg-contact-study.mjs','scripts/lib/alternating-peg-candidate.mjs'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log({output,rows:rows.length,failures,largestAngleStep});if(failures.length)process.exitCode=1;
