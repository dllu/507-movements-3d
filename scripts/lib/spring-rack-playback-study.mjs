import {makeSpringRackContact} from './spring-rack-contact-study.mjs';

export function makeSpringRackPlayback(candidate,data){
 const u=candidate.root.userData,p=data.parameters,contact=makeSpringRackContact(candidate),knots=data.knots,
  period=p.period,displayPeriod=4,guard=2e-7;
 const sample=displayTime=>{
  const physicalTime=Math.max(0,displayTime)*period/displayPeriod,
   time=physicalTime<=data.end?physicalTime:data.loopStart+(physicalTime-data.loopStart)%period,
   q=-p.omega*time;
  let lo=0,hi=knots.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(knots[mid][0]<=time)lo=mid;else hi=mid;}
  const a=knots[lo],b=knots[hi],fraction=(time-a[0])/(b[0]-a[0]),
   interpolated=a[1]+fraction*(b[1]-a[1]),intervals=contact.forbiddenIntervals(q),feasible=[];
  let low=data.range[0];
  for(const r of intervals){
   const lower=r.low-guard,upper=r.high+guard;
   if(upper<low)continue;if(lower>data.range[1])break;
   if(lower>=low)feasible.push([low,Math.min(data.range[1],lower)]);low=Math.max(low,upper);
  }
  if(low<=data.range[1])feasible.push([low,data.range[1]]);
  if(!feasible.length)throw Error('No finite rack clearance during playback');
  const choices=feasible.map(([a,b])=>Math.max(a,Math.min(b,interpolated))).sort((a,b)=>Math.abs(a-interpolated)-Math.abs(b-interpolated)),rackY=choices[0];
  return{time,physicalTime,q,rackY,interpolated,projection:Math.abs(rackY-interpolated),springCompression:rackY-p.stop+p.preload,
   displayPeriod,phase:(time/period)%1};
 };
 return{sample,contact,displayPeriod};
}
