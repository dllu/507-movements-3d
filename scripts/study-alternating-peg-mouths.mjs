import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeAlternatingPegCandidate} from './lib/alternating-peg-candidate.mjs';
import {closePegPawl,pegPawlProfile,sub,rotate} from './lib/alternating-peg-contact-study.mjs';

const studies=[],steps=1000;
for(const degrees of [-130,-110,-95,-80,-65,-50]){
 const options={lowerMouthAngle:degrees*Math.PI/180},{root,motion}=makeAlternatingPegCandidate(options),p=root.userData.geometry,
  points=root.userData.profiles.lower,profile=pegPawlProfile(points),rows=[],failures=[];
 let angle=p.initialAngles.lower,largestAngleStep=0;
 for(let i=0;i<=steps;i++){
  const q=p.stroke*(1-Math.cos(Math.PI*i/steps))/2,theta=motion.drivenAngle('upper',q)-p.phases.upper,
   P=motion.anchorAt('lower',q),pins=Array.from({length:24},(_,j)=>motion.pinAt(j,theta)),
   gap=a=>Math.min(...pins.map(pin=>profile.closest(rotate(sub(pin,P),-a)).signedDistance-p.pinRadius));
  try{
   const previous=angle;let opening=angle,j=0;
   while(gap(opening)< -1e-7&&j<250){opening-=.0002;j++;}
   const contact=closePegPawl(points,P,pins,p.pinRadius,{lower:opening,upper:previous+.5});angle=contact.angle;
   largestAngleStep=Math.max(largestAngleStep,Math.abs(angle-previous));
   rows.push({q,theta,angle,gap:contact.minimumGap,angleStep:angle-previous,contacts:contact.contacts});
   if(Math.abs(angle-previous)>.015)failures.push({i,kind:'quasistatic-jump',angleStep:angle-previous});
  }catch(error){failures.push({i,error:error.message});}
  if(failures.length)break;
 }
 const expected=motion.atPhase(.5).activeAngle,study={degrees,options,rows,failures,largestAngleStep,expectedHandoffAngle:expected,handoffError:angle-expected};
 studies.push(study);console.log({degrees,rows:rows.length,failures,largestAngleStep,handoffError:study.handoffError});
}
const output=process.env.PROBE_OUTPUT||'artifacts/review/077-mouth-angle-study.json';
fs.writeFileSync(output,JSON.stringify({movement:77,productionChanged:false,mechanicsPassed:false,steps,studies,
 qualification:'First-half geometric return only under prescribed upper pin-center drive. Lip changes are studies, not validated reconstructions. No loaded dynamics or full cycle has passed.',
 sources:['scripts/study-alternating-peg-mouths.mjs','scripts/lib/alternating-peg-contact-study.mjs','scripts/lib/alternating-peg-candidate.mjs'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))},null,2)+'\n');
