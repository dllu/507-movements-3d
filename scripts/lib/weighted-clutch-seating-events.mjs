import {makeWeightedClutchLoadedSeating} from './weighted-clutch-loaded-seating.mjs';

// Locate the seating-corner collision before resolving its velocity. A step
// that spans the corner otherwise selects its outgoing flank at the end of
// the step, making the small repeated lift-outs sensitive to step size.
export function makeWeightedClutchSeatingEvents(model,impact,profile){
 const base=makeWeightedClutchLoadedSeating(model,impact,profile),peak=profile.peak.angle;
 function advance(before,h){
  const after=base.step(before,h),a=before.phase.relative-peak,b=after.phase.relative-peak;
  if(Math.abs(a)<1e-10||a*b>=0)return after;
  const gap=state=>Math.min(...base.jaw.evaluate(state.phase.relative,state.q[2]).map(c=>c.gap));
  if(Math.min(gap(before),gap(after))>2e-8)return after;
  let lo=0,hi=h,end=after;
  for(let i=0;i<36;i++){
   const m=(lo+hi)/2,test=base.step(before,m),offset=test.phase.relative-peak;
   end=test;if(Math.abs(offset)<1e-12)break;
   if(offset*a>0)lo=m;else hi=m;
  }
  if(Math.abs(end.phase.relative-peak)>1e-10)throw Error('Seating corner root failed');
  return {...end,seatingCornerImpact:true};
 }
 return {...base,advance,parameters:{...base.parameters,cornerEventLocation:true}};
}
