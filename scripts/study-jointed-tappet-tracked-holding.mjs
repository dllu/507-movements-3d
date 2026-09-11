import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{makeJointedTappetContactStudy,vadd,vsub,vrotate,vdot,vcross}from'./lib/jointed-tappet-contact-study.mjs';

const s=makeJointedTappetContactStudy({nosePixels:[800,711],seatHolding:true}),p=s.parameters,
  seated=vsub(p.holdingSeat,p.PH),initialAngle=Math.atan2(vcross(p.VH,seated),vdot(p.VH,seated)),
  phases=[...Array.from({length:1601},(_,i)=>1.06*i/1600),...Array.from({length:161},(_,i)=>1.06-.06*(i+1)/161)],rows=[],failures=[],releases=[];
let alpha=initialAngle;
const at=(theta,angle)=>{
  const center=vadd(p.PH,vrotate(p.VH,angle)),contact=s.wheel.closest(vrotate(center,-theta)),normal=vrotate(contact.normal,theta);
  return{gap:contact.signedDistance-p.noseRadius,center,normal,gradient:vcross(vsub(center,p.PH),normal),contact};
};
for(const phase of phases){
  const theta=p.wheelStart+phase*p.pitch,previous=alpha;let value=at(theta,alpha),iterations=0;
  while(value.gap< -1e-11&&iterations++<30){
    if(Math.abs(value.gradient)<1e-10)break;
    alpha+=Math.max(-.01,Math.min(.01,(-value.gap+1e-12)/value.gradient));value=at(theta,alpha);
  }
  if(value.gap< -1e-9){failures.push({kind:'local-contact-repair-failed',phase,alpha,value});break;}
  try{
    const H=s.wheel.closeCircle(p.PH,p.VH,theta,p.noseRadius,{lower:alpha-1e-10,upper:.7,requireContact:true});
    alpha=H.angle;if(alpha-previous>.02)releases.push({phase,previous,alpha});rows.push({phase,theta,H});
  }catch(error){failures.push({phase,alpha,error:error.message});break;}
}
const end=rows.at(-1),report={movement:76,status:'tracked-holding-seat-study',productionChanged:false,mechanicsPassed:false,
  parameters:p,initialAngle,rows,failures,releases,end,
  endpointError:end?Math.abs(end.H.angle-initialAngle):null,
  source:{file:'scripts/study-jointed-tappet-tracked-holding.mjs',sha256:createHash('sha256').update(await readFile('scripts/study-jointed-tappet-tracked-holding.mjs')).digest('hex')},
  qualification:'The initial holding nose is placed in the measured two-feature seat. Wheel advance and a small rollback are prescribed only for this contact-path diagnostic. Local overlap repair follows the contact gradient, then CCW gravity closure starts from the current clear interval. This does not establish force equilibrium, finite fall time or an acceptable whole-mechanism trajectory.'};
await writeFile('artifacts/review/076-tracked-holding-seat-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:rows.length,initialAngle,endpointError:report.endpointError,end,releases,failures});
